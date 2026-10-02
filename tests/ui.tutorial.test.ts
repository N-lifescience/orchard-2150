import { describe, expect, it } from 'vitest';
import { createGame, type StorageLike } from '../src/game/game';
import { createRunSlot, listRunSlots, removeRunSlot } from '../src/ui/runSlots';
import { acknowledgePractice, initialPractice, loadPractice, practiceKey, savePractice } from '../src/ui/practiceStorage';
import { wipeAll } from '../src/ui/prefs';
import { inferTutorialStep, tutorialStep, TUTORIAL_INTRO, TUTORIAL_PLAY_TOOLS, type TutorialInteraction } from '../src/ui/tutorialFlow';

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
  introStep: 6, orderRead: true, parentCount: 2, predicted: true, observed: true, selectedCards: 5,
  ...overrides,
});

describe('실제 플레이 튜토리얼', () => {
  it('목표와 도구 안내를 실제 조작 전에 순서대로 저장하며 재접속해 이어간다', () => {
    const storage = new MemoryStore();
    const slot = createRunSlot('튜토리얼 검증', 'quick', 'heritage', storage)!;
    const game = guidedRun(storage, slot.key);
    let progress = initialPractice();
    const before = JSON.stringify(game.state);
    for (const expected of TUTORIAL_INTRO) {
      const current = inferTutorialStep(game.state, interaction({ ...progress, parentCount: 0, predicted: false }));
      expect(current).toBe(expected);
      expect(tutorialStep(current).actionLabel).toBeTruthy();
      acknowledgePractice(progress, current);
      savePractice(slot.key, progress, storage);
      progress = loadPractice(slot.key, storage)!;
    }
    expect(progress.introStep).toBe(6);
    expect(inferTutorialStep(game.state, interaction({ ...progress, parentCount: 0, predicted: false }))).toBe('order');
    acknowledgePractice(progress, 'order');
    expect(inferTutorialStep(game.state, interaction({ ...progress, parentCount: 0, predicted: false }))).toBe('parent-first');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('기존 튜토리얼 저장은 이미 확인한 주문 이전 소개를 반복하지 않는다', () => {
    const game = guidedRun();
    expect(inferTutorialStep(game.state, interaction({ introStep: undefined, orderRead: true, parentCount: 0 }))).toBe('parent-first');
    expect(inferTutorialStep(game.state, interaction({ introStep: undefined, orderRead: false, parentCount: 0 }))).toBe('welcome');
    expect(tutorialStep('parent-first').target).toBe('parent-first');
    expect(tutorialStep('parent-second').target).toBe('parent-second');
  });

  it('교배 후 도구 안내를 저장해 이어가며 씨앗과 횟수는 소모하지 않는다', () => {
    const storage = new MemoryStore();
    const slot = createRunSlot('도구 안내 검증', 'quick', 'heritage', storage)!;
    const game = guidedRun(storage, slot.key);
    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    let progress = { ...initialPractice(), introStep: 6, orderRead: true };
    acknowledgePractice(progress, 'observe');
    const before = JSON.stringify(game.state);
    for (const expected of TUTORIAL_PLAY_TOOLS) {
      expect(inferTutorialStep(game.state, interaction(progress))).toBe(expected);
      acknowledgePractice(progress, expected);
      savePractice(slot.key, progress, storage);
      progress = loadPractice(slot.key, storage)! as typeof progress;
    }
    expect(inferTutorialStep(game.state, interaction({ ...progress, selectedCards: 0 }))).toBe('select-cards');
    expect(JSON.stringify(game.state)).toBe(before);
  });

  it('읽기 확인과 실제 조작을 구분하며, 선택을 바꾸면 필요한 단계로 돌아간다', () => {
    const game = guidedRun();
    const step = (changes: Partial<TutorialInteraction>) => inferTutorialStep(game.state, interaction(changes));
    expect(step({ orderRead: false })).toBe('order');
    expect(step({ orderRead: undefined })).toBe('order');
    expect(step({ parentCount: 0, predicted: false })).toBe('parent-first');
    expect(step({ parentCount: 1, predicted: false })).toBe('parent-second');
    expect(step({ predicted: false })).toBe('predict');
    expect(step({})).toBe('cross');
    expect(step({ parentCount: 1 })).toBe('parent-second');

    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    expect(step({ observed: false })).toBe('observe');
    expect(step({ observed: undefined })).toBe('observe');
    expect(step({ selectedCards: 0 })).toBe('select-cards');
    expect(step({ selectedCards: 4 })).toBe('select-cards');
    expect(step({ selectedCards: 5 })).toBe('ship');
    expect(step({ selectedCards: 4 })).toBe('select-cards');
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
    expect(game.state.prediction).toEqual({ choice: 'ruby', ruby: 52, gold: 0 });
    expect(game.state.hand.length + game.state.pod.length).toBe(52);
    game.sortHand('brix');

    const result = game.play(game.state.hand.slice(0, 5).map((card) => card.uid));
    expect(result.total).toBeGreaterThanOrEqual(firstOrder.target);
    expect(result.cleared).toBe(true);
    expect(game.state.delivery.ruby).toBeGreaterThanOrEqual(3);
    expect(inferTutorialStep(game.state, interaction({ orderRead: false, observed: false }))).toBe('collect');
    const reward = game.cashoutLines().reduce((sum, line) => sum + line.amount, 0);
    game.collect();
    expect(inferTutorialStep(game.state, interaction())).toBe('keep');
    expect(game.state.money).toBe(startingMoney + reward);

    const candidate = game.selectOptions().candidates[0];
    game.select(candidate.uid);
    expect(inferTutorialStep(game.state, interaction())).toBe('shop');
    expect(game.state.garden).toHaveLength(startingGarden + 1);
    const keptPlant = game.state.garden.at(-1)!;
    expect(keptPlant.parents).toEqual([ruby.id, gold.id]);
    expect(keptPlant.genome).toEqual(candidate.genome);
    game.leaveShop();
    expect(game.state.phase).toBe('cross');
    expect(game.state.orderIdx).toBe(1);
    expect(inferTutorialStep(game.state, interaction())).toBe('complete');
    expect(game.state.money).toBe(startingMoney + reward);
    expect(game.state.garden.at(-1)?.id).toBe(keptPlant.id);
    expect(game.state.records).toHaveLength(1);
    expect(game.state.records[0].cleared).toBe(true);

    const continued = createGame({ storage });
    continued.setSaveKey(slot.key);
    expect(continued.load()).toBe(true);
    expect(continued.state).toEqual(game.state);
    expect(inferTutorialStep(continued.state, interaction())).toBe('complete');
    const goldParent = continued.state.garden[1];
    continued.chooseCross(goldParent.id, goldParent.id, 'gold');
    expect(continued.state.hand.every((card) => card.pheno.color === 'gold')).toBe(true);
    expect(continued.state.records).toHaveLength(1);
    expect(continued.state.money).toBe(startingMoney + reward);
    expect(storage.getItem(olderSlot.key)).toBe(olderSave);
  });

  it.each(['brix', 'suit'] as const)('손패를 %s 순으로 정렬해도 처음 5장으로 첫 계약을 마칠 수 있다', (sortBy) => {
    const game = guidedRun();
    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    game.sortHand(sortBy);
    const trace = game.play(game.state.hand.slice(0, 5).map((card) => card.uid));
    expect(trace.cleared).toBe(true);
    expect(game.state.phase).toBe('cashout');
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
    expect(game.state.orderAttempt).toBe(2);
    expect(inferTutorialStep(game.state, interaction({ parentCount: 0, predicted: false, observed: false }))).toBe('parent-first');
  });

  it('손패가 5장보다 적어도 출하할 수 있고, 안내 계산은 게임 상태를 바꾸지 않는다', () => {
    const game = guidedRun();
    game.chooseCross(game.state.garden[0].id, game.state.garden[1].id, 'ruby');
    game.state.hand = game.state.hand.slice(0, 3);
    const before = JSON.stringify(game.state);
    expect(inferTutorialStep(game.state, interaction({ selectedCards: 3 }))).toBe('ship');
    expect(tutorialStep('ship')).toMatchObject({ number: 17, total: 20, target: 'shipment' });
    expect(JSON.stringify(game.state)).toBe(before);
  });
});

describe('연대기별 튜토리얼 저장', () => {
  it('다른 연대기의 안내 상태를 덮어쓰지 않고 중단한 확인 단계부터 불러온다', () => {
    const storage = new MemoryStore();
    const first = createRunSlot('교배 연습', 'quick', 'heritage', storage)!;
    const second = createRunSlot('다른 과수원', 'quick', 'heritage', storage)!;
    const firstGame = guidedRun(storage, first.key);
    const secondGame = guidedRun(storage, second.key);
    const firstProgress = { ...initialPractice(), orderRead: true, observed: false };
    const secondProgress = { active: false, orderRead: true, observed: true, completed: false };
    savePractice(first.key, firstProgress, storage);
    savePractice(second.key, secondProgress, storage);
    firstGame.chooseCross(firstGame.state.garden[0].id, firstGame.state.garden[1].id, 'ruby');

    const restored = createGame({ storage });
    restored.setSaveKey(first.key);
    expect(restored.load()).toBe(true);
    const progress = loadPractice(first.key, storage)!;
    expect(progress).toEqual(firstProgress);
    expect(inferTutorialStep(restored.state, interaction(progress))).toBe('observe');
    savePractice(first.key, { ...progress, observed: true }, storage);
    expect(loadPractice(first.key, storage)).toEqual({ ...firstProgress, observed: true });
    expect(loadPractice(second.key, storage)).toEqual(secondProgress);
    expect(JSON.parse(storage.getItem(second.key)!)).toEqual(secondGame.state);
  });

  it('손상되거나 접근할 수 없는 저장은 안내를 시작하지 않으며 완료된 안내는 다시 활성화되지 않는다', () => {
    const storage = new MemoryStore();
    const key = 'tutorial-save';
    for (const damaged of ['{', 'null', '[]', '{}', '{"active":"true","orderRead":true,"observed":true,"completed":false}']) {
      storage.setItem(practiceKey(key), damaged);
      expect(loadPractice(key, storage)).toBeNull();
    }
    for (const introStep of [-1, 7, 0.5, '1', null]) {
      storage.setItem(practiceKey(key), JSON.stringify({ ...initialPractice(), introStep }));
      expect(loadPractice(key, storage)).toBeNull();
    }
    for (const playIntroStep of [-1, 4, 0.5, '1', null]) {
      storage.setItem(practiceKey(key), JSON.stringify({ ...initialPractice(), playIntroStep }));
      expect(loadPractice(key, storage)).toBeNull();
    }
    expect(loadPractice('missing', storage)).toBeNull();
    expect(loadPractice(key, null)).toBeNull();
    const blockedStorage: StorageLike = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    expect(loadPractice(key, blockedStorage)).toBeNull();
    expect(() => savePractice(key, initialPractice(), blockedStorage)).not.toThrow();

    savePractice(key, { active: true, orderRead: true, observed: true, completed: true }, storage);
    expect(loadPractice(key, storage)).toEqual({ active: false, orderRead: true, observed: true, completed: true });
  });

  it('한 연대기를 지우면 해당 안내만 지우고, 전체 기록 지우기는 나머지 안내도 지운다', () => {
    const storage = new MemoryStore();
    const first = createRunSlot('지울 과수원', 'quick', 'heritage', storage)!;
    const second = createRunSlot('남길 과수원', 'quick', 'heritage', storage)!;
    guidedRun(storage, first.key);
    guidedRun(storage, second.key);
    savePractice(first.key, initialPractice(), storage);
    const secondProgress = { ...initialPractice(), orderRead: true };
    savePractice(second.key, secondProgress, storage);
    const secondSave = storage.getItem(second.key);
    storage.setItem('unrelated-app', 'keep');

    removeRunSlot(first.id, storage);
    expect(storage.getItem(first.key)).toBeNull();
    expect(storage.getItem(practiceKey(first.key))).toBeNull();
    expect(storage.getItem(second.key)).toBe(secondSave);
    expect(loadPractice(second.key, storage)).toEqual(secondProgress);
    expect(listRunSlots(storage).map((slot) => slot.id)).toEqual([second.id]);

    wipeAll(storage);
    expect(storage.getItem(second.key)).toBeNull();
    expect(storage.getItem(practiceKey(second.key))).toBeNull();
    expect(listRunSlots(storage)).toEqual([]);
    expect(storage.getItem('unrelated-app')).toBe('keep');
  });
});
