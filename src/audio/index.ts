// ─────────────────────────────────────────────────────────────
// 소리 — 계약(src/contract/audio.ts)의 구현. WebAudio 합성만 쓴다(외부 음원·네트워크 없음).
//  - unlock() 전: play() 는 조용히 무시. music() 은 원하는 상태만 기억했다가 unlock 때 시작.
//  - 볼륨·음소거는 localStorage 'seed-atelier-2150:audio' 에 저장·복원.
//  - 탭이 숨으면 배경음을 0으로 내리고 예약도 멈춘다(돌아오면 새 코드부터).
// ─────────────────────────────────────────────────────────────
import type { AudioApi, Sfx } from '../contract/audio';
import { activeVoices, applyGains, engine, ensureEngine, resumeContext, settings } from './engine';
import { applyDesiredMusic, musicStats, setMusic } from './music';
import { clampUnit, saveSettings } from './settings';
import { SFX_NAMES, playSfx } from './sfx';

let warned = false;
function report(err: unknown): void {
  // 소리 문제로 게임이 멈추면 안 된다 — 개발 중엔 에러로 크게, 배포본에선 한 번만 경고
  if (import.meta.env?.DEV) console.error('[audio]', err);
  else if (!warned) {
    warned = true;
    console.warn('[audio] 소리 합성 중 문제가 생겨 건너뛰어요.', err);
  }
}

export const audio: AudioApi = {
  unlock(): void {
    try {
      const fresh = engine() === null;
      const e = ensureEngine();
      if (!e) return;
      resumeContext();
      if (fresh) applyDesiredMusic();
    } catch (err) {
      report(err);
    }
  },

  play(s: Sfx, opts?: { step?: number; intensity?: number }): void {
    const e = engine();
    if (!e || settings.muted || e.ctx.state !== 'running') return;
    try {
      playSfx(e, s, opts);
    } catch (err) {
      report(err);
    }
  },

  music(state): void {
    try {
      setMusic(state);
    } catch (err) {
      report(err);
    }
  },

  setVolume(master: number, music: number, sfx: number): void {
    settings.master = clampUnit(master, settings.master);
    settings.music = clampUnit(music, settings.music);
    settings.sfx = clampUnit(sfx, settings.sfx);
    saveSettings(settings);
    try {
      applyGains(false);
    } catch (err) {
      report(err);
    }
  },

  setMuted(m: boolean): void {
    settings.muted = !!m;
    saveSettings(settings);
    try {
      applyGains(false);
    } catch (err) {
      report(err);
    }
  },

  get muted(): boolean {
    return settings.muted;
  },
};

/** 시험대·디버그용(계약 밖). 게임 코드는 쓰지 않아도 된다 */
export const audioDebug = {
  sfxNames(): readonly Sfx[] {
    return SFX_NAMES;
  },
  volumes(): { master: number; music: number; sfx: number } {
    return { master: settings.master, music: settings.music, sfx: settings.sfx };
  },
  stats(): { state: string; voices: number; layers: number; musicKey: string | null; musicSources: number } {
    const e = engine();
    return { state: e ? e.ctx.state : 'locked', voices: activeVoices(), ...musicStats() };
  },
};
