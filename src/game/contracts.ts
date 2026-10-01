import type { DeliveryGoal, PolicyId } from '../contract/game';

const goal = (id: string, label: string, detail: string, trait: DeliveryGoal['trait'], count = 3): DeliveryGoal => ({ id, label, detail, trait, count });

/** The three contracts revisit previous traits and introduce one new genetics constraint per season. */
export function seasonGoals(ante: number, orderIdx: number, policy: PolicyId): DeliveryGoal[] {
  const ruby = goal('ruby', '루비 과육', '루비 과육 모종을 출하하세요.', { color: 'ruby', bitter: false });
  const gold = goal('gold', '골드 과육', '골드 과육 모종을 출하하세요. 골드는 열성 형질이에요.', { color: 'gold', bitter: false });
  if (ante === 1) return orderIdx === 0 ? [ruby] : orderIdx === 1 ? [gold] : [ruby, gold];
  if (ante === 2) {
    const smooth = goal('smooth-gold', '골드·매끈한 껍질', '두 열성 형질이 함께 나타나는 자손을 골라 출하하세요.', { color: 'gold', marked: false, bitter: false });
    const star = goal('ruby-star', '루비·별무늬', '과육색과 껍질 무늬가 함께 나타나는 자손을 출하하세요.', { color: 'ruby', marked: true, bitter: false });
    return orderIdx === 0 ? [smooth] : orderIdx === 1 ? [star] : [smooth, star];
  }
  if (ante === 3 || ante === 4) {
    const silver = goal('silver-daughter', '은빛 잎 암그루', '별다래 암그루만 납품 수에 들어가요. 아비의 X가 누구에게 가는지 살펴보세요.', { species: 'stella', sex: 'F', marked: true });
    const greenGold = goal('green-gold', '골드·초록 잎 암그루', '골드 과육과 초록 잎을 가진 별다래 암그루를 출하하세요.', { species: 'stella', sex: 'F', color: 'gold', marked: false });
    return orderIdx === 0 ? [silver] : orderIdx === 1 ? [greenGold] : [silver, goal('gold-daughter', '골드 과육 암그루', '골드 과육 별다래 암그루를 함께 출하하세요.', { species: 'stella', sex: 'F', color: 'gold' }, 2)];
  }
  if (ante === 5) {
    const seedless = goal('seedless', '씨 없는 3배체', '4배체와 2배체의 자손을 출하하세요. 불임 모종은 다음 부모로 선발하지 못해요.', { seedless: true, bitter: false });
    return orderIdx === 1 ? [gold] : [seedless];
  }
  if (ante === 6) {
    const sweet = goal('sweet', '기본 당도 16 이상', '비료·가뭄의 보정값을 빼고, 모종 자체의 당도가 16 이상이어야 해요.', { minBrix: 16, bitter: false });
    const normal = goal('normal', '정상 핵형·골드 과육', '염색체 수가 정상인 골드 과육 자손을 골라 출하하세요.', { color: 'gold', euploid: true, bitter: false });
    return orderIdx === 0 ? [sweet] : orderIdx === 1 ? [normal] : [sweet, normal];
  }
  if (ante === 7) {
    if (orderIdx === 0 && policy !== 'heritage') return [goal('knockout', '기능을 없앤 유전자 관찰', 'B 자리의 기능을 없애 쓴맛이 사라진 과실 모종을 1포기 출하하세요. 단순히 글자만 바꾼 편집은 포함되지 않아요.', { knockout: true, bitter: false }, 1)];
    return orderIdx === 1 ? [gold] : [goal('no-bitter', '쓴맛 없는 모종', '쓴맛 B가 기능하지 않는 자손을 출하하세요. 전통 육종팀은 교배와 선발로 해결합니다.', { bitter: false }, 4)];
  }
  const sweetGold = goal('sweet-gold', '기본 당도 16 이상·골드', '앞에서 선발한 당도 형질과 열성 과육색을 한 자손에 모으세요.', { color: 'gold', minBrix: 16, bitter: false });
  return orderIdx === 0 ? [sweetGold] : orderIdx === 1 ? [ruby] : [sweetGold, ruby];
}
