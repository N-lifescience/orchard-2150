// 시약 쓰기 · 비법 자세히(판매)
import { audio } from '../../audio';
import { jokerCard, reagentCard } from '../../art';
import type { Ctx } from '../ctx';
import { h, button } from '../h';
import { handPickItems, pickTargets, plantPickItem } from './picker';
import { openEditor } from './editor';

const PHASE_OK = ['cross', 'play', 'shop'];

export function openJoker(ctx: Ctx, uid: string): void {
  const g = ctx.game;
  const inst = g.state.jokers.find((j) => j.uid === uid);
  if (!inst) return;
  const def = g.jokerDef(uid);
  const value = g.sellValue(uid);
  const canSell = !['title', 'gameover', 'victory'].includes(g.state.phase) && !ctx.isBusy();
  const idx = g.state.jokers.findIndex((j) => j.uid === uid);
  const m = ctx.modals.open({
    title: def.name,
    kicker: `장인의 비법 · ${idx + 1}번째로 발동`,
    className: 'modal--item',
    content: h(
      'div',
      { class: 'item' },
      h('div', { class: 'item__art' }, jokerCard(def, { uid, counter: inst.id === 'breedingLog' ? inst.counter : undefined })),
      h(
        'div',
        { class: 'item__text' },
        h('p', { class: 'item__desc' }, def.desc),
        def.flavor ? h('p', { class: 'item__flavor' }, def.flavor) : null,
        inst.id === 'breedingLog' ? h('p', { class: 'item__note' }, `지금까지 쌓인 배수 +${inst.counter}`) : null,
        def.concept ? h('p', { class: 'item__note' }, `관련 개념: ${g.conceptDef(def.concept).title}${g.state.discoveries.includes(def.concept) ? '' : ' (아직 발견 못 함)'}`) : null,
        h('p', { class: 'hint' }, '비법은 왼쪽부터 차례로 발동해요.'),
      ),
    ),
    actions: [
      button('닫기', () => m.close(), { class: 'btn--ghost' }),
      button(`판매 $${value}`, () => {
        if (!canSell) return;
        g.sellJoker(uid);
        audio.play('sell');
        m.close();
      }, { class: 'btn--discard', disabled: !canSell }),
    ],
  });
}

export function openReagent(ctx: Ctx, index: number): void {
  const g = ctx.game;
  const s = g.state;
  const id = s.reagents[index];
  if (!id) return;
  const def = g.reagentDef(id);
  let why = '';
  if (!PHASE_OK.includes(s.phase)) why = '지금은 시약을 쓸 수 없어요.';
  else if (id === 'brush' && s.phase !== 'play') why = '출하 중에만 쓸 수 있어요.';
  else if (id === 'fertilizer' && s.phase !== 'play') why = '손에 든 모종에 써요. 출하 중에 쓸 수 있어요.';
  else if (id === 'scissors' && s.policy === 'heritage') why = '전통 육종팀은 유전자 가위를 쓸 수 없어요.';
  else if (id === 'vector' && s.policy !== 'biotech') why = '이 브랜드 철학에서는 형질전환을 하지 않아요.';
  const how: Record<string, string> = {
    genetest: '온실 포기나 손에 든 모종을 1~2개 골라 유전자형을 봐요.',
    colchicine: '온실의 2배체 포기 하나를 골라요.',
    scissors: '편집 작업대를 열어 DNA 글자를 한 곳 고쳐요.',
    vector: '온실 포기 하나를 골라 형광 유전자를 넣어요.',
    tissue: '온실 포기 하나를 골라 복제해요. 빈 칸이 있어야 해요.',
    fertilizer: '손에 든 모종 1~2개를 골라요. 이번 주문에서만 효과가 있어요.',
    brush: '지금 꼬투리를 버리고 교배를 다시 골라요.',
  };
  const m = ctx.modals.open({
    title: def.name,
    kicker: '연구 시약',
    className: 'modal--item',
    content: h(
      'div',
      { class: 'item' },
      h('div', { class: 'item__art' }, reagentCard(def)),
      h('div', { class: 'item__text' }, h('p', { class: 'item__desc' }, def.desc), how[id] ? h('p', { class: 'hint' }, how[id]) : null, why ? h('p', { class: 'item__why' }, why) : null),
    ),
    actions: [
      button('닫기', () => m.close(), { class: 'btn--ghost' }),
      button(id === 'scissors' ? '편집 작업대 열기' : '쓰기', () => {
        m.close();
        void useReagentFlow(ctx, index);
      }, { class: 'btn--play', disabled: !!why || ctx.isBusy(), 'data-autofocus': '' }),
    ],
  });
}

export async function useReagentFlow(ctx: Ctx, index: number): Promise<void> {
  const g = ctx.game;
  const s = g.state;
  const id = s.reagents[index];
  if (!id) return;
  const def = g.reagentDef(id);
  let targets: string[] = [];
  const selectedHand = [...document.querySelectorAll<HTMLElement>('.hand .slot.is-selected')].map((e) => e.dataset.uid ?? '').filter(Boolean);
  switch (id) {
    case 'scissors':
      openEditor(ctx, index);
      return;
    case 'brush':
      targets = [];
      break;
    case 'genetest': {
      const plants = s.garden.map((p) => plantPickItem(ctx, p, p.revealed ? '이미 공개됨' : undefined));
      const hand = s.phase === 'play' ? handPickItems(ctx, (uid) => (s.hand.find((c) => c.uid === uid)?.revealed ? '이미 공개됨' : undefined)) : [];
      const r = await pickTargets(ctx, {
        title: def.name,
        hint: '유전자형을 볼 포기나 모종을 1~2개 골라요.',
        items: [...hand, ...plants],
        groups: [
          { label: '손에 든 모종', ids: hand.map((i) => i.id) },
          { label: '온실', ids: plants.map((i) => i.id) },
        ],
        min: 1,
        max: 2,
        confirm: '검사하기',
        preselect: selectedHand,
      });
      if (!r) return;
      targets = r;
      break;
    }
    case 'fertilizer': {
      const r = await pickTargets(ctx, {
        title: def.name,
        hint: '당도를 올릴 모종을 1~2개 골라요. 수그루는 열매가 없어 효과가 없어요.',
        items: handPickItems(ctx, (uid) => (s.hand.find((c) => c.uid === uid)?.pheno.brix === null ? '수그루' : undefined)),
        min: 1,
        max: 2,
        confirm: '비료 주기',
        preselect: selectedHand,
      });
      if (!r) return;
      targets = r;
      break;
    }
    default: {
      const hint: Record<string, string> = {
        colchicine: '4배체로 만들 2배체 포기를 골라요.',
        vector: '형광 해파리 유전자를 넣을 포기를 골라요.',
        tissue: '복제할 포기를 골라요.',
      };
      const plants = s.garden.map((p) =>
        plantPickItem(ctx, p, id === 'colchicine' && (p.genome.ploidy !== 2 || p.pheno.aneuploid) ? '2배체가 아니에요' : undefined),
      );
      const r = await pickTargets(ctx, { title: def.name, hint: hint[id], items: plants, min: 1, max: 1, confirm: '쓰기' });
      if (!r) return;
      targets = r;
    }
  }
  if (ctx.isBusy()) return;
  const res = g.useReagent(index, targets);
  if (!res.ok) ctx.toast.error(res.reason ?? '쓸 수 없어요.');
  else audio.play(id === 'genetest' ? 'discovery' : 'buy');
}
