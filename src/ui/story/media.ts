// 영상·그림 파일 경로와 불러오기 확인. 모든 파일은 같은 출처(public/film → dist/film)에서만 읽는다(CSP default-src 'self').
// 경로는 상대 경로라 GitHub Pages 하위 경로(base './')에서도 그대로 동작한다. 목록은 docs/FILM-ASSETS.md.
import type { SceneDef } from '../../game/story';

export const FILM = {
  intro: 'film/intro.mp4',
  introPoster: 'film/intro-poster.webp',
  titleLoop: 'film/title-loop.mp4',
  ending: 'film/ending.webp',
} as const;

export function sceneMedia(scene: SceneDef): { video: string; still: string } {
  return { video: `film/${scene.file}.mp4`, still: `film/${scene.file}.webp` };
}

/** 그림이 실제로 불러와지는지 확인한다. 없거나 깨졌으면 false */
export function probeImage(src: string, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeout);
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.decoding = 'async';
    img.src = src;
  });
}

/** 영상의 첫 장면을 그릴 수 있을 때까지 기다린다 */
export function waitForVideo(video: HTMLVideoElement, timeout = 6000): Promise<'ready' | 'error' | 'timeout'> {
  return new Promise((resolve) => {
    if (video.readyState >= 2) { resolve('ready'); return; }
    let done = false;
    const finish = (result: 'ready' | 'error' | 'timeout') => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeEventListener('loadeddata', ready);
      video.removeEventListener('error', fail);
      resolve(result);
    };
    const ready = () => finish('ready');
    const fail = () => finish('error');
    const timer = setTimeout(() => finish('timeout'), timeout);
    video.addEventListener('loadeddata', ready);
    video.addEventListener('error', fail);
  });
}

/** 소리를 켠 재생이 막히면 소리를 끄고 다시 시도한다. 그래도 안 되면 false */
export async function startVideo(video: HTMLVideoElement): Promise<boolean> {
  try {
    await video.play();
    return true;
  } catch {
    if (!video.muted) {
      video.muted = true;
      try {
        await video.play();
        return true;
      } catch { /* fall through */ }
    }
    return false;
  }
}

export function makeVideo(src: string, opts: { muted: boolean; loop?: boolean; poster?: string; className?: string }): HTMLVideoElement {
  const video = document.createElement('video');
  video.className = opts.className ?? '';
  video.muted = opts.muted;
  video.defaultMuted = opts.muted;
  video.loop = !!opts.loop;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  video.preload = 'auto';
  video.disablePictureInPicture = true;
  if (opts.poster) video.poster = opts.poster;
  video.src = src;
  return video;
}
