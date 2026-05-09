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
}
