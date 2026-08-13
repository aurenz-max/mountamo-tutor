/**
 * The content-generic pack's gates. A bespoke pack's safety lives in its
 * hand-authored script; this one's lives in code, because the script is
 * generated — so these are the tests that stand in for a human reading every
 * line before it ships.
 */

import { describe, it, expect } from 'vitest';
import { findSentinelCollisions } from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  contextFor,
  deriveResponseClass,
  findAnswerLeaks,
  findArithmeticMismatches,
  findPrintedNumerals,
  findUnspokenStimulus,
  itemCue,
  moveOnCue,
  normalizeSpokenAnswer,
  pronounceCue,
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
