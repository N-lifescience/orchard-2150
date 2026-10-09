// 게임 상태 기계 — createGame(): Game (src/contract/game.ts 구현)
// 순수 로직(DOM 없음). 모든 무작위는 유전 엔진의 makeRng 로 만든 시드 난수.
// 난수 상태를 직렬화할 수 있도록, 무작위가 필요한 동작마다 makeRng(mix(seed, rngCounter++)) 로 새 난수를 뽑는다.
import type {
  BossDef,
  CashoutLine,
  ColorPrediction,
  ConceptId,
  Game,
  HandTypeId,
  JokerDef,
  NewRunOptions,
  OrderInfo,
  PackChoice,
  PackKind,
  Plant,
  PolicyId,
  ReagentDef,
  RunMode,
  RunState,
  ScoreTrace,
  SeedCard,
  SelectOptions,
  ShopItem,
  UpgradeId,
} from '../contract/game';
import type { EditResult, FruitColor, Genome, HomologGroup, LocusId, Phenotype, Rng, SpeciesId, SuitKey } from '../contract/genetics';
import {
  SPECIES,
  addTransgene,
  canCross as geneCanCross,
  cloneGenome,
  codingSeq,
  describeGenotype,
  doubleGenome,
  editCoding,
  expectedDistribution,
  isHeterozygous,
  makePod,
  makeRng,
  phenotype,
} from '../genetics';
import {
  ANTE_BASES,
  BOSSES,
  CLIENTS,
  CONCEPTS,
  FLUSH_FAMILY,
  HAND_RANK,
  HAND_TYPES,
  JOKERS,
  ORDER_REWARD,
  PACKS,
  REAGENTS,
  UPGRADES,
  UPGRADE_ORDER,
} from './content';
import { marketPlant, rarePlant, rescuePlant, seasonMaterials, starterGarden, type PlantSeed } from './plants';
import { seasonGoals } from './contracts';
import { countDelivery, deliveryComplete, deliveryProgressText, goalHint } from './learning';
import { cardSuit, classify, effBrix, handBase, isSurprise, scoreHand, type ScoreCtx } from './rules';

export const SAVE_KEY = 'seed-atelier-2150:save:v1';
export const POD_SIZE = 52;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CreateGameOptions {
  /** 저장소. 생략하면 localStorage(있으면), null 이면 저장 안 함(시뮬레이션용) */
  storage?: StorageLike | null;
  /** 앤티별 기본 목표 (밸런스 시뮬레이션용). 생략하면 ANTE_BASES */
  bases?: number[];
}

/** 계약 밖의 내부 상태 (모두 JSON 직렬화 가능) */
export interface InternalState extends RunState {
  v: 1;
  startAnte: number;
  rngCounter: number;
  idCounter: number;
  plantSerial: number;
  baseHands: number;
  baseDiscards: number;
  upgrades: UpgradeId[];
  anteUpgrade: UpgradeId | null;
  anteUpgradeSold: boolean;
  /** 단색 포장 계약에서 제외하는 과육색 */
  bossColor: FruitColor | null;
  /** 교배 시점의 부모 정보 (분리·X 연관·선발 세대 계산용) */
  crossInfo: {
    species: SpeciesId;
    phenoA: Phenotype;
    phenoB: Phenotype;
    genA: number;
    genB: number;
    genotypes?: [string, string];
  } | null;
  /** 이번 주문에서 한 출하 수 (박람회: 첫 출하) */
  orderHands: number;
  selectPicksLeft: number;
  selectPicked: { uid: string; plantId: string; name: string } | null;
  usedBosses: string[];
  orderCheckpoint: string | null;
  suppliedSeasons: number[];
}

/** 계약 Game + 점수 미리보기(상태를 바꾸지 않음) */
export interface GameImpl extends Game {
  readonly state: InternalState;
  /** Select the local save belonging to the chronicle currently being played. */
  setSaveKey(key: string): void;
  getSaveKey(): string;
  reset(): void;
  /** 지금 이 카드들을 내면 몇 점인지 (비법·보스 포함, 상태 변화 없음). 잘못된 선택이면 null */
  simulate(uids: string[]): ScoreTrace | null;
}

const START_ANTE: Record<RunMode, number> = { full: 1, quick: 1, 'unit-sex': 3, 'unit-chromo': 5, 'unit-edit': 7 };
const MAX_ANTE: Record<RunMode, number> = { full: 8, quick: 4, 'unit-sex': 4, 'unit-chromo': 6, 'unit-edit': 8 };
const UNIT_JOKERS: Partial<Record<RunMode, string[]>> = {
  'unit-sex': ['xHeir', 'pollenTrader'],
  'unit-chromo': ['colchicineNotes', 'karyoScope'],
  'unit-edit': ['scissorRack', 'mendelGlasses'],
};
const UNIT_REAGENTS: Partial<Record<RunMode, string[]>> = {
  'unit-chromo': ['colchicine'],
  'unit-edit': ['scissors', 'scissors'],
};
const RARITY_WEIGHT = { common: 60, uncommon: 30, rare: 8, legendary: 2 } as const;
const PACK_WEIGHT: Record<PackKind, number> = { seed: 30, rareSeed: 15, reagent: 20, medal: 20, joker: 15 };
const SUIT_ORDER: SuitKey[] = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];
const SUIT_NAMES: Record<SuitKey, string> = { 'ruby-m': '루비·무늬', 'ruby-p': '루비·민무늬', 'gold-m': '골드·무늬', 'gold-p': '골드·민무늬' };
const COLOR_NAMES: Record<FruitColor, string> = { ruby: '루비', gold: '골드' };
const PLAY_PHASES = ['cross', 'play', 'shop'] as const;

/** 정수 두 개를 섞어 32비트 시드로 */
export function mixSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickOne<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}

function pickWeighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T | null {
  const total = items.reduce((s, t) => s + weight(t), 0);
  if (items.length === 0 || total <= 0) return null;
  let x = r() * total;
  for (const t of items) {
    x -= weight(t);
    if (x < 0) return t;
  }
  return items[items.length - 1];
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (ls && typeof ls.getItem === 'function') {
      ls.getItem(SAVE_KEY);
      return ls;
    }
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
  return null;
}

function emptyLevels(): Record<HandTypeId, number> {
  const out = {} as Record<HandTypeId, number>;
  for (const id of HAND_RANK) out[id] = 1;
  return out;
}

function emptyState(): InternalState {
  const blank = (kind: OrderInfo['kind'], name: string): OrderInfo => ({ kind, name, client: '', target: 0, reward: 0 });
  return {
    v: 1,
    seed: 0,
    mode: 'full',
    playStyle: 'learning',
    policy: 'heritage',
    ante: 1,
    maxAnte: 8,
    startAnte: 1,
    orderIdx: 0,
    orders: [blank('small', '지역 납품'), blank('big', '도시 계약'), blank('boss', '특별 계약')],
    phase: 'title',
    money: 0,
    handsLeft: 0,
    discardsLeft: 0,
    handSize: 8,
    maxSelect: 5,
    garden: [],
    gardenCap: 6,
    jokers: [],
    jokerCap: 5,
    reagents: [],
    reagentCap: 2,
    handLevels: emptyLevels(),
    cross: null,
    prediction: null,
    requestFulfilled: false,
    delivery: {},
    orderAttempt: 1,
    review: null,
    records: [],
    geneFlow: null,
    pod: [],
    podTotal: POD_SIZE,
    hand: [],
    seen: [],
    roundScore: 0,
    shop: null,
    pack: null,
    discoveries: [],
    pendingDiscoveries: [],
    toasts: [],
    stats: { handsPlayed: 0, bestHand: 0, crosses: 0, selfings: 0, recessiveSurprises: 0, edits: 0, lmoEvents: 0, retries: 0, handCounts: {} },
    rngCounter: 0,
    idCounter: 0,
    plantSerial: 0,
    baseHands: 4,
    baseDiscards: 3,
    upgrades: [],
    anteUpgrade: null,
    anteUpgradeSold: false,
    bossColor: null,
    crossInfo: null,
    orderHands: 0,
    selectPicksLeft: 0,
    selectPicked: null,
    usedBosses: [],
    orderCheckpoint: null,
    suppliedSeasons: [],
  };
}

export function createGame(opts: CreateGameOptions = {}): GameImpl {
  const storage: StorageLike | null = opts.storage === undefined ? defaultStorage() : opts.storage;
  let saveKey = SAVE_KEY;
  const bases = opts.bases && opts.bases.length > 0 ? opts.bases.slice() : ANTE_BASES.slice();
  let st: InternalState = emptyState();
  const listeners = new Set<(s: RunState) => void>();

  // ── 기본 도구 ──────────────────────────────────────────────
  const rng = (): Rng => makeRng(mixSeed(st.seed, st.rngCounter++));
  const nextId = (prefix: string) => `${prefix}${++st.idCounter}`;
  const toast = (msg: string) => st.toasts.push(msg);
  const discover = (id: ConceptId) => {
    if (!st.discoveries.includes(id)) {
      st.discoveries.push(id);
      st.pendingDiscoveries.push(id);
    }
  };
  const countJoker = (id: string) => st.jokers.filter((j) => j.id === id).length;
  const hasJoker = (id: string) => countJoker(id) > 0;
  const order = (): OrderInfo => st.orders[st.orderIdx];
  const plantById = (id: string) => st.garden.find((p) => p.id === id);

  /** Refresh labels in saves made before the new characters and contracts were introduced. */
  function refreshSavedCopy(state: InternalState): void {
    const oldNames: [string, string][] = [
      ['할머니의 루비 별', '엘레나 로시의 루비 별'],
      ['할머니의 골드', '엘레나 로시의 골드'],
      ['이웃 농장의 루비', '레아 모레노의 루비'],
      ['할아버지의 향기', '마테오 비앙키의 향기'],
      ['이웃 농장이 보낸 루미', '레아 모레노가 보낸 루미'],
    ];
    const rename = (name: string) => oldNames.reduce((out, [before, after]) => out.replaceAll(before, after), name);
    for (const plant of state.garden) plant.name = rename(plant.name);
    for (const card of [...state.hand, ...state.pod, ...state.seen]) {
      if ('name' in card && typeof card.name === 'string') card.name = rename(card.name);
    }
    for (const [i, current] of state.orders.entries()) {
      if (current.kind === 'boss' && current.boss) {
        const def = BOSSES.find((boss) => boss.id === current.boss?.id);
        if (def) {
          current.name = def.name;
          current.client = def.client;
          current.boss.name = def.name;
          current.boss.client = def.client;
        }
      } else if (current.kind !== 'boss') {
        current.name = current.kind === 'small' ? '지역 납품' : '도시 계약';
        if (!CLIENTS.some((client) => current.client.startsWith(client))) {
          const client = CLIENTS[(state.seed + state.ante * 11 + i * 7) % CLIENTS.length];
          const color = current.requestedColor === 'gold' ? '골드빛' : '루비빛';
          current.client = `${client} · ${color} 과육 요청`;
        }
      }
    }
    state.toasts = state.toasts.map(rename);
  }

  function notify() {
    for (const fn of [...listeners]) {
      try {
        fn(st);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function save(): boolean {
    if (!storage || st.phase === 'title') return false;
    try {
      storage.setItem(saveKey, JSON.stringify(st));
      return true;
    } catch {
      /* 저장 실패는 게임을 멈추지 않는다 */
      return false;
    }
  }

  function clearSave() {
    try {
      storage?.removeItem(saveKey);
    } catch {
      /* 무시 */
    }
  }

  /** 상태를 바꾼 뒤 부른다: 자동 저장 + 구독자 알림 */
  function commit() {
    save();
    notify();
  }

  function makePlant(seed: PlantSeed, origin: Plant['origin'], generation: number, parents?: [string, string]): Plant {
    const p: Plant = {
      id: nextId('p'),
      name: seed.name,
      genome: seed.genome,
      pheno: phenotype(seed.genome),
      origin,
      generation,
      revealed: seed.revealed,
    };
    if (parents) p.parents = parents;
    return p;
  }

  // ── 보스 ───────────────────────────────────────────────────
  function activeBoss(): BossDef | null {
    const o = order();
    if (o.kind !== 'boss' || !o.boss) return null;
    if (hasJoker('climateHouse')) return null;
    return o.boss;
  }

  const selfable = (p: Plant) => geneCanCross(p.genome, p.genome, true).ok;

  function bossMinAnte(b: BossDef): number {
    if (b.id === 'lmoCheck' && st.policy === 'biotech') return 3;
    return b.minAnte;
  }

  /** 단색 포장 계약에서 제외해도 되는 색 = 나머지 색을 온실에서 얻을 수 있는 색 */
  function pickyColors(): FruitColor[] {
    const heteroSelf = st.garden.some((p) => selfable(p) && isHeterozygous(p.genome, 'R'));
    const obtainable = (c: FruitColor) => heteroSelf || st.garden.some((p) => p.pheno.color === c && p.pheno.fertile);
    return (['ruby', 'gold'] as FruitColor[]).filter((c) => obtainable(c === 'ruby' ? 'gold' : 'ruby'));
  }

  function bossFeasible(b: BossDef): boolean {
    switch (b.id) {
      case 'nobees':
        return st.garden.some(selfable);
      case 'picky':
        return pickyColors().length > 0;
      case 'sommelier':
        return st.garden.some((p) => p.pheno.brix !== null && p.pheno.brix >= 13);
      case 'judge':
        return st.garden.some((p) => p.pheno.sex !== 'M');
      case 'lmoCheck': {
        const anyLmo = st.garden.some((p) => p.pheno.fluorescent);
        if (st.policy !== 'biotech' && !anyLmo) return false; // LMO 가 없는 브랜드엔 의미 없는 점검
        const canAvoid = st.garden.some((p) => !p.pheno.fluorescent || p.genome.chromosomes.c1.some((c) => c.alleles.T !== 'T+'));
        return canAvoid;
      }
      default:
        return true;
    }
  }

  function chooseBoss(r: Rng): OrderInfo {
    const base = targetBase();
    if (st.ante >= st.maxAnte) {
      const expo = BOSSES.find((b) => b.id === 'expo')!;
      return { kind: 'boss', name: expo.name, client: expo.client, target: Math.round(base * 3), reward: ORDER_REWARD.boss, boss: { ...expo } };
    }
    // These lessons use a stable rule so the new genetics task is the source of difficulty.
    const lessonBoss = st.ante <= 2 ? 'uniformity' : st.ante <= 4 ? 'judge' : st.ante <= 6 ? 'coldsnap' : 'sommelier';
    let pool = BOSSES.filter((b) => b.id === lessonBoss && bossFeasible(b));
    const fresh = pool.filter((b) => !st.usedBosses.includes(b.id));
    if (fresh.length > 0) pool = fresh;
    else st.usedBosses = [];
    const chosen = pool.length > 0 ? pickOne(r, pool) : BOSSES.find((b) => b.id === 'drought')!;
    st.usedBosses.push(chosen.id);
    const boss: BossDef = { ...chosen };
    st.bossColor = null;
    if (boss.id === 'picky') {
      const color = pickOne(r, pickyColors());
      st.bossColor = color;
      boss.desc = `${COLOR_NAMES[color]} 과육 모종은 점수를 못 내요.`;
    }
    return { kind: 'boss', name: boss.name, client: boss.client, target: Math.round(base * 2), reward: ORDER_REWARD.boss, boss };
  }

  function isDebuffed(c: SeedCard): boolean {
    const b = activeBoss();
    if (!b) return false;
    switch (b.id) {
      case 'judge':
        return c.pheno.sex === 'M';
      case 'picky':
        return st.bossColor !== null && c.pheno.color === st.bossColor;
      case 'sommelier': {
        const e = effBrix(c);
        return e === null || e <= 13;
      }
      case 'lmoCheck':
        return c.pheno.fluorescent;
      default:
        return false;
    }
  }

  // ── 앤티·주문 ──────────────────────────────────────────────
  function targetBase(): number {
    const unit = st.mode.startsWith('unit');
    const idx = unit ? st.ante - st.startAnte : st.ante - 1;
    return bases[Math.max(0, Math.min(bases.length - 1, idx))];
  }

  function startAnte() {
    const r = rng();
    if (!st.suppliedSeasons.includes(st.ante)) {
      const materials = seasonMaterials(st.ante, st.policy, r).filter((seed) => !st.garden.some((p) => p.name === seed.name));
      for (const seed of materials) st.garden.push(makePlant(seed, 'starter', 1));
      if (materials.length) {
        st.gardenCap = Math.max(st.gardenCap, st.garden.length);
        toast(`레아가 이번 단원의 연구용 개체 ${materials.length}개와 필요한 온실 칸을 준비했어요.`);
      }
      if (st.ante === 7 && st.policy !== 'heritage' && !st.reagents.includes('scissors')) {
        st.reagentCap = Math.max(st.reagentCap, st.reagents.length + 1);
        st.reagents.push('scissors');
      }
      st.suppliedSeasons.push(st.ante);
    }
    const base = targetBase();
    const c1 = pickOne(r, CLIENTS);
    const c2 = pickOne(r, CLIENTS.filter((c) => c !== c1));
    const colors = [...new Set(st.garden.filter((p) => p.pheno.sex !== 'M').map((p) => p.pheno.color))];
    const requestedColor = () => pickOne(r, colors.length ? colors : (['ruby', 'gold'] as FruitColor[]));
    const colorName = (c: FruitColor) => c === 'ruby' ? '루비빛' : '골드빛';
    const color1 = requestedColor();
    const color2 = requestedColor();
    st.orders = [
      { kind: 'small', name: '지역 납품', client: `${c1} · ${colorName(color1)} 과육 요청`, requestedColor: color1, target: Math.round(base), reward: ORDER_REWARD.small },
      { kind: 'big', name: '도시 계약', client: `${c2} · ${colorName(color2)} 과육 요청`, requestedColor: color2, target: Math.round(base * 1.5), reward: ORDER_REWARD.big },
      chooseBoss(r),
    ];
    for (const [idx, current] of st.orders.entries()) {
      current.goals = seasonGoals(st.ante, idx, st.policy);
      const color = current.goals.find((goal) => goal.trait.color)?.trait.color;
      if (current.kind !== 'boss') {
        current.requestedColor = color;
        const person = idx === 0 ? c1 : c2;
        current.client = `${person} · ${current.goals.map((goal) => goal.label).join(' / ')} 납품`;
      }
    }
    st.orderIdx = 0;
    const avail = UPGRADE_ORDER.filter((u) => !st.upgrades.includes(u));
    st.anteUpgrade = avail.length > 0 ? pickOne(r, avail) : null;
    st.anteUpgradeSold = false;
  }

  function anyValidCross(): boolean {
    const g = st.garden;
    for (let i = 0; i < g.length; i++) for (let j = i; j < g.length; j++) if (geneCanCross(g[i].genome, g[j].genome, i === j).ok) return true;
    return false;
  }

  function startOrder() {
    st.phase = 'cross';
    st.handsLeft = st.baseHands + countJoker('beeSwarm');
    st.discardsLeft = st.baseDiscards;
    st.roundScore = 0;
    st.pod = [];
    st.podTotal = POD_SIZE;
    st.hand = [];
    st.seen = [];
    st.cross = null;
    st.prediction = null;
    st.requestFulfilled = false;
    st.delivery = {};
    st.orderAttempt = 1;
    st.review = null;
    st.crossInfo = null;
    st.orderHands = 0;
    st.shop = null;
    st.pack = null;
    if (hasJoker('scissorRack') && st.policy !== 'heritage' && st.reagents.length < st.reagentCap) {
      st.reagents.push('scissors');
      toast('가위 거치대: 유전자 가위 1개를 챙겼어요.');
    }
    if (!anyValidCross()) {
      const r = rng();
      if (st.garden.length >= st.gardenCap) {
        const out = st.garden.pop()!;
        toast(`온실 칸을 마련했어요. 이웃 농장에 보낸 개체: ${out.name}`);
      }
      st.garden.push(makePlant(rescuePlant(r), 'market', 1));
      toast('교배할 짝이 없어서 이웃 농장이 루미 한 개체를 보내 줬어요.');
    }
    const b = activeBoss();
    if (b?.id === 'nobees' && !st.garden.some(selfable)) toast('벌이 없는 날이지만 자가수분할 개체가 없어 이웃 벌집을 빌렸어요. 오늘은 교배가 돼요.');
    st.orderCheckpoint = JSON.stringify({ ...st, orderCheckpoint: null });
  }

  function nondisjunctionRate(): number {
    const b = activeBoss();
    if (b?.id === 'coldsnap') return 0.08;
    return st.ante >= 5 ? 0.01 : 0;
  }

  // ── 카드 ───────────────────────────────────────────────────
  function makeCard(g: Genome, envMod: number): SeedCard {
    const pheno = phenotype(g);
    const card: SeedCard = { uid: nextId('s'), genome: g, pheno, brixMod: pheno.brix === null ? 0 : envMod, revealed: false, debuffed: false };
    card.debuffed = isDebuffed(card);
    return card;
  }

  /** 같은 uid 의 카드(손패·이번 주문에 본 것·자손 덱)를 모두 고친다 */
  function updateCard(uid: string, fn: (c: SeedCard) => void) {
    for (const list of [st.hand, st.seen, st.pod]) for (const c of list) if (c.uid === uid) fn(c);
  }

  function parentPhenos(): [Phenotype, Phenotype] | null {
    return st.crossInfo ? [st.crossInfo.phenoA, st.crossInfo.phenoB] : null;
  }

  function drawToHand() {
    const karyo = countJoker('karyoScope');
    const parents = parentPhenos();
    let inspected = 0;
    while (st.hand.length < st.handSize && st.pod.length > 0) {
      const c = st.pod.shift()!;
      if (c.pheno.aneuploid) {
        discover('nondisjunction');
        if (karyo > 0) {
          c.revealed = true;
          inspected++;
        }
      }
      if (c.pheno.seedless) discover('triploid');
      if (isSurprise(c.pheno, parents)) {
        st.stats.recessiveSurprises++;
        discover('segregation');
      }
      st.hand.push(c);
      st.seen.push({ ...c });
    }
    if (inspected > 0) toast(`핵형 현미경: 이수성 모종 ${inspected}개체의 핵형을 공개했어요. 살펴본 뒤 솎아내면 개체당 $${karyo}을 받아요.`);
    const brixes = new Set(st.seen.map((c) => c.pheno.brix).filter((b) => b !== null));
    if (brixes.size >= 6) discover('polygenic');
    if (st.crossInfo?.species === 'stella' && parents) {
      const father = parents.find((p) => p.sex === 'M');
      const daughters = st.hand.filter((c) => c.pheno.sex === 'F');
      if (father?.marked && daughters.length >= 4 && daughters.every((c) => c.pheno.marked)) discover('xlinked');
    }
  }

  function handCards(uids: string[]): SeedCard[] | null {
    if (!Array.isArray(uids) || uids.length < 1 || uids.length > st.maxSelect) return null;
    const set = new Set(uids);
    if (set.size !== uids.length) return null;
    const cards = st.hand.filter((c) => set.has(c.uid));
    return cards.length === uids.length ? cards : null;
  }

  function scoreCtx(): ScoreCtx {
    return {
      handLevels: st.handLevels,
      jokers: st.jokers,
      boss: activeBoss(),
      selfing: !!st.cross?.selfing,
      species: st.crossInfo?.species ?? null,
      parents: parentPhenos(),
      firstHandOfOrder: st.orderHands === 0,
    };
  }

  function gameOver(msg: string) {
    const missing = (order().goals ?? []).find((goal) => (st.delivery[goal.id] ?? 0) < goal.count);
    st.review = { reason: msg, score: st.roundScore, target: order().target, delivery: { ...st.delivery }, hint: missing ? goalHint(missing) : '형질은 납품했어요. 같은 빛깔이나 당도 조합을 모으고, 비법과 연구 레벨의 효과를 확인해 보세요.', attempt: st.orderAttempt };
    recordOrder(false);
    st.phase = st.playStyle === 'learning' ? 'review' : 'gameover';
    toast(msg);
  }

  function recordOrder(cleared: boolean) {
    const current = order();
    st.records.push({ ante: st.ante, orderIdx: st.orderIdx, name: current.name, prediction: st.prediction ? { ...st.prediction } : null, parents: st.cross ? [plantById(st.cross.a)?.name ?? '', plantById(st.cross.b)?.name ?? ''] : null, parentGenotypes: st.crossInfo?.genotypes, goals: structuredClone(current.goals ?? []), delivery: { ...st.delivery }, score: st.roundScore, target: current.target, attempt: st.orderAttempt, cleared });
  }

  // ── 상점 도우미 ────────────────────────────────────────────
  function jokerAvailable(j: JokerDef): boolean {
    return (j.minAnte ?? 1) <= st.ante && (!j.policy || j.policy.includes(st.policy));
  }

  function reagentAvailable(d: ReagentDef): boolean {
    const minAnte = d.id === 'scissors' && st.policy === 'precision' ? 1 : d.minAnte ?? 1;
    return minAnte <= st.ante && (!d.policy || d.policy.includes(st.policy));
  }

  function pickJoker(r: Rng, exclude: Set<string>): JokerDef | null {
    const pool = JOKERS.filter((j) => jokerAvailable(j) && !hasJoker(j.id) && !exclude.has(j.id));
    return pickWeighted(r, pool, (j) => RARITY_WEIGHT[j.rarity]);
  }

  function pickReagent(r: Rng, exclude: Set<string> = new Set()): ReagentDef | null {
    let pool = REAGENTS.filter((d) => reagentAvailable(d) && !exclude.has(d.id));
    if (pool.length === 0) pool = REAGENTS.filter(reagentAvailable);
    return pool.length > 0 ? pickOne(r, pool) : null;
  }

  function cardItem(r: Rng, slot: string, taken: Set<string>): ShopItem {
    if (r() < 0.7) {
      const j = pickJoker(r, taken);
      if (j) {
        taken.add(j.id);
        return { slot, kind: 'joker', id: j.id, price: j.cost, sold: false };
      }
    }
    const d = pickReagent(r)!;
    return { slot, kind: 'reagent', id: d.id, price: d.cost, sold: false };
  }

  const baseReroll = () => 5 - (st.upgrades.includes('reroll') ? 2 : 0);

  function genShop() {
    const r = rng();
    const taken = new Set<string>();
    const items: ShopItem[] = [cardItem(r, 'card1', taken), cardItem(r, 'card2', taken)];
    for (const slot of ['pack1', 'pack2']) {
      const kind = pickWeighted(r, Object.keys(PACK_WEIGHT) as PackKind[], (k) => PACK_WEIGHT[k])!;
      items.push({ slot, kind: 'pack', pack: kind, price: PACKS[kind].price, sold: false, choices: packChoices(kind) });
    }
    if (st.anteUpgrade) items.push({ slot: 'upgrade', kind: 'upgrade', id: st.anteUpgrade, price: UPGRADES[st.anteUpgrade].cost, sold: st.anteUpgradeSold });
    st.shop = { items, rerollCost: baseReroll() };
  }

  function medalPool(): HandTypeId[] {
    const secret: HandTypeId[] = ['five', 'flushHouse', 'flushFive'];
    return HAND_RANK.filter((h) => !secret.includes(h) || (st.stats.handCounts[h] ?? 0) > 0);
  }

  function packChoices(kind: PackKind): PackChoice[] {
    const r = rng();
    const def = PACKS[kind];
    const choices: PackChoice[] = [];
    switch (kind) {
      case 'seed':
        for (let i = 0; i < def.size; i++) choices.push({ kind: 'plant', plant: makePlant(marketPlant(r, st.ante), 'market', 1) });
        break;
      case 'rareSeed':
        for (let i = 0; i < def.size; i++) choices.push({ kind: 'plant', plant: makePlant(rarePlant(r, st.ante), 'market', 1) });
        break;
      case 'reagent': {
        const ex = new Set<string>();
        for (let i = 0; i < def.size; i++) {
          const d = pickReagent(r, ex);
          if (!d) break;
          ex.add(d.id);
          choices.push({ kind: 'reagent', id: d.id });
        }
        break;
      }
      case 'medal': {
        const pool = medalPool().slice();
        for (let i = 0; i < def.size && pool.length > 0; i++) {
          const h = pool.splice(Math.min(pool.length - 1, Math.floor(r() * pool.length)), 1)[0];
          choices.push({ kind: 'medal', hand: h });
        }
        break;
      }
      case 'joker': {
        const ex = new Set<string>();
        for (let i = 0; i < def.size; i++) {
          const j = pickJoker(r, ex);
          if (j) {
            ex.add(j.id);
            choices.push({ kind: 'joker', id: j.id });
          } else {
            const d = pickReagent(r);
            if (d) choices.push({ kind: 'reagent', id: d.id });
          }
        }
        break;
      }
    }
    return choices;
  }

  function applyUpgrade(id: UpgradeId) {
    st.upgrades.push(id);
    switch (id) {
      case 'greenhouse':
        st.gardenCap += 1;
        break;
      case 'hands':
        st.baseHands += 1;
        break;
      case 'discards':
        st.baseDiscards += 1;
        break;
      case 'handSize':
        st.handSize += 1;
        break;
      case 'jokerSlot':
        st.jokerCap += 1;
        break;
      case 'reroll':
        break;
    }
  }

  function addJoker(id: string) {
    st.jokers.push({ uid: nextId('j'), id, counter: 0 });
  }

  /** 온실에 개체를 들인다. 가득 찼으면 replacePlantId 를 내보낸다. 실패하면 이유 문자열 */
  function admitPlant(p: Plant, replacePlantId?: string): string | null {
    if (st.garden.length >= st.gardenCap) {
      const out = replacePlantId ? plantById(replacePlantId) : undefined;
      if (!out) return '온실이 가득 찼어요. 내보낼 개체를 골라 주세요.';
      st.garden = st.garden.filter((q) => q.id !== out.id);
      toast(`온실에서 내보낸 개체: ${out.name}`);
    }
    st.garden.push(p);
    return null;
  }

  function finishSelect() {
    st.selectPicksLeft = 0;
    st.selectPicked = null;
    if (st.ante >= st.maxAnte && st.orderIdx === 2) {
      st.phase = 'victory';
      toast('2150 국제 품종 박람회 계약을 마쳤어요.');
      return;
    }
    st.phase = 'shop';
    genShop();
  }

  function lmoLeak() {
    const pairs = st.garden.filter((p) => p.pheno.fluorescent && p.pheno.sex !== 'F').flatMap((donor) =>
      st.garden.filter((recipient) => !recipient.pheno.fluorescent && recipient.pheno.sex !== 'M' && geneCanCross(donor.genome, recipient.genome, false).ok).map((recipient) => ({ donor, recipient })),
    );
    if (pairs.length === 0) return;
    const r = rng();
    const chance = 0.2 + 0.25 * countJoker('jellyfishGene');
    if (r() >= chance) return;
    const { donor, recipient } = pickOne(r, pairs);
    const offspring = phenotype(makePod(recipient.genome, donor.genome, r, 1)[0]);
    if (!offspring.fluorescent) return;
    st.geneFlow = { donor: donor.name, recipient: recipient.name, offspring };
    st.stats.lmoEvents++;
    discover('geneFlow');
    toast(`${recipient.name}에서 생긴 씨에 형광 유전자가 전달됐어요. 원래 개체의 유전자형은 바뀌지 않아요.`);
  }

  // ── 시약·편집 대상 찾기 ────────────────────────────────────
  type Holder = { kind: 'plant'; plant: Plant } | { kind: 'card'; card: SeedCard };
  function findHolder(id: string, allowSeen = false): Holder | null {
    const p = plantById(id);
    if (p) return { kind: 'plant', plant: p };
    const c = st.hand.find((x) => x.uid === id) ?? (allowSeen ? st.seen.find((x) => x.uid === id) : undefined);
    return c ? { kind: 'card', card: c } : null;
  }

  function setGenome(h: Holder, g: Genome, edited: boolean) {
    const pheno = phenotype(g);
    if (h.kind === 'plant') {
      h.plant.genome = g;
      h.plant.pheno = pheno;
    } else {
      updateCard(h.card.uid, (c) => {
        c.genome = g;
        c.pheno = pheno;
        if (edited) c.edited = true;
        c.debuffed = isDebuffed(c);
      });
    }
  }

  const MENDEL_LOCI: LocusId[] = ['R', 'S', 'B', 'L'];

  // ── Game 객체 ─────────────────────────────────────────────
  const game: GameImpl = {
    setSaveKey(key) {
      if (key !== SAVE_KEY && !key.startsWith(`${SAVE_KEY}:slot:`)) throw new Error('잘못된 저장 슬롯이에요.');
      saveKey = key;
    },
    getSaveKey() {
      return saveKey;
    },
    reset() {
      st = emptyState();
      notify();
    },
    get state() {
      return st;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    newRun(o: NewRunOptions) {
      const seed = (o.seed ?? Date.now()) >>> 0;
      const mode = o.mode;
      const policy: PolicyId = mode === 'unit-edit' ? 'precision' : o.policy;
      st = emptyState();
      st.seed = seed;
      st.mode = mode;
      st.playStyle = o.playStyle ?? 'learning';
      st.policy = policy;
      st.startAnte = START_ANTE[mode];
      st.ante = st.startAnte;
      st.maxAnte = MAX_ANTE[mode];
      st.money = mode === 'full' || mode === 'quick' ? 4 : 10;
      st.baseHands = 4 + (policy === 'heritage' ? 1 : 0);
      const r = rng();
      for (const s of starterGarden(mode, r)) st.garden.push(makePlant(s, 'starter', 1));
      for (const id of UNIT_JOKERS[mode] ?? []) addJoker(id);
      st.reagents.push(...(UNIT_REAGENTS[mode] ?? []));
      if (policy === 'precision' && st.reagents.length < st.reagentCap) st.reagents.push('scissors');
      if (policy === 'biotech') {
        if (!hasJoker('jellyfishGene') && st.jokers.length < st.jokerCap) addJoker('jellyfishGene');
        discover('lmo');
      }
      startAnte();
      startOrder();
      commit();
    },

    retryOrder() {
      if (st.phase !== 'review' || !st.orderCheckpoint) return false;
      const checkpoint = st.orderCheckpoint;
      const failed = st;
      const restored = JSON.parse(checkpoint) as InternalState;
      st = restored;
      st.orderCheckpoint = checkpoint;
      st.orderAttempt = failed.orderAttempt + 1;
      st.records = failed.records;
      st.discoveries = failed.discoveries;
      st.pendingDiscoveries = [];
      st.stats = { ...failed.stats, retries: failed.stats.retries + 1 };
      st.handsLeft += Math.min(2, st.orderAttempt - 1);
      st.discardsLeft += Math.min(3, st.orderAttempt - 1);
      st.orders[st.orderIdx].target = Math.round(restored.orders[st.orderIdx].target * Math.max(0.65, 1 - 0.15 * (st.orderAttempt - 1)));
      st.review = null;
      toast(`같은 계약을 다시 준비해요. 형질 조건은 그대로이고 출하·솎아내기 도움을 받았어요.`);
      commit();
      return true;
    },

    // ── 교배 ──
    canCross(aId, bId) {
      const a = plantById(aId);
      const b = plantById(bId);
      if (!a || !b) return { ok: false, reason: '온실에 없는 개체예요.' };
      const res = geneCanCross(a.genome, b.genome, aId === bId);
      if (!res.ok) return res;
      const boss = activeBoss();
      if (boss?.id === 'nobees' && aId !== bId && st.garden.some(selfable)) {
        return { ok: false, reason: '벌이 없는 날이라 다른 개체와는 교배할 수 없어요. 같은 개체를 두 번 골라 자가수분해요.' };
      }
      return { ok: true };
    },

    preview(aId, bId) {
      if (!hasJoker('punnettNote')) return null;
      const a = plantById(aId);
      const b = plantById(bId);
      if (!a || !b || !game.canCross(aId, bId).ok) return null;
      return expectedDistribution(a.genome, b.genome, 400, mixSeed(st.seed, hashStr(`${aId}|${bId}`)));
    },

    chooseCross(aId, bId, prediction?: ColorPrediction) {
      if (st.phase !== 'cross') return;
      const ok = game.canCross(aId, bId);
      if (!ok.ok) {
        toast(ok.reason ?? '교배할 수 없어요.');
        notify();
        return;
      }
      const a = plantById(aId)!;
      const b = plantById(bId)!;
      const r = rng();
      const nd = nondisjunctionRate();
      let genomes: Genome[];
      try {
        genomes = makePod(a.genome, b.genome, r, POD_SIZE, nd > 0 ? { nondisjunction: nd } : undefined);
      } catch (e) {
        toast(e instanceof Error ? e.message : '자손 덱을 만들 수 없어요.');
        notify();
        return;
      }
      const boss = activeBoss();
      const envMod = boss?.id === 'drought' ? -3 : 0;
      const selfing = aId === bId;
      st.cross = { a: aId, b: bId, selfing };
      st.crossInfo = { species: a.genome.species, phenoA: a.pheno, phenoB: b.pheno, genA: a.generation, genB: b.generation, genotypes: [a.revealed ? describeGenotype(a.genome) : '교배 당시 비공개', b.revealed ? describeGenotype(b.genome) : '교배 당시 비공개'] };
      st.pod = genomes.map((g) => makeCard(g, envMod));
      st.podTotal = st.pod.length;
      st.prediction = prediction ? {
        choice: prediction,
        ruby: st.pod.filter((c) => c.pheno.color === 'ruby').length,
        gold: st.pod.filter((c) => c.pheno.color === 'gold').length,
      } : null;
      st.stats.crosses++;
      if (selfing) {
        st.stats.selfings++;
        discover('selfing');
      }
      if (a.genome.species === 'stella') discover('dioecy');
      if (envMod !== 0) discover('environment');
      st.phase = 'play';
      drawToHand();
      commit();
    },

    // ── 출하 ──
    evaluate(uids) {
      const cards = handCards(uids);
      if (!cards) return null;
      const { type } = classify(cards);
      const level = st.handLevels[type] ?? 1;
      const b = handBase(type, level);
      return { handType: type, name: HAND_TYPES[type].name, chips: b.chips, mult: b.mult, level };
    },

    simulate(uids) {
      const cards = handCards(uids);
      if (!cards) return null;
      const res = scoreHand(cards, scoreCtx());
      res.trace.cleared = st.roundScore + res.trace.total >= order().target && deliveryComplete(order(), countDelivery(order(), st.delivery, cards));
      return res.trace;
    },

    play(uids) {
      if (st.phase !== 'play' || st.handsLeft <= 0) throw new Error('지금은 출하할 수 없어요.');
      const cards = handCards(uids);
      if (!cards) throw new Error('손에 든 모종을 1~5개체 골라 주세요.');
      const res = scoreHand(cards, scoreCtx());
      for (const uid of res.counterBumps) {
        const j = st.jokers.find((x) => x.uid === uid);
        if (j) j.counter++;
      }
      for (const c of res.concepts) discover(c);
      const t = res.trace;
      if (FLUSH_FAMILY.has(t.handType)) discover('purebred');
      if (order().requestedColor && cards.some((c) => t.scoringUids.includes(c.uid) && !c.debuffed && c.pheno.sex !== 'M' && c.pheno.color === order().requestedColor)) {
        st.requestFulfilled = true;
      }
      st.roundScore += t.total;
      st.delivery = countDelivery(order(), st.delivery, cards);
      st.handsLeft--;
      st.orderHands++;
      st.stats.handsPlayed++;
      st.stats.bestHand = Math.max(st.stats.bestHand, t.total);
      st.stats.handCounts[t.handType] = (st.stats.handCounts[t.handType] ?? 0) + 1;
      const played = new Set(uids);
      st.hand = st.hand.filter((c) => !played.has(c.uid));
      const target = order().target;
      t.cleared = st.roundScore >= target && deliveryComplete(order(), st.delivery);
      if (t.cleared) {
        recordOrder(true);
        st.phase = 'cashout';
      } else if (st.handsLeft <= 0) {
        const points = Math.max(0, target - st.roundScore);
        gameOver(points ? `출하를 다 썼어요. 목표까지 ${points}점 모자라고, 납품은 ${deliveryProgressText(order(), st.delivery)}입니다.` : `목표 점수는 넘겼지만 필수 형질을 더 납품해야 해요: ${deliveryProgressText(order(), st.delivery)}.`);
      } else {
        drawToHand();
        if (st.hand.length === 0) gameOver('자손 덱에 남은 개체가 없어요.');
      }
      commit();
      return t;
    },

    discard(uids) {
      if (st.phase !== 'play') return;
      if (st.discardsLeft <= 0) {
        toast('솎아내기를 다 썼어요.');
        notify();
        return;
      }
      const cards = handCards(uids);
      if (!cards) return;
      const males = cards.filter((c) => c.pheno.sex === 'M').length;
      const trader = countJoker('pollenTrader');
      if (males > 0 && trader > 0) {
        st.money += males * trader;
        toast(`꽃가루 상인: 수그루 ${males}개체 (+$${males * trader})`);
      }
      const inspected = cards.filter((c) => c.pheno.aneuploid && c.revealed).length;
      const karyo = countJoker('karyoScope');
      if (inspected > 0 && karyo > 0) {
        st.money += inspected * karyo;
        toast(`핵형 현미경: 이수성 모종 ${inspected}개체를 살펴보고 솎아냈어요 (+$${inspected * karyo}).`);
      }
      const set = new Set(uids);
      st.hand = st.hand.filter((c) => !set.has(c.uid));
      st.discardsLeft--;
      drawToHand();
      if (st.hand.length === 0) gameOver('자손 덱에 남은 개체가 없어요.');
      commit();
    },

    sortHand(by) {
      const suitIdx = (c: SeedCard) => SUIT_ORDER.indexOf(cardSuit(c));
      const brix = (c: SeedCard) => effBrix(c) ?? -1;
      st.hand = st.hand
        .map((c, i) => ({ c, i }))
        .sort((x, y) => {
          const d = by === 'brix' ? brix(y.c) - brix(x.c) || suitIdx(x.c) - suitIdx(y.c) : suitIdx(x.c) - suitIdx(y.c) || brix(y.c) - brix(x.c);
          return d || x.i - y.i;
        })
        .map((x) => x.c);
      notify();
    },

    // ── 정산 ──
    cashoutLines() {
      const o = order();
      const lines: CashoutLine[] = [{ label: `${o.name} 보상`, amount: o.reward }];
      if (o.requestedColor && st.requestFulfilled) lines.push({ label: '의뢰한 빛깔 출하 보너스', amount: 2 });
      if (st.handsLeft > 0) lines.push({ label: `남은 출하 ${st.handsLeft}개`, amount: st.handsLeft });
      const cap = 5 + 5 * countJoker('seedVault');
      const interest = Math.min(Math.floor(Math.max(0, st.money) / 5), cap);
      if (interest > 0) lines.push({ label: `이자 ($5마다 $1, 최대 $${cap})`, amount: interest });
      if (st.policy === 'biotech') lines.push({ label: '형질전환팀 계약 보너스', amount: 1 });
      return lines;
    },

    collect() {
      if (st.phase !== 'cashout') return;
      const total = game.cashoutLines().reduce((s, l) => s + l.amount, 0);
      st.money += total;
      const last = st.records.at(-1);
      if (last?.cleared && (order().goals?.length ?? 0) > 0) {
        const hand = HAND_RANK.filter((id) => (st.stats.handCounts[id] ?? 0) > 0).sort((a, b) => (st.stats.handCounts[b] ?? 0) - (st.stats.handCounts[a] ?? 0))[0];
        if (hand) {
          st.handLevels[hand] += 1;
          toast(`형질 납품 기록을 남겼어요. ${HAND_TYPES[hand].name} 연구 레벨 +1.`);
        }
      }
      lmoLeak();
      st.phase = 'select';
      st.selectPicksLeft = 1 + countJoker('tissueLab');
      st.selectPicked = null;
      commit();
    },

    // ── 선발 ──
    selectOptions(): SelectOptions {
      return {
        candidates: st.seen.filter((c) => c.pheno.fertile && !c.pheno.seedless),
        mustReplace: st.garden.length >= st.gardenCap,
        extraPicks: Math.max(0, st.selectPicksLeft - 1),
      };
    },

    select(uid, replacePlantId) {
      if (st.phase !== 'select') return;
      if (uid === null) {
        finishSelect();
        commit();
        return;
      }
      const card = st.seen.find((c) => c.uid === uid);
      if (!card || !card.pheno.fertile || card.pheno.seedless) {
        toast('그 모종은 선발할 수 없어요.');
        notify();
        return;
      }
      if (st.garden.length >= st.gardenCap && !(replacePlantId && plantById(replacePlantId))) {
        toast('온실이 가득 찼어요. 내보낼 개체를 골라 주세요.');
        notify();
        return;
      }
      const isClone = st.selectPicked?.uid === uid;
      const ci = st.crossInfo;
      let plant: Plant;
      if (isClone) {
        plant = makePlant({ name: `${st.selectPicked!.name} 클론`, genome: cloneGenome(card.genome), revealed: card.revealed }, 'clone', ci ? Math.max(ci.genA, ci.genB) + 1 : 1);
        plant.parents = [st.selectPicked!.plantId, st.selectPicked!.plantId];
      } else {
        const gen = ci ? Math.max(ci.genA, ci.genB) + 1 : 1;
        plant = makePlant({ name: `${gen}세대 선발 ${st.plantSerial + 1}호`, genome: cloneGenome(card.genome), revealed: card.revealed }, 'seedling', gen, st.cross ? [st.cross.a, st.cross.b] : undefined);
      }
      admitPlant(plant, replacePlantId);
      if (!isClone) st.plantSerial++;
      else discover('clone');
      if (card.brixMod !== 0) {
        discover('environment');
        toast(`환경 효과(당도 ${card.brixMod > 0 ? '+' : ''}${card.brixMod})는 유전되지 않아요. 온실에서는 원래 당도 ${card.pheno.brix}로 자라요.`);
      }
      st.selectPicked = { uid, plantId: plant.id, name: plant.name };
      st.selectPicksLeft--;
      if (st.selectPicksLeft <= 0) finishSelect();
      commit();
    },

    // ── 공방 ──
    buy(slot) {
      if (st.phase !== 'shop' || !st.shop) return { ok: false, reason: '지금은 공방이 열려 있지 않아요.' };
      if (st.pack) return { ok: false, reason: '열어 둔 봉투부터 골라 주세요.' };
      const item = st.shop.items.find((i) => i.slot === slot);
      if (!item) return { ok: false, reason: '없는 칸이에요.' };
      if (item.sold) return { ok: false, reason: '이미 팔렸어요.' };
      if (st.money < item.price) return { ok: false, reason: '돈이 모자라요.' };
      switch (item.kind) {
        case 'joker':
          if (st.jokers.length >= st.jokerCap) return { ok: false, reason: '비법 칸이 가득 찼어요.' };
          addJoker(item.id);
          break;
        case 'reagent':
          if (st.reagents.length >= st.reagentCap) return { ok: false, reason: '시약 칸이 가득 찼어요.' };
          st.reagents.push(item.id);
          break;
        case 'pack':
          st.pack = { pack: item.pack, choices: structuredClone(item.choices ?? packChoices(item.pack)), picks: PACKS[item.pack].picks };
          break;
        case 'upgrade':
          applyUpgrade(item.id);
          st.anteUpgradeSold = true;
          toast(`증축 완료: ${UPGRADES[item.id].name}`);
          break;
      }
      st.money -= item.price;
      item.sold = true;
      commit();
      return { ok: true };
    },

    reroll() {
      if (st.phase !== 'shop' || !st.shop) return { ok: false, reason: '지금은 공방이 열려 있지 않아요.' };
      if (st.pack) return { ok: false, reason: '열어 둔 봉투부터 골라 주세요.' };
      if (st.money < st.shop.rerollCost) return { ok: false, reason: '돈이 모자라요.' };
      st.money -= st.shop.rerollCost;
      st.shop.rerollCost += 1;
      const r = rng();
      const taken = new Set<string>();
      st.shop.items = st.shop.items.map((it) => (it.slot === 'card1' || it.slot === 'card2' ? cardItem(r, it.slot, taken) : it));
      commit();
      return { ok: true };
    },

    sellJoker(uid) {
      if (st.phase === 'title' || st.phase === 'review' || st.phase === 'gameover' || st.phase === 'victory') return;
      const idx = st.jokers.findIndex((j) => j.uid === uid);
      if (idx < 0) return;
      const value = game.sellValue(uid);
      const [j] = st.jokers.splice(idx, 1);
      st.money += value;
      toast(`비법을 팔았어요: ${game.jokerDef(j.id).name} (+$${value}).`);
      commit();
    },

    sellValue(uid) {
      const j = st.jokers.find((x) => x.uid === uid);
      if (!j) return 0;
      return Math.floor(game.jokerDef(j.id).cost / 2);
    },

    pickFromPack(index, replacePlantId) {
      if (!st.pack) return { ok: false, reason: '열어 둔 봉투가 없어요.' };
      const ch = st.pack.choices[index];
      if (!ch) return { ok: false, reason: '없는 선택지예요.' };
      switch (ch.kind) {
        case 'plant': {
          const err = admitPlant(ch.plant, replacePlantId);
          if (err) return { ok: false, reason: err };
          toast(`온실에 들인 개체: ${ch.plant.name}`);
          break;
        }
        case 'reagent':
          if (st.reagents.length >= st.reagentCap) return { ok: false, reason: '시약 칸이 가득 찼어요.' };
          st.reagents.push(ch.id);
          break;
        case 'joker':
          if (st.jokers.length >= st.jokerCap) return { ok: false, reason: '비법 칸이 가득 찼어요.' };
          addJoker(ch.id);
          break;
        case 'medal':
          st.handLevels[ch.hand] = (st.handLevels[ch.hand] ?? 1) + 1;
          toast(`품평회 메달: ${HAND_TYPES[ch.hand].name} Lv.${st.handLevels[ch.hand]}`);
          break;
      }
      st.pack.choices.splice(index, 1);
      st.pack.picks--;
      if (st.pack.picks <= 0 || st.pack.choices.length === 0) st.pack = null;
      commit();
      return { ok: true };
    },

    skipPack() {
      if (!st.pack) return;
      st.pack = null;
      commit();
    },

    leaveShop() {
      if (st.phase !== 'shop') return;
      st.pack = null;
      st.shop = null;
      if (st.orderIdx < 2) {
        st.orderIdx = (st.orderIdx + 1) as 0 | 1 | 2;
      } else {
        st.ante += 1;
        startAnte();
      }
      startOrder();
      commit();
    },

    // ── 시약 ──
    useReagent(index, targetUids) {
      if (!(PLAY_PHASES as readonly string[]).includes(st.phase)) return { ok: false, reason: '지금은 시약을 쓸 수 없어요.' };
      const id = st.reagents[index];
      if (!id) return { ok: false, reason: '그 칸에 시약이 없어요.' };
      const targets = Array.isArray(targetUids) ? targetUids : [];
      let message = '';
      switch (id) {
        case 'genetest': {
          if (targets.length < 1 || targets.length > 2) return { ok: false, reason: '검사할 모종이나 개체를 1~2개 골라 주세요.' };
          const holders = targets.map((t) => findHolder(t));
          if (holders.some((h) => !h)) return { ok: false, reason: '손패나 온실에 없는 대상이에요.' };
          const parts: string[] = [];
          for (const h of holders as Holder[]) {
            const g = h.kind === 'plant' ? h.plant.genome : h.card.genome;
            if (h.kind === 'plant') h.plant.revealed = true;
            else updateCard(h.card.uid, (c) => (c.revealed = true));
            if (MENDEL_LOCI.some((l) => isHeterozygous(g, l))) discover('heterozygote');
            parts.push(`${h.kind === 'plant' ? h.plant.name : '모종'}: ${describeGenotype(g)}`);
          }
          message = parts.join(' / ');
          break;
        }
        case 'colchicine': {
          const p = targets.length === 1 ? plantById(targets[0]) : undefined;
          if (!p) return { ok: false, reason: '온실의 개체 하나를 골라 주세요.' };
          if (p.genome.ploidy !== 2 || p.pheno.aneuploid) return { ok: false, reason: '2배체 개체에만 쓸 수 있어요.' };
          p.genome = doubleGenome(p.genome);
          p.pheno = phenotype(p.genome);
          p.name = `${p.name} (4n)`;
          discover('polyploid');
          message = `${p.name}: 염색체가 두 벌이 되어 4배체가 되었어요.`;
          break;
        }
        case 'scissors':
          return { ok: false, reason: '편집 작업대에서 써요.' };
        case 'vector': {
          if (st.policy !== 'biotech') return { ok: false, reason: '형질전환 도구는 형질전환팀만 사용할 수 있어요.' };
          const p = targets.length === 1 ? plantById(targets[0]) : undefined;
          if (!p) return { ok: false, reason: '온실의 개체 하나를 골라 주세요.' };
          p.genome = addTransgene(p.genome, rng());
          p.pheno = phenotype(p.genome);
          if (!p.name.includes('LMO')) p.name = `${p.name} (LMO)`;
          discover('lmo');
          message = `${p.name}: 형광 해파리 유전자가 들어갔어요.`;
          break;
        }
        case 'tissue': {
          const p = targets.length === 1 ? plantById(targets[0]) : undefined;
          if (!p) return { ok: false, reason: '온실의 개체 하나를 골라 주세요.' };
          if (st.garden.length >= st.gardenCap) return { ok: false, reason: '온실이 가득 찼어요.' };
          const clone = makePlant({ name: `${p.name} 클론`, genome: cloneGenome(p.genome), revealed: p.revealed }, 'clone', p.generation, [p.id, p.id]);
          st.garden.push(clone);
          discover('clone');
          message = `${p.name}의 조직 한 조각으로 클론을 길렀어요.`;
          break;
        }
        case 'fertilizer': {
          if (targets.length < 1 || targets.length > 2) return { ok: false, reason: '손에 든 모종을 1~2개 골라 주세요.' };
          const cards = targets.map((t) => st.hand.find((c) => c.uid === t));
          if (cards.some((c) => !c)) return { ok: false, reason: '손에 든 모종에만 쓸 수 있어요.' };
          if ((cards as SeedCard[]).some((c) => c.pheno.brix === null)) return { ok: false, reason: '수그루는 열매가 없어 비료 효과가 없어요.' };
          for (const c of cards as SeedCard[]) {
            updateCard(c.uid, (x) => {
              x.brixMod += 2;
              x.debuffed = isDebuffed(x);
            });
          }
          message = '당도 +2. 이번 주문에서만이고 유전되지는 않아요.';
          break;
        }
        case 'brush': {
          if (st.phase !== 'play') return { ok: false, reason: '출하 중에만 쓸 수 있어요.' };
          st.pod = [];
          st.hand = [];
          st.seen = []; // 선발 후보의 부모(계보)가 섞이지 않게 새 교배 것만 남긴다
          st.cross = null;
          st.prediction = null;
          st.crossInfo = null;
          st.phase = 'cross';
          message = '교배를 다시 골라요. 남은 출하·솎아내기는 그대로예요.';
          break;
        }
        default:
          return { ok: false, reason: '모르는 시약이에요.' };
      }
      st.reagents.splice(index, 1);
      if (message) toast(message);
      commit();
      return { ok: true, message };
    },

    editTargets(targetId) {
      const h = findHolder(targetId, true);
      if (!h) return [];
      const g = h.kind === 'plant' ? h.plant.genome : h.card.genome;
      const sp = SPECIES[g.species];
      const out: { group: string; copyIndex: number; locus: string; seq: string; label: string }[] = [];
      for (const locus of sp.loci.filter((l) => l.editable)) {
        const chrom = sp.chromosomes.find((c) => c.loci.includes(locus.id));
        if (!chrom) continue;
        const copies = g.chromosomes[chrom.group] ?? [];
        copies.forEach((copy, i) => {
          if (copy.alleles[locus.id] === undefined) return;
          const seq = codingSeq(g, chrom.group, i, locus.id);
          if (!seq) return;
          out.push({ group: chrom.group, copyIndex: i, locus: locus.id, seq, label: `${chrom.label} 염색체 · ${locus.name} 유전자(사본 ${i + 1})` });
        });
      }
      return out;
    },

    applyEdit(reagentIndex, targetId, group, copyIndex, locus, newSeq) {
      if (!(PLAY_PHASES as readonly string[]).includes(st.phase)) return { ok: false, reason: '지금은 편집할 수 없어요.' };
      if (st.reagents[reagentIndex] !== 'scissors') return { ok: false, reason: '그 칸에 유전자 가위가 없어요.' };
      if (st.policy === 'heritage') return { ok: false, reason: '교배·선발팀은 유전자 가위를 쓰지 않아요.' };
      const h = findHolder(targetId);
      if (!h) return { ok: false, reason: '온실 개체나 손에 든 모종만 편집할 수 있어요.' };
      const g = h.kind === 'plant' ? h.plant.genome : h.card.genome;
      const cur = codingSeq(g, group as HomologGroup, copyIndex, locus as LocusId);
      if (cur === null) return { ok: false, reason: '편집할 수 없는 자리예요.' };
      const seq = String(newSeq).toUpperCase();
      if (seq === cur) return { ok: false, reason: '바뀐 글자가 없어요.' };
      let out: { genome: Genome; result: EditResult };
      try {
        out = editCoding(g, group as HomologGroup, copyIndex, locus as LocusId, seq);
      } catch (e) {
        return { ok: false, reason: e instanceof Error ? e.message : '편집에 실패했어요.' };
      }
      setGenome(h, out.genome, true);
      st.reagents.splice(reagentIndex, 1);
      st.stats.edits++;
      discover('transcription');
      discover('dominanceMolecular');
      if (out.result.kind === 'nonsense') discover('stopCodon');
      else if (out.result.kind === 'synonymous') discover('synonymous');
      else if (out.result.kind === 'frameshift') discover('frameshift');
      toast(out.result.note);
      commit();
      return { ok: true, result: out.result };
    },

    // ── 알림 ──
    ackDiscoveries() {
      st.pendingDiscoveries = [];
      commit();
    },
    ackToasts() {
      st.toasts = [];
      commit();
    },

    // ── 저장 ──
    save,
    load() {
      const previous = st;
      try {
        const raw = storage?.getItem(saveKey);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as InternalState;
        if (!parsed || parsed.v !== 1 ||
          !['cross', 'play', 'cashout', 'select', 'shop', 'review', 'gameover', 'victory'].includes(parsed.phase) ||
          !Object.hasOwn(START_ANTE, parsed.mode) ||
          !['heritage', 'precision', 'biotech'].includes(parsed.policy) ||
          !Number.isInteger(parsed.orderIdx) || parsed.orderIdx < 0 || parsed.orderIdx > 2 ||
          !Array.isArray(parsed.orders) || parsed.orders.length !== 3 || !parsed.orders[parsed.orderIdx] ||
          ![parsed.garden, parsed.hand, parsed.pod, parsed.seen, parsed.jokers, parsed.reagents, parsed.toasts, parsed.discoveries, parsed.pendingDiscoveries].every(Array.isArray) ||
          !parsed.stats || typeof parsed.stats !== 'object' || !parsed.handLevels || typeof parsed.handLevels !== 'object') return false;
        st = parsed;
        refreshSavedCopy(st);
        st.prediction ??= null;
        st.requestFulfilled ??= false;
        st.playStyle ??= 'challenge';
        st.delivery ??= {};
        st.orderAttempt ??= 1;
        st.review ??= null;
        st.records ??= [];
        st.geneFlow ??= null;
        st.stats.retries ??= 0;
        st.suppliedSeasons ??= [];
        st.orderCheckpoint ??= null;
        for (const item of st.shop?.items ?? []) if (item.kind === 'pack' && !item.choices) item.choices = packChoices(item.pack);
        // Old contracts retain their original requirements until the next season.
        if (st.phase === 'cross' && !st.orderCheckpoint) st.orderCheckpoint = JSON.stringify({ ...st, orderCheckpoint: null });
        save();
        notify();
        return true;
      } catch {
        // 실패한 불러오기가 현재 플레이를 손상시키지 않도록 복원한다.
        st = previous;
        return false;
      }
    },
    hasSave() {
      try {
        return !!storage?.getItem(saveKey);
      } catch {
        return false;
      }
    },
    clearSave,

    // ── 도움 ──
    speciesName(id) {
      return SPECIES[id]?.name ?? (id === 'stella' ? '별다래' : '루미');
    },
    suitName(s) {
      return SUIT_NAMES[s];
    },
    plantById,
    jokerDef(id) {
      const inst = st.jokers.find((j) => j.uid === id);
      const key = inst ? inst.id : id;
      const def = JOKERS.find((j) => j.id === key);
      if (!def) throw new Error(`모르는 비법이에요: ${id}`);
      return def;
    },
    reagentDef(id) {
      const def = REAGENTS.find((d) => d.id === id);
      if (!def) throw new Error(`모르는 시약이에요: ${id}`);
      return def;
    },
    conceptDef(id) {
      return CONCEPTS[id];
    },
  };

  return game;
}
