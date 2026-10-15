import { describe, expect, it } from 'vitest';
import { mulberry32, tierPick } from './pick';
import { flipSpace, type FlipType } from './wordFlipSpaces';
import { SEEDS_BY_TYPE, deriveWordFlipAnswer } from '../literacy/gemini-word-flip';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const TYPES: FlipType[] = ['plural_s', 'plural_es', 'plural_y', 'irregulars', 'past_ed', 'past_irregular'];

describe.each(['K', '1'])('word-flip spaces, grade %s', (grade) => {
  it.each(TYPES)('%s: every answer is the generator rule; regular plurals are familiar words; tiers ordered', (type) => {
    const space = flipSpace(type, grade, deriveWordFlipAnswer, SEEDS_BY_TYPE[type]);
    expect(space.length).toBeGreaterThanOrEqual(7);
    for (const it of space) {
      expect(it.payload.answer).toBe(deriveWordFlipAnswer(type, it.payload.word));
      // A mass noun never gets a made-up plural.
      expect(['rice', 'milk', 'sand', 'butter', 'juice', 'water', 'moose', 'goggles', 'sunglasses', 'tennis', 'plus', 'multiply'].includes(it.payload.word), it.payload.word).toBe(false);
    }
    const m = TIERS.map((t) => { const p = tierPick(space, t, 5, mulberry32(5)); expect(p).toHaveLength(5); return p.reduce((s, x) => s + x.beta, 0) / 5; });
    expect(m[0]).toBeLessThanOrEqual(m[2]);
  });
});
