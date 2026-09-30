import type { Ctx } from '../ctx';
import { button, h, replaceChildren } from '../h';
import { markTutorialSeen } from '../runSlots';

const STEPS = [
  {
    tag: '01 / 목표',
    title: '마지막 시즌의 최종 주문까지 납품하세요',
    body: '한 시즌에는 작은 주문, 큰 주문, 특별 규칙이 있는 최종 주문이 차례로 옵니다. 빠른 게임은 4시즌, 전체 게임은 8시즌입니다. 마지막 시즌의 최종 주문을 넘기면 승리해요.',
    action: '각 주문의 목표 점수를 남은 출하 안에 채우세요. 출하를 모두 쓰고 목표에 못 미치면 그 연대기는 끝납니다.',
  },
  {
    tag: '02 / 교배',
    title: '부모 두 포기를 고르면 52알의 씨앗이 생깁니다',
    body: '온실에서 같은 종의 부모 두 포기를 고르세요. 한 포기를 골라 자가수분할 수도 있습니다. 교배 전 과육색을 예측하고, 실제 52알의 결과와 비교해 보세요.',
    action: '부모의 겉모습이 같아도 숨은 대립유전자 때문에 자손의 형질이 달라질 수 있어요.',
  },
  {
    tag: '03 / 출하',
    title: '손패에서 모종 1~5장을 골라 점수를 만드세요',
    body: '한 번에 8장 안팎을 뽑습니다. 1~5장을 골라 출하하면 빛깔·무늬 조합과 당도로 족보 점수가 계산돼요. 점수는 칩 × 배수입니다. 필요 없는 카드는 솎아내고 다시 뽑을 수 있어요.',
    action: '왼쪽에서 목표 점수, 이번 주문 점수, 남은 출하·솎아내기를 확인하세요. 주문마다 횟수 제한이 새로 정해집니다.',
  },
  {
    tag: '04 / 성장과 연습',
    title: '보상을 써서 다음 주문을 준비하세요',
    body: '성공하면 돈을 받고 모종을 온실에 선발한 뒤 공방에서 비법·시약·씨앗을 살 수 있어요. 온실과 비법 칸은 제한되어 있으니 어떤 형질을 남길지 결정해야 합니다.',
    action: '단원 연습은 튜토리얼이 아니라 특정 단원으로 바로 들어가는 2시즌 도전입니다. 연구 노트에는 플레이 중 직접 관찰한 유전 개념이 쌓여요.',
  },
] as const;

export function openTutorial(ctx: Ctx): void {
  let page = 0;
  const content = h('div', { class: 'tutorial', 'aria-live': 'polite' });
  const footer = h('div', { class: 'tutorial__actions' });
  const modal = ctx.modals.open({
    title: '플레이 방법',
    kicker: '운영 매니저 레아 모레노 · 첫 계약 브리핑',
    className: 'modal--tutorial',
    wide: true,
    content: h('div', null, content, footer),
    onClose: () => markTutorialSeen(),
  });
  const draw = () => {
    const step = STEPS[page];
    replaceChildren(content,
      h('div', { class: 'tutorial__count' }, step.tag),
      h('h3', { class: 'tutorial__title' }, step.title),
      h('p', { class: 'tutorial__body' }, step.body),
      h('p', { class: 'tutorial__action' }, step.action),
      h('div', { class: 'tutorial__progress', 'aria-label': `${page + 1} / ${STEPS.length}` }, ...STEPS.map((_, i) => h('span', { class: i === page ? 'is-current' : '' }))),
    );
    replaceChildren(footer,
      page > 0 ? button('이전', () => { page--; draw(); }, { class: 'btn--ghost' }) : null,
      button(page === STEPS.length - 1 ? '게임으로 돌아가기' : '다음', () => {
        if (page === STEPS.length - 1) modal.close();
        else { page++; draw(); }
      }, { class: 'btn--play' }),
    );
  };
  draw();
}
