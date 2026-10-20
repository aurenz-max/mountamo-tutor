/**
 * Spatial scene on the shared tutor/JEV teaching workspace: the ask, the spoken key, the scene's own check and the
 * scene, which the boss (`spatialScene.boss.ts`), the component, the levers and the tests read. Every challenge is one
 * workspace item:
 *   - identify / describe: one position word, said or tapped (VB-1, 2026-10-13). The key credits every word the scene's
 *     geometry makes true (contract R3/R12: `on` and `under` only when the two things touch) but not a bare "beside"
 *     when the answer names a side; a tap is checked by the scene;
 *   - place / place_in / place_between: the learner taps a cell and presses Check; no key;
 *   - follow_directions: every step placement is checked; a wrong step is a checked miss that keeps the steps already
 *     placed, and the last right step is the success; no key;
 *   - describe_scene: spoken, judged on the relation AND the reference object (contract R16).
 *
 * Pure: no React.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SpatialSceneChallenge } from './SpatialScene';
import { SPATIAL_MISSES, type SpatialMiss } from './spatialScene.card';
// A cycle (the levers import `placeCellCorrect`); both sides use the other only inside functions.
import { holds } from './spatialSceneLevers';

export { SPATIAL_MISSES, type SpatialMiss };

const relationText = (relation: string) => relation.replaceAll('_', ' ');
const isWord = (c: SpatialSceneChallenge) => c.type === 'identify' || c.type === 'describe';

/** The model sentence of a described relation, shown once the description is credited (contract R16). */
export const modelSpatialDescription = (c: SpatialSceneChallenge): string =>
  `The ${c.targetObject.name} is ${relationText(c.correctPosition)} the ${c.referenceObjectName}.`;

/** The spoken ask for `describe_scene`: from the fixed YOU viewpoint, never naming the relation. */
export const describeSceneAsk = (c: SpatialSceneChallenge) =>
  `Look from the YOU arrow. Tell where the ${c.targetObject.name} is compared with the ${c.referenceObjectName}.`;

/**
 * What the learner is asked. Built from the item's names, not the generated instruction, so it never carries a word
 * the key accepts. A placing item's ask is its instruction: the instruction names the word, and the answer is a cell.
 */
export function spatialAsk(c: SpatialSceneChallenge): string {
  const t = c.targetObject.name, ref = c.referenceObjectName;
  if (c.type === 'describe_scene') return describeSceneAsk(c);
  if (c.type === 'identify') return ref ? `Where is the ${t} compared with the ${ref}?` : `Where is the ${t}?`;
  if (c.type === 'describe') return `Which position word tells where the ${t} is${ref ? ` compared with the ${ref}` : ''}?`;
  return c.instruction;
}

/**
 * The position words a learner may say, as groups of one meaning (beside = next to), each with its spoken forms.
 * `on`/`under` are their own groups: contract R3 makes them contact-scoped, so they are not synonyms of above/below.
 */
const SAID: ReadonlyArray<{ words: readonly string[]; forms: readonly string[] }> = [
  { words: ['above'], forms: ['above', 'over'] },
  { words: ['below'], forms: ['below'] },
  { words: ['on'], forms: ['on', 'on top of'] },
  { words: ['under'], forms: ['under', 'underneath', 'beneath'] },
  { words: ['beside', 'next_to'], forms: ['beside', 'next to', 'by'] },
  { words: ['left_of'], forms: ['left of', 'to the left of'] },
  { words: ['right_of'], forms: ['right of', 'to the right of'] },
];
const quoteOr = (forms: readonly string[]) => forms.map(f => `"${f}"`).join(', ').replace(/, ([^,]*)$/, ' or $1');

/**
 * Which said groups the scene's geometry makes true (`holds`, the executable R3), and which it does not. A bare
 * "beside" is true when the answer is left of / right of but does not say which side, so it is neither.
 */
function wordGroups(c: SpatialSceneChallenge) {
  const ref = c.sceneObjects.find(o => o.name === c.referenceObjectName)?.position, t = c.targetObject.position;
  const sided = c.correctPosition === 'left_of' || c.correctPosition === 'right_of';
  const truth = (g: typeof SAID[number]) => g.words.includes(c.correctPosition)
    || (ref ? holds(g.words[0], t, ref) === true : false);
  const right = SAID.filter(truth), vague = sided ? SAID.filter(g => g.words.includes('beside') && truth(g)) : [];
  return { right: right.filter(g => !vague.includes(g)), vague, wrong: SAID.filter(g => !truth(g)) };
}

/** identify / describe: the one position word, the other ways of saying what is true, and the near words that are not it. */
function wordKey(c: SpatialSceneChallenge): SpokenKey {
  const t = c.targetObject.name, ref = c.referenceObjectName ?? 'other thing', key = relationText(c.correctPosition);
  const { right, vague, wrong } = wordGroups(c);
  // The contact word on the answer's own side (on for above, under for below), untrue because there is a gap.
  const contact = ({ above: 'on', below: 'under' } as Record<string, string>)[c.correctPosition];
  const touch = wrong.filter(g => g.words[0] === contact);
  const horizontal = ['beside', 'next_to', 'left_of', 'right_of'].includes(c.correctPosition);
  const others = wrong.filter(g => !touch.includes(g)).map(g => g.forms[0]);
  return {
    answer: key,
    alsoAccept: right.flatMap(g => g.forms).filter(f => f !== key),
    acceptRule: `Any of these alone or in a sentence about the ${t} and the ${ref} counts.`
      + (horizontal ? ' Left and right are as the learner sees the screen.' : ''),
    signatureError: [
      touch.length ? `${quoteOr(touch[0].forms)} is not it: that word means touching, and there is a gap.` : '',
      vague.length ? 'A bare "beside" or "next to" is true but does not say which side: not the answer yet.' : '',
      others.length ? `${quoteOr(others)} is not it.` : '',
    ].filter(Boolean).join(' '),
  };
}

/** describe_scene's spoken forms of each relation, before the reference object. */
const SCENE_FORMS: Record<string, readonly string[]> = {
  left_of: ['left of', 'to the left of', 'on the left of'], right_of: ['right of', 'to the right of', 'on the right of'],
  in_front_of: ['in front of'], behind: ['behind', 'in back of'],
};

/** describe_scene: the relation and the reference object, together, from the YOU arrow (contract R16). */
function sceneKey(c: SpatialSceneChallenge): SpokenKey {
  const t = c.targetObject.name, ref = c.referenceObjectName, rel = relationText(c.correctPosition);
  const depth = c.correctPosition === 'in_front_of' || c.correctPosition === 'behind';
  const opposite = OPPOSITE[c.correctPosition];
  return {
    answer: modelSpatialDescription(c),
    alsoAccept: (SCENE_FORMS[c.correctPosition] ?? [rel]).map(f => `${f} the ${ref}`),
    acceptRule: `Any sentence or phrase that names both "${rel}" and the ${ref} counts; the ${t} need not be named. `
      + (depth ? 'In front of means nearer the YOU arrow, behind means farther from it.'
        : 'Left and right are as the learner looks from the YOU arrow, never the way a thing faces.'),
    signatureError: `The relation with no ${ref}, a different pair of things, or a vague answer such as "over there" is `
      + `not it${opposite ? `; "${opposite} the ${ref}" points the other way` : ''}.`,
  };
}

/** The key a spoken answer is judged against; null on a placing item, which the scene checks. */
export function spatialKey(c: SpatialSceneChallenge): SpokenKey | null {
  if (isWord(c)) return wordKey(c);
  if (c.type === 'describe_scene') return sceneKey(c);
  return null;
}

/**
 * A spoken item's known wrong answers for the `spoken_miss` observer. identify / describe: each untrue word, under the
 * id its tap would get. describe_scene: the relation that points the other way; the rest of a description is open.
 */
export function spatialSpokenMisses(c: SpatialSceneChallenge): KnownMiss[] {
  if (isWord(c)) return wordSpokenMisses(c);
  // `OPPOSITE` (below) is the harness's wrong relation, already in words.
  const opposite = c.type === 'describe_scene' ? OPPOSITE[c.correctPosition] : undefined;
  if (!opposite) return [];
  const t = c.targetObject.name, ref = c.referenceObjectName;
  return [{ id: 'opposite_word', pattern: `From the YOU arrow, the ${t} is ${relationText(c.correctPosition)} the ${ref}. The learner says `
    + `the ${t} is ${opposite} the ${ref}, the relation that points the other way.`,
    examples: [`The ${t} is ${opposite} the ${ref}.`] }];
}

const MISS_GLOSS: Record<string, string> = {
  opposite_word: 'the word that points the other way',
  same_axis_word: 'a word on the same line that does not fit how far apart they are',
  other_axis_word: 'a word for the other direction (side to side for up and down, or the reverse)',
};

/** identify / describe: each untrue word, named by the tap's own `spatialMiss` id. */
function wordSpokenMisses(c: SpatialSceneChallenge): KnownMiss[] {
  const t = c.targetObject.name, ref = c.referenceObjectName, key = relationText(c.correctPosition);
  if (!ref) return [];
  const byId = new Map<string, string[]>();
  for (const g of wordGroups(c).wrong) {
    const id = spatialMiss(c, { option: g.words[0] });
    if (id) byId.set(id, [...(byId.get(id) ?? []), g.forms[0]]);
  }
  return Object.keys(MISS_GLOSS).filter(id => byId.has(id)).map(id => ({ id,
    pattern: `The ${t} is ${key} the ${ref}. The learner says the ${t} is ${quoteOr(byId.get(id)!)} the ${ref}: `
      + `${MISS_GLOSS[id]}.`,
    examples: byId.get(id)!.map(f => `The ${t} is ${f} the ${ref}.`) }));
}

/** The journey's spoken answers: the key word (or the model sentence), and a word the scene makes false. */
export function spatialHarnessWords(c: SpatialSceneChallenge): { correct: string; plainWrong: string } {
  if (c.type === 'describe_scene') {
    const model = modelSpatialDescription(c), opposite = OPPOSITE[c.correctPosition] ?? 'over there';
    return { correct: model, plainWrong: model.replace(relationText(c.correctPosition), opposite) };
  }
  const ref = c.sceneObjects.find(o => o.name === c.referenceObjectName)?.position;
  const wrong = (c.options ?? []).find(o => o !== c.correctPosition && !!ref && holds(o, c.targetObject.position, ref) === false)
    ?? wordGroups(c).wrong[0]?.words[0] ?? 'over there';
  return { correct: relationText(c.correctPosition), plainWrong: relationText(wrong) };
}

/** The learner's checked work in their terms, never the key. */
export const describeSpatialCheck = (c: SpatialSceneChallenge, view: { option?: string | null;
  cell?: { row: number; col: number } | null; step?: number }) => {
  if (isWord(c)) return `Chose "${relationText(view.option ?? '?')}"`;
  if (c.type === 'follow_directions') return `Placed step ${(view.step ?? 0) + 1} at row ${view.cell?.row}, column ${view.cell?.col}`;
  return `Chose the cell at row ${view.cell?.row}, column ${view.cell?.col}`;
};

type Cell = { row: number; col: number };
const WORD_STEP: Record<string, Cell> = { above: { row: -1, col: 0 }, on: { row: -1, col: 0 }, below: { row: 1, col: 0 },
  under: { row: 1, col: 0 }, left_of: { row: 0, col: -1 }, right_of: { row: 0, col: 1 } };
const VERTICAL = new Set(['above', 'below', 'on', 'under']);
const same = (a: Cell, b: Cell) => a.row === b.row && a.col === b.col;
const touches = (a: Cell, b: Cell) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

/** Cell-judged modes: `place` credits any of its code-derived `acceptableCells` (RP-5); the others, `correctCell`. */
export function placeCellCorrect(c: SpatialSceneChallenge, cell: Cell): boolean {
  const cells = c.type === 'place' && c.acceptableCells?.length ? c.acceptableCells : c.correctCell ? [c.correctCell] : [];
  return cells.some(t => same(t, cell));
}

/** What a checked wrong choice shows, from the scene's own geometry (the ids are the card's `SpatialMiss`). */
export function spatialMiss(c: SpatialSceneChallenge, view: { option?: string | null; cell?: Cell | null; step?: number }): SpatialMiss | undefined {
  const at = (name?: string) => c.sceneObjects.find(o => o.name === name)?.position;
  if (isWord(c)) {
    const chosen = view.option, ref = at(c.referenceObjectName), t = c.targetObject.position;
    if (!chosen || chosen === c.correctPosition || !ref) return undefined;
    const dr = Math.sign(t.row - ref.row), dc = Math.sign(t.col - ref.col), step = WORD_STEP[chosen];
    if (step && step.row === -dr && step.col === -dc) return 'opposite_word';
    return VERTICAL.has(chosen) === (dc === 0) ? 'same_axis_word' : 'other_axis_word';
  }
  const cell = view.cell;
  if (!cell) return undefined;
  if (c.type === 'place') {
    const ref = at(c.referenceObjectName), word = c.correctPosition;
    if (!ref || placeCellCorrect(c, cell) || same(cell, ref)) return undefined;
    const dr = cell.row - ref.row, dc = cell.col - ref.col;
    if (dr !== 0 && dc !== 0) return 'off_line_cell';
    if (VERTICAL.has(word) !== (dc === 0)) return 'other_axis_cell';
    const step = WORD_STEP[word];
    return step && Math.sign(dr) === -step.row && Math.sign(dc) === -step.col ? 'opposite_cell' : 'same_axis_cell';
  }
  if (c.type === 'place_in') {
    const box = at(c.referenceObjectName);
    if (!box || same(cell, box)) return undefined;
    if (c.sceneObjects.some(o => same(o.position, cell))) return 'other_object';
    return touches(cell, box) ? 'next_to_container' : 'away_from_container';
  }
  if (c.type === 'place_between') {
    if (c.correctCell && same(cell, c.correctCell)) return undefined;
    return [at(c.referenceObjectName), at(c.referenceObjectName2)].some(r => r && touches(cell, r)) ? 'next_to_one' : 'touches_neither';
  }
  if (c.type === 'follow_directions') {
    const steps = c.steps ?? [], now = view.step ?? 0;
    if (!steps[now] || same(cell, steps[now].correctCell)) return undefined;
    return steps.slice(now + 1).some(s => same(s.correctCell, cell)) ? 'later_step_cell' : 'other_cell';
  }
  return undefined;
}

/**
 * This item's "never say" facts, beside the card's moves and the shared doctrine (which say how the learner answers
 * and that the answer is never given).
 */
const CONSTRAINTS: Record<SpatialSceneChallenge['type'], string> = {
  identify: 'Left and right are as the learner sees the screen. Before the learner has answered, never say the position word.',
  describe: 'Left and right are as the learner sees the screen. Before the learner has answered, never say the position word.',
  place: 'Before the learner has answered, never say which square.',
  place_in: 'Before the learner has answered, never point to the thing it goes in.',
  place_between: 'Before the learner has answered, never say which square.',
  follow_directions: 'Before a step is placed, never say which square.',
  describe_scene: 'Left and right are the learner’s own; in front of is nearer the arrow. The relation is not printed '
    + 'until it is credited; never give it before an attempt.',
};

export function spatialScene(c: SpatialSceneChallenge, view: { step?: number }): SceneOf {
  return { objects: [], facts: {
    kind: c.type,
    ...(c.type === 'follow_directions' && c.steps ? { step: `${(view.step ?? 0) + 1} of ${c.steps.length}` } : {}),
    ...(c.supportTier ? { supportTier: c.supportTier } : {}),
    constraints: CONSTRAINTS[c.type],
  } };
}

/** What "Hear the question again" asks the tutor to say: the ask only, never the relation. */
export const hearSceneQuestionRequest = (c: SpatialSceneChallenge) =>
  `The learner asked to hear the question again. Say only this, once: "${describeSceneAsk(c)}"`;

/** The on-screen label of a position word ("left_of" -> "Left of"), as the option buttons print it. */
export const positionLabel = (word: string) => {
  const text = relationText(word);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const OPPOSITE: Record<string, string> = { above: 'below', below: 'above', left_of: 'right of', right_of: 'left of',
  in_front_of: 'behind', behind: 'in front of', on: 'under', under: 'on' };

type HarnessInput = { type: 'choose'; label: string } | { type: 'touch'; target: string } | { type: 'check' };

/**
 * The journey's moves on an item the scene checks, through the real controls: a position word and Check, a cell and
 * Check, or each remaining direction step. `wrong` picks another word or another empty cell. `step` is the published
 * follow-directions step (1-based text).
 */
export function spatialHarnessInputs(c: SpatialSceneChallenge, wrong: boolean, gridSize = 3, step?: string): HarnessInput[] {
  const occupied = new Set(c.sceneObjects.map(o => `${o.position.row}-${o.position.col}`));
  const emptyExcept = (not?: { row: number; col: number }) => {
    for (let row = 0; row < gridSize; row++) for (let col = 0; col < gridSize; col++) {
      if (!occupied.has(`${row}-${col}`) && !(not && not.row === row && not.col === col)) return `cell-${row}-${col}`;
    }
    throw new Error('spatial-scene: no empty cell for a wrong placement');
  };
  switch (c.type) {
    case 'identify': case 'describe': {
      const pick = wrong ? (c.options ?? []).find(o => o !== c.correctPosition)! : c.correctPosition;
      return [{ type: 'choose', label: positionLabel(pick) }, { type: 'check' }];
    }
    case 'follow_directions': {
      const from = step ? Number(step.split(' ')[0]) - 1 : 0;
      const steps = c.steps ?? [];
      // Cells the earlier steps already filled are not tappable.
      steps.slice(0, from).forEach(s => occupied.add(`${s.correctCell.row}-${s.correctCell.col}`));
      if (wrong) return [{ type: 'touch', target: emptyExcept(steps[from]?.correctCell) }];
      return steps.slice(from).map(s => ({ type: 'touch' as const, target: `cell-${s.correctCell.row}-${s.correctCell.col}` }));
    }
    default:
      // place, place_in, place_between. A wrong placement is an empty cell no right answer occupies.
      (c.acceptableCells ?? []).forEach(a => occupied.add(`${a.row}-${a.col}`));
      return [{ type: 'touch', target: wrong ? emptyExcept(c.correctCell) : `cell-${c.correctCell!.row}-${c.correctCell!.col}` },
        { type: 'check' }];
  }
}
