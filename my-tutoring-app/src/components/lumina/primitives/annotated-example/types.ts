/**
 * Rich Annotated Example Types
 *
 * Orchestrator + parallel step generator architecture.
 * Each step is a typed block (algebra, table, diagram, etc.)
 * with KaTeX expressions and animated transitions.
 */

import type { Inset } from '../../types';

export type { Inset };

// ═══════════════════════════════════════════════════════════════════════
// KaTeX Transition — the core animation primitive
// ═══════════════════════════════════════════════════════════════════════

/** A single KaTeX expression with optional highlight ranges for animation. */
export interface KaTeXExpression {
  /** KaTeX source string (e.g. "2x + 3 = 7") */
  latex: string;
  /** Character ranges to highlight — drives morph animation */
  highlights?: [number, number][];
}

/**
 * One per-term move that justifies how `from → to` was carried out. Renders
 * as a small inline row: `subFrom → subTo  · rule`. Use this to make the
 * mechanism visible — e.g. on `∫(2x - x²) dx → [x² - x³/3]`, attach two
 * sub-moves: `2x → x²` and `-x² → -x³/3`, both with rule "raise power, divide
 * by new power."
 */
export interface KaTeXSubMove {
  /** KaTeX of the term/factor as it appears in `from`. */
  from: string;
  /** KaTeX of the term/factor as it appears in `to`. */
  to: string;
  /** Short rule label ("power rule", "chain rule", "distribute"). */
  rule: string;
}

/** Animated transformation from one expression to another. */
export interface KaTeXTransition {
  from: KaTeXExpression;
  to: KaTeXExpression;
  /** Human-readable operation label ("subtract 3 from both sides") */
  operation: string;
  /**
   * Optional per-term breakdown of how the operation was carried out. Empty
   * (or omitted) means the operation is a single mechanical step that doesn't
   * benefit from showing inner moves (e.g. "subtract 3 from both sides").
   * Populate when the operation distributes across terms or applies a named
   * rule term-by-term.
   */
  subMoves?: KaTeXSubMove[];
  /**
   * Optional gated prediction. When present, the renderer hides the
   * indicated piece (`operation` or `to`) until the student commits an
   * answer. Free-response when `distractors` is empty/omitted; multiple
   * choice otherwise. The `rationale` is shown after the reveal regardless
   * of correctness.
   */
  challenge?: KaTeXTransitionChallenge;
}

/**
 * Per-transition prediction prompt. The student is asked to supply either
 * the next operation or the next expression before the canonical reveal.
 * Validation is lexical (normalized) plus a numerical fallback via
 * `tryEvaluateKatex` for `to` predictions; for `operation` we accept any
 * answer that matches one of `acceptableAnswers` after normalization.
 */
export interface KaTeXTransitionChallenge {
  /** Which slot the student fills in. */
  hide: 'operation' | 'to';
  /** Prompt shown above the input. Generator-supplied so it stays specific. */
  prompt: string;
  /**
   * Optional MCQ choices. The correct answer must also appear in
   * `acceptableAnswers`. When omitted, the student types a free response.
   */
  distractors?: string[];
  /**
   * Strings that count as correct after whitespace/case normalization. Always
   * includes the canonical answer; may include synonyms ("add 3" / "+3").
   */
  acceptableAnswers: string[];
  /** Shown after the reveal — explains why the answer is right. */
  rationale: string;
}

/**
 * Step-level prediction gate. Used for non-algebra step types (table,
 * diagram, graph-sketch, case-split) where there's no per-transition slot
 * to hide. The step's content is replaced by the prompt until the student
 * commits an answer; on commit, the content reveals and the rationale is
 * shown alongside their attempt. Algebra steps gate at the transition
 * level instead via `transitions[i].challenge`.
 */
export interface StepChallenge {
  /** Question shown above the input. */
  prompt: string;
  /**
   * Strings that count as correct after whitespace/case normalization. The
   * first entry is canonical (used as the displayed correct answer in MCQ
   * mode). Synonyms cover real student phrasings.
   */
  acceptableAnswers: string[];
  /**
   * Optional MCQ choices. When non-empty, the canonical answer is shuffled
   * with the distractors and the student picks. When empty/omitted, the
   * student types a free response.
   */
  distractors?: string[];
  /** Shown after commit — explains why the canonical answer is right. */
  rationale: string;
  /**
   * Render mode for the canonical answer + MCQ choices. Use `katex` when
   * the answer is a math expression ("y = 2x", "x < -1", "(2, 3)") so it
   * formats correctly; default `text` for conceptual/word answers
   * ("the y-intercept", "Case 1: x ≥ 0").
   */
  answerFormat?: 'text' | 'katex';
}

// ═══════════════════════════════════════════════════════════════════════
// Step Content Types — each step generator produces one of these
// ═══════════════════════════════════════════════════════════════════════

export interface AlgebraStepContent {
  type: 'algebra';
  /** The transitions forming this algebraic manipulation */
  transitions: KaTeXTransition[];
  /** Final expression after all transitions */
  result: string;
}

export interface TableStepContent {
  type: 'table';
  /** Table caption */
  caption: string;
  /** Column headers */
  headers: string[];
  /** Row data — cells can contain KaTeX strings (wrapped in $...$) */
  rows: string[][];
  /** Optional: which cell is the "answer" (row, col) */
  highlightCell?: [number, number];
}

export interface DiagramStepContent {
  type: 'diagram';
  /** Description for AI image generation */
  imagePrompt: string;
  /** Base64 image data (filled by generator) */
  imageBase64?: string;
  /** Labels overlaid on the diagram */
  labels: Array<{ text: string; description: string }>;
  /** Alt text for accessibility */
  altText: string;
}

/**
 * `graph-sketch` is the catalog id for what the math-primitive PRD calls
 * `canvas-2d`: a 2D plane with one or more curves, optional shaded regions,
 * labeled points, vectors, and feature badges. The legacy single-curve fields
 * (`expression`, `keyPoints`, `features`) are still honored — when `curves`
 * is empty the renderer falls back to plotting `expression` alone.
 */
export interface GraphSketchStepContent {
  type: 'graph-sketch';
  /** Legacy: KaTeX of the primary curve. When `curves` is set, treated as a label only. */
  expression: string;
  /** Key points to plot on the canvas: (x, y) with a label. */
  keyPoints: Array<{ x: number; y: number; label: string }>;
  /** Domain (x-axis range) */
  domain: [number, number];
  /** Range (y-axis range) */
  range: [number, number];
  /** Feature badges shown under the canvas — descriptive metadata, not on-canvas markers. */
  features: Array<{ kind: 'asymptote' | 'intercept' | 'maximum' | 'minimum' | 'inflection'; label: string; value: string }>;

  // ── canvas-2d extensions (PRD Phase 2) ───────────────────────────
  /** Axis labels. Default 'x' / 'y' when omitted. */
  xLabel?: string;
  yLabel?: string;
  /**
   * Curves to plot. Each `expression` is a KaTeX RHS in terms of `x` (the
   * renderer samples it client-side). When this array is non-empty it
   * supersedes the legacy `expression` field.
   */
  curves?: Array<{
    expression: string;
    color?: 'primary' | 'secondary' | 'tertiary';
    style?: 'solid' | 'dashed';
    label?: string;
  }>;
  /**
   * Regions between two curves over an x-interval — area-between-curves,
   * Riemann strips, between-the-axis-and-the-graph shading.
   */
  shadedRegions?: Array<{
    upper: string;
    lower: string;
    from: number;
    to: number;
    label?: string;
  }>;
  /** Free vectors drawn on the canvas (vector setups, gradient arrows, etc.). */
  vectors?: Array<{ from: [number, number]; to: [number, number]; label?: string }>;
  /** Optional caption rendered above the canvas. */
  caption?: string;
}

export interface CaseSplitStepContent {
  type: 'case-split';
  /** What we're splitting on */
  condition: string;
  /** Each branch */
  cases: Array<{
    label: string;
    condition: string;
    /** KaTeX for the work in this branch */
    work: string;
    result: string;
  }>;
}

/** Union of all step content types */
export type StepContent =
  | AlgebraStepContent
  | TableStepContent
  | DiagramStepContent
  | GraphSketchStepContent
  | CaseSplitStepContent;

export type StepType = StepContent['type'];

// ═══════════════════════════════════════════════════════════════════════
// Annotation Layers — same 4 pedagogical layers, per step
// ═══════════════════════════════════════════════════════════════════════

export interface StepAnnotations {
  /** What we're doing procedurally */
  steps: string;
  /** Why we're making this choice — metacognitive */
  strategy: string;
  /** Common error students make here */
  misconceptions: string;
  /** How this connects to broader concepts */
  connections: string;
  /**
   * Solver's plain-English prose for the block(s) grounding this step.
   * Populated by the orchestrator after generation — not by the per-primitive
   * generator — because it comes from the original solver prose, not the
   * structured step content. Empty/undefined for planner-injected steps.
   */
  narrative?: string;
}

export const ANNOTATION_LAYERS = [
  { id: 'steps' as const, label: 'Steps', color: '#3b82f6', icon: '📝' },
  { id: 'strategy' as const, label: 'Strategy', color: '#8b5cf6', icon: '🧠' },
  { id: 'misconceptions' as const, label: 'Watch Out', color: '#ef4444', icon: '⚠️' },
  { id: 'connections' as const, label: 'Connections', color: '#22c55e', icon: '🔗' },
  { id: 'narrative' as const, label: 'Narrative', color: '#06b6d4', icon: '📖' },
] as const;

export type LayerId = typeof ANNOTATION_LAYERS[number]['id'];

// ═══════════════════════════════════════════════════════════════════════
// Rich Example Step — a step with typed content + annotations
// ═══════════════════════════════════════════════════════════════════════

export interface RichExampleStep {
  id: number;
  title: string;
  content: StepContent;
  annotations: StepAnnotations;
  /**
   * Optional step-level prediction gate. When set, the step's content is
   * hidden until the student commits an answer (correct or not). Used for
   * non-algebra step types where transition-level gating doesn't apply.
   * Mutually exclusive with `transitions[i].challenge` on algebra steps —
   * the merge step enforces this.
   */
  challenge?: StepChallenge;
}

// ═══════════════════════════════════════════════════════════════════════
// Problem Statement
// ═══════════════════════════════════════════════════════════════════════

export interface ProblemStatement {
  /** Plain-text problem statement */
  statement: string;
  /** KaTeX expressions for given equations */
  equations?: string[];
  /** Additional context */
  context?: string;
  /**
   * Optional structured visual context — table, chart, number line, code
   * block, definition box, etc. Reuses the knowledge-check `Inset` union so
   * authoring + rendering infrastructure is shared. When set, the student
   * sees the inset alongside the statement and the judge / transcription
   * receive a serialized form of it as part of the problem context.
   */
  inset?: Inset;
}

// ═══════════════════════════════════════════════════════════════════════
// Top-level Data — what the component receives
// ═══════════════════════════════════════════════════════════════════════

export interface RichAnnotatedExampleData {
  title: string;
  subject: string;
  problem: ProblemStatement;
  /** The solution strategy narrative */
  solutionStrategy: string;
  steps: RichExampleStep[];
  /** If false, render all steps in display-only mode (no commit-gated reveals). Defaults to true. */
  interactive?: boolean;
  /**
   * Optional debug payload from the generation pipeline. When present, the UI
   * renders a collapsible card showing solver blocks + the planner's spec list
   * with grounding edges so dropped/injected/merged steps are visible.
   */
  solverDebug?: SolverDebugPayload;
  /**
   * Pre-hydrated isomorphic practice problems for the Try-It act. Multi-phase
   * pattern: the orchestrator (or other upstream caller) loads ALL phases
   * up front and passes them in together — the primitive never authors
   * problems mid-flight. Each entry's `steps` are the canonical solution
   * the judge / transcription compares the student's work against.
   *
   * The primitive cycles through this array as the student finishes each
   * try problem. Empty / undefined means Watch-only (Try button disabled).
   * Nested entries should NOT themselves carry `tryProblems`.
   */
  tryProblems?: RichAnnotatedExampleData[];
}

export interface SolverDebugPayload {
  /** Raw solver prose with `---` separators. */
  body: string;
  /** Number of `---` markers in the body. `separatorCount + 1` = block count. */
  separatorCount: number;
  /** One entry per solver block, in order. */
  blocks: Array<{ index: number; prose: string }>;
  /** The planner's plan that drove the render. */
  planner: PlannerDebugPayload;
  /**
   * Output of the challenge-layer pass. Optional — present when stage 4 ran
   * (whether or not it produced any assignments). Absent when challenges
   * were not requested for this generation.
   */
  challenger?: ChallengerDebugPayload;
}

/**
 * One step the planner thinks should be rendered. May merge multiple blocks
 * (`groundingBlockIndices.length > 1`), may be injected with no grounding
 * (`groundingBlockIndices.length === 0`), or may map 1:1 with a block.
 */
export interface StepSpec {
  stepType: StepType;
  title: string;
  /** Short sentence — what this step teaches, not what it computes. */
  pedagogicalGoal: string;
  /** Solver block indices that ground this step. Empty = planner-injected. */
  groundingBlockIndices: number[];
  /** Free-text guidance to the per-type generator for what to pull from the prose. */
  seedNotes: string;
}

export interface PlannerDebugPayload {
  /** The planner's plan — drives the render. */
  specs: StepSpec[];
  /** Block indices NOT covered by any spec — planner dropped them (a bug signal). */
  unusedBlockIndices: number[];
  /** Number of specs that have zero grounding blocks (planner-injected). */
  injectedCount: number;
  /** Number of specs that merge 2+ blocks (planner consolidated). */
  mergedCount: number;
  /** True when the planner failed and we fell back to a 1:1 algebra plan. */
  fallback: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Challenger — stage 4 of the pipeline
//
// Runs after per-spec generation. A single LLM call sees every algebra step
// and decides which transitions deserve a prediction prompt. Output is a
// list of `ChallengeAssignment`s that the orchestrator merges into the
// matching transitions. Failure is non-fatal: examples render unchanged
// when the challenger errors out.
// ═══════════════════════════════════════════════════════════════════════

/**
 * The challenger emits assignments in two flavors. `transition` assignments
 * gate one slot inside an algebra step's transition (the original behavior).
 * `step` assignments gate the entire content of a non-algebra step until
 * the student commits a prediction. The discriminator is `kind`; the merge
 * step routes each to the right shape on the rendered step.
 */
export type ChallengeAssignment =
  | TransitionChallengeAssignment
  | StepChallengeAssignment;

export interface TransitionChallengeAssignment {
  kind: 'transition';
  /** Index into `RichAnnotatedExampleData.steps`. Must point to an algebra step. */
  stepIndex: number;
  /** Index into the step's `transitions` array. */
  transitionIndex: number;
  /** Which slot to gate. */
  hide: 'operation' | 'to';
  /** Question shown to the student. */
  prompt: string;
  /** First entry MUST equal the canonical slot value; rest are synonyms. */
  acceptableAnswers: string[];
  /** Misconception-driven distractors. Empty → free-response. */
  distractors: string[];
  /** One-sentence explanation revealed after commit. */
  rationale: string;
}

export interface StepChallengeAssignment {
  kind: 'step';
  /** Index into `RichAnnotatedExampleData.steps`. Must point to a non-algebra step. */
  stepIndex: number;
  /** Question shown to the student. */
  prompt: string;
  /** First entry is the canonical answer; the rest are synonyms. */
  acceptableAnswers: string[];
  /** Misconception-driven distractors. Empty → free-response. */
  distractors: string[];
  /** One-sentence explanation revealed after commit. */
  rationale: string;
  /** How to render the canonical answer + MCQ choices. Defaults to 'text'. */
  answerFormat?: 'text' | 'katex';
}

export interface ChallengerDebugPayload {
  /** Assignments that successfully merged into a transition. */
  assignments: ChallengeAssignment[];
  /** Assignments rejected during merge — diagnostic for prompt iteration. */
  dropped: Array<{ assignment: ChallengeAssignment; reason: string }>;
  /** True when the challenger errored out and produced no assignments. */
  failed: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Orchestrator Plan — internal to the generator
// ═══════════════════════════════════════════════════════════════════════

export interface StepPlan {
  stepIndex: number;
  stepType: StepType;
  title: string;
  brief: string;
  /** Indices of steps whose output this step needs as input */
  dependsOn: number[];
  /** Hint for what annotations should emphasize */
  annotationFocus: string;
  /** The input expression(s) for this step — filled during wave execution */
  inputExpressions?: string[];
}

export interface SolutionPlan {
  title: string;
  subject: string;
  solutionStrategy: string;
  problem: ProblemStatement;
  steps: StepPlan[];
}

// ═══════════════════════════════════════════════════════════════════════
// Annotated-Example Orchestrator Output
//
// One Gemini Lite call authors the watched worked example (slot 0) plus
// any sibling practice problems (slots 1+) the student will solve on the
// Try-It canvas. The orchestrator is the SOLE problem author — it produces
// the actual problem statement and structured inset payload for every slot
// in one shot. Downstream `generateAnnotatedExample` pins the orchestrator's
// problem and runs the solver / planner / step-generator pipeline against
// it — it never authors.
// ═══════════════════════════════════════════════════════════════════════

export type AnnotatedExampleDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Inset variants the orchestrator may pick. Matches the authorable subset
 * (no `image` — Gemini text gen can't produce base64). `null` = plain text
 * problem with no inset. Keep this in sync with `AuthorableInsetType` in
 * `service/annotated-example/inset-helpers.ts`.
 */
export type AnnotatedPlannedInsetType =
  | 'katex'
  | 'data-table'
  | 'passage'
  | 'chart'
  | 'code'
  | 'number-line'
  | 'definition-box'
  | null;

export interface AnnotatedExampleProblemPlan {
  /** Ordinal position in the set, 0-based. 0 = watched example, 1+ = student-solved siblings. */
  index: number;
  /** Targeted difficulty band. */
  difficulty: AnnotatedExampleDifficulty;
  /** Inset attached to this problem. `null` means plain text. */
  insetType: AnnotatedPlannedInsetType;
  /** The actual problem statement, authored by the orchestrator. */
  problemStatement: string;
  /** Structured inset payload. Set when `insetType` is non-null. */
  inset?: Inset;
  /** One sentence on what skill the problem exercises (slot 0) or what was preserved/changed from slot 0 (siblings). */
  rationale: string;
}

export interface AnnotatedExampleSetPlan {
  problems: AnnotatedExampleProblemPlan[];
}
