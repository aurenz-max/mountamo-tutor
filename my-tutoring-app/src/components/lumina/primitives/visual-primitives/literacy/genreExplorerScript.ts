/**
 * genreExplorerScript — HAND-AUTHORED judged-loop script for genre-explorer
 * (NINETEENTH literacy DI port; qa/di/BACKLOG.md item 22, port 2 of the
 * closed-set literacy frontier). The exact wording IS the pedagogy; these lines
 * are authored per pack, never generated. Item CONTENT (the excerpts, their
 * genres, the feature predicates) stays generator-scoped; this module owns the
 * cue shapes, the canonical genre vocabulary, the build gates, the tier ladder
 * and the leak policy.
 *
 * ── THE ANSWER-MATERIAL FORK (skill step 1 — the table picture) ─────────────
 *
 * ALL THREE ACTIONS ARE SPOKEN, and every tap is deleted. Picture a teacher at a
 * table with one child and a short text between them:
 *
 *   "Listen to this one. A fox saw some grapes …
 *    Your turn. Does this one have animals that talk?"      → "yes"
 *   "Yes, that is right — this one does have animals that talk."
 *   "Your turn. What kind of writing is this one?
 *    Fable, Poem, or Informational?"                        → "Fable"
 *   "Does the first one teach a lesson, or does the second
 *    one?"                                                  → "the first one"
 *
 *   check-feature   yes / no about ONE text          → `yes_no` (build-ahead)
 *   name-genre      a genre NAME from a printed menu → `short_spoken_word` (benched)
 *   pick-excerpt    which of two texts               → `ordinal_word` (benched)
 *
 * ⚠️ THE ROSTER TABLE CALLED THIS PRIMITIVE `closed_set_choice`; IT SHIPS ON
 * `short_spoken_word`, AND THAT IS THE SECOND TIME IN TWO PORTS. `closed_set_choice`
 * is for a whole PROPOSITION ("the passage is put together as cause and effect")
 * whose free production would be `open_set_word`. "Fable" is a NAME — word-sorter's
 * mats and text-structure-analyzer's regions exactly — one or two words, said back
 * whole, and it takes the BENCHED class rather than the build-ahead one. Two
 * consecutive ports correcting the same roster line the same way is the roster
 * reading descriptions instead of answer material, which is the risk item 22's own
 * scope note names.
 *
 * THE COSTUME TEST decided every deletion. A child who cannot tell a fable from a
 * news report could still toggle six checkbox rows at a 1-in-2 floor each, tap one
 * of two genre cards, and press Submit — three actions producing no evidence of
 * the skill at all. What is NOT a costume and stays: the TEXTS and the printed
 * genre menu. A genre question whose candidate genres are unknowable is a broken
 * task, not a harder one (the ten-frame R6 lesson, word-sorter's mats ruling).
 *
 * ── ⭐ DEFECT CLASS 1, TWICE OVER, AND IT IS THE PORT'S BIGGEST MOVE ────────
 *
 * The click era graded ONE screenful: N feature checkboxes plus a genre tap per
 * excerpt, scored as one 100-point submission. Under the judged loop that is
 * several distinct asks with several distinct answers, so `itemsFromPayload`
 * EXPANDS: one judged ask per feature, one per excerpt's genre, one per contrast.
 * Two consequences the scope predicted and one it did not:
 *
 *  1. THE SESSION NEEDS A CAP, AND IT MUST SELECT RATHER THAN TRUNCATE.
 *     `compare_genres` ships 6-8 features across 2 excerpts — a sixteen-ask
 *     sitting on its own. `MAX_CONTRAST_ITEMS` / `MAX_FEATURE_ITEMS_PER_EXCERPT`
 *     hold the run at the family's 6-12, and both caps SELECT for coverage
 *     (word-sorter's stranded-mat lesson): a blind slice of contrast items can
 *     land entirely on one excerpt, and then "the first one" is right every round.
 *  2. THE BINARY IS NOT FIXED BY MOVING THE CHANNEL. `identify_basic` is
 *     Fiction-or-Nonfiction: a 1-in-2 floor per ask however it is answered. What
 *     deletes the guess is the SESSION, not the item — 2-3 excerpts, each with its
 *     own genre call, each preceded by feature evidence, is 1/64 rather than 1/2.
 *     That is why the excerpt count rose (the generator produced exactly ONE for
 *     this mode) and why the feature step earns its place instead of being deleted
 *     with its checkboxes.
 *  3. ⚠️ AND THE EXPANSION RE-CREATES DEFECT CLASS 2 IF NOBODY SPREADS THE
 *     ANSWERS. Three excerpts that are all fiction make three genre asks with one
 *     answer, and after the first the child can say "Fiction" without reading.
 *     `selectExcerpts` displaces a duplicate to reach two distinct genres, and if
 *     the payload genuinely carries only one, ONE genre ask survives.
 *
 * ── THE GENRE NAMES ARE CANONICAL, AND THE GENERATOR IMPORTS THEM ──────────
 *
 * `genreOptions` was a free-string array. A spoken closed set cannot have its
 * option strings authored per generation — one "Fiction (make-believe!)" and the
 * ask is unsayable, one "folk tale" beside "folktale" and no utterance has an
 * honest home. `GENRE_LABEL` is owned here and the schema is enum-constrained to
 * its ids, so the judge is always handed the same target string and there is ONE
 * address for both sides of the wire (letter-spotter's 90-vs-100 drift).
 *
 * ⚠️ AND THE MENU IS PRUNED FOR THE EAR, WHICH THIS VOCABULARY GENUINELY NEEDS.
 * "Fiction" beside "Historical Fiction" is decodable-reader's SUBSET shape exactly:
 * a child who says "fiction" has said something that fits BOTH options and there is
 * no honest verdict. `pruneForEar` keeps every ANSWER and drops any option that
 * would swallow or be swallowed by one already kept — so the generic label loses to
 * the specific one, which is also the pedagogically right survivor.
 *
 * ── ⚠️ THE TUTOR READS THE TEXT AT THE BAND FLOOR, AND THAT IS SAFE HERE ───
 *
 * text-structure-analyzer's tutor may NEVER read the passage: its answer is a word
 * IN the passage, so reading it hands the answer over. Genre is the opposite shape
 * — the answer is a CATEGORY NAME that is not in the text — so reading a fable
 * aloud gives nothing away, and `identify_basic` is grades 1-2, where a child
 * cannot read four sentences of connected text unaided. The band floor therefore
 * READS, and the two gates that keep it honest are:
 *
 *   - an excerpt containing a genre LABEL word ("this fable teaches …") is dropped;
 *   - an excerpt whose SENTENCE opens with a verdict sentinel is dropped, because
 *     this is the family's only pack whose tutor speaks generated prose at length.
 *
 * ── THE LEAK ORACLE IS FLAT ON ONE ACTION AND INAPPLICABLE ON TWO ───────────
 *
 * `name-genre`'s oracle is completely flat and is this port's sharpest gate: the
 * genre label is absent from the ask, from the read-aloud excerpt (gated above),
 * from the how-to-play and from the lead-in, so any occurrence outside the spoken
 * menu clause is a finding. `check-feature` and `pick-excerpt` answer with a
 * VERDICT and a POSITION — tokens the ask must contain to be a question at all —
 * so their leak oracles carry no signal and `askIsAnswerFree` is not run on them.
 * The discrimination oracle carries those two, and this is stated rather than
 * papered over.
 *
 * ── SENTINELS ──────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by `checkPackGates`.
 * ⚠️ The child's own "yes"/"no" is NOT a sentinel hazard — the verdict scan reads
 * the TUTOR's output only (RESPONSE_CLASSES.yes_no, proven in the port-8 session
 * log). The item-22 scope's worry that a spoken yes/no "collides with the
 * sentinels" is answered there; what the pack owes instead is the affirmation
 * opening with "Yes," EVEN WHEN IT AFFIRMS A "NO" ANSWER, which every affirm line
 * below does.
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

/** What the child is doing on this item — the task identity the how-to-play
 *  re-speaks on. NOT the eval mode: the modes are Bloom tiers over the same
 *  three actions, and `identify_basic` would park "Fiction or Nonfiction" in the
 *  tutor's context for the whole session (see `stimulusFor`). */
export type GenreAction = 'check-feature' | 'name-genre' | 'pick-excerpt';

export type GenreTier = 'easy' | 'medium' | 'hard';

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
  /**
   * ⭐ Is this the FIRST item of its action in the session? Stamped at build
   * time, and it exists because this pack INTERLEAVES its actions.
   *
   * The runner re-speaks the how-to-play whenever consecutive items change
   * `action` (useJudgedScriptRunner.ts), which is exactly right for a pack whose
   * actions run in blocks — text-structure-analyzer changes action three times in
   * a nine-item run. Here the evidence step and the verdict step alternate per
   * text (features → genre → features → genre), because a six-year-old should not
   * have to hold a fable in their head for four items before being asked what it
   * was. That ordering makes the runner's policy fire six times in a nine-item
   * run, and a 19-word protocol line recited six times is the recitation defect
   * ruled twice on 2026-08-13, arriving through the ORDERING rather than through
   * the ask.
   *
   * So the protocol is spoken on the introduction and never again: on a later
   * switch back the cue goes straight to the ask, which states its own problem in
   * full. DISTAR fades the model — it does not re-read it.
   */
  introducesAction: boolean;
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
    introducesAction: false,
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
        introducesAction: i === 0,
      });
    });
    for (const excerpt of excerpts) {
      if (genreAskable.has(excerpt.excerptId)) items.push(genreItemFor(excerpt));
    }
  } else {
    // ── identify_basic / classify_genre: evidence then verdict, PER TEXT ─────
    // Interleaved rather than blocked: the genre ask lands while the text is
    // still the thing on screen and still the thing the child just heard. The
    // cost of that ordering is the how-to-play churn `introducesAction` exists
    // to absorb.
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
          introducesAction: false,
        });
      });
      if (genreAskable.has(excerpt.excerptId)) items.push(genreItemFor(excerpt));
    });
  }

  // The protocol is spoken on the introduction of an action and never again —
  // see `introducesAction`. Stamped over the finished order, because "first of
  // its kind" is a property of the SESSION, not of any one branch above.
  const introduced = new Set<GenreAction>();
  for (const item of items) {
    if (introduced.has(item.action)) continue;
    introduced.add(item.action);
    item.introducesAction = true;
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

// ── How-to-play — inside the quoted line (SWAP-1), re-spoken on action change ─

export const howToPlayFor = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return 'I ask you one thing about the writing in front of you — you tell me yes or no. ';
    case 'pick-excerpt':
      return 'You have two texts. I name one thing to look for, and you tell me which text has it. ';
    case 'name-genre':
    default:
      return 'Now you tell me what kind of writing it is. ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing. A tier changes how much
// of the sequence precedes the attempt — never the ask, never the judging, and
// never the correction's re-model (standing gate 3). Spoken ONLY when the action
// is being introduced (`opening || howToPlay`), never per item: if the model line
// does not change when the item changes, it is established once, not recited
// (ruled twice on 2026-08-13).
//
// NOTE what is absent at every rung: a worked EXEMPLAR. Modelling "a story with
// talking animals is a Fable" would say a genre name that is very often the NEXT
// item's answer, since every excerpt of a session shares one menu — word-sorter's
// finding, and the same shape here. These model the STRATEGY instead.

const modelLine = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return 'Answer from the words in front of you, not from what you expect to be there.';
    case 'pick-excerpt':
      return 'Only one of the two has it — so hold it in your head and check them both.';
    case 'name-genre':
    default:
      return 'Think about what you just found in it.';
  }
};

const guideLine = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return 'It is fine to look again before you answer.';
    case 'pick-excerpt':
      return 'Take your time — read both before you decide.';
    case 'name-genre':
    default:
      return 'Read the list, then say the one that matches what you found.';
  }
};

const leadInFor = (item: GenreExplorerItem): string => {
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
//
// Every predicate is in BASE form ("have talking animals"), which is what lets
// one generated field serve both question shapes below without a natural-language
// transform anywhere: "Does this one have talking animals?" and "Does the first
// one have talking animals, or does the second one?".

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
        // `hard` above the band floor: the genres are printed and the tier
        // withholds the reading of them. The ask still STATES its problem — an
        // ask that says nothing is broken, not terser.
        : `What kind of writing is ${item.excerptOrdinal}? Say the one you pick.`;
  }
};

export const askFor = (item: GenreExplorerItem): string =>
  `${item.readAloud}Your turn. ${questionFor(item)}`;

// ── Corrections — DISTAR model-lead-test (standing gate 3) ──────────────────
// All three NAME the fact. A genre, a feature and a contrast are things a child
// either holds or does not, and there is no route to re-model that stops short of
// naming them (word-sorter's ruling). The re-ask deliberately drops the read-aloud
// prefix: the child has just heard the text, it is printed in front of them, and
// tap-to-hear reads it again on demand.

const reAskFor = (item: GenreExplorerItem): string => `Your turn. ${questionFor(item)}`;

const correctionFor = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return item.answer === 'yes'
        ? `My turn: ${item.excerptOrdinal} does ${item.predicate}. ${reAskFor(item)}`
        : `My turn: ${item.excerptOrdinal} does not ${item.predicate}. ${reAskFor(item)}`;
    case 'pick-excerpt':
      return `My turn: ${item.answer} does ${item.predicate}. ${reAskFor(item)}`;
    case 'name-genre':
    default:
      return `My turn: that one is ${item.answer}. ${reAskFor(item)}`;
  }
};

const affirmFor = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      // ⚠️ OPENS WITH "Yes," EVEN WHEN IT AFFIRMS A "NO" — the sentinel is the
      // tutor's verdict marker, not an echo of the child's word.
      return item.answer === 'yes'
        ? `Yes, that is right — ${item.excerptOrdinal} does ${item.predicate}.`
        : `Yes, that is right — ${item.excerptOrdinal} does not ${item.predicate}.`;
    case 'pick-excerpt':
      return `Yes, ${item.answer} does ${item.predicate}.`;
    case 'name-genre':
    default:
      return `Yes, that one is ${item.answer}.`;
  }
};

// ── The 18d law and the item-21 tail (family wording, grep-able) ────────────

/**
 * 18d. Consumed verbatim from `wordWorkoutScript`'s `TWO_BRANCH_LAW`. Identical
 * across the family on purpose: a grep finds every pack that has it and every
 * pack that does not.
 */
const TWO_BRANCH_LAW =
  `Your whole reply to their attempt is ONE of the quoted lines below and nothing else — not the first time, not any time: `
  + `no praise, no encouragement, no hint, no reminder of the method, no scaffolding line, however kind it would be. `
  + `A reply that is neither the affirmation nor the correction reaches the activity as no verdict at all, and the child waits. `;

/**
 * Item 21's tail, consumed from counting-board's.
 *
 * ⚠️ ITS "NEVER READ THE SCREEN ALOUD" CLAUSE IS NARROWED FOR THIS PACK, AND
 * DELIBERATELY. Every other literacy port forbids reading the printed text
 * outright, because the printed text contains the answer. Here it does not —
 * the answer is a category NAME that `namesAGenre` keeps out of every excerpt —
 * and at the band floor the tutor reading the text IS the accommodation a
 * six-year-old needs. So the rule binds to the quoted line: read exactly what is
 * quoted, and never a word of the screen beyond it.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `never read the texts on the child's screen aloud beyond what your quoted line already contains, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * The verdict line is the END of the turn — word-sorter's cap-drill finding
 * (2026-08-16), where eleven of twelve affirmations ran on into a fabricated next
 * ask about a real word from the challenge.
 *
 * It is carried here rather than assumed because this pack has the same trigger
 * twice over: the feature ask is one rigid template spoken several times in a row
 * with only a predicate changing, and the tutor is handed the whole feature list
 * in neither case — so the likeliest continuation of a short affirmation is
 * another question about the text it can see.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never ask about another feature or another text, and never announce what is coming — the activity sends you `
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
 *  check-feature  the signature wrong is THE FEATURE SAID BACK. The child echoes
 *                 "talking animals" — a real phrase the tutor spoke two seconds
 *                 earlier — and a judge grading on "did I hear something relevant"
 *                 affirms it. It is not a verdict, so it is not an answer.
 *  name-genre     the signature wrong is THE SIBLING GENRE (folktale for fable,
 *                 autobiography for biography). Semantically adjacent, confidently
 *                 said, and the exact discrimination the lesson exists to teach.
 *  pick-excerpt   the signature wrong is "BOTH". The child who has not actually
 *                 contrasted the two texts hedges into the answer that sounds
 *                 generous, and the ask is decidable precisely because the feature
 *                 is true of one text only.
 */
const judgingContract = (item: GenreExplorerItem): string => {
  const preamble =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner reads and thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `;

  if (item.action === 'check-feature') {
    const yes = item.answer === 'yes';
    return (
      preamble
      + `The correct answer is "${item.answer}" — ${item.excerptOrdinal} `
      + `${yes ? 'does' : 'does not'} ${item.predicate}. `
      + `Count any natural form of that verdict as the same answer: `
      + `${yes ? '"yes", "yeah", "it does", "uh huh", a nod said out loud' : '"no", "nope", "it does not", "uh uh"'}. `
      + `A shy or mumbled try still counts. `
      + `Saying the thing you asked about back to you — "${item.predicate}" — is NOT an answer however confident it `
      + `sounds; those words are the question. If they give the opposite verdict, that is wrong. `
      + TWO_BRANCH_LAW
      + `If the answer is right, say exactly: "${affirmFor(item)}" `
      + `If it is wrong, say exactly: "${correctionFor(item)}"`
    );
  }

  if (item.action === 'pick-excerpt') {
    return (
      preamble
      + `The learner answers OUT LOUD by telling you WHICH of the two texts it is. `
      + `The correct answer is "${item.answer}". `
      + `They have named it if they say it whole, or just the position ("first", "second"), or "that one" `
      + `together with the number. A child answers with the short form far more often than the whole phrase, `
      + `and the short form is a full answer, not a lesser one. `
      + `The other text is wrong. "Both" and "neither" are also wrong: exactly one of the two `
      + `${item.predicate ? `does ${item.predicate}` : 'has it'}, which is what makes this question decidable. `
      + TWO_BRANCH_LAW
      + `If the answer is right, say exactly: "${affirmFor(item)}" `
      + `If it is wrong, say exactly: "${correctionFor(item)}"`
    );
  }

  const genreId = ALL_GENRE_IDS.find((id) => GENRE_LABEL[id] === item.answer);
  const alternates = genreId ? GENRE_ALTERNATES[genreId] : [];
  const numbered = item.choices.map((c, i) => `${i + 1}) "${c}"`).join(' ');
  const correctIndex = item.choices.indexOf(item.answer) + 1;
  return (
    preamble
    + `The learner answers OUT LOUD by telling you what kind of writing it is. `
    + `The choices printed on their screen, in order, are: ${numbered}. `
    + `The correct one is number ${correctIndex}. `
    + `They have named it if they say the whole label, OR just the part that tells it apart from the others `
    + `("historical" for "Historical Fiction"), OR where it sits in the list ("the second one")`
    + (alternates.length
      ? `, OR the everyday way a child says it: ${alternates.map((a) => `"${a}"`).join(', ')}`
      : '')
    + `. A child answers with the short or the familiar form far more often than the catalogue word, and that is a `
    + `full answer, not a lesser one. `
    + `Naming a DIFFERENT kind of writing is wrong even when it is a close relative of the right one — telling `
    + `those two apart is exactly what is being measured here. `
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}" `
    + `If you truly cannot tell WHICH one they meant — they trailed off, or what they said fits two of them — `
    + `do not guess and do not judge: say exactly "Tell me that one again." and wait for them.`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface GenreCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside
 *  the quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: GenreExplorerItem,
  opts: GenreCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us look at some writing together. ' : '';
  // Introducing = the run's opening, or the FIRST time this action comes up.
  // The runner offers `howToPlay` on every action change; `introducesAction` is
  // what stops an interleaved pack reciting the protocol six times in nine items.
  const introducing = !!(opts.opening || (opts.howToPlay && item.introducesAction));
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[GEX_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * NO CLOSE LINE (word-sorter's deduction, carried). Every correction in this pack
 * NAMES the fact and the runner runs it TWICE before capping, so the child has
 * already heard "that one is Fable" twice — a third telling is redundant. It is
 * also the only place a genre label would reach the move-on utterance outside the
 * exempt menu clause, and every excerpt of a session shares one menu, so a close
 * line here names a label that is very often the NEXT item's answer.
 */
export const moveOnCue = (
  item: GenreExplorerItem,
  next: GenreExplorerItem | null,
  opts: GenreCueOptions = {},
): string => {
  if (!next) {
    return (
      `[GEX_MOVE] Say exactly: "Good try! We will look at that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!(opts.howToPlay && next.introducesAction);
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[GEX_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[GEX_COMPLETE] Say exactly: "Great reading today! You worked out what kind of writing each one was, `
  + `and you told me every answer out loud. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn by
 * band or tier. It carries the read-aloud text WITH it, which is the one place
 * this pack differs from the family default and the reason the channel matters
 * here: at the band floor the text IS question-side audio, and a six-year-old who
 * missed a fable needs the fable, not a louder question.
 */
export const pronounceCue = (item: GenreExplorerItem): string => {
  const spokenText = item.readAloud || '';
  const line = `${spokenText}${questionFor(item)}`;
  return (
    `[GEX_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY.
 *
 * ⚠️ `challengeType` IS THE ACTION, NOT THE EVAL MODE, and that is deliberate.
 * `identify_basic` names its own two-genre answer set, so pushing the mode would
 * park half the Identify answer in the tutor's context for the whole session,
 * where it can be volunteered on any turn. The action is what the tutor actually
 * needs to know ("which step am I on"); the answer arrives per item, inside the
 * cue, and leaves with it.
 */
export const stimulusFor = (item: GenreExplorerItem): string => {
  switch (item.action) {
    case 'check-feature':
      return 'one short text on their screen, which they have already heard or read';
    case 'pick-excerpt':
      return 'two short texts about the same topic, side by side on their screen';
    case 'name-genre':
    default:
      return `one short text, with ${item.choices.length} kinds of writing printed beside it`;
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
export const genreExplorerPackBase = (
  items: GenreExplorerItem[],
): JudgedCueSurface<GenreExplorerItem> => ({
  primitiveType: 'genre-explorer',
  activityLine: 'live direct instruction genre classification',
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
 * `name-genre` closes on a spoken MENU when the tier names it — the answer is
 * inside the question by construction (push-pull-arena's shape, word-sorter's
 * tier-conditional form) — so exactly that clause is subtracted, and at `hard`
 * above the band floor no clause is spoken and the oracle goes FLAT.
 *
 * The other two actions have no exempt span because they have no leak tokens at
 * all: see `genreExplorerHarnessAnswers`.
 */
export const leakExemptSpanFor = (item: GenreExplorerItem): string | undefined =>
  item.action === 'name-genre' && item.namesChoices ? choicesPhrase(item) : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each of
 * these; this is that claim made testable. Change one, change both.
 *
 * ⚠️ TWO OF THE THREE ACTIONS SHIP WITH AN EMPTY `leakTokens`, AND THAT IS A
 * PROPERTY OF THE ANSWER MATERIAL RATHER THAN A SOFTENED GATE. A `check-feature`
 * answer is the word "yes" or "no" and a `pick-excerpt` answer is "the first
 * one"; both are tokens the ask MUST contain to be a question, and the tutor's own
 * affirmation sentinel is literally the string "Yes". A leak oracle over either
 * would fire on every single turn and mean nothing. What carries those two is the
 * DISCRIMINATION oracle — the signature wrong below — and `name-genre`'s oracle is
 * completely flat, which is where this port's leak evidence actually comes from.
 */
export const genreExplorerHarnessAnswers = (item: GenreExplorerItem) => {
  if (item.action === 'check-feature') {
    return {
      correct: item.answer,
      plainWrong: item.answer === 'yes' ? 'no' : 'yes',
      signatureWrong: {
        text: item.predicate,
        why:
          'the thing they were asked about, said straight back — a real phrase the tutor itself spoke two '
          + 'seconds earlier, so a judge grading on "did I hear something relevant to this item" affirms it. '
          + 'It is not a verdict, so it is not an answer, and the contract names this miss by name',
      },
      leakTokens: [] as string[],
    };
  }

  if (item.action === 'pick-excerpt') {
    const other = item.choices.find((c) => c !== item.answer) ?? 'the other one';
    return {
      correct: item.answer,
      plainWrong: other,
      signatureWrong: {
        text: 'both of them',
        why:
          'the hedge of a child who has not actually contrasted the two texts. It sounds generous and '
          + 'cooperative, and a warm judge takes it — but the feature is true of exactly one text, which is '
          + 'the only reason this question is decidable at all',
      },
      leakTokens: [] as string[],
    };
  }

  const genreId = ALL_GENRE_IDS.find((id) => GENRE_LABEL[id] === item.answer);
  const siblings = (genreId ? GENRE_SIBLING[genreId] ?? [] : []).map((id) => GENRE_LABEL[id]);
  const others = item.choices.filter((c) => c !== item.answer);
  const nearest = siblings.find((label) => others.includes(label)) ?? others[0];
  return {
    correct: item.answer,
    plainWrong: others[others.length - 1] ?? 'something else',
    signatureWrong: {
      text: nearest ?? 'something else',
      why:
        'the SIBLING genre — the one that shares the answer\'s whole shape and differs on a single feature '
        + '(folktale for fable, autobiography for biography, persuasive for informational). It is a real option '
        + 'on the printed menu, semantically adjacent, and telling the two apart is the entire skill being measured',
    },
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
};
