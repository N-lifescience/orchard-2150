// 개념 카드(발견) · 연구 노트(도감) · 선생님 안내
import { audio } from '../../audio';
import type { ConceptDef, ConceptId } from '../../contract/game';
import { CONCEPTS } from '../../game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import { play, motion } from '../motion';
import { wipeAll } from '../prefs';

const ORDER = Object.keys(CONCEPTS) as ConceptId[];

function conceptBody(c: ConceptDef): HTMLElement {
  return h(
    'div',
    { class: 'concept' },
    h('p', { class: 'concept__body' }, c.body),
    c.fiction ? h('div', { class: 'concept__box concept__box--fiction' }, h('div', { class: 'concept__tag' }, '虛 게임 설정'), h('p', null, c.fiction)) : null,
    h('div', { class: 'concept__box concept__box--real' }, h('div', { class: 'concept__tag' }, '原 실제 과학'), h('p', null, c.real)),
    c.standard ? h('div', { class: 'concept__std' }, `성취기준 ${c.standard}`) : null,
  );
}

/** 발견 카드를 하나씩 띄우고 다 보면 ackDiscoveries. 다 닫히면 resolve */
export function showDiscoveries(ctx: Ctx, ids: ConceptId[]): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= ids.length) {
        ctx.game.ackDiscoveries();
        resolve();
        return;
      }
      const c = ctx.game.conceptDef(ids[i]);
      const idx = i;
      i++;
      audio.play('discovery');
      let advanced = false;
      const go = () => {
        if (advanced) return;
        advanced = true;
        m.close();
        next();
      };
      const m = ctx.modals.open({
        title: c.title,
        kicker: `새 개념 발견${ids.length > 1 ? ` (${idx + 1}/${ids.length})` : ''}`,
        className: 'modal--discovery',
        content: conceptBody(c),
        actions: button('연구 노트에 꽂기', go, { class: 'btn--gold', 'data-autofocus': '' }),
        onClose: go,
      });
      if (!motion.reduced) void play(m.el, [{ transform: 'perspective(900px) rotateY(160deg) scale(0.6)', opacity: 0 }, { transform: 'perspective(900px) rotateY(-12deg) scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 700, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' });
    };
    next();
  });
}

export function openNotes(ctx: Ctx, by: 'all' | 'standard' = 'all'): void {
  const found = new Set(ctx.game.state.discoveries);
  const detail = h('div', { class: 'notes__detail', 'aria-live': 'polite' }, h('p', { class: 'hint' }, '열린 카드를 누르면 자세히 볼 수 있어요.'));
  const cardFor = (id: ConceptId) => {
    const c = CONCEPTS[id];
    const open = found.has(id);
    const b = h('button', { type: 'button', class: ['note', open ? 'is-open' : 'is-locked'], 'aria-label': open ? c.title : '아직 발견하지 못한 개념', disabled: !open }, h('span', { class: 'note__q' }, open ? c.title : '?'), open && c.standard ? h('span', { class: 'note__std' }, c.standard) : null);
    if (open)
      b.addEventListener('click', () => {
        audio.play('select');
        replaceChildren(detail, h('h3', { class: 'notes__title' }, c.title), conceptBody(c));
      });
    return b;
  };
  const grid = h('div', { class: 'notes__grid' });
  const fill = (mode: 'all' | 'standard') => {
    if (mode === 'all') replaceChildren(grid, ...ORDER.map(cardFor));
    else {
      const groups = new Map<string, ConceptId[]>();
      for (const id of ORDER) {
        const k = CONCEPTS[id].standard ?? '기타';
        groups.set(k, [...(groups.get(k) ?? []), id]);
      }
      replaceChildren(grid, ...[...groups.entries()].sort().map(([k, ids]) => h('div', { class: 'notes__group' }, h('div', { class: 'bar__label' }, k), h('div', { class: 'notes__row' }, ...ids.map(cardFor)))));
    }
    tabA.setAttribute('aria-pressed', String(mode === 'all'));
    tabB.setAttribute('aria-pressed', String(mode === 'standard'));
  };
  const tabA = button('모두', () => fill('all'), { class: 'btn--seg' });
  const tabB = button('성취기준별', () => fill('standard'), { class: 'btn--seg' });
  fill(by);
  ctx.modals.open({
    title: '연구 노트',
    kicker: `발견 ${found.size} / ${ORDER.length}`,
    className: 'modal--notes',
    wide: true,
    content: h('div', { class: 'notes' }, h('div', { class: 'sortbox' }, tabA, tabB), h('div', { class: 'notes__cols' }, grid, detail)),
  });
}

const STANDARDS: [string, string, string][] = [
  ['12유전01-01', '멘델 유전 — 우열·분리·독립, 순계, 자가수분, 성염색체(X 연관)', '시즌 1–4 · 교배 규칙 전체, 별다래(암수딴그루·X 연관)'],
  ['12유전01-03', '다유전자유전과 환경 — 연속 변이, 환경 변이는 유전 안 됨', '시즌 1–2 · 당도 8~20, 가뭄·비료'],
  ['12유전01-04', '염색체 이상 — 배수체, 3배체, 비분리와 이수성', '시즌 5–6 · 콜히친, 냉해'],
  ['12유전02-01', '유전자 발현 — 전사·번역, 우성·열성의 분자 원리', '시즌 7–8 · 편집 작업대'],
  ['12유전02-02', '유전 부호 — 코돈, 종결 코돈, 코돈의 중복성, 틀 이동', '시즌 7–8 · 편집 작업대'],
  ['12유전02-04', '세포 분화와 전능성 — 조직배양, 클론', '조직배양 시약, 조직배양 랩'],
  ['12유전03-04', '생명공학 기술 — 유전자 변형 생물체(LMO)', '바이오테크 하우스, 형질전환 벡터'],
  ['12유전03-05', '생명윤리 — LMO의 유전자 흐름, 브랜드 철학의 선택과 대가', '꽃가루 유출, 끝 화면 성찰'],
];

export function openTeacher(ctx: Ctx): void {
  const found = new Set(ctx.game.state.discoveries);
  const clearBtn = button('저장 지우기', () => {
    ctx.game.clearSave();
    ctx.toast.show('진행 저장을 지웠어요.', 'good');
    ctx.render();
  }, { class: 'btn--discard' });
  const wipeBtn = button('모든 기록 지우기', () => {
    ctx.game.clearSave();
    wipeAll();
    ctx.brand = '';
    ctx.toast.show('이 기기에 남은 기록(진행 저장·브랜드 이름·성찰·설정)을 모두 지웠어요.', 'good');
    ctx.render();
  }, { class: 'btn--discard' });
  ctx.modals.open({
    title: '선생님 안내',
    kicker: '「생물의 유전」 수업용',
    className: 'modal--teacher',
    wide: true,
    content: h(
      'div',
      { class: 'teacher' },
      h(
        'section',
        { class: 'teacher__privacy panel panel--gold' },
        h('h3', null, '개인정보'),
        h('p', null, h('b', null, '학생 개인정보를 수집하지 않아요. 모든 기록은 이 기기 브라우저에만 남고 [저장 지우기]로 지울 수 있어요.')),
        h(
          'ul',
          { class: 'teacher__list' },
          h('li', null, '이 기기에 남는 것: 게임 진행 저장, 브랜드 이름(선택, 12자 이내), 끝 화면의 성찰 한 줄, 소리·화면 설정. 목적은 이어하기와 수업 중 돌아보기뿐이에요.'),
          h('li', null, '서버·계정·외부 전송이 없어요. 제3자 제공도, 처리 위탁도 없어요. 외부 글꼴·분석 도구도 부르지 않아요.'),
          h('li', null, '보관 기간: 학생이 지우거나 브라우저 데이터를 지울 때까지. 게임이 끝나면 진행 저장은 자동으로 지워져요.'),
          h('li', null, '브랜드 이름 칸에는 실명·학번을 쓰지 않도록 안내해 주세요.'),
        ),
        h('div', { class: 'teacher__btns' }, clearBtn, wipeBtn),
      ),
      h(
        'section',
        null,
        h('h3', null, '개념 ↔ 성취기준'),
        h(
          'table',
          { class: 'teacher__table' },
          h('thead', null, h('tr', null, h('th', null, '성취기준'), h('th', null, '게임 속 개념'), h('th', null, '어디서 겪나'), h('th', null, '이 기기 발견'))),
          h(
            'tbody',
            null,
            ...STANDARDS.map(([code, what, where]) => {
              const ids = ORDER.filter((id) => CONCEPTS[id].standard === code);
              const n = ids.filter((id) => found.has(id)).length;
              return h('tr', null, h('td', { class: 'num' }, code), h('td', null, what), h('td', null, where), h('td', { class: 'num' }, ids.length ? `${n}/${ids.length}` : '—'));
            }),
          ),
        ),
      ),
      h(
        'section',
        null,
        h('h3', null, '수업 모드'),
        h(
          'ul',
          { class: 'teacher__list' },
          h('li', null, h('b', null, '전체 8시즌'), ' — 한 판 40~60분. 멘델 유전부터 유전자 편집·LMO까지.'),
          h('li', null, h('b', null, '빠른 4시즌'), ' — 한 차시(25~35분). 멘델 유전·다유전자·성염색체.'),
          h('li', null, h('b', null, '단원 연습'), ' — 성염색체(시즌 3–4) · 염색체 이상(시즌 5–6) · 유전자 편집(시즌 7–8)부터 시작 온실을 줘요.'),
          h('li', null, '퀴즈가 없어요. 개념 카드는 학생이 그 현상을 겪은 뒤에 떠요. 각 카드는 虛(게임 설정)와 原(실제 과학)을 나눠 적었어요.'),
          h('li', null, '끝 화면에서 온실 포기들의 실제 유전자형·핵형·계보가 공개돼요. 추론한 것과 비교하게 해 보세요.'),
        ),
      ),
      h('section', null, h('h3', null, '성취기준별 연구 노트'), button('연구 노트 성취기준별로 보기', () => openNotes(ctx, 'standard'), { class: 'btn--ghost' })),
    ),
  });
}
