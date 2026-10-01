import { describe, expect, it } from 'vitest';
import { createGame, deliveryComplete, goalMatches } from '../src/game';
import { SAVE_KEY, type StorageLike } from '../src/game/game';
import { codingSeq, editCoding, parseGenotype, phenotype } from '../src/genetics';
import type { DeliveryGoal, SeedCard } from '../src/contract/game';

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const card = (spec: string, species: 'lumi' | 'stella' = 'lumi'): SeedCard => {
  const genome = parseGenotype(species, spec);
  return { uid: spec, genome, pheno: phenotype(genome), brixMod: 0, revealed: false, debuffed: false };
};
const goal: DeliveryGoal = { id: 'gold', label: '골드', detail: '골드 출하', count: 3, trait: { color: 'gold' } };

describe('형질 납품과 수업 재도전', () => {
  it('점수를 넘겨도 다른 과육색만 출하하면 계약이 끝나지 않는다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 3, mode: 'quick', policy: 'heritage', playStyle: 'challenge' });
    g.state.orders[0].goals = [goal];
    g.state.orders[0].target = 1;
    const [a, b] = g.state.garden;
    g.chooseCross(a.id, b.id, 'ruby');
    const trace = g.play(g.state.hand.slice(0, 5).map((c) => c.uid));
    expect(trace.total).toBeGreaterThan(1);
    expect(trace.cleared).toBe(false);
    expect(g.state.delivery.gold ?? 0).toBe(0);
    while (g.state.phase === 'play') g.play(g.state.hand.slice(0, 5).map((c) => c.uid));
    expect(g.state.phase).toBe('gameover');
    expect(g.state.review?.reason).toContain('필수 형질');
  });

  it('같은 색이 고정된 부모 대신 열성 표현형 부모를 선택하면 납품할 수 있다', () => {
    const g = createGame({ storage: null, bases: [1] });
    g.newRun({ seed: 3, mode: 'quick', policy: 'heritage' });
    g.state.orders[0].goals = [goal];
    const gold = g.state.garden[1];
    g.chooseCross(gold.id, gold.id, 'gold');
    expect(g.state.hand.every((c) => c.pheno.color === 'gold')).toBe(true);
    const trace = g.play(g.state.hand.slice(0, 3).map((c) => c.uid));
    expect(trace.cleared).toBe(true);
    expect(deliveryComplete(g.state.orders[0], g.state.delivery)).toBe(true);
    expect(g.state.records[0].parentGenotypes?.[0]).toContain('rr');
  });

  it('재도전은 실패 때 소비한 가위와 부모 유전자형을 복구하고 관찰 이력은 남긴다', () => {
    const storage = new Memory();
    const g = createGame({ storage });
    g.newRun({ seed: 8, mode: 'quick', policy: 'precision' });
    const original = JSON.stringify(g.state.garden[0].genome);
    const edit = g.editTargets(g.state.garden[0].id).find((t) => t.locus === 'R')!;
    expect(g.applyEdit(0, g.state.garden[0].id, edit.group, edit.copyIndex, edit.locus, 'ATGTAA' + edit.seq.slice(6)).ok).toBe(true);
    g.chooseCross(g.state.garden[0].id, g.state.garden[0].id, 'ruby');
    while (g.state.phase === 'play') g.play([g.state.hand[0].uid]);
    expect(g.state.phase).toBe('review');
    const restored = createGame({ storage });
    expect(restored.load()).toBe(true);
    expect(restored.retryOrder()).toBe(true);
    expect(restored.state.phase).toBe('cross');
    expect(restored.state.reagents).toContain('scissors');
    expect(JSON.stringify(restored.state.garden[0].genome)).toBe(original);
    expect(restored.state.records).toHaveLength(1);
    expect(restored.state.records[0].cleared).toBe(false);
    expect(restored.state.stats.retries).toBe(1);
    expect(restored.state.orderAttempt).toBe(2);
    expect(restored.state.orders[0].target).toBe(255);
    expect(restored.retryOrder()).toBe(false);
  });

  it('가뭄이나 비료는 유전 당도 조건을 대신하지 못한다', () => {
    const c = card('R:rr S:ss B:bb');
    c.brixMod = 12;
    expect(goalMatches(c, { ...goal, trait: { minBrix: 16 } })).toBe(false);
    c.debuffed = true;
    expect(goalMatches(c, goal)).toBe(false);
    const male = card('R:rr sex:XY L:l', 'stella');
    expect(goalMatches(male, goal)).toBe(false);
  });

  it('B 기능 제거 계약은 다른 자리의 녹아웃으로 대신할 수 없다', () => {
    const c = card('R:Rr S:ss B:bb');
    const seq = codingSeq(c.genome, 'c1', 0, 'R')!;
    const edited = editCoding(c.genome, 'c1', 0, 'R', 'ATGTAA' + seq.slice(6));
    c.genome = edited.genome;
    c.pheno = phenotype(edited.genome);
    expect(goalMatches(c, { ...goal, trait: { knockout: true, bitter: false } })).toBe(false);
    const bSeq = codingSeq(c.genome, 'c2', 0, 'B')!;
    const unchangedFunction = editCoding(c.genome, 'c2', 0, 'B', 'ATGTAA' + bSeq.slice(6));
    c.genome = unchangedFunction.genome;
    c.pheno = phenotype(c.genome);
    expect(c.genome.chromosomes.c2[0].alleles.B).toBe('b');
    expect(goalMatches(c, { ...goal, trait: { knockout: true, bitter: false } })).toBe(false);
  });

  it('단원 계약은 해당 유전 조작을 요구하고 연구 재료는 확정 제공된다', () => {
    for (const mode of ['unit-sex', 'unit-chromo', 'unit-edit'] as const) {
      const g = createGame({ storage: null });
      g.newRun({ seed: 1, mode, policy: 'heritage' });
      const trait = g.state.orders[0].goals![0].trait;
      if (mode === 'unit-sex') {
        expect(trait).toMatchObject({ species: 'stella', sex: 'F', marked: true });
        expect(g.state.garden.some((p) => p.pheno.sex === 'M' && p.pheno.marked)).toBe(true);
      } else if (mode === 'unit-chromo') {
        expect(trait.seedless).toBe(true);
        expect(g.state.garden.some((p) => p.genome.ploidy === 4)).toBe(true);
        expect(g.state.garden.some((p) => p.genome.ploidy === 2)).toBe(true);
      } else {
        expect(trait.knockout).toBe(true);
        expect(g.state.reagents).toContain('scissors');
      }
    }
  });

  it('묶음 선택지는 구입 전에 확정되며 구입 결과와 동일하다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 9, mode: 'quick', policy: 'heritage' });
    g.chooseCross(g.state.garden[0].id, g.state.garden[1].id);
    g.state.phase = 'cashout';
    g.collect();
    g.select(null);
    g.state.money = 20;
    const offer = g.state.shop!.items.find((i) => i.kind === 'pack')!;
    expect(offer.kind).toBe('pack');
    if (offer.kind !== 'pack') throw new Error('목록 없음');
    const displayed = JSON.stringify(offer.choices);
    expect(offer.choices?.length).toBeGreaterThan(0);
    expect(g.buy(offer.slot).ok).toBe(true);
    expect(JSON.stringify(g.state.pack?.choices)).toBe(displayed);
  });

  it('꽃가루 유전자 이동은 새 자손에 나타나고 이웃 성체는 바뀌지 않는다', () => {
    let observed = false;
    for (let seed = 1; seed <= 30 && !observed; seed++) {
      const g = createGame({ storage: null });
      g.newRun({ seed, mode: 'full', policy: 'biotech' });
      g.state.reagents = ['vector'];
      expect(g.useReagent(0, [g.state.garden[0].id]).ok).toBe(true);
      const original = JSON.stringify(g.state.garden.map((p) => p.genome));
      g.chooseCross(g.state.garden[1].id, g.state.garden[1].id);
      g.state.phase = 'cashout';
      g.collect();
      expect(JSON.stringify(g.state.garden.map((p) => p.genome))).toBe(original);
      if (g.state.geneFlow) {
        observed = true;
        expect(g.state.geneFlow.offspring.fluorescent).toBe(true);
      }
    }
    expect(observed).toBe(true);
  });

  it('옛 저장은 도전 모드로 호환하고 종료 기록도 다시 불러올 수 있다', () => {
    const storage = new Memory();
    const g = createGame({ storage });
    g.newRun({ seed: 1, mode: 'quick', policy: 'heritage' });
    const legacy = JSON.parse(storage.getItem(SAVE_KEY)!);
    delete legacy.playStyle;
    delete legacy.records;
    delete legacy.delivery;
    storage.setItem(SAVE_KEY, JSON.stringify(legacy));
    const restored = createGame({ storage });
    expect(restored.load()).toBe(true);
    expect(restored.state.playStyle).toBe('challenge');
    expect(restored.state.records).toEqual([]);
    restored.state.phase = 'victory';
    restored.save();
    expect(createGame({ storage }).load()).toBe(true);
  });
});
