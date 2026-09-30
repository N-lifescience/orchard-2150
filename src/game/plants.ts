// 시작 온실과 시장 품종 — 유전자형 문자열(계약 문법)을 만들어 유전 엔진에 넘긴다
import type { RunMode } from '../contract/game';
import type { Genome, Rng } from '../contract/genetics';
import { doubleGenome, parseGenotype, phenotype } from '../genetics';
import { MARKET_ORIGINS } from './content';

export interface PlantSeed {
  name: string;
  genome: Genome;
  revealed: boolean;
}

const pick = <T>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length];

/** 'Q1:+- Q2:++ …' — 대립유전자마다 확률 p 로 '+'. copies 는 사본 수(2 또는 4) */
export function randomQ(r: Rng, p: number, copies = 2): string {
  const out: string[] = [];
  for (let i = 1; i <= 6; i++) {
    let s = '';
    for (let k = 0; k < copies; k++) s += r() < p ? '+' : '-';
    out.push(`Q${i}:${s}`);
  }
  return out.join(' ');
}

/** 당도 '중간'(+ 대립유전자 5~7개 → 당도 13~15) 인 Q 문자열 */
export function midQ(r: Rng): string {
  for (let t = 0; t < 60; t++) {
    const q = randomQ(r, 0.5);
    const plus = (q.match(/\+/g) ?? []).length;
    if (plus >= 5 && plus <= 7) return q;
  }
  return 'Q1:+- Q2:+- Q3:+- Q4:+- Q5:+- Q6:+-';
}

const allele = (r: Rng, dom: string, rec: string, p: number) => (r() < p ? dom : rec);
const pair = (r: Rng, dom: string, rec: string, p: number) => allele(r, dom, rec, p) + allele(r, dom, rec, p);

// 할머니·할아버지 포기 (full/quick 공통)
const GRANDMA_RUBY = 'R:RR S:SS B:bb Q1:+- Q2:++ Q3:+- Q4:-- Q5:+- Q6:+-';
const GRANDMA_GOLD = 'R:rr S:ss B:bb Q1:-+ Q2:-- Q3:+- Q4:+- Q5:-- Q6:++';
const GRANDPA_SCENT = 'R:Rr S:ss B:bb Q1:++ Q2:++ Q3:+- Q4:-+ Q5:+- Q6:--';

const lumi = (name: string, spec: string, revealed: boolean): PlantSeed => ({ name, genome: parseGenotype('lumi', spec), revealed });
const stella = (name: string, spec: string, revealed: boolean): PlantSeed => ({ name, genome: parseGenotype('stella', spec), revealed });

export function starterGarden(mode: RunMode, r: Rng): PlantSeed[] {
  switch (mode) {
    case 'full':
    case 'quick':
      return [
        lumi('할머니의 루비 별', GRANDMA_RUBY, true),
        lumi('할머니의 골드', GRANDMA_GOLD, true),
        lumi('이웃 농장의 루비', `R:Rr S:Ss B:bb ${midQ(r)}`, false),
        lumi('할아버지의 향기', GRANDPA_SCENT, false),
      ];
    case 'unit-sex':
      return [
        stella('은빛 잎 루비 암그루', `R:Rr sex:XX L:Ll ${midQ(r)}`, true),
        stella('초록 잎 골드 암그루', `R:rr sex:XX L:ll ${midQ(r)}`, true),
        stella('은빛 잎 루비 수그루', `R:Rr sex:XY L:L ${midQ(r)}`, true),
        stella('초록 잎 골드 수그루', `R:rr sex:XY L:l ${midQ(r)}`, true),
        lumi('할머니의 루비 별', GRANDMA_RUBY, true),
      ];
    case 'unit-chromo':
      return [
        lumi('거대 루미 (4n)', 'R:RRrr S:SSss B:bbbb Q1:++-- Q2:+++- Q3:+-+- Q4:--++ Q5:++-- Q6:+---', true),
        lumi('할머니의 루비 별', GRANDMA_RUBY, true),
        lumi('할머니의 골드', GRANDMA_GOLD, true),
        lumi('할아버지의 향기', GRANDPA_SCENT, false),
      ];
    case 'unit-edit':
      return [
        lumi('쓴맛 도는 야생 루미', `R:Rr S:Ss B:Bb ${midQ(r)}`, true),
        lumi('할머니의 루비 별', GRANDMA_RUBY, true),
        lumi('할머니의 골드', GRANDMA_GOLD, true),
        lumi('할아버지의 향기', GRANDPA_SCENT, false),
      ];
  }
}

/** 표현형에서 시장 품종 이름을 짓는다 */
function marketName(origin: string, g: Genome, prefix = ''): string {
  const p = phenotype(g);
  if (g.species === 'stella') {
    return `${origin}의 ${prefix}별다래 ${p.sex === 'M' ? '수그루' : '암그루'}`;
  }
  const color = p.color === 'ruby' ? '루비' : '골드';
  return `${origin}의 ${prefix}${color}${p.marked ? ' 별' : ''}`;
}

export function randomLumiSpec(r: Rng, qp = 0.5): string {
  return `R:${pair(r, 'R', 'r', 0.5)} S:${pair(r, 'S', 's', 0.5)} B:${pair(r, 'B', 'b', 0.2)} ${randomQ(r, qp)}`;
}

export function randomStellaSpec(r: Rng, male: boolean, qp = 0.5): string {
  const L = male ? allele(r, 'L', 'l', 0.5) : pair(r, 'L', 'l', 0.5);
  return `R:${pair(r, 'R', 'r', 0.5)} sex:${male ? 'XY' : 'XX'} L:${L} ${randomQ(r, qp)}`;
}

/** 시장 씨앗 봉투: 유전자형 모름. 앤티 3부터 40% 별다래(암수 섞임) */
export function marketPlant(r: Rng, ante: number): PlantSeed {
  const origin = pick(r, MARKET_ORIGINS);
  if (ante >= 3 && r() < 0.4) {
    const g = parseGenotype('stella', randomStellaSpec(r, r() < 0.5));
    return { name: marketName(origin, g), genome: g, revealed: false };
  }
  const g = parseGenotype('lumi', randomLumiSpec(r));
  return { name: marketName(origin, g), genome: g, revealed: false };
}

/** 희귀 씨앗 상자: 꿀맛(당도 높음) · 순계 · 4배체(앤티 5+) · 은빛 수그루(앤티 3+) */
export function rarePlant(r: Rng, ante: number): PlantSeed {
  const origin = pick(r, MARKET_ORIGINS);
  const kinds: string[] = ['sweet', 'purebred'];
  if (ante >= 3) kinds.push('silverMale');
  if (ante >= 5) kinds.push('tetraploid');
  const kind = pick(r, kinds);
  switch (kind) {
    case 'purebred': {
      const R = r() < 0.5 ? 'RR' : 'rr';
      const S = r() < 0.5 ? 'SS' : 'ss';
      const q = [1, 2, 3, 4, 5, 6].map((i) => `Q${i}:${r() < 0.6 ? '++' : '--'}`).join(' ');
      const g = parseGenotype('lumi', `R:${R} S:${S} B:bb ${q}`);
      return { name: marketName(origin, g, '순계 '), genome: g, revealed: false };
    }
    case 'silverMale': {
      const g = parseGenotype('stella', `R:${pair(r, 'R', 'r', 0.5)} sex:XY L:L ${randomQ(r, 0.6)}`);
      return { name: `${origin}의 은빛 잎 수그루`, genome: g, revealed: false };
    }
    case 'tetraploid': {
      const g = doubleGenome(parseGenotype('lumi', randomLumiSpec(r, 0.6)));
      return { name: `${marketName(origin, g, '거대 ')} (4n)`, genome: g, revealed: false };
    }
    default: {
      const g = parseGenotype('lumi', `R:${pair(r, 'R', 'r', 0.5)} S:${pair(r, 'S', 's', 0.5)} B:bb ${randomQ(r, 0.8)}`);
      return { name: marketName(origin, g, '꿀맛 '), genome: g, revealed: false };
    }
  }
}

/** 교배할 짝이 하나도 없을 때 이웃 농장이 보내 주는 루미 (소프트락 방지) */
export function rescuePlant(r: Rng): PlantSeed {
  const g = parseGenotype('lumi', `R:${pair(r, 'R', 'r', 0.5)} S:${pair(r, 'S', 's', 0.5)} B:bb ${midQ(r)}`);
  return { name: '이웃 농장이 보낸 루미', genome: g, revealed: false };
}
