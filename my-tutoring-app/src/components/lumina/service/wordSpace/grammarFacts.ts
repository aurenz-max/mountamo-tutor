/**
 * Grammar facts for the word library (service/wordSpace): what a K grammar frame needs to know about a word that
 * its sounds and picture do not say. Computed in code from the library and word-flip's own forms; nothing here is
 * asked of a model.
 *
 * - Starts with a vowel SOUND (a/an): from the CMU phonemes, and only when the first letter agrees, so "hour",
 *   "unicorn" and "one" (letter and sound disagree) are left out rather than keyed by letter.
 * - Person kind (he/she/they): a reviewed table over the library's person words whose picture shows one clear
 *   girl/woman or boy/man; child, baby, person and the job words are left out (the picture does not settle it).
 * - Plural form, third-person -s form, -ing form and past form: plural and past come from word-flip's oracle
 *   (`deriveWordFlipAnswer`), so there is one irregular list, not two.
 */
import 'server-only';
import { deriveWordFlipAnswer } from '../literacy/gemini-word-flip';
import { isVowel, lexWord, type LexWord } from './lexicon';
import { SUPPLETIVE_PAST, VOWEL_CHANGE_PAST } from './wordFlipSpaces';

/** a/an is keyed on the first SOUND; a word whose first letter and first sound disagree is not usable. */
export function articleFor(x: LexWord): 'a' | 'an' | null {
  const letterVowel = /^[aeiou]/.test(x.w);
  const soundVowel = isVowel(x.phones[0] ?? '');
  if (letterVowel !== soundVowel) return null;
  return soundVowel ? 'an' : 'a';
}

/** A first vowel that is not a short vowel (ice, owl, ear, eye): the /æ/ of apple is the easy case. */
export const longVowelStart = (x: LexWord): boolean => !['AE', 'EH', 'IH', 'AA', 'AH', 'AO'].includes(x.phones[0] ?? '');

export type PersonKind = 'she' | 'he' | 'they';
export interface Person { word: string; emoji: string; kind: PersonKind; label: string; noun: string }

/** Library person words whose picture shows one clear person of one kind. */
const PERSON_KIND: Readonly<Record<string, Exclude<PersonKind, 'they'>>> = {
  girl: 'she', woman: 'she', lady: 'she', princess: 'she', mermaid: 'she',
  boy: 'he', man: 'he', king: 'he', prince: 'he',
};
/** Groups drawn from two library pictures (or the library's own family picture); "they" in every case. */
const GROUPS: ReadonlyArray<{ id: string; parts: readonly string[]; noun: string; label: string }> = [
  { id: 'kids', parts: ['girl', 'boy'], noun: 'kids', label: 'a girl and a boy' },
  { id: 'boys', parts: ['boy', 'boy'], noun: 'boys', label: 'two boys' },
  { id: 'girls', parts: ['girl', 'girl'], noun: 'girls', label: 'two girls' },
  { id: 'family', parts: ['family'], noun: 'family', label: 'a family' },
];

const known = (x: LexWord | undefined, allowed: ReadonlySet<string>): x is LexWord => !!x && !!x.emoji && allowed.has(x.knownBy);

/** The people a grade knows, one per picture (woman and lady share one). */
export function peopleFor(allowed: ReadonlySet<string>): Person[] {
  const seen = new Set<string>();
  const singles = Object.entries(PERSON_KIND).flatMap(([w, kind]) => {
    const x = lexWord(w);
    if (!known(x, allowed) || seen.has(x.emoji!)) return [];
    seen.add(x.emoji!);
    return [{ word: w, emoji: x.emoji!, kind, label: `a ${w}`, noun: w }];
  });
  const groups = GROUPS.flatMap((g) => {
    const parts = g.parts.map(lexWord);
    if (!parts.every((p) => known(p, allowed))) return [];
    return [{ word: g.id, emoji: parts.map((p) => p!.emoji).join(''), kind: 'they' as const, label: g.label, noun: g.noun }];
  });
  return [...singles, ...groups];
}

export const SUBJECT_OF: Readonly<Record<PersonKind, string>> = { she: 'she', he: 'he', they: 'they' };
export const OBJECT_OF: Readonly<Record<PersonKind, string>> = { she: 'her', he: 'him', they: 'them' };
export const POSSESSIVE_OF: Readonly<Record<PersonKind, string>> = { she: 'her', he: 'his', they: 'their' };

/** Plural of a countable noun: word-flip's regular and irregular rules; null when none fits. */
export function pluralOf(w: string): { form: string; irregular: boolean } | null {
  const irregular = deriveWordFlipAnswer('irregulars', w);
  if (irregular) return { form: irregular, irregular: true };
  const regular = deriveWordFlipAnswer('plural_s', w) ?? deriveWordFlipAnswer('plural_es', w) ?? deriveWordFlipAnswer('plural_y', w);
  return regular ? { form: regular, irregular: false } : null;
}

/** The present form with one subject (runs, washes, goes). */
export function thirdPersonOf(v: string): { form: string; es: boolean } {
  if (v === 'have') return { form: 'has', es: true };
  if (/(s|x|z|ch|sh|o)$/.test(v)) return { form: `${v}es`, es: true };
  if (/[^aeiou]y$/.test(v)) return { form: `${v.slice(0, -1)}ies`, es: true };
  return { form: `${v}s`, es: false };
}

/** run -> running, sleep -> sleeping (one short vowel before one final consonant doubles it). */
export function ingOf(v: string): string {
  if (/[^aeiou][aeiou][bdgmnprt]$/.test(v) && v.length <= 4) return `${v}${v[v.length - 1]}ing`;
  if (/[^e]e$/.test(v)) return `${v.slice(0, -1)}ing`;
  return `${v}ing`;
}

export type PastKind = 'regular' | 'vowel-change' | 'other' | 'new-word';
/** The past form from word-flip's oracle, and what kind of change it is. */
export function pastOf(v: string): { form: string; kind: PastKind } | null {
  const regular = deriveWordFlipAnswer('past_ed', v);
  if (regular) return { form: regular, kind: 'regular' };
  const irregular = deriveWordFlipAnswer('past_irregular', v);
  if (!irregular) return null;
  return { form: irregular, kind: VOWEL_CHANGE_PAST.has(v) ? 'vowel-change' : SUPPLETIVE_PAST.has(v) ? 'new-word' : 'other' };
}

/**
 * Action verbs whose library picture shows the action (hop is left out: its picture is a rabbit), each with a short
 * ending that makes a natural K sentence. `animal` marks the ones an animal can do too.
 */
export interface Verb { v: string; emoji: string; tail: string; animal: boolean }
const VERB_TAILS: ReadonlyArray<{ v: string; tail: string; animal: boolean }> = [
  { v: 'run', tail: 'fast', animal: true }, { v: 'sit', tail: 'down', animal: true },
  { v: 'sleep', tail: 'a lot', animal: true }, { v: 'eat', tail: 'lunch', animal: true },
  { v: 'play', tail: 'outside', animal: true }, { v: 'walk', tail: 'home', animal: true },
  { v: 'dig', tail: 'in the sand', animal: false },
  { v: 'kick', tail: 'the ball', animal: false }, { v: 'wash', tail: 'the dishes', animal: false },
  { v: 'laugh', tail: 'a lot', animal: false }, { v: 'clean', tail: 'up', animal: false },
  { v: 'go', tail: 'to school', animal: false }, { v: 'talk', tail: 'a lot', animal: false },
];

export function verbsFor(allowed: ReadonlySet<string>): Verb[] {
  return VERB_TAILS.flatMap((t) => {
    const x = lexWord(t.v);
    return known(x, allowed) ? [{ ...t, emoji: x.emoji! }] : [];
  });
}

/** Things a person can own and act on, with the verb that fits ("kick it"). */
const THING_VERBS: ReadonlyArray<readonly [string, string]> = [
  ['ball', 'kick'], ['kite', 'fly'], ['book', 'read'], ['cake', 'eat'], ['hat', 'wear'], ['apple', 'eat'], ['drum', 'play'],
];
export interface Thing { word: string; emoji: string; verb: string }
export function thingsFor(allowed: ReadonlySet<string>): Thing[] {
  return THING_VERBS.flatMap(([w, verb]) => {
    const x = lexWord(w);
    return known(x, allowed) ? [{ word: w, emoji: x.emoji!, verb }] : [];
  });
}
