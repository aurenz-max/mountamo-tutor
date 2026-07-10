/**
 * Misconception Loop — Station S1/S2 contracts.
 *
 * Companion spec: my-tutoring-app/src/components/lumina/docs/PRD_MISCONCEPTION_LOOP.md
 *
 * These are DATA contracts only. Primitives supply evidence; they never
 * diagnose. The shared distiller (distillMisconception.ts) turns evidence into
 * a one-sentence student-model diagnosis, or honestly abstains.
 *
 * Nothing in this module imports the Gemini client, so it is safe to import
 * from client components (the Diagnosis Lab) and from evaluation/types.ts.
 */

// =============================================================================
// S1 — Evidence contract (per primitive, data only)
// =============================================================================

/**
 * What the diagnosis engine needs to reason about a single failure.
 *
 * Evidence quality is decided by PRESENCE, not by a primitive-type flag:
 *  - Tier A (judge):      `judgeFeedback` present — a judge already explained
 *                         why the work fell short. Highest fidelity.
 *  - Tier B (structured): `expected` + `observed` present — a mechanical
 *                         primitive can state both precisely.
 *  - Tier C (absent):     neither → the engine abstains. No diagnosis, no write.
 */
export interface DiagnosisEvidence {
  /** What the challenge asked, in one or two sentences. */
  challengeSummary: string;
  /** The pedagogically correct outcome, described. Never shown to the student. */
  expected: string;
  /**
   * What the student actually did — the concrete interaction, selection,
   * construction, or (for spoken) transcript.
   */
  observed: string;
  /** For judge-driven primitives: the judge's evaluation text/fields. */
  judgeFeedback?: string;
  /**
   * Wrong-answer history within this session for the same subskill, if the
   * primitive tracks challenges. The single most important signal for telling a
   * consistent mental model apart from a one-off slip.
   */
  priorAttempts?: Array<{ challenge: string; observed: string }>;
}

/** Which evidence tier a packet qualifies for (or Tier C = not diagnosable). */
export type EvidenceTier = 'judge' | 'structured' | 'none';

/**
 * Classify an evidence packet by presence. Pure — used both by the distiller's
 * gate and by the Diagnosis Lab to preview which tier a packet lands in.
 *
 * Tier A wins over Tier B: when a judge already articulated the failure, we
 * reason from that rather than from expected/observed.
 */
export function classifyEvidenceTier(evidence: DiagnosisEvidence | null | undefined): EvidenceTier {
  if (!evidence) return 'none';
  if (evidence.judgeFeedback && evidence.judgeFeedback.trim()) return 'judge';
  if (
    evidence.expected &&
    evidence.expected.trim() &&
    evidence.observed &&
    evidence.observed.trim()
  ) {
    return 'structured';
  }
  return 'none';
}

// =============================================================================
// S2 — Distiller output contract
// =============================================================================

/** A usable, generative diagnosis: one sentence in student-model form. */
export interface MisconceptionDiagnosis {
  abstain: false;
  /**
   * One sentence, student-model form ("The student reads X as Y, so she …").
   * This text is a design spec for the NEXT problem — never feedback for the
   * student, never student-visible copy.
   */
  misconceptionText: string;
  /** Distiller's own confidence. `low` is downgraded to an abstain upstream. */
  confidence: 'high' | 'medium';
  /** Echo of the evidence tier the diagnosis was drawn from. Observability. */
  evidenceTier: 'judge' | 'structured';
}

/** An honest abstain — weak evidence writes NOTHING. Abstain is success. */
export interface MisconceptionAbstain {
  abstain: true;
  /** Why the distiller declined — for the bench and observability only. */
  reason: string;
  /** Echo of the evidence tier examined (or 'none' when Tier C gated it out). */
  evidenceTier: EvidenceTier;
}

/** The distiller always resolves to exactly one of these — never throws. */
export type MisconceptionResult = MisconceptionDiagnosis | MisconceptionAbstain;
