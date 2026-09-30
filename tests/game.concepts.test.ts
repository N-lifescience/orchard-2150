// 개념 카드 발견 조건과 LMO·염색체 이상 규칙
import { describe, expect, it } from 'vitest';
import type { BossDef } from '../src/contract/game';
import { BOSSES, createGame } from '../src/game';
import type { InternalState } from '../src/game/game';

const boss = (id: string): BossDef => ({ ...BOSSES.find((b) => b.id === id)! });

function game(seed: number, mode: 'full' | 'unit-sex' | 'unit-chromo' | 'unit-edit' = 'full', policy: 'heritage' | 'precision' | 'biotech' = 'heritage') {
  const g = createGame({ storage: null });
  g.newRun({ seed, mode, policy });
  return { g, st: g.state as InternalState };
}

describe('개념 카드 발견', () => {
  it('분리: 이형접합(Rr Ss) 자가수분에서 부모에 없던 골드·민무늬가 나오면 발견 + 통계', () => {
    let found = false;
    for (let seed = 1; seed <= 10 && !found; seed++) {
      const { g, st } = game(seed);
      const neighbor = st.garden[2]; // '레아 모레노의 루비' R:Rr S:Ss
      g.chooseCross(neighbor.id, neighbor.id);
      const surprise = st.seen.some((c) => c.pheno.color === 'gold' || !c.pheno.marked);
      expect(st.discoveries.includes('segregation')).toBe(surprise);
      if (surprise) {
        expect(st.stats.recessiveSurprises).toBeGreaterThan(0);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('순계 부모끼리(RR SS × rr ss)는 분리가 일어나지 않는다', () => {
    const { g, st } = game(2);
    g.chooseCross(st.garden[0].id, st.garden[1].id);
    expect(st.hand.every((c) => c.pheno.color === 'ruby' && c.pheno.marked)).toBe(true);
    // 부모 둘 중 하나가 루비·무늬이므로 '둘 다 없던' 형질이 아님
    expect(st.stats.recessiveSurprises).toBe(0);
  });

  it('다유전자: 한 주문에서 당도 6가지 이상을 보면 발견', () => {
    const { g, st } = game(3);
    g.chooseCross(st.garden[2].id, st.garden[3].id);
    for (let k = 0; k < 3 && st.phase === 'play'; k++) g.discard(st.hand.slice(0, 5).map((c) => c.uid));
    const distinct = new Set(st.seen.map((c) => c.pheno.brix)).size;
    expect(st.discoveries.includes('polygenic')).toBe(distinct >= 6);
  });

  it('X 연관: 은빛 아비 × 초록 어미 → 딸은 모두 은빛, 손에 암그루 4장 이상이면 발견', () => {
    let found = false;
    for (let seed = 1; seed <= 10 && !found; seed++) {
      const { g, st } = game(seed, 'unit-sex');
      const father = st.garden.find((p) => p.pheno.sex === 'M' && p.pheno.marked)!;
      const mother = st.garden.find((p) => p.pheno.sex === 'F' && !p.pheno.marked)!;
      g.chooseCross(mother.id, father.id);
      const daughters = st.seen.filter((c) => c.pheno.sex === 'F');
      expect(daughters.every((c) => c.pheno.marked)).toBe(true);
      const sons = st.seen.filter((c) => c.pheno.sex === 'M');
      expect(sons.every((c) => !c.pheno.marked)).toBe(true); // 아들은 어미의 X(l)
      if (st.hand.filter((c) => c.pheno.sex === 'F').length >= 4) {
        expect(st.discoveries).toContain('xlinked');
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('핵형 현미경: 이수성 모종의 핵형을 본 뒤 솎아내면 +$1, 비분리 발견', () => {
    let found = false;
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const { g, st } = game(seed, 'unit-chromo');
      st.orders[2] = { kind: 'boss', name: '냉해', client: '', target: 10 ** 9, reward: 5, boss: boss('coldsnap') };
      st.orderIdx = 2;
      const money = st.money;
      const di = st.garden.find((p) => p.pheno.ploidy === 2)!;
      g.chooseCross(di.id, di.id);
      const unusual = st.hand.filter((c) => c.pheno.aneuploid);
      if (unusual.length > 0) {
        expect(unusual.every((c) => c.revealed)).toBe(true);
        expect(st.money).toBe(money);
        expect(st.discoveries).toContain('nondisjunction');
        g.discard([unusual[0].uid]);
        expect(st.money).toBe(money + 1);
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('앤티 1~4 에는 비분리가 없다', () => {
    const { g, st } = game(5);
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    expect([...st.hand, ...st.pod].some((c) => c.pheno.aneuploid)).toBe(false);
  });
});

describe('LMO', () => {
  it('형질전환 벡터: 바이오테크만, 형광 + 이름에 (LMO)', () => {
    const { g, st } = game(60, 'full', 'biotech');
    st.reagents = ['vector'];
    const p = st.garden[1];
    expect(g.useReagent(0, [p.id]).ok).toBe(true);
    expect(p.pheno.fluorescent).toBe(true);
    expect(p.name).toContain('LMO');
    const h = game(60, 'full', 'heritage');
    h.st.reagents = ['vector'];
    expect(h.g.useReagent(0, [h.st.garden[1].id]).ok).toBe(false);
  });

  it('꽃가루 유출: 주문이 끝날 때 LMO 가 있으면 확률적으로 비LMO 포기에 T+ → 유전자 흐름', () => {
    const { g, st } = game(61, 'full', 'biotech');
    st.reagents = ['vector'];
    g.useReagent(0, [st.garden[0].id]);
    let leaked = false;
    for (let k = 0; k < 30 && !leaked; k++) {
      st.phase = 'cashout';
      g.collect();
      leaked = st.stats.lmoEvents > 0;
    }
    expect(leaked).toBe(true);
    expect(st.discoveries).toContain('geneFlow');
    expect(st.garden.filter((p) => p.pheno.fluorescent).length).toBeGreaterThanOrEqual(2);
  });

  it('LMO 표시제 점검: 형광 카드 무효', () => {
    const { g, st } = game(62, 'full', 'biotech');
    st.reagents = ['vector'];
    g.useReagent(0, [st.garden[0].id]);
    st.orders[2] = { kind: 'boss', name: 'LMO', client: '', target: 10 ** 9, reward: 5, boss: boss('lmoCheck') };
    st.orderIdx = 2;
    g.chooseCross(st.garden[0].id, st.garden[0].id);
    for (const c of st.hand) expect(c.debuffed).toBe(c.pheno.fluorescent);
    expect(st.hand.some((c) => c.pheno.fluorescent)).toBe(true);
  });
});

describe('퍼넷 노트', () => {
  it('비법이 있을 때만 기대 분포를 준다', () => {
    const { g, st } = game(70);
    const a = st.garden[0].id;
    expect(g.preview(a, a)).toBeNull();
    st.jokers.push({ uid: 'pn', id: 'punnettNote', counter: 0 });
    const d = g.preview(a, st.garden[1].id)!;
    expect(d.suits['ruby-m']).toBeCloseTo(1, 5); // RR SS × rr ss → 전부 Rr Ss
    expect(g.preview(a, st.garden[1].id)).toEqual(d); // 같은 쌍이면 같은 값(난수 소비 없음)
  });
});
