import type { AudioApi } from '../contract/audio';
import { MODES } from './theory';

export type MusicState = Parameters<AudioApi['music']>[0];
export type TrackId = 'fashion-harvest-intro' | 'near-future-harvest';
export interface Track {
  id: TrackId;
  url: string;
  bpm: number;
  /** 추정한 4/4 첫 마디 시작(초). 구간은 원본 시간축을 유지한다. */
  downbeat: number;
  firstBar: number;
  bars: number;
  root: number;
  scale: readonly number[];
  pent: readonly number[];
}
export const TRACKS: Record<TrackId, Track> = {
  'fashion-harvest-intro': {
    id: 'fashion-harvest-intro', url: 'audio/fashion-harvest-intro.m4a', bpm: 127,
    downbeat: 0.2, firstBar: 8, bars: 16,
    root: 52, scale: MODES.aeolian, pent: [0, 2, 5, 7, 10],
  },
  'near-future-harvest': {
    id: 'near-future-harvest', url: 'audio/near-future-harvest.m4a', bpm: 110,
    downbeat: 0.03, firstBar: 4, bars: 16,
    root: 57, scale: MODES.ionian, pent: [0, 2, 4, 7, 9],
  },
};
export function loopPoints(track: Track): { start: number; end: number } {
  const bar = 240 / track.bpm;
  const start = track.downbeat + track.firstBar * bar;
  return { start, end: start + track.bars * bar };
}
/** 첫 재생은 원본 도입부부터, 반복 후에는 선택한 마디 구간 안에서 돈다. */
export function wrapPosition(seconds: number, track: Track): number {
  const { start, end } = loopPoints(track);
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return s < end ? s : start + (s - start) % (end - start);
}
export function profileFor(state: NonNullable<MusicState>) {
  const track = TRACKS[state.scene === 'title' || state.scene === 'end' ? 'fashion-harvest-intro' : 'near-future-harvest'];
  const season = Math.min(3, Math.max(0, Math.floor(((Number.isFinite(state.ante) ? state.ante : 1) - 1) / 2)));
  const boss = state.boss && (state.scene === 'run' || state.scene === 'shop');
  const cutoff = state.scene === 'title' ? 14000 : state.scene === 'shop' ? 12500 : state.scene === 'end' ? 2400 : 6500;
  const level = state.scene === 'title' ? 0.65 : state.scene === 'shop' ? 0.49 : state.scene === 'end' ? 0.3 : 0.43;
  return { track, boss, cutoff: cutoff * [1, 1.08, 0.88, 0.76][season]! * (boss ? 0.48 : 1),
    level: level * [1, 1, 0.96, 0.92][season]!, reverb: state.scene === 'end' ? 0.12 : 0.025 + season * 0.012 };
}
/** 실패는 값으로 돌려 보내며, 호출자가 기존 합성 음악으로 이어 간다. */
export async function loadWithFallback<T>(load: () => Promise<T>): Promise<{ kind: 'file'; value: T } | { kind: 'procedural' }> {
  try { return { kind: 'file', value: await load() }; }
  catch { return { kind: 'procedural' }; }
}
