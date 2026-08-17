/**
 * wordSorterScript — HAND-AUTHORED judged-loop script for word-sorter
 * (SEVENTEENTH literacy DI port; qa/di/BACKLOG.md item 16). The exact wording IS
 * the pedagogy; these lines are authored per pack, never generated. Item CONTENT
 * (which words, which groups, which pairs) stays generator-scoped; this module
 * owns the cue shapes, the build gates, the tier ladder and the leak policy.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL THREE MODES ARE SPOKEN, and every tap is deleted. Picture a teacher at a
 * table with one child and two labelled mats:
 *
 *   "I say a word — you tell me which group it belongs with.
 *    Your turn. Listen: dog. Animals, or Food?"      → "Animals!"
 *   "Yes, dog belongs with Animals."
 *
 * That is DISTAR classification, and it is word-sorter's whole skill. The
 * arithmetic never reaches the class table's awkward end: the answer is a GROUP
 * NAME or a PARTNER WORD, both of which a five-year-old says across a table, so
 * step 1's first question ends the fork. `short_spoken_word` — one short word
 * from a closed per-item set — benched, and its precedent list already names
 * "naming/opposite", which is exactly `match_pairs`.
 *
 *   binary_sort   the answer is one of TWO group labels
 *   ternary_sort  the answer is one of THREE group labels
 *   match_pairs   the answer is one word from the printed bank
 *
 * THE COSTUME TEST IS WHAT DECIDES THE TAP, and it fails it outright: a child
 * who cannot categorise at all can still tap a bucket correctly at a 1-in-2
 * floor, be told instantly that it was wrong, and re-tap until it lands. The tap
 * produced no evidence of the skill; the category NAME does.
 *
 * WHAT IS NOT A COSTUME, and stays: the MATS. A sort whose groups are not
 * knowable is not a harder task, it is a broken one (letter-spotter's find-it
 * rule, arrived at from the other direction). The labels, their picture cues and
 * the word bank are the material a teacher lays on the table — the screen is the
 * PAGE. It is the ACTION that was the costume, never the paper (the ten-frame
 * R6 lesson).
 *
 * ── TWO THINGS THE CLICK ERA HID, WHICH THE MODALITY EXPOSES ───────────────
 *
 *  1. THE ELIMINATION LEAK. The click-era match column CONSUMED its entries: by
 *     the last pair exactly one option remained, so the final item of every
 *     match_pairs challenge was answerable with no reading at all. Under the
 *     judged loop one pair is one item, so the bank now stays WHOLE for the
 *     whole challenge — no elimination, a uniform N per item, and the
 *     support-tier decoys finally do the discrimination work they were added
 *     for.
 *  2. THE ANSWER WAS ON SCREEN BEFORE IT WAS EARNED. `showFiledWords` printed
 *     each sorted word inside its bucket, which is fine as PROGRESS and is kept
 *     — but the sorted-word badges now appear only for items the tutor has
 *     already affirmed, which is what they always meant.
 *
 * ── THE MENU IS INSIDE THE ASK, AND THAT IS THE ASK WORKING ────────────────
 *
 * "Animals, or Food?" contains the answer by construction — push-pull-arena's
 * shape, where the ask closes on a spoken menu. `leakExemptSpanFor` subtracts
 * exactly that clause and nothing else, so the greeting, the how-to-play, the
 * DISTAR lead-in and the hand-over all stay governed by a live oracle.
 *
 * AND THE EXEMPTION IS TIER-CONDITIONAL, which is letter-sound-link's pattern:
 * at `hard` for a reader the ask names NO groups (they are printed and the
 * student can read them), so there is no clause to subtract and the oracle goes
 * FLAT — the rung's whole point, and the one place a group name arriving through
 * the catalog would be caught. At Kindergarten the band floor beats the tier and
 * the groups are always named aloud, because a pre-reader cannot read a mat.
 *
 * The MATCH bank is printed and NEVER spoken — reciting five to eight words
 * every round is the recitation the 2026-08-13 rulings struck — so match items
 * carry no exemption at all and their oracle is flat at every tier.
 *
 * ── THE MODEL IS A STRATEGY, NEVER AN EXEMPLAR ─────────────────────────────
 *
 * Modelling a worked exchange ("My turn: apple — Food.") would say a group name
 * that is very often THIS item's answer, since the exemplar and the item come
 * from the same challenge. The family's model lines are strategy models for
 * exactly this reason (letter-spotter: "Listen for the sound at the very start
 * of the word"), so this pack's are too: the rule is modelled, the answer is
 * earned in the correction.
 *
 * ── CORRECTIONS NAME THE ANSWER, AND THAT IS DELIBERATE ────────────────────
 *
 * Unlike an initial-sound mapping, a category assignment is a FACT a child
 * either holds or does not — there is no route to re-model that stops short of
 * it, which is match-it's argument in letter-spotter and the reason its
 * correction names both cases. So the correction here is the full DISTAR
 * model-lead-test: name the fact, then re-elicit the same item. The measurement
 * stays honest because the runner scores a corrected item at 67 (or 33), never
 * at 100.
 *
 * ── SENTINELS ──────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by
 * `validateJudgedScriptPack` in this pack's test file. Every generated string
 * that can reach a spoken line — words, group labels, bank entries — is run
 * through `opensWithSentinel` and DROPPED on a hit, on both sides of the wire
 * (the generator imports these gates rather than copying them; the letter-spotter
 * 90-vs-100 drift is why).
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

export type WordSorterMode = 'binary_sort' | 'ternary_sort' | 'match_pairs';
export type WordSorterTier = 'easy' | 'medium' | 'hard';

/**
 * How the partner relates to the term, which is what lets the ask be a QUESTION
 * rather than a shrug. "Which word goes with big?" is answerable only because
 * the bank is printed; "Which word means the opposite of big?" is answerable
 * because it says what to look for, and that is the instruction the mode is
 * supposed to deliver.
 */
export type WordSorterRelation = 'opposite' | 'synonym' | 'plural' | 'rhyme' | 'partner';

// ── The item ────────────────────────────────────────────────────────────────

export interface WordSorterItem extends JudgedScriptItem {
  mode: WordSorterMode;
  tier: WordSorterTier;
  /** The challenge this item came from — the stage keeps one mat set per
   *  challenge, and the affirm reveal must not highlight the wrong one. */
  challengeId: string;
  /** The stimulus the tutor says and the card prints. sort: the word being
   *  classified. match: the term whose partner is wanted. NEVER the answer. */
  word: string;
  emoji?: string;
  /** sort: the correct group LABEL. match: the correct partner WORD. */
  answer: string;
  /** sort: every group label in screen order. match: the whole word bank,
   *  which does NOT shrink as items are solved (see the elimination leak). */
  choices: string[];
  /** Index-aligned with `choices`; '' where the generator supplied no picture. */
  choiceEmojis: string[];
  /** match only; 'partner' is the askable generic, never a repair. */
  relation: WordSorterRelation;
  /**
   * Does the ASK name the groups out loud? False only at `hard` for a reader —
   * the tier withholds the criterion and the labels are on screen. At
   * Kindergarten the band floor forces it true at every tier: a pre-reader
   * cannot read a mat, so an unnamed group is an unanswerable question.
   */
  namesChoices: boolean;
  /** Support-tier render lever (#1 perception), carried so the stage does not
   *  have to re-read the challenge. */
  showFiledWords: boolean;
  /** Support-tier render lever (#1 perception) — the mat picture cues. */
  showChoiceEmojis: boolean;
}

/** Every mode is SAID. Nothing in this pack answers with its hands: a group
 *  name and a partner word both have spoken forms, so step 1's fork ends at its
 *  first question. */
export const answerKindFor = (_mode: WordSorterMode): 'voice' => 'voice';

/** Standing gate 1: one short word from a closed per-item set, in all three
 *  modes — the group labels for a sort, the printed bank for a match. */
export const responseClassFor = (_mode: WordSorterMode): ResponseClassId =>
  'short_spoken_word';

// ── Build gates — DROP an unaskable item, never repair it into one ──────────

/** One breath, and a name a child can hold in working memory while they
 *  answer. A three-word bucket label read aloud twice a round is recitation. */
export const MAX_LABEL_WORDS = 3;
export const MAX_LABEL_CHARS = 24;
/** The stimulus is one word, occasionally a two-word compound ("ice cream"). */
export const MAX_WORD_CHARS = 20;
export const MAX_WORD_WORDS = 2;
/**
 * A DI classification drill is FAST, and reps are the point — but one judged
 * round costs an ask, a think, a verdict and an affirmation, so a 10-word
 * challenge is a ten-minute sitting. These caps hold a session at the family's
 * shape (6-12 asks) without shortening any individual challenge's answer set.
 * Truncation is NOT a build-gate drop and is reported separately.
 */
export const MAX_ITEMS_PER_CHALLENGE = 6;
export const MAX_ITEMS_PER_SESSION = 12;

/**
 * Content words of this pack's own invariant prose. A bucket labelled "Words"
 * or "Group" would make the leak oracle fire on the greeting and the
 * how-to-play — our own sentences, which are the half most worth scanning — and
 * it is a poor label besides. Dropping it is cheaper than exempting our prose,
 * which is the letter-spotter ruling (fix the collision, never switch the
 * oracle off over the lines we wrote).
 */
const PACK_PROSE_TOKENS = new Set([
  'word', 'words', 'group', 'groups', 'turn', 'turns', 'listen', 'sorting', 'game', 'screen',
]);

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

/** No double quotes anywhere: every one of these strings is interpolated into a
 *  `Say exactly: "…"` span, and an embedded quote CLOSES the span early so
 *  everything after it becomes judge-side prose — the structural surface the
 *  performed-"[WAIT silently]" defect lived on. */
const SPEECH_SAFE_RE = /^[A-Za-z][A-Za-z' -]*$/;

const speakable = (value: string, maxChars: number, maxWords: number): boolean => {
  const text = sanitize(value);
  if (!text || text.length > maxChars) return false;
  if (!SPEECH_SAFE_RE.test(text)) return false;
  if (text.split(' ').length > maxWords) return false;
  return !opensWithSentinel(text);
};

/** Is this a word a tutor can say aloud in the middle of an ask? */
export const isSayableWord = (word: string): boolean =>
  speakable(word, MAX_WORD_CHARS, MAX_WORD_WORDS);

/** Is this a group label a child can hear, hold and say back? */
export const isSayableLabel = (label: string): boolean => {
  if (!speakable(label, MAX_LABEL_CHARS, MAX_LABEL_WORDS)) return false;
  return !sanitize(label)
    .toLowerCase()
    .split(' ')
    .some((token) => PACK_PROSE_TOKENS.has(token));
};

const normalizeForEar = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Can every option be told from every other BY EAR? decodable-reader's gate,
 * applied to a different closed set for the same reason: if an utterance fits
 * two options there is no honest verdict, and the fix is to drop the ask, never
 * to judge it leniently. "Big" against "Big things" is the shape this catches —
 * a child who says "big" has answered both.
 */
export const optionsEarSeparable = (options: readonly string[]): boolean => {
  const wordsOf = (option: string) => normalizeForEar(option).split(' ').filter(Boolean);
  return options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : wordsOf(o))));
    return wordsOf(option).some((word) => !others.has(word));
  });
};

/** Free text → the closed relation set. An unrecognised label becomes the
 *  askable generic rather than dropping the challenge: with the bank printed,
 *  "Which word goes with big?" still has exactly one right answer, so the item
 *  is less SPECIFIC, not broken. */
export const normalizeRelation = (label: string | undefined): WordSorterRelation => {
  const text = normalizeForEar(label ?? '');
  if (!text) return 'partner';
  if (text.includes('opposite') || text.includes('antonym')) return 'opposite';
  if (text.includes('synonym') || text.includes('same')) return 'synonym';
  if (text.includes('plural') || text.includes('more than one')) return 'plural';
  if (text.includes('rhyme') || text.includes('rhyming')) return 'rhyme';
  return 'partner';
};

/** Structural challenge shape as the generator emits it (duck-typed so this
 *  module never imports the component — the component imports us). */
export interface WordSorterChallengeLike {
  id: string;
  type: WordSorterMode;
  bucketLabels?: string[];
  bucketEmojis?: string[];
  words?: { id: string; word: string; emoji?: string; correctBucket: string }[];
  pairs?: { id: string; term: string; termEmoji?: string; match: string; matchEmoji?: string }[];
  distractorMatches?: { id: string; text: string; emoji?: string }[];
  /** Which relation the pairs share ("opposite", "plural"…). match_pairs only. */
  relationLabel?: string;
  /** Support-tier stamps, all optional — absent means the full-help render. */
  showBucketEmojis?: boolean;
  showFiledWords?: boolean;
  namesSortCriterion?: boolean;
}

export interface WordSorterBuildOptions {
  tier?: WordSorterTier;
  /** Kindergarten. Forces the groups to be named aloud at EVERY tier. */
  isPreReader?: boolean;
}

/**
 * Keep at most `MAX_ITEMS_PER_CHALLENGE` words, and make sure the kept set still
 * reaches every group.
 *
 * A cap applied blindly can strand a whole mat: take the first six of a shuffled
 * eight and a three-group sort can lose its third group entirely, which turns
 * the ask into a two-way choice while the tutor still offers three. Worse on a
 * binary sort, where losing a group makes "Animals, or Food?" answerable with
 * "Animals" every single time. So a missing group's first word displaces the
 * last kept word of an over-represented group. That is a SELECTION over content
 * that already passed every gate, not a backfill of content that failed one.
 */
const capCoveringEveryGroup = <T extends { correctBucket: string }>(
  words: T[],
  labels: string[],
  limit: number,
): T[] => {
  if (words.length <= limit) return words;
  const kept = words.slice(0, limit);
  for (const label of labels) {
    if (kept.some((w) => w.correctBucket === label)) continue;
    const candidate = words.slice(limit).find((w) => w.correctBucket === label);
    if (!candidate) continue;
    const counts = new Map<string, number>();
    for (const w of kept) counts.set(w.correctBucket, (counts.get(w.correctBucket) ?? 0) + 1);
    const displaceAt = kept.map((w, i) => [w, i] as const)
      .reverse()
      .find(([w]) => (counts.get(w.correctBucket) ?? 0) > 1)?.[1];
    if (displaceAt == null) continue;
    kept[displaceAt] = candidate;
  }
  return kept;
};

/**
 * Every judged item one challenge can ask, or `[]` when it can ask none.
 *
 * Nothing here backfills: a placeholder in a judged loop becomes a spoken ask
 * the tutor has to stand behind. The gates, and what each one closes:
 *
 *  - the group labels must be SAYABLE, distinct, and ear-separable. Two labels
 *    a judge cannot tell apart give an utterance two homes and no honest
 *    verdict.
 *  - no label may be a word that is being SORTED. "Listen: animals. Animals, or
 *    Food?" is a riddle, not a question.
 *  - a sort needs at least two groups actually represented among its kept words,
 *    or the child can say one label every round and be right every round.
 *  - a match needs its answer present in the bank exactly once, and the bank
 *    must be ear-separable — the same gate, over the option set that is
 *    printed rather than spoken.
 *  - nothing generated may open a sentence with a verdict sentinel.
 */
export const itemsFromChallenge = (
  ch: WordSorterChallengeLike,
  opts: WordSorterBuildOptions = {},
): WordSorterItem[] => {
  const tier = opts.tier ?? 'medium';
  const isPreReader = !!opts.isPreReader;
  // The band floor beats the tier: a pre-reader cannot read a mat, so the ask
  // names the groups at hard too. What hard withholds at K is the RULE.
  const namesChoices = isPreReader || ch.namesSortCriterion !== false;
  const showFiledWords = ch.showFiledWords !== false;
  const showChoiceEmojis = isPreReader || ch.showBucketEmojis === true;

  if (ch.type === 'match_pairs') {
    const pairs = (ch.pairs ?? [])
      .map((p) => ({
        id: p.id,
        term: sanitize(p.term),
        termEmoji: sanitize(p.termEmoji),
        match: sanitize(p.match),
        matchEmoji: sanitize(p.matchEmoji),
      }))
      .filter((p) => isSayableWord(p.term) && isSayableWord(p.match));
    if (pairs.length < 2) return [];

    // THE BANK DOES NOT SHRINK — every partner plus the tier decoys, printed
    // for the whole challenge. De-duplicated case-insensitively so an option
    // cannot be two items' answer at once.
    const bank: { text: string; emoji: string }[] = [];
    const seen = new Set<string>();
    for (const entry of [
      ...pairs.map((p) => ({ text: p.match, emoji: p.matchEmoji })),
      ...(ch.distractorMatches ?? []).map((d) => ({
        text: sanitize(d.text),
        emoji: sanitize(d.emoji),
      })),
    ]) {
      const key = entry.text.toLowerCase();
      if (!entry.text || seen.has(key) || !isSayableWord(entry.text)) continue;
      seen.add(key);
      bank.push(entry);
    }
    if (bank.length < 2) return [];
    if (!optionsEarSeparable(bank.map((b) => b.text))) return [];

    const askable = pairs.filter((p) => seen.has(p.match.toLowerCase()));
    if (askable.length < 2) return [];
    const relation = normalizeRelation(ch.relationLabel);

    return askable.slice(0, MAX_ITEMS_PER_CHALLENGE).map((p) => ({
      id: `${ch.id}::${p.id}`,
      mode: 'match_pairs' as const,
      answerKind: 'voice' as const,
      responseClass: responseClassFor('match_pairs'),
      action: 'match_pairs',
      tier,
      challengeId: ch.id,
      word: p.term,
      ...(p.termEmoji ? { emoji: p.termEmoji } : {}),
      answer: p.match,
      choices: bank.map((b) => b.text),
      choiceEmojis: bank.map((b) => b.emoji),
      relation,
      // The bank is PRINTED, never spoken — five to eight words recited every
      // round is the recitation the repeat-ask rulings struck. So a match ask
      // names no options and its leak oracle is flat at every tier.
      namesChoices: false,
      showFiledWords,
      showChoiceEmojis: false,
    }));
  }

  const labels = (ch.bucketLabels ?? []).map(sanitize).filter(isSayableLabel);
  const expected = ch.type === 'binary_sort' ? 2 : 3;
  if (labels.length !== expected) return [];
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return [];
  if (!optionsEarSeparable(labels)) return [];

  const labelSet = new Set(labels.map((l) => l.toLowerCase()));
  const words = (ch.words ?? [])
    .map((w) => ({
      id: w.id,
      word: sanitize(w.word),
      emoji: sanitize(w.emoji),
      correctBucket: labels.find(
        (l) => l.toLowerCase() === sanitize(w.correctBucket).toLowerCase(),
      ) ?? '',
    }))
    // A word that IS a group label turns the ask into a riddle; a word with no
    // home cannot be judged at all.
    .filter((w) => isSayableWord(w.word) && !!w.correctBucket && !labelSet.has(w.word.toLowerCase()));
  if (words.length < 2) return [];

  const kept = capCoveringEveryGroup(words, labels, MAX_ITEMS_PER_CHALLENGE);
  // One answer repeated every round is a sort the child can pass without
  // sorting — the same defect a one-option menu is.
  if (new Set(kept.map((w) => w.correctBucket)).size < 2) return [];

  const emojis = labels.map((_, i) => sanitize(ch.bucketEmojis?.[i]));
  return kept.map((w) => ({
    id: `${ch.id}::${w.id}`,
    mode: ch.type,
    answerKind: 'voice' as const,
    responseClass: responseClassFor(ch.type),
    action: ch.type,
    tier,
    challengeId: ch.id,
    word: w.word,
    ...(w.emoji ? { emoji: w.emoji } : {}),
    answer: w.correctBucket,
    choices: labels,
    choiceEmojis: emojis,
    relation: 'partner' as const,
    namesChoices,
    showFiledWords,
    showChoiceEmojis,
  }));
};

/**
 * The session, capped. `MAX_ITEMS_PER_SESSION` is a LENGTH bound, not a gate —
 * it truncates a run that would otherwise ask thirty questions, and it reports
 * what it dropped rather than silently shortening (a truncated run that reads
 * as "covered everything" is the trap `/add-di-loop` step 7 names).
 */
export const itemsFromChallenges = (
  challenges: WordSorterChallengeLike[],
  opts: WordSorterBuildOptions = {},
): WordSorterItem[] => {
  const all = challenges.flatMap((ch) => itemsFromChallenge(ch, opts));
  if (all.length <= MAX_ITEMS_PER_SESSION) return all;
  // eslint-disable-next-line no-console
  console.info(
    `[word-sorter] session capped at ${MAX_ITEMS_PER_SESSION} asks — `
    + `${all.length - MAX_ITEMS_PER_SESSION} askable item(s) held back.`,
  );
  return all.slice(0, MAX_ITEMS_PER_SESSION);
};

// ── Small speakable helpers ─────────────────────────────────────────────────

/** "Animals, or Food?" / "Animals, Food, or Toys?" — the spoken menu, and the
 *  ONE span the leak oracle subtracts. */
export const choicesPhrase = (item: WordSorterItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};

const relationQuestion = (item: WordSorterItem): string => {
  switch (item.relation) {
    case 'opposite':
      return `Which word means the opposite of ${item.word}?`;
    case 'synonym':
      return `Which word means the same as ${item.word}?`;
    case 'plural':
      return `Which word means more than one ${item.word}?`;
    case 'rhyme':
      return `Which word rhymes with ${item.word}?`;
    case 'partner':
    default:
      return `Which word goes with ${item.word}?`;
  }
};

/** The teaching move a correction re-models, per relation. Naming the FACT is
 *  the point — see the corrections note in the header. */
const relationRemodel = (item: WordSorterItem): string => {
  switch (item.relation) {
    case 'opposite':
      return `${item.word} and ${item.answer} are opposites`;
    case 'synonym':
      return `${item.word} and ${item.answer} mean the same thing`;
    case 'plural':
      return `one ${item.word}, two ${item.answer}`;
    case 'rhyme':
      return `${item.word} and ${item.answer} rhyme`;
    case 'partner':
    default:
      return `${item.word} goes with ${item.answer}`;
  }
};

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: WordSorterItem): string =>
  item.mode === 'match_pairs'
    ? 'I say a word — you find the one on the screen that fits it, and you say that one out loud. '
    : 'I say a word — you tell me which group it belongs with. ';

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing. A tier changes how much
// of the sequence precedes the attempt — never the ask, never the judging, and
// never the correction's re-model (standing gate 3).
//
// NOTE what is absent at every rung: a worked EXEMPLAR. The exemplar and the
// item come from the same challenge, so an exemplar's group name is very often
// this item's answer — see the header. These model the STRATEGY instead, which
// is what the family's model lines have always been.

const modelLine = (item: WordSorterItem): string =>
  item.mode === 'match_pairs'
    ? 'Two words can belong together because of what they mean.'
    : 'Think about what the word means, and where it belongs.';

const guideLine = (item: WordSorterItem): string =>
  item.mode === 'match_pairs'
    ? 'Take your time and read them all before you choose.'
    : 'Say the word quietly to yourself first if that helps.';

const leadInFor = (item: WordSorterItem): string => {
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
// A pre-reader cannot read the screen, and every correction re-ask inherits the
// ask, so the ask says its own problem out loud. Both shapes carry the STIMULUS
// (a new word every round), so no two consecutive asks are byte-identical and
// the invariant-recitation rule has nothing to bite on here.

export const askFor = (item: WordSorterItem): string => {
  if (item.mode === 'match_pairs') {
    return `Your turn. Listen: ${item.word}. ${relationQuestion(item)}`;
  }
  return item.namesChoices
    ? `Your turn. Listen: ${item.word}. ${choicesPhrase(item)}`
    // `hard` for a reader: the mats are printed and the tier withholds the
    // criterion, so the menu is not spoken. The ask still STATES its problem —
    // an ask that says nothing is broken rather than terser.
    : `Your turn. Listen: ${item.word}. Which group does it belong with?`;
};

// ── Corrections — DISTAR model-lead-test (standing gate 3) ──────────────────

const correctionFor = (item: WordSorterItem): string =>
  item.mode === 'match_pairs'
    ? `My turn: ${relationRemodel(item)}. ${askFor(item)}`
    : `My turn: ${item.word} belongs with ${item.answer}. ${askFor(item)}`;

const affirmFor = (item: WordSorterItem): string => {
  if (item.mode !== 'match_pairs') return `Yes, ${item.word} belongs with ${item.answer}.`;
  switch (item.relation) {
    case 'opposite':
      return `Yes, the opposite of ${item.word} is ${item.answer}.`;
    case 'synonym':
      return `Yes, ${item.word} and ${item.answer} mean the same thing.`;
    case 'plural':
      return `Yes, more than one ${item.word} is ${item.answer}.`;
    case 'rhyme':
      return `Yes, ${item.word} and ${item.answer} rhyme.`;
    case 'partner':
    default:
      return `Yes, ${item.word} goes with ${item.answer}.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW` in the
 * extended form counting-board, letter-spotter, picture-vocabulary and
 * phoneme-explorer all carry. Identical across the family on purpose: a grep
 * finds every pack that has it and every pack that does not.
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
 * Item 21's tail, consumed from counting-board's — the version with a measured
 * before/after (a fabricated `[CURRENT STATE]` block spoken to the child on 2 of
 * 7 beats, 0 of 7 once the tail forbade announcing the STATE rather than merely
 * reading the tag).
 *
 * It matters here for a reason specific to this port: the screen carries mats
 * and a word bank whose CONTENTS the tutor is told in the contract, so
 * "describe what has changed on the screen" is a sentence away from reading the
 * answer set aloud on a hard-tier item that deliberately does not name it.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * ⭐ THE VERDICT LINE IS THE END OF THE TURN — and this pack is where the family
 * learned it needed saying (cap drill, 2026-08-16).
 *
 * ELEVEN OF TWELVE AFFIRMATIONS RAN ON INTO A FABRICATED NEXT ASK: *"Yes, spoon
 * belongs with Hard. Your turn. Listen: teddy bear. Hard, or Soft?"* — a real
 * word from the challenge, invented by the model, and NOT the item the runner
 * was about to send. In production a child hears a question about the wrong word
 * and then the right one a beat later, which is precisely the 2-4×-per-item
 * incoherence the DI modality exists to remove (letter-spotter's founding
 * defect, arriving here through the model's mouth instead of a cue queue).
 *
 * It bites this pack harder than its siblings for a measurable reason: the ask
 * is ONE rigid template spoken twelve times in a session ("Your turn. Listen:
 * X. A, or B?") and the affirmation is short and lands on a label — so the
 * likeliest continuation the model has is the next ask. `TWO_BRANCH_LAW` already
 * says the reply is one quoted line "and nothing else", and `NEVER_PERFORM`
 * forbids narrating the STATE; neither names *continuing the lesson*, which is
 * the thing being done. 0/12 embellished after this clause.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never say the next word, and never announce what is coming — the activity sends you the `
  + `next question when the screen is ready for it, and a question you ask early is about the wrong word.`;

// ── The judging contract ────────────────────────────────────────────────────

/**
 * The answer rides in the control channel ahead of the attempt, which is the
 * family's shipped shape under the never-say-it law — a judge cannot decide an
 * answer it was never told.
 *
 * TWO clauses earn their space:
 *
 *  1. THE ACCEPT CLAUSE. A five-year-old asked "Animals, or Food?" answers
 *     "animal", or "it's an animal", or "the animals" — never the label as
 *     printed. A contract that demands the exact string fails children for
 *     diction, not for categorising.
 *  2. THE SIGNATURE ERROR: the WORD SAID BACK. A child asked "dog — Animals or
 *     Food?" who answers "dog" has produced none of the answer, but the
 *     utterance is a real word, said confidently, that the tutor itself spoke
 *     two seconds earlier — so a judge listening loosely for "something
 *     relevant" affirms it. picture-vocabulary's documented trap, and it is the
 *     same shape in both of this pack's directions.
 */
const judgingContract = (item: WordSorterItem): string => {
  const wrongClause = item.mode === 'match_pairs'
    ? `Any other word from the screen is wrong. `
    : item.choices.length === 2
      ? `The other group is wrong. `
      : `Either of the other groups is wrong. `;
  const target = item.mode === 'match_pairs'
    ? `The correct answer is the word "${item.answer}". `
      + `Saying it inside a phrase counts — "${item.answer}", "it is ${item.answer}", "the ${item.answer} one" are all right. `
    : `The correct answer is the group "${item.answer}". `
      + `They may say it without its little words or with the ending changed — "${item.answer}", "the ${item.answer}", `
      + `"it is a ${item.answer}" all count as the same answer. `;
  return (
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + target
    + `A shy or mumbled try still counts. `
    + `Saying the word "${item.word}" back is NOT an answer however confident it sounds — that word is the question. `
    + wrongClause
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}"`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface WordSorterCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: WordSorterItem,
  opts: WordSorterCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us play a sorting game! ' : '';
  // Introducing = the run's opening, or the ACTION just changed. Only then does
  // the child hear how the game works and the DISTAR lead-in; every other item
  // goes straight to the ask. (The lead-in belongs to the INTRODUCTION of an
  // action, never to every ask — ruled twice on 2026-08-13.)
  const introducing = !!(opts.opening || opts.howToPlay);
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[WSR_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward. Both
 * modes NAME the answer here — the corrections already did, and an item that
 * ends with the child still not knowing where the word goes has taught nothing.
 */
/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * ⭐ NO CLOSE LINE, AND THAT IS A PACK-SPECIFIC DEDUCTION, NOT A SHORTCUT.
 * letter-spotter's `moveOnCue` names the answer because its `name-it` correction
 * deliberately withholds it, so a capped item would otherwise end with the link
 * unmade. THIS pack's correction NAMES the fact (see the header) and the runner
 * runs it TWICE before capping — the child has already heard "juice belongs with
 * Liquids" twice, so a third telling is redundant.
 *
 * It is also the only place a group label reached the move-on utterance outside
 * the exempt menu clause, which is what the cap drill caught as a CONFIRMED HIGH
 * (`di-answer-leak-in-ask`, 2026-08-16): every item of a challenge shares one
 * label set, so the capped item's close line names a label that is very often
 * the NEXT item's answer too. Deleting a redundant sentence removes the finding
 * at its cause rather than widening an exemption around it.
 */
export const moveOnCue = (
  item: WordSorterItem,
  next: WordSorterItem | null,
  opts: WordSorterCueOptions = {},
): string => {
  if (!next) {
    return (
      `[WSR_MOVE] Say exactly: "Good try! We will sort that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!opts.howToPlay;
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[WSR_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[WSR_COMPLETE] Say exactly: "Great sorting today! You told me every one out loud. See you next time!" `
  + `Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn
 * by band or tier. It is the pre-reader's only way back to a stimulus that lives
 * in audio — the click era's `[WORD_TAP]`, kept because it was the right idea.
 */
export const pronounceCue = (item: WordSorterItem): string => {
  const line = item.mode === 'match_pairs'
    ? `Listen: ${item.word}. ${relationQuestion(item)}`
    : item.namesChoices
      ? `Listen: ${item.word}. ${choicesPhrase(item)}`
      : `Listen: ${item.word}. Which group does it belong with?`;
  return (
    `[WSR_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY
 * (di-math-facts rule). It names the WORD and how many choices there are, and
 * never the choices themselves: at `hard` for a reader the ask deliberately does
 * not say them, and a context line that did would hand the tutor a set it could
 * volunteer.
 */
export const stimulusFor = (item: WordSorterItem): string =>
  item.mode === 'match_pairs'
    ? `the word "${item.word}", with a list of words printed on the screen`
    : `the word "${item.word}", with ${item.choices.length} groups printed on the screen`;

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

/**
 * Everything of this pack that can reach the tutor, in one value. The component
 * spreads this and adds only what the SCREEN owns (`statusLines`,
 * `diagnosisObservation`); the drive-plan endpoint hands it to
 * `run_tutor_live.py --di`. A harness that re-typed these cues would test a
 * fiction.
 */
export const wordSorterPackBase = (
  items: WordSorterItem[],
): JudgedCueSurface<WordSorterItem> => ({
  primitiveType: 'word-sorter',
  activityLine: 'live direct instruction word sorting practice',
  items,
  itemCue,
  moveOnCue,
  completeCue,
  pronounceCue,
  contextFor: (item) => ({
    challengeType: item.mode,
    stimulus: stimulusFor(item),
  }),
});

// ── Harness answer material — what a right and a wrong child sound like ──────

/**
 * The span of the ask inside which the answer may legitimately appear.
 *
 * A SORT ASK CLOSES ON A SPOKEN MENU, so the answer word is inside it by
 * construction — push-pull-arena's shape. Subtracting exactly the menu keeps the
 * oracle live over the greeting, the how-to-play, the DISTAR lead-in and the
 * hand-over, which is the half we author and therefore the half most worth
 * scanning.
 *
 * Two places it returns nothing, and both are the oracle getting STRONGER:
 *  - `hard` for a reader names no groups, so there is no menu to subtract and
 *    the scan is flat (letter-sound-link's tier-conditional exemption).
 *  - a MATCH ask never speaks the bank — it is printed — so a group name in the
 *    tutor's mouth there is always a leak.
 */
export const leakExemptSpanFor = (item: WordSorterItem): string | undefined =>
  item.mode !== 'match_pairs' && item.namesChoices ? choicesPhrase(item) : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each of
 * these; this is that claim made testable. Change one, change both.
 *
 * The signature wrong is the contract's own named miss — THE WORD SAID BACK. A
 * child asked "dog — Animals, or Food?" who answers "dog" has produced none of
 * the answer, but it is a real word, said confidently, that the tutor spoke two
 * seconds earlier; a judge grading on "did I hear something relevant" affirms
 * it. Both directions of this pack share the trap, which is why the contract
 * names it in both.
 */
export const wordSorterHarnessAnswers = (item: WordSorterItem) => {
  const plainWrong = item.choices.find(
    (c) => c.toLowerCase() !== item.answer.toLowerCase(),
  ) ?? 'something else';
  return {
    correct: item.answer,
    plainWrong,
    signatureWrong: {
      text: item.word,
      why:
        'the stimulus word said straight back — it is a real word, said confidently, that the tutor '
        + 'itself spoke two seconds earlier, so a judge listening for "something relevant to this item" '
        + 'affirms it. The contract names this miss by name',
    },
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
};
