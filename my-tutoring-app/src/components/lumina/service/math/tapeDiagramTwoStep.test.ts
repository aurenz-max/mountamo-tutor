import { describe, expect, it } from 'vitest';
import {
  answerOf, compareWordOf, compareWordsFit, settingFits, fallbackWords, lessonStepPattern, opsFitPattern, otherOf, plainCompareStory,
  rollTwoStepCompare, swappedBar, totalOf, twoStepCompareBars, type CompareShape,
} from './tapeDiagramTwoStep';
import { rollChain } from './gemini-tape-diagram';

const G2 = { min: 1, max: 100 };
const SHAPES: CompareShape[] = ['consistent', 'difference', 'inconsistent'];
const words = { personA: 'Tia', personB: 'Sam', thing: 'beads', part1: 'red beads', part2: 'blue beads' };

describe('lesson step pattern', () => {
  it('reads "only addition" as add-add and leaves other lessons mixed', () => {
    expect(lessonStepPattern('Model and solve two-step word problems involving only addition by using tape diagrams.')).toBe('add');
    expect(lessonStepPattern('Solve two-step compare problems with an unknown quantity')).toBe('mixed');
    expect(lessonStepPattern('two-step problems, subtraction only')).toBe('subtract');
    expect(opsFitPattern(['+', '+'], 'add')).toBe(true);
    expect(opsFitPattern(['+', '-'], 'add')).toBe(false);
    expect(opsFitPattern(['+', '+'], 'mixed')).toBe(false);
  });

  it('an add-only chain adds at every step and stays within 100', () => {
    for (let i = 0; i < 300; i++) {
      const { start, chain } = rollChain(G2, 2, 'add');
      expect(chain.every((c) => c.op === '+' && c.value >= 2)).toBe(true);
      expect(start + chain.reduce((s, c) => s + c.value, 0)).toBeLessThanOrEqual(100);
    }
    // The default still mixes.
    for (let i = 0; i < 100; i++) expect(new Set(rollChain(G2, 2).chain.map((c) => c.op)).size).toBe(2);
  });
});

describe('two_step_compare', () => {
  it.each(SHAPES)('%s: numbers within 100, the step bars add up, step 2 starts from step 1', (shape) => {
    for (let i = 0; i < 300; i++) {
      const s = rollTwoStepCompare(G2, shape)!;
      expect(s).not.toBeNull();
      const total = totalOf(s), other = otherOf(s);
      for (const v of [s.a, s.b, s.d, total, other]) { expect(v).toBeGreaterThanOrEqual(2); expect(v).toBeLessThanOrEqual(100); }
      const { bars, steps } = twoStepCompareBars(s, words);
      for (const bar of bars) expect(bar.whole!.value).toBe(bar.segments.reduce((n, seg) => n + seg.value!, 0));
      expect(bars[0].whole).toMatchObject({ value: total, isUnknown: true });
      const step2 = [bars[1].whole!, ...bars[1].segments];
      expect(step2.find((seg) => seg.carriedFromStep === 0)?.value).toBe(total);
      // Exactly one unknown per step, and it is the answer for step 2.
      const unknown = steps[1].segment === -1 ? bars[1].whole! : bars[1].segments[steps[1].segment];
      expect(unknown.isUnknown).toBe(true);
      expect(unknown.value).toBe(answerOf(s));
      expect(step2.filter((seg) => seg.isUnknown)).toHaveLength(1);
      // The larger amount is the whole bar.
      expect(bars[1].whole!.value).toBe(Math.max(total, other));
    }
  });

  it('the wording: consistent puts the word with the operation, inconsistent against it', () => {
    const base = { a: 20, b: 5, d: 10 };
    expect(plainCompareStory({ ...base, ownerLarger: true, shape: 'inconsistent' }, words))
      .toBe('Tia has 20 red beads and 5 blue beads. Tia has 10 more beads than Sam. How many beads does Sam have?');
    expect(plainCompareStory({ ...base, ownerLarger: true, shape: 'consistent' }, words))
      .toBe('Tia has 20 red beads and 5 blue beads. Sam has 10 fewer beads than Tia. How many beads does Sam have?');
    expect(plainCompareStory({ ...base, ownerLarger: false, shape: 'consistent' }, words)).toContain('Sam has 10 more beads than Tia.');
    expect(plainCompareStory({ ...base, ownerLarger: false, shape: 'inconsistent' }, words)).toContain('Tia has 10 fewer beads than Sam.');
    expect(plainCompareStory({ ...base, ownerLarger: true, shape: 'difference' }, words))
      .toBe('Tia has 20 red beads and 5 blue beads. Sam has 15 beads. How many more beads does Tia have than Sam?');
    expect(compareWordOf({ ...base, ownerLarger: true, shape: 'inconsistent' })).toBe('more');
  });

  it('the model supplies words and a scene only; anything with a number or a comparison falls back', () => {
    expect(compareWordsFit({ ...words })).toBe(true);
    expect(compareWordsFit({ ...words, part2: 'red beads' })).toBe(false);
    expect(compareWordsFit({ ...words, thing: '5 beads' })).toBe(false);
    expect(settingFits('The class is getting ready for the craft fair.')).toBe(true);
    expect(settingFits('Tia has more beads than Sam.')).toBe(false);
    expect(settingFits('There are 3 tables.')).toBe(false);
    for (const shape of SHAPES) for (let i = 0; i < 50; i++) {
      const s = rollTwoStepCompare(G2, shape)!;
      const story = plainCompareStory(s, fallbackWords());
      // Every number shown is in the story; the answer and the total are not.
      expect((story.match(/\d+/g) ?? []).map(Number).sort()).toEqual(
        (shape === 'difference' ? [s.a, s.b, otherOf(s)] : [s.a, s.b, s.d]).sort());
      expect(story).toMatch(new RegExp(`\\b${compareWordOf(s)}\\b`));
    }
  });

  it('the swapped bar is the "more means add" model', () => {
    const s = { a: 20, b: 5, d: 10, ownerLarger: true, shape: 'inconsistent' as const };
    const bar = twoStepCompareBars(s, words).bars[1];
    const wrong = swappedBar(bar)!;
    expect(wrong.whole!.label).toBe("Sam's beads");
    expect(wrong.segments.map((seg) => seg.label)).toEqual(["Tia's beads", 'how many more Tia has']);
  });
});
