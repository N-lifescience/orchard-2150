// 결말 — 승리: 박람회 장면 → 금고 맨 아래 칸 → 엘레나의 편지 → (인수 제안 답장) → 기존 결과 화면.
// 도전 모드 실패: 설계서의 짧은 한 줄 → 기존 결과 화면.
import type { RunState } from '../../contract/game';
import { CHALLENGE_FAILURE, ENDING, SCENES, sawOffer } from '../../game/story';
import type { Ctx } from '../ctx';
import { button, h } from '../h';
import { play } from '../motion';
import { openDialogue } from './dialogue';
import { filmOptions, withFilm } from './host';
import { FILM } from './media';
import { DIALOGUE_UI } from './script';
import { playScene } from './scene';

export function openLetter(ctx: Ctx): Promise<void> {
  return new Promise((resolve) => {
    const art = h('img', { class: 'letter__art', src: FILM.ending, alt: '', draggable: false });
    art.addEventListener('error', () => art.remove());
    const paper = h('article', { class: 'letter__paper' },
      h('h2', { class: 'letter__title' }, ENDING.letterTitle),
      ...ENDING.letter.map((line) => h('p', null, line)),
      h('p', { class: 'letter__sign' }, ENDING.signature));
    const m = ctx.modals.open({
      className: 'modal--letter', wide: true, dismissable: false,
      content: h('div', { class: 'letter' }, art, paper),
      actions: button(DIALOGUE_UI.next, () => m.close(), { class: 'btn--gold', 'data-autofocus': '' }),
      onClose: () => resolve(),
    });
    m.el.setAttribute('aria-label', ENDING.letterTitle);
  });
}

export async function playVictory(ctx: Ctx, s: RunState): Promise<void> {
  await withFilm(ctx, () => playScene(SCENES.expo, filmOptions(ctx)));
  await openDialogue(ctx, { kicker: ENDING.kicker, title: ENDING.drawerTitle, lines: ENDING.drawer, art: FILM.ending, endLabel: ENDING.openLetter });
  await openLetter(ctx);
  const after = sawOffer(s.mode) ? [ENDING.offerReply, ENDING.closing] : [ENDING.closing];
  await openDialogue(ctx, { kicker: ENDING.kicker, title: ENDING.closingTitle, lines: after, art: FILM.ending, endLabel: ENDING.toResults });
}

export function playFailure(): Promise<void> {
  return new Promise((resolve) => {
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const next = h('button', { type: 'button', class: 'film__btn film__next' }, CHALLENGE_FAILURE.action);
    const root = h('div', { class: 'epilogue', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'epilogue-line', tabindex: '-1' },
      h('div', { class: 'film__grain', 'aria-hidden': 'true' }),
      h('div', { class: 'epilogue__body' },
        h('p', { class: 'epilogue__line', id: 'epilogue-line' }, CHALLENGE_FAILURE.line),
        h('p', { class: 'epilogue__sub' }, CHALLENGE_FAILURE.sub),
        next));
    document.body.dataset.story = 'on';
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      window.removeEventListener('keydown', onKey, true);
      void play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 360 }).then(() => {
        root.remove();
        delete document.body.dataset.story;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        resolve();
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Tab') { e.preventDefault(); next.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    next.addEventListener('click', close);
    document.body.appendChild(root);
    next.focus({ preventScroll: true });
    void play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
  });
}
