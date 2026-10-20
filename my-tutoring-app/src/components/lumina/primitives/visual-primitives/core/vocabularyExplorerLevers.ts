/**
 * The in-item levers on vocabulary-explorer, as one lever set (`VOCAB_LEVERS`, `bossLevers.ts`; `/add-support-tiers`,
 * report qa/eval-reports/vocabulary-explorer-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `vocabMiss` observes; the failures behind them are documented (the old catalog's commonStruggles: similar words
 * confused, example sentences not read, fill-in-the-blank) or inferred (a sentence's grammar not used, the extra
 * meaning not ruled out). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `show_examples` (legend; match): under each word, its example sentence from its card (the word used in a
 *   sentence), every word alike. Withheld per word when the example repeats four words in a row of its own meaning
 *   (`exampleLeaks`).
 * - `fewer_pairs` (easier; match): a match of fewer words taken from words NOT in this item, no extra meaning,
 *   ungraded, then the full item back.
 * - `tag_word_kinds` (legend; fill_blank, when the choices are of two kinds or more): each choice shows its kind of
 *   word (noun, verb, adjective). The blank's kind is never shown.
 * - `show_meanings` (meaning; fill_blank, context): under each choice, what it means, with every choice word blanked
 *   out of the meanings (`maskWords`), so no meaning names a choice.
 * - `drop_choice` (custom: a removed choice is assisted work, user ruling 09-27; fill_blank, context): greys out one
 *   wrong choice the learner has not tapped, another kind of word or an unrelated word first; never leaves fewer than
 *   two untried choices.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { CHOICE_MISSES, MATCH_MISSES } from './vocabularyExplorer.card';
import {
  asCheck, emptyWork, isRelated, maskWords, meaningOrder, pickPairs, posOf, seededRng, shuffle, VOCAB_MISSES, vocabMiss,
  type ChoiceItem, type MatchItem, type VocabCheck, type VocabItem, type VocabMiss, type VocabMode, type VocabTerm,
} from './vocabularyExplorerWorkspace';

export const EXAMPLES_LEVER = 'show_examples';
export const FEWER_LEVER = 'fewer_pairs';
export const KINDS_LEVER = 'tag_word_kinds';
export const MEANINGS_LEVER = 'show_meanings';
export const DROP_LEVER = 'drop_choice';

/** The lever set's context, the lever state of the item on screen: the choices greyed out and the choices tapped wrong. */
export interface VocabLeverContext { dropped: readonly string[]; picked: readonly string[] }
/** Per item: the levers pulled, beside the context. */
export interface VocabLeverState extends VocabLeverContext { pulled: readonly string[] }
export const NO_LEVERS: VocabLeverState = { pulled: [], dropped: [], picked: [] };

const term = (bank: readonly VocabTerm[], id: string) => bank.find(t => t.id === id);
const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];

/** An example sentence that repeats four words in a row of its own meaning states the meaning: not shown. */
export function exampleLeaks(t: VocabTerm): boolean {
  const ex = ` ${words(t.exampleSentence ?? '').join(' ')} `, def = words(t.definition ?? '');
  if (!ex.trim()) return true;
  for (let i = 0; i + 4 <= def.length; i++) if (ex.includes(` ${def.slice(i, i + 4).join(' ')} `)) return true;
  return false;
}

/** show_examples: the example under each word of the match, where one may be shown. */
export function examplesShown(item: MatchItem, bank: readonly VocabTerm[]): Array<{ id: string; word: string; example: string }> {
  return item.terms.map(id => term(bank, id)).filter((t): t is VocabTerm => !!t && !exampleLeaks(t))
    .map(t => ({ id: t.id, word: t.word, example: t.exampleSentence.trim() }));
}

/** show_meanings: each choice's meaning, with every choice word blanked out. */
export function meaningsShown(item: ChoiceItem, bank: readonly VocabTerm[]): Array<{ id: string; word: string; meaning: string }> {
  const all = item.options.map(o => term(bank, o)?.word ?? '').filter(Boolean);
  return item.options.map(o => term(bank, o)).filter((t): t is VocabTerm => !!t)
    .map(t => ({ id: t.id, word: t.word, meaning: maskWords(t.definition, all) }));
}

/** tag_word_kinds is offered only where the choices are of two kinds or more (else it changes nothing). */
export const kindsDiffer = (item: ChoiceItem, bank: readonly VocabTerm[], dropped: readonly string[] = []) =>
  new Set(item.options.filter(o => !dropped.includes(o)).map(o => posOf(term(bank, o) ?? { partOfSpeech: '' })).filter(Boolean)).size >= 2;

/**
 * The wrong choice `drop_choice` greys out now, or null when none may go: fewer than two untried choices would
 * remain. Another kind of word first, then an unrelated word, then the last untried one.
 */
export function farChoice(item: ChoiceItem, bank: readonly VocabTerm[], s: VocabLeverContext): string | null {
  const live = item.options.filter(o => !s.dropped.includes(o));
  const tried = new Set(s.picked.filter(p => live.includes(p))).size;
  if (live.length - 1 - tried < 2) return null;
  const key = term(bank, item.term);
  const foils = live.filter(o => o !== item.term && !s.picked.includes(o));
  if (!key) return foils.at(-1) ?? null;
  const rank = (o: string) => {
    const t = term(bank, o);
    return t ? (posOf(t) !== posOf(key) ? 0 : 2) + (isRelated(key, t) ? 1 : 0) : 9;
  };
  return [...foils].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

// ── Simplify: a smaller match of other words ─────────────────────────────────────────────

const PRACTICE = '~simpler';
export const isPractice = (item: Pick<VocabItem, 'id'>) => item.id.endsWith(PRACTICE);
export const practiceParent = (id: string) => (id.endsWith(PRACTICE) ? id.slice(0, -PRACTICE.length) : null);

/** A match of one pair fewer (at least two), no extra meaning, from words not in this item; null if too few. */
export function simplerMatch(item: VocabItem, bank: readonly VocabTerm[]): MatchItem | null {
  if (item.kind !== 'match' || isPractice(item)) return null;
  const rng = seededRng(item.id);
  const outside = shuffle(bank.filter(t => !item.defs.includes(t.id)), rng);
  const picks = pickPairs(outside, item.terms.length - 1);
  if (picks.length < 2) return null;
  const terms = picks.map(t => t.id);
  return { id: `${item.id}${PRACTICE}`, kind: 'match', terms, defs: meaningOrder(terms, terms, rng) };
}

// ── The lever set ────────────────────────────────────────────────────────────────────────

const choiceOf = (c: VocabCheck): ChoiceItem | null => (c.kind === 'match' || isPractice(c) ? null : c);
const matchOf = (c: VocabCheck): MatchItem | null => (c.kind === 'match' && !isPractice(c) ? c : null);
const clip = (x: string) => (x.length > 480 ? `${x.slice(0, 479)}…` : x);

export const VOCAB_LEVERS = leverSet<VocabCheck, VocabLeverContext>({
  modeOf: c => c.mode,
  missesOf: mode => VOCAB_MISSES[mode as VocabMode] ?? [],
  // A meaning lever may never name the item's spoken key: its word.
  answersOf: c => (c.kind === 'match' ? [] : [term(c.bank, c.term)?.word ?? ''].filter(Boolean)),
  specs: [
    { id: EXAMPLES_LEVER, type: 'legend', modes: ['explore', 'recall'], answers: MATCH_MISSES,
      when: 'The learner pairs words with the wrong meanings, or does not know where to start.',
      does: 'Shows under each word the example sentence from its word card, the word used in a sentence. It shows no meaning and no pair.',
      content: c => { const m = matchOf(c); const shown = m ? examplesShown(m, c.bank) : []; return shown.length ? shown : null; },
      fact: (shown: ReturnType<typeof examplesShown>, c) => clip(`Under ${shown.length === (c as MatchItem).terms.length ? 'each word' : 'some words'}, `
        + `the example sentence from its word card is shown: ${shown.map(e => `under "${e.word}", "${e.example}"`).join('; ')}.`) },
    { id: FEWER_LEVER, type: 'easier', modes: ['explore', 'recall'], answers: MATCH_MISSES,
      when: 'The learner cannot hold this many pairs at once.',
      does: 'Opens a smaller match of other words from the cards, with no extra meaning. It is not graded; this match comes back after it.',
      content: c => { const m = matchOf(c); const s = m ? simplerMatch(m, c.bank) : null; return s ? asCheck(s, c.mode, c.bank) : null; } },
    { id: KINDS_LEVER, type: 'legend', modes: ['recall', 'apply'], answers: ['wrong_kind_of_word'],
      when: 'The learner picks a word that does not fit the sentence as a kind of word.',
      does: 'Labels each choice with its kind of word (noun, verb, adjective). It does not say what kind the blank needs; never say it either (an action word, a thing): ask the learner.',
      content: c => { const i = choiceOf(c); return i && i.kind === 'fill_blank' ? i : null; },
      offer: (c, { dropped }) => c.kind !== 'match' && kindsDiffer(c, c.bank, dropped),
      fact: (i: ChoiceItem, c, { dropped }) => `Each choice is labeled with its kind of word: ${i.options.filter(o => !dropped.includes(o))
        .map(o => { const t = term(c.bank, o); return t ? `${t.word} (${posOf(t) || 'word'})` : o; }).join(', ')}.` },
    { id: MEANINGS_LEVER, type: 'meaning', carrier: 'shown', modes: ['recall', 'apply'], answers: CHOICE_MISSES,
      when: 'The learner picks a word whose meaning does not fit, or is unsure what the choices mean.',
      does: 'Shows under each choice what it means, with the choice words blanked out of the meanings. It does not say which meaning fits; never describe the one to look for.',
      content: c => { const i = choiceOf(c); return i ? meaningsShown(i, c.bank) : null; },
      // By the choice's number: a line that named its word would name the key under the key's own meaning.
      fact: (shown: ReturnType<typeof meaningsShown>, c, { dropped }) => clip('Under each choice, what it means is shown, with the choice words blanked out: '
        + `${shown.filter(m => !dropped.includes(m.id)).map(m => `under choice ${(c as ChoiceItem).options.indexOf(m.id) + 1}, "${m.meaning}"`).join('; ')}.`) },
    { id: DROP_LEVER, type: 'custom', carrier: 'shown', modes: ['recall', 'apply'], answers: CHOICE_MISSES,
      why: 'It narrows this item in place (one wrong choice greyed out) rather than opening a practice item.',
      when: 'The learner still picks a wrong word after help, or is stuck between too many.',
      does: 'Greys out one wrong choice the learner has not tapped, so fewer remain. The next answer counts as helped.',
      // Offered while one more can be greyed out; once pulled, its fact names every greyed-out choice.
      content: choiceOf,
      offer: (c, ctx) => c.kind !== 'match' && (ctx.dropped.length > 0 || farChoice(c, c.bank, ctx) !== null),
      fact: (i: ChoiceItem, c, { dropped }) => dropped.filter(d => i.options.includes(d))
        .map(d => `Choice ${i.options.indexOf(d) + 1}, "${term(c.bank, d)?.word ?? d}", is greyed out and is not the answer.`).join(' ') },
  ],
});

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: VocabItem, bank: readonly VocabTerm[]): VocabMiss[] {
  const out = new Set<VocabMiss>();
  if (item.kind === 'match') {
    const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));
    // Every way to give each word a different meaning from the column.
    const choose = (pool: string[], k: number): string[][] => (k === 0 ? [[]] : pool.flatMap((p, i) => choose(pool.slice(i + 1), k - 1).map(c => [p, ...c])));
    for (const set of choose(item.defs, item.terms.length)) for (const p of perms(set)) {
      const m = vocabMiss(item, { ...emptyWork(), pairs: Object.fromEntries(item.terms.map((t, i) => [t, p[i]])) }, bank);
      if (m) out.add(m);
    }
    return Array.from(out);
  }
  for (const o of item.options) { const m = vocabMiss(item, { ...emptyWork(), picked: o }, bank); if (m) out.add(m); }
  return Array.from(out);
}
