import { describe, expect, it } from 'vitest';
import { createGame, SAVE_KEY, type StorageLike } from '../src/game/game';
import { wipeAll } from '../src/ui/prefs';
import { createRunSlot, listRunSlots, migrateLegacySave, removeRunSlot, runSlotProgress } from '../src/ui/runSlots';

class MemoryStore implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('여러 연대기 저장', () => {
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
    const restored = createGame({ storage: kv });
    expect(restored.load()).toBe(true);
    expect(restored.state.garden[0].name).toBe('엘레나 로시의 루비 별');
    expect(restored.state.orders[0].name).toBe('지역 납품');
    expect(restored.state.orders[0].client).toContain('과육 요청');
    wipeAll(kv);
    expect(listRunSlots(kv)).toEqual([]);
    expect(kv.getItem(SAVE_KEY)).toBeNull();
  });
});
