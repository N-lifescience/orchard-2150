// 연출용 시드 난수 (Math.random 금지). 불꽃·흔들림·꽃가루 흩뿌림에만 쓴다.
export type Rand = () => number;

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

/** 앱 전체가 쓰는 연출 난수 하나 (시드 고정 — 재현 가능) */
export const fx: Rand = mulberry32(2150);

export const between = (r: Rand, a: number, b: number): number => a + (b - a) * r();
