// 편집 작업대 (유전자 가위) — 주형 가닥 · 코딩 가닥 · mRNA · 아미노산 · 유전 부호 표. 정답은 알려 주지 않는다.
import { audio } from '../../audio';
import type { LocusId } from '../../contract/genetics';
import { CODON_TABLE, analyzeCoding, templateStrand, transcribe, translate } from '../../genetics';
import { phenoSentence, effBrix, speciesLabel } from '../cards';
import type { Ctx } from '../ctx';
import { h, button, replaceChildren, setText } from '../h';
import { KIND_KO, changedCodon, clickDel, clickSub, codonGrid, codons, currentSeq, undo, type EditState } from '../editlogic';

interface Entry {
  group: string;
  copyIndex: number;
  locus: string;
  seq: string;
  label: string;
}

export function openEditor(ctx: Ctx, reagentIndex: number): void {
  const g = ctx.game;
  const s = g.state;
  if (s.reagents[reagentIndex] !== 'scissors') return;

  // 대상: 온실 포기 + (출하 중이면) 손패
  const targets: { id: string; label: string; species: 'lumi' | 'stella' }[] = [
    ...s.garden.map((p) => ({ id: p.id, label: `${p.name} · ${speciesLabel(p.pheno)}`, species: p.genome.species })),
    ...(s.phase === 'play' ? s.hand.map((c, i) => ({ id: c.uid, label: `손패 ${i + 1}번 · ${phenoSentence(c.pheno, effBrix(c))}`, species: c.genome.species })) : []),
  ];
  let targetId = targets[0]?.id ?? '';
  let entries: Entry[] = [];
  let entry: Entry | null = null;
  let st: EditState = { orig: '', change: null };
  let delMode = false;

  const targetSel = h('select', { class: 'select', 'aria-label': '편집할 대상' }, ...targets.map((t) => h('option', { value: t.id }, t.label)));
  const locusRow = h('div', { class: 'ed__loci', role: 'radiogroup', 'aria-label': '편집할 자리' });
  const strands = h('div', { class: 'ed__strands' });
  const aminos = h('div', { class: 'ed__aminos', 'aria-label': '아미노산 사슬' });
  const focus = h('div', { class: 'ed__focus', 'aria-live': 'polite' });
  const table = h('div', { class: 'ed__table', 'aria-label': '유전 부호 표' });
  const result = h('div', { class: 'ed__result', 'aria-live': 'polite' });
  const delBtn = button('한 염기 지우기', () => {
    delMode = !delMode;
    render();
  }, { class: 'btn--seg', 'aria-pressed': 'false' });
  const undoBtn = button('되돌리기', () => {
    st = undo(st);
    delMode = false;
    audio.play('deselect');
    render();
  }, { class: 'btn--ghost' });
  const applyBtn = button('편집 확정', () => confirm(), { class: 'btn--play' });
  const modeHint = h('p', { class: 'hint ed__mode' });

  const m = ctx.modals.open({
    title: '편집 작업대',
    kicker: '유전자 가위',
    className: 'modal--editor',
    wide: true,
    content: h(
      'div',
      { class: 'ed' },
      h('div', { class: 'ed__top' }, h('label', { class: 'ed__field' }, h('span', { class: 'bar__label' }, '대상'), targetSel), h('div', { class: 'ed__field' }, h('span', { class: 'bar__label' }, '자리'), locusRow)),
      h('div', { class: 'ed__main' }, h('div', { class: 'ed__left' }, focus, strands, aminos, modeHint, result), h('div', { class: 'ed__right' }, h('details', { class: 'ed__reference' }, h('summary', null, '참고: 유전 부호 표 전체 보기'), h('p', { class: 'hint' }, 'mRNA 코돈 세 글자로 아미노산을 찾아요.'), table))),
    ),
    actions: [delBtn, undoBtn, button('닫기', () => m.close(), { class: 'btn--ghost' }), applyBtn],
  });

  targetSel.addEventListener('change', () => {
    targetId = targetSel.value;
    loadTarget();
  });

  function loadTarget(): void {
    entries = g.editTargets(targetId);
    entry = entries[0] ?? null;
    st = { orig: entry?.seq ?? '', change: null };
    delMode = false;
    replaceChildren(
      locusRow,
      ...entries.map((e, i) => {
        const b = h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': String(i === 0) }, e.label);
        b.addEventListener('click', () => {
          entry = e;
          st = { orig: e.seq, change: null };
          delMode = false;
          for (const x of locusRow.children) x.setAttribute('aria-checked', String(x === b));
          render();
        });
        return b;
      }),
    );
    if (!entries.length) replaceChildren(locusRow, h('span', { class: 'hint' }, '편집할 수 있는 유전자가 없어요.'));
    render();
  }

  function render(): void {
    const seq = currentSeq(st);
    const sp = targets.find((t) => t.id === targetId)?.species ?? 'lumi';
    delBtn.setAttribute('aria-pressed', String(delMode));
    delBtn.classList.toggle('is-on', delMode);
    setText(modeHint, delMode ? '지울 염기를 코딩 가닥에서 눌러요.' : '코딩 가닥의 염기를 누르면 A → T → G → C 로 바뀌어요. 한 번에 한 곳만 바꿀 수 있어요.');
    if (!entry) {
      replaceChildren(strands);
      replaceChildren(focus);
      replaceChildren(aminos);
      replaceChildren(result);
      applyBtn.disabled = true;
      undoBtn.disabled = true;
      renderTable(null, null);
      return;
    }
    const chIdx = changedCodon(st);
    const mrna = transcribe(seq);
    const tmpl = templateStrand(seq);
    const cod = codons(seq);
    const origCodons = codons(transcribe(st.orig));
    const row = (label: string, ends: [string, string], text: string, cls: string, clickable: boolean) => {
      const groups = codons(text).map((c, ci) =>
        h(
          'span',
          { class: ['codon', ci === chIdx && 'is-changed'] },
          ...[...c].map((b, bi) => {
            const pos = ci * 3 + bi;
            const changed = st.change?.pos === pos && st.change.kind === 'sub';
            if (!clickable) return h('span', { class: ['base', `base--${b}`, changed && 'is-sub'] }, b);
            const btn = h('button', { type: 'button', class: ['base', `base--${b}`, changed && 'is-sub', delMode && 'is-del'], 'aria-label': `${pos + 1}번째 염기 ${b}` }, b);
            btn.addEventListener('click', () => clickBase(pos));
            return btn;
          }),
        ),
      );
      const delMark = st.change?.kind === 'del' ? h('span', { class: 'ed__delnote' }, `${st.change.pos + 1}번째 염기를 지웠어요`) : null;
      return h('div', { class: ['strand', cls] }, h('div', { class: 'strand__label' }, label), h('span', { class: 'strand__end' }, ends[0]), h('div', { class: 'strand__seq' }, ...groups), h('span', { class: 'strand__end' }, ends[1]), cls === 'strand--coding' ? delMark : null);
    };
    const nums = h('div', { class: 'strand strand--nums', 'aria-hidden': 'true' }, h('div', { class: 'strand__label' }, '코돈'), h('span', { class: 'strand__end' }), h('div', { class: 'strand__seq' }, ...cod.map((_, i) => h('span', { class: ['codon', 'codon--num', i === chIdx && 'is-changed'] }, String(i + 1)))), h('span', { class: 'strand__end' }));
    replaceChildren(
      strands,
      nums,
      row('DNA 주형 가닥', ["3'", "5'"], tmpl, 'strand--template', false),
      row('DNA 코딩 가닥', ["5'", "3'"], seq, 'strand--coding', true),
      h('div', { class: 'strand__arrow', 'aria-hidden': 'true' }, '전사 ↓ (T 대신 U)'),
      row('mRNA', ["5'", "3'"], mrna, 'strand--mrna', false),
    );
    const tr = translate(mrna);
    replaceChildren(
      aminos,
      h('div', { class: 'strand__label' }, '번역 →'),
      ...tr.aminoAcids.map((aa, i) => {
        const after = tr.stopAt !== null && i > tr.stopAt;
        if (aa === 'STOP') return h('span', { class: ['aa', 'aa--stop', after && 'is-after', i === chIdx && 'is-changed'], title: `${tr.codons[i]}: 종결 코돈` }, 'STOP');
        return h('span', { class: ['aa', after && 'is-after', i === chIdx && 'is-changed'], title: `${tr.codons[i]}: ${aa.nameKo} (${aa.code3})` }, h('b', null, aa.nameKo), h('small', null, aa.code3));
      }),
      mrna.length % 3 ? h('span', { class: 'aa aa--rest', title: '세 글자가 안 되는 나머지는 코돈이 아니에요' }, mrna.slice(mrna.length - (mrna.length % 3))) : null,
    );
    const res = analyzeCoding(entry.locus as LocusId, sp, seq);
    replaceChildren(
      result,
      h('div', { class: ['ed__kind', `is-${res.kind}`] }, KIND_KO[res.kind] ?? res.kind),
      h('div', { class: ['ed__func', res.functional ? 'is-on' : 'is-off'] }, res.functional ? '효소 기능: 있음' : '효소 기능: 잃음'),
      h('p', { class: 'ed__note' }, res.note),
    );
    applyBtn.disabled = !st.change || ctx.isBusy();
    undoBtn.disabled = !st.change;
    const newCodon = chIdx !== null ? codons(mrna)[chIdx] ?? null : null;
    const oldCodon = chIdx !== null ? origCodons[chIdx] ?? null : null;
    const aaName = (c: string | null) => c ? CODON_TABLE[c] === 'STOP' ? '종결' : CODON_TABLE[c]?.nameKo ?? '완전한 코돈 아님' : '완전한 코돈 아님';
    replaceChildren(
      focus,
      h('b', null, '이번 편집에서 볼 곳'),
      st.change
        ? h('span', null, st.change.kind === 'del'
          ? `염기 ${st.change.pos + 1}번 삭제 → 읽는 틀이 이동해 뒤의 코돈도 바뀔 수 있어요.`
          : `${chIdx! + 1}번째 코돈: ${oldCodon ?? '—'} (${aaName(oldCodon)}) → ${newCodon ?? '—'} (${aaName(newCodon)})`)
        : h('span', null, '코딩 가닥의 염기 하나를 눌러 바꾸고, 코돈과 단백질의 변화를 살펴보세요.'),
    );
    renderTable(newCodon, oldCodon);
  }

  function renderTable(newC: string | null, oldC: string | null): void {
    const grid = codonGrid();
    const head = h('div', { class: 'ct__row ct__row--head' }, h('span', { class: 'ct__h' }, ''), ...['U', 'C', 'A', 'G'].map((b) => h('span', { class: 'ct__h' }, `둘째 ${b}`)));
    const rows = grid.map((block, i) =>
      h(
        'div',
        { class: 'ct__block' },
        h('span', { class: 'ct__first' }, ['U', 'C', 'A', 'G'][i]),
        ...block.map((col) =>
          h(
            'div',
            { class: 'ct__col' },
            ...col.map((c) => {
              const aa = CODON_TABLE[c];
              const stop = aa === 'STOP';
              return h('span', { class: ['ct__cell', stop && 'is-stop', c === newC && 'is-new', c === oldC && c !== newC && 'is-old'], title: stop ? `${c}: 종결` : `${c}: ${aa.nameKo}` }, h('b', null, c), h('small', null, stop ? '종결' : aa.code3));
            }),
          ),
        ),
      ),
    );
    replaceChildren(table, head, ...rows);
  }

  function clickBase(pos: number): void {
    const out = delMode ? clickDel(st, pos) : clickSub(st, pos);
    if (!out.ok) {
      ctx.toast.error(out.reason);
      return;
    }
    st = out.state;
    delMode = false;
    audio.play('edit');
    render();
  }

  function confirm(): void {
    if (!entry || !st.change || ctx.isBusy()) return;
    const r = g.applyEdit(reagentIndex, targetId, entry.group, entry.copyIndex, entry.locus, currentSeq(st));
    if (!r.ok) {
      ctx.toast.error(r.reason ?? '편집할 수 없어요.');
      return;
    }
    audio.play('xmult');
    m.close();
  }

  loadTarget();
}
