// 볼륨·음소거 저장 (localStorage 키: seed-atelier-2150:audio)

export const STORAGE_KEY = 'seed-atelier-2150:audio';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: Readonly<AudioSettings> = { master: 0.9, music: 0.55, sfx: 0.8, muted: false };

const unit = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

export function loadSettings(): AudioSettings {
  const s: AudioSettings = { ...DEFAULT_SETTINGS };
  try {
    if (typeof localStorage === 'undefined') return s;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return s;
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== 'object') return s;
    const r = o as Record<string, unknown>;
    s.master = unit(r.master, s.master);
    s.music = unit(r.music, s.music);
    s.sfx = unit(r.sfx, s.sfx);
    s.muted = typeof r.muted === 'boolean' ? r.muted : s.muted;
  } catch {
    /* 저장소를 못 쓰는 환경(사생활 보호 모드 등) — 기본값으로 */
  }
  return s;
}

export function saveSettings(s: AudioSettings): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted }),
    );
  } catch {
    /* 저장 실패는 소리와 무관 — 무시 */
  }
}

export { unit as clampUnit };
