import { describe, expect, it } from 'vitest';
import {
  buildEndingSoundChallenges,
  buildModePlan,
  endingSoundForWord,
  generatePhonemeExplorer,
  phonemeRemediationMoveFor,
  resolvePhonemeSupportScaffold,
} from './gemini-phoneme-explorer';

describe('PhonemeExplorer remediation affordances', () => {
  it.each([
    ['isolate', 'contrast_phoneme'],
    ['ending', 'contrast_phoneme'],
    ['medial', 'contrast_phoneme'],
    ['blend', 'blend_through'],
    ['segment', 'segment_boundary'],
    ['manipulate', 'isolate_operation'],
  ] as const)('maps %s to its structural remediation move', (mode, expected) => {
    expect(phonemeRemediationMoveFor(mode, 'A repeatable wrong sound rule.')).toBe(expected);
  });

  it('leaves baseline generation untagged', () => {
    expect(phonemeRemediationMoveFor('isolate')).toBeUndefined();
  });
});

describe('PhonemeExplorer ending-sound contrast bank', () => {
  it('runs the explicit ending pin without a model call and emits only ending items', async () => {
    const data = await generatePhonemeExplorer({
      topic: 'ending sounds',
      intent: 'Identify the ending sound in a word.',
      gradeContext: 'K',
      grade: 'K',
      raw: { targetEvalMode: 'ending' },
    } as unknown as Parameters<typeof generatePhonemeExplorer>[0]);

    expect(data.challenges).toHaveLength(5);
    expect(data.challenges.every((challenge) => challenge.mode === 'ending')).toBe(true);
  });

  it('keeps all six skills represented in a six-item mixed session', () => {
    expect(buildModePlan(
      ['isolate', 'ending', 'medial', 'blend', 'segment', 'manipulate'],
      6,
    )).toEqual(['isolate', 'ending', 'medial', 'blend', 'segment', 'manipulate']);
  });

  it('builds five distinct auditory items whose answer alone shares the final phoneme', () => {
    const challenges = buildEndingSoundChallenges(5, 'ending sounds') as Array<{
      targetWord: string;
      finalPhoneme: string;
      choices: Array<{ word: string; correct: boolean }>;
    }>;

    expect(challenges).toHaveLength(5);
    expect(new Set(challenges.map((challenge) => challenge.targetWord)).size).toBe(5);

    for (const challenge of challenges) {
      const correct = challenge.choices.filter((choice) => choice.correct);
      const distractors = challenge.choices.filter((choice) => !choice.correct);
      expect(correct).toHaveLength(1);
      expect(challenge.choices).toHaveLength(4);
      expect(challenge.choices.some((choice) => choice.word === challenge.targetWord)).toBe(false);
      expect(endingSoundForWord(challenge.targetWord)).toBe(challenge.finalPhoneme);
      expect(endingSoundForWord(correct[0].word)).toBe(challenge.finalPhoneme);
      expect(distractors.every((choice) => endingSoundForWord(choice.word) !== challenge.finalPhoneme)).toBe(true);
    }
  });

  it('does not make onset or rhyme the answer pattern', () => {
    const challenges = buildEndingSoundChallenges(9, 'all contrasts') as Array<{
      targetWord: string;
      choices: Array<{ word: string; correct: boolean }>;
    }>;

    for (const challenge of challenges) {
      const correct = challenge.choices.find((choice) => choice.correct)!;
      // Curated words are simple one-letter-onset CVCs. Different first letters
      // and different vowel+coda chunks pin the intended anti-cue contract.
      expect(correct.word[0]).not.toBe(challenge.targetWord[0]);
      expect(correct.word.slice(1)).not.toBe(challenge.targetWord.slice(1));
      expect(new Set(challenge.choices.map((choice) => choice.word[0])).size).toBeGreaterThan(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Support tiers — scaffolding withdrawal (axis 1). The resolver is the ONE place
// that decides what a tier withdraws; it is stamped in code post-parse so the tier
// can never change WHICH content the model drew.
// ---------------------------------------------------------------------------

describe('PhonemeExplorer support-tier scaffold resolver', () => {
  it('easy is full help — every scaffold on', () => {
    expect(resolvePhonemeSupportScaffold('isolate', 'easy', '1')).toEqual({
      showChoiceEmoji: true,
      readOptionsAloud: true,
      showExampleWord: true,
      showExampleHint: true,
    });
  });

  it('medium keeps the worked-example card but drops its "starts with" sub-label', () => {
    const s = resolvePhonemeSupportScaffold('isolate', 'medium', '1');
    expect(s.showExampleWord).toBe(true);
    expect(s.showExampleHint).toBe(false);
    // medium withdraws nothing from the answer surface
    expect(s.showChoiceEmoji).toBe(true);
    expect(s.readOptionsAloud).toBe(true);
  });

  it('hard withdraws the worked example, the picture cue and the option read-aloud', () => {
    expect(resolvePhonemeSupportScaffold('isolate', 'hard', '1')).toEqual({
      showChoiceEmoji: false,
      readOptionsAloud: false,
      showExampleWord: false,
      showExampleHint: false,
    });
  });

  it('hard strips the blend cue (label + "+" separators) only in blend mode', () => {
    expect(resolvePhonemeSupportScaffold('blend', 'hard', '2').showBlendCue).toBe(false);
    expect(resolvePhonemeSupportScaffold('blend', 'easy', '2').showBlendCue).toBe(true);
    expect(resolvePhonemeSupportScaffold('isolate', 'hard', '2').showBlendCue).toBeUndefined();
    expect(resolvePhonemeSupportScaffold('manipulate', 'hard', '2').showBlendCue).toBeUndefined();
  });

  it('hard strips the printed operation detail only in manipulate mode', () => {
    expect(resolvePhonemeSupportScaffold('manipulate', 'hard', '1').showOperationDetail).toBe(false);
    expect(resolvePhonemeSupportScaffold('manipulate', 'medium', '1').showOperationDetail).toBe(true);
    expect(resolvePhonemeSupportScaffold('blend', 'hard', '1').showOperationDetail).toBeUndefined();
  });

  it('segment carries only the shared answer-surface flags', () => {
    expect(resolvePhonemeSupportScaffold('segment', 'hard', '2')).toEqual({
      showChoiceEmoji: false,
      readOptionsAloud: false,
    });
  });

  it('ending keeps spoken options at every tier because printed words are hidden', () => {
    expect(resolvePhonemeSupportScaffold('ending', 'hard', '2')).toEqual({
      showChoiceEmoji: false,
      readOptionsAloud: true,
    });
  });

  it('BAND WINS: at K the picture cue and the read-aloud survive the hard tier', () => {
    const k = resolvePhonemeSupportScaffold('isolate', 'hard', 'K');
    expect(k.showChoiceEmoji).toBe(true);
    expect(k.readOptionsAloud).toBe(true);
    // ...but instruction furniture / worked examples still go at K
    expect(k.showExampleWord).toBe(false);
    expect(resolvePhonemeSupportScaffold('blend', 'hard', 'K').showBlendCue).toBe(false);
    expect(resolvePhonemeSupportScaffold('manipulate', 'hard', 'K').showOperationDetail).toBe(false);
  });

  it('never emits a field that could change content, count or the answer', () => {
    for (const mode of ['isolate', 'ending', 'medial', 'blend', 'segment', 'manipulate'] as const) {
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        for (const grade of ['K', '1', '2']) {
          const keys = Object.keys(resolvePhonemeSupportScaffold(mode, tier, grade));
          expect(keys.every((k) => k.startsWith('show') || k === 'readOptionsAloud')).toBe(true);
        }
      }
    }
  });
});
