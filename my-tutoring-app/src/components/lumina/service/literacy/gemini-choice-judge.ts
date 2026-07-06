import { Type, Schema, ThinkingLevel } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Choice Judge — closed-set spoken-option discrimination.
 *
 * The voice-control counterpart to the blend judge: the student sees N
 * options on screen and says one of them; this judge decides WHICH option
 * was said (or none). The correct answer is deliberately NOT sent — the
 * judge identifies, the primitive grades. That keeps the judge unbiased
 * (no reference-text anchoring) and lets one call drive selection UX,
 * grading, and "heard you say X" feedback alike.
 *
 * Same transcribe-first doctrine as the blend judge: minimal pairs often
 * live INSIDE the option set (map/mop), so the vowel discrimination has to
 * happen against the independent transcription, not wishful matching.
 */

const choiceJudgeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    heard: {
      type: Type.STRING,
      description:
        "Best transcription of what the student actually said (a word or short phrase; empty string if no speech)",
    },
    selectedOption: {
      type: Type.STRING,
      description:
        "EXACTLY one of the provided options if the student clearly said it; empty string if they said none of them, a different word, or the audio is too unclear to pick one",
    },
    confidence: {
      type: Type.STRING,
      enum: ["high", "low"],
      description:
        "high = clearly heard and clearly one option (or clearly none); low = unclear audio, mumbled, or torn between two options",
    },
    reasoning: {
      type: Type.STRING,
      description: "One short sentence: what was heard and why it maps (or not) to an option",
    },
  },
  required: ["heard", "selectedOption", "confidence", "reasoning"],
};

export interface ChoiceJudgeVerdict {
  heard: string;
  /** Exactly one of the provided options, or null if none/unclear. */
  selectedOption: string | null;
  confidence: "high" | "low";
  reasoning: string;
  /** Which model actually produced the verdict */
  model: string;
  /** True if the model rejected responseSchema and we fell back to prompt-JSON */
  usedSchemaFallback: boolean;
  /** Server-side call latency in ms (excludes network to the browser) */
  judgeLatencyMs: number;
}

export interface ChoiceJudgeParams {
  /** Base64 audio, no data: prefix */
  audioBase64: string;
  /** e.g. "audio/wav" */
  mimeType: string;
  /** The options visible on screen, e.g. ["map", "mop", "sun"] */
  options: string[];
  gradeLevel?: string;
  /** Model override for benching. Defaults to flash-latest (never flash-lite). */
  model?: string;
  /** Thinking level for benching; "default" sends no thinkingConfig. */
  thinkingLevel?: string;
}

function buildPrompt(options: string[], gradeLevel: string): string {
  const list = options.map((o) => `"${o}"`).join(", ");
  return `You are the voice-selection layer for a ${gradeLevel} learning exercise.

The student sees these options on screen and says ONE of them aloud to choose it: ${list}.

STEP 1 — TRANSCRIBE FIRST, INDEPENDENTLY. Write down exactly what the audio says based only on the sounds you hear. Do NOT assume it is one of the options: some options are minimal pairs of each other, so pay closest attention to the vowel — the vowel you hear decides between neighbor options.

STEP 2 — MAP the transcription to the options.

Report:
- heard: your independent transcription from step 1 (empty string if there is no speech)
- selectedOption: EXACTLY one of ${list} if the transcription is that option. Be lenient about young-child articulation of an option (soft consonants, stretched vowels, "sounding-out then the word" counts). Be strict BETWEEN options: if the vowel matches a different option, pick that one; if the word is not any option, use an empty string.
- confidence: "high" if the audio is clear and your mapping is certain (including a certain "none of them"); "low" if the audio is quiet, mumbled, cut off, or you are torn between two options.
- reasoning: one short sentence naming the phonemes you heard and the option decision.`;
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

/** Snap the model's selectedOption string back onto the caller's option list (or null). */
function normalizeSelection(raw: unknown, options: string[]): string | null {
  const cleaned = String(raw ?? "").toLowerCase().trim();
  if (!cleaned) return null;
  return options.find((o) => o.toLowerCase().trim() === cleaned) ?? null;
}

export async function judgeChoiceAudio(params: ChoiceJudgeParams): Promise<ChoiceJudgeVerdict> {
  const {
    audioBase64,
    mimeType,
    options,
    gradeLevel = "Kindergarten",
    // flash-latest, not flash-lite — the mop/map bench (2026-07-04) showed
    // flash-lite false-positives on minimal pairs, and in choice mode the
    // minimal pair is often IN the option set.
    model = "gemini-flash-latest",
    thinkingLevel = "MINIMAL",
  } = params;

  if (!options.length) throw new Error("judgeChoiceAudio: options must be non-empty");

  // "MINIMAL" isn't in SDK 1.30's ThinkingLevel enum yet, but the API accepts
  // it (bench-verified) — hence the cast.
  const thinkingConfig =
    thinkingLevel && thinkingLevel !== "default"
      ? { thinkingLevel: thinkingLevel as ThinkingLevel }
      : undefined;

  const prompt = buildPrompt(options, gradeLevel);
  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64.replace(/^data:audio\/\w+;base64,/, ""),
    },
  };

  const started = Date.now();

  // First attempt: structured output; prompt-JSON fallback for models that
  // reject responseSchema (same pattern as the blend judge).
  try {
    const result = await ai.models.generateContent({
      model,
      contents: [{ parts: [audioPart, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: choiceJudgeSchema,
        ...(thinkingConfig ? { thinkingConfig } : {}),
      },
    });
    const text = result.text;
    if (!text) throw new Error("Empty response from choice judge model");
    const parsed = JSON.parse(text);
    return {
      heard: String(parsed.heard ?? ""),
      selectedOption: normalizeSelection(parsed.selectedOption, options),
      confidence: parsed.confidence === "high" ? "high" : "low",
      reasoning: String(parsed.reasoning ?? ""),
      model,
      usedSchemaFallback: false,
      judgeLatencyMs: Date.now() - started,
    };
  } catch (schemaErr) {
    console.warn(`[ChoiceJudge] structured call failed on ${model}, retrying prompt-JSON:`, schemaErr);
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
                `\n\nRespond with ONLY a JSON object, no prose, shaped exactly like: {"heard": string, "selectedOption": string, "confidence": "high"|"low", "reasoning": string}`,
            },
          ],
        },
      ],
    });
    const text = result.text;
    if (!text) throw new Error("Empty response from choice judge model (fallback)");
    const parsed = parseLooseJson(text);
    return {
      heard: String(parsed.heard ?? ""),
      selectedOption: normalizeSelection(parsed.selectedOption, options),
      confidence: parsed.confidence === "high" ? "high" : "low",
      reasoning: String(parsed.reasoning ?? ""),
      model,
      usedSchemaFallback: true,
      judgeLatencyMs: Date.now() - fallbackStarted,
    };
  }
}
