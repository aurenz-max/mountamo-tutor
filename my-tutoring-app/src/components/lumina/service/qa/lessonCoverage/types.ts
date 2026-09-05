/**
 * Lesson objective-coverage eval — types.
 *
 * WHY. A lesson can look valid while the student is never asked to demonstrate
 * an objective it claims to teach (phonics: the continuant guard kept t/p out
 * of every production item while the objective named them). No single
 * generator can see that; only the ASSEMBLED lesson can. This eval reads the
 * artifact the student actually receives and answers one question per
 * objective: was it taught, was it assessed, and is the assessment enough to
 * infer mastery?
 *
 * The unit of quality is the objective loop (teach → assess → evidence), not
 * the individual problem. Phase 1 is SHADOW: results are persisted, nothing is
 * blocked or regenerated.
 */

export const COVERAGE_CATEGORIES = [
  'NOT_TAUGHT',
  'TAUGHT_NOT_ASSESSED',
  'ASSESSED_INSUFFICIENTLY',
  'ASSESSED_INDIRECTLY',
  'ASSESSED_SUFFICIENTLY',
] as const;
export type ModelCoverageCategory = (typeof COVERAGE_CATEGORIES)[number];
/** `NOT_EVALUATED` is code-side only: the evaluator returned no judgment for the objective. */
export type CoverageCategory = ModelCoverageCategory | 'NOT_EVALUATED';

export const COVERAGE_SEVERITIES = ['NONE', 'INFO', 'WARNING', 'CRITICAL'] as const;
export type CoverageSeverity = (typeof COVERAGE_SEVERITIES)[number];

export const CONSTRAINT_TYPES = [
  'content_guard',
  'generation_failure',
  'primitive_limitation',
  'off_target_assessment',
  'insufficient_items',
  'other',
] as const;
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number];

/** Independent assessment opportunities an objective needs before the eval may call it SUFFICIENT. */
export const MIN_SUFFICIENT_ASSESSMENT_ITEMS = 2;

export interface ObjectiveCoverage {
  objectiveId: string;
  objective: string;
  verb?: string;
  subskillId?: string;
  skillId?: string;
  grade?: string;
  category: CoverageCategory;
  taught: boolean;
  assessed: boolean;
  /** Validated evidence count — never the model's own number. */
  assessmentCount: number;
  /** Digest evidence ids (`<instanceId>` or `<instanceId>#<path>[i]`) that exist in the lesson. */
  assessmentEvidence: string[];
  instructionEvidence: string[];
  masteryInferenceSupported: boolean;
  severity: CoverageSeverity;
  notes: string | null;
  /** Ids the evaluator cited that are not in the lesson — discarded, kept for inspection. */
  discardedEvidence?: string[];
}

export interface DetectedConstraint {
  type: ConstraintType;
  description: string;
  instanceId: string | null;
}

export type CoverageStatus = 'pass' | 'warn' | 'fail' | 'error';

export interface LessonCoverageMeta {
  topic: string;
  gradeLevel: string;
  grade?: string;
  subject?: string;
  skillIds: string[];
  subskillIds: string[];
  primitiveTypes: string[];
  evalModel: string;
  evalTimestamp: string;
  latencyMs: number;
  usedSchemaFallback: boolean;
  /** Why the structured call was abandoned for the loose-JSON retry (kept so fallback rates are diagnosable). */
  schemaError?: string;
  digestChars: number;
  truncated: boolean;
  objectiveCount: number;
  objectivesFullyCovered: number;
  objectivesUncovered: number;
  failureCategories: string[];
  /** Where the eval was triggered: build-stream · api · api-eval · script · live-test · test. */
  source: string;
  error?: string;
}

export interface LessonCoverageEval {
  version: 1;
  lessonId: string;
  status: CoverageStatus;
  /** Mean per-objective credit: SUFFICIENT 1 · INDIRECT/INSUFFICIENT 0.5 · unassessed 0. */
  overallObjectiveCoverage: number;
  blockingFailure: boolean;
  objectives: ObjectiveCoverage[];
  detectedConstraints: DetectedConstraint[];
  summary: string;
  meta: LessonCoverageMeta;
}

// ── Digest: the compact, evidence-addressable lesson the evaluator reads ──

export interface DigestObjective {
  id: string;
  text: string;
  verb?: string;
  subskillId?: string;
  skillId?: string;
  grade?: string;
  /** instanceIds the manifest dedicated to this objective (final assessment spans all). */
  instanceIds: string[];
}

export interface DigestItem {
  /** `<instanceId>#<path>[<index>]`, e.g. `obj1-di-sounds#challenges[2]`. */
  id: string;
  text: string;
}

export interface DigestBlock {
  instanceId: string;
  componentId: string;
  title: string;
  intent: string;
  objectiveIds: string[];
  targetEvalMode?: string;
  /** Catalog facts (affordances): the ladder rung and how the child answers. */
  role: string[];
  answers: string[];
  modeDescription?: string;
  audience: 'student' | 'caregiver';
  /** Flattened non-item leaves of the block data, bounded. */
  fields: string;
  items: DigestItem[];
  /** Generator-reported residuals (`unaskableLetters`, …) — constraints the generator itself flagged. */
  generatorReported: Array<{ key: string; value: string }>;
  itemsTruncated: number;
}

export interface LessonDigest {
  topic: string;
  gradeLevel: string;
  subject?: string;
  objectives: DigestObjective[];
  blocks: DigestBlock[];
  /** Planned by the manifest, absent from the assembled lesson (generation failed) — the student never saw these. */
  missingBlocks: Array<{ instanceId: string; componentId: string; title: string; objectiveIds: string[] }>;
  /** Every id the evaluator may cite: block instanceIds and item ids. */
  evidenceIds: string[];
  /** An item's own content id (dils-1-m, mc_1) → its canonical citation pointer.
   *  Lets a judge that cites items by their content id still validate; ambiguous
   *  (reused) content ids are omitted. */
  evidenceAliases: Record<string, string>;
  chars: number;
  truncated: boolean;
}
