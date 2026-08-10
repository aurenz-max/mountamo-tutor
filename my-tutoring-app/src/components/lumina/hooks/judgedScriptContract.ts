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
  | 'number_word_to_20'
  | 'number_word_to_120'
  | 'ordinal_word'
  | 'sentence_read_aloud'
  | 'shape_name'
  | 'manipulation'
  | 'letter_name'
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
    status: 'blocked',
    evidence:
      'LetterSpotter ruling: letter names are an unbenched homophonic class '
      + '(b/p/d/e/g…) — needs a Voice Studio bench before any pack uses them.',
  },
  open_set_word: {
    status: 'blocked',
    evidence:
      'Open-set production (rhyme generation etc.) has no bench; qa/di/BACKLOG.md item 16 '
      + 'keeps rhyme-studio behind a sitting for exactly this.',
  },
};

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
   *  'gesture' = a committed manipulation, described to the tutor by cue. */
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
