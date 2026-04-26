/**
 * Rich Annotated Example Types
 *
 * Orchestrator + parallel step generator architecture.
 * Each step is a typed block (algebra, table, diagram, etc.)
 * with KaTeX expressions and animated transitions.
 */

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

/** Animated transformation from one expression to another. */
export interface KaTeXTransition {
  from: KaTeXExpression;
  to: KaTeXExpression;
  /** Human-readable operation label ("subtract 3 from both sides") */
  operation: string;
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
}

export const ANNOTATION_LAYERS = [
  { id: 'steps' as const, label: 'Steps', color: '#3b82f6', icon: '📝' },
  { id: 'strategy' as const, label: 'Strategy', color: '#8b5cf6', icon: '🧠' },
  { id: 'misconceptions' as const, label: 'Watch Out', color: '#ef4444', icon: '⚠️' },
  { id: 'connections' as const, label: 'Connections', color: '#22c55e', icon: '🔗' },
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
