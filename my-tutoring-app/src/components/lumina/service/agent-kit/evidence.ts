/**
 * The evidence a lesson must collect (USER 2026-11-09): what the child has to do for a right answer to count toward the
 * objective, written by whoever plans the lesson and read by three parties. The author is told it, the look stage's
 * blind reader judges every item against it, and code says when the kit has no surface for the act at all.
 *
 * Why: the look stage asked only whether an item practises the objective, so "which circle shows thirds?" passed for an
 * objective that says the child cuts the circle. On 2026-11-09 nine generations shipped clean, some of them exactly
 * what the reviewer's notes said must not earn credit (`qa/evidence-spec/2026-11-09.json`).
 *
 * A gap is sent back to the author while rounds last and never stops a lesson: an item that still misses ships with the
 * gap on its record, and the run record counts them. That count is the measure of what the kit cannot yet collect.
 */
import type { Surface } from './surfaces';

export const EVIDENCE_ACTS = ['recognize', 'arrange', 'set', 'build', 'run-read', 'say', 'explain'] as const;
export type EvidenceAct = typeof EVIDENCE_ACTS[number];

export interface EvidenceSpec {
  /** The kind of thing the child does. */
  act: EvidenceAct;
  /** What they do it on ("a whole, uncut circle"). */
  on: string;
  /** The observable that earns credit, as a condition. */
  credit: string;
  /** What a child could do instead that must not earn credit. */
  notCredit?: string;
  /** The result has to happen on the screen; being told it does not count. */
  observed?: boolean;
}

export const ACT_WORDS: Record<EvidenceAct, string> = {
  recognize: 'picks the right one from choices',
  arrange: 'sorts or orders given things',
  set: 'changes a given picture or model until it is right',
  build: 'makes it from pieces, starting from nothing',
  'run-read': 'runs a test and reads what happened',
  say: 'says or writes the answer',
  explain: 'says why',
};

/** The surfaces on which a child does each act. An empty list is an act the kit cannot collect yet. */
const ACT_SURFACES: Record<EvidenceAct, readonly Surface[]> = {
  recognize: ['choose', 'categorize', 'order', 'make', 'point'],
  arrange: ['categorize', 'order'],
  build: ['make'],
  set: ['set'],
  // A set item on a `system` board: the child sets the parts, Check runs the model, and the result is on the screen.
  'run-read': ['set'],
  say: [],
  // A teach item (`teachSurface.ts`): the child explains to a character who holds a wrong idea; the live tutor judges meaning.
  explain: ['teach'],
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A spec from a manifest config or a probe, or undefined when it is not one. */
export function readEvidence(raw: unknown): EvidenceSpec | undefined {
  const r = (raw ?? {}) as Record<string, unknown>;
  const act = text(r.act) as EvidenceAct;
  if (!EVIDENCE_ACTS.includes(act) || !text(r.credit)) return undefined;
  return { act, on: text(r.on), credit: text(r.credit), ...(text(r.notCredit) ? { notCredit: text(r.notCredit) } : {}), ...(r.observed === true ? { observed: true } : {}) };
}

/** The spec in the lines every reader of it is given. */
export function evidenceLines(e: EvidenceSpec): string {
  return [
    `- What the child does: ${ACT_WORDS[e.act]}${e.on ? `, on ${e.on}` : ''}.`,
    `- Credit only when: ${e.credit}.`,
    ...(e.notCredit ? [`- Does not count: ${e.notCredit}.`] : []),
    ...(e.observed ? ['- The result must happen on the screen. Telling the child the result does not count.'] : []),
  ].join('\n');
}

/** What the author is told. */
export const evidencePrompt = (e: EvidenceSpec) => `EVIDENCE THIS LESSON MUST COLLECT (from the curriculum):
${evidenceLines(e)}
Build items where a right answer is this evidence. An item whose right answer is something under "does not count" teaches the topic and proves nothing.`;

/**
 * How whoever plans a lesson writes the spec, one per objective (the curator brief today; a lesson record later). These
 * are the rules the kit's reader will hold every item to, so the writer and the reader agree on what counts. The acts
 * are not limited to what the kit can collect: an objective whose verb is "explain" gets `explain`, and the run record
 * counts the items that cannot collect it. That count is the measure of what the kit still lacks, by act.
 */
export const EVIDENCE_WRITING_RULES = `### Evidence per objective
For EACH objective, write the evidence a lesson must collect: what the child does that shows they can do it.
- act: one of ${EVIDENCE_ACTS.join(', ')}. ${EVIDENCE_ACTS.map(a => `${a}: the child ${ACT_WORDS[a]}`).join('; ')}. Prefer doing to picking: recognize only when the objective is to name or tell things apart; say when the answer is a word or number the child produces; explain when the objective asks the child to tell why or how.
- on: what they do it on ("a whole, uncut circle", "two groups of counters", "a friend who thinks heavy things always sink").
- credit: ONE observable result, as a condition a reader could check on the screen or in what the child said ("the three cuts leave four equal parts"; "the child says that ten plus three is quicker than counting on from eight"). Never "shows understanding", "is ready", "participates" or "completes the activity".
- notCredit: what a child could do instead that must not count ("picks the one picture drawn differently", "reads the answer back from the screen", "names making ten without saying what it does").`;

/** The acts some kit surface can collect, strongest first: what a planned spec chooses from. */
export const COLLECTABLE_ACTS = (['run-read', 'build', 'set', 'explain', 'arrange', 'recognize'] as const).filter(a => ACT_SURFACES[a].length);

/**
 * What a planner is asked when a lesson arrives with no spec (USER 2026-11-09): without one the author is free to ask
 * "which picture shows it" for an objective about doing it, and did (an excavators lesson: choose, sort, order).
 * It picks only from acts the kit can collect, so a default never makes a lesson that counts 0.
 */
export const evidencePlanAsk = (objective: string, grade: string) => `A ${grade} child will practise this: "${objective}".
Decide what the child must DO for a right answer to show they learned it. Pick the strongest act the objective supports:
${COLLECTABLE_ACTS.map(a => `- ${a}: the child ${ACT_WORDS[a]}`).join('\n')}
Prefer doing to picking. A topic about how something works, moves, grows, balances or is measured is run-read (the child sets up a working model and runs it) or set. recognize is right only when the objective is to name or tell things apart.
Return JSON: {"act": one of the above, "on": "what the child does it on", "credit": "the observable that earns credit, as a condition", "notCredit": "what a child could do instead that must not earn credit", "observed": true when the result has to happen on the screen}`;

/** The field the blind reader fills, and the lines it reads first. */
export const evidenceAsk = (e: EvidenceSpec) => ({
  context: `The lesson must collect this evidence:\n${evidenceLines(e)}\n`,
  field: '"evidence_gap": "how a child who succeeds on this screen would still NOT have done what earns credit (they only picked from ready-made answers, the result was told and not seen, a part of the credit condition is never asked for), in one sentence, or null when succeeding here is what earns credit"',
});

/** The act asks for something this surface cannot collect, though another kit surface can: a sentence the author can act on. */
export function surfaceGap(e: EvidenceSpec, surface: Surface): string | null {
  const fit = ACT_SURFACES[e.act];
  if (!fit.length || fit.includes(surface)) return null;
  return `the evidence asks that the child ${ACT_WORDS[e.act]}, and on a ${surface} item the child does not. Use ${fit.join(' or ')}`;
}

/** The kit has no surface for this act, so no item can collect the evidence in full: the gap is the kit's, not the author's. */
export const unsupportedAct = (e: EvidenceSpec): string | null =>
  (ACT_SURFACES[e.act].length ? null : `no kit surface lets a child do this act ("${e.act}": the child ${ACT_WORDS[e.act]})`);

/** What a run did about its spec, for the run record. */
export interface EvidenceRecord { spec: EvidenceSpec; items: number; met: number; gaps: Array<{ id: string; gap: string }>; unsupported: string | null }
