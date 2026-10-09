// Short, disposable card effects. They never touch the game RNG or block input.
import { h } from './h';
import { motion, play, rectIn, all } from './motion';
import { fx, between } from './rng';

type Tone = 'leaf' | 'chip' | 'mult' | 'gold';
const enabled = () => !motion.reduced && !motion.fast && !motion.skip;

export function impact(root: HTMLElement, target: Element, tone: Tone = 'leaf', strength = 1): void {
  if (!enabled()) return;
  const at = rectIn(target, root);
  const radius = Math.max(22, Math.min(72, at.w * .38));
  const ring = h('i', { class: ['fx-ring', `fx--${tone}`], 'aria-hidden': 'true', style: { left: `${at.cx}px`, top: `${at.cy}px`, width: `${radius * 2}px`, height: `${radius * 2}px` } });
  root.appendChild(ring);
  void play(ring, [{ opacity: .9, scale: '.25' }, { opacity: .65, scale: '1', offset: .3 }, { opacity: 0, scale: String(1.5 + strength * .3) }], { duration: 440, decorative: true }).then(() => ring.remove());
  const count = Math.round(5 + 7 * strength);
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 2 * i / count + between(fx, -.2, .2);
    const distance = between(fx, radius, radius + 45 * strength);
    const particle = h('i', { class: ['fx-pollen', `fx--${tone}`], 'aria-hidden': 'true', style: { left: `${at.cx}px`, top: `${at.cy}px` } });
    root.appendChild(particle);
    void play(particle, [
      { opacity: 0, translate: '0 0', scale: '.5' },
      { opacity: 1, offset: .15 },
      { opacity: 0, translate: `${Math.cos(angle) * distance}px ${Math.sin(angle) * distance}px`, scale: '.25', rotate: `${i * 45}deg` },
    ], { duration: 500 + i * 12, decorative: true }).then(() => particle.remove());
  }
}

export function scoreStream(root: HTMLElement, source: Element, destination: Element, tone: 'chip' | 'mult'): void {
  if (!enabled()) return;
  const from = rectIn(source, root), to = rectIn(destination, root);
  for (let i = 0; i < 3; i++) {
    const bead = h('i', { class: ['fx-bead', `fx--${tone}`], 'aria-hidden': 'true', style: { left: `${from.cx}px`, top: `${from.y + from.h * .3}px` } });
    root.appendChild(bead);
    const dx = to.cx - from.cx, dy = to.cy - from.y - from.h * .3;
    void play(bead, [
      { opacity: 0, translate: '0 0', scale: '.4' },
      { opacity: 1, translate: `${dx * .3}px ${dy * .35 - 35}px`, scale: '1.1', offset: .35 },
      { opacity: 0, translate: `${dx}px ${dy}px`, scale: '.25' },
    ], { duration: 410, delay: i * 35, decorative: true }).then(() => bead.remove());
  }
}

export async function contractSeal(root: HTMLElement, target: number, score: number): Promise<void> {
  const seal = h('div', { class: 'contract-seal', 'aria-hidden': 'true' },
    h('span', { class: 'contract-seal__mark' }, '✓'),
    h('span', { class: 'contract-seal__label' }, '주문한 형질 · 목표 점수 달성'),
    h('strong', null, '납품 완료'),
    h('span', { class: 'contract-seal__score' }, `${score.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}점`),
  );
  root.appendChild(seal);
  try {
    impact(root, seal, 'gold', 1.7);
    await all([
      play(seal, motion.reduced ? [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .85 }, { opacity: 0 }] : [
        { opacity: 0, translate: '0 -16px', scale: '.85' },
        { opacity: 1, translate: '0 0', scale: '1.04', offset: .22 },
        { opacity: 1, scale: '1', offset: .8 },
        { opacity: 0, translate: '0 -8px', scale: '1' },
      ], { duration: motion.reduced ? 520 : 1050, easing: 'linear' }),
    ]);
  } finally { seal.remove(); }
}
