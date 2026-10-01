// 화면 자동 진행과 같은 판단으로 학습·도전 모드를 검증한다.
// 성공한 계약은 점수와 필수 형질 쿼터를 모두 충족했는지 다시 확인한다.
import type { OrderRecord, PlayStyle, PolicyId, RunMode } from '../src/contract/game';
import { formatGenotype } from '../src/genetics';
import { createGame, deliveryComplete } from '../src/game';
import { applyDirect, decide } from '../src/ui/bot';

export interface SimOptions {
  seeds: number;
  mode?: RunMode;
  policy?: PolicyId;
  playStyle?: PlayStyle;
  bases?: number[];
  firstSeed?: number;
  /** 학습 모드에서 같은 계약을 다시 시도할 상한. 기본 2회. */
  maxRetries?: number;
}

export interface SimRun {
  phase: string;
  ante: number;
  bestHand: number;
  steps: number;
  retries: number;
  edits: number;
  distinctParentPairs: number;
  crossSpecies: string[];
  offspringPloidies: number[];
  records: OrderRecord[];
  verifiedDeliveries: boolean;
  why?: string;
}

export interface SimResult {
  runs: number;
  maxAnte: number;
  startAnte: number;
  endAt: Record<string, number>;
  clearRate: Record<number, number>;
  victories: number;
  avgBestHand: number;
  avgRetries: number;
  avgParentPairs: number;
  verifiedDeliveries: boolean;
  unfinished: number;
  halted: { seed: number; ante: number; order: string; missing: string[]; score: number; target: number }[];
}

export function runOne(
  seed: number,
  o: Omit<SimOptions, 'seeds' | 'firstSeed'> = {},
  observe?: (ante: number, best: number) => void,
): SimRun {
  const g = createGame({ storage: null, bases: o.bases });
  g.newRun({ seed, mode: o.mode ?? 'full', policy: o.policy ?? 'heritage', playStyle: o.playStyle ?? 'learning' });
  const parentPairs = new Set<string>();
  const species = new Set<string>();
  const ploidies = new Set<number>();
  const retryCounts = new Map<string, number>();
  let steps = 0;
  let why: string | undefined;
  for (; steps < 4000; steps++) {
    const st = g.state;
    if (st.phase === 'gameover' || st.phase === 'victory') break;
    const action = decide(g);
    if (action.kind === 'none') { why = action.why; break; }
    if (action.kind === 'retry') {
      const key = `${st.ante}:${st.orderIdx}`;
      const count = retryCounts.get(key) ?? 0;
      if (count >= (o.maxRetries ?? 2)) { why = '같은 계약의 검증 재시도 상한'; break; }
      retryCounts.set(key, count + 1);
    }
    if (action.kind === 'cross') {
      const a = g.plantById(action.a)!;
      const b = g.plantById(action.b)!;
      parentPairs.add([formatGenotype(a.genome), formatGenotype(b.genome)].sort().join(' × '));
      species.add(a.genome.species);
    }
    if (action.kind === 'play') observe?.(st.ante, g.simulate(action.uids)?.total ?? 0);
    applyDirect(g, action);
    if (action.kind === 'cross') for (const c of [...g.state.hand, ...g.state.pod]) ploidies.add(c.pheno.ploidy);
  }
  const records = g.state.records.map((r) => structuredClone(r));
  const cleared = records.filter((r) => r.cleared);
  return {
    phase: g.state.phase,
    ante: g.state.ante,
    bestHand: g.state.stats.bestHand,
    steps,
    retries: g.state.stats.retries,
    edits: g.state.stats.edits,
    distinctParentPairs: parentPairs.size,
    crossSpecies: [...species].sort(),
    offspringPloidies: [...ploidies].sort(),
    records,
    verifiedDeliveries: cleared.every((r) => r.goals.length > 0 && r.score >= r.target && deliveryComplete({ goals: r.goals } as Parameters<typeof deliveryComplete>[0], r.delivery)),
    ...(why ? { why } : {}),
  };
}

export function runSim(o: SimOptions): SimResult {
  const mode = o.mode ?? 'full';
  const probe = createGame({ storage: null });
  probe.newRun({ seed: 1, mode, policy: o.policy ?? 'heritage', playStyle: o.playStyle ?? 'learning' });
  const maxAnte = probe.state.maxAnte;
  const startAnte = probe.state.ante;
  const endAt: Record<string, number> = {};
  const cleared: Record<number, number> = {};
  let victories = 0;
  let best = 0;
  let retries = 0;
  let pairs = 0;
  let unfinished = 0;
  let verifiedDeliveries = true;
  const halted: SimResult['halted'] = [];
  for (let i = 0; i < o.seeds; i++) {
    const r = runOne((o.firstSeed ?? 1) + i, o);
    best += r.bestHand;
    retries += r.retries;
    pairs += r.distinctParentPairs;
    verifiedDeliveries &&= r.verifiedDeliveries;
    const win = r.phase === 'victory';
    if (win) victories++;
    if (r.phase !== 'victory' && r.phase !== 'gameover') unfinished++;
    if (!win) {
      const last = r.records.at(-1);
      if (last) halted.push({ seed: (o.firstSeed ?? 1) + i, ante: last.ante, order: last.name,
        missing: last.goals.filter((q) => (last.delivery[q.id] ?? 0) < q.count).map((q) => q.id), score: last.score, target: last.target });
    }
    const key = win ? 'win' : r.phase === 'review' ? `review:${r.ante}` : String(r.ante);
    endAt[key] = (endAt[key] ?? 0) + 1;
    for (let a = startAnte; a <= maxAnte; a++) if (win || r.ante > a) cleared[a] = (cleared[a] ?? 0) + 1;
  }
  const clearRate: Record<number, number> = {};
  for (let a = startAnte; a <= maxAnte; a++) clearRate[a] = (cleared[a] ?? 0) / o.seeds;
  return { runs: o.seeds, maxAnte, startAnte, endAt, clearRate, victories,
    avgBestHand: Math.round(best / o.seeds), avgRetries: retries / o.seeds, avgParentPairs: pairs / o.seeds,
    verifiedDeliveries, unfinished, halted };
}

/** 검증 보고서에 쓸 수 있는 표. 목표 달성률은 봇의 결과이며 학생 학습 효과는 아니다. */
export function formatSim(r: SimResult, bases?: number[]): string {
  const lines = ['| 시즌 | 목표(지역/도시/특별) | 여기서 멈춘 판 | 이 시즌을 마친 비율 |', '|---|---|---|---|'];
  for (let a = r.startAnte; a <= r.maxAnte; a++) {
    const b = bases ? bases[Math.min(bases.length - 1, a - r.startAnte)] : undefined;
    const t = b === undefined ? '-' : `${b} / ${Math.round(b * 1.5)} / ${Math.round(b * (a === r.maxAnte ? 3 : 2))}`;
    lines.push(`| ${a} | ${t} | ${(r.endAt[String(a)] ?? 0) + (r.endAt[`review:${a}`] ?? 0)} | ${Math.round(r.clearRate[a] * 100)}% |`);
  }
  lines.push(`| 완주 | | ${r.victories} | ${Math.round(r.victories / r.runs * 100)}% |`);
  lines.push(`(${r.runs}판, 평균 재시도 ${r.avgRetries.toFixed(1)}회, 서로 다른 부모 조합 ${r.avgParentPairs.toFixed(1)}개, 성공 계약의 필수 출하 검증 ${r.verifiedDeliveries ? '통과' : '실패'})`);
  return lines.join('\n');
}
