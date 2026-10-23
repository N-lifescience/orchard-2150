// 엘레나의 노트 한 쪽 — 메모 → 핵심 → (더 읽기: 왜 중요한가·낱말 뜻·외우기 요령·오해 바로잡기·실제 과학·게임 규칙) → 확인 질문.
// 발견 카드에서는 핵심만 펼치고 나머지는 접는다. 노트에서는 모두 펼친다.
import type { ConceptDef, ConceptId } from '../../contract/game';
import { CONCEPTS } from '../../game';
import { ELENA_NOTES, NOTE_LAYER_LABELS as L } from '../../game/elenaNotes';
import type { Ctx } from '../ctx';
import { button, h, replaceChildren, setText } from '../h';
import { NOTES_UI } from './script';

function paragraphs(text: string): HTMLElement[] {
  return text.split(/\n\s*\n/).filter(Boolean).map((part) => h('p', null, part));
}

function section(label: string, ...children: (HTMLElement | null)[]): HTMLElement {
  return h('section', { class: 'enote__layer' }, h('h4', { class: 'enote__label' }, label), ...children);
}

/** 확인 질문 — 답을 고르면 바로 풀이를 보여 준다. 게임 상태와 무관한 연습 문제다. */
function checkQuestion(id: ConceptId): HTMLElement {
  const q = ELENA_NOTES[id].check;
  const feedback = h('p', { class: 'enote__feedback', 'aria-live': 'polite', hidden: true });
  const buttons: HTMLButtonElement[] = [];
  q.choices.forEach((choice, i) => {
    const b = button(choice, () => {
      buttons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      const right = i === q.answer;
      feedback.hidden = false;
      feedback.classList.toggle('is-right', right);
      feedback.classList.toggle('is-wrong', !right);
      setText(feedback, right ? `${NOTES_UI.checkRight} ${q.explain}` : NOTES_UI.checkWrong);
    }, { class: 'btn--seg enote__choice', 'aria-pressed': 'false' });
    buttons.push(b);
  });
  return section(L.check, h('p', { class: 'enote__question' }, q.question), h('div', { class: 'enote__choices', role: 'group', 'aria-label': L.check }, ...buttons), feedback);
}

export function noteCard(c: ConceptDef, opts: { compact: boolean }): HTMLElement {
  const n = ELENA_NOTES[c.id];
  const details: HTMLElement[] = [
    section(L.why, h('p', null, n.why)),
    section(L.terms, h('dl', { class: 'enote__terms' }, ...n.terms.flatMap(([term, meaning]) => [h('dt', null, term), h('dd', null, meaning)]))),
    section(L.mnemonic, h('p', { class: 'enote__mnemonic' }, n.mnemonic)),
    section(L.misconception, h('div', { class: 'enote__myth' },
      h('p', { class: 'enote__wrong' }, h('b', null, `${L.wrong} `), n.misconception.wrong),
      h('p', { class: 'enote__right' }, h('b', null, `${L.right} `), n.misconception.right))),
    h('section', { class: 'concept__box concept__box--real' }, h('h4', { class: 'concept__tag' }, L.real), ...paragraphs(c.real)),
    ...(c.fiction ? [h('section', { class: 'concept__box concept__box--fiction' }, h('h4', { class: 'concept__tag' }, L.fiction), ...paragraphs(c.fiction))] : []),
  ];
  return h('div', { class: ['enote', 'concept', opts.compact && 'enote--compact'] },
    h('blockquote', { class: 'enote__memo' }, h('span', { class: 'enote__memo-label' }, L.memo), h('p', null, n.memo)),
    h('div', { class: 'enote__happened' }, h('span', { class: 'enote__label' }, L.happened), ...paragraphs(c.body)),
    section(L.core, h('p', { class: 'enote__core' }, n.core)),
    opts.compact
      ? h('details', { class: 'enote__more' }, h('summary', null, L.more), ...details)
      : h('div', { class: 'enote__more is-open' }, ...details),
    checkQuestion(c.id),
    c.standard ? h('div', { class: 'concept__std' }, `성취기준 ${c.standard}`) : null,
  );
}

/** 아직 열리지 않은 쪽: 엘레나가 남긴 질문만 (답은 쓰지 않는다) */
export function blankNote(id: ConceptId): HTMLElement {
  return h('div', { class: 'enote enote--blank' },
    h('p', { class: 'enote__blank-label' }, L.locked),
    h('blockquote', { class: 'enote__memo' }, h('p', null, ELENA_NOTES[id].blank)));
}

/** 확인 질문에서 「엘레나의 노트 펼치기」를 눌렀을 때 그 쪽만 보여 준다. 발견 목록은 바꾸지 않는다. */
export function openNoteSheet(ctx: Ctx, id: ConceptId): void {
  const c = CONCEPTS[id];
  const body = h('div', { class: 'enote-sheet' });
  replaceChildren(body, noteCard(c, { compact: false }));
  ctx.modals.open({ title: c.title, kicker: `${NOTES_UI.title} · ${NOTES_UI.fromQuiz}`, className: 'modal--discovery modal--note-sheet', content: body });
}
