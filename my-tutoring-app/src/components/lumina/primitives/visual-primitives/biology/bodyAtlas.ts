/**
 * Body Workshop's atlas: the real animals, how each one really gets oxygen (the top-level fields) and fuels its body
 * with food (`FOOD_JOBS`), and what each one does NOT use for that job.
 * It is the oracle the author agent is held to (the agent is told only the animal's name) and the judge of the
 * learner's build. Tiers set which animals can appear: easy = lung and gill animals a young child knows; medium adds
 * the contrasts (a whale lives in the sea but breathes air; a frog also breathes through its skin; a tadpole has
 * gills); hard adds animals with no lungs or gills at all (a grasshopper's air tubes, an earthworm's skin).
 */
import type { AnimalFacts, BodyGoal, BodyPart, BodyTask, Habitat, Tier } from './bodyModel';

export interface AtlasAnimal extends AnimalFacts {
  id: string;
  emoji: string;
  habitat: Habitat;
  medium: 'outside_air' | 'outside_water';
  muscle: string;
  /** The first tier the animal appears at. */
  tier: Tier;
  /** Lesson words that make this animal a good fit. */
  topics: readonly string[];
  /** Fallback words when the agent's are rejected. */
  intro: string;
  /** Lever `where_it_breathes`: where the animal is when it takes a breath, air or water. Names no body part. */
  breathes: string;
  /** Lever `animal_fact`: parts this animal does NOT breathe with. Never names a part of its real path. */
  hasNo: string;
  principle: Record<BodyGoal, string>;
  jobs: Partial<Record<BodyPart, string>>;
  /** False: the animal is in the atlas for food only (a cow breathes like a dog, so it adds no oxygen contrast). */
  oxygen?: false;
}

/** One animal's facts for one task: what the judge, the levers and the author read. */
export interface TaskJob extends AnimalFacts {
  tier: Tier;
  /** The task's clue lever: where it breathes, or what and how it eats. Names no part of the real path. */
  clue: string;
  /** Lever `animal_fact`: what this animal does NOT use for the job. Never names a part of its real path. */
  hasNo: string;
  principle: Record<BodyGoal, string>;
  jobs: Partial<Record<BodyPart, string>>;
  /** fuel_the_body: what it eats, shown at the start of the row. */
  food?: string;
}

const LUNG_JOBS: Partial<Record<BodyPart, string>> = {
  nose: 'Lets air in.', mouth: 'Lets air in.', windpipe: 'Carries the air down to the chest.',
  lungs: 'Pass oxygen from the air into the blood.', heart: 'Pumps the blood all around the body.',
  blood_tubes: 'Carry the blood to every muscle.',
};

export const BODY_ATLAS: readonly AtlasAnimal[] = [
  { id: 'human', name: 'person', emoji: '🧒', habitat: 'land', medium: 'outside_air', muscle: 'leg muscle', tier: 'easy',
    owns: ['nose', 'mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes', 'stomach', 'intestines'],
    notFor: { wet_skin: 'A person\'s skin is too dry and thick to take in much oxygen.' },
    paths: {
      into_body: [['nose', 'windpipe', 'lungs'], ['mouth', 'windpipe', 'lungs']],
      to_muscle: [['nose', 'windpipe', 'lungs', 'heart', 'blood_tubes'], ['mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes']],
    },
    topics: ['human', 'body', 'people', 'person', 'breath', 'exercise', 'health', 'organ'],
    intro: 'A person runs, jumps and plays on land.',
    breathes: 'A person lives on land and breathes in the air all around.',
    hasNo: "A person has no gills, and a person's dry skin cannot take in air.",
    principle: {
      into_body: 'Air comes in through the nose or mouth, goes down the windpipe, and the lungs pass its oxygen into the blood.',
      to_muscle: 'The lungs put oxygen into the blood, and the heart pumps that blood through blood tubes to the leg muscle.',
    },
    jobs: LUNG_JOBS },
  { id: 'dog', name: 'dog', emoji: '🐕', habitat: 'land', medium: 'outside_air', muscle: 'leg muscle', tier: 'easy',
    owns: ['nose', 'mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes', 'stomach', 'intestines'],
    notFor: { wet_skin: 'A dog\'s skin is covered in fur and cannot take in oxygen.' },
    paths: {
      into_body: [['nose', 'windpipe', 'lungs'], ['mouth', 'windpipe', 'lungs']],
      to_muscle: [['nose', 'windpipe', 'lungs', 'heart', 'blood_tubes'], ['mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes']],
    },
    topics: ['dog', 'pet', 'mammal', 'animal'],
    intro: 'A dog runs and sniffs all around the park.',
    breathes: 'A dog lives on land and breathes in the air all around.',
    hasNo: 'A dog has no gills, and its furry skin cannot take in air.',
    principle: {
      into_body: 'Air goes in through the dog\'s nose or mouth, down its windpipe, and its lungs pass the oxygen into its blood.',
      to_muscle: 'The dog\'s lungs put oxygen into its blood, and its heart pumps that blood to its leg muscles.',
    },
    jobs: LUNG_JOBS },
  { id: 'bird', name: 'bird', emoji: '🐦', habitat: 'sky', medium: 'outside_air', muscle: 'wing muscle', tier: 'easy',
    owns: ['nose', 'mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes', 'stomach', 'intestines'],
    notFor: { mouth: 'A bird breathes through two small holes on its beak, its nostrils.', wet_skin: 'A bird\'s skin is covered in feathers and cannot take in oxygen.' },
    paths: { into_body: [['nose', 'windpipe', 'lungs']], to_muscle: [['nose', 'windpipe', 'lungs', 'heart', 'blood_tubes']] },
    topics: ['bird', 'flight', 'fly', 'flying', 'wing', 'feather', 'nest'],
    intro: 'A bird flaps its wings to fly high in the sky.',
    breathes: 'A bird breathes in the air, even while it flies.',
    hasNo: 'A bird has no gills, and its feathery skin cannot take in air.',
    principle: {
      into_body: 'Air goes in through two little holes on the bird\'s beak, down its windpipe, and its lungs pass the oxygen into its blood.',
      to_muscle: 'The bird\'s lungs put oxygen into its blood, and its fast heart pumps it to the big muscles that flap its wings.',
    },
    jobs: { ...LUNG_JOBS, nose: 'Two little holes on the beak let air in.' } },
  { id: 'fish', name: 'fish', emoji: '🐟', habitat: 'sea', medium: 'outside_water', muscle: 'tail muscle', tier: 'easy',
    owns: ['mouth', 'gills', 'heart', 'blood_tubes', 'stomach', 'intestines'],
    notFor: { nose: 'A fish has nostrils, but only for smelling. Water for breathing comes in through its mouth.' },
    paths: { into_body: [['mouth', 'gills']], to_muscle: [['mouth', 'gills', 'heart', 'blood_tubes']] },
    topics: ['fish', 'ocean', 'sea', 'water', 'river', 'lake', 'swim', 'aquatic', 'gill'],
    intro: 'A fish swims under the water all day and never comes up for air.',
    breathes: 'A fish stays under the water all the time. It gets its oxygen from the water.',
    hasNo: 'A fish has no lungs. Its nostrils are only for smelling.',
    principle: {
      into_body: 'Water goes in the fish\'s mouth and out over its gills, and the gills take the oxygen out of the water into its blood.',
      to_muscle: 'The gills take oxygen from the water into the blood, and the heart pumps it to the tail muscle that swishes the tail.',
    },
    jobs: { mouth: 'Gulps water in.', gills: 'Take oxygen out of the water and into the blood.',
      heart: 'Pumps the blood around the body.', blood_tubes: 'Carry the blood to the tail muscle.' } },
  { id: 'whale', name: 'whale', emoji: '🐋', habitat: 'sea', medium: 'outside_air', muscle: 'tail muscle', tier: 'medium',
    owns: ['blowhole', 'windpipe', 'lungs', 'heart', 'blood_tubes', 'mouth', 'stomach', 'intestines'],
    notFor: { mouth: 'A whale\'s mouth is for eating. It breathes through the hole on top of its head when it comes up to the surface.',
      gills: 'A whale lives in the sea, but it has no gills. It comes up to the surface to breathe air.' },
    paths: { into_body: [['blowhole', 'windpipe', 'lungs']], to_muscle: [['blowhole', 'windpipe', 'lungs', 'heart', 'blood_tubes']] },
    topics: ['whale', 'ocean', 'sea', 'mammal', 'marine', 'dolphin'],
    intro: 'A whale swims deep in the sea, then rises to the top of the water with a big whoosh.',
    breathes: 'A whale lives in the sea, but it swims up to the top of the water to take a breath of air.',
    hasNo: 'A whale is not a fish: it has no gills.',
    principle: {
      into_body: 'At the surface the whale breathes air in through the hole on its head, down its windpipe, into its lungs, which pass the oxygen into its blood.',
      to_muscle: 'The whale\'s lungs fill its blood with oxygen, and its heart pumps that blood to the huge tail muscle it swims with.',
    },
    jobs: { blowhole: 'Opens at the surface to let air in.', windpipe: 'Carries the air down.', lungs: 'Pass oxygen into the blood.',
      heart: 'Pumps the blood around the body.', blood_tubes: 'Carry the blood to the tail muscle.' } },
  { id: 'frog', name: 'frog', emoji: '🐸', habitat: 'pond', medium: 'outside_air', muscle: 'leg muscle', tier: 'medium',
    owns: ['nose', 'lungs', 'wet_skin', 'heart', 'blood_tubes', 'mouth', 'stomach', 'intestines'],
    notFor: { windpipe: 'A frog has almost no windpipe. Its throat opens nearly straight into its lungs.',
      mouth: 'A frog keeps its mouth shut and pulls air in through its nose.', gills: 'A grown-up frog has no gills. Only tadpoles do.' },
    paths: { into_body: [['nose', 'lungs'], ['wet_skin']], to_muscle: [['nose', 'lungs', 'heart', 'blood_tubes'], ['wet_skin', 'heart', 'blood_tubes']] },
    topics: ['frog', 'amphibian', 'pond', 'wetland', 'life cycle', 'toad'],
    intro: 'A frog sits by the pond and leaps from lily pad to lily pad.',
    breathes: 'A grown-up frog sits by the pond and breathes the air.',
    hasNo: 'A grown-up frog has no gills, and it keeps its mouth shut to breathe.',
    principle: {
      into_body: 'A frog breathes air in through its nose into its lungs, and it can also take oxygen in through its thin, wet skin.',
      to_muscle: 'Oxygen gets into the frog\'s blood through its lungs or its wet skin, and its heart pumps the blood to its strong leg muscles.',
    },
    jobs: { nose: 'Lets air in.', lungs: 'Pass oxygen into the blood.', wet_skin: 'Lets oxygen soak straight into the blood.',
      heart: 'Pumps the blood around the body.', blood_tubes: 'Carry the blood to the leg muscles.' } },
  { id: 'tadpole', name: 'tadpole', emoji: '🫧', habitat: 'pond', medium: 'outside_water', muscle: 'tail muscle', tier: 'medium',
    owns: ['mouth', 'gills', 'heart', 'blood_tubes', 'stomach', 'intestines'],
    notFor: { lungs: 'A young tadpole has no lungs yet. They grow when it turns into a frog.' },
    paths: { into_body: [['mouth', 'gills']], to_muscle: [['mouth', 'gills', 'heart', 'blood_tubes']] },
    topics: ['tadpole', 'frog', 'life cycle', 'amphibian', 'pond', 'metamorphosis'],
    intro: 'A tadpole wiggles its tail to swim in the pond. One day it will turn into a frog.',
    breathes: 'A tadpole stays under the pond water all the time. It gets its oxygen from the water.',
    hasNo: 'A young tadpole has no lungs yet.',
    principle: {
      into_body: 'Water goes in the tadpole\'s mouth and over its gills, which take the oxygen into its blood, just like a fish.',
      to_muscle: 'The tadpole\'s gills take oxygen from the water, and its heart pumps it to the tail muscle it wiggles.',
    },
    jobs: { mouth: 'Takes water in.', gills: 'Take oxygen out of the water and into the blood.',
      heart: 'Pumps the blood.', blood_tubes: 'Carry the blood to the tail.' } },
  { id: 'grasshopper', name: 'grasshopper', emoji: '🦗', habitat: 'land', medium: 'outside_air', muscle: 'jumping leg muscle', tier: 'hard',
    owns: ['breathing_holes', 'air_tubes', 'mouth', 'heart', 'stomach', 'intestines'],
    notFor: { mouth: 'A grasshopper\'s mouth is only for eating. Air goes in through tiny holes along its sides.',
      heart: 'A grasshopper has a heart, but its blood does not carry oxygen. Air tubes take air right to the muscles.',
      nose: 'A grasshopper has no nose.', lungs: 'A grasshopper has no lungs.' },
    paths: { into_body: [['breathing_holes', 'air_tubes']], to_muscle: [['breathing_holes', 'air_tubes']] },
    topics: ['insect', 'grasshopper', 'bug', 'cricket', 'ant', 'beetle', 'invertebrate'],
    intro: 'A grasshopper lives in the tall grass and jumps many times its own length.',
    breathes: 'A grasshopper lives on land and breathes the air.',
    hasNo: 'A grasshopper is an insect: it has no nose and no lungs, and its blood carries no oxygen.',
    principle: {
      into_body: 'Air goes in through tiny holes along the grasshopper\'s sides, and thin air tubes carry it all through its body.',
      to_muscle: 'A grasshopper does not use its blood for oxygen: tiny holes let air in, and air tubes carry it straight to its jumping muscles.',
    },
    jobs: { breathing_holes: 'Tiny holes along the sides let air in.', air_tubes: 'Carry the air right to every muscle.' } },
  { id: 'earthworm', name: 'earthworm', emoji: '🪱', habitat: 'soil', medium: 'outside_air', muscle: 'body muscle', tier: 'hard',
    owns: ['wet_skin', 'heart', 'blood_tubes', 'mouth', 'stomach', 'intestines'],
    notFor: { mouth: 'An earthworm\'s mouth is only for eating soil. It breathes through its skin.',
      nose: 'An earthworm has no nose.', lungs: 'An earthworm has no lungs.' },
    paths: { into_body: [['wet_skin']], to_muscle: [['wet_skin', 'heart', 'blood_tubes']] },
    topics: ['earthworm', 'worm', 'soil', 'decomposer', 'garden', 'invertebrate'],
    intro: 'An earthworm wriggles through the damp soil under the garden.',
    breathes: 'An earthworm lives in damp soil, where there is air in the tiny spaces between bits of dirt.',
    hasNo: 'An earthworm has no nose, no mouth for breathing, and no lungs.',
    principle: {
      into_body: 'An earthworm has no lungs: oxygen from the air in the soil soaks in through its wet skin, straight into its blood.',
      to_muscle: 'Oxygen soaks in through the worm\'s wet skin, and its hearts pump the blood along to the muscles it wriggles with.',
    },
    jobs: { wet_skin: 'Lets oxygen soak in, as long as it stays wet.', heart: 'Pumps the blood (a worm has five of them).',
      blood_tubes: 'Carry the blood along the body.' } },
  { id: 'cow', name: 'cow', emoji: '🐄', habitat: 'land', medium: 'outside_air', muscle: 'leg muscle', tier: 'medium', oxygen: false,
    owns: ['nose', 'mouth', 'windpipe', 'lungs', 'heart', 'blood_tubes', 'four_stomach', 'intestines'],
    notFor: { wet_skin: 'A cow\'s skin is covered in hair and cannot take in oxygen.' },
    paths: { into_body: [['nose', 'windpipe', 'lungs']], to_muscle: [['nose', 'windpipe', 'lungs', 'heart', 'blood_tubes']] },
    topics: ['cow', 'farm', 'grass', 'cattle', 'milk', 'herbivore', 'mammal', 'grazing'],
    intro: 'A cow munches grass in the field all day long.',
    breathes: 'A cow lives on land and breathes in the air all around.',
    hasNo: 'A cow has no gills.',
    principle: {
      into_body: 'Air goes in the cow\'s nose, down its windpipe, and its lungs pass the oxygen into its blood.',
      to_muscle: 'The cow\'s lungs put oxygen into its blood, and its heart pumps that blood to its leg muscles.',
    },
    jobs: LUNG_JOBS },
];

export const ATLAS_IDS = BODY_ATLAS.map(a => a.id);
export const atlasAnimal = (id: string): AtlasAnimal | undefined => BODY_ATLAS.find(a => a.id === id);

// ── fuel_the_body ──────────────────────────────────────────────────────────

const PLAIN_FOOD_JOBS: Partial<Record<BodyPart, string>> = {
  mouth: 'Chews the food into small bits.', stomach: 'Squeezes and mashes the food into mush.',
  intestines: 'Soak the food out of the mush and into the blood.', heart: 'Pumps the blood all around the body.',
  blood_tubes: 'Carry the food in the blood to every muscle.',
};
const PLAIN_PATHS: TaskJob['paths'] = {
  into_body: [['mouth', 'stomach', 'intestines']], to_muscle: [['mouth', 'stomach', 'intestines', 'heart', 'blood_tubes']],
};
const GRINDER_PATHS: TaskJob['paths'] = {
  into_body: [['mouth', 'crop', 'gizzard', 'intestines']], to_muscle: [['mouth', 'crop', 'gizzard', 'intestines', 'heart', 'blood_tubes']],
};
const PLAIN_OWNS: BodyPart[] = ['mouth', 'stomach', 'intestines', 'heart', 'blood_tubes'];
const NO_GRINDER: Partial<Record<BodyPart, string>> = {
  crop: 'Food goes straight down to the stomach: there is no pouch in the neck to hold it.',
  gizzard: 'Food is mashed in a plain stomach, with no stones to grind it.',
  four_stomach: 'Its stomach is one bag. Only cows and their cousins have a stomach with four rooms.',
};

/**
 * How each animal fuels its body. Tiers: easy = one stomach (a person, a dog, a fish); medium adds the contrasts (a
 * frog swallows bugs whole; a bird has no teeth and grinds seeds with stones; a cow's stomach has four rooms); hard adds
 * an earthworm (soil in, a crop and a gizzard like a bird's).
 */
export const FOOD_JOBS: Readonly<Record<string, TaskJob>> = {
  human: { name: 'person', tier: 'easy', food: 'a sandwich', owns: PLAIN_OWNS, notFor: NO_GRINDER, paths: PLAIN_PATHS,
    clue: 'A person bites and chews food with teeth before swallowing it.',
    hasNo: 'A person has teeth, so it has no stones inside to grind its food.',
    principle: {
      into_body: 'Teeth chew the food, the stomach mashes it, and the intestines soak the food into the blood.',
      to_muscle: 'The food is chewed, mashed and soaked into the blood, and the heart pumps it to the leg muscle for energy.',
    },
    jobs: PLAIN_FOOD_JOBS },
  dog: { name: 'dog', tier: 'easy', food: 'dog food', owns: PLAIN_OWNS, notFor: NO_GRINDER, paths: PLAIN_PATHS,
    clue: 'A dog gulps its food down after only a few chews.',
    hasNo: 'A dog has sharp teeth, so it has no stones inside to grind its food.',
    principle: {
      into_body: 'The dog gulps its food, its stomach mashes it, and its intestines soak the food into its blood.',
      to_muscle: 'The dog\'s food is mashed and soaked into its blood, and its heart pumps it to the leg muscles it runs with.',
    },
    jobs: { ...PLAIN_FOOD_JOBS, mouth: 'Bites the food and gulps it down.' } },
  fish: { name: 'fish', tier: 'easy', food: 'tiny shrimp', owns: PLAIN_OWNS, notFor: NO_GRINDER, paths: PLAIN_PATHS,
    clue: 'A fish swallows its food whole, without chewing.',
    hasNo: 'A fish has no pouch in its neck and no stones inside to grind its food.',
    principle: {
      into_body: 'The fish swallows the shrimp whole, its stomach mashes it, and its intestines soak the food into its blood.',
      to_muscle: 'The fish\'s food is mashed and soaked into its blood, and its heart pumps it to the tail muscle it swims with.',
    },
    jobs: { ...PLAIN_FOOD_JOBS, mouth: 'Swallows the food whole.' } },
  frog: { name: 'frog', tier: 'medium', food: 'a fly', owns: PLAIN_OWNS, notFor: NO_GRINDER, paths: PLAIN_PATHS,
    clue: 'A frog catches a bug with its sticky tongue and swallows it whole.',
    hasNo: 'A frog has no teeth for chewing and no stones inside to grind its food.',
    principle: {
      into_body: 'The frog swallows the fly whole, its stomach mashes it, and its intestines soak the food into its blood.',
      to_muscle: 'The fly is mashed and soaked into the frog\'s blood, and its heart pumps it to the leg muscles it jumps with.',
    },
    jobs: { ...PLAIN_FOOD_JOBS, mouth: 'A sticky tongue grabs the bug and the frog swallows it whole.' } },
  bird: { name: 'bird', tier: 'medium', food: 'seeds', owns: ['mouth', 'crop', 'gizzard', 'intestines', 'heart', 'blood_tubes'],
    notFor: { stomach: 'A bird has no teeth, so a plain stomach could not break up its hard seeds.',
      four_stomach: 'Only cows and their cousins have a stomach with four rooms.' },
    paths: GRINDER_PATHS,
    clue: 'A bird has no teeth. It swallows hard seeds whole, and it swallows tiny stones too.',
    hasNo: 'A bird has no teeth to chew with.',
    principle: {
      into_body: 'The crop holds the seeds, the gizzard grinds them up with tiny stones, and the intestines soak the food into the blood.',
      to_muscle: 'The seeds are ground up and soaked into the bird\'s blood, and its heart pumps the food to its wing muscles.',
    },
    jobs: { mouth: 'The beak picks up seeds and swallows them whole.', crop: 'A pouch in the neck that holds the seeds for later.',
      gizzard: 'A tough bag with tiny stones that grinds the seeds.', intestines: 'Soak the food into the blood.',
      heart: 'Pumps the blood around the body.', blood_tubes: 'Carry the food to the wing muscles.' } },
  cow: { name: 'cow', tier: 'medium', food: 'grass', owns: ['mouth', 'four_stomach', 'intestines', 'heart', 'blood_tubes'],
    notFor: { stomach: 'A cow\'s stomach is not one plain bag: tough grass needs more room and more time.',
      crop: 'A cow has no pouch in its neck.', gizzard: 'A cow chews with its teeth: it has no stones inside.' },
    paths: { into_body: [['mouth', 'four_stomach', 'intestines']], to_muscle: [['mouth', 'four_stomach', 'intestines', 'heart', 'blood_tubes']] },
    clue: 'A cow eats tough grass all day, and it chews the same mouthful twice.',
    hasNo: 'A cow has no pouch in its neck and no stones inside to grind its food.',
    principle: {
      into_body: 'The cow\'s four-room stomach soaks and softens the tough grass, the cow chews it again, and its intestines soak the food into its blood.',
      to_muscle: 'The grass is broken down in the four-room stomach and soaked into the blood, and the heart pumps it to the leg muscles.',
    },
    jobs: { mouth: 'Chews the grass, and later chews it again.', four_stomach: 'Four rooms that soak and soften tough grass.',
      intestines: 'Soak the food into the blood.', heart: 'Pumps the blood around the body.',
      blood_tubes: 'Carry the food to the leg muscles.' } },
  earthworm: { name: 'earthworm', tier: 'hard', food: 'soil with bits of dead leaves',
    owns: ['mouth', 'crop', 'gizzard', 'intestines', 'heart', 'blood_tubes'],
    notFor: { stomach: 'An earthworm has no plain stomach, and no teeth.', wet_skin: 'Its wet skin is for breathing, not for food.',
      four_stomach: 'Only cows and their cousins have a stomach with four rooms.' },
    paths: GRINDER_PATHS,
    clue: 'An earthworm swallows soil and eats the bits of dead leaves in it. It has no teeth.',
    hasNo: 'An earthworm has no teeth and no plain stomach.',
    principle: {
      into_body: 'The crop holds the soil, the gizzard grinds it with tiny grains of sand, and the intestines soak the food into the worm\'s blood.',
      to_muscle: 'The food is ground up and soaked into the worm\'s blood, and its hearts pump it to the muscles it wriggles with.',
    },
    jobs: { mouth: 'Sucks in soil.', crop: 'Holds the soil for a while.', gizzard: 'Grinds the soil with tiny grains of sand.',
      intestines: 'Soak the food into the blood.', heart: 'Pumps the blood (a worm has five hearts).',
      blood_tubes: 'Carry the food along the body.' } },
};

/** One animal's facts for a task, or undefined when it is not in that task. */
export function jobOf(a: AtlasAnimal, task: BodyTask): TaskJob | undefined {
  if (task === 'fuel_the_body') return FOOD_JOBS[a.id];
  if (a.oxygen === false) return undefined;
  return { name: a.name, tier: a.tier, owns: a.owns, notFor: a.notFor, paths: a.paths, clue: a.breathes, hasNo: a.hasNo,
    principle: a.principle, jobs: a.jobs };
}
export const jobFor = (id: string, task: BodyTask) => { const a = atlasAnimal(id); return a ? jobOf(a, task) : undefined; };

const TIER_RANK: Record<Tier, number> = { easy: 0, medium: 1, hard: 2 };
/** Animals that can appear in a task at a tier. */
export const animalsFor = (task: BodyTask, tier: Tier) =>
  BODY_ATLAS.filter(a => { const j = jobOf(a, task); return !!j && TIER_RANK[j.tier] <= TIER_RANK[tier]; });
/** The animals a tier adds to a task (one of them must appear, so medium and hard carry a contrast). */
export const newAt = (task: BodyTask, tier: Tier) => BODY_ATLAS.filter(a => jobOf(a, task)?.tier === tier);

/** Why a path is not this animal's real one for the task, or none. */
export function fidelityErrors(a: AtlasAnimal, task: BodyTask, goal: BodyGoal, path: readonly BodyPart[]): string[] {
  const j = jobOf(a, task);
  if (!j) return [`a ${a.name} is not in this task`];
  const foreign = path.filter(p => j.notFor[p] || !j.owns.includes(p));
  if (foreign.length) return foreign.map(p => `a ${a.name} does not use ${p} for this`);
  const key = path.join('>');
  if (j.paths[goal].some(p => p.join('>') === key)) return [];
  return [`a real ${a.name}'s path is not ${path.join(' > ')}: include every part a real one uses, in order, and only those`];
}
