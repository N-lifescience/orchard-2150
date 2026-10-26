import { describe, expect, it } from 'vitest';
import type { Plant, RunMode } from '../src/contract/game';
import { createGame, JOKERS, CONCEPTS, meetsCrossRequirement, crossRequirementText } from '../src/game';
import { predictionExpectation, knownColorExpectation, expectedChoice, predictionEvidence } from '../src/game/prediction';
import { parseGenotype, phenotype, doubleGenome, codingSeq, editCoding } from '../src/genetics';
import { quizFor } from '../src/game/quiz';

const plant = (spec: string, species: 'lumi' | 'stella' = 'lumi'): Plant => {
  const genome = parseGenotype(species, spec);
  return { id: spec, name: spec, genome, pheno: phenotype(genome), revealed: true, origin: 'starter', generation: 1 };
};
const setup = (learning = true) => {
  const g = createGame({ storage: null });
  g.newRun({ seed: 3, mode: 'quick', policy: 'heritage', playStyle: learning ? 'learning' : 'challenge' });
  return g;
};

describe('수업의 유전 조건과 선택적인 점수 보상', () => {
  it.each([true, false])('점수 부족 때 수업(%s)만 형질로 완료하며 미리보기와 실제 판정이 같다', learning => {
    const g = setup(learning);
    const s = g.state;
    s.orders[0].target = 1e9;
    s.orders[0].goals = [{ id: 'gold', label: '골드', detail: '', count: 1, trait: { color: 'gold' } }];
    const gold = s.garden[1];
    g.chooseCross(gold.id, gold.id, 'gold');
    s.handsLeft = 1;
    expect(g.simulate([s.hand[0].uid])?.cleared).toBe(learning);
    expect(g.play([s.hand[0].uid]).cleared).toBe(learning);
    expect(s.phase).toBe(learning ? 'cashout' : 'gameover');
    expect(s.roundScore).toBeLessThan(s.orders[0].target);
    expect(g.cashoutLines().some(x => x.label === '점수 목표 달성 보너스')).toBe(false);
  });
  it('수업에서도 유전 조건은 점수로 대신하지 못하며, 점수 목표는 돈으로 보상한다', () => {
    const g = setup();
    const s = g.state;
    s.orders[0].target = 1;
    s.orders[0].goals = [{ id: 'gold', label: '골드', detail: '', count: 1, trait: { color: 'gold' } }];
    g.chooseCross(s.garden[0].id, s.garden[0].id, 'ruby');
    expect(g.play(s.hand.slice(0, 5).map(x => x.uid)).cleared).toBe(false);
    expect(s.roundScore).toBeGreaterThan(1);
    expect(g.cashoutLines().find(x => x.label === '점수 목표 달성 보너스')?.amount).toBe(2);
  });
  it.each(['full', 'quick', 'unit-sex', 'unit-chromo', 'unit-edit'] as RunMode[])('master %s의 목표 점수는 기존 300/450/600을 유지한다', mode => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode, policy: 'heritage', difficulty: 'master' });
    expect(g.state.playStyle).toBe('challenge');
    expect(g.state.orders.map(o => o.target)).toEqual([300, 450, 600]);
  });
});

describe('기대 확률로 판정하는 교배 전 예측', () => {
  it('공개 정상 2배체 수업 교배는 예측 없이 실행하거나 난수를 소비하지 않는다', () => {
    const g = setup(), s = g.state;
    const before = s.rngCounter;
    g.chooseCross(s.garden[0].id, s.garden[1].id);
    expect(s.phase).toBe('cross');
    expect(s.rngCounter).toBe(before);
    g.chooseCross(s.garden[0].id, s.garden[1].id, 'ruby');
    expect(s.phase).toBe('play');
  });
  it('기대 확률이 1:1이면 실제 표본이 치우쳐도 같은 확률 예측은 맞다', () => {
    let unbalanced = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = setup();
      g.state.seed = seed;
      const a = g.state.garden[0], b = g.state.garden[1];
      Object.assign(a, { ...plant('R:Rr S:ss B:bb'), id: a.id });
      g.chooseCross(a.id, b.id, 'even');
      const p = g.state.prediction!;
      expect(p.expected).toEqual({ ruby: 0.5, gold: 0.5 });
      expect(p.correct).toBe(true);
      expect(p.discardBonus).toBe(true);
      expect(predictionEvidence(p)).toContain(`루비 ${p.ruby}개체`);
      if (p.ruby !== p.gold) unbalanced++;
    }
    expect(unbalanced).toBeGreaterThan(10);
  });
  it.each(['ruby', 'gold', 'even'] as const)('%s 예측의 정답 여부만 솎아내기 +1을 결정하며 틀려도 자원을 잃지 않는다', choice => {
    const g = setup(), s = g.state, before = s.discardsLeft;
    g.chooseCross(s.garden[0].id, s.garden[1].id, choice);
    expect(s.prediction?.correct).toBe(choice === 'ruby');
    expect(s.discardsLeft).toBe(before + (choice === 'ruby' ? 1 : 0));
    const after = s.discardsLeft;
    g.chooseCross(s.garden[0].id, s.garden[1].id, 'ruby');
    expect(s.discardsLeft).toBe(after);
  });
  it('예측 보상과 판정을 저장하고 기록하며, 재도전 때 이전 보상을 누적하지 않는다', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    const g = createGame({ storage });
    g.newRun({ seed: 1, mode: 'quick', policy: 'heritage' });
    const [a, b] = g.state.garden;
    g.chooseCross(a.id, b.id, 'ruby');
    const loaded = createGame({ storage });
    expect(loaded.load()).toBe(true);
    expect(loaded.state.prediction?.correct).toBe(true);
    loaded.state.orders[0].goals![0].count = 52;
    loaded.state.handsLeft = 1;
    loaded.play([loaded.state.hand[0].uid]);
    expect(loaded.state.records[0].prediction?.expected).toEqual({ ruby: 1, gold: 0 });
    expect(loaded.retryOrder()).toBe(true);
    const baseline = loaded.state.discardsLeft;
    loaded.chooseCross(a.id, b.id, 'ruby');
    expect(loaded.state.discardsLeft).toBe(baseline + 1);
  });
  it('공방 붓으로 다시 교배해도 같은 계약의 예측 보상은 한 번만 준다', () => {
    const g = setup(), s = g.state;
    const [a, b] = s.garden;
    g.chooseCross(a.id, b.id, 'ruby');
    s.reagents.push('brush');
    expect(g.useReagent(s.reagents.length - 1, []).ok).toBe(true);
    const before = s.discardsLeft;
    g.chooseCross(a.id, b.id, 'ruby');
    expect(s.prediction?.correct).toBe(true);
    expect(s.prediction?.discardBonus).toBe(false);
    expect(s.discardsLeft).toBe(before);
  });
  it('비공개, 배수체, 편집, 비분리 조건은 단순 예측을 생략한다', () => {
    const g = setup(), [a, b] = g.state.garden;
    const secret = { ...a, revealed: false };
    expect(knownColorExpectation(secret, b)).toBeNull();
    expect(knownColorExpectation({ ...a, genome: doubleGenome(a.genome) }, b)).toBeNull();
    const seq = codingSeq(a.genome, 'c1', 0, 'R')!;
    const edited = editCoding(a.genome, 'c1', 0, 'R', `ATGTAA${seq.slice(6)}`).genome;
    expect(knownColorExpectation({ ...a, genome: edited }, b)).toBeNull();
    g.state.ante = 5;
    expect(predictionExpectation(g.state, a, b)).toBeNull();
    const bypass = setup();
    bypass.chooseCross(bypass.state.garden[2].id, bypass.state.garden[1].id);
    expect(bypass.state.phase).toBe('play');
  });
  it('도전 모드의 예측은 선택이며 솎아내기 보상이 없다', () => {
    const g = setup(false), s = g.state, before = s.discardsLeft;
    g.chooseCross(s.garden[0].id, s.garden[1].id, 'ruby');
    expect(s.prediction?.correct).toBe(true);
    expect(s.discardsLeft).toBe(before);
    const other = setup(false);
    other.chooseCross(other.state.garden[0].id, other.state.garden[1].id);
    expect(other.state.phase).toBe('play');
  });
  it('수업의 퍼넷 노트도 교배를 실행한 뒤에만 분포를 공개한다', () => {
    const g = setup(), s = g.state;
    s.jokers.push({ uid: 'note', id: 'punnettNote', counter: 0 });
    const [a, b] = s.garden;
    expect(g.preview(a.id, b.id)).toBeNull();
    g.chooseCross(a.id, b.id, 'ruby');
    expect(g.preview(a.id, b.id)).not.toBeNull();
    expect(g.preview(s.garden[2].id, b.id)).toBeNull();
    expect(expectedChoice(knownColorExpectation(a, b)!)).toBe('ruby');
  });
});

describe('단원 기대 분포와 이형접합 표지', () => {
  it.each(['unit-sex', 'unit-chromo'] as const)('%s: 잘못된 부모는 납품과 고득점만으로 통과하지 못한다', mode => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode, policy: 'heritage' });
    const s = g.state, o = s.orders[0];
    const bad = s.garden.filter(p => p.genome.species === 'lumi' && p.genome.ploidy === 2)[0];
    g.chooseCross(bad.id, bad.id, 'ruby');
    expect(s.crossRequirementMet).toBe(false);
    s.roundScore = 1e9;
    for (const q of o.goals!) s.delivery[q.id] = q.count;
    expect(g.simulate([s.hand[0].uid])?.cleared).toBe(false);
    s.handsLeft = 1;
    expect(g.play([s.hand[0].uid]).cleared).toBe(false);
    expect(s.records[0].crossRequirementMet).toBe(false);
    expect(s.review?.hint).toContain('기대 분포');
  });
  it('LL 어미를 우연히 선발한 은빛 딸만으로 ll 어미의 목표를 대신할 수 없다', () => {
    const q = { crossRequirement: { kind: 'sex-linked', daughtersMarked: 1, sonsMarked: 0 } } as const;
    const mother = plant('R:Rr sex:XX L:ll', 'stella'), father = plant('R:Rr sex:XY L:L', 'stella');
    expect(meetsCrossRequirement(q, mother, father)).toBe(true);
    expect(meetsCrossRequirement(q, plant('R:Rr sex:XX L:Ll', 'stella'), father)).toBe(false);
    expect(meetsCrossRequirement(q, plant('R:Rr sex:XX L:LL', 'stella'), father)).toBe(false);
  });
  it('4배체 RRRr의 정상 2n 배우자는 모두 R을 포함하므로 rr과 교배해도 루비만 기대한다', () => {
    const q = { crossRequirement: { kind: 'uniform', ploidy: 3, color: 'ruby' } } as const;
    expect(meetsCrossRequirement(q, plant('R:RRRr S:ssss B:bbbb'), plant('R:rr S:ss B:bb'))).toBe(true);
    expect(meetsCrossRequirement(q, plant('R:RRrr S:ssss B:bbbb'), plant('R:rr S:ss B:bb'))).toBe(false);
  });
  it('단원 염색체 퀴즈는 수업에서 다루지 않은 당도 선발 대신 4배체 자가수분을 묻는다', () => {
    const questions = quizFor(6, 'heritage', 'unit-chromo');
    expect(questions.map(q => q.id)).toEqual(['s6-aneuploid', 'unit-4n-self']);
    expect(quizFor(6, 'heritage', 'full').some(q => q.id === 's6-base-brix')).toBe(true);
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode: 'unit-chromo', policy: 'heritage' });
    expect(crossRequirementText(g.state.orders[0])).toContain('3배체');
  });
  it('heterosis 저장 id와 +2 효과는 보존하고 과학적 우월성 주장은 없앤다', () => {
    const j = JOKERS.find(j => j.id === 'heterosis')!;
    expect(j.name).toBe('이형접합 표지');
    expect(j.desc).toContain('+2');
    expect(j.concept).toBe('heterozygote');
    expect(CONCEPTS.heterozygote.fiction).toContain('게임 규칙');
    expect(CONCEPTS.heterozygote.real).toContain('판단할 수는 없어요');
  });
});
