import { describe, expect, it } from 'vitest';
import { regroupingWorkbenchOracle } from '../regrouping-workbench';

/**
 * Seeded-violation tests for the regrouping-workbench oracle. Clean fixtures per
 * operation (trimmed/extended from real /api/lumina/eval-test generations) plus
 * one mutated fixture per implemented check class that MUST fire. Mirrors the
 * comparison-builder / array-grid blocks.
 */

// Scope-bearing topic → ceiling 100; the clean generations stay ≤100.
const addCtx = { componentId: 'regrouping-workbench', evalMode: 'add_regroup', topic: 'Addition with regrouping to 100', gradeLevel: 'grade 2' };
const subCtx = { componentId: 'regrouping-workbench', evalMode: 'subtract_regroup', topic: 'Subtraction with regrouping to 100', gradeLevel: 'grade 2' };

// ── addition-with-regrouping — extended from a real grade-2 generation ──
const addClean = {
  title: 'Adding With Trades',
  operation: 'addition',
  operand1: 27,
  operand2: 45,
  maxPlace: 'tens',
  gradeBand: '1-2',
  challenges: [
    { id: 'ch1', problem: '27 + 45', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'ch2', problem: '38 + 24', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'ch3', problem: '19 + 36', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'ch4', problem: '46 + 29', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'ch5', problem: '33 + 48', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
  ],
};

// ── subtraction-with-regrouping — extended from a real grade-2 generation ──
const subClean = {
  title: 'Subtracting With Trades',
  operation: 'subtraction',
  operand1: 92,
  operand2: 35,
  maxPlace: 'tens',
  gradeBand: '1-2',
  challenges: [
    { id: 'sub-1', problem: '52 - 17', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'sub-2', problem: '71 - 24', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'sub-3', problem: '83 - 56', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'sub-4', problem: '64 - 28', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
    { id: 'sub-5', problem: '90 - 45', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
  ],
};

// A clean no-regroup fixture for the *_no_regroup structural tier.
const addNoRegroupClean = {
  ...addClean,
  challenges: [
    { id: 'a', problem: '21 + 34', requiresRegrouping: false, regroupCount: 0, hint: '', narration: '' },
    { id: 'b', problem: '52 + 16', requiresRegrouping: false, regroupCount: 0, hint: '', narration: '' },
    { id: 'c', problem: '43 + 15', requiresRegrouping: false, regroupCount: 0, hint: '', narration: '' },
  ],
};
const addNoRegroupCtx = { ...addCtx, evalMode: 'add_no_regroup' };

describe('regrouping-workbench oracle', () => {
  it('passes clean addition-with-regrouping', () => {
    expect(regroupingWorkbenchOracle.verify(addClean, addCtx).violations).toEqual([]);
  });
  it('passes clean subtraction-with-regrouping', () => {
    expect(regroupingWorkbenchOracle.verify(subClean, subCtx).violations).toEqual([]);
  });
  it('passes clean no-regroup content in a *_no_regroup mode', () => {
    expect(regroupingWorkbenchOracle.verify(addNoRegroupClean, addNoRegroupCtx).violations).toEqual([]);
  });

  it('flags answer-key-desync — problem operator contradicts the session operation', () => {
    const data = { ...addClean, challenges: addClean.challenges.map((c) => c.id === 'ch1' ? { ...c, problem: '27 - 45' } : c) };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'ch1')).toBe(true);
  });

  it('flags answer-key-desync — requiresRegrouping/regroupCount mislabels the arithmetic', () => {
    const data = { ...addClean, challenges: addClean.challenges.map((c) => c.id === 'ch3' ? { ...c, requiresRegrouping: false, regroupCount: 0 } : c) };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'ch3')).toBe(true);
  });

  it('flags answer-key-desync — subtraction below zero is an unreachable answer', () => {
    const data = { ...subClean, challenges: [{ id: 'neg', problem: '17 - 52', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' }, ...subClean.challenges] };
    const v = regroupingWorkbenchOracle.verify(data, subCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'neg')).toBe(true);
  });

  it('flags answer-key-desync — a regroup problem in a *_no_regroup mode', () => {
    // addClean is all carries; running it under add_no_regroup violates the tier.
    const v = regroupingWorkbenchOracle.verify(addClean, addNoRegroupCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && /forbids regrouping/.test(x.detail))).toBe(true);
  });

  it('flags scope — a sum exceeds a "to 50" ceiling', () => {
    const v = regroupingWorkbenchOracle.verify(addClean, { ...addCtx, topic: 'Addition with regrouping to 50' }).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'ch5')).toBe(true); // 33+48=81 > 50
  });

  it('flags clustering — every sum is 62', () => {
    const data = {
      ...addClean,
      challenges: [
        { id: 'a', problem: '27 + 35', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
        { id: 'b', problem: '38 + 24', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
        { id: 'c', problem: '44 + 18', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
        { id: 'd', problem: '29 + 33', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
      ],
    };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate problem card', () => {
    const data = {
      ...addClean,
      challenges: [
        { id: 'a', problem: '27 + 45', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
        { id: 'b', problem: '27 + 45', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' }, // dup 27+45
        { id: 'c', problem: '38 + 24', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
        { id: 'd', problem: '19 + 36', requiresRegrouping: true, regroupCount: 1, hint: '', narration: '' },
      ],
    };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags schema — a problem that does not parse as "a op b"', () => {
    const data = { ...addClean, challenges: addClean.challenges.map((c) => c.id === 'ch1' ? { ...c, problem: '27 plus 45' } : c) };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'ch1')).toBe(true);
  });

  it('flags schema — non-boolean requiresRegrouping', () => {
    const data = { ...addClean, challenges: addClean.challenges.map((c) => c.id === 'ch2' ? { ...c, requiresRegrouping: 'yes' } : c) };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'ch2')).toBe(true);
  });

  it('flags a demo-sized set (mastery-over-demo)', () => {
    const data = { ...addClean, challenges: [addClean.challenges[0]] };
    const v = regroupingWorkbenchOracle.verify(data, addCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'challenges')).toBe(true);
  });
});
