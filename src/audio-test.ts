// 소리 시험대: 모든 효과음, 칩 쌓임, 배경음 장면·계절·보스 전환, 볼륨.
// 요소는 createElement 로만 만든다(innerHTML 없음).
import { audio, audioDebug } from './audio';
import type { Sfx } from './contract/audio';

type Scene = 'title' | 'run' | 'shop' | 'end';

const LABELS: Record<Sfx, string> = {
  deal: '카드 들어옴',
  select: '고름',
  deselect: '고름 해제',
  hover: '호버',
  play: '출하',
  discard: '솎아내기(가위)',
  chip: '칩',
  mult: '배수 +',
  xmult: '배수 ×',
  jokerTrigger: '비법 발동',
  scoreTally: '점수 합산',
  fire: '목표 돌파(불꽃)',
  coin: '돈 받기',
  buy: '사기',
  sell: '팔기',
  reroll: '다시 뽑기',
  packOpen: '꾸러미 열기',
  cross: '교배(꽃가루)',
  discovery: '개념 발견',
  bossReveal: '보스 등장',
  gameOver: '게임 끝',
  victory: '승리',
  error: '안 되는 행동',
  edit: '염기 편집',
};

// ── 작은 도우미 ─────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<'className' | 'textContent' | 'title', string>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (props.className) n.className = props.className;
  if (props.textContent) n.textContent = props.textContent;
  if (props.title) n.title = props.title;
  for (const c of children) n.append(c);
  return n;
}

function button(label: string, sub: string | null, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', { className: cls });
  b.type = 'button';
  b.append(label);
  if (sub) b.append(el('small', { textContent: sub }));
  b.addEventListener('click', () => guard(label, onClick));
  return b;
}

function slider(label: string, value: number, onInput: (v: number) => void): HTMLLabelElement {
  const input = el('input');
  input.type = 'range';
  input.min = '0';
  input.max = '1';
  input.step = '0.01';
  input.value = String(value);
  const out = el('span', { className: 'val', textContent: value.toFixed(2) });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = v.toFixed(2);
    guard(label, () => onInput(v));
  });
  return el('label', {}, [label, input, out]);
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── 기록·예외 세기 ──────────────────────────────────────────

let errors = 0;
let calls = 0;
const logBox = el('pre');
const lines: string[] = [];
function log(msg: string): void {
  const d = new Date();
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
  lines.unshift(`${t}  ${msg}`);
  if (lines.length > 60) lines.length = 60;
  logBox.textContent = lines.join('\n');
}
function guard(what: string, fn: () => void): void {
  calls++;
  try {
    fn();
  } catch (err) {
    errors++;
    log(`예외: ${what} — ${String(err)}`);
    console.error(err);
  }
}
const origError = console.error.bind(console);
console.error = (...args: unknown[]): void => {
  errors++;
  origError(...args);
};
window.addEventListener('error', (ev) => {
  errors++;
  log(`window error: ${ev.message}`);
});
window.addEventListener('unhandledrejection', (ev) => {
  errors++;
  log(`unhandled rejection: ${String(ev.reason)}`);
});

// ── 상태 ────────────────────────────────────────────────────

let intensity = 0.5;
let stepVal = 1;
let chipGap = 160;
const music: { ante: number; boss: boolean; scene: Scene | null } = { ante: 1, boss: false, scene: null };

function applyMusic(): void {
  audio.music(music.scene ? { ante: music.ante, boss: music.boss, scene: music.scene } : null);
  log(`music(${music.scene ? JSON.stringify({ ante: music.ante, boss: music.boss, scene: music.scene }) : 'null'})`);
  refreshMusicButtons();
}

function play(s: Sfx, step?: number): void {
  audio.play(s, { step: step ?? stepVal, intensity });
}

// 첫 입력 때 잠금 해제(게임에서도 이렇게 부른다)
const unlockOnce = (): void => audio.unlock();
window.addEventListener('pointerdown', unlockOnce, { capture: true });
window.addEventListener('keydown', unlockOnce, { capture: true });

// ── 화면 ────────────────────────────────────────────────────

const app = document.getElementById('app');
if (!app) throw new Error('#app 없음');

const status = el('div', { className: 'status' });
app.append(
  el('h1', { textContent: '소리 시험대' }),
  el('p', {
    className: 'lead',
    textContent: '오차드 2150 — 화면을 한 번 누르면 소리가 켜져요. 모든 소리는 브라우저에서 만듭니다.',
  }),
);

// 1) 잠금·상태
const top = el('section');
top.append(
  el('h2', { textContent: '상태' }),
  el('div', { className: 'row' }, [
    button('소리 켜기', 'unlock()', () => {
      audio.unlock();
      log('unlock()');
    }, 'big'),
    status,
  ]),
);
app.append(top);

// 2) 볼륨
const vols = audioDebug.volumes();
const cur = { ...vols };
const mute = el('input');
mute.type = 'checkbox';
mute.checked = audio.muted;
mute.addEventListener('change', () =>
  guard('setMuted', () => {
    audio.setMuted(mute.checked);
    log(`setMuted(${mute.checked}) → muted=${audio.muted}`);
  }),
);
const volSec = el('section');
volSec.append(
  el('h2', { textContent: '볼륨 (localStorage 에 저장돼요)' }),
  el('div', { className: 'row' }, [
    slider('전체', cur.master, (v) => {
      cur.master = v;
      audio.setVolume(cur.master, cur.music, cur.sfx);
    }),
    slider('음악', cur.music, (v) => {
      cur.music = v;
      audio.setVolume(cur.master, cur.music, cur.sfx);
    }),
    slider('효과음', cur.sfx, (v) => {
      cur.sfx = v;
      audio.setVolume(cur.master, cur.music, cur.sfx);
    }),
    el('label', {}, [mute, '음소거']),
  ]),
);
app.append(volSec);

// 3) 효과음 전부
const stepInput = el('input');
stepInput.type = 'number';
stepInput.min = '1';
stepInput.max = '30';
stepInput.value = '1';
stepInput.style.width = '64px';
stepInput.addEventListener('input', () => {
  stepVal = Math.max(1, Math.floor(Number(stepInput.value) || 1));
});
const sfxGrid = el('div', { className: 'grid' });
for (const s of audioDebug.sfxNames()) {
  sfxGrid.append(
    button(LABELS[s], s, () => {
      play(s);
      log(`play('${s}', step ${stepVal}, 세기 ${intensity.toFixed(2)})`);
    }),
  );
}
const sfxSec = el('section');
sfxSec.append(
  el('h2', { textContent: `효과음 ${audioDebug.sfxNames().length}종` }),
  el('div', { className: 'row' }, [
    slider('세기(intensity)', intensity, (v) => {
      intensity = v;
    }),
    el('label', {}, ['step', stepInput]),
  ]),
  sfxGrid,
);
sfxGrid.style.marginTop = '10px';
app.append(sfxSec);

// 4) 쌓이는 느낌
async function chipRun(from: number, to: number): Promise<void> {
  for (let i = from; i <= to; i++) {
    guard(`chip ${i}`, () => play('chip', i));
    await wait(chipGap);
  }
}
async function scoringDemo(): Promise<void> {
  log('점수 연출: 출하 → 칩 1–6 → 배수+ ×3 → 비법 → 배수× → 합산 → 불꽃 → 동전');
  guard('play', () => play('play'));
  await wait(380);
  await chipRun(1, 6);
  for (let i = 1; i <= 3; i++) {
    guard('mult', () => play('mult', i));
    await wait(chipGap + 60);
  }
  guard('jokerTrigger', () => play('jokerTrigger'));
  await wait(200);
  guard('xmult', () => play('xmult', 1));
  await wait(650);
  guard('scoreTally', () => play('scoreTally'));
  await wait(700);
  guard('fire', () => audio.play('fire', { intensity: 0.9 }));
  await wait(900);
  guard('coin', () => play('coin'));
}
const stackSec = el('section');
stackSec.append(
  el('h2', { textContent: '쌓임 확인' }),
  el('div', { className: 'row' }, [
    button('칩 1 → 10', '연속', () => void chipRun(1, 10), 'big'),
    button('칩 1 → 20', '윗옥타브 순환까지', () => void chipRun(1, 20)),
    button('배수+ 1 → 6', 'mult step', () => {
      void (async () => {
        for (let i = 1; i <= 6; i++) {
          guard('mult', () => play('mult', i));
          await wait(chipGap + 80);
        }
      })();
    }),
    button('점수 연출 한 판', '칩·배수·합산·불꽃', () => void scoringDemo(), 'big'),
    slider('간격', chipGap / 400, (v) => {
      chipGap = Math.round(60 + v * 340);
    }),
  ]),
);
app.append(stackSec);

// 5) 배경음
const sceneBtns = new Map<Scene | null, HTMLButtonElement>();
const anteBtns = new Map<number, HTMLButtonElement>();
const bossBtn = button('보스', 'boss 켜기/끄기', () => {
  music.boss = !music.boss;
  applyMusic();
});
function refreshMusicButtons(): void {
  for (const [k, b] of sceneBtns) b.classList.toggle('on', k === music.scene);
  for (const [k, b] of anteBtns) b.classList.toggle('on', k === music.ante);
  bossBtn.classList.toggle('on', music.boss);
}
const scenes: [Scene | null, string][] = [
  ['title', '타이틀'],
  ['run', '주문(플레이)'],
  ['shop', '상점'],
  ['end', '결과'],
  [null, '끄기'],
];
const sceneRow = el('div', { className: 'row' });
for (const [s, label] of scenes) {
  const b = button(label, s ?? 'null', () => {
    music.scene = s;
    applyMusic();
  });
  sceneBtns.set(s, b);
  sceneRow.append(b);
}
const SEASON = ['', '봄', '봄', '여름', '여름', '가을', '가을', '겨울', '겨울'];
const anteRow = el('div', { className: 'row' });
for (let a = 1; a <= 8; a++) {
  const b = button(`앤티 ${a}`, SEASON[a] ?? '', () => {
    music.ante = a;
    if (!music.scene) music.scene = 'run';
    applyMusic();
  });
  anteBtns.set(a, b);
  anteRow.append(b);
}
anteRow.append(bossBtn);
anteRow.style.marginTop = '8px';
const musicSec = el('section');
musicSec.append(
  el('h2', { textContent: '배경음 (장면 전환은 2초 크로스페이드)' }),
  sceneRow,
  anteRow,
);
app.append(musicSec);
refreshMusicButtons();

// 6) 전체 점검: 효과음 전부 + 배경음 조합 전부를 차례로 불러 예외를 센다
const checkOut = el('span', { className: 'status' });
async function fullCheck(): Promise<void> {
  const before = errors;
  audio.unlock();
  log('전체 점검 시작');
  for (const s of audioDebug.sfxNames()) {
    guard(`play ${s}`, () => audio.play(s, { step: 3, intensity: 0.6 }));
    await wait(120);
  }
  // 이상한 입력도 조용히 견뎌야 한다
  guard('play step NaN', () => audio.play('chip', { step: Number.NaN, intensity: Number.POSITIVE_INFINITY }));
  guard('play step 999', () => audio.play('chip', { step: 999, intensity: -3 }));
  guard('setVolume 범위 밖', () => audio.setVolume(cur.master, cur.music, cur.sfx));
  const sc: (Scene | null)[] = ['title', 'run', 'shop', 'end', null];
  for (const scene of sc) {
    for (const ante of [1, 3, 5, 7, 9]) {
      for (const boss of [false, true]) {
        guard('music', () => audio.music(scene ? { ante, boss, scene } : null));
      }
    }
    await wait(60);
  }
  music.scene = 'run';
  music.ante = 1;
  music.boss = false;
  applyMusic();
  await wait(2600);
  const n = errors - before;
  checkOut.textContent = n === 0 ? `예외 0 · 호출 ${calls}회` : `예외 ${n}건`;
  checkOut.className = `status ${n === 0 ? 'ok' : 'bad'}`;
  log(`전체 점검 끝 — 예외 ${n}건`);
}
const checkSec = el('section');
checkSec.append(
  el('h2', { textContent: '전체 점검' }),
  el('div', { className: 'row' }, [button('모든 버튼 차례로', '효과음 24종 + 배경음 50조합', () => void fullCheck(), 'big'), checkOut]),
);
app.append(checkSec);

// 7) 기록
const logSec = el('section');
logSec.append(el('h2', { textContent: '기록' }), logBox);
app.append(logSec);

function refreshStatus(): void {
  const s = audioDebug.stats();
  status.textContent =
    `상태 ${s.state} · 효과음 보이스 ${s.voices} · 음악 레이어 ${s.layers} (소스 ${s.musicSources})` +
    ` · ${s.musicKey ?? '배경음 없음'} · 음소거 ${audio.muted ? '켬' : '끔'} · 예외 ${errors}`;
}
setInterval(refreshStatus, 400);
refreshStatus();

// 콘솔에서 확인용
(window as unknown as { __audioTest: unknown }).__audioTest = { audio, audioDebug, fullCheck, errors: () => errors };
