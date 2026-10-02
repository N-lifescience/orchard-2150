import type { StorageLike } from '../game';
import { TUTORIAL_INTRO, TUTORIAL_PLAY_TOOLS, type TutorialStep } from './tutorialFlow';

export interface PracticeProgress {
  active: boolean;
  orderRead: boolean;
  observed: boolean;
  completed: boolean;
  /** Optional for compatibility with saved tutorials created before the guided tour. */
  introStep?: number;
  playIntroStep?: number;
}
export const initialPractice = (): PracticeProgress => ({ active: true, orderRead: false, observed: false, completed: false, introStep: 0, playIntroStep: 0 });
export const practiceKey = (saveKey: string): string => `${saveKey}:practice:v1`;
export function acknowledgePractice(progress: PracticeProgress, step: TutorialStep): void {
  const index = TUTORIAL_INTRO.findIndex((item) => item === step);
  if (index >= 0) progress.introStep = index + 1;
  const playIndex = TUTORIAL_PLAY_TOOLS.findIndex((item) => item === step);
  if (playIndex >= 0) progress.playIntroStep = playIndex + 1;
  if (step === 'order') progress.orderRead = true;
  if (step === 'observe') {
    if (!progress.observed && progress.playIntroStep === undefined) progress.playIntroStep = 0;
    progress.observed = true;
  }
}
function store(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
export function loadPractice(saveKey: string, kv: StorageLike | null = store()): PracticeProgress | null {
  try {
    const raw = kv?.getItem(practiceKey(saveKey));
    if (!raw) return null;
    const value = JSON.parse(raw) as PracticeProgress;
    if (!value || ['active', 'orderRead', 'observed', 'completed'].some((key) => typeof value[key as keyof PracticeProgress] !== 'boolean')) return null;
    if (value.introStep !== undefined && (!Number.isInteger(value.introStep) || value.introStep < 0 || value.introStep > TUTORIAL_INTRO.length)) return null;
    if (value.playIntroStep !== undefined && (!Number.isInteger(value.playIntroStep) || value.playIntroStep < 0 || value.playIntroStep > TUTORIAL_PLAY_TOOLS.length)) return null;
    return { active: value.active && !value.completed, orderRead: value.orderRead, observed: value.observed, completed: value.completed, ...(value.introStep === undefined ? {} : { introStep: value.introStep }), ...(value.playIntroStep === undefined ? {} : { playIntroStep: value.playIntroStep }) };
  } catch { return null; }
}
export function savePractice(saveKey: string, value: PracticeProgress, kv: StorageLike | null = store()): void {
  try { kv?.setItem(practiceKey(saveKey), JSON.stringify(value)); } catch { /* The current session still works without storage. */ }
}
