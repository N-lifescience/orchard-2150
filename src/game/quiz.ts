// 시즌 끝 확인 질문 — 레아가 묻고, 모두 맞혀야 다음 시즌(마지막 시즌이면 결말)이 열린다.
// 횟수 제한이 없고 실패로 치지 않는다(수업·도전 모드 공통). 그 시즌에 실제로 겪은 현상만 묻는다.
// 문항·해설은 순수 데이터다. 틀렸을 때의 힌트는 정답을 그대로 말하지 않는다.
import type { ConceptId, PolicyId, Phase } from '../contract/game';

export interface QuizQuestion {
  id: string;
  season: number;
  prompt: string;
  choices: string[];
  /** choices 의 정답 위치 */
  answer: number;
  /** 틀렸을 때: 원리를 다시 짚되 정답 선택지를 말하지 않는다 */
  hint: string;
  /** 맞혔을 때의 풀이 */
  explain: string;
  /** 함께 읽을 엘레나의 노트 */
  note: ConceptId;
  /** 이 운영 팀만 겪는 현상이면 지정 (없으면 모두) */
  policies?: PolicyId[];
}

export const SEASON_QUIZ: Record<number, QuizQuestion[]> = {
  1: [
    {
      id: 's1-cross', season: 1,
      prompt: 'RR × rr 자손 52개체의 과육색 유전자형으로 옳은 것을 고르세요.',
      choices: ['RR : Rr : rr = 1 : 2 : 1', '모두 Rr', 'RR과 rr이 절반씩'],
      answer: 1,
      hint: '두 부모가 각각 자손에게 줄 수 있는 대립유전자가 몇 종류인지 먼저 세어 보세요.',
      explain: 'RR 부모는 R만, rr 부모는 r만 전달해요. 그래서 자손은 모두 Rr이에요.',
      note: 'purebred',
    },
    {
      id: 's1-gold', season: 1,
      prompt: '골드(열성) 과육 모종의 유전자형을 고르세요.',
      choices: ['RR 또는 Rr', 'Rr만 가능', 'rr만 가능'],
      answer: 2,
      hint: '열성 형질이 겉으로 나타나려면 R이 몇 개 있어야 하는지 생각해 보세요.',
      explain: 'R이 하나라도 있으면 루비 과육이 돼요. 골드 과육은 r만 두 개 가진 rr이에요.',
      note: 'segregation',
    },
    {
      id: 's1-uniform', season: 1,
      prompt: '빛깔이 같은 다섯 모종을 출하했어요. 확실히 말할 수 있는 것을 고르세요.',
      choices: ['다섯 개체의 표현형이 같다', '다섯 개체의 유전자형이 모두 같다', '다섯 개체가 모두 순계다'],
      answer: 0,
      hint: '겉으로 보이는 것과 겉으로 보이지 않는 것을 나누어 생각해 보세요.',
      explain: '빛깔은 표현형이에요. RR과 Rr은 같은 루비 과육이라 출하만으로 유전자형을 알 수 없어요.',
      note: 'purebred',
    },
  ],
  2: [
    {
      id: 's2-fertilizer', season: 2,
      prompt: '비료로 당도가 2 오른 모종의 자손 당도를 바르게 설명한 것을 고르세요.',
      choices: ['비료 효과가 그대로 전해져 자손도 2 높다', '자손이 물려받은 유전자형에 따라 정해지고, 비료 효과는 전해지지 않는다', '자손은 부모보다 반드시 달다'],
      answer: 1,
      hint: '비료가 바꾼 것이 유전자형인지, 그 개체의 표현형인지 구분해 보세요.',
      explain: '비료는 그 모종의 표현형만 바꿔요. 자손에게는 유전자형이 전해지므로 비료 효과는 남지 않아요.',
      note: 'environment',
    },
    {
      id: 's2-brix', season: 2,
      prompt: '같은 교배 자손의 당도가 8~20으로 퍼진 까닭을 고르세요.',
      choices: ['당도에 관여하는 유전자가 여러 개이기 때문에', '당도가 한 쌍의 대립유전자로만 정해지기 때문에', '당도는 유전과 관계없기 때문에'],
      answer: 0,
      hint: '값이 두세 가지로 뚝뚝 끊기지 않고 고르게 퍼진 점에 주목하세요.',
      explain: '여러 유전자의 효과가 조금씩 더해지면 형질 값이 연속적으로 퍼져요. 이것이 다유전자유전이에요.',
      note: 'polygenic',
    },
    {
      id: 's2-two-traits', season: 2,
      prompt: 'R과 S는 서로 다른 염색체에 있어요. RrSs를 자가수분할 때 자손이 rrss일 확률을 고르세요.',
      choices: ['1/4', '1/16', '9/16'],
      answer: 1,
      hint: '두 형질을 따로 계산한 다음, 두 사건이 함께 일어날 확률을 구해 보세요.',
      explain: 'rr이 될 확률 1/4과 ss가 될 확률 1/4을 곱하면 1/16이에요. 두 유전자가 독립적으로 전달되기 때문이에요.',
      note: 'segregation',
    },
  ],
  3: [
    {
      id: 's3-vine', season: 3,
      prompt: '붕괴 뒤 별다래가 열매를 맺지 못한 까닭을 고르세요.',
      choices: ['덩굴이 너무 오래되어서', '꽃가루를 줄 수그루가 없어서', '은빛 잎 유전자가 열매를 막아서'],
      answer: 1,
      hint: '이번 시즌에 별다래를 교배할 때 부모로 무엇이 꼭 필요했는지 떠올려 보세요.',
      explain: '별다래는 암수딴그루예요. 열매는 암그루에 열리고, 수분하려면 수그루의 꽃가루가 필요해요.',
      note: 'dioecy',
    },
    {
      id: 's3-xlinked', season: 3,
      prompt: 'X 염색체에 있는 은빛 잎 대립유전자 L은 우성이에요. 은빛 잎 수그루와 초록 잎 암그루의 딸 잎 색을 고르세요.',
      choices: ['모두 은빛 잎', '모두 초록 잎', '절반은 은빛 잎, 절반은 초록 잎'],
      answer: 0,
      hint: '딸이 아비에게서 받는 성염색체가 X인지 Y인지 먼저 정해 보세요.',
      explain: '딸은 아비의 X 염색체를 반드시 받아요. 아비의 X에 우성 L이 있으니 딸은 모두 은빛 잎이에요.',
      note: 'xlinked',
    },
    {
      id: 's3-male', season: 3,
      prompt: '수그루 모종이 납품 수에 안 들어간 까닭을 고르세요.',
      choices: ['수그루는 당도가 낮아서', '수그루에는 성염색체가 없어서', '수그루에는 열매가 열리지 않아서'],
      answer: 2,
      hint: '열매 검사에서 점수를 내지 못한 모종이 무엇을 갖고 있지 않았는지 생각해 보세요.',
      explain: '암수딴그루에서 수그루는 꽃가루를 내고, 열매는 암그루에 열려요.',
      note: 'dioecy',
    },
  ],
  4: [
    {
      id: 's4-son', season: 4,
      prompt: '수그루(XY)에게 X 염색체를 준 부모를 고르세요.',
      choices: ['아비(수그루)', '어미(암그루)', '두 부모에게서 하나씩'],
      answer: 1,
      hint: '수그루 자손은 아비에게서 X와 Y 중 무엇을 받아야 수그루가 되는지 생각해 보세요.',
      explain: '아들은 아비에게서 Y를 받아요. 그래서 하나뿐인 X는 어미에게서 와요.',
      note: 'xlinked',
    },
    {
      id: 's4-green', season: 4,
      prompt: '초록 잎(열성) 딸을 얻으려면 아비 수그루의 잎이 어떤 색이어야 하는지 고르세요.',
      choices: ['은빛 잎 수그루', '초록 잎 수그루', '잎 빛깔과 관계없다'],
      answer: 1,
      hint: '딸은 아비의 X를 반드시 받아요. 열성 형질이 나타나려면 두 X에 무엇이 있어야 할까요?',
      explain: '초록 잎 딸은 두 X 모두 초록 잎 대립유전자를 가져야 해요. 그러려면 아비의 X도 초록 잎이어야 해요.',
      note: 'xlinked',
    },
  ],
  5: [
    {
      id: 's5-triploid', season: 5,
      prompt: '4n × 2n 자손의 염색체 조 수를 고르세요.',
      choices: ['3n', '4n', '6n'],
      answer: 0,
      hint: '두 부모가 만드는 생식세포의 염색체 조 수를 먼저 구해 보세요.',
      explain: '4배체의 생식세포는 2n, 2배체의 생식세포는 n이에요. 둘이 수정하면 3n이에요.',
      note: 'triploid',
    },
    {
      id: 's5-sterile', season: 5,
      prompt: '씨 없는 3배체를 부모로 못 쓰는 까닭을 고르세요.',
      choices: ['3배체는 열매가 맺히지 않아서', '감수분열 때 상동염색체가 고르게 짝짓고 나뉘기 어려워서', '3배체는 염색체가 없어서'],
      answer: 1,
      hint: '염색체 세 벌이 감수분열에서 둘로 나뉘는 장면을 떠올려 보세요.',
      explain: '염색체가 세 벌이면 감수분열 때 고르게 나뉘기 힘들어 정상 생식세포와 씨를 만들기 어려워요.',
      note: 'triploid',
    },
    {
      id: 's5-cold', season: 5,
      prompt: '냉해 뒤 염색체가 2n+1인 자손이 나왔어요. 감수분열에서 일어난 일을 고르세요.',
      choices: ['염색체가 제대로 나뉘지 않는 비분리', '염색체 조 전체가 두 배로 늘어남', 'DNA 염기 하나가 바뀜'],
      answer: 0,
      hint: '염색체 조 전체가 늘었는지, 염색체 한 개만 늘었는지 구분해 보세요.',
      explain: '비분리로 생긴 n+1 생식세포가 정상 생식세포와 수정하면 2n+1이 돼요.',
      note: 'nondisjunction',
    },
  ],
  6: [
    {
      id: 's6-aneuploid', season: 6,
      prompt: '2n+1, 2n−1처럼 염색체 수가 몇 개만 달라진 상태의 이름을 고르세요.',
      choices: ['배수성', '이수성', '이형접합'],
      answer: 1,
      hint: '염색체 조 전체가 달라진 경우와 몇 개만 달라진 경우는 이름이 달라요.',
      explain: '염색체 몇 개가 많거나 적은 것은 이수성, 조 전체가 늘어난 것은 배수성이에요.',
      note: 'nondisjunction',
    },
    {
      id: 's6-base-brix', season: 6,
      prompt: '기본 당도 16 이상 계약이에요. 원래 14에서 비료로 16이 된 모종이 납품 수에 들어가는지 고르세요.',
      choices: ['들어간다', '들어가지 않는다', '출하 순서에 따라 다르다'],
      answer: 1,
      hint: '계약이 세는 것이 이번 열매의 당도인지, 씨앗에 남는 당도인지 생각해 보세요.',
      explain: '납품 조건은 비료 효과를 뺀 기본 당도로 세요. 비료로 오른 2는 자손에게 남지 않아요.',
      note: 'environment',
    },
    {
      id: 's6-select', season: 6,
      prompt: '다음 시즌에도 기본 당도가 높은 자손을 얻을 방법을 고르세요.',
      choices: ['비료를 듬뿍 준 모종을 부모로 남긴다', '기본 당도가 높은 자손을 골라 부모로 남긴다', '아무 모종이나 남겨도 결과는 같다'],
      answer: 1,
      hint: '자손에게 무엇이 전해지는지 떠올려 보세요.',
      explain: '당도는 여러 유전자가 정해요. 기본 당도가 높은 개체를 골라 부모로 남기면 그 유전자형을 이어 갈 수 있어요.',
      note: 'polygenic',
    },
  ],
  7: [
    {
      id: 's7-bitter', season: 7,
      prompt: '기능하는 유전자 B가 하나라도 있으면 쓴맛이 나요. 쓴맛 없는 납품 모종의 공통점을 고르세요.',
      choices: ['기능하는 B가 하나도 없다', '기능하는 B가 하나 있다', 'B가 두 개 모두 기능한다'],
      answer: 0,
      hint: '기능하는 사본 하나만으로도 형질이 나타나는 경우를 무엇이라 했는지 떠올려 보세요.',
      explain: '기능하는 B가 하나라도 있으면 쓴맛 단백질이 만들어져요. 쓴맛이 없으려면 기능하는 B가 없어야 해요.',
      note: 'dominanceMolecular',
    },
    {
      id: 's7-clone', season: 7,
      prompt: '클론 과수원이 한 가지 병에 함께 무너질 수 있는 까닭을 고르세요.',
      choices: ['클론은 열매가 작아서', '나무들의 유전자형이 모두 같아서', '클론은 광합성을 하지 못해서'],
      answer: 1,
      hint: '클론이 무엇을 똑같이 물려받는지 떠올려 보세요.',
      explain: '클론은 유전자형이 같아요. 한 나무가 약한 병에는 다른 나무도 똑같이 약해요.',
      note: 'clone',
    },
    {
      id: 's7-stop', season: 7, policies: ['precision', 'biotech'],
      prompt: 'mRNA 중간에 UAA가 생겼어요. 번역에서 일어날 일을 고르세요.',
      choices: ['그 자리에서 번역이 끝나 단백질이 짧아진다', '그 자리에 알라닌이 들어간다', '번역이 처음부터 다시 시작된다'],
      answer: 0,
      hint: 'UAA, UAG, UGA가 아미노산을 지정하는지 떠올려 보세요.',
      explain: 'UAA는 종결 코돈이에요. 번역이 그 자리에서 끝나 단백질이 짧아지고 기능을 잃을 수 있어요.',
      note: 'stopCodon',
    },
  ],
  8: [
    {
      id: 's8-combine', season: 8,
      prompt: '기본 당도 16 이상인 골드 모종이 함께 갖춘 조건을 고르세요.',
      choices: ['rr 과육색과 높은 당도에 관여하는 유전자형', 'R 하나와 비료 효과', '4배체 핵형'],
      answer: 0,
      hint: '골드 과육이 되는 조건과 비료 없이 당도가 높은 조건을 각각 떠올려 보세요.',
      explain: '골드는 rr이어야 하고, 기본 당도는 여러 당도 유전자의 조합이 정해요. 선발로 두 조건을 한 자손에 모았어요.',
      note: 'polygenic',
    },
    {
      id: 's8-uniform', season: 8,
      prompt: '박람회 첫 출하에서 낸 같은 빛깔 다섯 모종의 유전자형 설명으로 옳은 것을 고르세요.',
      choices: ['빛깔이 같으니 반드시 같다', '같을 수도 있고 다를 수도 있다', '반드시 서로 다르다'],
      answer: 1,
      hint: 'RR과 Rr이 어떤 과육색을 나타내는지 비교해 보세요.',
      explain: '표현형이 같아도 유전자형은 다를 수 있어요. 검사나 자손 관찰로 확인해야 해요.',
      note: 'heterozygote',
    },
    {
      id: 's8-variety', season: 8,
      prompt: '같은 부모에서 나온 자손 52개체가 서로 다른 까닭을 고르세요.',
      choices: ['자손마다 비료를 다르게 주어서', '감수분열로 대립유전자가 나뉘어 들어가고, 수정할 때 무작위로 만나서', '부모가 매번 바뀌어서'],
      answer: 1,
      hint: '생식세포가 만들어질 때와 수정될 때 각각 무슨 일이 일어나는지 떠올려 보세요.',
      explain: '감수분열에서 대립유전자가 나뉘어 여러 조합의 생식세포가 생기고, 수정에서 무작위로 만나 자손마다 유전자형이 달라져요.',
      note: 'segregation',
    },
  ],
};

/** 이 시즌, 이 운영 팀이 풀 문항 (2~3문항) */
export function quizFor(season: number, policy: PolicyId): QuizQuestion[] {
  return (SEASON_QUIZ[season] ?? []).filter((q) => !q.policies || q.policies.includes(policy));
}

export function isCorrect(q: QuizQuestion, choice: number | null | undefined): boolean {
  return choice === q.answer;
}

/** 한 번의 풀이 상태. 틀린 문항은 몇 번이든 다시 고를 수 있다. */
export interface QuizAttempt {
  questions: QuizQuestion[];
  /** 문항별로 지금까지 고른 선택지 (순서대로) */
  tries: number[][];
  solved: boolean[];
}

export function startAttempt(questions: QuizQuestion[]): QuizAttempt {
  return { questions, tries: questions.map(() => []), solved: questions.map(() => false) };
}

/** 답을 고른다. 이미 맞힌 문항은 바뀌지 않는다. */
export function answerQuestion(attempt: QuizAttempt, index: number, choice: number): boolean {
  const q = attempt.questions[index];
  if (!q || attempt.solved[index]) return attempt.solved[index] ?? false;
  attempt.tries[index].push(choice);
  attempt.solved[index] = isCorrect(q, choice);
  return attempt.solved[index];
}

export function attemptPassed(attempt: QuizAttempt): boolean {
  return attempt.questions.length > 0 && attempt.solved.every(Boolean);
}

export interface QuizGateState {
  phase: Phase;
  ante: number;
  maxAnte: number;
  orderIdx: number;
  quizPassed?: readonly number[];
}

/**
 * 지금 풀어야 하는 시즌 끝 확인 질문의 시즌 번호. 없으면 null.
 * - 시즌의 세 번째 계약을 마치고 공방에서 다음 시즌으로 나가려 할 때
 * - 마지막 시즌의 마지막 계약을 마쳐 결말(victory)로 들어설 때
 */
export function quizDueFor(s: QuizGateState): number | null {
  const passed = s.quizPassed ?? [];
  if (s.phase === 'shop' && s.orderIdx === 2 && s.ante < s.maxAnte) return passed.includes(s.ante) ? null : s.ante;
  if (s.phase === 'victory') return passed.includes(s.maxAnte) ? null : s.maxAnte;
  return null;
}

/**
 * 확인 질문이 생기기 전의 저장: 이미 지난 시즌은 통과로 친다.
 * 이미 끝난 연대기(승리·도전 종료)는 남은 질문 없이 결과를 그대로 보여 준다.
 */
export function legacyQuizPassed(s: { startAnte: number; ante: number; maxAnte: number; phase: Phase }): number[] {
  const last = s.phase === 'victory' || s.phase === 'gameover' ? s.maxAnte : s.ante - 1;
  const out: number[] = [];
  for (let a = s.startAnte; a <= last; a++) out.push(a);
  return out;
}
