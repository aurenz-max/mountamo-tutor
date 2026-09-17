import 'server-only';

/**
 * Specialist suggestions for the curator prompt — the ONE production entry
 * point for TypeSafe in manifest generation, and the failsafe around it.
 *
 * WHAT IT ADDS. Per objective, TypeSafe's top-fit specialists, rendered by
 * gemini-manifest.ts as a SPECIALIST SUGGESTIONS block the curator may take or
 * ignore. Measured 2026-09-15 (qa/typesafe/suggest-ab-*.md): the strict preset
 * is safe (no low-fit candidate displaced a right tool; the curator rejected
 * verb-mismatched candidates), lifts the chance the curator picks a shown
 * specialist from ~46% to ~56%, and otherwise moves the pick set no more than
 * the curator's own run-to-run variance (44–49% Jaccard). Kept as an OPTIONAL
 * flag: the variance may earn its place under a quality judge later.
 *
 * FLAG. `LUMINA_TYPESAFE_SUGGESTIONS` = `off` (default) | `strict` | `loose`.
 * Off means this module does no work and the prompt is byte-identical to the
 * pre-flag prompt. Server env only; never read on the client.
 *
 * FAILSAFE — the block is an ENHANCEMENT, so nothing here may hold a lesson
 * hostage (same contract as resolveLessonEvalModes' RESOLUTION_TIMEOUT_MS):
 *   - no key                     → no block
 *   - any error, any objective   → that objective has no candidates
 *   - total budget TIMEOUT_MS    → abort every in-flight call, no block
 *   - BREAKER_FAILURES in a row  → skip entirely for BREAKER_OPEN_MS, one warn
 * Every path returns; none throws.
 */

import { POLICY_SCAFFOLD_IDS, selectPrimitives, suggestSpecialists, type PhaseRole } from './selectPrimitives';
import { typesafeConfigured } from './typesafeClient';
import type { SpecialistSuggestion } from '../gemini-manifest';

export type SuggestionArm = 'strict' | 'loose';

/** Presets. `strict` is the measured-safe one; `loose` reproduces the first A/B arm. */
export const SUGGESTION_PRESETS: Record<SuggestionArm, { minFit: number; max: number; excludeIds?: ReadonlySet<string> }> = {
  strict: { minFit: 2.2, max: 3, excludeIds: POLICY_SCAFFOLD_IDS },
  loose: { minFit: 1.5, max: 4 },
};

/** Whole-request budget across all objectives (they run in parallel). */
export const TIMEOUT_MS = 4000;
const BREAKER_FAILURES = 3;
const BREAKER_OPEN_MS = 5 * 60_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

/** The flag as the server sees it. Anything unrecognized reads as `off`. */
export function suggestionArmFromEnv(): SuggestionArm | null {
  const v = (process.env.LUMINA_TYPESAFE_SUGGESTIONS ?? 'off').trim().toLowerCase();
  return v === 'strict' || v === 'loose' ? v : null;
}

export interface SuggestionRun {
  arm: SuggestionArm;
  ms: number;
  perObjective: Array<
    SpecialistSuggestion & {
      error?: string;
      roles?: Array<{ role: PhaseRole; id: string; p: number }>;
    }
  >;
  /** Set when nothing ran (no key, breaker open, timeout) — perObjective is then empty. */
  error?: string;
}

export interface ObjectiveLike {
  id: string;
  text: string;
  grade?: string;
}

/**
 * Compute suggestions for a lesson's objectives. Never throws; an empty
 * `perObjective` (or one with only empty `candidates`) renders no block.
 */
export async function fetchSpecialistSuggestions(
  topic: string,
  gradeLevel: string,
  objectives: ObjectiveLike[] | undefined,
  arm: SuggestionArm,
  opts: { timeoutMs?: number } = {},
): Promise<SuggestionRun> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const t0 = Date.now();
  const done = (partial: Omit<SuggestionRun, 'arm' | 'ms'>): SuggestionRun => ({ arm, ms: Date.now() - t0, ...partial });

  if (!objectives?.length) return done({ perObjective: [] });
  if (!typesafeConfigured()) return done({ perObjective: [], error: 'TYPESAFE_API_KEY is not set' });
  if (Date.now() < breakerOpenUntil) {
    return done({ perObjective: [], error: `circuit open until ${new Date(breakerOpenUntil).toISOString()}` });
  }

  const preset = SUGGESTION_PRESETS[arm];
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let timedOut = false;

  try {
    const perObjective = await Promise.all(
      objectives.map(async (o) => {
        try {
          const r = await selectPrimitives({
            topic,
            grade: o.grade ?? gradeLevel,
            objectives: [o.text],
            k: 6,
            roleFilter: 'affordances',
            focus: 'objective',
            signal: ctl.signal,
          });
          return {
            objectiveId: o.id,
            objectiveText: o.text,
            candidates: suggestSpecialists(r, preset),
            roles: r.roles.map((x) => ({ role: x.role, id: x.id, p: x.p })),
          };
        } catch (e) {
          if (ctl.signal.aborted) timedOut = true;
          return {
            objectiveId: o.id,
            objectiveText: o.text,
            candidates: [],
            error: ctl.signal.aborted ? `timed out after ${timeoutMs} ms` : e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    const failures = perObjective.filter((p) => p.error).length;
    if (timedOut || failures === perObjective.length) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= BREAKER_FAILURES) {
        breakerOpenUntil = Date.now() + BREAKER_OPEN_MS;
        consecutiveFailures = 0;
        console.warn(
          `[typesafe-suggestions] ${BREAKER_FAILURES} consecutive failures — skipping for ${BREAKER_OPEN_MS / 60_000} min`,
        );
      }
      // A total failure renders no block; keep the per-objective errors for the trace.
      return done({ perObjective, error: timedOut ? `timed out after ${timeoutMs} ms` : 'every objective failed' });
    }
    consecutiveFailures = 0;
    return done({ perObjective });
  } catch (e) {
    // Promise.all cannot reject here (every branch catches), but never let a
    // surprise escape into manifest generation.
    consecutiveFailures += 1;
    return done({ perObjective: [], error: e instanceof Error ? e.message : String(e) });
  } finally {
    clearTimeout(timer);
  }
}

/** Test hook: reset the breaker between cases. */
export function _resetSuggestionBreaker(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}
