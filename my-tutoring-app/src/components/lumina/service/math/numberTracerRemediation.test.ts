import { expect, it } from 'vitest';
import type { NumberTracerChallenge } from '../../primitives/visual-primitives/math/NumberTracer';
import {
  compiledGapPositionContrast, eligibleNumberTracerTeaching, numberTracerDeliveryEligible, selectGapPositionContrast,
} from './numberTracerRemediation';

const item = (id: string, start: number, missingIndex: number, patch: Partial<NumberTracerChallenge> = {}): NumberTracerChallenge => {
  const sequenceNumbers = [0, 1, 2, 3].map(k => start + k);
  return { id, type: 'sequence', digit: sequenceNumbers[missingIndex], instruction: "What's the missing number? Fill in the blank!", strokePaths: [],
    showModel: false, showArrows: false, hint: 'Count up by ones — each number is one more than the last.', sequenceNumbers, missingIndex,
    showGhostDigit: false, showStrokeArrows: false, showStartDot: false, supportTier: 'medium', ...patch };
};
const baseline = [item('c1', 0, 1), item('c2', 3, 2), item('c3', 5, 1), item('c4', 1, 2), item('c5', 6, 1)]; // answers 1, 5, 6, 3, 7

it('gates: sequence only, Kindergarten and Grade 1 only', () => {
  expect(eligibleNumberTracerTeaching({ grade: 'K', mode: 'sequence' })).toBe(true);
  expect(eligibleNumberTracerTeaching({ grade: '1', mode: 'sequence' })).toBe(true);
  for (const task of [{ grade: '2', mode: 'sequence' }, { grade: 'K', mode: 'write' }, { grade: 'K', mode: 'trace' }, { grade: 'K' }, { mode: 'sequence' }]) {
    expect(eligibleNumberTracerTeaching(task)).toBe(false);
  }
  expect(numberTracerDeliveryEligible({ targetEvalMode: 'sequence' })).toBe(true);
  for (const mode of ['trace', 'copy', 'write', undefined]) expect(numberTracerDeliveryEligible({ targetEvalMode: mode })).toBe(false);
});

it('compiled recheck reads the rendered runs: one run on neighbours with the gap moved', () => {
  expect(compiledGapPositionContrast([item('a', 3, 1), item('b', 3, 2)])).toEqual({ targets: ['a', 'b'], count: 2 });
  expect(compiledGapPositionContrast([item('a', 3, 2), item('b', 3, 1)]).count).toBe(2);
  // Same run but not neighbours, same gap twice, different runs, a desynced answer, or a handwriting item: no contrast.
  expect(compiledGapPositionContrast([item('a', 3, 1), item('x', 6, 1), item('b', 3, 2)]).count).toBe(0);
  expect(compiledGapPositionContrast([item('a', 3, 1), item('b', 3, 1)]).count).toBe(0);
  expect(compiledGapPositionContrast([item('a', 3, 1), item('b', 4, 2)]).count).toBe(0);
  expect(compiledGapPositionContrast([item('a', 3, 1), item('b', 3, 2, { digit: 4 })]).count).toBe(0);
  expect(compiledGapPositionContrast([item('a', 3, 1), { ...item('b', 3, 2), type: 'write' }]).count).toBe(0);
  expect(compiledGapPositionContrast(baseline).count).toBe(0);
});

it('selector rewrites one item after a later anchor; count, ids, flags, window and distinct answers hold', () => {
  for (let r = 0; r < 1; r += 0.05) {
    const selected = selectGapPositionContrast(baseline, 'contrast_gap_positions_in_one_run', () => r);
    expect(selected.status).toBe('targeted');
    expect(selected.count).toBe(2);
    expect(selected.challenges.map(c => c.id)).toEqual(baseline.map(c => c.id));
    const changed = selected.challenges.map((c, i) => (c === baseline[i] ? -1 : i)).filter(i => i >= 0);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toBeGreaterThanOrEqual(2); // anchor > 0: the session opens on an ordinary item
    const c = selected.challenges[changed[0]];
    expect({ ...c, sequenceNumbers: 0, missingIndex: 0, digit: 0 }).toEqual({ ...baseline[changed[0]], sequenceNumbers: 0, missingIndex: 0, digit: 0 });
    expect(c.digit).toBe(c.sequenceNumbers![c.missingIndex!]);
    expect(new Set(selected.challenges.map(x => x.digit)).size).toBe(5);
    expect(selected.challenges.flatMap(x => x.sequenceNumbers!).every(n => n >= 0 && n <= 9)).toBe(true);
    expect(compiledGapPositionContrast(selected.challenges).targets).toEqual([selected.challenges[changed[0] - 1].id, c.id]);
  }
});

it('reports already-targeted, no-focus and capacity misses without changing the baseline', () => {
  const present = [item('c1', 0, 1), item('c2', 3, 1), item('c3', 3, 2)];
  expect(selectGapPositionContrast(present, 'contrast_gap_positions_in_one_run')).toMatchObject({ status: 'already-targeted', challenges: present, count: 2 });
  expect(selectGapPositionContrast(baseline, null)).toMatchObject({ status: 'no-focus', challenges: baseline, count: 0 });
  // Answers 2, 3, 1: moving either gap would duplicate an answer (0, ?, 2, 3 → 1 is taken; 1, ?, 3, 4 → 2 is taken).
  const blocked = [item('c1', 0, 2), item('c2', 1, 2), item('c3', 0, 1)];
  expect(selectGapPositionContrast(blocked, 'contrast_gap_positions_in_one_run')).toMatchObject({ status: 'insufficient-capacity', challenges: blocked });
  // A window too narrow for distinct answers (1-5: answers 2, 3, 4 only) already repeats; the rewrite only avoids its neighbour's answer.
  const narrow = [item('c1', 1, 1), item('c2', 2, 2), item('c3', 1, 2), item('c4', 2, 2), item('c5', 1, 1)]; // 2, 4, 3, 4, 2
  const widened = selectGapPositionContrast(narrow, 'contrast_gap_positions_in_one_run', () => 0);
  expect(widened.status).toBe('targeted');
  expect(widened.challenges.map(c => c.digit).every((d, i, a) => i === 0 || d !== a[i - 1])).toBe(true);
  for (const one of [[item('c1', 0, 1)], [{ ...item('c1', 0, 1), sequenceNumbers: [0, 1, 2], missingIndex: 1 }, item('c2', 4, 1)]]) {
    expect(selectGapPositionContrast(one, 'contrast_gap_positions_in_one_run')).toMatchObject({ status: 'insufficient-capacity', challenges: one });
  }
});
