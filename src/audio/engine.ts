// ─────────────────────────────────────────────────────────────
// 오디오 엔진: AudioContext, 버스, 마스터 컴프레서·리미터, 코드로 만든 리버브·에코,
// 노이즈 버퍼, 효과음 보이스 관리(동시 발음 제한·정리).
//
// 신호 흐름
//   효과음 보이스 ─┬─ sfxDry ───────────────┐
//                 └─ sfxWet ─┐              │
//   음악 레이어 ──┬─ musicDry ────────────── ├─ master(볼륨·음소거) → 컴프레서 → 리미터 → trim → 출력
//                ├─ musicWet ─┼─ HPF → 리버브 ┘
//                └─ echoIn → 딜레이(피드백·LPF) → musicDry/musicWet
// ─────────────────────────────────────────────────────────────
import { loadSettings, type AudioSettings } from './settings';
import { rand } from './theory';

export type WaveName = 'warm' | 'hollow' | 'glass';

export interface Engine {
  ctx: AudioContext;
  master: GainNode;
  sfxDry: GainNode;
  sfxWet: GainNode;
  musicDry: GainNode;
  musicWet: GainNode;
  echoIn: GainNode;
  echoDelay: DelayNode;
  noise: AudioBuffer;
  crackle: AudioBuffer;
  waves: Record<WaveName, PeriodicWave>;
}

/** 악기 함수들이 소리를 내보내는 곳 (효과음 보이스든 음악 레이어든) */
export interface Out {
  ctx: AudioContext;
  dest: AudioNode;
  noise: AudioBuffer;
  crackle: AudioBuffer;
  /** 소스를 등록한다(정리·강제 정지용). stopAt 은 소스가 멈추는 시각 */
  track(src: AudioScheduledSourceNode, stopAt: number): void;
}

export const settings: AudioSettings = loadSettings();

let eng: Engine | null = null;
let unsupported = false;
let hidden = false;

/** 볼륨 슬라이더 0..1 → 이득. 제곱 곡선이 귀에 고르게 들린다 */
const curve = (v: number): number => v * v;
const SFX_TRIM = 1.8;
const MUSIC_TRIM = 1.4;

export function engine(): Engine | null {
  return eng;
}

export function isHidden(): boolean {
  return hidden;
}

/** 첫 사용자 입력 안에서 부른다. WebAudio 가 없으면 null (이후 조용히 무시) */
export function ensureEngine(): Engine | null {
  if (eng || unsupported) return eng;
  if (typeof window === 'undefined') {
    unsupported = true;
    return null;
  }
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) {
    unsupported = true;
    return null;
  }
  let ctx: AudioContext;
  try {
    ctx = new Ctor({ latencyHint: 'interactive' });
  } catch {
    unsupported = true;
    return null;
  }
  eng = build(ctx);
  if (typeof document !== 'undefined') {
    hidden = document.visibilityState === 'hidden';
    document.addEventListener('visibilitychange', onVisibility);
  }
  applyGains(true);
  return eng;
}

export function resumeContext(): void {
  if (!eng) return;
  if (eng.ctx.state !== 'running') {
    eng.ctx.resume().catch(() => {
      /* 사용자 입력 밖에서 부르면 거절될 수 있다 — 다음 입력 때 다시 */
    });
  }
}

const visibilityListeners: Array<(hidden: boolean) => void> = [];
export function onVisibilityChange(fn: (hidden: boolean) => void): void {
  visibilityListeners.push(fn);
}

function onVisibility(): void {
  hidden = document.visibilityState === 'hidden';
  if (!hidden) resumeContext(); // iOS 'interrupted' 복구
  applyGains(false);
  for (const fn of visibilityListeners) fn(hidden);
}

/** 설정값을 노드 이득에 반영. 탭이 숨으면 음악은 0으로 내린다 */
export function applyGains(immediate: boolean): void {
  if (!eng) return;
  const t = eng.ctx.currentTime;
  const set = (p: AudioParam, v: number, tc: number): void => {
    p.cancelScheduledValues(t);
    if (immediate) p.setValueAtTime(v, t);
    else p.setTargetAtTime(v, t, tc);
  };
  const m = settings.muted ? 0 : curve(settings.master);
  const s = curve(settings.sfx) * SFX_TRIM;
  const mu = hidden ? 0 : curve(settings.music) * MUSIC_TRIM;
  set(eng.master.gain, m, 0.02);
  set(eng.sfxDry.gain, s, 0.03);
  set(eng.sfxWet.gain, s, 0.03);
  const tcMusic = hidden ? 0.4 : 0.6;
  set(eng.musicDry.gain, mu, tcMusic);
  set(eng.musicWet.gain, mu, tcMusic);
}

// ── 그래프 구성 ─────────────────────────────────────────────

function build(ctx: AudioContext): Engine {
  const gain = (v: number): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };

  // 마스터: 부드러운 컴프레서(글루) → 리미터(클리핑 방지) → 여유분 trim
  const master = gain(0);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.knee.value = 12;
  comp.ratio.value = 2.5;
  comp.attack.value = 0.005;
  comp.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0015;
  limiter.release.value = 0.12;
  const trim = gain(0.85); // 컴프레서 자동 메이크업 이득만큼 여유
  master.connect(comp);
  comp.connect(limiter);
  limiter.connect(trim);
  trim.connect(ctx.destination);

  const sfxDry = gain(0);
  const sfxWet = gain(0);
  const musicDry = gain(0);
  const musicWet = gain(0);
  sfxDry.connect(master);
  musicDry.connect(master);

  // 리버브: 밤의 유리 온실 — 밝게 시작해 어두워지는 2.8초 꼬리
  const wetHP = ctx.createBiquadFilter();
  wetHP.type = 'highpass';
  wetHP.frequency.value = 220;
  wetHP.Q.value = 0.7;
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx, 2.8, 2.4);
  const revOut = gain(0.55);
  sfxWet.connect(wetHP);
  musicWet.connect(wetHP);
  wetHP.connect(conv);
  conv.connect(revOut);
  revOut.connect(master);

  // 음악용 에코(테이프 딜레이 느낌): 피드백 경로에 LPF 를 넣어 반복될수록 흐려진다
  const echoIn = gain(1);
  const echoDelay = ctx.createDelay(2);
  echoDelay.delayTime.value = 0.45;
  const echoLP = ctx.createBiquadFilter();
  echoLP.type = 'lowpass';
  echoLP.frequency.value = 2600;
  echoLP.Q.value = 0.5;
  const echoFb = gain(0.38);
  const echoOut = gain(0.5);
  echoIn.connect(echoDelay);
  echoDelay.connect(echoLP);
  echoLP.connect(echoFb);
  echoFb.connect(echoDelay);
  echoLP.connect(echoOut);
  echoOut.connect(musicDry);
  echoOut.connect(musicWet);

  return {
    ctx,
    master,
    sfxDry,
    sfxWet,
    musicDry,
    musicWet,
    echoIn,
    echoDelay,
    noise: makeNoise(ctx, 2),
    crackle: makeCrackle(ctx, 2),
    waves: makeWaves(ctx),
  };
}

function makeImpulse(ctx: BaseAudioContext, seconds: number, rt60: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * 0.012);
  const taps = [0.011, 0.019, 0.027, 0.036, 0.047, 0.059, 0.073];
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const env = Math.exp((-6.9 * t) / rt60) * Math.min(1, t / 0.008);
      const a = 0.85 - 0.72 * Math.min(1, t / seconds); // 시간이 갈수록 고역이 먼저 사라진다
      y += a * (rand() * 2 - 1 - y);
      d[i] = (y * env) / Math.sqrt(a / (2 - a));
    }
    // 이른 반사: 유리벽에서 튕기는 몇 개의 또렷한 탭(좌우 다르게)
    for (let k = 0; k < taps.length; k++) {
      const idx = Math.floor(((taps[k] ?? 0) + (ch ? 0.0021 * (k + 1) : 0)) * sr);
      if (idx < len) d[idx] = (d[idx] ?? 0) + ((ch + k) % 2 ? -1 : 1) * (0.6 - k * 0.06);
    }
    // 끝부분 페이드 — 버퍼 경계에서 딸깍 소리 없게
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) d[len - 1 - i] = (d[len - 1 - i] ?? 0) * (i / fade);
  }
  return buf;
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
  return buf;
}

/** 드문드문 튀는 짧은 파열음들 — 불꽃 '타닥', 꽃가루 반짝임, 포장 찢는 소리에 재사용 */
function makeCrackle(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const count = Math.floor(seconds * 42);
  for (let k = 0; k < count; k++) {
    const start = Math.floor(rand() * len);
    const L = 24 + Math.floor(rand() * 280);
    const amp = 0.2 + 0.8 * rand() * rand();
    for (let j = 0; j < L && start + j < len; j++) {
      d[start + j] = (d[start + j] ?? 0) + amp * (rand() * 2 - 1) * Math.exp(-j / (L * 0.28));
    }
  }
  for (let i = 0; i < len; i++) d[i] = Math.max(-1, Math.min(1, d[i] ?? 0));
  return buf;
}

function makeWaves(ctx: BaseAudioContext): Record<WaveName, PeriodicWave> {
  const make = (amps: number[]): PeriodicWave => {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => {
      imag[i + 1] = a;
    });
    return ctx.createPeriodicWave(real, imag);
  };
  const warm: number[] = [];
  const hollow: number[] = [];
  for (let n = 1; n <= 14; n++) {
    warm.push(1 / Math.pow(n, 1.7)); // 부드러운 톱니 — 따뜻한 패드
    hollow.push(n % 2 ? 1 / Math.pow(n, 1.25) : 0.04 / n); // 홀수 배음 위주 — 목관 같은 가을 패드
  }
  const glass = [1, 0.42, 0.05, 0.16, 0, 0.04, 0, 0.05]; // 옥타브 배음 위주 — 차갑고 투명한 겨울 패드
  return { warm: make(warm), hollow: make(hollow), glass: make(glass) };
}

// ── 효과음 보이스 관리 ───────────────────────────────────────

interface Voice {
  out: GainNode;
  send: GainNode | null;
  srcs: AudioScheduledSourceNode[];
  end: number;
  closed: boolean;
}

const MAX_VOICES = 28;
const voices: Voice[] = [];

export function activeVoices(): number {
  return voices.length;
}

/** 새 효과음 보이스. 동시 발음이 넘치면 가장 오래된 것을 짧게 줄여 끈다 */
export function openVoice(e: Engine, wet: number, level: number): { out: Out; close: () => void } {
  while (voices.length >= MAX_VOICES) {
    const old = voices.shift();
    if (old) steal(e, old);
  }
  const ctx = e.ctx;
  const outNode = ctx.createGain();
  outNode.gain.value = level;
  outNode.connect(e.sfxDry);
  let send: GainNode | null = null;
  if (wet > 0) {
    send = ctx.createGain();
    send.gain.value = wet;
    outNode.connect(send);
    send.connect(e.sfxWet);
  }
  const v: Voice = { out: outNode, send, srcs: [], end: ctx.currentTime, closed: false };
  voices.push(v);
  const out: Out = {
    ctx,
    dest: outNode,
    noise: e.noise,
    crackle: e.crackle,
    track(src, stopAt) {
      v.srcs.push(src);
      if (stopAt > v.end) v.end = stopAt;
    },
  };
  const close = (): void => {
    const wait = Math.max(0, v.end - ctx.currentTime) + 0.2;
    setTimeout(() => release(v), wait * 1000);
  };
  return { out, close };
}

function release(v: Voice): void {
  if (v.closed) return;
  v.closed = true;
  const i = voices.indexOf(v);
  if (i >= 0) voices.splice(i, 1);
  try {
    v.out.disconnect();
    v.send?.disconnect();
  } catch {
    /* 이미 끊김 */
  }
  v.srcs.length = 0;
}

function steal(e: Engine, v: Voice): void {
  const t = e.ctx.currentTime;
  const g = v.out.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0, t + 0.03);
  for (const s of v.srcs) {
    try {
      s.stop(t + 0.05);
    } catch {
      /* 이미 멈춤 */
    }
  }
  setTimeout(() => release(v), 150);
}
