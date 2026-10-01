// 출하 화면 (phase 'play') — 무대 + 손패 + 버튼 + 꼬투리. 점수 연출은 ScoreTrace.steps 를 그대로 재생한다.
import { audio } from '../../audio';
import type { RunState, ScoreStep, ScoreTrace } from '../../contract/game';
import { hasGlasses } from '../cards';
import type { Ctx } from '../ctx';
import { h, setText, button, replaceChildren } from '../h';
import * as fmt from '../fmt';
import { motion, play, wait, all, skipAll, rectIn, flipFrom } from '../motion';
import { fx, between } from '../rng';
import { HandView, HAND_CARD_W, type HandItem } from './hand';
import type { Sidebar } from './sidebar';
import type { JokerBar } from './topbar';
import { colorExpectationText, deliveryGoals, knownColorExpectation, selectedGoalText } from '../learning';

export class PlayView {
  readonly el: HTMLElement;
  readonly hand: HandView;
  private stageRow: HTMLElement;
  private banner: HTMLElement;
  private playBtn: HTMLButtonElement;
  private discardBtn: HTMLButtonElement;
  private sortBrix: HTMLButtonElement;
  private sortSuit: HTMLButtonElement;
  private previewEl: HTMLElement;
  private predictionEl: HTMLElement;
  private requestEl: HTMLElement;
  readonly podBtn: HTMLButtonElement;
  private podCount: HTMLElement;
  private podFill: HTMLElement;
  private sortBy: 'brix' | 'suit' = 'brix';
  private scoringNow = false;

  constructor(
    private ctx: Ctx,
    private side: Sidebar,
    private jokers: JokerBar,
  ) {
    this.hand = new HandView(ctx);
    this.hand.onChange = () => this.refreshPreview();
    this.stageRow = h('div', { class: 'playrow', 'aria-live': 'polite' });
    this.banner = h('div', { class: 'banner', 'aria-hidden': 'true' });
    this.previewEl = h('div', { class: 'preview', 'aria-live': 'polite' });
    this.predictionEl = h('div', { class: 'play__prediction' });
    this.requestEl = h('div', { class: 'play__request', 'aria-live': 'polite' });
    this.playBtn = button(h('span', null, '출하'), () => void this.doPlay(), { class: 'btn--play', 'aria-keyshortcuts': 'Enter', title: '출하 (Enter)' });
    this.discardBtn = button(h('span', null, '솎아내기'), () => void this.doDiscard(), { class: 'btn--discard', 'aria-keyshortcuts': 'D', title: '솎아내기 (D)' });
    this.sortBrix = button('당도', () => this.sort('brix'), { class: 'btn--seg', 'aria-pressed': 'true', title: '당도순 정렬 (S)' });
    this.sortSuit = button('빛깔', () => this.sort('suit'), { class: 'btn--seg', 'aria-pressed': 'false', title: '빛깔순 정렬 (S)' });
    this.podCount = h('span', { class: 'pod__count num' });
    this.podFill = h('span', { class: 'pod__fill' });
    this.podBtn = h(
      'button',
      { type: 'button', class: 'pod', 'aria-label': '씨앗 꼬투리 — 남은 씨앗 분포 보기', onclick: () => !ctx.isBusy() && ctx.open.pod() },
      h('span', { class: 'pod__shell', 'aria-hidden': 'true' }, this.podFill, h('i'), h('i'), h('i')),
      this.podCount,
      h('span', { class: 'pod__lbl' }, '꼬투리'),
    );
    ctx.tips.attach(this.podBtn, '남은 씨앗의 빛깔·당도 분포를 봐요');
    this.hand.dealFrom = () => this.podBtn.getBoundingClientRect();
    this.el = h(
      'div',
      { class: 'view view--play' },
      h('div', { class: 'play__brief' }, this.predictionEl, this.requestEl),
      this.stageRow,
      this.banner,
      this.hand.el,
      h(
        'div',
        { class: 'actions' },
        this.playBtn,
        h('div', { class: 'sortbox', role: 'group', 'aria-label': '정렬' }, h('span', { class: 'sortbox__lbl' }, '정렬'), this.sortBrix, this.sortSuit),
        this.discardBtn,
        this.previewEl,
      ),
      this.podBtn,
    );
    // 연출 중 무대를 누르면 빨리 감기
    this.el.addEventListener('pointerdown', () => {
      if (this.scoringNow) skipAll();
    });
  }

  update(s: RunState): Promise<void> {
    const prediction = s.prediction;
    this.predictionEl.hidden = !prediction;
    if (prediction) {
      const chosen = prediction.choice === 'ruby' ? '루비가 많음' : prediction.choice === 'gold' ? '골드가 많음' : '비슷함';
      const a = s.cross ? this.ctx.game.plantById(s.cross.a) : undefined;
      const b = s.cross ? this.ctx.game.plantById(s.cross.b) : undefined;
      const cold = s.orders[s.orderIdx].boss?.id === 'coldsnap' && !s.jokers.some((j) => j.id === 'climateHouse');
      const expected = cold ? null : knownColorExpectation(a, b);
      replaceChildren(this.predictionEl,
        h('div', { class: 'play__prediction-head' }, h('b', null, '교배 결과'), h('span', null, `내 예측: ${chosen}`)),
        h('div', { class: 'play__comparison' },
          h('span', null, expected ? colorExpectationText(expected) : cold ? '기대: 비분리 때문에 단순 비율 적용 어려움' : '기대: 공개된 정보로 계산하기 어려움'),
          h('strong', null, `관찰 ${prediction.ruby + prediction.gold}알: 루비 ${prediction.ruby} · 골드 ${prediction.gold}`),
        ),
        h('details', { class: 'play__evidence' },
          h('summary', null, '예측과 관찰값을 어떻게 읽나요?'),
          expected ? h('p', null, `${expected.a} × ${expected.b} → ${expected.offspring}. ${expected.reasoning}`) : h('p', null, cold
            ? '냉해 계약에서는 염색체 비분리가 늘어납니다. 정상 감수분열의 RR·Rr·rr 비율을 그대로 적용할 수 없어요. 실제 핵형과 자손 분포를 함께 관찰하세요.'
            : '부모의 유전자형이 모두 공개되지 않았거나 배수성·편집 상태가 달라 정확한 기대 비율을 표시하지 않았습니다. 검사 결과와 여러 꼬투리의 관찰을 함께 보세요.'),
          h('p', null, expected && (expected.gold === 0 || expected.ruby === 0)
            ? '이 R 자리 교배는 과육색 한 종류만 기대됩니다. 무늬·당도 같은 다른 형질은 별도로 살펴보세요.'
            : '52알은 한 번의 관찰입니다. 표본이 작으면 기대 비율과 차이가 날 수 있어요. 한 꼬투리만으로 부모 유전자형이나 다음 결과를 확정할 수 없습니다.'),
        ),
      );
    }
    setText(this.podCount, `${s.pod.length}/${s.podTotal}`);
    this.podFill.style.setProperty('--f', String(s.podTotal ? s.pod.length / s.podTotal : 0));
    const p = this.hand.update(s.hand, hasGlasses(s));
    this.refreshPreview();
    return p;
  }

  relayout(): void {
    this.hand.layout();
  }

  refreshPreview(): void {
    const s = this.ctx.game.state;
    const sel = this.hand.selectedInOrder();
    const busy = this.ctx.isBusy() || s.phase !== 'play';
    const order = s.orders[s.orderIdx];
    this.requestEl.hidden = !order.goals?.length && !order.requestedColor;
    if (order.goals?.length) {
      const cards = s.hand.filter((c) => sel.includes(c.uid));
      replaceChildren(this.requestEl,
        deliveryGoals(order, s.delivery, true),
        cards.length ? h('p', { class: 'play__delivery-preview' }, `이대로 출하하면 · ${selectedGoalText(order, s.delivery, cards)}`) : h('p', { class: 'play__delivery-preview' }, '필수 형질과 목표 점수를 모두 채우면 계약이 끝납니다.'),
      );
    } else if (order.requestedColor) {
      setText(this.requestEl, `추가 보상: ${order.requestedColor === 'ruby' ? '루비' : '골드'} 과육 · ${s.requestFulfilled ? '출하 완료 (+$2)' : '출하하면 +$2'}`);
    }
    this.playBtn.disabled = busy || sel.length === 0 || s.handsLeft <= 0;
    this.discardBtn.disabled = busy || sel.length === 0 || s.discardsLeft <= 0;
    this.sortBrix.disabled = busy;
    this.sortSuit.disabled = busy;
    if (sel.length === 0) {
      this.side.preview(null);
      setText(this.previewEl, s.phase === 'play' ? `모종을 1~${s.maxSelect}포기 골라요` : '');
      this.previewEl.classList.remove('is-on');
      return;
    }
    const ev = this.ctx.game.evaluate(sel);
    this.side.preview(ev ? { name: ev.name, level: ev.level, chips: ev.chips, mult: ev.mult } : null);
    const sim = this.ctx.game.simulate(sel);
    const requested = order.requestedColor;
    const requestHit = requested && !s.requestFulfilled && sim?.scoringUids.some((uid) => s.hand.some((c) => c.uid === uid && !c.debuffed && c.pheno.sex !== 'M' && c.pheno.color === requested));
    replaceChildren(
      this.previewEl,
      h('span', { class: 'preview__hand' }, ev ? `${ev.name}` : ''),
      sim ? h('span', { class: 'preview__score' }, `예상 ${fmt.score(sim.total)}점`) : null,
      sim?.cleared ? h('span', { class: 'preview__clear' }, '계약 완료!') : null,
      sim && !sim.cleared && s.roundScore + sim.total >= order.target ? h('span', { class: 'preview__need' }, '점수 달성 · 필수 납품 남음') : null,
      requestHit ? h('span', { class: 'preview__request' }, '의뢰 빛깔 보너스 +$2') : null,
    );
    this.previewEl.classList.add('is-on');
  }

  sort(by?: 'brix' | 'suit'): void {
    if (this.ctx.isBusy() || this.ctx.game.state.phase !== 'play') return;
    this.sortBy = by ?? (this.sortBy === 'brix' ? 'suit' : 'brix');
    this.sortBrix.setAttribute('aria-pressed', String(this.sortBy === 'brix'));
    this.sortSuit.setAttribute('aria-pressed', String(this.sortBy === 'suit'));
    this.ctx.game.sortHand(this.sortBy);
  }

  toggleByKey(n: number): void {
    const uid = this.hand.uids[n - 1];
    if (uid) this.hand.toggle(uid);
  }

  /** 빨리 감기 (Space) */
  fastForward(): boolean {
    if (!this.scoringNow) return false;
    skipAll();
    return true;
  }

  // ─────────────────────────────────────────── 솎아내기
  async doDiscard(uidsIn?: string[]): Promise<void> {
    const g = this.ctx.game;
    const s = g.state;
    if (this.ctx.isBusy() || s.phase !== 'play') return;
    const uids = uidsIn ?? this.hand.selectedInOrder();
    if (uids.length === 0) return;
    if (s.discardsLeft <= 0) {
      this.ctx.toast.error('솎아내기를 다 썼어요.');
      return;
    }
    await this.ctx.lock(async () => {
      const items = this.hand.takeOut(uids);
      audio.play('discard');
      g.discard(uids);
      const jobs = items.map((it, i) =>
        play(it.wrap, [{ translate: '0 0', rotate: '0deg', opacity: 1 }, { translate: `${420 + i * 30}px ${-180 - i * 12}px`, rotate: `${between(fx, 25, 60)}deg`, opacity: 0 }], {
          duration: 420,
          delay: i * 50,
          easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)',
        }).then(() => it.wrap.remove()),
      );
      await all(jobs);
    });
  }

  // ─────────────────────────────────────────── 출하 + 점수 연출
  async doPlay(uidsIn?: string[]): Promise<void> {
    const g = this.ctx.game;
    const s = g.state;
    if (this.ctx.isBusy() || s.phase !== 'play') return;
    const uids = uidsIn ?? this.hand.selectedInOrder();
    if (uids.length === 0 || s.handsLeft <= 0) return;
    const target = s.orders[s.orderIdx].target;
    const before = s.roundScore;
    await this.ctx.lock(async () => {
      let trace: ScoreTrace;
      try {
        trace = g.play(uids);
      } catch (e) {
        this.ctx.toast.error(e instanceof Error ? e.message : '출하할 수 없어요.');
        return;
      }
      this.scoringNow = true;
      this.el.classList.add('is-scoring');
      motion.skip = false;
      try {
        await this.runScoring(uids, trace, before, target);
      } finally {
        this.scoringNow = false;
        this.el.classList.remove('is-scoring');
        motion.skip = false;
      }
    });
  }

  private async runScoring(uids: string[], trace: ScoreTrace, before: number, target: number): Promise<void> {
    const side = this.side;
    side.scoring = true;
    this.refreshPreview();
    audio.play('play');
    // ① 출하 카드가 무대로
    const ordered = this.hand.uids.filter((u) => uids.includes(u));
    const firsts = new Map<string, DOMRect>();
    for (const u of ordered) {
      const it = this.hand.item(u);
      if (it) firsts.set(u, it.wrap.getBoundingClientRect());
    }
    const items = this.hand.takeOut(ordered);
    const byUid = new Map<string, HandItem>(items.map((it) => [it.uid, it]));
    const n = items.length;
    const W = this.stageRow.clientWidth || 700;
    const gap = Math.min(HAND_CARD_W + 14, (W - HAND_CARD_W) / Math.max(1, n - 1));
    const x0 = (W - (HAND_CARD_W + gap * (n - 1))) / 2;
    items.forEach((it, i) => {
      it.card.classList.remove('is-selected');
      it.wrap.classList.remove('is-selected');
      it.wrap.classList.add('is-played');
      it.wrap.style.transform = `translate(${(x0 + i * gap).toFixed(1)}px, 18px)`;
      it.wrap.style.zIndex = String(10 + i);
      this.stageRow.appendChild(it.wrap);
    });
    this.hand.layout();
    await all(items.map((it, i) => flipFrom(it.wrap, firsts.get(it.uid) ?? it.wrap.getBoundingClientRect(), { duration: 380, delay: i * 40 })));
    // 점수 내는 카드는 살짝 위로
    const scoring = new Set(trace.scoringUids);
    for (const it of items) {
      if (scoring.has(it.uid)) it.wrap.classList.add('is-scoring');
      else it.wrap.classList.add('is-idle');
    }
    await wait(160);

    // ② 족보 이름
    const first = trace.steps[0];
    side.setHand(trace.handName, trace.level);
    this.showBanner(trace.handName, `Lv.${trace.level}`);
    if (first && first.kind === 'hand') {
      await all([side.setChips(first.chipsAfter), side.setMult(first.multAfter)]);
    }
    await wait(520);
    this.hideBanner();

    // ③ 단계마다
    let chipN = 0;
    for (const step of trace.steps.slice(first?.kind === 'hand' ? 1 : 0)) {
      const el = this.stepTarget(step, byUid);
      await this.runStep(step, el, chipN);
      if (step.chips) chipN++;
    }
    this.hideBanner();

    // ④ 합계
    const last = trace.steps[trace.steps.length - 1];
    const chips = last ? last.chipsAfter : 0;
    const mult = last ? last.multAfter : 0;
    audio.play('scoreTally', { intensity: Math.min(1, trace.total / Math.max(1, target)) });
    const totalEl = h('div', { class: 'tally' }, h('span', { class: 'tally__cm' }, h('b', { class: 'c' }, fmt.mult(chips)), ' × ', h('b', { class: 'm' }, fmt.mult(mult))), h('span', { class: 'tally__num num' }, fmt.score(trace.total)));
    this.el.appendChild(totalEl);
    await play(totalEl, [{ opacity: 0, scale: '0.4' }, { opacity: 1, scale: '1.15' }, { scale: '1' }], { duration: 480, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
    this.shake(Math.min(1, trace.total / Math.max(1, target)) * 0.8 + 0.2);
    await wait(420);
    // 이번 주문 점수로 날아간다
    const from = rectIn(totalEl, this.ctx.stage);
    const to = rectIn(side.roundEl, this.ctx.stage);
    await play(totalEl, [{ translate: '0 0', scale: '1', opacity: 1 }, { translate: `${to.cx - from.cx}px ${to.cy - from.cy}px`, scale: '0.35', opacity: 0.2 }], { duration: 440, easing: 'cubic-bezier(0.6, 0, 0.8, 0.4)' });
    totalEl.remove();
    const after = before + trace.total;
    await side.setRound(after, true);
    if (trace.cleared) {
      side.burst();
      this.ctx.bg?.pulse(1);
      this.sparks(to);
    } else {
      this.ctx.bg?.pulse(Math.min(0.8, 0.25 + trace.total / Math.max(1, target)));
    }
    side.setChips(0, false);
    side.setMult(0, false);
    await wait(260);

    // ⑤ 출하 카드는 오른쪽으로 날아가 사라짐
    await all(
      items.map((it, i) =>
        play(it.wrap, [{ translate: '0 0', opacity: 1 }, { translate: `${560 - i * 40}px ${-40 - i * 10}px`, rotate: `${between(fx, 8, 22)}deg`, opacity: 0 }], {
          duration: 380,
          delay: i * 45,
          easing: 'cubic-bezier(0.5, 0, 0.9, 0.5)',
        }).then(() => it.wrap.remove()),
      ),
    );
    for (const it of items) it.wrap.remove();
    side.scoring = false;
  }

  private stepTarget(step: ScoreStep, cards: Map<string, HandItem>): HTMLElement | null {
    if (step.kind === 'boss' || step.kind === 'env') return this.side.el.querySelector('.side__order');
    if (!step.sourceUid) return null;
    const c = cards.get(step.sourceUid);
    if (c) return c.card;
    return this.jokers.elFor(step.sourceUid);
  }

  private async runStep(step: ScoreStep, el: HTMLElement | null, chipN: number): Promise<void> {
    const side = this.side;
    const isX = step.xmult !== undefined;
    const isMult = step.mult !== undefined;
    const isChip = step.chips !== undefined && !isMult && !isX;
    const kind = isX ? 'x' : isMult ? 'mult' : isChip ? 'chip' : step.label === '무효' ? 'void' : 'info';
    if (el) {
      el.classList.remove('is-trigger');
      void el.offsetWidth;
      el.classList.add('is-trigger');
      window.setTimeout(() => el.classList.remove('is-trigger'), 520);
    }
    if (step.kind === 'joker' && el) void play(el, [{ scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: 300, decorative: true });
    if (kind === 'chip') audio.play('chip', { step: chipN });
    else if (kind === 'mult') audio.play('mult');
    else if (kind === 'x') audio.play(step.xmult !== undefined && step.xmult < 1 ? 'bossReveal' : 'xmult');
    else if (kind === 'void') audio.play('deselect');
    if (step.kind === 'joker') audio.play('jokerTrigger');
    this.popup(el, step.label, kind);
    const jobs: Promise<void>[] = [];
    if (step.chips !== undefined) jobs.push(side.setChips(step.chipsAfter));
    if (isMult || isX) jobs.push(side.setMult(step.multAfter, true, isX));
    if (isX && (step.xmult ?? 1) >= 1) this.shake(0.5);
    if (isX && (step.xmult ?? 1) < 1) this.shake(0.8);
    await all(jobs);
    await wait(isX ? 420 : step.kind === 'joker' ? 340 : 300);
  }

  private popup(el: HTMLElement | null, label: string, kind: string): void {
    const stageEl = this.ctx.stage;
    const r = el ? rectIn(el, stageEl) : rectIn(this.side.chipsBox, stageEl);
    const p = h('div', { class: ['pop', `pop--${kind}`] }, label);
    p.style.left = `${r.cx}px`;
    p.style.top = `${r.y + 8}px`;
    stageEl.appendChild(p);
    void play(p, [{ opacity: 0, translate: '-50% 10px', scale: '0.6' }, { opacity: 1, translate: '-50% -18px', scale: kind === 'x' ? '1.3' : '1.05', offset: 0.25 }, { opacity: 1, translate: '-50% -30px', scale: '1', offset: 0.75 }, { opacity: 0, translate: '-50% -44px', scale: '0.95' }], {
      duration: 820,
      easing: 'ease-out',
    }).then(() => p.remove());
    if (motion.fast || motion.skip) p.remove();
  }

  private showBanner(title: string, sub: string): void {
    this.banner.replaceChildren(h('div', { class: 'banner__t' }, title), h('div', { class: 'banner__s' }, sub));
    this.banner.classList.add('is-on');
    void play(this.banner, [{ opacity: 0, scale: '0.5', letterSpacing: '0.4em' }, { opacity: 1, scale: '1.08' }, { opacity: 1, scale: '1', letterSpacing: '0.02em' }], { duration: 420, easing: 'cubic-bezier(0.2, 1.3, 0.4, 1)' });
  }

  private hideBanner(): void {
    this.banner.classList.remove('is-on');
  }

  /** 화면 흔들림 (장식) */
  private shake(strength: number): void {
    if (motion.reduced) return;
    const a = 3 + strength * 7;
    const kf: Keyframe[] = [];
    for (let i = 0; i < 6; i++) kf.push({ translate: `${between(fx, -a, a).toFixed(1)}px ${between(fx, -a, a).toFixed(1)}px` });
    kf.push({ translate: '0 0' });
    void play(this.ctx.stage.querySelector('.run') ?? this.el, kf, { duration: 300, easing: 'linear', decorative: true });
  }

  private sparks(at: { cx: number; cy: number }): void {
    if (motion.reduced || motion.fast) return;
    const stageEl = this.ctx.stage;
    for (let i = 0; i < 22; i++) {
      const s = h('i', { class: 'spark' });
      s.style.left = `${at.cx}px`;
      s.style.top = `${at.cy}px`;
      stageEl.appendChild(s);
      const ang = fx() * Math.PI * 2;
      const dist = 40 + fx() * 110;
      void play(s, [{ translate: '0 0', opacity: 1, scale: '1' }, { translate: `${Math.cos(ang) * dist}px ${Math.sin(ang) * dist - 30}px`, opacity: 0, scale: '0.2' }], { duration: 700 + fx() * 400, easing: 'cubic-bezier(0.1, 0.7, 0.3, 1)' }).then(() => s.remove());
    }
  }
}
