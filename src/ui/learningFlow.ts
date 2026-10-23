import type { ConceptId, OrderInfo, OrderRecord, RunState } from '../contract/game';
import { inferDifficulty } from '../game/difficulty';
export function learningTools(s: Pick<RunState, 'mode' | 'playStyle' | 'difficulty' | 'stats'>) {
  const difficulty = inferDifficulty(s.mode, s.playStyle, s.difficulty);
  const enabled = difficulty !== 'master';
  return { helper: enabled, memory: enabled, example: enabled && s.stats.crosses === 0,
    autoHelper: difficulty === 'sprout' && s.stats.crosses < 3, autoMemory: difficulty === 'sprout', coach: difficulty === 'sprout' };
}
/** The only pre-prediction coaching copy: deliberately contains no result. */
export function crossGuidance(predicted: boolean, parents?: [string, string], conclusion?: string): string {
  if (predicted && conclusion) return conclusion;
  return parents ? `${parents[0]} × ${parents[1]}: 부모가 줄 조각을 골라 볼까요?` : '부모 둘을 고르고, 자손의 과육색을 예상해 보세요.';
}
export function exampleSelection(a: string, b: string): { parents: [string, string]; prediction: null } {
  return { parents: [a, b], prediction: null };
}
export type Allele = 'R' | 'r';
export interface ThinkingState { gametes: (Allele | null)[]; cells: (string | null)[] }
export function emptyThinking(): ThinkingState { return { gametes: [null, null, null, null], cells: [null, null, null, null] }; }
export function chooseFragment(state: ThinkingState, parents: [string, string], slot: number, allele: Allele): { state: ThinkingState; reason: string } {
  const parent = parents[slot < 2 ? 0 : 1];
  if (!Number.isInteger(slot) || slot < 0 || slot > 3 || !/^[Rr]{2}$/.test(parent)) return { state, reason: '공개된 정상 2배체 부모를 골라 주세요.' };
  if (!parent.includes(allele)) return { state, reason: `이 부모의 유전자형에는 ${allele}이 없어요.` };
  const sibling = slot % 2 === 0 ? slot + 1 : slot - 1;
  if (state.gametes[sibling] === allele && parent[0] !== parent[1]) return { state, reason: '이 부모의 다른 조각도 찾아보세요.' };
  if (state.gametes[slot] === allele) return { state, reason: '' };
  const gametes = [...state.gametes]; gametes[slot] = allele;
  return { state: { gametes, cells: [null, null, null, null] }, reason: '' };
}
export function fillThinkingCell(state: ThinkingState, index: number): ThinkingState {
  const row = state.gametes[Math.floor(index / 2)]; const col = state.gametes[2 + index % 2];
  if (index < 0 || index > 3 || !row || !col) return state;
  const cells = [...state.cells]; cells[index] = [row, col].sort().join('');
  return { gametes: [...state.gametes], cells };
}
export function memoryFor(order: OrderInfo, records: OrderRecord[], discoveries: ConceptId[]): { record: OrderRecord; note: ConceptId } | null {
  const traits = (order.goals ?? []).map((g) => g.trait);
  const note: ConceptId = traits.some((t) => t.knockout) ? 'stopCodon' : traits.some((t) => t.seedless) ? 'triploid' : traits.some((t) => t.euploid !== undefined) ? 'nondisjunction' : traits.some((t) => t.species === 'stella') ? 'xlinked' : traits.some((t) => t.minBrix !== undefined) ? 'polygenic' : 'segregation';
  const available = discoveries.includes(note) ? note : note === 'segregation' && discoveries.includes('purebred') ? 'purebred' : null;
  if (!available) return null;
  const related = (r: OrderRecord) => note === 'segregation' ? !!r.prediction : r.goals.some((g) =>
    note === 'triploid' ? !!g.trait.seedless : note === 'xlinked' ? g.trait.species === 'stella' : note === 'polygenic' ? g.trait.minBrix !== undefined : note === 'nondisjunction' ? g.trait.euploid !== undefined : !!g.trait.knockout);
  const record = [...records].reverse().find(related);
  return record ? { record, note: available } : null;
}
