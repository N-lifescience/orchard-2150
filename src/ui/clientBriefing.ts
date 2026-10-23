import type { OrderInfo, RunState } from '../contract/game';
import { BOSS_STORY } from '../game/story';
import { josa } from './fmt';

export interface ClientLine { heading: string; text: string; details?: string[] }

/** The acknowledgement belongs to this contract attempt and saved orchard. */
export function briefingKey(s: Pick<RunState, 'seed' | 'ante' | 'orderIdx' | 'orderAttempt'>): string {
  return `${s.seed}:${s.ante}:${s.orderIdx}:${s.orderAttempt}`;
}

export function clientLines(order: OrderInfo): ClientLine[] {
  const [name] = order.client.split(' · ');
  const lines: ClientLine[] = [{
    heading: '온실을 찾아온 손님',
    text: `${name}이고, 이번 ${josa(order.name, '을를')} 부탁드리러 왔어요.`,
  }];
  // A special client brings one belief or question; the finished contract becomes the answer.
  const question = order.kind === 'boss' && order.boss ? BOSS_STORY[order.boss.id]?.question : undefined;
  if (question) lines.push({ heading: '손님의 질문', text: question });
  lines.push({
    heading: '이번에 필요한 품종',
    text: order.goals?.length ? '그림 속 형질이 있는 모종을 부탁드려요.' : '이번에는 좋은 열매를 골라 출하해 주세요.',
    details: order.goals?.map((goal) => `${goal.label} ${goal.count}개체`),
  });
  if (order.boss) lines.push({ heading: '이번 계약의 특별 조건', text: order.boss.desc });
  if (order.requestedColor) lines.push({
    heading: '추가로 부탁드릴 것이 있어요',
    text: `${order.requestedColor === 'ruby' ? '루비' : '골드'} 과육을 출하해 주시면 보상에 $2를 더 드릴게요.`,
  });
  lines.push({
    heading: '그럼, 잘 부탁드려요',
    text: `필수 납품과 ${order.target.toLocaleString('ko-KR')}점을 모두 채우면 기본 보상 $${order.reward}를 드려요.`,
  });
  return lines;
}
