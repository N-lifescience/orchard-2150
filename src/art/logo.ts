// 타이틀 로고: 싹 튼 씨앗 문장(紋章) + 금박 글자 + '2 1 5 0'
import { Kit, S, G, P, H, starPath, leafPath, num } from './dom';

function crest(): SVGSVGElement {
  const k = new Kit('lg', 120, 120, undefined, undefined, 'sa-logo__crest');
  const foil = k.lin('foil', [[0, '#fff1c1'], [0.3, '#e6c77a'], [0.6, '#b8923f'], [1, '#6e4f18']], 0.15, 0, 0.85, 1);
  const glowF = k.filter('gw', () => [
    S('feGaussianBlur', { stdDeviation: 2.2, result: 'b' }),
    S('feMerge', null, S('feMergeNode', { in: 'b' }), S('feMergeNode', { in: 'SourceGraphic' })),
  ]);
  k.add(S('circle', { cx: 60, cy: 60, r: 56, fill: k.rad('halo', [[0, '#2fd4c4', 0.28], [0.7, '#2fd4c4', 0.06], [1, '#2fd4c4', 0]]) }));
  k.add(S('circle', { cx: 60, cy: 60, r: 44, fill: k.rad('en', [[0, '#1e5a50'], [0.6, '#0b2a26'], [1, '#040f0d']], 0.45, 0.38, 0.7), stroke: foil, 'stroke-width': 2.6 }));
  k.add(S('circle', { cx: 60, cy: 60, r: 39.5, fill: 'none', stroke: foil, 'stroke-width': 0.7, opacity: 0.8 }));
  const beads = G({ fill: '#e6c77a', opacity: 0.8 });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    beads.appendChild(S('circle', { cx: 60 + Math.cos(a) * 47.8, cy: 60 + Math.sin(a) * 47.8, r: 0.8 }));
  }
  k.add(beads);
  // 월계 가지
  const laurel = G(null);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + side * (0.45 + i * 0.3);
      const x = 60 + Math.cos(a) * 52.5;
      const y = 60 + Math.sin(a) * 52.5;
      const deg = (a * 180) / Math.PI + (side > 0 ? 115 : -115);
      laurel.appendChild(G({ transform: `translate(${num(x)} ${num(y)}) rotate(${num(deg)})` }, P(leafPath(10, 3.4, 0), { fill: foil, stroke: '#4d3710', 'stroke-width': 0.4 })));
    }
  }
  k.add(laurel);
  // 싹 튼 씨앗
  k.add(S('ellipse', { cx: 60, cy: 84, rx: 18, ry: 3, fill: '#000000', opacity: 0.35 }));
  k.add(
    G(
      { filter: glowF },
      P('M60,52 C58,44 56,38 57,31', { stroke: '#7de0a0', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }),
      G({ transform: 'translate(57 33) rotate(-150)' }, P(leafPath(19, 7.5, 0.05), { fill: k.lin('lf', [[0, '#d2fff0'], [0.45, '#2fd4c4'], [1, '#0a524c']], 0.1, 0, 0.9, 1), stroke: '#063a34', 'stroke-width': 0.7 })),
      G({ transform: 'translate(57.5 32) rotate(-28)' }, P(leafPath(22, 8.4, -0.05), { fill: k.lin('lf2', [[0, '#e6ffd0'], [0.45, '#4fd48a'], [1, '#0d4a2a']], 0.1, 0, 0.9, 1), stroke: '#063a24', 'stroke-width': 0.7 })),
    ),
  );
  k.add(P('M48,54 C53,49 57,49 57.5,53 M72,54 C67,49 63,49 62.5,53', { stroke: '#2fd4c4', 'stroke-width': 0.8, fill: 'none', opacity: 0.6 }));
  k.add(P('M60,86 C47,81 45,63 60,52 C75,63 73,81 60,86Z', { fill: k.rad('seed', [[0, '#fff3c4'], [0.45, '#e6c77a'], [1, '#6e4f18']], 0.38, 0.3, 0.8), stroke: '#3d2a0a', 'stroke-width': 1 }));
  k.add(P('M60,55 C56.5,64 56.5,76 60,84', { stroke: '#6e4f18', 'stroke-width': 0.9, fill: 'none', opacity: 0.8 }));
  k.add(P('M52,64 C52,60 54.5,57 57,55.5', { stroke: '#ffffff', 'stroke-width': 1.4, fill: 'none', opacity: 0.75, 'stroke-linecap': 'round' }));
  for (const [x, y, s] of [[60, 17, 4.2], [38, 27, 2.2], [82, 27, 2.2], [30, 46, 1.6], [90, 46, 1.6]] as [number, number, number][])
    k.add(P(starPath(x, y, s, s * 0.26, 4), { fill: '#fff3c8' }));
  return k.svg;
}

export function logo(): HTMLElement {
  const root = H('div', 'sa-logo');
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', '씨앗 아틀리에 2150');
  const c = crest();
  root.appendChild(c);
  const title = H('div', 'sa-logo__title');
  title.appendChild(H('span', 'sa-logo__word', '씨앗'));
  title.appendChild(H('span', 'sa-logo__word', '아틀리에'));
  title.setAttribute('aria-hidden', 'true');
  root.appendChild(title);
  const year = H('div', 'sa-logo__year');
  year.setAttribute('aria-hidden', 'true');
  year.appendChild(H('span', 'sa-logo__rule'));
  year.appendChild(H('span', 'sa-logo__num', '2 1 5 0'));
  year.appendChild(H('span', 'sa-logo__rule'));
  root.appendChild(year);
  return root;
}
