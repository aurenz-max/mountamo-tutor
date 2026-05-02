/**
 * Judge — Gemini calls for the AnnotatedExample two-act loop.
 *
 * Two server-side functions:
 *   - `transcribeWork` (vision, fast/cheap) — OCR + KaTeX formatting only,
 *     runs on every 1.5s debounce of stroke inactivity. No judgment.
 *   - `compareWork`    (text, thinking)     — runs ONCE after Done. Compares
 *     the student's transcribed lines to the canonical solution and emits a
 *     verdict + per-line alignment that drives the Reveal view.
 *
 * `compareWork` evaluates correctness, NOT similarity to canonical: a
 * mathematically-equivalent alternate path gets `aligned`, not `error`.
 */

import { Type, Schema, ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';
import type {
  AlgebraStepContent,
  RichExampleStep,
  StepContent,
} from '../../primitives/annotated-example/types';

// ── transcribeWork ───────────────────────────────────────────────────

const TRANSCRIBE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    lines: {
      type: Type.ARRAY,
      description:
        "Each visually distinct line of mathematical work in top-to-bottom order. Empty array when the canvas has no recognizable math.",
      items: {
        type: Type.OBJECT,
        properties: {
          latex: {
            type: Type.STRING,
            description:
              "The line transcribed as KaTeX. Use standard math notation: fractions as \\frac{a}{b}, exponents as x^{2}, etc. Do NOT wrap in $ or $$.",
          },
          confidence: {
            type: Type.NUMBER,
            description:
              "Your confidence (0..1) that this transcription accurately captures what the student wrote. Below 0.7 means the rendering is unreliable.",
          },
        },
        required: ['latex', 'confidence'],
      },
    },
  },
  required: ['lines'],
};

export interface TranscribedLine {
  latex: string;
  confidence: number;
}

export interface TranscribeWorkInput {
  imageBase64: string;
  problemStatement: string;
}

export interface TranscribeWorkResult {
  lines: TranscribedLine[];
}

/**
 * Transcribe a snapshot of the student's canvas into KaTeX lines.
 *
 * No judgment — just OCR + math formatting. The judge's read of the work
 * is what the student sees in the rail; staying neutral here matters
 * because the rail teaches formal notation by reflecting their handwriting
 * back as typeset math.
 */
export async function transcribeWork(
  input: TranscribeWorkInput,
): Promise<TranscribeWorkResult> {
  const base64Data = input.imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are transcribing a student's handwritten math work into formal notation. The student is solving:

"${input.problemStatement}"

Read every visually distinct line of mathematical work in the image, top to bottom, and return each as a KaTeX expression.

Rules:
- Each line gets one entry. A "line" is a visually distinct row of math — a step in the derivation.
- Use standard KaTeX. Fractions are \\frac{a}{b}. Exponents are x^{2}. Square roots are \\sqrt{x}. Do NOT wrap in $ or $$ — emit the raw KaTeX.
- Preserve the student's work faithfully. If they wrote a sign error, transcribe the sign error. If they wrote nothing on a line, skip it. Do NOT silently correct.
- Skip non-math marks: diagrams, doodles, scratched-out work the student crossed off, decorative arrows. Transcribe only what looks like a step in the solve.
- Confidence: 1.0 = unambiguous; 0.7 = readable but interpretation guesses needed; below 0.7 = likely wrong. Be honest — a low confidence is more useful than a confident misread.
- If the canvas is blank or has no recognizable math, return an empty lines array.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: TRANSCRIBE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini Vision');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error('[transcribeWork] JSON parse failed:', error);
    throw new Error('Malformed transcription response');
  }

  const rawLines = (parsed as { lines?: unknown }).lines;
  if (!Array.isArray(rawLines)) return { lines: [] };

  const lines: TranscribedLine[] = [];
  for (const r of rawLines) {
    if (!r || typeof r !== 'object') continue;
    const latex = (r as { latex?: unknown }).latex;
    const confidence = (r as { confidence?: unknown }).confidence;
    if (typeof latex !== 'string' || !latex.trim()) continue;
    const conf = typeof confidence === 'number' && Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0.5;
    lines.push({ latex: latex.trim(), confidence: conf });
  }

  return { lines };
}

// ── compareWork ──────────────────────────────────────────────────────
//
// One-shot evaluation called when the student presses Done. The student's
// transcribed lines are compared against the canonical solution; output is
// a verdict + per-line alignment that drives the Reveal view.

const COMPARE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    verdict: {
      type: Type.STRING,
      enum: ['correct', 'partial', 'incorrect'],
      description:
        '"correct" = student reaches the goal AND every step is mathematically valid; "partial" = student is on a valid path but did not finish, OR finished with one minor slip; "incorrect" = student did not reach the goal AND has substantive errors.',
    },
    finalAnswer: {
      type: Type.STRING,
      description:
        "The student's final answer, normalized as KaTeX (e.g. 'x = 6'). Empty string if no final answer is identifiable.",
    },
    canonicalAnswer: {
      type: Type.STRING,
      description:
        "The expected final answer from the canonical solution, normalized as KaTeX.",
    },
    summary: {
      type: Type.STRING,
      description:
        "1–2 sentence verdict explanation shown in the banner. Friendly, specific, formative — name what went well or where the divergence happened. Not a grade.",
    },
    stepAnalysis: {
      type: Type.ARRAY,
      description:
        'One entry PER TRANSCRIBED LINE the student wrote, in order. Use status="aligned" for lines that satisfy a canonical step (even via an equivalent path); "shortcut" when one student line collapses 2+ canonical steps; "error" when the line has a substantive mathematical error; "extra" when the line is filler that does not advance the solve.',
      items: {
        type: Type.OBJECT,
        properties: {
          studentLine: {
            type: Type.STRING,
            description: 'The student line, in KaTeX, exactly as transcribed.',
          },
          matchedCanonicalStep: {
            type: Type.INTEGER,
            nullable: true,
            description:
              'Zero-based index into canonicalSteps that this line satisfies. Null when status="extra" or status="error".',
          },
          status: {
            type: Type.STRING,
            enum: ['aligned', 'shortcut', 'error', 'extra'],
          },
          note: {
            type: Type.STRING,
            nullable: true,
            description:
              "1-sentence per-line explanation. REQUIRED when status is 'error' (cite the misconception annotation when relevant) or 'shortcut' (name which canonical steps were combined). Optional/null for 'aligned' and 'extra'.",
          },
        },
        required: ['studentLine', 'status'],
      },
    },
  },
  required: ['verdict', 'finalAnswer', 'canonicalAnswer', 'summary', 'stepAnalysis'],
};

export type CompareLineStatus = 'aligned' | 'shortcut' | 'error' | 'extra';
export type CompareVerdict = 'correct' | 'partial' | 'incorrect';

export interface CompareLineAnalysis {
  studentLine: string;
  matchedCanonicalStep: number | null;
  status: CompareLineStatus;
  note?: string;
}

export interface JudgeVerdict {
  verdict: CompareVerdict;
  finalAnswer: string;
  canonicalAnswer: string;
  summary: string;
  stepAnalysis: CompareLineAnalysis[];
}

export interface CompareWorkInput {
  problemStatement: string;
  /** The full canonical step list — comes straight from sibling.payload.data.steps. */
  canonicalSteps: RichExampleStep[];
  /** The student's transcribed lines from the rail. */
  transcribedLines: TranscribedLine[];
}

/**
 * Render one canonical step as a compact prose summary the comparison LLM
 * can reason over without needing to interpret structured content shapes.
 * Algebra steps emit their from/op/to chain inline; non-algebra steps emit
 * a one-line description of the salient body.
 */
function summarizeCanonicalStep(step: RichExampleStep, index: number): string {
  const head = `Step ${index + 1} — "${step.title}" (${step.content.type})`;
  const misconception = step.annotations.misconceptions
    ? `\n    Misconception to cite: ${step.annotations.misconceptions}`
    : '';
  const strategy = step.annotations.strategy
    ? `\n    Strategy: ${step.annotations.strategy}`
    : '';
  const body = stepBodySummary(step.content);
  return `${head}${strategy}${misconception}\n    Work: ${body}`;
}

function stepBodySummary(content: StepContent): string {
  switch (content.type) {
    case 'algebra': {
      const algebra = content as AlgebraStepContent;
      const chain = algebra.transitions
        .map((t, i) => {
          const from = i === 0 ? `${stripHtmlClass(t.from.latex)} ` : '';
          return `${from}--[${t.operation}]--> ${stripHtmlClass(t.to.latex)}`;
        })
        .join(' ');
      return chain || `result: ${algebra.result}`;
    }
    case 'table': {
      const cells = content.rows
        .slice(0, 3)
        .map((r) => r.join(' | '))
        .join(' / ');
      const hl = content.highlightCell
        ? ` (answer at row ${content.highlightCell[0]}, col ${content.highlightCell[1]})`
        : '';
      return `table "${content.caption}" with headers [${content.headers.join(' | ')}]; rows: ${cells}${hl}`;
    }
    case 'graph-sketch': {
      const expr = content.expression || '(no primary curve)';
      const features = content.features
        .map((f) => `${f.kind}=${f.value}`)
        .join(', ');
      return `graph: ${expr}${features ? `; features: ${features}` : ''}`;
    }
    case 'case-split': {
      const cases = content.cases
        .map((c) => `${c.label} (${c.condition}) → ${c.result}`)
        .join('; ');
      return `case-split on ${content.condition}: ${cases}`;
    }
    case 'diagram': {
      const labels = content.labels.map((l) => l.text).join(', ');
      return `diagram: ${content.altText}${labels ? `; labels: ${labels}` : ''}`;
    }
    default:
      return '(no body)';
  }
}

const HTML_CLASS_RE = /\\htmlClass\{[^}]*\}\{([^}]*)\}/g;

function stripHtmlClass(latex: string): string {
  let prev = '';
  let curr = latex;
  while (prev !== curr) {
    prev = curr;
    curr = curr.replace(HTML_CLASS_RE, '$1');
  }
  return curr;
}

/**
 * Extract the canonical answer string from the last step's content. Used to
 * give the prompt a clear "this is the goal" anchor and for the fallback
 * verdict line when the LLM skips `canonicalAnswer`.
 */
function extractCanonicalAnswer(steps: RichExampleStep[]): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const c = steps[i].content;
    if (c.type === 'algebra' && c.result) return c.result;
    if (c.type === 'case-split' && c.cases.length > 0) {
      return c.cases.map((cs) => `${cs.label}: ${cs.result}`).join(' ; ');
    }
    if (c.type === 'table' && c.highlightCell) {
      const [r, col] = c.highlightCell;
      const cell = c.rows[r]?.[col];
      if (cell) return cell;
    }
  }
  return '';
}

/**
 * Compare a student's transcribed work to the canonical solution.
 *
 * The prompt is opinionated:
 *   - Evaluate correctness, not similarity. An equivalent alternate path
 *     (e.g. multiply by 1/2 first instead of subtract 5 first) gets
 *     `aligned`, not `error`.
 *   - When the student errs, cite the canonical step's misconception
 *     annotation in the per-line `note`.
 *   - Empty/garbled work returns `verdict: 'incorrect'` with a gentle
 *     summary, not a flood of per-line errors.
 */
export async function compareWork(input: CompareWorkInput): Promise<JudgeVerdict> {
  console.log('[compareWork] called', {
    problem: input.problemStatement.slice(0, 80),
    canonicalStepCount: input.canonicalSteps.length,
    studentLineCount: input.transcribedLines.length,
  });
  const canonicalSummary = input.canonicalSteps
    .map((s, i) => summarizeCanonicalStep(s, i))
    .join('\n\n');

  const studentSummary = input.transcribedLines.length === 0
    ? '(no work — student pressed Done with empty canvas or unreadable strokes)'
    : input.transcribedLines
        .map((l, i) => `  Line ${i + 1}: ${l.latex}${l.confidence < 0.7 ? `  [low-confidence transcription]` : ''}`)
        .join('\n');

  const expectedAnswer = extractCanonicalAnswer(input.canonicalSteps);

  const prompt = `You are evaluating a student's solution to a math problem. They watched a worked example, then attempted an isomorphic problem on their own. Your job: judge their work for **correctness**, not similarity to the canonical.

## Problem
${input.problemStatement}

## Canonical solution (the gold-standard rubric)
${canonicalSummary}

${expectedAnswer ? `Expected final answer: ${expectedAnswer}` : ''}

## The student's transcribed work
${studentSummary}

## Your task
Output a JSON judgment per the schema. Rules:

1. **Equivalence over similarity.** If the student takes a different but mathematically valid path (e.g. multiplied by 1/2 first instead of subtracting 5 first), tag those lines \`aligned\`, NOT \`error\` and NOT \`shortcut\`. \`shortcut\` is reserved for collapsing 2+ canonical steps into 1.

2. **Cite misconceptions.** When you tag a line \`error\`, the \`note\` MUST reference the misconception annotation from the canonical step it diverged on, when relevant. Example: "You added 7 to the left but didn't apply it to the right — the rule is 'do the same thing to both sides.'"

3. **One line, one analysis.** \`stepAnalysis\` has EXACTLY one entry per transcribed student line, in the same order.

4. **Verdicts:**
   - \`correct\`: every line is \`aligned\` or \`shortcut\` AND the final answer matches the canonical.
   - \`partial\`: the student is on a valid path but didn't reach the goal, OR has one minor slip with otherwise-correct work.
   - \`incorrect\`: substantive errors AND the goal is not reached.

5. **Empty work.** If transcribedLines is empty or contains no math, return verdict='incorrect', stepAnalysis=[], and a gentle summary like "Looks like you didn't get a chance to work it out — here's how the expert solves it."

6. **Tone.** The summary is shown to the student. Friendly, specific, formative. Never punitive. Name what they did well before what went wrong.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: COMPARE_SCHEMA,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from compareWork');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error('[compareWork] JSON parse failed:', error);
    throw new Error('Malformed compare response');
  }

  const result = normalizeCompareResult(parsed, input);
  console.log('[compareWork] verdict', {
    verdict: result.verdict,
    finalAnswer: result.finalAnswer,
    canonicalAnswer: result.canonicalAnswer,
    analyzedLines: result.stepAnalysis.length,
  });
  return result;
}

// ── reviewProgress ───────────────────────────────────────────────────
//
// Live mid-solve coaching. Text-only Gemini Lite call, runs every time
// the transcription rail produces a new line. The output drives a
// progress band ("Step k of N") above the canvas and per-line tints in
// the rail. NOT an authoritative verdict — compareWork still runs at
// Done. Designed to be cheap and occasionally wrong.

const REVIEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    completedSteps: {
      type: Type.INTEGER,
      description:
        'Highest canonical step the student has demonstrably reached (0..totalSteps). 0 = no progress. The number is monotonic in practice — going off-track on a new line does NOT decrement this.',
    },
    lineReviews: {
      type: Type.ARRAY,
      description:
        'EXACTLY one entry per transcribed student line, in order. The array length MUST match the input transcribedLines length.',
      items: {
        type: Type.OBJECT,
        properties: {
          studentLine: {
            type: Type.STRING,
            description: 'The student line, KaTeX, exactly as transcribed.',
          },
          matchedStep: {
            type: Type.INTEGER,
            nullable: true,
            description:
              'Zero-based canonical step this line satisfies (even via an equivalent path). Null when status="off-track" or status="filler".',
          },
          status: {
            type: Type.STRING,
            enum: ['on-track', 'shortcut', 'off-track', 'filler'],
            description:
              '"on-track" — line satisfies the next canonical step (or an equivalent move). "shortcut" — line collapses 2+ canonical steps. "off-track" — line has a substantive error or goes the wrong direction. "filler" — line is decorative/restated and does not advance the solve.',
          },
          message: {
            type: Type.STRING,
            nullable: true,
            description:
              "1-sentence coaching message. REQUIRED for status='off-track' (graceful redirect — reference what to RE-CHECK, never what to write next; cite misconception when relevant). RECOMMENDED for status='on-track' (confirm + nudge toward the next move WITHOUT revealing it). RECOMMENDED for status='shortcut' (name what was combined). OMIT/null for status='filler'. NEVER reveal the next canonical step's answer.",
          },
        },
        required: ['studentLine', 'status'],
      },
    },
    headline: {
      type: Type.STRING,
      description:
        'One short status sentence shown right-aligned in the progress band. Refers to the LATEST line. Examples: "On track — next isolate x." / "Check the sign on the 7." / "All steps complete — press Done when ready."',
    },
  },
  required: ['completedSteps', 'lineReviews', 'headline'],
};

export interface ReviewProgressInput {
  problemStatement: string;
  canonicalSteps: RichExampleStep[];
  transcribedLines: TranscribedLine[];
}

export interface LiveLineReview {
  studentLine: string;
  matchedStep: number | null;
  status: 'on-track' | 'shortcut' | 'off-track' | 'filler';
  message?: string;
}

export interface LiveReviewState {
  totalSteps: number;
  completedSteps: number;
  lineReviews: LiveLineReview[];
  allStepsComplete: boolean;
  headline: string;
}

/**
 * Mid-solve progress review. Cheap, fast, advisory — the rail uses it to
 * tint lines and surface one coaching message at a time. compareWork is
 * the authoritative verdict; this exists to keep the student oriented
 * during the solve so they don't write in silence.
 */
export async function reviewProgress(
  input: ReviewProgressInput,
): Promise<LiveReviewState> {
  const totalSteps = input.canonicalSteps.length;

  if (input.transcribedLines.length === 0) {
    return {
      totalSteps,
      completedSteps: 0,
      lineReviews: [],
      allStepsComplete: false,
      headline: '',
    };
  }

  const canonicalSummary = input.canonicalSteps
    .map((s, i) => summarizeCanonicalStep(s, i))
    .join('\n\n');

  const studentSummary = input.transcribedLines
    .map((l, i) => `  Line ${i + 1}: ${l.latex}${l.confidence < 0.7 ? '  [low-confidence]' : ''}`)
    .join('\n');

  const prompt = `You are a live coach watching a student solve a problem step-by-step. They saw a worked example, now they're attempting an isomorphic problem. Your job: keep them oriented while they work. You are NOT grading — a separate judge runs at the end.

## Problem
${input.problemStatement}

## Canonical solution (${totalSteps} steps total)
${canonicalSummary}

## Student's transcribed work so far
${studentSummary}

## Your task
Output a JSON live-review per the schema. Rules:

1. **Equivalence over similarity.** A line that takes a different but mathematically valid path (e.g. multiplied by 1/2 first instead of subtracting 5 first) is "on-track", NOT "off-track" and NOT "shortcut". "shortcut" is reserved for collapsing 2+ canonical steps into 1.

2. **NEVER reveal the next answer.** Off-track messages reference what the student should RE-CHECK on a prior step, never what to WRITE NEXT. Bad: "you should have written 3x = 18". Good: "Check the sign on the 7 — adding moves it to the other side as +7."

3. **Acknowledge what's right before redirecting.** If lines 1–2 are on-track and line 3 is off-track, the line-3 message can briefly nod to the prior progress.

4. **One redirect, then silence.** If the student writes multiple consecutive off-track lines, only the FIRST off-track line gets a message. Subsequent off-track lines have status="off-track" but \`message: null\`. Avoids nagging.

5. **completedSteps is monotonic.** Going off-track on a new line does NOT decrement completedSteps from a prior on-track high. It's a "highest-reached" marker, not a current-position marker.

6. **headline** reflects the LATEST line: confirmation + soft nudge for on-track, redirect for off-track, "all steps complete" when applicable.

7. **on-track confirmation messages should NOT reveal the upcoming canonical operation.** You can confirm what the student just did ("Nice — you isolated the variable") but never preview the next move.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: REVIEW_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty response from reviewProgress');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    console.error('[reviewProgress] JSON parse failed:', error);
    throw new Error('Malformed review response');
  }

  return normalizeReviewResult(parsed, input);
}

function normalizeReviewResult(
  parsed: unknown,
  input: ReviewProgressInput,
): LiveReviewState {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const totalSteps = input.canonicalSteps.length;

  const rawCompleted = typeof obj.completedSteps === 'number' && Number.isFinite(obj.completedSteps)
    ? Math.floor(obj.completedSteps)
    : 0;
  const completedSteps = Math.max(0, Math.min(totalSteps, rawCompleted));

  const rawReviews = Array.isArray(obj.lineReviews) ? obj.lineReviews : [];
  const lineReviews: LiveLineReview[] = [];
  for (let i = 0; i < input.transcribedLines.length; i++) {
    const studentLine = input.transcribedLines[i].latex;
    const r = rawReviews[i];
    if (!r || typeof r !== 'object') {
      lineReviews.push({ studentLine, matchedStep: null, status: 'filler' });
      continue;
    }
    const row = r as Record<string, unknown>;
    const status = row.status;
    const validStatus: LiveLineReview['status'] =
      status === 'on-track' || status === 'shortcut' || status === 'off-track' || status === 'filler'
        ? status
        : 'filler';
    const matched = typeof row.matchedStep === 'number'
      && Number.isInteger(row.matchedStep)
      && row.matchedStep >= 0
      && row.matchedStep < totalSteps
        ? row.matchedStep
        : null;
    const message = typeof row.message === 'string' && row.message.trim() ? row.message.trim() : undefined;
    lineReviews.push({ studentLine, matchedStep: matched, status: validStatus, message });
  }

  const headline = typeof obj.headline === 'string' ? obj.headline.trim() : '';
  const allStepsComplete = completedSteps >= totalSteps && totalSteps > 0;

  return { totalSteps, completedSteps, lineReviews, allStepsComplete, headline };
}

function normalizeCompareResult(parsed: unknown, input: CompareWorkInput): JudgeVerdict {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rawVerdict = typeof obj.verdict === 'string' ? obj.verdict : 'incorrect';
  const verdict: CompareVerdict =
    rawVerdict === 'correct' || rawVerdict === 'partial' || rawVerdict === 'incorrect'
      ? rawVerdict
      : 'incorrect';

  const finalAnswer = typeof obj.finalAnswer === 'string' ? obj.finalAnswer.trim() : '';
  const canonicalAnswer = typeof obj.canonicalAnswer === 'string' && obj.canonicalAnswer.trim()
    ? obj.canonicalAnswer.trim()
    : extractCanonicalAnswer(input.canonicalSteps);
  const summary = typeof obj.summary === 'string' && obj.summary.trim()
    ? obj.summary.trim()
    : 'No summary available.';

  const rawAnalysis = Array.isArray(obj.stepAnalysis) ? obj.stepAnalysis : [];
  const stepAnalysis: CompareLineAnalysis[] = [];
  for (const r of rawAnalysis) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const studentLine = typeof row.studentLine === 'string' ? row.studentLine : '';
    if (!studentLine) continue;
    const status = row.status;
    const validStatus: CompareLineStatus =
      status === 'aligned' || status === 'shortcut' || status === 'error' || status === 'extra'
        ? status
        : 'extra';
    const matched = typeof row.matchedCanonicalStep === 'number'
      && Number.isInteger(row.matchedCanonicalStep)
      && row.matchedCanonicalStep >= 0
      && row.matchedCanonicalStep < input.canonicalSteps.length
        ? row.matchedCanonicalStep
        : null;
    const note = typeof row.note === 'string' && row.note.trim() ? row.note.trim() : undefined;
    stepAnalysis.push({ studentLine, matchedCanonicalStep: matched, status: validStatus, note });
  }

  return { verdict, finalAnswer, canonicalAnswer, summary, stepAnalysis };
}
