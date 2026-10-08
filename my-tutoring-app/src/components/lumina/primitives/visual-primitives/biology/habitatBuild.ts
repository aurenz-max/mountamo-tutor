/**
 * habitat-diorama's open build, `build_habitat` (/add-eval-modes references/build-mode.md): on an empty scene the
 * learner puts in pieces (a pond, flies, a log, rain...) until a named animal has everything it needs to live, then
 * presses "I'm done!". Many habitats pass: any pieces that meet every need, with nothing that would hurt the animal.
 *
 * The needs come from what the diorama already models: food is its feeding relationships (who eats what), water and
 * shelter are its environmental features and zones, and the right weather is its habitat climate. Code owns all of
 * it: the animal, the needs asked, the pieces offered, and the check. The model writes nothing here.
 *
 * Pure: the component, the generator, the journey row and the oracle read the same tables and check.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';

export type HabitatNeed = 'food' | 'water' | 'shelter' | 'weather';
export const ALL_NEEDS: readonly HabitatNeed[] = ['food', 'water', 'shelter', 'weather'];

/** What each need is called to a child. */
export const NEED_WORDS: Record<HabitatNeed, string> = {
  food: 'food', water: 'water', shelter: 'a place to hide and rest', weather: 'the right weather',
};

export interface HabitatPiece {
  id: string;
  name: string;
  emoji: string;
  /** The kind of thing it is, whoever it is for. A piece of the right kind can still be wrong for this animal. */
  kind: HabitatNeed;
}

export const HABITAT_PIECES: readonly HabitatPiece[] = [
  { id: 'pond', name: 'Pond', emoji: '💧', kind: 'water' },
  { id: 'stream', name: 'Stream', emoji: '🏞️', kind: 'water' },
  { id: 'sea', name: 'Salty sea', emoji: '🌊', kind: 'water' },
  { id: 'flies', name: 'Flies', emoji: '🪰', kind: 'food' },
  { id: 'worms', name: 'Worms', emoji: '🪱', kind: 'food' },
  { id: 'clover', name: 'Clover', emoji: '🍀', kind: 'food' },
  { id: 'carrots', name: 'Carrots', emoji: '🥕', kind: 'food' },
  { id: 'nuts', name: 'Nuts', emoji: '🌰', kind: 'food' },
  { id: 'berries', name: 'Berries', emoji: '🫐', kind: 'food' },
  { id: 'fish', name: 'Fish', emoji: '🐟', kind: 'food' },
  { id: 'mice', name: 'Mice', emoji: '🐭', kind: 'food' },
  { id: 'log', name: 'Log', emoji: '🪵', kind: 'shelter' },
  { id: 'rocks', name: 'Rocks', emoji: '🪨', kind: 'shelter' },
  { id: 'tall_grass', name: 'Tall grass', emoji: '🌾', kind: 'shelter' },
  { id: 'burrow', name: 'Burrow', emoji: '🕳️', kind: 'shelter' },
  { id: 'tree', name: 'Tree', emoji: '🌳', kind: 'shelter' },
  { id: 'ice', name: 'Ice', emoji: '🧊', kind: 'shelter' },
  { id: 'sun', name: 'Warm sun', emoji: '☀️', kind: 'weather' },
  { id: 'rain', name: 'Rain', emoji: '🌧️', kind: 'weather' },
  { id: 'snow', name: 'Snow', emoji: '❄️', kind: 'weather' },
];
export const pieceById = (id: string): HabitatPiece | undefined => HABITAT_PIECES.find(p => p.id === id);

export interface HabitatAnimal {
  id: string;
  name: string;
  emoji: string;
  /** Per need, the pieces that meet it for this animal. */
  meets: Record<HabitatNeed, readonly string[]>;
  /** Weather it cannot live in: placing it fails the habitat however good the rest is. */
  harmedBy: readonly string[];
  /**
   * Pieces this animal sometimes uses in nature, so calling them "not for it" would teach something false (a bullfrog
   * eats mice). They are never offered as a wrong choice for it.
   */
  contested: readonly string[];
  /** The earned explanation, said after a pass: what this animal needs, in child words. */
  why: string;
}

/**
 * The animals and what they need. Kept to plain, defensible textbook facts at K-5, and to animals whose wrong choices
 * are clearly wrong (an omnivore such as a bear eats almost every food piece, so it is not here). Frog: fresh water,
 * insects, cover, and warm wet weather (it cannot be active in snow). Penguin: the salty sea is its water, fish its
 * food, ice and rocks its shelter, snow its weather; warm sun is too hot for it.
 */
export const HABITAT_ANIMALS: readonly HabitatAnimal[] = [
  { id: 'frog', name: 'frog', emoji: '🐸', harmedBy: ['snow'], contested: ['fish', 'mice', 'burrow', 'tree'],
    meets: { water: ['pond', 'stream'], food: ['flies', 'worms'], shelter: ['log', 'rocks', 'tall_grass'], weather: ['rain', 'sun'] },
    why: 'A frog needs fresh water, bugs or worms to eat, a log, rocks or grass to hide under, and warm, wet weather.' },
  { id: 'penguin', name: 'penguin', emoji: '🐧', harmedBy: ['sun'], contested: ['burrow', 'tall_grass'],
    meets: { water: ['sea'], food: ['fish'], shelter: ['ice', 'rocks'], weather: ['snow'] },
    why: 'A penguin lives by the salty sea, eats fish, rests on ice or rocks, and needs cold, snowy weather.' },
  { id: 'rabbit', name: 'rabbit', emoji: '🐇', harmedBy: [], contested: ['berries', 'nuts', 'log', 'rocks'],
    meets: { water: ['pond', 'stream'], food: ['clover', 'carrots', 'tall_grass'], shelter: ['burrow', 'tall_grass'], weather: ['sun', 'rain', 'snow'] },
    why: 'A rabbit needs fresh water, plants like clover and grass to eat, and a burrow or tall grass to hide in.' },
  { id: 'squirrel', name: 'squirrel', emoji: '🐿️', harmedBy: [], contested: ['carrots', 'clover', 'worms', 'flies', 'burrow', 'log', 'rocks'],
    meets: { water: ['pond', 'stream'], food: ['nuts', 'berries'], shelter: ['tree'], weather: ['sun', 'rain', 'snow'] },
    why: 'A squirrel needs fresh water, nuts or berries to eat, and a tree to climb and nest in.' },
  { id: 'owl', name: 'owl', emoji: '🦉', harmedBy: [], contested: ['worms', 'flies', 'fish', 'burrow', 'rocks', 'log'],
    meets: { water: ['pond', 'stream'], food: ['mice'], shelter: ['tree'], weather: ['sun', 'rain', 'snow'] },
    why: 'An owl needs fresh water, mice to hunt, and a tree to rest and nest in.' },
  { id: 'deer', name: 'deer', emoji: '🦌', harmedBy: [], contested: ['rocks', 'log'],
    meets: { water: ['pond', 'stream'], food: ['clover', 'tall_grass', 'berries', 'nuts', 'carrots'], shelter: ['tree', 'tall_grass'], weather: ['sun', 'rain', 'snow'] },
    why: 'A deer needs fresh water, plants like grass, clover and berries to eat, and trees or tall grass to hide in.' },
];
export const animalById = (id: string | undefined): HabitatAnimal | undefined => HABITAT_ANIMALS.find(a => a.id === id);

/** K-2 builds food, water and shelter; from grade 3 the right weather (climate) is a need too. */
export const needsForBand = (band: 'K-2' | '3-5' | '6-8'): HabitatNeed[] =>
  band === 'K-2' ? ['food', 'water', 'shelter'] : ['food', 'water', 'shelter', 'weather'];

const article = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a');
const listWords = (words: string[]) => words.length <= 1 ? words.join('')
  : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

/**
 * The ask, written by code. The full ask names the animal and never the needs: knowing what it needs IS the task.
 * The easier ask (the simplify lever) names its two needs.
 */
export function buildAsk(animal: HabitatAnimal, needs: readonly HabitatNeed[], named = false): string {
  const a = `${article(animal.name)} ${animal.name}`;
  return named
    ? `Make a place where ${a} can find ${listWords(needs.map(n => NEED_WORDS[n]))}.`
    : `Build a habitat where ${a} can live. Give it everything it needs.`;
}

// ── The check ───────────────────────────────────────────────────────────────

/**
 * What a wrong habitat shows (`TeachingAttempt.miss`), none naming the need:
 * - `harmful_piece`: a piece that would hurt this animal is in the habitat (weather it cannot live in);
 * - `several_needs_unmet`: two or more of the asked needs are not met;
 * - `other_animals_piece`: one need is not met, but a piece of that kind is there, one that serves other animals
 *   (the salty sea for a frog, carrots for an owl);
 * - `one_need_unmet`: one need is not met and nothing of its kind is there.
 */
export type HabitatBuildMiss = 'harmful_piece' | 'several_needs_unmet' | 'other_animals_piece' | 'one_need_unmet';
export const HABITAT_BUILD_MISSES: readonly HabitatBuildMiss[] = ['harmful_piece', 'several_needs_unmet', 'other_animals_piece', 'one_need_unmet'];

export interface HabitatBuildRead {
  /** Per asked need, whether some placed piece meets it for this animal. */
  met: Partial<Record<HabitatNeed, boolean>>;
  needsMet: number;
  harmful: string[];
  miss?: HabitatBuildMiss;
}

export function readHabitatBuild(animal: HabitatAnimal, needs: readonly HabitatNeed[], placed: readonly string[]): HabitatBuildRead {
  const met: Partial<Record<HabitatNeed, boolean>> = {};
  for (const n of needs) met[n] = placed.some(id => animal.meets[n].includes(id));
  const unmet = needs.filter(n => !met[n]);
  const harmful = Array.from(new Set(placed.filter(id => animal.harmedBy.includes(id))));
  let miss: HabitatBuildMiss | undefined;
  if (harmful.length) miss = 'harmful_piece';
  else if (unmet.length >= 2) miss = 'several_needs_unmet';
  else if (unmet.length === 1) miss = placed.some(id => pieceById(id)?.kind === unmet[0]) ? 'other_animals_piece' : 'one_need_unmet';
  return { met, needsMet: needs.length - unmet.length, harmful, miss };
}

/** What a placed piece gives THIS animal: the need it meets, or that it is not for it (the tag lever). */
export function pieceTag(animal: HabitatAnimal, id: string): string {
  if (animal.harmedBy.includes(id)) return `bad for ${article(animal.name)} ${animal.name}`;
  const need = ALL_NEEDS.find(n => animal.meets[n].includes(id));
  return need ? NEED_WORDS[need] : `not for ${article(animal.name)} ${animal.name}`;
}

// ── The pieces on offer ─────────────────────────────────────────────────────

/** A small seeded shuffle, so a challenge's tray is the same on every mount. */
function seeded(seed: string) {
  let s = 2166136261;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}
function shuffle<T>(xs: readonly T[], seed: string): T[] {
  const rand = seeded(seed), out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/**
 * The tray: per asked need, up to two pieces that meet it and one of the same kind that does not (another animal's
 * food or water, never one it sometimes uses), plus any weather that would hurt the animal; mixed together so the tray
 * never groups by need.
 */
export function trayFor(animal: HabitatAnimal, needs: readonly HabitatNeed[], seed: string): string[] {
  const pick: string[] = [];
  for (const n of needs) {
    pick.push(...shuffle(animal.meets[n], `${seed}:${n}`).slice(0, 2));
    const other = shuffle(HABITAT_PIECES.filter(p => p.kind === n && !animal.meets[n].includes(p.id) && !animal.harmedBy.includes(p.id)
      && !animal.contested.includes(p.id)), `${seed}:${n}:x`)[0];
    if (other) pick.push(other.id);
  }
  if (needs.includes('weather')) pick.push(...animal.harmedBy);
  return shuffle(Array.from(new Set(pick)), `${seed}:tray`);
}

/**
 * Where placed pieces sit, one per spot so none overlap: weather in the sky row, everything else on the ground around
 * the animal, each in the order put in.
 */
export const SKY_SPOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 60, y: 55 }, { x: 150, y: 55 }, { x: 240, y: 55 }, { x: 330, y: 55 }, { x: 420, y: 55 },
];
export const GROUND_SPOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 130, y: 180 }, { x: 350, y: 180 }, { x: 240, y: 270 }, { x: 140, y: 270 }, { x: 340, y: 270 },
  { x: 45, y: 180 }, { x: 435, y: 180 }, { x: 45, y: 270 }, { x: 435, y: 270 },
];
const inSky = (id: string) => pieceById(id)?.kind === 'weather';

/** Each placed piece's spot, in order; null once its row is full. */
export function spotsFor(placed: readonly string[]): Array<{ x: number; y: number } | null> {
  let sky = 0, ground = 0;
  return placed.map(id => (inSky(id) ? SKY_SPOTS[sky++] : GROUND_SPOTS[ground++]) ?? null);
}

/**
 * The scenery note the watcher gets. It says the animal and the backdrop are not the child's, so the line is about the
 * pieces put in (the 10-07 probe, told only "an empty patch of ground", described the animal "sitting alone").
 */
export const habitatSceneNote = (animal: HabitatAnimal): string =>
  `${article(animal.name) === 'an' ? 'An' : 'A'} ${animal.name} in the middle, on brown ground under a dark blue sky. The child `
  + `did not make the ${animal.name}, the ground or the sky; every other thing in the picture, each with its name under it, the child put in.`;

/** Whether the scene has a free spot for this piece. */
export const roomFor = (placed: readonly string[], id: string): boolean =>
  placed.filter(p => inSky(p) === inSky(id)).length < (inSky(id) ? SKY_SPOTS : GROUND_SPOTS).length;

// ── The scene the tutor and the observer are told ───────────────────────────

/** The learner's habitat in words, never the key. */
export function describeHabitatBuild(animal: HabitatAnimal, placed: readonly string[]): string {
  if (!placed.length) return `Nothing in the ${animal.name}'s habitat yet`;
  return `Put in: ${placed.map(id => pieceById(id)?.name ?? id).join(', ')}`;
}

export function habitatBuildScene(animal: HabitatAnimal, needs: readonly HabitatNeed[], tray: readonly string[],
  placed: readonly string[], opts: { preReader: boolean; practice?: boolean }): WorkspaceScene {
  const read = readHabitatBuild(animal, needs, placed);
  return { objects: [], facts: {
    kind: 'build_habitat',
    shown: `An empty patch of ground with ${article(animal.name)} ${animal.name} in the middle. Under it, pieces to put in: `
      + `${tray.map(id => pieceById(id)?.name ?? id).join(', ')}.`,
    // The made habitat as numbers, so the shared work history records a revision (`needsMet 1 → 3 → 2`).
    piecesPlaced: placed.length, needsMet: read.needsMet, harmfulPieces: read.harmful.length,
    learnerWork: describeHabitatBuild(animal, placed),
    constraints: 'The learner taps a piece to put it in the habitat, taps a piece in the habitat to take it out, and presses '
      + '"I\'m done!"; the activity checks the habitat itself. You cannot place pieces for the learner.'
      + (opts.preReader ? ' The learner does not read; the piece names reach them only through you.' : ''),
  } };
}

// ── Levers ──────────────────────────────────────────────────────────────────

export const NEEDS_LIST_LEVER = 'needs_list';
export const PIECE_TAGS_LEVER = 'piece_tags';
export const FEWER_NEEDS_LEVER = 'fewer_needs';
export const FEWER_SUFFIX = '~fewer';
export const isFewerNeeds = (id: string) => id.endsWith(FEWER_SUFFIX);

/** The easier ask: the same animal on an empty scene, two needs, both named. Null on an ask that is already small. */
export const fewerNeeds = (needs: readonly HabitatNeed[]): HabitatNeed[] | null =>
  needs.length > 2 ? ['food', 'water'] : null;

/**
 * The levers on a build item. Knowing the needs IS the task, so the item starts bare and these come on a miss.
 * - `needs_list` (help): beside the scene, the kinds of thing every animal needs; nothing is ticked.
 * - `piece_tags` (help): on each piece the learner put in, what it gives this animal, or that it is not for it.
 * - `fewer_needs` (simplify): an ungraded easier ask for the same animal, two needs named, on an empty scene.
 */
export function habitatBuildLevers(needs: readonly HabitatNeed[] | null, pulled: readonly string[], practice: boolean): WorkspaceLever[] {
  if (!needs || practice) return [];
  const lever = (id: string, kind: WorkspaceLever['kind'], answers: readonly HabitatBuildMiss[], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers, when, does });
  return [
    lever(NEEDS_LIST_LEVER, 'help', ['several_needs_unmet', 'one_need_unmet'],
      'The learner puts in pieces without thinking about what an animal needs to stay alive.',
      'Shows beside the habitat the kinds of thing every animal needs to live. Nothing on it is ticked or crossed off.'),
    lever(PIECE_TAGS_LEVER, 'help', ['other_animals_piece', 'harmful_piece', 'one_need_unmet'],
      'The learner puts in pieces that are for other animals, or one that would hurt this one.',
      'Puts a small tag on each piece the learner put in the habitat: what it gives this animal, or that it is not for it.'),
    ...(fewerNeeds(needs) ? [lever(FEWER_NEEDS_LEVER, 'simplify', ['several_needs_unmet', 'other_animals_piece'],
      'The learner cannot build the whole habitat yet.',
      'Opens an easier ask first: the same animal on an empty habitat, with two of its needs named. It is not graded; the full habitat comes back after it.')] : []),
  ];
}

/** What the pulled help levers put on screen, for the tutor. */
export function habitatBuildLeverFacts(pulled: readonly string[]): string {
  return [
    pulled.includes(NEEDS_LIST_LEVER) && 'Beside the habitat is a list of the kinds of thing every animal needs to live.',
    pulled.includes(PIECE_TAGS_LEVER) && 'Each piece in the habitat has a tag saying what it gives this animal, or that it is not for it.',
  ].filter((s): s is string => !!s).join(' ');
}

/** Words the live line may never use: naming a need, or how the animal feels, would do the task for the learner. */
export const HABITAT_WATCH_NEVER_SAY: readonly string[] = [
  'food', 'water', 'shelter', 'weather', 'need', 'needs', 'eat', 'eats', 'drink', 'drinks', 'hungry', 'thirsty', 'hide',
  'home', 'live', 'lives', 'survive', 'safe', 'cold', 'warm', 'hot', 'freezing', 'happy', 'sad', 'comfy', 'cozy',
];
