// 그림 갤러리 (검증용). 유전 엔진·게임 규칙에 의존하지 않는다 — 표현형·유전체는 직접 만든 객체.
import {
  fruitArt,
  seedCard,
  plantCard,
  jokerCard,
  reagentCard,
  packArt,
  bossEmblem,
  orderEmblem,
  suitGlyph,
  karyotype,
  medalArt,
  logo,
  createBackground,
} from './art/index';
import type { CardView } from './contract/art';
import type { Phenotype, Genome, ChromosomeCopy, HomologGroup, SuitKey, SpeciesId } from './contract/genetics';
import type { JokerDef, ReagentDef, BossDef, HandTypeId, PackKind, Rarity } from './contract/game';

const app = document.getElementById('app') as HTMLElement;
const canvas = document.getElementById('bg') as HTMLCanvasElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function section(title: string, note?: string): HTMLElement {
  const s = el('section');
  s.appendChild(el('h2', undefined, title));
  if (note) s.appendChild(el('p', 'g-note', note));
  const row = el('div', 'g-row');
  s.appendChild(row);
  app.appendChild(s);
  return row;
}

function cell(row: HTMLElement, node: Element, cap: string, panel?: 'dark' | 'ivory'): void {
  const c = el('div', 'g-cell');
  if (panel) {
    const p = el('div', `g-panel${panel === 'ivory' ? ' is-ivory' : ''}`);
    p.appendChild(node);
    c.appendChild(p);
  } else c.appendChild(node);
  c.appendChild(el('div', 'g-cap', cap));
  row.appendChild(c);
}

let seedN = 1;
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

function ph(o: Partial<Phenotype>): Phenotype {
  return {
    species: 'lumi',
    sex: 'H',
    color: 'ruby',
    marked: true,
    brix: 14,
    plusFraction: 0.5,
    bitter: false,
    fluorescent: false,
    ploidy: 2,
    aneuploid: false,
    seedless: false,
    fertile: true,
    giant: false,
    ...o,
  };
}

function view(p: Phenotype, o: Partial<CardView> = {}): CardView {
  const uid = `g${seedN++}`;
  return {
    uid,
    pheno: p,
    artSeed: hash(uid),
    brixShown: p.sex === 'M' ? null : p.brix,
    brixMod: 0,
    genotypeText: null,
    debuffed: false,
    ...o,
  };
}

// ─────────────────────────── 배경 + 머리
const bg = createBackground(canvas);
bg.start();

const head = el('header', 'g-head');
head.appendChild(logo());
app.appendChild(head);

const ctr = el('div', 'g-controls');
app.appendChild(ctr);
const btn = (label: string, fn: (b: HTMLButtonElement) => void) => {
  const b = el('button', undefined, label);
  b.type = 'button';
  b.addEventListener('click', () => fn(b));
  ctr.appendChild(b);
  return b;
};
const seasonBtns: HTMLButtonElement[] = [];
for (let a = 1; a <= 8; a++) {
  const b = btn(`앤티 ${a}`, () => {
    bg.setSeason(a);
    seasonBtns.forEach((x) => x.classList.toggle('is-on', x === b));
  });
  if (a === 1) b.classList.add('is-on');
  seasonBtns.push(b);
}
let bossOn = false;
btn('보스', (b) => {
  bossOn = !bossOn;
  bg.setBoss(bossOn);
  b.classList.toggle('is-on', bossOn);
});
btn('번쩍', () => bg.pulse(1));
let reduced = false;
btn('동작 줄이기', (b) => {
  reduced = !reduced;
  bg.setReducedMotion(reduced);
  document.body.classList.toggle('sa-reduced-motion', reduced);
  b.classList.toggle('is-on', reduced);
});
let jsTilt = false;
btn('JS 기울기(--rx/--ry)', (b) => {
  jsTilt = !jsTilt;
  b.classList.toggle('is-on', jsTilt);
});
const sizeLbl = el('label', undefined, '카드 폭 ');
const size = el('input');
size.type = 'range';
size.min = '96';
size.max = '240';
size.value = '132';
size.addEventListener('input', () => app.style.setProperty('--card-w', `${size.value}px`));
sizeLbl.appendChild(size);
ctr.appendChild(sizeLbl);

// 카드 상호작용: 클릭=선택, 더블클릭=발동, JS 기울기 시험
app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('.sa-tiltable');
  if (t) t.classList.toggle('is-selected');
});
app.addEventListener('dblclick', (e) => {
  const t = (e.target as HTMLElement).closest('.sa-tiltable') as HTMLElement | null;
  if (!t) return;
  t.classList.remove('is-trigger');
  void t.offsetWidth;
  t.classList.add('is-trigger');
  t.addEventListener('animationend', () => t.classList.remove('is-trigger'), { once: true });
});
app.addEventListener('pointermove', (e) => {
  if (!jsTilt) return;
  const t = (e.target as HTMLElement).closest('.sa-tiltable') as HTMLElement | null;
  if (!t) return;
  const r = t.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  t.style.setProperty('--rx', `${(y * 18).toFixed(2)}deg`);
  t.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`);
});
app.addEventListener('pointerout', (e) => {
  const t = (e.target as HTMLElement).closest('.sa-tiltable') as HTMLElement | null;
  if (t && !t.contains(e.relatedTarget as Node)) {
    t.style.removeProperty('--rx');
    t.style.removeProperty('--ry');
  }
});

// ─────────────────────────── 루미 4빛깔 × 당도
{
  const row = section('루미 — 4빛깔 × 당도 (낮 / 중 / 높)', '과육색(루비/골드) × 별무늬(있음/없음). 당도가 높을수록 과즙 광채·채도가 올라가요.');
  const suits: [string, 'ruby' | 'gold', boolean, string][] = [
    ['루비 · 별무늬', 'ruby', true, 'R_ S_'],
    ['루비 · 매끈', 'ruby', false, 'R_ ss'],
    ['골드 · 별무늬', 'gold', true, 'rr S_'],
    ['골드 · 매끈', 'gold', false, 'rr ss'],
  ];
  const levels: [number, number, string][] = [
    [9, 0.1, '낮'],
    [14, 0.5, '중'],
    [19, 0.92, '높'],
  ];
  for (const [name, color, marked] of suits)
    for (const [brix, pf, lv] of levels)
      cell(row, seedCard(view(ph({ color, marked, brix, plusFraction: pf }))), `${name} · 당도 ${lv} (${brix})`);
}

// ─────────────────────────── 과일 확대
{
  const row = section('과일 그림 확대 (fruitArt 200px)', '카드 없이 과일만. 무늬·광택·잎을 가까이서 확인.');
  const list: [Phenotype, string][] = [
    [ph({ color: 'ruby', marked: true, plusFraction: 0.9 }), '루미 루비 별무늬'],
    [ph({ color: 'gold', marked: false, plusFraction: 0.85 }), '루미 골드 매끈'],
    [ph({ species: 'stella', sex: 'F', color: 'ruby', marked: true, plusFraction: 0.8 }), '별다래 암그루 루비·은빛 잎'],
    [ph({ species: 'stella', sex: 'F', color: 'gold', marked: false, plusFraction: 0.5 }), '별다래 암그루 골드·초록 잎'],
    [ph({ species: 'stella', sex: 'M', color: 'ruby', marked: true, brix: null }), '별다래 수그루 루비 꽃·은빛 잎'],
    [ph({ species: 'stella', sex: 'M', color: 'gold', marked: false, brix: null }), '별다래 수그루 골드 꽃·초록 잎'],
  ];
  list.forEach(([p, cap], i) => cell(row, fruitArt(p, 1000 + i * 77, 200), cap, 'ivory'));
  const dark: [Phenotype, string][] = [
    [ph({ color: 'ruby', marked: true, plusFraction: 0.7, fluorescent: true }), 'LMO (어두운 바탕)'],
    [ph({ color: 'gold', marked: true, plusFraction: 0.6 }), '골드 별무늬 (어두운 바탕)'],
  ];
  dark.forEach(([p, cap], i) => cell(row, fruitArt(p, 3000 + i, 200), cap, 'dark'));
}

// ─────────────────────────── 별다래
{
  const row = section('별다래 — 암그루(열매) · 수그루(꽃)', '수그루는 꽃만 피어요(당도 —). 무늬 = 은빛 잎(X 연관 L).');
  const sv = (p: Phenotype, g: string | null, cap: string) => cell(row, seedCard(view(p, { genotypeText: g })), cap);
  sv(ph({ species: 'stella', sex: 'F', color: 'ruby', marked: true, brix: 15, plusFraction: 0.6 }), 'Rr · XX Ll · 당도+ 7/12', '암그루 루비·은빛 잎');
  sv(ph({ species: 'stella', sex: 'F', color: 'gold', marked: false, brix: 12, plusFraction: 0.35 }), 'rr · XX ll · 당도+ 4/12', '암그루 골드·초록 잎');
  sv(ph({ species: 'stella', sex: 'M', color: 'ruby', marked: true, brix: null }), 'RR · XY L', '수그루 루비 꽃·은빛 잎');
  sv(ph({ species: 'stella', sex: 'M', color: 'gold', marked: false, brix: null }), null, '수그루 골드 꽃·초록 잎 (비공개)');
}

// ─────────────────────────── 상태
{
  const row = section('상태 — 배수체 · 이수성 · 쓴맛 · LMO · 환경 · 무효 · 공개 여부');
  const c = (p: Phenotype, o: Partial<CardView>, cap: string) => cell(row, seedCard(view(p, o)), cap);
  c(ph({ ploidy: 3, seedless: true, fertile: false, brix: 16, plusFraction: 0.7 }), { genotypeText: 'RRr SSs bbb' }, '3배체 · 씨 없음');
  c(ph({ ploidy: 4, giant: true, color: 'gold', brix: 17, plusFraction: 0.75 }), { genotypeText: 'rrrr SSss bbbb' }, '4배체 · 거대');
  c(ph({ aneuploid: true, aneuploidNote: '3번 염색체 3개(삼염색체)', brix: 10, plusFraction: 0.5 }), {}, '이수성 (삼염색체)');
  c(ph({ bitter: true, color: 'gold', marked: false, brix: 13 }), { genotypeText: 'rr ss Bb · 당도+ 6/12' }, '쓴맛');
  c(ph({ fluorescent: true, brix: 15, plusFraction: 0.65 }), { genotypeText: 'Rr Ss bb · T+' }, 'LMO (형광)');
  c(ph({ brix: 14, plusFraction: 0.5 }), { brixShown: 16, brixMod: 2 }, '환경 +2 (비료)');
  c(ph({ color: 'gold', brix: 15, plusFraction: 0.55 }), { brixShown: 12, brixMod: -3 }, '환경 −3 (가뭄)');
  c(ph({ brix: 18, plusFraction: 0.85 }), { debuffed: true, genotypeText: 'RR SS bb' }, '무효 (보스 규칙)');
  c(ph({ color: 'gold', marked: false, brix: 13 }), { edited: true, genotypeText: 'R*ko r ss bb' }, '편집됨 (가위)');
  c(ph({ brix: 12 }), { genotypeText: null }, '유전자형 비공개');
  c(ph({ brix: 12 }), { genotypeText: 'Rr Ss bb · 당도+ 7/12' }, '유전자형 공개');
  c(ph({ color: 'gold', marked: false, brix: 12 }), { partialGenotype: 'rr ss' }, 'partial (멘델의 안경)');
  c(
    ph({ ploidy: 3, seedless: true, fertile: false, fluorescent: true, bitter: true, aneuploid: true, brix: 11 }),
    { brixShown: 13, brixMod: 2, edited: true },
    '배지 여러 개 (겹침 확인)',
  );
  c(ph({ species: 'stella', sex: 'F', ploidy: 3, seedless: true, fertile: false, color: 'gold', marked: true, brix: 15 }), {}, '별다래 3배체');
}

// ─────────────────────────── 온실 부모 카드
{
  const row = section('온실 부모 카드 (plantCard)');
  cell(row, plantCard(view(ph({ brix: 17, plusFraction: 0.8 }), { title: '엘레나 로시의 루비 별', subtitle: '시작 품종 · 1세대', genotypeText: 'RR SS bb · 당도+ 9/12' })), 'plantCard 공개');
  cell(row, plantCard(view(ph({ color: 'gold', marked: false, brix: 11, plusFraction: 0.3 }), { title: '3세대 선발 12호', subtitle: '자가수분 · 3세대' })), 'plantCard 비공개');
  cell(row, plantCard(view(ph({ species: 'stella', sex: 'M', color: 'ruby', marked: true, brix: null }), { title: '은빛 수그루', subtitle: '시장 품종', partialGenotype: 'XY L' })), 'plantCard 수그루');
  cell(row, plantCard(view(ph({ ploidy: 4, giant: true, brix: 18, plusFraction: 0.8 }), { title: '콜히친 4배체 거인', subtitle: '4n · 2세대' })), 'plantCard 4n');
}

// ─────────────────────────── 비법
{
  const row = section('장인의 비법 (jokerCard)', '희귀도 보석: 흔함 청록 · 특별 청 · 희귀 자홍 · 전설 금빛 무지개. 가격표·누적 뱃지 예시 포함.');
  const J: [string, string, Rarity, string][] = [
    ['shears', '엘레나 로시의 전지가위', 'common', '+4 배수'],
    ['rubyLover', '루비 애호가', 'common', '루비 모종마다 +3 배수'],
    ['goldCollector', '골드 수집가', 'common', '골드 모종마다 +3 배수'],
    ['patternArtisan', '무늬 장인', 'common', '무늬 있는 모종마다 +30 칩'],
    ['refractometer', '굴절계', 'uncommon', '모종마다 +(당도−10) 칩'],
    ['purebredCert', '빛깔 인증서', 'rare', '한 빛깔 계열이면 ×3 배수. 순계 인증은 아니에요'],
    ['heterosis', '잡종강세', 'uncommon', '이형접합 모종이 점수 낼 때마다 +2 배수'],
    ['hideAndSeek', '숨바꼭질 대립유전자', 'rare', '두 부모에 안 보이던 형질의 모종마다 ×1.5'],
    ['selfingMaster', '자가수분 명인', 'uncommon', '자가수분 주문이면 ×2 배수'],
    ['breedingLog', '교배 일지', 'uncommon', '열성 표현형 모종을 낼 때마다 영구 +1 배수'],
    ['mendelGlasses', '멘델의 안경', 'uncommon', '겉모습만으로 확실한 유전자형을 보여 줘요'],
    ['punnettNote', '퍼넷 노트', 'uncommon', '교배 전 기대 분포를 보여 줘요'],
    ['beeSwarm', '꿀벌 군단', 'common', '출하 +1'],
    ['seedVault', '씨앗 금고', 'common', '이자 상한 +$5'],
    ['pollenTrader', '꽃가루 상인', 'common', '수그루를 솎아낼 때마다 +$1'],
    ['xHeir', 'X의 상속자', 'rare', '딸 그루가 아비의 X 형질을 보이면 +4 배수'],
    ['colchicineNotes', '콜히친 노트', 'rare', '씨 없는(3n) 모종이 ×2 (기본 ×1.5)'],
    ['karyoScope', '핵형 현미경', 'uncommon', '이수성 모종의 핵형 공개, 솎아내면 +$1'],
    ['scissorRack', '가위 거치대', 'rare', '주문마다 유전자 가위 1회 무료'],
    ['jellyfishGene', '형광 해파리 유전자', 'rare', '형광 모종마다 ×1.5, 대신 꽃가루 유출 확률 ↑'],
    ['climateHouse', '기후 적응 온실', 'uncommon', '보스 규칙이 약해져요'],
    ['grandpaNotes', '마테오 비앙키의 향기 노트', 'legendary', '당도 16 이상 모종의 칩 ×2'],
    ['tissueLab', '조직배양 랩', 'rare', '선발 때 1포기 더 들일 수 있어요'],
    ['mystery', '(모르는 id)', 'common', '기본 씨앗 문양'],
  ];
  J.forEach(([id, name, rarity, desc], i) => {
    const def: JokerDef = { id, name, rarity, cost: 4 + i % 5, desc };
    const opts = i === 0 ? { price: 5 } : id === 'breedingLog' ? { counter: 7, uid: 'j-log' } : i === 5 ? { price: 8 } : undefined;
    cell(row, jokerCard(def, opts), `${id}${opts?.price ? ' · 가격표' : ''}${opts?.counter !== undefined ? ' · 누적' : ''}`);
  });
}

// ─────────────────────────── 시약
{
  const row = section('연구 시약 (reagentCard)', '서리 낀 유리. 배경 셰이더가 비쳐 보여요.');
  const R: [string, string, string][] = [
    ['genetest', '유전자 검사 키트', '모종 2장의 유전자형을 공개해요'],
    ['colchicine', '콜히친', '부모 한 포기를 4배체로 만들어요'],
    ['scissors', '유전자 가위', '편집 작업대를 열어요'],
    ['vector', '형질전환 벡터', '형광 유전자를 넣어요 (LMO)'],
    ['tissue', '조직배양', '부모 한 포기를 복제해요'],
    ['fertilizer', '선발 비료', '이번 주문만 당도 +2 (유전 안 돼요)'],
    ['brush', '붓 한 자루', '이번 주문 교배를 다시 골라요'],
    ['medal', '품평회 메달', '족보 하나를 한 단계 올려요'],
    ['unknown', '(모르는 id)', '기본 약병'],
  ];
  R.forEach(([id, name, desc], i) => {
    const def: ReagentDef = { id, name, desc, cost: 3, target: 'none' };
    cell(row, reagentCard(def, i === 1 ? { price: 4 } : undefined), id);
  });
}

// ─────────────────────────── 봉투
{
  const row = section('씨앗 봉투·상자 (packArt)');
  const kinds: PackKind[] = ['seed', 'rareSeed', 'reagent', 'medal', 'joker'];
  kinds.forEach((k, i) => cell(row, packArt(k, { price: 4 + i * 2 }), k));
}

// ─────────────────────────── 보스·주문 휘장
{
  const row = section('의뢰인 인장 (bossEmblem) · 주문 휘장 (orderEmblem)');
  const B: [string, string][] = [
    ['coldsnap', '냉해'],
    ['nobees', '벌이 없는 날'],
    ['uniformity', '균일성 심사'],
    ['drought', '가뭄'],
    ['judge', '열매 검사'],
    ['picky', '단색 포장 계약'],
    ['sommelier', '고당도 계약'],
    ['lmoCheck', '표시 기준 검사'],
    ['expo', '2150 국제 품종 박람회'],
    ['mystery', '(모르는 id)'],
  ];
  for (const [id, name] of B) {
    const def: BossDef = { id, name, client: '', desc: '', minAnte: 1 };
    cell(row, bossEmblem(def, 104), `${id} · ${name}`);
  }
  cell(row, orderEmblem('small', 88), '장터 (small)');
  cell(row, orderEmblem('big', 88), '식당 (big)');
}

// ─────────────────────────── 빛깔 기호
{
  const row = section('빛깔 기호 (suitGlyph) 8종', '색 + 모양(루비 ◆ / 골드 ●) + 무늬 표시(루미 ✦ / 별다래 은잎). 흑백에서도 구분돼야 해요.');
  const suits: SuitKey[] = ['ruby-m', 'ruby-p', 'gold-m', 'gold-p'];
  const sp: SpeciesId[] = ['lumi', 'stella'];
  for (const s of sp) for (const k of suits) cell(row, suitGlyph(k, s, 40), `${s} · ${k}`, 'ivory');
  const gray = el('div', 'g-panel is-ivory');
  gray.style.filter = 'grayscale(1)';
  for (const k of suits) gray.appendChild(suitGlyph(k, 'lumi', 40));
  cell(row, gray, '흑백 검사 (루미)');
}

// ─────────────────────────── 메달
{
  const row = section('품평회 메달 (medalArt) 12종', '동 → 은 → 금 → 백금. 족보마다 리본 색이 달라요.');
  const H: [HandTypeId, string][] = [
    ['high', '단품'],
    ['pair', '한 쌍'],
    ['twoPair', '두 쌍'],
    ['three', '세 쌍'],
    ['straight', '당도 계단'],
    ['flush', '한 빛깔'],
    ['fullHouse', '풀 바구니'],
    ['four', '네 쌍'],
    ['straightFlush', '빛깔 계단'],
    ['five', '다섯 쌍'],
    ['flushHouse', '빛깔 바구니'],
    ['flushFive', '완전 균일'],
  ];
  for (const [id, name] of H) cell(row, medalArt(id, 96), `${id} · ${name}`);
}

// ─────────────────────────── 핵형
function copy(group: HomologGroup, alleles: Record<string, string>, kind: 'auto' | 'X' | 'Y' = 'auto'): ChromosomeCopy {
  return { group, kind, alleles: alleles as ChromosomeCopy['alleles'] };
}
function lumiGenome(n: 2 | 3 | 4, extra: Partial<Record<HomologGroup, number>> = {}, lmo = false): Genome {
  const rows: Record<HomologGroup, ChromosomeCopy[]> = { c1: [], c2: [], c3: [], c4: [], c5: [], sex: [] };
  const R = ['R', 'r', 'R', 'r'];
  const Sx = ['S', 's', 's', 'S'];
  const Bx = ['b', 'B', 'b', 'b'];
  for (let i = 0; i < n + (extra.c1 ?? 0); i++) rows.c1.push(copy('c1', lmo && i === 0 ? { R: R[i % 4], T: 'T+' } : { R: R[i % 4] }));
  for (let i = 0; i < n + (extra.c2 ?? 0); i++) rows.c2.push(copy('c2', { S: Sx[i % 4], B: Bx[i % 4] }));
  for (let i = 0; i < n + (extra.c3 ?? 0); i++) rows.c3.push(copy('c3', { Q1: i % 2 ? 'Q1+' : 'Q1-', Q2: i % 3 ? 'Q2+' : 'Q2-' }));
  for (let i = 0; i < n + (extra.c4 ?? 0); i++) rows.c4.push(copy('c4', { Q3: i % 2 ? 'Q3-' : 'Q3+', Q4: 'Q4+' }));
  for (let i = 0; i < n + (extra.c5 ?? 0); i++) rows.c5.push(copy('c5', { Q5: 'Q5-', Q6: i % 2 ? 'Q6+' : 'Q6-' }));
  return { species: 'lumi', ploidy: n, chromosomes: rows };
}
function stellaGenome(male: boolean): Genome {
  const rows: Record<HomologGroup, ChromosomeCopy[]> = { c1: [], c2: [], c3: [], c4: [], c5: [], sex: [] };
  rows.c1 = [copy('c1', { R: 'R' }), copy('c1', { R: 'r' })];
  rows.c2 = [copy('c2', { Q1: 'Q1+', Q2: 'Q2-', Q3: 'Q3+' }), copy('c2', { Q1: 'Q1-', Q2: 'Q2+', Q3: 'Q3+' })];
  rows.c3 = [copy('c3', { Q4: 'Q4+', Q5: 'Q5-', Q6: 'Q6-' }), copy('c3', { Q4: 'Q4-', Q5: 'Q5+', Q6: 'Q6+' })];
  rows.sex = male ? [copy('sex', { L: 'L' }, 'X'), copy('sex', {}, 'Y')] : [copy('sex', { L: 'L' }, 'X'), copy('sex', { L: 'l' }, 'X')];
  return { species: 'stella', ploidy: 2, chromosomes: rows };
}
{
  const row = section('핵형 (karyotype)', '사본 수대로 그려요. 수가 다른 묶음은 자홍 밑줄. revealed=false 면 회색 윤곽만.');
  cell(row, karyotype(lumiGenome(2), { width: 260 }), '루미 2n (2n=10)', 'dark');
  cell(row, karyotype(lumiGenome(4), { width: 360 }), '루미 4n', 'dark');
  cell(row, karyotype(lumiGenome(3), { width: 300 }), '루미 3n (씨 없음)', 'dark');
  cell(row, karyotype(lumiGenome(2, { c3: 1 }), { width: 270 }), '루미 삼염색체 (3번 ×3)', 'dark');
  cell(row, karyotype(lumiGenome(2, {}, true), { width: 260 }), '루미 LMO (1번에 T+)', 'dark');
  cell(row, karyotype(stellaGenome(true), { width: 220 }), '별다래 수그루 XY', 'dark');
  cell(row, karyotype(stellaGenome(false), { width: 220 }), '별다래 암그루 XX', 'dark');
  cell(row, karyotype(lumiGenome(2), { width: 260, revealed: false }), '비공개 (윤곽만)', 'dark');
  cell(row, karyotype(stellaGenome(true), { width: 220 }), '밝은 바탕 확인', 'ivory');
}
