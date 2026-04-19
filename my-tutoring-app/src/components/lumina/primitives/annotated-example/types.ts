/**
 * Rich Annotated Example Types
 *
 * Orchestrator + parallel step generator architecture.
 * Each step is a typed block (algebra, substitution, table, diagram, etc.)
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

export interface SubstitutionStepContent {
  type: 'substitution';
  /** The template expression with placeholders */
  template: string;
  /** Values being substituted in (variable → value) */
  substitutions: Array<{ variable: string; value: string }>;
  /** Expression after substitution */
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

export interface GraphSketchStepContent {
  type: 'graph-sketch';
  /** Function expression in KaTeX */
  expression: string;
  /** Key points to plot: [x, y, label] */
  keyPoints: Array<{ x: number; y: number; label: string }>;
  /** Domain range */
  domain: [number, number];
  /** Range */
  range: [number, number];
  /** Asymptotes, intercepts, etc. */
  features: Array<{ kind: 'asymptote' | 'intercept' | 'maximum' | 'minimum' | 'inflection'; label: string; value: string }>;
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

export interface VerificationStepContent {
  type: 'verification';
  /** The answer being verified */
  claim: string;
  /** Substitution back into original */
  checkTransitions: KaTeXTransition[];
  /** Does it check out? Always true for well-formed examples */
  verified: boolean;
}

/** Union of all step content types */
export type StepContent =
  | AlgebraStepContent
  | SubstitutionStepContent
  | TableStepContent
  | DiagramStepContent
  | GraphSketchStepContent
  | CaseSplitStepContent
  | VerificationStepContent;

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
