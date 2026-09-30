// 유전 엔진: 멘델 비율·성 연관·배수체·비분리·재현성. 통계 검사는 시드 고정 + 넉넉한 허용 오차.
import { describe, expect, it } from 'vitest';
import * as G from '../src/genetics';
import type { Genome, LocusId, SpeciesId } from '../src/contract/genetics';

const lumi = (s: string): Genome => G.parseGenotype('lumi', s);
const stella = (s: string): Genome => G.parseGenotype('stella', s);
const frac = <T>(xs: T[], pred: (x: T) => boolean): number => xs.filter(pred).length / xs.length;
const pod = (a: Genome, b: Genome, seed: number, n = 4000, p = 0): Genome[] =>
  G.makePod(a, b, G.makeRng(seed), n, { nondisjunction: p });

describe('계약 이름 전부 export', () => {
  it('genetics 객체의 모든 이름이 named export 와 같다', () => {
    const names = Object.keys(G.genetics);
    expect(names.length).toBe(24);
    const mod = G as unknown as Record<string, unknown>;
    for (const k of names) expect(mod[k], k).toBe((G.genetics as unknown as Record<string, unknown>)[k]);
  });
});

describe('시드 난수', () => {
  it('같은 시드 → 같은 수열, [0,1) 범위', () => {
    const a = G.makeRng(42);
    const b = G.makeRng(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(G.makeRng(43)()).not.toBe(G.makeRng(42)());
  });

  it('같은 시드 → 같은 꼬투리, 다른 시드 → 다른 꼬투리', () => {
    const a = lumi('R:Rr S:Ss B:Bb Q1:+- Q2:+- Q3:+- Q4:+- Q5:+- Q6:+-');
    const p1 = pod(a, a, 7, 52).map(G.formatGenotype);
    const p2 = pod(a, a, 7, 52).map(G.formatGenotype);
    const p3 = pod(a, a, 8, 52).map(G.formatGenotype);
    expect(p1).toEqual(p2);
    expect(p1).not.toEqual(p3);
    expect(G.expectedDistribution(a, a, 500, 3)).toEqual(G.expectedDistribution(a, a, 500, 3));
  });
});

describe('멘델 유전 (루미)', () => {
  it('Rr × Rr → 루비:골드 ≈ 3:1', () => {
    const a = lumi('R:Rr');
    const kids = pod(a, lumi('R:Rr'), 1);
    expect(frac(kids, (k) => G.phenotype(k).color === 'gold')).toBeCloseTo(0.25, 1);
    expect(Math.abs(frac(kids, (k) => G.phenotype(k).color === 'gold') - 0.25)).toBeLessThan(0.025);
  });

  it('RrSs × RrSs → 9:3:3:1', () => {
    const kids = pod(lumi('R:Rr S:Ss'), lumi('R:Rr S:Ss'), 2);
    const suits = kids.map((k) => G.suitOf(G.phenotype(k)));
    const f = (s: string) => frac(suits, (x) => x === s);
    expect(Math.abs(f('ruby-m') - 9 / 16)).toBeLessThan(0.03);
    expect(Math.abs(f('ruby-p') - 3 / 16)).toBeLessThan(0.025);
    expect(Math.abs(f('gold-m') - 3 / 16)).toBeLessThan(0.025);
    expect(Math.abs(f('gold-p') - 1 / 16)).toBeLessThan(0.02);
  });

  it('Rr × rr → 1:1 (검정 교배)', () => {
    const kids = pod(lumi('R:Rr'), lumi('R:rr'), 3);
    expect(Math.abs(frac(kids, (k) => G.phenotype(k).color === 'ruby') - 0.5)).toBeLessThan(0.03);
  });

  it('동형접합(순계)끼리 → 꼬투리가 전부 같다', () => {
    const pure = lumi('R:RR S:ss B:BB Q1:++ Q2:++ Q3:-- Q4:++ Q5:-- Q6:++');
    const kids = pod(pure, pure, 4, 52);
    const g0 = G.formatGenotype(kids[0]);
    expect(kids.every((k) => G.formatGenotype(k) === g0)).toBe(true);
    const p0 = G.phenotype(kids[0]);
    expect(kids.every((k) => JSON.stringify(G.phenotype(k)) === JSON.stringify(p0))).toBe(true);
    expect(p0.brix).toBe(8 + 8);
    // RR × rr → F1 전부 Rr (균일)
    const f1 = pod(lumi('R:RR'), lumi('R:rr'), 5, 200);
    expect(f1.every((k) => G.isHeterozygous(k, 'R') && G.phenotype(k).color === 'ruby')).toBe(true);
  });

  it('자가수분을 거듭하면 이형접합 비율이 절반씩 줄어든다', () => {
    const loci: LocusId[] = ['R', 'S', 'B', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'];
    const start = lumi('R:Rr S:Ss B:Bb Q1:+- Q2:+- Q3:+- Q4:+- Q5:+- Q6:+-');
    const rng = G.makeRng(11);
    const lines = 400;
    const gens = 5;
    const hetRate: number[] = [];
    let current: Genome[] = Array.from({ length: lines }, () => G.cloneGenome(start));
    for (let gen = 0; gen <= gens; gen++) {
      const het = current.reduce((s, g) => s + loci.filter((l) => G.isHeterozygous(g, l)).length, 0);
      hetRate.push(het / (lines * loci.length));
      current = current.map((g) => G.makePod(g, g, rng, 1)[0]);
    }
    expect(hetRate[0]).toBe(1);
    for (let gen = 1; gen <= gens; gen++) {
      expect(hetRate[gen]).toBeLessThan(hetRate[gen - 1]);
      expect(Math.abs(hetRate[gen] - 0.5 ** gen)).toBeLessThan(0.04);
    }
  });

  it('같은 염색체 위 R 과 T 도 재조합 0.5 로 독립처럼 나뉜다 (교차가 실제로 돈다)', () => {
    // 1번 염색체 사본0 = R·T+, 사본1 = r·(T 없음) (상인) × rr 검정 교배
    const parent = lumi('R:Rr T:+-');
    const kids = pod(parent, lumi('R:rr'), 6);
    const cls = (ruby: boolean, fl: boolean) =>
      frac(kids, (k) => (G.phenotype(k).color === 'ruby') === ruby && G.phenotype(k).fluorescent === fl);
    for (const [r, f] of [
      [true, true],
      [true, false],
      [false, true],
      [false, false],
    ] as const) {
      expect(Math.abs(cls(r, f) - 0.25)).toBeLessThan(0.03);
    }
  });
});

describe('성염색체 (별다래, XY)', () => {
  const mother = stella('R:Rr L:Ll sex:XX');
  const father = stella('R:Rr L:L sex:XY');

  it('성비 ≈ 1:1, 수그루는 당도 없음', () => {
    const kids = pod(mother, father, 21);
    expect(Math.abs(frac(kids, (k) => G.phenotype(k).sex === 'M') - 0.5)).toBeLessThan(0.03);
    for (const k of kids.slice(0, 200)) {
      const p = G.phenotype(k);
      if (p.sex === 'M') expect(p.brix).toBeNull();
      else expect(p.brix).not.toBeNull();
    }
  });

  it('X^L Y 아비 × X^l X^l 어미 → 딸은 전부 은빛 잎, 아들은 전부 없음', () => {
    const kids = pod(stella('L:ll sex:XX'), stella('L:L sex:XY'), 22, 1000);
    const daughters = kids.filter((k) => G.phenotype(k).sex === 'F');
    const sons = kids.filter((k) => G.phenotype(k).sex === 'M');
    expect(daughters.length).toBeGreaterThan(400);
    expect(sons.length).toBeGreaterThan(400);
    expect(daughters.every((k) => G.phenotype(k).marked)).toBe(true);
    expect(sons.every((k) => !G.phenotype(k).marked)).toBe(true);
  });

  it('canCross: 암수딴그루 규칙', () => {
    expect(G.canCross(mother, father, false).ok).toBe(true);
    expect(G.canCross(father, mother, false).ok).toBe(true);
    const ff = G.canCross(mother, G.cloneGenome(mother), false);
    expect(ff.ok).toBe(false);
    expect(ff.reason).toMatch(/암그루/);
    expect(G.canCross(father, G.cloneGenome(father), false).ok).toBe(false);
    const self = G.canCross(mother, mother, true);
    expect(self.ok).toBe(false);
    expect(self.reason).toMatch(/암수딴그루/);
    expect(() => G.makePod(mother, mother, G.makeRng(1), 3)).toThrow();
  });

  it('canCross: 루미 자가수분 허용, 종이 다르면 불가', () => {
    const a = lumi('R:Rr');
    expect(G.canCross(a, a, true).ok).toBe(true);
    const x = G.canCross(a, mother, false);
    expect(x.ok).toBe(false);
    expect(x.reason).toMatch(/종/);
    expect(() => G.makePod(a, mother, G.makeRng(1), 1)).toThrow();
  });
});

describe('배수체', () => {
  it('콜히친 2n → 4n, 4n 생식세포는 ploidy 2', () => {
    const d = G.doubleGenome(lumi('R:Rr S:Ss'));
    expect(d.ploidy).toBe(4);
    expect(d.chromosomes.c1.length).toBe(4);
    expect(G.describeGenotype(d).startsWith('RRrr SSss')).toBe(true);
    const p = G.phenotype(d);
    expect(p.giant).toBe(true);
    expect(p.aneuploid).toBe(false);
    const gam = G.meiosis(d, G.makeRng(9))!;
    expect(gam.ploidy).toBe(2);
    for (const g of ['c1', 'c2', 'c3', 'c4', 'c5'] as const) expect(gam.chromosomes[g].length).toBe(2);
    // 3배체·4배체는 더 두 배로 하지 않는다
    expect(G.doubleGenome(d).ploidy).toBe(4);
  });

  it('RRrr 자가수분 → 골드(rrrr) ≈ 1/36 (4사본 중 2개 무작위)', () => {
    const d = G.doubleGenome(lumi('R:Rr'));
    const kids = pod(d, d, 31, 6000);
    expect(kids.every((k) => k.ploidy === 4)).toBe(true);
    expect(Math.abs(frac(kids, (k) => G.phenotype(k).color === 'gold') - 1 / 36)).toBeLessThan(0.01);
  });

  it('4n × 2n → 3n: 씨 없음·불임, 감수분열 null, 교배 불가', () => {
    const d = G.doubleGenome(lumi('R:RR'));
    const kids = pod(d, lumi('R:rr'), 32, 100);
    for (const k of kids) {
      expect(k.ploidy).toBe(3);
      const p = G.phenotype(k);
      expect(p.seedless).toBe(true);
      expect(p.fertile).toBe(false);
      expect(p.giant).toBe(false);
      expect(p.aneuploid).toBe(false);
      expect(G.meiosis(k, G.makeRng(1))).toBeNull();
    }
    const tri = kids[0];
    const c = G.canCross(tri, lumi('R:Rr'), false);
    expect(c.ok).toBe(false);
    expect(c.reason).toMatch(/3배체/);
    expect(G.describeGenotype(tri).startsWith('RRr ')).toBe(true);
  });

  it('별다래 4n 수그루(XXYY) × 2n 암그루 → 3n, 수·암 둘 다 나온다', () => {
    const m4 = G.doubleGenome(stella('L:L sex:XY'));
    expect(G.phenotype(m4).sex).toBe('M');
    const kids = pod(stella('L:ll sex:XX'), m4, 33, 600);
    expect(kids.every((k) => k.ploidy === 3)).toBe(true);
    const males = frac(kids, (k) => G.phenotype(k).sex === 'M');
    expect(males).toBeGreaterThan(0.7); // XX·XY·YY = 1:4:1 → Y 있는 쪽 5/6
    expect(males).toBeLessThan(0.93);
  });
});

describe('비분리·이수성', () => {
  // 그룹마다 한 부모가 사본 0·1·2개를 줄 확률 = p/2, 1−p, p/2. 치사(0개)는 버린다.
  const expectedAneuploid = (p: number, groups: number) => {
    const zero = (p / 2) ** 2;
    const two = (1 - p) ** 2 + 2 * (p / 2) ** 2;
    return 1 - (two / (1 - zero)) ** groups;
  };

  it('p = 0.2 에서 이수성 비율 ≈ 기대치(≈0.87)', () => {
    const a = lumi('R:Rr S:Ss');
    const kids = pod(a, a, 41, 4000, 0.2);
    const obs = frac(kids, (k) => G.phenotype(k).aneuploid);
    expect(Math.abs(obs - expectedAneuploid(0.2, 5))).toBeLessThan(0.03);
  });

  it('p = 0.05 에서 이수성 비율 ≈ 기대치(≈0.39)', () => {
    const a = lumi('R:Rr S:Ss');
    const kids = pod(a, a, 42, 4000, 0.05);
    const obs = frac(kids, (k) => G.phenotype(k).aneuploid);
    expect(Math.abs(obs - expectedAneuploid(0.05, 5))).toBeLessThan(0.03);
  });

  it('비분리가 잦아도 전무 염색체(사본 0개) 씨앗은 나오지 않는다', () => {
    const a = lumi('R:Rr');
    const kids = pod(a, a, 43, 2000, 0.5);
    for (const k of kids) for (const g of ['c1', 'c2', 'c3', 'c4', 'c5'] as const) expect(k.chromosomes[g].length).toBeGreaterThan(0);
    const s = pod(stella('sex:XX'), stella('sex:XY'), 44, 2000, 0.5);
    for (const k of s) {
      for (const g of ['c1', 'c2', 'c3'] as const) expect(k.chromosomes[g].length).toBeGreaterThan(0);
      expect(k.chromosomes.sex.some((c) => c.kind === 'X')).toBe(true);
    }
  });

  it('이수성 표현형: 당도 −3, 설명 문장', () => {
    const tri = lumi('R:Rr Q1:+++ Q2:+++'); // 3번 염색체 3개
    const p = G.phenotype(tri);
    expect(tri.ploidy).toBe(2);
    expect(p.aneuploid).toBe(true);
    expect(p.aneuploidNote).toBe('3번 염색체가 3개(삼염색체)');
    // Q 사본 14개 중 + 6개 → 8 + round(12×6/14) − 3
    expect(p.brix).toBe(8 + Math.round((12 * 6) / 14) - 3);
    const xxy = stella('R:rr sex:XXY L:Ll'); // 상염색체 토큰이 기본 배수성(2)을 정한다
    const px = G.phenotype(xxy);
    expect(px.sex).toBe('M');
    expect(px.aneuploidNote).toBe('성염색체가 3개(XXY)');
    expect(G.phenotype(stella('R:Rr sex:X L:L')).aneuploidNote).toBe('성염색체가 1개(XO)');
    expect(G.phenotype(lumi('R:R S:Ss')).aneuploidNote).toBe('1번 염색체가 1개(일염색체)');
  });

  it('생식세포: 비분리면 그 그룹 사본이 2개 또는 0개', () => {
    const a = lumi('R:Rr');
    const rng = G.makeRng(45);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const gam = G.meiosis(a, rng, { nondisjunction: 1 })!;
      for (const g of ['c1', 'c2', 'c3', 'c4', 'c5'] as const) seen.add(gam.chromosomes[g].length);
    }
    expect([...seen].sort()).toEqual([0, 2]);
    const normal = G.meiosis(a, G.makeRng(1))!;
    expect(normal.ploidy).toBe(1);
    for (const g of ['c1', 'c2', 'c3', 'c4', 'c5'] as const) expect(normal.chromosomes[g].length).toBe(1);
  });
});

describe('퍼넷 노트 (expectedDistribution)', () => {
  it('Rr × Rr: 골드 ≈ 1/4, 비율 합 1, 당도는 열매 맺는 개체만', () => {
    const a = lumi('R:Rr Q1:+-');
    const d = G.expectedDistribution(a, a);
    expect(d.samples).toBe(4000);
    const gold = d.suits['gold-m'] + d.suits['gold-p'];
    expect(Math.abs(gold - 0.25)).toBeLessThan(0.025);
    const sumSuits = Object.values(d.suits).reduce((s, x) => s + x, 0);
    expect(sumSuits).toBeCloseTo(1, 9);
    const sumBrix = Object.values(d.brix).reduce((s, x) => s + x, 0);
    expect(sumBrix).toBeCloseTo(1, 9);
    // Q1 +- 자가: + 개수 0·1·2 = 1:2:1 → 당도 8·9·10
    expect(Object.keys(d.brix).map(Number).sort((x, y) => x - y)).toEqual([8, 9, 10]);
    expect(Math.abs(d.brix[9] - 0.5)).toBeLessThan(0.03);
    expect(d.male).toBe(0);
    expect(d.seedless).toBe(0);
    expect(d.aneuploid).toBe(0);
  });

  it('별다래: 수그루 ≈ 1/2, 3배체 조합은 seedless 1', () => {
    const d = G.expectedDistribution(stella('sex:XX'), stella('sex:XY'), 2000, 5);
    expect(Math.abs(d.male - 0.5)).toBeLessThan(0.04);
    const t = G.expectedDistribution(G.doubleGenome(lumi('R:Rr')), lumi('R:rr'), 500, 5);
    expect(t.seedless).toBe(1);
  });
});

describe('형질전환 (T+)', () => {
  it('1번 염색체 사본 하나에 T+ 삽입, 형광, 자가수분 자손 ≈ 3/4 형광', () => {
    const a = lumi('R:Rr');
    const t = G.addTransgene(a, G.makeRng(3));
    expect(t.chromosomes.c1.filter((c) => c.alleles.T === 'T+').length).toBe(1);
    expect(a.chromosomes.c1.some((c) => c.alleles.T === 'T+')).toBe(false); // 원본 그대로
    expect(G.phenotype(t).fluorescent).toBe(true);
    expect(G.formatGenotype(t)).toMatch(/T:(\+-|-\+)$/);
    expect(G.describeGenotype(t).endsWith(' · 형광 T+')).toBe(true);
    expect(G.isHeterozygous(t, 'T')).toBe(true);
    const kids = pod(t, t, 51, 4000);
    expect(Math.abs(frac(kids, (k) => G.phenotype(k).fluorescent) - 0.75)).toBeLessThan(0.03);
    const both = G.addTransgene(t, G.makeRng(4));
    expect(both.chromosomes.c1.every((c) => c.alleles.T === 'T+')).toBe(true);
    expect(G.addTransgene(both, G.makeRng(5)).chromosomes.c1.length).toBe(2);
  });
});

describe('종 정의', () => {
  const chromCount = (id: SpeciesId) =>
    G.SPECIES[id].chromosomes.filter((c) => c.kind !== 'Y').length * 2;
  it('루미 2n=10 양성화, 별다래 2n=8 XY', () => {
    expect(G.SPECIES.lumi.sexSystem).toBe('hermaphrodite');
    expect(chromCount('lumi')).toBe(10);
    expect(G.SPECIES.stella.sexSystem).toBe('XY');
    expect(chromCount('stella')).toBe(8);
    expect(G.SPECIES.lumi.recombination).toBe(0.5);
    expect(G.SPECIES.stella.alleles.some((a) => a.locus === 'B')).toBe(false);
    const g = lumi('');
    expect(g.chromosomes.sex).toEqual([]);
    expect(stella('').chromosomes.c4).toEqual([]);
    expect(stella('').chromosomes.c5).toEqual([]);
  });
});
