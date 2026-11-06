/**
 * Body Workshop's model, pure. The learner taps body parts into one row to build the path something takes through a
 * real animal: oxygen from where the animal lives (`deliver_oxygen`), or food from its mouth (`fuel_the_body`), into
 * its body (K-3) or all the way to a working muscle (grades 4-5). Two checks judge a build:
 *
 *   1. FLOW (`traceBuild`, the flow table `FLOW`): each part must accept what the part before it passes on. Outside air
 *      goes in through a nose, mouth, blowhole or breathing holes; lungs take air, gills take water; food is mashed in
 *      a stomach or ground in a gizzard before the intestines can take it into the blood; the heart pumps blood that
 *      carries oxygen or food, and blood tubes take it to the muscle.
 *   2. THE REAL ANIMAL (`bodyAtlas.ts`): every part must be one this animal uses for this job, and the path must be one
 *      a real one uses (a human's nose does not open straight into its lungs; a cow's stomach has four parts).
 *
 * K-5 calibration (user 11-05): difficulty is structure, never vocabulary. The goal sets the path length (K-3: 1-4
 * parts into the body; 4-5: plus heart and blood tubes to a muscle); the tier sets which animals appear and how many
 * parts sit on the bench. Part names are kid words with a picture each.
 */

export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BODY_TASKS = ['deliver_oxygen', 'fuel_the_body'] as const;
export type BodyTask = typeof BODY_TASKS[number];
export type Tier = 'easy' | 'medium' | 'hard';
/** K-3: get it into the body. 4-5: get it to a working muscle (heart and blood tubes). */
export type BodyGoal = 'into_body' | 'to_muscle';

/** What moves along the row in each task, in kid words ("the breath stopped there"). */
export const TASK_NOUN: Record<BodyTask, string> = { deliver_oxygen: 'breath', fuel_the_body: 'food' };
/** What reaches the goal ("the oxygen reached the leg muscle"). */
export const TASK_STUFF: Record<BodyTask, string> = { deliver_oxygen: 'oxygen', fuel_the_body: 'food' };
/** The button that sends it along the row. */
export const TASK_VERB: Record<BodyTask, string> = { deliver_oxygen: 'Breathe', fuel_the_body: 'Eat' };

// ── What moves along the path ───────────────────────────────────────────────

export const TOKENS = [
  'outside_air', 'outside_water', 'air', 'water', 'blood', 'pumped_blood', 'at_muscle',
  'outside_food', 'food', 'mush', 'blood_food', 'pumped_food', 'food_at_muscle',
] as const;
export type Token = typeof TOKENS[number];
export type Source = 'outside_air' | 'outside_water' | 'outside_food';

/** Kid words for each token: the tracer chip and the feedback use them. */
export const TOKEN_WORDS: Record<Token, string> = {
  outside_air: 'air', outside_water: 'water', air: 'air', water: 'water',
  blood: 'oxygen in the blood', pumped_blood: 'pumped blood', at_muscle: 'oxygen at the muscle',
  outside_food: 'food', food: 'swallowed food', mush: 'mashed food', blood_food: 'food in the blood',
  pumped_food: 'pumped blood with food', food_at_muscle: 'food at the muscle',
};

// ── Parts and the flow table ────────────────────────────────────────────────

export const BODY_PARTS = [
  'nose', 'mouth', 'blowhole', 'breathing_holes', 'wet_skin', 'windpipe', 'lungs', 'gills', 'air_tubes',
  'heart', 'blood_tubes', 'stomach', 'intestines', 'crop', 'gizzard', 'four_stomach',
] as const;
export type BodyPart = typeof BODY_PARTS[number];

export const PART_NAMES: Record<BodyPart, string> = {
  nose: 'nose', mouth: 'mouth', blowhole: 'blowhole', breathing_holes: 'breathing holes', wet_skin: 'wet skin',
  windpipe: 'windpipe', lungs: 'lungs', gills: 'gills', air_tubes: 'air tubes', heart: 'heart',
  blood_tubes: 'blood tubes', stomach: 'stomach', intestines: 'intestines', crop: 'crop', gizzard: 'gizzard',
  four_stomach: 'four-part stomach',
};

/** What each part looks like: shown in the part guide, never what it is for. */
export const PART_LOOKS: Record<BodyPart, string> = {
  nose: 'two small holes on the face',
  mouth: 'the opening at the front of the head',
  blowhole: 'a hole on top of the head',
  breathing_holes: 'a row of tiny holes along the side of the body',
  wet_skin: 'thin, damp skin all over the body',
  windpipe: 'a bendy tube with rings, inside the neck',
  lungs: 'two soft, spongy bags in the chest',
  gills: 'red, feathery flaps behind the head',
  air_tubes: 'very thin tubes that branch all through the body',
  heart: 'a strong, squeezing muscle in the chest',
  blood_tubes: 'tubes that branch through the whole body',
  stomach: 'a stretchy bag in the belly',
  intestines: 'a long, curled-up tube in the belly',
  crop: 'a stretchy pouch low in the neck',
  gizzard: 'a thick, tough bag with tiny stones inside',
  four_stomach: 'one big stomach split into four rooms',
};

/** The flow table: what each part takes in and what it passes on. */
export const FLOW: Record<BodyPart, Partial<Record<Token, Token>>> = {
  nose: { outside_air: 'air' },
  mouth: { outside_air: 'air', outside_water: 'water', outside_food: 'food' },
  blowhole: { outside_air: 'air' },
  breathing_holes: { outside_air: 'air' },
  wet_skin: { outside_air: 'blood', outside_water: 'blood' },
  windpipe: { air: 'air' },
  lungs: { air: 'blood' },
  gills: { water: 'blood' },
  air_tubes: { air: 'at_muscle' },
  heart: { blood: 'pumped_blood', blood_food: 'pumped_food' },
  blood_tubes: { pumped_blood: 'at_muscle', pumped_food: 'food_at_muscle' },
  stomach: { food: 'mush' },
  four_stomach: { food: 'mush' },
  gizzard: { food: 'mush' },
  crop: { food: 'food' },
  intestines: { mush: 'blood_food' },
};

export const FOOD_PARTS: readonly BodyPart[] = ['stomach', 'intestines', 'crop', 'gizzard', 'four_stomach'];
export const BREATH_PARTS: readonly BodyPart[] = ['nose', 'blowhole', 'breathing_holes', 'wet_skin', 'windpipe', 'lungs', 'gills', 'air_tubes'];
const OPENINGS: readonly BodyPart[] = ['nose', 'mouth', 'blowhole', 'breathing_holes', 'wet_skin'];
/** The parts that belong to the other job: never on this task's path for any animal. */
export const offJobParts = (task: BodyTask): readonly BodyPart[] => (task === 'deliver_oxygen' ? FOOD_PARTS : BREATH_PARTS);

/** The tokens that finish each goal. */
export function goalDone(task: BodyTask, goal: BodyGoal): readonly Token[] {
  if (task === 'fuel_the_body') return goal === 'into_body' ? ['blood_food'] : ['food_at_muscle'];
  return goal === 'into_body' ? ['blood', 'at_muscle'] : ['at_muscle'];
}

/** The bench for a session: the same for every animal of a task in it, so it never shows which animal needs what. */
export function benchFor(task: BodyTask, goal: BodyGoal, tier: Tier): BodyPart[] {
  const blood: BodyPart[] = goal === 'to_muscle' ? ['heart', 'blood_tubes'] : [];
  if (task === 'fuel_the_body') {
    const base: BodyPart[] = ['mouth', 'stomach', 'intestines', 'nose', 'windpipe', 'lungs'];
    const medium: BodyPart[] = tier === 'easy' ? [] : ['crop', 'gizzard', 'four_stomach'];
    const hard: BodyPart[] = tier === 'hard' ? ['gills', 'wet_skin'] : [];
    return [...base, ...medium, ...hard, ...blood];
  }
  const base: BodyPart[] = ['nose', 'mouth', 'windpipe', 'lungs', 'gills', 'stomach'];
  const medium: BodyPart[] = tier === 'easy' ? [] : ['wet_skin', 'blowhole'];
  const hard: BodyPart[] = tier === 'hard' ? ['breathing_holes', 'air_tubes', 'intestines'] : [];
  return [...base, ...medium, ...hard, ...blood];
}

export function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── The item ────────────────────────────────────────────────────────────────

export type Habitat = 'land' | 'sea' | 'pond' | 'soil' | 'sky';
export const HABITAT_WORDS: Record<Habitat, string> = { land: 'On land', sea: 'In the sea', pond: 'In the pond', soil: 'In the soil', sky: 'In the sky' };

export interface BodyChallenge {
  id: string;
  type: BodyTask;
  goal: BodyGoal;
  animal: string;          // atlas id
  name: string;            // "frog"
  emoji: string;
  habitat: Habitat;
  /** Where the path starts: air or water (never shown before a try; the habitat is), or food. */
  medium: Source;
  /** fuel_the_body: what the animal eats, shown at the start of the row ("grass"). */
  food?: string;
  muscle: string;          // "leg muscle"
  /** One sentence about the animal; names no part of the job. */
  intro: string;
  instruction: string;
  /** Shown only once the path works: how it got there, in the agent's (checked) words. */
  principle: string;
  /** The jobs of the parts on one real path, shown once it works. */
  jobs: Partial<Record<BodyPart, string>>;
  bench: BodyPart[];
  /** Levers drawn from the start (`config.difficulty`; easy: the other job's parts off the bench). Not pulls. */
  startLevers?: string[];
}

// ── Judging a build ─────────────────────────────────────────────────────────

export interface Trace {
  /** tokens[i] is what reaches part i; tokens[build.length] is what reaches the end. */
  tokens: Token[];
  /** The first part that cannot take what reached it, or -1. */
  blockedAt: number;
  /** True when what reaches the end finishes the goal. */
  arrives: boolean;
}

export function traceBuild(task: BodyTask, goal: BodyGoal, source: Token, build: readonly BodyPart[]): Trace {
  const tokens: Token[] = [source];
  for (let i = 0; i < build.length; i++) {
    const out = FLOW[build[i]][tokens[i]];
    if (!out) return { tokens, blockedAt: i, arrives: false };
    tokens.push(out);
  }
  return { tokens, blockedAt: -1, arrives: goalDone(task, goal).includes(tokens[build.length]) };
}

/** Why a path cannot go into the bench as a real animal's, from the flow table alone (the author's first check). */
export function flowErrors(task: BodyTask, goal: BodyGoal, source: Token, path: readonly BodyPart[]): string[] {
  if (!path.length) return ['the path is empty'];
  const t = traceBuild(task, goal, source, path);
  if (t.blockedAt >= 0) {
    const p = path[t.blockedAt];
    return [`${PART_NAMES[p]} cannot take ${TOKEN_WORDS[t.tokens[t.blockedAt]]} (it takes ${Object.keys(FLOW[p]).map(k => TOKEN_WORDS[k as Token]).join(' or ')})`];
  }
  if (!t.arrives) return [`the path ends carrying ${TOKEN_WORDS[t.tokens[path.length]]}; it must end with ${goalDone(task, goal).map(k => TOKEN_WORDS[k]).join(' or ')}`];
  return [];
}

/** The misses each mode names live on the card (`BODY_MISSES_BY_MODE`). */
export type BodyMiss = import('./bodyWorkshop.card').BodyWorkshopMiss;

export interface BodyVerdict {
  correct: boolean;
  trace: Trace;
  miss: BodyMiss | null;
  /** The part to mark: where the path broke, or the part that is not this animal's. -1 = the end. */
  at: number | null;
  /** What happened, in kid words, never which part to use. */
  why: string;
}

/** Facts the verdict needs from the atlas for one task (kept apart so the model stays free of the atlas). */
export interface AnimalFacts {
  name: string;
  owns: readonly BodyPart[];
  notFor: Partial<Record<BodyPart, string>>;
  paths: Record<BodyGoal, ReadonlyArray<readonly BodyPart[]>>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (name: string) => name.endsWith('s');

export function judgeBuild(c: BodyChallenge, a: AnimalFacts, build: readonly BodyPart[]): BodyVerdict {
  const task = c.type;
  const noun = TASK_NOUN[task];
  const trace = traceBuild(task, c.goal, c.medium, build);
  const verdict = (miss: BodyMiss | null, at: number | null, why: string): BodyVerdict => ({ correct: miss === null, trace, miss, at, why });
  if (!build.length) return verdict('stops_short', -1, 'Nothing is built yet.');

  if (trace.blockedAt >= 0) {
    const i = trace.blockedAt, p = build[i], got = trace.tokens[i];
    const name = PART_NAMES[p];
    const are = plural(name) ? 'are' : 'is';
    if (task === 'deliver_oxygen' && FOOD_PARTS.includes(p))
      return verdict('food_path', i, `The ${name} ${are} for food, not ${TOKEN_WORDS[got]}. The ${TOKEN_WORDS[got]} stopped there.`);
    if (task === 'fuel_the_body' && BREATH_PARTS.includes(p))
      return verdict('breath_part', i, `The ${name} ${are} for breathing, not for food. The food stopped there.`);
    if ((got === 'outside_air' || got === 'outside_water' || got === 'outside_food') && !OPENINGS.includes(p))
      return verdict('no_way_in', i, `The ${name} ${are} inside the body. The ${TOKEN_WORDS[got]} needs a way in first.`);
    if (task === 'deliver_oxygen') {
      const waterIn = got === 'water' || got === 'outside_water';
      if ((p === 'gills' && got === 'air') || (waterIn && p !== 'gills'))
        return verdict('wrong_breather', i, p === 'gills'
          ? `Gills need water flowing over them, but air came in. The ${a.name} gets its oxygen another way.`
          : `Water came in, and the ${name} ${plural(name) ? 'work' : 'works'} with air. The ${a.name} gets its oxygen another way.`);
    }
    if (task === 'fuel_the_body' && p === 'intestines' && got === 'food')
      return verdict('not_mashed', i, 'The food is still in big pieces. It has to be mashed up before the intestines can take it in.');
    if (p === 'blood_tubes' && (got === 'blood' || got === 'blood_food'))
      return verdict('no_pump', i, `The blood has ${TASK_STUFF[task]} in it now, but nothing is pushing it along the blood tubes.`);
    return verdict('blocked', i, `The ${name} cannot take ${TOKEN_WORDS[got]}. The ${noun} stopped there.`);
  }
  if (!trace.arrives) {
    const end = trace.tokens[build.length];
    const why = end === 'blood' || end === 'blood_food' ? `The ${TASK_STUFF[task]} got into the blood, but nothing moves that blood to the ${c.muscle}.`
      : end === 'pumped_blood' || end === 'pumped_food' ? `The blood is being pumped, but it has no way to reach the ${c.muscle}.`
      : end === 'mush' ? 'The food is mashed, but it is still inside the belly. It has not got into the blood yet.'
      : end === 'food' ? 'The food was swallowed, but it is still in big pieces inside the body.'
      : `The ${TOKEN_WORDS[end]} is inside the body, but the oxygen has not got out of it yet.`;
    const pumpMissing = (end === 'blood' || end === 'blood_food') && c.goal === 'to_muscle';
    return verdict(pumpMissing ? 'no_pump' : 'stops_short', -1, why);
  }
  // It flows. Is it this animal's?
  const foreign = build.findIndex(p => a.notFor[p] || !a.owns.includes(p));
  if (foreign >= 0) {
    const p = build[foreign];
    const name = PART_NAMES[p];
    const fallback = task === 'deliver_oxygen'
      ? `A ${a.name} does not breathe with ${plural(name) ? '' : 'a '}${name}.`
      : `A ${a.name} does not have ${plural(name) ? '' : 'a '}${name} for its food.`;
    return verdict('not_this_animal', foreign, `It works, but not for a real ${a.name}. ${a.notFor[p] ?? fallback}`);
  }
  const key = build.join('>');
  if (!a.paths[c.goal].some(p => p.join('>') === key)) {
    const nearest = a.paths[c.goal].find(p => build.every(b => p.includes(b))) ?? a.paths[c.goal][0];
    const missing = nearest.some(p => !build.includes(p));
    return verdict('skips_a_part', -1, missing
      ? `${cap(TOKEN_WORDS[trace.tokens[0]])} cannot jump straight across inside a real ${a.name}. A part is missing from the path.`
      : `A real ${a.name} uses these parts in a different order.`);
  }
  return verdict(null, -1, `The ${TASK_STUFF[task]} reached the ${c.goal === 'to_muscle' ? c.muscle : `${a.name}'s blood`}!`);
}

// ── Words for the workspace and the check ───────────────────────────────────

export const startWords = (c: BodyChallenge) => (c.type === 'fuel_the_body' ? `food (${c.food ?? 'food'})` : HABITAT_WORDS[c.habitat].toLowerCase());

export function describeBuild(c: BodyChallenge, build: readonly BodyPart[]): string {
  return build.length ? `${startWords(c)} → ${build.map(p => PART_NAMES[p]).join(' → ')} → ${c.goal === 'to_muscle' ? c.muscle : 'the blood'}`
    : 'nothing built';
}

export const goalWords = (c: BodyChallenge) => (c.goal === 'to_muscle'
  ? `the ${c.name}'s ${c.muscle}` : `into the ${c.name}'s blood`);
