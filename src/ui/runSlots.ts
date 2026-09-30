// Multiple independent chronicles stored only in this browser.
import type { PolicyId, RunMode } from '../contract/game';
import { SAVE_KEY, type StorageLike } from '../game/game';
import { sanitizeBrand } from './fmt';

export const SLOTS_KEY = 'seed-atelier-2150:slots:v1';
export const TUTORIAL_KEY = 'seed-atelier-2150:tutorial:v1';

export interface RunSlot {
  id: string;
  key: string;
  brand: string;
  mode: RunMode;
  policy: PolicyId;
  updatedAt: number;
}

interface SlotIndex {
  v: 1;
  nextId: number;
  activeId: string | null;
  slots: RunSlot[];
}

function localStore(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function read(kv: StorageLike | null): SlotIndex {
  try {
    const raw = kv?.getItem(SLOTS_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SlotIndex;
      if (data?.v === 1 && Array.isArray(data.slots)) {
        const modes: RunMode[] = ['full', 'quick', 'unit-sex', 'unit-chromo', 'unit-edit'];
        const policies: PolicyId[] = ['heritage', 'precision', 'biotech'];
        const slots = data.slots.filter((slot): slot is RunSlot =>
          !!slot && typeof slot.id === 'string' &&
          (slot.key === SAVE_KEY && slot.id === 'legacy' || slot.key === `${SAVE_KEY}:slot:${slot.id}`) &&
          typeof slot.brand === 'string' && modes.includes(slot.mode) && policies.includes(slot.policy) &&
          typeof slot.updatedAt === 'number' && Number.isFinite(slot.updatedAt),
        );
        const nextId = Math.max(1, Number.isSafeInteger(data.nextId) ? data.nextId : 1, ...slots.map((s) => Number(s.id) + 1).filter(Number.isFinite));
        return { v: 1, nextId, activeId: typeof data.activeId === 'string' ? data.activeId : null, slots };
      }
    }
  } catch {
    // Damaged indexes do not prevent starting a new chronicle.
  }
  return { v: 1, nextId: 1, activeId: null, slots: [] };
}

function write(kv: StorageLike | null, index: SlotIndex): boolean {
  try {
    if (!kv) return false;
    kv.setItem(SLOTS_KEY, JSON.stringify(index));
    return true;
  } catch {
    return false;
  }
}

/** Keep saves created before multi-slot support available as the first chronicle. */
export function migrateLegacySave(brand = '', kv: StorageLike | null = localStore()): void {
  try {
    const raw = kv?.getItem(SAVE_KEY);
    if (!raw) return;
    const index = read(kv);
    if (index.slots.some((slot) => slot.key === SAVE_KEY)) return;
    const state = JSON.parse(raw) as { mode?: RunMode; policy?: PolicyId };
    index.slots.push({
      id: 'legacy', key: SAVE_KEY, brand: sanitizeBrand(brand),
      mode: state.mode ?? 'full', policy: state.policy ?? 'heritage', updatedAt: Date.now(),
    });
    index.activeId ??= 'legacy';
    write(kv, index);
  } catch {
    // An invalid legacy save remains untouched for manual recovery.
  }
}

export function listRunSlots(kv: StorageLike | null = localStore()): RunSlot[] {
  const index = read(kv);
  return index.slots.filter((slot) => {
    try {
      return !!kv?.getItem(slot.key);
    } catch {
      return false;
    }
  }).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function runSlotProgress(slot: RunSlot, kv: StorageLike | null = localStore()): string {
  try {
    const raw = kv?.getItem(slot.key);
    if (!raw) return '저장된 진행 없음';
    const state = JSON.parse(raw) as { ante?: number; maxAnte?: number; orderIdx?: number };
    if (!Number.isInteger(state.ante) || !Number.isInteger(state.maxAnte) || !Number.isInteger(state.orderIdx)) return '진행 정보 확인 불가';
    return `시즌 ${state.ante}/${state.maxAnte} · 주문 ${(state.orderIdx ?? 0) + 1}/3`;
  } catch {
    return '진행 정보 확인 불가';
  }
}

export function activeRunSlot(kv: StorageLike | null = localStore()): RunSlot | null {
  const slots = listRunSlots(kv);
  const activeId = read(kv).activeId;
  return slots.find((s) => s.id === activeId) ?? slots[0] ?? null;
}

export function createRunSlot(brand: string, mode: RunMode, policy: PolicyId, kv: StorageLike | null = localStore()): RunSlot | null {
  const index = read(kv);
  const id = String(index.nextId++);
  const slot: RunSlot = { id, key: `${SAVE_KEY}:slot:${id}`, brand: sanitizeBrand(brand), mode, policy, updatedAt: Date.now() };
  index.slots.push(slot);
  index.activeId = id;
  return write(kv, index) ? slot : null;
}

export function selectRunSlot(id: string, kv: StorageLike | null = localStore()): boolean {
  const index = read(kv);
  if (!index.slots.some((s) => s.id === id)) return false;
  index.activeId = id;
  return write(kv, index);
}

export function touchRunSlot(id: string, kv: StorageLike | null = localStore()): void {
  const index = read(kv);
  const slot = index.slots.find((s) => s.id === id);
  if (!slot) return;
  slot.updatedAt = Date.now();
  write(kv, index);
}

export function removeRunSlot(id: string, kv: StorageLike | null = localStore()): void {
  const index = read(kv);
  const slot = index.slots.find((s) => s.id === id);
  if (!slot) return;
  try { kv?.removeItem(slot.key); } catch { /* no storage */ }
  index.slots = index.slots.filter((s) => s.id !== id);
  if (index.activeId === id) index.activeId = index.slots[0]?.id ?? null;
  write(kv, index);
}

export function removeAllRunSlots(kv: StorageLike | null = localStore()): void {
  for (const slot of read(kv).slots) {
    try { kv?.removeItem(slot.key); } catch { /* continue */ }
  }
  try { kv?.removeItem(SAVE_KEY); } catch { /* continue */ }
  try { kv?.removeItem(SLOTS_KEY); } catch { /* continue */ }
}

export function tutorialSeen(kv: StorageLike | null = localStore()): boolean {
  try { return kv?.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
}

export function markTutorialSeen(kv: StorageLike | null = localStore()): void {
  try { kv?.setItem(TUTORIAL_KEY, '1'); } catch { /* optional preference */ }
}
