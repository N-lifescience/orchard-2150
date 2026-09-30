// 과일·꽃 그림. 표현형이 한눈에 보여야 한다 — 이게 교육의 핵심.
//  루미: 살짝 각진(패싯) 보석 과일. 무늬(S) = 별 반짝이, 없음 = 매끈한 유리 광택.
//  별다래: 비스듬한 타원 과일 + 반으로 자른 단면. 무늬(L) = 은빛 잎, 없음 = 초록 잎.
//  수그루: 열매 대신 꽃.
import type { Phenotype } from '../contract/genetics';
import { Kit, S, G, P, starPath, leafPath, smoothClosed, polyPath, num, type Attrs } from './dom';
import { mulberry32, between, jitter, type Rand } from './rng';
import { adjust, mix } from './color';

interface Tone {
  halo: string;
  haloOp: number;
  hi: string;
  mid: string;
  lo: string;
  deep: string;
  glow: string;
  juice: string;
  star: string;
  ink: string;
}

const BASE: Record<'ruby' | 'gold', Tone> = {
  ruby: { halo: '#2a020b', haloOp: 0.28, hi: '#ff8e9e', mid: '#d7263d', lo: '#7a0d24', deep: '#2a020b', glow: '#ff5c7a', juice: '#ffb3c0', star: '#ffeab0', ink: '#3a0410' },
  gold: { halo: '#4a2800', haloOp: 0.38, hi: '#fff2b8', mid: '#f2b632', lo: '#9a6a06', deep: '#3a2301', glow: '#ffd23f', juice: '#fff4c4', star: '#fffdf4', ink: '#4a2c00' },
};

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5);

function toneOf(p: Phenotype): Tone {
  const t = clamp01(p.plusFraction);
  const b = BASE[p.color] ?? BASE.ruby;
  const s = (0.8 + 0.32 * t) * (p.aneuploid ? 0.5 : 1);
  const l = (t - 0.5) * 0.05 - (p.aneuploid ? 0.05 : 0);
  const f = (h: string) => adjust(h, { s, l });
  return { halo: b.halo, haloOp: b.haloOp, hi: f(b.hi), mid: f(b.mid), lo: f(b.lo), deep: f(b.deep), glow: f(b.glow), juice: f(b.juice), star: b.star, ink: b.ink };
}

type LeafKind = 'green' | 'silver' | 'dry';

function leafFill(k: Kit, kind: LeafKind): { fill: string; vein: string; edge: string; veinOp: number } {
  if (kind === 'silver')
    return {
      fill: k.lin('leafS', [[0, '#ffffff'], [0.3, '#eef3f6'], [0.5, '#b4c0c6'], [0.68, '#ffffff'], [0.86, '#c9d3d8'], [1, '#7d8a91']], 0.1, 0, 0.9, 1),
      vein: '#6d7a80',
      edge: '#46525a',
      veinOp: 0.75,
    };
  if (kind === 'dry')
    return {
      fill: k.lin('leafD', [[0, '#e8dc8a'], [0.5, '#a89a3c'], [1, '#5a4a18']], 0.1, 0, 0.9, 1),
      vein: '#f1e7a8',
      edge: '#3d3310',
      veinOp: 0.5,
    };
  return {
    fill: k.lin('leafG', [[0, '#6fcf6a'], [0.4, '#1f8a44'], [1, '#08361c']], 0.1, 0, 0.9, 1),
    vein: '#9fe08a',
    edge: '#052614',
    veinOp: 0.5,
  };
}

function drawLeaf(k: Kit, x: number, y: number, ang: number, len: number, wid: number, kind: LeafKind, bend = 0.06, thick = false): SVGGElement {
  const lf = leafFill(k, kind);
  const b = bend * len;
  const veins: SVGElement[] = [];
  for (let i = 1; i <= 4; i++) {
    const t = i / 5.2;
    const mx = len * t;
    const my = -b * t * 1.1;
    const w = wid * 0.62 * (1 - t * 0.55);
    veins.push(P(`M${num(mx)},${num(my)} Q${num(mx + len * 0.08)},${num(my - w * 0.6)} ${num(mx + len * 0.15)},${num(my - w)}`));
    veins.push(P(`M${num(mx)},${num(my)} Q${num(mx + len * 0.08)},${num(my + w * 0.6)} ${num(mx + len * 0.15)},${num(my + w)}`));
  }
  const upperHalf =
    `M0,0 C${num(len * 0.28)},${num(-wid - b)} ${num(len * 0.78)},${num(-wid * 0.78 - b)} ${num(len)},${num(-b * 1.2)} ` +
    `Q${num(len * 0.5)},${num(-b * 0.7)} 0,0Z`;
  const g = G(
    { transform: `translate(${num(x)} ${num(y)}) rotate(${num(ang)})` },
    P(leafPath(len, wid, bend), { fill: lf.fill, stroke: lf.edge, 'stroke-width': thick ? 1.05 : 0.65, 'stroke-linejoin': 'round' }),
    P(upperHalf, { fill: '#ffffff', opacity: kind === 'silver' ? 0.3 : 0.08 }),
    G(
      { stroke: lf.vein, 'stroke-width': thick ? 0.55 : 0.4, fill: 'none', opacity: lf.veinOp, 'stroke-linecap': 'round' },
      P(`M0.5,0 Q${num(len * 0.5)},${num(-b * 0.9)} ${num(len * 0.95)},${num(-b * 1.15)}`, { 'stroke-width': thick ? 1.05 : 0.7 }),
      ...veins,
    ),
  );
  if (kind === 'silver') {
    // 금속성 광택 한 줄 + 작은 반짝임 → '은빛 잎' 이 확실히 보이게
    g.appendChild(
      P(`M${num(len * 0.12)},${num(-wid * 0.45)} C${num(len * 0.35)},${num(-wid * 0.85 - b)} ${num(len * 0.62)},${num(-wid * 0.72 - b)} ${num(len * 0.85)},${num(-wid * 0.28 - b)}`, {
        stroke: '#ffffff',
        'stroke-width': 1.1,
        fill: 'none',
        opacity: 1,
        'stroke-linecap': 'round',
      }),
    );
    g.appendChild(S('circle', { cx: len * 0.66, cy: -wid * 0.42 - b * 0.7, r: 2.6, fill: '#ffffff', opacity: 0.35 }));
    g.appendChild(P(starPath(len * 0.66, -wid * 0.42 - b * 0.7, 3.4, 0.7, 4), { fill: '#ffffff' }));
  }
  return g;
}

function shadowEl(k: Kit, cx: number, cy: number, rx: number, ry: number): SVGEllipseElement {
  return S('ellipse', { cx, cy, rx, ry, fill: k.rad('shadow', [[0, '#000000', 0.5], [0.6, '#000000', 0.2], [1, '#000000', 0]]) });
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

const LIGHT = norm3(-0.45, -0.62, 0.64);

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function starsOn(k: Kit, r: Rand, cx: number, cy: number, R: number, count: number, tone: Tone, avoidTop: boolean): SVGGElement {
  const g = G({ class: 'sa-fruit__stars' });
  const pts: [number, number, number][] = [];
  let tries = 0;
  while (pts.length < count && tries++ < 600) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.72 * R;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d * 0.95;
    if (avoidTop && y < cy - 0.55 * R && Math.abs(x - cx) < 0.36 * R) continue;
    if (pts.some((q) => Math.hypot(q[0] - x, q[1] - y) < 0.34 * R)) continue;
    pts.push([x, y, d / R]);
  }
  pts.forEach(([x, y, dn], i) => {
    // 반지름 = 과일 반지름의 10~13.5% → 별 너비가 지름의 10~14%
    const s = between(r, 0.1, 0.135) * R;
    const squash = Math.max(0.74, Math.sqrt(Math.max(0, 1 - dn * dn)));
    const ra = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    const rot = jitter(r, 14);
    const star = G(
      { transform: `translate(${num(x)} ${num(y)}) rotate(${num(ra)}) scale(${num(squash)} 1) rotate(${num(-ra + rot)})` },
      S('circle', { r: s * 1.3, fill: tone.halo, opacity: tone.haloOp }),
      P(starPath(0, 0, s, s * 0.4, 4), { fill: tone.star, stroke: tone.ink, 'stroke-width': 0.8, 'stroke-linejoin': 'round' }),
      P(starPath(0, 0, s * 0.52, s * 0.2, 4), { fill: '#ffffff' }),
    );
    if (i % 3 === 0) {
      // 반짝임 가시
      star.appendChild(
        P(`M${num(-s * 1.9)},0 L${num(s * 1.9)},0 M0,${num(-s * 1.9)} L0,${num(s * 1.9)}`, {
          stroke: '#ffffff',
          'stroke-width': 0.35,
          opacity: 0.85,
          'stroke-linecap': 'round',
          transform: 'rotate(45)',
        }),
      );
    }
    g.appendChild(star);
  });
  return g;
}

function veinsPath(r: Rand, cx: number, cy: number, R: number, count: number, sy = 0.95): string {
  let d = '';
  for (let v = 0; v < count; v++) {
    const a0 = (v / count) * Math.PI * 2 + jitter(r, 0.35);
    let x = cx + Math.cos(a0) * R * 0.95;
    let y = cy + Math.sin(a0) * R * 0.95 * sy;
    d += `M${num(x)},${num(y)}`;
    const steps = 5;
    for (let s = 0; s < steps; s++) {
      const toC = Math.atan2(cy - y, cx - x) + jitter(r, 0.55);
      const L = R * between(r, 0.1, 0.16);
      const nx = x + Math.cos(toC) * L;
      const ny = y + Math.sin(toC) * L;
      d += ` L${num(nx)},${num(ny)}`;
      if (s === 1 || s === 3) {
        const ba = toC + (r() < 0.5 ? 1 : -1) * between(r, 0.6, 1.1);
        d += ` M${num(nx)},${num(ny)} l${num(Math.cos(ba) * L * 0.9)},${num(Math.sin(ba) * L * 0.9)} M${num(nx)},${num(ny)}`;
      }
      x = nx;
      y = ny;
    }
  }
  return d;
}

function glowVeins(k: Kit, d: string): SVGGElement {
  return G(
    { class: 'sa-fruit__veins' },
    P(d, { fill: 'none', stroke: '#35f3ff', 'stroke-width': 2.4, opacity: 0.6, filter: k.blur(1.1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
    P(d, { fill: 'none', stroke: '#e8ffff', 'stroke-width': 0.6, opacity: 0.95, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
  );
}

function outerGlow(k: Kit, d: string, w = 1): SVGGElement {
  return G(
    { class: 'sa-fruit__lmo' },
    P(d, { fill: '#2fe0ff', stroke: '#2fe0ff', 'stroke-width': 9 * w, opacity: 0.5, filter: k.blur(5) }),
    P(d, { fill: 'none', stroke: '#6ff7ff', 'stroke-width': 4.5 * w, opacity: 0.95, filter: k.blur(2.2) }),
  );
}

function blotches(k: Kit, r: Rand, cx: number, cy: number, sx: number, sy: number, sc: number): SVGGElement {
  const g = G({ filter: k.blur(0.9), class: 'sa-fruit__bitter' });
  for (let i = 0; i < 6; i++) {
    const x = cx + jitter(r, sx);
    const y = cy + jitter(r, sy);
    g.appendChild(
      S('ellipse', {
        cx: x,
        cy: y,
        rx: between(r, 2.8, 6.2) * sc,
        ry: between(r, 1.9, 3.8) * sc,
        transform: `rotate(${num(jitter(r, 40))} ${num(x)} ${num(y)})`,
        fill: i % 2 ? '#3f4c10' : '#5e4010',
        opacity: num(between(r, 0.7, 0.92)),
      }),
    );
  }
  const sp = G({ fill: '#2e2e0c', opacity: 0.7 });
  for (let i = 0; i < 9; i++) sp.appendChild(S('circle', { cx: cx + jitter(r, sx * 1.1), cy: cy + jitter(r, sy * 1.2), r: between(r, 0.35, 0.7) }));
  return G(null, g, sp);
}

// ─────────────────────────────────────────── 루미
function drawLumi(k: Kit, p: Phenotype, r: Rand, tone: Tone): void {
  const t = clamp01(p.plusFraction);
  const giant = p.giant;
  const sc = (giant ? 1.15 : 1) * 1.19;
  const R = 28 * sc;
  const cx = 50;
  const cy = giant ? 58 : 60;
  const N = 18;
  const rot0 = jitter(r, 0.08);
  const lopA = r() * Math.PI * 2;
  const psi = r() * Math.PI * 2;
  const pts: [number, number][] = [];
  const angs: number[] = [];
  const radii: number[] = [];
  for (let i = 0; i < N; i++) {
    const th = -Math.PI / 2 + rot0 + (i * 2 * Math.PI) / N;
    let rr = 1 + jitter(r, 0.012);
    if (p.aneuploid) rr *= 1 + 0.13 * Math.cos(th - lopA) + 0.06 * Math.sin(2 * th + psi);
    const dt = angDiff(th, -Math.PI / 2);
    rr *= 1 - 0.07 * Math.exp(-(dt * dt) / 0.05);
    angs.push(th);
    radii.push(rr);
    pts.push([cx + Math.cos(th) * R * rr, cy + Math.sin(th) * R * rr * 0.95]);
  }
  const outline = polyPath(pts);
  const clip = k.clip('body', P(outline));
  const top = cy - R * 0.95 * 0.93;

  k.add(shadowEl(k, cx, cy + R * 0.95 + 3.2, R * 0.8, 3.8 * sc));
  if (p.fluorescent) k.add(outerGlow(k, outline, sc));

  const leafKind: LeafKind = 'green';
  // 뒤쪽 잎
  k.add(drawLeaf(k, cx + 0.5, top + 1, p.aneuploid ? -80 : -98, 11.5 * sc, 4.4 * sc * (giant ? 1.25 : 1), leafKind, 0.05, giant));

  // 몸통
  const body = k.rad(
    'body',
    [[0, tone.hi], [0.2, mix(tone.hi, tone.mid, 0.5)], [0.5, tone.mid], [0.82, tone.lo], [1, tone.deep]],
    0.42,
    0.38,
    0.7,
    0.34,
    0.28,
  );
  k.add(P(outline, { fill: body }));

  const inner = G({ 'clip-path': clip });
  // 과즙 광채 (당도)
  inner.appendChild(
    S('ellipse', {
      cx: cx + 0.12 * R,
      cy: cy + 0.44 * R,
      rx: 0.66 * R,
      ry: 0.38 * R,
      fill: k.rad('sss', [[0, tone.juice, 0.95], [1, tone.juice, 0]]),
      opacity: num(0.1 + 0.6 * t),
    }),
  );
  inner.appendChild(
    S('circle', { cx: cx + 0.04 * R, cy: cy + 0.06 * R, r: 0.74 * R, fill: k.rad('core', [[0, tone.glow, 0.8], [1, tone.glow, 0]]), opacity: num(0.06 + 0.42 * t) }),
  );
  if (t < 0.6) inner.appendChild(P(outline, { fill: '#5a5646', opacity: num((0.6 - t) * 0.22) }));

  // 패싯
  const fac = G({ class: 'sa-fruit__facets' });
  const Rf = (i: number) => radii[i % N] * R;
  const ring = (frac: number, ox: number, oy: number, idx: (j: number) => number): [number, number][] => {
    const out: [number, number][] = [];
    for (let j = 0; j < N / 2; j++) {
      const i = idx(j);
      const th = angs[i % N];
      out.push([cx + ox + Math.cos(th) * Rf(i) * frac, cy + oy + Math.sin(th) * Rf(i) * frac * 0.95]);
    }
    return out;
  };
  const A = ring(0.74, -0.05 * R, -0.06 * R, (j) => 2 * j + 1);
  const B = ring(0.42, -0.1 * R, -0.12 * R, (j) => 2 * j + 2);
  const M = N / 2;
  const tris: [number, number][][] = [];
  for (let j = 0; j < M; j++) {
    const i0 = 2 * j;
    const i1 = 2 * j + 1;
    const i2 = (2 * j + 2) % N;
    tris.push([pts[i0], pts[i1], A[j]]);
    tris.push([pts[i1], pts[i2], A[j]]);
    tris.push([A[j], pts[i2], A[(j + 1) % M]]);
    tris.push([A[j], A[(j + 1) % M], B[j]]);
    tris.push([B[(j - 1 + M) % M], A[j], B[j]]);
  }
  for (const tri of tris) {
    const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
    const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    const u = (mx - cx) / R + jitter(r, 0.1);
    const v = (my - cy) / R + jitter(r, 0.1);
    const n = norm3(u, v, Math.sqrt(Math.max(0.03, 1 - u * u - v * v)));
    const d = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    const lit = d > 0.62;
    fac.appendChild(
      P(polyPath(tri), {
        fill: lit ? '#ffffff' : '#000000',
        'fill-opacity': num(lit ? Math.min(0.3, (d - 0.62) * 0.8) : Math.min(0.24, (0.62 - d) * 0.26)),
        stroke: '#ffffff',
        'stroke-opacity': num(0.05 + Math.max(0, d - 0.4) * 0.22),
        'stroke-width': 0.3,
        'stroke-linejoin': 'round',
      }),
    );
  }
  fac.appendChild(P(polyPath(B), { fill: '#ffffff', 'fill-opacity': 0.07, stroke: '#ffffff', 'stroke-opacity': 0.14, 'stroke-width': 0.3 }));
  if (!p.marked) fac.setAttribute('opacity', '0.5');
  inner.appendChild(fac);

  // 이수성: 주름과 금
  if (p.aneuploid) inner.appendChild(wrinkles(r, cx, cy, R, tone));
  // 쓴맛: 꼭지 근처 녹갈색 얼룩
  if (p.bitter) inner.appendChild(blotches(k, r, cx, cy - 0.6 * R, 0.36 * R, 0.14 * R, sc));
  // LMO: 빛나는 맥
  if (p.fluorescent) inner.appendChild(glowVeins(k, veinsPath(r, cx, cy, R, 6)));
  // 별무늬
  if (p.marked) inner.appendChild(starsOn(k, r, cx, cy, R, giant ? 9 : 7, tone, true));

  // 림라이트(청록 생물발광 반사) + 가장자리 깊이
  inner.appendChild(P(outline, { fill: 'none', stroke: tone.deep, 'stroke-width': 6, opacity: 0.4, filter: k.blur(1.6) }));
  inner.appendChild(
    P(outline, {
      fill: 'none',
      stroke: k.lin('rim', [[0, '#9ff5ea', 0], [0.58, '#9ff5ea', 0], [1, '#c4fff6', 0.9]], 0, 0, 1, 1),
      'stroke-width': 3.4,
    }),
  );
  k.add(inner);
  k.add(P(outline, { fill: 'none', stroke: tone.deep, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }));

  // 광택: 무늬 있음 = 작은 광택(별이 반짝임을 맡음) / 없음 = 매끈한 유리, 큰 하이라이트 하나
  const spec = k.rad('spec', [[0, '#ffffff', 0.95], [0.45, '#ffffff', 0.55], [1, '#ffffff', 0]]);
  const hx = cx - 0.34 * R;
  const hy = cy - 0.4 * R;
  k.add(
    S('ellipse', {
      cx: hx,
      cy: hy,
      rx: (p.marked ? 0.26 : 0.42) * R,
      ry: (p.marked ? 0.14 : 0.24) * R,
      transform: `rotate(-38 ${num(hx)} ${num(hy)})`,
      fill: spec,
      opacity: p.marked ? 0.65 : 1,
    }),
  );
  if (!p.marked) {
    k.add(S('ellipse', { cx: hx - 0.04 * R, cy: hy - 0.03 * R, rx: 0.16 * R, ry: 0.08 * R, transform: `rotate(-38 ${num(hx)} ${num(hy)})`, fill: '#ffffff', opacity: 0.9 }));
    k.add(
      P(`M${num(cx + 0.86 * R)},${num(cy + 0.02 * R)} Q${num(cx + 0.82 * R)},${num(cy + 0.52 * R)} ${num(cx + 0.4 * R)},${num(cy + 0.76 * R)}`, {
        fill: 'none',
        stroke: '#ffffff',
        'stroke-width': 1.4 * sc,
        opacity: 0.35,
        'stroke-linecap': 'round',
      }),
    );
  }

  // 잎 왕관 · 꼭지
  const calyx = starPath(cx, top + 0.6, 7 * sc, 2.4 * sc, 5, 0.3);
  k.add(
    G(
      { transform: `translate(${num(cx)} ${num(top + 0.6)}) scale(1 0.42) translate(${num(-cx)} ${num(-top - 0.6)})` },
      P(calyx, { fill: k.lin('calyx', [[0, '#6fcf7a'], [1, '#0f4a2a']]), stroke: '#0a3320', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }),
    ),
  );
  const stemG = k.lin('stem', [[0, '#8a6a34'], [1, '#3d5a22']], 0, 0, 0, 1);
  k.add(
    P(`M${cx},${num(top)} C${num(cx + 0.5)},${num(top - 4 * sc)} ${num(cx + 2.4 * sc)},${num(top - 7 * sc)} ${num(cx + 3.4 * sc)},${num(top - 10 * sc)}`, {
      fill: 'none',
      stroke: stemG,
      'stroke-width': 2.4 * sc,
      'stroke-linecap': 'round',
    }),
  );
  const droop = p.aneuploid ? 28 : 0;
  k.add(drawLeaf(k, cx - 1, top - 1, -160 + droop, 17 * sc, 6.1 * sc * (giant ? 1.3 : 1), p.aneuploid ? 'dry' : leafKind, 0.08, giant));
  k.add(drawLeaf(k, cx + 1.5, top - 1.4, -30 + droop, 14 * sc, 5.2 * sc * (giant ? 1.3 : 1), leafKind, -0.06, giant));
}

function wrinkles(r: Rand, cx: number, cy: number, R: number, tone: Tone): SVGGElement {
  const g = G({ class: 'sa-fruit__wrinkles', fill: 'none', 'stroke-linecap': 'round' });
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2;
    const x0 = cx + Math.cos(a) * R * 0.92;
    const y0 = cy + Math.sin(a) * R * 0.88;
    const a1 = a + jitter(r, 0.5);
    const x1 = cx + Math.cos(a1) * R * 0.38;
    const y1 = cy + Math.sin(a1) * R * 0.36;
    const qx = (x0 + x1) / 2 + jitter(r, 5);
    const qy = (y0 + y1) / 2 + jitter(r, 5);
    const d = `M${num(x0)},${num(y0)} Q${num(qx)},${num(qy)} ${num(x1)},${num(y1)}`;
    g.appendChild(P(d, { stroke: '#000000', 'stroke-width': 1, opacity: 0.32 }));
    g.appendChild(P(d, { stroke: '#ffffff', 'stroke-width': 0.5, opacity: 0.2, transform: 'translate(-0.7 -0.6)' }));
  }
  // 금 간 자국
  const a0 = 2.2 + jitter(r, 0.4);
  let x = cx + Math.cos(a0) * R * 0.98;
  let y = cy + Math.sin(a0) * R * 0.93;
  let d = `M${num(x)},${num(y)}`;
  for (let s = 0; s < 7; s++) {
    const dir = Math.atan2(cy - y, cx - x) + (s % 2 ? 0.7 : -0.7) + jitter(r, 0.25);
    x += Math.cos(dir) * R * 0.085;
    y += Math.sin(dir) * R * 0.085;
    d += ` L${num(x)},${num(y)}`;
  }
  g.appendChild(P(d, { stroke: tone.hi, 'stroke-width': 0.5, opacity: 0.6, transform: 'translate(0.5 0.45)', 'stroke-linejoin': 'round' }));
  g.appendChild(P(d, { stroke: '#150403', 'stroke-width': 0.95, opacity: 0.8, 'stroke-linejoin': 'round' }));
  return g;
}

// ─────────────────────────────────────────── 별다래 (암그루)
function ellipsePts(r: Rand, cx: number, cy: number, rx: number, ry: number, rotDeg: number, wob: number, lop: number): [number, number][] {
  const pts: [number, number][] = [];
  const rot = (rotDeg * Math.PI) / 180;
  const la = r() * Math.PI * 2;
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = 1 + jitter(r, wob) + lop * Math.cos(a - la) + lop * 0.4 * Math.sin(3 * a + la);
    const x = Math.cos(a) * rx * m;
    const y = Math.sin(a) * ry * m;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}

function drawStella(k: Kit, p: Phenotype, r: Rand, tone: Tone): void {
  const t = clamp01(p.plusFraction);
  const giant = p.giant;
  const sc = giant ? 1.12 : 1;
  const desat = p.aneuploid ? 0.5 : 1;
  const skinBase = p.color === 'ruby' ? ['#a8604e', '#6e3025', '#260c07'] : ['#c9a060', '#7d5a2c', '#2b1d0b'];
  const skin = skinBase.map((c) => adjust(c, { s: desat }));
  const lop = p.aneuploid ? 0.1 : 0;

  const root = G(giant ? { transform: 'translate(50 56) scale(1.12) translate(-50 -56)' } : null);
  k.add(root);
  root.appendChild(shadowEl(k, 52, 88, 34, 4.2));

  const W = { cx: 40, cy: 50, rx: 20.5, ry: 28.5, rot: -30 };
  const wholePts = ellipsePts(r, W.cx, W.cy, W.rx, W.ry, W.rot, 0.012, lop);
  const whole = smoothClosed(wholePts);
  const C = { cx: 61, cy: 63, rx: 19.5, ry: 22, rot: -16 };
  const cutPts = ellipsePts(r, C.cx, C.cy, C.rx + 1.7, C.ry + 1.7, C.rot, 0.008, lop * 0.7);
  const cutRim = smoothClosed(cutPts);

  if (p.fluorescent) {
    root.appendChild(outerGlow(k, whole, 0.9));
    root.appendChild(outerGlow(k, cutRim, 0.9));
  }

  // 통 과일(뒤)
  const skinG = k.rad('skin', [[0, skin[0]], [0.55, skin[1]], [1, skin[2]]], 0.4, 0.32, 0.75, 0.34, 0.24);
  root.appendChild(P(whole, { fill: skinG, stroke: '#170904', 'stroke-width': 0.9 }));
  const wClip = k.clip('whole', P(whole));
  const fuzz = G({ 'clip-path': wClip });
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    const x = W.cx + Math.cos(a) * W.rx * d * 1.3;
    const y = W.cy + Math.sin(a) * W.ry * d;
    fuzz.appendChild(S('circle', { cx: x, cy: y, r: between(r, 0.25, 0.5), fill: '#f0d9ae', opacity: num(between(r, 0.15, 0.4)) }));
  }
  fuzz.appendChild(
    S('ellipse', {
      cx: W.cx - 7,
      cy: W.cy - 10,
      rx: 7,
      ry: 12,
      transform: `rotate(-30 ${W.cx - 7} ${W.cy - 10})`,
      fill: k.rad('wspec', [[0, '#fff6e0', 0.45], [1, '#fff6e0', 0]]),
    }),
  );
  if (p.bitter) fuzz.appendChild(blotches(k, r, 27, 30, 6, 5, 1));
  if (p.aneuploid) fuzz.appendChild(wrinkles(r, W.cx, W.cy, W.rx, tone));
  root.appendChild(fuzz);
  // 잔털: 외곽선 바깥쪽으로 짧은 털
  const hairs = G({ stroke: '#d9bf95', 'stroke-width': 0.45, opacity: 0.6, 'stroke-linecap': 'round' });
  for (let i = 0; i < wholePts.length; i++) {
    const a = wholePts[i];
    const b = wholePts[(i + 1) % wholePts.length];
    for (let h = 0; h < 4; h++) {
      const u = r();
      const x = a[0] + (b[0] - a[0]) * u;
      const y = a[1] + (b[1] - a[1]) * u;
      const nx = x - W.cx;
      const ny = y - W.cy;
      const nl = Math.hypot(nx, ny) || 1;
      const L = between(r, 0.9, 2);
      const ta = jitter(r, 0.5);
      const dx = (nx / nl) * Math.cos(ta) - (ny / nl) * Math.sin(ta);
      const dy = (nx / nl) * Math.sin(ta) + (ny / nl) * Math.cos(ta);
      hairs.appendChild(S('line', { x1: x, y1: y, x2: x + dx * L, y2: y + dy * L }));
    }
  }
  root.appendChild(hairs);

  // 잎 (통 과일 꼭대기)
  const ra = (W.rot * Math.PI) / 180;
  const tx = W.cx + W.ry * Math.sin(-ra) * -1;
  const ty = W.cy - W.ry * Math.cos(ra);
  const kind: LeafKind = p.aneuploid ? (p.marked ? 'silver' : 'dry') : p.marked ? 'silver' : 'green';
  const droop = p.aneuploid ? 22 : 0;
  root.appendChild(
    P(`M${num(tx)},${num(ty + 1)} C${num(tx - 1)},${num(ty - 2)} ${num(tx - 2)},${num(ty - 4)} ${num(tx - 1.5)},${num(ty - 6.5)}`, {
      stroke: '#5a3c1c',
      'stroke-width': 2.2,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
  );
  root.appendChild(drawLeaf(k, tx - 1.2, ty - 5, -168 + droop, 19, 7.6 * (giant ? 1.25 : 1), kind, 0.07, giant));
  root.appendChild(drawLeaf(k, tx - 1.2, ty - 5.5, -24 + droop, 23, 8.6 * (giant ? 1.25 : 1), kind, -0.08, giant));

  // 자른 단면 (앞)
  root.appendChild(P(cutRim, { fill: skin[2], transform: 'translate(1.4 2.4)' }));
  root.appendChild(P(cutRim, { fill: k.lin('rimSkin', [[0, skin[0]], [1, skin[1]]]), stroke: '#170904', 'stroke-width': 0.9 }));

  const flesh = G({ transform: `translate(${C.cx} ${C.cy}) rotate(${C.rot})` });
  const fleshPts = ellipsePts(r, 0, 0, C.rx, C.ry, 0, 0.006, lop * 0.7);
  const fleshD = smoothClosed(fleshPts);
  const fleshG = k.rad('flesh', [[0, '#fffbe8'], [0.2, mix(tone.juice, '#fffbe8', 0.4)], [0.42, tone.hi], [0.8, tone.mid], [1, tone.lo]], 0.5, 0.5, 0.52);
  flesh.appendChild(P(fleshD, { fill: fleshG }));
  const fClip = k.clip('flesh', P(fleshD));
  const fin = G({ 'clip-path': fClip });
  fin.appendChild(S('circle', { r: C.rx * 0.95, fill: k.rad('fglow', [[0, tone.glow, 0.85], [1, tone.glow, 0]]), opacity: num(0.08 + 0.45 * t) }));
  // 방사 결
  const rays = G({ stroke: tone.juice, 'stroke-width': 0.45, opacity: 0.45, 'stroke-linecap': 'round' });
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 + jitter(r, 0.06);
    rays.appendChild(
      S('line', { x1: Math.cos(a) * C.rx * 0.3, y1: Math.sin(a) * C.ry * 0.3, x2: Math.cos(a) * C.rx * 0.92, y2: Math.sin(a) * C.ry * 0.92 }),
    );
  }
  fin.appendChild(rays);
  // 씨 (3배체면 빈 자리만)
  const seeds = G({ class: 'sa-fruit__seeds' });
  const rows: [number, number, number][] = [
    [24, 0.5, 0],
    [20, 0.61, 0.5],
  ];
  for (const [n, rho, ph] of rows) {
    for (let i = 0; i < n; i++) {
      const a = ((i + ph) / n) * Math.PI * 2 + jitter(r, 0.05);
      const x = Math.cos(a) * C.rx * rho * (1 + jitter(r, 0.04));
      const y = Math.sin(a) * C.ry * rho * (1 + jitter(r, 0.04));
      const deg = (a * 180) / Math.PI;
      if (p.seedless) {
        seeds.appendChild(S('ellipse', { cx: x, cy: y, rx: 0.9, ry: 0.4, transform: `rotate(${num(deg)} ${num(x)} ${num(y)})`, fill: '#ffffff', opacity: 0.4 }));
      } else {
        seeds.appendChild(
          G(
            { transform: `translate(${num(x)} ${num(y)}) rotate(${num(deg)})` },
            S('ellipse', { rx: 1.25, ry: 0.62, fill: '#1a0c06' }),
            S('circle', { cx: -0.3, cy: -0.2, r: 0.22, fill: '#ffffff', opacity: 0.7 }),
          ),
        );
      }
    }
  }
  fin.appendChild(seeds);
  // 별 모양 심
  const coreR = C.rx * 0.34;
  const core = starPath(0, 0, coreR, coreR * 0.5, 5, jitter(r, 0.3));
  fin.appendChild(G({ transform: `scale(1 ${num(C.ry / C.rx)})` }, P(core, { fill: '#fffdf0', opacity: 0.7, filter: k.blur(1.2) })));
  fin.appendChild(
    G(
      { transform: `scale(1 ${num(C.ry / C.rx)})` },
      P(core, { fill: k.rad('core', [[0, '#ffffff'], [0.6, '#fff4d0'], [1, '#f1dca4']]), stroke: '#ffffff', 'stroke-width': 0.4, 'stroke-opacity': 0.8 }),
    ),
  );
  if (t < 0.6) fin.appendChild(P(fleshD, { fill: '#5a5646', opacity: num((0.6 - t) * 0.36) }));
  if (p.fluorescent) {
    let d = '';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + jitter(r, 0.2);
      let x = Math.cos(a) * coreR * 0.9;
      let y = Math.sin(a) * coreR * 0.9;
      d += `M${num(x)},${num(y)}`;
      for (let s = 0; s < 4; s++) {
        const aa = a + jitter(r, 0.35);
        x += Math.cos(aa) * C.rx * 0.16;
        y += Math.sin(aa) * C.ry * 0.16;
        d += ` L${num(x)},${num(y)}`;
      }
    }
    fin.appendChild(glowVeins(k, d));
  }
  if (p.aneuploid) {
    let x = -C.rx;
    let y = C.ry * 0.2;
    let d = `M${num(x)},${num(y)}`;
    for (let s = 0; s < 8; s++) {
      x += C.rx * 0.17;
      y += (s % 2 ? 1 : -1) * between(r, 1, 2.4);
      d += ` L${num(x)},${num(y)}`;
    }
    fin.appendChild(P(d, { fill: 'none', stroke: '#150403', 'stroke-width': 0.9, opacity: 0.7 }));
  }
  // 촉촉한 반사
  fin.appendChild(
    P(`M${num(-C.rx * 0.78)},${num(-C.ry * 0.2)} A${num(C.rx * 0.82)},${num(C.ry * 0.82)} 0 0 1 ${num(-C.rx * 0.3)},${num(-C.ry * 0.76)}`, {
      fill: 'none',
      stroke: '#ffffff',
      'stroke-width': 1,
      opacity: 0.7,
      'stroke-linecap': 'round',
    }),
  );
  fin.appendChild(S('circle', { cx: -C.rx * 0.2, cy: -C.ry * 0.82, r: 0.8, fill: '#ffffff', opacity: 0.85 }));
  flesh.appendChild(fin);
  flesh.appendChild(P(fleshD, { fill: 'none', stroke: tone.deep, 'stroke-width': 0.5, opacity: 0.6 }));
  root.appendChild(flesh);
}

// ─────────────────────────────────────────── 수그루: 꽃
function drawFlower(k: Kit, p: Phenotype, r: Rand, tone: Tone): void {
  const giant = p.giant;
  const sc = giant ? 1.12 : 1;
  const fx = 50;
  const fy = 40;
  const root = G(giant ? { transform: 'translate(50 52) scale(1.12) translate(-50 -52)' } : null);
  k.add(root);
  root.appendChild(shadowEl(k, 51, 94, 18, 3));

  const leafKind: LeafKind = p.aneuploid ? 'dry' : p.species === 'stella' && p.marked ? 'silver' : 'green';
  root.appendChild(
    P(`M${fx},${fy + 4} C${fx - 1},${fy + 22} ${fx + 3},${fy + 38} ${fx + 1},94`, {
      fill: 'none',
      stroke: k.lin('stem', [[0, '#3d7a3a'], [1, '#1f4a22']], 0, 0, 0, 1),
      'stroke-width': 2.6,
      'stroke-linecap': 'round',
    }),
  );
  root.appendChild(drawLeaf(k, fx + 0.5, 72, -168 + (p.aneuploid ? 20 : 0), 21, 7.6 * (giant ? 1.25 : 1), leafKind, 0.08, giant));
  root.appendChild(drawLeaf(k, fx + 1.2, 80, -14 + (p.aneuploid ? 20 : 0), 20, 7.2 * (giant ? 1.25 : 1), leafKind, -0.08, giant));

  const rot0 = jitter(r, 8);
  const petalD = 'M0,0 C5,-10 15,-13.5 21,-9 C25.5,-5.5 26,-1.8 24.4,0 C26,1.8 25.5,5.5 21,9 C15,13.5 5,10 0,0Z';
  const petalG = k.rad(
    'petal',
    [[0, tone.deep], [0.13, tone.lo], [0.36, tone.mid], [0.74, mix(tone.mid, tone.hi, 0.35)], [0.94, tone.hi], [1, mix(tone.hi, '#ffffff', 0.3)]],
    0,
    0,
    25,
    undefined,
    undefined,
    { gradientUnits: 'userSpaceOnUse' },
  );
  const petals = G({ class: 'sa-fruit__petals' });
  const back = G(null);
  // 꽃받침
  for (let i = 0; i < 5; i++) {
    const a = -90 + rot0 + i * 72 + 36;
    back.appendChild(
      G({ transform: `translate(${fx} ${fy}) rotate(${num(a)}) scale(0.52)` }, P(petalD, { fill: k.paint('leaf', 'd'), stroke: '#0c3a22', 'stroke-width': 1 })),
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = -90 + rot0 + i * 72 + 36;
    const s = (p.aneuploid ? between(r, 0.6, 0.85) : 0.8) * sc;
    back.appendChild(
      G({ transform: `translate(${fx} ${fy}) rotate(${num(a)}) scale(${num(s)})` }, P(petalD, { fill: petalG, stroke: tone.deep, 'stroke-width': 0.7, opacity: 0.9 })),
    );
  }
  const front = G(null);
  for (let i = 0; i < 5; i++) {
    let a = -90 + rot0 + i * 72;
    let s = sc * (24 / 25);
    if (p.aneuploid) {
      s *= between(r, 0.72, 1.08);
      if (i === 2) a += 26;
    }
    const veins = G(
      { stroke: tone.hi, 'stroke-width': 0.45, fill: 'none', opacity: 0.45, 'stroke-linecap': 'round' },
      P('M3,0 Q12,-1.5 20,-4.5'),
      P('M3,0 L21.5,0'),
      P('M3,0 Q12,1.5 20,4.5'),
    );
    const pg = G(
      { transform: `translate(${fx} ${fy}) rotate(${num(a)}) scale(${num(s)})` },
      P(petalD, { fill: petalG, stroke: tone.deep, 'stroke-width': 0.75, 'stroke-linejoin': 'round' }),
      veins,
      P('M9,-7 C13,-10.5 18,-10.5 21,-7.5 C17,-8.5 13,-7.8 9,-7Z', { fill: '#ffffff', opacity: 0.35 }),
    );
    if (p.fluorescent) pg.appendChild(P('M3,0 L22,0 M8,0 L14,-5 M8,0 L14,5', { stroke: '#8ffcff', 'stroke-width': 0.7, fill: 'none', opacity: 0.9 }));
    front.appendChild(pg);
  }
  if (p.fluorescent) {
    const glow = G({ filter: k.blur(2.6), opacity: 0.9 });
    for (let i = 0; i < 5; i++) {
      glow.appendChild(
        G({ transform: `translate(${fx} ${fy}) rotate(${num(-90 + rot0 + i * 72)}) scale(${num(sc)})` }, P(petalD, { fill: 'none', stroke: '#4ff4ff', 'stroke-width': 3.5 })),
      );
    }
    petals.appendChild(glow);
  }
  petals.appendChild(back);
  petals.appendChild(front);
  root.appendChild(petals);

  if (p.marked && p.species === 'lumi') root.appendChild(starsOn(k, r, fx, fy, 22 * sc, 6, tone, false));
  if (p.bitter) root.appendChild(blotches(k, r, fx, fy + 7, 6, 3, 0.8));

  // 수술과 꽃가루
  const stam = G({ class: 'sa-fruit__stamens' });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + jitter(r, 0.1);
    const L = between(r, 8.5, 11.5) * sc;
    const x = fx + Math.cos(a) * L;
    const y = fy + Math.sin(a) * L;
    stam.appendChild(S('line', { x1: fx + Math.cos(a) * 3, y1: fy + Math.sin(a) * 3, x2: x, y2: y, stroke: '#f7ecd0', 'stroke-width': 0.45, opacity: 0.9 }));
    stam.appendChild(
      S('ellipse', { cx: x, cy: y, rx: 1.35, ry: 0.85, transform: `rotate(${num((a * 180) / Math.PI)} ${num(x)} ${num(y)})`, fill: '#ffd23f', stroke: '#7a4a00', 'stroke-width': 0.3 }),
    );
  }
  stam.appendChild(S('circle', { cx: fx, cy: fy, r: 5.2 * sc, fill: k.rad('disc', [[0, '#fff6b0'], [0.5, '#e0b52c'], [1, '#6e4f08']], 0.4, 0.35, 0.7), stroke: '#4a3304', 'stroke-width': 0.5 }));
  for (let i = 0; i < 7; i++) stam.appendChild(S('circle', { cx: fx + jitter(r, 2.6), cy: fy + jitter(r, 2.6), r: 0.45, fill: '#7a5206', opacity: 0.7 }));
  root.appendChild(stam);

  const pol = G({ class: 'sa-fruit__pollen' });
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + jitter(r, 1.5);
    const d = between(r, 14, 34) * sc;
    const x = fx + Math.cos(a) * d * 1.15;
    const y = fy + Math.sin(a) * d * 0.9 - 2;
    if (y < 3 || x < 3 || x > 97) continue;
    const pr = between(r, 0.45, 1.15);
    pol.appendChild(S('circle', { cx: x, cy: y, r: pr * 2.4, fill: '#ffe066', opacity: 0.22 }));
    pol.appendChild(S('circle', { cx: x, cy: y, r: pr, fill: '#fff2a0' }));
  }
  root.appendChild(pol);
}

// ─────────────────────────────────────────── 씨 없는 단면 (3배체)
function seedlessInset(k: Kit, tone: Tone): SVGGElement {
  const x = 81;
  const y = 81;
  const g = G({ class: 'sa-fruit__seedless' });
  g.appendChild(S('circle', { cx: x + 0.8, cy: y + 1.3, r: 12.6, fill: '#000000', opacity: 0.28, filter: k.blur(1) }));
  g.appendChild(S('circle', { cx: x, cy: y, r: 12.6, fill: '#f7efdc', stroke: k.paint('gold', 'd'), 'stroke-width': 1.1 }));
  g.appendChild(S('circle', { cx: x, cy: y, r: 10.4, fill: tone.lo }));
  g.appendChild(S('circle', { cx: x, cy: y, r: 9.3, fill: k.rad('inset', [[0, '#fffbe8'], [0.35, tone.juice], [0.75, tone.hi], [1, tone.mid]]) }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const sx = x + Math.cos(a) * 5.2;
    const sy = y + Math.sin(a) * 5.2;
    g.appendChild(
      S('ellipse', {
        cx: sx,
        cy: sy,
        rx: 1.5,
        ry: 0.75,
        transform: `rotate(${num((a * 180) / Math.PI)} ${num(sx)} ${num(sy)})`,
        fill: 'none',
        stroke: tone.lo,
        'stroke-width': 0.4,
        'stroke-dasharray': '0.8 0.6',
        opacity: 0.7,
      }),
    );
  }
  g.appendChild(P(`M${x - 6.5},${y - 3} A7.5,7.5 0 0 1 ${x - 1},${y - 7.2}`, { stroke: '#ffffff', 'stroke-width': 0.9, fill: 'none', opacity: 0.8, 'stroke-linecap': 'round' }));
  return g;
}

const SPECIES_KO: Record<string, string> = { lumi: '루미', stella: '별다래' };

export function describePheno(p: Phenotype): string {
  const sp = SPECIES_KO[p.species] ?? p.species;
  const col = p.color === 'ruby' ? '루비' : '골드';
  const mark = p.marked ? (p.species === 'stella' ? '은빛 잎' : '별무늬') : p.species === 'stella' ? '초록 잎' : '무늬 없음';
  const what = p.sex === 'M' ? '수그루 꽃' : '열매';
  return `${sp} ${what} · ${col} · ${mark}`;
}

export function fruitArt(p: Phenotype, seed: number, size = 120): SVGSVGElement {
  const k = new Kit('fr', 100, 100, size, size, 'sa-fruit');
  const r = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const tone = toneOf(p);
  if (p.sex === 'M') drawFlower(k, p, r, tone);
  else if (p.species === 'stella') drawStella(k, p, r, tone);
  else drawLumi(k, p, r, tone);
  if (p.seedless && p.sex !== 'M') k.add(seedlessInset(k, tone));
  k.svg.removeAttribute('aria-hidden');
  k.svg.setAttribute('role', 'img');
  k.svg.setAttribute('aria-label', describePheno(p));
  const a: Attrs = { 'data-species': p.species, 'data-sex': p.sex };
  for (const key of Object.keys(a)) k.svg.setAttribute(key, String(a[key]));
  return k.svg;
}
