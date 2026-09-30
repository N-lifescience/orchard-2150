// 그림 전용 결정적 난수. 게임 규칙의 Rng 와 섞지 않는다(그림 변주가 게임 결과를 바꾸면 안 됨).
// Math.random 금지 — 같은 seed 면 언제나 같은 그림.

export type Rand = () => number;

/** mulberry32: 32비트 시드 → [0,1) */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 문자열 → 32비트 시드 (FNV-1a) */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const between = (r: Rand, a: number, b: number): number => a + (b - a) * r();
export const jitter = (r: Rand, amp: number): number => (r() - 0.5) * 2 * amp;
