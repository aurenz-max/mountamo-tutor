/**
 * The content-generic pack's gates. A bespoke pack's safety lives in its
 * hand-authored script; this one's lives in code, because the script is
 * generated — so these are the tests that stand in for a human reading every
 * line before it ships.
 */

import { describe, it, expect } from 'vitest';
import { findSentinelCollisions } from '../../../hooks/judgedScriptContract';
import {
  buildSpokenItem,
  completeCue,
  conceptAffirmForm,
  contextFor,
  deriveResponseClass,
  diSpokenPracticePackBase,
  findAnswerLeaks,
  findArithmeticMismatches,
  findChoiceMenuDefects,
  findConceptDefects,
  findPrintedNumerals,
  findUnspokenStimulus,
  gateSpokenItems,
  itemCue,
  moveOnCue,
  normalizeConceptAnchors,
  normalizeSpokenAnswer,
  pronounceCue,
  reconcileConceptAnchors,
  withSpokenPracticeAction,
  type SpokenPracticeItem,
} from './diSpokenPracticeScript';

const item = (over: Partial<SpokenPracticeItem> = {}): SpokenPracticeItem => ({
  id: 'dsp-1',
  mode: 'say_answer',
  action: 'say_answer',
  answerKind: 'voice',
  responseClass: 'short_spoken_word',
  stimulusKind: 'text',
  answerSource: 'recall',
  stimulusText: '2 + 1',
  stimulusEmoji: '',
  stimulusCount: 0,
  ask: 'Two plus one. Your turn. How many altogether?',
  howToPlay: 'I say a fact, and you say the answer out loud!',
  expectedAnswer: 'three',
  alternates: [],
  acceptRule: 'Counting aloud that ENDS on the answer counts as that answer.',
  signatureError: 'The number in the question said back is NOT the answer.',
  correctionBody: 'Two and one more makes three.',
  ...over,
});

describe('the shared DI action contract', () => {
  it('upgrades a legacy item with the exact generated ask and voice modality', () => {
    const upgraded = withSpokenPracticeAction(item());
    expect(upgraded.actionContract.instruction).toBe(upgraded.ask);
    expect(upgraded.actionContract.label).toBe('Say the Answer');
    expect(upgraded.answerKind).toBe(upgraded.actionContract.answerKind);
  });

  it('is attached at the generation boundary for every new item', () => {
    const built = buildSpokenItem({
      stimulusText: 'bears',
      stimulusEmoji: 'bear',
      stimulusCount: 3,
      ask: 'Count the bears. How many bears?',
      expectedAnswer: 'ignored',
      correctionBody: 'There are three bears.',
    }, 0, 'count_and_say');
    expect(built?.actionContract).toMatchObject({
      id: 'count_and_say',
      label: 'Count and Say',
      answerKind: 'voice',
      instruction: 'Count the bears. How many bears?',
    });
  });
});

describe('standing gate 1 — the benched response class, at the generation boundary', () => {
  it('places a short spoken answer', () => {
    expect(deriveResponseClass('say_answer', 'dogs', 'one dog')).toBe('short_spoken_word');
  });

  it('places a number word without being told it is counting', () => {
    expect(deriveResponseClass('say_answer', 'three', '2 + 1')).toBe('number_word_to_20');
  });

  it('REFUSES an open-set answer rather than laundering it through free text', () => {
    // `open_set_word` is a BLOCKED class. A free-text answer field is exactly
    // the shape that would smuggle it into production.
    expect(deriveResponseClass('say_answer', 'because the water turns into steam', 'why?')).toBeNull();
  });

  it('refuses a counting item whose answer is not a number word', () => {
    expect(deriveResponseClass('count_and_say', 'lots', 'bears')).toBeNull();
  });

  it('normalises a bare numeral to the word the child actually says', () => {
    // Regression: the FIRST real generation returned expectedAnswer "2" with
    // alternates ["two"] — the written and spoken forms inverted. Un-normalised,
    // "2" is not a number word, so the item shipped declaring short_spoken_word.
    expect(normalizeSpokenAnswer('2')).toBe('two');
    expect(normalizeSpokenAnswer(' 15 ')).toBe('fifteen');
    expect(normalizeSpokenAnswer('dogs')).toBe('dogs');
    expect(deriveResponseClass('say_answer', normalizeSpokenAnswer('2'), '1 + 1'))
      .toBe('number_word_to_20');
  });

  it('refuses a numeral outside the benched 1-20 range', () => {
    // "twenty-one" is the multi-word build-ahead class (#63); this pack does
    // not gate on that sitting, so the item does not ship.
    expect(deriveResponseClass('say_answer', normalizeSpokenAnswer('42'), '40 + 2')).toBeNull();
  });

  it('reads sentence length off the stimulus for read_aloud', () => {
    expect(deriveResponseClass('read_aloud', 'the cat sat', 'the cat sat')).toBe('sentence_read_aloud');
    expect(deriveResponseClass('read_aloud', 'sam', 'sam')).toBe('short_spoken_word');
  });
});

describe('answer-leak scan — the gate no bespoke pack can run', () => {
  it('is clean on a well-formed item', () => {
    expect(findAnswerLeaks([item()])).toEqual([]);
  });

  it('catches the answer inside the ask', () => {
    const leaks = findAnswerLeaks([item({ ask: 'Two plus one is three. Your turn. How many?' })]);
    expect(leaks).toHaveLength(1);
    expect(leaks[0].field).toBe('ask');
  });

  it('catches the answer inside the printed stimulus on a recall item', () => {
    const leaks = findAnswerLeaks([item({ stimulusText: '2 + 1 = three' })]);
    expect(leaks.map((l) => l.field)).toContain('stimulusText');
  });

  it('catches an ALTERNATE in the ask, not just the primary answer', () => {
    const leaks = findAnswerLeaks([item({
      expectedAnswer: 'couch',
      alternates: ['sofa'],
      ask: 'What do you call the sofa in your house?',
    })]);
    expect(leaks).toHaveLength(1);
  });

  it('EXEMPTS the stimulus on a decode item — there the printed word IS the task', () => {
    // The one distinction that separates a leak from the skill, and the reason
    // `answerSource` is a field rather than a per-primitive convention.
    expect(findAnswerLeaks([item({
      mode: 'read_aloud',
      answerSource: 'decode',
      stimulusText: 'sam',
      expectedAnswer: 'sam',
      ask: 'Your turn. What word?',
    })])).toEqual([]);
  });

  it('still catches a leak in a decode item ASK', () => {
    const leaks = findAnswerLeaks([item({
      mode: 'read_aloud',
      answerSource: 'decode',
      stimulusText: 'sam',
      expectedAnswer: 'sam',
      ask: 'This word is sam. Your turn. What word?',
    })]);
    expect(leaks).toHaveLength(1);
    expect(leaks[0].field).toBe('ask');
  });

  it('matches whole tokens only — "cat" must not fire on "catalog"', () => {
    expect(findAnswerLeaks([item({
      expectedAnswer: 'cat',
      ask: 'Look in the catalog. Your turn. What animal?',
      stimulusText: 'pet',
    })])).toEqual([]);
  });

  it('flags a printed numeral in a counting item', () => {
    expect(findPrintedNumerals([item({
      mode: 'count_and_say',
      stimulusKind: 'objects',
      stimulusText: '5 bears',
    })])).toEqual(['dsp-1']);
  });
});

describe('unspoken-stimulus scan — the ask must SAY the problem', () => {
  it('flags the live-run failure: a question with no problem in it', () => {
    // Run 436dcb5616cb: the tutor asked "Here is a groups problem. What is the
    // answer?" — the child had to READ "2 x 3" off the screen to know the
    // question. The voice is the carrier; the screen is reinforcement.
    const flagged = findUnspokenStimulus([item({
      stimulusText: '2 x 3',
      ask: 'Here is a groups problem. What is the answer?',
    })]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].missing).toEqual(['2', '3']);
  });

  it('accepts an ask that states the problem in number words', () => {
    expect(findUnspokenStimulus([item({
      stimulusText: '2 x 3',
      ask: 'Two groups of three. What is two groups of three?',
    })])).toEqual([]);
  });

  it('accepts digits in the ask too — spoken, both forms reach the child alike', () => {
    expect(findUnspokenStimulus([item({
      stimulusText: '2 + 1',
      ask: 'Two plus one. Your turn. How many altogether?',
    })])).toEqual([]);
  });

  it('flags a listening item whose ask never says the word', () => {
    const flagged = findUnspokenStimulus([item({
      stimulusKind: 'none',
      stimulusText: 'cat',
      ask: 'Change the first sound to /h/. What word now?',
    })]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].missing).toEqual(['cat']);
  });

  it('EXEMPTS the shapes whose stimulus must stay out of the ask', () => {
    // read_aloud: the stimulus IS the answer (leak gate bans it from the ask).
    // count_and_say: the count is the answer. emoji: saying the pictured word
    // would name the thing the child is being asked about.
    expect(findUnspokenStimulus([
      item({ mode: 'read_aloud', answerSource: 'decode', stimulusText: 'sam', expectedAnswer: 'sam', ask: 'Your turn. What word?' }),
      item({ id: 'dsp-2', mode: 'count_and_say', stimulusKind: 'objects', stimulusText: 'bears', expectedAnswer: 'five', ask: 'Count the bears. How many bears?' }),
      item({ id: 'dsp-3', stimulusKind: 'emoji', stimulusText: 'cat', stimulusEmoji: '🐱', expectedAnswer: 'cat', ask: 'What animal is this?' }),
    ])).toEqual([]);
  });
});

describe('arithmetic-consistency scan — the printed fact is the ground truth', () => {
  it('flags an answer that contradicts its own printed fact', () => {
    // The seed pool asks the model to back-solve operands onto a target
    // answer; a bad back-solve ships "3 + 2 → six". The child sees the fact,
    // so the fact wins and the item drops.
    const flagged = findArithmeticMismatches([item({ stimulusText: '3 + 2', expectedAnswer: 'six' })]);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ computed: 'five', claimed: 'six' });
  });

  it('accepts consistent facts across +, −, and x', () => {
    expect(findArithmeticMismatches([
      item({ stimulusText: '3 + 2', expectedAnswer: 'five' }),
      item({ id: 'dsp-2', stimulusText: '7 − 4', expectedAnswer: 'three' }),
      item({ id: 'dsp-3', stimulusText: '2 x 3 = ?', expectedAnswer: 'six' }),
    ])).toEqual([]);
  });

  it('flags a zero result — "zero" spoken is unbenched and must not ship', () => {
    expect(findArithmeticMismatches([item({ stimulusText: '3 − 3', expectedAnswer: 'zero' })]))
      .toHaveLength(1);
  });

  it('ignores non-arithmetic stimuli and non-recall modes', () => {
    expect(findArithmeticMismatches([
      item({ stimulusText: 'cat', expectedAnswer: 'hat' }),
      item({ id: 'dsp-2', mode: 'read_aloud', answerSource: 'decode', stimulusText: '3 + 2', expectedAnswer: 'three plus two' }),
    ])).toEqual([]);
  });
});

describe('runtime state — the full channel, stimulus-side only', () => {
  // Keys here must stay in lockstep with `contextKeys` on the di-spoken-practice
  // catalog entry (catalog/di.ts): ['challengeType', 'stimulus'].
  it('pushes the mode and the stimulus on a recall item', () => {
    expect(contextFor(item())).toEqual({ challengeType: 'say_answer', stimulus: '2 + 1' });
  });

  it('pushes NO stimulus on a decode item — there the stimulus IS the answer', () => {
    // Family rule (di-math-facts): runtime state is echoed far more loosely
    // than a scripted line, so answer-side values never ride it.
    expect(contextFor(item({ mode: 'read_aloud', answerSource: 'decode', stimulusText: 'sam' })))
      .toEqual({ challengeType: 'read_aloud' });
  });

  it('pushes the object word, never the count, on a counting item', () => {
    const state = contextFor(item({
      mode: 'count_and_say',
      stimulusKind: 'objects',
      stimulusText: 'bears',
      stimulusCount: 5,
      expectedAnswer: 'five',
    }));
    expect(state).toEqual({ challengeType: 'count_and_say', stimulus: 'bears' });
    expect(JSON.stringify(state)).not.toContain('5');
    expect(JSON.stringify(state)).not.toContain('five');
  });
});

describe('standing gate 2 — sentinel discipline is structural, not generated', () => {
  it('no cue the tutor may speak opens a sentence with a sentinel', () => {
    const items = [item(), item({ id: 'dsp-2', expectedAnswer: 'four' })];
    const cues = [
      { label: 'itemCue', text: itemCue(items[0], { opening: true, howToPlay: true }) },
      { label: 'moveOnCue', text: moveOnCue(items[0], items[1], { opening: false, howToPlay: true }) },
      { label: 'moveOnCue-last', text: moveOnCue(items[0], null, { opening: false, howToPlay: false }) },
      { label: 'completeCue', text: completeCue() },
      { label: 'pronounceCue', text: pronounceCue(items[0]) },
    ];
    expect(findSentinelCollisions(cues)).toEqual([]);
  });

  it('a generated correction that opens with a sentinel cannot break the contract', () => {
    // Code owns the "My turn:" opener, so the model's text lands mid-sentence
    // where the sentence-scoped verdict scan cannot misread it.
    const cue = itemCue(item({ correctionBody: 'Yes it is three, count again.' }), {
      opening: false,
      howToPlay: false,
    });
    expect(findSentinelCollisions([{ label: 'itemCue', text: cue }])).toEqual([]);
  });

  it('carries both generated judging clauses into the contract verbatim', () => {
    const cue = itemCue(item(), { opening: false, howToPlay: false });
    expect(cue).toContain('Counting aloud that ENDS on the answer counts as that answer.');
    expect(cue).toContain('The number in the question said back is NOT the answer.');
  });

  it('the correction re-asks rather than ending on the answer', () => {
    const cue = itemCue(item(), { opening: false, howToPlay: false });
    expect(cue).toContain('My turn: Two and one more makes three. Your turn. Two plus one.');
  });
});

describe('tap-to-hear never reads the child their own task', () => {
  it('speaks the stimulus on a recall item', () => {
    expect(pronounceCue(item({ stimulusText: 'cat' }))).toContain('"cat"');
  });

  it('returns nothing on a decode item — the stimulus IS the answer there', () => {
    // phonics-blender shipped the opposite of this: its third tap spoke the
    // answer outright. Closed at the source rather than per pack.
    expect(pronounceCue(item({ mode: 'read_aloud', answerSource: 'decode' }))).toBe('');
  });
});

// ── compare_choice — the menu is what makes the exemption safe ───────────────

const MENU = ['longer', 'shorter', 'heavier', 'lighter'];

const pairItem = (over: Partial<SpokenPracticeItem> = {}): SpokenPracticeItem => item({
  mode: 'compare_choice',
  action: 'compare_choice',
  responseClass: 'closed_set_choice',
  stimulusKind: 'pair',
  stimulusText: 'a feather',
  stimulusEmoji: '🪶',
  stimulusText2: 'a rock',
  stimulusEmoji2: '🪨',
  choices: MENU,
  ask: 'Here is a feather, and here is a rock. Is the rock longer, shorter, heavier, or lighter?',
  howToPlay: 'I will show you two things and say the words, and you say the one that fits.',
  expectedAnswer: 'heavier',
  acceptRule: '',
  signatureError: '',
  correctionBody: 'The rock is heavier than the feather.',
  ...over,
});

describe('compare_choice — a spoken menu, and the gate that keeps it closed', () => {
  it('places a menu word in the closed-set class, not open production', () => {
    expect(deriveResponseClass('compare_choice', 'heavier', 'a rock')).toBe('closed_set_choice');
  });

  it('still refuses a menu "word" that is really a sentence', () => {
    expect(deriveResponseClass('compare_choice', 'the rock is much heavier than that', 'a rock'))
      .toBeNull();
  });

  it('accepts an ask that reads the WHOLE menu', () => {
    expect(findChoiceMenuDefects([pairItem()])).toEqual([]);
  });

  it('DROPS the two-of-four ask — a narrowed menu is a leak wearing a menu costume', () => {
    // The exact shape the wxyu draw's own intent proposed ("is it longer or heavier?").
    const narrowed = pairItem({
      ask: 'Here is a feather, and here is a rock. Is the rock longer or heavier?',
    });
    expect(findChoiceMenuDefects([narrowed])).toEqual([
      { itemId: 'dsp-1', reason: 'menu_not_spoken', detail: ['shorter', 'lighter'] },
    ]);
  });

  it('drops an answer that is not on the menu it read out', () => {
    expect(findChoiceMenuDefects([pairItem({ expectedAnswer: 'bigger' })])).toEqual([
      { itemId: 'dsp-1', reason: 'answer_not_in_menu', detail: MENU },
    ]);
  });

  it('drops a one-word menu — that is not a choice', () => {
    expect(findChoiceMenuDefects([pairItem({ choices: ['heavier'] })])).toEqual([
      { itemId: 'dsp-1', reason: 'too_few_choices', detail: ['heavier'] },
    ]);
  });

  it('drops choices the ear cannot separate', () => {
    const overlapping = pairItem({
      choices: ['long', 'longer'],
      expectedAnswer: 'longer',
      ask: 'Here is a feather, and here is a rock. Is the rock long, or longer?',
    });
    expect(findChoiceMenuDefects([overlapping])).toEqual([
      { itemId: 'dsp-1', reason: 'choices_not_separable', detail: ['long', 'longer'] },
    ]);
  });

  it("drops the object NAMED with the answer's root — found live, 2026-09-06", () => {
    // flash-lite's own first real draw. Every whole-token gate passed it:
    // "long" is not the token "longer", but a child hears the answer anyway.
    const giveaway = pairItem({
      stimulusText: 'a long pencil',
      stimulusText2: 'a crayon',
      expectedAnswer: 'longer',
      ask: 'Here is a long pencil, and here is a crayon. Is the pencil longer, shorter, heavier, or lighter?',
    });
    expect(findAnswerLeaks([giveaway])).toEqual([]); // the whole-token scan cannot see it
    expect(findChoiceMenuDefects([giveaway])).toEqual([
      { itemId: 'dsp-1', reason: 'menu_word_in_stimulus', detail: ['long'] },
    ]);
  });

  it('leaves an object that merely shares a first letter alone', () => {
    // "leaf"/"lighter" is the accidental pair the four-character threshold spares.
    const fine = pairItem({
      stimulusText: 'an elephant',
      stimulusText2: 'a leaf',
      expectedAnswer: 'lighter',
      ask: 'Here is an elephant, and here is a leaf. Is the leaf longer, shorter, heavier, or lighter?',
    });
    expect(findChoiceMenuDefects([fine])).toEqual([]);
  });

  it('exempts the ask from the leak scan ONLY because the menu is always complete', () => {
    expect(findAnswerLeaks([pairItem()])).toEqual([]);
  });

  it('still catches the answer hidden in either object name', () => {
    expect(findAnswerLeaks([pairItem({ stimulusText: 'a heavier box' })]))
      .toEqual([{ itemId: 'dsp-1', field: 'stimulusText', answer: 'heavier' }]);
    expect(findAnswerLeaks([pairItem({ stimulusText2: 'the heavier one' })]))
      .toEqual([{ itemId: 'dsp-1', field: 'stimulusText2', answer: 'heavier' }]);
  });

  it('requires the ask to NAME BOTH things — a pre-reader cannot compare two unnamed pictures', () => {
    const halfSpoken = pairItem({
      ask: 'Look at these. Is the rock longer, shorter, heavier, or lighter?',
    });
    expect(findUnspokenStimulus([halfSpoken]))
      .toEqual([{ itemId: 'dsp-1', missing: ['feather'] }]);
    expect(findUnspokenStimulus([pairItem()])).toEqual([]);
  });

  it('hands the judge the menu in code, not in a generated clause', () => {
    const cue = itemCue(pairItem(), { opening: false, howToPlay: false });
    expect(cue).toContain(
      'The learner is choosing one word from: "longer", "shorter", "heavier", "lighter".');
    expect(cue).toContain('The correct answer is "heavier"');
    expect(cue).toContain('If the answer is right, say exactly: "Yes, heavier."');
  });

  it('re-hears BOTH things, and pushes both as stimulus state without the menu', () => {
    expect(pronounceCue(pairItem()))
      .toBe('[SAY_HEAR] Say exactly: "a feather and a rock" Then stop — say nothing else.');
    expect(contextFor(pairItem()))
      .toEqual({ challengeType: 'compare_choice', stimulus: 'a feather and a rock' });
  });
});

// ── explain_concept — an idea, not a token, and the gates that keep it honest ─

const explainItem = (over: Partial<SpokenPracticeItem> = {}): SpokenPracticeItem => item({
  mode: 'explain_concept',
  action: 'explain_concept',
  responseClass: 'concept_statement',
  stimulusText: '3 + 2 = 5',
  ask: 'Three plus two equals five. Look at the equal sign. What does the equal sign tell us?',
  howToPlay: 'I will show you something, and you tell me what it means in your own words.',
  expectedAnswer: 'both sides the same',
  alternates: ['balanced', 'equal amounts'],
  conceptStatement: 'The equal sign means both sides have the same amount.',
  acceptRule: 'Any words that say the two sides match count, even without the word same.',
  signatureError: 'Saying the sum, five, is NOT an explanation.',
  correctionBody: 'The equal sign means both sides have the same amount.',
  ...over,
});

describe('explain_concept — the first open proposition, and what code can gate', () => {
  it('places a short anchor in concept_statement and refuses a sentence-length one', () => {
    expect(deriveResponseClass('explain_concept', 'plus two', '2, 4, 6, 8')).toBe('concept_statement');
    expect(deriveResponseClass('explain_concept', 'both sides the same', '3 + 2 = 5')).toBe('concept_statement');
    expect(deriveResponseClass('explain_concept', 'the equal sign means both sides are the same', '3 + 2 = 5'))
      .toBeNull();
  });

  it('is clean on a well-formed item', () => {
    expect(findConceptDefects([explainItem()])).toEqual([]);
    expect(findAnswerLeaks([explainItem()])).toEqual([]);
    expect(findUnspokenStimulus([explainItem()])).toEqual([]);
  });

  it('refuses an item with no concept sentence, or one outside 4-12 words', () => {
    expect(findConceptDefects([explainItem({ conceptStatement: '' })]).map((d) => d.reason))
      .toEqual(['missing_concept']);
    expect(findConceptDefects([explainItem({ conceptStatement: 'Equal means same.' })]).map((d) => d.reason))
      .toEqual(['missing_concept']);
    expect(findConceptDefects([explainItem({
      conceptStatement: 'The equal sign means that the amount on the left is exactly the amount on the right side.',
    })]).map((d) => d.reason)).toEqual(['missing_concept']);
  });

  it('refuses a concept sentence that opens with a verdict sentinel — it is SPOKEN in the affirm', () => {
    expect(findConceptDefects([explainItem({ conceptStatement: 'Yes, both sides have the same amount.' })])
      .map((d) => d.reason)).toEqual(['sentinel_in_concept']);
  });

  it('keeps anchors short and few — they are examples, not a required wording', () => {
    expect(findConceptDefects([explainItem({ alternates: ['the two sides have exactly the same amount'] })]))
      .toEqual([{ itemId: 'dsp-1', reason: 'anchor_too_long', detail: ['the two sides have exactly the same amount'] }]);
    expect(findConceptDefects([explainItem({ alternates: ['balanced', 'equal', 'even'] })]).map((d) => d.reason))
      .toEqual(['too_many_anchors']);
  });

  it('refuses two anchors the ear cannot separate', () => {
    // The contained one is named — it is the anchor the other already covers.
    expect(findConceptDefects([explainItem({ expectedAnswer: 'same', alternates: ['the same'] })]))
      .toEqual([{ itemId: 'dsp-1', reason: 'anchors_not_distinct', detail: ['same'] }]);
  });

  it('refuses an anchor that sits inside the instance — ECHO would be un-refusable', () => {
    expect(findConceptDefects([explainItem({
      stimulusText: 'red, blue, red, blue', ask: 'Red, blue, red, blue. What is the rule?',
      expectedAnswer: 'red blue', alternates: [], conceptStatement: 'The pattern repeats red then blue over and over.',
    })])).toEqual([{ itemId: 'dsp-1', reason: 'anchor_echoes_stimulus', detail: ['red blue'] }]);
  });

  it('refuses the concept inside the ask — THE leak — but lets the subject be named', () => {
    // "the equal sign" is the concept's SUBJECT and is legitimately in the ask
    // (a three-token run). The PREDICATE is the leak.
    expect(findConceptDefects([explainItem()])).toEqual([]);
    const leaky = explainItem({
      ask: 'The equal sign means both sides have the same amount. What does the equal sign tell us?',
    });
    expect(findConceptDefects([leaky]).map((d) => d.reason)).toEqual(['concept_in_ask']);
    // An ANCHOR in the ask is caught by the ordinary leak scan at any length.
    expect(findAnswerLeaks([explainItem({ ask: 'Is it balanced? What does the equal sign tell us?' })]))
      .toEqual([{ itemId: 'dsp-1', field: 'ask', answer: 'balanced' }]);
  });

  it('requires the ask to SAY the printed instance — the voice is the carrier', () => {
    expect(findUnspokenStimulus([explainItem({ ask: 'Look at this. What does the equal sign tell us?' })]))
      .toEqual([{ itemId: 'dsp-1', missing: ['3', '2', '5'] }]);
    // A pictured instance is exempt, as say_answer's is.
    expect(findUnspokenStimulus([explainItem({
      stimulusKind: 'emoji', stimulusEmoji: '⚖️', stimulusText: 'a balanced scale',
      ask: 'Look at the scale. What does the equal sign tell us?',
    })])).toEqual([]);
  });

  it('hands the judge the concept, the anchors as EXAMPLES, and the meaning rule — in code', () => {
    const cue = itemCue(explainItem(), { opening: false, howToPlay: false });
    expect(cue).toContain('The idea they must express: "The equal sign means both sides have the same amount."');
    expect(cue).toContain('for example "both sides the same", "balanced", "equal amounts"');
    expect(cue).toContain("a child's own phrasing that uses none of those words");
    expect(cue).toContain('Judge the MEANING of what you heard, not the words.');
    expect(cue).toContain('inside a sentence that means the OPPOSITE');
    expect(cue).toContain('The stimulus read back ("3 + 2 = 5") is NOT an explanation');
    expect(cue).toContain('Saying the sum, five, is NOT an explanation.');
    // No "The correct answer is" — there is no single right wording.
    expect(cue).not.toContain('The correct answer is');
  });

  it('affirms by restating the CONCEPT SENTENCE, not the anchor — the DISTAR firm-up', () => {
    const cue = itemCue(explainItem(), { opening: false, howToPlay: false });
    expect(cue).toContain('say exactly: "Yes, the equal sign means both sides have the same amount."');
    expect(cue).not.toContain('"Yes, both sides the same."');
    expect(conceptAffirmForm('This pattern grows by adding two each time')).toBe('this pattern grows by adding two each time.');
  });

  it('never models the concept in the ask — the re-teach lives in the correction', () => {
    const cue = itemCue(explainItem(), { opening: true, howToPlay: true });
    const spoken = cue.match(/Say exactly: "([^"]+)"/)![1];
    expect(spoken).toBe(
      'I will show you something, and you tell me what it means in your own words. Three plus two '
      + 'equals five. Look at the equal sign. What does the equal sign tell us?',
    );
    expect(cue).toContain('My turn: The equal sign means both sides have the same amount. Your turn. Three plus two');
  });

  it('keeps sentinel discipline with the concept spoken inside the affirm', () => {
    const items = [explainItem(), explainItem({ id: 'dsp-2', stimulusText: '4 + 1 = 5', ask: 'Four plus one equals five. What does the equal sign tell us?' })];
    expect(findSentinelCollisions([
      { label: 'itemCue', text: itemCue(items[0], { opening: true, howToPlay: true }) },
      { label: 'moveOnCue', text: moveOnCue(items[0], items[1], { opening: false, howToPlay: false }) },
      { label: 'pronounceCue', text: pronounceCue(items[0]) },
    ])).toEqual([]);
  });

  it('pushes the instance as state and re-hears the instance — never the concept', () => {
    expect(contextFor(explainItem())).toEqual({ challengeType: 'explain_concept', stimulus: '3 + 2 = 5' });
    expect(pronounceCue(explainItem())).toBe('[SAY_HEAR] Say exactly: "3 + 2 = 5" Then stop — say nothing else.');
  });

  it('builds through the shipped gate with a session-wide anchor set stamped in', () => {
    // The ah5w shape: the plan owns the concept, the model writes the instance.
    const concept = {
      conceptStatement: 'The equal sign means both sides have the same amount.',
      anchors: ['both sides the same', 'balanced'],
    };
    const built = buildSpokenItem({
      stimulusText: '4 + 1 = 5', ask: 'Four plus one equals five. What does the equal sign tell us?',
      expectedAnswer: 'ignored by code', alsoAccept: 'also ignored', conceptStatement: 'also ignored',
      correctionBody: 'The equal sign means both sides have the same amount.',
    }, 0, 'explain_concept', [], concept)!;
    expect(built.expectedAnswer).toBe('both sides the same');
    expect(built.alternates).toEqual(['balanced']);
    expect(built.conceptStatement).toBe(concept.conceptStatement);
    expect(built.responseClass).toBe('concept_statement');
    expect(built.stimulusKind).toBe('text');
    expect(gateSpokenItems([built]).dropped).toEqual([]);
  });

  it('exports ONE cue surface the component and the harness both spread', () => {
    const surface = diSpokenPracticePackBase([explainItem()]);
    expect(surface.primitiveType).toBe('di-spoken-practice');
    expect(surface.itemCue(explainItem(), { opening: false, howToPlay: false }))
      .toBe(itemCue(explainItem(), { opening: false, howToPlay: false }));
  });
});

describe('explain_concept — anchors are tidied, not refused (the third pilot)', () => {
  it('drops a redundant wording, caps at two extras, and drops an alternate that echoes the instance', () => {
    // "same as" beside "the same as" zeroed a whole stamped session (6/6 items).
    expect(normalizeConceptAnchors('same as', ['the same as', 'balanced', 'equal', 'even']))
      .toEqual(['balanced', 'equal']);
    // The instance read back can never be an EXAMPLE the judge affirms.
    expect(normalizeConceptAnchors('red then blue', ['red blue', 'alternating colors'], 'red, blue, red, blue'))
      .toEqual(['alternating colors']);
    expect(normalizeConceptAnchors('plus two', ['add two', 'counting by twos', 'skip counting by two', 'jump by twos']))
      .toEqual(['add two', 'counting by twos']);
  });

  it('builds a model-written item with its anchors tidied, so the code gates see a clean set', () => {
    const built = buildSpokenItem({
      stimulusText: 'red, blue, red, blue', ask: 'Red, blue, red, blue. What is the rule of this pattern?',
      expectedAnswer: 'red then blue', alsoAccept: 'red blue, alternating colors, repeating red and blue, blue after red',
      conceptStatement: 'The pattern repeats red then blue over and over.', correctionBody: 'The rule is red then blue.',
    }, 0, 'explain_concept')!;
    expect(built.alternates).toEqual(['alternating colors', 'repeating red and blue']);
    expect(findConceptDefects([built])).toEqual([]);
    expect(findAnswerLeaks([built])).toEqual([]);
  });

  it('hands a PRIMARY that is the instance read back over to a safe alternate, or refuses the item', () => {
    // The ask says the instance, so an echoing primary is in the ask too:
    // `reconcileConceptAnchors` promotes the first safe alternate…
    const promoted = buildSpokenItem({
      stimulusText: 'red, blue, red, blue', ask: 'Red, blue, red, blue. What is the rule of this pattern?',
      expectedAnswer: 'red blue', alsoAccept: 'alternating colors',
      conceptStatement: 'The pattern repeats red then blue over and over.', correctionBody: 'The rule is red then blue.',
    }, 0, 'explain_concept')!;
    expect(promoted.expectedAnswer).toBe('alternating colors');
    expect(findConceptDefects([promoted])).toEqual([]);
    // …and with no safe alternate the item is refused outright.
    expect(buildSpokenItem({
      stimulusText: 'red, blue, red, blue', ask: 'Red, blue, red, blue. What is the rule of this pattern?',
      expectedAnswer: 'red blue', alsoAccept: '',
      conceptStatement: 'The pattern repeats red then blue over and over.', correctionBody: 'The rule is red then blue.',
    }, 0, 'explain_concept')).toBeNull();
  });

  it('hears a pattern above twenty when the ask says it — "10, 20, 30, 40" was dropped for a perfect ask', () => {
    expect(findUnspokenStimulus([explainItem({
      stimulusText: '10, 20, 30, 40', ask: 'Ten, twenty, thirty, forty. What is the rule of this pattern?',
      conceptStatement: 'This pattern grows by adding ten each time.', expectedAnswer: 'plus ten', alternates: [],
    })])).toEqual([]);
    expect(findUnspokenStimulus([explainItem({
      stimulusText: '25, 50, 75, 100', ask: 'Twenty five, fifty, seventy five, one hundred. What is the rule?',
      conceptStatement: 'This pattern grows by adding twenty-five each time.', expectedAnswer: 'plus twenty five', alternates: [],
    })])).toEqual([]);
    expect(findUnspokenStimulus([explainItem({
      stimulusText: '10, 20, 30, 40', ask: 'Ten, twenty, and so on. What is the rule of this pattern?',
      conceptStatement: 'This pattern grows by adding ten each time.', expectedAnswer: 'plus ten', alternates: [],
    })])).toEqual([{ itemId: 'dsp-1', missing: ['30', '40'] }]);
  });
});

describe('explain_concept — anchors reconciled with the ask (the fresh draw i08t, 0/6 twice)', () => {
  const ask = 'Four plus one equals five. What does the equal sign tell us?';

  it('drops an alternate that is a word of the ask, keeps the rest', () => {
    // "equal" is in every ask that names the equal sign; it cannot be an
    // example the judge affirms, and it must not fail the leak gate either.
    expect(reconcileConceptAnchors('same as', ['balanced', 'equal', 'the same'], ask))
      .toEqual({ primary: 'same as', alternates: ['balanced', 'the same'] });
  });

  it('hands a PRIMARY that is in the ask over to the first ask-safe alternate', () => {
    expect(reconcileConceptAnchors('equal', ['balanced', 'the same'], ask))
      .toEqual({ primary: 'balanced', alternates: ['the same'] });
    // Every anchor in the ask is a genuine leak — nothing to ship.
    expect(reconcileConceptAnchors('equal', ['equal sign'], ask)).toEqual({ primary: '', alternates: [] });
  });

  it('builds a stamped item with the ask-word anchor dropped and still passes the leak gate', () => {
    const concept = {
      conceptStatement: 'The equal sign means both sides have the same amount.',
      anchors: ['same as', 'balanced', 'equal'],
    };
    const built = buildSpokenItem({
      stimulusText: '4 + 1 = 5', ask, expectedAnswer: '', alsoAccept: '', conceptStatement: '',
      correctionBody: 'The equal sign means both sides have the same amount.',
    }, 0, 'explain_concept', [], concept)!;
    expect(built.expectedAnswer).toBe('same as');
    expect(built.alternates).toEqual(['balanced']);
    expect(gateSpokenItems([built]).dropped).toEqual([]);
  });

  it('refuses the item when every anchor is a word of the ask', () => {
    expect(buildSpokenItem({
      stimulusText: '4 + 1 = 5', ask, expectedAnswer: 'equal', alsoAccept: 'equal sign',
      conceptStatement: 'The equal sign means both sides have the same amount.', correctionBody: 'x',
    }, 0, 'explain_concept')).toBeNull();
  });
});
