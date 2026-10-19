/**
 * sentence-analyzer's domain: the canonical grammar vocabulary, the grade wall, the build gates that turn printed
 * sentences into spoken items, the ask, the key, the known misses and the scene. Pure; the boss
 * (`sentenceAnalyzer.boss.ts`), the levers and the component read it, and the generator imports its gates from here
 * so both sides of the wire agree on what is sayable.
 *
 * Every item is one grammar label SAID out loud, four ways over a printed sentence with the asked word highlighted:
 *
 *   name-pos   the part of speech of one word           "What part of speech is the word clever?"  -> "adjective"
 *   name-role  the job of one word in the sentence      "What job does the word fox do in this sentence?" -> "subject"
 *   name-side  which side of the sentence a word is in  "Is the word The in the subject or in the predicate?" -> "subject"
 *   name-type  the kind of sentence                     "What kind of sentence is this?" -> "declarative"
 *
 * What the build owes, and why:
 *  - THE WALL IS SCOPED BY GRADE, NEVER BY THE SESSION. A printed wall of the grammar vocabulary in scope, glossed and
 *    identical on every item, replaced the click era's per-item menus. The click era's `label_all` chip bank printed
 *    exactly the labels the sentence used, so it could be counted against the words; a grade wall carries labels the
 *    sentence does not use and narrows nothing.
 *  - THE SUBJECT/PREDICATE KEY IS AN EXPLICIT FIELD (`subjectEndIndex`, the last word of the complete subject). The
 *    click era derived the side as `role.includes('subject')`, which put every determiner and every subject-side
 *    modifier in the predicate. A sentence that cannot state the boundary drops its side asks.
 *  - `Conjunction` and `Determiner` are parts of speech, never roles; a word keyed to one is not a role target.
 *  - "Noun" is inside "Pronoun", and "Object" is shared by three roles. Both members of each pair are curriculum
 *    vocabulary the lesson exists to separate, so the key says a close or contained label is wrong (`CONFUSABLE_WITH`).
 *  - A sentence containing grammar vocabulary drops (`namesAGrammarTerm`): at the band floor the ask reads the sentence
 *    aloud, and a sentence with "noun" in it says an answer.
 */

import {
  opensWithSentinel,
  type JudgedScriptItem,
  type ResponseClassId,
} from '../../../hooks/judgedScriptContract';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { askLeaks, type SpokenKey } from '../../../components/live-activity/spokenKey';
import type { SceneOf } from '../../../components/live-activity/bossLevers';

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
 * What the child is DOING. `identify_pos` and `label_all` share `name-pos` on
 * purpose: the action is identical (name this word's part of speech) and only the
 * SHAPE of the demand differs (one spotlight word per sentence versus a walk
 * across the sentence), which is what the eval modes and their betas price.
 * `parse_structure` runs two actions: the side of a few words, then the kind.
 */
export type SentenceAction = 'name-pos' | 'name-role' | 'name-side' | 'name-type';

/** The eval modes, one per challenge type. */
export type SentenceMode = 'identify_pos' | 'identify_role' | 'label_all' | 'parse_structure';

export type SentenceTier = 'easy' | 'medium' | 'hard';

/** The kind of wall this action answers from — decides what the stage prints. */
export type WallKind = 'pos' | 'role' | 'type' | 'none';

export interface SentenceAnalyzerItem extends JudgedScriptItem {
  action: SentenceAction;
  tier: SentenceTier;
  /** The eval mode of the sentence this item comes from (its challenge type). */
  mode: SentenceMode;
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
  /** A practice item from a simplify lever: the words of its practice sentence, printed in place of the session's. */
  practiceWords?: string[];
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

/** One sentence as the stage and the asks see it — canonical labels throughout. */
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

const ACTION_FOR_TYPE: Record<SentenceMode, SentenceAction[]> = {
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

const NUMBER_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'twenty', 'hundred']);
const bare = (text: string) => text.toLowerCase().replace(/[^a-z']/g, '');

/**
 * Labels the generator keys wrong often enough that a child saying the right label is refused (lever plan
 * 2026-10-03 step 0, sentence-analyzer D1-D3). The word stays in the sentence, unasked; its label is cleared:
 * - a Preposition with no Noun or Pronoun after it ("flows down quickly": "down" is an adverb there);
 * - an Object of Preposition with no Preposition before it ("shine every night");
 * - a number word's part of speech ("Three" is taught as an adjective in some programs and a determiner in others).
 */
export const unaskableKeys = (words: Array<{ text: string; pos: PosLabel | null; role: RoleLabel | null }>): void => {
  words.forEach((word, i) => {
    if (word.pos === 'Preposition' && !words.slice(i + 1).some(w => w.pos === 'Noun' || w.pos === 'Pronoun')) word.pos = null;
    if (word.role === 'Object of Preposition' && !words.slice(0, i).some(w => w.pos === 'Preposition')) word.role = null;
    if (NUMBER_WORDS.has(bare(word.text))) word.pos = null;
  });
};

/**
 * Every judged item this payload can ask, in the order a sitting runs them.
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
    if (!sentence || !id || !(type in ACTION_FOR_TYPE)) { dropped += 1; return; }
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
    unaskableKeys(words);

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
  const actions = ACTION_FOR_TYPE[primaryType as SentenceMode] ?? ['name-pos'];
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

  const readAloudFor = (sentence: ResolvedSentence): string => {
    if (!bandFloor || read.has(sentence.index) || !sentence.spokenText) return '';
    read.add(sentence.index);
    return `Listen. ${sentence.spokenText} `;
  };

  type PartialItem = Omit<SentenceAnalyzerItem,
    'answerKind' | 'responseClass' | 'wall' | 'wallLabels' | 'tier' | 'mode'>;

  const push = (partial: PartialItem, mode: SentenceMode) => {
    if (items.length >= MAX_ITEMS) { truncated += 1; return; }
    const wall = wallKindFor(partial.action);
    items.push({
      ...partial,
      tier,
      mode,
      answerKind: answerKindFor(partial.action),
      responseClass: responseClassFor(partial.action),
      wall,
      wallLabels:
        wall === 'pos' ? posWall
          : wall === 'role' ? roleWall
            : wall === 'type' ? [...ALL_SENTENCE_TYPES] : [],
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
      }, sentence.type as SentenceMode));
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
      }, 'identify_role'));
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
        }, 'parse_structure'));
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
      }, 'parse_structure');
    } else if (sentence.sentenceType) {
      dropped += 1;
    }
  }

  // ── The channel-level leak close ──────────────────────────────────────────
  // The key's own check (`askLeaks`): a label or a classroom name the read-aloud says drops its item here, so the
  // boss's launch check never refuses the lesson. `name-side` is a menu key: its ask must say both sides.
  const answerFree = items.filter((item) => {
    if (!askLeaks(askFor(item), sentenceKey(item)).length) return true;
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

// ── The ask — short, the problem STATED aloud, one defensible answer ────────

/**
 * The target word as the tutor SAYS it — without the punctuation the printed sentence keeps. The generator attaches
 * sentence punctuation to the word it belongs to ("melts."), and an ask that interpolated it read "What part of speech
 * is the word melts.?" (judged drive, 2026-08-17). Only the spoken form is stripped; the stage still prints "melts.".
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

/** The ask: at the band floor the sentence read once ("Listen. ..."), then the question. */
export const askFor = (item: SentenceAnalyzerItem): string => `${item.readAloud}${questionFor(item)}`;

// ── The key ─────────────────────────────────────────────────────────────────

const quoted = (words: readonly string[]) => words.map(w => `"${w}"`).join(', ');

/**
 * The key the tutor judges each item with. name-side is a menu key (the ask says both sides), and the side is the
 * code's answer: small words and describing words in front of the naming word belong to the complete subject.
 * Every other action: the label, or its classroom name (`POS_ALTERNATES`, `ROLE_ALTERNATES`); a confusable label on
 * the wall is wrong, and on a job question so is a part of speech.
 */
export function sentenceKey(item: SentenceAnalyzerItem): SpokenKey {
  if (item.action === 'name-side') {
    const side = item.answer.toLowerCase();
    const other = side === 'subject' ? 'predicate' : 'subject';
    return {
      answer: side, alsoAccept: [`the ${side}`, `in the ${side}`], menu: ['subject', 'predicate'],
      signatureError: `"${other}" is wrong: "${speakableWord(item.targetWord)}" is in the ${side} of "${item.sentence}". `
        + 'Small words and describing words in front of the naming word belong to the complete subject; judge against '
        + 'this answer, not a re-reading.',
    };
  }
  const alternates = item.action === 'name-pos' ? POS_ALTERNATES[item.answer as PosLabel] ?? []
    : item.action === 'name-role' ? ROLE_ALTERNATES[item.answer as RoleLabel] ?? [] : [];
  const confusable = (CONFUSABLE_WITH[item.answer] ?? []).filter(label => item.wallLabels.includes(label));
  return {
    answer: item.answer, alsoAccept: [...alternates],
    signatureError: [
      confusable.length ? `${quoted(confusable)} ${confusable.length > 1 ? 'are different answers' : 'is a different answer'} `
        + 'and wrong here, even where one label sounds close to or contains the other.' : '',
      item.action === 'name-role' ? 'A part of speech ("noun", "verb") answers a different question and is wrong.' : '',
      'Any other grammar label is wrong.',
    ].filter(Boolean).join(' '),
  };
}

// ── Known misses ────────────────────────────────────────────────────────────

/** What a wrong spoken label shows (handoff 20 Part B; the lever table 2026-10-03 adds the last two). */
export type SpokenSentenceMiss = 'other_side' | 'part_of_speech' | 'confusable_label' | 'other_label' | 'describing_word'
  | 'named_the_side';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other side (name-side);
 * a part of speech where the job was asked (name-role); the label the lesson pairs with the answer, then any other
 * label on the printed wall.
 */
export function sentenceSpokenMisses(item: SentenceAnalyzerItem): KnownMiss[] {
  const word = speakableWord(item.targetWord);
  if (item.action === 'name-side') {
    const side = item.answer.toLowerCase(), other = side === 'subject' ? 'predicate' : 'subject';
    return [{ id: 'other_side', pattern: `In "${item.sentence}", the word "${word}" is in the ${side}. The learner's answer is "${other}", the other side.`,
      examples: [other, `the ${other}`] }];
  }
  const about = item.action === 'name-type' ? `The sentence "${item.sentence}" is ${item.answer}.`
    : `In "${item.sentence}", the word "${word}" is ${item.action === 'name-role' ? 'the' : 'a'} ${item.answer}.`;
  const confusable = (CONFUSABLE_WITH[item.answer] ?? []).filter(label => item.wallLabels.includes(label));
  const others = item.wallLabels.filter(label => label !== item.answer && !confusable.includes(label));
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  return [
    ...(item.action === 'name-role' ? [{ id: 'part_of_speech', pattern: `${about} The learner's answer is a part of speech such as "noun" or "verb", not a job in the sentence.`,
      examples: ['noun', 'verb'] }] : []),
    ...(confusable.length ? [{ id: 'confusable_label', pattern: `${about} The learner's answer is ${quote(confusable)}, a different label that is often mixed up with ${item.answer}.`,
      examples: confusable.slice(0, 2) }] : []),
    ...(item.action === 'name-pos' && (item.answer === 'Adjective' || item.answer === 'Adverb') ? [{ id: 'describing_word',
      pattern: `${about} The learner's answer is "describing word", which names both adjective and adverb.`,
      examples: ['describing word', 'a describing word'] }] : []),
    ...(item.action === 'name-role' && item.answer !== 'Subject' && item.answer !== 'Predicate' ? [{ id: 'named_the_side',
      pattern: `${about} The learner's answer is "subject" or "predicate": the part of the sentence the word sits in, not its own job.`,
      examples: ['subject', 'predicate'] }] : []),
    ...(others.length ? [{ id: 'other_label', pattern: `${about} The learner's answer is another label from the printed wall: ${quote(others)}.`,
      examples: others.slice(-2) }] : []),
  ];
}

// ── Scene ───────────────────────────────────────────────────────────────────

/** The id suffix of a practice item a simplify lever opens (`sentenceAnalyzerLevers.ts`). */
export const PRACTICE_SUFFIX = '~simpler';

/** What is drawn: the sentence (a practice sentence while one is open), the highlighted word and the printed wall.
 *  Never a label on a word of the sentence before its credit. */
export function sentenceScene(item: SentenceAnalyzerItem): SceneOf {
  const facts: Record<string, string> = {
    sentence: item.sentence,
    ...(item.targetIndex >= 0 ? { highlighted: `The word "${speakableWord(item.targetWord)}" is highlighted.` } : {}),
    ...(item.wallLabels.length ? { wall: `Printed on the word wall: ${item.wallLabels.join(', ')}.` } : {}),
    constraints: 'No word of this sentence is labelled on screen until its answer is credited.',
  };
  if (item.id.endsWith(PRACTICE_SUFFIX)) facts.practice = 'An easier practice sentence, ungraded. The full item comes back after it.';
  return { objects: [], facts };
}

// ── Harness answer material ─────────────────────────────────────────────────

/** The journey's answers: the code-computed label, or a plainly wrong one of the same kind (the other side, another
 *  label on the wall). */
export const sentenceAnalyzerHarnessAnswers = (item: SentenceAnalyzerItem): { correct: string; plainWrong: string } => {
  if (item.action === 'name-side') {
    return { correct: item.answer.toLowerCase(), plainWrong: item.answer === 'Subject' ? 'predicate' : 'subject' };
  }
  const others = item.wallLabels.filter(label => label !== item.answer);
  const fallback = item.action === 'name-role' ? 'Modifier' : item.action === 'name-type' ? 'Imperative' : 'Verb';
  return { correct: item.answer, plainWrong: others[others.length - 1] ?? fallback };
};
