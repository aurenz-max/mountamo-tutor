import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { DI_CATALOG } from '../../../service/manifest/catalog/di';
import { planSubtraction } from './diWorkedProcedurePlan';
import { itemsFromProblems, type WorkedProblemSpec, type WorkedProcedureItem } from './diWorkedProcedureScript';
import { workedProcedureSpokenMisses } from './diWorkedProcedureWorkspace';
import { FEWER_COLUMNS, MODEL_PROBLEM, TAKE_AWAY_CUBES, TOP_BLOCKS, fewerColumnsFor, modelFor, modelLeaks, modelWalk,
  procedureLeverFacts, procedureLevers, startingLevers } from './diWorkedProcedureLevers';
import noRegroup from '../../../components/live-activity/runtime/testing/w1-payloads/di-worked-procedure.subtract_no_regroup.json';
import regroup from '../../../components/live-activity/runtime/testing/w1-payloads/di-worked-procedure.subtract_regroup.json';
import regroup3 from '../../../components/live-activity/runtime/testing/w1-payloads/di-worked-procedure.subtract_regroup-3digit-hard.json';

const steps = (m: number, s: number, mode: WorkedProblemSpec['challengeType'] = 'subtract_regroup', tier?: WorkedProblemSpec['supportTier']) =>
  itemsFromProblems([{ id: `p${m}-${s}`, minuend: m, subtrahend: s, challengeType: mode, ...(tier ? { supportTier: tier } : {}) }]).items;
const SAVED: WorkedProcedureItem[][] = [noRegroup, regroup, regroup3].map(p => itemsFromProblems(p.data.problems as WorkedProblemSpec[]).items);
const CATALOG = DI_CATALOG.find(c => c.id === 'di-worked-procedure')!.teachingWorkspace!;
const spokenNumbers = (text: string) => new Set(text.match(/\b\d+\b/g)?.map(Number) ?? []);

describe('model_problem: a different subtraction that says no step answer of this one', () => {
  it('every askable 2-digit problem of both modes has a model of the same width and the fixed pattern', () => {
    let checked = 0;
    for (let m = 21; m <= 99; m++) for (let s = 10; s < m; s++) {
      const plan = planSubtraction(m, s);
      if (!plan) continue;
      const mode = plan.regroupCount ? 'subtract_regroup' : 'subtract_no_regroup';
      const model = modelFor({ minuend: m, subtrahend: s, challengeType: mode });
      expect(model, `${m} − ${s}`).not.toBeNull();
      expect(modelLeaks(model!, plan)).toBe(false);
      expect(model!.columns.map(c => c.regroup)).toEqual(mode === 'subtract_regroup' ? [true, false] : [false, false]);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('a sample of 3-digit regroup problems, and every saved problem, has a non-leaking model', () => {
    const sample = [[630, 498], [964, 686], [856, 167], [742, 315], [523, 187], [811, 452]];
    for (const [m, s] of sample) {
      const plan = planSubtraction(m, s);
      if (!plan) continue;
      const model = modelFor({ minuend: m, subtrahend: s, challengeType: 'subtract_regroup' });
      expect(model, `${m} − ${s}`).not.toBeNull();
      expect(model!.columns.map(c => c.regroup)).toEqual([true, false, false]);
    }
    for (const session of SAVED) for (const it0 of session) expect(modelFor(it0), it0.problemDisplay).not.toBeNull();
  });

  it('the walk says every column; no model column has an item column\'s pair or its flip; never the item\'s answer', () => {
    const it0 = steps(52, 28)[0];
    const model = modelFor(it0)!;
    const walk = modelWalk(model);
    expect(walk).toMatch(/ones: .*tens: /);
    const own = planSubtraction(52, 28)!;
    for (const c of model.columns) for (const o of own.columns)
      expect([`${c.top}/${c.bottom}`]).not.toContain(`${o.top}/${o.bottom}`);
    expect(spokenNumbers(walk).has(own.difference)).toBe(false);
    expect(procedureLeverFacts(it0, [MODEL_PROBLEM])).not.toContain(`${own.difference}`);
  });
});

describe('help levers per step', () => {
  it('a regroup decide step gets the model and top_blocks (R9); a subtract step gets take_away_cubes, not top_blocks', () => {
    const [decide, subtract] = steps(52, 28);
    expect(decide.kind).toBe('decide');
    expect(procedureLevers(decide, []).map(l => l.id)).toEqual([MODEL_PROBLEM, TOP_BLOCKS]);
    expect(subtract.kind).toBe('subtract');
    expect(procedureLevers(subtract, []).map(l => l.id)).toEqual([MODEL_PROBLEM, TAKE_AWAY_CUBES]);
  });

  it('every no-regroup step gets take_away_cubes and top_blocks; never a simplify', () => {
    for (const it0 of steps(57, 23, 'subtract_no_regroup'))
      expect(procedureLevers(it0, [], 'one_over').map(l => l.id)).toEqual([MODEL_PROBLEM, TOP_BLOCKS, TAKE_AWAY_CUBES]);
  });
});

describe('fewer_columns: only on a 3-digit tens regroup, only after no_decrement', () => {
  const tens = steps(630, 498).find(i => i.kind === 'decide' && i.columnIndex === 1 && i.regroup)!;
  it('is declared only after no_decrement', () => {
    expect(tens).toBeDefined();
    expect(procedureLevers(tens, []).map(l => l.id)).not.toContain(FEWER_COLUMNS);
    expect(procedureLevers(tens, [], 'upside_down_column').map(l => l.id)).not.toContain(FEWER_COLUMNS);
    expect(procedureLevers(tens, [], 'no_decrement').map(l => l.id)).toContain(FEWER_COLUMNS);
  });

  it('builds a 2-digit ones regroup decide step, not the item\'s pair, and not its new numbers', () => {
    const easier = fewerColumnsFor(tens, 'no_decrement')!;
    expect(String(easier.minuend)).toHaveLength(2);
    expect([easier.kind, easier.columnIndex, easier.regroup]).toEqual(['decide', 0, true]);
    expect(easier.id.startsWith(`${tens.id}~simpler`)).toBe(true);
    expect(easier.newAbove).not.toBe(tens.newAbove);
    expect(easier.column.effectiveTop).not.toBe(tens.column.effectiveTop);
    expect(`${easier.column.top}/${easier.column.bottom}`).not.toBe(`${tens.column.top}/${tens.column.bottom}`);
  });

  it('is refused on a 2-digit problem and on the ones column', () => {
    const [ones] = steps(52, 28);
    expect(fewerColumnsFor(ones, 'no_decrement')).toBeNull();
  });
});

describe('starting positions and which lever answers which miss', () => {
  it('only easy starts with the model (no tier is medium in this pack)', () => {
    expect(startingLevers(steps(52, 28, 'subtract_regroup', 'easy')[0])).toEqual([MODEL_PROBLEM]);
    expect(startingLevers(steps(52, 28)[0])).toEqual([]);
  });

  it.each([
    ['upside_down_column', [], MODEL_PROBLEM],
    ['upside_down_column', [MODEL_PROBLEM], TOP_BLOCKS],
    ['no_decrement', [MODEL_PROBLEM], TOP_BLOCKS],
  ] as const)('regroup decide: %s with %j on screen → %s', (miss, pulled, expected) => {
    expect(nextLever(procedureLevers(steps(52, 28)[0], pulled, miss), miss)).toBe(expected);
  });

  it('every catalog miss is answered on the saved payloads, and every named miss is listed', () => {
    for (const session of SAVED) {
      const mode = session[0].challengeType;
      const answered = new Set(session.flatMap(i => procedureLevers(i, [], 'no_decrement').flatMap(l => l.answers ?? [])));
      for (const miss of CATALOG.misses![mode]) expect(answered.has(miss), `${mode}: ${miss}`).toBe(true);
      for (const i of session) for (const m of workedProcedureSpokenMisses(i)) expect(CATALOG.misses![mode], `${i.id} ${m.id}`).toContain(m.id);
    }
  });
});
