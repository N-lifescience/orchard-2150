// Multiple independent chronicles stored only in this browser.
import type { PlayStyle, PolicyId, RunMode } from '../contract/game';
import { SAVE_KEY, type StorageLike } from '../game/game';
import { sanitizeBrand, sanitizeLine } from './fmt';
import { practiceKey } from './practiceStorage';

export const SLOTS_KEY = 'seed-atelier-2150:slots:v1';
export const TUTORIAL_KEY = 'seed-atelier-2150:tutorial:v1';
const LEGACY_REFLECTION_KEY = 'seed-atelier-2150:reflection';

export interface RunSlot {
  id: string;
  key: string;
  brand: string;
  mode: RunMode;
  policy: PolicyId;
  playStyle: PlayStyle;
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
        ).map((slot) => ({ ...slot, playStyle: slot.playStyle === 'learning' ? 'learning' as const : 'challenge' as const }));
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
    const state = JSON.parse(raw) as { mode?: RunMode; policy?: PolicyId; playStyle?: PlayStyle };
    index.slots.push({
      id: 'legacy', key: SAVE_KEY, brand: sanitizeBrand(brand),
      mode: state.mode ?? 'full', policy: state.policy ?? 'heritage', playStyle: state.playStyle ?? 'challenge', updatedAt: Date.now(),
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

export interface RunSlotDetails {
  status: 'playing' | 'review' | 'victory' | 'gameover' | 'unknown';
  label: string;
  location: string;
  completed: number;
  total: number;
}

/** Describe the saved chronicle without loading or changing its game state. */
export function runSlotDetails(slot: RunSlot, kv: StorageLike | null = localStore()): RunSlotDetails {
  const start = slot.mode === 'unit-sex' ? 3 : slot.mode === 'unit-chromo' ? 5 : slot.mode === 'unit-edit' ? 7 : 1;
  const end = slot.mode === 'quick' || slot.mode === 'unit-sex' ? 4 : slot.mode === 'unit-chromo' ? 6 : 8;
  const total = (end - start + 1) * 3;
  const unknown: RunSlotDetails = { status: 'unknown', label: '기록 확인 필요', location: '진행 정보를 확인할 수 없습니다.', completed: 0, total };
  try {
    const raw = kv?.getItem(slot.key);
    if (!raw) return unknown;
    const state = JSON.parse(raw) as { ante?: number; orderIdx?: number; phase?: string };
    if (!Number.isInteger(state.ante) || !Number.isInteger(state.orderIdx)) return unknown;
    const status = state.phase === 'victory' ? 'victory' : state.phase === 'gameover' ? 'gameover' : state.phase === 'review' ? 'review' : 'playing';
    const labels = { victory: '모든 계약 완료', gameover: '도전 종료', review: '재도전 대기', playing: '진행 중' };
    const settled = ['cashout', 'select', 'shop', 'victory'].includes(state.phase ?? '') ? 1 : 0;
    const completed = status === 'victory' ? total : Math.max(0, Math.min(total, ((state.ante ?? start) - start) * 3 + (state.orderIdx ?? 0) + settled));
    return { status, label: labels[status], location: `시즌 ${state.ante} · 계약 ${(state.orderIdx ?? 0) + 1} / 3`, completed, total };
  } catch { return unknown; }
}

export function runSlotProgress(slot: RunSlot, kv: StorageLike | null = localStore()): string {
  try {
    const raw = kv?.getItem(slot.key);
    if (!raw) return '저장된 진행 없음';
    const state = JSON.parse(raw) as { ante?: number; maxAnte?: number; orderIdx?: number; phase?: string };
    if (!Number.isInteger(state.ante) || !Number.isInteger(state.maxAnte) || !Number.isInteger(state.orderIdx)) return '진행 정보 확인 불가';
    const result = state.phase === 'victory' ? '완료 · ' : state.phase === 'gameover' ? '도전 종료 · ' : state.phase === 'review' ? '재도전 대기 · ' : '';
    return `${result}시즌 ${state.ante}/${state.maxAnte} · 주문 ${(state.orderIdx ?? 0) + 1}/3`;
  } catch {
    return '진행 정보 확인 불가';
  }
}

export function activeRunSlot(kv: StorageLike | null = localStore()): RunSlot | null {
  const slots = listRunSlots(kv);
  const activeId = read(kv).activeId;
  return slots.find((s) => s.id === activeId) ?? slots[0] ?? null;
}

export function createRunSlot(brand: string, mode: RunMode, policy: PolicyId, kv: StorageLike | null = localStore(), playStyle: PlayStyle = 'learning'): RunSlot | null {
  const index = read(kv);
  const id = String(index.nextId++);
  const slot: RunSlot = { id, key: `${SAVE_KEY}:slot:${id}`, brand: sanitizeBrand(brand), mode, policy, playStyle, updatedAt: Date.now() };
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
  try { kv?.removeItem(`${slot.key}:reflection`); } catch { /* no storage */ }
  try { kv?.removeItem(`${slot.key}:client-briefing:v1`); } catch { /* no storage */ }
  try { kv?.removeItem(practiceKey(slot.key)); } catch { /* no storage */ }
  index.slots = index.slots.filter((s) => s.id !== id);
  if (index.activeId === id) index.activeId = index.slots[0]?.id ?? null;
  write(kv, index);
}

export function removeAllRunSlots(kv: StorageLike | null = localStore()): void {
  for (const slot of read(kv).slots) {
    try { kv?.removeItem(slot.key); } catch { /* continue */ }
    try { kv?.removeItem(`${slot.key}:reflection`); } catch { /* continue */ }
    try { kv?.removeItem(`${slot.key}:client-briefing:v1`); } catch { /* continue */ }
    try { kv?.removeItem(practiceKey(slot.key)); } catch { /* continue */ }
  }
  try { kv?.removeItem(SAVE_KEY); } catch { /* continue */ }
  try { kv?.removeItem(`${SAVE_KEY}:reflection`); } catch { /* continue */ }
  try { kv?.removeItem(`${SAVE_KEY}:client-briefing:v1`); } catch { /* continue */ }
  try { kv?.removeItem(SLOTS_KEY); } catch { /* continue */ }
}

/** Associate the earlier shared reflection with the chronicle that was selected. */
export function migrateRunReflection(saveKey: string, kv: StorageLike | null = localStore()): void {
  try {
    const old = kv?.getItem(LEGACY_REFLECTION_KEY);
    if (old === null || old === undefined) return;
    if (!kv?.getItem(`${saveKey}:reflection`)) kv?.setItem(`${saveKey}:reflection`, sanitizeLine(old));
    kv?.removeItem(LEGACY_REFLECTION_KEY);
  } catch { /* Optional writing stays local even if storage is unavailable. */ }
}

export function loadRunReflection(saveKey: string, kv: StorageLike | null = localStore()): string {
  try { return sanitizeLine(kv?.getItem(`${saveKey}:reflection`) ?? ''); } catch { return ''; }
}

export function saveRunReflection(saveKey: string, value: string, kv: StorageLike | null = localStore()): boolean {
  const clean = sanitizeLine(value);
  try {
    if (!kv) return false;
    if (clean) kv.setItem(`${saveKey}:reflection`, clean);
    else kv.removeItem(`${saveKey}:reflection`);
    return true;
  } catch { return false; }
}

export function tutorialSeen(kv: StorageLike | null = localStore()): boolean {
  try { return kv?.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
}

export function markTutorialSeen(kv: StorageLike | null = localStore()): void {
  try { kv?.setItem(TUTORIAL_KEY, '1'); } catch { /* optional preference */ }
}
