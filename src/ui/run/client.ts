import { audio } from '../../audio';
import { characterName, characterPortrait } from '../../art';
import type { RunState } from '../../contract/game';
import { briefingKey, clientLines } from '../clientBriefing';
import type { Ctx } from '../ctx';
import { button, h, replaceChildren } from '../h';
import { motion, play } from '../motion';

export class ClientVisit {
  private reading = '';
  private acknowledged = new Set<string>();

  constructor(private ctx: Ctx, private workbench: HTMLElement) {}

  update(s: RunState): void {
    if (s.phase !== 'cross') return;
    const key = briefingKey(s);
    const storageKey = `${this.ctx.game.getSaveKey()}:client-briefing:v1`;
    try { if (localStorage.getItem(storageKey) === key) this.acknowledged.add(key); } catch { /* Session memory is sufficient. */ }
    if (this.acknowledged.has(key) || this.reading === key) return;
    this.reading = key;
    this.workbench.classList.add('is-awaiting-client');
    this.workbench.inert = true;

    const order = s.orders[s.orderIdx];
    const lines = clientLines(order);
    const name = characterName(order.client) ?? order.client.split(' · ')[0];
    const portrait = characterPortrait(order.client, 360);
    portrait.classList.add('client__portrait');
    const heading = h('p', { class: 'client__chapter' });
    const text = h('p', { class: 'client__speech' });
    const details = h('ul', { class: 'client__requirements' });
    const progress = h('span', { class: 'client__progress', 'aria-live': 'polite' });
    let page = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let typing = false;
    const stopTyping = () => { clearInterval(timer); timer = undefined; typing = false; };
    const completeText = () => {
      stopTyping();
      text.textContent = lines[page].text;
      next.textContent = page === lines.length - 1 ? '의뢰 맡기 · 주문서 펼치기' : '다음 대사 →';
    };
    const back = button('← 이전 대사', () => { if (page > 0) { page--; showPage(); } }, { class: 'btn--ghost' });
    const next = button('다음 대사 →', () => {
      if (typing) { completeText(); return; }
      audio.play('select');
      if (page < lines.length - 1) { page++; showPage(); return; }
      this.acknowledged.add(key);
      try { localStorage.setItem(storageKey, key); } catch { /* Continue without persistent acknowledgement. */ }
      modal.close();
      this.ctx.render();
      const target = this.workbench.querySelector<HTMLElement>('.cross__head');
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      this.workbench.querySelector<HTMLElement>('.cross__tools button')?.focus({ preventScroll: true });
      void play(this.workbench.querySelector('.side__order'), [{ opacity: 0, translate: '0 -12px' }, { opacity: 1, translate: '0 0' }], { duration: 420 });
    }, { class: 'btn--gold client__next', 'data-autofocus': '' });
    const scene = h('div', { class: 'client' },
      h('div', { class: 'client__scene', 'aria-hidden': 'true' },
        h('div', { class: 'client__window' }), portrait,
        h('span', { class: 'client__arrival' }, `시즌 ${s.ante} · ${order.name}`)),
      h('div', { class: 'client__dialogue' },
        h('div', { class: 'client__speaker' }, h('h2', null, name), h('span', null, order.client.split(' · ')[1] ?? '온실의 손님')),
        heading, text, details,
        h('div', { class: 'client__controls' }, progress, h('div', { class: 'client__buttons' }, back, next))),
    );
    const modal = this.ctx.modals.open({
      title: '의뢰인이 찾아왔어요', className: 'modal--client', wide: true, dismissable: false, content: scene,
      onClose: () => {
        stopTyping();
        this.reading = '';
        this.workbench.inert = false;
        this.workbench.classList.remove('is-awaiting-client');
      },
    });
    const showPage = () => {
      stopTyping();
      const line = lines[page];
      heading.textContent = line.heading;
      progress.textContent = `${page + 1} / ${lines.length}`;
      back.disabled = page === 0;
      replaceChildren(details, ...(line.details ?? []).map((detail) => h('li', null, detail)));
      details.hidden = !line.details?.length;
      modal.body.scrollTop = 0;
      if (motion.reduced || motion.fast) { completeText(); return; }
      typing = true;
      text.textContent = '';
      next.textContent = '대사 펼치기';
      let length = 0;
      const characters = Array.from(line.text);
      timer = setInterval(() => {
        length += 2;
        text.textContent = characters.slice(0, length).join('');
        if (length >= characters.length) completeText();
      }, 26 / motion.speed);
    };
    showPage();
    void play(portrait, [{ opacity: 0, translate: '70px 0' }, { opacity: 1, translate: '0 0' }], { duration: 780, decorative: true });
    void play(scene.querySelector('.client__dialogue'), [{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }], { duration: 500, delay: 260, decorative: true });
  }
}
