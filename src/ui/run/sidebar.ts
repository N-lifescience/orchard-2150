// 왼쪽 패널 — 주문 휘장·목표·이번 주문 점수·족보·칩×배수·출하/솎아내기·돈·시즌 진행·메뉴
import { audio } from '../../audio';
import { bossEmblem, orderEmblem } from '../../art';
import type { RunState } from '../../contract/game';
import type { Ctx } from '../ctx';
import { button, h, replaceChildren, setText } from '../h';
import * as fmt from '../fmt';
import { play, roll, motion } from '../motion';
import { fx, between } from '../rng';

export class Sidebar {
  readonly el: HTMLElement;
  private brandEl: HTMLElement;
  private orderBox: HTMLElement;
  private emblemBox: HTMLElement;
  private orderName: HTMLElement;
  private orderClient: HTMLElement;
  private bossRule: HTMLElement;
  private targetEl: HTMLElement;
  private rewardEl: HTMLElement;
  readonly roundBox: HTMLElement;
  readonly roundEl: HTMLElement;
  private flames: HTMLElement;
  readonly handName: HTMLElement;
  private handLevel: HTMLElement;
  readonly chipsBox: HTMLElement;
  readonly multBox: HTMLElement;
  readonly chipsEl: HTMLElement;
  readonly multEl: HTMLElement;
  private handsEl: HTMLElement;
  private discardsEl: HTMLElement;
  readonly moneyEl: HTMLElement;
  private seasonEl: HTMLElement;
  private dots: HTMLElement;
  private orderKey = '';
  /** 점수 연출 중이면 update 가 칩·배수·점수를 덮지 않는다 */
  scoring = false;
  private shownChips = 0;
  private shownMult = 0;
  private shownRound = 0;
  private shownMoney = 0;

  constructor(private ctx: Ctx) {
    const menu = (label: string, key: string, fn: () => void) =>
      h('button', { type: 'button', class: 'btn btn--ghost side__menu', 'aria-label': label, 'aria-keyshortcuts': key || undefined, onclick: () => !ctx.isBusy() && fn() }, label);

    this.brandEl = h('div', { class: 'side__brand' });
    this.emblemBox = h('div', { class: 'side__emblem', 'aria-hidden': 'true' });
    this.orderName = h('div', { class: 'side__ordername' });
    this.orderClient = h('div', { class: 'side__client' });
    this.bossRule = h('div', { class: 'side__bossrule' });
    this.orderBox = h('div', { class: 'side__order' }, this.emblemBox, h('div', { class: 'side__ordertext' }, this.orderName, this.orderClient), this.bossRule);
    ctx.tips.attach(this.orderBox, () => {
      const o = ctx.game.state.orders[ctx.game.state.orderIdx];
      return h('div', null, h('b', null, o.name), h('div', null, o.client), o.boss ? h('div', { class: 'tip__rule' }, o.boss.desc) : null);
    });

    this.targetEl = h('span', { class: 'side__target-num num' }, '0');
    this.rewardEl = h('span', { class: 'side__reward' });
    this.roundEl = h('span', { class: 'side__round-num num' }, '0');
    this.flames = h('div', { class: 'flames', 'aria-hidden': 'true' });
    this.roundBox = h('div', { class: 'side__round' }, this.flames, h('div', { class: 'side__label' }, '이번 주문 점수'), this.roundEl);

    this.handName = h('span', { class: 'side__handname' }, ' ');
    this.handLevel = h('span', { class: 'side__handlv' });
    this.chipsEl = h('span', { class: 'num' }, '0');
    this.multEl = h('span', { class: 'num' }, '0');
    this.chipsBox = h('div', { class: 'cm cm--chips', 'aria-label': '칩' }, this.chipsEl);
    this.multBox = h('div', { class: 'cm cm--mult', 'aria-label': '배수' }, this.multEl);

    this.handsEl = h('span', { class: 'num' }, '0');
    this.discardsEl = h('span', { class: 'num' }, '0');
    this.moneyEl = h('span', { class: 'num' }, '$0');
    this.seasonEl = h('span', { class: 'num' });
    this.dots = h('div', { class: 'side__dots' });

    this.el = h(
      'aside',
      { class: 'side panel', 'aria-label': '주문 정보' },
      h('div', { class: 'side__header' },
        this.brandEl,
        button('⌂ 홈', () => {
          if (!ctx.isBusy()) ctx.goTitle();
        }, { class: 'btn--ghost side__home', 'aria-label': '홈으로 돌아가기', title: '진행을 저장하고 홈으로 돌아가기' }),
      ),
      this.orderBox,
      h('div', { class: 'side__target' }, h('div', { class: 'side__label' }, '목표 점수'), h('div', { class: 'side__target-row' }, this.targetEl, this.rewardEl)),
      this.roundBox,
      h(
        'div',
        { class: 'side__hand', 'aria-live': 'polite' },
        h('div', { class: 'side__handhead' }, this.handName, this.handLevel),
        h('div', { class: 'side__cm' }, this.chipsBox, h('span', { class: 'cm__x', 'aria-hidden': 'true' }, '×'), this.multBox),
      ),
      h(
        'div',
        { class: 'side__stats' },
        h('div', { class: 'stat stat--hands', title: '남은 출하' }, h('span', { class: 'stat__lbl' }, '출하'), this.handsEl),
        h('div', { class: 'stat stat--discards', title: '남은 솎아내기' }, h('span', { class: 'stat__lbl' }, '솎아내기'), this.discardsEl),
      ),
      h(
        'div',
        { class: 'side__row' },
        h('div', { class: 'side__money', title: '돈' }, this.moneyEl),
        h('div', { class: 'side__season' }, h('span', { class: 'stat__lbl' }, '시즌'), this.seasonEl, this.dots),
      ),
      h(
        'nav',
        { class: 'side__menus', 'aria-label': '메뉴' },
        menu('주문 정보', '', () => ctx.open.orders()),
        menu('온실', '', () => ctx.open.greenhouse()),
        menu('연구 노트', '', () => ctx.open.notes()),
        menu('설정', '', () => ctx.open.settings()),
      ),
    );
  }

  update(s: RunState): void {
    setText(this.brandEl, this.ctx.brand ? `${this.ctx.brand} 아틀리에` : '할머니의 온실');
    const o = s.orders[s.orderIdx];
    const key = `${s.ante}:${s.orderIdx}:${o.name}:${o.boss?.desc ?? ''}`;
    if (key !== this.orderKey) {
      this.orderKey = key;
      replaceChildren(this.emblemBox, o.kind === 'boss' && o.boss ? bossEmblem(o.boss, 58) : orderEmblem(o.kind === 'big' ? 'big' : 'small', 58));
      setText(this.orderName, o.name);
      setText(this.orderClient, o.client);
      setText(this.bossRule, o.boss ? o.boss.desc : '');
      this.orderBox.dataset.kind = o.kind;
    }
    setText(this.targetEl, fmt.score(o.target));
    setText(this.rewardEl, `보상 $${o.reward}`);
    setText(this.handsEl, s.handsLeft);
    setText(this.discardsEl, s.discardsLeft);
    setText(this.seasonEl, `${s.ante}/${s.maxAnte}`);
    replaceChildren(
      this.dots,
      ...s.orders.map((ord, i) =>
        h('span', {
          class: ['dot', i < s.orderIdx && 'is-done', i === s.orderIdx && 'is-now', ord.kind === 'boss' && 'is-boss'],
          title: `${ord.name} — 목표 ${fmt.score(ord.target)}`,
        }),
      ),
    );
    if (s.money !== this.shownMoney) {
      const from = this.shownMoney;
      this.shownMoney = s.money;
      void roll(this.moneyEl, from, s.money, 400, fmt.money);
      if (s.money > from) void play(this.moneyEl, [{ scale: '1.25' }, { scale: '1' }], { duration: 300, decorative: true });
    } else setText(this.moneyEl, fmt.money(s.money));
    if (!this.scoring) {
      this.setRound(s.roundScore, false);
      this.setFlames(s.roundScore >= o.target && (s.phase === 'play' || s.phase === 'cashout'));
    }
  }

  /** 선택한 카드의 족보 미리보기 (null 이면 비움) */
  preview(ev: { name: string; level: number; chips: number; mult: number } | null): void {
    if (this.scoring) return;
    if (!ev) {
      setText(this.handName, ' ');
      setText(this.handLevel, '');
      this.setChips(0, false);
      this.setMult(0, false);
      return;
    }
    setText(this.handName, ev.name);
    setText(this.handLevel, `Lv.${ev.level}`);
    this.setChips(ev.chips, false);
    this.setMult(ev.mult, false);
  }

  setHand(name: string, level: number): void {
    setText(this.handName, name);
    setText(this.handLevel, `Lv.${level}`);
    void play(this.handName.parentElement, [{ scale: '0.6', opacity: 0 }, { scale: '1.12', opacity: 1 }, { scale: '1' }], { duration: 380 });
  }

  setChips(v: number, animate = true): Promise<void> {
    const from = this.shownChips;
    this.shownChips = v;
    if (!animate) {
      setText(this.chipsEl, fmt.mult(v));
      return Promise.resolve();
    }
    void play(this.chipsBox, [{ scale: '1' }, { scale: '1.18', rotate: `${between(fx, -4, 4)}deg` }, { scale: '1', rotate: '0deg' }], { duration: 260, decorative: true });
    return roll(this.chipsEl, from, v, 240, (n) => fmt.mult(Math.round(n)));
  }

  setMult(v: number, animate = true, big = false): Promise<void> {
    const from = this.shownMult;
    this.shownMult = v;
    if (!animate) {
      setText(this.multEl, fmt.mult(v));
      return Promise.resolve();
    }
    void play(this.multBox, [{ scale: '1' }, { scale: big ? '1.35' : '1.18', rotate: `${between(fx, -5, 5)}deg` }, { scale: '1', rotate: '0deg' }], { duration: big ? 380 : 260, decorative: true });
    return roll(this.multEl, from, v, 240, (n) => fmt.mult(Math.round(n * 10) / 10));
  }

  setRound(v: number, animate: boolean): Promise<void> {
    const from = this.shownRound;
    this.shownRound = v;
    if (!animate) {
      setText(this.roundEl, fmt.score(v));
      return Promise.resolve();
    }
    return roll(this.roundEl, from, v, 700, (n) => fmt.score(Math.floor(n)));
  }

  setFlames(on: boolean): void {
    this.roundBox.classList.toggle('is-over', on);
    if (on && this.flames.childElementCount === 0 && !motion.reduced) {
      for (let i = 0; i < 9; i++) {
        this.flames.appendChild(h('i', { style: { '--i': i, '--d': `${(0.5 + fx() * 0.6).toFixed(2)}s`, '--x': `${(i / 8) * 100}%` } }));
      }
    }
    if (!on) replaceChildren(this.flames);
  }

  /** 목표 돌파 순간 */
  burst(): void {
    this.setFlames(true);
    audio.play('fire');
    void play(this.roundBox, [{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: 520, decorative: true });
  }
}
