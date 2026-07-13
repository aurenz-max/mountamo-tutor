/**
 * resolveGenerationContext.ts — THE ONE PLACE the generation context is built.
 *
 * Called once inside the `registerContextGenerator` wrapper, before any generator
 * runs. Because this is the single boundary that shapes what a generator receives,
 * a handler physically cannot drop an axis — there is no per-handler config object
 * to get wrong. The five config-shaping idioms catalogued in the intent audit
 * (bare `item.config`, `{ ...item.config }`, `{ intent: item.intent }`, …) collapse
 * to zero.
 *
 * Pairs with generationContext.ts (the type) and scopeContext.ts (axis 1).
 */

import type { ManifestItem } from '../registry/contentRegistry';
import { resolvePedagogicalScope } from '../scopeContext';
import type { GenerationContext, SupportTier } from './generationContext';

const SUPPORT_TIERS: readonly SupportTier[] = ['easy', 'medium', 'hard'];

/**
 * STRICT lookup — the manifest enum-constrains config.difficulty to these.
 * Unknown/absent → undefined (no tier applied; grade-band defaults stand).
 *
 * This is the single home for support-tier normalization that ~41 math generators
 * currently copy verbatim (PRD §2.5). Generators read `ctx.supportTier`.
 */
function normalizeSupportTier(difficulty: unknown): SupportTier | undefined {
  const d = typeof difficulty === 'string' ? difficulty.toLowerCase().trim() : '';
  return (SUPPORT_TIERS as readonly string[]).includes(d) ? (d as SupportTier) : undefined;
}

/**
 * Normalize the objective's curriculum grade to the canonical 'K' | '1'..'12'.
 * Curriculum metadata arrives in several spellings ('K', 'Kindergarten', '2',
 * 'Grade 2', '2nd'); anything unrecognized → undefined (band defaults stand).
 * This is the ONLY place grade strings are parsed — generators read `ctx.grade`.
 */
function normalizeObjectiveGrade(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const g = raw.trim();
  if (!g) return undefined;
  if (/^(k|tk|kinder(garten)?)$/i.test(g)) return 'K';
  const m = g.match(/^(?:grade\s*)?(\d{1,2})(?:st|nd|rd|th)?(?:\s*grade)?$/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  if (n === 0) return 'K';
  return n >= 1 && n <= 12 ? String(n) : undefined;
}

/**
 * Build the `GenerationContext` from a manifest item plus the lesson framing the
 * dispatch site already has (topic, gradeContext prose, raw grade key).
 *
 * Intent precedence (matches the historical per-generator fallback so migration is
 * behavior-preserving): `config.intent` → `item.intent` → `item.title`. In
 * production `flattenManifestToLayout` injects `config.intent`; the `item.intent`
 * fallback keeps the eval-test path (which sets `config.intent` directly) and any
 * legacy caller working.
 */
export function resolveGenerationContext(
  item: ManifestItem,
  topic: string,
  gradeContext: string,
  gradeLevel: string,
): GenerationContext {
  const config = item.config ?? {};

  const intent = (config.intent as string | undefined) ?? item.intent ?? item.title;

  const objective = {
    id: config.objectiveId as string | undefined,
    text: config.objectiveText as string | undefined,
    verb: config.objectiveVerb as string | undefined,
  };

  // Axis 1 — always built; degrades gracefully when objective/intent absent.
  const scope = resolvePedagogicalScope(topic, config, intent);

  return {
    componentId: item.componentId,
    instanceId: item.instanceId,
    topic,
    gradeLevel,
    gradeContext,
    // Canonical per-objective curriculum grade — stamped by flattenManifestToLayout.
    grade: normalizeObjectiveGrade(config.objectiveGrade),
    title: item.title,
    intent,
    objective,
    scope,
    // Axis 2 input — the generator resolves the full constraint with its own docs.
    targetEvalMode: config.targetEvalMode as string | undefined,
    // Axis 3 — normalized once, here.
    supportTier: normalizeSupportTier(config.difficulty),
    // Private student-model signal stamped per objective by the manifest flatten.
    remediationFocus:
      typeof config.remediationFocus === 'string' && config.remediationFocus.trim()
        ? config.remediationFocus.trim()
        : undefined,
    raw: config,
  };
}
