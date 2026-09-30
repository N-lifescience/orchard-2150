// 비법(조커) 아이콘 24종 + 시약 아이콘 8종. 64×64 안에 그라데이션·하이라이트가 있는 작은 그림.
import { Kit, S, G, P, Txt, starPath, leafPath, num, type Attrs } from './dom';

type Draw = (k: Kit) => void;

const OL: Attrs = { stroke: '#120c05', 'stroke-opacity': 0.62, 'stroke-width': 0.9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
const hl = (d: string, w = 1, op = 0.75): SVGPathElement =>
  P(d, { stroke: '#ffffff', 'stroke-width': w, fill: 'none', opacity: op, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
const shadow = (k: Kit, cx: number, cy: number, rx: number, ry: number): SVGEllipseElement =>
  S('ellipse', { cx, cy, rx, ry, fill: k.rad('ish', [[0, '#000000', 0.5], [1, '#000000', 0]]) });
const glint = (x: number, y: number, s: number, fill = '#ffffff'): SVGPathElement => P(starPath(x, y, s, s * 0.24, 4), { fill });
const glow = (k: Kit, x: number, y: number, r: number, c: string, op = 0.55): SVGCircleElement =>
  S('circle', { cx: x, cy: y, r, fill: k.rad(`gl${c.replace('#', '')}`, [[0, c, op], [1, c, 0]]) });
const SERIF = "'Gowun Batang', 'Noto Serif KR', serif";

function fruitBall(k: Kit, x: number, y: number, r: number, kind: 'gold' | 'ruby'): SVGGElement {
  return G(
    null,
    S('circle', { cx: x, cy: y, r, fill: k.paint(kind === 'gold' ? 'goldFruit' : 'ruby', 'r'), ...OL }),
    S('ellipse', { cx: x - r * 0.36, cy: y - r * 0.38, rx: r * 0.3, ry: r * 0.17, transform: `rotate(-38 ${num(x - r * 0.36)} ${num(y - r * 0.38)})`, fill: '#ffffff', opacity: 0.8 }),
    S('circle', { cx: x - r * 0.5, cy: y - r * 0.5, r: r * 0.07, fill: '#ffffff' }),
    P(`M${num(x + r * 0.2)},${num(y + r * 0.86)} A${num(r * 0.9)},${num(r * 0.9)} 0 0 0 ${num(x + r * 0.86)},${num(y + r * 0.2)}`, {
      stroke: '#bff8ef',
      'stroke-width': r * 0.1,
      fill: 'none',
      opacity: 0.6,
      'stroke-linecap': 'round',
    }),
  );
}

function leafEl(k: Kit, x: number, y: number, ang: number, len: number, wid: number, silver = false): SVGGElement {
  return G(
    { transform: `translate(${num(x)} ${num(y)}) rotate(${num(ang)})` },
    P(leafPath(len, wid, 0.04), { fill: k.paint(silver ? 'silverLeaf' : 'leaf', 'd'), ...OL }),
    P(`M0.5,0 Q${num(len * 0.5)},${num(-len * 0.03)} ${num(len * 0.92)},${num(-len * 0.05)}`, { stroke: '#d6f8b8', 'stroke-width': 0.6, fill: 'none', opacity: 0.7 }),
  );
}

/** X 모양 염색체 (두 염색분체) */
function chromoX(k: Kit, cx: number, cy: number, h: number, w: number, paint: 'magenta' | 'purple' | 'teal', op = 1): SVGGElement {
  const top = cy - h * 0.42;
  const bot = cy + h * 0.58;
  const sp = w * 1.25;
  const L = `M${num(cx - sp)},${num(top)} Q${num(cx - w * 0.22)},${num(cy)} ${num(cx - sp)},${num(bot)}`;
  const R = `M${num(cx + sp)},${num(top)} Q${num(cx + w * 0.22)},${num(cy)} ${num(cx + sp)},${num(bot)}`;
  const g = G({ opacity: op, fill: 'none', 'stroke-linecap': 'round' });
  for (const d of [L, R]) g.appendChild(P(d, { stroke: '#1a0512', 'stroke-width': w + 1.4, 'stroke-opacity': 0.7 }));
  for (const d of [L, R]) g.appendChild(P(d, { stroke: k.paint(paint, 'h'), 'stroke-width': w }));
  for (const d of [L, R]) g.appendChild(P(d, { stroke: '#ffffff', 'stroke-width': w * 0.22, opacity: 0.45, transform: `translate(${num(-w * 0.2)} 0)` }));
  const bands = G({ stroke: '#3d0620', 'stroke-width': Math.max(0.8, w * 0.2), opacity: 0.5 });
  for (const f of [-0.28, -0.14, 0.2, 0.36]) {
    const y = cy + h * f;
    const t = Math.abs(y - cy) / (f < 0 ? cy - top : bot - cy);
    const off = w * 0.22 + (sp - w * 0.22) * t * t;
    bands.appendChild(P(`M${num(cx - off - w / 2)},${num(y)} L${num(cx - off + w / 2)},${num(y)} M${num(cx + off - w / 2)},${num(y)} L${num(cx + off + w / 2)},${num(y)}`));
  }
  g.appendChild(bands);
  g.appendChild(S('circle', { cx, cy, r: w * 0.45, fill: '#ffe0ec', opacity: 0.7 }));
  return g;
}

function petalsFlower(k: Kit, x: number, y: number, len: number, rot: number, grad: string): SVGGElement {
  const d = 'M0,0 C3,-5.5 9,-7.5 12.5,-5 C15,-3 15,-1 14.2,0 C15,1 15,3 12.5,5 C9,7.5 3,5.5 0,0Z';
  const g = G(null);
  for (let i = 0; i < 5; i++)
    g.appendChild(G({ transform: `translate(${num(x)} ${num(y)}) rotate(${num(rot + i * 72)}) scale(${num(len / 14.5)})` }, P(d, { fill: grad, ...OL, 'stroke-width': 0.7 })));
  g.appendChild(S('circle', { cx: x, cy: y, r: len * 0.26, fill: k.paint('goldFruit', 'r'), ...OL, 'stroke-width': 0.6 }));
  return g;
}

// ─────────────────────────────────────────── 비법 아이콘
const JOKER: Record<string, Draw> = {
  shears(k) {
    k.add(shadow(k, 30, 59, 21, 3));
    const ruby = k.paint('rubyEnamel', 'd');
    k.add(P('M27,31 L31.5,34.5 C27,43 21,51 14,58.5 C11,60.5 7.5,58.5 8.5,55 C14.5,47 20.5,39 27,31Z', { fill: ruby, ...OL }));
    k.add(hl('M11.5,55.8 C16.5,49.2 21,42.8 25.8,35.8', 0.9, 0.45));
    k.add(P('M31.5,34.5 L36,31 C41,40 43.5,48 45.5,57.5 C45.5,61 41,61.5 39.8,58.3 C37.8,50 35,42 31.5,34.5Z', { fill: ruby, ...OL }));
    k.add(hl('M43,57.2 C41.6,50 39.6,43.6 36.6,37.2', 0.9, 0.45));
    k.add(P('M23.4,36 L30,37.2 L29,39.3 L22.2,38.1Z', { fill: k.paint('gold', 'v'), ...OL }));
    k.add(P('M33.2,38.8 L38.6,37.2 L39.4,39.4 L34,41Z', { fill: k.paint('gold', 'v'), ...OL }));
    k.add(P('M29.5,41 L34,42 L30.2,43.8 L34.6,45 L31,46.6', { stroke: k.paint('gold', 'd'), 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    const steel = k.paint('silver', 'd');
    k.add(P('M30,35 C36,29 44,22 55,16.5 C57.5,15.5 58.8,17 57.2,18.6 C49,24.5 41,31 33.5,36.5Z', { fill: steel, ...OL }));
    k.add(hl('M34,33.5 C41,27.5 48,22 55.6,17.4', 0.8, 0.9));
    k.add(leafEl(k, 47, 13.5, -25, 10, 3.4));
    k.add(P('M28.5,34 C29,25 35,15 46,8 C49,6.3 51.2,7.5 49.6,10 C44,15.5 38,24 34.5,33Z', { fill: steel, ...OL }));
    k.add(hl('M46.5,9.3 C40.5,14 35.8,21 33.2,29', 0.9, 0.95));
    k.add(S('circle', { cx: 32, cy: 33.6, r: 3.5, fill: k.paint('gold', 'r'), ...OL }));
    k.add(S('circle', { cx: 32, cy: 33.6, r: 1.1, fill: '#4a3208' }));
    k.add(glint(54, 12, 3.2));
  },

  rubyLover(k) {
    k.add(shadow(k, 32, 58, 17, 2.6));
    const heart = 'M32,53 C15,41 8.5,31 11.5,22.5 C14.5,14 25,12.5 32,20.5 C39,12.5 49.5,14 52.5,22.5 C55.5,31 49,41 32,53Z';
    k.add(glow(k, 32, 33, 26, '#ff4f6e', 0.35));
    k.add(P(heart, { fill: k.rad('rh', [[0, '#ffb8c3'], [0.35, '#e8354f'], [0.75, '#8e0f2a'], [1, '#3d0412']], 0.38, 0.3, 0.78), stroke: '#2a020b', 'stroke-width': 1 }));
    const O: [number, number][] = [[32, 20.5], [22, 15.2], [12.8, 21], [12.4, 30.5], [19.5, 40.5], [32, 52.5], [44.5, 40.5], [51.6, 30.5], [51.2, 21], [42, 15.2]];
    const c: [number, number] = [32, 30.5];
    const I = O.map(([x, y]) => [c[0] + (x - c[0]) * 0.5, c[1] + (y - c[1]) * 0.5] as [number, number]);
    for (let i = 0; i < O.length; i++) {
      const j = (i + 1) % O.length;
      const mx = (O[i][0] + O[j][0] + I[i][0] + I[j][0]) / 4 - c[0];
      const my = (O[i][1] + O[j][1] + I[i][1] + I[j][1]) / 4 - c[1];
      const l = Math.hypot(mx, my) || 1;
      const d = (-0.6 * mx - 0.8 * my) / l;
      k.add(
        P(`M${O[i]}L${O[j]}L${I[j]}L${I[i]}Z`, {
          fill: d > 0 ? '#ffffff' : '#000000',
          'fill-opacity': num(d > 0 ? 0.08 + d * 0.22 : -d * 0.25),
          stroke: '#ffd0d8',
          'stroke-opacity': 0.35,
          'stroke-width': 0.4,
        }),
      );
    }
    k.add(P(`M${I.map((p) => p.join(',')).join('L')}Z`, { fill: '#ffffff', 'fill-opacity': 0.13, stroke: '#ffe0e6', 'stroke-opacity': 0.55, 'stroke-width': 0.45 }));
    k.add(glint(21.5, 22, 5.5));
    k.add(glint(45, 18.5, 2.4));
    k.add(glint(55, 9, 3.4, '#ffe6a0'));
    k.add(glint(9, 44, 2.4, '#ffe6a0'));
  },

  goldCollector(k) {
    k.add(shadow(k, 32, 58, 24, 3.2));
    k.add(glow(k, 32, 36, 28, '#ffd23f', 0.3));
    for (const [x, y, r] of [[32, 20.5, 8.6], [24.5, 34, 9.6], [39.5, 34, 9.6], [17.5, 47.5, 10], [32, 49, 10.4], [46.5, 47.5, 10]] as [number, number, number][])
      k.add(fruitBall(k, x, y, r, 'gold'));
    k.add(P('M32,12.2 C32.5,9.5 34,8 36,7', { stroke: '#5a3c1c', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(leafEl(k, 33.5, 10, -30, 9, 3.2));
    k.add(glint(52, 22, 3.6, '#fff3c8'));
    k.add(glint(10, 30, 2.6, '#fff3c8'));
  },

  patternArtisan(k) {
    k.add(shadow(k, 30, 59, 20, 2.4));
    k.add(P('M37,30 C45,21 55,23 57.5,33', { stroke: k.paint('ruby', 'h'), 'stroke-width': 5.5, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(hl('M39,28 C45.5,22.5 53,23.5 56,30', 0.8, 0.5));
    k.add(
      G(
        { transform: 'translate(20.5 45.5) rotate(-45)' },
        P('M-20,-1.5 L6,-2.6 L6,2.6 L-20,1.5 Q-22,0 -20,-1.5Z', { fill: k.paint('wood', 'v'), ...OL }),
        hl('M-18,-0.8 L5,-1.6', 0.6, 0.45),
        S('rect', { x: 6, y: -3.2, width: 6.2, height: 6.4, rx: 0.8, fill: k.paint('gold', 'v'), ...OL }),
        P('M12,-3.4 C17,-3.6 21,-2 24.5,0 C21,2 17,3.6 12,3.4Z', { fill: k.paint('ink', 'v'), ...OL }),
        P('M18.5,-2.4 C21.5,-1.3 23.2,-0.4 24.5,0 C23.2,0.4 21.5,1.3 18.5,2.4 C19.5,0.8 19.5,-0.8 18.5,-2.4Z', { fill: '#e8354f' }),
      ),
    );
    for (const [x, y, s] of [[49, 13, 6.2], [57, 45, 4.2], [44, 44, 3.4], [58, 20, 2.6]] as [number, number, number][]) {
      k.add(S('circle', { cx: x, cy: y, r: s * 1.3, fill: '#fff3c8', opacity: 0.18 }));
      k.add(P(starPath(x, y, s, s * 0.3, 4), { fill: '#fff3c8', stroke: '#8a6a2b', 'stroke-width': 0.5 }));
    }
  },

  refractometer(k) {
    k.add(shadow(k, 32, 58, 23, 2.8));
    k.add(
      G(
        { transform: 'translate(31 35) rotate(-36)' },
        S('rect', { x: -30, y: -5.4, width: 9.5, height: 10.8, rx: 2.6, fill: k.paint('ink', 'v'), ...OL }),
        P('M-28,-5.4 L-28,5.4 M-25.6,-5.4 L-25.6,5.4 M-23.2,-5.4 L-23.2,5.4', { stroke: '#5a6660', 'stroke-width': 0.5 }),
        S('rect', { x: -21.5, y: -6, width: 37, height: 12, rx: 2, fill: k.paint('steel', 'v'), ...OL }),
        S('rect', { x: -15.5, y: -7, width: 6.4, height: 14, rx: 1.2, fill: k.paint('brass', 'v'), ...OL }),
        P('M-14.5,-7 L-14.5,7 M-13.2,-7 L-13.2,7 M-11.9,-7 L-11.9,7 M-10.6,-7 L-10.6,7', { stroke: '#553a0c', 'stroke-width': 0.4, opacity: 0.7 }),
        S('rect', { x: -4, y: -2.2, width: 13, height: 4.4, rx: 1, fill: '#10222a', ...OL }),
        P('M-2.5,0 L7.5,0', { stroke: '#2fd4c4', 'stroke-width': 0.8 }),
        P('M-2,-1.2 L-2,1.2 M1,-1.2 L1,1.2 M4,-1.2 L4,1.2 M7,-1.2 L7,1.2', { stroke: '#8ffff4', 'stroke-width': 0.35 }),
        S('rect', { x: 15.5, y: -7.5, width: 11, height: 15, rx: 2, fill: k.paint('brass', 'v'), ...OL }),
        P('M26.5,-7.5 L33.5,-15.5 L35.5,-13.5 L28,-5.5Z', { fill: k.paint('silver', 'd'), ...OL }),
        hl('M-20,-4 L14,-4', 0.9, 0.7),
      ),
    );
    k.add(P('M47.5,17.5 C47.5,15 49,13 50.3,11.6 C51.6,13 53,15 53,17.5 C53,19.2 51.8,20.4 50.3,20.4 C48.8,20.4 47.5,19.2 47.5,17.5Z', { fill: k.paint('ruby', 'd'), ...OL }));
    k.add(S('circle', { cx: 49.2, cy: 16.5, r: 0.8, fill: '#ffffff' }));
    k.add(glint(12, 16, 3, '#bff8ef'));
  },

  purebredCert(k) {
    k.add(shadow(k, 32, 58, 23, 2.6));
    const g = G({ transform: 'rotate(-6 32 32)' });
    g.appendChild(P('M12,10 L50,10 L50,53 L12,53Z', { fill: k.paint('paper', 'v'), ...OL }));
    g.appendChild(S('rect', { x: 15.5, y: 15.5, width: 31, height: 34, fill: 'none', stroke: '#b8923f', 'stroke-width': 0.7 }));
    g.appendChild(S('rect', { x: 17, y: 17, width: 28, height: 31, fill: 'none', stroke: '#b8923f', 'stroke-width': 0.3 }));
    g.appendChild(S('rect', { x: 10, y: 7, width: 42, height: 6.4, rx: 3.2, fill: k.paint('paper', 'h'), ...OL }));
    g.appendChild(hl('M12,8.8 L50,8.8', 0.7, 0.8));
    g.appendChild(S('rect', { x: 21, y: 19.5, width: 20, height: 2.4, rx: 1, fill: '#b8923f' }));
    for (const [y, w] of [[25, 22], [28.6, 18], [32.2, 22], [35.8, 12]] as [number, number][])
      g.appendChild(S('rect', { x: 20, y, width: w, height: 1.2, rx: 0.6, fill: '#7a6a4a', opacity: 0.55 }));
    g.appendChild(S('circle', { cx: 38.5, cy: 42, r: 7.8, fill: '#c21d3a', 'fill-opacity': 0.12, stroke: '#c21d3a', 'stroke-width': 1.4 }));
    g.appendChild(S('circle', { cx: 38.5, cy: 42, r: 5.7, fill: 'none', stroke: '#c21d3a', 'stroke-width': 0.6 }));
    g.appendChild(P(starPath(38.5, 42, 3.2, 1.4, 6), { fill: '#c21d3a' }));
    k.add(g);
    k.add(P('M14.5,50 L11.5,59.5 L15,57.8 L17,60.5 L18.8,51Z', { fill: k.paint('ruby', 'd'), ...OL }));
    k.add(P('M19.5,50.5 L21,60 L23.4,57.4 L26.4,58.6 L23.8,49.5Z', { fill: k.paint('ruby', 'd'), ...OL }));
    k.add(S('circle', { cx: 19, cy: 47.5, r: 6.2, fill: k.paint('gold', 'r'), ...OL }));
    k.add(P(starPath(19, 47.5, 4, 1.8, 8), { fill: '#fff1c1', opacity: 0.7 }));
  },

  heterosis(k) {
    k.add(shadow(k, 32, 58, 20, 2.4));
    k.add(glow(k, 34, 30, 24, '#ffb04a', 0.28));
    const clip = k.clip('lf', P(leafPath(50, 16, 0), { transform: 'translate(11 53) rotate(-46)' }));
    const g = G({ transform: 'translate(11 53) rotate(-46)' });
    g.appendChild(P('M0,0 L-7,0.4', { stroke: '#3d5a22', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    g.appendChild(P('M0,0 C14,-16 39,-12.48 50,0 L0,0Z', { fill: k.lin('hu', [[0, '#ff8a9a'], [0.5, '#d7263d'], [1, '#6e0a20']], 0, 1, 0, 0) }));
    g.appendChild(P('M0,0 C15,16 38,11.52 50,0 L0,0Z', { fill: k.lin('hd', [[0, '#fff0b0'], [0.5, '#f2b632'], [1, '#8a5a04']], 0, 0, 0, 1) }));
    k.add(g);
    k.add(
      G(
        { 'clip-path': clip },
        G({ transform: 'translate(11 53) rotate(-46)' }, S('rect', { x: -2, y: -2.2, width: 56, height: 4.4, fill: k.lin('seam', [[0, '#d7263d', 0], [0.5, '#ff8a3a', 0.75], [1, '#f2b632', 0]], 0, 0, 0, 1) })),
      ),
    );
    const g2 = G({ transform: 'translate(11 53) rotate(-46)' });
    g2.appendChild(P(leafPath(50, 16, 0), { fill: 'none', ...OL }));
    const v = G({ stroke: '#fff6d8', 'stroke-width': 0.6, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' });
    v.appendChild(P('M1,0 L48,0', { 'stroke-width': 1 }));
    for (let i = 1; i <= 5; i++) {
      const x = i * 7.5;
      v.appendChild(P(`M${x},0 Q${x + 3},-4 ${x + 6},${-9 + i * 0.9}`));
      v.appendChild(P(`M${x},0 Q${x + 3},4 ${x + 6},${9 - i * 0.9}`));
    }
    g2.appendChild(v);
    k.add(g2);
    k.add(glint(47, 13, 4.2, '#fff3c8'));
    k.add(glint(54, 22, 2.4, '#fff3c8'));
  },

  hideAndSeek(k) {
    k.add(shadow(k, 34, 58, 21, 2.6));
    k.add(glow(k, 44, 38, 16, '#ffd23f', 0.35));
    k.add(fruitBall(k, 44, 38, 12.5, 'gold'));
    k.add(P('M44,25.8 C44.5,23 46,21.5 48,20.5', { stroke: '#5a3c1c', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' }));
    const g = G({ transform: 'translate(7 55) rotate(-54)' });
    g.appendChild(P(leafPath(53, 17, 0.05), { fill: k.paint('leaf', 'd'), ...OL }));
    g.appendChild(P('M0,0 C14.84,-17 41.34,-13.26 53,-3.18 Q26.5,-2 0,0Z', { fill: '#ffffff', opacity: 0.14 }));
    const v = G({ stroke: '#c9f5a8', 'stroke-width': 0.55, fill: 'none', opacity: 0.65, 'stroke-linecap': 'round' });
    v.appendChild(P('M1,0 Q26,-1.5 50,-3', { 'stroke-width': 1 }));
    for (let i = 1; i <= 5; i++) {
      const x = i * 8;
      v.appendChild(P(`M${x},${-x * 0.05} Q${x + 3},-5 ${x + 7},${-10 + i}`));
      v.appendChild(P(`M${x},${-x * 0.05} Q${x + 3},4 ${x + 7},${9 - i}`));
    }
    g.appendChild(v);
    k.add(g);
    k.add(Txt({ x: 55, y: 17, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff3c8', 'font-family': SERIF, opacity: 0.95 }, '?'));
    k.add(glint(58.5, 29, 2.4, '#fff3c8'));
  },

  selfingMaster(k) {
    const cx = 32;
    const cy = 33;
    const R = 22;
    const a0 = (-40 * Math.PI) / 180;
    const a1 = (235 * Math.PI) / 180;
    const p0 = [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R];
    const p1 = [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R];
    const arc = `M${num(p0[0])},${num(p0[1])} A${R},${R} 0 1 1 ${num(p1[0])},${num(p1[1])}`;
    k.add(P(arc, { stroke: '#2a1a05', 'stroke-width': 4.6, fill: 'none', 'stroke-linecap': 'round', opacity: 0.5 }));
    k.add(P(arc, { stroke: k.paint('gold', 'd'), 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round' }));
    const ta = a1 + Math.PI / 2;
    const hx = p1[0] + Math.cos(ta) * 1.5;
    const hy = p1[1] + Math.sin(ta) * 1.5;
    const tip = [hx + Math.cos(ta) * 6.5, hy + Math.sin(ta) * 6.5];
    const nx = Math.cos(a1);
    const ny = Math.sin(a1);
    k.add(
      P(`M${num(tip[0])},${num(tip[1])} L${num(hx + nx * 5)},${num(hy + ny * 5)} L${num(hx - nx * 5)},${num(hy - ny * 5)}Z`, {
        fill: k.paint('gold', 'd'),
        ...OL,
      }),
    );
    k.add(glow(k, cx, cy, 15, '#ff6f9a', 0.35));
    const pg = k.rad('pp', [[0, '#8a1240'], [0.35, '#ff4f8b'], [1, '#ffd0e0']], 0, 0, 15, undefined, undefined, { gradientUnits: 'userSpaceOnUse' });
    k.add(petalsFlower(k, cx, cy, 13.5, -90, pg));
    for (const a of [20, 110, 180]) {
      const r = (a * Math.PI) / 180;
      k.add(S('circle', { cx: cx + Math.cos(r) * R, cy: cy + Math.sin(r) * R, r: 1.6, fill: '#fff2a0', stroke: '#7a4a00', 'stroke-width': 0.4 }));
    }
  },

  breedingLog(k) {
    k.add(shadow(k, 30, 58, 22, 2.6));
    const g = G({ transform: 'rotate(-8 28 34)' });
    g.appendChild(S('rect', { x: 14.5, y: 13, width: 31, height: 42, rx: 2, fill: '#f3ead6', ...OL }));
    g.appendChild(P('M44.5,16 L44.5,53 M43.5,16 L43.5,53', { stroke: '#b8a67a', 'stroke-width': 0.35 }));
    g.appendChild(S('rect', { x: 11.5, y: 11, width: 31, height: 42, rx: 2.5, fill: k.paint('leather', 'd'), ...OL }));
    g.appendChild(S('rect', { x: 11.5, y: 11, width: 5, height: 42, fill: '#1e0d04', opacity: 0.4 }));
    g.appendChild(S('rect', { x: 19, y: 14, width: 21, height: 36, rx: 1.5, fill: 'none', stroke: '#e6c77a', 'stroke-width': 0.5, 'stroke-dasharray': '1.4 1', opacity: 0.75 }));
    g.appendChild(leafEl(k, 24.5, 34, -50, 10, 3.6));
    g.appendChild(S('circle', { cx: 29.5, cy: 30, r: 0.1, fill: 'none' }));
    g.appendChild(S('rect', { x: 36, y: 28, width: 10.5, height: 5, rx: 1, fill: '#3a1c0a', ...OL }));
    g.appendChild(S('rect', { x: 40.5, y: 27, width: 4.2, height: 7, rx: 0.8, fill: 'none', stroke: k.paint('gold', 'd'), 'stroke-width': 1.1 }));
    k.add(g);
    const q = G({ transform: 'translate(25 59) rotate(-60)' });
    q.appendChild(P('M13,0 C21,-7.5 40,-9 58,-2 C44,4.5 26,6 13,0Z', { fill: k.paint('paper', 'd'), ...OL }));
    const barbs = G({ stroke: '#a8987a', 'stroke-width': 0.35, opacity: 0.8 });
    for (let i = 0; i < 9; i++) {
      const x = 17 + i * 4.4;
      barbs.appendChild(P(`M${x},${-0.2 - i * 0.12} L${x + 3.5},${-5.5 + Math.abs(i - 4.5) * 0.35}`));
      barbs.appendChild(P(`M${x},${-0.2 - i * 0.12} L${x + 3},${3.6 - Math.abs(i - 4.5) * 0.3}`));
    }
    q.appendChild(barbs);
    q.appendChild(P('M0,0 L58,-1.8', { stroke: '#7a6a4a', 'stroke-width': 0.8 }));
    q.appendChild(P('M0,0 L7,-1.5 L7,1.3Z', { fill: k.paint('gold', 'd'), ...OL }));
    k.add(q);
    k.add(S('circle', { cx: 23.5, cy: 60.5, r: 1.3, fill: '#0e1110' }));
  },

  mendelGlasses(k) {
    k.add(shadow(k, 32, 58, 24, 2.4));
    const pod = G({ transform: 'translate(32 47)' });
    pod.appendChild(P('M-25,0 C-17,-8.5 17,-8.5 25,-1 C17,7.5 -17,7.5 -25,0Z', { fill: k.paint('leaf', 'd'), ...OL }));
    pod.appendChild(P('M-21,0 C-13,-4.8 13,-4.8 21,-0.6 C13,3.2 -13,3.2 -21,0Z', { fill: '#d8f5b0' }));
    const pea = k.rad('pea', [[0, '#eaffcc'], [0.5, '#6cc24a'], [1, '#235e17']], 0.38, 0.32, 0.72);
    for (const x of [-13.5, -4.5, 4.5, 13.5]) {
      pod.appendChild(S('circle', { cx: x, cy: -0.6, r: 4.3, fill: pea, ...OL }));
      pod.appendChild(S('circle', { cx: x - 1.4, cy: -2, r: 1, fill: '#ffffff', opacity: 0.8 }));
    }
    pod.appendChild(P('M25,-1 C28,-2 29,-5 27.5,-7', { stroke: '#2e6a1e', 'stroke-width': 1.1, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(pod);
    const gold = k.paint('gold', 'd');
    for (const x of [20, 44]) {
      k.add(S('circle', { cx: x, cy: 22, r: 10, fill: k.paint('glass', 'd'), stroke: '#2a1a05', 'stroke-width': 3.2, 'stroke-opacity': 0.5 }));
      k.add(S('circle', { cx: x, cy: 22, r: 10, fill: 'none', stroke: gold, 'stroke-width': 2.1 }));
      k.add(hl(`M${x - 6},${19} A6.5,6.5 0 0 1 ${x - 1.5},${14.5}`, 1.1, 0.85));
    }
    k.add(P('M30,21 Q32,17.2 34,21', { stroke: gold, 'stroke-width': 2, fill: 'none' }));
    k.add(P('M10.2,20 L4,16.5 M53.8,20 L60,16.5', { stroke: gold, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
  },

  punnettNote(k) {
    k.add(shadow(k, 32, 59, 23, 2.4));
    const g = G({ transform: 'rotate(4 32 32)' });
    g.appendChild(S('rect', { x: 10, y: 9, width: 44, height: 49, rx: 2, fill: k.paint('paper', 'v'), ...OL }));
    for (let x = 15; x <= 49; x += 5.6) g.appendChild(S('circle', { cx: x, cy: 9.5, r: 1.8, fill: 'none', stroke: k.paint('silver', 'd'), 'stroke-width': 1.1 }));
    const t = { 'font-family': SERIF, 'font-weight': 700, 'font-size': 7, 'text-anchor': 'middle', fill: '#1b1f1d' };
    g.appendChild(Txt({ ...t, x: 30, y: 21 }, 'R'));
    g.appendChild(Txt({ ...t, x: 43, y: 21 }, 'r'));
    g.appendChild(Txt({ ...t, x: 18, y: 32.5 }, 'R'));
    g.appendChild(Txt({ ...t, x: 18, y: 45.5 }, 'r'));
    g.appendChild(S('rect', { x: 23.5, y: 23.5, width: 26, height: 26, fill: 'none', stroke: '#1b1f1d', 'stroke-width': 0.9 }));
    g.appendChild(P('M36.5,23.5 V49.5 M23.5,36.5 H49.5', { stroke: '#1b1f1d', 'stroke-width': 0.7 }));
    const ruby = k.paint('ruby', 'r');
    const goldF = k.paint('goldFruit', 'r');
    for (const [x, y, c] of [[30, 30, ruby], [43, 30, ruby], [30, 43, ruby], [43, 43, goldF]] as [number, number, string][]) {
      g.appendChild(S('circle', { cx: x, cy: y, r: 4.2, fill: c, ...OL, 'stroke-width': 0.6 }));
      g.appendChild(S('circle', { cx: x - 1.3, cy: y - 1.4, r: 1, fill: '#ffffff', opacity: 0.85 }));
    }
    k.add(g);
    k.add(
      G(
        { transform: 'translate(40 60) rotate(-38)' },
        S('rect', { x: 0, y: -2.3, width: 20, height: 4.6, fill: k.lin('pen', [[0, '#ffe27a'], [0.5, '#f2b632'], [1, '#a86f06']]), ...OL }),
        P('M0,-2.3 L-5.5,0 L0,2.3Z', { fill: '#ecd7ae', ...OL }),
        P('M-3.8,-0.75 L-5.5,0 L-3.8,0.75Z', { fill: '#1b1f1d' }),
        S('rect', { x: 19.5, y: -2.3, width: 1.8, height: 4.6, fill: k.paint('silver', 'v') }),
        S('rect', { x: 21.3, y: -2.3, width: 3, height: 4.6, rx: 1, fill: '#e8354f' }),
      ),
    );
  },

  beeSwarm(k) {
    k.add(P('M6,42 C14,30 22,48 30,37 S44,26 54,35', { stroke: '#f3ead6', 'stroke-width': 0.8, fill: 'none', 'stroke-dasharray': '1.5 2', opacity: 0.55 }));
    k.add(P('M10,12 C18,6 26,20 38,12', { stroke: '#f3ead6', 'stroke-width': 0.8, fill: 'none', 'stroke-dasharray': '1.5 2', opacity: 0.45 }));
    const bee = (i: number, x: number, y: number, s: number, rot: number) => {
      const clip = k.clip(`bee${i}`, S('ellipse', { rx: 7, ry: 4.6 }));
      k.add(
        G(
          { transform: `translate(${x} ${y}) rotate(${rot}) scale(${s})` },
          S('ellipse', { cx: -1, cy: -5.5, rx: 3.6, ry: 5.6, transform: 'rotate(-22 -1 -5.5)', fill: '#e8fbff', 'fill-opacity': 0.55, stroke: '#ffffff', 'stroke-width': 0.5 }),
          S('ellipse', { cx: 2.8, cy: -5, rx: 3, ry: 4.8, transform: 'rotate(24 2.8 -5)', fill: '#e8fbff', 'fill-opacity': 0.45, stroke: '#ffffff', 'stroke-width': 0.5 }),
          S('ellipse', { rx: 7, ry: 4.6, fill: k.paint('goldFruit', 'r') }),
          G({ 'clip-path': clip, fill: '#1b1f1d' }, S('rect', { x: -1.8, y: -6, width: 2.2, height: 12 }), S('rect', { x: 2.6, y: -6, width: 2.2, height: 12 })),
          S('ellipse', { rx: 7, ry: 4.6, fill: 'none', ...OL }),
          S('ellipse', { cx: -2.5, cy: -2, rx: 2.5, ry: 1.1, fill: '#ffffff', opacity: 0.55 }),
          S('circle', { cx: -7.4, cy: 0, r: 3.2, fill: k.paint('ink', 'd'), ...OL }),
          S('circle', { cx: -8.4, cy: -0.8, r: 0.7, fill: '#ffffff' }),
          P('M6.8,-0.6 L9.8,0.2 L6.8,1.2Z', { fill: '#1b1f1d' }),
          P('M-9,-2.4 C-10.5,-5 -12,-5.6 -13.2,-5.3 M-8,-2.8 C-8.6,-6 -9.6,-7 -10.9,-7.5', { stroke: '#1b1f1d', 'stroke-width': 0.6, fill: 'none' }),
        ),
      );
    };
    bee(0, 20, 21, 1.05, -10);
    bee(1, 47, 17, 0.9, 14);
    bee(2, 34, 45, 1.3, -5);
  },

  seedVault(k) {
    k.add(shadow(k, 32, 59, 22, 2.4));
    k.add(S('circle', { cx: 32, cy: 32, r: 26, fill: k.paint('steel', 'r'), ...OL }));
    k.add(S('circle', { cx: 32, cy: 32, r: 22.5, fill: k.rad('vd', [[0, '#5d6a71'], [0.7, '#aebbc1'], [1, '#e6eef1']], 0.6, 0.62, 0.7), ...OL }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.add(S('circle', { cx: 32 + Math.cos(a) * 24.3, cy: 32 + Math.sin(a) * 24.3, r: 1.2, fill: k.paint('silver', 'r'), stroke: '#1b2226', 'stroke-width': 0.4 }));
    }
    k.add(S('circle', { cx: 32, cy: 32, r: 15.5, fill: k.rad('vi', [[0, '#2a3a3f'], [1, '#0b1114']]), ...OL }));
    const brass = k.paint('brass', 'd');
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + 0.3;
      const dx = Math.cos(a) * 13;
      const dy = Math.sin(a) * 13;
      k.add(P(`M${num(32 - dx)},${num(32 - dy)} L${num(32 + dx)},${num(32 + dy)}`, { stroke: '#2a1a05', 'stroke-width': 3.6, 'stroke-linecap': 'round', opacity: 0.6 }));
      k.add(P(`M${num(32 - dx)},${num(32 - dy)} L${num(32 + dx)},${num(32 + dy)}`, { stroke: brass, 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
      for (const s of [-1, 1]) k.add(S('circle', { cx: 32 + s * dx, cy: 32 + s * dy, r: 2, fill: k.paint('brass', 'r'), ...OL }));
    }
    k.add(glow(k, 32, 32, 10, '#ffd23f', 0.8));
    k.add(P('M32,40.5 C26.5,38 26,31 32,25 C38,31 37.5,38 32,40.5Z', { fill: k.paint('goldFruit', 'r'), ...OL }));
    k.add(P('M32,27.5 C30.5,31 30.5,35 32,38.5', { stroke: '#7a5204', 'stroke-width': 0.6, fill: 'none', opacity: 0.8 }));
    k.add(hl('M13,22 A21,21 0 0 1 24,11.5', 1.2, 0.55));
  },

  pollenTrader(k) {
    k.add(shadow(k, 32, 58.5, 25, 2.6));
    const dust = G(null);
    const pts: [number, number, number][] = [[20, 12, 1.1], [26, 8, 0.8], [31, 13, 1.3], [16, 7, 0.7], [35, 7, 0.9], [23, 3.5, 0.6], [29, 3, 0.7]];
    for (const [x, y, r] of pts) {
      dust.appendChild(S('circle', { cx: x, cy: y, r: r * 2.4, fill: '#ffe066', opacity: 0.25 }));
      dust.appendChild(S('circle', { cx: x, cy: y, r, fill: '#fff2a0' }));
    }
    k.add(dust);
    k.add(P('M10,52 C6,40 10,29 19.5,24.5 L34.5,24.5 C44,29 47,40 44,52 C36,57.5 18,57.5 10,52Z', { fill: k.paint('linen', 'd'), ...OL }));
    k.add(P('M17.5,21.5 C19,14.5 35,14.5 36.5,21.5 C33,19.8 21,19.8 17.5,21.5Z', { fill: k.paint('linen', 'v'), ...OL }));
    k.add(S('ellipse', { cx: 27, cy: 19.5, rx: 8.5, ry: 2.4, fill: k.rad('pl', [[0, '#fff6b0'], [1, '#e0b52c']]) }));
    for (const [x, y] of [[23, 18.4], [27, 17.6], [31, 18.6], [25, 20], [29.5, 20.2]]) k.add(S('circle', { cx: x, cy: y, r: 1.2, fill: '#ffd84a', stroke: '#8a5a00', 'stroke-width': 0.3 }));
    k.add(P('M18.5,23.5 C21,20.5 33,20.5 35.5,23.5 L34.5,25.5 C31,23.5 23,23.5 19.5,25.5Z', { fill: k.paint('linen', 'v'), ...OL }));
    k.add(P('M18.5,25 C24,28 30,28 36,25', { stroke: '#b3122e', 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(P('M22,27 L20,33 M22.5,27 L23.5,33.5', { stroke: '#b3122e', 'stroke-width': 1, 'stroke-linecap': 'round' }));
    const fl = G({ fill: 'none', stroke: '#8f7446', 'stroke-width': 0.8 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      fl.appendChild(S('circle', { cx: 27 + Math.cos(a) * 3, cy: 41 + Math.sin(a) * 3, r: 2.1 }));
    }
    k.add(fl);
    k.add(hl('M12,46 C10.5,39 12.5,32 17,28', 0.9, 0.45));
    k.add(S('ellipse', { cx: 49, cy: 55, rx: 10, ry: 3.2, fill: k.paint('gold', 'v'), ...OL }));
    k.add(S('rect', { x: 39, y: 51.5, width: 20, height: 3.5, fill: k.paint('gold', 'h') }));
    k.add(S('ellipse', { cx: 49, cy: 51.5, rx: 10, ry: 3.2, fill: k.paint('gold', 'd'), ...OL }));
    k.add(S('circle', { cx: 50, cy: 42, r: 8.8, fill: k.paint('gold', 'r'), ...OL }));
    k.add(S('circle', { cx: 50, cy: 42, r: 6.4, fill: 'none', stroke: '#fff3c4', 'stroke-width': 0.6, opacity: 0.8 }));
    k.add(P(starPath(50, 42, 4, 1.6, 5), { fill: '#8a6a2b', opacity: 0.8 }));
    k.add(glint(56, 36, 2.4));
  },

  xHeir(k) {
    k.add(glow(k, 32, 40, 24, '#ff4f8b', 0.3));
    k.add(chromoX(k, 32, 42, 34, 7, 'magenta'));
    const gold = k.paint('gold', 'd');
    k.add(P('M18.5,22 L16.5,9 L24.5,15.5 L32,5.5 L39.5,15.5 L47.5,9 L45.5,22Z', { fill: gold, ...OL }));
    k.add(S('rect', { x: 18, y: 19.5, width: 28, height: 4.4, rx: 1, fill: k.paint('gold', 'v'), ...OL }));
    k.add(S('circle', { cx: 32, cy: 21.7, r: 1.7, fill: '#d7263d', stroke: '#3d0412', 'stroke-width': 0.4 }));
    k.add(S('circle', { cx: 24.5, cy: 21.7, r: 1.2, fill: '#2fd4c4' }));
    k.add(S('circle', { cx: 39.5, cy: 21.7, r: 1.2, fill: '#2fd4c4' }));
    for (const [x, y] of [[16.5, 9], [32, 5.5], [47.5, 9]]) k.add(S('circle', { cx: x, cy: y, r: 1.5, fill: k.paint('gold', 'r'), ...OL }));
    k.add(hl('M20,17 L24.5,15.5', 0.7, 0.7));
  },

  colchicineNotes(k) {
    k.add(shadow(k, 30, 58.5, 24, 2.4));
    const clip = k.clip('bk', P('M13,20 L13,50 C13,54 15,56 19,56 L31,56 C35,56 37,54 37,50 L37,20Z'));
    k.add(P('M12,19 L12,50 C12,55 14.5,57 19,57 L31,57 C35.5,57 38,55 38,50 L38,19', { fill: k.paint('glass', 'h'), stroke: '#dff6f4', 'stroke-width': 1.1 }));
    k.add(
      G(
        { 'clip-path': clip },
        P('M12,36 C20,33.5 30,38.5 38,35.5 L38,58 L12,58Z', { fill: k.paint('purple', 'v'), opacity: 0.92 }),
        S('circle', { cx: 20, cy: 46, r: 1.4, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.7 }),
        S('circle', { cx: 27, cy: 41, r: 1, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.7 }),
        S('circle', { cx: 31, cy: 50, r: 1.7, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.6 }),
      ),
    );
    k.add(P('M10,19 L40,19', { stroke: '#e8fbff', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    k.add(P('M13,26 L17,26 M13,31 L16,31 M13,41 L17,41 M13,46 L16,46', { stroke: '#e8fbff', 'stroke-width': 0.6, opacity: 0.7 }));
    k.add(hl('M34.5,23 L34.5,49', 1.2, 0.5));
    k.add(chromoX(k, 46, 24, 19, 3.6, 'purple', 0.55));
    k.add(chromoX(k, 51, 29, 19, 3.6, 'magenta'));
    k.add(Txt({ x: 50, y: 53, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#e6c77a', 'font-family': SERIF }, '×2'));
  },

  karyoScope(k) {
    k.add(shadow(k, 30, 59, 22, 2.4));
    k.add(glow(k, 27, 44, 9, '#2fd4c4', 0.6));
    k.add(P('M14,52 L46,52 C48,52 49,53.5 49,55 L49,57.5 L11,57.5 L11,55 C11,53.5 12,52 14,52Z', { fill: k.paint('steel', 'v'), ...OL }));
    k.add(P('M36,52 C44,44 47,32 42.5,19 L37.5,21 C41,32 38.5,42.5 31,50Z', { fill: k.paint('steel', 'h'), ...OL }));
    k.add(hl('M41,22 C43.5,31 42,41 36.5,48', 0.8, 0.55));
    k.add(S('rect', { x: 15, y: 38, width: 27, height: 3.4, rx: 1, fill: k.paint('ink', 'v'), ...OL }));
    k.add(S('rect', { x: 18.5, y: 36.4, width: 16, height: 1.7, fill: '#dff6f4', opacity: 0.85 }));
    k.add(S('circle', { cx: 26.5, cy: 37.2, r: 1, fill: '#ff4f8b' }));
    k.add(
      G(
        { transform: 'rotate(-20 30 22)' },
        S('rect', { x: 25, y: 8, width: 9, height: 22, rx: 1.5, fill: k.paint('brass', 'h'), ...OL }),
        S('rect', { x: 26.3, y: 2.5, width: 6.4, height: 6.4, rx: 1, fill: k.paint('ink', 'h'), ...OL }),
        P('M26.5,30 L32.5,30 L31.5,34.6 L27.5,34.6Z', { fill: k.paint('silver', 'h'), ...OL }),
        hl('M27,10 L27,28', 0.8, 0.6),
        S('rect', { x: 24.5, y: 17, width: 10, height: 2, fill: k.paint('gold', 'v') }),
      ),
    );
    k.add(S('circle', { cx: 42.5, cy: 31, r: 4.2, fill: k.paint('brass', 'r'), ...OL }));
    k.add(S('circle', { cx: 42.5, cy: 31, r: 1.6, fill: '#553a0c' }));
  },

  scissorRack(k) {
    const cx = 25;
    const strand = (sign: number, y0: number, y1: number, dy: number) => {
      let d = '';
      for (let y = y0; y <= y1; y += 1) d += `${y === y0 ? 'M' : 'L'}${num(cx + dy * 0 + sign * 7 * Math.sin(y * 0.24))},${num(y + dy)}`;
      return d;
    };
    const rungs = G({ 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: 0.85 });
    const rc = ['#2fd4c4', '#ff4f8b', '#f2b632', '#f3ead6'];
    let ri = 0;
    for (let y = 6; y <= 58; y += 3.4) {
      if (y > 28.5 && y < 36) continue;
      const dy = y > 32 ? 1.6 : 0;
      const x1 = cx + 7 * Math.sin(y * 0.24);
      const x2 = cx - 7 * Math.sin(y * 0.24);
      rungs.appendChild(P(`M${num(x1)},${num(y + dy)} L${num(x2)},${num(y + dy)}`, { stroke: rc[ri++ % 4] }));
    }
    k.add(rungs);
    for (const [y0, y1, dy] of [[5, 28, 0], [36, 59, 1.6]] as [number, number, number][]) {
      k.add(P(strand(1, y0, y1, dy), { stroke: k.paint('teal', 'h'), 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }));
      k.add(P(strand(-1, y0, y1, dy), { stroke: k.paint('magenta', 'h'), 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }));
    }
    k.add(glow(k, 24, 32.5, 9, '#fff3c8', 0.7));
    k.add(glint(24, 32.5, 4.6, '#fffbe6'));
    const steel = k.paint('silver', 'd');
    k.add(P('M44,32 L21,27.6 C19.8,27.4 19.6,28.6 20.6,29 L44,34Z', { fill: steel, ...OL }));
    k.add(P('M44,33 L21,37.4 C19.8,37.6 19.6,36.4 20.6,36 L44,31Z', { fill: steel, ...OL }));
    k.add(hl('M42,31.8 L22,28.2', 0.6, 0.9));
    k.add(P('M44,31.6 L50.5,26.8 M44,33.4 L50.5,38.2', { stroke: steel, 'stroke-width': 2.8, 'stroke-linecap': 'round' }));
    const ring = k.paint('rubyEnamel', 'd');
    k.add(S('circle', { cx: 54.5, cy: 23.5, r: 5.4, fill: 'none', stroke: '#2a020b', 'stroke-width': 4, 'stroke-opacity': 0.6 }));
    k.add(S('circle', { cx: 54.5, cy: 23.5, r: 5.4, fill: 'none', stroke: ring, 'stroke-width': 2.8 }));
    k.add(S('circle', { cx: 54.5, cy: 41.5, r: 5.4, fill: 'none', stroke: '#2a020b', 'stroke-width': 4, 'stroke-opacity': 0.6 }));
    k.add(S('circle', { cx: 54.5, cy: 41.5, r: 5.4, fill: 'none', stroke: ring, 'stroke-width': 2.8 }));
    k.add(S('circle', { cx: 44, cy: 32.5, r: 1.9, fill: k.paint('gold', 'r'), ...OL }));
  },

  jellyfishGene(k) {
    const glowF = k.filter('jg', () => [
      S('feGaussianBlur', { stdDeviation: 1.8, result: 'b' }),
      S('feMerge', null, S('feMergeNode', { in: 'b' }), S('feMergeNode', { in: 'SourceGraphic' })),
    ]);
    k.add(S('circle', { cx: 32, cy: 28, r: 26, fill: k.rad('halo', [[0, '#35f3ff', 0.4], [1, '#35f3ff', 0]]) }));
    const ten = G({ filter: glowF, fill: 'none', 'stroke-linecap': 'round' });
    const xs = [17, 21.5, 26, 38, 42.5, 47];
    xs.forEach((x, i) => {
      const end = 60 - (i % 2) * 5;
      ten.appendChild(P(`M${x},31 C${x - 3.5},39 ${x + 3.5},46 ${x - 1},${end}`, { stroke: '#7ff6ff', 'stroke-width': 1.1, opacity: 0.85 }));
    });
    ten.appendChild(P('M29,32 C26,40 33,45 29,56 M35,32 C38,40 31,46 35.5,53', { stroke: '#d6fdff', 'stroke-width': 2.2, opacity: 0.75 }));
    k.add(ten);
    k.add(
      G(
        { filter: glowF },
        P('M13,32 C13,17 21.5,8.5 32,8.5 C42.5,8.5 51,17 51,32 C48,30.5 45.5,33.2 41.5,31.5 C38.5,33.5 35.2,31 32,33 C28.8,31 25.5,33.5 22.5,31.5 C18.5,33.2 16,30.5 13,32Z', {
          fill: k.rad('bell', [[0, '#ffffff', 0.95], [0.45, '#8ff8ff', 0.72], [1, '#0fa3bd', 0.5]], 0.45, 0.32, 0.72),
          stroke: '#e6ffff',
          'stroke-width': 0.8,
        }),
      ),
    );
    k.add(G({ fill: '#ffffff', opacity: 0.6, filter: k.blur(0.8) }, S('circle', { cx: 28, cy: 22, r: 3 }), S('circle', { cx: 36, cy: 22, r: 3 }), S('circle', { cx: 32, cy: 18, r: 3 }), S('circle', { cx: 32, cy: 26, r: 3 })));
    k.add(hl('M18,24 C19,17 24,12.5 30,11.5', 1.2, 0.8));
    for (const [x, y, r] of [[8, 14, 0.9], [56, 20, 1.1], [52, 50, 0.8], [10, 48, 0.7], [58, 38, 0.6]] as [number, number, number][])
      k.add(S('circle', { cx: x, cy: y, r, fill: '#c9fdff' }));
  },

  climateHouse(k) {
    k.add(shadow(k, 32, 59, 25, 2.4));
    k.add(S('circle', { cx: 13, cy: 13, r: 10, fill: k.rad('sunh', [[0, '#ffd23f', 0.5], [1, '#ffd23f', 0]]) }));
    const rays = G({ stroke: '#f2b632', 'stroke-width': 1.3, 'stroke-linecap': 'round' });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rays.appendChild(P(`M${num(13 + Math.cos(a) * 6.8)},${num(13 + Math.sin(a) * 6.8)} L${num(13 + Math.cos(a) * 9.4)},${num(13 + Math.sin(a) * 9.4)}`));
    }
    k.add(rays);
    k.add(S('circle', { cx: 13, cy: 13, r: 5.2, fill: k.paint('goldFruit', 'r'), ...OL }));
    const sf = G({ stroke: k.paint('ice', 'd'), 'stroke-width': 1.3, 'stroke-linecap': 'round' });
    for (let i = 0; i < 6; i++) sf.appendChild(G({ transform: `rotate(${i * 60} 51 13)` }, P('M51,13 L51,5.5 M51,8.2 L49.2,6.6 M51,8.2 L52.8,6.6')));
    k.add(sf);
    const domeD = 'M9,50 A23,23 0 0 1 55,50Z';
    const dclip = k.clip('dome', P(domeD));
    k.add(P(domeD, { fill: k.lin('dg', [[0, '#e8fbff', 0.55], [1, '#8fd3cc', 0.3]]) }));
    k.add(
      G(
        { 'clip-path': dclip },
        leafEl(k, 22, 50, -115, 11, 4),
        leafEl(k, 24, 50, -60, 13, 4.4),
        leafEl(k, 40, 50, -120, 12, 4.2),
        leafEl(k, 42, 50, -65, 10, 3.8),
        S('circle', { cx: 32, cy: 45, r: 3, fill: '#d7263d', ...OL }),
      ),
    );
    const brass = k.paint('brass', 'd');
    k.add(
      G(
        { stroke: brass, fill: 'none', 'stroke-width': 1 },
        P('M32,27 L32,50 M32,27 C21,29 15.5,39 15.5,50 M32,27 C43,29 48.5,39 48.5,50 M12.5,41.5 C24,38.5 40,38.5 51.5,41.5 M18.5,33.5 C26,31.5 38,31.5 45.5,33.5'),
      ),
    );
    k.add(P(domeD, { fill: 'none', stroke: brass, 'stroke-width': 1.5 }));
    k.add(hl('M14,44 C14.5,36 19,30 25,28', 1.2, 0.7));
    k.add(S('rect', { x: 7, y: 49.5, width: 50, height: 5.5, rx: 1.2, fill: k.paint('brass', 'v'), ...OL }));
    k.add(P('M32,27 L32,22.5', { stroke: brass, 'stroke-width': 1.2 }));
    k.add(S('circle', { cx: 32, cy: 22, r: 1.7, fill: k.paint('gold', 'r') }));
  },

  grandpaNotes(k) {
    k.add(shadow(k, 34, 59, 24, 2.4));
    const nb = G({ transform: 'rotate(-12 20 34)' });
    nb.appendChild(S('rect', { x: 9, y: 13, width: 25, height: 36, rx: 1.5, fill: '#e8dcc0', ...OL }));
    nb.appendChild(S('rect', { x: 7, y: 12, width: 25, height: 36, rx: 2, fill: k.paint('leather', 'd'), ...OL }));
    nb.appendChild(S('rect', { x: 11.5, y: 18, width: 16, height: 8, rx: 1, fill: '#f3ead6', opacity: 0.9 }));
    nb.appendChild(P('M13.5,21 L25.5,21 M13.5,23.5 L22,23.5', { stroke: '#7a6a4a', 'stroke-width': 0.6 }));
    k.add(nb);
    for (const d of ['M26,20 C22,15 28,11 24,6', 'M31,17 C28,13 33,10 30,5.5']) k.add(P(d, { stroke: '#f3ead6', 'stroke-width': 0.8, fill: 'none', opacity: 0.55, 'stroke-linecap': 'round' }));
    const body = 'M30,35 C30,28 36,25 43,25 C50,25 56,28 56,35 L56,48 C56,54 51,57.5 43,57.5 C35,57.5 30,54 30,48Z';
    const bclip = k.clip('bt', P(body));
    k.add(P(body, { fill: k.paint('glass', 'd'), ...OL }));
    k.add(G({ 'clip-path': bclip }, P('M29,40 C37,37.5 48,42.5 57,38.5 L57,58 L29,58Z', { fill: k.lin('amb', [[0, '#ffd27a'], [0.5, '#d68a1a'], [1, '#6b3d05']]), opacity: 0.88 })));
    k.add(P('M36.5,27.5 L36.5,55.5 M49.5,27.5 L49.5,55.5 M30.5,36 L55.5,36', { stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.35 }));
    k.add(P(body, { fill: 'none', stroke: '#fffbe6', 'stroke-width': 0.8, opacity: 0.6 }));
    k.add(hl('M33,46 C32.5,38 34,31 39,28', 1.3, 0.75));
    k.add(S('rect', { x: 39.5, y: 18.5, width: 7, height: 7, rx: 1, fill: k.paint('gold', 'h'), ...OL }));
    k.add(P('M46.5,21 C52,20 55.5,16 55.5,12', { stroke: k.paint('gold', 'd'), 'stroke-width': 1.2, fill: 'none' }));
    k.add(S('ellipse', { cx: 56, cy: 9, rx: 3.6, ry: 4.6, fill: k.paint('rubyEnamel', 'r'), ...OL }));
    k.add(P('M56,13.5 L55,17 M57,13.5 L58,17', { stroke: '#e6c77a', 'stroke-width': 0.6 }));
  },

  tissueLab(k) {
    k.add(shadow(k, 32, 57, 25, 2.6));
    k.add(glow(k, 32, 30, 16, '#2fd4c4', 0.4));
    k.add(P('M8,43 L8,47 A24,8.5 0 0 0 56,47 L56,43', { fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 0.7 }));
    k.add(S('ellipse', { cx: 32, cy: 44, rx: 22.4, ry: 7.4, fill: k.rad('agar', [[0, '#fff6c8'], [0.7, '#d9e59a'], [1, '#aab96a']]), opacity: 0.95 }));
    for (const [x, y] of [[20, 45], [43, 42], [38, 47.5], [25, 41.8], [47, 46]]) k.add(S('circle', { cx: x, cy: y, r: 0.9, fill: '#ffffff', opacity: 0.55 }));
    k.add(S('ellipse', { cx: 32, cy: 44, rx: 5.2, ry: 2.4, fill: k.rad('cal', [[0, '#fbffe0'], [1, '#b5c96a']]), ...OL, 'stroke-width': 0.6 }));
    k.add(P('M32,44 C32,38 31,33 32,27.5', { stroke: k.paint('leaf', 'v'), 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(leafEl(k, 32, 29, -150, 12, 4.4));
    k.add(leafEl(k, 32, 28, -28, 13, 4.6));
    k.add(S('ellipse', { cx: 32, cy: 43, rx: 24, ry: 8.5, fill: 'none', stroke: '#ffffff', 'stroke-width': 1, opacity: 0.75 }));
    k.add(hl('M11,43.5 C14,38.5 22,36 29,35.4', 0.9, 0.6));
    k.add(glint(47, 22, 2.8, '#c9fff8'));
  },

  _default(k) {
    k.add(glow(k, 32, 36, 22, '#e6c77a', 0.35));
    k.add(P('M32,56 C21.5,51 19.5,35.5 32,25 C44.5,35.5 42.5,51 32,56Z', { fill: k.paint('goldFruit', 'r'), ...OL }));
    k.add(P('M32,28 C29.5,35 29.5,45 32,53', { stroke: '#7a5204', 'stroke-width': 0.7, fill: 'none', opacity: 0.75 }));
    k.add(leafEl(k, 32, 26, -150, 14, 5));
    k.add(leafEl(k, 32, 25, -30, 15, 5.4));
    k.add(glint(24, 36, 3));
  },
};

// ─────────────────────────────────────────── 시약 아이콘
const REAGENT: Record<string, Draw> = {
  genetest(k) {
    k.add(shadow(k, 32, 59, 22, 2.4));
    const tube = 'M20,8 L31,8 L31,49 C31,53 28.5,56 25.5,56 C22.5,56 20,53 20,49Z';
    const g = G({ transform: 'rotate(-18 25 32)' });
    const clip = k.clip('tb', P(tube));
    g.appendChild(P(tube, { fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 0.9 }));
    g.appendChild(G({ 'clip-path': clip }, S('rect', { x: 18, y: 30, width: 16, height: 28, fill: k.paint('teal', 'v'), opacity: 0.85 })));
    let helix = '';
    for (let y = 33; y <= 52; y += 1) helix += `${y === 33 ? 'M' : 'L'}${num(25.5 + Math.sin(y * 0.6) * 2.6)},${y}`;
    g.appendChild(P(helix, { stroke: '#ffffff', 'stroke-width': 0.7, fill: 'none', opacity: 0.8 }));
    g.appendChild(S('rect', { x: 18.5, y: 4, width: 14, height: 6, rx: 1.4, fill: k.paint('rubyEnamel', 'v'), ...OL }));
    g.appendChild(hl('M22.2,12 L22.2,48', 1, 0.6));
    k.add(g);
    k.add(S('rect', { x: 39, y: 9, width: 16, height: 47, rx: 2, fill: k.paint('ink', 'v'), ...OL }));
    const bands: [number, number, string][] = [[14, 0.9, '#2fd4c4'], [19, 0.6, '#2fd4c4'], [25, 1, '#ff4f8b'], [31, 0.7, '#2fd4c4'], [38, 0.9, '#f2b632'], [46, 0.5, '#2fd4c4']];
    for (const [y, w, c] of bands) {
      k.add(S('rect', { x: 41.5, y: y - 1.6, width: 11 * w, height: 3.2, rx: 1, fill: c, opacity: 0.35, filter: k.blur(0.8) }));
      k.add(S('rect', { x: 41.5, y: y - 0.8, width: 11 * w, height: 1.6, rx: 0.8, fill: c }));
    }
    k.add(hl('M40.5,11 L40.5,54', 0.6, 0.35));
  },

  colchicine(k) {
    k.add(shadow(k, 32, 59, 24, 2.4));
    const body = 'M11,28 C11,25 13,23 16,23 L28,23 C31,23 33,25 33,28 L33,53 C33,55.5 31,57 28.5,57 L15.5,57 C13,57 11,55.5 11,53Z';
    const clip = k.clip('vb', P(body));
    k.add(P(body, { fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 0.9 }));
    k.add(G({ 'clip-path': clip }, S('rect', { x: 10, y: 31, width: 24, height: 27, fill: k.paint('purple', 'v'), opacity: 0.92 })));
    k.add(S('rect', { x: 13.5, y: 37, width: 17, height: 11, rx: 1, fill: '#f3ead6', opacity: 0.95, ...OL, 'stroke-width': 0.5 }));
    k.add(Txt({ x: 22, y: 45, 'text-anchor': 'middle', 'font-size': 6.4, 'font-weight': 700, fill: '#5a2a8a', 'font-family': SERIF }, '4n'));
    k.add(S('rect', { x: 17, y: 17, width: 10, height: 6.5, rx: 1, fill: k.paint('gold', 'h'), ...OL }));
    k.add(P('M18,17 C18,10 26,10 26,17Z', { fill: k.paint('ink', 'd'), ...OL }));
    k.add(hl('M14,29 L14,52', 1.1, 0.55));
    k.add(P('M47,58 C47,50 46,44 47,38', { stroke: k.paint('leaf', 'v'), 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }));
    k.add(leafEl(k, 47, 55, -125, 12, 2.4));
    const pet = k.lin('crocus', [[0, '#f1dcff'], [0.5, '#a66ae0'], [1, '#4a1a80']], 0, 0, 0, 1);
    for (const [ang, s] of [[-28, 1], [28, 1], [0, 1.08]] as [number, number][])
      k.add(G({ transform: `translate(47 39) rotate(${ang}) scale(${s})` }, P('M0,0 C-6,-4 -6.5,-14 0,-20 C6.5,-14 6,-4 0,0Z', { fill: pet, ...OL })));
    k.add(P('M47,36 L45,26 M47,36 L47.5,25 M47,36 L49.5,26.5', { stroke: '#ff8a1a', 'stroke-width': 1, 'stroke-linecap': 'round' }));
  },

  scissors(k) {
    k.add(glow(k, 32, 40, 18, '#2fd4c4', 0.45));
    const y = 44;
    let s1 = '';
    let s2 = '';
    for (let x = 4; x <= 60; x++) {
      if (x > 29 && x < 35) continue;
      const dx = x >= 35 ? 1.5 : 0;
      const seg = x === 4 || x === 35 ? 'M' : 'L';
      s1 += `${seg}${x + dx},${num(y + 4 * Math.sin(x * 0.3))}`;
      s2 += `${seg}${x + dx},${num(y - 4 * Math.sin(x * 0.3))}`;
    }
    const rungs = G({ 'stroke-width': 1.3, opacity: 0.8 });
    for (let x = 6; x <= 58; x += 3.5) {
      if (x > 27 && x < 36) continue;
      const dx = x >= 35 ? 1.5 : 0;
      rungs.appendChild(P(`M${num(x + dx)},${num(y + 4 * Math.sin(x * 0.3))} L${num(x + dx)},${num(y - 4 * Math.sin(x * 0.3))}`, { stroke: x % 7 < 3.5 ? '#ff4f8b' : '#f2b632' }));
    }
    k.add(rungs);
    k.add(P(s1, { stroke: k.paint('teal', 'v'), 'stroke-width': 2, fill: 'none' }));
    k.add(P(s2, { stroke: k.paint('magenta', 'v'), 'stroke-width': 2, fill: 'none' }));
    const steel = k.paint('silver', 'd');
    k.add(P('M32,28 L25,47 C24.6,48.2 25.8,48.6 26.3,47.5 L34,29Z', { fill: steel, ...OL }));
    k.add(P('M32,28 L39,47 C39.4,48.2 38.2,48.6 37.7,47.5 L30,29Z', { fill: steel, ...OL }));
    k.add(P('M32,28 L26,16 M32,28 L38,16', { stroke: steel, 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
    const ring = k.paint('teal', 'd');
    for (const x of [23.5, 40.5]) {
      k.add(S('circle', { cx: x, cy: 11.5, r: 5, fill: 'none', stroke: '#06201d', 'stroke-width': 3.8, 'stroke-opacity': 0.6 }));
      k.add(S('circle', { cx: x, cy: 11.5, r: 5, fill: 'none', stroke: ring, 'stroke-width': 2.6 }));
    }
    k.add(S('circle', { cx: 32, cy: 28.5, r: 1.8, fill: k.paint('gold', 'r'), ...OL }));
    k.add(glint(32, 44, 4.2, '#fffbe6'));
  },

  vector(k) {
    k.add(glow(k, 32, 32, 26, '#35f3ff', 0.3));
    k.add(S('circle', { cx: 32, cy: 32, r: 19, fill: 'none', stroke: '#0a2a28', 'stroke-width': 7.5, opacity: 0.6 }));
    k.add(S('circle', { cx: 32, cy: 32, r: 19, fill: 'none', stroke: k.paint('teal', 'd'), 'stroke-width': 5.5 }));
    const circ = 2 * Math.PI * 19;
    const seg = (start: number, len: number, color: string, w = 5.5) =>
      S('circle', { cx: 32, cy: 32, r: 19, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-dasharray': `${num(len * circ)} ${num(circ)}`, 'stroke-dashoffset': num(-start * circ), transform: 'rotate(-90 32 32)' });
    k.add(seg(0.3, 0.18, '#ff4f8b'));
    k.add(seg(0.55, 0.12, '#f2b632'));
    k.add(G({ filter: k.blur(1.6) }, seg(0.02, 0.2, '#8ffcff', 8)));
    k.add(seg(0.02, 0.2, '#e8ffff'));
    k.add(S('circle', { cx: 32, cy: 32, r: 21.6, fill: 'none', stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.5 }));
    k.add(S('circle', { cx: 32, cy: 32, r: 16.4, fill: 'none', stroke: '#000000', 'stroke-width': 0.5, opacity: 0.4 }));
    k.add(P('M50.5,40 L55,35.5 L55.8,42.4Z', { fill: '#e8ffff' }));
    k.add(Txt({ x: 32, y: 36, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#c9fdff', 'font-family': SERIF }, 'T+'));
    k.add(glint(44, 12, 3, '#e8ffff'));
  },

  tissue(k) {
    k.add(shadow(k, 32, 58, 25, 2.4));
    k.add(S('circle', { cx: 32, cy: 34, r: 23, fill: k.paint('glass', 'd'), stroke: '#e8fbff', 'stroke-width': 1.1 }));
    k.add(S('circle', { cx: 32, cy: 34, r: 20.5, fill: k.rad('ag', [[0, '#fbf6c8'], [0.8, '#d6e39a'], [1, '#a9b96a']]), opacity: 0.95 }));
    for (const [x, y, s] of [[24, 31, 1], [39, 29, 0.85], [32, 42, 1.1]] as [number, number, number][]) {
      k.add(S('ellipse', { cx: x, cy: y + 2, rx: 3.8 * s, ry: 2.4 * s, fill: '#f4ffd0', ...OL, 'stroke-width': 0.5 }));
      k.add(P(`M${x},${y + 1} L${x},${y - 4 * s}`, { stroke: '#3a8a3a', 'stroke-width': 1.1, 'stroke-linecap': 'round' }));
      k.add(leafEl(k, x, y - 3.5 * s, -150, 6 * s, 2.4 * s));
      k.add(leafEl(k, x, y - 4 * s, -30, 6.5 * s, 2.6 * s));
    }
    k.add(hl('M14,26 A20,20 0 0 1 26,14.5', 1.3, 0.75));
  },

  fertilizer(k) {
    k.add(shadow(k, 30, 59, 24, 2.4));
    k.add(P('M13,57 L11,24 C11,21 13,19 16,19 L42,19 C45,19 47,21 47,24 L45,57Z', { fill: k.paint('kraft', 'd'), ...OL }));
    k.add(P('M11.5,24 C18,27 40,27 46.5,24 L46,29 C39,31.5 19,31.5 12,29Z', { fill: '#8f6a36', opacity: 0.7 }));
    k.add(P('M14,19 L17,12 L41,12 L44,19Z', { fill: k.paint('kraft', 'v'), ...OL }));
    k.add(P('M17,12 L20,17 L23,12 L26,17 L29,12 L32,17 L35,12 L38,17 L41,12', { stroke: '#6b4a1c', 'stroke-width': 0.6, fill: 'none' }));
    k.add(S('circle', { cx: 29, cy: 42, r: 8.5, fill: '#f3ead6', opacity: 0.9, ...OL, 'stroke-width': 0.5 }));
    k.add(leafEl(k, 26, 46, -60, 10, 3.8));
    k.add(leafEl(k, 29, 46, -115, 8, 3.2));
    k.add(hl('M14,30 L15.5,53', 0.9, 0.4));
    for (const [x, y] of [[48, 56], [52, 54.5], [55.5, 57], [51, 58.2], [57.5, 53.5], [46, 58.4]]) {
      k.add(S('circle', { cx: x, cy: y, r: 1.7, fill: k.paint('ice', 'r'), ...OL, 'stroke-width': 0.4 }));
    }
    k.add(P('M53,53 C53,49 52,46.5 53.5,44', { stroke: '#3a8a3a', 'stroke-width': 1, fill: 'none' }));
    k.add(leafEl(k, 53.5, 45, -40, 6, 2.4));
  },

  brush(k) {
    k.add(shadow(k, 30, 59, 22, 2.4));
    const pts: [number, number, number][] = [[46, 12, 1.1], [52, 18, 0.8], [55, 10, 0.7], [42, 7, 0.6], [50, 5, 0.9], [58, 22, 0.6]];
    for (const [x, y, r] of pts) {
      k.add(S('circle', { cx: x, cy: y, r: r * 2.4, fill: '#ffe066', opacity: 0.25 }));
      k.add(S('circle', { cx: x, cy: y, r, fill: '#fff2a0' }));
    }
    k.add(
      G(
        { transform: 'translate(12 54) rotate(-48)' },
        P('M0,-1.8 L26,-2.6 L26,2.6 L0,1.8 Q-2,0 0,-1.8Z', { fill: k.paint('wood', 'v'), ...OL }),
        hl('M2,-1 L25,-1.6', 0.6, 0.45),
        S('rect', { x: 26, y: -3.4, width: 6, height: 6.8, rx: 0.8, fill: k.paint('gold', 'v'), ...OL }),
        P('M32,-3.8 C38,-6.5 46,-5 47.5,0 C46,5 38,6.5 32,3.8Z', { fill: k.lin('fluff', [[0, '#f7ecd0'], [0.6, '#e0c890'], [1, '#a8905a']]), ...OL }),
        P('M40,-4.4 C44.5,-4 47.3,-2 47.5,0 C47.3,2 44.5,4 40,4.4 C42,1.6 42,-1.6 40,-4.4Z', { fill: '#ffd84a' }),
        G({ fill: '#fff2a0' }, S('circle', { cx: 43, cy: -1.5, r: 0.6 }), S('circle', { cx: 45, cy: 1, r: 0.5 }), S('circle', { cx: 42, cy: 2, r: 0.5 })),
      ),
    );
    const pg = k.rad('bp', [[0, '#8a1240'], [0.35, '#ff4f8b'], [1, '#ffd0e0']], 0, 0, 15, undefined, undefined, { gradientUnits: 'userSpaceOnUse' });
    k.add(petalsFlower(k, 50, 46, 9, -90, pg));
  },

  medal(k) {
    k.add(P('M22,4 L32,4 L38,26 L30,28Z', { fill: k.paint('blue', 'v'), ...OL }));
    k.add(P('M42,4 L32,4 L26,26 L34,28Z', { fill: k.paint('ruby', 'v'), ...OL }));
    k.add(S('circle', { cx: 32, cy: 41, r: 16, fill: k.paint('gold', 'r'), ...OL }));
    k.add(S('circle', { cx: 32, cy: 41, r: 12.5, fill: 'none', stroke: '#fff3c4', 'stroke-width': 0.7, opacity: 0.8 }));
    k.add(P(starPath(32, 41, 8, 3.4, 5), { fill: '#b8923f', stroke: '#6e4f18', 'stroke-width': 0.5 }));
    k.add(hl('M20,36 A13,13 0 0 1 28,28.5', 1.2, 0.7));
  },

  _default(k) {
    k.add(shadow(k, 32, 59, 16, 2.4));
    const body = 'M22,24 L42,24 L46,54 C46,56.5 44,58 41.5,58 L22.5,58 C20,58 18,56.5 18,54Z';
    const clip = k.clip('vd', P(body));
    k.add(P(body, { fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 0.9 }));
    k.add(G({ 'clip-path': clip }, S('rect', { x: 16, y: 38, width: 32, height: 22, fill: k.paint('teal', 'v'), opacity: 0.85 })));
    k.add(S('rect', { x: 25, y: 12, width: 14, height: 12.5, rx: 1.5, fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 0.9 }));
    k.add(S('rect', { x: 24, y: 8, width: 16, height: 5, rx: 1.5, fill: k.paint('wood', 'v'), ...OL }));
    k.add(hl('M22,28 L21,52', 1.1, 0.55));
  },
};

export const JOKER_ICON_IDS = Object.keys(JOKER).filter((k) => k !== '_default');
export const REAGENT_ICON_IDS = Object.keys(REAGENT).filter((k) => k !== '_default');

export function jokerIcon(id: string, size = 64): SVGSVGElement {
  const k = new Kit('jk', 64, 64, size, size, 'sa-icon sa-icon--joker');
  const draw = JOKER[id] ?? JOKER._default;
  draw(k);
  k.svg.dataset.icon = JOKER[id] ? id : '_default';
  return k.svg;
}

export function reagentIcon(id: string, size = 64): SVGSVGElement {
  const k = new Kit('rg', 64, 64, size, size, 'sa-icon sa-icon--reagent');
  const draw = REAGENT[id] ?? REAGENT._default;
  draw(k);
  k.svg.dataset.icon = REAGENT[id] ? id : '_default';
  return k.svg;
}
