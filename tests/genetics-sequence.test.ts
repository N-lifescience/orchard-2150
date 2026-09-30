// 편집 작업대: 유전 부호·전사·번역·돌연변이 판정·편집 결과의 표현형.
import { describe, expect, it } from 'vitest';
import * as G from '../src/genetics';
import type { AminoAcid, Genome } from '../src/contract/genetics';
import { ACTIVE_B, ACTIVE_R, SEQ_B, SEQ_R, SEQ_b, SEQ_r } from '../src/genetics/species';

const lumi = (s: string): Genome => G.parseGenotype('lumi', s);
const sub = (s: string, i: number, b: string) => s.slice(0, i) + b + s.slice(i + 1);
const del = (s: string, i: number, n = 1) => s.slice(0, i) + s.slice(i + n);
const ins = (s: string, i: number, b: string) => s.slice(0, i) + b + s.slice(i);
const codonsOf = (dna: string) => dna.match(/.../g) ?? [];

describe('유전 부호 표', () => {
  it('표준 64코돈, 종결 3개, 아미노산 20종(교과서 표기)', () => {
    const entries = Object.entries(G.CODON_TABLE);
    expect(entries.length).toBe(64);
    expect(entries.every(([k]) => /^[UCAG]{3}$/.test(k))).toBe(true);
    const stops = entries.filter(([, v]) => v === 'STOP').map(([k]) => k).sort();
    expect(stops).toEqual(['UAA', 'UAG', 'UGA']);
    const aas = new Set(entries.filter(([, v]) => v !== 'STOP').map(([, v]) => (v as AminoAcid).code3));
    expect(aas.size).toBe(20);
    const aug = G.CODON_TABLE.AUG as AminoAcid;
    expect(aug).toEqual({ code3: 'Met', code1: 'M', nameKo: '메싸이오닌' });
    expect((G.CODON_TABLE.GCU as AminoAcid).nameKo).toBe('알라닌');
    expect((G.CODON_TABLE.UGG as AminoAcid).code3).toBe('Trp');
    expect((G.CODON_TABLE.AGA as AminoAcid).nameKo).toBe('아르지닌');
    expect((G.CODON_TABLE.CUG as AminoAcid).code1).toBe('L');
    // 코돈 수: Leu·Ser·Arg 6개, Met·Trp 1개
    const count = (c3: string) => entries.filter(([, v]) => v !== 'STOP' && v.code3 === c3).length;
    expect([count('Leu'), count('Ser'), count('Arg'), count('Met'), count('Trp')]).toEqual([6, 6, 6, 1, 1]);
  });

  it('전사 T→U, 주형 가닥은 상보 염기', () => {
    expect(G.transcribe('ATGGCTTAA')).toBe('AUGGCUUAA');
    expect(G.templateStrand('ATGC')).toBe('TACG');
    expect(G.templateStrand(SEQ_R).length).toBe(SEQ_R.length);
    expect(G.templateStrand(G.templateStrand(SEQ_B))).toBe(SEQ_B);
  });

  it('번역은 문자열 처음부터 세 글자씩, 첫 종결 코돈에서 stopAt', () => {
    const t = G.translate('AUGGCUUAAGGG');
    expect(t.codons).toEqual(['AUG', 'GCU', 'UAA', 'GGG']);
    expect(t.stopAt).toBe(2);
    expect((t.aminoAcids[1] as AminoAcid).code3).toBe('Ala');
    expect(t.aminoAcids[2]).toBe('STOP');
    // AUG 를 찾아가지 않는다: 첫 글자부터 끊음
    const u = G.translate('GAUGGC');
    expect(u.codons).toEqual(['GAU', 'GGC']);
    expect(u.stopAt).toBeNull();
    // 남는 글자는 코돈이 아님, DNA 도 받는다
    expect(G.translate('ATGGC').codons).toEqual(['AUG']);
    expect(() => G.translate('AUGXYZ')).toThrow();
  });
});

describe('기준 서열 설계 (R, B)', () => {
  const canStop = (codon: string) =>
    [0, 1, 2].some((p) => 'ACGT'.split('').some((b) => b !== codon[p] && ['TAA', 'TAG', 'TGA'].includes(sub(codon, p, b))));
  const wobble = (codon: string) => {
    const aa = G.CODON_TABLE[G.transcribe(codon)];
    return 'ACGT'.split('').some((b) => b !== codon[2] && G.CODON_TABLE[G.transcribe(sub(codon, 2, b))] === aa);
  };
  for (const [name, seq, active] of [
    ['R', SEQ_R, ACTIVE_R],
    ['B', SEQ_B, ACTIVE_B],
  ] as const) {
    it(`${name}: ATG 시작, 10코돈 + 종결(33nt), 종결 가능 코돈 ≥3, 동의 치환 쉬운 코돈 ≥2`, () => {
      expect(seq.length).toBe(33);
      expect(seq.startsWith('ATG')).toBe(true);
      const t = G.translate(G.transcribe(seq));
      expect(t.stopAt).toBe(10);
      const sense = codonsOf(seq).slice(1, 10);
      expect(sense.filter(canStop).length).toBeGreaterThanOrEqual(3);
      expect(sense.filter(wobble).length).toBeGreaterThanOrEqual(2);
      expect(active).toBeGreaterThan(0);
      expect(active).toBeLessThan(10);
    });
  }

  it('SPECIES 에 서열·핵심 자리가 들어 있다', () => {
    for (const sp of ['lumi', 'stella'] as const) {
      const a = (id: string) => G.SPECIES[sp].alleles.find((x) => x.id === id);
      expect(a('R')?.seq).toBe(SEQ_R);
      expect(a('r')?.seq).toBe(SEQ_r);
      expect(a('R*ko')?.functional).toBe(false);
      expect(G.SPECIES[sp].loci.find((l) => l.id === 'R')?.activeCodon).toBe(ACTIVE_R);
    }
    expect(G.SPECIES.lumi.alleles.find((x) => x.id === 'b')?.seq).toBe(SEQ_b);
    expect(G.SPECIES.lumi.loci.find((l) => l.id === 'B')?.activeCodon).toBe(ACTIVE_B);
  });
});

describe('analyzeCoding: 돌연변이 판정', () => {
  it('기준 그대로 → none', () => {
    const r = G.analyzeCoding('R', 'lumi', SEQ_R);
    expect(r.kind).toBe('none');
    expect(r.functional).toBe(true);
    expect(r.protein).toEqual(['Met', 'Ala', 'Trp', 'Gln', 'Lys', 'Gly', 'Tyr', 'His', 'Glu', 'Leu']);
  });

  it('자연 대립유전자 r = 난센스, b = 틀 이동', () => {
    const r = G.analyzeCoding('R', 'lumi', SEQ_r);
    expect(r.kind).toBe('nonsense');
    expect(r.functional).toBe(false);
    expect(r.protein).toEqual(['Met', 'Ala', 'Trp']);
    expect(r.note).toBe('4번째 코돈이 UAG(종결 코돈)가 되어 단백질이 짧게 끊겼어요');
    const b = G.analyzeCoding('B', 'lumi', SEQ_b);
    expect(SEQ_b.length).toBe(32);
    expect(b.kind).toBe('frameshift');
    expect(b.functional).toBe(false);
    expect(b.protein).toEqual(['Met', 'Ser', 'Gly', 'Trp', 'Glu', 'Asp', 'Ser']);
    expect(b.note).toMatch(/빠져 6번째 코돈부터 읽는 틀이 밀리고/);
  });

  it('치환으로 종결 코돈 → nonsense', () => {
    const r = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 7, 'A')); // TGG → TAG
    expect(r.kind).toBe('nonsense');
    expect(r.protein).toEqual(['Met', 'Ala']);
    const b = G.analyzeCoding('B', 'lumi', sub(SEQ_B, 22, 'A')); // 8번째 코돈 CTG → CAG (Leu→Gln), 핵심 자리 아님
    expect(b.kind).toBe('missense');
    expect(b.functional).toBe(true);
    const b2 = G.analyzeCoding('B', 'lumi', sub(SEQ_B, 24, 'T')); // AAA → TAA
    expect(b2.kind).toBe('nonsense');
    expect(b2.functional).toBe(false);
  });

  it('동의 치환 → synonymous, 기능 유지 (핵심 자리도 같은 아미노산이면 유지)', () => {
    const r = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 5, 'C')); // GCT → GCC
    expect(r.kind).toBe('synonymous');
    expect(r.functional).toBe(true);
    expect(r.note).toContain('알라닌');
    const act = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 23, 'C')); // 핵심 CAT → CAC (His)
    expect(act.kind).toBe('synonymous');
    expect(act.functional).toBe(true);
    const stop = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 32, 'G')); // UAA → UAG
    expect(stop.kind).toBe('synonymous');
  });

  it('과오 치환: 핵심 자리면 기능 상실, 아니면 유지', () => {
    const act = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 21, 'A')); // CAT → AAT (His → Asn)
    expect(act.kind).toBe('missense');
    expect(act.functional).toBe(false);
    expect(act.note).toBe('핵심 자리인 8번째 코돈의 히스티딘이 아스파라진으로 바뀌어 효소가 기능을 잃었어요');
    const other = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 3, 'C')); // GCT → CCT (Ala → Pro)
    expect(other.kind).toBe('missense');
    expect(other.functional).toBe(true);
    expect(other.note).toContain('핵심 자리가 아니라');
    const bAct = G.analyzeCoding('B', 'lumi', sub(SEQ_B, 16, 'A')); // CGA → CAA (Arg → Gln)
    expect(bAct.kind).toBe('missense');
    expect(bAct.functional).toBe(false);
  });

  it('시작 코돈이 망가지면 startLost', () => {
    const r = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 2, 'A'));
    expect(r.kind).toBe('startLost');
    expect(r.functional).toBe(false);
    expect(r.protein).toEqual([]);
  });

  it('틀 이동: 한 염기 결실·삽입', () => {
    for (const s of [del(SEQ_R, 13), ins(SEQ_R, 4, 'G'), del(SEQ_B, 4), del(SEQ_R, 29)]) {
      const r = G.analyzeCoding(s.startsWith('ATGG') ? 'R' : 'B', 'lumi', s);
      expect(r.kind).toBe('frameshift');
      expect(r.functional).toBe(false);
    }
  });

  it('세 염기(코돈 하나) 결실은 틀 이동이 아니다', () => {
    const one = G.analyzeCoding('B', 'lumi', del(SEQ_B, 3, 3)); // Ser 빠짐
    expect(one.kind).toBe('missense');
    expect(one.functional).toBe(true);
    const act = G.analyzeCoding('B', 'lumi', del(SEQ_B, 15, 3)); // 핵심 Arg 빠짐 (AA 사이라 결실 자리가 모호해도)
    expect(act.kind).toBe('missense');
    expect(act.functional).toBe(false);
    const stopIns = G.analyzeCoding('B', 'lumi', ins(SEQ_B, 9, 'TAA'));
    expect(stopIns.kind).toBe('nonsense');
  });

  it('종결 코돈을 없애면 기능 상실, 종결 뒤 변화는 무해', () => {
    const lost = G.analyzeCoding('R', 'lumi', sub(SEQ_R, 30, 'C')); // UAA → CAA
    expect(lost.kind).toBe('missense');
    expect(lost.functional).toBe(false);
    const tail = G.analyzeCoding('R', 'lumi', SEQ_R + 'G');
    expect(tail.kind).toBe('synonymous');
    expect(tail.functional).toBe(true);
  });

  it('이른 종결이 먼저면 뒤쪽 결실이 있어도 nonsense', () => {
    const r = G.analyzeCoding('R', 'lumi', del(sub(SEQ_R, 7, 'A'), 25));
    expect(r.kind).toBe('nonsense');
    expect(r.protein).toEqual(['Met', 'Ala']);
  });

  it('소문자·U·공백도 받는다, 잘못된 글자·편집 불가 자리는 에러', () => {
    expect(G.analyzeCoding('R', 'lumi', G.transcribe(SEQ_R).toLowerCase()).kind).toBe('none');
    expect(() => G.analyzeCoding('R', 'lumi', 'ATGXX')).toThrow();
    expect(() => G.analyzeCoding('S', 'lumi', SEQ_R)).toThrow();
    expect(() => G.analyzeCoding('B', 'stella', SEQ_B)).toThrow();
  });

  it('note 는 해요체 한국어 한 문장', () => {
    for (const s of [SEQ_R, SEQ_r, sub(SEQ_R, 5, 'C'), sub(SEQ_R, 21, 'A'), sub(SEQ_R, 3, 'C'), sub(SEQ_R, 2, 'A'), del(SEQ_R, 13)]) {
      const n = G.analyzeCoding('R', 'lumi', s).note;
      expect(n).toMatch(/[가-힣]/);
      expect(n.endsWith('요')).toBe(true);
    }
  });
});

describe('editCoding: 편집 → 대립유전자 → 표현형', () => {
  it('Rr 의 R 사본에 종결 코돈 → R*ko → 골드, 원본은 그대로', () => {
    const g = lumi('R:Rr');
    expect(G.phenotype(g).color).toBe('ruby');
    const seq = G.codingSeq(g, 'c1', 0, 'R');
    expect(seq).toBe(SEQ_R);
    const { genome, result } = G.editCoding(g, 'c1', 0, 'R', sub(seq!, 7, 'A'));
    expect(result.kind).toBe('nonsense');
    expect(genome.chromosomes.c1[0].alleles.R).toBe('R*ko');
    expect(G.phenotype(genome).color).toBe('gold');
    expect(G.describeGenotype(genome).startsWith('R′r')).toBe(true);
    expect(G.formatGenotype(genome)).toContain('R:R′r');
    expect(G.codingSeq(genome, 'c1', 0, 'R')).toBe(sub(SEQ_R, 7, 'A'));
    expect(g.chromosomes.c1[0].alleles.R).toBe('R'); // 원본 불변
    expect(G.inferableLoci(genome)).toContain('R');
  });

  it('RR 에서 한 사본만 망가뜨리면 여전히 루비 (우성)', () => {
    const g = lumi('R:RR');
    const { genome } = G.editCoding(g, 'c1', 1, 'R', sub(SEQ_R, 7, 'A'));
    expect(G.phenotype(genome).color).toBe('ruby');
    expect(G.isHeterozygous(genome, 'R')).toBe(true);
  });

  it('동의 치환은 기능 유지 → R 그대로, 서열은 기록', () => {
    const g = lumi('R:Rr');
    const { genome, result } = G.editCoding(g, 'c1', 0, 'R', sub(SEQ_R, 5, 'C'));
    expect(result.kind).toBe('synonymous');
    expect(genome.chromosomes.c1[0].alleles.R).toBe('R');
    expect(genome.chromosomes.c1[0].seqs?.R).toBe(sub(SEQ_R, 5, 'C'));
    expect(G.phenotype(genome).color).toBe('ruby');
  });

  it('핵심 자리 과오 치환 → KO → 골드', () => {
    const g = lumi('R:Rr');
    const { genome } = G.editCoding(g, 'c1', 0, 'R', sub(SEQ_R, 21, 'A'));
    expect(genome.chromosomes.c1[0].alleles.R).toBe('R*ko');
    expect(G.phenotype(genome).color).toBe('gold');
  });

  it('r 을 되살리는 편집 → R → 루비 (정확히 되돌리면 서열 기록도 지운다)', () => {
    const g = lumi('R:rr');
    expect(G.phenotype(g).color).toBe('gold');
    const back = G.editCoding(g, 'c1', 0, 'R', sub(SEQ_r, 9, 'C')); // UAG → CAG
    expect(back.result.kind).toBe('none');
    expect(back.genome.chromosomes.c1[0].alleles.R).toBe('R');
    expect(back.genome.chromosomes.c1[0].seqs).toBeUndefined();
    expect(G.phenotype(back.genome).color).toBe('ruby');
    const trp = G.editCoding(g, 'c1', 1, 'R', sub(SEQ_r, 10, 'G')); // UAG → UGG (Trp)
    expect(trp.result.kind).toBe('missense');
    expect(trp.genome.chromosomes.c1[1].alleles.R).toBe('R');
    expect(G.phenotype(trp.genome).color).toBe('ruby');
  });

  it('b 에 염기를 다시 끼워 넣으면 쓴맛이 돌아온다 (다른 염기여도 AGA=Arg 면 동의)', () => {
    const g = lumi('B:bb');
    expect(G.phenotype(g).bitter).toBe(false);
    const exact = G.editCoding(g, 'c2', 0, 'B', ins(SEQ_b, 15, 'C'));
    expect(exact.result.kind).toBe('none');
    expect(G.phenotype(exact.genome).bitter).toBe(true);
    const syn = G.editCoding(g, 'c2', 0, 'B', ins(SEQ_b, 15, 'A'));
    expect(syn.result.kind).toBe('synonymous');
    expect(syn.genome.chromosomes.c2[0].alleles.B).toBe('B');
  });

  it('BB 두 사본 모두 틀 이동 → 쓴맛 없음', () => {
    let g = lumi('B:BB');
    g = G.editCoding(g, 'c2', 0, 'B', del(SEQ_B, 15)).genome;
    expect(G.phenotype(g).bitter).toBe(true);
    g = G.editCoding(g, 'c2', 1, 'B', del(SEQ_B, 15)).genome;
    expect(G.phenotype(g).bitter).toBe(false);
    expect(G.formatGenotype(g)).toContain('B:B′B′');
  });

  it('편집한 서열은 감수분열로 자손에게 전해진다', () => {
    const edited = G.editCoding(lumi('R:RR'), 'c1', 0, 'R', sub(SEQ_R, 7, 'A')).genome;
    const kids = G.makePod(edited, edited, G.makeRng(61), 200);
    const ko = kids.flatMap((k) => k.chromosomes.c1).filter((c) => c.alleles.R === 'R*ko');
    expect(ko.length).toBeGreaterThan(100);
    expect(ko.every((c) => c.seqs?.R === sub(SEQ_R, 7, 'A'))).toBe(true);
    const gold = kids.filter((k) => G.phenotype(k).color === 'gold').length / kids.length;
    expect(Math.abs(gold - 0.25)).toBeLessThan(0.08);
  });

  it('codingSeq: 편집 불가 자리·없는 사본은 null, KO 는 서열 기록이 없으면 대표 서열', () => {
    const g = lumi('R:R′r');
    expect(G.codingSeq(g, 'c1', 0, 'R')).toBe(SEQ_r);
    expect(G.codingSeq(g, 'c2', 0, 'S')).toBeNull();
    expect(G.codingSeq(g, 'c1', 5, 'R')).toBeNull();
    const m = G.parseGenotype('stella', 'sex:XY L:L');
    expect(G.codingSeq(m, 'sex', 1, 'R')).toBeNull();
    expect(G.codingSeq(m, 'c1', 0, 'R')).toBe(SEQ_r);
    expect(() => G.editCoding(g, 'c2', 0, 'S', SEQ_R)).toThrow();
    expect(() => G.editCoding(g, 'c1', 9, 'R', SEQ_R)).toThrow();
  });
});
