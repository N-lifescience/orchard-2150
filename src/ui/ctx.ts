// 화면 조각들이 함께 쓰는 문맥 (App 이 구현)
import type { BackgroundHandle } from '../contract/art';
import type { GameImpl } from '../game';
import type { Modals, Tips, Toaster } from './overlay';
import type { UiPrefs } from './prefs';

export interface Ctx {
  readonly game: GameImpl;
  /** 데스크톱 작업대 또는 반응형 작업대 */
  readonly stage: HTMLElement;
  readonly modals: Modals;
  readonly tips: Tips;
  readonly toast: Toaster;
  readonly prefs: UiPrefs;
  bg: BackgroundHandle | null;
  brand: string;
  /** 지금 보이는 화면 */
  readonly screen: 'title' | 'run' | 'end';

  /** 연출 중 입력 잠금 + 다시 그리기 보류. 끝나면 밀린 그리기를 한 번 한다 */
  lock<T>(fn: () => Promise<T>): Promise<T>;
  isBusy(): boolean;
  render(): void;

  /** 화면 전환 */
  goTitle(): void;
  startRun(): void;
  startPractice(): void;

  /** 모달 여는 곳 모음 */
  open: {
    settings(): void;
    tutorial(): void;
    notes(): void;
    teacher(): void;
    greenhouse(): void;
    orders(): void;
    pod(): void;
    reagent(index: number): void;
    joker(uid: string): void;
  };

  /** 설정이 바뀌면 (속도·동작 줄이기) */
  applyPrefs(): void;
}
