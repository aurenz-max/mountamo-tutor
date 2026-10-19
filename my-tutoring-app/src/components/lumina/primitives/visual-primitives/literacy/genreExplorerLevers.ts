/**
 * The in-item levers on genre-explorer, as one lever set (`bossLevers.ts`; `/add-support-tiers`, table
 * `qa/support-levers/genre-explorer-lever-table-2026-10-03.md`). Three actions over the session's texts: a yes/no about
 * one text (check-feature), which of two texts (pick-excerpt), and the kind of writing from the printed menu
 * (name-genre). The modes are the actions' mix: identify_basic and classify_genre ask check-feature then name-genre,
 * compare_genres asks pick-excerpt then name-genre.
 *
 * - check-feature: `read_again` (band floor only), `sentence_rows`, `text_model`.
 * - pick-excerpt: `two_checks`, `read_again` (band floor only), `pair_model`.
 * - name-genre: `kind_pair_model` (two sibling kinds, both off the session menu), `read_glosses`; simplify
 *   `two_far_kinds` (a practice text named from two far kinds, both off the menu). identify_basic gets `read_glosses`
 *   only: any genre model on a two-item menu answers by elimination.
 *
 * Nothing marks evidence in the learner's text, and no model or practice text is a session text. Models come from the
 * hand-written pool `genreModels.ts`. The tier is where the levers start (`startingLevers`): a starting lever is drawn
 * from the first render and never offered as a pull.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { genreExplorerCard } from './genreExplorer.card';
import { BINARY_BUCKET, GENRE_ALTERNATES, GENRE_GLOSS, GENRE_LABEL, GENRE_SIBLING, isReadableAloud, itemsFromPayload, speechSafe,
  type GenreExplorerItem, type GenreExplorerPayloadLike, type GenreId, type ResolvedExcerpt } from './genreExplorerDomain';
import { GENRE_MODELS, type GenreModel } from './genreModels';

export const READ_AGAIN_LEVER = 'read_again';
export const ROWS_LEVER = 'sentence_rows';
export const TEXT_MODEL_LEVER = 'text_model';
export const TWO_CHECKS_LEVER = 'two_checks';
export const PAIR_MODEL_LEVER = 'pair_model';
export const GLOSSES_LEVER = 'read_glosses';
export const KIND_PAIR_LEVER = 'kind_pair_model';
export const FAR_KINDS_LEVER = 'two_far_kinds';
export const PRACTICE_SUFFIX = '~simpler';

const seedOf = (id: string) => Array.from(id).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
const pick = <T>(list: readonly T[], seed: number): T | null => (list.length ? list[seed % list.length] : null);
const low = (s: string) => s.toLowerCase();
const STOP = new Set(['have', 'that', 'this', 'with', 'about', 'tell', 'does', 'your', 'from', 'they', 'them', 'what', 'some']);
const contentWords = (s: string) => new Set((low(s).match(/[a-z]+/g) ?? []).filter(w => w.length >= 4 && !STOP.has(w)));
const idOfLabel = (label: string) => (Object.keys(GENRE_LABEL) as GenreId[]).find(id => GENRE_LABEL[id] === label) ?? null;

/** One sentence per row: the text in order, nothing styled from the key. */
export const sentenceRows = (text: string): string[] => text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

/** What a lever reads beyond the item: the session's items, texts and menu. */
export interface GenreSession { items: readonly GenreExplorerItem[]; excerpts: readonly ResolvedExcerpt[]; menu: readonly string[]; readsAloud: boolean }

export const genreSession = (data: GenreExplorerPayloadLike): GenreSession => {
  const { items, excerpts, menu, readsAloud } = itemsFromPayload(data);
  return { items, excerpts, menu, readsAloud };
};

const menuIds = (s: GenreSession) => s.menu.map(idOfLabel).filter((x): x is GenreId => !!x);
/** A pool text is the learner's material: the same text, or its feature words in a session predicate. */
export const modelLeak = (p: GenreModel, s: GenreSession): boolean => {
  if (s.excerpts.some(e => low(e.text) === low(p.text))) return true;
  const used = new Set(s.items.flatMap(i => Array.from(contentWords(i.predicate))));
  if (Array.from(contentWords(p.predicate)).some(w => used.has(w))) return true;
  // The model predicate may not say a menu kind in other words ("a true story" on a Biography menu).
  return menuIds(s).some(id => GENRE_ALTERNATES[id].some(alt => low(p.predicate).includes(low(alt))));
};
const offMenu = (s: GenreSession) => { const on = new Set(menuIds(s)); return (k: GenreId) => !on.has(k); };

// ── the models ───────────────────────────────────────────────────────────────

/** check-feature: one pool text, its feature asked and answered "yes", evidence underlined. Off-menu kinds first. */
export function textModelFor(item: GenreExplorerItem, s: GenreSession): GenreModel | null {
  if (item.action !== 'check-feature') return null;
  const ok = GENRE_MODELS.filter(p => !modelLeak(p, s));
  const off = ok.filter(p => offMenu(s)(p.kind));
  return pick(off.length ? off : ok, seedOf(item.id));
}

/** pick-excerpt: two pool texts, the feature true of exactly one (the other from the other side of fiction/nonfiction). */
export function pairModelFor(item: GenreExplorerItem, s: GenreSession): [GenreModel, GenreModel] | null {
  if (item.action !== 'pick-excerpt') return null;
  const ok = GENRE_MODELS.filter(p => !modelLeak(p, s));
  const a = pick(ok, seedOf(item.id));
  if (!a) return null;
  const side = BINARY_BUCKET[a.kind];
  const b = pick(ok.filter(p => p.kind !== a.kind && BINARY_BUCKET[p.kind] && BINARY_BUCKET[p.kind] !== side
    && !low(p.text).includes(low(a.evidence))), seedOf(item.id) + 1);
  return b ? [a, b] : null;
}

const isBinary = (item: GenreExplorerItem) => item.choices.length > 0 && item.choices.every(c => c === 'Fiction' || c === 'Nonfiction');

/** name-genre on a menu of specific kinds: a sibling pair of kinds, both off the session menu, each with its clue underlined. */
export function kindPairFor(item: GenreExplorerItem, s: GenreSession): [GenreModel, GenreModel] | null {
  if (item.action !== 'name-genre' || isBinary(item)) return null;
  const off = offMenu(s);
  const pairs: Array<[GenreModel, GenreModel]> = [];
  for (const a of GENRE_MODELS) for (const sib of GENRE_SIBLING[a.kind] ?? []) {
    const b = GENRE_MODELS.find(p => p.kind === sib);
    if (b && off(a.kind) && off(b.kind) && a.kind < b.kind && !modelLeak(a, s) && !modelLeak(b, s)
      && !pairs.some(([x, y]) => x.kind === a.kind && y.kind === b.kind)) pairs.push([a, b]);
  }
  return pick(pairs, seedOf(item.id));
}

// ── two_far_kinds ────────────────────────────────────────────────────────────

/** The practice item: a pool text named from two far kinds, both off the menu. Its text rides on `practiceText`. */
export function farKindsFor(item: GenreExplorerItem, s: GenreSession): GenreExplorerItem | null {
  if (item.action !== 'name-genre' || isBinary(item)) return null;
  const off = offMenu(s);
  const texts = GENRE_MODELS.filter(p => off(p.kind) && BINARY_BUCKET[p.kind] && !modelLeak(p, s));
  for (let k = 0; k < texts.length; k++) {
    const p = pick(texts, seedOf(item.id) + k)!;
    const foil = pick((Object.keys(GENRE_LABEL) as GenreId[]).filter(id => off(id) && id !== 'fiction' && id !== 'nonfiction'
      && BINARY_BUCKET[id] && BINARY_BUCKET[id] !== BINARY_BUCKET[p.kind] && !(GENRE_SIBLING[p.kind] ?? []).includes(id)
      && !(GENRE_SIBLING[id] ?? []).includes(p.kind)), seedOf(item.id));
    if (!foil) continue;
    const kinds: GenreId[] = seedOf(item.id) % 2 ? [p.kind, foil] : [foil, p.kind];
    const spoken = isReadableAloud(p.text) ? speechSafe(p.text) : '';
    return { ...item, id: `${item.id}${PRACTICE_SUFFIX}`, action: 'name-genre', answer: GENRE_LABEL[p.kind],
      choices: kinds.map(k2 => GENRE_LABEL[k2]), choiceNotes: kinds.map(k2 => GENRE_GLOSS[k2]), excerptIndex: -1,
      excerptOrdinal: 'this one', predicate: '', namesChoices: true, practiceText: p.text,
      readAloud: s.readsAloud && spoken ? `Listen to this one. ${spoken} ` : '' };
  }
  return null;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string, items: readonly GenreExplorerItem[]) =>
  items.find(i => `${i.id}${PRACTICE_SUFFIX}` === id) ?? null;

// ── the tier's starting levers ───────────────────────────────────────────────

/** Easy starts with the rows (check-feature), the two checks (pick-excerpt) and the menu marks read with the ask. */
export const startingLevers = (tier: string | undefined, item?: GenreExplorerItem | null): string[] =>
  tier !== 'easy' || !item ? [] : item.action === 'check-feature' ? [ROWS_LEVER]
    : item.action === 'pick-excerpt' ? [TWO_CHECKS_LEVER] : [GLOSSES_LEVER];

const notStarting = (id: string) => (item: GenreExplorerItem) => !startingLevers(item.tier, item).includes(id);

// ── the lever set ────────────────────────────────────────────────────────────

const textOf = (item: GenreExplorerItem, s: GenreSession) =>
  item.excerptIndex < 0 ? s.excerpts : s.excerpts.filter(e => e.index === item.excerptIndex);
/** The texts the tutor may read again: at the band floor, every shown text read aloud. */
const readable = (item: GenreExplorerItem, s: GenreSession) => {
  const shown = textOf(item, s);
  return s.readsAloud && shown.length > 0 && shown.every(e => !!e.spokenText) ? shown : null;
};

const FENCE = 'Read only the card the receipt names; never make up a model of your own. Never say what the model '
  + 'means for the text of the learner.';
const FEATURES = ['identify_basic', 'classify_genre'];
const SPECIFIC = ['classify_genre', 'compare_genres'];
type Mode = keyof typeof genreExplorerCard.modes;

const readAgain = (modes: string[], answers: string[], action: GenreExplorerItem['action']) => ({
  id: READ_AGAIN_LEVER, type: 'marks' as const, carrier: 'both' as const, modes, answers,
  offer: (item: GenreExplorerItem) => item.action === action,
  when: 'The learner has lost the text.',
  does: (item: GenreExplorerItem, s: GenreSession) => {
    const shown = textOf(item, s);
    return `Puts a speaker mark on the text. Once it is on screen, read ${shown.length > 1 ? 'both texts' : 'the whole text'} once more, `
      + `evenly and in order, stressing nothing: ${shown.map(e => `"${e.spokenText}"`).join(' then ')}`;
  },
  content: readable,
  fact: 'A speaker mark on the text: read it once more, evenly, all of it.',
});

const glossesFact = (item: GenreExplorerItem) => `A speaker mark on every menu card: read each label with its line, in order: ${item.choices
  .map((c, i) => `${c}, ${item.choiceNotes[i] || GENRE_GLOSS[idOfLabel(c) as GenreId] || ''}`).join(' ')}`;
const glosses = (modes: string[], answers: string[]) => ({
  id: GLOSSES_LEVER, type: 'marks' as const, carrier: 'both' as const, modes, answers,
  offer: (item: GenreExplorerItem) => item.action === 'name-genre' && item.choices.length > 0 && notStarting(GLOSSES_LEVER)(item),
  when: 'The learner names a kind that does not fit, or a kind not on the list.',
  does: 'Puts a speaker mark on every menu card. Once it is on screen, read every label with its printed line, in screen order, '
    + 'all of them, stressing none.',
  fact: (_c: unknown, item: GenreExplorerItem) => glossesFact(item),
});

/** Every lever of the family, by type, in the order the tutor sees them. */
export const GENRE_LEVERS = leverSet<GenreExplorerItem, GenreSession>({
  modeOf: item => item.mode,
  missesOf: mode => genreExplorerCard.modes[mode as Mode]?.misses ?? [],
  support: { tier: item => item.tier,
    different: item => (item.action === 'check-feature' ? 'another text with a different feature'
      : item.action === 'pick-excerpt' ? 'two other texts' : 'two other texts of two close kinds'),
    own: 'this text\'s answer' },
  specs: [
    { id: TWO_CHECKS_LEVER, type: 'marks', carrier: 'both', modes: ['compare_genres'], answers: ['other_text', 'said_both'],
      offer: item => item.action === 'pick-excerpt' && notStarting(TWO_CHECKS_LEVER)(item),
      when: 'The learner names the wrong text, or says both or neither.',
      does: 'Puts an empty check under each text. Ask the feature of one text at a time, then ask "which one?" again. Never answer either check.',
      fact: 'An empty check under each text: ask the feature of one text at a time, then "which one?".' },
    readAgain(FEATURES, ['opposite_verdict'], 'check-feature'),
    readAgain(['compare_genres'], ['other_text', 'said_both'], 'pick-excerpt'),
    { id: ROWS_LEVER, type: 'layout', modes: FEATURES, answers: ['opposite_verdict'],
      offer: item => item.action === 'check-feature' && notStarting(ROWS_LEVER)(item),
      when: 'The learner answers from what they expect, not from the words.',
      does: 'Redraws the text one sentence per row, every row marked the same. Ask the learner to check each line. Never say which row.',
      fact: 'The text redrawn one sentence per row, every row marked the same.' },
    { id: TEXT_MODEL_LEVER, type: 'model', modes: FEATURES, answers: ['opposite_verdict', 'said_feature_back'],
      when: 'The learner gives the wrong verdict or says the feature back.',
      does: 'Shows a card with another text and a different feature it has, its words underlined. Once it is on screen, say it as '
        + `"My turn: this one does ...", reading the underlined words. Never say yes or no about it. ${FENCE}`,
      content: textModelFor,
      fact: (m: GenreModel) => `A model card with another text: "${m.text}" It does ${m.predicate}: "${m.evidence}" is underlined. `
        + 'It is not the learner text.' },
    { id: PAIR_MODEL_LEVER, type: 'model', modes: ['compare_genres'], answers: ['other_text', 'said_both'],
      when: 'The learner still cannot tell which text has it.',
      does: `Shows a card with two other texts and a different feature found in only one, its words underlined. Once it is on screen, say it as "My turn". ${FENCE}`,
      content: pairModelFor,
      fact: (pm: [GenreModel, GenreModel]) => `A model card with two other texts; only the first ${pm[0].predicate}, "${pm[0].evidence}" underlined in it.` },
    { id: KIND_PAIR_LEVER, type: 'model', modes: SPECIFIC, answers: ['close_relative'],
      when: 'The learner names a kind close to the right one.',
      does: 'Shows a card with two other texts of two close kinds, neither on this menu, each with the words that tell them apart '
        + 'underlined and its kind named. Once it is on screen, say it as "My turn". Never link a model to the learner\'s text.',
      content: kindPairFor,
      fact: (kp: [GenreModel, GenreModel]) => `A model card with two other texts: ${kp.map(k => `${GENRE_LABEL[k.kind]} ("${k.evidence}" underlined)`).join(' and ')}. `
        + 'Neither kind is on this menu.' },
    glosses(['identify_basic'], ['close_relative']),
    glosses(SPECIFIC, ['other_genre', 'said_broad_kind']),
    { id: FAR_KINDS_LEVER, type: 'easier', modes: SPECIFIC, answers: ['close_relative', 'other_genre', 'said_broad_kind'],
      when: 'The learner still cannot name the kind after help.',
      does: 'Opens an easier practice text first, named from two kinds far apart, neither on this menu. Ask it. It is not graded; '
        + 'the full item comes back after it.',
      content: farKindsFor },
  ],
});
