/**
 * Composition Templates — known-good block sequences the orchestrator
 * receives as hints. The orchestrator can deviate but gets a starting point.
 *
 * Templates are organized by pedagogical intent. The orchestrator prompt
 * receives the best-matching template as a structural suggestion.
 *
 * Block catalog (10 types):
 *   Display:    hero-image, key-facts, data-table, pull-quote, prose, timeline, compare-contrast, diagram (explore)
 *   Evaluable:  multiple-choice, fill-in-blank, diagram (label)
 */

import type { BlockType, WrapperLayout } from './types';

// ── Template slot definition ──────────────────────────────────────

interface TemplateSlot {
  primitive: BlockType;
  role: string;
  layoutOverride?: {
    position?: 'top';
    span?: 'full' | 'wide';
  };
}

export interface CompositionTemplate {
  id: string;
  description: string;
  intent: string;
  slots: TemplateSlot[];
  wrapperLayout: WrapperLayout;
  estimatedDurationMinutes: number;
}

// ── Template definitions ──────────────────────────────────────────

const TEMPLATES: CompositionTemplate[] = [
  // ─── Explanatory flows ─────────────────────────────────────────

  {
    id: 'concept_introduction',
    description: 'Standard concept teach: hook → explain → visualize → check',
    intent: 'introduce_new_concept',
    slots: [
      { primitive: 'hero-image', role: 'hook', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'core_explanation', layoutOverride: { span: 'wide' } },
      { primitive: 'key-facts', role: 'key_takeaways' },
      { primitive: 'pull-quote', role: 'insight_highlight' },
      { primitive: 'fill-in-blank', role: 'vocabulary_check' },
      { primitive: 'multiple-choice', role: 'comprehension_check' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 8,
  },
  {
    id: 'concept_exploration',
    description: 'Lighter explore: info → narrative → question',
    intent: 'explore_concept',
    slots: [
      { primitive: 'key-facts', role: 'key_fact' },
      { primitive: 'prose', role: 'explanation' },
      { primitive: 'pull-quote', role: 'insight' },
      { primitive: 'multiple-choice', role: 'probe' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 5,
  },

  // ─── Misconception repair ──────────────────────────────────────

  {
    id: 'misconception_repair',
    description: 'Surface a misconception, present evidence, force judgment, then explain',
    intent: 'correct_misconception',
    slots: [
      { primitive: 'pull-quote', role: 'surface_misconception', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'key-facts', role: 'counter_evidence' },
      { primitive: 'fill-in-blank', role: 'judgment_moment' },
      { primitive: 'prose', role: 'resolution' },
    ],
    wrapperLayout: 'reveal_progressive',
    estimatedDurationMinutes: 6,
  },

  // ─── Analytical / comparison ───────────────────────────────────

  {
    id: 'compare_and_contrast',
    description: 'Side-by-side analysis of two or more items',
    intent: 'analytical_comparison',
    slots: [
      { primitive: 'prose', role: 'framing', layoutOverride: { span: 'full' } },
      { primitive: 'compare-contrast', role: 'core_comparison', layoutOverride: { span: 'full' } },
      { primitive: 'data-table', role: 'supporting_data', layoutOverride: { span: 'full' } },
      { primitive: 'pull-quote', role: 'key_difference' },
      { primitive: 'multiple-choice', role: 'synthesis_question' },
    ],
    wrapperLayout: 'grid_2col',
    estimatedDurationMinutes: 7,
  },
  {
    id: 'dual_perspective',
    description: 'Two viewpoints presented and weighed — debates, trade-offs, dilemmas',
    intent: 'evaluate_perspectives',
    slots: [
      { primitive: 'pull-quote', role: 'provocative_claim', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'compare-contrast', role: 'perspectives', layoutOverride: { span: 'full' } },
      { primitive: 'prose', role: 'nuance_explanation' },
      { primitive: 'pull-quote', role: 'core_tension' },
      { primitive: 'multiple-choice', role: 'weigh_evidence' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 8,
  },

  // ─── Process / sequence ────────────────────────────────────────

  {
    id: 'process_walkthrough',
    description: 'Step-by-step process with timeline and visual support',
    intent: 'teach_process',
    slots: [
      { primitive: 'hero-image', role: 'process_visual', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'overview' },
      { primitive: 'timeline', role: 'process_steps', layoutOverride: { span: 'full' } },
      { primitive: 'key-facts', role: 'key_details' },
      { primitive: 'fill-in-blank', role: 'terminology_check' },
      { primitive: 'multiple-choice', role: 'application' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 10,
  },
  {
    id: 'historical_narrative',
    description: 'Timeline-anchored storytelling for history, biography, evolution',
    intent: 'chronological_narrative',
    slots: [
      { primitive: 'hero-image', role: 'era_visual', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'historical_context', layoutOverride: { span: 'wide' } },
      { primitive: 'timeline', role: 'key_events', layoutOverride: { span: 'full' } },
      { primitive: 'pull-quote', role: 'pivotal_moment' },
      { primitive: 'compare-contrast', role: 'before_vs_after' },
      { primitive: 'multiple-choice', role: 'cause_effect_check' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 10,
  },

  // ─── Data-driven ───────────────────────────────────────────────

  {
    id: 'data_deep_dive',
    description: 'Data-driven exploration with tables and cross-referencing questions',
    intent: 'data_analysis',
    slots: [
      { primitive: 'hero-image', role: 'visual_anchor', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'context' },
      { primitive: 'data-table', role: 'primary_data', layoutOverride: { span: 'full' } },
      { primitive: 'multiple-choice', role: 'data_question_1' },
      { primitive: 'pull-quote', role: 'data_insight' },
      { primitive: 'multiple-choice', role: 'data_question_2' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 10,
  },

  // ─── Evidence-based reasoning ──────────────────────────────────

  {
    id: 'claim_evidence_reasoning',
    description: 'CER framework: provocative claim → evidence for/against → reason through it',
    intent: 'scientific_reasoning',
    slots: [
      { primitive: 'pull-quote', role: 'testable_claim', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'key-facts', role: 'evidence_for' },
      { primitive: 'key-facts', role: 'evidence_against' },
      { primitive: 'data-table', role: 'supporting_data', layoutOverride: { span: 'full' } },
      { primitive: 'multiple-choice', role: 'construct_argument' },
      { primitive: 'prose', role: 'reasoning_synthesis' },
    ],
    wrapperLayout: 'grid_2col',
    estimatedDurationMinutes: 8,
  },

  // ─── Vocabulary / terminology ──────────────────────────────────

  {
    id: 'vocabulary_builder',
    description: 'Vocabulary-dense lesson: define → contextualize → test precise recall',
    intent: 'build_vocabulary',
    slots: [
      { primitive: 'key-facts', role: 'term_definitions' },
      { primitive: 'prose', role: 'terms_in_context' },
      { primitive: 'pull-quote', role: 'memorable_usage' },
      { primitive: 'fill-in-blank', role: 'recall_check_1' },
      { primitive: 'fill-in-blank', role: 'recall_check_2' },
      { primitive: 'multiple-choice', role: 'application_check' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 7,
  },

  // ─── Quick review ──────────────────────────────────────────────

  {
    id: 'rapid_review',
    description: 'Fast-paced check across multiple modalities',
    intent: 'review_reinforce',
    slots: [
      { primitive: 'key-facts', role: 'key_reminder' },
      { primitive: 'fill-in-blank', role: 'vocabulary_warmup' },
      { primitive: 'data-table', role: 'differentiation_check', layoutOverride: { span: 'full' } },
      { primitive: 'multiple-choice', role: 'synthesis' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 5,
  },

  // ─── Narrative / editorial ─────────────────────────────────────

  {
    id: 'narrative_journey',
    description: 'Rich narrative with editorial rhythm — articles, not flashcards',
    intent: 'narrative_exploration',
    slots: [
      { primitive: 'hero-image', role: 'visual_hook', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'opening_narrative', layoutOverride: { span: 'wide' } },
      { primitive: 'pull-quote', role: 'key_insight' },
      { primitive: 'key-facts', role: 'structured_summary' },
      { primitive: 'prose', role: 'deeper_explanation' },
      { primitive: 'multiple-choice', role: 'comprehension' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 10,
  },

  // ─── Broad overview ────────────────────────────────────────────

  {
    id: 'mosaic_overview',
    description: 'Multi-faceted topic overview in masonry layout — many small blocks',
    intent: 'broad_overview',
    slots: [
      { primitive: 'hero-image', role: 'visual_anchor', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'key-facts', role: 'facts_a' },
      { primitive: 'key-facts', role: 'facts_b' },
      { primitive: 'pull-quote', role: 'insight' },
      { primitive: 'compare-contrast', role: 'quick_comparison' },
      { primitive: 'prose', role: 'connecting_narrative' },
      { primitive: 'fill-in-blank', role: 'check' },
    ],
    wrapperLayout: 'masonry',
    estimatedDurationMinutes: 7,
  },

  // ─── Spatial / structural ────────────────────────────────────────

  {
    id: 'spatial_structure',
    description: 'Labeled diagram as central teaching artifact — explain, show spatially, then test',
    intent: 'teach_spatial_structure',
    slots: [
      { primitive: 'hero-image', role: 'visual_hook', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'prose', role: 'conceptual_introduction', layoutOverride: { span: 'wide' } },
      { primitive: 'diagram', role: 'labeled_diagram', layoutOverride: { span: 'full' } },
      { primitive: 'key-facts', role: 'part_functions' },
      { primitive: 'pull-quote', role: 'spatial_insight' },
      { primitive: 'multiple-choice', role: 'spatial_reasoning_check' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 9,
  },
  {
    id: 'diagram_label_challenge',
    description: 'Teach structure then test spatial understanding via label placement',
    intent: 'assess_spatial_understanding',
    slots: [
      { primitive: 'prose', role: 'introduction', layoutOverride: { span: 'wide' } },
      { primitive: 'key-facts', role: 'vocabulary' },
      { primitive: 'diagram', role: 'label_assessment', layoutOverride: { span: 'full' } },
      { primitive: 'pull-quote', role: 'synthesis' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 8,
  },

  // ─── Cause and effect ──────────────────────────────────────────

  {
    id: 'cause_and_effect',
    description: 'Trace causes to consequences — chain reactions, cascading events, systems thinking',
    intent: 'causal_reasoning',
    slots: [
      { primitive: 'pull-quote', role: 'provocative_question', layoutOverride: { position: 'top', span: 'full' } },
      { primitive: 'timeline', role: 'causal_chain', layoutOverride: { span: 'full' } },
      { primitive: 'prose', role: 'mechanism_explanation' },
      { primitive: 'key-facts', role: 'consequences' },
      { primitive: 'multiple-choice', role: 'predict_outcome' },
    ],
    wrapperLayout: 'stack',
    estimatedDurationMinutes: 8,
  },
];

// ── Intent mapping from eval modes ───────────────────────────────

const EVAL_MODE_TO_INTENTS: Record<string, string[]> = {
  explore: ['explore_concept', 'narrative_exploration', 'broad_overview', 'teach_spatial_structure'],
  recall: ['review_reinforce', 'build_vocabulary', 'introduce_new_concept', 'teach_spatial_structure'],
  apply: ['data_analysis', 'teach_process', 'analytical_comparison', 'causal_reasoning', 'assess_spatial_understanding'],
  analyze: ['scientific_reasoning', 'evaluate_perspectives', 'analytical_comparison', 'correct_misconception', 'assess_spatial_understanding'],
};

const DEFAULT_INTENTS = ['introduce_new_concept', 'narrative_exploration'];

// ── Template matching ────────────────────────────────────────────

/**
 * Find the best-matching composition template for the given eval mode.
 * If a templateId is provided, it takes priority over eval mode matching.
 * Returns the template + a formatted hint string for the orchestrator prompt.
 */
export function matchTemplate(evalMode?: string, templateId?: string): {
  template: CompositionTemplate;
  promptHint: string;
} {
  // Direct template selection takes priority over eval mode matching
  if (templateId) {
    const directMatch = TEMPLATES.find((t) => t.id === templateId);
    if (directMatch) {
      const slotList = directMatch.slots
        .map((s, i) => `  ${i + 1}. ${s.primitive} (${s.role})${s.layoutOverride?.span ? ` [${s.layoutOverride.span}]` : ''}`)
        .join('\n');

      return {
        template: directMatch,
        promptHint: `## Composition Hint (Directed Template)
You MUST follow this template closely. It was explicitly selected by the instructor.

Template: "${directMatch.id}" — ${directMatch.description}
Required layout: ${directMatch.wrapperLayout}
Slots:
${slotList}

Follow the slot sequence and layout. You may adjust content briefs to fit the topic, but preserve the block types and their roles.`,
      };
    }
  }

  const intents = evalMode
    ? EVAL_MODE_TO_INTENTS[evalMode] || DEFAULT_INTENTS
    : DEFAULT_INTENTS;

  // Find first template matching any preferred intent
  const template = intents.reduce<CompositionTemplate | null>((found, intent) => {
    if (found) return found;
    return TEMPLATES.find((t) => t.intent === intent) || null;
  }, null) || TEMPLATES[0];

  const slotList = template.slots
    .map((s, i) => `  ${i + 1}. ${s.primitive} (${s.role})${s.layoutOverride?.span ? ` [${s.layoutOverride.span}]` : ''}`)
    .join('\n');

  const promptHint = `## Composition Hint
The following template is a suggested starting point — you can deviate, reorder, or substitute blocks as the topic demands. This is a hint, not a constraint.

Template: "${template.id}" — ${template.description}
Suggested layout: ${template.wrapperLayout}
Slots:
${slotList}

You may add, remove, or reorder blocks. The template captures a known-good pedagogical sequence for this type of lesson.`;

  return { template, promptHint };
}

/**
 * Get all available templates (for tester/inspector UI).
 */
export function getTemplates(): CompositionTemplate[] {
  return TEMPLATES;
}

/**
 * Format a template's slot sequence as a string for the orchestrator prompt.
 */
export function formatTemplateForPrompt(template: CompositionTemplate): string {
  return template.slots.map((s) => s.primitive).join(' → ');
}
