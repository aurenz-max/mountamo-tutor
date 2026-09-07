import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));

import { generateDiSpokenPractice } from './gemini-di-spoken-practice';
import { buildPlannedSpokenItems, hasPlannedCoverage, parseSpokenPlan, spokenSourceTokens } from './spokenPracticePlan';
import { contextFor, findAnswerLeaks, findChoiceMenuDefects, findUnspokenStimulus, itemCue, pronounceCue }
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
    generateContent.mockResolvedValue(reply(named()));
    const data = await gen('read_aloud');
    expect(data.items).toEqual([]);
    expect(data.challengeType).toBe('read_aloud');
  });

  it('retries a plan-mode conflict inside the planning budget', async () => {
    generateContent.mockResolvedValueOnce(reply({ task: 'read_aloud', closedSet: false, targets: [] }));
    acceptPlan();
    const data = await gen();
    expect(data.items).toHaveLength(4);
    expect(generateContent).toHaveBeenCalledTimes(3);
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

  it('reviews open/empty plans too, so a misclassified named set cannot bypass coverage', async () => {
    generateContent.mockResolvedValueOnce(reply({ task: 'say_answer', closedSet: false, targets: [] }));
    generateContent.mockResolvedValueOnce(reply({ valid: false, reason: 'This objective explicitly requires + and =.' }));
    acceptPlan();
    const data = await gen();
    expect(new Set(data.items.map(i => i.stimulusText))).toEqual(new Set(['+', '=']));
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('owns the glyph even when a model redundantly emits a corrupted copy', async () => {
    const plan = named();
    plan.targets[1].stimulusText = '_';
    acceptPlan(plan);
    const data = await gen();
    expect(data.items.some(i => i.stimulusText === '=')).toBe(true);
    expect(data.items.some(i => i.stimulusText === '_')).toBe(false);
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

  it('can name pictures without printing or pronouncing their labels', async () => {
    const text = 'Name the cat and dog pictures.';
    acceptPlan(named([
      { ...target('cat', 'cat', text), stimulusId: 'picture', stimulusText: 'cat', stimulusEmoji: '🐈' },
      { ...target('dog', 'dog', text), stimulusId: 'picture', stimulusText: 'dog', stimulusEmoji: '🐕' },
    ]));
    const data = await gen('say_answer', text);
    expect(data.items).toHaveLength(4);
    expect(data.items.every(i => i.stimulusKind === 'emoji' && pronounceCue(i) === '')).toBe(true);
    expect(findAnswerLeaks(data.items)).toEqual([]);
  });

  it('rejects fabricated grounding and duplicate targets without silently dropping them', () => {
    expect(() => parseSpokenPlan(named([target('?', 'question mark', 'not in input')]), [objective])).toThrow();
    expect(() => parseSpokenPlan(named([target('+', 'plus'), target('+', 'plus sign')]), [objective])).toThrow();
  });

  it('expands the session to fit five required targets instead of truncating to four', async () => {
    const text = 'Name the symbols . , ? ! ;';
    acceptPlan(named([
      target('.', 'period', text), target(',', 'comma', text), target('?', 'question mark', text),
      target('!', 'exclamation mark', text), target(';', 'semicolon', text),
    ]));
    const data = await gen('say_answer', text);
    expect(data.items).toHaveLength(5);
    expect(new Set(data.items.map(i => i.stimulusText))).toEqual(new Set(['.', ',', '?', '!', ';']));
  });

  it('rejects an oversized required set rather than silently slicing it', () => {
    expect(() => parseSpokenPlan(named(Array.from({ length: 7 }, () => target('+', 'plus'))), [objective])).toThrow();
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

// ── compare_choice — code owns the MENU, the model writes the pairs ──────────

/**
 * The shape both frozen `kindergarten-compare-attributes` draws refused with
 * `items: []` (lesson-bench item 30c). What is being tested is the split: the
 * plan enumerates the four words the objective NAMES and the generator has to
 * come back having asked all four — a session that quietly covers two of them
 * is the named-set failure, not a thin session.
 */
const compareObjective =
  'Describe the size and weight of objects using words like longer, shorter, heavier, and lighter.';
const MENU = ['longer', 'shorter', 'heavier', 'lighter'];

const menuTarget = (word: string) => ({
  stimulusId: spokenSourceTokens([compareObjective]).find(t => t.text === word)?.id,
  sourceId: 's1', stimulusText: '', expectedAnswer: word, stimulusEmoji: '', alsoAccept: '',
});
const menuPlan = (targets = MENU.map(menuTarget)) =>
  ({ task: 'compare_choice', closedSet: true, targets });

const pairAsk = (a: string, b: string, about: string) =>
  `Here is ${a}, and here is ${b}. Is ${about} longer, shorter, heavier, or lighter?`;
const pairRaw = (
  a: string, ae: string, b: string, be: string, about: string, expectedAnswer: string,
) => ({
  stimulusText: a, stimulusEmoji: ae, stimulusText2: b, stimulusEmoji2: be,
  ask: pairAsk(a, b, about), expectedAnswer,
  correctionBody: `${about} is ${expectedAnswer} than the other one.`,
});
const FULL_MENU_DRAW = [
  pairRaw('a feather', '🪶', 'a rock', '🪨', 'the rock', 'heavier'),
  pairRaw('a pencil', '✏️', 'a crayon', '🖍️', 'the pencil', 'longer'),
  pairRaw('an ant', '🐜', 'an elephant', '🐘', 'the ant', 'lighter'),
  pairRaw('a train', '🚂', 'a car', '🚗', 'the car', 'shorter'),
];
const compareGen = (items: unknown[]) => {
  generateContent.mockResolvedValueOnce(reply(menuPlan()));
  generateContent.mockResolvedValueOnce(reply({ valid: true, reason: 'All four words are required.' }));
  for (const draw of items) generateContent.mockResolvedValueOnce(reply(draw));
  return generateDiSpokenPractice(
    "Compare and describe objects' attributes (longer/shorter, heavier/lighter)",
    'kindergarten',
    { objectiveText: compareObjective, targetEvalMode: 'compare_choice' },
  );
};

describe('compare_choice — the closed-set comparative session', () => {
  it('ships a pair session that asks every word the objective named', async () => {
    const data = await compareGen([{ title: 'Which Word?', items: FULL_MENU_DRAW }]);
    expect(data.challengeType).toBe('compare_choice');
    expect(data.items).toHaveLength(4);
    expect(new Set(data.items.map(i => i.expectedAnswer))).toEqual(new Set(MENU));
    for (const i of data.items) {
      expect(i.stimulusKind).toBe('pair');
      expect(i.responseClass).toBe('closed_set_choice');
      expect(i.choices).toEqual(MENU);
      expect(i.stimulusEmoji).toBeTruthy();
      expect(i.stimulusEmoji2).toBeTruthy();
      expect(itemCue(i, { opening: false, howToPlay: false }))
        .toContain('The learner is choosing one word from: "longer", "shorter", "heavier", "lighter".');
      expect(contextFor(i).stimulus).toBe(`${i.stimulusText} and ${i.stimulusText2}`);
      expect(pronounceCue(i)).toContain(`${i.stimulusText} and ${i.stimulusText2}`);
    }
    expect(findAnswerLeaks(data.items)).toEqual([]);
    expect(findChoiceMenuDefects(data.items)).toEqual([]);
    expect(findUnspokenStimulus(data.items)).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(3); // plan, review, one item draw
  });

  it('ships NOTHING when every ask narrowed the menu to a two-way guess', async () => {
    // "Is the rock longer or heavier?" — the shape the wxyu draw's own intent
    // proposed. Dropped by the menu gate, both attempts, so the session refuses.
    const narrowed = FULL_MENU_DRAW.map(item => ({
      ...item, ask: item.ask.replace('longer, shorter, heavier, or lighter', 'longer or heavier'),
    }));
    const data = await compareGen([{ items: narrowed }, { items: narrowed }]);
    expect(data.items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4); // plan, review, two item draws
  });

  it('refuses a session that covers only part of the named menu, however clean', async () => {
    // Three well-formed items that would pass every other gate — and leave
    // "shorter" untaught. A partial menu is the failure, not a thin session.
    const partial = FULL_MENU_DRAW.slice(0, 3);
    const data = await compareGen([{ items: partial }, { items: partial }]);
    expect(data.items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('refuses a pair with nothing drawn on one side', async () => {
    const halfDrawn = FULL_MENU_DRAW.map(item => ({ ...item, stimulusEmoji2: '' }));
    const data = await compareGen([{ items: halfDrawn }, { items: halfDrawn }]);
    expect(data.items).toEqual([]);
  });

  it('refuses the plan itself when the objective never enumerated the words', async () => {
    generateContent.mockResolvedValue(reply({ task: 'compare_choice', closedSet: false, targets: [] }));
    const data = await generateDiSpokenPractice('measurement', 'kindergarten', {
      objectiveText: 'Compare two objects and describe them.', targetEvalMode: 'compare_choice',
    });
    expect(data.items).toEqual([]);
    expect(data.description).toBe('No matching practice is available for this task.');
  });
});
