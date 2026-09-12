/**
 * syllableClapperScript — HAND-AUTHORED judged-loop script for syllable-clapper
 * (qa/di/BACKLOG.md item 16). The exact wording IS the pedagogy; item CONTENT
 * stays generator-scoped. This module owns the cue shapes, the in-band judging
 * contracts, and the content gates — which the generator IMPORTS rather than
 * copies, so both sides of the wire can never disagree about what is askable.
 *
 * ── THE PACK IN ONE LINE ────────────────────────────────────────────────────
 * The tutor voices a word — joined, or one part at a time, or minus a part —
 * the child answers OUT LOUD, and her verdict is the advance.
 *
 * ── THREE ACTS, NOT THREE DIFFICULTIES (2026-09-11) ─────────────────────────
 * The 2026-08-16 port shipped one act (`count-parts`) across three word-LENGTH
 * bands that were registered as eval modes. Modes are task identities, so that
 * was one skill wearing three coats — and it cost something concrete: intent
 * resolution could "blend" two word lengths, which is not a curriculum choice,
 * while the three acts a phonological-awareness sequence is actually made of had
 * nowhere to live. The bands moved to `config.difficulty` (beside the ask
 * scaffolds that were already there) and the modes became the acts:
 *
 *   blend_syllables  the tutor chants the parts, the child says the WORD
 *   count_parts      the tutor says the word joined, the child says HOW MANY
 *   delete_compound  "say cupcake without cup" — the child says what is LEFT
 *
 * ⭐ THE CLAP BUTTON WAS NEVER THE CLAP — IT WAS A TALLY WIDGET.
 * The click era shipped a `👏 Clap!` button, six counter circles that filled in
 * as you pressed it, and a `Check (3 claps)` label. Run the costume test on it:
 * a child who cannot hear a single syllable boundary can press that button three
 * times, and the six circles then do the COUNTING for them — the one cognitive
 * act the primitive exists to train. It also failed the table test twice over:
 * a teacher sitting with one child hands them no tablet to tap, and the running
 * count they would have had to hold in their head was printed on screen instead.
 *
 * So the clapping does not die — IT MOVES OFF THE SCREEN AND INTO THE ROOM. The
 * `count_parts` ask invites the hands ("Clap the parts with your hands, then
 * tell me how many") and the child's hands are their own, invisible to us
 * exactly as they are to a teacher whose real signal is the spoken count.
 *
 * ── PURPOSEFUL ENUNCIATION IS A LADDER, NOT A STYLE ─────────────────────────
 * There are exactly three honest ways to voice a word here, and they are not
 * interchangeable:
 *
 *   1. CHANTED IN PARTS  "but … ter … fly"
 *   2. STRETCHED BUT JOINED — slower, drawn out, one unbroken stream.
 *   3. WHOLE AT NATURAL PACE — the real listening task.
 *
 * ⚠️ ON `count_parts` THE CHANT HANDS THE COUNT OVER, so it is legal ONLY in the
 * correction (post-attempt, so it is earned) and on a MODEL WORD the session
 * never asks about. The click era had this exactly backwards, and its own reveal
 * policy says so in one breath: it told the tutor to "never state the NUMBER of
 * parts before the student claps" and, at the easy tier, to say the word "broken
 * into its parts with clear pauses" AS THE SCAFFOLD. Saying the parts IS stating
 * the number, in a different currency. Three beats is three.
 *
 * ⭐ ON `blend_syllables` THE SAME CHANT IS THE LEGITIMATE QUESTION, and this is
 * the cleanest illustration in the pack of why a leak rule is about the ANSWER
 * and never about a form of words. The child is not being asked how many parts
 * there are; they are being asked to join them. A chant hands over nothing the
 * question wanted kept, and the act it asks for — hold three pieces, fuse them
 * into one word — is EASIER than segmenting, which is why this mode sits below
 * counting on the ladder rather than above it.
 *
 * ── THE CONTENT GATES THAT WRITING THE SPOKEN ASKS PRODUCED ─────────────────
 * ⭐ The click era's `hard` band explicitly asked for "words with ambiguous
 * syllable boundaries (caterpillar, refrigerator, comfortable, interesting,
 * hippopotamus)". Two of those have no single defensible answer: "comfortable"
 * is 3 or 4 and "interesting" is 3 or 4 depending on dialect, and the same is
 * true of a pile of ordinary K words ("squirrel", "fire", "flower", "every",
 * "chocolate"). A tap surface could hide that — the key was never spoken aloud
 * and the child had three tries with a directional hint. A judged loop cannot:
 * the tutor will refuse a CORRECT child and then model the "right" answer at
 * them. An ambiguous ask is not a harder task, it is a broken one, so
 * `DIALECT_VARIABLE_WORDS` drops them, on both sides of the wire.
 *
 * ⭐ AND `delete_compound` ADDS TWO OF ITS OWN, BOTH FOUND BY THE LIVE PROBE
 * RATHER THAN BY REASONING, WHICH IS WHY THEY ARE WORTH RECORDING.
 *
 * (a) THE RESIDUE MUST BE A REAL WORD, AND STRUCTURE CANNOT TELL YOU THAT. The
 *     first draw of this act returned `peanut → pe|anut`, removePart "pe",
 *     residue "anut". Two parts, they spell the word, the residue is one of them
 *     and it is sayable letters — every structural gate passed, and the ask it
 *     would have produced is "say peanut without pe", whose answer is a nonword.
 *     So the gate is a POSITIVE oracle (`COMPOUND_PART_WORDS`): both parts must
 *     be words on a curated list. A positive list is affordable here and nowhere
 *     else in this file, because the K-appropriate compound supply is genuinely
 *     small and closed — perhaps a hundred words — whereas the counting act
 *     draws from the whole picturable vocabulary, where a positive list would
 *     drop far more good items than bad ones.
 *
 * (b) THE PARTS ARE WORDS, NOT SYLLABLES, AND THE MODE IS NAMED FOR IT. The same
 *     draw returned `dragonfly → dragon|fly` and `honeybee → honey|bee`. Those
 *     are good compound-deletion items and bad syllable splits ("dragon" is two
 *     beats), so the mode was renamed from the syllable-deletion name it was
 *     born with rather than the content being forced to match it. True syllable
 *     deletion stays unbuilt on purpose: "banana without ba" is "nana", and a
 *     judged loop cannot score a nonword honestly.
 *
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file.
 */

import {
  opensWithSentinel,
  type DiActionContract,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import {
  isSyllableTask,
  syllableClapperModePlan,
  syllableTaskShape,
  type SyllableTask,
} from './syllableClapperModes';

/** The WORD-LENGTH band. A DISPLAY and METRICS fact derived from the split —
 *  it is no longer an eval mode, and nothing in the judged path reads it. */
export type SyllableBand = 'easy' | 'medium' | 'hard';
export type SyllableSupportTier = 'easy' | 'medium' | 'hard';

/** The DISTAR model spoken once in the how-to-play, on a word the session never
 *  asks about. `count` is a number WORD so the demo reads aloud correctly. */
export interface SyllableModelWord {
  word: string;
  parts: string[];
  count: string;
}

export interface SyllableClapperItem extends JudgedScriptItem {
  /** Which act this item asks for. Pushed to the tutor as `challengeType`. */
  task: SyllableTask;
  actionContract: DiActionContract;
  /** The word. Never printed before the affirmation on any task. */
  word: string;
  /** The real syllable split, chanted by `blend_syllables` and by corrections. */
  parts: string[];
  /** What the child SAYS: a count word, the blended word, or the residue. */
  answer: string;
  /** The count as a number, for the stage's reveal and the metrics. */
  partCount: number;
  /** `delete_compound` only — the part the ask takes away. */
  removePart?: string;
  /** `delete_compound` only — the real word left behind; equals `answer`. */
  residue?: string;
  /** Derived word-length band, for the badge and the phase summary. */
  band: SyllableBand;
  /** Reveal-only caption; never rendered before the affirmation. */
  imageDescription?: string;
  /** Tier lever: the ask voices the stimulus a second time. */
  echoSlowly: boolean;
  /** Tier lever: the ask invites the hands. `count_parts` only. */
  inviteClap: boolean;
  /** The how-to-play's worked example, or null when no safe model exists
   *  (the rule is then stated without one — a dropped SCAFFOLD, never a
   *  degraded ask). */
  model: SyllableModelWord | null;
}

export const responseClassFor = (task: SyllableTask): ResponseClassId =>
  task === 'count_parts' ? 'number_word_to_20' : 'short_spoken_word';

// ── Number words ────────────────────────────────────────────────────────────

/** Indices 1-5 are the answers the build gate admits; 'six' exists only so the
 *  harness can build a count that runs one PAST a five-part word. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** The pedagogic range. 1-4 is the primitive's declared band; 5 is admitted
 *  because the shipped long-word prompt names "refrigerator" (re·frig·er·a·tor),
 *  and refusing a legitimate hard word is a supply bug, not a safety gate. */
export const MIN_PARTS = 1;
export const MAX_PARTS = 5;

const partsWord = (n: number) => (n === 1 ? 'part' : 'parts');
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Display band from the split. 1-2 short, 3 longer, 4-5 long. */
export const bandForParts = (count: number): SyllableBand =>
  count <= 2 ? 'easy' : count === 3 ? 'medium' : 'hard';

// ── Content gates — the generator IMPORTS these, never copies them ──────────

/**
 * One ordinary English word a five-year-old can hear: letters (plus an internal
 * apostrophe or hyphen), no digits, no spaces. A spoken ask cannot carry a
 * phrase, and the 400-char `targetWord` runaway letter-spotter's probe caught
 * is why a field that cannot be enum-locked gets a SHAPE gate as well as a
 * meaning one.
 */
const SAYABLE_WORD = /^[a-z][a-z'-]{0,19}$/i;

export const isSayableSyllableWord = (word: string | undefined): word is string =>
  !!word
  && SAYABLE_WORD.test(word.trim())
  && word.trim().toLowerCase() !== 'yes'
  && !opensWithSentinel(word.trim());

/** A syllable is chanted aloud on its own, so it has to be pronounceable
 *  letters — nothing else can be said as a beat. */
const SAYABLE_PART = /^[a-z][a-z'-]{0,9}$/i;

/**
 * Do the parts spell the word? The click-era generator forced
 * `syllableCount = syllables.length` and never checked this, so a split that
 * drifted from its own word produced a CORRECTION that chants a different word
 * at the child — invisible while a button did the grading, spoken aloud now.
 * Case- and hyphen-insensitive: a split may drop the hyphen of "T-shirt".
 */
export const syllablesJoinToWord = (word: string, parts: string[]): boolean => {
  const norm = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '');
  return parts.length > 0 && parts.join('').toLowerCase().replace(/[^a-z]/g, '') === norm(word);
};

/**
 * ⭐ WORDS WHOSE SYLLABLE COUNT IS NOT ONE NUMBER.
 *
 * Used NEGATIVELY, word-workout's oracle pattern: membership means "there is no
 * single defensible answer here", never "this word is bad". Two families, and
 * the second is the one a K word list actually trips over:
 *
 *  (a) SCHWA SYNCOPE — a middle vowel that speakers routinely swallow.
 *      "chocolate" is choc·late or choc·o·late; "every" is ev·ry or ev·e·ry.
 *      The shipped long-word prompt asked for exactly these ("comfortable",
 *      "interesting") as though ambiguity were difficulty.
 *  (b) SYLLABIC LIQUIDS AND DIPHTHONG GLIDES — "squirrel" is one beat or two,
 *      "fire" and "flower" and "hour" the same. These are ordinary K animal and
 *      weather words, which is why the list cannot be an academic-vocabulary
 *      afterthought.
 *
 * A judged loop is what makes this fatal: the tutor refuses a child who was
 * right and then models the "correct" count at them, teaching a dialect as a
 * fact. Held on both sides of the wire so it also covers hand-authored and
 * cached payloads.
 */
export const DIALECT_VARIABLE_WORDS = new Set([
  // (a) schwa syncope
  'chocolate', 'camera', 'family', 'every', 'everyone', 'everything', 'different',
  'interesting', 'comfortable', 'vegetable', 'favorite', 'favourite', 'temperature',
  'several', 'general', 'jewelry', 'business', 'restaurant', 'memory', 'average',
  'natural', 'separate', 'mystery', 'factory', 'history', 'evening', 'probably',
  'actually', 'basically', 'caramel', 'diamond', 'cereal', 'theater', 'medicine',
  'onion', 'union',
  // (b) syllabic liquids and glides
  'squirrel', 'fire', 'fires', 'hire', 'tire', 'wire', 'hour', 'hours', 'our', 'ours',
  'flower', 'flowers', 'flour', 'tower', 'power', 'shower', 'sour', 'towel', 'jewel',
  'cruel', 'fuel', 'real', 'iron', 'lion', 'science', 'poem', 'drawer', 'choir',
  'area', 'idea', 'violet', 'quiet', 'giant',
]);

export const hasStableSyllableCount = (word: string): boolean =>
  !DIALECT_VARIABLE_WORDS.has(word.trim().toLowerCase());

/**
 * ⭐ FOUND BY THE LIVE PROBE, and it is the failure the join gate cannot see:
 * a split that spells its word perfectly and still claims the wrong number of
 * beats. The draw was `centipede → ["cen","ti","pe","de"]`. Those four parts
 * join to "centipede" letter for letter, so every gate above passed it — and
 * the answer key says FOUR for a word English claps in THREE. A judged tutor
 * then refuses the child who said "three" and chants "cen … ti … pe … de" at
 * them as the model.
 *
 * A general syllable counter is not something to attempt here (every cheap
 * heuristic breaks on "-ed" and "-es"), so this gates the one shape that is
 * certain: a FINAL part that is a single consonant plus "e" is a silent final
 * e, not a beat. "-le" endings ("ap|ple", "ta|ble", "un|cle") are three
 * characters and never match, which is what keeps the real syllabic-l words.
 *
 * KNOWN AND ACCEPTED FALSE POSITIVES: words whose final consonant+e IS a beat
 * — "karate", "recipe", "sesame". They are dropped, not mis-graded, and none of
 * them is a concrete picturable K-2 noun, so the cost is supply we do not want
 * anyway. Dropping is always the safe direction here: the alternative is a
 * spoken ask whose answer key is wrong.
 */
const SILENT_FINAL_E_PART = /^[bcdfghjklmnpqrstvwxz]e$/i;

export const endsWithSilentESyllable = (parts: string[]): boolean =>
  parts.length >= 2 && SILENT_FINAL_E_PART.test(parts[parts.length - 1]);

/**
 * ⭐ THE COMPOUND PARTS A DELETION ITEM MAY BE BUILT FROM — a POSITIVE oracle,
 * the only one in this file, and the live probe is what bought it.
 *
 * The first draw returned `peanut → pe|anut`: two parts, they spell the word,
 * the residue is one of them, and it is sayable letters. Every structural gate
 * passed, and the ask would have been "say peanut without pe", whose answer is a
 * nonword. Nothing about the SHAPE of a split can tell you its halves are words;
 * only a list can.
 *
 * A positive list is the wrong tool almost everywhere — word-workout's real-word
 * oracle is used NEGATIVELY for exactly that reason, because a positive
 * requirement over-drops good content. It is the right tool HERE because the
 * K-appropriate compound supply is small and closed: the words below already
 * cover every compound four live draws produced, and a compound outside them is
 * dropped (logged, with the reason) rather than asked. Dropping is always the
 * safe direction when the alternative is a spoken ask with a nonword answer.
 */
export const COMPOUND_PART_WORDS = new Set([
  // things around a house and a day
  'bed', 'room', 'time', 'house', 'home', 'door', 'bell', 'box', 'mail', 'back',
  'pack', 'book', 'case', 'cup', 'cake', 'pan', 'pot', 'pop', 'corn', 'bread',
  'egg', 'plant', 'nut', 'oat', 'meal', 'milk', 'shake', 'tea', 'pie', 'apple',
  'straw', 'berry', 'blue', 'black', 'green', 'gold', 'bowl', 'spoon', 'chair',
  // outdoors, weather, sky
  'sun', 'hat', 'shine', 'rain', 'coat', 'bow', 'drop', 'snow', 'man', 'ball',
  'flake', 'star', 'moon', 'light', 'day', 'night', 'sand', 'castle', 'sea',
  'shell', 'shore', 'tree', 'top', 'wood', 'camp', 'side', 'walk', 'hill',
  // animals and creatures
  'cat', 'dog', 'bird', 'fish', 'nest', 'bug', 'lady', 'bee', 'honey', 'fly',
  'frog', 'bull', 'horse', 'shoe', 'pig', 'pen', 'sheep', 'cow', 'boy', 'girl',
  'dragon', 'butter', 'grass', 'hopper', 'jelly', 'pea', 'duck', 'lamb', 'bear',
  // play, school, going places
  'foot', 'base', 'basket', 'play', 'ground', 'game', 'toy', 'sail', 'boat',
  'air', 'plane', 'rail', 'road', 'way', 'car', 'port', 'bike', 'skate', 'board',
  'class', 'school', 'note', 'paper', 'pencil', 'lunch', 'bag', 'birth', 'party',
  // people and body
  'grand', 'mother', 'father', 'some', 'one', 'body', 'hand', 'finger', 'nail',
  'tooth', 'brush', 'hair', 'cut', 'eye', 'brow', 'key', 'lock', 'rope', 'print',
]);

/** Is this half of a compound a word a five-year-old owns on its own? */
export const isCompoundPartWord = (part: string | undefined): boolean =>
  !!part && COMPOUND_PART_WORDS.has(part.trim().toLowerCase());

/**
 * ⭐ THE DELETION GATE, and it is the one new content rule this ladder needed.
 *
 * `delete_compound` asks the child to SAY what is left, so the residue has to be
 * a word they can say. Deleting a part of an ordinary multisyllable word almost
 * never leaves one — "banana without ba" is "nana", "elephant without el" is
 * "ephant" — and a judged tutor asking for a nonword is asking for an answer
 * neither the child nor the judge can be confident about. Two-part COMPOUNDS
 * whose parts are both ordinary words are the shape that always works, and it is
 * also the shape the K classroom already uses ("say cowboy without cow").
 *
 * The parts are WORDS, not syllables: "dragon" is one part and two beats, which
 * is correct here and is why this mode is not called syllable deletion.
 */
export const deletionShapeIsValid = (
  parts: string[],
  removePart: string | undefined,
  residue: string | undefined,
): boolean => {
  if (parts.length !== 2) return false;
  const remove = (removePart ?? '').trim().toLowerCase();
  const left = (residue ?? '').trim().toLowerCase();
  if (!remove || !left || remove === left) return false;
  const lower = parts.map((p) => p.toLowerCase());
  if (!lower.includes(remove) || !lower.includes(left)) return false;
  // Both parts stand alone — one in the ask, one in the answer — so both must be
  // sayable, neither may be a single letter read as a letter NAME, and ⭐ both
  // must be actual words. The last clause is what refuses "peanut → pe|anut".
  return parts.every((p) => SAYABLE_PART.test(p) && p.length >= 2 && isCompoundPartWord(p))
    && isSayableSyllableWord(left);
};

/**
 * A syllable as a CHANT says it.
 *
 * A part that is one bare vowel letter reads as the letter NAME when a Live
 * model says it alone — "el … e … phant" comes out "el EE phant" — which is the
 * same defect `phonemeVoice` fixes for phonemes by spelling them out, one level
 * down. An interior or final lone vowel in English is a schwa essentially
 * without exception ("el|e|phant", "ther|mom|e|ter", "ba|nan|a"), so it is
 * spelled the way it is said. Both of those splits came out of the live probe.
 */
export const chantPart = (part: string): string =>
  /^[aeiou]$/i.test(part) ? 'uh' : part;

/** The spoken walk: the parts, voice-safe, one beat apart. */
export const chantOf = (parts: string[]): string =>
  parts.map(chantPart).join(' … ');

// ── The model word — a worked example the session never asks about ──────────

/**
 * The pool the `count_parts` and `blend_syllables` how-to-plays demonstrate on.
 * Deliberately mundane, clearly segmented, and spread across three counts so
 * `pickModelWord` can always find one whose count is NOT the item's own answer —
 * a demo that says "two parts" before a two-part item has handed the answer over.
 */
export const MODEL_WORDS: readonly SyllableModelWord[] = [
  { word: 'pencil', parts: ['pen', 'cil'], count: 'two' },
  { word: 'napkin', parts: ['nap', 'kin'], count: 'two' },
  { word: 'umbrella', parts: ['um', 'brel', 'la'], count: 'three' },
  { word: 'dinosaur', parts: ['di', 'no', 'saur'], count: 'three' },
  { word: 'helicopter', parts: ['hel', 'i', 'cop', 'ter'], count: 'four' },
  { word: 'alligator', parts: ['al', 'li', 'ga', 'tor'], count: 'four' },
];

/**
 * The `delete_compound` demo pool. Separate from `MODEL_WORDS` because a
 * deletion demo has to satisfy the deletion gate itself — two parts, both of
 * them words a five-year-old owns — and none of the counting models does.
 */
export const DELETION_MODEL_WORDS: readonly SyllableModelWord[] = [
  { word: 'sunhat', parts: ['sun', 'hat'], count: 'two' },
  { word: 'bedtime', parts: ['bed', 'time'], count: 'two' },
  { word: 'toothbrush', parts: ['tooth', 'brush'], count: 'two' },
];

/**
 * A model word for an item of `partCount`, avoiding every word the session
 * asks about. Returns null when nothing survives — the how-to-play then states
 * the rule without a worked example, which drops a SCAFFOLD rather than
 * degrading an ask.
 *
 * `partCount` is only meaningful for `count_parts`, whose demo would otherwise
 * speak this item's own answer; pass 0 on the other tasks, where the demo just
 * has to be a different WORD.
 */
export const pickModelWord = (
  partCount: number,
  sessionWords: ReadonlySet<string> = new Set(),
  pool: readonly SyllableModelWord[] = MODEL_WORDS,
): SyllableModelWord | null =>
  pool.find(
    (m) => m.parts.length !== partCount && !sessionWords.has(m.word.toLowerCase()),
  ) ?? null;

// ── Item building — the gates live HERE, not in prose ───────────────────────

export interface SyllableChallengeLike {
  id: string;
  word?: string;
  syllables?: string[];
  syllableCount?: number;
  imageDescription?: string;
  /** The TASK IDENTITY. Legacy payloads carrying a word-length band
   *  ('easy'|'medium'|'hard') resolve to `count_parts`, which is the only act
   *  those payloads ever meant. */
  challengeType?: string;
  /** `delete_compound` — the part the ask takes away. */
  removePart?: string;
  /** `delete_compound` — the real word left behind. */
  residue?: string;
  /** Tier lever (generator-stamped): voice the stimulus a second time. */
  echoWordSlowly?: boolean;
  /** Tier lever (generator-stamped): invite the hands. */
  inviteClap?: boolean;
}

/** Legacy band values mean the counting act and nothing else. */
export const taskOf = (challengeType: string | undefined): SyllableTask =>
  isSyllableTask(challengeType) ? challengeType : 'count_parts';

/**
 * Build one judged item, or return null to DROP the challenge — an item that
 * cannot be asked or judged honestly ships nothing, never a degraded ask.
 *
 * Drop reasons:
 *  - the word is not one sayable word (a phrase, a digit, model deliberation,
 *    or a string that would open a sentence with a verdict sentinel);
 *  - the parts do not spell the word (a chant would say a different word);
 *  - a part is not sayable on its own (it is chanted as a beat);
 *  - the count falls outside the TASK's window (1..5 counting, 2..4 blending,
 *    exactly 2 deleting);
 *  - ⭐ the word's syllable count is not one number in English (see
 *    `DIALECT_VARIABLE_WORDS`) — there is no defensible answer to grade;
 *  - ⭐ the split makes a beat out of a silent final e (see
 *    `endsWithSilentESyllable`) — the parts spell the word and the COUNT is
 *    still wrong, which is the one thing the join gate cannot see;
 *  - ⭐ a deletion item whose residue is not one of its own two parts, or is
 *    not independently sayable (see `deletionShapeIsValid`).
 *
 * `syllableCount` from the model is IGNORED: the length of the split is the
 * answer, and the two disagreeing is precisely the shape the join gate exists
 * to catch.
 */
export const itemFromChallenge = (
  ch: SyllableChallengeLike,
  sessionWords: ReadonlySet<string> = new Set(),
): SyllableClapperItem | null => {
  const word = (ch.word ?? '').trim();
  const parts = (ch.syllables ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  const task = taskOf(ch.challengeType);
  const shape = syllableTaskShape(task);

  if (!isSayableSyllableWord(word)) return null;
  if (!hasStableSyllableCount(word)) return null;
  if (parts.length < Math.max(MIN_PARTS, shape.partsMin)) return null;
  if (parts.length > Math.min(MAX_PARTS, shape.partsMax)) return null;
  if (parts.some((p) => !SAYABLE_PART.test(p))) return null;
  if (!syllablesJoinToWord(word, parts)) return null;
  if (endsWithSilentESyllable(parts)) return null;

  const removePart = (ch.removePart ?? '').trim();
  const residue = (ch.residue ?? '').trim();
  if (shape.needsResidue && !deletionShapeIsValid(parts, removePart, residue)) return null;

  const answer = task === 'count_parts' ? COUNT_WORDS[parts.length]
    : task === 'blend_syllables' ? word
      : residue;
  if (!answer) return null;

  const modelPool = task === 'delete_compound' ? DELETION_MODEL_WORDS : MODEL_WORDS;
  const model = pickModelWord(task === 'count_parts' ? parts.length : 0, sessionWords, modelPool);

  const echoSlowly = ch.echoWordSlowly !== false;
  const inviteClap = ch.inviteClap !== false;
  const base = {
    task, word, parts, answer, removePart, residue, echoSlowly, inviteClap, model,
  };
  const ask = askFrom(base);
  const plan = syllableClapperModePlan({ id: ch.id, challengeType: task, ask, answer });

  return {
    id: ch.id,
    answerKind: plan.answerStep.answerKind,
    responseClass: plan.answerStep.responseClass,
    actionContract: plan.answerStep.actionContract,
    action: plan.groupingKey,
    task,
    word,
    parts,
    answer,
    partCount: parts.length,
    ...(task === 'delete_compound' ? { removePart, residue } : {}),
    band: bandForParts(parts.length),
    imageDescription: ch.imageDescription,
    echoSlowly,
    inviteClap,
    model,
  };
};

/**
 * All buildable items, in order.
 *
 * ⭐ THE SESSION-LEVEL GATE: a word is ASKED ABOUT ONCE, whatever the act. It
 * was always true that asking "how many parts in tiger?" twice is recall rather
 * than a second measurement, and the three-act ladder makes it bite HARDER, not
 * less: `blend_syllables` chants the parts of its word, which is the answer to
 * that word's `count_parts` item, and `count_parts` says the word, which is the
 * answer to its `blend_syllables` item. Keying the gate on the WORD rather than
 * on the item closes both directions at once.
 *
 * A REPEATED COUNT is deliberately NOT a leak (phoneme-explorer's segment
 * ruling): three parts twice over is the curriculum, not a handover — the answer
 * is arithmetic about a new word, not a word the session already spoke.
 */
export const itemsFromChallenges = (
  challenges: SyllableChallengeLike[],
): SyllableClapperItem[] => {
  const sessionWords = new Set(
    challenges.map((ch) => (ch.word ?? '').trim().toLowerCase()).filter(Boolean),
  );
  const kept: SyllableClapperItem[] = [];
  const asked = new Set<string>();

  for (const ch of challenges) {
    const item = itemFromChallenge(ch, sessionWords);
    if (!item) continue;
    const key = item.word.toLowerCase();
    if (asked.has(key)) continue;
    asked.add(key);
    kept.push(item);
  }
  return kept;
};

// ── How-to-play — inside the quoted line (SWAP-1), spoken once per act ──────

/** The parts of the ask that every builder below needs, before an item exists. */
type AskFields = Pick<
  SyllableClapperItem,
  'task' | 'word' | 'parts' | 'answer' | 'echoSlowly' | 'inviteClap' | 'model'
> & { removePart?: string; residue?: string };

/**
 * The rule, plus the worked example when a safe model exists.
 *
 * It rides `opening || howToPlay`, and the runner re-speaks it when the ACT
 * changes (`action` is the task), never when only the word changes. That is the
 * shipped lead-in rule: if the model line does not change when the item changes,
 * it is established once, not recited (rhyme-studio and letter-spotter, both
 * ruled 2026-08-13).
 */
export const howToPlayFor = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    const demo = item.model
      ? `Watch me first: ${chantOf(item.model.parts)}. That is ${item.model.word}. `
      : '';
    return `Words are made of parts, and we can put them back together! ${demo}`;
  }
  if (item.task === 'delete_compound') {
    const demo = item.model
      ? `Watch me first: ${item.model.word} without ${item.model.parts[0]} is ${item.model.parts[1]}. `
      : '';
    return `Words are made of parts, and we can take one away! ${demo}`;
  }
  const demo = item.model
    ? `Watch me first: ${item.model.word}. ${cap(chantOf(item.model.parts))}. `
      + `That is ${item.model.count} parts. `
    : '';
  return `Words are made of parts, and we can hear them! ${demo}`;
};

// ── The ask — the problem STATED aloud, one defensible answer ───────────────

const askFrom = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    const chant = chantOf(item.parts);
    const echo = item.echoSlowly ? ` Again: ${chant}.` : '';
    return `Listen: ${chant}.${echo} Your turn. Put the parts together. What word is that?`;
  }
  if (item.task === 'delete_compound') {
    const echo = item.echoSlowly ? ` Again, slowly: ${item.word}.` : '';
    return `Listen: ${item.word}.${echo} Your turn. Say ${item.word} without ${item.removePart}.`;
  }
  const echo = item.echoSlowly ? ` Again, slowly: ${item.word}.` : '';
  const hands = item.inviteClap
    ? `Clap the parts with your hands, then tell me how many parts in ${item.word}.`
    : `How many parts in ${item.word}?`;
  return `Listen: ${item.word}.${echo} Your turn. ${hands}`;
};

export const askFor = (item: AskFields): string => askFrom(item);

/** The re-elicit tail a correction ends on — the ask's question, without its
 *  stimulus, because the correction has just voiced that itself. */
const reElicit = (item: AskFields): string =>
  item.task === 'blend_syllables' ? 'Put the parts together. What word is that?'
    : item.task === 'delete_compound' ? `Say ${item.word} without ${item.removePart}.`
      : `How many parts in ${item.word}?`;

// ── Correction — DISTAR re-model then re-elicit; the answer is EARNED here ──

/**
 * The chant lives HERE on `count_parts`, and only here.
 *
 * ⚠️ CLICK-ERA REQUIREMENT RE-BASED, NOT DROPPED. The old hard tier told the
 * tutor to say the word "NATURALLY and WHOLE" on a miss and never to break it
 * into parts, "the segmentation is exactly what they are producing". What that
 * protected is real — do not hand the count over before the child has tried —
 * and the judged loop enforces it STRUCTURALLY: a correction only exists after
 * an attempt has been judged. Withholding the model at hard would leave a child
 * who has already missed with nothing to learn from, which is the opposite of
 * DISTAR. So every tier gets the chant, and no tier gets it early.
 */
export const correctionFor = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    return `My turn: ${chantOf(item.parts)}. ${cap(item.word)}. Your turn. ${reElicit(item)}`;
  }
  if (item.task === 'delete_compound') {
    return `My turn: ${item.word} without ${item.removePart} is ${item.residue}. `
      + `Your turn. ${reElicit(item)}`;
  }
  return `My turn: ${item.word}. ${cap(chantOf(item.parts))}. `
    + `${cap(item.answer)} ${partsWord(item.parts.length)}. `
    + `Your turn. ${reElicit(item)}`;
};

export const affirmFor = (item: AskFields): string =>
  item.task === 'count_parts'
    ? `Yes, ${item.answer} ${partsWord(item.parts.length)}.`
    : `Yes, ${item.answer}.`;

// ── Judging contract ───────────────────────────────────────────────────────

/**
 * ⭐ THE ENUNCIATION CONTRACT — the pack's whole instrument, stated as FACTS
 * about the turn rather than as orders (an imperative aimed at the tutor gets
 * PERFORMED: ten-frame read "[WAIT silently]" to a child).
 *
 * Two levers reach a Live model's delivery and this uses both. ORTHOGRAPHY is
 * the strong one — the ask and the correction write "but … ter … fly", and a
 * model reads the pauses it is given, which is the same lever `phonemeVoice`
 * uses when it spells a short /a/ as "aaa". A stated MANNER is the weak one, and
 * it is all there is for "slower but still joined", because English has no
 * spelling for it; that rung is knowingly softer than the other two.
 *
 * ⭐ THE CONTRACT INVERTS BETWEEN THE ACTS, which is why it is built per task
 * rather than stated once: on `count_parts` and `delete_compound` the word is
 * ONE JOINED STREAM and breaking it hands the answer over, while on
 * `blend_syllables` the broken form IS the question and joining it hands the
 * answer over instead.
 */
const enunciationContract = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    return `The parts are said ONE AT A TIME with a clear pause between them, exactly as the line `
      + `writes them, and the whole word "${item.word}" is never said in your ask — the joined word `
      + `is the answer. `
      + (item.echoSlowly ? `The second saying is the same parts again, unhurried. ` : '');
  }
  return `The word "${item.word}" is spoken as ONE JOINED STREAM every time it appears in your ask, `
    + `at an even, unhurried pace, and never broken into parts — the parts are the answer. `
    + (item.echoSlowly
      ? `The second saying is slower and more drawn out than the first, still one unbroken stream. `
      : '')
    + `In the correction line the parts are said one at a time with a clear pause between them, `
    + `exactly as that line writes them. `;
};

/**
 * 18d. Consumed from `wordWorkoutScript`'s `TWO_BRANCH_LAW` (picture-vocabulary's
 * extended wording, which carries the `no scaffolding line` clause), byte-shared
 * so a grep finds every copy.
 *
 * Stated BEFORE the branches because the defect it fixes is a reply that is
 * NEITHER branch: a re-spoken ask, a hint, or improvised praise opens with
 * neither sentinel, so the reducer records no verdict, the correction counter
 * freezes, and the child waits on a tutor that has already spoken.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's measured version. It earns its
 * place here twice over: this is a listening task with a near-empty screen, so
 * the tutor holds long silences with nothing to narrate, and "announce that you
 * are waiting" is exactly the filler a model reaches for — filler that opens
 * with neither sentinel.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * What the right answer sounds like when it does not look right, and what the
 * wrong one sounds like when it does. One clause per act, because each act has
 * a different near-miss:
 *
 *  - `count_parts` — the ACCEPT side has to allow a count said aloud, because
 *    that is how a five-year-old counts, and that clause opens a hole: a walk
 *    that runs one PAST the total speaks the answer word mid-stream and lands
 *    somewhere else. It is the one wrong answer a string-matching judge affirms.
 *  - `blend_syllables` — the child is handed the parts, so the near-miss is
 *    saying them BACK, still separated. That is an echo, not a blend, and it is
 *    the exact thing the mode exists to measure.
 *  - `delete_compound` — two near-misses, and both are already in the ask: the
 *    whole word said back, and the part that was taken away.
 */
const nearMissClause = (item: AskFields): string => {
  if (item.task === 'blend_syllables') {
    return `Saying the parts back one at a time, still separated, is NOT the answer — the parts were `
      + `given to them, and joining them is the whole task; wait, and if that is their answer it is wrong. `
      + `One part on its own is wrong. A different word is wrong, however confidently it is said. `;
  }
  if (item.task === 'delete_compound') {
    return `Saying the whole word "${item.word}" back is wrong — it contains the answer inside it, and `
      + `repeating the stimulus is not taking a part away. Saying "${item.removePart}", the part that was `
      + `taken AWAY, is wrong. A different word is wrong, however confidently it is said. `;
  }
  return `Counting the parts aloud and LANDING on "${item.answer}" counts — the last number they say is their answer. `
    + `The number alone counts, and so does the number inside a little phrase. `
    + `Saying the word "${item.word}" back, or saying its parts without a number, is not yet an answer — wait for a number. `
    + `A count that runs PAST "${item.answer}" is WRONG even though "${item.answer}" was said along the way — `
    + `only the number they land on is their answer. A different number is wrong, however confidently it is said. `;
};

const judgingContract = (item: AskFields): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
  + `listens${item.task === 'count_parts' ? ', claps' : ''} and thinks, and their think time is unbounded. `
  + `Never say the answer during their turn. `
  + enunciationContract(item)
  + `The correct answer is "${item.answer}". `
  + (item.task === 'count_parts' ? '' : `The answer alone counts, and so does the answer inside a little phrase. `)
  + nearMissClause(item)
  + TWO_BRANCH_LAW
  + `If the answer is right, say exactly: "${affirmFor(item)}" `
  + `If it is wrong, say exactly: "${correctionFor(item)}"`;

// ── Cues ───────────────────────────────────────────────────────────────────

export interface SyllableCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1). */
export const itemCue = (
  item: SyllableClapperItem,
  opts: SyllableCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! ' : '';
  const how = opts.opening || opts.howToPlay ? howToPlayFor(item) : '';
  return `[SC_ITEM] Say exactly: "${greeting}${how}${askFor(item)}" `
    + `${judgingContract(item)} ${NEVER_PERFORM}`;
};

/** Correction cap reached: acknowledge warmly and carry the lesson forward. */
export const moveOnCue = (
  item: SyllableClapperItem,
  next: SyllableClapperItem | null,
  opts: SyllableCueOptions = {},
): string => {
  if (!next) {
    return `[SC_MOVE] Say exactly: "Good listening! Word parts take practice — we will work on that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[SC_MOVE] Say exactly: "Good listening! Here comes the next word. ${how}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[SC_COMPLETE] Say exactly: "What great listening today! Your ears found the parts in every word. See you next time!" `
  + `Then stop — the activity is over.`;

/** Tap-to-hear the whole question again. Question side only — every ask states
 *  its stimulus and withholds its answer, so there is nothing here to hide. */
export const pronounceCue = (item: SyllableClapperItem): string =>
  `[SC_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + enunciationContract(item)
  + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
  + NEVER_PERFORM;

/**
 * Tap-to-hear ONE part, from the reveal bar.
 *
 * This is the click era's `[PRONOUNCE_SYLLABLE]` kept, and it is safe for the
 * one reason that channel was ever safe here: the bar exists only after the
 * tutor has affirmed, so the answer is already public. Pre-affirm there is no
 * bar to tap.
 */
export const hearPartCue = (part: string): string =>
  `[SC_HEAR] Say ONLY this word part, once, clearly: "${part}" `
  + `Do not spell it, do not say the whole word, and add nothing. ${NEVER_PERFORM}`;

/**
 * Runtime state pushed through the context channel — QUESTION SIDE ONLY.
 *
 * ⭐ IT IS NOT ALWAYS THE WORD, and getting that wrong would push the answer.
 * On `blend_syllables` the question is the CHANT and the word is the answer, so
 * the word must never cross this channel; on the other two acts the word IS the
 * question and the answer is a count or a residue.
 */
export const stimulusFor = (item: SyllableClapperItem): string =>
  item.task === 'blend_syllables' ? chantOf(item.parts) : item.word;

// ── The cue surface — the ONE place the tutor's side of this pack is declared ─

/**
 * Everything of this pack that can reach the tutor, exported once so the
 * component and the DI drive-plan endpoint read the SAME strings. A harness
 * that re-typed these would test a fiction (19f found exactly that drift on both
 * sides of letter-spotter's wire); the component spreads this and adds only what
 * the screen owns — `statusLines` and `diagnosisObservation`.
 */
export const syllableClapperPackBase = (
  items: SyllableClapperItem[],
): JudgedCueSurface<SyllableClapperItem> => ({
  primitiveType: 'syllable-clapper',
  activityLine: 'live direct instruction syllable practice — blending, counting and deleting parts',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.task,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface SyllableHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string | string[];
}

/** Plain-wrong words for the two production acts: ordinary, unrelated, and
 *  never a part of the item's own word. */
const DECOY_WORDS = ['table', 'window', 'garden', 'rocket', 'ladder'];

const decoyFor = (item: SyllableClapperItem): string =>
  DECOY_WORDS.find((w) => w !== item.word.toLowerCase() && !item.parts.includes(w))
  ?? 'ladder';

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `judgingContract` above CLAIMS the judge
 * refuses each of these. Change one, change both.
 *
 * ⭐ EVERY ACT'S SIGNATURE WRONG IS THE HOLE ITS OWN ASK OPENS, and that is the
 * single most useful thing this file records:
 *
 *  - `count_parts` — a five-year-old counts out loud, so "one, two, three" has
 *    to be accepted for a three-part word, which means "one, two, three, four"
 *    on that same word contains the correct answer word, spoken fluently, in a
 *    natural counting rhythm, and is wrong. Only reading the LANDING separates
 *    them. Over-counting is this primitive's documented commonest error.
 *  - `blend_syllables` — the ask HANDS the child the parts, so the fluent wrong
 *    answer is those parts said straight back, unjoined. It is the word-sorter
 *    echo in a mode where the echo is made of the answer's own pieces.
 *  - `delete_compound` — the ask says the whole word, and the whole word
 *    CONTAINS the residue as a substring. A judge scoring on string overlap
 *    affirms it every time; only performing the deletion separates them.
 *
 * LEAK SPANS. `count_parts` issues none and the oracle stays FLAT — its ask
 * carries no number at all. The other two acts must state a stimulus that
 * contains their answer (the chant is made of the word's letters; "cupcake"
 * contains "cake"), so each subtracts exactly that stimulus and nothing else,
 * leaving the greeting, the how-to-play, the question and the hand-over live.
 */
export const syllableClapperHarnessAnswers = (
  item: SyllableClapperItem,
): SyllableHarnessAnswers => {
  if (item.task === 'blend_syllables') {
    return {
      correct: item.word,
      plainWrong: decoyFor(item),
      signatureWrong: {
        text: item.parts.map(chantPart).join(', '),
        why:
          'the parts said straight back, still separated — the ask handed them over, so this is an '
          + 'echo of the stimulus rather than the blend, and it is made entirely of the answer\'s own pieces',
      },
      leakTokens: [item.word],
      leakExemptSpan: [chantOf(item.parts)],
    };
  }

  if (item.task === 'delete_compound') {
    return {
      correct: item.answer,
      // The part taken AWAY — named in the ask, and the commonest real error.
      plainWrong: item.removePart ?? decoyFor(item),
      signatureWrong: {
        text: item.word,
        why:
          'the stimulus echoed instead of the deletion performed — and the whole word CONTAINS the '
          + 'residue as a substring, so a judge scoring on overlap affirms it every time',
      },
      leakTokens: [item.answer],
      leakExemptSpan: [item.word],
    };
  }

  const n = item.partCount;
  return {
    correct: item.answer,
    // A real alternative count inside the pedagogic range, never the answer and
    // never the one-past walk (which is the signature miss, tested separately).
    plainWrong: COUNT_WORDS[n === 1 ? 3 : 1],
    signatureWrong: {
      text: COUNT_WORDS.slice(1, n + 2).join(', '),
      why:
        'a fluent count that runs ONE PAST the total — it speaks the answer word mid-stream but '
        + 'lands elsewhere, which is exactly the hole the "a count that LANDS on the answer counts" '
        + 'clause opens, and over-counting is this primitive\'s documented commonest error',
    },
    leakTokens: [item.answer],
  };
};
