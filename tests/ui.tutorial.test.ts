import { describe, expect, it } from 'vitest';
import { createGame, type StorageLike } from '../src/game/game';
import { createRunSlot, isFirstVisit, listRunSlots, markTutorialSeen, removeRunSlot } from '../src/ui/runSlots';
import { initialPractice, loadPractice, practiceKey, recordPractice, savePractice, upgradePractice } from '../src/ui/practiceStorage';
import { wipeAll } from '../src/ui/prefs';
import { inferTutorialStep, tutorialStep, TUTORIAL_ORDER, TUTORIAL_TOTAL, type TutorialInteraction, type TutorialStep } from '../src/ui/tutorialFlow';

class MemoryStore implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function guidedRun(storage: StorageLike | null = null, saveKey?: string) {
  const game = createGame({ storage });
  if (saveKey) game.setSaveKey(saveKey);
  game.newRun({ seed: 3, mode: 'quick', policy: 'heritage', playStyle: 'learning' });
  return game;
}

const interaction = (overrides: Partial<TutorialInteraction> = {}): TutorialInteraction => ({
  parentCount: 2, predicted: true, observed: true, sorted: true, selectedCards: 5,
  ...overrides,
});

describe('실제 조작으로만 넘어가는 첫 계약 튜토리얼', () => {
  it('앞쪽 소개 단계 없이 첫 부모 고르기부터 시작하고, 단계 수는 12개다', () => {
    const game = guidedRun();
    expect(TUTORIAL_TOTAL).toBe(12);
    expect(TUTORIAL_ORDER[0]).toBe('parent-first');
    expect(inferTutorialStep(game.state, interaction({ parentCount: 0, predicted: false, observed: false, sorted: false, selectedCards: 0 }))).toBe('parent-first');
    for (const removed of ['welcome', 'limits', 'navigation', 'notebook', 'jokers', 'reagents', 'order']) {
      expect(TUTORIAL_ORDER as readonly string[]).not.toContain(removed);
    }
    TUTORIAL_ORDER.forEach((step, i) => {
      const info = tutorialStep(step);
      expect(info).toMatchObject({ number: i + 1, total: 12 });
      expect(info.label.length).toBeGreaterThan(0);
    });
    expect(tutorialStep('retry').number).toBe(tutorialStep('ship').number);
  });

  it('레아의 말은 한 줄에 한 문장이고, 없앤 소개 요소는 처음 쓰이는 단계에서 한 줄로 나온다', () => {
    const all = [...TUTORIAL_ORDER, 'retry' as const].flatMap((step) => tutorialStep(step).lines.map((line) => ({ step, ...line })));
    for (const line of all) {
      const sentences = line.text.split(/(?<=[.?!])\s+/).filter(Boolean);
      expect(sentences, line.text).toHaveLength(1);
      expect(line.text.length, line.text).toBeLessThanOrEqual(60);
    }
    const targetsIn = (step: TutorialStep) => tutorialStep(step).lines.map((line) => line.target);
    expect(targetsIn('parent-first')).toContain('goal');
    expect(targetsIn('ship')).toContain('limits');
    expect(targetsIn('select-cards')).toContain('discard');
    expect(targetsIn('shop')).toEqual(expect.arrayContaining(['jokers', 'reagents']));
    expect(targetsIn('complete')).toContain('home');
  });

  it('수업 첫 안내는 납품 완료와 점수 추가 보상을 구별한다', () => {
    const lines = tutorialStep('parent-first', 'learning').lines.map(line => line.text);
    expect(lines[0]).toBe('루비 과육 3개체를 납품하면 계약이 끝나요.');
    expect(lines[1]).toBe('300점 이상이면 보상으로 $2를 더 받아요.');
    expect(lines).not.toContain('루비 과육 3개체와 300점을 채워요.');
  });

  it('도전 첫 안내의 기존 점수와 납품 조건은 그대로다', () => {
    expect(tutorialStep('parent-first', 'challenge').lines.map(line => line.text)).toEqual([
      '루비 과육 3개체와 300점을 채워요.',
      'RR인 할머니의 루비 별을 눌러 주세요.',
    ]);
  });

  it('예측 단계는 교배 결과를 미리 말하지 않는다', () => {
    const text = tutorialStep('predict').lines.map((line) => line.text).join(' ');
    expect(text).not.toMatch(/모두 Rr|모두 루비|전부 루비|52개체 모두/);
    expect(text).not.toContain('우성');
    expect(text).toContain('예측');
  });

  it('실제 선택 상태로 단계를 정하며, 선택을 바꾸면 필요한 단계로 돌아간다', () => {
    const game = guidedRun();
    const step = (changes: Partial<TutorialInteraction>) => inferTutorialStep(game.state, interaction(changes));
    expect(step({ parentCount: 0, predicted: false })).toBe('parent-first');
    expect(step({ parentCount: 1, predicted: false })).toBe('parent-second');
    expect(step({ predicted: false })).toBe('predict');
    expect(step({})).toBe('cross');
    expect(step({ parentCount: 1 })).toBe('parent-second');

    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    expect(step({ observed: false, sorted: false })).toBe('observe');
    expect(step({ observed: undefined })).toBe('observe');
    expect(step({ sorted: false })).toBe('sort');
    expect(step({ selectedCards: 0 })).toBe('select-cards');
    expect(step({ selectedCards: 4 })).toBe('select-cards');
    expect(step({ selectedCards: 5 })).toBe('ship');
  });

  it('자손 덱 열기와 정렬은 실제로 했을 때만 기록되고, 게임 상태와 씨앗은 바뀌지 않는다', () => {
    const storage = new MemoryStore();
    const slot = createRunSlot('도구 안내 검증', 'quick', 'heritage', storage)!;
    const game = guidedRun(storage, slot.key);
    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    const before = JSON.stringify(game.state);
    let progress = initialPractice();
    expect(recordPractice(progress, 'sorted')).toBe(false);
    expect(inferTutorialStep(game.state, interaction(progress))).toBe('observe');
    expect(recordPractice(progress, 'pod')).toBe(true);
    savePractice(slot.key, progress, storage);
    progress = loadPractice(slot.key, storage)!;
    expect(inferTutorialStep(game.state, interaction(progress))).toBe('sort');
    expect(recordPractice(progress, 'sorted')).toBe(true);
    expect(recordPractice(progress, 'sorted')).toBe(false);
    savePractice(slot.key, progress, storage);
    progress = loadPractice(slot.key, storage)!;
    expect(inferTutorialStep(game.state, interaction({ ...progress, selectedCards: 0 }))).toBe('select-cards');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('정상 규칙으로 첫 계약을 마치며, 보상과 선발 모종을 유지한 채 다음 계약으로 이어진다', () => {
    const storage = new MemoryStore();
    const olderSlot = createRunSlot('기존 과수원', 'quick', 'heritage', storage)!;
    const olderGame = createGame({ storage });
    olderGame.setSaveKey(olderSlot.key);
    olderGame.newRun({ seed: 8, mode: 'quick', policy: 'heritage' });
    const olderSave = storage.getItem(olderSlot.key);
    const slot = createRunSlot('첫 플레이 과수원', 'quick', 'heritage', storage)!;
    const game = guidedRun(storage, slot.key);
    const firstOrder = game.state.orders[0];
    expect(firstOrder.target).toBe(300);
    expect(firstOrder.goals).toEqual([expect.objectContaining({ count: 3, trait: { color: 'ruby', bitter: false } })]);
    const startingMoney = game.state.money;
    const startingGarden = game.state.garden.length;
    const [ruby, gold] = game.state.garden;
    game.chooseCross(ruby.id, gold.id, 'ruby');
    expect(game.state.prediction).toMatchObject({ choice: 'ruby', ruby: 52, gold: 0, correct: true });
    game.sortHand('brix');
    const result = game.play(game.state.hand.slice(0, 5).map((card) => card.uid));
    expect(result.cleared).toBe(true);
    expect(inferTutorialStep(game.state, interaction({ observed: false }))).toBe('collect');
    const reward = game.cashoutLines().reduce((sum, line) => sum + line.amount, 0);
    game.collect();
    expect(inferTutorialStep(game.state, interaction())).toBe('keep');
    const candidate = game.selectOptions().candidates[0];
    game.select(candidate.uid);
    expect(inferTutorialStep(game.state, interaction())).toBe('shop');
    expect(game.state.garden).toHaveLength(startingGarden + 1);
    game.leaveShop();
    expect(game.state.orderIdx).toBe(1);
    expect(inferTutorialStep(game.state, interaction())).toBe('complete');
    expect(game.state.money).toBe(startingMoney + reward);

    const continued = createGame({ storage });
    continued.setSaveKey(slot.key);
    expect(continued.load()).toBe(true);
    expect(continued.state).toEqual(game.state);
    expect(inferTutorialStep(continued.state, interaction())).toBe('complete');
    expect(storage.getItem(olderSlot.key)).toBe(olderSave);
  });

  it('실패는 종료로 오인하지 않고 재도전 후 실제 교배 단계로 돌아간다', () => {
    const game = guidedRun();
    const gold = game.state.garden[1];
    game.chooseCross(gold.id, gold.id, 'gold');
    while (game.state.phase === 'play') game.play(game.state.hand.slice(0, 5).map((card) => card.uid));
    expect(game.state.phase).toBe('review');
    expect(inferTutorialStep(game.state, interaction())).toBe('retry');
    expect(game.retryOrder()).toBe(true);
    expect(game.state.phase).toBe('cross');
    expect(inferTutorialStep(game.state, interaction({ parentCount: 0, predicted: false }))).toBe('parent-first');
  });
});

describe('처음 온 사람의 첫 계약 = 튜토리얼', () => {
  it('튜토리얼을 마친 적도, 저장된 연대기도 없을 때만 튜토리얼을 자동으로 시작한다', () => {
    const fresh = new MemoryStore();
    expect(isFirstVisit(fresh)).toBe(true);
    const withSlot = new MemoryStore();
    const slot = createRunSlot('기존', 'quick', 'heritage', withSlot)!;
    guidedRun(withSlot, slot.key);
    expect(isFirstVisit(withSlot)).toBe(false);
    const seen = new MemoryStore();
    markTutorialSeen(seen);
    expect(isFirstVisit(seen)).toBe(false);
    expect(isFirstVisit(null)).toBe(true);
  });
});

describe('예전 튜토리얼 저장(practice:v1)을 새 단계 목록으로 옮기기', () => {
  const legacy = (fields: Record<string, unknown>) => ({ active: true, orderRead: true, observed: false, completed: false, ...fields });

  it('예전 단계 번호를 버리지 않고 새 단계로 옮긴다', () => {
    const game = guidedRun();
    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    const stepOf = (raw: Record<string, unknown>) => {
      const p = upgradePractice(raw)!;
      expect(p.v).toBe(2);
      return inferTutorialStep(game.state, interaction({ observed: p.observed, sorted: p.sorted, selectedCards: 0 }));
    };
    // 소개 6단계 중간(introStep 0~6)은 옮길 단계가 없어 그대로 첫 실제 단계에서 이어진다
    for (const introStep of [0, 3, 6]) expect(upgradePractice(legacy({ introStep, playIntroStep: 0 }))).toMatchObject({ active: true, observed: false, sorted: false });
    expect(stepOf(legacy({ observed: false, introStep: 6, playIntroStep: 0 }))).toBe('observe');
    expect(stepOf(legacy({ observed: true, introStep: 6, playIntroStep: 0 }))).toBe('observe'); // 자손 덱 안내 전
    expect(stepOf(legacy({ observed: true, introStep: 6, playIntroStep: 1 }))).toBe('sort'); // 정렬 안내 차례
    expect(stepOf(legacy({ observed: true, introStep: 6, playIntroStep: 2 }))).toBe('select-cards'); // 솎아내기 안내 차례
    expect(stepOf(legacy({ observed: true, introStep: 6, playIntroStep: 3 }))).toBe('select-cards');
    // 도구 안내가 생기기 전의 저장: 관찰을 마쳤으면 도구 안내도 마친 것
    expect(stepOf(legacy({ observed: true }))).toBe('select-cards');
    expect(stepOf(legacy({ observed: false }))).toBe('observe');
  });

  it('범위를 벗어난 번호는 범위 안으로 맞추고, 손상된 저장만 버린다', () => {
    expect(upgradePractice(legacy({ observed: true, playIntroStep: 9 }))).toMatchObject({ observed: true, sorted: true });
    expect(upgradePractice(legacy({ observed: true, playIntroStep: -2 }))).toMatchObject({ observed: false, sorted: false });
    expect(upgradePractice(legacy({ observed: true, playIntroStep: 1.7 }))).toMatchObject({ observed: true, sorted: false });
    expect(upgradePractice(legacy({ introStep: 99 }))).toMatchObject({ active: true });
    for (const damaged of [null, [], 'x', {}, { active: 'true', orderRead: true, observed: true, completed: false }, { active: true, observed: true, completed: false }]) {
      expect(upgradePractice(damaged)).toBeNull();
    }
    expect(upgradePractice({ ...legacy({}), completed: true })).toMatchObject({ active: false, completed: true });
    expect(upgradePractice({ v: 2, active: true, completed: false, observed: true, sorted: true })).toEqual({ v: 2, active: true, completed: false, observed: true, sorted: true });
  });

  it('저장소에서 읽을 때도 같은 변환을 쓰고, 손상·차단된 저장은 안내를 시작하지 않는다', () => {
    const storage = new MemoryStore();
    const key = 'tutorial-save';
    storage.setItem(practiceKey(key), JSON.stringify(legacy({ observed: true, introStep: 6, playIntroStep: 1 })));
    expect(loadPractice(key, storage)).toEqual({ v: 2, active: true, completed: false, observed: true, sorted: false });
    for (const damaged of ['{', 'null', '[]', '{}']) {
      storage.setItem(practiceKey(key), damaged);
      expect(loadPractice(key, storage)).toBeNull();
    }
    expect(loadPractice('missing', storage)).toBeNull();
    expect(loadPractice(key, null)).toBeNull();
    const blocked: StorageLike = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    expect(loadPractice(key, blocked)).toBeNull();
    expect(() => savePractice(key, initialPractice(), blocked)).not.toThrow();
  });
});

describe('연대기별 튜토리얼 저장', () => {
  it('다른 연대기의 안내 상태를 덮어쓰지 않는다', () => {
    const storage = new MemoryStore();
    const first = createRunSlot('교배 연습', 'quick', 'heritage', storage)!;
    const second = createRunSlot('다른 과수원', 'quick', 'heritage', storage)!;
    guidedRun(storage, first.key);
    const secondGame = guidedRun(storage, second.key);
    const firstProgress = { ...initialPractice(), observed: true };
    const secondProgress = { ...initialPractice(), active: false };
    savePractice(first.key, firstProgress, storage);
    savePractice(second.key, secondProgress, storage);
    expect(loadPractice(first.key, storage)).toEqual(firstProgress);
    expect(loadPractice(second.key, storage)).toEqual(secondProgress);
    expect(JSON.parse(storage.getItem(second.key)!)).toEqual(secondGame.state);
  });

  it('한 연대기를 지우면 해당 안내만 지우고, 전체 기록 지우기는 나머지 안내도 지운다', () => {
    const storage = new MemoryStore();
    const first = createRunSlot('지울 과수원', 'quick', 'heritage', storage)!;
    const second = createRunSlot('남길 과수원', 'quick', 'heritage', storage)!;
    guidedRun(storage, first.key);
    guidedRun(storage, second.key);
    savePractice(first.key, initialPractice(), storage);
    const secondProgress = { ...initialPractice(), observed: true };
    savePractice(second.key, secondProgress, storage);
    storage.setItem('unrelated-app', 'keep');

    removeRunSlot(first.id, storage);
    expect(storage.getItem(practiceKey(first.key))).toBeNull();
    expect(loadPractice(second.key, storage)).toEqual(secondProgress);
    expect(listRunSlots(storage).map((slot) => slot.id)).toEqual([second.id]);

    wipeAll(storage);
    expect(storage.getItem(practiceKey(second.key))).toBeNull();
    expect(listRunSlots(storage)).toEqual([]);
    expect(storage.getItem('unrelated-app')).toBe('keep');
  });
});
