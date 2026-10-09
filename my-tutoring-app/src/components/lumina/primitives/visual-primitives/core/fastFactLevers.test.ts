/**
 * fast-fact levers: leak rules per lever and mode, the drop guard, and "this wrong answer, then this lever" as code.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { getComponentById } from '../../../service/manifest/catalog';
import type { FastFactChallenge } from './FastFact';
import { fastFactMiss } from './fastFactWorkspace';
import {
  DROP_LEVER, MODEL_LEVER, NO_LEVERS, SPREAD_LEVER, countModel, farChoice, fastFactLevers, leversOnScreen, modelLeak, spreadLeak,
} from './fastFactLevers';

const fact = (challengeType: FastFactChallenge['challengeType'], text: string, correctAnswer: string, options: string[],
  extra: Partial<FastFactChallenge> = {}): FastFactChallenge =>
  ({ id: 'f', type: 'core', challengeType, prompt: { text }, correctAnswer, responseMode: 'choice', options, ...extra });
const stars = (n: number, text = 'How many stars?') =>
  fact('recognize', text, String(n), [String(n - 1), String(n), String(n + 1)], { prompt: { text, visual: { type: 'emoji', emoji: '⭐'.repeat(n) } } });
const ids = (c: FastFactChallenge, s = NO_LEVERS) => fastFactLevers(c, s).map(l => l.id);
const MODES = ['recognize', 'recall', 'apply'] as const;

describe('spread_pictures', () => {
  it('only on a counting question over one repeated picture with a numeric key', () => {
    expect(spreadLeak(stars(4))).toBeNull();
    expect(spreadLeak(stars(1))).toBeNull();
    expect(spreadLeak(stars(4, 'Which fruit is this?'))).toMatch(/count/);
    expect(spreadLeak({ ...stars(4), correctAnswer: 'four', options: ['three', 'four', 'five'] })).toMatch(/not a number/);
    expect(spreadLeak({ ...stars(4), prompt: { text: 'How many?', visual: { type: 'emoji', emoji: '⭐🍎⭐' } } })).toMatch(/repeated/);
    expect(spreadLeak(stars(21))).toMatch(/more than/);
  });
  it.each(MODES)('%s: its scene fact never says how many', mode => {
    for (let n = 1; n <= 20; n++) {
      const c = { ...stars(n), challengeType: mode };
      const fact = leversOnScreen(c, { ...NO_LEVERS, pulled: [SPREAD_LEVER] })!;
      expect(fact).toContain('spread apart');
      expect(fact).not.toMatch(/\d/);
    }
  });
});

describe('count_model', () => {
  it('models a sum, a difference and a product whose value is the key', () => {
    expect(countModel(fact('recall', '7 + 3 = ?', '10', ['9', '10', '11']))).toEqual({ kind: 'sum', a: 7, b: 3 });
    expect(countModel(fact('recall', 'What is 9 - 4?', '5', ['4', '5', '6']))).toEqual({ kind: 'difference', a: 9, b: 4 });
    expect(countModel(fact('recall', '3 × 4 = ?', '12', ['7', '12', '14']))).toEqual({ kind: 'product', a: 3, b: 4 });
  });
  it('refuses where the dots would not model the asked value', () => {
    expect(modelLeak(fact('apply', 'Which number makes this true? 9 + 9 = 8 + ___', '10', ['9', '10', '11']))).toMatch(/not the value/);
    expect(modelLeak(fact('apply', 'Find the missing addend: 7 + ___ = 12', '5', ['4', '5', '6']))).toMatch(/no sum/);
    expect(modelLeak(fact('recall', '12 ÷ 3 = ?', '4', ['3', '4', '5']))).toMatch(/no sum/);
    expect(modelLeak(fact('recall', '19 + 18 = ?', '37', ['36', '37', '38']))).toMatch(/too many/);
    expect(modelLeak(fact('recall', 'What is the capital of Texas?', 'Austin', ['Austin', 'Dallas', 'Houston']))).toMatch(/not a number/);
  });
  it.each(MODES)('%s: its scene fact names the question\'s numbers, never the value', mode => {
    for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
      for (const [op, value] of [['+', a + b], ['-', a - b], ['×', a * b]] as const) {
        const c = fact(mode, `${a} ${op} ${b} = ?`, String(value), [String(value - 1), String(value), String(value + 1)]);
        if (modelLeak(c)) continue;
        const said = leversOnScreen(c, { ...NO_LEVERS, pulled: [MODEL_LEVER] })!;
        const numbers = (said.match(/\d+/g) ?? []).map(Number);
        expect(numbers.every(n => n === a || n === b), `${a} ${op} ${b}: ${said}`).toBe(true);
      }
    }
  });
});

describe('drop_far_choice', () => {
  const add = fact('recall', '5 + 3 = ?', '8', ['7', '9', '8', '15']);
  it('drops the numeric choice farthest from the key, never the key or a tapped one', () => {
    expect(farChoice(add, NO_LEVERS)).toBe('15');
    expect(farChoice(add, { ...NO_LEVERS, picked: ['15'] })).toBe('7');
  });
  it('never leaves fewer than two untried choices, so never the answer alone', () => {
    expect(farChoice(add, { ...NO_LEVERS, picked: ['15', '7'] })).toBeNull();
    expect(farChoice(add, { ...NO_LEVERS, dropped: ['15'], picked: ['7'] })).toBeNull();
    const three = fact('apply', 'Denver is the capital of which state?', 'Colorado', ['Utah', 'Colorado', 'Kansas']);
    expect(farChoice(three, NO_LEVERS)).toBe('Kansas');
    expect(farChoice(three, { ...NO_LEVERS, picked: ['Utah'] })).toBeNull();
    expect(farChoice(fact('recall', 'Is 7 odd?', 'Yes', ['Yes', 'No']), NO_LEVERS)).toBeNull();
  });
  it.each(MODES)('%s: over many menus, the drop is never a credited choice', mode => {
    for (let k = 2; k <= 15; k++) {
      const c = fact(mode, `What is ${k} + 0?`, String(k), [String(k - 2), String(k - 1), String(k), String(k + 3)], { acceptableAnswers: [String(k)] });
      const d = farChoice(c, NO_LEVERS);
      expect(d).not.toBeNull();
      expect(d).not.toBe(String(k));
      expect(leversOnScreen(c, { ...NO_LEVERS, pulled: [DROP_LEVER], dropped: [d!] })).not.toContain(`"${k}"`);
    }
  });
});

describe('the levers each item declares', () => {
  it('counting, arithmetic and a text menu', () => {
    expect(ids(stars(4))).toEqual([SPREAD_LEVER, DROP_LEVER]);
    expect(ids(fact('recall', '5 + 3 = ?', '8', ['7', '9', '8', '15']))).toEqual([MODEL_LEVER, DROP_LEVER]);
    expect(ids(fact('apply', 'Which state has Denver as its capital?', 'Colorado', ['Utah', 'Colorado', 'Kansas', 'Ohio'])))
      .toEqual([DROP_LEVER]);
  });
  it('no lever text carries a number', () => {
    for (const l of fastFactLevers(stars(4), NO_LEVERS)) expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
    for (const l of fastFactLevers(fact('recall', '5 + 3 = ?', '8', ['7', '9', '8', '15']), NO_LEVERS)) expect(`${l.when} ${l.does}`).not.toMatch(/\d/);
  });
});

describe('this wrong answer, then this lever', () => {
  const add = fact('recall', '7 + 3 = ?', '10', ['21', '10', '9', '12']);
  it.each([
    ['21', 'wrong_operation', MODEL_LEVER],
    ['9', 'one_less', MODEL_LEVER],
    ['12', 'other_number', MODEL_LEVER],
  ])('7 + 3 answered %s: %s, then %s', (picked, miss, lever) => {
    expect(fastFactMiss(add, { picked })).toBe(miss);
    expect(nextLever(fastFactLevers(add, { ...NO_LEVERS, picked: [picked] }), miss)).toBe(lever);
  });
  it('once the model is pulled, the drop comes next', () => {
    expect(nextLever(fastFactLevers(add, { ...NO_LEVERS, picked: ['9'], pulled: [MODEL_LEVER] }), 'one_less')).toBe(DROP_LEVER);
  });
  it('a miscount is answered by spreading the picture', () => {
    const c = stars(5);
    expect(fastFactMiss(c, { picked: '4' })).toBe('one_less');
    expect(nextLever(fastFactLevers(c, { ...NO_LEVERS, picked: ['4'] }), 'one_less')).toBe(SPREAD_LEVER);
  });
  it('a wrong word on a four-choice menu is answered by the drop', () => {
    const c = fact('apply', 'Which state has Denver as its capital?', 'Colorado', ['Utah', 'Colorado', 'Kansas', 'Ohio']);
    expect(fastFactMiss(c, { picked: 'Utah' })).toBe('other_choice');
    expect(nextLever(fastFactLevers(c, { ...NO_LEVERS, picked: ['Utah'] }), 'other_choice')).toBe(DROP_LEVER);
  });
  it('every catalog miss is answered by some lever', () => {
    const entry = getComponentById('fast-fact')!.teachingWorkspace!;
    expect(entry.levers).toBe(true);
    const answered = new Set([stars(4), add].flatMap(c => fastFactLevers(c, NO_LEVERS)).flatMap(l => l.answers ?? []));
    for (const mode of MODES) for (const m of entry.misses![mode]) expect(answered.has(m), `${mode}: ${m}`).toBe(true);
  });
});
