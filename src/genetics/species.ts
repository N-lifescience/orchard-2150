// 종 정의. 루미·별다래는 가상의 종이며 유전 규칙(우열·분리·독립·X 연관·배수체)은 실제 과학을 따른다.
import type {
  AlleleDef,
  AlleleId,
  ChromKind,
  ChromosomeDef,
  HomologGroup,
  LocusDef,
  LocusId,
  SpeciesDef,
  SpeciesId,
} from '../contract/genetics';

// ── 편집 가능한 유전자의 코딩 DNA (5'→3', ATG … 종결 코돈, 10코돈 + 종결 = 33nt) ──
//
// R (게임 속 과육색 효소)
//   코돈  0    1    2    3    4    5    6    7    8    9    10
//        ATG  GCT  TGG  CAG  AAA  GGA  TAC  CAT  GAA  CTG  TAA
//        Met  Ala  Trp  Gln  Lys  Gly  Tyr  His  Glu  Leu  종결
//   한 번 치환으로 종결 코돈이 되는 곳: TGG, CAG, AAA, GGA(→TGA), TAC, GAA
//   셋째 자리 흔들림(동의 치환)이 쉬운 곳: GCT, GGA, CTG
//   핵심 자리: 7번 코돈 His (CAT→CAC 는 동의, CAT→AAT 등은 기능 상실)
// r = R 의 3번 코돈(4번째) CAG → TAG. 자연 난센스 대립유전자.
export const SEQ_R = 'ATGGCTTGGCAGAAAGGATACCATGAACTGTAA';
export const SEQ_r = 'ATGGCTTGGTAGAAAGGATACCATGAACTGTAA';
export const ACTIVE_R = 7;

// B (게임 속 쓴맛 효소)
//   코돈  0    1    2    3    4    5    6    7    8    9    10
//        ATG  TCA  GGT  TGG  GAA  CGA  TTC  CTG  AAA  TAC  TGA
//        Met  Ser  Gly  Trp  Glu  Arg  Phe  Leu  Lys  Tyr  종결
//   한 번 치환으로 종결 코돈이 되는 곳: TCA, TGG, GAA, CGA(→TGA), AAA, TAC
//   동의 치환이 쉬운 곳: TCA, GGT, CGA, CTG
//   핵심 자리: 5번 코돈 Arg (CGA→CGG 는 동의, CGA→CAA 는 기능 상실)
// b = B 의 16번째 염기(C, 5번 코돈 첫 글자) 결실 → 틀 이동 → …GAT TCC TGA 에서 끊김. 자연 틀 이동 대립유전자.
export const SEQ_B = 'ATGTCAGGTTGGGAACGATTCCTGAAATACTGA';
export const SEQ_b = SEQ_B.slice(0, 15) + SEQ_B.slice(16);
export const ACTIVE_B = 5;

const Q_LOCI: LocusId[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];

function qLoci(): LocusDef[] {
  return Q_LOCI.map((id, i) => ({ id, name: `당도 ${i + 1}`, kind: 'additive', editable: false }));
}

function qAlleles(): AlleleDef[] {
  const out: AlleleDef[] = [];
  for (const q of Q_LOCI) {
    out.push({ id: `${q}+`, locus: q, label: '+', dominant: false, plus: 1, functional: true });
    out.push({ id: `${q}-`, locus: q, label: '−', dominant: false, plus: 0, functional: false });
  }
  return out;
}

const LOCUS_R: LocusDef = { id: 'R', name: '과육색', kind: 'mendel', editable: true, activeCodon: ACTIVE_R };
const LOCUS_T: LocusDef = { id: 'T', name: '형광 유전자', kind: 'transgene', editable: false };

const ALLELES_R: AlleleDef[] = [
  { id: 'R', locus: 'R', label: 'R', dominant: true, plus: 0, functional: true, seq: SEQ_R },
  { id: 'r', locus: 'R', label: 'r', dominant: false, plus: 0, functional: false, seq: SEQ_r },
  // 편집으로 망가진 R. 편집 기록(seqs)이 없으면 자연 기능 상실 서열(r)을 대표 서열로 보여 준다.
  { id: 'R*ko', locus: 'R', label: 'R′', dominant: false, plus: 0, functional: false, seq: SEQ_r },
];
const ALLELE_T: AlleleDef = { id: 'T+', locus: 'T', label: 'T+', dominant: true, plus: 0, functional: true };

const LUMI: SpeciesDef = {
  id: 'lumi',
  name: '루미',
  sexSystem: 'hermaphrodite',
  chromosomes: [
    { group: 'c1', kind: 'auto', label: '1번', loci: ['R', 'T'] },
    { group: 'c2', kind: 'auto', label: '2번', loci: ['S', 'B'] },
    { group: 'c3', kind: 'auto', label: '3번', loci: ['Q1', 'Q2'] },
    { group: 'c4', kind: 'auto', label: '4번', loci: ['Q3', 'Q4'] },
    { group: 'c5', kind: 'auto', label: '5번', loci: ['Q5', 'Q6'] },
  ],
  loci: [
    LOCUS_R,
    { id: 'S', name: '별무늬', kind: 'mendel', editable: false },
    { id: 'B', name: '쓴맛', kind: 'mendel', editable: true, activeCodon: ACTIVE_B },
    ...qLoci(),
    LOCUS_T,
  ],
  alleles: [
    ...ALLELES_R,
    { id: 'S', locus: 'S', label: 'S', dominant: true, plus: 0, functional: true },
    { id: 's', locus: 'S', label: 's', dominant: false, plus: 0, functional: false },
    { id: 'B', locus: 'B', label: 'B', dominant: true, plus: 0, functional: true, seq: SEQ_B },
    { id: 'b', locus: 'B', label: 'b', dominant: false, plus: 0, functional: false, seq: SEQ_b },
    { id: 'B*ko', locus: 'B', label: 'B′', dominant: false, plus: 0, functional: false, seq: SEQ_b },
    ...qAlleles(),
    ALLELE_T,
  ],
  recombination: 0.5,
};

const STELLA: SpeciesDef = {
  id: 'stella',
  name: '별다래',
  sexSystem: 'XY',
  chromosomes: [
    { group: 'c1', kind: 'auto', label: '1번', loci: ['R', 'T'] },
    { group: 'c2', kind: 'auto', label: '2번', loci: ['Q1', 'Q2', 'Q3'] },
    { group: 'c3', kind: 'auto', label: '3번', loci: ['Q4', 'Q5', 'Q6'] },
    { group: 'sex', kind: 'X', label: 'X', loci: ['L'] },
    { group: 'sex', kind: 'Y', label: 'Y', loci: [] },
  ],
  loci: [LOCUS_R, { id: 'L', name: '은빛 잎', kind: 'mendel', editable: false }, ...qLoci(), LOCUS_T],
  alleles: [
    ...ALLELES_R,
    { id: 'L', locus: 'L', label: 'L', dominant: true, plus: 0, functional: true },
    { id: 'l', locus: 'L', label: 'l', dominant: false, plus: 0, functional: false },
    ...qAlleles(),
    ALLELE_T,
  ],
  recombination: 0.5,
};

export const SPECIES: Record<SpeciesId, SpeciesDef> = { lumi: LUMI, stella: STELLA };

export const ALL_GROUPS: HomologGroup[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'sex'];

// ── 조회 도우미 ──

export function speciesDef(id: SpeciesId): SpeciesDef {
  const d = SPECIES[id];
  if (!d) throw new Error(`모르는 종이에요: ${String(id)}`);
  return d;
}

/** 이 종에 실제로 있는 상동 그룹 (염색체 정의 순서) */
export function groupsOf(id: SpeciesId): HomologGroup[] {
  const out: HomologGroup[] = [];
  for (const c of speciesDef(id).chromosomes) if (!out.includes(c.group)) out.push(c.group);
  return out;
}

export function chromDef(id: SpeciesId, group: HomologGroup, kind: ChromKind): ChromosomeDef | undefined {
  return speciesDef(id).chromosomes.find((c) => c.group === group && c.kind === kind);
}

/** 자리가 놓인 염색체 정의 (종에 없는 자리면 undefined) */
export function chromOfLocus(id: SpeciesId, locus: LocusId): ChromosomeDef | undefined {
  return speciesDef(id).chromosomes.find((c) => c.loci.includes(locus));
}

export function locusDef(id: SpeciesId, locus: LocusId): LocusDef | undefined {
  return speciesDef(id).loci.find((l) => l.id === locus);
}

export function alleleDef(id: SpeciesId, allele: AlleleId): AlleleDef | undefined {
  return speciesDef(id).alleles.find((a) => a.id === allele);
}

/** 편집 가능한 자리의 '기능 있는' 기준 대립유전자 (R, B) */
export function functionalAllele(id: SpeciesId, locus: LocusId): AlleleDef | undefined {
  return speciesDef(id).alleles.find((a) => a.locus === locus && a.functional && a.seq !== undefined);
}

/** 기능 있는 우성 대립유전자인가 (멘델 자리의 우성 표현형을 만드는가) */
export function isDominantFunctional(id: SpeciesId, allele: AlleleId | undefined): boolean {
  if (allele === undefined) return false;
  const a = alleleDef(id, allele);
  return !!a && a.functional && a.dominant;
}

export const Q_LOCUS_IDS: readonly LocusId[] = Q_LOCI;
