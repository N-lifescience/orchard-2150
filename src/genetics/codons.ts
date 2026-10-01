// 유전 부호(표준 코돈표)와 전사·번역. 실제 생물의 표준 유전 부호를 따른다.
import type { AminoAcid } from '../contract/genetics';

const AA_LIST: AminoAcid[] = [
  { code3: 'Ala', code1: 'A', nameKo: '알라닌' },
  { code3: 'Arg', code1: 'R', nameKo: '아르지닌' },
  { code3: 'Asn', code1: 'N', nameKo: '아스파라진' },
  { code3: 'Asp', code1: 'D', nameKo: '아스파트산' },
  { code3: 'Cys', code1: 'C', nameKo: '시스테인' },
  { code3: 'Gln', code1: 'Q', nameKo: '글루타민' },
  { code3: 'Glu', code1: 'E', nameKo: '글루탐산' },
  { code3: 'Gly', code1: 'G', nameKo: '글라이신' },
  { code3: 'His', code1: 'H', nameKo: '히스티딘' },
  { code3: 'Ile', code1: 'I', nameKo: '아이소류신' },
  { code3: 'Leu', code1: 'L', nameKo: '류신' },
  { code3: 'Lys', code1: 'K', nameKo: '라이신' },
  { code3: 'Met', code1: 'M', nameKo: '메싸이오닌' },
  { code3: 'Phe', code1: 'F', nameKo: '페닐알라닌' },
  { code3: 'Pro', code1: 'P', nameKo: '프롤린' },
  { code3: 'Ser', code1: 'S', nameKo: '세린' },
  { code3: 'Thr', code1: 'T', nameKo: '트레오닌' },
  { code3: 'Trp', code1: 'W', nameKo: '트립토판' },
  { code3: 'Tyr', code1: 'Y', nameKo: '타이로신' },
  { code3: 'Val', code1: 'V', nameKo: '발린' },
];

/** 한 글자 코드 → 아미노산 (같은 객체를 공유해서 === 비교가 된다) */
export const AMINO_ACIDS: Record<string, AminoAcid> = Object.fromEntries(AA_LIST.map((a) => [a.code1, a]));

// 표준 유전 부호(NCBI 표 1). 첫째·둘째·셋째 염기를 U C A G 순서로 돈다. '*' = 종결
const BASES = 'UCAG';
const CODE = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';

function buildTable(): Record<string, AminoAcid | 'STOP'> {
  const table: Record<string, AminoAcid | 'STOP'> = {};
  let i = 0;
  for (const b1 of BASES) {
    for (const b2 of BASES) {
      for (const b3 of BASES) {
        const c = CODE[i++];
        table[b1 + b2 + b3] = c === '*' ? 'STOP' : AMINO_ACIDS[c];
      }
    }
  }
  return table;
}

/** 표준 64코돈. 열쇠는 mRNA 코돈(U 사용, 예: 'AUG'). DNA 코돈은 T→U 로 바꿔서 찾는다 */
export const CODON_TABLE: Record<string, AminoAcid | 'STOP'> = buildTable();

function clean(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

/** 전사: 코딩 가닥 DNA(5'→3') → mRNA. T → U */
export function transcribe(codingDna: string): string {
  return clean(codingDna).replace(/T/g, 'U');
}

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', U: 'A', G: 'C', C: 'G' };

/** 주형 가닥: 코딩 가닥의 상보 염기(A↔T, G↔C). 같은 방향으로 나란히 보여 주기 위한 것 */
export function templateStrand(codingDna: string): string {
  return Array.from(clean(codingDna))
    .map((b) => COMPLEMENT[b] ?? b)
    .join('');
}

/** 코돈 하나 찾기 (DNA·RNA 둘 다 받음). 없으면 undefined */
export function lookupCodon(codon: string): AminoAcid | 'STOP' | undefined {
  return CODON_TABLE[clean(codon).replace(/T/g, 'U')];
}

/**
 * 번역: 문자열 **처음부터** 세 글자씩 끊는다(AUG 를 찾아가지 않음). 남는 1~2글자는 코돈이 아니다.
 * codons·aminoAcids 는 끝까지 전부 돌려주고, stopAt = 첫 종결 코돈의 번호(0부터). 그 뒤는 번역되지 않는 부분.
 */
export function translate(mrna: string): {
  codons: string[];
  aminoAcids: (AminoAcid | 'STOP')[];
  stopAt: number | null;
} {
  const s = clean(mrna).replace(/T/g, 'U');
  const codons: string[] = [];
  const aminoAcids: (AminoAcid | 'STOP')[] = [];
  let stopAt: number | null = null;
  for (let i = 0; i + 3 <= s.length; i += 3) {
    const codon = s.slice(i, i + 3);
    const aa = CODON_TABLE[codon];
    if (aa === undefined) throw new Error(`'${codon}' 코돈을 읽을 수 없어요. A·U·G·C만 쓸 수 있어요.`);
    if (aa === 'STOP' && stopAt === null) stopAt = codons.length;
    codons.push(codon);
    aminoAcids.push(aa);
  }
  return { codons, aminoAcids, stopAt };
}
