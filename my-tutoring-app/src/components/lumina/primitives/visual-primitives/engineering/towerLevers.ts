/**
 * The in-item levers on tower-stacker's open builds (/add-eval-modes references/build-mode.md), designed from why
 * learners fail a tower, declared once as a lever set (`TOWER_LEVERS`, `bossLevers.ts`). Working out what keeps it
 * up IS the task, so every item starts bare and the levers come on a miss, never from the tier.
 * - `balance_point` (marks): draws each separate part's balance point with a line straight down to the ground, and
 *   marks the ends of what holds that part up. A tower tips (or the wind wins) when the line falls outside, or near
 *   the downwind end of, what holds it; children cannot see a balance point, so they stack by eye.
 * - `piece_count` (custom, build_few): under the scene, how many pieces the tower uses. Never the number allowed
 *   beside it (the ask on screen says it).
 * - `wind_gust` (custom, build_windproof): a "Try a gust" button that blows the same wind on the tower, ungraded, and
 *   shows which part goes over. Designers test before they hand in; a child who only sees the verdict cannot.
 * - `shorter_tower` (easier): an ungraded ask for the same build to a lower line, then the full item.
 * `too_short` has no lever: the green line is on screen (the card lists it as unanswered).
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import { TOWER_MISSES } from './towerStacker.card';
import { towerAsk, windFor, type TowerChallenge, type TowerMiss, type TowerMode } from './towerWorkspace';

export const BALANCE_LEVER = 'balance_point';
export const COUNT_LEVER = 'piece_count';
export const GUST_LEVER = 'wind_gust';
export const SHORTER_LEVER = 'shorter_tower';

const SHORTER = '~shorter';
export const isPracticeTower = (c: Pick<TowerChallenge, 'id'>) => c.id.endsWith(SHORTER);
export const practiceParent = (id: string) => (id.endsWith(SHORTER) ? id.slice(0, -SHORTER.length) : null);

/** The easier ask: the same build, the line a third lower (at least 3 tall). */
export function shorterTower(c: TowerChallenge): TowerChallenge | null {
  if (isPracticeTower(c) || c.targetHeight <= 3) return null;
  const targetHeight = Math.max(3, c.targetHeight - Math.ceil(c.targetHeight / 3));
  // A windproof practice gets the wind for its own height: the parent's wind would let a plain column pass.
  return { ...c, id: `${c.id}${SHORTER}`, targetHeight, instruction: towerAsk(c),
    ...(c.type === 'build_windproof' ? { wind: windFor(targetHeight) } : {}) };
}

type Spec = LeverSpec<TowerChallenge, null>;

/** The misses a part falling answers in a mode: tipping, and on windproof the wind. */
const FALLS: Record<TowerMode, readonly TowerMiss[]> = {
  build_tall: ['tips_over'], build_few: ['tips_over'], build_windproof: ['tips_over', 'blown_over'],
};
/** What the shorter tower answers in a mode: a part falling, and on build_few too many pieces. */
const SHORTER_ANSWERS: Record<TowerMode, readonly TowerMiss[]> = {
  build_tall: FALLS.build_tall, build_few: ['tips_over', 'too_many_pieces'], build_windproof: FALLS.build_windproof,
};
const MODES = Object.keys(TOWER_MISSES) as TowerMode[];

const balance = (mode: TowerMode): Spec => ({
  id: BALANCE_LEVER, type: 'marks', modes: [mode], answers: FALLS[mode],
  when: mode === 'build_windproof' ? 'The learner\'s tower tips, or the wind blows it over, and they cannot see why.'
    : 'The learner\'s tower tips over and they cannot see why.',
  does: 'Puts a dot at the balance point of each separate part of the learner\'s tower, with a line straight down from it, '
    + 'and marks the two ends of what holds that part up. It moves no piece and says nothing about where one should go.',
  fact: 'Each separate part of the tower shows its balance point, a line straight down from it, and the ends of what holds it up.',
});

const shorter = (mode: TowerMode): Spec => ({
  id: SHORTER_LEVER, type: 'easier', modes: [mode], answers: SHORTER_ANSWERS[mode],
  when: 'The learner cannot build a tower this tall yet.',
  does: 'Opens an easier ask first, the same kind of tower to a lower green line, on an empty building area. It is not '
    + 'graded; the full item comes back after it.',
  content: c => shorterTower(c),
});

/**
 * Every lever, in the order the observer offers them: the help levers before shorter_tower. A practice tower offers
 * none (the component declares nothing while one is on screen).
 */
export const TOWER_LEVERS = leverSet<TowerChallenge, null>({
  modeOf: c => c.type,
  missesOf: mode => TOWER_MISSES[mode as TowerMode] ?? [],
  specs: [
    ...MODES.map(balance),
    { id: COUNT_LEVER, type: 'custom', carrier: 'shown', modes: ['build_few'], answers: ['too_many_pieces'],
      why: 'It writes a running count of the learner\'s own pieces under the scene: no mark on a piece, no new arrangement, '
        + 'and not a different item.',
      when: 'The learner loses count of the pieces in the tower.',
      does: 'Shows under the scene how many pieces the learner\'s tower uses. Never the number allowed.',
      fact: 'Under the scene is how many pieces the tower uses.' },
    { id: GUST_LEVER, type: 'custom', carrier: 'shown', modes: ['build_windproof'], answers: ['blown_over'],
      why: 'It adds a test the learner runs on their own tower (the item\'s wind, ungraded): a tool, not a mark, a layout '
        + 'or a different item.',
      when: 'The learner needs to test the tower in the wind before handing it in.',
      does: 'Adds a "Try a gust" button that blows the same wind on the learner\'s tower without checking it, and shows the '
        + 'part that goes over, if any. It changes no piece.',
      fact: 'A "Try a gust" button tests the tower in the wind without checking it.' },
    ...MODES.map(shorter),
  ],
});
