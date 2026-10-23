// 소개 영상 HUD 신호표의 시간 계산 — DOM 없는 순수 함수 (테스트 대상)
import { INTRO_BEAT, INTRO_CUES, INTRO_LENGTH, type IntroCue } from './script';

/** 실제 영상 길이에 맞춘 시간 배율. 길이를 모르거나 터무니없으면 1 */
export function cueScale(duration: number): number {
  return Number.isFinite(duration) && duration >= 10 && duration <= 120 ? duration / INTRO_LENGTH : 1;
}

export function cueActive(cue: IntroCue, t: number, scale = 1): boolean {
  return t >= cue.at * scale && t < cue.until * scale;
}

export function activeCueIds(t: number, scale = 1, cues: readonly IntroCue[] = INTRO_CUES): string[] {
  return cues.filter((cue) => cueActive(cue, t, scale)).map((cue) => cue.id);
}

/** 카운터가 보여 줄 정수. 구간의 앞 80% 동안 감속하며 올라가고 나머지는 끝값에 머문다 */
export function counterValue(cue: IntroCue, t: number, scale = 1): number {
  const from = cue.from ?? 0;
  const to = cue.to ?? from;
  const start = cue.at * scale;
  const span = Math.max(0.001, (cue.until - cue.at) * scale * 0.8);
  const p = Math.min(1, Math.max(0, (t - start) / span));
  const eased = 1 - (1 - p) ** 3;
  return Math.round(from + (to - from) * eased);
}

/** 박자 번호 (전환 깜박임에 쓴다) */
export function beatIndex(t: number, scale = 1): number {
  return Math.max(0, Math.floor(t / (INTRO_BEAT * scale)));
}

/** 문자열에서 정해지는 장식용 바코드 막대 굵기(1~4). 무작위가 아니라 늘 같은 무늬다 */
export function barcodeBars(text: string, count = 30): number[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    bars.push(1 + ((h >>> 0) % 4));
  }
  return bars;
}
