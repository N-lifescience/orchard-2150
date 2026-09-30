// 연출 시간 관리 — Web Animations + setTimeout 보증.
//  - fast(디버그): 모든 연출 시간 0 → 타이머 자체를 안 건다(백그라운드 탭에서도 끝까지 간다)
//  - speed 1×/2×/4×, skip(Space·클릭 빨리 감기), reduced(동작 줄이기)
//  - 애니메이션 finished 가 안 오더라도(멈춘 탭) setTimeout 으로 반드시 끝난다
import type { Speed } from './prefs';

export const motion = {
  fast: false,
  speed: 1 as Speed,
  reduced: false,
  skip: false,
};

/** #stage 의 현재 배율 (화면 좌표 → 무대 좌표 변환에 쓴다) */
export const stage = { scale: 1 };

export function dur(ms: number): number {
  if (motion.fast || motion.skip) return 0;
  return Math.max(0, ms / motion.speed);
}

const pending = new Set<() => void>();
const running = new Set<Animation>();

/** 연출 시간만큼 기다린다 (speed·skip·fast 반영) */
export function wait(ms: number): Promise<void> {
  const d = dur(ms);
  if (d <= 0) return Promise.resolve();
  return new Promise((res) => {
    const done = () => {
      clearTimeout(t);
      pending.delete(done);
      res();
    };
    const t = setTimeout(done, d);
    pending.add(done);
  });
}

/** 실제 시간으로 기다림 (연출 속도와 무관 — 토스트 등) */
export function sleepReal(ms: number): Promise<void> {
  if (motion.fast) return Promise.resolve();
  return new Promise((res) => setTimeout(res, ms));
}

export interface PlayOpts {
  duration: number;
  delay?: number;
  easing?: string;
  fill?: FillMode;
  /** 장식용(흔들림·반짝임) — 동작 줄이기면 건너뜀 */
  decorative?: boolean;
  composite?: CompositeOperation;
}

/** Web Animations 한 번. 끝(또는 타임아웃)에 resolve. 절대 reject 하지 않는다 */
export function play(el: Element | null | undefined, keyframes: Keyframe[] | PropertyIndexedKeyframes, opts: PlayOpts): Promise<void> {
  if (!el) return Promise.resolve();
  if (opts.decorative && motion.reduced) return Promise.resolve();
  const d = dur(opts.duration);
  const delay = opts.delay ? dur(opts.delay) : 0;
  if (d <= 0 || typeof (el as HTMLElement).animate !== 'function') return Promise.resolve();
  let a: Animation;
  try {
    a = (el as HTMLElement).animate(keyframes, {
      duration: d,
      delay,
      easing: opts.easing ?? 'cubic-bezier(0.2, 0.8, 0.3, 1)',
      fill: opts.fill ?? 'none',
      composite: opts.composite,
    });
  } catch {
    return Promise.resolve();
  }
  running.add(a);
  return new Promise((res) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      running.delete(a);
      pending.delete(done);
      res();
    };
    // 탭이 멈춰 타임라인이 안 가도, 시간이 지나면 끝 모습으로 보내고 끝낸다
    const t = setTimeout(() => {
      try {
        a.finish();
      } catch {
        /* 무한 반복 등 */
      }
      done();
    }, d + delay + 160);
    a.finished.then(done, done);
    pending.add(done);
  });
}

/** 진행 중인 연출을 전부 끝으로 보낸다 (빨리 감기) */
export function skipAll(): void {
  motion.skip = true;
  for (const a of [...running]) {
    try {
      a.finish();
    } catch {
      /* 무한 반복 애니메이션 등 */
    }
  }
  for (const f of [...pending]) f();
}

/** 숫자 굴리기 */
export function roll(el: HTMLElement, from: number, to: number, ms: number, fmt: (n: number) => string): Promise<void> {
  const d = dur(ms);
  if (d <= 0 || from === to || motion.reduced) {
    el.textContent = fmt(to);
    return Promise.resolve();
  }
  const start = performance.now();
  return new Promise((res) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      pending.delete(finish);
      el.textContent = fmt(to);
      res();
    };
    pending.add(finish);
    const tick = () => {
      if (done) return;
      const k = Math.min(1, (performance.now() - start) / d);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(tick);
      else finish();
    };
    const t = setTimeout(finish, d + 120);
    requestAnimationFrame(tick);
  });
}

/** 요소의 무대 좌표 (배율 보정) */
export function rectIn(el: Element, root: Element): { x: number; y: number; w: number; h: number; cx: number; cy: number } {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  const s = stage.scale || 1;
  const x = (r.left - o.left) / s;
  const y = (r.top - o.top) / s;
  const w = r.width / s;
  const h = r.height / s;
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

/** FLIP: first(이전 화면 좌표) → 지금 자리. `translate` 속성으로 해서 transform 과 겹쳐도 된다 */
export function flipFrom(el: HTMLElement, first: DOMRect, opts: Partial<PlayOpts> & { rotateFrom?: number; scaleFrom?: number } = {}): Promise<void> {
  const last = el.getBoundingClientRect();
  const s = stage.scale || 1;
  const dx = (first.left + first.width / 2 - (last.left + last.width / 2)) / s;
  const dy = (first.top + first.height / 2 - (last.top + last.height / 2)) / s;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && !opts.rotateFrom && !opts.scaleFrom) return Promise.resolve();
  const from: Keyframe = { translate: `${dx}px ${dy}px` };
  const to: Keyframe = { translate: '0px 0px' };
  if (opts.rotateFrom) {
    from.rotate = `${opts.rotateFrom}deg`;
    to.rotate = '0deg';
  }
  if (opts.scaleFrom) {
    from.scale = String(opts.scaleFrom);
    to.scale = '1';
  }
  return play(el, [from, to], { duration: opts.duration ?? 380, easing: opts.easing ?? 'cubic-bezier(0.2, 0.9, 0.25, 1)', delay: opts.delay });
}

/** 여러 약속을 모두 기다림 */
export function all(ps: Promise<void>[]): Promise<void> {
  return Promise.all(ps).then(() => undefined);
}
