import { describe, it, expect } from 'vitest';
import { countKeyReasons, phantomEvidenceReasons } from './preReaderEvidence';

const mc = (question: string, extra: object = {}) => ({ type: 'multiple_choice', question, options: [], correctOptionId: 'A', ...extra }) as any;
const tf = (statement: string, extra: object = {}) => ({ type: 'true_false', statement, correct: false, ...extra }) as any;

describe('pre-reader evidence', () => {
  it('flags the probe draws that ask about pictures never drawn', () => {
    expect(phantomEvidenceReasons(tf('There are 10 flying bugs in the picture.'))).toHaveLength(1);
    expect(phantomEvidenceReasons(mc('How many toy cars are there in all?'))).toHaveLength(1);
    expect(phantomEvidenceReasons(mc('How many stars are in the big group?'))).toHaveLength(1);
    expect(phantomEvidenceReasons(tf('There are 6 balloons.'))).toHaveLength(1);
  });

  it('passes questions that need nothing drawn, or carry their objects', () => {
    expect(phantomEvidenceReasons(mc('How many fingers are on one hand?'))).toEqual([]);
    expect(phantomEvidenceReasons(mc('Which picture starts with the /b/ sound?'))).toEqual([]);
    expect(phantomEvidenceReasons(mc('Count the apples: 🍎 🍎 🍎 🍎.'))).toEqual([]);
    expect(phantomEvidenceReasons(mc('What does a puppy need to live?'))).toEqual([]);
    const inset = { insetType: 'arrangement', emoji: '⭐', count: 7, layout: 'row' };
    expect(phantomEvidenceReasons(mc('How many stars are there?', { inset }))).toEqual([]);
  });

  it('holds the key to the objects drawn', () => {
    const inset = () => ({ insetType: 'arrangement', emoji: '🍎', count: 5, layout: 'row', removed: 1 });
    const options = [{ id: 'A', text: '5' }, { id: 'B', text: 'four' }, { id: 'C', text: '3' }];
    expect(countKeyReasons(mc('How many apples are there?', { inset: inset(), options, correctOptionId: 'B' }))).toEqual([]);
    // Two options naming the drawn count leave the key ambiguous.
    const twice = [{ id: 'A', text: '4' }, { id: 'B', text: 'four' }, { id: 'C', text: '3' }];
    expect(countKeyReasons(mc('How many apples are there?', { inset: inset(), options: twice, correctOptionId: 'A' }))).toHaveLength(1);
    expect(countKeyReasons(tf('There are 4 apples.', { inset: inset(), correct: true }))).toEqual([]);
    expect(countKeyReasons(tf('There are 5 apples.', { inset: inset(), correct: true }))).toHaveLength(1);
  });
});

describe('pre-reader count drawn to the key', () => {
  it('redraws the set to the key instead of dropping the problem', () => {
    const inset = { insetType: 'arrangement', emoji: '🐟', count: 9, layout: 'row' };
    const options = [{ id: 'A', text: '6 fish' }, { id: 'B', text: '8 fish' }, { id: 'C', text: '9' }];
    const p = mc('How many fish are swimming in the pond?', { inset, options, correctOptionId: 'B' });
    expect(countKeyReasons(p)).toEqual([]);
    expect(p.inset.count).toBe(8);
  });
});

describe('pre-reader ambiguity', () => {
  it('flags two options that start with the answer sound, and an answer stated in the question', async () => {
    const { firstSoundReasons, keyNumberInStemReasons } = await import('./preReaderEvidence');
    const opts = [{ id: 'A', text: 'map' }, { id: 'B', text: 'mug' }, { id: 'C', text: 'sun' }];
    expect(firstSoundReasons(mc('Which word starts with the /m/ sound, like mud?', { options: opts, correctOptionId: 'B' }))).toHaveLength(1);
    const ok = [{ id: 'A', text: 'shoe' }, { id: 'B', text: 'sock' }, { id: 'C', text: 'pig' }];
    expect(firstSoundReasons(mc('Which word starts with the same sound as sun?', { options: ok, correctOptionId: 'B' }))).toEqual([]);
    const six = [{ id: 'A', text: 'Five stars' }, { id: 'B', text: 'Six stars' }, { id: 'C', text: 'Two stars' }];
    expect(keyNumberInStemReasons(mc('Which group shows six blue stars?', { options: six, correctOptionId: 'B' }))).toHaveLength(1);
    expect(keyNumberInStemReasons(mc('You count seven peaches, then one more: how many now?',
      { options: [{ id: 'A', text: 'Eight' }], correctOptionId: 'A' }))).toEqual([]);
  });
});
