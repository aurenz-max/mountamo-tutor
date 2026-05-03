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
 *   1. Author an isomorphic problem statement + matching inset (if the
 *      original had one) via the shared annotated-problem author.
 *   2. Hydrate it through the existing pipeline with `pinnedProblem`,
 *      `pinnedInset`, and `skipChallenger=true`.
 */

import { authorAnnotatedProblem } from './problem-author';
import { isAuthorableInsetType } from './inset-helpers';
import { generateAnnotatedExample } from './gemini-annotated-example';
import type { RichAnnotatedExampleData } from '../../primitives/annotated-example/types';
import type { Inset } from '../../types';

// ── Public entry ─────────────────────────────────────────────────────

export interface GenerateSiblingExampleInput {
  originalProblem: string;
  originalStrategy: string;
  subject: string;
  gradeContext?: string;
  /**
   * The original worked example's inset (if any). When set, the sibling's
   * inset is pinned to the same `insetType` so the practice problem's
   * visual structure matches what the student just saw.
   */
  originalInset?: Inset;
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

  // Pin the inset type from the original so the sibling's visual structure
  // matches. `image` is not authorable here — it would require a separate
  // image-generation hop that the annotated pipeline doesn't have yet.
  const originalInsetType = input.originalInset?.insetType;
  const pinnedInsetType =
    originalInsetType && isAuthorableInsetType(originalInsetType)
      ? originalInsetType
      : undefined;

  console.log('[Sibling] Authoring isomorphic problem statement...', {
    pinnedInsetType: pinnedInsetType ?? null,
  });
  const authored = await authorAnnotatedProblem({
    mode: 'sibling',
    topic: input.subject,
    gradeContext,
    insetType: pinnedInsetType,
    original: {
      problemStatement: input.originalProblem,
      strategy: input.originalStrategy,
      subject: input.subject,
      inset: input.originalInset,
    },
  });
  console.log(`[Sibling] Authored: "${authored.problemStatement}"`);
  console.log(`[Sibling] Rationale: ${authored.rationale}`);

  console.log('[Sibling] Hydrating through pipeline (pinned problem, skipChallenger=true)...');
  const data = await generateAnnotatedExample(input.subject, gradeContext, {
    pinnedProblem: authored.problemStatement,
    pinnedInset: authored.inset,
    skipChallenger: true,
  });

  return { data, rationale: authored.rationale };
}
