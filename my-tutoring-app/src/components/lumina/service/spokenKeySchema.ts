/**
 * The spoken key's fields as a Gemini schema fragment, the generation half of `components/live-activity/spokenKey.ts`
 * (2026-10-18). A spoken generator spreads it into its item schema, so every spoken primitive asks the model for
 * the same key and `spokenKeyText` writes the same judging sentence from it. `answer` describes `expectedAnswer`
 * for this generator (what a five-year-old says, a number left empty for code, an anchor wording of an idea).
 *
 * Flat strings only: `alsoAccept` is ONE comma-separated string the generator splits, because a nested
 * array in a per-item schema is where the model's JSON breaks.
 */
import { Type, type Schema } from '@google/genai';

export function spokenKeyProperties(answer: string): Record<string, Schema> {
  return {
    expectedAnswer: { type: Type.STRING, description: answer },
    alsoAccept: {
      type: Type.STRING,
      description:
        'Other answers that are equally correct, comma-separated (e.g. "sofa, settee"). Empty '
        + 'string when there are none. NOT a list — one comma-separated string.',
    },
    acceptRule: {
      type: Type.STRING,
      description:
        'A RIGHT answer for THIS skill that does not look right, written as an instruction to the '
        + 'judge. Example (counting): "Counting aloud that ENDS on the answer counts as that '
        + 'answer — the last number said tells the total." Example (blending): "Sounding the word '
        + 'out and then saying it counts as the answer." Empty string if this skill has none.',
    },
    signatureError: {
      type: Type.STRING,
      description:
        'A WRONG answer for THIS skill that sounds confident and right, written as an instruction '
        + 'to the judge. Example (plurals): "The bare singular said back is NOT the answer." '
        + 'Example (sound manipulation): "The starting word repeated unchanged is NOT the answer." '
        + 'Empty string if this skill has none.',
    },
  };
}
