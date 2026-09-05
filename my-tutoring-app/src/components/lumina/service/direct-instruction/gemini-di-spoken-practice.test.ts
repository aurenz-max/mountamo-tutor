import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));

import { generateDiSpokenPractice } from './gemini-di-spoken-practice';
import { buildPlannedSpokenItems, hasPlannedCoverage, parseSpokenPlan, spokenSourceTokens } from './spokenPracticePlan';
import { contextFor, findAnswerLeaks, findUnspokenStimulus, itemCue, pronounceCue }
  from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

const objective = 'Identify the plus sign (+) and equal sign (=) as math symbols';
const target = (stimulusText: string, expectedAnswer: string, sourceQuote = objective) => ({
  stimulusId: spokenSourceTokens([sourceQuote]).find(t => t.text === stimulusText)?.id, sourceId: 's1', stimulusText: '', expectedAnswer, stimulusEmoji: '', alsoAccept: '',
});
const named = (targets = [target('+', 'plus sign'), target('=', 'equal sign')]) => ({
  task: 'visual_naming', closedSet: true, targets,
});
const reply = (value: unknown) => ({ text: JSON.stringify(value) });
const acceptPlan = (value: unknown = named()) => {
  generateContent.mockResolvedValueOnce(reply(value));
  generateContent.mockResolvedValueOnce(reply({ valid: true, reason: 'All targets match the objective.' }));
};
const gen = (targetEvalMode = 'say_answer', objectiveText = objective, extra = {}) =>
  generateDiSpokenPractice('addition', 'kindergarten', { objectiveText, targetEvalMode, ...extra });
const raw = (stimulusText: string, expectedAnswer: string, ask: string) => ({
  stimulusText, expectedAnswer, ask, correctionBody: `The answer is ${expectedAnswer}.`,
});

beforeEach(() => { generateContent.mockReset(); });

describe('named target ownership through the generation boundary', () => {
  it('covers both original symbols with synchronized stimuli, judgments and corrections', async () => {
    acceptPlan();
    const data = await gen();
    expect(data.challengeType).toBe('say_answer');
    expect(data.items).toHaveLength(4);
    expect(new Set(data.items.slice(0, 2).map(i => i.stimulusText))).toEqual(new Set(['+', '=']));
    for (const i of data.items) {
      const answer = i.stimulusText === '+' ? 'plus sign' : 'equal sign';
      expect(i.expectedAnswer).toBe(answer);
      expect(i.correctionBody).toBe(`This is called ${answer}.`);
      expect(i.stimulusKind).toBe('text');
      expect(i.stimulusRole).toBe('visual_target');
      expect(itemCue(i, { opening: true, howToPlay: false })).toContain(`The correct answer is "${answer}"`);
      expect(pronounceCue(i)).toBe('');
      expect(contextFor(i)).toEqual({ challengeType: 'say_answer' });
    }
    expect(findAnswerLeaks(data.items)).toEqual([]);
    expect(findUnspokenStimulus(data.items)).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(2); // no independent item generation to corrupt '='
  });

  it('covers another set, independent of literals and objective word order', async () => {
    const text = 'Say the names of ! and ?.';
    acceptPlan(named([target('!', 'exclamation mark', text), target('?', 'question mark', text)]));
    const data = await gen('say_answer', text);
    expect(new Set(data.items.map(i => i.stimulusText))).toEqual(new Set(['!', '?']));
    expect(new Set(data.items.map(i => i.expectedAnswer))).toEqual(new Set(['exclamation mark', 'question mark']));
  });

  it('rejects the original incompatible pin rather than relabeling recall as decoding', async () => {
    acceptPlan();
    const data = await gen('read_aloud');
    expect(data.items).toEqual([]);
    expect(data.challengeType).toBe('read_aloud');
  });

  it.each(['mixed', 'say_answer|read_aloud'])('chooses a coherent allowed task for %s', async pin => {
    acceptPlan();
    const data = await gen(pin);
    expect(data.challengeType).toBe('say_answer');
    expect(data.items).toHaveLength(4);
  });

  it('replans after an independent review catches the missing named member', async () => {
    generateContent.mockResolvedValueOnce(reply(named([target('+', 'plus sign')])));
    generateContent.mockResolvedValueOnce(reply({ valid: false, reason: 'The equal sign is missing.' }));
    acceptPlan();
    const data = await gen();
    expect(new Set(data.items.map(i => i.stimulusText))).toEqual(new Set(['+', '=']));
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('exhausted plan reviews produce an empty session, never an unscoped fallback', async () => {
    for (let i = 0; i < 2; i++) {
      generateContent.mockResolvedValueOnce(reply(named([target('+', 'equal sign')])));
      generateContent.mockResolvedValueOnce(reply({ valid: false, reason: 'Wrong glyph.' }));
    }
    expect((await gen()).items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('post-gate loss of a target cannot ship as successful coverage', async () => {
    // Even a mistakenly approved mapping cannot put the answer on screen.
    acceptPlan(named([target('+', 'plus'), target('equal', 'equal')]));
    expect((await gen()).items).toEqual([]);
  });

  it('coverage checks the actual surviving stimulus, not just target IDs or labels', () => {
    const plan = parseSpokenPlan(named(), [objective]);
    const items = buildPlannedSpokenItems(plan, 4);
    expect(hasPlannedCoverage(plan, items, 4)).toBe(true);
    expect(hasPlannedCoverage(plan, items.filter(i => i.stimulusText === '+'), 4)).toBe(false);
    const corrupt = items.map(i => i.stimulusText === '=' ? { ...i, stimulusText: '_' } : i);
    expect(hasPlannedCoverage(plan, corrupt, 4)).toBe(false);
    expect(buildPlannedSpokenItems(plan, 1)).toEqual([]);
  });

  it('rejects fabricated grounding and duplicate targets without silently dropping them', () => {
    expect(() => parseSpokenPlan(named([target('?', 'question mark', 'not in input')]), [objective])).toThrow();
    expect(() => parseSpokenPlan(named([target('+', 'plus'), target('+', 'plus sign')]), [objective])).toThrow();
  });
});

describe('neighboring tasks retain their delivery and identity', () => {
  it('reads an explicit word/numeral set with digit normalization and no recall affordance', async () => {
    const text = 'Read the printed word cat and the numeral 2 aloud.';
    acceptPlan({ task: 'read_aloud', closedSet: true,
      targets: [target('cat', 'cat', text), target('2', 'two', text)] });
    const data = await gen('read_aloud', text);
    expect(new Set(data.items.map(i => i.expectedAnswer))).toEqual(new Set(['cat', 'two']));
    expect(data.items.every(i => i.answerSource === 'decode' && pronounceCue(i) === '')).toBe(true);
  });

  it('keeps the spoken-problem requirement for listening arithmetic', async () => {
    acceptPlan({ task: 'say_answer', closedSet: false, targets: [] });
    generateContent.mockResolvedValueOnce(reply({ items: Array.from({ length: 4 }, () =>
      raw('2 + 1', 'three', 'Two plus one. How many altogether?')) }));
    const data = await gen('say_answer', 'Add within five');
    expect(data.items).toHaveLength(4);
    expect(findUnspokenStimulus([{ ...data.items[0], ask: 'What is the answer?' }])).toHaveLength(1);
    expect(pronounceCue(data.items[0])).toContain('2 + 1');
  });

  it('retries a partial generic session and refuses one still below the minimum', async () => {
    acceptPlan({ task: 'say_answer', closedSet: false, targets: [] });
    generateContent.mockResolvedValue(reply({ items: [raw('2 + 1', 'three', 'Two plus one. How many?')] }));
    expect((await gen('say_answer', 'Add within five')).items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('derives counting answers from displayed objects', async () => {
    acceptPlan({ task: 'count_and_say', closedSet: false, targets: [] });
    generateContent.mockResolvedValueOnce(reply({ items: [2, 3, 4, 5].map(stimulusCount => ({
      ...raw('bears', '', 'How many bears?'), stimulusCount, stimulusEmoji: '🐻',
    })) }));
    const data = await gen('count_and_say', 'Count groups of bears within five');
    expect(data.items.map(i => i.expectedAnswer)).toEqual(['two', 'three', 'four', 'five']);
    expect(data.items.every(i => i.stimulusKind === 'objects')).toBe(true);
  });
});
