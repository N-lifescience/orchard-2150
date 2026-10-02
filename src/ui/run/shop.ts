// 상점 (phase 'shop') — 비법·시약 2칸, 봉투 2개, 증축 1개, 새로고침, 다음 주문 미리보기
import { audio } from '../../audio';
import { bossEmblem, jokerCard, medalArt, orderEmblem, packArt, plantCard, reagentCard } from '../../art';
import type { PackChoice, RunState, ShopItem } from '../../contract/game';
import { HAND_TYPES, PACKS, UPGRADES } from '../../game';
import { hasGlasses, lineageText, phenoSentence, plantView, speciesLabel } from '../cards';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren, setText } from '../h';
import * as fmt from '../fmt';
import { play, wait, motion } from '../motion';
import { fx, between } from '../rng';
import type { ModalHandle } from '../overlay';
import { pickPlant } from '../modals/picker';
import { attachTilt } from './hand';

export class ShopView {
  readonly el: HTMLElement;
  private cardsRow: HTMLElement;
  private packsRow: HTMLElement;
  private rerollBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private nextBox: HTMLElement;
  private sig = '';
  private packModal: ModalHandle | null = null;
  private packSig = '';

  constructor(private ctx: Ctx) {
    this.cardsRow = h('div', { class: 'shop__cards', role: 'list', 'aria-label': '비법·시약 진열대' });
    this.packsRow = h('div', { class: 'shop__packs', role: 'list', 'aria-label': '봉투·증축 진열대' });
    this.rerollBtn = button('새로고침', () => this.reroll(), { class: 'btn--gold' });
    this.nextBtn = button(h('span', null, '다음 주문 ▶'), () => this.leave(), { class: 'btn--play btn--big' });
    this.nextBox = h('div', { class: 'next' });
    this.el = h(
      'div',
      { class: 'view view--shop' },
      h(
        'div',
        { class: 'shop panel' },
        h('header', { class: 'shop__head' }, h('h2', { class: 'h2' }, '상점'), h('p', { class: 'hint' }, '비법은 왼쪽부터 차례로 발동해요. 가진 비법을 누르면 팔 수 있어요.')),
        this.cardsRow,
        this.packsRow,
      ),
      h('div', { class: 'shop__side panel' }, this.nextBox, this.nextBtn, this.rerollBtn),
    );
  }

  update(s: RunState): void {
    const shop = s.shop;
    if (!shop) return;
    const sig = JSON.stringify(shop.items.map((i) => [i.slot, i.kind, 'id' in i ? i.id : i.kind === 'pack' ? i.pack : '', i.sold, i.price])) + `|${s.money}|${s.jokers.length}|${s.reagents.length}|${shop.rerollCost}|${s.pack ? 1 : 0}`;
    if (sig !== this.sig) {
      const fresh = !this.sig;
      this.sig = sig;
      const cards = shop.items.filter((i) => i.slot === 'card1' || i.slot === 'card2');
      const others = shop.items.filter((i) => !(i.slot === 'card1' || i.slot === 'card2'));
      replaceChildren(this.cardsRow, ...cards.map((it) => this.itemEl(s, it)));
      replaceChildren(this.packsRow, ...others.map((it) => this.itemEl(s, it)));
      if (fresh) {
        [...this.cardsRow.children, ...this.packsRow.children].forEach((c, i) =>
          void play(c, [{ opacity: 0, translate: '0 -40px', rotate: `${between(fx, -8, 8)}deg` }, { opacity: 1, translate: '0 0', rotate: '0deg' }], { duration: 420, delay: i * 70 }),
        );
      }
    }
    setText(this.rerollBtn, `새로고침 $${shop.rerollCost}`);
    this.rerollBtn.disabled = s.money < shop.rerollCost || !!s.pack;
    this.rerollBtn.setAttribute('aria-label', `진열대 새로고침, $${shop.rerollCost}`);
    this.nextBtn.disabled = !!s.pack;
    this.renderNext(s);
    this.syncPack(s);
  }

  private itemEl(s: RunState, it: ShopItem): HTMLElement {
    const g = this.ctx.game;
    let art: HTMLElement;
    let name = '';
    let desc = '';
    let why = '';
    if (it.kind === 'joker') {
      const d = g.jokerDef(it.id);
      art = jokerCard(d, { price: it.price });
      name = d.name;
      desc = d.desc;
      if (s.jokers.length >= s.jokerCap) why = '비법 칸이 가득 찼어요';
    } else if (it.kind === 'reagent') {
      const d = g.reagentDef(it.id);
      art = reagentCard(d, { price: it.price });
      name = d.name;
      desc = d.desc;
      if (s.reagents.length >= s.reagentCap) why = '시약 칸이 가득 찼어요';
    } else if (it.kind === 'pack') {
      art = packArt(it.pack, { price: it.price });
      name = PACKS[it.pack].name;
      desc = PACKS[it.pack].desc;
    } else {
      const u = UPGRADES[it.id];
      art = h(
        'div',
        { class: 'voucher' },
        h('div', { class: 'voucher__kicker' }, '증축'),
        h('div', { class: 'voucher__name' }, u.name),
        h('div', { class: 'voucher__desc' }, u.desc),
        h('div', { class: 'voucher__price num' }, `$${it.price}`),
      );
      name = u.name;
      desc = u.desc;
    }
    if (!why && s.money < it.price) why = '돈이 모자라요';
    if (!why && s.pack) why = '열어 둔 봉투부터 골라 주세요';
    const label = it.kind === 'pack' ? '고르기' : it.kind === 'upgrade' ? '증축' : '구매';
    const buyBtn = button(it.sold ? '팔림' : `${label} $${it.price}`, () => this.buy(it.slot), { class: ['btn--buy', it.kind === 'pack' && 'btn--gold'].filter(Boolean).join(' '), 'aria-label': `${name} ${label}, $${it.price}${why ? ` (${why})` : ''}` });
    buyBtn.disabled = it.sold || !!why;
    const wrap = h('div', { class: ['shopitem', `shopitem--${it.kind}`, it.sold && 'is-sold'], role: 'listitem' }, h('div', { class: 'shopitem__art' }, art), buyBtn);
    if (it.kind === 'pack' && it.choices && !it.sold) {
      wrap.appendChild(button('구입 전 살펴보기', () => this.previewOffer(it), { class: 'btn--ghost shopitem__preview', 'aria-label': `${name} 내용 살펴보기` }));
    }
    if (!it.sold) {
      attachTilt(wrap, () => art);
      this.ctx.tips.attach(wrap, () => h('div', null, h('b', null, name), h('div', null, desc), why ? h('div', { class: 'tip__rule' }, why) : null));
      wrap.addEventListener('pointerenter', () => audio.play('hover'));
    }
    return wrap;
  }

  private previewOffer(item: Extract<ShopItem, { kind: 'pack' }>): void {
    const choices = item.choices ?? [];
    const content = h('div', { class: 'offer-preview' }, h('p', { class: 'hint' }, `이 목록에서 ${PACKS[item.pack].picks}개를 고릅니다. 지금 보이는 선택지는 구입 뒤에도 같아요.`));
    for (const choice of choices) {
      let name: string;
      let detail: string;
      if (choice.kind === 'plant') {
        name = choice.plant.name;
        detail = `${speciesLabel(choice.plant.pheno)} · ${phenoSentence(choice.plant.pheno, choice.plant.pheno.brix)}${choice.plant.revealed ? '' : ' · 유전자형은 검사로 확인'}`;
      } else if (choice.kind === 'medal') {
        name = HAND_TYPES[choice.hand].name;
        detail = '이 족보의 연구 레벨 +1';
      } else {
        const def = choice.kind === 'joker' ? this.ctx.game.jokerDef(choice.id) : this.ctx.game.reagentDef(choice.id);
        name = def.name;
        detail = def.desc;
      }
      content.appendChild(h('div', { class: 'offer-preview__choice' }, h('b', null, name), h('p', { class: 'hint' }, detail)));
    }
    const modal = this.ctx.modals.open({ title: PACKS[item.pack].name, kicker: `선택 목록 · $${item.price}`, content, actions: [button('닫기', () => modal.close(), { class: 'btn--ghost' })] });
  }

  private buy(slot: string): void {
    if (this.ctx.isBusy()) return;
    const r = this.ctx.game.buy(slot);
    if (!r.ok) this.ctx.toast.error(r.reason ?? '살 수 없어요.');
    else audio.play('buy');
  }

  private reroll(): void {
    if (this.ctx.isBusy()) return;
    const r = this.ctx.game.reroll();
    if (!r.ok) this.ctx.toast.error(r.reason ?? '새로고침할 수 없어요.');
    else {
      audio.play('reroll');
      this.sig = '';
      [...this.cardsRow.children].forEach((c) => void play(c, [{ rotate: '0deg', scale: '1' }, { rotate: '6deg', scale: '0.9' }, { rotate: '0deg', scale: '1' }], { duration: 260, decorative: true }));
    }
  }

  leave(): void {
    if (this.ctx.isBusy() || this.ctx.game.state.pack) return;
    audio.play('select');
    this.sig = '';
    this.ctx.game.leaveShop();
  }

  private renderNext(s: RunState): void {
    let ante = s.ante;
    let idx = s.orderIdx + 1;
    if (idx > 2) {
      ante += 1;
      idx = 0;
    }
    if (idx === 0) {
      replaceChildren(this.nextBox, h('div', { class: 'next__kicker' }, '다음'), h('div', { class: 'next__name' }, `시즌 ${ante} 시작`), h('p', { class: 'hint' }, '새 시즌의 주문 세 개가 기다려요. 목표 점수가 올라가요.'));
      return;
    }
    const o = s.orders[idx];
    replaceChildren(
      this.nextBox,
      h('div', { class: 'next__kicker' }, '다음 주문'),
      h('div', { class: 'next__emblem', 'aria-hidden': 'true' }, o.boss ? bossEmblem(o.boss, 72) : orderEmblem(o.kind === 'big' ? 'big' : 'small', 64, o.client)),
      h('div', { class: 'next__name' }, o.name),
      h('div', { class: 'next__target' }, `목표 ${fmt.score(o.target)} · 보상 $${o.reward}`),
      o.requestedColor ? h('div', { class: 'next__request' }, `요청 과육: ${o.requestedColor === 'ruby' ? '루비빛' : '골드빛'} · 출하 시 +$2`) : null,
      o.boss ? h('div', { class: 'next__rule' }, o.boss.desc) : null,
      idx === 1 && s.orders[2].boss ? h('div', { class: 'next__later' }, `그다음 특별 주문: ${s.orders[2].name}`) : null,
    );
  }

  // ─────────────────────────────────────── 봉투 열기
  private syncPack(s: RunState): void {
    const pack = s.pack;
    if (!pack) {
      this.packSig = '';
      if (this.packModal) {
        const m = this.packModal;
        this.packModal = null;
        m.close();
      }
      return;
    }
    const sig = `${pack.pack}:${pack.choices.length}:${pack.picks}:${s.garden.length}`;
    if (sig === this.packSig && this.packModal) return;
    this.packSig = sig;
    const first = !this.packModal;
    if (!this.packModal) {
      this.packModal = this.ctx.modals.open({
        title: PACKS[pack.pack].name,
        kicker: '봉투 열기',
        className: 'modal--pack',
        wide: true,
        dismissable: false,
        content: h('div', { class: 'packopen' }),
        actions: button('건너뛰기', () => this.ctx.game.skipPack(), { class: 'btn--ghost' }),
      });
    }
    const body = this.packModal.body.querySelector('.packopen') as HTMLElement;
    void this.fillPack(body, s, first);
  }

  private async fillPack(body: HTMLElement, s: RunState, first: boolean): Promise<void> {
    const pack = s.pack!;
    const glasses = hasGlasses(s);
    replaceChildren(body);
    if (first) {
      audio.play('packOpen');
      const env = h('div', { class: 'packopen__env' }, packArt(pack.pack));
      body.appendChild(env);
      await play(env, [{ scale: '0.6', rotate: '-6deg', opacity: 0 }, { scale: '1.05', rotate: '3deg', opacity: 1, offset: 0.5 }, { scale: '1.12', rotate: '0deg', opacity: 1, offset: 0.8 }, { scale: '1.4', opacity: 0, filter: 'brightness(3)' }], { duration: 760, easing: 'ease-out' });
      env.remove();
    }
    const row = h('div', { class: 'packopen__row' });
    body.appendChild(h('p', { class: 'hint' }, pack.picks > 1 ? `${pack.picks}개를 고를 수 있어요.` : '하나를 골라요.'));
    if (pack.choices.some((ch) => ch.kind === 'plant')) {
      body.appendChild(h('p', { class: 'hint' }, '겉모습이 같은 포기도 숨은 유전자형은 다를 수 있어요. 유전자 검사 키트로 확인할 수 있어요.'));
    }
    body.appendChild(row);
    pack.choices.forEach((ch, i) => {
      const el = this.choiceEl(ch, glasses);
      const wrap = h('div', { class: 'choice', role: 'button', tabindex: '0', 'aria-label': `${this.choiceLabel(ch)} 고르기` }, el.art, h('div', { class: 'choice__name' }, el.name), el.sub ? h('div', { class: 'choice__sub' }, el.sub) : null);
      wrap.addEventListener('click', () => void this.pickChoice(i));
      wrap.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          void this.pickChoice(i);
        }
      });
      attachTilt(wrap, () => el.art.querySelector('.sa-tiltable') as HTMLElement | null);
      row.appendChild(wrap);
      if (first) {
        const n = pack.choices.length;
        const t = n > 1 ? i / (n - 1) - 0.5 : 0;
        void play(wrap, [{ opacity: 0, translate: `${-t * 240}px 80px`, rotate: `${-t * 30}deg`, scale: '0.5' }, { opacity: 1, translate: '0 0', rotate: '0deg', scale: '1' }], { duration: 520, delay: i * 90, easing: 'cubic-bezier(0.2, 1.2, 0.4, 1)' });
      }
    });
    if (!motion.fast) (row.firstElementChild as HTMLElement | null)?.focus({ preventScroll: true });
  }

  private choiceLabel(ch: PackChoice): string {
    switch (ch.kind) {
      case 'plant':
        return ch.plant.name;
      case 'reagent':
        return this.ctx.game.reagentDef(ch.id).name;
      case 'joker':
        return this.ctx.game.jokerDef(ch.id).name;
      case 'medal':
        return `${HAND_TYPES[ch.hand].name} 메달`;
    }
  }

  private choiceEl(ch: PackChoice, glasses: boolean): { art: HTMLElement; name: string; sub?: string } {
    const g = this.ctx.game;
    switch (ch.kind) {
      case 'plant': {
        const p = ch.plant;
        return {
          art: h('div', { class: 'choice__art' }, plantCard(plantView(p, { glasses, subtitle: lineageText(p, (id) => g.plantById(id)) }))),
          name: p.name,
          sub: `${speciesLabel(p.pheno)} · ${phenoSentence(p.pheno, p.pheno.brix)} · ${lineageText(p, (id) => g.plantById(id))} · ${p.revealed ? '유전자형 공개' : '유전자형 비공개'}`,
        };
      }
      case 'reagent': {
        const d = g.reagentDef(ch.id);
        return { art: h('div', { class: 'choice__art' }, reagentCard(d)), name: d.name, sub: d.desc };
      }
      case 'joker': {
        const d = g.jokerDef(ch.id);
        return { art: h('div', { class: 'choice__art' }, jokerCard(d)), name: d.name, sub: d.desc };
      }
      case 'medal': {
        const lv = g.state.handLevels[ch.hand] ?? 1;
        const def = HAND_TYPES[ch.hand];
        return { art: h('div', { class: 'choice__art choice__art--medal' }, medalArt(ch.hand, 120)), name: def.name, sub: `Lv.${lv} → Lv.${lv + 1} · 칩 +${def.perLevel.chips} · 배수 +${def.perLevel.mult}` };
      }
    }
  }

  private async pickChoice(i: number): Promise<void> {
    const g = this.ctx.game;
    const s = g.state;
    const ch = s.pack?.choices[i];
    if (!ch || this.ctx.isBusy()) return;
    let replace: string | undefined;
    if (ch.kind === 'plant' && s.garden.length >= s.gardenCap) {
      const out = await pickPlant(this.ctx, { title: '온실이 가득 찼어요', hint: `${fmt.josa(ch.plant.name, '을를')} 들이려면 한 포기를 내보내야 해요.`, confirm: '내보내고 들이기' });
      if (!out) return;
      replace = out;
    }
    const r = g.pickFromPack(i, replace);
    if (!r.ok) this.ctx.toast.error(r.reason ?? '고를 수 없어요.');
    else {
      audio.play(ch.kind === 'medal' ? 'xmult' : 'buy');
      await wait(40);
    }
  }
}
