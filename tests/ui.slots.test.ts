import { describe, expect, it } from 'vitest';
import { createGame, SAVE_KEY, type StorageLike } from '../src/game/game';
import { wipeAll } from '../src/ui/prefs';
import { createRunSlot, listRunSlots, loadRunReflection, migrateLegacySave, migrateRunReflection, removeRunSlot, runSlotProgress, runSlotDetails, saveRunReflection } from '../src/ui/runSlots';

class MemoryStore implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('여러 연대기 저장', () => {
  it('성찰 저장 실패를 성공으로 반환하지 않고 이전 글을 보존한다', () => {
    const kv = new MemoryStore();
    const key = `${SAVE_KEY}:slot:reflection-test`;
    expect(saveRunReflection(key, '이전 관찰', kv)).toBe(true);
    const blocked: StorageLike = {
      getItem: (name) => kv.getItem(name),
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => { throw new Error('SecurityError'); },
    };
    expect(saveRunReflection(key, '새 관찰', blocked)).toBe(false);
    expect(saveRunReflection(key, '', blocked)).toBe(false);
    expect(saveRunReflection(key, '새 관찰', null)).toBe(false);
    expect(loadRunReflection(key, kv)).toBe('이전 관찰');
    expect(saveRunReflection(key, '', kv)).toBe(true);
    expect(loadRunReflection(key, kv)).toBe('');
  });

  it('단원 진행은 시작 시즌을 빼고 세며, 완료한 계약만 진행 막대에 포함한다', () => {
    const kv = new MemoryStore();
    const slot = createRunSlot('단원 과수원', 'unit-sex', 'heritage', kv)!;
    kv.setItem(slot.key, JSON.stringify({ ante: 3, orderIdx: 0, phase: 'cross' }));
    expect(runSlotDetails(slot, kv)).toMatchObject({ status: 'playing', completed: 0, total: 6 });
    kv.setItem(slot.key, JSON.stringify({ ante: 3, orderIdx: 0, phase: 'shop' }));
    expect(runSlotDetails(slot, kv).completed).toBe(1);
    kv.setItem(slot.key, JSON.stringify({ ante: 4, orderIdx: 1, phase: 'review' }));
    expect(runSlotDetails(slot, kv)).toMatchObject({ status: 'review', completed: 4, total: 6 });
    kv.setItem(slot.key, JSON.stringify({ ante: 4, orderIdx: 2, phase: 'victory' }));
    expect(runSlotDetails(slot, kv)).toMatchObject({ status: 'victory', completed: 6, total: 6 });
    kv.setItem(slot.key, JSON.stringify({ ante: 4, orderIdx: 2, phase: 'gameover' }));
    expect(runSlotDetails(slot, kv)).toMatchObject({ status: 'gameover', completed: 5, total: 6 });
    kv.setItem(slot.key, 'damaged');
    expect(runSlotDetails(slot, kv).status).toBe('unknown');
  });
  it('새 연대기가 기존 연대기를 덮어쓰지 않고 각각 이어진다', () => {
    const kv = new MemoryStore();
    const game = createGame({ storage: kv });
    const first = createRunSlot('첫 과수원', 'quick', 'heritage', kv)!;
    game.setSaveKey(first.key);
    game.newRun({ mode: 'quick', policy: 'heritage', seed: 1 });
    const firstSeed = game.state.seed;
    const second = createRunSlot('두 번째', 'unit-sex', 'precision', kv)!;
    game.setSaveKey(second.key);
    game.newRun({ mode: 'unit-sex', policy: 'precision', seed: 2 });

    expect(listRunSlots(kv)).toHaveLength(2);
    expect(runSlotProgress(second, kv)).toContain('시즌 3/4');
    game.setSaveKey(first.key);
    expect(game.load()).toBe(true);
    expect(game.state.seed).toBe(firstSeed);
    expect(game.state.mode).toBe('quick');
    game.setSaveKey(second.key);
    expect(game.load()).toBe(true);
    expect(game.state.seed).toBe(2);
    expect(game.state.mode).toBe('unit-sex');

    removeRunSlot(first.id, kv);
    expect(listRunSlots(kv).map((s) => s.id)).toEqual([second.id]);
    expect(kv.getItem(first.key)).toBeNull();
    expect(kv.getItem(second.key)).not.toBeNull();
  });

  it('기존 단일 저장을 첫 슬롯으로 옮기고 전체 기록 지우기를 적용한다', () => {
    const kv = new MemoryStore();
    const game = createGame({ storage: kv });
    game.newRun({ mode: 'full', policy: 'heritage', seed: 9 });
    const legacy = JSON.parse(kv.getItem(SAVE_KEY)!) as Record<string, unknown>;
    delete legacy.playStyle;
    (legacy.garden as { name: string }[])[0].name = '할머니의 루비 별';
    (legacy.orders as { name: string; client: string }[])[0].name = '동네 장터';
    (legacy.orders as { name: string; client: string }[])[0].client = '학교 과학 동아리: "루비빛 과육을 부탁해요."';
    kv.setItem(SAVE_KEY, JSON.stringify(legacy));
    migrateLegacySave('기존 과수원', kv);
    migrateLegacySave('기존 과수원', kv);
    const slots = listRunSlots(kv);
    expect(slots).toHaveLength(1);
    expect(slots[0].brand).toBe('기존 과수원');
    expect(slots[0].key).toBe(SAVE_KEY);
    expect(slots[0].playStyle).toBe('challenge');
    const restored = createGame({ storage: kv });
    expect(restored.load()).toBe(true);
    expect(restored.state.garden[0].name).toBe('엘레나 로시의 루비 별');
    expect(restored.state.orders[0].name).toBe('지역 납품');
    expect(restored.state.orders[0].client).toContain('과육 요청');
    wipeAll(kv);
    expect(listRunSlots(kv)).toEqual([]);
    expect(kv.getItem(SAVE_KEY)).toBeNull();
  });

  it('성찰과 진행 방식은 연대기별로 분리하고 해당 슬롯 삭제에 함께 지운다', () => {
    const kv = new MemoryStore();
    const game = createGame({ storage: kv });
    const first = createRunSlot('수업', 'quick', 'heritage', kv, 'learning')!;
    game.setSaveKey(first.key);
    game.newRun({ mode: 'quick', policy: 'heritage', playStyle: 'learning', seed: 1 });
    const second = createRunSlot('도전', 'quick', 'heritage', kv, 'challenge')!;
    game.setSaveKey(second.key);
    game.newRun({ mode: 'quick', policy: 'heritage', playStyle: 'challenge', seed: 2 });
    saveRunReflection(first.key, '루비 39알, 골드 13알을 관찰했다.', kv);
    saveRunReflection(second.key, '다음에는 골드 부모끼리 교배한다.', kv);
    kv.setItem(`${first.key}:client-briefing:v1`, '1:1:0:1');
    kv.setItem(`${second.key}:client-briefing:v1`, '2:1:0:1');
    expect(listRunSlots(kv).find((slot) => slot.id === first.id)?.playStyle).toBe('learning');
    expect(listRunSlots(kv).find((slot) => slot.id === second.id)?.playStyle).toBe('challenge');
    expect(loadRunReflection(first.key, kv)).toContain('39알');
    expect(loadRunReflection(second.key, kv)).toContain('골드 부모');
    removeRunSlot(first.id, kv);
    expect(loadRunReflection(first.key, kv)).toBe('');
    expect(loadRunReflection(second.key, kv)).toContain('골드 부모');
    expect(kv.getItem(`${first.key}:client-briefing:v1`)).toBeNull();
    expect(kv.getItem(`${second.key}:client-briefing:v1`)).toBe('2:1:0:1');
    wipeAll(kv);
    expect(loadRunReflection(second.key, kv)).toBe('');
    expect(kv.getItem(`${first.key}:client-briefing:v1`)).toBeNull();
    expect(kv.getItem(`${second.key}:client-briefing:v1`)).toBeNull();
  });

  it('기존 공유 성찰은 선택된 연대기로 한 번만 옮긴다', () => {
    const kv = new MemoryStore();
    kv.setItem('seed-atelier-2150:reflection', '이전 성찰');
    const firstKey = `${SAVE_KEY}:slot:1`;
    const secondKey = `${SAVE_KEY}:slot:2`;
    migrateRunReflection(firstKey, kv);
    migrateRunReflection(secondKey, kv);
    expect(loadRunReflection(firstKey, kv)).toBe('이전 성찰');
    expect(loadRunReflection(secondKey, kv)).toBe('');
    expect(kv.getItem('seed-atelier-2150:reflection')).toBeNull();
  });
});
