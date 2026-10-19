import { describe, expect, it } from 'vitest';
import { BENCHED_WINDOW, READER_GRADES, READER_LADDER, readerRung, sentenceWindowOf } from './decodableReaderLadder';
import { itemsFromChallenges } from './decodableReaderDomain';

const TIERS = ['easy', 'medium', 'hard'] as const;
const sentence = (n: number, id: string) => ({ id, words: Array.from({ length: n }, (_, i) => ({ id: `${id}w${i}`, text: i === n - 1 ? 'end.' : 'word' })) });
const question = { question: 'What is it?', answerWord: 'word', options: [{ id: 'A', text: 'A word.' }, { id: 'B', text: 'A cat.' }], correctOptionId: 'A' };

describe('decodable-reader ladder', () => {
  it('each tier asks more than the one below it at every grade; grades never shrink', () => {
    for (const g of READER_GRADES) {
      const [e, m, h] = TIERS.map((t) => READER_LADDER[g][t]);
      expect(e.window.max, g).toBeLessThanOrEqual(m.window.max);
      expect(m.window.max, g).toBeLessThanOrEqual(h.window.max);
      expect(e.window.min + e.window.max, g).toBeLessThan(h.window.min + h.window.max);
      expect(e.sentences[1], g).toBeLessThanOrEqual(h.sentences[1]);
      for (const r of [e, m, h]) expect(r.window.min).toBeLessThanOrEqual(r.window.max);
    }
    for (let i = 1; i < READER_GRADES.length; i++) for (const t of TIERS)
      expect(READER_LADDER[READER_GRADES[i]][t].window.max).toBeGreaterThanOrEqual(READER_LADDER[READER_GRADES[i - 1]][t].window.max);
  });

  it('K never leaves the benched 3-8 window; no tier means the benched window', () => {
    for (const t of TIERS) {
      expect(READER_LADDER.K[t].window.min).toBeGreaterThanOrEqual(BENCHED_WINDOW.min);
      expect(READER_LADDER.K[t].window.max).toBeLessThanOrEqual(BENCHED_WINDOW.max);
    }
    expect(readerRung('2', undefined)).toBeNull();
    expect(readerRung('7', 'hard')).toBeNull();
    expect(sentenceWindowOf(undefined)).toEqual(BENCHED_WINDOW);
    expect(sentenceWindowOf({ min: 1, max: 40 })).toEqual({ min: 3, max: 18 });
  });

  it('the script reads the stamped window: a 12-word line is asked at grade 2 hard and dropped without a stamp', () => {
    const data = { readingMode: 'decode' as const, comprehensionType: 'literal' as const,
      passage: { sentences: [sentence(12, 's1'), sentence(5, 's2')] }, comprehensionQuestions: [question] };
    const lineCounts = (d: object) => itemsFromChallenges(d as never).items.filter((i) => i.kind === 'read_line').map((i) => i.wordCount);
    expect(lineCounts(data)).toEqual([5]); // benched 3-8
    expect(lineCounts({ ...data, sentenceWindow: READER_LADDER['2'].hard.window })).toEqual([12]); // 8-12
    expect(lineCounts({ ...data, sentenceWindow: { min: 4, max: 12 } })).toEqual([12, 5]);
  });
});
