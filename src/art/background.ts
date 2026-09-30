// 배경: 밤의 온실. 도메인 워핑 fbm 소용돌이 + 생물발광 실타래 + 포자 + 비네트 + 필름 그레인.
// WebGL 이 없으면 CSS 그라데이션으로 대체한다.
import type { BackgroundHandle } from '../contract/art';
import { hexToRgb } from './color';

type RGB = [number, number, number];
interface Pal {
  deep: RGB;
  mid: RGB;
  glow: RGB;
  accent: RGB;
}

const c = (h: string): RGB => {
  const [r, g, b] = hexToRgb(h);
  return [r / 255, g / 255, b / 255];
};

/** 계절 팔레트: 1–2 청록/에메랄드, 3–4 금빛 호박, 5–6 자홍/보라, 7–8 남청/은빛 */
const SEASONS: Pal[] = [
  { deep: c('#020d0b'), mid: c('#0b3e36'), glow: c('#2fd4c4'), accent: c('#1fae7a') },
  { deep: c('#0d0802'), mid: c('#4a3008'), glow: c('#f2b632'), accent: c('#e0782a') },
  { deep: c('#0c0314'), mid: c('#3a0f48'), glow: c('#ff4f8b'), accent: c('#9b5cff') },
  { deep: c('#020612'), mid: c('#142450'), glow: c('#c2d2ff'), accent: c('#6a82d8') },
];
const CSS_SEASONS = [
  ['#0b3e36', '#2fd4c4', '#020d0b'],
  ['#4a3008', '#f2b632', '#0d0802'],
  ['#3a0f48', '#ff4f8b', '#0c0314'],
  ['#142450', '#c2d2ff', '#020612'],
];

const seasonIndex = (ante: number) => Math.max(0, Math.min(3, Math.floor((Math.max(1, Math.round(ante || 1)) - 1) / 2)));

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uReal;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uGlow;
uniform vec3 uAccent;
uniform float uBoss;
uniform float uBeat;
uniform float uPulse;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  // 느린 소용돌이 (가운데일수록 더 감김)
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  ang += 0.9 * exp(-r * 1.6) * sin(t * 0.05) + t * 0.012;
  vec2 sw = vec2(cos(ang), sin(ang)) * r;
  vec2 p = sw * 1.7;

  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.035)), fbm(p + vec2(5.2, 1.3) - t * 0.027));
  vec2 w = vec2(fbm(p + 3.6 * q + vec2(1.7, 9.2) + t * 0.045), fbm(p + 3.6 * q + vec2(8.3, 2.8) - t * 0.038));
  float f = fbm(p + 3.2 * w);

  vec3 col = mix(uDeep, uMid, smoothstep(0.18, 0.88, f));
  col = mix(col, uAccent * 0.55, clamp(dot(q, q) * 0.55 * w.y, 0.0, 0.55));
  // 생물발광 실타래 (워프 장의 능선)
  float ridge = 1.0 - abs(w.x - 0.5) * 2.0;
  ridge = pow(clamp(ridge, 0.0, 1.0), 9.0);
  float ridge2 = pow(clamp(1.0 - abs(q.y - 0.55) * 2.4, 0.0, 1.0), 12.0);
  col += uGlow * (ridge * 0.42 + ridge2 * 0.18) * (0.45 + 0.8 * f);
  col += uGlow * pow(f, 4.0) * 0.55;

  // 떠오르는 포자
  vec2 sp = uv * 7.0 + vec2(0.0, -t * 0.09);
  vec2 id = floor(sp); vec2 gv = fract(sp) - 0.5;
  float h = hash(id);
  vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.7;
  float d = length(gv - off);
  float tw = 0.5 + 0.5 * sin(uReal * (0.8 + h * 1.6) + h * 40.0);
  col += uGlow * smoothstep(0.07, 0.0, d) * step(0.78, h) * tw * 0.9;
  col += uGlow * smoothstep(0.22, 0.0, d) * step(0.78, h) * tw * 0.12;

  // 보스: 짙은 진홍이 섞이고 맥동
  vec3 crimson = vec3(0.42, 0.015, 0.06);
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  vec3 bossCol = mix(vec3(0.05, 0.0, 0.012), crimson, smoothstep(0.02, 0.4, lum)) + crimson * ridge * 0.5;
  col = mix(col, bossCol, uBoss * 0.82);
  col += crimson * uBoss * uBeat * 0.22 * (0.25 + ridge);

  // 비네트
  float vig = smoothstep(1.35, 0.2, length(uv * vec2(0.85, 1.05)));
  col *= mix(0.28, 1.0, vig);
  // 한 번 번쩍
  col += uPulse * (uGlow * 0.4 + 0.06) * (0.35 + 0.65 * vig);

  // 필름 그레인
  float g = hash(gl_FragCoord.xy + fract(uReal * 7.13) * 91.7) - 0.5;
  col += g * 0.05;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[art] shader compile failed', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

const lerp3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clonePal = (p: Pal): Pal => ({ deep: [...p.deep], mid: [...p.mid], glow: [...p.glow], accent: [...p.accent] });

/** 해상도 배율 (0.5 로 그리고 CSS 로 늘린다) */
const RENDER_SCALE = 0.5;

export function createBackground(canvas: HTMLCanvasElement): BackgroundHandle {
  canvas.classList.add('sa-bg');
  let reduced = false;
  try {
    reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    reduced = false;
  }
  let season = 0;
  let bossTarget = 0;
  let boss = 0;
  let pulse = 0;
  let running = false;
  let raf = 0;
  let last = 0;
  let sim = 17.3;
  let real = 0;
  const cur = clonePal(SEASONS[0]);

  const applyCss = () => {
    const s = CSS_SEASONS[season];
    canvas.style.setProperty('--sa-bg-mid', s[0]);
    canvas.style.setProperty('--sa-bg-glow', s[1]);
    canvas.style.setProperty('--sa-bg-deep', s[2]);
    canvas.classList.toggle('is-boss', bossTarget > 0.5);
  };

  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  } catch {
    gl = null;
  }

  let prog: WebGLProgram | null = null;
  const U: Record<string, WebGLUniformLocation | null> = {};

  const init = (): boolean => {
    if (!gl) return false;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const p = gl.createProgram();
    if (!p) return false;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('[art] program link failed', gl.getProgramInfoLog(p));
      return false;
    }
    prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uTime', 'uReal', 'uDeep', 'uMid', 'uGlow', 'uAccent', 'uBoss', 'uBeat', 'uPulse']) U[n] = gl.getUniformLocation(p, n);
    return true;
  };

  let webgl = init();
  if (!webgl) {
    canvas.classList.add('sa-bg-fallback');
    canvas.dataset.saBg = 'css';
  } else {
    canvas.dataset.saBg = 'webgl';
  }
  applyCss();

  const resize = () => {
    if (!gl || !webgl) return;
    const dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
    const cw = canvas.clientWidth || (typeof innerWidth === 'number' ? innerWidth : 800);
    const ch = canvas.clientHeight || (typeof innerHeight === 'number' ? innerHeight : 600);
    const w = Math.max(1, Math.round(cw * dpr * RENDER_SCALE));
    const h = Math.max(1, Math.round(ch * dpr * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    // 멈춘 상태에서 크기가 바뀌면 캔버스가 지워지므로 한 장 다시 그린다
    if (!running) draw();
  };

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize());
    ro.observe(canvas);
  } else if (typeof addEventListener === 'function') {
    addEventListener('resize', resize);
  }

  const draw = () => {
    if (!gl || !webgl || !prog) return;
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, sim);
    gl.uniform1f(U.uReal, reduced ? 0 : real);
    gl.uniform3fv(U.uDeep, cur.deep);
    gl.uniform3fv(U.uMid, cur.mid);
    gl.uniform3fv(U.uGlow, cur.glow);
    gl.uniform3fv(U.uAccent, cur.accent);
    gl.uniform1f(U.uBoss, boss);
    gl.uniform1f(U.uBeat, reduced ? 0.4 : 0.5 + 0.5 * Math.sin(real * 2.4));
    gl.uniform1f(U.uPulse, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const frame = (now: number) => {
    if (!running) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    real += dt;
    sim += dt * (reduced ? 0.04 : 1);
    const target = SEASONS[season];
    const kk = 1 - Math.exp(-dt * 1.4);
    cur.deep = lerp3(cur.deep, target.deep, kk);
    cur.mid = lerp3(cur.mid, target.mid, kk);
    cur.glow = lerp3(cur.glow, target.glow, kk);
    cur.accent = lerp3(cur.accent, target.accent, kk);
    boss += (bossTarget - boss) * (1 - Math.exp(-dt * 2));
    pulse *= Math.exp(-dt * (reduced ? 6 : 3.2));
    if (pulse < 0.002) pulse = 0;
    draw();
    raf = requestAnimationFrame(frame);
  };

  if (gl) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      webgl = false;
      cancelAnimationFrame(raf);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      webgl = init();
      if (webgl) {
        resize();
        if (running) {
          last = 0;
          raf = requestAnimationFrame(frame);
        }
      }
    });
  }

  resize();
  draw();

  return {
    start() {
      if (running) return;
      running = true;
      if (!webgl) return;
      last = 0;
      resize();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setSeason(ante: number) {
      season = seasonIndex(ante);
      applyCss();
      if (!running) {
        Object.assign(cur, clonePal(SEASONS[season]));
        draw();
      }
    },
    setBoss(on: boolean) {
      bossTarget = on ? 1 : 0;
      applyCss();
      if (!running) {
        boss = bossTarget;
        draw();
      }
    },
    pulse(strength: number) {
      const s = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0.5));
      pulse = Math.max(pulse, reduced ? s * 0.35 : s);
      if (!webgl) {
        canvas.classList.remove('is-pulse');
        void canvas.offsetWidth;
        canvas.classList.add('is-pulse');
      }
    },
    setReducedMotion(on: boolean) {
      reduced = !!on;
    },
  };
}
