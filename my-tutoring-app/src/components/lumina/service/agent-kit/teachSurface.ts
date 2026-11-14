/**
 * The `teach` surface (2026-11-13): the child explains an idea out loud to a character who holds a wrong one, and the
 * live tutor plays that character. It is the kit's surface for the `explain` act of an evidence spec, which no tap
 * surface can collect, and the first spoken surface in the kit.
 *
 * Why this shape (Wharton Primer's teachback, `qa/topic-traces/primer-bench-2026-11-13.md`): a learner who must make a
 * confused peer understand retrieves more and notices gaps a quiz hides; the peer's confusion targets the lesson's
 * misconceptions; the scene ends by consequence (the peer gets it, or stays confused). The DI spoken pack already
 * judges a one-sentence explanation on meaning (`explain_concept`); this surface keeps that judge and adds the
 * character, its wrong idea and its pushback.
 *
 * Roles: the author writes the content (who the character is, the wrong idea it holds, the idea the child must get
 * across, what the character says when the first try is thin). Code derives the spoken key the tutor judges by, the
 * misses the observer names, the harness's answers, the difficulty, and refuses an item whose words give the idea
 * away. No key, miss or accept list is ever written by the author (agent-primitive I11).
 *
 * Pure and light: the kit's surfaces, the boss, the look stage, the scene and the tests read the same rules.
 */
import type { KnownMiss } from '../../components/live-activity/runtime/spokenMissContract';
import type { SpokenKey } from '../../components/live-activity/spokenKey';

export interface TeachSpec {
  /** Who the child teaches: a first name, said by the tutor. */
  character: string;
  /** The wrong idea the character holds, in its own words (from the lesson's misconceptions or `notCredit`). */
  holds: string;
  /** The idea the child must get across, as one proposition in 4-16 words. The tutor judges meaning against it. */
  idea: string;
  /** What the character says back when the first try is thin: 0-2 lines, none of which says the idea. */
  presses: string[];
}

export const TEACH_MISSES = ['agreed_with_character', 'read_back', 'named_only', 'opposite_idea'] as const;
export type TeachMiss = typeof TEACH_MISSES[number];

export const IDEA_MIN_WORDS = 4;
export const IDEA_MAX_WORDS = 16;
export const PRESS_MAX_WORDS = 20;
export const MAX_PRESSES = 2;

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'so', 'to', 'of', 'in', 'on', 'at', 'is', 'are', 'it', 'its', 'be', 'that', 'this',
  'then', 'than', 'with', 'for', 'from', 'you', 'your', 'we', 'they', 'them', 'i', 'my', 'can', 'do', 'does', 'did', 'not', 'no', 'yes',
  'because', 'if', 'when', 'what', 'why', 'how', 'all', 'just', 'get', 'got', 'make', 'makes', 'made', 'there', 'here', 'have', 'has', 'up']);

export const wordsOf = (s: string): string[] => (s ?? '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
const stem = (w: string) => w.replace(/'s$/, '').replace(/(ies)$/, 'y').replace(/(es|s)$/, '').replace(/(ing|ed)$/, '');
/** The words that carry an idea: no function words, stemmed, deduped. */
export const contentWords = (s: string): Set<string> => new Set(wordsOf(s).filter(w => !STOP.has(w) && w.length > 1).map(stem));

const share = (idea: Set<string>, text: string): number => {
  if (!idea.size) return 0;
  const t = contentWords(text);
  let hit = 0;
  idea.forEach(w => { if (t.has(w)) hit++; });
  return hit / idea.size;
};

const words = (s: string) => wordsOf(s).length;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** A teach spec from a draft, or undefined when it is not one. */
export function readTeach(raw: unknown): TeachSpec | undefined {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!text(r.character) && !text(r.idea) && !text(r.holds)) return undefined;
  return {
    character: text(r.character) ? r.character.trim() : '', holds: text(r.holds) ? r.holds.trim() : '', idea: text(r.idea) ? r.idea.trim() : '',
    presses: (Array.isArray(r.presses) ? r.presses : []).filter(text).map(p => p.trim()).slice(0, MAX_PRESSES + 2),
  };
}

/** Why a teach item cannot run, as sentences the author can act on. Empty when it can. */
export function teachErrors(t: TeachSpec | undefined, prompt: string, shownText: readonly string[] = []): string[] {
  if (!t) return ['teach: the item needs teach: {character, holds, idea, presses}'];
  const e: string[] = [];
  if (!text(t.character) || words(t.character) > 3) e.push('teach: character is a first name');
  if (!text(t.holds)) e.push('teach: holds is the wrong idea the character has, in its own words');
  const n = words(t.idea);
  if (n < IDEA_MIN_WORDS || n > IDEA_MAX_WORDS) e.push(`teach: idea is one proposition in ${IDEA_MIN_WORDS}-${IDEA_MAX_WORDS} words (it has ${n})`);
  if (t.presses.length > MAX_PRESSES) e.push(`teach: at most ${MAX_PRESSES} presses`);
  for (const p of t.presses) if (words(p) > PRESS_MAX_WORDS) e.push(`teach: a press is at most ${PRESS_MAX_WORDS} words`);
  if (e.length) return e;
  const idea = contentWords(t.idea);
  if (idea.size < 2) e.push('teach: the idea needs at least two content words a child could say');
  if (share(idea, t.holds) >= 0.75) e.push('teach: the wrong idea the character holds is the idea itself in other words; make it a real misconception');
  const leak = (what: string, s: string) => { if (share(idea, s) >= 0.6) e.push(`teach: the ${what} says the idea; a child could read it back`); };
  leak('prompt', prompt);
  t.presses.forEach((p, i) => leak(`press ${i + 1}`, p));
  shownText.forEach(s => leak('text on screen', s));
  return e;
}

/**
 * Whether what was said carries the idea, as code reads it: most of the idea's content words, and not the character's
 * wrong idea instead. This is the HARNESS and TEST reading only. The child's explanation is judged by the live tutor on
 * meaning (`teachSpokenKey`), where "they match" can carry "both sides are the same"; this word count cannot.
 */
export function saysIdea(t: TeachSpec, said: string): boolean {
  const idea = contentWords(t.idea);
  return share(idea, said) >= 0.5 && !(share(contentWords(t.holds), said) > share(idea, said));
}

/** The miss the harness's wrong answer shows. */
export const teachHarnessMiss = (t: TeachSpec, said: string): TeachMiss =>
  (share(contentWords(t.holds), said) >= 0.5 ? 'agreed_with_character' : 'named_only');

/** The key the tutor judges by: a meaning, never a wording. Derived; the author writes only the idea. */
export function teachSpokenKey(t: TeachSpec): SpokenKey {
  return {
    answer: t.idea,
    alsoAccept: [],
    meaning: {
      idea: t.idea,
      notIt: `agreeing with ${t.character} ("${t.holds}"), reading the prompt or the screen back, naming what is shown without saying why, or a bare number`,
    },
  };
}

/** What a wrong answer shows, for the spoken-miss observer. Advisory: it names the pattern and never gives credit. */
export function teachMisses(t: TeachSpec): KnownMiss[] {
  return [
    { id: 'agreed_with_character', pattern: `The learner agrees with ${t.character} or says the wrong idea back: "${t.holds}".` },
    { id: 'read_back', pattern: 'The learner reads the prompt or the words on the screen back instead of explaining.' },
    { id: 'named_only', pattern: 'The learner names the thing shown or the topic word without saying why or how.' },
    { id: 'opposite_idea', pattern: 'The learner says the opposite of the idea, or negates its key words ("they are not the same").' },
  ];
}

/** The journey's answers: the idea in its own words, and the character's wrong idea (plainly wrong, same kind). */
export const teachSay = (t: TeachSpec): { correct: string; plainWrong: string } => ({ correct: t.idea, plainWrong: t.holds });

/** The difficulty an explanation adds, from structure: saying an idea, and how many times the character presses back. */
export function teachDifficulty(t: TeachSpec): Array<{ score: number; why: string }> {
  return [
    { score: 1.2, why: 'an idea said in the child\'s own words' },
    ...(t.presses.length ? [{ score: 0.4 * t.presses.length, why: `${t.character} presses back ${t.presses.length} time${t.presses.length === 1 ? '' : 's'}` }] : []),
  ];
}

/** The item in words for the reader and the tutor: who the character is and what it thinks; never the idea. */
export function teachWords(t: TeachSpec): string[] {
  return [
    `The child explains out loud to ${t.character}, who thinks: "${t.holds}".`,
    ...(t.presses.length ? [`If the first try is thin, ${t.character} says: ${t.presses.map(p => `"${p}"`).join(' then ')}`] : []),
  ];
}
