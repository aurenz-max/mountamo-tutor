import { Type, type Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { systemOne, typesafeConfigured } from '../manifest/typesafe/typesafeClient';
import {
  SENTENCE_QUESTIONS, WORD_BUILD_QUESTIONS, WRITING_QUESTIONS, decideWordBuild, questionsFor, secondOpinion, confirmNearPass, STRICT_FITS, wordBuildRequestError, wordBuildState,
  type WordBuildJudgeRequest, type WordBuildVerdict,
} from './wordBuildDecision';

/**
 * The shared literacy build judge, server half (route action `judgeWordBuild`). Jev answers the two typed questions
 * in `wordBuildDecision.ts` and code decides; a Jev rejection gets flash-latest's second opinion (`secondOpinion`).
 * When TypeSafe is not configured or fails, flash-latest alone answers the same two questions as JSON (open-builder's
 * judge model). It never talks to the learner: the verdict reaches the
 * tutor as facts.
 */
const FALLBACK_MODEL = 'gemini-flash-latest';

const fallbackSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    real_word: { type: Type.BOOLEAN },
    fits_ask: { type: Type.STRING, enum: ['fits', 'partly', 'no'] },
  },
  required: ['real_word', 'fits_ask'],
};

async function askFlash(r: WordBuildJudgeRequest): Promise<WordBuildVerdict> {
  const q = r.unit === 'writing' ? WRITING_QUESTIONS : r.unit === 'sentence' ? SENTENCE_QUESTIONS : WORD_BUILD_QUESTIONS;
  const res = await ai.models.generateContent({
    model: FALLBACK_MODEL,
    contents: `${JSON.stringify(wordBuildState(r))}\n\nreal_word: ${q.real_word.instructions}\n\nfits_ask: `
      + `${q.fits_ask.instructions} ${Object.entries(q.fits_ask.criteria).map(([k, v]) => `"${k}": ${v}`).join(' ')}`,
    config: { responseMimeType: 'application/json', responseSchema: fallbackSchema, temperature: 0 },
  });
  const out = JSON.parse(res.text ?? '{}') as { real_word?: boolean; fits_ask?: string };
  const fits = r.only === 'real_word' || out.fits_ask === 'fits' ? 1 : 0;
  return decideWordBuild(out.real_word === true ? 1 : 0, fits, 'flash');
}

export async function judgeWordBuild(r: WordBuildJudgeRequest): Promise<WordBuildVerdict> {
  const bad = wordBuildRequestError(r);
  if (bad) throw new Error(`judgeWordBuild: ${bad}`);
  if (r.judge !== 'flash' && typesafeConfigured()) {
    try {
      const { answers } = await systemOne(wordBuildState(r), questionsFor(r), { signal: AbortSignal.timeout(12000) });
      const fitsOptions = 'fits_ask' in answers
        ? (answers as unknown as { fits_ask: { probabilities: Record<string, number> } }).fits_ask.probabilities : undefined;
      const jev = { ...decideWordBuild(answers.real_word.noul, fitsOptions ? fitsOptions.fits ?? 0 : 1, 'jev'),
        ...(fitsOptions ? { fitsOptions } : {}) };
      if (jev.met && r.strict && jev.fits < STRICT_FITS) return confirmNearPass(jev, await askFlash(r));
      return jev.met ? jev : secondOpinion(jev, await askFlash(r));
    } catch (err) {
      console.warn('[judgeWordBuild] Jev unavailable, using flash-latest:', err instanceof Error ? err.message : err);
    }
  }
  return askFlash(r);
}
