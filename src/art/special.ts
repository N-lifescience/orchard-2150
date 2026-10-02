import type { JokerDef, ReagentDef, Rarity } from '../contract/game';
import { H } from './dom';
import { jokerIcon, reagentIcon } from './icons';
import { shell, priceTag } from './shell';
import { cardFrame } from './raster';

const RARITY_KO: Record<Rarity, string> = { common: '흔함', uncommon: '특별', rare: '희귀', legendary: '전설' };

export function jokerCard(def: JokerDef, opts?: { uid?: string; counter?: number; price?: number }): HTMLElement {
  const rarity = def.rarity ?? 'common';
  const { root, body, face } = shell('sa-joker sa-rarity--' + rarity);
  root.dataset.id = def.id;
  if (opts?.uid) root.dataset.uid = opts.uid;
  face.appendChild(cardFrame());
  const icon = H('div', 'sa-joker__icon');
  icon.appendChild(jokerIcon(def.id, 100));
  face.appendChild(icon);
  const name = H('div', 'sa-joker__name', def.name);
  if (def.name.length > 9) name.classList.add('is-xlong');
  else if (def.name.length > 6) name.classList.add('is-long');
  face.appendChild(name);
  face.appendChild(H('div', 'sa-joker__desc', def.desc));
  face.appendChild(H('div', 'sa-joker__rarity', RARITY_KO[rarity]));
  if (opts?.counter !== undefined) {
    const counter = H('div', 'sa-counter');
    counter.appendChild(H('span', 'sa-counter__num', String(opts.counter)));
    counter.appendChild(H('span', 'sa-counter__lbl', '누적'));
    counter.title = '누적 ' + opts.counter;
    body.appendChild(counter);
  }
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', '비법 ' + def.name + ' (' + RARITY_KO[rarity] + '): ' + def.desc + (opts?.price !== undefined ? ', 가격 $' + opts.price : ''));
  return root;
}

export function reagentCard(def: ReagentDef, opts?: { price?: number }): HTMLElement {
  const { root, body, face } = shell('sa-reagent');
  root.dataset.id = def.id;
  face.appendChild(cardFrame());
  const icon = H('div', 'sa-reagent__icon');
  icon.appendChild(reagentIcon(def.id, 100));
  face.appendChild(icon);
  const name = H('div', 'sa-reagent__name', def.name);
  if (def.name.length > 7) name.classList.add('is-long');
  face.appendChild(name);
  face.appendChild(H('div', 'sa-reagent__desc', def.desc));
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', '시약 ' + def.name + ': ' + def.desc + (opts?.price !== undefined ? ', 가격 $' + opts.price : ''));
  return root;
}
