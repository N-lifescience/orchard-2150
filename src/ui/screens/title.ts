// Home, saved chronicles, and the choices that start a new chronicle.
import { audio } from '../../audio';
import { jokerIcon, reagentIcon } from '../../art';
import type { Difficulty, PlayStyle, PolicyId, RunMode } from '../../contract/game';
import { inferDifficulty } from '../../game/difficulty';
import { difficultyBadge } from '../difficultyBadge';
import { POLICIES } from '../../game';
import type { Ctx } from '../ctx';
import { h, svg, button, replaceChildren } from '../h';
import { play } from '../motion';
import { saveBrand } from '../prefs';
import { listRunSlots, runSlotDetails, type RunSlot } from '../runSlots';
import { playDuration, PRACTICE_DURATION } from '../playDuration';
import { pageDeck } from '../pages';
import { TITLE_COPY } from '../story/script';

interface ModeChoice {
  id: RunMode;
  name: string;
  desc: string;
  task: string;
  start: number;
  end: number;
}
const MODES: ModeChoice[] = [
  { id: 'full', name: '전체 연대기', desc: '교배부터 유전자 편집까지 차례로 배워요.', task: '마지막 박람회 계약까지 완수하세요.', start: 1, end: 8 },
  { id: 'quick', name: '짧은 연대기', desc: '과육색, 당도, 성염색체 유전을 다뤄요.', task: '앞의 네 시즌을 플레이해요.', start: 1, end: 4 },
  { id: 'unit-sex', name: '성염색체', desc: '준비된 암그루와 수그루로 교배해요.', task: '은빛 잎 암그루를 골라 납품하세요.', start: 3, end: 4 },
  { id: 'unit-chromo', name: '염색체 이상', desc: '4배체 부모가 있는 온실에서 시작해요.', task: '씨 없는 3배체와 정상 핵형 자손을 납품하세요.', start: 5, end: 6 },
  { id: 'unit-edit', name: '유전자 편집', desc: '유전자 가위로 B의 기능을 없애요.', task: '쓴맛이 사라진 자손을 납품하세요.', start: 7, end: 8 },
];
function modeLabel(mode: RunMode): string {
  const choice = MODES.find((m) => m.id === mode);
  return choice ? `${choice.start > 1 ? '단원 · ' : ''}${choice.name}` : mode;
}
function savedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(timestamp);
}

export class TitleScreen {
  readonly el: HTMLElement;
  private panel: HTMLElement;
  private mode: RunMode = 'quick';
  private difficulty: Difficulty = 'sprout';
  private playStyle: PlayStyle = 'learning';
  private policy: PolicyId = 'heritage';
  onStart: (mode: RunMode, policy: PolicyId, playStyle: PlayStyle, difficulty: Difficulty) => void = () => {};
  onResume: (id: string) => void = () => {};
  onRemove: (id: string) => void = () => {};

  constructor(private ctx: Ctx) {
    this.panel = h('div', { class: 'title__panel' });
    this.el = h('div', { class: 'title-screen' },
      h('div', { class: 'title__logo', 'aria-label': '오차드 2150' }, h('span', { class: 'hud-wordmark' }, 'ORCHARD'), h('span', { class: 'hud-year' }, '2150')),
      h('div', { class: 'title__tag' }, ...TITLE_COPY.tag.map((line) => h('p', null, line))), this.panel,
      h('footer', { class: 'title__foot' }, ...TITLE_COPY.foot.map((line) => h('span', null, line))),
    );
  }
  show(): void { this.menu(); }
  prepareNew(): void { this.pickDifficulty(); }

  private savedCard(slot: RunSlot): HTMLElement {
    const details = runSlotDetails(slot);
    const finished = details.status === 'victory' || details.status === 'gameover';
    const name = slot.brand || '이름 없는 과수원';
    const timestamp = Number.isFinite(new Date(slot.updatedAt).getTime()) ? slot.updatedAt : 0;
    return h('article', { class: 'save-slot' },
      h('div', { class: 'save-slot__head' },
        h('h3', { class: 'save-slot__name' }, name),
        h('span', { class: ['save-slot__status', `is-${details.status}`] }, details.label),
      ),
      h('div', { class: 'save-slot__meta' },
        difficultyBadge(inferDifficulty(slot.mode, slot.playStyle, slot.difficulty)),
        h('span', null, modeLabel(slot.mode)),
        h('span', null, slot.playStyle === 'learning' ? '재도전 허용' : '실패 시 종료'),
        h('span', null, POLICIES.find((p) => p.id === slot.policy)?.name ?? ''),
        h('span', null, `전체 예상 ${playDuration(slot.mode, slot.playStyle)}`),
      ),
      h('div', { class: 'save-slot__progress' },
        h('span', null, finished ? '플레이 기록이 남아 있어요.' : details.location),
        h('span', null, `계약 ${details.completed} / ${details.total}건 완료`),
      ),
      h('progress', { class: 'save-slot__bar', value: details.completed, max: details.total, 'aria-label': `${name} 계약 진행` }),
      h('div', { class: 'save-slot__bottom' },
        h('time', { datetime: new Date(timestamp).toISOString(), class: 'save-slot__date' }, `${savedAt(timestamp)} 저장`),
        h('div', { class: 'save-slot__actions' },
          button('삭제', () => this.confirmRemove(slot.id, slot.brand), { class: 'btn--ghost save-slot__remove', 'aria-label': `${name} 연대기 삭제` }),
          button(finished ? '기록 보기' : details.status === 'review' ? '재도전 준비' : '이어하기', () => this.onResume(slot.id), { class: 'btn--ghost save-slot__resume', 'aria-label': `${name} ${finished ? '기록 보기' : '이어하기'}` }),
        ),
      ),
    );
  }

  private menu(): void {
    const slots = listRunSlots();
    this.swap(h('div', { class: 'title__home' },
      h('div', { class: 'title__start' },
        h('h2', null, TITLE_COPY.startTitle),
        h('p', null, TITLE_COPY.startBody),
        button('새 연대기 시작', () => this.pickDifficulty(), { class: 'btn--play btn--big', 'data-autofocus': '' }),
        h('p', { class: 'title__save-hint' }, '새로 시작해도 기존 연대기는 남아요.'),
        button('튜토리얼', () => this.ctx.startPractice(), { class: 'btn--gold title__practice' }),
        h('p', { class: 'title__practice-hint' }, `${PRACTICE_DURATION} · ${TITLE_COPY.practiceHint}`),
        h('nav', { class: 'title__menu', 'aria-label': '도움말과 설정' },
          button(TITLE_COPY.replayIntro, () => this.ctx.replayIntro(), { class: 'btn--ghost title__replay' }),
          button('플레이 방법', () => this.ctx.open.tutorial(), { class: 'btn--ghost' }),
          button(TITLE_COPY.notes, () => this.ctx.open.notes(), { class: 'btn--ghost' }),
          button('설정', () => this.ctx.open.settings(), { class: 'btn--ghost' }),
          button('선생님 안내', () => this.ctx.open.teacher(), { class: 'btn--ghost' }),
        ),
      ),
      h('section', { class: 'save-library', 'aria-label': '저장된 연대기' },
        h('div', { class: 'save-library__head' }, h('h2', null, '내 연대기'), h('span', null, `${slots.length}개 저장됨`)),
        h('p', { class: 'save-library__hint' }, '최근에 플레이한 순서예요. 완료한 연대기는 기록을 다시 볼 수 있어요.'),
        slots.length ? pageDeck(slots.map((slot) => h('div', { class: 'save-list' }, this.savedCard(slot))), '내 연대기') :
          h('div', { class: 'save-list__empty' }, h('strong', null, '첫 연대기를 시작해 보세요.'), h('p', null, '여러 과수원을 따로 저장하고 이어서 플레이할 수 있어요.')),
      ),
    ));
  }
  refresh(): void { if (this.panel.querySelector('.title__home')) this.menu(); }

  private confirmRemove(id: string, brand: string): void {
    const m = this.ctx.modals.open({
      title: '이 연대기를 삭제할까요?',
      content: h('div', { class: 'prose hint' }, h('p', null, `${brand || '이름 없는 과수원'}의 진행 기록을 이 기기에서 삭제해요.`), h('p', null, '다른 연대기는 그대로 남아요.')),
      actions: [button('취소', () => m.close(), { class: 'btn--ghost' }), button('삭제', () => { m.close(); this.onRemove(id); }, { class: 'btn--discard' })],
    });
  }
  private swap(node: HTMLElement): void {
    replaceChildren(this.panel, node);
    this.el.classList.toggle('is-wiz', node.classList.contains('wiz'));
    void play(node, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 220 });
    queueMicrotask(() => {
      if (this.ctx.stage.classList.contains('is-responsive')) window.scrollTo(0, 0);
      (node.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }
  private steps(current: 'difficulty' | 'policy' | 'name'): HTMLElement {
    const steps = [['difficulty', '난이도'], ['policy', '운영 팀'], ['name', '시작']];
    const index = steps.findIndex(([key]) => key === current);
    return h('ol', { class: 'wiz__steps', 'aria-label': '새 연대기 준비' }, ...steps.map(([key, label], i) =>
      h('li', { class: [key === current && 'is-current', i < index && 'is-done'], 'aria-current': key === current ? 'step' : undefined }, h('span', { class: 'wiz__step-num', 'aria-hidden': 'true' }, i < index ? '✓' : i + 1), label)));
  }
  private pickDifficulty(): void {
    const choices: { id: Difficulty; mode: RunMode; recommendation: string; facts: string[] }[] = [
      { id: 'sprout', mode: 'quick', recommendation: '유전을 처음 배우는 사람에게 추천해요.', facts: ['4시즌, 12계약', '실패하면 재도전해요.', '자동 도움, 출하와 솎아내기 +1'] },
      { id: 'fruit', mode: 'full', recommendation: '교배와 우성, 열성을 배워 본 사람에게 추천해요.', facts: ['8시즌, 24계약', '실패하면 재도전해요.', '도움은 단추로 열어요.'] },
      { id: 'master', mode: 'full', recommendation: '유전 단원을 마쳤거나 열매를 끝낸 사람에게 추천해요.', facts: ['8시즌, 24계약', '실패하면 종료해요.', '노트만 볼 수 있어요.'] },
    ];
    const cards: HTMLElement[] = [];
    const selected = h('span', { class: 'wiz__selection', 'aria-live': 'polite' });
    const update = () => {
      cards.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.difficulty === this.difficulty && (!c.dataset.mode || c.dataset.mode === this.mode))));
      replaceChildren(selected, difficultyBadge(this.difficulty));
    };
    const choose = (id: Difficulty, mode: RunMode) => { this.difficulty = id; this.mode = mode; this.playStyle = id === 'master' ? 'challenge' : 'learning'; audio.play('select'); update(); };
    const journey = choices.map((c) => {
      const card = button(h('span', { class: 'difficulty-card__body' },
        h('strong', { class: 'modecard__name' }, difficultyBadge(c.id)),
        h('span', { class: 'modecard__desc' }, c.recommendation),
        h('span', { class: 'difficulty-card__facts' }, ...c.facts.map((fact, i) => h('span', null, svg('svg', { class: 'difficulty-card__icon', viewBox: '0 0 20 20', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5 }, svg('path', { d: ['M4 3h12v14H4z M7 7h6 M7 10h6 M7 13h4', 'M16 8a6 6 0 1 0 0 5 M16 3v5h-5', 'M7 7a3 3 0 1 1 5 2c-2 1-2 2-2 3 M10 15v1'][i] })), ' ', fact))),
        h('span', { class: 'modecard__time' }, playDuration(c.mode, c.id === 'master' ? 'challenge' : 'learning'))),
      () => choose(c.id, c.mode), { class: 'modecard difficulty-card', dataset: { difficulty: c.id }, 'data-autofocus': c.id === this.difficulty ? '' : undefined });
      cards.push(card); return card;
    });
    const units = MODES.slice(2).map((m) => {
      const card = button(h('span', null, h('strong', null, m.name), h('span', null, `2시즌, 6계약 / ${playDuration(m.id, 'learning')}`)),
        () => choose('unit', m.id), { class: 'btn--seg difficulty-unit', dataset: { difficulty: 'unit', mode: m.id } });
      cards.push(card); return card;
    });
    this.swap(h('div', { class: 'wiz wiz--difficulty' }, this.steps('difficulty'), h('h2', { class: 'wiz__title' }, '난이도를 골라 주세요'),
      h('p', { class: 'wiz__intro' }, '유전 원리를 외우지 않아도 돼요. 해 보면서 알게 돼요.'),
      h('div', { class: 'difficulty-choices' }, ...journey),
      h('section', { class: 'difficulty-units' }, h('h3', null, '단원 연습'), h('p', { class: 'hint' }, '수업에서 한 단원만 다뤄요. 재도전과 도움은 열매와 같아요.'), h('div', null, ...units)),
      h('div', { class: 'wiz__nav wiz__nav--spread' }, button('← 홈으로', () => this.menu(), { class: 'btn--ghost' }), selected,
        button('다음 →', () => this.pickPolicy(), { class: 'btn--play' }))));
    update();
  }
  private pickPolicy(): void {
    this.swap(h('div', { class: 'wiz wiz--policy' },
      this.steps('policy'), h('h2', { class: 'wiz__title' }, '어떤 도구로 품종을 만들까요?'), h('p', { class: 'wiz__intro' }, '모든 팀은 부모를 교배하고 모종을 선발해요. 팀을 고르면 추가로 쓸 수 있는 도구와 계약 보상이 정해져요.'),
      h('div', { class: 'wiz__policies' }, ...POLICIES.filter((p) => this.mode !== 'unit-edit' || p.id === 'precision').map((p, i) =>
        button(h('span', { class: 'policy__body' },
          h('span', { class: 'policy__crest', 'aria-hidden': 'true' }, p.id === 'heritage' ? jokerIcon('selfingMaster', 64) : p.id === 'precision' ? reagentIcon('scissors', 64) : jokerIcon('jellyfishGene', 64)),
          h('strong', { class: 'policy__name' }, p.name), h('span', { class: 'policy__desc' }, p.desc), h('span', { class: 'policy__trade' }, p.tradeoff),
        ), () => { this.policy = p.id; audio.play('select'); this.pickName(); }, { class: ['policy', `policy--${p.id}`], 'data-autofocus': i === 0 ? '' : undefined }),
      )), h('div', { class: 'wiz__nav' }, button('← 난이도', () => this.pickDifficulty(), { class: 'btn--ghost' })),
    ));
  }
  private pickName(): void {
    const input = h('input', { type: 'text', class: 'input', maxlength: '12', autocomplete: 'off', spellcheck: 'false', placeholder: TITLE_COPY.namePlaceholder, value: this.ctx.brand, 'aria-describedby': 'brand-hint', 'aria-label': '과수원 이름 (선택)', 'data-autofocus': '' });
    const start = () => { this.ctx.brand = saveBrand(input.value); audio.play('play'); this.onStart(this.mode, this.policy, this.playStyle, this.difficulty); };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') start(); });
    const choice = MODES.find((m) => m.id === this.mode)!;
    this.swap(h('div', { class: 'wiz wiz--name' },
      this.steps('name'), h('h2', { class: 'wiz__title' }, '연대기를 시작해요'),
      h('div', { class: 'prose hint', id: 'brand-hint' }, ...TITLE_COPY.nameHint.map((line) => h('p', null, line))),
      input,
      h('dl', { class: 'wiz__recap' },
        h('div', null, h('dt', null, '난이도'), h('dd', null, difficultyBadge(this.difficulty))),
        h('div', null, h('dt', null, '플레이 범위'), h('dd', null, `${modeLabel(this.mode)} · 계약 ${(choice.end - choice.start + 1) * 3}건`)),
        h('div', null, h('dt', null, '운영 팀'), h('dd', null, POLICIES.find((p) => p.id === this.policy)?.name ?? '')),
        h('div', null, h('dt', null, '예상 시간'), h('dd', null, `${playDuration(this.mode, this.playStyle)} · 쉬는 시간 제외`)),
      ), h('div', { class: 'wiz__nav' }, button('← 뒤로', () => this.pickPolicy(), { class: 'btn--ghost' }), button('플레이 시작', start, { class: 'btn--play btn--big' })),
    ));
  }
}
