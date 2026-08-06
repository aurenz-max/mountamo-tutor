/**
 * BT-5 — build_number instruction integrity.
 *
 * build_number is answered by placing blocks (BaseTenBlocks.checkBlocks), and only
 * a STANDARD-form build counts. That puts two loads on the instruction text which
 * the old typed-answer flow never exposed:
 *   (a) it must NOT spell out the decomposition — that is the answer;
 *   (b) it must name the FINAL target, after the structural tier re-selects it.
 *
 * Both are pure post-process, so they are pinned here without calling Gemini.
 */
import { describe, expect, it } from 'vitest';
import { normalizeBuildNumberInstructions } from './gemini-base-ten-blocks';
import type { BaseTenBlocksChallenge } from '../../primitives/visual-primitives/math/BaseTenBlocks';

const build = (instruction: string, targetNumber: number, hint = 'Think about place value.'): BaseTenBlocksChallenge =>
  ({ type: 'build_number', instruction, targetNumber, hint });

describe('leak: the instruction must not decompose the target for the student', () => {
  it('rewrites the ten-rod / unit-cube phrasing seen in the wild', () => {
    const cs = [build('Build the number 12 by placing one ten-rod and the correct number of unit cubes.', 12)];
    expect(normalizeBuildNumberInstructions(cs)).toBe(1);
    expect(cs[0].instruction).toBe('Build the number 12 with blocks.');
    expect(cs[0].instruction).not.toMatch(/ten-rod|unit cube/i);
  });

  it('rewrites an explicit digit-by-place enumeration', () => {
    const cs = [build('Build 245 using 2 hundreds, 4 tens, and 5 ones.', 245)];
    expect(normalizeBuildNumberInstructions(cs)).toBe(1);
    expect(cs[0].instruction).toMatch(/^Build the number 245 with blocks\.$/);
  });

  it('leaves a bare instruction alone', () => {
    const cs = [build('Build the number 247 with blocks!', 247, 'Start with the hundreds.')];
    expect(normalizeBuildNumberInstructions(cs)).toBe(0);
    expect(cs[0].instruction).toBe('Build the number 247 with blocks!');
    expect(cs[0].hint).toBe('Start with the hundreds.');
  });
});

describe('desync: the instruction must name the target the blocks are graded against', () => {
  it('re-emits the instruction when the structural tier re-selected the target', () => {
    // buildZeroGapNumber replaced 247 with 205 and never touched the text.
    const cs = [build('Build the number 247 with blocks.', 205, '247 has 2 hundreds, 4 tens and 7 ones.')];
    expect(normalizeBuildNumberInstructions(cs)).toBe(1);
    expect(cs[0].instruction).toContain('205');
    expect(cs[0].instruction).not.toContain('247');
    // The stale hint named the old target — it would have contradicted the grader.
    expect(cs[0].hint).not.toContain('247');
    expect(cs[0].hint).toContain('205');
  });

  it('does not mistake a substring for the target', () => {
    const cs = [build('Build the number 45 with blocks.', 145)];
    expect(normalizeBuildNumberInstructions(cs)).toBe(1);
    expect(cs[0].instruction).toBe('Build the number 145 with blocks.');
  });
});

describe('scope', () => {
  it('leaves other challenge types untouched — regroup names its stimulus by design', () => {
    const cs: BaseTenBlocksChallenge[] = [
      { type: 'regroup', instruction: 'You have 1 hundred, 2 tens, and 5 ones. Trade 1 ten for 10 ones.', targetNumber: 125, hint: '1 ten = 10 ones.' },
      { type: 'read_blocks', instruction: 'What number do these blocks show?', targetNumber: 305, hint: 'Check every column.' },
      { type: 'add_with_blocks', instruction: 'Add 234 + 158 using blocks.', targetNumber: 392, secondNumber: 158, hint: 'Start with the ones.' },
    ];
    const before = cs.map(c => c.instruction);
    expect(normalizeBuildNumberInstructions(cs)).toBe(0);
    expect(cs.map(c => c.instruction)).toEqual(before);
  });

  it('varies phrasing across a multi-card deck', () => {
    const cs = [
      build('Place 1 ten and 2 ones.', 12),
      build('Place 2 tens and 3 ones.', 23),
      build('Place 3 tens and 4 ones.', 34),
    ];
    expect(normalizeBuildNumberInstructions(cs)).toBe(3);
    expect(new Set(cs.map(c => c.instruction)).size).toBe(3);
  });
});
