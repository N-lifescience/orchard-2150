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
  private pickA: HTMLElement;
  private pickB: HTMLElement;
  private reason: HTMLElement;
  private crossBtn: HTMLButtonElement;
  private selfBtn: HTMLButtonElement;
  private previewBox: HTMLElement;
  private predictionBox: HTMLElement;
  private prediction: ColorPrediction | null = null;
  private selfingSelected = false;
  private predictionButtons: HTMLButtonElement[] = [];
  private sel: string[] = [];
  private items = new Map<string, { wrap: HTMLElement; sig: string }>();
  private orderKey = '';
  /** 교배 연출 뒤 꼬투리 모양이 날아갈 곳 */
  podTarget: () => { cx: number; cy: number } | null = () => null;

  constructor(private ctx: Ctx) {
    this.orderCard = h('div', { class: 'ordercard panel' });
    this.garden = h('div', { class: 'garden', role: 'group', 'aria-label': '온실 — 부모로 쓸 포기 고르기' });
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
    this.predictionBox = h('div', { class: 'cross__prediction', role: 'group', 'aria-label': '교배 결과 예측' });
    for (const [value, label] of [['ruby', '루비가 많아요'], ['gold', '골드가 많아요'], ['even', '비슷해요']] as [ColorPrediction, string][]) {
      const b = button(label, () => {
        this.prediction = value;
        this.refresh();
      }, { class: 'btn--seg', 'aria-pressed': 'false' });
      this.predictionButtons.push(b);
    }
    replaceChildren(
      this.predictionBox,
      h('div', { class: 'cross__prediction-title' }, '예측해 봐요: 자손 52알에는 어느 과육색이 더 많을까요?'),
      h('div', { class: 'cross__prediction-actions' }, ...this.predictionButtons),
      h('p', { class: 'hint' }, '예측을 고른 뒤 교배할 수 있어요. 결과는 꼬투리가 만들어진 후 비교해요.'),
    );
    this.el = h(
      'div',
      { class: 'view view--cross' },
      this.orderCard,
      h(
        'div',
        { class: 'cross__right' },
        h('div', { class: 'cross__head' }, h('h2', { class: 'h2' }, '교배할 두 포기를 골라요'), h('p', { class: 'hint' }, '한 포기만 고른 뒤 [자가수분 선택]을 누르면 자기 꽃가루로 수분할 수 있어요.')),
        this.garden,
        h('div', { class: 'cross__bar' }, this.pickA, h('span', { class: 'cross__x', 'aria-hidden': 'true' }, '×'), this.pickB, this.selfBtn, this.crossBtn),
        this.reason,
        this.predictionBox,
        this.previewBox,
      ),
    );
  }

  reset(): void {
    this.sel = [];
    this.prediction = null;
    this.selfingSelected = false;
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
        it.wrap.replaceChildren(plantCard(v));
      }
      it.wrap.setAttribute('aria-label', `${i + 1}. ${p.name}: ${speciesLabel(p.pheno)}, ${phenoSentence(p.pheno, p.pheno.brix)}`);
      kids.push(it.wrap);
    });
    const same = kids.length === this.garden.children.length && kids.every((k, i) => this.garden.children[i] === k);
    if (!same) this.garden.replaceChildren(...kids);
    const n = s.garden.length;
    this.garden.style.setProperty('--card-w', `${n <= 4 ? 112 : n === 5 ? 100 : 88}px`);
    this.refresh();
  }

  private renderOrder(s: RunState): void {
    const o = s.orders[s.orderIdx];
    const key = `${s.ante}:${s.orderIdx}:${o.name}:${o.target}:${o.boss?.desc ?? ''}`;
    if (key === this.orderKey) return;
    this.orderKey = key;
    this.orderCard.dataset.kind = o.kind;
    const kindLabel = o.kind === 'small' ? '작은 주문' : o.kind === 'big' ? '큰 주문' : '명품 의뢰인';
    replaceChildren(
      this.orderCard,
      h('div', { class: 'ordercard__kicker' }, `시즌 ${s.ante} · ${kindLabel}`),
      h('div', { class: 'ordercard__emblem', 'aria-hidden': 'true' }, o.kind === 'boss' && o.boss ? bossEmblem(o.boss, 132) : orderEmblem(o.kind === 'big' ? 'big' : 'small', 120)),
      h('h2', { class: 'ordercard__name' }, o.name),
      h('p', { class: 'ordercard__client' }, o.client),
      o.requestedColor ? h('div', { class: 'ordercard__request' }, `요청: ${o.requestedColor === 'ruby' ? '루비빛' : '골드빛'} 과육을 출하하면 보너스 $2`) : null,
      h('div', { class: 'ordercard__target' }, h('span', { class: 'side__label' }, '목표 점수'), h('span', { class: 'num' }, fmt.score(o.target))),
      h('div', { class: 'ordercard__reward' }, `보상 $${o.reward}`),
      o.boss ? h('div', { class: 'ordercard__rule' }, h('b', null, '특별 규칙 '), o.boss.desc) : null,
      s.jokers.some((j) => j.id === 'climateHouse') && o.boss ? h('div', { class: 'ordercard__note' }, '기후 적응 온실 덕분에 특별 규칙을 무시해요.') : null,
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
    if (p) this.toggle(p.id);
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
    setText(this.pickA, a ? name(a) : '첫째 포기');
    this.pickA.classList.toggle('is-empty', !a);
    setText(this.pickB, b ? name(b) : a && this.selfingSelected ? '자기 자신' : a ? '둘째 포기 (또는 자가수분)' : '둘째 포기');
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
    const dist = pa && pb ? g.preview(pa, pb) : null;
    this.renderPreview(dist, g.state.jokers.some((j) => j.id === 'punnettNote'));
  }

  private renderPreview(d: Distribution | null, has: boolean): void {
    if (!has) {
      replaceChildren(this.previewBox);
      this.previewBox.hidden = true;
      return;
    }
    this.previewBox.hidden = false;
    if (!d) {
      replaceChildren(this.previewBox, h('div', { class: 'punnett__empty' }, '퍼넷 노트: 부모를 고르면 자손의 기대 분포가 보여요.'));
      return;
    }
    const brixKeys = Object.keys(d.brix).map(Number).sort((x, y) => x - y);
    const maxB = Math.max(0.0001, ...Object.values(d.brix));
    const species = this.ctx.game.plantById(this.sel[0] ?? '')?.genome.species ?? 'lumi';
    replaceChildren(
      this.previewBox,
      h('div', { class: 'punnett__title' }, '퍼넷 노트 — 기대 분포'),
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

  /** 꽃가루가 두 부모에서 흘러나와 가운데서 만나 꼬투리가 된다 */
  private async pollen(ra: ReturnType<typeof rectIn> | null, rb: ReturnType<typeof rectIn> | null): Promise<void> {
    if (motion.fast) return;
    const stageEl = this.ctx.stage;
    const mid = { x: 790, y: 330 };
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
    const pod = h('div', { class: 'podfx', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
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
