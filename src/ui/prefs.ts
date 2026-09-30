// 화면 설정·브랜드 이름·성찰 한 줄 — 이 기기 브라우저(localStorage)에만 둔다. 서버로 보내지 않는다.
import { SAVE_KEY } from '../game';
import { removeAllRunSlots, SLOTS_KEY, TUTORIAL_KEY } from './runSlots';
import { sanitizeBrand, sanitizeLine } from './fmt';

export const UI_KEY = 'seed-atelier-2150:ui';
export const BRAND_KEY = 'seed-atelier-2150:brand';
export const REFLECT_KEY = 'seed-atelier-2150:reflection';
/** 소리 모듈이 쓰는 키 (src/audio/settings.ts 와 같은 값) */
export const AUDIO_KEY = 'seed-atelier-2150:audio';

/** [모든 기록 지우기] 가 지우는 키 전부 */
export const ALL_KEYS = [SAVE_KEY, SLOTS_KEY, TUTORIAL_KEY, BRAND_KEY, REFLECT_KEY, AUDIO_KEY, UI_KEY] as const;

export type Speed = 1 | 2 | 4;
export interface UiPrefs {
  speed: Speed;
  /** 동작 줄이기 (설정). 시스템의 prefers-reduced-motion 과 OR */
  reduceMotion: boolean;
}

export const DEFAULT_PREFS: Readonly<UiPrefs> = { speed: 1, reduceMotion: false };

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function store(): KV | null {
  try {
    const ls = (globalThis as { localStorage?: KV }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

export function parsePrefs(raw: string | null): UiPrefs {
  const out: UiPrefs = { ...DEFAULT_PREFS };
  if (!raw) return out;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (o && typeof o === 'object') {
      if (o.speed === 1 || o.speed === 2 || o.speed === 4) out.speed = o.speed;
      if (typeof o.reduceMotion === 'boolean') out.reduceMotion = o.reduceMotion;
    }
  } catch {
    /* 깨진 값은 기본값으로 */
  }
  return out;
}

export function loadPrefs(kv: KV | null = store()): UiPrefs {
  try {
    return parsePrefs(kv?.getItem(UI_KEY) ?? null);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: UiPrefs, kv: KV | null = store()): void {
  try {
    kv?.setItem(UI_KEY, JSON.stringify({ speed: p.speed, reduceMotion: p.reduceMotion }));
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function loadBrand(kv: KV | null = store()): string {
  try {
    return sanitizeBrand(kv?.getItem(BRAND_KEY) ?? '');
  } catch {
    return '';
  }
}

export function saveBrand(name: string, kv: KV | null = store()): string {
  const clean = sanitizeBrand(name);
  try {
    if (clean) kv?.setItem(BRAND_KEY, clean);
    else kv?.removeItem(BRAND_KEY);
  } catch {
    /* 무시 */
  }
  return clean;
}

export function loadReflection(kv: KV | null = store()): string {
  try {
    return sanitizeLine(kv?.getItem(REFLECT_KEY) ?? '');
  } catch {
    return '';
  }
}

export function saveReflection(line: string, kv: KV | null = store()): string {
  const clean = sanitizeLine(line);
  try {
    if (clean) kv?.setItem(REFLECT_KEY, clean);
    else kv?.removeItem(REFLECT_KEY);
  } catch {
    /* 무시 */
  }
  return clean;
}

/** 이 게임이 이 기기에 남긴 기록을 전부 지운다 */
export function wipeAll(kv: KV | null = store()): void {
  removeAllRunSlots(kv);
  for (const k of ALL_KEYS) {
    try {
      kv?.removeItem(k);
    } catch {
      /* 무시 */
    }
  }
}
