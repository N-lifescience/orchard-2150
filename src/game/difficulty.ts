import type { Difficulty, PlayStyle, RunMode } from '../contract/game';

/** Missing/invalid values in older saves are derived without changing the run. */
export function inferDifficulty(mode: RunMode, style: PlayStyle = 'challenge', value?: unknown): Difficulty {
  if (value === 'sprout' || value === 'fruit' || value === 'master' || value === 'unit') return value;
  if (style === 'challenge') return 'master';
  if (mode.startsWith('unit-')) return 'unit';
  return mode === 'quick' ? 'sprout' : 'fruit';
}
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  sprout: '새싹 · 쉬움', fruit: '열매 · 보통', master: '명인 · 어려움', unit: '단원 연습',
};
export function difficultyBonus(difficulty: Difficulty): number { return difficulty === 'sprout' ? 1 : 0; }
