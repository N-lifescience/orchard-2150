// 게임 규칙 입구 — src/contract/game.ts 의 GameContent 이름을 전부 export 한다.
import type { GameContent } from '../contract/game';
import { BOSSES, CONCEPTS, HAND_TYPES, JOKERS, POLICIES, REAGENTS } from './content';
import { createGame } from './game';

export { BOSSES, CONCEPTS, HAND_TYPES, JOKERS, POLICIES, REAGENTS, createGame };
// 계약 밖이지만 UI 가 쓸 만한 것: 증축·봉투 이름표, 족보 순서, 한 빛깔 계열, 저장 키, 점수 미리보기 타입
export { ANTE_BASES, FLUSH_FAMILY, HAND_RANK, PACKS, UPGRADES } from './content';
export type { PackDef, UpgradeDef } from './content';
export { SAVE_KEY } from './game';
export type { CreateGameOptions, GameImpl, StorageLike } from './game';

/** 계약 전체를 한 객체로 (타입 검사로 계약과 어긋나지 않음을 보증) */
export const gameContent: GameContent = { HAND_TYPES, JOKERS, REAGENTS, BOSSES, POLICIES, CONCEPTS, createGame };
