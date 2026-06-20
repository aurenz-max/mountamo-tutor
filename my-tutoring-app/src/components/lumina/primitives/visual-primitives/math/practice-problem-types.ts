/**
 * Practice Problem — lean canonical-solution shape.
 *
 * Replaces the rich AnnotatedExample step structure for practice mode. The
 * canvas + judge + live reviewer all consume a thin projection of the rich
 * shape (title, type tag, a body string, strategy, misconception); generating
 * the full RichExampleStep tree pays for affordances practice never uses
 * (subMoves, highlights, per-transition challenges, narrative/connections
 * annotation layers, typed step-content discriminants).
 *
 * `PracticeStep` carries exactly what the practice flow reads. The judge
 * wrapper in `PracticeProblem.tsx` envelopes it as `RichExampleStep[]` only at
 * the moment of POSTing to /api/lumina, so the existing judge/reviewer
 * endpoints stay untouched.
 */

import type { ProblemStatement, StepType } from '../../annotated-example/types';

export type PracticeDifficulty = 'easy' | 'medium' | 'hard';
export type PracticeEvalMode = 'derive_easy' | 'derive_medium' | 'derive_hard';

/**
 * One step of the canonical solution. The body is pre-serialized — for algebra
 * it's a `from -> [op] -> to` chain; for non-algebra it's a one-line salient
 * description (e.g. "Identify row 3 where revenue = 450"). The judge prompt
 * always re-serializes step content to a string anyway, so carrying it as text
 * removes a layer of indirection without losing fidelity.
 */
export interface PracticeStep {
  id: number;
  /** Short procedural title — drives the StepLedger slot row above the canvas. */
  title: string;
  /**
   * Type tag preserved from the AnnotatedExample step union. Used in judge
   * prompt summaries ("Step 1 — title (algebra)") so the LLM knows whether
   * to expect symbolic algebra, a chosen table row, a graph sketch, etc.
   */
  type: StepType;
  /**
   * The work for this step, pre-formatted as readable math/text. For algebra
   * write a "lhs -> [operation] -> rhs" chain in a single string; for table /
   * graph-sketch / case-split / diagram write the salient body in one line.
   */
  canonicalBody: string;
  /** Why we make this move — judge cites this when the student is on track. */
  strategy: string;
  /** Common error here — judge cites this when the student diverges. */
  misconceptions: string;
}

/**
 * Top-level data the practice canvas receives. Strictly a subset of
 * `RichAnnotatedExampleData`'s required fields plus the practice-specific
 * difficulty + evalMode + canonicalAnswer + gradeLevel.
 */
export interface PracticeProblemSolution {
  title: string;
  subject: string;
  problem: ProblemStatement;
  /** One-line strategy preview — never reveals the answer. */
  solutionStrategy: string;
  /**
   * The expected final answer in KaTeX (e.g. "x = 4"). Surfaced in the verdict
   * banner and used to ground the judge's `canonicalAnswer` field. Authored
   * directly by the canonical-solution generator so the judge never has to
   * extract it from typed step content.
   */
  canonicalAnswer: string;
  steps: PracticeStep[];
  difficulty: PracticeDifficulty;
  evalMode: PracticeEvalMode;
  gradeLevel: string;

  /**
   * Within-mode SUPPORT TIER (config.difficulty from the manifest).
   * ORTHOGONAL to `evalMode`/`difficulty` (the step-count band): the tier
   * controls how much of the worked scaffold the canvas REVEALS, never the
   * problem text, numbers, or step count. Absent → no tier (full scaffold).
   */
  supportTier?: PracticeSupportTier;
  /**
   * Per-tier reveal flags for the canvas. Display-only: withdrawing a scaffold
   * never changes the canonical steps the judge compares against. Absent when
   * no support tier was applied (the workspace shows the full scaffold).
   */
  support?: PracticeSupportFlags;
}

export type PracticeSupportTier = 'easy' | 'medium' | 'hard';

/**
 * Reveal flags driven by the support tier. The worked-step SKELETON shows step
 * TITLES only (the method shape) — never a `canonicalBody` or the final answer,
 * so withdrawing it at hard cannot leak the result.
 */
export interface PracticeSupportFlags {
  /** Show the StepLedger's procedural step titles (the method skeleton). */
  showStepSkeleton: boolean;
  /** Surface the first step's title + strategy as an on-canvas starter prompt. */
  showFirstStepHint: boolean;
  /** Show the one-line solutionStrategy preview above the canvas. */
  showStrategyPreview: boolean;
}
