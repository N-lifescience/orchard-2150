import { describe, expect, it } from 'vitest';
import type { PolicyId, RunMode } from '../src/contract/game';
import { CONCEPTS } from '../src/game';
import { createGame, SAVE_KEY, type GameImpl, type StorageLike } from '../src/game/game';
import { answerQuestion, attemptPassed, legacyQuizPassed, quizDueFor, quizFor, SEASON_QUIZ, startAttempt } from '../src/game/quiz';
import { seasonsOf } from '../src/game/story';
import { decide, applyDirect } from '../src/ui/bot';

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

/** 봇으로 진행해 시즌 끝(세 번째 계약 뒤 공방)에 멈춘다 */
function toSeasonEnd(g: GameImpl, limit = 3000): void {
  for (let i = 0; i < limit; i++) {
    const s = g.state;
    if (s.phase === 'shop' && s.orderIdx === 2) return;
    if (s.phase === 'victory' || s.phase === 'gameover') return;
    if (s.phase === 'review') { g.retryOrder(); continue; }
    applyDirect(g, decide(g));
  }
  throw new Error('시즌 끝에 닿지 못했어요');
}

describe('시즌 끝 확인 질문 자료', () => {
  it('시즌 1~8마다 2~3문항이고, 모든 운영 팀이 풀 수 있다', () => {
    for (let season = 1; season <= 8; season++) {
      for (const policy of ['heritage', 'precision', 'biotech'] as PolicyId[]) {
        const qs = quizFor(season, policy);
        expect(qs.length, `시즌 ${season} ${policy}`).toBeGreaterThanOrEqual(2);
        expect(qs.length, `시즌 ${season} ${policy}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('정답 위치가 맞고, 틀렸을 때의 힌트는 정답 선택지를 그대로 말하지 않으며, 노트와 이어진다', () => {
    const ids = new Set<string>();
    for (const qs of Object.values(SEASON_QUIZ)) {
      for (const q of qs) {
        expect(ids.has(q.id), q.id).toBe(false);
        ids.add(q.id);
        expect(q.choices.length, q.id).toBeGreaterThanOrEqual(3);
        expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
        expect(q.answer, q.id).toBeLessThan(q.choices.length);
        expect(new Set(q.choices).size, q.id).toBe(q.choices.length);
        expect(q.hint, q.id).not.toContain(q.choices[q.answer]);
        expect(q.explain.length, q.id).toBeGreaterThan(10);
        expect(CONCEPTS[q.note], q.id).toBeTruthy();
        expect(q.prompt).toMatch(/고르세요\.?$/);
      }
    }
  });

  it('정답 위치가 한쪽으로 몰리지 않는다', () => {
    const positions = Object.values(SEASON_QUIZ).flat().map((q) => q.answer);
    expect(new Set(positions).size).toBe(3);
  });

  it('편집 팀만 겪는 종결 코돈 문항은 교배·선발팀에게 나오지 않는다', () => {
    expect(quizFor(7, 'heritage').map((q) => q.id)).not.toContain('s7-stop');
    expect(quizFor(7, 'precision').map((q) => q.id)).toContain('s7-stop');
  });
});

describe('풀이: 모두 맞혀야 통과, 다시 풀기 무제한', () => {
  it('틀린 문항은 몇 번이든 다시 고를 수 있고, 모두 맞혀야 통과한다', () => {
    const qs = quizFor(1, 'heritage');
    const attempt = startAttempt(qs);
    expect(attemptPassed(attempt)).toBe(false);
    for (let round = 0; round < 5; round++) {
      const wrong = (qs[0].answer + 1) % qs[0].choices.length;
      expect(answerQuestion(attempt, 0, wrong)).toBe(false);
    }
    expect(attempt.tries[0]).toHaveLength(5);
    expect(answerQuestion(attempt, 0, qs[0].answer)).toBe(true);
    // 이미 맞힌 문항은 다른 답으로 바뀌지 않는다
    expect(answerQuestion(attempt, 0, (qs[0].answer + 1) % 3)).toBe(true);
    expect(attemptPassed(attempt)).toBe(false);
    qs.forEach((q, i) => answerQuestion(attempt, i, q.answer));
    expect(attemptPassed(attempt)).toBe(true);
  });
});

describe('시즌 끝 관문', () => {
  it('세 번째 계약 뒤 공방에서만, 마지막 시즌이면 결말 앞에서 열린다', () => {
    const base = { ante: 2, maxAnte: 4, quizPassed: [1] };
    expect(quizDueFor({ ...base, phase: 'shop', orderIdx: 2 })).toBe(2);
    expect(quizDueFor({ ...base, phase: 'shop', orderIdx: 1 })).toBeNull();
    expect(quizDueFor({ ...base, phase: 'cross', orderIdx: 2 })).toBeNull();
    expect(quizDueFor({ ...base, phase: 'shop', orderIdx: 2, quizPassed: [1, 2] })).toBeNull();
    expect(quizDueFor({ phase: 'victory', ante: 4, maxAnte: 4, orderIdx: 2, quizPassed: [1, 2, 3] })).toBe(4);
    expect(quizDueFor({ phase: 'victory', ante: 4, maxAnte: 4, orderIdx: 2, quizPassed: [1, 2, 3, 4] })).toBeNull();
    expect(quizDueFor({ phase: 'review', ante: 2, maxAnte: 4, orderIdx: 2 })).toBeNull();
  });

  for (const playStyle of ['learning', 'challenge'] as const) {
    it(`${playStyle === 'learning' ? '재도전 허용' : '실패 시 종료'}: 맞히기 전에는 다음 시즌이 열리지 않고, 틀려도 실패로 세지 않는다`, () => {
      const g = createGame({ storage: null, quizGate: true });
      g.newRun({ seed: 3, mode: 'quick', policy: 'heritage', playStyle });
      toSeasonEnd(g);
      expect(g.state.phase).toBe('shop');
      expect(g.quizDue()).toBe(1);
      const before = JSON.stringify(g.state);
      // 틀린 답을 여러 번 골라도 게임 상태(재도전 수·기록·단계)는 그대로
      const attempt = startAttempt(quizFor(1, g.state.policy));
      for (let i = 0; i < 4; i++) answerQuestion(attempt, 0, (attempt.questions[0].answer + 1) % 3);
      g.leaveShop();
      expect(JSON.stringify(g.state)).toBe(before);
      expect(g.state.phase).toBe('shop');
      expect(g.state.stats.retries).toBe(0);
      expect(g.state.ante).toBe(1);
      // 모두 맞힌 뒤에는 다음 시즌으로
      expect(g.passQuiz(1)).toBe(true);
      expect(g.quizDue()).toBeNull();
      g.leaveShop();
      expect(g.state.ante).toBe(2);
      expect(g.state.phase).toBe('cross');
      expect(g.state.orderIdx).toBe(0);
      expect(g.state.quizPassed).toEqual([1]);
    });
  }

  it('계약 사이의 공방은 막지 않고, 관문이 꺼진 시뮬레이션은 기존 흐름 그대로다', () => {
    const gated = createGame({ storage: null, quizGate: true });
    gated.newRun({ seed: 3, mode: 'quick', policy: 'heritage' });
    for (let i = 0; i < 200 && !(gated.state.phase === 'shop'); i++) applyDirect(gated, decide(gated));
    expect(gated.state.orderIdx).toBe(0);
    expect(gated.quizDue()).toBeNull();
    gated.leaveShop();
    expect(gated.state.orderIdx).toBe(1);

    const sim = createGame({ storage: null });
    sim.newRun({ seed: 3, mode: 'quick', policy: 'heritage' });
    toSeasonEnd(sim);
    sim.leaveShop();
    expect(sim.state.ante).toBe(2);
  });

  it('이 연대기에 없는 시즌은 통과로 기록하지 않는다', () => {
    const g = createGame({ storage: null, quizGate: true });
    g.newRun({ seed: 3, mode: 'unit-sex', policy: 'heritage' });
    expect(g.passQuiz(1)).toBe(false);
    expect(g.passQuiz(9)).toBe(false);
    expect(g.passQuiz(3)).toBe(true);
    expect(g.state.quizPassed).toEqual([3]);
  });

  it('재도전으로 계약을 되돌려도 통과한 시즌 기록은 남는다', () => {
    const g = createGame({ storage: null, quizGate: true });
    g.newRun({ seed: 3, mode: 'quick', policy: 'heritage', playStyle: 'learning' });
    toSeasonEnd(g);
    g.passQuiz(1);
    g.leaveShop();
    const gold = g.state.garden.find((p) => p.pheno.color === 'gold')!;
    g.chooseCross(gold.id, gold.id, 'gold');
    while (g.state.phase === 'play') g.play([g.state.hand[0].uid]);
    if (g.state.phase === 'review') {
      expect(g.retryOrder()).toBe(true);
      expect(g.state.quizPassed).toEqual([1]);
    }
  });
});

describe('확인 질문이 생기기 전의 저장', () => {
  it('이미 지난 시즌은 통과로 치고, 지금 시즌 끝에서는 질문을 연다', () => {
    const storage = new Memory();
    const g = createGame({ storage, quizGate: true });
    g.newRun({ seed: 3, mode: 'quick', policy: 'heritage' });
    toSeasonEnd(g);
    g.passQuiz(1);
    g.leaveShop();
    toSeasonEnd(g);
    expect(g.state.ante).toBe(2);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    delete raw.quizPassed;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const loaded = createGame({ storage, quizGate: true });
    expect(loaded.load()).toBe(true);
    expect(loaded.state.quizPassed).toEqual([1]);
    expect(loaded.quizDue()).toBe(2);
  });

  it('이미 끝난 연대기는 남은 질문 없이 결과를 그대로 연다', () => {
    expect(legacyQuizPassed({ startAnte: 1, ante: 4, maxAnte: 4, phase: 'victory' })).toEqual([1, 2, 3, 4]);
    expect(legacyQuizPassed({ startAnte: 3, ante: 4, maxAnte: 4, phase: 'gameover' })).toEqual([3, 4]);
    expect(legacyQuizPassed({ startAnte: 5, ante: 5, maxAnte: 6, phase: 'cross' })).toEqual([]);
    expect(quizDueFor({ phase: 'victory', ante: 4, maxAnte: 4, orderIdx: 2, quizPassed: legacyQuizPassed({ startAnte: 1, ante: 4, maxAnte: 4, phase: 'victory' }) })).toBeNull();
  });
});

describe('짧은 연대기와 단원 게임은 자기 시즌의 질문만', () => {
  it.each([['quick', [1, 2, 3, 4]], ['unit-sex', [3, 4]], ['unit-chromo', [5, 6]], ['unit-edit', [7, 8]], ['full', [1, 2, 3, 4, 5, 6, 7, 8]]] as [RunMode, number[]][])('%s', (mode, seasons) => {
    expect(seasonsOf(mode)).toEqual(seasons);
  });
});
