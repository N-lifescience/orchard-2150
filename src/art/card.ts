// 모종 카드 · 온실 부모 카드. 상아 종이 + 금박 테두리 + 길로셰(인증서 문양) + 과일 그림.
import type { CardView } from '../contract/art';
import type { SuitKey } from '../contract/genetics';
import { H } from './dom';
import { cardFrame } from './raster';
import { characterName, characterPortrait } from './characters';
import { describePheno } from './fruit';
import { plantImageUrl } from './plantImages';
import { suitGlyph } from './emblems';
import { shell, miniIcon } from './shell';

function suitKeyOf(v: CardView): SuitKey {
  return `${v.pheno.color}-${v.pheno.marked ? 'm' : 'p'}` as SuitKey;
}

function badge(cls: string, label: string, title: string, icon?: HTMLElement): HTMLElement {
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
    band.appendChild(H('span', 'sa-geno__text', '유전자형 · 검사 전'));
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

  face.appendChild(cardFrame());

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
    illustration.replaceWith(H('span', 'sa-card__missing', '그림을 불러오지 못했어요.'));
  }, { once: true });
  art.appendChild(illustration);
  face.appendChild(art);

  const copy = H('div', 'sa-card__copy');
  const species = p.species === 'stella' ? `별다래 ${p.sex === 'M' ? '수그루' : '암그루'}` : '루미';
  if (plant) {
    if (v.title && characterName(v.title)) {
      const owner = characterPortrait(v.title, 32);
      owner.classList.add('sa-plant__owner');
      face.appendChild(owner);
    }
    const rib = H('div', 'sa-plant__ribbon');
    rib.appendChild(H('span', 'sa-plant__title', v.title ?? (p.species === 'stella' ? '별다래' : '루미')));
    copy.appendChild(rib);
    if (v.subtitle) copy.appendChild(H('div', 'sa-plant__subtitle', v.subtitle));
  } else {
    copy.appendChild(H('div', 'sa-card__species', species));
  }
  const traits = [p.sex === 'M' ? `${p.color === 'ruby' ? '루비' : '골드'} 꽃잎` : `${p.color === 'ruby' ? '루비' : '골드'} 과육`,
    p.species === 'stella' ? p.marked ? '은빛 잎' : '초록 잎' : p.marked ? '별무늬' : '매끈한 껍질'];
  copy.appendChild(H('p', 'sa-card__traits', traits.join(' · ')));
  const badges = badgesFor(v);
  if (badges) copy.appendChild(badges);
  face.appendChild(copy);
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
