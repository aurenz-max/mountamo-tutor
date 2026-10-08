/**
 * Train yard: the rail physics, rolling stock and job checks, pure.
 *
 * Forces are in "tons of pull" (tonnes-force). On flat steel track a train needs 2 tons of pull
 * for every 1,000 tons it weighs; each 1% of hill adds 10 tons of pull per 1,000 tons. So a hill,
 * not the weight, decides how many engines a train needs — the idea the primitive teaches.
 *
 * The component, the generator, the workspace module and the tests all read this one file, so the
 * run the learner watches, the key the generator stores and the check the workspace commits agree.
 */

export const ROLLING_PULL_PER_TON = 0.002;

export type TrainCarType = 'hopper' | 'tank' | 'flat' | 'boxcar' | 'autorack' | 'coach';
/** What the cargo is physically like. The generator labels it; the car follows from it. */
export type CargoForm = 'loose_bulk' | 'liquid' | 'long_bundles' | 'boxed_goods' | 'vehicles' | 'people';
export type LoadUnit = 'tons' | 'riders' | 'cars';

export interface TrainCarSpec {
  name: string;
  /** What one car holds, in its own unit. */
  holds: number;
  unit: LoadUnit;
  emptyTons: number;
  /** How the car is built, never what cargo it carries: matching the cargo is the learner's job. */
  builtFor: string;
}

export const TRAIN_CARS: Record<TrainCarType, TrainCarSpec> = {
  hopper: { name: 'Hopper car', holds: 100, unit: 'tons', emptyTons: 30,
    builtFor: 'Deep bins with a closed top. Doors in the bottom open so a loose load pours out.' },
  tank: { name: 'Tank car', holds: 90, unit: 'tons', emptyTons: 35,
    builtFor: 'A sealed round tube with a valve. Nothing can spill or leak out.' },
  flat: { name: 'Centerbeam flatcar', holds: 80, unit: 'tons', emptyTons: 30,
    builtFor: 'An open deck with a tall wall down the middle to strap long bundles against.' },
  boxcar: { name: 'Boxcar', holds: 70, unit: 'tons', emptyTons: 30,
    builtFor: 'A closed box with big sliding doors. Keeps boxes and crates dry.' },
  autorack: { name: 'Autorack', holds: 15, unit: 'cars', emptyTons: 50,
    builtFor: 'A tall covered cage with ramps and two decks to drive onto.' },
  coach: { name: 'Passenger coach', holds: 120, unit: 'riders', emptyTons: 55,
    builtFor: 'Rows of seats, big windows, and wide doors to step in and out.' },
};

/** "a hopper car", "an autorack": the yard's button names, which a journey driver presses. */
export const carButtonName = (type: TrainCarType): string => {
  const name = TRAIN_CARS[type].name.toLowerCase();
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;
};

export const CAR_ORDER: readonly TrainCarType[] = ['hopper', 'tank', 'flat', 'boxcar', 'autorack', 'coach'];

export const CAR_FOR_FORM: Record<CargoForm, TrainCarType> = {
  loose_bulk: 'hopper', liquid: 'tank', long_bundles: 'flat', boxed_goods: 'boxcar', vehicles: 'autorack', people: 'coach',
};

/** Tons one unit of the load weighs. */
export const UNIT_TONS: Record<LoadUnit, number> = { tons: 1, riders: 0.08, cars: 1.5 };

export interface EngineSpec { name: string; tons: number; pull: number; about: string }
export const FREIGHT_ENGINE: EngineSpec = { name: 'Diesel engine', tons: 130, pull: 30, about: '3,000 horsepower' };
export const PASSENGER_ENGINE: EngineSpec = { name: 'Passenger engine', tons: 100, pull: 20, about: 'fast and sleek' };

/**
 * The four tasks, easiest first. Each one leaves part of the train to the yard:
 *   - `match_car`: the learner picks the car kind; the yard couples the fewest-cars count and the engines;
 *   - `enough_cars`: the yard puts out the right car kind and adds engines; the learner sets the car count;
 *   - `enough_pull`: the yard couples the loaded cars; the learner sets the engines;
 *   - `build_train`: the learner builds the whole train.
 */
export type TrainYardTask = 'match_car' | 'enough_cars' | 'enough_pull' | 'build_train';
export const TRAIN_YARD_TASKS: readonly TrainYardTask[] = ['match_car', 'enough_cars', 'enough_pull', 'build_train'];

export interface TrainYardChallenge {
  id: string;
  type: TrainYardTask;
  /** Short job name, e.g. "Harvest Rush". */
  title: string;
  /** The ask. Names the load, the route and the hill; never the car or the counts. */
  instruction: string;
  /** What is moved, a noun: "grain", "commuters", "new cars". */
  cargo: string;
  cargoForm: CargoForm;
  amount: number;
  unit: LoadUnit;
  from: string;
  to: string;
  hillName: string;
  /** Hill steepness in percent. */
  grade: number;
  distanceKm: number;
  /** match_car only: the car kinds the yard offers, when fewer than all (a `two_cars` practice job). */
  carChoices?: TrainCarType[];
}

export interface Consist { engines: number; cars: Partial<Record<TrainCarType, number>> }

export const emptyConsist = (): Consist => ({ engines: 0, cars: {} });

export const engineFor = (c: Pick<TrainYardChallenge, 'cargoForm'>): EngineSpec =>
  c.cargoForm === 'people' ? PASSENGER_ENGINE : FREIGHT_ENGINE;

export const carFor = (c: Pick<TrainYardChallenge, 'cargoForm'>): TrainCarType => CAR_FOR_FORM[c.cargoForm];

export const carCount = (consist: Consist): number =>
  CAR_ORDER.reduce((n, t) => n + (consist.cars[t] ?? 0), 0);

/** "6,000 tons of grain", "900 commuters", "450 new cars". */
export function describeLoad(c: Pick<TrainYardChallenge, 'amount' | 'unit' | 'cargo'>, amount = c.amount): string {
  const n = Math.round(amount).toLocaleString('en-US');
  return c.unit === 'tons' ? `${n} tons of ${c.cargo}` : `${n} ${c.cargo}`;
}

export interface TrainRun {
  rightCars: number;
  wrongCars: number;
  capacity: number;
  loaded: number;
  leftover: number;
  trainTons: number;
  /** Pull the hill needs for this train. */
  hillPull: number;
  /** Pull the same train needs on flat track. */
  flatPull: number;
  enginePull: number;
  climbs: boolean;
}

function trainTons(c: TrainYardChallenge, engines: number, cars: Consist['cars'], loaded: number): number {
  const empty = CAR_ORDER.reduce((t, k) => t + (cars[k] ?? 0) * TRAIN_CARS[k].emptyTons, 0);
  return engines * engineFor(c).tons + empty + loaded * UNIT_TONS[c.unit];
}

/** What happens when this consist runs the job: what loads, what it weighs, whether it climbs. */
export function runTrain(c: TrainYardChallenge, consist: Consist): TrainRun {
  const right = carFor(c);
  const rightCars = consist.cars[right] ?? 0;
  const wrongCars = carCount(consist) - rightCars;
  const capacity = rightCars * TRAIN_CARS[right].holds;
  const loaded = Math.min(c.amount, capacity);
  const tons = trainTons(c, consist.engines, consist.cars, loaded);
  const hillPull = tons * (ROLLING_PULL_PER_TON + c.grade / 100);
  const enginePull = consist.engines * engineFor(c).pull;
  return {
    rightCars, wrongCars, capacity, loaded, leftover: c.amount - loaded, trainTons: tons,
    hillPull, flatPull: tons * ROLLING_PULL_PER_TON, enginePull, climbs: consist.engines > 0 && enginePull >= hillPull,
  };
}

/** The fewest cars of the right kind that hold the whole load. */
export const fewestCars = (c: TrainYardChallenge): number => Math.ceil(c.amount / TRAIN_CARS[carFor(c)].holds);

/** The fewest engines that pull these cars up the hill (each engine adds its own weight). */
export function enginesToClimb(c: TrainYardChallenge, cars: Consist['cars']): number {
  for (let n = 1; n <= 40; n++) if (runTrain(c, { engines: n, cars }).climbs) return n;
  return 40;
}

/** The fewest engines that pull the fewest-cars train up the hill. */
export const fewestEngines = (c: TrainYardChallenge): number => enginesToClimb(c, { [carFor(c)]: fewestCars(c) });

/** The one car kind the learner chose in `match_car` (the yard button marks it with a count of 1). */
export const chosenKind = (built: Consist): TrainCarType | undefined => CAR_ORDER.find(t => (built.cars[t] ?? 0) > 0);

/**
 * The train that runs: the learner's own build, with the parts this task gives filled in by the yard.
 * The yard's parts are always the fewest that work, so a miss can only come from the learner's part.
 */
export function yardConsist(c: TrainYardChallenge, built: Consist): Consist {
  switch (c.type) {
    case 'match_car': {
      const kind = chosenKind(built);
      if (!kind) return emptyConsist();
      const cars = { [kind]: fewestCars(c) };
      return { engines: enginesToClimb(c, cars), cars };
    }
    case 'enough_cars': {
      const n = built.cars[carFor(c)] ?? 0;
      if (n === 0) return emptyConsist();
      const cars = { [carFor(c)]: n };
      return { engines: enginesToClimb(c, cars), cars };
    }
    case 'enough_pull':
      return { engines: built.engines, cars: { [carFor(c)]: fewestCars(c) } };
    default:
      return built;
  }
}

/**
 * What a checked build shows, in precedence order:
 *   - `wrong_car`: none of its cars can carry this cargo;
 *   - `mixed_cars`: some cars are a kind that cannot carry it (dead weight);
 *   - `too_few_cars`: the right cars cannot hold the whole load;
 *   - `stalled`: the engines cannot pull the train up the hill;
 *   - `extra_cars`: the load fits in fewer cars;
 *   - `extra_engines`: fewer engines would climb the hill.
 * `undefined` is the fewest-cars, fewest-engines train: the one correct build.
 */
export type TrainYardMiss = 'wrong_car' | 'mixed_cars' | 'too_few_cars' | 'stalled' | 'extra_cars' | 'extra_engines';
export const TRAIN_YARD_MISSES: readonly TrainYardMiss[] =
  ['wrong_car', 'mixed_cars', 'too_few_cars', 'stalled', 'extra_cars', 'extra_engines'];

export function trainYardMiss(c: TrainYardChallenge, consist: Consist): TrainYardMiss | undefined {
  const run = runTrain(c, consist);
  if (run.rightCars === 0 && run.wrongCars > 0) return 'wrong_car';
  if (run.wrongCars > 0) return 'mixed_cars';
  if (run.leftover > 0) return 'too_few_cars';
  if (!run.climbs) return 'stalled';
  if (run.rightCars > fewestCars(c)) return 'extra_cars';
  if (consist.engines > fewestEngines(c)) return 'extra_engines';
  return undefined;
}

export const trainMatches = (c: TrainYardChallenge, consist: Consist): boolean =>
  consist.engines > 0 && carCount(consist) > 0 && trainYardMiss(c, consist) === undefined;

/** The same load by road: how many vehicles, what they are, and how long the line would be. */
export function roadComparison(c: TrainYardChallenge, loaded: number): { count: number; vehicle: string; km: number } {
  const road = c.cargoForm === 'people' ? { per: 1.2, vehicle: 'cars', m: 7 }
    : c.cargoForm === 'vehicles' ? { per: 9, vehicle: 'car-carrier trucks', m: 23 }
    : c.cargoForm === 'liquid' ? { per: 25, vehicle: 'tanker trucks', m: 21 }
    : { per: 22, vehicle: 'semi trucks', m: 22 };
  const count = Math.ceil(loaded / road.per);
  return { count, vehicle: road.vehicle, km: (count * (road.m + 30)) / 1000 };
}

// ── Building a job from a story (the generator's pool) ──────────────────────────────

export type TrainYardBand = 'K-2' | '3-5';

export interface TrainJobStory {
  title: string;
  cargo: string;
  cargoForm: CargoForm;
  from: string;
  to: string;
  hillName: string;
}

const GRADES = [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.5, 3.0];
const CAR_RANGE: Record<TrainYardBand, [number, number]> = { 'K-2': [3, 10], '3-5': [6, 24] };

const pick = <T,>(items: readonly T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

/** A whole number a child can read: tens for tons and riders, units for vehicles. */
function roundLoad(amount: number, unit: LoadUnit): number {
  if (unit === 'cars') return Math.max(1, Math.round(amount));
  return Math.max(10, Math.round(amount / 10) * 10);
}

/** The ask for each task. Never names the car kind or a count the learner must find. */
export function instructionFor(c: Omit<TrainYardChallenge, 'instruction' | 'id'>): string {
  const hill = `The route climbs ${c.hillName}, a ${c.grade.toFixed(1)}% grade.`;
  switch (c.type) {
    case 'match_car':
      return `Move ${describeLoad(c)} from ${c.from} to ${c.to}. `
        + `Choose the kind of car that can carry ${c.cargo}. The yard couples the cars and the engines.`;
    case 'enough_cars':
      return `Move ${describeLoad(c)} from ${c.from} to ${c.to}. The yard has the right kind of car ready and adds the engines. `
        + 'Couple the fewest cars that hold the whole load.';
    case 'enough_pull':
      return `The yard has loaded ${describeLoad(c)} into the cars for the trip from ${c.from} to ${c.to}. ${hill} `
        + 'Add the fewest engines that pull the train up the hill.';
    default:
      return `Build a train to move ${describeLoad(c)} from ${c.from} to ${c.to}. ${hill} `
        + 'Use the fewest cars and engines that get the whole load there.';
  }
}

/**
 * Turn one story into a job whose numbers are chosen here, never by the model:
 *   - K-2: the load is an exact number of full cars (3-10), so the count is a skip-count;
 *   - 3-5: 6-24 cars and the last car is part-full, so the count rounds up;
 *   - the hill is the steepness that needs `targetEngines` engines, so a session can ask for different
 *     engine counts; the car count is redrawn until such a hill exists.
 */
export function buildTrainYardChallenge(story: TrainJobStory, options: {
  id: string; band: TrainYardBand; rng?: () => number; targetEngines?: number; type?: TrainYardTask;
}): TrainYardChallenge {
  const type = options.type ?? 'build_train';
  const rng = options.rng ?? Math.random;
  const car = TRAIN_CARS[CAR_FOR_FORM[story.cargoForm]];
  const unit = car.unit;
  const [lo, hi] = CAR_RANGE[options.band];
  const loadFor = (cars: number) => {
    if (options.band === 'K-2') return cars * car.holds;
    const amount = roundLoad(cars * car.holds - car.holds * (0.15 + rng() * 0.5), unit);
    return Math.ceil(amount / car.holds) === cars ? amount : cars * car.holds - (unit === 'cars' ? 2 : 20);
  };
  const base = {
    title: story.title.trim(), cargo: story.cargo.trim(), cargoForm: story.cargoForm, amount: 0, unit,
    from: story.from.trim(), to: story.to.trim(), hillName: story.hillName.trim(),
    distanceKm: 40 + Math.round(rng() * 46) * 10, grade: 1.0,
  };
  const probe = (grade: number) => fewestEngines({ ...base, grade, id: options.id, type, instruction: '' });
  const target = options.targetEngines;
  // A short train cannot need two engines on any hill here, so the car count is redrawn until some hill
  // needs the target; after 12 draws any hill is taken.
  let fits: number[] = [];
  for (let draw = 0; draw < 12; draw++) {
    base.amount = loadFor(lo + Math.floor(rng() * (hi - lo + 1)));
    fits = GRADES.filter(g => target === undefined || probe(g) === target);
    if (fits.length) break;
  }
  base.grade = fits.length ? pick(fits, rng) : pick(GRADES, rng);
  return { ...base, id: options.id, type, instruction: instructionFor({ ...base, type }) };
}
