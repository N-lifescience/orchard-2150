// Scientific diagrams remain driven by actual chromosome copies, not generated art.
import type { Genome, HomologGroup, ChromosomeCopy } from '../contract/genetics';

const GROUPS: HomologGroup[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'sex'];
const LEN: Record<string, number> = { c1: 34, c2: 31, c3: 28, c4: 25, c5: 22, X: 30, Y: 15 };
const CEN: Record<string, number> = { c1: .42, c2: .36, c3: .46, c4: .3, c5: .4, X: .38, Y: .35 };
const COLOR: Record<string, string> = { c1: '#2fd4c4', c2: '#4fb86a', c3: '#e0b52c', c4: '#5a8cff', c5: '#9a6ae0', X: '#ff4f8b', Y: '#3aa0ff' };
const SLOT = 12;
function alleleColor(a: string): string {
  if (a.includes('*ko')) return '#8a8f8c';
  if (a.startsWith('T')) return '#6ff7ff';
  if (/^Q\d\+/.test(a)) return '#fff3a0';
  if (/^Q\d/.test(a)) return '#5a4a2a';
  return ({ R: '#d7263d', r: '#f2b632', S: '#fff6d8', s: '#3a3a3a', B: '#5a6a1a', b: '#d8d0a8', L: '#e6eef1', l: '#2e8a4a' } as Record<string, string>)[a] ?? '#f3ead6';
}

function drawCopy(ctx: CanvasRenderingContext2D, x: number, kind: string, copy: ChromosomeCopy, revealed: boolean): void {
  const cenY = 20;
  const length = LEN[kind] ?? 26;
  const top = cenY - length * (CEN[kind] ?? .4);
  const bottom = cenY + length * (1 - (CEN[kind] ?? .4));
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.7;
  ctx.strokeStyle = revealed ? COLOR[kind] ?? COLOR.c1 : '#8d9794';
  ctx.globalAlpha = revealed ? 1 : .65;
  ctx.beginPath();
  if (kind === 'Y') {
    ctx.moveTo(x - 3.2, top);
    ctx.quadraticCurveTo(x - .8, cenY - 1, x, cenY + 1);
    ctx.moveTo(x + 3.2, top);
    ctx.quadraticCurveTo(x + .8, cenY - 1, x, cenY + 1);
    ctx.moveTo(x, cenY);
    ctx.lineTo(x, bottom);
  } else {
    const spread = kind === 'X' ? 3.9 : 3.5;
    ctx.moveTo(x - spread, top);
    ctx.quadraticCurveTo(x + .9, cenY, x - spread, bottom);
    ctx.moveTo(x + spread, top);
    ctx.quadraticCurveTo(x - .9, cenY, x + spread, bottom);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (!revealed) return;
  const alleles = Object.values(copy.alleles ?? {}).filter((a): a is string => typeof a === 'string');
  alleles.forEach((allele, i) => {
    const t = .18 + (i + 1) / (alleles.length + 1) * .72;
    const y = cenY + (bottom - cenY) * t;
    const u = .5 + .5 * t;
    const spread = kind === 'X' ? 3.9 : 3.5;
    const off = kind === 'Y' ? 0 : Math.abs(-spread * ((1 - u) ** 2 + u ** 2) + .9 * 2 * u * (1 - u));
    ctx.strokeStyle = alleleColor(allele);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'butt';
    for (const center of kind === 'Y' ? [x] : [x - off, x + off]) {
      ctx.beginPath();
      ctx.moveTo(center - 1.15, y);
      ctx.lineTo(center + 1.15, y);
      ctx.stroke();
    }
  });
}

export function karyotype(genome: Genome, opts?: { revealed?: boolean; width?: number }): HTMLCanvasElement {
  const revealed = opts?.revealed ?? true;
  const groups = GROUPS.map((group) => ({ group, copies: genome.chromosomes[group] ?? [] })).filter(({ copies }) => copies.length > 0);
  const gap = 7;
  const worldWidth = Math.max(40, 12 + groups.reduce((sum, { copies }) => sum + copies.length * SLOT + gap, 0) - gap);
  const width = opts?.width ?? 220;
  const height = width * 58 / worldWidth;
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.max(1, Math.min(3, globalThis.devicePixelRatio || 1));
  canvas.width = Math.ceil(width * pixelRatio);
  canvas.height = Math.ceil(height * pixelRatio);
  canvas.style.width = width + 'px';
  canvas.style.aspectRatio = width + ' / ' + height;
  canvas.className = 'sa-karyo' + (revealed ? '' : ' is-hidden');
  const total = groups.reduce((sum, { copies }) => sum + copies.length, 0);
  const odd = groups.filter(({ copies }) => copies.length !== genome.ploidy).map(({ group }) => group === 'sex' ? '성염색체' : group.slice(1) + '번');
  const label = '핵형: 염색체 ' + total + '개, ' + genome.ploidy + '배체' + (odd.length ? ', 수가 다른 염색체: ' + odd.join(', ') : '');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.textContent = label;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(canvas.width / worldWidth, canvas.height / 58);
  let x = 6 + SLOT / 2;
  for (const { group, copies } of groups) {
    const left = x - SLOT / 2;
    const sorted = copies.map((copy) => ({ kind: group === 'sex' ? copy.kind === 'Y' ? 'Y' : 'X' : group, copy }));
    if (group === 'sex') sorted.sort((a, b) => a.kind === b.kind ? 0 : a.kind === 'X' ? -1 : 1);
    for (const { kind, copy } of sorted) { drawCopy(ctx, x, kind, copy, revealed); x += SLOT; }
    ctx.strokeStyle = ctx.fillStyle = copies.length !== genome.ploidy ? '#ff4f8b' : '#c9b98f';
    ctx.lineWidth = .8;
    ctx.beginPath();
    ctx.moveTo(left + 1, 47);
    ctx.lineTo(x - SLOT / 2 - 1, 47);
    ctx.stroke();
    ctx.font = '700 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(group === 'sex' ? sorted.map(({ kind }) => kind).join('') : group.slice(1) + '번', (left + x - SLOT / 2) / 2, 55);
    x += gap;
  }
  return canvas;
}
