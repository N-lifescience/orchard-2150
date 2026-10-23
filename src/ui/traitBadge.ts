// Shared illustrated phenotype labels. Illustrations never assert a genotype.
import type { DeliveryGoal } from '../contract/game';
import type { Phenotype } from '../contract/genetics';
import { h } from './h';
export const EXPLAIN_ASSET_ROOT = 'explain/' as const;
export function explainImage(name: string, label = ''): HTMLImageElement {
  const img = h('img', { class: 'explain-image', src: `${EXPLAIN_ASSET_ROOT}${name}.webp`, alt: label, draggable: false });
  img.addEventListener('error', () => { img.hidden = true; });
  return img;
}
export function traitIllustrations(t: DeliveryGoal['trait']): [string, string][] {
  const images: [string, string][] = [];
  if (t.color) images.push([`trait-flesh-${t.color}`, '과육은 열매 안쪽의 먹는 부분이에요.']);
  if (t.marked !== undefined && t.species !== 'stella') images.push([t.marked ? 'trait-skin-star' : 'trait-skin-smooth', t.marked ? '별무늬는 열매 껍질의 별 모양 무늬예요.' : '매끈한 껍질에는 별무늬가 없어요.']);
  if (t.species === 'stella' && t.marked !== undefined) images.push([t.marked ? 'trait-leaf-silver' : 'trait-leaf-green', '별다래는 잎의 빛깔도 살펴봐요.']);
  if (t.sex) images.push([t.sex === 'F' ? 'trait-flower-female' : 'concept-cross', t.sex === 'F' ? '암그루는 암꽃이 피고 열매를 맺는 나무예요.' : '한 꽃에 암술과 수술이 함께 있어요.']);
  if (t.seedless !== undefined) images.push([t.seedless ? 'trait-fruit-seedless' : 'trait-fruit-seeded', t.seedless ? '게임에서 3배체 열매는 씨가 없어요.' : '열매 단면에 씨가 보여요.']);
  if (t.fluorescent) images.push(['trait-glow', '형광은 빛을 받아 다른 색의 빛을 내는 현상이에요.']);
  return images;
}
export function traitBadge(trait: DeliveryGoal['trait'], label: string, interactive = true, description?: string): HTMLElement {
  const illustrations = traitIllustrations(trait);
  const extra = [trait.seedless ? '3배체는 염색체 조가 세 벌인 상태예요.' : '', trait.euploid !== undefined ? '핵형은 염색체의 수와 모양을 정리한 모습이에요.' : '', trait.minBrix !== undefined ? '당도는 열매의 단맛을 나타내는 값이에요.' : '', trait.knockout ? '유전자 기능을 없앤 편집을 살펴봐요.' : '', trait.bitter === false ? '쓴맛이 없는 모종이 필요해요.' : ''].filter(Boolean);
  const explanation = [...illustrations.map(([, text]) => text), ...extra].join(' ') || (trait.euploid !== undefined
    ? '핵형은 염색체의 수와 모양을 정리한 모습이에요.'
    : trait.minBrix !== undefined ? '당도는 열매의 단맛을 나타내는 값이에요.' : '겉으로 관찰하는 형질이에요.');
  const detail = h('span', { class: 'trait-badge__meaning', hidden: true }, description ? `${description} ${explanation}` : explanation);
  const badge = h('span', { class: 'trait-badge', dataset: { color: trait.color },
    ...(interactive ? { role: 'button', tabindex: '0', 'aria-expanded': 'false', 'aria-label': `${label}, 뜻 보기` } : {}) },
    ...illustrations.map(([name]) => explainImage(name)),
    trait.euploid !== undefined ? h('span', { class: 'trait-badge__science', 'aria-hidden': 'true' }, '핵형') : null,
    trait.minBrix !== undefined ? h('span', { class: 'trait-badge__science', 'aria-hidden': 'true' }, `${trait.minBrix}+`) : null,
    h('span', null, label), interactive ? detail : null);
  const toggle = (e: Event) => { e.stopPropagation(); detail.hidden = !detail.hidden; badge.setAttribute('aria-expanded', String(!detail.hidden)); };
  if (interactive) {
    badge.addEventListener('click', toggle);
    badge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } if (e.key === 'Escape') { detail.hidden = true; badge.setAttribute('aria-expanded', 'false'); } });
    badge.addEventListener('blur', () => { detail.hidden = true; badge.setAttribute('aria-expanded', 'false'); });
  }
  return badge;
}
export function phenotypeBadge(p: Phenotype): HTMLElement {
  return traitBadge({ color: p.sex === 'M' ? undefined : p.color, marked: p.marked, species: p.species, seedless: p.seedless || undefined, fluorescent: p.fluorescent },
    p.sex === 'M' ? '수그루' : `${p.color === 'ruby' ? '루비' : '골드'} 과육`, false);
}
