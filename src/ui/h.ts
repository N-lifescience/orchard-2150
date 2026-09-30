// 요소 생성 도우미 — innerHTML 계열을 쓰지 않고 createElement 로만 만든다.
//   h('button', { class: 'btn', onclick: () => …, 'aria-label': '출하' }, '출하')

export type Child = Node | string | number | null | undefined | false | Child[];

type Listener = (e: Event) => void;

export interface Props {
  class?: string | (string | false | null | undefined)[];
  /** 문자열이면 cssText, 객체면 setProperty (CSS 변수 '--x' 도 됨) */
  style?: string | Record<string, string | number | null | undefined>;
  dataset?: Record<string, string | number | undefined>;
  /** 'click' → listener */
  on?: Record<string, Listener>;
  [attr: string]: unknown;
}

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function applyProps(el: HTMLElement | SVGElement, props: Props): void {
  for (const key of Object.keys(props)) {
    const v = props[key];
    if (v === undefined || v === null || v === false) continue;
    if (key === 'class') {
      const c = Array.isArray(v) ? cls(...(v as (string | false | null | undefined)[])) : String(v);
      if (c) el.setAttribute('class', c);
    } else if (key === 'style') {
      if (typeof v === 'string') (el as HTMLElement).style.cssText = v;
      else setStyle(el as HTMLElement, v as Record<string, string | number | null | undefined>);
    } else if (key === 'dataset') {
      const ds = v as Record<string, string | number | undefined>;
      for (const k of Object.keys(ds)) if (ds[k] !== undefined) (el as HTMLElement).dataset[k] = String(ds[k]);
    } else if (key === 'on') {
      const on = v as Record<string, Listener>;
      for (const k of Object.keys(on)) el.addEventListener(k, on[k]);
    } else if (key.startsWith('on') && typeof v === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), v as Listener);
    } else if (key === 'value' && 'value' in el) {
      (el as HTMLInputElement).value = String(v);
    } else if (key === 'checked' && 'checked' in el) {
      (el as HTMLInputElement).checked = !!v;
    } else if (v === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(v));
    }
  }
}

export function setStyle(el: HTMLElement, style: Record<string, string | number | null | undefined>): void {
  for (const k of Object.keys(style)) {
    const val = style[k];
    if (val === null || val === undefined) el.style.removeProperty(k);
    else el.style.setProperty(k, String(val));
  }
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

/** 자식 전부 비우기 */
export function clear(el: Node): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** 자식 갈아 끼우기 */
export function replaceChildren(el: Node, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

/** 텍스트만 바꾸기 (같으면 건드리지 않음) */
export function setText(el: Node, text: string | number): void {
  const t = String(text);
  if (el.textContent !== t) el.textContent = t;
}

/** 버튼 한 줄 만들기 */
export function button(label: Child, onClick: (e: MouseEvent) => void, props: Props = {}): HTMLButtonElement {
  const extra = props.class;
  const b = h('button', { type: 'button', ...props, class: cls('btn', typeof extra === 'string' ? extra : Array.isArray(extra) ? cls(...extra) : undefined) }, label);
  b.addEventListener('click', (e) => {
    if (b.disabled) return;
    onClick(e);
  });
  return b;
}
