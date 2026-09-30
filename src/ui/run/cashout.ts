// 정산 (phase 'cashout') — 줄마다 동전이 튀며 합산, [받기]
import { audio } from '../../audio';
import type { RunState } from '../../contract/game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren, setText } from '../h';
import * as fmt from '../fmt';
import { play, wait, rectIn, motion } from '../motion';
import { fx } from '../rng';

export class CashoutView {
  readonly el: HTMLElement;
  private card: HTMLElement;
  private lines: HTMLElement;
  private totalEl: HTMLElement;
  private collectBtn: HTMLButtonElement;
  private head: HTMLElement;
  private shownKey = '';
  private running = false;

  constructor(private ctx: Ctx, private moneyTarget: () => HTMLElement) {
    this.head = h('div', { class: 'cash__head' });
    this.lines = h('ul', { class: 'cash__lines' });
    this.totalEl = h('span', { class: 'num' }, '$0');
    this.collectBtn = button('받기', () => void this.collect(), { class: 'btn--gold btn--big', 'aria-keyshortcuts': 'Enter' });
    this.card = h('div', { class: 'cash panel panel--gold', role: 'region', 'aria-label': '정산' }, this.head, this.lines, h('div', { class: 'cash__total' }, h('span', null, '합계'), this.totalEl), this.collectBtn);
    this.el = h('div', { class: 'view view--cashout' }, this.card);
  }

  update(s: RunState): void {
    const key = `${s.ante}:${s.orderIdx}:${s.roundScore}`;
    if (key === this.shownKey) return;
    this.shownKey = key;
    void this.animateIn(s);
  }

  private async animateIn(s: RunState): Promise<void> {
    this.running = true;
    this.collectBtn.disabled = true;
    const o = s.orders[s.orderIdx];
    replaceChildren(
      this.head,
      h('div', { class: 'cash__kicker' }, `${o.name} 완료`),
      h('div', { class: 'cash__score' }, h('span', { class: 'num' }, fmt.score(s.roundScore)), h('span', { class: 'cash__of' }, ` / 목표 ${fmt.score(o.target)}`)),
    );
    replaceChildren(this.lines);
    setText(this.totalEl, '$0');
    void play(this.card, [{ opacity: 0, translate: '0 60px', scale: '0.95' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 420 });
    await wait(260);
    const lines = this.ctx.game.cashoutLines();
    let total = 0;
    for (const l of lines) {
      const coins = h('span', { class: 'cash__coins', 'aria-hidden': 'true' });
      const li = h('li', { class: 'cash__line' }, h('span', { class: 'cash__label' }, l.label), coins, h('span', { class: 'cash__amt num' }, `+$${l.amount}`));
      this.lines.appendChild(li);
      void play(li, [{ opacity: 0, translate: '-20px 0' }, { opacity: 1, translate: '0 0' }], { duration: 240 });
      for (let i = 0; i < Math.min(l.amount, 8); i++) {
        const c = h('i', { class: 'coin' });
        coins.appendChild(c);
        audio.play('coin', { step: i });
        void play(c, [{ translate: '0 -18px', scale: '0.3', opacity: 0 }, { translate: '0 2px', scale: '1.1', opacity: 1, offset: 0.6 }, { translate: '0 0', scale: '1' }], { duration: 320, easing: 'cubic-bezier(0.3, 1.5, 0.5, 1)', decorative: true });
        await wait(70);
      }
      total += l.amount;
      setText(this.totalEl, `$${total}`);
      await wait(180);
    }
    this.collectBtn.disabled = false;
    this.running = false;
    if (!motion.fast) this.collectBtn.focus({ preventScroll: true });
  }

  async collect(): Promise<void> {
    if (this.running || this.ctx.isBusy() || this.ctx.game.state.phase !== 'cashout') return;
    await this.ctx.lock(async () => {
      audio.play('coin', { step: 6 });
      // 동전이 돈 칸으로 날아간다
      const stageEl = this.ctx.stage;
      const from = rectIn(this.totalEl, stageEl);
      const to = rectIn(this.moneyTarget(), stageEl);
      const jobs: Promise<void>[] = [];
      if (!motion.reduced && !motion.fast) {
        for (let i = 0; i < 10; i++) {
          const c = h('i', { class: 'coin coin--fly' });
          c.style.left = `${from.cx + (fx() - 0.5) * 40}px`;
          c.style.top = `${from.cy + (fx() - 0.5) * 20}px`;
          stageEl.appendChild(c);
          jobs.push(play(c, [{ translate: '0 0', opacity: 1 }, { translate: `${to.cx - from.cx}px ${to.cy - from.cy}px`, opacity: 0.6, scale: '0.6' }], { duration: 520, delay: i * 35, easing: 'cubic-bezier(0.5, 0, 0.5, 1)' }).then(() => c.remove()));
        }
      }
      this.ctx.game.collect();
      await Promise.all(jobs);
    });
  }
}
