// 빛깔 기호 · 납품 라벨 · 품평 기록
import type { SpeciesId, SuitKey } from '../contract/genetics';
import type { BossDef, HandTypeId } from '../contract/game';
import { Kit, S, G, P, Txt, starPath, leafPath, num } from './dom';

// ─────────────────────────────────────────── 빛깔 기호: 색 + 모양 + 무늬
export function suitGlyph(suit: SuitKey, species: SpeciesId, size = 20): SVGSVGElement {
  const k = new Kit('sg', 24, 24, size, size, 'sa-suit');
  const ruby = suit.startsWith('ruby');
  const marked = suit.endsWith('-m');
  if (ruby) {
    const d = 'M12,1.6 L21.6,12 L12,22.4 L2.4,12Z';
    k.add(
      P(d, { fill: k.lin('rb', [[0, '#ff9aa8'], [0.45, '#d7263d'], [1, '#5a0719']], 0.1, 0, 0.9, 1), stroke: '#3d0412', 'stroke-width': 1.1, 'stroke-linejoin': 'round' }),
      P('M12,1.6 L2.4,12 L7.3,12 L12,6.6Z', { fill: '#ffffff', opacity: 0.32 }),
      P('M12,22.4 L21.6,12 L16.7,12 L12,17.4Z', { fill: '#000000', opacity: 0.22 }),
      P('M12,6.6 L16.7,12 L12,17.4 L7.3,12Z', { fill: '#ffffff', 'fill-opacity': 0.1, stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 0.45 }),
      S('circle', { cx: 9.6, cy: 8.2, r: 0.9, fill: '#ffffff' }),
    );
  } else {
    k.add(
      S('circle', { cx: 12, cy: 12, r: 9.9, fill: k.rad('gd', [[0, '#fff4c8'], [0.45, '#f2b632'], [1, '#7a5204']], 0.4, 0.35, 0.75), stroke: '#4a2c00', 'stroke-width': 1.1 }),
      S('circle', { cx: 12.4, cy: 12.4, r: 7.2, fill: 'none', stroke: '#6b4a06', 'stroke-width': 0.6, opacity: 0.6 }),
      S('circle', { cx: 12, cy: 12, r: 7.2, fill: 'none', stroke: '#fff5cf', 'stroke-width': 0.6, opacity: 0.75 }),
      P('M6.4,9.6 A6.3,6.3 0 0 1 10.6,5.8', { stroke: '#ffffff', 'stroke-width': 1.2, fill: 'none', opacity: 0.85, 'stroke-linecap': 'round' }),
    );
  }
  if (marked) {
    const bx = 18.3;
    const by = 5.7;
    k.add(S('circle', { cx: bx, cy: by, r: 5.5, fill: '#1b1f1d', stroke: '#f3ead6', 'stroke-width': 0.8 }));
    if (species === 'stella') {
      k.add(
        G(
          { transform: `translate(${bx - 3.8} ${by + 3}) rotate(-40)` },
          P(leafPath(9.2, 3.3, 0), { fill: k.lin('sl', [[0, '#ffffff'], [0.5, '#d6dee2'], [1, '#8a979e']], 0, 0, 1, 1) }),
        ),
      );
    } else {
      k.add(P(starPath(bx, by, 4.5, 1.5, 4), { fill: '#fff3c8' }));
    }
  }
  const col = ruby ? '루비' : '골드';
  const mk = marked ? (species === 'stella' ? ' · 은빛 잎' : ' · 별무늬') : '';
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  k.svg.setAttribute('aria-label', `${col}${mk}`);
  return k.svg;
}

// ─────────────────────────────────────────── 보스: 밀랍 인장
type Wax = [hi: string, mid: string, lo: string];
const WAX: Record<string, Wax> = {
  coldsnap: ['#d4efff', '#4f93c9', '#16365a'],
  nobees: ['#ffe0a0', '#d68a1a', '#5e3404'],
  uniformity: ['#b4f0cf', '#2c9a63', '#0a3f25'],
  drought: ['#ffc2a0', '#c4572a', '#521c09'],
  judge: ['#b8c6ff', '#34459c', '#0f1740'],
  picky: ['#ffadb9', '#a8193a', '#420412'],
  sommelier: ['#e8b8ff', '#7a2a9c', '#2e0d40'],
  lmoCheck: ['#b8fff6', '#1f9d92', '#083a36'],
  expo: ['#fff3c0', '#d4a52a', '#5e4006'],
  _: ['#ff9aa8', '#b3122e', '#40040f'],
};

/** 문양 (40×40, currentColor). detail 은 맨 위 복제본에만 붙는 어두운 선 */
function bossSymbol(id: string): { sym: SVGGElement; detail?: SVGGElement } {
  const cc = 'currentColor';
  const st = { stroke: cc, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
  const dk = { stroke: '#000000', 'stroke-opacity': 0.35, fill: 'none', 'stroke-width': 0.9, 'stroke-linecap': 'round' } as const;
  switch (id) {
    case 'coldsnap': {
      const g = G({ ...st, 'stroke-width': 2.1 });
      for (let i = 0; i < 6; i++)
        g.appendChild(G({ transform: `rotate(${i * 60} 20 20)` }, P('M20,20 L20,3.5 M20,9 L16.3,5.8 M20,9 L23.7,5.8 M20,14.2 L16.8,11.6 M20,14.2 L23.2,11.6')));
      g.appendChild(P(starPath(20, 20, 4, 2.4, 6, 0), { fill: cc, stroke: 'none' }));
      return { sym: g };
    }
    case 'nobees': {
      const g = G(null,
        S('ellipse', { cx: 21, cy: 22, rx: 8.4, ry: 5.6, fill: cc }),
        S('circle', { cx: 11.5, cy: 21, r: 3.4, fill: cc }),
        S('ellipse', { cx: 19, cy: 13.5, rx: 4, ry: 6, transform: 'rotate(-25 19 13.5)', fill: 'none', stroke: cc, 'stroke-width': 1.6 }),
        S('ellipse', { cx: 25, cy: 13.5, rx: 3.4, ry: 5.2, transform: 'rotate(20 25 13.5)', fill: 'none', stroke: cc, 'stroke-width': 1.6 }),
        P('M29,22 L33,22.5', { ...st, 'stroke-width': 1.6 }),
        P('M5,5 L35,35 M35,5 L5,35', { ...st, 'stroke-width': 3.2 }),
      );
      const d = G(dk, P('M18,17 L18,27 M23,16.6 L23,27.4'));
      return { sym: g, detail: d };
    }
    case 'uniformity': {
      const g = G(null,
        P('M20,7 L20,33 M12,34.5 L28,34.5 M6,11 L34,11', { ...st, 'stroke-width': 2.4 }),
        S('circle', { cx: 20, cy: 6.5, r: 2.4, fill: cc }),
        P('M6,11 L2.5,21 M6,11 L9.5,21 M34,11 L30.5,21 M34,11 L37.5,21', { ...st, 'stroke-width': 1 }),
        P('M1.5,21 Q6,27.5 10.5,21Z M29.5,21 Q34,27.5 38.5,21Z', { fill: cc }),
      );
      return { sym: g };
    }
    case 'drought': {
      const g = G(null, S('circle', { cx: 20, cy: 12, r: 5.2, fill: cc }));
      const rays = G({ ...st, 'stroke-width': 1.7 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rays.appendChild(P(`M${num(20 + Math.cos(a) * 7.6)},${num(12 + Math.sin(a) * 7.6)} L${num(20 + Math.cos(a) * 10.4)},${num(12 + Math.sin(a) * 10.4)}`));
      }
      g.appendChild(rays);
      g.appendChild(P('M3,25 L37,25 L37,35 L3,35Z', { fill: cc }));
      const d = G({ ...dk, 'stroke-width': 1.2, 'stroke-opacity': 0.5 }, P('M11,25 L13,29 L10,32 L11,35 M22,25 L20,28 L24,31 L22,35 M31,25 L32.5,29 L30,35 M20,28 L15,30'));
      return { sym: g, detail: d };
    }
    case 'judge': {
      const g = G(null,
        S('circle', { cx: 16, cy: 16, r: 9.5, fill: 'none', stroke: cc, 'stroke-width': 3 }),
        P('M24.5,21 C30,26 25,31 31,35.5', { ...st, 'stroke-width': 1.6, 'stroke-dasharray': '2.2 1.6' }),
        S('circle', { cx: 32, cy: 36, r: 2, fill: cc }),
      );
      const d = G(dk, P('M10.5,12.5 A6.5,6.5 0 0 1 16,9.5', { 'stroke-width': 1.3 }));
      return { sym: g, detail: d };
    }
    case 'picky': {
      const g = G(null,
        S('circle', { cx: 12.5, cy: 15, r: 6.2, fill: cc }),
        S('circle', { cx: 20, cy: 10.5, r: 7.4, fill: cc }),
        S('circle', { cx: 27.5, cy: 15, r: 6.2, fill: cc }),
        P('M11.5,17 L28.5,17 L27,32 L13,32Z', { fill: cc }),
      );
      const d = G(dk, P('M13.2,27 L26.8,27 M16.5,20 L16.8,26 M20,20 L20,26 M23.5,20 L23.2,26'));
      return { sym: g, detail: d };
    }
    case 'sommelier': {
      const g = G(null,
        P('M11.5,4.5 L28.5,4.5 C29,15 25.5,21.5 20,21.5 C14.5,21.5 11,15 11.5,4.5Z', { fill: cc }),
        P('M20,21 L20,32', { ...st, 'stroke-width': 2.2 }),
        S('ellipse', { cx: 20, cy: 33.5, rx: 7.5, ry: 2, fill: cc }),
      );
      const d = G(dk, P('M12.3,11 C16,12.5 24,9.5 27.7,11'), P('M14,7 C14,13 16,17 18.5,18.5', { 'stroke-opacity': 0.25, stroke: '#ffffff' }));
      return { sym: g, detail: d };
    }
    case 'lmoCheck': {
      const g = G(null,
        P('M3,10.5 L21,10.5 L27,16.5 L21,22.5 L3,22.5Z', { fill: cc }),
        S('circle', { cx: 27, cy: 25, r: 6.4, fill: 'none', stroke: cc, 'stroke-width': 2.6 }),
        P('M31.6,29.6 L36.5,34.5', { ...st, 'stroke-width': 3.4 }),
      );
      const d = G(
        null,
        Txt({ x: 11.5, y: 19.4, 'text-anchor': 'middle', 'font-size': 7.4, 'font-weight': 700, 'font-family': 'Pretendard Variable, Pretendard, sans-serif', fill: '#000000', 'fill-opacity': 0.45 }, 'LMO'),
        S('circle', { cx: 23.5, cy: 16.5, r: 1.2, fill: '#000000', 'fill-opacity': 0.4 }),
      );
      return { sym: g, detail: d };
    }
    case 'expo': {
      const g = G(null,
        P('M13,6 L27,6 L26.2,15.5 C25.5,20.5 22.5,22.5 20,22.5 C17.5,22.5 14.5,20.5 13.8,15.5Z', { fill: cc }),
        P('M13.3,8.5 C8,8.5 8.5,15.5 14,16 M26.7,8.5 C32,8.5 31.5,15.5 26,16', { ...st, 'stroke-width': 1.6 }),
        P('M18.5,22 L21.5,22 L21.5,27 L18.5,27Z M14.5,27.5 L25.5,27.5 L26.5,31 L13.5,31Z', { fill: cc }),
      );
      const laurel = G({ fill: cc });
      for (const side of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const a = Math.PI / 2 + side * (0.55 + i * 0.3);
          const x = 20 + Math.cos(a) * 16;
          const y = 19 + Math.sin(a) * 16;
          const deg = (a * 180) / Math.PI + (side > 0 ? -70 : 70) + 180;
          laurel.appendChild(S('ellipse', { cx: x, cy: y, rx: 2.8, ry: 1.2, transform: `rotate(${num(deg)} ${num(x)} ${num(y)})` }));
        }
      }
      g.appendChild(laurel);
      return { sym: g };
    }
    default: {
      const g = G(null,
        P('M20,34 C13,31 12,22 20,16 C28,22 27,31 20,34Z', { fill: cc }),
        P('M20,16 C20,11 17,8 12,7 C12,12 15,15 20,16Z M20,16 C20,10 24,6 30,6 C29,12 25,15 20,16Z', { fill: cc }),
      );
      const d = G(dk, P('M20,19 C18,24 18,28 20,32'));
      return { sym: g, detail: d };
    }
  }
}

// ─────────────────────────────────────────── 품평회 메달
const HAND_KO: Record<HandTypeId, string> = {
  high: '단품',
  pair: '한 쌍',
  twoPair: '두 쌍',
  three: '세 쌍',
  straight: '당도 계단',
  flush: '한 빛깔',
  fullHouse: '풀 바구니',
  four: '네 쌍',
  straightFlush: '빛깔 계단',
  five: '다섯 쌍',
  flushHouse: '빛깔 바구니',
  flushFive: '완전 균일',
};
type Metal = 'bronze' | 'silver' | 'gold' | 'plat';
const TIER: Record<HandTypeId, Metal> = {
  high: 'bronze',
  pair: 'bronze',
  twoPair: 'bronze',
  three: 'silver',
  straight: 'silver',
  flush: 'silver',
  fullHouse: 'gold',
  four: 'gold',
  straightFlush: 'gold',
  five: 'plat',
  flushHouse: 'plat',
  flushFive: 'plat',
};
const SEED_PIP = 'M0,-4.4 C2.8,-1.6 2.8,2.4 0,4.4 C-2.8,2.4 -2.8,-1.6 0,-4.4Z';

function handSymbol(hand: HandTypeId): { sym: SVGGElement; color: SVGGElement | null } {
  const cc = 'currentColor';
  const pip = (x: number, y: number, s = 1, rot = 0) => P(SEED_PIP, { transform: `translate(${num(x)} ${num(y)}) rotate(${rot}) scale(${s})`, fill: cc });
  const g = G(null);
  let color: SVGGElement | null = null;
  const enamel = (els: SVGElement[]) => G(null, ...els);
  const stairs = (colored: boolean) => {
    const out: SVGElement[] = [];
    for (let i = 0; i < 5; i++) out.push(S('rect', { x: -12.5 + i * 5.2, y: 7 - (i + 1) * 3.2, width: 4.2, height: (i + 1) * 3.2, rx: 0.6, fill: colored ? (i % 2 ? '#f2b632' : '#d7263d') : cc }));
    return out;
  };
  switch (hand) {
    case 'high':
      g.appendChild(pip(0, 0, 2));
      break;
    case 'pair':
      g.appendChild(pip(-5, 0, 1.5, -12));
      g.appendChild(pip(5, 0, 1.5, 12));
      break;
    case 'twoPair':
      for (const [x, y] of [[-5, -5.5], [5, -5.5], [-5, 5.5], [5, 5.5]]) g.appendChild(pip(x, y, 1.1));
      break;
    case 'three':
      for (const [x, y] of [[0, -6], [-6, 4.5], [6, 4.5]]) g.appendChild(pip(x, y, 1.25));
      break;
    case 'four':
      for (const [x, y] of [[0, -7.5], [-7.5, 0], [7.5, 0], [0, 7.5]]) g.appendChild(pip(x, y, 1.1));
      break;
    case 'five':
      for (const [x, y] of [[-7, -7], [7, -7], [0, 0], [-7, 7], [7, 7]]) g.appendChild(pip(x, y, 1.05));
      break;
    case 'straight':
      for (const e of stairs(false)) g.appendChild(e);
      break;
    case 'straightFlush':
      for (const e of stairs(false)) g.appendChild(e);
      color = enamel(stairs(true));
      g.appendChild(P(starPath(10.5, -12.5, 3.6, 1.2, 4), { fill: cc }));
      break;
    case 'flush': {
      const els: SVGElement[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        const x = Math.cos(a) * 10;
        const y = Math.sin(a) * 10 + 8;
        g.appendChild(P('M0,-4 L3,0 L0,4 L-3,0Z', { transform: `translate(${num(x)} ${num(y)}) rotate(${num(((a + Math.PI / 2) * 180) / Math.PI)})`, fill: cc }));
        els.push(P('M0,-3 L2.2,0 L0,3 L-2.2,0Z', { transform: `translate(${num(x)} ${num(y)}) rotate(${num(((a + Math.PI / 2) * 180) / Math.PI)})`, fill: '#d7263d' }));
      }
      color = enamel(els);
      break;
    }
    case 'fullHouse':
    case 'flushHouse': {
      g.appendChild(P('M-12,1 L12,1 L9,11 L-9,11Z', { fill: cc }));
      const pos: [number, number][] = [[-7, -3], [0, -4], [7, -3], [-3.6, -10], [3.6, -10]];
      for (const [x, y] of pos) g.appendChild(S('circle', { cx: x, cy: y, r: 3.3, fill: cc }));
      if (hand === 'flushHouse') color = enamel(pos.map(([x, y]) => S('circle', { cx: x, cy: y, r: 2.3, fill: '#f2b632' })));
      break;
    }
    case 'flushFive': {
      g.appendChild(P(starPath(0, 0, 13, 5.4, 5), { fill: cc }));
      const els: SVGElement[] = [];
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        els.push(S('circle', { cx: Math.cos(a) * 8, cy: Math.sin(a) * 8, r: 1.9, fill: '#d7263d' }));
      }
      els.push(S('circle', { r: 2.6, fill: '#f2b632' }));
      color = enamel(els);
      break;
    }
  }
  return { sym: g, color };
}

// 납품 화면에서 쓰는 표식은 장식용 인장보다 명확한 번호와 도형을 우선한다.
// 어두운 온실 화면 위에 놓이는 종이 라벨을 모티프로 한 평면형 식별자다.
export function bossEmblem(def: BossDef, size = 96): SVGSVGElement {
  const id = def?.id ?? '_';
  const accent = (WAX[id] ?? WAX._)[1];
  const k = new Kit('bsl', 100, 100, size, size, 'sa-boss sa-boss--label');
  k.add(S('rect', { x: 4, y: 4, width: 92, height: 92, rx: 8, fill: '#f1eddf', stroke: accent, 'stroke-width': 3 }));
  k.add(S('rect', { x: 4, y: 4, width: 92, height: 18, rx: 7, fill: accent }));
  k.add(S('rect', { x: 4, y: 16, width: 92, height: 6, fill: accent }));
  k.add(Txt({ x: 10, y: 16, 'font-size': 8.4, 'font-weight': 800, 'letter-spacing': 1.4, fill: '#ffffff', 'font-family': 'Arial, sans-serif' }, 'SPECIAL ORDER'));
  const { sym } = bossSymbol(id);
  sym.setAttribute('transform', 'translate(30 27)');
  sym.setAttribute('color', '#253d37');
  k.add(sym);
  k.add(P('M12,74 H88', { stroke: '#b9c6b6', 'stroke-width': 1 }));
  k.add(Txt({ x: 50, y: 87, 'text-anchor': 'middle', 'font-size': [...def.name].length > 8 ? 8.2 : 10, 'font-weight': 700, fill: '#253d37', 'font-family': 'Pretendard Variable, Pretendard, sans-serif' }, def.name));
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  k.svg.setAttribute('aria-label', `특별 의뢰: ${def.name}`);
  k.svg.dataset.boss = id;
  return k.svg;
}

export function orderEmblem(kind: 'small' | 'big', size = 64): SVGSVGElement {
  const large = kind === 'big';
  const accent = large ? '#a34e55' : '#397b69';
  const k = new Kit('orl', 100, 100, size, size, `sa-order sa-order--${kind}`);
  k.add(S('rect', { x: 4, y: 4, width: 92, height: 92, rx: 8, fill: '#f1eddf', stroke: accent, 'stroke-width': 3 }));
  k.add(S('rect', { x: 4, y: 4, width: 92, height: 18, rx: 7, fill: accent }));
  k.add(S('rect', { x: 4, y: 16, width: 92, height: 6, fill: accent }));
  k.add(Txt({ x: 11, y: 16, 'font-size': 8.5, 'font-weight': 800, 'letter-spacing': 1.8, fill: '#ffffff', 'font-family': 'Arial, sans-serif' }, 'ORDER'));
  k.add(Txt({ x: 50, y: 67, 'text-anchor': 'middle', 'font-size': 49, 'font-weight': 800, 'letter-spacing': -2.5, fill: '#243d36', 'font-family': 'Arial, sans-serif' }, large ? '02' : '01'));
  k.add(P('M12,74 H88', { stroke: '#b9c6b6', 'stroke-width': 1 }));
  k.add(Txt({ x: 50, y: 87, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#253d37', 'font-family': 'Pretendard Variable, Pretendard, sans-serif' }, large ? '특별 납품' : '일반 납품'));
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  k.svg.setAttribute('aria-label', large ? '특별 납품 주문' : '일반 납품 주문');
  return k.svg;
}

export function medalArt(hand: HandTypeId, size = 72): SVGSVGElement {
  const tier = TIER[hand] ?? 'bronze';
  const ink = tier === 'plat' ? '#354a73' : tier === 'gold' ? '#795a22' : tier === 'silver' ? '#506a75' : '#77543c';
  const k = new Kit('mdl', 100, 100, size, size, `sa-medal sa-medal--${tier}`);
  k.add(P('M23,5 H40 L50,35 L60,5 H77 L66,51 H34Z', { fill: '#557c6c' }));
  k.add(P('M30,5 H35 L47,44 H42Z M65,5 H70 L58,44 H53Z', { fill: '#d7e6d4' }));
  k.add(S('circle', { cx: 50, cy: 63, r: 34, fill: '#f1eddf', stroke: ink, 'stroke-width': 4 }));
  k.add(S('circle', { cx: 50, cy: 63, r: 29, fill: 'none', stroke: '#b3bdb0', 'stroke-width': 1 }));
  const { sym } = handSymbol(hand);
  sym.setAttribute('transform', 'translate(50 59) scale(0.88)');
  sym.setAttribute('color', ink);
  k.add(sym);
  k.add(Txt({ x: 50, y: 43, 'text-anchor': 'middle', 'font-size': 6.8, 'font-weight': 800, 'letter-spacing': 1, fill: ink, 'font-family': 'Arial, sans-serif' }, 'ORCHARD'));
  k.add(Txt({ x: 50, y: 86, 'text-anchor': 'middle', 'font-size': 9, 'font-weight': 700, fill: ink, 'font-family': 'Pretendard Variable, Pretendard, sans-serif' }, HAND_KO[hand] ?? hand));
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  k.svg.setAttribute('aria-label', `품평 기록: ${HAND_KO[hand] ?? hand}`);
  return k.svg;
}
