// 비법(조커) 카드 · 시약 카드
import type { JokerDef, ReagentDef, Rarity } from '../contract/game';
import { Kit, S, G, P, H, Txt, starPath, num } from './dom';
import { jokerIcon, reagentIcon } from './icons';
import { shell, priceTag } from './shell';
import { mulberry32, hashStr, between } from './rng';

const RARITY_KO: Record<Rarity, string> = { common: '흔함', uncommon: '특별', rare: '희귀', legendary: '전설' };
const GEM: Record<Rarity, [string, string, string]> = {
  common: ['#d2fffa', '#2fd4c4', '#07433e'],
  uncommon: ['#d6e4ff', '#3d7bff', '#0b2266'],
  rare: ['#ffd0e0', '#ff4f8b', '#5e0a30'],
  legendary: ['#fff8d8', '#f2c14a', '#6e4a08'],
};

const FOIL: [number, string][] = [
  [0, '#6e4f18'],
  [0.18, '#e6c77a'],
  [0.36, '#fff1c1'],
  [0.55, '#b8923f'],
  [0.8, '#e6c77a'],
  [1, '#6e4f18'],
];

function gem(k: Kit, x: number, y: number, rarity: Rarity): SVGGElement {
  const [hi, mid, lo] = GEM[rarity] ?? GEM.common;
  const r = 7.6;
  const oct: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    oct.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  const inner = oct.map(([px, py]) => [x + (px - x) * 0.5, y + (py - y) * 0.5] as [number, number]);
  const g = G({ class: `sa-gem sa-gem--${rarity}` });
  g.appendChild(S('circle', { cx: x, cy: y, r: 11.5, fill: k.lin('bez', FOIL, 0, 0, 1, 1), stroke: '#3d2a0a', 'stroke-width': 0.8 }));
  g.appendChild(S('circle', { cx: x, cy: y, r: 9.3, fill: '#140d04' }));
  g.appendChild(P(`M${oct.map((p) => p.join(',')).join('L')}Z`, { fill: k.rad('gem', [[0, hi], [0.5, mid], [1, lo]], 0.38, 0.32, 0.8), stroke: lo, 'stroke-width': 0.6 }));
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    const lit = i >= 4 && i <= 6;
    g.appendChild(
      P(`M${oct[i]}L${oct[j]}L${inner[j]}L${inner[i]}Z`, {
        fill: lit ? '#ffffff' : '#000000',
        'fill-opacity': lit ? 0.22 : i <= 2 ? 0.25 : 0.08,
        stroke: '#ffffff',
        'stroke-opacity': 0.25,
        'stroke-width': 0.3,
      }),
    );
  }
  g.appendChild(P(`M${inner.map((p) => p.join(',')).join('L')}Z`, { fill: '#ffffff', 'fill-opacity': 0.14 }));
  g.appendChild(P(starPath(x - 2.6, y - 2.8, 2.6, 0.6, 4), { fill: '#ffffff' }));
  if (rarity === 'legendary') {
    g.appendChild(
      S('circle', {
        cx: x,
        cy: y,
        r: 7.6,
        fill: k.lin('iri', [[0, '#ff7ab8', 0.55], [0.33, '#7affd8', 0.5], [0.66, '#7ab8ff', 0.5], [1, '#ffe27a', 0.55]], 0, 0, 1, 1),
        class: 'sa-gem__iri',
        style: 'mix-blend-mode:overlay',
      }),
    );
  }
  return g;
}

function jokerFrame(rarity: Rarity): SVGSVGElement {
  const k = new Kit('jf', 200, 300, undefined, undefined, 'sa-frame');
  k.svg.setAttribute('preserveAspectRatio', 'none');
  const foil = k.lin('foil', FOIL, 0, 0, 1, 1);
  // 금 엠보싱 테
  k.add(S('rect', { x: 4.5, y: 4.5, width: 191, height: 291, rx: 12, fill: 'none', stroke: '#000000', 'stroke-width': 6, opacity: 0.45, transform: 'translate(0.8 1.2)' }));
  k.add(S('rect', { x: 4.5, y: 4.5, width: 191, height: 291, rx: 12, fill: 'none', stroke: foil, 'stroke-width': 5 }));
  k.add(S('rect', { x: 2.4, y: 2.4, width: 195.2, height: 295.2, rx: 13.6, fill: 'none', stroke: '#fff1c1', 'stroke-width': 0.5, opacity: 0.6 }));
  // 가죽 스티치
  k.add(S('rect', { x: 11.5, y: 11.5, width: 177, height: 277, rx: 8, fill: 'none', stroke: '#e6c77a', 'stroke-width': 0.9, 'stroke-dasharray': '3.2 2.4', opacity: 0.55 }));
  // 리벳
  for (const [x, y] of [[13, 13], [187, 13], [13, 287], [187, 287]]) {
    k.add(S('circle', { cx: x + 0.5, cy: y + 0.8, r: 4, fill: '#000000', opacity: 0.4 }));
    k.add(S('circle', { cx: x, cy: y, r: 3.6, fill: k.rad('riv', [[0, '#fff6d8'], [0.45, '#d9b25a'], [1, '#5e4312']], 0.35, 0.3, 0.75) }));
  }
  // 에나멜 메달리온
  const cx = 100;
  const cy = 110;
  k.add(S('circle', { cx: cx + 1, cy: cy + 2, r: 62, fill: '#000000', opacity: 0.45, filter: k.blur(2) }));
  k.add(S('circle', { cx, cy, r: 62, fill: foil }));
  k.add(S('circle', { cx, cy, r: 57.5, fill: k.rad('en', [[0, '#2a7a6c'], [0.55, '#0e3a33'], [1, '#04120f']], 0.45, 0.38, 0.7), stroke: '#3d2a0a', 'stroke-width': 1 }));
  const ticks = G({ stroke: '#e6c77a', opacity: 0.5 });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r1 = i % 5 === 0 ? 51 : 53.5;
    ticks.appendChild(P(`M${num(cx + Math.cos(a) * r1)},${num(cy + Math.sin(a) * r1)} L${num(cx + Math.cos(a) * 55.5)},${num(cy + Math.sin(a) * 55.5)}`, { 'stroke-width': i % 5 === 0 ? 0.9 : 0.5 }));
  }
  k.add(ticks);
  k.add(P(`M${cx - 44},${cy - 26} A51,51 0 0 1 ${cx - 12},${cy - 50}`, { stroke: '#ffffff', 'stroke-width': 2.4, fill: 'none', opacity: 0.16, 'stroke-linecap': 'round' }));
  // 이름판
  k.add(S('rect', { x: 20, y: 186, width: 160, height: 27, rx: 4, fill: '#06110e', 'fill-opacity': 0.55, stroke: foil, 'stroke-width': 1.2 }));
  for (const x of [20, 180]) k.add(P(`M${x},192 L${x + (x < 100 ? -5 : 5)},199.5 L${x},207Z`, { fill: foil }));
  k.add(P('M40,220 L160,220', { stroke: '#e6c77a', 'stroke-width': 0.5, opacity: 0.45 }));
  k.add(P('M96,220 L100,216.5 L104,220 L100,223.5Z', { fill: '#e6c77a', opacity: 0.7 }));
  // 희귀도 보석
  k.add(gem(k, cx, 32, rarity));
  return k.svg;
}

export function jokerCard(def: JokerDef, opts?: { uid?: string; counter?: number; price?: number }): HTMLElement {
  const rarity: Rarity = def.rarity ?? 'common';
  const { root, body, face } = shell(`sa-joker sa-rarity--${rarity}`);
  root.dataset.id = def.id;
  if (opts?.uid) root.dataset.uid = opts.uid;
  face.appendChild(jokerFrame(rarity));
  const icon = H('div', 'sa-joker__icon');
  icon.appendChild(jokerIcon(def.id, 64));
  face.appendChild(icon);
  const nm = H('div', 'sa-joker__name', def.name);
  const len = [...(def.name ?? '')].length;
  if (len > 9) nm.classList.add('is-xlong');
  else if (len > 6) nm.classList.add('is-long');
  face.appendChild(nm);
  face.appendChild(H('div', 'sa-joker__desc', def.desc));
  const rl = H('div', 'sa-joker__rarity', RARITY_KO[rarity]);
  face.appendChild(rl);
  if (opts?.counter !== undefined && opts.counter !== null) {
    const c = H('div', 'sa-counter');
    c.appendChild(H('span', 'sa-counter__num', String(opts.counter)));
    c.appendChild(H('span', 'sa-counter__lbl', '누적'));
    c.title = `누적 ${opts.counter}`;
    body.appendChild(c);
  }
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', `비법 ${def.name} (${RARITY_KO[rarity]}): ${def.desc}${opts?.price !== undefined ? `, 가격 $${opts.price}` : ''}`);
  return root;
}

// ─────────────────────────────────────────── 시약: 서리 낀 유리
function reagentFrame(seed: number): SVGSVGElement {
  const k = new Kit('rf', 200, 300, undefined, undefined, 'sa-frame');
  k.svg.setAttribute('preserveAspectRatio', 'none');
  const silver = k.lin('sil', [[0, '#ffffff'], [0.3, '#c9d3d8'], [0.55, '#7d8b92'], [0.8, '#e6eef1'], [1, '#56636a']], 0, 0, 1, 1);
  k.add(S('rect', { x: 4, y: 4, width: 192, height: 292, rx: 16, fill: 'none', stroke: silver, 'stroke-width': 3.6 }));
  k.add(S('rect', { x: 9.5, y: 9.5, width: 181, height: 281, rx: 11, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.8, opacity: 0.7 }));
  // 서리 결정
  const frost = G({ stroke: '#ffffff', 'stroke-width': 0.8, fill: 'none', opacity: 0.75, 'stroke-linecap': 'round' });
  const crystal = (x: number, y: number, s: number, rot: number) => {
    const c = G({ transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` });
    c.appendChild(P('M0,0 L22,0 M6,0 L10,-4 M6,0 L10,4 M13,0 L17,-4 M13,0 L17,4 M0,0 L0,22 M0,6 L-4,10 M0,6 L4,10 M0,13 L-4,17 M0,13 L4,17 M0,0 L12,12 M7,7 L7,12 M7,7 L12,7'));
    frost.appendChild(c);
  };
  crystal(14, 14, 1, 0);
  crystal(186, 14, 1, 90);
  crystal(14, 286, 1, -90);
  crystal(186, 286, 1, 180);
  k.add(frost);
  // 물방울
  const r = mulberry32(seed);
  const drops = G(null);
  for (let i = 0; i < 16; i++) {
    const side = i % 4;
    const t = r();
    const x = side === 0 ? 16 + r() * 8 : side === 1 ? 176 + r() * 8 : 30 + t * 140;
    const y = side === 0 || side === 1 ? 40 + t * 220 : side === 2 ? 16 + r() * 6 : 278 + r() * 6;
    const rr = between(r, 1, 2.6);
    drops.appendChild(S('circle', { cx: x, cy: y, r: rr, fill: '#ffffff', opacity: 0.25, stroke: '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 0.4 }));
    drops.appendChild(S('circle', { cx: x - rr * 0.35, cy: y - rr * 0.35, r: rr * 0.3, fill: '#ffffff', opacity: 0.9 }));
  }
  k.add(drops);
  // 렌즈
  k.add(S('circle', { cx: 100, cy: 104, r: 58, fill: k.rad('lens', [[0, '#ffffff', 0.35], [0.7, '#bfe9e4', 0.18], [1, '#6fb8b0', 0.35]], 0.42, 0.36, 0.7), stroke: silver, 'stroke-width': 2.2 }));
  k.add(S('circle', { cx: 100, cy: 104, r: 53, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.6, opacity: 0.6, 'stroke-dasharray': '2 3' }));
  k.add(P('M56,82 A48,48 0 0 1 84,56', { stroke: '#ffffff', 'stroke-width': 3, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round' }));
  k.add(Txt({ x: 100, y: 30, 'text-anchor': 'middle', 'font-size': 7, 'letter-spacing': 3, fill: '#2a4a46', opacity: 0.75, 'font-family': 'Pretendard Variable, Pretendard, sans-serif', 'font-weight': 600 }, 'REAGENT · 연구 시약'));
  k.add(P('M40,188 L160,188', { stroke: '#56636a', 'stroke-width': 0.5, opacity: 0.5 }));
  return k.svg;
}

export function reagentCard(def: ReagentDef, opts?: { price?: number }): HTMLElement {
  const { root, body, face } = shell('sa-reagent');
  root.dataset.id = def.id;
  face.appendChild(reagentFrame(hashStr(def.id)));
  const icon = H('div', 'sa-reagent__icon');
  icon.appendChild(reagentIcon(def.id, 64));
  face.appendChild(icon);
  const nm = H('div', 'sa-reagent__name', def.name);
  if ([...(def.name ?? '')].length > 7) nm.classList.add('is-long');
  face.appendChild(nm);
  face.appendChild(H('div', 'sa-reagent__desc', def.desc));
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', `시약 ${def.name}: ${def.desc}${opts?.price !== undefined ? `, 가격 $${opts.price}` : ''}`);
  return root;
}
