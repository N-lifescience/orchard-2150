// Bounded inventory racks: live text and bitmap art stay readable at every capacity.
import { audio } from '../../audio';
import { jokerIcon, reagentIcon } from '../../art';
import type { RunState } from '../../contract/game';
import type { Ctx } from '../ctx';
import { h, setText } from '../h';
import { flipFrom, play } from '../motion';

interface Item {
  wrap: HTMLElement;
  button: HTMLButtonElement;
  sig: string;
}

function emptySlot(): HTMLElement {
  return h('div', { class: 'bar__slot bar__slot--empty', 'aria-hidden': 'true' },
    h('span', { class: 'rack-empty__mark' }, '+'), h('span', null, '빈 칸'));
}

function rackItem(icon: HTMLElement, name: string, detail: string): HTMLElement[] {
  icon.setAttribute('aria-hidden', 'true');
  return [
    h('span', { class: 'rack-item__art' }, icon),
    h('span', { class: 'rack-item__copy' },
      h('span', { class: 'rack-item__name' }, name),
      h('span', { class: 'rack-item__detail' }, detail)),
  ];
}

export class JokerBar {
  readonly el: HTMLElement;
  private row: HTMLElement;
  private count: HTMLElement;
  private items = new Map<string, Item>();
  private blanks: HTMLElement[] = [];

  constructor(private ctx: Ctx) {
    this.count = h('span', { class: 'bar__count num' });
    this.row = h('div', { class: 'bar__row', role: 'list', 'aria-label': '보유한 비법', tabindex: '0' });
    this.el = h('section', { class: 'jokers', 'aria-label': '장인의 비법', 'data-tutorial': 'jokers' },
      h('div', { class: 'bar__label' }, h('span', null, '장인의 비법'), this.count),
      this.row, h('p', { class: 'bar__hint' }, '상점에서 획득 · 왼쪽부터 자동 발동'));
  }

  /** uid → element used by the scoring animation. */
  elFor(uid: string): HTMLElement | null {
    return this.items.get(uid)?.button ?? null;
  }

  update(s: RunState): void {
    setText(this.count, `${s.jokers.length} / ${s.jokerCap}`);
    const firsts = new Map<string, DOMRect>();
    for (const [uid, it] of this.items) firsts.set(uid, it.wrap.getBoundingClientRect());
    const keep = new Set(s.jokers.map((j) => j.uid));
    for (const [uid, it] of this.items) {
      if (!keep.has(uid)) {
        this.items.delete(uid);
        it.wrap.remove();
      }
    }
    const order: HTMLElement[] = [];
    s.jokers.forEach((j, i) => {
      const def = this.ctx.game.jokerDef(j.id);
      const showCounter = j.id === 'breedingLog';
      const sig = `${j.id}:${showCounter ? j.counter : ''}`;
      let it = this.items.get(j.uid);
      if (!it) {
        const button = h('button', {
          type: 'button', class: 'rack-item rack-item--joker',
          'aria-label': `${def.name}. ${def.desc}. 자세히 보기`,
          'aria-haspopup': 'dialog',
        });
        const wrap = h('div', { class: 'bar__slot', role: 'listitem' }, button);
        button.addEventListener('click', () => { if (!this.ctx.isBusy()) this.ctx.open.joker(j.uid); });
        button.addEventListener('pointerenter', () => audio.play('hover'));
        this.ctx.tips.attach(button, () => {
          const cur = this.ctx.game.state.jokers.find((x) => x.uid === j.uid);
          return h('div', null,
            h('b', null, def.name), h('div', null, def.desc),
            def.flavor ? h('div', { class: 'tip__flavor' }, def.flavor) : null,
            cur && cur.id === 'breedingLog' ? h('div', { class: 'tip__rule' }, `지금 누적 +${cur.counter} 배수`) : null,
            h('div', { class: 'tip__sub' }, `판매 $${this.ctx.game.sellValue(j.uid)} · 눌러서 자세히 보기`));
        });
        it = { wrap, button, sig: '' };
        this.items.set(j.uid, it);
      }
      if (it.sig !== sig) {
        it.sig = sig;
        it.button.replaceChildren(...rackItem(jokerIcon(j.id, 44), def.name, showCounter ? `배수 +${j.counter}` : '자동 발동'));
      }
      it.wrap.style.setProperty('--i', String(i));
      order.push(it.wrap);
    });
    const blanks = Math.max(0, s.jokerCap - s.jokers.length);
    while (this.blanks.length < blanks) this.blanks.push(emptySlot());
    this.blanks.length = blanks;
    const want = [...order, ...this.blanks];
    const same = want.length === this.row.children.length && want.every((el, i) => this.row.children[i] === el);
    if (!same) this.row.replaceChildren(...want);
    for (const [uid, it] of this.items) {
      const f = firsts.get(uid);
      if (f) void flipFrom(it.wrap, f, { duration: 320 });
      else void play(it.wrap, [{ opacity: 0, scale: '.85' }, { opacity: 1, scale: '1' }], { duration: 320 });
    }
  }
}

export class ReagentBar {
  readonly el: HTMLElement;
  private row: HTMLElement;
  private count: HTMLElement;
  private sig = '';

  constructor(private ctx: Ctx) {
    this.count = h('span', { class: 'bar__count num' });
    this.row = h('div', { class: 'bar__row', role: 'list', 'aria-label': '보유한 연구 시약', tabindex: '0' });
    this.el = h('section', { class: 'reagents', 'aria-label': '연구 시약', 'data-tutorial': 'reagents' },
      h('div', { class: 'bar__label' }, h('span', null, '연구 시약'), this.count),
      this.row, h('p', { class: 'bar__hint' }, '눌러서 사용 · 한 번 쓰면 소모'));
  }

  update(s: RunState): void {
    setText(this.count, `${s.reagents.length} / ${s.reagentCap}`);
    const sig = `${s.reagents.join(',')}|${s.reagentCap}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const kids: HTMLElement[] = [];
    s.reagents.forEach((id, i) => {
      const def = this.ctx.game.reagentDef(id);
      const button = h('button', {
        type: 'button', class: 'rack-item rack-item--reagent',
        'aria-label': `${def.name}. ${def.desc}. 사용하기`, 'aria-haspopup': 'dialog',
      }, ...rackItem(reagentIcon(id, 44), def.name, '사용하기'));
      button.addEventListener('click', () => { if (!this.ctx.isBusy()) this.ctx.open.reagent(i); });
      button.addEventListener('pointerenter', () => audio.play('hover'));
      this.ctx.tips.attach(button, () => h('div', null, h('b', null, def.name), h('div', null, def.desc), h('div', { class: 'tip__sub' }, '눌러서 사용 방법 확인')));
      kids.push(h('div', { class: 'bar__slot', role: 'listitem' }, button));
    });
    for (let i = s.reagents.length; i < s.reagentCap; i++) kids.push(emptySlot());
    this.row.replaceChildren(...kids);
  }
}
