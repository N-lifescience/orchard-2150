// 밸런스 시뮬레이션 — 간단한 탐욕 봇으로 여러 시드를 돌려 '도달 앤티 분포'를 본다.
// 실행: npx vitest run tests/game.balance.test.ts   (tsx·vite-node 없이 vitest 로 돌린다)
//
// 봇 규칙 (일부러 단순하게):
//  - 교배: 가능한 쌍(자가수분 포함) 중 기대 분포가 '한 빛깔로 몰리고 당도가 높은' 쌍 (같은 빛깔 순계 우선)
//  - 출하: 손패의 모든 1~5장 조합을 simulate 해서 점수 최대. 이대로는 못 넘길 것 같으면 솎아내기
//  - 공방: 돈 되는 대로 비법 구매(비싼 것부터), 남으면 출하·솎아내기·핸드·비법 칸 증축
//  - 선발: 당도 최고 모종, 온실이 차면 당도 최저 포기를 내보냄
import type { PolicyId, RunMode, SeedCard } from '../src/contract/game';
import { expectedDistribution } from '../src/genetics';
import { createGame, type GameImpl } from '../src/game/game';

export interface SimOptions {
  seeds: number;
  mode?: RunMode;
  policy?: PolicyId;
  bases?: number[];
  firstSeed?: number;
}

export interface SimResult {
  runs: number;
  maxAnte: number;
  startAnte: number;
  /** 죽은(또는 우승한) 앤티별 판 수. 우승은 key 'win' */
  endAt: Record<string, number>;
  /** clearRate[k] = 앤티 k 보스까지 깬 비율 */
  clearRate: Record<number, number>;
  victories: number;
  avgBestHand: number;
}

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
const SUBSETS: Record<string, number[][]> = {};
const subsetsCached = (n: number, k: number) => (SUBSETS[`${n}:${k}`] ??= subsets(n, k));

function bestPlay(g: GameImpl): { uids: string[]; total: number } {
  const hand = g.state.hand;
  let best = { uids: [hand[0].uid], total: -1 };
  for (const idx of subsetsCached(hand.length, Math.min(g.state.maxSelect, hand.length))) {
    const uids = idx.map((i) => hand[i].uid);
    const t = g.simulate(uids);
    if (t && t.total > best.total) best = { uids, total: t.total };
  }
  return best;
}

function chooseDiscard(g: GameImpl, keep: string[]): string[] {
  const hand = g.state.hand;
  const suitOf = (c: SeedCard) => `${c.pheno.color}-${c.pheno.marked}`;
  const counts = new Map<string, number>();
  for (const c of hand) counts.set(suitOf(c), (counts.get(suitOf(c)) ?? 0) + 1);
  const major = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let out = hand.filter((c) => suitOf(c) !== major).map((c) => c.uid);
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

function doCross(g: GameImpl) {
  const garden = g.state.garden;
  let best: [string, string] | null = null;
  let bestV = -Infinity;
  for (let i = 0; i < garden.length; i++) {
    for (let j = i; j < garden.length; j++) {
      const a = garden[i].id;
      const b = garden[j].id;
      if (!g.canCross(a, b).ok) continue;
      const v = crossScore(g, a, b);
      if (v > bestV) {
        bestV = v;
        best = [a, b];
      }
    }
  }
  if (!best) throw new Error('봇: 교배할 쌍이 없어요');
  g.chooseCross(best[0], best[1]);
}

function doPlay(g: GameImpl, observe?: (ante: number, best: number) => void) {
  const st = g.state;
  const best = bestPlay(g);
  observe?.(st.ante, best.total);
  const need = st.orders[st.orderIdx].target - st.roundScore;
  if (best.total < need && st.discardsLeft > 0 && best.total * st.handsLeft < need) {
    const d = chooseDiscard(g, best.uids);
    if (d.length > 0) {
      g.discard(d);
      return;
    }
  }
  g.play(best.uids);
}

function doSelect(g: GameImpl) {
  const opts = g.selectOptions();
  const cands = opts.candidates.filter((c) => c.pheno.brix !== null).sort((a, b) => (b.pheno.brix ?? 0) - (a.pheno.brix ?? 0));
  if (cands.length === 0) return g.select(null);
  const pick = cands[0];
  if (opts.mustReplace) {
    const worst = g.state.garden
      .filter((p) => p.pheno.brix !== null)
      .sort((a, b) => (a.pheno.brix ?? 0) - (b.pheno.brix ?? 0))[0];
    if (!worst || (worst.pheno.brix ?? 0) >= (pick.pheno.brix ?? 0)) return g.select(null);
    g.select(pick.uid, worst.id);
  } else {
    g.select(pick.uid);
  }
  if (g.state.phase === 'select') g.select(null);
}

function doShop(g: GameImpl) {
  const st = g.state;
  if (st.pack) {
    g.skipPack();
    return;
  }
  const items = st.shop!.items.filter((i) => !i.sold && i.kind === 'joker').sort((a, b) => b.price - a.price);
  for (const it of items) {
    if (st.jokers.length >= st.jokerCap) break;
    if (st.money >= it.price) g.buy(it.slot);
  }
  const up = st.shop!.items.find((i) => i.kind === 'upgrade' && !i.sold);
  if (up && up.kind === 'upgrade' && ['hands', 'discards', 'handSize', 'jokerSlot'].includes(up.id) && st.money >= up.price) g.buy(up.slot);
  g.leaveShop();
}

export function runOne(
  seed: number,
  o: Omit<SimOptions, 'seeds' | 'firstSeed'> = {},
  observe?: (ante: number, best: number) => void,
): { phase: string; ante: number; bestHand: number } {
  const g = createGame({ storage: null, bases: o.bases });
  g.newRun({ seed, mode: o.mode ?? 'full', policy: o.policy ?? 'heritage' });
  for (let step = 0; step < 5000; step++) {
    const ph = g.state.phase;
    if (ph === 'gameover' || ph === 'victory') break;
    if (ph === 'cross') doCross(g);
    else if (ph === 'play') doPlay(g, observe);
    else if (ph === 'cashout') g.collect();
    else if (ph === 'select') doSelect(g);
    else if (ph === 'shop') doShop(g);
  }
  return { phase: g.state.phase, ante: g.state.ante, bestHand: g.state.stats.bestHand };
}

export function runSim(o: SimOptions): SimResult {
  const mode = o.mode ?? 'full';
  const probe = createGame({ storage: null });
  probe.newRun({ seed: 1, mode, policy: o.policy ?? 'heritage' });
  const maxAnte = probe.state.maxAnte;
  const startAnte = probe.state.ante;
  const endAt: Record<string, number> = {};
  const cleared: Record<number, number> = {};
  let victories = 0;
  let best = 0;
  for (let i = 0; i < o.seeds; i++) {
    const r = runOne((o.firstSeed ?? 1) + i, o);
    best += r.bestHand;
    const win = r.phase === 'victory';
    if (win) victories++;
    const key = win ? 'win' : String(r.ante);
    endAt[key] = (endAt[key] ?? 0) + 1;
    for (let a = startAnte; a <= maxAnte; a++) if (win || r.ante > a) cleared[a] = (cleared[a] ?? 0) + 1;
  }
  const clearRate: Record<number, number> = {};
  for (let a = startAnte; a <= maxAnte; a++) clearRate[a] = (cleared[a] ?? 0) / o.seeds;
  return { runs: o.seeds, maxAnte, startAnte, endAt, clearRate, victories, avgBestHand: Math.round(best / o.seeds) };
}

/** 사람이 읽는 표 (마크다운) */
export function formatSim(r: SimResult, bases?: number[]): string {
  const lines = ['| 앤티 | 목표(장터/식당/보스) | 여기서 끝난 판 | 이 앤티를 깬 비율 |', '|---|---|---|---|'];
  for (let a = r.startAnte; a <= r.maxAnte; a++) {
    const b = bases ? bases[Math.min(bases.length - 1, a - 1)] : undefined;
    const t = b === undefined ? '-' : `${b} / ${Math.round(b * 1.5)} / ${Math.round(b * (a === r.maxAnte ? 3 : 2))}`;
    lines.push(`| ${a} | ${t} | ${r.endAt[String(a)] ?? 0} | ${Math.round(r.clearRate[a] * 100)}% |`);
  }
  lines.push(`| 우승 | | ${r.victories} | ${Math.round((r.victories / r.runs) * 100)}% |`);
  lines.push(`(판 ${r.runs}개, 평균 최고 출하 ${r.avgBestHand}점)`);
  return lines.join('\n');
}
