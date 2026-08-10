/**
 * phonemeVoice — the display→voice boundary for literacy DI phonemes.
 *
 * Opened by ear, not by a test: on the first live sound-swap run the tutor was
 * handed "Listen: an. /æ/ … /n/. Add /p/…" and the user's report was *"she does
 * sound funny during that part… the gibberish comes across as a distraction"*.
 * The walk itself was deleted; this module covers the phonemes that CANNOT be
 * deleted because they are the instruction.
 */
import { describe, it, expect } from 'vitest';
import { isSpeakablePhoneme, speakablePhoneme, speakableWalk } from '../phonemeVoice';

describe('phonemeVoice · non-Latin glyphs become sayable', () => {
  it('short vowels use di-letter-sounds’ own spellings, so one child hears one rendering', () => {
    expect(speakablePhoneme('/æ/')).toBe('aaa');
    expect(speakablePhoneme('/ɛ/')).toBe('eee');
    expect(speakablePhoneme('/ɪ/')).toBe('iii');
    expect(speakablePhoneme('/ɑ/')).toBe('ooo');
    expect(speakablePhoneme('/ʌ/')).toBe('uuu');
  });

  it('the breve and macron notations our phonics prompts also invite are covered', () => {
    expect(speakablePhoneme('/ŏ/')).toBe('ooo');
    expect(speakablePhoneme('/ā/')).toBe('ay');
    expect(speakablePhoneme('/ē/')).toBe('ee');
  });

  it('digraph glyphs that are not their own Latin letter are covered', () => {
    expect(speakablePhoneme('/ʃ/')).toBe('shh');
    expect(speakablePhoneme('/θ/')).toBe('th');
    expect(speakablePhoneme('/ŋ/')).toBe('ng');
    expect(speakablePhoneme('/tʃ/')).toBe('ch');
  });

  it('no mapped spelling contains a character outside plain ASCII', () => {
    // The whole point: whatever comes out of here has to be sayable. A mapping
    // that swapped one exotic glyph for another would pass every test above.
    for (const raw of ['/æ/', '/ɛ/', '/ɪ/', '/ɑ/', '/ʌ/', '/ə/', '/ʃ/', '/θ/', '/ŋ/', '/tʃ/', '/aɪ/', '/ɔɪ/']) {
      expect(speakablePhoneme(raw)).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

describe('phonemeVoice · Latin-letter phonemes are left exactly as authored', () => {
  it('passes ASCII through untouched, slashes and all', () => {
    // The user confirmed "Add /p/" reads correctly live. Rewriting it would be
    // guessing at the phoneme, which is worse than leaving a readable glyph.
    for (const raw of ['/k/', '/p/', '/t/', '/b/', '/sh/', '/j/', '//']) {
      expect(speakablePhoneme(raw)).toBe(raw);
    }
  });

  it('/j/ specifically is NOT rewritten — it means two different sounds in our data', () => {
    // IPA /j/ is the "yes" sound; the ad-hoc notation our K-2 prompts also
    // invite uses it for "jump". Code cannot tell which a generation meant.
    expect(speakablePhoneme('/j/')).toBe('/j/');
  });
});

describe('phonemeVoice · the walk degrades rather than speaking a glyph', () => {
  it('renders a walk when every sound is sayable', () => {
    expect(speakableWalk(['/k/', '/æ/', '/t/'])).toBe('/k/ … aaa … /t/');
  });

  it('returns null when ANY sound is unsayable — the caller then drops the walk', () => {
    // Losing a scaffold is recoverable; a tutor reading punctuation at a
    // five-year-old is not.
    expect(speakableWalk(['/k/', '/ɶ/', '/t/'])).toBeNull();
    expect(speakableWalk([])).toBeNull();
  });

  it('isSpeakablePhoneme is the predicate that decides it', () => {
    expect(isSpeakablePhoneme('/æ/')).toBe(true);
    expect(isSpeakablePhoneme('/k/')).toBe(true);
    expect(isSpeakablePhoneme('/ɶ/')).toBe(false);
    expect(isSpeakablePhoneme('//')).toBe(false);
  });
});
