// 끝 (gameover / victory) — 브랜드 연대기, 정체 공개(카드가 뒤집히며), 철학 성찰, [다시 하기] [타이틀]
import { audio } from '../../audio';
import { karyotype, plantCard } from '../../art';
import type { HandTypeId, RunState } from '../../contract/game';
import { describeGenotype } from '../../genetics';
import { HAND_RANK, HAND_TYPES, POLICIES } from '../../game';
import { lineageText, plantView, speciesLabel } from '../cards';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import * as fmt from '../fmt';
import { play, wait, motion } from '../motion';
import { loadReflection, saveReflection } from '../prefs';

export class EndScreen {
  readonly el: HTMLElement;
  private shownFor = '';
  onAgain: () => void = () => {};

  constructor(private ctx: Ctx) {
    this.el = h('div', { class: 'end-screen' });
  }

  show(s: RunState): void {
    const key = `${s.seed}:${s.phase}:${s.ante}:${s.orderIdx}`;
    if (key === this.shownFor) return;
    this.shownFor = key;
    const g = this.ctx.game;
    const win = s.phase === 'victory';
    audio.play(win ? 'victory' : 'gameOver');
    const pol = POLICIES.find((p) => p.id === s.policy);
    const evidence = s.policy === 'heritage'
      ? `기록: 교배 ${s.stats.crosses}번, 그중 자가수분 ${s.stats.selfings}번. 숨은 형질은 ${s.stats.recessiveSurprises}번 관찰했어요.`
      : s.policy === 'precision'
        ? `기록: 유전자 편집 ${s.stats.edits}번, 숨은 형질 관찰 ${s.stats.recessiveSurprises}번. 편집 횟수만으로 효과나 안전성을 판정할 수는 없어요.`
        : `기록: 유전자 편집 ${s.stats.edits}번, 꽃가루 유출 ${s.stats.lmoEvents}번. ${s.stats.lmoEvents ? '이번 플레이에서 유출 사건이 발생했어요.' : '이번 플레이에서는 유출 사건이 관찰되지 않았어요. 위험이 없다는 뜻은 아니에요.'}`;
    const question = s.policy === 'heritage'
      ? '자가수분과 선발로 얻은 이점은 무엇이었나요? 다양성에는 어떤 영향이 있을까요?'
      : s.policy === 'precision'
        ? '편집으로 얻은 형질을 어떻게 확인했나요? 실제 사용 전에 무엇을 더 확인해야 할까요?'
        : '형질전환의 이점과 꽃가루 유출 가능성을 함께 고려하면 어떤 관리가 필요할까요?';
    const counts = HAND_RANK.filter((id) => (s.stats.handCounts[id] ?? 0) > 0).map((id) => [id, s.stats.handCounts[id] ?? 0] as [HandTypeId, number]);
    const o = s.orders[s.orderIdx];
    const reveal = h('div', { class: 'reveal', role: 'list', 'aria-label': '정체 공개 — 온실 포기들의 실제 유전자형' });
    const reflectInput = h('textarea', { class: 'input reflect__input', rows: '2', maxlength: '200', placeholder: '이번 플레이의 기록 하나를 근거로 생각을 적어 보세요.', 'aria-label': '성찰 한 줄' });
    reflectInput.value = loadReflection();
    reflectInput.addEventListener('keydown', (e) => e.stopPropagation());
    const saved = h('span', { class: 'reflect__saved', 'aria-live': 'polite' });
    const saveBtn = button('이 기기에 적어 두기', () => {
      saveReflection(reflectInput.value);
      saved.textContent = '적어 두었어요 (이 기기에만).';
      audio.play('select');
    }, { class: 'btn--ghost' });
    replaceChildren(
      this.el,
      h(
        'header',
        { class: 'end__head' },
        h('div', { class: 'end__kicker' }, `${this.ctx.brand ? this.ctx.brand + ' ' : ''}브랜드 연대기`),
        h('h1', { class: ['end__title', win ? 'is-win' : 'is-lose'] }, win ? '2150 명품 박람회 우승!' : '연대기가 여기서 멈췄어요'),
        h('p', { class: 'end__sub' }, win ? '할머니의 온실이 전설이 되었어요.' : `시즌 ${s.ante} · ${o.name}에서 목표 ${fmt.score(o.target)}점 중 ${fmt.score(s.roundScore)}점을 냈어요.`),
      ),
      h(
        'div',
        { class: 'end__body' },
        h(
          'section',
          { class: 'end__stats panel' },
          h('h2', { class: 'h2' }, '기록'),
          h(
            'dl',
            { class: 'stats' },
            h('dt', null, '도달 시즌'),
            h('dd', { class: 'num' }, `${s.ante} / ${s.maxAnte}`),
            h('dt', null, '최고 출하 점수'),
            h('dd', { class: 'num' }, fmt.score(s.stats.bestHand)),
            h('dt', null, '출하'),
            h('dd', { class: 'num' }, `${s.stats.handsPlayed}번`),
            h('dt', null, '교배 · 자가수분'),
            h('dd', { class: 'num' }, `${s.stats.crosses} · ${s.stats.selfings}`),
            h('dt', null, '숨은 형질 등장'),
            h('dd', { class: 'num' }, `${s.stats.recessiveSurprises}번`),
            s.stats.edits ? h('dt', null, '유전자 편집') : null,
            s.stats.edits ? h('dd', { class: 'num' }, `${s.stats.edits}번`) : null,
            s.stats.lmoEvents ? h('dt', null, '꽃가루 유출') : null,
            s.stats.lmoEvents ? h('dd', { class: 'num' }, `${s.stats.lmoEvents}번`) : null,
            h('dt', null, '발견한 개념'),
            h('dd', { class: 'num' }, `${s.discoveries.length}개`),
          ),
          counts.length ? h('div', { class: 'end__hands' }, h('div', { class: 'bar__label' }, '족보별 횟수'), h('ul', null, ...counts.map(([id, n]) => h('li', null, h('span', null, HAND_TYPES[id].name), h('b', { class: 'num' }, `${n}`))))) : null,
        ),
        h(
          'section',
          { class: 'end__reveal panel' },
          h('h2', { class: 'h2' }, '정체 공개 — 온실 포기들의 진짜 유전자형'),
          reveal,
        ),
        h(
          'section',
          { class: 'end__reflect panel panel--gold' },
          h('h2', { class: 'h2' }, `브랜드 철학: ${pol?.name ?? ''}`),
          h('p', { class: 'hint' }, pol?.tradeoff ?? ''),
          h('p', { class: 'reflect__evidence' }, evidence),
          h('label', { class: 'reflect__q' }, question),
          reflectInput,
          h('div', { class: 'reflect__row' }, saveBtn, saved),
          h('p', { class: 'hint' }, '성찰은 이 기기 브라우저에만 남아요. 선생님께 보여 주거나 공책에 옮겨 적어요.'),
        ),
      ),
      h('footer', { class: 'end__btns' }, button('다시 하기', () => this.onAgain(), { class: 'btn--play btn--big', 'data-autofocus': '' }), button('타이틀', () => this.ctx.goTitle(), { class: 'btn--ghost btn--big' })),
    );
    void this.revealCards(s, reveal);
    void play(this.el.querySelector('.end__title'), [{ opacity: 0, scale: '0.6', letterSpacing: '0.4em' }, { opacity: 1, scale: '1', letterSpacing: '0.02em' }], { duration: 700 });
  }

  private async revealCards(s: RunState, box: HTMLElement): Promise<void> {
    const g = this.ctx.game;
    const items = s.garden.map((p) => {
      const v = plantView({ ...p, revealed: true }, { glasses: false, subtitle: lineageText(p, (id) => g.plantById(id)) });
      const front = h('div', { class: 'flip__front' }, plantCard(v));
      const back = h('div', { class: 'flip__back', 'aria-hidden': 'true' }, h('span', null, '?'));
      const flip = h('div', { class: 'flip' }, h('div', { class: 'flip__inner' }, back, front));
      const item = h(
        'div',
        { class: 'reveal__item', role: 'listitem' },
        flip,
        h(
          'div',
          { class: 'reveal__text' },
          h('b', null, p.name),
          h('span', null, speciesLabel(p.pheno)),
          h('span', { class: 'reveal__geno' }, describeGenotype(p.genome)),
          h('span', { class: 'reveal__line' }, lineageText(p, (id) => g.plantById(id))),
          h('span', { class: 'reveal__karyo' }, karyotype(p.genome, { revealed: true, width: 150 })),
          !p.revealed ? h('span', { class: 'reveal__new' }, '처음 공개') : null,
        ),
      );
      box.appendChild(item);
      return flip;
    });
    await wait(500);
    for (const f of items) {
      f.classList.add('is-open');
      audio.play('deal');
      if (!motion.reduced) void play(f, [{ scale: '1' }, { scale: '1.06' }, { scale: '1' }], { duration: 400, decorative: true });
      await wait(220);
    }
  }
}
