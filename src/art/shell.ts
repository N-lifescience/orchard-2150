// 카드류(모종·비법·시약·봉투) 공통 뼈대.
//  root  : UI 가 위치·idle 부유·배치용 transform 을 자유롭게 쓰는 바깥 상자 (그림 쪽은 transform 을 걸지 않는다)
//  body  : 들림·3D 기울기·흔들림을 받는 안쪽 상자 (::before 눈부심, ::after 광택 스윕)
//  face  : 실제 그림면
//  tilt  : 3×3 투명 칸. CSS :has(:hover) 만으로 마우스 쪽으로 기울게 한다. UI 가 --rx/--ry 를 주면 그 값이 이긴다.
import { H } from './dom';

export interface Shell {
  root: HTMLElement;
  body: HTMLElement;
  face: HTMLElement;
}

export function shell(rootCls: string): Shell {
  const root = H('div', `${rootCls} sa-tiltable`);
  const body = H('div', 'sa-body');
  const face = H('div', 'sa-face');
  body.appendChild(face);
  root.appendChild(body);
  const zones = H('div', 'sa-tilt');
  zones.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 9; i++) zones.appendChild(H('i'));
  root.appendChild(zones);
  return { root, body, face };
}

/** 매달린 가격표 */
export function priceTag(price: number): HTMLElement {
  const tag = H('div', 'sa-price');
  tag.appendChild(H('span', 'sa-price__cur', '$'));
  tag.appendChild(H('span', 'sa-price__num', String(price)));
  tag.setAttribute('aria-label', `가격 ${price}달러`);
  return tag;
}

/** Small functional marks use typography, not decorative SVG drawings. */
export function miniIcon(kind: 'leaf' | 'scissors' | 'lock' | 'glasses' | 'male' | 'seedless', size = 12): HTMLElement {
  const marks = { leaf: '↟', scissors: '✂', lock: '▣', glasses: '◎', male: '♂', seedless: '∅' };
  const el = H('span', 'sa-mini sa-mini--' + kind, marks[kind]);
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = size + 'px';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function sparkle(size = 10, color = '#fff6d8'): HTMLElement {
  const el = H('span', 'sa-sparkle', '✦');
  el.style.fontSize = size + 'px';
  el.style.color = color;
  el.setAttribute('aria-hidden', 'true');
  return el;
}
