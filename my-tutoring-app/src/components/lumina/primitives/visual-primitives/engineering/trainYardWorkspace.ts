/**
 * Train yard on the shared tutor/JEV teaching workspace (born bound, plain shape).
 *
 * Every job is one gesture item: the learner builds a consist and presses Highball, and the train
 * run is the check. The key — which car carries the cargo, how many cars and engines — never
 * reaches the tutor; the scene names the job, the train the learner built, and, after a run, the
 * evidence the run printed on screen.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  CAR_ORDER, describeLoad, TRAIN_CARS, type Consist, type TrainRun, type TrainYardChallenge, type TrainYardTask,
} from './trainYardModel';

export { trainMatches, trainYardMiss, TRAIN_YARD_MISSES, type TrainYardMiss } from './trainYardModel';

export const trainYardAssignment = (c: TrainYardChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.instruction, response: 'gesture' });

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

/** What the learner controls in each task, and what the yard sets for them. */
const TASK_CONTROLS: Record<TrainYardTask, string> = {
  match_car: 'The learner chooses one kind of car with the yard buttons; the yard then couples the cars and the engines '
    + "the job needs for that kind. Only the choice of car kind is the learner's.",
  enough_cars: 'The yard shows only the kind of car that carries this cargo and adds the engines itself; the learner adds '
    + "and removes cars. Only the number of cars is the learner's.",
  enough_pull: 'The yard has coupled the loaded cars; the learner adds and removes engines. Only the number of engines is '
    + "the learner's.",
  build_train: 'The learner adds and removes engines and cars with the yard buttons.',
};

/** `consist` is the train that will run: the learner's part plus what the yard set (`yardConsist`). */
export interface TrainYardView { consist: Consist; phase: 'building' | 'running' | 'ran'; lastRun: TrainRun | null; runs: number }

export function trainYardScene(c: TrainYardChallenge, view: TrainYardView): WorkspaceScene {
  return { objects: [], facts: {
    job: `${describeLoad(c)} from ${c.from} to ${c.to}`,
    hill: `${c.hillName}, ${c.grade.toFixed(1)}% grade`,
    trainNow: describeConsist(view.consist),
    runsSoFar: view.runs,
    ...(view.lastRun ? { lastRunShowed: describeRunEvidence(c, view.lastRun) } : {}),
    constraints: `${TASK_CONTROLS[c.type]} The learner presses Highball to send the `
      + 'train. The run is the check: it loads the cargo, climbs the hill, and after the run shows the train weight and the pull the hill '
      + 'needed. '
      + (c.type === 'match_car' ? 'The yard shows how each car is built.'
        : 'The yard shows what each car holds and how it is built, and what each engine pulls and weighs.'),
  } };
}
