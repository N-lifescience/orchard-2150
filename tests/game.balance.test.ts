// 밸런스 시뮬레이션 (scripts/sim.ts) — 탐욕 봇 50판, full 모드.
// 목표: 앤티 2는 거의 항상, 앤티 4는 절반쯤, 앤티 8은 드물게(0~10%) 깬다.
import { describe, expect, it } from 'vitest';
import { formatSim, runSim } from '../scripts/sim';
import { ANTE_BASES } from '../src/game/content';

describe('밸런스', () => {
  it('full · 전통 육종 · 시드 50개: 도달 앤티 분포', () => {
    const r = runSim({ seeds: 50, mode: 'full', policy: 'heritage' });
    console.log(`\n목표 기본값 ${JSON.stringify(ANTE_BASES)}\n${formatSim(r, ANTE_BASES)}`);
    expect(r.clearRate[2]).toBeGreaterThanOrEqual(0.9);
    expect(r.clearRate[4]).toBeGreaterThanOrEqual(0.3);
    expect(r.clearRate[4]).toBeLessThanOrEqual(0.7);
    expect(r.clearRate[8]).toBeLessThanOrEqual(0.1);
  }, 120000);

  it('같은 시드면 시뮬레이션 결과도 같다', () => {
    const a = runSim({ seeds: 3, firstSeed: 500 });
    const b = runSim({ seeds: 3, firstSeed: 500 });
    expect(a).toEqual(b);
  }, 60000);
});
