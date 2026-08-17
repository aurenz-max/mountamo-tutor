/**
 * syllableClapperScript — HAND-AUTHORED judged-loop script for syllable-clapper
 * (qa/di/BACKLOG.md item 16). The exact wording IS the pedagogy; item CONTENT
 * stays generator-scoped. This module owns the cue shapes, the in-band judging
 * contracts, and the content gates — which the generator IMPORTS rather than
 * copies, so both sides of the wire can never disagree about what is askable.
 *
 * ── THE PORT IN ONE LINE ────────────────────────────────────────────────────
 * The tutor says the word with purposeful enunciation, the child claps it with
 * their own hands and SAYS how many parts, and her verdict is the advance.
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
 * ask invites the hands ("Clap the parts with your hands, then tell me how many")
 * and the child's hands are their own, invisible to us exactly as they are to a
 * teacher whose real signal is the spoken count. What the screen loses is the
 * apparatus a table does not have: the tally, the count echo, the Check button,
 * the Undo, the Next, the three-attempt reveal ladder, and the directional miss
 * hint ("too many claps") that turned a 1-to-4 answer space into a binary search
 * nobody could fail.
 *
 * ── THE ANSWER MATERIAL (Step 1 fork) ───────────────────────────────────────
 * One action, `count-parts`, in all three word-length bands: the answer is a
 * COUNT, a child says a count out loud to a teacher, so every item is VOICE and
 * the response class is `number_word_to_20` (benched; counts floor at 1 here, so
 * the excluded zero never arises). There is no gesture mode, because none of the
 * three unsayable shapes applies — a count is not a position, a form, or a build.
 *
 * ── PURPOSEFUL ENUNCIATION IS A LADDER, NOT A STYLE (the port's design core) ─
 * There are exactly three honest ways to voice a word for a syllable task, and
 * they are not interchangeable:
 *
 *   1. CHANTED IN PARTS  "but … ter … fly"  — hands the count over. Legal ONLY
 *      in the correction (post-attempt, so it is earned) and on a MODEL WORD the
 *      session never asks about.
 *   2. STRETCHED BUT JOINED — slower, drawn out, one unbroken stream. Supports
 *      without handing anything over. The `easy` rung's second saying.
 *   3. WHOLE AT NATURAL PACE — the real listening task. Every ask, every tier.
 *
 * ⚠️ THE CLICK ERA HAD THIS EXACTLY BACKWARDS, and its own reveal policy says so
 * in one breath: it told the tutor to "never state the NUMBER of parts before the
 * student claps" and, at the easy tier, to "say the word broken into its parts
 * with clear pauses and clap along" — as the SCAFFOLD. Saying the parts IS
 * stating the number, in a different currency. Three beats is three. So the
 * DISTAR model runs on a model word picked IN CODE that the session never asks
 * about (`pickModelWord`, gated on BOTH counts and session membership), and the
 * target word is one joined stream every time the ask utters it.
 *
 * ── SUPPORT TIERS SURVIVE AS ASK LEVERS ─────────────────────────────────────
 *   easy   → the ask says the word twice (natural, then slower and drawn out)
 *            and invites the hands.
 *   medium → once, natural; still invites the hands.
 *   hard   → once, natural, and the CLAP INVITATION IS WITHDRAWN — the motor
 *            scaffold goes and the segmenting happens in the ear alone.
 * The spoken word itself is never withdrawn at any tier (it is the stimulus of a
 * listening task), and neither is tap-to-hear.
 *
 * ── THE CONTENT GATE THAT WRITING THE SPOKEN ASK PRODUCED ───────────────────
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
 * Sentinels are the engine defaults ("Yes" / "My turn") — collision-checked by
 * validateJudgedScriptPack in this pack's test file.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

/** The WORD-LENGTH band (this primitive's eval mode). NOT the support tier,
 *  which reuses the same three words for how much help the child gets. */
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
  /** The word, spoken and never printed before the affirmation. */
  word: string;
  /** The real syllable split, joined for the correction's chant. */
  parts: string[];
  /** The answer: how many parts, as a number WORD ("three"). */
  answer: string;
  /** The same count as a number, for the stage's reveal and the metrics. */
  partCount: number;
  /** The word-length band — the eval mode, pushed as `challengeType`. */
  band: SyllableBand;
  /** Reveal-only caption; never rendered before the affirmation. */
  imageDescription?: string;
  /** Tier lever: the ask says the word a second time, slower and still joined. */
  echoSlowly: boolean;
  /** Tier lever: the ask invites the hands. Withdrawn at the hard tier. */
  inviteClap: boolean;
  /** The how-to-play's worked example, or null when no safe model word exists
   *  (the rule is then stated without one — a dropped SCAFFOLD, never a
   *  degraded ask). */
  model: SyllableModelWord | null;
}

/** One action, so the how-to-play speaks on the opening and never again — the
 *  band changes the WORD, not what the child is being asked to do. */
export const SYLLABLE_ACTION = 'count-parts';

export const responseClassFor = (): ResponseClassId => 'number_word_to_20';

// ── Number words ────────────────────────────────────────────────────────────

/** Indices 1-5 are the answers the build gate admits; 'six' exists only so the
 *  harness can build a count that runs one PAST a five-part word. */
const COUNT_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** The pedagogic range. 1-4 is the primitive's declared band; 5 is admitted
 *  because the shipped `hard` prompt names "refrigerator" (re·frig·er·a·tor),
 *  and refusing a legitimate hard word is a supply bug, not a safety gate. */
export const MIN_PARTS = 1;
export const MAX_PARTS = 5;

const partsWord = (n: number) => (n === 1 ? 'part' : 'parts');
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

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

/** A syllable is chanted aloud on its own in the correction, so it has to be
 *  pronounceable letters — nothing else can be said as a beat. */
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
 *      The shipped `hard` prompt asked for exactly these ("comfortable",
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
 * A syllable as the CORRECTION chants it.
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

/** The correction's spoken walk: the parts, voice-safe, one beat apart. */
export const chantOf = (parts: string[]): string =>
  parts.map(chantPart).join(' … ');

// ── The model word — a worked example the session never asks about ──────────

/**
 * The pool the how-to-play demonstrates on. Deliberately mundane, clearly
 * segmented, and spread across three counts so `pickModelWord` can always find
 * one whose count is NOT the item's own answer — a demo that says "two parts"
 * before a two-part item has handed the answer over.
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
 * A model word for an item of `partCount`, avoiding every word the session
 * asks about. Returns null when nothing survives — the how-to-play then states
 * the rule without a worked example, which drops a SCAFFOLD rather than
 * degrading an ask.
 */
export const pickModelWord = (
  partCount: number,
  sessionWords: ReadonlySet<string> = new Set(),
): SyllableModelWord | null =>
  MODEL_WORDS.find(
    (m) => m.parts.length !== partCount && !sessionWords.has(m.word.toLowerCase()),
  ) ?? null;

// ── Item building — the gates live HERE, not in prose ───────────────────────

export interface SyllableChallengeLike {
  id: string;
  word?: string;
  syllables?: string[];
  syllableCount?: number;
  imageDescription?: string;
  challengeType?: string;
  /** Tier lever (generator-stamped): say the word a second time, slower. */
  echoWordSlowly?: boolean;
  /** Tier lever (generator-stamped): invite the hands. */
  inviteClap?: boolean;
}

/**
 * Build one judged item, or return null to DROP the challenge — an item that
 * cannot be asked or judged honestly ships nothing, never a degraded ask.
 *
 * Drop reasons:
 *  - the word is not one sayable word (a phrase, a digit, model deliberation,
 *    or a string that would open a sentence with a verdict sentinel);
 *  - the parts do not spell the word (the correction would chant a different
 *    word at the child);
 *  - a part is not sayable on its own (it is chanted as a beat);
 *  - the count falls outside 1..5 (outside the benched, pedagogic range);
 *  - ⭐ the word's syllable count is not one number in English (see
 *    `DIALECT_VARIABLE_WORDS`) — there is no defensible answer to grade;
 *  - ⭐ the split makes a beat out of a silent final e (see
 *    `endsWithSilentESyllable`) — the parts spell the word and the COUNT is
 *    still wrong, which is the one thing the join gate cannot see.
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

  if (!isSayableSyllableWord(word)) return null;
  if (!hasStableSyllableCount(word)) return null;
  if (parts.length < MIN_PARTS || parts.length > MAX_PARTS) return null;
  if (parts.some((p) => !SAYABLE_PART.test(p))) return null;
  if (!syllablesJoinToWord(word, parts)) return null;
  if (endsWithSilentESyllable(parts)) return null;

  const band: SyllableBand =
    ch.challengeType === 'medium' || ch.challengeType === 'hard' ? ch.challengeType : 'easy';

  return {
    id: ch.id,
    answerKind: 'voice',
    responseClass: responseClassFor(),
    action: SYLLABLE_ACTION,
    word,
    parts,
    answer: COUNT_WORDS[parts.length],
    partCount: parts.length,
    band,
    imageDescription: ch.imageDescription,
    echoSlowly: ch.echoWordSlowly !== false,
    inviteClap: ch.inviteClap !== false,
    model: pickModelWord(parts.length, sessionWords),
  };
};

/**
 * All buildable items, in order.
 *
 * ⭐ THE SESSION-LEVEL GATE: a word is ASKED ABOUT ONCE. Asking "how many parts
 * in tiger?" twice is not a second measurement, it is recall — and because the
 * ask names the word and every close (affirmation or capped move-on) names the
 * count, the second item is answered before it is asked. Neither item is wrong
 * alone, which is why this cannot be a per-item gate. It also guarantees the
 * family's byte-identical-consecutive-ask gate can never fire on this pack:
 * every ask contains its own word.
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

// ── How-to-play — inside the quoted line (SWAP-1), spoken once per run ──────

/**
 * The rule, plus the worked example when a safe model word exists.
 *
 * It rides `opening || howToPlay` only, and this pack has ONE action, so it is
 * spoken exactly once per session. That is the shipped lead-in rule: if the
 * model line does not change when the item changes, it is established once, not
 * recited (rhyme-studio and letter-spotter, both ruled 2026-08-13).
 */
export const howToPlayFor = (item: SyllableClapperItem): string => {
  const demo = item.model
    ? `Watch me first: ${item.model.word}. ${cap(chantOf(item.model.parts))}. `
      + `That is ${item.model.count} parts. `
    : '';
  return `Words are made of parts, and we can hear them! ${demo}`;
};

// ── The ask — the problem STATED aloud, one defensible answer ───────────────

export const askFor = (item: SyllableClapperItem): string => {
  const echo = item.echoSlowly ? ` Again, slowly: ${item.word}.` : '';
  const hands = item.inviteClap
    ? `Clap the parts with your hands, then tell me how many parts in ${item.word}.`
    : `How many parts in ${item.word}?`;
  return `Listen: ${item.word}.${echo} Your turn. ${hands}`;
};

// ── Correction — DISTAR re-model then re-elicit; the answer is EARNED here ──

/**
 * The chant lives HERE and only here.
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
export const correctionFor = (item: SyllableClapperItem): string =>
  `My turn: ${item.word}. ${cap(chantOf(item.parts))}. `
  + `${cap(item.answer)} ${partsWord(item.partCount)}. `
  + `Your turn. How many parts in ${item.word}?`;

export const affirmFor = (item: SyllableClapperItem): string =>
  `Yes, ${item.answer} ${partsWord(item.partCount)}.`;

// ── Judging contract ───────────────────────────────────────────────────────

/**
 * ⭐ THE ENUNCIATION CONTRACT — the port's whole instrument, stated as FACTS
 * about the turn rather than as orders (an imperative aimed at the tutor gets
 * PERFORMED: ten-frame read "[WAIT silently]" to a child).
 *
 * Two levers reach a Live model's delivery and this uses both. ORTHOGRAPHY is
 * the strong one — the correction writes "but … ter … fly", and a model reads
 * the pauses it is given, which is the same lever `phonemeVoice` uses when it
 * spells a short /a/ as "aaa". A stated MANNER is the weak one, and it is all
 * there is for "slower but still joined", because English has no spelling for
 * it; that rung is knowingly softer than the other two.
 */
const enunciationContract = (item: SyllableClapperItem): string =>
  `The word "${item.word}" is spoken as ONE JOINED STREAM every time it appears in your ask, `
  + `at an even, unhurried pace, and never broken into parts — the parts are the answer. `
  + (item.echoSlowly
    ? `The second saying is slower and more drawn out than the first, still one unbroken stream. `
    : '')
  + `In the correction line the parts are said one at a time with a clear pause between them, `
  + `exactly as that line writes them. `;

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
 * wrong one sounds like when it does.
 *
 * The ACCEPT side has to allow a count said aloud, because that is how a
 * five-year-old counts — and that clause opens a hole, so the WRONG side names
 * the hole explicitly: a walk that runs one PAST the total speaks the answer
 * word mid-stream and lands somewhere else. It is the one wrong answer on this
 * port a string-matching judge affirms, and it is what the signature drive says.
 */
const judgingContract = (item: SyllableClapperItem): string =>
  `The quoted line is the ONLY thing you say on this turn; you then stay silent while the learner `
  + `listens, claps and thinks, and their think time is unbounded. Never say the answer during their turn. `
  + enunciationContract(item)
  + `The correct answer is "${item.answer}". `
  + `Counting the parts aloud and LANDING on "${item.answer}" counts — the last number they say is their answer. `
  + `The number alone counts, and so does the number inside a little phrase. `
  + `Saying the word "${item.word}" back, or saying its parts without a number, is not yet an answer — wait for a number. `
  + `A count that runs PAST "${item.answer}" is WRONG even though "${item.answer}" was said along the way — `
  + `only the number they land on is their answer. A different number is wrong, however confidently it is said. `
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
    return `[SC_MOVE] Say exactly: "Good listening! Word parts take practice — we will clap that one again another day." Then stop.`;
  }
  const how = opts.howToPlay ? howToPlayFor(next) : '';
  return `[SC_MOVE] Say exactly: "Good listening! Here comes the next word. ${how}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM}`;
};

export const completeCue = (): string =>
  `[SC_COMPLETE] Say exactly: "What great listening today! Your ears found the parts in every word. See you next time!" `
  + `Then stop — the activity is over.`;

/** Tap-to-hear the whole question again. Question side only — the ask carries
 *  no count, so there is nothing here to withhold. */
export const pronounceCue = (item: SyllableClapperItem): string =>
  `[SC_HEAR] The learner tapped to hear the word again. Say ONLY this, warmly, then wait: "${askFor(item)}" `
  + enunciationContract(item)
  + `Do not treat anything you just heard as an answer, add nothing, and never say how many parts it has. `
  + NEVER_PERFORM;

/**
 * Tap-to-hear ONE part, from the reveal bar.
 *
 * This is the click era's `[PRONOUNCE_SYLLABLE]` kept, and it is safe for the
 * one reason that channel was ever safe here: the bar exists only after the
 * tutor has affirmed, so the count is already public. Pre-affirm there is no
 * bar to tap.
 */
export const hearPartCue = (part: string): string =>
  `[SC_HEAR] Say ONLY this word part, once, clearly: "${part}" `
  + `Do not spell it, do not say the whole word, and add nothing. ${NEVER_PERFORM}`;

/** Runtime state pushed through the context channel — question side only. The
 *  word IS the question here; the answer is the count, which is never pushed. */
export const stimulusFor = (item: SyllableClapperItem): string => item.word;

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
  activityLine: 'live direct instruction syllable counting practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.band,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ─────

export interface SyllableHarnessAnswers {
  correct: string;
  plainWrong: string;
  signatureWrong?: { text: string; why: string };
  leakTokens: string[];
  leakExemptSpan?: string;
}

/**
 * The answers a headless student says on a judged drive. This lives beside the
 * contract it mirrors on purpose: `judgingContract` above CLAIMS the judge
 * refuses each of these. Change one, change both.
 *
 * ⭐ THE SIGNATURE WRONG IS THE HOLE THE ACCEPT CLAUSE OPENS. A five-year-old
 * counts out loud, so "one, two, three" has to be accepted for a three-part
 * word — which means "one, two, three, four" on that same word contains the
 * correct answer word, spoken fluently, in a natural counting rhythm, and is
 * wrong. Nothing a judge can do by string-matching separates them; only reading
 * the LANDING does. It is the same shape phoneme-explorer's `segment` and
 * counting-board's counted modes drive, and it is the one this port most needs
 * refused, because over-counting (a clap per phoneme, or an extra beat on the
 * last syllable) is this primitive's documented commonest error.
 *
 * NO `leakExemptSpan`: the ask never contains a number, so the oracle stays
 * FLAT. The how-to-play's worked example does say a count, and `pickModelWord`
 * guarantees it is never this item's.
 */
export const syllableClapperHarnessAnswers = (
  item: SyllableClapperItem,
): SyllableHarnessAnswers => {
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
