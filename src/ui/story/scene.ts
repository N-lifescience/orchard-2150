// 장면 영상 — 이야기 고비마다 6~8초. 영상 → 정지 그림 → (둘 다 없으면) 조용히 건너뛴다.
// 자막은 HTML로 1~3줄 얹는다. 「건너뛰기」는 늘 보이고, 소리 설정은 소개 영상과 함께 쓴다.
import type { SceneDef } from '../../game/story';
import { h, setText } from '../h';
import { play } from '../motion';
import { makeVideo, probeImage, sceneMedia, startVideo, waitForVideo } from './media';
import { FILM_UI } from './script';

export interface SceneOptions {
  reduced: boolean;
  soundOn: boolean;
  onSound(on: boolean): void;
}

export type SceneResult = 'video' | 'still' | 'missing' | 'skipped';

export async function playScene(scene: SceneDef, opts: SceneOptions): Promise<SceneResult> {
  const files = sceneMedia(scene);
  let video: HTMLVideoElement | null = null;
  if (!opts.reduced) {
    const candidate = makeVideo(files.video, { muted: !opts.soundOn, className: 'scene__video' });
    const state = await waitForVideo(candidate, 5000);
    if (state === 'ready') video = candidate;
    else { candidate.removeAttribute('src'); candidate.load(); }
  }
  let still: HTMLImageElement | null = null;
  if (!video) {
    if (!(await probeImage(files.still))) return 'missing';
    still = h('img', { class: 'scene__still', src: files.still, alt: '', draggable: false });
  }

  return new Promise<SceneResult>((resolve) => {
    const restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const captions = h('div', { class: 'scene__captions' }, ...scene.captions.slice(0, 3).map((text, i) =>
      h('p', { class: ['scene__caption', i === 0 && 'scene__caption--lead'], style: { '--i': i } }, text)));
    const skip = h('button', { type: 'button', class: 'film__btn scene__skip' }, FILM_UI.skip);
    const controls = h('div', { class: 'film__controls scene__controls' });
    let sound: HTMLButtonElement | null = null;
    if (video) {
      sound = h('button', { type: 'button', class: 'film__btn film__sound', 'aria-pressed': String(!video.muted) }, video.muted ? FILM_UI.soundOn : FILM_UI.soundOff);
      controls.appendChild(sound);
    }
    controls.appendChild(skip);
    let next: HTMLButtonElement | null = null;
    if (still) {
      next = h('button', { type: 'button', class: 'film__btn film__next' }, FILM_UI.continue);
      controls.appendChild(next);
    }
    const root = h('div', { class: ['scene', still ? 'is-still' : 'is-video', scene.captionPlace === 'top' && 'is-captions-top'], role: 'dialog', 'aria-modal': 'true', 'aria-label': `${FILM_UI.sceneLabel}: ${scene.label}`, tabindex: '-1' },
      h('div', { class: 'scene__media' }, video ?? still),
      h('div', { class: 'film__grain', 'aria-hidden': 'true' }),
      h('div', { class: 'film__frame', 'aria-hidden': 'true' },
        h('span', { class: 'film__corner film__corner--tl' }), h('span', { class: 'film__corner film__corner--tr' }),
        h('span', { class: 'film__corner film__corner--bl' }), h('span', { class: 'film__corner film__corner--br' })),
      captions, controls);
    document.body.dataset.story = 'on';

    let finished = false;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: SceneResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      window.removeEventListener('keydown', onKey, true);
      video?.pause();
      void play(root, [{ opacity: 1 }, { opacity: 0 }], { duration: 360 }).then(() => {
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
        const items = [...controls.querySelectorAll<HTMLElement>('button')];
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    skip.addEventListener('click', () => finish('skipped'));
    next?.addEventListener('click', () => finish('still'));
    sound?.addEventListener('click', () => {
      if (!video || !sound) return;
      const on = video.muted;
      video.muted = !on;
      sound.setAttribute('aria-pressed', String(on));
      setText(sound, on ? FILM_UI.soundOff : FILM_UI.soundOn);
      opts.onSound(on);
    });
    document.body.appendChild(root);
    root.focus({ preventScroll: true });
    (next ?? skip).focus({ preventScroll: true });
    void play(root, [{ opacity: 0 }, { opacity: 1 }], { duration: 360 });

    if (video) {
      const v = video;
      v.addEventListener('ended', () => { guard = setTimeout(() => finish('video'), 700); });
      v.addEventListener('error', () => finish('video'));
      void startVideo(v).then((ok) => {
        if (finished) return;
        if (!ok) { finish('video'); return; }
        if (v.muted && sound) { sound.setAttribute('aria-pressed', 'false'); setText(sound, FILM_UI.soundOn); }
        const length = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 12;
        guard = setTimeout(() => finish('video'), Math.min(30, length + 2) * 1000);
      });
    }
  });
}
