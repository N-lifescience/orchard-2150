// 유전체 자료 다루기 (복사·성 판정·이수성 판정)
import type { ChromosomeCopy, Genome, HomologGroup, Sex } from '../contract/genetics';
import { ALL_GROUPS, chromDef, groupsOf, speciesDef } from './species';

export function emptyChromosomes(): Record<HomologGroup, ChromosomeCopy[]> {
  return { c1: [], c2: [], c3: [], c4: [], c5: [], sex: [] };
}

export function cloneCopy(c: ChromosomeCopy): ChromosomeCopy {
  const out: ChromosomeCopy = { group: c.group, kind: c.kind, alleles: { ...c.alleles } };
  if (c.seqs && Object.keys(c.seqs).length > 0) out.seqs = { ...c.seqs };
  return out;
}

function cloneGroups(src: Record<HomologGroup, ChromosomeCopy[]>): Record<HomologGroup, ChromosomeCopy[]> {
  const out = emptyChromosomes();
  for (const g of ALL_GROUPS) out[g] = (src[g] ?? []).map(cloneCopy);
  return out;
}

export function cloneGenome(g: Genome): Genome {
  return { species: g.species, ploidy: g.ploidy, chromosomes: cloneGroups(g.chromosomes) };
}

export function sexOf(g: Genome): Sex {
  if (speciesDef(g.species).sexSystem === 'hermaphrodite') return 'H';
  return g.chromosomes.sex.some((c) => c.kind === 'Y') ? 'M' : 'F';
}

/** 이수성인 그룹들: 사본 수가 기본 배수성과 다른 그룹 (성 그룹은 X+Y 합으로 본다) */
export function aneuploidGroups(g: Genome): { group: HomologGroup; count: number }[] {
  const out: { group: HomologGroup; count: number }[] = [];
  for (const group of groupsOf(g.species)) {
    const n = g.chromosomes[group].length;
    if (n !== g.ploidy) out.push({ group, count: n });
  }
  return out;
}

const SOMY: Record<number, string> = { 0: '전무 염색체', 1: '일염색체', 3: '삼염색체', 4: '사염색체' };

/** 예: '3번 염색체가 3개(삼염색체)', '성염색체가 3개(XXY)' */
export function aneuploidNote(g: Genome): string | undefined {
  const parts: string[] = [];
  for (const { group, count } of aneuploidGroups(g)) {
    if (group === 'sex') {
      const letters = sexLetters(g.chromosomes.sex);
      parts.push(`성염색체가 ${count}개(${letters.length > 0 ? letters : 'O'}${letters.length === 1 ? 'O' : ''})`);
    } else {
      const label = chromDef(g.species, group, 'auto')?.label ?? group;
      const somy = g.ploidy === 2 ? SOMY[count] : undefined;
      parts.push(`${label} 염색체가 ${count}개${somy ? `(${somy})` : ''}`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/** 성염색체 글자 (X 먼저, Y 나중): 'XX', 'XY', 'XXY' */
export function sexLetters(copies: ChromosomeCopy[]): string {
  const x = copies.filter((c) => c.kind === 'X').length;
  const y = copies.filter((c) => c.kind === 'Y').length;
  return 'X'.repeat(x) + 'Y'.repeat(y);
}

/**
 * 살 수 없는 접합자인가.
 *  - 상염색체 그룹 하나라도 사본 0개(전무 염색체) → 치사 (계약)
 *  - XY 종에서 X 가 하나도 없음 → 치사 (사람의 YO 도 발생하지 못한다)
 */
export function isLethal(g: Genome): boolean {
  for (const group of groupsOf(g.species)) {
    if (group === 'sex') {
      if (!g.chromosomes.sex.some((c) => c.kind === 'X')) return true;
    } else if (g.chromosomes[group].length === 0) {
      return true;
    }
  }
  return false;
}
