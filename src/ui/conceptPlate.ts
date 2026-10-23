import type { ConceptId } from '../contract/game';
import { h } from './h';
import { explainImage, traitBadge } from './traitBadge';

export const CONCEPT_PICTURES: Record<ConceptId, string> = {
  segregation: 'trait-flesh-gold', purebred: 'trait-flesh-ruby', selfing: 'concept-cross',
  polygenic: 'trait-flesh-ruby', environment: 'trait-flesh-ruby', heterozygote: 'trait-flesh-ruby',
  dioecy: 'trait-flower-female', xlinked: 'trait-leaf-silver', polyploid: 'trait-fruit-large',
  triploid: 'trait-fruit-seedless', nondisjunction: 'concept-cross', transcription: 'concept-cross',
  stopCodon: 'concept-cross', synonymous: 'concept-cross', frameshift: 'concept-cross',
  dominanceMolecular: 'trait-flesh-ruby', lmo: 'trait-glow', geneFlow: 'concept-cross', clone: 'concept-clone',
};
/** Small exact diagrams; no chromosome count or probability is inferred from art. */
export function conceptDiagram(id: ConceptId): HTMLElement {
  if (id === 'segregation' || id === 'selfing') return h('table', { class: 'concept-diagram', 'aria-label': 'Rr × Rr의 정상 감수분열 기대 조합' },
    h('caption', null, 'Rr × Rr: 정상 감수분열 기대 조합'),
    h('thead', null, h('tr', null, h('th', null, '×'), h('th', null, 'R'), h('th', null, 'r'))),
    h('tbody', null, ...['R', 'r'].map((row) => h('tr', null, h('th', { scope: 'row' }, row), ...['R', 'r'].map((col) => {
      const geno = [row, col].sort().join('');
      return h('td', null, geno, traitBadge({ color: geno === 'rr' ? 'gold' : 'ruby' }, geno === 'rr' ? '골드' : '루비', false));
    })))));
  const lines: Record<Exclude<ConceptId, 'segregation' | 'selfing'>, string[]> = {
    purebred: ['루비 표현형: RR 또는 Rr', '같은 표현형 ≠ 순계의 증거'],
    polygenic: ['게임의 정상 2배체 당도', '8 + 여섯 자리의 + 대립유전자 수 = 8~20'],
    environment: ['유전자형 + 환경 → 표현형', '비료 효과 → 이번 주문 / 자손에게 전해지지 않음'],
    heterozygote: ['RR × rr → 모두 Rr', 'Rr × rr → Rr 1/2, rr 1/2 (기대)'],
    dioecy: ['암그루 ← 꽃가루 ← 수그루', '열매는 암그루에 열려요.'],
    xlinked: ['아비 X → 모든 딸', '아비 Y → 모든 아들'],
    polyploid: ['게임: 콜히친 처리 2n → 4n', '염색체 조가 두 배'],
    triploid: ['4n 부모 → 2n 생식세포', '2n 부모 → n 생식세포', '2n + n → 3n'],
    nondisjunction: ['정상: 2n / 이수성: 2n+1 또는 2n−1', '염색체 조 전체의 증가와 달라요.'],
    transcription: ['DNA —전사→ mRNA —번역→ 단백질', '코돈: mRNA 염기 세 개'],
    stopCodon: ['UAA / UAG / UGA → 번역 종료', '아미노산을 지정하지 않아요.'],
    synonymous: ['여러 코돈 → 같은 아미노산', '염기 변화 ≠ 반드시 아미노산 변화'],
    frameshift: ['염기 1개 삽입 또는 결실 → 읽기 틀 이동', '세 개씩 읽는 묶음이 달라져요.'],
    dominanceMolecular: ['기능하는 사본 하나로 충분한 경우', 'Rr → 우성 형질'],
    lmo: ['GFP 유전자 도입 → 형광 형질', '게임 규칙과 실제 과학은 다음 쪽에서 봐요.'],
    geneFlow: ['꽃가루 → 다른 식물의 자손', '이미 자란 어미의 유전자형은 그대로'],
    clone: ['원래 개체 → 조직배양 → 클론', '같은 유전자형'],
  };
  return h('div', { class: 'concept-diagram' }, ...lines[id].map((line) => h('p', null, line)));
}
export function conceptPicture(id: ConceptId): HTMLElement {
  // Molecular processes and chromosome numbers use exact HTML diagrams only.
  const picture = ['nondisjunction', 'transcription', 'stopCodon', 'synonymous', 'frameshift'].includes(id) ? null : explainImage(CONCEPT_PICTURES[id]);
  return h('div', { class: 'concept-plate' }, picture, conceptDiagram(id));
}
