/**
 * math-fact-fluency levers (`/add-support-tiers`, handoff 30 M3): the model each lever draws, which levers each mode
 * offers, "this wrong answer, then this lever", the leak rules, and the simplify builders over many random facts and
 * every saved payload.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import type { MathFactFluencyChallenge } from './MathFactFluency';
import { equationResult, mathFactMatches, mathFactMiss, type MathFactResponse } from './mathFactFluencyWorkspace';
import { factModel, farMatch, leverFacts, mathFactLevers, simplerItem, smallerFact, startLevers } from './mathFactFluencyLevers';

type C = MathFactFluencyChallenge;
const fact = (type: C['type'], a: number, op: '+' | '-', b: number, unknown: C['unknownPosition'] = 'result', extra: Partial<C> = {}): C => {
  const operation = op === '+' ? 'addition' : 'subtraction';
  const result = op === '+' ? a + b : a - b;
  const correctAnswer = unknown === 'operand1' ? a : unknown === 'operand2' ? b : result;
  return { id: 'c1', type, instruction: 'Solve.', equation: `${a} ${op} ${b} = ${result}`, operation, operand1: a, operand2: b, result,
    unknownPosition: unknown, correctAnswer, ...extra };
};
const options = (answer: number) => [answer - 1, answer, answer + 1, answer + 2].filter(v => v >= 0);

describe('factModel', () => {
  it.each([
    ['3 + 2 = ?', fact('equation-solve', 3, '+', 2), [[3, 'plain'], [2, 'added']]],
    ['5 − 2 = ?', fact('equation-solve', 5, '-', 2), [[3, 'plain'], [2, 'crossed']]],
    ['3 + ? = 7', fact('missing-number', 3, '+', 4, 'operand2'), [[3, 'marked'], [4, 'empty']]],
    ['? + 2 = 7', fact('missing-number', 5, '+', 2, 'operand1'), [[5, 'empty'], [2, 'marked']]],
    ['8 − ? = 5', fact('missing-number', 8, '-', 3, 'operand2'), [[5, 'marked'], [3, 'empty']]],
    ['? − 4 = 3', fact('missing-number', 7, '-', 4, 'operand1'), [[3, 'marked'], [4, 'crossed']]],
  ])('%s', (_name, c, want) => {
    expect(factModel(c).map(s => [s.count, s.tone])).toEqual(want);
  });
});

describe('which levers each mode offers', () => {
  it.each([
    ['visual_fact', fact('visual-fact', 3, '+', 2, 'result', { visualType: 'dot-array', options: options(5) }), ['two_parts', 'count_marks', 'smaller_fact']],
    ['visual_fact on fingers', fact('visual-fact', 3, '+', 2, 'result', { visualType: 'fingers', options: options(5) }), ['two_parts', 'count_marks', 'smaller_fact']],
    ['visual_fact already +1', fact('visual-fact', 3, '+', 1, 'result', { visualType: 'dot-array', options: options(4) }), ['two_parts', 'count_marks']],
    ['match picture → equation', fact('match', 2, '+', 3, 'result', { matchDirection: 'visual-to-equation', visualType: 'ten-frame' }), ['count_marks', 'far_match']],
    ['match fingers → equation', fact('match', 2, '+', 3, 'result', { matchDirection: 'visual-to-equation', visualType: 'fingers' }), ['count_marks', 'far_match']],
    ['match equation → picture', fact('match', 2, '+', 3, 'result', { matchDirection: 'equation-to-visual' }), ['fact_dots', 'far_match']],
    ['equation_solve', fact('equation-solve', 3, '+', 2, 'result', { options: options(5) }), ['fact_dots', 'smaller_fact']],
    ['missing_number', fact('missing-number', 3, '+', 4, 'operand2'), ['part_whole', 'smaller_fact']],
    ['speed_round (ruled out)', fact('speed-round', 3, '+', 2), []],
  ])('%s', (_name, c, want) => {
    expect(mathFactLevers(c, [], 10).map(l => l.id)).toEqual(want);
  });
});

describe('this wrong answer, then this lever', () => {
  const visual = fact('visual-fact', 3, '+', 2, 'result', { visualType: 'dot-array', options: options(5) });
  const solve = fact('equation-solve', 4, '+', 3, 'result', { options: options(7) });
  const missing = fact('missing-number', 3, '+', 4, 'operand2');
  const match = fact('match', 4, '+', 4, 'result', { matchDirection: 'visual-to-equation', visualType: 'dot-array' });
  it.each([
    [visual, 'printed_number', 'two_parts'], [visual, 'other_operation', 'two_parts'],
    [visual, 'one_short', 'count_marks'], [visual, 'one_over', 'count_marks'],
    [visual, 'short_by_more', 'smaller_fact'], [visual, 'over_by_more', 'smaller_fact'],
    [solve, 'other_operation', 'fact_dots'], [solve, 'one_over', 'fact_dots'], [solve, 'over_by_more', 'fact_dots'],
    [missing, 'printed_number', 'part_whole'], [missing, 'short_by_more', 'part_whole'],
    [match, 'one_short', 'count_marks'], [match, 'over_by_more', 'count_marks'],
    // Already +1: no smaller fact, so counting the picture answers a far miscount.
    [fact('visual-fact', 3, '+', 1, 'result', { visualType: 'dot-array', options: options(4) }), 'over_by_more', 'count_marks'],
    // Fingers pictures (the J12 gaps of 2026-10-09): the dots go under the hands.
    [fact('visual-fact', 1, '+', 2, 'result', { visualType: 'fingers', options: [1, 3, 4, 5] }), 'other_operation', 'two_parts'],
    [fact('match', 3, '+', 3, 'result', { matchDirection: 'visual-to-equation', visualType: 'fingers' }), 'one_short', 'count_marks'],
  ])('%#: %s', (c, miss, want) => {
    expect(nextLever(mathFactLevers(c, [], 10), miss)).toBe(want);
  });

  it('with the help pulled, the ladder\'s simplify rung opens the easier fact', () => {
    expect(nextLever(mathFactLevers(solve, ['fact_dots'], 10), 'one_over', 'simplify')).toBe('smaller_fact');
    expect(nextLever(mathFactLevers(match, ['count_marks'], 10), 'one_short', 'simplify')).toBe('far_match');
  });
});

describe('leak rules', () => {
  const all = [
    fact('visual-fact', 3, '+', 2, 'result', { visualType: 'dot-array', options: options(5) }),
    fact('match', 4, '+', 4, 'result', { matchDirection: 'visual-to-equation', visualType: 'dot-array' }),
    fact('match', 4, '+', 4, 'result', { matchDirection: 'equation-to-visual' }),
    fact('equation-solve', 6, '-', 2, 'result', { options: options(4) }),
    fact('missing-number', 7, '-', 4, 'operand1'),
    fact('visual-fact', 1, '+', 2, 'result', { visualType: 'fingers', options: [1, 3, 4, 5] }),
    fact('match', 3, '+', 3, 'result', { matchDirection: 'visual-to-equation', visualType: 'fingers' }),
  ];
  it.each(all.map(c => [c.type, c] as const))('%s: no lever text and no scene fact carries a number', (_t, c) => {
    const levers = mathFactLevers(c, [], 10);
    const facts = leverFacts(c, levers.map(l => l.id));
    expect(facts.length).toBeGreaterThan(0);
    expect(`${facts} ${levers.map(l => `${l.when} ${l.does}`).join(' ')}`).not.toMatch(/\d/);
  });

  it('a picture-to-equation match never offers a lever that splits the picture into the fact\'s parts', () => {
    const c = all[1];
    expect(mathFactLevers(c, [], 10).map(l => l.id)).not.toContain('two_parts');
    expect(mathFactLevers(c, [], 10).map(l => l.id)).not.toContain('fact_dots');
    expect(leverFacts(c, ['two_parts', 'fact_dots'])).toBe('');
  });

  it('the model draws only the printed numbers: a sum\'s parts, the whole of a take-away, never a dot group for the "?" of a sum', () => {
    for (const c of all) {
      const segs = factModel(c);
      const drawn = segs.reduce((n, s) => n + s.count, 0);
      const whole = c.operation === 'addition' ? c.result : c.operand1;
      expect(drawn).toBe(whole);
      if (c.unknownPosition === 'result') expect(segs.some(s => s.tone === 'empty')).toBe(false);
    }
  });
});

describe('starting positions', () => {
  it('easy starts the mode\'s first help lever; medium, hard and speed_round start none', () => {
    expect(startLevers(fact('equation-solve', 3, '+', 2, 'result', { supportTier: 'easy' }))).toEqual(['fact_dots']);
    expect(startLevers(fact('visual-fact', 3, '+', 2, 'result', { supportTier: 'easy', visualType: 'ten-frame' }))).toEqual(['two_parts']);
    expect(startLevers(fact('equation-solve', 3, '+', 2, 'result', { supportTier: 'medium' }))).toEqual([]);
    expect(startLevers(fact('speed-round', 3, '+', 2, 'result', { supportTier: 'easy' }))).toEqual([]);
  });
});

/** The checks every simpler item must pass against its source (R2 mode floor, R3 never the learner's item). */
function expectSimpler(c: C, s: C, maxNumber: number) {
  expect(s.id).toBe(`${c.id}~simpler`);
  expect(s.type).toBe(c.type);
  expect(s.operation).toBe(c.operation);
  if (c.type !== 'match') expect(s.unknownPosition).toBe(c.unknownPosition);
  expect(s.result).toBe(s.operation === 'addition' ? s.operand1 + s.operand2 : s.operand1 - s.operand2);
  expect(s.result).toBeGreaterThanOrEqual(0);
  expect(Math.max(s.operand1, s.result)).toBeLessThanOrEqual(maxNumber);
  expect(s.operand1 === c.operand1 && s.operand2 === c.operand2).toBe(false);
  expect(s.correctAnswer).not.toBe(c.correctAnswer);
  expect(mathFactMatches(s, { kind: 'number', value: s.correctAnswer })).toBe(true);
  if (s.options) expect(s.options.filter(o => o === s.correctAnswer)).toHaveLength(1);
  if (c.type === 'visual-fact') expect(s.visualCount).toBe(s.correctAnswer);
  if (c.type === 'missing-number') expect(s.options).toBeUndefined();
  if (s.equationOptions) {
    expect(s.equationOptions).toHaveLength(2);
    expect(s.equationOptions.filter(e => equationResult(e) === s.correctAnswer)).toHaveLength(1);
    const [x, y] = s.equationOptions.map(equationResult);
    expect(Math.abs(x - y)).toBeGreaterThanOrEqual(3);
  }
  if (s.visualOptions) {
    expect(s.visualOptions).toHaveLength(2);
    expect(s.visualOptions.filter(v => v.count === s.correctAnswer)).toHaveLength(1);
    expect(Math.abs(s.visualOptions[0].count - s.visualOptions[1].count)).toBeGreaterThanOrEqual(3);
  }
  if (c.type !== 'match') expect(smallerFact(s, maxNumber)).toBeNull();
}

describe('simplify builders', () => {
  it('over every fact within 5, 10 and 20, every form: same mode, simpler, solvable, never the learner\'s fact', () => {
    let built = 0;
    for (const maxNumber of [5, 10, 20]) {
      for (let a = 0; a <= maxNumber; a++) for (let b = 0; b <= maxNumber; b++) for (const op of ['+', '-'] as const) {
        if (op === '+' ? a + b > maxNumber : a < b) continue;
        for (const unknown of ['result', 'operand1', 'operand2'] as const) {
          const answer = unknown === 'operand1' ? a : unknown === 'operand2' ? b : op === '+' ? a + b : a - b;
          const items: C[] = unknown === 'result' ? [
            fact('visual-fact', a, op, b, unknown, { visualType: 'dot-array', options: options(answer) }),
            fact('equation-solve', a, op, b, unknown, { options: options(answer) }),
            fact('match', a, op, b, unknown, { matchDirection: 'visual-to-equation', visualType: 'dot-array' }),
            fact('match', a, op, b, unknown, { matchDirection: 'equation-to-visual', visualOptions: [{ type: 'dot-array', count: answer }] }),
          ] : [fact('missing-number', a, op, b, unknown)];
          for (const c of items) {
            const s = simplerItem(c, maxNumber);
            if (!s) continue;
            built++;
            expectSimpler(c, s, maxNumber);
          }
        }
      }
    }
    expect(built).toBeGreaterThan(1000);
  });

  it('declines when the fact is already one step from the simplest', () => {
    expect(smallerFact(fact('equation-solve', 4, '+', 1, 'result', { options: options(5) }), 10)).toBeNull();
    expect(smallerFact(fact('missing-number', 4, '+', 2, 'operand2'), 10)).toBeNull();
    expect(smallerFact(fact('speed-round', 4, '+', 3), 10)).toBeNull();
    expect(farMatch(fact('equation-solve', 4, '+', 3), 10)).toBeNull();
  });
});

describe('saved payloads', () => {
  const dir = join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads');
  const modes = ['visual_fact', 'match', 'equation_solve', 'missing_number', 'speed_round'];
  it.each(modes)('%s: every challenge\'s levers, leak rules and simpler item', mode => {
    const raw = JSON.parse(readFileSync(join(dir, `math-fact-fluency.${mode}.json`), 'utf8'));
    const data = raw.data ?? raw;
    for (const c of data.challenges as C[]) {
      const levers = mathFactLevers(c, [], data.maxNumber);
      if (mode === 'speed_round') { expect(levers).toEqual([]); continue; }
      expect(levers.some(l => l.kind === 'help')).toBe(true);
      // Per item (J12): every wrong choice's miss is answered by a lever on THIS item.
      const wrong: MathFactResponse[] = c.type === 'match'
        ? (c.equationOptions ?? []).map(value => ({ kind: 'equation' as const, value }))
        : (c.options?.length ? c.options : [c.correctAnswer - 1, c.correctAnswer + 1, c.correctAnswer + 3].filter(v => v >= 0))
          .map(value => ({ kind: 'number' as const, value }));
      for (const r of wrong) {
        const miss = mathFactMiss(c, r);
        if (miss) expect(levers.some(l => l.answers?.includes(miss)), `${c.id} ${miss}`).toBe(true);
      }
      expect(leverFacts(c, levers.map(l => l.id))).not.toMatch(/\d/);
      const s = simplerItem(c, data.maxNumber);
      if (s) expectSimpler(c, s, data.maxNumber);
    }
  });
});
