import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock('../geminiClient', () => ({ ai: { models: { generateContent } } }));

import { generateDiSpokenPractice } from './gemini-di-spoken-practice';
import {
  buildPlannedSpokenItems, buildSubjectVerbAgreementItems, hasPlannedCoverage,
  hasSubjectVerbAgreementCoverage, parseSpokenPlan, spokenSourceTokens,
} from './spokenPracticePlan';
import {
  contextFor, findAnswerLeaks, findChoiceMenuDefects, findConceptDefects, findUnspokenStimulus, itemCue, pronounceCue,
} from '../../primitives/visual-primitives/direct-instruction/diSpokenPracticeScript';

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
  it('removes answer-depicting riddle pictures while retaining the spoken clues and replay', async () => {
    acceptPlan({ task: 'say_answer', closedSet: false, targets: [] });
    const riddles = [
      ['sun', '☀️', 'I shine in the sky during the day. What am I?'],
      ['dog', '🐶', 'I have four legs and bark. What animal am I?'],
      ['apple', '🍎', 'I am a crunchy fruit that grows on a tree. What am I?'],
      ['fish', '🐟', 'I have fins and live in water. What am I?'],
    ].map(([answer, stimulusEmoji, ask]) => ({
      ...raw(answer, answer, ask), stimulusEmoji,
    }));
    generateContent.mockResolvedValueOnce(reply({ title: 'Riddle Time', items: riddles }));

    const data = await gen(
      'say_answer',
      'Solve simple word riddles using context clues and prior vocabulary knowledge',
      { intent: 'Solve simple word riddles using context clues and prior vocabulary knowledge' },
    );

    expect(data.items).toHaveLength(4);
    expect(data.items.every(i => i.stimulusKind === 'none' && i.stimulusEmoji === '')).toBe(true);
    expect(data.items.map(i => i.stimulusText)).toEqual(riddles.map(i => i.ask));
    expect(data.items.every(i => pronounceCue(i).includes(i.ask))).toBe(true);
    expect(findAnswerLeaks(data.items)).toEqual([]);
    expect(findUnspokenStimulus(data.items)).toEqual([]);
  });

  it('keeps a picture that supplies non-answer evidence for the spoken question', async () => {
    acceptPlan({ task: 'say_answer', closedSet: false, targets: [] });
    generateContent.mockResolvedValueOnce(reply({ items: Array.from({ length: 4 }, (_, index) => ({
      ...raw('dog', index % 2 ? 'wag' : 'bark', 'Look at this dog. What can it do?'),
      stimulusEmoji: '🐕',
    })) }));

    const data = await gen('say_answer', 'Use a picture to name an animal action');
    expect(data.items).toHaveLength(4);
    expect(data.items.every(i => i.stimulusKind === 'emoji' && i.stimulusEmoji === '🐕')).toBe(true);
  });

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
describe('DSP-4 subject-verb agreement completion', () => {
  const agreementObjective =
    'Apply basic subject-verb agreement in present tense (singular/plural subjects)';
  const agreementPlan = {
    task: 'subject_verb_agreement', closedSet: false, conceptStatement: '', targets: [],
  };

  it('builds a nonempty singular/plural contrast without speaking either answer first', async () => {
    acceptPlan(agreementPlan);
    const data = await gen('say_answer', agreementObjective);

    expect(data.challengeType).toBe('say_answer');
    expect(data.items).toHaveLength(4);
    expect(new Set(data.items.map(item => item.agreementNumber)))
      .toEqual(new Set(['singular', 'plural']));
    expect(hasSubjectVerbAgreementCoverage(data.items, 4)).toBe(true);
    expect(findAnswerLeaks(data.items)).toEqual([]);
    expect(findUnspokenStimulus(data.items)).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(2); // plan + review; item keys are code-owned

    for (const item of data.items) {
      expect(item.expectedAnswer).toBe(item.agreementNumber === 'singular' ? 'is' : 'are');
      expect(item.ask).toContain(item.stimulusText);
      expect(item.ask.toLowerCase()).not.toMatch(new RegExp(`\\b${item.expectedAnswer}\\b`));
      expect(item.correctionBody).toContain(`Use ${item.expectedAnswer} with`);
      expect(itemCue(item, { opening: false, howToPlay: false }))
        .toContain(`My turn: ${item.correctionBody} Your turn. ${item.ask}`);
    }
  });

  it('coverage rejects a lost number contrast and a desynchronized grammatical key', () => {
    const items = buildSubjectVerbAgreementItems(4);
    expect(hasSubjectVerbAgreementCoverage(items, 4)).toBe(true);
    expect(hasSubjectVerbAgreementCoverage(items.filter(item => item.agreementNumber === 'singular'), 2))
      .toBe(false);
    expect(hasSubjectVerbAgreementCoverage(
      items.map((item, index) => index === 0 ? { ...item, expectedAnswer: 'are' } : item),
      4,
    )).toBe(false);
  });
});

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

// ── explain_concept — an idea stamped in by code, or written per instance ────

/**
 * The two frozen grade-1 failures this mode closes (lesson-bench 26(a)/(b),
 * qa/di item 36): `…ah5w` obj2 is ONE concept session-wide over varied
 * instances, `…f00i` obj3 is a rule PER instance. What is being tested is the
 * split for each: code owns the anchor set (named) or the model writes it
 * (open), code checks SHAPE, and a second review call checks MEANING.
 */
const explainObjective = 'Explain what the equal sign means using the balance scale example';
const CONCEPT = 'The equal sign means both sides have the same amount.';
const namedConceptPlan = (over: Record<string, unknown> = {}) => ({
  task: 'explain_concept', closedSet: true, conceptStatement: CONCEPT,
  targets: [{
    stimulusId: spokenSourceTokens([explainObjective]).find(t => t.text === 'equal')?.id,
    sourceId: 's1', stimulusText: '', stimulusEmoji: '',
    expectedAnswer: 'both sides the same', alsoAccept: 'balanced, equal amounts',
  }],
  ...over,
});
const instance = (stimulusText: string, spoken: string) => ({
  stimulusText, ask: `${spoken}. Look at the equal sign. What does the equal sign tell us?`,
  expectedAnswer: '', alsoAccept: '', conceptStatement: '',
  acceptRule: 'Any words that say the two sides match count.',
  signatureError: 'Saying the sum is NOT an explanation.',
  correctionBody: `${CONCEPT} ${spoken}, so the two sides match.`,
});
const EQUAL_DRAW = [
  instance('3 + 2 = 5', 'Three plus two equals five'),
  instance('4 = 4', 'Four equals four'),
  instance('1 + 1 = 2', 'One plus one equals two'),
  instance('5 = 2 + 3', 'Five equals two plus three'),
];
const conceptReview = (rejectedIds: string[] = [], sessionValid = true) =>
  reply({ rejectedIds, sessionValid, reason: sessionValid ? 'Concept true; anchors mean it.' : 'Instances repeat.' });
const explainGen = (
  plan: unknown, draws: Array<{ items: unknown[]; review: { text: string } }>,
  objectiveText = explainObjective,
) => {
  acceptPlan(plan);
  for (const d of draws) {
    generateContent.mockResolvedValueOnce(reply({ title: 'Say Why', items: d.items }));
    generateContent.mockResolvedValueOnce(d.review);
  }
  return generateDiSpokenPractice('Understanding the equal sign with balance scales', '1st grade',
    { objectiveText, targetEvalMode: 'explain_concept' });
};

describe('explain_concept — the named-concept session (ah5w)', () => {
  it('stamps the planned sentence and anchors into every instance the model writes', async () => {
    const data = await explainGen(namedConceptPlan(), [{ items: EQUAL_DRAW, review: conceptReview() }]);
    expect(data.challengeType).toBe('explain_concept');
    expect(data.items).toHaveLength(4);
    for (const i of data.items) {
      expect(i.responseClass).toBe('concept_statement');
      expect(i.conceptStatement).toBe(CONCEPT);
      expect(i.expectedAnswer).toBe('both sides the same');
      expect(i.alternates).toEqual(['balanced', 'equal amounts']);
      expect(i.stimulusKind).toBe('text');
      const cue = itemCue(i, { opening: false, howToPlay: false });
      expect(cue).toContain(`The idea they must express: "${CONCEPT}"`);
      expect(cue).toContain('say exactly: "Yes, the equal sign means both sides have the same amount."');
      expect(contextFor(i)).toEqual({ challengeType: 'explain_concept', stimulus: i.stimulusText });
    }
    expect(new Set(data.items.map(i => i.stimulusText)).size).toBe(4);
    expect(findAnswerLeaks(data.items)).toEqual([]);
    expect(findConceptDefects(data.items)).toEqual([]);
    expect(findUnspokenStimulus(data.items)).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4); // plan, plan review, one draw, concept review
  });

  it('ships NOTHING when the instances repeat — a concept over one equation is recall', async () => {
    const repeated = [EQUAL_DRAW[0], EQUAL_DRAW[0], EQUAL_DRAW[0], EQUAL_DRAW[0]];
    const data = await explainGen(namedConceptPlan(),
      [{ items: repeated, review: conceptReview() }, { items: repeated, review: conceptReview() }]);
    expect(data.items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(6);
  });

  it('drops an ask that models the concept before asking — THE leak', async () => {
    const leaky = EQUAL_DRAW.map(i => ({
      ...i, ask: `${CONCEPT} ${i.ask}`,
    }));
    const data = await explainGen(namedConceptPlan(),
      [{ items: leaky, review: conceptReview() }, { items: leaky, review: conceptReview() }]);
    expect(data.items).toEqual([]);
  });

  it('refuses the plan when a named concept carries no sentence, or a sentence-length anchor', () => {
    const sources = [explainObjective];
    expect(() => parseSpokenPlan(namedConceptPlan({ conceptStatement: '' }), sources))
      .toThrow(/conceptStatement/);
    expect(() => parseSpokenPlan(namedConceptPlan({
      targets: [{ ...namedConceptPlan().targets[0], expectedAnswer: 'the equal sign means both sides are the same' }],
    }), sources)).toThrow(/Ungrounded or unsupported/);
    expect(() => parseSpokenPlan({ ...namedConceptPlan(), closedSet: false, targets: [] }, sources))
      .toThrow(/no session-wide conceptStatement/);
    expect(parseSpokenPlan(namedConceptPlan(), sources).conceptStatement).toBe(CONCEPT);
  });

  it('refuses a compare_choice PIN over an explain objective — a menu cannot launder a proposition', async () => {
    generateContent.mockResolvedValue(reply(namedConceptPlan()));
    const data = await generateDiSpokenPractice('the equal sign', '1st grade',
      { objectiveText: explainObjective, targetEvalMode: 'compare_choice' });
    expect(data.items).toEqual([]);
  });
});

describe('explain_concept — the per-instance session (f00i)', () => {
  const rule = (stimulusText: string, spoken: string, concept: string, anchor: string, also: string) => ({
    stimulusText, ask: `${spoken}. What is the rule of this pattern?`,
    expectedAnswer: anchor, alsoAccept: also, conceptStatement: concept,
    acceptRule: 'Saying what gets added each time counts.',
    signatureError: 'Saying the next number is NOT the rule.',
    correctionBody: `The rule is ${anchor}.`,
  });
  const PATTERN_DRAW = [
    rule('2, 4, 6, 8', 'Two, four, six, eight', 'This pattern grows by adding two each time.', 'plus two', 'add two'),
    rule('red, blue, red, blue', 'Red, blue, red, blue', 'The pattern repeats red then blue over and over.', 'red then blue', 'same two colors again'),
    rule('5, 10, 15, 20', 'Five, ten, fifteen, twenty', 'This pattern grows by adding five each time.', 'plus five', 'counting by fives'),
    rule('1, 2, 3, 4', 'One, two, three, four', 'This pattern grows by adding one each time.', 'plus one', 'counting up'),
  ];
  const openPlan = { task: 'explain_concept', closedSet: false, conceptStatement: '', targets: [] };
  const patternGen = (draws: Array<{ items: unknown[]; review: { text: string } }>) =>
    explainGen(openPlan, draws, 'Explain the secret rule behind a repeating or growing pattern');

  it('ships each instance with its own reviewed rule', async () => {
    const data = await patternGen([{ items: PATTERN_DRAW, review: conceptReview() }]);
    expect(data.items).toHaveLength(4);
    expect(data.items.map(i => i.conceptStatement)).toEqual(PATTERN_DRAW.map(r => r.conceptStatement));
    expect(data.items.map(i => i.expectedAnswer)).toEqual(['plus two', 'red then blue', 'plus five', 'plus one']);
    expect(data.items.every(i => i.responseClass === 'concept_statement')).toBe(true);
    expect(findConceptDefects(data.items)).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('drops the items the semantic review rejects and redraws when the session goes thin', async () => {
    const data = await patternGen([
      { items: PATTERN_DRAW, review: conceptReview(['dsp-2', 'dsp-4']) },
      { items: PATTERN_DRAW, review: conceptReview() },
    ]);
    expect(data.items).toHaveLength(4);
    expect(generateContent).toHaveBeenCalledTimes(6);
  });

  it('ships NOTHING when the review rejects the session twice', async () => {
    const data = await patternGen([
      { items: PATTERN_DRAW, review: conceptReview([], false) },
      { items: PATTERN_DRAW, review: conceptReview([], false) },
    ]);
    expect(data.items).toEqual([]);
  });

  it('drops an instance whose anchor is the pattern read back — ECHO would be un-refusable', async () => {
    const echoing = PATTERN_DRAW.map(r => ({ ...r, expectedAnswer: r.stimulusText.replace(/,/g, ''), alsoAccept: '' }));
    const data = await patternGen([
      { items: echoing, review: conceptReview() }, { items: echoing, review: conceptReview() },
    ]);
    expect(data.items).toEqual([]);
  });
});

describe('explain_concept — the yield levers the first pilot forced (3/6 fresh draws shipped nothing)', () => {
  const openPlan = { task: 'explain_concept', closedSet: false, conceptStatement: '', targets: [] };
  const ruleItem = (n: number) => ({
    stimulusText: `${n}, ${n * 2}, ${n * 3}, ${n * 4}`,
    ask: `Look: ${n}, ${n * 2}, ${n * 3}, ${n * 4}. What is the rule of this pattern?`,
    expectedAnswer: `plus ${n}`, alsoAccept: `add ${n}`,
    conceptStatement: `This pattern grows by adding ${n} each time.`,
    acceptRule: 'Saying what gets added each time counts.', signatureError: 'The next number is NOT the rule.',
    correctionBody: `The rule is add ${n}.`,
  });

  it('asks for spare capacity and ships `count` — the reviewer can reject two without emptying the session', async () => {
    acceptPlan(openPlan);
    // The model is asked for SIX (count 4 + 2); the review rejects two; four ship.
    generateContent.mockResolvedValueOnce(reply({ title: 'Say Why', items: [1, 2, 3, 4, 5, 6].map(ruleItem) }));
    generateContent.mockResolvedValueOnce(conceptReview(['dsp-2', 'dsp-5']));
    const data = await generateDiSpokenPractice('patterns', 'Grade 1',
      { objectiveText: 'Explain the secret rule behind a repeating or growing pattern', targetEvalMode: 'explain_concept' });
    expect(data.items).toHaveLength(4);
    expect(data.items.map(i => i.id)).toEqual(['dsp-1', 'dsp-2', 'dsp-3', 'dsp-4']);
    expect(data.items.map(i => i.expectedAnswer)).toEqual(['plus 1', 'plus 3', 'plus 4', 'plus 6']);
    // The schema the model was handed asked for six.
    const draw = generateContent.mock.calls[2][0] as { config: { responseSchema: { properties: { items: { maxItems: string } } } } };
    expect(draw.config.responseSchema.properties.items.maxItems).toBe('6');
    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  it('POOLS survivors across the two attempts instead of replacing them', async () => {
    acceptPlan(openPlan);
    generateContent.mockResolvedValueOnce(reply({ items: [1, 2, 3, 4].map(ruleItem) }));
    generateContent.mockResolvedValueOnce(conceptReview(['dsp-1', 'dsp-2', 'dsp-3'])); // one survives
    generateContent.mockResolvedValueOnce(reply({ items: [4, 5, 6].map(ruleItem) })); // 4 repeats the survivor
    generateContent.mockResolvedValueOnce(conceptReview());
    const data = await generateDiSpokenPractice('patterns', 'Grade 1',
      { objectiveText: 'Explain the secret rule behind a repeating or growing pattern', targetEvalMode: 'explain_concept' });
    // 4 (kept from attempt 1) + 5 + 6, deduped by instance: three ship, not "3 of 4, thin".
    expect(data.items.map(i => i.expectedAnswer)).toEqual(['plus 4', 'plus 5', 'plus 6']);
    expect(generateContent).toHaveBeenCalledTimes(6);
  });

  it('re-reads an `unsupported` plan ONCE against an explicit pin, then lets the refusal stand', async () => {
    const unsupported = { task: 'unsupported', closedSet: false, conceptStatement: '', targets: [] };
    // First pass: unsupported under the explain pin → re-planned; second pass plans it.
    generateContent.mockResolvedValueOnce(reply(unsupported));
    acceptPlan(openPlan);
    generateContent.mockResolvedValueOnce(reply({ items: [1, 2, 3, 4].map(ruleItem) }));
    generateContent.mockResolvedValueOnce(conceptReview());
    const data = await generateDiSpokenPractice('patterns', 'Grade 1',
      { objectiveText: 'Explain the secret rule behind a repeating or growing pattern', targetEvalMode: 'explain_concept' });
    expect(data.items).toHaveLength(4);
    expect(generateContent).toHaveBeenCalledTimes(5);
    const feedback = generateContent.mock.calls[1][0] as { contents: string };
    expect(feedback.contents).toContain('Task unsupported conflicts with the requested mode explain_concept');

    // Twice unsupported → nothing ships, and no third plan is drawn.
    generateContent.mockReset();
    generateContent.mockResolvedValue(reply(unsupported));
    const refused = await generateDiSpokenPractice('adding', 'Grade 2',
      { objectiveText: 'Explain how to solve a two-digit addition problem step by step', targetEvalMode: 'explain_concept' });
    expect(refused.items).toEqual([]);
    expect(generateContent).toHaveBeenCalledTimes(3); // plan, plan, review of the second
  });
});
