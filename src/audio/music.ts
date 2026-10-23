// 같은 출처 AAC 배경음. 실패하면 기존 절차적 음악으로 대신한다.
// 장면 음색은 1.8초에 걸쳐 바꾸며, 같은 곡은 재시작하지 않는다.
import { type Engine, engine, isHidden, onVisibilityChange } from './engine';
import { sweep } from './instruments';
import * as procedural from './procedural';
import { loadWithFallback, loopPoints, profileFor, TRACKS, wrapPosition, type MusicState, type Track, type TrackId } from './tracks';
import { mtof, setKey } from './theory';

const FADE = 1.8;
type Profile = ReturnType<typeof profileFor>;
type Loaded = Awaited<ReturnType<typeof loadWithFallback<AudioBuffer>>>;
const cache = new Map<TrackId, Promise<Loaded>>();
const assets = new Map<TrackId, { status: 'loading' | 'file' | 'procedural'; duration?: number; sampleRate?: number; channels?: number }>();
const positions = new Map<TrackId, number>();
let desired: MusicState = null;
let current: FileLayer | null = null;
let fallback = false;
let revision = 0;
let pending = false;
let hooked = false;
const fading = new Set<FileLayer>();

/** AAC 변환 후에도 반복 경계의 파형을 잇는다. 시간축과 박자 길이는 바꾸지 않는다. */
function smoothLoop(buffer: AudioBuffer, track: Track): void {
  const { start, end } = loopPoints(track);
  if (buffer.duration < end) throw new Error('audio loop exceeds decoded duration');
  const a = Math.round(start * buffer.sampleRate);
  const b = Math.round(end * buffer.sampleRate);
  const n = Math.round(0.04 * buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const pcm = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const blend = (1 - Math.cos(Math.PI * i / (n - 1))) / 2;
      pcm[b - n + i] = pcm[b - n + i]! * (1 - blend) + pcm[a - n + i]! * blend;
    }
  }
}
function load(e: Engine, track: Track): Promise<Loaded> {
  const existing = cache.get(track.id);
  if (existing) return existing;
  assets.set(track.id, { status: 'loading' });
  const result = loadWithFallback(async () => {
    const abort = new AbortController();
    // 디코딩에도 제한 시간을 두어 손상된 파일 때문에 계속 무음이 되지 않게 한다.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(track.url, { signal: abort.signal });
          if (!response.ok) throw new Error(`audio HTTP ${response.status}`);
          const buffer = await e.ctx.decodeAudioData(await response.arrayBuffer());
          smoothLoop(buffer, track);
          return buffer;
        })(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => { abort.abort(); reject(new Error('audio timeout')); }, 8000); }),
      ]);
    } finally { clearTimeout(timeout); }
  }).then((result) => {
    assets.set(track.id, result.kind === 'file'
      ? { status: 'file', duration: result.value.duration, sampleRate: result.value.sampleRate, channels: result.value.numberOfChannels }
      : { status: 'procedural' });
    return result;
  });
  cache.set(track.id, result);
  return result;
}

class FileLayer {
  readonly source: AudioBufferSourceNode;
  private readonly filter: BiquadFilterNode;
  private readonly out: GainNode;
  private readonly wet: GainNode;
  private readonly pulse: GainNode;
  private readonly pulseSources = new Set<AudioScheduledSourceNode>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private boss = false;
  private stopped = false;
  private dead = false;
  private readonly startedAt: number;
  readonly offset: number;
  constructor(private readonly e: Engine, readonly track: Track, buffer: AudioBuffer, profile: Profile, seconds: number) {
    const ctx = e.ctx;
    const t = ctx.currentTime;
    this.startedAt = t;
    this.offset = wrapPosition(seconds, track);
    this.source = ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    const loop = loopPoints(track);
    this.source.loopStart = loop.start;
    this.source.loopEnd = loop.end;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 0.5;
    this.filter.frequency.value = profile.cutoff;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.wet = ctx.createGain();
    this.wet.gain.value = profile.reverb;
    this.source.connect(this.filter);
    this.filter.connect(this.out);
    this.out.connect(e.musicDry);
    this.out.connect(this.wet);
    this.wet.connect(e.musicWet);
    // 심장 펄스도 같은 페이드 버스를 지나므로 장면 전환 뒤에 남지 않는다.
    this.pulse = ctx.createGain();
    this.pulse.gain.value = 1;
    this.pulse.connect(this.out);
    this.source.start(t, this.offset);
    this.update(profile);
  }
  position(): number { return wrapPosition(this.offset + this.e.ctx.currentTime - this.startedAt, this.track); }
  update(profile: Profile): void {
    const t = this.e.ctx.currentTime;
    for (const [param, value] of [[this.out.gain, profile.level], [this.filter.frequency, profile.cutoff], [this.wet.gain, profile.reverb]] as const) {
      param.cancelAndHoldAtTime(t);
      param.linearRampToValueAtTime(value, t + FADE);
    }
    this.boss = profile.boss;
    if (this.boss && this.timer === null) {
      this.pulse.gain.cancelAndHoldAtTime(t);
      this.pulse.gain.linearRampToValueAtTime(1, t + FADE);
      const beat = 60 / this.track.bpm;
      const pos = this.position();
      const phase = ((pos - this.track.downbeat) % beat + beat) % beat;
      this.nextBeat = t + (beat - phase);
      this.timer = setInterval(() => this.heartbeat(), 100);
      this.heartbeat();
    } else if (!this.boss) this.stopPulse();
  }
  private heartbeat(): void {
    if (!this.boss || this.stopped || isHidden() || this.e.ctx.state !== 'running') return;
    const now = this.e.ctx.currentTime;
    const beat = 60 / this.track.bpm;
    if (this.nextBeat < now) this.nextBeat += Math.ceil((now - this.nextBeat) / beat) * beat;
    const o = {
      ctx: this.e.ctx, dest: this.pulse, noise: this.e.noise, crackle: this.e.crackle,
      track: (source: AudioScheduledSourceNode) => {
        this.pulseSources.add(source);
        source.onended = () => this.pulseSources.delete(source);
      },
    };
    while (this.nextBeat < now + 0.25) {
      const f = mtof(this.track.root - 24);
      sweep(o, this.nextBeat, { f0: f * 1.5, f1: f, dur: 0.16, amp: 0.1, lp: 240 });
      sweep(o, this.nextBeat + beat * 0.28, { f0: f * 1.3, f1: f, dur: 0.12, amp: 0.055, lp: 210 });
      this.nextBeat += beat;
    }
  }
  private stopPulse(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    const t = this.e.ctx.currentTime;
    this.pulse.gain.cancelAndHoldAtTime(t);
    this.pulse.gain.linearRampToValueAtTime(0, t + 0.06);
    for (const source of this.pulseSources) { try { source.stop(t + 0.08); } catch { /* ended */ } }
    this.pulseSources.clear();
  }
  stop(seconds: number): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopPulse();
    const t = this.e.ctx.currentTime;
    this.out.gain.cancelAndHoldAtTime(t);
    this.out.gain.linearRampToValueAtTime(0, t + seconds);
    this.source.stop(t + seconds + 0.01);
    fading.add(this);
    this.source.onended = () => this.dispose();
    // 숨긴 탭에서는 AudioContext 시계가 멈출 수 있으므로 벽시계로도 정리한다.
    setTimeout(() => this.dispose(), (seconds + 0.1) * 1000);
  }
  dispose(): void {
    if (this.dead) return;
    this.dead = true;
    this.stopPulse();
    try { this.source.stop(); } catch { /* ended */ }
    for (const node of [this.source, this.filter, this.out, this.wet, this.pulse]) node.disconnect();
    fading.delete(this);
  }
}
function pause(seconds: number): void {
  if (current) {
    positions.set(current.track.id, current.position());
    current.stop(seconds);
    current = null;
  }
  // 연타해도 사라지는 소스는 둘까지만 유지한다.
  while (fading.size > 2) fading.values().next().value?.dispose();
}
function hookVisibility(): void {
  if (hooked) return;
  hooked = true;
  onVisibilityChange((hidden) => {
    revision++;
    if (hidden) {
      pause(0);
      for (const layer of fading) layer.dispose();
      procedural.setMusic(null);
    } else applyDesiredMusic();
  });
}
export function setMusic(state: MusicState): void {
  desired = state ? { ...state } : null;
  revision++;
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; applyDesiredMusic(); });
}
export function continueFrom(seconds: number): void {
  // 영상 종료 직전, resumeAmbient()보다 먼저 호출한다. null 중에도 기억한다.
  if (current?.track.id === 'fashion-harvest-intro') pause(0.06);
  positions.set('fashion-harvest-intro', wrapPosition(seconds, TRACKS['fashion-harvest-intro']));
  revision++;
  applyDesiredMusic();
}
export function applyDesiredMusic(): void {
  const e = engine();
  if (!e) return; // fetch도 unlock 뒤에만 시작한다.
  hookVisibility();
  if (!desired || isHidden()) {
    pause(0.06);
    procedural.setMusic(null);
    fallback = false;
    return;
  }
  const profile = profileFor(desired);
  if (current?.track.id === profile.track.id) {
    current.update(profile);
    setKey(profile.track);
    return;
  }
  const request = revision;
  void load(e, profile.track).then((loaded) => {
    if (request !== revision || !desired || isHidden()) return;
    // unlock()과 microtask가 겹쳐도 같은 소스를 다시 만들지 않는다.
    if (current?.track.id === profile.track.id) { current.update(profile); return; }
    if (loaded.kind === 'procedural') {
      pause(FADE);
      fallback = true;
      procedural.setMusic(desired);
      return;
    }
    fallback = false;
    procedural.setMusic(null);
    pause(FADE);
    setKey(profile.track);
    try {
      current = new FileLayer(e, profile.track, loaded.value, profile, positions.get(profile.track.id) ?? 0);
    } catch {
      fallback = true;
      procedural.setMusic(desired);
    }
  }).catch(() => {
    if (request !== revision || !desired || isHidden()) return;
    fallback = true;
    procedural.setMusic(desired);
  });
}
export function musicStats() {
  const synth = procedural.musicStats();
  return {
    layers: (current ? 1 : 0) + fading.size + synth.layers,
    musicKey: desired ? `${desired.scene}|${current?.track.id ?? (fallback ? 'procedural' : 'loading')}` : null,
    musicSources: (current ? 1 : 0) + fading.size + synth.musicSources,
    backend: fallback ? 'procedural' : current ? 'file' : 'silent',
    track: current?.track.id ?? null,
    position: current?.position() ?? 0,
    assets: Object.fromEntries(assets),
  };
}
