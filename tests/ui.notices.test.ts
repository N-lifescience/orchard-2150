import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The queue behavior is independent of layout. This small surface models only
// node ownership; the real browser audit remains with the coordinator.
const { NodeStub } = vi.hoisted(() => {
  class NodeStub {
    children: NodeStub[] = [];
    parent: NodeStub | null = null;
    constructor(readonly text = '') {}
    appendChild(node: NodeStub): void { this.children.push(node); node.parent = this; }
    replaceChildren(...nodes: NodeStub[]): void {
      this.children.forEach((node) => { node.parent = null; });
      this.children = [];
      nodes.forEach((node) => this.appendChild(node));
    }
    remove(): void {
      if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this);
      this.parent = null;
    }
  }
  return { NodeStub };
});
vi.mock('../src/ui/h', () => ({ h: (_tag: string, _props: unknown, text?: string) => new NodeStub(text), clear: vi.fn() }));
vi.mock('../src/ui/motion', () => ({ motion: { fast: true }, play: () => Promise.resolve(), stage: { scale: 1 } }));
vi.mock('../src/audio', () => ({ audio: { play: vi.fn() } }));
import { Toaster } from '../src/ui/overlay';

describe('안내 토스트 순서', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('한 번에 한 안내만 보이고 입력한 순서대로 모두 전달한다', async () => {
    const root = new NodeStub();
    const toaster = new Toaster(root as unknown as HTMLElement);
    ['비법 줄', '연구 시약', '엘레나의 노트', '계약 보상'].forEach((text) => toaster.show(text));
    const lane = root.children[0];
    for (const expected of ['비법 줄', '연구 시약', '엘레나의 노트', '계약 보상']) {
      expect(lane.children).toHaveLength(1);
      expect(lane.children[0].text).toBe(expected);
      await vi.advanceTimersByTimeAsync(1200);
    }
    expect(lane.children).toHaveLength(0);
  });

  it('대기 중 중복 안내를 합치고 오류도 순서대로 전달한다', async () => {
    const root = new NodeStub();
    const toaster = new Toaster(root as unknown as HTMLElement);
    toaster.show('현재 안내');
    toaster.error('구매할 수 없어요.');
    toaster.error('구매할 수 없어요.');
    await vi.advanceTimersByTimeAsync(1200);
    expect(root.children[0].children[0].text).toBe('구매할 수 없어요.');
    await vi.advanceTimersByTimeAsync(1200);
    expect(root.children[0].children).toHaveLength(0);
  });
});
