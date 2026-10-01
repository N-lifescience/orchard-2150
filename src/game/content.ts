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
  { id: 'shears', name: '엘레나 로시의 전지가위', rarity: 'common', cost: 2, desc: '+4 배수.', flavor: '발렌시아 육종가 엘레나가 쓰던 가위예요.' },
  { id: 'rubyLover', name: '루비 애호가', rarity: 'common', cost: 5, desc: '점수 내는 루비 모종마다 +3 배수.', flavor: '루비빛만 보면 지갑이 열리는 단골이에요.' },
  { id: 'goldCollector', name: '골드 수집가', rarity: 'common', cost: 5, desc: '점수 내는 골드 모종마다 +3 배수.', flavor: '골드 과육만 모아요. 열성 동형접합이라야 나오니 더 귀하대요.' },
  { id: 'patternArtisan', name: '무늬 장인', rarity: 'common', cost: 5, desc: '점수 내는 무늬 있는 모종마다 +30 칩.', flavor: '별무늬 한 줄에 값이 달라져요.' },
  { id: 'refractometer', name: '굴절계', rarity: 'common', cost: 4, desc: '점수 내는 모종마다 +(당도−10) 칩. 당도 11 이상일 때만.', flavor: '빛이 꺾이는 정도로 당도를 재요.' },
  { id: 'purebredCert', name: '빛깔 인증서', rarity: 'uncommon', cost: 6, desc: '한 빛깔 계열 족보(한 빛깔·빛깔 계단·빛깔 바구니·완전 균일)면 ×3 배수. 빛깔만 확인하며 순계 인증은 아니에요.', flavor: '겉모습이 같아도 숨은 대립유전자는 다를 수 있어요.', concept: 'purebred' },
  { id: 'heterosis', name: '잡종강세', rarity: 'uncommon', cost: 6, desc: '과육색·무늬 유전자 중 하나라도 이형접합인 모종이 점수 낼 때마다 +2 배수.', flavor: '겉은 같아 보여도 속은 섞여 있어요.', concept: 'heterozygote' },
  { id: 'hideAndSeek', name: '숨바꼭질 대립유전자', rarity: 'uncommon', cost: 7, desc: '과육색이나 무늬가 두 부모 어느 쪽에도 없던 모종마다 ×1.5 배수.', flavor: '부모가 숨겨 둔 대립유전자가 얼굴을 내밀었어요.', concept: 'segregation' },
  { id: 'selfingMaster', name: '자가수분 명인', rarity: 'uncommon', cost: 6, desc: '이번 교배가 자가수분이면 ×2 배수.', flavor: '한 포기, 한 꽃, 한 가족.', concept: 'selfing' },
  { id: 'breedingLog', name: '교배 일지', rarity: 'common', cost: 5, desc: '골드 또는 무늬 없는 모종이 점수를 낸 출하마다 +1 배수가 쌓여요.', flavor: '엘레나의 기록에는 실패한 교배도 빠짐없이 적혀 있어요.' },
  { id: 'mendelGlasses', name: '멘델의 안경', rarity: 'common', cost: 3, desc: '겉모습만으로 확실한 유전자형을 카드에 표시해요.', flavor: '완두밭을 오래 들여다본 사람의 눈을 빌려요.' },
  { id: 'punnettNote', name: '퍼넷 노트', rarity: 'uncommon', cost: 4, desc: '유전자형이 공개된 두 부모의 자손 빛깔·당도 기대 분포를 보여 줘요.', flavor: '관찰한 부모 정보를 토대로 다음 자손을 예상해요.' },
  { id: 'beeSwarm', name: '꿀벌 군단', rarity: 'uncommon', cost: 6, desc: '주문마다 출하 +1.', flavor: '윙윙, 오늘도 출근 완료.' },
  { id: 'seedVault', name: '씨앗 금고', rarity: 'common', cost: 5, desc: '이자 상한 +$5 (최대 $10).', flavor: '씨앗도 돈도 묵힐수록 불어나요.' },
  { id: 'pollenTrader', name: '꽃가루 상인', rarity: 'common', cost: 4, desc: '수그루를 솎아낼 때마다 +$1.', flavor: '"꽃가루 삽니다, 수그루 삽니다."', minAnte: 3 },
  { id: 'xHeir', name: 'X의 상속자', rarity: 'uncommon', cost: 6, desc: '별다래 교배에서 아비(수그루)와 잎 빛깔이 같은 암그루 모종마다 +4 배수.', flavor: '아비의 X 염색체는 모든 딸에게 가요.', concept: 'xlinked', minAnte: 3 },
  { id: 'colchicineNotes', name: '콜히친 노트', rarity: 'rare', cost: 8, desc: '씨 없는(3배체) 모종의 배수가 ×1.5 대신 ×2.', flavor: '방추사가 멈추면 염색체가 두 배로.', concept: 'triploid', minAnte: 5 },
  { id: 'karyoScope', name: '핵형 현미경', rarity: 'uncommon', cost: 5, desc: '이수성 모종이 손에 들어오면 유전자형·핵형을 공개해요. 그 모종을 솎아내면 +$1.', flavor: '염색체 수를 보고 직접 선발해요.', concept: 'nondisjunction', minAnte: 5 },
  { id: 'scissorRack', name: '가위 거치대', rarity: 'rare', cost: 7, desc: '주문을 시작할 때 시약 칸이 비어 있으면 유전자 가위 1개를 받아요.', flavor: '가위는 늘 제자리에.', minAnte: 7, policy: ['precision', 'biotech'] },
  { id: 'jellyfishGene', name: '형광 해파리 유전자', rarity: 'rare', cost: 6, desc: '점수 내는 형광 모종마다 ×1.5 배수. 대신 주문이 끝날 때 꽃가루 유출 확률 +25%.', flavor: '바닷속 빛을 과일에 옮겼어요. 대가도 따라와요.', concept: 'lmo', policy: ['biotech'] },
  { id: 'climateHouse', name: '기후 적응 온실', rarity: 'rare', cost: 8, desc: '의뢰인(보스)의 특별 규칙을 무시해요. 목표 점수는 그대로예요.', flavor: '2150년 날씨에도 끄떡없는 돔.' },
  { id: 'grandpaNotes', name: '마테오 비앙키의 향기 노트', rarity: 'legendary', cost: 10, desc: '당도 16 이상 모종은 칩을 한 번 더 더해요.', flavor: '마테오는 향과 당도를 함께 기록했어요.' },
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
  { id: 'coldsnap', name: '냉해 계약', client: '나디아 볼코바 · 트롬쇠 종자은행', desc: '추위 때문에 감수분열 중 비분리가 늘어요(염색체 쌍마다 8%).', minAnte: 5, concept: 'nondisjunction' },
  { id: 'nobees', name: '자가수분 계약', client: '에바 린드 · 스톡홀름 도시농장', desc: '다른 포기와 교배할 수 없어요. 한 포기를 골라 자가수분하세요.', minAnte: 2, concept: 'selfing' },
  { id: 'uniformity', name: '균일성 검사', client: '오스카 베르너 · 취리히 품종등록소', desc: '한 빛깔 계열 족보가 아니면 점수가 절반이에요. 같은 빛깔이 순계의 증거는 아니에요.', minAnte: 1, concept: 'purebred' },
  { id: 'drought', name: '가뭄 계약', client: '라일라 만수르 · 마라케시 과일상', desc: '모든 모종의 당도가 3 낮아요. 환경 변화이므로 자손에게 남지 않아요.', minAnte: 1, concept: 'environment' },
  { id: 'judge', name: '열매 검사', client: '에밀 뒤랑 · 리옹 과일 경매장', desc: '수그루에는 열매가 없어요. 수그루 모종은 점수를 못 내요.', minAnte: 3, concept: 'dioecy' },
  { id: 'picky', name: '단색 포장 계약', client: '마테오 로시 · 피렌체 식품상회', desc: '과육색 한 가지가 이번 계약에서 제외돼요.', minAnte: 1 },
  { id: 'sommelier', name: '고당도 계약', client: '이사벨 리마 · 포르투 과일전문점', desc: '당도 13 이하 모종은 점수를 못 내요.', minAnte: 2, concept: 'polygenic' },
  { id: 'lmoCheck', name: '표시 기준 검사', client: '린 첸 · 싱가포르 품질검사소', desc: '형광(LMO) 모종은 점수를 못 내요.', minAnte: 7, concept: 'lmo' },
  { id: 'expo', name: '2150 국제 품종 박람회', client: '알리시아 바르가스 · 마드리드 박람회', desc: '목표 점수 ×3. 첫 출하가 한 빛깔 계열이 아니면 그 출하는 0점이에요.', minAnte: 8, concept: 'purebred' },
];

// ── 브랜드 철학(덱) ────────────────────────────────────────────
export const POLICIES: PolicyDef[] = [
  { id: 'heritage', name: '전통 육종팀', desc: '교배와 선발로만 품종을 키웁니다.', tradeoff: '출하 +1회. 유전자 편집과 형질전환은 사용할 수 없어요.' },
  { id: 'precision', name: '정밀 편집팀', desc: '유전자 가위로 필요한 자리를 바꿉니다.', tradeoff: '유전자 가위 1개로 시작합니다. 형질전환은 사용할 수 없어요.' },
  { id: 'biotech', name: '생명공학팀', desc: '형광 유전자를 도입해 새 형질을 만듭니다.', tradeoff: '주문 보상 +$1. 형광 포기는 LMO 검사와 꽃가루 유출 위험을 감수해야 해요.' },
];

// ── 개념 카드(연구 노트) ───────────────────────────────────────
export const CONCEPTS: Record<ConceptId, ConceptDef> = {
  segregation: {
    id: 'segregation',
    title: '다시 나타난 열성 형질',
    body: '부모에게는 없던 빛깔이 자손에게 나왔어요. 두 부모가 열성 대립유전자를 하나씩 지녔던 거예요.',
    fiction: '루미의 과육색(R/r)과 별무늬(S/s)는 가상의 형질이에요.',
    real: '생식세포가 만들어질 때 대립유전자 한 쌍은 갈라져 하나씩 들어가요. Rr끼리 교배하면 자손의 약 1/4은 rr이 되어 열성 형질을 드러내요. 멘델은 완두 교배에서 이 분리 규칙을 밝혔어요.',
    standard: '12유전01-01',
  },
  purebred: {
    id: 'purebred',
    title: '같은 빛깔, 다른 유전자형',
    body: '다섯 모종의 빛깔이 같아요. 하지만 이 출하만으로 유전자형까지 같다고 볼 수는 없어요.',
    real: "순계는 자가수분을 거듭해도 관심 형질이 같은 자손을 내는 계통이에요.\n\nRR과 rr을 교배한 1대는 모두 같은 우성 표현형이지만 Rr이에요. 이들을 자가수분하면 다음 대에 RR : Rr : rr이 1 : 2 : 1로 나뉘어요.",
    standard: '12유전01-01',
  },
  selfing: {
    id: 'selfing',
    title: '자가수분',
    body: '한 포기에서 나온 꽃가루로 그 포기를 수분했어요. 같은 계통을 거듭 자가수분하면 이형접합이 줄어요.',
    fiction: '루미는 한 꽃에 암술과 수술이 함께 있는 가상의 식물이에요.',
    real: '완두도 자가수분을 해요. Aa를 자가수분한 자손의 유전자형은 AA : Aa : aa = 1 : 2 : 1이에요. 그중 이형접합인 Aa는 절반이에요.',
    standard: '12유전01-01',
  },
  polygenic: {
    id: 'polygenic',
    title: '당도가 여러 값으로 퍼지는 이유',
    body: '같은 꼬투리에서 나온 모종인데 당도가 제각각이에요. 당도에 관여하는 유전자가 여러 개이기 때문이에요.',
    fiction: '게임에서는 유전자 6개(Q1~Q6)의 + 대립유전자 수를 더해 당도 8~20을 정해요.',
    real: "과일의 당도나 사람의 키처럼 여러 유전자와 환경이 함께 정하는 형질은 값이 연속적으로 퍼져요. 이를 다유전자유전이라고 해요.",
    standard: '12유전01-03',
  },
  environment: {
    id: 'environment',
    title: '비료가 바꾼 당도는 남지 않아요',
    body: '비료나 가뭄 때문에 달라진 당도는 이번 주문에만 적용돼요. 이 모종을 부모로 삼아도 그 변화가 자손에게 전해지지는 않아요.',
    fiction: '게임에서 비료는 당도 +2, 가뭄은 −3으로 계산해요.',
    real: '표현형은 유전자형과 환경이 함께 만들어요. 환경이 바꾼 당도만으로는 유전자가 바뀌었다고 볼 수 없어요. 품종을 고를 때는 같은 환경에서 길러 비교해요.',
    standard: '12유전01-03',
  },
  heterozygote: {
    id: 'heterozygote',
    title: '겉모습만으로는 알 수 없어요',
    body: "우성 형질을 보이는 모종에서 열성 대립유전자도 확인됐어요. 겉모습이 같아도 RR과 Rr은 달라요.",
    fiction: "검사 키트가 유전자형을 바로 보여 주고 이형접합에 점수 보너스를 주는 것은 게임 규칙이에요.",
    real: '우성 표현형만 보고 RR과 Rr을 구별할 수는 없어요. rr과 교배해 자손을 살펴보는 검정교배가 한 방법이에요. 실제 잡종강세에는 여러 유전자가 관여해요.',
    standard: '12유전01-01',
  },
  dioecy: {
    id: 'dioecy',
    title: '암수딴그루',
    body: '별다래는 암그루와 수그루를 함께 골라야 교배할 수 있어요. 열매는 암그루에만 열려요.',
    fiction: '별다래는 키위를 본뜬 가상의 작물이에요.',
    real: '키위도 암그루와 수그루가 따로 있어요. 열매를 얻으려면 암그루 가까이에 꽃가루를 내는 수그루를 심어야 해요. 키위의 성별은 XY 방식으로 결정돼요.',
    standard: '12유전01-01',
  },
  xlinked: {
    id: 'xlinked',
    title: '아비의 X는 딸에게',
    body: '은빛 잎 수그루의 딸이 모두 은빛 잎이에요. 아비의 X 염색체가 딸에게 전달됐기 때문이에요.',
    fiction: '별다래의 은빛 잎 유전자(L)는 가상의 형질이에요.',
    real: "XY 방식에서는 아버지의 X 염색체가 모든 딸에게, Y 염색체가 모든 아들에게 가요. 사람의 적록 색각 이상과 혈우병은 X 염색체에 있는 유전자와 관련이 있어요.",
    standard: '12유전01-01',
  },
  polyploid: {
    id: 'polyploid',
    title: '염색체가 두 배가 되면',
    body: '콜히친을 쓴 포기가 2배체(2n)에서 4배체(4n)로 바뀌었어요. 열매도 커졌어요.',
    fiction: '게임에서는 4배체 모종에 칩 10개를 더해요.',
    real: '콜히친은 세포 분열 때 염색체를 양쪽으로 끌어당기는 방추사의 형성을 막아요. 복제된 염색체가 한 세포에 남으면 염색체 수가 두 배가 될 수 있어요. 배수체 식물은 세포나 기관이 커지는 경우가 많아요.',
    standard: '12유전01-04',
  },
  triploid: {
    id: 'triploid',
    title: '3배체와 씨 없는 열매',
    body: '4배체와 2배체를 교배해 3배체(3n)가 나왔어요. 이 포기는 다시 교배할 수 없어요.',
    fiction: "게임은 3배체를 모두 씨 없는 불임 모종으로 단순화하고 출하 배수에 ×1.5를 적용해요. 실제 씨 없는 수박도 열매가 자라려면 수분용 2배체의 꽃가루가 필요해요.",
    real: "3배체는 감수분열 때 염색체가 고르게 나뉘기 어려워 정상적인 씨를 만들기 어려워요.\n\n기하라 히토시는 1940년대에 4배체와 2배체를 교배해 씨 없는 수박을 개발했어요. 우장춘 박사는 훗날 한국에 재배를 알렸지만 처음 만든 사람은 아니에요.",
    standard: '12유전01-04',
  },
  nondisjunction: {
    id: 'nondisjunction',
    title: '비분리와 이수성',
    body: '감수분열 중 염색체가 제대로 나뉘지 않았어요. 자손의 염색체 수가 하나 많거나 적어요.',
    fiction: '냉해가 비분리 확률을 높이고 이수성 모종의 당도를 3 낮추는 것은 게임 규칙이에요.',
    real: "감수분열에서 상동 염색체나 염색 분체가 나뉘지 않는 현상을 비분리라고 해요.\n\n그 생식세포가 수정되면 염색체가 2n+1개 또는 2n−1개인 이수성 개체가 생길 수 있어요. 다운 증후군은 21번 염색체가 3개인 사례예요.",
    standard: '12유전01-04',
  },
  transcription: {
    id: 'transcription',
    title: '전사와 번역',
    body: 'DNA의 염기 하나를 바꾸자 mRNA도 달라졌어요. 아미노산 배열이 달라졌는지 확인해 보세요.',
    fiction: '루미의 과육색·쓴맛 유전자는 게임을 위해 만든 짧은 서열이에요.',
    real: "DNA 정보는 mRNA로 전사돼요. mRNA는 염기 세 개씩 읽혀 아미노산을 지정하고 그 아미노산들이 이어져 단백질이 돼요. DNA를 바꿔도 단백질이 그대로일 때가 있으니 결과를 확인해야 해요.",
    standard: '12유전02-01',
  },
  stopCodon: {
    id: 'stopCodon',
    title: '종결 코돈',
    body: '바꾼 염기가 종결 코돈을 만들었어요. 단백질이 끝까지 만들어지지 않았어요.',
    real: 'mRNA의 UAA·UAG·UGA는 아미노산을 지정하지 않고 번역을 멈춰요. 유전자 중간에 종결 코돈이 생기면 단백질이 짧아져 기능을 잃을 수 있어요.',
    standard: '12유전02-02',
  },
  synonymous: {
    id: 'synonymous',
    title: '코돈의 중복성',
    body: 'DNA 염기는 바뀌었지만 지정하는 아미노산은 같아요. 단백질의 아미노산 배열도 그대로예요.',
    real: "코돈 64개가 아미노산 20종을 지정하므로 서로 다른 코돈이 같은 아미노산을 가리키기도 해요. 그래서 염기가 바뀌어도 아미노산 배열에는 변화가 없을 수 있어요.",
    standard: '12유전02-02',
  },
  frameshift: {
    id: 'frameshift',
    title: '틀 이동',
    body: '염기 하나를 지웠더니 그 뒤의 코돈 묶음이 모두 달라졌어요.',
    real: 'mRNA는 염기를 세 개씩 묶어 읽어요. 염기 하나가 빠지거나 끼어들면 뒤쪽의 읽기 틀이 밀려 아미노산 배열이 크게 바뀔 수 있어요.',
    standard: '12유전02-02',
  },
  dominanceMolecular: {
    id: 'dominanceMolecular',
    title: '한 사본이 남아 있다면',
    body: '유전자 한 사본을 망가뜨렸는데 겉모습은 그대로예요. 남은 사본이 아직 제 일을 하고 있어요.',
    real: '열성 대립유전자는 효소를 만들지 못하는 등 기능을 잃은 경우가 있어요. 다른 사본 하나만으로 효소가 충분히 만들어지면 겉으로는 우성 형질이 나타나요.',
    standard: '12유전02-01',
  },
  lmo: {
    id: 'lmo',
    title: '유전자 변형 생물체(LMO)',
    body: '다른 생물의 유전자를 넣은 포기가 형광을 내요. 유전자를 옮겨 새 형질을 얻었어요.',
    fiction: '형광 포기에 점수 보너스가 붙는 것은 게임 규칙이에요.',
    real: '해파리에서 발견된 녹색 형광 단백질(GFP)의 유전자는 생물학 연구에서 표지로 쓰여요. 외부 유전자를 도입한 생물은 이용 목적과 환경 영향을 살펴 관리해야 해요.',
    standard: '12유전03-04',
  },
  geneFlow: {
    id: 'geneFlow',
    title: '꽃가루를 따라 이동한 유전자',
    body: "형광 포기의 꽃가루로 수정한 뒤 자손에서 형광 유전자를 확인했어요. 수분받은 원래 포기의 유전자형은 그대로예요.",
    fiction: "꽃가루 이동 가능성과 조사에 걸리는 시간은 게임을 위해 단순화했어요. 이동 여부는 씨 하나의 관찰 기록으로 남겨요.",
    real: '꽃가루는 바람이나 곤충을 따라 이동해요. 그 꽃가루가 다른 식물과 수정하면 다음 세대에 유전자가 옮겨 갈 수 있어요. 그래서 LMO를 재배할 때는 주변 작물과 환경에 미칠 영향을 살펴야 해요.',
    standard: '12유전03-05',
  },
  clone: {
    id: 'clone',
    title: '조직 한 조각에서 새 포기로',
    body: '온실 포기의 조직을 배양해 같은 유전자형의 포기를 얻었어요.',
    fiction: '한 주문 만에 다 자라는 속도는 게임 설정이에요.',
    real: '식물은 분화한 조직 한 조각에서도 온전한 개체로 자랄 수 있어요. 이를 분화 전능성이라고 해요. 조직배양으로 얻은 포기는 원래 포기와 유전자형이 같은 클론이에요.',
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
  seed: { kind: 'seed', name: '시장 묘목 목록', desc: '구입 전에 품종 3포기를 살펴보고 1포기를 골라요. 유전자형은 검사로 확인해요.', price: 4, size: 3, picks: 1 },
  rareSeed: { kind: 'rareSeed', name: '연구 품종 목록', desc: '당도 높은 품종·순계·4배체·은빛 수그루 3포기를 미리 보고 1포기를 골라요.', price: 6, size: 3, picks: 1 },
  reagent: { kind: 'reagent', name: '시약 꾸러미', desc: '연구 시약 3개 중 1개.', price: 4, size: 3, picks: 1 },
  medal: { kind: 'medal', name: '품평회 메달함', desc: '족보 3개 중 하나의 레벨을 올려요.', price: 4, size: 3, picks: 1 },
  joker: { kind: 'joker', name: '비법 두루마리', desc: '장인의 비법 2개 중 1개.', price: 6, size: 2, picks: 1 },
};

// ── 주문 ───────────────────────────────────────────────────────
/** 앤티별 기본 목표(동네 장터). 고급 식당 ×1.5, 보스 ×2, 최종 박람회 ×3. scripts/sim.ts 로 조정한 값 */
export const ANTE_BASES: number[] = [300, 650, 1100, 1700, 2500, 3500, 4800, 6500];
export const ORDER_REWARD = { small: 3, big: 4, boss: 5 } as const;

/** 도시별 구매 담당자 (이름과 인물은 가상). 빛깔 요청은 주문 생성 시 붙인다. */
export const CLIENTS: string[] = [
  '파울라 슈미트 · 베를린 과일가게',
  '마테오 로시 · 피렌체 식품상회',
  '아미나 하다드 · 암만 식자재상',
  '클라라 뒤부아 · 리옹 식료품점',
  '토머스 리 · 밴쿠버 농산물조합',
  '소피아 알메이다 · 리스본 시장',
  '니콜라 코스타 · 포르투 과일가게',
  '하나 오카다 · 교토 농업연구소',
  '레일라 벤살렘 · 카사블랑카 호텔 구매팀',
  '이네스 페레스 · 발렌시아 유통센터',
];

/** 시장 품종 이름 앞에 붙는 산지 (가상) */
export const MARKET_ORIGINS: string[] = ['화성 개척지', '달 뒷면', '심해 돔', '북극 씨앗은행', '사막 온실', '안개 계곡', '구름 농장', '옛 서울 옥상'];
