// Reproduce learning-design baselines: node scripts/learning-ab.mjs [--output path]
// Optional: --modes quick,full --strategies smart,naive --seeds 12 --policies heritage
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const arg = (key, fallback) => process.argv.includes(`--${key}`) ? process.argv[process.argv.indexOf(`--${key}`) + 1] : fallback;
const server = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
const G = await server.ssrLoadModule('/src/game/index.ts');
const B = await server.ssrLoadModule('/src/ui/bot.ts');
const { makeRng } = await server.ssrLoadModule('/src/genetics/index.ts');
export function run(seed, mode, strategy, policy = 'heritage', maxRetries = 10) {
  const g = G.createGame({ storage: null });
  g.newRun({ seed, mode, policy, playStyle: 'learning' });
  const rand = makeRng(seed * 7919 + 13);
  const retries = new Map();
  let error;
  for (let step = 0; step < 8000; step++) {
    const st = g.state;
    if (['gameover', 'victory'].includes(st.phase)) break;
    let a;
    if (st.pendingDiscoveries.length) a = { kind: 'ackDiscoveries' };
    else if (st.phase === 'cross' && ['random-cross', 'random-all'].includes(strategy)) {
      const pairs = [];
      for (let i = 0; i < st.garden.length; i++) for (let j = i; j < st.garden.length; j++) {
        const x = st.garden[i].id, y = st.garden[j].id;
        if (g.canCross(x, y).ok) pairs.push([x, y]);
      }
      const pair = pairs[Math.floor(rand() * pairs.length)];
      a = pair ? { kind: 'cross', a: pair[0], b: pair[1] } : { kind: 'none', why: 'No cross' };
    } else if (st.phase === 'play' && strategy === 'naive') {
      const goals = (st.orders[st.orderIdx].goals ?? []).filter(q => (st.delivery[q.id] ?? 0) < q.count);
      const pick = st.hand.filter(c => goals.some(q => G.goalMatches(c, q))).slice(0, st.maxSelect);
      for (const c of st.hand) { if (pick.length >= st.maxSelect) break; if (!pick.includes(c)) pick.push(c); }
      a = { kind: 'play', uids: pick.map(c => c.uid) };
    } else if (st.phase === 'shop' && ['naive', 'no-shop'].includes(strategy)) a = { kind: st.pack ? 'skipPack' : 'leave' };
    else a = B.decide(g);
    if (a.kind === 'select' && strategy === 'random-all') {
      const options = g.selectOptions();
      if (options.candidates.length && rand() < 0.7) {
        const pick = options.candidates[Math.floor(rand() * options.candidates.length)];
        a = { kind: 'select', uid: pick.uid, ...(options.mustReplace ? { replace: st.garden[Math.floor(rand() * st.garden.length)].id } : {}) };
      } else a = { kind: 'select', uid: null };
    }
    if (a.kind === 'none') { error = a.why; break; }
    if (a.kind === 'retry') {
      const key = `${st.ante}:${st.orderIdx}`, n = retries.get(key) ?? 0;
      if (n >= maxRetries) break;
      retries.set(key, n + 1);
    }
    // Prediction enforcement is tested independently. Automated players use the
    // exact published-parent probability when available, never the sampled pod.
    if (a.kind === 'cross' && G.predictionExpectation) {
      const e = G.predictionExpectation(st, g.plantById(a.a), g.plantById(a.b));
      if (e) { g.chooseCross(a.a, a.b, e.ruby === e.gold ? 'even' : e.ruby > e.gold ? 'ruby' : 'gold'); continue; }
    }
    try { B.applyDirect(g, a); } catch (e) { error = String(e); break; }
  }
  const first = new Map();
  for (const r of g.state.records) { const key = `${r.ante}:${r.orderIdx}`; if (!first.has(key)) first.set(key, r.cleared); }
  if (g.state.records.some(r => r.cleared && (r.crossRequirementMet === false || !G.deliveryComplete({ goals: r.goals }, r.delivery)))) error = 'Invalid cleared contract';
  const failed = g.state.records.filter(r => !r.cleared);
  return { seed, won: g.state.phase === 'victory', retries: g.state.stats.retries, firstClear: [...first.values()].filter(Boolean).length, orders: first.size,
    crossFails: failed.filter(r => r.crossRequirementMet === false).length,
    scoreFails: failed.filter(r => r.score < r.target).length,
    traitFails: failed.filter(r => !G.deliveryComplete({ goals: r.goals }, r.delivery)).length, error };
}
const results = [];
try {
  for (const mode of arg('modes', 'quick,full,unit-sex,unit-chromo').split(',')) {
    const n = Number(arg('seeds', mode.startsWith('unit-') ? '20' : '12'));
    for (const policy of arg('policies', 'heritage').split(',')) for (const strategy of arg('strategies', mode.startsWith('unit-') ? 'smart,random-cross' : 'smart,no-shop,naive,random-cross').split(',')) {
      const runs = Array.from({ length: n }, (_, i) => run(i + 1, mode, strategy, policy));
      const sum = key => runs.reduce((v, r) => v + r[key], 0);
      const result = { mode, policy, strategy, n, won: runs.filter(r => r.won).length, retries: sum('retries'), firstClear: sum('firstClear'), orders: sum('orders'), crossFails: sum('crossFails'), scoreFails: sum('scoreFails'), traitFails: sum('traitFails'), errors: runs.filter(r => r.error), runs };
      results.push(result);
      console.log(JSON.stringify({ ...result, runs: undefined }));
    }
  }
  if (process.argv.includes('--assert')) {
    for (const r of results) {
      const failures = [];
      if (r.errors.length) failures.push('runtime error');
      if (r.strategy === 'smart' && r.won !== r.n) failures.push('smart completion');
      if (r.strategy === 'smart' && ['unit-sex', 'unit-chromo'].includes(r.mode) && r.retries / r.n > 0.2) failures.push('unit retries');
      if (r.strategy === 'naive' && r.mode === 'quick' && r.won / r.n < 11 / 12) failures.push('quick naive completion');
      if (r.strategy === 'naive' && r.mode === 'full' && r.won / r.n < 10 / 12) failures.push('full naive completion');
      if (r.strategy === 'random-cross' && ['quick', 'full'].includes(r.mode) && r.won !== 0) failures.push('random main completion');
      if (r.strategy === 'random-cross' && ['unit-sex', 'unit-chromo'].includes(r.mode) && (!r.orders || r.firstClear / r.orders > 0.3)) failures.push('unit guessing resistance');
      if (failures.length) throw new Error(`${r.mode}/${r.policy}/${r.strategy}: ${failures.join(', ')}`);
    }
    console.log('Acceptance checks passed.');
  }
  const output = arg('output', '');
  if (output) writeFileSync(output, JSON.stringify({ revision: arg('revision', 'working-tree'), maxRetries: 10, results }, null, 2) + '\n');
} finally { await server.close(); }
