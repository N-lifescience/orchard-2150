import { describe, expect, it } from 'vitest';
import type { SeedCard } from '../src/contract/game';
import { SAVE_KEY } from '../src/game';
import { parseGenotype, phenotype } from '../src/genetics';
import { lineageText, partialGenotype, phenoSentence, plantView, seedView, viewSig } from '../src/ui/cards';
import { changedCodon, clickDel, clickSub, codonGrid, codons, currentSeq, nextBase, undo, type EditState } from '../src/ui/editlogic';
import { podTable } from '../src/ui/podstats';
import { ALL_KEYS, AUDIO_KEY, BRAND_KEY, REFLECT_KEY, UI_KEY, loadBrand, loadPrefs, loadReflection, parsePrefs, saveBrand, savePrefs, saveReflection, wipeAll, type KV } from '../src/ui/prefs';

class Mem implements KV {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

function card(spec: string, uid: string, species: 'lumi' | 'stella' = 'lumi', extra: Partial<SeedCard> = {}): SeedCard {
  const genome = parseGenotype(species, spec);
  return { uid, genome, pheno: phenotype(genome), brixMod: 0, revealed: false, debuffed: false, ...extra };
}

describe('편집 작업대 — 한 번에 한 곳만', () => {
  const R = 'ATGGCTTGGCAGAAAGGATACCATGAACTGTAA';
  const s0: EditState = { orig: R, change: null };

  it('A→T→G→C 순환, 원래 글자로 돌아오면 변화 없음', () => {
    expect(nextBase('A')).toBe('T');
    expect(nextBase('T')).toBe('G');
    expect(nextBase('G')).toBe('C');
    expect(nextBase('C')).toBe('A');
    // 9번(0부터) 글자 C → A → T → G → C(원래)
    let s = s0;
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = clickSub(s, 9);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
      seen.push(currentSeq(s)[9]);
    }
    expect(seen).toEqual(['A', 'T', 'G', 'C']);
    expect(s.change).toBeNull();
  });

  it('CAG → TAG 는 종결 코돈이 생기는 치환', () => {
    let s = s0;
    for (let i = 0; i < 2; i++) {
      const r = clickSub(s, 9);
      if (r.ok) s = r.state;
    }
    expect(currentSeq(s).slice(9, 12)).toBe('TAG');
    expect(changedCodon(s)).toBe(3);
  });

  it('다른 자리를 또 바꾸려 하면 거절, 되돌리기 후엔 된다', () => {
    const a = clickSub(s0, 4);
    expect(a.ok).toBe(true);
    const s1 = a.ok ? a.state : s0;
    expect(clickSub(s1, 5).ok).toBe(false);
    expect(clickDel(s1, 5).ok).toBe(false);
    const s2 = undo(s1);
    expect(currentSeq(s2)).toBe(R);
    expect(clickDel(s2, 5).ok).toBe(true);
  });

  it('결실은 한 글자를 빼고, 그 뒤엔 치환도 막힌다', () => {
    const d = clickDel(s0, 15);
    expect(d.ok).toBe(true);
    const s1 = d.ok ? d.state : s0;
    expect(currentSeq(s1).length).toBe(R.length - 1);
    expect(currentSeq(s1)).toBe(R.slice(0, 15) + R.slice(16));
    expect(clickSub(s1, 2).ok).toBe(false);
  });

  it('코돈 묶음과 유전 부호 표 배치', () => {
    expect(codons('AUGGCU')).toEqual(['AUG', 'GCU']);
    expect(codons('AUGGC')).toEqual(['AUG', 'GC']);
    const g = codonGrid();
    expect(g.length).toBe(4);
    expect(g.flat(2).length).toBe(64);
    expect(new Set(g.flat(2)).size).toBe(64);
    expect(g[0][0][0]).toBe('UUU');
    expect(g[3][3][3]).toBe('GGG');
  });
});

describe('카드 보기', () => {
  it('비공개면 유전자형 null, 공개되면 요약', () => {
    const c = card('R:Rr S:Ss B:bb', 's1');
    expect(seedView(c, { glasses: false }).genotypeText).toBeNull();
    const open = seedView({ ...c, revealed: true }, { glasses: false });
    expect(open.genotypeText).toContain('Rr');
  });

  it('멘델의 안경: 열성 표현형 자리만 확실히 보여 준다', () => {
    const gold = card('R:rr S:ss B:bb', 's2');
    const p = partialGenotype(gold.genome);
    expect(p).toContain('rr');
    expect(p).toContain('ss');
    const ruby = card('R:Rr S:Ss B:Bb', 's3');
    const q = partialGenotype(ruby.genome);
    expect(q === null || !q.includes('R')).toBe(true);
    expect(seedView(gold, { glasses: true }).partialGenotype).toBe(p);
    expect(seedView(gold, { glasses: false }).partialGenotype).toBeNull();
  });

  it('수그루는 당도 대신 열매 없음', () => {
    const male = card('R:RR L:L sex:XY', 'm1', 'stella');
    const v = seedView(male, { glasses: false });
    expect(v.brixShown).toBeNull();
    expect(phenoSentence(male.pheno, null)).toContain('수그루');
    expect(phenoSentence(male.pheno, null)).toContain('은빛 잎');
  });

  it('환경 효과는 보이는 당도에 더해지고 서명이 바뀐다', () => {
    const c = card('R:RR S:SS', 'e1');
    const a = seedView(c, { glasses: false });
    const b = seedView({ ...c, brixMod: 2 }, { glasses: false });
    expect(b.brixShown).toBe((a.brixShown ?? 0) + 2);
    expect(viewSig(a)).not.toBe(viewSig(b));
  });

  it('계보 문구', () => {
    const g = parseGenotype('lumi', 'R:Rr');
    const base = { genome: g, pheno: phenotype(g), revealed: false };
    const a = { ...base, id: 'p1', name: '할머니의 루비', origin: 'starter' as const, generation: 1 };
    const b = { ...base, id: 'p2', name: '이웃 루비', origin: 'market' as const, generation: 1 };
    const child = { ...base, id: 'p3', name: '2세대 선발 1호', origin: 'seedling' as const, generation: 2, parents: ['p1', 'p2'] as [string, string] };
    const self = { ...base, id: 'p4', name: '3세대', origin: 'seedling' as const, generation: 3, parents: ['p3', 'p3'] as [string, string] };
    const find = (id: string) => [a, b, child].find((p) => p.id === id);
    expect(lineageText(a, find)).toContain('할머니');
    expect(lineageText(b, find)).toContain('시장');
    expect(lineageText(child, find)).toBe('할머니의 루비 × 이웃 루비 · 2세대');
    expect(lineageText(self, find)).toContain('자가수분');
    expect(lineageText({ ...child, parents: ['gone', 'p2'] }, find)).toContain('떠나보낸 포기');
    expect(plantView(a, { glasses: false }).title).toBe('할머니의 루비');
  });
});

describe('꼬투리 분포', () => {
  it('빛깔 × 당도 격자, 수그루 따로', () => {
    const pod = [card('R:RR S:SS', 'a'), card('R:RR S:SS', 'b'), card('R:rr S:ss', 'c'), { ...card('R:rr S:ss', 'd'), brixMod: 2 }];
    const t = podTable(pod);
    expect(t.total).toBe(4);
    const rubyBrix = pod[0].pheno.brix!;
    expect(t.grid['ruby-m'][rubyBrix]).toBe(2);
    const goldBrix = pod[2].pheno.brix!;
    expect(t.grid['gold-p'][goldBrix]).toBe(1);
    expect(t.grid['gold-p'][goldBrix + 2]).toBe(1);
    const males = podTable([card('R:RR L:L sex:XY', 'm', 'stella')]);
    expect(males.male['ruby-m']).toBe(1);
  });
});

describe('이 기기 저장 (localStorage 만)', () => {
  it('설정은 깨진 값에도 기본값으로', () => {
    expect(parsePrefs(null)).toEqual({ speed: 1, reduceMotion: false });
    expect(parsePrefs('not json')).toEqual({ speed: 1, reduceMotion: false });
    expect(parsePrefs('{"speed":3,"reduceMotion":"yes"}')).toEqual({ speed: 1, reduceMotion: false });
    expect(parsePrefs('{"speed":4,"reduceMotion":true}')).toEqual({ speed: 4, reduceMotion: true });
  });

  it('저장·불러오기·모든 기록 지우기', () => {
    const kv = new Mem();
    savePrefs({ speed: 2, reduceMotion: true }, kv);
    expect(loadPrefs(kv)).toEqual({ speed: 2, reduceMotion: true });
    expect(saveBrand('  달빛 과수원 ', kv)).toBe('달빛 과수원');
    expect(loadBrand(kv)).toBe('달빛 과수원');
    saveReflection('우리는 속도를 택했어요.', kv);
    expect(loadReflection(kv)).toBe('우리는 속도를 택했어요.');
    kv.setItem(SAVE_KEY, '{}');
    kv.setItem(AUDIO_KEY, '{}');
    kv.setItem('다른 앱', 'x');
    wipeAll(kv);
    for (const k of [SAVE_KEY, BRAND_KEY, REFLECT_KEY, AUDIO_KEY, UI_KEY]) expect(kv.getItem(k)).toBeNull();
    expect(kv.getItem('다른 앱')).toBe('x');
    expect(ALL_KEYS).toContain(SAVE_KEY);
  });

  it('빈 브랜드 이름은 저장하지 않는다', () => {
    const kv = new Mem();
    saveBrand('   ', kv);
    expect(kv.getItem(BRAND_KEY)).toBeNull();
  });
});

describe('화면 코드 규칙', () => {
  // 화면 코드 원문 (vite 의 ?raw — node 모듈 없이 읽는다)
  const sources = {
    ...import.meta.glob('../src/ui/**/*.ts', { query: '?raw', import: 'default', eager: true }),
    ...import.meta.glob('../src/main.ts', { query: '?raw', import: 'default', eager: true }),
  } as Record<string, string>;
  const files = Object.entries(sources).map(([f, src]) => [f, src.replace(/\/\/.*$/gm, '')] as const);

  it('innerHTML·outerHTML·insertAdjacentHTML·Math.random 을 쓰지 않는다', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const [f, src] of files) expect(src, f).not.toMatch(/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|Math\.random/);
  });

  it('외부 네트워크를 부르지 않는다', () => {
    for (const [f, src] of files) expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket\(|sendBeacon|https?:\/\/(?!www\.w3\.org)/);
  });
});
