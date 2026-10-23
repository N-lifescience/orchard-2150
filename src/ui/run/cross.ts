// 교배 준비 (phase 'cross') — 이번 주문 카드 + 온실 부모 고르기 + 퍼넷 노트 분포 + 교배 연출
import { audio } from '../../audio';
import { bossEmblem, orderEmblem, plantCard, suitGlyph } from '../../art';
import type { ColorPrediction, Plant, RunState } from '../../contract/game';
import type { Distribution, SuitKey } from '../../contract/genetics';
import { hasGlasses, lineageText, phenoSentence, plantView, speciesLabel, viewSig } from '../cards';
import type { Ctx } from '../ctx';
import { h, setText, button, replaceChildren } from '../h';
import * as fmt from '../fmt';
import { play, wait, all, rectIn, motion } from '../motion';
import { fx } from '../rng';
import { attachTilt } from './hand';
import { canUseThinking, colorExpectationText, contractExample, deliveryGoals, goalRetryHint, knownColorExpectation, parentReason } from '../learning';
import { exampleSelection, learningTools, memoryFor } from '../learningFlow';
import { openThinkingHelper } from '../thinkingHelper';
import { openNoteSheet } from '../story/noteView';
import { CONCEPT_PICTURES } from '../conceptPlate';
import { explainImage, traitBadge } from '../traitBadge';
import { colorPredictionChoices } from '../predictionChoices';
import { locusLetters } from '../cards';

const SUITS: SuitKey[] = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];

export function plantTip(ctx: Ctx, p: Plant): HTMLElement {
  const g = ctx.game;
  return h(
    'div',
    null,
    h('b', null, p.name),
    h('div', null, `${speciesLabel(p.pheno)} · ${phenoSentence(p.pheno, p.pheno.brix)}`),
    h('div', { class: 'tip__sub' }, lineageText(p, (id) => g.plantById(id))),
    p.revealed ? h('div', { class: 'tip__geno' }, '유전자형 공개됨') : null,
    !p.pheno.fertile ? h('div', { class: 'tip__rule' }, '3배체라 씨를 만들지 못해요(불임)') : null,
  );
}

export class CrossView {
  readonly el: HTMLElement;
  private orderCard: HTMLElement;
  private garden: HTMLElement;
  private gardenPage = 0;
  private gardenCount = h('span', { 'aria-live': 'polite' });
  private gardenPrev = button('이전', () => this.showGardenPage(this.gardenPage - 1), { class: 'btn--ghost', 'aria-label': '온실 이전 쪽' });
  private gardenNext = button('다음', () => this.showGardenPage(this.gardenPage + 1), { class: 'btn--ghost', 'aria-label': '온실 다음 쪽' });
  private gardenNav = h('nav', { class: 'garden-pages', 'aria-label': '온실 쪽 넘기기' }, this.gardenPrev, this.gardenCount, this.gardenNext);
  private pickA: HTMLElement;
  private pickB: HTMLElement;
  private reason: HTMLElement;
  private crossBtn: HTMLButtonElement;
  private selfBtn: HTMLButtonElement;
  private previewBox: HTMLElement;
  private predictionBox: HTMLElement;
  private guidanceBox: HTMLElement;
  private exampleBtn: HTMLButtonElement;
  private helpBtn: HTMLButtonElement;
  private memoryBtn: HTMLButtonElement;
  private autoHelpKey = '';
  private prediction: ColorPrediction | null = null;
  private selfingSelected = false;
  private predictionButtons: HTMLButtonElement[] = [];
  private sel: string[] = [];
  private items = new Map<string, { wrap: HTMLElement; sig: string }>();
  private orderKey = '';
  /** 교배 연출 뒤 자손 덱 모양이 날아갈 곳 */
  podTarget: () => { cx: number; cy: number } | null = () => null;

  constructor(private ctx: Ctx) {
    this.orderCard = h('div', { class: 'ordercard panel' });
    this.garden = h('div', { class: 'garden', role: 'group', 'aria-label': '온실 — 부모로 쓸 개체 고르기' });
    this.pickA = h('div', { class: 'pick' });
    this.pickB = h('div', { class: 'pick' });
    this.reason = h('div', { class: 'cross__reason', 'aria-live': 'polite' });
    this.crossBtn = button('교배하기', () => void this.doCross(), { class: 'btn--play', 'aria-keyshortcuts': 'Enter' });
    this.selfBtn = button('자가수분 선택', () => {
      if (!this.selfingSelected) {
        this.selfingSelected = true;
        this.refresh();
      } else void this.doCross(true);
    }, { class: 'btn--gold' });
    this.previewBox = h('div', { class: 'punnett' });
    this.guidanceBox = h('div', { class: 'cross__guidance', 'aria-live': 'polite' });
    this.exampleBtn = button('첫 교배 시범', () => this.chooseExample(), { class: 'btn--gold cross__example' });
    this.memoryBtn = button('지난 기록', () => this.openMemory(), { class: 'btn--ghost cross__memory' });
    this.helpBtn = button('생각 도우미', () => this.openHelp(), { class: 'btn--ghost cross__help' });
    this.predictionBox = h('div', { class: 'cross__prediction', role: 'group', 'aria-label': '교배 결과 예측' });
    this.predictionButtons = colorPredictionChoices((value) => {
      this.prediction = value;
      this.refresh();
    });
    replaceChildren(
      this.predictionBox,
      h('div', { class: 'cross__prediction-title' }, '자손 52개체, 어느 과육색이 많을까요?'),
      h('div', { class: 'cross__prediction-actions' }, ...this.predictionButtons),
      h('p', { class: 'hint' }, '먼저 고르고, 교배 뒤에 비교해요.'),
    );
    this.el = h(
      'div',
      { class: 'view view--cross' },
      this.orderCard,
      h(
        'div',
        { class: 'cross__right' },
        h('div', { class: 'cross__head' },
          h('div', { class: 'cross__headrow' }, h('h2', { class: 'h2' }, '교배할 부모 선택'), h('div', { class: 'cross__tools' }, this.exampleBtn, this.helpBtn, this.memoryBtn)),
          h('p', { class: 'hint' }, '같은 종 두 개체를 고르거나 한 개체를 골라 자가수분하세요.'),
        ),
        this.guidanceBox,
        this.garden, this.gardenNav,
        h('div', { class: 'cross__bar' }, this.pickA, h('span', { class: 'cross__x', 'aria-hidden': 'true' }, '×'), this.pickB, this.selfBtn, this.crossBtn),
        this.reason,
        h('div', { class: 'cross__insights' }, this.predictionBox, this.previewBox),
      ),
    );
  }

  reset(): void {
    this.sel = [];
    this.gardenPage = 0;
    this.prediction = null;
    this.selfingSelected = false;
  }

  get tutorialInteraction(): { parentCount: number; predicted: boolean } {
    return { parentCount: this.selfingSelected && this.sel.length === 1 ? 2 : this.sel.length, predicted: !!this.prediction };
  }
  get chosenParents(): string[] {
    return this.selfingSelected && this.sel.length === 1 ? [this.sel[0], this.sel[0]] : this.sel.slice();
  }

  update(s: RunState): void {
    this.renderOrder(s);
    const alive = new Set(s.garden.map((p) => p.id));
    this.sel = this.sel.filter((id) => alive.has(id));
    for (const [id, it] of this.items) {
      if (!alive.has(id)) {
        it.wrap.remove();
        this.items.delete(id);
      }
    }
    const glasses = hasGlasses(s);
    const kids: HTMLElement[] = [];
    s.garden.forEach((p, i) => {
      const v = plantView(p, { glasses, subtitle: lineageText(p, (id) => this.ctx.game.plantById(id)) });
      const sig = viewSig(v);
      let it = this.items.get(p.id);
      if (!it) {
        const id = p.id;
        const wrap = h('div', { class: 'gslot', role: 'button', tabindex: '0', 'aria-pressed': 'false', style: { '--phase': `${(-fx() * 4).toFixed(2)}s` } });
        wrap.addEventListener('click', () => this.toggle(id));
        wrap.addEventListener('keydown', (e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.toggle(id);
          }
        });
        wrap.addEventListener('pointerenter', () => audio.play('hover'));
        attachTilt(wrap, () => wrap.firstElementChild as HTMLElement | null);
        this.ctx.tips.attach(wrap, () => {
          const cur = this.ctx.game.plantById(id);
          return cur ? plantTip(this.ctx, cur) : null;
        });
        it = { wrap, sig: '' };
        this.items.set(p.id, it);
      }
      if (it.sig !== sig) {
        it.sig = sig;
        it.wrap.replaceChildren(plantCard(v), h('div', { class: 'gslot__readout', 'aria-hidden': 'true' },
          h('strong', null, p.name),
          h('span', null, phenoSentence(p.pheno, p.pheno.brix)),
          v.genotypeText ? h('span', null, `유전자형 ${v.genotypeText}`) : h('span', null, '유전자형 미공개'),
        ));
      }
      it.wrap.setAttribute('aria-label', `${i + 1}. ${p.name}: ${speciesLabel(p.pheno)}, ${phenoSentence(p.pheno, p.pheno.brix)}`);
      kids.push(it.wrap);
    });
    const same = kids.length === this.garden.children.length && kids.every((k, i) => this.garden.children[i] === k);
    if (!same) this.garden.replaceChildren(...kids);
    this.showGardenPage(this.gardenPage);
    this.garden.style.removeProperty('--card-w');
    this.refresh();
  }

  private showGardenPage(page: number): void {
    const items = Array.from(this.garden.children) as HTMLElement[];
    const pages = Math.max(1, Math.ceil(items.length / 4));
    const focus = this.gardenNav.contains(document.activeElement);
    this.gardenPage = Math.max(0, Math.min(pages - 1, page));
    items.forEach((item, i) => { item.hidden = Math.floor(i / 4) !== this.gardenPage; });
    this.gardenNav.hidden = pages === 1;
    this.gardenPrev.disabled = this.gardenPage === 0;
    this.gardenNext.disabled = this.gardenPage === pages - 1;
    setText(this.gardenCount, `${this.gardenPage + 1} / ${pages}`);
    if (focus && (document.activeElement as HTMLButtonElement)?.disabled) {
      (this.gardenPrev.disabled ? this.gardenNext : this.gardenPrev).focus({ preventScroll: true });
    }
  }

  private renderOrder(s: RunState): void {
    const o = s.orders[s.orderIdx];
    const key = `${s.ante}:${s.orderIdx}:${s.orderAttempt}:${o.name}:${o.target}:${o.boss?.desc ?? ''}:${JSON.stringify(s.delivery)}:${JSON.stringify(o.goals)}`;
    if (key === this.orderKey) return;
    this.orderKey = key;
    this.orderCard.dataset.kind = o.kind;
    const kindLabel = o.kind === 'small' ? '지역 납품' : o.kind === 'big' ? '도시 계약' : '특별 주문';
    replaceChildren(
      this.orderCard,
      h('div', { class: 'ordercard__kicker' }, `시즌 ${s.ante} · ${kindLabel}`),
      h('div', { class: 'ordercard__emblem', 'aria-hidden': 'true' }, o.kind === 'boss' && o.boss ? bossEmblem(o.boss, 132) : orderEmblem(o.kind === 'big' ? 'big' : 'small', 120, o.client)),
      h('h2', { class: 'ordercard__name' }, o.name),
      h('p', { class: 'ordercard__client' }, o.client),
      o.goals?.length ? deliveryGoals(o, s.delivery) : o.requestedColor ? traitBadge({ color: o.requestedColor }, `${o.requestedColor === 'ruby' ? '루비' : '골드'} 과육 출하 +$2`) : null,
      h('div', { class: 'ordercard__target' }, h('span', { class: 'side__label' }, '목표 점수'), h('span', { class: 'num' }, fmt.score(o.target))),
      h('div', { class: 'ordercard__reward' }, `보상 $${o.reward}`),
      o.boss ? h('div', { class: 'ordercard__rule' }, h('b', null, '특별 규칙 '), o.boss.desc) : null,
      s.jokers.some((j) => j.id === 'climateHouse') && o.boss ? h('div', { class: 'ordercard__note' }, '기후 적응 온실 덕분에 특별 규칙을 무시해요.') : null,
      s.orderAttempt > 1 ? h('div', { class: 'ordercard__retry' }, `재도전 ${s.orderAttempt}회차 · ${goalRetryHint(o.goals)}`) : null,
    );
    if (o.kind === 'boss') {
      audio.play('bossReveal');
      void play(this.orderCard, [{ opacity: 0, scale: '0.9', rotate: '-2deg' }, { opacity: 1, scale: '1', rotate: '0deg' }], { duration: 500 });
    }
  }

  private toggle(id: string): void {
    if (this.ctx.isBusy()) return;
    const i = this.sel.indexOf(id);
    this.prediction = null;
    this.selfingSelected = false;
    if (i >= 0) {
      this.sel.splice(i, 1);
      audio.play('deselect');
    } else {
      if (this.sel.length >= 2) this.sel.shift();
      this.sel.push(id);
      audio.play('select');
    }
    this.refresh();
  }

  /** 키보드 숫자로 고르기 */
  toggleByKey(n: number): void {
    const p = this.ctx.game.state.garden[n - 1];
    if (p) { this.showGardenPage(Math.floor((n - 1) / 4)); this.toggle(p.id); }
  }

  private refresh(): void {
    const g = this.ctx.game;
    for (const [id, it] of this.items) {
      const on = this.sel.includes(id);
      it.wrap.classList.toggle('is-picked', on);
      it.wrap.setAttribute('aria-pressed', String(on));
      (it.wrap.firstElementChild as HTMLElement | null)?.classList.toggle('is-selected', on);
      it.wrap.dataset.pick = on ? (this.sel.indexOf(id) === 0 ? '부모 1' : '부모 2') : '';
    }
    const name = (id: string | undefined) => (id ? g.plantById(id)?.name ?? '?' : '');
    const [a, b] = this.sel;
    setText(this.pickA, a ? name(a) : '첫째 개체');
    this.pickA.classList.toggle('is-empty', !a);
    setText(this.pickB, b ? name(b) : a && this.selfingSelected ? '자기 자신' : a ? '둘째 개체 (또는 자가수분)' : '둘째 개체');
    this.pickB.classList.toggle('is-empty', !b && !this.selfingSelected);
    const busy = this.ctx.isBusy();
    let reason = '';
    let okCross = false;
    let okSelf = false;
    if (a && b) {
      const r = g.canCross(a, b);
      okCross = r.ok;
      if (!r.ok) reason = r.reason ?? '교배할 수 없어요.';
    } else if (a) {
      const r = g.canCross(a, a);
      okSelf = r.ok;
      if (!r.ok) reason = `자가수분: ${r.reason ?? '할 수 없어요.'}`;
    } else {
      reason = '';
    }
    this.crossBtn.disabled = busy || !okCross || !this.prediction;
    setText(this.selfBtn, this.selfingSelected ? '자가수분 시작' : '자가수분 선택');
    this.selfBtn.disabled = busy || !okSelf || (this.selfingSelected && !this.prediction);
    this.selfBtn.hidden = !a || !!b;
    setText(this.reason, reason);
    this.reason.classList.toggle('is-bad', !!reason);
    const pa = a;
    const pb = b ?? (this.selfingSelected && okSelf ? a : undefined);
    const canPredict = !!pa && !!pb && (b ? okCross : this.selfingSelected && okSelf);
    this.predictionBox.hidden = !canPredict;
    this.predictionButtons.forEach((btn, i) => btn.setAttribute('aria-pressed', String(this.prediction === (['ruby', 'gold', 'even'] as ColorPrediction[])[i])));
    const parentA = pa ? g.plantById(pa) : undefined;
    const parentB = pb ? g.plantById(pb) : undefined;
    const knownParents = !!parentA?.revealed && !!parentB?.revealed;
    const dist = pa && pb && knownParents ? g.preview(pa, pb) : null;
    this.renderPreview(dist, !!this.prediction && g.state.jokers.some((j) => j.id === 'punnettNote'), !!pa && !!pb && !knownParents);
    this.renderGuidance(parentA, parentB);
  }

  private examplePair(): [Plant, Plant] | null {
    const s = this.ctx.game.state;
    const candidates = s.garden.filter((p) => p.revealed && p.genome.ploidy === 2 && !p.pheno.aneuploid);
    const a = candidates.find((p) => locusLetters(p.genome, 'R') === 'RR');
    const b = candidates.find((p) => p.genome.species === a?.genome.species && locusLetters(p.genome, 'R') === 'rr');
    return a && b && this.ctx.game.canCross(a.id, b.id).ok ? [a, b] : null;
  }

  private chooseExample(): void {
    if (this.ctx.isBusy()) return;
    const pair = this.examplePair();
    if (!pair) return;
    const selection = exampleSelection(pair[0].id, pair[1].id);
    this.sel = selection.parents;
    this.selfingSelected = false;
    this.prediction = selection.prediction;
    audio.play('select');
    this.refresh();
  }

  private canThink(a: Plant | undefined, b: Plant | undefined): boolean {
    return canUseThinking(this.ctx.game.state, a, b);
  }

  private renderGuidance(a: Plant | undefined, b: Plant | undefined): void {
    const s = this.ctx.game.state;
    const tools = learningTools(s);
    const expectation = knownColorExpectation(a, b);
    const memory = memoryFor(s.orders[s.orderIdx], s.records, s.discoveries);
    this.exampleBtn.hidden = !tools.example || !this.examplePair();
    setText(this.helpBtn, this.prediction ? '교배 도움' : '생각 도우미');
    this.helpBtn.hidden = !tools.helper || !this.canThink(a, b);
    this.memoryBtn.hidden = !tools.memory || !memory;
    this.exampleBtn.disabled = this.ctx.isBusy();
    this.helpBtn.disabled = this.ctx.isBusy();
    this.guidanceBox.hidden = !tools.helper || (!tools.coach && !a && !b);
    this.guidanceBox.classList.add('is-brief');
    replaceChildren(this.guidanceBox,
      h('span', null, a && b ? parentReason(a, b, !!this.prediction) : '부모 둘을 골라 주세요.'),
      this.prediction && expectation ? h('small', null, colorExpectationText(expectation)) : null,
      tools.autoMemory && memory ? this.memoryLink(memory) : null);
    const key = `${this.ctx.game.getSaveKey()}:${s.seed}:${s.ante}:${s.orderIdx}:${s.orderAttempt}`;
    if (tools.autoHelper && this.canThink(a, b) && !this.prediction && this.autoHelpKey !== key) {
      queueMicrotask(() => {
        if (this.ctx.modals.count || this.ctx.isBusy() || this.prediction || this.ctx.game.state.phase !== 'cross') return;
        this.autoHelpKey = key;
        this.openHelp();
      });
    }
  }

  private memoryLink(memory: NonNullable<ReturnType<typeof memoryFor>>): HTMLElement {
    const r = memory.record;
    const label = `기억나요? 시즌 ${r.ante} · ${r.name}${r.prediction ? ` → 골드 ${r.prediction.gold}개` : ''}`;
    return button(h('span', { class: 'memory-link__body' }, explainImage(CONCEPT_PICTURES[memory.note]), label), () => openNoteSheet(this.ctx, memory.note), { class: 'btn--ghost memory-link' });
  }

  private openMemory(): void {
    const s = this.ctx.game.state;
    if (!learningTools(s).memory) return;
    const memory = memoryFor(s.orders[s.orderIdx], s.records, s.discoveries);
    if (memory) this.ctx.modals.open({ title: '지난 관찰 기록', content: this.memoryLink(memory) });
  }

  private openHelp(): void {
    if (this.ctx.isBusy()) return;
    const s = this.ctx.game.state;
    if (!learningTools(s).helper) return;
    const a = this.ctx.game.plantById(this.sel[0] ?? '');
    const b = this.ctx.game.plantById(this.sel[1] ?? (this.selfingSelected ? this.sel[0] : '') ?? '');
    const expectation = knownColorExpectation(a, b);
    if (!this.prediction) {
      if (expectation && this.canThink(a, b)) openThinkingHelper(this.ctx, [expectation.a, expectation.b]);
      return;
    }
    const lesson = contractExample(s.orders[s.orderIdx], true);
    this.ctx.modals.open({ title: '교배 도움', content: h('div', { class: 'learning-help' },
      h('p', null, parentReason(a, b, true)),
      expectation ? h('p', null, colorExpectationText(expectation)) : null,
      lesson ? h('ol', null, ...lesson.steps.map((step) => h('li', null, step))) : null,
      h('p', { class: 'hint' }, '교배 뒤 실제 자손 수와 비교해 보세요.')) });
  }

  private renderPreview(d: Distribution | null, has: boolean, unknownParents = false): void {
    if (!has) {
      replaceChildren(this.previewBox);
      this.previewBox.hidden = true;
      return;
    }
    this.previewBox.hidden = false;
    if (!d) {
      replaceChildren(this.previewBox, h('div', { class: 'punnett__empty' }, unknownParents
        ? '퍼넷 노트: 비공개 부모가 있어 기대 분포를 계산할 수 없어요. 유전자 검사로 부모를 확인하세요.'
        : '퍼넷 노트: 유전자형이 공개된 부모 둘을 고르면 자손의 기대 분포가 보여요.'));
      return;
    }
    const brixKeys = Object.keys(d.brix).map(Number).sort((x, y) => x - y);
    const maxB = Math.max(0.0001, ...Object.values(d.brix));
    const species = this.ctx.game.plantById(this.sel[0] ?? '')?.genome.species ?? 'lumi';
    replaceChildren(
      this.previewBox,
      h('div', { class: 'punnett__title' }, '퍼넷 노트 — 정상 감수분열의 모의 기대 분포'),
      h(
        'div',
        { class: 'punnett__suits' },
        ...SUITS.map((s) =>
          h(
            'div',
            { class: 'pbar', title: this.ctx.game.suitName(s) },
            suitGlyph(s, species, 18),
            h('span', { class: 'pbar__track' }, h('span', { class: 'pbar__fill', style: { width: `${Math.round(d.suits[s] * 100)}%` } })),
            h('span', { class: 'pbar__v num' }, `${Math.round(d.suits[s] * 100)}%`),
          ),
        ),
      ),
      h(
        'div',
        { class: 'punnett__brix', 'aria-label': '당도 분포' },
        ...brixKeys.map((k) => h('div', { class: 'bcol', title: `당도 ${k}: ${Math.round(d.brix[k] * 100)}%` }, h('span', { class: 'bcol__bar', style: { height: `${Math.round((d.brix[k] / maxB) * 100)}%` } }), h('span', { class: 'bcol__k num' }, String(k)))),
      ),
      h(
        'div',
        { class: 'punnett__extra' },
        d.male > 0 ? h('span', null, `수그루 ${Math.round(d.male * 100)}%`) : null,
        d.seedless > 0 ? h('span', null, `씨 없음 ${Math.round(d.seedless * 100)}%`) : null,
        d.aneuploid > 0 ? h('span', null, `이수성 ${Math.round(d.aneuploid * 100)}%`) : null,
      ),
    );
  }

  /** Enter 키 */
  confirm(): void {
    if (this.sel.length === 2) void this.doCross();
    else if (this.sel.length === 1) {
      if (this.selfingSelected) void this.doCross(true);
      else {
        this.selfingSelected = true;
        this.refresh();
      }
    }
  }

  async doCross(selfing = false, pair?: [string, string]): Promise<void> {
    const g = this.ctx.game;
    if (this.ctx.isBusy() || g.state.phase !== 'cross') return;
    const a = pair?.[0] ?? this.sel[0];
    const b = pair?.[1] ?? (selfing ? this.sel[0] : this.sel[1]);
    if (!a || !b) return;
    if (!pair && !this.prediction) {
      this.ctx.toast.error('교배 결과를 먼저 예측해 주세요.');
      return;
    }
    const ok = g.canCross(a, b);
    if (!ok.ok) {
      this.ctx.toast.error(ok.reason ?? '교배할 수 없어요.');
      return;
    }
    await this.ctx.lock(async () => {
      const ea = this.items.get(a)?.wrap;
      const eb = this.items.get(b)?.wrap;
      const stageEl = this.ctx.stage;
      const ra = ea ? rectIn(ea, stageEl) : null;
      const rb = eb ? rectIn(eb, stageEl) : null;
      g.chooseCross(a, b, pair ? undefined : this.prediction ?? undefined);
      if (g.state.phase !== 'play') return;
      audio.play('cross');
      await this.pollen(ra, rb);
      this.sel = [];
    });
  }

  /** 꽃가루가 두 부모에서 흘러나와 가운데서 만나 자손 덱이 된다 */
  private async pollen(ra: ReturnType<typeof rectIn> | null, rb: ReturnType<typeof rectIn> | null): Promise<void> {
    if (motion.fast) return;
    const stageEl = this.ctx.stage;
    const area = rectIn(this.garden, stageEl);
    const mid = { x: area.cx, y: area.cy };
    const jobs: Promise<void>[] = [];
    const sources = [ra, rb].filter((r): r is NonNullable<typeof r> => !!r);
    if (!motion.reduced) {
      sources.forEach((r, si) => {
        for (let i = 0; i < 26; i++) {
          const p = h('i', { class: ['pollen', si === 1 && 'pollen--b'] });
          const sx = r.x + fx() * r.w;
          const sy = r.y + fx() * r.h * 0.6;
          p.style.left = `${sx}px`;
          p.style.top = `${sy}px`;
          stageEl.appendChild(p);
          const cx = (sx + mid.x) / 2 + (fx() - 0.5) * 160;
          const cy = Math.min(sy, mid.y) - 60 - fx() * 80;
          jobs.push(
            play(p, [
              { translate: '0 0', opacity: 0, scale: '0.4' },
              { translate: `${cx - sx}px ${cy - sy}px`, opacity: 1, scale: '1', offset: 0.5 },
              { translate: `${mid.x - sx}px ${mid.y - sy}px`, opacity: 0.9, scale: '0.5' },
            ], { duration: 900 + fx() * 400, delay: i * 18, easing: 'ease-in-out' }).then(() => p.remove()),
          );
        }
      });
    }
    await all(jobs);
    const pod = h('div', { class: 'podfx podfx--deck', 'aria-hidden': 'true' }, h('span', { class: 'pod__deck' }, h('i'), h('i'), h('i', null, '✦')));
    pod.style.left = `${mid.x}px`;
    pod.style.top = `${mid.y}px`;
    stageEl.appendChild(pod);
    await play(pod, [{ scale: '0', rotate: '-40deg', opacity: 0 }, { scale: '1.3', rotate: '8deg', opacity: 1 }, { scale: '1', rotate: '0deg' }], { duration: 520, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' });
    this.ctx.bg?.pulse(0.6);
    await wait(260);
    const to = this.podTarget();
    if (to) {
      await play(pod, [{ translate: '0 0', scale: '1' }, { translate: `${to.cx - mid.x}px ${to.cy - mid.y}px`, scale: '0.45' }], { duration: 420, easing: 'cubic-bezier(0.5, 0, 0.6, 1)' });
    }
    pod.remove();
  }
}
