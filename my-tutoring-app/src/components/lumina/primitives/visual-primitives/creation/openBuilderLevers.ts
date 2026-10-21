/**
 * The in-item levers on an open-builder project (`/add-support-tiers`, report
 * qa/eval-reports/open-builder-levers-2026-10-08.md). No real-learner evidence: the misses are the building buddy's
 * (`missing_part`, `does_not_work`), seen on the 10-06 vision drive's unfinished builds. Declared once as a lever set
 * (`OPEN_BUILDER_LEVERS`, `bossLevers.ts`). Pure: the component draws from these, the tests hold each leak rule.
 *
 * There is no key: many builds meet a goal. So no lever may show a build, a block, a block position or a count of
 * blocks. Help shows more of the JOB, which is in the scenery and the goal, never of a build:
 * - `job_marks` (marks) marks on the scenery the goal's job is about: a flag on each river bank at the water, a dashed
 *   line at the giraffe's head, a flag on the cliff top. Every mark sits on terrain or on a prop (`marksLeak`), and
 *   is an aid stripped from the buddy's picture.
 * - `goal_parts` (clue) picture cards of the parts the goal names (walls, a roof; a head, a body, two arms, two legs),
 *   never a block kind the goal does not say, a number or a place (`partsLeak`; the set's `answersOf` checks the
 *   block kinds again on its words).
 * - `smaller_job` (easier) an ungraded project in other scenery with a smaller job of the same kind: a narrow stream
 *   for the river, a pony for the giraffe, one tower for the castle. Id `<item>~simpler`; never the item's scene or
 *   any session scene (`practiceLeaks`). The truck has none: one demand (wheels) is already the plainest job.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import {
  BLOCK_KINDS, SCENES, groundAt, type OpenBuilderChallenge, type PracticeSceneId, type SceneId,
} from './openBuilderModel';
import { OPEN_BUILDER_MISSES } from './openBuilder.card';

export const MARKS_LEVER = 'job_marks';
export const PARTS_LEVER = 'goal_parts';
export const SIMPLER_LEVER = 'smaller_job';
export const PRACTICE_SUFFIX = '~simpler';

// ── job marks ───────────────────────────────────────────────────────────────

/** A flag stands on the ground of a column; a ring circles a prop; a line runs level at a height from one column to another. */
export type BoardMark =
  | { kind: 'flag'; col: number; row: number }
  | { kind: 'ring'; prop: number }
  | { kind: 'line'; row: number; fromCol: number; toCol: number };

interface JobMarks { marks: BoardMark[]; fact: string }

const JOB_MARKS: Partial<Record<SceneId, JobMarks>> = {
  bridge: { marks: [{ kind: 'flag', col: 3, row: 2 }, { kind: 'flag', col: 8, row: 2 }],
    fact: 'A flag on each river bank, at the edge of the water' },
  giraffe: { marks: [{ kind: 'line', row: 6, fromCol: 0, toCol: 8 }],
    fact: 'A dashed line across the board, level with the top of the giraffe\'s head' },
  'cliff-steps': { marks: [{ kind: 'ring', prop: 1 }, { kind: 'flag', col: 9, row: 5 }],
    fact: 'A ring around the bunny, and a flag at the top edge of the cliff' },
  'sheep-wall': { marks: [0, 1, 2, 3, 4].map(prop => ({ kind: 'ring' as const, prop })),
    fact: 'A ring around the sheep and the lamb, and around each flower' },
};

/**
 * The leak rule: a mark marks scenery, never a place to build. A flag stands on the ground or a bank, out of the water;
 * a ring circles a prop; a line is level with the top of a prop and stops at it. None may stand in open air.
 */
export function marksLeak(sceneId: SceneId, marks: readonly BoardMark[]): boolean {
  const scene = SCENES[sceneId];
  const inWater = (col: number) => !!scene.water && col >= scene.water[0] && col <= scene.water[1];
  return marks.some(m => {
    if (m.kind === 'flag') return inWater(m.col) || m.row !== groundAt(scene, m.col);
    if (m.kind === 'ring') return !scene.props[m.prop];
    const prop = scene.props.find(p => p.row + p.size === m.row);
    return !prop || m.toCol > prop.col || m.fromCol < 0 || m.fromCol > m.toCol;
  });
}

export const jobMarks = (c: OpenBuilderChallenge): JobMarks | null => {
  const m = JOB_MARKS[c.sceneId];
  return m && !marksLeak(c.sceneId, m.marks) ? m : null;
};

// ── goal parts ──────────────────────────────────────────────────────────────

export interface GoalPart { glyph: string; word: string }

const GOAL_PARTS: Partial<Record<SceneId, GoalPart[]>> = {
  'puppy-house': [{ glyph: '🧱', word: 'walls' }, { glyph: '☂️', word: 'a roof' }],
  castle: [{ glyph: '🗼', word: 'a tall tower' }, { glyph: '🗼', word: 'another tall tower' }, { glyph: '🏯', word: 'a wall between them' }],
  rocket: [{ glyph: '📏', word: 'tall' }, { glyph: '⛰️', word: 'pointy on top' }],
  robot: [{ glyph: '🙂', word: 'a head' }, { glyph: '👕', word: 'a body' }, { glyph: '💪', word: 'two arms' }, { glyph: '🦵', word: 'two legs' }],
  truck: [{ glyph: '🛞', word: 'wheels' }, { glyph: '🍎', word: 'room for the apples' }],
};

const words = (s: string) => s.toLowerCase().match(/[a-z]+/g) ?? [];
/** A block kind named by its word, singular or plural (`wheels` names the wheel). */
const namesKind = (text: string) => {
  const w = new Set(words(text).map(x => x.replace(/s$/, '')));
  return BLOCK_KINDS.filter(k => w.has(k));
};
const PLACE_WORDS = ['left', 'right', 'column', 'row', 'middle', 'corner', 'under', 'beside', 'next'];

/**
 * The leak rule: a card names a part the goal asks for, never how to build it. No block kind the scene's own goal
 * does not already say, no digits, no place words.
 */
export function partsLeak(sceneId: SceneId, parts: readonly GoalPart[]): boolean {
  const said = new Set(namesKind(SCENES[sceneId].goal));
  return parts.some(p => /\d/.test(p.word) || namesKind(p.word).some(k => !said.has(k))
    || words(p.word).some(w => PLACE_WORDS.includes(w)));
}

export const goalParts = (c: OpenBuilderChallenge): GoalPart[] | null => {
  const parts = GOAL_PARTS[c.sceneId];
  return parts && !partsLeak(c.sceneId, parts) ? parts : null;
};

export const partsFact = (parts: readonly GoalPart[]) =>
  `Picture cards beside the board for what the goal asks for: ${parts.map(p => p.word).join(', ')}`;

// ── the smaller job ─────────────────────────────────────────────────────────

/** Each menu scene's smaller job in other scenery. The truck has none: "with wheels" is one demand already. */
export const SIMPLER_SCENE: Partial<Record<SceneId, PracticeSceneId>> = {
  bridge: 'stream', giraffe: 'pony', 'cliff-steps': 'ledge', 'puppy-house': 'kitten-shade', castle: 'queen-tower',
  rocket: 'little-rocket', robot: 'little-robot', 'sheep-wall': 'duck-wall',
};

/** The leak rule: never the item's id, scene or goal, and never the scenery of any project in the lesson. */
export function practiceLeaks(practice: OpenBuilderChallenge, c: OpenBuilderChallenge,
  session: readonly OpenBuilderChallenge[]): boolean {
  return practice.id === c.id || practice.sceneId === c.sceneId || practice.goal.trim() === c.goal.trim()
    || practice.type !== c.type || session.some(x => x.sceneId === practice.sceneId);
}

export function practiceItem(c: OpenBuilderChallenge, session: readonly OpenBuilderChallenge[]): OpenBuilderChallenge | null {
  const to = SIMPLER_SCENE[c.sceneId];
  if (!to) return null;
  const scene = SCENES[to];
  const practice: OpenBuilderChallenge = { id: `${c.id}${PRACTICE_SUFFIX}`, type: c.type, sceneId: to, title: scene.title, goal: scene.goal };
  return practiceLeaks(practice, c, session) ? null : practice;
}

/** The session item a practice id stands in for. */
export const practiceParent = (id: string | null | undefined, challenges: readonly OpenBuilderChallenge[]) =>
  id?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === id) ?? null : null;

// ── the lever set ───────────────────────────────────────────────────────────

/** Easy starts with the item's help shown; a starting position is not a pull. */
export const helpStartsShown = (c: OpenBuilderChallenge) => c.supportTier === 'easy';

/** The help levers shown from the start on an easy item, passed to `declare` and `onScreen` as already on screen. */
export const startingLevers = (c: OpenBuilderChallenge): string[] => (helpStartsShown(c) ? [MARKS_LEVER, PARTS_LEVER] : []);

/**
 * The block kinds the scene's goal does not say, which a worded lever must never name: naming one says which block to
 * use. The scene's goal, as `partsLeak` reads it: the cards are the scene's, whatever words the lesson gave its goal.
 */
const unsaidKinds = (c: OpenBuilderChallenge) => {
  const said = new Set(namesKind(SCENES[c.sceneId].goal));
  return BLOCK_KINDS.filter(k => !said.has(k)).flatMap(k => [k, `${k}s`]);
};

const FENCE = 'Never say where a block goes, which block to use or how many, and never describe a finished build.';

/**
 * The levers, declared once (`bossLevers.ts`). The set's context is the session's projects, whose scenery the smaller
 * job must not use. None is offered on a practice project: the component declares nothing then.
 */
export const OPEN_BUILDER_LEVERS = leverSet<OpenBuilderChallenge, readonly OpenBuilderChallenge[]>({
  missesOf: () => OPEN_BUILDER_MISSES,
  answersOf: c => unsaidKinds(c),
  specs: [
    { id: MARKS_LEVER, type: 'marks', answers: 'all',
      when: 'The build stops short of what the goal is about, or the learner does not see what it has to reach, cross or keep apart.',
      does: c => `Marks the scenery the goal is about (${jobMarks(c)!.fact.toLowerCase()}); nothing is drawn where blocks could go. `
        + `You may point to the marks and ask what the build has to do there. ${FENCE}`,
      content: c => jobMarks(c),
      fact: (marks: JobMarks) => marks.fact },
    { id: PARTS_LEVER, type: 'clue', answers: 'all',
      when: 'A part the goal names is not in the build yet, or the learner has lost track of what the goal asks for.',
      does: 'Shows a picture card beside the board for each part the goal asks for. You may read the cards and ask which '
        + `ones the build has; the learner decides which is missing. ${FENCE}`,
      content: c => goalParts(c),
      fact: (parts: GoalPart[]) => partsFact(parts) },
    { id: SIMPLER_LEVER, type: 'easier', carrier: 'shown', answers: 'all',
      when: 'The learner cannot do this project even with the help on screen: a smaller job first.',
      does: 'Opens an ungraded practice project in other scenery with a smaller job of the same kind; then this project '
        + 'comes back on an empty board. Never compare the two builds block by block.',
      content: (c, session) => practiceItem(c, session) },
  ],
});

export const PRACTICE_NOTE = 'A smaller practice project, ungraded; the full project comes back on an empty board after it.';

/** The ring around a prop, in cells: its centre and radius. */
export function ringOf(sceneId: SceneId, prop: number) {
  const p = SCENES[sceneId].props[prop];
  return { cx: p.col + p.size / 2, cy: p.row + p.size / 2, r: p.size * 0.62 };
}
