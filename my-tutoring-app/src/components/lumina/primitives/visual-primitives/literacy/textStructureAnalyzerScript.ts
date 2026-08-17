/**
 * textStructureAnalyzerScript — HAND-AUTHORED judged-loop script for
 * text-structure-analyzer (EIGHTEENTH literacy DI port; qa/di/BACKLOG.md item
 * 22, the first of the closed-set literacy frontier). The exact wording IS the
 * pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (the passage, its signal words, its key ideas) stays generator-scoped; this
 * module owns the cue shapes, the build gates, the tier ladder and the leak
 * policy.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL THREE PHASES ARE SPOKEN, and every tap is deleted. Picture a teacher at a
 * table with one child and an informational passage between them — the passage
 * IS the page, and grades 2-6 read it themselves:
 *
 *   "Read the second sentence. Which word links the ideas?"     → "because"
 *   "Yes, because is the word that links them."
 *   "Now the whole passage. How is it put together?
 *    Cause and Effect, Time Order, or Description?"             → "Cause and Effect"
 *   "Listen: the river rose over its banks. Does that go with
 *    Cause, or Effect?"                                         → "Cause"
 *
 * Every one of those answers is a thing a nine-year-old says across a table, so
 * step 1's FIRST question ends the fork three times and the unsayable-shape
 * table is never reached. A four-phase primitive going to zero taps is worth
 * recording, and this is it.
 *
 *   find-signal    one word from a named sentence   → `short_spoken_word` (benched)
 *   name-structure one of the printed structures    → `closed_set_choice`
 *   place-idea     the NAME of a labelled mat       → `short_spoken_word` (benched)
 *
 * TWO NOTES ON THOSE CLASSES, because the handoff read one of them differently.
 * `place-idea` is word-sorter's mats EXACTLY — a region label is a short NAME
 * ("Cause", "Solution", "Details"), not a proposition — so it takes the BENCHED
 * `short_spoken_word` rather than `closed_set_choice`, which is the stronger
 * footing of the two. `name-structure` genuinely is `closed_set_choice`: the
 * answer is a whole claim about the text, and spoken FREE production of it
 * would be `open_set_word` (BLOCKED).
 *
 * THE COSTUME TEST decided every deletion. A child who cannot analyse structure
 * at all could still click a highlighted span, tap one of two cards at a 1-in-2
 * floor, and re-tap a misplaced idea until it landed — three actions, none of
 * which produced any evidence of the skill. What is NOT a costume and stays: the
 * PASSAGE, the printed structure menu, and the labelled mats. A structure
 * question whose candidate structures are unknowable is not a harder task, it is
 * a broken one; the screen is the page, and it was the ACTION that was the
 * costume, never the paper (the ten-frame R6 lesson, word-sorter's mats ruling).
 *
 * ── ⭐ THE HANDOFF'S HEADLINE FINDING, AND WHAT THE PAYLOAD DID TO IT ────────
 *
 * The scope predicted that a session pinned to one eval mode asks the SAME
 * Identify question with the SAME answer on every item, because the eval modes
 * ARE the structure types (`resolveEvalModeConstraint` pins `structureType`,
 * `rootLevel: true`) — §4d as the default state of every production run, and it
 * offered three ways out.
 *
 * READING THE PAYLOAD RESOLVES IT STRUCTURALLY, WHICH IS WAY 1 AND NOT A CHOICE:
 * `TextStructureAnalyzerData` carries ONE passage and ONE `structureType`. There
 * is no `challenges[]`. So this pack can only ever build a SINGLE
 * `name-structure` ask per run, and items 2..N necessarily come from the other
 * two phases, which vary per item over the same passage. Nothing had to be
 * policed; the shape has one Identify in it.
 *
 * ⚠️ WHAT SURVIVES, one layer up and out of this module's reach: a LESSON that
 * stacks several instances of this primitive at one pinned mode gives the child
 * several passages that are all cause-effect, and after the first they can name
 * the structure without reading. That is a manifest/instance-density property —
 * the pack sees one payload and cannot see its siblings — and it is filed as a
 * residual rather than pretended away here. It is also the weakest form of the
 * problem: eight of nine asks in a run are signal-word and idea-placement items
 * on fresh text, which is exactly way 1's argument.
 *
 * The Identify ask is deliberately placed AFTER the signal-word items, and its
 * lead-in points back at them: the child has already produced the evidence, so
 * the ask is "what did your linking words show?" without ever spending a second
 * judged item on it (way 2's value, at way 1's cost).
 *
 * ── ⚠️ TWO ANSWERS WERE ON SCREEN BEFORE THEY WERE EARNED ───────────────────
 *
 * Both were invisible for as long as a button did the grading, and both are the
 * "hunt the leak in PIXELS, not just strings" walk:
 *
 *  1. THE HEADER PRINTED THE ANSWER. The click-era card rendered
 *     `<LuminaBadge>{structureType.replace('-', ' ')}</LuminaBadge>` beside the
 *     grade chip — so "cause effect" was on screen from the first paint, above
 *     a menu asking the child to work it out. Deleted outright; no gate in this
 *     family would ever have caught it, because it is not a string a tutor says.
 *  2. `prehighlightSignalWords` PRE-HIGHLIGHTED PHASE 1'S ANSWERS at `easy` as
 *     a perception cue. Under a judged loop that prints the answer to item 1
 *     before the ask. The lever is not deleted, it MOVES to the same axis
 *     without the answer in it: easy/medium highlight the FOCUS SENTENCE (which
 *     sentence to look in — a scoping cue), hard highlights nothing and the ask
 *     names the ordinal alone. Signal words light up only after the tutor has
 *     affirmed them, which is what that highlight always meant.
 *
 * ── ⚠️ PHASE 1 IS AN AMBIGUOUS ASK UNLESS CODE SCOPES IT ────────────────────
 *
 * "Say the transition word" over a whole passage has three to eight right
 * answers and one printed target, and an ambiguous ask is not a harder task, it
 * is a broken one. Two gates make it decidable, and the second is the one that
 * matters:
 *
 *  1. THE ASK IS SCOPED TO ONE SENTENCE, named by ordinal ("the second
 *     sentence") and, above `hard`, highlighted on the page.
 *  2. THAT SENTENCE MUST CONTAIN EXACTLY ONE CONNECTIVE — counted against
 *     `TRANSITION_WORDS`, a CODE-OWNED list, not against the LLM's `signalWords`
 *     array. A sentence reading "Then it makes a chrysalis, and after two weeks
 *     a butterfly comes out." has two right answers whether or not the model
 *     listed both, and the child who says the unlisted one is right and would be
 *     refused. Counting our own list is the only version of this gate that
 *     closes; the LLM's list cannot see what it did not write down.
 *
 * The gate over-drops (an intensifier "so", a temporal "before" inside a phrase)
 * and that is the correct direction: a dropped item asks nothing, an ambiguous
 * one asks something no honest verdict exists for. The generator carries the
 * matching prompt rule so the drop rate stays low.
 *
 * AND THE ASK NEVER READS THE SENTENCE ALOUD. These are readers (grade 2-6) and
 * decoding the passage is the skill, so the tutor points and the child reads —
 * which also leaves the find-signal leak oracle completely FLAT, the strongest
 * of the three. Speaking the sentence would have handed over the answer word
 * two seconds before asking for it (phoneme-explorer's `isolate` trap).
 *
 * ── ⚠️ AXIS-2 STRUCTURAL DIFFICULTY AND EAR-SEPARABILITY DO NOT FIGHT ───────
 *
 * The scope flagged this as the port's sharpest trap: `STRUCTURE_DISTANCE` +
 * `resolveProblemShape` deliberately select the structures most easily MISTAKEN
 * for the correct one at `hard`, which is the opposite of what a spoken closed
 * set needs. Measured against the gate rather than by eye, they are orthogonal:
 * confusability is SEMANTIC (cause-effect and problem-solution both mean "this
 * leads to that") while separability is ACOUSTIC, and the five canonical labels
 * share only the word "and". `optionsEarSeparable` passes the full five-way set
 * at `hard`, so nothing softens — exactly as the scope required.
 *
 * What DID have to change is the other half of §5. `maxStructureOptions: 2` at
 * `easy` is a 1-IN-2 GUESS FLOOR on the single Identify ask of the entire run,
 * and the guess floor is the thing a judged loop exists to delete. Under a tap
 * it was a scaffold; under spoken production it is a coin flip deciding the
 * whole measurement of the skill. It goes to THREE, band-clamped — at grade 2
 * the curriculum has only two structures in band, so it saturates at 2, which is
 * a real ceiling and not a softening (word-sorter's binary_sort shape). Axis 2
 * is untouched: the near-distractor ladder still runs 0 → 1 → all.
 *
 * ── THE LABELS ARE CANONICAL, AND THE GENERATOR IMPORTS THEM FROM HERE ──────
 *
 * `structureOptions[].label` was LLM-authored, which put an unsayable or
 * un-separable answer string one bad generation away from a spoken ask. The five
 * labels are now owned by this module and derived from the `type` enum, so
 * separability is guaranteed by construction over a set of five we control, the
 * judge is always handed the same target string, and there is ONE address for
 * both sides of the wire (letter-spotter's 90-vs-100 drift is why this is an
 * import and not a copy). The kid-friendly GLOSS stays generated — it is printed
 * beside the label and is never the answer.
 *
 * ── CORRECTIONS NAME THE ANSWER, AND THERE IS NO CLOSE LINE ─────────────────
 *
 * word-sorter's ruling applies unchanged in all three actions: a signal word, a
 * structure and a region are FACTS a child either holds or does not, and there
 * is no route to re-model that stops short of naming them. So every correction
 * is the full DISTAR model-lead-test — name the fact, re-ask the same item — and
 * `moveOnCue` carries NO close line, because the runner has already run that
 * correction twice before it caps. The measurement stays honest through the
 * runner's 100/67/33 scoring, never through withholding.
 *
 * ── SENTINELS ──────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by `checkPackGates` in
 * this pack's test file. Every generated string that can reach a spoken line —
 * region labels and key-idea excerpts — runs through `opensWithSentinel` and is
 * DROPPED on a hit, on both sides of the wire. The passage itself is never
 * spoken, so it is scanned on the PRINTED side only.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

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

/** What the child is doing on this item — the task identity the how-to-play
 *  re-speaks on. NOT the eval mode: the eval mode is the structure, which is the
 *  ANSWER and is never named in the context channel (see `stimulusFor`). */
export type TextStructureAction = 'find-signal' | 'name-structure' | 'place-idea';

export type TextStructureTier = 'easy' | 'medium' | 'hard';

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

export const isStructureType = (value: unknown): value is StructureTypeId =>
  typeof value === 'string' && (ALL_STRUCTURE_TYPES as string[]).includes(value);

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
 * Content words of this pack's own invariant prose. A mat labelled "Ideas" or
 * "Passage" would make the leak oracle fire on our own greeting and how-to-play
 * — the half most worth scanning — and it is a poor mat label besides. Dropping
 * it is cheaper than exempting our prose (letter-spotter's ruling: fix the
 * collision, never switch the oracle off over the lines we wrote).
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
}

const EMPTY_BUILD: TextStructureBuildResult = {
  items: [], dropped: 0, truncated: 0, sentences: [],
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
  if (isStructureType(structureType)) {
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
        answer: STRUCTURE_LABEL[structureType],
        choices: labels,
        choiceNotes: menu.map((t) => glossOf.get(t) || STRUCTURE_GLOSS[t]),
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

  return { items: answerFree, dropped, truncated, sentences };
};

// ── Small speakable helpers ─────────────────────────────────────────────────

/** "Cause and Effect, Time Order, or Description?" — the spoken menu, and the
 *  ONE span the leak oracle subtracts. */
export const choicesPhrase = (item: TextStructureItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return 'I point you at one sentence — you read it and tell me which word links the ideas. ';
    case 'name-structure':
      return 'Now you tell me how the whole passage is put together. ';
    case 'place-idea':
    default:
      return 'I read you one idea from the passage — you tell me where it belongs. ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing. A tier changes how much
// of the sequence precedes the attempt — never the ask, never the judging, and
// never the correction's re-model (standing gate 3). Spoken ONLY when the action
// is being introduced (`opening || howToPlay`), never per item: if the model
// line does not change when the item changes, it is established once, not
// recited (ruled twice on 2026-08-13).
//
// NOTE what is absent at every rung: a worked EXEMPLAR. Modelling "the river
// rose goes under Cause" would say a mat name that is very often the NEXT item's
// answer, since every idea of a passage shares one mat set — word-sorter's
// finding, and the same shape here. These model the STRATEGY instead. The easy
// tier's worked example survives as the PRE-PLACED anchor on the page, which is
// printed material and is never spoken.

const modelLine = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return 'A linking word joins one idea to another — it does not name a thing.';
    case 'name-structure':
      return 'Think about what your linking words were doing.';
    case 'place-idea':
    default:
      return 'Read the labels, then ask which one the idea answers.';
  }
};

const guideLine = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return 'Read the whole sentence first, then look again for the joining word.';
    case 'name-structure':
      return 'Take your time — say the one that matches your linking words.';
    case 'place-idea':
    default:
      return 'It is fine to read it twice before you answer.';
  }
};

const leadInFor = (item: TextStructureItem): string => {
  switch (item.tier) {
    case 'hard':
      return '';
    case 'easy':
      return `${modelLine(item)} ${guideLine(item)} `;
    case 'medium':
    default:
      return `${modelLine(item)} `;
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────
// Every ask carries varying content (a new ordinal, a new excerpt) or is the
// only item of its action, so no two consecutive asks are byte-identical and the
// invariant-recitation gate has nothing to bite on.
//
// ⚠️ THE SENTENCE IS NEVER READ ALOUD. Decoding the passage is the skill and
// these are readers; speaking it would also hand over the answer word two
// seconds before asking for it.

export const askFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      // CARDINAL, never an ordinal — "the first sentence" said the answer out
      // loud on every chronological passage. See `SENTENCE_NUMBERS`.
      return `Your turn. Read sentence ${sentenceNumberFor(item.sentenceIndex) ?? 'one'}. Which word links the ideas?`;
    case 'name-structure':
      return item.namesChoices
        ? `Your turn. Think about the whole passage. How is it put together? ${choicesPhrase(item)}`
        // `hard` above the band floor: the structures are printed and the tier
        // withholds the criterion, so the menu is not spoken. The ask still
        // STATES its problem — an ask that says nothing is broken, not terser.
        : 'Your turn. Think about the whole passage. How is it put together? Say the one you pick.';
    case 'place-idea':
    default:
      return item.namesChoices
        ? `Your turn. Listen: ${item.stimulusText}. Does that go with ${choicesPhrase(item)}`
        : `Your turn. Listen: ${item.stimulusText}. Which part does that belong in?`;
  }
};

// ── Corrections — DISTAR model-lead-test (standing gate 3) ──────────────────
// All three NAME the fact. See the header: a signal word, a structure and a
// region are things a child either holds or does not, and there is no route to
// re-model that stops short of naming them (word-sorter's ruling).

const correctionFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return `My turn: ${item.answer} is the word that links the ideas there. ${askFor(item)}`;
    case 'name-structure':
      return `My turn: this passage is put together as ${item.answer}. ${askFor(item)}`;
    case 'place-idea':
    default:
      return `My turn: that idea belongs with ${item.answer}. ${askFor(item)}`;
  }
};

const affirmFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return `Yes, ${item.answer} is the word that links them.`;
    case 'name-structure':
      return `Yes, this passage is put together as ${item.answer}.`;
    case 'place-idea':
    default:
      return `Yes, that one belongs with ${item.answer}.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW`. Identical
 * across the family on purpose: a grep finds every pack that has it and every
 * pack that does not.
 *
 * Stated BEFORE the branches because the defect is a reply that is NEITHER
 * branch — improvised praise opens with neither sentinel, so the reducer records
 * no verdict, the correction counter freezes, and the child waits on a loop that
 * cannot advance.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's.
 *
 * It matters here for a reason specific to this port: the tutor is told the
 * structure menu and the mat names in the contract, and the whole PASSAGE is on
 * the child's screen — so "describe what has changed on the screen" is one
 * sentence away from reading the option set aloud on a hard-tier item that
 * deliberately does not name it, or from reading the passage to a child whose
 * task is to read it themselves.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `never read the passage or any sentence of it aloud, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * The verdict line is the END of the turn — word-sorter's cap-drill finding
 * (2026-08-16), where eleven of twelve affirmations ran on into a fabricated
 * next ask about a real word from the challenge that was NOT the item the runner
 * was about to send.
 *
 * It is carried here rather than assumed because this pack has the same
 * trigger, twice over: the find-signal ask is one rigid template spoken up to
 * four times in a row with only an ordinal changing, and the place-idea ask is
 * another. A short affirmation landing on a label, in front of a template the
 * model can see the rest of, is exactly the shape whose likeliest continuation
 * is the next question.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never say the next sentence or the next idea, and never announce what is coming — the activity sends you `
  + `the next question when the screen is ready for it, and a question you ask early is about the wrong thing.`;

// ── The judging contract ────────────────────────────────────────────────────

/**
 * The answer rides in the control channel ahead of the attempt, which is the
 * family's shipped shape under the never-say-it law — a judge cannot decide an
 * answer it was never told.
 *
 * Each action names its ACCEPT clause and its SIGNATURE ERROR: the wrong answer
 * that arrives fluent, confident, and most likely to be affirmed by mistake.
 *
 *  find-signal    the signature wrong is A CONTENT WORD FROM THE SENTENCE —
 *                 this primitive's own documented struggle #1 ("highlights
 *                 content words instead of transition words"). It is a real word,
 *                 read straight off the line the child was pointed at, so a judge
 *                 grading on "did they say a word from that sentence" affirms it.
 *  name-structure the signature wrong is THE NEAREST STRUCTURE — the one axis 2
 *                 deliberately puts in the menu at `hard` because both mean
 *                 "this leads to that". Semantically adjacent, confidently said,
 *                 and the exact discrimination the lesson exists to teach.
 *  place-idea     the signature wrong is THE EXCERPT SAID BACK — word-sorter's
 *                 and picture-vocabulary's shared trap. The child produces none
 *                 of the answer, but the utterance is a real phrase the tutor
 *                 itself spoke two seconds earlier.
 */
const judgingContract = (item: TextStructureItem): string => {
  const preamble =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner reads and thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `;

  if (item.action === 'find-signal') {
    return (
      preamble
      + `The correct answer is the word "${item.answer}". `
      + `They may say it alone or inside a little phrase — "${item.answer}", "it is ${item.answer}", `
      + `"the word ${item.answer}" all count as the same answer. A shy or mumbled try still counts. `
      + `Any OTHER word from that sentence is wrong, however clearly they read it: the words that name `
      + `things and actions are not linking words, and that mix-up is the whole point of this step. `
      + TWO_BRANCH_LAW
      + `If the answer is right, say exactly: "${affirmFor(item)}" `
      + `If it is wrong, say exactly: "${correctionFor(item)}"`
    );
  }

  if (item.action === 'name-structure') {
    const numbered = item.choices.map((c, i) => `${i + 1}) "${c}"`).join(' ');
    const correctIndex = item.choices.indexOf(item.answer) + 1;
    return (
      preamble
      + `The learner answers OUT LOUD by telling you which way the passage is organised. `
      + `The choices printed on their screen, in order, are: ${numbered}. `
      + `The correct one is number ${correctIndex}. `
      + `They have named it if they say the whole label, OR just the part that tells it apart from the `
      + `others ("cause" for "Cause and Effect", "order" for "Time Order"), OR where it sits in the list `
      + `("the second one"). A child answers with the short form far more often than the whole label, and `
      + `the short form is a full answer, not a lesser one. `
      + `Naming a DIFFERENT structure is wrong even when it is a close relative of the right one — telling `
      + `those two apart is exactly what is being measured here. `
      + TWO_BRANCH_LAW
      + `If the answer is right, say exactly: "${affirmFor(item)}" `
      + `If it is wrong, say exactly: "${correctionFor(item)}" `
      + `If you truly cannot tell WHICH one they meant — they trailed off, or what they said fits two of `
      + `them — do not guess and do not judge: say exactly "Tell me that one again." and wait for them.`
    );
  }

  const wrongClause = item.choices.length === 2
    ? `The other part is wrong. `
    : `Any of the other parts is wrong. `;
  return (
    preamble
    + `The correct answer is the part called "${item.answer}". `
    + `They may say it without its little words or with the ending changed — "${item.answer}", `
    + `"the ${item.answer}", "it goes in ${item.answer}" all count as the same answer. `
    + `A shy or mumbled try still counts. `
    + `Saying the idea back to you is NOT an answer however confident it sounds — those words are the question. `
    + wrongClause
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface TextStructureCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: TextStructureItem,
  opts: TextStructureCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us take a close look at this passage together. ' : '';
  // Introducing = the run's opening, or the ACTION just changed. Only then does
  // the child hear how this step works and the DISTAR lead-in; every other item
  // goes straight to the ask.
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[TSA_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * NO CLOSE LINE, and that is a deduction rather than a shortcut (word-sorter's).
 * Every correction in this pack NAMES the fact and the runner runs it TWICE
 * before capping, so the child has already heard "that idea belongs with Effect"
 * twice — a third telling is redundant. It is also the only place a mat name or
 * a structure label would reach the move-on utterance outside the exempt menu
 * clause, and every item of a passage shares one label set, so a close line here
 * names a label that is very often the NEXT item's answer.
 */
export const moveOnCue = (
  item: TextStructureItem,
  next: TextStructureItem | null,
  opts: TextStructureCueOptions = {},
): string => {
  if (!next) {
    return (
      `[TSA_MOVE] Say exactly: "Good try! We will look at that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[TSA_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[TSA_COMPLETE] Say exactly: "Great reading today! You worked out how that whole passage was built, `
  + `and you told me every answer out loud. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn
 * by band or tier. It repeats what the ask said and nothing more — in
 * particular it does not read the sentence the child was pointed at, because
 * reading it is their job.
 */
export const pronounceCue = (item: TextStructureItem): string => {
  const line = askFor(item).replace(/^Your turn\. /, '');
  return (
    `[TSA_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY.
 *
 * ⚠️ `challengeType` IS THE ACTION, NOT THE EVAL MODE, and that is deliberate.
 * This primitive's eval modes ARE the structure types, so pushing the mode would
 * park the Identify answer in the tutor's context for the whole session, where
 * it can be volunteered on any turn. The action is what the tutor actually needs
 * to know ("which step am I on"); the answer arrives per item, inside the cue,
 * and leaves with it.
 *
 * The stimulus names WHAT is in front of the child and how many choices there
 * are — never the choices themselves, because at `hard` the ask deliberately
 * does not say them.
 */
export const stimulusFor = (item: TextStructureItem): string => {
  switch (item.action) {
    case 'find-signal':
      return `sentence ${sentenceNumberFor(item.sentenceIndex) ?? 'one'} of a passage printed on their screen`;
    case 'name-structure':
      return `the whole passage, with ${item.choices.length} ways it could be organised printed on their screen`;
    case 'place-idea':
    default:
      return `one idea from the passage, with ${item.choices.length} places to put it printed on their screen`;
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction.
 */
export const textStructureAnalyzerPackBase = (
  items: TextStructureItem[],
): JudgedCueSurface<TextStructureItem> => ({
  primitiveType: 'text-structure-analyzer',
  activityLine: 'live direct instruction informational text structure analysis',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.action,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * The span of the ask inside which the answer may legitimately appear.
 *
 * THE FIND-SIGNAL ORACLE IS COMPLETELY FLAT, and that is this port's strongest
 * gate: the ask names an ordinal and asks a question, and the sentence carrying
 * the answer is PRINTED rather than spoken. Nothing is subtracted, so a linking
 * word arriving through the greeting, the how-to-play, the lead-in, the catalog
 * or a struggle response is always a finding.
 *
 * The other two asks close on a spoken MENU when the tier names it — the answer
 * is inside the question by construction (push-pull-arena's shape, word-sorter's
 * tier-conditional form) — so exactly that clause is subtracted, and at `hard`
 * above the band floor no clause is spoken and the oracle goes flat there too.
 */
export const leakExemptSpanFor = (item: TextStructureItem): string | undefined =>
  item.action !== 'find-signal' && item.namesChoices ? choicesPhrase(item) : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each of
 * these; this is that claim made testable. Change one, change both.
 *
 * `plainWrong` for find-signal is a CONTENT WORD lifted from the same sentence
 * rather than an arbitrary token — the plain wrong and the signature wrong are
 * the same family here, so the signature one is sharpened to the longest content
 * word on the line: the most confidently-read, most obviously "from the text"
 * thing the child could offer.
 */
const contentWordsOf = (sentence: string, answer: string): string[] => {
  const answerWords = new Set(earWords(answer));
  const transitions = new Set(TRANSITION_WORDS);
  return earWords(sentence)
    .filter((w) => w.length >= 4 && !answerWords.has(w) && !transitions.has(w));
};

export const textStructureAnalyzerHarnessAnswers = (item: TextStructureItem) => {
  if (item.action === 'find-signal') {
    const content = contentWordsOf(item.stimulusText, item.answer);
    const longest = [...content].sort((a, b) => b.length - a.length)[0];
    return {
      correct: item.answer,
      plainWrong: content[0] ?? 'something',
      signatureWrong: {
        text: longest ?? content[0] ?? 'something',
        why:
          'a CONTENT word read straight off the sentence the child was pointed at — this primitive\'s own '
          + 'documented commonest error (naming words instead of linking words). It is a real word, clearly '
          + 'read from the line, so a judge grading on "did they say a word from that sentence" affirms it',
      },
      leakTokens: [item.answer],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  const others = item.choices.filter((c) => c.toLowerCase() !== item.answer.toLowerCase());
  if (item.action === 'name-structure') {
    return {
      correct: item.answer,
      plainWrong: others[others.length - 1] ?? 'something else',
      signatureWrong: {
        // Axis 2 orders distractors nearest-first at `hard`, so the leading one
        // IS the structure most easily mistaken for the answer.
        text: others[0] ?? 'something else',
        why:
          'the NEAREST structure — the sibling axis-2 deliberately puts in the menu at hard because both '
          + 'mean "this leads to that" (cause-effect against problem-solution). It is a real option, '
          + 'semantically adjacent, and telling the two apart is the entire skill being measured',
      },
      leakTokens: [item.answer],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  return {
    correct: item.answer,
    plainWrong: others[0] ?? 'something else',
    signatureWrong: {
      text: item.stimulusText,
      why:
        'the excerpt said straight back — a real phrase, said confidently, that the tutor itself spoke two '
        + 'seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. '
        + 'The contract names this miss by name',
    },
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
};
