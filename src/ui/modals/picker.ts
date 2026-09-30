// 대상 고르기 모달 (온실 포기·손패 카드) — 시약·봉투·선발에서 같이 쓴다
import { audio } from '../../audio';
import { plantCard, seedCard } from '../../art';
import type { Plant } from '../../contract/game';
import { hasGlasses, lineageText, phenoSentence, plantView, seedView, effBrix } from '../cards';
import type { Ctx } from '../ctx';
import { h, button } from '../h';

export interface PickItem {
  id: string;
  art: HTMLElement;
  label: string;
  disabled?: string;
}

export function pickTargets(
  ctx: Ctx,
  o: { title: string; hint?: string; items: PickItem[]; min: number; max: number; confirm: string; preselect?: string[]; groups?: { label: string; ids: string[] }[] },
): Promise<string[] | null> {
  return new Promise((resolve) => {
    const chosen = new Set<string>((o.preselect ?? []).filter((id) => o.items.some((i) => i.id === id && !i.disabled)).slice(0, o.max));
    let done = false;
    const confirmBtn = button(o.confirm, () => {
      if (chosen.size < o.min) return;
      done = true;
      const order = o.items.map((i) => i.id).filter((id) => chosen.has(id));
      m.close();
      resolve(order);
    }, { class: 'btn--play', 'data-autofocus': '' });
    const count = h('span', { class: 'picker__count' });
    const wraps = new Map<string, HTMLElement>();
    const sync = () => {
      for (const [id, w] of wraps) {
        const on = chosen.has(id);
        w.classList.toggle('is-picked', on);
        w.setAttribute('aria-pressed', String(on));
        w.querySelector('.sa-tiltable')?.classList.toggle('is-selected', on);
      }
      confirmBtn.disabled = chosen.size < o.min || chosen.size > o.max;
      count.textContent = o.max > 1 ? `${chosen.size}/${o.max} 골랐어요` : '';
    };
    const itemEl = (it: PickItem) => {
      const w = h('div', { class: ['pickitem', it.disabled && 'is-disabled'], role: 'button', tabindex: it.disabled ? '-1' : '0', 'aria-pressed': 'false', 'aria-label': it.label + (it.disabled ? ` (${it.disabled})` : ''), title: it.disabled ?? it.label }, it.art, it.disabled ? h('span', { class: 'pickitem__why' }, it.disabled) : null);
      const toggle = () => {
        if (it.disabled) return;
        if (chosen.has(it.id)) chosen.delete(it.id);
        else {
          if (o.max === 1) chosen.clear();
          if (chosen.size >= o.max) {
            audio.play('error');
            return;
          }
          chosen.add(it.id);
        }
        audio.play('select');
        sync();
      };
      w.addEventListener('click', toggle);
      w.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }
      });
      wraps.set(it.id, w);
      return w;
    };
    const content: HTMLElement[] = [];
    if (o.hint) content.push(h('p', { class: 'hint' }, o.hint));
    if (o.groups) {
      for (const g of o.groups) {
        const items = o.items.filter((i) => g.ids.includes(i.id));
        if (items.length === 0) continue;
        content.push(h('div', { class: 'bar__label' }, g.label), h('div', { class: 'picker__grid' }, ...items.map(itemEl)));
      }
    } else content.push(h('div', { class: 'picker__grid' }, ...o.items.map(itemEl)));
    const m = ctx.modals.open({
      title: o.title,
      className: 'modal--picker',
      wide: o.items.length > 4,
      content: h('div', { class: 'picker' }, ...content),
      actions: [count, button('취소', () => m.close(), { class: 'btn--ghost' }), confirmBtn],
      onClose: () => {
        if (!done) resolve(null);
      },
    });
    sync();
  });
}

export function plantPickItem(ctx: Ctx, p: Plant, disabled?: string): PickItem {
  const glasses = hasGlasses(ctx.game.state);
  return {
    id: p.id,
    art: plantCard(plantView(p, { glasses, subtitle: lineageText(p, (id) => ctx.game.plantById(id)) })),
    label: `${p.name}: ${phenoSentence(p.pheno, p.pheno.brix)}`,
    disabled,
  };
}

export async function pickPlant(ctx: Ctx, o: { title: string; hint?: string; confirm: string; disabled?: (p: Plant) => string | undefined }): Promise<string | null> {
  const items = ctx.game.state.garden.map((p) => plantPickItem(ctx, p, o.disabled?.(p)));
  const r = await pickTargets(ctx, { title: o.title, hint: o.hint, items, min: 1, max: 1, confirm: o.confirm });
  return r?.[0] ?? null;
}

/** 손패 카드 고르기 항목 */
export function handPickItems(ctx: Ctx, disabled?: (uid: string) => string | undefined): PickItem[] {
  const glasses = hasGlasses(ctx.game.state);
  return ctx.game.state.hand.map((c) => ({
    id: c.uid,
    art: seedCard(seedView(c, { glasses })),
    label: phenoSentence(c.pheno, effBrix(c)),
    disabled: disabled?.(c.uid),
  }));
}
