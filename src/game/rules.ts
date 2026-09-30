// 족보 판정과 점수 계산 — 순수 함수 (상태를 바꾸지 않는다)
// ScoreTrace.steps 순서가 곧 UI 연출 순서다 (Balatro 순서):
//   ① 족보 기본 → ② 점수 낼 카드 왼쪽부터 (카드 칩 + 그 카드에 반응하는 비법) → ③ 카드와 무관한 비법 왼쪽부터 → ④ 보스 보정
import type { BossDef, ConceptId, HandTypeId, JokerInst, ScoreStep, ScoreTrace, SeedCard } from '../contract/game';
import type { Phenotype, SpeciesId, SuitKey } from '../contract/genetics';
import { isHeterozygous, suitOf } from '../genetics';
import { FLUSH_FAMILY, HAND_TYPES } from './content';

/** 효과 당도 = 유전 당도 + 환경 효과. 수그루는 null */
export function effBrix(c: Pick<SeedCard, 'pheno' | 'brixMod'>): number | null {
  return c.pheno.brix === null ? null : c.pheno.brix + c.brixMod;
}

export function cardSuit(c: Pick<SeedCard, 'pheno'>): SuitKey {
  return suitOf(c.pheno);
}

/** 카드 자체 칩: 효과 당도(쓴맛이면 절반 내림) + 4배체 +10. 수그루 0 */
export function cardChips(c: SeedCard): number {
  const b = effBrix(c);
  let chips = b === null ? 0 : Math.max(0, b);
  if (c.pheno.bitter) chips = Math.floor(chips / 2);
  if (c.pheno.giant) chips += 10;
  return chips;
}

export interface Classified {
  type: HandTypeId;
  /** 점수 내는 카드 (입력 순서 유지) */
  scoring: SeedCard[];
}

/** 족보 판정. cards 는 손패 순서(왼쪽→오른쪽). debuffed 카드도 족보에는 들어간다(Balatro 와 같음) */
export function classify(cards: SeedCard[]): Classified {
  const n = cards.length;
  if (n === 0) throw new Error('카드가 없어요.');
  const suits = cards.map(cardSuit);
  const flush = n === 5 && suits.every((s) => s === suits[0]);
  const ranks = cards.map(effBrix);
  const byRank = new Map<number, SeedCard[]>();
  cards.forEach((c, i) => {
    const b = ranks[i];
    if (b === null) return;
    const arr = byRank.get(b) ?? [];
    arr.push(c);
    byRank.set(b, arr);
  });
  const groups = [...byRank.entries()]
    .map(([b, cs]) => ({ b, cs }))
    .sort((x, y) => y.cs.length - x.cs.length || y.b - x.b);
  const allRanked = ranks.every((b) => b !== null);
  const nums = ranks.filter((b): b is number => b !== null);
  const straight = n === 5 && allRanked && byRank.size === 5 && Math.max(...nums) - Math.min(...nums) === 4;
  const g0 = groups[0]?.cs.length ?? 0;
  const g1 = groups[1]?.cs.length ?? 0;
  const inOrder = (subset: SeedCard[]) => cards.filter((c) => subset.includes(c));

  if (g0 === 5 && flush) return { type: 'flushFive', scoring: cards.slice() };
  if (g0 === 3 && g1 === 2 && flush) return { type: 'flushHouse', scoring: cards.slice() };
  if (g0 === 5) return { type: 'five', scoring: cards.slice() };
  if (straight && flush) return { type: 'straightFlush', scoring: cards.slice() };
  if (g0 === 4) return { type: 'four', scoring: inOrder(groups[0].cs) };
  if (g0 === 3 && g1 === 2) return { type: 'fullHouse', scoring: cards.slice() };
  if (flush) return { type: 'flush', scoring: cards.slice() };
  if (straight) return { type: 'straight', scoring: cards.slice() };
  if (g0 === 3) return { type: 'three', scoring: inOrder(groups[0].cs) };
  if (g0 === 2 && g1 === 2) return { type: 'twoPair', scoring: inOrder([...groups[0].cs, ...groups[1].cs]) };
  if (g0 === 2) return { type: 'pair', scoring: inOrder(groups[0].cs) };
  // 단품: 가장 높은 당도 1장(같으면 왼쪽). 수그루만이면 첫 장
  let best: SeedCard = cards[0];
  let bestB = -Infinity;
  cards.forEach((c, i) => {
    const b = ranks[i];
    if (b !== null && b > bestB) {
      bestB = b;
      best = c;
    }
  });
  return { type: 'high', scoring: [best] };
}

export function handBase(type: HandTypeId, level: number): { chips: number; mult: number } {
  const d = HAND_TYPES[type];
  const lv = Math.max(1, level);
  return { chips: d.chips + (lv - 1) * d.perLevel.chips, mult: d.mult + (lv - 1) * d.perLevel.mult };
}

export interface ScoreCtx {
  handLevels: Record<HandTypeId, number>;
  jokers: JokerInst[];
  /** 규칙이 살아 있는 보스 (기후 적응 온실이 있으면 null) */
  boss: BossDef | null;
  selfing: boolean;
  species: SpeciesId | null;
  /** 이번 교배 두 부모의 표현형 (교배 시점) */
  parents: [Phenotype, Phenotype] | null;
  /** 이번 주문 첫 출하인가 (박람회) */
  firstHandOfOrder: boolean;
}

export interface ScoreResult {
  trace: ScoreTrace;
  /** 카운터가 1 오를 비법 uid (교배 일지) — play 만 반영한다 */
  counterBumps: string[];
  /** 이번 계산으로 발동한 개념 (첫 발동이면 도감에 들어간다) */
  concepts: ConceptId[];
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, ''));

/** 열성 표현형(골드 또는 무늬 없음) */
export function isRecessiveLook(p: Phenotype): boolean {
  return p.color === 'gold' || !p.marked;
}

/** 과육색·무늬 유전자(R·S·L) 중 하나라도 이형접합 */
export function isHeteroCard(c: SeedCard): boolean {
  return (['R', 'S', 'L'] as const).some((l) => isHeterozygous(c.genome, l));
}

/** 과육색이나 무늬가 두 부모 표현형 어디에도 없던 카드 */
export function isSurprise(p: Phenotype, parents: [Phenotype, Phenotype] | null): boolean {
  if (!parents) return false;
  const colorNew = !parents.some((q) => q.color === p.color);
  const markNew = !parents.some((q) => q.marked === p.marked);
  return colorNew || markNew;
}

/** X의 상속자: 별다래 교배에서 아비와 잎 빛깔이 같은 암그루 */
export function isXHeirCard(p: Phenotype, species: SpeciesId | null, parents: [Phenotype, Phenotype] | null): boolean {
  if (species !== 'stella' || !parents) return false;
  const father = parents.find((q) => q.sex === 'M');
  return !!father && p.sex === 'F' && p.marked === father.marked;
}

export function scoreHand(cards: SeedCard[], ctx: ScoreCtx): ScoreResult {
  const { type, scoring } = classify(cards);
  const def = HAND_TYPES[type];
  const level = ctx.handLevels[type] ?? 1;
  const base = handBase(type, level);
  let chips = base.chips;
  let mult = base.mult;
  const steps: ScoreStep[] = [];
  const concepts: ConceptId[] = [];
  const counterBumps: string[] = [];
  const push = (s: Omit<ScoreStep, 'chipsAfter' | 'multAfter'>) => steps.push({ ...s, chipsAfter: chips, multAfter: mult });
  const addChips = (kind: ScoreStep['kind'], uid: string | undefined, v: number, suffix = '') => {
    chips += v;
    push({ kind, sourceUid: uid, label: `+${v}${suffix}`, chips: v });
  };
  const addMult = (kind: ScoreStep['kind'], uid: string | undefined, v: number) => {
    mult += v;
    push({ kind, sourceUid: uid, label: `+${v} 배수`, mult: v });
  };
  const xMult = (kind: ScoreStep['kind'], uid: string | undefined, v: number) => {
    mult *= v;
    push({ kind, sourceUid: uid, label: `×${fmt(v)}`, xmult: v });
  };

  // ① 족보 기본
  push({ kind: 'hand', label: `${def.name} Lv.${level}`, chips: base.chips, mult: base.mult });

  // ② 카드마다
  const notes = ctx.jokers.find((j) => j.id === 'colchicineNotes');
  for (const card of scoring) {
    if (card.debuffed) {
      push({ kind: 'card', sourceUid: card.uid, label: '무효' });
      continue;
    }
    const cc = cardChips(card);
    addChips('card', card.uid, cc);
    if (card.pheno.seedless) {
      if (notes) xMult('joker', notes.uid, 2);
      else xMult('card', card.uid, 1.5);
    }
    const eb = effBrix(card);
    for (const j of ctx.jokers) {
      switch (j.id) {
        case 'rubyLover':
          if (card.pheno.color === 'ruby') addMult('joker', j.uid, 3);
          break;
        case 'goldCollector':
          if (card.pheno.color === 'gold') addMult('joker', j.uid, 3);
          break;
        case 'patternArtisan':
          if (card.pheno.marked) addChips('joker', j.uid, 30);
          break;
        case 'refractometer':
          if (eb !== null && eb > 10) addChips('joker', j.uid, eb - 10);
          break;
        case 'heterosis':
          if (isHeteroCard(card)) {
            addMult('joker', j.uid, 2);
            concepts.push('heterozygote');
          }
          break;
        case 'hideAndSeek':
          if (isSurprise(card.pheno, ctx.parents)) {
            xMult('joker', j.uid, 1.5);
            concepts.push('segregation');
          }
          break;
        case 'xHeir':
          if (isXHeirCard(card.pheno, ctx.species, ctx.parents)) {
            addMult('joker', j.uid, 4);
            concepts.push('xlinked');
          }
          break;
        case 'jellyfishGene':
          if (card.pheno.fluorescent) {
            xMult('joker', j.uid, 1.5);
            concepts.push('lmo');
          }
          break;
        case 'grandpaNotes':
          if (eb !== null && eb >= 16 && cc > 0) addChips('joker', j.uid, cc, ' (한 번 더)');
          break;
      }
    }
  }

  // ③ 카드와 무관한 비법
  const flushy = FLUSH_FAMILY.has(type);
  for (const j of ctx.jokers) {
    switch (j.id) {
      case 'shears':
        addMult('joker', j.uid, 4);
        break;
      case 'purebredCert':
        if (flushy) {
          xMult('joker', j.uid, 3);
          concepts.push('purebred');
        }
        break;
      case 'selfingMaster':
        if (ctx.selfing) {
          xMult('joker', j.uid, 2);
          concepts.push('selfing');
        }
        break;
      case 'breedingLog': {
        const bump = scoring.some((c) => !c.debuffed && isRecessiveLook(c.pheno));
        const value = j.counter + (bump ? 1 : 0);
        if (bump) counterBumps.push(j.uid);
        if (value > 0) addMult('joker', j.uid, value);
        break;
      }
    }
  }

  // ④ 보스 보정
  if (ctx.boss?.id === 'uniformity' && !flushy) {
    mult *= 0.5;
    push({ kind: 'boss', label: '절반', xmult: 0.5 });
  }
  if (ctx.boss?.id === 'expo' && ctx.firstHandOfOrder && !flushy) {
    mult = 0;
    push({ kind: 'boss', label: '0점', xmult: 0 });
  }

  const total = Math.floor(chips * mult + 1e-9);
  return {
    trace: {
      handType: type,
      handName: def.name,
      level,
      scoringUids: scoring.map((c) => c.uid),
      steps,
      total,
      cleared: false,
    },
    counterBumps,
    concepts,
  };
}
