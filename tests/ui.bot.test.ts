import { describe, expect, it } from 'vitest';
import type { DeliveryGoal, PolicyId, RunMode, SeedCard } from '../src/contract/game';
import { makePod, makeRng, parseGenotype, phenotype } from '../src/genetics';
import { createGame, goalMatches } from '../src/game';
import { runOne } from '../scripts/sim';
import { applyDirect, bestCross, bestPlay, decide } from '../src/ui/bot';

const goal = (trait: DeliveryGoal['trait'], count = 2): DeliveryGoal => ({ id: 'test-quota', label: '필수 출하', detail: '테스트 계약', trait, count });
const card = (uid: string, genotype: string): SeedCard => {
  const genome = parseGenotype('lumi', genotype);
  return { uid, genome, pheno: phenotype(genome), brixMod: 0, revealed: true, debuffed: false };
};

const allPlus = 'Q1:++ Q2:++ Q3:++ Q4:++ Q5:++ Q6:++';

describe('자동 진행의 계약 판단', () => {
  it('점수 보너스가 큰 색보다 현재 계약의 필수 색을 얻을 교배를 고른다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode: 'quick', policy: 'heritage' });
    g.state.jokers = [{ uid: 'ruby-bonus', id: 'rubyLover', counter: 0 }];
    g.state.orders[0].goals = [goal({ color: 'ruby' }, 4)];
    const rubyPair = bestCross(g)!;
    g.state.orders[0].goals = [goal({ color: 'gold' }, 4)];
    const goldPair = bestCross(g)!;
    expect(goldPair).not.toEqual(rubyPair);
    const a = g.plantById(goldPair[0])!;
    const b = g.plantById(goldPair[1])!;
    const offspring = makePod(a.genome, b.genome, makeRng(988), 80).map(phenotype);
    expect(offspring.filter((p) => p.color === 'gold').length).toBeGreaterThan(32);
  });

  it('고득점 루비 다섯 포기보다 골드 필수 수량을 포함한 출하를 고른다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode: 'quick', policy: 'heritage' });
    const ruby = g.state.garden.find((p) => p.pheno.color === 'ruby')!;
    g.chooseCross(ruby.id, ruby.id);
    g.state.orders[0].goals = [goal({ color: 'gold' }, 2)];
    g.state.delivery = {};
    g.state.hand = [
      ...Array.from({ length: 5 }, (_, i) => card(`ruby-${i}`, `R:RR S:SS B:bb ${allPlus}`)),
      card('gold-0', 'R:rr S:ss B:bb'),
      card('gold-1', 'R:rr S:ss B:bb'),
    ];
    const choice = bestPlay(g);
    expect(choice.uids).toContain('gold-0');
    expect(choice.uids).toContain('gold-1');
    expect(choice.delivery).toBe(1);
  });

  it('편집 계약에서는 기능 있는 B를 실제 편집하고 그 모종을 출하 대상으로 고른다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 5, mode: 'unit-edit', policy: 'precision' });
    const q = goal({ knockout: true }, 1);
    g.state.orders[0].goals = [q];
    const wild = g.state.garden.find((p) => p.pheno.bitter)!;
    g.chooseCross(wild.id, wild.id);
    g.ackDiscoveries();
    const action = decide(g);
    expect(action.kind).toBe('edit');
    if (action.kind !== 'edit') throw new Error('편집 행동이 필요합니다.');
    const before = g.state.hand.find((c) => c.uid === action.targetId)!;
    expect(before.genome.chromosomes[action.group as keyof typeof before.genome.chromosomes][action.copyIndex].alleles.B).toBe('B');
    applyDirect(g, action);
    const edited = g.state.hand.find((c) => c.uid === action.targetId)!;
    expect(g.state.stats.edits).toBe(1);
    expect(goalMatches(edited, q)).toBe(true);
    expect(bestPlay(g).uids).toContain(edited.uid);
  });

  it('학습 계약 실패 후에는 같은 계약을 다시 시도한다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode: 'quick', policy: 'heritage', playStyle: 'learning' });
    const ruby = g.state.garden.find((p) => p.revealed && p.pheno.color === 'ruby')!;
    g.state.orders[0].goals = [goal({ color: 'gold' }, 1)];
    g.chooseCross(ruby.id, ruby.id);
    g.state.handsLeft = 1;
    g.play([g.state.hand[0].uid]);
    expect(g.state.phase).toBe('review');
    g.ackDiscoveries();
    expect(decide(g).kind).toBe('retry');
    applyDirect(g, decide(g));
    expect(g.state.phase).toBe('cross');
    expect(g.state.orderIdx).toBe(0);
    expect(g.state.stats.retries).toBe(1);
  });

  it('발견 카드가 쌓여 있으면 먼저 확인한다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 2, mode: 'quick', policy: 'biotech' });
    expect(g.state.pendingDiscoveries.length).toBeGreaterThan(0);
    expect(decide(g).kind).toBe('ackDiscoveries');
  });
});

describe('화면 자동 진행과 같은 행동으로 완주 검증', () => {
  it.each([
    [1, 'quick', 'heritage'],
    [7, 'full', 'precision'],
    [21, 'full', 'biotech'],
    [3, 'unit-sex', 'heritage'],
    [5, 'unit-chromo', 'heritage'],
    [9, 'unit-edit', 'precision'],
  ] as [number, RunMode, PolicyId][])('시드 %i · %s · %s — 실제 필수 출하를 충족하며 끝까지 간다', (seed, mode, policy) => {
    const r = runOne(seed, { mode, policy, playStyle: 'learning' });
    if (r.why) console.log(JSON.stringify({ seed, mode, ante: r.ante, last: r.records.slice(-3) }, null, 2));
    expect(r.why, `${mode}: ${r.phase} 시즌${r.ante}`).toBeUndefined();
    expect(r.phase, JSON.stringify({ phase: r.phase, ante: r.ante, retries: r.retries })).toBe('victory');
    expect(r.steps).toBeLessThan(4000);
    expect(r.verifiedDeliveries).toBe(true);
    expect(r.records.filter((rec) => rec.cleared)).toHaveLength(mode === 'full' ? 24 : mode === 'quick' ? 12 : 6);
    if (mode === 'unit-sex') expect(r.crossSpecies).toContain('stella');
    if (mode === 'unit-chromo') expect(r.offspringPloidies).toContain(3);
    if (mode === 'unit-edit') expect(r.edits).toBeGreaterThan(0);
  }, 60000);
});
