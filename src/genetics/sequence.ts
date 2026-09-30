// 편집 작업대: 코딩 DNA 를 바꾸고, 바뀐 서열이 단백질에 무슨 일을 하는지 판정한다.
// 原作: 동의·과오·난센스 치환과 틀 이동은 실제 돌연변이 분류. 虛: '핵심 자리 밖 과오 치환은 기능 유지'는 게임 단순화.
import type { AminoAcid, EditResult, Genome, HomologGroup, LocusId, SpeciesId } from '../contract/genetics';
import { translate } from './codons';
import { cloneGenome } from './genome';
import { alleleDef, functionalAllele, locusDef } from './species';

/** 공백 제거·대문자·U→T */
export function normalizeDna(seq: string): string {
  const s = seq.replace(/\s+/g, '').toUpperCase().replace(/U/g, 'T');
  if (!/^[ACGT]*$/.test(s)) throw new Error('서열에는 A·T·G·C 만 쓸 수 있어요');
  return s;
}

const rna = (codon: string): string => codon.replace(/T/g, 'U');

function hasBatchim(word: string): boolean {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return false;
  return (ch - 0xac00) % 28 !== 0;
}
function batchimIsRieul(word: string): boolean {
  const ch = word.charCodeAt(word.length - 1);
  return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 === 8;
}
/** 이/가 */
const iGa = (w: string): string => w + (hasBatchim(w) ? '이' : '가');
/** 으로/로 */
const euro = (w: string): string => w + (hasBatchim(w) && !batchimIsRieul(w) ? '으로' : '로');

/**
 * 염기 단위 정렬(편집 거리 최소). 같은 비용이면 치환을 삽입·결실보다 먼저 고른다.
 * refToSeq[i] = 기준 i번째 염기와 짝지어진 새 서열 위치, 결실이면 -1.
 */
function align(ref: string, seq: string): number[] {
  const n = ref.length;
  const m = seq.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + (ref[i - 1] === seq[j - 1] ? 0 : 1);
      dp[i][j] = Math.min(sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const refToSeq = new Array<number>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (ref[i - 1] === seq[j - 1] ? 0 : 1)) {
      refToSeq[i - 1] = j - 1;
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i--; // 기준 염기 결실
    } else {
      j--; // 새 염기 삽입
    }
  }
  return refToSeq;
}

/** 아미노산 단위 정렬 (같은 비용이면 치환 우선). ref/seq = 각 번호, 빠지거나 끼어든 쪽은 -1 */
function alignProtein(ref: AminoAcid[], seq: AminoAcid[]): { ref: number; seq: number }[] {
  const n = ref.length;
  const m = seq.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1][j - 1] + (ref[i - 1] === seq[j - 1] ? 0 : 1);
      dp[i][j] = Math.min(sub, dp[i - 1][j] + 1, dp[i][j - 1] + 1);
    }
  }
  const ops: { ref: number; seq: number }[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (ref[i - 1] === seq[j - 1] ? 0 : 1)) {
      ops.push({ ref: i - 1, seq: j - 1 });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      ops.push({ ref: i - 1, seq: -1 });
      i--;
    } else {
      ops.push({ ref: -1, seq: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

function proteinOf(aas: (AminoAcid | 'STOP')[], stopAt: number | null): string[] {
  const out: string[] = [];
  for (const a of aas.slice(0, stopAt ?? aas.length)) if (a !== 'STOP') out.push(a.code3);
  return out;
}

function indelWord(refLen: number, newLen: number): string {
  if (newLen < refLen) return '염기가 빠져';
  if (newLen > refLen) return '염기가 끼어들어';
  return '염기가 빠지고 끼어들어';
}

interface Change {
  refIdx: number;
  fromCodon: string;
  toCodon: string | null;
  from: AminoAcid;
  to: AminoAcid | null; // null = 이 코돈이 빠짐
}

/** 기준(기능 있는) 서열과 비교해 무슨 돌연변이인지 판정한다 */
export function analyzeSeq(ref: string, activeCodon: number | undefined, seqIn: string): EditResult {
  const s = normalizeDna(seqIn);
  const tr = translate(s);
  const protein = proteinOf(tr.aminoAcids, tr.stopAt);

  if (s === ref) return { kind: 'none', functional: true, protein, note: '기준 서열과 똑같아요 — 단백질도 그대로예요' };

  if (!s.startsWith('ATG')) {
    const first = s.length >= 3 ? `AUG가 ${rna(s.slice(0, 3))}로 바뀌어` : 'AUG가 사라져';
    return { kind: 'startLost', functional: false, protein: [], note: `시작 코돈 ${first} 번역이 시작되지 않아요` };
  }

  const refTr = translate(ref);
  const refStop = refTr.stopAt ?? refTr.codons.length;
  const refToSeq = align(ref, s);
  const newStop = tr.stopAt;

  // 틀 어긋남: 기준 코딩 영역(종결 코돈까지)에서 짝지어진 위치 차이가 3의 배수가 아닌 첫 염기.
  // 같은 염기가 이어진 곳(예: AA)에서는 결실 자리가 모호해 한두 염기만 잠깐 어긋나 보일 수 있으므로,
  // 어긋남이 짝지어진 염기 3개 이상(또는 끝까지) 이어질 때만 진짜 틀 이동으로 본다.
  let shiftSeqPos: number | null = null;
  const codingEnd = Math.min(ref.length, (refStop + 1) * 3);
  const pairs: { i: number; j: number }[] = [];
  for (let i = 0; i < ref.length; i++) if (refToSeq[i] >= 0) pairs.push({ i, j: refToSeq[i] });
  const off = (k: number) => (pairs[k].j - pairs[k].i) % 3 !== 0;
  for (let k = 0; k < pairs.length && pairs[k].i < codingEnd; k++) {
    if (!off(k)) continue;
    let run = 0;
    while (k + run < pairs.length && off(k + run) && run < 3) run++;
    if (run >= 3 || k + run === pairs.length) {
      shiftSeqPos = pairs[k].j;
      break;
    }
  }
  if (shiftSeqPos !== null) {
    const shiftCodon = Math.floor(shiftSeqPos / 3);
    if (newStop === null || shiftCodon <= newStop) {
      return {
        kind: 'frameshift',
        functional: false,
        protein,
        note: `${indelWord(ref.length, s.length)} ${shiftCodon + 1}번째 코돈부터 읽는 틀이 밀리고, 아미노산이 줄줄이 바뀌어 기능을 잃었어요`,
      };
    }
  }

  // 새 서열에서 기준 종결 코돈이 있어야 할 자리
  const refStopSeq = refToSeq[refStop * 3];
  let expectedStop: number | null = refStopSeq !== undefined && refStopSeq >= 0 && refStopSeq % 3 === 0 ? refStopSeq / 3 : null;
  if (expectedStop === null && (s.length - ref.length) % 3 === 0) expectedStop = refStop + (s.length - ref.length) / 3;

  if (newStop === null || (expectedStop !== null && newStop > expectedStop)) {
    if (s.length % 3 !== 0) {
      return {
        kind: 'frameshift',
        functional: false,
        protein,
        note: `${indelWord(ref.length, s.length)} 종결 코돈이 사라지고 읽는 틀이 어긋나 기능을 잃었어요`,
      };
    }
    // 종결 코돈 소실: 번역이 멈추지 않아 제대로 된 단백질이 안 생긴다고 본다
    return {
      kind: 'missense',
      functional: false,
      protein,
      note: '종결 코돈이 아미노산 코돈으로 바뀌어 번역이 멈추지 않아요 — 제대로 된 단백질이 만들어지지 않아요',
    };
  }

  // 기준 종결 코돈 자리가 틀 밖으로 밀렸는데(뒤쪽 틀 이동) 그 앞에서 멈췄다면 역시 이른 종결
  if (expectedStop === null || newStop < expectedStop) {
    return {
      kind: 'nonsense',
      functional: false,
      protein,
      note: `${newStop + 1}번째 코돈이 ${rna(tr.codons[newStop])}(종결 코돈)가 되어 단백질이 짧게 끊겼어요`,
    };
  }

  // 종결 위치가 같다 → 아미노산 비교
  const refAas = refTr.aminoAcids.slice(0, refStop) as AminoAcid[];
  const newAas = tr.aminoAcids.slice(0, newStop) as AminoAcid[];
  const changes: Change[] = [];
  const synonymous: { refIdx: number; fromCodon: string; toCodon: string; aa: AminoAcid }[] = [];
  let inserted = 0;
  if (s.length === ref.length && newStop === refStop) {
    // 길이가 같으면 코돈끼리 제자리 비교 (치환만 있는 경우)
    for (let c = 0; c < refStop; c++) {
      const from = refAas[c];
      const to = newAas[c];
      if (to !== from) changes.push({ refIdx: c, fromCodon: refTr.codons[c], toCodon: tr.codons[c], from, to });
      else if (tr.codons[c] !== refTr.codons[c]) synonymous.push({ refIdx: c, fromCodon: refTr.codons[c], toCodon: tr.codons[c], aa: from });
    }
  } else {
    // 틀은 맞지만 코돈이 빠지거나 끼어든 경우: 아미노산 단위로 정렬해 비교
    for (const op of alignProtein(refAas, newAas)) {
      if (op.ref === -1) inserted++;
      else if (op.seq === -1) changes.push({ refIdx: op.ref, fromCodon: refTr.codons[op.ref], toCodon: null, from: refAas[op.ref], to: null });
      else if (refAas[op.ref] !== newAas[op.seq]) {
        changes.push({ refIdx: op.ref, fromCodon: refTr.codons[op.ref], toCodon: tr.codons[op.seq], from: refAas[op.ref], to: newAas[op.seq] });
      }
    }
  }

  if (changes.length === 0 && inserted === 0) {
    let note: string;
    if (synonymous.length === 1) {
      const x = synonymous[0];
      note = `${x.refIdx + 1}번째 코돈이 ${rna(x.fromCodon)} → ${rna(x.toCodon)}로 바뀌었지만 같은 아미노산(${x.aa.nameKo})이라 단백질은 그대로예요`;
    } else if (synonymous.length > 1) {
      note = `코돈 ${synonymous.length}개가 바뀌었지만 아미노산은 모두 같아서 단백질은 그대로예요`;
    } else if (refTr.codons[refStop] !== undefined && tr.codons[newStop] !== refTr.codons[refStop]) {
      note = `종결 코돈이 ${rna(refTr.codons[refStop])} → ${rna(tr.codons[newStop])}로 바뀌었지만 여전히 종결 코돈이라 단백질은 그대로예요`;
    } else {
      note = '종결 코돈 뒤쪽만 바뀌어서 단백질은 그대로예요';
    }
    return { kind: 'synonymous', functional: true, protein, note };
  }

  const activeHit = activeCodon !== undefined ? changes.find((x) => x.refIdx === activeCodon) : undefined;
  if (activeHit) {
    const note =
      activeHit.to === null
        ? `핵심 자리인 ${activeHit.refIdx + 1}번째 코돈(${activeHit.from.nameKo})이 사라져 효소가 기능을 잃었어요`
        : `핵심 자리인 ${activeHit.refIdx + 1}번째 코돈의 ${iGa(activeHit.from.nameKo)} ${euro(activeHit.to.nameKo)} 바뀌어 효소가 기능을 잃었어요`;
    return { kind: 'missense', functional: false, protein, note };
  }

  let note: string;
  if (changes.length === 1 && inserted === 0 && changes[0].to && changes[0].toCodon) {
    const x = changes[0];
    const to = x.to as AminoAcid;
    note = `${x.refIdx + 1}번째 코돈이 ${rna(x.fromCodon)}(${x.from.nameKo}) → ${rna(x.toCodon as string)}(${to.nameKo})로 바뀌었지만 핵심 자리가 아니라 기능은 남아 있어요`;
  } else {
    note = `아미노산 ${changes.length + inserted}곳이 달라졌지만 핵심 자리는 그대로라 기능은 남아 있어요`;
  }
  return { kind: 'missense', functional: true, protein, note };
}

function refFor(locus: LocusId, species: SpeciesId): { ref: string; active: number | undefined; functionalId: string } {
  const ld = locusDef(species, locus);
  const fa = functionalAllele(species, locus);
  if (!ld || !ld.editable || !fa || fa.seq === undefined) throw new Error(`${locus} 자리는 편집할 수 없어요`);
  return { ref: fa.seq, active: ld.activeCodon, functionalId: fa.id };
}

export function analyzeCoding(locus: LocusId, species: SpeciesId, seq: string): EditResult {
  const { ref, active } = refFor(locus, species);
  return analyzeSeq(ref, active, seq);
}

/** 이 사본의 코딩 DNA. 편집 불가 자리이거나 사본·대립유전자가 없으면 null */
export function codingSeq(g: Genome, group: HomologGroup, copyIndex: number, locus: LocusId): string | null {
  const ld = locusDef(g.species, locus);
  if (!ld || !ld.editable) return null;
  const copy = g.chromosomes[group]?.[copyIndex];
  if (!copy) return null;
  const allele = copy.alleles[locus];
  if (allele === undefined) return null;
  return copy.seqs?.[locus] ?? alleleDef(g.species, allele)?.seq ?? null;
}

/**
 * 편집: 사본의 서열을 바꾸고 판정대로 대립유전자 id 를 바꾼다.
 * 기능이 남으면 기능 대립유전자(R·B), 잃으면 `R*ko`·`B*ko`. 원래 r 을 되살리는 편집이면 'R' 이 된다.
 */
export function editCoding(
  g: Genome,
  group: HomologGroup,
  copyIndex: number,
  locus: LocusId,
  newSeq: string,
): { genome: Genome; result: EditResult } {
  const { functionalId } = refFor(locus, g.species);
  const src = g.chromosomes[group]?.[copyIndex];
  if (!src) throw new Error(`${group} 의 ${copyIndex}번 사본이 없어요`);
  if (src.alleles[locus] === undefined) throw new Error(`이 염색체 사본에는 ${locus} 자리가 없어요`);
  const result = analyzeCoding(locus, g.species, newSeq);
  const s = normalizeDna(newSeq);
  const genome = cloneGenome(g);
  const copy = genome.chromosomes[group][copyIndex];
  const newId = result.functional ? functionalId : `${functionalId}*ko`;
  copy.alleles[locus] = newId;
  const seqs = { ...(copy.seqs ?? {}) };
  if (alleleDef(g.species, newId)?.seq === s) delete seqs[locus];
  else seqs[locus] = s;
  if (Object.keys(seqs).length > 0) copy.seqs = seqs;
  else delete copy.seqs;
  return { genome, result };
}
