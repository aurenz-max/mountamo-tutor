/**
 * oral-sentence-studio's misses and levers (`/add-support-tiers`, handoff 22 L4), on real generations: the spoken
 * misses match the catalog, no lever text holds a sentence or an example, a word picture is never a scene picture,
 * and every miss is answered or unanswered by decision.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { LITERACY_CATALOG } from '../../../service/manifest/catalog/literacy';
import { ORAL_SENTENCE_STUDIO_FALLBACKS } from '../../../service/literacy/gemini-oral-sentence-studio';
import { itemsFromChallenges, type OralSentenceStudioItem } from './oralSentenceStudioScript';
import { ORAL_SENTENCE_UNANSWERED, PICTURES_LEVER, STRIP_LEVER, leversOnScreen, oralSentenceLevers, wordPicturesLeak } from './oralSentenceStudioLevers';
import { ORAL_SENTENCE_MISSES, oralSentenceAssignment } from './oralSentenceStudioWorkspace';

const load = (mode: string): OralSentenceStudioItem[] => itemsFromChallenges(JSON.parse(readFileSync(join(__dirname,
  '../../../components/live-activity/runtime/testing/w1-payloads', `oral-sentence-studio.${mode}.levers.json`), 'utf8')).data.challenges);
const generated = [...load('describe_scene'), ...load('use_story_words')];
const entry = LITERACY_CATALOG.find(x => x.id === 'oral-sentence-studio')!.teachingWorkspace!;

describe('oral-sentence-studio levers', () => {
  it('generated items get both levers; carriers both; no lever text holds an example or the scene meaning', () => {
    expect(generated.length).toBeGreaterThan(0);
    for (const item of generated) {
      const levers = oralSentenceLevers(item, []);
      expect(levers.map(l => l.id)).toEqual([STRIP_LEVER, PICTURES_LEVER]);
      const text = [...levers.map(l => `${l.when} ${l.does}`), leversOnScreen(item, [STRIP_LEVER, PICTURES_LEVER]) ?? ''].join(' ');
      for (const s of [...item.challenge.acceptedSentences, item.challenge.sceneMeaning]) expect(text).not.toContain(s.replace(/[.!?]$/, ''));
      for (const l of levers) expect(l.carrier).toBe('both');
    }
  });

  it('leak: a word picture that repeats a scene picture withholds the pictures lever', () => {
    const [item] = generated;
    const leaky = { ...item, challenge: { ...item.challenge, wordEmojis: [item.challenge.objectEmoji, '⭐'] as [string, string] } };
    expect(wordPicturesLeak(leaky)).toBe(true);
    expect(oralSentenceLevers(leaky, []).map(l => l.id)).toEqual([STRIP_LEVER]);
    const fallback = itemsFromChallenges(ORAL_SENTENCE_STUDIO_FALLBACKS.slice(0, 1))[0];
    expect(oralSentenceLevers(fallback, []).map(l => l.id)).toEqual([STRIP_LEVER]);
  });

  it('every catalog miss is spoken, declared, and answered or unanswered by decision', () => {
    expect(entry.levers).toBe(true);
    for (const item of generated) {
      expect(oralSentenceAssignment(item).misses!.map(m => m.id).sort()).toEqual([...ORAL_SENTENCE_MISSES].sort());
      expect([...entry.misses![item.mode]].sort()).toEqual([...ORAL_SENTENCE_MISSES].sort());
      const levers = oralSentenceLevers(item, []);
      for (const miss of ORAL_SENTENCE_MISSES) {
        const answered = levers.some(l => l.answers?.includes(miss));
        expect(answered !== (entry.unanswered?.[item.mode] ?? []).includes(miss), miss).toBe(true);
      }
      expect(entry.unanswered![item.mode]).toEqual(ORAL_SENTENCE_UNANSWERED);
    }
    const levers = oralSentenceLevers(generated[0], []);
    expect(nextLever(levers, 'fragment')).toBe(STRIP_LEVER);
    expect(nextLever(levers, 'word_misused')).toBe(PICTURES_LEVER);
  });
});
