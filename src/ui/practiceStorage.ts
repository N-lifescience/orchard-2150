import type { StorageLike } from '../game';

export interface PracticeProgress {
  active: boolean;
  orderRead: boolean;
  observed: boolean;
  completed: boolean;
}
export const initialPractice = (): PracticeProgress => ({ active: true, orderRead: false, observed: false, completed: false });
export const practiceKey = (saveKey: string): string => `${saveKey}:practice:v1`;
function store(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
export function loadPractice(saveKey: string, kv: StorageLike | null = store()): PracticeProgress | null {
  try {
    const raw = kv?.getItem(practiceKey(saveKey));
    if (!raw) return null;
    const value = JSON.parse(raw) as PracticeProgress;
    if (!value || ['active', 'orderRead', 'observed', 'completed'].some((key) => typeof value[key as keyof PracticeProgress] !== 'boolean')) return null;
    return { active: value.active && !value.completed, orderRead: value.orderRead, observed: value.observed, completed: value.completed };
  } catch { return null; }
}
export function savePractice(saveKey: string, value: PracticeProgress, kv: StorageLike | null = store()): void {
  try { kv?.setItem(practiceKey(saveKey), JSON.stringify(value)); } catch { /* The current session still works without storage. */ }
}
