// 숫자·문구 표기 — DOM 없는 순수 함수 (tests/ui.fmt.test.ts)

/** 천 단위 쉼표. 소수는 한 자리까지 */
export function comma(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  const abs = Math.abs(n);
  const int = Math.floor(abs + 1e-9);
  const frac = abs - int;
  let s = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (frac >= 0.05) s += '.' + String(Math.round(frac * 10) % 10);
  return (neg ? '−' : '') + s;
}

function trimDec(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** 짧은 표기: 1만 미만은 쉼표, 1만 이상은 '1.2만', 1억 이상은 '1.2억' */
export function short(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1e8) return sign + trimDec(abs / 1e8, abs >= 1e10 ? 0 : 1) + '억';
  if (abs >= 1e4) return sign + trimDec(abs / 1e4, abs >= 1e6 ? 0 : 1) + '만';
  return comma(n);
}

/** 점수판 표기: 100만 미만은 전부 쉼표(목표와 겨룰 때 정확해야 하니까), 그 이상은 짧게 */
export function score(n: number): string {
  return Math.abs(n) < 1e6 ? comma(Math.floor(n)) : short(n);
}

/** 배수 표기 (소수 한 자리) */
export function mult(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1e4) return short(n);
  return Number.isInteger(n) ? comma(n) : trimDec(n, 1);
}

export function money(n: number): string {
  return `$${comma(n)}`;
}

/** 조사: 받침 유무로 '을/를', '이/가', '은/는', '과/와' 고르기 */
export function josa(word: string, pair: '을를' | '이가' | '은는' | '과와'): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  let batchim = false;
  if (code >= 0xac00 && code <= 0xd7a3) batchim = (code - 0xac00) % 28 !== 0;
  else if (/[0-9]/.test(last)) batchim = '013678'.includes(last);
  else if (/[a-zA-Z]/.test(last)) batchim = /[lmnr]/i.test(last);
  return word + (batchim ? pair[0] : pair[1]);
}

/** 문자열 해시 (그림 시드용) */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 브랜드 이름: 앞뒤 공백·제어문자 제거, 최대 12자(코드포인트 기준) */
export function sanitizeBrand(raw: string, max = 12): string {
  const cleaned = Array.from(String(raw ?? ''))
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c >= 0x20 && c !== 0x7f && !(c >= 0x80 && c < 0xa0) && ch !== '<' && ch !== '>';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, max).join('').trim();
}

/** 성찰 한 줄: 제어문자 제거, 최대 200자 */
export function sanitizeLine(raw: string, max = 200): string {
  return Array.from(String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' '))
    .slice(0, max)
    .join('')
    .trim();
}
