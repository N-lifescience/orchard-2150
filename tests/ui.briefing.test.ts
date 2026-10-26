import { describe, expect, it } from 'vitest';
import { createGame } from '../src/game';
import { briefingKey, clientLines } from '../src/ui/clientBriefing';

describe('의뢰인의 계약 안내', () => {
  it('각 필수 형질과 수량, 점수와 기본 보상을 대사로 전달한다', () => {
    const game = createGame();
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const order = game.state.orders[0];
    const story = clientLines(order, 'learning');
    const text = story.flatMap((line) => [line.text, ...(line.details ?? [])]).join('\n');
    for (const goal of order.goals ?? []) {
      expect(text).toContain(goal.label);
      expect(text).toContain(`${goal.count}개체`);
      expect(story.find((line) => line.heading === '이번에 필요한 품종')?.details).toContain(`${goal.label} ${goal.count}개체`);
    }
    expect(text).toContain(`${order.target.toLocaleString('ko-KR')}점`);
    expect(text).toContain(`$${order.reward}`);
    expect(story.at(-1)?.text).toContain('필수 납품을 채우면');
    expect(clientLines({ ...order, name: '품종 박람회' }, 'learning')[0].text).toContain('품종 박람회를 부탁드리러');
  });

  it('특별 계약 규칙을 생략하지 않고 추가 보상을 기본 보상과 구별한다', () => {
    const game = createGame();
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const order = game.state.orders[2];
    const lines = clientLines({ ...order, requestedColor: 'gold' }, 'learning');
    expect(lines.some((line) => line.text === order.boss?.desc)).toBe(true);
    expect(lines.some((line) => line.text.includes('골드 과육') && line.text.includes('$2'))).toBe(true);
  });

  it('수업 안내는 필수 납품의 기본 보상과 점수 목표의 추가 보상을 나눠 말한다', () => {
    const game = createGame({ storage: null });
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3, playStyle: 'learning' });
    const order = game.state.orders[0];
    expect(clientLines(order, 'learning').at(-1)?.text).toBe('필수 납품을 채우면 기본 보상 $3를 드려요. 300점 이상이면 $2를 더 드려요.');
  });

  it('도전 안내는 점수와 납품을 모두 채우는 기존 문구를 유지한다', () => {
    const game = createGame({ storage: null });
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3, playStyle: 'challenge' });
    expect(clientLines(game.state.orders[0], 'challenge').at(-1)?.text).toBe('필수 납품과 300점을 모두 채우면 기본 보상 $3를 드려요.');
  });

  it('수업 단원에서는 부모의 기대 분포 조건도 기본 보상 전에 알린다', () => {
    const game = createGame({ storage: null });
    game.newRun({ mode: 'unit-sex', policy: 'heritage', seed: 4, playStyle: 'learning' });
    const lines = clientLines(game.state.orders[0], 'learning');
    expect(lines.at(-1)?.text).toContain('목표 분포에 맞는 부모로 교배하고 필수 납품을 채우면');
    expect(lines.find(line => line.heading === '이번에 필요한 품종')?.details).toContain('기대 분포: 딸은 모두 은빛 잎, 아들은 모두 초록 잎');
  });

  it('형질 목표가 없는 옛 계약은 수업에서도 점수 완료 조건을 유지한다', () => {
    const game = createGame({ storage: null });
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const oldOrder = { ...game.state.orders[0], goals: [] };
    expect(clientLines(oldOrder, 'learning').at(-1)?.text).toBe(clientLines(oldOrder, 'challenge').at(-1)?.text);
  });

  it('같은 계약에서는 읽음 상태를 유지하고 새 계약과 재도전에서는 다시 안내한다', () => {
    const state = { seed: 3, ante: 1, orderIdx: 0 as const, orderAttempt: 1 };
    expect(briefingKey({ ...state })).toBe(briefingKey(state));
    for (const changed of [{ seed: 4 }, { ante: 2 }, { orderIdx: 1 as const }, { orderAttempt: 2 }]) {
      expect(briefingKey({ ...state, ...changed })).not.toBe(briefingKey(state));
    }
  });
});
