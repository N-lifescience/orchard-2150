// 타이틀 — 로고 + [새 연대기] [이어하기] [연구 노트] [설정] [선생님 안내] → 모드 → 브랜드 철학 → 브랜드 이름 → 시작
import { audio } from '../../audio';
import { jokerIcon, logo, reagentIcon } from '../../art';
import type { PolicyId, RunMode } from '../../contract/game';
import { POLICIES } from '../../game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import { play, motion } from '../motion';
import { saveBrand } from '../prefs';
import { listRunSlots, runSlotProgress } from '../runSlots';

const MODES: { id: RunMode; name: string; desc: string; tag: string }[] = [
  { id: 'full', name: '전체 8시즌', desc: '모든 유전 기술과 계약을 거쳐 최종 박람회까지 도전해요. 8시즌 × 주문 3개.', tag: '40~60분' },
  { id: 'quick', name: '빠른 4시즌', desc: '한 차시 수업에 맞춘 짧은 연대기. 우열·분리·다유전자·성염색체.', tag: '25~35분' },
  { id: 'unit-sex', name: '2시즌 도전 · 성염색체', desc: '준비된 별다래 온실로 시즌 3–4를 플레이해요. X 연관 유전의 선택을 연습합니다.', tag: '단원 도전' },
  { id: 'unit-chromo', name: '2시즌 도전 · 염색체 이상', desc: '준비된 4배체 온실로 시즌 5–6을 플레이해요. 3배체·비분리를 연습합니다.', tag: '단원 도전' },
  { id: 'unit-edit', name: '2시즌 도전 · 유전자 편집', desc: '준비된 시약으로 시즌 7–8을 플레이해요. 전사·번역과 편집을 연습합니다.', tag: '단원 도전' },
];

export class TitleScreen {
  readonly el: HTMLElement;
  private panel: HTMLElement;
  private mode: RunMode = 'full';
  private policy: PolicyId = 'heritage';
  onStart: (mode: RunMode, policy: PolicyId) => void = () => {};
  onResume: (id: string) => void = () => {};
  onRemove: (id: string) => void = () => {};

  constructor(private ctx: Ctx) {
    this.panel = h('div', { class: 'title__panel' });
    this.el = h(
      'div',
      { class: 'title-screen' },
      h('div', { class: 'title__logo' }, logo()),
      h('p', { class: 'title__tag' }, '발렌시아의 육종 회사 오차드를 운영합니다. 매니저 레아 모레노와 함께 시즌마다 세 건의 계약을 마치세요.'),
      this.panel,
      h('p', { class: 'title__foot' }, '학생 개인정보를 수집하지 않아요. 모든 기록은 이 기기 브라우저에만 남아요. · 루미·별다래는 가상의 식물이에요.'),
    );
  }

  show(): void {
    this.menu();
  }

  private menu(): void {
    const slots = listRunSlots();
    const items: HTMLButtonElement[] = [
      button('새 연대기', () => this.pickMode(), { class: 'btn--play btn--big', 'data-autofocus': '' }),
      button('플레이 방법', () => this.ctx.open.tutorial(), { class: 'btn--gold' }),
      button('연구 노트', () => this.ctx.open.notes(), { class: 'btn--ghost' }),
      button('설정', () => this.ctx.open.settings(), { class: 'btn--ghost' }),
      button('선생님 안내', () => this.ctx.open.teacher(), { class: 'btn--ghost' }),
    ];
    const saved = slots.length ? h(
      'section', { class: 'save-list', 'aria-label': '저장된 연대기' },
      h('h2', { class: 'save-list__title' }, `이 기기의 연대기 ${slots.length}개`),
      ...slots.map((slot) => h('div', { class: 'save-slot' },
        button(`${slot.brand || '이름 없는 과수원'} · ${MODES.find((m) => m.id === slot.mode)?.name ?? slot.mode} · ${runSlotProgress(slot)}`, () => this.onResume(slot.id), { class: 'btn--ghost save-slot__resume', 'aria-label': `${slot.brand || '이름 없는 과수원'} 이어하기` }),
        button('삭제', () => this.confirmRemove(slot.id, slot.brand), { class: 'btn--ghost save-slot__remove', 'aria-label': `${slot.brand || '이름 없는 과수원'} 연대기 삭제` }),
      )),
    ) : h('p', { class: 'save-list__empty' }, '저장된 연대기가 없어요. 새 연대기를 시작해 보세요.');
    this.swap(h('div', { class: 'title__home' },
      h('div', { class: 'title__goal' },
        h('span', null, h('b', null, '승리'), ' 마지막 시즌의 최종 계약까지 완료'),
        h('span', null, h('b', null, '패배'), ' 출하 횟수를 다 쓰고 목표 점수에 미달'),
      ),
      h('nav', { class: 'title__menu', 'aria-label': '시작 메뉴' }, ...items), saved));
  }

  refresh(): void {
    // 저장 유무가 바뀌었을 수 있다 (저장 지우기)
    if (this.panel.querySelector('.title__menu')) this.menu();
  }

  private confirmRemove(id: string, brand: string): void {
    const m = this.ctx.modals.open({
      title: '이 연대기를 삭제할까요?',
      content: h('p', { class: 'hint' }, `${brand || '이름 없는 과수원'}의 진행 기록만 이 기기에서 삭제합니다. 다른 연대기는 남아요.`),
      actions: [button('취소', () => m.close(), { class: 'btn--ghost' }), button('삭제', () => { m.close(); this.onRemove(id); }, { class: 'btn--discard' })],
    });
  }

  private swap(node: HTMLElement): void {
    replaceChildren(this.panel, node);
    this.el.classList.toggle('is-wiz', node.classList.contains('wiz'));
    void play(node, [{ opacity: 0, translate: '0 16px' }, { opacity: 1, translate: '0 0' }], { duration: 300 });
    queueMicrotask(() => (node.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true }));
  }

  private pickMode(): void {
    audio.play('select');
    this.swap(
      h(
        'div',
        { class: 'wiz' },
        h('h2', { class: 'wiz__title' }, '어떤 연대기를 쓸까요?'),
        h(
          'div',
          { class: 'wiz__modes', role: 'list' },
          ...MODES.map((m, i) =>
            h(
              'button',
              {
                type: 'button',
                class: 'modecard',
                role: 'listitem',
                'data-autofocus': i === 0 ? '' : undefined,
                onclick: () => {
                  this.mode = m.id;
                  audio.play('select');
                  if (m.id === 'unit-edit') {
                    this.policy = 'precision';
                    this.pickName();
                  } else this.pickPolicy();
                },
              },
              h('span', { class: 'modecard__tag' }, m.tag),
              h('span', { class: 'modecard__name' }, m.name),
              h('span', { class: 'modecard__desc' }, m.desc),
            ),
          ),
        ),
        h('div', { class: 'wiz__nav' }, button('← 처음으로', () => this.menu(), { class: 'btn--ghost' })),
      ),
    );
  }

  private pickPolicy(): void {
    this.swap(
      h(
        'div',
        { class: 'wiz' },
        h('h2', { class: 'wiz__title' }, '브랜드 철학을 골라요'),
        h('p', { class: 'hint' }, '정답은 없어요. 무엇을 택하든 대가가 따라요. 끝에서 돌아볼 거예요.'),
        h(
          'div',
          { class: 'wiz__policies', role: 'list' },
          ...POLICIES.map((p, i) =>
            h(
              'button',
              {
                type: 'button',
                class: ['policy', `policy--${p.id}`],
                role: 'listitem',
                'data-autofocus': i === 0 ? '' : undefined,
                onclick: () => {
                  this.policy = p.id;
                  audio.play('select');
                  this.pickName();
                },
              },
              h('span', { class: 'policy__crest', 'aria-hidden': 'true' }, p.id === 'heritage' ? jokerIcon('selfingMaster', 72) : p.id === 'precision' ? reagentIcon('scissors', 72) : jokerIcon('jellyfishGene', 72)),
              h('span', { class: 'policy__name' }, p.name),
              h('span', { class: 'policy__desc' }, p.desc),
              h('span', { class: 'policy__trade' }, p.tradeoff),
            ),
          ),
        ),
        h('div', { class: 'wiz__nav' }, button('← 모드 고르기', () => this.pickMode(), { class: 'btn--ghost' })),
      ),
    );
    const cards = this.panel.querySelectorAll('.policy');
    cards.forEach((c, i) => void play(c, [{ opacity: 0, transform: 'perspective(800px) rotateY(80deg)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 80 * i }));
  }

  private pickName(): void {
    const input = h('input', {
      type: 'text',
      class: 'input',
      maxlength: '12',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: '예: 달빛 과수원',
      value: this.ctx.brand,
      'aria-describedby': 'brand-hint',
      'aria-label': '브랜드 이름 (선택)',
      'data-autofocus': '',
    });
    const begin = () => {
      this.ctx.brand = saveBrand(input.value);
      audio.play('play');
      this.onStart(this.mode, this.policy);
    };
    const start = () => {
      begin();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') start();
    });
    const pol = POLICIES.find((p) => p.id === this.policy);
    this.swap(
      h(
        'div',
        { class: 'wiz wiz--name' },
        h('h2', { class: 'wiz__title' }, '브랜드 이름 (선택)'),
        h('p', { class: 'hint', id: 'brand-hint' }, '별명이나 브랜드 이름만 써요 — 실명·학번은 쓰지 마세요. 이 기기에만 저장돼요.'),
        input,
        h('p', { class: 'wiz__summary' }, `${MODES.find((m) => m.id === this.mode)?.name ?? ''} · ${pol?.name ?? ''}`),
        h('div', { class: 'wiz__nav' }, button('← 뒤로', () => (this.mode === 'unit-edit' ? this.pickMode() : this.pickPolicy()), { class: 'btn--ghost' }), button('시작', start, { class: 'btn--play btn--big' })),
      ),
    );
  }
}
