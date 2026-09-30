// 씨앗 봉투·상자 그림
import type { PackKind } from '../contract/game';
import { Kit, S, G, P, H, Txt, starPath, leafPath, smoothClosed, num } from './dom';
import { shell, priceTag } from './shell';
import { mulberry32, jitter, between } from './rng';

const PACK_KO: Record<PackKind, string> = {
  seed: '씨앗 봉투',
  rareSeed: '희귀 씨앗 봉투',
  reagent: '시약 상자',
  medal: '메달 상자',
  joker: '비법 두루마리',
};

const SERIF = "'Gowun Batang', serif";
const OL = { stroke: '#140c04', 'stroke-opacity': 0.6, 'stroke-width': 1.2, 'stroke-linejoin': 'round' } as const;

function fiber(k: Kit, tint: string, op: number): string {
  return k.filter('fib', () => [
    S('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9 0.06', numOctaves: 2, seed: 7, result: 'n' }),
    S('feColorMatrix', { type: 'matrix', values: `0 0 0 0 ${tint} 0 0 0 0 ${tint} 0 0 0 0 ${tint} 0 0 0 ${op} 0`, in: 'n' }),
    S('feComposite', { operator: 'in', in2: 'SourceGraphic' }),
  ], { x: 0, y: 0, width: '100%', height: '100%' });
}

function waxSeal(k: Kit, x: number, y: number, r: number, cols: [string, string, string], seed: number): SVGGElement {
  const rng = mulberry32(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const rr = r * (1 + jitter(rng, 0.07));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  const d = smoothClosed(pts);
  const g = G(null);
  g.appendChild(P(d, { fill: '#000000', opacity: 0.4, transform: 'translate(1.5 2.5)', filter: k.blur(1.5) }));
  g.appendChild(P(d, { fill: k.rad(`wax${seed}`, [[0, cols[0]], [0.5, cols[1]], [1, cols[2]]], 0.38, 0.32, 0.8), stroke: cols[2], 'stroke-width': 0.8 }));
  g.appendChild(S('circle', { cx: x, cy: y, r: r * 0.7, fill: 'none', stroke: cols[2], 'stroke-width': 1.6, opacity: 0.8 }));
  g.appendChild(S('circle', { cx: x + 0.6, cy: y + 0.8, r: r * 0.75, fill: 'none', stroke: cols[0], 'stroke-width': 0.8, opacity: 0.5 }));
  const s = r / 16;
  const emb = G({ transform: `translate(${x} ${y}) scale(${num(s)})` });
  emb.appendChild(P('M0,8 C-5,6 -5.5,-1 0,-5 C5.5,-1 5,6 0,8Z', { fill: cols[0], opacity: 0.5, transform: 'translate(-0.6 -0.6)' }));
  emb.appendChild(P('M0,8 C-5,6 -5.5,-1 0,-5 C5.5,-1 5,6 0,8Z', { fill: cols[1], stroke: cols[2], 'stroke-width': 0.6 }));
  emb.appendChild(P('M0,-5 C-1,-9 -5,-10 -8,-9 C-6,-6 -3,-5 0,-5Z M0,-5 C1,-9 5,-10 8,-9 C6,-6 3,-5 0,-5Z', { fill: cols[1], stroke: cols[2], 'stroke-width': 0.6 }));
  g.appendChild(emb);
  g.appendChild(P(`M${x - r * 0.7},${y - r * 0.2} A${r * 0.75},${r * 0.75} 0 0 1 ${x - r * 0.1},${y - r * 0.72}`, { stroke: '#ffffff', 'stroke-width': 1.4, fill: 'none', opacity: 0.4, 'stroke-linecap': 'round' }));
  return g;
}

function envelope(k: Kit, rare: boolean): void {
  const bodyD = 'M24,40 L176,40 C179,40 181,42 181,45 L181,272 C181,275 179,277 176,277 L24,277 C21,277 19,275 19,272 L19,45 C19,42 21,40 24,40Z';
  const clip = k.clip('env', P(bodyD));
  k.add(P(bodyD, { fill: '#000000', opacity: 0.45, transform: 'translate(3 6)', filter: k.blur(4) }));
  if (rare) {
    k.add(P(bodyD, { fill: k.lin('blk', [[0, '#2c3236'], [0.5, '#15181a'], [1, '#07090a']], 0, 0, 1, 1) }));
  } else {
    k.add(P(bodyD, { fill: k.lin('kr', [[0, '#e2bf86'], [0.5, '#c29455'], [1, '#8f6734']], 0, 0, 1, 1) }));
    k.add(G({ 'clip-path': clip }, S('rect', { x: 0, y: 0, width: 200, height: 300, fill: '#ffffff', filter: fiber(k, '0.25', 0.22) })));
  }
  // 옆 접힘선
  k.add(P('M19,272 L88,190 M181,272 L112,190', { stroke: rare ? '#000000' : '#6b4a1c', 'stroke-width': 1, opacity: 0.35 }));
  if (rare) {
    // 홀로그램 광택 (CSS 로 움직임)
    const holo = k.lin('holo', [
      [0, '#ff4f8b', 0], [0.18, '#ff4f8b', 0.55], [0.32, '#ffe27a', 0.55], [0.46, '#7affd8', 0.6], [0.6, '#7ab8ff', 0.55], [0.74, '#c07aff', 0.55], [0.9, '#ff4f8b', 0.4], [1, '#ff4f8b', 0],
    ], 0, 0, 1, 0.35);
    k.add(G({ 'clip-path': clip }, S('rect', { x: -200, y: 0, width: 600, height: 300, fill: holo, class: 'sa-holo-sweep', style: 'mix-blend-mode:color-dodge' })));
    const st = G({ fill: '#e6c77a' });
    const rng = mulberry32(99);
    for (let i = 0; i < 26; i++) {
      const x = between(rng, 28, 172);
      const y = between(rng, 130, 268);
      const s = between(rng, 1, 2.6);
      st.appendChild(P(starPath(x, y, s, s * 0.28, 4), { opacity: num(between(rng, 0.4, 0.9)) }));
    }
    k.add(G({ 'clip-path': clip }, st));
    k.add(P(bodyD, { fill: 'none', stroke: k.lin('ef', [[0, '#8a6a2b'], [0.4, '#fff1c1'], [0.7, '#b8923f'], [1, '#8a6a2b']], 0, 0, 1, 1), 'stroke-width': 2.4 }));
  } else {
    k.add(P(bodyD, { fill: 'none', ...OL }));
  }
  // 라벨
  const lbFill = rare ? '#0e1012' : '#f3ead6';
  const ink = rare ? '#e6c77a' : '#3d2a0e';
  k.add(S('rect', { x: 46, y: 150, width: 108, height: 98, rx: 5, fill: lbFill, stroke: rare ? '#e6c77a' : '#8a6a2b', 'stroke-width': 1.3 }));
  k.add(S('rect', { x: 50, y: 154, width: 100, height: 90, rx: 3, fill: 'none', stroke: rare ? '#e6c77a' : '#8a6a2b', 'stroke-width': 0.5, opacity: 0.7 }));
  const fr = G({ transform: 'translate(100 190)' });
  fr.appendChild(S('circle', { r: 14, fill: k.rad('lf', rare ? [[0, '#fff3c4'], [0.45, '#f2b632'], [1, '#6e4a03']] : [[0, '#ffa3b0'], [0.45, '#d7263d'], [1, '#4f0616']], 0.38, 0.32, 0.8), stroke: '#1b0a04', 'stroke-width': 0.8 }));
  fr.appendChild(S('ellipse', { cx: -5, cy: -5.5, rx: 4, ry: 2.2, transform: 'rotate(-38 -5 -5.5)', fill: '#ffffff', opacity: 0.8 }));
  fr.appendChild(G({ transform: 'translate(0 -13) rotate(-150)' }, P(leafPath(12, 4.4, 0.04), { fill: k.paint('leaf', 'd'), stroke: '#0c3a22', 'stroke-width': 0.6 })));
  fr.appendChild(G({ transform: 'translate(1 -13.5) rotate(-35)' }, P(leafPath(10, 3.8, -0.04), { fill: k.paint('leaf', 'd'), stroke: '#0c3a22', 'stroke-width': 0.6 })));
  if (rare) for (const [x, y] of [[-6, 2], [4, -2], [5, 7], [-2, 9]]) fr.appendChild(P(starPath(x, y, 2.2, 0.6, 4), { fill: '#fffdf4', stroke: '#4a2c00', 'stroke-width': 0.3 }));
  k.add(fr);
  k.add(Txt({ x: 100, y: 226, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: ink, 'font-family': SERIF }, rare ? '희귀 씨앗' : '씨앗'));
  k.add(Txt({ x: 100, y: 238, 'text-anchor': 'middle', 'font-size': 5, 'letter-spacing': 1.6, fill: ink, opacity: 0.75, 'font-family': 'Pretendard Variable, sans-serif' }, rare ? 'RARE SEEDS · MMCL' : 'MARKET SEEDS · 3 PKT'));
  // 뚜껑
  const flap = 'M19,46 L100,124 L181,46 L181,45 C181,42 179,40 176,40 L24,40 C21,40 19,42 19,45Z';
  k.add(P(flap, { fill: '#000000', opacity: 0.3, transform: 'translate(0 3)', filter: k.blur(2) }));
  k.add(P(flap, { fill: rare ? k.lin('flb', [[0, '#3a4146'], [1, '#101315']], 0, 0, 0, 1) : k.lin('flk', [[0, '#ecd09c'], [1, '#b8884a']], 0, 0, 0, 1), stroke: rare ? '#e6c77a' : '#140c04', 'stroke-width': rare ? 1.4 : 1, 'stroke-opacity': rare ? 1 : 0.55, 'stroke-linejoin': 'round' }));
  if (!rare) {
    const fclip = k.clip('flap', P(flap));
    k.add(G({ 'clip-path': fclip }, S('rect', { x: 0, y: 0, width: 200, height: 130, fill: '#ffffff', filter: fiber(k, '0.25', 0.2) })));
  }
  // 끈
  k.add(P('M100,124 C80,140 60,150 40,150 C30,150 25,160 30,172', { stroke: rare ? '#e6c77a' : '#e8dcc0', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }));
  k.add(P('M100,124 C118,142 130,160 126,176', { stroke: rare ? '#e6c77a' : '#e8dcc0', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' }));
  k.add(waxSeal(k, 100, 122, 17, rare ? ['#ffffff', '#b9c4cc', '#4a565e'] : ['#ff8a9a', '#b3122e', '#40040f'], rare ? 5 : 3));
  if (rare) {
    k.add(G({ transform: 'translate(0 0)' }, S('circle', { cx: 100, cy: 122, r: 17, fill: k.lin('sealiri', [[0, '#ff7ab8', 0.5], [0.5, '#7affd8', 0.45], [1, '#7ab8ff', 0.5]], 0, 0, 1, 1), class: 'sa-gem__iri', style: 'mix-blend-mode:overlay' })));
  }
}

function crate(k: Kit): void {
  k.add(S('ellipse', { cx: 100, cy: 276, rx: 84, ry: 9, fill: '#000000', opacity: 0.45, filter: k.blur(4) }));
  // 약병들
  const vials: [number, number, string, string][] = [
    [52, 70, '#8a4fd0', '#e6c7ff'],
    [80, 50, '#2fd4c4', '#d2fffa'],
    [108, 64, '#4fb86a', '#d6f8a8'],
    [134, 44, '#f2b632', '#fff3c4'],
    [156, 80, '#ff4f8b', '#ffc9da'],
  ];
  vials.forEach(([x, top, c, hi], i) => {
    const w = i === 1 || i === 3 ? 20 : 17;
    const body = `M${x - w / 2},${top + 14} L${x + w / 2},${top + 14} L${x + w / 2},150 L${x - w / 2},150Z`;
    const clip = k.clip(`v${i}`, P(body));
    k.add(P(body, { fill: k.paint('glass', 'h'), stroke: '#e8fbff', 'stroke-width': 1 }));
    k.add(G({ 'clip-path': clip }, S('rect', { x: x - w, y: top + 30, width: w * 2, height: 130, fill: k.lin(`lq${i}`, [[0, hi], [0.3, c], [1, c]], 0, 0, 0, 1), opacity: 0.88 })));
    k.add(S('rect', { x: x - w / 2 - 1.5, y: top, width: w + 3, height: 15, rx: 2.4, fill: k.paint('wood', 'v'), stroke: '#2a1405', 'stroke-width': 0.8 }));
    k.add(P(`M${x - w / 2 + 3},${top + 20} L${x - w / 2 + 3},145`, { stroke: '#ffffff', 'stroke-width': 1.6, opacity: 0.6, 'stroke-linecap': 'round' }));
  });
  // 짚
  const straw = G({ stroke: '#e8cf7a', 'stroke-width': 1.2, 'stroke-linecap': 'round', opacity: 0.9 });
  const r = mulberry32(12);
  for (let i = 0; i < 40; i++) {
    const x = between(r, 26, 174);
    const y = between(r, 128, 142);
    const a = jitter(r, 0.9);
    straw.appendChild(P(`M${num(x)},${num(y)} l${num(Math.cos(a) * 14)},${num(Math.sin(a) * 6 - 3)}`));
  }
  k.add(straw);
  // 상자
  k.add(P('M22,138 L178,138 L178,270 L22,270Z', { fill: k.paint('wood', 'd'), ...OL }));
  for (let i = 0; i < 4; i++) {
    const y = 140 + i * 32.5;
    k.add(S('rect', { x: 22, y, width: 156, height: 30, fill: k.lin(`pl${i}`, [[0, '#d9a066'], [0.5, i % 2 ? '#9a5f2c' : '#b0733a'], [1, '#6b3d18']], 0, 0, 0, 1), stroke: '#2a1405', 'stroke-width': 0.8 }));
    const gr = G({ stroke: '#5a3417', 'stroke-width': 0.6, fill: 'none', opacity: 0.5 });
    for (let j = 0; j < 3; j++) {
      const yy = y + 7 + j * 8 + jitter(r, 1.5);
      gr.appendChild(P(`M24,${num(yy)} C70,${num(yy + jitter(r, 3))} 120,${num(yy + jitter(r, 3))} 176,${num(yy)}`));
    }
    k.add(gr);
  }
  for (const x of [22, 164]) k.add(S('rect', { x, y: 138, width: 14, height: 132, fill: k.lin('post', [[0, '#8a5528'], [1, '#4f2c12']], 0, 0, 1, 0), stroke: '#2a1405', 'stroke-width': 0.8 }));
  for (const x of [29, 171]) for (const y of [146, 178, 211, 243, 262]) k.add(S('circle', { cx: x, cy: y, r: 1.6, fill: k.paint('steel', 'r') }));
  k.add(Txt({ x: 100, y: 214, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 700, fill: '#2a1405', opacity: 0.7, 'font-family': SERIF, 'letter-spacing': 4 }, '시약'));
  k.add(Txt({ x: 100, y: 232, 'text-anchor': 'middle', 'font-size': 6, fill: '#2a1405', opacity: 0.6, 'letter-spacing': 2, 'font-family': 'Pretendard Variable, sans-serif' }, 'FRAGILE · LAB 2150'));
}

function medalBox(k: Kit): void {
  k.add(S('ellipse', { cx: 100, cy: 270, rx: 80, ry: 8, fill: '#000000', opacity: 0.45, filter: k.blur(4) }));
  const navy = k.lin('nv', [[0, '#2a3a7a'], [0.5, '#141d4a'], [1, '#080c24']], 0, 0, 1, 1);
  // 뚜껑 (열림)
  k.add(P('M34,52 L166,52 C170,52 172,55 172,58 L170,166 L30,166 L28,58 C28,55 30,52 34,52Z', { fill: navy, ...OL }));
  k.add(P('M40,62 L160,62 L158,160 L42,160Z', { fill: k.lin('satin', [[0, '#f3ead6'], [0.5, '#d8cbb0'], [1, '#f7f0e0']], 0, 0, 1, 1) }));
  k.add(P('M40,62 L160,62 L158,160 L42,160Z', { fill: 'none', stroke: k.paint('gold', 'd'), 'stroke-width': 1.4 }));
  const pleat = G({ stroke: '#b8a67a', 'stroke-width': 0.7, opacity: 0.6 });
  for (let i = 0; i < 7; i++) pleat.appendChild(P(`M100,111 L${50 + i * 16.7},62`));
  k.add(pleat);
  k.add(Txt({ x: 100, y: 116, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700, fill: '#8a6a2b', 'font-family': SERIF, 'letter-spacing': 2 }, '품평회'));
  // 몸통
  k.add(P('M26,166 L174,166 L178,258 C178,262 175,265 171,265 L29,265 C25,265 22,262 22,258Z', { fill: navy, ...OL }));
  k.add(P('M36,172 L164,172 L166,210 L34,210Z', { fill: k.lin('vel', [[0, '#3a0d2a'], [1, '#1a0412']], 0, 0, 0, 1) }));
  k.add(S('rect', { x: 22, y: 164, width: 156, height: 5, fill: k.paint('gold', 'v') }));
  k.add(S('rect', { x: 26, y: 238, width: 148, height: 3, fill: k.paint('gold', 'v'), opacity: 0.8 }));
  k.add(S('rect', { x: 88, y: 244, width: 24, height: 12, rx: 2, fill: k.paint('gold', 'v'), stroke: '#4d3710', 'stroke-width': 0.8 }));
  // 메달
  k.add(P('M88,120 L100,120 L108,176 L96,178Z', { fill: k.paint('ruby', 'v'), ...OL }));
  k.add(P('M112,120 L100,120 L92,176 L104,178Z', { fill: k.paint('blue', 'v'), ...OL }));
  k.add(S('circle', { cx: 100, cy: 192, r: 24, fill: k.paint('gold', 'r'), stroke: '#4d3710', 'stroke-width': 1 }));
  k.add(S('circle', { cx: 100, cy: 192, r: 19, fill: 'none', stroke: '#fff3c4', 'stroke-width': 0.8, opacity: 0.8 }));
  k.add(P(starPath(100, 192, 12, 5, 5), { fill: '#b8923f', stroke: '#6e4f18', 'stroke-width': 0.6 }));
  k.add(P('M82,184 A19,19 0 0 1 94,174', { stroke: '#ffffff', 'stroke-width': 2, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }));
}

function scroll(k: Kit): void {
  k.add(S('ellipse', { cx: 100, cy: 276, rx: 76, ry: 8, fill: '#000000', opacity: 0.45, filter: k.blur(4) }));
  const parchD = 'M40,60 L160,60 C156,100 164,140 160,180 C156,210 162,230 160,252 L40,252 C44,230 36,210 40,180 C44,140 36,100 40,60Z';
  k.add(P(parchD, { fill: k.lin('parch', [[0, '#f7ecd0'], [0.5, '#e8d4a4'], [1, '#c9ae78']], 0, 0, 1, 1), ...OL }));
  const lines = G({ stroke: '#8a7450', 'stroke-width': 1, opacity: 0.45 });
  for (let i = 0; i < 6; i++) lines.appendChild(P(`M${58 + (i % 2) * 6},${170 + i * 11} L${142 - (i % 3) * 8},${170 + i * 11}`));
  k.add(lines);
  const gold = k.paint('gold', 'd');
  k.add(S('circle', { cx: 100, cy: 124, r: 30, fill: 'none', stroke: gold, 'stroke-width': 2 }));
  k.add(S('circle', { cx: 100, cy: 124, r: 25, fill: 'none', stroke: gold, 'stroke-width': 0.7 }));
  k.add(P(starPath(100, 124, 18, 6, 8), { fill: gold, stroke: '#6e4f18', 'stroke-width': 0.6 }));
  k.add(S('circle', { cx: 100, cy: 124, r: 5, fill: k.paint('rubyEnamel', 'r') }));
  for (const [y, top] of [[46, true], [248, false]] as [number, boolean][]) {
    k.add(S('rect', { x: 26, y, width: 148, height: 26, rx: 13, fill: k.lin(`roll${y}`, [[0, '#b8784a'], [0.35, '#e0a870'], [0.6, '#6e3b1c'], [1, '#2e1608']], 0, 0, 0, 1), ...OL }));
    k.add(S('ellipse', { cx: 26, cy: y + 13, rx: 6, ry: 13, fill: k.paint('leather', 'r'), ...OL }));
    k.add(S('ellipse', { cx: 26, cy: y + 13, rx: 3, ry: 7, fill: '#2e1608' }));
    k.add(S('ellipse', { cx: 174, cy: y + 13, rx: 6, ry: 13, fill: k.paint('leather', 'r'), ...OL }));
    k.add(P(`M34,${y + 6} L166,${y + 6}`, { stroke: '#ffffff', 'stroke-width': 1.6, opacity: 0.3, 'stroke-linecap': 'round' }));
    if (top) k.add(S('rect', { x: 26, y: y + 10, width: 148, height: 3, fill: gold, opacity: 0.8 }));
  }
  // 금 끈 + 술
  k.add(P('M40,150 C80,160 120,160 160,150', { stroke: gold, 'stroke-width': 3, fill: 'none' }));
  k.add(P('M120,157 C124,175 118,190 122,206', { stroke: gold, 'stroke-width': 2, fill: 'none' }));
  k.add(P('M116,204 L128,204 L131,228 L113,228Z', { fill: k.paint('gold', 'v'), ...OL, 'stroke-width': 0.8 }));
  k.add(P('M116,210 L128,210 M117,216 L117,228 M121,216 L121,228 M125,216 L125,228', { stroke: '#6e4f18', 'stroke-width': 0.6 }));
  k.add(S('circle', { cx: 120, cy: 157, r: 4.5, fill: k.paint('gold', 'r'), stroke: '#4d3710', 'stroke-width': 0.8 }));
}

export function packArt(kind: PackKind, opts?: { price?: number }): HTMLElement {
  const { root, body, face } = shell(`sa-pack sa-pack--${kind}`);
  root.dataset.pack = kind;
  const k = new Kit('pk', 200, 300, undefined, undefined, 'sa-pack__art');
  if (kind === 'seed' || kind === 'rareSeed') envelope(k, kind === 'rareSeed');
  else if (kind === 'reagent') crate(k);
  else if (kind === 'medal') medalBox(k);
  else scroll(k);
  face.appendChild(k.svg);
  face.appendChild(H('div', 'sa-pack__label', PACK_KO[kind] ?? '봉투'));
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', `${PACK_KO[kind] ?? '봉투'}${opts?.price !== undefined ? `, 가격 $${opts.price}` : ''}`);
  return root;
}
