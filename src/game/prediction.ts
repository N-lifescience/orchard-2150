import type { ColorPrediction, Plant, PredictionRecord, RunState } from '../contract/game';

export function locusAlleles(p: Plant, locus: string): string[] {
  return Object.values(p.genome.chromosomes).flatMap(copies => copies.flatMap(copy => copy.alleles[locus as keyof typeof copy.alleles] ?? []));
}

/** 공개된 두 부모의 2배체 R 자리만으로 계산한 과육색 확률. */
export interface ColorExpectation {
  ruby: number;
  gold: number;
  a: string;
  b: string;
  offspring: string;
  reasoning: string;
}

export function knownColorExpectation(a: Plant | undefined, b: Plant | undefined): ColorExpectation | null {
  if (!a?.revealed || !b?.revealed || a.genome.species !== b.genome.species) return null;
  if (a.genome.ploidy !== 2 || b.genome.ploidy !== 2 || a.pheno.aneuploid || b.pheno.aneuploid) return null;
  if ([a, b].some((p) => Object.values(p.genome.chromosomes).some((copies) => copies.some((copy) => Object.keys(copy.seqs ?? {}).length)))) return null;
  const aa = locusAlleles(a, 'R').join('');
  const bb = locusAlleles(b, 'R').join('');
  if (!/^[Rr]{2}$/.test(aa) || !/^[Rr]{2}$/.test(bb)) return null;
  const counts: Record<string, number> = { RR: 0, Rr: 0, rr: 0 };
  for (const x of aa) for (const y of bb) counts[[x, y].sort().join('')]++;
  const gold = counts.rr / 4;
  const offspring = Object.entries(counts).filter(([, n]) => n > 0)
    .map(([letters, n]) => `${letters} ${n === 4 ? '100%' : `${n * 25}%`}`).join(' · ');
  const gametes = (letters: string) => letters[0] === letters[1]
    ? `${letters}는 ${letters[0]}만 전달해요`
    : 'Rr는 R과 r을 각각 50% 확률로 전달해요';
  return {
    ruby: 1 - gold, gold, a: aa, b: bb, offspring,
    reasoning: `${gametes(aa)}. ${aa === bb ? '' : `${gametes(bb)}. `}자손에게 기능이 있는 R이 하나라도 있으면 루비, 없으면 골드예요.`,
  };
}

export function colorExpectationText(expectation: Pick<ColorExpectation, 'ruby' | 'gold'>): string {
  return `기대: 루비 ${Math.round(expectation.ruby * 100)}% · 골드 ${Math.round(expectation.gold * 100)}%`;
}


/** 정상 감수분열의 과육색 예측. 비분리가 일어나는 계약은 생략한다. */
export function predictionExpectation(s: Pick<RunState, 'ante' | 'orders' | 'orderIdx' | 'jokers'>, a: Plant | undefined, b: Plant | undefined): ColorExpectation | null {
  const cold = s.orders[s.orderIdx].boss?.id === 'coldsnap' && !s.jokers.some(j => j.id === 'climateHouse');
  return cold || s.ante >= 5 ? null : knownColorExpectation(a, b);
}

export function expectedChoice(e: Pick<ColorExpectation, 'ruby' | 'gold'>): ColorPrediction {
  return e.ruby === e.gold ? 'even' : e.ruby > e.gold ? 'ruby' : 'gold';
}

export function predictionJudgment(p: PredictionRecord): string {
  return p.correct === undefined ? '판정 없음 (이전 관찰 기록)' : p.correct ? '예측이 맞아요' : '예측과 기대 확률이 달라요';
}

export function predictionEvidence(p: PredictionRecord): string {
  const actual = `실제 ${p.ruby + p.gold}개체는 루비 ${p.ruby}개체, 골드 ${p.gold}개체예요.`;
  return p.expected ? `기대 확률은 루비 ${p.expected.ruby * 100}%, 골드 ${p.expected.gold * 100}%이고 ${actual}` : actual;
}
