import { describe, expect, it } from 'vitest';
import { readDraft, buildSurfaceLevers } from './itemLoop';
import { surfaceGap, unsupportedAct } from './evidence';
import { answerReady, difficultyOf, gradeAnswer, itemErrors, rightAnswer, surfaceTaps, wrongAnswer, type SurfaceItem } from './surfaces';
import { saysIdea, teachErrors, teachMisses, teachSpokenKey, type TeachSpec } from './teachSurface';
import { surfaceScene } from './surfaceScene';

const pip: TeachSpec = {
  character: 'Pip',
  holds: 'I have to count all of them one at a time, all the way up.',
  idea: 'Two from the five fills the ten, and ten and three is thirteen.',
  presses: ['But why move any counters? I can just count them.'],
};
const prompt = 'Help Pip see why 8 + 5 is quick when you make ten first.';

const teachItem = (t: TeachSpec = pip, extra: Partial<SurfaceItem> = {}): SurfaceItem => ({
  id: 't1', surface: 'teach', prompt, stimulus: [{ kind: 'ten_frame', filled: 8, extra: 5 } as never], options: [],
  teach: t, key: t.idea, tier: 'medium', difficulty: { band: 'easy', score: 0, reasons: [] }, ...extra,
});

describe('the teach surface', () => {
  it('accepts a well-formed item and names what a broken one lacks', () => {
    expect(itemErrors(teachItem())).toEqual([]);
    expect(teachErrors({ ...pip, idea: 'Make ten' }, prompt)[0]).toMatch(/4-16 words/);
    expect(teachErrors({ ...pip, holds: 'Two from five fills the ten and ten and three is thirteen' }, prompt)[0]).toMatch(/misconception/);
    expect(teachErrors(pip, 'Tell Pip that two from the five fills the ten and ten and three is thirteen.')[0]).toMatch(/prompt says the idea/);
    expect(teachErrors({ ...pip, presses: ['Oh, so two from the five fills the ten and makes thirteen?'] }, prompt)[0]).toMatch(/press 1 says the idea/);
    expect(itemErrors(teachItem(pip, { options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }))[0]).toMatch(/no option cards/);
    expect(itemErrors(teachItem(pip, { key: 'something else' }))[0]).toMatch(/key is the idea/);
  });

  it('derives the key, the misses and the harness answers from the content, never from an author field', () => {
    const key = teachSpokenKey(pip);
    expect(key.meaning?.idea).toBe(pip.idea);
    expect(key.meaning?.notIt).toContain('Pip');
    expect(teachMisses(pip).map(m => m.id)).toEqual(['agreed_with_character', 'read_back', 'named_only', 'opposite_idea']);
    expect(rightAnswer(teachItem())).toEqual({ said: pip.idea });
    expect(wrongAnswer(teachItem())).toEqual({ said: pip.holds });
    expect(gradeAnswer(teachItem(), rightAnswer(teachItem())).correct).toBe(true);
    expect(gradeAnswer(teachItem(), wrongAnswer(teachItem()))).toEqual({ correct: false, miss: 'agreed_with_character' });
  });

  it('is answered out loud: nothing to tap, no Check, and the scene never says the idea', () => {
    expect(surfaceTaps(teachItem(), rightAnswer(teachItem()), 'Check')).toEqual([]);
    expect(answerReady(teachItem(), { said: pip.idea })).toBe(false);
    const scene = surfaceScene(teachItem(), { answer: {}, tries: [], solved: false });
    const text = JSON.stringify(scene.facts).toLowerCase();
    expect(text).toContain('pip');
    expect(text).toContain(pip.holds.toLowerCase());
    expect(text).not.toContain('thirteen');
    expect(text).not.toContain('fills the ten');
  });

  it('reads words for the harness only: the idea, in part, counts; the wrong idea does not', () => {
    expect(saysIdea(pip, 'two go over to fill the ten, then it is ten and three, thirteen')).toBe(true);
    expect(saysIdea(pip, 'you count them all one at a time')).toBe(false);
    expect(saysIdea(pip, 'ten frame')).toBe(false);
  });

  it('scores difficulty from the presses, and a simplify that drops them is easier', () => {
    const two = teachItem({ ...pip, presses: [...pip.presses, 'Okay, but how do you know what is left over?'] });
    // With nothing to read on screen, one idea with no pushback is easy; the ten frame above adds its reading load.
    const none = teachItem({ ...pip, presses: [] }, { stimulus: [] });
    expect(difficultyOf(none).band).toBe('easy');
    expect(difficultyOf(teachItem({ ...pip, presses: [] })).score).toBeGreaterThan(difficultyOf(none).score);
    expect(difficultyOf(two).score).toBeGreaterThan(difficultyOf(teachItem()).score);
    const draft = readDraft({
      tier: 'medium', surface: 'teach', prompt, stimulus: [{ kind: 'ten_frame', filled: 8, extra: 5 }],
      teach: { ...pip },
      help: { says: 'Here is a full ten. How many did it take?', add_stimulus: [{ kind: 'ten_frame', filled: 10 }] },
      simplify: { says: 'Pip will take one clear try.', drop_presses: true },
      why: 'the child must say what making ten does',
    }, 'studio-1', 7);
    expect(draft.item.surface).toBe('teach');
    expect(draft.item.key).toBe(pip.idea);
    const { levers, refused } = buildSurfaceLevers(draft, 7);
    expect(refused).toEqual([]);
    expect(levers.map(l => l.kind)).toEqual(['help', 'simplify']);
    expect(levers[1].item.teach?.presses).toEqual([]);
    expect(levers[1].item.difficulty.score).toBeLessThan(draft.item.difficulty.score);
    const noPress = buildSurfaceLevers({ ...draft, item: { ...draft.item, teach: { ...pip, presses: [] } }, simplify: { says: 'x', remove: [], dropPresses: true } }, 7);
    expect(noPress.refused[0]).toMatch(/needs a press to drop/);
  });

  it('is the kit surface that collects the explain act', () => {
    const spec = { act: 'explain' as const, on: 'a friend who counts on', credit: 'the child says ten and three is quicker', notCredit: 'names making ten' };
    expect(unsupportedAct(spec)).toBeNull();
    expect(surfaceGap(spec, 'choose')).toMatch(/Use teach/);
    expect(surfaceGap(spec, 'teach')).toBeNull();
  });
});
