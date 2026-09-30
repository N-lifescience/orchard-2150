// ─────────────────────────────────────────────────────────────
// 합성 재료: 타악기 배음, FM 벨, 필터 노이즈, 음높이 미끄럼(붐·둔탁음), 드론.
// 전부 오실레이터·노이즈 버퍼·필터·엔벨로프로만 만든다(외부 음원 없음).
// ─────────────────────────────────────────────────────────────
import type { Out } from './engine';
import { rand } from './theory';

const MAX_F = 15000; // 이보다 높은 배음은 안 들리고 CPU 만 먹는다
const FLOOR = 0.0001;

/** [배음 비, 상대 크기, 사라지는 시간(초)] */
export type Partials = readonly (readonly [number, number, number])[];

// 막대·판의 실제 진동 모드 비율을 흉내 낸 음색 표
export const MARIMBA: Partials = [
  [1, 1, 0.9],
  [3.93, 0.3, 0.16],
  [9.2, 0.06, 0.05],
];
export const GLASS: Partials = [
  [1, 1, 1.2],
  [2.76, 0.28, 0.45],
  [5.4, 0.1, 0.18],
  [8.93, 0.04, 0.08],
];
export const MUSICBOX: Partials = [
  [1, 1, 1.7],
  [2, 0.12, 0.7],
  [6.1, 0.09, 0.14],
];
export const WOOD: Partials = [
  [1, 1, 0.12],
  [2.45, 0.45, 0.05],
  [4.1, 0.15, 0.025],
];
export const COIN: Partials = [
  [1, 1, 0.9],
  [1.0035, 0.6, 0.9], // 살짝 어긋난 쌍 — 맑게 떨리는 맥놀이
  [2.41, 0.4, 0.4],
  [4.07, 0.22, 0.18],
  [6.26, 0.09, 0.08],
];
export const CHIME: Partials = [
  [1, 1, 2.6],
  [2, 0.18, 1.4],
  [2.76, 0.32, 0.9],
  [5.4, 0.12, 0.35],
  [8.93, 0.05, 0.15],
];

function envPerc(p: AudioParam, t: number, peak: number, attack: number, decay: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + attack);
  p.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
}

function toDest(o: Out, node: AudioNode, pan: number | undefined): void {
  if (pan && typeof o.ctx.createStereoPanner === 'function') {
    const p = o.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    p.connect(o.dest);
  } else {
    node.connect(o.dest);
  }
}

export interface ToneOpts {
  type?: OscillatorType;
  wave?: PeriodicWave;
  detune?: number;
  /** 시작 음높이 비율(1.05 면 살짝 높게 시작해 내려앉음) */
  from?: number;
  glide?: number;
  pan?: number;
  lp?: number;
}

/** 오실레이터 하나를 타악기 엔벨로프로 */
export function partial(
  o: Out,
  t: number,
  freq: number,
  amp: number,
  attack: number,
  decay: number,
  opts: ToneOpts = {},
): void {
  if (amp <= 0 || freq <= 0 || freq > MAX_F) return;
  const ctx = o.ctx;
  const osc = ctx.createOscillator();
  if (opts.wave) osc.setPeriodicWave(opts.wave);
  else osc.type = opts.type ?? 'sine';
  if (opts.detune) osc.detune.value = opts.detune;
  if (opts.from && opts.from !== 1) {
    osc.frequency.setValueAtTime(freq * opts.from, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + (opts.glide ?? 0.03));
  } else {
    osc.frequency.setValueAtTime(freq, t);
  }
  const g = ctx.createGain();
  envPerc(g.gain, t, amp, attack, decay);
  if (opts.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lp;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  toDest(o, g, opts.pan);
  const stop = t + attack + decay + 0.02;
  osc.start(t);
  osc.stop(stop);
  o.track(osc, stop);
}

export interface MalletOpts {
  attack?: number;
  /** 채가 부딪히는 순간의 짧은 노이즈 크기(상대값) */
  click?: number;
  pan?: number;
  /** 모든 배음 감쇠 시간 배율 */
  decayScale?: number;
  from?: number;
}

/** 여러 배음을 합친 막대·유리·종 타격음 */
export function mallet(o: Out, t: number, f: number, amp: number, parts: Partials, opts: MalletOpts = {}): void {
  const attack = opts.attack ?? 0.002;
  const ds = opts.decayScale ?? 1;
  for (const [ratio, rel, decay] of parts) {
    partial(o, t, f * ratio, amp * rel, attack, decay * ds, {
      pan: opts.pan,
      from: opts.from,
      glide: 0.025,
    });
  }
  if (opts.click) {
    noiseHit(o, t, {
      dur: 0.014,
      attack: 0.001,
      amp: amp * opts.click,
      type: 'bandpass',
      freq: Math.min(9000, f * 3),
      q: 1.4,
      pan: opts.pan,
    });
  }
}

export interface NoiseOpts {
  dur: number;
  amp: number;
  attack?: number;
  /** 최고 크기로 머무는 시간 */
  hold?: number;
  type?: BiquadFilterType;
  /** 고정 주파수, 또는 [시작 후 초, 주파수] 점들(지수 곡선으로 잇는다) */
  freq: number | readonly (readonly [number, number])[];
  q?: number;
  buffer?: 'noise' | 'crackle';
  pan?: number;
}

/** 필터 거친 노이즈 한 덩이 (스침·가위·불꽃·반짝임) */
export function noiseHit(o: Out, t: number, n: NoiseOpts): void {
  if (n.amp <= 0) return;
  const ctx = o.ctx;
  const src = ctx.createBufferSource();
  src.buffer = n.buffer === 'crackle' ? o.crackle : o.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = n.type ?? 'bandpass';
  f.Q.value = n.q ?? 1;
  if (typeof n.freq === 'number') {
    f.frequency.setValueAtTime(n.freq, t);
  } else {
    let first = true;
    for (const [dt, hz] of n.freq) {
      if (first) f.frequency.setValueAtTime(hz, t + dt);
      else f.frequency.exponentialRampToValueAtTime(hz, t + dt);
      first = false;
    }
  }
  const g = ctx.createGain();
  const attack = n.attack ?? 0.005;
  const hold = n.hold ?? 0;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(n.amp, t + attack);
  if (hold > 0) g.gain.setValueAtTime(n.amp, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + Math.max(n.dur, attack + hold + 0.01));
  src.connect(f);
  f.connect(g);
  toDest(o, g, n.pan);
  const stop = t + Math.max(n.dur, attack + hold + 0.01) + 0.02;
  const dur = src.buffer ? src.buffer.duration : 2;
  src.start(t, rand() * dur * 0.9);
  src.stop(stop);
  o.track(src, stop);
}

export interface GlideOpts {
  type?: OscillatorType;
  f0: number;
  f1: number;
  /** 음높이가 f1 에 닿는 시간 */
  glide?: number;
  dur: number;
  amp: number;
  attack?: number;
  lp?: number;
  pan?: number;
}

/** 음높이가 떨어지는 톤: 붐, 둔탁한 노크, 나무 쿵 */
export function sweep(o: Out, t: number, s: GlideOpts): void {
  if (s.amp <= 0) return;
  const ctx = o.ctx;
  const osc = ctx.createOscillator();
  osc.type = s.type ?? 'sine';
  osc.frequency.setValueAtTime(s.f0, t);
  osc.frequency.exponentialRampToValueAtTime(s.f1, t + (s.glide ?? s.dur));
  const g = ctx.createGain();
  envPerc(g.gain, t, s.amp, s.attack ?? 0.003, s.dur);
  if (s.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = s.lp;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  toDest(o, g, s.pan);
  const stop = t + (s.attack ?? 0.003) + s.dur + 0.02;
  osc.start(t);
  osc.stop(stop);
  o.track(osc, stop);
}

export interface BellOpts {
  /** 변조기/반송파 비. 2 = 따뜻한(배음 정렬), 3.5 = 금속성 반짝 */
  ratio: number;
  index0: number;
  index1: number;
  decay: number;
  attack?: number;
  pan?: number;
  detune?: number;
}

/** FM 벨: 변조 지수가 줄어들며 밝은 타격 → 둥근 여운 */
export function fmBell(o: Out, t: number, f: number, amp: number, b: BellOpts): void {
  if (amp <= 0 || f <= 0 || f > MAX_F) return;
  const ctx = o.ctx;
  const attack = b.attack ?? 0.003;
  const car = ctx.createOscillator();
  car.frequency.setValueAtTime(f, t);
  if (b.detune) car.detune.value = b.detune;
  const mod = ctx.createOscillator();
  const fm = f * b.ratio;
  mod.frequency.setValueAtTime(fm, t);
  const idx = ctx.createGain();
  idx.gain.setValueAtTime(b.index0 * fm, t);
  idx.gain.exponentialRampToValueAtTime(Math.max(0.001, b.index1 * fm), t + b.decay * 0.6);
  mod.connect(idx);
  idx.connect(car.frequency);
  const g = ctx.createGain();
  envPerc(g.gain, t, amp, attack, b.decay);
  car.connect(g);
  toDest(o, g, b.pan);
  const stop = t + attack + b.decay + 0.02;
  car.start(t);
  mod.start(t);
  car.stop(stop);
  mod.stop(stop);
  o.track(car, stop);
  o.track(mod, stop);
}

export interface DroneOpts {
  wave?: PeriodicWave;
  type?: OscillatorType;
  attack: number;
  hold: number;
  release: number;
  /** 센트 단위 좌우 벌림(두 오실레이터) */
  spread?: number;
  filter?: readonly (readonly [number, number])[];
  q?: number;
}

/** 여러 음을 한 필터·한 엔벨로프로 묶은 느린 드론/패드 */
export function drone(o: Out, t: number, freqs: readonly number[], amp: number, d: DroneOpts): void {
  if (amp <= 0 || freqs.length === 0) return;
  const ctx = o.ctx;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = d.q ?? 0.8;
  const pts = d.filter ?? [[0, 2000]];
  let first = true;
  for (const [dt, hz] of pts) {
    if (first) f.frequency.setValueAtTime(hz, t + dt);
    else f.frequency.exponentialRampToValueAtTime(hz, t + dt);
    first = false;
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + d.attack);
  g.gain.setValueAtTime(amp, t + d.attack + d.hold);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + d.attack + d.hold + d.release);
  f.connect(g);
  g.connect(o.dest);
  const stop = t + d.attack + d.hold + d.release + 0.02;
  const spread = d.spread ?? 0;
  const each = 1 / freqs.length;
  for (const hz of freqs) {
    for (const side of spread ? [-1, 1] : [0]) {
      const osc = ctx.createOscillator();
      if (d.wave) osc.setPeriodicWave(d.wave);
      else osc.type = d.type ?? 'sawtooth';
      osc.frequency.setValueAtTime(hz, t);
      osc.detune.value = side * spread;
      const og = ctx.createGain();
      og.gain.value = spread ? each * 0.6 : each;
      osc.connect(og);
      og.connect(f);
      osc.start(t);
      osc.stop(stop);
      o.track(osc, stop);
    }
  }
}

/** 흔들리는 톤(비브라토가 점점 잦아듦) — 비법 카드가 '까딱' 흔들릴 때 */
export function wobble(o: Out, t: number, f: number, amp: number, dur: number, rate: number, depth: number): void {
  if (amp <= 0 || f <= 0 || f > MAX_F) return;
  const ctx = o.ctx;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(f, t);
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(rate, t);
  const lg = ctx.createGain();
  lg.gain.setValueAtTime(f * depth, t);
  lg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * depth * 0.1), t + dur);
  lfo.connect(lg);
  lg.connect(osc.frequency);
  const g = ctx.createGain();
  envPerc(g.gain, t, amp, 0.006, dur);
  osc.connect(g);
  g.connect(o.dest);
  const stop = t + dur + 0.03;
  osc.start(t);
  lfo.start(t);
  osc.stop(stop);
  lfo.stop(stop);
  o.track(osc, stop);
  o.track(lfo, stop);
}
