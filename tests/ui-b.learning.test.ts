import { describe, expect, it } from 'vitest';
import { QUIZ_CHOICES_BASELINE } from './fixtures/ui-b.quiz-choices';
import type { Difficulty, RunMode, PlayStyle } from '../src/contract/game';
import { createGame } from '../src/game';
import { SAVE_KEY, type StorageLike } from '../src/game/game';
import { difficultyBonus, inferDifficulty } from '../src/game/difficulty';
import { canUseThinking, contractExample, knownColorExpectation, parentReason } from '../src/ui/learning';
import { chooseFragment, crossGuidance, exampleSelection, emptyThinking, fillThinkingCell, learningTools, memoryFor } from '../src/ui/learningFlow';
import { TUTORIAL_SCRIPT } from '../src/ui/story/script';
import { SEASON_QUIZ } from '../src/game/quiz';

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
const game = (difficulty: Difficulty = 'sprout') => {
  const g = createGame({ storage: null });
  g.newRun({ seed: 3, mode: 'quick', policy: 'heritage', difficulty });
  return g;
};

describe('난이도와 저장 호환', () => {
  it('새싹은 모든 계약과 다음 시즌에 출하와 솎아내기를 하나씩 더 받는다', () => {
    const g = game();
    for (let n = 0; n < 6; n++) {
      expect(g.state.handsLeft).toBe(g.state.baseHands + 1);
      expect(g.state.discardsLeft).toBe(g.state.baseDiscards + 1);
      g.state.orders[g.state.orderIdx].goals = [];
      g.state.orders[g.state.orderIdx].target = 1;
      const a = g.state.garden[0];
      g.chooseCross(a.id, a.id, 'ruby');
      g.play(g.state.hand.slice(0, 5).map((c) => c.uid));
      expect(g.state.phase).toBe('cashout');
      g.collect(); g.select(null); g.leaveShop();
    }
    expect(g.state.ante).toBe(3);
  });
  it.each(['fruit', 'master', 'unit'] as Difficulty[])('%s에는 새싹 추가 횟수가 없다', (difficulty) => {
    const g = game(difficulty);
    expect(difficultyBonus(difficulty)).toBe(0);
    expect(g.state.handsLeft).toBe(g.state.baseHands);
    expect(g.state.discardsLeft).toBe(g.state.baseDiscards);
  });
  it.each([
    ['full', 'challenge', 'master'], ['quick', 'challenge', 'master'],
    ['quick', 'learning', 'sprout'], ['full', 'learning', 'fruit'],
    ['unit-sex', 'learning', 'unit'], ['unit-chromo', 'learning', 'unit'], ['unit-edit', 'learning', 'unit'],
  ] as [RunMode, PlayStyle, Difficulty][])('옛 저장 %s/%s → %s', (mode, style, expected) => {
    const storage = new Memory(); const g = createGame({ storage });
    g.newRun({ mode, policy: 'heritage', playStyle: style, seed: 3 });
    const old = JSON.parse(storage.getItem(SAVE_KEY)!);
    delete old.difficulty;
    if (old.orderCheckpoint) { const checkpoint = JSON.parse(old.orderCheckpoint); delete checkpoint.difficulty; old.orderCheckpoint = JSON.stringify(checkpoint); }
    storage.setItem(SAVE_KEY, JSON.stringify(old));
    const restored = createGame({ storage }); expect(restored.load()).toBe(true);
    expect(restored.state.difficulty).toBe(expected);
    expect(JSON.parse(restored.state.orderCheckpoint!).difficulty).toBe(expected);
    expect(inferDifficulty(mode, style, 'invalid')).toBe(expected);
  });
  it('난이도가 명시된 새 저장은 다시 불러와도 유지한다', () => {
    const storage = new Memory(); const g = createGame({ storage });
    g.newRun({ mode: 'full', policy: 'heritage', difficulty: 'master', seed: 3 });
    const restored = createGame({ storage }); expect(restored.load()).toBe(true);
    expect(restored.state.difficulty).toBe('master'); expect(restored.state.playStyle).toBe('challenge');
  });
});

describe('예측 전에 결론을 대신 말하지 않는 도움', () => {
  it('명인은 도우미, 기억 단서, 첫 시범과 자동 도움을 모두 숨긴다', () => {
    expect(learningTools(game('master').state)).toEqual({ helper: false, memory: false, example: false, autoHelper: false, autoMemory: false, coach: false });
  });
  it('새싹의 첫 세 교배는 자동 도움, 열매와 단원은 단추 도움을 쓴다', () => {
    const s = game().state;
    expect(learningTools(s).autoHelper).toBe(true);
    s.stats.crosses = 3; expect(learningTools(s).autoHelper).toBe(false);
    for (const difficulty of ['fruit', 'unit'] as Difficulty[]) {
      s.difficulty = difficulty; expect(learningTools(s).helper).toBe(true); expect(learningTools(s).autoMemory).toBe(false);
    }
  });
  it('안내, 부모 설명, 튜토리얼, 계약 예시는 예측 전 결과를 노출하지 않는다', () => {
    const g = game(); const [a, b] = g.state.garden;
    const copy = [crossGuidance(false, ['RR', 'rr'], '모두 Rr, 루비 100%'), parentReason(a, b), ...TUTORIAL_SCRIPT.predict.lines.map((l) => l.text)].join(' ');
    expect(copy).not.toMatch(/모두\s*Rr|100%|75%|25%|50%|1\s*:\s*2|우성|→/);
    for (const order of g.state.orders) expect(contractExample(order)).toBeNull();
    expect(parentReason(a, b, true)).toContain('100%');

  });
  it('첫 교배 시범은 부모만 고르고 예측을 비워 둔다', () => {
    expect(exampleSelection('a', 'b')).toEqual({ parents: ['a', 'b'], prediction: null });
  });
  it('도우미는 비공개, 배수체, 성염색체, 편집 부모와 해당 계약을 제외한다', () => {
    const g = game(); const [a, b] = g.state.garden;
    expect(canUseThinking(g.state, a, b)).toBe(true);
    expect(canUseThinking(g.state, a, a)).toBe(true);
    b.revealed = false; expect(canUseThinking(g.state, a, b)).toBe(false); b.revealed = true;
    b.genome.ploidy = 4; expect(canUseThinking(g.state, a, b)).toBe(false); b.genome.ploidy = 2;
    const copy = Object.values(b.genome.chromosomes).flat()[0]; copy.seqs = { R: 'ATGTAA' };
    expect(knownColorExpectation(a, b)).toBeNull(); delete copy.seqs;
    for (const trait of [{ seedless: true }, { euploid: true }, { knockout: true }, { species: 'stella' as const }]) {
      g.state.orders[0].goals = [{ id: 'x', label: '', detail: '', count: 1, trait }];
      expect(canUseThinking(g.state, a, b)).toBe(false);
    }
  });
  it('틀린 조각은 근거만 말하고 조각이나 조합 칸을 채우지 않는다', () => {
    const state = emptyThinking();
    const result = chooseFragment(state, ['RR', 'rr'], 0, 'r');
    expect(result.reason).toBe('이 부모의 유전자형에는 r이 없어요.');
    expect(result.state).toBe(state); expect(result.state.cells).toEqual([null, null, null, null]);
    expect(result.state.gametes).toEqual([null, null, null, null]);
  });
  it('정상 조각도 칸을 대신 채우지 않고, 직접 누른 조합만 나타난다', () => {
    let state = emptyThinking();
    state = chooseFragment(state, ['Rr', 'rr'], 0, 'R').state;
    state = chooseFragment(state, ['Rr', 'rr'], 1, 'r').state;
    state = chooseFragment(state, ['Rr', 'rr'], 2, 'r').state;
    state = chooseFragment(state, ['Rr', 'rr'], 3, 'r').state;
    expect(state.cells).toEqual([null, null, null, null]);
    state = fillThinkingCell(state, 0); expect(state.cells).toEqual(['Rr', null, null, null]);
    state = fillThinkingCell(state, 2); expect(state.cells).toEqual(['Rr', null, 'rr', null]);
  });
  it('조각을 다 고르지 않은 칸은 채울 수 없다', () => {
    const state = emptyThinking(); expect(fillThinkingCell(state, 0)).toBe(state);
  });
  it('기억 단서는 발견한 노트와 실제 내 기록만 연결한다', () => {
    const g = game(); const a = g.state.garden[2];
    g.chooseCross(a.id, a.id, 'ruby');
    while (g.state.phase === 'play') g.play(g.state.hand.slice(0, 5).map((c) => c.uid));
    const r = g.state.records[0]; expect(r.prediction).not.toBeNull();
    expect(memoryFor(g.state.orders[0], [r], [])).toBeNull();
    const memory = memoryFor(g.state.orders[0], [r], ['segregation']);
    expect(memory?.record).toBe(r); expect(memory?.note).toBe('segregation');
  });
  it('확인 질문 선택지의 수, 순서, 정답과 뜻을 바꾸지 않는다', () => {
    expect(Object.values(SEASON_QUIZ).flat().map(({ choices, answer }) => ({ choices, answer }))).toEqual(QUIZ_CHOICES_BASELINE);
  });
});
