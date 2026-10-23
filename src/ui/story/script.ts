// 화면 문구 자료 — 소개 영상의 HUD 신호표, 제목 화면, 레아의 튜토리얼 대사, 처음 나타나는 조작부 안내, 공통 단추 이름.
// 순수 데이터다. 윤문 단계에서는 이 파일과 src/game/story.ts · quiz.ts · elenaNotes.ts 의 문자열만 바꾼다.

// ─────────────────────────────────────── 소개 영상 (public/film/intro.mp4, 약 30초 · 5구간)

/** 신호표가 가정하는 영상 길이(초). 실제 영상 길이가 다르면 비율로 늘이거나 줄인다. */
export const INTRO_LENGTH = 30;
/** 장면 전환 간격(초). 실제 영상은 6초 구간마다 2초짜리 컷 세 개로 끊긴다(128 BPM). */
export const INTRO_BEAT = 2;

export type CueKind = 'stamp' | 'tag' | 'counter' | 'receipt' | 'slogan' | 'line' | 'logo';
export type CueLane = 'top' | 'top-right' | 'left' | 'right' | 'center' | 'lower' | 'bottom';

export interface IntroCue {
  id: string;
  /** 시작·끝 시각(초, INTRO_LENGTH 기준) */
  at: number;
  until: number;
  kind: CueKind;
  lane: CueLane;
  text: string;
  /** 꼬리표·영수증의 작은 둘째 줄 */
  sub?: string;
  /** counter: from → to 로 굴러간다 */
  from?: number;
  to?: number;
  /** 바코드 무늬를 붙일지 (장식, 글자 아님) */
  barcode?: boolean;
}

/**
 * 실제 영상(public/film/intro.mp4)의 컷에 맞춘 시간표. 얼굴과 금고 서랍을 가리지 않는 자리에 둔다.
 * 1 (0–6초)  2120 · 회색으로 말라 가는 클론 과수원 (2초 무렵 연기 같은 병해)
 * 2 (6–12초) 2150 · 돔 농장, 빈 광고판, 자기부상 열차
 * 3 (12–18초) 발렌시아 · 레아가 밤의 온실 문을 열고 불이 켜짐 (레아는 화면 왼쪽·가운데 → 꼬리표는 오른쪽)
 * 4 (18–24초) 금고 서랍이 화면 대부분을 차지 → 위쪽 띠에만 도장·꼬리표
 * 5 (24–30초) 24초 음악 강세에 카운터, 꽃 아래쪽에 끝 문장, 29.3초부터 어두워짐 → 그 전에 로고
 */
export const INTRO_CUES: IntroCue[] = [
  { id: 'year-2120', at: 0.3, until: 5.9, kind: 'stamp', lane: 'top', text: '2120 · 클론 붕괴' },
  { id: 'tag-clone', at: 2.0, until: 5.9, kind: 'tag', lane: 'left', text: '품종 1 · 클론', sub: '모든 과수원 · 같은 유전자형', barcode: true },
  { id: 'receipt-same', at: 4.0, until: 5.9, kind: 'receipt', lane: 'right', text: '유전자형 일치', sub: '100%' },
  { id: 'year-2150-dome', at: 6.1, until: 11.9, kind: 'stamp', lane: 'top', text: '2150 · 모노그로브 돔' },
  { id: 'slogan', at: 6.6, until: 11.7, kind: 'slogan', lane: 'center', text: '같은 것이 안전하다.' },
  { id: 'tag-dome', at: 8.0, until: 11.9, kind: 'tag', lane: 'left', text: '모노그로브 · 클론 공급', sub: '돔 농장 · 신품종 0', barcode: true },
  { id: 'year-valencia', at: 12.1, until: 17.9, kind: 'stamp', lane: 'top', text: '2150 · 발렌시아' },
  { id: 'tag-closed', at: 12.4, until: 14.0, kind: 'tag', lane: 'right', text: '오차드 · 문 닫음', sub: '마지막 수확 2149' },
  { id: 'tag-lights', at: 14.0, until: 17.9, kind: 'tag', lane: 'right', text: '오차드 · 불 켜짐', sub: '온실 1동 · 금고 1기' },
  { id: 'vault-drawer', at: 18.1, until: 23.9, kind: 'stamp', lane: 'top', text: '씨앗 금고 · 서랍 1 / 8' },
  { id: 'tag-r07', at: 18.6, until: 23.9, kind: 'tag', lane: 'top-right', text: '엘레나 로시 · 계통 R-07', sub: '루비 · 순계 · 자가수분 7대', barcode: true },
  { id: 'season', at: 24.0, until: 30, kind: 'stamp', lane: 'top', text: '시즌 01 / 08' },
  { id: 'offspring', at: 24.0, until: 26.0, kind: 'counter', lane: 'bottom', text: '자손', from: 0, to: 52 },
  { id: 'receipt-contract', at: 24.3, until: 26.0, kind: 'receipt', lane: 'right', text: '계약서 01', sub: '루비 과육 3개체 · 300점' },
  { id: 'final-line', at: 26.0, until: 30, kind: 'line', lane: 'lower', text: '씨앗 하나에, 쉰두 가지 미래.' },
  { id: 'logo', at: 27.9, until: 30, kind: 'logo', lane: 'bottom', text: 'ORCHARD 2150' },
];

/** 동작 줄이기·영상 없음일 때 포스터 위에 고정해서 보여 줄 신호 */
export const INTRO_STATIC_CUES = ['season', 'tag-r07', 'final-line', 'logo'] as const;

export const FILM_UI = {
  introLabel: '소개 영상',
  introSummary: '2120년 클론 붕괴부터 2150년 발렌시아의 오차드까지, 이야기의 시작을 보여 주는 30초 영상이에요.',
  skip: '건너뛰기',
  soundOn: '소리 켜기',
  soundOff: '소리 끄기',
  continue: '계속',
  play: '영상 재생',
  sceneLabel: '장면 영상',
} as const;

// ─────────────────────────────────────── 제목 화면과 새 연대기 준비

export const TITLE_COPY = {
  tag: [
    '2120년, 같은 클론만 심은 과수원들이 한꺼번에 무너졌어요.',
    '할머니 엘레나의 씨앗 금고를 열어 다양한 열매를 되살리고, 2150 국제 품종 박람회 무대에 서세요.',
  ],
  startTitle: '과수원 다시 열기',
  startBody: '부모를 고르고 자손을 키워, 점수와 납품 조건을 함께 채우세요.',
  practiceHint: '레아와 함께 첫 계약을 실제로 해 봐요. 끝나면 이어서 플레이하거나 새로 시작할 수 있어요.',
  replayIntro: '소개 영상 다시 보기',
  notes: '엘레나의 노트',
  foot: ['기록은 이 브라우저에만 저장돼요.', '루미와 별다래, 등장인물, 모노그로브는 가상이에요.'],
  nameTitle: '할머니의 과수원을 뭐라고 부를까요?',
  nameHint: ['이름은 여러 연대기를 구별할 때 쓰여요. 비워 두면 「오차드」라고 불러요.', '별명이나 과수원 이름을 써 주세요. 실명과 학번은 쓰지 마세요.'],
  namePlaceholder: '예: 달빛 과수원',
} as const;

// ─────────────────────────────────────── 레아의 튜토리얼 (한 번에 한 문장)

export type CoachTarget =
  | 'goal' | 'limits' | 'home' | 'jokers' | 'reagents' | 'shop-cards'
  | 'parent-first' | 'parent-second' | 'prediction' | 'cross' | 'observation'
  | 'pod' | 'sort' | 'discard' | 'hand' | 'shipment' | 'cashout' | 'selection' | 'shop' | 'review' | 'none';

export interface CoachLine {
  text: string;
  /** 이 문장을 말할 때 빛나는 곳 (없으면 단계의 조작 위치) */
  target?: CoachTarget;
}

export interface CoachStepScript {
  /** 단계 막대 옆에 붙는 짧은 이름 */
  label: string;
  /** 실제 조작이 일어나야 하는 곳 */
  target: CoachTarget;
  lines: CoachLine[];
}

export const TUTORIAL_SCRIPT = {
  'parent-first': {
    label: '첫 부모 고르기', target: 'parent-first',
    lines: [
      { text: '첫 주문은 루비 과육 3개체와 300점을 함께 채우는 일이에요.', target: 'goal' },
      { text: '과육색 유전자형이 RR인 할머니의 루비 별을 눌러 주세요.' },
    ],
  },
  'parent-second': {
    label: '두 번째 부모', target: 'parent-second',
    lines: [{ text: '이번에는 유전자형이 rr인 할머니의 골드를 눌러 주세요.' }],
  },
  predict: {
    label: '예측', target: 'prediction',
    lines: [
      { text: '자손은 두 부모에게서 과육색 대립유전자를 하나씩 받아요.' },
      { text: 'R은 r에 대해 우성이라, R이 하나라도 있으면 루비 과육이 돼요.' },
      { text: '자손 52개체에 어느 과육색이 더 많을지 골라 주세요.' },
    ],
  },
  cross: {
    label: '교배', target: 'cross',
    lines: [{ text: '교배하기를 눌러 예측이 맞는지 확인해요.' }],
  },
  observe: {
    label: '관찰', target: 'pod',
    lines: [
      { text: '예측과 실제 자손 52개체의 과육색을 비교해 보세요.', target: 'observation' },
      { text: '자손 덱을 눌러 아직 받지 않은 씨앗의 분포도 살펴봐요.' },
    ],
  },
  sort: {
    label: '정렬', target: 'sort',
    lines: [
      { text: '정렬은 출하 횟수를 쓰지 않고 카드 순서만 바꿔요.' },
      { text: '당도나 빛깔 단추를 눌러 손패를 정리해 보세요.' },
    ],
  },
  'select-cards': {
    label: '모종 고르기', target: 'hand',
    lines: [
      { text: '필요 없는 모종은 솎아내기로 바꿀 수 있지만, 이번 손패는 그대로 써요.', target: 'discard' },
      { text: '빛나는 모종 카드를 한 장씩 눌러 다섯 장을 골라 주세요.' },
    ],
  },
  ship: {
    label: '출하', target: 'shipment',
    lines: [
      { text: '출하는 계약마다 정해진 횟수만 할 수 있어요.', target: 'limits' },
      { text: '출하를 눌러 점수와 납품 수를 확인해요.' },
    ],
  },
  collect: {
    label: '보상', target: 'cashout',
    lines: [
      { text: '점수와 루비 납품을 모두 채웠어요!' },
      { text: '보상 받기를 눌러 주세요.' },
    ],
  },
  keep: {
    label: '선발', target: 'selection',
    lines: [{ text: '다음 교배에 쓸 모종을 하나 골라 온실에 들여요.' }],
  },
  shop: {
    label: '상점', target: 'shop',
    lines: [
      { text: '여기는 번 돈으로 도구를 사는 상점이에요.', target: 'shop-cards' },
      { text: '위쪽에 나타난 비법은 출하할 때 왼쪽부터 점수를 보태요.', target: 'jokers' },
      { text: '그 옆 시약 칸은 필요할 때 직접 쓰는 일회용 도구 자리예요.', target: 'reagents' },
      { text: '오늘은 돈을 아껴 두고 다음 주문을 눌러 볼게요.' },
    ],
  },
  retry: {
    label: '다시 준비', target: 'review',
    lines: [
      { text: '점수와 납품 형질 중 무엇이 모자랐는지 확인해요.' },
      { text: '이 계약 다시 준비를 눌러 다른 조합으로 해 봐요.' },
    ],
  },
  complete: {
    label: '마무리', target: 'none',
    lines: [
      { text: '교배하고, 납품하고, 좋은 모종을 남기는 흐름을 모두 해 봤어요.' },
      { text: '진행은 저장되니 쉬고 싶을 때는 홈을 누르세요.', target: 'home' },
      { text: '이제 이 과수원을 이어 가거나 새로 시작해요.' },
    ],
  },
} as const satisfies Record<string, CoachStepScript>;

export const COACH_UI = {
  name: '레아 모레노',
  next: '계속',
  doIt: '빛나는 곳을 직접 눌러 보세요.',
  tap: '여기를 눌러 주세요',
  stop: '튜토리얼 나가기',
  keepTitle: '온실에 들이기를 눌러 주세요.',
  continueHere: '이 과수원에서 계속하기',
  startFresh: '새 과수원 시작',
  stopTitle: '튜토리얼 안내를 끝낼까요?',
  stopBody: '지금까지의 교배, 보상, 모종은 이 과수원에 남아요. 홈의 「튜토리얼」에서 언제든 다시 시작할 수 있어요.',
  stopKeep: '안내 계속 보기',
  stopEnd: '안내만 끝내기',
  done: '튜토리얼을 마쳤어요. 다음 계약은 자유롭게 진행하세요.',
  progress: '튜토리얼 진행',
} as const;

// ─────────────────────────────────────── 처음 필요할 때 나타나는 조작부

export const REVEAL_LINES = {
  notes: '레아 · 발견한 원리는 엘레나의 노트에 모여요. 메뉴의 「엘레나의 노트」에서 언제든 다시 펼쳐 보세요.',
  jokers: '레아 · 위쪽에 비법 줄이 열렸어요. 비법은 출하할 때 왼쪽부터 점수를 보태요.',
  reagents: '레아 · 시약 칸이 열렸어요. 시약은 필요할 때 눌러 쓰는 일회용 도구예요.',
} as const;

// ─────────────────────────────────────── 이야기 대화창·확인 질문·결말 공통 단추

export const DIALOGUE_UI = {
  next: '계속',
  last: '다음 이야기',
  skip: '건너뛰기',
  log: '대화 기록',
  logClose: '기록 닫기',
  logTitle: '지금까지의 대화',
  narration: '해설',
} as const;

export const QUIZ_UI = {
  kicker: '레아 모레노 · 시즌 끝 확인 질문',
  title: (season: number) => `시즌 ${season} 확인 질문`,
  count: (i: number, n: number) => `문제 ${i} / ${n}`,
  check: '답 확인',
  right: '맞아요.',
  wrong: '다시 생각해 봐요.',
  retry: '다시 고르기',
  next: '다음 문제',
  pass: '다음 시즌 열기',
  passFinal: '금고 서랍 열기',
  note: '엘레나의 노트 펼치기',
  later: '나중에 풀기',
  rule: '모두 맞히면 다음으로 넘어가요. 몇 번이든 다시 풀 수 있고, 실패로 세지 않아요.',
  tried: '이미 고른 답',
} as const;

export const NOTES_UI = {
  title: '엘레나의 노트',
  kicker: '할머니가 남긴 빈칸, 오차드가 채운 기록',
  discovered: '빈칸이 채워졌어요',
  pin: '노트에 끼워 두기',
  checkAnswer: '답 확인',
  checkRight: '맞아요.',
  checkWrong: '다시 골라 보세요.',
  fromQuiz: '레아가 펼쳐 준 쪽',
} as const;
