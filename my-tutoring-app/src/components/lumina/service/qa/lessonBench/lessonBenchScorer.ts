/**
 * Lesson Bench — Tier A scorer and label triage. Code-judged, no LLM.
 *
 * WHAT. Fills `scores.gates / checks` on a Lesson Package from the manifest,
 * the live catalog and the affordance tags (`catalog/affordances.ts`): the
 * checks a machine can decide without reading the content. Every deduction
 * cites `{instanceId, checkId}`; every axis a block does NOT declare lands in
 * `unknowns` instead of a score — absent = unknown, never a fail — so an
 * untagged primitive can never lose a lesson its bucket.
 *
 * WHY THIS HALF FIRST. The human rail (`LessonBenchRail`) already produces a
 * label in the machine's vocabulary (`humanCheckSignals`). Until the machine
 * fills the same checks there is nothing to calibrate against, and the Tier B
 * LLM judge is trusted per check only where it agrees with hand labels. This
 * file gives the label its machine half, and `machineVsHuman` prints the
 * agreement per check with the blocks each side cited.
 *
 * WHAT THE CHILD PLAYS IS WHAT IS SCORED. Caregiver blocks are partitioned the
 * way `exhibitAssembly` places them (after the final assessment, as a parent
 * card) so the reading-load and length checks see the child's stream only.
 *
 * Checks (rubric ids from `LESSON_BENCH_CHECKS`):
 *   G1 band      pre-reader band: no stream block declares `reads: emerging |
 *                developing`. (The catalog-band half is NOT code-judged: the
 *                catalog carries no grade floors by ruling.)
 *   G4 mode      every pinned eval mode exists in the catalog. (The "emitted by
 *                the generator" half needs per-generator knowledge — Tier B.)
 *   G6 modality  K-2 literacy: no production block (role apply/assess) whose
 *                only declared answer is `tap`. Math lessons record tap-only
 *                production as evidence, not a fail (the rubric text is literacy).
 *   Q3 order     per objective, a symbolic-only block never opens before a
 *                concrete/pictorial one; an untagged block ahead of it = unknown.
 *   Q6 variety   2+ distinct primitives, no back-to-back same primitive+mode,
 *                no primitive over its declared `maxPerLesson`.
 *   Q7 evidence  at least one stream block supports evaluation with a mode.
 *   Q8 text      pre-reader band: no stream block declares reads above `none`.
 *   Q9 length    known minutes in the stream <= the band cap (a FLOOR — untagged
 *                blocks add nothing). Gives `LESSON_REASONS.too-long` its number.
 *
 * Bucket: any gate 0 → BROKEN, else RUNNABLE. CLEAN needs Tier B's holistic.
 */
import type { AffordanceRepresentation, ComponentDefinition, ManifestItem } from '../../../types';
import { resolveAffordances, type ResolvedAffordances } from '../../manifest/catalog/affordances';
import { normalizeObjectiveGrade } from '../../generation/resolveGenerationContext';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import { partitionCaregiverBlocks } from '../../exhibitAssembly';
import {
  BLOCK_REASONS,
  LESSON_BENCH_CHECKS,
  LESSON_REASONS,
  humanCheckSignals,
  type BlockReaction,
  type LessonBenchHumanLabel,
  type LessonBenchScores,
  type LessonPackage,
} from './lessonPackage';

/** instanceId used for a lesson-level citation (no single block to blame). */
export const LESSON_SCOPE = 'lesson';

/**
 * Length caps in minutes of KNOWN block time. Starting points, not doctrine:
 * the first labeled K lesson (`…pgr5`) carries 38 min of tagged child-stream
 * blocks once every block is tagged (9/9 after the 2026-09-04 rollout) and was
 * rated 5 without `too-long`, so the pre-reader cap sits just above it. The
 * first cut (35) was set when only 8/9 blocks carried minutes and failed that
 * same lesson the moment the ninth tag landed — a cap is only as honest as
 * coverage. Recalibrate against labels, never against a feeling.
 */
export const LENGTH_CAP_MINUTES = { preReader: 40, k2: 45, other: 55 } as const;

export interface LessonBand {
  /** Canonical 'K' | '1'..'12' when the package stamps one; undefined for a bare band such as "elementary". */
  grade: string | undefined;
  preReader: boolean;
  k2: boolean;
  subject: string | undefined;
}

export function resolveLessonBand(pkg: LessonPackage): LessonBand {
  const layout = pkg.manifest.layout ?? [];
  const stamped = layout
    .map((i) => normalizeObjectiveGrade((i.config as Record<string, unknown> | undefined)?.objectiveGrade))
    .find((g): g is string => !!g);
  const grade = stamped ?? normalizeObjectiveGrade(pkg.manifest.gradeLevel);
  const preReader = grade === 'K' || isPreReaderGrade(pkg.manifest.gradeLevel);
  const k2 = preReader || grade === '1' || grade === '2';
  return { grade, preReader, k2, subject: pkg.manifest.subject };
}

export interface ScoredBlock {
  instanceId: string;
  componentId: string;
  objectiveId: string | null;
  isFinalAssessment: boolean;
  /** The pinned mode string as stamped: single, 'a|b', or 'mixed'. */
  targetEvalMode: string | null;
  def: ComponentDefinition | undefined;
  /** Resolved for the pinned mode when it is a single mode; the primitive's union otherwise. */
  affordances: ResolvedAffordances | null;
  parentCard: boolean;
  position: number;
}

const modeList = (pin: string | null): string[] =>
  !pin || pin === 'mixed' ? [] : pin.split('|').map((m) => m.trim()).filter(Boolean);

/** The package's blocks in lesson order, split the way the assembly places them. */
export function blocksOf(pkg: LessonPackage, catalog: readonly ComponentDefinition[]): { stream: ScoredBlock[]; parentCards: ScoredBlock[] } {
  const byId = new Map(catalog.map((c) => [c.id as string, c]));
  const finalId = pkg.manifest.finalAssessment?.instanceId;
  const items = (pkg.manifest.layout ?? []).filter((i) => i.componentId !== 'curator-brief');
  const rows: ScoredBlock[] = items.map((i: ManifestItem, position) => {
    const def = byId.get(i.componentId);
    const config = (i.config ?? {}) as Record<string, unknown>;
    const pin = typeof config.targetEvalMode === 'string' ? config.targetEvalMode : null;
    const modes = modeList(pin);
    return {
      instanceId: i.instanceId,
      componentId: i.componentId,
      objectiveId: i.objectiveIds?.[0] ?? null,
      isFinalAssessment: !!finalId && i.instanceId === finalId,
      targetEvalMode: pin,
      def,
      affordances: def ? resolveAffordances(def, modes.length === 1 ? modes[0] : undefined) : null,
      parentCard: false,
      position,
    };
  });
  const { stream, parentCards } = partitionCaregiverBlocks(rows, (id) => {
    const d = byId.get(id);
    return !!d && resolveAffordances(d).audience === 'caregiver';
  });
  return { stream, parentCards: parentCards.map((b) => ({ ...b, parentCard: true })) };
}

/**
 * Objectives whose TARGET is notation — the numeral, the digit, the letter,
 * the written word. On such an objective a symbolic opener is the point, not
 * a Q3 miss. Matched against the objective text the curator wrote.
 */
export const NOTATION_OBJECTIVE = /\b(numerals?|digits?|number (names?|words?|symbols?)|written (numbers?|words?)|symbols?|letters?|alphabet|sight words?|spell(ing)?|trac(e|ing)|writ(e|ing)|read(ing)? (the )?(numbers?|words?))\b/i;

/** objectiveId → the objective text, from the stamped layout config first, the brief second. */
function objectiveTexts(pkg: LessonPackage): Map<string, string> {
  const out = new Map<string, string>();
  for (const o of pkg.curatorBrief?.objectives ?? []) {
    const id = (o as { id?: string }).id;
    const text = (o as { text?: string }).text;
    if (id && text) out.set(id, text);
  }
  for (const i of pkg.manifest.layout ?? []) {
    const cfg = (i.config ?? {}) as Record<string, unknown>;
    const id = typeof cfg.objectiveId === 'string' ? cfg.objectiveId : i.objectiveIds?.[0];
    if (id && typeof cfg.objectiveText === 'string' && cfg.objectiveText) out.set(id, cfg.objectiveText);
  }
  return out;
}

const label = (b: ScoredBlock) => `${b.componentId}${b.targetEvalMode ? `[${b.targetEvalMode}]` : ''}`;
const readsAbove = (a: ResolvedAffordances | null) => a?.reader === 'emerging' || a?.reader === 'developing';
const isProduction = (a: ResolvedAffordances) => a.role.some((r) => r === 'apply' || r === 'assess');
const tapOnly = (a: ResolvedAffordances) => a.answers.length > 0 && a.answers.every((x) => x === 'tap');

export function scoreLessonPackage(
  pkg: LessonPackage,
  catalog: readonly ComponentDefinition[],
  opts: { judge?: string; now?: Date } = {},
): LessonBenchScores {
  const band = resolveLessonBand(pkg);
  const { stream, parentCards } = blocksOf(pkg, catalog);
  const all = [...stream, ...parentCards];
  const gates: Record<string, 0 | 1> = {};
  const checks: Record<string, 0 | 1> = {};
  const citations: NonNullable<LessonBenchScores['citations']> = [];
  const unknowns: NonNullable<LessonBenchScores['unknowns']> = [];
  const cite = (checkId: string, b: ScoredBlock | null, note: string) =>
    citations.push({ instanceId: b?.instanceId ?? LESSON_SCOPE, checkId, note });
  const unknown = (checkId: string, b: ScoredBlock | null, note: string) =>
    unknowns.push({ instanceId: b?.instanceId, checkId, note });
  const hasCite = (checkId: string) => citations.some((c) => c.checkId === checkId);

  // ── G1 band (reader half) + Q8 text load: the same evidence, gate and check ──
  if (band.preReader) {
    for (const b of stream) {
      const a = b.affordances;
      if (readsAbove(a)) {
        cite('G1', b, `${label(b)} declares reads: ${a!.reader} — the child must read alone at the pre-reader band`);
        cite('Q8', b, `${label(b)} declares reads: ${a!.reader}`);
      } else if (!a || !a.declared) {
        unknown('Q8', b, `${label(b)} is untagged — reading load unknown`);
      } else if (a.reader === null) {
        unknown('Q8', b, `${label(b)} has no reader verdict (no reader-fit / contract line)`);
      }
    }
  }
  gates.G1 = hasCite('G1') ? 0 : 1;
  checks.Q8 = hasCite('Q8') ? 0 : 1;

  // ── G4 every pinned mode exists in the catalog ──
  for (const b of all) {
    if (!b.def) {
      cite('G4', b, `${b.componentId} is not in the catalog`);
      continue;
    }
    const known = new Set((b.def.evalModes ?? []).map((m) => m.evalMode));
    if (b.targetEvalMode === 'mixed' && known.size === 0) cite('G4', b, `${label(b)} pins mixed but the primitive declares no eval modes`);
    for (const m of modeList(b.targetEvalMode)) {
      if (!known.has(m)) cite('G4', b, `${label(b)} pins '${m}', not a catalog mode of ${b.componentId}`);
    }
  }
  gates.G4 = hasCite('G4') ? 0 : 1;

  // ── G6 modality (K-2 literacy production is spoken, not tapped) ──
  const tapOnlyProduction: string[] = [];
  if (band.k2) {
    for (const b of stream) {
      const a = b.affordances;
      if (a?.declared && isProduction(a) && tapOnly(a)) tapOnlyProduction.push(label(b));
    }
    if (band.subject === 'LANGUAGE_ARTS') {
      for (const b of stream) {
        const a = b.affordances;
        if (a?.declared && isProduction(a) && tapOnly(a)) cite('G6', b, `${label(b)} answers by tap only in a K-2 literacy lesson`);
      }
    } else if (!band.subject) {
      unknown('G6', null, 'manifest.subject is missing — the literacy rule was not applied');
    }
  }
  gates.G6 = hasCite('G6') ? 0 : 1;

  // ── Q3 concrete before symbol, per objective ──
  const byObjective = new Map<string, ScoredBlock[]>();
  for (const b of stream) {
    if (b.isFinalAssessment) continue;
    const k = b.objectiveId ?? '__none__';
    if (!byObjective.has(k)) byObjective.set(k, []);
    byObjective.get(k)!.push(b);
  }
  const objectiveText = objectiveTexts(pkg);
  const notationObjectives: string[] = [];
  byObjective.forEach((list, objectiveId) => {
    const text = objectiveText.get(objectiveId) ?? '';
    // An objective whose TARGET is notation (match numerals, trace digits,
    // name letters) opens on symbols by definition — the human kept exactly
    // such a block (…pgr5 obj3) and the A/B read it the same way. Unknown,
    // not a fail, with the objective quoted so the rater can disagree.
    const targetsNotation = NOTATION_OBJECTIVE.test(text);
    if (targetsNotation) notationObjectives.push(objectiveId);
    let seenConcreteOrPictorial = false;
    let seenUnknown = false;
    for (const b of list) {
      const rep: AffordanceRepresentation[] = b.affordances?.declared ? b.affordances.representation : [];
      if (rep.length === 0) {
        seenUnknown = true;
        continue;
      }
      if (rep.every((r) => r === 'symbolic')) {
        if (!seenConcreteOrPictorial) {
          if (targetsNotation) unknown('Q3', b, `${label(b)} opens ${objectiveId} on symbols, but the objective targets notation ("${text.slice(0, 80)}")`);
          else if (seenUnknown) unknown('Q3', b, `${label(b)} is symbolic and follows an untagged block in ${objectiveId} — order unknown`);
          else cite('Q3', b, `${label(b)} opens ${objectiveId} on symbols before any concrete or pictorial block`);
          break;
        }
      } else {
        seenConcreteOrPictorial = true;
      }
    }
  });
  checks.Q3 = hasCite('Q3') ? 0 : 1;

  // ── Q6 variety ──
  const distinct = new Set(stream.map((b) => b.componentId));
  if (distinct.size < 2) cite('Q6', null, `only ${distinct.size} distinct primitive(s) in the child's stream`);
  for (let i = 1; i < stream.length; i++) {
    const prev = stream[i - 1];
    const cur = stream[i];
    if (prev.componentId === cur.componentId && prev.targetEvalMode === cur.targetEvalMode) {
      cite('Q6', cur, `${label(cur)} repeats the previous block back-to-back`);
    }
  }
  const counts = new Map<string, ScoredBlock[]>();
  for (const b of all) counts.set(b.componentId, [...(counts.get(b.componentId) ?? []), b]);
  counts.forEach((list) => {
    const max = list[0].affordances?.maxPerLesson ?? null;
    if (max !== null && list.length > max) {
      cite('Q6', list[list.length - 1], `${list[0].componentId} appears ${list.length}x — catalog says max ${max}/lesson`);
    }
  });
  checks.Q6 = hasCite('Q6') ? 0 : 1;

  // ── Q7 evidence ──
  const scored = stream.filter((b) => b.def?.supportsEvaluation && (b.targetEvalMode || (b.def.evalModes?.length ?? 0) > 0));
  if (scored.length === 0) cite('Q7', null, 'no stream block supports evaluation with an eval mode — nothing feeds IRT');
  checks.Q7 = hasCite('Q7') ? 0 : 1;

  // ── Q9 length (a floor: untagged blocks add nothing) ──
  const knownMinuteBlocks = stream.filter((b) => typeof b.affordances?.minutes === 'number');
  const minutes = knownMinuteBlocks.reduce((s, b) => s + (b.affordances!.minutes as number), 0);
  const cap = band.preReader ? LENGTH_CAP_MINUTES.preReader : band.k2 ? LENGTH_CAP_MINUTES.k2 : LENGTH_CAP_MINUTES.other;
  if (minutes > cap) {
    cite('Q9', null, `known block minutes ${minutes} exceed the ${band.preReader ? 'pre-reader' : band.k2 ? 'K-2' : 'band'} cap of ${cap} (${knownMinuteBlocks.length}/${stream.length} blocks tagged)`);
  }
  const untimed = stream.length - knownMinuteBlocks.length;
  if (untimed > 0) unknown('Q9', null, `${untimed} stream block(s) carry no minutes — the sum is a floor`);
  checks.Q9 = hasCite('Q9') ? 0 : 1;

  const bucket = Object.values(gates).some((v) => v === 0) ? 'BROKEN' : 'RUNNABLE';
  return {
    gates,
    checks,
    holistic: [],
    bucket,
    judgedAt: (opts.now ?? new Date()).toISOString(),
    judge: opts.judge ?? 'tier-a',
    citations,
    unknowns,
    evidence: {
      band,
      streamOrder: stream.map(label),
      parentCards: parentCards.map((b) => b.instanceId),
      parentCardMinutes: parentCards.reduce((s, b) => s + (b.affordances?.minutes ?? 0), 0),
      minutes,
      lengthCap: cap,
      knownMinuteBlocks: knownMinuteBlocks.length,
      streamBlocks: stream.length,
      tapOnlyProduction,
      notationObjectives,
      distinctPrimitives: distinct.size,
      notCodeJudged: [
        'G1 catalog-band half (no grade floors by ruling)',
        'G4 generator-emitted half',
        'G6 visible-timer half',
        'G2', 'G3', 'G5', 'Q1', 'Q2', 'Q4', 'Q5',
      ],
    },
  };
}

// ── Machine vs human ──────────────────────────────────────────────────────
export interface AgreementRow {
  checkId: string;
  label: string;
  /** null = the machine did not score this check (Tier B). */
  machine: 0 | 1 | null;
  human: 'fail' | 'ok';
  agree: boolean | null;
  humanBlocks: string[];
  machineBlocks: string[];
}

export interface Agreement {
  rows: AgreementRow[];
  /** Checks the machine scored — the calibration denominator. */
  scored: number;
  agreed: number;
  /** fix/cut with a note but no reason: the rail could not map it to a check. Triage by note. */
  unrouted: Array<{ instanceId: string; reaction: BlockReaction; note: string }>;
  /** Labels on blocks the assembly now renders as parent cards (item 12) — re-rate via rerun. */
  parentCardLabels: Array<{ instanceId: string; reaction: BlockReaction; reasons: string[] }>;
  holistic: number | null;
  bucket: LessonBenchScores['bucket'];
}

export function machineVsHuman(
  scores: LessonBenchScores,
  human: LessonBenchHumanLabel,
  parentCardIds: ReadonlySet<string> = new Set(),
): Agreement {
  const signals = humanCheckSignals(human);
  const rows: AgreementRow[] = LESSON_BENCH_CHECKS.map((def) => {
    const machine = (scores.gates[def.id] ?? scores.checks[def.id] ?? null) as 0 | 1 | null;
    const mine = signals.filter((s) => s.checkId === def.id);
    const humanVerdict = mine.length ? 'fail' : 'ok';
    const machineBlocks = (scores.citations ?? []).filter((c) => c.checkId === def.id).map((c) => c.instanceId);
    return {
      checkId: def.id,
      label: def.label,
      machine,
      human: humanVerdict,
      agree: machine === null ? null : (machine === 0) === (humanVerdict === 'fail'),
      humanBlocks: mine.map((s) => s.instanceId ?? LESSON_SCOPE),
      machineBlocks,
    };
  });
  const decided = rows.filter((r) => r.agree !== null);
  const unrouted: Agreement['unrouted'] = [];
  const parentCardLabels: Agreement['parentCardLabels'] = [];
  for (const [instanceId, b] of Object.entries(human.blocks)) {
    if (b.reaction === 'keep') continue;
    if (parentCardIds.has(instanceId)) parentCardLabels.push({ instanceId, reaction: b.reaction, reasons: b.reasons });
    if (b.reasons.length === 0) unrouted.push({ instanceId, reaction: b.reaction, note: b.note });
  }
  return {
    rows,
    scored: decided.length,
    agreed: decided.filter((r) => r.agree).length,
    unrouted,
    parentCardLabels,
    holistic: human.holistic,
    bucket: scores.bucket,
  };
}

// ── Triage: label → layer → executor ──────────────────────────────────────
//
// A label names a symptom; the fix lives in exactly one layer of the pipeline.
// SELECTION  the curator picked it (catalog line, affordance tag, curator prompt)
// MODE       the pinned eval mode (resolveLessonEvalModes.ts)
// CONTENT    the generator's output for this topic (/topic-fidelity, /eval-fix)
// COMPONENT  the primitive's surface for this child (/reader-fit, /add-di-loop)
// TUTOR      the judged loop / commit path (qa/di/BACKLOG.md)
// ASSEMBLY   where a block sits in the played lesson (exhibitAssembly.ts)
export type TriageLayer = 'SELECTION' | 'MODE' | 'CONTENT' | 'COMPONENT' | 'TUTOR' | 'ASSEMBLY' | 'UNROUTED';

export interface TriageEntry {
  scope: 'block' | 'lesson';
  instanceId?: string;
  componentId?: string;
  targetEvalMode?: string | null;
  reaction?: BlockReaction;
  /** The rail reason id, or null when the rater left only a note. */
  reason: string | null;
  reasonLabel: string | null;
  checkId?: string;
  note: string;
  layer: TriageLayer;
  executor: string;
  queue: string;
  why: string;
}

export const LESSON_BENCH_QUEUE = 'qa/lesson-bench/BACKLOG.md';
export const DI_QUEUE = 'qa/di/BACKLOG.md';

/** A note that talks about the tutor, the mic, or "said it, then had to tap" is a commit-path finding. */
export const TUTOR_NOTE = /\b(tutor|mic|microphone|spoken|speak|speaks|say|says|said|voice|hear|listen|out loud|aloud)\b|\bthen\b[^.]*\b(click|tap)/i;

type Route = Pick<TriageEntry, 'layer' | 'executor' | 'queue' | 'why'>;

function routeBlock(b: ScoredBlock, reason: string | null, note: string, reaction: BlockReaction): Route {
  const cid = b.componentId;
  const multiMode = !!b.targetEvalMode && (b.targetEvalMode === 'mixed' || b.targetEvalMode.includes('|'));
  switch (reason) {
    case 'does-not-belong':
      return { layer: 'SELECTION', executor: `/add-affordances ${cid}`, queue: LESSON_BENCH_QUEUE, why: 'the demand that makes it wrong here is a fact about the primitive — tag it so the curator reads it; never a grade floor' };
    case 'not-this-skill':
      return { layer: 'CONTENT', executor: `/topic-fidelity ${cid}`, queue: LESSON_BENCH_QUEUE, why: 'the generator drifted off the objective for this topic' };
    case 'wrong-grade':
      return { layer: 'SELECTION', executor: `/add-affordances ${cid}`, queue: LESSON_BENCH_QUEUE, why: '"wrong grade" is a demand in disguise (reading, modality, audience or representation) — name the demand' };
    case 'too-much-reading':
      return b.parentCard
        ? { layer: 'ASSEMBLY', executor: 'exhibitAssembly.ts parent-card placement (item 12, shipped 2026-09-04) → rerun', queue: LESSON_BENCH_QUEUE, why: 'an adult reads this block; it now renders after the final assessment as a parent card' }
        : { layer: 'COMPONENT', executor: `/reader-fit ${cid}`, queue: LESSON_BENCH_QUEUE, why: "the child's own path needs reading after read-aloud is accounted for" };
    case 'symbols-first':
      return { layer: 'SELECTION', executor: `/add-affordances ${cid} (representation) + curator legend`, queue: LESSON_BENCH_QUEUE, why: 'the curator opened on notation; the tag tells it where the block sits on the ladder' };
    case 'needs-earlier':
      return { layer: 'SELECTION', executor: '/topic-trace — curator brief objective order (gemini-manifest.ts)', queue: LESSON_BENCH_QUEUE, why: 'objective order is decided in the brief, not the block' };
    case 'answer-shown':
      return { layer: 'CONTENT', executor: `/eval-fix ${cid}`, queue: LESSON_BENCH_QUEUE, why: 'a leak in generated data or default state' };
    case 'too-few-problems':
      return multiMode
        ? { layer: 'MODE', executor: 'resolveLessonEvalModes.ts (direct edit)', queue: LESSON_BENCH_QUEUE, why: `the pin '${b.targetEvalMode}' spreads N challenges over several modes` }
        : { layer: 'CONTENT', executor: `/eval-fix ${cid}`, queue: LESSON_BENCH_QUEUE, why: 'the generator emits one problem asked N ways' };
    case 'should-be-spoken':
      return { layer: 'COMPONENT', executor: `/add-di-loop ${cid}`, queue: DI_QUEUE, why: 'production is tapped; the judged loop is the spoken form' };
    case 'repeats-block':
      return { layer: 'SELECTION', executor: `/add-affordances ${cid} (maxPerLesson) + curator prompt`, queue: LESSON_BENCH_QUEUE, why: 'the curator repeated a primitive; the tag caps it' };
    case 'broken':
      return TUTOR_NOTE.test(note)
        ? { layer: 'TUTOR', executor: `/add-di-loop ${cid} — contract check (commit path)`, queue: DI_QUEUE, why: 'the note names the tutor / mic / a spoken answer that did not commit' }
        : { layer: 'COMPONENT', executor: `/eval-test ${cid} → /eval-fix`, queue: LESSON_BENCH_QUEUE, why: 'reproduce on the tester first' };
    case 'weak':
      return { layer: 'CONTENT', executor: `/eval-test ${cid}`, queue: LESSON_BENCH_QUEUE, why: 'quality, not correctness — needs an agent-judged look' };
    default:
      if (TUTOR_NOTE.test(note)) {
        return { layer: 'TUTOR', executor: `/add-di-loop ${cid} — contract check (commit path)`, queue: DI_QUEUE, why: 'no rail reason, but the note names the tutor / mic / a spoken answer that then needed a tap' };
      }
      return { layer: 'UNROUTED', executor: 'ask the rater for a reason', queue: LESSON_BENCH_QUEUE, why: `${reaction} with no reason and no routable note` };
  }
}

function routeLesson(reason: string): Route {
  switch (reason) {
    case 'wrong-opener':
    case 'wrong-order':
      return { layer: 'SELECTION', executor: '/topic-trace + /add-affordances (role tags) — curator prompt', queue: LESSON_BENCH_QUEUE, why: "block order is the curator's call; role and representation tags are what it reads" };
    case 'not-this-skill':
      return { layer: 'CONTENT', executor: '/topic-fidelity (curator brief)', queue: LESSON_BENCH_QUEUE, why: 'the brief framed a neighbour skill' };
    case 'wrong-grade':
      return { layer: 'SELECTION', executor: '/add-affordances', queue: LESSON_BENCH_QUEUE, why: 'name the demands, never a floor' };
    case 'missing':
      return { layer: 'SELECTION', executor: '/topic-trace — curator brief coverage (Examples / Constraints)', queue: LESSON_BENCH_QUEUE, why: 'the brief dropped part of the subskill' };
    case 'flat':
      return { layer: 'MODE', executor: 'resolveLessonEvalModes.ts (direct edit)', queue: LESSON_BENCH_QUEUE, why: "the ramp is the mode pins' betas" };
    case 'no-evidence':
      return { layer: 'MODE', executor: 'resolveLessonEvalModes.ts / catalog supportsEvaluation', queue: LESSON_BENCH_QUEUE, why: 'no scored mode reached the session' };
    case 'too-long':
      return { layer: 'SELECTION', executor: '/add-affordances (minutes, maxPerLesson) + curator legend', queue: LESSON_BENCH_QUEUE, why: 'the curator cannot budget time it cannot see' };
    default:
      return { layer: 'UNROUTED', executor: 'ask the rater', queue: LESSON_BENCH_QUEUE, why: 'unknown lesson reason' };
  }
}

/** Every fix/cut block and every lesson reason in a labeled package, routed to a layer and an executor. */
export function triageLabel(pkg: LessonPackage, catalog: readonly ComponentDefinition[]): TriageEntry[] {
  const human = pkg.human;
  if (!human) return [];
  const { stream, parentCards } = blocksOf(pkg, catalog);
  const byInstance = new Map([...stream, ...parentCards].map((b) => [b.instanceId, b]));
  const out: TriageEntry[] = [];
  for (const r of human.lessonReasons) {
    const def = LESSON_REASONS.find((d) => d.id === r);
    out.push({ scope: 'lesson', reason: r, reasonLabel: def?.label ?? null, checkId: def?.checkId, note: human.note, ...routeLesson(r) });
  }
  for (const [instanceId, b] of Object.entries(human.blocks)) {
    if (b.reaction === 'keep') continue;
    const block = byInstance.get(instanceId);
    if (!block) {
      out.push({ scope: 'block', instanceId, reaction: b.reaction, reason: b.reasons[0] ?? null, reasonLabel: null, note: b.note, layer: 'UNROUTED', executor: "block not in this package's layout", queue: LESSON_BENCH_QUEUE, why: 'stale label' });
      continue;
    }
    const reasons: Array<string | null> = b.reasons.length ? b.reasons : [null];
    for (const reason of reasons) {
      const def = reason ? BLOCK_REASONS.find((d) => d.id === reason) : undefined;
      out.push({
        scope: 'block',
        instanceId,
        componentId: block.componentId,
        targetEvalMode: block.targetEvalMode,
        reaction: b.reaction,
        reason,
        reasonLabel: def?.label ?? null,
        checkId: def?.checkId,
        note: b.note,
        ...routeBlock(block, reason, b.note, b.reaction),
      });
    }
  }
  return out;
}
