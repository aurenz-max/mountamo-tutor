/**
 * The candidates for a BLIND hearing of one spoken word: what the model chooses among when it is never told the answer.
 *
 * 11-13 bench: told the answer is "mat", gemini-decision-1 credits "hat" (0.89); asked which word it heard, it hears
 * "hat" (0.95). So the model picks the word and code decides. The target is hidden among the item's known wrong reads
 * (`wordReadingMisses`) and every real CVC word one sound away, so the target is never simply the nearest word on the
 * list; each candidate carries the reading code assigns it. Client-safe: the bench shows the list.
 */
import { childSound, LETTER_NAME, wordReadingMisses } from '../../primitives/visual-primitives/literacy/spokenReadingMisses';
import type { KnownMiss } from '../../components/live-activity/runtime/spokenMissContract';
import type { HearKey } from '../../components/live-activity/runtime/spokenHearContract';
import { CVC_WORDS } from '../../primitives/visual-primitives/literacy/letterBuildWords';

export interface BlindCandidate {
  /** The criterion key the model answers with. */
  key: string;
  /** What the criterion says, with no hint of which one is right. */
  says: string;
  /** What code reads that choice as: `correct`, a miss id, or `other`. */
  reading: string;
}

const POSITION_IDS = ['first_sound_changed', 'middle_sound_changed', 'last_sound_changed'];
const WORD = /^[a-z]+$/;

/** `misses`: the item's own known misses (a digraph word's sounds are not its letters); by default the CVC reading's. */
export function blindWordCandidates(target: string, itemMisses?: readonly KnownMiss[]): BlindCandidate[] {
  const word = target.trim().toLowerCase();
  const letters = word.split('');
  const misses = itemMisses ?? wordReadingMisses(word, letters.length === 3 ? { sounds: letters } : {});
  const out = new Map<string, BlindCandidate>();
  const add = (w: string, reading: string) => {
    if (!out.has(w)) out.set(w, { key: w, says: `The speaker says the word "${w}".`, reading });
  };
  add(word, 'correct');
  for (const m of misses) {
    if (m.id === 'letter_name') out.set('said_letter_names', { key: 'said_letter_names', reading: m.id,
      says: `The speaker says letter names one at a time, like "${m.examples?.[1] ?? ''}", not a word.` });
    else if (m.id === 'sounds_no_word') out.set('said_separate_sounds', { key: 'said_separate_sounds', reading: m.id,
      says: `The speaker says separate sounds one at a time, like "${m.examples?.[0] ?? ''}", and no whole word.` });
    else for (const e of m.examples ?? []) if (WORD.test(e)) add(e, m.id);
  }
  if (letters.length === 3) for (const w of CVC_WORDS) {
    if (w.length !== 3 || out.has(w)) continue;
    const diff = letters.flatMap((c, i) => (w[i] !== c ? [i] : []));
    if (diff.length === 1) add(w, POSITION_IDS[diff[0]]);
  }
  out.set('said_something_else', { key: 'said_something_else', reading: 'other',
    says: 'The speaker says a different word than any listed, several words, or nothing that can be heard.' });
  // Alphabetical, so the target's place in the list says nothing.
  return Array.from(out.values()).sort((a, b) => a.key.localeCompare(b.key));
}

// ── Letters ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type LetterAsk = 'sound' | 'name';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
/** Held consonants: a vowel after one is `added_vowel`. */
const HELD = new Set(['s', 'n', 'm', 'f', 'l', 'r', 'v', 'z']);
/** Letters whose sound alone is another letter's (c says k): one sound option each. */
const SAME_SOUND: Readonly<Record<string, string>> = { c: 'k' };
const soundKey = (l: string) => `sound_${SAME_SOUND[l] ?? l}`;

/**
 * The blind options for one printed letter: every letter's sound and every letter's name, the target's sound with a
 * vowel after it, a whole word, and something else. The same list serves both asks; only the reading code gives each
 * option differs (on a sound ask the name is `letter_name`; on a name ask the sound is `said_the_sound`).
 */
export function blindLetterCandidates(letter: string, ask: LetterAsk): BlindCandidate[] {
  const l = letter.toLowerCase();
  const out: BlindCandidate[] = [];
  const sounds = new Set<string>();
  for (const x of ALPHABET) {
    const key = soundKey(x);
    if (!sounds.has(key)) {
      sounds.add(key);
      out.push({ key, says: `The speaker says a single letter SOUND, "${childSound(x)}", not a letter name or a word.`,
        reading: key === soundKey(l) ? (ask === 'sound' ? 'correct' : 'said_the_sound') : 'other_sound' });
    }
    out.push({ key: `name_${x}`, says: `The speaker says the letter NAME "${LETTER_NAME[x]}" (the letter ${x.toUpperCase()}).`,
      reading: x === l ? (ask === 'name' ? 'correct' : 'letter_name') : 'other_name' });
  }
  if (HELD.has(l)) out.push({ key: `sound_${l}_with_vowel`, reading: 'added_vowel',
    says: `The speaker says the sound with a vowel after it, "${l}uh", instead of a held "${childSound(l)}".` });
  out.push({ key: 'said_a_word', reading: 'keyword_word', says: 'The speaker says a whole word, such as a picture word, not a single sound or letter name.' });
  out.push({ key: 'said_something_else', reading: 'other', says: 'The speaker says something else, several things, or nothing that can be heard.' });
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** The letter's known misses as the app states them (`letterSoundSpokenMisses`' wording), for the told and miss shapes. */
export function letterMisses(letter: string, ask: LetterAsk): KnownMiss[] {
  const l = letter.toLowerCase(), name = LETTER_NAME[l], sound = childSound(l);
  if (ask === 'name') return [
    { id: 'said_the_sound', pattern: `The learner says the letter's SOUND, "${sound}", instead of its name "${name}".`, examples: [sound] },
    { id: 'other_name', pattern: 'The learner says the name of a different letter.' }];
  return [
    { id: 'letter_name', pattern: `The learner says the NAME of the letter, "${name}", instead of the sound it makes.`, examples: [name] },
    { id: 'keyword_word', pattern: 'The learner says a whole word instead of the sound on its own, even one that starts with the right sound.' },
    ...(HELD.has(l) ? [{ id: 'added_vowel', pattern: `The learner says the sound with a vowel after it, "${l}uh", instead of holding the sound on its own.`, examples: [`${l}uh`] }] : []),
    { id: 'other_sound', pattern: 'The learner says the sound of a different letter. A held consonant such as "mmm" or "nnn" is a letter sound, not filler.',
      examples: ['mmm', 'fff', 'sss'].filter(d => d !== sound).slice(0, 2) }];
}

/** What the bench asks and expects for a letter. */
export const letterTask = (letter: string, ask: LetterAsk) => ask === 'sound'
  ? { task: `What sound does this letter make? ${letter.toLowerCase()}`, expectedAnswer: `the sound of the letter ${letter.toLowerCase()}, "${childSound(letter)}", not the letter name` }
  : { task: `What is the name of this letter? ${letter.toUpperCase()}`, expectedAnswer: `the letter name "${LETTER_NAME[letter.toLowerCase()]}", not its sound` };

// ── Any closed key ────────────────────────────────────────────────────────────────────────────────────────────────

/** A wrong option the model can pick besides "something else": below this many, the target is the only near option and
 *  a blind pick is no better than a told one (11-13 bench), so the item is not heard. */
export const MIN_WRONG_OPTIONS = 3;

/** The ways a key writes one letter's sound ("sss", "aaa", "/t/", "kuh"): such an answer is heard among every letter. */
const LETTER_OF_SOUND = new Map<string, string>();
for (const x of ALPHABET) for (const form of [`/${x}/`, x.repeat(3), childSound(x)]) {
  if (!LETTER_OF_SOUND.has(form)) LETTER_OF_SOUND.set(form, x);
}
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * The blind options for any spoken item, from what every spoken boss already gives: its key's answers and its known
 * misses. The answer's shape picks the shared distractors: a letter's sound is heard among every letter's sound and
 * name, one word among its misreads and every CVC word one sound away; any other answer among the misses' examples
 * and the menu. Null when the options are too few to hear blind (`MIN_WRONG_OPTIONS`). Same input on client and server.
 */
export function hearCandidates(key: HearKey, misses: readonly KnownMiss[]): { candidates: BlindCandidate[]; setting: string } | null {
  const first = key.answers[0]?.trim().toLowerCase() ?? '';
  const letter = LETTER_OF_SOUND.get(first);
  const base = letter ? blindLetterCandidates(letter, 'sound')
    : WORD.test(first) && first.length >= 2 && first.length <= 12 ? blindWordCandidates(first, misses.length ? misses : undefined)
    : [];
  const setting = letter ? 'A child looked at one printed letter and said something about it aloud.'
    : base.length ? 'A child said one word aloud.' : 'A child answered a question aloud.';
  const out = new Map(base.filter(c => c.key !== 'said_something_else').map(c => [c.key, c]));
  /** One option per text, in one wording, so no option reads differently from its neighbours. An accepted answer
   *  already listed (a neighbour word that the key also accepts) becomes correct. */
  const add = (said: string, reading: string) => {
    const k = slug(said), had = out.get(k);
    if (!k) return;
    if (had) { if (reading === 'correct') out.set(k, { ...had, reading }); return; }
    out.set(k, { key: k, says: base.length && WORD.test(k) ? `The speaker says the word "${k}".` : `The speaker says "${said.trim()}".`, reading });
  };
  // A letter's own sound forms are already its option; every other accepted answer is one more right option.
  for (const a of key.answers) if (!(letter && LETTER_OF_SOUND.get(a.trim().toLowerCase()) === letter)) add(a, 'correct');
  // The word and letter lists already hold the misses; any other answer is heard among its misses' examples.
  if (!base.length) for (const m of misses) for (const e of m.examples ?? []) add(e, m.id);
  for (const w of key.menu ?? []) add(w, 'other');
  if (Array.from(out.values()).filter(c => c.reading !== 'correct').length < MIN_WRONG_OPTIONS) return null;
  out.set('said_something_else', { key: 'said_something_else', reading: 'other',
    says: 'The speaker says something different from every option listed, several things, or nothing that can be heard.' });
  return { candidates: Array.from(out.values()).sort((a, b) => a.key.localeCompare(b.key)), setting };
}
