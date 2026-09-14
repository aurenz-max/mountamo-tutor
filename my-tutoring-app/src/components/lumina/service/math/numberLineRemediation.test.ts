import { describe, expect, it } from 'vitest';
import {
  compiledStartContrast, eligibleNumberLineTeaching, numberLineDeliveryEligible, selectStartContrast, type JumpTuple,
} from './numberLineRemediation';

const K2_SIZES = [1, 2, 3, 4, 5];
const range = { min: 0, max: 20 };
const jump = (startValue: number, opType: 'add' | 'subtract', change: number): JumpTuple =>
  ({ startValue, opType, change, targetValue: opType === 'add' ? startValue + change : startValue - change });
const baseline = [jump(8, 'add', 3), jump(15, 'subtract', 4), jump(11, 'add', 5), jump(6, 'subtract', 2)];
const landing = (t: JumpTuple) => (t.opType === 'add' ? t.startValue + t.change : t.startValue - t.change);

describe('selectStartContrast', () => {
  it('replaces one challenge with the zero-anchored twin of its neighbour and keeps everything else', () => {
    expect(compiledStartContrast(baseline).count).toBe(0);
    const selected = selectStartContrast(baseline, 'contrast_start_positions', range, K2_SIZES);
    expect(selected.status).toBe('targeted');
    expect(selected.tuples).toHaveLength(baseline.length);
    const changed = selected.tuples.map((t, i) => (t === baseline[i] ? -1 : i)).filter(i => i >= 0);
    expect(changed).toEqual([0]);
    // Slot 0 becomes 4 − 4 = 0, paired with its neighbour 15 − 4: same hop and direction.
    expect(selected.tuples[0]).toEqual(jump(4, 'subtract', 4));
    expect(selected.targets).toEqual([0, 1]);
    const [a, b] = selected.targets.map(i => selected.tuples[i]);
    expect([a.opType, a.change]).toEqual([b.opType, b.change]);
    for (const t of selected.tuples) {
      expect(landing(t)).toBe(t.targetValue);
      expect(K2_SIZES).toContain(t.change);
      expect(t.targetValue).toBeGreaterThanOrEqual(range.min);
      expect(t.targetValue).toBeLessThanOrEqual(range.max);
    }
    expect(new Set(selected.tuples.map(t => `${t.startValue}|${t.opType}|${t.change}`)).size).toBe(baseline.length);
  });

  it('anchors an addition at a zero start and a subtraction at a zero landing', () => {
    const adds = [jump(9, 'add', 2), jump(12, 'add', 4)];
    expect(selectStartContrast(adds, 'contrast_start_positions', range, K2_SIZES).tuples[0]).toEqual(jump(0, 'add', 4));
  });

  it('leaves the baseline untouched with no move, when already targeted, or without capacity', () => {
    expect(selectStartContrast(baseline, null, range, K2_SIZES)).toMatchObject({ status: 'no-focus', tuples: baseline, count: 0 });
    const already = [jump(0, 'add', 3), ...baseline.slice(1), jump(7, 'add', 3)];
    expect(selectStartContrast(already, 'contrast_start_positions', range, K2_SIZES)).toMatchObject({ status: 'already-targeted', tuples: already, count: 2 });
    // Zero is outside the lesson's range: no legal anchor, and nothing is fabricated.
    const teen = { min: 10, max: 20 };
    const teens = [jump(12, 'add', 3), jump(18, 'subtract', 4), jump(14, 'add', 5), jump(16, 'subtract', 2)];
    expect(selectStartContrast(teens, 'contrast_start_positions', teen, K2_SIZES)).toMatchObject({ status: 'insufficient-capacity', tuples: teens, count: 0 });
  });

  it('does not borrow a hop size the band table forbids', () => {
    const wide = [jump(3, 'add', 7), jump(13, 'subtract', 7)];
    expect(selectStartContrast(wide, 'contrast_start_positions', { min: 0, max: 30 }, K2_SIZES).status).toBe('insufficient-capacity');
  });
});

describe('task eligibility and delivery scope (content constraints only)', () => {
  const task = { grade: '1', mode: 'jump', tier: 'medium', topic: 'Add within 20 by counting on' };
  it('gates grade, mode, tier and named numeric anchors, not ranges', () => {
    expect(eligibleNumberLineTeaching(task)).toBe(true);
    expect(eligibleNumberLineTeaching({ ...task, topic: 'Numbers 0-20 on a number line' })).toBe(true);
    for (const patch of [{ grade: '3' }, { grade: 'K' }, { mode: 'plot' }, { tier: 'hard' }, { tier: 'easy' }, { tier: undefined },
      { topic: 'Solve 8 + 3 on a number line' }, { topic: 'Count back 15 - 3' }, { topic: 'Count on from 8' }])
      expect(eligibleNumberLineTeaching({ ...task, ...patch })).toBe(false);
  });
  it('requests observations only for the reviewed Grade 1 jump objectives at medium', () => {
    const config = { objectiveGrade: '1', skillId: 'OPS001-03', subskillId: 'OPS001-03-a', targetEvalMode: 'jump', difficulty: 'medium' };
    expect(numberLineDeliveryEligible(config)).toBe(true);
    expect(numberLineDeliveryEligible({ ...config, skillId: 'OPS001-04', subskillId: 'OPS001-04-a' })).toBe(true);
    for (const patch of [{ subskillId: 'NBT001-07-b' }, { objectiveGrade: '2' }, { targetEvalMode: 'plot' }, { difficulty: 'hard' }, { skillId: undefined }])
      expect(numberLineDeliveryEligible({ ...config, ...patch })).toBe(false);
  });
});
