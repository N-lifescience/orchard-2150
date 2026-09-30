// 설정 — 음량(전체·음악·효과), 음소거, 연출 속도, 동작 줄이기, 저장 지우기, 모든 기록 지우기
import { audio, audioDebug } from '../../audio';
import type { Ctx } from '../ctx';
import { h, button } from '../h';
import { savePrefs, wipeAll, type Speed } from '../prefs';

function volumes(): { master: number; music: number; sfx: number } {
  try {
    return audioDebug.volumes();
  } catch {
    return { master: 0.9, music: 0.55, sfx: 0.8 };
  }
}

export function openSettings(ctx: Ctx): void {
  const v = volumes();
  const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
    const out = h('output', { class: 'num' }, `${Math.round(v[key] * 100)}`);
    const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(v[key] * 100)), 'aria-label': `${label} 음량` });
    input.addEventListener('input', () => {
      v[key] = Number(input.value) / 100;
      out.textContent = input.value;
      audio.setVolume(v.master, v.music, v.sfx);
    });
    input.addEventListener('change', () => audio.play('select'));
    return h('label', { class: 'set__row' }, h('span', { class: 'set__lbl' }, label), input, out);
  };
  const mute = h('input', { type: 'checkbox', checked: audio.muted });
  mute.addEventListener('change', () => audio.setMuted(mute.checked));
  const reduce = h('input', { type: 'checkbox', checked: ctx.prefs.reduceMotion });
  reduce.addEventListener('change', () => {
    ctx.prefs.reduceMotion = reduce.checked;
    savePrefs(ctx.prefs);
    ctx.applyPrefs();
  });
  const speeds: Speed[] = [1, 2, 4];
  const speedBtns = speeds.map((sp) =>
    button(`${sp}×`, () => {
      ctx.prefs.speed = sp;
      savePrefs(ctx.prefs);
      ctx.applyPrefs();
      for (const b of speedBtns) b.setAttribute('aria-pressed', String(b.textContent === `${ctx.prefs.speed}×`));
    }, { class: 'btn--seg', 'aria-pressed': String(ctx.prefs.speed === sp) }),
  );
  const inRun = ctx.screen === 'run';
  const m = ctx.modals.open({
    title: '설정',
    className: 'modal--settings',
    content: h(
      'div',
      { class: 'set' },
      h('section', { class: 'set__sec' }, h('h3', null, '소리'), slider('전체', 'master'), slider('음악', 'music'), slider('효과', 'sfx'), h('label', { class: 'set__row set__check' }, mute, h('span', null, '음소거'))),
      h(
        'section',
        { class: 'set__sec' },
        h('h3', null, '연출'),
        h('div', { class: 'set__row' }, h('span', { class: 'set__lbl' }, '연출 속도'), h('div', { class: 'sortbox', role: 'group', 'aria-label': '연출 속도' }, ...speedBtns)),
        h('label', { class: 'set__row set__check' }, reduce, h('span', null, '동작 줄이기 (흔들림·부유·불꽃 끄기)')),
        h('p', { class: 'hint' }, '점수 연출 중에는 화면을 누르거나 Space 키로 빨리 감을 수 있어요.'),
      ),
      h(
        'section',
        { class: 'set__sec' },
        h('h3', null, '기록'),
        h('p', { class: 'hint' }, inRun
          ? '진행은 자동으로 저장돼요. 홈에서 이어하기와 기록 지우기를 할 수 있어요.'
          : '모든 기록은 이 기기 브라우저에만 있어요. 서버로 보내지 않아요.'),
        inRun ? null : h(
          'div',
          { class: 'set__btns' },
          button('저장 지우기', () => {
            ctx.game.clearSave();
            window.location.reload();
          }, { class: 'btn--discard' }),
          button('모든 기록 지우기', () => {
            wipeAll();
            window.location.reload();
          }, { class: 'btn--discard' }),
        ),
      ),
      h('section', { class: 'set__sec' }, h('h3', null, '조작'), h('p', { class: 'hint' }, '1–8 모종 고르기 · Enter 출하 · D 솎아내기 · S 정렬 바꾸기 · Space 빨리 감기 · Esc 설정 열기/닫기')),
    ),
    actions: [
      inRun ? button('저장하고 홈으로', () => {
        m.close();
        ctx.goTitle();
      }, { class: 'btn--ghost' }) : null,
      button('닫기', () => m.close(), { class: 'btn--play' }),
    ],
  });
}
