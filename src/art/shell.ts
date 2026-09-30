// 카드류(모종·비법·시약·봉투) 공통 뼈대.
//  root  : UI 가 위치·idle 부유·배치용 transform 을 자유롭게 쓰는 바깥 상자 (그림 쪽은 transform 을 걸지 않는다)
//  body  : 들림·3D 기울기·흔들림을 받는 안쪽 상자 (::before 눈부심, ::after 광택 스윕)
//  face  : 실제 그림면
//  tilt  : 3×3 투명 칸. CSS :has(:hover) 만으로 마우스 쪽으로 기울게 한다. UI 가 --rx/--ry 를 주면 그 값이 이긴다.
import { H, Kit, S, P, G, starPath } from './dom';

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

/** 작은 아이콘들 (배지·유전자형 띠용) */
export function miniIcon(kind: 'leaf' | 'scissors' | 'lock' | 'glasses' | 'male' | 'seedless', size = 12): SVGSVGElement {
  const k = new Kit('mi', 16, 16, size, size, `sa-mini sa-mini--${kind}`);
  const cc = 'currentColor';
  switch (kind) {
    case 'leaf':
      k.add(
        P('M2.5,13.5 C2,7 6,2.5 13.5,2.5 C13.5,9 9.5,13.5 2.5,13.5Z', { fill: cc, opacity: 0.9 }),
        P('M3,13 C6,10 9,7 12,4', { stroke: '#ffffff', 'stroke-width': 0.9, fill: 'none', opacity: 0.7, 'stroke-linecap': 'round' }),
      );
      break;
    case 'scissors':
      k.add(
        G(
          { stroke: cc, 'stroke-width': 1.5, fill: 'none', 'stroke-linecap': 'round' },
          S('circle', { cx: 4, cy: 12, r: 2.3 }),
          S('circle', { cx: 12, cy: 12, r: 2.3 }),
          P('M5.6,10.3 L12.5,2 M10.4,10.3 L3.5,2'),
        ),
      );
      break;
    case 'lock':
      k.add(
        P('M4.8,7 V5.2 A3.2,3.2 0 0 1 11.2,5.2 V7', { stroke: cc, 'stroke-width': 1.6, fill: 'none' }),
        S('rect', { x: 3, y: 7, width: 10, height: 7.4, rx: 1.6, fill: cc }),
        S('circle', { cx: 8, cy: 10.3, r: 1.2, fill: '#f3ead6' }),
        S('rect', { x: 7.45, y: 10.6, width: 1.1, height: 2.2, fill: '#f3ead6' }),
      );
      break;
    case 'glasses':
      k.add(
        G(
          { stroke: cc, 'stroke-width': 1.3, fill: 'none' },
          S('circle', { cx: 4.3, cy: 9, r: 3.1 }),
          S('circle', { cx: 11.7, cy: 9, r: 3.1 }),
          P('M7.4,8.6 Q8,7.4 8.6,8.6 M1.2,8.4 L0.5,6.5 M14.8,8.4 L15.5,6.5'),
        ),
      );
      break;
    case 'male':
      k.add(
        G(
          { stroke: cc, 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' },
          S('circle', { cx: 6.5, cy: 9.5, r: 4.2 }),
          P('M9.5,6.5 L14,2 M10,2 H14 V6'),
        ),
      );
      break;
    case 'seedless':
      k.add(
        S('circle', { cx: 8, cy: 8, r: 6.4, fill: 'none', stroke: cc, 'stroke-width': 1.4 }),
        S('circle', { cx: 8, cy: 8, r: 3.6, fill: 'none', stroke: cc, 'stroke-width': 0.9, 'stroke-dasharray': '1.2 1.1' }),
      );
      break;
  }
  return k.svg;
}

/** 작은 반짝이 (장식) */
export function sparkle(size = 10, color = '#fff6d8'): SVGSVGElement {
  const k = new Kit('sp', 10, 10, size, size, 'sa-sparkle');
  k.add(P(starPath(5, 5, 4.8, 1.1, 4), { fill: color }));
  return k.svg;
}
