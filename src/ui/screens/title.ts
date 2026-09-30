// 타이틀 — 로고 + [새 연대기] [이어하기] [연구 노트] [설정] [선생님 안내] → 모드 → 브랜드 철학 → 브랜드 이름 → 시작
import { audio } from '../../audio';
import { jokerIcon, logo, reagentIcon } from '../../art';
import type { PolicyId, RunMode } from '../../contract/game';
import { POLICIES } from '../../game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import { play, motion } from '../motion';
import { saveBrand } from '../prefs';

const MODES: { id: RunMode; name: string; desc: string; tag: string }[] = [
  { id: 'full', name: '전체 8시즌', desc: '할머니의 온실에서 2150 명품 박람회까지. 멘델 유전부터 유전자 편집·LMO까지 겪어요.', tag: '40~60분' },
  { id: 'quick', name: '빠른 4시즌', desc: '한 차시 수업에 맞춘 짧은 연대기. 우열·분리·다유전자·성염색체.', tag: '25~35분' },
  { id: 'unit-sex', name: '단원 연습 · 성염색체', desc: '별다래(암수딴그루)와 X 연관 유전. 시즌 3부터 시작해요.', tag: '12유전01-01' },
  { id: 'unit-chromo', name: '단원 연습 · 염색체 이상', desc: '콜히친·3배체·비분리. 시즌 5부터 시작해요.', tag: '12유전01-04' },
  { id: 'unit-edit', name: '단원 연습 · 유전자 편집', desc: '전사·번역·종결 코돈. 정밀 편집 랩으로 시즌 7부터 시작해요.', tag: '12유전02' },
];

export class TitleScreen {
  readonly el: HTMLElement;
  private panel: HTMLElement;
  private mode: RunMode = 'full';
  private policy: PolicyId = 'heritage';
  onStart: (mode: RunMode, policy: PolicyId) => void = () => {};

  constructor(private ctx: Ctx) {
    this.panel = h('div', { class: 'title__panel' });
    this.el = h(
      'div',
      { class: 'title-screen' },
      h('div', { class: 'title__logo' }, logo()),
      h('p', { class: 'title__tag' }, '2150년, 할머니의 온실을 물려받았어요. 두 포기를 교배해 씨앗 꼬투리를 만들고, 최고의 과일을 출하해요.'),
      this.panel,
      h('p', { class: 'title__foot' }, '학생 개인정보를 수집하지 않아요. 모든 기록은 이 기기 브라우저에만 남아요. · 루미·별다래는 가상의 식물이에요.'),
    );
  }

  show(): void {
    this.menu();
  }

  private menu(): void {
    const g = this.ctx.game;
    const has = g.hasSave();
    const items: HTMLButtonElement[] = [
      has ? button('이어하기', () => this.resume(), { class: 'btn--play btn--big', 'data-autofocus': '' }) : null,
      button('새 연대기', () => this.pickMode(), { class: has ? 'btn--ghost btn--big' : 'btn--play btn--big', 'data-autofocus': has ? undefined : '' }),
      button('연구 노트', () => this.ctx.open.notes(), { class: 'btn--ghost' }),
      button('설정', () => this.ctx.open.settings(), { class: 'btn--ghost' }),
      button('선생님 안내', () => this.ctx.open.teacher(), { class: 'btn--ghost' }),
    ].filter((b): b is HTMLButtonElement => !!b);
    this.swap(h('nav', { class: 'title__menu', 'aria-label': '시작 메뉴' }, ...items));
  }

  refresh(): void {
    // 저장 유무가 바뀌었을 수 있다 (저장 지우기)
    if (this.panel.querySelector('.title__menu')) this.menu();
  }

  private resume(): void {
    const g = this.ctx.game;
    if (g.state.phase === 'title' || g.state.phase === 'gameover' || g.state.phase === 'victory') {
      if (!g.load()) {
        this.ctx.toast.error('저장을 불러오지 못했어요.');
        this.menu();
        return;
      }
    }
    audio.play('select');
    this.ctx.startRun();
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
      if (!this.ctx.game.hasSave()) {
        begin();
        return;
      }
      const m = this.ctx.modals.open({
        title: '기존 진행을 덮어쓸까요?',
        content: h('p', { class: 'hint' }, '새 연대기를 시작하면 저장된 진행이 사라져요. 취소하면 홈에서 이어할 수 있어요.'),
        actions: [
          button('취소', () => m.close(), { class: 'btn--ghost' }),
          button('새 연대기 시작', () => {
            m.close();
            begin();
          }, { class: 'btn--play' }),
        ],
      });
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
