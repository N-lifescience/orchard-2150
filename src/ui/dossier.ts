// Shared film HUD objects: seed tags and character records.
import { characterName, characterPortrait } from '../art';
import { h, svg } from './h';

export function seedTag(name: string, role = ''): HTMLElement {
  const bars = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1];
  let x = 0;
  const barcode = svg('svg', { class: 'seed-tag__barcode', viewBox: '0 0 58 12', 'aria-hidden': 'true' }, ...bars.map((w) => {
    const bar = svg('rect', { x, y: 0, width: w, height: 12 }); x += w + 2; return bar;
  }));
  return h('div', { class: 'seed-tag' }, h('strong', { class: 'seed-tag__name' }, name),
    role ? h('span', { class: 'seed-tag__role' }, role) : null, barcode);
}

export function dossier(person: string, size = 64): HTMLElement {
  const name = characterName(person) ?? person.split(' · ')[0];
  const role = person.split(' · ').slice(1).join(' / ');
  return h('div', { class: 'dossier' }, h('div', { class: 'dossier__photo' }, characterPortrait(person, size)), seedTag(name, role));
}
