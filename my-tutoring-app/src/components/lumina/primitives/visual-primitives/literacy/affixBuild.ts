/**
 * word-builder `build_affix` — open build (qa/open-build/ROADMAP.md, OB-3L L1). The learner MAKES a word for a
 * meaning by tapping prefix, root and suffix cards into a row, then presses "I'm done!". There is no key: for "make a
 * word that means to do something again", replay, redo and rewrite all pass. The primitive's code checks the row's
 * shape (one root, prefixes before it, suffixes after it, not a word already made); the shared literacy judge
 * (`service/build-layer/word-build-judge.ts`, route `judgeWordBuild`) reads the word against the ask.
 *
 * A separate challenge type (contract-first fork): the spoken modes' "nothing on the board is tapped" (contract R1)
 * and their grade floors (R6) do not apply here. The scope follows the lesson's grade (user ruling R11, 10-07).
 *
 * Pure: the component, the generator, the live adapter and the tests read the same rules.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WordBuildJudgeRequest } from '../../../service/build-layer/wordBuildDecision';
import { POOL, type PoolWord } from './wordBuilderLevers';
import type { MorphemeType } from './wordBuilderScript';

export interface BuildPart { id: string; text: string; type: MorphemeType; meaning: string }

export interface AffixBuildItem {
  id: string;
  /** The task as said and printed: a meaning, never a word that passes. */
  ask: string;
  /** Two or more board words that fit the ask (part ids in order). Hidden; the gate, the oracle and the levers read them. */
  examples: string[][];
  /** How many different words the item asks for (every second item asks for two). */
  ways: 1 | 2;
  /** A simplify lever's practice item carries its own smaller board. */
  board?: BuildPart[];
}

/** A miss the row's shape shows (code) or the judge reads (`not_a_word`, `wrong_meaning`). */
export type AffixBuildMiss = 'root_only' | 'affix_only' | 'parts_out_of_order' | 'same_word' | 'not_a_word' | 'wrong_meaning';
export const AFFIX_BUILD_MISSES: readonly AffixBuildMiss[] =
  ['root_only', 'affix_only', 'parts_out_of_order', 'same_word', 'not_a_word', 'wrong_meaning'];

export const MAX_ASK_CHARS = 120;
const MAX_ROW = 4;
export const maxRow = MAX_ROW;

const ORDER: Record<MorphemeType, number> = { prefix: 0, root: 1, suffix: 2 };

/** The row's shape, checked in code before any judge: undefined when it is one root with affixes in place. */
export function affixShapeMiss(row: readonly BuildPart[], made: readonly string[] = []): AffixBuildMiss | undefined {
  const roots = row.filter(p => p.type === 'root').length;
  if (roots === 0) return 'affix_only';
  if (row.length === roots) return 'root_only';
  if (roots > 1 || row.some((p, i) => i > 0 && ORDER[p.type] < ORDER[row[i - 1].type])) return 'parts_out_of_order';
  if (made.includes(joined(row))) return 'same_word';
  return undefined;
}

export const joined = (row: readonly BuildPart[]) => row.map(p => p.text).join('').toLowerCase();
export const pieces = (row: readonly BuildPart[]) => row.map(p => p.text).join(' + ');

const partsOf = (ids: readonly string[], board: readonly BuildPart[]) => {
  const out = ids.map(id => board.find(p => p.id === id));
  return out.every(Boolean) ? out as BuildPart[] : null;
};

/**
 * The gate: an item ships only when its ask is a short sayable sentence that names no passing word, and at least two
 * different board words fit it with a proper shape. A broken item is DROPPED, never repaired (the word-builder rule).
 */
export function askableBuildItem(item: AffixBuildItem, board: readonly BuildPart[]): AffixBuildItem | null {
  const ask = (item?.ask ?? '').trim();
  if (!ask || ask.length > MAX_ASK_CHARS || /["_\n]/.test(ask) || /^\s*(yes|my turn)\b/i.test(ask)) return null;
  const words = new Set<string>();
  const examples: string[][] = [];
  for (const ids of item.examples ?? []) {
    const parts = partsOf(ids, board);
    if (!parts || parts.length < 2 || parts.length > MAX_ROW || affixShapeMiss(parts)) continue;
    const word = joined(parts);
    if (words.has(word)) continue;
    words.add(word); examples.push(ids);
  }
  const lower = ask.toLowerCase();
  if (examples.length < 2 || Array.from(words).some(w => new RegExp(`\\b${w}\\b`).test(lower))) return null;
  return { id: item.id, ask, examples, ways: item.ways === 2 ? 2 : 1 };
}

/** The session's items: askable, distinct asks, every second one asking for two words (none at the easy tier). */
export function buildItemsFrom(items: readonly AffixBuildItem[], board: readonly BuildPart[], tier?: string): AffixBuildItem[] {
  const seen = new Set<string>();
  return items.map(i => askableBuildItem(i, board)).filter((i): i is AffixBuildItem => {
    if (!i || seen.has(i.ask.toLowerCase())) return false;
    seen.add(i.ask.toLowerCase()); return true;
  }).map((i, n) => ({ ...i, id: i.id || `b${n + 1}`, ways: tier !== 'easy' && n % 2 === 1 ? 2 : 1 }));
}

const waysLine = (item: AffixBuildItem) => item.ways === 2 ? ' Then make a different word that means it too.' : '';

export const affixBuildAssignment = (item: AffixBuildItem): TeachingAssignment =>
  ({ id: item.id, task: `${item.ask}${waysLine(item)}`, response: 'gesture' });

export interface AffixBuildView { row: readonly BuildPart[]; made: readonly string[] }

/** The checked work, in the learner's terms. */
export const describeAffixBuild = (view: AffixBuildView) =>
  view.row.length ? `Built "${joined(view.row)}" (${pieces(view.row)})` : 'Built nothing';

/** The judge's request for this row. */
export const affixJudgeRequest = (item: AffixBuildItem, view: AffixBuildView, board: readonly BuildPart[],
  grade?: string): WordBuildJudgeRequest => ({
  ask: item.ask, made: joined(view.row), pieces: pieces(view.row),
  board: board.map(p => `${p.text} (${p.type}: ${p.meaning})`).join(', '), ...(grade ? { grade } : {}),
});

export function affixBuildScene(item: AffixBuildItem, board: readonly BuildPart[], view: AffixBuildView,
  inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: item.ask,
    board: board.map(p => `${p.text} (${p.type}, ${p.meaning})`).join(', '),
    row: view.row.length ? pieces(view.row) : 'empty',
    partsPlaced: view.row.length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: view.made.length, madeBefore: view.made.join(', ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'The learner taps word-part cards (each printed with its meaning) into a row to make a word for the ask, '
      + 'taps a card in the row to take it out, and presses "I\'m done!". The builder checks the row: one root, any '
      + 'prefix before it and suffix after it, then whether it is a real word that means what was asked. Many different '
      + 'words can pass. You cannot place or remove a card.',
  } };
}

// ── Levers (start bare: choosing the parts IS the task) ───────────────────────

export const FRAME_LEVER = 'part_frame';
export const MODEL_LEVER = 'model_word';
export const SMALL_BOARD_LEVER = 'small_board';

/** The shape the item's first example has, as empty typed boxes: never a part's text. */
export const frameFor = (item: AffixBuildItem, board: readonly BuildPart[]): MorphemeType[] =>
  (partsOf(item.examples[0] ?? [], board) ?? []).map(p => p.type);

/** A solved word that shares NO part text with the board: how a prefix or suffix changes a root, on another word. */
export function modelFor(board: readonly BuildPart[]): PoolWord | null {
  const onBoard = new Set(board.map(p => p.text.toLowerCase()));
  return POOL.everyday.find(w => w.parts.length === 2 && w.parts.every(([t]) => !onBoard.has(t.toLowerCase()))) ?? null;
}

/** The easier practice item: the same ask, one word, a board of the example parts plus one other card per type. */
export function smallBoardFor(item: AffixBuildItem, board: readonly BuildPart[]): AffixBuildItem | null {
  const used = new Set(item.examples.flat());
  const keep = board.filter(p => used.has(p.id));
  const foils = (['prefix', 'root', 'suffix'] as const).flatMap(t => board.filter(p => p.type === t && !used.has(p.id)).slice(0, 1));
  const small = [...keep, ...foils];
  if (small.length >= board.length) return null;
  return { id: `${item.id}~small`, ask: item.ask, examples: item.examples, ways: 1, board: small };
}

const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly AffixBuildMiss[], when: string, does: string,
  pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier: 'shown', when, does, answers, pulled: pulled.includes(id) });

export function affixBuildLevers(item: AffixBuildItem | null, board: readonly BuildPart[], pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(FRAME_LEVER, 'help', ['root_only', 'affix_only', 'parts_out_of_order'],
      'The learner puts down a root alone, a prefix or suffix alone, or parts in an order that is not a word shape.',
      'Shows empty boxes above the row labelled with part types, such as prefix + root. No part is filled in.', pulled),
    ...(modelFor(board) ? [lever(MODEL_LEVER, 'help', ['not_a_word', 'wrong_meaning'],
      'The learner makes something that is not a word, or a real word with another meaning.',
      'Shows one solved word made from parts that are NOT on this board, with each part\'s meaning, so the learner sees how '
        + 'a part changes a word. It shares no part with this item.', pulled)] : []),
    ...(smallBoardFor(item, board) ? [lever(SMALL_BOARD_LEVER, 'simplify', ['not_a_word', 'wrong_meaning'],
      'The learner keeps making words that do not fit, or cannot start on a full board.',
      'Opens the same ask first on a smaller board with fewer cards, one word only. It is not graded; the full item comes back after it.',
      pulled)] : []),
  ];
}

export function affixLeverFacts(pulled: readonly string[], item: AffixBuildItem, board: readonly BuildPart[]): string | undefined {
  const notes = [
    pulled.includes(FRAME_LEVER) && `Empty boxes above the row show a word shape: ${frameFor(item, board).join(' + ')}.`,
    pulled.includes(MODEL_LEVER) && (() => { const m = modelFor(board); return m ? `A solved word for another meaning is shown: ${m.parts.map(([t]) => t).join(' + ')} = ${m.word} (${m.clue}).` : ''; })(),
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

/** What a miss says on screen, never a word that passes. */
export function affixMissWords(miss: AffixBuildMiss | undefined): string {
  switch (miss) {
    case 'root_only': return 'That is a root on its own. Which part could change what it means?';
    case 'affix_only': return 'Those parts need a root to hang on. Which root goes with them?';
    case 'parts_out_of_order': return 'Look at the order: a prefix goes before the root and a suffix after it.';
    case 'same_word': return 'You already made that word. Make a different one.';
    case 'not_a_word': return 'Hmm, that is not a word we use. Try a different part.';
    case 'wrong_meaning': return 'That is a real word, but it means something else. Read the ask again.';
    default: return 'Not quite. Try again.';
  }
}
