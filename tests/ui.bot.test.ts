import { describe, expect, it } from 'vitest';
import type { PolicyId, RunMode } from '../src/contract/game';
import { createGame } from '../src/game';
import { applyDirect, decide } from '../src/ui/bot';

function runBot(seed: number, mode: RunMode, policy: PolicyId) {
  const g = createGame({ storage: null });
  g.newRun({ seed, mode, policy });
  let steps = 0;
  for (; steps < 4000; steps++) {
    const ph = g.state.phase;
    if (ph === 'gameover' || ph === 'victory') break;
    const a = decide(g);
    expect(a.kind, `${ph}: ${JSON.stringify(a)}`).not.toBe('none');
    applyDirect(g, a);
  }
  return { g, steps };
}

describe('자동 진행 봇 (?debug=1 autoplay 의 결정)', () => {
  it.each([
    [1, 'quick', 'heritage'],
    [7, 'full', 'precision'],
    [21, 'full', 'biotech'],
    [3, 'unit-sex', 'heritage'],
    [5, 'unit-chromo', 'heritage'],
    [9, 'unit-edit', 'precision'],
  ] as [number, RunMode, PolicyId][])('시드 %i · %s · %s — 막히지 않고 끝까지 간다', (seed, mode, policy) => {
    const { g, steps } = runBot(seed, mode, policy);
    expect(['gameover', 'victory']).toContain(g.state.phase);
    expect(steps).toBeLessThan(4000);
    expect(g.state.stats.handsPlayed).toBeGreaterThan(0);
  });

  it('발견 카드가 쌓여 있으면 먼저 확인한다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 2, mode: 'quick', policy: 'biotech' });
    expect(g.state.pendingDiscoveries.length).toBeGreaterThan(0);
    expect(decide(g).kind).toBe('ackDiscoveries');
  });
});
