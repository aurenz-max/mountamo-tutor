import 'server-only';
import { Type, Schema } from '@google/genai';
import { ai } from '../../service/geminiClient';
import {
  type DiagnosisEvidence,
  type MisconceptionResult,
  type EvidenceTier,
  classifyEvidenceTier,
} from './types';

/**
 * S2 — The shared misconception distiller.
 *
 * One schema-constrained Gemini call, built like a judge (response schema,
 * asymmetric outcomes, honest abstain). It turns a DiagnosisEvidence packet
 * into a single student-model sentence that can be used VERBATIM as a
 * generation instruction for the next problem — or it abstains.
 *
 * Design rulings this module enforces (PRD §3, §6):
 *  - Model is flash-latest, NEVER flash-lite (judge-quality ruling).
 *  - Abstain is success. A distiller that writes fewer, truer misconceptions
 *    beats one that always produces something.
 *  - `low` confidence is downgraded to an abstain (below-threshold rule).
 *  - The evidenceTier is set by CODE from evidence presence, not by the model.
 *  - Never throws: all failures resolve to an abstain.
 *  - No leakage: the output is a prompt input, never student-visible copy. The
 *    prompt forbids restating the score or emitting answer text.
 *
 * This file is server-only (it holds the Gemini key path). The Diagnosis Lab
 * and any client caller reach it through the `/api/lumina` `distillMisconception`
 * action, never by importing it.
 */

// The model returns these fields; `evidenceTier` is stamped by code afterward.
const misconceptionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    abstain: {
      type: Type.BOOLEAN,
      description:
        'true when there is no consistent mental model to diagnose (single slip, arithmetic error, guess, or inconsistent errors). Prefer abstaining over guessing.',
    },
    misconceptionText: {
      type: Type.STRING,
      description:
        'When abstain is false: ONE sentence in student-model form describing the wrong rule the student is applying ("The student reads X as Y, so ..."). Empty string when abstaining. Never contains the correct answer, a number the student should produce, or teaching advice.',
    },
    confidence: {
      type: Type.STRING,
      enum: ['high', 'medium', 'low'],
      description:
        'high = a clear, repeated signature; medium = a plausible single-instance pattern; low = unsure. low is treated as an abstain.',
    },
    reason: {
      type: Type.STRING,
      description:
        'When abstain is true: one short sentence on why no misconception could be diagnosed. Empty string otherwise.',
    },
  },
  required: ['abstain', 'misconceptionText', 'confidence', 'reason'],
};

interface RawDiagnosis {
  abstain: boolean;
  misconceptionText: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface DistillOptions {
  /** 0-100. Combined with `success` to confirm this was a failure worth diagnosing. */
  score?: number;
  success?: boolean;
  /** Optional context that sharpens framing (never changes the abstain logic). */
  subskillId?: string;
  evalMode?: string;
  gradeLevel?: string;
}

/**
 * Gate: is this failure worth a distiller call at all? Pure and cheap — the
 * caller runs it before spending an LLM call. Returns the tier the call would
 * use, or 'none' if the engine should stay silent.
 */
export function shouldDistill(
  evidence: DiagnosisEvidence | null | undefined,
  opts: DistillOptions = {},
): EvidenceTier {
  const failed = opts.success === false || (typeof opts.score === 'number' && opts.score < 60);
  if (!failed) return 'none';
  return classifyEvidenceTier(evidence);
}

function buildPrompt(
  evidence: DiagnosisEvidence,
  tier: 'judge' | 'structured',
  opts: DistillOptions,
): string {
  const grade = opts.gradeLevel ? ` (grade ${opts.gradeLevel})` : '';
  const priors =
    evidence.priorAttempts && evidence.priorAttempts.length
      ? evidence.priorAttempts
          .map((a, i) => `  ${i + 1}. asked: ${a.challenge}\n     student did: ${a.observed}`)
          .join('\n')
      : '  (none recorded this session)';

  const judgeBlock =
    tier === 'judge' && evidence.judgeFeedback
      ? `\nA JUDGE ALREADY EVALUATED THIS WORK. Reason primarily from the judge's account of why it fell short:\n"""${evidence.judgeFeedback}"""\n`
      : '';

  return `You are an expert learning diagnostician${grade}. You are modeling ONE student's mental model from a failed attempt. Your output is not feedback for the student — it is a design spec for the NEXT problem, so it must be usable verbatim as a generation instruction.

THE FAILURE
- Challenge: ${evidence.challengeSummary}
- Pedagogically correct outcome: ${evidence.expected}
- What the student actually did: ${evidence.observed}
- Earlier attempts on the same skill this session:
${priors}
${judgeBlock}
YOUR TASK
Decide whether these observations reveal a CONSISTENT WRONG RULE the student is applying — a misconception — or whether they are just a slip, a guess, or noise.

A good misconception is:
- Student-model form — a claim about the student's head ("the student reads 'fewer' as asking WHICH amount is smaller"), not a restatement of the score.
- Predictive — it tells you the student's next wrong answer before they give it.
- Generative — a specific distractor falls straight out of it.
- ONE sentence. No teaching advice ("needs to practice…"), no correct rule, and no answer text or target number.

ABSTAIN (set abstain=true) when:
- There is only a single attempt with no corroborating pattern, and the error looks like an arithmetic slip or a guess.
- The earlier attempts contradict each other — no single wrong rule explains them all.
- You would have to invent a story to explain the error.
Abstaining is the correct, successful outcome for weak evidence. Do NOT manufacture a misconception to avoid abstaining.

NEVER include the correct answer, the number the student should have produced, or the phrase "more practice" / "needs practice" in misconceptionText.

Return the JSON object: { abstain, misconceptionText, confidence, reason }.`;
}

/** Pull a JSON object out of a plain-text response (fenced or bare). */
function parseLooseJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function coerce(raw: Record<string, unknown>): RawDiagnosis {
  const conf = String(raw.confidence ?? 'low').toLowerCase();
  return {
    abstain: Boolean(raw.abstain),
    misconceptionText: String(raw.misconceptionText ?? '').trim(),
    confidence: conf === 'high' ? 'high' : conf === 'medium' ? 'medium' : 'low',
    reason: String(raw.reason ?? '').trim(),
  };
}

/**
 * Run the distiller. Always resolves to a MisconceptionResult; never throws.
 * A Tier-C packet (or a non-failure) short-circuits to an abstain with no call.
 */
export async function distillMisconception(
  evidence: DiagnosisEvidence,
  opts: DistillOptions = {},
): Promise<MisconceptionResult> {
  const tier = shouldDistill(evidence, opts);
  if (tier === 'none') {
    return {
      abstain: true,
      reason:
        classifyEvidenceTier(evidence) === 'none'
          ? 'No diagnosable evidence (Tier C): needs judge feedback or expected+observed.'
          : 'Attempt did not qualify as a failure (success or score ≥ 60).',
      evidenceTier: classifyEvidenceTier(evidence),
    };
  }

  const prompt = buildPrompt(evidence, tier, opts);

  let raw: RawDiagnosis;
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest', // NEVER flash-lite — judge-quality ruling (PRD §3).
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: misconceptionSchema,
        maxOutputTokens: 2048,
        temperature: 0.4,
      },
    });
    const text = result.text;
    if (!text) throw new Error('Empty response from distiller');
    raw = coerce(JSON.parse(text));
  } catch (schemaErr) {
    // Schema-reject or parse failure: one prompt-JSON retry, then abstain.
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: [
          {
            parts: [
              {
                text:
                  prompt +
                  '\n\nRespond with ONLY a JSON object, no prose, shaped exactly like: {"abstain": boolean, "misconceptionText": string, "confidence": "high"|"medium"|"low", "reason": string}',
              },
            ],
          },
        ],
      });
      const text = result.text;
      if (!text) throw new Error('Empty response from distiller (fallback)');
      raw = coerce(parseLooseJson(text));
    } catch (fallbackErr) {
      console.warn('[distillMisconception] both attempts failed, abstaining:', fallbackErr);
      return {
        abstain: true,
        reason: 'Distiller call failed — abstained rather than guessing.',
        evidenceTier: tier,
      };
    }
  }

  // Honest-abstain rules. Model chose to abstain, produced nothing usable, or
  // was only low-confidence → we write nothing.
  if (raw.abstain || !raw.misconceptionText) {
    return {
      abstain: true,
      reason: raw.reason || 'Distiller found no consistent misconception.',
      evidenceTier: tier,
    };
  }
  if (raw.confidence === 'low') {
    return {
      abstain: true,
      reason: `Low confidence — treated as abstain${raw.reason ? `: ${raw.reason}` : ''}. Candidate was: "${raw.misconceptionText}"`,
      evidenceTier: tier,
    };
  }

  return {
    abstain: false,
    misconceptionText: raw.misconceptionText,
    confidence: raw.confidence,
    evidenceTier: tier,
  };
}
