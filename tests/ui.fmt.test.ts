import { describe, expect, it } from 'vitest';
import { comma, josa, mult, money, sanitizeBrand, sanitizeLine, score, short } from '../src/ui/fmt';

describe('숫자 표기', () => {
  it('천 단위 쉼표', () => {
    expect(comma(0)).toBe('0');
    expect(comma(999)).toBe('999');
    expect(comma(1500)).toBe('1,500');
    expect(comma(1234567)).toBe('1,234,567');
    expect(comma(-2500)).toBe('−2,500');
    expect(comma(12.5)).toBe('12.5');
    expect(comma(Number.NaN)).toBe('0');
  });

  it('큰 수는 만·억', () => {
    expect(short(9999)).toBe('9,999');
    expect(short(12000)).toBe('1.2만');
    expect(short(100000)).toBe('10만');
    expect(short(2_500_000)).toBe('250만');
    expect(short(120_000_000)).toBe('1.2억');
  });

  it('점수판은 100만 미만이면 정확히', () => {
    expect(score(8778)).toBe('8,778');
    expect(score(110000)).toBe('110,000');
    expect(score(999_999.9)).toBe('999,999');
    expect(score(3_400_000)).toBe('340만');
  });

  it('배수·돈', () => {
    expect(mult(7)).toBe('7');
    expect(mult(10.5)).toBe('10.5');
    expect(mult(10.25)).toBe('10.3');
    expect(money(12)).toBe('$12');
  });

  it('조사', () => {
    expect(josa('루비', '을를')).toBe('루비를');
    expect(josa('엘레나 로시의 골드', '을를')).toBe('엘레나 로시의 골드를');
    expect(josa('3세대 선발 2호', '을를')).toBe('3세대 선발 2호를');
    expect(josa('별다래 수그루', '이가')).toBe('별다래 수그루가');
    expect(josa('온실', '은는')).toBe('온실은');
  });
});

describe('입력 정리 (개인정보 칸)', () => {
  it('브랜드 이름은 12자까지, 제어문자·꺾쇠 제거', () => {
    expect(sanitizeBrand('  달빛   과수원  ')).toBe('달빛 과수원');
    expect(sanitizeBrand('<b>달빛</b>')).toBe('b달빛/b');
    expect(sanitizeBrand('가나다라마바사아자차카타파하')).toBe('가나다라마바사아자차카타');
    expect(Array.from(sanitizeBrand('🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓🍓')).length).toBe(12);
    expect(sanitizeBrand('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeBrand(undefined as unknown as string)).toBe('');
  });

  it('성찰 한 줄은 200자까지, 제어문자는 공백으로', () => {
    expect(sanitizeLine('가\n나')).toBe('가 나');
    expect(sanitizeLine('x'.repeat(500)).length).toBe(200);
  });
});
