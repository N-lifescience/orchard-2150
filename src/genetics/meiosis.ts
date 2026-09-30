// 감수분열·수정·교배. 분리·독립·교차·비분리를 실제로 시뮬레이션한다.
import type { ChromosomeCopy, Gamete, Genome, HomologGroup, LocusId, Rng } from '../contract/genetics';
import { cloneCopy, cloneGenome, emptyChromosomes, isLethal, sexOf } from './genome';
import { pickDistinct } from './rng';
import { chromDef, groupsOf, speciesDef } from './species';

export interface MeiosisOpts {
  nondisjunction?: number;
}

/**
 * 교차: 두 상동 염색체를 따라가며, 이웃 유전자 사이마다 확률 rec 로 가닥을 바꿔 탄다.
 * (rec = 0.5 면 같은 염색체 위 유전자도 독립처럼 행동한다.)
 */
function crossover(a: ChromosomeCopy, b: ChromosomeCopy, loci: LocusId[], rec: number, rng: Rng): ChromosomeCopy {
  let cur = rng() < 0.5 ? a : b;
  const out: ChromosomeCopy = { group: a.group, kind: a.kind, alleles: {} };
  loci.forEach((locus, i) => {
    if (i > 0 && rng() < rec) cur = cur === a ? b : a;
    const allele = cur.alleles[locus];
    if (allele !== undefined) out.alleles[locus] = allele;
    const seq = cur.seqs?.[locus];
    if (seq !== undefined) (out.seqs ??= {})[locus] = seq;
  });
  return out;
}

/** 2배체 한 그룹의 분리. 정상은 사본 1개, 비분리면 2개 또는 0개 */
function segregateDiploid(
  copies: ChromosomeCopy[],
  loci: (c: ChromosomeCopy) => LocusId[],
  rec: number,
  p: number,
  rng: Rng,
): ChromosomeCopy[] {
  const n = copies.length;
  if (n === 0) return [];
  if (n === 2) {
    if (p > 0 && rng() < p) {
      // 비분리: 두 사본이 같은 쪽으로 간다
      return rng() < 0.5 ? copies.map(cloneCopy) : [];
    }
    const [a, b] = copies;
    if (a.kind === b.kind) return [crossover(a, b, loci(a), rec, rng)];
    return [cloneCopy(rng() < 0.5 ? a : b)]; // X 와 Y: 교차 없이 하나
  }
  if (n === 1) return rng() < 0.5 ? [cloneCopy(copies[0])] : []; // 일염색체: 짝 없이 한쪽으로
  // 삼염색체 이상: 절반(내림/올림)을 무작위로, 교차 없음
  const k = n % 2 === 0 ? n / 2 : rng() < 0.5 ? Math.floor(n / 2) : Math.ceil(n / 2);
  return pickDistinct(rng, copies, k).map(cloneCopy);
}

/** 4배체 한 그룹의 분리. 4사본 중 무작위 2개(교차 없음). 비분리면 1개 또는 3개 */
function segregateTetraploid(copies: ChromosomeCopy[], p: number, rng: Rng): ChromosomeCopy[] {
  const n = copies.length;
  if (n === 0) return [];
  let k: number;
  if (n % 2 === 1) k = rng() < 0.5 ? Math.floor(n / 2) : Math.ceil(n / 2);
  else k = n / 2;
  if (p > 0 && rng() < p) k = rng() < 0.5 ? Math.max(0, k - 1) : Math.min(n, k + 1);
  return pickDistinct(rng, copies, k).map(cloneCopy);
}

/**
 * 감수분열 → 생식세포 하나.
 *  - 2n: 그룹마다 상동 두 사본에서 교차해 사본 1개. XY 는 X 또는 Y 하나. 비분리(확률 p)면 2개 또는 0개.
 *  - 4n: 그룹마다 4사본 중 무작위 2개(단순화: 4가 염색체의 교차는 다루지 않는다). 생식세포 ploidy 2.
 *  - 3n: null (짝이 맞지 않아 불임).
 */
export function meiosis(g: Genome, rng: Rng, opts?: MeiosisOpts): Gamete | null {
  if (g.ploidy === 3) return null;
  const def = speciesDef(g.species);
  const p = opts?.nondisjunction ?? 0;
  const lociOf = (c: ChromosomeCopy): LocusId[] => chromDef(g.species, c.group, c.kind)?.loci ?? [];
  const chromosomes = emptyChromosomes();
  for (const group of groupsOf(g.species)) {
    const copies = g.chromosomes[group];
    chromosomes[group] =
      g.ploidy === 2 ? segregateDiploid(copies, lociOf, def.recombination, p, rng) : segregateTetraploid(copies, p, rng);
  }
  return { species: g.species, ploidy: g.ploidy === 2 ? 1 : 2, chromosomes };
}

/** 수정: 그룹별로 두 생식세포의 사본을 합친다. 배수성 = 두 생식세포 ploidy 의 합 */
export function fertilize(a: Gamete, b: Gamete): Genome {
  if (a.species !== b.species) throw new Error('종이 다른 생식세포는 수정할 수 없어요');
  const chromosomes = emptyChromosomes();
  for (const group of Object.keys(chromosomes) as HomologGroup[]) {
    chromosomes[group] = [...(a.chromosomes[group] ?? []), ...(b.chromosomes[group] ?? [])].map(cloneCopy);
  }
  const ploidy = (a.ploidy + b.ploidy) as 2 | 3 | 4;
  return { species: a.species, ploidy, chromosomes };
}

export function canCross(a: Genome, b: Genome, sameIndividual: boolean): { ok: boolean; reason?: string } {
  if (a.species !== b.species) return { ok: false, reason: '종이 달라서 교배할 수 없어요' };
  if (a.ploidy === 3 || b.ploidy === 3) return { ok: false, reason: '3배체는 씨를 맺지 못해 부모가 될 수 없어요' };
  const def = speciesDef(a.species);
  if (def.sexSystem === 'hermaphrodite') return { ok: true };
  if (sameIndividual) return { ok: false, reason: `${def.name}은(는) 암수딴그루라 스스로 가루받이할 수 없어요` };
  const sa = sexOf(a);
  const sb = sexOf(b);
  if (sa === sb) {
    return { ok: false, reason: sa === 'F' ? '둘 다 암그루예요 — 수그루가 하나 있어야 해요' : '둘 다 수그루예요 — 암그루가 하나 있어야 해요' };
  }
  return { ok: true };
}

const MAX_TRIES = 200;

function oneSeed(a: Genome, b: Genome, rng: Rng, opts?: MeiosisOpts): Genome | null {
  const ga = meiosis(a, rng, opts);
  const gb = meiosis(b, rng, opts);
  if (!ga || !gb) return null;
  const z = fertilize(ga, gb);
  return isLethal(z) ? null : z;
}

/**
 * 꼬투리 n알. a === b(같은 객체)면 자가수분으로 본다.
 * 전무 염색체(상염색체 사본 0개)나 X 없는 접합자는 치사 → 버리고 다시 뽑는다(한 알에 최대 MAX_TRIES 번).
 */
export function makePod(a: Genome, b: Genome, rng: Rng, n: number, opts?: MeiosisOpts): Genome[] {
  const check = canCross(a, b, a === b);
  if (!check.ok) throw new Error(check.reason ?? '교배할 수 없어요');
  const pod: Genome[] = [];
  for (let i = 0; i < n; i++) {
    let z: Genome | null = null;
    for (let t = 0; t < MAX_TRIES && !z; t++) z = oneSeed(a, b, rng, opts);
    // 상한에 걸리면 비분리 없이 다시 (부모가 이수성이라 치사가 잦은 경우 대비)
    for (let t = 0; t < MAX_TRIES && !z; t++) z = oneSeed(a, b, rng, { nondisjunction: 0 });
    if (!z) throw new Error('살아남는 씨앗을 만들 수 없어요 — 부모의 염색체 이상이 너무 심해요');
    pod.push(z);
  }
  return pod;
}

/** 콜히친: 모든 사본을 두 배로 (2n→4n). 2배체가 아니면 바꾸지 않고 복사본을 돌려준다 */
export function doubleGenome(g: Genome): Genome {
  const out = cloneGenome(g);
  if (g.ploidy !== 2) return out;
  for (const group of Object.keys(out.chromosomes) as HomologGroup[]) {
    out.chromosomes[group] = [...out.chromosomes[group], ...out.chromosomes[group].map(cloneCopy)];
  }
  out.ploidy = 4;
  return out;
}

/** 형질전환: T+ 가 없는 1번 염색체 사본 하나를 골라 T+ 를 끼워 넣는다 (모두 있으면 그대로) */
export function addTransgene(g: Genome, rng: Rng): Genome {
  const out = cloneGenome(g);
  const free = out.chromosomes.c1.filter((c) => c.alleles.T !== 'T+');
  if (free.length === 0) return out;
  const [target] = pickDistinct(rng, free, 1);
  target.alleles.T = 'T+';
  return out;
}
