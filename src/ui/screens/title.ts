// Home, saved chronicles, and the choices that start a new chronicle.
import { audio } from '../../audio';
import { jokerIcon, logo, reagentIcon } from '../../art';
import type { PlayStyle, PolicyId, RunMode } from '../../contract/game';
import { POLICIES } from '../../game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import { play } from '../motion';
import { saveBrand } from '../prefs';
import { listRunSlots, runSlotDetails, type RunSlot } from '../runSlots';

interface ModeChoice {
  id: RunMode;
  name: string;
  desc: string;
  task: string;
  start: number;
  end: number;
}
const MODES: ModeChoice[] = [
  { id: 'full', name: '전체 연대기', desc: '교배부터 유전자 편집까지 차례로 배웁니다.', task: '마지막 박람회 계약까지 완수하세요.', start: 1, end: 8 },
  { id: 'quick', name: '짧은 연대기', desc: '과육색, 당도, 성염색체 유전을 다룹니다.', task: '앞의 네 시즌을 플레이합니다.', start: 1, end: 4 },
  { id: 'unit-sex', name: '성염색체', desc: '준비된 암그루와 수그루로 교배합니다.', task: '은빛 잎 암그루를 골라 납품하세요.', start: 3, end: 4 },
  { id: 'unit-chromo', name: '염색체 이상', desc: '4배체 부모가 있는 온실에서 시작합니다.', task: '씨 없는 3배체와 정상 핵형 자손을 납품하세요.', start: 5, end: 6 },
  { id: 'unit-edit', name: '유전자 편집', desc: '유전자 가위로 B의 기능을 없앱니다.', task: '쓴맛이 사라진 자손을 납품하세요.', start: 7, end: 8 },
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
  private mode: RunMode = 'full';
  private playStyle: PlayStyle = 'learning';
  private policy: PolicyId = 'heritage';
  onStart: (mode: RunMode, policy: PolicyId, playStyle: PlayStyle) => void = () => {};
  onResume: (id: string) => void = () => {};
  onRemove: (id: string) => void = () => {};

  constructor(private ctx: Ctx) {
    this.panel = h('div', { class: 'title__panel' });
    this.el = h('div', { class: 'title-screen' },
      h('div', { class: 'title__logo' }, logo()),
      h('div', { class: 'title__tag' },
        h('p', null, '발렌시아의 육종 회사 오차드를 운영하세요.'),
        h('p', null, '레아 모레노와 함께 교배하고, 주문받은 과일을 납품합니다.'),
      ), this.panel,
      h('footer', { class: 'title__foot' },
        h('span', null, '기록은 이 브라우저에 저장됩니다.'),
        h('span', null, '루미와 별다래는 가상의 식물입니다.'),
      ),
    );
  }
  show(): void { this.menu(); }

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
        h('span', null, modeLabel(slot.mode)),
        h('span', null, slot.playStyle === 'learning' ? '수업 모드' : '도전 모드'),
        h('span', null, POLICIES.find((p) => p.id === slot.policy)?.name ?? ''),
      ),
      h('div', { class: 'save-slot__progress' },
        h('span', null, finished ? '플레이 기록이 남아 있습니다.' : details.location),
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
        h('h2', null, '과수원 운영하기'),
        h('p', null, '부모를 고르고 자손을 키워, 점수와 납품 조건을 함께 채우세요.'),
        button('새 연대기 시작', () => this.pickStyle(), { class: 'btn--play btn--big', 'data-autofocus': '' }),
        h('p', { class: 'title__save-hint' }, '새로 시작해도 기존 연대기는 남습니다.'),
        h('nav', { class: 'title__menu', 'aria-label': '도움말과 설정' },
          button('플레이 방법', () => this.ctx.open.tutorial(), { class: 'btn--ghost' }),
          button('연구 노트', () => this.ctx.open.notes(), { class: 'btn--ghost' }),
          button('설정', () => this.ctx.open.settings(), { class: 'btn--ghost' }),
          button('선생님 안내', () => this.ctx.open.teacher(), { class: 'btn--ghost' }),
        ),
      ),
      h('section', { class: 'save-library', 'aria-label': '저장된 연대기' },
        h('div', { class: 'save-library__head' }, h('h2', null, '내 연대기'), h('span', null, `${slots.length}개 저장됨`)),
        h('p', { class: 'save-library__hint' }, '최근에 플레이한 순서입니다. 완료한 연대기는 기록을 다시 볼 수 있습니다.'),
        slots.length ? h('div', { class: 'save-list' }, ...slots.map((slot) => this.savedCard(slot))) :
          h('div', { class: 'save-list__empty' }, h('strong', null, '첫 연대기를 시작해 보세요.'), h('p', null, '여러 과수원을 따로 저장하고 이어서 플레이할 수 있습니다.')),
      ),
    ));
  }
  refresh(): void { if (this.panel.querySelector('.title__home')) this.menu(); }

  private confirmRemove(id: string, brand: string): void {
    const m = this.ctx.modals.open({
      title: '이 연대기를 삭제할까요?',
      content: h('div', { class: 'prose hint' }, h('p', null, `${brand || '이름 없는 과수원'}의 진행 기록을 이 기기에서 삭제합니다.`), h('p', null, '다른 연대기는 그대로 남습니다.')),
      actions: [button('취소', () => m.close(), { class: 'btn--ghost' }), button('삭제', () => { m.close(); this.onRemove(id); }, { class: 'btn--discard' })],
    });
  }
  private swap(node: HTMLElement): void {
    replaceChildren(this.panel, node);
    this.el.classList.toggle('is-wiz', node.classList.contains('wiz'));
    void play(node, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 220 });
    queueMicrotask(() => (node.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true }));
  }
  private steps(current: 'style' | 'mode' | 'policy' | 'name'): HTMLElement {
    const steps = [ ['style', '진행 방식'], ['mode', '플레이 범위'], ...(this.mode === 'unit-edit' && current === 'name' ? [] : [['policy', '운영 팀']]), ['name', '과수원 이름'] ];
    const index = steps.findIndex(([key]) => key === current);
    return h('ol', { class: 'wiz__steps', 'aria-label': '새 연대기 준비' }, ...steps.map(([key, label], i) =>
      h('li', { class: [key === current && 'is-current', i < index && 'is-done'], 'aria-current': key === current ? 'step' : undefined }, h('span', { class: 'wiz__step-num', 'aria-hidden': 'true' }, i < index ? '✓' : i + 1), label),
    ));
  }
  private pickStyle(): void {
    audio.play('select');
    this.swap(h('div', { class: 'wiz wiz--style' },
      this.steps('style'), h('h2', { class: 'wiz__title' }, '실패했을 때 어떻게 진행할까요?'),
      h('p', { class: 'wiz__intro' }, '두 모드의 목표 점수와 납품 조건은 같습니다.'),
      h('div', { class: 'wiz__styles' },
        button(h('span', { class: 'stylecard__body' },
          h('span', { class: 'modecard__tag' }, '처음이라면 추천'), h('strong', { class: 'modecard__name' }, '수업 모드'),
          h('span', { class: 'modecard__desc' }, '실패한 이유를 확인하고 같은 계약에 다시 도전합니다.'),
          h('span', { class: 'stylecard__detail' }, '부모 조합과 출하 방법을 바꿔 보세요.'),
        ), () => { this.playStyle = 'learning'; this.pickMode(); }, { class: 'stylecard', 'data-autofocus': '' }),
        button(h('span', { class: 'stylecard__body' },
          h('span', { class: 'modecard__tag' }, '끝까지 한 번에'), h('strong', { class: 'modecard__name' }, '도전 모드'),
          h('span', { class: 'modecard__desc' }, '계약을 실패하면 그 연대기의 플레이가 끝납니다.'),
          h('span', { class: 'stylecard__detail' }, '남은 출하 횟수와 자원을 살펴 가며 운영하세요.'),
        ), () => { this.playStyle = 'challenge'; this.pickMode(); }, { class: 'stylecard' }),
      ), h('div', { class: 'wiz__nav' }, button('← 홈으로', () => this.menu(), { class: 'btn--ghost' })),
    ));
  }
  private pickMode(): void {
    const cards: HTMLButtonElement[] = [];
    const selection = h('p', { class: 'wiz__selection', 'aria-live': 'polite' });
    const update = () => {
      cards.forEach((card) => card.setAttribute('aria-pressed', String(card.dataset.mode === this.mode)));
      const chosen = MODES.find((m) => m.id === this.mode)!;
      selection.textContent = `${modeLabel(this.mode)} · ${chosen.end - chosen.start + 1}시즌 · 계약 ${(chosen.end - chosen.start + 1) * 3}건`;
    };
    const card = (m: ModeChoice) => {
      const b = h('button', {
        type: 'button', class: ['modecard', m.start > 1 && 'modecard--unit'], dataset: { mode: m.id },
        'aria-pressed': String(this.mode === m.id), 'aria-label': `${m.name}, ${m.end - m.start + 1}시즌, 계약 ${(m.end - m.start + 1) * 3}건`,
        'data-autofocus': this.mode === m.id ? '' : undefined,
        onclick: () => { this.mode = m.id; audio.play('select'); update(); },
      },
        h('span', { class: 'modecard__head' }, h('strong', { class: 'modecard__name' }, m.name), h('span', { class: 'modecard__check', 'aria-hidden': 'true' }, '✓')),
        h('span', { class: 'modecard__stats' }, `${m.end - m.start + 1}시즌`, h('span', null, `계약 ${(m.end - m.start + 1) * 3}건`)),
        h('span', { class: 'modecard__desc' }, m.desc), h('span', { class: 'modecard__task' }, m.task),
        h('span', { class: 'season-strip', 'aria-label': `시즌 ${m.start}부터 ${m.end}까지` }, ...Array.from({ length: 8 }, (_, i) => h('span', { class: i + 1 >= m.start && i + 1 <= m.end ? 'is-active' : '', 'aria-hidden': 'true' }, i + 1))),
      );
      cards.push(b); return b;
    };
    this.swap(h('div', { class: 'wiz wiz--mode' },
      this.steps('mode'), h('h2', { class: 'wiz__title' }, '얼마나 플레이할까요?'),
      h('div', { class: 'wiz__mode-groups' },
        h('section', { class: 'mode-group' }, h('h3', { class: 'mode-group__title' }, '처음부터 차례로'), h('div', { class: 'mode-group__cards mode-group__cards--journey' }, ...MODES.slice(0, 2).map(card))),
        h('section', { class: 'mode-group' },
          h('div', { class: 'mode-group__heading' }, h('h3', { class: 'mode-group__title' }, '한 단원만 집중해서'), h('p', null, '필요한 부모와 도구를 갖춘 온실에서 시작합니다.')),
          h('div', { class: 'mode-group__cards mode-group__cards--units' }, ...MODES.slice(2).map(card)),
        ),
      ),
      h('div', { class: 'wiz__nav wiz__nav--spread' },
        button('← 진행 방식', () => this.pickStyle(), { class: 'btn--ghost' }), selection,
        button('다음 →', () => { audio.play('select'); if (this.mode === 'unit-edit') { this.policy = 'precision'; this.pickName(); } else this.pickPolicy(); }, { class: 'btn--play' }),
      ),
    ));
    update();
  }
  private pickPolicy(): void {
    this.swap(h('div', { class: 'wiz' },
      this.steps('policy'), h('h2', { class: 'wiz__title' }, '과수원을 운영할 팀을 고르세요'), h('p', { class: 'wiz__intro' }, '팀마다 쓸 수 있는 도구와 보상이 다릅니다.'),
      h('div', { class: 'wiz__policies' }, ...POLICIES.map((p, i) =>
        button(h('span', { class: 'policy__body' },
          h('span', { class: 'policy__crest', 'aria-hidden': 'true' }, p.id === 'heritage' ? jokerIcon('selfingMaster', 64) : p.id === 'precision' ? reagentIcon('scissors', 64) : jokerIcon('jellyfishGene', 64)),
          h('strong', { class: 'policy__name' }, p.name), h('span', { class: 'policy__desc' }, p.desc), h('span', { class: 'policy__trade' }, p.tradeoff),
        ), () => { this.policy = p.id; audio.play('select'); this.pickName(); }, { class: ['policy', `policy--${p.id}`], 'data-autofocus': i === 0 ? '' : undefined }),
      )), h('div', { class: 'wiz__nav' }, button('← 플레이 범위', () => this.pickMode(), { class: 'btn--ghost' })),
    ));
  }
  private pickName(): void {
    const input = h('input', { type: 'text', class: 'input', maxlength: '12', autocomplete: 'off', spellcheck: 'false', placeholder: '예: 달빛 과수원', value: this.ctx.brand, 'aria-describedby': 'brand-hint', 'aria-label': '과수원 이름 (선택)', 'data-autofocus': '' });
    const start = () => { this.ctx.brand = saveBrand(input.value); audio.play('play'); this.onStart(this.mode, this.policy, this.playStyle); };
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') start(); });
    const choice = MODES.find((m) => m.id === this.mode)!;
    this.swap(h('div', { class: 'wiz wiz--name' },
      this.steps('name'), h('h2', { class: 'wiz__title' }, '이 과수원을 뭐라고 부를까요?'),
      h('div', { class: 'prose hint', id: 'brand-hint' }, h('p', null, '이름은 나중에 연대기를 구별할 때 쓰입니다. 비워 두어도 괜찮습니다.'), h('p', null, '별명이나 과수원 이름을 써 주세요. 실명과 학번은 쓰지 마세요.')),
      input,
      h('dl', { class: 'wiz__recap' },
        h('div', null, h('dt', null, '진행 방식'), h('dd', null, this.playStyle === 'learning' ? '수업 모드' : '도전 모드')),
        h('div', null, h('dt', null, '플레이 범위'), h('dd', null, `${modeLabel(this.mode)} · 계약 ${(choice.end - choice.start + 1) * 3}건`)),
        h('div', null, h('dt', null, '운영 팀'), h('dd', null, POLICIES.find((p) => p.id === this.policy)?.name ?? '')),
      ), h('div', { class: 'wiz__nav' }, button('← 뒤로', () => this.mode === 'unit-edit' ? this.pickMode() : this.pickPolicy(), { class: 'btn--ghost' }), button('플레이 시작', start, { class: 'btn--play btn--big' })),
    ));
  }
}
