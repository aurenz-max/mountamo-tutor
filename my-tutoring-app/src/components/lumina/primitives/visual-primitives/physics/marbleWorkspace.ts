/**
 * Marble Run Park's scene on the shared tutor/JEV teaching workspace. Every item is an experiment the activity checks
 * (the card, `marbleRunPark.card.ts`, names the moves; the boss gives the assignment), so no key reaches the tutor. The
 * scene carries what is drawn and what the learner's runs did: the pegs, how high the loop's top is beside them, the
 * peg the marble sits on, and each run. Which peg works is never in it: the learner finds out by running the marble.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { OUTCOME_WORDS, pegName, type LoopChallenge, type LoopRun } from './marbleModel';

export interface LoopView {
  peg: number | null;
  /** The runs so far, oldest first. */
  runs: readonly LoopRun[];
  /** A run is playing now. */
  running: boolean;
}

/** Where the loop's top sits among the pegs, as drawn: "between peg 3 and peg 4". */
export function loopTopWords(c: LoopChallenge): string {
  const top = 2 * c.loopR;
  const above = c.pegs.findIndex(h => h >= top);
  if (above === -1) return 'higher than every peg';
  if (above === 0) return 'lower than peg 1';
  return c.pegs[above] === top ? `level with ${pegName(above)}` : `between ${pegName(above - 1)} and ${pegName(above)}`;
}

export function loopScene(c: LoopChallenge, view: LoopView): SceneOf {
  const facts: Record<string, string | number> = {
    park: 'a marble run drawn in 3D on a table: a wooden ramp on the left with 8 numbered start pegs beside it (peg 1 lowest, '
      + `peg 8 highest), a flat run${c.carpet ? ' with a strip of carpet on it' : ''}, a loop-the-loop, and a bell at the far end`,
    step: view.running ? 'the marble is rolling' : view.runs.length ? 'running the marble from pegs and deciding' : 'choosing a peg for the first run',
    goal: c.instruction,
    loopTop: `the top of the loop is ${loopTopWords(c)}`,
    marbleOn: view.peg == null ? 'not on a peg yet' : `sitting on ${pegName(view.peg)}`,
    runs: view.runs.length ? view.runs.map((r, i) => `run ${i + 1}: from ${pegName(r.peg)} it ${OUTCOME_WORDS[r.outcome]}`).join('; ') : 'none yet',
    constraints: 'Before each run the learner says aloud whether the marble will make the loop; the guess is never graded. '
      + 'A lab notebook under the run lists each run.',
  };
  return { objects: [], facts };
}
