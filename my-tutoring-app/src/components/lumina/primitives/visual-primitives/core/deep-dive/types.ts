/**
 * DeepDive Block Types
 *
 * Each block has a standardized data contract. The orchestrator picks
 * which blocks to use and in what order. Blocks are either display-only
 * or evaluable (interactive with scoring).
 */

import type { PrimitiveEvaluationResult } from '../../../../evaluation';
import type { DeepDiveMetrics } from '../../../../evaluation/types';

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
  | 'reflection';

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
  }>;
}

export interface DataTableBlockData extends BaseBlockData {
  blockType: 'data-table';
  headers: string[];
  rows: string[][];
  caption?: string;
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
  /** Which display block this question relates to (for cross-referencing) */
  relatedBlockId?: string;
}

// ── Phase 2 Blocks (reserved interfaces) ────────────────────────────

export interface TimelineBlockData extends BaseBlockData {
  blockType: 'timeline';
  events: Array<{
    date: string;
    title: string;
    description: string;
  }>;
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
  itemA: { title: string; points: string[] };
  itemB: { title: string; points: string[] };
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
  };
}

export interface ReflectionBlockData extends BaseBlockData {
  blockType: 'reflection';
  prompt: string;
}

// ── Union Type ──────────────────────────────────────────────────────

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
  | ReflectionBlockData;

// ── Evaluable block type guard ──────────────────────────────────────

export function isEvaluableBlock(block: DeepDiveBlock): block is MultipleChoiceBlockData | FillInBlankBlockData | DiagramBlockData | MiniSimBlockData {
  if (block.blockType === 'multiple-choice' || block.blockType === 'fill-in-blank') return true;
  if (block.blockType === 'diagram') return (block as DiagramBlockData).interactionMode === 'label';
  if (block.blockType === 'mini-sim') return !!(block as MiniSimBlockData).prediction;
  return false;
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

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DeepDiveMetrics>) => void;
}
