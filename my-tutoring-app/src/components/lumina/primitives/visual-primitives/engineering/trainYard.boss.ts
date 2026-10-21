/**
 * train-yard's boss (`components/live-activity/boss.ts`), bespoke because every job is a train the learner builds and
 * the run checks: the card is `trainYard.card.ts`; this file validates a session, lists its jobs, asks one, carries
 * the lever set and plays the harness.
 */
import type { TrainYardData } from './TrainYard';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { trainYardCard } from './trainYard.card';
import { TRAIN_LEVERS, practiceParent, simplerJob } from './trainYardLevers';
import {
  carButtonName, carFor, fewestCars, fewestEngines, TRAIN_YARD_TASKS, type TrainYardChallenge, type TrainYardMiss,
} from './trainYardModel';

/** Reject a yard the workspace cannot run: every job needs an id, a task, an instruction, a load and a hill. */
export function validateTrainYardData(value: unknown): TrainYardData {
  const d = value as TrainYardData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated train yard has no title.');
  const jobs = Array.isArray(d.challenges) ? d.challenges : [];
  if (!jobs.length || jobs.length > 12 || new Set(jobs.map(c => c?.id)).size !== jobs.length
      || jobs.some(c => !c || typeof c.id !== 'string' || !c.id || !TRAIN_YARD_TASKS.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || typeof c.amount !== 'number' || !(c.amount > 0) || !Number.isFinite(c.grade)))
    throw new Error('Generated train yard has invalid lesson content.');
  return d;
}

/**
 * The learner's part of the train through the yard's own buttons, then Highball. Right: the car kind for the cargo,
 * the fewest cars, the fewest engines. Wrong: a car that cannot carry the cargo (match_car, build_train) or one car /
 * one engine too many (enough_cars, enough_pull).
 */
function playJob(right: boolean, c: TrainYardChallenge): DriverInput[] {
  const car = carFor(c);
  const wrongKind = c.carChoices?.find(k => k !== car) ?? (car === 'boxcar' ? 'tank' : 'boxcar');
  const extra = right ? 0 : 1;
  const repeat = (label: string, n: number): DriverInput[] => Array.from({ length: n }, () => ({ type: 'choose', label }));
  const send: DriverInput = { type: 'choose', label: 'Highball! Send the train' };
  if (c.type === 'match_car') return [{ type: 'choose', label: `Choose ${carButtonName(right ? car : wrongKind)}` }, send];
  if (c.type === 'enough_cars') return [...repeat(`Add ${carButtonName(car)}`, fewestCars(c) + extra), send];
  if (c.type === 'enough_pull') return [...repeat('Add an engine', fewestEngines(c) + extra), send];
  return [...repeat('Add an engine', fewestEngines(c)), ...repeat(`Add ${carButtonName(right ? car : wrongKind)}`, fewestCars(c)), send];
}

export const trainYardBoss = defineBoss<TrainYardData, TrainYardChallenge, TrainYardMiss>({
  card: trainYardCard,
  validate: validateTrainYardData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // A build the run checks: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: TRAIN_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/engineering/TrainYard.tsx',
    instanceId: 'yard',
    defaults: { grade: 'Grade 3', mode: 'build_train', topic: 'Passenger trains and freight trains: how they move people and goods' },
    mounted: 'canvas[aria-label^="The route from"]',
    // The session job, or the easier practice job (`~simpler`) rebuilt from its parent.
    current: ctx => {
      const data = ctx.data as TrainYardData;
      const parent = practiceParent(String(ctx.itemId ?? ''));
      const full = (data.challenges ?? []).find(c => c.id === (parent ?? ctx.itemId));
      return parent && full ? simplerJob(full, data.gradeBand ?? '3-5') ?? undefined : full;
    },
    play: (right, c) => playJob(right, c),
  },
});
