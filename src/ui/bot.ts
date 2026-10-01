// 자동 진행은 계약의 필수 형질과 점수를 함께 충족하는 검증 전략이다.
// 부모의 자손 분포는 게임의 실제 꼬투리와 별개의 고정 표본으로 추정한다.
import type { DeliveryGoal, Plant, SeedCard } from '../contract/game';
import { codingSeq, editCoding, formatGenotype, makePod, makeRng, phenotype } from '../genetics';
import { goalMatches, type GameImpl } from '../game';

export type BotAction =
  | { kind: 'cross'; a: string; b: string }
  | { kind: 'play'; uids: string[] }
  | { kind: 'discard'; uids: string[] }
  | { kind: 'edit'; reagentIndex: number; targetId: string; group: string; copyIndex: number; locus: string; newSeq: string }
  | { kind: 'retry' }
  | { kind: 'collect' }
  | { kind: 'select'; uid: string | null; replace?: string }
  | { kind: 'buy'; slot: string }
  | { kind: 'pick'; index: number; replace?: string }
  | { kind: 'skipPack' }
  | { kind: 'leave' }
  | { kind: 'ackDiscoveries' }
  | { kind: 'none'; why: string };

function subsets(n: number, maxK: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length > 0) out.push(cur.slice());
    if (cur.length === maxK) return;
    for (let i = start; i < n; i++) {
      cur.push(i);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}
const cache = new Map<string, number[][]>();
const subsetsCached = (n: number, k: number) => {
  const key = `${n}:${k}`;
  let v = cache.get(key);
  if (!v) cache.set(key, (v = subsets(n, k)));
  return v;
};

const currentGoals = (g: GameImpl) => g.state.orders[g.state.orderIdx].goals ?? [];
const missingGoals = (g: GameImpl) => currentGoals(g).filter((q) => (g.state.delivery[q.id] ?? 0) < q.count);
const remaining = (g: GameImpl, q: DeliveryGoal) => Math.max(0, q.count - (g.state.delivery[q.id] ?? 0));

function deliveryValue(g: GameImpl, cards: SeedCard[]): number {
  return missingGoals(g).reduce((value, q) => {
    const matches = cards.filter((c) => goalMatches(c, q)).length;
    return value + Math.min(remaining(g, q), matches) / q.count;
  }, 0);
}

/** 필수 출하를 먼저 충족하고, 같은 진행이면 높은 점수를 고른다. */
export function bestPlay(g: GameImpl): { uids: string[]; total: number; delivery: number } {
  const hand = g.state.hand;
  let best = { uids: hand.length ? [hand[0].uid] : [], total: -1, delivery: -1 };
  for (const idx of subsetsCached(hand.length, Math.min(g.state.maxSelect, hand.length))) {
    const cards = idx.map((i) => hand[i]);
    const uids = cards.map((c) => c.uid);
    const t = g.simulate(uids);
    if (!t) continue;
    const delivery = deliveryValue(g, cards);
    if (delivery > best.delivery || (delivery === best.delivery && t.total > best.total)) {
      best = { uids, total: t.total, delivery };
    }
  }
  return best;
}

function discardChoice(g: GameImpl, keep: string[]): string[] {
  const goals = missingGoals(g);
  if (goals.length > 0) {
    // 지금 필요한 모종을 남긴다. 목표와 관계없는 카드부터 다음 관찰로 바꾼다.
    return g.state.hand
      .filter((c) => !goals.some((q) => goalMatches(c, q)))
      .sort((a, b) => (a.pheno.brix ?? 0) + a.brixMod - ((b.pheno.brix ?? 0) + b.brixMod))
      .slice(0, g.state.maxSelect)
      .map((c) => c.uid);
  }
  const key = (c: SeedCard) => `${c.pheno.color}-${c.pheno.marked}`;
  const counts = new Map<string, number>();
  for (const c of g.state.hand) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
  const major = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let out = g.state.hand.filter((c) => key(c) !== major).map((c) => c.uid);
  if (out.length === 0) {
    out = g.state.hand
      .filter((c) => !keep.includes(c.uid))
      .sort((a, b) => (a.pheno.brix ?? 0) + a.brixMod - ((b.pheno.brix ?? 0) + b.brixMod))
      .slice(0, 3)
      .map((c) => c.uid);
  }
  return out.slice(0, g.state.maxSelect);
}

function functionalB(c: Pick<SeedCard, 'genome'>): boolean {
  return Object.values(c.genome.chromosomes).some((copies) => copies.some((copy) => copy.alleles.B === 'B'));
}

function afterBKnockout(card: SeedCard): SeedCard | null {
  for (const [group, copies] of Object.entries(card.genome.chromosomes)) {
    for (const [copyIndex, copy] of copies.entries()) {
      if (copy.alleles.B !== 'B') continue;
      const key = group as keyof typeof card.genome.chromosomes;
      const seq = codingSeq(card.genome, key, copyIndex, 'B');
      if (!seq) continue;
      const result = editCoding(card.genome, key, copyIndex, 'B', `ATGTAA${seq.slice(6)}`);
      return { ...card, genome: result.genome, pheno: phenotype(result.genome), edited: true };
    }
  }
  return null;
}

function sampleCards(g: GameImpl, a: Plant, b: Plant): SeedCard[] {
  const st = g.state;
  const boss = st.jokers.some((j) => j.id === 'climateHouse') ? null : st.orders[st.orderIdx].boss;
  const nd = boss?.id === 'coldsnap' ? 0.08 : st.ante >= 5 ? 0.01 : 0;
  const genomes = makePod(a.genome, b.genome, makeRng(2150), 96, nd ? { nondisjunction: nd } : undefined);
  return genomes.map((genome, i) => {
    const pheno = phenotype(genome);
    const brixMod = boss?.id === 'drought' && pheno.brix !== null ? -3 : 0;
    const bossColor = (st as typeof st & { bossColor?: string }).bossColor;
    const debuffed = boss?.id === 'picky' ? pheno.color === bossColor
      : boss?.id === 'sommelier' ? pheno.brix === null || pheno.brix + brixMod <= 13
      : boss?.id === 'lmoCheck' ? pheno.fluorescent
      : boss?.id === 'judge' ? pheno.sex === 'M' : false;
    return { uid: `estimate-${i}`, genome, pheno, brixMod, debuffed, revealed: true };
  });
}

function crossScore(g: GameImpl, aId: string, bId: string): number {
  const a = g.plantById(aId)!;
  const b = g.plantById(bId)!;
  const sample = sampleCards(g, a, b);
  const canEdit = g.state.policy !== 'heritage' && g.state.reagents.includes('scissors');
  let progress = 0;
  let worst = 1;
  for (const q of currentGoals(g)) {
    const matches = sample.filter((c) => {
      if (goalMatches(c, q)) return true;
      if (!q.trait.knockout || !canEdit || !functionalB(c)) return false;
      const edited = afterBKnockout(c);
      return !!edited && goalMatches(edited, q);
    }).length / sample.length;
    // 한 주문에서 볼 수 있는 자손 수로 쿼터 달성 가능성을 계산한다.
    const expectedSeen = Math.min(52, g.state.handSize + (g.state.handsLeft - 1) * g.state.maxSelect + g.state.discardsLeft * g.state.maxSelect);
    // Expected count alone treats a rare recessive cross as certain once its mean
    // reaches the quota. Compare the chance of actually seeing enough seedlings.
    let below = 0;
    for (let k = 0; k < q.count; k++) {
      let choose = 1;
      for (let j = 1; j <= k; j++) choose *= (expectedSeen - j + 1) / j;
      below += choose * matches ** k * (1 - matches) ** (expectedSeen - k);
    }
    const chance = Math.max(0, Math.min(1, 1 - below));
    worst = Math.min(worst, chance);
    progress += chance;
  }
  const counts = new Map<string, number>();
  const brixes = new Map<number, number>();
  let mean = 0;
  let fruitful = 0;
  for (const c of sample) {
    if (c.debuffed || c.pheno.brix === null) continue;
    fruitful++;
    const key = `${c.pheno.color}-${c.pheno.marked}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const brix = c.pheno.brix + c.brixMod;
    brixes.set(brix, (brixes.get(brix) ?? 0) + 1);
    mean += brix;
  }
  const maxSuit = Math.max(0, ...counts.values()) / sample.length;
  const peak = Math.max(0, ...brixes.values()) / sample.length;
  const quality = 100 * maxSuit + 40 * peak + 3 * mean / sample.length - 30 * (1 - fruitful / sample.length);
  return 100000 * worst + 10000 * progress + quality;
}

export function bestCross(g: GameImpl): [string, string] | null {
  const garden = g.state.garden;
  let best: [string, string] | null = null;
  let bestV = -Infinity;
  for (let i = 0; i < garden.length; i++) {
    for (let j = i; j < garden.length; j++) {
      const a = garden[i].id;
      const b = garden[j].id;
      if (!g.canCross(a, b).ok) continue;
      let value = -Infinity;
      try { value = crossScore(g, a, b); } catch { /* 불임 조합은 선택하지 않는다. */ }
      if (value > bestV) { bestV = value; best = [a, b]; }
    }
  }
  return best;
}

function selectionCategory(p: Pick<Plant, 'pheno' | 'genome'>): string {
  const q = p.pheno;
  const knockout = Object.values(p.genome.chromosomes).some((cs) => cs.some((c) => Object.values(c.alleles).some((a) => a?.includes('*ko'))));
  // 겉모습이 같은 RR과 Rr을 함께 내보내면 다음 계약에 필요한 분리가 불가능해진다.
  const loci = ['R', 'S', 'L', 'B'] as const;
  const genotype = loci.map((locus) => Object.values(p.genome.chromosomes).flatMap((copies) => copies.map((copy) => copy.alleles[locus] ?? '')).join(',')).join('/');
  return `${q.species}:${q.sex}:${q.color}:${q.marked}:${q.ploidy}:${knockout}:${genotype}`;
}

function selectionValue(g: GameImpl, card: SeedCard): number {
  const future = g.state.orders.slice(g.state.orderIdx + 1).flatMap((o) => o.goals ?? []);
  const match = future.reduce((v, q) => v + (goalMatches({ ...card, debuffed: false, brixMod: 0 }, q) ? 25 : 0), 0);
  const category = selectionCategory(card);
  const newCategory = !g.state.garden.some((p) => selectionCategory(p) === category);
  const newGenome = !g.state.garden.some((p) => formatGenotype(p.genome) === formatGenotype(card.genome));
  return match + (newCategory ? 35 : 0) + (newGenome ? 3 : 0) + (card.pheno.brix ?? 0);
}

function chooseSelection(g: GameImpl): BotAction {
  const st = g.state;
  if ((st as typeof st & { selectPicked?: unknown }).selectPicked) return { kind: 'select', uid: null };
  const opts = g.selectOptions();
  const candidates = opts.candidates.slice().sort((a, b) => selectionValue(g, b) - selectionValue(g, a));
  const pick = candidates[0];
  if (!pick) return { kind: 'select', uid: null };
  if (!opts.mustReplace) return { kind: 'select', uid: pick.uid };
  // 마지막 골드·암그루·수그루·4배체 재료는 당도만으로 내보내지 않는다.
  const counts = new Map<string, number>();
  for (const p of st.garden) counts.set(selectionCategory(p), (counts.get(selectionCategory(p)) ?? 0) + 1);
  const replaceable = st.garden.filter((p) => (counts.get(selectionCategory(p)) ?? 0) > 1);
  const worst = replaceable.sort((a, b) => (a.pheno.brix ?? 0) - (b.pheno.brix ?? 0))[0];
  if (!worst) return { kind: 'select', uid: null };
  const novel = !st.garden.some((p) => selectionCategory(p) === selectionCategory(pick));
  if (!novel && (pick.pheno.brix ?? 0) <= (worst.pheno.brix ?? 0)) return { kind: 'select', uid: null };
  return { kind: 'select', uid: pick.uid, replace: worst.id };
}

function editForGoal(g: GameImpl): BotAction | null {
  if (!missingGoals(g).some((q) => q.trait.knockout)) return null;
  const reagentIndex = g.state.reagents.indexOf('scissors');
  if (reagentIndex < 0 || g.state.policy === 'heritage') return null;
  const goals = missingGoals(g).filter((q) => q.trait.knockout);
  const card = g.state.hand.find((c) => {
    const edited = afterBKnockout(c);
    return !!edited && goals.some((q) => goalMatches(edited, q));
  });
  if (!card) return null;
  const target = g.editTargets(card.uid).find((t) => t.locus === 'B' && card.genome.chromosomes[t.group as keyof typeof card.genome.chromosomes]?.[t.copyIndex]?.alleles.B === 'B');
  if (!target) return null;
  return { kind: 'edit', reagentIndex, targetId: card.uid, group: target.group, copyIndex: target.copyIndex, locus: target.locus, newSeq: `ATGTAA${target.seq.slice(6)}` };
}

/** 지금 상태에서 봇이 할 일 하나 */
export function decide(g: GameImpl): BotAction {
  const st = g.state;
  if (st.pendingDiscoveries.length > 0) return { kind: 'ackDiscoveries' };
  switch (st.phase) {
    case 'cross': {
      const pair = bestCross(g);
      return pair ? { kind: 'cross', a: pair[0], b: pair[1] } : { kind: 'none', why: '교배할 쌍이 없어요' };
    }
    case 'play': {
      if (st.hand.length === 0) return { kind: 'none', why: '손패가 비었어요' };
      const edit = editForGoal(g);
      if (edit) return edit;
      const best = bestPlay(g);
      const goals = missingGoals(g);
      const lacksQuota = goals.some((q) => best.uids.filter((uid) => goalMatches(st.hand.find((c) => c.uid === uid)!, q)).length * st.handsLeft < remaining(g, q));
      const need = st.orders[st.orderIdx].target - st.roundScore;
      if (st.discardsLeft > 0 && (lacksQuota || (best.total < need && best.total * st.handsLeft < need))) {
        const discard = discardChoice(g, best.uids);
        if (discard.length > 0) return { kind: 'discard', uids: discard };
      }
      return { kind: 'play', uids: best.uids };
    }
    case 'review': return { kind: 'retry' };
    case 'cashout': return { kind: 'collect' };
    case 'select': return chooseSelection(g);
    case 'shop': {
      if (st.pack) {
        const i = st.pack.choices.findIndex((c) => c.kind === 'medal' || (c.kind === 'joker' && st.jokers.length < st.jokerCap));
        return i >= 0 ? { kind: 'pick', index: i } : { kind: 'skipPack' };
      }
      const shop = st.shop;
      if (!shop) return { kind: 'leave' };
      const jokers = shop.items.filter((i) => !i.sold && i.kind === 'joker' && i.price <= st.money).sort((a, b) => b.price - a.price);
      if (jokers.length > 0 && st.jokers.length < st.jokerCap) return { kind: 'buy', slot: jokers[0].slot };
      const up = shop.items.find((i) => i.kind === 'upgrade' && !i.sold);
      if (up && up.kind === 'upgrade' && ['hands', 'discards', 'handSize', 'jokerSlot'].includes(up.id) && st.money >= up.price) return { kind: 'buy', slot: up.slot };
      const medal = shop.items.find((i) => i.kind === 'pack' && !i.sold && i.pack === 'medal' && i.price <= st.money - 4);
      if (medal) return { kind: 'buy', slot: medal.slot };
      return { kind: 'leave' };
    }
    default: return { kind: 'none', why: `끝났어요 (${st.phase})` };
  }
}

/** 화면 없이 같은 공개된 행동을 적용한다. */
export function applyDirect(g: GameImpl, a: BotAction): void {
  switch (a.kind) {
    case 'cross': g.chooseCross(a.a, a.b); break;
    case 'play': g.play(a.uids); break;
    case 'discard': g.discard(a.uids); break;
    case 'edit': g.applyEdit(a.reagentIndex, a.targetId, a.group, a.copyIndex, a.locus, a.newSeq); break;
    case 'retry': g.retryOrder(); break;
    case 'collect': g.collect(); break;
    case 'select': g.select(a.uid, a.replace); break;
    case 'buy': g.buy(a.slot); break;
    case 'pick': g.pickFromPack(a.index, a.replace); break;
    case 'skipPack': g.skipPack(); break;
    case 'leave': g.leaveShop(); break;
    case 'ackDiscoveries': g.ackDiscoveries(); break;
    case 'none': break;
  }
}
