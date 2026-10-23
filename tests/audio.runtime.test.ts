import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// WebAudio 그래프 경계만 대체한다. 실제 컨트롤러의 비동기 전환, 실패 복구와 예약값을 검사한다.
class Param {
  value = 0;
  private set(value: number, at: number) { expect(Number.isFinite(value)).toBe(true); expect(Number.isFinite(at)).toBe(true); this.value = value; }
  setValueAtTime(v: number, t: number) { this.set(v, t); }
  linearRampToValueAtTime(v: number, t: number) { this.set(v, t); }
  exponentialRampToValueAtTime(v: number, t: number) { expect(v).toBeGreaterThan(0); this.set(v, t); }
  setTargetAtTime(v: number, t: number) { this.set(v, t); }
  cancelScheduledValues() {}
  cancelAndHoldAtTime() {}
}
class AudioNodeStub {
  gain = new Param(); frequency = new Param(); detune = new Param(); Q = new Param(); pan = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param(); delayTime = new Param();
  buffer: ReturnType<Context['createBuffer']> | null = null;
  onended: (() => void) | null = null;
  loop = false; loopStart = 0; loopEnd = 0; type = ''; offset = 0; started = false;
  connect() {} disconnect() {} setPeriodicWave() {}
  start(t: number, offset = 0) { expect(Number.isFinite(t)).toBe(true); expect(Number.isFinite(offset)).toBe(true); this.offset = offset; this.started = true; }
  stop() {}
}
class Context {
  static last: Context;
  currentTime = 0;
  sampleRate = 12000; // 엔진 버퍼 계산만 가볍게 한다. 파일 정보는 decodeAudioData 결과를 따른다.
  state = 'suspended'; destination = new AudioNodeStub(); sources: AudioNodeStub[] = [];
  constructor() { Context.last = this; }
  createGain() { return new AudioNodeStub(); }
  createDynamicsCompressor() { return new AudioNodeStub(); }
  createBiquadFilter() { return new AudioNodeStub(); }
  createConvolver() { return new AudioNodeStub(); }
  createDelay() { return new AudioNodeStub(); }
  createStereoPanner() { return new AudioNodeStub(); }
  createOscillator() { return new AudioNodeStub(); }
  createPeriodicWave() { return {}; }
  createBufferSource() { const n = new AudioNodeStub(); this.sources.push(n); return n; }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const pcm = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / sampleRate, sampleRate, numberOfChannels: channels, getChannelData: (channel: number) => pcm[channel]! };
  }
  async decodeAudioData() { return this.createBuffer(2, 48000 * 60, 48000); }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
}
let visibility: () => void;
let documentStub: { visibilityState: string; addEventListener: (name: string, fn: () => void) => void };
const settle = () => vi.advanceTimersByTimeAsync(1);
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  documentStub = { visibilityState: 'visible', addEventListener: (_name, fn) => { visibility = fn; } };
  vi.stubGlobal('document', documentStub);
  vi.stubGlobal('window', { AudioContext: Context });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('오디오 컨트롤러', () => {
  it('unlock 전에는 요청하지 않고, 30초 연결과 같은 곡 장면 전환을 유지한다', async () => {
    const { audio, audioDebug } = await import('../src/audio');
    audio.music({ scene: 'title', ante: 1, boss: false });
    audio.continueFrom?.(30);
    await settle();
    expect(fetch).not.toHaveBeenCalled();
    audio.unlock(); await settle();
    expect(audioDebug.stats().backend).toBe('file');
    expect(audioDebug.stats().position).toBe(30);
    const ctx = Context.last;
    ctx.currentTime = 2;
    audio.music({ scene: 'end', ante: 7, boss: false }); await settle();
    expect(audioDebug.stats().position).toBe(32);
    expect(ctx.sources.filter(s => s.loop)).toHaveLength(1);
    audio.music({ scene: 'run', ante: 1, boss: false }); await settle();
    ctx.currentTime = 5;
    audio.music({ scene: 'shop', ante: 5, boss: true }); await settle();
    expect(audioDebug.stats().position).toBe(3);
    expect(ctx.sources.filter(s => s.loop)).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('영상 일시 정지와 탭 숨김 뒤에 같은 재생 위치로 복귀한다', async () => {
    const { audio, audioDebug } = await import('../src/audio');
    audio.unlock(); audio.music({ scene: 'run', ante: 1, boss: false }); await settle();
    const ctx = Context.last; ctx.currentTime = 7;
    audio.music(null); await settle();
    ctx.currentTime = 12;
    audio.music({ scene: 'run', ante: 1, boss: false }); await settle();
    expect(audioDebug.stats().position).toBe(7);
    ctx.currentTime = 14;
    documentStub.visibilityState = 'hidden'; visibility();
    expect(audioDebug.stats().backend).toBe('silent');
    expect(ctx.state).toBe('suspended');
    documentStub.visibilityState = 'visible'; visibility(); await settle();
    expect(ctx.state).toBe('running');
    expect(audioDebug.stats().position).toBe(9);
  });
  it.each(['missing', 'decode'] as const)('%s 오류는 실제 합성 배경음으로 이어진다', async error => {
    if (error === 'missing') vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    else vi.spyOn(Context.prototype, 'decodeAudioData').mockRejectedValueOnce(new Error('decode failure'));
    const { audio, audioDebug } = await import('../src/audio');
    audio.unlock(); audio.music({ scene: 'run', ante: 1, boss: false }); await settle();
    expect(audioDebug.stats().backend).toBe('procedural');
    expect(audioDebug.stats().musicSources).toBeGreaterThan(0);
  });
  it('24개 효과음과 비정상 입력의 예약값은 유한하며 동시 발음은 16개 이하다', async () => {
    const { audio, audioDebug } = await import('../src/audio');
    audio.unlock();
    for (const name of audioDebug.sfxNames()) {
      audio.play(name, { step: 999, intensity: 1 });
      Context.last.currentTime += .15;
      audio.play(name, { step: Number.NaN, intensity: Number.POSITIVE_INFINITY });
      expect(audioDebug.stats().voices).toBeLessThanOrEqual(16);
    }
    audio.setMuted(true); audio.play('play');
    expect(audio.muted).toBe(true);
  });
});
