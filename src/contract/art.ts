// ─────────────────────────────────────────────────────────────
// 계약서: 그림 (src/art/** 가 구현한다)
// 그림 모듈의 공개 API. 사용자 요청에 따라 장식은 생성된 비트맵을 쓴다.
// 구현은 src/art/index.ts 에서 아래 ArtApi 의 모든 이름을 export 하고, 스타일은 src/art/art.css 에 둔다
// (src/art/index.ts 가 art.css 를 import 한다).
// 규칙: innerHTML 금지. document.createElement 만. 그림 파일은 프로젝트에 포함하고 이름과 효과는 실제 글자로 표시한다.
// ─────────────────────────────────────────────────────────────
import type { Genome, Phenotype, SpeciesId, SuitKey } from './genetics';
import type { JokerDef, PackKind, ReagentDef, BossDef, HandTypeId } from './game';

/** 카드 한 장을 그릴 때 필요한 것 (UI가 SeedCard·Plant 에서 만들어 넘김) */
export interface CardView {
  uid: string;
  pheno: Phenotype;
  /** 그림 변주용 시드(같은 uid면 같은 그림) */
  artSeed: number;
  /** 화면에 보일 당도(환경 효과 포함). 수그루는 null */
  brixShown: number | null;
  brixMod: number; // 0이 아니면 '환경' 표시
  /** 공개된 유전자형 요약(예: 'Rr Ss bb · 당도+ 7/12'). 비공개면 null → '?' 로 그림 */
  genotypeText: string | null;
  /** 멘델의 안경 등으로 확실한 자리만 보일 때 (예: 'rr ss') */
  partialGenotype?: string | null;
  debuffed: boolean;
  edited?: boolean;
  /** 작은 이름표 (온실 부모 카드용) */
  title?: string;
  subtitle?: string;
}

export interface ArtApi {
  /** 과일(암그루·양성화) 또는 꽃(수그루) 그림. size = 한 변 px */
  fruitArt(p: Phenotype, seed: number, size?: number): HTMLElement;

  /** 모종 카드 전체 요소. 루트에 class 'sa-card' + data-uid.
   *  크기는 CSS 변수 --card-w (기본 132px), 비율 2:3. 호버 기울기·광택은 CSS 만으로.
   *  선택 상태는 UI가 루트에 class 'is-selected' 를 붙인다. 발동 흔들림은 'is-trigger'. */
  seedCard(v: CardView): HTMLElement;

  /** 온실 부모 카드 (조금 더 크고 이름표 있음). 루트 class 'sa-card sa-plant' */
  plantCard(v: CardView): HTMLElement;

  /** 비법(조커) 카드. 루트 class 'sa-joker' + data-uid(인스턴스 있으면). counter 가 있으면 표시 */
  jokerCard(def: JokerDef, opts?: { uid?: string; counter?: number; price?: number }): HTMLElement;

  /** 시약 카드. 루트 class 'sa-reagent' */
  reagentCard(def: ReagentDef, opts?: { price?: number }): HTMLElement;

  /** 씨앗 봉투·상자 그림. 루트 class 'sa-pack' */
  packArt(kind: PackKind, opts?: { price?: number }): HTMLElement;

  /** 보스 의뢰인 휘장 (지름 px) */
  bossEmblem(def: BossDef, size?: number): HTMLElement;

  /** 주문 휘장: 장터/식당 */
  orderEmblem(kind: 'small' | 'big', size?: number, client?: string): HTMLElement;

  /** 빛깔 기호: 색 + 모양(루비 ◆ / 골드 ●) + 무늬(✦). 색약도 구분 가능해야 함 */
  suitGlyph(suit: SuitKey, species: SpeciesId, size?: number): HTMLElement;

  /** 핵형(염색체) 미니 그림. revealed=false 면 윤곽만 */
  karyotype(g: Genome, opts?: { revealed?: boolean; width?: number }): HTMLCanvasElement;

  /** 족보 메달(품평회 메달) 그림 */
  medalArt(hand: HandTypeId, size?: number): HTMLElement;

  /** 시약 아이콘만 (작게) */
  reagentIcon(id: string, size?: number): HTMLElement;

  /** 비법 아이콘만 (작게) */
  jokerIcon(id: string, size?: number): HTMLElement;

  /** 타이틀 로고 */
  logo(): HTMLElement;

  /** 배경 셰이더. 캔버스 하나에 그린다. WebGL 이 없으면 CSS 그라데이션으로 대체 */
  createBackground(canvas: HTMLCanvasElement): BackgroundHandle;
}

export interface BackgroundHandle {
  start(): void;
  stop(): void;
  /** 앤티 1~8 → 계절 팔레트(봄 청록 → 여름 금빛 → 가을 자홍 → 겨울 남청 …) */
  setSeason(ante: number): void;
  setBoss(on: boolean): void;
  /** 점수 폭발 같은 순간 한 번 번쩍 (0..1) */
  pulse(strength: number): void;
  /** 동작 줄이기 */
  setReducedMotion(on: boolean): void;
}
