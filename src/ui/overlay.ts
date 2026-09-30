// 무대 위에 뜨는 것들: 모달(겹침), 툴팁, 토스트
import { audio } from '../audio';
import { h, clear, type Child } from './h';
import { motion, play, stage } from './motion';

// ───────────────────────────────────────── 모달
export interface ModalOpts {
  title?: string;
  /** 제목 앞 작은 글 */
  kicker?: string;
  className?: string;
  content: Child;
  /** Esc·바깥 누르기로 닫을 수 있나 (기본 true) */
  dismissable?: boolean;
  onClose?: () => void;
  /** 아래 버튼 줄 */
  actions?: Child;
  wide?: boolean;
}

export interface ModalHandle {
  el: HTMLElement;
  body: HTMLElement;
  close(): void;
  readonly closed: Promise<void>;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class Modals {
  private stack: { handle: ModalHandle; opts: ModalOpts; restore: Element | null }[] = [];
  private layer: HTMLElement;
  private seq = 0;
  onChange: () => void = () => {};

  constructor(root: HTMLElement) {
    this.layer = h('div', { class: 'modal-layer', 'aria-hidden': 'true' });
    root.appendChild(this.layer);
    this.layer.addEventListener('keydown', (e) => this.trap(e));
  }

  get count(): number {
    return this.stack.length;
  }

  has(className: string): boolean {
    return this.stack.some((m) => m.handle.el.classList.contains(className));
  }

  open(opts: ModalOpts): ModalHandle {
    const id = `modal-t-${++this.seq}`;
    const body = h('div', { class: 'modal__body' });
    const head = opts.title
      ? h(
          'header',
          { class: 'modal__head' },
          opts.kicker ? h('div', { class: 'modal__kicker' }, opts.kicker) : null,
          h('h2', { class: 'modal__title', id }, opts.title),
        )
      : null;
    const closeBtn =
      opts.dismissable === false
        ? null
        : h('button', { type: 'button', class: 'modal__x', 'aria-label': '닫기', title: '닫기 (Esc)', onclick: () => handle.close() }, '×');
    const dialog = h(
      'section',
      {
        class: ['modal', opts.className, opts.wide && 'modal--wide'],
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': opts.title ? id : undefined,
        'aria-label': opts.title ? undefined : '알림',
        tabindex: '-1',
      },
      closeBtn,
      head,
      body,
      opts.actions ? h('footer', { class: 'modal__actions' }, opts.actions) : null,
    );
    const scrim = h('div', { class: 'modal-scrim' });
    const wrap = h('div', { class: 'modal-wrap' }, scrim, dialog);
    if (opts.dismissable !== false) scrim.addEventListener('click', () => handle.close());
    if (opts.content !== undefined) {
      if (Array.isArray(opts.content)) for (const c of opts.content) appendChild(body, c);
      else appendChild(body, opts.content);
    }
    let resolveClosed: () => void = () => {};
    const closed = new Promise<void>((r) => (resolveClosed = r));
    let isClosed = false;
    const handle: ModalHandle = {
      el: dialog,
      body,
      closed,
      close: () => {
        if (isClosed) return;
        isClosed = true;
        const i = this.stack.findIndex((m) => m.handle === handle);
        const entry = i >= 0 ? this.stack.splice(i, 1)[0] : null;
        void play(wrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }).then(() => wrap.remove());
        if (this.stack.length === 0) this.layer.setAttribute('aria-hidden', 'true');
        const restore = entry?.restore as HTMLElement | null;
        if (restore && typeof restore.focus === 'function' && document.contains(restore)) restore.focus({ preventScroll: true });
        opts.onClose?.();
        resolveClosed();
        this.onChange();
      },
    };
    this.stack.push({ handle, opts, restore: document.activeElement });
    this.layer.appendChild(wrap);
    this.layer.setAttribute('aria-hidden', 'false');
    void play(dialog, [{ opacity: 0, transform: 'translateY(18px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 260 });
    void play(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    queueMicrotask(() => {
      const first = dialog.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.querySelector<HTMLElement>('.modal__body ' + FOCUSABLE) ?? dialog.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? dialog).focus({ preventScroll: true });
    });
    this.onChange();
    return handle;
  }

  /** 맨 위 모달 닫기 (Esc). 닫을 수 없으면 false */
  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top || top.opts.dismissable === false) return false;
    top.handle.close();
    return true;
  }

  closeAll(): void {
    for (const m of [...this.stack].reverse()) m.handle.close();
  }

  private trap(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    const items = [...top.handle.el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function appendChild(el: HTMLElement, c: Child): void {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) {
    for (const x of c) appendChild(el, x);
    return;
  }
  el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
}

// ───────────────────────────────────────── 툴팁
export type TipContent = () => Child | null;

export class Tips {
  private map = new WeakMap<Element, TipContent>();
  private el: HTMLElement;
  private timer = 0;
  private hideTimer = 0;
  private current: Element | null = null;
  private pressTimer = 0;
  private suppressClick = false;

  constructor(private root: HTMLElement) {
    this.el = h('div', { class: 'tip', role: 'tooltip', 'aria-hidden': 'true' });
    root.appendChild(this.el);
    root.addEventListener('pointerover', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const t = this.find(e.target as Element);
      if (t === this.current) return;
      if (!t) return this.hide();
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.show(t), 260);
    });
    root.addEventListener('pointerout', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const to = this.find((e as PointerEvent).relatedTarget as Element | null);
      if (to === this.current && to) return;
      window.clearTimeout(this.timer);
      if (!to) this.hide();
    });
    root.addEventListener('focusin', (e) => {
      const t = this.find(e.target as Element);
      if (t && (e.target as HTMLElement).matches(':focus-visible')) this.show(t);
    });
    root.addEventListener('focusout', () => this.hide());
    // 터치: 길게 누르기
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') {
        this.hide();
        return;
      }
      const t = this.find(e.target as Element);
      window.clearTimeout(this.pressTimer);
      if (!t) return;
      this.pressTimer = window.setTimeout(() => {
        this.show(t);
        this.suppressClick = true;
        window.clearTimeout(this.hideTimer);
        this.hideTimer = window.setTimeout(() => this.hide(), 2600);
      }, 480);
    });
    const cancel = () => window.clearTimeout(this.pressTimer);
    root.addEventListener('pointerup', cancel);
    root.addEventListener('pointercancel', cancel);
    root.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' && (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4)) cancel();
    });
    // 길게 눌러 툴팁을 봤으면 그 뒤 클릭은 먹는다
    root.addEventListener(
      'click',
      (e) => {
        if (this.suppressClick) {
          this.suppressClick = false;
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
  }

  attach(el: Element, content: TipContent | string): void {
    this.map.set(el, typeof content === 'string' ? () => content : content);
  }

  private find(t: Element | null): Element | null {
    let cur: Element | null = t;
    while (cur && cur !== this.root) {
      if (this.map.has(cur)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  hide(): void {
    window.clearTimeout(this.timer);
    this.current = null;
    this.el.classList.remove('is-on');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private show(target: Element): void {
    if (!document.contains(target)) return;
    const fn = this.map.get(target);
    const content = fn?.();
    if (content === null || content === undefined || content === false) return this.hide();
    this.current = target;
    clear(this.el);
    appendChild(this.el, content);
    this.el.classList.add('is-on');
    this.el.setAttribute('aria-hidden', 'false');
    // 위치: 대상 위(자리가 없으면 아래), 무대 밖으로 안 나가게
    const s = stage.scale || 1;
    const r = target.getBoundingClientRect();
    const o = this.root.getBoundingClientRect();
    const tw = this.el.offsetWidth;
    const th = this.el.offsetHeight;
    const cx = (r.left + r.width / 2 - o.left) / s;
    const top = (r.top - o.top) / s;
    const bottom = (r.bottom - o.top) / s;
    let x = cx - tw / 2;
    let y = top - th - 12;
    if (y < 8) y = bottom + 12;
    const W = this.root.clientWidth;
    const H = this.root.clientHeight;
    x = Math.max(8, Math.min(W - tw - 8, x));
    y = Math.max(8, Math.min(H - th - 8, y));
    this.el.style.left = `${Math.round(x)}px`;
    this.el.style.top = `${Math.round(y)}px`;
  }
}

// ───────────────────────────────────────── 토스트
export class Toaster {
  private box: HTMLElement;
  constructor(root: HTMLElement) {
    this.box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    root.appendChild(this.box);
  }

  show(msg: string, kind: 'info' | 'warn' | 'good' = 'info', ms = 3400): void {
    const t = h('div', { class: ['toast', `toast--${kind}`] }, msg);
    this.box.appendChild(t);
    while (this.box.children.length > 4) this.box.firstElementChild?.remove();
    void play(t, [{ opacity: 0, transform: 'translateY(-12px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 240 });
    const life = motion.fast ? 1200 : ms + Math.min(2400, msg.length * 30);
    window.setTimeout(() => {
      void play(t, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 260 }).then(() => t.remove());
    }, life);
  }

  error(msg: string): void {
    audio.play('error');
    this.show(msg, 'warn');
  }
}
