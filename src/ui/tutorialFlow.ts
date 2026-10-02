import type { RunState } from '../contract/game';

export const TUTORIAL_INTRO = ['welcome', 'limits', 'navigation', 'notebook', 'jokers', 'reagents'] as const;
export type TutorialIntro = typeof TUTORIAL_INTRO[number];
export const TUTORIAL_PLAY_TOOLS = ['pod', 'sort', 'discard'] as const;
export type TutorialStep = TutorialIntro
  | typeof TUTORIAL_PLAY_TOOLS[number]
  | 'order' | 'parent-first' | 'parent-second' | 'predict' | 'cross' | 'observe'
  | 'select-cards' | 'ship' | 'collect' | 'keep' | 'shop' | 'retry' | 'complete';

/** UI choices remain separate from the actual game rules. */
export interface TutorialInteraction {
  introStep?: number;
  orderRead?: boolean;
  parentCount: number;
  predicted: boolean;
  observed?: boolean;
  playIntroStep?: number;
  selectedCards: number;
}
export type TutorialTarget =
  | 'goal' | 'limits' | 'home' | 'notebook' | 'jokers' | 'reagents'
  | 'order' | 'parent-first' | 'parent-second' | 'prediction' | 'cross' | 'observation'
  | 'pod' | 'sort' | 'discard'
  | 'hand' | 'shipment' | 'cashout' | 'selection' | 'shop' | 'review' | 'none';
export interface TutorialStepInfo {
  number: number;
  total: number;
  title: string;
  body: string;
  target: TutorialTarget;
  actionLabel?: string;
}

/** The guide follows real game phases, including reloads and retries. */
export function inferTutorialStep(state: RunState, interaction: TutorialInteraction): TutorialStep {
  if (state.ante !== 1 || state.orderIdx !== 0 || state.phase === 'victory' || state.phase === 'gameover') return 'complete';
  switch (state.phase) {
    case 'cashout': return 'collect';
    case 'select': return 'keep';
    case 'shop': return 'shop';
    case 'review': return 'retry';
    case 'play': {
      if (!interaction.observed) return 'observe';
      const intro = interaction.playIntroStep ?? TUTORIAL_PLAY_TOOLS.length;
      if (intro < TUTORIAL_PLAY_TOOLS.length) return TUTORIAL_PLAY_TOOLS[Math.max(0, Math.floor(intro))];
      return interaction.selectedCards < Math.min(state.maxSelect, state.hand.length) ? 'select-cards' : 'ship';
    }
    case 'cross': {
      const intro = interaction.introStep ?? (interaction.orderRead ? TUTORIAL_INTRO.length : 0);
      if (intro < TUTORIAL_INTRO.length) return TUTORIAL_INTRO[Math.max(0, Math.floor(intro))];
      if (!interaction.orderRead) return 'order';
      if (interaction.parentCount === 0) return 'parent-first';
      if (interaction.parentCount === 1) return 'parent-second';
      return interaction.predicted ? 'cross' : 'predict';
    }
    case 'title': return 'welcome';
  }
}

const STEPS: Record<TutorialStep, Omit<TutorialStepInfo, 'total'>> = {
  welcome: {
    number: 1, title: '어서 와요. 저는 레아예요.', target: 'goal', actionLabel: '좋아요, 시작해요',
    body: '이 과수원을 함께 맡게 됐네요. 원하는 형질의 모종을 만들고, 주문을 차례로 완수하는 게 우리 목표예요. 먼저 빛나는 주문판을 볼까요?',
  },
  limits: {
    number: 2, title: '출하할 기회는 정해져 있어요.', target: 'limits', actionLabel: '다음',
    body: '출하는 고른 모종을 납품하는 횟수예요. 솎아내기는 원하지 않는 카드를 버리고 새로 받는 횟수고요. 출하를 다 쓰기 전에 주문의 두 조건을 채워야 해요. 튜토리얼에서는 실패해도 다시 시도할 수 있어요.',
  },
  navigation: {
    number: 3, title: '쉬고 싶으면 여기로 돌아가요.', target: 'home', actionLabel: '계속할게요',
    body: '홈을 누르면 지금까지의 진행을 저장하고 첫 화면으로 돌아가요. 나중에 이 과수원을 골라 이어 할 수 있어요. 지금은 저와 첫 주문을 마쳐 볼까요?',
  },
  notebook: {
    number: 4, title: '궁금한 건 연구 노트에 모아요.', target: 'notebook', actionLabel: '알겠어요',
    body: '연구 노트에는 발견한 유전 원리와 교배 기록이 쌓여요. 버튼을 눌러 살펴봐도 좋아요. 노트를 닫으면 이 안내로 돌아올게요.',
  },
  jokers: {
    number: 5, title: '비법은 출하할 때 힘을 보태요.', target: 'jokers', actionLabel: '다음',
    body: '장인의 비법은 가지고 있는 동안 효과를 내는 카드예요. 조건에 맞는 모종을 출하하면 칩이나 배수가 올라가죠. 지금은 빈 칸이고, 첫 주문을 마치면 상점에서 구할 수 있어요.',
  },
  reagents: {
    number: 6, title: '시약은 필요할 때 직접 써요.', target: 'reagents', actionLabel: '첫 주문을 볼게요',
    body: '연구 시약은 유전자 검사나 형질 변화에 쓰는 일회용 도구예요. 가진 시약을 누르면 효과와 사용할 대상을 고를 수 있어요. 이번에는 부모를 교배하는 것부터 해 봐요.',
  },
  order: {
    number: 7, title: '루비 모종과 점수를 함께 채워요.', target: 'order', actionLabel: '부모를 고를게요',
    body: '첫 주문은 쓴맛 없는 루비 과육 모종 3포기와 300점이에요. 모종 수만 채워도, 점수만 채워도 부족해요. 두 조건을 모두 채우면 보상을 받아요.',
  },
  'parent-first': {
    number: 8, title: '먼저 루비 부모를 눌러 주세요.', target: 'parent-first',
    body: '빛나는 엘레나 로시의 루비 별을 골라요. 과육색 유전자형은 RR이에요. 자손에게 R을 하나씩 전달하죠.',
  },
  'parent-second': {
    number: 9, title: '이번에는 골드 부모를 골라요.', target: 'parent-second',
    body: '엘레나 로시의 골드는 rr이에요. 이 부모는 자손에게 r을 전달해요. 두 부모를 교배하면 자손은 R과 r을 하나씩 받아요.',
  },
  predict: {
    number: 10, title: 'Rr 자손은 무슨 색일까요?', target: 'prediction',
    body: 'R이 하나라도 있으면 루비 과육이 돼요. RR과 rr을 교배한 자손은 모두 Rr이죠. 빛나는 세 버튼 중 예상에 맞는 것을 골라 보세요.',
  },
  cross: {
    number: 11, title: '이제 직접 교배해 볼까요?', target: 'cross',
    body: '교배하기를 눌러 주세요. 자손 씨앗 52알을 만들고, 그중 8포기를 손패로 받아요. 우리가 한 예측이 맞는지 곧 확인할 수 있어요.',
  },
  observe: {
    number: 12, title: '예측과 관찰을 비교해 봐요.', target: 'observation', actionLabel: '결과 확인했어요',
    body: '루비와 골드가 각각 몇 알인지 보이나요? 이번 RR × rr 교배에서는 모든 자손이 Rr이라 루비 과육이에요. 다음에는 다른 부모로 결과가 달라지는지도 살펴봐요.',
  },
  pod: {
    number: 13, title: '남은 씨앗도 살펴볼 수 있어요.', target: 'pod', actionLabel: '다음',
    body: '꼬투리에는 아직 손패로 받지 않은 씨앗이 들어 있어요. 이 버튼을 누르면 남은 모종의 빛깔과 무늬 분포를 볼 수 있죠. 출하하거나 솎아내면 여기서 새 모종을 받습니다.',
  },
  sort: {
    number: 14, title: '카드를 보기 편한 순서로 놓아요.', target: 'sort', actionLabel: '다음',
    body: '당도는 높은 순서, 빛깔은 같은 과육색과 무늬끼리 모아 줘요. 버튼을 눌러 비교해 보세요. 정렬은 출하 횟수를 쓰지 않고, 카드의 형질도 바꾸지 않아요.',
  },
  discard: {
    number: 15, title: '필요 없는 모종은 바꿀 수 있어요.', target: 'discard', actionLabel: '카드를 골라 볼게요',
    body: '모종을 고른 뒤 솎아내기를 누르면 그 카드를 버리고 새로 받습니다. 한 번에 최대 다섯 장을 바꾸며, 남은 솎아내기가 한 번 줄어요. 이번 손패는 주문에 잘 맞으니 그대로 납품해 봐요.',
  },
  'select-cards': {
    number: 16, title: '모종 다섯 장을 함께 내보내요.', target: 'hand',
    body: '빛나는 모종 카드를 한 장씩 눌러 주세요. 같은 빛깔과 무늬를 묶으면 높은 점수를 얻어요. 이번에는 제가 가리키는 다섯 장으로 첫 납품을 해 봐요.',
  },
  ship: {
    number: 17, title: '출하를 눌러 점수를 확인해요.', target: 'shipment',
    body: '고른 다섯 장을 납품할 준비가 됐어요. 출하하면 카드 조합과 비법에 따라 점수를 계산해요. 루비 모종 수와 300점을 모두 채울 수 있을까요?',
  },
  collect: {
    number: 18, title: '첫 주문, 해냈네요!', target: 'cashout',
    body: '납품 수량과 점수를 모두 채웠어요. 받기를 눌러 보상을 챙겨요. 남은 출하 횟수도 돈으로 돌려받을 수 있어요.',
  },
  keep: {
    number: 19, title: '다음 교배에 쓸 모종을 남겨요.', target: 'selection',
    body: '빛나는 모종을 하나 골라 주세요. 좋은 자손을 선발해 부모로 남기면, 다음 주문에서 그 형질을 이어 갈 수 있어요.',
  },
  shop: {
    number: 20, title: '다음 주문으로 이어 가 볼까요?', target: 'shop',
    body: '여기가 상점이에요. 번 돈으로 비법과 시약, 새 품종을 구할 수 있어요. 이번에는 돈을 남겨 두고 다음 주문을 눌러 볼게요.',
  },
  retry: {
    number: 17, title: '부족했던 조건을 보고 다시 해요.', target: 'review',
    body: '점수와 납품 형질 중 무엇이 모자랐는지 확인해요. 재도전을 누르면 첫 교배부터 다시 시도할 수 있어요. 이번에는 부모와 모종 조합을 바꿔 볼까요?',
  },
  complete: {
    number: 20, title: '이제 과수원을 맡겨도 되겠네요.', target: 'none',
    body: '교배하고, 납품하고, 좋은 모종을 남기는 흐름을 모두 해 봤어요. 보상과 모종을 가지고 다음 주문을 이어 하거나, 원하는 모드로 새 과수원을 시작하세요.',
  },
};
export function tutorialStep(step: TutorialStep): TutorialStepInfo { return { ...STEPS[step], total: 20 }; }
