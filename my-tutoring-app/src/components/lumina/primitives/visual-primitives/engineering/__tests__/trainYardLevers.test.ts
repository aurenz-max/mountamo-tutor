/**
 * The train-yard levers' leak rules and simpler-job builders, per mode, over many generated jobs, and the
 * "this miss, then this lever" table.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../../components/live-activity/runtime/observerLever';
import {
  buildTrainYardChallenge, CAR_ORDER, carFor, fewestCars, fewestEngines, TRAIN_CARS, TRAIN_YARD_TASKS,
  type CargoForm, type TrainJobStory, type TrainYardBand, type TrainYardChallenge, type TrainYardTask,
} from '../trainYardModel';
import {
  CARGO_LOOKS, carTally, isPracticeJob, leverFacts, modelMatch, simplerJob, startLevers, trainWeight, trainYardLevers, workedHill,
} from '../trainYardLevers';

const STORIES: TrainJobStory[] = [
  { title: 'Harvest Rush', cargo: 'grain', cargoForm: 'loose_bulk', from: 'the elevator', to: 'the port', hillName: 'Cedar Hill' },
  { title: 'Winter Fuel', cargo: 'heating oil', cargoForm: 'liquid', from: 'the refinery', to: 'the depot', hillName: 'Raven Pass' },
  { title: 'Timber Run', cargo: 'lumber', cargoForm: 'long_bundles', from: 'the sawmill', to: 'the site', hillName: 'Pine Ridge' },
  { title: 'Parcel Day', cargo: 'packages', cargoForm: 'boxed_goods', from: 'the hub', to: 'the city', hillName: 'Oak Hill' },
  { title: 'New Cars', cargo: 'new cars', cargoForm: 'vehicles', from: 'the plant', to: 'the dealer', hillName: 'Long Climb' },
  { title: 'Morning Commute', cargo: 'commuters', cargoForm: 'people', from: 'the suburb', to: 'downtown', hillName: 'River Climb' },
];

/** A seeded generator, so a failure names a reproducible job. */
function rng(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

function jobs(type: TrainYardTask, band: TrainYardBand, n = 60): TrainYardChallenge[] {
  const out: TrainYardChallenge[] = [];
  for (let i = 0; i < n; i++) {
    const story = STORIES[i % STORIES.length];
    const light = story.cargoForm === 'people' || story.cargoForm === 'vehicles';
    out.push(buildTrainYardChallenge(story, { id: `ty-${i}`, band, type, rng: rng(i + 7),
      targetEngines: light ? 1 : type === 'enough_pull' ? 2 + (i % 2) : 1 + (i % 3) }));
  }
  return out;
}

const words = (s: string): string[] => s.toLowerCase().match(/[a-z]{4,}/g) ?? [];

describe('help leak rules', () => {
  it('cargo_picture: the cargo description shares no word with any car card', () => {
    const cardWords = new Set(CAR_ORDER.flatMap(k => [...words(TRAIN_CARS[k].builtFor), ...words(TRAIN_CARS[k].name)]));
    for (const form of Object.keys(CARGO_LOOKS) as CargoForm[]) {
      expect(words(CARGO_LOOKS[form]).filter(w => cardWords.has(w)), form).toEqual([]);
    }
  });

  it.each(['match_car', 'build_train'] as const)('model_match on %s: never the item\'s cargo form or its car', type => {
    for (const c of jobs(type, '3-5')) {
      const m = modelMatch(c);
      expect(m.form).not.toBe(c.cargoForm);
      expect(m.car).not.toBe(carFor(c));
    }
  });

  it('car_tally: one label per coupled car, never past the learner\'s own count', () => {
    expect(carTally({ engines: 2, cars: { hopper: 3, boxcar: 1 } })).toEqual([
      { kind: 'hopper', totals: [100, 200, 300] }, { kind: 'boxcar', totals: [70] }]);
    expect(carTally({ engines: 1, cars: {} })).toEqual([]);
  });

  it.each(['enough_pull', 'build_train'] as const)('train_weight and worked_hill on %s: no pull for this train, a different worked train', type => {
    for (const band of ['K-2', '3-5'] as const) for (const c of jobs(type, band)) {
      const consist = { engines: 1, cars: { [carFor(c)]: fewestCars(c) } };
      const w = trainWeight(c, consist);
      expect(w.total).toBe(w.engines + w.cars + w.load);
      const worked = workedHill(c);
      expect(worked.grade, c.id).not.toBe(c.grade);
      expect(worked.engines, c.id).not.toBe(fewestEngines(c));
      const facts = leverFacts(c, ['train_weight', 'worked_hill'], consist);
      expect(facts).not.toMatch(/needs? [\d,]+ t of pull for this|this train needs/i);
      expect(facts).not.toContain(`${fewestEngines(c)} engines.`.replace(/^1 engines/, '1 engine'));
    }
  });

  it('no lever fact names the car for the cargo, the fewest cars, or the fewest engines', () => {
    for (const type of TRAIN_YARD_TASKS) for (const c of jobs(type, '3-5', 24)) {
      const all = trainYardLevers(c, [], '3-5').map(l => l.id);
      const facts = leverFacts(c, all, { engines: 0, cars: {} });
      expect(facts.toLowerCase()).not.toContain(TRAIN_CARS[carFor(c)].name.toLowerCase());
      for (const l of trainYardLevers(c, [], '3-5')) expect(`${l.when} ${l.does}`.toLowerCase(), l.id)
        .not.toContain(TRAIN_CARS[carFor(c)].name.toLowerCase());
    }
  });
});

describe('simpler jobs', () => {
  it.each(TRAIN_YARD_TASKS.flatMap(t => (['K-2', '3-5'] as const).map(b => [t, b] as const)))('%s %s: same task, never the item, solvable', (type, band) => {
    let built = 0;
    for (const c of jobs(type, band)) {
      const s = simplerJob(c, band);
      if (!s) continue;
      built++;
      expect(isPracticeJob(s)).toBe(true);
      expect(s.type).toBe(type);
      expect(s.cargoForm).not.toBe(c.cargoForm);
      expect(s.instruction).not.toContain(TRAIN_CARS[carFor(s)].name);
      // Whole-car loads: no rounding on the easier job.
      expect(s.amount % TRAIN_CARS[carFor(s)].holds).toBe(0);
      if (type === 'match_car') {
        expect(s.carChoices).toHaveLength(2);
        expect(s.carChoices).toContain(carFor(s));
      }
      if (type === 'enough_cars' || type === 'build_train') {
        expect(fewestCars(s)).not.toBe(fewestCars(c));
        expect(fewestCars(s)).toBeLessThanOrEqual(band === 'K-2' || type === 'build_train' ? 4 : 8);
      }
      if (type === 'enough_pull') {
        expect(Number.isInteger(s.grade)).toBe(true);
        expect(fewestEngines(s)).toBe(2);
        expect(s.amount).not.toBe(c.amount);
      }
      if (type === 'build_train') expect(s.grade).toBe(1);
    }
    expect(built).toBeGreaterThan(0);
  });

  it('a job already at the simple shape has no simplify lever', () => {
    const small = buildTrainYardChallenge(STORIES[0], { id: 'a', band: 'K-2', type: 'enough_cars', rng: () => 0 });
    expect(fewestCars(small)).toBe(3);
    expect(simplerJob(small, 'K-2')).toBeNull();
    expect(trainYardLevers(small, [], 'K-2').map(l => l.id)).toEqual(['car_tally']);
  });
});

describe('which lever after which miss', () => {
  const pick = (type: TrainYardTask, miss?: string, pulled: string[] = []) => {
    const c = jobs(type, '3-5', 1)[0];
    return nextLever(trainYardLevers(c, pulled, '3-5'), miss);
  };
  it.each([
    ['match_car', 'wrong_car', [], 'cargo_picture'],
    ['match_car', 'wrong_car', ['cargo_picture'], 'model_match'],
    ['match_car', 'wrong_car', ['cargo_picture', 'model_match'], 'two_cars'],
    ['enough_cars', 'too_few_cars', [], 'car_tally'],
    ['enough_cars', 'extra_cars', ['car_tally'], 'whole_loads'],
    ['enough_pull', 'stalled', [], 'train_weight'],
    ['enough_pull', 'extra_engines', ['train_weight'], 'worked_hill'],
    ['enough_pull', 'stalled', ['train_weight', 'worked_hill'], 'round_hill'],
    ['build_train', 'mixed_cars', [], 'cargo_picture'],
    ['build_train', 'too_few_cars', [], 'car_tally'],
    ['build_train', 'stalled', [], 'train_weight'],
    ['build_train', 'extra_cars', ['car_tally'], 'smaller_job'],
  ] as const)('%s, miss %s, pulled %j -> %s', (type, miss, pulled, lever) => {
    expect(pick(type, miss, [...pulled])).toBe(lever);
  });

  it('every miss a mode can show is answered by one of its levers', () => {
    const misses: Record<TrainYardTask, string[]> = {
      match_car: ['wrong_car'], enough_cars: ['too_few_cars', 'extra_cars'], enough_pull: ['stalled', 'extra_engines'],
      build_train: ['wrong_car', 'mixed_cars', 'too_few_cars', 'stalled', 'extra_cars', 'extra_engines'],
    };
    for (const type of TRAIN_YARD_TASKS) {
      const answered = new Set(trainYardLevers(jobs(type, '3-5', 1)[0], [], '3-5').flatMap(l => l.answers ?? []));
      expect(misses[type].filter(m => !answered.has(m)), type).toEqual([]);
    }
  });

  it('easy starts with the self-checking help pulled; other tiers start released', () => {
    expect(startLevers(jobs('match_car', '3-5', 1)[0], 'easy')).toEqual(['cargo_picture']);
    expect(startLevers(jobs('enough_cars', '3-5', 1)[0], 'easy')).toEqual(['car_tally']);
    expect(startLevers(jobs('enough_pull', '3-5', 1)[0], 'easy')).toEqual(['train_weight']);
    expect(startLevers(jobs('build_train', '3-5', 1)[0], 'easy')).toEqual(['car_tally', 'train_weight']);
    expect(startLevers(jobs('build_train', '3-5', 1)[0], 'hard')).toEqual([]);
  });
});
