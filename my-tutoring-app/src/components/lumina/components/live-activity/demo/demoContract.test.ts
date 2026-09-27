import { describe, expect, it } from 'vitest';
import { buildDemonstration, demoRefusal, repairScript, type DemoScript } from './demoContract';

const script = (s: Partial<DemoScript>): DemoScript => ({
  piece: 'number-line', operation: 'subtract', values: [14, 3], focus: 'the first hop', studentValues: [], ...s,
});

describe('composed demonstrations', () => {
  it("refuses the student's own problem", () => {
    expect(demoRefusal(script({ values: [12, 3], studentValues: [12, 3] }))).toMatch(/own problem/);
    expect(demoRefusal(script({ piece: 'clock', operation: 'minutes-from-numeral', values: [5, 4], studentValues: [3, 4] }))).toMatch(/own problem/);
    expect(demoRefusal(script({ piece: 'place-value', operation: 'compare', values: [4001, 3999], studentValues: [3999, 4001] }))).toMatch(/own problem/);
  });

  it('refuses an example with the same answer', () => {
    expect(demoRefusal(script({ operation: 'add', denominator: 5, values: [1, 2], studentValues: [2, 1] }))).toMatch(/same answer/);
    expect(demoRefusal(script({ values: [13, 2], studentValues: [12, 1] }))).toMatch(/same answer/);
  });

  it('repairs a same-answer example by one step instead of asking the model again', () => {
    const repaired = repairScript(script({ operation: 'add', denominator: 5, values: [1, 2], studentValues: [2, 1] }))!;
    expect(repaired.values).toEqual([1, 3]);
    expect(demoRefusal(repaired)).toBeNull();
    expect(repairScript(script({ piece: 'clock', operation: 'minutes-from-numeral', values: [3, 4], studentValues: [3, 4] }))).toBeNull();
  });

  it('refuses what a piece cannot draw', () => {
    expect(demoRefusal(script({ piece: 'clock', operation: 'subtract' }))).toMatch(/cannot draw/);
    expect(demoRefusal(script({ values: [2, 5] }))).toMatch(/past zero/);
    expect(demoRefusal(script({ piece: 'place-value', operation: 'make-a-ten', values: [9] }))).toMatch(/10 to 18/);
  });

  it('lands the first hop one step from the start and states the result', () => {
    const demo = buildDemonstration(script({}));
    expect(demo.frames[1].caption).toContain('lands on 13');
    expect(demo.frames.at(-1)!.caption).toContain('14 − 3 = 11');
  });

  it('keeps fraction hops in the unit and names the unit', () => {
    const demo = buildDemonstration(script({ operation: 'add', values: [1, 3], denominator: 6 }));
    expect(demo.frames.at(-1)!.caption).toContain('1/6 + 3/6 = 4/6');
    expect(demo.frames.at(-1)!.caption).toContain('one sixth');
    expect(demo.frames[1].caption).not.toContain('where we started');
    expect(demo.title).toBe('Hopping in sixths');
  });

  it('compares from the biggest place and stops at the first difference', () => {
    const demo = buildDemonstration(script({ piece: 'place-value', operation: 'compare', values: [2989, 3012] }));
    expect(demo.frames).toHaveLength(2);
    expect(demo.frames[1].caption).toContain('3,012 is greater than 2,989');
    const tied = buildDemonstration(script({ piece: 'place-value', operation: 'compare', values: [5208, 5190] }));
    expect(tied.frames.map(f => (f.view as { focusPlace: number | null }).focusPlace)).toEqual([null, 0, 1]);
  });

  it('counts the clock by fives to the numeral', () => {
    const demo = buildDemonstration(script({ piece: 'clock', operation: 'minutes-from-numeral', values: [7, 7] }));
    expect(demo.frames.at(-1)!.caption).toContain('35 minutes');
    expect(demo.frames.at(-1)!.caption).toContain('7:35');
  });
});
