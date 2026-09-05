/**
 * Primitive affordances — resolver, renderer and prompt legend.
 *
 * WHAT: a primitive (and, where modes differ, an eval mode) declares what a
 * block DEMANDS of the child and OFFERS the curator: who reads it, where it sits
 * on the concrete → pictorial → symbolic ladder, how much reading the child's
 * own path needs, what the child produces to answer, which rung of the lesson
 * ladder it serves, typical minutes, and how often it may appear in a lesson.
 *
 * WHY AFFORDANCES, NOT GRADE RANGES (user ruling 2026-08-07, reaffirmed
 * 2026-09-04 over the first Lesson Bench labels): a grade floor removes the
 * primitive along with the demand, and shrinks supply at exactly the band with
 * the least content. The reasons a block fails a five-year-old are demands —
 * reading load, answer modality, audience, symbol-before-concrete — and every
 * one of them is a fact about the primitive that stays true at every grade.
 * The three findings that motivated this were all mis-filed as grade problems:
 * take-home-activity in a K lesson is an AUDIENCE mismatch (an adult reads it),
 * knowledge-check at K is an answer-COMMIT bug (spoken, then forced to tap),
 * hundreds-chart opening a K count-objects block is a REPRESENTATION-order
 * miss (symbolic before concrete). None of them wanted the primitive gone.
 *
 * WHO ACTS ON A TAG: the curator, as a fact in its prompt. Nothing here filters
 * the catalog, and the only code that should ever act on an affordance is an
 * assembly transform that ADDS capability (read-aloud on, spoken commit) —
 * never one that deletes a block. The Lesson Bench reads the same tags back for
 * its code-judged checks (G6 modality, Q3 concrete-before-symbol, Q8 text load,
 * Q6 variety, the `too-long` reason), which is what makes a selection change
 * measurable: `scripts/affordance-ab.mjs` counts distinct primitives per grade
 * with and without the tags rendered, so an ablation shows up as a number
 * before it ships.
 *
 * ABSENT = UNKNOWN. An untagged primitive renders nothing and behaves as before,
 * so the field is filled one primitive at a time (`/add-affordances`) with zero
 * ablation by construction. Values are DERIVED, not authored: `reader` from a
 * reader-fit verdict, `answers: spoken` from a judged pack (`audioInput`),
 * `audience` from who actually reads the block. A gap is left as a gap.
 */

import type {
  AffordanceAnswer,
  AffordanceRepresentation,
  AffordanceRole,
  ComponentDefinition,
  EvalModeAffordances,
  PrimitiveAffordances,
} from '../../../types';

/**
 * Whether the curator prompt renders the tags when a caller does not say.
 *
 * ON since 2026-09-04 at 29/201 tagged (qa/lesson-bench/BACKLOG.md item 13).
 * It was OFF while a tag was a salience lever: the pilot A/B at 11/198
 * (ab/affordances-2026-09-04-12-15.md) held supply per grade in COUNT but
 * every primitive lost under ON was UNTAGGED — the ablation this framework
 * exists to avoid. Two `/add-affordances` batches then covered every untagged
 * primitive the curator reached for, and the `--runs 3` A/Bs
 * (ab/affordances-2026-09-04-14-41.md, …-14-49.md) showed untagged picks ≈ 0
 * under BOTH arms and every OFF→ON "loss" (1-2 primitives) smaller than the
 * OFF-vs-OFF floor (2-3 per grade at n=3): pooled over both runs elementary
 * loses nothing and K loses only strategy-picker (2/6 OFF runs, since tagged).
 * Read any future A/B against that floor (`scripts/affordance-ab.mjs
 * --against <prev.json>`) — a per-run "lost under ON" column is noise at n=3.
 * Traces can still force either arm: `topic-trace?affordances=off|on`.
 * Revert = this one constant.
 */
export const AFFORDANCE_TAGS_DEFAULT = true;

export const AFFORDANCE_AUDIENCES = ['student', 'caregiver'] as const;
export const AFFORDANCE_REPRESENTATIONS = ['concrete', 'pictorial', 'symbolic'] as const;
export const AFFORDANCE_READERS = ['none', 'emerging', 'developing'] as const;
export const AFFORDANCE_ANSWERS = ['spoken', 'tap', 'build', 'manipulate', 'type'] as const;
export const AFFORDANCE_ROLES = ['introduce', 'visualize', 'apply', 'assess'] as const;

/** Declared affordances merged with what the rest of the definition already proves. */
export interface ResolvedAffordances {
  audience: 'student' | 'caregiver';
  representation: AffordanceRepresentation[];
  reader: PrimitiveAffordances['reader'] | null;
  answers: AffordanceAnswer[];
  role: AffordanceRole[];
  minutes: number | null;
  maxPerLesson: number | null;
  /** True when the primitive declares an `affordances` block at all. */
  declared: boolean;
  /** Axes that came from an eval-mode override rather than the primitive. */
  fromMode: Array<keyof EvalModeAffordances>;
}

function asList<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Resolve a primitive's affordances, optionally for ONE eval mode.
 *
 * Derivation rules (each one is something the definition already proves):
 *  - `audioInput` declared → `answers` includes `spoken` (a judged pack).
 *  - a mode's `affordances` override `representation` / `reader` / `answers`
 *    for that mode only; every other axis stays the primitive's.
 * Always returns a value — for an untagged primitive `declared` is false and
 * only derived axes are filled, so the Bench can still score what it knows.
 */
export function resolveAffordances(def: ComponentDefinition, evalMode?: string): ResolvedAffordances {
  const base = def.affordances ?? {};
  const modeDef = evalMode ? def.evalModes?.find((m) => m.evalMode === evalMode) : undefined;
  const mode: EvalModeAffordances = modeDef?.affordances ?? {};
  const fromMode = (Object.keys(mode) as Array<keyof EvalModeAffordances>).filter((k) => mode[k] !== undefined);

  const answers = new Set<AffordanceAnswer>(mode.answers ?? base.answers ?? []);
  if (def.audioInput) answers.add('spoken');

  return {
    audience: base.audience ?? 'student',
    representation: asList(mode.representation ?? base.representation),
    reader: mode.reader ?? base.reader ?? null,
    answers: Array.from(answers),
    role: asList(base.role),
    minutes: base.minutes ?? null,
    maxPerLesson: base.maxPerLesson ?? null,
    declared: def.affordances !== undefined,
    fromMode,
  };
}

/**
 * The tag appended to a catalog line, e.g.
 *   {for: caregiver · shows: concrete · answers: manipulate · role: apply · ~10 min · max 1/lesson}
 * Empty string for an untagged primitive — the line reads exactly as before,
 * which is what keeps the A/B clean and the rollout ablation-free.
 */
export function renderAffordanceTag(def: ComponentDefinition): string {
  if (!def.affordances) return '';
  const a = resolveAffordances(def);
  const parts: string[] = [];
  if (a.audience !== 'student') parts.push(`for: ${a.audience}`);
  if (a.representation.length) parts.push(`shows: ${a.representation.join('+')}`);
  if (a.reader) parts.push(`reads: ${a.reader}`);
  if (a.answers.length) parts.push(`answers: ${a.answers.join('+')}`);
  if (a.role.length) parts.push(`role: ${a.role.join('+')}`);
  if (a.minutes !== null) parts.push(`~${a.minutes} min`);
  if (a.maxPerLesson !== null) parts.push(`max ${a.maxPerLesson}/lesson`);
  return parts.length ? `{${parts.join(' · ')}}` : '';
}

/**
 * Prompt legend — facts and pre-reader guidance, never a ban. Inserted under
 * AVAILABLE COMPONENT TOOLS only when at least one catalog line carries a tag.
 */
export const AFFORDANCE_LEGEND = [
  'AFFORDANCE TAGS — the {…} closing some catalog lines states what that block demands of the child. Read them as facts, not as bans:',
  '- reads: the reading the child must do ALONE after the tutor has read aloud. Kindergarten and younger are pre-readers — prefer "reads: none" there; "emerging" or "developing" means the child has to read to proceed.',
  '- shows: concrete (objects the child acts on) · pictorial (pictures) · symbolic (numerals, words, grids). The ladder runs concrete → pictorial → symbolic: at kindergarten open each objective on a concrete or pictorial block and let symbolic blocks follow it.',
  '- answers: what the child produces — spoken · tap · build · manipulate · type. "spoken" runs with the Live tutor and a microphone.',
  '- for: caregiver marks a block an ADULT reads (a home activity). It does not teach the child on screen: include at most one, place it last in its objective, and do not count it toward that objective\'s teaching blocks.',
  '- role: the rung it serves (introduce · visualize · apply · assess). ~N min: typical time on the block. max N/lesson: how many times it may appear.',
  'Untagged lines are simply not described yet — treat them exactly as before.',
].join('\n');

export function hasAffordanceTags(catalog: ComponentDefinition[]): boolean {
  return catalog.some((c) => c.affordances !== undefined);
}

/** Rollout progress for `/add-affordances`: which primitives carry a tag. */
export function affordanceCoverage(catalog: ComponentDefinition[]): { tagged: string[]; untagged: string[] } {
  const tagged: string[] = [];
  const untagged: string[] = [];
  for (const c of catalog) (c.affordances ? tagged : untagged).push(c.id);
  return { tagged, untagged };
}
