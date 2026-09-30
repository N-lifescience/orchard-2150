// 모종 카드 · 온실 부모 카드. 상아 종이 + 금박 테두리 + 길로셰(인증서 문양) + 과일 그림.
import type { CardView } from '../contract/art';
import type { SuitKey } from '../contract/genetics';
import { Kit, S, G, P, H, Txt, smoothClosed } from './dom';
import { fruitArt, describePheno } from './fruit';
import { plantImageUrl } from './plantImages';
import { suitGlyph } from './emblems';
import { shell, miniIcon } from './shell';

// 길로셰 로제트 — 한 번 계산해 모든 카드가 같은 경로 문자열을 쓴다
let guillocheCache: string[] | null = null;
function guilloche(): string[] {
  if (guillocheCache) return guillocheCache;
  const rings: [number, number, number, number][] = [
    // 반지름, 진폭, 물결 수, 위상
    [58, 5, 14, 0],
    [58, 5, 14, Math.PI],
    [44, 4, 18, 0],
    [44, 4, 18, Math.PI],
    [31, 3, 12, Math.PI / 2],
  ];
  guillocheCache = rings.map(([R, A, k, ph]) => {
    const pts: [number, number][] = [];
    const n = k * 7;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const rr = R + A * Math.sin(k * t + ph);
      pts.push([Math.cos(t) * rr, Math.sin(t) * rr]);
    }
    return smoothClosed(pts);
  });
  return guillocheCache;
}

const FOIL: [number, string][] = [
  [0, '#8a6a2b'],
  [0.2, '#e6c77a'],
  [0.38, '#fff1c1'],
  [0.55, '#b8923f'],
  [0.78, '#e6c77a'],
  [1, '#7a5a1f'],
];

function corner(foil: string): SVGGElement {
  return G(
    { fill: 'none', stroke: foil, 'stroke-linecap': 'round' },
    P('M3.5,23 C3.5,12 12,3.5 23,3.5', { 'stroke-width': 0.8 }),
    P('M3.5,23 C6.5,21 8,17.5 6.5,14.5 C5.5,12.5 8.5,11 9.8,13', { 'stroke-width': 0.75 }),
    P('M23,3.5 C21,6.5 17.5,8 14.5,6.5 C12.5,5.5 11,8.5 13,9.8', { 'stroke-width': 0.75 }),
    P('M9.5,5.5 L13,9 L9.5,12.5 L6,9Z', { fill: foil, stroke: 'none', transform: 'translate(0.5 -0.5)' }),
    S('circle', { cx: 28, cy: 3.5, r: 0.9, fill: foil, stroke: 'none' }),
    S('circle', { cx: 3.5, cy: 28, r: 0.9, fill: foil, stroke: 'none' }),
  );
}

function cardFrame(serial: string, plant: boolean): SVGSVGElement {
  const k = new Kit('cf', 200, 300, undefined, undefined, 'sa-frame');
  k.svg.setAttribute('preserveAspectRatio', 'none');
  const foil = k.lin('foil', FOIL, 0, 0, 1, 1);
  const foilV = k.lin('foilv', FOIL, 0, 0, 0, 1);
  const cy = plant ? 118 : 128;
  // 길로셰 (과일 뒤)
  k.add(G({ transform: `translate(100 ${cy})`, fill: 'none', stroke: '#a8823a', 'stroke-width': 0.4, opacity: 0.32 }, ...guilloche().map((d) => P(d))));
  k.add(S('circle', { cx: 100, cy, r: 66, fill: 'none', stroke: '#a8823a', 'stroke-width': 0.35, opacity: 0.3, 'stroke-dasharray': '1 2.2' }));
  // 바깥 금박 테
  k.add(S('rect', { x: 3.5, y: 3.5, width: 193, height: 293, rx: 13, fill: 'none', stroke: foil, 'stroke-width': 4.4 }));
  k.add(S('rect', { x: 1.6, y: 1.6, width: 196.8, height: 296.8, rx: 14.5, fill: 'none', stroke: '#4d3710', 'stroke-width': 0.6, opacity: 0.55 }));
  k.add(S('rect', { x: 6.3, y: 6.3, width: 187.4, height: 287.4, rx: 10.5, fill: 'none', stroke: '#5a4214', 'stroke-width': 0.6, opacity: 0.45 }));
  k.add(S('rect', { x: 10.5, y: 10.5, width: 179, height: 279, rx: 7, fill: 'none', stroke: foilV, 'stroke-width': 1 }));
  // 모서리 장식
  const place: [number, number, number, number][] = [
    [10.5, 10.5, 1, 1],
    [189.5, 10.5, -1, 1],
    [10.5, 289.5, 1, -1],
    [189.5, 289.5, -1, -1],
  ];
  for (const [x, y, sx, sy] of place) k.add(G({ transform: `translate(${x} ${y}) scale(${sx} ${sy})` }, corner(foil)));
  // 위 가운데 씨앗 문장
  k.add(S('rect', { x: 88, y: 7, width: 24, height: 8, fill: '#f3ead6' }));
  k.add(
    G(
      { transform: 'translate(100 11)' },
      P('M0,4.2 C-2.4,3 -2.6,-0.6 0,-2.6 C2.6,-0.6 2.4,3 0,4.2Z', { fill: foil, stroke: '#5a4214', 'stroke-width': 0.3 }),
      P('M0,-2.4 C-1,-5 -4,-5.6 -7,-4.6 C-5,-2.4 -2.4,-2 0,-2.4Z M0,-2.4 C1,-5 4,-5.6 7,-4.6 C5,-2.4 2.4,-2 0,-2.4Z', { fill: foil }),
      S('circle', { cx: -10.5, cy: 0, r: 0.9, fill: foil }),
      S('circle', { cx: 10.5, cy: 0, r: 0.9, fill: foil }),
    ),
  );
  // 유전자형 띠
  k.add(S('rect', { x: 16, y: 250, width: 168, height: 31, rx: 4.5, fill: '#1b1f1d', 'fill-opacity': 0.055, stroke: foil, 'stroke-width': 0.9 }));
  k.add(S('rect', { x: 18.5, y: 252.5, width: 163, height: 26, rx: 3, fill: 'none', stroke: '#a8823a', 'stroke-width': 0.35, opacity: 0.6 }));
  for (const x of [16, 184]) k.add(P(`M${x},259 L${x + (x < 100 ? -3.5 : 3.5)},265.5 L${x},272Z`, { fill: foil }));
  // 미세 문자 (인증서 느낌)
  k.add(
    Txt(
      { x: 100, y: 287.2, 'text-anchor': 'middle', 'font-size': 4.1, 'letter-spacing': 1.1, fill: '#8a6a2b', opacity: 0.8, 'font-family': 'Pretendard Variable, Pretendard, sans-serif' },
      `SEED ATELIER · MMCL · № ${serial}`,
    ),
  );
  return k.svg;
}

function suitKeyOf(v: CardView): SuitKey {
  return `${v.pheno.color}-${v.pheno.marked ? 'm' : 'p'}` as SuitKey;
}

function badge(cls: string, label: string, title: string, icon?: SVGSVGElement): HTMLElement {
  const b = H('span', `sa-badge ${cls}`);
  if (icon) b.appendChild(icon);
  b.appendChild(H('span', 'sa-badge__t', label));
  b.title = title;
  return b;
}

function badgesFor(v: CardView): HTMLElement | null {
  const p = v.pheno;
  const list: HTMLElement[] = [];
  if (p.sex === 'M') list.push(badge('sa-badge--male', '꽃만 핌', '수그루는 꽃만 피고 열매가 없어요', miniIcon('male')));
  if (p.seedless) list.push(badge('sa-badge--seedless', '씨 없음', '3배체라 씨가 없어요 (불임)', miniIcon('seedless')));
  if (p.giant) list.push(badge('sa-badge--giant', '4n 거대', '4배체라 크게 자라요'));
  if (p.bitter) list.push(badge('sa-badge--bitter', '쓴맛', '쓴맛 대립유전자(B)가 있어요'));
  if (p.fluorescent) list.push(badge('sa-badge--lmo', 'LMO', '형광 유전자를 넣은 유전자 변형 생물체(LMO)예요'));
  if (p.aneuploid) list.push(badge('sa-badge--aneu', '이상', p.aneuploidNote ? `염색체 수 이상(이수성): ${p.aneuploidNote}` : '염색체 수가 달라요(이수성)'));
  if (v.brixMod) {
    const up = v.brixMod > 0;
    const label = `${up ? '+' : '−'}${Math.abs(v.brixMod)} 환경`;
    list.push(badge(`sa-badge--env ${up ? 'is-up' : 'is-down'}`, label, '환경 효과예요. 자손에게 유전되지 않아요', miniIcon('leaf')));
  }
  if (!list.length) return null;
  const box = H('div', 'sa-card__badges');
  for (const b of list) box.appendChild(b);
  return box;
}

function genoBand(v: CardView): HTMLElement {
  const band = H('div', 'sa-card__geno');
  if (v.genotypeText) {
    band.classList.add('is-open');
    band.appendChild(H('span', 'sa-geno__text', v.genotypeText));
  } else if (v.partialGenotype) {
    band.classList.add('is-partial');
    band.appendChild(miniIcon('glasses'));
    band.appendChild(H('span', 'sa-geno__text', v.partialGenotype));
  } else {
    band.classList.add('is-hidden');
    band.appendChild(miniIcon('lock'));
    band.appendChild(H('span', 'sa-geno__text', '? ? ?'));
  }
  return band;
}

function buildCard(v: CardView, plant: boolean): HTMLElement {
  const p = v.pheno;
  const { root, body, face } = shell(plant ? 'sa-card sa-plant' : 'sa-card');
  root.dataset.uid = v.uid;
  root.dataset.color = p.color;
  root.dataset.species = p.species;
  root.dataset.suit = suitKeyOf(v);
  if (p.sex === 'M') root.classList.add('is-male');
  if (p.fluorescent) root.classList.add('is-lmo');
  if (v.debuffed) root.classList.add('is-debuffed');
  if (v.edited) root.classList.add('is-edited');

  const serial = String(((v.artSeed >>> 0) % 9000) + 1000);
  face.appendChild(cardFrame(serial, plant));

  // 당도
  const brix = H('div', 'sa-card__brix');
  if (p.sex === 'M' || v.brixShown === null) {
    brix.appendChild(H('span', 'sa-card__brixnum is-none', '—'));
  } else {
    brix.appendChild(H('span', 'sa-card__brixnum', String(v.brixShown)));
    brix.appendChild(H('span', 'sa-card__brixunit', '°Bx'));
    if (v.brixMod > 0) brix.classList.add('is-env-up');
    if (v.brixMod < 0) brix.classList.add('is-env-down');
  }
  face.appendChild(brix);

  const suit = H('div', 'sa-card__suit');
  suit.appendChild(suitGlyph(suitKeyOf(v), p.species, 24));
  face.appendChild(suit);

  if (v.edited) {
    const ed = H('div', 'sa-card__edited');
    ed.title = '유전자를 편집했어요';
    ed.appendChild(miniIcon('scissors'));
    face.appendChild(ed);
  }

  const art = H('div', 'sa-card__art');
  const illustration = document.createElement('img');
  illustration.src = plantImageUrl(p);
  illustration.alt = '';
  illustration.setAttribute('aria-hidden', 'true');
  illustration.decoding = 'async';
  illustration.draggable = false;
  illustration.addEventListener('error', () => {
    // A local SVG keeps cards usable if an image asset cannot load.
    illustration.replaceWith(fruitArt(p, v.artSeed, 120));
  }, { once: true });
  art.appendChild(illustration);
  face.appendChild(art);

  const badges = badgesFor(v);
  if (badges) face.appendChild(badges);

  if (plant) {
    const rib = H('div', 'sa-plant__ribbon');
    rib.appendChild(H('span', 'sa-plant__title', v.title ?? (p.species === 'stella' ? '별다래' : '루미')));
    face.appendChild(rib);
    if (v.subtitle) face.appendChild(H('div', 'sa-plant__subtitle', v.subtitle));
  }

  face.appendChild(genoBand(v));

  if (v.debuffed) {
    body.appendChild(H('div', 'sa-card__hatch'));
    const stamp = H('div', 'sa-card__stamp');
    stamp.appendChild(H('span', null, '무효'));
    body.appendChild(stamp);
  }

  const brixTxt = p.sex === 'M' || v.brixShown === null ? '열매 없음' : `당도 ${v.brixShown}°Bx`;
  const genoTxt = v.genotypeText ? `유전자형 ${v.genotypeText}` : v.partialGenotype ? `확실한 자리 ${v.partialGenotype}` : '유전자형 비공개';
  root.setAttribute('aria-label', `${plant && v.title ? v.title + ', ' : ''}${describePheno(p)}, ${brixTxt}, ${genoTxt}${v.debuffed ? ', 무효' : ''}`);
  return root;
}

export function seedCard(v: CardView): HTMLElement {
  return buildCard(v, false);
}

export function plantCard(v: CardView): HTMLElement {
  return buildCard(v, true);
}
