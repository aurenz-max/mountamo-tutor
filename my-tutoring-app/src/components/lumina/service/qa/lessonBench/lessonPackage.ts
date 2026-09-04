/**
 * Lesson Package — a scored, replayable Lumina lesson as one JSON file.
 *
 * WHY. Every QA harness before this one scored a primitive against its own
 * contract and collapsed to PASS/FAIL. The Lesson Bench scores a whole
 * ASSEMBLED lesson against a curriculum item, and a human rates the IDENTICAL
 * artifact the machine rated — so judge agreement is measurable per check.
 * That only works if the lesson the human plays is byte-for-byte the lesson
 * the bench scored, which is what this file carries: manifest, curator brief
 * and every generated block. Nothing here regenerates.
 *
 * PRODUCER  /api/lumina/topic-trace?package=true (images kept).
 * CONSUMER  the Lesson Bench dev panel → `useExhibitSession.generate({ replay })`
 *           (the one launch verb; see student-data-loop SKILL.md §7).
 * ASSEMBLY  service/exhibitAssembly.ts — shared with the production build.
 *
 * THE RUBRIC ROSTER lives here too (`LESSON_BENCH_CHECKS`) because the human
 * rail and the machine judge must speak ONE vocabulary: a human "disagree" on
 * Q1 is comparable to the judge's Q1 only if both mean the same sentence.
 */
import type { ExhibitData, ExhibitManifest, IntroBriefingData } from '../../../types';
import { assembleExhibitFromContent, type GeneratedContent } from '../../exhibitAssembly';

export const LESSON_PACKAGE_VERSION = 1 as const;

// ── Rubric roster ──────────────────────────────────────────────────────────
export type LessonBenchCheckKind = 'gate' | 'check';
export type LessonBenchJudge = 'code' | 'llm' | 'code+llm';

export interface LessonBenchCheckDef {
  id: string;
  kind: LessonBenchCheckKind;
  label: string;
  /** The observable condition, written as the sentence both judges apply. */
  passesWhen: string;
  judge: LessonBenchJudge;
}

/** Gates disqualify (any fail → BROKEN); checks are 0/1 and sum to the quality score. */
export const LESSON_BENCH_CHECKS: readonly LessonBenchCheckDef[] = [
  { id: 'G1', kind: 'gate', label: 'Band fit', judge: 'code',
    passesWhen: "Every primitive's catalog band includes the grade, and no pre-reader block needs reading to complete." },
  { id: 'G2', kind: 'gate', label: 'Subskill fidelity', judge: 'code+llm',
    passesWhen: 'The content is THIS subskill, not a neighbour (counting to 10 does not emit numerals to 100; short-a does not emit silent-e).' },
  { id: 'G3', kind: 'gate', label: 'No answer leak', judge: 'code+llm',
    passesWhen: 'No title, intent, label or default state shows an answer, a score, or mastery.' },
  { id: 'G4', kind: 'gate', label: 'Eval mode exists', judge: 'code',
    passesWhen: 'Every pinned eval mode is in the catalog AND emitted by the generator.' },
  { id: 'G5', kind: 'gate', label: 'Density', judge: 'code',
    passesWhen: 'Every scored mode has 3+ DISTINCT problems; N challenges are N problems, not one asked N ways.' },
  { id: 'G6', kind: 'gate', label: 'Modality', judge: 'code',
    passesWhen: 'K-2 literacy production is spoken, not tapped; no visible timer on fluency.' },
  { id: 'Q1', kind: 'check', label: 'Concrete opener', judge: 'llm',
    passesWhen: 'The first block is a thing, picture or manipulation — not a symbol grid or a definition.' },
  { id: 'Q2', kind: 'check', label: 'Prerequisite order', judge: 'llm',
    passesWhen: 'No objective depends on a later one.' },
  { id: 'Q3', kind: 'check', label: 'Concrete before symbol', judge: 'llm',
    passesWhen: 'Notation never precedes the thing it names.' },
  { id: 'Q4', kind: 'check', label: 'Coverage', judge: 'code+llm',
    passesWhen: "The subskill's Examples and Constraints show up in the generated data." },
  { id: 'Q5', kind: 'check', label: 'Ramp', judge: 'code',
    passesWhen: 'Betas across blocks are non-decreasing and span at least two values.' },
  { id: 'Q6', kind: 'check', label: 'Variety', judge: 'code',
    passesWhen: '2+ distinct primitives; no back-to-back repeat of the same primitive and mode.' },
  { id: 'Q7', kind: 'check', label: 'Evidence', judge: 'code',
    passesWhen: 'At least one block has a scored eval mode, so the session feeds IRT.' },
  { id: 'Q8', kind: 'check', label: 'Text load', judge: 'code',
    passesWhen: 'At the pre-reader band every on-screen instruction is read aloud or absent.' },
];

export const HOLISTIC_ANCHORS: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  1: 'Teaches the wrong thing, or the child cannot do it.',
  2: 'Right thing; the child is stuck most of the way.',
  3: 'Runnable, with one real gap (weak start, a wrong-difficulty block).',
  4: 'Runs as-is, one nit.',
  5: 'Better than the teacher would have built.',
};

// ── Scores (machine) and labels (human) ────────────────────────────────────
export type LessonBenchBucket = 'BROKEN' | 'RUNNABLE' | 'CLEAN';

export interface LessonBenchScores {
  gates: Record<string, 0 | 1>;
  checks: Record<string, 0 | 1>;
  /** One holistic 1-5 per judge run (three runs → three entries). */
  holistic: number[];
  bucket: LessonBenchBucket;
  judgedAt?: string;
  judge?: string;
  /** Every deduction must cite a block and a check — uncited ones are discarded. */
  citations?: Array<{ instanceId: string; checkId: string; note: string }>;
}

// ── The human side: reactions in plain language, mapped to checks underneath ──
//
// A teacher looking at a lesson does not think "G3 answer leak". They think
// "this is great, but the take-home block doesn't belong". So the rail asks
// for exactly that — one score for the lesson, keep/fix/cut per block — and
// offers plain-language REASONS. Each reason carries the check id it maps to
// (where one exists), so a human "symbols before the real thing" on block 4
// and the judge's Q3 citation on block 4 are the same signal. The human never
// sees a check id; the join still holds.

export interface HumanReasonDef {
  id: string;
  label: string;
  /** The rubric check this reason is evidence for; absent = human-only tag. */
  checkId?: string;
}

/** Why a block got "fix" or "cut". */
export const BLOCK_REASONS: readonly HumanReasonDef[] = [
  { id: 'does-not-belong', label: "Doesn't belong in this lesson" },
  { id: 'not-this-skill', label: 'Not about this skill', checkId: 'G2' },
  { id: 'wrong-grade', label: 'Wrong grade for this kid', checkId: 'G1' },
  { id: 'too-much-reading', label: 'Too much reading for a pre-reader', checkId: 'Q8' },
  { id: 'symbols-first', label: 'Symbols before the real thing', checkId: 'Q3' },
  { id: 'needs-earlier', label: 'Needs something taught first', checkId: 'Q2' },
  { id: 'answer-shown', label: 'Shows the answer', checkId: 'G3' },
  { id: 'too-few-problems', label: 'Too few problems, or the same one repeated', checkId: 'G5' },
  { id: 'should-be-spoken', label: 'Should be spoken, not tapped', checkId: 'G6' },
  { id: 'repeats-block', label: 'Repeats an earlier block', checkId: 'Q6' },
  { id: 'broken', label: 'Broken or confusing to use' },
  { id: 'weak', label: 'Just not good' },
];

/** Why the lesson as a whole scored 3 or under. */
export const LESSON_REASONS: readonly HumanReasonDef[] = [
  { id: 'wrong-opener', label: 'Opens on the wrong thing', checkId: 'Q1' },
  { id: 'wrong-order', label: 'Blocks are in the wrong order', checkId: 'Q2' },
  { id: 'not-this-skill', label: 'Not really about this skill', checkId: 'G2' },
  { id: 'wrong-grade', label: 'Too much for this grade', checkId: 'G1' },
  { id: 'missing', label: 'Missing something the skill needs', checkId: 'Q4' },
  { id: 'flat', label: 'Never gets harder', checkId: 'Q5' },
  { id: 'no-evidence', label: 'Nothing here measures the kid', checkId: 'Q7' },
  { id: 'too-long', label: 'Too long' },
];

export type BlockReaction = 'keep' | 'fix' | 'cut';

export interface LessonBenchBlockLabel {
  reaction: BlockReaction;
  /** BLOCK_REASONS ids. */
  reasons: string[];
  note: string;
}

export interface LessonBenchHumanLabel {
  labeledAt: string;
  /** 1..5 on the same anchors the judge uses; null until set. */
  holistic: number | null;
  /** LESSON_REASONS ids. */
  lessonReasons: string[];
  /** instanceId → reaction. Blocks the reviewer never touched are absent. */
  blocks: Record<string, LessonBenchBlockLabel>;
  note: string;
  /** Client run ids of live-tutor sittings on this package — joins the
   *  session ledger (backend/logs/lumina-sessions) and the DI run log. */
  runIds: string[];
}

export function emptyHumanLabel(): LessonBenchHumanLabel {
  return { labeledAt: new Date().toISOString(), holistic: null, lessonReasons: [], blocks: {}, note: '', runIds: [] };
}

export function isLabelTouched(label: LessonBenchHumanLabel | null | undefined): boolean {
  if (!label) return false;
  return label.holistic !== null || label.lessonReasons.length > 0 || Object.keys(label.blocks).length > 0 || label.note.trim().length > 0;
}

/**
 * The human label expressed in the machine's vocabulary: one signal per
 * (block, check) or (lesson, check) the reviewer's reasons imply. This is the
 * row the calibration compares against the judge's citations.
 */
export function humanCheckSignals(label: LessonBenchHumanLabel): Array<{ instanceId?: string; checkId: string; reason: string }> {
  const out: Array<{ instanceId?: string; checkId: string; reason: string }> = [];
  for (const r of label.lessonReasons) {
    const def = LESSON_REASONS.find((d) => d.id === r);
    if (def?.checkId) out.push({ checkId: def.checkId, reason: def.id });
  }
  for (const [instanceId, b] of Object.entries(label.blocks)) {
    if (b.reaction === 'keep') continue;
    for (const r of b.reasons) {
      const def = BLOCK_REASONS.find((d) => d.id === r);
      if (def?.checkId) out.push({ instanceId, checkId: def.checkId, reason: def.id });
    }
  }
  return out;
}

// ── The package ────────────────────────────────────────────────────────────
export interface LessonPackageComponent {
  instanceId: string;
  componentId: string;
  data: unknown;
}

export interface LessonPackageSubskill {
  id?: string;
  grade?: string;
  subject?: string;
  description?: string;
}

export interface LessonPackageProvenance {
  generatedAt: string;
  source: string;
  topic?: string;
  gradeLevel?: string;
  gitSha?: string | null;
  promptHash?: string | null;
}

export interface LessonPackage {
  benchVersion: typeof LESSON_PACKAGE_VERSION;
  id: string;
  subskill?: LessonPackageSubskill | null;
  provenance: LessonPackageProvenance;
  manifest: ExhibitManifest;
  curatorBrief: IntroBriefingData;
  components: LessonPackageComponent[];
  scores?: LessonBenchScores | null;
  human?: LessonBenchHumanLabel | null;
}

export class LessonPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonPackageError';
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validate an untrusted JSON value into a LessonPackage. Throws LessonPackageError with a human-readable reason. */
export function parseLessonPackage(raw: unknown): LessonPackage {
  if (!isRecord(raw)) throw new LessonPackageError('Not a JSON object.');
  if (raw.benchVersion !== LESSON_PACKAGE_VERSION) {
    throw new LessonPackageError(`benchVersion must be ${LESSON_PACKAGE_VERSION} (got ${String(raw.benchVersion)}).`);
  }
  if (typeof raw.id !== 'string' || !raw.id.trim()) throw new LessonPackageError('Missing "id".');
  if (!isRecord(raw.manifest)) throw new LessonPackageError('Missing "manifest".');
  const manifest = raw.manifest as unknown as ExhibitManifest;
  if (typeof manifest.topic !== 'string') throw new LessonPackageError('manifest.topic must be a string.');
  if (!Array.isArray(manifest.layout) || manifest.layout.length === 0) {
    throw new LessonPackageError('manifest.layout must be a non-empty array — the package carries the FLATTENED layout.');
  }
  if (!isRecord(raw.curatorBrief)) throw new LessonPackageError('Missing "curatorBrief" (the full IntroBriefingData).');
  const brief = raw.curatorBrief as unknown as IntroBriefingData;
  if (!isRecord(brief.hook) || typeof (brief.hook as { content?: unknown }).content !== 'string') {
    throw new LessonPackageError('curatorBrief.hook.content must be a string.');
  }
  if (!Array.isArray(brief.objectives)) throw new LessonPackageError('curatorBrief.objectives must be an array.');
  if (!Array.isArray(raw.components)) throw new LessonPackageError('Missing "components" array.');
  const components: LessonPackageComponent[] = raw.components.map((c, i) => {
    if (!isRecord(c) || typeof c.instanceId !== 'string' || typeof c.componentId !== 'string') {
      throw new LessonPackageError(`components[${i}] needs string instanceId and componentId.`);
    }
    return { instanceId: c.instanceId, componentId: c.componentId, data: c.data ?? null };
  });
  const provenance = isRecord(raw.provenance)
    ? (raw.provenance as unknown as LessonPackageProvenance)
    : { generatedAt: new Date(0).toISOString(), source: 'unknown' };
  return {
    benchVersion: LESSON_PACKAGE_VERSION,
    id: raw.id,
    subskill: isRecord(raw.subskill) ? (raw.subskill as LessonPackageSubskill) : null,
    provenance,
    manifest,
    curatorBrief: brief,
    components,
    scores: isRecord(raw.scores) ? (raw.scores as unknown as LessonBenchScores) : null,
    human: isRecord(raw.human) ? (raw.human as unknown as LessonBenchHumanLabel) : null,
  };
}

/** Which layout blocks the package can actually render. Missing data = the block is dropped on replay. */
export function packageFidelity(pkg: LessonPackage): Array<{ instanceId: string; componentId: string; title: string; present: boolean }> {
  const have = new Set(pkg.components.filter((c) => c.data !== null && c.data !== undefined).map((c) => c.instanceId));
  return (pkg.manifest.layout ?? [])
    .filter((item) => item.componentId !== 'curator-brief')
    .map((item) => ({ instanceId: item.instanceId, componentId: item.componentId, title: item.title, present: have.has(item.instanceId) }));
}

/** The replay: package → the exact ExhibitData the build step would have produced. */
export function exhibitFromPackage(pkg: LessonPackage): ExhibitData {
  const map = new Map<string, GeneratedContent>(
    pkg.components.map((c) => [c.instanceId, { instanceId: c.instanceId, data: c.data }]),
  );
  return assembleExhibitFromContent(pkg.manifest, pkg.curatorBrief, map);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

export function mintLessonPackageId(topic: string, gradeLevel: string, at: Date = new Date()): string {
  const stamp = at.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${slug(gradeLevel) || 'g'}-${slug(topic) || 'lesson'}-${stamp}-${rand}`;
}

export interface BuildLessonPackageInput {
  manifest: ExhibitManifest;
  curatorBrief: IntroBriefingData | null;
  components: LessonPackageComponent[];
  source: string;
  subskill?: LessonPackageSubskill | null;
  id?: string;
}

/** Producer helper (topic-trace). Returns an error record instead of a package when the brief is missing. */
export function buildLessonPackage(input: BuildLessonPackageInput): LessonPackage | { error: string } {
  if (!input.curatorBrief) {
    return { error: 'No curator brief — a package needs the full brief. Run the trace WITHOUT fixed objectives (objectives != false) so the brief is generated.' };
  }
  const now = new Date();
  return {
    benchVersion: LESSON_PACKAGE_VERSION,
    id: input.id ?? mintLessonPackageId(input.manifest.topic, input.manifest.gradeLevel, now),
    subskill: input.subskill ?? null,
    provenance: {
      generatedAt: now.toISOString(),
      source: input.source,
      topic: input.manifest.topic,
      gradeLevel: input.manifest.gradeLevel,
      gitSha: null,
      promptHash: null,
    },
    manifest: input.manifest,
    curatorBrief: input.curatorBrief,
    components: input.components,
    scores: null,
    human: null,
  };
}
