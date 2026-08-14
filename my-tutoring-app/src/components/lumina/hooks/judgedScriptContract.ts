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
// Benched response classes — standing gate 1, made structural
// ============================================================================

/**
 * Every judged item must name the CLASS of response the child produces, and
 * the class must have bench evidence behind it before a primitive wires it
 * (qa/di/BACKLOG.md standing gate 1). Free-text expected answers would let a
 * generator launder an unbenched class straight into production — letter
 * names are blocked for exactly that reason.
 *
 * Adding a class here requires a ~30-min di-bench sitting (or an explicit
 * user build-ahead ruling recorded in the queue) — put the run/ruling pointer
 * in `evidence`, never just flip a status.
 */
export type ResponseClassId =
  | 'continuant_sound'
  | 'short_spoken_word'
  | 'yes_no'
  | 'number_word_to_20'
  | 'number_word_to_120'
  | 'ordinal_word'
  | 'sentence_read_aloud'
  | 'shape_name'
  | 'manipulation'
  | 'letter_name'
  | 'closed_set_choice'
  | 'open_set_word';

export type ResponseClassStatus =
  /** Bench sitting (or equivalent live-run evidence) exists. */
  | 'benched'
  /** User build-ahead ruling: built before its sitting; acceptance drive owed. */
  | 'accepted-build-ahead'
  /** Ruled unusable until a bench clears it. The validator REFUSES these. */
  | 'blocked';

export interface ResponseClassRecord {
  status: ResponseClassStatus;
  /** Run/ruling pointer — where the evidence (or the block) lives. */
  evidence: string;
  /** Constraints a pack author must hold that the type system cannot see. */
  notes?: string;
}

export const RESPONSE_CLASSES: Record<ResponseClassId, ResponseClassRecord> = {
  continuant_sound: {
    status: 'benched',
    evidence: 'DI bench runs 2026-07-17..21; di-letter-sounds live.',
    notes: 'Held continuous sounds only — stops/digraphs/blends bench separately.',
  },
  short_spoken_word: {
    status: 'benched',
    evidence:
      'di-word-reading; sound-swap live 9/9 (a964bccc5ca2); word-flip live 5/5 (5269fc87d6da).',
    notes:
      'One short spoken word from a closed per-item set. VC-length (2-sound) words are '
      + 'unbenched at that length — the sound-swap deletion residual (#83).',
  },
  yes_no: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-12, from the rhyme-studio port-8 drive: "i think its weird to need '
      + 'the thumbs up and thumbs down [for] do they rhyme? we should just be able to say yes to '
      + 'the tutor". Acceptance drive owed on HUMAN-CHECKS #94.',
    notes:
      'A spoken yes/no VERDICT — the most separable closed pair there is (no shared phonemes), '
      + 'which is why it ships ahead of its sitting. Two things the pack must handle and the '
      + 'class cannot: (1) "no" is VC-length, the length short_spoken_word records as unbenched, '
      + 'so the accept clause must name the natural variants ("yeah", "nope", "they do", "they '
      + 'don\'t") rather than demand the bare word; (2) the child\'s "yes" is NOT a sentinel '
      + 'hazard — the verdict scan reads the TUTOR\'s output only (proven in the port-8 session '
      + 'log: a child "Yes." passed through with no misfire). The tutor\'s own affirmation still '
      + 'opens with "Yes," even when it affirms a NO answer.',
  },
  number_word_to_20: {
    status: 'benched',
    evidence: 'Math-facts probe sitting #46 3/3 (2026-07-24); di-shapes counting 3..6.',
    notes:
      'ZERO is excluded: "zero"/"none" as a spoken answer is an owed bench check '
      + '(di-shapes rung 2 residual). Generators must floor counts at 1.',
  },
  number_word_to_120: {
    status: 'accepted-build-ahead',
    evidence: 'Item 10 build-ahead ruling (3986f77, 2026-08-06); acceptance sitting #63 owed.',
    notes: 'Multi-word numerals (twenty-one…). Ships only where the pack already gates on #63.',
  },
  ordinal_word: {
    status: 'benched',
    evidence:
      'Single common words (first..tenth) within the short_spoken_word class; no homophone '
      + 'cluster. Distinct id so an ordinal pack is findable if the class ever needs its own bench.',
  },
  sentence_read_aloud: {
    status: 'benched',
    evidence: 'di-sentence-reading pack, live-gated 2026-07-25.',
  },
  shape_name: {
    status: 'benched',
    evidence:
      'di-shapes bench probe set + pack (cabb3f0); spokenAlternates stated per item. '
      + 'Pack L0 live gate #72 still open.',
  },
  manipulation: {
    status: 'benched',
    evidence:
      'Not a spoken class: the commit is described to the tutor in the cue and the verdict '
      + 'rides the ordinary sentinel scan. First production caller cvc-speller spell_word '
      + '(2026-08-10); its live gate #85 is open.',
    notes: 'Gesture items must follow the runner’s gesture rules — see useJudgedScriptRunner.',
  },
  letter_name: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-13, from the letter-spotter drive (session 6ada8c0a1bcf): "in real '
      + 'life if i have a sentence with a missing letter, and i ask the student to use context '
      + 'clues and the word to say the missing letter, they should be able to translate the '
      + 'sentence and missing letter verbally. they dont need to click a button." The prior '
      + 'BLOCKED status is what pushed letter-spotter to an all-tap pack, and that pack is the '
      + 'defect the ruling overturns. Acceptance drive owed on HUMAN-CHECKS.',
    notes:
      'The homophony that motivated the block is REAL but is a per-ITEM constraint, not a class-'
      + 'wide one. The judge is never asked to classify across 26 letters — it is handed ONE '
      + 'target and asked whether the child said it. Two things a pack must do that the class '
      + 'cannot: (1) ACCEPT THE SOUND TOO. "S" or a held /s/ are both right answers from a '
      + 'five-year-old, the sound side is the benched continuant_sound channel, and accepting '
      + 'both makes a cluster confusion need to fail twice. (2) MIND THE CLUSTERS when a wrong '
      + 'answer is plausible: /iː/ = b c d e g p t v z, /ɛ/-initial = f l m n s x, /eɪ/ = a h j k, '
      + '/aɪ/ = i y. A target whose cluster-mate is a likely error for THAT item (b/d on a '
      + 'reversal-prone word) is the item to drop, not the class to block.',
  },
  closed_set_choice: {
    status: 'accepted-build-ahead',
    evidence:
      'USER RULING 2026-08-13, from the decodable-reader drive: "mode sequence/cause effect doesnt let me '
      + 'answer for the 2nd part verbally, i need to click on the button even though im speaking, this is the '
      + 'same issue with inference mode." Third time the same ruling has landed (rhyme-studio recognition, '
      + 'letter-spotter name-it, now this) and the last two both shipped SPOKEN and held. Acceptance drive owed '
      + 'on HUMAN-CHECKS #96 (c) — the decodable-reader row, where the fork lives.',
    notes:
      'The child SAYS which of the N choices on screen they pick. This is NOT open-set production: the judge is '
      + 'handed the exact choice texts and told which one is right, so it classifies an utterance against a '
      + 'printed menu — the same closed-set arithmetic that makes short_spoken_word safe, over a longer string. '
      + 'It is what a proposition-shaped answer needs, because spoken FREE production of a proposition is '
      + 'open_set_word (BLOCKED) and the alternative — a button — is the costume the ruling struck down.\n'
      + 'Two things a pack must do that the class cannot: (1) ACCEPT THE SHORT FORM. A five-year-old answers '
      + '"the mat" or "the second one", not the whole sentence back; a contract that demands the full string '
      + 'fails children for recall, not comprehension. (2) GATE ON EAR-SEPARABILITY. Every choice must carry at '
      + 'least one word no other choice has, or an utterance can fit two of them and the judge cannot honestly '
      + 'score it — a subset option ("A cat." against "A cat and a dog.") is the shape to DROP, not to judge '
      + 'leniently.',
  },
  open_set_word: {
    status: 'blocked',
    evidence:
      'Open-set production (rhyme generation etc.) has no bench; qa/di/BACKLOG.md item 16 '
      + 'keeps rhyme-studio behind a sitting for exactly this.',
  },
};

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

export interface JudgedScriptItem {
  id: string;
  /** What the answer is MADE of — the only per-primitive modality question
   *  (item 16 frame ruling). 'voice' = spoken, judged from audio in-band;
   *  'gesture' = a committed manipulation, described to the tutor by cue.
   *
   *  THE DECISION RULE (user ruling 2026-08-13): picture a teacher at a table
   *  with one student. If the student would naturally answer OUT LOUD, the
   *  answer is 'voice' — the mic is the student's voice, and the screen never
   *  impersonates it with buttons. If the student would do the work ON THE
   *  PAGE (arrange, build, write, point), the screen IS that page and the
   *  answer is 'gesture' — honest page-work, never a workaround for a judge
   *  that finds the spoken answer hard. Full fork: add-di-loop Step 1. */
  answerKind: 'voice' | 'gesture';
  /** Standing gate 1: the benched class this item's answer belongs to. */
  responseClass: ResponseClassId;
  /** Task identity for the how-to-play re-speak policy: when consecutive
   *  items change `action`, the next cue gets `howToPlay: true`. Single-action
   *  packs may omit it. */
  action?: string;
}

/** Tier-A misconception evidence, built at the moment of a correction. The
 *  runner attaches the judge's own finished correction line (`verdict-text`)
 *  as `judgeFeedback` when it arrives. */
export interface JudgedDiagnosisObservation {
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
  /** Build Tier-A evidence at each correction; return null to skip. May close
   *  over component state (board contents etc.) — the runner reads the pack
   *  through a ref, so closures stay fresh. */
  diagnosisObservation?: (
    item: Item,
    context: { lastHeard: string | null },
  ) => Omit<JudgedDiagnosisObservation, 'judgeFeedback'> | null;
}

/**
 * THE WIRE: every field of a pack that can reach the tutor. The rest of
 * `JudgedScriptPack` is component-owned — status lines are rendered, and
 * `diagnosisObservation` closes over board state — so a pack splits cleanly
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
  const openers = [...sentinels.affirm, ...sentinels.correct];
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
    const prevSpoken = spokenSpansOf(prevCue).join('\n');
    const spoken = spokenSpansOf(cue).join('\n');
    if (prevSpoken.length === 0 || prevSpoken !== spoken) continue;
    const words = spoken.split(/\s+/).filter(Boolean).length;
    if (words > REPEATED_ASK_WORD_LIMIT) {
      issues.push(
        `items "${prev.id}" → "${item.id}" (action "${item.action ?? ''}"): consecutive asks recite a byte-identical ${words}-word line — give the invariant mode a short repeat ask`,
      );
    }
  }
  return issues;
}
