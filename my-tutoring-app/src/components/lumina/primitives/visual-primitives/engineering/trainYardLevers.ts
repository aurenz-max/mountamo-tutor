/**
 * The in-item levers on train-yard, every mode (`/add-support-tiers`), declared once as a lever set (`TRAIN_LEVERS`, `bossLevers.ts`); table and evidence in
 * qa/eval-reports/train-yard-levers-2026-10-06.md). No real-learner evidence: the misses are what `trainYardMiss`
 * observes on the journey's scripted wrong builds, plus the birth certificate's "why children fail" plan.
 *
 * Car kind (match_car, build_train) — which car carries the cargo IS the answer, so help shows the cargo itself or
 * a model on a different cargo, never the item's car.
 * - `cargo_picture` (clue): a drawing of the cargo as it looks, beside the job ticket. No car, no car-card words.
 * - `model_match` (model): a different cargo, its car, and why that car is built for it.
 * - `two_cars` (easier, match_car): an ungraded job with a different cargo and two car choices.
 * Car count (enough_cars, build_train)
 * - `car_tally` (marks): each car the learner coupled shows what the cars of its kind so far hold. Never past theirs.
 * - `whole_loads` (easier, enough_cars): an ungraded job with a different cargo, whole-car loads and fewer cars.
 * Engines (enough_pull, build_train) — the live "pull needed vs pull given" gauge of the demo is NOT a lever: it
 * turns green at exactly the fewest engines.
 * - `train_weight` (custom: a yard scale): what the train weighs now, engines, cars and the whole load, before the run. No pull.
 * - `worked_hill` (model): the rule of the rails worked on a different train and hill.
 * - `round_hill` (easier, enough_pull): an ungraded job on a whole-number hill that needs 2 engines.
 * - `smaller_job` (easier, build_train): an ungraded whole build with whole loads, 3-4 cars, a whole-number hill.
 */
import { leverSet, type LeverSpec } from '../../../components/live-activity/bossLevers';
import {
  CAR_FOR_FORM, CAR_ORDER, carButtonName, carFor, engineFor, fewestCars, fewestEngines, instructionFor, ROLLING_PULL_PER_TON,
  TRAIN_CARS, TRAIN_YARD_MISSES_BY_MODE, UNIT_TONS, type CargoForm, type Consist, type TrainCarType, type TrainYardBand,
  type TrainYardChallenge, type TrainYardMiss,
} from './trainYardModel';

export const PICTURE_LEVER = 'cargo_picture';
export const MODEL_LEVER = 'model_match';
export const TWO_CARS_LEVER = 'two_cars';
export const TALLY_LEVER = 'car_tally';
export const WHOLE_LOADS_LEVER = 'whole_loads';
export const WEIGHT_LEVER = 'train_weight';
export const WORKED_LEVER = 'worked_hill';
export const ROUND_HILL_LEVER = 'round_hill';
export const SMALLER_LEVER = 'smaller_job';

const SIMPLER = '~simpler';
export const isPracticeJob = (c: Pick<TrainYardChallenge, 'id'>) => c.id.endsWith(SIMPLER);
export const practiceParent = (id: string) => (id.endsWith(SIMPLER) ? id.slice(0, -SIMPLER.length) : null);

// ── What a cargo looks like (cargo_picture, model_match) ─────────────────────

/** The cargo as it looks, in words that share none with any car card's "built for" text (pinned in the tests). */
export const CARGO_LOOKS: Record<CargoForm, string> = {
  loose_bulk: 'tiny grains heaped in a pile',
  liquid: 'a runny puddle that drips',
  long_bundles: 'poles stacked side by side',
  boxed_goods: 'cartons piled up',
  vehicles: 'cars and trucks on wheels',
  people: 'people waiting on a platform',
};

/** model_match: a cargo of each form and why its car is built for it. Never shown for the item's own form. */
const MODELS: Record<CargoForm, { cargo: string; why: string }> = {
  liquid: { cargo: 'water', why: 'Water would slosh out of an open car, so it rides in the sealed tube with a valve.' },
  long_bundles: { cargo: 'steel pipes', why: 'Long pipes do not fit through a door, so they ride on the open deck, strapped to the wall.' },
  loose_bulk: { cargo: 'sand', why: 'Sand pours like water, so it rides in the deep bins whose bottom doors let it pour out.' },
  boxed_goods: { cargo: 'boxes of shoes', why: 'Boxes must stay dry, so they ride in the closed box with sliding doors.' },
  vehicles: { cargo: 'tractors', why: 'Tractors drive on and off, so they ride in the tall cage with ramps and decks.' },
  people: { cargo: 'students', why: 'Students need seats and windows, so they ride in the car with rows of seats.' },
};
const MODEL_ORDER: readonly CargoForm[] = ['liquid', 'long_bundles', 'loose_bulk', 'boxed_goods', 'vehicles', 'people'];

export function modelMatch(c: TrainYardChallenge): { form: CargoForm; car: TrainCarType; cargo: string; why: string } {
  const form = MODEL_ORDER.find(f => f !== c.cargoForm)!;
  return { form, car: CAR_FOR_FORM[form], ...MODELS[form] };
}

// ── car_tally ────────────────────────────────────────────────────────────────

/** Per car kind the learner coupled, what the cars of that kind hold so far, car by car. Only the learner's cars. */
export function carTally(consist: Consist): Array<{ kind: TrainCarType; totals: number[] }> {
  return CAR_ORDER.filter(k => (consist.cars[k] ?? 0) > 0)
    .map(kind => ({ kind, totals: Array.from({ length: consist.cars[kind]! }, (_, i) => (i + 1) * TRAIN_CARS[kind].holds) }));
}

// ── train_weight ─────────────────────────────────────────────────────────────

/** What this train weighs with the whole load aboard: the learner's engines and cars, and the job's load. No pull. */
export function trainWeight(c: TrainYardChallenge, consist: Consist) {
  const engines = consist.engines * engineFor(c).tons;
  const cars = CAR_ORDER.reduce((t, k) => t + (consist.cars[k] ?? 0) * TRAIN_CARS[k].emptyTons, 0);
  const load = Math.round(c.amount * UNIT_TONS[c.unit]);
  return { engines, cars, load, total: engines + cars + load };
}

// ── worked_hill ──────────────────────────────────────────────────────────────

const WORKED: ReadonlyArray<readonly [number, number]> = [[2500, 2], [5000, 1], [1500, 3], [3000, 2], [4000, 1.5], [6000, 1]];

/** The rule worked on a train and hill the item does not use: a different grade, weight and engine count. */
export function workedHill(c: TrainYardChallenge) {
  const perEngine = engineFor(c).pull;
  const answer = fewestEngines(c);
  const work = ([tons, grade]: readonly [number, number]) => {
    const hill = (tons / 100) * grade, roll = tons * ROLLING_PULL_PER_TON, need = hill + roll;
    return { tons, grade, hill, roll, need, perEngine, engines: Math.ceil(need / perEngine) };
  };
  const ownWeight = trainWeight(c, { engines: answer, cars: { [carFor(c)]: fewestCars(c) } }).total;
  return WORKED.map(work).find(w => w.grade !== c.grade && w.engines !== answer && w.engines >= 2 && w.tons !== ownWeight)
    ?? work(WORKED[0]);
}

// ── Simpler jobs (simplify levers) ───────────────────────────────────────────

/** One fixed practice story per cargo form, so a simpler job needs no model call and uses no other session job. */
const PRACTICE: Record<CargoForm, { title: string; cargo: string; from: string; to: string; hillName: string }> = {
  loose_bulk: { title: 'Gravel Haul', cargo: 'gravel', from: 'the quarry', to: 'the road crew', hillName: 'Stony Rise' },
  liquid: { title: 'Water Run', cargo: 'water', from: 'the reservoir', to: 'the farm', hillName: 'Mill Hill' },
  long_bundles: { title: 'Pipe Load', cargo: 'steel pipes', from: 'the steel mill', to: 'the work site', hillName: 'Iron Ridge' },
  boxed_goods: { title: 'Toy Delivery', cargo: 'boxes of toys', from: 'the factory', to: 'the toy store', hillName: 'Maple Hill' },
  vehicles: { title: 'Tractor Train', cargo: 'tractors', from: 'the tractor plant', to: 'the farm town', hillName: 'Long Grade' },
  people: { title: 'School Trip', cargo: 'students', from: 'the school', to: 'the museum', hillName: 'Park Hill' },
};
const PRACTICE_ORDER: readonly CargoForm[] = ['loose_bulk', 'boxed_goods', 'liquid', 'long_bundles', 'vehicles', 'people'];
/** Freight that weighs enough for an engines job (people and vehicles always need one engine). */
const HEAVY: readonly CargoForm[] = ['loose_bulk', 'boxed_goods', 'liquid', 'long_bundles'];
/** A far foil for two_cars: a car built for a very different cargo. */
const FAR_FOIL: Record<TrainCarType, readonly TrainCarType[]> = {
  hopper: ['coach', 'autorack'], tank: ['flat', 'autorack'], flat: ['tank', 'coach'],
  boxcar: ['tank', 'autorack'], autorack: ['hopper', 'tank'], coach: ['hopper', 'tank'],
};

function practiceJob(c: TrainYardChallenge, form: CargoForm, cars: number, grade: number,
  extra: Partial<TrainYardChallenge> = {}): TrainYardChallenge {
  const story = PRACTICE[form];
  const spec = TRAIN_CARS[CAR_FOR_FORM[form]];
  const base = { ...story, cargoForm: form, amount: cars * spec.holds, unit: spec.unit, grade, distanceKm: 60, type: c.type, ...extra };
  return { ...base, id: c.id + SIMPLER, instruction: instructionFor(base) };
}

const otherForm = (c: TrainYardChallenge, forms: readonly CargoForm[] = PRACTICE_ORDER) => forms.find(f => f !== c.cargoForm)!;
const wholeLoad = (c: TrainYardChallenge) => c.amount % TRAIN_CARS[carFor(c)].holds === 0;
const smallCounts = (band: TrainYardBand) => band === 'K-2' ? [3, 4] : [6, 7, 8];

/** match_car: a different cargo with two cars to choose from, its car and a far foil, in yard order. */
export function twoCars(c: TrainYardChallenge): TrainYardChallenge | null {
  if (c.type !== 'match_car' || c.carChoices?.length === 2) return null;
  const form = otherForm(c);
  const car = CAR_FOR_FORM[form];
  const foil = FAR_FOIL[car].find(k => k !== carFor(c)) ?? FAR_FOIL[car][0];
  return practiceJob(c, form, 4, 1, { carChoices: CAR_ORDER.filter(k => k === car || k === foil) });
}

/** enough_cars: a different cargo, whole-car loads, fewer cars than the item; null when the item is already that. */
export function wholeLoads(c: TrainYardChallenge, band: TrainYardBand): TrainYardChallenge | null {
  if (c.type !== 'enough_cars') return null;
  const counts = smallCounts(band);
  if (wholeLoad(c) && fewestCars(c) <= counts[counts.length - 1]) return null;
  const n = counts.find(k => k !== fewestCars(c))!;
  return practiceJob(c, otherForm(c), n, 1);
}

/** enough_pull: a heavy cargo on a whole-number hill that needs exactly 2 engines; null when the item is already that. */
export function roundHill(c: TrainYardChallenge, band: TrainYardBand): TrainYardChallenge | null {
  if (c.type !== 'enough_pull') return null;
  if (Number.isInteger(c.grade) && fewestEngines(c) === 2) return null;
  const form = otherForm(c, HEAVY);
  const [lo, hi] = band === 'K-2' ? [3, 10] : [6, 24];
  for (const grade of [1, 2, 3]) for (let n = lo; n <= hi; n++) {
    const job = practiceJob(c, form, n, grade);
    if (fewestEngines(job) === 2 && job.amount !== c.amount) return job;
  }
  return null;
}

/** build_train: a whole build with whole loads, 3-4 cars and a 1% hill; null when the item is already that small. */
export function smallerJob(c: TrainYardChallenge): TrainYardChallenge | null {
  if (c.type !== 'build_train') return null;
  if (wholeLoad(c) && fewestCars(c) <= 4 && Number.isInteger(c.grade)) return null;
  const n = [3, 4].find(k => k !== fewestCars(c))!;
  return practiceJob(c, otherForm(c, HEAVY), n, 1);
}

/** The simpler job a simplify lever opens on this item, if there is one. */
export function simplerJob(c: TrainYardChallenge, band: TrainYardBand): TrainYardChallenge | null {
  switch (c.type) {
    case 'match_car': return twoCars(c);
    case 'enough_cars': return wholeLoads(c, band);
    case 'enough_pull': return roundHill(c, band);
    default: return smallerJob(c);
  }
}

// ── Declarations ─────────────────────────────────────────────────────────────

/** Levers the tier starts pulled: a starting position, never a recorded pull. */
export function startLevers(c: TrainYardChallenge | null, tier?: string): string[] {
  if (!c || tier !== 'easy') return [];
  switch (c.type) {
    case 'match_car': return [PICTURE_LEVER];
    case 'enough_cars': return [TALLY_LEVER];
    case 'enough_pull': return [WEIGHT_LEVER];
    default: return [TALLY_LEVER, WEIGHT_LEVER];
  }
}

/** What the levers read besides the item: the session's band, the learner's own part, and the train that will run. */
export interface TrainLeverCtx { band: TrainYardBand; consist: Consist; train: Consist }

type Spec = LeverSpec<TrainYardChallenge, TrainLeverCtx>;
type Mode = TrainYardChallenge['type'];

const n = (x: number) => Math.round(x).toLocaleString('en-US');
const UNGRADED = ' It is not graded; the full job comes back after it.';
/** The kind misses a mode's run can show: match_car couples one kind, so never mixed cars. */
const KIND: Record<'match_car' | 'build_train', TrainYardMiss[]> = {
  match_car: ['wrong_car'], build_train: ['wrong_car', 'mixed_cars'],
};
const COUNT_MISSES: TrainYardMiss[] = ['too_few_cars', 'extra_cars'];
const ENGINE_MISSES: TrainYardMiss[] = ['stalled', 'extra_engines'];

const kindLevers = (mode: 'match_car' | 'build_train'): Spec[] => [
  { id: PICTURE_LEVER, type: 'clue', modes: [mode], answers: KIND[mode],
    when: c => `The learner does not picture what ${c.cargo} is like, so cannot tell which car is built for it.`,
    does: c => `Shows a picture of the ${c.cargo} beside the job ticket, as it looks. It shows no car.`,
    fact: (_content, c) => `A picture beside the job ticket shows the ${c.cargo}: ${CARGO_LOOKS[c.cargoForm]}.` },
  { id: MODEL_LEVER, type: 'model', modes: [mode], answers: KIND[mode],
    when: 'The learner does not connect how a car is built to what it can carry.',
    does: c => `Shows a worked example beside the yard: ${modelMatch(c).cargo}, the car built for it, and why. `
      + `It is a different cargo; never say which car carries the ${c.cargo}.`,
    content: c => modelMatch(c),
    fact: (m: ReturnType<typeof modelMatch>) => `A worked example shows ${m.cargo} in the ${TRAIN_CARS[m.car].name.toLowerCase()}: ${m.why}` },
];

const tallyLever = (mode: 'enough_cars' | 'build_train'): Spec => ({
  id: TALLY_LEVER, type: 'marks', modes: [mode], answers: COUNT_MISSES,
  when: 'The learner loses count of how much the cars hold, or stops short of the whole load.',
  does: 'Under the train, each car the learner couples shows what the cars of its kind hold so far. Nothing past their own cars.',
  content: (_c, ctx) => carTally(ctx.consist),
  fact: (tally: ReturnType<typeof carTally>) => (tally.length
    ? `Under the train each coupled car shows what its kind holds so far: ${tally.map(t =>
      `${t.totals.length} ${TRAIN_CARS[t.kind].name.toLowerCase()}${t.totals.length === 1 ? '' : 's'} hold ${n(t.totals.at(-1)!)} ${TRAIN_CARS[t.kind].unit}`).join('; ')}.`
    : 'Under the train each car the learner couples will show what its kind holds so far; no cars are coupled yet.'),
});

const engineLevers = (mode: 'enough_pull' | 'build_train'): Spec[] => [
  { id: WEIGHT_LEVER, type: 'custom', carrier: 'shown', modes: [mode], answers: ENGINE_MISSES,
    why: 'It is a reading of the learner\'s own train that the yard hides before the run (a yard scale): not a mark on '
      + 'what is on screen, not words about the item, and not a different item.',
    when: 'The learner cannot use the rule of the rails because the train\'s weight is hidden before the run.',
    does: 'Shows what the train weighs now, with the whole load aboard: its engines, cars and load. Never the pull the hill needs.',
    content: (c, ctx) => trainWeight(c, ctx.train),
    fact: (w: ReturnType<typeof trainWeight>) => `The yard scale shows the train with the whole load aboard: engines ${n(w.engines)} t, `
      + `cars ${n(w.cars)} t, load ${n(w.load)} t, ${n(w.total)} t in all.` },
  { id: WORKED_LEVER, type: 'model', modes: [mode], answers: ENGINE_MISSES,
    when: 'The learner does not know how to turn the rule of the rails into a number of engines.',
    does: 'Shows the rule worked on a different train and hill: its weight, the pull it needs, and the engines. '
      + 'Never this train\'s numbers; do not work this train for the learner.',
    content: c => workedHill(c),
    fact: (w: ReturnType<typeof workedHill>) => `A worked example: a ${n(w.tons)} t train on a ${w.grade}% hill needs `
      + `${n(w.hill)} t of pull for the hill plus ${n(w.roll)} t to roll, ${n(w.need)} t; at ${w.perEngine} t `
      + `per engine that is ${w.engines} engines.` },
];

const easier = (id: string, mode: Mode, answers: readonly TrainYardMiss[], when: string, does: string,
  content: (c: TrainYardChallenge, ctx: TrainLeverCtx) => TrainYardChallenge | null): Spec =>
  ({ id, type: 'easier', modes: [mode], answers, when, does: does + UNGRADED, content });

/**
 * Every lever, declared once (`bossLevers.ts`), in the order a miss reaches for them: the help levers, then the
 * mode's easier job. None is offered on a practice job: the component declares nothing while one is on screen.
 */
export const TRAIN_LEVERS = leverSet<TrainYardChallenge, TrainLeverCtx>({
  modeOf: c => c.type,
  missesOf: mode => TRAIN_YARD_MISSES_BY_MODE[mode as Mode] ?? [],
  // What a clue must never name: the car for the cargo.
  answersOf: c => [TRAIN_CARS[carFor(c)].name, carButtonName(carFor(c)).replace(/^an? /, '')],
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: c => (c.type === 'match_car' ? 'a different cargo and the car built for it'
      : c.type === 'enough_pull' ? 'the rule of the rails worked on a different train and hill'
        : 'a different cargo and its car, or the rule of the rails worked on a different train'),
    own: c => (c.type === 'match_car' ? 'which car carries this cargo'
      : c.type === 'enough_pull' ? 'how many engines this train needs' : 'this job\'s car, its number of cars or its engines'),
  },
  specs: [
    ...kindLevers('match_car'),
    easier(TWO_CARS_LEVER, 'match_car', ['wrong_car'], 'Six kinds of car are too many to choose from yet.',
      'Opens an easier job first: a different cargo with only two cars to choose from.', c => twoCars(c)),
    tallyLever('enough_cars'),
    easier(WHOLE_LOADS_LEVER, 'enough_cars', COUNT_MISSES, 'This load is too big, or its last car is only part full.',
      'Opens an easier job first: a different cargo that fills a few cars exactly.', (c, ctx) => wholeLoads(c, ctx.band)),
    ...engineLevers('enough_pull'),
    easier(ROUND_HILL_LEVER, 'enough_pull', ENGINE_MISSES, 'The hill\'s numbers are too hard to work with yet.',
      'Opens an easier job first: a different train on a hill with a whole-number grade.', (c, ctx) => roundHill(c, ctx.band)),
    ...kindLevers('build_train'),
    tallyLever('build_train'),
    ...engineLevers('build_train'),
    easier(SMALLER_LEVER, 'build_train', [...COUNT_MISSES, ...ENGINE_MISSES], 'The whole job is too much to build at once yet.',
      'Opens an easier job first: a small train of a different cargo, whole cars, on a gentle hill.', c => smallerJob(c)),
  ],
});
