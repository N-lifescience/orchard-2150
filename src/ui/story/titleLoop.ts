// 제목 화면 뒤 8초 반복 영상 (소리 없음). 불러오지 못하거나 동작 줄이기면 기존 WebGL 배경을 그대로 쓴다.
import { FILM, makeVideo } from './media';

export class TitleLoop {
  readonly el: HTMLVideoElement;
  private failed = false;
  private wanted = false;
  onState: (playing: boolean) => void = () => {};

  constructor() {
    this.el = makeVideo(FILM.titleLoop, { muted: true, loop: true, className: 'title-loop' });
    this.el.preload = 'none';
    this.el.addEventListener('error', () => this.fail());
    this.el.addEventListener('playing', () => {
      if (!this.wanted) return;
      this.el.classList.add('is-on');
      this.onState(true);
    });
  }

  get playing(): boolean {
    return !this.failed && this.el.classList.contains('is-on');
  }

  /** 제목 화면일 때만 재생한다 */
  set(on: boolean, reduced: boolean): void {
    this.wanted = on && !reduced && !this.failed;
    if (this.wanted) {
      if (this.el.preload === 'none') { this.el.preload = 'auto'; this.el.load(); }
      // A pause right after play() rejects with AbortError; only an unsupported file disables the loop.
      void this.el.play().catch((e: unknown) => { if ((e as { name?: string })?.name === 'NotSupportedError') this.fail(); });
    } else {
      this.el.classList.remove('is-on');
      this.el.pause();
      this.onState(false);
    }
  }

  private fail(): void {
    if (this.failed) return;
    this.failed = true;
    this.wanted = false;
    this.el.classList.remove('is-on');
    this.el.remove();
    this.onState(false);
  }
}
