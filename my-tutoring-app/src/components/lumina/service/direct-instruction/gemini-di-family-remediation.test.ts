/** Family sweep for code-owned DI misconception remediation. */

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn().mockResolvedValue({ text: '' }),
}));
vi.mock('../geminiClient', () => ({
  ai: { models: { generateContent: mocks.generateContent } },
}));

import {
  generateDiLetterSounds,
  resolveDiRemediationMove as resolveLetterMove,
} from './gemini-di-letter-sounds';
import {
  generateDiWordReading,
  resolveDiRemediationMove as resolveWordMove,
} from './gemini-di-word-reading';
import {
  generateDiSentenceReading,
  resolveDiRemediationMove as resolveSentenceMove,
} from './gemini-di-sentence-reading';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.generateContent.mockClear();
});

const withStableRandom = async <T,>(run: () => Promise<T>): Promise<T> => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.37);
  const result = await run();
  random.mockRestore();
  return result;
};

describe('di-letter-sounds remediation', () => {
  const nameFocus = 'For letter sounds, the student says the letter name instead of its sound.';
  const pairFocus = 'For letter sounds, the student confuses m/n.';

  it('resolves only reviewed sound diagnoses', () => {
    expect(resolveLetterMove('letter_sound', nameFocus)).toBe('name_for_sound');
    expect(resolveLetterMove('letter_sound_review', pairFocus)).toBe('confusable_sound_pair');
    expect(resolveLetterMove('letter_sound', 'The student is unsure.')).toBeNull();
  });

  it('prioritizes acoustically distinct continuants without leaking focus', async () => {
    mocks.generateContent.mockResolvedValueOnce({
      text: JSON.stringify({ title: 'Sound Time', targetLetters: ['a', 'e', 'i', 'o'] }),
    });
    const data = await generateDiLetterSounds('letter sounds', 'kindergarten', {
      targetEvalMode: 'letter_sound', challengeCount: 4, remediationFocus: nameFocus,
    });
    expect(data.challenges.slice(0, 2).map((challenge) => challenge.letter)).toEqual(['m', 's']);
    expect(JSON.stringify(data)).not.toContain(nameFocus);
    expect(mocks.generateContent.mock.calls.at(-1)?.[0]?.contents).not.toContain(nameFocus);
  });

  it('puts a diagnosed pair together, but never breaks an easy composition window', async () => {
    const untiered = await generateDiLetterSounds('letter sounds', 'kindergarten', {
      targetEvalMode: 'letter_sound', challengeCount: 4, remediationFocus: pairFocus,
    });
    expect(untiered.challenges.slice(0, 2).map((challenge) => challenge.letter)).toEqual(['m', 'n']);

    const easy = await generateDiLetterSounds('letter sounds', 'kindergarten', {
      targetEvalMode: 'letter_sound', challengeCount: 4, difficulty: 'easy', remediationFocus: pairFocus,
    });
    const letters = easy.challenges.map((challenge) => challenge.letter);
    expect(letters.includes('m') && letters.includes('n')).toBe(false);
    expect(easy.challenges.every((challenge) => challenge.supportTier === 'easy')).toBe(true);
  });
});

describe('di-word-reading remediation', () => {
  const stopFocus = 'During CVC word reading, the student sounds out each letter but stops without saying the whole word.';
  const neighborFocus = 'During word reading, the student makes an initial consonant substitution and reads a near-neighbor word.';
  const sightFocus = 'During sight-word reading, the student tries to sound out the irregular sight word instead of recalling it.';

  const generateWord = (topic: string, mode: string, focus?: string) =>
    generateDiWordReading(topic, 'kindergarten', {
      intent: topic, targetEvalMode: mode, challengeCount: 4,
      ...(focus ? { remediationFocus: focus } : {}),
    });

  it('maps each diagnosis only to compatible modes', () => {
    expect(resolveWordMove('cvc_reading', stopFocus)).toBe('stops_before_whole_word');
    expect(resolveWordMove('cvc_reading', neighborFocus)).toBe('near_neighbor_read');
    expect(resolveWordMove('sight_word', sightFocus)).toBe('sounds_out_sight_word');
    expect(resolveWordMove('cvc_reading', sightFocus)).toBeNull();
    expect(resolveWordMove('sight_word', stopFocus)).toBeNull();
  });

  it('prefers smooth CVC transfer words and a tight same-position contrast', async () => {
    const smooth = await generateWord('short u CVC words', 'cvc_reading', stopFocus);
    expect(smooth.challenges.slice(0, 2).map((challenge) => challenge.word)).toEqual(['sun', 'run']);

    const contrast = await generateWord('short a CVC words', 'cvc_reading', neighborFocus);
    const [left, right] = contrast.challenges.slice(0, 2).map((challenge) => challenge.word);
    expect(left.slice(1)).toBe(right.slice(1));
    expect(left[0]).not.toBe(right[0]);
  });

  it('keeps sight remediation inside sight slots and preserves null-run compatibility', async () => {
    const sight = await generateWord('sight words', 'sight_word', sightFocus);
    expect(sight.challenges.slice(0, 2).map((challenge) => challenge.word)).toEqual(['the', 'to']);
    expect(sight.challenges.every((challenge) => challenge.wordType === 'sight')).toBe(true);
    expect(JSON.stringify(sight)).not.toContain(sightFocus);
    expect(mocks.generateContent.mock.calls.at(-1)?.[0]?.contents).not.toContain(sightFocus);

    const baseline = await generateWord('short a CVC words', 'cvc_reading');
    const conflict = await generateWord('short a CVC words', 'cvc_reading', sightFocus);
    expect(conflict).toEqual(baseline);
  });
});

describe('di-sentence-reading remediation', () => {
  const dropFocus = 'When reading a sentence, the student skips the function word "is".';
  const neighborFocus = 'When reading a sentence, the student substitutes a near-neighbor word such as hen for pen.';
  const orderFocus = 'When reading a sentence, the student swaps the word order or adds a word.';

  const generateSentence = (topic: string, focus?: string, difficulty?: string) =>
    withStableRandom(() => generateDiSentenceReading(topic, 'first grade', {
      intent: topic, targetEvalMode: 'read_sentence', challengeCount: 5,
      ...(focus ? { remediationFocus: focus } : {}),
      ...(difficulty ? { difficulty } : {}),
    }));

  it('maps the three bounded sentence signatures and abstains on vague focus', () => {
    expect(resolveSentenceMove('read_sentence', dropFocus)).toBe('drops_function_word');
    expect(resolveSentenceMove('read_sentence', neighborFocus)).toBe('near_neighbor_word');
    expect(resolveSentenceMove('read_sentence', orderFocus)).toBe('word_order_or_addition');
    expect(resolveSentenceMove('read_sentence', 'The student skips the word.')).toBeNull();
  });

  it('targets medial function words and curated CVC contrasts without leakage', async () => {
    const dropBaseline = await generateSentence('sentence reading');
    const dropped = await generateSentence('sentence reading', dropFocus);
    expect(dropped.challenges.map((challenge) => challenge.text))
      .not.toEqual(dropBaseline.challenges.map((challenge) => challenge.text));
    expect(dropped.challenges.filter((challenge) =>
      challenge.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).slice(0, -1).includes('is'),
    ).length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(dropped)).not.toContain(dropFocus);
    expect(mocks.generateContent.mock.calls.at(-1)?.[0]?.contents).not.toContain(dropFocus);

    const contrastBaseline = await generateSentence('sentence reading');
    const contrast = await generateSentence('sentence reading', neighborFocus);
    expect(contrast.challenges.map((challenge) => challenge.text))
      .not.toEqual(contrastBaseline.challenges.map((challenge) => challenge.text));
    expect(contrast.challenges.filter((challenge) => /\b(?:hen|pen)\b/i.test(challenge.text)).length)
      .toBeGreaterThanOrEqual(2);
  });

  it('targets repeated grammatical slots while preserving the hard length band', async () => {
    const baseline = await generateSentence('sentence reading', undefined, 'hard');
    const data = await generateSentence('sentence reading', orderFocus, 'hard');
    expect(data.challenges.map((challenge) => challenge.text))
      .not.toEqual(baseline.challenges.map((challenge) => challenge.text));
    expect(data.challenges.every((challenge) => challenge.wordCount >= 7 && challenge.wordCount <= 8)).toBe(true);
    expect(data.challenges.every((challenge) => challenge.supportTier === 'hard')).toBe(true);
    expect(data.challenges.filter((challenge) => {
      const tokens = challenge.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
      return ['the', 'a', 'is', 'in', 'on', 'and', 'to', 'can', 'has', 'had', 'up']
        .some((word) => tokens.filter((token) => token === word).length >= 2);
    }).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps blank and unsupported focus byte-compatible', async () => {
    const baseline = await generateSentence('sentence reading');
    expect(await generateSentence('sentence reading', '   ')).toEqual(baseline);
    expect(await generateSentence('sentence reading', 'The learner needs practice.')).toEqual(baseline);
  });
});
