// 그림 모듈 입구. ArtApi(src/contract/art.ts)의 모든 이름을 export 한다.
import '@fontsource/gowun-batang/700.css';
import '@fontsource/gowun-batang/400.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './art.css';
import './raster.css';

import type { ArtApi } from '../contract/art';
import { fruitArt } from './fruit';
import { seedCard, plantCard } from './card';
import { jokerCard, reagentCard } from './special';
import { packArt } from './pack';
import { bossEmblem, orderEmblem, suitGlyph, medalArt } from './emblems';
import { karyotype } from './karyotype';
import { jokerIcon, reagentIcon } from './icons';
import { logo } from './logo';
import { createBackground } from './background';

export { characterPortrait, characterName, CHARACTER_NAMES } from './characters';

export {
  fruitArt,
  seedCard,
  plantCard,
  jokerCard,
  reagentCard,
  packArt,
  bossEmblem,
  orderEmblem,
  suitGlyph,
  karyotype,
  medalArt,
  reagentIcon,
  jokerIcon,
  logo,
  createBackground,
};

/** 계약 전체를 한 객체로도 (타입 검사: 이름이 하나라도 빠지면 여기서 에러) */
export const art: ArtApi = {
  fruitArt,
  seedCard,
  plantCard,
  jokerCard,
  reagentCard,
  packArt,
  bossEmblem,
  orderEmblem,
  suitGlyph,
  karyotype,
  medalArt,
  reagentIcon,
  jokerIcon,
  logo,
  createBackground,
};
