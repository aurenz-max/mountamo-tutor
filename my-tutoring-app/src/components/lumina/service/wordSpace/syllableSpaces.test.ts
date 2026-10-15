import { describe, expect, it } from 'vitest';
import { isVowel, lexWord } from './lexicon';
import { mulberry32, tierPick, tierPickSplit } from './pick';
import { splitIsValid, syllableSpace, type SyllableSpaceTask } from './syllableSpaces';
import { itemFromChallenge, isCompoundPartWord } from '../../primitives/visual-primitives/literacy/syllableClapperScript';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const TASKS: SyllableSpaceTask[] = ['count_parts', 'blend_syllables', 'delete_compound'];
const beats = (w: string) => lexWord(w)!.phones.filter(isVowel).length;

describe.each(['K', '1'])('syllable-clapper spaces, grade %s', (grade) => {
  it.each(TASKS)('%s: the count re-derives from the phonemes; code splits pass the component gate', (task) => {
    const space = syllableSpace(task, grade);
    expect(space.length).toBeGreaterThanOrEqual(task === 'delete_compound' ? 20 : 40);
    for (const it of space) {
      // delete_compound counts its two WORDS (water + melon); the other tasks count beats.
      expect(it.payload.syllableCount).toBe(task === 'delete_compound' ? 2 : beats(it.payload.word));
      if (!it.payload.syllables) continue; // the model splits it; the generator gates that split
      const ch = { id: 'c1', challengeType: task, difficulty: 3, ...it.payload };
      expect(itemFromChallenge(ch as never), `${task} ${it.payload.word} ${it.payload.syllables.join('|')}`).not.toBeNull();
      if (task === 'delete_compound') {
        expect(it.payload.syllables).toContain(it.payload.removePart);
        expect(it.payload.syllables).toContain(it.payload.residue);
        expect(it.payload.syllables.every(isCompoundPartWord)).toBe(true);
      }
    }
  });
  it('blend and delete: easy < hard', () => {
    for (const task of ['blend_syllables', 'delete_compound'] as const) {
      const means = TIERS.map((t) => { const p = tierPick(syllableSpace(task, grade), t, 4, mulberry32(5)); expect(p).toHaveLength(4); return p.reduce((s, x) => s + x.beta, 0) / 4; });
      expect(means[0]).toBeLessThan(means[2]);
    }
  });
});

describe('syllable rules', () => {
  it('count_parts never asks the same count every time inside a tier', () => {
    const picks = tierPickSplit(syllableSpace('count_parts', 'K').filter((it) => [1, 2].includes(it.payload.syllableCount)), (it) => it.key ?? '', 'easy', 6, mulberry32(1));
    expect(new Set(picks.map((p) => p.payload.syllableCount)).size).toBe(2);
  });
  it('model splits are checked: count, spelling, a vowel in every part, no doubled-consonant opening', () => {
    expect(splitIsValid('umbrella', 3, ['um', 'brel', 'la'])).toBe(true);
    expect(splitIsValid('umbrella', 3, ['um', 'bre', 'lla'])).toBe(false);
    expect(splitIsValid('tiger', 2, ['ti', 'ger'])).toBe(true);
    expect(splitIsValid('tiger', 2, ['tig', 'r'])).toBe(false);
    expect(splitIsValid('caterpillar', 4, ['cat', 'er', 'pil', 'lar'])).toBe(true);
    expect(splitIsValid('banana', 3, ['ban', 'ana'])).toBe(false);
  });
  it('function words are never compound parts (forget, today)', () => {
    expect(syllableSpace('delete_compound', '1').some((it) => ['forget', 'today', 'tonight', 'upon'].includes(it.payload.word))).toBe(false);
  });
  it('words whose beat count depends on the speaker are left out (tired, flower)', () => {
    for (const t of ['count_parts', 'blend_syllables'] as const) {
      expect(syllableSpace(t, '1').some((it) => ['tired', 'flower', 'tower', 'fire', 'hour'].includes(it.payload.word))).toBe(false);
    }
  });
});
