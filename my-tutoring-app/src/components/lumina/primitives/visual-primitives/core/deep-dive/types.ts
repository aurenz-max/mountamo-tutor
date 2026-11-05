/**
 * DeepDive Block Types
 *
 * Each block has a standardized data contract. The orchestrator picks
 * which blocks to use and in what order. Blocks are either display-only
 * or evaluable (interactive with scoring).
 */

import type { PrimitiveEvaluationResult } from '../../../../evaluation';
import type { DeepDiveMetrics } from '../../../../evaluation/types';
import type { ChartInset, DefinitionBoxInset, NumberLineInset, PassageInset } from '../../../../types';

// ── Wrapper Layout Strategies ──────────────────────────────────────
export type WrapperLayout = 'stack' | 'grid_2col' | 'reveal_progressive' | 'masonry';

// ── Size Hints (derived from Pretext height measurement) ──────────
export type SizeHint = 'compact' | 'standard' | 'wide' | 'full';

// ── Block Type Discriminator ────────────────────────────────────────
export type BlockType =
  | 'hero-image'
  | 'key-facts'
  | 'data-table'
  | 'multiple-choice'
  | 'pull-quote'
  | 'prose'
  // Phase 2 blocks (reserved)
  | 'timeline'
  | 'fill-in-blank'
  | 'compare-contrast'
  | 'diagram'
  | 'mini-sim'
  | 'perspectives'
  | 'hypothesis-lab'
  | 'reflection'
  // A catalog drawer primitive placed as a section (agentic author and follow-ups)
  | 'drawer'
  // A generated display from the display library (service/gen-display), run in a sandboxed iframe
  | 'display'
  // Display blocks drawn by the knowledge-check inset renderers
  | 'chart'
  | 'number-line'
  | 'definition'
  | 'passage'
  // A solved problem, step by step; at apply/analyze one step is the student's to pick
  | 'worked-example'
  // Stages of a one-way process in order (a cycle is the catalog's cycle wheel)
  | 'process'
  // A common wrong idea set against what is true
  | 'misconception';

// ── Base Block Data ─────────────────────────────────────────────────
export interface BaseBlockData {
  id: string;
  blockType: BlockType;
  label: string;
  /** Brief for the AI tutor — what to say/do when the student is on this block */
  tutoringBrief?: string;
  /** How this block connects to the next — narrative flow */
  transitionCue?: string;
  /** Size hint derived from Pretext height measurement — controls visual weight in layout */
  sizeHint?: SizeHint;
  /** 0-based index into DeepDiveData.sections (agentic author). */
  section?: number;
  /** The outline's key ideas this block teaches or tests, as "section.idea" refs ("2.1"). */
  ideas?: string[];
}

// ── Display Blocks ──────────────────────────────────────────────────

export interface HeroImageBlockData extends BaseBlockData {
  blockType: 'hero-image';
  imageBase64: string;
  caption: string;
  altText: string;
}

export interface KeyFactsBlockData extends BaseBlockData {
  blockType: 'key-facts';
  facts: Array<{
    icon: string;
    text: string;
    /** Punchy 2-4 word teaser. When present the fact renders as a flip card: front = icon + headline, back = full text. */
    headline?: string;
  }>;
}

export interface DataTableBlockData extends BaseBlockData {
  blockType: 'data-table';
  headers: string[];
  rows: string[][];
  caption?: string;
  /**
   * Find-the-pattern comprehension question grounded in the generated table
   * (answering requires comparing rows). Attached by generator CODE at
   * apply/analyze tiers; when present the block becomes evaluable.
   */
  patternCheck?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface PullQuoteBlockData extends BaseBlockData {
  blockType: 'pull-quote';
  /** The quote text — a key insight or takeaway */
  text: string;
  /** Optional attribution source (e.g., topic name, concept area) */
  attribution?: string;
}

export interface ProseBlockData extends BaseBlockData {
  blockType: 'prose';
  /** 1-4 paragraphs of explanatory narrative text */
  paragraphs: string[];
  /** Optional inline figure with text-wrap layout */
  figure?: {
    imageBase64: string;
    caption: string;
    altText: string;
    placement: 'left' | 'right';
  };
  /** Optional inset key facts — rendered as a floating card with Pretext text reflow */
  insetFacts?: {
    facts: Array<{ icon: string; text: string }>;
    placement: 'left' | 'right';
  };
  /**
   * Layout hint — controls how text is visually arranged.
   *   - 'flow' (default): standard paragraphs or text-around-figure
   *   - 'masonry': paragraphs rendered as a masonry card grid (pretext height prediction)
   *   - 'columns': force multi-column layout regardless of width
   */
  layout?: 'flow' | 'masonry' | 'columns';
  /** Whether to animate lines appearing one at a time on scroll */
  reveal?: boolean;
}

// ── Evaluable Blocks ────────────────────────────────────────────────

export interface MultipleChoiceBlockData extends BaseBlockData {
  blockType: 'multiple-choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /**
   * Picture stand-ins for the options, index-aligned with `options`. Generated
   * for pre-reader (K) audiences so the child answers by picture, not by
   * decoding the label (reader-fit rule 3). Optional / back-compatible.
   */
  optionEmojis?: string[];
  /** Which display block this question relates to (for cross-referencing) */
  relatedBlockId?: string;
}

// ── Phase 2 Blocks (reserved interfaces) ────────────────────────────

export interface TimelineBlockData extends BaseBlockData {
  blockType: 'timeline';
  /** Events in TRUE chronological order — this ordering is the answer key for 'order' mode. */
  events: Array<{
    date: string;
    title: string;
    description: string;
  }>;
  /**
   * 'static' (default) = display timeline; 'order' = events are shuffled and the
   * student reconstructs the sequence (evaluable). Set by generator CODE from the
   * eval mode (apply/analyze), never by the LLM.
   */
  interactionMode?: 'static' | 'order';
}

export interface FillInBlankBlockData extends BaseBlockData {
  blockType: 'fill-in-blank';
  sentence: string;
  blankIndex: number;
  correctAnswer: string;
  wordBank: string[];
}

export interface CompareContrastBlockData extends BaseBlockData {
  blockType: 'compare-contrast';
  /** Point→item assignment is the answer key for 'sort' mode. */
  itemA: { title: string; points: string[] };
  itemB: { title: string; points: string[] };
  /**
   * 'static' (default) = side-by-side display; 'sort' = points arrive pooled and
   * shuffled, the student assigns each to the right item (evaluable). Set by
   * generator CODE from the eval mode (recall+), never by the LLM.
   */
  interactionMode?: 'static' | 'sort';
}

export interface DiagramBlockData extends BaseBlockData {
  blockType: 'diagram';
  imageBase64: string;
  caption: string;
  altText: string;
  /** 'explore' = AI places labels, student clicks to learn; 'label' = student drags labels, LLM evaluates */
  interactionMode: 'explore' | 'label';
  labels: Array<{
    id: string;
    text: string;
    description: string;
    /** Percentage-based position (0-100). Only present in 'explore' mode — AI-placed via vision model. */
    position?: { x: number; y: number };
  }>;
  /** Context for LLM evaluation in 'label' mode */
  learningObjective?: string;
}

export interface MiniSimBlockData extends BaseBlockData {
  blockType: 'mini-sim';
  /** Setup context — describes the experiment/scenario */
  scenario: string;
  /** 'toggle' = on/off binary; 'slider' = continuous range */
  controlType: 'toggle' | 'slider';
  /** Label displayed above the control */
  controlLabel: string;
  /** Toggle-specific labels (e.g., "Detector OFF" / "Detector ON") */
  toggleOffLabel?: string;
  toggleOnLabel?: string;
  /** Slider-specific config */
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderUnit?: string;
  sliderDefault?: number;
  /** Each state maps a control value to an observable outcome.
   *  For toggles: exactly 2 states with condition "off" and "on".
   *  For sliders: 2-4 states with condition as "min-max" range strings (e.g., "0-33"). */
  states: Array<{
    condition: string;
    title: string;
    description: string;
    /** The "aha" insight — what this state reveals about the concept */
    keyObservation: string;
  }>;
  /** Optional prediction question asked BEFORE manipulation — makes the block evaluable.
   *  "What do you think will happen when X?" */
  prediction?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    /** Picture stand-ins for the prediction options, index-aligned with `options`.
     *  Generated for pre-reader lessons so a non-reader answers by picture. */
    optionEmojis?: string[];
  };
}

export interface ReflectionBlockData extends BaseBlockData {
  blockType: 'reflection';
  prompt: string;
}

// ── Hypothesis Lab ───────────────────────────────────────────────────
// Scientific-method scaffold. Student classifies factors from a scenario
// into independent variable (IV), dependent variable (DV), and controls
// held constant. Some factors are intentional distractors (irrelevant)
// that should remain in the pool — prevents shallow pattern matching
// where every chip must land in a zone.

export type HypothesisVariableRole = 'iv' | 'dv' | 'control' | 'irrelevant';

export interface HypothesisVariable {
  id: string;
  /** Short noun-phrase shown on the chip (e.g. "amount of water", "plant height") */
  label: string;
  /** Correct experimental role — the answer key */
  role: HypothesisVariableRole;
}

export interface HypothesisLabBlockData extends BaseBlockData {
  blockType: 'hypothesis-lab';
  /** 2-4 sentence experimental scenario in plain prose. MUST NOT pre-label
   *  which factor is IV/DV/control — that's the puzzle. */
  scenario: string;
  /** Optional instruction prompt — defaults to "Sort each factor into its role." */
  prompt?: string;
  /** Factors to classify. Must include exactly one 'iv', exactly one 'dv',
   *  at least one 'control', and may include up to 2 'irrelevant' distractors. */
  variables: HypothesisVariable[];
  /** Explanation shown after submission */
  explanation: string;
}

export interface PerspectiveAccount {
  id: string;
  /** Speaker name — historical figure or representative individual */
  name: string;
  /** Identity label that situates them — role, group, era, location */
  role: string;
  /** First-person narrative — 1-3 short paragraphs from this perspective */
  narrative: string[];
}

export interface PerspectivesBlockData extends BaseBlockData {
  blockType: 'perspectives';
  /** The shared event/topic each perspective speaks to — frames the comparison */
  eventDescription: string;
  /** 2-4 first-person accounts of the same event */
  perspectives: PerspectiveAccount[];
  /** Optional comprehension question — when present, the block is evaluable.
   *  Activates only after the student has viewed at least 2 perspectives. */
  comprehension?: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

// ── Union Type ──────────────────────────────────────────────────────

// ── Embedded drawer ─────────────────────────────────────────────────

/** An ungraded drawer primitive (catalog `drawer-*`) shown as a section: its own generator wrote `spec`, its registered component renders it. */
export interface DrawerBlockData extends BaseBlockData {
  blockType: 'drawer';
  drawerId: string;
  spec: unknown;
}

/** One section of the lesson's outline: a subtopic heading and the key ideas it must teach. */
export interface DeepDiveSection {
  heading: string;
  ideas: string[];
}

/** A generated display: a validated template from the display library, given this lesson's params. Ungraded. */
export interface GenDisplayBlockData extends BaseBlockData {
  blockType: 'display';
  displayId: string;
  /** The whole sandboxed page (React, the kit, the display, its params), built on the server. */
  html: string;
}

/** Real data as a bar, line or pie chart. Ungraded. */
export interface ChartBlockData extends BaseBlockData {
  blockType: 'chart';
  inset: ChartInset;
  /** Where the data comes from. */
  caption?: string;
}

/** Numbers placed on a line: order, distance, fractions, negatives, an interval. Ungraded. */
export interface NumberLineBlockData extends BaseBlockData {
  blockType: 'number-line';
  inset: NumberLineInset;
  caption?: string;
}

/** One term the lesson depends on, its meaning and an example. Ungraded. */
export interface DefinitionBlockData extends BaseBlockData {
  blockType: 'definition';
  inset: DefinitionBoxInset;
}

/** A text the student reads closely: a primary source, a poem, a letter, an excerpt. Ungraded. */
export interface PassageBlockData extends BaseBlockData {
  blockType: 'passage';
  inset: PassageInset;
  /** One sentence above the text: what to read it for. */
  intro?: string;
}

/** A solved problem shown one step at a time, each step with the reason for it. */
export interface WorkedExampleBlockData extends BaseBlockData {
  blockType: 'worked-example';
  /** The problem as posed. */
  problem: string;
  /** 2-6 steps in order: the work written down, and why that move. */
  steps: Array<{ work: string; reason: string }>;
  /** The result, stated after the last step. */
  answer: string;
  /**
   * Set by code at apply/analyze (evaluable): the student picks this step's work before it is shown. The options
   * are the real step and three errors a student makes there; steps after it stay hidden until it is answered.
   */
  tryStep?: { index: number; options: string[]; correctIndex: number; explanation: string };
}

/** The stages of a one-way process in order, from a start to an end. Ungraded. A cycle is `drawer-cycle-wheel`. */
export interface ProcessBlockData extends BaseBlockData {
  blockType: 'process';
  /** 3-6 stages in order. */
  stages: Array<{ icon: string; title: string; description: string }>;
}

/** A wrong idea students often hold, what is true instead, and the evidence. Ungraded. */
export interface MisconceptionBlockData extends BaseBlockData {
  blockType: 'misconception';
  /** The wrong idea, as a student would say it. */
  belief: string;
  /** What is true. */
  actually: string;
  /** Why: the evidence or reasoning that settles it. */
  why: string;
}

/** A related question the learner can open below the lesson; it runs through the follow-up path. */
export interface SeeAlsoLink {
  label: string;
  question: string;
}

export type DeepDiveBlock =
  | HeroImageBlockData
  | KeyFactsBlockData
  | DataTableBlockData
  | PullQuoteBlockData
  | ProseBlockData
  | MultipleChoiceBlockData
  | TimelineBlockData
  | FillInBlankBlockData
  | CompareContrastBlockData
  | DiagramBlockData
  | MiniSimBlockData
  | PerspectivesBlockData
  | HypothesisLabBlockData
  | ReflectionBlockData
  | DrawerBlockData
  | GenDisplayBlockData
  | ChartBlockData
  | NumberLineBlockData
  | DefinitionBlockData
  | PassageBlockData
  | WorkedExampleBlockData
  | ProcessBlockData
  | MisconceptionBlockData;

// ── Evaluable block type guard ──────────────────────────────────────

export function isEvaluableBlock(block: DeepDiveBlock): block is MultipleChoiceBlockData | FillInBlankBlockData | DiagramBlockData | MiniSimBlockData | PerspectivesBlockData | HypothesisLabBlockData | WorkedExampleBlockData {
  if (block.blockType === 'multiple-choice' || block.blockType === 'fill-in-blank') return true;
  if (block.blockType === 'worked-example') return !!(block as WorkedExampleBlockData).tryStep;
  if (block.blockType === 'diagram') return (block as DiagramBlockData).interactionMode === 'label';
  if (block.blockType === 'mini-sim') return !!(block as MiniSimBlockData).prediction;
  if (block.blockType === 'perspectives') return !!(block as PerspectivesBlockData).comprehension;
  if (block.blockType === 'hypothesis-lab') return true;
  return false;
}

// ── Agent debug (tester only) ───────────────────────────────────────

export interface DeepDiveAgentDebug {
  turns: number;
  seconds: number;
  deadline: 'none' | 'soft' | 'hard';
  /** The lesson shape the agent chose and the seeded candidates it chose from. */
  shape: string;
  shapeCandidates: string[];
  objective: string;
  /** Advisory checks still open when the lesson shipped. */
  advisories: string[];
  toolCalls: Array<{ turn: number; name: string; ms: number; ok: boolean; note?: string }>;
}

// ── DeepDive Data (Top-Level) ───────────────────────────────────────

export interface DeepDiveData {
  title: string;
  subtitle: string;
  topic: string;
  gradeLevel: string;
  blocks: DeepDiveBlock[];
  /** Narrative arc description for AI tutor context */
  narrativeArc?: string;
  /** Wrapper layout strategy — controls how blocks are spatially arranged */
  layout?: WrapperLayout;
  /** The outline (agentic author): blocks carry `section`; the page shows a heading per section and a contents list. */
  sections?: DeepDiveSection[];
  /** Related questions shown under the lesson (agentic author); each opens new sections through the follow-up path. */
  seeAlso?: SeeAlsoLink[];
  /** Set by the agentic author (service/core/deep-dive-agent); absent on the staged pipeline. */
  agentDebug?: DeepDiveAgentDebug;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DeepDiveMetrics>) => void;
}
