import { describe, expect, it } from 'vitest';
import { mulberry32, tierPick, tierPickFocus } from './pick';
import { distractorKind, letterSpace, type LetterMode } from './letterSpaces';
import { LETTER_GROUPS, NEW_LETTERS } from '../literacy/letterGroups';
import { canProduceSound, keywordNamesItsPicture } from '../../primitives/visual-primitives/literacy/letterSoundLinkScript';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const SOUND: Record<string, string> = { c: 'k', k: 'k' };
const same = (a: string, b: string) => (SOUND[a] ?? a) === (SOUND[b] ?? b);
const space = (mode: LetterMode, group: 1 | 2 | 3 | 4) => letterSpace(mode, LETTER_GROUPS[group],
  mode === 'see-hear' ? canProduceSound : mode === 'keyword-match' ? keywordNamesItsPicture : () => true,
  mode === 'keyword-match' ? keywordNamesItsPicture : () => true, same);

describe.each([2, 3, 4] as const)('letter spaces, group %s', (group) => {
  it.each(['see-hear', 'hear-see', 'keyword-match'] as const)('%s: targets and wrong letters stay in the group; easy < hard', (mode) => {
    const items = space(mode, group);
    for (const it of items) {
      expect(LETTER_GROUPS[group]).toContain(it.payload.targetLetter);
      if (it.payload.distractor) {
        expect(LETTER_GROUPS[group]).toContain(it.payload.distractor);
        expect(same(it.payload.targetLetter, it.payload.distractor)).toBe(false);
      }
    }
    const means = TIERS.map((t) => { const p = tierPick(items, t, 3, mulberry32(4)); expect(p).toHaveLength(3); return p.reduce((s, x) => s + x.beta, 0) / 3; });
    expect(means[0]).toBeLessThan(means[2]);
  });
  it('two thirds of a draw use the new letters', () => {
    const fresh = new Set(NEW_LETTERS[group]);
    const picks = tierPickFocus(space('hear-see', group), (it) => fresh.has(it.payload.targetLetter), 'medium', 3, mulberry32(2));
    expect(picks.filter((p) => fresh.has(p.payload.targetLetter)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('letter rules', () => {
  it('nearness: b/d look alike, m/n both, e/i sound alike, s/t far', () => {
    expect(distractorKind('b', 'd')).toBe('look');
    expect(distractorKind('m', 'n')).toBe('both');
    expect(distractorKind('e', 'i')).toBe('sound');
    expect(distractorKind('s', 't')).toBe('far');
  });
});

describe('name-it key words', () => {
  it('every key word starts with its letter AND the letter\'s basic sound; tiers ordered', async () => {
    const { keyWordSpace } = await import('./letterSpaces');
    const { lexWord } = await import('./lexicon');
    const { BASIC_SOUND } = await import('./scope');
    const items = keyWordSpace(LETTER_GROUPS[4].filter((l) => l !== 'x').map((l) => (l === 'qu' ? 'q' : l)), 'K', () => true);
    expect(items.length).toBeGreaterThan(60);
    for (const it of items) {
      const x = lexWord(it.payload.targetWord)!;
      expect(it.payload.targetWord[0]).toBe(it.payload.targetLetter);
      const unit = it.payload.targetLetter === 'q' ? 'qu' : it.payload.targetLetter;
      expect(BASIC_SOUND[unit].map((p) => `${unit}/${p}`)).toContain(x.gpcs![0]);
      expect(['sheep', 'city', 'giraffe', 'chair'].includes(it.payload.targetWord)).toBe(false);
    }
    const means = TIERS.map((t) => { const p = tierPick(items, t, 6, mulberry32(9)); expect(p).toHaveLength(6); return p.reduce((s, x) => s + x.beta, 0) / 6; });
    expect(means[0]).toBeLessThan(means[2]);
  });
});
