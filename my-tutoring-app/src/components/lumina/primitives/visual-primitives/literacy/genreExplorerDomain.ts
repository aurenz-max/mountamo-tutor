/**
 * genre-explorer's domain: the canonical genre vocabulary, the build gates that turn a payload into spoken items, the
 * ask, the key, the known misses and the scene. Pure; the boss (`genreExplorer.boss.ts`), the levers and the component
 * read it, and the generator imports its gates from here so both sides of the wire agree on what is sayable.
 *
 * Every item is SAID, three ways over two or three short texts:
 *
 *   check-feature   yes or no about ONE text          "Does the first one have animals that talk?"  -> "yes"
 *   pick-excerpt    which of two texts has a feature  "Does the first one teach a lesson, or does the second one?"
 *   name-genre      a kind of writing from the menu   "What kind of writing is the first one? Fable, Poem, or Informational?"
 *
 * What the build owes, and why:
 *  - ONE PAYLOAD IS MANY ASKS, capped by SELECTION (`MAX_*`): a blind slice can land every contrast on one text, and
 *    then "the first one" is right every round. `identify_basic` is a binary, so the session asks it per text (2-3
 *    texts, each with feature evidence first), never once.
 *  - A GENRE IS ASKED ONCE PER SESSION: after the tutor credits "Biography" once, saying it again wins the next text's
 *    ask with no reading.
 *  - THE MENU IS CANONICAL AND PRUNED FOR THE EAR: `GENRE_LABEL` is owned here and the schema is enum-constrained to
 *    its ids; "Fiction" never stands beside "Historical Fiction" (`pruneForEar`), and an answer is never pruned.
 *  - THE TUTOR READS THE TEXT AT THE BAND FLOOR (grades K-2), and that is safe here: the answer is a category name that
 *    no text contains (`namesAGenre` drops an excerpt that says one). text-structure-analyzer is the opposite shape:
 *    its answer is a word in the passage.
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

// Re-exported so the generator imports its build gates from ONE address — both
// sides of the wire must agree on what is sayable.
export { opensWithSentinel };

// ── The canonical genre vocabulary — owned here, imported by the generator ───

/** Every genre this primitive can ask about, as the schema spells it. */
export type GenreId =
  | 'fiction'
  | 'nonfiction'
  | 'poem'
  | 'drama'
  | 'fable'
  | 'folktale'
  | 'myth'
  | 'legend'
  | 'tall-tale'
  | 'realistic-fiction'
  | 'historical-fiction'
  | 'biography'
  | 'autobiography'
  | 'memoir'
  | 'informational'
  | 'persuasive';

/**
 * The label the child SAYS and the judge is handed.
 *
 * "Drama" rather than "Play" is deliberate and is a leak-oracle decision, not a
 * curriculum one: "play" is a content word of this pack's own how-to-play prose,
 * so a menu carrying it would make the oracle fire on our own greeting — the half
 * most worth scanning (letter-spotter's ruling: fix the collision, never switch
 * the oracle off over lines we wrote).
 */
export const GENRE_LABEL: Record<GenreId, string> = {
  fiction: 'Fiction',
  nonfiction: 'Nonfiction',
  poem: 'Poem',
  drama: 'Drama',
  fable: 'Fable',
  folktale: 'Folktale',
  myth: 'Myth',
  legend: 'Legend',
  'tall-tale': 'Tall Tale',
  'realistic-fiction': 'Realistic Fiction',
  'historical-fiction': 'Historical Fiction',
  biography: 'Biography',
  autobiography: 'Autobiography',
  memoir: 'Memoir',
  informational: 'Informational',
  persuasive: 'Persuasive',
};

/** The printed gloss under each label. Never spoken; never the answer. */
export const GENRE_GLOSS: Record<GenreId, string> = {
  fiction: 'A made-up story.',
  nonfiction: 'Writing about things that are real.',
  poem: 'Short lines, often with rhythm or rhyme.',
  drama: 'A story written to be acted out, with parts to speak.',
  fable: 'A short animal story that teaches a lesson.',
  folktale: 'An old story people have told for a long time.',
  myth: 'An old story that explains why the world is the way it is.',
  legend: 'An old story about a hero, part true and part grown in the telling.',
  'tall-tale': 'A funny story where everything is much bigger than real life.',
  'realistic-fiction': 'A made-up story that really could happen.',
  'historical-fiction': 'A made-up story set in a real time long ago.',
  biography: 'The true story of a real person, written by someone else.',
  autobiography: 'The true story of a real person, written by that person.',
  memoir: 'A real person remembering one part of their own life.',
  informational: 'Writing that teaches you facts about a topic.',
  persuasive: 'Writing that tries to talk you into something.',
};

export const ALL_GENRE_IDS = Object.keys(GENRE_LABEL) as GenreId[];

/**
 * Spoken forms a child offers that mean the same genre. The judging contract
 * names these so the accept clause is honest: `short_spoken_word`'s standing
 * requirement is that a child answers with the short or the familiar form far
 * more often than the catalogue term, and refusing that fails them for
 * vocabulary rather than for reading.
 */
export const GENRE_ALTERNATES: Record<GenreId, readonly string[]> = {
  fiction: ['made up', 'a made-up story', 'make believe', 'not real'],
  nonfiction: ['real', 'a true story', 'facts', 'true'],
  poem: ['poetry', 'a poem'],
  drama: ['a play', 'a script'],
  fable: ['an animal story with a lesson'],
  folktale: ['a folk tale', 'an old story'],
  myth: ['a myth story'],
  legend: ['a hero story'],
  'tall-tale': ['a tall story'],
  'realistic-fiction': ['realistic', 'a story that could happen'],
  'historical-fiction': ['historical', 'a story from long ago'],
  biography: ['a life story', 'a true story about a person'],
  autobiography: ['their own life story'],
  memoir: ['a memory story'],
  informational: ['information', 'an information text', 'facts about a topic'],
  persuasive: ['an opinion', 'trying to convince you'],
};

/**
 * The genre most easily MISTAKEN for each one — the wrong answer that arrives
 * fluent and confident, and the discrimination each lesson actually teaches. Used
 * to build the harness's signature wrong; never used to build a menu (the
 * generator's own distractor choice owns that).
 */
export const GENRE_SIBLING: Partial<Record<GenreId, readonly GenreId[]>> = {
  fable: ['folktale', 'myth'],
  folktale: ['fable', 'legend', 'myth'],
  myth: ['legend', 'folktale'],
  legend: ['myth', 'tall-tale'],
  'tall-tale': ['legend', 'folktale'],
  biography: ['autobiography', 'memoir'],
  autobiography: ['biography', 'memoir'],
  memoir: ['autobiography', 'biography'],
  informational: ['persuasive', 'nonfiction'],
  persuasive: ['informational'],
  'historical-fiction': ['realistic-fiction', 'biography'],
  'realistic-fiction': ['historical-fiction', 'fiction'],
  fiction: ['nonfiction'],
  nonfiction: ['fiction', 'informational'],
  poem: ['drama'],
  drama: ['poem'],
};

/**
 * ⭐ THE BINARY BUCKET — which side of fiction/nonfiction each genre sits on, and
 * the code gate that keeps `identify_basic` binary.
 *
 * ⚠️ A LIVE PROBE FOUND THE MODE DRIFTING (2026-08-17): `identify_basic` at grade 2
 * came back with `[nonfiction, fiction, poem]` and a THREE-option menu, because the
 * grade note listed poem as in-band and the model followed it over the mode's own
 * "two broad buckets only". The prompt is fixed too, but a prompt is steering and
 * this is the gate: the eval mode IS the task identity, and a Tier-1 β-2.0 binary
 * that quietly becomes three-way is measuring something else.
 *
 * `poem` and `drama` are DELIBERATELY unbucketed rather than assigned. A poem can
 * be either side and a play can dramatise a real life — an ambiguous ask is not a
 * harder task, it is a broken one — so at this mode they drop their excerpt rather
 * than being asserted onto a side. Every other genre's side is a curriculum fact.
 */
export const BINARY_BUCKET: Partial<Record<GenreId, 'fiction' | 'nonfiction'>> = {
  fiction: 'fiction',
  fable: 'fiction',
  folktale: 'fiction',
  myth: 'fiction',
  legend: 'fiction',
  'tall-tale': 'fiction',
  'realistic-fiction': 'fiction',
  'historical-fiction': 'fiction',
  nonfiction: 'nonfiction',
  biography: 'nonfiction',
  autobiography: 'nonfiction',
  memoir: 'nonfiction',
  informational: 'nonfiction',
  persuasive: 'nonfiction',
};

/**
 * Words that say fiction or nonfiction outright ("tell a made-up story from someone's imagination", "give facts you
 * could look up"). On identify_basic a feature built from them restates the answer instead of pointing at the words
 * of the text (lever plan 2026-10-03 step 0, genre-explorer F1). Word-bounded, case-folded.
 */
const BINARY_RESTATE = /\b(made[- ]up|make[- ]believe|imagin\w*|pretend\w*|not real|real|true|facts?|fiction\w*|nonfiction\w*)\b/i;
export const restatesBinaryGenre = (predicate: string): boolean => BINARY_RESTATE.test(predicate);

export const binaryBucketOf = (genre: GenreId | null): GenreId | null =>
  genre ? (BINARY_BUCKET[genre] ?? null) : null;

/**
 * Free strings a generation (or a cached payload) may carry for a canonical
 * genre. Matched after normalisation, so casing and punctuation do not matter.
 * An unrecognised genre DROPS its excerpt's genre ask — never guesses.
 */
const GENRE_ALIASES: Record<string, GenreId> = {
  'non fiction': 'nonfiction',
  'nonfiction text': 'nonfiction',
  'informational text': 'informational',
  'informational writing': 'informational',
  'expository': 'informational',
  'real facts': 'nonfiction',
  'true story': 'nonfiction',
  'make believe story': 'fiction',
  'make believe': 'fiction',
  'made up story': 'fiction',
  'story': 'fiction',
  'poetry': 'poem',
  'play': 'drama',
  'script': 'drama',
  'folk tale': 'folktale',
  'fairy tale': 'folktale',
  'tall tale': 'tall-tale',
  'historical fiction': 'historical-fiction',
  'realistic fiction': 'realistic-fiction',
  'auto biography': 'autobiography',
  'opinion': 'persuasive',
  'opinion writing': 'persuasive',
  'argument': 'persuasive',
};

const normalizeForEar = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();

const earWords = (value: string): string[] => normalizeForEar(value).split(' ').filter(Boolean);

/** A generated genre string → the canonical id, or null (which DROPS the ask). */
export const canonicalGenre = (value: string | undefined | null): GenreId | null => {
  const key = normalizeForEar(value ?? '');
  if (!key) return null;
  const hyphenated = key.replace(/\s+/g, '-');
  if ((ALL_GENRE_IDS as string[]).includes(hyphenated)) return hyphenated as GenreId;
  if ((ALL_GENRE_IDS as string[]).includes(key)) return key as GenreId;
  const byLabel = ALL_GENRE_IDS.find((id) => normalizeForEar(GENRE_LABEL[id]) === key);
  if (byLabel) return byLabel;
  return GENRE_ALIASES[key] ?? null;
};

// ── The item ────────────────────────────────────────────────────────────────

/** What the child is doing on this item. NOT the eval mode: the modes are Bloom tiers over the same three actions. */
export type GenreAction = 'check-feature' | 'name-genre' | 'pick-excerpt';

export type GenreTier = 'easy' | 'medium' | 'hard';

/** The eval modes. A payload with no mode builds as classify_genre. */
export type GenreMode = 'identify_basic' | 'classify_genre' | 'compare_genres';
export const genreModeOf = (mode: string | undefined): GenreMode =>
  mode === 'identify_basic' || mode === 'compare_genres' ? mode : 'classify_genre';

export interface GenreExplorerItem extends JudgedScriptItem {
  action: GenreAction;
  tier: GenreTier;
  /** The answer, said out loud: a genre label, "yes"/"no", or "the first one". */
  answer: string;
  /** The spoken/printed menu, in screen order. `[]` on `check-feature` — a
   *  yes/no needs no menu, and printing one would be a second answer surface. */
  choices: string[];
  /** Index-aligned printed gloss for `choices`; '' where there is none. */
  choiceNotes: string[];
  /** Which excerpt this item is about; -1 for a contrast (both are). */
  excerptIndex: number;
  /** How the ask refers to it — "this one" when the session has only one. */
  excerptOrdinal: string;
  /** The feature phrase, in BASE form so it completes "Does this one ___?".
   *  '' on `name-genre`. */
  predicate: string;
  /** Text the tutor speaks before the question — the excerpt itself, at the
   *  band floor only, on the FIRST item that lands on it. '' otherwise. */
  readAloud: string;
  /** Does the ASK name the genre menu out loud? False only at `hard` above the
   *  band floor — the menu is printed and a reader is expected to read it. */
  namesChoices: boolean;
  /** The session's eval mode (`genreModeOf`). */
  mode: GenreMode;
  /** A practice item only (the `two_far_kinds` simplify lever): the pool text it is about. */
  practiceText?: string;
}

/** Every item is SAID. Nothing in this pack answers with its hands. */
export const answerKindFor = (_action: GenreAction): 'voice' => 'voice';

/**
 * Standing gate 1. See the header for why `name-genre` takes the BENCHED
 * `short_spoken_word` rather than the roster's `closed_set_choice`.
 */
export const responseClassFor = (action: GenreAction): ResponseClassId =>
  action === 'check-feature'
    ? 'yes_no'
    : action === 'pick-excerpt'
      ? 'ordinal_word'
      : 'short_spoken_word';

// ── Session shape ───────────────────────────────────────────────────────────

/**
 * A judged round costs an ask, a think, a verdict and an affirmation. These hold
 * the run at the family's shape (6-12 asks) without shortening any phase to
 * nothing. Truncation is NOT a build-gate drop and is reported separately.
 */
export const MAX_EXCERPTS = 3;
export const MAX_FEATURE_ITEMS_PER_EXCERPT = 2;
export const MAX_CONTRAST_ITEMS = 4;

/** One breath: a feature the child can hold in their head while they answer. */
export const MAX_PREDICATE_WORDS = 7;
export const MAX_PREDICATE_CHARS = 48;
/** The tutor reads this aloud at the band floor. Longer than this is a lecture,
 *  and a correction re-ask repeats it — so the excerpt DROPS rather than being
 *  silently printed to a child who cannot read it. */
export const MAX_READ_ALOUD_WORDS = 70;
/** Two labels differing only by a one- or two-letter word pass a word-level
 *  separability check and fail an ear. A distinguishing word must be a WORD. */
export const MIN_DISTINGUISHING_CHARS = 3;
/**
 * ⭐ THE EASY-TIER MENU FLOOR — three where three exist. Under a tap,
 * `correct + 1 distractor` was scaffolding; under spoken production it is a coin
 * flip. It CLAMPS rather than inflating: `identify_basic` is a two-genre mode by
 * construction and saturates at 2, which is a real ceiling and not a softening
 * (word-sorter's binary_sort shape) — that mode's guess floor is deleted by the
 * SESSION length, not by the menu.
 */
export const MIN_GENRE_OPTIONS_EASY = 3;

/** Positions the ask can name. Two or three excerpts is the whole ladder. */
const EXCERPT_ORDINALS = ['the first one', 'the second one', 'the third one'];

export const excerptOrdinalFor = (index: number, total: number): string =>
  total <= 1 ? 'this one' : (EXCERPT_ORDINALS[index] ?? 'this one');

// ── Small primitives ────────────────────────────────────────────────────────

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

const wordsIn = (value: string): number => sanitize(value).split(' ').filter(Boolean).length;

/**
 * Make a generated string safe to interpolate into a `Say exactly: "…"` span.
 *
 * The double quote is the one that matters and it is not cosmetic: an embedded
 * `"` CLOSES the span early, so everything after it becomes judge-side prose the
 * tutor never speaks — which on this pack means the child hears half a fable and
 * no question. Fables and folktales are full of dialogue, so this is the common
 * case rather than the edge one; the printed text keeps its own quotes.
 */
export const speechSafe = (value: string): string =>
  sanitize(value).replace(/[“”"]/g, "'").replace(/[[\]{}]/g, '');

const SPEECH_SAFE_PREDICATE_RE = /^[a-z][A-Za-z0-9' ,-]*$/;

/**
 * Legacy checklist labels ("Has characters", "Is it make-believe?") read as a
 * heading, not as a predicate, and produce "Does this one has characters?".
 * They DROP rather than being rewritten — regex-parsing natural language into a
 * verb form is exactly the transform the schema is supposed to own.
 */
// ⚠️ "have" IS NOT HERE, and the omission is the point: "have animals that talk"
// is precisely the base form the ask needs. What is refused is the THIRD-PERSON
// heading ("has characters") and the pre-formed question ("does it rhyme?") — the
// two shapes a checklist naturally produces and neither of which completes "Does
// this one ___?".
const NON_PREDICATE_OPENERS = [
  'has ', 'is ', 'are ', 'was ', 'were ', 'does ', 'do ', 'did ',
  'can ', 'could ', 'it ', 'this ', 'the ', 'a ', 'an ',
];

/** Is this a feature phrase that completes "Does this one ___?" cleanly? */
export const isSayablePredicate = (predicate: string): boolean => {
  const text = sanitize(predicate);
  if (!text || text.length > MAX_PREDICATE_CHARS) return false;
  if (wordsIn(text) > MAX_PREDICATE_WORDS) return false;
  if (!SPEECH_SAFE_PREDICATE_RE.test(text)) return false;
  const lower = `${text.toLowerCase()} `;
  if (NON_PREDICATE_OPENERS.some((opener) => lower.startsWith(opener))) return false;
  return !opensWithSentinel(text);
};

/**
 * Is this excerpt something the tutor can read aloud without breaking the
 * lesson? Two gates, both live hazards on generated prose:
 *  - it may not open a SENTENCE with a verdict sentinel (this is the family's
 *    only pack whose tutor speaks generated narrative at length, so "Yes, said
 *    the fox." would be read by the reducer as a judgment);
 *  - it must be short enough that a correction can repeat it.
 */
export const isReadableAloud = (text: string): boolean => {
  const spoken = speechSafe(text);
  if (!spoken || wordsIn(spoken) > MAX_READ_ALOUD_WORDS) return false;
  return !opensWithSentinel(spoken);
};

/**
 * Can every option be told from every other BY EAR? decodable-reader's gate,
 * carried with this pack's own minimum-length clause. Owned per pack across this
 * family (word-sorter, decodable-reader and text-structure-analyzer each keep a
 * calibrated copy) because the threshold is a property of the vocabulary; the
 * copy that must NEVER exist is one on the generator's side of this wire, which
 * is why the generator imports this symbol.
 */
export const optionsEarSeparable = (options: readonly string[]): boolean =>
  options.every((option, i) => {
    const others = new Set(options.flatMap((o, j) => (j === i ? [] : earWords(o))));
    return earWords(option).some(
      (word) => word.length >= MIN_DISTINGUISHING_CHARS && !others.has(word),
    );
  });

/**
 * ⭐ Build the spoken menu: keep every ANSWER, then admit options only while the
 * set stays separable BY EAR.
 *
 * This vocabulary genuinely needs it. "Fiction" beside "Historical Fiction" is
 * decodable-reader's SUBSET shape — a child who says "fiction" has said something
 * that fits both, and there is no honest verdict, so the ask is broken rather than
 * hard. Seeding with the answers means the generic label is the one that loses,
 * which is also the right survivor: the specific genre is what the lesson teaches.
 */
export const pruneForEar = (answers: readonly string[], options: readonly string[]): string[] => {
  const kept: string[] = [];
  for (const answer of answers) {
    if (kept.includes(answer)) continue;
    if (kept.length === 0 || optionsEarSeparable([...kept, answer])) kept.push(answer);
  }
  for (const option of options) {
    if (kept.includes(option)) continue;
    if (optionsEarSeparable([...kept, option])) kept.push(option);
  }
  return kept;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * ⭐ DOES THIS ITEM'S OWN ASK CONTAIN ITS OWN ANSWER? Carried from
 * text-structure-analyzer, where a live drive proved the collision arrives from
 * directions nobody predicts and is invisible to every other gate because the ask
 * reads perfectly well.
 *
 * ⚠️ RUN ON `name-genre` ONLY, and that is a deduction rather than an oversight.
 * A `check-feature` answer is "yes"/"no" and a `pick-excerpt` answer is "the first
 * one" — tokens the ask must contain to be a question at all, so the gate would
 * drop every item of both actions (and, on a text containing "there was no
 * water", would do it for a reason that is not even about the answer).
 */
export const askIsAnswerFree = (ask: string, answer: string, menu?: string): boolean => {
  const scanned = normalizeForEar(menu ? ask.replace(menu, ' ') : ask);
  const needle = normalizeForEar(answer);
  if (!needle) return true;
  return !new RegExp(`(^| )${escapeRegExp(needle)}( |$)`).test(scanned);
};

/**
 * ⭐ THE CODE-OWNED GENRE-NAME LIST — the gate that keeps the answer out of the
 * text the tutor reads aloud.
 *
 * An excerpt reading "This fable teaches us…" hands the answer over the moment it
 * is spoken, and a feature predicate reading "read like a fable" does the same
 * inside the question. Checked against every genre name, not just the menu's,
 * because the leak is the WORD rather than the option.
 *
 * ⚠️ IT IS AN EXPLICIT LIST RATHER THAN THE LABEL TOKENS, and that is a bug the
 * label-derived version would have shipped: "Tall Tale" contributes the tokens
 * "tall" and "tale", so every excerpt containing an ordinary tall tree would have
 * been refused. The line drawn here is genre NAMES against narrative VOCABULARY —
 * "story", "tale", "play" and "article" are ordinary content words that make no
 * claim about what kind of writing this is, and refusing them would drop most
 * fiction ever written. The generator's prompt still steers away from all of
 * them; only the naming words are a gate.
 */
const GENRE_NAME_WORDS = new Set([
  'genre', 'genres',
  'fiction', 'nonfiction',
  'poem', 'poems', 'poetry',
  'drama',
  'fable', 'fables',
  'folktale', 'folktales',
  'myth', 'myths',
  'legend', 'legends',
  'biography', 'biographies', 'autobiography', 'autobiographies',
  'memoir', 'memoirs',
  'informational',
  'persuasive',
  'realistic', 'historical',
]);

export const namesAGenre = (text: string): boolean =>
  earWords(text).some((word) => GENRE_NAME_WORDS.has(word));

// ── The payload, duck-typed (this module never imports the component) ────────

export interface GenreFeatureLike {
  featureId?: string;
  /** Base-verb phrase completing "Does this one ___?" — "have talking animals". */
  predicate?: string;
  /** excerptIds this feature is TRUE of. */
  presentIn?: string[];
  /** Legacy nested shape (a checklist row inside one excerpt). */
  label?: string;
  present?: boolean;
}

export interface GenreExcerptLike {
  excerptId?: string;
  text?: string;
  genre?: string;
  features?: GenreFeatureLike[];
}

export interface GenreExplorerPayloadLike {
  gradeLevel?: string;
  mode?: string;
  excerpts?: GenreExcerptLike[];
  features?: GenreFeatureLike[];
  genreOptions?: string[];
  /** Support-tier stamps. All optional — absent means the full-help render. */
  supportTier?: GenreTier;
  maxGenreOptions?: number;
}

/** One excerpt as the stage and the cues see it — canonical genre, cleaned text. */
export interface ResolvedExcerpt {
  index: number;
  excerptId: string;
  /** Printed on screen, quotes and all. */
  text: string;
  /** Spoken at the band floor; '' when this excerpt may not be read aloud. */
  spokenText: string;
  genre: GenreId | null;
  ordinal: string;
}

export interface GenreBuildResult {
  items: GenreExplorerItem[];
  /** Askable candidates the build gates REFUSED — a generator signal, not a
   *  harness one. Never backfilled. */
  dropped: number;
  /** Askable items held back by the session-length caps. NOT a drop. */
  truncated: number;
  /** The excerpts the stage prints, in screen order. */
  excerpts: ResolvedExcerpt[];
  /** The printed genre menu, in screen order. */
  menu: string[];
  menuNotes: string[];
  /** Does the tutor read the excerpts aloud this session? (Band floor.) */
  readsAloud: boolean;
}

const EMPTY_BUILD: GenreBuildResult = {
  items: [], dropped: 0, truncated: 0, excerpts: [], menu: [], menuNotes: [], readsAloud: false,
};

/**
 * BAND FLOOR: grades K-2, where a child cannot read four sentences of connected
 * text unaided and the tutor must read it to them. Also forces the spoken menu on
 * at every tier — a six-year-old should not have to decode an abstract genre list
 * as well (word-sorter's Kindergarten rule).
 */
export const isBandFloor = (gradeLevel: string | undefined): boolean => {
  const grade = sanitize(gradeLevel);
  if (!grade) return true;
  if (/^(K|kindergarten|preschool|pre-?k)$/i.test(grade)) return true;
  /**
   * ⚠️ TOLERANT OF THE WRAPPER, NEVER OF PROSE (drive finding, 2026-08-17).
   *
   * A grade-1 judged drive came back with the tutor NOT reading the texts aloud,
   * because this compared `gradeLevel` for exact equality with "1" and the field
   * is whatever the generation wrote there — "Grade 1" and "1st" both slip past an
   * exact match. Everywhere else in the family that would cost a cosmetic label;
   * here it silently withdraws a READER-FIT ACCOMMODATION and leaves a six-year-old
   * looking at four sentences nobody will read to them.
   *
   * The generator now stamps this field with the grade it actually resolved and
   * prompted with, so the wrapper should not arise — this is the belt behind that,
   * and it stays a bounded shape match (a leading integer) rather than becoming a
   * second grade parser. `normalizeObjectiveGrade` remains the only one.
   */
  // No `\b` after the digits: "2nd" has no word boundary between "2" and "n",
  // and "2nd grade" is one of the forms this is here to survive.
  const leading = /^(?:grade\s*)?(\d{1,2})/i.exec(grade);
  const numeric = leading ? Number(leading[1]) : NaN;
  return Number.isFinite(numeric) && numeric <= 2;
};

/**
 * Keep at most `limit` excerpts, and make sure the kept set still reaches two
 * GENRES where the payload has them.
 *
 * word-sorter's stranded-mat lesson in its second shape: take the first two of
 * three and a session can end up asking "Fiction or Nonfiction?" three times with
 * the answer "Fiction" every time, which is defect class 2 arriving through the
 * CAP rather than through the content. A SELECTION over material that already
 * passed every gate — never a backfill of material that failed one.
 */
const selectExcerpts = (excerpts: ResolvedExcerpt[], limit: number): ResolvedExcerpt[] => {
  if (excerpts.length <= limit) return excerpts;
  const kept = excerpts.slice(0, limit);
  const genresKept = new Set(kept.map((e) => e.genre).filter(Boolean));
  if (genresKept.size >= 2) return kept;
  const fresh = excerpts.slice(limit).find((e) => e.genre && !genresKept.has(e.genre));
  if (!fresh) return kept;
  kept[kept.length - 1] = fresh;
  return kept.sort((a, b) => a.index - b.index);
};

/**
 * Alternate present/absent so a session cannot be answered "yes" every round.
 * The same arithmetic as the mat-coverage rule, one action down: a feature step
 * whose answer never changes measures compliance, not reading.
 */
const alternateVerdicts = <T extends { present: boolean }>(rows: T[], limit: number): T[] => {
  const yes = rows.filter((r) => r.present);
  const no = rows.filter((r) => !r.present);
  const out: T[] = [];
  for (let i = 0; out.length < limit && (i < yes.length || i < no.length); i++) {
    if (i < yes.length && out.length < limit) out.push(yes[i]);
    if (i < no.length && out.length < limit) out.push(no[i]);
  }
  return out;
};

/** Root-level `features`, or the legacy per-excerpt checklist flattened into it. */
const featuresOf = (payload: GenreExplorerPayloadLike): GenreFeatureLike[] => {
  if (payload.features?.length) return payload.features;
  const flattened: GenreFeatureLike[] = [];
  const byPredicate = new Map<string, GenreFeatureLike>();
  for (const excerpt of payload.excerpts ?? []) {
    for (const feature of excerpt.features ?? []) {
      const predicate = sanitize(feature.predicate ?? feature.label);
      if (!predicate) continue;
      const key = predicate.toLowerCase();
      let row = byPredicate.get(key);
      if (!row) {
        row = { featureId: feature.featureId ?? key.replace(/\s+/g, '-'), predicate, presentIn: [] };
        byPredicate.set(key, row);
        flattened.push(row);
      }
      if (feature.present && excerpt.excerptId) row.presentIn?.push(excerpt.excerptId);
    }
  }
  return flattened;
};

/**
 * Every judged item this payload can ask, in the order a DI sitting runs them:
 * gather the evidence about a text, then name what kind of writing it is.
 *
 * Nothing here backfills. A placeholder in a judged loop becomes a spoken ask the
 * tutor has to stand behind, so an item that cannot be asked cleanly is DROPPED
 * and its step simply has one fewer round — or none.
 */
export const itemsFromPayload = (payload: GenreExplorerPayloadLike): GenreBuildResult => {
  const tier: GenreTier = payload.supportTier ?? 'medium';
  const bandFloor = isBandFloor(payload.gradeLevel);
  const namesChoices = bandFloor || tier !== 'hard';
  /** The mode IS the task identity: `identify_basic` is binary or it is not that
   *  mode. See `BINARY_BUCKET` for the live probe that made this a gate. */
  const binaryMode = sanitize(payload.mode) === 'identify_basic';
  const mode = genreModeOf(sanitize(payload.mode));

  let dropped = 0;
  let truncated = 0;

  // ── The excerpts ──────────────────────────────────────────────────────────
  const rawExcerpts = payload.excerpts ?? [];
  const cleaned: ResolvedExcerpt[] = [];
  rawExcerpts.forEach((excerpt) => {
    const excerptId = sanitize(excerpt?.excerptId);
    const text = sanitize(excerpt?.text);
    if (!excerptId || !text) { dropped += 1; return; }
    // ⚠️ An excerpt that NAMES a genre hands the answer over the instant the
    // tutor reads it, and prints it above the menu even when it does not.
    if (namesAGenre(text)) { dropped += 1; return; }
    const spoken = isReadableAloud(text) ? speechSafe(text) : '';
    // At the band floor a text nobody can read to the child is not a harder
    // task, it is an unreachable one.
    if (bandFloor && !spoken) { dropped += 1; return; }
    const named = canonicalGenre(excerpt?.genre);
    // The binary mode buckets its genres and drops what has no defensible side.
    const genre = binaryMode ? binaryBucketOf(named) : named;
    if (binaryMode && !genre) { dropped += 1; return; }
    cleaned.push({
      index: cleaned.length,
      excerptId,
      text,
      spokenText: spoken,
      genre,
      ordinal: '',
    });
  });

  if (cleaned.length === 0) return { ...EMPTY_BUILD, readsAloud: bandFloor };
  // Same rule one gate earlier: compare mode needs TWO texts to compare. See the
  // contrast branch below for the live probe that made this explicit.
  if (sanitize(payload.mode) === 'compare_genres' && cleaned.length < 2) {
    // eslint-disable-next-line no-console
    console.warn(
      '[genre-explorer] compare_genres survived with fewer than two texts — the mode cannot be delivered.',
    );
    return { ...EMPTY_BUILD, dropped: dropped + cleaned.length, readsAloud: bandFloor };
  }

  truncated += Math.max(0, cleaned.length - MAX_EXCERPTS);
  const selected = selectExcerpts(cleaned, MAX_EXCERPTS);
  const excerpts = selected.map((excerpt, index) => ({
    ...excerpt,
    index,
    ordinal: excerptOrdinalFor(index, selected.length),
  }));
  const excerptById = new Map(excerpts.map((e) => [e.excerptId, e]));

  // ── The menu — canonical, answer-seeded, pruned for the ear ───────────────
  const answers = excerpts
    .map((e) => e.genre)
    .filter((g): g is GenreId => !!g);
  const distinctAnswers = Array.from(new Set(answers));
  const offered = (payload.genreOptions ?? [])
    .map((option) => (binaryMode ? binaryBucketOf(canonicalGenre(option)) : canonicalGenre(option)))
    .filter((id): id is GenreId => !!id);

  const cap = payload.maxGenreOptions;
  const menuIds = pruneForEar(
    distinctAnswers.map((id) => GENRE_LABEL[id]),
    offered.filter((id) => !distinctAnswers.includes(id)).map((id) => GENRE_LABEL[id]),
  )
    .map((label) => ALL_GENRE_IDS.find((id) => GENRE_LABEL[id] === label) as GenreId)
    .slice(0, Math.max(distinctAnswers.length, cap ?? Number.MAX_SAFE_INTEGER));

  const menu = menuIds.map((id) => GENRE_LABEL[id]);
  const menuNotes = menuIds.map((id) => GENRE_GLOSS[id]);
  // A one-option menu is not a decision, and a menu that lost an answer to the
  // ear gate cannot be asked honestly. Both cost the genre step, not the run.
  const menuAskable = menu.length >= 2 && distinctAnswers.every((id) => menuIds.includes(id));

  // ── The features ──────────────────────────────────────────────────────────
  const rawFeatures = featuresOf(payload);
  const features = rawFeatures
    .map((feature) => ({
      featureId: sanitize(feature.featureId),
      predicate: sanitize(feature.predicate ?? feature.label),
      presentIn: (feature.presentIn ?? []).map((id) => sanitize(id)),
    }))
    .filter((feature) => {
      if (!feature.featureId || !isSayablePredicate(feature.predicate)) return false;
      // ⚠️ A predicate that names a genre asks the genre question early.
      if (namesAGenre(feature.predicate)) return false;
      // On the binary mode a feature that restates fiction or nonfiction IS the genre verdict in other words.
      if (binaryMode && restatesBinaryGenre(feature.predicate)) return false;
      // An unresolvable excerptId means we do not know which text it is true of.
      // KEEP-OR-DROP: a guessed `false` here is a spoken ask with a wrong answer.
      return feature.presentIn.every((id) => excerptById.has(id));
    });
  dropped += Math.max(0, rawFeatures.length - features.length);

  /**
   * ⭐ DEFECT CLASS 2: A GENRE IS ASKED ONCE PER SESSION. One ask per DISTINCT
   * genre; a second text of a genre already asked keeps its feature items and
   * loses its genre ask.
   *
   * ⚠️ THIS STARTED AS THE WEAKER "ALL ONE GENRE" RULE AND A LIVE PROBE BROKE IT
   * (classify_genre @ grade 4, 2026-08-17): the model returned
   * `[biography, biography, historical-fiction]`, which has two distinct genres, so
   * the weak rule let all three asks through — and "Biography" was then the right
   * answer to two of them. After the tutor affirms it once, saying it again wins
   * two of three asks with no reading at all, which is precisely the free
   * elimination the class exists to refuse. The general rule is the same length of
   * code as the special case and does not need the payload to be pathological
   * before it bites.
   */
  const genreSeen = new Set<GenreId>();
  const genreAskable = new Set<string>();
  if (menuAskable) {
    for (const excerpt of excerpts) {
      if (!excerpt.genre || genreSeen.has(excerpt.genre)) continue;
      genreSeen.add(excerpt.genre);
      genreAskable.add(excerpt.excerptId);
    }
  }
  dropped += excerpts.length - genreAskable.size;

  const items: GenreExplorerItem[] = [];
  const wantsContrast = sanitize(payload.mode) === 'compare_genres';
  const isContrast = wantsContrast && excerpts.length >= 2;
  /** The excerpts whose text the tutor has already spoken this session. */
  const read = new Set<number>();

  const readAloudFor = (excerpt: ResolvedExcerpt): string => {
    if (!bandFloor || read.has(excerpt.index) || !excerpt.spokenText) return '';
    read.add(excerpt.index);
    return excerpts.length > 1
      ? `Listen to ${excerpt.ordinal}. ${excerpt.spokenText} `
      : `Listen to this one. ${excerpt.spokenText} `;
  };

  const genreItemFor = (excerpt: ResolvedExcerpt): GenreExplorerItem => ({
    id: `genre::${excerpt.excerptId}`,
    action: 'name-genre',
    answerKind: 'voice',
    responseClass: responseClassFor('name-genre'),
    tier,
    answer: GENRE_LABEL[excerpt.genre as GenreId],
    choices: menu,
    choiceNotes: menuNotes,
    excerptIndex: excerpt.index,
    excerptOrdinal: excerpt.ordinal,
    predicate: '',
    readAloud: readAloudFor(excerpt),
    namesChoices,
    mode,
  });

  if (isContrast) {
    // ── compare_genres: contrast the two, then name both ────────────────────
    // Only a feature true of EXACTLY ONE of the two texts is a decidable "which
    // one?" — which is the generator's own "features that genuinely DISTINGUISH
    // the two genres" requirement, made structural instead of hoped for. A
    // feature true of both (or of neither) has no honest answer and DROPS.
    const first = excerpts[0];
    const second = excerpts[1];
    const contrastable = features
      .map((feature) => {
        const inFirst = feature.presentIn.includes(first.excerptId);
        const inSecond = feature.presentIn.includes(second.excerptId);
        if (inFirst === inSecond) return null;
        return { ...feature, winner: inFirst ? first : second };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    dropped += features.length - contrastable.length;

    // SELECT for coverage: a blind slice can land every contrast on one text,
    // and then "the first one" is right every round.
    const balanced = alternateVerdicts(
      contrastable.map((row) => ({ ...row, present: row.winner.index === 0 })),
      MAX_CONTRAST_ITEMS,
    );
    truncated += Math.max(0, contrastable.length - balanced.length);

    /**
     * ⭐ A COMPARE SESSION THAT CANNOT CONTRAST IS NOT THIS MODE — build NOTHING.
     *
     * ⚠️ A live probe produced exactly this (compare_genres @ grade 6 hard,
     * 2026-08-17): the generator's own gates dropped one of the two texts for
     * naming a genre, and what reached the pack was a single memoir and one
     * feature. That built a perfectly valid two-item session — one yes/no and one
     * genre call — which is a Tier-1 shape delivered under a Tier-4 β of 4.5, so
     * the θ it produces is a measurement of the wrong thing. Degrading a mode
     * silently is worse than delivering nothing: an empty build shows the "still
     * being written" panel and the lesson regenerates, while a degraded one is
     * scored.
     */
    if (balanced.length < 2) {
      // eslint-disable-next-line no-console
      console.warn(
        '[genre-explorer] compare_genres has fewer than two contrastable features — the mode cannot be '
        + 'delivered, so nothing is built rather than a session that is scored as a contrast.',
      );
      return {
        ...EMPTY_BUILD,
        dropped: dropped + features.length + excerpts.length,
        truncated,
        readsAloud: bandFloor,
      };
    }

    // Both texts are read once, on the first contrast — the ask is ABOUT both,
    // so hearing one of them is not enough to answer it.
    const bothRead = balanced.length > 0 && bandFloor
      ? `${readAloudFor(first)}${readAloudFor(second)}`
      : '';
    balanced.forEach((row, i) => {
      items.push({
        id: `contrast::${row.featureId}`,
        action: 'pick-excerpt',
        answerKind: 'voice',
        responseClass: responseClassFor('pick-excerpt'),
        tier,
        answer: row.winner.ordinal,
        choices: [first.ordinal, second.ordinal],
        choiceNotes: ['', ''],
        excerptIndex: -1,
        excerptOrdinal: '',
        predicate: row.predicate,
        readAloud: i === 0 ? bothRead : '',
        namesChoices: true,
        mode,
      });
    });
    for (const excerpt of excerpts) {
      if (genreAskable.has(excerpt.excerptId)) items.push(genreItemFor(excerpt));
    }
  } else {
    // ── identify_basic / classify_genre: evidence then verdict, PER TEXT ─────
    // Interleaved rather than blocked: the genre ask lands while the text is
    // still the thing on screen and still the thing the child just heard.
    excerpts.forEach((excerpt) => {
      const rows = features.map((feature) => ({
        ...feature,
        present: feature.presentIn.includes(excerpt.excerptId),
      }));
      const kept = alternateVerdicts(rows, MAX_FEATURE_ITEMS_PER_EXCERPT);
      truncated += Math.max(0, rows.length - kept.length);
      kept.forEach((row) => {
        items.push({
          id: `feature::${excerpt.excerptId}::${row.featureId}`,
          action: 'check-feature',
          answerKind: 'voice',
          responseClass: responseClassFor('check-feature'),
          tier,
          answer: row.present ? 'yes' : 'no',
          choices: [],
          choiceNotes: [],
          excerptIndex: excerpt.index,
          excerptOrdinal: excerpt.ordinal,
          predicate: row.predicate,
          readAloud: readAloudFor(excerpt),
          namesChoices: false,
          mode,
        });
      });
      if (genreAskable.has(excerpt.excerptId)) items.push(genreItemFor(excerpt));
    });
  }

  /**
   * ⭐ THE LAST GATE: no `name-genre` item may ship whose own ask says its own
   * answer. Run over the assembled items rather than inside the branch, because
   * the collision is a property of the finished UTTERANCE — text-structure-
   * analyzer's live drive found one arriving from the SCOPING DEVICE, which no
   * per-branch check would have been watching. Here the likeliest source is the
   * read-aloud excerpt, which `namesAGenre` already refuses; this closes the
   * channel behind it. The menu clause is subtracted: a closed-set ask names its
   * options by design.
   */
  const answerFree = items.filter((item) => {
    if (item.action !== 'name-genre') return true;
    if (askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))) return true;
    // eslint-disable-next-line no-console
    console.warn(
      `[genre-explorer] dropped "${item.id}" — its ask contains its own answer `
      + `("${item.answer}"). An ask that says the answer is broken, not easier.`,
    );
    return false;
  });
  dropped += items.length - answerFree.length;

  if (truncated > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[genre-explorer] session held back ${truncated} askable item(s) — caps are `
      + `${MAX_EXCERPTS} texts, ${MAX_FEATURE_ITEMS_PER_EXCERPT} features per text, `
      + `${MAX_CONTRAST_ITEMS} contrasts per sitting.`,
    );
  }

  return {
    items: answerFree,
    dropped,
    truncated,
    excerpts,
    menu: menuAskable ? menu : [],
    menuNotes: menuAskable ? menuNotes : [],
    readsAloud: bandFloor,
  };
};

// ── Small speakable helpers ─────────────────────────────────────────────────

/** "Fable, Poem, or Informational?" — the spoken menu, and the ONE span the
 *  leak oracle subtracts on a `name-genre` ask. */
export const choicesPhrase = (item: GenreExplorerItem): string => {
  const list = item.choices;
  if (list.length === 0) return '';
  if (list.length === 1) return `${list[0]}?`;
  return `${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}?`;
};


// ── The asks: short, the problem stated aloud, one defensible answer ─────────
// Every predicate is in BASE form ("have talking animals"), so one field serves both question shapes:
// "Does this one have talking animals?" and "Does the first one have talking animals, or does the second one?".

export const questionFor = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return `Does ${item.excerptOrdinal} ${item.predicate}?`;
    case 'pick-excerpt':
      return `Does ${item.choices[0]} ${item.predicate}, or does ${item.choices[1]}?`;
    case 'name-genre':
    default:
      return item.namesChoices
        ? `What kind of writing is ${item.excerptOrdinal}? ${choicesPhrase(item)}`
        // `hard` above the band floor: the kinds are printed and the tier withholds the reading of them. The ask
        // still states its problem.
        : `What kind of writing is ${item.excerptOrdinal}? Say the one you pick.`;
  }
};

/** The ask: the text read aloud at the band floor (first item on it only), then the question. */
export const askFor = (item: GenreExplorerItem): string => `${item.readAloud}${questionFor(item)}`;

/** What the ask says by design: the text read aloud and the feature, which may hold "yes", "no" or "it does". */
export const genreGiven = (item: GenreExplorerItem): string[] =>
  item.action === 'check-feature' ? [item.readAloud, item.predicate].filter(Boolean) : [];

// ── The key ─────────────────────────────────────────────────────────────────

const idOfAnswer = (item: GenreExplorerItem) => ALL_GENRE_IDS.find((g) => GENRE_LABEL[g] === item.answer);

/**
 * The key the tutor judges each item with. check-feature: the verdict, in any natural form; the feature said back is
 * no verdict. pick-excerpt: one of the two positions the ask says in full; "both" and "neither" are wrong. name-genre:
 * the label from the printed menu (a menu key where the ask says it), its everyday forms, its distinguishing part or
 * its place in the list; a close relative is wrong.
 */
export function genreKey(item: GenreExplorerItem): SpokenKey {
  switch (item.action) {
    case 'check-feature': {
      const yes = item.answer === 'yes';
      return {
        answer: item.answer, alsoAccept: yes ? ['yeah', 'it does'] : ['nope', 'it does not'],
        signatureError: `Saying the feature back ("${item.predicate}") gives no verdict and is not it; nor is the opposite verdict.`,
      };
    }
    case 'pick-excerpt': {
      const position = item.answer.replace(/^the /, '').replace(/ one$/, '');
      return {
        answer: item.answer, alsoAccept: [position, `the ${position}`],
        menu: item.choices,
        signatureError: '"Both" and "neither" are wrong: the feature is true of exactly one of the two texts.',
      };
    }
    case 'name-genre':
    default: {
      const id = idOfAnswer(item);
      return {
        answer: item.answer, alsoAccept: id ? [...GENRE_ALTERNATES[id]] : [],
        ...(item.namesChoices ? { menu: item.choices } : {}),
        acceptRule: 'The part of the label that tells it apart from the other printed kinds counts, and so does its '
          + `place in the printed list (${item.choices.map((c, i) => `${i + 1}) ${c}`).join(', ')}).`,
        signatureError: 'Another kind of writing is wrong, even a close relative of the right one.',
      };
    }
  }
}

// ── Known misses ────────────────────────────────────────────────────────────

/** What a wrong spoken answer shows (handoff 20 Part B), by action; `said_broad_kind` from the lever table 2026-10-03. */
export type SpokenGenreMiss = 'opposite_verdict' | 'said_feature_back' | 'other_text' | 'said_both' | 'close_relative' | 'other_genre'
  | 'said_broad_kind';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other verdict or the
 * feature said back (check-feature), the other text or "both" (pick-excerpt), a close relative from the menu, then
 * any other printed kind (name-genre).
 */
export function genreSpokenMisses(item: GenreExplorerItem): KnownMiss[] {
  switch (item.action) {
    case 'check-feature': {
      const does = item.answer === 'yes';
      return [
        { id: 'opposite_verdict', pattern: `The right verdict is "${item.answer}": ${item.excerptOrdinal} ${does ? 'does' : 'does not'} ${item.predicate}. `
          + `The learner gives the opposite verdict, ${does ? '"no" (or "nope", "it does not")' : '"yes" (or "yeah", "it does")'}.`,
          examples: [does ? 'no' : 'yes', does ? 'it does not' : 'it does'] },
        { id: 'said_feature_back', pattern: `The learner says the feature back ("${item.predicate}") with no yes or no.`, examples: [item.predicate] },
      ];
    }
    case 'pick-excerpt': {
      const other = item.choices.find(c => c !== item.answer);
      return [
        ...(other ? [{ id: 'other_text', pattern: `The feature is true of ${item.answer}, not ${other}. The learner's answer is ${other}.`, examples: [other] }] : []),
        { id: 'said_both', pattern: 'The feature is true of exactly one of the two texts. The learner\'s answer is "both" or "neither".', examples: ['both of them', 'neither'] },
      ];
    }
    case 'name-genre':
    default: {
      const id = idOfAnswer(item);
      const others = item.choices.filter(c => c !== item.answer);
      const close = (id ? GENRE_SIBLING[id] ?? [] : []).map(g => GENRE_LABEL[g]).filter(label => others.includes(label));
      const rest = others.filter(c => !close.includes(c));
      // The broad side, only where the menu lists specific kinds; never a form the answer accepts ("a true story about a person" is Biography).
      const accepted = [item.answer, ...(id ? GENRE_ALTERNATES[id] : [])].map(a => a.toLowerCase());
      const broad = item.choices.some(c => c === 'Fiction' || c === 'Nonfiction') ? []
        : ['fiction', 'nonfiction', 'made up', 'real'].filter(b => !accepted.some(a => a.includes(b))).slice(0, 2);
      const quote = (xs: string[]) => xs.map(x => `"${x}"`).join(' or ');
      return [
        ...(close.length ? [{ id: 'close_relative', pattern: `This text is ${item.answer}. The learner's answer is ${quote(close)}, a kind of writing close to ${item.answer} on the printed list.`,
          examples: close.slice(0, 2) }] : []),
        ...(rest.length ? [{ id: 'other_genre', pattern: `This text is ${item.answer}. The learner's answer is ${quote(rest)}, another kind of writing on the printed list.`,
          examples: rest.slice(0, 2) }] : []),
        ...(broad.length ? [{ id: 'said_broad_kind', pattern: `This text is ${item.answer}. The learner names the broad side (fiction or nonfiction, made up, true, real) instead of a kind on the printed list.`,
          examples: broad }] : []),
      ];
    }
  }
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** What is drawn: the texts the item is about and, on a genre item, the printed menu. Never a kind or a verdict. */
export function genreScene(item: GenreExplorerItem, excerpts: readonly ResolvedExcerpt[], menu: readonly string[],
  view: { readsAloud: boolean; practice?: boolean }): SceneOf {
  const shown = item.excerptIndex < 0 ? excerpts : excerpts.filter(e => e.index === item.excerptIndex);
  const facts: Record<string, string> = {};
  for (const excerpt of shown) Object.assign(facts, textFacts(shown.length > 1 ? `text${excerpt.index + 1}` : 'text',
    `${excerpts.length > 1 ? `${excerpt.ordinal}: ` : ''}${excerpt.text}`));
  if (menu.length) facts.menu = `Printed kinds of writing: ${menu.join(', ')}.`;
  facts.constraints = 'Nothing on screen marks a kind of writing or a feature until the answer is credited.'
    + (view.readsAloud ? ' The learner does not read yet: read the text aloud when the ask carries it.' : '');
  if (view.practice) facts.practice = 'An easier practice text named from two kinds, ungraded. The full item comes back after it.';
  return { objects: [], facts };
}

// ── Harness answer material ─────────────────────────────────────────────────

/**
 * The span of the ask inside which the answer may legitimately appear: on a `name-genre` ask that names its menu,
 * exactly the menu clause; elsewhere none (the verdict and position tokens are the question itself).
 */
export const leakExemptSpanFor = (item: GenreExplorerItem): string | undefined =>
  item.action === 'name-genre' && item.namesChoices ? choicesPhrase(item) : undefined;

/** The journey's answers: the code-computed answer, or a plainly different answer of the same kind. */
export const genreExplorerHarnessAnswers = (item: GenreExplorerItem): { correct: string; plainWrong: string } => {
  if (item.action === 'check-feature') return { correct: item.answer, plainWrong: item.answer === 'yes' ? 'no' : 'yes' };
  if (item.action === 'pick-excerpt') return { correct: item.answer, plainWrong: item.choices.find((c) => c !== item.answer) ?? 'the other one' };
  const others = item.choices.filter((c) => c !== item.answer);
  return { correct: item.answer, plainWrong: others[others.length - 1] ?? 'something else' };
};
