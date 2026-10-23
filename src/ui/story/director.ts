// 이야기 감독 — 교배 준비 화면에 들어설 때 서막·시즌 장면을 의뢰인보다 먼저 보여 준다.
// 어떤 장면을 보여 줄지는 순수 함수 pendingBeats(src/game/story.ts)가 정한다.
import type { RunState } from '../../contract/game';
import { beatFor, pendingBeats, SCENES, type BeatId } from '../../game/story';
import type { Ctx } from '../ctx';
import { openDialogue } from './dialogue';
import { filmOptions, withFilm } from './host';
import { FILM, sceneMedia } from './media';
import { playScene } from './scene';
import { markBeat, seenBeats } from './storage';

export class StoryDirector {
  private running = false;
  /** 저장소를 쓸 수 없어도 같은 장면을 한 세션에 두 번 보여 주지 않는다 */
  private shown = new Set<string>();

  constructor(private ctx: Ctx, private workbench: HTMLElement | null = null) {}

  get busy(): boolean {
    return this.running;
  }

  pending(s: RunState): BeatId[] {
    const saveKey = this.ctx.game.getSaveKey();
    const seen = [...seenBeats(saveKey), ...[...this.shown].filter((k) => k.startsWith(`${saveKey}|`)).map((k) => k.slice(saveKey.length + 1))];
    return pendingBeats({ mode: s.mode, ante: s.ante, maxAnte: s.maxAnte, orderIdx: s.orderIdx, phase: s.phase, recordAntes: s.records.map((r) => r.ante), seen });
  }

  /** 장면이 남아 있으면 의뢰인 방문을 미룬다 */
  holds(s: RunState): boolean {
    return this.running || this.pending(s).length > 0;
  }

  update(s: RunState): void {
    if (this.running) return;
    const beats = this.pending(s);
    if (!beats.length) return;
    this.running = true;
    // The tutorial bubble stays hidden for the whole beat, including the gaps between scene and dialogue,
    // and the workbench waits (as it does for a client) while the scene file is being checked.
    document.body.dataset.storyBeat = 'on';
    if (this.workbench) { this.workbench.inert = true; this.workbench.classList.add('is-awaiting-client'); }
    const maxAnte = s.maxAnte;
    queueMicrotask(() => {
      void this.play(beats, maxAnte).finally(() => {
        this.running = false;
        delete document.body.dataset.storyBeat;
        if (this.workbench) { this.workbench.inert = false; this.workbench.classList.remove('is-awaiting-client'); }
        this.ctx.render();
      });
    });
  }

  private async play(ids: BeatId[], maxAnte: number): Promise<void> {
    const saveKey = this.ctx.game.getSaveKey();
    for (const id of ids) {
      const beat = beatFor(id, maxAnte);
      const scene = beat.scene ? SCENES[beat.scene] : null;
      if (scene) await withFilm(this.ctx, () => playScene(scene, filmOptions(this.ctx)));
      await openDialogue(this.ctx, {
        kicker: beat.kicker, title: beat.title, lines: beat.lines, endLabel: beat.endLabel,
        art: scene ? sceneMedia(scene).still : id === 'prologue' ? FILM.introPoster : undefined,
      });
      this.shown.add(`${saveKey}|${id}`);
      markBeat(saveKey, id);
    }
  }
}
