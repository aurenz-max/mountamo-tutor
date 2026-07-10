import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Blend Judge — micro-LLM spoken-word judge for phonics blending.
 *
 * Spike for the "truth channel" architecture: the Gemini Live tutor session
 * stays the unjudged warmth channel; this is a stateless request/response
 * call that takes a short audio clip + a target word and returns a verdict.
 * Nothing streams, nothing blocks the Live session, and the frontend owns
 * the verdict — no backend→frontend state push.
 *
 * Grading policy (asymmetric by design): the judge can only ADD credit.
 * A confident yes → correct. Anything else → the caller falls through to a
 * deterministic interaction (tap-the-picture). A kid who blended correctly
 * but got misheard must never see a red X from this call.
 */

const blendJudgeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    heard: {
      type: Type.STRING,
      description: "Best transcription of what the student actually said (a word or short phrase; empty string if no speech)",
    },
    isMatch: {
      type: Type.BOOLEAN,
      description: "True only if the student said the target word. Lenient on child articulation, strict on it being a different word.",
    },
    confidence: {
      type: Type.STRING,
      enum: ["high", "low"],
      description: "high = clearly heard and clearly a match/non-match; low = unclear audio, mumbled, or ambiguous",
    },
    reasoning: {
      type: Type.STRING,
      description: "One short sentence: what was heard and why it does or doesn't match",
    },
    misconception: {
      type: Type.STRING,
      description:
        "Optional. Only when isMatch is false and confidence is high AND the error suggests a consistent wrong rule (e.g. saying only the first phoneme, swapping a vowel): ONE sentence in student-model form describing the wrong rule ('The student blends only the first sound...'). Empty string when the mismatch looks like noise, mishearing, or a one-off slip. Never contains the target word.",
    },
  },
  required: ["heard", "isMatch", "confidence", "reasoning"],
};

export interface BlendJudgeVerdict {
  heard: string;
  isMatch: boolean;
  confidence: "high" | "low";
  reasoning: string;
  /**
   * Misconception Loop S2 (Tier-A judge fast path): one student-model sentence
   * describing a consistent wrong rule. Only on confident no-match; undefined
   * when the miss looks like noise or a one-off slip. Never names the target word.
   */
  misconception?: string;
  /** Which model actually produced the verdict */
  model: string;
  /** True if the model rejected responseSchema and we fell back to prompt-JSON */
  usedSchemaFallback: boolean;
  /** Server-side Gemini call latency in ms (excludes network to the browser) */
  judgeLatencyMs: number;
}

export interface BlendJudgeParams {
  /** Base64 audio, no data: prefix */
  audioBase64: string;
  /** e.g. "audio/wav" */
  mimeType: string;
  /** The word the student was asked to blend aloud, e.g. "map" */
  targetWord: string;
  gradeLevel?: string;
  /** Model override for benching, e.g. "gemma-3n-e4b-it". Defaults to flash-lite. */
  model?: string;
  /**
   * Thinking level for benching. Defaults to MINIMAL — bench 2026-07-04:
   * flash-latest keeps mop/map trap accuracy at MINIMAL and drops from
   * ~2.5-3.5s to ~1.7-1.9s. CAUTION: on 3.1-flash-lite thinking is
   * load-bearing (MINIMAL fails the trap; default/LOW passes).
   * Pass "default" to send no thinkingConfig.
   */
  thinkingLevel?: string;
}

function buildPrompt(targetWord: string, gradeLevel: string): string {
  return `You are judging a ${gradeLevel} phonics blending exercise.

The student was shown the sounds of a word and asked to blend them together and say the whole word aloud.

STEP 1 — TRANSCRIBE FIRST, INDEPENDENTLY. Write down exactly what the audio says based only on the sounds you hear. Do NOT assume it is the target word: this is a minimal-pair assessment, and students are often played neighbor words that differ by one phoneme. Pay closest attention to the vowel — if the vowel you hear is not the target's vowel, the word is a different word.

STEP 2 — COMPARE to the target word: "${targetWord}".

Report:
- heard: your independent transcription from step 1 (empty string if there is no speech)
- isMatch: true ONLY if the transcription is "${targetWord}". Be lenient about young-child articulation of the RIGHT word (soft consonants, stretched vowels, "sounding-out then the word" counts). Be strict about DIFFERENT words: a minimal-pair neighbor is NOT a match.
- confidence: "high" if the audio is clear and your judgment is certain; "low" if the audio is quiet, mumbled, cut off, or ambiguous.
- reasoning: one short sentence naming the phonemes you heard.
- misconception: leave this as an empty string by default. Populate it ONLY when isMatch is false, confidence is "high", AND the error suggests a consistent wrong rule (e.g. the student said only the first phoneme, or swapped the vowel): write ONE sentence in student-model form describing the wrong rule ("The student blends only the first sound..."). Keep it empty when the mismatch looks like noise, mishearing, or a one-off slip. Never include the target word in this sentence.`;
}

/** Try to pull a JSON object out of a plain-text response (fenced or bare). */
function parseLooseJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function judgeBlendAudio(params: BlendJudgeParams): Promise<BlendJudgeVerdict> {
  const {
    audioBase64,
    mimeType,
    targetWord,
    gradeLevel = "Kindergarten",
    // flash-latest, not flash-lite: bench 2026-07-04 showed flash-lite
    // false-positives on minimal pairs (heard "mop" as "map", high confidence)
    // even with a transcribe-first prompt. flash-latest discriminates the
    // vowel correctly at ~2.3s. Hosted Gemma rejects audio input entirely.
    model = "gemini-flash-latest",
    thinkingLevel = "MINIMAL",
  } = params;

  // "MINIMAL" isn't in SDK 1.30's ThinkingLevel enum yet, but the API accepts
  // it (bench-verified) — hence the cast.
  const thinkingConfig =
    thinkingLevel && thinkingLevel !== "default"
      ? { thinkingLevel: thinkingLevel as ThinkingLevel }
      : undefined;

  const prompt = buildPrompt(targetWord, gradeLevel);
  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64.replace(/^data:audio\/\w+;base64,/, ""),
    },
  };

  const started = Date.now();

  // First attempt: structured output. Some models (notably older hosted Gemma
  // endpoints) reject responseSchema — fall back to prompt-JSON once so the
  // tester can still bench them.
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ parts: [audioPart, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: blendJudgeSchema,
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    const text = result.text;
    if (!text) throw new Error("Empty response from judge model");
    const parsed = JSON.parse(text);
    return {
      heard: String(parsed.heard ?? ""),
      isMatch: Boolean(parsed.isMatch),
      confidence: parsed.confidence === "high" ? "high" : "low",
      reasoning: String(parsed.reasoning ?? ""),
      misconception: String(parsed.misconception ?? "").trim() || undefined,
      model,
      usedSchemaFallback: false,
      judgeLatencyMs: Date.now() - started,
    };
  } catch (schemaErr) {
    console.warn(`[BlendJudge] structured call failed on ${model}, retrying prompt-JSON:`, schemaErr);
    const fallbackStarted = Date.now();
    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            audioPart,
            {
              text:
                prompt +
                `\n\nRespond with ONLY a JSON object, no prose, shaped exactly like: {"heard": string, "isMatch": boolean, "confidence": "high"|"low", "reasoning": string, "misconception": string}`,
            },
          ],
        },
      ],
    });
    const text = result.text;
    if (!text) throw new Error("Empty response from judge model (fallback)");
    const parsed = parseLooseJson(text);
    return {
      heard: String(parsed.heard ?? ""),
      isMatch: Boolean(parsed.isMatch),
      confidence: parsed.confidence === "high" ? "high" : "low",
      reasoning: String(parsed.reasoning ?? ""),
      misconception: String(parsed.misconception ?? "").trim() || undefined,
      model,
      usedSchemaFallback: true,
      judgeLatencyMs: Date.now() - fallbackStarted,
    };
  }
}
