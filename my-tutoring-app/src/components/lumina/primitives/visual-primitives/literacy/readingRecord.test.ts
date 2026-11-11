import { describe, expect, it } from 'vitest';
import { locateMiscues, readingRecord, readWords, wordReadTally, type ReadAttempt } from './readingRecord';

const read = (itemId: string, response: string, correct: boolean, extra: Partial<ReadAttempt> = {}): ReadAttempt =>
  ({ itemId, response, source: 'speech', correct, ...extra });

describe('readWords', () => {
  it('drops case, punctuation and apostrophes, and reads digits as words', () => {
    expect(readWords('"Don\'t go," said Sam.')).toEqual(['dont', 'go', 'said', 'sam']);
    expect(readWords('I see 2 cats')).toEqual(['i', 'see', 'two', 'cats']);
  });
});

describe('locateMiscues', () => {
  it('names a swapped word with what was said', () => {
    expect(locateMiscues('The cat sits on the mat.', 'the cat sat on the mat'))
      .toEqual([{ kind: 'swap', printed: 'sits', said: 'sat', at: 2 }]);
  });
  it('names a dropped word', () => {
    expect(locateMiscues('The dog is in the mud.', 'The dog is in mud'))
      .toEqual([{ kind: 'drop', printed: 'the', at: 4 }]);
  });
  it('names an added word that is not printed', () => {
    expect(locateMiscues('The frog can hop.', 'the big frog can hop'))
      .toEqual([{ kind: 'add', said: 'big', at: 1 }]);
  });
  it('does not count a restart, a repeat or a filler as an addition', () => {
    expect(locateMiscues('The cat sits on the mat.', 'the um the cat sat on the mat'))
      .toEqual([{ kind: 'swap', printed: 'sits', said: 'sat', at: 2 }]);
  });
  it('locates nothing when the transcript matches the print', () => {
    expect(locateMiscues('The cat sat.', 'the cat sat')).toBeNull();
  });
  it('locates nothing when fewer than half the printed words were heard', () => {
    expect(locateMiscues('The cat sits on the mat.', 'a kitty is resting')).toBeNull();
    expect(locateMiscues('The cat sat.', '')).toBeNull();
  });
});

describe('wordReadTally', () => {
  const lines = [{ id: 'l1', text: 'The cat sits on the mat.' }, { id: 'l2', text: 'The dog ran.' },
    { id: 'l3', text: 'The cat ran.', cold: false }];

  it('tallies each word of the cold first reads; a misread word carries what was said in its place', () => {
    const [tally] = wordReadTally(lines, [
      read('l1', 'the cat sat on the mat', false), read('l1', 'the cat sits on the mat', true),
      read('l2', 'sechs', true), read('l3', 'the cat ran', true),
    ]);
    expect(tally.kind).toBe('letter_sound');
    const by = Object.fromEntries(tally.units.map(u => [u.unit, [u.attempts, u.correct]]));
    expect(by).toEqual({ the: [3, 3], cat: [1, 1], 'sits>sat': [1, 0], on: [1, 1], mat: [1, 1], dog: [1, 1], ran: [1, 1] });
  });
  it('a one-word item takes the verdict as it stands; a one-word miss names the word said', () => {
    const words = [{ id: 'w1', text: 'cat' }, { id: 'w2', text: 'ship' }, { id: 'w3', text: 'dog' }];
    const [tally] = wordReadTally(words, [
      read('w1', 'cap', false), read('w1', 'cat', true), read('w2', 'sheep', true),
    ]);
    expect(tally.units).toEqual([{ unit: 'cat>cap', attempts: 1, correct: 0 }, { unit: 'ship', attempts: 1, correct: 1 }]);
    // A longer reply names no single word: the whole word counts, as before.
    expect(wordReadTally([{ id: 'w1', text: 'cat' }], [read('w1', 'um is it cap', false)])[0].units)
      .toEqual([{ unit: 'cat', attempts: 1, correct: 0 }]);
  });
  it('leaves out a first read made after the answer was shown or said', () => {
    expect(wordReadTally([{ id: 'w1', text: 'cat' }], [read('w1', 'cat', true, { answerExposure: 'full' })])).toEqual([]);
    expect(wordReadTally([{ id: 'w1', text: 'cat' }], [read('w1', 'cat', true, { answerExposure: 'partial' })])).toHaveLength(1);
  });
  it('leaves out a read the tutor and the re-grade disagree on, right or wrong (the first real session: sun heard as sign)', () => {
    const words = [{ id: 'w1', text: 'cat' }, { id: 'w3', text: 'sun' }, { id: 'w4', text: 'bus' }];
    const [tally] = wordReadTally(words, [
      read('w1', 'cat', true, { flowCorrect: true }),
      read('w3', 'sign', false, { flowCorrect: true }),
      read('w4', 'das', false, { flowCorrect: false }), read('w4', 'bus', true, { flowCorrect: true }),
    ]);
    expect(tally.units).toEqual([{ unit: 'cat', attempts: 1, correct: 1 }, { unit: 'bus>das', attempts: 1, correct: 0 }]);
    const record = readingRecord([{ id: 'l1', text: 'The cat sat on a mat.' }], [read('l1', 'the cat sat on mat', false, { flowCorrect: true })]);
    expect(record).toMatchObject({ wordsCounted: 0, wordAccuracy: null, miscues: [], unlocated: 0, disputed: 1 });
  });
  it('gives nothing for an unlocated first read or a session with no reads', () => {
    expect(wordReadTally(lines, [read('l1', 'the cat sits on the mat', false)])).toEqual([]);
    expect(wordReadTally(lines, [])).toEqual([]);
  });
});

describe('readingRecord', () => {
  const lines = [{ id: 'l1', text: 'The cat sits on the mat.' }, { id: 'l2', text: 'The dog ran.' }];

  it('counts every word of a credited read, whatever the transcript says', () => {
    const r = readingRecord(lines, [read('l1', 'sechs', true), read('l2', 'the dog ran', true)]);
    expect(r).toMatchObject({ wordsCounted: 9, wordsCorrect: 9, wordAccuracy: 100, miscues: [], unlocated: 0 });
  });
  it('takes word accuracy from the first read and keeps later reads as miscues only', () => {
    const r = readingRecord(lines, [
      read('l1', 'the cat sat on the mat', false), read('l1', 'the cat sits on a mat', false),
      read('l1', 'the cat sits on the mat', true), read('l2', 'the dog ran', true),
    ]);
    expect(r.wordsCounted).toBe(9);
    expect(r.wordsCorrect).toBe(8);
    expect(r.wordAccuracy).toBe(89);
    expect(r.miscues).toEqual([
      { lineId: 'l1', kind: 'swap', printed: 'sits', said: 'sat', at: 2, attempt: 1, cold: true },
      { lineId: 'l1', kind: 'swap', printed: 'the', said: 'a', at: 4, attempt: 2, cold: true },
    ]);
  });
  it('leaves an unlocated wrong read out of the word count', () => {
    const r = readingRecord(lines, [read('l1', 'the cat sits on the mat', false), read('l2', 'the dog ran', true)]);
    expect(r).toMatchObject({ wordsCounted: 3, wordsCorrect: 3, wordAccuracy: 100, unlocated: 1, miscues: [] });
  });
  it('records miscues on a modeled line without counting its words', () => {
    const r = readingRecord([{ id: 'l1', text: 'The cat sits on the mat.', cold: false }], [read('l1', 'the cat sat on the mat', false)]);
    expect(r.wordAccuracy).toBeNull();
    expect(r.miscues).toHaveLength(1);
    expect(r.miscues[0].cold).toBe(false);
  });
  it('ignores practice reads, gestures and lines never read', () => {
    const r = readingRecord(lines, [
      read('l1', 'the cat sat on the mat', false, { practice: true }),
      read('l1', 'plan', false, { source: 'gesture' }),
    ]);
    expect(r).toMatchObject({ wordsCounted: 0, wordAccuracy: null, miscues: [], unlocated: 0 });
  });
});
