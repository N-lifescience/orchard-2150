import { CHARACTER_NAMES, characterPortrait, jokerCard, reagentCard, packArt, medalArt, logo, bossEmblem } from './index';
import { BOSSES, JOKERS, REAGENTS, HAND_TYPES } from '../game/content';
import type { PackKind, HandTypeId } from '../contract/game';
import { H } from './dom';

const root = document.getElementById('art-review')!;
root.appendChild(H('h1', null, '오차드 2150 · 새 그림 검토'));
root.appendChild(H('p', null, '등장인물 21명, 비법 23종, 시약 7종, 봉투와 메달을 같은 화풍으로 제작했습니다. 그림 위의 이름과 효과는 실제 글자로 표시됩니다.'));
root.appendChild(logo());

function section(title: string): HTMLElement {
  root.appendChild(H('h2', null, title));
  const grid = H('div', 'review-grid');
  root.appendChild(grid);
  return grid;
}
function cell(grid: HTMLElement, art: HTMLElement, name: string): void {
  const entry = H('div', 'review-cell');
  entry.appendChild(art);
  entry.appendChild(H('div', 'review-name', name));
  grid.appendChild(entry);
}
const people = section('등장인물');
CHARACTER_NAMES.forEach((name) => cell(people, characterPortrait(name, 116), name));
const jokers = section('장인의 비법');
JOKERS.forEach((def) => cell(jokers, jokerCard(def), def.name));
const reagents = section('연구 시약');
REAGENTS.forEach((def) => cell(reagents, reagentCard(def), def.name));
const packs = section('봉투와 상자');
(['seed', 'rareSeed', 'reagent', 'medal', 'joker'] as PackKind[]).forEach((kind) => cell(packs, packArt(kind), ''));
const medals = section('품평 메달');
(Object.keys(HAND_TYPES) as HandTypeId[]).forEach((hand) => cell(medals, medalArt(hand, 116), HAND_TYPES[hand].name));
const orders = section('특별 의뢰인');
BOSSES.forEach((def) => cell(orders, bossEmblem(def, 116), def.client));
