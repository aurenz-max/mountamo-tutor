/**
 * sentenceAnalyzerScript — the judged DI pack for `sentence-analyzer`
 * (TWENTIETH literacy port, 2026-08-17; qa/di/BACKLOG.md item 22, port 3 of the
 * closed-set literacy frontier).
 *
 * The tutor asks, waits, judges the spoken answer from the audio in-band,
 * corrects contrastively, and its own affirmation is the advance. Nothing here
 * is tapped.
 *
 * ── THE ANSWER MATERIAL, AND THE ROSTER LINE IT CORRECTS ────────────────────
 *
 * Item 22's roster priced all four modes as `closed_set_choice`, citing the
 * catalog's own description: *"from multiple choice options"*. Every one of them
 * ships `short_spoken_word` instead, and this is the THIRD CONSECUTIVE PORT to
 * correct that column the same way (text-structure-analyzer's `place-idea`,
 * genre-explorer's `name-genre`, now all four modes here). The line is not
 * unlucky — it is reading the click era's MENU as if the menu described the
 * answer. A menu is evidence that a tap surface needed something to tap; the
 * class is decided by what the child SAYS. "Adjective", "Subject", "Predicate"
 * and "Declarative" are NAMES — one word, one target — which is
 * `short_spoken_word`, benched. `closed_set_choice` is for a whole PROPOSITION
 * whose free production would be `open_set_word`, and none of these is that.
 *
 * ── THE MENU DID NOT SURVIVE. THE WORD WALL DID ─────────────────────────────
 *
 * The click era authored four options PER ITEM (one right, three model-written
 * distractors). That is a 1-in-4 guess floor assembled for a screen, and under a
 * spoken ask it also hands the child the answer set. It is deleted. What replaces
 * it is the object a teacher actually has on the wall: a GRADE-SCOPED list of the
 * grammar vocabulary in scope, printed, glossed, identical on every item, and not
 * tappable (word-builder's morpheme board, one subject over).
 *
 * ⚠️ THE WALL IS SCOPED BY GRADE, NEVER BY THE SESSION — and that is the fix for
 * a live elimination leak, not a style choice. `label_all`'s click-era chip bank
 * was `new Set(words.map(w => w.partOfSpeech))`: the bank printed EXACTLY the
 * labels the sentence used, so a six-word sentence with four labels could be
 * substantially solved by counting the bank against the words. Defect class 3
 * with a different surface. A grade wall carries labels the sentence does not
 * use, so it narrows nothing.
 *
 * ── TWO CONTENT DEFECTS THE SPOKEN ASK AUDITED OUT (defect class 8) ──────────
 *
 * 1. ⭐ **THE SUBJECT/PREDICATE ANSWER KEY WAS WRONG FOR EVERY DETERMINER AND
 *    EVERY SUBJECT-SIDE MODIFIER.** The click era derived the side in the
 *    component: `role.includes('subject') ? 'subject' : 'predicate'`. In "The
 *    clever fox jumped quickly", "The" has role `Determiner` and "clever" has
 *    role `Modifier`, so BOTH were keyed to the predicate — they are the complete
 *    subject. Under a button that silently marked correct children wrong. Under a
 *    judged loop the tutor REFUSES A CORRECT CHILD OUT LOUD, which is the worst
 *    landing a wrong key has. The side is now an explicit generated field
 *    (`subjectEndIndex`, the last word of the complete subject) and any sentence
 *    that cannot state it — an imperative with no subject word, an inverted
 *    question — DROPS its side items rather than guessing one.
 * 2. **`Conjunction` and `Determiner` were offered as grammatical ROLES.** They
 *    are parts of speech; a word whose role is one of them has no clean answer to
 *    "what job does it do in this sentence?". They are gone from the role
 *    vocabulary, and a word keyed to one is dropped as a role target.
 *
 * ── THE SUBSET HAZARD THIS VOCABULARY GENUINELY HAS ─────────────────────────
 *
 * "Noun" is a substring of "Pronoun", and "Object" is shared by three role
 * labels. The family's usual answer is `pruneForEar` — drop the subset option —
 * but that is for a per-item menu, and here BOTH members are core curriculum
 * vocabulary that the lesson exists to tell apart. So the pack takes the opposite
 * route the class permits: the judge is handed ONE target, and the contract says
 * in as many words that a partial match is NOT a match ("noun" does not answer a
 * pronoun). A STRICTNESS clause, not a leniency one.
 *
 * ── THE LEAK ORACLE ─────────────────────────────────────────────────────────
 *
 * Sharp on three of the four actions: the label is absent from the ask, from the
 * printed sentence (`namesAGrammarTerm` drops any sentence containing grammar
 * vocabulary), from the read-aloud and from the lead-in. It is INAPPLICABLE on
 * `name-side`, whose answer is one of the two words the ask must contain to be a
 * question at all ("is it in the subject or in the predicate?") — stated here
 * rather than papered over, exactly as genre-explorer states it for `yes_no`.
 * That action is carried by the DISCRIMINATION oracle.
 *
 * ── THE WALL IS SPOKEN ON THE INTRODUCTION, NEVER PER ITEM ──────────────────
 *
 * `label_all` runs up to four `name-pos` asks back to back over one sentence.
 * Appending "Noun, verb, adjective, or determiner?" to each of them is the
 * recitation defect ruled twice on 2026-08-13, so the wall rides the how-to-play
 * (`introducesAction`, genre-explorer's stamp — this is its second consumer and
 * the finding generalised exactly as predicted). It stays printed the whole time.
 *
 * ── SENTINELS ───────────────────────────────────────────────────────────────
 * Engine defaults ("Yes" / "My turn"), collision-checked by `checkPackGates`. No
 * grammar label opens with either, and `opensWithSentinel` drops any generated
 * sentence that does.
 */

import {
  opensWithSentinel,
  type JudgedCueSurface,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';

// Re-exported so the generator imports its build gates from ONE address — both
// sides of the wire must agree on what is sayable (letter-spotter's 19f drift).
export { opensWithSentinel };

// ── The canonical grammar vocabulary — owned here, imported by the generator ─
//
// A spoken closed set cannot have its option strings authored per generation:
// the child SAYS one of these, the judge is handed the exact string, and the
// printed wall must match both. The click era let the model write its own option
// text, which is how the literal string "Other" ended up padding menus.

export type PosLabel =
  | 'Noun' | 'Verb' | 'Adjective' | 'Adverb' | 'Pronoun'
  | 'Preposition' | 'Conjunction' | 'Determiner' | 'Interjection';

export type RoleLabel =
  | 'Subject' | 'Predicate' | 'Direct Object' | 'Indirect Object'
  | 'Object of Preposition' | 'Modifier';

export type SentenceTypeLabel =
  | 'Declarative' | 'Interrogative' | 'Imperative' | 'Exclamatory';

export const ALL_POS: readonly PosLabel[] = [
  'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun',
  'Preposition', 'Conjunction', 'Determiner', 'Interjection',
];

export const ALL_ROLES: readonly RoleLabel[] = [
  'Subject', 'Predicate', 'Direct Object', 'Indirect Object',
  'Object of Preposition', 'Modifier',
];

export const ALL_SENTENCE_TYPES: readonly SentenceTypeLabel[] = [
  'Declarative', 'Interrogative', 'Imperative', 'Exclamatory',
];

/** The printed gloss under each wall label. Never spoken; never the answer. */
export const POS_GLOSS: Record<PosLabel, string> = {
  Noun: 'names a person, place or thing',
  Verb: 'shows an action or a state of being',
  Adjective: 'describes a noun',
  Adverb: 'describes a verb',
  Pronoun: 'stands in for a noun',
  Preposition: 'shows where or when',
  Conjunction: 'joins parts together',
  Determiner: 'points out which one',
  Interjection: 'shows sudden feeling',
};

export const ROLE_GLOSS: Record<RoleLabel, string> = {
  Subject: 'who or what the sentence is about',
  Predicate: 'what the subject does or is',
  'Direct Object': 'receives the action',
  'Indirect Object': 'who the action is done for',
  'Object of Preposition': 'follows a preposition',
  Modifier: 'adds detail to another word',
};

export const SENTENCE_TYPE_GLOSS: Record<SentenceTypeLabel, string> = {
  Declarative: 'tells you something',
  Interrogative: 'asks a question',
  Imperative: 'gives an order',
  Exclamatory: 'shows strong feeling',
};

/**
 * The everyday way a child says each label. A grade-3 child says "naming word"
 * long before "noun", and that is a full answer, not a lesser one.
 *
 * ⚠️ NOTHING HERE MAY BE AMBIGUOUS ACROSS TWO LABELS. "Describing word" is the
 * classroom name for BOTH adjective and adverb, so it appears under neither —
 * accepting it would make the pack affirm the very confusion the mode measures
 * (the click era's own `commonStruggles` names that confusion second).
 */
export const POS_ALTERNATES: Partial<Record<PosLabel, readonly string[]>> = {
  Noun: ['naming word'],
  Verb: ['action word', 'doing word'],
  Determiner: ['article'],
  Conjunction: ['joining word'],
};

export const ROLE_ALTERNATES: Partial<Record<RoleLabel, readonly string[]>> = {
  'Object of Preposition': ['object of the preposition'],
};

/**
 * Labels a partial or adjacent answer must NOT be allowed to satisfy. The judge is
 * handed one target, so this is a strictness clause the contract states in words —
 * the family's usual `pruneForEar` DROP cannot apply when both members of the pair
 * are curriculum vocabulary the lesson exists to separate.
 */
export const CONFUSABLE_WITH: Partial<Record<string, readonly string[]>> = {
  Noun: ['Pronoun'],
  Pronoun: ['Noun'],
  Adjective: ['Adverb'],
  Adverb: ['Adjective'],
  'Direct Object': ['Indirect Object', 'Object of Preposition'],
  'Indirect Object': ['Direct Object', 'Object of Preposition'],
  'Object of Preposition': ['Direct Object', 'Indirect Object'],
};

/** "a Noun" / "an Adjective" — code-owned, never a regex on the first letter
 *  (the list of grammar terms is short enough to simply write down). */
const POS_ARTICLE: Record<PosLabel, string> = {
  Noun: 'a', Verb: 'a', Adjective: 'an', Adverb: 'an', Pronoun: 'a',
  Preposition: 'a', Conjunction: 'a', Determiner: 'a', Interjection: 'an',
};

const TYPE_ARTICLE: Record<SentenceTypeLabel, string> = {
  Declarative: 'a', Interrogative: 'an', Imperative: 'an', Exclamatory: 'an',
};

// ── The grade wall — what is IN SCOPE, not what the sentence happens to use ──

/**
 * Cumulative by grade. A label the grade has not met yet is not on the wall, and
 * an item whose answer is off the wall is DROPPED: a spoken ask whose answer the
 * child has never been taught is not a harder item, it is an unfair one, and it
 * is also a grade-fidelity failure the click era had no gate for.
 */
const POS_BY_GRADE: Record<number, readonly PosLabel[]> = {
  2: ['Noun', 'Verb', 'Adjective', 'Determiner'],
  3: ['Noun', 'Verb', 'Adjective', 'Determiner', 'Adverb', 'Pronoun'],
  4: ['Noun', 'Verb', 'Adjective', 'Determiner', 'Adverb', 'Pronoun', 'Preposition', 'Conjunction'],
};

const ROLE_BY_GRADE: Record<number, readonly RoleLabel[]> = {
  2: [],
  3: ['Subject', 'Predicate', 'Modifier'],
  4: ['Subject', 'Predicate', 'Modifier', 'Direct Object'],
  5: ['Subject', 'Predicate', 'Modifier', 'Direct Object', 'Object of Preposition'],
};

export const posWallFor = (grade: number): PosLabel[] =>
  [...(POS_BY_GRADE[Math.min(Math.max(grade, 2), 5)] ?? ALL_POS)];

export const roleWallFor = (grade: number): RoleLabel[] =>
  [...(ROLE_BY_GRADE[Math.min(Math.max(grade, 2), 6)] ?? ALL_ROLES)];

// ── Normalisation: a generated string → a canonical label, or null (= DROP) ──

const sanitize = (value: string | undefined | null): string =>
  (value ?? '').replace(/\s+/g, ' ').trim();

const keyOf = (value: string): string =>
  sanitize(value).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

const POS_ALIASES: Record<string, PosLabel> = {
  noun: 'Noun', nouns: 'Noun', 'common noun': 'Noun', 'proper noun': 'Noun',
  verb: 'Verb', verbs: 'Verb', 'action verb': 'Verb', 'helping verb': 'Verb', 'linking verb': 'Verb',
  adjective: 'Adjective', adjectives: 'Adjective',
  adverb: 'Adverb', adverbs: 'Adverb',
  pronoun: 'Pronoun', pronouns: 'Pronoun',
  preposition: 'Preposition', prepositions: 'Preposition',
  conjunction: 'Conjunction', conjunctions: 'Conjunction',
  determiner: 'Determiner', determiners: 'Determiner', article: 'Determiner', articles: 'Determiner',
  interjection: 'Interjection', interjections: 'Interjection',
};

const ROLE_ALIASES: Record<string, RoleLabel> = {
  subject: 'Subject', 'complete subject': 'Subject', 'simple subject': 'Subject',
  predicate: 'Predicate', 'complete predicate': 'Predicate', 'simple predicate': 'Predicate',
  'direct object': 'Direct Object',
  'indirect object': 'Indirect Object',
  'object of preposition': 'Object of Preposition',
  'object of the preposition': 'Object of Preposition',
  'prepositional object': 'Object of Preposition',
  modifier: 'Modifier', modifiers: 'Modifier',
};

const TYPE_ALIASES: Record<string, SentenceTypeLabel> = {
  declarative: 'Declarative', statement: 'Declarative',
  interrogative: 'Interrogative', question: 'Interrogative',
  imperative: 'Imperative', command: 'Imperative',
  exclamatory: 'Exclamatory', exclamation: 'Exclamatory',
};

export const canonicalPos = (value: string | undefined | null): PosLabel | null =>
  POS_ALIASES[keyOf(value ?? '')] ?? null;

export const canonicalRole = (value: string | undefined | null): RoleLabel | null =>
  ROLE_ALIASES[keyOf(value ?? '')] ?? null;

export const canonicalSentenceType = (
  value: string | undefined | null,
): SentenceTypeLabel | null => TYPE_ALIASES[keyOf(value ?? '')] ?? null;

// ── The task identities ─────────────────────────────────────────────────────

/**
 * What the child is DOING — the how-to-play re-speaks on this, never on the eval
 * mode. `identify_pos` and `label_all` share `name-pos` on purpose: the action is
 * identical (name this word's part of speech) and only the SHAPE of the demand
 * differs (one spotlight word per sentence versus a walk across the sentence),
 * which is what the eval modes and their betas price.
 *
 * ⚠️ Pushing the MODE through the context channel would be a leak: `parse_structure`
 * names its own two-word answer set out loud, so the mode string would park half
 * that mode's answers in the tutor's context for the whole session.
 */
export type SentenceAction = 'name-pos' | 'name-role' | 'name-side' | 'name-type';

export type SentenceTier = 'easy' | 'medium' | 'hard';

/** The kind of wall this action answers from — decides what the stage prints. */
export type WallKind = 'pos' | 'role' | 'type' | 'none';

export interface SentenceAnalyzerItem extends JudgedScriptItem {
  action: SentenceAction;
  tier: SentenceTier;
  /** The label, said out loud. Always a canonical string from this module. */
  answer: string;
  /** The sentence this item is about, as printed. */
  sentence: string;
  /** The same sentence, speech-safe — '' when it is not readable aloud. Carried
   *  per item so tap-to-hear can re-read it at the band floor on EVERY item, not
   *  only the one that consumed the run's single read-aloud. */
  spokenSentence: string;
  /** Index of the sentence within the session; drives the read-aloud ledger. */
  sentenceIndex: number;
  /** The word being asked about; '' on `name-type`, which is about the whole
   *  sentence. */
  targetWord: string;
  /** Position of that word, for the stage's highlight. -1 on `name-type`. */
  targetIndex: number;
  /** Which wall answers this item. */
  wall: WallKind;
  /** The wall as printed, in screen order — grade-scoped, identical all session. */
  wallLabels: string[];
  /** Text the tutor speaks before the question: the sentence itself, at the band
   *  floor only, on the FIRST item that lands on it. '' otherwise. */
  readAloud: string;
  /** Does the INTRODUCTION read the wall aloud? True at the band floor and at
   *  `easy`; never per item — see the header. */
  namesWall: boolean;
  /** First item of its action in the session — genre-explorer's stamp, and this
   *  pack interleaves `name-side` with `name-type` per sentence. */
  introducesAction: boolean;
}

/** Every item is SAID. Nothing in this pack answers with its hands — there is no
 *  position, no form and no build anywhere in the four modes. */
export const answerKindFor = (_action: SentenceAction): 'voice' => 'voice';

/** Standing gate 1. All four actions name a grammar label: one short word from a
 *  closed set, one target per item. See the header for the roster correction. */
export const responseClassFor = (_action: SentenceAction): ResponseClassId =>
  'short_spoken_word';

export const wallKindFor = (action: SentenceAction): WallKind => {
  switch (action) {
    case 'name-pos': return 'pos';
    case 'name-role': return 'role';
    case 'name-type': return 'type';
    // `name-side` names its two options inside the question; a printed wall of
    // two would be a second answer surface saying the same thing.
    case 'name-side':
    default: return 'none';
  }
};

// ── Session shape ───────────────────────────────────────────────────────────
//
// A judged round costs an ask, a think, a verdict and an affirmation. These hold
// a sitting to roughly nine rounds — long enough to delete a guess, short enough
// for one sitting.

export const MAX_SENTENCES = 3;
/** `identify_pos` / `identify_role`: the click era asked ONE word per sentence.
 *  Two costs nothing and doubles the evidence, provided the two carry DIFFERENT
 *  labels — one sentence answering "Noun" twice is defect class 2 in miniature. */
export const MAX_TARGETS_PER_SENTENCE = 2;
/** `label_all`: the exhaustive walk, capped and SELECTED (never sliced) so the
 *  kept words still spread across the labels the sentence uses. */
export const MAX_LABEL_ALL_WORDS = 4;
/** `parse_structure` step 1, alternating sides so "predicate" cannot answer them
 *  all — predicates are usually the longer half, so a blind pick skews. */
export const MAX_SIDE_ITEMS_PER_SENTENCE = 3;
export const MAX_ITEMS = 9;

/** A sentence the tutor can read aloud in one breath at the band floor. */
export const MAX_READ_ALOUD_WORDS = 14;
/** Below this there is no subject/predicate boundary worth asking about. */
export const MIN_WORDS_FOR_SIDE = 3;

// ── Speech safety and the leak gates ────────────────────────────────────────

const wordsIn = (value: string): number => sanitize(value).split(' ').filter(Boolean).length;

/** Strip what a TTS voice reads as punctuation noise, keep sentence-final marks —
 *  a question mark is the whole evidence for `Interrogative`. */
export const speechSafe = (value: string): string =>
  sanitize(value).replace(/["'‘’“”]/g, '').replace(/\s+([,.!?])/g, '$1');

export const isReadableAloud = (text: string): boolean => {
  const clean = speechSafe(text);
  if (!clean || wordsIn(clean) > MAX_READ_ALOUD_WORDS) return false;
  return !opensWithSentinel(clean);
};

/**
 * Every word of the grammar vocabulary, as bare tokens. A sentence containing any
 * of them says an answer out loud the moment the tutor reads it — and prints one
 * above the wall even when it does not.
 *
 * ⚠️ "object" is in here as a bare token and WILL over-drop the everyday noun
 * ("The object fell"). That is the correct trade: keep-or-drop costs one sentence
 * out of a set the generator can always make more of, where a leak costs the item
 * it leaks on. The click era had no gate here at all.
 */
const GRAMMAR_TERM_WORDS: readonly string[] = Array.from(new Set(
  [...ALL_POS, ...ALL_ROLES, ...ALL_SENTENCE_TYPES]
    .flatMap((label) => label.toLowerCase().split(' '))
    .filter((word) => word !== 'of')
    .flatMap((word) => [word, `${word}s`]),
));

export const namesAGrammarTerm = (text: string): boolean => {
  const tokens = keyOf(text).split(' ').filter(Boolean);
  return tokens.some((token) => GRAMMAR_TERM_WORDS.includes(token));
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Does this ask avoid saying its own answer? The channel-level close
 * text-structure-analyzer earned: its collision arrived from the SCOPING DEVICE,
 * which no per-branch check was watching, so the gate runs over the FINISHED ask
 * rather than over the parts that build it.
 */
export const askIsAnswerFree = (ask: string, answer: string, exempt?: string): boolean => {
  const haystack = exempt ? ask.split(exempt).join(' ') : ask;
  return !new RegExp(`\\b${escapeRegExp(answer)}\\b`, 'i').test(haystack);
};

/**
 * Grade as a number, clamped to this primitive's 2-8 range.
 *
 * Tolerant of the wrapper, never of prose: the grade-1 drive finding of
 * 2026-08-17 was an exact-equality compare against a model-authored field, which
 * silently withdrew a reader-fit accommodation. The generator now stamps the
 * grade it actually resolved; this is the belt behind that.
 * `normalizeObjectiveGrade` remains the only real grade parser in the app.
 */
export const gradeNumberOf = (gradeLevel: string | undefined): number => {
  const grade = sanitize(gradeLevel);
  if (!grade) return 4;
  if (/^(K|kindergarten|preschool|pre-?k)$/i.test(grade)) return 2;
  const leading = /^(?:grade\s*)?(\d{1,2})/i.exec(grade);
  const numeric = leading ? Number(leading[1]) : NaN;
  return Number.isFinite(numeric) ? Math.min(Math.max(numeric, 2), 8) : 4;
};

/**
 * BAND FLOOR: grade 2, the bottom of this primitive's range, where the tutor
 * reads the sentence to the child. The answer is a category NAME that is not in
 * the sentence (`namesAGrammarTerm` guarantees it), so reading it aloud gives
 * nothing away — genre-explorer's rule, and the same reason applies here.
 */
export const isBandFloor = (gradeLevel: string | undefined): boolean =>
  gradeNumberOf(gradeLevel) <= 2;

// ── The payload this pack reads ─────────────────────────────────────────────

export interface SentenceWordLike {
  id?: string;
  text?: string;
  partOfSpeech?: string;
  grammaticalRole?: string;
}

export interface SentenceChallengeLike {
  id?: string;
  type?: string;
  sentence?: string;
  words?: SentenceWordLike[];
  sentenceType?: string;
  /**
   * Index of the LAST word of the complete subject. The explicit key that
   * replaces the click era's `role.includes('subject')` derivation — see header
   * defect 1. Absent (or out of range) means the sentence has no contiguous
   * leading subject to ask about, and its side items drop.
   */
  subjectEndIndex?: number;
}

export interface SentenceAnalyzerPayloadLike {
  gradeLevel?: string;
  challenges?: SentenceChallengeLike[];
  supportTier?: SentenceTier;
}

/** One sentence as the stage and the cues see it — canonical labels throughout. */
export interface ResolvedSentence {
  index: number;
  id: string;
  type: string;
  sentence: string;
  spokenText: string;
  words: Array<{ id: string; text: string; pos: PosLabel | null; role: RoleLabel | null }>;
  sentenceType: SentenceTypeLabel | null;
  subjectEndIndex: number | null;
}

export interface SentenceBuildResult {
  items: SentenceAnalyzerItem[];
  dropped: number;
  truncated: number;
  sentences: ResolvedSentence[];
  wall: string[];
  wallNotes: string[];
  wallKind: WallKind;
  readsAloud: boolean;
}

const EMPTY_BUILD: SentenceBuildResult = {
  items: [], dropped: 0, truncated: 0, sentences: [],
  wall: [], wallNotes: [], wallKind: 'none', readsAloud: false,
};

const ACTION_FOR_TYPE: Record<string, SentenceAction[]> = {
  identify_pos: ['name-pos'],
  identify_role: ['name-role'],
  label_all: ['name-pos'],
  parse_structure: ['name-side', 'name-type'],
};

/**
 * Pick up to `limit` candidates, preferring labels this session has used LEAST —
 * a spread SELECTION, not a slice.
 *
 * Two defects at once. Within a sentence it stops "Noun" answering both targets;
 * across the session it stops one label answering everything, which is
 * genre-explorer's generalised defect-class-2 rule (one ask per DISTINCT answer)
 * applied where the answer space is small enough that strict distinctness would
 * starve the session instead of protecting it.
 */
const pickSpread = <T>(
  candidates: T[],
  labelOf: (c: T) => string,
  used: Map<string, number>,
  limit: number,
): T[] => {
  const kept: T[] = [];
  const local = new Map(used);
  const pool = [...candidates];
  while (kept.length < limit && pool.length > 0) {
    let bestAt = 0;
    for (let i = 1; i < pool.length; i++) {
      if ((local.get(labelOf(pool[i])) ?? 0) < (local.get(labelOf(pool[bestAt])) ?? 0)) bestAt = i;
    }
    const [chosen] = pool.splice(bestAt, 1);
    local.set(labelOf(chosen), (local.get(labelOf(chosen)) ?? 0) + 1);
    kept.push(chosen);
  }
  return kept;
};

/**
 * Every judged item this payload can ask, in the order a DI sitting runs them.
 *
 * Nothing here backfills. A placeholder in a judged loop becomes a spoken ask the
 * tutor has to stand behind, so an item that cannot be asked cleanly is DROPPED
 * and its step simply has one fewer round — or none.
 */
export const itemsFromPayload = (
  payload: SentenceAnalyzerPayloadLike,
): SentenceBuildResult => {
  const tier: SentenceTier = payload.supportTier ?? 'medium';
  const grade = gradeNumberOf(payload.gradeLevel);
  const bandFloor = isBandFloor(payload.gradeLevel);
  const namesWall = bandFloor || tier === 'easy';

  let dropped = 0;
  let truncated = 0;

  const posWall = posWallFor(grade);
  const roleWall = roleWallFor(grade);

  // ── The sentences ─────────────────────────────────────────────────────────
  const raw = payload.challenges ?? [];
  const cleaned: ResolvedSentence[] = [];
  raw.forEach((challenge) => {
    const sentence = sanitize(challenge?.sentence);
    const id = sanitize(challenge?.id);
    const type = sanitize(challenge?.type);
    if (!sentence || !id || !ACTION_FOR_TYPE[type]) { dropped += 1; return; }
    // ⚠️ A sentence containing grammar vocabulary says an answer out loud.
    if (namesAGrammarTerm(sentence)) { dropped += 1; return; }
    if (opensWithSentinel(sentence)) { dropped += 1; return; }
    const spoken = isReadableAloud(sentence) ? speechSafe(sentence) : '';
    // At the band floor a sentence nobody will read to the child is not a harder
    // task, it is an unreachable one.
    if (bandFloor && !spoken) { dropped += 1; return; }

    const words = (challenge.words ?? []).map((word, i) => ({
      id: sanitize(word?.id) || `w${i}`,
      text: sanitize(word?.text),
      pos: canonicalPos(word?.partOfSpeech),
      role: canonicalRole(word?.grammaticalRole),
    })).filter((word) => !!word.text);
    if (words.length === 0) { dropped += 1; return; }

    const end = challenge.subjectEndIndex;
    // Both halves must be non-empty for the boundary to be a real question, and
    // an out-of-range index is a guess we refuse to make on the tutor's behalf.
    const validEnd =
      typeof end === 'number' && Number.isInteger(end)
      && end >= 0 && end < words.length - 1 && words.length >= MIN_WORDS_FOR_SIDE;

    cleaned.push({
      index: cleaned.length,
      id,
      type,
      sentence,
      spokenText: spoken,
      words,
      sentenceType: canonicalSentenceType(challenge.sentenceType),
      subjectEndIndex: validEnd ? (end as number) : null,
    });
  });

  if (cleaned.length === 0) return { ...EMPTY_BUILD, dropped, readsAloud: bandFloor };

  truncated += Math.max(0, cleaned.length - MAX_SENTENCES);
  const sentences = cleaned.slice(0, MAX_SENTENCES).map((s, index) => ({ ...s, index }));

  // The session's mode is whatever its challenges are; a mixed set takes the
  // first, because ONE wall is printed for the whole sitting.
  const primaryType = sentences[0].type;
  const actions = ACTION_FOR_TYPE[primaryType] ?? ['name-pos'];
  // parse_structure leads with `name-side`, which prints no wall; its printed
  // wall belongs to the sentence-type step that follows.
  const leadKind = wallKindFor(actions[0]);
  const wallKind = leadKind === 'none' ? wallKindFor(actions[actions.length - 1]) : leadKind;
  const wallLabels: string[] =
    wallKind === 'pos' ? posWall
      : wallKind === 'role' ? roleWall
        : wallKind === 'type' ? [...ALL_SENTENCE_TYPES] : [];
  const wallNotes: string[] =
    wallKind === 'pos' ? posWall.map((l) => POS_GLOSS[l as PosLabel])
      : wallKind === 'role' ? roleWall.map((l) => ROLE_GLOSS[l as RoleLabel])
        : wallKind === 'type' ? ALL_SENTENCE_TYPES.map((l) => SENTENCE_TYPE_GLOSS[l]) : [];

  // A wall of fewer than two labels is not a decision. Grade 2 has no role
  // vocabulary at all, which is exactly why `identify_role` is a grades-3-6 mode —
  // and DEGRADING A MODE SILENTLY IS WORSE THAN DELIVERING NOTHING (the
  // compare_genres probe finding, 2026-08-17).
  if (wallKind !== 'none' && wallLabels.length < 2) {
    // eslint-disable-next-line no-console
    console.warn(
      `[sentence-analyzer] grade ${grade} has no ${wallKind} vocabulary in scope — `
      + 'the mode cannot be delivered and the activity builds nothing.',
    );
    return { ...EMPTY_BUILD, dropped: dropped + sentences.length, readsAloud: bandFloor };
  }

  // ── The items ─────────────────────────────────────────────────────────────
  const items: SentenceAnalyzerItem[] = [];
  const usedLabels = new Map<string, number>();
  const seenTypes = new Set<SentenceTypeLabel>();
  const read = new Set<number>();
  const introduced = new Set<SentenceAction>();

  const readAloudFor = (sentence: ResolvedSentence): string => {
    if (!bandFloor || read.has(sentence.index) || !sentence.spokenText) return '';
    read.add(sentence.index);
    return `Listen. ${sentence.spokenText} `;
  };

  type PartialItem = Omit<SentenceAnalyzerItem,
    'answerKind' | 'responseClass' | 'wall' | 'wallLabels' | 'namesWall'
    | 'introducesAction' | 'tier'>;

  const push = (partial: PartialItem) => {
    if (items.length >= MAX_ITEMS) { truncated += 1; return; }
    const wall = wallKindFor(partial.action);
    const first = !introduced.has(partial.action);
    introduced.add(partial.action);
    items.push({
      ...partial,
      tier,
      answerKind: answerKindFor(partial.action),
      responseClass: responseClassFor(partial.action),
      wall,
      wallLabels:
        wall === 'pos' ? posWall
          : wall === 'role' ? roleWall
            : wall === 'type' ? [...ALL_SENTENCE_TYPES] : [],
      namesWall: namesWall && wall !== 'none',
      introducesAction: first,
    });
    usedLabels.set(partial.answer, (usedLabels.get(partial.answer) ?? 0) + 1);
  };

  for (const sentence of sentences) {
    if (sentence.type === 'identify_pos' || sentence.type === 'label_all') {
      // KEEP-OR-DROP: a word whose label is off the grade wall has no fair ask.
      const candidates = sentence.words
        .map((word, index) => ({ word, index }))
        .filter(({ word }) => !!word.pos && posWall.includes(word.pos));
      dropped += sentence.words.length - candidates.length;

      const limit = sentence.type === 'label_all' ? MAX_LABEL_ALL_WORDS : MAX_TARGETS_PER_SENTENCE;
      const chosen = pickSpread(candidates, (c) => c.word.pos as string, usedLabels, limit)
        .sort((a, b) => a.index - b.index);
      truncated += Math.max(0, candidates.length - chosen.length);

      chosen.forEach(({ word, index }) => push({
        id: `${sentence.id}-pos-${index}`,
        action: 'name-pos',
        answer: word.pos as string,
        sentence: sentence.sentence,
        spokenSentence: sentence.spokenText,
        sentenceIndex: sentence.index,
        targetWord: word.text,
        targetIndex: index,
        readAloud: readAloudFor(sentence),
      }));
      continue;
    }

    if (sentence.type === 'identify_role') {
      const candidates = sentence.words
        .map((word, index) => ({ word, index }))
        // ⚠️ header defect 2: a word keyed to a PART OF SPEECH as its role has no
        // clean answer to "what job does it do?", so it is not a role target.
        .filter(({ word }) => !!word.role && roleWall.includes(word.role));
      dropped += sentence.words.length - candidates.length;

      const chosen = pickSpread(
        candidates, (c) => c.word.role as string, usedLabels, MAX_TARGETS_PER_SENTENCE,
      ).sort((a, b) => a.index - b.index);
      truncated += Math.max(0, candidates.length - chosen.length);

      chosen.forEach(({ word, index }) => push({
        id: `${sentence.id}-role-${index}`,
        action: 'name-role',
        answer: word.role as string,
        sentence: sentence.sentence,
        spokenSentence: sentence.spokenText,
        sentenceIndex: sentence.index,
        targetWord: word.text,
        targetIndex: index,
        readAloud: readAloudFor(sentence),
      }));
      continue;
    }

    // parse_structure — the boundary, then the kind.
    if (sentence.subjectEndIndex !== null) {
      const end = sentence.subjectEndIndex;
      const rows = sentence.words.map((word, index) => ({
        word, index, side: index <= end ? 'Subject' : 'Predicate',
      }));
      // Alternate the sides so "Predicate" cannot answer them all — the longer
      // half would otherwise win a blind pick every time.
      const subjects = rows.filter((r) => r.side === 'Subject');
      const predicates = rows.filter((r) => r.side === 'Predicate');
      const interleaved: typeof rows = [];
      for (let i = 0; interleaved.length < MAX_SIDE_ITEMS_PER_SENTENCE; i++) {
        if (i >= subjects.length && i >= predicates.length) break;
        if (i < subjects.length && interleaved.length < MAX_SIDE_ITEMS_PER_SENTENCE) {
          interleaved.push(subjects[i]);
        }
        if (i < predicates.length && interleaved.length < MAX_SIDE_ITEMS_PER_SENTENCE) {
          interleaved.push(predicates[i]);
        }
      }
      truncated += Math.max(0, rows.length - interleaved.length);
      interleaved
        .sort((a, b) => a.index - b.index)
        .forEach(({ word, index, side }) => push({
          id: `${sentence.id}-side-${index}`,
          action: 'name-side',
          answer: side,
          sentence: sentence.sentence,
          spokenSentence: sentence.spokenText,
          sentenceIndex: sentence.index,
          targetWord: word.text,
          targetIndex: index,
          readAloud: readAloudFor(sentence),
        }));
    } else {
      dropped += 1;
    }

    /**
     * ⭐ DEFECT CLASS 2, in genre-explorer's generalised form: ONE ask per
     * DISTINCT sentence type. Three declarative sentences give ONE type ask, not
     * three — after the tutor affirms "Declarative" once, saying it again wins the
     * rest with no reading at all.
     */
    if (sentence.sentenceType && !seenTypes.has(sentence.sentenceType)) {
      seenTypes.add(sentence.sentenceType);
      push({
        id: `${sentence.id}-type`,
        action: 'name-type',
        answer: sentence.sentenceType,
        sentence: sentence.sentence,
        spokenSentence: sentence.spokenText,
        sentenceIndex: sentence.index,
        targetWord: '',
        targetIndex: -1,
        readAloud: readAloudFor(sentence),
      });
    } else if (sentence.sentenceType) {
      dropped += 1;
    }
  }

  // ── The channel-level leak close ──────────────────────────────────────────
  const answerFree = items.filter((item) => {
    // `name-side`'s answer is one of the two words the ask must contain to be a
    // question. The oracle is inapplicable, not softened — see the header.
    if (item.action === 'name-side') return true;
    if (askIsAnswerFree(askFor(item), item.answer, leakExemptSpanFor(item))) return true;
    // eslint-disable-next-line no-console
    console.warn(
      `[sentence-analyzer] dropped "${item.id}" — its ask contains its own answer `
      + `("${item.answer}"). An ask that says the answer is broken, not easier.`,
    );
    return false;
  });
  dropped += items.length - answerFree.length;

  if (truncated > 0) {
    // eslint-disable-next-line no-console
    console.info(
      `[sentence-analyzer] session held back ${truncated} askable item(s) — caps are `
      + `${MAX_SENTENCES} sentences, ${MAX_ITEMS} items, ${MAX_LABEL_ALL_WORDS} words per `
      + 'labelled sentence.',
    );
  }

  return {
    items: answerFree,
    dropped,
    truncated,
    sentences,
    wall: wallLabels,
    wallNotes,
    wallKind,
    readsAloud: bandFloor,
  };
};

// ── Small speakable helpers ─────────────────────────────────────────────────

/** "Your choices are Noun, Verb, Adjective, or Determiner. " — the spoken wall,
 *  and the ONE span the leak oracle subtracts, on the item that introduces its
 *  action and nowhere else. */
export const wallPhrase = (item: SentenceAnalyzerItem): string => {
  const list = item.wallLabels;
  if (list.length === 0) return '';
  if (list.length === 1) return `Your choice is ${list[0]}. `;
  return `Your choices are ${list.slice(0, -1).join(', ')}, or ${list[list.length - 1]}. `;
};

// ── How-to-play — inside the quoted line (SWAP-1), spoken on introduction ────

export const howToPlayFor = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
      return 'I name one word, and you tell me what part of speech it is. ';
    case 'name-role':
      return 'I name one word, and you tell me what job it does in the sentence. ';
    case 'name-side':
      return 'I name one word, and you tell me whether it is in the subject or in the predicate. ';
    case 'name-type':
    default:
      return 'Now you tell me what kind of sentence it is. ';
  }
};

// ── The DISTAR lead-in, composed from the SUPPORT TIER ──────────────────────
// easy = model + guide, medium = model, hard = nothing. Spoken ONLY when the
// action is introduced, never per item: `label_all` runs four `name-pos` asks in
// a row, and a model line that does not change with the item is established once,
// not recited (ruled twice on 2026-08-13).
//
// NOTE what is absent at every rung: a worked EXEMPLAR. Modelling "'clever' is an
// Adjective" would say a label that is very often the NEXT item's answer, since
// every item of a session answers from ONE wall. These model the STRATEGY.
//
// The wall reading rides here too (`namesWall`), which is why `hard` is not empty
// at the band floor: a grade-2 child gets the vocabulary read to them at every
// tier, because a tier withdraws SCAFFOLDING and never withdraws access.

const modelLine = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
      return 'Ask yourself what that word is DOING in this sentence, not what it could be somewhere else.';
    case 'name-role':
      return 'Ask yourself who or what the sentence is about, and what happens to whom.';
    case 'name-side':
      return 'The subject is who or what the sentence is about; everything else is the predicate.';
    case 'name-type':
    default:
      return 'Listen to how the sentence ends, and to what it is trying to do.';
  }
};

const guideLine = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
    case 'name-role':
      return 'Read the whole sentence first, then say your answer.';
    case 'name-side':
      return 'Take your time — find the subject first, then decide.';
    case 'name-type':
    default:
      return 'Read it again in your head if you need to, then say the one that fits.';
  }
};

const leadInFor = (item: SentenceAnalyzerItem): string => {
  const wall = item.namesWall ? wallPhrase(item) : '';
  switch (item.tier) {
    case 'hard':
      return wall;
    case 'easy':
      return `${modelLine(item)} ${guideLine(item)} ${wall}`;
    case 'medium':
    default:
      return `${modelLine(item)} ${wall}`;
  }
};

// ── The asks — short, the problem STATED aloud, one defensible answer ───────

/**
 * The target word as the tutor SAYS it — without the punctuation the printed
 * sentence keeps.
 *
 * ⚠️ FOUND BY THE JUDGED DRIVE, 2026-08-17, and invisible to every string gate in
 * the family. The generator attaches sentence punctuation to the word it belongs
 * to ("melts.") so the printed sentence is typographically right, and the ask
 * interpolated that verbatim: *"What part of speech is the word melts.?"* — a
 * full stop and a question mark adjacent, mid-question, which a TTS voice reads
 * as a sentence ending followed by a fragment. The leak scan passed it, the
 * sentinel scan passed it, and the repeat-ask gate passed it, because none of
 * them is about how a line SOUNDS. Reading the drive's transcript is what caught
 * it.
 *
 * Only the SPOKEN form is stripped. The stage still prints "melts." on the word
 * it highlights, because that is what the sentence says.
 */
export const speakableWord = (word: string): string =>
  sanitize(word).replace(/[.,!?;:]+$/, '');

export const questionFor = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
      return `What part of speech is the word ${speakableWord(item.targetWord)}?`;
    case 'name-role':
      return `What job does the word ${speakableWord(item.targetWord)} do in this sentence?`;
    case 'name-side':
      return `Is the word ${speakableWord(item.targetWord)} in the subject or in the predicate?`;
    case 'name-type':
    default:
      return 'What kind of sentence is this?';
  }
};

export const askFor = (item: SentenceAnalyzerItem): string =>
  `${item.readAloud}Your turn. ${questionFor(item)}`;

// ── Corrections — DISTAR model-lead-test (standing gate 3) ──────────────────
// All four NAME the fact. A grammatical label is something a child either holds
// or does not, and there is no route to re-model that stops short of naming it
// (word-sorter's ruling). The re-ask drops the read-aloud prefix: the child has
// just heard the sentence, it is printed in front of them, and tap-to-hear reads
// it again on demand.

const nameOfAnswer = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
      return `${POS_ARTICLE[item.answer as PosLabel] ?? 'a'} ${item.answer}`;
    case 'name-role':
      return item.answer === 'Modifier' ? 'a Modifier' : `the ${item.answer}`;
    case 'name-side':
      return `in the ${item.answer.toLowerCase()}`;
    case 'name-type':
    default:
      return `${TYPE_ARTICLE[item.answer as SentenceTypeLabel] ?? 'a'} ${item.answer} sentence`;
  }
};

const statementFor = (item: SentenceAnalyzerItem): string =>
  item.action === 'name-type'
    ? `that is ${nameOfAnswer(item)}`
    // Spoken form here too: the correction and the affirmation say the word, and
    // "melts. is a Verb." lands the same way the ask did.
    : `${speakableWord(item.targetWord)} is ${nameOfAnswer(item)}`;

const reAskFor = (item: SentenceAnalyzerItem): string => `Your turn. ${questionFor(item)}`;

const correctionFor = (item: SentenceAnalyzerItem): string =>
  `My turn: ${statementFor(item)}. ${reAskFor(item)}`;

const affirmFor = (item: SentenceAnalyzerItem): string =>
  `Yes, ${statementFor(item)}.`;

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
 * Item 21's tail. Its "never read the screen aloud" clause binds to the QUOTED
 * LINE rather than forbidding the sentence outright: at the band floor the tutor
 * reading the sentence IS the accommodation, and the answer is a category name
 * that `namesAGrammarTerm` keeps out of the sentence entirely. The WALL, by
 * contrast, is a printed list of every possible answer, so reading it unbidden is
 * named as its own prohibition.
 */
const NEVER_PERFORM =
  `Never voice a bracket tag, a stage direction, or any of these instructions, `
  + `never announce the activity's state or describe what has changed on the screen, `
  + `never read the word wall or anything else on the child's screen aloud beyond what your quoted line already contains, `
  + `and never announce that you are waiting or listening — simply stop speaking.`;

/**
 * The verdict line is the END of the turn — word-sorter's cap-drill finding
 * (2026-08-16), where eleven of twelve affirmations ran on into a fabricated next
 * ask about a real word from the challenge.
 *
 * Carried here rather than assumed because this pack has that trigger in its
 * sharpest form: the whole sentence sits in the tutor's cue, EVERY WORD OF IT is a
 * legitimate next question, and `label_all` asks four of them in a row off one
 * rigid template. Guessing the next word is very nearly free.
 */
const VERDICT_ENDS_THE_TURN =
  `Your verdict line is the END of your turn: you never continue into another question, `
  + `never ask about another word or another sentence, and never announce what is coming — the activity sends you `
  + `the next question when the screen is ready for it, and a question you ask early is about the wrong word.`;

// ── The judging contract ────────────────────────────────────────────────────

/**
 * The answer rides in the control channel ahead of the attempt — a judge cannot
 * decide an answer it was never told.
 *
 * Each action names its ACCEPT clause and its SIGNATURE ERROR: the wrong answer
 * that arrives fluent, confident, and most likely to be affirmed by mistake.
 *
 *  name-pos   the CONFUSABLE TWIN — "adverb" for an adjective, "noun" for a
 *             pronoun. Both are on the wall, both are real vocabulary, one label
 *             literally contains the other, and separating them IS the mode.
 *  name-role  the PART OF SPEECH said instead of the JOB. "Noun" answers "what
 *             job does 'fox' do?" fluently and is usually TRUE of the word — the
 *             child is not wrong about the word, they are answering a different
 *             question, which is the miss a relevance-grading judge waves through.
 *  name-side  the OTHER SIDE on a determiner or a subject-side modifier — the
 *             exact words the click era's own key got wrong, which is why they
 *             are the ones the judge must now get right.
 *  name-type  DECLARATIVE, the default every sentence looks like if you do not
 *             read its ending.
 */
const judgingContract = (item: SentenceAnalyzerItem): string => {
  const preamble =
    `The quoted line is the ONLY thing you say on this turn; you then stay silent `
    + `while the learner reads and thinks, and their think time is unbounded. `
    + `Never say the answer during their turn. `
    + `The sentence they are looking at is: "${item.sentence}". `;

  if (item.action === 'name-side') {
    const side = item.answer.toLowerCase();
    const other = item.answer === 'Subject' ? 'predicate' : 'subject';
    return (
      preamble
      + `The correct answer is "${side}" — the word ${speakableWord(item.targetWord)} is in the ${side} of that sentence. `
      + `Count any natural form of it: the bare word, "the ${side}", or "it is in the ${side}". `
      + `A shy or mumbled try still counts. Saying "${other}" is wrong. `
      + `Small words count exactly like big ones here: a word like "the", and a describing word sitting in `
      + `front of the naming word, are part of the COMPLETE subject. The answer above already accounts for `
      + `that — judge against it, and not against your own re-reading of the sentence. `
      + TWO_BRANCH_LAW
      + `If the answer is right, say exactly: "${affirmFor(item)}" `
      + `If it is wrong, say exactly: "${correctionFor(item)}"`
    );
  }

  const alternates: readonly string[] =
    item.action === 'name-pos'
      ? POS_ALTERNATES[item.answer as PosLabel] ?? []
      : item.action === 'name-role'
        ? ROLE_ALTERNATES[item.answer as RoleLabel] ?? []
        : [];
  const confusable = (CONFUSABLE_WITH[item.answer] ?? [])
    .filter((label) => item.wallLabels.includes(label));

  const asked =
    item.action === 'name-pos'
      ? `what part of speech the word ${speakableWord(item.targetWord)} is`
      : item.action === 'name-role'
        ? `what job the word ${speakableWord(item.targetWord)} does in the sentence`
        : 'what kind of sentence it is';

  return (
    preamble
    + `The learner answers OUT LOUD by telling you ${asked}. `
    + `The correct answer is "${item.answer}". `
    + `They have named it if they say that label`
    + (alternates.length
      ? `, OR the everyday classroom name for it: ${alternates.map((a) => `"${a}"`).join(', ')}`
      : '')
    + `. A child says the familiar form far more often than the catalogue word, and that is a full `
    + `answer, not a lesser one. `
    + (confusable.length
      ? `"${confusable.join('" and "')}" are DIFFERENT answers and are wrong here, even though they sound `
        + `close to the right one and even though one label may contain the other inside it. Part of a label `
        + `is not the label: telling these apart is exactly what is being measured. `
      : '')
    + (item.action === 'name-role'
      ? `Naming a PART OF SPEECH instead of a job — "noun", "verb", "adjective" — is wrong however `
        + `confident it sounds, and however true it is of that word; it answers a different question. `
      : '')
    + `Any other grammar label is wrong. `
    + TWO_BRANCH_LAW
    + `If the answer is right, say exactly: "${affirmFor(item)}" `
    + `If it is wrong, say exactly: "${correctionFor(item)}" `
    + `If you truly cannot tell WHICH label they meant — they trailed off, or what they said fits two of `
    + `them — do not guess and do not judge: say exactly "Tell me that one again." and wait for them.`
  );
};

// ── Cues ────────────────────────────────────────────────────────────────────

export interface SentenceCueOptions {
  opening?: boolean;
  howToPlay?: boolean;
}

/** One item's ask. ONE job: speak this (SWAP-1 — the how-to-play lives inside the
 *  quoted line; the catalog only forbids adding to it). */
export const itemCue = (
  item: SentenceAnalyzerItem,
  opts: SentenceCueOptions = {},
): string => {
  const greeting = opts.opening ? 'Hi! Let us look at some sentences together. ' : '';
  // Introducing = the run's opening, or the FIRST time this action comes up. The
  // runner offers `howToPlay` on every action change; `introducesAction` is what
  // stops parse_structure reciting the protocol on every sentence.
  const introducing = !!(opts.opening || (opts.howToPlay && item.introducesAction));
  const how = introducing ? howToPlayFor(item) : '';
  const lead = introducing ? leadInFor(item) : '';
  const spoken = `${greeting}${how}${lead}${askFor(item)}`;
  return (
    `[SAN_ITEM] Say exactly: "${spoken}" ${judgingContract(item)} `
    + `${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

/**
 * Correction cap reached: acknowledge warmly and carry the lesson forward.
 *
 * NO CLOSE LINE (word-sorter's deduction, carried). Every correction here NAMES
 * the label and the runner runs it TWICE before capping, so the child has already
 * heard it twice. It is also the only place a label would reach the move-on
 * utterance outside the exempt wall clause — and every item of a session answers
 * from ONE wall, so a close line names a label that is very often the NEXT item's
 * answer.
 */
export const moveOnCue = (
  item: SentenceAnalyzerItem,
  next: SentenceAnalyzerItem | null,
  opts: SentenceCueOptions = {},
): string => {
  if (!next) {
    return (
      `[SAN_MOVE] Say exactly: "Good try! We will look at that one again another day." `
      + `Then stop.`
    );
  }
  const introducing = !!(opts.howToPlay && next.introducesAction);
  const how = introducing ? howToPlayFor(next) : '';
  const lead = introducing ? leadInFor(next) : '';
  return (
    `[SAN_MOVE] Say exactly: "Good try! Here comes the next one. ${how}${lead}${askFor(next)}" `
    + `${judgingContract(next)} ${NEVER_PERFORM} ${VERDICT_ENDS_THE_TURN}`
  );
};

export const completeCue = (): string =>
  `[SAN_COMPLETE] Say exactly: "Great grammar work today! You worked out what every word was doing, `
  + `and you told me each answer out loud. See you next time!" Then stop — the activity is over.`;

/**
 * Tap-to-hear re-speaks the QUESTION, never the answer, and is never withdrawn by
 * band or tier. It carries the sentence WITH it at the band floor: there the
 * sentence is question-side audio, and a grade-2 child who missed it needs the
 * sentence, not a louder question.
 */
export const pronounceCue = (item: SentenceAnalyzerItem): string => {
  const spoken = item.spokenSentence ? `${item.spokenSentence} ` : '';
  const line = `${spoken}${questionFor(item)}`;
  return (
    `[SAN_HEAR] The learner tapped to hear the question again. Say ONLY this, warmly, then wait: "${line}" `
    + `Do not treat anything you just heard as an answer, add nothing, and never say the answer. `
    + NEVER_PERFORM
  );
};

/**
 * Runtime state pushed through the context channel — STIMULUS-SIDE ONLY.
 *
 * ⚠️ `challengeType` IS THE ACTION, NOT THE EVAL MODE. `parse_structure` names its
 * own two-word answer set out loud, so pushing the mode would park half that
 * mode's answers in the tutor's context for the whole session, where they can be
 * volunteered on any turn. The action is what the tutor actually needs ("which
 * step am I on"); the answer arrives per item, inside the cue, and leaves with it.
 */
export const stimulusFor = (item: SentenceAnalyzerItem): string => {
  switch (item.action) {
    case 'name-pos':
      return 'one printed sentence with a single word highlighted, and a wall of parts of speech beside it';
    case 'name-role':
      return 'one printed sentence with a single word highlighted, and a wall of sentence jobs beside it';
    case 'name-side':
      return 'one printed sentence with a single word highlighted';
    case 'name-type':
    default:
      return 'one printed sentence, with the four kinds of sentence printed beside it';
  }
};

// ── THE WIRE — what the tutor is told, shared with the DI drive harness ──────

export const sentenceAnalyzerPackBase = (
  items: SentenceAnalyzerItem[],
): JudgedCueSurface<SentenceAnalyzerItem> => ({
  primitiveType: 'sentence-analyzer',
  activityLine: 'live direct instruction sentence grammar analysis',
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
 * The span of the ask inside which the answer may legitimately appear: the spoken
 * wall, and only on the item that introduces its action. Everywhere else the
 * oracle is FLAT — the label is absent from the ask, from the sentence
 * (`namesAGrammarTerm`), from the lead-in and from the how-to-play.
 */
export const leakExemptSpanFor = (item: SentenceAnalyzerItem): string | undefined =>
  item.namesWall && item.introducesAction ? wallPhrase(item) : undefined;

/**
 * The answers a headless student says on a judged drive. It lives beside the
 * contract it mirrors because `judgingContract` CLAIMS the judge refuses each of
 * these; this is that claim made testable. Change one, change both.
 *
 * ⚠️ `name-side` ships an empty `leakTokens` — its answer is one of the two words
 * the ask must contain to be a question ("in the subject or in the predicate?").
 * A leak oracle over it would fire on every turn and mean nothing; the
 * DISCRIMINATION oracle is what carries that action, and on this pack that oracle
 * is doing unusually load-bearing work: it is the drive that proves the
 * subject/predicate key fix landed.
 */
export const sentenceAnalyzerHarnessAnswers = (item: SentenceAnalyzerItem) => {
  if (item.action === 'name-side') {
    const other = item.answer === 'Subject' ? 'predicate' : 'subject';
    return {
      correct: item.answer.toLowerCase(),
      plainWrong: other,
      signatureWrong: {
        text: other,
        why:
          'the OTHER side — and on a determiner or a subject-side modifier this is the exact answer the '
          + "click era's own key produced (role.includes('subject') put \"The\" and \"clever\" in the "
          + 'predicate). The judge must refuse the wrong side even where the primitive itself used to '
          + 'assert it, which makes this the drive that proves the key fix landed',
      },
      leakTokens: [] as string[],
    };
  }

  const confusable = (CONFUSABLE_WITH[item.answer] ?? [])
    .filter((label) => item.wallLabels.includes(label));
  const others = item.wallLabels.filter((label) => label !== item.answer);

  if (item.action === 'name-role') {
    return {
      correct: item.answer,
      plainWrong: others[others.length - 1] ?? 'Modifier',
      signatureWrong: {
        text: 'noun',
        why:
          'the PART OF SPEECH said where the JOB was asked for. It is a real grammar word, said with total '
          + 'confidence, and it is very often TRUE of the word in question — the child answering "noun" for '
          + 'the subject of a sentence is not wrong about the word, they are answering a different question, '
          + 'and a judge grading on "did I hear correct grammar" affirms it',
      },
      leakTokens: [item.answer],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  if (item.action === 'name-type') {
    return {
      correct: item.answer,
      plainWrong: others[others.length - 1] ?? 'Imperative',
      signatureWrong: {
        text: item.answer === 'Declarative' ? 'Exclamatory' : 'Declarative',
        why:
          'the DEFAULT. Every sentence looks declarative if you do not read its ending, so this is what a '
          + 'child says when they have not looked — and on the many sentences that really are declarative it '
          + 'is right for the wrong reason, which is why the drive says it on the ones that are not',
      },
      leakTokens: [item.answer],
      leakExemptSpan: leakExemptSpanFor(item),
    };
  }

  return {
    correct: item.answer,
    plainWrong: others[others.length - 1] ?? 'Verb',
    signatureWrong: {
      text: confusable[0] ?? others[0] ?? 'Verb',
      why:
        'the CONFUSABLE TWIN — adverb for an adjective, noun for a pronoun. Both are on the printed wall, '
        + 'both are real vocabulary the child has been taught, one label literally contains the other, and '
        + "separating them is the whole mode. The click era's own commonStruggles list opens with exactly "
        + 'these two pairs',
    },
    leakTokens: [item.answer],
    leakExemptSpan: leakExemptSpanFor(item),
  };
};
