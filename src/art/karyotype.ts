// 핵형(염색체) 미니 그림. 사본 수대로 그리므로 배수체·이수성이 그대로 보인다.
// revealed=false 면 모양(개수)만 회색 윤곽으로 — 대립유전자 색 띠는 숨긴다.
import type { Genome, HomologGroup, ChromosomeCopy } from '../contract/genetics';
import { Kit, S, G, P, Txt, num } from './dom';

const GROUPS: HomologGroup[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'sex'];
const LEN: Record<string, number> = { c1: 34, c2: 31, c3: 28, c4: 25, c5: 22, X: 30, Y: 15 };
const CEN: Record<string, number> = { c1: 0.42, c2: 0.36, c3: 0.46, c4: 0.3, c5: 0.4, X: 0.38, Y: 0.35 };
const HUE: Record<string, [string, string, string]> = {
  c1: ['#c9fff8', '#2fd4c4', '#0a4f49'],
  c2: ['#d6f8c8', '#4fb86a', '#124d31'],
  c3: ['#fff3c4', '#e0b52c', '#5e4006'],
  c4: ['#d6e4ff', '#5a8cff', '#15307a'],
  c5: ['#ecd4ff', '#9a6ae0', '#361566'],
  X: ['#ffd0e0', '#ff4f8b', '#6e0c35'],
  Y: ['#d6ecff', '#3aa0ff', '#0d3a78'],
};

/** 대립유전자 → 띠 색 */
function alleleColor(a: string): string {
  if (a.includes('*ko')) return '#8a8f8c';
  if (a.startsWith('T')) return '#6ff7ff';
  if (/^Q\d\+/.test(a)) return '#fff3a0';
  if (/^Q\d/.test(a)) return '#5a4a2a';
  switch (a) {
    case 'R':
      return '#d7263d';
    case 'r':
      return '#f2b632';
    case 'S':
      return '#fff6d8';
    case 's':
      return '#3a3a3a';
    case 'B':
      return '#5a6a1a';
    case 'b':
      return '#d8d0a8';
    case 'L':
      return '#e6eef1';
    case 'l':
      return '#2e8a4a';
  }
  return /^[A-Z]/.test(a) ? '#f3ead6' : '#3a3a3a';
}

interface Shape {
  kind: string; // 'c1'..'c5' | 'X' | 'Y'
  copy: ChromosomeCopy;
}

const W = 2.7; // 염색분체 굵기
const SLOT = 12; // 한 염색체 폭

function drawChromo(k: Kit, x: number, cenY: number, sh: Shape, revealed: boolean): SVGGElement {
  const key = sh.kind;
  const L = LEN[key] ?? 26;
  const c = CEN[key] ?? 0.4;
  const top = cenY - L * c;
  const bot = cenY + L * (1 - c);
  const g = G({ class: `sa-chromo sa-chromo--${key}` });
  const col = HUE[key] ?? HUE.c1;
  const fill = revealed ? k.lin(`ch${key}`, [[0, col[0]], [0.45, col[1]], [1, col[2]]], 0, 0, 1, 0) : '#8d9794';
  const outline = revealed ? col[2] : '#5a625f';
  let paths: string[];
  if (key === 'Y') {
    // Y: 위쪽 두 팔이 벌어지고 아래는 하나로
    paths = [
      `M${num(x - 3.2)},${num(top)} Q${num(x - 0.8)},${num(cenY - 1)} ${num(x - 0.9)},${num(cenY + 1)}`,
      `M${num(x + 3.2)},${num(top)} Q${num(x + 0.8)},${num(cenY - 1)} ${num(x + 0.9)},${num(cenY + 1)}`,
      `M${num(x)},${num(cenY)} L${num(x)},${num(bot)}`,
    ];
  } else {
    const sp = key === 'X' ? 3.9 : 3.5;
    paths = [
      `M${num(x - sp)},${num(top)} Q${num(x + 0.9)},${num(cenY)} ${num(x - sp)},${num(bot)}`,
      `M${num(x + sp)},${num(top)} Q${num(x - 0.9)},${num(cenY)} ${num(x + sp)},${num(bot)}`,
    ];
  }
  const wOf = (i: number) => (key === 'Y' && i === 2 ? W * 1.5 : W);
  if (revealed) paths.forEach((d, i) => g.appendChild(P(d, { stroke: outline, 'stroke-width': wOf(i) + 1.1, fill: 'none', 'stroke-linecap': 'round' })));
  paths.forEach((d, i) =>
    g.appendChild(P(d, { stroke: fill, 'stroke-width': wOf(i), fill: 'none', 'stroke-linecap': 'round', opacity: revealed ? 1 : 0.55 })),
  );
  if (!revealed) {
    paths.forEach((d, i) =>
      g.appendChild(P(d, { stroke: '#c9d1ce', 'stroke-width': wOf(i) + 0.9, fill: 'none', 'stroke-linecap': 'round', opacity: 0.35, 'stroke-dasharray': '0.1 1.6' })),
    );
    return g;
  }
  paths.forEach((d, i) => g.appendChild(P(d, { stroke: '#ffffff', 'stroke-width': wOf(i) * 0.25, fill: 'none', 'stroke-linecap': 'round', opacity: 0.45, transform: 'translate(-0.5 0)' })));
  // 대립유전자 띠: 긴 팔을 따라 차례로
  const alleles = Object.values(sh.copy.alleles ?? {}).filter((a): a is string => typeof a === 'string');
  const n = alleles.length;
  alleles.forEach((a, i) => {
    const f = (i + 1) / (n + 1);
    const y = cenY + (bot - cenY) * (0.18 + f * 0.72);
    const t = (y - cenY) / (bot - cenY);
    const sp = key === 'X' ? 3.9 : 3.5;
    const u = 0.5 + 0.5 * t;
    const off = key === 'Y' ? 0 : Math.abs(-sp * ((1 - u) * (1 - u) + u * u) + 0.9 * 2 * u * (1 - u));
    const bw = key === 'Y' ? W * 1.5 : W;
    const colr = alleleColor(a);
    const glow = a.startsWith('T');
    const band = (cx: number) =>
      P(`M${num(cx - bw / 2 + 0.2)},${num(y)} L${num(cx + bw / 2 - 0.2)},${num(y)}`, { stroke: colr, 'stroke-width': 1.5, 'stroke-linecap': 'butt', filter: glow ? k.blur(0.5) : null });
    if (key === 'Y') g.appendChild(band(x));
    else {
      g.appendChild(band(x - off));
      g.appendChild(band(x + off));
    }
  });
  g.appendChild(S('circle', { cx: x, cy: cenY, r: 1.2, fill: '#ffffff', opacity: 0.55 }));
  return g;
}

export function karyotype(g: Genome, opts?: { revealed?: boolean; width?: number }): SVGSVGElement {
  const revealed = opts?.revealed ?? true;
  const groups = GROUPS.map((gr) => ({ gr, copies: g?.chromosomes?.[gr] ?? [] })).filter((x) => x.copies.length > 0);
  const gap = 7;
  let wTotal = 6;
  for (const gg of groups) wTotal += gg.copies.length * SLOT + gap;
  wTotal = Math.max(40, wTotal - gap + 6);
  const H = 58;
  const width = opts?.width ?? 220;
  const k = new Kit('ky', wTotal, H, width, (width * H) / wTotal, `sa-karyo${revealed ? '' : ' is-hidden'}`);
  const cenY = 20;
  let x = 6 + SLOT / 2;
  const ploidy = g?.ploidy ?? 2;
  for (const { gr, copies } of groups) {
    const x0 = x - SLOT / 2;
    const shapes: Shape[] = copies.map((c) => ({ kind: gr === 'sex' ? (c.kind === 'Y' ? 'Y' : 'X') : gr, copy: c }));
    if (gr === 'sex') shapes.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'X' ? -1 : 1));
    for (const sh of shapes) {
      k.add(drawChromo(k, x, cenY, sh, revealed));
      x += SLOT;
    }
    const x1 = x - SLOT / 2;
    const odd = copies.length !== ploidy;
    const label = gr === 'sex' ? shapes.map((s) => s.kind).join('') : gr.slice(1);
    const lc = odd ? '#ff4f8b' : '#c9b98f';
    k.add(P(`M${num(x0 + 1)},${H - 11} L${num(x1 - 1)},${H - 11}`, { stroke: lc, 'stroke-width': odd ? 1.1 : 0.6, opacity: 0.85 }));
    k.add(
      Txt(
        {
          x: (x0 + x1) / 2,
          y: H - 3,
          'text-anchor': 'middle',
          'font-size': gr === 'sex' ? 6.2 : 7,
          'font-weight': 700,
          fill: lc,
          'font-family': "'Gowun Batang', serif",
        },
        gr === 'sex' ? label : `${label}번`,
      ),
    );
    x += gap;
  }
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  const total = groups.reduce((s, gg) => s + gg.copies.length, 0);
  const odd = groups.filter((gg) => gg.copies.length !== ploidy).map((gg) => (gg.gr === 'sex' ? '성염색체' : `${gg.gr.slice(1)}번`));
  k.svg.setAttribute('aria-label', `핵형: 염색체 ${total}개, ${ploidy}배체${odd.length ? `, 수가 다른 염색체: ${odd.join(', ')}` : ''}`);
  return k.svg;
}
