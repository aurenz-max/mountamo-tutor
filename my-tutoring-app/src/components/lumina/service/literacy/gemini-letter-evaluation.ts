import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

/**
 * Letter Workshop's second opinion. The geometric formation check compares the
 * child's ink against ONE school-manuscript template, so a correct letter made
 * in one continuous stroke, or with a narrower bowl, fails it. When that check
 * fails on copy/write, this reads the image and decides whether the child wrote
 * the letter at all — the same shape as NumberTracer's digit judge.
 *
 * `writtenAs` is the first property so the model commits to what it READS
 * before it is asked whether that matches the target (b/d/p/q reversals are the
 * failure this must not wave through).
 */
const letterEvaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    writtenAs: {
      type: Type.STRING,
      description: "The single letter the drawing shows, with its case as placed on the writing lines (for example p, P, b, d). Use ? when no letter can be read.",
    },
    recognized: {
      type: Type.BOOLEAN,
      description: "true only if the drawing is the target letter in the target case, in any common manuscript style",
    },
    score: {
      type: Type.NUMBER,
      description: "0-100. 85-100: clearly the target letter. 70-84: the target but shaky or incomplete. 50-69: a teacher could tell it was meant to be the target. 0-49: a different letter, the wrong case, reversed, or unreadable.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "0-100: how confident you are in this reading",
    },
    feedback: {
      type: Type.STRING,
      description: "One short, warm sentence for a 5-year-old. If recognized: celebrate. If not: say what it looks like and give one concrete tip about the letter's parts or the writing lines.",
    },
  },
  required: ["writtenAs", "recognized", "score", "confidence", "feedback"],
  propertyOrdering: ["writtenAs", "recognized", "score", "confidence", "feedback"],
};

export interface LetterEvaluationResult {
  writtenAs: string;
  recognized: boolean;
  score: number;
  confidence: number;
  feedback: string;
}

export async function evaluateLetterDrawing(
  imageBase64: string,
  targetLetter: string,
  letterCase: "uppercase" | "lowercase",
  challengeType: "trace" | "copy" | "write",
): Promise<LetterEvaluationResult> {
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const target = letterCase === "uppercase" ? targetLetter.toUpperCase() : targetLetter.toLowerCase();

  const challengeContext =
    challengeType === "copy"
      ? "The student was copying from a model letter shown beside the paper."
      : challengeType === "write"
        ? "The student heard the letter's name and wrote it from memory, with no model."
        : "The student was tracing a guide path.";

  const prompt = `You are an expert early-childhood handwriting evaluator.

A kindergarten or Grade 1 student was asked to write the ${letterCase} letter "${target}".
${challengeContext}

The image is writing paper: a solid top line, a dashed middle line, and a solid baseline, all faint gray. The student's marks are the dark blue strokes. The lines are guides, not student marks.

1. First read the letter the strokes show, as you would with no expectation. Use the writing lines to decide its case: a lowercase letter's body sits between the middle line and the baseline; tall parts reach the top line; p, q, g, j, y descend below the baseline.
2. Decide whether that is the ${letterCase} letter "${target}".
3. Accept every common manuscript form: one continuous stroke or several, a retraced stem, open or closed bowls, ball-and-stick or continuous style.
4. Be generous with young motor control: wobbly lines, uneven size, gaps where strokes should meet, and a letter slightly off the lines are all fine.
5. Do NOT accept a reversed letter (b for d, p for q, backwards s, j, or z), a different letter, or the wrong case when the case changes the letter's shape. For letters whose two cases share a shape (c, o, s, u, v, w, x, z), judge case by size on the lines, and be lenient when size is borderline.`;

  const t0 = Date.now();
  console.log(`[LetterWorkshop] Gemini letter judge → target=${target} mode=${challengeType} imageSize=${Math.round(base64Data.length / 1024)}KB`);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: [{ parts: [{ inlineData: { mimeType: "image/png", data: base64Data } }, { text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: letterEvaluationSchema },
    });
    const text = result.text;
    if (!text) throw new Error("No response from Gemini");
    const parsed = JSON.parse(text) as Partial<LetterEvaluationResult>;
    const writtenAs = String(parsed.writtenAs ?? "").trim();
    const out: LetterEvaluationResult = {
      writtenAs: /^([A-Za-z]|\?)$/.test(writtenAs) ? writtenAs : "?",
      recognized: parsed.recognized === true,
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : "Keep practicing!",
    };
    console.log(`[LetterWorkshop] Gemini letter judge ← target=${target} writtenAs=${out.writtenAs} recognized=${out.recognized} score=${out.score} confidence=${out.confidence} (${Date.now() - t0}ms)`);
    return out;
  } catch (error) {
    console.error(`[LetterWorkshop] Gemini letter judge error target=${target}:`, error);
    // Zero confidence: the caller keeps its geometric verdict.
    return { writtenAs: "?", recognized: false, score: 0, confidence: 0, feedback: "" };
  }
}
