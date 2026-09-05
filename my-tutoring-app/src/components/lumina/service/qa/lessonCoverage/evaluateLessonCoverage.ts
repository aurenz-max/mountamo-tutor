/**
 * evaluateLessonCoverage — Gemini judges whether the ASSEMBLED lesson teaches
 * and assesses each declared objective well enough to infer mastery.
 *
 * Contract: never throws. A model/transport failure returns a `status: 'error'`
 * eval (every objective NOT_EVALUATED) so the failure itself is persisted and
 * countable. The model's judgment is post-validated in code:
 *   - evidence ids must exist in the digest; unknown ids are discarded and the
 *     objective's count is the VALIDATED count, never the model's number;
 *   - an "assessed" claim with no surviving evidence is downgraded — an
 *     uncited credit is not a credit (the Lesson Bench rule for deductions,
 *     applied to credits);
 *   - severity is floored by category: an unassessed declared objective is
 *     CRITICAL whatever the model said;
 *   - SUFFICIENT needs at least MIN_SUFFICIENT_ASSESSMENT_ITEMS distinct items.
 *
 * Model: gemini-flash-latest — judge-quality rulings never run on flash-lite
 * (distillMisconception, gemini-choice-judge, Lesson Bench item 7).
 */
import { Type, type Schema } from '@google/genai';
import type { ExhibitData } from '../../../types';
import { ai } from '../../geminiClient';
import { mintLessonPackageId } from '../lessonBench/lessonPackage';
import { buildLessonDigest, renderDigest } from './digest';
import {
  CONSTRAINT_TYPES,
  COVERAGE_CATEGORIES,
  COVERAGE_SEVERITIES,
  MIN_SUFFICIENT_ASSESSMENT_ITEMS,
  type ConstraintType,
  type CoverageCategory,
  type CoverageSeverity,
  type DetectedConstraint,
  type LessonCoverageEval,
  type LessonCoverageMeta,
  type LessonDigest,
  type ModelCoverageCategory,
  type ObjectiveCoverage,
} from './types';

export const COVERAGE_EVAL_MODEL = 'gemini-flash-latest';
export const COVERAGE_EVAL_TIMEOUT_MS = 45_000;

export interface EvaluateOptions {
  /** Stable id for the lesson; minted from topic+grade when absent. */
  lessonId?: string;
  source?: string;
  timeoutMs?: number;
}

// ── Schema ──────────────────────────────────────────────────────────────────
// No `maxItems`: gemini-flash-latest answers INVALID_ARGUMENT to any schema
// carrying it (probed 2026-09-05 — the identical schema without it is
// accepted). Array bounds live in the prompt and in normalizeVerdict instead.
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    objectives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          objectiveId: { type: Type.STRING },
          category: { type: Type.STRING, enum: [...COVERAGE_CATEGORIES] },
          taught: { type: Type.BOOLEAN },
          assessed: { type: Type.BOOLEAN },
          assessmentEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructionEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          masteryInferenceSupported: { type: Type.BOOLEAN },
          severity: { type: Type.STRING, enum: [...COVERAGE_SEVERITIES] },
          notes: { type: Type.STRING },
        },
        required: ['objectiveId', 'category', 'taught', 'assessed', 'assessmentEvidence', 'instructionEvidence', 'masteryInferenceSupported', 'severity', 'notes'],
      },
    },
    detectedConstraints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [...CONSTRAINT_TYPES] },
          description: { type: Type.STRING },
          instanceId: { type: Type.STRING },
        },
        required: ['type', 'description'],
      },
    },
    summary: { type: Type.STRING },
  },
  required: ['objectives', 'detectedConstraints', 'summary'],
};

// ── Prompt ──────────────────────────────────────────────────────────────────
export function buildCoveragePrompt(digest: LessonDigest): string {
  return `You are evaluating whether a lesson provides EVIDENCE that a student mastered its declared learning objectives. You are not grading lesson quality, style, or creativity.

Two things are strictly different:
- INSTRUCTION EXPOSURE: the concept appears on screen, is explained, modeled, or shown. Seeing it proves nothing about the student.
- ASSESSMENT EVIDENCE: an item the student must ANSWER — produce, select, build, or sort — where the correct answer is exactly the objective's target. Reason from the student's REQUIRED ACTION, using each block's "answers" fact and each item's target/answer fields.

For EVERY declared objective:
1. Identify where it is explicitly taught (instructionEvidence: block or item ids).
2. Identify EVERY item that requires the student to demonstrate it (assessmentEvidence: item ids, one per independent opportunity; use a block id only when the block has no items).
3. Decide whether those items DIRECTLY assess the objective. Tapping a letter shape does not assess producing its sound; recognizing a word does not assess decoding it; an item whose answer is a neighbouring skill is off-target, not evidence.
4. Count independent opportunities. Fewer than ${MIN_SUFFICIENT_ASSESSMENT_ITEMS} distinct items cannot support a mastery inference. The same item re-asked is one opportunity.
5. When an objective names a SET (letters s, a, t, i, p, n; numbers 1-10; three shapes), it is ASSESSED_SUFFICIENTLY only if every named element gets an opportunity. Otherwise ASSESSED_INSUFFICIENTLY, and name the missing elements in notes.
6. Cite each item by the id in brackets at the START of its line (e.g. obj2-di#challenges[0]); the item's own content id shown as "(id=…)" is also accepted. Cite ids EXACTLY as written — an id found nowhere in the digest is discarded. At most 24 assessment ids and 12 instruction ids per objective; at most 8 constraints.

Categories:
- NOT_TAUGHT — the objective's content does not appear in any student-facing block.
- TAUGHT_NOT_ASSESSED — it appears in instruction but no item requires the student to demonstrate it.
- ASSESSED_INSUFFICIENTLY — assessed directly but too few items, or only part of a named set.
- ASSESSED_INDIRECTLY — the items demand a related but different skill (recognition for a production objective, etc.).
- ASSESSED_SUFFICIENTLY — enough direct, independent items to infer mastery.

Severity: CRITICAL for NOT_TAUGHT and TAUGHT_NOT_ASSESSED; WARNING for INSUFFICIENTLY and INDIRECTLY; NONE or INFO for SUFFICIENTLY.

Facts to use:
- "role" is the block's rung (introduce/visualize = exposure; apply/assess = candidate evidence). "answers: (none — display only)" blocks are exposure only.
- "what the mode tests" describes the student's required action for that block's eval mode.
- A block marked AUDIENCE: CAREGIVER is a parent card. Ignore it for both teaching and assessment.
- A GENERATOR-REPORTED RESIDUAL is the generator admitting it could not produce something (e.g. unaskableLetters=["t","p"]). If it explains a gap, add a detectedConstraints entry of type content_guard citing that block's instanceId.
- MISSING BLOCKS were planned but never generated: the student did not see them. Add a generation_failure constraint for each.
- detectedConstraints types: content_guard (a rule/guard kept target content out of assessment), generation_failure, primitive_limitation (the chosen primitive cannot assess this objective at all), off_target_assessment (items test a different skill), insufficient_items, other.

Keep notes under 300 characters and specific: which element is missing, which items were off-target. Put a one-paragraph lesson-level summary in "summary".

${renderDigest(digest)}

Return ONLY the JSON object matching the schema.`;
}

// ── Model call ──────────────────────────────────────────────────────────────
interface RawObjective {
  objectiveId?: string;
  category?: string;
  taught?: boolean;
  assessed?: boolean;
  assessmentEvidence?: unknown;
  instructionEvidence?: unknown;
  masteryInferenceSupported?: boolean;
  severity?: string;
  notes?: string;
}
interface RawVerdict {
  objectives?: RawObjective[];
  detectedConstraints?: Array<{ type?: string; description?: string; instanceId?: string | null }>;
  summary?: string;
}

function parseLooseJson(text: string): RawVerdict {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
  return JSON.parse(candidate.slice(start, end + 1)) as RawVerdict;
}

async function callWithTimeout(prompt: string, useSchema: boolean, timeoutMs: number): Promise<string> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = ai.models.generateContent({
      model: COVERAGE_EVAL_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.2,
        // Shared with the model's thinking on flash-latest: at 4096 a long think
        // truncated the JSON mid-string ("Unterminated string at position 1268").
        maxOutputTokens: 16384,
        abortSignal: abort.signal,
        ...(useSchema ? { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA } : {}),
      },
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        abort.abort();
        reject(new Error(`coverage eval timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const result = await Promise.race([request, timeout]);
    if (!result.text) throw new Error('Empty response from coverage evaluator');
    return result.text;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Normalisation ───────────────────────────────────────────────────────────
const SEVERITY_RANK: Record<CoverageSeverity, number> = { NONE: 0, INFO: 1, WARNING: 2, CRITICAL: 3 };
const sevMax = (a: CoverageSeverity, b: CoverageSeverity) => (SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b);
const sevMin = (a: CoverageSeverity, b: CoverageSeverity) => (SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b);
const CREDIT: Record<CoverageCategory, number | null> = {
  ASSESSED_SUFFICIENTLY: 1,
  ASSESSED_INDIRECTLY: 0.5,
  ASSESSED_INSUFFICIENTLY: 0.5,
  TAUGHT_NOT_ASSESSED: 0,
  NOT_TAUGHT: 0,
  NOT_EVALUATED: null,
};

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').map((s) => s.trim()) : []);
const isCategory = (v: unknown): v is ModelCoverageCategory => typeof v === 'string' && (COVERAGE_CATEGORIES as readonly string[]).includes(v);
const isSeverity = (v: unknown): v is CoverageSeverity => typeof v === 'string' && (COVERAGE_SEVERITIES as readonly string[]).includes(v);
const isConstraintType = (v: unknown): v is ConstraintType => typeof v === 'string' && (CONSTRAINT_TYPES as readonly string[]).includes(v);

function joinNote(base: string | null, extra: string): string {
  return base ? `${base} ${extra}` : extra;
}

/** Apply the code-side rules to one objective's raw judgment. Exported for tests. */
export function normalizeObjective(
  objective: LessonDigest['objectives'][number],
  raw: RawObjective | undefined,
  evidenceIds: ReadonlySet<string>,
  /** An item's own content id → its citation pointer (digest.evidenceAliases). */
  aliases: Record<string, string> = {},
): ObjectiveCoverage {
  const base = {
    objectiveId: objective.id,
    objective: objective.text,
    verb: objective.verb,
    subskillId: objective.subskillId,
    skillId: objective.skillId,
    grade: objective.grade,
  };
  if (!raw || !isCategory(raw.category)) {
    return {
      ...base,
      category: 'NOT_EVALUATED',
      taught: false,
      assessed: false,
      assessmentCount: 0,
      assessmentEvidence: [],
      instructionEvidence: [],
      masteryInferenceSupported: false,
      severity: 'INFO',
      notes: raw ? `Evaluator returned an unknown category "${String(raw.category)}".` : 'Evaluator returned no judgment for this objective.',
    };
  }

  // Resolve a cited id to its canonical form: a pointer/block id stands as-is,
  // an item's own content id resolves through the alias map, anything else is
  // discarded. Dedupe on the resolved value so citing the same item two ways
  // counts once.
  const keep = (ids: string[]) => {
    const valid: string[] = [];
    const seen = new Set<string>();
    const discarded: string[] = [];
    for (const id of ids) {
      const resolved = evidenceIds.has(id) ? id : aliases[id];
      if (resolved) { if (!seen.has(resolved)) { seen.add(resolved); valid.push(resolved); } }
      else discarded.push(id);
    }
    return { valid, discarded };
  };
  const assess = keep(asStrings(raw.assessmentEvidence).slice(0, 24));
  const instruct = keep(asStrings(raw.instructionEvidence).slice(0, 12));
  const discardedEvidence = [...assess.discarded, ...instruct.discarded];

  let category: CoverageCategory = raw.category;
  let notes: string | null = typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim().slice(0, 600) : null;
  const claimsAssessed = category.startsWith('ASSESSED_');

  if (claimsAssessed && assess.valid.length === 0) {
    category = 'ASSESSED_INSUFFICIENTLY';
    notes = joinNote(notes, 'Evaluator claimed assessment but cited no item that exists in the lesson; credit withheld.');
  } else if (category === 'ASSESSED_SUFFICIENTLY' && assess.valid.length < MIN_SUFFICIENT_ASSESSMENT_ITEMS) {
    category = 'ASSESSED_INSUFFICIENTLY';
    notes = joinNote(notes, `Only ${assess.valid.length} independent assessment item(s) cited; ${MIN_SUFFICIENT_ASSESSMENT_ITEMS} needed for a mastery inference.`);
  } else if (category === 'ASSESSED_SUFFICIENTLY' && raw.masteryInferenceSupported === false) {
    category = 'ASSESSED_INSUFFICIENTLY';
    notes = joinNote(notes, 'Evaluator marked mastery inference unsupported.');
  }

  const taught = category === 'NOT_TAUGHT' ? false : category === 'TAUGHT_NOT_ASSESSED' ? true : raw.taught !== false || instruct.valid.length > 0;
  const assessed = category.startsWith('ASSESSED_');

  let severity: CoverageSeverity = isSeverity(raw.severity) ? raw.severity : 'INFO';
  if (category === 'NOT_TAUGHT' || category === 'TAUGHT_NOT_ASSESSED') severity = 'CRITICAL';
  else if (category === 'ASSESSED_INSUFFICIENTLY' || category === 'ASSESSED_INDIRECTLY') severity = sevMax(severity, 'WARNING');
  else severity = sevMin(severity, 'INFO');

  return {
    ...base,
    category,
    taught,
    assessed,
    assessmentCount: assessed ? assess.valid.length : 0,
    assessmentEvidence: assessed ? assess.valid : [],
    instructionEvidence: instruct.valid,
    masteryInferenceSupported: category === 'ASSESSED_SUFFICIENTLY',
    severity,
    notes,
    ...(discardedEvidence.length ? { discardedEvidence } : {}),
  };
}

function normalizeConstraints(raw: RawVerdict['detectedConstraints'], blockIds: ReadonlySet<string>): DetectedConstraint[] {
  return (raw ?? [])
    .filter((c) => c && typeof c.description === 'string' && c.description.trim())
    .slice(0, 12)
    .map((c) => ({
      type: isConstraintType(c.type) ? c.type : 'other',
      description: c.description!.trim().slice(0, 600),
      instanceId: typeof c.instanceId === 'string' && blockIds.has(c.instanceId) ? c.instanceId : null,
    }));
}

/** Combine per-objective judgments into the lesson verdict. Exported for tests. */
export function assembleEval(
  digest: LessonDigest,
  objectives: ObjectiveCoverage[],
  detectedConstraints: DetectedConstraint[],
  summary: string,
  meta: Omit<LessonCoverageMeta, 'objectiveCount' | 'objectivesFullyCovered' | 'objectivesUncovered' | 'failureCategories' | 'skillIds' | 'subskillIds' | 'primitiveTypes' | 'digestChars' | 'truncated' | 'topic' | 'gradeLevel' | 'grade' | 'subject'>,
  lessonId: string,
): LessonCoverageEval {
  const credits = objectives.map((o) => CREDIT[o.category]).filter((c): c is number => c !== null);
  const overall = credits.length ? credits.reduce((a, b) => a + b, 0) / credits.length : 0;
  const blockingFailure = objectives.some((o) => o.severity === 'CRITICAL');
  const anyWarning = objectives.some((o) => o.severity === 'WARNING');
  const status = meta.error ? 'error' : blockingFailure ? 'fail' : anyWarning ? 'warn' : 'pass';
  const failureCategories = Array.from(new Set([
    ...objectives.filter((o) => o.category !== 'ASSESSED_SUFFICIENTLY' && o.category !== 'NOT_EVALUATED').map((o) => o.category),
    ...detectedConstraints.map((c) => `constraint:${c.type}`),
  ]));
  return {
    version: 1,
    lessonId,
    status,
    overallObjectiveCoverage: Math.round(overall * 1000) / 1000,
    blockingFailure,
    objectives,
    detectedConstraints,
    summary,
    meta: {
      ...meta,
      topic: digest.topic,
      gradeLevel: digest.gradeLevel,
      grade: digest.objectives.find((o) => o.grade)?.grade,
      subject: digest.subject,
      skillIds: Array.from(new Set(digest.objectives.map((o) => o.skillId).filter((s): s is string => !!s))),
      subskillIds: Array.from(new Set(digest.objectives.map((o) => o.subskillId).filter((s): s is string => !!s))),
      primitiveTypes: Array.from(new Set(digest.blocks.map((b) => b.componentId))),
      digestChars: digest.chars,
      truncated: digest.truncated,
      objectiveCount: objectives.length,
      objectivesFullyCovered: objectives.filter((o) => o.category === 'ASSESSED_SUFFICIENTLY').length,
      objectivesUncovered: objectives.filter((o) => o.category === 'NOT_TAUGHT' || o.category === 'TAUGHT_NOT_ASSESSED').length,
      failureCategories,
    },
  };
}

/** Turn a raw model verdict into the validated eval. Exported so tests can drive it without the model. */
export function normalizeVerdict(
  digest: LessonDigest,
  raw: RawVerdict,
  meta: Parameters<typeof assembleEval>[4],
  lessonId: string,
): LessonCoverageEval {
  const evidenceIds = new Set(digest.evidenceIds);
  const blockIds = new Set(digest.blocks.map((b) => b.instanceId));
  const byId = new Map<string, RawObjective>();
  for (const o of raw.objectives ?? []) {
    if (o && typeof o.objectiveId === 'string') byId.set(o.objectiveId.trim().toLowerCase(), o);
  }
  const objectives = digest.objectives.map((o) => normalizeObjective(o, byId.get(o.id.toLowerCase()), evidenceIds, digest.evidenceAliases));
  const constraints = normalizeConstraints(raw.detectedConstraints, blockIds);
  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 1200) : '';
  return assembleEval(digest, objectives, constraints, summary, meta, lessonId);
}

// ── Entry ───────────────────────────────────────────────────────────────────
export async function evaluateLessonCoverage(exhibit: ExhibitData, opts: EvaluateOptions = {}): Promise<LessonCoverageEval> {
  const started = Date.now();
  const digest = buildLessonDigest(exhibit);
  const lessonId = opts.lessonId ?? mintLessonPackageId(digest.topic, digest.gradeLevel);
  const timeoutMs = opts.timeoutMs ?? COVERAGE_EVAL_TIMEOUT_MS;
  const metaBase = {
    evalModel: COVERAGE_EVAL_MODEL,
    evalTimestamp: new Date(started).toISOString(),
    latencyMs: 0,
    usedSchemaFallback: false,
    source: opts.source ?? 'unknown',
  };

  if (digest.objectives.length === 0) {
    return assembleEval(digest, [], [], 'No declared objectives — nothing to evaluate.', { ...metaBase, latencyMs: Date.now() - started, error: 'no objectives' }, lessonId);
  }

  const prompt = buildCoveragePrompt(digest);
  let raw: RawVerdict | null = null;
  let usedSchemaFallback = false;
  let schemaError: string | undefined;
  let error: string | undefined;
  try {
    raw = JSON.parse(await callWithTimeout(prompt, true, timeoutMs)) as RawVerdict;
  } catch (schemaErr) {
    schemaError = (schemaErr instanceof Error ? schemaErr.message : String(schemaErr)).slice(0, 300);
    console.warn('[lesson-coverage] schema call failed, retrying as loose JSON:', schemaError);
    try {
      raw = parseLooseJson(await callWithTimeout(
        `${prompt}\n\nRespond with ONLY a JSON object shaped exactly like {"objectives":[{"objectiveId":"","category":"","taught":true,"assessed":true,"assessmentEvidence":[],"instructionEvidence":[],"masteryInferenceSupported":true,"severity":"","notes":""}],"detectedConstraints":[{"type":"","description":"","instanceId":""}],"summary":""}`,
        false,
        timeoutMs,
      ));
      usedSchemaFallback = true;
    } catch (fallbackErr) {
      error = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.warn('[lesson-coverage] both attempts failed:', error);
    }
  }

  const meta = { ...metaBase, latencyMs: Date.now() - started, usedSchemaFallback, ...(schemaError ? { schemaError } : {}), ...(error ? { error } : {}) };
  if (!raw) {
    const objectives = digest.objectives.map((o) => normalizeObjective(o, undefined, new Set()));
    return assembleEval(digest, objectives, [], `Evaluator call failed: ${error}`, meta, lessonId);
  }
  return normalizeVerdict(digest, raw, meta, lessonId);
}
