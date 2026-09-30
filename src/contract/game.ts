// ─────────────────────────────────────────────────────────────
// 계약서: 게임 규칙 (src/game/** 가 구현한다)
// 이 파일은 협의 대상이 아니다. 바꾸려면 오케스트레이터에게 말할 것.
// 구현은 src/game/index.ts 에서 `createGame(): Game` 과 아래 콘텐츠 표(HAND_TYPES, JOKERS …)를 export 한다.
// UI(src/ui/**)는 Game 인터페이스만 쓴다. 상태를 직접 고치지 않는다.
// ─────────────────────────────────────────────────────────────
import type { Distribution, FruitColor, Genome, Phenotype, SpeciesId, SuitKey } from './genetics';

export type HandTypeId =
  | 'high' | 'pair' | 'twoPair' | 'three' | 'straight' | 'flush'
  | 'fullHouse' | 'four' | 'straightFlush' | 'five' | 'flushHouse' | 'flushFive';

export interface HandTypeDef {
  id: HandTypeId;
  name: string; // '단품', '한 쌍', '두 쌍', '세 쌍', '당도 계단', '한 빛깔', '풀 바구니', '네 쌍', '빛깔 계단', '다섯 쌍', '빛깔 바구니', '완전 균일'
  desc: string; // 한 줄 설명
  chips: number;
  mult: number;
  perLevel: { chips: number; mult: number };
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type ConceptId =
  | 'segregation' | 'purebred' | 'selfing' | 'polygenic' | 'environment' | 'heterozygote'
  | 'dioecy' | 'xlinked' | 'polyploid' | 'triploid' | 'nondisjunction'
  | 'transcription' | 'stopCodon' | 'synonymous' | 'frameshift' | 'dominanceMolecular'
  | 'lmo' | 'geneFlow' | 'clone';

export interface ConceptDef {
  id: ConceptId;
  title: string;
  /** 게임에서 방금 벌어진 일 (한두 문장) */
  body: string;
  /** 게임을 위해 지어낸 설정 (없으면 생략) */
  fiction?: string;
  /** 실제 과학·실제 사례 */
  real: string;
  standard?: string; // '12유전01-01' 등
}

export interface JokerDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  desc: string; // 효과 설명(숫자 포함)
  flavor?: string; // 한 줄 분위기 글
  concept?: ConceptId;
  minAnte?: number; // 이 앤티부터 상점에 나옴
  policy?: PolicyId[]; // 이 철학에서만 (없으면 모두)
}
export interface JokerInst { uid: string; id: string; counter: number }

export type ReagentTarget = 'none' | 'hand1' | 'hand2' | 'garden1';
export interface ReagentDef {
  id: string; // 'genetest' | 'colchicine' | 'scissors' | 'vector' | 'tissue' | 'fertilizer' | 'brush' | 'medal'
  name: string;
  desc: string;
  cost: number;
  target: ReagentTarget;
  concept?: ConceptId;
  minAnte?: number;
  policy?: PolicyId[];
}

export interface BossDef { id: string; name: string; client: string; desc: string; minAnte: number; concept?: ConceptId; policy?: PolicyId[] }

export type PolicyId = 'heritage' | 'precision' | 'biotech';
export interface PolicyDef { id: PolicyId; name: string; desc: string; tradeoff: string }

export type RunMode = 'full' | 'quick' | 'unit-sex' | 'unit-chromo' | 'unit-edit';

export interface Plant {
  id: string;
  name: string; // '엘레나 로시의 루비 별', '3세대 선발 12호' …
  genome: Genome;
  pheno: Phenotype;
  origin: 'starter' | 'seedling' | 'market' | 'clone';
  parents?: [string, string]; // 부모 Plant.id
  generation: number;
  /** 유전자형이 공개됐는가(검사 키트, 시작 포기 라벨) */
  revealed: boolean;
}

export interface SeedCard {
  uid: string;
  genome: Genome;
  pheno: Phenotype;
  /** 환경 효과(비료·가뭄) — 유전되지 않는다 */
  brixMod: number;
  revealed: boolean;
  debuffed: boolean; // 보스 규칙으로 무효
  /** 편집 작업대로 이 카드 자체를 고쳤으면 true */
  edited?: boolean;
}

export type Phase = 'title' | 'cross' | 'play' | 'cashout' | 'select' | 'shop' | 'gameover' | 'victory';

export interface OrderInfo {
  kind: 'small' | 'big' | 'boss';
  name: string; // '지역 납품', '도시 계약', 특별 주문 이름
  client: string; // 의뢰인 한 줄
  target: number;
  reward: number;
  /** 일반 주문: 해당 빛깔 모종을 출하하면 추가 보상 */
  requestedColor?: FruitColor;
  boss?: BossDef;
}

export type ColorPrediction = FruitColor | 'even';
export interface PredictionRecord {
  choice: ColorPrediction;
  ruby: number;
  gold: number;
}

export type ShopItem =
  | { slot: string; kind: 'joker'; id: string; price: number; sold: boolean }
  | { slot: string; kind: 'reagent'; id: string; price: number; sold: boolean }
  | { slot: string; kind: 'pack'; pack: PackKind; price: number; sold: boolean }
  | { slot: string; kind: 'upgrade'; id: UpgradeId; price: number; sold: boolean };
export type PackKind = 'seed' | 'rareSeed' | 'reagent' | 'medal' | 'joker';
export type UpgradeId = 'greenhouse' | 'hands' | 'discards' | 'handSize' | 'jokerSlot' | 'reroll';
export interface ShopState { items: ShopItem[]; rerollCost: number }

/** 봉투를 열었을 때 고를 것들 */
export type PackChoice =
  | { kind: 'plant'; plant: Plant }
  | { kind: 'reagent'; id: string }
  | { kind: 'medal'; hand: HandTypeId }
  | { kind: 'joker'; id: string };
export interface PackOpen { pack: PackKind; choices: PackChoice[]; picks: number }

export interface RunStats {
  handsPlayed: number;
  bestHand: number;
  crosses: number;
  selfings: number;
  recessiveSurprises: number; // 두 부모에 없던 형질 등장 횟수
  edits: number;
  lmoEvents: number;
  handCounts: Partial<Record<HandTypeId, number>>;
}

export interface RunState {
  seed: number;
  mode: RunMode;
  policy: PolicyId;
  ante: number;
  maxAnte: number; // full 8, quick 4, unit-* 는 시작 앤티+1
  orderIdx: 0 | 1 | 2;
  orders: [OrderInfo, OrderInfo, OrderInfo]; // 이번 앤티의 세 주문
  phase: Phase;
  money: number;
  handsLeft: number;
  discardsLeft: number;
  handSize: number; // 기본 8
  maxSelect: number; // 5
  garden: Plant[];
  gardenCap: number; // 기본 6
  jokers: JokerInst[];
  jokerCap: number; // 기본 5
  reagents: string[]; // ReagentDef.id
  reagentCap: number; // 기본 2
  handLevels: Record<HandTypeId, number>; // 1부터
  cross: { a: string; b: string; selfing: boolean } | null;
  /** 교배 전에 고른 예측과 만들어진 52알 전체의 관찰 결과 */
  prediction: PredictionRecord | null;
  requestFulfilled: boolean;
  pod: SeedCard[]; // 남은 씨앗
  podTotal: number; // 처음 꼬투리 알 수 (52)
  hand: SeedCard[];
  seen: SeedCard[]; // 이번 주문에 한 번이라도 손에 들어온 모종 (선발 후보)
  roundScore: number;
  shop: ShopState | null;
  pack: PackOpen | null;
  /** 지금까지 연 개념 카드 */
  discoveries: ConceptId[];
  /** UI가 띄워야 할 새 개념 카드 (띄운 뒤 ackDiscoveries) */
  pendingDiscoveries: ConceptId[];
  /** UI가 띄울 짧은 알림(한국어). 띄운 뒤 ackToasts */
  toasts: string[];
  stats: RunStats;
}

export interface ScoreStep {
  kind: 'hand' | 'card' | 'joker' | 'boss' | 'env';
  /** 카드 uid 또는 조커 uid (애니메이션 대상) */
  sourceUid?: string;
  label: string; // '+14', '+4 배수', '×3', '무효' …
  chips?: number; // 더한 칩
  mult?: number; // 더한 배수
  xmult?: number; // 곱한 배수
  chipsAfter: number;
  multAfter: number;
}

export interface ScoreTrace {
  handType: HandTypeId;
  handName: string;
  level: number;
  scoringUids: string[];
  steps: ScoreStep[];
  total: number;
  /** 이 출하로 주문을 넘겼는가 */
  cleared: boolean;
}

export interface CashoutLine { label: string; amount: number }

export interface SelectOptions {
  candidates: SeedCard[]; // 불임(3배체) 제외
  mustReplace: boolean; // 온실이 가득 찼는가
  extraPicks: number; // 조직배양 랩이면 1
}

export interface NewRunOptions { seed?: number; mode: RunMode; policy: PolicyId }

export interface Game {
  readonly state: RunState;
  subscribe(fn: (s: RunState) => void): () => void;

  newRun(opts: NewRunOptions): void;

  // ── 교배 (phase 'cross')
  canCross(aId: string, bId: string): { ok: boolean; reason?: string };
  /** '퍼넷 노트' 비법이 있을 때만 값, 없으면 null */
  preview(aId: string, bId: string): Distribution | null;
  chooseCross(aId: string, bId: string, prediction?: ColorPrediction): void; // → 'play', 꼬투리 만들고 핸드 채움

  // ── 출하 (phase 'play')
  evaluate(uids: string[]): { handType: HandTypeId; name: string; chips: number; mult: number; level: number } | null;
  play(uids: string[]): ScoreTrace; // 점수 반영·새로 뽑기. 목표 넘기면 phase 'cashout', 출하 0이고 못 넘기면 'gameover'
  discard(uids: string[]): void;
  sortHand(by: 'brix' | 'suit'): void;

  // ── 정산 (phase 'cashout')
  cashoutLines(): CashoutLine[];
  collect(): void; // 돈 받고 → 'select'

  // ── 선발 (phase 'select')
  selectOptions(): SelectOptions;
  /** uid=null 이면 건너뜀. mustReplace 면 replacePlantId 필수. 끝나면 → 'shop' (마지막 앤티 보스 뒤면 'victory') */
  select(uid: string | null, replacePlantId?: string): void;

  // ── 상점 (phase 'shop')
  buy(slot: string): { ok: boolean; reason?: string };
  reroll(): { ok: boolean; reason?: string };
  sellJoker(uid: string): void;
  sellValue(uid: string): number;
  pickFromPack(index: number, replacePlantId?: string): { ok: boolean; reason?: string };
  skipPack(): void;
  leaveShop(): void; // → 다음 주문 'cross'

  // ── 시약 (phase 'cross' | 'play' | 'shop')
  useReagent(index: number, targetUids: string[]): { ok: boolean; reason?: string; message?: string };
  /** 유전자 가위: 편집 작업대가 쓰는 자리 정보. target 은 Plant.id 또는 SeedCard.uid */
  editTargets(targetId: string): { group: string; copyIndex: number; locus: string; seq: string; label: string }[];
  applyEdit(reagentIndex: number, targetId: string, group: string, copyIndex: number, locus: string, newSeq: string): { ok: boolean; reason?: string; result?: import('./genetics').EditResult };

  // ── 알림
  ackDiscoveries(): void;
  ackToasts(): void;

  // ── 저장
  save(): void;
  load(): boolean;
  hasSave(): boolean;
  clearSave(): void;

  // ── 도움
  speciesName(id: SpeciesId): string;
  suitName(s: SuitKey): string;
  plantById(id: string): Plant | undefined;
  /** 조커 uid → 정의 */
  jokerDef(id: string): JokerDef;
  reagentDef(id: string): ReagentDef;
  conceptDef(id: ConceptId): ConceptDef;
}

/** src/game/index.ts 가 export 할 콘텐츠 표 (UI·그림이 읽는다) */
export interface GameContent {
  HAND_TYPES: Record<HandTypeId, HandTypeDef>;
  JOKERS: JokerDef[];
  REAGENTS: ReagentDef[];
  BOSSES: BossDef[];
  POLICIES: PolicyDef[];
  CONCEPTS: Record<ConceptId, ConceptDef>;
  createGame(): Game;
}
