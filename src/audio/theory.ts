// ─────────────────────────────────────────────────────────────
// 음높이·음계. 효과음(칩 음계 상승, 벨)은 지금 흐르는 배경음의 조성을 따라간다.
// 그래서 칩이 쌓일 때 올라가는 음이 계절 음악과 부딪히지 않는다.
// ─────────────────────────────────────────────────────────────

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
} as const;

export interface MusicalKey {
  /** 으뜸음 MIDI 번호(대략 48–59) */
  root: number;
  /** 7음 음계(으뜸음 기준 반음 수) */
  scale: readonly number[];
  /** 그 음계 안의 5음(펜타토닉) — 칩 상승에 쓴다 */
  pent: readonly number[];
}

let current: MusicalKey = { root: 50, scale: MODES.ionian, pent: [0, 2, 4, 7, 9] };

export function setKey(k: MusicalKey): void {
  current = k;
}

export function getKey(): MusicalKey {
  return current;
}

/** 효과음 기준 으뜸음: D3(50)–C#4(61) 사이로 접는다 */
export function sfxRoot(): number {
  return 50 + ((((current.root - 50) % 12) + 12) % 12);
}

function wrap(i: number, n: number): { oct: number; i: number } {
  const oct = Math.floor(i / n);
  return { oct, i: i - oct * n };
}

/** 펜타토닉 idx 번째 음 (base 는 으뜸음 MIDI) */
export function pentNote(idx: number, base: number): number {
  const p = current.pent;
  const w = wrap(idx, p.length);
  return base + 12 * w.oct + (p[w.i] ?? 0);
}

/** 7음 음계 idx 번째 음 */
export function scaleNote(idx: number, base: number, scale: readonly number[] = current.scale): number {
  const w = wrap(idx, scale.length);
  return base + 12 * w.oct + (scale[w.i] ?? 0);
}

/** 음계의 n번째 도(0=으뜸, 2=3음, 4=5음)까지의 반음 수 */
export function deg(n: number): number {
  return scaleNote(n, 0);
}

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** 소리 변주 전용 난수. 게임의 난수 상태와 분리한 고정 시드를 사용한다. */
let audioSeed = 2150;
export const rand = (): number => {
  audioSeed = (audioSeed + 0x6d2b79f5) >>> 0;
  let value = audioSeed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};
export const jitter = (amount: number): number => 1 + (rand() * 2 - 1) * amount;
