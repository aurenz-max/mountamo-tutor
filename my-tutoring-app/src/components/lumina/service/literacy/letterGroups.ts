/**
 * letterGroups — the cumulative phonics letter-group progression, in ONE place.
 *
 * WHY THIS EXISTS (2026-08-10). `PRD_KINDERGARTEN_PHONICS_AND_ALPHABET.md`
 * defines a four-group cumulative progression and names its consumers:
 * *"Used by `letter-spotter`, `letter-sound-link`, `letter-tracing`,
 * `cvc-speller`."* Three of those hold private copies that agree; `cvc-speller`
 * had forked into something else entirely and nobody noticed, because its fork
 * only became visible once its answer was spoken aloud.
 *
 * ⚠️ THE FORK, AND WHY IT MATTERED. cvc-speller's private `LETTER_GROUP_SETS`
 * was CONSONANT-ONLY — group 1 was `s t m p` (with `m` pulled forward out of
 * group 2, and `n` missing) — and it re-added exactly ONE vowel through a
 * separate `vowelFocus` axis that defaulted to `short-a` whenever the topic
 * string did not literally match /short[ -]?[aeiou]/. The two together left a
 * group-1 lesson a legal word space of about {sat, sam, sap, tap, tam, map,
 * mat, pat, pam} — so a real draw came back `sat, pat, mat, map`, three of them
 * sharing a rime, every answer the same sound. **The pool was exhausted by
 * design, not by chance.**
 *
 * The canonical groups carry their own vowels, which is the entire point of the
 * progression: group 1 (`s a t i p n`) already spans TWO vowels and yields
 * `sat sit sip tip tap nap pan pin tin pit tan`, so variety and a changing
 * answer come for free rather than needing a difficulty lever bolted on.
 *
 * WHAT THE CURRICULUM ACTUALLY SAYS, since that is what settles the scoping
 * question (`backend/data/detailed_objectives_language-arts.csv`):
 *  - `LA001-03-B` — *"Match short vowel sounds (a, e, i, o, u) to their
 *    corresponding written letters"*. **All five, named.**
 *  - *"Spell simple CVC words and common sight words correctly"* — no vowel
 *    scoping at all. Its one named narrowing is WORD FAMILY (*"-at: cat,
 *    hat"*), which is a different axis from vowel focus and is not implemented
 *    here (filed against cvc-speller, not invented in passing).
 * So a single-vowel cap is something the curriculum never asks for, and a
 * default single-vowel cap is a hardcoded cap below lesson intent.
 *
 * ⚠️ NOT YET SHARED BY ITS OTHER CONSUMERS. `gemini-letter-spotter.ts` and
 * `gemini-letter-sound-link.ts` still hold identical private copies, differing
 * from each other only in group 4's tail (`q` vs `qu`). Re-pointing them is a
 * pure dedupe but it is a SWEEP across two primitives with their own live
 * tests, so it is filed rather than done here (pilot-then-sweep). This module
 * uses `qu`, the teachable unit, and `cvcUsableLetters` drops it anyway.
 */

/** Letters introduced AT each group. */
export const NEW_LETTERS: Record<number, readonly string[]> = {
  1: ['s', 'a', 't', 'i', 'p', 'n'],
  2: ['c', 'k', 'e', 'h', 'r', 'm', 'd'],
  3: ['g', 'o', 'u', 'l', 'f', 'b'],
  4: ['j', 'z', 'w', 'v', 'y', 'x', 'qu'],
};

/** Everything available BY each group — what a lesson at that group may use. */
export const LETTER_GROUPS: Record<number, readonly string[]> = {
  1: NEW_LETTERS[1],
  2: [...NEW_LETTERS[1], ...NEW_LETTERS[2]],
  3: [...NEW_LETTERS[1], ...NEW_LETTERS[2], ...NEW_LETTERS[3]],
  4: [...NEW_LETTERS[1], ...NEW_LETTERS[2], ...NEW_LETTERS[3], ...NEW_LETTERS[4]],
};

export type LetterGroup = 1 | 2 | 3 | 4;

const VOWELS = ['a', 'e', 'i', 'o', 'u'] as const;

/** Clamp anything to a real group. */
export const normalizeLetterGroup = (value: unknown): LetterGroup | null => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? (n as LetterGroup) : null;
};

export const cumulativeLetters = (group: LetterGroup): string[] => [...LETTER_GROUPS[group]];

/**
 * The vowels a group carries — the answer space of any "which vowel sound?"
 * task scoped to it. G1 → a,i · G2 → a,i,e · G3+ → all five.
 */
export const groupVowels = (group: LetterGroup): string[] =>
  VOWELS.filter((v) => LETTER_GROUPS[group].includes(v));

/**
 * Letters usable in a CVC slot. `qu` is a two-letter digraph and cannot sit in
 * one Elkonin box, so it is excluded — the only group-4 letter that needs it.
 */
export const cvcUsableLetters = (group: LetterGroup): string[] =>
  LETTER_GROUPS[group].filter((l) => l.length === 1);

/**
 * The smallest group that contains `letter`. Used to RAISE a group that would
 * otherwise sit below what the lesson explicitly asked for — a cap below stated
 * intent is a bug, not a safety margin, so an objective naming "short o" pulls
 * the group up to 3 rather than silently dropping the o.
 */
export const smallestGroupContaining = (letter: string): LetterGroup | null => {
  const target = letter.toLowerCase();
  for (const group of [1, 2, 3, 4] as LetterGroup[]) {
    if (LETTER_GROUPS[group].includes(target)) return group;
  }
  return null;
};

// ============================================================================
// Objective-text readers (2026-09-05). The manifest passes the objective
// through unchanged; the GENERATOR reads it. Nothing here asks the curator to
// remember a field — a lesson-journey run found letter-sound-link and
// letter-spotter defaulting to Group 1 for a "Letter-Sound Group 2" objective
// because the group was only ever read from `config.letterGroup`.
// ============================================================================

/**
 * Letters an objective NAMES as a set: comma lists ("s, a, t, i, p, n"), a
 * quoted letter ('a'), or the expansion of "Group N". Deliberately NOT a loose
 * single-letter scan — the article "a" and "I" would poison it. Lowercase,
 * deduped, in order of first mention.
 */
export const lettersNamedIn = (text: string): string[] => {
  const t = text.toLowerCase();
  const hits: Array<{ at: number; letters: string[] }> = [];
  for (const m of Array.from(t.matchAll(/(?:^|[^a-z])([a-z](?:\s*,\s*(?:and\s+)?[a-z])+)(?![a-z])/g))) {
    hits.push({ at: m.index ?? 0, letters: m[1].replace(/\band\b/g, '').split(',').map((l) => l.replace(/[^a-z]/g, '')) });
  }
  for (const m of Array.from(t.matchAll(/['"‘“]([a-z])['"’”]/g))) hits.push({ at: m.index ?? 0, letters: [m[1]] });
  for (const m of Array.from(t.matchAll(/\bgroup\s*([1-4])\b/g))) hits.push({ at: m.index ?? 0, letters: [...LETTER_GROUPS[Number(m[1]) as LetterGroup]] });
  const found: string[] = [];
  for (const hit of hits.sort((a, b) => a.at - b.at)) {
    for (const l of hit.letters) if (/^[a-z]$/.test(l) && !found.includes(l)) found.push(l);
  }
  return found;
};

/** The smallest cumulative group that contains every letter the text names. */
export const letterGroupFromText = (text: string): LetterGroup | null => {
  let group: LetterGroup | null = null;
  for (const m of Array.from(text.toLowerCase().matchAll(/\bgroup\s*([1-4])\b/g))) {
    const g = Number(m[1]) as LetterGroup;
    if (!group || g > group) group = g;
  }
  for (const letter of lettersNamedIn(text)) {
    const needed = smallestGroupContaining(letter);
    if (needed && (!group || needed > group)) group = needed;
  }
  return group;
};

/**
 * The group a generator should use: an explicit manifest value is honored,
 * the objective/intent/topic text can only RAISE it (a cap below stated
 * intent is a bug — `resolveCvcLetterGroup`'s rule), and the fallback is the
 * legacy Group 1. `source` says which won, for the generator's log line.
 */
export const resolveObjectiveLetterGroup = (
  configured: unknown,
  texts: ReadonlyArray<string | undefined | null>,
): { group: LetterGroup; source: 'config' | 'objective' | 'default' } => {
  const explicit = normalizeLetterGroup(configured);
  const fromText = letterGroupFromText(texts.filter(Boolean).join('\n'));
  if (fromText && (!explicit || fromText > explicit)) return { group: fromText, source: 'objective' };
  if (explicit) return { group: explicit, source: 'config' };
  return { group: 1, source: 'default' };
};

/**
 * Does the objective ask for a COLD attempt — production without the tutor
 * saying the sound first? ("Independently produce…", "Assess without first
 * saying its sound"). A generator that reads this withdraws its model line
 * regardless of the manifest's support tier: the tier is a student property,
 * the objective is the contract.
 */
export const asksIndependentProduction = (text: string | undefined | null): boolean =>
  /\b(independently|unprompted|without\s+(?:first\s+)?(?:saying|modeling|modelling|telling|giving|hearing))\b/i.test(text ?? '');
