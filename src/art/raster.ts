// Generated bitmap atlases. Cropping uses the observed tile boundaries, not guessed equal rows.
export interface Atlas {
  url: string;
  width: number;
  height: number;
  columns: number[];
  rows: number[];
}

export const atlases = {
  peopleA: { url: new URL('./assets/generated/people-a.webp', import.meta.url).href, width: 1254, height: 1254, columns: [0, 418, 836, 1254], rows: [0, 418, 836, 1254] },
  peopleB: { url: new URL('./assets/generated/people-b.webp', import.meta.url).href, width: 1254, height: 1254, columns: [0, 418, 836, 1254], rows: [0, 418, 836, 1254] },
  peopleC: { url: new URL('./assets/generated/people-c.webp', import.meta.url).href, width: 1254, height: 1254, columns: [0, 627, 1254], rows: [0, 627, 1254] },
  jokers: { url: new URL('./assets/generated/jokers.webp', import.meta.url).href, width: 1024, height: 1536, columns: [0, 256, 512, 768, 1024], rows: [0, 242, 474, 717, 947, 1202, 1536] },
  reagents: { url: new URL('./assets/generated/reagents.webp', import.meta.url).href, width: 1774, height: 887, columns: [0, 444, 887, 1331, 1774], rows: [0, 444, 887] },
  utility: { url: new URL('./assets/generated/utility.webp', import.meta.url).href, width: 1122, height: 1402, columns: [0, 281, 561, 842, 1122], rows: [0, 264, 501, 770, 1042, 1402] },
} satisfies Record<string, Atlas>;

export const frameUrl = new URL('./assets/generated/frame.webp', import.meta.url).href;
export const leaGuideUrl = new URL('./assets/generated/lea-guide.webp', import.meta.url).href;

/** The source rectangle stays proportional even when a generated sheet has uneven rows. */
export function sprite(atlas: Atlas, index: number, size: number, label: string, className = ''): HTMLElement {
  const cols = atlas.columns.length - 1;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = atlas.columns[col] + 2;
  const y = atlas.rows[row] + 2;
  const w = atlas.columns[col + 1] - x - 2;
  const h = atlas.rows[row + 1] - y - 2;
  const root = document.createElement('span');
  root.className = 'sa-sprite ' + className;
  root.style.width = size + 'px';
  root.style.height = size + 'px';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', label);
  const crop = document.createElement('span');
  crop.className = 'sa-sprite__crop';
  crop.style.width = Math.min(1, w / h) * 100 + '%';
  crop.style.height = Math.min(1, h / w) * 100 + '%';
  const img = document.createElement('img');
  img.src = atlas.url;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  img.draggable = false;
  img.style.width = atlas.width / w * 100 + '%';
  img.style.height = atlas.height / h * 100 + '%';
  img.style.left = -x / w * 100 + '%';
  img.style.top = -y / h * 100 + '%';
  crop.appendChild(img);
  root.appendChild(crop);
  return root;
}

export function cardFrame(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = frameUrl;
  img.className = 'sa-frame';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  img.draggable = false;
  return img;
}
