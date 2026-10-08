/**
 * word-flip `build_inflect` — open build (qa/open-build/ROADMAP.md, OB-8L). The learner MAKES an inflected word from
 * a base-word card and an ending card: "Make a word that means more than one" (cat + s, box + es, baby + ies) or
 * "Make a word that tells it already happened" (jump + ed). Many words pass; every second item asks for a second,
 * different word. It runs on word-builder's word-part surface (`WordBuildAffix.tsx`) with these rules.
 *
 * Who applies the spelling change: the LEARNER chooses it, the board writes it. The y-to-i change is the choice of
 * the "ies" ending for a word that ends in a consonant + y; the card then takes the place of the y, which the row shows
 * struck through (bab̶y̶ + ies). baby + s ("babys") and baby + es ("babyes") are the `missed_y_change` miss. The
 * doubled consonant (hop + p + ed) is not on this board: past-tense bases are add-only -ed verbs, as in `past_ed`.
 *
 * Judging: code first, then the shared word judge. Code checks the row's shape, that the ending does the ask's job
 * (s/es/ies for more than one, ed for already happened), that it fits the base (es after s, x, z, ch, sh; ies after a
 * consonant + y; s otherwise; no ed after a consonant + y or an e), and the base the ask names. A row that passes goes to `judgeWordBuild` (real word +
 * fits the ask): "jumps" for "more than one" or "boxed" for "already happened" is the judge's to read, not code's.
 *
 * Bases are code-owned (the generator's typed, code-validated pool); a base's kind is in its id (`noun-`, `verb-`).
 * Pure: the component, the generator, the live adapter, the oracle and the tests read the same rules.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  affixBuildAssignment, buildItemsFrom, describeAffixBuild, joined, pieces, type AffixBuildItem, type AffixBuildRules,
  type AffixBuildView, type BuildPart,
} from './affixBuild';
import { MODEL_PAIRS } from './wordFlipScript';

export type InflectAsk = 'plural' | 'past';

export interface InflectBuildItem extends AffixBuildItem {
  inflect: InflectAsk;
  /** Base ids the ask names ("Use a word that ends in y"); absent = any base. */
  bases?: string[];
  /** How the ask names those bases, for the frame lever and the miss words ("a word that ends in y"). */
  baseHint?: string;
}

export type InflectBuildMiss = 'base_only' | 'ending_only' | 'parts_out_of_order' | 'double_ending' | 'wrong_ending_kind'
  | 'other_base' | 'wrong_ending' | 'missed_y_change' | 'same_word' | 'not_a_word' | 'wrong_meaning';
export const INFLECT_BUILD_MISSES: readonly InflectBuildMiss[] = ['base_only', 'ending_only', 'parts_out_of_order',
  'double_ending', 'wrong_ending_kind', 'other_base', 'wrong_ending', 'missed_y_change', 'same_word', 'not_a_word', 'wrong_meaning'];

/** The four ending cards. No card prints a meaning: which ending does which job is the skill. */
export const ENDING_CARDS: readonly BuildPart[] = [
  { id: 'end-s', text: 's', type: 'suffix', meaning: '' },
  { id: 'end-es', text: 'es', type: 'suffix', meaning: '' },
  { id: 'end-ies', text: 'ies', type: 'suffix', meaning: '', replaces: 'y' },
  { id: 'end-ed', text: 'ed', type: 'suffix', meaning: '' },
];
const PLURAL_ENDINGS = new Set(['s', 'es', 'ies']);

/** The plural ending a base takes, by its spelling. */
export const pluralEndingFor = (word: string): 's' | 'es' | 'ies' =>
  /(s|x|z|ch|sh)$/i.test(word) ? 'es' : /[^aeiou]y$/i.test(word) ? 'ies' : 's';
export const isThing = (p: BuildPart) => p.type === 'root' && p.id.startsWith('noun-');
export const isAction = (p: BuildPart) => p.type === 'root' && p.id.startsWith('verb-');
export const basePart = (word: string, kind: 'noun' | 'verb', emoji: string): BuildPart =>
  ({ id: `${kind}-${word}`, text: word, type: 'root', meaning: emoji });

/** The code check: shape, the ending's job, the base the ask names, the ending's fit to the base, a word made twice. */
export function inflectMiss(item: InflectBuildItem, row: readonly BuildPart[], made: readonly string[] = []): InflectBuildMiss | undefined {
  const bases = row.filter(p => p.type === 'root');
  const endings = row.filter(p => p.type === 'suffix');
  if (!bases.length) return 'ending_only';
  if (bases.length > 1 || row.some(p => p.type === 'prefix')) return 'parts_out_of_order';
  if (!endings.length) return 'base_only';
  if (row[0].type !== 'root') return 'parts_out_of_order';
  if (endings.length > 1) return 'double_ending';
  const base = bases[0], ending = endings[0].text.toLowerCase();
  if ((item.inflect === 'plural') !== PLURAL_ENDINGS.has(ending)) return 'wrong_ending_kind';
  if (item.bases?.length && !item.bases.includes(base.id)) return 'other_base';
  if (item.inflect === 'plural') {
    const want = pluralEndingFor(base.text);
    if (ending !== want) return want === 'ies' ? 'missed_y_change' : 'wrong_ending';
  } else if (/([^aeiou]y|e)$/i.test(base.text)) {
    // baby + ed, tree + ed: the right spelling changes the base (babied), which this board cannot make. The judge
    // passed "babyed" as a real word (labelled set, 10-08), so code says it.
    return 'not_a_word';
  }
  if (made.includes(joined(row))) return 'same_word';
  return undefined;
}

const partsOf = (ids: readonly string[], board: readonly BuildPart[]) => {
  const out = ids.map(id => board.find(p => p.id === id));
  return out.every(Boolean) ? out as BuildPart[] : null;
};

// ── The asks (code-owned) ───────────────────────────────────────────────────

const ASK = {
  plural: 'Make a word that means more than one.',
  past: 'Make a word that tells it already happened.',
  yesterday: 'Make a word that tells what someone did yesterday.',
};
const endsIn = (bases: readonly BuildPart[]) => Array.from(new Set(bases.map(b => b.text.match(/(ch|sh|s|x|z|y)$/)?.[1] ?? '')))
  .filter(Boolean).join(' or ');

/** Every base on the board with its fitting ending: the examples an ask can list. */
const examplesFor = (board: readonly BuildPart[], inflect: InflectAsk, bases?: readonly BuildPart[]) => {
  const ending = (text: string) => ENDING_CARDS.find(e => e.text === text)!.id;
  const pool = bases ?? board.filter(inflect === 'plural' ? isThing : isAction);
  return pool.map(b => [b.id, ending(inflect === 'plural' ? pluralEndingFor(b.text) : 'ed')]);
};

/**
 * The session's asks for a board, in order: more than one, already happened, more than one from the y words, more
 * than one from the s/x/ch/sh words, what someone did yesterday. With every second item asking for two words, the
 * two-word items are "already happened" and the s/x/ch/sh plural. An ask with fewer than two fitting bases is left out.
 */
export function inflectAsksFor(board: readonly BuildPart[]): InflectBuildItem[] {
  const things = board.filter(isThing);
  const yWords = things.filter(b => pluralEndingFor(b.text) === 'ies');
  const esWords = things.filter(b => pluralEndingFor(b.text) === 'es');
  const restricted = (id: string, group: BuildPart[]): InflectBuildItem[] => group.length < 2 ? [] : [{
    id, inflect: 'plural', ways: 1, bases: group.map(b => b.id), baseHint: `a word that ends in ${endsIn(group)}`,
    ask: `Make a word that means more than one. Use a word that ends in ${endsIn(group)}.`,
    examples: examplesFor(board, 'plural', group) }];
  return [
    { id: 'f1', inflect: 'plural', ways: 1, ask: ASK.plural, examples: examplesFor(board, 'plural') },
    { id: 'f2', inflect: 'past', ways: 1, ask: ASK.past, examples: examplesFor(board, 'past') },
    ...restricted('f3', yWords),
    ...restricted('f4', esWords),
    { id: 'f5', inflect: 'past', ways: 1, ask: ASK.yesterday, examples: examplesFor(board, 'past') },
  ];
}

/** An item the code check can run: a known ask kind, named bases on the board, and every example passing the check. */
const inflectable = (item: InflectBuildItem, board: readonly BuildPart[]) =>
  (item.inflect === 'plural' || item.inflect === 'past')
  && (!item.bases || item.bases.every(id => board.some(p => p.id === id && p.type === 'root')))
  && (item.examples ?? []).every(ids => { const parts = partsOf(ids, board); return !!parts && !inflectMiss(item, parts); });

/** The session's items: inflectable, then the shared gate (askable, distinct asks, every second one two words). */
export const inflectItemsFrom = (raw: readonly AffixBuildItem[], board: readonly BuildPart[], tier?: string) =>
  buildItemsFrom((raw as InflectBuildItem[]).filter(i => !!i && inflectable(i, board)), board, tier) as InflectBuildItem[];

// ── Words ───────────────────────────────────────────────────────────────────

/** What a miss says on screen, never a word that passes. */
export function inflectMissWords(miss: string | undefined, item: AffixBuildItem): string {
  const it = item as InflectBuildItem;
  switch (miss as InflectBuildMiss | undefined) {
    case 'base_only': return 'That word has no ending yet. Which ending makes it mean what the ask says?';
    case 'ending_only': return 'An ending needs a word to go on. Pick a word card first.';
    case 'parts_out_of_order': return 'Put one word card first, then one ending after it.';
    case 'double_ending': return 'That word has two endings. Use just one ending.';
    case 'wrong_ending_kind': return it.inflect === 'plural'
      ? 'That ending tells something already happened. The ask wants more than one.'
      : 'That ending makes more than one. The ask wants something that already happened.';
    case 'other_base': return `Read the ask again: use ${it.baseHint ?? 'the word it asks for'}.`;
    case 'wrong_ending': return 'That ending does not fit this word. Look at how the word ends, then try another ending.';
    case 'missed_y_change': return 'This word ends in y. A word like that changes when there is more than one. Which ending does that?';
    case 'same_word': return 'You already made that word. Make a different one.';
    case 'not_a_word': return 'Hmm, that is not a word we use. Try a different word or ending.';
    case 'wrong_meaning': return 'That is a real word, but it does not mean what the ask says. Read the ask again.';
    default: return 'Not quite. Try again.';
  }
}

const cardList = (board: readonly BuildPart[]) => board.map(p => p.type === 'root'
  ? `${p.text} (word, ${p.meaning})` : `${p.text} (ending${p.replaces ? `, takes the place of a last ${p.replaces}` : ''})`).join(', ');

export function inflectBuildScene(item: AffixBuildItem, board: readonly BuildPart[], view: AffixBuildView, said?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: item.ask,
    board: cardList(board),
    row: view.row.length ? pieces(view.row) : 'empty',
    partsPlaced: view.row.length,
    endingsPlaced: view.row.filter(p => p.type === 'suffix').length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: view.made.length, madeBefore: view.made.join(', ') || 'none' } : {}),
    ...(said ? { inspectorSaid: said } : {}),
    constraints: 'The learner taps a word card and an ending card (s, es, ies, ed) into a row, taps a card in the row to '
      + 'take it out, and presses "I\'m done!". The ies card takes the place of a last y. Code checks that the ending '
      + 'does what the ask asks and fits the word (es after s, x, ch, sh; ies after a consonant and y; s otherwise; ed '
      + 'for already happened), then a judge checks it is a real word that fits the ask. Many words can pass. You cannot '
      + 'place or remove a card.',
  } };
}

// ── Levers (start bare: choosing the ending IS the task) ─────────────────────

export const FRAME_LEVER = 'word_frame';
export const CHART_LEVER = 'ending_chart';
export const FEWER_ENDINGS_LEVER = 'fewer_endings';

/** Solved words NOT on this board, one per ending: the rule shown on other words, never this item's word. */
export function endingChartFor(board: readonly BuildPart[]): [string, string][] {
  const onBoard = new Set(board.filter(p => p.type === 'root').map(p => p.text.toLowerCase()));
  const rows: [string, string][] = [];
  for (const [type, ending] of [['plural_s', 's'], ['plural_es', 'es'], ['plural_y', 'ies'], ['past_ed', 'ed']] as const) {
    const pair = MODEL_PAIRS[type].find(p => !onBoard.has(p.singular) && !onBoard.has(p.plural));
    if (pair) rows.push([`${pair.singular} + ${ending}`, pair.plural]);
  }
  return rows;
}

/** The easier practice item: the same ask, one word, two of its fitting bases, one other base, and only two endings. */
export function fewerEndingsFor(item: AffixBuildItem, board: readonly BuildPart[]): InflectBuildItem | null {
  const it = item as InflectBuildItem;
  const kept = it.examples.slice(0, 2).map(ids => partsOf(ids, board)).filter((p): p is BuildPart[] => !!p && p.length === 2);
  if (!kept.length) return null;
  const keepBases = kept.map(([b]) => b), keepEnds = Array.from(new Set(kept.map(([, e]) => e)));
  const distractor = board.find(p => p.type === 'suffix' && !keepEnds.includes(p) && p.text === (keepEnds[0].text === 's' ? 'es' : 's'));
  const exampleBases = new Set(it.examples.map(([b]) => b));
  const foil = board.find(p => p.type === 'root' && !exampleBases.has(p.id))
    ?? board.find(p => p.type === 'root' && !keepBases.includes(p));
  const small = [...keepBases, ...(foil ? [foil] : []), ...keepEnds, ...(distractor ? [distractor] : [])];
  if (small.filter(p => p.type === 'suffix').length >= board.filter(p => p.type === 'suffix').length) return null;
  return { ...it, id: `${it.id}~small`, ways: 1, examples: kept.map(parts => parts.map(p => p.id)), board: small };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly InflectBuildMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function inflectBuildLevers(item: AffixBuildItem | null, board: readonly BuildPart[], pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const judged: InflectBuildMiss[] = ['wrong_ending', 'missed_y_change', 'wrong_ending_kind', 'not_a_word', 'wrong_meaning'];
  return [
    lever(FRAME_LEVER, 'help', ['base_only', 'ending_only', 'parts_out_of_order', 'double_ending', 'other_base'],
      'The learner puts down a word with no ending, an ending alone, two endings, the ending first, or a word the ask did not name.',
      'Shows two empty boxes above the row, labelled word + ending (naming the kind of word when the ask names one). No card is filled in.',
      pulled),
    ...(endingChartFor(board).length ? [lever(CHART_LEVER, 'help', judged,
      'The learner picks an ending that does not fit the word or the ask, or misses that a word ending in y changes.',
      'Shows a chart of solved words that are NOT on this board, one for each ending (s, es, ies, ed), so the learner sees '
        + 'which ending each kind of word takes. It shares no word with this item.', pulled)] : []),
    ...(fewerEndingsFor(item, board) ? [lever(FEWER_ENDINGS_LEVER, 'simplify', judged,
      'The learner keeps picking endings that do not fit, or cannot start on the full board.',
      'Opens the same ask first on a smaller board: a few words and only two endings, one word to make. It is not graded; '
        + 'the full item comes back after it.', pulled)] : []),
  ];
}

export function inflectLeverFacts(pulled: readonly string[], item: AffixBuildItem, board: readonly BuildPart[]): string | undefined {
  const it = item as InflectBuildItem;
  const notes = [
    pulled.includes(FRAME_LEVER) && `Empty boxes above the row show a word shape: ${it.baseHint ?? 'word'} + ending.`,
    pulled.includes(CHART_LEVER) && `A chart of other words with their endings is shown: ${endingChartFor(board).map(([p, w]) => `${p} = ${w}`).join('; ')}.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export const inflectBuildRules: AffixBuildRules = {
  phase: { key: 'build_inflect', label: 'Make a word', icon: '🔁' },
  badge: '🔁 Make a word',
  summary: { heading: 'Words made!', celebration: 'You put endings on words to make new words.' },
  emptyRow: 'Tap a word, then an ending.',
  partLabel: { prefix: 'prefix', root: 'word', suffix: 'ending' },
  items: inflectItemsFrom,
  assignment: affixBuildAssignment,
  shapeMiss: (item, row, made) => inflectMiss(item as InflectBuildItem, row, made),
  missWords: inflectMissWords,
  judgeRequest: (item, view, board, grade) => ({
    ask: item.ask, made: joined(view.row), pieces: pieces(view.row),
    board: `words: ${board.filter(p => p.type === 'root').map(p => p.text).join(', ')}; endings: ${board.filter(p => p.type === 'suffix').map(p => p.text).join(', ')}`,
    ...(grade ? { grade } : {}),
  }),
  describe: describeAffixBuild,
  scene: inflectBuildScene,
  levers: inflectBuildLevers,
  leverFacts: inflectLeverFacts,
  smallBoardFor: fewerEndingsFor,
  frame: (item, _board, pulled) => pulled.includes(FRAME_LEVER)
    ? [{ type: 'root', label: (item as InflectBuildItem).baseHint ?? 'word' }, { type: 'suffix', label: 'ending' }] : [],
  panel: (_item, board, pulled) => pulled.includes(CHART_LEVER)
    ? { lever: 'ending-chart', heading: 'Other words', note: 'Each word with its ending', rows: endingChartFor(board) } : null,
};
