import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { explainImage, traitBadge } from '../src/ui/traitBadge';
import { colorPredictionChoices } from '../src/ui/predictionChoices';
import { conceptPicture, CONCEPT_PICTURES } from '../src/ui/conceptPlate';
import { difficultyBadge } from '../src/ui/difficultyBadge';
import type { ConceptId, Difficulty } from '../src/contract/game';

// Minimal DOM ownership/event surface: execute the real h()/renderers, without
// mocking their output or claiming browser layout measurements.
class DomNode extends EventTarget {
  childNodes: DomNode[] = [];
  constructor(private text = '') { super(); }
  appendChild(node: DomNode) { this.childNodes.push(node); return node; }
  prepend(...nodes: DomNode[]) { this.childNodes.unshift(...nodes); }
  get textContent(): string { return this.text + this.childNodes.map((node) => node.textContent).join(''); }
  get children(): DomElement[] { return this.childNodes.filter((node): node is DomElement => node instanceof DomElement); }
}
class DomElement extends DomNode {
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: (_key: string, _value: string) => {} };
  hidden = false;
  disabled = false;
  readonly tagName: string;
  constructor(tag: string) { super(); this.tagName = tag.toUpperCase(); }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name) ?? null; }
}
const dom = (node: HTMLElement) => node as unknown as DomElement;
const hasClass = (node: DomElement, name: string) => node.getAttribute('class')?.split(/\s+/).includes(name) ?? false;
function descendants(node: DomElement): DomElement[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

beforeEach(() => vi.stubGlobal('document', {
  createElement: (tag: string) => new DomElement(tag),
  createTextNode: (value: string) => new DomNode(value),
}));
afterEach(() => vi.unstubAllGlobals());

describe('설명 그림의 공통 DOM과 예측 선택지', () => {
  it('단독 설명 그림에도 크기 규칙을 공유하는 클래스가 붙는다', () => {
    const img = dom(explainImage('trait-flesh-ruby'));
    expect(img.tagName).toBe('IMG');
    expect(hasClass(img, 'explain-image')).toBe(true);
    expect(img.getAttribute('src')).toBe('explain/trait-flesh-ruby.webp');
  });
  it('그림이 실패하면 그림만 숨기고 형질 이름은 남긴다', () => {
    const badge = dom(traitBadge({ color: 'ruby', marked: true }, '루비, 별무늬', false));
    const images = descendants(badge).filter((node) => node.tagName === 'IMG');
    expect(images).toHaveLength(2);
    images.forEach((img) => { expect(hasClass(img, 'explain-image')).toBe(true); img.dispatchEvent(new Event('error')); });
    expect(images.every((img) => img.hidden)).toBe(true);
    expect(badge.textContent).toBe('루비, 별무늬');
  });
  it('세 예측 단추 모두 형질 표지, 그림 묶음, 이름의 같은 구조를 쓴다', () => {
    const choices = colorPredictionChoices(() => {}).map(dom);
    expect(choices).toHaveLength(3);
    choices.forEach((choice, i) => {
      expect(choice.tagName).toBe('BUTTON');
      expect(choice.children).toHaveLength(1);
      const frame = choice.children[0];
      expect(hasClass(frame, 'trait-badge')).toBe(true);
      expect(frame.children.map((node) => node.tagName)).toEqual(['SPAN', 'SPAN']);
      const images = frame.children[0];
      expect(hasClass(images, 'prediction-choice__images')).toBe(true);
      expect(images.children).toHaveLength(i === 2 ? 2 : 1);
      images.children.forEach((img) => {
        expect(img.tagName).toBe('IMG'); expect(hasClass(img, 'explain-image')).toBe(true);
      });
      expect(frame.children[1].textContent).toBe(choice.getAttribute('aria-label'));
    });
  });
  it('그림 선택지는 기존 ruby/gold/even 값과 선택 전 상태를 유지한다', () => {
    const chosen: string[] = [];
    const choices = colorPredictionChoices((value) => chosen.push(value)).map(dom);
    choices.forEach((choice) => {
      expect(choice.getAttribute('aria-pressed')).toBe('false');
      choice.dispatchEvent(new Event('click'));
    });
    expect(chosen).toEqual(['ruby', 'gold', 'even']);
  });
  it('모든 노트 그림과 도표 속 형질 그림도 공통 크기 클래스를 사용한다', () => {
    for (const id of Object.keys(CONCEPT_PICTURES) as ConceptId[]) {
      const plate = dom(conceptPicture(id));
      descendants(plate).filter((node) => node.tagName === 'IMG').forEach((img) => {
        expect(hasClass(img, 'explain-image'), `${id}: ${img.getAttribute('src')}`).toBe(true);
      });
    }
  });
});

describe('공통 난이도 막대', () => {
  it.each([['sprout', 1], ['fruit', 2], ['master', 3]] as [Difficulty, number][])('%s는 3칸 중 %i칸을 채운다', (difficulty, filled) => {
    const badge = dom(difficultyBadge(difficulty));
    const bars = badge.children[0];
    expect(hasClass(badge, 'difficulty-mark')).toBe(true);
    expect(hasClass(bars, 'difficulty-bars')).toBe(true);
    expect(bars.children).toHaveLength(3);
    expect(bars.children.filter((bar) => hasClass(bar, 'is-active'))).toHaveLength(filled);
    expect(bars.getAttribute('aria-hidden')).toBe('true');
    expect(badge.textContent).not.toMatch(/[●○]/);
    expect(badge.getAttribute('aria-label')).toBe(badge.textContent);
  });
  it('단원 연습에는 임의의 난이도 단계를 붙이지 않는다', () => {
    const badge = dom(difficultyBadge('unit'));
    expect(badge.children).toHaveLength(1);
    expect(badge.textContent).toBe('단원 연습');
  });
});
