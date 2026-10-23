import { describe, expect, it } from 'vitest';
import { TRACKS, loadWithFallback, loopPoints, profileFor, wrapPosition } from '../src/audio/tracks';
import { SFX_NAMES } from '../src/audio/sfx';

const state = (scene: 'title' | 'run' | 'shop' | 'end', ante = 1, boss = false) => ({ scene, ante, boss });
describe('음악 배정과 반복 구간', () => {
  it.each(['title', 'end'] as const)('%s는 영상과 같은 곡을 쓴다', scene => {
    expect(profileFor(state(scene)).track.id).toBe('fashion-harvest-intro');
  });
  it.each(['run', 'shop'] as const)('%s는 형제 곡을 쓴다', scene => {
    expect(profileFor(state(scene)).track.id).toBe('near-future-harvest');
  });
  it('계절과 특별 계약은 곡과 템포를 바꾸지 않고 음색만 바꾼다', () => {
    for (const ante of [1, 3, 5, 7, 9, Number.NaN]) {
      const run = profileFor(state('run', ante, true));
      expect(run.track).toBe(TRACKS['near-future-harvest']);
      expect(run.cutoff).toBeLessThan(profileFor(state('run', ante)).cutoff);
      expect(run.boss).toBe(true);
      expect(profileFor(state('title', ante, true)).boss).toBe(false);
    }
    expect(profileFor(state('shop')).cutoff).toBeGreaterThan(profileFor(state('run')).cutoff);
    expect(profileFor(state('end')).level).toBeLessThan(profileFor(state('title')).level);
  });
  it.each(Object.values(TRACKS))('$id의 시작과 끝은 같은 4/4 마디 격자에 있다', track => {
    const { start, end } = loopPoints(track);
    const bar = 240 / track.bpm;
    expect((start - track.downbeat) / bar).toBeCloseTo(track.firstBar, 8);
    expect((end - track.downbeat) / bar).toBeCloseTo(track.firstBar + track.bars, 8);
    expect((end - start) / bar).toBeCloseTo(16, 8);
    expect(track.url.startsWith('audio/')).toBe(true);
    expect(track.pent.every(note => track.scale.includes(note))).toBe(true);
  });
  it('영상 30초 지점을 그대로 잇고 반복 후 재생 위치를 보존한다', () => {
    const track = TRACKS['fashion-harvest-intro'];
    const { start, end } = loopPoints(track);
    expect(wrapPosition(30, track)).toBe(30);
    expect(wrapPosition(end, track)).toBeCloseTo(start);
    expect(wrapPosition(end + 3.25, track)).toBeCloseTo(start + 3.25);
    expect(wrapPosition(-1, track)).toBe(0);
    expect(wrapPosition(Number.NaN, track)).toBe(0);
  });
});
describe('음원 실패 복구', () => {
  it('성공한 디코딩 결과를 쓴다', async () => {
    const value = { duration: 45.7, sampleRate: 48000 };
    expect(await loadWithFallback(async () => value)).toEqual({ kind: 'file', value });
  });
  it.each(['HTTP 404', 'offline', 'decode failure'])('%s는 예외 대신 합성 배경음 선택을 돌려준다', async reason => {
    const result = await loadWithFallback(async () => { throw new Error(reason); });
    expect(result).toEqual({ kind: 'procedural' });
  });
  it('효과음 API 이름 24개를 유지한다', () => {
    expect(SFX_NAMES).toHaveLength(24);
    expect(new Set(SFX_NAMES).size).toBe(24);
  });
});
