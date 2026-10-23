// 영화 HUD와 같은 재료: 스캐너, 종이 꼬리표, 서랍, 도장, 프린터와 아날로그 신스.
// 음높이는 재생 중인 곡의 음계를 따르고, 노이즈는 엔진의 시드 버퍼를 재사용한다.
import type { Sfx } from '../contract/audio';
import { type Engine, type Out, openVoice } from './engine';
import { drone, fmBell, noiseHit, partial, sweep } from './instruments';
import { clamp, deg, jitter, mtof, pentNote, sfxRoot } from './theory';

interface Call { e: Engine; o: Out; t: number; R: number; step: number; k: number }
interface Recipe { wet: number; level?: number; gap: number; run(c: Call): void }

function paper(o: Out, t: number, amp = 0.1, dur = 0.09): void {
  noiseHit(o, t, { dur, attack: 0.012, amp, type: 'bandpass', freq: [[0, 1500], [dur, 3200]], q: 0.65, buffer: 'crackle' });
  noiseHit(o, t + 0.012, { dur: dur * 0.7, attack: 0.008, amp: amp * 0.32, type: 'bandpass', freq: 2200, q: 0.7 });
}
function tick(o: Out, t: number, f: number, amp = 0.035): void {
  partial(o, t, f, amp, 0.002, 0.03, { type: 'triangle', lp: 2400 });
  noiseHit(o, t, { dur: 0.012, attack: 0.001, amp: amp * 0.5, type: 'bandpass', freq: 1800, q: 0.9 });
}
function pluck(o: Out, t: number, midi: number, amp = 0.12, decay = 0.32): void {
  const f = mtof(midi);
  partial(o, t, f, amp, 0.006, decay, { type: 'triangle', lp: 3200, from: 0.995 });
  partial(o, t, f * 2, amp * 0.17, 0.008, decay * 0.6, { lp: 2800 });
  partial(o, t, f / 2, amp * 0.16, 0.005, decay * 0.55);
}
function stamp(o: Out, t: number, amp = 0.18): void {
  sweep(o, t, { f0: 145, f1: 64, dur: 0.13, amp, lp: 700 });
  noiseHit(o, t, { dur: 0.065, attack: 0.003, amp: amp * 0.65, type: 'lowpass', freq: 950, q: 0.6 });
}
function drawer(o: Out, t: number): void {
  noiseHit(o, t, { dur: 0.12, attack: 0.025, amp: 0.075, type: 'bandpass', freq: [[0, 550], [0.12, 1300]], q: 1.2 });
  partial(o, t + 0.075, 420, 0.04, 0.002, 0.1);
  partial(o, t + 0.075, 683, 0.015, 0.002, 0.065);
}
function scanner(o: Out, t: number, midi: number): void {
  pluck(o, t, midi, 0.08, 0.075);
  pluck(o, t + 0.055, midi + 12, 0.045, 0.065);
}
function bell(o: Out, t: number, midi: number, amp = 0.11): void {
  fmBell(o, t, mtof(midi), amp, { ratio: 2, index0: 0.8, index1: 0.08, decay: 0.65 });
  partial(o, t, mtof(midi - 12), amp * 0.4, 0.008, 0.38);
}
function printer(o: Out, t: number, R: number, count = 9): void {
  paper(o, t, 0.065, count * 0.027);
  for (let i = 0; i < count; i++) tick(o, t + i * 0.027, mtof(R + (i % 2 ? 12 : 7)), 0.027 * (1 - i / (count * 1.5)));
}
function chord(o: Out, t: number, R: number, degrees: number[], amp = 0.07): void {
  degrees.forEach((d, i) => pluck(o, t + i * 0.045, R + 12 + deg(d), amp, 0.75));
}

const RECIPES: Record<Sfx, Recipe> = {
  deal: { wet: 0.025, gap: 0.03, run: ({ o, t }) => paper(o, t) },
  select: { wet: 0.045, gap: 0.04, run: ({ o, t, R }) => scanner(o, t, R + 12 + deg(4)) },
  deselect: { wet: 0.035, gap: 0.04, run({ o, t, R }) { pluck(o, t, R + 24 + deg(2), 0.065, 0.07); pluck(o, t + 0.045, R + 12, 0.055, 0.065); } },
  hover: { wet: 0, gap: 0.06, run: ({ o, t, R }) => tick(o, t, mtof(R + 12), 0.012) },
  play: { wet: 0.06, gap: 0.12, run({ o, t, R }) { drawer(o, t); stamp(o, t + 0.11); pluck(o, t + 0.13, R + 12, 0.085); } },
  discard: { wet: 0.025, gap: 0.08, run({ o, t }) {
    noiseHit(o, t, { dur: 0.055, attack: 0.012, amp: 0.1, type: 'bandpass', freq: [[0, 1800], [0.05, 3900]], q: 1.1 });
    tick(o, t + 0.05, 1450 * jitter(0.025), 0.035); paper(o, t + 0.065, 0.045, 0.06);
  } },
  chip: { wet: 0.07, gap: 0.018, level: 0.85, run({ o, t, R, step }) {
    const i = step - 1; const idx = i <= 9 ? i : 5 + (i - 5) % 5;
    tick(o, t, mtof(R + 7), 0.018); pluck(o, t, pentNote(idx, R + 12), 0.12, 0.2);
  } },
  mult: { wet: 0.13, gap: 0.04, run({ o, t, R, step }) { bell(o, t, pentNote(2 + clamp(step - 1, 0, 6), R + 12)); } },
  xmult: { wet: 0.17, gap: 0.07, level: 0.85, run({ o, t, R, step }) {
    const note = pentNote(3 + clamp(step - 1, 0, 4), R + 12);
    bell(o, t, note, 0.15); pluck(o, t + 0.045, note + 12, 0.055, 0.4); stamp(o, t, 0.08);
    noiseHit(o, t + 0.025, { dur: 0.18, attack: 0.025, amp: 0.025, type: 'bandpass', freq: 3600, q: 0.6, buffer: 'crackle' });
  } },
  jokerTrigger: { wet: 0.1, gap: 0.05, run({ o, t, R }) { tick(o, t, mtof(R + 12), 0.03); pluck(o, t + 0.025, R + 12 + deg(4)); bell(o, t + 0.09, R + 24, 0.075); } },
  scoreTally: { wet: 0.035, gap: 0.12, run: ({ o, t, R, k }) => printer(o, t, R, 9 + Math.round(k * 5)) },
  fire: { wet: 0.14, gap: 0.18, run({ o, t, R }) {
    [0, 2, 4, 5, 7].forEach((d, i) => pluck(o, t + i * 0.055, pentNote(d, R + 12), 0.08, 0.4));
    noiseHit(o, t, { dur: 0.35, attack: 0.13, amp: 0.045, type: 'bandpass', freq: [[0, 600], [0.35, 3600]], q: 0.6 });
  } },
  coin: { wet: 0.055, gap: 0.04, run({ o, t, R }) { tick(o, t, 700, 0.03); bell(o, t, R + 24 + deg(4), 0.065); } },
  buy: { wet: 0.05, gap: 0.12, run({ o, t, R }) { drawer(o, t); scanner(o, t + 0.075, R + 12 + deg(4)); printer(o, t + 0.14, R, 5); } },
  sell: { wet: 0.05, gap: 0.12, run({ o, t, R }) { paper(o, t, 0.09, 0.11); bell(o, t + 0.07, R + 24, 0.075); stamp(o, t + 0.15, 0.09); } },
  reroll: { wet: 0.025, gap: 0.13, run({ o, t, R }) { paper(o, t, 0.085, 0.14); [0, 1, 2].forEach(i => tick(o, t + i * 0.05, mtof(R + 12 + deg(i * 2)), 0.03)); } },
  packOpen: { wet: 0.08, gap: 0.18, run({ o, t, R }) { paper(o, t, 0.15, 0.24); paper(o, t + 0.13, 0.065, 0.12); chord(o, t + 0.18, R, [0, 4, 7], 0.06); } },
  cross: { wet: 0.2, gap: 0.12, run({ o, t, R }) { [0, 2, 4, 5].forEach((d, i) => pluck(o, t + i * 0.075, pentNote(d, R + 12), 0.065, 0.55)); paper(o, t, 0.025, 0.24); } },
  discovery: { wet: 0.16, gap: 0.2, run({ o, t, R }) { paper(o, t, 0.12, 0.22); chord(o, t + 0.16, R, [0, 2, 4, 7], 0.065); bell(o, t + 0.28, R + 24 + deg(4), 0.06); } },
  bossReveal: { wet: 0.15, gap: 0.3, run({ o, t, R }) { drone(o, t, [mtof(R - 24), mtof(R - 12 + deg(4))], 0.1, { attack: 0.16, hold: 0.45, release: 0.74, filter: [[0, 650], [1.35, 350]], spread: 4 }); stamp(o, t + 0.06, 0.1); } },
  gameOver: { wet: 0.14, gap: 0.4, run({ o, t, R }) { [4, 2, 0].forEach((d, i) => pluck(o, t + i * 0.22, R + deg(d), 0.085, 0.8)); paper(o, t + 0.45, 0.05, 0.16); } },
  victory: { wet: 0.2, gap: 0.4, run({ o, t, R }) { [0, 2, 4, 7].forEach((d, i) => pluck(o, t + i * 0.12, R + 12 + deg(d), 0.1, 0.75)); chord(o, t + 0.48, R, [0, 4, 7], 0.065); stamp(o, t + 0.48, 0.09); } },
  error: { wet: 0, gap: 0.14, run({ o, t, R }) { pluck(o, t, R - 12, 0.11, 0.11); pluck(o, t + 0.09, R - 24, 0.085, 0.13); } },
  edit: { wet: 0.015, gap: 0.035, run({ o, t, R, step }) { tick(o, t, mtof(pentNote((step - 1) % 5, R + 12)), 0.045); } },
};
export const SFX_NAMES = Object.keys(RECIPES) as Sfx[];
const lastAt = new Map<Sfx, number>();
export function playSfx(e: Engine, s: Sfx, opts?: { step?: number; intensity?: number }): void {
  const recipe = RECIPES[s];
  if (!recipe) return;
  const now = e.ctx.currentTime;
  const last = lastAt.get(s);
  if (last !== undefined && now >= last && now - last < recipe.gap) return;
  lastAt.set(s, now);
  const k = Number.isFinite(opts?.intensity) ? clamp(opts!.intensity!, 0, 1) : 0.5;
  const step = Number.isFinite(opts?.step) ? Math.max(1, Math.min(999, Math.floor(opts!.step!))) : 1;
  const { out, close } = openVoice(e, recipe.wet, (recipe.level ?? 1) * (0.75 + 0.5 * k));
  try { recipe.run({ e, o: out, t: now + 0.005, R: sfxRoot(), step, k }); }
  finally { close(); }
}
