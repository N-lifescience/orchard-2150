// 유전자형 → 표현형, 그리고 표현형에서 거꾸로 확실히 알 수 있는 것.
import type { Distribution, Genome, LocusId, Phenotype, SuitKey } from '../contract/genetics';
import { aneuploidGroups, aneuploidNote, sexOf } from './genome';
import { makePod } from './meiosis';
import { copiesOfLocus } from './parse';
import { makeRng } from './rng';
import { alleleDef, isDominantFunctional, Q_LOCUS_IDS, speciesDef } from './species';

/** 기능 있는 우성 대립유전자가 하나라도 있는가 */
function hasDominant(g: Genome, locus: LocusId): boolean {
  return copiesOfLocus(g, locus).some((c) => isDominantFunctional(g.species, c.alleles[locus]));
}

function plusStats(g: Genome): { plus: number; total: number } {
  let plus = 0;
  let total = 0;
  for (const q of Q_LOCUS_IDS) {
    for (const c of copiesOfLocus(g, q)) {
      const a = c.alleles[q];
      if (a === undefined) continue;
      total++;
      if (alleleDef(g.species, a)?.plus === 1) plus++;
    }
  }
  return { plus, total };
}

export function phenotype(g: Genome): Phenotype {
  const def = speciesDef(g.species);
  const sex = sexOf(g);
  const aneuploid = aneuploidGroups(g).length > 0;
  const { plus, total } = plusStats(g);
  const plusFraction = total > 0 ? plus / total : 0;
  const brix = sex === 'M' ? null : 8 + Math.round(12 * plusFraction) - (aneuploid ? 3 : 0);
  const marked = def.sexSystem === 'XY' ? hasDominant(g, 'L') : hasDominant(g, 'S');
  const p: Phenotype = {
    species: g.species,
    sex,
    color: hasDominant(g, 'R') ? 'ruby' : 'gold',
    marked,
    brix,
    plusFraction,
    bitter: def.loci.some((l) => l.id === 'B') && hasDominant(g, 'B'),
    fluorescent: g.chromosomes.c1.some((c) => c.alleles.T === 'T+'),
    ploidy: g.ploidy,
    aneuploid,
    seedless: g.ploidy === 3,
    fertile: g.ploidy !== 3,
    giant: g.ploidy >= 4,
  };
  if (aneuploid) p.aneuploidNote = aneuploidNote(g);
  return p;
}

export function suitOf(p: Phenotype): SuitKey {
  return `${p.color}-${p.marked ? 'm' : 'p'}` as SuitKey;
}

/** 이 자리의 사본들이 서로 다른 대립유전자를 갖는가 (형질전환은 '있음/없음'이 섞이면 이형접합) */
export function isHeterozygous(g: Genome, locus: LocusId): boolean {
  const ids = new Set(copiesOfLocus(g, locus).map((c) => c.alleles[locus] ?? '∅'));
  return ids.size > 1;
}

/**
 * 겉모습만으로 유전자형이 확실한 자리.
 *  - 열성 표현형인 멘델 자리: 골드→R, 무늬 없음→S(루미)·L(별다래), 쓴맛 없음→B
 *  - 별다래 수그루의 L (X 가 하나뿐이면 보이는 그대로. XXY·XXYY 는 예외)
 *  - 2배체에서 당도가 최소·최대(이수성이면 −3 을 되돌려 본다)면 Q1~Q6 전부
 *  - 배수체(3n·4n)는 열성 표현형만 확실하다
 */
export function inferableLoci(g: Genome): LocusId[] {
  const def = speciesDef(g.species);
  const p = phenotype(g);
  const out = new Set<LocusId>();
  if (p.color === 'gold') out.add('R');
  if (def.sexSystem === 'XY') {
    const xCount = g.chromosomes.sex.filter((c) => c.kind === 'X').length;
    if (!p.marked || (p.sex === 'M' && xCount === 1)) out.add('L'); // X 하나(반접합)면 보이는 그대로
  } else {
    if (!p.marked) out.add('S');
    if (!p.bitter) out.add('B');
  }
  if (g.ploidy === 2 && p.brix !== null) {
    const base = p.brix + (p.aneuploid ? 3 : 0);
    if (base === 8 || base === 20) for (const q of Q_LOCUS_IDS) out.add(q);
  }
  return def.loci.map((l) => l.id).filter((id) => out.has(id));
}

/** 퍼넷 노트: 시드 난수 몬테카를로로 자손 분포를 어림한다 */
export function expectedDistribution(a: Genome, b: Genome, samples = 4000, seed = 2150): Distribution {
  const rng = makeRng(seed);
  const n = Math.max(1, Math.floor(samples));
  const pod = makePod(a, b, rng, n);
  const suits: Record<SuitKey, number> = { 'ruby-m': 0, 'ruby-p': 0, 'gold-m': 0, 'gold-p': 0 };
  const brixCount: Record<number, number> = {};
  let fruiting = 0;
  let male = 0;
  let seedless = 0;
  let aneuploid = 0;
  for (const z of pod) {
    const p = phenotype(z);
    suits[suitOf(p)]++;
    if (p.sex === 'M') male++;
    if (p.seedless) seedless++;
    if (p.aneuploid) aneuploid++;
    if (p.brix !== null) {
      fruiting++;
      brixCount[p.brix] = (brixCount[p.brix] ?? 0) + 1;
    }
  }
  for (const k of Object.keys(suits) as SuitKey[]) suits[k] /= n;
  const brix: Record<number, number> = {};
  for (const [k, v] of Object.entries(brixCount)) brix[Number(k)] = v / fruiting;
  return { samples: n, suits, brix, male: male / n, seedless: seedless / n, aneuploid: aneuploid / n };
}
