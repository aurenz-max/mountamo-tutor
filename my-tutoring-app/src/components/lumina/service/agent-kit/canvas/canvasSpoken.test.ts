import { describe, expect, it } from 'vitest';
import { canvasSay, canvasSpokenKey, canvasSpokenMisses, readSpoken, ruleIssues, spokenForms, spokenIssues } from './canvasSpoken';

const report = (value: unknown, misrules: unknown[] = []) => ({ value, misrules });
const ASK = 'How many parts are in each whole?';

describe('say and show on a canvas', () => {
  it('reads what the page reported; a page that reported nothing is shown only', () => {
    expect(readSpoken(null)).toBeNull();
    expect(readSpoken(report({ x: 1 }))).toBeNull();
    expect(readSpoken(report(4, [{ says: 2, because: 'counted the shaded parts' }, { says: '', because: 'x' }])))
      .toEqual({ answer: 4, misrules: [{ says: 2, because: 'counted the shaded parts' }] });
    expect(spokenIssues(ASK, null)).toEqual([]);
  });

  it('derives the key, the misses and the harness answers from the report', () => {
    const s = readSpoken(report(4, [{ says: 2, because: 'counted the shaded parts, not the parts in each whole' }, { says: 8, because: 'counted the parts of both wholes' }]))!;
    expect(canvasSpokenKey(s)).toEqual({ answer: '4', alsoAccept: ['four'] });
    expect(canvasSpokenKey({ answer: 'one fourth' })).toEqual({ answer: 'one fourth', alsoAccept: [] });
    expect(canvasSpokenMisses(s).map(m => [m.id, m.examples])).toEqual([['misrule_first', ['two']], ['misrule_second', ['eight']]]);
    expect(canvasSpokenMisses(s)[0].pattern).toContain('counted the shaded parts');
    expect(canvasSay(s)).toEqual({ correct: 'four', plainWrong: 'two' });
    expect(canvasSay({ answer: 30 })).toEqual({ correct: 'thirty', plainWrong: 'thirty one' });
    expect(canvasSay({ answer: 250 })).toEqual({ correct: 'two hundred fifty', plainWrong: 'two hundred fifty one' });
    expect(canvasSay({ answer: 12000 })).toEqual({ correct: '12000', plainWrong: '12001' });
  });

  it('knows how a fraction, a decimal and a number to 100 are said', () => {
    expect(spokenForms('3/4')).toEqual(['3/4', 'three over four', 'three quarters', 'three fourths']);
    expect(spokenForms('1/2')).toEqual(['1/2', 'one over two', 'one half']);
    expect(spokenForms('5/3').at(-1)).toBe('five thirds');
    expect(spokenForms('2/11')).toEqual(['2/11', 'two over eleven']);
    expect(spokenForms(0.35)).toEqual(['0.35', 'thirty five hundredths', 'point three five', 'zero point three five']);
    expect(spokenForms('0.5')).toEqual(['0.5', 'five tenths', 'point five', 'zero point five']);
    expect(spokenForms(1.4)).toEqual(['1.4', 'one point four']);
    expect(spokenForms(42)).toEqual(['42', 'forty two']);
    expect(spokenForms(305)).toEqual(['305', 'three hundred and five', 'three hundred five']);
    expect(spokenForms(300).at(-1)).toBe('three hundred');
    expect(spokenForms('3,005')).toEqual(['3,005', 'three thousand and five', 'three thousand five']);
    expect(spokenForms(4050).at(-1)).toBe('four thousand fifty');
    expect(spokenForms(3482).at(-1)).toBe('three thousand four hundred eighty two');
    expect(spokenForms(0)).toEqual(expect.arrayContaining(['zero', 'none', 'nothing']));
    expect(spokenForms(12000)).toEqual(['12000']);
    expect(spokenForms('same')).toEqual(['same']);
    // Negatives (wave 6): the positive's words after "minus" or "negative", "negative ..." last.
    expect(spokenForms(-7)).toEqual(['-7', 'minus seven', 'negative seven']);
    expect(spokenForms('-2/3')).toEqual(expect.arrayContaining(['negative two thirds', 'minus two over three']));
    expect(spokenForms('-2/3').at(-1)).toBe('negative two thirds');
    // The ask may not say the fraction in any of its forms.
    expect(spokenIssues('Is the marker at three quarters?', report('3/4')).join()).toMatch(/says the answer "three quarters"/);
  });

  it('an ask that offers choices is a menu: it says every choice, and the answer and misrules are among them', () => {
    const WHICH = 'Which has more shaded: the first, the second, or are they the same?';
    const pick = (value: unknown, misrules: unknown[], choices: unknown) => ({ value, misrules, choices });
    const m = { says: 'same', because: 'the same fraction name means the same amount' };
    const s = readSpoken(pick('first', [m], ['first', 'second', 'same']))!;
    expect(canvasSpokenKey(s)).toEqual({ answer: 'first', alsoAccept: [], menu: ['first', 'second', 'same'] });
    expect(spokenIssues(WHICH, pick('first', [m], ['first', 'second', 'same']))).toEqual([]);
    expect(canvasSay(readSpoken(pick('first', [], ['first', 'second']))!)).toEqual({ correct: 'first', plainWrong: 'second' });
    expect(spokenIssues('Which has more shaded?', pick('first', [m], ['first', 'second', 'same'])).join()).toMatch(/does not say the menu word "first"/);
    expect(spokenIssues(WHICH, pick('third', [], ['first', 'second', 'same'])).join()).toMatch(/not one of the choices/);
    expect(spokenIssues(WHICH, pick('first', [{ ...m, says: 'both' }], ['first', 'second', 'same'])).join()).toMatch(/misrule says both, which is not one of the choices/);
    expect(spokenIssues(WHICH, pick('first', [], ['first'])).join()).toMatch(/2 to 4 different words/);
  });

  it('a spec that states a rule needs a range of problems, named misrules and no run of one answer', () => {
    const p = (answer: number, says?: number) => ({ answer, ...(says === undefined ? {} : { misrules: [{ says, because: 'a wrong rule' }] }) });
    expect(ruleIssues([p(1, 2), p(4, 2), p(1, 2), p(2, 1), p(3, 2)])).toEqual([]);
    expect(ruleIssues([p(1, 2), p(4, 2), p(1, 2)]).join()).toMatch(/5 or more problems \(it has 3\)/);
    expect(ruleIssues([p(1, 2), p(4), p(1), p(2), p(3, 2)]).join()).toMatch(/2 problem\(s\) name a misrule/);
    expect(ruleIssues([p(1, 2), p(2, 1), p(2, 3), p(2, 4), p(3, 2)]).join()).toMatch(/problems 2 to 4 have the same answer \(2\)/);
    expect(ruleIssues([p(1, 2), null, p(2, 1), null, p(3, 2)])).toEqual([]);
  });

  it('blocks an answer that cannot be said, moves with the child, arrives late, or is in the ask', () => {
    expect(spokenIssues(ASK, report([1, 2]))[0]).toMatch(/one value a child can say/);
    expect(spokenIssues(ASK, report(4), [report(4), report(5)])[0]).toMatch(/changed when the child acted/);
    expect(spokenIssues(ASK, null, [report(4)])[0]).toMatch(/only after the child acts/);
    expect(spokenIssues('Are there four parts in each whole?', report(4)).join()).toMatch(/says the answer "four"/);
    expect(spokenIssues(ASK, report(4), [report(4), report(4)])).toEqual([]);
  });

  it('blocks a misrule that is the answer, a repeat, a malformed one, or more than three', () => {
    const m = (says: unknown) => ({ says, because: 'a wrong rule' });
    expect(spokenIssues(ASK, report(4, [m(4)])).join()).toMatch(/which is the right answer/);
    expect(spokenIssues(ASK, report(4, [m(2), m(2)])).join()).toMatch(/same value/);
    expect(spokenIssues(ASK, report(4, [{ says: 2 }])).join()).toMatch(/needs \{ says, because \}/);
    expect(spokenIssues(ASK, report(4, [m(1), m(2), m(3), m(5)])).join()).toMatch(/at most 3/);
    // A misrule equal in amount to the answer is the right answer too.
    expect(spokenIssues(ASK, report('3/4', [m('6/8')])).join()).toMatch(/which is the right answer/);
  });

  it('accepts every named fraction equal to the answer, and keeps the answer as written', () => {
    const k = canvasSpokenKey({ answer: '3/6' });
    expect(k.answer).toBe('3/6');
    expect(k.alsoAccept).toEqual(expect.arrayContaining(['three sixths', 'one half', 'two fourths', 'six twelfths']));
    expect(canvasSpokenKey({ answer: '6/4' }).alsoAccept).toEqual(expect.arrayContaining(['three halves', 'one and one half']));
    // Not a whole number: an ask says "one whole pie" for the amount to shade.
    expect(canvasSpokenKey({ answer: '4/4' }).alsoAccept).not.toContain('one');
    expect(canvasSpokenKey({ answer: '2/11' }).alsoAccept).toEqual(['two over eleven']);
    // The ask may not say an equal amount either.
    expect(spokenIssues('Shade two fourths of the bar. How much is shaded?', report('1/2')).join()).toMatch(/two fourths/);
  });
});
