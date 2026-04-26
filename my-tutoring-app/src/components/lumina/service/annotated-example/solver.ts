/**
 * Solver — Stage 1 of the annotated-example pipeline.
 *
 * A smart model (gemini-3-flash-preview + thinking HIGH) solves the problem in
 * free-form prose. Code execution is enabled so arithmetic is grounded in
 * actual computation, not LLM approximation. The solver knows nothing about
 * primitives or downstream schemas — it's teaching a student.
 *
 * Output format (parsed by the caller):
 *   TITLE: <short title>
 *   SUBJECT: <subject>
 *   PROBLEM: <problem prompt>
 *
 *   STRATEGY: <2-3 sentences>
 *
 *   <move 1 prose with inline KaTeX>
 *   ---
 *   <move 2 prose>
 *   ---
 *   ...
 *
 * The body (everything after STRATEGY:) is split downstream on `---` lines.
 * Each block is one step. There is no ANSWER: line — the final move's prose
 * IS the answer, in context.
 */

import { ThinkingLevel } from '@google/genai';
import { ai } from '../geminiClient';

export interface SolvedProblem {
  /** Short title (derived after parsing; filled by caller). */
  title: string;
  /** Subject area (e.g. "Algebra", "Calculus"). */
  subject: string;
  /** 2-3 sentence strategy narrative shown to the student before the steps. */
  strategy: string;
  /** The problem statement echoed back (used by downstream prompts for grounding). */
  problemStatement: string;
  /** The prose body, with `---` separators between moves. Split downstream. */
  body: string;
  /** Raw concatenated text from all parts (for debugging / provenance). */
  rawText: string;
}

export interface SolverConfig {
  intent?: string;
  objectiveText?: string;
  objectiveVerb?: string;
}

function buildSolverPrompt(topic: string, gradeContext: string, config?: SolverConfig): string {
  const objectiveClause = config?.objectiveText
    ? `\n\nLEARNING OBJECTIVE: "${config.objectiveText}"\nThe worked example must directly support this objective.`
    : '';

  return `You are solving a representative problem on "${topic}" for a ${gradeContext} student, to be used as a worked example.
${objectiveClause}

Your job is to TEACH — show a clean, complete solution that a student can follow.

## Output format (STRICT)

Produce your solution as plain text with this exact structure:

TITLE: <short descriptive title of the problem>
SUBJECT: <subject area, e.g. Algebra, Calculus, Physics>
PROBLEM: <the problem prompt you chose to solve, stated clearly>

STRATEGY: <2-3 sentences describing the overall approach and WHY it works>

<move 1: one strategic mathematical move — a complete thought. Use KaTeX inline ($...$) for math.>
---
<move 2>
---
<move 3>
---
...

## Rules for "moves" — CRITICAL, this drives the rendering

A MOVE is one strategic action. Each \`---\`-separated block becomes ONE step in the rendered worked example, so block boundaries directly determine what the student sees.

- A move may contain several small transformations IF they all serve the same "why."
- A new move starts when the STRATEGIC PURPOSE changes.

**Examples:**
- GOOD move: "Applying the natural log to both sides gives $\\ln(2) = 0.045t$, and dividing by 0.045 isolates $t = \\ln(2)/0.045$."
  (Two transformations, one strategy: "isolate t via logs.")
- BAD — split too fine: "Apply ln." / "Simplify." / "Divide." / "Evaluate." (four moves, same strategy.)
- BAD — too coarse: "Solve the equation." (doesn't show the reasoning.)

The final move's prose must contain the final answer, in context. Do NOT add a separate summary line at the end — the last \`---\` block IS the conclusion.

## CRITICAL: Cover the entire problem statement

Before you begin, read the problem and list EVERY task it asks for. The problem may ask multiple things in one sentence — "factor X and verify Y," "solve for x and check the solution," "compute the integral and interpret the result."

EVERY task gets at least one move. If the problem says "factor AND verify irreducibility," you need a move for factoring AND a move for verifying irreducibility. Do not stop after the first task.

## Use code execution for arithmetic

You have Python code execution available. USE IT for every numerical computation — evaluating $\\ln(2)/0.045$, computing $e^{0.045 \\cdot 15.4}$, checking verification math. Do not approximate in your head. The numbers you show in the prose must match the code's output.

## Additional guidance

- Show ONE worked example, end to end, addressing EVERY part of the problem statement.
- Use KaTeX for ALL math (\\frac, \\sqrt, ^{}, \\ln, \\pi, etc.). Wrap inline math in $...$.
- Include a verification or check move when the problem asks for one, OR when sanity-checking the final answer aids understanding.
- Keep individual moves focused — no filler, no "as you can see," no recap at the end.
- A typical worked example has 3-6 moves. If you produced only 2, you almost certainly skipped a part of the problem — re-read it.
- ${config?.intent || 'Demonstrate the solving process with clear pedagogical value.'}

Begin now. Output the TITLE/SUBJECT/PROBLEM/STRATEGY header, then the moves separated by \`---\` on their own lines.`;
}

interface PartLike {
  text?: string;
  executableCode?: unknown;
  codeExecutionResult?: unknown;
}

function extractText(parts: PartLike[]): string {
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('');
}

function parseField(raw: string, field: string): string {
  const re = new RegExp(`^\\s*${field}\\s*:\\s*(.+?)\\s*$`, 'im');
  const m = raw.match(re);
  return m ? m[1].trim() : '';
}

function parseSolverOutput(rawText: string, topic: string): SolvedProblem {
  const title = parseField(rawText, 'TITLE') || topic;
  const subject = parseField(rawText, 'SUBJECT') || 'Mathematics';
  const problemStatement = parseField(rawText, 'PROBLEM') || topic;
  const strategy = parseField(rawText, 'STRATEGY') || '';

  // Body: everything after the STRATEGY line. No ANSWER: terminator anymore —
  // the final `---` block IS the conclusion.
  const afterStrategy = rawText.split(/^\s*STRATEGY\s*:.*$/im)[1] || rawText;
  const body = afterStrategy.trim();

  return { title, subject, strategy, problemStatement, body, rawText };
}

/**
 * Solve the problem in free-form prose with code execution.
 * Throws if the solver produces no usable text.
 */
export async function solveProblem(
  topic: string,
  gradeContext: string,
  config?: SolverConfig,
): Promise<SolvedProblem> {
  const prompt = buildSolverPrompt(topic, gradeContext, config);

  console.log('[Solver] Running gemini-3-flash-preview with thinking + code execution...');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      tools: [{ codeExecution: {} }],
    },
  });

  const parts = (response.candidates?.[0]?.content?.parts ?? []) as PartLike[];
  const rawText = extractText(parts);
  if (!rawText.trim()) throw new Error('Solver returned no text');

  const codeExecutions = parts.filter((p) => p.executableCode).length;
  if (codeExecutions > 0) {
    console.log(`[Solver] Used code execution ${codeExecutions} time(s)`);
  }

  const solved = parseSolverOutput(rawText, topic);

  if (!solved.body) {
    throw new Error('Solver output has no body content (missing STRATEGY)');
  }

  const separatorCount = (solved.body.match(/^\s*---\s*$/gm) || []).length;
  console.log(`[Solver] Complete — title: "${solved.title}"`);
  console.log(`[Solver] Body has ${separatorCount} \`---\` separator(s) → ${separatorCount + 1} block(s)`);
  console.log(`[Solver] ----- BODY START -----\n${solved.body}\n[Solver] ----- BODY END -----`);
  return solved;
}
