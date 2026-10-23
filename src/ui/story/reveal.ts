// 처음 필요할 때 나타나는 조작부 — 비법 줄, 시약 칸, 엘레나의 노트 단추.
// 보일지 말지는 게임 상태만으로 정한다(저장을 새로 만들지 않는다). 순수 함수라 테스트한다.
import type { RunState } from '../../contract/game';

export interface RevealFlags {
  notes: boolean;
  jokers: boolean;
  reagents: boolean;
}

/** startAnte 는 내부 상태에만 있어 선택 값으로 받는다(없으면 1). */
export function revealFlags(s: Pick<RunState, 'phase' | 'ante' | 'orderIdx' | 'jokers' | 'reagents' | 'discoveries'> & { startAnte?: number }): RevealFlags {
  const start = s.startAnte ?? 1;
  // 첫 계약을 마치고 공방에 들어섰거나, 이미 그 뒤라면 도구 칸이 필요하다.
  const pastFirstShop = s.phase === 'shop' || s.ante > start || s.orderIdx > 0;
  return {
    notes: s.discoveries.length > 0,
    jokers: s.jokers.length > 0 || pastFirstShop,
    reagents: s.reagents.length > 0 || pastFirstShop,
  };
}
