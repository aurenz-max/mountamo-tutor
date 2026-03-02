import type { BloomPhase } from './types';

/**
 * Verb → Bloom's phase mapping per PRD §6.1.
 * First matching verb in the subskill description determines the phase.
 */
const IDENTIFY_VERBS = [
  'recognize', 'identify', 'name', 'label', 'match', 'locate', 'find',
  'point', 'select', 'recall', 'list', 'define', 'state',
];

const EXPLAIN_VERBS = [
  'explain', 'compare', 'describe', 'distinguish', 'classify', 'categorize',
  'interpret', 'summarize', 'paraphrase', 'contrast', 'differentiate',
  'discuss', 'illustrate', 'predict', 'infer',
];

const APPLY_VERBS = [
  'produce', 'create', 'apply', 'sort', 'generate', 'use', 'solve',
  'build', 'construct', 'demonstrate', 'calculate', 'compute', 'write',
  'draw', 'compose', 'design', 'model', 'perform', 'implement',
];

/**
 * Extract the leading verb from a subskill description.
 * Returns the lowercased first word.
 */
function extractLeadingVerb(description: string): string {
  return description.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
}

/**
 * Detect the Bloom's phase from a subskill description by analyzing its verb.
 * Returns null if no verb match is found.
 */
export function detectBloomPhase(description: string): BloomPhase | null {
  const verb = extractLeadingVerb(description);

  if (IDENTIFY_VERBS.includes(verb)) return 'identify';
  if (EXPLAIN_VERBS.includes(verb)) return 'explain';
  if (APPLY_VERBS.includes(verb)) return 'apply';

  // Also check if any verb appears anywhere in the description (not just leading)
  const lower = description.toLowerCase();
  for (const v of IDENTIFY_VERBS) {
    if (lower.includes(v)) return 'identify';
  }
  for (const v of EXPLAIN_VERBS) {
    if (lower.includes(v)) return 'explain';
  }
  for (const v of APPLY_VERBS) {
    if (lower.includes(v)) return 'apply';
  }

  return null;
}

/**
 * Assign a Bloom's phase to a subskill.
 * Uses verb detection first, falls back to positional assignment.
 */
export function assignBloomPhase(
  description: string,
  positionIndex: number,
): BloomPhase {
  const detected = detectBloomPhase(description);
  if (detected) return detected;

  // Positional fallback: 1st = identify, 2nd = explain, 3rd+ = apply
  if (positionIndex === 0) return 'identify';
  if (positionIndex === 1) return 'explain';
  return 'apply';
}

/** Cycle to the next Bloom's phase */
export function nextBloomPhase(current: BloomPhase): BloomPhase {
  const order: BloomPhase[] = ['identify', 'explain', 'apply'];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

/** Display labels for Bloom's phases */
export const BLOOM_LABELS: Record<BloomPhase, string> = {
  identify: 'Identify',
  explain: 'Explain',
  apply: 'Apply',
};

/** Color scheme matching ObjectivesViewer verbColorMap */
export const BLOOM_COLORS: Record<BloomPhase, { text: string; bg: string; border: string; rgb: string }> = {
  identify: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/15',
    border: 'border-blue-500/30',
    rgb: '59, 130, 246',
  },
  explain: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    rgb: '168, 85, 247',
  },
  apply: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
    rgb: '34, 197, 94',
  },
};
