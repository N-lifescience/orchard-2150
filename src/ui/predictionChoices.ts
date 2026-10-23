import type { ColorPrediction } from '../contract/game';
import { button, h } from './h';
import { explainImage, traitBadge } from './traitBadge';

/** Every choice uses one bounded trait frame, including the two-image choice. */
export function colorPredictionChoices(onChoose: (value: ColorPrediction) => void): HTMLButtonElement[] {
  return ([['ruby', '루비가 많아요'], ['gold', '골드가 많아요'], ['even', '비슷해요']] as const).map(([value, label]) => {
    const frame = traitBadge({}, label, false);
    if (value !== 'even') frame.dataset.color = value;
    const colors = value === 'even' ? ['ruby', 'gold'] : [value];
    frame.prepend(h('span', { class: 'prediction-choice__images', 'aria-hidden': 'true' },
      ...colors.map((color) => explainImage(`trait-flesh-${color}`))));
    return button(frame, () => onChoose(value), {
      class: 'btn--seg', 'aria-pressed': 'false', 'aria-label': label, dataset: { prediction: value },
    });
  });
}
