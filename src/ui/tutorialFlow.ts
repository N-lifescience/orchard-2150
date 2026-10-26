// 첫 계약 튜토리얼의 단계 — 실제 게임 상태와 실제 조작만 보고 정한다(읽기 확인 단추로 넘어가는 단계 없음).
// 예전의 앞쪽 소개 6단계(환영·출하 한도·홈·연구 노트·비법·시약)는 없애고, 그 요소가 처음 쓰이는 단계에서 한 줄씩 소개한다.
// 대사는 src/ui/story/script.ts 의 TUTORIAL_SCRIPT.
import type { PlayStyle, RunState } from '../contract/game';
import { TUTORIAL_SCRIPT, type CoachLine, type CoachTarget } from './story/script';

/** 단계 막대에 표시하는 순서 (retry 는 출하 단계와 같은 자리) */
export const TUTORIAL_ORDER = [
  'parent-first', 'parent-second', 'predict', 'cross', 'observe', 'sort',
  'select-cards', 'ship', 'collect', 'keep', 'shop', 'complete',
] as const;
export type TutorialStep = typeof TUTORIAL_ORDER[number] | 'retry';
export const TUTORIAL_TOTAL = TUTORIAL_ORDER.length;

/** UI choices remain separate from the actual game rules. */
export interface TutorialInteraction {
  parentCount: number;
  predicted: boolean;
  /** 교배 뒤 자손 덱(꼬투리)을 실제로 열어 보았는가 */
  observed?: boolean;
  /** 손패 정렬 단추를 실제로 눌렀는가 */
  sorted?: boolean;
  selectedCards: number;
}
export type TutorialTarget = CoachTarget;

export interface TutorialStepInfo {
  number: number;
  total: number;
  label: string;
  /** 실제 조작 위치 */
  target: TutorialTarget;
  /** 한 번에 한 문장 */
  lines: readonly CoachLine[];
}

/** The guide follows real game phases, including reloads and retries. */
export function inferTutorialStep(state: RunState, interaction: TutorialInteraction): TutorialStep {
  if (state.ante !== 1 || state.orderIdx !== 0 || state.phase === 'victory' || state.phase === 'gameover') return 'complete';
  switch (state.phase) {
    case 'cashout': return 'collect';
    case 'select': return 'keep';
    case 'shop': return 'shop';
    case 'review': return 'retry';
    case 'play':
      if (!interaction.observed) return 'observe';
      if (!interaction.sorted) return 'sort';
      return interaction.selectedCards < Math.min(state.maxSelect, state.hand.length) ? 'select-cards' : 'ship';
    case 'cross':
      if (interaction.parentCount === 0) return 'parent-first';
      if (interaction.parentCount === 1) return 'parent-second';
      return interaction.predicted ? 'cross' : 'predict';
    case 'title': return 'parent-first';
  }
}

export function tutorialStep(step: TutorialStep, playStyle: PlayStyle = 'learning'): TutorialStepInfo {
  const script = TUTORIAL_SCRIPT[step];
  const index = step === 'retry' ? TUTORIAL_ORDER.indexOf('ship') : TUTORIAL_ORDER.indexOf(step);
  const lines: readonly CoachLine[] = step === 'parent-first' && playStyle === 'challenge'
    ? [{ text: '루비 과육 3개체와 300점을 채워요.', target: 'goal' }, ...script.lines.slice(2)]
    : script.lines;
  return { number: index + 1, total: TUTORIAL_TOTAL, label: script.label, target: script.target, lines };
}
