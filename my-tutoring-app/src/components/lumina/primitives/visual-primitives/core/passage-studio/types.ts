/**
 * PassageStudio — multi-block orchestrator anchored to a text stimulus.
 *
 * Pipeline (when generators land):
 *   orchestrate (1 call) → stimulus + N blocks (parallel calls) → student → judge → summary
 *
 * For now, content is fixture-driven. Schema is intentionally narrow (5 block
 * types, max 1 level of nesting) per CLAUDE.md's Gemini-schema discipline.
 */

import type { PrimitiveEvaluationResult } from '../../../../evaluation';
import type { PassageStudioMetrics } from '../../../../evaluation/types';

// ── Stimulus ────────────────────────────────────────────────────────

/**
 * The constant the entire primitive orbits around. Every block can reference
 * spans into the stimulus via `anchors`.
 *
 * The `text` field is the canonical rendered text — anchor offsets are char
 * indices into this string. For poems and dialogues, `text` is the joined
 * representation; the structured form is preserved for layout but offsets
 * are always against `text`.
 */
export type PassageStimulus =
  | {
      kind: 'prose';
      title?: string;
      author?: string;
      source?: string;
      text: string;
    }
  | {
      kind: 'poem';
      title: string;
      author?: string;
      lines: string[];
      /** Joined text with '\n' between lines. Anchor offsets resolve against this. */
      text: string;
    }
  | {
      kind: 'dialogue';
      title?: string;
      turns: Array<{ speaker: string; text: string }>;
      /** Joined text formatted as "Speaker: line\n…". Anchor offsets resolve against this. */
      text: string;
    }
  | {
      kind: 'sentence-set';
      sentences: string[];
      /** Joined sentences separated by '\n'. */
      text: string;
    };

/**
 * A character span into `stimulus.text`. End is exclusive.
 * Optional `label` is used by the orchestrator for grounding (e.g.
 * "thematic-claim", "vocab-target") — purely for authoring/debug.
 */
export interface PassageSpan {
  start: number;
  end: number;
  label?: string;
}

// ── Layouts ─────────────────────────────────────────────────────────

export type PassageLayout =
  | 'stack'              // passage-display block + everything else in vertical flow
  | 'split_passage'      // passage pinned left, blocks scroll right
  | 'reveal_beat'        // sequential reveal — passage chunks + their evaluables unlock in order
  | 'annotated_passage'; // passage center, blocks as margin notes anchored to spans

// ── Block discriminator ─────────────────────────────────────────────

export type BlockType =
  // display
  | 'passage-display'
  | 'pull-quote'
  | 'vocab-card'
  | 'author-context'
  // evaluable
  | 'comprehension-mcq'
  | 'evidence-highlight'
  | 'vocab-in-context'
  | 'inference-builder'
  | 'theme-statement';

// ── Base block ──────────────────────────────────────────────────────

export interface BaseBlockData {
  id: string;
  blockType: BlockType;
  label: string;
  /** Brief for the AI tutor — what to do when the student is on this block. */
  tutoringBrief?: string;
  /** Narrative connective tissue rendered between this block and the next. */
  transitionCue?: string;
  /**
   * Spans this block "owns" — the orchestrator highlights them in the passage
   * pane when this block is active (split_passage layout) or after it's
   * answered (stack layout). Display blocks can use this for static decor.
   */
  anchors?: PassageSpan[];
}

// ── Display blocks ──────────────────────────────────────────────────

export interface PassageDisplayBlockData extends BaseBlockData {
  blockType: 'passage-display';
  /** If set, only this slice of the stimulus renders. Otherwise full text. */
  excerpt?: PassageSpan;
  /** Show author/source line above the text. */
  showAttribution?: boolean;
}

export interface PullQuoteBlockData extends BaseBlockData {
  blockType: 'pull-quote';
  /** Quoted text — usually paraphrased or pulled from `anchors[0]`. */
  text: string;
  attribution?: string;
}

export interface VocabCardBlockData extends BaseBlockData {
  blockType: 'vocab-card';
  word: string;
  partOfSpeech?: string;
  definition: string;
  /** A sentence using the word — usually mirrors the passage's own usage. */
  exampleSentence?: string;
  etymology?: string;
  /**
   * If set, points to the word's appearance in the stimulus. The orchestrator
   * lights this up as a `reveal` anchor when the block is in view.
   */
  passageAnchor?: PassageSpan;
}

export interface AuthorContextBlockData extends BaseBlockData {
  blockType: 'author-context';
  /** 1–3 short paragraphs about the author/source/era. */
  paragraphs: string[];
  era?: string;
  genre?: string;
}

// ── Evaluable blocks ────────────────────────────────────────────────

export interface ComprehensionMcqBlockData extends BaseBlockData {
  blockType: 'comprehension-mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Span that grounds the correct answer. Lit up when the answer is revealed. */
  evidenceAnchor?: PassageSpan;
}

/**
 * Student selects which spans support a claim. Authoring provides a mix of
 * correct + distractor candidate spans; student toggles them; we score on
 * coverage of `isEvidence: true` spans.
 *
 * Free-form span selection (drag to highlight any text) is a v2 problem —
 * candidate-list selection makes v1 authorable AND judgeable without an LLM.
 */
export interface EvidenceHighlightBlockData extends BaseBlockData {
  blockType: 'evidence-highlight';
  claim: string;
  candidateSpans: Array<{
    span: PassageSpan;
    isEvidence: boolean;
    rationale?: string;
  }>;
  /** Student must select at least this many evidence spans. Defaults to all. */
  minCorrect?: number;
  explanation: string;
}

export interface VocabInContextBlockData extends BaseBlockData {
  blockType: 'vocab-in-context';
  /** The target word as it appears in the passage. */
  word: string;
  /** Span that points at the word's occurrence. Lit up while the block is active. */
  targetAnchor: PassageSpan;
  /** 3–4 plausible meanings. Only one fits THIS context. */
  meanings: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * Inference MCQ — student picks the best supported inference. Each candidate
 * carries an evidence anchor (or null for unsupported options) and a rationale.
 * Distinct from `comprehension-mcq`: this tests reasoning beyond what's stated,
 * so the candidates compete on plausibility, not literal correctness.
 */
export interface InferenceBuilderBlockData extends BaseBlockData {
  blockType: 'inference-builder';
  question: string;
  candidates: Array<{
    inference: string;
    /** Evidence span supporting this inference. Optional for unsupported distractors. */
    evidenceAnchor?: PassageSpan;
    rationale: string;
  }>;
  correctIndex: number;
  explanation: string;
}

/**
 * Free-response block — student writes 1–3 sentences expressing the passage's
 * theme. Judged by an LLM rubric authored at hydration time.
 *
 * The rubric is a list of weighted criteria (each 0–10). The judge returns a
 * verdict + per-criterion scores + concrete feedback. This is the only block
 * that requires a server-side rubric judge in v1.
 */
export interface ThemeStatementBlockData extends BaseBlockData {
  blockType: 'theme-statement';
  /** The prompt — usually "What is the theme of this passage? Write 1–3 sentences." */
  prompt: string;
  /** Authored rubric — the judge scores the student's response against these criteria. */
  rubric: ThemeRubricCriterion[];
  /** Authored exemplar — what a strong response looks like. Shown after submission. */
  exemplar: string;
  /** Min characters to enable submit. Defaults to 30. */
  minLength?: number;
  /** Max characters allowed. Defaults to 500. */
  maxLength?: number;
}

export interface ThemeRubricCriterion {
  /** Short label, e.g. "Theme identification", "Use of evidence". */
  label: string;
  /** What this criterion is measuring — feeds the judge prompt. */
  description: string;
  /** Weight 1–3. Total weight across criteria should be ~6. */
  weight: number;
}

/** Verdict shape returned by the rubric judge. */
export interface ThemeRubricVerdict {
  verdict: 'strong' | 'partial' | 'weak';
  /** 0–100 overall score. */
  score: number;
  /** Per-criterion breakdown. */
  criterionScores: Array<{
    label: string;
    score: number; // 0-10
    feedback: string;
  }>;
  /** Brief overall feedback shown alongside the exemplar. */
  summary: string;
}

// ── Union ───────────────────────────────────────────────────────────

export type PassageBlock =
  | PassageDisplayBlockData
  | PullQuoteBlockData
  | VocabCardBlockData
  | AuthorContextBlockData
  | ComprehensionMcqBlockData
  | EvidenceHighlightBlockData
  | VocabInContextBlockData
  | InferenceBuilderBlockData
  | ThemeStatementBlockData;

export type EvaluablePassageBlock =
  | ComprehensionMcqBlockData
  | EvidenceHighlightBlockData
  | VocabInContextBlockData
  | InferenceBuilderBlockData
  | ThemeStatementBlockData;

// ── Type guards ─────────────────────────────────────────────────────

export function isEvaluableBlock(block: PassageBlock): block is EvaluablePassageBlock {
  return (
    block.blockType === 'comprehension-mcq' ||
    block.blockType === 'evidence-highlight' ||
    block.blockType === 'vocab-in-context' ||
    block.blockType === 'inference-builder' ||
    block.blockType === 'theme-statement'
  );
}

// ── Top-level data ──────────────────────────────────────────────────

export interface PassageStudioData {
  title: string;
  subtitle?: string;
  gradeLevel: string;

  stimulus: PassageStimulus;
  blocks: PassageBlock[];

  layout?: PassageLayout;
  narrativeArc?: string;

  // Evaluation envelope (auto-injected by ManifestOrderRenderer in production)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PassageStudioMetrics>) => void;
}
