// 유전형 문자열·요약·표현형·추론 가능 자리, 그리고 소스 위생(Math.random·innerHTML 없음).
import { describe, expect, it } from 'vitest';
import * as G from '../src/genetics';
import type { Genome } from '../src/contract/genetics';

const lumi = (s: string): Genome => G.parseGenotype('lumi', s);
const stella = (s: string): Genome => G.parseGenotype('stella', s);

describe('parseGenotype / formatGenotype', () => {
  it('생략한 자리는 열성·− 동형접합으로 채운다', () => {
    const g = lumi('R:Rr');
    expect(g.ploidy).toBe(2);
    expect(G.formatGenotype(g)).toBe('R:Rr S:ss B:bb Q1:-- Q2:-- Q3:-- Q4:-- Q5:-- Q6:--');
    expect(g.chromosomes.c1[0].alleles).toEqual({ R: 'R' });
    expect(g.chromosomes.c1[1].alleles).toEqual({ R: 'r' });
    expect(g.chromosomes.c3[0].alleles).toEqual({ Q1: 'Q1-', Q2: 'Q2-' });
  });

  it('i번째 글자 = i번째 사본 (같은 염색체 위 자리끼리 같은 사본)', () => {
    const g = lumi('S:Ss B:bB Q1:+- Q2:-+');
    expect(g.chromosomes.c2[0].alleles).toEqual({ S: 'S', B: 'b' });
    expect(g.chromosomes.c2[1].alleles).toEqual({ S: 's', B: 'B' });
    expect(g.chromosomes.c3[0].alleles).toEqual({ Q1: 'Q1+', Q2: 'Q2-' });
  });

  it('별다래: sex 토큰, L 은 X 사본에만', () => {
    const f = stella('R:Rr L:Ll sex:XX');
    expect(f.chromosomes.sex.map((c) => c.kind)).toEqual(['X', 'X']);
    expect(f.chromosomes.sex.map((c) => c.alleles.L)).toEqual(['L', 'l']);
    const m = stella('L:l sex:YX');
    expect(m.chromosomes.sex[0]).toEqual({ group: 'sex', kind: 'Y', alleles: {} });
    expect(m.chromosomes.sex[1].alleles.L).toBe('l');
    expect(G.formatGenotype(m)).toBe('R:rr L:l Q1:-- Q2:-- Q3:-- Q4:-- Q5:-- Q6:-- sex:YX');
    // sex 를 빼면 L 글자 수로 X 수를 정한다
    expect(G.phenotype(stella('L:L')).sex).toBe('M');
    expect(G.phenotype(stella('L:Ll')).sex).toBe('F');
    expect(G.phenotype(stella('')).sex).toBe('F');
  });

  it('T 토큰은 T+ 가 있을 때만 쓴다', () => {
    expect(G.formatGenotype(lumi('R:Rr T:--'))).not.toContain('T:');
    expect(G.formatGenotype(lumi('R:Rr T:-+'))).toMatch(/ T:-\+$/);
    expect(lumi('T:+-').chromosomes.c1[1].alleles.T).toBeUndefined();
  });

  it('배수체: 글자 수가 곧 사본 수', () => {
    const g = lumi('R:RRrr S:SSss');
    expect(g.ploidy).toBe(4);
    expect(g.chromosomes.c3.length).toBe(4);
    expect(G.phenotype(g).aneuploid).toBe(false);
    expect(G.describeGenotype(g)).toBe('RRrr SSss bbbb · 당도+ 0/24');
  });

  it('왕복: parse → format → parse 가 같다', () => {
    const specs: [('lumi' | 'stella'), string][] = [
      ['lumi', 'R:Rr S:Ss B:bb Q1:++ Q2:+- Q3:-+ Q4:-- Q5:++ Q6:+-'],
      ['lumi', 'R:R′r B:B′b T:+-'],
      ['lumi', "R:R'R"],
      ['lumi', 'R:RRrr S:SSss B:Bbbb Q1:++-- T:+--+'],
      ['lumi', 'R:RRr S:Sss B:bbb'],
      ['lumi', 'R:Rrr S:Ss'],
      ['stella', 'R:Rr L:Ll sex:XX Q4:+-'],
      ['stella', 'R:rr L:L sex:XY T:-+'],
      ['stella', 'R:Rr L:Ll sex:XXY'],
      ['stella', 'R:RRrr L:LLl sex:XXXY'],
    ];
    for (const [sp, spec] of specs) {
      const a = G.parseGenotype(sp, spec);
      const s = G.formatGenotype(a);
      const b = G.parseGenotype(sp, s);
      expect(b, spec).toEqual(a);
      expect(G.formatGenotype(b)).toBe(s);
    }
  });

  it('엔진이 만든 자손(이수성·배수체 포함)도 문자열로 옮겼다 되돌리면 염색체가 그대로다', () => {
    // 문법에 기본 배수성 표기가 없어서, 그룹 절반 이상이 이수성인 경우만 배수성 어림이 모호하다.
    const rng = G.makeRng(71);
    const parents: [Genome, Genome][] = [
      [lumi('R:Rr S:Ss B:Bb Q1:+- Q3:+- Q5:-+ T:+-'), lumi('R:Rr S:sS B:bB Q2:++ Q4:+-')],
      [stella('R:Rr L:Ll sex:XX Q1:+-'), stella('R:rR L:L sex:XY Q6:++')],
      [G.doubleGenome(lumi('R:Rr S:Ss')), lumi('R:rr')],
      [G.doubleGenome(lumi('R:Rr Q1:+-')), G.doubleGenome(lumi('S:Ss'))],
    ];
    let checked = 0;
    for (const [a, b] of parents) {
      for (const z of G.makePod(a, b, rng, 150, { nondisjunction: 0.1 })) {
        const s = G.formatGenotype(z);
        const back = G.parseGenotype(z.species, s);
        expect(back.chromosomes).toEqual(G.cloneGenome(z).chromosomes);
        expect(G.formatGenotype(back)).toBe(s);
        const groups = Object.values(z.chromosomes).filter((c) => c.length > 0); // 종에 있는 그룹 (치사는 이미 버려짐)
        const matching = groups.filter((c) => c.length === z.ploidy).length;
        if (matching * 2 > groups.length) {
          expect(back.ploidy).toBe(z.ploidy);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(450);
  });

  it('잘못된 문자열은 에러', () => {
    expect(() => lumi('R:Rx')).toThrow();
    expect(() => lumi('Z:zz')).toThrow();
    expect(() => lumi('L:Ll')).toThrow(); // 루미에는 L 없음
    expect(() => lumi('sex:XY')).toThrow();
    expect(() => lumi('Q1:+- Q2:+')).toThrow(); // 같은 염색체인데 글자 수가 다름
    expect(() => lumi('R:Rr R:rr')).toThrow();
    expect(() => stella('L:Ll sex:XY')).toThrow(); // X 가 하나인데 L 두 글자
    expect(() => lumi('Rr')).toThrow();
  });

  it('cloneGenome 은 깊은 복사', () => {
    const g = lumi('R:Rr');
    const c = G.cloneGenome(g);
    c.chromosomes.c1[0].alleles.R = 'r';
    expect(g.chromosomes.c1[0].alleles.R).toBe('R');
  });
});

describe('describeGenotype', () => {
  it('루미·별다래 암·수 예시', () => {
    expect(G.describeGenotype(lumi('R:rR S:Ss B:bb Q1:++ Q2:++ Q3:++ Q4:+- Q5:-- Q6:--'))).toBe('Rr Ss bb · 당도+ 7/12');
    expect(G.describeGenotype(stella('R:Rr L:lL sex:XX Q1:++ Q2:++ Q3:++ Q4:+-'))).toBe('Rr · 당도+ 7/12 · XX Ll');
    expect(G.describeGenotype(stella('R:Rr L:L sex:YX Q1:++ Q2:++ Q3:+-'))).toBe('Rr · 당도+ 5/12 · XY L');
    expect(G.describeGenotype(lumi('R:rR′ T:-+'))).toBe('R′r ss bb · 당도+ 0/12 · 형광 T+');
  });
});

describe('phenotype', () => {
  it('당도 = 8 + round(12 × + 비율), 수그루는 null', () => {
    expect(G.phenotype(lumi('')).brix).toBe(8);
    const all = lumi('Q1:++ Q2:++ Q3:++ Q4:++ Q5:++ Q6:++');
    expect(G.phenotype(all).brix).toBe(20);
    expect(G.phenotype(all).plusFraction).toBe(1);
    expect(G.phenotype(lumi('Q1:++ Q2:++ Q3:++ Q4:+-')).brix).toBe(15);
    expect(G.phenotype(stella('sex:XY Q1:++')).brix).toBeNull();
    expect(G.phenotype(stella('sex:XY Q1:++')).plusFraction).toBeCloseTo(2 / 12);
  });

  it('색·무늬·쓴맛·형광·성·배수성', () => {
    const p = G.phenotype(lumi('R:Rr S:ss B:Bb T:+-'));
    expect(p).toMatchObject({
      species: 'lumi', sex: 'H', color: 'ruby', marked: false, bitter: true, fluorescent: true,
      ploidy: 2, aneuploid: false, seedless: false, fertile: true, giant: false,
    });
    expect(p.aneuploidNote).toBeUndefined();
    expect(G.suitOf(p)).toBe('ruby-p');
    const s = G.phenotype(stella('R:rr L:Ll sex:XX'));
    expect(s).toMatchObject({ sex: 'F', color: 'gold', marked: true, bitter: false });
    expect(G.suitOf(s)).toBe('gold-m');
  });

  it('isHeterozygous', () => {
    const g = lumi('R:Rr S:SS Q1:+-');
    expect(G.isHeterozygous(g, 'R')).toBe(true);
    expect(G.isHeterozygous(g, 'S')).toBe(false);
    expect(G.isHeterozygous(g, 'Q1')).toBe(true);
    expect(G.isHeterozygous(g, 'T')).toBe(false);
    expect(G.isHeterozygous(g, 'L')).toBe(false); // 루미에 없는 자리
    expect(G.isHeterozygous(stella('L:L sex:XY'), 'L')).toBe(false); // 반접합
    expect(G.isHeterozygous(stella('L:Ll sex:XX'), 'L')).toBe(true);
  });
});

describe('inferableLoci (겉모습만으로 확실한 자리)', () => {
  it('열성 표현형 + 당도 최소면 전부', () => {
    expect(G.inferableLoci(lumi('R:rr S:ss B:bb'))).toEqual(['R', 'S', 'B', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  });
  it('우성 표현형·중간 당도는 모름', () => {
    expect(G.inferableLoci(lumi('R:Rr S:Ss B:Bb Q1:+-'))).toEqual([]);
    expect(G.inferableLoci(lumi('R:Rr S:SS B:bb Q1:+-'))).toEqual(['B']);
  });
  it('당도 최대(20)도 확실, 이수성이면 −3 을 되돌려 본다', () => {
    expect(G.inferableLoci(lumi('R:RR S:SS B:BB Q1:++ Q2:++ Q3:++ Q4:++ Q5:++ Q6:++'))).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
    expect(G.inferableLoci(lumi('R:RRR S:SS B:BB'))).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6']);
  });
  it('별다래: 수그루의 L 은 늘 확실, 암그루는 무늬 없을 때만', () => {
    expect(G.inferableLoci(stella('R:Rr L:L sex:XY'))).toEqual(['L']);
    expect(G.inferableLoci(stella('R:Rr L:l sex:XY'))).toEqual(['L']);
    expect(G.inferableLoci(stella('R:Rr L:Ll sex:XX Q1:+-'))).toEqual([]);
    expect(G.inferableLoci(stella('R:Rr L:ll sex:XX Q1:+-'))).toEqual(['L']);
    expect(G.inferableLoci(stella('R:Rr L:Ll sex:XXY Q1:+-'))).toEqual([]); // X 가 둘이면 반접합 아님
    expect(G.inferableLoci(G.doubleGenome(stella('R:Rr L:L sex:XY')))).toEqual([]);
  });
  it('배수체는 열성 표현형만 확실 (당도 추론 없음)', () => {
    expect(G.inferableLoci(lumi('R:rrrr S:SSss B:bbbb'))).toEqual(['R', 'B']);
  });
});

describe('소스 위생', () => {
  it('src/genetics 에 Math.random·innerHTML 계열이 없다', () => {
    // Vite 의 glob 가져오기로 원문을 읽는다 (@types/node 없이)
    const sources = import.meta.glob('../src/genetics/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const f of files) {
      expect(sources[f], f).toMatch(/export /); // 원문이 실제로 읽혔는지
      expect(sources[f], f).not.toMatch(/Math\.random/);
      expect(sources[f], f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
    }
  });
});
