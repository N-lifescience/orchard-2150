// 계약 재검토와 연대기 종료 — 관찰 근거, 실제 유전자형, 성찰, 로컬 보고서.
import { audio } from '../../audio';
import { karyotype, plantCard } from '../../art';
import type { HandTypeId, OrderRecord, PredictionRecord, RunState } from '../../contract/game';
import { describeGenotype } from '../../genetics';
import { HAND_RANK, HAND_TYPES, POLICIES } from '../../game';
import { lineageText, plantView, speciesLabel } from '../cards';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import * as fmt from '../fmt';
import { play, wait, motion } from '../motion';
import { loadRunReflection, saveRunReflection } from '../runSlots';

function predictionText(p: PredictionRecord): string {
  const choice = p.choice === 'ruby' ? '루비가 더 많다' : p.choice === 'gold' ? '골드가 더 많다' : '두 빛깔이 비슷하다';
  return `예측: ${choice}. 관찰: 루비 ${p.ruby}알, 골드 ${p.gold}알.`;
}

function predictionContrastsObservation(p: PredictionRecord): boolean {
  return p.choice === 'ruby' && p.gold > p.ruby || p.choice === 'gold' && p.ruby > p.gold;
}

function recordTitle(r: OrderRecord): string {
  return `시즌 ${r.ante} · 계약 ${r.orderIdx + 1} · ${r.name} · ${r.attempt}차 시도`;
}

function evidenceRecord(s: RunState): OrderRecord | undefined {
  return [...s.records].reverse().find((r) => r.cleared && r.attempt > 1) ?? s.records.find((r) => r.prediction && predictionContrastsObservation(r.prediction)) ?? [...s.records].reverse().find((r) => r.prediction) ?? s.records.at(-1);
}

export class EndScreen {
  readonly el: HTMLElement;
  private shownFor = '';
  onAgain: () => void = () => {};

  constructor(private ctx: Ctx) {
    this.el = h('div', { class: 'end-screen' });
  }

  show(s: RunState): void {
    const key = `${this.ctx.game.getSaveKey()}:${s.seed}:${s.phase}:${s.ante}:${s.orderIdx}:${s.orderAttempt}:${s.records.length}`;
    if (key === this.shownFor) return;
    this.shownFor = key;
    if (s.phase === 'review') {
      this.showReview(s);
      return;
    }
    this.el.classList.remove('end-screen--review');
    const win = s.phase === 'victory';
    audio.play(win ? 'victory' : 'gameOver');
    const pol = POLICIES.find((p) => p.id === s.policy);
    const policyEvidence = s.geneFlow
      ? `최근 꽃가루 유출: ${s.geneFlow.donor}에서 ${s.geneFlow.recipient}로 전달됐고, 자손 씨 표본에서 형광 형질을 관찰했습니다. 수분받은 성체의 유전자형은 그대로입니다.`
      : s.policy === 'heritage'
      ? `교배 ${s.stats.crosses}번 중 자가수분은 ${s.stats.selfings}번이었고, 두 부모에 없던 형질은 ${s.stats.recessiveSurprises}번 나타났습니다.`
      : `편집 ${s.stats.edits}번, 꽃가루 유출 ${s.stats.lmoEvents}번을 기록했습니다. 얻은 형질과 관리에 든 비용을 함께 돌아보세요.`;
    const counts = HAND_RANK.filter((id) => (s.stats.handCounts[id] ?? 0) > 0).map((id) => [id, s.stats.handCounts[id] ?? 0] as [HandTypeId, number]);
    const order = s.orders[s.orderIdx];
    const record = evidenceRecord(s);
    const earlier = record && record.attempt > 1 ? s.records.find((r) => r.ante === record.ante && r.orderIdx === record.orderIdx && r.attempt < record.attempt) : undefined;
    const reveal = h('div', { class: 'reveal', role: 'list', 'aria-label': '온실 포기들의 실제 유전자형' });
    const reflectInput = h('textarea', { class: 'input reflect__input', rows: '3', maxlength: '200', placeholder: '관찰한 숫자 하나와 다음에 바꿀 선택을 함께 적어 보세요.', 'aria-label': '이 연대기의 성찰' });
    const saveKey = this.ctx.game.getSaveKey();
    reflectInput.value = loadRunReflection(saveKey);
    reflectInput.addEventListener('keydown', (e) => e.stopPropagation());
    const saved = h('span', { class: 'reflect__saved', 'aria-live': 'polite' });
    const saveWriting = () => {
      reflectInput.value = saveRunReflection(saveKey, reflectInput.value);
      saved.textContent = '이 연대기에 적어 두었습니다.';
      return reflectInput.value;
    };
    replaceChildren(this.el,
      h('header', { class: 'end__head' },
        h('div', { class: 'end__kicker' }, `${this.ctx.brand ? this.ctx.brand + ' · ' : ''}${s.playStyle === 'learning' ? '수업 모드' : '도전 모드'} 플레이 기록`),
        h('h1', { class: ['end__title', win ? 'is-win' : 'is-lose'] }, win ? '마지막 계약까지 완수했어요' : '이번 도전은 여기까지예요'),
        h('p', { class: 'end__sub' }, win ? '모든 계약의 점수와 납품 조건을 충족했습니다. 기록을 근거로 선택을 돌아보세요.' : `시즌 ${s.ante}의 ${order.name}: 목표 ${fmt.score(order.target)}점, 획득 ${fmt.score(s.roundScore)}점. ${s.review?.reason ?? ''}`),
      ),
      h('div', { class: 'end__body' },
        h('section', { class: 'end__stats panel' },
          h('h2', { class: 'h2' }, '플레이 기록'),
          h('dl', { class: 'stats' },
            h('dt', null, '도달 시즌'), h('dd', { class: 'num' }, `${s.ante} / ${s.maxAnte}`),
            h('dt', null, '계약 완료'), h('dd', { class: 'num' }, `${s.records.filter((r) => r.cleared).length}건`),
            h('dt', null, '재도전'), h('dd', { class: 'num' }, `${s.stats.retries}번`),
            h('dt', null, '최고 출하 점수'), h('dd', { class: 'num' }, fmt.score(s.stats.bestHand)),
            h('dt', null, '출하'), h('dd', { class: 'num' }, `${s.stats.handsPlayed}번`),
            h('dt', null, '교배 · 자가수분'), h('dd', { class: 'num' }, `${s.stats.crosses} · ${s.stats.selfings}`),
            h('dt', null, '숨은 형질 등장'), h('dd', { class: 'num' }, `${s.stats.recessiveSurprises}번`),
            h('dt', null, '발견한 개념'), h('dd', { class: 'num' }, `${s.discoveries.length}개`),
          ),
          counts.length ? h('div', { class: 'end__hands' }, h('div', { class: 'bar__label' }, '족보별 횟수'), h('ul', null, ...counts.map(([id, n]) => h('li', null, h('span', null, HAND_TYPES[id].name), h('b', { class: 'num' }, `${n}`))))) : null,
          h('p', { class: 'hint' }, '완료한 연대기도 홈에서 다시 열 수 있습니다.'),
        ),
        h('section', { class: 'end__reveal panel' }, h('h2', { class: 'h2' }, '추론과 실제 유전자형 비교'), reveal),
        h('section', { class: 'end__reflect panel panel--gold' },
          h('h2', { class: 'h2' }, '기록을 근거로 돌아보기'),
          record ? h('div', { class: 'reflect__evidence' }, h('b', null, `시즌 ${record.ante} · ${record.name}`), h('p', null, record.prediction ? predictionText(record.prediction) : `획득 ${fmt.score(record.score)}점 / 목표 ${fmt.score(record.target)}점.`), h('p', null, ...record.goals.map((goal) => `${goal.label} ${record.delivery[goal.id] ?? 0}/${goal.count} · `))) : null,
          earlier && record ? h('p', { class: 'hint' }, `첫 시도 ${fmt.score(earlier.score)}점 → ${record.attempt}차 시도 ${fmt.score(record.score)}점. 기록에서 바꾼 선택을 찾아보세요.`) : null,
          h('ol', { class: 'debrief-prompts' },
            h('li', null, '부모의 유전자형으로 관찰한 비율을 어떻게 설명할 수 있나요?'),
            h('li', null, '같은 계약을 다시 맡으면 부모 선택이나 출하를 무엇부터 바꾸겠어요?'),
            h('li', null, `${pol?.name ?? '운영 방식'}에서 얻은 이점과 감수한 대가는 무엇인가요?`),
          ),
          h('p', { class: 'hint' }, policyEvidence),
          reflectInput,
          h('div', { class: 'reflect__row' }, button('이 연대기에 적어 두기', () => { saveWriting(); audio.play('select'); }, { class: 'btn--ghost' }), saved),
        ),
      ),
      h('footer', { class: 'end__btns' },
        button('플레이 보고서', () => this.openReport(s, saveWriting()), { class: 'btn--gold' }),
        button('새 연대기', () => this.onAgain(), { class: 'btn--play', 'data-autofocus': '' }),
        button('홈으로', () => this.ctx.goTitle(), { class: 'btn--ghost' }),
      ),
    );
    void this.revealCards(s, reveal);
    void play(this.el.querySelector('.end__title'), [{ opacity: 0, scale: '0.6' }, { opacity: 1, scale: '1' }], { duration: 700 });
  }

  private showReview(s: RunState): void {
    this.el.classList.add('end-screen--review');
    const order = s.orders[s.orderIdx];
    const review = s.review;
    audio.play('gameOver');
    replaceChildren(this.el,
      h('header', { class: 'end__head' },
        h('div', { class: 'end__kicker' }, `레아 모레노의 계약 검토 · ${s.orderAttempt}차 시도`),
        h('h1', { class: 'end__title' }, '이번 계약을 다시 준비해요'),
        h('p', { class: 'end__sub' }, `시즌 ${s.ante} · ${order.name}`),
      ),
      h('div', { class: 'review-layout' },
        h('section', { class: 'review-result panel' },
          h('h2', { class: 'h2' }, '충족하지 못한 조건'),
          h('p', { class: 'review-reason' }, review?.reason ?? '계약 조건을 채우지 못했습니다.'),
          h('dl', { class: 'stats' }, h('dt', null, '획득 / 목표 점수'), h('dd', { class: 'num' }, `${fmt.score(review?.score ?? s.roundScore)} / ${fmt.score(review?.target ?? order.target)}`)),
          h('ul', { class: 'review-goals' }, ...(order.goals ?? []).map((goal) => {
            const count = review?.delivery[goal.id] ?? s.delivery[goal.id] ?? 0;
            return h('li', { class: count >= goal.count ? 'is-met' : 'is-unmet' }, h('span', null, goal.label), h('b', { class: 'num' }, `${count} / ${goal.count}`), h('p', null, goal.detail));
          })),
        ),
        h('section', { class: 'review-guidance panel panel--gold' },
          h('h2', { class: 'h2' }, '다음 시도에서 바꿀 것'),
          h('p', { class: 'review-hint' }, review?.hint ?? '계약에서 요구한 형질을 만드는 부모부터 다시 살펴보세요.'),
          s.prediction ? h('p', { class: 'reflect__evidence' }, predictionText(s.prediction)) : null,
          h('p', { class: 'hint' }, '같은 계약을 처음 상태에서 다시 시작합니다. 이번에 관찰한 결과와 발견한 개념은 기록에 남습니다.'),
          button('연구 노트 보기', () => this.ctx.open.notes(), { class: 'btn--ghost' }),
        ),
      ),
      h('footer', { class: 'end__btns' },
        button('이 계약 다시 준비', () => { if (this.ctx.game.retryOrder()) this.ctx.startRun(); }, { class: 'btn--play btn--big', 'data-autofocus': '' }),
        button('홈으로', () => this.ctx.goTitle(), { class: 'btn--ghost' }),
      ),
    );
  }

  private reportText(s: RunState, reflection: string): string {
    const pol = POLICIES.find((p) => p.id === s.policy);
    return [
      '오차드 2150 · 플레이 보고서',
      `과수원: ${this.ctx.brand || '이름 없음'}`,
      `진행 방식: ${s.playStyle === 'learning' ? '수업 모드' : '도전 모드'} / 운영 방식: ${pol?.name ?? s.policy}`,
      `결과: ${s.phase === 'victory' ? '모든 계약 완료' : '도전 종료'} / 시즌 ${s.ante}/${s.maxAnte} / 재도전 ${s.stats.retries}번`,
      `교배 ${s.stats.crosses}번 / 자가수분 ${s.stats.selfings}번 / 편집 ${s.stats.edits}번 / 꽃가루 유출 ${s.stats.lmoEvents}번`,
      ...(s.geneFlow ? [
        `최근 유전자 흐름: 꽃가루 제공 ${s.geneFlow.donor} → 수분받은 포기 ${s.geneFlow.recipient}.`,
        `자손 씨 표본: ${s.geneFlow.offspring.fluorescent ? '형광 형질 있음' : '형광 형질 없음'}. 수분받은 성체의 유전자형은 바뀌지 않았습니다.`,
      ] : []),
      '', '계약별 관찰 기록',
      ...s.records.flatMap((record) => [
        recordTitle(record),
        `부모: ${record.parents?.join(' × ') ?? '기록 없음'}`,
        `교배 당시 부모 유전자형: ${record.parentGenotypes?.join(' × ') ?? '기록 없음'}`,
        record.prediction ? predictionText(record.prediction) : '빛깔 예측 기록 없음',
        `점수 ${fmt.score(record.score)} / ${fmt.score(record.target)} · ${record.cleared ? '완료' : '미완료'}`,
        ...record.goals.map((goal) => `${goal.label}: ${record.delivery[goal.id] ?? 0} / ${goal.count} (${goal.detail})`), '',
      ]),
      '다시 생각할 질문',
      '1. 부모의 유전자형으로 관찰한 비율을 어떻게 설명할 수 있나요?',
      '2. 같은 계약을 다시 맡으면 부모 선택이나 출하를 무엇부터 바꾸겠어요?',
      '3. 운영 방식에서 얻은 이점과 감수한 대가는 무엇인가요?',
      '', `내 성찰: ${reflection || '(아직 적지 않음)'}`, '',
      '루미·별다래는 가상의 식물입니다. 게임의 제한된 형질 모형을 실제 생물의 모든 유전에 적용할 수는 없습니다.',
    ].join('\n');
  }

  private openReport(s: RunState, reflection: string): void {
    const text = this.reportText(s, reflection);
    this.ctx.modals.open({
      title: '플레이 보고서', kicker: '캡처하거나 텍스트 파일로 보관할 수 있어요', wide: true, className: 'modal--report',
      content: h('pre', { class: 'report-paper' }, text),
      actions: button('텍스트 파일 저장', () => {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        const link = h('a', { href: url, download: `오차드-플레이기록-${s.seed}.txt` });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, { class: 'btn--gold' }),
    });
  }

  private async revealCards(s: RunState, box: HTMLElement): Promise<void> {
    const g = this.ctx.game;
    const items = s.garden.map((p) => {
      const v = plantView({ ...p, revealed: true }, { glasses: false, subtitle: lineageText(p, (id) => g.plantById(id)) });
      const front = h('div', { class: 'flip__front' }, plantCard(v));
      const back = h('div', { class: 'flip__back', 'aria-hidden': 'true' }, h('span', null, '?'));
      const flip = h('div', { class: 'flip' }, h('div', { class: 'flip__inner' }, back, front));
      const item = h('div', { class: 'reveal__item', role: 'listitem' }, flip,
        h('div', { class: 'reveal__text' }, h('b', null, p.name), h('span', null, speciesLabel(p.pheno)),
          h('span', { class: 'reveal__geno' }, describeGenotype(p.genome)),
          h('span', { class: 'reveal__line' }, lineageText(p, (id) => g.plantById(id))),
          h('span', { class: 'reveal__karyo' }, karyotype(p.genome, { revealed: true, width: 150 })),
          !p.revealed ? h('span', { class: 'reveal__new' }, '처음 공개') : null));
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
