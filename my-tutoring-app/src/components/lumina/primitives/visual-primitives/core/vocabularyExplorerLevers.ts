/**
 * The in-item levers on vocabulary-explorer (`/add-support-tiers`; report
 * qa/eval-reports/vocabulary-explorer-levers-2026-10-16.md). No real-learner evidence: the misses are what
 * `vocabMiss` observes; the failures behind them are documented (the catalog's commonStruggles: similar words
 * confused, example sentences not read, fill-in-the-blank) or inferred (a sentence's grammar not used, the extra
 * meaning not ruled out). Every lever starts released; `config.difficulty` changes the items, not the levers.
 *
 * - `show_examples` (help; match): under each word, its example sentence from its card (the word used in a
 *   sentence). Withheld per word when the example repeats four words in a row of its own meaning (`exampleLeaks`).
 * - `fewer_pairs` (simplify; match): a match of fewer words taken from words NOT in this item, no extra meaning,
 *   ungraded, then the full item back.
 * - `tag_word_kinds` (help; fill_blank, when the choices are of two kinds or more): each choice shows its kind of
 *   word (noun, verb, adjective). The blank's kind is never shown.
 * - `show_meanings` (help; fill_blank, context): under each choice, what it means, with every choice word blanked out
 *   of the meanings (`maskWords`), so no meaning names a choice.
 * - `drop_choice` (simplify; fill_blank, context): greys out one wrong choice the learner has not tapped, another
 *   kind of word or an unrelated word first; never leaves fewer than two untried choices.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import {
  CHOICE_MISSES, emptyWork, isRelated, MATCH_MISSES, maskWords, meaningOrder, pickPairs, posOf, seededRng,
  shuffle, vocabMiss, type ChoiceItem, type ChoiceMiss, type MatchItem, type VocabItem, type VocabMiss, type VocabTerm,
} from './vocabularyExplorerWorkspace';

export const EXAMPLES_LEVER = 'show_examples';
export const FEWER_LEVER = 'fewer_pairs';
export const KINDS_LEVER = 'tag_word_kinds';
export const MEANINGS_LEVER = 'show_meanings';
export const DROP_LEVER = 'drop_choice';

/** Per item: the levers pulled, the choices greyed out, and the choices tapped wrong. */
export interface VocabLeverState { pulled: readonly string[]; dropped: readonly string[]; picked: readonly string[] }
export const NO_LEVERS: VocabLeverState = { pulled: [], dropped: [], picked: [] };

const term = (bank: VocabTerm[], id: string) => bank.find(t => t.id === id);
const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];

/** An example sentence that repeats four words in a row of its own meaning states the meaning: not shown. */
export function exampleLeaks(t: VocabTerm): boolean {
  const ex = ` ${words(t.exampleSentence ?? '').join(' ')} `, def = words(t.definition ?? '');
  if (!ex.trim()) return true;
  for (let i = 0; i + 4 <= def.length; i++) if (ex.includes(` ${def.slice(i, i + 4).join(' ')} `)) return true;
  return false;
}

/** show_examples: the example under each word of the match, where one may be shown. */
export function examplesShown(item: MatchItem, bank: VocabTerm[]): Array<{ id: string; word: string; example: string }> {
  return item.terms.map(id => term(bank, id)).filter((t): t is VocabTerm => !!t && !exampleLeaks(t))
    .map(t => ({ id: t.id, word: t.word, example: t.exampleSentence.trim() }));
}

/** show_meanings: each choice's meaning, with every choice word blanked out. */
export function meaningsShown(item: ChoiceItem, bank: VocabTerm[]): Array<{ id: string; word: string; meaning: string }> {
  const all = item.options.map(o => term(bank, o)?.word ?? '').filter(Boolean);
  return item.options.map(o => term(bank, o)).filter((t): t is VocabTerm => !!t)
    .map(t => ({ id: t.id, word: t.word, meaning: maskWords(t.definition, all) }));
}

/** tag_word_kinds is offered only where the choices are of two kinds or more (else it changes nothing). */
export const kindsDiffer = (item: ChoiceItem, bank: VocabTerm[], dropped: readonly string[] = []) =>
  new Set(item.options.filter(o => !dropped.includes(o)).map(o => posOf(term(bank, o) ?? { partOfSpeech: '' })).filter(Boolean)).size >= 2;

/**
 * The wrong choice `drop_choice` greys out now, or null when none may go: fewer than two untried choices would
 * remain. Another kind of word first, then an unrelated word, then the last untried one.
 */
export function farChoice(item: ChoiceItem, bank: VocabTerm[], s: VocabLeverState): string | null {
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
export function simplerMatch(item: VocabItem, bank: VocabTerm[]): MatchItem | null {
  if (item.kind !== 'match' || isPractice(item)) return null;
  const rng = seededRng(item.id);
  const outside = shuffle(bank.filter(t => !item.defs.includes(t.id)), rng);
  const picks = pickPairs(outside, item.terms.length - 1);
  if (picks.length < 2) return null;
  const terms = picks.map(t => t.id);
  return { id: `${item.id}${PRACTICE}`, kind: 'match', terms, defs: meaningOrder(terms, terms, rng) };
}

// ── Levers on the current item ───────────────────────────────────────────────────────────

const lever = (id: string, kind: WorkspaceLever['kind'], s: VocabLeverState, answers: readonly VocabMiss[], when: string, does: string): WorkspaceLever =>
  ({ id, kind, carrier: 'shown', pulled: s.pulled.includes(id), answers, when, does });

/** The levers on the current session item. A practice item has none. */
export function vocabLevers(item: VocabItem | undefined, bank: VocabTerm[], s: VocabLeverState): WorkspaceLever[] {
  if (!item || isPractice(item)) return [];
  const out: WorkspaceLever[] = [];
  if (item.kind === 'match') {
    if (examplesShown(item, bank).length) {
      out.push(lever(EXAMPLES_LEVER, 'help', s, MATCH_MISSES, 'The learner pairs words with the wrong meanings, or does not know where to start.',
        'Shows under each word the example sentence from its word card, the word used in a sentence. It shows no meaning and no pair.'));
    }
    if (simplerMatch(item, bank)) {
      out.push(lever(FEWER_LEVER, 'simplify', s, MATCH_MISSES, 'The learner cannot hold this many pairs at once.',
        'Opens a smaller match of other words from the cards, with no extra meaning. It is not graded; this match comes back after it.'));
    }
    return out;
  }
  if (item.kind === 'fill_blank' && kindsDiffer(item, bank, s.dropped)) {
    out.push(lever(KINDS_LEVER, 'help', s, ['wrong_kind_of_word'] satisfies ChoiceMiss[], 'The learner picks a word that does not fit the sentence as a kind of word.',
      'Labels each choice with its kind of word (noun, verb, adjective). It does not say what kind the blank needs; never say it either (an action word, a thing): ask the learner.'));
  }
  out.push(lever(MEANINGS_LEVER, 'help', s, CHOICE_MISSES, 'The learner picks a word whose meaning does not fit, or is unsure what the choices mean.',
    'Shows under each choice what it means, with the choice words blanked out of the meanings. It does not say which meaning fits; never describe the one to look for.'));
  const dropPulled = s.pulled.includes(DROP_LEVER);
  if (dropPulled || farChoice(item, bank, s)) {
    out.push(lever(DROP_LEVER, 'simplify', s, CHOICE_MISSES, 'The learner still picks a wrong word after help, or is stuck between too many.',
      'Greys out one wrong choice the learner has not tapped, so fewer remain. The next answer counts as helped.'));
  }
  return out;
}

/** What the pulled levers put on screen, as scene facts. Never which word or meaning is the answer. */
export function leverFacts(item: VocabItem | undefined, bank: VocabTerm[], s: VocabLeverState): Record<string, string> {
  if (!item || isPractice(item)) return {};
  const facts: Record<string, string> = {};
  const cap = (x: string) => (x.length > 480 ? `${x.slice(0, 479)}…` : x);
  if (item.kind === 'match') {
    if (s.pulled.includes(EXAMPLES_LEVER)) {
      const shown = examplesShown(item, bank);
      facts.onScreen = `Under ${shown.length === item.terms.length ? 'each word' : 'some words'}, the example sentence from its word card is shown.`;
      shown.forEach((e, i) => { facts[`example${i + 1}`] = cap(`Under "${e.word}": "${e.example}"`); });
    }
    return facts;
  }
  const parts: string[] = [];
  if (s.pulled.includes(KINDS_LEVER)) {
    parts.push(`Each choice is labeled with its kind of word: ${item.options.filter(o => !s.dropped.includes(o))
      .map(o => { const t = term(bank, o); return t ? `${t.word} (${posOf(t) || 'word'})` : o; }).join(', ')}.`);
  }
  if (s.pulled.includes(MEANINGS_LEVER)) {
    parts.push('Under each choice, what it means is shown, with the choice words blanked out.');
    meaningsShown(item, bank).filter(m => !s.dropped.includes(m.id))
      .forEach((m, i) => { facts[`meaning${i + 1}`] = cap(`Under "${m.word}": ${m.meaning}`); });
  }
  for (const d of s.dropped) {
    const i = item.options.indexOf(d);
    if (i >= 0) parts.push(`Choice ${i + 1}, "${term(bank, d)?.word ?? d}", is greyed out and is not the answer.`);
  }
  if (parts.length) facts.onScreen = parts.join(' ');
  return facts;
}

/** For tests: every miss this item's work can show. */
export function possibleMisses(item: VocabItem, bank: VocabTerm[]): VocabMiss[] {
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
