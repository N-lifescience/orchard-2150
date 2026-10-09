import type { DeliveryGoal, OrderInfo, SeedCard } from '../contract/game';

/** Delivery counts describe inherited phenotypes, not temporary fertilizer or weather bonuses. */
export function goalMatches(card: SeedCard, goal: DeliveryGoal): boolean {
  const p = card.pheno;
  const t = goal.trait;
  if (card.debuffed || p.sex === 'M') return false;
  if (t.color !== undefined && p.color !== t.color) return false;
  if (t.marked !== undefined && p.marked !== t.marked) return false;
  if (t.species !== undefined && p.species !== t.species) return false;
  if (t.sex !== undefined && p.sex !== t.sex) return false;
  if (t.seedless !== undefined && p.seedless !== t.seedless) return false;
  if (t.bitter !== undefined && p.bitter !== t.bitter) return false;
  if (t.fluorescent !== undefined && p.fluorescent !== t.fluorescent) return false;
  if (t.euploid !== undefined && !p.aneuploid !== t.euploid) return false;
  if (t.minBrix !== undefined && (p.brix === null || p.brix < t.minBrix)) return false;
  if (t.knockout !== undefined) {
    const knockout = Object.values(card.genome.chromosomes).some((copies) => copies.some((copy) => copy.alleles.B?.endsWith('*ko')));
    if (knockout !== t.knockout) return false;
  }
  return true;
}

export function deliveryComplete(order: OrderInfo, delivery: Record<string, number>): boolean {
  return (order.goals ?? []).every((goal) => (delivery[goal.id] ?? 0) >= goal.count);
}

export function deliveryProgressText(order: OrderInfo, delivery: Record<string, number>): string {
  return (order.goals ?? []).map((goal) => `${goal.label} ${Math.min(goal.count, delivery[goal.id] ?? 0)}/${goal.count}`).join(' · ');
}

export function goalHint(goal: DeliveryGoal): string {
  const t = goal.trait;
  if (t.knockout) return '유전자 가위로 B 자리의 기능을 없애 보세요. 기능 있는 B가 남아 있으면 쓴맛은 사라지지 않아요.';
  if (t.seedless) return '4배체와 2배체를 교배하면 게임에서 씨 없는 3배체 모종을 얻어요. 3배체 자체는 다음 교배의 부모가 될 수 없어요.';
  if (t.species === 'stella' && t.marked) return '은빛 잎 수그루의 X는 모든 딸에게 갑니다. 암그루와 은빛 잎 수그루를 골라 보세요.';
  if (t.species === 'stella') return '별다래는 암그루와 수그루가 필요해요. 열매가 있는 암그루 모종을 남기고 수그루는 솎아내세요.';
  if (t.minBrix) return '당도가 높은 자손을 선발해 다음 부모로 남기세요. 비료로 오른 당도는 유전 형질 납품 수에 포함되지 않아요.';
  if (t.color === 'gold') return '골드 과육에는 기능 있는 R이 없어야 해요. 골드 부모의 자가수분이나 r을 가진 부모끼리의 교배를 비교해 보세요.';
  if (t.marked === false) return '루미의 매끈한 껍질은 열성 형질이에요. ss 개체를 부모로 고르면 어떤 자손이 나올지 생각해 보세요.';
  return '부모의 공개된 유전자형을 보고 원하는 형질을 낼 조합을 고르세요. 같은 겉모습이어도 자손 분포는 달라질 수 있어요.';
}

export function countDelivery(order: OrderInfo, before: Record<string, number>, cards: SeedCard[]): Record<string, number> {
  const delivery = { ...before };
  for (const goal of order.goals ?? []) {
    delivery[goal.id] = Math.min(goal.count, (delivery[goal.id] ?? 0) + cards.filter((card) => goalMatches(card, goal)).length);
  }
  return delivery;
}
