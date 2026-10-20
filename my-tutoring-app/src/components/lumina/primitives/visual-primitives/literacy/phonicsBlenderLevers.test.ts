/**
 * phonics-blender's lever set (`/add-support-tiers`, handoff 24, on the boss since 10-20): on every saved payload, each
 * miss has a lever, the name/sound model uses a letter no session word has, and the practice word is never a session
 * word or its ending; the build's levers come from the shared letter build's helpers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { phonicsBlenderCard } from './phonicsBlender.card';
import { blendItems, phonicsBlenderItems, type BlendWord, type Segmentation } from './phonicsBlenderDomain';
import { BLEND_LEVERS, nameModelFor, nameModelLeak, practiceLeak, shortWordFor } from './phonicsBlenderLevers';
import type { PhonicsBlenderData } from './PhonicsBlender';

const MODES = ['cvc', 'cvce_blend', 'digraph', 'advanced'] as const;
const load = (mode: string) => JSON.parse(readFileSync(join(__dirname, '../../../components/live-activity/runtime/testing/w1-payloads',
  `phonics-blender.${mode}.json`), 'utf8')).data as PhonicsBlenderData;
const wordsOf = (mode: string) => phonicsBlenderItems(load(mode)) as BlendWord[];
const ctx = (words: readonly BlendWord[], segmentation: Segmentation) => ({ words, segmentation });

describe.each(MODES)('%s (saved payload)', mode => {
  const words = wordsOf(mode);

  it('every item is its mode; every miss is answered on a joined row and on a split row; the ladder picks the lever', () => {
    expect(phonicsBlenderCard.levers).toBe(true);
    for (const seg of ['full', 'none'] as Segmentation[]) {
      for (const item of words) {
        expect(item.mode).toBe(mode);
        const levers = BLEND_LEVERS.declare(item, ctx(words, seg), []);
        const answered = new Set(levers.flatMap(l => l.answers ?? []));
        for (const miss of phonicsBlenderCard.modes[mode].misses) {
          expect(answered.has(miss), `${item.targetWord} ${seg} ${miss}`).toBe(true);
          expect(nextLever(levers, miss)).toBeTruthy();
        }
      }
    }
  });

  it('help levers are visual except the name/sound model, which is on a letter no session word has', () => {
    const model = nameModelFor(words)!;
    expect(model).toBeTruthy();
    expect(nameModelLeak(model, words)).toBe(false);
    for (const l of BLEND_LEVERS.declare(words[0], ctx(words, 'full'), [])) {
      expect(l.carrier).toBe(l.id === 'name_sound_model' ? 'both' : 'shown');
      expect(l.does).not.toMatch(new RegExp(`\\b${words[0].targetWord}\\b`, 'i'));
    }
  });

  it('the practice word is shorter by one step, a session word never, and a two-letter word never a session ending', () => {
    for (const item of words) {
      const practice = shortWordFor(item, words)!;
      expect(practice, item.targetWord).toBeTruthy();
      expect(practiceLeak(practice.targetWord, words)).toBe(false);
      expect(practice.id).toBe(`${item.id}~simpler`);
      expect(practice).toMatchObject({ mode: item.mode, supportTier: item.supportTier });
      expect(practice.targetWord.length).toBeLessThan(mode === 'cvc' ? 3 : 4);
      expect(practice.phonemes.map(p => p.letters).join('')).toBe(practice.targetWord);
      expect(BLEND_LEVERS.simpler(item, ctx(words, 'full'), 'short_word')).toEqual(practice);
    }
  });
});

it('sound_dots only on a joined row, blend_slide only on a split one', () => {
  const words = wordsOf('cvc');
  const ids = (seg: Segmentation) => BLEND_LEVERS.declare(words[0], ctx(words, seg), []).map(l => l.id);
  expect(ids('none')).toEqual(['sound_dots', 'tracking_arrow', 'name_sound_model', 'short_word']);
  expect(ids('full')).toEqual(['blend_slide', 'tracking_arrow', 'name_sound_model', 'short_word']);
});

it('practice leak: "at" is refused on a session with "cat"; a session word is refused', () => {
  const items = blendItems([{ id: 'w', targetWord: 'cat', phonemes: [] }]);
  expect(practiceLeak('at', items)).toBe(true);
  expect(practiceLeak('cat', items)).toBe(true);
  expect(practiceLeak('up', items)).toBe(false);
});

it('name_sound_model: its description names no model letter (read before the pull); the fact names it once pulled', () => {
  const words = wordsOf('cvc');
  const m = nameModelFor(words)!;
  const lever = BLEND_LEVERS.declare(words[0], ctx(words, 'full'), []).find(l => l.id === 'name_sound_model')!;
  expect(lever.does).not.toMatch(new RegExp(`\\b(${m.letter}|${m.name}|${m.sound})\\b`, 'i'));
  expect(BLEND_LEVERS.onScreen(words[0], ctx(words, 'full'), ['name_sound_model'])).toContain(`another letter, ${m.letter.toUpperCase()}`);
});

it('the model comes by the lesson tier: easy before a try, hard never before one; a session with no tier is medium', () => {
  const words = wordsOf('cvc');
  expect(BLEND_LEVERS.support({ ...words[0], supportTier: 'easy' })).toMatch(/^before the learner tries, pull the model lever \(name_sound_model\)/);
  expect(BLEND_LEVERS.support({ ...words[0], supportTier: 'hard' })).not.toMatch(/^before the learner tries/);
  expect(phonicsBlenderItems({ ...load('cvc'), supportTier: undefined })[0].supportTier).toBe('medium');
});

it('build_blend: the pattern card, a model on other tiles and a smaller bank answer every miss the build names', () => {
  const builds = phonicsBlenderItems(load('build_blend'));
  expect(builds.length).toBeGreaterThan(0);
  const { misses, unanswered = [] } = phonicsBlenderCard.modes.build_blend;
  for (const item of builds) {
    expect(item.mode).toBe('build_blend');
    const levers = BLEND_LEVERS.declare(item, ctx([], 'full'), []);
    expect(levers.map(l => l.id)).toEqual(['pattern_card', 'model_word', 'small_bank']);
    const answered = new Set(levers.flatMap(l => l.answers ?? []));
    for (const miss of misses) if (!unanswered.includes(miss)) expect(answered.has(miss), miss).toBe(true);
    // The card and the model name no word that answers this ask.
    const facts = BLEND_LEVERS.onScreen(item, ctx([], 'full'), ['pattern_card', 'model_word']);
    if (item.mode === 'build_blend') for (const ex of item.examples) expect(facts).not.toMatch(new RegExp(`\\b${ex}\\b`));
    const small = BLEND_LEVERS.simpler(item, ctx([], 'full'), 'small_bank');
    expect(small).toMatchObject({ id: `${item.id}~small`, mode: 'build_blend', ways: 1 });
  }
});
