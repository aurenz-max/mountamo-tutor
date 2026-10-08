/**
 * picture-vocabulary `pair_build` — open build for pre-readers (qa/open-build/ROADMAP.md, OB-8L). A board of 8 pictures;
 * the learner taps two that are OPPOSITES (hot, cold) or two that GO TOGETHER (sock, shoe) into the pair tray and
 * presses "I'm done!". Several pairs on every board are right, and every second item asks for a different pair. No
 * print: a picture's name is heard (its speaker asks the tutor to say it), never read. Runs on the shared pair surface
 * (`RhymePairSurface.tsx`) with these rules.
 *
 * Judged in code, exactly. Every picture comes from a code-owned table:
 *  - opposites: each picture has a KIND (feeling, size, ...) and a POLE (+/-). Same kind, other pole = opposites. Same
 *    kind, same pole is the named misconception `alike` (happy, laughing), and every opposites board carries one.
 *  - goes together: listed partners only (sock-shoe). Two things of the same kind that are not partners (sock, hat) are
 *    the named misconception `same_kind`, the catalog's existing association rule ("another member of the group does
 *    not count"), and every goes-together board carries one.
 * A board never holds two pictures that a child could fairly call a pair but the table does not list (`CLASH`, from an
 * authoring-time audit: qa/open-build/picture-vocabulary-2026-10-08/clash-audit.json), and no right pair sits side by
 * side or one above the other on the 4-column board.
 *
 * Pure: the surface, the generator, the live adapter, the oracle's schema reading and the tests read the same rules.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { PictureVocabularyMetrics } from '../../../evaluation/types';
import type { PairBoardItem, PairBuildRules } from './rhymePairBuild';

export type PairRelation = 'opposite' | 'goes_with';
export interface PairPicture {
  word: string; emoji: string; relation: PairRelation;
  /** What the thing is about (opposites) or what kind of thing it is (goes together); '' = a kind of its own. */
  kind: string;
  /** Opposites only: which end of its kind. */
  pole?: 1 | -1;
  /** Goes together only: the listed partner. */
  partner?: string;
}
export interface PicturePairItem extends PairBoardItem { relation: PairRelation }

const O = (word: string, emoji: string, kind: string, pole: 1 | -1): PairPicture => ({ word, emoji, relation: 'opposite', kind, pole });
const G = (word: string, emoji: string, kind: string, partner?: string): PairPicture =>
  ({ word, emoji, relation: 'goes_with', kind, ...(partner ? { partner } : {}) });

/** Pictures a young child reads one way. Names are what the tutor says on a speaker tap. */
export const PAIR_PICTURES: readonly PairPicture[] = [
  // Opposites. Kinds with 3+ members carry the `alike` decoys.
  O('happy', '😀', 'feeling', 1), O('sad', '😢', 'feeling', -1), O('laughing', '😂', 'feeling', 1), O('crying', '😭', 'feeling', -1),
  O('big', '🐘', 'size', 1), O('small', '🐜', 'size', -1), O('huge', '🐋', 'size', 1), O('tiny', '🐞', 'size', -1),
  O('hot', '🔥', 'temperature', 1), O('cold', '🧊', 'temperature', -1), O('freezing', '❄️', 'temperature', -1),
  O('day', '☀️', 'time', 1), O('night', '🌙', 'time', -1),
  O('up', '⬆️', 'direction', 1), O('down', '⬇️', 'direction', -1),
  O('fast', '🐆', 'speed', 1), O('slow', '🐢', 'speed', -1), O('quick', '🐇', 'speed', 1),
  O('loud', '📢', 'sound', 1), O('quiet', '🤫', 'sound', -1), O('noisy', '🥁', 'sound', 1),
  O('wet', '💧', 'wetness', 1), O('dry', '🏜️', 'wetness', -1),
  O('left', '⬅️', 'sideways', 1), O('right', '➡️', 'sideways', -1),
  O('young', '👶', 'age', 1), O('old', '👴', 'age', -1),
  O('sweet', '🍭', 'taste', 1), O('sour', '🍋', 'taste', -1),
  O('light', '🪶', 'weight', 1), O('heavy', '🪨', 'weight', -1),
  O('hard', '🧱', 'hardness', 1), O('soft', '🧸', 'hardness', -1),
  // Goes together: partners, then pictures with no partner that share a kind with one (the `same_kind` decoys).
  G('sock', '🧦', 'clothes', 'shoe'), G('shoe', '👟', 'clothes', 'sock'),
  G('glove', '🧤', 'clothes', 'hand'), G('hand', '✋', 'body', 'glove'),
  G('toothbrush', '🪥', '', 'tooth'), G('tooth', '🦷', 'body', 'toothbrush'),
  G('key', '🔑', '', 'lock'), G('lock', '🔒', '', 'key'),
  G('bee', '🐝', 'animal', 'honey'), G('honey', '🍯', 'food', 'bee'),
  G('dog', '🐶', 'animal', 'bone'), G('bone', '🦴', 'food', 'dog'),
  G('cow', '🐄', 'animal', 'milk'), G('milk', '🥛', 'food', 'cow'),
  G('monkey', '🐒', 'animal', 'banana'), G('banana', '🍌', 'food', 'monkey'),
  G('mouse', '🐭', 'animal', 'cheese'), G('cheese', '🧀', 'food', 'mouse'),
  G('rabbit', '🐰', 'animal', 'carrot'), G('carrot', '🥕', 'food', 'rabbit'),
  G('spider', '🕷️', 'animal', 'web'), G('web', '🕸️', '', 'spider'),
  G('bird', '🐦', 'animal', 'nest'), G('nest', '🪺', '', 'bird'),
  G('rain', '🌧️', '', 'umbrella'), G('umbrella', '☂️', '', 'rain'),
  G('bread', '🍞', 'food', 'butter'), G('butter', '🧈', 'food', 'bread'),
  G('letter', '✉️', '', 'mailbox'), G('mailbox', '📫', '', 'letter'),
  G('ball', '⚽', 'toy', 'goal'), G('goal', '🥅', '', 'ball'),
  G('paint', '🎨', 'art', 'paintbrush'), G('paintbrush', '🖌️', 'art', 'paint'),
  G('needle', '🪡', '', 'thread'), G('thread', '🧵', '', 'needle'),
  G('car', '🚗', 'vehicle', 'wheel'), G('wheel', '🛞', '', 'car'),
  G('saw', '🪚', 'tool', 'wood'), G('wood', '🪵', '', 'saw'),
  G('soap', '🧼', '', 'bathtub'), G('bathtub', '🛁', '', 'soap'),
  G('cake', '🎂', 'food', 'candle'), G('candle', '🕯️', '', 'cake'),
  G('pencil', '✏️', 'art', 'notebook'), G('notebook', '📓', '', 'pencil'),
  G('boat', '⛵', 'vehicle'), G('hammer', '🔨', 'tool'),
  G('hat', '🧢', 'clothes'), G('scarf', '🧣', 'clothes'), G('ear', '👂', 'body'), G('nose', '👃', 'body'),
  G('apple', '🍎', 'food'), G('grapes', '🍇', 'food'), G('kite', '🪁', 'toy'), G('crayon', '🖍️', 'art'),
  G('pig', '🐷', 'animal'), G('frog', '🐸', 'animal'),
];
const byWord = new Map(PAIR_PICTURES.map(p => [p.word, p]));
export const pairPictureOf = (word: string) => byWord.get(word);

/** Kinds of opposite that never share a board. Author's call on how the pictures read (a sun and an ice cube read as
 *  hot and cold; an elephant and a feather as heavy and light), plus loud + soft from the audit. */
const KIND_CLASH = new Set(['temperature+time', 'temperature+wetness', 'time+wetness', 'feeling+sound', 'size+speed',
  'size+weight', 'hardness+weight', 'hardness+size', 'age+size', 'hardness+sound'].map(k => k.split('+').sort().join('+')));
/** Unlisted goes-together pairs the audit accepted at least once in three (`clash-audit.json`, 10-08: 1,630 unlisted
 *  pairs, 22 accepted; the 4 under the animal-and-food rule below are left out): never on one board. */
export const CLASH: ReadonlySet<string> = new Set([
  'hand+soap', 'hand+crayon', 'key+car', 'honey+bread', 'dog+ball', 'milk+cake', 'carrot+cake', 'carrot+nose',
  'nest+wood', 'rain+frog', 'letter+pencil', 'letter+crayon', 'thread+kite', 'wood+hammer', 'notebook+crayon',
  'milk+cheese', 'cheese+bread', 'carrot+rain',
].map(k => k.split('+').sort().join('+')));

const key = (a: string, b: string) => [a, b].sort().join('+');
export const picturePairKey = (pair: readonly string[]) => key(pair[0], pair[1]);

export type PicturePairMiss = 'alike' | 'not_opposite' | 'same_kind' | 'no_link' | 'same_pair';
export const PICTURE_PAIR_MISSES: readonly PicturePairMiss[] = ['alike', 'not_opposite', 'same_kind', 'no_link', 'same_pair'];

/** How two pictures relate under the table, before "made before". */
function relate(a: PairPicture, b: PairPicture): 'pass' | Exclude<PicturePairMiss, 'same_pair'> {
  if (a.relation === 'opposite' && b.relation === 'opposite') {
    if (a.kind !== b.kind) return 'not_opposite';
    return a.pole !== b.pole ? 'pass' : 'alike';
  }
  if (a.relation === 'goes_with' && b.relation === 'goes_with') {
    if (a.partner === b.word) return 'pass';
    return a.kind && a.kind === b.kind ? 'same_kind' : 'no_link';
  }
  return 'no_link';
}

/** The pair's miss, or undefined when the two pictures pass and the pair was not made before. */
export function picturePairMiss(pair: readonly string[], made: readonly string[] = [], relation: PairRelation = 'opposite'): PicturePairMiss | undefined {
  const [a, b] = pair.map(pairPictureOf);
  if (!a || !b || a.word === b.word) return relation === 'opposite' ? 'not_opposite' : 'no_link';
  const r = relate(a, b);
  if (r !== 'pass') return r;
  if (made.includes(key(a.word, b.word))) return 'same_pair';
  return undefined;
}

/** True when two pictures may not share a board: an unlisted pair a child could fairly call right. */
export function clashes(a: PairPicture, b: PairPicture): boolean {
  if (a.relation !== b.relation) return true;
  if (a.relation === 'opposite') return a.kind !== b.kind && KIND_CLASH.has([a.kind, b.kind].sort().join('+'));
  if (a.partner === b.word) return false;
  if (CLASH.has(key(a.word, b.word))) return true;
  // An animal and a food that are not partners: "the rabbit eats the apple" is a fair pair.
  return (a.kind === 'animal' && b.kind === 'food') || (a.kind === 'food' && b.kind === 'animal');
}

/** Every passing pair on a board. */
export const passingPairs = (board: readonly string[], relation: PairRelation): string[] =>
  board.flatMap((a, i) => board.slice(i + 1).filter(b => !picturePairMiss([a, b], [], relation)).map(b => key(a, b)));

/** Pairs on a board that carry the relation's named misconception. */
const decoyPairs = (board: readonly string[], relation: PairRelation) => {
  const want = relation === 'opposite' ? 'alike' : 'same_kind';
  return board.flatMap((a, i) => board.slice(i + 1).filter(b => picturePairMiss([a, b], [], relation) === want).map(b => key(a, b)));
};

export const COLUMNS = 4;
/** True when a right pair sits side by side or one above the other on the board's grid. */
export function pairAdjacent(board: readonly string[], relation: PairRelation, columns = COLUMNS): boolean {
  const right = new Set(passingPairs(board, relation));
  return board.some((w, i) => {
    const side = i % columns < columns - 1 && i + 1 < board.length ? board[i + 1] : null;
    const below = i + columns < board.length ? board[i + columns] : null;
    return [side, below].some(o => o && right.has(key(w, o)));
  });
}

/** A board ships when every picture is known and of the item's relation, nothing clashes, it has 2+ right pairs (3+
 *  on a two-pair item), a misconception decoy, and no right pair sits next to each other. */
export function askablePicturePairItem(item: PicturePairItem): PicturePairItem | null {
  const relation = item?.relation;
  if (relation !== 'opposite' && relation !== 'goes_with') return null;
  const board = Array.from(new Set(item.board ?? []));
  if (board.length !== (item.board ?? []).length || board.length < 4 || board.length > 10) return null;
  const pics = board.map(pairPictureOf);
  if (pics.some(p => !p || p.relation !== relation)) return null;
  if (pics.some((p, i) => pics.slice(i + 1).some(q => clashes(p!, q!)))) return null;
  if (passingPairs(board, relation).length < (item.ways === 2 ? 3 : 2) || !decoyPairs(board, relation).length) return null;
  if (pairAdjacent(board, relation)) return null;
  return { ...item, board };
}

export function picturePairItemsFrom(items: readonly PicturePairItem[], tier?: string): PicturePairItem[] {
  return items.map((i, n) => ({ ...i, id: i.id || `p${n + 1}`, ways: (tier !== 'easy' && n % 2 === 1 ? 2 : 1) as 1 | 2 }))
    .map(askablePicturePairItem).filter((i): i is PicturePairItem => !!i);
}

const shuffle = <T,>(xs: readonly T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** Board order with no right pair next to another; null when 200 shuffles find none. */
export function spreadBoard(words: readonly string[], relation: PairRelation): string[] | null {
  for (let n = 0; n < 200; n++) {
    const board = shuffle(words);
    if (!pairAdjacent(board, relation)) return board;
  }
  return null;
}

const fits = (picked: readonly PairPicture[], p: PairPicture) => !picked.some(q => q.word === p.word || clashes(q, p));

/** One code-owned board: 3 right pairs and 2 decoys that each make the relation's misconception with a board picture.
 *  No right pair on it is in `avoid` (the session's earlier boards). */
export function makePicturePairBoard(relation: PairRelation, avoid: ReadonlySet<string> = new Set()): string[] | null {
  const pool = PAIR_PICTURES.filter(p => p.relation === relation);
  const fresh = (a: PairPicture, b: PairPicture) => !avoid.has(key(a.word, b.word));
  for (let n = 0; n < 60; n++) {
    const picked: PairPicture[] = [];
    if (relation === 'opposite') {
      const kinds = shuffle(Array.from(new Set(pool.map(p => p.kind))));
      for (const kind of kinds) {
        if (picked.length >= 6) break;
        const members = pool.filter(p => p.kind === kind);
        const plus = shuffle(members.filter(p => p.pole === 1))[0];
        const minus = shuffle(members.filter(p => p.pole === -1))[0];
        if (plus && minus && fresh(plus, minus) && fits(picked, plus) && fits(picked, minus)) picked.push(plus, minus);
      }
    } else {
      for (const p of shuffle(pool.filter(x => x.partner))) {
        if (picked.length >= 6) break;
        const partner = pairPictureOf(p.partner!)!;
        if (fresh(p, partner) && fits(picked, p) && fits([...picked, p], partner)) picked.push(p, partner);
      }
    }
    if (picked.length < 6) continue;
    const want = relation === 'opposite' ? 'alike' : 'same_kind';
    const decoys: PairPicture[] = [];
    for (const d of shuffle(pool)) {
      if (decoys.length >= 2) break;
      const all = [...picked, ...decoys];
      if (!fits(all, d)) continue;
      // A decoy adds the misconception and, on goes together, no right pair (it has no partner on the board). On
      // opposites the second extra may instead be a lone picture whose opposite is not on the board.
      const lone = relation === 'opposite' && decoys.length === 1 && !all.some(q => relate(q, d) !== 'not_opposite');
      if (!lone && !all.some(q => relate(q, d) === want)) continue;
      if (relation === 'goes_with' && all.some(q => relate(q, d) === 'pass')) continue;
      if (all.some(q => relate(q, d) === 'pass' && !fresh(q, d))) continue;
      decoys.push(d);
    }
    if (decoys.length < 2) continue;
    const board = spreadBoard([...picked, ...decoys].map(p => p.word), relation);
    if (board && askablePicturePairItem({ id: 'x', board, ways: 2, relation })) return board;
  }
  return null;
}

/** The relation for each item: the intent's when it names one, else alternating (opposites first). */
export function relationsFor(intent: string | undefined, count: number): PairRelation[] {
  const text = (intent ?? '').toLowerCase();
  const opp = /opposite|antonym/.test(text);
  const goes = /go(es)? together|goes with|go with|associat|belong together|things that match/.test(text);
  return Array.from({ length: count }, (_, i) => opp && !goes ? 'opposite' : goes && !opp ? 'goes_with' : i % 2 ? 'goes_with' : 'opposite');
}

/** Code-owned session: `count` boards, relations from the intent, no right pair on two boards (one is recalled, not
 *  found, the second time). */
export function makePicturePairItems(count = 4, intent?: string): PicturePairItem[] {
  const out: PicturePairItem[] = [];
  const relations = relationsFor(intent, count);
  const used = new Set<string>();
  for (let n = 0; out.length < count && n < count * 10; n++) {
    const relation = relations[out.length];
    const board = makePicturePairBoard(relation, used);
    if (!board) continue;
    const right = passingPairs(board, relation);
    if (right.some(p => used.has(p))) continue;
    right.forEach(p => used.add(p));
    out.push({ id: `p${out.length + 1}`, board, ways: 1, relation });
  }
  return out;
}

// ── What the learner and the tutor are told ──────────────────────────────────
export const ASKS: Record<PairRelation, string> = {
  opposite: 'Find two pictures that are opposites and put them together.',
  goes_with: 'Find two pictures that go together and put them together.',
};
const RELATION_WORDS: Record<PairRelation, string> = { opposite: 'are opposites', goes_with: 'go together' };
const waysLine = (item: PicturePairItem) => item.ways === 2 ? ' Then find a different pair.' : '';

export const picturePairAssignment = (item: PicturePairItem): TeachingAssignment =>
  ({ id: item.id, task: `${ASKS[item.relation]}${waysLine(item)}`, response: 'gesture' });

export const describePicturePair = (pair: readonly string[]) => pair.length ? `Put together: ${pair.join(' and ')}` : 'Nothing put together';

/** What the tutor is told: the pictures by name (it says them on request), the tray, never which pairs are right. */
export function picturePairScene(item: PicturePairItem, pair: readonly string[], made: readonly string[], inspectorSaid?: string): WorkspaceScene {
  return { objects: [], facts: {
    ask: ASKS[item.relation],
    pictures: item.board.join(', '),
    tray: pair.length ? pair.join(' and ') : 'empty',
    picturesInTray: pair.length,
    ...(item.ways === 2 ? { waysAsked: 2, waysMade: made.length, madeBefore: made.map(m => m.replace('+', ' and ')).join('; ') || 'none' } : {}),
    ...(inspectorSaid ? { inspectorSaid } : {}),
    constraints: 'Pictures only, no words are printed. The learner taps two pictures into the pair tray (tap one in the tray '
      + 'to take it back), may tap a picture\'s speaker to hear its name, and presses "I\'m done!". The builder checks that '
      + `the two ${RELATION_WORDS[item.relation]}. Several pairs on the board are right. You cannot move a picture.`,
  } };
}

export const picturePairSayName = (word: string) => `The learner tapped a picture's speaker. Say only this word, once, plainly: "${word}"`;

// ── Levers (start bare) ──────────────────────────────────────────────────────
export const PP_NAMES_LEVER = 'say_names';
export const PP_MODEL_LEVER = 'model_pair';
export const PP_SMALL_BOARD_LEVER = 'small_board';

/** A right pair of the item's relation that is not on the board and shares no kind with it (and clashes with nothing on it). */
export function picturePairModelFor(item: PicturePairItem): [PairPicture, PairPicture] | null {
  const on = item.board.map(w => pairPictureOf(w)!).filter(Boolean);
  const kinds = new Set(on.map(p => p.kind).filter(Boolean));
  const free = (p: PairPicture) => !item.board.includes(p.word) && !(p.kind && kinds.has(p.kind)) && !on.some(q => clashes(q, p));
  const pool = PAIR_PICTURES.filter(p => p.relation === item.relation && free(p));
  for (const a of pool) {
    const b = pool.find(x => x !== a && relate(a, x) === 'pass');
    if (b) return [a, b];
  }
  return null;
}

/** The easier practice board: one right pair and two pictures that make no right pair, the pair not side by side. */
export function picturePairSmallBoard(item: PicturePairItem): PicturePairItem | null {
  const { relation } = item;
  const want = relation === 'opposite' ? 'alike' : 'same_kind';
  for (const right of passingPairs(item.board, relation)) {
    const pair = right.split('+');
    // Pictures that make no right pair with either half; a misconception decoy first, so practice asks the real question.
    const rest = item.board.filter(w => !pair.includes(w) && pair.every(p => picturePairMiss([w, p], [], relation)));
    const ranked = [...rest.filter(w => pair.some(p => picturePairMiss([w, p], [], relation) === want)),
      ...rest.filter(w => !pair.some(p => picturePairMiss([w, p], [], relation) === want))];
    for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) {
      const board = [pair[0], ranked[i], pair[1], ranked[j]];
      if (passingPairs(board, relation).length === 1) return { id: `${item.id}~small`, board, ways: 1, relation };
    }
  }
  return null;
}

const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], answers: readonly PicturePairMiss[],
  when: string, does: string, pulled: readonly string[]): WorkspaceLever => ({ id, kind, carrier, when, does, answers, pulled: pulled.includes(id) });

export function picturePairLevers(item: PicturePairItem | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const misses: readonly PicturePairMiss[] = item.relation === 'opposite' ? ['alike', 'not_opposite'] : ['same_kind', 'no_link'];
  const rel = RELATION_WORDS[item.relation];
  return [
    lever(PP_NAMES_LEVER, 'help', 'voiced', misses,
      `The learner puts together two pictures that do not ${item.relation === 'opposite' ? 'mean opposite things' : 'go together'}.`,
      'You say the name of every picture on the board once, plainly, in board order. Never group them, pause between two '
        + `that ${rel}, or say which ones ${rel}.`,
      pulled),
    ...(picturePairModelFor(item) ? [lever(PP_MODEL_LEVER, 'help', 'shown', misses,
      'The learner still makes a wrong pair after hearing the names.',
      `Shows one pair of pictures that ${rel}, NOT on this board, and you say both names and why they ${rel} in a few words. `
        + 'It is about those two pictures only: never point it at a picture on the board or say which board pictures pair up.',
      pulled)] : []),
    ...(picturePairSmallBoard(item) ? [lever(PP_SMALL_BOARD_LEVER, 'simplify', 'shown', misses,
      'The learner cannot find a pair on a board of eight.',
      `Opens a practice board of four pictures with one pair that ${rel}, ungraded. The full board comes back after it.`,
      pulled)] : []),
  ];
}

export function picturePairLeverFacts(pulled: readonly string[], item: PicturePairItem): string | undefined {
  const model = picturePairModelFor(item);
  const notes = [
    pulled.includes(PP_NAMES_LEVER) && 'You are to say every picture name on the board once, plainly.',
    pulled.includes(PP_MODEL_LEVER) && model
      && `A model pair not on this board is shown: ${model[0].word} and ${model[1].word}. Say both names and why they ${RELATION_WORDS[item.relation]}.`,
  ].filter(Boolean);
  return notes.length ? notes.join(' ') : undefined;
}

export function picturePairMissWords(miss: string | undefined): string {
  switch (miss as PicturePairMiss | undefined) {
    case 'alike': return 'Those two are alike. Opposites are as different as they can be.';
    case 'not_opposite': return 'Say both names. Is one the opposite of the other?';
    case 'same_kind': return 'Those are the same kind of thing. Things that go together are used or found together.';
    case 'no_link': return 'Say both names. Do those two go together?';
    case 'same_pair': return 'You already found that pair. Find a different one.';
    default: return 'Not quite. Try again.';
  }
}

export const PICTURE_PAIR_RULES: PairBuildRules<PicturePairItem> = {
  primitiveId: 'picture-vocabulary',
  badge: { label: 'Picture pairs', icon: '🧩' },
  pictureOf: pairPictureOf,
  itemsFrom: picturePairItemsFrom,
  ask: item => ASKS[item.relation],
  assignment: picturePairAssignment,
  miss: (pair, made, item) => picturePairMiss(pair, made, item.relation),
  missWords: picturePairMissWords,
  rightWords: (pair, item) => `Yes! ${pair[0]} and ${pair[1]} ${RELATION_WORDS[item.relation]}.`,
  describe: describePicturePair,
  scene: picturePairScene,
  levers: picturePairLevers,
  leverFacts: picturePairLeverFacts,
  modelLever: PP_MODEL_LEVER,
  modelFor: picturePairModelFor,
  smallBoardFor: picturePairSmallBoard,
  practiceNote: 'A smaller board of four pictures with one right pair, ungraded. The full board comes back after it.',
  sayNameRequest: picturePairSayName,
  summary: { heading: 'Pairs found!', message: 'You found pictures that belong in pairs.' },
  metrics: (items, m): PictureVocabularyMetrics => ({
    type: 'picture-vocabulary', challengeType: 'pair_build', totalChallenges: m.total, correctCount: m.solved,
    attemptsCount: m.attempts, firstTryCount: m.firstTry, hintsViewed: 0, overallAccuracy: m.accuracy,
    averageAttemptsPerChallenge: m.total ? Math.round((m.attempts / m.total) * 100) / 100 : 0,
  }),
};
