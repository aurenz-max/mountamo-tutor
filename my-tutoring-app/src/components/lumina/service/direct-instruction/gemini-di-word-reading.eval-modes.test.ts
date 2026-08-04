/** L1 eval-mode backfill for di-word-reading (Fork A pool service). */

import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import { generateDiWordReading } from './gemini-di-word-reading';
import { getComponentById } from '../manifest/catalog';

const SHORT_A = new Set(['sam', 'mat', 'cat', 'hat', 'pan', 'map']);

const gen = (
  mode: string,
  intent = 'word reading practice',
  challengeCount = 4,
) => generateDiWordReading(intent, 'kindergarten', {
  intent,
  targetEvalMode: mode,
  challengeCount,
});

describe('catalog and pinned task identities', () => {
  it('registers the four-mode beta ladder in order', () => {
    expect(getComponentById('di-word-reading')?.evalModes?.map((mode) => [mode.evalMode, mode.beta]))
      .toEqual([
        ['cvc_reading', 2.0],
        ['read_word', 2.5],
        ['sight_word', 3.0],
        ['word_reading_review', 3.5],
      ]);
  });

  it('cvc_reading emits only decodable CVC items', async () => {
    const data = await gen('cvc_reading');
    expect(data.challenges.every((item) => item.challengeType === 'cvc_reading')).toBe(true);
    expect(data.challenges.every((item) => item.wordType === 'cvc')).toBe(true);
    expect(data.challenges.every((item) => item.graphemes?.length === 3)).toBe(true);
  });

  it('cvc_reading keeps a named short-vowel scope binding', async () => {
    const data = await gen('cvc_reading', 'read short a CVC words', 6);
    expect(data.challenges).toHaveLength(6);
    expect(data.challenges.every((item) => SHORT_A.has(item.word))).toBe(true);
  });

  it('sight_word emits only whole-word recall items', async () => {
    const data = await gen('sight_word');
    expect(data.challenges.every((item) => item.challengeType === 'sight_word')).toBe(true);
    expect(data.challenges.every((item) => item.wordType === 'sight')).toBe(true);
    expect(data.challenges.every((item) => item.graphemes === undefined)).toBe(true);
  });

  it('read_word preserves the L0 mixed CVC/sight base skill', async () => {
    const data = await gen('read_word');
    expect(data.challenges.every((item) => item.challengeType === 'read_word')).toBe(true);
    expect(new Set(data.challenges.map((item) => item.wordType))).toEqual(new Set(['cvc', 'sight']));
  });

  it('word_reading_review spans all five vowel families plus sight at capacity six', async () => {
    const data = await gen('word_reading_review', 'cumulative word review', 6);
    expect(data.challenges.map((item) => item.word)).toEqual(['the', 'red', 'pig', 'dog', 'sun', 'sam']);
    expect(data.challenges.every((item) => item.challengeType === 'word_reading_review')).toBe(true);
  });

  it('review anchors the objective focus before broadening', async () => {
    const data = await gen('word_reading_review', 'review short a words', 6);
    expect(data.challenges.slice(0, 2).every((item) => SHORT_A.has(item.word))).toBe(true);
    expect(data.challenges.some((item) => !SHORT_A.has(item.word))).toBe(true);
    expect(data.challenges.some((item) => item.wordType === 'sight')).toBe(true);
  });
});

describe('blend, mixed, and routing guardrails', () => {
  it('a curated CVC+sight blend includes both and nothing else', async () => {
    const data = await gen('cvc_reading|sight_word');
    expect(new Set(data.challenges.map((item) => item.challengeType)))
      .toEqual(new Set(['cvc_reading', 'sight_word']));
    expect(new Set(data.challenges.map((item) => item.wordType))).toEqual(new Set(['cvc', 'sight']));
    expect(new Set(data.challenges.map((item) => item.word)).size).toBe(data.challenges.length);
  });

  it('explicit mixed covers all four identities (SP-21)', async () => {
    const data = await gen('mixed');
    expect(new Set(data.challenges.map((item) => item.challengeType)))
      .toEqual(new Set(['cvc_reading', 'read_word', 'sight_word', 'word_reading_review']));
    expect(new Set(data.challenges.map((item) => item.word)).size).toBe(data.challenges.length);
  });

  it('eval-mode identity wins a conflicting content hint', async () => {
    const cvc = await gen('cvc_reading', 'practice sight words');
    const sight = await gen('sight_word', 'blend short a CVC words');
    expect(cvc.challenges.every((item) => item.wordType === 'cvc')).toBe(true);
    expect(sight.challenges.every((item) => item.wordType === 'sight')).toBe(true);
  });

  it('the wrapper prompt receives only the pinned mode doc', async () => {
    mocks.generateContent.mockClear();
    await gen('cvc_reading');
    const call = mocks.generateContent.mock.calls.at(-1)?.[0] as { contents?: string } | undefined;
    expect(call?.contents).toContain('EVAL MODE: Read a CVC Word');
    expect(call?.contents).toContain('"cvc_reading"');
    expect(call?.contents).not.toContain('"sight_word":');
  });

  it('every generated item carries metadata rebuilt from its final menu word', async () => {
    const data = await gen('mixed', 'short a sight word review', 6);
    for (const item of data.challenges) {
      expect(item.id).toContain(item.word);
      expect(item.asrAliases).toContain(item.word);
      if (item.wordType === 'cvc') expect(item.graphemes?.join('')).toBe(item.word);
      else expect(item.graphemes).toBeUndefined();
    }
  });
});
