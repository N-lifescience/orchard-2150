// 온실 보기 · 주문 정보 · 자손 덱 분포
import { bossEmblem, karyotype, orderEmblem, plantCard, suitGlyph } from '../../art';
import type { SuitKey } from '../../contract/genetics';
import { describeGenotype } from '../../genetics';
import { hasGlasses, lineageText, phenoSentence, plantView, speciesLabel } from '../cards';
import { podTable } from '../podstats';
import type { Ctx } from '../ctx';
import { h } from '../h';
import * as fmt from '../fmt';

const SUITS: SuitKey[] = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];

export function openGreenhouse(ctx: Ctx): void {
  const g = ctx.game;
  const s = g.state;
  const glasses = hasGlasses(s);
  ctx.modals.open({
    title: `온실 ${s.garden.length}/${s.gardenCap}`,
    kicker: '부모 개체들',
    className: 'modal--greenhouse',
    wide: true,
    content: h(
      'div',
      { class: 'gh' },
      ...s.garden.map((p) =>
        h(
          'article',
          { class: 'gh__item' },
          h('div', { class: 'gh__card' }, plantCard(plantView(p, { glasses }))),
          h(
            'div',
            { class: 'gh__text' },
            h('h3', { class: 'gh__name' }, p.name),
            h('div', { class: 'gh__meta' }, `${speciesLabel(p.pheno)} · ${p.generation}세대`),
            h('div', { class: 'gh__line' }, phenoSentence(p.pheno, p.pheno.brix)),
            h('div', { class: 'gh__line gh__lineage' }, lineageText(p, (id) => g.plantById(id))),
            h('div', { class: ['gh__geno', !p.revealed && 'is-hidden'] }, p.revealed ? `유전자형 ${describeGenotype(p.genome)}` : '유전자형 비공개 — 유전자 검사 키트로 볼 수 있어요'),
            h('div', { class: 'gh__karyo', 'aria-label': p.revealed ? '핵형' : '핵형 윤곽' }, karyotype(p.genome, { revealed: p.revealed, width: 220 })),
          ),
        ),
      ),
    ),
  });
}

export function openOrders(ctx: Ctx): void {
  const s = ctx.game.state;
  ctx.modals.open({
    title: `시즌 ${s.ante} 주문`,
    kicker: `시즌 ${s.ante} / ${s.maxAnte}`,
    className: 'modal--orders',
    wide: true,
    content: h(
      'div',
      { class: 'orders' },
      ...s.orders.map((o, i) =>
        h(
          'article',
          { class: ['orderbox', `orderbox--${o.kind}`, i === s.orderIdx && 'is-now', i < s.orderIdx && 'is-done'] },
          h('div', { class: 'orderbox__emblem', 'aria-hidden': 'true' }, o.kind === 'boss' && o.boss ? bossEmblem(o.boss, 88) : orderEmblem(o.kind === 'big' ? 'big' : 'small', 80, o.client)),
          h('h3', { class: 'orderbox__name' }, o.name),
          h('p', { class: 'orderbox__client' }, o.client),
          o.requestedColor ? h('p', { class: 'orderbox__request' }, `요청 과육: ${o.requestedColor === 'ruby' ? '루비빛' : '골드빛'} · 출하 시 +$2`) : null,
          h('div', { class: 'orderbox__target' }, h('span', { class: 'side__label' }, '목표'), h('b', { class: 'num' }, fmt.score(o.target))),
          h('div', { class: 'orderbox__reward' }, `보상 $${o.reward}`),
          o.boss ? h('p', { class: 'orderbox__rule' }, o.boss.desc) : null,
          i < s.orderIdx ? h('div', { class: 'orderbox__stamp' }, '완료') : i === s.orderIdx ? h('div', { class: 'orderbox__stamp is-now' }, '지금') : null,
        ),
      ),
    ),
  });
}

export function openPod(ctx: Ctx): void {
  const g = ctx.game;
  const s = g.state;
  const t = podTable(s.pod);
  const species = s.pod[0]?.genome.species ?? s.hand[0]?.genome.species ?? 'lumi';
  const cols: number[] = [];
  for (let b = t.min; b <= t.max; b++) cols.push(b);
  const peak = Math.max(1, ...SUITS.flatMap((su) => Object.values(t.grid[su])));
  const hasMale = SUITS.some((su) => t.male[su] > 0);
  const suitTotals = SUITS.map((su) => Object.values(t.grid[su]).reduce((a, b) => a + b, 0) + t.male[su]);
  ctx.modals.open({
    title: `자손 덱 — 남은 ${s.pod.length}/${s.podTotal}개체`,
    kicker: s.cross ? (s.cross.selfing ? '자가수분 자손 덱' : '교배 자손 덱') : '자손 덱',
    className: 'modal--pod',
    wide: true,
    content: h(
      'div',
      { class: 'podv' },
      h('p', { class: 'hint' }, '아직 뽑히지 않은 씨앗의 빛깔과 당도예요. 칸이 진할수록 많아요.'),
      h(
        'div',
        { class: 'podv__grid', role: 'table', 'aria-label': '빛깔별 당도 분포', style: { '--cols': cols.length + (hasMale ? 1 : 0) } },
        h('div', { class: 'podv__row podv__row--head', role: 'row' }, h('span', { class: 'podv__h', role: 'columnheader' }, '빛깔 \\ 당도'), ...cols.map((b) => h('span', { class: 'podv__h num', role: 'columnheader' }, String(b))), hasMale ? h('span', { class: 'podv__h', role: 'columnheader' }, '수그루') : null, h('span', { class: 'podv__h', role: 'columnheader' }, '합')),
        ...SUITS.map((su, si) =>
          h(
            'div',
            { class: 'podv__row', role: 'row' },
            h('span', { class: 'podv__suit', role: 'rowheader' }, suitGlyph(su, species, 20), g.suitName(su)),
            ...cols.map((b) => {
              const n = t.grid[su][b] ?? 0;
              return h('span', { class: ['podv__cell', n > 0 && 'is-on'], role: 'cell', style: { '--a': (n / peak).toFixed(2) }, 'aria-label': `당도 ${b}: ${n}개체` }, n > 0 ? String(n) : '');
            }),
            hasMale ? h('span', { class: ['podv__cell', 'podv__cell--male', t.male[su] > 0 && 'is-on'], role: 'cell' }, t.male[su] ? String(t.male[su]) : '') : null,
            h('span', { class: 'podv__sum num', role: 'cell' }, String(suitTotals[si])),
          ),
        ),
      ),
      h(
        'div',
        { class: 'podv__bars' },
        ...SUITS.map((su, si) =>
          h('div', { class: 'pbar' }, suitGlyph(su, species, 16), h('span', { class: 'pbar__track' }, h('span', { class: 'pbar__fill', style: { width: `${t.total ? Math.round((suitTotals[si] / t.total) * 100) : 0}%` } })), h('span', { class: 'pbar__v num' }, `${t.total ? Math.round((suitTotals[si] / t.total) * 100) : 0}%`)),
        ),
      ),
    ),
  });
}
