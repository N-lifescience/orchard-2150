// 앱 — 무대 배율, 화면 전환(타이틀·런·끝), 구독·다시 그리기, 연출 잠금, 알림(토스트·발견), 키보드, 배경·음악, 디버그 손잡이
import { audio } from '../audio';
import { createBackground } from '../art';
import type { BackgroundHandle } from '../contract/art';
import type { PlayStyle, PolicyId, RunMode, RunState } from '../contract/game';
import { createGame, SAVE_KEY, type GameImpl } from '../game';
import { decide, applyDirect, type BotAction } from './bot';
import type { Ctx } from './ctx';
import { button, h } from './h';
import { motion, stage, play } from './motion';
import { openGreenhouse, openOrders, openPod } from './modals/info';
import { openJoker, openReagent } from './modals/items';
import { openNotes, openTeacher, showDiscoveries } from './modals/notes';
import { openSettings } from './modals/settings';
import { openTutorial } from './modals/tutorial';
import { Modals, Tips, Toaster } from './overlay';
import { loadBrand, loadPrefs, type UiPrefs } from './prefs';
import { activeRunSlot, createRunSlot, listRunSlots, migrateLegacySave, migrateRunReflection, removeRunSlot, selectRunSlot, touchRunSlot, tutorialSeen, type RunSlot } from './runSlots';
import { RunScreen } from './run/runscreen';
import { EndScreen } from './screens/end';
import { TitleScreen } from './screens/title';

type Mode = 'title' | 'run' | 'end';

const tick = () => new Promise<void>((r) => queueMicrotask(r));

export class App implements Ctx {
  readonly game: GameImpl;
  readonly stage: HTMLElement;
  readonly modals: Modals;
  readonly tips: Tips;
  readonly toast: Toaster;
  readonly prefs: UiPrefs;
  bg: BackgroundHandle | null = null;
  brand: string;

  private screenBox: HTMLElement;
  private title: TitleScreen;
  private activeSlot: RunSlot | null = null;
  private end: EndScreen;
  private run: RunScreen | null = null;
  private mode: Mode = 'title';
  private busy = 0;
  private dirty = false;
  private discoveryOpen = false;
  private toastFlush = false;
  private sessionRuns = 0;
  private ambientKey = '';
  private sysReduced: MediaQueryList | null = null;

  readonly open: Ctx['open'];

  constructor(root: HTMLElement, opts: { debug?: boolean } = {}) {
    this.game = createGame();
    this.prefs = loadPrefs();
    this.brand = loadBrand();
    migrateLegacySave(this.brand);
    this.activeSlot = activeRunSlot();
    if (this.activeSlot) {
      this.game.setSaveKey(this.activeSlot.key);
      this.brand = this.activeSlot.brand;
      migrateRunReflection(this.activeSlot.key);
    }

    const canvas = h('canvas', { class: 'bgcanvas', 'aria-hidden': 'true' });
    this.stage = h('div', { id: 'stage', class: 'stage' });
    this.screenBox = h('div', { class: 'screens' });
    this.stage.appendChild(this.screenBox);
    const viewport = h('div', { class: 'viewport' }, this.stage);
    const rotate = h('div', { class: 'rotate-hint', role: 'alert' }, h('div', { class: 'rotate-hint__icon', 'aria-hidden': 'true' }), h('p', null, '가로로 돌려 주세요'), h('p', { class: 'hint' }, '오차드 2150은 가로 화면에서 플레이해요.'));
    root.replaceChildren(canvas, viewport, rotate);

    this.modals = new Modals(this.stage);
    this.tips = new Tips(this.stage);
    this.toast = new Toaster(this.stage);
    this.modals.onChange = () => this.tips.hide();

    try {
      this.bg = createBackground(canvas);
      this.bg.start();
    } catch (e) {
      console.warn('배경을 그리지 못했어요', e);
      this.bg = null;
    }

    this.open = {
      settings: () => openSettings(this),
      tutorial: () => openTutorial(this),
      notes: () => openNotes(this),
      teacher: () => openTeacher(this),
      greenhouse: () => openGreenhouse(this),
      orders: () => openOrders(this),
      pod: () => openPod(this),
      reagent: (i) => !this.isBusy() && openReagent(this, i),
      joker: (uid) => !this.isBusy() && openJoker(this, uid),
    };

    this.title = new TitleScreen(this);
    this.title.onStart = (mode, policy, playStyle) => this.newRun(mode, policy, playStyle);
    this.title.onResume = (id) => this.resumeRun(id);
    this.title.onRemove = (id) => this.removeRun(id);
    this.end = new EndScreen(this);
    this.end.onAgain = () => {
      const s = this.game.state;
      this.newRun(s.mode, s.policy, s.playStyle);
    };

    this.sysReduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.sysReduced?.addEventListener?.('change', () => this.applyPrefs());
    this.applyPrefs();

    this.game.subscribe(() => this.render());
    // 저장이 있으면 불러 둔다 (연구 노트가 이번 연대기의 발견을 보여 주도록). 화면은 타이틀.
    if (this.activeSlot && this.game.hasSave()) this.game.load();

    this.fit();
    window.addEventListener('resize', () => this.fit());
    window.addEventListener('orientationchange', () => this.fit());
    window.addEventListener('keydown', (e) => this.onKey(e));
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // 버튼 호버 소리 (아주 작게, 같은 버튼에선 한 번만)
    let lastHover: Element | null = null;
    this.stage.addEventListener('pointerover', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const b = (e.target as Element | null)?.closest('.btn:not(:disabled), .modecard, .policy, .chip, .note.is-open');
      if (b && b !== lastHover) audio.play('hover');
      lastHover = b ?? null;
    });

    this.goTitle();
    if (opts.debug) this.installDebug();
  }

  // ─────────────────────────────────────── 잠금·그리기
  get screen(): Mode {
    return this.mode;
  }

  isBusy(): boolean {
    return this.busy > 0;
  }

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    this.busy++;
    this.stage.classList.add('is-busy');
    this.run?.play.refreshPreview();
    try {
      return await fn();
    } finally {
      this.busy--;
      if (this.busy === 0) {
        this.stage.classList.remove('is-busy');
        this.dirty = false;
        this.render();
      }
    }
  }

  render(): void {
    if (this.busy > 0) {
      this.dirty = true;
      return;
    }
    const s = this.game.state;
    if (this.mode === 'title') {
      this.title.refresh();
    } else {
      if (s.phase === 'gameover' || s.phase === 'victory' || s.phase === 'review') this.showEnd(s);
      else if (s.phase === 'title') this.goTitle();
      else {
        if (this.mode !== 'run') this.showRun();
        this.run?.update(s);
      }
    }
    this.syncAmbient(s);
    this.flushNotices(s);
  }

  private swapScreen(el: HTMLElement): void {
    const old = this.screenBox.firstElementChild as HTMLElement | null;
    if (old === el) return;
    this.tips.hide();
    this.screenBox.replaceChildren(el);
    void play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 360 });
  }

  goTitle(): void {
    if (this.mode === 'run' || this.mode === 'end') {
      this.game.save();
      if (this.activeSlot) touchRunSlot(this.activeSlot.id);
      if (!this.game.hasSave()) {
        const warning = this.modals.open({
          title: '진행을 저장할 수 없어요',
          content: h('p', { class: 'hint' }, '브라우저 저장 공간을 사용할 수 없어요. 홈으로 가면 이 연대기를 이어할 수 없어요.'),
          actions: [
            button('계속 플레이', () => warning.close(), { class: 'btn--play' }),
            button('저장 없이 홈으로', () => {
              warning.close();
              this.enterTitle();
            }, { class: 'btn--ghost' }),
          ],
        });
        return;
      }
    }
    this.enterTitle();
  }

  private enterTitle(): void {
    this.modals.closeAll();
    this.mode = 'title';
    this.run = null;
    this.swapScreen(this.title.el);
    this.title.show();
    this.syncAmbient(this.game.state);
  }

  startRun(): void {
    this.modals.closeAll();
    this.run = new RunScreen(this);
    this.mode = 'run';
    this.swapScreen(this.run.el);
    this.render();
  }

  private showRun(): void {
    if (!this.run) this.run = new RunScreen(this);
    this.mode = 'run';
    this.swapScreen(this.run.el);
  }

  private showEnd(s: RunState): void {
    if (this.mode !== 'end') {
      this.mode = 'end';
      this.swapScreen(this.end.el);
    }
    this.end.show(s);
  }

  private newRun(mode: RunMode, policy: PolicyId, playStyle: PlayStyle = 'learning', seed?: number): void {
    const slot = createRunSlot(this.brand, mode, policy, undefined, playStyle);
    if (!slot) {
      const warning = this.modals.open({
        title: '진행을 저장할 수 없어요',
        content: h('p', { class: 'hint' }, '브라우저 저장 공간을 사용할 수 없습니다. 지금은 플레이할 수 있지만, 홈으로 나가면 이어할 수 없어요.'),
        actions: [
          button('취소', () => warning.close(), { class: 'btn--ghost' }),
          button('저장 없이 시작', () => {
            warning.close();
            this.activeSlot = null;
            this.game.setSaveKey(`${SAVE_KEY}:slot:session-${++this.sessionRuns}`);
            this.game.newRun({ mode, policy, playStyle, seed });
            this.startRun();
            if (!tutorialSeen()) queueMicrotask(() => openTutorial(this));
          }, { class: 'btn--play' }),
        ],
      });
      return;
    }
    this.activeSlot = slot;
    this.game.setSaveKey(slot.key);
    this.game.newRun({ mode, policy, playStyle, seed });
    this.startRun();
    if (!tutorialSeen()) queueMicrotask(() => openTutorial(this));
  }

  private resumeRun(id: string): void {
    const slot = listRunSlots().find((s) => s.id === id);
    if (!slot) {
      this.toast.error('저장된 연대기를 찾지 못했어요.');
      this.title.show();
      return;
    }
    this.game.setSaveKey(slot.key);
    if (!this.game.load()) {
      this.toast.error('저장된 연대기를 불러오지 못했어요.');
      return;
    }
    this.activeSlot = slot;
    this.brand = slot.brand;
    selectRunSlot(id);
    this.startRun();
  }

  private removeRun(id: string): void {
    removeRunSlot(id);
    if (this.activeSlot?.id === id) {
      this.activeSlot = activeRunSlot();
      if (this.activeSlot) {
        this.game.setSaveKey(this.activeSlot.key);
        this.brand = this.activeSlot.brand;
        this.game.load();
      } else {
        this.game.setSaveKey(SAVE_KEY);
        this.game.reset();
        this.brand = loadBrand();
      }
    }
    this.title.show();
  }

  // ─────────────────────────────────────── 알림
  private flushNotices(s: RunState): void {
    if (this.mode === 'title') return;
    if (s.toasts.length > 0 && !this.toastFlush) {
      this.toastFlush = true;
      const msgs = s.toasts.slice();
      queueMicrotask(() => {
        for (const m of msgs) this.toast.show(m);
        this.toastFlush = false;
        if (this.game.state.toasts.length > 0) this.game.ackToasts();
      });
    }
    if (s.pendingDiscoveries.length > 0 && !this.discoveryOpen) {
      this.discoveryOpen = true;
      const ids = s.pendingDiscoveries.slice();
      queueMicrotask(() => {
        void showDiscoveries(this, ids).then(() => {
          this.discoveryOpen = false;
        });
      });
    }
  }

  // ─────────────────────────────────────── 배경·음악
  private syncAmbient(s: RunState): void {
    let scene: 'title' | 'run' | 'shop' | 'end' = 'title';
    let ante = 1;
    let boss = false;
    if (this.mode === 'run') {
      ante = s.ante;
      scene = s.phase === 'shop' ? 'shop' : 'run';
      const o = s.orders[s.orderIdx];
      boss = o?.kind === 'boss' && (s.phase === 'cross' || s.phase === 'play');
    } else if (this.mode === 'end') {
      ante = s.ante;
      scene = 'end';
    }
    const key = `${scene}:${ante}:${boss}`;
    if (key === this.ambientKey) return;
    this.ambientKey = key;
    this.bg?.setSeason(ante);
    this.bg?.setBoss(boss);
    audio.music({ ante, boss, scene });
    this.stage.dataset.season = String(Math.min(4, Math.floor((ante - 1) / 2) + 1));
    this.stage.classList.toggle('is-boss', boss);
  }

  // ─────────────────────────────────────── 설정
  applyPrefs(): void {
    motion.speed = this.prefs.speed;
    motion.reduced = this.prefs.reduceMotion || !!this.sysReduced?.matches;
    document.documentElement.classList.toggle('sa-reduced-motion', motion.reduced);
    this.bg?.setReducedMotion(motion.reduced);
  }

  private fit(): void {
    const W = window.innerWidth;
    const H = window.innerHeight - (document.querySelector('.debug-panel')?.getBoundingClientRect().height ?? 0);
    const s = Math.max(0.75, Math.min(W / 1280, H / 720));
    stage.scale = s;
    this.stage.style.transform = `scale(${s})`;
    this.stage.style.left = `${Math.max(0, Math.round((W - 1280 * s) / 2))}px`;
    this.stage.style.top = `${Math.max(0, Math.round((H - 720 * s) / 2))}px`;
    this.run?.relayout();
  }

  // ─────────────────────────────────────── 키보드
  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (this.modals.closeTop()) e.preventDefault();
      else if (this.mode === 'run' && !this.isBusy()) {
        e.preventDefault();
        this.open.settings();
      }
      return;
    }
    if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
    const run = this.run;
    if (e.key === ' ' && run?.play.fastForward()) {
      e.preventDefault();
      return;
    }
    if (this.modals.count > 0 || this.busy > 0 || this.mode !== 'run' || !run) return;
    const nativeBtn = !!t && (t.tagName === 'BUTTON' || t.tagName === 'A');
    const phase = this.game.state.phase;
    const k = e.key.toLowerCase();
    if (/^[1-9]$/.test(e.key)) {
      if (phase === 'play') run.play.toggleByKey(Number(e.key));
      else if (phase === 'cross') run.cross.toggleByKey(Number(e.key));
      return;
    }
    if (e.key === 'Enter' && !nativeBtn) {
      e.preventDefault();
      if (phase === 'play') void run.play.doPlay();
      else if (phase === 'cross') run.cross.confirm();
      else if (phase === 'cashout') void run.cashout.collect();
      else if (phase === 'select') run.select.confirm();
      return;
    }
    if (phase === 'play' && (k === 'd' || k === 'ㅇ')) {
      void run.play.doDiscard();
      return;
    }
    if (phase === 'play' && (k === 's' || k === 'ㄴ')) {
      run.play.sort();
      return;
    }
  }

  // ─────────────────────────────────────── 디버그 손잡이 (?debug=1)
  private installDebug(): void {
    const api = {
      game: this.game,
      app: this,
      fast: (on = true) => {
        motion.fast = !!on;
        this.stage.classList.toggle('is-fast', !!on);
        return motion.fast;
      },
      autoplay: (steps = 400) => this.autoplay(steps),
      newRun: (mode: RunMode = 'quick', policy: PolicyId = 'heritage', seed?: number, playStyle: PlayStyle = 'learning') => this.newRun(mode, policy, playStyle, seed),
    };
    (window as unknown as { __sa: typeof api }).__sa = api;
    console.info('[오차드 2150] 디버그: window.__sa = { game, fast(on), autoplay(steps), newRun(mode, policy, seed) }');
    const seed = h('input', { type: 'number', min: '0', step: '1', value: '3', 'aria-label': '검증 시드' });
    const mode = h('select', { 'aria-label': '검증 연대기 길이' },
      h('option', { value: 'quick' }, '빠른 4시즌'), h('option', { value: 'full' }, '전체 8시즌'),
      h('option', { value: 'unit-sex' }, '성염색체'), h('option', { value: 'unit-chromo' }, '염색체 이상'), h('option', { value: 'unit-edit' }, '유전자 편집'));
    const style = h('select', { 'aria-label': '검증 진행 방식' }, h('option', { value: 'learning' }, '수업 모드'), h('option', { value: 'challenge' }, '도전 모드'));
    const status = h('output', { class: 'debug-panel__status', 'aria-live': 'polite' }, '검증 준비');
    const auto = button('자동 진행', () => {
      auto.disabled = true;
      status.textContent = '화면 조작 진행 중';
      void api.autoplay(700).then((result) => {
        status.textContent = `${result.phase} · 시즌 ${result.ante} · 주문 ${result.orderIdx + 1} · ${result.steps} 동작`;
      }).catch(() => { status.textContent = '자동 진행 실패 — 콘솔 확인'; }).finally(() => { auto.disabled = false; });
    }, { class: 'btn--ghost' });
    const fast = button('빠른 연출: 켜기', () => {
      const on = api.fast(!motion.fast);
      fast.textContent = `빠른 연출: ${on ? '끄기' : '켜기'}`;
    }, { class: 'btn--ghost' });
    const panel = h('details', { class: 'debug-panel', open: true },
      h('summary', null, '개발 검증 도구'),
      h('div', { class: 'debug-panel__controls' }, h('label', null, '시드 ', seed), mode, style,
        button('검증 시작', () => {
          const value = Number(seed.value);
          if (!Number.isSafeInteger(value) || value < 0) { status.textContent = '시드는 0 이상의 정수로 입력하세요.'; return; }
          api.newRun(mode.value as RunMode, 'heritage', value, style.value as PlayStyle);
          status.textContent = `시드 ${value} 검증 시작`;
        }, { class: 'btn--play' }), auto, fast, status),
    );
    document.getElementById('app')?.appendChild(panel);
    panel.addEventListener('toggle', () => this.fit());
    this.fit();
  }

  /** 봇처럼 교배·최선 출하·공방 나가기를 반복 (화면 동작을 그대로 거친다) */
  async autoplay(steps = 400): Promise<{ steps: number; phase: string; ante: number; orderIdx: number; roundScore: number; log: string[] }> {
    const log: string[] = [];
    let n = 0;
    for (let guard = 0; n < steps && guard < steps * 20; guard++) {
      await this.idle();
      const s = this.game.state;
      if (this.mode === 'title') {
        if (s.phase === 'title' || !this.game.hasSave()) this.newRun('quick', 'heritage');
        else this.startRun();
        continue;
      }
      if (s.phase === 'gameover' || s.phase === 'victory') break;
      if (s.phase === 'review') {
        log.push(`${s.ante}-${s.orderIdx} review: retry`);
        if (!this.game.retryOrder()) break;
        this.startRun();
        n++;
        continue;
      }
      // 발견 카드·일반 모달은 닫는다 (봉투 모달은 봇이 고른다)
      if (this.modals.count > 0 && !this.modals.has('modal--pack')) {
        this.modals.closeTop();
        continue;
      }
      const a = decide(this.game);
      log.push(this.describe(a));
      await this.perform(a);
      n++;
    }
    await this.idle();
    const s = this.game.state;
    return { steps: n, phase: s.phase, ante: s.ante, orderIdx: s.orderIdx, roundScore: s.roundScore, log: log.slice(-30) };
  }

  private describe(a: BotAction): string {
    const s = this.game.state;
    return `${s.ante}-${s.orderIdx} ${s.phase}: ${a.kind}${'uids' in a ? `(${a.uids.length})` : ''}`;
  }

  private async idle(): Promise<void> {
    for (let i = 0; i < 400 && (this.busy > 0 || this.toastFlush); i++) {
      await new Promise<void>((r) => setTimeout(r, motion.fast ? 0 : 50));
    }
    await tick();
    await tick();
  }

  private async perform(a: BotAction): Promise<void> {
    const run = this.run;
    if (!run) return applyDirect(this.game, a);
    switch (a.kind) {
      case 'cross':
        await run.cross.doCross(a.a === a.b, [a.a, a.b]);
        break;
      case 'play':
        await run.play.doPlay(a.uids);
        break;
      case 'discard':
        await run.play.doDiscard(a.uids);
        break;
      case 'collect':
        await run.cashout.collect();
        if (this.game.state.phase === 'cashout') {
          await new Promise<void>((r) => setTimeout(r, motion.fast ? 0 : 400));
          if (this.game.state.phase === 'cashout') this.game.collect();
        }
        break;
      case 'leave':
        run.shop.leave();
        break;
      case 'ackDiscoveries':
        if (this.modals.count > 0) this.modals.closeTop();
        else this.game.ackDiscoveries();
        break;
      default:
        applyDirect(this.game, a);
    }
    await tick();
  }
}
