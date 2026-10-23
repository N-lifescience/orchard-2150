import type { Ctx } from './ctx';
import { button, h, replaceChildren } from './h';
import { chooseFragment, emptyThinking, fillThinkingCell, type Allele } from './learningFlow';
import { traitBadge } from './traitBadge';
/** Learners choose four gamete pieces and explicitly join each square. No autofill. */
export function openThinkingHelper(ctx: Ctx, parents: [string, string]): void {
  let state = emptyThinking();
  const pieces = h('div', { class: 'thinking__pieces' });
  const grid = h('div', { class: 'thinking__grid', role: 'group', 'aria-label': '2×2 조합 칸' });
  const feedback = h('p', { class: 'hint', 'aria-live': 'polite' }, '각 부모의 조각 두 칸을 고른 뒤, 만나는 칸을 눌러 보세요.');
  const draw = () => {
    const focused = document.activeElement?.getAttribute('data-thinking-key');
    replaceChildren(pieces, ...parents.map((geno, parent) => h('section', null,
      h('h3', null, `부모 ${parent + 1}: ${geno}`),
      ...[0, 1].map((i) => h('div', { class: 'thinking__slot', role: 'group', 'aria-label': `부모 ${parent + 1}의 조각 ${i + 1}` },
        h('span', null, `조각 ${i + 1}`), ...(['R', 'r'] as Allele[]).map((allele) => {
          const slot = parent * 2 + i;
          return button(allele, () => {
            const result = chooseFragment(state, parents, slot, allele); state = result.state;
            feedback.textContent = result.reason || '고른 조각끼리 만나는 칸을 눌러 보세요.';
            draw();
          }, { class: 'btn--seg', dataset: { thinkingKey: `piece-${slot}-${allele}` }, 'aria-pressed': String(state.gametes[slot] === allele) });
        }))))));
    replaceChildren(grid, h('span'), ...[2, 3].map((i) => h('strong', null, state.gametes[i] ?? '?')),
      ...[0, 1].flatMap((row) => [h('strong', null, state.gametes[row] ?? '?'), ...[0, 1].map((col) => {
        const index = row * 2 + col;
        const genotype = state.cells[index];
        const b = button(genotype ? h('span', null, genotype, traitBadge({ color: genotype === 'rr' ? 'gold' : 'ruby' }, genotype === 'rr' ? '골드' : '루비', false)) : '짝 맞추기', () => {
          state = fillThinkingCell(state, index); draw();
        }, { class: 'btn--ghost thinking__cell', dataset: { thinkingKey: `cell-${index}` }, 'aria-label': `${row + 1}행 ${col + 1}열 ${genotype ?? '짝 맞추기'}` });
        b.disabled = !state.gametes[row] || !state.gametes[2 + col]; return b;
      })]));
    if (focused) (pieces.querySelector<HTMLElement>(`[data-thinking-key="${focused}"]`) ?? grid.querySelector<HTMLElement>(`[data-thinking-key="${focused}"]`))?.focus({ preventScroll: true });
  };
  draw();
  ctx.modals.open({ title: '생각 도우미', className: 'modal--thinking', content: h('div', { class: 'thinking' }, feedback, pieces, grid) });
}
