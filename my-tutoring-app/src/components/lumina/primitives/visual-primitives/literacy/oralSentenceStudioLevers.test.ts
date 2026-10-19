/**
 * oral-sentence-studio's misses and levers (`/add-support-tiers`, handoff 22 L4), on real generations: no lever text
 * holds a sentence or an example, a word picture is never a scene picture, and the lever set answers every miss the
 * card does not list as unanswered.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { ORAL_SENTENCE_STUDIO_FALLBACKS } from '../../../service/literacy/gemini-oral-sentence-studio';
import { ORAL_SENTENCE_MISSES, oralSentenceStudioCard } from './oralSentenceStudio.card';
import { itemsFromChallenges, oralSentenceSpokenMisses, type OralSentenceStudioItem } from './oralSentenceStudioDomain';
import { ORAL_SENTENCE_LEVERS, PICTURES_LEVER, STRIP_LEVER, wordPicturesLeak } from './oralSentenceStudioLevers';

const load = (mode: string): OralSentenceStudioItem[] => itemsFromChallenges(JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads', `oral-sentence-studio.${mode}.levers.json`), 'utf8')).data.challenges);
const generated = [...load('describe_scene'), ...load('use_story_words')];
const declare = (item: OralSentenceStudioItem) => ORAL_SENTENCE_LEVERS.declare(item, undefined, []);

describe('oral-sentence-studio levers', () => {
  it('generated items get both levers; carriers both; no lever text holds an example or the scene meaning', () => {
    expect(generated.length).toBeGreaterThan(0);
    for (const item of generated) {
      const levers = declare(item);
      expect(levers.map(l => l.id)).toEqual([STRIP_LEVER, PICTURES_LEVER]);
      const text = [...levers.map(l => `${l.when} ${l.does}`),
        ORAL_SENTENCE_LEVERS.onScreen(item, undefined, [STRIP_LEVER, PICTURES_LEVER])].join(' ');
      for (const s of [...item.challenge.acceptedSentences, item.challenge.sceneMeaning]) expect(text).not.toContain(s.replace(/[.!?]$/, ''));
      for (const l of levers) expect(l.carrier).toBe('both');
    }
  });

  it('leak: a word picture that repeats a scene picture withholds the pictures lever', () => {
    const [item] = generated;
    const leaky = { ...item, challenge: { ...item.challenge, wordEmojis: [item.challenge.objectEmoji, '⭐'] as [string, string] } };
    expect(wordPicturesLeak(leaky)).toBe(true);
    expect(declare(leaky).map(l => l.id)).toEqual([STRIP_LEVER]);
    const fallback = itemsFromChallenges(ORAL_SENTENCE_STUDIO_FALLBACKS.slice(0, 1))[0];
    expect(declare(fallback).map(l => l.id)).toEqual([STRIP_LEVER]);
  });

  it('every miss is spoken, and answered by a lever or unanswered on the card', () => {
    for (const item of generated) {
      const mode = oralSentenceStudioCard.modes[item.mode];
      expect(oralSentenceSpokenMisses(item).map(m => m.id)).toEqual([...ORAL_SENTENCE_MISSES]);
      const levers = declare(item);
      for (const miss of ORAL_SENTENCE_MISSES) {
        const answered = levers.some(l => l.answers?.includes(miss));
        expect(answered !== (mode.unanswered ?? []).includes(miss), miss).toBe(true);
      }
    }
    const levers = declare(generated[0]);
    expect(nextLever(levers, 'fragment')).toBe(STRIP_LEVER);
    expect(nextLever(levers, 'word_misused')).toBe(PICTURES_LEVER);
  });
});
