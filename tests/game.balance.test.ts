import { describe, expect, it } from 'vitest';
import type { PolicyId, RunMode } from '../src/contract/game';
import { formatSim, runOne, runSim } from '../scripts/sim';
import { ANTE_BASES } from '../src/game/content';

// 성공 횟수를 낮게 강제하지 않는다. 학습 판의 도전은 필수 형질을 육종하고 골라내는 데 있다.
// 이 봇은 학생 성취도를 측정하지 않으며, 공개 규칙의 진행 가능성과 출하 판정을 검사한다.
describe('학습 모드의 진행 가능성과 필수 형질', () => {
  it.each([
    ['full', 'heritage'], ['full', 'precision'], ['full', 'biotech'],
    ['quick', 'heritage'], ['unit-sex', 'heritage'], ['unit-chromo', 'heritage'], ['unit-edit', 'precision'],
  ] as [RunMode, PolicyId][])('%s · %s · 시드 10개: 점수와 형질을 모두 충족하며 완주한다', (mode, policy) => {
    const r = runSim({ seeds: 10, mode, policy, playStyle: 'learning', maxRetries: 2 });
    console.log(`${mode} / ${policy}\n${formatSim(r, ANTE_BASES)}`);
    if (r.halted.length) console.log(r.halted);
    expect(r.verifiedDeliveries).toBe(true);
    expect(r.victories / r.runs).toBeGreaterThanOrEqual(0.9);
    expect(r.avgRetries).toBeLessThanOrEqual(2);
    expect(r.avgParentPairs).toBeGreaterThan(1);
  }, 60000);

  it('full 한 판에서 과육색·성염색체·배수체·편집을 실제로 다룬다', () => {
    const r = runOne(21, { mode: 'full', policy: 'biotech', playStyle: 'learning' });
    expect(r.phase).toBe('victory');
    expect(r.crossSpecies).toEqual(['lumi', 'stella']);
    expect(r.offspringPloidies).toContain(3);
    expect(r.edits).toBeGreaterThan(0);
    expect(r.distinctParentPairs).toBeGreaterThanOrEqual(5);
    const complete = r.records.filter((rec) => rec.cleared);
    expect(complete).toHaveLength(24);
    expect(new Set(complete.flatMap((rec) => rec.goals.map((goal) => goal.id))).size).toBeGreaterThanOrEqual(10);
  }, 60000);

  it('도전 모드도 점수만으로 형질 조건을 건너뛰지 않는다', () => {
    const r = runSim({ seeds: 10, mode: 'full', policy: 'precision', playStyle: 'challenge' });
    expect(r.verifiedDeliveries).toBe(true);
    expect(r.unfinished).toBe(0);
  }, 60000);

  it('같은 시드와 선택 전략이면 결과가 같다', () => {
    const a = runSim({ seeds: 3, firstSeed: 500, mode: 'quick' });
    const b = runSim({ seeds: 3, firstSeed: 500, mode: 'quick' });
    expect(a).toEqual(b);
  }, 60000);
});
