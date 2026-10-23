import type { Difficulty } from '../contract/game';
import { DIFFICULTY_LABELS } from '../game/difficulty';
import { h } from './h';

const LEVEL: Record<Difficulty, number> = { sprout: 1, fruit: 2, master: 3, unit: 0 };

/** One visual scale for setup, the running HUD and saved chronicles. */
export function difficultyBadge(difficulty: Difficulty): HTMLElement {
  const level = LEVEL[difficulty];
  return h('span', { class: 'difficulty-mark', dataset: { difficulty }, 'aria-label': DIFFICULTY_LABELS[difficulty] },
    level ? h('span', { class: 'difficulty-bars', 'aria-hidden': 'true' },
      ...[1, 2, 3].map((step) => h('i', { class: ['difficulty-bars__step', step <= level && 'is-active'] }))) : null,
    h('span', { class: 'difficulty-mark__label' }, DIFFICULTY_LABELS[difficulty]));
}
