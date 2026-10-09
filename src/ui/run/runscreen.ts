// 런 화면 — 왼쪽 패널·위쪽 비법/시약 줄은 그대로 두고, 가운데만 phase 별로 갈아 끼운다
import type { Phase, RunState } from '../../contract/game';
import type { Ctx } from '../ctx';
import { h } from '../h';
import { play, rectIn } from '../motion';
import { CashoutView } from './cashout';
import { CrossView } from './cross';
import { PlayView } from './play';
import { SelectView } from './select';
import { ShopView } from './shop';
import { Sidebar } from './sidebar';
import { JokerBar, ReagentBar } from './topbar';
import { ClientVisit } from './client';

type ViewKey = 'cross' | 'play' | 'cashout' | 'select' | 'shop';

export class RunScreen {
  readonly el: HTMLElement;
  readonly side: Sidebar;
  readonly jokers: JokerBar;
  readonly reagents: ReagentBar;
  readonly cross: CrossView;
  readonly play: PlayView;
  readonly cashout: CashoutView;
  readonly select: SelectView;
  readonly shop: ShopView;
  private phaseBox: HTMLElement;
  private current: ViewKey | null = null;
  private client: ClientVisit;

  constructor(private ctx: Ctx) {
    this.side = new Sidebar(ctx);
    this.jokers = new JokerBar(ctx);
    this.reagents = new ReagentBar(ctx);
    this.cross = new CrossView(ctx);
    this.play = new PlayView(ctx, this.side, this.jokers);
    this.cashout = new CashoutView(ctx, () => this.side.moneyEl);
    this.select = new SelectView(ctx);
    this.shop = new ShopView(ctx);
    // Responsive screens move the pod; use its actual stage-relative position.
    this.cross.podTarget = () => {
      if (!this.play.podBtn.isConnected) return null;
      return rectIn(this.play.podBtn, ctx.stage);
    };
    this.phaseBox = h('div', { class: 'phase' });
    this.el = h(
      'div',
      { class: 'run' },
      this.side.el,
      h('main', { class: 'main', 'aria-label': '작업대' }, h('div', { class: 'topbar' }, this.jokers.el, this.reagents.el), this.phaseBox),
    );
    this.client = new ClientVisit(ctx, this.el);
  }

  private viewFor(k: ViewKey): { el: HTMLElement } {
    return this[k];
  }

  static keyOf(p: Phase): ViewKey | null {
    return p === 'cross' || p === 'play' || p === 'cashout' || p === 'select' || p === 'shop' ? p : null;
  }

  get view(): ViewKey | null {
    return this.current;
  }

  update(s: RunState): void {
    this.side.update(s);
    this.jokers.update(s);
    this.reagents.update(s);
    const k = RunScreen.keyOf(s.phase);
    if (!k) return;
    const phaseChanged = this.current !== null && k !== this.current;
    this.el.dataset.phase = k;
    if (k !== this.current) {
      const prev = this.current;
      this.current = k;
      const next = this.viewFor(k).el;
      next.classList.remove('is-leaving');
      if (prev) {
        const old = this.viewFor(prev).el;
        old.classList.add('is-leaving');
        void play(old, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 20px' }], { duration: 200 }).then(() => {
          if (old !== this.viewFor(this.current ?? k).el) old.remove();
        });
      }
      this.phaseBox.appendChild(next);
      if (k === 'cross') this.cross.reset();
      void play(next, [{ opacity: 0, translate: '0 -16px' }, { opacity: 1, translate: '0 0' }], { duration: 300 });
    }
    switch (k) {
      case 'cross':
        this.cross.update(s);
        break;
      case 'play':
        void this.play.update(s);
        break;
      case 'cashout':
        this.cashout.update(s);
        break;
      case 'select':
        this.select.update(s);
        break;
      case 'shop':
        this.shop.update(s);
        break;
    }
    if (k !== 'play') this.side.preview(null);
    this.client.update(s);
    if (phaseChanged && this.ctx.stage.classList.contains('is-responsive')) {
      queueMicrotask(() => {
        const top = window.scrollY + this.phaseBox.getBoundingClientRect().top - 20;
        window.scrollTo(0, Math.max(0, top));
      });
    }
  }

  relayout(): void {
    if (this.current === 'play') this.play.relayout();
  }
}
