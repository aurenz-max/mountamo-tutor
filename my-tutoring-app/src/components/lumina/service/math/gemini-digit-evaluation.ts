import { Type, Schema } from "@google/genai";
import { ai } from "../geminiClient";

const digitEvaluationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recognized: {
      type: Type.BOOLEAN,
      description: "true if the drawing is a recognizable version of the target digit in any common handwriting style",
    },
    score: {
      type: Type.NUMBER,
      description: "0-100. 85-100: clearly recognizable, well-formed. 70-84: recognizable but shaky/incomplete. 50-69: partially recognizable. 0-49: looks like a different digit or unrecognizable.",
    },
    variant: {
      type: Type.STRING,
      description: "Which variant of the digit was drawn, e.g. 'open 4', 'closed 4', 'single-line 1', 'serif 1', 'cursive 2'",
    },
    feedback: {
      type: Type.STRING,
      description: "1-sentence, child-friendly, encouraging feedback. If correct: celebrate. If incorrect: name what digit it looks like and give one concrete tip.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "0-100: how confident Gemini is in this evaluation",
    },
  },
  required: ["recognized", "score", "variant", "feedback", "confidence"],
};

export interface DigitEvaluationResult {
  recognized: boolean;
  score: number;
  variant: string;
  feedback: string;
  confidence: number;
}

/**
 * Re-evaluate a student's digit drawing using Gemini Vision when the
 * geometric path-proximity score falls below 90%.
 *
 * Accepts ALL valid handwriting variants (open/closed 4, single-line/serif 1, etc.)
 */
export async function evaluateDigitDrawing(
  canvasBase64: string,
  targetDigit: number,
  challengeType: "trace" | "copy" | "write" | "sequence",
): Promise<DigitEvaluationResult> {
  const base64Data = canvasBase64.replace(/^data:image\/\w+;base64,/, "");

  const variantExamples: Partial<Record<number, string>> = {
    0: "round 0 or slightly slanted oval",
    1: "single vertical stroke, or with a top serif/flag and/or bottom base",
    2: "with or without a loop at the bottom",
    4: "open 4 (top-left open) or closed 4 (fully enclosed triangle at top)",
    5: "with or without a curved bottom, rounded top or flat top",
    6: "with or without a closed loop at the bottom",
    7: "plain 7 or 7 with a horizontal crossbar",
    9: "with a fully closed circle or an open spiral",
  };

  const variants = variantExamples[targetDigit]
    ? `\nAccepted variants for ${targetDigit}: ${variantExamples[targetDigit]}`
    : "";

  const challengeContext =
    challengeType === "trace"
      ? "The student was tracing a dotted guide path."
      : challengeType === "copy"
        ? "The student was copying from a model digit shown nearby."
        : challengeType === "sequence"
          ? "The student was writing a missing number to complete a counting sequence."
          : "The student was writing the digit from a text prompt only, with no guide.";

  const prompt = `You are an expert early-childhood handwriting evaluator.

A kindergarten or Grade 1 student has drawn the digit ${targetDigit} on a canvas.
${challengeContext}${variants}

Your task:
1. Look at the drawing and determine if it is a recognizable version of the digit ${targetDigit}.
2. Accept ALL common handwriting variants — do NOT penalize unusual but valid forms.
3. Be GENEROUS with K-Grade 1 motor control: wobbly lines, slight size issues, and imperfect curves are expected and acceptable.
4. Score 85-100 if the digit is clearly ${targetDigit} in any style.
5. Score 70-84 if it is recognizable but noticeably shaky, incomplete, or reversed.
6. Score 50-69 if a teacher could tell what it was meant to be but it closely resembles another digit.
7. Score 0-49 only if it looks like a clearly different digit or is completely unrecognizable.

The canvas background is dark (near-black). The student's strokes are white/light colored.
Ignore the faint grid lines and the dashed baseline — those are canvas decorations, not student marks.`;

  const t0 = Date.now();
  console.log(`[NumberTracer] Gemini re-eval → digit=${targetDigit} mode=${challengeType} imageSize=${Math.round(base64Data.length / 1024)}KB`);

  try {
    const result = await ai.models.generateContent({
      model: "gemini-flash-lite-latest",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: digitEvaluationSchema,
      },
    });

    const text = result.text;
    if (!text) throw new Error("No response from Gemini");

    const parsed = JSON.parse(text) as DigitEvaluationResult;
    const result2 = {
      recognized: parsed.recognized ?? false,
      score: Math.max(0, Math.min(100, parsed.score ?? 0)),
      variant: parsed.variant ?? "",
      feedback: parsed.feedback ?? "Keep practicing!",
      confidence: Math.max(0, Math.min(100, parsed.confidence ?? 50)),
    };
    console.log(`[NumberTracer] Gemini re-eval ← digit=${targetDigit} recognized=${result2.recognized} score=${result2.score} variant="${result2.variant}" confidence=${result2.confidence} (${Date.now() - t0}ms)`);
    return result2;
  } catch (error) {
    console.error(`[NumberTracer] Gemini re-eval error digit=${targetDigit}:`, error);
    // Fail open — don't block the student if the API call fails
    return {
      recognized: false,
      score: 0,
      variant: "",
      feedback: "We couldn't check your writing. Try again!",
      confidence: 0,
    };
  }
}
