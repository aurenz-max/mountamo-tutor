/**
 * Sibling Problem Generator — Try-Mode hydration.
 *
 * Given an authored worked example, produces ONE isomorphic problem that the
 * student solves themselves on the Try-It canvas. The sibling reuses the same
 * three-stage scaffolding as the original (solver → blocks → planner →
 * per-step generators) so the canonical solution has the same kinds of step
 * primitives — algebra, table, graph-sketch, case-split — that the worked
 * example demonstrated. The challenger pass is skipped: the student is doing
 * the solve, so prediction gates layered on top would be redundant.
 *
 * Two-step pipeline:
 *   1. Author an isomorphic problem statement (one Gemini Lite call).
 *   2. Hydrate it through the existing pipeline with `pinnedProblem` and
 *      `skipChallenger=true`.
 */

import { Type, Schema } from '@google/genai';
import { ai } from '../geminiClient';
import { generateAnnotatedExample } from './gemini-annotated-example';
import type { RichAnnotatedExampleData } from '../../primitives/annotated-example/types';

// ── Step 1: author the sibling problem statement ─────────────────────

const SIBLING_PROBLEM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    problemStatement: {
      type: Type.STRING,
      description:
        'The isomorphic problem statement, written exactly as a student would see it. Same skill, same difficulty, same misconception structure as the original — different surface numbers.',
    },
    rationale: {
      type: Type.STRING,
      description:
        'One short sentence explaining what makes this isomorphic to the original — which structural features were preserved, which surface details changed.',
    },
  },
  required: ['problemStatement', 'rationale'],
};

interface SiblingProblemOutput {
  problemStatement: string;
  rationale: string;
}

async function authorSiblingProblem(input: {
  originalProblem: string;
  originalStrategy: string;
  subject: string;
  gradeContext: string;
}): Promise<SiblingProblemOutput> {
  const prompt = `You are authoring a practice problem for a student who just watched a worked example.

## The worked example they just saw
Subject: ${input.subject}
Problem: "${input.originalProblem}"
Strategy: ${input.originalStrategy}

## Your task
Author ONE isomorphic problem the student will now solve themselves. Isomorphic means SAME SKILL with DIFFERENT SURFACE NUMBERS.

## Rules

1. **Same skill family.** If the original was a 2-step linear equation (e.g. \`2x + 5 = 7\`), yours must also be a 2-step linear equation. If the original was an integral by substitution, yours must also be an integral by substitution. Do NOT switch to a different skill.

2. **Same step structure.** The canonical solve should have the same number of major moves as the original. A 3-move original gets a 3-move sibling.

3. **Different surface numbers.** Don't reuse the same constants. \`2x + 5 = 7\` should not become \`2x + 5 = 9\` — that's the same problem with a tweak. Aim for \`3x + 4 = 13\` or \`5x − 2 = 18\`.

4. **Comparable difficulty.** Don't make the sibling significantly harder or easier than the original. Same grade level (${input.gradeContext}), same conceptual challenge.

5. **Misconception structure preserved.** If the original tests sign-handling on subtraction, the sibling should also create an opportunity for that misconception. If the original tests fraction comparison via common denominators, the sibling should too.

6. **Self-contained problem statement.** Write it the way a student would see it on a worksheet. Include any necessary setup, but don't reference the original problem or this conversation.

7. **No solution included.** Just the problem.

## Output

Return JSON with:
- \`problemStatement\`: the new problem, exactly as the student will read it.
- \`rationale\`: one sentence on what's preserved and what's changed.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-lite-latest',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: SIBLING_PROBLEM_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Sibling problem author returned empty response');

  const parsed = JSON.parse(text) as Record<string, unknown>;
  const problemStatement = typeof parsed.problemStatement === 'string' ? parsed.problemStatement.trim() : '';
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.trim() : '';
  if (!problemStatement) throw new Error('Sibling problem author returned empty problemStatement');

  return { problemStatement, rationale };
}

// ── Public entry ─────────────────────────────────────────────────────

export interface GenerateSiblingExampleInput {
  originalProblem: string;
  originalStrategy: string;
  subject: string;
  gradeContext?: string;
}

export interface SiblingExampleResult {
  data: RichAnnotatedExampleData;
  /** What the author model said it preserved/changed. Surfaced for debugging. */
  rationale: string;
}

/**
 * Author + hydrate one isomorphic practice problem for Try mode.
 *
 * The returned `data` has no challenger gates and uses the original subject
 * as its topic label. The student solves it themselves; the canonical inside
 * `data.steps` is what `compareWork` evaluates against in Phase 3.
 */
export async function generateSiblingExample(
  input: GenerateSiblingExampleInput,
): Promise<SiblingExampleResult> {
  const gradeContext = input.gradeContext ?? 'general';

  console.log('[Sibling] Authoring isomorphic problem statement...');
  const authored = await authorSiblingProblem({
    originalProblem: input.originalProblem,
    originalStrategy: input.originalStrategy,
    subject: input.subject,
    gradeContext,
  });
  console.log(`[Sibling] Authored: "${authored.problemStatement}"`);
  console.log(`[Sibling] Rationale: ${authored.rationale}`);

  console.log('[Sibling] Hydrating through pipeline (pinned problem, skipChallenger=true)...');
  const data = await generateAnnotatedExample(input.subject, gradeContext, {
    pinnedProblem: authored.problemStatement,
    skipChallenger: true,
  });

  return { data, rationale: authored.rationale };
}
