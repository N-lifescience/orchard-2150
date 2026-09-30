// 선발 (phase 'select') — 이번 주문에서 본 모종 중 한 포기를 온실에 들인다
import { audio } from '../../audio';
import { plantCard, seedCard } from '../../art';
import type { RunState, SeedCard } from '../../contract/game';
import { effBrix, hasGlasses, lineageText, phenoSentence, plantView, seedView } from '../cards';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren, setText } from '../h';
import { play } from '../motion';
import { cardTip, attachTilt } from './hand';

export class SelectView {
  readonly el: HTMLElement;
  private grid: HTMLElement;
  private gardenRow: HTMLElement;
  private info: HTMLElement;
  private confirmBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private sortBy: 'brix' | 'suit' = 'brix';
  private pick: string | null = null;
  private out: string | null = null;
  private key = '';
  private orderKey = '';

  constructor(private ctx: Ctx) {
    this.grid = h('div', { class: 'sel__grid', role: 'group', 'aria-label': '선발 후보' });
    this.gardenRow = h('div', { class: 'sel__garden', role: 'group', 'aria-label': '지금 온실' });
    this.info = h('div', { class: 'sel__info', 'aria-live': 'polite' });
    this.confirmBtn = button('온실에 들이기', () => this.confirm(), { class: 'btn--play', 'aria-keyshortcuts': 'Enter' });
    this.skipBtn = button('건너뛰기', () => this.skip(), { class: 'btn--ghost' });
    const sortB = button('당도순', () => this.setSort('brix'), { class: 'btn--seg', 'aria-pressed': 'true' });
    const sortS = button('빛깔순', () => this.setSort('suit'), { class: 'btn--seg', 'aria-pressed': 'false' });
    this.setSortBtns = () => {
      sortB.setAttribute('aria-pressed', String(this.sortBy === 'brix'));
      sortS.setAttribute('aria-pressed', String(this.sortBy === 'suit'));
    };
    this.el = h(
      'div',
      { class: 'view view--select' },
      h(
        'div',
        { class: 'sel panel' },
        h(
          'header',
          { class: 'sel__head' },
          h('div', null, h('h2', { class: 'h2' }, '선발 — 한 포기를 온실에 들여요'), h('p', { class: 'hint' }, '이번 주문에서 본 모종 중 한 포기가 다음 교배의 부모가 돼요. 씨 없는(3배체) 모종은 부모가 될 수 없어요.')),
          h('div', { class: 'sortbox' }, sortB, sortS),
        ),
        this.grid,
        h('div', { class: 'sel__bottom' }, h('div', { class: 'sel__gardenwrap' }, h('div', { class: 'bar__label' }, '지금 온실 '), this.gardenRow), h('div', { class: 'sel__side' }, this.info, h('div', { class: 'sel__btns' }, this.skipBtn, this.confirmBtn))),
      ),
    );
  }

  private setSortBtns: () => void;

  private setSort(by: 'brix' | 'suit'): void {
    this.sortBy = by;
    this.setSortBtns();
    this.key = '';
    this.update(this.ctx.game.state);
  }

  update(s: RunState): void {
    const opts = this.ctx.game.selectOptions();
    const key = `${s.ante}:${s.orderIdx}:${opts.candidates.length}:${s.garden.map((p) => p.id).join(',')}:${this.sortBy}:${this.pick}:${this.out}:${opts.extraPicks}`;
    if (key === this.key) return;
    const ok = `${s.seed}:${s.ante}:${s.orderIdx}`;
    const fresh = ok !== this.orderKey;
    this.orderKey = ok;
    this.key = key;
    if (fresh) {
      this.pick = null;
      this.out = null;
    }
    const glasses = hasGlasses(s);
    const suitIdx = (c: SeedCard) => ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'].indexOf(`${c.pheno.color}-${c.pheno.marked ? 'm' : 'p'}`);
    const cands = opts.candidates.slice().sort((a, b) => (this.sortBy === 'brix' ? (effBrix(b) ?? -1) - (effBrix(a) ?? -1) || suitIdx(a) - suitIdx(b) : suitIdx(a) - suitIdx(b) || (effBrix(b) ?? -1) - (effBrix(a) ?? -1)));
    if (cands.length === 0) {
      replaceChildren(this.grid, h('p', { class: 'hint' }, '들일 수 있는 모종이 없어요. [건너뛰기]를 눌러요.'));
    } else {
      replaceChildren(
        this.grid,
        ...cands.map((c) => {
          const card = seedCard(seedView(c, { glasses }));
          const on = this.pick === c.uid;
          if (on) card.classList.add('is-selected');
          const wrap = h(
            'div',
            {
              class: ['sslot', on && 'is-picked'],
              role: 'button',
              tabindex: '0',
              'aria-pressed': String(on),
              'aria-label': `${phenoSentence(c.pheno, effBrix(c))}${c.brixMod ? ', 환경 효과 있음(유전 안 됨)' : ''}`,
            },
            card,
            c.brixMod ? h('span', { class: 'sslot__env', title: '비료·가뭄 효과는 유전되지 않아요' }, '비료·가뭄 효과는 유전되지 않아요') : null,
          );
          wrap.addEventListener('click', () => this.choose(c.uid));
          wrap.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              this.choose(c.uid);
            }
          });
          attachTilt(wrap, () => card);
          this.ctx.tips.attach(wrap, cardTip(this.ctx, () => c));
          return wrap;
        }),
      );
    }
    replaceChildren(
      this.gardenRow,
      ...s.garden.map((p) => {
        const card = plantCard(plantView(p, { glasses, subtitle: lineageText(p, (id) => this.ctx.game.plantById(id)) }));
        const on = this.out === p.id;
        const wrap = h('div', { class: ['gmini', on && 'is-out', opts.mustReplace && 'is-choosable'], role: opts.mustReplace ? 'button' : undefined, tabindex: opts.mustReplace ? '0' : undefined, 'aria-pressed': opts.mustReplace ? String(on) : undefined, 'aria-label': `${p.name}${opts.mustReplace ? ' — 내보내기로 고르기' : ''}` }, card, on ? h('span', { class: 'gmini__out' }, '내보냄') : null);
        if (opts.mustReplace) {
          wrap.addEventListener('click', () => this.chooseOut(p.id));
          wrap.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              this.chooseOut(p.id);
            }
          });
        }
        return wrap;
      }),
    );
    const parts: string[] = [];
    if (opts.mustReplace) parts.push(`온실이 가득 찼어요(${s.garden.length}/${s.gardenCap}). 내보낼 포기도 골라요.`);
    else parts.push(`온실 ${s.garden.length}/${s.gardenCap}`);
    if (opts.extraPicks > 0 || (s as { selectPicked?: unknown }).selectPicked) parts.push('조직배양 랩: 한 포기 더 들일 수 있어요. 같은 모종을 한 번 더 고르면 클론이에요.');
    setText(this.info, parts.join(' '));
    this.confirmBtn.disabled = !this.pick || (opts.mustReplace && !this.out) || this.ctx.isBusy();
    if (fresh) void play(this.el.firstElementChild, [{ opacity: 0, translate: '0 40px' }, { opacity: 1, translate: '0 0' }], { duration: 380 });
  }

  private choose(uid: string): void {
    this.pick = this.pick === uid ? null : uid;
    audio.play(this.pick ? 'select' : 'deselect');
    this.key = '';
    this.update(this.ctx.game.state);
  }

  private chooseOut(id: string): void {
    this.out = this.out === id ? null : id;
    audio.play(this.out ? 'select' : 'deselect');
    this.key = '';
    this.update(this.ctx.game.state);
  }

  confirm(): void {
    if (this.ctx.isBusy() || !this.pick) return;
    const opts = this.ctx.game.selectOptions();
    if (opts.mustReplace && !this.out) {
      this.ctx.toast.error('내보낼 포기를 골라 주세요.');
      return;
    }
    audio.play('buy');
    const pick = this.pick;
    const out = this.out ?? undefined;
    this.pick = null;
    this.out = null;
    this.key = '';
    this.ctx.game.select(pick, opts.mustReplace ? out : undefined);
  }

  skip(): void {
    if (this.ctx.isBusy()) return;
    this.pick = null;
    this.out = null;
    this.key = '';
    this.ctx.game.select(null);
  }
}
