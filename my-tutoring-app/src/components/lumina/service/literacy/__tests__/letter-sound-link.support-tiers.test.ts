import { describe, expect, it } from 'vitest';
import { resolveLetterSoundSupportScaffold } from '../gemini-letter-sound-link';

/**
 * Support-tier resolver contract for letter-sound-link (/add-support-tiers).
 *
 * The tier withdraws SCAFFOLDING only — it never touches which letter, sound,
 * keyword, or option is correct (nothing tier-shaped reaches the prompt at all;
 * every field here is stamped in code post-parse).
 *
 * Two invariants carry real pedagogy and are asserted directly:
 *  1. Cue text never names the answer dimension — no phoneme slashes, no keyword
 *     words, no bare target letter.
 *  2. The audition-before-commit lever is inert at K (the pre-reader band's
 *     two-tap protocol always wins) and inert for see-hear at every grade (bare
 *     speaker bubbles have no visual identity, so the audition IS the stimulus
 *     channel — withdrawing it would make the item a coin flip, not harder).
 */

const MODES = ['see-hear', 'hear-see', 'keyword-match'] as const;
const KEYWORDS = ['sun', 'apple', 'top', 'itch', 'pig', 'net', 'cat', 'kite', 'egg'];

describe('resolveLetterSoundSupportScaffold — tier mapping', () => {
  it('easy shows the keyword anchor proactively and keeps every cue', () => {
    for (const mode of MODES) {
      const sc = resolveLetterSoundSupportScaffold(mode, 'easy', '1');
      expect(sc.showKeywordAnchor, mode).toBe('proactive');
      expect(sc.strategyHint, mode).toBeTypeOf('string');
      expect(sc.showSharedSoundHint, mode).toBe(true);
      expect(sc.auditionBeforeCommit, mode).toBe(true);
    }
  });

  it('medium reproduces the shipped legacy lines verbatim (medium === untiered render)', () => {
    expect(resolveLetterSoundSupportScaffold('see-hear', 'medium', '1').strategyHint)
      .toBe('Which sound does this letter make?');
    expect(resolveLetterSoundSupportScaffold('hear-see', 'medium', '1').strategyHint)
      .toBe('Tap to hear the sound, then find the letter!');
    expect(resolveLetterSoundSupportScaffold('keyword-match', 'medium', '1').strategyHint)
      .toBe("Which word starts with this letter's sound?");
    for (const mode of MODES) {
      expect(resolveLetterSoundSupportScaffold(mode, 'medium', '1').showKeywordAnchor, mode)
        .toBe('after-miss');
    }
  });

  it('hard withdraws the anchor, both instruction cues, and the shared-sound nudge', () => {
    for (const mode of MODES) {
      const sc = resolveLetterSoundSupportScaffold(mode, 'hard', '1');
      expect(sc.showKeywordAnchor, mode).toBe('never');
      expect(sc.strategyHint, mode).toBeNull();
      expect(sc.protocolHint, mode).toBeNull();
      expect(sc.showSharedSoundHint, mode).toBe(false);
    }
  });
});

describe('resolveLetterSoundSupportScaffold — answer-free cue text', () => {
  it('never names a phoneme, a keyword, or a bare target letter', () => {
    for (const mode of MODES) {
      for (const tier of ['easy', 'medium'] as const) {
        const sc = resolveLetterSoundSupportScaffold(mode, tier, '1');
        const cues = [sc.strategyHint, sc.protocolHint].filter(Boolean) as string[];
        for (const cue of cues) {
          const label = `${mode}/${tier}: "${cue}"`;
          // no /s/-style phoneme notation
          expect(/\/[a-zĕĭŏŭă]+\//.test(cue), label).toBe(false);
          // no keyword word
          for (const kw of KEYWORDS) {
            expect(new RegExp(`\\b${kw}\\b`, 'i').test(cue), `${label} names "${kw}"`).toBe(false);
          }
          // no quoted single letter (e.g. "S")
          expect(/["'][A-Za-z]["']/.test(cue), label).toBe(false);
        }
      }
    }
  });
});

describe('resolveLetterSoundSupportScaffold — band + stimulus guards on the audition lever', () => {
  it('hard withdraws the audition for keyword-match at reader grades', () => {
    expect(resolveLetterSoundSupportScaffold('keyword-match', 'hard', '1').auditionBeforeCommit)
      .toBe(false);
    expect(resolveLetterSoundSupportScaffold('keyword-match', 'hard', '2').auditionBeforeCommit)
      .toBe(false);
  });

  it('K band wins: the audition lever is inert at kindergarten on every mode', () => {
    for (const mode of MODES) {
      expect(resolveLetterSoundSupportScaffold(mode, 'hard', 'K').auditionBeforeCommit, mode)
        .toBe(true);
    }
  });

  it('see-hear never loses its audition — that channel is the stimulus, not a scaffold', () => {
    for (const grade of ['K', '1', '2']) {
      expect(resolveLetterSoundSupportScaffold('see-hear', 'hard', grade).auditionBeforeCommit, grade)
        .toBe(true);
      expect(resolveLetterSoundSupportScaffold('hear-see', 'hard', grade).auditionBeforeCommit, grade)
        .toBe(true);
    }
  });
});
