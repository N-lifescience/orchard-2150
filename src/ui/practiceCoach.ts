import type { RunState } from '../contract/game';
import leaPortrait from '../art/assets/generated/lea-guide.webp';
import { button, h, replaceChildren, setText } from './h';
import { tutorialStep, type TutorialStep, type TutorialTarget } from './tutorialFlow';

const TARGETS: Record<TutorialTarget, string> = {
  goal: '.side__target', limits: '.side__stats', home: '.side__home',
  notebook: '.side__menus button:nth-child(3)', jokers: '.jokers', reagents: '.reagents',
  order: '.view--cross .ordercard', 'parent-first': '.garden .gslot:nth-child(1)',
  'parent-second': '.garden .gslot:nth-child(2)', prediction: '.cross__prediction-actions',
  cross: '.cross__bar .btn--play', observation: '.play__prediction', hand: '.hand .slot:not(.is-selected)',
  shipment: '.actions .btn--play', cashout: '.cash .btn--gold', selection: '.sel__grid .sslot',
  shop: '.shop__side .btn--play', review: '.end__btns .btn--play', none: '',
  pod: '.view--play .pod', sort: '.view--play .sortbox', discard: '.actions .btn--discard',
};
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex="0"], summary';
const PAD = 7;
interface Box { left: number; top: number; width: number; height: number; }
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/** A viewport overlay keeps the cutout aligned even when the game stage is scaled. */
export class PracticeCoach {
  /** App may mount this anchor in any current screen; the visible guide lives outside the scaled stage. */
  readonly el = h('span', { class: 'coach-anchor', hidden: true, 'aria-hidden': 'true' });
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private shades: HTMLElement[];
  private frame: HTMLElement;
  private title: HTMLElement;
  private body: HTMLElement;
  private evidence: HTMLElement;
  private count: HTMLElement;
  private progress: HTMLProgressElement;
  private actions: HTMLElement;
  private stop: HTMLButtonElement;
  private hint: HTMLElement;
  private step: TutorialStep | null = null;
  private target: HTMLElement | null = null;
  private busy = false;
  private raf = 0;
  private destroyed = false;
  private shouldReveal = true;
  private observer: MutationObserver;
  private resize: ResizeObserver;
  private restoreFocus: HTMLElement | null;

  constructor(private root: HTMLElement, private callbacks: { acknowledge(step: TutorialStep): void; stop(): void; finish(fresh: boolean): void }) {
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.title = h('h2', { class: 'guide__title', id: 'lea-guide-title' });
    this.body = h('p', { class: 'guide__body' });
    this.evidence = h('p', { class: 'guide__evidence' });
    this.count = h('span', { class: 'guide__count' });
    this.progress = h('progress', { class: 'guide__progress', max: 20, value: 0, 'aria-label': '튜토리얼 진행' });
    this.actions = h('div', { class: 'guide__actions' });
    this.stop = button('튜토리얼 나가기', () => callbacks.stop(), { class: 'guide__stop' });
    this.hint = h('span', { class: 'guide__tap', 'aria-hidden': 'true' }, '빛나는 곳을 눌러 주세요');
    this.frame = h('div', { class: 'guide__spotlight', 'aria-hidden': 'true' }, this.hint);
    this.shades = Array.from({ length: 4 }, () => h('div', { class: 'guide__shade', 'aria-hidden': 'true' }));
    this.panel = h('section', { class: 'guide__dialogue', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'lea-guide-title', tabindex: '-1' },
      h('div', { class: 'guide__portrait' }, h('img', { src: leaPortrait, alt: '과수원 매니저 레아 모레노', draggable: false })),
      h('div', { class: 'guide__speech' },
        h('header', { class: 'guide__head' }, h('span', { class: 'guide__name' }, '레아 모레노'), this.count, this.stop),
        this.progress,
        h('div', { class: 'guide__words', 'aria-live': 'polite', 'aria-atomic': 'true' }, this.title, this.body, this.evidence),
        this.actions,
      ),
    );
    this.overlay = h('div', { class: 'guide', 'data-tutorial': 'spotlight' }, ...this.shades, this.frame, this.panel);
    document.body.appendChild(this.overlay);
    document.addEventListener('pointerdown', this.guardPointer, true);
    document.addEventListener('click', this.guardPointer, true);
    document.addEventListener('keydown', this.guardKeys, true);
    document.addEventListener('keydown', this.stopGlobalKeys);
    document.addEventListener('focusin', this.guardFocus, true);
    document.addEventListener('scroll', this.schedule, true);
    window.addEventListener('resize', this.viewportChanged);
    window.visualViewport?.addEventListener('resize', this.viewportChanged);
    window.visualViewport?.addEventListener('scroll', this.schedule);
    this.observer = new MutationObserver(this.schedule);
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'disabled'] });
    this.resize = new ResizeObserver(this.schedule);
    this.resize.observe(this.panel);
    this.resize.observe(root);
  }

  update(step: TutorialStep, state: RunState, feedback: string, busy: boolean): void {
    const info = tutorialStep(step);
    const changed = this.step !== step;
    this.busy = busy;
    this.overlay.classList.toggle('is-busy', busy);
    this.overlay.dataset.step = step;
    this.el.dataset.phase = state.phase;
    setText(this.count, `${info.number} / ${info.total}`);
    this.progress.value = step === 'complete' ? info.total : info.number - 1;
    if (changed) {
      this.step = step;
      setText(this.title, info.title);
      setText(this.body, info.body);
      const actions: HTMLElement[] = [];
      if (step === 'complete') {
        actions.push(button('이 과수원에서 계속하기', () => this.callbacks.finish(false), { class: 'btn--play' }));
        actions.push(button('새 과수원 시작', () => this.callbacks.finish(true), { class: 'btn--ghost' }));
      } else if (info.actionLabel) {
        actions.push(button(info.actionLabel, () => this.callbacks.acknowledge(step), { class: 'btn--play' }));
      } else {
        actions.push(h('span', { class: 'guide__instruction' }, '빛나는 곳을 직접 눌러 보세요.'));
      }
      replaceChildren(this.actions, ...actions);
      this.shouldReveal = true;
    }
    setText(this.evidence, feedback);
    this.evidence.hidden = !feedback;
    this.stop.hidden = step === 'complete';
    this.stop.disabled = busy;
    for (const btn of this.actions.querySelectorAll<HTMLButtonElement>('button')) btn.disabled = busy;
    this.schedule();
  }

  private isPaused(): boolean { return !!this.root.querySelector('.modal-layer[aria-hidden="false"]'); }
  private permitted(node: EventTarget | null): boolean {
    return node instanceof Node && (this.panel.contains(node) || (!this.busy && !!this.target?.contains(node)));
  }
  private guardPointer = (event: Event): void => {
    if (this.destroyed || this.isPaused() || this.permitted(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  private focusable(): HTMLElement[] {
    const controls: HTMLElement[] = [];
    if (!this.busy && this.target) {
      if (this.target.matches(FOCUSABLE)) controls.push(this.target);
      controls.push(...this.target.querySelectorAll<HTMLElement>(FOCUSABLE));
    }
    controls.push(...this.panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    return controls.filter((node) => node.getClientRects().length && !node.closest('[hidden]'));
  }
  private guardKeys = (event: KeyboardEvent): void => {
    if (this.destroyed || this.isPaused() || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!this.busy) this.callbacks.stop();
      return;
    }
    if (event.key === 'Tab') {
      const controls = this.focusable();
      event.preventDefault(); event.stopImmediatePropagation();
      if (!controls.length) { this.panel.focus({ preventScroll: true }); return; }
      const current = controls.indexOf(document.activeElement as HTMLElement);
      const index = current < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      controls[index].focus({ preventScroll: true });
      return;
    }
    if (!this.permitted(event.target) || !['Enter', ' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  /** Target buttons keep native keyboard behavior; game-wide shortcuts cannot bypass the current step. */
  private stopGlobalKeys = (event: KeyboardEvent): void => { if (!this.destroyed && !this.isPaused()) event.stopPropagation(); };
  private guardFocus = (event: FocusEvent): void => {
    if (this.destroyed || this.isPaused() || this.permitted(event.target)) return;
    (this.focusable()[0] ?? this.panel).focus({ preventScroll: true });
  };
  private schedule = (): void => {
    if (this.destroyed || this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.layout(); });
  };
  private viewportChanged = (): void => { this.shouldReveal = true; this.schedule(); };

  private resolveTarget(): HTMLElement | null {
    if (!this.step) return null;
    const info = tutorialStep(this.step);
    let target = info.target === 'none' ? null : this.root.querySelector<HTMLElement>(TARGETS[info.target]);
    if (info.target === 'order' && !target?.getClientRects().length) target = this.root.querySelector('.side__target');
    if (this.step === 'keep') {
      const selected = this.root.querySelector('.sel__grid .sslot.is-picked');
      if (selected) {
        target = this.root.querySelector('.sel__btns .btn--play');
        setText(this.title, '이 모종을 온실에 들여요.');
        setText(this.body, '온실에 들이기를 눌러 주세요. 방금 고른 자손이 다음 주문부터 부모 후보에 들어가요. 이렇게 좋은 형질을 다음 세대로 이어 가요.');
      } else if (!target) {
        target = this.root.querySelector('.sel__btns .btn--ghost');
      }
    }
    if (target && (!target.getClientRects().length || !target.isConnected)) return null;
    return target;
  }

  private layout(): void {
    if (this.destroyed || !this.step) return;
    const paused = this.isPaused();
    this.overlay.hidden = paused;
    if (paused) return;
    const next = this.resolveTarget();
    if (next !== this.target) {
      this.target?.classList.remove('is-tutorial-target');
      this.target = next;
      this.target?.classList.add('is-tutorial-target');
      this.shouldReveal = true;
    }
    const width = window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    const topInset = window.visualViewport?.offsetTop ?? 0;
    const margin = width < 600 ? 10 : 20;
    const panelWidth = Math.min(width - margin * 2, width >= 1000 ? 620 : 560);
    this.panel.style.width = `${panelWidth}px`;
    const panelHeight = this.panel.getBoundingClientRect().height;
    const availableHeight = Math.max(100, height - panelHeight - margin * 3);
    // On a short screen, light the card itself; its repeated description can stay below the fold.
    const focusNode = this.target && this.target.getBoundingClientRect().height > availableHeight
      ? this.target.querySelector<HTMLElement>('.sa-card') ?? this.target
      : this.target;
    // First place the dialogue at the bottom; scrolling puts the actual control in the space above it.
    let panelBox: Box = { left: Math.max(margin, (width - panelWidth) / 2), top: topInset + height - panelHeight - margin, width: panelWidth, height: panelHeight };
    if (this.shouldReveal && focusNode && !this.busy) {
      focusNode.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      if (this.root.classList.contains('is-responsive')) {
        const rect = focusNode.getBoundingClientRect();
        const desiredTop = topInset + margin + Math.max(0, (availableHeight - rect.height) / 2);
        window.scrollBy({ top: rect.top - desiredTop, behavior: 'instant' });
      }
      this.shouldReveal = false;
    }
    let hole: Box | null = null;
    if (focusNode) {
      const rect = focusNode.getBoundingClientRect();
      const left = Math.max(0, rect.left - PAD);
      const top = Math.max(topInset, rect.top - PAD);
      hole = { left, top, width: Math.max(0, Math.min(width, rect.right + PAD) - left), height: Math.max(0, Math.min(topInset + height, rect.bottom + PAD) - top) };
      // Pick a corner that does not cover the target. This also handles small landscape tablets.
      const candidates: Box[] = [panelBox,
        { ...panelBox, left: width - panelWidth - margin, top: topInset + margin },
        { ...panelBox, left: margin, top: topInset + margin },
        { ...panelBox, left: margin },
        { ...panelBox, left: width - panelWidth - margin },
      ];
      panelBox = candidates.reduce((best, candidate) => overlap(candidate, hole!) < overlap(best, hole!) ? candidate : best);
    }
    this.position(this.panel, panelBox);
    if (!hole || hole.width <= 0 || hole.height <= 0) {
      this.frame.hidden = true;
      this.position(this.shades[0], { left: 0, top: 0, width, height: window.innerHeight });
      this.shades.slice(1).forEach((shade) => { shade.hidden = true; });
    } else {
      this.frame.hidden = false;
      this.position(this.frame, hole);
      this.hint.hidden = !!tutorialStep(this.step).actionLabel || this.busy;
      this.frame.classList.toggle('is-below', hole.top < 38);
      this.shades.forEach((shade) => { shade.hidden = false; });
      this.position(this.shades[0], { left: 0, top: 0, width, height: hole.top });
      this.position(this.shades[1], { left: 0, top: hole.top + hole.height, width, height: Math.max(0, window.innerHeight - hole.top - hole.height) });
      this.position(this.shades[2], { left: 0, top: hole.top, width: hole.left, height: hole.height });
      this.position(this.shades[3], { left: hole.left + hole.width, top: hole.top, width: Math.max(0, width - hole.left - hole.width), height: hole.height });
    }
    // Initial focus stays in the guided interaction, including restored tutorials.
    if (!this.permitted(document.activeElement)) (this.focusable()[0] ?? this.panel).focus({ preventScroll: true });
  }
  private position(node: HTMLElement, box: Box): void {
    node.style.left = `${box.left}px`; node.style.top = `${box.top}px`;
    node.style.width = `${box.width}px`;
    if (node !== this.panel) node.style.height = `${box.height}px`;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect(); this.resize.disconnect();
    document.removeEventListener('pointerdown', this.guardPointer, true);
    document.removeEventListener('click', this.guardPointer, true);
    document.removeEventListener('keydown', this.guardKeys, true);
    document.removeEventListener('keydown', this.stopGlobalKeys);
    document.removeEventListener('focusin', this.guardFocus, true);
    document.removeEventListener('scroll', this.schedule, true);
    window.removeEventListener('resize', this.viewportChanged);
    window.visualViewport?.removeEventListener('resize', this.viewportChanged);
    window.visualViewport?.removeEventListener('scroll', this.schedule);
    this.target?.classList.remove('is-tutorial-target');
    this.el.parentElement?.classList.remove('has-coach');
    this.el.remove(); this.overlay.remove();
    if (this.restoreFocus?.isConnected) this.restoreFocus.focus({ preventScroll: true });
  }
}
