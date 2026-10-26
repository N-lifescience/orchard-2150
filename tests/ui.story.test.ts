import { describe, expect, it } from 'vitest';
import type { ConceptId, RunMode } from '../src/contract/game';
import { BOSSES, CONCEPTS, createGame } from '../src/game';
import { ELENA_NOTES } from '../src/game/elenaNotes';
import { BOSS_STORY, beatFor, CHALLENGE_FAILURE, ENDING, PROLOGUE, pendingBeats, SCENES, SEASON_BEATS, SEASON_END_LINES, sawOffer, SPEAKERS, VAULT_NOTE, type BeatQuery } from '../src/game/story';
import type { StorageLike } from '../src/game/game';
import { clientLines } from '../src/ui/clientBriefing';
import { activeCueIds, barcodeBars, counterValue, cueScale } from '../src/ui/story/cues';
import { revealFlags } from '../src/ui/story/reveal';
import { INTRO_CUES, INTRO_LENGTH, INTRO_STATIC_CUES } from '../src/ui/story/script';
import { addTalk, filmSound, introSeen, markBeat, markIntroSeen, seenBeats, setFilmSound, storyKey, talksSeen } from '../src/ui/story/storage';
import { createRunSlot, removeRunSlot } from '../src/ui/runSlots';
import { wipeAll } from '../src/ui/prefs';

class Memory implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

const q = (over: Partial<BeatQuery>): BeatQuery => ({ mode: 'full', ante: 1, maxAnte: 8, orderIdx: 0, phase: 'cross', recordAntes: [], seen: [], ...over });

describe('시즌 장면이 열리는 때', () => {
  it('연대기의 첫 계약 앞에는 서막과 그 시즌 장면을 차례로 연다', () => {
    expect(pendingBeats(q({}))).toEqual(['prologue', 'season-1']);
    expect(pendingBeats(q({ seen: ['prologue'] }))).toEqual(['season-1']);
    expect(pendingBeats(q({ seen: ['prologue', 'season-1'] }))).toEqual([]);
  });

  it('시즌의 첫 계약을 아직 시작하지 않았을 때만, 교배 준비 화면에서만 연다', () => {
    expect(pendingBeats(q({ ante: 3, recordAntes: [1, 1, 1, 2, 2, 2], seen: ['prologue', 'season-1', 'season-2'] }))).toEqual(['season-3']);
    expect(pendingBeats(q({ ante: 3, orderIdx: 1, recordAntes: [3] }))).toEqual([]);
    expect(pendingBeats(q({ ante: 3, recordAntes: [1, 2, 3] }))).toEqual([]);
    expect(pendingBeats(q({ phase: 'play' }))).toEqual([]);
    expect(pendingBeats(q({ phase: 'shop' }))).toEqual([]);
  });

  it('단원 게임은 서막과 자기 시즌 장면만, 서막은 시작 시즌에만', () => {
    expect(pendingBeats(q({ mode: 'unit-sex', ante: 3, maxAnte: 4 }))).toEqual(['prologue', 'season-3']);
    expect(pendingBeats(q({ mode: 'unit-sex', ante: 4, maxAnte: 4, recordAntes: [3, 3, 3], seen: ['prologue', 'season-3'] }))).toEqual(['season-4']);
    expect(pendingBeats(q({ mode: 'unit-chromo', ante: 5, maxAnte: 6 }))).toEqual(['prologue', 'season-5']);
    expect(pendingBeats(q({ mode: 'unit-edit', ante: 7, maxAnte: 8 }))).toEqual(['prologue', 'season-7']);
    // 재도전으로 기록이 남은 시작 시즌에는 서막을 다시 열지 않는다
    expect(pendingBeats(q({ mode: 'unit-sex', ante: 3, maxAnte: 4, recordAntes: [3] }))).toEqual([]);
  });

  it('장면 영상은 설계서의 다섯 고비(금고·덩굴·서리·제안·박람회)에만 붙는다', () => {
    const scenes = Object.values(SEASON_BEATS).map((b) => [b.id, b.scene ?? null]);
    expect(scenes).toEqual([
      ['season-1', 'vault'], ['season-2', null], ['season-3', null], ['season-4', 'vine'],
      ['season-5', 'frost'], ['season-6', null], ['season-7', 'offer'], ['season-8', null],
    ]);
    expect(Object.keys(SCENES)).toEqual(['vault', 'vine', 'frost', 'offer', 'expo']);
    for (const scene of Object.values(SCENES)) {
      expect(scene.captions.length).toBeGreaterThanOrEqual(1);
      expect(scene.captions.length).toBeLessThanOrEqual(3);
    }
  });

  it('짧은 연대기의 마지막 시즌에는 박람회 초대를 덧붙인다', () => {
    const quickLast = beatFor('season-4', 4);
    expect(quickLast.lines.at(-1)?.text).toContain('먼저 불렀어요');
    expect(beatFor('season-4', 8).lines.some((l) => l.text.includes('먼저 불렀어요'))).toBe(false);
    expect(beatFor('season-8', 8)).toBe(SEASON_BEATS[8]);
    expect(sawOffer('full')).toBe(true);
    expect(sawOffer('unit-edit')).toBe(true);
    expect(sawOffer('quick')).toBe(false);
  });

  it('게임에서 실제로 쓰는 상태로 서막·시즌 1 장면이 열린다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 3, mode: 'quick', policy: 'heritage' });
    const s = g.state;
    expect(pendingBeats({ mode: s.mode, ante: s.ante, maxAnte: s.maxAnte, orderIdx: s.orderIdx, phase: s.phase, recordAntes: s.records.map((r) => r.ante), seen: [] })).toEqual(['prologue', 'season-1']);
  });
});

describe('이야기 문장', () => {
  const allLines = [PROLOGUE, ...Object.values(SEASON_BEATS)].flatMap((b) => b.lines);

  it('대화는 한 쪽에 한 문장이다', () => {
    for (const line of allLines) {
      const sentences = line.text.split(/(?<=[.?!])\s+(?=[가-힣A-Z「])/).filter(Boolean);
      expect(sentences.length, line.text).toBeLessThanOrEqual(2); // 광고·편지 문구만 두 문장까지
      if (line.who !== 'monogrove') expect(sentences, line.text).toHaveLength(1);
      expect(SPEAKERS[line.who], line.who).toBeTruthy();
    }
  });

  it('할머니의 죽음은 서막에서 한 번만 담담하게 말한다', () => {
    const deathLines = allLines.filter((l) => /세상을 떠나/.test(l.text));
    expect(deathLines).toHaveLength(1);
    expect(PROLOGUE.lines.some((l) => l.text.includes('지난겨울'))).toBe(true);
  });

  it('금고 쪽지는 확정 문구 그대로 서막에 나온다', () => {
    expect(VAULT_NOTE).toBe('여덟 번째 시즌, 박람회 무대에 서는 사람에게.');
    expect(PROLOGUE.lines.some((l) => l.who === 'note' && l.text === VAULT_NOTE)).toBe(true);
  });

  it('모노그로브는 인물 없이 광고·편지로만 등장한다', () => {
    expect(SPEAKERS.monogrove.portrait).toBeUndefined();
    expect(allLines.filter((l) => l.who === 'monogrove').length).toBeGreaterThanOrEqual(2);
  });

  it('플레이어의 성별과 이름을 정하지 않는다', () => {
    const text = [...allLines.map((l) => l.text), ...ENDING.letter].join(' ');
    expect(text).not.toMatch(/손자|손녀|그녀|그는|아들아|딸아/);
  });

  it('도전 모드 실패 결말은 설계서의 한 줄이다', () => {
    expect(CHALLENGE_FAILURE.line).toBe('오차드의 문은 다시 닫히지만 금고의 씨앗은 남는다.');
  });

  it('시즌 끝 확인 질문 앞에 레아가 시즌마다 한마디 한다', () => {
    for (let s = 1; s <= 8; s++) expect(SEASON_END_LINES[s]).toBeTruthy();
  });
});

describe('특별 계약 의뢰인의 질문과 대답', () => {
  it('모든 특별 계약 의뢰인이 질문 하나를 갖고, 계약을 마치면 대답한다', () => {
    for (const boss of BOSSES) {
      expect(BOSS_STORY[boss.id]?.question, boss.id).toBeTruthy();
      expect(BOSS_STORY[boss.id]?.answer, boss.id).toBeTruthy();
    }
  });

  it('특별 계약 안내에는 의뢰인의 질문 쪽이 들어가고, 일반 계약에는 없다', () => {
    const g = createGame({ storage: null });
    g.newRun({ mode: 'quick', policy: 'heritage', seed: 3 });
    const boss = g.state.orders[2];
    const lines = clientLines(boss, g.state.playStyle);
    const question = lines.find((line) => line.heading === '손님의 질문');
    expect(question?.text).toBe(BOSS_STORY[boss.boss!.id].question);
    expect(clientLines(g.state.orders[0], g.state.playStyle).some((line) => line.heading === '손님의 질문')).toBe(false);
    expect(BOSS_STORY.uniformity.question).toContain('같은 빛깔이면 같은 계통');
  });
});

describe('엘레나의 노트', () => {
  it('19쪽 모두 메모 → 핵심 → 왜 중요한가 → 낱말 뜻 → 외우기 요령 → 오해 바로잡기 → 확인 질문을 갖춘다', () => {
    const ids = Object.keys(CONCEPTS) as ConceptId[];
    expect(ids).toHaveLength(19);
    for (const id of ids) {
      const n = ELENA_NOTES[id];
      expect(n, id).toBeTruthy();
      for (const field of [n.blank, n.memo, n.core, n.why, n.mnemonic, n.misconception.wrong, n.misconception.right, n.check.question, n.check.explain]) expect(field.length, id).toBeGreaterThan(4);
      expect(n.terms.length, id).toBeGreaterThanOrEqual(2);
      expect(n.check.answer, id).toBeLessThan(n.check.choices.length);
      // 빈칸의 질문은 답(메모)을 미리 말하지 않는다
      expect(n.blank, id).not.toBe(n.memo);
    }
  });

  it('덩굴의 빈칸은 설계서의 질문이고, 실제 과학의 출처 내용은 그대로 남는다', () => {
    expect(ELENA_NOTES.dioecy.blank).toBe('덩굴은 왜 열매를 맺지 않을까?');
    expect(ELENA_NOTES.triploid.misconception.right).toContain('기하라 히토시');
    expect(CONCEPTS.triploid.real).toContain('처음 만든 사람은 아니에요');
  });
});

describe('소개 영상 HUD 신호표', () => {
  it('시작 시각 순서이고, 모두 영상 길이 안에 있다', () => {
    const starts = INTRO_CUES.map((c) => c.at);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    for (const cue of INTRO_CUES) {
      expect(cue.at, cue.id).toBeGreaterThanOrEqual(0);
      expect(cue.until, cue.id).toBeGreaterThan(cue.at);
      expect(cue.until, cue.id).toBeLessThanOrEqual(INTRO_LENGTH);
    }
    expect(new Set(INTRO_CUES.map((c) => c.id)).size).toBe(INTRO_CUES.length);
  });

  it('같은 자리의 신호는 시간이 겹치지 않는다', () => {
    const lanes = new Map<string, typeof INTRO_CUES>();
    for (const cue of INTRO_CUES) lanes.set(cue.lane, [...(lanes.get(cue.lane) ?? []), cue]);
    for (const [lane, cues] of lanes) {
      for (let i = 1; i < cues.length; i++) expect(cues[i].at, `${lane}: ${cues[i].id}`).toBeGreaterThanOrEqual(cues[i - 1].until);
    }
  });

  it('필요한 꼬리표·카운터·연도 도장·끝 문장·로고가 있고, 끝 문장 다음에 로고가 나온다', () => {
    const text = (id: string) => INTRO_CUES.find((c) => c.id === id)!;
    const all = INTRO_CUES.map((c) => c.text);
    for (const need of ['엘레나 로시 · 계통 R-07', '시즌 01 / 08', '2120 · 클론 붕괴', '2150 · 발렌시아', '씨앗 하나에, 쉰두 가지 미래.', 'ORCHARD 2150']) expect(all).toContain(need);
    expect(text('offspring')).toMatchObject({ kind: 'counter', from: 0, to: 52, text: '자손' });
    expect(text('logo').at).toBeGreaterThan(text('final-line').at);
    expect(text('logo').until).toBe(INTRO_LENGTH);
    // 5구간(약 6초씩)마다 새 도장이 나온다
    const stamps = INTRO_CUES.filter((c) => c.kind === 'stamp').map((c) => Math.floor(c.at / 6));
    expect(stamps).toEqual([0, 1, 2, 3, 4]);
  });

  it('카운터는 0에서 52까지 오르고, 영상 길이가 다르면 비율로 맞춘다', () => {
    const counter = INTRO_CUES.find((c) => c.id === 'offspring')!;
    expect(counterValue(counter, counter.at)).toBe(0);
    expect(counterValue(counter, counter.until)).toBe(52);
    const mid = counterValue(counter, (counter.at + counter.until) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(52);
    expect(cueScale(30)).toBe(1);
    expect(cueScale(36)).toBeCloseTo(1.2);
    expect(cueScale(Number.NaN)).toBe(1);
    expect(cueScale(4)).toBe(1);
    expect(activeCueIds(27, 1)).toEqual(expect.arrayContaining(['season', 'final-line']));
    expect(activeCueIds(27 * 1.2, 1.2)).toEqual(activeCueIds(27, 1));
  });

  it('바코드는 장식이며 같은 글자에서 늘 같은 무늬다(무작위 아님)', () => {
    expect(barcodeBars('엘레나 로시 · 계통 R-07')).toEqual(barcodeBars('엘레나 로시 · 계통 R-07'));
    expect(barcodeBars('a')).not.toEqual(barcodeBars('b'));
    for (const w of barcodeBars('x', 50)) expect([1, 2, 3, 4]).toContain(w);
    for (const id of INTRO_STATIC_CUES) expect(INTRO_CUES.some((c) => c.id === id)).toBe(true);
  });
});

describe('처음 필요할 때 나타나는 조작부', () => {
  const base = { phase: 'cross' as const, ante: 1, orderIdx: 0 as const, jokers: [], reagents: [], discoveries: [] as ConceptId[], startAnte: 1 };

  it('첫 계약에서는 비법 줄·시약 칸·노트 단추를 숨긴다', () => {
    expect(revealFlags(base)).toEqual({ notes: false, jokers: false, reagents: false });
  });

  it('첫 발견 뒤 노트, 첫 공방부터 비법·시약이 나타나고 그 뒤로 유지된다', () => {
    expect(revealFlags({ ...base, discoveries: ['polygenic'] }).notes).toBe(true);
    expect(revealFlags({ ...base, phase: 'shop' })).toMatchObject({ jokers: true, reagents: true });
    expect(revealFlags({ ...base, orderIdx: 1 })).toMatchObject({ jokers: true, reagents: true });
    expect(revealFlags({ ...base, ante: 2 })).toMatchObject({ jokers: true, reagents: true });
  });

  it('도구를 가진 채 시작하는 단원·팀은 처음부터 보인다', () => {
    const g = createGame({ storage: null });
    g.newRun({ seed: 1, mode: 'unit-chromo', policy: 'heritage' });
    expect(revealFlags(g.state)).toMatchObject({ jokers: true, reagents: true });
    const p = createGame({ storage: null });
    p.newRun({ seed: 1, mode: 'quick', policy: 'precision' });
    expect(revealFlags(p.state).reagents).toBe(true);
    const h = createGame({ storage: null });
    h.newRun({ seed: 1, mode: 'quick', policy: 'heritage' });
    expect(revealFlags(h.state)).toMatchObject({ jokers: false, reagents: false });
  });
});

describe('이야기 진행 저장', () => {
  it('연대기마다 본 장면을 따로 기록하고, 연대기를 지우면 함께 지운다', () => {
    const kv = new Memory();
    const a = createRunSlot('가', 'quick', 'heritage', kv)!;
    const b = createRunSlot('나', 'quick', 'heritage', kv)!;
    kv.setItem(a.key, '{}');
    kv.setItem(b.key, '{}');
    markBeat(a.key, 'prologue', kv);
    markBeat(a.key, 'prologue', kv);
    markBeat(a.key, 'season-1', kv);
    markBeat(b.key, 'prologue', kv);
    expect(seenBeats(a.key, kv)).toEqual(['prologue', 'season-1']);
    removeRunSlot(a.id, kv);
    expect(kv.getItem(storyKey(a.key))).toBeNull();
    expect(seenBeats(b.key, kv)).toEqual(['prologue']);
    kv.setItem(storyKey(b.key), '{broken');
    expect(seenBeats(b.key, kv)).toEqual([]);
  });

  it('소개 영상·대화 수·영상 소리는 기기 단위로 남고, 전체 지우기로 사라진다', () => {
    const kv = new Memory();
    expect(introSeen(kv)).toBe(false);
    expect(talksSeen(kv)).toBe(0);
    expect(filmSound(kv)).toBe(false);
    markIntroSeen(kv);
    addTalk(kv);
    addTalk(kv);
    setFilmSound(true, kv);
    expect(introSeen(kv)).toBe(true);
    expect(talksSeen(kv)).toBe(2);
    expect(filmSound(kv)).toBe(true);
    wipeAll(kv);
    expect(introSeen(kv)).toBe(false);
    expect(talksSeen(kv)).toBe(0);
    expect(filmSound(kv)).toBe(false);
  });
});

describe('짧은 판에도 서막과 결말', () => {
  it.each(['quick', 'unit-sex', 'unit-chromo', 'unit-edit'] as RunMode[])('%s 의 마지막 특별 계약은 박람회다', (mode) => {
    const g = createGame({ storage: null, bases: [1] });
    g.newRun({ seed: 2, mode, policy: mode === 'unit-edit' ? 'precision' : 'heritage' });
    expect(pendingBeats({ mode, ante: g.state.ante, maxAnte: g.state.maxAnte, orderIdx: 0, phase: 'cross', recordAntes: [], seen: [] })[0]).toBe('prologue');
  });
});
