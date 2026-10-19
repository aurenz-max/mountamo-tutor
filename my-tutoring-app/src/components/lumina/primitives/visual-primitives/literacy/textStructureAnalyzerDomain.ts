/**
 * text-structure-analyzer's domain: the canonical structure vocabulary, the build gates that turn one passage into
 * spoken items, the ask, the key, the known misses and the scene. Pure; the boss (`textStructureAnalyzer.boss.ts`),
 * the levers and the component read it, and the generator imports its gates from here so both sides of the wire agree
 * on what is sayable.
 *
 * Every item is SAID, three ways over one printed passage the learner reads:
 *
 *   find-signal     the linking word of a numbered sentence   "Read sentence two. Which word links the ideas?" -> "because"
 *   name-structure  how the whole passage is organised        "How is it put together? Cause and Effect, Time Order, or Description?"
 *   place-idea      which labelled part an idea belongs in    "Listen: the river rose. Does that go with Cause, or Effect?"
 *
 * What the build owes, and why:
 *  - THE PASSAGE IS NEVER READ ALOUD. Decoding it is the skill, and a find-signal answer is a word in it, so the ask
 *    names a sentence by NUMBER and never says it. Cardinals, not ordinals: a time-order passage's linking words ARE
 *    ordinals ("First"), and "the first sentence" said the answer (live drive, 2026-08-17).
 *  - A FIND-SIGNAL SENTENCE CARRIES EXACTLY ONE CONNECTIVE, counted against the code-owned `TRANSITION_WORDS`, not the
 *    model's `signalWords`: a sentence with two has two right answers whatever the model listed, and it drops.
 *  - ONE PASSAGE, ONE STRUCTURE ASK. The payload has no challenge list, so a session asks the structure once, after the
 *    linking words (the evidence first).
 *  - THE LABELS ARE CANONICAL (`STRUCTURE_LABEL`, owned here) and every menu must be separable by ear; a mat label or an
 *    idea that cannot be said, or an idea that names its own mat, drops. Nothing backfills.
 *  - A PASSAGE THAT PRINTS ITS STRUCTURE'S NAME LOSES ITS STRUCTURE ASK (lever plan 2026-10-03 R6).
 *  - The easy option floor is THREE structures, band-clamped (grade 2 has two in band): a 1-in-2 menu on the run's only
 *    structure ask is a coin flip.
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { stableShuffle } from '../../../utils/choiceOrder';

// Re-exported so the generator imports its build gates from ONE address — both
// sides of the wire must agree on what is sayable.
export { opensWithSentinel };

/** The five structures, as the data enum spells them. */
export type StructureTypeId =
  | 'cause-effect'
  | 'compare-contrast'
  | 'problem-solution'
  | 'chronological'
  | 'description';

/** What the child is doing on this item. NOT the eval mode: the eval mode is the structure, which is the ANSWER of
 *  the structure ask, so nothing the tutor reads names it. */
export type TextStructureAction = 'find-signal' | 'name-structure' | 'place-idea';

export type TextStructureTier = 'easy' | 'medium' | 'hard';

/** The eval modes. Each runs all three actions; a structure belongs to exactly one. */
export type TextStructureMode = 'chronological_description' | 'cause_effect' | 'compare_contrast' | 'problem_solution';

// ── The canonical structure menu — owned here, imported by the generator ─────

/**
 * The label the child SAYS and the judge is handed. Canonical because a spoken
 * closed set cannot have its option strings authored per generation: one
 * "Cause/Effect Relationship" and the ask is unsayable, one "Sequence of
 * Events" beside "Order of Events" and no utterance has an honest home.
 *
 * "Time Order" replaces the click era's "Sequence / Time Order": a slash is a
 * printed convenience and reads as a stumble out loud.
 */
export const STRUCTURE_LABEL: Record<StructureTypeId, string> = {
  'cause-effect': 'Cause and Effect',
  'compare-contrast': 'Compare and Contrast',
  'problem-solution': 'Problem and Solution',
  chronological: 'Time Order',
  description: 'Description',
};

/** The printed gloss under each label. A fallback only — the generator's own
 *  kid-friendly wording is kept where it supplied one. Never spoken. */
export const STRUCTURE_GLOSS: Record<StructureTypeId, string> = {
  'cause-effect': 'One thing makes another thing happen.',
  'compare-contrast': 'How two things are alike and different.',
  'problem-solution': 'A problem is named, then ways to fix it.',
  chronological: 'Events told in the order they happen.',
  description: 'Details and features about one topic.',
};

export const ALL_STRUCTURE_TYPES = Object.keys(STRUCTURE_LABEL) as StructureTypeId[];

/**
 * How easily two structures are mistaken: 1 near (cause-effect and problem-solution), 3 far. Moved here from the
 * generator (lever plan 2026-10-03 step 4) so the runtime practice builder reads the same table.
 */
export const STRUCTURE_DISTANCE: Record<StructureTypeId, Partial<Record<StructureTypeId, number>>> = {
  'cause-effect': { 'problem-solution': 1, 'compare-contrast': 2, chronological: 3, description: 3 },
  'problem-solution': { 'cause-effect': 1, 'compare-contrast': 2, chronological: 3, description: 3 },
  'compare-contrast': { 'cause-effect': 2, 'problem-solution': 2, description: 2, chronological: 3 },
  chronological: { description: 2, 'cause-effect': 3, 'problem-solution': 3, 'compare-contrast': 3 },
  description: { 'compare-contrast': 2, chronological: 2, 'cause-effect': 3, 'problem-solution': 3 },
};
export const structureDistance = (a: StructureTypeId, b: StructureTypeId): number =>
  (a === b ? 0 : STRUCTURE_DISTANCE[a]?.[b] ?? 2);

export const isStructureType = (value: unknown): value is StructureTypeId =>
  typeof value === 'string' && (ALL_STRUCTURE_TYPES as string[]).includes(value);

/** The catalog mode a structure belongs to. A payload with no valid structure builds as cause_effect. */
export const textStructureModeOf = (structure: string | undefined): TextStructureMode =>
  structure === 'chronological' || structure === 'description' ? 'chronological_description'
    : structure === 'compare-contrast' ? 'compare_contrast' : structure === 'problem-solution' ? 'problem_solution' : 'cause_effect';

/**
 * ⭐ THE EASY-TIER OPTION FLOOR. Three, not two — see the axis-2 note in the
 * header. Exported because the generator applies it and this module is where the
 * reason is written down.
 */
export const MIN_STRUCTURE_OPTIONS_EASY = 3;

// ── The item ────────────────────────────────────────────────────────────────

export interface TextStructureItem extends JudgedScriptItem {
  action: TextStructureAction;
  tier: TextStructureTier;
  /** The session's eval mode (`textStructureModeOf`). */
  mode: TextStructureMode;
  /** The answer, said out loud: a signal word, a structure label, a mat name. */
  answer: string;
  /**
   * The spoken/printed menu, in screen order. `[]` on `find-signal` — a
   * transition word is produced, not chosen, and printing candidates would turn
   * the pack's one production item into a third recognition item.
   */
  choices: string[];
  /** Index-aligned printed gloss for `choices`; '' where there is none. */
  choiceNotes: string[];
  /** Nearest misconception, retained independently of randomized screen order. */
  diagnosticWrong?: string;
  /**
   * `find-signal`: the sentence the child must read, PRINTED and never spoken.
   * `place-idea`: the excerpt the tutor reads aloud.
   * `name-structure`: '' — the stimulus is the whole passage.
   */
  stimulusText: string;
  /** 0-based sentence index for `find-signal`; -1 elsewhere. */
  sentenceIndex: number;
  /** Does the ASK name the choices out loud? False only at `hard` above grade 2
   *  — the menu is printed and a reader is expected to read it. */
  namesChoices: boolean;
  /** Perception tier lever (#1), rebuilt answer-free: highlight WHICH SENTENCE
   *  to look in. Never the signal word — that is the answer. */
  showFocusSentence: boolean;
  /** A practice item from a simplify lever: its sentence or mini passage is on a card, not in the passage. */
  onCard?: boolean;
  /** A `structure_practice` item only: the mini passage on its card. */
  practiceText?: string;
  /** The passage title and the session's linking words, which the misses may quote (said_topic, said_signal_word). */
  title?: string;
  signals?: readonly string[];
}

/** Every item is SAID. Nothing in this pack answers with its hands. */
export const answerKindFor = (_action: TextStructureAction): 'voice' => 'voice';

/** Standing gate 1. See the header for why `place-idea` is the BENCHED class
 *  and only `name-structure` reaches for the build-ahead one. */
export const responseClassFor = (action: TextStructureAction): ResponseClassId =>
  action === 'name-structure' ? 'closed_set_choice' : 'short_spoken_word';

// ── Session shape ───────────────────────────────────────────────────────────

/**
 * A judged round costs an ask, a think, a verdict and an affirmation, so a
 * passage with eight signal words and eight key ideas is a seventeen-ask
 * sitting. These hold the run at the family's shape (6-12 asks) without
 * shortening any individual phase to nothing. Truncation is NOT a build-gate
 * drop and is reported separately (`itemsFromPayload` returns both).
 */
export const MAX_SIGNAL_ITEMS = 4;
export const MAX_MAP_ITEMS = 4;

/** One breath, and a name the child can hold while they answer. */
export const MAX_LABEL_WORDS = 3;
export const MAX_LABEL_CHARS = 24;
/** "on the other hand" is four words; nothing longer is a signal word. */
export const MAX_SIGNAL_WORDS = 4;
export const MAX_SIGNAL_CHARS = 24;
/** The excerpt the tutor reads aloud before asking where it belongs. */
export const MAX_IDEA_WORDS = 14;
/** Sentence positions the ask can name. Passages are 4-10 sentences; a sentence
 *  past this has no sayable position, so its item drops rather than being
 *  renumbered. */
export const MAX_ORDINAL = 10;
/**
 * Two labels that differ only by a single letter ("Item A" / "Item B") pass a
 * word-level separability check and fail an ear. A distinguishing word must be
 * a WORD.
 */
export const MIN_DISTINGUISHING_CHARS = 3;

/**
 * ⭐ CARDINALS, NOT ORDINALS — and this is a live-drive finding, not a style
 * choice (drive 1, chronological_description, 2026-08-17).
 *
 * The ask used to name the sentence by ordinal ("Read the FIRST sentence"), and
 * the flat find-signal leak oracle caught it 2/2 on the very first chronological
 * run as a CONFIRMED HIGH `di-answer-leak-in-ask`: **a chronological passage's
 * signal words ARE ordinals** — first, then, next, finally — so on the
 * archetypal item, where "First" opens sentence one, the ask said the answer out
 * loud immediately before asking for it.
 *
 * It is the single worst place this could have landed: `chronological_description`
 * is the Tier-1 mode and the grade-2 band floor, so the most common session in
 * the primitive's catalog was the leaking one. Cardinals collide with nothing in
 * `TRANSITION_WORDS` and are easier for a child to count besides.
 *
 * The mechanism is fixed here; `askIsAnswerFree` below closes the CHANNEL, so a
 * future collision from some other direction drops its item instead of shipping.
 */
const SENTENCE_NUMBERS = [
  'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
];

export const sentenceNumberFor = (index: number): string | null =>
  SENTENCE_NUMBERS[index] ?? null;

// ── Small primitives ────────────────────────────────────────────────────────

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

const wordsIn = (value: string): number => sanitize(value).split(' ').filter(Boolean).length;

/**
 * Trailing sentence punctuation off an excerpt.
 *
 * The tutor says `Listen: <excerpt>. Does that go with …`, and the generator
 * sometimes ends an excerpt with its own full stop — which produced
 * "Listen: Animals cut down heavy trees.. Does that go with Cause, or Effect?"
 * on the first live tier probe (2026-08-16). A doubled stop is a stumble in the
 * tutor's mouth, and it is invisible to every gate in this family because it is
 * punctuation rather than a word. Stripped at BUILD time so the canonical
 * `stimulusText` is what the ask, the diagnosis and the harness all see.
 */
const stripEnd = (value: string): string => sanitize(value).replace(/[.,;:!?]+$/, '');

/** No double quotes anywhere: every one of these strings is interpolated into a
 *  `Say exactly: "…"` span, and an embedded quote CLOSES the span early so
 *  everything after it becomes judge-side prose. */
const SPEECH_SAFE_RE = /^[A-Za-z][A-Za-z' -]*$/;

const speakable = (value: string, maxChars: number, maxWords: number): boolean => {
  const text = sanitize(value);
  if (!text || text.length > maxChars) return false;
  if (!SPEECH_SAFE_RE.test(text)) return false;
  if (wordsIn(text) > maxWords) return false;
  return !opensWithSentinel(text);
};

/** Is this a signal word a child can say back? */
export const isSayableSignalWord = (word: string): boolean =>
  speakable(word, MAX_SIGNAL_CHARS, MAX_SIGNAL_WORDS);

/**
 * Content words of this family's own invariant prose (the asks, the lever cards). A mat labelled "Ideas" or
 * "Passage" would collide with the asks' own words, and it is a poor mat label besides. Dropping it is cheaper
 * than exempting our prose (letter-spotter's ruling: fix the collision, never switch the check off).
 */
const PACK_PROSE_TOKENS = new Set([
  'word', 'words', 'idea', 'ideas', 'sentence', 'sentences', 'passage',
  'turn', 'turns', 'listen', 'screen', 'chart', 'part', 'parts',
]);

/** Is this a mat label a child can hear, hold and say back? */
export const isSayableLabel = (label: string): boolean => {
  if (!speakable(label, MAX_LABEL_CHARS, MAX_LABEL_WORDS)) return false;
  return !sanitize(label)
    .toLowerCase()
    .split(' ')
    .some((token) => PACK_PROSE_TOKENS.has(token));
};

const normalizeForEar = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

const earWords = (value: string): string[] => normalizeForEar(value).split(' ').filter(Boolean);

/**
 * The words of each structure's NAME that a passage of that structure may not print (lever plan 2026-10-03 R6,
 * text-structure-analyzer D1). "Time Order" has none: "time" and "order" are everyday words in any passage, and a
 * chronological passage that says "at that time" is not telling the child the structure's name.
 */
export const LABEL_EAR_WORDS: Record<StructureTypeId, readonly string[]> = {
  'cause-effect': ['cause', 'causes', 'caused', 'effect', 'effects'],
  'compare-contrast': ['compare', 'compared', 'compares', 'comparing', 'contrast', 'contrasts'],
  'problem-solution': ['problem', 'problems', 'solution', 'solutions'],
  chronological: [],
  description: ['describe', 'describes', 'description'],
};

/** True when `text` prints a word of `structure`'s name (R6). */
export const passageNamesStructure = (text: string, structure: StructureTypeId): boolean => {
  const banned = new Set(LABEL_EAR_WORDS[structure]);
  return earWords(text).some(w => banned.has(w));
};

/**
 * Can every option be told from every other BY EAR? decodable-reader's gate,
 * sharpened by one clause this pack needs: the distinguishing word must be at
 * least `MIN_DISTINGUISHING_CHARS` long. The generator's own prompt used to
 * suggest "Item A / Item B" as compare-contrast mats — a pair that carries a
 * unique token each and is indistinguishable the moment a child says it aloud.
 *
 * Exported so the generator runs the same gate on its side of the wire.
 */
/**
 * ⭐ DOES THIS ITEM'S OWN ASK CONTAIN ITS OWN ANSWER? The general form of the
 * ordinal collision (see `SENTENCE_NUMBERS`), added so the CHANNEL is closed
 * rather than the one symptom.
 *
 * The menu clause is subtracted first, because a closed-set ask names its
 * options BY DESIGN — that is the question working, not a leak (push-pull-arena's
 * shape). What is left is our own prose, and our own prose may never say the
 * answer. An item that fails this DROPS: the live drive proved this class of
 * collision is real, arrives from directions nobody predicts, and is invisible
 * to every other gate in the family because the ask reads perfectly well.
 */
export const askIsAnswerFree = (ask: string, answer: string, menu?: string): boolean => {
  const scanned = normalizeForEar(menu ? ask.replace(menu, ' ') : ask);
  const needle = normalizeForEar(answer);
  if (!needle) return true;
  return !new RegExp(`(^| )${escapeRegExp(needle)}( |$)`).test(scanned);
};

export const optionsEarSeparable = (options: readonly string[]): boolean =>
  options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : earWords(o))));
    return earWords(option).some(
      (word) => word.length >= MIN_DISTINGUISHING_CHARS && !others.has(word),
    );
  });

// ── The passage: sentences, and where the connectives are ───────────────────

export interface PassageSentence {
  index: number;
  text: string;
  /** Char offsets into the ORIGINAL passage, so the stage can highlight it. */
  start: number;
  end: number;
}

/**
 * Split a passage into sentences, keeping offsets. Deliberately simple: an
 * abbreviation ("Dr. Chen") mis-splits, and a mis-split costs at most one
 * dropped item — never a wrong ask, because every gate below re-checks the span
 * it actually produced.
 */
export const splitSentences = (passage: string): PassageSentence[] => {
  const out: PassageSentence[] = [];
  const re = /[^.!?]+[.!?]+|[^.!?]+$/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(passage)) !== null) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const text = raw.trim();
    if (!text) continue;
    out.push({
      index: out.length,
      text,
      start: match.index + lead,
      end: match.index + lead + text.length,
    });
  }
  return out;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * First WORD-BOUNDED occurrence of `needle` in `haystack`, or -1.
 *
 * The click-era `recomputeSignalWordOffsets` used a bare `indexOf` on the
 * lowercased passage, so the signal word "so" matched inside "also" and the
 * highlight landed on the wrong span. Harmless while a highlight was decoration;
 * load-bearing now that the SENTENCE a match lands in decides which item the
 * child is asked. Lookbehind is avoided so the expression is safe on every
 * runtime we ship to.
 */
export const wordBoundedIndexOf = (haystack: string, needle: string): number => {
  const term = sanitize(needle);
  if (!term) return -1;
  const re = new RegExp(`(^|[^A-Za-z])(${escapeRegExp(term)})(?![A-Za-z])`, 'i');
  const match = re.exec(haystack);
  return match ? match.index + match[1].length : -1;
};

/**
 * Recompute every signal word's offsets from the passage text, DROPPING any the
 * passage does not actually contain. LLMs cannot count characters, so the model
 * is told not to try and this is the single source of the spans.
 *
 * Exported for the generator, which calls it in place of its own copy — the two
 * sides of this wire must agree on which spans exist at all.
 */
export const locateSignalWords = <T extends { word: string }>(
  passage: string,
  signalWords: readonly T[],
): Array<T & { startIndex: number; endIndex: number }> => {
  const located: Array<T & { startIndex: number; endIndex: number }> = [];
  const seen = new Set<string>();
  for (const sw of signalWords) {
    const word = sanitize(sw.word);
    const key = word.toLowerCase();
    // A word listed twice produces one askable item at most — the second entry
    // would point at the same span and ask the same question.
    if (!word || seen.has(key)) continue;
    const idx = wordBoundedIndexOf(passage, word);
    if (idx < 0) continue;
    seen.add(key);
    located.push({ ...sw, word, startIndex: idx, endIndex: idx + word.length });
  }
  return located;
};

/**
 * ⭐ THE CODE-OWNED CONNECTIVE LIST — the gate that makes phase 1 decidable.
 *
 * It is NOT the generator's `signalWords` array, and that is the whole point:
 * "which word links the ideas?" has as many right answers as the SENTENCE has
 * connectives, and the model's list only records the ones it chose to write
 * down. A child who names the unlisted one is right and would be refused.
 *
 * Longest-first, so "as a result" is counted once rather than as "as" + a
 * spurious second hit. Deliberately limited to words a child would plausibly
 * offer when asked for the linking word — content-ish members of the
 * generator's own families ("includes", "features", "characteristics") are
 * absent, because nobody answers "features" to this question and their presence
 * would drop half the descriptive passages in the catalog.
 */
export const TRANSITION_WORDS: readonly string[] = [
  // multi-word first — the matcher takes the longest hit at each position
  'on the other hand', 'as a result', 'for example', 'for instance', 'such as',
  'in addition', 'in contrast', 'in conclusion', 'the problem is', 'one solution',
  'to fix this', 'solved by', 'due to',
  // single words
  'because', 'since', 'so', 'therefore', 'thus', 'consequently',
  'however', 'but', 'although', 'though', 'instead', 'similarly', 'likewise',
  'unlike', 'whereas',
  'first', 'second', 'third', 'next', 'then', 'after', 'afterward', 'before',
  'finally', 'lastly', 'later', 'meanwhile', 'during',
  'also', 'another',
];

const TRANSITIONS_LONGEST_FIRST = [...TRANSITION_WORDS].sort((a, b) => b.length - a.length);

/**
 * How many DISTINCT connectives does this sentence carry? Overlapping matches
 * are counted once (a hit at a position consumes it), so "as a result" is one
 * connective and not two.
 */
export const countConnectives = (sentence: string): number => {
  const text = ` ${normalizeForEar(sentence)} `;
  const claimed: Array<[number, number]> = [];
  let count = 0;
  for (const term of TRANSITIONS_LONGEST_FIRST) {
    const needle = ` ${term} `;
    let from = 0;
    for (;;) {
      const at = text.indexOf(needle, from);
      if (at < 0) break;
      const span: [number, number] = [at, at + needle.length];
      const overlaps = claimed.some(([s, e]) => span[0] < e && s < span[1]);
      if (!overlaps) {
        claimed.push(span);
        count += 1;
      }
      from = at + 1;
    }
  }
  return count;
};

// ── The payload, duck-typed (this module never imports the component) ────────

export interface TextStructurePayloadLike {
  title?: string;
  passage?: string;
  gradeLevel?: string;
  structureType?: string;
  signalWords?: Array<{ word: string; startIndex?: number; endIndex?: number }>;
  structureOptions?: Array<{ type: string; label?: string; description?: string }>;
  templateRegions?: Array<{ regionId: string; label: string }>;
  keyIdeas?: Array<{ ideaId: string; text: string; correctRegionId: string }>;
  /** Support-tier stamps. All optional — absent means the full-help render. */
  supportTier?: TextStructureTier;
  nameStrategy?: boolean;
  maxStructureOptions?: number;
  /** easy: ONE key idea shown already placed as a worked example. It is
   *  EXCLUDED from the asked items — an exemplar is not a question. */
  anchorIdeaId?: string;
}

export interface TextStructureBuildResult {
  items: TextStructureItem[];
  /** Askable candidates the build gates REFUSED — a generator signal, not a
   *  harness one. Never backfilled. */
  dropped: number;
  /** Askable items held back by the session-length caps. NOT a drop: the
   *  content was fine, the sitting was long (no silent caps). */
  truncated: number;
  /** The sentences of the passage, for the stage's highlight and printing. */
  sentences: PassageSentence[];
  /** Askable ideas held back by the cap: never asked, so the levers may show one filed or practise on it. */
  spares: SpareIdea[];
}

export interface SpareIdea { id: string; text: string; region: string }

const EMPTY_BUILD: TextStructureBuildResult = {
  items: [], dropped: 0, truncated: 0, sentences: [], spares: [],
};

/**
 * Keep at most `limit` ideas, and make sure the kept set still reaches two mats.
 *
 * word-sorter's lesson, and the same defect: take the first four of six and a
 * two-region template can lose a region entirely, which makes "Cause, or
 * Effect?" answerable with "Cause" every single round. A missing region's first
 * idea displaces the last kept idea of an over-represented one — a SELECTION
 * over content that already passed every gate, never a backfill of content that
 * failed one.
 */
const capCoveringEveryRegion = <T extends { correctRegionId: string }>(
  ideas: T[],
  regionIds: string[],
  limit: number,
): T[] => {
  if (ideas.length <= limit) return ideas;
  const kept = ideas.slice(0, limit);
  for (const regionId of regionIds) {
    if (kept.some((i) => i.correctRegionId === regionId)) continue;
    const candidate = ideas.slice(limit).find((i) => i.correctRegionId === regionId);
    if (!candidate) continue;
    const counts = new Map<string, number>();
    for (const i of kept) counts.set(i.correctRegionId, (counts.get(i.correctRegionId) ?? 0) + 1);
    const displaceAt = kept
      .map((idea, i) => [idea, i] as const)
      .reverse()
      .find(([idea]) => (counts.get(idea.correctRegionId) ?? 0) > 1)?.[1];
    if (displaceAt == null) continue;
    kept[displaceAt] = candidate;
  }
  return kept;
};

/**
 * Every judged item this passage can ask, in the order a DI sitting runs them:
 * gather the evidence, name the structure, then use the structure to organise.
 *
 * Nothing here backfills. A placeholder in a judged loop becomes a spoken ask
 * the tutor has to stand behind, so an item that cannot be asked cleanly is
 * DROPPED and its phase simply has one fewer round — or none.
 */
export const itemsFromPayload = (
  payload: TextStructurePayloadLike,
): TextStructureBuildResult => {
  const passage = sanitize(payload.passage);
  if (!passage) return EMPTY_BUILD;

  const tier: TextStructureTier = payload.supportTier ?? 'medium';
  const mode = textStructureModeOf(payload.structureType);
  const grade = sanitize(payload.gradeLevel);
  /**
   * BAND FLOOR beats the tier. A grade-2 reader working an informational
   * passage should not also have to decode an abstract three-option menu, so at
   * the bottom rung the ask names the choices at every tier. What `hard` still
   * withholds there is the strategy, not the menu. (word-sorter's Kindergarten
   * rule, one band up.)
   */
  const isBandFloor = grade === '2' || grade === '' || grade === 'K' || grade === '1';
  const namesChoices = isBandFloor || tier !== 'hard';
  const showFocusSentence = tier !== 'hard';

  const items: TextStructureItem[] = [];
  const spares: SpareIdea[] = [];
  let dropped = 0;
  let truncated = 0;

  const sentences = splitSentences(passage);

  // ── Phase 1: the linking words ────────────────────────────────────────────
  const located = locateSignalWords(passage, payload.signalWords ?? []);
  const signalCandidates: TextStructureItem[] = [];
  const claimedSentences = new Set<number>();

  for (const sw of located) {
    const sentence = sentences.find((s) => sw.startIndex >= s.start && sw.startIndex < s.end);
    if (!sentence) { dropped += 1; continue; }
    if (!sentenceNumberFor(sentence.index)) { dropped += 1; continue; }
    if (!isSayableSignalWord(sw.word)) { dropped += 1; continue; }
    // One ask per sentence: a second signal word in the same sentence would be
    // the same question with a different right answer.
    if (claimedSentences.has(sentence.index)) { dropped += 1; continue; }
    // ⭐ The code-owned gate. More than one connective in the sentence means
    // more than one honest answer, whatever the model listed.
    if (countConnectives(sentence.text) !== 1) { dropped += 1; continue; }
    claimedSentences.add(sentence.index);
    signalCandidates.push({
      id: `signal::${sentence.index}::${sw.word.toLowerCase().replace(/\s+/g, '-')}`,
      action: 'find-signal',
      answerKind: 'voice',
      responseClass: responseClassFor('find-signal'),
      tier,
      mode,
      answer: sw.word,
      choices: [],
      choiceNotes: [],
      stimulusText: sentence.text,
      sentenceIndex: sentence.index,
      namesChoices: false,
      showFocusSentence,
    });
  }
  truncated += Math.max(0, signalCandidates.length - MAX_SIGNAL_ITEMS);
  items.push(...signalCandidates.slice(0, MAX_SIGNAL_ITEMS));

  // ── Phase 2: name the structure ───────────────────────────────────────────
  const structureType = payload.structureType;
  if (isStructureType(structureType) && passageNamesStructure(passage, structureType)) {
    // R6 (lever plan 2026-10-03): "The problem is" in a problem-solution passage makes naming the structure word
    // matching. The phrase stays a countable signal; the structure ask is dropped.
    dropped += 1;
  } else if (isStructureType(structureType)) {
    // Canonical labels, LLM glosses. The option ORDER is the generator's (axis 2
    // orders the distractors by confusability and the trim keeps the leading
    // ones), so it is preserved exactly — only the strings are canonicalised.
    const glossOf = new Map<StructureTypeId, string>();
    for (const opt of payload.structureOptions ?? []) {
      if (isStructureType(opt?.type)) glossOf.set(opt.type, sanitize(opt.description));
    }
    const ordered: StructureTypeId[] = [];
    for (const opt of payload.structureOptions ?? []) {
      if (isStructureType(opt?.type) && !ordered.includes(opt.type)) ordered.push(opt.type);
    }
    if (!ordered.includes(structureType)) ordered.unshift(structureType);

    const cap = payload.maxStructureOptions;
    const kept = cap && cap < ordered.length
      // The correct option is never trimmed away; distractors are dropped from
      // the back, which is the order axis 2 built them in.
      ? [structureType, ...ordered.filter((t) => t !== structureType)].slice(0, Math.max(2, cap))
      : ordered;
    // Restore the generator's screen order over whatever survived the trim.
    const menu = ordered.filter((t) => kept.includes(t));

    const labels = menu.map((t) => STRUCTURE_LABEL[t]);
    if (menu.length < 2 || !optionsEarSeparable(labels)) {
      dropped += 1;
    } else {
      items.push({
        id: `structure::${structureType}`,
        action: 'name-structure',
        answerKind: 'voice',
        responseClass: responseClassFor('name-structure'),
        tier,
        mode,
        answer: STRUCTURE_LABEL[structureType],
        choices: labels,
        choiceNotes: menu.map((t) => glossOf.get(t) || STRUCTURE_GLOSS[t]),
        diagnosticWrong: labels.find((label) => label !== STRUCTURE_LABEL[structureType]),
        stimulusText: '',
        sentenceIndex: -1,
        namesChoices,
        showFocusSentence: false,
      });
    }
  } else {
    dropped += 1;
  }

  // ── Phase 3: place the ideas ──────────────────────────────────────────────
  const regions = (payload.templateRegions ?? [])
    .map((r) => ({ regionId: sanitize(r?.regionId), label: sanitize(r?.label) }))
    .filter((r) => !!r.regionId && isSayableLabel(r.label));
  const regionLabels = regions.map((r) => r.label);
  const distinctLabels = new Set(regionLabels.map((l) => l.toLowerCase())).size === regions.length;

  if (regions.length >= 2 && distinctLabels && optionsEarSeparable(regionLabels)) {
    const labelOf = new Map(regions.map((r) => [r.regionId, r.label]));
    // Every content word of every mat label — an excerpt containing one answers
    // the question by word-match rather than by analysis.
    const labelTokens = new Set(regionLabels.flatMap(earWords));

    const askable = (payload.keyIdeas ?? [])
      .map((idea) => ({
        ideaId: sanitize(idea?.ideaId),
        // The tutor reads this INSIDE a sentence of its own, so its trailing
        // full stop would double up — see `stripEnd`.
        text: stripEnd(idea?.text ?? ''),
        correctRegionId: sanitize(idea?.correctRegionId),
      }))
      .filter((idea) => {
        if (!idea.ideaId || !idea.text || !labelOf.has(idea.correctRegionId)) return false;
        // The anchor is the worked example shown pre-placed at `easy`; it is
        // material on the page, not a question.
        if (payload.anchorIdeaId && idea.ideaId === payload.anchorIdeaId) return false;
        if (wordsIn(idea.text) > MAX_IDEA_WORDS) return false;
        if (opensWithSentinel(idea.text)) return false;
        // ⭐ THE EXCERPT MAY NOT NAME ITS OWN MAT. "The problem was the flooding"
        // under a mat labelled "Problem" is answerable by hearing one word.
        if (earWords(idea.text).some((w) => labelTokens.has(w))) return false;
        return true;
      });
    dropped += Math.max(
      0,
      (payload.keyIdeas ?? []).filter((i) => i?.ideaId !== payload.anchorIdeaId).length
        - askable.length,
    );

    const kept = capCoveringEveryRegion(askable, regions.map((r) => r.regionId), MAX_MAP_ITEMS);
    truncated += Math.max(0, askable.length - kept.length);
    spares.push(...askable.filter((idea) => !kept.includes(idea))
      .map((idea) => ({ id: idea.ideaId, text: idea.text, region: labelOf.get(idea.correctRegionId) as string })));
    // One answer repeated every round is a placement the child can pass without
    // placing — the same defect a one-option menu is.
    const regionsReached = new Set(kept.map((i) => i.correctRegionId)).size;
    if (regionsReached >= 2) {
      for (const idea of kept) {
        items.push({
          id: `idea::${idea.ideaId}`,
          action: 'place-idea',
          answerKind: 'voice',
          responseClass: responseClassFor('place-idea'),
          tier,
          mode,
          answer: labelOf.get(idea.correctRegionId) as string,
          choices: regionLabels,
          choiceNotes: regionLabels.map(() => ''),
          stimulusText: idea.text,
          sentenceIndex: -1,
          namesChoices,
          showFocusSentence: false,
        });
      }
    } else {
      dropped += kept.length;
    }
  } else {
    dropped += (payload.keyIdeas ?? []).length;
  }

  /**
   * ⭐ THE LAST GATE: no item may ship whose own ask says its own answer.
   *
   * Run over the assembled items rather than inside each branch, because the
   * collision is a property of the finished UTTERANCE and can arrive from any
   * direction — the one the live drive found came from the SCOPING DEVICE
   * ("Read the first sentence" against the answer "First"), which no per-branch
   * check would have been looking for. The menu clause is subtracted first: a
   * closed-set ask names its options by design.
   */
  const answerFree = items.filter((item) => {
    if (askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))) return true;
    // eslint-disable-next-line no-console
    console.warn(
      `[text-structure-analyzer] dropped "${item.id}" — its ask contains its own answer `
      + `("${item.answer}"). An ask that says the answer is broken, not easier.`,
    );
    return false;
  });
  dropped += items.length - answerFree.length;

  if (truncated > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[text-structure-analyzer] session held back ${truncated} askable item(s) — `
      + `caps are ${MAX_SIGNAL_ITEMS} linking words and ${MAX_MAP_ITEMS} ideas per sitting.`,
    );
  }

  // What the misses may quote beyond the item: the passage title and the session's linking words.
  const title = sanitize(payload.title) || undefined;
  const signals = answerFree.filter((item) => item.action === 'find-signal').map((item) => item.answer);
  return { items: answerFree.map((item) => ({ ...item, title, signals })), dropped, truncated, sentences, spares };
};

/** The build gates' items with the structure menu in its per-instance screen order (the lesson's, and the boss's). */
export function textStructureItems(payload: TextStructurePayloadLike, instanceId: string): TextStructureBuildResult {
  const built = itemsFromPayload(payload);
  return {
    ...built,
    items: built.items.map((item) => {
      if (item.action !== 'name-structure' || item.choices.length < 2) return item;
      const ordered = stableShuffle(
        item.choices.map((choice, index) => ({ choice, note: item.choiceNotes[index] ?? '' })),
        `${instanceId}|${item.id}|${item.choices.join('|')}`,
      );
      return { ...item, choices: ordered.map(({ choice }) => choice), choiceNotes: ordered.map(({ note }) => note) };
    }),
  };
}

// ── Small speakable helpers ─────────────────────────────────────────────────

/** "Cause and Effect, Time Order, or Description?" — the spoken menu, and the
 *  ONE span the leak oracle subtracts. */
export const choicesPhrase = (item: TextStructureItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// Every ask carries varying content (a new sentence number, a new idea) or is the
// only item of its action, so no two consecutive asks are identical.
//
// ⚠️ THE SENTENCE IS NEVER READ ALOUD. Decoding the passage is the skill and
// these are readers; speaking it would also hand over the answer word two
// seconds before asking for it.

export const askFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      // CARDINAL, never an ordinal — "the first sentence" said the answer out
      // loud on every chronological passage. See `SENTENCE_NUMBERS`.
      if (item.onCard) return 'Read the sentence on the card. Which word links the ideas?';
      return `Read sentence ${sentenceNumberFor(item.sentenceIndex) ?? 'one'}. Which word links the ideas?`;
    case 'name-structure':
      if (item.onCard) return `Read the short passage on the card. How is it put together? ${choicesPhrase(item)}`;
      return item.namesChoices
        ? `Think about the whole passage. How is it put together? ${choicesPhrase(item)}`
        // `hard` above the band floor: the structures are printed and the tier
        // withholds the criterion, so the menu is not spoken. The ask still
        // STATES its problem — an ask that says nothing is broken, not terser.
        : 'Think about the whole passage. How is it put together? Say the one you pick.';
    case 'place-idea':
    default:
      return item.namesChoices
        ? `Listen: ${item.stimulusText}. Does that go with ${choicesPhrase(item)}`
        : `Listen: ${item.stimulusText}. Which part does that belong in?`;
  }
};

/** The ask's menu clause on a step that says its choices: the one span the build's leak gate subtracts. */
export const leakExemptSpanFor = (item: TextStructureItem): string | undefined =>
  item.action !== 'find-signal' && item.namesChoices ? choicesPhrase(item) : undefined;

// ── The key ─────────────────────────────────────────────────────────────────

/**
 * The key the tutor judges each item with. find-signal: the linking word, alone or inside a little phrase; any other
 * word of the sentence is wrong. name-structure: the label from the printed menu (a menu key where the ask says it),
 * its distinguishing part or its place in the list; a close structure is wrong. place-idea: the part's name, alone or
 * in a phrase; the idea said back is no answer.
 */
export function textStructureKey(item: TextStructureItem): SpokenKey {
  const menu = item.namesChoices && item.choices.length ? { menu: item.choices } : {};
  switch (item.action) {
    case 'find-signal':
      return {
        answer: item.answer, alsoAccept: [`the word ${item.answer}`],
        acceptRule: 'It may come inside a little phrase.',
        signatureError: `Any other word of "${item.stimulusText}" is wrong: words that name things and actions are not linking words.`,
      };
    case 'name-structure':
      return {
        answer: item.answer, alsoAccept: [], ...menu,
        acceptRule: 'The part of the label that tells it apart from the other choices counts, and so does its place in the '
          + `printed list (${item.choices.map((c, i) => `${i + 1}) ${c}`).join(', ')}).`,
        signatureError: 'A different structure is wrong, even a close one.',
      };
    case 'place-idea':
    default:
      return {
        answer: item.answer, alsoAccept: [`the ${item.answer}`, `it goes in ${item.answer}`], ...menu,
        signatureError: `Saying the idea back ("${item.stimulusText}") names no part and is not an answer; nor is another part `
          + `(parts: ${item.choices.join(', ')}).`,
      };
  }
}

// ── Known misses ────────────────────────────────────────────────────────────

/** What a wrong spoken answer shows (handoff 20 Part B), by action; the lever table 2026-10-03 adds the last three. */
export type SpokenTextStructureMiss = 'content_word' | 'other_structure' | 'other_part' | 'said_idea_back'
  | 'not_in_sentence' | 'said_topic' | 'said_signal_word';

/** Words of four letters or more that name no thing or action, kept out of `content_word`'s examples. */
const SMALL_WORDS = new Set(['that', 'this', 'with', 'into', 'from', 'there', 'then', 'they', 'their', 'when', 'were', 'have', 'already', 'across', 'onto', 'over']);

/** Linking words a child might offer that a sentence does not use, for `not_in_sentence`'s examples. */
const COMMON_LINKS = ['then', 'because', 'but', 'so', 'next', 'also', 'after'];

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: another word of the sentence
 * that is not the linking word (find-signal); another printed structure, the topic or a linking word
 * (name-structure); the other part or the idea said back (place-idea). The topic is the passage title and the
 * linking words are the session's, both stamped on the item by the build.
 */
export function textStructureSpokenMisses(item: TextStructureItem): KnownMiss[] {
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  const sessionSignals = item.signals ?? [];
  switch (item.action) {
    case 'find-signal': {
      const signal = item.answer.toLowerCase().split(/\s+/);
      const words = (item.stimulusText.toLowerCase().match(/[a-z']+/g) ?? []).filter(w => !signal.includes(w) && w.length > 3 && !SMALL_WORDS.has(w));
      const inSentence = new Set(item.stimulusText.toLowerCase().match(/[a-z']+/g) ?? []);
      const absent = [...sessionSignals, ...COMMON_LINKS].map(w => w.toLowerCase())
        .filter((w, i, all) => all.indexOf(w) === i && !w.split(' ').some(x => inSentence.has(x)));
      return [{ id: 'content_word', pattern: `The linking word in "${item.stimulusText}" is "${item.answer}". The learner's answer is a different word from that sentence, one that names a thing, an action or a description.`,
        examples: words.slice(0, 2) },
      ...(absent.length ? [{ id: 'not_in_sentence', pattern: `The linking word in "${item.stimulusText}" is "${item.answer}". The learner's answer is a word that is not in that sentence: another sentence's word, or a linking word this sentence does not use.`,
        examples: absent.slice(0, 2) }] : [])];
    }
    case 'name-structure': {
      const others = item.choices.filter(c => c !== item.answer);
      const topic = (item.title?.match(/[A-Za-z]{4,}/g) ?? []).filter(w => !/^(how|what|why|when|with|from|that|this)$/i.test(w));
      const signals = sessionSignals.filter(w => !others.some(o => o.toLowerCase().includes(w.toLowerCase())));
      return [
        ...(others.length ? [{ id: 'other_structure', pattern: `The passage is organised as ${item.answer}. The learner's answer is another printed structure: ${quote(others)}.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_topic', pattern: `The passage is organised as ${item.answer}. The learner names what the passage is about (its topic) and no structure.`,
          ...(topic.length ? { examples: topic.slice(0, 2).map(w => w.toLowerCase()) } : {}) },
        { id: 'said_signal_word', pattern: `The passage is organised as ${item.answer}. The learner says a linking word from the passage, such as ${signals.length ? quote(signals.slice(0, 2)) : '"because"'}, and no structure.`,
          examples: (signals.length ? signals : ['because']).slice(0, 2) },
      ];
    }
    case 'place-idea':
    default: {
      const others = item.choices.filter(c => c !== item.answer);
      return [
        ...(others.length ? [{ id: 'other_part', pattern: `The idea "${item.stimulusText}" goes with ${item.answer}. The learner's answer is ${quote(others)}, another part.`,
          examples: others.slice(0, 2) }] : []),
        { id: 'said_idea_back', pattern: `The learner says the idea back ("${item.stimulusText}") without naming a part.`, examples: [item.stimulusText] },
      ];
    }
  }
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** The id suffix of a practice item a simplify lever opens (`textStructureAnalyzerLevers.ts`). */
export const PRACTICE_SUFFIX = '~simpler';

/** What is drawn: the passage, the asked sentence's ring, the printed menu or the idea card above the parts, and a
 *  practice card while one is open. Never a linking word or a structure before credit. */
export function textStructureScene(item: TextStructureItem, passage: string): SceneOf {
  const facts: Record<string, string> = { ...textFacts('passage', passage) };
  if (item.action === 'find-signal' && item.showFocusSentence && !item.onCard) facts.focus = 'The asked sentence is highlighted in the passage.';
  if (item.action === 'name-structure') facts.menu = `Printed structures: ${item.choices.join(', ')}.`;
  if (item.action === 'place-idea') facts.shown = `The idea card "${item.stimulusText}" above the labelled parts: ${item.choices.join(', ')}.`;
  facts.constraints = 'Never read the passage or a sentence of it aloud: reading it is the skill. Name a sentence by its '
    + 'number ("sentence two"), never "first" or "next". The idea in a place-idea ask and a model card are not the passage. '
    + 'Nothing on screen marks a linking word or a structure until the answer is credited.';
  if (item.id.endsWith(PRACTICE_SUFFIX)) {
    const card = item.practiceText ?? (item.action === 'find-signal' ? item.stimulusText : '');
    facts.practice = `An easier practice item, ungraded. The full item comes back after it.${card
      ? ` On the card, for the learner to read (never read it aloud): "${card}"` : ''}`;
  }
  return { objects: [], facts };
}

// ── Harness answer material ─────────────────────────────────────────────────

/** Content words of a sentence, never the answer and never a linking word: find-signal's plainly wrong answer. */
const contentWordsOf = (sentence: string, answer: string): string[] => {
  const answerWords = new Set(earWords(answer));
  const transitions = new Set(TRANSITION_WORDS);
  return earWords(sentence)
    .filter((w) => w.length >= 4 && !answerWords.has(w) && !transitions.has(w));
};

/** The journey's answers: the code-computed answer, or a plainly wrong one of the same kind (a content word of the
 *  sentence, another printed structure, the other part). */
export const textStructureAnalyzerHarnessAnswers = (item: TextStructureItem): { correct: string; plainWrong: string } => {
  if (item.action === 'find-signal') return { correct: item.answer, plainWrong: contentWordsOf(item.stimulusText, item.answer)[0] ?? 'something' };
  const others = item.choices.filter((c) => c.toLowerCase() !== item.answer.toLowerCase());
  return { correct: item.answer, plainWrong: (item.action === 'name-structure' ? others[others.length - 1] : others[0]) ?? 'something else' };
};
