import { describe, expect, it } from 'vitest';
import {
  affirmFor,
  itemCue,
  itemsFromChallenge,
  itemsFromChallenges,
  wordWorkoutHarnessAnswers,
  wordWorkoutPackBase,
} from '../wordWorkoutScript';
import {
  EARLY_CONTEXT_TRIALS,
  EARLY_EXTENDED_WORDS,
  earlyExtendedWordFor,
  objectiveRequiresWordMeaning,
} from '../wordWorkoutEarlyDecoding';
import { checkPackGates } from '../../../../hooks/judgedScriptContract.testkit';

const spokenLine = (cue: string): string =>
  cue.match(/Say exactly: "([^"]+)"/)?.[1] ?? '';

describe('WordWorkout early-decoding scope', () => {
  it('bounds inflections to -s/-ing/-ed and compounds to two printed roots', () => {
    const inflected = EARLY_EXTENDED_WORDS.filter((entry) => entry.mode === 'inflected-word');
    const compounds = EARLY_EXTENDED_WORDS.filter((entry) => entry.mode === 'compound-word');

    expect(inflected.length).toBeGreaterThanOrEqual(9);
    expect(inflected.every((entry) => /(?:s|ing|ed)$/.test(entry.word))).toBe(true);
    expect(inflected.every((entry) => ['ending-s', 'ending-ing', 'ending-ed'].includes(entry.kind))).toBe(true);
    expect(compounds.length).toBeGreaterThanOrEqual(5);
    expect(compounds.every((entry) => entry.decodingParts.join('') === entry.word)).toBe(true);
    expect(EARLY_EXTENDED_WORDS.every(
      (entry) => !entry.meaningQuestion.toLowerCase().includes(entry.meaningAnswer.toLowerCase()),
    )).toBe(true);
    expect(earlyExtendedWordFor('unhappily')).toBeNull();
  });

  it('keeps every context pair one letter apart, on one short vowel, with one keyed fit', () => {
    for (const trial of EARLY_CONTEXT_TRIALS) {
      const [left, right] = trial.words;
      expect(left).toHaveLength(right.length);
      expect(left.split('').filter((letter, index) => letter !== right[index])).toHaveLength(1);
      expect(left.match(/[aeiou]/g)).toEqual([trial.scopeVowel]);
      expect(right.match(/[aeiou]/g)).toEqual([trial.scopeVowel]);
      expect(trial.words).toContain(trial.answer);
      expect(trial.sentence.match(/___/g)).toHaveLength(1);
    }
  });

  it('adds meaning only when comprehension is named', () => {
    expect(objectiveRequiresWordMeaning('Read words with common endings')).toBe(false);
    expect(objectiveRequiresWordMeaning('Read and comprehend words with common endings')).toBe(true);

    const readOnly = itemsFromChallenge({ id: 'c1', mode: 'inflected-word', targetWord: 'cats' });
    const withMeaning = itemsFromChallenge({
      id: 'c1', mode: 'inflected-word', targetWord: 'cats', includeMeaning: true,
    });
    expect(readOnly.map((item) => item.kind)).toEqual(['read_extended_word']);
    expect(withMeaning.map((item) => item.kind)).toEqual(['read_extended_word', 'answer_word_meaning']);
  });

  it('withholds the word before a cold read, then models its parts after the attempt', () => {
    const [read] = itemsFromChallenge({ id: 'c1', mode: 'compound-word', targetWord: 'sunset' });
    expect(spokenLine(itemCue(read, { opening: true }))).not.toContain('sunset');
    expect(spokenLine(itemCue(read, { opening: true }))).not.toContain('sun');
    expect(affirmFor(read)).toContain('sun ... set ... sunset');
  });

  it('turns one context trial into two decoding scores and one separate context score', () => {
    const items = itemsFromChallenge({
      id: 'c1', mode: 'context-discrimination', contextTrialId: 'cat-cap',
    });
    expect(items.map((item) => item.kind)).toEqual([
      'read_context_word', 'read_context_word', 'choose_context_word',
    ]);
    expect(items[0].targetWord).not.toBe(items[1].targetWord);
    expect(items[2].responseClass).toBe('closed_set_choice');
    expect(wordWorkoutHarnessAnswers(items[2]).correct).toBe('cat');
  });

  it('passes the judged-loop gates with transfer, meaning, and context turns together', () => {
    const items = itemsFromChallenges([
      { id: 'c1', mode: 'inflected-word', targetWord: 'cats', includeMeaning: true },
      { id: 'c2', mode: 'compound-word', targetWord: 'sunset', includeMeaning: true },
      { id: 'c3', mode: 'context-discrimination', contextTrialId: 'cat-cap' },
    ]);
    expect(checkPackGates({ ...wordWorkoutPackBase(items) })).toEqual([]);
  });
});
