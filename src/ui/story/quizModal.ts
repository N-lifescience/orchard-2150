// 시즌 끝 확인 질문 창 — 한 문항씩. 틀리면 힌트와 엘레나의 노트, 몇 번이든 다시 고른다.
// 모두 맞히면 game.passQuiz(season) 을 기록하고 true. 창을 닫으면 false (다음 시즌은 열리지 않는다).
import { characterPortrait } from '../../art';
import { answerQuestion, attemptPassed, quizFor, startAttempt } from '../../game/quiz';
import { FINAL_QUIZ_INTRO_LINE, QUIZ_INTRO_LINE, SEASON_END_LINES } from '../../game/story';
import { audio } from '../../audio';
import type { Ctx } from '../ctx';
import { button, h, replaceChildren, setText } from '../h';
import { openNoteSheet } from './noteView';
import { traitBadge } from '../traitBadge';
import { QUIZ_UI } from './script';

export function openSeasonQuiz(ctx: Ctx, season: number, final: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const questions = quizFor(season, ctx.game.state.policy, ctx.game.state.mode);
    if (!questions.length) {
      ctx.game.passQuiz(season);
      resolve(true);
      return;
    }
    const attempt = startAttempt(questions);
    let index = 0;
    let choice: number | null = null;
    let passed = false;

    const portrait = characterPortrait('레아 모레노', 120);
    portrait.classList.add('quiz__face');
    const count = h('span', { class: 'quiz__count' });
    const progress = h('div', { class: 'quiz__dots', 'aria-hidden': 'true' }, ...questions.map(() => h('span')));
    const prompt = h('p', { class: 'quiz__prompt', id: `quiz-prompt-${season}` });
    const pictures = h('div', { class: 'quiz__pictures' });
    const choices = h('div', { class: 'quiz__choices', role: 'radiogroup', 'aria-labelledby': `quiz-prompt-${season}` });
    const feedback = h('div', { class: 'quiz__feedback', 'aria-live': 'polite', hidden: true });
    const actions = h('div', { class: 'quiz__actions' });
    const body = h('div', { class: 'quiz' },
      h('div', { class: 'quiz__lea' }, portrait, h('div', { class: 'quiz__intro' },
        h('p', null, (final ? SEASON_END_LINES[8] : SEASON_END_LINES[season]) ?? ''),
        h('p', null, final ? FINAL_QUIZ_INTRO_LINE : QUIZ_INTRO_LINE))),
      h('p', { class: 'quiz__rule' }, QUIZ_UI.rule),
      h('div', { class: 'quiz__head' }, count, progress),
      prompt, pictures, choices, feedback, actions);

    const modal = ctx.modals.open({
      title: QUIZ_UI.title(season), kicker: QUIZ_UI.kicker, className: 'modal--quiz', content: body,
      onClose: () => resolve(passed),
    });

    const draw = () => {
      const q = questions[index];
      choice = null;
      setText(count, QUIZ_UI.count(index + 1, questions.length));
      [...progress.children].forEach((dot, i) => {
        dot.classList.toggle('is-done', attempt.solved[i]);
        dot.classList.toggle('is-now', i === index);
      });
      setText(prompt, q.prompt);
      replaceChildren(pictures, ...(q.id === 's2-two-traits' ? [traitBadge({ color: 'gold', marked: false }, '골드, 매끈한 껍질 (rrss)')] : q.id.includes('gold') || q.id === 's8-combine' ? [traitBadge({ color: 'gold' }, '골드 과육')] : q.note === 'triploid' ? [traitBadge({ seedless: true }, '씨 없는 열매')] : ['purebred', 'segregation', 'heterozygote'].includes(q.note) ? [traitBadge({ color: 'ruby' }, '루비 과육'), traitBadge({ color: 'gold' }, '골드 과육')] : q.note === 'xlinked' ? [traitBadge({ species: 'stella', marked: true }, '은빛 잎'), traitBadge({ species: 'stella', marked: false }, '초록 잎')] : []));
      pictures.hidden = !pictures.childElementCount;
      const tried = attempt.tries[index];
      replaceChildren(choices, ...q.choices.map((text, i) => {
        const b = h('button', {
          type: 'button', role: 'radio', class: ['quiz__choice', tried.includes(i) && 'is-tried'], 'aria-checked': 'false',
          onclick: () => {
            if (attempt.solved[index]) return;
            choice = i;
            choices.querySelectorAll('.quiz__choice').forEach((el, k) => el.setAttribute('aria-checked', String(k === i)));
            checkBtn.disabled = false;
            audio.play('select');
          },
        }, h('span', { class: 'quiz__mark', 'aria-hidden': 'true' }, String.fromCharCode(0x2460 + i)), h('span', null, text),
          tried.includes(i) ? h('span', { class: 'quiz__tried' }, QUIZ_UI.tried) : null);
        return b;
      }));
      feedback.hidden = true;
      feedback.className = 'quiz__feedback';
      const checkBtn = button(QUIZ_UI.check, () => check(), { class: 'btn--play' });
      checkBtn.disabled = true;
      replaceChildren(actions, checkBtn);
      queueMicrotask(() => (choices.querySelector<HTMLElement>('.quiz__choice') ?? checkBtn).focus({ preventScroll: true }));
    };

    const check = () => {
      if (choice === null) return;
      const q = questions[index];
      const right = answerQuestion(attempt, index, choice);
      feedback.hidden = false;
      feedback.classList.toggle('is-right', right);
      feedback.classList.toggle('is-wrong', !right);
      choices.querySelectorAll<HTMLButtonElement>('.quiz__choice').forEach((el, k) => {
        el.disabled = right;
        el.classList.toggle('is-correct', right && k === q.answer);
      });
      if (right) {
        audio.play('discovery');
        replaceChildren(feedback, h('strong', null, QUIZ_UI.right), h('p', null, q.explain));
        const last = attempt.solved.every(Boolean);
        const nextIndex = attempt.solved.findIndex((solved) => !solved);
        const go = button(last ? (final ? QUIZ_UI.passFinal : QUIZ_UI.pass) : QUIZ_UI.next, () => {
          if (last && attemptPassed(attempt)) {
            ctx.game.passQuiz(season);
            passed = true;
            modal.close();
            return;
          }
          index = nextIndex < 0 ? index : nextIndex;
          draw();
        }, { class: 'btn--play' });
        replaceChildren(actions, go);
        go.focus({ preventScroll: true });
        [...progress.children][index]?.classList.add('is-done');
      } else {
        audio.play('error');
        replaceChildren(feedback, h('strong', null, QUIZ_UI.wrong), h('p', null, q.hint));
        const retry = button(QUIZ_UI.retry, () => draw(), { class: 'btn--play' });
        replaceChildren(actions,
          button(QUIZ_UI.note, () => openNoteSheet(ctx, q.note), { class: 'btn--ghost' }),
          retry);
        retry.focus({ preventScroll: true });
      }
    };
    draw();
  });
}
