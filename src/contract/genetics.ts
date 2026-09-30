// ─────────────────────────────────────────────────────────────
// 계약서: 유전 엔진 (src/genetics/** 가 구현한다)
// 이 파일은 협의 대상이 아니다. 바꾸려면 오케스트레이터에게 말할 것.
// 구현은 src/genetics/index.ts 에서 아래 GeneticsApi 의 모든 이름을 export 한다.
// ─────────────────────────────────────────────────────────────

export type SpeciesId = 'lumi' | 'stella';
/** [0,1) 균등 난수. 모든 무작위는 이 함수로만 (재현 가능해야 함) */
export type Rng = () => number;

export type LocusId = 'R' | 'S' | 'B' | 'L' | 'T' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6';
/** 예: 'R','r','S','s','B','b','L','l','Q1+','Q1-','T+'
 *  편집으로 망가진 대립유전자는 `${원래id}*ko` (예: 'R*ko') — 기능 없음, 열성처럼 행동 */
export type AlleleId = string;
export type HomologGroup = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'sex';
export type ChromKind = 'auto' | 'X' | 'Y';

export interface AlleleDef {
  id: AlleleId;
  locus: LocusId;
  /** 화면 표기: 'R', 'r', '+', '−' */
  label: string;
  /** 멘델 유전자: 기능 있는 대립유전자가 하나라도 있으면 우성 표현형 */
  dominant: boolean;
  /** 가산(당도) 유전자: 1이면 당도 +, 0이면 − */
  plus: 0 | 1;
  functional: boolean;
  /** 편집 가능한 유전자의 코딩 DNA(5'→3', ATG…종결 코돈 포함). 없으면 편집 불가 */
  seq?: string;
}

export interface LocusDef {
  id: LocusId;
  name: string; // '과육색', '별무늬', '쓴맛', '은빛 잎', '형광 유전자', '당도 1' …
  kind: 'mendel' | 'additive' | 'transgene';
  editable: boolean;
  /** 이 코돈 번호(0부터, ATG=0)의 아미노산이 바뀌면 기능을 잃는 '핵심 자리' */
  activeCodon?: number;
}

export interface ChromosomeDef {
  group: HomologGroup;
  kind: ChromKind;
  label: string; // '1번', 'X', 'Y'
  loci: LocusId[]; // 염색체 위 순서
}

export interface SpeciesDef {
  id: SpeciesId;
  name: string; // '루미', '별다래'
  sexSystem: 'hermaphrodite' | 'XY';
  chromosomes: ChromosomeDef[]; // XY 종은 group 'sex' 에 X, Y 정의 둘 다
  loci: LocusDef[];
  alleles: AlleleDef[];
  /** 같은 염색체 위 이웃 유전자 사이 재조합 빈도. 0.5 = 독립 */
  recombination: number;
}

export interface ChromosomeCopy {
  group: HomologGroup;
  kind: ChromKind;
  alleles: Partial<Record<LocusId, AlleleId>>;
  /** 편집으로 바뀐 코딩 DNA (없으면 대립유전자 기본 서열) */
  seqs?: Partial<Record<LocusId, string>>;
}

export interface Genome {
  species: SpeciesId;
  /** 기본 배수성(2, 3, 4). 이수성은 chromosomes 의 개수로만 드러난다 */
  ploidy: 2 | 3 | 4;
  chromosomes: Record<HomologGroup, ChromosomeCopy[]>; // 해당 종에 없는 group 은 빈 배열
}

export interface Gamete {
  species: SpeciesId;
  ploidy: 1 | 2;
  chromosomes: Record<HomologGroup, ChromosomeCopy[]>;
}

export type Sex = 'H' | 'F' | 'M'; // H = 양성화(루미)
export type FruitColor = 'ruby' | 'gold';
export type SuitKey = 'ruby-m' | 'ruby-p' | 'gold-m' | 'gold-p'; // m = 무늬 있음, p = 무늬 없음

export interface Phenotype {
  species: SpeciesId;
  sex: Sex;
  color: FruitColor; // 수그루는 꽃잎 색
  marked: boolean; // 루미: 별무늬(S) / 별다래: 은빛 잎(L)
  /** 8~20 (이수성이면 −3). 수그루는 null(열매 없음) */
  brix: number | null;
  /** 당도 + 대립유전자 비율 0..1 (그림·비법용) */
  plusFraction: number;
  bitter: boolean; // 기능 있는 B 가 하나라도
  fluorescent: boolean; // T+ 가 하나라도 (LMO)
  ploidy: number;
  aneuploid: boolean;
  aneuploidNote?: string; // 예: '3번 염색체 3개(삼염색체)'
  seedless: boolean; // 3배체
  fertile: boolean; // 3배체면 false
  giant: boolean; // 4배체 이상
}

export interface AminoAcid { code3: string; code1: string; nameKo: string }

export interface EditResult {
  kind: 'none' | 'synonymous' | 'missense' | 'nonsense' | 'frameshift' | 'startLost';
  functional: boolean;
  /** 번역된 아미노산 3글자 코드 목록(종결 전까지) */
  protein: string[];
  note: string; // 한국어 한 문장
}

export interface Distribution {
  samples: number;
  suits: Record<SuitKey, number>; // 비율 0..1 (수그루 포함, 꽃 빛깔)
  brix: Record<number, number>; // 당도별 비율 (열매 맺는 개체만)
  male: number;
  seedless: number;
  aneuploid: number;
}

/**
 * 유전형 문자열 문법 (parseGenotype / formatGenotype 공통)
 *   공백으로 구분된 토큰들. 토큰 = `<자리>:<대립유전자 글자들>`
 *   - 멘델: `R:Rr` `S:ss` `B:bb` `L:Ll`(암그루) `L:L`(수그루, X 하나)
 *   - 당도: `Q1:+-` `Q2:++` … (Q1~Q6)
 *   - 형질전환: `T:+-` (없으면 생략 = T 없음)
 *   - 성: `sex:XX` / `sex:XY` (XY 종만)
 *   - 배수체: 글자 수가 곧 사본 수. `R:RRrr` 이면 4사본
 *   생략한 자리는 열성/− 동형접합으로 채운다.
 *   i번째 글자는 i번째 염색체 사본에 들어간다(같은 염색체 위 유전자끼리는 같은 i가 한 사본).
 */
export interface GeneticsApi {
  SPECIES: Record<SpeciesId, SpeciesDef>;
  CODON_TABLE: Record<string, AminoAcid | 'STOP'>;
  makeRng(seed: number): Rng;
  parseGenotype(species: SpeciesId, spec: string): Genome;
  formatGenotype(g: Genome): string;
  /** 사람이 읽는 짧은 요약. 예: 'Rr Ss bb · 당도+ 7/12 · XX Ll' */
  describeGenotype(g: Genome): string;
  cloneGenome(g: Genome): Genome;
  /** 3배체면 null(불임). nondisjunction = 염색체 쌍마다 비분리 확률(기본 0) */
  meiosis(g: Genome, rng: Rng, opts?: { nondisjunction?: number }): Gamete | null;
  fertilize(a: Gamete, b: Gamete): Genome;
  canCross(a: Genome, b: Genome, sameIndividual: boolean): { ok: boolean; reason?: string };
  /** 꼬투리: n알. canCross 가 아니면 throw */
  makePod(a: Genome, b: Genome, rng: Rng, n: number, opts?: { nondisjunction?: number }): Genome[];
  phenotype(g: Genome): Phenotype;
  suitOf(p: Phenotype): SuitKey;
  isHeterozygous(g: Genome, locus: LocusId): boolean;
  /** 겉모습만으로 확실히 알 수 있는 자리 (열성 표현형, 수그루의 X 연관 등) */
  inferableLoci(g: Genome): LocusId[];
  /** 콜히친: 모든 염색체 사본을 두 배로 (2n→4n) */
  doubleGenome(g: Genome): Genome;
  /** 형질전환: c1 사본 하나에 T+ 삽입 */
  addTransgene(g: Genome, rng: Rng): Genome;
  /** 편집 작업대 */
  codingSeq(g: Genome, group: HomologGroup, copyIndex: number, locus: LocusId): string | null;
  editCoding(g: Genome, group: HomologGroup, copyIndex: number, locus: LocusId, newSeq: string): { genome: Genome; result: EditResult };
  analyzeCoding(locus: LocusId, species: SpeciesId, seq: string): EditResult;
  transcribe(codingDna: string): string; // T → U
  templateStrand(codingDna: string): string; // 상보 가닥(3'→5' 로 읽는 표시용, 같은 방향으로 나란히)
  translate(mrna: string): { codons: string[]; aminoAcids: (AminoAcid | 'STOP')[]; stopAt: number | null };
  /** 몬테카를로 기대 분포 (퍼넷 노트) */
  expectedDistribution(a: Genome, b: Genome, samples?: number, seed?: number): Distribution;
}
