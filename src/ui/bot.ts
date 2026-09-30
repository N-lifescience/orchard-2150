// 자동 진행 봇 (?debug=1 의 autoplay). 무엇을 할지 '결정'만 하고, 실행은 화면 쪽 동작 함수가 한다.
// DOM 없음 — tests/ui.bot.test.ts 가 이 결정만으로 한 판을 끝까지 돌려 본다.
import type { SeedCard } from '../contract/game';
import { expectedDistribution } from '../genetics';
import type { GameImpl } from '../game';

export type BotAction =
  | { kind: 'cross'; a: string; b: string }
  | { kind: 'play'; uids: string[] }
  | { kind: 'discard'; uids: string[] }
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

export function bestPlay(g: GameImpl): { uids: string[]; total: number } {
  const hand = g.state.hand;
  let best = { uids: hand.length ? [hand[0].uid] : [], total: -1 };
  for (const idx of subsetsCached(hand.length, Math.min(g.state.maxSelect, hand.length))) {
    const uids = idx.map((i) => hand[i].uid);
    const t = g.simulate(uids);
    if (t && t.total > best.total) best = { uids, total: t.total };
  }
  return best;
}

function discardChoice(g: GameImpl, keep: string[]): string[] {
  const hand = g.state.hand;
  const key = (c: SeedCard) => `${c.pheno.color}-${c.pheno.marked}`;
  const counts = new Map<string, number>();
  for (const c of hand) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
  const major = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  let out = hand.filter((c) => key(c) !== major).map((c) => c.uid);
  if (out.length === 0) {
    out = hand
      .filter((c) => !keep.includes(c.uid))
      .sort((a, b) => (a.pheno.brix ?? 0) + a.brixMod - ((b.pheno.brix ?? 0) + b.brixMod))
      .slice(0, 3)
      .map((c) => c.uid);
  }
  return out.slice(0, g.state.maxSelect);
}

function crossScore(g: GameImpl, aId: string, bId: string): number {
  const a = g.plantById(aId)!;
  const b = g.plantById(bId)!;
  const d = expectedDistribution(a.genome, aId === bId ? a.genome : b.genome, 48, 7);
  const maxSuit = Math.max(...Object.values(d.suits));
  const entries = Object.entries(d.brix).map(([k, v]) => [Number(k), v] as const);
  const mean = entries.reduce((s, [k, v]) => s + k * v, 0);
  const peak = entries.reduce((m, [, v]) => Math.max(m, v), 0);
  return 100 * maxSuit + 40 * peak + 3 * mean - 30 * d.male;
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
      let v = -1;
      try {
        v = crossScore(g, a, b);
      } catch {
        v = -1;
      }
      if (v > bestV) {
        bestV = v;
        best = [a, b];
      }
    }
  }
  return best;
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
      const best = bestPlay(g);
      const need = st.orders[st.orderIdx].target - st.roundScore;
      if (best.total < need && st.discardsLeft > 0 && best.total * st.handsLeft < need) {
        const d = discardChoice(g, best.uids);
        if (d.length > 0) return { kind: 'discard', uids: d };
      }
      return { kind: 'play', uids: best.uids };
    }
    case 'cashout':
      return { kind: 'collect' };
    case 'select': {
      const opts = g.selectOptions();
      const cands = opts.candidates.filter((c) => c.pheno.brix !== null).sort((a, b) => (b.pheno.brix ?? 0) - (a.pheno.brix ?? 0));
      if (cands.length === 0) return { kind: 'select', uid: null };
      const pick = cands[0];
      if ((st as { selectPicked?: unknown }).selectPicked) return { kind: 'select', uid: null };
      if (opts.mustReplace) {
        const worst = st.garden.filter((p) => p.pheno.brix !== null).sort((a, b) => (a.pheno.brix ?? 0) - (b.pheno.brix ?? 0))[0];
        if (!worst || (worst.pheno.brix ?? 0) >= (pick.pheno.brix ?? 0)) return { kind: 'select', uid: null };
        return { kind: 'select', uid: pick.uid, replace: worst.id };
      }
      return { kind: 'select', uid: pick.uid };
    }
    case 'shop': {
      if (st.pack) {
        // 메달·비법이면 첫 번째를 고르고, 나머지는 건너뛴다
        const i = st.pack.choices.findIndex((c) => c.kind === 'medal' || (c.kind === 'joker' && st.jokers.length < st.jokerCap));
        if (i >= 0) return { kind: 'pick', index: i };
        return { kind: 'skipPack' };
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
    default:
      return { kind: 'none', why: `끝났어요 (${st.phase})` };
  }
}

/** 화면 없이 게임에 바로 적용 (테스트·폴백) */
export function applyDirect(g: GameImpl, a: BotAction): void {
  switch (a.kind) {
    case 'cross':
      g.chooseCross(a.a, a.b);
      break;
    case 'play':
      g.play(a.uids);
      break;
    case 'discard':
      g.discard(a.uids);
      break;
    case 'collect':
      g.collect();
      break;
    case 'select':
      g.select(a.uid, a.replace);
      break;
    case 'buy':
      g.buy(a.slot);
      break;
    case 'pick':
      g.pickFromPack(a.index, a.replace);
      break;
    case 'skipPack':
      g.skipPack();
      break;
    case 'leave':
      g.leaveShop();
      break;
    case 'ackDiscoveries':
      g.ackDiscoveries();
      break;
    case 'none':
      break;
  }
}
