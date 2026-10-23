// 이야기 대화창 — 장면 그림 + 인물 초상 + 한 쪽에 한 문장. 「계속」/마지막 쪽 「다음 이야기」, 쪽수 표시.
// 「건너뛰기」와 「대화 기록」은 두 번째 대화부터 나타난다(첫 대화는 끝까지 읽게 한다).
import { characterPortrait } from '../../art';
import { SPEAKERS, type StoryLine } from '../../game/story';
import type { Ctx } from '../ctx';
import { button, h, replaceChildren, setText } from '../h';
import { motion, play } from '../motion';
import { DIALOGUE_UI } from './script';
import { seedTag } from '../dossier';
import { pageDeck } from '../pages';
import { addTalk, talksSeen } from './storage';

export interface DialogueOptions {
  kicker: string;
  title: string;
  lines: StoryLine[];
  endLabel?: string;
  /** 장면 그림 (public/film/*.webp). 불러오지 못하면 그림 없이 표시 */
  art?: string;
  /** 지정하지 않으면 이 기기에서 끝낸 대화 수로 정한다 */
  allowSkip?: boolean;
}

export type DialogueResult = 'done' | 'skipped';

export function openDialogue(ctx: Ctx, opts: DialogueOptions): Promise<DialogueResult> {
  return new Promise((resolve) => {
    const lines = opts.lines.filter((line) => line.text.trim());
    if (!lines.length) { resolve('done'); return; }
    const allowSkip = opts.allowSkip ?? talksSeen() > 0;
    let page = 0;
    let result: DialogueResult = 'done';

    const art = opts.art ? h('img', { class: 'story__art-img', src: opts.art, alt: '', draggable: false }) : null;
    art?.addEventListener('error', () => art.remove());
    const frame = h('div', { class: 'film__frame', 'aria-hidden': 'true' }, ...['tl', 'tr', 'bl', 'br'].map((corner) => h('span', { class: `film__corner film__corner--${corner}` })));
    const frameGrain = h('div', { class: 'film__grain', 'aria-hidden': 'true' });
    const portraitBox = h('div', { class: 'story__portrait', 'aria-hidden': 'true' });
    const speaker = h('div', { class: 'story__speaker' });
    const role = h('span', { class: 'story__role' });
    const text = h('p', { class: 'story__line', 'aria-live': 'polite' });
    const count = h('span', { class: 'story__count', 'aria-label': '' });
    const log = h('div', { class: 'story__log', hidden: true, 'aria-label': DIALOGUE_UI.logTitle });
    const next = button(DIALOGUE_UI.next, () => advance(), { class: 'btn--gold story__next', 'data-autofocus': '' });
    const skip = allowSkip ? button(DIALOGUE_UI.skip, () => { result = 'skipped'; modal.close(); }, { class: 'btn--ghost story__skip' }) : null;
    const logBtn = allowSkip ? button(DIALOGUE_UI.log, () => toggleLog(), { class: 'btn--ghost story__logbtn', 'aria-expanded': 'false' }) : null;
    const bubble = h('div', { class: 'story__bubble' }, h('div', { class: 'story__who' }, speaker, role), text);
    const content = h('div', { class: 'story' },
      frame, frameGrain, h('div', { class: 'story__scene' }, art, h('div', { class: 'story__chapter' }, h('span', null, opts.kicker), h('strong', null, opts.title))),
      h('div', { class: 'story__stage' }, portraitBox, bubble),
      log,
      h('div', { class: 'story__controls' }, count, h('div', { class: 'story__buttons' }, logBtn, skip, next)));

    const modal = ctx.modals.open({
      className: 'modal--story', wide: true, dismissable: false, content,
      onClose: () => {
        if (result === 'done') addTalk();
        resolve(result);
      },
    });
    modal.el.setAttribute('aria-label', `${opts.kicker} · ${opts.title}`);

    const portraitFor = (line: StoryLine): HTMLElement | null => {
      const who = SPEAKERS[line.who];
      if (!who.portrait) return null;
      const el = characterPortrait(who.portrait, 120);
      el.classList.add('story__face');
      return el;
    };

    let shownWho = '';
    const showPage = () => {
      const line = lines[page];
      const who = SPEAKERS[line.who];
      content.dataset.speaker = line.who;
      if (shownWho !== line.who) {
        shownWho = line.who;
        replaceChildren(portraitBox, portraitFor(line));
        portraitBox.hidden = !portraitBox.firstChild;
      }
      replaceChildren(speaker, seedTag(who.name || DIALOGUE_UI.narration, who.role));
      setText(role, who.role);
      role.hidden = true;
      setText(text, line.text);
      setText(count, `${page + 1} / ${lines.length}`);
      count.setAttribute('aria-label', `${lines.length}쪽 중 ${page + 1}쪽`);
      setText(next, page === lines.length - 1 ? opts.endLabel ?? DIALOGUE_UI.last : DIALOGUE_UI.next);
      if (!log.hidden) fillLog();
      if (!motion.reduced) void play(bubble, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 240, decorative: true });
    };
    const fillLog = () => {
      replaceChildren(log, pageDeck(lines.slice(0, page + 1).map((line) => h('div', null,
        h('b', null, SPEAKERS[line.who].name || DIALOGUE_UI.narration), h('p', null, line.text))), DIALOGUE_UI.logTitle));
      log.scrollTop = log.scrollHeight;
    };
    const toggleLog = () => {
      log.hidden = !log.hidden;
      logBtn?.setAttribute('aria-expanded', String(!log.hidden));
      if (logBtn) setText(logBtn, log.hidden ? DIALOGUE_UI.log : DIALOGUE_UI.logClose);
      if (!log.hidden) fillLog();
    };
    const advance = () => {
      if (page < lines.length - 1) { page++; showPage(); return; }
      modal.close();
    };
    showPage();
  });
}
