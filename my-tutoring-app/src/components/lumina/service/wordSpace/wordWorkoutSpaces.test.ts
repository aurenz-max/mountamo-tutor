import { describe, expect, it } from 'vitest';
import { lexWord } from './lexicon';
import { mulberry32, tierPick } from './pick';
import { isListedNonsense, workoutSpace, type WorkoutSpaceMode } from './wordWorkoutSpaces';
import { challengeAskable, isRealCvcWord, itemsFromChallenge } from '../../primitives/visual-primitives/literacy/wordWorkoutDomain';
import type { SupportTier } from '../generation/generationContext';

const TIERS: SupportTier[] = ['easy', 'medium', 'hard'];
const ALL = ['a', 'e', 'i', 'o', 'u'];
const MODES: Array<[WorkoutSpaceMode, number]> = [['real-vs-nonsense', 5], ['picture-match', 5], ['word-chains', 2], ['inflected-word', 4], ['compound-word', 2], ['context-discrimination', 3]];

describe.each(['K', '1'])('word-workout spaces, grade %s', (grade) => {
  it.each(MODES)('%s: every item passes the judged-loop gate; tiers ordered', (mode, n) => {
    const space = workoutSpace(mode, grade, ALL);
    expect(space.length).toBeGreaterThanOrEqual(n + 2);
    for (const it of space) {
      const ch = { id: 'c1', ...it.payload } as never;
      expect(challengeAskable(ch), JSON.stringify(it.payload)).toBe(true);
      expect(itemsFromChallenge(ch).length).toBeGreaterThan(0);
      if (mode === 'real-vs-nonsense') {
        expect(lexWord(it.payload.realWord as string)).toBeTruthy();
        expect(isListedNonsense(it.payload.nonsenseWord as string)).toBe(true);
        expect(isRealCvcWord(it.payload.nonsenseWord as string)).toBe(false);
      }
      if (mode === 'word-chains') for (const w of it.payload.chain as string[]) expect(lexWord(w), w).toBeTruthy();
      if (mode === 'picture-match') {
        const imgs = [it.payload.targetImage, ...(it.payload.distractorImages as Array<{ image: string }>).map((d) => d.image)];
        expect(new Set(imgs).size).toBe(3);
      }
    }
    const means = TIERS.map((t) => { const p = tierPick(space, t, n, mulberry32(3)); expect(p).toHaveLength(n); return p.reduce((s, x) => s + x.beta, 0) / n; });
    expect(means[0]).toBeLessThanOrEqual(means[2]);
    if (space.length >= 3 * n) expect(means[0]).toBeLessThan(means[2]);
  });
});

describe('word-workout rules', () => {
  it('a vowel scope keeps every word on it', () => {
    for (const it of workoutSpace('real-vs-nonsense', 'K', ['a'])) {
      expect((it.payload.realWord as string)[1]).toBe('a');
      expect((it.payload.nonsenseWord as string)[1]).toBe('a');
    }
  });
  it('the nonsense list holds no real word the old path shipped', () => {
    for (const w of ['zed', 'mig', 'pog']) expect(isListedNonsense(w)).toBe(false);
  });
});
