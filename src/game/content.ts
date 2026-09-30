// 게임 콘텐츠 표 — 족보·비법·시약·보스·철학·개념 카드·증축·봉투·의뢰인
// 숫자는 docs/GDD.md 와 오케스트레이터 지시를 그대로 옮겼다. 목표 점수(ANTE_BASES)는 scripts/sim.ts 로 조정.
import type {
  BossDef,
  ConceptDef,
  ConceptId,
  HandTypeDef,
  HandTypeId,
  JokerDef,
  PackKind,
  PolicyDef,
  ReagentDef,
  UpgradeId,
} from '../contract/game';

// ── 족보 ───────────────────────────────────────────────────────
/** 강한 족보부터 (판정 순서) */
export const HAND_RANK: HandTypeId[] = [
  'flushFive', 'flushHouse', 'five', 'straightFlush', 'four', 'fullHouse',
  'flush', 'straight', 'three', 'twoPair', 'pair', 'high',
];

export const HAND_TYPES: Record<HandTypeId, HandTypeDef> = {
  high: { id: 'high', name: '단품', desc: '족보가 없으면 가장 단 모종 1포기만 점수를 내요.', chips: 5, mult: 1, perLevel: { chips: 10, mult: 1 } },
  pair: { id: 'pair', name: '한 쌍', desc: '당도가 같은 모종 2포기.', chips: 10, mult: 2, perLevel: { chips: 15, mult: 1 } },
  twoPair: { id: 'twoPair', name: '두 쌍', desc: '당도가 같은 쌍이 두 개.', chips: 20, mult: 2, perLevel: { chips: 20, mult: 1 } },
  three: { id: 'three', name: '세 쌍', desc: '당도가 같은 모종 3포기.', chips: 30, mult: 3, perLevel: { chips: 20, mult: 2 } },
  straight: { id: 'straight', name: '당도 계단', desc: '당도가 1씩 이어지는 모종 5포기. 잡종 꼬투리에서 잘 나와요.', chips: 30, mult: 4, perLevel: { chips: 30, mult: 3 } },
  flush: { id: 'flush', name: '한 빛깔', desc: '빛깔(과육색·무늬)이 같은 모종 5포기. 겉모습만 보는 족보라 순계의 증거는 아니에요.', chips: 35, mult: 4, perLevel: { chips: 15, mult: 2 } },
  fullHouse: { id: 'fullHouse', name: '풀 바구니', desc: '세 쌍 + 한 쌍.', chips: 40, mult: 4, perLevel: { chips: 25, mult: 2 } },
  four: { id: 'four', name: '네 쌍', desc: '당도가 같은 모종 4포기.', chips: 60, mult: 7, perLevel: { chips: 30, mult: 3 } },
  straightFlush: { id: 'straightFlush', name: '빛깔 계단', desc: '빛깔이 모두 같고 당도가 1씩 이어지는 5포기.', chips: 100, mult: 8, perLevel: { chips: 40, mult: 4 } },
  five: { id: 'five', name: '다섯 쌍', desc: '당도가 같은 모종 5포기.', chips: 120, mult: 12, perLevel: { chips: 35, mult: 3 } },
  flushHouse: { id: 'flushHouse', name: '빛깔 바구니', desc: '빛깔이 모두 같은 풀 바구니.', chips: 140, mult: 14, perLevel: { chips: 40, mult: 4 } },
  flushFive: { id: 'flushFive', name: '완전 균일', desc: '빛깔과 당도가 모두 같은 5포기. 겉모습과 당도가 같아도 유전자형까지 같은지는 몰라요.', chips: 160, mult: 16, perLevel: { chips: 50, mult: 3 } },
};

/** 한 빛깔 계열 (빛깔 인증서·균일성 심사·박람회가 본다) */
export const FLUSH_FAMILY: ReadonlySet<HandTypeId> = new Set<HandTypeId>(['flush', 'straightFlush', 'flushHouse', 'flushFive']);

// ── 장인의 비법(조커) ───────────────────────────────────────────
export const JOKERS: JokerDef[] = [
  { id: 'shears', name: '할머니의 전지가위', rarity: 'common', cost: 2, desc: '+4 배수.', flavor: '할머니가 50년 쓰신 가위. 날이 아직도 서 있어요.' },
  { id: 'rubyLover', name: '루비 애호가', rarity: 'common', cost: 5, desc: '점수 내는 루비 모종마다 +3 배수.', flavor: '루비빛만 보면 지갑이 열리는 단골이에요.' },
  { id: 'goldCollector', name: '골드 수집가', rarity: 'common', cost: 5, desc: '점수 내는 골드 모종마다 +3 배수.', flavor: '골드 과육만 모아요. 열성 동형접합이라야 나오니 더 귀하대요.' },
  { id: 'patternArtisan', name: '무늬 장인', rarity: 'common', cost: 5, desc: '점수 내는 무늬 있는 모종마다 +30 칩.', flavor: '별무늬 한 줄에 값이 달라져요.' },
  { id: 'refractometer', name: '굴절계', rarity: 'common', cost: 4, desc: '점수 내는 모종마다 +(당도−10) 칩. 당도 11 이상일 때만.', flavor: '빛이 꺾이는 정도로 당도를 재요.' },
  { id: 'purebredCert', name: '빛깔 인증서', rarity: 'uncommon', cost: 6, desc: '한 빛깔 계열 족보(한 빛깔·빛깔 계단·빛깔 바구니·완전 균일)면 ×3 배수. 빛깔만 확인하며 순계 인증은 아니에요.', flavor: '겉모습이 같아도 숨은 대립유전자는 다를 수 있어요.', concept: 'purebred' },
  { id: 'heterosis', name: '잡종강세', rarity: 'uncommon', cost: 6, desc: '과육색·무늬 유전자 중 하나라도 이형접합인 모종이 점수 낼 때마다 +2 배수.', flavor: '겉은 같아 보여도 속은 섞여 있어요.', concept: 'heterozygote' },
  { id: 'hideAndSeek', name: '숨바꼭질 대립유전자', rarity: 'uncommon', cost: 7, desc: '과육색이나 무늬가 두 부모 어느 쪽에도 없던 모종마다 ×1.5 배수.', flavor: '부모가 숨겨 둔 대립유전자가 얼굴을 내밀었어요.', concept: 'segregation' },
  { id: 'selfingMaster', name: '자가수분 명인', rarity: 'uncommon', cost: 6, desc: '이번 교배가 자가수분이면 ×2 배수.', flavor: '한 포기, 한 꽃, 한 가족.', concept: 'selfing' },
  { id: 'breedingLog', name: '교배 일지', rarity: 'common', cost: 5, desc: '열성 표현형(골드 또는 무늬 없음) 모종이 점수를 낸 출하마다 1씩 쌓이고, 쌓인 만큼 +배수.', flavor: '할머니 일지의 마지막 장은 늘 빈칸이었어요.' },
  { id: 'mendelGlasses', name: '멘델의 안경', rarity: 'common', cost: 3, desc: '겉모습만으로 확실한 유전자형을 카드에 표시해요.', flavor: '완두밭을 오래 들여다본 사람의 눈을 빌려요.' },
  { id: 'punnettNote', name: '퍼넷 노트', rarity: 'uncommon', cost: 4, desc: '교배 전에 자손의 빛깔·당도 기대 분포를 보여 줘요.', flavor: '네모 칸 몇 개로 꼬투리 속을 미리 봐요.' },
  { id: 'beeSwarm', name: '꿀벌 군단', rarity: 'uncommon', cost: 6, desc: '주문마다 출하 +1.', flavor: '윙윙, 오늘도 출근 완료.' },
  { id: 'seedVault', name: '씨앗 금고', rarity: 'common', cost: 5, desc: '이자 상한 +$5 (최대 $10).', flavor: '씨앗도 돈도 묵힐수록 불어나요.' },
  { id: 'pollenTrader', name: '꽃가루 상인', rarity: 'common', cost: 4, desc: '수그루를 솎아낼 때마다 +$1.', flavor: '"꽃가루 삽니다, 수그루 삽니다."', minAnte: 3 },
  { id: 'xHeir', name: 'X의 상속자', rarity: 'uncommon', cost: 6, desc: '별다래 교배에서 아비(수그루)와 잎 빛깔이 같은 암그루 모종마다 +4 배수.', flavor: '아비의 X 염색체는 모든 딸에게 가요.', concept: 'xlinked', minAnte: 3 },
  { id: 'colchicineNotes', name: '콜히친 노트', rarity: 'rare', cost: 8, desc: '씨 없는(3배체) 모종의 배수가 ×1.5 대신 ×2.', flavor: '방추사가 멈추면 염색체가 두 배로.', concept: 'triploid', minAnte: 5 },
  { id: 'karyoScope', name: '핵형 현미경', rarity: 'uncommon', cost: 5, desc: '이수성 모종이 손에 들어오면 유전자형·핵형을 공개해요. 그 모종을 솎아내면 +$1.', flavor: '염색체 수를 보고 직접 선발해요.', concept: 'nondisjunction', minAnte: 5 },
  { id: 'scissorRack', name: '가위 거치대', rarity: 'rare', cost: 7, desc: '주문을 시작할 때 시약 칸이 비어 있으면 유전자 가위 1개를 받아요.', flavor: '가위는 늘 제자리에.', minAnte: 7, policy: ['precision', 'biotech'] },
  { id: 'jellyfishGene', name: '형광 해파리 유전자', rarity: 'rare', cost: 6, desc: '점수 내는 형광 모종마다 ×1.5 배수. 대신 주문이 끝날 때 꽃가루 유출 확률 +25%.', flavor: '바닷속 빛을 과일에 옮겼어요. 대가도 따라와요.', concept: 'lmo', policy: ['biotech'] },
  { id: 'climateHouse', name: '기후 적응 온실', rarity: 'rare', cost: 8, desc: '의뢰인(보스)의 특별 규칙을 무시해요. 목표 점수는 그대로예요.', flavor: '2150년 날씨에도 끄떡없는 돔.' },
  { id: 'grandpaNotes', name: '할아버지의 향기 노트', rarity: 'legendary', cost: 10, desc: '당도 16 이상 모종은 칩을 한 번 더 더해요.', flavor: '할아버지는 향기만 맡고도 당도를 맞히셨대요.' },
  { id: 'tissueLab', name: '조직배양 랩', rarity: 'uncommon', cost: 6, desc: '선발 때 1포기를 더 들일 수 있어요. 같은 모종을 한 번 더 고르면 클론이에요.', flavor: '잎 한 조각이면 충분해요.', concept: 'clone' },
];

// ── 연구 시약(타로) ────────────────────────────────────────────
export const REAGENTS: ReagentDef[] = [
  { id: 'genetest', name: '유전자 검사 키트', desc: '손에 든 모종이나 온실 포기 최대 2개의 유전자형을 공개해요.', cost: 3, target: 'hand2', concept: 'heterozygote' },
  { id: 'colchicine', name: '콜히친', desc: '온실의 2배체 포기 하나를 4배체로 만들어요. 4배체는 열매가 커요.', cost: 4, target: 'garden1', concept: 'polyploid', minAnte: 5 },
  { id: 'scissors', name: '유전자 가위', desc: '편집 작업대에서 과육색·쓴맛 유전자의 DNA를 한 글자씩 고쳐요.', cost: 5, target: 'garden1', concept: 'transcription', minAnte: 7, policy: ['precision', 'biotech'] },
  { id: 'vector', name: '형질전환 벡터', desc: '온실 포기 하나에 형광 해파리 유전자를 넣어요. 유전자 변형 생물체(LMO)가 돼요.', cost: 5, target: 'garden1', concept: 'lmo', minAnte: 7, policy: ['biotech'] },
  { id: 'tissue', name: '조직배양', desc: '온실 포기 하나를 똑같이 복제해요. 온실에 빈 칸이 있어야 해요.', cost: 4, target: 'garden1', concept: 'clone' },
  { id: 'fertilizer', name: '선발 비료', desc: '손에 든 모종 최대 2개의 당도 +2. 이번 주문에서만이고 유전되지 않아요.', cost: 2, target: 'hand2', concept: 'environment' },
  { id: 'brush', name: '붓 한 자루', desc: '출하 중에 써요. 남은 출하·솎아내기는 그대로 두고 교배를 다시 골라요.', cost: 3, target: 'none' },
];

// ── 보스(명품 의뢰인) ──────────────────────────────────────────
export const BOSSES: BossDef[] = [
  { id: 'coldsnap', name: '냉해', client: '극지 연구기지 조리장: "추위에 강한 걸로요."', desc: '갑작스러운 추위로 감수분열 때 비분리가 잘 일어나요(염색체 쌍마다 8%).', minAnte: 5, concept: 'nondisjunction' },
  { id: 'nobees', name: '벌이 없는 날', client: '꿀벌 보호구역 관리인: "오늘은 벌들이 쉬어요."', desc: '다른 포기와 교배할 수 없어요. 같은 포기를 두 번 골라 자가수분만 돼요.', minAnte: 2, concept: 'selfing' },
  { id: 'uniformity', name: '균일성 심사', client: '품종 등록 심사관: "이번 출하는 빛깔이 같아야 해요."', desc: '한 빛깔 계열 족보가 아니면 점수가 절반이에요. 빛깔 심사만으로 순계를 판정하지 않아요.', minAnte: 2, concept: 'purebred' },
  { id: 'drought', name: '가뭄', client: '사막 도시 음료 회사: "물이 귀한 동네예요."', desc: '모든 모종의 당도가 3 낮아요. 환경 탓이라 유전되지 않아요.', minAnte: 1, concept: 'environment' },
  { id: 'judge', name: '과일 심사위원', client: '열매만 보는 심사위원: "꽃은 안 받아요."', desc: '수그루(꽃만 피는 포기) 모종은 점수를 못 내요.', minAnte: 3, concept: 'dioecy' },
  { id: 'picky', name: '편식 셰프', client: '한 가지 색을 못 먹는 셰프: "그 색만은 빼 주세요."', desc: '과육색 하나가 무효예요(주문을 받을 때 정해져요).', minAnte: 1 },
  { id: 'sommelier', name: '까다로운 소믈리에', client: '과일 소믈리에: "밍밍한 건 사양할게요."', desc: '당도 13 이하 모종은 점수를 못 내요.', minAnte: 2, concept: 'polygenic' },
  { id: 'lmoCheck', name: 'LMO 표시제 점검', client: '유전자 변형 생물체 표시 점검반', desc: '형광(LMO) 모종은 점수를 못 내요.', minAnte: 7, concept: 'lmo' },
  { id: 'expo', name: '2150 명품 박람회', client: '세계 과일 박람회 심사단: "한 해의 마지막 무대예요."', desc: '목표 점수 ×3. 첫 출하가 한 빛깔 계열이 아니면 그 출하는 0점이에요.', minAnte: 8, concept: 'purebred' },
];

// ── 브랜드 철학(덱) ────────────────────────────────────────────
export const POLICIES: PolicyDef[] = [
  { id: 'heritage', name: '전통 육종 아틀리에', desc: '교배와 선발만으로 품종을 만들어요.', tradeoff: '출하 +1 / 유전자 가위·형질전환을 쓰지 않아요.' },
  { id: 'precision', name: '정밀 편집 랩', desc: '유전자 가위로 필요한 글자만 고쳐요.', tradeoff: '시작 시약 유전자 가위 1개(앤티 1부터 공방에 나와요) / 형질전환은 하지 않아요.' },
  { id: 'biotech', name: '바이오테크 하우스', desc: '다른 생물의 유전자도 넣어 새 형질을 만들어요.', tradeoff: '시작 비법 형광 해파리 유전자, 주문 보상 +$1 / LMO 표시제 점검이 앤티 3부터 오고, 꽃가루가 새어 나갈 수 있어요.' },
];

// ── 개념 카드(연구 노트) ───────────────────────────────────────
export const CONCEPTS: Record<ConceptId, ConceptDef> = {
  segregation: {
    id: 'segregation',
    title: '숨어 있던 대립유전자 — 분리',
    body: '두 부모 어디에도 없던 빛깔이 꼬투리에서 나왔어요. 부모가 겉으로 드러나지 않는 열성 대립유전자를 하나씩 숨기고 있었던 거예요.',
    fiction: '루미의 과육색(R/r)·별무늬(S/s) 유전자와 그 이름은 게임 설정이에요.',
    real: '멘델은 완두 교배로, 한 쌍의 대립유전자가 생식세포를 만들 때 서로 갈라져 하나씩만 들어간다는 분리의 규칙을 밝혔어요(1865년 발표). 이형접합(Rr)끼리 교배하면 자손의 약 1/4이 열성 동형접합(rr)이라 열성 형질이 다시 나타나요.',
    standard: '12유전01-01',
  },
  purebred: {
    id: 'purebred',
    title: '겉모습의 균일성과 순계',
    body: '출하한 모종 다섯이 같은 빛깔이었어요. 여기서 확인한 것은 겉모습뿐이에요. 숨은 대립유전자가 같다는 뜻은 아니므로, 이 출하만으로 순계라고 할 수 없어요.',
    real: '순계는 관심 형질에 대해 자가수분을 거듭해도 같은 형질의 자손이 나오는 계통이에요. 동형접합 RR을 자가수분하면 RR이 유지되지만, RR × rr에서 나온 잡종 1대는 모두 같은 우성 표현형이어도 Rr이에요. 이 Rr을 자가수분하면 다음 대에는 RR : Rr : rr = 1 : 2 : 1로 분리해요. 멘델도 여러 대 자가수분해 순계임을 확인한 완두로 실험을 시작했어요.',
    standard: '12유전01-01',
  },
  selfing: {
    id: 'selfing',
    title: '자가수분',
    body: '한 포기의 꽃가루를 그 포기의 암술에 묻혔어요. 자가수분을 거듭하면 대마다 이형접합 자리가 줄어 순계에 가까워져요.',
    fiction: '루미는 한 꽃에 암술과 수술이 함께 있는 가상의 식물이에요.',
    real: '완두처럼 한 꽃에 암술과 수술이 함께 있는 식물은 자가수분을 할 수 있어요. 이형접합(Aa)을 자가수분하면 자손은 AA : Aa : aa = 1 : 2 : 1이라 이형접합이 절반으로 줄어요. 육종가는 이렇게 대를 거듭해 순계를 만들어요.',
    standard: '12유전01-01',
  },
  polygenic: {
    id: 'polygenic',
    title: '다유전자유전과 연속 변이',
    body: '한 주문에서 당도가 여섯 가지 넘게 나왔어요. 당도는 여러 유전자가 조금씩 더해서 정해지기 때문에 값이 촘촘하게 퍼져요.',
    fiction: '루미·별다래의 당도가 유전자 6개(Q1~Q6)의 + 대립유전자 수만큼 8에서 20까지 오른다는 규칙은 게임 설정이에요.',
    real: '사람의 키·피부색, 과일의 당도처럼 여러 유전자와 환경이 함께 정하는 형질은 값이 끊기지 않고 이어지는 연속 변이를 보여요. 이런 유전을 다유전자유전이라고 해요.',
    standard: '12유전01-03',
  },
  environment: {
    id: 'environment',
    title: '환경 변이는 유전되지 않아요',
    body: '가뭄이나 비료로 달라진 당도는 그 모종 한 대에만 생긴 변화예요. 선발해 온실에 들이면 유전자가 정한 원래 당도로 자라요.',
    fiction: '가뭄 −3, 비료 +2 같은 수치는 게임 설정이에요.',
    real: '표현형은 유전자형과 환경이 함께 만들어요. 환경 때문에 생긴 변화는 생식세포의 DNA를 바꾸지 않아서 자손에게 전해지지 않아요. 그래서 육종에서는 같은 환경에서 기른 뒤 비교해서 선발해요.',
    standard: '12유전01-03',
  },
  heterozygote: {
    id: 'heterozygote',
    title: '이형접합 — 겉으로는 모르는 유전자형',
    body: '겉모습은 우성인데 속에 열성 대립유전자를 하나 숨긴 이형접합 모종이 드러났어요.',
    fiction: '검사 키트로 바로 유전자형을 읽고, 잡종강세 비법이 이형접합 모종에 배수를 주는 것은 게임 설정이에요.',
    real: '우성 표현형은 동형접합(RR)일 수도, 이형접합(Rr)일 수도 있어요. 겉모습만으로는 구별할 수 없어서, 열성 동형접합(rr)과 교배해 자손을 보는 검정교배로 유전자형을 알아내요. 실제 잡종강세(잡종 1대가 부모보다 왕성한 현상)는 여러 유전자가 얽힌 현상이에요.',
    standard: '12유전01-01',
  },
  dioecy: {
    id: 'dioecy',
    title: '암수딴그루',
    body: '별다래는 암그루와 수그루가 따로 있어서 둘을 짝지어야만 꼬투리를 얻어요. 열매는 암그루에만 열려요.',
    fiction: '별다래는 키위를 본뜬 가상의 종이에요.',
    real: '키위(참다래)는 암그루와 수그루가 따로 있는 암수딴그루 식물이고, 사람처럼 XY 방식으로 성이 결정돼요. 열매는 암그루에만 열려서 과수원에는 암그루 사이에 수그루를 섞어 심어요.',
    standard: '12유전01-01',
  },
  xlinked: {
    id: 'xlinked',
    title: 'X 염색체의 경로',
    body: '은빛 잎 아비의 딸 그루가 모두 은빛 잎이었어요. 아비는 하나뿐인 X 염색체를 모든 딸에게 물려주니까요.',
    fiction: '별다래의 은빛 잎 유전자(L)는 게임 설정이에요.',
    real: 'X 염색체에 있는 유전자는 성별에 따라 다르게 전해져요. 아버지(XY)의 X는 모든 딸에게 가고 아들에게는 가지 않아요. 사람의 적록 색맹(적록 색각 이상)과 혈우병이 X 염색체를 따라 유전되는 예예요.',
    standard: '12유전01-01',
  },
  polyploid: {
    id: 'polyploid',
    title: '배수체와 콜히친',
    body: '콜히친을 쓰자 모든 염색체가 두 벌이 되어 4배체(4n)가 되었어요. 세포가 커지면서 열매도 커졌어요.',
    fiction: '4배체 모종이 +10 칩을 받는 것은 게임 설정이에요.',
    real: '콜히친은 세포 분열 때 방추사가 만들어지지 못하게 막아요. 복제된 염색체가 양쪽으로 끌려가지 못하고 세포도 둘로 나뉘지 못해, 한 세포에 모두 남으면서 염색체 수가 두 배가 돼요. 배수체 식물은 대개 세포와 기관이 커요.',
    standard: '12유전01-04',
  },
  triploid: {
    id: 'triploid',
    title: '3배체와 씨 없는 과일',
    body: '4배체와 2배체를 교배했더니 3배체(3n) 모종이 나왔어요. 감수분열 때 염색체가 짝을 제대로 짓지 못해 씨를 만들지 못해요(불임).',
    fiction: '씨 없는 모종이 ×1.5 배수를 받는 것은 게임 설정이에요.',
    real: '씨 없는 수박은 일본의 기하라 히토시가 1940년대에 개발한 3배체예요. 4배체 수박에 2배체 수박의 꽃가루를 묻혀 3배체 씨를 얻어요. 우장춘 박사가 1950년대 한국에서 재배를 시연해 널리 알려졌지만, 처음 만든 사람은 아니에요.',
    standard: '12유전01-04',
  },
  nondisjunction: {
    id: 'nondisjunction',
    title: '비분리와 이수성',
    body: '감수분열 때 한 쌍의 염색체가 갈라지지 않아, 염색체가 하나 많거나 적은 모종이 나왔어요.',
    fiction: '냉해 때 비분리 확률이 오르고 이수성 모종의 당도가 3 낮아지는 것은 게임 설정이에요.',
    real: '감수분열에서 상동 염색체나 염색 분체가 제대로 나뉘지 않는 것을 비분리라고 해요. 그런 생식세포가 수정되면 염색체가 2n+1 또는 2n−1개인 이수성 개체가 생겨요. 사람의 예로 21번 염색체가 3개인 다운 증후군이 있어요.',
    standard: '12유전01-04',
  },
  transcription: {
    id: 'transcription',
    title: '전사와 번역',
    body: '편집 작업대에서 DNA 글자를 바꾸자 mRNA와 아미노산 사슬이 따라 바뀌었어요.',
    fiction: '루미의 과육색·쓴맛 유전자 서열은 게임을 위해 지어낸 짧은 서열이에요.',
    real: 'DNA의 유전 정보는 mRNA로 전사되고(T 대신 U), mRNA의 염기 3개(코돈)가 아미노산 하나를 지정해 단백질로 번역돼요. 그래서 DNA가 바뀌면 단백질이 바뀔 수 있어요. 실제로 크리스퍼 유전자 가위로 유전자를 편집해 GABA 함량을 높인 토마토가 2021년 일본에서 판매되었어요.',
    standard: '12유전02-01',
  },
  stopCodon: {
    id: 'stopCodon',
    title: '종결 코돈',
    body: '바꾼 자리가 종결 코돈이 되어 번역이 일찍 끝났어요. 짧아진 단백질은 제 일을 못 해요(기능 상실).',
    real: 'mRNA의 UAA·UAG·UGA는 아미노산을 지정하지 않는 종결 코돈이에요. 리보솜은 여기서 번역을 멈춰요. 유전자 중간에 종결 코돈이 생기면 짧고 기능 없는 단백질이 만들어져요.',
    standard: '12유전02-02',
  },
  synonymous: {
    id: 'synonymous',
    title: '코돈의 중복성',
    body: '글자를 바꿨는데 아미노산이 그대로라 아무 일도 일어나지 않았어요.',
    real: '코돈은 64개인데 아미노산은 20종이라, 여러 코돈이 같은 아미노산을 지정해요(코돈의 중복성). 그래서 염기 하나가 바뀌어도 단백질이 그대로일 때가 있어요.',
    standard: '12유전02-02',
  },
  frameshift: {
    id: 'frameshift',
    title: '틀 이동',
    body: '글자 하나를 빼거나 넣자 그 뒤 코돈이 모두 한 칸씩 밀려, 전혀 다른 아미노산이 이어졌어요.',
    real: '코돈은 겹치지 않고 세 글자씩 차례로 읽혀요. 염기가 하나 빠지거나 끼어들면 그 뒤의 읽기 틀이 통째로 바뀌어 아미노산 서열이 크게 달라지고, 대개 얼마 못 가 종결 코돈을 만나요.',
    standard: '12유전02-02',
  },
  dominanceMolecular: {
    id: 'dominanceMolecular',
    title: '우성과 열성의 분자 원리',
    body: '한 사본의 유전자를 망가뜨려도 다른 사본이 제 기능을 하면 겉모습은 그대로예요. 모든 사본이 망가져야 열성 표현형이 나타나요.',
    real: '흰색·골드 같은 열성 대립유전자는 효소를 만들지 못하는, 기능을 잃은 대립유전자인 경우가 많아요. 기능 있는 대립유전자 하나로도 효소가 충분히 만들어지면 그 형질이 우성으로 나타나요.',
    standard: '12유전02-01',
  },
  lmo: {
    id: 'lmo',
    title: '유전자 변형 생물체(LMO)',
    body: '다른 생물의 유전자를 넣어 형광을 내는 포기가 생겼어요. 이런 생물을 유전자 변형 생물체(LMO)라고 해요.',
    fiction: '루미·별다래와 형광 해파리 유전자의 점수 효과는 게임 설정이에요.',
    real: '녹색 형광 단백질(GFP) 유전자는 해파리(Aequorea victoria)에서 왔고, 다른 생물에 넣어 표지로 널리 써요. 우리나라는 「유전자변형생물체의 국가간 이동 등에 관한 법률」로 LMO를 관리하고, 표시 제도를 두고 있어요.',
    standard: '12유전03-04',
  },
  geneFlow: {
    id: 'geneFlow',
    title: '유전자 흐름 — 꽃가루 유출',
    body: '형광 포기의 꽃가루가 날아가 이웃 포기에 형광 유전자가 섞였어요.',
    fiction: '유출 확률 20%·25%와 온실 안 유출 규칙은 게임 설정이에요.',
    real: '꽃가루는 바람과 곤충을 타고 멀리 가요. LMO 작물의 유전자가 주변 작물이나 가까운 야생 식물로 옮겨 갈 수 있다는 걱정 때문에, LMO는 환경에 내보내기 전에 위해성을 심사하고 관리해요. 편리함과 위험을 함께 따지는 것이 생명윤리의 과제예요.',
    standard: '12유전03-05',
  },
  clone: {
    id: 'clone',
    title: '클론과 분화 전능성',
    body: '포기 조직 한 조각을 배양해 유전자형이 똑같은 포기를 하나 더 얻었어요.',
    fiction: '온실에서 한 주문 만에 다 자라는 것은 게임 설정이에요.',
    real: '식물은 이미 분화한 조직 한 조각에서도 온전한 개체를 기를 수 있어요(분화 전능성). 이렇게 얻은 개체는 유전자형이 같은 클론이에요. 조직 배양으로 좋은 품종의 모종을 한꺼번에 많이 만들어요.',
    standard: '12유전02-04',
  },
};

// ── 증축(바우처) ───────────────────────────────────────────────
export interface UpgradeDef { id: UpgradeId; name: string; desc: string; cost: number }
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  greenhouse: { id: 'greenhouse', name: '온실 증축', desc: '온실 칸 +1.', cost: 6 },
  hands: { id: 'hands', name: '출하 트럭', desc: '주문마다 출하 +1.', cost: 10 },
  discards: { id: 'discards', name: '솎음 호미', desc: '주문마다 솎아내기 +1.', cost: 8 },
  handSize: { id: 'handSize', name: '넓은 모판', desc: '손에 드는 모종 +1.', cost: 10 },
  jokerSlot: { id: 'jokerSlot', name: '비법 서재', desc: '비법 칸 +1.', cost: 12 },
  reroll: { id: 'reroll', name: '단골 할인', desc: '공방 새로고침 −$2.', cost: 6 },
};
export const UPGRADE_ORDER: UpgradeId[] = ['greenhouse', 'hands', 'discards', 'handSize', 'jokerSlot', 'reroll'];

// ── 씨앗 봉투(부스터 팩) ───────────────────────────────────────
export interface PackDef { kind: PackKind; name: string; desc: string; price: number; size: number; picks: number }
export const PACKS: Record<PackKind, PackDef> = {
  seed: { kind: 'seed', name: '시장 씨앗 봉투', desc: '시장 품종 3포기 중 1포기. 유전자형은 몰라요.', price: 4, size: 3, picks: 1 },
  rareSeed: { kind: 'rareSeed', name: '희귀 씨앗 상자', desc: '당도 높은 품종·순계·4배체·은빛 수그루 같은 귀한 포기 3개 중 1개.', price: 6, size: 3, picks: 1 },
  reagent: { kind: 'reagent', name: '시약 꾸러미', desc: '연구 시약 3개 중 1개.', price: 4, size: 3, picks: 1 },
  medal: { kind: 'medal', name: '품평회 메달함', desc: '족보 3개 중 하나의 레벨을 올려요.', price: 4, size: 3, picks: 1 },
  joker: { kind: 'joker', name: '비법 두루마리', desc: '장인의 비법 2개 중 1개.', price: 6, size: 2, picks: 1 },
};

// ── 주문 ───────────────────────────────────────────────────────
/** 앤티별 기본 목표(동네 장터). 고급 식당 ×1.5, 보스 ×2, 최종 박람회 ×3. scripts/sim.ts 로 조정한 값 */
export const ANTE_BASES: number[] = [300, 1500, 8000, 28000, 40000, 55000, 75000, 100000];
export const ORDER_REWARD = { small: 3, big: 4, boss: 5 } as const;

/** 동네 장터·고급 식당 의뢰인 (모두 가상 인물). 빛깔 요청은 주문 생성 시 붙인다. */
export const CLIENTS: string[] = [
  '화성 개척지 셰프 미라',
  '달 궤도 호텔 파티시에',
  '차 소믈리에 서하',
  '해저 도시 급식실 영양사',
  '우주 정거장 바텐더',
  '동네 떡집 사장님',
  '과일 빙수 가게 주인',
  '할머니의 오랜 단골',
  '도시락 카페 신혼부부',
  '북극 씨앗은행 연구원',
  '학교 과학 동아리',
];

/** 시장 품종 이름 앞에 붙는 산지 (가상) */
export const MARKET_ORIGINS: string[] = ['화성 개척지', '달 뒷면', '심해 돔', '북극 씨앗은행', '사막 온실', '안개 계곡', '구름 농장', '옛 서울 옥상'];
