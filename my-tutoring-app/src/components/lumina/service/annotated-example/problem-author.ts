/**
 * Annotated-Problem Author — shared problem creator.
 *
 * One entry point for both flows of the annotated-example pipeline:
 *   - "fresh"   — author a representative problem for a topic. Caller may
 *                 request an inset by passing `insetType`. Used by the
 *                 original worked-example generator.
 *   - "sibling" — author an isomorphic problem to a previously-shown
 *                 worked example. The original's inset (if any) pins the
 *                 sibling's inset *type*, so the practice problem matches
 *                 the original's visual structure.
 *
 * The author runs ONE Gemini Lite call. Schema is monomorphic per inset
 * type (chosen up front by the caller) so structured output stays clean.
 *
 * Why a separate stage from the solver:
 *   The solver produces a worked solution given a problem. Conflating
 *   problem authoring (incl. inset) with solving forces one prompt to do
 *   too much, and there's no clean place to feed back the structured
 *   inset into the solver's plain-prose body. Authoring upstream lets
 *   both code paths (fresh and sibling) share the same author and pass
 *   `pinnedProblem` + `pinnedInset` to the solver downstream.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import {
  buildInsetPromptGuidance,
  getInsetGeminiSchema,
  serializeInsetForPrompt,
  type AuthorableInsetType,
} from './inset-helpers';
import type { Inset } from '../../types';

// ── Inputs ───────────────────────────────────────────────────────────

export interface AuthorAnnotatedProblemInput {
  /** "fresh" picks a problem for a topic; "sibling" matches a prior original. */
  mode: 'fresh' | 'sibling';
  topic: string;
  gradeContext: string;
  /**
   * Inset type the author should produce. Required for sibling mode when
   * the original had an inset (pin matching type). Optional for fresh mode
   * — when omitted, no inset is authored. The `image` variant is not
   * authorable here (Gemini text generation can't produce base64).
   */
  insetType?: AuthorableInsetType;
  /**
   * Detailed content brief from the orchestrator (fresh mode only). Steers
   * the author toward a specific concept / angle / inset shape. Ignored in
   * sibling mode (the original problem provides all the context the author
   * needs to write an isomorphic sibling).
   */
  brief?: string;
  /**
   * Targeted difficulty band (fresh mode). Surface to the author so a
   * "hard" slot doesn't get a trivial problem. Sibling mode inherits the
   * original's difficulty implicitly via the isomorphic-shape rule.
   */
  difficulty?: 'easy' | 'medium' | 'hard';
  /**
   * Sibling-mode context. The author preserves skill/structure/misconception
   * shape and changes surface numbers. Inset (if present) is referenced
   * so the sibling's inset is structurally analogous (same kind of data,
   * different values), not a verbatim copy.
   */
  original?: {
    problemStatement: string;
    strategy: string;
    subject: string;
    inset?: Inset;
  };
}

export interface AuthorAnnotatedProblemResult {
  problemStatement: string;
  inset?: Inset;
  /** One sentence describing what was preserved/changed (sibling) or what skill is exercised (fresh). */
  rationale: string;
}

// ── Schema ───────────────────────────────────────────────────────────

function buildSchema(insetType?: AuthorableInsetType): Schema {
  const properties: Record<string, Schema> = {
    problemStatement: {
      type: Type.STRING,
      description:
        'The problem as a student will read it on a worksheet. Self-contained, no meta-commentary, no solution. Reference the inset by label when applicable.',
    },
    rationale: {
      type: Type.STRING,
      description:
        'One sentence on the problem design — what skill is exercised (fresh) or what was preserved/changed from the original (sibling).',
    },
  };
  const required: string[] = ['problemStatement', 'rationale'];

  if (insetType) {
    properties.inset = getInsetGeminiSchema(insetType);
    required.push('inset');
  }

  return { type: Type.OBJECT, properties, required };
}

// ── Prompt assembly ──────────────────────────────────────────────────

function buildFreshPrompt(input: AuthorAnnotatedProblemInput): string {
  const insetGuidance = input.insetType
    ? buildInsetPromptGuidance(input.insetType)
    : '';

  const briefBlock = input.brief
    ? `\n\n## Orchestrator brief — your primary spec for this problem\n${input.brief}\n\nFollow this brief. The topic and grade level are already set; the brief tells you the specific angle, concept, and (for inset slots) the SHAPE of the inset content.`
    : '';

  const difficultyClause = input.difficulty
    ? `\n- Targeted difficulty: **${input.difficulty}**. ${
        input.difficulty === 'easy'
          ? 'Accessible warm-up — a single core skill, small numbers, no compound moves.'
          : input.difficulty === 'medium'
          ? 'Standard practice — multi-step but well-trodden; the student should recognize the skill family.'
          : 'Challenging — multi-step, requires synthesis or careful case-handling, plausible misconception-trigger.'
      }`
    : '';

  return `You are authoring a representative practice problem on "${input.topic}" for a ${input.gradeContext} student.${briefBlock}
${insetGuidance}

## Your task
Write ONE problem the student will solve. The problem should:
- Exercise the core skill of the topic (not a trivial special case).
- Be self-contained — a student can read it cold and start solving.
- Use grade-appropriate numbers and language.${difficultyClause}
- ${input.insetType ? `Reference the inset directly. The student must read the inset to solve.` : 'Be solvable from the statement alone.'}

## Output
Return JSON:
- \`problemStatement\`: the problem itself.
${input.insetType ? `- \`inset\`: the visual data the problem references (type "${input.insetType}").` : ''}
- \`rationale\`: one sentence on what skill the problem exercises.`;
}

function buildSiblingPrompt(input: AuthorAnnotatedProblemInput): string {
  const original = input.original;
  if (!original) {
    throw new Error('Sibling mode requires `original` context');
  }

  const insetGuidance = input.insetType
    ? buildInsetPromptGuidance(input.insetType)
    : '';

  const originalInsetText = original.inset
    ? `\nOriginal inset:\n${serializeInsetForPrompt(original.inset)}\n`
    : '';

  return `You are authoring a practice problem for a student who just watched a worked example.

## The worked example they just saw
Subject: ${original.subject}
Problem: "${original.problemStatement}"
Strategy: ${original.strategy}${originalInsetText}
${insetGuidance}

## Your task
Author ONE isomorphic problem the student will now solve themselves. Isomorphic means SAME SKILL with DIFFERENT SURFACE NUMBERS.

## Rules

1. **Same skill family.** If the original was a 2-step linear equation (e.g. \`2x + 5 = 7\`), yours must also be a 2-step linear equation. If the original was an integral by substitution, yours must also be an integral by substitution. Do NOT switch to a different skill.

2. **Same step structure.** The canonical solve should have the same number of major moves as the original.

3. **Different surface numbers.** Don't reuse the same constants. \`2x + 5 = 7\` should not become \`2x + 5 = 9\` — that's the same problem with a tweak. Aim for \`3x + 4 = 13\` or \`5x − 2 = 18\`.

4. **Comparable difficulty.** Don't make the sibling significantly harder or easier than the original. Same grade level (${input.gradeContext}), same conceptual challenge.

5. **Misconception structure preserved.** If the original tests sign-handling on subtraction, the sibling should also create an opportunity for that misconception. If the original tests fraction comparison via common denominators, the sibling should too.

6. **Self-contained problem statement.** Write it the way a student would see it on a worksheet. Don't reference the original problem or this conversation.

7. **No solution included.** Just the problem.
${
  input.insetType
    ? `
8. **Inset structurally analogous, different values.** The sibling's inset must be the SAME KIND as the original's (a table stays a table, a chart stays a chart, a number line stays a number line) with the SAME COLUMNS / AXES / FORMAT, but with DIFFERENT VALUES. Same shape, new data. The sibling problem statement must reference the inset the same way the original did (e.g. "From the table, find...", "On the number line, locate...").`
    : ''
}

## Output

Return JSON with:
- \`problemStatement\`: the new problem, exactly as the student will read it.
${input.insetType ? `- \`inset\`: the new visual data (type "${input.insetType}", same shape as original, new values).` : ''}
- \`rationale\`: one sentence on what's preserved and what's changed.`;
}

// ── Main entry ───────────────────────────────────────────────────────

export async function authorAnnotatedProblem(
  input: AuthorAnnotatedProblemInput,
): Promise<AuthorAnnotatedProblemResult> {
  const schema = buildSchema(input.insetType);
  const prompt =
    input.mode === 'sibling' ? buildSiblingPrompt(input) : buildFreshPrompt(input);

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Annotated problem author returned empty response');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    console.error('[problem-author] JSON parse failed:', error);
    throw new Error('Malformed problem-author response');
  }

  const problemStatement =
    typeof parsed.problemStatement === 'string' ? parsed.problemStatement.trim() : '';
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '';
  if (!problemStatement) {
    throw new Error('Annotated problem author returned empty problemStatement');
  }

  let inset: Inset | undefined;
  if (input.insetType && parsed.inset && typeof parsed.inset === 'object') {
    // Force the discriminator in case Gemini omitted it.
    inset = { ...(parsed.inset as object), insetType: input.insetType } as Inset;
  }

  return { problemStatement, inset, rationale };
}
