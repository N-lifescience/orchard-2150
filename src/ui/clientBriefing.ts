import type { OrderInfo, RunState } from '../contract/game';
import { josa } from './fmt';

export interface ClientLine { heading: string; text: string; details?: string[] }

/** The acknowledgement belongs to this contract attempt and saved orchard. */
export function briefingKey(s: Pick<RunState, 'seed' | 'ante' | 'orderIdx' | 'orderAttempt'>): string {
  return `${s.seed}:${s.ante}:${s.orderIdx}:${s.orderAttempt}`;
}

export function clientLines(order: OrderInfo): ClientLine[] {
  const [name, ...affiliation] = order.client.split(' · ');
  const lines: ClientLine[] = [{
    heading: '온실을 찾아온 손님',
    text: `안녕하세요. ${affiliation.length ? affiliation[0] + '의 ' : ''}${name}입니다. 이번 ${josa(order.name, '을를')} 부탁드리러 왔어요.`,
  }, {
    heading: '이번에 필요한 품종',
    text: order.goals?.length ? '아래 형질을 가진 개체가 필요해요. 출하할 때 이 조건을 꼭 확인해 주세요.' : '이번에는 좋은 열매를 골라 출하해 주세요.',
    details: order.goals?.map((goal) => `${goal.label} · ${goal.count}개체 — ${goal.detail}`),
  }];
  if (order.boss) lines.push({ heading: '이번 계약의 특별 조건', text: order.boss.desc });
  if (order.requestedColor) lines.push({
    heading: '추가로 부탁드릴 것이 있어요',
    text: `${order.requestedColor === 'ruby' ? '루비' : '골드'} 과육을 출하해 주시면 보상에 $2를 더 드릴게요.`,
  });
  lines.push({
    heading: '그럼, 잘 부탁드려요',
    text: `목표는 ${order.target.toLocaleString('ko-KR')}점이고 기본 보상은 $${order.reward}예요. 점수와 필수 납품 조건을 모두 채우면 계약이 완료돼요.`,
  });
  return lines;
}
