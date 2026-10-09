import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { demonstratedBoard, equalityItems, WEIGHTS, type EqualityProblem } from './balanceEqualityModel';
import { isHands, STAGES, stageSolved, TRAY, weightSum, workshopExpected, workshopItems, type WorkshopBoard,
  type WorkshopMode, type WorkshopProblem } from './balanceWorkshopModel';
import { balanceSpokenMisses } from './balanceScaleWorkspace';
import { equalityLeverFacts, equalityLevers, equalityPracticeItem, equalitySessionAnswers, greedy, modelWeight,
  practiceBoard, workshopLeverFacts, workshopLevers, workshopPracticeItem, workshopSessionAnswers } from './balanceScaleLevers';

const eq = (target: number, i = 0): EqualityProblem => ({ id: `balance-${i + 1}`, target, mode: 'equality' });
const ws = (mode: WorkshopMode, target: number, parcels = 1, known = 0, i = 0): WorkshopProblem =>
  ({ id: `workshop-${i + 1}`, mode, target, parcels, known, total: mode === 'equality_hard' ? target : parcels * target + known, reverse: false });
const board = (values: number[], extra: Partial<WorkshopBoard> = {}): WorkshopBoard =>
  ({ weights: values.map((value, i) => ({ id: i, value })), first: [], leftAside: false, units: [], ...extra });
const wsItem = (p: WorkshopProblem, step: string) => workshopItems([p]).find(i => i.step === step)!;
const ids = (levers: { id: string }[]) => levers.map(l => l.id);

describe('which lever answers which miss (nextLever over the declared levers)', () => {
  const total = equalityItems([eq(7), eq(9, 1)])[1];
  const infer = equalityItems([eq(7), eq(9, 1)])[2];
  const loaded = { blocks: [3, 3, 1].map((value, id) => ({ id, value })) };
  it.each([
    ['equality total', equalityLevers(total, loaded, [], [eq(7), eq(9, 1)]), 'one_short', 'unit_cells'],
    ['equality total', equalityLevers(total, loaded, [], [eq(7), eq(9, 1)]), 'over_by_more', 'two_blocks'],
    ['equality infer', equalityLevers(infer, loaded, [], [eq(7), eq(9, 1)]), 'one_over', 'balance_model'],
    ['equality infer', equalityLevers(infer, loaded, [], [eq(7), eq(9, 1)]), 'short_by_more', 'one_block'],
    ['one_step added', workshopLevers(wsItem(ws('one_step', 7, 1, 3), 'added'), board([5, 2]), [], [ws('one_step', 7, 1, 3)]), 'said_whole', 'part_whole_bar'],
    ['one_step added', workshopLevers(wsItem(ws('one_step', 7, 1, 3), 'added'), board([5, 2]), [], [ws('one_step', 7, 1, 3)]), 'one_short', 'unit_cells'],
    ['one_step relate', workshopLevers(wsItem(ws('one_step', 7, 1, 3), 'relate'), board([5, 2]), [], [ws('one_step', 7, 1, 3)]), 'added_both', 'part_whole_bar'],
    ['one_step relate', workshopLevers(wsItem(ws('one_step', 7, 1, 3), 'relate'), board([5, 2]), [], [ws('one_step', 7, 1, 3)]), 'over_by_more', 'smaller_load'],
    ['one_step_hard each', workshopLevers(wsItem(ws('one_step_hard', 4, 3), 'each'), board([]), [], [ws('one_step_hard', 4, 3)]), 'said_parcels', 'one_group'],
    ['one_step_hard infer', workshopLevers(wsItem(ws('one_step_hard', 4, 3), 'infer'), board([]), [], [ws('one_step_hard', 4, 3)]), 'over_by_more', 'fewer_parcels'],
    ['two_step remaining', workshopLevers(wsItem(ws('two_step', 3, 2, 1), 'remaining'), board([]), [], [ws('two_step', 3, 2, 1)]), 'said_change', 'on_scale_only'],
    ['two_step each', workshopLevers(wsItem(ws('two_step', 3, 2, 1), 'each'), board([]), [], [ws('two_step', 3, 2, 1)]), 'said_whole', 'one_group'],
  ])('%s: %s -> %s', (_label, levers, miss, expected) => {
    expect(nextLever(levers, miss)).toBe(expected);
  });

  it('every miss a spoken step can name has a lever on that item, for many random items in every mode', () => {
    for (let seed = 0; seed < 300; seed++) {
      const mode = (['equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const)[seed % 5];
      const parcels = mode === 'one_step' || mode === 'equality_hard' ? 1 : 2 + (seed % 4);
      const target = 2 + (seed * 7) % 9, known = mode.startsWith('two_step') ? 1 + seed % 4 : mode === 'one_step' ? 1 + seed % 6 : 0;
      const p = ws(mode, target, parcels, known), session = [p, ws(mode, target === 9 ? 2 : target + 1, parcels, known, 1)];
      for (const item of workshopItems([p]).filter(i => !isHands(i.step) && i.step !== 'explain')) {
        const b = practiceBoard(p, item.step);
        const levers = workshopLevers(item, b, [], session);
        for (const miss of balanceSpokenMisses(item).map(m => m.id))
          expect(levers.some(l => l.answers?.includes(miss)), `${mode} ${item.step} t=${target} P=${parcels}: ${miss}`).toBe(true);
      }
    }
    for (let target = 1; target <= 20; target++) for (const values of [greedy(target, WEIGHTS), Array(target).fill(1)]) {
      const session = [eq(target), eq(target === 20 ? 3 : target + 1, 1)];
      for (const item of equalityItems(session).slice(1, 3)) {
        const levers = equalityLevers(item, { blocks: values.map((value, id) => ({ id, value })) }, [], session);
        for (const miss of balanceSpokenMisses(item).map(m => m.id))
          expect(levers.some(l => l.answers?.includes(miss)), `equality ${item.step} t=${target}: ${miss}`).toBe(true);
      }
    }
  });
});

describe('leak rules', () => {
  it('the model scale weight is never the item answer or a session answer', () => {
    for (let t = 1; t <= 20; t++) {
      const used = new Set([t, (t % 9) + 2, 4, 3]);
      const k = modelWeight(t, used);
      if (k !== null) { expect(k).not.toBe(t); expect(used.has(k)).toBe(false); }
    }
  });

  it('a pulled lever\'s scene fact never states the step\'s answer', () => {
    const session = [eq(7), eq(9, 1)];
    for (const item of equalityItems(session).filter(i => i.step !== 'build'))
      expect(equalityLeverFacts(item, ['unit_cells', 'balance_model'], session)).not.toMatch(new RegExp(`\\b${item.problem.target}\\b`));
    const cases: [WorkshopProblem, string][] = [[ws('equality_hard', 8), 'infer'], [ws('equality_hard', 8), 'sum'],
      [ws('one_step', 6, 1, 4), 'added'], [ws('one_step', 6, 1, 4), 'relate'], [ws('one_step_hard', 4, 3), 'each'],
      [ws('two_step', 5, 3, 2), 'remaining'], [ws('two_step', 5, 3, 2), 'infer']];
    for (const [p, step] of cases) {
      const item = wsItem(p, step), answer = workshopExpected(p, item.step);
      const fact = workshopLeverFacts(item, ['unit_cells', 'balance_model', 'part_whole_bar', 'one_group', 'on_scale_only'], [p]);
      expect(fact.replace(`${p.total}`, '').replace(`${p.known}`, '').replace(`${p.parcels} parcels`, ''), `${p.mode} ${step}`)
        .not.toMatch(new RegExp(`\\b${answer}\\b`));
      for (const l of workshopLevers(item, practiceBoard(p, item.step), [], [p]))
        expect(l.does.replace(`${p.total}`, '').replace(`${p.known}`, ''), l.id).not.toMatch(new RegExp(`\\b${answer}\\b`));
    }
  });
});

describe('simplify builders', () => {
  it('equality: a two-block load below the total and a one-block load, never a session answer', () => {
    for (let t = 2; t <= 20; t++) {
      const session = [eq(t), eq(t === 20 ? 3 : t + 1, 1)], used = equalitySessionAnswers(session);
      const [, total, infer] = equalityItems(session);
      const load = { blocks: Array(t).fill(1).map((value, id) => ({ id, value })) };
      const two = equalityPracticeItem(total, 'two_blocks', load, session);
      if (two) {
        expect(two.item.id).toBe(`${total.id}~simpler`);
        expect(two.board).toEqual(demonstratedBoard(two.item.problem));
        expect(two.board.blocks).toHaveLength(2);
        expect(two.item.problem.target).toBeLessThan(t);
        expect(used.has(two.item.problem.target)).toBe(false);
      }
      const one = equalityPracticeItem(infer, 'one_block', load, session);
      expect(one).not.toBeNull();
      expect(one!.board.blocks).toHaveLength(1);
      expect(used.has(one!.item.problem.target)).toBe(false);
      // A one-block load is already the plainest shape.
      expect(equalityPracticeItem(infer, 'one_block', { blocks: [{ id: 0, value: t }] }, session)).toBeNull();
    }
  });

  it('workshop: same mode and floor, simpler, solvable, never the item or a session answer, board ready for the step', () => {
    for (let seed = 0; seed < 400; seed++) {
      const mode = (['equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const)[seed % 5];
      const parcels = mode === 'one_step' || mode === 'equality_hard' ? 1 : 2 + (seed % 4);
      const target = 2 + (seed * 7) % 12, known = mode.startsWith('two_step') ? 1 + seed % 5 : mode === 'one_step' ? 1 + seed % 6 : 0;
      const p = ws(mode, target, parcels, known), session = [p, ws(mode, 2 + (seed * 3) % 11, parcels, known, 1)];
      const used = workshopSessionAnswers(session);
      for (const item of workshopItems([p]).filter(i => !isHands(i.step) && i.step !== 'explain')) {
        const own = practiceBoard(p, item.step);
        for (const lever of workshopLevers(item, own, [], session).filter(l => l.kind === 'simplify')) {
          const built = workshopPracticeItem(item, lever.id, own, session)!;
          expect(built, `${mode} ${item.step} ${lever.id}`).not.toBeNull();
          const q = built.item.problem;
          expect(built.item.id).toBe(`${item.id}~simpler`);
          expect(q.mode).toBe(mode);
          expect(q.total).toBe(mode === 'equality_hard' ? q.target : q.parcels * q.target + q.known);
          if (mode === 'one_step') expect(q.parcels).toBe(1);
          if (mode === 'one_step_hard') expect([q.parcels >= 2, q.known]).toEqual([true, 0]);
          if (mode.startsWith('two_step')) expect(q.parcels >= 2 && q.known >= 1).toBe(true);
          if (lever.id !== 'one_block') expect(q.parcels < p.parcels || q.target < p.target, `${mode} ${lever.id} simpler`).toBe(true);
          for (const step of STAGES[mode].filter(s => !isHands(s) && s !== 'explain')) expect(used.has(workshopExpected(q, step))).toBe(false);
          expect([q.target, q.parcels, q.known]).not.toEqual([p.target, p.parcels, p.known]);
          // Every hands step before this one is done on the practice board.
          for (const s of STAGES[mode].slice(0, STAGES[mode].indexOf(item.step)).filter(isHands)) {
            if (s === 'recompose') expect(weightSum(built.board.weights)).toBe(q.target);
            else expect(stageSolved(q, s, built.board), `${mode} ${s}`).toBe(true);
          }
          if (lever.id === 'two_blocks') expect(built.board.weights).toHaveLength(2);
          if (lever.id === 'one_block' || lever.id === 'smaller_load') expect(built.board.weights).toHaveLength(1);
          if (mode === 'equality_hard') expect(weightSum(built.board.weights)).toBe(q.target);
        }
      }
    }
  });

  it('the plainest shapes offer no simplify: two parcels of 2, one added block, a two-block sum', () => {
    const plain = ws('one_step_hard', 2, 2);
    expect(ids(workshopLevers(wsItem(plain, 'each'), practiceBoard(plain, 'each'), [], [plain]))).toEqual(['one_group']);
    const one = ws('one_step', 5, 1, 3);
    expect(ids(workshopLevers(wsItem(one, 'added'), board([5]), [], [one]))).toEqual(['part_whole_bar', 'unit_cells']);
    const sum = ws('equality_hard', 7);
    expect(ids(workshopLevers(wsItem(sum, 'sum'), board([5, 2]), [], [sum]))).toEqual(['unit_cells']);
    expect(TRAY).toContain(5);
  });
});
