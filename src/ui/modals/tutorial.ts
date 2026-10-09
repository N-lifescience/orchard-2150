import type { Ctx } from '../ctx';
import { button, h, replaceChildren } from '../h';
import { markTutorialSeen } from '../runSlots';
import { PRACTICE_DURATION } from '../playDuration';

const STEPS = [
  {
    tag: '01 / 목표',
    title: '점수와 약속한 형질을 모두 납품하세요',
    body: "의뢰에는 목표 점수와 필수 형질·수량이 적혀 있어요. 둘 다 채워야 계약을 완료해요.\n\n한 시즌에 세 계약을 마치고 마지막 시즌의 특별 계약까지 끝내면 승리해요. 빠른 게임은 4시즌, 전체 게임은 8시즌이에요.",
    action: "재도전 허용 방식에서는 실패한 계약을 다시 시도할 수 있습니다. 실패 시 종료 방식에서는 남은 출하를 모두 쓰거나 씨앗이 떨어지면 연대기가 끝나요.",
  },
  {
    tag: '02 / 교배',
    title: '부모가 전달할 대립유전자를 생각해 보세요',
    body: "같은 종의 부모 두 개체를 고르거나 한 개체를 자가수분하세요.\n\n예를 들어 RR × rr에서는 R과 r이 만나 자손이 모두 Rr이에요. 기능 있는 R이 있으므로 루비 과육을 기대할 수 있어요. 첫 수업 교배에서는 레아의 시범을 볼 수 있습니다.",
    action: "교배 전에 과육색을 예측하고 52개체의 관찰값과 비교하세요. 부모의 겉모습만 같다고 유전자형도 같은 것은 아니에요. [교배 도움]은 언제든 열 수 있어요.",
  },
  {
    tag: '03 / 출하',
    title: '필수 형질을 골라 보내며 점수를 만드세요',
    body: "손패에서 모종 1~5장을 골라 출하해요.\n\n빛깔·무늬·당도 조합으로 칩 × 배수 점수가 계산되고 출하한 유효 과실 모종은 필수 납품 수량에 들어가요. 특별 규칙으로 무효가 된 모종과 열매가 없는 수그루는 필수 납품으로 세지 않아요.",
    action: "출하 전 예상 점수와 납품 수량을 확인하세요. 필요 없는 모종은 솎아내고 다시 뽑을 수 있습니다. 당도 납품 조건은 비료·가뭄 효과를 뺀 원래 당도로 세어요.",
  },
  {
    tag: '04 / 다음 계약',
    title: '보상을 써서 다음 주문을 준비하세요',
    body: "성공하면 돈을 받고 모종을 온실에 선발한 뒤 공방에서 비법·시약·씨앗을 살 수 있어요. 온실과 비법 칸은 제한되어 있으니 어떤 형질을 남길지 결정해야 해요.",
    action: "단원 게임은 준비된 온실과 도구로 특정 단원을 다루는 2시즌 연대기예요. 재도전 허용 방식의 첫 안내는 점차 줄어들어요. 연구 노트에서 관찰 기록과 실제 과학 설명을 함께 읽어 보세요.",
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
      h('div', { class: 'tutorial__body' }, ...step.body.split(/\n\s*\n/).map((text) => h('p', null, text))),
      h('p', { class: 'tutorial__action' }, step.action),
      h('div', { class: 'tutorial__progress', 'aria-label': `${page + 1} / ${STEPS.length}` }, ...STEPS.map((_, i) => h('span', { class: i === page ? 'is-current' : '' }))),
    );
    replaceChildren(footer,
      button(`튜토리얼 · ${PRACTICE_DURATION}`, () => { modal.close(); ctx.startPractice(); }, { class: 'btn--gold' }),
      page > 0 ? button('이전', () => { page--; draw(); }, { class: 'btn--ghost' }) : null,
      button(page === STEPS.length - 1 ? ctx.screen === 'title' ? '닫기' : '게임으로 돌아가기' : '다음', () => {
        if (page === STEPS.length - 1) modal.close();
        else { page++; draw(); }
      }, { class: 'btn--play' }),
    );
  };
  draw();
}
