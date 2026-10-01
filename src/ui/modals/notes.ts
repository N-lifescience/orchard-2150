// 개념 카드(발견) · 연구 노트(도감) · 선생님 안내
import { audio } from '../../audio';
import type { ConceptDef, ConceptId } from '../../contract/game';
import { CONCEPTS } from '../../game';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren } from '../h';
import { play, motion } from '../motion';
import { wipeAll } from '../prefs';
import { activeRunSlot, removeRunSlot } from '../runSlots';

const ORDER = Object.keys(CONCEPTS) as ConceptId[];

function paragraphs(text: string): HTMLElement[] {
  return text.split(/\n\s*\n/).filter(Boolean).map((part) => h('p', null, part));
}

function conceptBody(c: ConceptDef): HTMLElement {
  return h('div', { class: 'concept' },
    h('div', { class: 'concept__body' }, ...paragraphs(c.body)),
    h('section', { class: 'concept__box concept__box--real' },
      h('h4', { class: 'concept__tag' }, '실제 과학에서는'), ...paragraphs(c.real)),
    c.fiction ? h('section', { class: 'concept__box concept__box--fiction' },
      h('h4', { class: 'concept__tag' }, '게임에서 정한 규칙'), ...paragraphs(c.fiction)) : null,
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

const CHAPTERS: { title: string; ids: ConceptId[] }[] = [
  { title: '교배와 유전', ids: ['segregation', 'purebred', 'selfing', 'heterozygote', 'dominanceMolecular'] },
  { title: '당도와 환경', ids: ['polygenic', 'environment'] },
  { title: '성염색체', ids: ['dioecy', 'xlinked'] },
  { title: '염색체 수', ids: ['polyploid', 'triploid', 'nondisjunction'] },
  { title: '유전자 편집', ids: ['transcription', 'stopCodon', 'synonymous', 'frameshift'] },
  { title: '생명공학', ids: ['lmo', 'geneFlow', 'clone'] },
];

export function openNotes(ctx: Ctx, by: 'all' | 'standard' = 'all'): void {
  const found = new Set(ctx.game.state.discoveries);
  let selected: ConceptId | null = ORDER.find((id) => found.has(id)) ?? null;
  let mode = by;
  const detail = h('article', { class: 'notes__detail', 'aria-live': 'polite', tabindex: '0', 'aria-label': '선택한 발견 기록 본문' });
  const grid = h('div', { class: 'notes__grid', tabindex: '0', 'aria-label': '연구 노트 목차' });
  const renderDetail = () => {
    if (!selected) {
      replaceChildren(detail, h('div', { class: 'notes__blank' },
        h('span', { class: 'notes__blank-mark', 'aria-hidden': 'true' }, '관찰 노트'),
        h('h3', null, '아직 첫 기록을 기다리고 있어요.'),
        h('p', null, '교배하거나 모종을 출하하면, 발견한 개념이 이 노트에 남아요.'),
        h('p', null, '왼쪽 목차에서 기록을 골라 다시 읽을 수 있어요.'),
      ));
      return;
    }
    const c = CONCEPTS[selected];
    const observed = [...ctx.game.state.records].reverse().find((record) => {
      if (['segregation', 'purebred', 'selfing', 'heterozygote', 'dominanceMolecular'].includes(c.id)) return !!record.prediction;
      if (c.id === 'polygenic') return record.goals.some((goal) => goal.trait.minBrix !== undefined);
      if (c.id === 'dioecy' || c.id === 'xlinked') return record.goals.some((goal) => goal.trait.species === 'stella' || goal.trait.sex !== undefined);
      if (c.id === 'triploid' || c.id === 'polyploid') return record.goals.some((goal) => goal.trait.seedless !== undefined);
      if (c.id === 'nondisjunction') return record.goals.some((goal) => goal.trait.euploid !== undefined);
      if (['transcription', 'stopCodon', 'synonymous', 'frameshift'].includes(c.id)) return record.goals.some((goal) => goal.trait.knockout !== undefined);
      if (c.id === 'lmo' || c.id === 'geneFlow') return record.goals.some((goal) => goal.trait.fluorescent !== undefined);
      return false;
    });
    const no = ORDER.indexOf(selected) + 1;
    const chapter = CHAPTERS.find((entry) => entry.ids.includes(c.id))?.title ?? '관찰 기록';
    replaceChildren(detail,
      h('div', { class: 'notes__detail-head' }, h('span', null, chapter), h('span', { class: 'notes__folio' }, `기록 ${String(no).padStart(2, '0')}`)),
      h('h3', { class: 'notes__title' }, c.title), conceptBody(c),
      observed ? h('section', { class: 'notes__observations' },
        h('h4', null, '내 과수원에서 관찰한 결과'),
        h('p', { class: 'notes__observation-source' }, `시즌 ${observed.ante} · ${observed.name} · ${observed.attempt}차 시도`),
        observed.parentGenotypes ? h('dl', { class: 'notes__data' },
          h('dt', null, '부모 유전자형'), h('dd', null, observed.parentGenotypes.join(' × '))) : null,
        observed.prediction ? h('dl', { class: 'notes__data' },
          h('dt', null, '꼬투리 52알'), h('dd', null, `루비 ${observed.prediction.ruby}알 / 골드 ${observed.prediction.gold}알`)) : null,
        ...observed.goals.map((goal) => h('dl', { class: 'notes__data' }, h('dt', null, goal.label), h('dd', null, `${observed.delivery[goal.id] ?? 0} / ${goal.count}포기 출하`))),
      ) : null,
      c.id === 'geneFlow' && ctx.game.state.geneFlow ? h('section', { class: 'notes__observations' },
        h('h4', null, '이 연대기의 최근 꽃가루 이동'),
        h('p', null, `${ctx.game.state.geneFlow.donor} → ${ctx.game.state.geneFlow.recipient}`),
        h('p', null, '수분받은 포기에서 생긴 씨 표본에 형광 형질이 나타났어요. 수분받은 성체의 유전자형은 바뀌지 않았어요.'),
      ) : null,
      h('footer', { class: 'notes__page-end' }, '오차드 2150 · 교배와 재배의 기록', h('span', null, no)),
    );
    detail.scrollTop = 0;
    void play(detail, [{ opacity: .55 }, { opacity: 1 }], { duration: 180, decorative: true });
  };
  const cardFor = (id: ConceptId) => {
    const c = CONCEPTS[id];
    const open = found.has(id);
    const no = String(ORDER.indexOf(id) + 1).padStart(2, '0');
    const b = h('button', { type: 'button', class: ['note', open ? 'is-open' : 'is-locked', selected === id && 'is-selected'],
      'aria-label': open ? `${no}번 기록, ${c.title}` : `${no}번 기록, 아직 발견하지 못함`,
      'aria-pressed': open ? String(selected === id) : undefined, disabled: !open,
    }, h('span', { class: 'note__num' }, no), h('span', { class: 'note__q' }, open ? c.title : '아직 발견하지 못했어요'), h('span', { class: 'note__state', 'aria-hidden': 'true' }, selected === id ? '→' : open ? '' : '—'));
    if (open) b.addEventListener('click', () => {
      audio.play('select'); selected = id;
      grid.querySelectorAll<HTMLElement>('.note').forEach((entry) => {
        const on = entry === b;
        entry.classList.toggle('is-selected', on);
        if (!entry.hasAttribute('disabled')) entry.setAttribute('aria-pressed', String(on));
        const state = entry.querySelector('.note__state');
        if (state && !entry.hasAttribute('disabled')) state.textContent = on ? '→' : '';
      });
      renderDetail();
    });
    return b;
  };
  const fill = (nextMode: 'all' | 'standard') => {
    mode = nextMode;
    let groups: [string, ConceptId[]][];
    if (mode === 'all') groups = CHAPTERS.map((chapter) => [chapter.title, chapter.ids.filter((id) => ORDER.includes(id))]);
    else {
      const standards = new Map<string, ConceptId[]>();
      for (const id of ORDER) { const key = CONCEPTS[id].standard ?? '기타'; standards.set(key, [...(standards.get(key) ?? []), id]); }
      groups = [...standards.entries()].sort();
    }
    replaceChildren(grid, ...groups.map(([title, ids]) => h('section', { class: 'notes__group' },
      h('div', { class: 'notes__chapter' }, h('h4', null, title), h('span', null, `${ids.filter((id) => found.has(id)).length} / ${ids.length}`)),
      h('div', { class: 'notes__row' }, ...ids.map(cardFor)),
    )));
    tabA.setAttribute('aria-pressed', String(mode === 'all'));
    tabB.setAttribute('aria-pressed', String(mode === 'standard'));
  };
  const tabA = button('단원별', () => fill('all'), { class: 'btn--seg' });
  const tabB = button('성취기준별', () => fill('standard'), { class: 'btn--seg' });
  fill(by); renderDetail();
  ctx.modals.open({
    title: '연구 노트', kicker: '오차드의 관찰 기록', className: 'modal--notes', wide: true,
    content: h('div', { class: 'notes' },
      h('div', { class: 'notes__cover' }, h('span', null, ctx.brand || '오차드 2150'), h('span', { class: 'notes__cover-count' }, `${found.size} / ${ORDER.length}개 발견`)),
      h('div', { class: 'notes__cols' },
        h('section', { class: 'notes__page notes__page--index', 'aria-label': '연구 노트 목차' },
          h('div', { class: 'notes__page-head' }, h('h3', null, '목차'), h('span', null, '발견한 기록을 고르세요')),
          h('div', { class: 'sortbox' }, tabA, tabB), grid),
        h('section', { class: 'notes__page notes__page--detail' }, detail),
      ),
    ),
  });
}

const STANDARDS: [string, string, string][] = [
  ['12유전01-01', '멘델 유전 — 우열·분리·독립, 순계, 자가수분, 성염색체(X 연관)', '시즌 1–4 · 교배 규칙 전체, 별다래(암수딴그루·X 연관)'],
  ['12유전01-03', '다유전자유전과 환경 — 연속 변이, 환경 변이는 유전 안 됨', '시즌 1–2 · 당도 8~20, 가뭄·비료'],
  ['12유전01-04', '염색체 이상 — 배수체, 3배체, 비분리와 이수성', '시즌 5–6 · 콜히친, 냉해'],
  ['12유전02-01', '유전자 발현 — 전사·번역, 우성·열성의 분자 원리', '시즌 7–8 · 편집 작업대'],
  ['12유전02-02', '유전 부호 — 코돈, 종결 코돈, 코돈의 중복성, 틀 이동', '시즌 7–8 · 편집 작업대'],
  ['12유전02-04', '세포 분화와 전능성 — 조직배양, 클론', '조직배양 시약, 조직배양 랩'],
  ['12유전03-04', '생명공학 기술 — 유전자 변형 생물체(LMO)', '생명공학팀, 형질전환 벡터'],
  ['12유전03-05', '생명윤리 — LMO의 유전자 흐름, 브랜드 철학의 선택과 대가', '꽃가루 유출, 끝 화면 성찰'],
];

export function openTeacher(ctx: Ctx): void {
  const found = new Set(ctx.game.state.discoveries);
  const activeSlot = activeRunSlot();
  const clearBtn = button('선택된 연대기 삭제', () => {
    if (!activeSlot) return;
    const m = ctx.modals.open({
      title: '선택된 연대기를 삭제할까요?',
      content: h('p', { class: 'hint' }, `${activeSlot.brand || '이름 없는 과수원'}의 진행만 이 기기에서 삭제합니다. 다른 연대기와 설정은 남아요.`),
      actions: [button('취소', () => m.close(), { class: 'btn--ghost' }), button('삭제', () => { removeRunSlot(activeSlot.id); window.location.reload(); }, { class: 'btn--discard' })],
    });
  }, { class: 'btn--discard' });
  clearBtn.disabled = !activeSlot;
  const wipeBtn = button('이 기기 기록 모두 삭제', () => {
    const m = ctx.modals.open({
      title: '이 기기 기록을 모두 삭제할까요?',
      content: h('p', { class: 'hint' }, '저장된 모든 연대기, 연구 노트, 이름, 성찰, 소리·화면 설정이 이 브라우저에서 삭제됩니다.'),
      actions: [button('취소', () => m.close(), { class: 'btn--ghost' }), button('모두 삭제', () => { wipeAll(); window.location.reload(); }, { class: 'btn--discard' })],
    });
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
        h('p', null, h('b', null, '학생 개인정보를 수집하지 않아요. 모든 기록은 이 기기 브라우저에만 남으며 아래 버튼으로 지울 수 있어요.')),
        h(
          'ul',
          { class: 'teacher__list' },
          h('li', null, '이 기기에 남는 것: 연대기별 진행·계약 관찰·성찰, 과수원 이름(선택, 12자 이내), 소리·화면 설정. 이어하기와 수업 중 돌아보기에 사용합니다.'),
          h('li', null, '서버·계정·외부 전송이 없어요. 제3자 제공도, 처리 위탁도 없어요. 외부 글꼴·분석 도구도 부르지 않아요.'),
          h('li', null, '보관 기간: 학생이 지우거나 브라우저 데이터를 지울 때까지. 완료한 연대기도 홈에서 다시 열 수 있습니다.'),
          h('li', null, '과수원 이름 칸에는 실명·학번을 쓰지 않도록 안내해 주세요.'),
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
        h('h3', null, '수업 시간과 진행 방식'),
        h(
          'ul',
          { class: 'teacher__list' },
          h('li', null, h('b', null, '전체 8시즌'), ' — 멘델 유전부터 유전자 편집·LMO까지. 두 차시에 나누어 진행하기를 권합니다.'),
          h('li', null, h('b', null, '빠른 4시즌'), ' — 멘델 유전·다유전자·성염색체. 25~35분을 배정하고 돌아보기 8~10분을 남겨 두세요.'),
          h('li', null, h('b', null, '단원 게임'), ' — 15~20분을 배정하고 돌아보기 8~10분을 남겨 두세요. 성염색체(시즌 3–4) · 염색체 이상(시즌 5–6) · 유전자 편집(시즌 7–8)의 준비된 온실에서 시작합니다. 시간은 수업 배정안이며 학생 대상 측정값은 아닙니다.'),
          h('li', null, h('b', null, '수업 모드'), '에서는 계약 실패 이유를 확인한 뒤 같은 계약을 다시 준비합니다. ', h('b', null, '도전 모드'), '에서는 실패하면 연대기가 끝납니다. 계약 조건은 같습니다.'),
          h('li', null, '개념 카드는 학생이 그 현상을 겪은 뒤에 열려요. 각 카드에는 게임 속 설정과 실제 과학을 나누어 적었어요.'),
          h('li', null, '끝 화면에서 온실 포기들의 실제 유전자형·핵형·계보가 공개돼요. 추론한 것과 비교하게 해 보세요.'),
        ),
      ),
      h('section', null,
        h('h3', null, '플레이 뒤 돌아보기 · 8~10분'),
        h('ol', { class: 'teacher__list' },
          h('li', null, '끝 화면의 플레이 보고서에서 한 계약을 고르고, 부모·예측·관찰 수치를 짝과 비교합니다.'),
          h('li', null, '부모의 유전자형을 근거로 결과를 설명합니다. 예측이 빗나갔다면 표본 수와 유전 가정을 함께 확인합니다.'),
          h('li', null, '같은 조건의 다른 부모 조합이라면 어떤 비율이 나올지 먼저 예측합니다. 게임에서 본 규칙이 실제 생물에도 적용되는 범위는 연구 노트의 실제 과학 항목과 대조합니다.'),
          h('li', null, '다음에 바꿀 선택과 이유를 연대기의 성찰에 적습니다. 보고서는 캡처하거나 텍스트 파일로 저장할 수 있습니다.'),
        ),
      ),
      h('section', null, h('h3', null, '성취기준별 연구 노트'), button('연구 노트 성취기준별로 보기', () => openNotes(ctx, 'standard'), { class: 'btn--ghost' })),
    ),
  });
}
