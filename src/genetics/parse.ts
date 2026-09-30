// 유전형 문자열 ↔ Genome. 문법은 src/contract/genetics.ts 주석 그대로.
//   토큰 = `<자리>:<대립유전자 글자들>`, i번째 글자 = i번째 염색체 사본.
//   편집으로 망가진 대립유전자(R*ko)는 프라임을 붙여 `R′` 로 쓴다 (읽을 때는 `R'` 도 받는다).
import type { AlleleId, ChromosomeCopy, Genome, HomologGroup, LocusDef, LocusId, SpeciesId } from '../contract/genetics';
import { emptyChromosomes, sexLetters } from './genome';
import { alleleDef, chromOfLocus, groupsOf, isDominantFunctional, speciesDef } from './species';

const PRIME = '′';

/** 'Rr′-' 같은 본문을 글자 단위로. 뒤에 붙은 프라임은 앞 글자에 붙인다 */
function splitSymbols(body: string): string[] {
  const out: string[] = [];
  for (const ch of Array.from(body)) {
    if ((ch === PRIME || ch === "'") && out.length > 0) out[out.length - 1] += PRIME;
    else out.push(ch);
  }
  return out;
}

/** 멘델 자리의 자연 열성 대립유전자 (r, s, b, l) */
function recessiveAllele(species: SpeciesId, locus: LocusId): AlleleId {
  const a = speciesDef(species).alleles.find((x) => x.locus === locus && !x.dominant && !x.id.endsWith('*ko'));
  if (!a) throw new Error(`${locus} 자리의 열성 대립유전자가 없어요`);
  return a.id;
}

/** 글자 하나 → 대립유전자 id. T 의 '-' 는 undefined(형질전환 없음) */
function symbolToAllele(species: SpeciesId, locus: LocusDef, sym: string): AlleleId | undefined {
  if (locus.kind === 'additive') {
    if (sym === '+') return `${locus.id}+`;
    if (sym === '-' || sym === '−') return `${locus.id}-`;
  } else if (locus.kind === 'transgene') {
    if (sym === '+') return 'T+';
    if (sym === '-' || sym === '−') return undefined;
  } else {
    const up = locus.id.toUpperCase();
    let id: string | undefined;
    if (sym === up) id = up;
    else if (sym === up.toLowerCase()) id = up.toLowerCase();
    else if (sym === up + PRIME) id = `${up}*ko`;
    if (id !== undefined && alleleDef(species, id)) return id;
  }
  throw new Error(`${locus.id} 자리에 '${sym}' 은(는) 쓸 수 없어요`);
}

function alleleToSymbol(locus: LocusDef, allele: AlleleId | undefined): string {
  if (locus.kind === 'additive') return allele !== undefined && allele.endsWith('+') ? '+' : '-';
  if (locus.kind === 'transgene') return allele === 'T+' ? '+' : '-';
  if (allele === undefined) return locus.id.toLowerCase();
  if (allele.endsWith('*ko')) return allele.slice(0, -3) + PRIME;
  return allele;
}

/**
 * 기본 배수성 어림: 2·3·4 중 사본 수가 딱 맞는 그룹이 가장 많은 쪽.
 * 동점이면 차이 합이 작은 쪽, 그래도 같으면 2 → 4 → 3 순서로 고른다.
 */
function inferPloidy(counts: number[]): 2 | 3 | 4 {
  if (counts.length === 0) return 2;
  let best: 2 | 3 | 4 = 2;
  let bestMatch = -1;
  let bestDev = Infinity;
  for (const cand of [2, 4, 3] as const) {
    const match = counts.filter((c) => c === cand).length;
    const dev = counts.reduce((sum, c) => sum + Math.abs(c - cand), 0);
    if (match > bestMatch || (match === bestMatch && dev < bestDev)) {
      best = cand;
      bestMatch = match;
      bestDev = dev;
    }
  }
  return best;
}

export function parseGenotype(species: SpeciesId, spec: string): Genome {
  const def = speciesDef(species);
  const tokens = spec.trim().split(/\s+/).filter((t) => t.length > 0);
  const locusSyms = new Map<LocusId, string[]>();
  let sexSyms: string[] | null = null;

  for (const tok of tokens) {
    const colon = tok.indexOf(':');
    if (colon <= 0) throw new Error(`'${tok}' 은(는) '자리:글자' 모양이 아니에요`);
    const key = tok.slice(0, colon);
    const syms = splitSymbols(tok.slice(colon + 1));
    if (key === 'sex') {
      if (def.sexSystem !== 'XY') throw new Error(`${def.name}은(는) 성염색체가 없어요`);
      if (sexSyms) throw new Error('sex 토큰이 두 번 나왔어요');
      for (const s of syms) if (s !== 'X' && s !== 'Y') throw new Error(`성염색체에 '${s}' 은(는) 쓸 수 없어요`);
      sexSyms = syms;
      continue;
    }
    const ld = def.loci.find((l) => l.id === key);
    if (!ld) throw new Error(`${def.name}에는 '${key}' 자리가 없어요`);
    if (locusSyms.has(ld.id)) throw new Error(`${key} 토큰이 두 번 나왔어요`);
    for (const s of syms) symbolToAllele(species, ld, s); // 글자 검사
    locusSyms.set(ld.id, syms);
  }

  // 그룹별 사본 수
  const counts: Partial<Record<HomologGroup, number>> = {};
  let xFromL: number | null = null;
  for (const [locus, syms] of locusSyms) {
    const chrom = chromOfLocus(species, locus);
    if (!chrom) continue;
    if (chrom.kind === 'X') {
      xFromL = syms.length;
      continue;
    }
    const prev = counts[chrom.group];
    if (prev !== undefined && prev !== syms.length) {
      throw new Error(`${chrom.label} 염색체 위 자리들의 글자 수가 서로 달라요`);
    }
    counts[chrom.group] = syms.length;
  }
  if (sexSyms) {
    counts.sex = sexSyms.length;
    const xs = sexSyms.filter((s) => s === 'X').length;
    if (xFromL !== null && xFromL !== xs) throw new Error('L 글자 수가 X 염색체 수와 달라요');
  }

  const ploidy = inferPloidy(Object.values(counts) as number[]);

  if (def.sexSystem === 'XY' && !sexSyms) {
    const x = xFromL ?? ploidy;
    sexSyms = [...'X'.repeat(x), ...'Y'.repeat(Math.max(0, ploidy - x))];
  }

  const chromosomes = emptyChromosomes();
  for (const group of groupsOf(species)) {
    if (group === 'sex') {
      const lDef = def.loci.find((l) => l.id === 'L');
      const lSyms = locusSyms.get('L');
      let xi = 0;
      for (const s of sexSyms ?? []) {
        if (s === 'Y') {
          chromosomes.sex.push({ group: 'sex', kind: 'Y', alleles: {} });
        } else {
          const sym = lSyms?.[xi];
          const allele = lDef && sym !== undefined ? symbolToAllele(species, lDef, sym) : recessiveAllele(species, 'L');
          chromosomes.sex.push({ group: 'sex', kind: 'X', alleles: { L: allele } });
          xi++;
        }
      }
      continue;
    }
    const chrom = def.chromosomes.find((c) => c.group === group)!;
    const n = counts[group] ?? ploidy;
    for (let i = 0; i < n; i++) {
      const copy: ChromosomeCopy = { group, kind: 'auto', alleles: {} };
      for (const locus of chrom.loci) {
        const ld = def.loci.find((l) => l.id === locus)!;
        const sym = locusSyms.get(locus)?.[i];
        let allele: AlleleId | undefined;
        if (sym !== undefined) allele = symbolToAllele(species, ld, sym);
        else if (ld.kind === 'mendel') allele = recessiveAllele(species, locus);
        else if (ld.kind === 'additive') allele = `${locus}-`;
        else allele = undefined; // 형질전환 없음
        if (allele !== undefined) copy.alleles[locus] = allele;
      }
      chromosomes[group].push(copy);
    }
  }
  return { species, ploidy, chromosomes };
}

/** 자리의 사본들 (X 연관이면 X 사본만) */
export function copiesOfLocus(g: Genome, locus: LocusId): ChromosomeCopy[] {
  const chrom = chromOfLocus(g.species, locus);
  if (!chrom) return [];
  return g.chromosomes[chrom.group].filter((c) => c.kind === chrom.kind);
}

export function formatGenotype(g: Genome): string {
  const def = speciesDef(g.species);
  const tokens: string[] = [];
  for (const ld of def.loci) {
    const copies = copiesOfLocus(g, ld.id);
    if (ld.kind === 'transgene') {
      if (!copies.some((c) => c.alleles[ld.id] === 'T+')) continue;
    }
    tokens.push(`${ld.id}:${copies.map((c) => alleleToSymbol(ld, c.alleles[ld.id])).join('')}`);
  }
  if (def.sexSystem === 'XY') {
    tokens.push(`sex:${g.chromosomes.sex.map((c) => (c.kind === 'Y' ? 'Y' : 'X')).join('')}`);
  }
  // 형질전환 토큰은 맨 뒤로 (읽기 쉽게)
  const t = tokens.findIndex((x) => x.startsWith('T:'));
  if (t >= 0) tokens.push(tokens.splice(t, 1)[0]);
  return tokens.join(' ');
}

function rankAllele(species: SpeciesId, allele: AlleleId | undefined): number {
  if (isDominantFunctional(species, allele)) return 0;
  if (allele !== undefined && allele.endsWith('*ko')) return 1;
  return 2;
}

function mendelLetters(g: Genome, ld: LocusDef): string {
  const copies = copiesOfLocus(g, ld.id);
  if (copies.length === 0) return `(${ld.id} 없음)`;
  return copies
    .map((c) => c.alleles[ld.id])
    .sort((a, b) => rankAllele(g.species, a) - rankAllele(g.species, b))
    .map((a) => alleleToSymbol(ld, a))
    .join('');
}

/** 예: 'Rr Ss bb · 당도+ 7/12', 'Rr · 당도+ 5/12 · XY L', 'RRrr … · 형광 T+' */
export function describeGenotype(g: Genome): string {
  const def = speciesDef(g.species);
  const parts: string[] = [];
  const mendel = def.loci.filter((l) => l.kind === 'mendel' && chromOfLocus(g.species, l.id)?.kind === 'auto');
  parts.push(mendel.map((l) => mendelLetters(g, l)).join(' '));

  let plus = 0;
  let total = 0;
  for (const ld of def.loci) {
    if (ld.kind !== 'additive') continue;
    for (const c of copiesOfLocus(g, ld.id)) {
      total++;
      if (alleleDef(g.species, c.alleles[ld.id] ?? '')?.plus === 1) plus++;
    }
  }
  parts.push(`당도+ ${plus}/${total}`);

  if (def.sexSystem === 'XY') {
    const letters = sexLetters(g.chromosomes.sex);
    const xLoci = def.loci.filter((l) => chromOfLocus(g.species, l.id)?.kind === 'X');
    const xl = xLoci.map((l) => (copiesOfLocus(g, l.id).length > 0 ? mendelLetters(g, l) : '')).join(' ');
    parts.push(`${letters.length > 0 ? letters : 'O'}${xl ? ` ${xl}` : ''}`);
  }
  if (g.chromosomes.c1.some((c) => c.alleles.T === 'T+')) parts.push('형광 T+');
  return parts.join(' · ');
}
