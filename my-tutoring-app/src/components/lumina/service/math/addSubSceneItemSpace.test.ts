import { describe, expect, it } from 'vitest';
import { ADD_SUB_20, addSub20Items, pickAddSub20 } from '../itemSpace/addSub20';
import { TIER_BANDS, tierPick } from '../itemSpace';
import { itemFromChallenge } from '../../primitives/visual-primitives/math/additionSubtractionSceneScript';
import type { AddSubChallenge } from '../../primitives/visual-primitives/math/AdditionSubtractionScene';
import { VALID_OBJECT_TYPES } from './gemini-addition-subtraction-scene';
import {
  applySpaceStory, hiddenCount, itemAsStory, pickSpaceStories, storyFitsItem, templateStory,
} from './addSubSceneItemSpace';

const stub = (objectType = 'ducks'): AddSubChallenge => ({
  id: 'ch1', type: 'solve-story', instruction: 'Find the missing number!', storyText: '', scene: 'pond',
  objectType, operation: 'addition', storyType: 'join', startCount: 0, changeCount: 0, resultCount: 0, equation: '',
});

describe('addition-subtraction-scene item-space adapter', () => {
  it('one-step items within maxNumber become consistent stories; two-step or out-of-scope items are null', () => {
    for (const it of addSub20Items()) {
      const s = itemAsStory('add-sub-20', it, 10);
      if (it.steps.length === 2) { expect(s).toBeNull(); continue; }
      const { a, b, op } = it.steps[0];
      const r = op === '+' ? a + b : a - b;
      if (Math.max(a, b, r) > 10) { expect(s).toBeNull(); continue; }
      expect(s).not.toBeNull();
      expect(s!.resultCount).toBe(s!.operation === 'addition' ? s!.startCount + s!.changeCount : s!.startCount - s!.changeCount);
      expect(s!.unknownPosition).toBe(it.unknown);
    }
  });

  it('every tier fills a session of distinct stories within 20, across several structures, harder at hard', () => {
    const heavy = (st: string) => st.includes('|start|') || st.includes('|b1|');
    const shares: number[] = [];
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const picks = pickSpaceStories({ space: 'add-sub-20', pick: pickAddSub20, band: TIER_BANDS[tier], count: 6, maxNumber: 20 });
      expect(picks).toHaveLength(6);
      expect(new Set(picks.map((p) => p.story.equation + p.story.unknownPosition)).size).toBe(6);
      expect(new Set(picks.map((p) => p.itemSpace.structure)).size).toBeGreaterThan(2);
      const many = pickSpaceStories({ space: 'add-sub-20', pick: pickAddSub20, band: TIER_BANDS[tier], count: 30, maxNumber: 20 });
      shares.push(many.filter((p) => heavy(p.itemSpace.structure)).length / many.length);
    }
    expect(shares[2]).toBeGreaterThan(shares[0]);
  });

  it('every tier fills a session within 10 (grade 1 default)', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const picks = pickSpaceStories({ space: 'add-sub-20', pick: pickAddSub20, band: TIER_BANDS[tier], count: 6, maxNumber: 10 });
      expect(picks.length === 0 || picks.length === 6).toBe(true);
      for (const p of picks) expect(Math.max(p.story.startCount, p.story.changeCount, p.story.resultCount)).toBeLessThanOrEqual(10);
    }
  });

  it('the template story states the givens only, and passes the judged-loop build gate', () => {
    for (const it of addSub20Items()) {
      const st = itemAsStory('add-sub-20', it, 20);
      if (!st) continue;
      for (const obj of VALID_OBJECT_TYPES.slice(0, 3)) {
        const text = templateStory(st, obj, 'pond');
        expect(storyFitsItem(text, st)).toBe(true);
        const ch = applySpaceStory({ ...stub(obj), storyText: text }, { story: st, itemSpace: { space: 'add-sub-20', structure: it.structure, beta: it.beta } });
        const item = itemFromChallenge(ch, { band: '1' });
        expect(item).not.toBeNull();
        expect(item!.answer).toBe(hiddenCount(st));
      }
    }
  });

  it('a written story off its item is replaced; one on it is kept', () => {
    const st = { operation: 'subtraction' as const, storyType: 'separate' as const, startCount: 14, changeCount: 6, resultCount: 8, unknownPosition: 'change' as const, equation: '14 - 6 = 8' };
    const s = { story: st, itemSpace: { space: 'add-sub-20', structure: '-|change|b1|t1', beta: 0.3 } };
    const good = '14 ducks are in the pond. Some fly away. Now there are 8 ducks.';
    expect(applySpaceStory({ ...stub(), storyText: good }, s).storyText).toBe(good);
    // States the hidden 6, drops the 14, asks its own question, adds a number.
    for (const bad of [
      '14 ducks are in the pond. 6 fly away. Now there are 8.',
      'Some ducks are in the pond. Some fly away. Now there are 8.',
      '14 ducks are in the pond. Some fly away. How many are left if 8 stay?',
      '14 ducks and 2 frogs are in the pond. Some ducks fly away. Now there are 8 ducks.',
    ]) expect(applySpaceStory({ ...stub(), storyText: bad }, s).storyText).not.toBe(bad);
  });
});

describe('addition-subtraction-scene item space, other modes', () => {
  const pickTier = tierPick(ADD_SUB_20);
  it('act-out, build-equation and create-story take result-unknown items only', () => {
    for (const mode of ['act-out', 'build-equation', 'create-story'] as const) {
      for (const it of addSub20Items()) {
        const s = itemAsStory('add-sub-20', it, 20, mode);
        if (s) expect(s.unknownPosition).toBe('result');
      }
    }
  });

  it('build-equation medium (part-whole) within 20 keeps the medium band, not a third of the additions', () => {
    const scope = (it: unknown) => itemAsStory('add-sub-20', it, 20, 'build-equation') !== null;
    const pw = pickSpaceStories({ space: 'add-sub-20', pick: tierPick(ADD_SUB_20, undefined, scope), band: TIER_BANDS.medium, count: 6, maxNumber: 20, mode: 'build-equation', storyTypes: ['part-whole'] });
    expect(pw.every((p) => p.itemSpace.beta >= TIER_BANDS.medium[0] && p.itemSpace.beta <= TIER_BANDS.medium[1])).toBe(true);
  });

  it('build-equation situations: part-whole takes additions, compare subtractions', () => {
    const pw = pickSpaceStories({ space: 'add-sub-20', pick: pickTier, band: TIER_BANDS.medium, count: 6, maxNumber: 20, mode: 'build-equation', storyTypes: ['part-whole'] });
    expect(pw).toHaveLength(6);
    expect(pw.every((p) => p.story.operation === 'addition' && p.story.storyType === 'part-whole')).toBe(true);
    const cmp = pickSpaceStories({ space: 'add-sub-20', pick: pickTier, band: TIER_BANDS.hard, count: 6, maxNumber: 20, mode: 'build-equation', storyTypes: ['compare'] });
    expect(cmp).toHaveLength(6);
    expect(cmp.every((p) => p.story.operation === 'subtraction' && p.story.storyType === 'compare')).toBe(true);
  });

  it('within 10, every tier fills an act-out session, and the tiers are ordered by beta', () => {
    const mean = (tier: keyof typeof TIER_BANDS) => {
      const picks = pickSpaceStories({ space: 'add-sub-20', pick: pickTier, band: TIER_BANDS[tier], count: 6, maxNumber: 10, mode: 'act-out' });
      expect(picks).toHaveLength(6);
      return picks.reduce((s, p) => s + p.itemSpace.beta, 0) / picks.length;
    };
    const [e, m, h] = [mean('easy'), mean('medium'), mean('hard')];
    expect(e).toBeLessThan(m);
    expect(m).toBeLessThan(h);
  });

  it('compare and part-whole templates state both counts and pass the build gate', () => {
    for (const storyTypes of [['part-whole'], ['compare']] as const) {
      for (const p of pickSpaceStories({ space: 'add-sub-20', pick: pickAddSub20, band: [-9, 9], count: 20, maxNumber: 20, mode: 'build-equation', storyTypes })) {
        const text = templateStory(p.story, 'ducks', 'pond');
        expect(storyFitsItem(text, p.story)).toBe(true);
        expect(itemFromChallenge(applySpaceStory({ ...stub(), storyText: text }, p, 'build-equation'), { band: '1' })).not.toBeNull();
      }
    }
  });
});
