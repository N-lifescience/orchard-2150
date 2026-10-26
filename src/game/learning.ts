import { locusAlleles } from './prediction';
import type { DeliveryGoal, OrderInfo, Plant, SeedCard } from '../contract/game';

/** Delivery counts describe inherited phenotypes, not temporary fertilizer or weather bonuses. */
export function goalMatches(card: SeedCard, goal: DeliveryGoal): boolean {
  const p = card.pheno;
  const t = goal.trait;
  if (card.debuffed || p.sex === 'M') return false;
  if (t.ploidy !== undefined && p.ploidy !== t.ploidy) return false;
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
  if (goal.id === 'unit-daughters') return '어미가 아들에게 주는 X와 아비가 딸에게 주는 X를 따로 살펴보세요. 목표는 정상 감수분열의 기대 분포예요.';
  if (goal.id === 'unit-ploidy') return '각 부모의 염색체 조 수를 반으로 나눈 뒤 더해 보세요. 과육색도 모든 자손에서 목표 색이 나올 조합인지 확인하세요.';
  if (t.knockout) return '유전자 가위로 B 자리의 기능을 없애 보세요. 기능 있는 B가 남아 있으면 쓴맛은 사라지지 않아요.';
  if (t.seedless) return '4배체와 2배체를 교배하면 게임에서 씨 없는 3배체 모종을 얻어요. 3배체는 다음 교배의 부모가 될 수 없어요.';
  if (t.species === 'stella' && t.marked) return '은빛 잎 수그루의 X는 모든 딸에게 가요. 암그루와 은빛 잎 수그루를 골라 보세요.';
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

export function crossRequirementText(order: Pick<OrderInfo, 'crossRequirement'>): string {
  const q = order.crossRequirement;
  if (!q) return '';
  if (q.kind === 'sex-linked') return `기대 분포: 딸은 모두 ${q.daughtersMarked ? '은빛' : '초록'} 잎, 아들은 모두 ${q.sonsMarked ? '은빛' : '초록'} 잎`;
  return `정상 감수분열의 기대 분포: 모두 ${q.color === 'gold' ? '골드' : '루비'} 과육 ${q.ploidy}배체`;
}

/** 부모 유전자형으로 판정하므로 표본의 우연한 치우침은 합격에 영향을 주지 않는다. */
export function meetsCrossRequirement(order: Pick<OrderInfo, 'crossRequirement'>, a: Plant, b: Plant): boolean {
  const q = order.crossRequirement;
  if (!q) return true;
  if (a.genome.species !== b.genome.species || [a, b].some(p => p.pheno.aneuploid || Object.values(p.genome.chromosomes).some(cs => cs.some(c => Object.keys(c.seqs ?? {}).length)))) return false;
  if (q.kind === 'sex-linked') {
    const mother = [a, b].find(p => p.pheno.sex === 'F');
    const father = [a, b].find(p => p.pheno.sex === 'M');
    if (!mother || !father || a.genome.ploidy !== 2 || b.genome.ploidy !== 2) return false;
    const maternal = locusAlleles(mother, 'L').filter(x => x === 'L').length / 2;
    const paternal = locusAlleles(father, 'L').includes('L');
    return (paternal ? 1 : maternal) === q.daughtersMarked && maternal === q.sonsMarked;
  }
  if (a.genome.species !== 'lumi' || ![2, 4].includes(a.genome.ploidy) || ![2, 4].includes(b.genome.ploidy) || (a.genome.ploidy + b.genome.ploidy) / 2 !== q.ploidy) return false;
  // A normal gamete receives half the homologs, sampled without replacement.
  // RRRr (4n) also guarantees a dominant R in each 2n gamete.
  const noR = (p: Plant): number | null => {
    const alleles = locusAlleles(p, 'R');
    if (alleles.length !== p.genome.ploidy || alleles.some(x => x !== 'R' && x !== 'r')) return null;
    const recessive = alleles.filter(x => x === 'r').length;
    let probability = 1;
    for (let i = 0; i < p.genome.ploidy / 2; i++) probability *= Math.max(0, recessive - i) / (p.genome.ploidy - i);
    return probability;
  };
  const pa = noR(a), pb = noR(b);
  if (pa === null || pb === null) return false;
  const gold = pa * pb;
  return q.color === 'gold' ? gold === 1 : gold === 0;
}
