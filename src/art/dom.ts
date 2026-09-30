// 요소 생성 도우미. innerHTML 계열은 쓰지 않는다 — createElement / createElementNS 만.

export const SVG_NS = 'http://www.w3.org/2000/svg';

export type AttrVal = string | number | null | undefined | false;
export type Attrs = Record<string, AttrVal>;
export type Child = Node | null | undefined | false;

const fmt = (v: string | number): string => (typeof v === 'number' ? String(Math.round(v * 100) / 100) : v);

export function setAttrs(el: Element, attrs: Attrs): void {
  for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v === null || v === undefined || v === false) continue;
    el.setAttribute(k, fmt(v));
  }
}

/** SVG 요소 */
export function S<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, ...kids: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  if (attrs) setAttrs(el, attrs);
  for (const c of kids) if (c) el.appendChild(c);
  return el;
}

export const G = (attrs?: Attrs | null, ...kids: Child[]): SVGGElement => S('g', attrs, ...kids);
export const P = (d: string, attrs?: Attrs | null): SVGPathElement => S('path', { d, ...(attrs ?? {}) });

export function Txt(attrs: Attrs, text: string): SVGTextElement {
  const t = S('text', attrs);
  t.textContent = text;
  return t;
}

/** HTML 요소 */
export function H<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string | null,
  ...kids: (Child | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export type Stop = [offset: number, color: string, opacity?: number];

const stopEl = ([o, c, a]: Stop): SVGStopElement => S('stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 });

/** 미리 정한 재질 그라데이션 */
const PAINTS = {
  gold: [[0, '#fff3c4'], [0.3, '#e6c77a'], [0.62, '#b8923f'], [1, '#6e4f18']],
  goldFoil: [[0, '#8a6a2b'], [0.22, '#e6c77a'], [0.42, '#fff1c1'], [0.62, '#b8923f'], [0.82, '#e6c77a'], [1, '#8a6a2b']],
  silver: [[0, '#ffffff'], [0.35, '#d3dbdf'], [0.7, '#8d99a0'], [1, '#4a565c']],
  steel: [[0, '#dfe7ea'], [0.45, '#7d8b92'], [1, '#262e33']],
  ruby: [[0, '#ffa3b0'], [0.42, '#d7263d'], [1, '#4f0616']],
  goldFruit: [[0, '#fff3c4'], [0.42, '#f2b632'], [1, '#6e4a03']],
  leaf: [[0, '#d2f7b0'], [0.42, '#4fb86a'], [1, '#124d31']],
  silverLeaf: [[0, '#fbfdff'], [0.32, '#cfd8dc'], [0.6, '#8a979e'], [0.8, '#e6ecef'], [1, '#4f5c63']],
  leather: [[0, '#b8784a'], [0.5, '#6e3b1c'], [1, '#2e1608']],
  paper: [[0, '#fffbf1'], [0.6, '#efe3c6'], [1, '#c9b489']],
  glass: [[0, '#ffffff', 0.62], [0.45, '#dff6f4', 0.16], [1, '#8fd3cc', 0.4]],
  teal: [[0, '#d2fffa'], [0.42, '#2fd4c4'], [1, '#0a524c']],
  magenta: [[0, '#ffc9da'], [0.42, '#ff4f8b'], [1, '#6e0c35']],
  wood: [[0, '#e0a86e'], [0.5, '#9a5f2c'], [1, '#4f2c12']],
  purple: [[0, '#ecd4ff'], [0.42, '#8a4fd0'], [1, '#2e1052']],
  ink: [[0, '#434c48'], [1, '#0c0f0e']],
  brass: [[0, '#ffe9b0'], [0.4, '#c9a24a'], [1, '#553a0c']],
  cyan: [[0, '#ffffff'], [0.3, '#b5fbff'], [1, '#0fa3bd']],
  ice: [[0, '#ffffff'], [0.45, '#bfe6ff'], [1, '#4f86b8']],
  kraft: [[0, '#e2bf86'], [0.5, '#c29455'], [1, '#7f5a2a']],
  rubyEnamel: [[0, '#ff7a8a'], [0.5, '#b3122e'], [1, '#3d0310']],
  linen: [[0, '#fbf0d6'], [0.55, '#dcc596'], [1, '#8f7446']],
  emerald: [[0, '#b9ffd9'], [0.42, '#1fae7a'], [1, '#063d29']],
  blue: [[0, '#d6e4ff'], [0.42, '#3d7bff'], [1, '#0d2a78']],
} satisfies Record<string, Stop[]>;

export type PaintName = keyof typeof PAINTS;

let seq = 0;

/** SVG 한 장 + 그 SVG 전용 defs. id 는 문서 전체에서 겹치지 않게 접두사를 단다. */
export class Kit {
  readonly svg: SVGSVGElement;
  readonly defs: SVGDefsElement;
  readonly pre: string;
  private made = new Set<string>();

  constructor(tag: string, vbW: number, vbH: number, w?: number, h?: number, cls?: string) {
    seq = (seq + 1) % 2147483647;
    this.pre = `sa-${tag}${seq.toString(36)}`;
    this.svg = S('svg', {
      viewBox: `0 0 ${vbW} ${vbH}`,
      width: w,
      height: h,
      class: cls,
      'aria-hidden': 'true',
      focusable: 'false',
    });
    this.defs = S('defs');
    this.svg.appendChild(this.defs);
  }

  id(n: string): string {
    return `${this.pre}-${n}`;
  }
  url(n: string): string {
    return `url(#${this.id(n)})`;
  }

  add(...els: Child[]): this {
    for (const e of els) if (e) this.svg.appendChild(e);
    return this;
  }

  private once(n: string, make: () => Element): string {
    if (!this.made.has(n)) {
      this.made.add(n);
      const el = make();
      el.setAttribute('id', this.id(n));
      this.defs.appendChild(el);
    }
    return this.url(n);
  }

  lin(n: string, stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1, extra?: Attrs): string {
    return this.once(n, () => S('linearGradient', { x1, y1, x2, y2, ...(extra ?? {}) }, ...stops.map(stopEl)));
  }

  rad(n: string, stops: Stop[], cx = 0.5, cy = 0.5, r = 0.5, fx?: number, fy?: number, extra?: Attrs): string {
    return this.once(n, () => S('radialGradient', { cx, cy, r, fx, fy, ...(extra ?? {}) }, ...stops.map(stopEl)));
  }

  filter(n: string, kids: () => SVGElement[], attrs?: Attrs): string {
    return this.once(`f-${n}`, () =>
      S('filter', { x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB', ...(attrs ?? {}) }, ...kids()),
    );
  }

  blur(std: number): string {
    return this.filter(`blur${String(std).replace('.', '_')}`, () => [S('feGaussianBlur', { stdDeviation: std })]);
  }

  clip(n: string, ...kids: SVGElement[]): string {
    return this.once(`c-${n}`, () => S('clipPath', null, ...kids));
  }

  /** 재질 그라데이션. dir: d 대각, v 세로, h 가로, r 방사 */
  paint(name: PaintName, dir: 'd' | 'v' | 'h' | 'r' | 'u' = 'd'): string {
    const st = PAINTS[name] as Stop[];
    const key = `p-${name}-${dir}`;
    if (dir === 'r') return this.rad(key, st, 0.4, 0.34, 0.72, 0.34, 0.26);
    if (dir === 'v') return this.lin(key, st, 0, 0, 0, 1);
    if (dir === 'u') return this.lin(key, st, 0, 1, 0, 0);
    if (dir === 'h') return this.lin(key, st, 0, 0, 1, 0);
    return this.lin(key, st, 0.1, 0, 0.9, 1);
  }
}

/** 4각(또는 n각) 반짝이 별 경로 */
export function starPath(cx: number, cy: number, R: number, r: number, points = 4, rot = 0): string {
  const n = points * 2;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? R : r;
    d += `${i === 0 ? 'M' : 'L'}${fmt(cx + Math.cos(a) * rr)},${fmt(cy + Math.sin(a) * rr)}`;
  }
  return d + 'Z';
}

/** 잎 모양 (원점에서 +x 방향으로 len 만큼) */
export function leafPath(len: number, wid: number, bend = 0): string {
  const b = bend * len;
  return (
    `M0,0 C${fmt(len * 0.28)},${fmt(-wid - b)} ${fmt(len * 0.78)},${fmt(-wid * 0.78 - b)} ${fmt(len)},${fmt(-b * 1.2)} ` +
    `C${fmt(len * 0.76)},${fmt(wid * 0.72 - b)} ${fmt(len * 0.3)},${fmt(wid - b * 0.4)} 0,0Z`
  );
}

/** 점 목록을 매끈한 닫힌 곡선으로 (Catmull-Rom → 3차 베지어) */
export function smoothClosed(pts: [number, number][], tension = 1): string {
  const n = pts.length;
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d + 'Z';
}

export function polyPath(pts: [number, number][], close = true): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p[0])},${fmt(p[1])}`).join('') + (close ? 'Z' : '');
}

export const num = fmt;
