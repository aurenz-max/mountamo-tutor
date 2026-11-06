/**
 * The in-item levers on a marble-run-park item, as one lever set (`bossLevers.ts`; `/add-support-tiers`). No
 * real-learner evidence yet: the misses are what `loopMiss` observes, and the documented misconception that a start
 * level with the top of the loop is high enough (energy is only height, nothing is needed for speed at the top).
 *
 * - `loop_top_line` (marks): a dashed line level with the top of the loop, across to the ramp, so the learner sees
 *   which pegs are below the top. Answers `too_low`. It never marks a peg: the working pegs are some way above it.
 * - `xray` (marks): an energy bar beside the run, no numbers. Blue is height, orange is speed, grey is what rubbing on
 *   the track (and the carpet) took away. It is full blue on the peg and changes as the marble runs; at the top of the
 *   loop a start level with the top has almost nothing left as speed. Answers `top_height_only`.
 * - `peg_results` (marks): every peg the learner ran from is ringed green (it made the loop) or red (it did not), and
 *   the notebook is sorted by peg. Only the learner's own runs: an untested peg gets no ring. Answers `not_lowest`.
 * - `one_step_less` (easier): a different loop, one step simpler and ungraded: "lowest" becomes "any peg that works";
 *   the carpet comes off. None on an "any peg" item.
 *
 * When they come is the lesson's support tier: at easy the loop-top line is drawn from the start (`startLevers`).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import { MARBLE_MISSES_BY_MODE } from './marbleRunPark.card';
import { ROLL, G, loopCandidates, type LoopRun, type MarbleChallenge, type Motion } from './marbleModel';

export const LOOP_TOP_LEVER = 'loop_top_line';
export const XRAY_LEVER = 'xray';
export const PEG_RESULTS_LEVER = 'peg_results';
export const EASIER_LEVER = 'one_step_less';
export const PRACTICE_SUFFIX = '~easier';
export const isPractice = (c: Pick<MarbleChallenge, 'id'>) => c.id.endsWith(PRACTICE_SUFFIX);
export const PRACTICE_NOTE = 'An easier practice item, ungraded; the full item comes back after it.';

/** What the screen shows that a lever needs: the marble is on a peg (the bar has something to show), the runs so far. */
export interface MarbleLeverCtx { onPeg: boolean; runs: readonly LoopRun[] }

/**
 * The same task one step simpler on a different loop, or null on an "any peg" item. Lowest with carpet becomes lowest
 * without; lowest becomes any. A different loop size, so it never repeats the learner's item or its pegs.
 */
export function practiceItem(c: MarbleChallenge): MarbleChallenge | null {
  if (isPractice(c) || c.goal === 'any') return null;
  const easier = loopCandidates(c.carpet ? 'medium' : 'easy').find(p => p.loopR !== c.loopR);
  return easier ? { ...easier, id: `${c.id}${PRACTICE_SUFFIX}` } : null;
}

export const practiceParent = (itemId: string | null | undefined, challenges: readonly MarbleChallenge[]) =>
  itemId?.endsWith(PRACTICE_SUFFIX) ? challenges.find(c => `${c.id}${PRACTICE_SUFFIX}` === itemId) ?? null : null;

/** The energy bar at one frame of a run, as parts of the highest peg's energy (so a higher peg has a taller bar). */
export interface EnergyParts { height: number; speed: number; lost: number }

export function energyAt(motion: readonly Motion[], i: number, topPeg: number): EnergyParts {
  const m = motion[Math.max(0, Math.min(motion.length - 1, i))];
  const start = G * motion[0].h;
  const scale = G * topPeg || 1;
  const height = G * Math.max(0, Math.min(m.h, motion[0].h));
  // Rolling: the spin carries part of the motion energy too (ROLL). Never more than the start had.
  const speed = Math.min(0.5 * ROLL * m.v * m.v, Math.max(0, start - height));
  return { height: height / scale, speed: speed / scale, lost: Math.max(0, start - height - speed) / scale };
}

const notPractice = (c: MarbleChallenge) => (isPractice(c) ? null : true);

export const MARBLE_LEVERS = leverSet<MarbleChallenge, MarbleLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => MARBLE_MISSES_BY_MODE[mode as keyof typeof MARBLE_MISSES_BY_MODE] ?? [],
  specs: [
    { id: LOOP_TOP_LEVER, type: 'marks', answers: ['too_low'],
      when: 'The learner starts the marble lower than the top of the loop.',
      does: 'Draws a dashed line level with the top of the loop, across to the ramp, with no words: the learner sees which '
        + 'pegs are below the top of the loop.',
      content: notPractice,
      fact: 'A dashed line is drawn level with the top of the loop, across to the ramp.' },
    { id: XRAY_LEVER, type: 'marks', answers: ['top_height_only', 'too_low'],
      when: 'The learner thinks starting as high as the top of the loop is enough.',
      does: 'Shows an energy bar beside the run, with no numbers: blue for height, orange for speed, grey for what rubbing '
        + 'took away. It is all blue on the peg and changes as the marble runs, so the learner sees how much speed is left '
        + 'at the top of the loop.',
      content: notPractice,
      offer: (_c, ctx) => ctx.onPeg,
      fact: 'An energy bar beside the run, with no numbers: blue for height, orange for speed, grey for what rubbing took '
        + 'away; it is all blue on the peg and changes as the marble runs.' },
    { id: PEG_RESULTS_LEVER, type: 'marks', answers: ['not_lowest'],
      when: 'The learner found a peg that works but has not tested the pegs below it.',
      does: 'Rings every peg the learner ran the marble from, green where it made the loop and red where it did not, and '
        + 'sorts the notebook by peg. Pegs not run yet get no ring.',
      content: notPractice,
      offer: (_c, ctx) => ctx.runs.length > 0,
      fact: 'Every peg the learner ran the marble from is ringed: green where it made the loop, red where it did not; pegs '
        + 'not run yet have no ring. The notebook is sorted by peg.' },
    { id: EASIER_LEVER, type: 'easier', answers: 'all',
      when: 'The learner cannot yet do this item even with the line and the energy bar.',
      does: c => (c.carpet ? 'Opens an easier loop first: no carpet; find the lowest peg that makes it.'
        : 'Opens an easier loop first: any peg that makes it round.') + ' It is not graded; the full item comes back after it.',
      content: c => practiceItem(c) },
  ],
});
