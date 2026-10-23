// ─────────────────────────────────────────────────────────────
// 절차적 앰비언트 배경음.
//  - 계절(앤티 1–2 봄 장조 / 3–4 여름 리디안 / 5–6 가을 도리안 / 7–8 겨울 에올리안·4도 화음)
//  - 장면: title(가장 몽환적) · run · shop(더 경쾌: 템포↑, 코드 빨리, 셰이커·베이스 뜯기) · end(성기게)
//  - boss: 박마다 '쿵-쿵' 심장 펄스 + 패드에 ♭9 불협 + 필터 어둡게
//  - 상태가 바뀌면 새 레이어를 만들고 2초 크로스페이드. 같은 분위기면 그대로 흐른다.
// 구조: 8분음표 단위 룩어헤드 스케줄러(120ms 마다 0.5초 앞까지 예약).
// ─────────────────────────────────────────────────────────────
import type { AudioApi } from '../contract/audio';
import { type Engine, type Out, type WaveName, engine, isHidden, onVisibilityChange } from './engine';
import { GLASS, MARIMBA, MUSICBOX, type Partials, mallet, noiseHit, sweep } from './instruments';
import { MODES, clamp, mtof, rand, scaleNote, setKey } from './theory';

export type MusicState = Parameters<AudioApi['music']>[0];
type State = NonNullable<MusicState>;
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type Timbre = 'musicbox' | 'marimba' | 'glass';

interface Mood {
  id: Season | 'title';
  key: string;
  root: number;
  scale: readonly number[];
  pent: readonly number[];
  /** 코드 진행(음계 도수, 0 = 으뜸) */
  prog: readonly number[];
  /** 4도 쌓기 화음(겨울) */
  quartal: boolean;
  bpm: number;
  /** 코드 하나가 몇 박 */
  chordBeats: number;
  /** 8분음표마다 선율을 시작할 확률(박 위는 ×1.3, 엇박은 ×0.5) */
  melodyProb: number;
  phraseMax: number;
  melodyAmp: number;
  timbre: Timbre;
  pad: WaveName;
  /** 패드 두 오실레이터의 벌림(센트) — 넓을수록 코러스가 두껍다 */
  padDetune: number;
  padGain: number;
  cutoff: number;
  lfoRate: number;
  lfoDepth: number;
  bassGain: number;
  reverb: number;
  echo: number;
  echoTime: number;
  /** 바람 소리(필터 노이즈) 크기 */
  air: number;
  shaker: number;
  bassPluck: boolean;
  boss: boolean;
}

type BaseMood = Omit<Mood, 'key' | 'echoTime' | 'shaker' | 'bassPluck' | 'boss'>;

const BASE: Record<Season | 'title', BaseMood> = {
  // 봄: D 장조, I–IV–vi–V, 오르골, 따뜻한 패드
  spring: {
    id: 'spring', root: 50, scale: MODES.ionian, pent: [0, 2, 4, 7, 9], prog: [0, 3, 5, 4], quartal: false,
    bpm: 72, chordBeats: 8, melodyProb: 0.2, phraseMax: 3, melodyAmp: 0.075, timbre: 'musicbox',
    pad: 'warm', padDetune: 7, padGain: 0.05, cutoff: 1900, lfoRate: 0.07, lfoDepth: 500, bassGain: 0.07,
    reverb: 0.45, echo: 0.28, air: 0,
  },
  // 여름: F 리디안, I–II–I–iii (♯4 의 밝은 들뜸), 마림바
  summer: {
    id: 'summer', root: 53, scale: MODES.lydian, pent: [0, 2, 4, 7, 9], prog: [0, 1, 0, 2], quartal: false,
    bpm: 80, chordBeats: 8, melodyProb: 0.24, phraseMax: 4, melodyAmp: 0.08, timbre: 'marimba',
    pad: 'warm', padDetune: 6, padGain: 0.05, cutoff: 2500, lfoRate: 0.09, lfoDepth: 700, bassGain: 0.075,
    reverb: 0.4, echo: 0.22, air: 0,
  },
  // 가을: A 도리안, i–IV–i–♭VII, 목관 같은 속 빈 패드, 마림바
  autumn: {
    id: 'autumn', root: 45, scale: MODES.dorian, pent: [0, 3, 5, 7, 10], prog: [0, 3, 0, 6], quartal: false,
    bpm: 68, chordBeats: 8, melodyProb: 0.2, phraseMax: 3, melodyAmp: 0.08, timbre: 'marimba',
    pad: 'hollow', padDetune: 8, padGain: 0.045, cutoff: 1500, lfoRate: 0.06, lfoDepth: 450, bassGain: 0.075,
    reverb: 0.48, echo: 0.3, air: 0.008,
  },
  // 겨울: E 에올리안, 4도 쌓기 화음(넓고 차갑게), 유리 선율, 바람
  winter: {
    id: 'winter', root: 52, scale: MODES.aeolian, pent: [0, 2, 5, 7, 10], prog: [0, 5, 2, 6], quartal: true,
    bpm: 60, chordBeats: 12, melodyProb: 0.13, phraseMax: 3, melodyAmp: 0.07, timbre: 'glass',
    pad: 'glass', padDetune: 13, padGain: 0.05, cutoff: 3200, lfoRate: 0.05, lfoDepth: 1200, bassGain: 0.06,
    reverb: 0.62, echo: 0.36, air: 0.03,
  },
  // 타이틀: E♭ 리디안 Imaj7 ↔ II 두 코드만 천천히, 긴 에코·리버브 — 가장 몽환적
  title: {
    id: 'title', root: 51, scale: MODES.lydian, pent: [0, 2, 4, 7, 9], prog: [0, 1], quartal: false,
    bpm: 54, chordBeats: 12, melodyProb: 0.11, phraseMax: 4, melodyAmp: 0.07, timbre: 'musicbox',
    pad: 'warm', padDetune: 11, padGain: 0.05, cutoff: 1300, lfoRate: 0.045, lfoDepth: 600, bassGain: 0.06,
    reverb: 0.7, echo: 0.45, air: 0.018,
  },
};

const TIMBRES: Record<Timbre, Partials> = { musicbox: MUSICBOX, marimba: MARIMBA, glass: GLASS };

function seasonOf(ante: number): Season {
  const a = Number.isFinite(ante) ? Math.floor(ante) : 1;
  if (a <= 2) return 'spring';
  if (a <= 4) return 'summer';
  if (a <= 6) return 'autumn';
  return 'winter';
}

export function moodFor(s: State): Mood {
  const base = s.scene === 'title' ? BASE.title : BASE[seasonOf(s.ante)];
  let m: Mood = { ...base, key: '', echoTime: 0.45, shaker: 0, bassPluck: false, boss: false };
  if (s.scene === 'shop') {
    m = {
      ...m,
      bpm: m.bpm * 1.22,
      chordBeats: Math.max(4, m.chordBeats / 2),
      melodyProb: Math.min(0.5, m.melodyProb * 1.7),
      phraseMax: 4,
      timbre: 'marimba',
      shaker: 0.022,
      bassPluck: true,
      cutoff: m.cutoff * 1.2,
      reverb: m.reverb * 0.8,
      echo: m.echo * 0.6,
    };
  } else if (s.scene === 'end') {
    m = { ...m, bpm: m.bpm * 0.85, melodyProb: m.melodyProb * 0.55, reverb: Math.min(0.8, m.reverb * 1.2) };
  }
  // 보스 긴장감은 실제 플레이 장면(run·shop)에만. 타이틀·결과 화면은 차분하게 둔다.
  if (s.boss && (s.scene === 'run' || s.scene === 'shop')) {
    m = { ...m, boss: true, cutoff: m.cutoff * 0.65, melodyProb: m.melodyProb * 0.6 };
  }
  m.echoTime = (60 / m.bpm) * 0.75; // 점8분 에코
  m.key = `${base.id}|${s.scene}|${m.boss ? 1 : 0}`;
  return m;
}

/** 음을 [lo, lo+11] 구간으로 접는다 */
const fold = (n: number, lo: number): number => lo + ((((n - lo) % 12) + 12) % 12);

function chordOf(m: Mood, degree: number): { bass: number; notes: number[] } {
  const sn = (i: number): number => scaleNote(i, m.root, m.scale);
  const r = sn(degree);
  const shift = r - m.root > 6 ? -12 : 0; // 코드 뿌리를 으뜸음 근처에 두어 음역이 떠다니지 않게
  // 열린 배치: 1·5·10·14(7음+옥타브) / 겨울은 4도 쌓기 1·4·7·10(음계 안)
  const idxs = m.quartal ? [0, 3, 6, 9] : [0, 4, 9, 13];
  return { bass: r + shift - 12, notes: idxs.map((k) => sn(degree + k) + shift) };
}

const FADE = 2;
const LOOKAHEAD = 0.5;
const PANS = [-0.35, 0.25, -0.15, 0.4];
const MAX_MELODY = 6;

class Layer {
  readonly m: Mood;
  private readonly e: Engine;
  private readonly out: GainNode;
  private readonly revSend: GainNode;
  private readonly padIn: BiquadFilterNode;
  private readonly melBus: GainNode;
  private readonly echoSend: GainNode;
  private readonly extra: AudioNode[] = [];
  private readonly srcs = new Set<AudioScheduledSourceNode>();
  private readonly oMel: Out;
  private readonly oDry: Out;
  private next: number;
  private step = 0;
  private chordIdx = 0;
  private bassNote = 0;
  private melIdx = 4;
  private phrase = 0;
  private skip = 0;
  private melEnds: number[] = [];
  stopping = false;
  deadAt = Number.POSITIVE_INFINITY;
  readonly bornAt: number;

  constructor(e: Engine, m: Mood, t: number) {
    this.e = e;
    this.m = m;
    const ctx = e.ctx;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + FADE);
    this.out.connect(e.musicDry);
    this.revSend = ctx.createGain();
    this.revSend.gain.value = m.reverb;
    this.out.connect(this.revSend);
    this.revSend.connect(e.musicWet);

    this.padIn = ctx.createBiquadFilter();
    this.padIn.type = 'lowpass';
    this.padIn.frequency.value = m.cutoff;
    this.padIn.Q.value = 0.6;
    this.padIn.connect(this.out);
    // 느린 필터 LFO — 패드가 숨 쉬듯 밝아졌다 어두워진다
    const lfo = ctx.createOscillator();
    lfo.frequency.value = m.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = Math.min(m.lfoDepth, m.cutoff * 0.6);
    lfo.connect(lfoGain);
    lfoGain.connect(this.padIn.frequency);
    lfo.start(t);
    this.track(lfo);
    this.extra.push(lfoGain);

    this.melBus = ctx.createGain();
    this.melBus.connect(this.out);
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = m.echo;
    this.melBus.connect(this.echoSend);
    this.echoSend.connect(e.echoIn);

    if (m.air > 0) this.startAir(t);

    const dt = e.echoDelay.delayTime;
    dt.cancelScheduledValues(t);
    dt.setTargetAtTime(clamp(m.echoTime, 0.2, 1.2), t, 0.6);

    const mk = (dest: AudioNode): Out => ({
      ctx,
      dest,
      noise: e.noise,
      crackle: e.crackle,
      track: (s) => this.track(s),
    });
    this.oMel = mk(this.melBus);
    this.oDry = mk(this.out);
    this.next = t + 0.08;
    this.bornAt = t;
  }

  private track(s: AudioScheduledSourceNode): void {
    this.srcs.add(s);
    s.onended = () => {
      this.srcs.delete(s);
    };
  }

  get sources(): number {
    return this.srcs.size;
  }

  private startAir(t: number): void {
    const ctx = this.e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.e.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = this.m.air;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.031;
    const lg = ctx.createGain();
    lg.gain.value = 600;
    lfo.connect(lg);
    lg.connect(bp.frequency);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.out);
    src.start(t, rand() * 1.5);
    lfo.start(t);
    this.track(src);
    this.track(lfo);
    this.extra.push(bp, g, lg);
  }

  /** 8분음표 단위로 until 까지 예약 */
  schedule(now: number, until: number): void {
    if (this.stopping) return;
    const cs = this.m.chordBeats * 2;
    if (this.next < now - 1) {
      // 오래 밀렸다(탭 숨김·타이머 지연) — 밀린 음은 버리고 새 코드부터
      this.next = now + 0.05;
      this.step = Math.ceil(this.step / cs) * cs;
    } else if (this.next < now) {
      this.next = now + 0.01;
    }
    const sd = 60 / this.m.bpm / 2;
    while (this.next < until) {
      this.doStep(this.next, sd, cs);
      this.next += sd;
      this.step++;
    }
  }

  private doStep(t: number, sd: number, cs: number): void {
    const m = this.m;
    if (this.step % cs === 0) {
      const degree = m.prog[this.chordIdx % m.prog.length] ?? 0;
      this.chordIdx++;
      this.playChord(t, cs * sd, degree);
    }
    const onBeat = this.step % 2 === 0;
    if (m.boss && onBeat) this.heartbeat(t, this.step % 4 === 0 ? 1 : 0.75);
    if (m.shaker > 0) this.shake(t, onBeat ? 0.45 : 1);
    if (m.bassPluck && this.step % 4 === 0) {
      mallet(this.oDry, t, mtof(this.bassNote + 12), 0.07, MARIMBA, { decayScale: 0.6, click: 0.2 });
    }
    this.melody(t, onBeat);
  }

  private playChord(t: number, dur: number, degree: number): void {
    const m = this.m;
    const { bass, notes } = chordOf(m, degree);
    this.bassNote = bass;
    const attack = Math.min(2.8, dur * 0.35);
    const release = 3.2;
    notes.forEach((n, i) => this.padNote(t, mtof(n), dur, attack, release, m.padGain * (i === 0 ? 1 : 0.85), PANS[i] ?? 0));
    if (m.boss) {
      // ♭9 — 으뜸음 반음 위(한 옥타브 위)를 조용히 겹쳐 살짝 불안하게
      const n0 = notes[0] ?? m.root;
      this.padNote(t, mtof(n0 + 13), dur, attack * 1.5, release, m.padGain * 0.55, 0.1);
    }
    this.bass(t, mtof(bass), dur, release);
  }

  private padNote(t: number, f: number, dur: number, attack: number, release: number, amp: number, pan: number): void {
    const ctx = this.e.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + attack);
    g.gain.setValueAtTime(amp, t + dur);
    g.gain.setTargetAtTime(0, t + dur, release / 4);
    let tail: AudioNode = g;
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(this.padIn);
    const stop = t + dur + release * 1.5;
    const wave = this.e.waves[this.m.pad];
    for (const d of [-this.m.padDetune, this.m.padDetune]) {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.setValueAtTime(f, t);
      osc.detune.value = d;
      osc.connect(g);
      osc.start(t);
      osc.stop(stop);
      this.track(osc);
    }
  }

  private bass(t: number, f: number, dur: number, release: number): void {
    const ctx = this.e.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(this.m.bassGain, t + Math.min(1.2, dur * 0.3));
    g.gain.setValueAtTime(this.m.bassGain, t + dur);
    g.gain.setTargetAtTime(0, t + dur, release / 4);
    g.connect(this.out);
    const stop = t + dur + release * 1.5;
    const sine = ctx.createOscillator();
    sine.frequency.setValueAtTime(f, t);
    const tri = ctx.createOscillator();
    tri.type = 'triangle';
    tri.frequency.setValueAtTime(f * 2, t);
    const tg = ctx.createGain();
    tg.gain.value = 0.18; // 노트북 스피커에서도 음정이 들리게 옥타브 위 배음을 조금
    sine.connect(g);
    tri.connect(tg);
    tg.connect(g);
    for (const o of [sine, tri]) {
      o.start(t);
      o.stop(stop);
      this.track(o);
    }
  }

  /** 보스: 쿵(강)-쿵(약) 심장 박동 */
  private heartbeat(t: number, accent: number): void {
    const f = mtof(fold(this.m.root - 12, 36));
    const lub = (tt: number, a: number): void => {
      sweep(this.oDry, tt, { f0: f * 1.6, f1: f, glide: 0.05, dur: 0.4, amp: 0.22 * a });
      sweep(this.oDry, tt, { type: 'triangle', f0: f * 3.2, f1: f * 2, glide: 0.05, dur: 0.18, amp: 0.05 * a, lp: 400 });
    };
    lub(t, accent);
    lub(t + 0.24, accent * 0.6);
  }

  private shake(t: number, accent: number): void {
    noiseHit(this.oDry, t, {
      dur: 0.04,
      attack: 0.004,
      amp: this.m.shaker * accent * (0.7 + 0.3 * rand()),
      type: 'highpass',
      freq: 7500,
      q: 0.7,
      pan: 0.25,
    });
  }

  private melody(t: number, onBeat: boolean): void {
    const m = this.m;
    if (this.phrase > 0) {
      if (this.skip > 0) {
        this.skip--;
        return;
      }
      this.phrase--;
      this.note(t);
      this.skip = rand() < 0.35 ? 1 : 0;
      return;
    }
    const p = onBeat ? m.melodyProb * 1.3 : m.melodyProb * 0.5;
    if (rand() < p) {
      this.phrase = Math.floor(rand() * m.phraseMax);
      this.note(t);
      this.skip = rand() < 0.4 ? 1 : 0;
    }
  }

  /** 펜타토닉 위를 무작위로 걷는 선율 한 음(음계 밖으로는 절대 안 나감) */
  private note(t: number): void {
    const m = this.m;
    this.melEnds = this.melEnds.filter((x) => x > t);
    if (this.melEnds.length >= MAX_MELODY) return;
    const moves = [-2, -1, -1, 1, 1, 2, 3, -3];
    const mv = moves[Math.floor(rand() * moves.length)] ?? 1;
    let idx = this.melIdx + mv;
    if (idx < 0) idx = -idx;
    if (idx > 9) idx = 18 - idx;
    this.melIdx = clamp(idx, 0, 9);
    const base = fold(m.root, 60); // 선율은 C5 언저리부터
    const p = m.pent;
    const oct = Math.floor(this.melIdx / p.length);
    const midi = base + 12 * oct + (p[this.melIdx % p.length] ?? 0);
    const amp = m.melodyAmp * (0.6 + 0.4 * rand());
    mallet(this.oMel, t, mtof(midi), amp, TIMBRES[m.timbre], {
      click: m.timbre === 'marimba' ? 0.3 : 0.12,
      pan: rand() * 0.8 - 0.4,
    });
    this.melEnds.push(t + 1.8);
  }

  fadeOut(t: number, dur: number): void {
    if (this.stopping && t + dur + 0.15 >= this.deadAt) return; // 이미 더 빨리 끝나는 중
    const g = this.out.gain;
    const v = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(v, t);
    g.linearRampToValueAtTime(0, t + dur);
    this.stopping = true;
    this.deadAt = t + dur + 0.15;
    for (const s of this.srcs) {
      try {
        s.stop(t + dur + 0.05);
      } catch {
        /* 이미 멈춤 */
      }
    }
  }

  dispose(): void {
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        /* 이미 멈춤 */
      }
    }
    this.srcs.clear();
    for (const n of [this.out, this.revSend, this.padIn, this.melBus, this.echoSend, ...this.extra]) {
      try {
        n.disconnect();
      } catch {
        /* 이미 끊김 */
      }
    }
  }
}

// ── 컨트롤러 ────────────────────────────────────────────────

let desired: State | null = null;
let currentKey: string | null = null;
let current: Layer | null = null;
const layers: Layer[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let visHooked = false;

/** 원하는 상태를 기억해 둔다. 엔진이 있으면 바로 반영(unlock 전이면 나중에 applyDesiredMusic) */
let pending = false;

export function setMusic(state: MusicState): void {
  desired = state ? { ante: state.ante, boss: !!state.boss, scene: state.scene } : null;
  // 한 프레임 안에서 여러 번 불려도(장면·보스 플래그를 따로 세팅 등) 마지막 상태만 반영
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    const e = engine();
    if (e) apply(e);
  });
}

export function applyDesiredMusic(): void {
  const e = engine();
  if (e) apply(e);
}

function apply(e: Engine): void {
  const m = desired ? moodFor(desired) : null;
  const key = m ? m.key : null;
  if (key === currentKey) return;
  currentKey = key;
  const t = e.ctx.currentTime;
  if (current) {
    // 막 생긴(아직 거의 안 들리는) 레이어는 2초 기다리지 않고 바로 걷어낸다 — 연타 때 노드 폭증 방지
    current.fadeOut(t, t - current.bornAt < 0.5 ? 0.08 : FADE);
    current = null;
  }
  // 천천히 사라지는 중인 레이어는 최대 2개만 — 나머지(오래된 것부터)는 짧게 끊는다.
  // 곧 끝날 레이어(막 생겼다 걷힌 것)는 세지 않아야 이미 자리 잡은 음악이 뚝 끊기지 않는다.
  const dying = layers.filter((L) => L.stopping && L.deadAt > t + 0.3);
  for (let i = 0; i < dying.length - 2; i++) dying[i]?.fadeOut(t, 0.12);
  if (m) {
    setKey({ root: m.root, scale: m.scale, pent: m.pent });
    current = new Layer(e, m, t);
    layers.push(current);
  }
  if (!visHooked) {
    visHooked = true;
    onVisibilityChange((h) => {
      if (!h) tick();
    });
  }
  if (timer === null && layers.length > 0) {
    timer = setInterval(tick, 120);
  }
  tick();
}

function tick(): void {
  const e = engine();
  if (!e) return;
  const now = e.ctx.currentTime;
  if (e.ctx.state === 'running' && !isHidden()) {
    for (const L of layers) L.schedule(now, now + LOOKAHEAD);
  }
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    if (L && L.deadAt < now) {
      L.dispose();
      layers.splice(i, 1);
    }
  }
  if (layers.length === 0 && timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function musicStats(): { layers: number; musicKey: string | null; musicSources: number } {
  return {
    layers: layers.length,
    musicKey: currentKey,
    musicSources: layers.reduce((n, L) => n + L.sources, 0),
  };
}
