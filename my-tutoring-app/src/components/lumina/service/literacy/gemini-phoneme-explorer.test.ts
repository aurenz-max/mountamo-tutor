import { describe, expect, it } from 'vitest';
import {
  phonemeRemediationMoveFor,
  resolvePhonemeSupportScaffold,
} from './gemini-phoneme-explorer';

describe('PhonemeExplorer remediation affordances', () => {
  it.each([
    ['isolate', 'contrast_phoneme'],
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
    for (const mode of ['isolate', 'blend', 'segment', 'manipulate'] as const) {
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        for (const grade of ['K', '1', '2']) {
          const keys = Object.keys(resolvePhonemeSupportScaffold(mode, tier, grade));
          expect(keys.every((k) => k.startsWith('show') || k === 'readOptionsAloud')).toBe(true);
        }
      }
    }
  });
});
