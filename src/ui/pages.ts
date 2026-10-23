import { button, h, replaceChildren, setText } from './h';

/** Semantic pages retain every word and expose one page at a time, without scroll boxes. */
export function pageDeck(pages: HTMLElement[], label: string, options: { initialPage?: number; onPage?(index: number): void } = {}): HTMLElement {
  const body = h('div', { class: 'page-deck__body' });
  const count = h('span', { class: 'page-deck__count', 'aria-live': 'polite' });
  let index = options.initialPage ?? 0;
  const previous = button('이전', () => { index--; draw(); }, { class: 'btn--ghost', 'aria-label': `${label} 이전 쪽` });
  const next = button('다음', () => { index++; draw(); }, { class: 'btn--ghost', 'aria-label': `${label} 다음 쪽` });
  const draw = () => {
    const movingFocus = document.activeElement === previous || document.activeElement === next;
    index = Math.max(0, Math.min(index, pages.length - 1));
    replaceChildren(body, pages[index]);
    setText(count, `${index + 1} / ${Math.max(1, pages.length)}`);
    options.onPage?.(index);
    previous.disabled = index === 0; next.disabled = index >= pages.length - 1;
    if (movingFocus && (document.activeElement as HTMLButtonElement)?.disabled) {
      (previous.disabled ? next : previous).focus({ preventScroll: true });
    }
  };
  draw();
  return h('div', { class: 'page-deck', 'aria-label': label }, body,
    pages.length > 1 ? h('nav', { class: 'page-deck__nav', 'aria-label': `${label} 쪽 넘기기` }, previous, count, next) : null);
}
