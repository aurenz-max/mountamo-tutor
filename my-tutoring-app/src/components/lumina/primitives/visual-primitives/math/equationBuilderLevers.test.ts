import { describe, expect, it } from 'vitest';
import type { EquationBuilderChallenge } from './EquationBuilder';
import { equationBuilderHarnessInputs, equationBuilderMatches, evaluateEquation, makeNMiss, referenceWays, sameWay, sentenceValue,
  type EquationBuilderView } from './equationBuilderWorkspace';
import { DOTS_LEVER, EQ_FRAME_LEVER, FRAME_LEVER, MATCH_LEVER, PRINTED_DOTS_LEVER, REWRITE_MODEL_LEVER, SMALLER_LEVER,
  SMALLER_NUMBERS_LEVER, equationBuilderLevers, equationFrame, equationLeverFacts, factText, familyForms, frameLeaks, makeNLevers,
  matchMarked, practiceItem, practiceParent, printedDots, printedTokens, repeatsItem, rewriteModel, rewriteModelLeaks, smallerMakeN,
  type Fact } from './equationBuilderLevers';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';

const bank = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), '+', '-'];
const make = (target: number, ways = 1): EquationBuilderChallenge => ({ id: `m${target}`, type: 'make-n', target, ways,
  availableTiles: bank, instruction: `Make a number sentence that equals ${target}.` });
const row = (s: string) => s.split(' ');

describe('make-n check', () => {
  it('reads number (sign number)+ left to right, and nothing else', () => {
    expect(sentenceValue(row('4 + 6'))).toBe(10);
    expect(sentenceValue(row('12 - 2'))).toBe(10);
    expect(sentenceValue(row('2 + 3 + 5'))).toBe(10);
    expect(sentenceValue(row('12 − 2'))).toBe(10);
    for (const bad of ['10', '4 +', '+ 4', '4 6', '4 + + 6', '4 = 6']) expect(sentenceValue(row(bad)), bad).toBeNull();
  });

  it('names the miss: one off, far off, malformed, the total alone, the same way again', () => {
    expect(makeNMiss(10, row('4 + 6'))).toBeUndefined();
    expect(makeNMiss(10, row('5 + 5'))).toBeUndefined();
    expect(makeNMiss(10, row('4 + 5'))).toBe('one_short');
    expect(makeNMiss(10, row('4 + 7'))).toBe('one_over');
    expect(makeNMiss(10, row('2 + 3'))).toBe('short_by_more');
    expect(makeNMiss(10, row('9 + 9'))).toBe('over_by_more');
    expect(makeNMiss(10, row('4 +'))).toBe('unfinished_sentence');
    expect(makeNMiss(10, row('10'))).toBe('bare_number');
    expect(makeNMiss(10, row('7'))).toBe('bare_number');
    expect(makeNMiss(10, row('6 + 4'), [row('4 + 6')])).toBe('same_way');
    expect(makeNMiss(10, row('12 - 2'), [row('4 + 6')])).toBeUndefined();
    expect(sameWay(row('1 + 2 + 7'), row('7 + 1 + 2'))).toBe(true);
    expect(sameWay(row('12 - 2'), row('11 - 1'))).toBe(false);
  });

  it('the harness and the adapter reach the total through the bank, as many ways as asked', () => {
    expect(referenceWays(make(10, 2))).toEqual([row('1 + 9'), row('1 + 1 + 8')]);
    expect(referenceWays({ ...make(10), availableTiles: ['10', '+'] })).toBeNull();
    expect(equationBuilderHarnessInputs(make(6), true).map(i => 'label' in i && i.label)).toEqual(['Tile 6', "I'm done!"]);
    expect(equationBuilderHarnessInputs(make(3, 2), false).map(i => 'label' in i && i.label)).toEqual(['Clear',
      'Tile 1', 'Tile +', 'Tile 2', "I'm done!", 'Tile 1', 'Tile +', 'Tile 1', 'Tile +', 'Tile 1', "I'm done!"]);
  });
});

describe('make-n levers', () => {
  it('help on a miss, simplify to about half with + only; each lever names the build and never a total', () => {
    const levers = makeNLevers(make(10), []);
    expect(levers.map(l => [l.id, l.kind])).toEqual([[DOTS_LEVER, 'help'], [FRAME_LEVER, 'help'], [SMALLER_LEVER, 'simplify']]);
    const answered = new Set(levers.flatMap(l => l.answers ?? []));
    for (const miss of ['bare_number', 'unfinished_sentence', 'one_short', 'one_over', 'short_by_more', 'over_by_more']) {
      expect(answered.has(miss), miss).toBe(true);
    }
    for (const l of levers) {
      expect(`${l.when} ${l.does}`, l.id).not.toMatch(/\d/);
      expect(l.does, l.id).not.toMatch(/hands? over|choose|pick/i);
    }
    expect(levers[0].does).toMatch(/Never the amount the sentence makes/);
    expect(makeNLevers(make(10), [DOTS_LEVER]).find(l => l.id === DOTS_LEVER)?.pulled).toBe(true);
    expect(makeNLevers({ ...make(10), type: 'build' }, [])).toEqual([]);
  });

  it('the easier item is half the total, one way, with only + and the numbers up to it', () => {
    expect(smallerMakeN(make(10, 2))).toEqual({ id: 'm10~smaller', type: 'make-n', target: 5, ways: 1,
      availableTiles: ['1', '2', '3', '4', '5', '+'], instruction: 'Make a number sentence that equals 5.' });
    expect(smallerMakeN(make(3))).toMatchObject({ target: 2, availableTiles: ['1', '2', '+'] });
    expect(smallerMakeN(make(2))).toBeNull();
    // No simplify lever where there is no smaller item.
    expect(makeNLevers(make(2), []).map(l => l.id)).not.toContain(SMALLER_LEVER);
  });
});

// ── The other six modes ─────────────────────────────────────────────────────

describe('six-mode levers', () => {
  const R = (lo: number, hi: number, i: number, k: number) => lo + ((i * 7 + k * 13) % (hi - lo + 1));
  /** A spread of generator-shaped items per type, every sign and order. */
  const items = (): EquationBuilderChallenge[] => {
    const out: EquationBuilderChallenge[] = [];
    for (let i = 0; i < 60; i++) {
      const a = R(1, 9, i, 1), b = R(1, 9, i, 2), plus = i % 2 === 0, flip = i % 3 === 0;
      const [x, y] = plus ? [a, b] : [Math.max(a, b), Math.min(a, b)];
      const f: Fact = { a: x, op: plus ? '+' : '-', b: y, c: plus ? x + y : x - y, flipped: flip };
      const eq = factText(f);
      out.push({ id: `b${i}`, type: 'build', instruction: 'Build it.', targetEquation: eq, availableTiles: [...eq.split(' '), '4', '-'] });
      const blank = [0, 2, 4][i % 3];
      const answer = Number(eq.split(' ')[blank]);
      out.push({ id: `m${i}`, type: 'missing-value', instruction: 'Find it.', equation: factText(f, blank), missingPosition: blank,
        correctValue: answer, options: [answer, answer + 1, answer + 2] });
      out.push({ id: `t${i}`, type: 'true-false', instruction: 'True or false?', displayEquation: factText(i % 4 ? f : { ...f, c: f.c + 1 }),
        isTrue: !!(i % 4) });
      const left = a + b, known = R(1, left - 1, i, 3);
      out.push({ id: `bal${i}`, type: 'balance', instruction: 'Balance.', leftSide: `${a} + ${b}`,
        rightSide: i % 2 ? `? + ${known}` : `${known} + ?`, correctAnswer: left - known });
      const fam = plus ? [x, y, x + y] : [y, x - y, x];
      out.push({ id: `r${i}`, type: 'rewrite', instruction: 'Rewrite.', originalEquation: eq, acceptedForms: familyForms(fam[0], fam[1], fam[2], eq),
        availableTiles: familyForms(fam[0], fam[1], fam[2])[0].split(' ').concat(['-', fam[0] === fam[1] ? String(fam[0]) : '9']) });
    }
    return out;
  };
  const blankView: EquationBuilderView = { slots: [], option: null, truth: null, entry: '' };

  it('every practice item: same type and sign, a new id, solvable by its own key, never the item\'s numbers or missing number', () => {
    let built = 0;
    for (const c of items()) {
      const p = practiceItem(c);
      if (!p) continue;
      built++;
      expect(p.id).toBe(`${c.id}~smaller`);
      expect(p.type).toBe(c.type);
      expect(repeatsItem(p, c), c.id).toBe(false);
      switch (p.type) {
        case 'build':
          expect(evaluateEquation(p.targetEquation!)).toBe(true);
          expect(equationBuilderMatches(p, { ...blankView, slots: p.targetEquation!.split(' ') })).toBe(true);
          expect(p.targetEquation!.includes('-')).toBe(c.targetEquation!.includes('-'));
          break;
        case 'missing-value':
          expect(evaluateEquation(p.equation!.replace('?', String(p.correctValue)))).toBe(true);
          expect(p.options).toContain(p.correctValue);
          expect(p.options).toHaveLength(2);
          expect(p.correctValue).not.toBe(c.correctValue);
          expect(p.equation!.split(' ').indexOf('?')).toBe(c.equation!.split(' ').indexOf('?'));
          break;
        case 'true-false': expect(evaluateEquation(p.displayEquation!)).toBe(p.isTrue); break;
        case 'balance':
          expect(evaluateEquation(`${p.leftSide}=${p.rightSide!.replace('?', String(p.correctAnswer))}`)).toBe(true);
          expect(p.correctAnswer).not.toBe(c.correctAnswer);
          break;
        case 'rewrite':
          expect(evaluateEquation(p.originalEquation!)).toBe(true);
          expect(p.acceptedForms!.length).toBeGreaterThan(0);
          for (const form of p.acceptedForms!) expect(evaluateEquation(form), form).toBe(true);
          expect(equationBuilderHarnessInputs(p, false).length).toBeGreaterThan(1);
          break;
      }
    }
    expect(built).toBeGreaterThan(200);
  });

  it('the plainest items get no simplify lever', () => {
    const tiny: EquationBuilderChallenge = { id: 'x', type: 'missing-value', instruction: '', equation: '1 + 1 = ?', missingPosition: 4,
      correctValue: 2, options: [1, 2] };
    expect(practiceItem(tiny)).toBeNull();
    expect(equationBuilderLevers(tiny, []).map(l => l.id)).toEqual([PRINTED_DOTS_LEVER]);
    // The only smaller fact would show the item's own missing number.
    expect(practiceItem({ ...tiny, equation: '? + 3 = 4', missingPosition: 0, correctValue: 1 })).toBeNull();
  });

  it('leak rules: the frame has no number or sign, dots skip the ?, the model uses none of the item\'s numbers, marks ring numbers only', () => {
    for (const c of items()) {
      if (c.type === 'build') expect(frameLeaks(equationFrame(c)), c.id).toBe(false);
      if (c.type === 'missing-value') expect(printedDots(printedTokens(c))[c.equation!.split(' ').indexOf('?')]).toBeNull();
      if (c.type === 'rewrite') {
        const m = rewriteModel(c)!;
        expect(m, c.id).not.toBeNull();
        expect(rewriteModelLeaks(m, c)).toBe(false);
        expect(evaluateEquation(m.from) && evaluateEquation(m.to)).toBe(true);
        for (const t of ['+', '-', '=']) expect(matchMarked(c, t)).toBe(false);
      }
    }
    expect(printedDots(['3', '+', '4', '=', '?', '+', '2'])).toEqual([3, null, 4, null, null, null, 2]);
    expect(rewriteModelLeaks({ from: '2 + 3 = 5', to: '5 = 2 + 3' },
      { id: 'r', type: 'rewrite', instruction: '', originalEquation: '2 + 4 = 6' })).toBe(true);
  });

  const at = (type: EquationBuilderChallenge['type']) => items().find(c => c.type === type && /\D5$/.test(c.id))!;
  it.each([
    ['build', 'unfinished_equation', [], EQ_FRAME_LEVER], ['build', 'false_equation', [], DOTS_LEVER],
    ['build', 'other_operation', [], SMALLER_NUMBERS_LEVER], ['build', 'other_numbers', [], SMALLER_NUMBERS_LEVER],
    ['rewrite', 'same_as_printed', [], REWRITE_MODEL_LEVER], ['rewrite', 'other_form', [], REWRITE_MODEL_LEVER],
    ['rewrite', 'unfinished_equation', [], REWRITE_MODEL_LEVER], ['rewrite', 'false_equation', [], DOTS_LEVER],
    ['rewrite', 'other_numbers', [], MATCH_LEVER], ['rewrite', 'other_form', [REWRITE_MODEL_LEVER], SMALLER_NUMBERS_LEVER],
    ['missing-value', 'one_short', [], PRINTED_DOTS_LEVER], ['missing-value', 'printed_number', [], PRINTED_DOTS_LEVER],
    ['missing-value', 'sum_of_printed', [], SMALLER_NUMBERS_LEVER], ['missing-value', 'over_by_more', [PRINTED_DOTS_LEVER], SMALLER_NUMBERS_LEVER],
    ['true-false', 'said_true', [], PRINTED_DOTS_LEVER], ['true-false', 'said_false', [PRINTED_DOTS_LEVER], SMALLER_NUMBERS_LEVER],
    ['balance', 'other_side_total', [], PRINTED_DOTS_LEVER], ['balance', 'short_by_more', [PRINTED_DOTS_LEVER], SMALLER_NUMBERS_LEVER],
  ] as const)('%s: after %s with %j pulled, the next lever is %s', (type, miss, pulled, want) => {
    expect(nextLever(equationBuilderLevers(at(type), [...pulled]), miss)).toBe(want);
  });

  it('every catalog miss of the six modes is answered by a lever on a typical item; texts name no number', () => {
    const misses = getComponentById('equation-builder')!.teachingWorkspace!.misses!;
    const byMode: Record<string, EquationBuilderChallenge> = { 'build-simple': at('build'), 'missing-result': at('missing-value'),
      'missing-operand': at('missing-value'), 'true-false': at('true-false'), 'balance-both-sides': at('balance'), rewrite: at('rewrite') };
    for (const [mode, c] of Object.entries(byMode)) {
      const levers = equationBuilderLevers(c, []);
      const answered = new Set(levers.flatMap(l => l.answers ?? []));
      for (const m of misses[mode] ?? []) expect(answered.has(m), `${mode} ${m}`).toBe(true);
      for (const l of levers) expect(`${l.when} ${l.does}`, l.id).not.toMatch(/\d/);
    }
  });

  it('easy starts the dots shown, and only the dots; make-n starts bare', () => {
    expect(equationBuilderLevers(at('true-false'), [], 'easy').filter(l => l.pulled).map(l => l.id)).toEqual([PRINTED_DOTS_LEVER]);
    expect(equationBuilderLevers(at('build'), [], 'easy').filter(l => l.pulled).map(l => l.id)).toEqual([DOTS_LEVER]);
    expect(equationBuilderLevers(at('build'), [], 'hard').filter(l => l.pulled)).toEqual([]);
    expect(equationBuilderLevers(make(10), [], 'easy').filter(l => l.pulled)).toEqual([]);
  });

  it('the scene fact says what is drawn: the model in its own numbers, never one of the item\'s forms', () => {
    const c = at('rewrite');
    const facts = equationLeverFacts(c, equationBuilderLevers(c, [REWRITE_MODEL_LEVER, MATCH_LEVER]))!;
    const m = rewriteModel(c)!;
    expect(facts).toContain(`${m.from} written as ${m.to}`);
    for (const form of c.acceptedForms!) expect(facts).not.toContain(form);
  });

  it('a practice id leads back to its parent', () => {
    const all = items();
    expect(practiceParent('r5~smaller', all)?.id).toBe('r5');
    expect(practiceParent('r5', all)).toBeNull();
  });
});
