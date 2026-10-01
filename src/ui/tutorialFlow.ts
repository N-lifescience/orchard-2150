import type { RunState } from '../contract/game';

export type TutorialStep =
  | 'order' | 'parents' | 'predict' | 'cross' | 'observe'
  | 'select-cards' | 'ship' | 'collect' | 'keep' | 'shop'
  | 'retry' | 'complete';

/** UI choices are separate from the saved game rules and state. */
export interface TutorialInteraction {
  orderRead?: boolean;
  parentCount: number;
  predicted: boolean;
  observed?: boolean;
  selectedCards: number;
}

export type TutorialTarget =
  | 'order' | 'garden' | 'prediction' | 'cross' | 'observation'
  | 'hand' | 'shipment' | 'cashout' | 'selection' | 'shop' | 'review' | 'none';

export interface TutorialStepInfo {
  number: number;
  total: number;
  title: string;
  body: string;
  target: TutorialTarget;
  /** Only reading and observation steps need a separate acknowledgement. */
  actionLabel?: string;
}

/**
 * The guided run uses quick/heritage/learning and ends after its first contract.
 * Deriving the step from the real phase lets reloads and retries resume safely.
 */
export function inferTutorialStep(state: RunState, interaction: TutorialInteraction): TutorialStep {
  if (state.ante !== 1 || state.orderIdx !== 0 || state.phase === 'victory' || state.phase === 'gameover') return 'complete';
  switch (state.phase) {
    case 'cashout': return 'collect';
    case 'select': return 'keep';
    case 'shop': return 'shop';
    case 'review': return 'retry';
    case 'play':
      if (!interaction.observed) return 'observe';
      return interaction.selectedCards < Math.min(state.maxSelect, state.hand.length) ? 'select-cards' : 'ship';
    case 'cross':
      if (!interaction.orderRead) return 'order';
      if (interaction.parentCount < 2) return 'parents';
      return interaction.predicted ? 'cross' : 'predict';
    case 'title': return 'order';
  }
}

const STEPS: Record<TutorialStep, Omit<TutorialStepInfo, 'total'>> = {
  order: {
    number: 1, title: '첫 주문을 확인해요', target: 'order', actionLabel: '주문 확인했어요',
    body: '이번 주문은 루비 과육 모종 3포기와 목표 점수 300점을 요구해요. 납품 수량과 점수를 모두 채워야 완료돼요.',
  },
  parents: {
    number: 2, title: '부모 두 포기를 골라요', target: 'garden',
    body: '추천 부모는 엘레나 로시의 루비 별과 엘레나 로시의 골드예요. 과육색 유전자형은 각각 RR과 rr이에요. 두 포기를 차례로 눌러요.',
  },
  predict: {
    number: 3, title: '자손의 과육색을 예측해요', target: 'prediction',
    body: '추천 조합인 RR × rr에서는 RR 부모가 R을, rr 부모가 r을 전달해요. 두 대립유전자가 만난 Rr 자손에서 어떤 색이 나타날까요? 고른 부모를 확인하고 예측을 하나 골라요.',
  },
  cross: {
    number: 4, title: '교배해서 예측을 확인해요', target: 'cross',
    body: '교배하기를 누르면 자손 씨앗 52알이 만들어져요. 그중 8포기가 손패에 들어와요.',
  },
  observe: {
    number: 5, title: '예측과 관찰 결과를 비교해요', target: 'observation', actionLabel: '관찰했어요',
    body: '52알 중 루비와 골드가 각각 몇 알인지 확인해요. 부모의 유전자형으로 예상한 결과와 실제 결과가 같은지 살펴보세요.',
  },
  'select-cards': {
    number: 6, title: '함께 출하할 모종 5장을 골라요', target: 'hand',
    body: '모종 카드를 눌러 5장을 골라요. 빛깔과 무늬가 같은 모종을 묶으면 높은 점수를 낼 수 있어요. 고른 카드는 다시 눌러 뺄 수 있어요.',
  },
  ship: {
    number: 7, title: '예상 점수를 확인하고 출하해요', target: 'shipment',
    body: '예상 점수와 루비 과육 납품 수량을 확인한 뒤 출하를 눌러요. 목표 점수를 채워도 필수 형질이 모자라면 계약은 계속돼요.',
  },
  collect: {
    number: 8, title: '첫 계약의 보상을 받아요', target: 'cashout',
    body: '납품 수량과 목표 점수를 모두 채웠어요. 받기를 눌러 보상을 받아요. 남은 출하 횟수도 돈으로 돌려받아요.',
  },
  keep: {
    number: 9, title: '다음 교배에 쓸 모종을 남겨요', target: 'selection',
    body: '이번 교배에서 본 모종을 하나 골라 온실에 들이기를 눌러요. 선발한 모종은 다음 계약의 부모가 될 수 있어요. 지금은 건너뛰어도 괜찮아요.',
  },
  shop: {
    number: 10, title: '공방을 둘러보고 다음 주문으로 가요', target: 'shop',
    body: '비법과 도구의 효과·가격을 살펴보세요. 구매는 선택이에요. 다음 주문을 누르면 튜토리얼이 끝나고 이 과수원에서 계속할 수 있어요.',
  },
  retry: {
    number: 7, title: '이번 주문을 다시 시도해요', target: 'review',
    body: '결과에서 부족했던 점수나 납품 형질을 확인해요. 재도전을 누르면 첫 교배부터 다시 시도할 수 있어요.',
  },
  complete: {
    number: 10, title: '첫 계약을 직접 마쳤어요', target: 'none',
    body: '이 과수원에서 다음 계약을 계속하거나, 모드와 연대기를 골라 새로 시작할 수 있어요. 지금까지 얻은 보상과 선발한 모종은 이 과수원에 남아요.',
  },
};

export function tutorialStep(step: TutorialStep): TutorialStepInfo {
  return { ...STEPS[step], total: 10 };
}
