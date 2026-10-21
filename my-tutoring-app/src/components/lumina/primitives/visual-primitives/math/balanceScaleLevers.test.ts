import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { equalityItems, WEIGHTS, type EqualityItem, type EqualityProblem } from './balanceEqualityModel';
import { isHands, STAGES, stageSolved, TRAY, weightSum, workshopExpected, workshopItems,
  type WorkshopItem, type WorkshopMode, type WorkshopProblem } from './balanceWorkshopModel';
import { balanceSpokenMisses, type BalanceItem } from './balanceScaleWorkspace';
import { BALANCE_LEVERS, balanceLeverCtx, equalityPracticeBoard, greedy, modelWeight, practiceBoard,
  sessionAnswers } from './balanceScaleLevers';

const eq = (target: number, i = 0): EqualityProblem => ({ id: `balance-${i + 1}`, target, mode: 'equality' });
const ws = (mode: WorkshopMode, target: number, parcels = 1, known = 0, i = 0): WorkshopProblem =>
  ({ id: `workshop-${i + 1}`, mode, target, parcels, known, total: mode === 'equality_hard' ? target : parcels * target + known, reverse: false });
const wsItem = (p: WorkshopProblem, step: string) => workshopItems([p]).find(i => i.step === step)!;
const ids = (levers: { id: string }[]) => levers.map(l => l.id);
/** The levers the set declares on an item of a session, with the learner's load of `blocks` weights. */
const declared = (item: BalanceItem, session: BalanceItem[], blocks: number) =>
  BALANCE_LEVERS.declare(item, balanceLeverCtx(session, blocks), []);
const wsSession = (...problems: WorkshopProblem[]) => workshopItems(problems);
const simplify = (item: BalanceItem, session: BalanceItem[], blocks: number, lever: string) =>
  BALANCE_LEVERS.simpler(item, balanceLeverCtx(session, blocks), lever);

describe('which lever answers which miss (nextLever over the declared levers)', () => {
  const session = equalityItems([eq(7), eq(9, 1)]);
  const [, total, infer] = session;
  const oneStep = wsSession(ws('one_step', 7, 1, 3)), hard = wsSession(ws('one_step_hard', 4, 3)), two = wsSession(ws('two_step', 3, 2, 1));
  const at = (items: WorkshopItem[], step: string) => items.find(i => i.step === step)!;
  it.each([
    ['equality total', declared(total, session, 3), 'one_short', 'unit_cells'],
    ['equality total', declared(total, session, 3), 'over_by_more', 'two_blocks'],
    ['equality infer', declared(infer, session, 3), 'one_over', 'balance_model'],
    ['equality infer', declared(infer, session, 3), 'short_by_more', 'one_block'],
    ['one_step added', declared(at(oneStep, 'added'), oneStep, 2), 'said_whole', 'part_whole_bar'],
    ['one_step added', declared(at(oneStep, 'added'), oneStep, 2), 'one_short', 'unit_cells'],
    ['one_step relate', declared(at(oneStep, 'relate'), oneStep, 2), 'added_both', 'part_whole_bar'],
    ['one_step relate', declared(at(oneStep, 'relate'), oneStep, 2), 'over_by_more', 'smaller_load'],
    ['one_step_hard each', declared(at(hard, 'each'), hard, 0), 'said_parcels', 'one_group'],
    ['one_step_hard infer', declared(at(hard, 'infer'), hard, 0), 'over_by_more', 'fewer_parcels'],
    ['two_step remaining', declared(at(two, 'remaining'), two, 0), 'said_change', 'on_scale_only'],
    ['two_step each', declared(at(two, 'each'), two, 0), 'said_whole', 'one_group'],
  ])('%s: %s -> %s', (_label, levers, miss, expected) => {
    expect(nextLever(levers, miss)).toBe(expected);
  });

  it('every miss a spoken step can name has a lever on that item, for many random items in every mode', () => {
    for (let seed = 0; seed < 300; seed++) {
      const mode = (['equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const)[seed % 5];
      const parcels = mode === 'one_step' || mode === 'equality_hard' ? 1 : 2 + (seed % 4);
      const target = 2 + (seed * 7) % 9, known = mode.startsWith('two_step') ? 1 + seed % 4 : mode === 'one_step' ? 1 + seed % 6 : 0;
      const p = ws(mode, target, parcels, known), session = wsSession(p, ws(mode, target === 9 ? 2 : target + 1, parcels, known, 1));
      for (const item of workshopItems([p]).filter(i => !isHands(i.step) && i.step !== 'explain')) {
        const levers = declared(item, session, practiceBoard(p, item.step).weights.length);
        for (const miss of balanceSpokenMisses(item).map(m => m.id))
          expect(levers.some(l => l.answers?.includes(miss)), `${mode} ${item.step} t=${target} P=${parcels}: ${miss}`).toBe(true);
      }
    }
    for (let target = 1; target <= 20; target++) for (const values of [greedy(target, WEIGHTS), Array(target).fill(1)]) {
      const session = equalityItems([eq(target), eq(target === 20 ? 3 : target + 1, 1)]);
      for (const item of session.slice(1, 3)) {
        const levers = declared(item, session, values.length);
        for (const miss of balanceSpokenMisses(item).map(m => m.id))
          expect(levers.some(l => l.answers?.includes(miss)), `equality ${item.step} t=${target}: ${miss}`).toBe(true);
      }
    }
  });

  it('hands steps and the explanation offer no lever', () => {
    const two = wsSession(ws('two_step', 3, 2, 1));
    for (const item of two.filter(i => isHands(i.step) || i.step === 'explain')) expect(declared(item, two, 5)).toEqual([]);
    const session = equalityItems([eq(7)]);
    expect(declared(session[0], session, 3)).toEqual([]);
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
    const session = equalityItems([eq(7), eq(9, 1)]);
    for (const item of session.filter(i => i.step !== 'build'))
      expect(BALANCE_LEVERS.onScreen(item, balanceLeverCtx(session, 3), ['unit_cells', 'balance_model']))
        .not.toMatch(new RegExp(`\\b${item.problem.target}\\b`));
    const cases: [WorkshopProblem, string][] = [[ws('equality_hard', 8), 'infer'], [ws('equality_hard', 8), 'sum'],
      [ws('one_step', 6, 1, 4), 'added'], [ws('one_step', 6, 1, 4), 'relate'], [ws('one_step_hard', 4, 3), 'each'],
      [ws('two_step', 5, 3, 2), 'remaining'], [ws('two_step', 5, 3, 2), 'infer']];
    for (const [p, step] of cases) {
      const item = wsItem(p, step), answer = workshopExpected(p, item.step), session = wsSession(p);
      const ctx = balanceLeverCtx(session, practiceBoard(p, item.step).weights.length);
      const fact = BALANCE_LEVERS.onScreen(item, ctx, ['unit_cells', 'balance_model', 'part_whole_bar', 'one_group', 'on_scale_only']);
      expect(fact.replace(`${p.total}`, '').replace(`${p.known}`, '').replace(`${p.parcels} parcels`, ''), `${p.mode} ${step}`)
        .not.toMatch(new RegExp(`\\b${answer}\\b`));
      for (const l of BALANCE_LEVERS.declare(item, ctx, []))
        expect(l.does.replace(`${p.total}`, '').replace(`${p.known}`, ''), l.id).not.toMatch(new RegExp(`\\b${answer}\\b`));
    }
  });
});

describe('simplify builders', () => {
  it('equality: a two-block load below the total and a one-block load, never a session answer', () => {
    for (let t = 2; t <= 20; t++) {
      const session = equalityItems([eq(t), eq(t === 20 ? 3 : t + 1, 1)]), used = sessionAnswers(session);
      const [, total, infer] = session;
      const two = simplify(total, session, t, 'two_blocks') as EqualityItem | null;
      if (two) {
        expect(two.id).toBe(`${total.id}~simpler`);
        expect(equalityPracticeBoard(two).blocks).toHaveLength(2);
        expect(two.problem.target).toBeLessThan(t);
        expect(used.has(two.problem.target)).toBe(false);
      }
      const one = simplify(infer, session, t, 'one_block') as EqualityItem | null;
      expect(one).not.toBeNull();
      expect(equalityPracticeBoard(one!).blocks).toHaveLength(1);
      expect(used.has(one!.problem.target)).toBe(false);
      // A one-block load is already the plainest shape.
      expect(simplify(infer, session, 1, 'one_block')).toBeNull();
    }
  });

  it('a practice step keeps the session item\'s support tier', () => {
    const session = equalityItems([eq(7), eq(9, 1)]).map(i => ({ ...i, tier: 'easy' as const }));
    expect(simplify(session[2], session, 3, 'one_block')).toMatchObject({ tier: 'easy' });
  });

  it('workshop: same mode and floor, simpler, solvable, never the item or a session answer, board ready for the step', () => {
    for (let seed = 0; seed < 400; seed++) {
      const mode = (['equality_hard', 'one_step', 'one_step_hard', 'two_step_intro', 'two_step'] as const)[seed % 5];
      const parcels = mode === 'one_step' || mode === 'equality_hard' ? 1 : 2 + (seed % 4);
      const target = 2 + (seed * 7) % 12, known = mode.startsWith('two_step') ? 1 + seed % 5 : mode === 'one_step' ? 1 + seed % 6 : 0;
      const p = ws(mode, target, parcels, known), session = wsSession(p, ws(mode, 2 + (seed * 3) % 11, parcels, known, 1));
      const used = sessionAnswers(session);
      for (const item of workshopItems([p]).filter(i => !isHands(i.step) && i.step !== 'explain')) {
        const blocks = practiceBoard(p, item.step).weights.length;
        for (const lever of declared(item, session, blocks).filter(l => l.kind === 'simplify')) {
          const built = simplify(item, session, blocks, lever.id) as WorkshopItem | null;
          expect(built, `${mode} ${item.step} ${lever.id}`).not.toBeNull();
          const q = built!.problem, board = practiceBoard(q, built!.step);
          expect(built!.id).toBe(`${item.id}~simpler`);
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
            if (s === 'recompose') expect(weightSum(board.weights)).toBe(q.target);
            else expect(stageSolved(q, s, board), `${mode} ${s}`).toBe(true);
          }
          if (lever.id === 'two_blocks') expect(board.weights).toHaveLength(2);
          if (lever.id === 'one_block' || lever.id === 'smaller_load') expect(board.weights).toHaveLength(1);
          if (mode === 'equality_hard') expect(weightSum(board.weights)).toBe(q.target);
        }
      }
    }
  });

  it('the plainest shapes offer no simplify: two parcels of 2, one added block, a two-block sum', () => {
    const plain = ws('one_step_hard', 2, 2);
    expect(ids(declared(wsItem(plain, 'each'), wsSession(plain), 0))).toEqual(['one_group']);
    const one = ws('one_step', 5, 1, 3);
    expect(ids(declared(wsItem(one, 'added'), wsSession(one), 1))).toEqual(['part_whole_bar', 'unit_cells']);
    const sum = ws('equality_hard', 7);
    expect(ids(declared(wsItem(sum, 'sum'), wsSession(sum), 2))).toEqual(['unit_cells']);
    expect(TRAY).toContain(5);
  });
});

describe('support: when the model lever comes', () => {
  it('only an inference step with the model offered gets a support fact, at the lesson tier (medium when unset)', () => {
    const session = equalityItems([eq(7), eq(9, 1)]);
    const ctx = balanceLeverCtx(session, 3);
    expect(BALANCE_LEVERS.support(session[1], ctx)).toBe('');
    expect(BALANCE_LEVERS.support(session[2], ctx)).toMatch(/balance_model/);
    expect(BALANCE_LEVERS.support({ ...session[2], tier: 'easy' }, ctx)).toMatch(/^before the learner tries, pull the model lever \(balance_model\)/);
    const share = wsSession(ws('one_step_hard', 4, 3));
    expect(BALANCE_LEVERS.support(share.find(i => i.step === 'infer')!, balanceLeverCtx(share, 0))).toBe('');
  });
});
