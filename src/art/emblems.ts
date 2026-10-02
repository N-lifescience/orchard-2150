import type { SpeciesId, SuitKey } from '../contract/genetics';
import type { BossDef, HandTypeId } from '../contract/game';
import { HAND_TYPES } from '../game/content';
import { H } from './dom';
import { characterPortrait } from './characters';
import { atlases, sprite } from './raster';

export function suitGlyph(suit: SuitKey, species: SpeciesId, size = 20): HTMLElement {
  const ruby = suit.startsWith('ruby');
  const marked = suit.endsWith('-m');
  const label = (ruby ? '루비' : '골드') + (marked ? species === 'stella' ? ' · 은빛 잎' : ' · 별무늬' : '');
  const root = H('span', 'sa-suit sa-suit--' + (ruby ? 'ruby' : 'gold'));
  root.style.width = size + 'px';
  root.style.height = size + 'px';
  root.style.fontSize = size + 'px';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', label);
  root.appendChild(H('span', 'sa-suit__shape'));
  if (marked) root.appendChild(H('span', 'sa-suit__mark', species === 'stella' ? '↟' : '✦'));
  return root;
}

export function bossEmblem(def: BossDef, size = 96): HTMLElement {
  const root = characterPortrait(def.client, size);
  root.classList.add('sa-boss');
  root.dataset.boss = def.id;
  root.setAttribute('aria-label', def.client + ', 특별 의뢰: ' + def.name);
  return root;
}

export function orderEmblem(kind: 'small' | 'big', size = 64, client?: string): HTMLElement {
  const root = client ? characterPortrait(client, size) : sprite(atlases.utility, kind === 'big' ? 6 : 5, size, kind === 'big' ? '특별 납품' : '일반 납품');
  root.classList.add('sa-order', 'sa-order--' + kind);
  return root;
}

const MEDAL_INDEX: Record<HandTypeId, number> = {
  high: 8, pair: 9, twoPair: 10, three: 11, straight: 12, flush: 13,
  fullHouse: 14, four: 15, straightFlush: 16, five: 17, flushHouse: 18, flushFive: 19,
};

export function medalArt(hand: HandTypeId, size = 72): HTMLElement {
  return sprite(atlases.utility, MEDAL_INDEX[hand] ?? 8, size, '품평 기록: ' + (HAND_TYPES[hand]?.name ?? hand), 'sa-medal');
}
