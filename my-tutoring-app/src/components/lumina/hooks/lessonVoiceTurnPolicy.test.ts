import { describe, expect, it } from 'vitest';
import { resolveLessonAudioInput, resolveLessonVoiceTurnConfig } from './lessonVoiceTurnPolicy';

describe('lesson voice turn close policy', () => {
  it('always assigns lesson turn authority to the client', () => {
    expect(resolveLessonAudioInput({ manual_activity: false, silence_duration_ms: 700 }))
      .toEqual({ manual_activity: true, silence_duration_ms: 700 });
  });

  it('gives held phonemes the tightest close', () => {
    expect(resolveLessonVoiceTurnConfig('di-letter-sounds').silenceCloseMs).toBe(300);
  });

  it('keeps sentence reading looser than one-word production', () => {
    expect(resolveLessonVoiceTurnConfig('di-sentence-reading').silenceCloseMs)
      .toBeGreaterThan(resolveLessonVoiceTurnConfig('di-word-reading').silenceCloseMs!);
  });

  it('uses a longer close for ordinary conversation', () => {
    expect(resolveLessonVoiceTurnConfig('states-of-matter').silenceCloseMs).toBe(900);
  });
});
