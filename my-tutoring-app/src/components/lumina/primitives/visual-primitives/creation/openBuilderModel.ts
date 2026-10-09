/**
 * Open builder: the child builds freely from an unlimited supply of plain blocks to meet an open goal
 * set in a scene (a river to cross, a giraffe to match, a puppy who needs a house). Gemini vision reads a
 * picture of the board, the same picture the child sees, and says whether the build does what the goal
 * asks. Pure, so the component, the generator, the server judge and tests share it.
 *
 * Code owns the physics and the scenery and nothing else. Every block drops down its columns until it
 * rests on the ground (the scene's terrain) or on a block below any of its cells. A triangle is a cap:
 * nothing stacks on it. Whether a build meets the goal is the judge's call, never a rule here.
 */

export type BlockKind = 'small' | 'plank' | 'long' | 'tall' | 'big' | 'triangle' | 'wheel';

export interface BlockSpec {
  name: string;
  /** Cells wide and tall. */
  w: number;
  h: number;
  /** Nothing can sit on top of it. */
  cap?: boolean;
}

export const BLOCKS: Record<BlockKind, BlockSpec> = {
  small: { name: 'Small block', w: 1, h: 1 },
  plank: { name: 'Plank', w: 2, h: 1 },
  long: { name: 'Long block', w: 3, h: 1 },
  tall: { name: 'Tall block', w: 1, h: 2 },
  big: { name: 'Big block', w: 2, h: 2 },
  triangle: { name: 'Triangle', w: 2, h: 1, cap: true },
  wheel: { name: 'Wheel', w: 1, h: 1 },
};
export const BLOCK_KINDS = Object.keys(BLOCKS) as BlockKind[];

export type BlockColor = 'coral' | 'blue' | 'yellow' | 'mint' | 'purple';
export const BLOCK_COLORS: Record<BlockColor, { fill: string; edge: string }> = {
  coral: { fill: '#e8907f', edge: '#c76c5b' },
  blue: { fill: '#84b2cc', edge: '#5f8fab' },
  yellow: { fill: '#eac56f', edge: '#c9a24c' },
  mint: { fill: '#8dbb98', edge: '#6a9876' },
  purple: { fill: '#b39ad6', edge: '#8f76b4' },
};
export const COLOR_NAMES = Object.keys(BLOCK_COLORS) as BlockColor[];

export const COLS = 12;
export const ROWS = 9;

/** Scenery the child builds for. Props are drawn, never physical; terrain is physical. */
export interface SceneProp {
  emoji: string;
  /** Left column and bottom row (0-based) of the box the prop is drawn in, and its size in cells. */
  col: number;
  row: number;
  size: number;
  label: string;
  /** Mirror it, so an animal faces the build. */
  flip?: boolean;
}

export type MenuSceneId = 'bridge' | 'giraffe' | 'puppy-house' | 'cliff-steps' | 'castle' | 'rocket' | 'robot' | 'truck' | 'sheep-wall';
/** Smaller jobs a simplify lever opens as an ungraded practice project (`openBuilderLevers.ts`); never on the menu. */
export type PracticeSceneId = 'stream' | 'pony' | 'ledge' | 'kitten-shade' | 'queen-tower' | 'little-rocket' | 'little-robot' | 'duck-wall';
export type SceneId = MenuSceneId | PracticeSceneId;

export interface BuilderScene {
  id: SceneId;
  title: string;
  /** The default goal a 5-7 year old hears. A generator may reword it but keeps its job. */
  goal: string;
  /** What the scenery is, in words, for the judge (it also sees the picture). */
  sceneNote: string;
  /** Ground height in rows for each column; omitted columns are 0. */
  terrain?: number[];
  /** Columns that hold water (drawn below the banks). */
  water?: [number, number];
  props: SceneProp[];
  sky?: 'day' | 'night';
}

/** Raised ground on both sides of a gap. */
const banks = (gapFrom: number, gapTo: number, h: number) =>
  Array.from({ length: COLS }, (_, c) => (c < gapFrom || c > gapTo ? h : 0));

const MENU_SCENES: Record<MenuSceneId, BuilderScene> = {
  bridge: {
    id: 'bridge', title: 'Over the River',
    goal: 'The car needs to get across the river. Build a bridge from one side to the other!',
    sceneNote: 'Two grassy banks with a river between them. A car waits on the left bank.',
    terrain: banks(4, 7, 2), water: [4, 7],
    props: [{ emoji: '🚗', col: 0, row: 2, size: 2, label: 'a car', flip: true }],
  },
  giraffe: {
    id: 'giraffe', title: 'As Tall as the Giraffe',
    goal: 'Build a tower as tall as the giraffe!',
    sceneNote: 'A tall giraffe stands on the right. Its head is about 6 rows up.',
    props: [{ emoji: '🦒', col: 8, row: 0, size: 6, label: 'a giraffe' }],
  },
  'puppy-house': {
    id: 'puppy-house', title: 'A House for Puppy',
    goal: 'Puppy needs to stay dry when it rains. Build a house over Puppy with walls and a roof!',
    sceneNote: 'A small puppy sits on the ground in the middle, with room to build on both sides of it. A rain cloud is in the sky.',
    props: [{ emoji: '🐶', col: 5, row: 0, size: 1, label: 'a puppy' },
      { emoji: '🌧️', col: 8, row: 7, size: 2, label: 'a rain cloud' }],
  },
  'cliff-steps': {
    id: 'cliff-steps', title: 'Up to the Kitten',
    goal: 'The kitten is stuck up high! Build steps so the bunny can hop all the way up.',
    sceneNote: 'A tall cliff on the right, 5 rows high, with a kitten on top. A bunny sits on the ground at the left.',
    terrain: Array.from({ length: COLS }, (_, c) => (c >= 9 ? 5 : 0)),
    props: [{ emoji: '🐱', col: 10, row: 5, size: 2, label: 'a kitten' },
      { emoji: '🐰', col: 0, row: 0, size: 2, label: 'a bunny', flip: true }],
  },
  castle: {
    id: 'castle', title: 'A Castle for the King',
    goal: 'Build a castle for the king with two tall towers and a wall between them.',
    sceneNote: 'A king stands on the ground at the right edge, next to the building space.',
    props: [{ emoji: '🤴', col: 10, row: 0, size: 2, label: 'a king' }],
  },
  rocket: {
    id: 'rocket', title: 'Blast Off!',
    goal: 'Build a rocket ship that could fly to the moon. Make it tall and pointy on top!',
    sceneNote: 'Night sky with stars and a moon in the top right corner.',
    sky: 'night',
    props: [{ emoji: '🌙', col: 10, row: 7, size: 2, label: 'the moon' },
      { emoji: '⭐', col: 1, row: 7, size: 1, label: 'a star' }],
  },
  robot: {
    id: 'robot', title: 'Robot Friend',
    goal: 'Build a robot friend with a head, a body, two arms and two legs.',
    sceneNote: 'An empty building space with a little battery on the ground at the right.',
    props: [{ emoji: '🔋', col: 11, row: 0, size: 1, label: 'a battery' }],
  },
  truck: {
    id: 'truck', title: 'The Apple Truck',
    goal: 'The farmer needs a truck to carry apples. Build a truck with wheels!',
    sceneNote: 'An apple tree on the left and a farmer beside it.',
    props: [{ emoji: '🌳', col: 0, row: 0, size: 3, label: 'an apple tree' },
      { emoji: '🧑‍🌾', col: 3, row: 0, size: 2, label: 'a farmer', flip: true }],
  },
  'sheep-wall': {
    id: 'sheep-wall', title: 'Save the Flowers',
    goal: 'The sheep want to eat the flowers! Build a wall so the sheep cannot get to them.',
    sceneNote: 'Two sheep stand on the left side. Flowers grow on the right side.',
    props: [{ emoji: '🐑', col: 0, row: 0, size: 2, label: 'a sheep', flip: true },
      { emoji: '🐑', col: 2, row: 0, size: 1, label: 'a lamb', flip: true },
      { emoji: '🌷', col: 9, row: 0, size: 1, label: 'a tulip' }, { emoji: '🌻', col: 10, row: 0, size: 1, label: 'a sunflower' },
      { emoji: '🌼', col: 11, row: 0, size: 1, label: 'a daisy' }],
  },
};

/** Each a smaller job than one menu scene (`SIMPLER_SCENE` in `openBuilderLevers.ts`), with its own scenery. */
const PRACTICE_SCENES: Record<PracticeSceneId, BuilderScene> = {
  stream: {
    id: 'stream', title: 'Over the Stream',
    goal: 'The bike needs to get over the little stream. Build a bridge from one side to the other!',
    sceneNote: 'Two low grassy banks with a narrow stream between them. A bike waits on the left bank.',
    terrain: banks(5, 6, 1), water: [5, 6],
    props: [{ emoji: '🚲', col: 0, row: 1, size: 2, label: 'a bike', flip: true }],
  },
  pony: {
    id: 'pony', title: 'As Tall as the Pony',
    goal: 'Build a tower as tall as the pony!',
    sceneNote: 'A small pony stands on the right. Its head is about 3 rows up.',
    props: [{ emoji: '🐴', col: 8, row: 0, size: 3, label: 'a pony' }],
  },
  ledge: {
    id: 'ledge', title: 'Up to the Chick',
    goal: 'The chick is up on a low ledge! Build steps so the bunny can hop up to it.',
    sceneNote: 'A low ledge on the right, 2 rows high, with a chick on top. A bunny sits on the ground at the left.',
    terrain: Array.from({ length: COLS }, (_, c) => (c >= 9 ? 2 : 0)),
    props: [{ emoji: '🐥', col: 10, row: 2, size: 1, label: 'a chick' },
      { emoji: '🐰', col: 0, row: 0, size: 2, label: 'a bunny', flip: true }],
  },
  'kitten-shade': {
    id: 'kitten-shade', title: 'Shade for Kitten',
    goal: 'The kitten is too hot in the sun. Build a roof over the kitten to make some shade!',
    sceneNote: 'A small kitten sits on the ground in the middle, with room to build on both sides of it. A hot sun is in the sky.',
    props: [{ emoji: '🐱', col: 5, row: 0, size: 1, label: 'a kitten' },
      { emoji: '☀️', col: 9, row: 7, size: 2, label: 'the sun' }],
  },
  'queen-tower': {
    id: 'queen-tower', title: 'A Tower for the Queen',
    goal: 'Build one tall tower for the queen!',
    sceneNote: 'A queen stands on the ground at the right edge, next to the building space.',
    props: [{ emoji: '👸', col: 10, row: 0, size: 2, label: 'a queen' }],
  },
  'little-rocket': {
    id: 'little-rocket', title: 'A Little Rocket',
    goal: 'Build a little rocket with a pointy top!',
    sceneNote: 'Night sky with stars and a ringed planet in the top right corner.',
    sky: 'night',
    props: [{ emoji: '🪐', col: 9, row: 7, size: 2, label: 'a planet' }],
  },
  'little-robot': {
    id: 'little-robot', title: 'A Little Robot',
    goal: 'Build a little robot with a head and a body.',
    sceneNote: 'An empty building space with a wrench on the ground at the right.',
    props: [{ emoji: '🔧', col: 11, row: 0, size: 1, label: 'a wrench' }],
  },
  'duck-wall': {
    id: 'duck-wall', title: 'Save the Bread',
    goal: 'The duck wants to eat the bread! Build a wall so the duck cannot get to it.',
    sceneNote: 'A small duck stands on the left side. A loaf of bread sits on the right side.',
    props: [{ emoji: '🦆', col: 0, row: 0, size: 1, label: 'a duck', flip: true },
      { emoji: '🍞', col: 10, row: 0, size: 1, label: 'some bread' }],
  },
};

export const SCENES: Record<SceneId, BuilderScene> = { ...MENU_SCENES, ...PRACTICE_SCENES };
/** The scenes a generator, the tester and the presets choose from. Practice scenes are opened only by a lever. */
export const SCENE_IDS = Object.keys(MENU_SCENES) as MenuSceneId[];
export const isPracticeScene = (id: SceneId): id is PracticeSceneId => Object.prototype.hasOwnProperty.call(PRACTICE_SCENES, id);

export const groundAt = (scene: BuilderScene, col: number) => scene.terrain?.[col] ?? 0;

export type OpenBuilderTask = 'build_to_goal';

export interface OpenBuilderChallenge {
  id: string;
  type: OpenBuilderTask;
  /** Which scenery the board shows. */
  sceneId: SceneId;
  /** Short project name. */
  title: string;
  /** What the child sees and hears. */
  goal: string;
  /** config.difficulty: easy starts with the item's help levers shown (`openBuilderLevers.ts`). Never changes the goal. */
  supportTier?: 'easy' | 'medium' | 'hard';
}

/** Projects straight from the scenes' own goals: the tester's presets, and the generator's fallback. */
export function presetProjects(ids: readonly SceneId[] = SCENE_IDS): OpenBuilderChallenge[] {
  return ids.map((id, i) => ({ id: `ob-${i + 1}`, type: 'build_to_goal', sceneId: id, title: SCENES[id].title, goal: SCENES[id].goal }));
}

/** A block on the board. `col`/`row` are 0-based, row 0 at the bottom of the board. */
export interface Placed {
  id: string;
  step: number;
  kind: BlockKind;
  color: BlockColor;
  col: number;
  row: number;
}

export type OpenBuilderMiss = 'missing_part' | 'does_not_work';
export const OPEN_BUILDER_MISSES: readonly OpenBuilderMiss[] = ['missing_part', 'does_not_work'];

/** The judge's reading of one picture of the build. */
export interface OpenBuilderVerdict {
  met: boolean;
  miss?: OpenBuilderMiss;
  /** One sentence naming something the child actually built, as it looks. */
  noticed: string;
  /** When not met: one question pointing at a part of the build, never the fix. Empty when met. */
  nudge: string;
}

// ── Physics ─────────────────────────────────────────────────────────────────

/** cell "col,row" → id of the block occupying it. */
export function occupancy(placed: Placed[]): Map<string, string> {
  const cells = new Map<string, string>();
  for (const p of placed) {
    const s = BLOCKS[p.kind];
    for (let dx = 0; dx < s.w; dx++) for (let dy = 0; dy < s.h; dy++) cells.set(`${p.col + dx},${p.row + dy}`, p.id);
  }
  return cells;
}

export type DropResult = { row: number } | { error: string };

/** Where a block with its left edge at `col` lands, or why it cannot go there. */
export function dropRow(scene: BuilderScene, placed: Placed[], kind: BlockKind, col: number): DropResult {
  const s = BLOCKS[kind];
  if (col < 0 || col + s.w > COLS) return { error: `The ${s.name.toLowerCase()} does not fit there.` };
  const cells = occupancy(placed);
  const byId = new Map(placed.map(p => [p.id, p]));
  let row = 0;
  for (let c = col; c < col + s.w; c++) {
    let top = groundAt(scene, c);
    for (let r = ROWS - 1; r >= top; r--) {
      const id = cells.get(`${c},${r}`);
      if (!id) continue;
      if (BLOCKS[byId.get(id)!.kind].cap) return { error: 'Nothing can sit on top of a triangle.' };
      top = r + 1;
      break;
    }
    row = Math.max(row, top);
  }
  if (row + s.h > ROWS) return { error: 'That would stack higher than the sky!' };
  return { row };
}

export function placeBlock(scene: BuilderScene, placed: Placed[], kind: BlockKind, color: BlockColor, col: number): Placed[] | { error: string } {
  const at = dropRow(scene, placed, kind, col);
  if ('error' in at) return at;
  const n = placed.filter(p => p.kind === kind).length + 1;
  return [...placed, { id: `${kind}-${n}`, step: placed.length + 1, kind, color, col, row: at.row }];
}

// ── What the tutor reads ────────────────────────────────────────────────────

/** "8 blocks: 3 long, 2 tall, 1 triangle; the top is 6 rows above the ground." The learner's own work, in words. */
export function describeBuild(scene: BuilderScene, placed: Placed[]): string {
  if (!placed.length) return 'Nothing built yet';
  const counts = new Map<BlockKind, number>();
  for (const p of placed) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  const parts = Array.from(counts, ([k, n]) => `${n} ${BLOCKS[k].name.toLowerCase()}${n > 1 ? 's' : ''}`);
  const top = Math.max(...placed.map(p => p.row + BLOCKS[p.kind].h));
  const from = Math.min(...placed.map(p => p.col)), to = Math.max(...placed.map(p => p.col + BLOCKS[p.kind].w));
  return `${placed.length} block${placed.length > 1 ? 's' : ''} (${parts.join(', ')}); the build reaches ${top} rows up from the bottom `
    + `and spans columns ${from + 1} to ${to} of ${COLS}${scene.water ? `; the river is columns ${scene.water[0] + 1} to ${scene.water[1] + 1}` : ''}`;
}
