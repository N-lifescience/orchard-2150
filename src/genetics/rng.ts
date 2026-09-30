// 시드 난수 (mulberry32). 게임의 모든 무작위는 이 함수가 만든 Rng 로만 뽑는다.
import type { Rng } from '../contract/genetics';

/** 같은 seed 면 언제나 같은 수열을 내는 [0,1) 균등 난수 */
export function makeRng(seed: number): Rng {
  let a = Math.floor(seed) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 이상 n 미만 정수 */
export function randInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** 배열에서 서로 다른 k개를 무작위로 (원래 순서 유지) */
export function pickDistinct<T>(rng: Rng, items: readonly T[], k: number): T[] {
  const idx = items.map((_, i) => i);
  // 부분 피셔-예이츠
  for (let i = 0; i < k && i < idx.length; i++) {
    const j = i + randInt(rng, idx.length - i);
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  return idx
    .slice(0, Math.min(k, idx.length))
    .sort((x, y) => x - y)
    .map((i) => items[i]);
}
