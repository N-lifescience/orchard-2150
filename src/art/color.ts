// 색 계산 도우미 + 팔레트 (CSS 변수와 같은 값)

export const PAL = {
  ivory: '#f3ead6',
  ink: '#1b1f1d',
  chip: '#2fd4c4',
  mult: '#ff4f8b',
  foil: ['#8a6a2b', '#e6c77a', '#b8923f'] as const,
  ruby: ['#7a0d24', '#d7263d', '#ff7a8a'] as const,
  gold: ['#9a6a06', '#f2b632', '#ffe9a3'] as const,
};

export function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 채도 배율 s, 명도 덧셈 l, 색상 회전 h(도) */
export function adjust(hex: string, o: { s?: number; l?: number; h?: number }): string {
  const [r, g, b] = hexToRgb(hex);
  let [H, S, L] = rgbToHsl(r, g, b);
  if (o.s !== undefined) S = Math.max(0, Math.min(1, S * o.s));
  if (o.l !== undefined) L = Math.max(0, Math.min(1, L + o.l));
  if (o.h !== undefined) H += o.h;
  const [R, G2, B] = hslToRgb(H, S, L);
  return rgbToHex(R, G2, B);
}
