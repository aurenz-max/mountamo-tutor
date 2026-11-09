/**
 * Life Lab's facts. Code owns every biology fact a world runs on: what each living thing needs, what each kind of
 * part is good for, each life cycle, each real breathing path, and the words for each. The author agent names
 * organisms by atlas id and composes worlds from them; it never states a fact (USER 2026-11-07, the biology canvas:
 * `qa/science-build/workshop-worlds-design.md`).
 */

export type Level = 0 | 1 | 2;
export const COND_KEYS = ['light', 'water', 'temp'] as const;
export type CondKey = typeof COND_KEYS[number];
export const COND_WORDS: Record<CondKey, [string, string, string]> = {
  light: ['dark', 'dim light', 'bright light'],
  water: ['dry', 'some water', 'lots of water'],
  temp: ['cold', 'mild', 'hot'],
};
export const COND_ICON: Record<CondKey, [string, string, string]> = {
  light: ['🌑', '⛅', '☀️'], water: ['🏜️', '💧', '🌊'], temp: ['❄️', '🌤️', '🔥'],
};

export const FOODS = ['hard_seeds', 'nectar', 'meat', 'fish'] as const;
export const CARRIERS = ['wind', 'fur', 'water'] as const;
export const GROUNDS = ['water', 'snow', 'tree', 'sand'] as const;
/** Colors a background (bark, leaves, soil, snow, sand) or an animal's coloring can have. */
export const SHADES = ['light', 'dark', 'green', 'brown', 'white', 'sandy'] as const;
export const SHADE_FILL: Record<string, string> = { light: '#ece5d2', dark: '#2f2924', green: '#4d9a3a', brown: '#7a5130', white: '#f8fafc', sandy: '#e3c58e' };
export const MEDIA = ['air', 'water'] as const;
export type Food = typeof FOODS[number];
export type Carrier = typeof CARRIERS[number];
export type Ground = typeof GROUNDS[number];
export type Shade = typeof SHADES[number];
export type Medium = typeof MEDIA[number];

export const FOOD_WORDS: Record<Food, string> = { hard_seeds: 'hard seeds', nectar: 'flower nectar', meat: 'meat', fish: 'fish in the water' };
export const CARRIER_WORDS: Record<Carrier, string> = { wind: 'wind', fur: 'passing animal', water: 'stream' };
export const CARRIER_SCENE: Record<Carrier, string> = { wind: 'a strong wind blows here', fur: 'a furry animal walks through every day', water: 'a stream flows past' };
export const GROUND_WORDS: Record<Ground, string> = { water: 'swim across the pond', snow: 'walk on deep snow', tree: 'climb the tree', sand: 'walk on soft sand' };
export const GROUND_SCENE: Record<Ground, string> = { water: 'deep water', snow: 'deep, soft snow', tree: 'a tall tree trunk', sand: 'soft, loose sand' };

export const ZONE_KINDS = ['pot', 'meadow', 'field', 'ice', 'desert', 'pond', 'river', 'sea', 'forest', 'snow', 'bark', 'plain'] as const;
export type ZoneKind = typeof ZONE_KINDS[number];

// ── Parts and what they are good for ────────────────────────────────────────

export const PART_KINDS = ['beak', 'seed', 'feet'] as const;
export type PartKind = typeof PART_KINDS[number];
/** Which condition of the place a part meets. */
export const PART_ON: Record<PartKind, 'food' | 'carrier' | 'ground'> = { beak: 'food', seed: 'carrier', feet: 'ground' };
/** Structure → function: what each part works on. */
export const PART_JOBS: Record<PartKind, Record<string, readonly string[]>> = {
  beak: { thick: ['hard_seeds'], long: ['nectar'], hook: ['meat'], spear: ['fish'] },
  seed: { wings: ['wind'], fluff: ['wind'], hooks: ['fur'], hollow: ['water'], plain: [] },
  feet: { webbed: ['water'], snowshoe: ['snow'], claws: ['tree'], pads: ['sand'] },
};
/** What each option looks like, in the child's words (never what it is for). */
export const PART_LABELS: Record<PartKind, Record<string, string>> = {
  beak: { thick: 'thick short beak', long: 'long thin beak', hook: 'hooked beak', spear: 'long pointed beak' },
  seed: { wings: 'paper wings', fluff: 'fluffy top', hooks: 'tiny hooks', hollow: 'light hollow shell', plain: 'smooth and round' },
  feet: { webbed: 'webbed feet', snowshoe: 'big furry paws', claws: 'sharp curved claws', pads: 'wide flat pads' },
};
export const optionLabel = (part: PartKind | 'color', v: string) => (part === 'color' ? `${v} coloring` : PART_LABELS[part][v] ?? v);
/**
 * Words that tell what a working option does or looks like. An ask that uses one hands the child the match (USER
 * 2026-11-07 read of real generations: "feet that push water like paddles", "glide through the air").
 */
export const GIVEAWAY: Record<PartKind, Record<string, readonly string[]>> = {
  beak: { thick: ['thick', 'crack', 'crush', 'strong beak'], long: ['long', 'reach', 'deep inside', 'sip', 'straw'], hook: ['hook', 'tear', 'rip'], spear: ['spear', 'stab', 'pointed', 'dart', 'strike', 'snag'] },
  seed: { wings: ['wing', 'glide', 'fly', 'spin'], fluff: ['fluff', 'fuzzy', 'parachute', 'float on the air'], hooks: ['hook', 'snag', 'stick', 'catch onto', 'catches onto', 'cling', 'grab'],
    hollow: ['float', 'hollow', 'bob'], plain: [] },
  feet: { webbed: ['web', 'paddle', 'flipper', 'push water'], snowshoe: ['sink', 'snowshoe', 'big paws', 'furry'], claws: ['claw', 'grip', 'cling', 'sharp', 'dig in'], pads: ['pad', 'wide', 'flat', 'sink'] },
};
export const partWorks = (part: PartKind, value: string, on: string | undefined) => !!on && (PART_JOBS[part][value] ?? []).includes(on);

// ── Inherited traits ────────────────────────────────────────────────────────

export const INHERIT_TRAITS = ['ears', 'coat', 'color'] as const;
export type InheritTrait = typeof INHERIT_TRAITS[number];
export const TRAIT_VALUES: Record<InheritTrait, readonly string[]> = {
  ears: ['floppy', 'pointy'], coat: ['spots', 'plain', 'stripes'], color: ['brown', 'black', 'white', 'golden'],
};
export const traitWords = (t: InheritTrait, v: string) => (t === 'ears' ? `${v} ears` : t === 'coat' ? (v === 'plain' ? 'a plain coat' : v) : `${v} fur`);

// ── Breathing paths (body-workshop's flow table, into the blood) ────────────

export const BODY_PARTS = ['nose', 'mouth', 'blowhole', 'wet_skin', 'windpipe', 'lungs', 'gills', 'stomach'] as const;
export type BodyPart = typeof BODY_PARTS[number];
export type Token = 'outside_air' | 'outside_water' | 'air' | 'water' | 'blood';
export const FLOW: Record<BodyPart, Partial<Record<Token, Token>>> = {
  nose: { outside_air: 'air' }, mouth: { outside_air: 'air', outside_water: 'water' }, blowhole: { outside_air: 'air' },
  wet_skin: { outside_air: 'blood', outside_water: 'blood' }, windpipe: { air: 'air' }, lungs: { air: 'blood' },
  gills: { water: 'blood' }, stomach: {},
};
export const TOKEN_WORDS: Record<Token, string> = { outside_air: 'air', outside_water: 'water', air: 'air', water: 'water', blood: 'oxygen in the blood' };
/** Other words a child hears for each part: an ask using one names the part ("moist skin" is wet skin). */
export const BODY_PART_WORDS: Record<BodyPart, readonly string[]> = {
  nose: ['nose', 'nostril'], mouth: ['mouth'], blowhole: ['blowhole', 'hole on top'], wet_skin: ['skin'], windpipe: ['windpipe', 'throat'],
  lungs: ['lung'], gills: ['gill'], stomach: ['stomach', 'belly'],
};
export const BODY_PART_NAMES: Record<BodyPart, string> = {
  nose: 'nose', mouth: 'mouth', blowhole: 'blowhole', wet_skin: 'wet skin', windpipe: 'windpipe', lungs: 'lungs', gills: 'gills', stomach: 'stomach',
};

// ── Life-cycle stages ───────────────────────────────────────────────────────

export const STAGES = ['egg', 'caterpillar', 'chrysalis', 'butterfly', 'tadpole', 'froglet', 'frog', 'chick', 'hen', 'seed', 'sprout', 'seedling', 'flower', 'pod'] as const;
export type Stage = typeof STAGES[number];
export const STAGE_NAMES: Record<Stage, string> = {
  egg: 'egg', caterpillar: 'caterpillar', chrysalis: 'chrysalis', butterfly: 'butterfly', tadpole: 'tadpole', froglet: 'froglet', frog: 'frog',
  chick: 'chick', hen: 'hen', seed: 'seed', sprout: 'sprout', seedling: 'seedling', flower: 'flowering plant', pod: 'bean pod',
};

// ── Organisms ───────────────────────────────────────────────────────────────

export type Draws = 'emoji' | 'plant' | 'bird' | 'seed' | 'moth' | 'bug' | 'critter' | 'feet';
export interface Organism {
  name: string;
  kind: 'animal' | 'plant';
  emoji: string;
  /** What it needs from its place, as inclusive level ranges. */
  needs?: Partial<Record<CondKey, [Level, Level]>>;
  /** Its life cycle, in order (the last stage makes the first again). */
  cycle?: readonly Stage[];
  /** Real paths that get oxygen into its blood. */
  breathes?: readonly (readonly BodyPart[])[];
  /** How the board draws it. */
  draws: Draws;
  /** What it really hunts by sight (a bird eats moths; a fox does not). */
  hunts?: readonly string[];
  /** The part this animal really has (a real duck has webbed feet). A world asking for another part on it is wrong. */
  parts?: Partial<Record<PartKind, string>>;
}

export const ORGANISMS: Record<string, Organism> = {
  bean: { name: 'bean plant', kind: 'plant', emoji: '🌱', draws: 'plant', needs: { light: [1, 2], water: [1, 2] }, cycle: ['seed', 'sprout', 'seedling', 'flower', 'pod'] },
  sunflower: { name: 'sunflower', kind: 'plant', emoji: '🌻', draws: 'plant', needs: { light: [2, 2], water: [1, 2] } },
  cactus: { name: 'cactus', kind: 'plant', emoji: '🌵', draws: 'emoji', needs: { light: [2, 2], water: [0, 1], temp: [1, 2] } },
  fern: { name: 'fern', kind: 'plant', emoji: '🌿', draws: 'emoji', needs: { light: [0, 1], water: [2, 2] } },
  polar_bear: { name: 'polar bear', kind: 'animal', emoji: '🐻‍❄️', draws: 'emoji', needs: { temp: [0, 0] }, parts: { feet: 'snowshoe' } },
  penguin: { name: 'penguin', kind: 'animal', emoji: '🐧', draws: 'emoji', needs: { temp: [0, 0], water: [2, 2] } },
  camel: { name: 'camel', kind: 'animal', emoji: '🐪', draws: 'emoji', needs: { temp: [2, 2], water: [0, 1] }, parts: { feet: 'pads' } },
  lizard: { name: 'lizard', kind: 'animal', emoji: '🦎', draws: 'emoji', needs: { temp: [2, 2], water: [0, 1] }, hunts: ['beetle', 'grasshopper', 'moth'] },
  frog: { name: 'frog', kind: 'animal', emoji: '🐸', draws: 'emoji', needs: { temp: [1, 1], water: [2, 2] }, parts: { feet: 'webbed' }, cycle: ['egg', 'tadpole', 'froglet', 'frog'], breathes: [['nose', 'lungs'], ['wet_skin']] },
  duck: { name: 'duck', kind: 'animal', emoji: '🦆', draws: 'emoji', needs: { temp: [1, 1], water: [2, 2] }, parts: { feet: 'webbed' } },
  squirrel: { name: 'squirrel', kind: 'animal', emoji: '🐿️', draws: 'emoji', parts: { feet: 'claws' } },
  rabbit: { name: 'rabbit', kind: 'animal', emoji: '🐇', draws: 'emoji', needs: { temp: [1, 1], water: [1, 1] } },
  fish: { name: 'fish', kind: 'animal', emoji: '🐟', draws: 'emoji', needs: { water: [2, 2] }, breathes: [['mouth', 'gills']] },
  tadpole: { name: 'tadpole', kind: 'animal', emoji: '🐟', draws: 'emoji', breathes: [['mouth', 'gills']] },
  whale: { name: 'whale', kind: 'animal', emoji: '🐋', draws: 'emoji', breathes: [['blowhole', 'windpipe', 'lungs']] },
  human: { name: 'person', kind: 'animal', emoji: '🧒', draws: 'emoji', breathes: [['nose', 'windpipe', 'lungs'], ['mouth', 'windpipe', 'lungs']] },
  dog: { name: 'dog', kind: 'animal', emoji: '🐕', draws: 'critter', breathes: [['nose', 'windpipe', 'lungs'], ['mouth', 'windpipe', 'lungs']] },
  cat: { name: 'cat', kind: 'animal', emoji: '🐈', draws: 'critter' },
  butterfly: { name: 'butterfly', kind: 'animal', emoji: '🦋', draws: 'emoji', cycle: ['egg', 'caterpillar', 'chrysalis', 'butterfly'] },
  chicken: { name: 'chicken', kind: 'animal', emoji: '🐔', draws: 'emoji', cycle: ['egg', 'chick', 'hen'] },
  bird: { name: 'bird', kind: 'animal', emoji: '🐦', draws: 'bird', hunts: ['moth', 'beetle', 'grasshopper'] },
  finch: { name: 'finch', kind: 'animal', emoji: '🐦', draws: 'bird', parts: { beak: 'thick' }, hunts: ['beetle', 'grasshopper'] },
  hummingbird: { name: 'hummingbird', kind: 'animal', emoji: '🐦', draws: 'bird', parts: { beak: 'long' } },
  heron: { name: 'heron', kind: 'animal', emoji: '🐦', draws: 'bird', parts: { beak: 'spear' } },
  moth: { name: 'moth', kind: 'animal', emoji: '🦋', draws: 'moth' },
  beetle: { name: 'beetle', kind: 'animal', emoji: '🪲', draws: 'bug' },
  grasshopper: { name: 'grasshopper', kind: 'animal', emoji: '🦗', draws: 'bug' },
  plant_seed: { name: 'seed', kind: 'plant', emoji: '🌰', draws: 'seed' },
  animal_feet: { name: 'animal', kind: 'animal', emoji: '🐾', draws: 'feet' },
  fox: { name: 'fox', kind: 'animal', emoji: '🦊', draws: 'emoji' },
  hawk: { name: 'hawk', kind: 'animal', emoji: '🦅', draws: 'bird', parts: { beak: 'hook' } },
};
export const organism = (subject: string): Organism | undefined => ORGANISMS[subject];
export const ORGANISM_IDS = Object.keys(ORGANISMS);
