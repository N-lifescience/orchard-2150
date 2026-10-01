import type { RunState } from '../contract/game';
import { button, h, replaceChildren } from './h';
import { tutorialStep, type TutorialStep, type TutorialTarget } from './tutorialFlow';

const TARGETS: Record<TutorialTarget, string> = {
  order: '.view--cross .ordercard', garden: '.view--cross .garden', prediction: '.cross__prediction',
  cross: '.cross__bar .btn--play', observation: '.play__prediction', hand: '.hand',
  shipment: '.actions .btn--play', cashout: '.cash .btn--gold', selection: '.sel__bottom',
  shop: '.shop__side', review: '.review-layout', none: '',
};

export class PracticeCoach {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private body: HTMLElement;
  private evidence: HTMLElement;
  private count: HTMLElement;
  private progress: HTMLProgressElement;
  private actions: HTMLElement;
  private collapse: HTMLButtonElement;
  private stop: HTMLButtonElement;
  private step: TutorialStep | null = null;
  private target: HTMLElement | null = null;
  private buttons: HTMLButtonElement[] = [];
  private folded = false;

  constructor(private root: HTMLElement, private callbacks: { acknowledge(step: TutorialStep): void; stop(): void; finish(fresh: boolean): void }) {
    this.title = h('h2', { class: 'coach__title' });
    this.body = h('p', { class: 'coach__body' });
    this.evidence = h('p', { class: 'coach__evidence' });
    this.count = h('span', { class: 'coach__count' });
    this.progress = h('progress', { class: 'coach__progress', max: 10, value: 0, 'aria-label': '실습 진행' });
    this.actions = h('div', { class: 'coach__actions' });
    this.collapse = button('안내 접기', () => {
      this.folded = !this.folded;
      this.el.classList.toggle('is-folded', this.folded);
      this.collapse.textContent = this.folded ? '안내 펼치기' : '안내 접기';
      this.collapse.setAttribute('aria-expanded', String(!this.folded));
    }, { class: 'btn--ghost', 'aria-expanded': 'true' });
    this.stop = button('안내 종료', () => callbacks.stop(), { class: 'btn--ghost' });
    this.el = h('aside', { class: 'coach', 'aria-label': '레아의 플레이 튜토리얼' },
      h('div', { class: 'coach__head' }, h('span', { class: 'coach__manager' }, '레아 모레노 · 첫 계약 실습'), this.count, this.collapse, this.stop),
      this.progress,
      h('div', { class: 'coach__instruction', 'aria-live': 'polite', 'aria-atomic': 'true' }, this.title, this.body, this.evidence),
      this.actions,
    );
  }

  update(step: TutorialStep, state: RunState, feedback: string, busy: boolean): void {
    const info = tutorialStep(step);
    this.count.textContent = `${info.number} / ${info.total}`;
    this.progress.value = step === 'complete' ? 10 : info.number - 1;
    this.title.textContent = info.title;
    this.body.textContent = info.body;
    this.evidence.textContent = feedback;
    this.evidence.hidden = !feedback;
    this.stop.hidden = step === 'complete';
    this.stop.disabled = busy;
    if (this.step !== step) {
      this.step = step;
      this.buttons = [];
      if (step === 'complete') {
        this.buttons.push(button('이 과수원에서 계속하기', () => this.callbacks.finish(false), { class: 'btn--play' }));
        this.buttons.push(button('모드 골라 새로 시작', () => this.callbacks.finish(true), { class: 'btn--ghost' }));
      } else {
        if (info.actionLabel) this.buttons.push(button(info.actionLabel, () => this.callbacks.acknowledge(step), { class: 'btn--play' }));
        this.buttons.push(button('조작 위치 보기', () => {
          if (this.root.classList.contains('is-responsive')) {
            this.folded = true;
            this.el.classList.add('is-folded');
            this.collapse.textContent = '안내 펼치기';
            this.collapse.setAttribute('aria-expanded', 'false');
          }
          this.target?.scrollIntoView({ block: 'center', behavior: 'auto' });
          const control = this.target?.matches('button') ? this.target : this.target?.querySelector<HTMLElement>('button, [role="button"]');
          control?.focus({ preventScroll: true });
        }, { class: 'btn--ghost' }));
      }
      replaceChildren(this.actions, ...this.buttons);
    }
    this.buttons.forEach((button) => { button.disabled = busy; });
    this.target?.classList.remove('coach-target');
    this.target = info.target === 'none' ? null : this.root.querySelector<HTMLElement>(TARGETS[info.target]);
    if (info.target === 'order' && !this.target?.getClientRects().length) this.target = this.root.querySelector('.side__target');
    this.target?.classList.add('coach-target');
    this.el.classList.toggle('is-complete', step === 'complete');
    // State comes from gameplay; the coach never performs a game action itself.
    this.el.dataset.phase = state.phase;
  }

  destroy(): void {
    this.target?.classList.remove('coach-target');
    this.el.parentElement?.classList.remove('has-coach');
    this.el.remove();
  }
}
