/**
 * Distribution Explorer top-level entry.
 *
 * Wave-1 pipeline: a single orchestrator stage produces all of:
 *   - Initial distribution (family + parameters)
 *   - Lesson framing
 *   - Phase challenges
 *
 * Wave-2 may split this into a multi-stage pipeline (separate scenario
 * author + challenger), mirroring the AnnotatedExample architecture. The
 * API route depends on this module name only — internal stages can change
 * without breaking the route.
 */

import { runDistributionOrchestrator } from './orchestrator';
import type {
  DistributionEvalMode,
  DistributionExplorerData,
  DistributionFamily,
} from '../../primitives/distribution-explorer/types';

const VALID_EVAL_MODES: readonly DistributionEvalMode[] = [
  'explore',
  'identify',
  'compute_basic',
  'compute_advanced',
];

const DEFAULT_EVAL_MODE: DistributionEvalMode = 'identify';

function isValidEvalMode(value: string): value is DistributionEvalMode {
  return (VALID_EVAL_MODES as readonly string[]).includes(value);
}

export interface GenerateDistributionExplorerInput {
  topic: string;
  gradeContext: string;
  /** Typed eval mode (used by the tester / direct callers). */
  evalMode?: DistributionEvalMode;
  /**
   * String form from the manifest/registry config flow (`item.config.targetEvalMode`).
   * When set, takes precedence over `evalMode`. Must resolve to a valid
   * `DistributionEvalMode`; otherwise we fall back to `evalMode` then to the default.
   */
  targetEvalMode?: string;
  /** Optional: pin a specific family. */
  family?: DistributionFamily;
  /** Optional: free-text steering for the orchestrator. */
  intent?: string;
}

function resolveEvalMode(input: GenerateDistributionExplorerInput): DistributionEvalMode {
  const candidate = input.targetEvalMode ?? input.evalMode;
  if (candidate && isValidEvalMode(candidate)) {
    return candidate;
  }
  if (candidate) {
    console.warn(
      `[DE Generator] Invalid eval mode "${candidate}" — falling back to "${DEFAULT_EVAL_MODE}". `
        + `Valid modes: ${VALID_EVAL_MODES.join(', ')}`,
    );
  }
  return DEFAULT_EVAL_MODE;
}

export async function generateDistributionExplorer(
  input: GenerateDistributionExplorerInput,
): Promise<DistributionExplorerData> {
  return runDistributionOrchestrator({
    topic: input.topic,
    gradeLevel: input.gradeContext,
    evalMode: resolveEvalMode(input),
    family: input.family,
    context: input.intent,
  });
}
