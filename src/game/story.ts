// 이야기 자료 — 「씨앗 금고의 마지막 계통」 (docs/STORY-BIBLE.md, 2026-10-22 확정)
// 화면 코드와 분리한 순수 데이터와 순수 함수다. 윤문 단계에서는 이 파일의 문자열만 바꾸면 된다.
// 대사 한 줄 = 화면 한 쪽 = 한 문장. 인물·과수원·회사(모노그로브)는 모두 가상이다.
// 교배·점수·시즌 규칙은 여기서 정하지 않는다(게임 규칙은 game.ts·contracts.ts).
import type { RunMode } from '../contract/game';

export type SpeakerId =
  | 'lea' | 'elena' | 'note' | 'monogrove' | 'narration'
  | 'nicola' | 'nadia' | 'isabel' | 'lin' | 'alicia';

export interface Speaker {
  /** 화면에 표시할 이름. 빈 문자열이면 해설 */
  name: string;
  role: string;
  /** 초상 그림을 찾을 인물 이름 (src/art/characters.ts). 없으면 그림 없이 표시 */
  portrait?: string;
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  lea: { name: '레아 모레노', role: '오차드 매니저 · 할머니의 마지막 조수', portrait: '레아 모레노' },
  elena: { name: '엘레나 로시', role: '할머니 · 육종가', portrait: '엘레나 로시' },
  note: { name: '엘레나의 노트', role: '할머니의 손글씨', portrait: '엘레나 로시' },
  monogrove: { name: '모노그로브', role: '광고 · 편지' },
  narration: { name: '', role: '' },
  nicola: { name: '니콜라 코스타', role: '포르투 과일가게', portrait: '니콜라 코스타' },
  nadia: { name: '나디아 볼코바', role: '트롬쇠 종자은행', portrait: '나디아 볼코바' },
  isabel: { name: '이사벨 리마', role: '포르투 과일전문점', portrait: '이사벨 리마' },
  lin: { name: '린 첸', role: '싱가포르 품질검사소', portrait: '린 첸' },
  alicia: { name: '알리시아 바르가스', role: '마드리드 박람회', portrait: '알리시아 바르가스' },
};

export interface StoryLine {
  who: SpeakerId;
  text: string;
}

/** 장면 영상 다섯 편 (public/film/scene-*.mp4, 정지 그림 scene-*.webp) */
export type SceneId = 'vault' | 'vine' | 'frost' | 'offer' | 'expo';

export interface SceneDef {
  id: SceneId;
  /** public/film 안의 파일 이름 앞부분 */
  file: string;
  /** 화면 읽기 프로그램용 설명 */
  label: string;
  /** 영상 위에 HTML로 얹는 자막 1~3줄 (영상 안에는 글자를 넣지 않는다) */
  captions: string[];
  /** 자막 자리. 아래쪽에 중요한 물건이 있으면 위로 올린다 (기본 아래) */
  captionPlace?: 'top' | 'bottom';
}

export const SCENES: Record<SceneId, SceneDef> = {
  vault: {
    id: 'vault', file: 'scene-vault', label: '씨앗 금고의 첫 칸이 열리는 장면',
    captions: ['씨앗 금고 · 첫째 칸', '엘레나 로시 · 계통 R-07'],
  },
  vine: {
    id: 'vine', file: 'scene-vine', label: '뒤뜰 별다래 덩굴에 첫 열매가 맺힌 장면',
    captions: ['뒤뜰 별다래 덩굴', '붕괴 뒤 첫 열매'],
  },
  frost: {
    id: 'frost', file: 'scene-frost', label: '서리 내린 온실의 밤 장면',
    captions: ['서리 내린 온실의 밤', '트롬쇠 종자은행의 연락'],
  },
  offer: {
    id: 'offer', file: 'scene-offer', label: '돔 농장 광고판과 인수 제안서 장면', captionPlace: 'top',
    captions: ['모노그로브 · 인수 제안서', '씨앗 금고 일체를 사고 싶다는 편지'],
  },
  expo: {
    id: 'expo', file: 'scene-expo', label: '2150 국제 품종 박람회 무대와 금고의 마지막 칸 장면',
    captions: ['2150 국제 품종 박람회 · 마드리드', '서로 다른 열매들이 무대에 올랐어요.'],
  },
};

/** 금고 맨 아래 칸의 쪽지 (설계서 §4, 확정 문구) */
export const VAULT_NOTE = '여덟 번째 시즌, 박람회 무대에 서는 사람에게.';

export type BeatId = 'prologue' | `season-${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export interface StoryBeat {
  id: BeatId;
  /** 대화창 위 작은 머리글 */
  kicker: string;
  title: string;
  scene?: SceneId;
  lines: StoryLine[];
  /** 마지막 쪽의 단추 이름 (없으면 「다음 이야기」) */
  endLabel?: string;
}

export const PROLOGUE: StoryBeat = {
  id: 'prologue',
  kicker: '서막',
  title: '문 닫은 과수원',
  lines: [
    { who: 'narration', text: '2150년 발렌시아, 문을 닫은 과수원 오차드에는 불이 꺼져 있어요.' },
    { who: 'lea', text: '어서 와요, 할머니의 마지막 조수였던 레아 모레노예요.' },
    { who: 'lea', text: '엘레나 로시 할머니는 지난겨울 세상을 떠나셨어요.' },
    { who: 'lea', text: '남은 건 이 온실과 씨앗 금고, 그리고 노트 한 권이에요.' },
    { who: 'lea', text: '금고 맨 아래 칸은 잠겨 있고, 쪽지가 한 장 붙어 있어요.' },
    { who: 'note', text: VAULT_NOTE },
    { who: 'lea', text: '불을 켤게요, 오늘부터 이 과수원을 함께 다시 열어요.' },
  ],
  endLabel: '온실 불 켜기',
};

export const SEASON_BEATS: Record<number, StoryBeat> = {
  1: {
    id: 'season-1', kicker: '시즌 1', title: '금고가 열리던 날', scene: 'vault',
    lines: [
      { who: 'lea', text: '금고 첫 칸에서 할머니의 씨앗 봉투 두 개가 나왔어요.' },
      { who: 'note', text: '루비 RR, 골드 rr — 자가수분을 거듭해 고정한 순계.' },
      { who: 'lea', text: '이번 시즌 특별 손님은 취리히 품종등록소의 오스카 베르너 씨예요.' },
      { who: 'lea', text: '씨앗으로 키운 과일은 들쭉날쭉하다고 믿는 분이에요.' },
      { who: 'lea', text: '그 전에 동네 주문부터 차근차근 맡아 봐요.' },
    ],
    endLabel: '첫 주문 받기',
  },
  2: {
    id: 'season-2', kicker: '시즌 2', title: '두 형질은 따로 걷는다',
    lines: [
      { who: 'narration', text: '발렌시아 도로변에 모노그로브의 새 광고판이 섰어요.' },
      { who: 'monogrove', text: '모노그로브 당도 비료 — 뿌리는 날부터 당도 +2. 같은 것이 안전하다.' },
      { who: 'lea', text: '비료를 뿌리면 올해 열매는 달아지겠죠.' },
      { who: 'lea', text: '그런데 그 단맛이 씨앗까지 따라갈까요?' },
      { who: 'note', text: '두 형질은 따로 걷는다 — 빛깔과 무늬를 함께 볼 것.' },
      { who: 'lea', text: '이번 시즌에는 과육색과 껍질 무늬를 함께 챙겨야 해요.' },
    ],
  },
  3: {
    id: 'season-3', kicker: '시즌 3', title: '열매 없는 덩굴',
    lines: [
      { who: 'lea', text: '뒤뜰의 별다래 덩굴, 보셨어요?' },
      { who: 'lea', text: '붕괴 뒤로 한 번도 열매를 맺지 않았어요.' },
      { who: 'note', text: '왜 열리지 않을까?' },
      { who: 'lea', text: '마침 포르투의 니콜라 코스타 씨가 별다래 한 그루를 보내 줬어요.' },
      { who: 'nicola', text: '할머니께 받은 게 많아서요, 은빛 잎 수그루를 잘 키워 주세요.' },
      { who: 'lea', text: '이번 시즌 손님들은 별다래 암그루를 찾아요.' },
    ],
  },
  4: {
    id: 'season-4', kicker: '시즌 4', title: '열매 없는 덩굴', scene: 'vine',
    lines: [
      { who: 'lea', text: '덩굴에 드디어 첫 열매가 달렸어요!' },
      { who: 'lea', text: '이제 할머니 노트의 빈칸에 답을 적을 수 있겠어요.' },
      { who: 'note', text: '수그루가 없었다 — 꽃가루가 없으면 열매도 없다.' },
      { who: 'lea', text: '이번 시즌에도 별다래 암그루를 골라 납품해요.' },
    ],
  },
  5: {
    id: 'season-5', kicker: '시즌 5', title: '추운 해의 씨앗', scene: 'frost',
    lines: [
      { who: 'lea', text: '밤사이 서리가 내려 온실 유리가 하얗게 얼었어요.' },
      { who: 'lea', text: '트롬쇠 종자은행의 나디아 볼코바 씨가 연락해 왔어요.' },
      { who: 'nadia', text: '추위에 냉동고가 멈춰서 씨앗을 많이 잃었어요.' },
      { who: 'nadia', text: '추운 해에도 버틸 씨앗으로 은행을 다시 채우고 싶어요.' },
      { who: 'lea', text: '금고 다섯째 칸에서 할머니의 4배체 루미가 나왔어요.' },
      { who: 'note', text: '염색체 조가 넷 — 2배체와 맺으면 무엇이 될까?' },
    ],
  },
  6: {
    id: 'season-6', kicker: '시즌 6', title: '추운 해의 씨앗',
    lines: [
      { who: 'lea', text: '포르투의 이사벨 리마 씨가 고당도 계통을 보내 줬어요.' },
      { who: 'isabel', text: '비료 없이도 단 열매, 씨앗에 남는 단맛이 필요해요.' },
      { who: 'lea', text: '추위는 아직 끝나지 않았으니 염색체 수도 함께 확인해요.' },
    ],
  },
  7: {
    id: 'season-7', kicker: '시즌 7', title: '금고를 팔겠습니까', scene: 'offer',
    lines: [
      { who: 'narration', text: '흰 봉투가 도착했어요, 모노그로브의 인수 제안서예요.' },
      { who: 'monogrove', text: '오차드 씨앗 금고 일체를 매입하고자 합니다. 같은 것이 안전합니다.' },
      { who: 'lea', text: '모노그로브 돔의 나무는 모두 한 나무에서 떼어 기른 클론이에요.' },
      { who: 'lea', text: '제안 금액은 넉넉하지만, 서두르지 말아요.' },
      { who: 'lea', text: '할머니 노트의 마지막 쪽이 아직 비어 있거든요.' },
      { who: 'lin', text: '싱가포르 품질검사소의 린 첸이에요.' },
      { who: 'lin', text: '유전자를 고치는 기술은 빠르지만, 결과는 쓴 사람이 끝까지 책임져야 해요.' },
      { who: 'lin', text: '편집한 자리와 퍼져 나간 꽃가루까지 기록으로 남겨 주세요.' },
      { who: 'lea', text: '금고를 팔지 말지는 박람회가 끝난 뒤에 대답해도 늦지 않아요.' },
    ],
  },
  8: {
    id: 'season-8', kicker: '시즌 8', title: '박람회',
    lines: [
      { who: 'lea', text: '마드리드에서 초대장이 왔어요.' },
      { who: 'alicia', text: '2150 국제 품종 박람회에 오차드를 초대합니다.' },
      { who: 'lea', text: '금고 쪽지에 적힌 여덟 번째 시즌이 바로 지금이에요.' },
      { who: 'isabel', text: '고당도 계통을 한 번 더 보내요, 무대에서 만나요.' },
      { who: 'lea', text: '그동안 남긴 모종을 모아 달콤한 골드와 루비를 함께 무대에 올려요.' },
    ],
    endLabel: '박람회 준비하기',
  },
};

/** 8시즌보다 짧은 연대기에서 마지막 시즌의 특별 계약이 박람회일 때 덧붙이는 대사 */
export const EARLY_EXPO_LINES: StoryLine[] = [
  { who: 'lea', text: '마드리드 박람회에서 초대장이 왔어요, 이번 시즌의 마지막 무대예요.' },
  { who: 'lea', text: '할머니는 여덟 번째 시즌이라고 적었지만, 무대가 우리를 먼저 불렀어요.' },
];

/** 시즌 끝 확인 질문 앞에서 레아가 하는 말 (한 문장씩) */
export const SEASON_END_LINES: Record<number, string> = {
  1: '첫 시즌을 마쳤어요, 오스카 씨도 고른 열매에 고개를 끄덕였어요.',
  2: '광고 속 비료 이야기, 이제 답을 말할 수 있겠죠?',
  3: '덩굴 아래에 꽃이 피기 시작했어요.',
  4: '별다래 계약을 모두 마쳤어요.',
  5: '서리를 견딘 모종이 온실에 자리를 잡았어요.',
  6: '나디아 씨의 종자은행에 첫 씨앗 상자를 보냈어요.',
  7: '쓴맛 없는 열매가 가게에 올랐어요, 이제 박람회만 남았어요.',
  8: '박람회 무대가 끝났어요.',
};
export const QUIZ_INTRO_LINE = '다음으로 가기 전에, 할머니가 늘 묻던 질문을 드릴게요.';
export const FINAL_QUIZ_INTRO_LINE = '금고 서랍을 열기 전에, 마지막으로 확인해요.';

/**
 * 특별 계약 의뢰인의 편견이나 질문(계약 전)과, 계약 결과가 준 대답(계약 뒤).
 * 열쇠는 BossDef.id 다. 질문에 대한 정답을 미리 말하지 않는다.
 */
export const BOSS_STORY: Record<string, { question: string; answer: string }> = {
  uniformity: {
    question: '씨앗으로 키운 과일은 들쭉날쭉하던데요, 같은 빛깔이면 같은 계통 아닌가요?',
    answer: '빛깔이 고르다고 유전자형까지 같은 건 아니군요, 계통 기록도 함께 받아 둘게요.',
  },
  judge: {
    question: '덩굴이 이렇게 크면 열매도 많이 달리겠지요?',
    answer: '수그루에는 열매가 없군요, 암그루만 골라 온 까닭을 알겠어요.',
  },
  coldsnap: {
    question: '추위가 씨앗의 염색체 수까지 흔들 수 있을까요?',
    answer: '염색체가 제대로 나뉘지 않은 씨가 섞였군요, 정상 핵형을 골라 줘서 고마워요.',
  },
  sommelier: {
    question: '쓴맛은 한번 들면 대대로 남는 것 아닌가요?',
    answer: '기능하는 B가 없으면 쓴맛이 사라지는군요, 이 열매라면 가게에 올릴게요.',
  },
  expo: {
    question: '모노그로브는 똑같은 열매가 안전하다고 하던데, 오차드의 생각은 어떤가요?',
    answer: '서로 다른 자손에서 고른 열매로 무대를 채웠군요, 이것이 오차드의 대답이네요.',
  },
  nobees: {
    question: '벌이 없으면 열매도 끝 아닌가요?',
    answer: '한 개체의 꽃가루로도 씨를 맺을 수 있군요.',
  },
  drought: {
    question: '가뭄에 덜 단 열매는 씨앗도 덜 달까요?',
    answer: '가뭄 탓에 줄어든 당도는 씨앗에 남지 않는군요.',
  },
  picky: {
    question: '두 빛깔을 섞어 포장하면 손님이 헷갈려해요.',
    answer: '한 가지 빛깔로 맞춰 주셔서 포장이 깔끔해요.',
  },
  lmoCheck: {
    question: '형광 열매가 섞이면 표시 없이 팔 수 없어요, 구별할 수 있나요?',
    answer: '형광 모종을 빼고 납품해 줘서 기록이 깔끔해요.',
  },
};

export const ENDING = {
  kicker: '결말',
  drawerTitle: '금고의 마지막 칸',
  openLetter: '편지 펼치기',
  closingTitle: '노트의 마지막 쪽',
  toResults: '기록 보기',
  /** 박람회 장면 뒤 금고 대사 */
  drawer: [
    { who: 'lea', text: '박람회가 끝났어요, 이제 금고 맨 아래 칸을 열어 볼까요?' },
    { who: 'narration', text: '잠겨 있던 서랍 안에는 붕괴 전의 야생 루미 씨앗과 편지 한 통이 들어 있어요.' },
  ] as StoryLine[],
  letterTitle: '엘레나의 편지',
  /** 편지는 한 장에 모두 보여 준다. 따뜻하되 지나치게 달지 않게. */
  letter: [
    '이 서랍을 열었다면, 박람회 무대에 섰다는 뜻이겠지요.',
    '여기 붕괴 전에 받아 둔 야생 루미 씨앗을 남겨요. 우리 금고에서 가장 오래된 계통이에요.',
    '무대 위 열매들이 서로 조금씩 달랐다면, 그건 실수가 아니에요.',
    '그 다름이 언젠가 추위와 병을 견뎌 낼 거예요.',
    '노트의 마지막 쪽은 일부러 비워 두었어요. 이제 새 주인의 글씨로 채워 주세요.',
  ],
  signature: '— 엘레나',
  /** 7시즌(인수 제안)을 지난 연대기에서만 */
  offerReply: { who: 'lea', text: '모노그로브에는 답장을 보냈어요, 금고는 팔지 않는다고요.' } as StoryLine,
  closing: { who: 'lea', text: '노트의 마지막 쪽은 오늘 기록을 보며 함께 채워 봐요.' } as StoryLine,
  replayLabel: '엘레나의 편지 다시 읽기',
} as const;

/** 도전 모드(실패 시 종료)에서 실패했을 때의 짧은 결말 (설계서 §5 확정 문구) */
export const CHALLENGE_FAILURE = {
  line: '오차드의 문은 다시 닫히지만 금고의 씨앗은 남는다.',
  sub: '새 연대기에서 금고를 다시 열 수 있어요.',
  action: '기록 보기',
} as const;

// ─────────────────────────────────────── 어떤 장면을 언제 보여 줄까

const START_ANTE: Record<RunMode, number> = { full: 1, quick: 1, 'unit-sex': 3, 'unit-chromo': 5, 'unit-edit': 7 };
const MAX_ANTE: Record<RunMode, number> = { full: 8, quick: 4, 'unit-sex': 4, 'unit-chromo': 6, 'unit-edit': 8 };

/** 이 연대기에 실제로 있는 시즌 번호 */
export function seasonsOf(mode: RunMode): number[] {
  const out: number[] = [];
  for (let a = START_ANTE[mode]; a <= MAX_ANTE[mode]; a++) out.push(a);
  return out;
}

export interface BeatQuery {
  mode: RunMode;
  ante: number;
  maxAnte: number;
  orderIdx: number;
  phase: string;
  /** 이 연대기에서 계약 기록이 남은 시즌 */
  recordAntes: number[];
  /** 이 연대기에서 이미 본 장면 */
  seen: readonly string[];
}

/**
 * 교배 준비 화면에 들어설 때 의뢰인보다 먼저 보여 줄 장면.
 * 서막은 연대기의 첫 계약, 시즌 장면은 그 시즌 첫 계약을 아직 시작하지 않았을 때만 연다.
 * 단원·짧은 연대기는 자기 시즌의 장면만 받는다.
 */
export function pendingBeats(q: BeatQuery): BeatId[] {
  if (q.phase !== 'cross' || q.orderIdx !== 0) return [];
  if (q.recordAntes.includes(q.ante)) return [];
  const out: BeatId[] = [];
  const start = START_ANTE[q.mode];
  if (q.ante === start && q.recordAntes.length === 0 && !q.seen.includes('prologue')) out.push('prologue');
  const id = `season-${q.ante}` as BeatId;
  if (SEASON_BEATS[q.ante] && !q.seen.includes(id)) out.push(id);
  return out;
}

/** 장면 하나의 대사. 짧은 연대기의 마지막 시즌에는 박람회 초대를 덧붙인다. */
export function beatFor(id: BeatId, maxAnte: number): StoryBeat {
  if (id === 'prologue') return PROLOGUE;
  const ante = Number(id.slice('season-'.length));
  const beat = SEASON_BEATS[ante];
  if (ante === maxAnte && maxAnte !== 8) return { ...beat, lines: [...beat.lines, ...EARLY_EXPO_LINES], endLabel: '박람회 준비하기' };
  return beat;
}

/** 결말에서 인수 제안 답장을 보여 줄지 (7시즌을 지난 연대기만) */
export function sawOffer(mode: RunMode): boolean {
  return START_ANTE[mode] <= 7 && MAX_ANTE[mode] >= 7;
}
