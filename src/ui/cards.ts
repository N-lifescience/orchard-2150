// SeedCard·Plant → 그림 모듈의 CardView, 그리고 표현형 문장·확실한 유전자형 표기 (DOM 없음)
import type { CardView } from '../contract/art';
import type { Plant, RunState, SeedCard } from '../contract/game';
import type { Genome, LocusId, Phenotype } from '../contract/genetics';
import { SPECIES, describeGenotype, inferableLoci } from '../genetics';
import { hashStr } from './fmt';

export function artSeedOf(id: string): number {
  return hashStr(`art:${id}`);
}

export function effBrix(c: Pick<SeedCard, 'pheno' | 'brixMod'>): number | null {
  return c.pheno.brix === null ? null : c.pheno.brix + c.brixMod;
}

function alleleLabel(g: Genome, allele: string | undefined): string {
  if (allele === undefined) return '';
  const def = SPECIES[g.species].alleles.find((a) => a.id === allele);
  return def?.label ?? allele;
}

/** 한 자리의 대립유전자 글자들 (사본 순서). 예: R → 'Rr', 4배체 → 'RRrr' */
export function locusLetters(g: Genome, locus: LocusId): string {
  const sp = SPECIES[g.species];
  const chrom = sp.chromosomes.find((c) => c.loci.includes(locus));
  if (!chrom) return '';
  const copies = (g.chromosomes[chrom.group] ?? []).filter((c) => c.alleles[locus] !== undefined);
  return copies.map((c) => alleleLabel(g, c.alleles[locus])).join('');
}

const MENDEL: LocusId[] = ['R', 'S', 'B', 'L'];
const QS: LocusId[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];

/** 멘델의 안경: 겉모습만으로 확실한 자리만 보여 준다. 없으면 null */
export function partialGenotype(g: Genome): string | null {
  const loci = inferableLoci(g);
  if (loci.length === 0) return null;
  const parts: string[] = [];
  for (const l of MENDEL) {
    if (!loci.includes(l)) continue;
    const letters = locusLetters(g, l);
    if (!letters) continue;
    if (l === 'L') {
      const xs = g.chromosomes.sex.filter((c) => c.kind === 'X').length;
      const ys = g.chromosomes.sex.filter((c) => c.kind === 'Y').length;
      parts.push(ys > 0 && xs === 1 ? `X${letters}Y` : letters);
    } else parts.push(letters);
  }
  if (QS.every((q) => loci.includes(q))) {
    const all = QS.map((q) => locusLetters(g, q)).join('');
    parts.push(all.includes('+') ? '당도 전부 +' : '당도 전부 −');
  }
  return parts.length ? parts.join(' ') : null;
}

export interface ViewOpts {
  /** 멘델의 안경 비법이 있는가 */
  glasses: boolean;
}

export function hasGlasses(s: Pick<RunState, 'jokers'>): boolean {
  return s.jokers.some((j) => j.id === 'mendelGlasses');
}

export function seedView(c: SeedCard, o: ViewOpts): CardView {
  const b = effBrix(c);
  return {
    uid: c.uid,
    pheno: c.pheno,
    artSeed: artSeedOf(c.uid),
    brixShown: c.pheno.sex === 'M' ? null : b,
    brixMod: c.brixMod,
    genotypeText: c.revealed ? describeGenotype(c.genome) : null,
    partialGenotype: !c.revealed && o.glasses ? partialGenotype(c.genome) : null,
    debuffed: c.debuffed,
    edited: c.edited,
  };
}

export function lineageText(p: Plant, find: (id: string) => Plant | undefined): string {
  if (p.origin === 'starter') return '처음부터 온실에 있던 개체';
  if (p.origin === 'market') return '시장에서 들인 품종';
  const parents = p.parents;
  if (!parents) return `${p.generation}세대`;
  const a = find(parents[0])?.name ?? '떠나보낸 개체';
  const b = find(parents[1])?.name ?? '떠나보낸 개체';
  if (p.origin === 'clone') return `${a}의 클론`;
  if (parents[0] === parents[1]) return `${a} 자가수분 · ${p.generation}세대`;
  return `${a} × ${b} · ${p.generation}세대`;
}

export function plantView(p: Plant, o: ViewOpts & { subtitle?: string }): CardView {
  return {
    uid: p.id,
    pheno: p.pheno,
    artSeed: artSeedOf(p.id),
    brixShown: p.pheno.sex === 'M' ? null : p.pheno.brix,
    brixMod: 0,
    genotypeText: p.revealed ? describeGenotype(p.genome) : null,
    partialGenotype: !p.revealed && o.glasses ? partialGenotype(p.genome) : null,
    debuffed: false,
    title: p.name,
    subtitle: o.subtitle,
  };
}

/** 그림을 다시 그려야 하는지 판단하는 서명 */
export function viewSig(v: CardView): string {
  const p = v.pheno;
  return [
    v.uid,
    p.color,
    p.marked ? 1 : 0,
    p.sex,
    v.brixShown ?? 'x',
    v.brixMod,
    p.bitter ? 1 : 0,
    p.fluorescent ? 1 : 0,
    p.ploidy,
    p.aneuploid ? 1 : 0,
    p.seedless ? 1 : 0,
    v.genotypeText ?? '',
    v.partialGenotype ?? '',
    v.debuffed ? 1 : 0,
    v.edited ? 1 : 0,
    v.title ?? '',
    v.subtitle ?? '',
  ].join('|');
}

/** 표현형 한 문장: '루비 과육 · 별무늬 · 당도 15°Bx' */
export function phenoSentence(p: Phenotype, brixShown: number | null): string {
  const parts: string[] = [];
  const stella = p.species === 'stella';
  if (p.sex === 'M') parts.push(`수그루 · ${p.color === 'ruby' ? '루비' : '골드'} 꽃잎`);
  else parts.push(`${p.color === 'ruby' ? '루비' : '골드'} 과육`);
  if (stella) parts.push(p.marked ? '은빛 잎' : '초록 잎');
  else parts.push(p.marked ? '별무늬' : '매끈한 껍질');
  if (p.sex !== 'M' && brixShown !== null) parts.push(`당도 ${brixShown}°Bx`);
  if (p.sex === 'M') parts.push('열매 없음');
  if (p.bitter) parts.push('쓴맛');
  if (p.fluorescent) parts.push('형광(LMO)');
  if (p.seedless) parts.push('씨 없음(3배체)');
  else if (p.ploidy === 4) parts.push('4배체');
  if (p.aneuploid) parts.push(p.aneuploidNote ? `이수성: ${p.aneuploidNote}` : '이수성');
  return parts.join(' · ');
}

export function speciesLabel(p: Phenotype): string {
  const base = p.species === 'stella' ? '별다래' : '루미';
  if (p.species === 'stella') return `${base} ${p.sex === 'M' ? '수그루' : '암그루'}`;
  return base;
}
