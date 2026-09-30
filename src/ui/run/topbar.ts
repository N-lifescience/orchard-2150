// 위쪽: 비법 줄(왼쪽) + 시약 칸(오른쪽). uid 키로 DOM 을 재사용한다.
import { audio } from '../../audio';
import { jokerCard, reagentCard } from '../../art';
import type { RunState } from '../../contract/game';
import type { Ctx } from '../ctx';
import { h, setText } from '../h';
import { flipFrom, play } from '../motion';

interface Item {
  wrap: HTMLElement;
  sig: string;
}

export class JokerBar {
  readonly el: HTMLElement;
  private row: HTMLElement;
  private count: HTMLElement;
  private items = new Map<string, Item>();
  private blanks: HTMLElement[] = [];

  constructor(private ctx: Ctx) {
    this.count = h('span', { class: 'bar__count num' });
    this.row = h('div', { class: 'bar__row', role: 'list' });
    this.el = h('section', { class: 'jokers', 'aria-label': '장인의 비법' }, h('div', { class: 'bar__label' }, '장인의 비법 ', this.count), this.row);
  }

  /** uid → 요소 (점수 연출에서 is-trigger 대상) */
  elFor(uid: string): HTMLElement | null {
    return (this.items.get(uid)?.wrap.firstElementChild as HTMLElement | null) ?? null;
  }

  update(s: RunState): void {
    setText(this.count, `${s.jokers.length}/${s.jokerCap}`);
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
        const wrap = h('div', { class: 'bar__slot', role: 'listitem', tabindex: '0', 'aria-label': `${def.name} — ${def.desc} (눌러서 자세히 보기)` });
        wrap.addEventListener('click', () => this.ctx.open.joker(j.uid));
        wrap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this.ctx.open.joker(j.uid);
          }
        });
        wrap.addEventListener('pointerenter', () => audio.play('hover'));
        this.ctx.tips.attach(wrap, () => {
          const cur = this.ctx.game.state.jokers.find((x) => x.uid === j.uid);
          return h(
            'div',
            null,
            h('b', null, def.name),
            h('div', null, def.desc),
            def.flavor ? h('div', { class: 'tip__flavor' }, def.flavor) : null,
            cur && cur.id === 'breedingLog' ? h('div', { class: 'tip__rule' }, `지금 누적 +${cur.counter} 배수`) : null,
            h('div', { class: 'tip__sub' }, `판매 $${this.ctx.game.sellValue(j.uid)} · 왼쪽부터 차례로 발동해요`),
          );
        });
        it = { wrap, sig: '' };
        this.items.set(j.uid, it);
      }
      if (it.sig !== sig) {
        it.sig = sig;
        it.wrap.replaceChildren(jokerCard(def, { uid: j.uid, counter: showCounter ? j.counter : undefined }));
      }
      it.wrap.style.setProperty('--i', String(i));
      order.push(it.wrap);
    });
    // 빈 칸 자리 표시
    const blanks = Math.max(0, s.jokerCap - s.jokers.length);
    while (this.blanks.length < blanks) this.blanks.push(h('div', { class: 'bar__slot bar__slot--empty', 'aria-hidden': 'true' }, h('span', null, '빈 칸')));
    this.blanks.length = blanks;
    const want = [...order, ...this.blanks.slice(0, blanks)];
    const same = want.length === this.row.children.length && want.every((el, i) => this.row.children[i] === el);
    if (!same) this.row.replaceChildren(...want);
    for (const [uid, it] of this.items) {
      const f = firsts.get(uid);
      if (f) void flipFrom(it.wrap, f, { duration: 320 });
      else void play(it.wrap, [{ opacity: 0, scale: '0.5', translate: '0 -30px' }, { opacity: 1, scale: '1', translate: '0 0' }], { duration: 420 });
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
    this.row = h('div', { class: 'bar__row', role: 'list' });
    this.el = h('section', { class: 'reagents', 'aria-label': '연구 시약' }, h('div', { class: 'bar__label' }, '연구 시약 ', this.count), this.row);
  }

  update(s: RunState): void {
    setText(this.count, `${s.reagents.length}/${s.reagentCap}`);
    const sig = `${s.reagents.join(',')}|${s.reagentCap}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const kids: HTMLElement[] = [];
    s.reagents.forEach((id, i) => {
      const def = this.ctx.game.reagentDef(id);
      const wrap = h('div', { class: 'bar__slot', role: 'listitem', tabindex: '0', 'aria-label': `${def.name} — ${def.desc} (눌러서 쓰기)` }, reagentCard(def));
      wrap.addEventListener('click', () => this.ctx.open.reagent(i));
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.ctx.open.reagent(i);
        }
      });
      wrap.addEventListener('pointerenter', () => audio.play('hover'));
      this.ctx.tips.attach(wrap, () => h('div', null, h('b', null, def.name), h('div', null, def.desc), h('div', { class: 'tip__sub' }, '눌러서 써요')));
      kids.push(wrap);
    });
    for (let i = s.reagents.length; i < s.reagentCap; i++) kids.push(h('div', { class: 'bar__slot bar__slot--empty', 'aria-hidden': 'true' }, h('span', null, '빈 칸')));
    this.row.replaceChildren(...kids);
  }
}
