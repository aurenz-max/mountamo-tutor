/**
 * Word sorter's domain: the build gates, the items, the ask, the spoken key, the known misses and the scene. Pure; the
 * boss (`wordSorter.boss.ts`), the component, the lever set and the generator (its build gates) import it.
 *
 * Every mode is SPOKEN. A teacher at a table with one child and two labelled mats says "dog. Animals, or Food?" and
 * the child says "Animals". The answer is a GROUP NAME (binary_sort: 2 groups, ternary_sort: 3) or a PARTNER WORD from
 * the printed bank (match_pairs), and both are things a five-year-old says across a table. The taps were removed: a
 * child who cannot categorise could tap a bucket correctly at a 1-in-2 floor and re-tap until it landed. The mats and
 * the bank stay; they are the page, not the action.
 *
 * Two things the click era hid:
 *  1. The elimination leak. The match column consumed its entries, so the last pair of every challenge had one option
 *     left. The bank now stays whole for the whole challenge, and the support-tier decoys sit in it.
 *  2. Sorted-word badges appear only for items already credited.
 *
 * The sort ask closes on a spoken menu ("Animals, or Food?"), so its key is a menu key. At `hard` for a reader the ask
 * names no group (the mats are printed); at Kindergarten the band floor forces the groups to be named, because a
 * pre-reader cannot read a mat. A match ask never speaks its printed bank.
 *
 * Every generated string that can be spoken is run through `opensWithSentinel` and dropped on a hit, on both sides of
 * the wire (the generator imports these gates rather than copying them).
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';

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


// ── The ask ─────────────────────────────────────────────────────────────────

/** "Animals, or Food?" / "Animals, Food, or Toys?": the spoken menu. */
export const choicesPhrase = (item: WordSorterItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};

const relationQuestion = (item: WordSorterItem): string => {
  switch (item.relation) {
    case 'opposite': return `Which word means the opposite of ${item.word}?`;
    case 'synonym': return `Which word means the same as ${item.word}?`;
    case 'plural': return `Which word means more than one ${item.word}?`;
    case 'rhyme': return `Which word rhymes with ${item.word}?`;
    case 'partner':
    default: return `Which word goes with ${item.word}?`;
  }
};

/**
 * The ask: the word, then the question, stated aloud (a pre-reader cannot read the screen). A sort names its groups
 * unless the tier withholds them for a reader; the ask still states its problem then.
 */
export const askFor = (item: WordSorterItem): string => {
  if (item.mode === 'match_pairs') return `Your turn. Listen: ${item.word}. ${relationQuestion(item)}`;
  return item.namesChoices
    ? `Your turn. Listen: ${item.word}. ${choicesPhrase(item)}`
    : `Your turn. Listen: ${item.word}. Which group does it belong with?`;
};

// ── The key ─────────────────────────────────────────────────────────────────

/** "cat" and the group "Cats": the word said back sounds like the group, so it is not named as a miss. */
const sameStem = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/s$/, ''), y = b.toLowerCase().replace(/s$/, '');
  return x.startsWith(y) || y.startsWith(x);
};

/**
 * What the tutor judges the spoken answer against. A sort that names its groups is a menu key. A child asked
 * "Animals, or Food?" says "animal" or "it's an animal": diction is not what is measured. The word said back is the
 * question, not an answer, however confidently it is said.
 */
export function wordSorterKey(item: WordSorterItem): SpokenKey {
  const echo = sameStem(item.word, item.answer) ? '' : `"${item.word}" said back is the question, not an answer. `;
  if (item.mode === 'match_pairs') {
    return { answer: item.answer, alsoAccept: [],
      acceptRule: `Saying it inside a phrase ("it is ${item.answer}", "the ${item.answer} one") counts.`,
      signatureError: `${echo}Any other word from the bank is wrong.` };
  }
  return { answer: item.answer, alsoAccept: [], ...(item.namesChoices ? { menu: item.choices } : {}),
    acceptRule: `The group with or without its little words ("the ${item.answer}") or with its ending changed is the `
      + 'same answer.',
    signatureError: `${echo}${item.choices.length === 2 ? 'The other group is' : 'The other groups are'} wrong.` };
}

// ── Known misses (handoff 20 Part B) ────────────────────────────────────────

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: another printed group (or
 * bank word), then the word said back. Concrete per item: the word and the choices.
 */
export function wordSorterSpokenMisses(item: WordSorterItem): KnownMiss[] {
  const sort = item.mode !== 'match_pairs';
  const others = item.choices.filter(c => c.toLowerCase() !== item.answer.toLowerCase() && c.toLowerCase() !== item.word.toLowerCase());
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  return [
    ...(others.length ? [{ id: sort ? 'other_group' : 'other_bank_word',
      pattern: sort ? `"${item.word}" belongs with ${item.answer}. The learner's answer is ${quote(others)}, another group.`
        : `The ${item.relation === 'partner' ? 'partner' : item.relation} of "${item.word}" is "${item.answer}". The learner's answer is ${quote(others)}, another word from the bank.`,
      examples: others.slice(0, 2) }] : []),
    // "cat" said back sounds like the group "Cats": no echo miss where the word is a form of the answer.
    ...(sameStem(item.word, item.answer) ? [] : [{ id: 'said_word_back',
      pattern: `The learner says the word "${item.word}" back and names no ${sort ? 'group' : 'bank word'}.`, examples: [item.word] }]),
  ];
}

// ── The scene ───────────────────────────────────────────────────────────────

/** What is drawn and asked. Never which choice is right. */
export function wordSorterScene(item: WordSorterItem): SceneOf {
  const sort = item.mode !== 'match_pairs';
  return { objects: [], facts: {
    word: item.word,
    [sort ? 'groups' : 'bank']: item.choices.join(', '),
    namingChoices: item.namesChoices
      ? `You may name the ${sort ? 'groups' : 'bank words'} aloud.`
      : `The learner reads the ${sort ? 'groups' : 'bank'}: do not name them aloud.`,
    constraints: 'The word and the choices are printed; the right one is marked only after credit. The hear-again '
      + 'button asks you to repeat the question only.',
  } };
}

/** What the hear-again button asks the tutor to say: the question, never the answer. */
export const hearQuestionRequest = (item: WordSorterItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}"`;

// ── Harness ─────────────────────────────────────────────────────────────────

/** The journey's answers: the right group or partner, or another printed choice. */
export const wordSorterHarnessAnswers = (item: WordSorterItem) => ({
  correct: item.answer,
  plainWrong: item.choices.find(c => c.toLowerCase() !== item.answer.toLowerCase()) ?? 'something else',
});
