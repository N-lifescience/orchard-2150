// 게임 이름은 실제 글자로 그린다. 장식적인 SVG 문장 대신 읽히는 표제와 작은 재배 표식을 쓴다.
import { H } from './dom';

export function logo(): HTMLElement {
  const root = H('div', 'sa-logo');
  root.setAttribute('aria-label', '오차드 2150, 유전 육종 전략 게임');

  const masthead = H('div', 'sa-logo__masthead');
  masthead.appendChild(H('span', 'sa-logo__rule'));
  masthead.appendChild(H('span', 'sa-logo__eyebrow', 'ORCHARD / 2150'));
  masthead.appendChild(H('span', 'sa-logo__rule'));
  root.appendChild(masthead);

  const name = H('div', 'sa-logo__name');
  name.appendChild(H('span', 'sa-logo__word', '오차드'));
  name.appendChild(H('span', 'sa-logo__number', '2150'));
  root.appendChild(name);
  root.appendChild(H('div', 'sa-logo__subtitle', '유전 육종 전략 게임'));
  return root;
}
