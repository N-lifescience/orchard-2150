// ─────────────────────────────────────────────────────────────
// 효과음 레시피. 음높이는 지금 흐르는 배경음의 조를 따른다(theory.ts).
// Record<Sfx, …> 라서 계약에 효과음이 늘면 여기서 컴파일 에러가 난다.
// ─────────────────────────────────────────────────────────────
import type { Sfx } from '../contract/audio';
import { type Engine, type Out, openVoice } from './engine';
import {
  CHIME,
  COIN,
  GLASS,
  MARIMBA,
  MUSICBOX,
  WOOD,
  drone,
  fmBell,
  mallet,
  noiseHit,
  partial,
  sweep,
  wobble,
  type Partials,
} from './instruments';
import { clamp, deg, jitter, mtof, pentNote, rand, scaleNote, sfxRoot } from './theory';

interface Call {
  e: Engine;
  o: Out;
  /** 시작 시각 */
  t: number;
  /** 효과음 기준 으뜸음(MIDI) */
  R: number;
  /** 1부터. chip·mult·xmult·edit 의 음높이 단계 */
  step: number;
  /** 0..1 세기 */
  k: number;
}

interface Recipe {
  /** 리버브로 보내는 양 */
  wet: number;
  /** 보이스 전체 크기 배율 */
  level?: number;
  /** 같은 효과음의 최소 간격(초) — 연타·호버 폭주 방지 */
  gap: number;
  run(c: Call): void;
}

const TICK: Partials = [
  [1, 1, 0.08],
  [2.76, 0.3, 0.03],
];

const RECIPES: Record<Sfx, Recipe> = {
  // 종이 스침: 밴드패스 노이즈가 위로 쓸려 올라가고 끝에 아주 작은 '툭'
  deal: {
    wet: 0.05,
    gap: 0.025,
    run({ o, t }) {
      const r = jitter(0.15);
      noiseHit(o, t, {
        dur: 0.075,
        attack: 0.006,
        amp: 0.13,
        type: 'bandpass',
        freq: [
          [0, 1600 * r],
          [0.07, 5200 * r],
        ],
        q: 0.9,
        pan: rand() * 0.4 - 0.2,
      });
      sweep(o, t + 0.05, { f0: 260 * r, f1: 150 * r, dur: 0.035, amp: 0.05 });
    },
  },

  // 유리 톡(5음) — 살짝 아래에서 올라붙는다
  select: {
    wet: 0.12,
    gap: 0.03,
    run({ o, t, R }) {
      mallet(o, t, mtof(R + 24 + deg(4)), 0.11, GLASS, { decayScale: 0.12, from: 0.96 });
      sweep(o, t, { f0: 420, f1: 300, dur: 0.035, amp: 0.05 });
    },
  },

  // 유리 톡(3음) — 살짝 위에서 내려앉는다
  deselect: {
    wet: 0.1,
    gap: 0.03,
    run({ o, t, R }) {
      mallet(o, t, mtof(R + 24 + deg(2)), 0.085, GLASS, { decayScale: 0.1, from: 1.04 });
    },
  },

  // 아주 작은 고음 사인 틱
  hover: {
    wet: 0.05,
    gap: 0.045,
    run({ o, t, R }) {
      const f = mtof(R + 36 + deg(4)) * jitter(0.01);
      partial(o, t, f, 0.02, 0.002, 0.04);
      partial(o, t, f * 2.76, 0.005, 0.001, 0.02);
    },
  },

  // 출하: 나무 '쿵' + 휙 + 마림바 3화음(으뜸·5음·옥타브)
  play: {
    wet: 0.2,
    gap: 0.1,
    run({ o, t, R }) {
      sweep(o, t, { f0: 190, f1: 92, glide: 0.1, dur: 0.16, amp: 0.26 });
      noiseHit(o, t, {
        dur: 0.24,
        attack: 0.07,
        amp: 0.1,
        type: 'bandpass',
        freq: [
          [0, 500],
          [0.22, 3600],
        ],
        q: 0.8,
      });
      [R + 12, R + 19, R + 24].forEach((m, j) =>
        mallet(o, t + 0.06 + j * 0.018, mtof(m), 0.09, MARIMBA, { click: 0.25, decayScale: 0.8, pan: (j - 1) * 0.25 }),
      );
    },
  },

  // 가위 '싹둑': 날이 미끄러지는 노이즈 → 맞물리는 금속 딸깍(비배음 사인 3개) + 몸통
  discard: {
    wet: 0.08,
    gap: 0.06,
    run({ o, t }) {
      const r = jitter(0.06);
      noiseHit(o, t, {
        dur: 0.055,
        attack: 0.014,
        amp: 0.13,
        type: 'bandpass',
        freq: [
          [0, 3400 * r],
          [0.05, 7600 * r],
        ],
        q: 2.5,
      });
      const tc = t + 0.052;
      noiseHit(o, tc, { dur: 0.03, attack: 0.001, amp: 0.12, type: 'highpass', freq: 2600 * r, q: 0.8 });
      for (const [hz, a] of [
        [2350, 0.045],
        [3710, 0.035],
        [5230, 0.025],
      ] as const) {
        partial(o, tc, hz * r, a, 0.001, 0.06);
      }
      sweep(o, tc, { f0: 280, f1: 140, dur: 0.06, amp: 0.1 });
    },
  },

  // 칩: 마림바→유리로 음색이 바뀌며 펜타토닉을 한 칸씩 올라간다
  chip: {
    wet: 0.16,
    gap: 0.012,
    run({ o, t, R, step }) {
      const i = step - 1;
      const idx = i <= 14 ? i : 10 + ((i - 10) % 5); // 3옥타브 넘으면 맨 윗옥타브를 돈다
      const lvl = clamp(i / 12, 0, 1);
      const f = mtof(pentNote(idx, R + 12));
      const parts: Partials = [
        [1, 1, 0.75 + 0.25 * lvl],
        [3.93, 0.26 * (1 - 0.5 * lvl), 0.14],
        [2.76, 0.08 + 0.26 * lvl, 0.35],
        [5.4, 0.03 + 0.09 * lvl, 0.12],
        [9.2, 0.05, 0.04],
      ];
      mallet(o, t, f, 0.2 + 0.05 * lvl, parts, { click: 0.35, pan: clamp((idx - 7) * 0.05, -0.35, 0.35) });
      if (i >= 10) partial(o, t + 0.01, f * 4, Math.min(0.04, 0.02 + (i - 10) * 0.003), 0.002, 0.25);
    },
  },

  // 따뜻한 벨: FM(비 2, 배음 정렬) + 한 옥타브 아래 몸통. step 으로 한 칸씩 오른다
  mult: {
    wet: 0.3,
    gap: 0.02,
    run({ o, t, R, step }) {
      const f = mtof(pentNote(2 + clamp(step - 1, 0, 10), R + 12));
      fmBell(o, t, f, 0.2, { ratio: 2, index0: 2.2, index1: 0.25, decay: 1.6 });
      partial(o, t, f * 0.5, 0.09, 0.004, 1.0);
      partial(o, t, f * 3.01, 0.025, 0.002, 0.5);
      noiseHit(o, t, { dur: 0.02, attack: 0.001, amp: 0.05, type: 'bandpass', freq: Math.min(8000, f * 4), q: 2 });
    },
  },

  // 큰 벨: 금속성 FM(비 3.5) + 옥타브 따뜻한 벨 + 저음 무게 + 맥놀이 배음 + 유리 아르페지오 + 고역 반짝
  xmult: {
    wet: 0.42,
    gap: 0.03,
    run({ o, t, R, step }) {
      const i = clamp(step - 1, 0, 8);
      const f = mtof(pentNote(3 + i, R + 12));
      fmBell(o, t, f, 0.17, { ratio: 3.5, index0: 3.2, index1: 0.15, decay: 2.2 });
      fmBell(o, t, f * 2, 0.09, { ratio: 2, index0: 1.4, index1: 0.1, decay: 1.4, pan: 0.2 });
      partial(o, t, f * 0.5, 0.12, 0.003, 1.3);
      sweep(o, t, { f0: 180, f1: 90, dur: 0.25, amp: 0.12 });
      for (const [r, a, d, p] of [
        [3, 0.03, 1.2, -0.3],
        [3.006, 0.03, 1.2, 0.3],
        [5.04, 0.02, 0.8, -0.2],
        [6.93, 0.015, 0.6, 0.2],
      ] as const) {
        partial(o, t + 0.005, f * r, a, 0.004, d, { pan: p });
      }
      for (let j = 0; j < 5; j++) {
        const m = pentNote(Math.min(5 + j + Math.floor(i / 2), 11), R + 24);
        mallet(o, t + 0.05 + j * 0.035, mtof(m), 0.045, GLASS, { decayScale: 0.35, pan: j % 2 ? 0.35 : -0.35 });
      }
      noiseHit(o, t + 0.02, {
        dur: 0.6,
        attack: 0.03,
        amp: 0.045,
        type: 'highpass',
        freq: [
          [0, 6000],
          [0.6, 9500],
        ],
        q: 0.7,
      });
    },
  },

  // 나무 '톡' + 유리 '팅' + 잦아드는 비브라토(카드가 까딱 흔들림)
  jokerTrigger: {
    wet: 0.16,
    gap: 0.03,
    run({ o, t, R }) {
      const f = mtof(R + 24 + deg(4)) * jitter(0.01);
      mallet(o, t, f, 0.16, WOOD, { click: 0.6 });
      mallet(o, t + 0.055, mtof(R + 36 + deg(2)), 0.08, GLASS, { decayScale: 0.3, from: 1.03 });
      wobble(o, t + 0.01, f * 0.5, 0.05, 0.22, 17, 0.035);
    },
  },

  // 합산 시작: 위로 부푸는 노이즈 + 점점 빨라지며 오르는 유리 틱 + 끝의 작은 벨
  scoreTally: {
    wet: 0.2,
    level: 1.4,
    gap: 0.08,
    run({ o, t, R, k }) {
      const n = 8 + Math.round(k * 5);
      const T = 0.42 + 0.2 * k;
      noiseHit(o, t, {
        dur: T + 0.12,
        attack: T * 0.85,
        amp: 0.07,
        type: 'bandpass',
        freq: [
          [0, 350],
          [T, 3800],
        ],
        q: 1.3,
      });
      for (let i = 0; i < n; i++) {
        const tt = t + T * Math.pow(i / n, 0.7);
        mallet(o, tt, mtof(pentNote(i, R + 24)), 0.035 + 0.03 * (i / n), TICK);
      }
      fmBell(o, t + T + 0.02, mtof(R + 36), 0.07, { ratio: 2, index0: 1.5, index1: 0.2, decay: 0.8 });
    },
  },

  // 화르륵: 확 열렸다 잦아드는 밴드패스 노이즈 + 쉿 소리 + 타닥 불티 + 저음 붐
  fire: {
    wet: 0.25,
    gap: 0.15,
    run({ o, t, k }) {
      const D = 0.9 + 0.7 * k;
      noiseHit(o, t, {
        dur: D,
        attack: 0.05,
        hold: 0.08,
        amp: 0.3,
        type: 'bandpass',
        freq: [
          [0, 260],
          [0.13, 2400],
          [D, 520],
        ],
        q: 0.8,
      });
      noiseHit(o, t + 0.02, {
        dur: D * 0.8,
        attack: 0.04,
        amp: 0.07,
        type: 'highpass',
        freq: [
          [0, 3000],
          [0.2, 6500],
          [D * 0.8, 3500],
        ],
        q: 0.7,
      });
      noiseHit(o, t + 0.05, {
        dur: D,
        attack: 0.08,
        hold: D * 0.3,
        amp: 0.35,
        type: 'highpass',
        freq: 1400,
        q: 0.7,
        buffer: 'crackle',
      });
      sweep(o, t, { f0: 110, f1: 38, glide: 0.5, dur: 0.75, amp: 0.55 });
      sweep(o, t, { type: 'triangle', f0: 220, f1: 70, glide: 0.2, dur: 0.28, amp: 0.12, lp: 900 });
    },
  },

  // 맑은 동전 두 번: 5음 → 옥타브 으뜸 (맥놀이 쌍 + 비배음)
  coin: {
    wet: 0.16,
    gap: 0.04,
    run({ o, t, R }) {
      const tick = { dur: 0.012, attack: 0.001, amp: 0.05, type: 'highpass' as const, freq: 6000, q: 0.7 };
      mallet(o, t, mtof(R + 36 + deg(4)), 0.1, COIN, { attack: 0.001 });
      noiseHit(o, t, tick);
      mallet(o, t + 0.085, mtof(R + 48), 0.115, COIN, { attack: 0.001, decayScale: 1.2 });
      noiseHit(o, t + 0.085, tick);
    },
  },

  // 물건 내려놓는 '쿵' + 동전 + 위로 오르는 유리 두 음
  buy: {
    wet: 0.18,
    gap: 0.05,
    run({ o, t, R }) {
      sweep(o, t, { f0: 240, f1: 120, dur: 0.1, amp: 0.2 });
      noiseHit(o, t, { dur: 0.03, attack: 0.001, amp: 0.07, type: 'lowpass', freq: 1400, q: 0.7 });
      mallet(o, t + 0.05, mtof(R + 36 + deg(2)), 0.08, COIN, { attack: 0.001, decayScale: 0.6 });
      mallet(o, t + 0.12, mtof(R + 24 + deg(4)), 0.08, GLASS, { decayScale: 0.5 });
      mallet(o, t + 0.19, mtof(R + 36), 0.09, GLASS, { decayScale: 0.7 });
    },
  },

  // 내려가는 동전 세 번 + 짧은 휙
  sell: {
    wet: 0.18,
    gap: 0.05,
    run({ o, t, R }) {
      noiseHit(o, t, {
        dur: 0.2,
        attack: 0.03,
        amp: 0.05,
        type: 'bandpass',
        freq: [
          [0, 3200],
          [0.2, 1200],
        ],
        q: 1.2,
      });
      [R + 48, R + 36 + deg(4), R + 36 + deg(2)].forEach((m, j) =>
        mallet(o, t + 0.02 + j * 0.065, mtof(m), 0.085 - j * 0.01, COIN, {
          attack: 0.001,
          decayScale: 0.7,
          pan: (j - 1) * 0.25,
        }),
      );
    },
  },

  // 구슬 굴러가는 나무 틱 8개(느리게-빠르게-느리게) + 소용돌이 노이즈 + 끝의 마림바
  reroll: {
    wet: 0.12,
    gap: 0.08,
    run({ o, t, R }) {
      noiseHit(o, t, {
        dur: 0.4,
        attack: 0.1,
        amp: 0.05,
        type: 'bandpass',
        freq: [
          [0, 700],
          [0.2, 4200],
          [0.4, 1500],
        ],
        q: 2,
      });
      const n = 8;
      for (let j = 0; j < n; j++) {
        const x = j / (n - 1);
        const tt = t + 0.34 * (0.5 - 0.5 * Math.cos(Math.PI * x));
        const m = pentNote(3 + Math.floor(rand() * 8), R + 24);
        mallet(o, tt, mtof(m), 0.05, WOOD, { pan: rand() * 0.8 - 0.4 });
      }
      mallet(o, t + 0.4, mtof(R + 24), 0.08, MARIMBA, { decayScale: 0.5 });
    },
  },

  // 포장 찢기(불티 버퍼) → 오르골 5음이 올라가며 열림 + 공기 반짝
  packOpen: {
    wet: 0.35,
    gap: 0.1,
    run({ o, t, R }) {
      noiseHit(o, t, {
        dur: 0.26,
        attack: 0.01,
        hold: 0.12,
        amp: 0.3,
        type: 'bandpass',
        freq: [
          [0, 2600],
          [0.25, 1300],
        ],
        q: 0.9,
        buffer: 'crackle',
      });
      noiseHit(o, t, { dur: 0.22, attack: 0.02, amp: 0.05, type: 'highpass', freq: 3500, q: 0.7 });
      for (let j = 0; j < 5; j++) {
        mallet(o, t + 0.2 + j * 0.055, mtof(pentNote(j + 2, R + 24)), 0.065, MUSICBOX, {
          decayScale: 0.7,
          pan: (j - 2) * 0.15,
        });
      }
      noiseHit(o, t + 0.18, {
        dur: 0.8,
        attack: 0.25,
        amp: 0.03,
        type: 'highpass',
        freq: [
          [0, 5000],
          [0.8, 8000],
        ],
        q: 0.7,
      });
    },
  },

  // 꽃가루: 좌우로 흩어지는 고음 아르페지오(유리·오르골 번갈아) + 반짝이는 불티 노이즈
  cross: {
    wet: 0.45,
    gap: 0.1,
    run({ o, t, R }) {
      const start = 4 + Math.floor(rand() * 2);
      for (let j = 0; j < 7; j++) {
        const tt = t + j * 0.042 + rand() * 0.012;
        mallet(o, tt, mtof(pentNote(start + j, R + 24)), 0.055 * (1 - j * 0.05), j % 2 ? GLASS : MUSICBOX, {
          decayScale: 0.45,
          pan: j % 2 ? 0.4 : -0.4,
        });
      }
      noiseHit(o, t, {
        dur: 0.95,
        attack: 0.12,
        hold: 0.2,
        amp: 0.2,
        type: 'highpass',
        freq: [
          [0, 5500],
          [0.9, 8000],
        ],
        q: 0.8,
        buffer: 'crackle',
      });
      noiseHit(o, t, {
        dur: 0.7,
        attack: 0.2,
        amp: 0.025,
        type: 'bandpass',
        freq: [
          [0, 4000],
          [0.7, 9000],
        ],
        q: 1.5,
      });
    },
  },

  // 맑은 차임 3음: 으뜸 → 5음 → 한 옥타브 위 3음 (자유막대 배음 + 옥타브)
  discovery: {
    wet: 0.45,
    gap: 0.2,
    run({ o, t, R }) {
      [R + 24, R + 24 + deg(4), R + 36 + deg(2)].forEach((m, j) =>
        mallet(o, t + j * 0.16, mtof(m), 0.11 + j * 0.01, CHIME, { attack: 0.003, pan: (j - 1) * 0.3 }),
      );
    },
  },

  // 낮은 드론 스웰: 톱니(으뜸·5음·♭9) 공명 필터가 열렸다 닫힘 + 서브 + 먼 종
  bossReveal: {
    wet: 0.4,
    gap: 0.5,
    run({ o, t, R }) {
      const f = mtof(R - 12);
      drone(o, t, [f, f * 1.498, f * 2 * 1.0595], 0.32, {
        type: 'sawtooth',
        attack: 1.4,
        hold: 0.8,
        release: 1.6,
        spread: 9,
        filter: [
          [0, 110],
          [1.5, 900],
          [3.8, 140],
        ],
        q: 4,
      });
      drone(o, t, [f * 0.5], 0.3, { type: 'sine', attack: 1.0, hold: 1.0, release: 1.6, filter: [[0, 400]] });
      noiseHit(o, t, {
        dur: 3.6,
        attack: 1.4,
        hold: 0.6,
        amp: 0.08,
        type: 'lowpass',
        freq: [
          [0, 120],
          [1.5, 420],
          [3.6, 100],
        ],
        q: 0.8,
      });
      fmBell(o, t, mtof(R), 0.08, { ratio: 1.41, index0: 4, index1: 0.3, decay: 3.2 });
    },
  },

  // 내려가는 단조 벨(5 → ♭3 → 1) + 어두워지는 패드 + 시드는 미끄럼
  gameOver: {
    wet: 0.4,
    gap: 0.5,
    run({ e, o, t, R }) {
      [7, 3, 0].forEach((s, j) =>
        fmBell(o, t + j * 0.38, mtof(R + 24 + s), 0.13, {
          ratio: 2,
          index0: 1.6,
          index1: 0.15,
          decay: j === 2 ? 2.8 : 1.4,
        }),
      );
      drone(o, t + 0.05, [mtof(R - 12), mtof(R - 5), mtof(R + 3)], 0.12, {
        wave: e.waves.warm,
        attack: 0.6,
        hold: 0.8,
        release: 2.2,
        spread: 6,
        filter: [
          [0, 900],
          [3.5, 300],
        ],
      });
      sweep(o, t + 0.76, { f0: mtof(R + 12), f1: mtof(R), glide: 1.4, dur: 1.6, amp: 0.03, type: 'triangle', lp: 1200 });
    },
  },

  // 1-3-5-8-10-12-15 아르페지오(마림바→유리) → 벨 화음 + 으뜸 몸통 + 반짝이
  victory: {
    wet: 0.4,
    gap: 0.5,
    run({ o, t, R }) {
      [0, 2, 4, 7, 9, 11, 14].forEach((s, j) =>
        mallet(o, t + j * 0.07, mtof(scaleNote(s, R + 12)), 0.12, j < 4 ? MARIMBA : GLASS, {
          click: 0.3,
          pan: (j - 3) * 0.1,
        }),
      );
      const tc = t + 0.55;
      [R + 24, R + 24 + deg(2), R + 24 + deg(4), R + 36].forEach((m, j) =>
        fmBell(o, tc + j * 0.012, mtof(m), 0.075, {
          ratio: 2,
          index0: 1.8,
          index1: 0.12,
          decay: 2.6,
          pan: (j - 1.5) * 0.25,
        }),
      );
      partial(o, tc, mtof(R), 0.12, 0.01, 2.2);
      noiseHit(o, tc, {
        dur: 1.4,
        attack: 0.05,
        hold: 0.3,
        amp: 0.18,
        type: 'highpass',
        freq: [
          [0, 6000],
          [1.4, 8500],
        ],
        q: 0.7,
        buffer: 'crackle',
      });
    },
  },

  // 부드러운 둔탁음 두 번(삼각파 + LPF, 음높이 살짝 떨어짐)
  error: {
    wet: 0.03,
    gap: 0.12,
    run({ o, t }) {
      sweep(o, t, { type: 'triangle', f0: 175, f1: 100, glide: 0.1, dur: 0.14, amp: 0.2, lp: 700 });
      noiseHit(o, t, { dur: 0.05, attack: 0.002, amp: 0.05, type: 'lowpass', freq: 500, q: 0.7 });
      sweep(o, t + 0.09, { type: 'triangle', f0: 140, f1: 82, glide: 0.1, dur: 0.14, amp: 0.13, lp: 600 });
    },
  },

  // 디지털 틱: 필터 거친 사각파 두 번(음 → 5도 위) + 아주 짧은 고역 노이즈
  edit: {
    wet: 0.05,
    gap: 0.02,
    run({ o, t, R, step }) {
      const f = mtof(pentNote((step - 1) % 8, R + 36));
      partial(o, t, f, 0.035, 0.001, 0.028, { type: 'square', lp: 5000 });
      partial(o, t + 0.022, f * 1.5, 0.022, 0.001, 0.02, { type: 'square', lp: 6000 });
      noiseHit(o, t, { dur: 0.008, attack: 0.0005, amp: 0.03, type: 'highpass', freq: 7000, q: 0.7 });
    },
  },
};

export const SFX_NAMES = Object.keys(RECIPES) as Sfx[];

const lastAt = new Map<Sfx, number>();

export function playSfx(e: Engine, s: Sfx, opts?: { step?: number; intensity?: number }): void {
  const r = RECIPES[s];
  if (!r) return; // 계약 밖 이름(런타임) — 조용히 무시
  const now = e.ctx.currentTime;
  const last = lastAt.get(s);
  if (last !== undefined && now - last < r.gap && now >= last) return;
  lastAt.set(s, now);
  const rawK = opts?.intensity;
  const k = typeof rawK === 'number' && Number.isFinite(rawK) ? clamp(rawK, 0, 1) : 0.5;
  const rawStep = opts?.step;
  const step = typeof rawStep === 'number' && Number.isFinite(rawStep) ? Math.max(1, Math.floor(rawStep)) : 1;
  const vel = 0.75 + 0.5 * k;
  const { out, close } = openVoice(e, r.wet, (r.level ?? 1) * vel);
  try {
    r.run({ e, o: out, t: now + 0.005, R: sfxRoot(), step, k });
  } finally {
    close();
  }
}
