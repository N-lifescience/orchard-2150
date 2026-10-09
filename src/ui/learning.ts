import type { DeliveryGoal, OrderInfo, Plant, SeedCard } from '../contract/game';
import { deliveryComplete, goalHint, goalMatches } from '../game';
import { locusLetters } from './cards';
import { h } from './h';

/** 공개된 두 부모의 2배체 R 자리만으로 계산한 과육색 확률. */
export interface ColorExpectation {
  ruby: number;
  gold: number;
  a: string;
  b: string;
  offspring: string;
  reasoning: string;
}

export function knownColorExpectation(a: Plant | undefined, b: Plant | undefined): ColorExpectation | null {
  if (!a?.revealed || !b?.revealed || a.genome.species !== b.genome.species) return null;
  if (a.genome.ploidy !== 2 || b.genome.ploidy !== 2 || a.pheno.aneuploid || b.pheno.aneuploid) return null;
  const aa = locusLetters(a.genome, 'R');
  const bb = locusLetters(b.genome, 'R');
  if (!/^[Rr]{2}$/.test(aa) || !/^[Rr]{2}$/.test(bb)) return null;
  const counts: Record<string, number> = { RR: 0, Rr: 0, rr: 0 };
  for (const x of aa) for (const y of bb) counts[[x, y].sort().join('')]++;
  const gold = counts.rr / 4;
  const offspring = Object.entries(counts).filter(([, n]) => n > 0)
    .map(([letters, n]) => `${letters} ${n === 4 ? '100%' : `${n * 25}%`}`).join(' · ');
  const gametes = (letters: string) => letters[0] === letters[1]
    ? `${letters}는 ${letters[0]}만 전달합니다`
    : 'Rr는 R과 r을 각각 50% 확률로 전달합니다';
  return {
    ruby: 1 - gold, gold, a: aa, b: bb, offspring,
    reasoning: `${gametes(aa)}. ${aa === bb ? '' : `${gametes(bb)}. `}자손에게 기능 있는 R이 하나라도 있으면 루비, 없으면 골드입니다.`,
  };
}

export function colorExpectationText(expectation: ColorExpectation): string {
  return `기대: 루비 ${Math.round(expectation.ruby * 100)}% · 골드 ${Math.round(expectation.gold * 100)}%`;
}

export function parentReason(a: Plant | undefined, b: Plant | undefined): string {
  if (!a || !b) return '부모를 고른 뒤 공개된 유전자형으로 자손의 과육색을 예상해 보세요.';
  const expectation = knownColorExpectation(a, b);
  if (expectation) return `${expectation.a} × ${expectation.b} → ${expectation.offspring}`;
  if (!a.revealed || !b.revealed) return "유전자형을 모르는 부모가 있어요. 루비 겉모습만으로 RR인지 Rr인지 구별할 수 없어요. 검사하거나 자손을 관찰해 좁혀 보세요.";
  return "공개된 부모의 배수성·편집 상태를 확인하세요. 이 교배에는 2배체 RR·Rr·rr 예시를 그대로 적용할 수 없어요.";
}

/** 주문 점수와 별도로 채워야 하는 납품 조건. 수량은 게임 상태를 읽기만 한다. */
export function deliveryGoals(order: OrderInfo, delivery: Record<string, number>, compact = false): HTMLElement {
  const complete = deliveryComplete(order, delivery);
  return h('div', { class: ['delivery-goals', compact && 'delivery-goals--compact', complete && 'is-complete'] },
    h('div', { class: 'delivery-goals__head' }, compact ? '필수 납품' : '필수 납품 · 점수와 함께 채우세요'),
    ...(order.goals ?? []).map((goal) => {
      const sent = Math.min(goal.count, delivery[goal.id] ?? 0);
      const done = sent >= goal.count;
      return h('div', { class: ['delivery-goal', done && 'is-done'], title: `${goal.detail} ${goalHint(goal)}` },
        h('span', { class: 'delivery-goal__mark', 'aria-hidden': 'true' }, done ? '✓' : '○'),
        h('span', { class: 'delivery-goal__label' }, goal.label),
        h('span', { class: 'delivery-goal__count num', 'aria-label': `${sent} / ${goal.count}개체 출하` }, `${sent}/${goal.count}`),
      );
    }),
  );
}

export function goalRetryHint(goals: DeliveryGoal[] | undefined): string {
  return goals?.length ? goals.map((goal) => goalHint(goal)).join(' ') : '목표 점수를 남은 출하 안에 채우세요.';
}

/** 풀이 예시는 공개 규칙을 설명한다. 비공개 부모의 실제 유전자형은 알려 주지 않는다. */
export function contractExample(order: OrderInfo): { title: string; steps: string[] } | null {
  const traits = (order.goals ?? []).map((goal) => goal.trait);
  if (traits.some((t) => t.knockout)) return { title: 'B 기능을 없애는 편집', steps: [
    "B와 b를 하나씩 가진 모종을 예로 들어요. 기능 있는 B 때문에 쓴맛이 나요.",
    "유전자 가위에서 B 사본을 고르고 유전 부호 표로 종결 코돈을 만드는 변화를 찾아보세요.",
    "B의 기능이 없어지고 b만 남으면 쓴맛이 사라져요. 기능 있는 B가 두 개라면 하나만 편집해서는 부족해요.",
  ] };
  if (traits.some((t) => t.seedless)) return { title: '4배체 × 2배체', steps: [
    "정상 감수분열에서 4배체 부모는 2n 배우자, 2배체 부모는 n 배우자를 만들어요.",
    "수정 후 자손은 2n + n = 3n이에요. 게임에서는 씨 없는 3배체로 자라요.",
    '3배체 모종은 출하할 수 있지만 다음 교배의 부모로 남길 수 없습니다.',
  ] };
  if (traits.some((t) => t.species === 'stella')) return { title: '은빛 잎 아비의 X', steps: [
    '초록 잎 암그루의 X에는 l, 은빛 잎 수그루의 X에는 L이 있다고 해 봐요.',
    '딸은 어미의 X와 아비의 X를 받아 Ll이므로 모두 은빛 잎입니다.',
    "아들은 어미의 X와 아비의 Y를 받아 초록 잎이에요. 열매를 맺는 딸 모종을 골라 출하하세요.",
  ] };
  if (traits.some((t) => t.minBrix !== undefined)) return { title: '유전되는 당도와 일시적인 효과', steps: [
    "이 게임의 2배체 당도는 기본값 8에 여섯 자리의 + 대립유전자 수를 더해요.",
    '기본 당도 16 이상에는 +가 8개 이상 필요합니다. 고당도 부모의 자손을 관찰하고 선발하세요.',
    "비료는 이번 출하 당도만 올려요. 다음 세대와 기본 당도 납품 수량에는 더해지지 않아요.",
  ] };
  if (traits.some((t) => t.marked !== undefined)) return { title: '과육색과 껍질 무늬를 함께 보기', steps: [
    '공개된 Rr Ss 부모와 rr ss 부모를 교배하는 예시입니다.',
    "R과 S는 서로 다른 염색체에 있어 네 빛깔 조합이 각각 25%로 기대돼요.",
    "52개체의 실제 수는 꼭 13개씩 나오지 않아요. 원하는 조합을 관찰하고 출하하세요.",
  ] };
  return null;
}

export function projectedDelivery(order: OrderInfo, delivery: Record<string, number>, cards: SeedCard[]): Record<string, number> {
  const projected = { ...delivery };
  for (const goal of order.goals ?? []) {
    projected[goal.id] = Math.min(goal.count, (delivery[goal.id] ?? 0) + cards.filter((card) => goalMatches(card, goal)).length);
  }
  return projected;
}

export function selectedGoalText(order: OrderInfo, delivery: Record<string, number>, cards: SeedCard[]): string {
  const projected = projectedDelivery(order, delivery, cards);
  return (order.goals ?? []).map((goal) => {
    const added = (projected[goal.id] ?? 0) - (delivery[goal.id] ?? 0);
    return `${goal.label} ${Math.min(goal.count, projected[goal.id] ?? 0)}/${goal.count}${added ? ` (+${added})` : ''}`;
  }).join(' · ');
}
