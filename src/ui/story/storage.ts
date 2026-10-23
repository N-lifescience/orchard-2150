// 이야기 진행 표시 — 이 기기 브라우저(localStorage)에만 둔다. 학생 정보는 없다.
import type { StorageLike } from '../../game/game';

/** 소개 영상을 끝까지 보거나 건너뛰었는가 (기기 단위) */
export const INTRO_SEEN_KEY = 'seed-atelier-2150:intro-seen:v1';
/** 끝까지 본 이야기 대화 수 (두 번째 대화부터 「건너뛰기」·「대화 기록」을 보여 준다) */
export const TALKS_KEY = 'seed-atelier-2150:story-talks:v1';
/** 영상 소리 켜짐 (기본 꺼짐, 모든 영상이 함께 쓴다) */
export const FILM_SOUND_KEY = 'seed-atelier-2150:film-sound:v1';
/** 연대기마다 본 장면 목록 */
export const storyKey = (saveKey: string): string => `${saveKey}:story:v1`;

function store(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function introSeen(kv: StorageLike | null = store()): boolean {
  try { return kv?.getItem(INTRO_SEEN_KEY) === '1'; } catch { return false; }
}

export function markIntroSeen(kv: StorageLike | null = store()): void {
  try { kv?.setItem(INTRO_SEEN_KEY, '1'); } catch { /* optional */ }
}

export function talksSeen(kv: StorageLike | null = store()): number {
  try {
    const n = Number(kv?.getItem(TALKS_KEY) ?? 0);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

export function addTalk(kv: StorageLike | null = store()): void {
  try { kv?.setItem(TALKS_KEY, String(Math.min(9999, talksSeen(kv) + 1))); } catch { /* optional */ }
}

export function filmSound(kv: StorageLike | null = store()): boolean {
  try { return kv?.getItem(FILM_SOUND_KEY) === '1'; } catch { return false; }
}

export function setFilmSound(on: boolean, kv: StorageLike | null = store()): void {
  try {
    if (on) kv?.setItem(FILM_SOUND_KEY, '1');
    else kv?.removeItem(FILM_SOUND_KEY);
  } catch { /* optional */ }
}

export function seenBeats(saveKey: string, kv: StorageLike | null = store()): string[] {
  try {
    const raw = kv?.getItem(storyKey(saveKey));
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 64) : [];
  } catch { return []; }
}

export function markBeat(saveKey: string, id: string, kv: StorageLike | null = store()): void {
  try {
    const list = seenBeats(saveKey, kv);
    if (list.includes(id)) return;
    list.push(id);
    kv?.setItem(storyKey(saveKey), JSON.stringify(list));
  } catch { /* the story still plays this session */ }
}
