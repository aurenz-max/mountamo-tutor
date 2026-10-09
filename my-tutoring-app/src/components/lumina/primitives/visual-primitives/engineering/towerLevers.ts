/**
 * The in-item levers on tower-stacker's open builds (/add-eval-modes references/build-mode.md), designed from why
 * learners fail a tower. Working out what keeps it up IS the task, so every item starts bare and the levers come on
 * a miss, never from the tier.
 * - `balance_point` (help): draws each separate part's balance point with a line straight down to the ground, and
 *   marks the ends of what holds that part up. A tower tips (or the wind wins) when the line falls outside, or near
 *   the downwind end of, what holds it; children cannot see a balance point, so they stack by eye.
 * - `piece_count` (help, build_few): under the scene, how many pieces the tower uses. Never the number allowed
 *   beside it (the ask on screen says it).
 * - `wind_gust` (help, build_windproof): a "Try a gust" button that blows the same wind on the tower, ungraded, and
 *   shows which part goes over. Designers test before they hand in; a child who only sees the verdict cannot.
 * - `shorter_tower` (simplify): an ungraded ask for the same build to a lower line, then the full item.
 * `too_short` has no lever: the green line is on screen.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import { towerAsk, windFor, type TowerChallenge, type TowerMiss } from './towerWorkspace';

export const BALANCE_LEVER = 'balance_point';
export const COUNT_LEVER = 'piece_count';
export const GUST_LEVER = 'wind_gust';
export const SHORTER_LEVER = 'shorter_tower';

const SHORTER = '~shorter';
export const isPracticeTower = (c: Pick<TowerChallenge, 'id'>) => c.id.endsWith(SHORTER);

/** The easier ask: the same build, the line a third lower (at least 3 tall). */
export function shorterTower(c: TowerChallenge): TowerChallenge | null {
  if (isPracticeTower(c) || c.targetHeight <= 3) return null;
  const targetHeight = Math.max(3, c.targetHeight - Math.ceil(c.targetHeight / 3));
  // A windproof practice gets the wind for its own height: the parent's wind would let a plain column pass.
  return { ...c, id: `${c.id}${SHORTER}`, targetHeight, instruction: towerAsk(c),
    ...(c.type === 'build_windproof' ? { wind: windFor(targetHeight) } : {}) };
}

export function towerLevers(c: TowerChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly TowerMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  const tips: TowerMiss[] = c.type === 'build_windproof' ? ['tips_over', 'blown_over'] : ['tips_over'];
  return [
    lever(BALANCE_LEVER, 'help', tips,
      c.type === 'build_windproof' ? 'The learner\'s tower tips, or the wind blows it over, and they cannot see why.' : 'The learner\'s tower tips over and they cannot see why.',
      'Puts a dot at the balance point of each separate part of the learner\'s tower, with a line straight down from it, and '
        + 'marks the two ends of what holds that part up. It moves no piece and says nothing about where one should go.'),
    ...(c.type === 'build_few' ? [lever(COUNT_LEVER, 'help', ['too_many_pieces'],
      'The learner loses count of the pieces in the tower.',
      'Shows under the scene how many pieces the learner\'s tower uses. Never the number allowed.')] : []),
    ...(c.type === 'build_windproof' ? [lever(GUST_LEVER, 'help', ['blown_over'],
      'The learner needs to test the tower in the wind before handing it in.',
      'Adds a "Try a gust" button that blows the same wind on the learner\'s tower without checking it, and shows the part '
        + 'that goes over, if any. It changes no piece.')] : []),
    ...(shorterTower(c) ? [lever(SHORTER_LEVER, 'simplify', c.type === 'build_few' ? ['tips_over', 'too_many_pieces'] : tips,
      'The learner cannot build a tower this tall yet.',
      'Opens an easier ask first, the same kind of tower to a lower green line, on an empty building area. It is not graded; '
        + 'the full item comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. */
export function leverFacts(c: TowerChallenge | null, pulled: readonly string[]): string {
  if (!c) return '';
  return [
    pulled.includes(BALANCE_LEVER) && 'Each separate part of the tower shows its balance point, a line straight down from it, and the ends of what holds it up.',
    pulled.includes(COUNT_LEVER) && 'Under the scene is how many pieces the tower uses.',
    pulled.includes(GUST_LEVER) && 'A "Try a gust" button tests the tower in the wind without checking it.',
  ].filter((s): s is string => !!s).join(' ');
}
