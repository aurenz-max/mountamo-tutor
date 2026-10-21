/**
 * Train yard on the shared tutor/JEV teaching workspace, through its boss (`trainYard.boss.ts`).
 *
 * Every job is one gesture item: the learner builds a consist and presses Highball, and the train
 * run is the check. The key — which car carries the cargo, how many cars and engines — never
 * reaches the tutor; the scene names the job, the train the learner built, and, after a run, the
 * evidence the run printed on screen. What the learner presses is the card's `moves`.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  CAR_ORDER, describeLoad, TRAIN_CARS, type Consist, type TrainRun, type TrainYardChallenge,
} from './trainYardModel';

export { trainYardMiss } from './trainYardModel';

/** "2 engines, 12 hopper cars and 1 boxcar" — the learner's own train. */
export function describeConsist(consist: Consist): string {
  const parts = CAR_ORDER.filter(t => (consist.cars[t] ?? 0) > 0)
    .map(t => `${consist.cars[t]} ${TRAIN_CARS[t].name.toLowerCase()}${consist.cars[t] === 1 ? '' : 's'}`);
  const engines = `${consist.engines} engine${consist.engines === 1 ? '' : 's'}`;
  return parts.length ? `${engines}, ${parts.join(', ')}` : `${engines} and no cars`;
}

/** The checked work, in the learner's terms: the train they sent. */
export const describeTrainWork = (consist: Consist) => `Sent a train with ${describeConsist(consist)}`;

const round = (n: number) => Math.round(n).toLocaleString('en-US');

/** What the last run showed on screen, as the learner saw it. */
export function describeRunEvidence(c: TrainYardChallenge, run: TrainRun): string {
  const parts = [`Loaded ${describeLoad(c, run.loaded)}${run.leftover > 0 ? `, left ${describeLoad(c, run.leftover)} behind` : ''}`];
  if (run.wrongCars > 0) parts.push(`${run.wrongCars} car${run.wrongCars === 1 ? '' : 's'} could not carry the ${c.cargo} and rode empty`);
  parts.push(`train weighed ${round(run.trainTons)} tons`);
  parts.push(`${c.hillName} needed ${round(run.hillPull)} tons of pull and the engines gave ${round(run.enginePull)}`);
  parts.push(run.climbs ? 'the train climbed the hill' : 'the train stalled on the hill');
  return parts.join('; ');
}

/** `consist` is the train that will run: the learner's part plus what the yard set (`yardConsist`). */
export interface TrainYardView { consist: Consist; phase: 'building' | 'running' | 'ran'; lastRun: TrainRun | null; runs: number }

/** What the yard shows beside the controls, by task: the facts a learner reasons from. */
function onTheCards(c: TrainYardChallenge): string {
  if (c.type === 'match_car') return 'Each car card says how the car is built, never what it carries, and no card shows what a car holds.';
  const cars = c.type === 'enough_pull' ? '' : 'Each car card says how the car is built and what one car holds. ';
  const rule = c.type === 'enough_cars' ? ''
    : 'The engine card says what one engine pulls and weighs, and the rule of the rails is printed under it: every 100 t '
      + 'of train needs 1 t of pull for each 1% of hill, plus a little more to roll. ';
  return `${cars}${rule}The train's weight and the pull the hill needs show only after a run.`;
}

export function trainYardScene(c: TrainYardChallenge, view: TrainYardView): SceneOf {
  return { objects: [], facts: {
    job: `${describeLoad(c)} from ${c.from} to ${c.to}`,
    hill: `${c.hillName}, ${c.grade.toFixed(1)}% grade`,
    trainNow: describeConsist(view.consist),
    runsSoFar: view.runs,
    ...(view.lastRun ? { lastRunShowed: describeRunEvidence(c, view.lastRun) } : {}),
    constraints: onTheCards(c),
  } };
}
