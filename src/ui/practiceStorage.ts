// 첫 계약 튜토리얼의 진행 표시 — 연대기마다 `{saveKey}:practice:v1` 키에 둔다(키 이름은 예전 그대로).
// 2단계 형식(v: 2)은 실제 조작 두 가지(자손 덱 열기·정렬)만 기억한다. 나머지 단계는 게임 상태에서 다시 계산한다.
// 예전 형식(introStep·playIntroStep 번호)은 버리지 않고 새 단계 목록으로 옮긴다.
import type { StorageLike } from '../game';

export interface PracticeProgress {
  v: 2;
  active: boolean;
  completed: boolean;
  /** 교배 뒤 자손 덱을 열어 보았다 (관찰 단계의 실제 조작) */
  observed: boolean;
  /** 손패를 한 번 정렬했다 (정렬 단계의 실제 조작) */
  sorted: boolean;
}

export const initialPractice = (): PracticeProgress => ({ v: 2, active: true, completed: false, observed: false, sorted: false });
export const practiceKey = (saveKey: string): string => `${saveKey}:practice:v1`;

/** 예전(1형식) 도구 안내 번호: 0 자손 덱 → 1 정렬 → 2 솎아내기 → 3 끝 */
const LEGACY_PLAY_TOOLS = 3;

const asStep = (value: unknown, max: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(0, Math.floor(value)));
};

/**
 * 저장된 값을 2형식으로 바꾼다. 손상된 값(객체가 아니거나 필수 참·거짓 값이 없음)은 null.
 * - 1형식 observed(관찰 확인) + playIntroStep ≥ 1(자손 덱 안내를 지남) → 새 observed
 * - 1형식 playIntroStep ≥ 2(정렬 안내를 지남) → 새 sorted
 * - playIntroStep 이 없던 더 예전 저장은 관찰을 마쳤으면 도구 안내도 마친 것으로 본다
 * - introStep(없앤 소개 6단계)은 옮길 단계가 없어 무시한다. 범위를 벗어난 번호는 버리지 않고 범위 안으로 맞춘다.
 */
export function upgradePractice(raw: unknown): PracticeProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.active !== 'boolean' || typeof value.completed !== 'boolean' || typeof value.observed !== 'boolean') return null;
  const active = value.active && !value.completed;
  if (value.v === 2) {
    return { v: 2, active, completed: value.completed, observed: value.observed, sorted: value.sorted === true };
  }
  if (typeof value.orderRead !== 'boolean') return null;
  const tools = 'playIntroStep' in value ? asStep(value.playIntroStep, LEGACY_PLAY_TOOLS) ?? 0 : undefined;
  const observedOld = value.observed;
  return {
    v: 2, active, completed: value.completed,
    observed: observedOld && (tools === undefined || tools >= 1),
    sorted: observedOld && (tools === undefined || tools >= 2),
  };
}

/** 이 단계의 실제 조작을 기록한다 */
export function recordPractice(progress: PracticeProgress, kind: 'pod' | 'sorted'): boolean {
  if (kind === 'pod' && !progress.observed) { progress.observed = true; return true; }
  if (kind === 'sorted' && progress.observed && !progress.sorted) { progress.sorted = true; return true; }
  return false;
}

function store(): StorageLike | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadPractice(saveKey: string, kv: StorageLike | null = store()): PracticeProgress | null {
  try {
    const raw = kv?.getItem(practiceKey(saveKey));
    if (!raw) return null;
    return upgradePractice(JSON.parse(raw));
  } catch { return null; }
}

export function savePractice(saveKey: string, value: PracticeProgress, kv: StorageLike | null = store()): void {
  try { kv?.setItem(practiceKey(saveKey), JSON.stringify(value)); } catch { /* The current session still works without storage. */ }
}
