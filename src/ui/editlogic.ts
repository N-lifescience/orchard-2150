// 편집 작업대의 순수 로직 — 한 번에 한 곳만(치환 또는 결실), 되돌리기 (tests/ui.edit.test.ts)

export const BASE_CYCLE = ['A', 'T', 'G', 'C'] as const;

export function nextBase(b: string): string {
  const i = BASE_CYCLE.indexOf(b.toUpperCase() as (typeof BASE_CYCLE)[number]);
  return BASE_CYCLE[(i + 1) % BASE_CYCLE.length];
}

export type Change = { kind: 'sub'; pos: number; base: string } | { kind: 'del'; pos: number };

export interface EditState {
  orig: string;
  change: Change | null;
}

export function currentSeq(s: EditState): string {
  const c = s.change;
  if (!c) return s.orig;
  if (c.kind === 'sub') return s.orig.slice(0, c.pos) + c.base + s.orig.slice(c.pos + 1);
  return s.orig.slice(0, c.pos) + s.orig.slice(c.pos + 1);
}

export type EditOutcome = { ok: true; state: EditState } | { ok: false; reason: string };

/** 코딩 가닥의 i번째 염기를 눌렀을 때 (치환: A→T→G→C 순환) */
export function clickSub(s: EditState, i: number): EditOutcome {
  if (i < 0 || i >= s.orig.length) return { ok: false, reason: '없는 자리예요.' };
  const c = s.change;
  if (c && c.kind === 'del') return { ok: false, reason: '이미 한 염기를 지웠어요. 한 번에 한 곳만 바꿀 수 있어요. [되돌리기]를 먼저 눌러요.' };
  if (c && c.pos !== i) return { ok: false, reason: '한 번에 한 곳만 바꿀 수 있어요. [되돌리기]를 먼저 눌러요.' };
  const cur = c ? c.base : s.orig[i];
  const nb = nextBase(cur);
  if (nb === s.orig[i]) return { ok: true, state: { orig: s.orig, change: null } };
  return { ok: true, state: { orig: s.orig, change: { kind: 'sub', pos: i, base: nb } } };
}

/** i번째 염기 지우기 (결실) */
export function clickDel(s: EditState, i: number): EditOutcome {
  if (i < 0 || i >= s.orig.length) return { ok: false, reason: '없는 자리예요.' };
  if (s.change) return { ok: false, reason: '한 번에 한 곳만 바꿀 수 있어요. [되돌리기]를 먼저 눌러요.' };
  return { ok: true, state: { orig: s.orig, change: { kind: 'del', pos: i } } };
}

export function undo(s: EditState): EditState {
  return { orig: s.orig, change: null };
}

/** 표시용: 서열을 세 글자씩 */
export function codons(seq: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < seq.length; i += 3) out.push(seq.slice(i, i + 3));
  return out;
}

/** 바뀐 자리가 들어 있는 코돈 번호(0부터). 바뀐 게 없으면 null */
export function changedCodon(s: EditState): number | null {
  return s.change ? Math.floor(s.change.pos / 3) : null;
}

/** 유전 부호 표 배치: [첫째][둘째][셋째] 염기 순서 U C A G */
export const RNA_BASES = ['U', 'C', 'A', 'G'] as const;
export function codonGrid(): string[][][] {
  return RNA_BASES.map((b1) => RNA_BASES.map((b2) => RNA_BASES.map((b3) => b1 + b2 + b3)));
}

export const KIND_KO: Record<string, string> = {
  none: '변화 없음',
  synonymous: '동의 치환 — 아미노산이 그대로예요',
  missense: '아미노산 치환 — 아미노산 하나가 바뀌었어요',
  nonsense: '종결 코돈이 생겼어요',
  frameshift: '틀 이동 — 읽는 틀이 밀렸어요',
  startLost: '시작 코돈이 사라졌어요',
};
