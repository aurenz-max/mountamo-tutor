/**
 * Practice Visual Catalog
 *
 * Builds a focused catalog of visual primitives that support evaluation,
 * for use in the practice manifest Gemini prompt. Only includes primitives
 * that can serve as interactive answer mechanisms.
 */

import { ComponentId } from '../../types';
import { UNIVERSAL_CATALOG } from './catalog';

export interface PracticeVisualEntry {
  id: ComponentId;
  description: string;
  /** Which math/subject domains this primitive covers */
  domains: string[];
  /** What task types the primitive supports (e.g., build, identify, compare) */
  taskTypes: string[];
  /** What config fields Gemini should set */
  configHints: string;
}

/**
 * Subject-to-visual mapping for the Gemini prompt.
 * Maps topic keywords to the best visual primitives.
 */
const SUBJECT_VISUAL_MAP: Record<string, { componentIds: ComponentId[]; intentHint: string }> = {
  'fractions': {
    componentIds: ['fraction-circles', 'fraction-bar'],
    intentHint: 'Mention the target fraction (e.g., "3/4") and task: build, identify, or compare',
  },
  'place value': {
    componentIds: ['base-ten-blocks', 'place-value-chart'],
    intentHint: 'Mention the target number and whether to represent or decompose it',
  },
  'addition': {
    componentIds: ['regrouping-workbench', 'number-line', 'ten-frame'],
    intentHint: 'Mention the sum and addends',
  },
  'subtraction': {
    componentIds: ['regrouping-workbench', 'number-line'],
    intentHint: 'Mention the minuend and subtrahend',
  },
  'multiplication': {
    componentIds: ['array-grid', 'multiplication-explorer', 'area-model'],
    intentHint: 'Mention the two factors',
  },
  'equations': {
    componentIds: ['balance-scale'],
    intentHint: 'Mention the equation and the unknown value',
  },
  'ratios': {
    componentIds: ['ratio-table', 'double-number-line'],
    intentHint: 'Mention the ratio and related values',
  },
  'percents': {
    componentIds: ['percent-bar'],
    intentHint: 'Mention the target percentage',
  },
  'number ordering': {
    componentIds: ['number-line'],
    intentHint: 'Mention the numbers to plot and the range',
  },
  'counting': {
    componentIds: ['ten-frame', 'counting-board'],
    intentHint: 'Mention the target count',
  },
  'patterns': {
    componentIds: ['pattern-builder'],
    intentHint: 'Mention the pattern and what to extend or complete',
  },
  'skip counting': {
    componentIds: ['skip-counting-runner'],
    intentHint: 'Mention the skip count value and range',
  },
  'functions': {
    componentIds: ['function-machine'],
    intentHint: 'Mention the function rule and sample values',
  },
  'factoring': {
    componentIds: ['factor-tree'],
    intentHint: 'Mention the number to factorize',
  },
  'measurement': {
    componentIds: ['measurement-tools'],
    intentHint: 'Mention the measurement type and target value',
  },
  'geometry': {
    componentIds: ['shape-builder'],
    intentHint: 'Mention the target shape and its properties',
  },
};

/**
 * Returns catalog entries for visual primitives that:
 * 1. Have supportsEvaluation: true in the catalog
 * 2. Are suitable for practice problems (not purely display)
 */
export function getEvaluableVisualPrimitives(): PracticeVisualEntry[] {
  const entries: PracticeVisualEntry[] = [];

  for (const catalogEntry of UNIVERSAL_CATALOG) {
    if (!catalogEntry.supportsEvaluation) continue;

    // Skip non-visual / assessment primitives (they're problem types, not visuals)
    const skipIds: ComponentId[] = ['knowledge-check', 'flashcard-deck', 'curator-brief'];
    if (skipIds.includes(catalogEntry.id as ComponentId)) continue;

    // Determine domains and task types from the subject map
    const domains: string[] = [];
    const taskTypes: string[] = [];
    let configHints = '';

    for (const [domain, mapping] of Object.entries(SUBJECT_VISUAL_MAP)) {
      if (mapping.componentIds.includes(catalogEntry.id as ComponentId)) {
        domains.push(domain);
        configHints = mapping.intentHint;
      }
    }

    // Default task types based on common primitive patterns
    if (catalogEntry.id.includes('fraction')) {
      taskTypes.push('build', 'identify', 'compare');
    } else if (catalogEntry.id.includes('number-line')) {
      taskTypes.push('plot', 'jump', 'order');
    } else if (catalogEntry.id.includes('balance')) {
      taskTypes.push('solve');
    } else {
      taskTypes.push('build', 'explore');
    }

    entries.push({
      id: catalogEntry.id as ComponentId,
      description: catalogEntry.description,
      domains,
      taskTypes,
      configHints: configHints || 'Set title, description, and allowInteraction: true',
    });
  }

  return entries;
}

/**
 * Builds the Gemini prompt context string listing available visual primitives
 * and the subject-to-visual mapping.
 */
export function buildPracticeVisualCatalogContext(): string {
  const entries = getEvaluableVisualPrimitives();

  // Filter to math-related primitives for the main listing (most relevant for practice)
  const mathEntries = entries.filter(e => e.domains.length > 0);
  const otherEntries = entries.filter(e => e.domains.length === 0);

  let context = `\n=== AVAILABLE INTERACTIVE VISUAL PRIMITIVES ===\n`;
  context += `These visual primitives can REPLACE multiple-choice answers with interactive experiences.\n`;
  context += `When a visual primitive is used, the student answers by INTERACTING with it (clicking, dragging, building)\n`;
  context += `rather than selecting A/B/C/D text options.\n\n`;

  context += `--- MATH VISUALS (high-priority for math problems) ---\n`;
  for (const entry of mathEntries) {
    context += `• ${entry.id}: ${entry.description}\n`;
    context += `  Domains: ${entry.domains.join(', ')}\n`;
    context += `  Task types: ${entry.taskTypes.join(', ')}\n`;
    context += `  Config: ${entry.configHints}\n\n`;
  }

  if (otherEntries.length > 0) {
    context += `--- OTHER EVALUABLE VISUALS ---\n`;
    for (const entry of otherEntries) {
      context += `• ${entry.id}: ${entry.description.slice(0, 120)}...\n`;
    }
  }

  context += `\n--- SUBJECT-TO-VISUAL MAPPING ---\n`;
  for (const [subject, mapping] of Object.entries(SUBJECT_VISUAL_MAP)) {
    context += `• ${subject} → ${mapping.componentIds.join(', ')}\n`;
    context += `  Intent hint: ${mapping.intentHint}\n`;
  }

  context += `\n--- RULES ---\n`;
  context += `1. Use a visual primitive ONLY when it directly models the problem\n`;
  context += `2. Write a clear "intent" string describing what the generator should build (target values, task type, context)\n`;
  context += `3. For conceptual, vocabulary, or text-heavy problems: use standardProblem instead\n`;
  context += `4. Aim for 60-80% visual primitives for math topics, 0-20% for non-math\n`;
  context += `5. NEVER force a visual where it doesn't fit — a good multiple-choice question is better than a forced visual\n`;

  return context;
}
