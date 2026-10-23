// 영상·장면이 게임 배경음과 소리 설정을 함께 쓰는 방법
import type { Ctx } from '../ctx';
import { motion } from '../motion';
import { filmSound, setFilmSound } from './storage';

export function filmOptions(ctx: Ctx): { reduced: boolean; soundOn: boolean; onSound(on: boolean): void } {
  return {
    reduced: motion.reduced,
    soundOn: filmSound(),
    onSound: (on) => {
      setFilmSound(on);
      if (on) ctx.pauseAmbient();
    },
  };
}

/** 영상 소리가 켜져 있으면 배경음을 잠시 멈추고, 끝나면 되살린다 */
export async function withFilm<T>(ctx: Ctx, fn: () => Promise<T>): Promise<T> {
  if (filmSound()) ctx.pauseAmbient();
  try {
    return await fn();
  } finally {
    ctx.resumeAmbient();
  }
}
