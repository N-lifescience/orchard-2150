// 레아의 말풍선 안내 — 한 번에 한 문장, 단계 막대, 실제 조작부 옆 말풍선. 단계는 실제 조작으로만 넘어간다.
// 화면 전체를 어둡게 하고 지금 말하는 곳만 밝힌다. 모달·이야기 장면이 열리면 잠시 숨는다.
import type { RunState } from '../contract/game';
import leaPortrait from '../art/assets/generated/lea-guide.webp';
import { button, h, replaceChildren, setText } from './h';
import { COACH_UI } from './story/script';
import { tutorialStep, type TutorialStep, type TutorialTarget } from './tutorialFlow';

const TARGETS: Record<TutorialTarget, string> = {
  goal: '.side__target', limits: '.side__stats', home: '.side__home',
  jokers: '.jokers', reagents: '.reagents', 'shop-cards': '.view--shop .shop__cards',
  'parent-first': '.garden .gslot:nth-child(1)', 'parent-second': '.garden .gslot:nth-child(2)',
  prediction: '.cross__prediction-actions', cross: '.cross__bar .btn--play', observation: '.play__prediction',
  pod: '.view--play .pod', sort: '.view--play .sortbox', discard: '.actions .btn--discard',
  hand: '.hand .slot:not(.is-selected)', shipment: '.actions .btn--play', cashout: '.cash .btn--gold',
  selection: '.sel__grid .sslot', shop: '.shop__side .btn--play', review: '.end__btns .btn--play', none: '',
};
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex="0"], summary';
const PAD = 7;
const GAP = 14;
interface Box { left: number; top: number; width: number; height: number; }
const overlap = (a: Box, b: Box): number => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));

/** A viewport overlay keeps the cutout aligned even when the game stage is scaled. */
export class PracticeCoach {
  /** App may mount this anchor in any current screen; the visible guide lives outside the stage. */
  readonly el = h('span', { class: 'coach-anchor', hidden: true, 'aria-hidden': 'true' });
  private overlay: HTMLElement;
  private panel: HTMLElement;
  private shades: HTMLElement[];
  private frame: HTMLElement;
  private label: HTMLElement;
  private line: HTMLElement;
  private evidence: HTMLElement;
  private count: HTMLElement;
  private progress: HTMLProgressElement;
  private actions: HTMLElement;
  private stop: HTMLButtonElement;
  private hint: HTMLElement;
  private step: TutorialStep | null = null;
  private sentence = 0;
  private target: HTMLElement | null = null;
  private busy = false;
  private raf = 0;
  private destroyed = false;
  private shouldReveal = true;
  private wasPaused = false;
  private observer: MutationObserver;
  private resize: ResizeObserver;
  private restoreFocus: HTMLElement | null;

  constructor(private root: HTMLElement, private callbacks: { stop(): void; finish(fresh: boolean): void }) {
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.label = h('span', { class: 'guide__label' });
    this.line = h('p', { class: 'guide__line', id: 'lea-guide-line' });
    this.evidence = h('p', { class: 'guide__evidence' });
    this.count = h('span', { class: 'guide__count' });
    this.progress = h('progress', { class: 'guide__progress', max: 12, value: 0, 'aria-label': COACH_UI.progress });
    this.actions = h('div', { class: 'guide__actions' });
    this.stop = button(COACH_UI.stop, () => callbacks.stop(), { class: 'guide__stop' });
    this.hint = h('span', { class: 'guide__tap', 'aria-hidden': 'true' }, COACH_UI.tap);
    this.frame = h('div', { class: 'guide__spotlight', 'aria-hidden': 'true' }, this.hint);
    this.shades = Array.from({ length: 4 }, () => h('div', { class: 'guide__shade', 'aria-hidden': 'true' }));
    this.panel = h('section', { class: 'guide__dialogue', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'lea-guide-line', tabindex: '-1' },
      h('header', { class: 'guide__head' },
        h('img', { class: 'guide__face', src: leaPortrait, alt: '', draggable: false }),
        h('span', { class: 'guide__who' }, h('span', { class: 'guide__name' }, COACH_UI.name), this.label),
        this.count, this.stop),
      this.progress,
      h('div', { class: 'guide__words', 'aria-live': 'polite', 'aria-atomic': 'true' }, this.line, this.evidence),
      this.actions,
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
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-hidden', 'disabled', 'hidden'] });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['data-story', 'data-story-beat'] });
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
    setText(this.label, info.label);
    this.progress.max = info.total;
    this.progress.value = step === 'complete' ? info.total : info.number - 1;
    if (changed) {
      this.step = step;
      this.sentence = 0;
      this.drawSentence();
    }
    setText(this.evidence, feedback);
    this.evidence.hidden = !feedback || !this.onLastSentence();
    this.stop.hidden = step === 'complete';
    this.stop.disabled = busy;
    for (const btn of this.actions.querySelectorAll<HTMLButtonElement>('button')) btn.disabled = busy;
    this.schedule();
  }

  private onLastSentence(): boolean {
    return !!this.step && this.sentence >= tutorialStep(this.step).lines.length - 1;
  }

  private drawSentence(): void {
    if (!this.step) return;
    const info = tutorialStep(this.step);
    const line = info.lines[Math.min(this.sentence, info.lines.length - 1)];
    setText(this.line, line.text);
    const actions: HTMLElement[] = [];
    if (!this.onLastSentence()) {
      actions.push(button(`${COACH_UI.next} · ${this.sentence + 1}/${info.lines.length}`, () => {
        this.sentence++;
        this.drawSentence();
        this.evidence.hidden = !this.evidence.textContent || !this.onLastSentence();
      }, { class: 'btn--play guide__next' }));
    } else if (this.step === 'complete') {
      actions.push(button(COACH_UI.continueHere, () => this.callbacks.finish(false), { class: 'btn--play' }));
      actions.push(button(COACH_UI.startFresh, () => this.callbacks.finish(true), { class: 'btn--ghost' }));
    } else {
      actions.push(h('span', { class: 'guide__instruction' }, COACH_UI.doIt));
    }
    replaceChildren(this.actions, ...actions);
    this.shouldReveal = true;
    this.schedule();
    queueMicrotask(() => this.actions.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }));
  }

  private isPaused(): boolean {
    return !!this.root.querySelector('.modal-layer[aria-hidden="false"]') || document.body.dataset.story === 'on' || document.body.dataset.storyBeat === 'on';
  }
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

  private find(target: TutorialTarget): HTMLElement | null {
    if (target === 'none') return null;
    const el = this.root.querySelector<HTMLElement>(TARGETS[target]);
    return el && el.isConnected && el.getClientRects().length && !el.closest('[hidden]') ? el : null;
  }

  private resolveTarget(): HTMLElement | null {
    if (!this.step) return null;
    const info = tutorialStep(this.step);
    const line = info.lines[Math.min(this.sentence, info.lines.length - 1)];
    let target = this.find(line.target ?? info.target) ?? (line.target ? this.find(info.target) : null);
    if (this.step === 'keep' && this.onLastSentence()) {
      if (this.root.querySelector('.sel__grid .sslot.is-picked')) {
        target = this.root.querySelector('.sel__btns .btn--play');
        setText(this.line, COACH_UI.keepTitle);
      } else if (!target) {
        target = this.root.querySelector('.sel__btns .btn--ghost');
      }
    }
    return target;
  }

  private layout(): void {
    if (this.destroyed || !this.step) return;
    const paused = this.isPaused();
    this.overlay.hidden = paused;
    if (paused) { this.wasPaused = true; return; }
    // A closed window (story, client, note) may have scrolled the page: show the control again.
    if (this.wasPaused) { this.wasPaused = false; this.shouldReveal = true; }
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
    const narrow = width < 600;
    const margin = narrow ? 8 : 16;
    const panelWidth = Math.min(width - margin * 2, narrow ? 560 : 420);
    this.panel.style.width = `${panelWidth}px`;
    this.panel.dataset.place = '';
    const panelHeight = this.panel.getBoundingClientRect().height;
    const availableHeight = Math.max(100, height - panelHeight - margin * 3);
    // On a short screen, light the card itself; its repeated description can stay below the fold.
    const focusNode = this.target && this.target.getBoundingClientRect().height > availableHeight
      ? this.target.querySelector<HTMLElement>('.sa-card') ?? this.target
      : this.target;
    if (this.shouldReveal && focusNode && !this.busy) {
      focusNode.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      if (narrow && this.root.classList.contains('is-responsive')) {
        // The bubble docks at the bottom on phones: keep the control in the space above it.
        const rect = focusNode.getBoundingClientRect();
        const desiredTop = topInset + margin + Math.max(0, (availableHeight - rect.height) / 2);
        window.scrollBy({ top: rect.top - desiredTop, behavior: 'instant' });
      }
      this.shouldReveal = false;
    }
    const dockBottom: Box = { left: Math.max(margin, (width - panelWidth) / 2), top: topInset + height - panelHeight - margin, width: panelWidth, height: panelHeight };
    const dockTop: Box = { ...dockBottom, top: topInset + margin };
    let panelBox: Box = dockBottom;
    let hole: Box | null = null;
    if (focusNode) {
      const rect = focusNode.getBoundingClientRect();
      const left = Math.max(0, rect.left - PAD);
      const top = Math.max(topInset, rect.top - PAD);
      hole = { left, top, width: Math.max(0, Math.min(width, rect.right + PAD) - left), height: Math.max(0, Math.min(topInset + height, rect.bottom + PAD) - top) };
      const clampX = (x: number) => Math.min(Math.max(margin, x), width - panelWidth - margin);
      const clampY = (y: number) => Math.min(Math.max(topInset + margin, y), topInset + height - panelHeight - margin);
      const near: [string, Box][] = narrow ? [] : [
        ['below', { left: clampX(hole.left), top: hole.top + hole.height + GAP, width: panelWidth, height: panelHeight }],
        ['above', { left: clampX(hole.left), top: hole.top - panelHeight - GAP, width: panelWidth, height: panelHeight }],
        ['right', { left: hole.left + hole.width + GAP, top: clampY(hole.top), width: panelWidth, height: panelHeight }],
        ['left', { left: hole.left - panelWidth - GAP, top: clampY(hole.top), width: panelWidth, height: panelHeight }],
      ];
      const fits = (b: Box) => b.left >= margin - 0.5 && b.top >= topInset + margin - 0.5 && b.left + b.width <= width - margin + 0.5 && b.top + b.height <= topInset + height - margin + 0.5;
      const found = near.find(([, b]) => fits(b) && overlap(b, hole!) === 0);
      if (found) {
        panelBox = found[1];
        this.panel.dataset.place = found[0];
      } else {
        panelBox = [dockBottom, dockTop].reduce((best, candidate) => overlap(candidate, hole!) < overlap(best, hole!) ? candidate : best);
        this.panel.dataset.place = panelBox === dockTop ? 'dock-top' : 'dock-bottom';
      }
    }
    this.position(this.panel, panelBox);
    if (!hole || hole.width <= 0 || hole.height <= 0) {
      this.frame.hidden = true;
      this.position(this.shades[0], { left: 0, top: 0, width, height: window.innerHeight });
      this.shades.slice(1).forEach((shade) => { shade.hidden = true; });
    } else {
      this.frame.hidden = false;
      this.position(this.frame, hole);
      this.hint.hidden = !this.onLastSentence() || this.step === 'complete' || this.busy;
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
