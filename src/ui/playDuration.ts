import type { PlayStyle, RunMode } from '../contract/game';

/** Planning estimates for reading, decisions and normal animations, excluding breaks. */
const MINUTES: Record<RunMode, Record<PlayStyle, [number, number]>> = {
  full: { learning: [80, 120], challenge: [60, 90] },
  quick: { learning: [40, 60], challenge: [30, 45] },
  'unit-sex': { learning: [20, 30], challenge: [15, 25] },
  'unit-chromo': { learning: [20, 35], challenge: [15, 30] },
  'unit-edit': { learning: [25, 40], challenge: [20, 35] },
};

export function playDuration(mode: RunMode, style: PlayStyle): string {
  const [min, max] = MINUTES[mode][style];
  return `약 ${min}~${max}분`;
}
export const PRACTICE_DURATION = '약 5~8분';
