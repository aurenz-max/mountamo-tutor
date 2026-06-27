/**
 * generationContext.ts — the ONE typed contract every generator receives.
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * `ManifestItem.config` is an untyped bag (`{ [key: string]: unknown }`), so each
 * of the ~100 generators invented its own way to read what the manifest sends, and
 * the registry boundary grew ~5 different config-shaping idioms (see the
 * 2026-06-27 intent audit / PRD_GENERATION_CONTEXT_HARMONIZATION.md). The result is
 * 100+ independently-developed copies of the same plumbing — intent threading,
 * scope resolution, eval-mode constraint, support tiers — each subtly different.
 *
 * THE CONTRACT
 * ------------
 * `GenerationContext` is a single typed envelope, resolved ONCE at the registry
 * boundary by `resolveGenerationContext` and consumed uniformly by every
 * context-native generator. Every cross-cutting axis becomes a field here, resolved
 * in exactly one place. A handler can no longer "forget" to thread intent because
 * handlers no longer shape config — the pipeline does.
 *
 * SCOPE OF THIS PHASE (Phase 0)
 * -----------------------------
 * The universally-resolvable axes are fully centralized here: lesson framing,
 * intent/objective, pedagogical `scope`, and the normalized `supportTier`.
 * Eval-mode and structural-difficulty resolution still need per-primitive metadata
 * (the primitive's `ChallengeTypeDoc` registry, its support/structural lever
 * tables), so for now the context carries the eval-mode *input* (`targetEvalMode`)
 * and the generator resolves the constraint with its own docs. Lifting that
 * metadata into per-primitive descriptors so the pipeline can resolve those axes
 * too is PRD Phase 1.
 */

import type { ComponentId } from '../../types';
import type { PedagogicalScope } from '../scopeContext';

/** Support tier — the scaffolding-withdrawal axis. Always one of these or absent. */
export type SupportTier = 'easy' | 'medium' | 'hard';

/** The Bloom-tagged learning objective the manifest assigned to this instance. */
export interface GenerationObjective {
  id?: string;
  text?: string;
  verb?: string;
}

/**
 * The single input every context-native generator receives (besides its response
 * schema). No generator reads `item`, `config`, or top-level manifest fields directly.
 */
export interface GenerationContext {
  // ── Identity ───────────────────────────────────────────────
  componentId: ComponentId;
  instanceId: string;

  // ── Lesson framing (always present) ────────────────────────
  /** Broad lesson topic, e.g. "Counting to 5". */
  topic: string;
  /** Raw normalized grade key, e.g. "kindergarten" — the CEILING. */
  gradeLevel: string;
  /** Grade-appropriate prose for prompts (the `gradeLevelContext` string). */
  gradeContext: string;

  // ── Objective / intent (the per-component assignment) ──────
  /** Specific objective the manifest assigned to THIS instance (≠ topic). */
  intent?: string;
  /** Bloom-tagged objective this component serves. Always present (fields may be undefined). */
  objective: GenerationObjective;

  // ── Axis 1: pedagogical scope (range/representation ceiling) ─
  /** Always built — degrades gracefully when objective/intent absent. */
  scope: PedagogicalScope;

  // ── Axis 2: eval-mode constraint (which challenge types) ───
  /**
   * Raw eval-mode pin from the manifest (e.g. 'build', 'a|b', 'mixed', or undefined).
   * Full `EvalModeConstraint` resolution stays per-generator until descriptors land
   * (PRD Phase 1) because it needs the primitive's `ChallengeTypeDoc` registry.
   */
  targetEvalMode?: string;

  // ── Axis 3: support tier (scaffolding withdrawal) ──────────
  /** Normalized support tier; undefined when the manifest sends none/unknown. */
  supportTier?: SupportTier;

  // ── Escape hatch: still-bespoke per-primitive config ───────
  /**
   * The raw manifest config, for genuinely primitive-specific fields during
   * migration (e.g. `challengeCount`, `gradeBand`). Discouraged; every access is a
   * candidate for promotion to a typed axis or removal.
   */
  raw: Readonly<Record<string, unknown>>;
}
