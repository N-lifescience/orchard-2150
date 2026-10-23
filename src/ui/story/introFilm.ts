// 소개 영상 — 처음 접속할 때 제목 화면보다 먼저. 영상 위에 HTML HUD(꼬리표·바코드·영수증·카운터·조준 모서리)를 얹는다.
// 영상에는 글자를 넣지 않는다. 바코드는 장식용 SVG다. 동작 줄이기는 포스터와 고정 HUD, 영상이 없으면 곧장 제목 화면.
import { h, svg, setText } from '../h';
import { play } from '../motion';
import { activeCueIds, barcodeBars, counterValue, cueScale } from './cues';
import { FILM, makeVideo, probeImage, startVideo, waitForVideo } from './media';
import { FILM_UI, INTRO_CUES, INTRO_STATIC_CUES, type IntroCue } from './script';

export type FilmResult = 'ended' | 'skipped' | 'failed' | 'static';

export interface FilmOptions {
  reduced: boolean;
  soundOn: boolean;
  /** 소리 단추를 누르면 (모든 영상이 함께 쓰는 설정) */
  onSound(on: boolean): void;
}

function barcode(text: string): SVGSVGElement {
  const bars = barcodeBars(text);
  let x = 0;
  const rects: SVGRectElement[] = [];
  bars.forEach((w, i) => {
    if (i % 2 === 0) rects.push(svg('rect', { x, y: 0, width: w, height: 24 }));
    x += w + 1;
  });
  return svg('svg', { class: 'cue__barcode', viewBox: `0 0 ${x} 24`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, ...rects);
}

function cueEl(cue: IntroCue): { el: HTMLElement; value?: HTMLElement } {
  const cls = ['cue', `cue--${cue.kind}`, `cue--lane-${cue.lane}`];
  switch (cue.kind) {
    case 'tag':
      return { el: h('div', { class: cls, dataset: { cue: cue.id } },
        h('span', { class: 'cue__hole', 'aria-hidden': 'true' }),
        h('span', { class: 'cue__text' }, cue.text),
        cue.sub ? h('span', { class: 'cue__sub' }, cue.sub) : null,
        cue.barcode ? barcode(cue.text) : null) };
    case 'receipt':
      return { el: h('div', { class: cls, dataset: { cue: cue.id } },
        h('span', { class: 'cue__label' }, cue.text), h('span', { class: 'cue__value' }, cue.sub ?? '')) };
    case 'counter': {
      const value = h('span', { class: 'cue__value' }, String(cue.from ?? 0));
      return { el: h('div', { class: cls, dataset: { cue: cue.id } },
        h('span', { class: 'cue__label' }, cue.text), value, h('span', { class: 'cue__unit' }, `/ ${cue.to ?? ''}`)), value };
    }
    case 'logo':
      return { el: h('div', { class: cls, dataset: { cue: cue.id } },
        h('span', { class: 'cue__wordmark' }, cue.text.split(' ')[0]), h('span', { class: 'cue__year' }, cue.text.split(' ')[1] ?? '')) };
    default:
      return { el: h('div', { class: cls, dataset: { cue: cue.id } }, h('span', { class: 'cue__text' }, cue.text)) };
  }
}

/** 영상을 끝까지 보거나 건너뛰면 끝난다. 결과는 기록용이다. */
export function playIntroFilm(host: HTMLElement, opts: FilmOptions): Promise<FilmResult> {
  return new Promise((resolve) => {
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const cues = INTRO_CUES.map((cue) => ({ cue, ...cueEl(cue) }));
    const hud = h('div', { class: 'film__hud', 'aria-hidden': 'true' }, ...cues.map((c) => c.el));
    const frame = h('div', { class: 'film__frame', 'aria-hidden': 'true' },
      h('span', { class: 'film__corner film__corner--tl' }), h('span', { class: 'film__corner film__corner--tr' }),
      h('span', { class: 'film__corner film__corner--bl' }), h('span', { class: 'film__corner film__corner--br' }),
      h('span', { class: 'film__cross' }));
    const timecode = h('span', { class: 'film__timecode', 'aria-hidden': 'true' }, '00:00');
    const grain = h('div', { class: 'film__grain', 'aria-hidden': 'true' });
    const media = h('div', { class: 'film__media' });
    const sound = h('button', { type: 'button', class: 'film__btn film__sound', 'aria-pressed': String(opts.soundOn) }, opts.soundOn ? FILM_UI.soundOff : FILM_UI.soundOn);
    const skip = h('button', { type: 'button', class: 'film__btn film__skip' }, FILM_UI.skip);
    const controls = h('div', { class: 'film__controls' }, sound, skip);
    const root = h('div', { class: 'film', role: 'dialog', 'aria-modal': 'true', 'aria-label': FILM_UI.introLabel, tabindex: '-1' },
      media, grain, frame, hud, timecode,
      h('p', { class: 'film__sr' }, FILM_UI.introSummary),
      controls);
    document.body.dataset.story = 'on';

    let finished = false;
    let raf = 0;
    let poll: ReturnType<typeof setInterval> | undefined;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let video: HTMLVideoElement | null = null;

    const finish = (result: FilmResult) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      clearInterval(poll);
      clearTimeout(hold);
      window.removeEventListener('keydown', onKey, true);
      video?.pause();
      void play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }).then(() => {
        root.remove();
        if (video) { video.removeAttribute('src'); video.load(); }
        delete document.body.dataset.story;
        if (restore?.isConnected) restore.focus({ preventScroll: true });
        resolve(result);
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish('skipped'); }
      else if (e.key === 'Tab') {
        const items = [...controls.querySelectorAll<HTMLElement>('button')].filter((b) => !b.hidden);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    skip.addEventListener('click', () => finish('skipped'));
    sound.addEventListener('click', () => {
      const on = sound.getAttribute('aria-pressed') !== 'true';
      sound.setAttribute('aria-pressed', String(on));
      setText(sound, on ? FILM_UI.soundOff : FILM_UI.soundOn);
      if (video) video.muted = !on;
      opts.onSound(on);
    });
    window.addEventListener('keydown', onKey, true);

    const show = (ids: readonly string[], t: number, scale: number) => {
      for (const c of cues) {
        const on = ids.includes(c.cue.id);
        if (c.el.classList.contains('is-on') !== on) c.el.classList.toggle('is-on', on);
        if (on && c.value) setText(c.value, String(counterValue(c.cue, t, scale)));
      }
    };

    const showStatic = (posterOk: boolean) => {
      root.classList.add('is-static');
      if (posterOk) media.appendChild(h('img', { class: 'film__poster', src: FILM.introPoster, alt: '', draggable: false }));
      for (const c of cues) {
        const on = (INTRO_STATIC_CUES as readonly string[]).includes(c.cue.id);
        c.el.classList.toggle('is-on', on);
        if (c.value) setText(c.value, String(c.cue.to ?? 0));
      }
      sound.hidden = true;
      const next = h('button', { type: 'button', class: 'film__btn film__next' }, FILM_UI.continue);
      next.addEventListener('click', () => finish('static'));
      skip.hidden = true;
      controls.appendChild(next);
      queueMicrotask(() => next.focus({ preventScroll: true }));
    };

    host.appendChild(root);
    root.focus({ preventScroll: true });

    if (opts.reduced) {
      void probeImage(FILM.introPoster).then(showStatic);
      return;
    }

    video = makeVideo(FILM.intro, { muted: !opts.soundOn, poster: FILM.introPoster, className: 'film__video' });
    media.appendChild(video);
    const v = video;
    const tick = () => {
      if (finished) return;
      const scale = cueScale(v.duration);
      const t = v.currentTime;
      show(activeCueIds(t, scale), t, scale);
      const s = Math.floor(t);
      setText(timecode, `00:${String(s).padStart(2, '0')}`);
    };
    const loop = () => { tick(); if (!finished && !v.paused) raf = requestAnimationFrame(loop); };
    v.addEventListener('playing', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
    // A background tab may throttle animation frames; timeupdate keeps the HUD close to the picture.
    v.addEventListener('timeupdate', tick);
    v.addEventListener('ended', () => {
      tick();
      hold = setTimeout(() => finish('ended'), 1400);
    });
    v.addEventListener('error', () => finish('failed'));
    void waitForVideo(v, 6000).then(async (state) => {
      if (finished) return;
      if (state !== 'ready') { finish('failed'); return; }
      root.classList.add('is-playing');
      const started = await startVideo(v);
      if (finished) return;
      if (v.muted && sound.getAttribute('aria-pressed') === 'true') {
        sound.setAttribute('aria-pressed', 'false');
        setText(sound, FILM_UI.soundOn);
      }
      if (!started) {
        // Autoplay is blocked: one tap starts the film, the skip stays available.
        const start = h('button', { type: 'button', class: 'film__btn film__play' }, FILM_UI.play);
        start.addEventListener('click', () => { start.remove(); void startVideo(v); });
        controls.prepend(start);
        start.focus({ preventScroll: true });
      }
      poll = setInterval(tick, 250);
    });
  });
}
