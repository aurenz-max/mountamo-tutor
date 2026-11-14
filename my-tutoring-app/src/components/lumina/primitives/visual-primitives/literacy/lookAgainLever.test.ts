import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { buildWordReadingItems } from '../direct-instruction/diWordReadingDomain';
import { WORD_LEVERS } from '../direct-instruction/diWordReadingLevers';
import { LOOK_AGAIN_LEVER, lookAgainAt, lookAgainFact } from './lookAgainLever';
import { blendWords } from './phonicsBlenderDomain';
import { BLEND_LEVERS } from './phonicsBlenderLevers';

const MISSES = [['first_sound_changed', 0, 'first'], ['middle_sound_changed', 1, 'middle'], ['last_sound_changed', 2, 'last']] as const;
const tiles = (w: string) => ({ id: w, targetWord: w, phonemes: w.split('').map((letters, i) => ({ id: `${w}-${i}`, sound: `/${letters}/`, letters })) });
const blend = blendWords({ words: [tiles('cat'), tiles('dog')], patternType: 'cvc', supportTier: 'medium' } as never);
const [pan] = buildWordReadingItems([{ id: 'p', challengeType: 'cvc_reading', word: 'pan', wordType: 'cvc', graphemes: ['p', 'a', 'n'] }]);
const [the] = buildWordReadingItems([{ id: 't', challengeType: 'sight_word', word: 'the', wordType: 'sight' }]);

describe('look_again', () => {
  it.each(MISSES)('%s rings letter %i and the fact names the place only', (miss, at, place) => {
    expect(lookAgainAt(3, miss)).toEqual({ at });
    const fact = lookAgainFact({ at });
    expect(fact).toContain(`the ${place} letter`);
    // Leak rule: a place, never a letter, a sound or a word.
    expect(fact).not.toMatch(/"|\/[a-z]\/|\bcat\b|\bpan\b/);
  });

  it('is not offered before a one-sound-off read, after another miss, or on a word that is not three sounds', () => {
    for (const miss of [undefined, 'sounds_no_word', 'letter_name', 'read_backwards']) {
      expect(lookAgainAt(3, miss)).toBeNull();
      expect(BLEND_LEVERS.declare(blend[0], { words: blend, segmentation: 'full' }, [], miss).map(l => l.id)).not.toContain(LOOK_AGAIN_LEVER);
      expect(WORD_LEVERS.declare(pan, { items: [pan] }, [], miss).map(l => l.id)).not.toContain(LOOK_AGAIN_LEVER);
    }
    expect(lookAgainAt(4, 'last_sound_changed')).toBeNull();
    expect(WORD_LEVERS.declare(the, { items: [the] }, [], 'last_sound_changed').map(l => l.id)).not.toContain(LOOK_AGAIN_LEVER);
  });

  it.each(MISSES)('%s: it is the next lever on phonics-blender at every tier and on di-word-reading', (miss) => {
    for (const segmentation of ['full', 'word', 'none'] as const) {
      expect(nextLever(BLEND_LEVERS.declare(blend[0], { words: blend, segmentation }, [], miss), miss)).toBe(LOOK_AGAIN_LEVER);
    }
    expect(nextLever(WORD_LEVERS.declare(pan, { items: [pan] }, [], miss), miss)).toBe(LOOK_AGAIN_LEVER);
  });

  it('the scene fact keeps the place of the miss it was pulled after, whatever the learner says next', () => {
    const on = { [LOOK_AGAIN_LEVER]: 'last_sound_changed' };
    expect(BLEND_LEVERS.onScreen(blend[0], { words: blend, segmentation: 'full' }, [LOOK_AGAIN_LEVER], on)).toContain('the last letter');
    expect(WORD_LEVERS.onScreen(pan, { items: [pan] }, [LOOK_AGAIN_LEVER], on)).toContain('the last letter');
    expect(BLEND_LEVERS.onScreen(blend[0], { words: blend, segmentation: 'full' }, [LOOK_AGAIN_LEVER])).toBe('');
  });
});
