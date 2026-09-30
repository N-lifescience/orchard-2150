// 꼬투리 분포 계산 (DOM 없음 — tests/ui.logic.test.ts)
import type { SeedCard } from '../contract/game';
import type { SuitKey } from '../contract/genetics';
import { effBrix } from './cards';

const SUITS: SuitKey[] = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];

/** 남은 씨앗의 표현형 분포 (빛깔 4 × 당도 8~20, 수그루 따로) */
export function podTable(pod: Pick<SeedCard, 'pheno' | 'brixMod'>[]): { grid: Record<SuitKey, Record<number, number>>; male: Record<SuitKey, number>; min: number; max: number; total: number } {
  const grid = {} as Record<SuitKey, Record<number, number>>;
  const male = {} as Record<SuitKey, number>;
  for (const s of SUITS) {
    grid[s] = {};
    male[s] = 0;
  }
  let min = 8;
  let max = 20;
  for (const c of pod) {
    const suit = `${c.pheno.color}-${c.pheno.marked ? 'm' : 'p'}` as SuitKey;
    const b = effBrix(c);
    if (b === null) male[suit]++;
    else {
      grid[suit][b] = (grid[suit][b] ?? 0) + 1;
      min = Math.min(min, b);
      max = Math.max(max, b);
    }
  }
  return { grid, male, min, max, total: pod.length };
}

