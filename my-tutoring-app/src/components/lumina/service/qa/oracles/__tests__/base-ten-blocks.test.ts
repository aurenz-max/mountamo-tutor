import { describe, expect, it } from 'vitest';
import { baseTenBlocksOracle } from '../base-ten-blocks';

/**
 * Seeded-violation tests for the base-ten-blocks oracle. Two clean fixtures
 * (trimmed from real /api/lumina/eval-test generations — one operate session,
 * one read_blocks session) plus one mutated fixture per implemented check class
 * that MUST fire. Mirrors the array-grid / comparison-builder blocks.
 */

// operate: "within 1000" → ceiling 1000; every operate magnitude (max minuend 721,
// max sum 935) stays in scope for the clean case.
const opCtx = { componentId: 'base-ten-blocks', evalMode: 'operate', topic: 'Addition and subtraction within 1000', gradeLevel: 'grade 3' };
// Tighter ceiling to prove the scope check bites (632, 843, 935 exceed 500).
const opScopeCtx = { ...opCtx, topic: 'Addition and subtraction within 500' };
// read_blocks: "to 100" → ceiling 100.
const readCtx = { componentId: 'base-ten-blocks', evalMode: 'read_blocks', topic: 'Place value to 100', gradeLevel: 'grade 2' };

// Trimmed straight from a real generation (operate, grade 4-5). Every instruction
// names the two operands; targetNumber is the sum/difference.
const operateClean = {
  title: 'Mastering Regrouping with Base-Ten Blocks',
  description: 'Add and subtract multi-digit numbers with blocks.',
  numberValue: 450,
  interactionMode: 'operate',
  decimalMode: false,
  maxPlace: 'thousands',
  supplyTray: true,
  gradeBand: '4-5',
  challenges: [
    { type: 'add_with_blocks', targetNumber: 632, secondNumber: 285, instruction: 'Add 347 + 285 using blocks. Remember to regroup ten ones into one ten.', hint: 'Start with the ones.' },
    { type: 'subtract_with_blocks', targetNumber: 332, secondNumber: 168, instruction: 'Subtract 168 from 500 using blocks. You will need to borrow.', hint: 'Can you borrow?' },
    { type: 'add_with_blocks', targetNumber: 843, secondNumber: 378, instruction: 'Add 465 + 378 using blocks. Carefully regroup both tens and hundreds.', hint: 'Regroup carefully.' },
    { type: 'subtract_with_blocks', targetNumber: 427, secondNumber: 294, instruction: 'Subtract 294 from 721 using blocks.', hint: 'Start with the ones.' },
    { type: 'add_with_blocks', targetNumber: 935, secondNumber: 346, instruction: 'Add 589 + 346 using blocks.', hint: 'Regroup as needed.' },
  ],
};

// Trimmed from a real generation (read_blocks, grade 2-3). Bare targetNumber,
// generic instruction — the desync surface is intentionally absent here.
const readClean = {
  title: 'Mastering Numbers: Exploring Place Value',
  description: 'Read the number shown by the blocks.',
  numberValue: 42,
  interactionMode: 'decompose',
  decimalMode: false,
  maxPlace: 'tens',
  supplyTray: true,
  gradeBand: '2-3',
  challenges: [
    { type: 'read_blocks', targetNumber: 14, instruction: 'Look at the blocks shown above. What number do they represent?', hint: 'Count each place.' },
    { type: 'read_blocks', targetNumber: 37, instruction: 'What number is shown by these blocks?', hint: 'Count each place.' },
    { type: 'read_blocks', targetNumber: 60, instruction: 'Observe the blocks carefully. What is the total number?', hint: 'Count each place.' },
    { type: 'read_blocks', targetNumber: 83, instruction: 'Look at the blocks shown. What number do they represent?', hint: 'Count each place.' },
    { type: 'read_blocks', targetNumber: 95, instruction: 'What is the total value of the blocks displayed here?', hint: 'Count each place.' },
  ],
};

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('base-ten-blocks oracle', () => {
  it('passes a clean operate session (instruction operands reconcile with targetNumber)', () => {
    const r = baseTenBlocksOracle.verify(operateClean, opCtx);
    expect(r.violations).toEqual([]);
    expect(r.uncheckedTypes).toEqual([]);
  });

  it('passes a clean read_blocks session (bare target, generic instruction)', () => {
    const r = baseTenBlocksOracle.verify(readClean, readCtx);
    expect(r.violations).toEqual([]);
    expect(r.uncheckedTypes).toEqual([]);
  });

  it('flags answer-key desync — instruction operands do not sum to targetNumber', () => {
    const data = clone(operateClean);
    data.challenges[2].targetNumber = 841; // 465 + 378 = 843, not 841
    const v = baseTenBlocksOracle.verify(data, opCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'add_with_blocks-2')).toBe(true);
  });

  it('flags answer-key desync — a non-positive target has no reachable correct state', () => {
    const data = clone(readClean);
    data.challenges[1].targetNumber = 0;
    const v = baseTenBlocksOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'answer-key-desync' && x.where === 'read_blocks-1')).toBe(true);
  });

  it('flags scope violation — operate magnitudes exceed the topic ceiling', () => {
    const v = baseTenBlocksOracle.verify(operateClean, opScopeCtx).violations;
    expect(v.some((x) => x.check === 'scope' && x.where === 'add_with_blocks-0')).toBe(true);
  });

  it('flags clustering — every target is the same value', () => {
    const data = clone(readClean);
    data.challenges = data.challenges.map((c, i) => ({ ...c, targetNumber: 42, instruction: `read ${i}` }));
    const v = baseTenBlocksOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'clustering')).toBe(true);
  });

  it('flags clustering — an exact-duplicate operate card', () => {
    const data = clone(operateClean);
    data.challenges.push(clone(operateClean.challenges[0])); // dup of add_with_blocks-0
    const v = baseTenBlocksOracle.verify(data, opCtx).violations;
    expect(v.some((x) => x.check === 'clustering' && /identical/.test(x.detail))).toBe(true);
  });

  it('flags schema — a demo-sized set (mastery-over-demo)', () => {
    const data = clone(readClean);
    data.challenges = [data.challenges[0]];
    const v = baseTenBlocksOracle.verify(data, readCtx).violations;
    expect(v.some((x) => x.check === 'schema')).toBe(true);
  });

  it('flags schema — an operate challenge missing secondNumber', () => {
    const data = clone(operateClean);
    delete (data.challenges[0] as { secondNumber?: number }).secondNumber;
    const v = baseTenBlocksOracle.verify(data, opCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'add_with_blocks-0')).toBe(true);
  });

  it('flags schema — secondNumber not among the named operands (instruction desync)', () => {
    const data = clone(operateClean);
    data.challenges[0].secondNumber = 999; // instruction names 347 + 285
    const v = baseTenBlocksOracle.verify(data, opCtx).violations;
    expect(v.some((x) => x.check === 'schema' && x.where === 'add_with_blocks-0' && /secondNumber/.test(x.detail))).toBe(true);
  });
});
