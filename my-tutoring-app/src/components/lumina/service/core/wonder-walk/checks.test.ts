import { describe, expect, it } from 'vitest';
import { buildStops, stopChecks, walkChecks, type StopDraft } from './checks';
import { hardWords, pictureOf } from './pictures';
import { validateWonderWalkData } from '../../../primitives/visual-primitives/core/wonder-walk/wonderWalk.boss';

const good: StopDraft = {
  ideaIndex: 0,
  narration: 'A puppy eats and drinks. It grows into a big dog. It is alive!',
  sceneWords: ['puppy'],
  imagePrompt: 'a happy puppy eating from a bowl in a garden',
  ask: 'Which one is alive too?',
  correctWord: 'frog',
  wrongWords: [{ word: 'rock', trap: 'other' }, { word: 'car', trap: 'looks_like' }],
  why: 'Living things eat, drink and grow. Look for the one that grows.',
};

describe('pictures', () => {
  it('maps library words (and plurals) to their reviewed emoji, and refuses unpictured words', () => {
    expect(pictureOf('frog')).toEqual({ word: 'frog', emoji: '🐸' });
    expect(pictureOf('frogs')?.word).toBe('frog');
    expect(pictureOf('photosynthesis')).toBeNull();
  });
  it('flags words a Kindergartner may not know', () => {
    expect(hardWords('A puppy eats and grows.')).toEqual([]);
    expect(hardWords('Organisms require nutrients.')).toEqual(expect.arrayContaining(['organisms', 'require', 'nutrients']));
  });
});

describe('stopChecks', () => {
  it('passes a stop that teaches with one example and checks with a new one', () => {
    expect(stopChecks(good, 2).blocking).toEqual([]);
  });
  it('blocks a stop whose narration, ask, why or image names the right picture', () => {
    const leak = stopChecks({ ...good, narration: 'Frogs are alive. They eat bugs.', ask: 'Which one is a frog?' }, 2).blocking;
    expect(leak.filter(x => x.includes('names the right picture'))).toHaveLength(2);
    expect(stopChecks({ ...good, imagePrompt: 'a frog on a lily pad' }, 2).blocking.join(' ')).toContain('imagePrompt names the right picture');
  });
  it('blocks the scene showing the right answer, unpictured words, shared emoji and bad traps', () => {
    expect(stopChecks({ ...good, sceneWords: ['frog'] }, 2).blocking.join(' ')).toContain('the scene shows the right picture');
    expect(stopChecks({ ...good, correctWord: 'amoeba' }, 2).blocking.join(' ')).toContain('no picture for "amoeba"');
    expect(stopChecks({ ...good, correctWord: 'dog', wrongWords: [{ word: 'puppy', trap: 'other' }], sceneWords: ['cat'], narration: 'A cat eats. It is alive!' }, 2).blocking.join(' ')).toContain('share one emoji');
    expect(stopChecks({ ...good, wrongWords: [{ word: 'rock', trap: 'silly' }] }, 2).blocking.join(' ')).toContain('trap for "rock"');
  });
  it('blocks long sentences, a non-question ask and an unplanned idea', () => {
    const b = stopChecks({ ...good, ask: 'Tap the one that is alive', ideaIndex: 5,
      narration: 'A puppy is a baby dog that eats and drinks and plays and sleeps and grows every single day.' }, 2).blocking.join(' ');
    expect(b).toContain('ask must be one question');
    expect(b).toContain('ideaIndex 5');
    expect(b).toContain('over 12 words');
  });
});

describe('walkChecks + buildStops', () => {
  const second: StopDraft = { ...good, ideaIndex: 1, narration: 'A rock does not eat. It does not grow.', sceneWords: ['rock'],
    imagePrompt: 'a grey rock on the grass', ask: 'Which one is not alive?', correctWord: 'ball',
    wrongWords: [{ word: 'cat', trap: 'other' }, { word: 'tree', trap: 'goes_with' }], why: 'Things that are not alive do not eat or grow.' };
  const third: StopDraft = { ...good, correctWord: 'bird', wrongWords: [{ word: 'shoe', trap: 'other' }] };

  it('needs every idea taught, 3-5 stops and a different answer at each stop', () => {
    expect(walkChecks({ planned: true, ideas: ['a', 'b'], stops: [good, third] }).blocking.join(' ')).toMatch(/3-5 stops.*idea 1/);
    expect(walkChecks({ planned: true, ideas: ['a', 'b'], stops: [good, second, good] }).blocking.join(' ')).toContain('"frog" is the right picture at two stops');
    expect(walkChecks({ planned: true, ideas: ['a', 'b'], stops: [good, second, third] }).blocking).toEqual([]);
  });

  it('builds stops with library pictures, a code-owned order that moves, and a key the boss accepts', () => {
    const ideas = ['Living things grow.', 'Nonliving things do not grow.'];
    const seen = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const stops = buildStops([good, second, third], ideas, seed, [null, 'data:image/png;base64,x', null]);
      const at = stops.map(s => s.options.findIndex(o => o.id === s.correctOptionId));
      at.forEach(i => seen.add(i));
      expect(new Set(at).size).toBeGreaterThan(1);
      expect(stops[0].options.find(o => o.id === stops[0].correctOptionId)).toMatchObject({ word: 'frog', emoji: '🐸', trap: null });
      expect(stops[1].sceneImage).toBe('data:image/png;base64,x');
      expect(stops[0].sceneEmoji).toEqual(['🐶']);
      validateWonderWalkData({ title: 'Alive or not?', bigIdea: 'Living things grow.', domain: 'science', gradeBand: 'K', challengeType: 'which-one', challenges: stops });
    }
    expect(seen.size).toBe(3);
  });
});
