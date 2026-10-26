import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { explainImage, traitBadge } from '../src/ui/traitBadge';
import { colorPredictionChoices } from '../src/ui/predictionChoices';
import { conceptPicture, CONCEPT_PICTURES } from '../src/ui/conceptPlate';
import { CrossView } from '../src/ui/run/cross';
import { plantCard } from '../src/art';
import { plantView } from '../src/ui/cards';
import { describeGenotype } from '../src/genetics';
import { createGame } from '../src/game';
import type { Ctx } from '../src/ui/ctx';
import { difficultyBadge } from '../src/ui/difficultyBadge';
import type { ConceptId, Difficulty } from '../src/contract/game';

// Minimal DOM ownership/event surface: execute the real h()/renderers, without
// mocking their output or claiming browser layout measurements.
class DomNode extends EventTarget {
  childNodes: DomNode[] = [];
  constructor(private text = '') { super(); }
  appendChild(node: DomNode) { this.childNodes.push(node); return node; }
  prepend(...nodes: DomNode[]) { this.childNodes.unshift(...nodes); }
  get firstChild(): DomNode | undefined { return this.childNodes[0]; }
  removeChild(node: DomNode) { this.childNodes = this.childNodes.filter(child => child !== node); return node; }
  contains(node: DomNode | undefined): boolean { return !!node && (node === this || this.childNodes.some(child => child.contains(node))); }
  get textContent(): string { return this.text + this.childNodes.map((node) => node.textContent).join(''); }
  set textContent(value: string) { this.text = value; this.childNodes = []; }
  get children(): DomElement[] { return this.childNodes.filter((node): node is DomElement => node instanceof DomElement); }
}
class DomElement extends DomNode {
  readonly attrs = new Map<string, string>();
  readonly dataset: Record<string, string> = {};
  readonly style = { setProperty: (_key: string, _value: string) => {}, removeProperty: (_key: string) => {} };
  readonly classList = {
    add: (name: string) => { this.classList.toggle(name, true); },
    toggle: (name: string, force?: boolean) => {
      const classes = new Set((this.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
      const enabled = force ?? !classes.has(name);
      if (enabled) classes.add(name); else classes.delete(name);
      this.setAttribute('class', [...classes].join(' '));
      return enabled;
    },
  };
  hidden = false;
  disabled = false;
  readonly tagName: string;
  constructor(tag: string) { super(); this.tagName = tag.toUpperCase(); }
  get className(): string { return this.getAttribute('class') ?? ''; }
  set className(value: string) { this.setAttribute('class', value); }
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

describe('교배 화면의 작업 순서와 예측 잠금', () => {
  const setupCross = () => {
    const game = createGame({ storage: null });
    game.newRun({ seed: 4, mode: 'unit-sex', policy: 'heritage', playStyle: 'learning' });
    const view = new CrossView({ game, isBusy: () => false } as unknown as Ctx);
    const nodes = descendants(dom(view.el));
    const find = (name: string) => nodes.find(node => hasClass(node, name))!;
    return { game, view, nodes, find };
  };
  it('부모 카드와 요약 다음에 예측, 마지막에 교배 실행 단추가 온다', () => {
    const { nodes, find } = setupCross();
    const garden = nodes.indexOf(find('garden'));
    const pages = nodes.indexOf(find('garden-pages'));
    const parents = nodes.indexOf(find('cross__bar'));
    const prediction = nodes.indexOf(find('cross__prediction'));
    const actions = nodes.indexOf(find('cross__actions'));
    expect(garden).toBeLessThan(pages);
    expect(pages).toBeLessThan(parents);
    expect(parents).toBeLessThan(prediction);
    expect(prediction).toBeLessThan(actions);
    expect(descendants(find('cross__bar')).some(node => node.tagName === 'BUTTON')).toBe(false);
    expect(descendants(find('cross__actions')).some(node => hasClass(node, 'btn--play'))).toBe(true);
  });
  it('카탈로그 스크롤 영역 밖에 넘김과 모든 행동 요소를 둔다', () => {
    const { find } = setupCross();
    const catalog = find('cross__catalog');
    const decision = find('cross__decision');
    expect(catalog.contains(find('garden'))).toBe(true);
    expect(catalog.contains(find('garden-pages'))).toBe(false);
    expect(catalog.contains(decision)).toBe(false);
    for (const name of ['cross__bar', 'cross__prediction', 'cross__actions']) {
      expect(decision.contains(find(name))).toBe(true);
      expect(catalog.contains(find(name))).toBe(false);
    }
  });
  it('조작 안내와 부모 힌트를 카드 앞의 같은 묶음에 보존한다', () => {
    const { find } = setupCross();
    const notes = find('cross__catalog-notes');
    expect(notes.children.map(node => node.getAttribute('class'))).toEqual(['hint', 'cross__guidance']);
    expect(notes.textContent).toContain('같은 종 두 개체를 고르거나 한 개체를 골라 자가수분하세요.');
    expect(find('cross__head').contains(notes)).toBe(true);
    expect(find('garden').contains(notes)).toBe(false);
  });
  it('성염색체 단원 카드에 이름, 두 형질과 성염색체를 포함한 유전자형 전체를 남긴다', () => {
    const { game } = setupCross();
    for (const plant of game.state.garden.filter(p => p.genome.species === 'stella')) {
      const card = dom(plantCard(plantView(plant, { glasses: false })));
      const nodes = descendants(card);
      const find = (name: string) => nodes.find(node => hasClass(node, name))!;
      expect(find('sa-plant__title').textContent).toBe(plant.name);
      expect(find('sa-card__traits').children).toHaveLength(2);
      expect(find('sa-card__traits').textContent).toContain(plant.pheno.sex === 'M' ? '꽃잎' : '과육');
      expect(find('sa-card__traits').textContent).toContain('잎');
      expect(find('sa-geno__text').textContent).toBe(describeGenotype(plant.genome));
      expect(find('sa-geno__text').textContent).toMatch(/X[XY] [Ll]+$/);
      expect(find('sa-card__art').children[0].tagName).toBe('IMG');
    }
  });
  it('자가수분 시작도 행동 영역에 남고 예측 뒤에만 활성화된다', () => {
    const { view, find } = setupCross();
    view.toggleByKey(5);
    view.confirm();
    const self = descendants(find('cross__actions')).find(node => node.textContent === '자가수분 시작')!;
    expect(self.hidden).toBe(false);
    expect(self.disabled).toBe(true);
    const choice = descendants(find('cross__prediction')).find(node => node.dataset.prediction === 'ruby')!;
    choice.dispatchEvent(new Event('click'));
    expect(self.disabled).toBe(false);
    expect(find('cross__decision').contains(self)).toBe(true);
  });
  it('부모 둘을 골라도 예측 전에는 실행할 수 없고 부모를 바꾸면 다시 잠긴다', () => {
    const { view, find } = setupCross();
    const button = descendants(find('cross__actions')).find(node => hasClass(node, 'btn--play'))!;
    view.toggleByKey(2);
    view.toggleByKey(3);
    expect(find('cross__prediction').hidden).toBe(false);
    expect(button.disabled).toBe(true);
    const choice = descendants(find('cross__prediction')).find(node => node.dataset.prediction === 'even')!;
    choice.dispatchEvent(new Event('click'));
    expect(button.disabled).toBe(false);
    view.toggleByKey(1);
    expect(button.disabled).toBe(true);
  });
});
