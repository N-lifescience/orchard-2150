import type { PackKind } from '../contract/game';
import { H } from './dom';
import { shell, priceTag } from './shell';
import { atlases, cardFrame, sprite } from './raster';

const PACKS: Record<PackKind, { name: string; index: number; hint: string }> = {
  seed: { name: '씨앗 봉투', index: 0, hint: '새로운 부모 품종' },
  rareSeed: { name: '희귀 씨앗 봉투', index: 1, hint: '특별한 형질의 품종' },
  reagent: { name: '시약 상자', index: 2, hint: '교배를 돕는 연구 도구' },
  medal: { name: '메달 상자', index: 3, hint: '족보의 점수 강화' },
  joker: { name: '비법 두루마리', index: 4, hint: '계속 적용되는 육종 비법' },
};

export function packArt(kind: PackKind, opts?: { price?: number }): HTMLElement {
  const def = PACKS[kind];
  const { root, body, face } = shell('sa-pack sa-pack--' + kind);
  root.dataset.pack = kind;
  face.appendChild(cardFrame());
  face.appendChild(sprite(atlases.utility, def.index, 140, def.name, 'sa-pack__art'));
  face.appendChild(H('div', 'sa-pack__label', def.name));
  face.appendChild(H('div', 'sa-pack__kind', def.hint));
  if (opts?.price !== undefined) body.appendChild(priceTag(opts.price));
  root.setAttribute('aria-label', def.name + (opts?.price !== undefined ? ', 가격 $' + opts.price : ''));
  return root;
}
