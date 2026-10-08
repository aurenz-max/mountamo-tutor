/**
 * rhyme-studio `pair_build` — open build for pre-readers (qa/open-build/ROADMAP.md, OB-3L L5). A board of 8 pictures;
 * the learner taps two that rhyme into the pair tray and presses "I'm done!". Several pairs on every board are right,
 * and every second item asks for a different pair. No print: a picture's name is heard (the card's speaker asks the
 * tutor to say it), never read.
 *
 * Judged in code, exactly: every picture comes from `PICTURES`, a code-owned list of unambiguous emoji words, each
 * tagged with its rime and first sound. Two pictures rhyme when their rimes match. A pair that only shares its first
 * sound (cat, car) is the named misconception `same_start`, and every board carries such a decoy.
 *
 * Pure: the surface, the generator, the live adapter and the tests read the same rules.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';

export interface Picture { word: string; emoji: string; rime: string; start: string }
const P = (word: string, emoji: string, rime: string, start: string): Picture => ({ word, emoji, rime, start });

/** Pictures a young child names one way. Rime groups have 2+ members; `start` is the first SOUND. */
export const PICTURES: readonly Picture[] = [
  P('cat', '🐱', 'at', 'k'), P('hat', '🎩', 'at', 'h'), P('bat', '🦇', 'at', 'b'),
  P('dog', '🐶', 'og', 'd'), P('frog', '🐸', 'og', 'f'), P('log', '🪵', 'og', 'l'),
  P('bee', '🐝', 'ee', 'b'), P('tree', '🌳', 'ee', 't'), P('key', '🔑', 'ee', 'k'),
  P('cake', '🎂', 'ake', 'k'), P('snake', '🐍', 'ake', 's'),
  P('star', '⭐', 'ar', 's'), P('car', '🚗', 'ar', 'k'), P('jar', '🫙', 'ar', 'j'),
  P('moon', '🌙', 'oon', 'm'), P('spoon', '🥄', 'oon', 's'),
  P('mouse', '🐭', 'ouse', 'm'), P('house', '🏠', 'ouse', 'h'),
  P('bear', '🐻', 'air', 'b'), P('chair', '🪑', 'air', 'ch'), P('pear', '🍐', 'air', 'p'),
  P('boat', '⛵', 'oat', 'b'), P('goat', '🐐', 'oat', 'g'), P('coat', '🧥', 'oat', 'k'),
  P('ring', '💍', 'ing', 'r'), P('king', '🤴', 'ing', 'k'),
  P('box', '📦', 'ox', 'b'), P('fox', '🦊', 'ox', 'f'),
  P('bell', '🔔', 'ell', 'b'), P('shell', '🐚', 'ell', 'sh'),
  P('kite', '🪁', 'ite', 'k'), P('light', '💡', 'ite', 'l'),
  P('sock', '🧦', 'ock', 's'), P('rock', '🪨', 'ock', 'r'), P('clock', '🕐', 'ock', 'k'),
  P('nose', '👃', 'ose', 'n'), P('rose', '🌹', 'ose', 'r'),
  P('bone', '🦴', 'one', 'b'), P('phone', '📱', 'one', 'f'),
  P('tie', '👔', 'ie', 't'), P('pie', '🥧', 'ie', 'p'),
  P('train', '🚆', 'ain', 't'), P('rain', '🌧️', 'ain', 'r'),
  P('ship', '🚢', 'ip', 'sh'), P('lip', '👄', 'ip', 'l'),
  P('van', '🚐', 'an', 'v'), P('can', '🥫', 'an', 'k'),
  P('fish', '🐟', 'ish', 'f'), P('sun', '☀️', 'un', 's'), P('bus', '🚌', 'us', 'b'), P('pig', '🐷', 'ig', 'p'),
  P('duck', '🦆', 'uck', 'd'), P('cow', '🐄', 'ow', 'k'), P('egg', '🥚', 'eg', 'e'),
];
const byWord = new Map(PICTURES.map(p => [p.word, p]));
export const pictureOf = (word: string) => byWord.get(word);

export interface RhymePairItem {
  id: string;
  /** The 8 picture words on the board, in board order. */
  board: string[];
  ways: 1 | 2;
}

export type RhymePairMiss = 'no_rhyme' | 'same_start' | 'same_pair';
export const RHYME_PAIR_MISSES: readonly RhymePairMiss[] = ['no_rhyme', 'same_start', 'same_pair'];

export const ASK = 'Find two pictures that rhyme and put them together.';
const key = (a: string, b: string) => [a, b].sort().join('+');

/** The pair's miss, or undefined when the two pictures rhyme and the pair was not made before. */
export function pairMiss(pair: readonly string[], made: readonly string[] = []): RhymePairMiss | undefined {
  const [a, b] = pair.map(pictureOf);
  if (!a || !b || a.word === b.word) return 'no_rhyme';
  if (a.rime !== b.rime) return a.start === b.start ? 'same_start' : 'no_rhyme';
  if (made.includes(key(a.word, b.word))) return 'same_pair';
  return undefined;
}
export const pairKey = (pair: readonly string[]) => key(pair[0], pair[1]);

/** Every rhyming pair on a board. */
export const rhymingPairs = (board: readonly string[]): string[] =>
  board.flatMap((a, i) => board.slice(i + 1).filter(b => !pairMiss([a, b])).map(b => key(a, b)));

/** A board ships when every word is a known picture, it has 2+ rhyming pairs (3+ on a two-pair item) and a same-start decoy. */
export function askablePairItem(item: RhymePairItem): RhymePairItem | null {
  const board = Array.from(new Set(item?.board ?? []));
  if (board.length < 4 || board.length > 10 || board.some(w => !pictureOf(w))) return null;
  const pairs = rhymingPairs(board).length;
  const decoy = board.some((a, i) => board.slice(i + 1).some(b => pairMiss([a, b]) === 'same_start'));
  return pairs >= (item.ways === 2 ? 3 : 2) && decoy ? { ...item, board } : null;
}

export function pairItemsFrom(items: readonly RhymePairItem[], tier?: string): RhymePairItem[] {
  return items.map((i, n) => ({ ...i, id: i.id || `r${n + 1}`, ways: (tier !== 'easy' && n % 2 === 1 ? 2 : 1) as 1 | 2 }))
    .map(askablePairItem).filter((i): i is RhymePairItem => !!i);
}

const shuffle = <T,>(xs: readonly T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Code-owned boards: 3 rhyme pairs from different groups, plus 2 pictures that each share a first sound with one of them. */
export function makePairItems(count = 4): RhymePairItem[] {
  const groups = new Map<string, Picture[]>();
  for (const p of PICTURES) groups.set(p.rime, [...(groups.get(p.rime) ?? []), p]);
  const rimes = Array.from(groups.keys()).filter(r => groups.get(r)!.length >= 2);
  const out: RhymePairItem[] = [];
  for (let n = 0; out.length < count && n < count * 20; n++) {
    const chosen = shuffle(rimes).slice(0, 3);
    const pairs = chosen.flatMap(r => shuffle(groups.get(r)!).slice(0, 2));
    const starts = new Set(pairs.map(p => p.start));
    const decoys = shuffle(PICTURES.filter(p => !chosen.includes(p.rime) && starts.has(p.start)))
      .filter((p, i, xs) => xs.findIndex(q => q.rime === p.rime) === i).slice(0, 2);
    if (decoys.length < 2) continue;
    const item = { id: `r${out.length + 1}`, board: shuffle([...pairs, ...decoys]).map(p => p.word), ways: 1 as const };
    if (askablePairItem(item) && !out.some(o => o.board.slice().sort().join() === item.board.slice().sort().join())) out.push(item);
  }
  return out;
}

const waysLine = (item: RhymePairItem) => item.ways === 2 ? ' Then find a different pair.' : '';

export const pairAssignment = (item: RhymePairItem): TeachingAssignment =>
  ({ id: item.id, task: `${ASK}${waysLine(item)}`, response: 'gesture' });

export const describePair = (pair: readonly string[]) => pair.length ? `Put together: ${pair.join(' and ')}` : 'Nothing put together';

/** What the tutor is told: the pictures by name (it says them on request), the tray, never which pairs rhyme. */
export function pairScene(item: RhymePairItem, pair: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: ASK,
    pictures: item.board.join(', '),
    tray: pair.length ? pair.join(' and ') : 'empty',
    picturesInTray: pair.length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: made.length, madeBefore: made.map(m => m.replace('+', ' and ')).join('; ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'Pictures only, no words are printed. The learner taps two pictures into the pair tray (tap one in the tray '
      + 'to take it back), may tap a picture\'s speaker to hear its name, and presses "I\'m done!". The builder checks that '
      + 'the two names rhyme. Several pairs on the board are right. You cannot move a picture.',
  } };
}

/** "Say its name" asks the tutor for the picture's name only, never a rhyme. */
export const sayNameRequest = (word: string) => `The learner tapped a picture's speaker. Say only this word, once, plainly: "${word}"`;

// ── Levers (start bare) ──────────────────────────────────────────────────────
export const NAMES_LEVER = 'say_names';
export const MODEL_LEVER = 'model_pair';
export const SMALL_BOARD_LEVER = 'small_board';

/** A rhyming pair from a group not on this board, as the model. */
export function modelPairFor(item: RhymePairItem): [Picture, Picture] | null {
  const onBoard = new Set(item.board.map(w => pictureOf(w)!.rime));
  const rime = PICTURES.find(p => !onBoard.has(p.rime) && PICTURES.filter(q => q.rime === p.rime).length >= 2)?.rime;
  const two = PICTURES.filter(p => p.rime === rime).slice(0, 2);
  return two.length === 2 ? [two[0], two[1]] : null;
}

/** The easier practice board: one rhyming pair and two decoys. */
export function smallBoardFor(item: RhymePairItem): RhymePairItem | null {
  const pair = rhymingPairs(item.board)[0]?.split('+');
  if (!pair) return null;
  const rest = item.board.filter(w => !pair.includes(w) && !item.board.some(o => o !== w && !pairMiss([w, o]))).slice(0, 2);
  if (rest.length < 2) return null;
  return { id: `${item.id}~small`, board: shuffle([...pair, ...rest]), ways: 1 };
}

const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly RhymePairMiss[],
  when: string, does: string, pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier, when, does, answers, pulled: pulled.includes(id) });

export function pairLevers(item: RhymePairItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  return [
    lever(NAMES_LEVER, 'help', 'voiced', ['no_rhyme', 'same_start'],
      'The learner puts together two pictures that do not rhyme, or two that only start the same.',
      'You say the name of every picture on the board once, plainly, in board order. Never stretch an ending, group them, or say which rhyme.',
      pulled),
    ...(modelPairFor(item) ? [lever(MODEL_LEVER, 'help', 'shown', ['no_rhyme', 'same_start'],
      'The learner still pairs pictures that do not rhyme after hearing the names.',
      'Shows one rhyming pair of pictures that are NOT on this board, with their names said by you, so the learner hears two endings that match.',
      pulled)] : []),
    ...(smallBoardFor(item) ? [lever(SMALL_BOARD_LEVER, 'simplify', 'shown', ['no_rhyme', 'same_start'],
      'The learner cannot find a pair on a board of eight.',
      'Opens a practice board of four pictures with one rhyming pair, ungraded. The full board comes back after it.',
      pulled)] : []),
  ];
}

export function pairLeverFacts(pulled: readonly string[], item: RhymePairItem): string | undefined {
  const model = modelPairFor(item);
  const notes = [
    pulled.includes(NAMES_LEVER) && 'You are to say every picture name on the board once, plainly.',
    pulled.includes(MODEL_LEVER) && model && `A model pair not on this board is shown: ${model[0].word} and ${model[1].word}. Say both names.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function pairMissWords(miss: RhymePairMiss | undefined): string {
  switch (miss) {
    case 'same_start': return 'Those two start the same. Rhymes END the same. Listen to the ends.';
    case 'same_pair': return 'You already found that pair. Find a different one.';
    case 'no_rhyme': return 'Say both names. Do their ends sound the same?';
    default: return 'Not quite. Try again.';
  }
}

// ── The pair surface's rules (shared) ────────────────────────────────────────
// `RhymePairSurface` hosts any "tap two pictures into the tray" build. Everything that is about rhyme sits behind this
// interface; picture-vocabulary `pair_build` (opposites, goes together) supplies its own (`picturePairBuild.ts`).

/** A board: picture words in board order, and how many different pairs the item asks for. */
export interface PairBoardItem { id: string; board: string[]; ways: 1 | 2 }

export interface PairBuildRules<I extends PairBoardItem = PairBoardItem> {
  /** The family the surface records progress and evaluation for. */
  primitiveId: 'rhyme-studio' | 'picture-vocabulary';
  badge: { label: string; icon: string };
  pictureOf(word: string): { word: string; emoji: string } | undefined;
  itemsFrom(items: readonly I[], tier?: string): I[];
  /** The ask on screen (the second-pair line is added by the surface). */
  ask(item: I): string;
  assignment(item: I): TeachingAssignment;
  /** The pair's miss, or undefined when it passes and was not made before. */
  miss(pair: readonly string[], made: readonly string[], item: I): string | undefined;
  missWords(miss: string | undefined): string;
  rightWords(pair: readonly string[], item: I): string;
  describe(pair: readonly string[]): string;
  scene(item: I, pair: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene;
  levers(item: I, pulled: readonly string[]): WorkspaceLever[];
  leverFacts(pulled: readonly string[], item: I): string | undefined;
  modelLever: string;
  modelFor(item: I): readonly [{ emoji: string }, { emoji: string }] | null;
  smallBoardFor(item: I): I | null;
  practiceNote: string;
  sayNameRequest(word: string): string;
  summary: { heading: string; message: string };
  /** The evaluation metrics for a finished session, in the family's own metrics shape. */
  metrics(items: readonly I[], m: { solved: number; total: number; accuracy: number; attempts: number; firstTry: number }): unknown;
}

export const RHYME_PAIR_RULES: PairBuildRules<RhymePairItem> = {
  primitiveId: 'rhyme-studio',
  badge: { label: 'Rhyme pairs', icon: '🎵' },
  pictureOf,
  itemsFrom: pairItemsFrom,
  ask: () => ASK,
  assignment: pairAssignment,
  miss: (pair, made) => pairMiss(pair, made),
  missWords: miss => pairMissWords(miss as RhymePairMiss | undefined),
  rightWords: pair => `Yes! ${pair[0]} and ${pair[1]} rhyme.`,
  describe: describePair,
  scene: pairScene,
  levers: pairLevers,
  leverFacts: pairLeverFacts,
  modelLever: MODEL_LEVER,
  modelFor: modelPairFor,
  smallBoardFor,
  practiceNote: 'A smaller board of four pictures with one rhyming pair, ungraded. The full board comes back after it.',
  sayNameRequest,
  summary: { heading: 'Rhymes found!', message: 'You found pictures whose names end the same.' },
  metrics: (items, m) => ({
    type: 'rhyme-studio', challengeMode: 'pair_build', challengesCorrect: m.solved, challengesTotal: m.total,
    recognitionAccuracy: m.accuracy, identificationAccuracy: 0, productionAccuracy: 0, collectionAccuracy: 0,
    rhymeFamiliesPracticed: Array.from(new Set(items.flatMap(i => i.board.map(b => pictureOf(b)!.rime)))),
    attemptsCount: m.attempts,
  }),
};
