import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game';
import { briefingKey, clientLines } from '../src/ui/clientBriefing';

describe('의뢰인의 계약 안내', () => {
  it('각 필수 형질과 수량, 점수와 기본 보상을 대사로 전달한다', () => {
    const game = createGame();
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const order = game.state.orders[0];
    const story = clientLines(order);
    const text = story.flatMap((line) => [line.text, ...(line.details ?? [])]).join('\n');
    for (const goal of order.goals ?? []) {
      expect(text).toContain(goal.label);
      expect(text).toContain(`${goal.count}개체`);
      expect(text).toContain(goal.detail);
    }
    expect(text).toContain(`${order.target.toLocaleString('ko-KR')}점`);
    expect(text).toContain(`$${order.reward}`);
    expect(story.at(-1)?.text).toContain('점수와 필수 납품 조건을 모두');
    expect(clientLines({ ...order, name: '품종 박람회' })[0].text).toContain('품종 박람회를 부탁드리러');
  });

  it('특별 계약 규칙을 생략하지 않고 추가 보상을 기본 보상과 구별한다', () => {
    const game = createGame();
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const order = game.state.orders[2];
    const lines = clientLines({ ...order, requestedColor: 'gold' });
    expect(lines.some((line) => line.text === order.boss?.desc)).toBe(true);
    expect(lines.some((line) => line.text.includes('골드 과육') && line.text.includes('$2'))).toBe(true);
  });

  it('같은 계약에서는 읽음 상태를 유지하고 새 계약과 재도전에서는 다시 안내한다', () => {
    const state = { seed: 3, ante: 1, orderIdx: 0 as const, orderAttempt: 1 };
    expect(briefingKey({ ...state })).toBe(briefingKey(state));
    for (const changed of [{ seed: 4 }, { ante: 2 }, { orderIdx: 1 as const }, { orderAttempt: 2 }]) {
      expect(briefingKey({ ...state, ...changed })).not.toBe(briefingKey(state));
    }
  });
});
