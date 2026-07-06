/**
 * Spoken-word judge client — the "truth channel" for spoken production.
 *
 * Stateless clip judging over /api/lumina (action: judgeBlendAudio). The
 * Gemini Live tutor session is never involved — it stays the warmth channel.
 *
 * Ladder (bench-validated 2026-07-04, see Blend Judge Lab to re-tune):
 *   1. Azure dual-signal (~400ms): unbiased transcript + per-phoneme
 *      Pronunciation Assessment scores. High-confidence verdicts are final.
 *   2. gemini-flash-latest clip judge (~1.9s): second opinion when Azure is
 *      unsure or errored. NEVER flash-lite — it false-positives minimal pairs.
 *   3. 'unclear' outcome: the calling primitive falls back to its
 *      deterministic interaction (tap-the-picture / Blend button).
 *
 * Outcome policy is ASYMMETRIC by design: 'match' may award credit;
 * 'no-match' is coaching signal only (the tutor responds, nothing is scored
 * against the student); 'unclear' silently degrades to the fallback. A kid
 * who said the word right but got misheard must never see a red X.
 */

import type { BlendJudgeVerdict } from '../service/literacy/gemini-blend-judge';
import type { ChoiceJudgeVerdict } from '../service/literacy/gemini-choice-judge';

export type { BlendJudgeVerdict, ChoiceJudgeVerdict };

export const AZURE_ENGINE = 'azure:pronunciation-assessment';
export const ESCALATION_MODEL = 'gemini-flash-latest';

export type SpokenJudgeOutcome = 'match' | 'no-match' | 'unclear';

export interface SpokenJudgeResult {
  outcome: SpokenJudgeOutcome;
  /** Final verdict from whichever rung decided (null if every rung errored) */
  verdict: BlendJudgeVerdict | null;
  /** True if the LLM rung was consulted */
  escalated: boolean;
}

export interface JudgeClipOptions {
  gradeLevel?: string;
  /** Judge model id; AZURE_ENGINE routes to Pronunciation Assessment */
  model?: string;
  thinkingLevel?: string;
}

/** One judge call. Throws on HTTP/network error. */
export async function judgeClipOnce(
  audioBase64: string,
  targetWord: string,
  opts: JudgeClipOptions = {},
): Promise<BlendJudgeVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'judgeBlendAudio',
      params: {
        audioBase64,
        mimeType: 'audio/wav',
        targetWord,
        gradeLevel: opts.gradeLevel ?? 'Kindergarten',
        model: opts.model ?? AZURE_ENGINE,
        thinkingLevel: opts.thinkingLevel ?? 'MINIMAL',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`judge HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as BlendJudgeVerdict;
}

/** Asymmetric outcome mapping — exported so controllers built on the
 * useVoiceCapture engine map raw verdicts the same way this ladder does. */
export function verdictToOutcome(verdict: BlendJudgeVerdict | null): SpokenJudgeOutcome {
  if (!verdict) return 'unclear';
  if (verdict.isMatch) return 'match';
  return verdict.confidence === 'high' ? 'no-match' : 'unclear';
}
const toOutcome = verdictToOutcome;

// ── Choice lane (closed-set voice selection) ─────────────────────
// Same ladder shape over action judgeChoiceAudio: the judge identifies WHICH
// on-screen option was said (the correct answer is never sent — the caller
// grades). Azure = one plain-recognition call + option matching (~300ms);
// LLM second opinion when Azure is unsure or the transcript matched nothing.

/** One choice-judge call. Throws on HTTP/network error. */
export async function judgeChoiceClipOnce(
  audioBase64: string,
  options: string[],
  opts: JudgeClipOptions = {},
): Promise<ChoiceJudgeVerdict> {
  const res = await fetch('/api/lumina', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'judgeChoiceAudio',
      params: {
        audioBase64,
        mimeType: 'audio/wav',
        options,
        gradeLevel: opts.gradeLevel ?? 'Kindergarten',
        model: opts.model ?? AZURE_ENGINE,
        thinkingLevel: opts.thinkingLevel ?? 'MINIMAL',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`choice judge HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as ChoiceJudgeVerdict;
}

/**
 * Full choice ladder on one clip. Never throws — worst case is a null
 * verdict (treat as "heard nothing actionable").
 */
export async function judgeSpokenChoice(
  audioBase64: string,
  options: string[],
  gradeLevel?: string,
): Promise<ChoiceJudgeVerdict | null> {
  let azureVerdict: ChoiceJudgeVerdict | null = null;
  try {
    azureVerdict = await judgeChoiceClipOnce(audioBase64, options, { gradeLevel, model: AZURE_ENGINE });
  } catch (err) {
    console.warn('[spokenWordJudge] Azure choice rung failed:', err);
  }
  if (azureVerdict && azureVerdict.confidence === 'high') return azureVerdict;
  try {
    return await judgeChoiceClipOnce(audioBase64, options, { gradeLevel, model: ESCALATION_MODEL });
  } catch (err) {
    console.warn('[spokenWordJudge] LLM choice rung failed:', err);
    return azureVerdict;
  }
}

/**
 * Full ladder on one clip: Azure first, LLM second opinion only when Azure
 * is unsure or unreachable. Never throws — worst case is outcome 'unclear'.
 */
export async function judgeSpokenWord(
  audioBase64: string,
  targetWord: string,
  gradeLevel?: string,
): Promise<SpokenJudgeResult> {
  let azureVerdict: BlendJudgeVerdict | null = null;
  try {
    azureVerdict = await judgeClipOnce(audioBase64, targetWord, { gradeLevel, model: AZURE_ENGINE });
  } catch (err) {
    console.warn('[spokenWordJudge] Azure rung failed:', err);
  }
  if (azureVerdict && azureVerdict.confidence === 'high') {
    return { outcome: toOutcome(azureVerdict), verdict: azureVerdict, escalated: false };
  }

  try {
    const llmVerdict = await judgeClipOnce(audioBase64, targetWord, {
      gradeLevel,
      model: ESCALATION_MODEL,
    });
    return { outcome: toOutcome(llmVerdict), verdict: llmVerdict, escalated: true };
  } catch (err) {
    console.warn('[spokenWordJudge] LLM rung failed:', err);
    // Keep whatever Azure said (low confidence → 'unclear' via toOutcome).
    return { outcome: toOutcome(azureVerdict), verdict: azureVerdict, escalated: true };
  }
}
