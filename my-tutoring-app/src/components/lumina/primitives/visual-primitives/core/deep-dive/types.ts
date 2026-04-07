/**
 * DeepDive Block Types
 *
 * Each block has a standardized data contract. The orchestrator picks
 * which blocks to use and in what order. Blocks are either display-only
 * or evaluable (interactive with scoring).
 */

import type { PrimitiveEvaluationResult } from '../../../../evaluation';
import type { DeepDiveMetrics } from '../../../../evaluation/types';

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
  imageBase64?: string;
  labels: Array<{ text: string; description: string }>;
}

export interface MiniSimBlockData extends BaseBlockData {
  blockType: 'mini-sim';
  prompt: string;
  sliderLabel: string;
  sliderMin: number;
  sliderMax: number;
  sliderDefault: number;
  outcomes: Array<{ range: [number, number]; text: string }>;
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

export function isEvaluableBlock(block: DeepDiveBlock): block is MultipleChoiceBlockData | FillInBlankBlockData {
  return block.blockType === 'multiple-choice' || block.blockType === 'fill-in-blank';
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

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DeepDiveMetrics>) => void;
}
