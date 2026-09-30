import { describe, expect, it } from 'vitest';
import type { BossDef, HandTypeId, JokerInst, SeedCard } from '../src/contract/game';
import type { SuitKey } from '../src/contract/genetics';
import { parseGenotype, phenotype } from '../src/genetics';
import { BOSSES, CONCEPTS, HAND_TYPES, JOKERS, POLICIES, REAGENTS, createGame, gameContent } from '../src/game';
import { FLUSH_FAMILY, HAND_RANK } from '../src/game/content';
import type { InternalState, StorageLike } from '../src/game/game';
import { SAVE_KEY } from '../src/game/game';
import { cardChips, classify, scoreHand, type ScoreCtx } from '../src/game/rules';

// ── 도우미 ──────────────────────────────────────────────────────
class MemStorage implements StorageLike {
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

let uidN = 0;
/** 빛깔·당도로 카드 만들기. 당도 null 이면 별다래 수그루 (extra 는 유전자형 토큰 추가) */
function mk(suit: SuitKey, brix: number | null, extra = ''): SeedCard {
  const ruby = suit.startsWith('ruby');
  const marked = suit.endsWith('-m');
  const g =
    brix === null
      ? parseGenotype('stella', `R:${ruby ? 'RR' : 'rr'} sex:XY L:${marked ? 'L' : 'l'}`)
      : parseGenotype('lumi', `R:${ruby ? 'RR' : 'rr'} S:${marked ? 'SS' : 'ss'} B:bb ${extra}`.trim());
  const pheno = phenotype(g);
  return { uid: `t${++uidN}`, genome: g, pheno, brixMod: brix === null ? 0 : brix - (pheno.brix ?? 0), revealed: false, debuffed: false };
}

function levels(): Record<HandTypeId, number> {
  return Object.fromEntries(HAND_RANK.map((h) => [h, 1])) as Record<HandTypeId, number>;
}

function ctx(over: Partial<ScoreCtx> = {}): ScoreCtx {
  return { handLevels: levels(), jokers: [], boss: null, selfing: false, species: 'lumi', parents: null, firstHandOfOrder: false, ...over };
}

const J = (id: string, uid = `j_${id}`, counter = 0): JokerInst => ({ uid, id, counter });
const boss = (id: string): BossDef => ({ ...BOSSES.find((b) => b.id === id)! });

function newGame(seed = 7, mode: 'full' | 'quick' | 'unit-sex' | 'unit-chromo' | 'unit-edit' = 'full', policy: 'heritage' | 'precision' | 'biotech' = 'heritage') {
  const storage = new MemStorage();
  const g = createGame({ storage });
  g.newRun({ seed, mode, policy });
  return { g, storage, st: g.state as InternalState };
}

describe('교배 예측과 의뢰 빛깔', () => {
  it('교배 전에 고른 예측을 52알 전체의 관찰값과 함께 저장한다', () => {
    const { g, st, storage } = newGame(2);
    g.chooseCross(st.garden[0].id, st.garden[1].id, 'ruby');
    expect(st.prediction).toEqual({ choice: 'ruby', ruby: 52, gold: 0 });
    expect(st.hand.length + st.pod.length).toBe(52);
    const restored = createGame({ storage });
    expect(restored.load()).toBe(true);
    expect(restored.state.prediction).toEqual(st.prediction);
  });

  it('의뢰한 과육색이 점수에 반영된 출하에 포함되면 보너스를 준다', () => {
    const { g, st } = newGame(2);
    st.orders[0].requestedColor = 'ruby';
    g.chooseCross(st.garden[0].id, st.garden[1].id, 'ruby');
    const card = st.hand.find((c) => c.pheno.color === 'ruby')!;
    g.play([card.uid]);
    expect(st.requestFulfilled).toBe(true);
    expect(g.cashoutLines()).toContainEqual({ label: '의뢰한 빛깔 출하 보너스', amount: 2 });
  });

  it('의뢰하지 않은 과육색을 출하하면 보너스를 주지 않는다', () => {
    const { g, st } = newGame(2);
    st.orders[0].requestedColor = 'gold';
    g.chooseCross(st.garden[0].id, st.garden[1].id, 'ruby');
    g.play([st.hand[0].uid]);
    expect(st.requestFulfilled).toBe(false);
    expect(g.cashoutLines().some((l) => l.label === '의뢰한 빛깔 출하 보너스')).toBe(false);
  });

  it('의뢰 빛깔이어도 심사에서 무효인 모종에는 보너스를 주지 않는다', () => {
    const { g, st } = newGame(2);
    st.orders[0].requestedColor = 'ruby';
    g.chooseCross(st.garden[0].id, st.garden[1].id, 'ruby');
    st.hand[0].debuffed = true;
    g.play([st.hand[0].uid]);
    expect(st.requestFulfilled).toBe(false);
  });
});

// ── 콘텐츠 표 ───────────────────────────────────────────────────
describe('콘텐츠 표', () => {
  it('GameContent 이름을 전부 export 한다', () => {
    expect(Object.keys(HAND_TYPES)).toHaveLength(12);
    expect(JOKERS).toHaveLength(23); // 지시서 목록 23종 (GDD 는 '22종'이라 적음)
    expect(REAGENTS.map((r) => r.id).sort()).toEqual(['brush', 'colchicine', 'fertilizer', 'genetest', 'scissors', 'tissue', 'vector']);
    expect(BOSSES.map((b) => b.id)).toContain('expo');
    expect(POLICIES.map((p) => p.id)).toEqual(['heritage', 'precision', 'biotech']);
    expect(Object.keys(CONCEPTS)).toHaveLength(19);
    expect(typeof gameContent.createGame).toBe('function');
  });

  it('비법 id·이름·희귀도·가격이 지시서와 같다', () => {
    const want: [string, string, string, number][] = [
      ['shears', '엘레나 로시의 전지가위', 'common', 2], ['rubyLover', '루비 애호가', 'common', 5], ['goldCollector', '골드 수집가', 'common', 5],
      ['patternArtisan', '무늬 장인', 'common', 5], ['refractometer', '굴절계', 'common', 4], ['purebredCert', '빛깔 인증서', 'uncommon', 6],
      ['heterosis', '잡종강세', 'uncommon', 6], ['hideAndSeek', '숨바꼭질 대립유전자', 'uncommon', 7], ['selfingMaster', '자가수분 명인', 'uncommon', 6],
      ['breedingLog', '교배 일지', 'common', 5], ['mendelGlasses', '멘델의 안경', 'common', 3], ['punnettNote', '퍼넷 노트', 'uncommon', 4],
      ['beeSwarm', '꿀벌 군단', 'uncommon', 6], ['seedVault', '씨앗 금고', 'common', 5], ['pollenTrader', '꽃가루 상인', 'common', 4],
      ['xHeir', 'X의 상속자', 'uncommon', 6], ['colchicineNotes', '콜히친 노트', 'rare', 8], ['karyoScope', '핵형 현미경', 'uncommon', 5],
      ['scissorRack', '가위 거치대', 'rare', 7], ['jellyfishGene', '형광 해파리 유전자', 'rare', 6], ['climateHouse', '기후 적응 온실', 'rare', 8],
      ['grandpaNotes', '마테오 비앙키의 향기 노트', 'legendary', 10], ['tissueLab', '조직배양 랩', 'uncommon', 6],
    ];
    for (const [id, name, rarity, cost] of want) {
      const d = JOKERS.find((j) => j.id === id)!;
      expect(d, id).toBeTruthy();
      expect([d.name, d.rarity, d.cost]).toEqual([name, rarity, cost]);
      expect(d.flavor, id).toBeTruthy();
    }
  });

  it('개념 카드마다 제목·본문·실제 과학·성취기준이 있다', () => {
    for (const c of Object.values(CONCEPTS)) {
      expect(c.title && c.body && c.real, c.id).toBeTruthy();
      expect(c.standard, c.id).toMatch(/^12유전0\d-0\d$/);
    }
    // 우장춘이 처음 만든 것이 아님을 분명히
    expect(CONCEPTS.triploid.real).toContain('기하라 히토시');
    expect(CONCEPTS.triploid.real).toContain('처음 만든 사람은 아니에요');
  });
});

// ── 족보 판정 ───────────────────────────────────────────────────
describe('족보 판정', () => {
  const cases: [HandTypeId, SeedCard[], number][] = [
    ['high', [mk('ruby-m', 9), mk('gold-p', 14), mk('ruby-p', 11)], 1],
    ['pair', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 9)], 2],
    ['twoPair', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 9), mk('gold-m', 9), mk('gold-m', 15)], 4],
    ['three', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 12), mk('gold-m', 9)], 3],
    ['straight', [mk('ruby-m', 10), mk('gold-p', 11), mk('ruby-p', 12), mk('gold-m', 13), mk('ruby-m', 14)], 5],
    ['flush', [mk('gold-p', 9), mk('gold-p', 11), mk('gold-p', 15), mk('gold-p', 17), mk('gold-p', 17)], 5],
    ['fullHouse', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 12), mk('gold-m', 9), mk('ruby-m', 9)], 5],
    ['four', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 12), mk('gold-m', 12), mk('ruby-m', 9)], 4],
    ['straightFlush', [mk('ruby-m', 10), mk('ruby-m', 11), mk('ruby-m', 12), mk('ruby-m', 13), mk('ruby-m', 14)], 5],
    ['five', [mk('ruby-m', 12), mk('gold-p', 12), mk('ruby-p', 12), mk('gold-m', 12), mk('ruby-m', 12)], 5],
    ['flushHouse', [mk('gold-m', 12), mk('gold-m', 12), mk('gold-m', 12), mk('gold-m', 9), mk('gold-m', 9)], 5],
    ['flushFive', [mk('ruby-p', 15), mk('ruby-p', 15), mk('ruby-p', 15), mk('ruby-p', 15), mk('ruby-p', 15)], 5],
  ];
  for (const [type, cards, nScoring] of cases) {
    it(`${HAND_TYPES[type].name}(${type})`, () => {
      const r = classify(cards);
      expect(r.type).toBe(type);
      expect(r.scoring).toHaveLength(nScoring);
    });
  }

  it('단품은 가장 단 카드 1장, 수그루만이면 첫 장', () => {
    const a = mk('ruby-m', 9);
    const b = mk('gold-p', 14);
    expect(classify([a, b]).scoring).toEqual([b]);
    const m1 = mk('ruby-m', null);
    const m2 = mk('gold-p', null);
    const r = classify([m1, m2]);
    expect(r.type).toBe('high');
    expect(r.scoring).toEqual([m1]);
  });

  it('수그루는 한 빛깔에는 끼지만 당도 계단은 깬다', () => {
    const flush = [mk('ruby-m', 9), mk('ruby-m', 11), mk('ruby-m', null), mk('ruby-m', 17), mk('ruby-m', 13)];
    expect(classify(flush).type).toBe('flush');
    const brokenStraight = [mk('ruby-m', 10), mk('gold-p', 11), mk('ruby-p', 12), mk('gold-m', 13), mk('ruby-m', null)];
    expect(classify(brokenStraight).type).toBe('high');
  });

  it('효과 당도(환경 효과 포함)로 판정한다', () => {
    const a = mk('ruby-m', 12);
    const b = mk('ruby-m', 10);
    b.brixMod += 2;
    expect(classify([a, b]).type).toBe('pair');
  });

  it('점수 내는 카드는 손패 순서(왼쪽부터)', () => {
    const x = mk('ruby-m', 9);
    const p1 = mk('ruby-m', 12);
    const p2 = mk('gold-p', 12);
    expect(classify([p1, x, p2]).scoring.map((c) => c.uid)).toEqual([p1.uid, p2.uid]);
  });
});

// ── 점수 계산 ───────────────────────────────────────────────────
describe('점수 계산', () => {
  it('한 쌍: (10 + 12 + 12) × 2 = 68, 단계는 족보 → 카드 순서', () => {
    const cards = [mk('ruby-m', 12), mk('gold-p', 12), mk('gold-p', 8)];
    const { trace } = scoreHand(cards, ctx());
    expect(trace.total).toBe(68);
    expect(trace.steps.map((s) => s.kind)).toEqual(['hand', 'card', 'card']);
    expect(trace.steps[0]).toMatchObject({ chipsAfter: 10, multAfter: 2 });
    expect(trace.steps[2]).toMatchObject({ label: '+12', chipsAfter: 34, multAfter: 2 });
  });

  it('레벨이 오르면 족보 기본값이 perLevel 만큼', () => {
    const lv = levels();
    lv.pair = 3;
    const { trace } = scoreHand([mk('ruby-m', 12), mk('gold-p', 12)], ctx({ handLevels: lv }));
    // (10+30) + 24 = 64, 배수 2+2 = 4
    expect(trace.total).toBe(64 * 4);
    expect(trace.level).toBe(3);
  });

  it('비법 순서: 카드별 비법(+배수)이 카드마다, 카드와 무관한 비법(+4, ×3)은 뒤에 왼쪽부터', () => {
    const cards = [9, 10, 11, 13, 15].map((b) => mk('ruby-m', b)); // 한 빛깔 (계단·쌍 아님)
    const jokers = [J('rubyLover', 'j1'), J('shears', 'j2'), J('purebredCert', 'j3')];
    const { trace } = scoreHand(cards, ctx({ jokers }));
    expect(trace.handType).toBe('flush');
    const seq = trace.steps.map((s) => `${s.kind}:${s.sourceUid ?? ''}`);
    expect(seq.slice(0, 3)).toEqual(['hand:', `card:${cards[0].uid}`, 'joker:j1']);
    expect(seq.slice(-2)).toEqual(['joker:j2', 'joker:j3']);
    // 칩 35 + 58 = 93, 배수 (4 + 15 + 4) × 3 = 69
    expect(trace.total).toBe(93 * 69);
    const last = trace.steps[trace.steps.length - 1];
    expect(last).toMatchObject({ xmult: 3, chipsAfter: 93, multAfter: 69, label: '×3' });
  });

  it('×배수는 놓인 순서대로 곱한다 (+4 다음 ×3 ≠ ×3 다음 +4)', () => {
    const cards = [9, 10, 11, 13, 15].map((b) => mk('ruby-m', b));
    const a = scoreHand(cards, ctx({ jokers: [J('shears', 'a'), J('purebredCert', 'b')] })).trace.total;
    const b = scoreHand(cards, ctx({ jokers: [J('purebredCert', 'b'), J('shears', 'a')] })).trace.total;
    // 칩 35+58 = 93. a: (4+4)×3 = 24, b: 4×3+4 = 16
    expect(a).toBe(93 * 24);
    expect(b).toBe(93 * 16);
  });

  it('쓴맛은 카드 칩 절반(내림), 4배체 +10', () => {
    const gb = parseGenotype('lumi', 'R:RR S:SS B:BB');
    const bitter: SeedCard = { uid: 'bt', genome: gb, pheno: phenotype(gb), brixMod: 7, revealed: false, debuffed: false };
    expect(bitter.pheno.bitter).toBe(true);
    expect(cardChips(bitter)).toBe(7);
    const g4 = parseGenotype('lumi', 'R:RRRR S:SSSS B:bbbb');
    const giant: SeedCard = { uid: 'g4', genome: g4, pheno: phenotype(g4), brixMod: 0, revealed: false, debuffed: false };
    expect(giant.pheno.giant).toBe(true);
    expect(cardChips(giant)).toBe(8 + 10);
  });

  it('3배체 카드가 점수 내면 ×1.5, 콜히친 노트면 ×2', () => {
    const g3 = parseGenotype('lumi', 'R:RRR S:SSS B:bbb');
    const tri: SeedCard = { uid: 'tri', genome: g3, pheno: phenotype(g3), brixMod: 0, revealed: false, debuffed: false };
    expect(tri.pheno.seedless).toBe(true);
    const plain = scoreHand([tri], ctx());
    // 단품: (5 + 8) × 1 × 1.5 = 19.5 → 19
    expect(plain.trace.total).toBe(19);
    expect(plain.trace.steps[2]).toMatchObject({ kind: 'card', xmult: 1.5 });
    const noted = scoreHand([tri], ctx({ jokers: [J('colchicineNotes', 'cn')] }));
    expect(noted.trace.total).toBe(26);
    expect(noted.trace.steps[2]).toMatchObject({ kind: 'joker', sourceUid: 'cn', xmult: 2 });
  });

  it('debuffed 카드는 족보에는 들어가지만 점수(칩·비법)는 없다', () => {
    const a = mk('ruby-m', 12);
    const b = mk('gold-p', 12);
    b.debuffed = true;
    const { trace } = scoreHand([a, b], ctx({ jokers: [J('goldCollector', 'gc')] }));
    expect(trace.handType).toBe('pair');
    expect(trace.steps.find((s) => s.sourceUid === b.uid)?.label).toBe('무효');
    expect(trace.steps.some((s) => s.sourceUid === 'gc')).toBe(false);
    expect(trace.total).toBe((10 + 12) * 2);
  });

  it('균일성 심사: 한 빛깔 계열이 아니면 절반, 박람회: 첫 출하가 한 빛깔 계열이 아니면 0점', () => {
    const pair = [mk('ruby-m', 12), mk('gold-p', 12)];
    expect(scoreHand(pair, ctx({ boss: boss('uniformity') })).trace.total).toBe(34);
    expect(scoreHand(pair, ctx({ boss: boss('expo'), firstHandOfOrder: true })).trace.total).toBe(0);
    expect(scoreHand(pair, ctx({ boss: boss('expo'), firstHandOfOrder: false })).trace.total).toBe(68);
    const last = scoreHand(pair, ctx({ boss: boss('uniformity') })).trace.steps.at(-1)!;
    expect(last.kind).toBe('boss');
  });

  it('잡종강세·숨바꼭질·교배 일지·향기 노트', () => {
    const het = parseGenotype('lumi', 'R:Rr S:ss B:bb');
    const hc: SeedCard = { uid: 'h', genome: het, pheno: phenotype(het), brixMod: 4, revealed: false, debuffed: false };
    const r1 = scoreHand([hc], ctx({ jokers: [J('heterosis', 'hz')] }));
    expect(r1.trace.steps.find((s) => s.sourceUid === 'hz')?.mult).toBe(2);
    expect(r1.concepts).toContain('heterozygote');

    // 두 부모 모두 루비·무늬인데 골드가 나왔다
    const pa = phenotype(parseGenotype('lumi', 'R:Rr S:SS'));
    const gold = mk('gold-m', 12);
    const r2 = scoreHand([gold], ctx({ jokers: [J('hideAndSeek', 'hs')], parents: [pa, pa] }));
    expect(r2.trace.steps.find((s) => s.sourceUid === 'hs')?.xmult).toBe(1.5);

    const r3 = scoreHand([gold], ctx({ jokers: [J('breedingLog', 'bl', 2)] }));
    expect(r3.counterBumps).toEqual(['bl']);
    expect(r3.trace.steps.find((s) => s.sourceUid === 'bl')?.mult).toBe(3);
    const r3b = scoreHand([mk('ruby-m', 12)], ctx({ jokers: [J('breedingLog', 'bl', 2)] }));
    expect(r3b.counterBumps).toEqual([]);
    expect(r3b.trace.steps.find((s) => s.sourceUid === 'bl')?.mult).toBe(2);

    const r4 = scoreHand([mk('ruby-m', 17)], ctx({ jokers: [J('grandpaNotes', 'gp')] }));
    expect(r4.trace.total).toBe(5 + 17 + 17);
  });

  it('X의 상속자: 아비와 잎 빛깔이 같은 암그루만 +4 배수', () => {
    const father = phenotype(parseGenotype('stella', 'R:RR sex:XY L:L'));
    const mother = phenotype(parseGenotype('stella', 'R:RR sex:XX L:ll'));
    const dg = parseGenotype('stella', 'R:RR sex:XX L:Ll Q1:++');
    const daughter: SeedCard = { uid: 'd', genome: dg, pheno: phenotype(dg), brixMod: 0, revealed: false, debuffed: false };
    const r = scoreHand([daughter], ctx({ jokers: [J('xHeir', 'xh')], species: 'stella', parents: [mother, father] }));
    expect(r.trace.steps.find((s) => s.sourceUid === 'xh')?.mult).toBe(4);
    expect(r.concepts).toContain('xlinked');
  });
});

// ── 게임 흐름 ───────────────────────────────────────────────────
describe('게임 흐름', () => {
  it('새 판: 시작 온실 4포기, $4, 출하 4(전통 +1), 솎아내기 3, 목표 300/450/600', () => {
    const { st } = newGame(1, 'full', 'precision');
    expect(st.phase).toBe('cross');
    expect(st.garden.map((p) => p.name)).toEqual(['엘레나 로시의 루비 별', '엘레나 로시의 골드', '레아 모레노의 루비', '마테오 비앙키의 향기']);
    expect(st.garden.map((p) => p.revealed)).toEqual([true, true, false, false]);
    expect(st.money).toBe(4);
    expect(st.handsLeft).toBe(4);
    expect(st.discardsLeft).toBe(3);
    expect(st.reagents).toEqual(['scissors']);
    expect(st.orders.map((o) => o.target)).toEqual([300, 450, 600]);
    expect(st.orders[2].boss).toBeTruthy();
    const h = newGame(1, 'full', 'heritage').st;
    expect(h.handsLeft).toBe(5);
  });

  it('교배 → 꼬투리 52알, 핸드 8장, 자가수분 개념 발견', () => {
    const { g, st } = newGame(3);
    const a = st.garden[0].id;
    g.chooseCross(a, a);
    expect(st.phase).toBe('play');
    expect(st.hand).toHaveLength(8);
    expect(st.pod).toHaveLength(44);
    expect(st.seen).toHaveLength(8);
    expect(st.stats.selfings).toBe(1);
    expect(st.discoveries).toContain('selfing');
    // 엘레나 로시의 루비 별(RR SS) 자가수분 → 전부 루비·무늬
    expect(st.hand.every((c) => c.pheno.color === 'ruby' && c.pheno.marked)).toBe(true);
  });

  it('출하 → 점수 반영, 핸드 다시 8장, 목표 넘기면 cashout', () => {
    const { g, st } = newGame(4);
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    const uids = st.hand.slice(0, 5).map((c) => c.uid);
    const sim = g.simulate(uids)!;
    const trace = g.play(uids);
    expect(trace.total).toBe(sim.total);
    expect(st.roundScore).toBe(trace.total);
    expect(FLUSH_FAMILY.has(trace.handType)).toBe(true); // 전부 루비·무늬
    expect(st.discoveries).toContain('purebred');
    if (trace.cleared) expect(st.phase).toBe('cashout');
    else {
      expect(st.hand).toHaveLength(8);
      expect(st.handsLeft).toBe(4);
    }
  });

  it('출하를 다 쓰고 목표 미달이면 gameover (저장도 지운다)', () => {
    const { g, st, storage } = newGame(5);
    g.chooseCross(st.garden[0].id, st.garden[1].id);
    st.orders[0].target = 10 ** 9;
    while (st.phase === 'play') g.play([st.hand[0].uid]);
    expect(st.phase).toBe('gameover');
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('솎아내기: 횟수 차감, 꽃가루 상인은 수그루마다 +$1', () => {
    const { g, st } = newGame(6, 'unit-sex', 'heritage');
    const f = st.garden.find((p) => p.pheno.sex === 'F')!;
    const m = st.garden.find((p) => p.pheno.sex === 'M')!;
    expect(g.canCross(f.id, f.id).ok).toBe(false);
    g.chooseCross(f.id, m.id);
    expect(st.discoveries).toContain('dioecy');
    const males = st.hand.filter((c) => c.pheno.sex === 'M');
    const money = st.money;
    const pick = (males.length > 0 ? males : st.hand).slice(0, 5).map((c) => c.uid);
    g.discard(pick);
    expect(st.discardsLeft).toBe(2);
    expect(st.money).toBe(money + Math.min(5, males.length));
    expect(st.hand).toHaveLength(8);
  });

  it('정산: 보상 + 남은 출하 + 이자(최대 $5, 씨앗 금고 +$5)', () => {
    const { g, st } = newGame(8);
    st.phase = 'cashout';
    st.handsLeft = 2;
    st.money = 23;
    expect(g.cashoutLines().map((l) => l.amount)).toEqual([3, 2, 4]);
    st.money = 60;
    expect(g.cashoutLines().map((l) => l.amount)).toEqual([3, 2, 5]);
    st.jokers.push(J('seedVault', 'sv'));
    expect(g.cashoutLines().map((l) => l.amount)).toEqual([3, 2, 10]);
    st.orderIdx = 2;
    st.money = 0;
    st.handsLeft = 0;
    expect(g.cashoutLines().map((l) => l.amount)).toEqual([5]);
    g.collect();
    expect(st.money).toBe(5);
    expect(st.phase).toBe('select');
  });

  it('바이오테크: 주문 보상 +$1, 시작 비법 형광 해파리 유전자, LMO 개념', () => {
    const { g, st } = newGame(9, 'full', 'biotech');
    expect(st.jokers.map((j) => j.id)).toContain('jellyfishGene');
    expect(st.discoveries).toContain('lmo');
    st.phase = 'cashout';
    st.handsLeft = 0;
    st.money = 0;
    expect(g.cashoutLines().at(-1)).toEqual({ label: '바이오테크 계약 보너스', amount: 1 });
  });

  it('선발: 환경 효과(brixMod)는 버리고, 세대·부모·이름을 붙인다', () => {
    const { g, st } = newGame(10);
    const a = st.garden[0];
    const b = st.garden[1];
    g.chooseCross(a.id, b.id);
    const card = st.hand[0];
    const reag = st.reagents.length;
    st.reagents.push('fertilizer');
    expect(g.useReagent(reag, [card.uid]).ok).toBe(true);
    expect(st.hand[0].brixMod).toBe(2);
    expect(st.seen.find((c) => c.uid === card.uid)!.brixMod).toBe(2);
    st.phase = 'cashout';
    g.collect();
    const opts = g.selectOptions();
    expect(opts.candidates.some((c) => c.uid === card.uid)).toBe(true);
    expect(opts.mustReplace).toBe(false);
    g.select(card.uid);
    const plant = st.garden.at(-1)!;
    expect(plant.origin).toBe('seedling');
    expect(plant.parents).toEqual([a.id, b.id]);
    expect(plant.generation).toBe(2);
    expect(plant.name).toBe('2세대 선발 1호');
    expect(plant.pheno.brix).toBe(card.pheno.brix); // +2 는 사라짐
    expect(st.discoveries).toContain('environment');
    expect(st.phase).toBe('shop');
  });

  it('선발: 온실이 가득 차면 replacePlantId 가 있어야 한다', () => {
    const { g, st } = newGame(11);
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    st.gardenCap = st.garden.length;
    st.phase = 'cashout';
    g.collect();
    expect(g.selectOptions().mustReplace).toBe(true);
    const uid = st.seen[0].uid;
    g.select(uid);
    expect(st.phase).toBe('select');
    expect(st.toasts.at(-1)).toContain('가득');
    const out = st.garden[3].id;
    g.select(uid, out);
    expect(st.garden.some((p) => p.id === out)).toBe(false);
    expect(st.garden).toHaveLength(4);
    expect(st.phase).toBe('shop');
  });

  it('조직배양 랩: 선발 1포기 더, 같은 카드를 또 고르면 클론', () => {
    const { g, st } = newGame(12);
    st.jokers.push(J('tissueLab', 'tl'));
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    st.phase = 'cashout';
    g.collect();
    expect(g.selectOptions().extraPicks).toBe(1);
    const uid = st.seen[0].uid;
    g.select(uid);
    expect(st.phase).toBe('select');
    g.select(uid);
    expect(st.garden.at(-1)!.origin).toBe('clone');
    expect(st.discoveries).toContain('clone');
    expect(st.phase).toBe('shop');
  });

  it('3배체(불임)는 선발 후보에서 빠진다', () => {
    const { g, st } = newGame(13, 'unit-chromo', 'heritage');
    const tetra = st.garden.find((p) => p.pheno.ploidy === 4)!;
    const di = st.garden.find((p) => p.pheno.ploidy === 2)!;
    g.chooseCross(tetra.id, di.id);
    expect(st.hand.every((c) => c.pheno.seedless)).toBe(true);
    expect(st.discoveries).toContain('triploid');
    st.phase = 'cashout';
    g.collect();
    expect(g.selectOptions().candidates).toHaveLength(0);
  });
});

// ── 공방 ────────────────────────────────────────────────────────
describe('상점', () => {
  function toShop(seed = 20) {
    const { g, st } = newGame(seed);
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    st.phase = 'cashout';
    g.collect();
    g.select(null);
    return { g, st };
  }

  it('칸 구성: 비법/시약 2 + 봉투 2 + 증축 1, 새로고침 $5부터 +$1', () => {
    const { g, st } = toShop();
    expect(st.phase).toBe('shop');
    const items = st.shop!.items;
    expect(items.filter((i) => i.slot.startsWith('card'))).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'pack')).toHaveLength(2);
    expect(items.filter((i) => i.kind === 'upgrade')).toHaveLength(1);
    expect(st.shop!.rerollCost).toBe(5);
    st.money = 20;
    expect(g.reroll().ok).toBe(true);
    expect(st.money).toBe(15);
    expect(st.shop!.rerollCost).toBe(6);
    const packsBefore = JSON.stringify(items.filter((i) => i.kind !== 'joker' && i.kind !== 'reagent'));
    expect(JSON.stringify(st.shop!.items.filter((i) => !i.slot.startsWith('card')))).toBe(packsBefore);
  });

  it('비법 구매·판매(가격 절반 내림), 돈이 모자라면 거절', () => {
    const { g, st } = toShop();
    st.shop!.items[0] = { slot: 'card1', kind: 'joker', id: 'purebredCert', price: 6, sold: false };
    st.money = 5;
    expect(g.buy('card1')).toEqual({ ok: false, reason: '돈이 모자라요.' });
    st.money = 10;
    expect(g.buy('card1').ok).toBe(true);
    expect(st.money).toBe(4);
    const inst = st.jokers.at(-1)!;
    expect(inst.id).toBe('purebredCert');
    expect(g.sellValue(inst.uid)).toBe(3);
    expect(g.jokerDef(inst.uid).name).toBe('빛깔 인증서');
    g.sellJoker(inst.uid);
    expect(st.money).toBe(7);
    expect(g.buy('card1').ok).toBe(false);
  });

  it('비법 칸이 가득 차면 살 수 없다', () => {
    const { g, st } = toShop();
    st.jokers = ['a', 'b', 'c', 'd', 'e'].map((u) => J('shears', u));
    st.shop!.items[0] = { slot: 'card1', kind: 'joker', id: 'rubyLover', price: 5, sold: false };
    st.money = 50;
    expect(g.buy('card1').reason).toBe('비법 칸이 가득 찼어요.');
  });

  it('씨앗 봉투: 시장 품종 3 중 1, 온실이 차면 replacePlantId 필요', () => {
    const { g, st } = toShop();
    st.shop!.items[2] = { slot: 'pack1', kind: 'pack', pack: 'seed', price: 4, sold: false };
    st.money = 10;
    expect(g.buy('pack1').ok).toBe(true);
    expect(st.pack!.choices).toHaveLength(3);
    expect(st.pack!.choices.every((c) => c.kind === 'plant' && c.plant.origin === 'market' && !c.plant.revealed)).toBe(true);
    st.gardenCap = st.garden.length;
    expect(g.pickFromPack(0).ok).toBe(false);
    const out = st.garden[1].id;
    expect(g.pickFromPack(0, out).ok).toBe(true);
    expect(st.pack).toBeNull();
    expect(st.garden.some((p) => p.id === out)).toBe(false);
  });

  it('메달함: 족보 레벨업 / 비법 두루마리: 2 중 1', () => {
    const { g, st } = toShop();
    st.shop!.items[2] = { slot: 'pack1', kind: 'pack', pack: 'medal', price: 4, sold: false };
    st.shop!.items[3] = { slot: 'pack2', kind: 'pack', pack: 'joker', price: 6, sold: false };
    st.money = 20;
    g.buy('pack1');
    const ch = st.pack!.choices[0];
    expect(ch.kind).toBe('medal');
    const hand = (ch as { hand: HandTypeId }).hand;
    g.pickFromPack(0);
    expect(st.handLevels[hand]).toBe(2);
    g.buy('pack2');
    expect(st.pack!.choices).toHaveLength(2);
    const n = st.jokers.length;
    g.pickFromPack(1);
    expect(st.jokers).toHaveLength(n + 1);
  });

  it('증축: 한 번 사면 효과가 붙고 그 앤티엔 다시 안 나온다', () => {
    const { g, st } = toShop();
    const up = st.shop!.items.find((i) => i.kind === 'upgrade')!;
    st.money = 50;
    const caps = { g: st.gardenCap, h: st.baseHands, hs: st.handSize, j: st.jokerCap, d: st.baseDiscards };
    expect(g.buy(up.slot).ok).toBe(true);
    const changed = st.gardenCap !== caps.g || st.baseHands !== caps.h || st.handSize !== caps.hs || st.jokerCap !== caps.j || st.baseDiscards !== caps.d || st.upgrades.includes('reroll');
    expect(changed).toBe(true);
    expect(st.anteUpgradeSold).toBe(true);
    g.leaveShop();
    expect(st.orderIdx).toBe(1);
    expect(st.phase).toBe('cross');
  });

  it('철학별 등장 제한: 전통은 가위·벡터·해파리·가위 거치대가 절대 안 나온다', () => {
    const banned = new Set(['scissors', 'vector', 'jellyfishGene', 'scissorRack']);
    for (let seed = 1; seed <= 15; seed++) {
      const { g, st } = toShop(100 + seed);
      st.ante = 8;
      st.money = 10 ** 6;
      for (let k = 0; k < 20; k++) {
        for (const it of st.shop!.items) if (it.kind === 'joker' || it.kind === 'reagent') expect(banned.has(it.id)).toBe(false);
        g.reroll();
      }
    }
  });
});

// ── 보스 ────────────────────────────────────────────────────────
describe('보스', () => {
  function withBoss(id: string, seed = 30) {
    const { g, st } = newGame(seed);
    st.orders[2] = { kind: 'boss', name: id, client: '', target: 10 ** 9, reward: 5, boss: boss(id) };
    st.orderIdx = 2;
    return { g, st };
  }

  it('벌이 없는 날: 다른 포기끼리는 거절, 자가수분은 허용, 기후 적응 온실이면 무시', () => {
    const { g, st } = withBoss('nobees');
    const [a, b] = st.garden;
    const r = g.canCross(a.id, b.id);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('자가수분');
    expect(g.canCross(a.id, a.id).ok).toBe(true);
    g.chooseCross(a.id, b.id);
    expect(st.phase).toBe('cross');
    st.jokers.push(J('climateHouse', 'ch'));
    expect(g.canCross(a.id, b.id).ok).toBe(true);
  });

  it('가뭄: 모든 열매 카드 brixMod −3, 환경 개념', () => {
    const { g, st } = withBoss('drought');
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    expect(st.hand.every((c) => c.brixMod === -3)).toBe(true);
    expect(st.discoveries).toContain('environment');
  });

  it('소믈리에: 효과 당도 13 이하 무효 / 과일 심사위원: 수그루 무효', () => {
    const s = withBoss('sommelier');
    s.g.chooseCross(s.st.garden[0].id, s.st.garden[1].id);
    for (const c of s.st.hand) expect(c.debuffed).toBe((c.pheno.brix ?? 0) + c.brixMod <= 13);
    const { g, st } = newGame(31, 'unit-sex', 'heritage');
    st.orders[2] = { kind: 'boss', name: 'judge', client: '', target: 10 ** 9, reward: 5, boss: boss('judge') };
    st.orderIdx = 2;
    const f = st.garden.find((p) => p.pheno.sex === 'F')!;
    const m = st.garden.find((p) => p.pheno.sex === 'M')!;
    g.chooseCross(f.id, m.id);
    for (const c of st.hand) expect(c.debuffed).toBe(c.pheno.sex === 'M');
  });

  it('앤티마다 보스는 minAnte·실현 가능성을 지키고, 마지막 앤티는 박람회(×3)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { st } = newGame(seed);
      const b = st.orders[2].boss!;
      expect(b.minAnte).toBeLessThanOrEqual(1);
      expect(st.orders[2].target).toBe(600);
    }
    const { st } = newGame(3, 'quick');
    expect(st.maxAnte).toBe(4);
    const { g, st: s2 } = newGame(3, 'unit-edit', 'heritage');
    expect(s2.policy).toBe('precision');
    expect(s2.ante).toBe(7);
    expect(s2.reagents).toEqual(['scissors', 'scissors']);
    void g;
  });
});

// ── 시약·편집 ───────────────────────────────────────────────────
describe('시약과 편집', () => {
  it('검사 키트: 공개 + 이형접합이면 개념', () => {
    const { g, st } = newGame(40);
    st.reagents = ['genetest'];
    const neighbor = st.garden[2]; // R:Rr S:Ss
    expect(neighbor.revealed).toBe(false);
    const r = g.useReagent(0, [neighbor.id]);
    expect(r.ok).toBe(true);
    expect(neighbor.revealed).toBe(true);
    expect(st.discoveries).toContain('heterozygote');
    expect(st.reagents).toHaveLength(0);
  });

  it('유전자 가위는 useReagent 로 쓰지 않는다', () => {
    const { g, st } = newGame(41, 'full', 'precision');
    expect(g.useReagent(0, [st.garden[0].id])).toEqual({ ok: false, reason: '편집 작업대에서 써요' + '.' });
  });

  it('편집 작업대: 사본마다 자리, 종결 코돈을 만들면 nonsense + 개념', () => {
    const { g, st } = newGame(42, 'unit-edit', 'precision');
    const ruby = st.garden.find((p) => p.name === '엘레나 로시의 루비 별')!;
    const targets = g.editTargets(ruby.id);
    const rTargets = targets.filter((t) => t.locus === 'R');
    expect(rTargets).toHaveLength(2);
    expect(rTargets[0].label).toBe('1번 염색체 · 과육색 유전자(사본 1)');
    expect(targets.some((t) => t.locus === 'B')).toBe(true);
    const t = rTargets[0];
    // 3번 코돈 CAG → TAG (종결)
    const newSeq = t.seq.slice(0, 9) + 'T' + t.seq.slice(10);
    const res = g.applyEdit(0, ruby.id, t.group, t.copyIndex, t.locus, newSeq);
    expect(res.ok).toBe(true);
    expect(res.result!.kind).toBe('nonsense');
    expect(st.discoveries).toEqual(expect.arrayContaining(['transcription', 'dominanceMolecular', 'stopCodon']));
    expect(ruby.pheno.color).toBe('ruby'); // 한 사본만 망가짐 → 여전히 우성
    expect(st.reagents).toEqual(['scissors']);
    expect(st.stats.edits).toBe(1);
    const t2 = g.editTargets(ruby.id).filter((x) => x.locus === 'R')[1];
    g.applyEdit(0, ruby.id, t2.group, t2.copyIndex, t2.locus, t2.seq.slice(0, 9) + 'T' + t2.seq.slice(10));
    expect(ruby.pheno.color).toBe('gold'); // 두 사본 모두 기능 상실 → 열성 표현형
  });

  it('콜히친: 2n → 4n, 이름에 (4n)', () => {
    const { g, st } = newGame(43, 'unit-chromo', 'heritage');
    const di = st.garden.find((p) => p.pheno.ploidy === 2)!;
    const idx = st.reagents.indexOf('colchicine');
    expect(g.useReagent(idx, [di.id]).ok).toBe(true);
    expect(di.genome.ploidy).toBe(4);
    expect(di.pheno.giant).toBe(true);
    expect(di.name.endsWith('(4n)')).toBe(true);
    expect(st.discoveries).toContain('polyploid');
  });

  it('붓: 출하 중 교배로 되돌아가고 남은 출하·솎아내기는 그대로', () => {
    const { g, st } = newGame(44);
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    g.play([st.hand[0].uid]);
    const hands = st.handsLeft;
    const score = st.roundScore;
    st.reagents = ['brush'];
    expect(g.useReagent(0, []).ok).toBe(true);
    expect(st.phase).toBe('cross');
    expect(st.handsLeft).toBe(hands);
    expect(st.roundScore).toBe(score);
    g.chooseCross(st.garden[1].id, st.garden[1].id);
    expect(st.phase).toBe('play');
    expect(st.hand).toHaveLength(8);
  });

  it('조직배양: 클론 추가, 온실이 차면 실패', () => {
    const { g, st } = newGame(45);
    st.reagents = ['tissue', 'tissue'];
    expect(g.useReagent(0, [st.garden[0].id]).ok).toBe(true);
    expect(st.garden.at(-1)!.origin).toBe('clone');
    st.gardenCap = st.garden.length;
    expect(g.useReagent(0, [st.garden[0].id]).ok).toBe(false);
  });
});

// ── 저장·재현성 ─────────────────────────────────────────────────
describe('저장과 재현성', () => {
  it('저장/불러오기 왕복', () => {
    const { g, st, storage } = newGame(50);
    g.chooseCross(st.garden[0].id, st.garden[1].id);
    g.play(st.hand.slice(0, 2).map((c) => c.uid));
    const snapshot = JSON.stringify(g.state);
    expect(g.hasSave()).toBe(true);
    const g2 = createGame({ storage });
    expect(g2.state.phase).toBe('title');
    expect(g2.load()).toBe(true);
    expect(JSON.stringify(g2.state)).toBe(snapshot);
    // 불러온 판에서도 같은 다음 수가 같은 결과
    const u = g.state.hand.slice(0, 3).map((c) => c.uid);
    expect(g2.play(u).total).toBe(g.play(u).total);
    g2.clearSave();
    expect(g2.hasSave()).toBe(false);
    expect(g2.load()).toBe(false);
  });

  it('상태는 JSON 직렬화 가능하다 (저장 키 고정)', () => {
    const { storage } = newGame(51);
    const raw = storage.getItem('seed-atelier-2150:save:v1');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).phase).toBe('cross');
  });

  it('같은 시드 → 같은 판', () => {
    const run = (seed: number) => {
      const { g, st } = newGame(seed);
      g.chooseCross(st.garden[0].id, st.garden[3].id);
      g.discard(st.hand.slice(0, 3).map((c) => c.uid));
      g.play(st.hand.slice(0, 5).map((c) => c.uid));
      return JSON.stringify({ hand: st.hand, orders: st.orders, garden: st.garden, score: st.roundScore });
    };
    expect(run(77)).toBe(run(77));
    expect(run(77)).not.toBe(run(78));
  });

  it('subscribe: 상태가 바뀔 때마다 부른다', () => {
    const g = createGame({ storage: null });
    let calls = 0;
    const off = g.subscribe(() => calls++);
    g.newRun({ seed: 1, mode: 'full', policy: 'heritage' });
    g.chooseCross(g.state.garden[0].id, g.state.garden[0].id);
    expect(calls).toBe(2);
    off();
    g.sortHand('brix');
    expect(calls).toBe(2);
  });

  it('sortHand: 당도 내림차순 / 빛깔 순', () => {
    const { g, st } = newGame(52);
    g.chooseCross(st.garden[2].id, st.garden[3].id);
    g.sortHand('brix');
    const b = st.hand.map((c) => (c.pheno.brix ?? -1) + c.brixMod);
    expect(b).toEqual([...b].sort((x, y) => y - x));
    g.sortHand('suit');
    const order = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];
    const s = st.hand.map((c) => order.indexOf(`${c.pheno.color}-${c.pheno.marked ? 'm' : 'p'}`));
    expect(s).toEqual([...s].sort((x, y) => x - y));
  });
});

// ── 끝까지 한 판 ───────────────────────────────────────────────
describe('끝까지 한 판', () => {
  it('앤티를 넘어가며 phase 가 cross → play → cashout → select → shop → cross 로 돈다', () => {
    const g = createGame({ storage: null, bases: [20, 20, 20, 20] });
    g.newRun({ seed: 99, mode: 'quick', policy: 'heritage' });
    const seenPhases = new Set<string>();
    for (let step = 0; step < 400 && g.state.phase !== 'victory' && g.state.phase !== 'gameover'; step++) {
      const st = g.state;
      seenPhases.add(st.phase);
      switch (st.phase) {
        case 'cross': {
          const selfable = st.garden.find((p) => g.canCross(p.id, p.id).ok)!;
          g.chooseCross(selfable.id, selfable.id);
          break;
        }
        case 'play':
          g.play(st.hand.slice(0, 5).map((c) => c.uid));
          break;
        case 'cashout':
          g.collect();
          break;
        case 'select':
          g.select(null);
          break;
        case 'shop':
          g.leaveShop();
          break;
      }
    }
    expect(g.state.phase).toBe('victory');
    expect(g.state.ante).toBe(4);
    for (const p of ['cross', 'play', 'cashout', 'select', 'shop']) expect(seenPhases.has(p)).toBe(true);
  });
});
