/**
 * judgedScriptContract — the shared contract a judged-loop pack fills in, and
 * the validators that make the DI family's standing gates STRUCTURAL instead of
 * remembered.
 *
 * Where this sits (qa/di/BACKLOG.md item 16, extraction ruling 2026-08-10):
 * four literacy ports + five DI packs hand-rolled the same skeleton around
 * `useJudgedSpeechLoop`, and everything that varied between them was the
 * SCRIPT — cue wording, judging contract, what counts as an answer. So the
 * generalization line runs exactly there:
 *
 *   - `judgedLoopModel` / `useJudgedSpeechLoop` (below this file): the engine.
 *     Attempt anchoring, sentinel verdicts, cue pacing. Already generic.
 *   - THIS CONTRACT + `useJudgedScriptRunner`: the repeated component half —
 *     progression policy, correction caps, connect/mic lifecycle, context
 *     sync, gesture rules. Generic BY DERIVATION from the eight consumers.
 *   - The pack's script module + stage rendering: HAND-AUTHORED, per skill.
 *     The exact wording IS the pedagogy (DISTAR discipline). Nothing in this
 *     file writes a cue, and nothing ever should — three ports produced three
 *     cue shapes, and a template carrying any one of them would have shipped
 *     the answer inside the ask on the other two (handoff §3, step 1).
 *
 * What Gemini gets to vary rides in pack ITEMS (menu-scoped content per the
 * Fork A pattern); what it never varies is the wording or the judging
 * contract. "Flexible schema" means slots, not sentences.
 */

import { DI_SENTINELS, type SentinelPair } from './judgedLoopModel';
// ============================================================================
// Re-exported from teachingItemContract — moved, not retired
// ============================================================================

/**
 * Standing gate 1's benched response-class registry now lives in
 * `teachingItemContract`, so a domain module can declare what class of answer
 * an item asks for WITHOUT importing the sentinel engine below it (sunset
 * slice S1). Re-exported here because ~90 pack modules already address it at
 * this path, and the sunset does not move the gate, only its address.
 */
export {
  RESPONSE_CLASSES,
  type ResponseClassId,
  type ResponseClassStatus,
  type ResponseClassRecord,
  type TeachingItem,
} from './teachingItemContract';
import { RESPONSE_CLASSES } from './teachingItemContract';
import type { ResponseClassId, TeachingItem } from './teachingItemContract';

// ============================================================================
// Family constants
// ============================================================================

/** Manual voice-activity mode for the whole family: our amplitude detector
 *  brackets every learner turn; Gemini's speech-likeness VAD is unusable for
 *  short spoken responses (DI bench run-3 ruling). Every consumer's catalog
 *  entry must declare the same `audioInput` so the lesson path opens the
 *  shared session identically. Lives here (not the runner) so pure di-script
 *  tests can pin the catalog side without importing React. */
export const JUDGED_AUDIO_INPUT = { manual_activity: true } as const;

// ============================================================================
// The pack contract
// ============================================================================

/** How the tutor asks for this item: opening = first cue of the run (carries
 *  the how-to-play inside the quoted line — SWAP-1); howToPlay = re-speak the
 *  protocol because the ACTION changed (cvc-speller rule). Packs ignore what
 *  they don't use. */
export interface JudgedCueOptions {
  opening: boolean;
  howToPlay: boolean;
}

/**
 * The child-facing action for one Direct Instruction step.
 *
 * `instruction` is deliberately shared by the screen and the spoken ask. A
 * port must not maintain a visual paraphrase beside a different voice prompt:
 * that is how a child ends up seeing a microphone while being asked to drag,
 * or hearing "find the big number" beside an unexplained three-slot board.
 *
 * This contract is optional on the family base while ports migrate. A port
 * adopting it should make the field required on its narrower item type and
 * derive the item's `answerKind` from `actionContract.answerKind`.
 */
export interface DiActionContract {
  /** Stable step identity within the primitive, for progress UI and analytics. */
  id: string;
  /** Short verb-led name shown in the step sequence. */
  label: string;
  /** Compact symbol used by summaries and narrow progress displays. */
  icon: string;
  /** Whether the learner answers on the page or with their voice. */
  answerKind: 'voice' | 'gesture';
  /** The exact child-directed sentence shown on screen and spoken by the tutor. */
  instruction: string;
  /** Honest in-progress copy while this action is being judged. */
  checkingInstruction: string;
}

/**
 * The judged runner's item: a `TeachingItem` plus the retiring runner's own
 * action-panel contract. When a primitive migrates to the teaching workspace
 * it drops back to `TeachingItem`.
 */
export interface JudgedScriptItem extends TeachingItem {
  /** Shared action UI contract. Optional only to allow incremental migration. */
  actionContract?: DiActionContract;
}

/** Tier-A misconception evidence, built at the moment of a correction. The
 *  runner attaches the judge's own finished correction line (`verdict-text`)
 *  as `judgeFeedback` when it arrives. */
export interface JudgedDiagnosisObservation {
  itemId?: string;
  phase?: string;
  support?: string;
  challenge: string;
  expected: string;
  observed: string;
  judgeFeedback?: string;
}

/** What a finished RUN was actually made of. Not a pack field — a run's mix
 *  depends on which items the manifest sent, and a mode-forked pack ships all
 *  three shapes at different times. */
export type JudgedAnswerMix = 'voice' | 'gesture' | 'mixed';

/**
 * The honest modality of a run, for completion copy.
 *
 * The orb learned this in 19d; the celebration line had not. A `letter-sound-link`
 * run of six `hear-see` items — every one answered by TAPPING — congratulated the
 * child for working "with your own voice" (user drive 2026-08-13). Same defect
 * class, one screen later: text that asserts a modality the run did not have.
 *
 * The PHRASING stays per-primitive (it is pedagogy, and "out loud" is not
 * interchangeable with "on the frame"); only the fact is shared. An empty run is
 * 'voice' — the family's default shape, and there is nothing to congratulate.
 */
export function judgedAnswerMix(
  items: readonly Pick<JudgedScriptItem, 'answerKind'>[],
): JudgedAnswerMix {
  if (items.length === 0) return 'voice';
  const spoken = items.filter((item) => item.answerKind === 'voice').length;
  if (spoken === items.length) return 'voice';
  return spoken === 0 ? 'gesture' : 'mixed';
}

/** Status-line strings shown under the mic. Text is pack-owned pedagogy;
 *  defaults exist so a pilot can start with the family's proven wording. */
export interface JudgedStatusLines<Item extends JudgedScriptItem> {
  idle: string;
  ready: (item: Item) => string;
  listening: string;
  judging: string;
  retry: (item: Item) => string;
  noVerdict: (item: Item) => string;
  /** THE THIRD BRANCH: the tutor answered a question and re-asked the item. */
  helped: string;
  affirmedNext: string;
  affirmedLast: string;
  moveOn: string;
  retake: string;
  dead: string;
  done: string;
}

export interface JudgedScriptPack<Item extends JudgedScriptItem> {
  /** Catalog primitive id — used for connect payloads and logging. */
  primitiveType: string;
  /** `primitive_data.activity` line sent at connect. */
  activityLine: string;
  items: Item[];
  /** The scripted ask for one item. Hand-authored in the pack's script module. */
  itemCue: (item: Item, opts: JudgedCueOptions) => string;
  /** Correction cap reached: acknowledge and carry the lesson forward. */
  moveOnCue: (item: Item, next: Item | null, opts: JudgedCueOptions) => string;
  completeCue: () => string;
  /** Tap-to-hear: speak the STIMULUS, never the answer. Omit = no tap-to-hear. */
  pronounceCue?: (item: Item) => string;
  /**
   * Template keys pushed at connect AND on every advance. Every `{{key}}` in
   * the catalog tutoring block must be produced here, or the tutor reads the
   * literal "(not set)" aloud as content (handoff §3 step 3).
   */
  contextFor: (item: Item) => Record<string, string>;
  /** Engine defaults ("Yes" / "My turn") unless the domain phrasing fights
   *  them — a non-default pair is a BENCHED change (standing gate 2). */
  sentinels?: SentinelPair;
  /** Corrections the tutor may run on one item before moving on. Default 2. */
  maxCorrections?: number;
  /** Session pass threshold for the summary. Default 60. */
  passThreshold?: number;
  statusLines?: Partial<JudgedStatusLines<Item>>;
  /**
   * One factual observation per judged attempt: what was asked, the key, and
   * what was heard or done, from the item's own fields and the committed board
   * (the runner calls it before the verdict resets the board). Called on EVERY
   * verdict: the runner keeps all of them as `learningResponses` (student work)
   * and the corrected ones as the diagnosis observations behind
   * `summary.diagnosisEvidence`. State what was heard or done, never the
   * verdict, because the same text is recorded for right answers. `heard` is
   * the judged attempt's transcript (null for a gesture or a silent attempt).
   * May close over component state; the runner reads the pack through a ref.
   */
  observation?: (
    item: Item,
    context: { heard: string | null; verdict: 'affirmed' | 'corrected' },
  ) => { challenge: string; expected: string; observed: string } | null;
  /** @deprecated Corrections only, so right answers never reach student work.
   *  Kept so existing packs compile; migrate to `observation`. Ignored when
   *  `observation` is set. */
  diagnosisObservation?: (
    item: Item,
    context: { lastHeard: string | null },
  ) => Omit<JudgedDiagnosisObservation, 'judgeFeedback'> | null;
  /** How the run's session and its correct outcome read to the distiller, from
   *  the items actually asked (a mode-forked pack describes each kind present).
   *  The runner adds the item count, the correction policy and the first-time
   *  share itself (`judgedRunEvidence`). Omit = `activityLine` and the latest
   *  observation's `expected`. */
  evidenceSummary?: (items: readonly Item[]) => { task: string; expected: string };
}

/**
 * THE WIRE: every field of a pack that can reach the tutor. The rest of
 * `JudgedScriptPack` is component-owned — status lines are rendered, and
 * `observation` closes over board state — so a pack splits cleanly
 * into "what the tutor is told" and "what the screen does with the verdict".
 *
 * Named because a SECOND consumer arrived: the DI drive-plan endpoint
 * (`/api/lumina/tutor-test?di=1`) builds the real cues for the headless
 * judged-loop harness. A harness that re-typed those cues would test a
 * fiction — the exact drift 19f found on both sides of letter-spotter's wire
 * — so a port exports its cue surface once and the component spreads it.
 */
export type JudgedCueSurface<Item extends JudgedScriptItem> = Pick<
  JudgedScriptPack<Item>,
  | 'primitiveType'
  | 'activityLine'
  | 'items'
  | 'itemCue'
  | 'moveOnCue'
  | 'completeCue'
  | 'pronounceCue'
  | 'contextFor'
  | 'sentinels'
  | 'maxCorrections'
>;

// ============================================================================
// Validators — the gates, checkable by every pack's own test file
// ============================================================================

/** Tokenizer consistent with judgedLoopModel's verdict scan: lowercase,
 *  punctuation stripped. A collision found here is a collision the reducer
 *  would misread live. */
const tokenize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);

const matchesOpener = (tokens: string[], opener: string[]): boolean =>
  opener.length <= tokens.length && opener.every((word, i) => tokens[i] === word);

/**
 * THE HELP BRANCH — the third outcome of a judged turn, appended to a pack's
 * two-branch law.
 *
 * Why it exists (2026-09-19, user review of a live counting-board session). A
 * five-year-old said "can you help me" while working. The two-branch law makes
 * every reply either the affirmation or the correction, so the tutor delivered
 * the correction line — and on the next turn delivered it again, verbatim. She
 * was not off-script; there was no script for a child who asks.
 *
 * The branch is written to be SAFE under the same pressure the two-branch law
 * was written for: it is one quoted opener, a hard one-sentence cap, and a
 * mandatory return to the ask. Without the cap a help turn becomes the "third
 * reply channel" that the catalog's `scaffoldingLevels` already proved breaks
 * a run — the tutor teaches instead of judging and the loop records no verdict.
 *
 * `reAsk` is the pack's own ask line for this item, quoted, so the child lands
 * back exactly where they were. The runner sends NO cue after a help turn
 * precisely because this clause re-asks in-band.
 */
export const helpBranch = (reAsk: string): string =>
  `THIRD BRANCH — THE LEARNER ASKS INSTEAD OF ANSWERING. If what you hear is a question or a `
  + `request for help ("what do I do?", "can you help me?", "I don't know", "what's this?") rather `
  + `than an attempt at the answer, do NOT correct them — they did not answer. `
  + `Say exactly: "Good question." then answer what they actually asked in ONE short sentence a `
  + `five-year-old understands, then say exactly: "${reAsk}" and stop. `
  + `Never give the answer to the question you asked them, and never add a second sentence of `
  + `teaching — one sentence, then the ask again. `;

export interface SentinelCollision {
  /** Which cue the offending sentence came from (pack-supplied label). */
  cueLabel: string;
  sentence: string;
  /** The opener it collides with, joined for display ("yes", "my turn"). */
  opener: string;
}

/**
 * Standing gate 2 as code: no sentence in any line the tutor may SPEAK may
 * open with an affirm/correct sentinel, because the sentence-scoped verdict
 * scan would read it as a judgment. Run it over every cue a pack can emit.
 * (Mid-sentence mentions are fine — only sentence OPENERS classify.)
 */
export function findSentinelCollisions(
  cues: Array<{ label: string; text: string }>,
  sentinels: SentinelPair = DI_SENTINELS,
): SentinelCollision[] {
  const collisions: SentinelCollision[] = [];
  const openers = [...sentinels.affirm, ...sentinels.correct, ...(sentinels.help ?? [])];
  for (const { label, text } of cues) {
    for (const sentence of text.split(/[.!?]+/)) {
      const tokens = tokenize(sentence);
      if (tokens.length === 0) continue;
      for (const opener of openers) {
        if (matchesOpener(tokens, opener)) {
          collisions.push({ cueLabel: label, sentence: sentence.trim(), opener: opener.join(' ') });
        }
      }
    }
  }
  return collisions;
}

/**
 * The tutor-audible span(s) of a cue — every quoted line after a speak anchor.
 * Everything outside these spans is judge-side instruction. Extracted here
 * because 12 di-script test files grew three divergent copies of this parser,
 * and the naive single-anchor form reads the wrong span on dual-anchor cues
 * (LetterSpotter's test docblock records the miss). Use this everywhere a gate
 * needs "inside vs outside the quoted line".
 *
 * FOUR anchors, because the family has two eras and the parser has to cover
 * both or the sweep can't reach the older half: `Speak exactly:` is the
 * di-bench form the four pre-runner ports inherited (47 sites), `Say exactly:`
 * the runner-era form (70), `then wait:` the tail of the dual-anchor
 * "Say ONLY this, warmly, then wait:" frame, and `Say ONLY this <n words>:`
 * the tap-to-hear pronounce form. An anchor missing here is not a silent
 * no-op: `findPerformedStageDirections` subtracts these spans before scanning,
 * so an unrecognised span makes the SPOKEN line searchable for stage
 * directions and can flag a cue that is in fact clean.
 */
const SPOKEN_SPAN_RE =
  /(?:(?:Say|Speak) exactly:|Say ONLY this[^:"]{0,40}:|then wait:)\s*"([\s\S]*?)"/gi;

export const spokenSpansOf = (cue: string): string[] =>
  Array.from(cue.matchAll(SPOKEN_SPAN_RE), (m) => m[1]);

/** The first spoken span — the line the tutor SPEAKS on this turn. */
export const spokenSpanOf = (cue: string): string => spokenSpansOf(cue)[0] ?? '';

/**
 * Does any SENTENCE of this text open with a verdict sentinel? The one
 * generated-content lock: run it over every model-produced string that can be
 * spoken or printed into a cue. Sentence-scoped like the engine's verdict scan
 * — a string-START regex misses a second-sentence opener ("I was tired. Yes,
 * very tired."), which is the weaker fork this export replaces (letter-spotter
 * carried it on both sides of the wire).
 */
export const opensWithSentinel = (
  text: string,
  sentinels: SentinelPair = DI_SENTINELS,
): boolean => findSentinelCollisions([{ label: 'content', text }], sentinels).length > 0;

/**
 * Imperative stage directions OUTSIDE the spoken span get PERFORMED: ten-frame's
 * contract opened "Then WAIT silently — …" and the tutor wrapped it in an
 * invented bracket tag and read "[WAIT silently]" to the child (drive 2,
 * 2026-08-13); letter-spotter fabricated `[LSP_TAP]` from the same shape. A
 * contract states FACTS about the turn ("you then stay silent while the
 * learner works"), never orders. This finds the known imperative forms so the
 * fix propagates structurally instead of pack by pack.
 *
 * It caught NINE packs when the 19a sweep turned it on — every judged pack in
 * the repo except the ten-frame pilot opened its contract with the imperative
 * — plus a second form one clause down (`"and stop, then wait again"`, 10
 * sites) and the pre-runner ports' `"Then wait for the learner to speak."`.
 * All are on the fact-form now; the ear-check rides the open mic rows.
 *
 * It runs from the shared testkit rather than inside validateJudgedScriptPack
 * because the RUNNER calls that validator in dev, and a wording rule belongs in
 * the gate a pack author runs, not in a console.error at session start.
 */
const PERFORMED_DIRECTION_RE = /\bThen WAIT\b|\bWAIT (?:silently|in complete silence)\b/i;

export function findPerformedStageDirections(
  cues: Array<{ label: string; text: string }>,
): Array<{ cueLabel: string; match: string }> {
  const findings: Array<{ cueLabel: string; match: string }> = [];
  for (const { label, text } of cues) {
    const outsideSpokenSpans = text.replace(SPOKEN_SPAN_RE, ' ');
    const match = outsideSpokenSpans.match(PERFORMED_DIRECTION_RE);
    if (match) findings.push({ cueLabel: label, match: match[0] });
  }
  return findings;
}

/** Every `{{key}}` in a catalog tutoring block. */
export const extractTemplateKeys = (text: string): string[] =>
  Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g), (m) => m[1]);

/**
 * Keys the tutoring block interpolates that the pack never pushes. Anything
 * returned here renders the literal string "(not set)" into the assembled
 * prompt — which the tutor has read aloud to a child as content.
 */
export function findUnresolvedTemplateKeys(
  tutoringBlock: string,
  providedKeys: Iterable<string>,
): string[] {
  const provided = new Set(providedKeys);
  return Array.from(new Set(extractTemplateKeys(tutoringBlock))).filter((k) => !provided.has(k));
}

/**
 * Pack-level gate check. Returns human-readable issues; a pack's test file
 * asserts `toEqual([])`, and the runner runs it once in dev and console.errors
 * anything it finds. Checks: blocked/unknown response classes, duplicate item
 * ids, sentinel collisions across every cue the pack can emit, and cue
 * builders that throw.
 */
export function validateJudgedScriptPack<Item extends JudgedScriptItem>(
  pack: JudgedScriptPack<Item>,
): string[] {
  const issues: string[] = [];
  const sentinels = pack.sentinels ?? DI_SENTINELS;

  const seen = new Set<string>();
  for (const item of pack.items) {
    if (seen.has(item.id)) issues.push(`duplicate item id "${item.id}"`);
    seen.add(item.id);

    const record = RESPONSE_CLASSES[item.responseClass];
    if (!record) {
      issues.push(`item "${item.id}": unknown response class "${item.responseClass}"`);
    } else if (record.status === 'blocked') {
      issues.push(
        `item "${item.id}": response class "${item.responseClass}" is BLOCKED — ${record.evidence}`,
      );
    }
    if (item.answerKind === 'gesture' && item.responseClass !== 'manipulation') {
      issues.push(
        `item "${item.id}": gesture answers use responseClass 'manipulation', got "${item.responseClass}"`,
      );
    }
  }

  const cues: Array<{ label: string; text: string }> = [];
  const collect = (label: string, build: () => string) => {
    try {
      cues.push({ label, text: build() });
    } catch (error) {
      issues.push(`cue builder threw for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  pack.items.forEach((item, i) => {
    const next = pack.items[i + 1] ?? null;
    collect(`itemCue(${item.id}, opening)`, () => pack.itemCue(item, { opening: true, howToPlay: true }));
    collect(`itemCue(${item.id})`, () => pack.itemCue(item, { opening: false, howToPlay: false }));
    collect(`moveOnCue(${item.id})`, () => pack.moveOnCue(item, next, { opening: false, howToPlay: false }));
    if (pack.pronounceCue) collect(`pronounceCue(${item.id})`, () => pack.pronounceCue!(item));
  });
  collect('completeCue', () => pack.completeCue());

  for (const collision of findSentinelCollisions(cues, sentinels)) {
    issues.push(
      `sentinel collision in ${collision.cueLabel}: sentence "${collision.sentence}" opens with "${collision.opener}"`,
    );
  }

  return issues;
}

/**
 * A repeated ask is RECITATION above this length and a SIGNAL below it, so the
 * gate below only flags the long form.
 *
 * DI runs on invariant signals — "Your turn." is supposed to be the same words
 * every round, and a pack that rotated its wording to satisfy a gate would be
 * teaching worse. What the 2026-08-13 rulings struck was the opposite thing: a
 * long block the child has to listen THROUGH to reach the question, re-recited
 * per item. Calibrated against all four known spans:
 *
 *   FLAG   rhyme-studio's per-item rule model, 15 words ("Words rhyme when they
 *          end the same way. Listen: bee, tree — both end with -ee.") — the
 *          user ruling that opened the class: "i think we can remove that after
 *          the first example".
 *   FLAG   letter-spotter's full match-it frame, 16 words, re-spoken per item.
 *   PASS   letter-spotter's shipped SHORT repeat, 10 words — the fix the same
 *          drive produced, which a byte-identical rule would have refused.
 *   PASS   decodable-reader's "Your turn. Read it.", 4 words, once per sentence
 *          of a passage. Nothing about it can vary without inventing content,
 *          and it is the correct DI signal.
 *
 * A pack that wants a longer invariant ask does not tune this number — it says
 * the short form second, which is what the ruling asked for.
 */
const REPEATED_ASK_WORD_LIMIT = 12;

/**
 * Consecutive same-action items whose plain re-ask is BYTE-IDENTICAL and long
 * enough to be recitation (see the limit above). If the spoken line does not
 * change when the item changes, it is established once, not recited — the
 * defect shipped twice on 2026-08-13 (rhyme-studio's per-item lead-in, then
 * letter-spotter's match-it hours later, ~14s of identical speech per round)
 * because the rule lived in prose. The fix is a SHORT repeat ask for the
 * invariant mode, never a silent one: an ask that says nothing is broken
 * rather than terser. Runs from the shared testkit; legacy packs adopt it with
 * their next drive.
 */
export function findRepeatedConsecutiveAsks<Item extends JudgedScriptItem>(
  pack: JudgedScriptPack<Item>,
): string[] {
  const issues: string[] = [];
  for (let i = 1; i < pack.items.length; i++) {
    const prev = pack.items[i - 1];
    const item = pack.items[i];
    if (prev.id === item.id || (prev.action ?? '') !== (item.action ?? '')) continue;
    let prevCue = '';
    let cue = '';
    try {
      prevCue = pack.itemCue(prev, { opening: false, howToPlay: false });
      cue = pack.itemCue(item, { opening: false, howToPlay: false });
    } catch {
      continue; // a throwing cue builder is validateJudgedScriptPack's finding
    }
    const prevSpans = spokenSpansOf(prevCue);
    const spans = spokenSpansOf(cue);
    // IDENTICAL means the whole turn is identical — the ask AND the verdict
    // lines it carries, since a differing correction is a differing item.
    if (spans.length === 0 || prevSpans.join('\n') !== spans.join('\n')) continue;
    // LENGTH is measured on the ASK ALONE (span 0). The limit is about what a
    // child has to listen THROUGH to reach the question, and the affirm and
    // correction spans are conditional lines spoken on a LATER turn — never on
    // this one. Joining them inflated every real pack by ~20 words, because
    // the calibration fixtures in this file's own suite are single-span cues
    // while every shipped pack scripts its verdicts inside itemCue. Found by
    // counting-board's adapter sweep (19h-i-b), where an 8-word count_all ask
    // measured 28 and failed a gate calibrated at 12.
    const words = spans[0].split(/\s+/).filter(Boolean).length;
    if (words > REPEATED_ASK_WORD_LIMIT) {
      issues.push(
        `items "${prev.id}" → "${item.id}" (action "${item.action ?? ''}"): consecutive asks recite a byte-identical ${words}-word line — give the invariant mode a short repeat ask`,
      );
    }
  }
  return issues;
}
