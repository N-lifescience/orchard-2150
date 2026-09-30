// 손패 — uid 키로 DOM 재사용, 부채꼴 배치, 느린 부유, 마우스 3D 기울기, 딜 연출
import { audio } from '../../audio';
import { karyotype, seedCard } from '../../art';
import type { SeedCard } from '../../contract/game';
import { seedView, viewSig, phenoSentence, effBrix, speciesLabel } from '../cards';
import type { Ctx } from '../ctx';
import { h } from '../h';
import { flipFrom, wait, all, stage, motion } from '../motion';
import { fx } from '../rng';

export interface HandItem {
  uid: string;
  wrap: HTMLElement;
  card: HTMLElement;
  sig: string;
}

export const HAND_CARD_W = 124;
export const HAND_CARD_H = HAND_CARD_W * 1.5;

/** 카드 요소에 마우스 3D 기울기 달기 (--rx/--ry 는 그림 모듈이 받는다) */
export function attachTilt(wrap: HTMLElement, target: () => HTMLElement | null): void {
  wrap.addEventListener('pointermove', (e) => {
    if (motion.reduced || e.pointerType === 'touch') return;
    const t = target();
    if (!t) return;
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    t.style.setProperty('--rx', `${(-py * 16).toFixed(1)}deg`);
    t.style.setProperty('--ry', `${(px * 16).toFixed(1)}deg`);
    t.style.setProperty('--sa-gx', `${Math.round((px + 0.5) * 100)}%`);
    t.style.setProperty('--sa-gy', `${Math.round((py + 0.5) * 100)}%`);
  });
  wrap.addEventListener('pointerleave', () => {
    const t = target();
    if (!t) return;
    t.style.removeProperty('--rx');
    t.style.removeProperty('--ry');
    t.style.removeProperty('--sa-gx');
    t.style.removeProperty('--sa-gy');
  });
}

export function cardTip(ctx: Ctx, getCard: () => SeedCard | undefined): () => HTMLElement | null {
  return () => {
    const c = getCard();
    if (!c) return null;
    const v = seedView(c, { glasses: ctx.game.state.jokers.some((j) => j.id === 'mendelGlasses') });
    return h(
      'div',
      null,
      h('b', null, speciesLabel(c.pheno)),
      h('div', null, phenoSentence(c.pheno, effBrix(c))),
      c.brixMod ? h('div', { class: 'tip__rule' }, `환경 효과 당도 ${c.brixMod > 0 ? '+' : ''}${c.brixMod} — 유전되지 않아요`) : null,
      v.genotypeText ? h('div', { class: 'tip__geno' }, `유전자형 ${v.genotypeText}`) : v.partialGenotype ? h('div', { class: 'tip__geno' }, `확실한 자리 ${v.partialGenotype} (멘델의 안경)`) : h('div', { class: 'tip__sub' }, '유전자형은 아직 몰라요'),
      c.pheno.aneuploid ? h('div', { class: 'tip__rule' }, `비분리로 염색체 수가 달라졌어요. ${c.pheno.aneuploidNote ?? ''}`) : null,
      c.pheno.aneuploid && c.revealed ? h('div', { class: 'tip__karyo' }, karyotype(c.genome, { revealed: true, width: 220 })) : null,
      c.debuffed ? h('div', { class: 'tip__rule' }, '이번 의뢰인의 규칙으로 무효예요') : null,
    );
  };
}

export class HandView {
  readonly el: HTMLElement;
  private items = new Map<string, HandItem>();
  private order: string[] = [];
  readonly selected = new Set<string>();
  interactive = true;
  onChange: () => void = () => {};
  /** 딜 출발점 (꼬투리 버튼) */
  dealFrom: () => DOMRect | null = () => null;
  private cards = new Map<string, SeedCard>();

  constructor(private ctx: Ctx) {
    this.el = h('div', { class: 'hand', role: 'group', 'aria-label': '손에 든 모종 (1–8 키로 고르기)' });
  }

  get uids(): string[] {
    return this.order.slice();
  }

  item(uid: string): HandItem | undefined {
    return this.items.get(uid);
  }

  /** 선택 순서가 아니라 손패 순서로 */
  selectedInOrder(): string[] {
    return this.order.filter((u) => this.selected.has(u));
  }

  toggle(uid: string): void {
    if (!this.interactive || this.ctx.isBusy()) return;
    const it = this.items.get(uid);
    if (!it) return;
    if (this.selected.has(uid)) {
      this.selected.delete(uid);
      audio.play('deselect');
    } else {
      if (this.selected.size >= this.ctx.game.state.maxSelect) {
        audio.play('error');
        this.ctx.toast.show(`한 번에 ${this.ctx.game.state.maxSelect}포기까지 고를 수 있어요.`, 'warn', 1600);
        return;
      }
      this.selected.add(uid);
      audio.play('select');
    }
    this.syncSelected();
    this.onChange();
  }

  clearSelection(): void {
    this.selected.clear();
    this.syncSelected();
    this.onChange();
  }

  private syncSelected(): void {
    for (const [uid, it] of this.items) {
      const on = this.selected.has(uid);
      it.card.classList.toggle('is-selected', on);
      it.wrap.setAttribute('aria-pressed', on ? 'true' : 'false');
      it.wrap.classList.toggle('is-selected', on);
    }
  }

  /** 손패 상태 반영. 새 카드는 꼬투리에서 날아온다. 딜 연출이 끝나면 resolve */
  update(hand: SeedCard[], glasses: boolean): Promise<void> {
    const keep = new Set(hand.map((c) => c.uid));
    for (const uid of [...this.selected]) if (!keep.has(uid)) this.selected.delete(uid);
    for (const [uid, it] of this.items) {
      if (!keep.has(uid)) {
        it.wrap.remove();
        this.items.delete(uid);
      }
    }
    this.cards.clear();
    for (const c of hand) this.cards.set(c.uid, c);
    const fresh: HandItem[] = [];
    hand.forEach((c, i) => {
      const v = seedView(c, { glasses });
      const sig = viewSig(v);
      let it = this.items.get(c.uid);
      if (!it) {
        const wrap = h('div', {
          class: 'slot',
          role: 'button',
          tabindex: '0',
          'aria-pressed': 'false',
          dataset: { uid: c.uid },
          style: { '--phase': `${(-fx() * 4).toFixed(2)}s` },
        });
        const uid = c.uid;
        wrap.addEventListener('click', () => this.toggle(uid));
        wrap.addEventListener('keydown', (e) => {
          if (e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            this.toggle(uid);
          }
        });
        wrap.addEventListener('pointerenter', () => {
          if (this.interactive) audio.play('hover');
        });
        attachTilt(wrap, () => this.items.get(uid)?.card ?? null);
        this.ctx.tips.attach(wrap, cardTip(this.ctx, () => this.cards.get(uid)));
        it = { uid, wrap, card: wrap, sig: '' };
        this.items.set(uid, it);
        this.el.appendChild(wrap);
        fresh.push(it);
      }
      if (it.sig !== sig) {
        const card = seedCard(v);
        card.classList.add('slot__card');
        if (this.selected.has(c.uid)) card.classList.add('is-selected');
        it.wrap.replaceChildren(card);
        it.card = card;
        it.sig = sig;
      }
      it.wrap.setAttribute('aria-label', `${i + 1}번 모종: ${phenoSentence(c.pheno, effBrix(c))}${c.debuffed ? ', 무효' : ''}`);
    });
    this.order = hand.map((c) => c.uid);
    this.layout();
    this.syncSelected();
    return this.deal(fresh);
  }

  /** 부채꼴 자리 계산 */
  layout(): void {
    const n = this.order.length;
    const W = this.el.clientWidth || 840;
    const w = HAND_CARD_W;
    const gap = n > 1 ? Math.min(w + 12, (W - w) / (n - 1)) : 0;
    const total = w + gap * Math.max(0, n - 1);
    const x0 = (W - total) / 2;
    this.order.forEach((uid, i) => {
      const it = this.items.get(uid);
      if (!it) return;
      const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const x = x0 + i * gap;
      const y = 22 + t * t * 16;
      const rot = t * 4.5;
      it.wrap.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
      it.wrap.style.zIndex = String(i + 1);
      it.wrap.dataset.key = String(i + 1);
    });
  }

  private async deal(fresh: HandItem[]): Promise<void> {
    if (fresh.length === 0) return;
    const from = this.dealFrom();
    const jobs: Promise<void>[] = [];
    for (const it of fresh) {
      if (from) {
        it.wrap.style.visibility = 'hidden';
      }
    }
    for (const it of fresh) {
      it.wrap.style.visibility = '';
      audio.play('deal');
      if (from) jobs.push(flipFrom(it.wrap, from, { duration: 420, rotateFrom: -24 + fx() * 12, scaleFrom: 0.45 }));
      await wait(75);
    }
    await all(jobs);
  }

  /** 출하·솎아내기로 나가는 카드: 손패 관리에서 빼고 요소를 돌려준다 (DOM 은 그대로) */
  takeOut(uids: string[]): HandItem[] {
    const out: HandItem[] = [];
    for (const uid of uids) {
      const it = this.items.get(uid);
      if (!it) continue;
      this.items.delete(uid);
      this.selected.delete(uid);
      out.push(it);
    }
    this.order = this.order.filter((u) => !uids.includes(u));
    return out;
  }

  /** 손패 전체 요소의 화면 좌표 (정렬 FLIP 용) */
  rects(): Map<string, DOMRect> {
    const m = new Map<string, DOMRect>();
    for (const [uid, it] of this.items) m.set(uid, it.wrap.getBoundingClientRect());
    return m;
  }

  get scale(): number {
    return stage.scale;
  }
}
