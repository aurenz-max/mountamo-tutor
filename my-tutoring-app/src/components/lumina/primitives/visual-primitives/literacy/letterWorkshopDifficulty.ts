import { getLetterTemplate } from './letterWorkshopGeometry';
import type { LetterWorkshopMode } from './letterWorkshopModes';

export type SupportTier = 'easy' | 'medium' | 'hard';
export function normalizeSupportTier(value: unknown): SupportTier | null {
  const tier = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return tier === 'easy' || tier === 'medium' || tier === 'hard' ? tier : null;
}

export function resolveSupportStructure(mode: LetterWorkshopMode, tier: SupportTier | null) {
  return {
    showStarts: mode === 'trace' && tier !== 'hard',
    showArrows: mode === 'trace' && (tier === null || tier === 'easy'),
    showLineLabels: tier === 'easy' || tier === 'medium',
    showChecklist: tier === 'easy',
    promptLines: [`${tier ?? 'default'} support: ${mode === 'trace' ? 'Keep the trace path at every tier; starts on easy/medium, arrows on easy only.' : 'Keep the copy model separate; write never receives a visible target.'}`,
      'Easy has writing-line labels and a self-check reminder; medium keeps labels only; hard keeps plain writing lines.'],
  };
}

/** A code-owned complexity measure, not a calibrated handwriting difficulty score. */
const structureCache = new Map<string, ReturnType<typeof measureStructure>>();
export function letterStructure(templateId: string) {
  // Templates are static, and band selection re-measures the same scope repeatedly.
  const cached = structureCache.get(templateId);
  if (cached) return cached;
  // Frozen: the cached record is shared by every challenge on the same template.
  const measured = Object.freeze(measureStructure(templateId));
  structureCache.set(templateId, measured);
  return measured;
}

function measureStructure(templateId: string) {
  const template = getLetterTemplate(templateId);
  const curves = template.strokes.filter(path => path.length > 6).length;
  const corners = template.strokes.reduce((sum, path) => sum + (path.length <= 6 ? Math.max(0, path.length - 2) : 0), 0);
  const points = template.strokes.flat();
  const extensions = template.letterCase === 'lowercase'
    ? Number(points.some(p => p.y < 145)) + Number(points.some(p => p.y > 245)) : 0;
  return { strokes: template.strokes.length, curves, corners, extensions,
    complexity: template.strokes.length + curves + corners + extensions };
}

/**
 * Scope is the cap: choose an available complexity band per requested case, never
 * invent a form. The anchor score IS the tier (lowest / middle / highest available);
 * it widens to neighbouring scores only when the anchor alone cannot supply one
 * distinct form per challenge. A tier that repeats a single letter for a whole
 * session is a variety defect, not a difficulty one.
 */
export function resolveProblemShape(mode: LetterWorkshopMode, tier: SupportTier, templateIds: readonly string[], count = 1) {
  const wanted = Number.isInteger(count) && count > 0 ? count : 1;
  const selected: string[] = [];
  const targets: Record<string, { min: number; max: number }> = {};
  for (const casing of ['uppercase', 'lowercase']) {
    const candidates = templateIds.filter(id => getLetterTemplate(id).letterCase === casing);
    if (!candidates.length) continue;
    const scores = Array.from(new Set(candidates.map(id => letterStructure(id).complexity))).sort((a, b) => a - b);
    const anchor = tier === 'easy' ? 0 : tier === 'hard' ? scores.length - 1 : Math.floor((scores.length - 1) / 2);
    let low = anchor;
    let high = anchor;
    const band = () => candidates.filter(id => {
      const complexity = letterStructure(id).complexity;
      return complexity >= scores[low] && complexity <= scores[high];
    });
    // Easy and medium widen upward first so medium never collapses into easy;
    // hard widens downward. Widening stops as soon as the band can fill the session.
    while (band().length < wanted && (low > 0 || high < scores.length - 1)) {
      if (tier !== 'hard' && high < scores.length - 1) high++;
      else if (low > 0) low--;
      else high++;
    }
    targets[casing] = { min: scores[low], max: scores[high] };
    selected.push(...band());
  }
  return { templateIds: selected, targets, promptLines: [
    `${mode} ${tier}: code selects the ${tier === 'easy' ? 'lowest' : tier === 'hard' ? 'highest' : 'middle'} available structural complexity within each allowed case, widening to the neighbouring band only to keep every item a different form.`,
    'Letter/group/case scope and task identity are fixed. A narrow scope may share structure across tiers.',
  ] };
}

export function buildTierPromptSection(mode: LetterWorkshopMode, tier: SupportTier, templateIds: readonly string[], count = 1) {
  return [...resolveSupportStructure(mode, tier).promptLines, ...resolveProblemShape(mode, tier, templateIds, count).promptLines].join('\n');
}
