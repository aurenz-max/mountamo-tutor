/**
 * net-folder's in-item levers (/add-support-tiers; report qa/eval-reports/net-folder-levers-2026-10-09.md). The misses
 * are what `netFolderMiss` observes in the boxes or the tap; there is no real-learner evidence.
 *
 * - count: `see_through` (help) the hidden edges dashed and the hidden corners ringed; `part_names` (help) a picture
 *   outside the item naming a face, an edge and a vertex; `net_beside` (help) the solid's net opened beside it;
 *   `smaller_solid` (simplify) the same count on a solid with fewer parts.
 * - identify: `base_outline` (help) the base or the two matching ends outlined; `turn_to_base` (help) the solid turned
 *   to face its base; `family_model` (help) a prism and a pyramid outside the item, neither of them the item's solid;
 *   `two_choices` (simplify) another solid, from the other family, between two far-apart names.
 * - match: `fold_guides` (help) dashed hinge lines (where the tier did not draw them); `opposite_rule` (help) a row of
 *   three squares outside the net whose two ends land opposite; `third_label` (help) one more blank square named, never
 *   the yellow one; `easier_net` (simplify) the cross net, the yellow square beside the front.
 * - valid: `fold_guides`; `six_faces_model`, `wrap_model`, `valid_model` (help) pictures outside the item (a cube's six
 *   faces, a row of four squares wrapping round, a different net that folds); `easier_net` (simplify) the cross or a
 *   strip of six, never the item's shape.
 * - surface: `match_list` (help) the net's faces numbered to match the face list; `pair_colors` (help, a box that is
 *   not a cube) matching faces coloured alike; `area_vs_volume` (help) a picture outside the item; `smaller_box`
 *   (simplify) a smaller box.
 *
 * Declared once as a lever set (`NET_LEVERS`, `bossLevers.ts`). The pictures outside the item that draw a rule are
 * `clue`s (leak-checked against the item's answer); the part names and the two families, each named alike, are
 * `legend`s; outlines, dashes, labels and colours on the item are `marks`; the net opened or the solid turned is
 * `layout`. No lever works a different item of the same kind to its answer, so there is no `model` lever.
 *
 * Leak rules (code, `leverTextLeaks` and `practiceLeaks`): no lever word or fact carries a digit; identify's words
 * never name the item's solid; match's never name the yellow square's face; a model net is never the item's shape;
 * a practice item has its own id, the same mode, and never the item's answer.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { NetFolderChallenge, NetFolderSolid } from './NetFolder';
import {
  NET_MISSES_BY_MODE, boxDims, countsOf, matchItem, matchTarget, netFolds, normSolid, solidFamily, solidWords, surfaceTotal,
  validItem,
} from './netFolderWorkspace';
import { CROSS_NET, STRIP_NET, VALID_CUBE_NETS, cellsOf, foldCubeCells, shapeKey, type Cell } from './netFolderGeometry';

export const SEE_THROUGH = 'see_through';
export const PART_NAMES = 'part_names';
export const NET_BESIDE = 'net_beside';
export const SMALLER_SOLID = 'smaller_solid';
export const BASE_OUTLINE = 'base_outline';
export const TURN_TO_BASE = 'turn_to_base';
export const FAMILY_MODEL = 'family_model';
export const TWO_CHOICES = 'two_choices';
export const FOLD_GUIDES = 'fold_guides';
export const OPPOSITE_RULE = 'opposite_rule';
export const THIRD_LABEL = 'third_label';
export const EASIER_NET = 'easier_net';
export const SIX_FACES_MODEL = 'six_faces_model';
export const WRAP_MODEL = 'wrap_model';
export const VALID_MODEL = 'valid_model';
export const MATCH_LIST = 'match_list';
export const PAIR_COLORS = 'pair_colors';
export const AREA_VS_VOLUME = 'area_vs_volume';
export const SMALLER_BOX = 'smaller_box';

const SUFFIX = '~simpler';
export const isPracticeNet = (c: Pick<NetFolderChallenge, 'id'>) => c.id.endsWith(SUFFIX);
export const practiceParent = (id: string) => id.replace(/~simpler$/, '');
export const PRACTICE_NOTE = 'An easier practice item is on screen in place of the item. It is not graded; the full item returns after it.';

const SOLIDS: Record<string, NetFolderSolid> = {
  cube: { type: 'cube', name: 'Cube', dimensions: { length: 80, width: 80, height: 80 }, faces: 6, edges: 12, vertices: 8 },
  rectangular_prism: { type: 'rectangular_prism', name: 'Rectangular Prism', dimensions: { length: 100, width: 60, height: 50 }, faces: 6, edges: 12, vertices: 8 },
  triangular_prism: { type: 'triangular_prism', name: 'Triangular Prism', dimensions: { length: 80, width: 60, height: 70 }, faces: 5, edges: 9, vertices: 6 },
  square_pyramid: { type: 'square_pyramid', name: 'Square Pyramid', dimensions: { length: 80, width: 80, height: 70 }, faces: 5, edges: 8, vertices: 5 },
  triangular_pyramid: { type: 'triangular_pyramid', name: 'Triangular Pyramid', dimensions: { length: 70, width: 70, height: 60 }, faces: 4, edges: 6, vertices: 4 },
};
export const solidOf = (id: string): NetFolderSolid => SOLIDS[normSolid(id)] ?? SOLIDS.cube;

/** The two solids a family model draws: a prism and a pyramid, neither the item's solid. */
export function familyModelSolids(itemSolid: string): [string, string] {
  const s = normSolid(itemSolid);
  return [s === 'triangular_prism' ? 'rectangular_prism' : 'triangular_prism', s === 'square_pyramid' ? 'triangular_pyramid' : 'square_pyramid'];
}

/** A cube net that folds, of a different shape from `cells`, for the valid_model picture. */
export function validModelNet(cells: readonly Cell[] | undefined): Cell[] {
  const key = cells ? shapeKey(cells) : '';
  return VALID_CUBE_NETS.map(cellsOf).find(n => shapeKey(n) !== key)!;
}

/** On a match item: one more blank square to name (never the yellow one), preferring a square beside it. */
export function thirdLabelCell(c: NetFolderChallenge): number | null {
  if (!c.netCells || typeof c.highlightCell !== 'number') return null;
  const fold = foldCubeCells(c.netCells as Cell[], c.anchorCells?.[0] ?? 0), target = matchTarget(c);
  const taken = new Set([...(c.anchorCells ?? []), c.highlightCell]);
  const [hr, hc] = c.netCells[c.highlightCell];
  const free = c.netCells.map((_, i) => i).filter(i => !taken.has(i) && fold.faces[i] !== target);
  const beside = free.filter(i => Math.abs(c.netCells![i][0] - hr) + Math.abs(c.netCells![i][1] - hc) === 1);
  return beside[0] ?? free[0] ?? null;
}

// ── simplify builders ─────────────────────────────────────────────────────

const hash = (s: string) => Array.from(s).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** The easier practice item for `c` in its own mode, or null when there is none simpler. */
export function simplerNet(c: NetFolderChallenge, solid: NetFolderSolid): NetFolderChallenge | null {
  if (isPracticeNet(c)) return null;
  const id = `${c.id}${SUFFIX}`;
  let practice: NetFolderChallenge | null = null;
  switch (c.type) {
    case 'count_faces_edges_vertices': {
      const fewer = normSolid(solid.type) === 'triangular_pyramid' ? null
        : normSolid(solid.type) === 'square_pyramid' || normSolid(solid.type) === 'triangular_prism' ? 'triangular_pyramid' : 'square_pyramid';
      if (!fewer) return null;
      practice = { ...c, id, solid: solidOf(fewer), hint: '',
        instruction: 'Practice first on a smaller solid: count its faces, edges and vertices, then press Check.' };
      break;
    }
    case 'identify_solid': {
      const item = normSolid(String(c.targetAnswer));
      const other = solidFamily(item) === 'pyramid' ? ['cube', 'rectangular_prism'] : ['square_pyramid', 'triangular_pyramid'];
      const shown = other.find(s => s !== item)!;
      const foil = (solidFamily(shown) === 'pyramid' ? ['triangular_prism', 'cube'] : ['triangular_pyramid', 'square_pyramid'])
        .find(s => s !== item)!;
      const options = hash(c.id) % 2 ? [shown, foil] : [foil, shown];
      practice = { ...c, id, solid: solidOf(shown), targetAnswer: shown, options, hint: '',
        instruction: 'Practice first: this is a different solid. Which of the two names is it?' };
      break;
    }
    case 'match_faces': {
      const cells = cellsOf(CROSS_NET), item = matchTarget(c);
      // The cross folds around its middle square; the square above it is the second label.
      const root = cells.findIndex(([r, k]) => r === 1 && k === 1), top = cells.findIndex(([r, k]) => r === 0 && k === 1);
      if (c.netCells && shapeKey(c.netCells as Cell[]) === shapeKey(cells) && typeof c.highlightCell === 'number') {
        const [hr, hc] = c.netCells[c.highlightCell], [rr, rc] = c.netCells[c.anchorCells?.[0] ?? 0];
        if (Math.abs(hr - rr) + Math.abs(hc - rc) === 1) return null;
      }
      const fold = foldCubeCells(cells, root);
      const beside = cells.map((_, i) => i).filter(i => i !== root && i !== top
        && Math.abs(cells[i][0] - 1) + Math.abs(cells[i][1] - 1) === 1 && fold.faces[i] !== item);
      const pick = beside[hash(c.id) % beside.length];
      practice = pick === undefined ? null : matchItem(id, cells, root, top, pick);
      if (practice) practice = { ...practice, instruction: `Practice first on an easier net. ${practice.instruction}` };
      break;
    }
    case 'valid_net': {
      const item = c.netCells ? shapeKey(c.netCells as Cell[]) : '';
      const choices = [CROSS_NET, STRIP_NET].filter(n => shapeKey(cellsOf(n)) !== item);
      const net = choices[hash(c.id) % choices.length];
      practice = { ...validItem(id, cellsOf(net)), instruction: 'Practice first on an easier net. Does this one fold into a cube? '
        + 'Choose Valid net or Invalid net, then press Check.' };
      break;
    }
    case 'surface_area': {
      const total = surfaceTotal(c), dims = boxDims(c.faceDimensions);
      const boxes: Array<[number, number, number]> = [[2, 2, 2], [3, 2, 1], [2, 1, 1]];
      const box = boxes.find(b => 2 * (b[0] * b[1] + b[0] * b[2] + b[1] * b[2]) !== total && b.join() !== dims?.join());
      if (!box) return null;
      const [l, w, h] = box;
      practice = { ...c, id, hint: '', unitLabel: c.unitLabel,
        faceDimensions: [{ width: l, height: w }, { width: l, height: w }, { width: l, height: h }, { width: l, height: h },
          { width: w, height: h }, { width: w, height: h }],
        targetAnswer: 2 * (l * w + l * h + w * h),
        instruction: 'Practice first on a smaller box: add up the areas of all its faces and type the total surface area.' };
      break;
    }
  }
  return practice && !practiceLeaks(c, solid, practice) ? practice : null;
}

/** Leak rule for a practice item: never the learner's item (its id), the same mode, and never the item's answer. */
export function practiceLeaks(parent: NetFolderChallenge, solid: NetFolderSolid, practice: NetFolderChallenge): boolean {
  if (practice.id === parent.id || practice.type !== parent.type) return true;
  switch (parent.type) {
    case 'count_faces_edges_vertices': {
      const a = countsOf(solid), b = countsOf(practice.solid ?? solid);
      return a.faces === b.faces || a.edges === b.edges || a.vertices === b.vertices;
    }
    case 'identify_solid': {
      const item = normSolid(String(parent.targetAnswer));
      return normSolid(String(practice.targetAnswer)) === item || (practice.options ?? []).some(o => normSolid(o) === item);
    }
    case 'match_faces': return matchTarget(practice) === matchTarget(parent);
    case 'valid_net': return !!parent.netCells && !!practice.netCells
      && shapeKey(parent.netCells as Cell[]) === shapeKey(practice.netCells as Cell[]);
    case 'surface_area': return surfaceTotal(practice) === surfaceTotal(parent);
  }
  return true;
}

// ── the lever set ────────────────────────────────────────────────────────

export interface NetLeverContext {
  /** The solid drawn for the session item. */
  solid: NetFolderSolid;
  /** The tier already draws the fold lines (a starting position, not a pull). */
  foldGuidesShown: boolean;
  /** The solid's net is already open beside it because the learner pressed Unfold (not because net_beside was pulled). */
  netShown?: boolean;
}

type Mode = NetFolderChallenge['type'];
const COUNT: Mode[] = ['count_faces_edges_vertices'], IDENTIFY: Mode[] = ['identify_solid'], MATCH: Mode[] = ['match_faces'];
const VALID: Mode[] = ['valid_net'], SURFACE: Mode[] = ['surface_area'];
const UNGRADED = ' It is not graded; the full item returns after it.';
const FOLD_DOES = 'Draws a dashed line on every edge two squares share, where the net folds. No square is named.';
const FOLD_FACT = 'Dashed fold lines mark every edge two squares share.';
const easier = (c: NetFolderChallenge, ctx: NetLeverContext) => simplerNet(c, ctx.solid);
const foldLinesOff = (_c: NetFolderChallenge, ctx: NetLeverContext) => !ctx.foldGuidesShown;
/** The solid an item's own answer is read from: a practice item's own, else the session item's. */
const solidFor = (c: NetFolderChallenge, ctx: NetLeverContext) => c.solid ?? ctx.solid;

/**
 * The levers, declared once (`bossLevers.ts`), in the order a miss reaches for them within a mode. None is offered on
 * a practice item: the component declares nothing while one is on screen.
 */
export const NET_LEVERS = leverSet<NetFolderChallenge, NetLeverContext>({
  modeOf: c => c.type,
  missesOf: mode => NET_MISSES_BY_MODE[mode as Mode] ?? [],
  answersOf: (c, ctx) => itemKeys(c, solidFor(c, ctx)),
  specs: [
    // count
    { id: SEE_THROUGH, type: 'marks', modes: COUNT, answers: ['faces_off', 'edges_off', 'vertices_off', 'several_off'],
      when: 'The learner counts only the parts facing them.',
      does: 'Draws the edges at the back of the solid as dashed lines and rings its hidden corners, so every part can be counted. No number is written.',
      fact: 'The back edges of the solid are dashed and its hidden corners ringed.' },
    { id: PART_NAMES, type: 'legend', modes: COUNT, carrier: 'both', answers: ['swapped_counts', 'several_off'],
      when: 'The learner mixes up faces, edges and vertices.',
      does: 'Shows a picture outside the item: one flat tile with arrows naming a face (a flat side), an edge (where two faces meet) and a vertex (a corner). Read the names aloud; no number is written.',
      fact: 'Beside the solid is a picture outside the item: a flat tile with arrows naming a face, an edge and a vertex.' },
    { id: NET_BESIDE, type: 'layout', modes: COUNT, answers: ['faces_off', 'several_off'],
      when: 'The learner miscounts the faces.', does: 'Opens the solid\'s net beside it: one flat piece for each face. No number is written.',
      // The learner already pressed Unfold: the net is on screen, so there is nothing to open.
      offer: (_c, ctx) => !ctx.netShown,
      fact: 'The solid\'s net is open beside it.' },
    { id: SMALLER_SOLID, type: 'easier', modes: COUNT, answers: 'all',
      when: 'This solid has too many parts to count yet.',
      does: `Opens the same counting task on a solid with fewer faces, edges and vertices.${UNGRADED}`, content: easier },
    // identify
    { id: BASE_OUTLINE, type: 'marks', modes: IDENTIFY, answers: ['prism_pyramid', 'base_shape', 'curved_solid'],
      when: 'The learner cannot tell what kind of solid it is.',
      does: 'Outlines the solid\'s base in gold: a pyramid\'s one base, or a prism\'s two matching ends. Nothing is named.',
      fact: 'The solid\'s base is outlined in gold.' },
    { id: TURN_TO_BASE, type: 'layout', modes: IDENTIFY, answers: ['base_shape'],
      when: 'The learner has the right kind of solid but the wrong base shape.',
      does: 'Turns the solid to face its base straight on, so the shape of the base shows. Nothing is named.',
      fact: 'The solid is turned to face its base.' },
    { id: FAMILY_MODEL, type: 'legend', modes: IDENTIFY, carrier: 'both', answers: ['prism_pyramid', 'curved_solid'],
      when: 'The learner mixes up prisms and pyramids.',
      does: 'Shows a picture outside the item: a prism captioned "two matching ends joined by flat sides" and a pyramid captioned "one base, and its other faces meet at a point". Neither is the solid on screen.',
      fact: 'Beside the solid is a picture outside the item: a prism (two matching ends joined by flat sides) and a pyramid (one base, faces meeting at a point), neither the solid on screen.' },
    { id: TWO_CHOICES, type: 'easier', modes: IDENTIFY, answers: 'all',
      when: 'Too many names to choose from yet.',
      does: `Opens a practice item on a different solid with only two names to choose from, far apart.${UNGRADED}`, content: easier },
    // match
    { id: FOLD_GUIDES, type: 'marks', modes: MATCH, answers: ['adjacent_face', 'opposite_face'],
      when: 'The learner cannot picture where the net bends.', does: FOLD_DOES, offer: foldLinesOff, fact: FOLD_FACT },
    { id: OPPOSITE_RULE, type: 'clue', modes: MATCH, answers: ['opposite_face'],
      when: 'The learner picks the face opposite the one asked for.',
      does: 'Shows a picture outside the net: a straight row of three squares whose two end squares are marked alike, captioned "in a straight row, two squares with one square between them land on opposite faces". It names no face.',
      fact: 'Beside the net is a picture of a row of three squares whose ends land on opposite faces.' },
    { id: THIRD_LABEL, type: 'marks', modes: MATCH, answers: ['adjacent_face', 'opposite_face'],
      when: 'The learner cannot keep track of which way the net turns.',
      does: 'Writes the face name on one more blank square of the net, never the yellow one.',
      content: c => thirdLabelCell(c),
      fact: 'One more blank square of the net is named.' },
    { id: EASIER_NET, type: 'easier', modes: MATCH, answers: 'all',
      when: 'This net is too hard to fold in the mind yet.',
      does: `Opens a practice item on the cross-shaped net with the yellow square just beside the front.${UNGRADED}`, content: easier },
    // valid
    { id: FOLD_GUIDES, type: 'marks', modes: VALID, answers: ['missed_overlap', 'rejected_valid'],
      when: 'The learner cannot picture where the net bends.', does: FOLD_DOES, offer: foldLinesOff, fact: FOLD_FACT },
    { id: SIX_FACES_MODEL, type: 'clue', modes: VALID, answers: ['missed_count'],
      when: 'The learner does not check how many squares a cube needs.',
      does: 'Shows a picture outside the item: a cube beside its faces laid flat, captioned "a cube has six faces, so its net has one square for each face". Read it aloud.',
      fact: 'Beside the net is a picture of a cube and its faces laid flat, one square for each face.' },
    { id: WRAP_MODEL, type: 'clue', modes: VALID, answers: ['missed_overlap'],
      when: 'The learner misses two squares folding onto the same face.',
      does: 'Shows a picture outside the item: a row of four squares wrapping round into a loop, captioned "four squares in a row wrap all the way round; a square that lands where another already is leaves a face open". Read it aloud.',
      fact: 'Beside the net is a picture of a row of four squares wrapping round into a loop.' },
    { id: VALID_MODEL, type: 'clue', modes: VALID, answers: ['rejected_valid'],
      when: 'The learner rejects a net that does fold.',
      does: 'Shows a picture outside the item: a different net that folds into a cube, captioned "each square folds onto its own face". It is never the net on screen.',
      fact: 'Beside the net is a picture of a different net that folds into a cube.' },
    { id: EASIER_NET, type: 'easier', modes: VALID, answers: 'all',
      when: 'This net is too hard to judge yet.',
      does: `Opens a practice item on an easier net whose fold is plain to see.${UNGRADED}`, content: easier },
    // surface
    { id: MATCH_LIST, type: 'layout', modes: SURFACE, answers: ['missed_a_face', 'extra_face', 'half_the_faces', 'one_face', 'other_total'],
      when: 'The learner loses track of which faces they have added.',
      does: 'Opens the box\'s net and writes each face\'s place in the face list on its square, so each face in the list has one square. No area or total is written.',
      fact: 'The box\'s net is open and each square carries its place in the face list.' },
    { id: PAIR_COLORS, type: 'marks', modes: SURFACE, answers: ['half_the_faces', 'missed_a_face'],
      when: 'The learner adds one face of each pair.',
      does: 'Colours the faces that match in the face list and on the net alike, so each face shows with its twin. No number is written.',
      // A cube's six faces are one size: there are no pairs to colour apart.
      content: c => { const d = boxDims(c.faceDimensions); return d && !(d[0] === d[1] && d[1] === d[2]) ? d : null; },
      fact: 'Matching faces are coloured alike in the face list and on the net.' },
    { id: AREA_VS_VOLUME, type: 'clue', modes: SURFACE, answers: ['volume'],
      when: 'The learner multiplies length, width and height.',
      does: 'Shows a picture outside the item: a box wrapped in paper captioned "surface area covers the outside: add the area of every face", beside a box filled with cubes captioned "volume fills the inside". Read it aloud.',
      fact: 'Beside the box is a picture: a box wrapped in paper (surface area) and a box filled with cubes (volume).' },
    { id: SMALLER_BOX, type: 'easier', modes: SURFACE, answers: 'all',
      when: 'The numbers are too big to add yet.',
      does: `Opens the same task on a smaller box.${UNGRADED}`, content: easier },
  ],
});

/**
 * Leak rule for lever words, captions and facts on item `c`: no digit (every count, area and total is a number), and
 * on identify not the item's solid, on match not the yellow square's face.
 */
export function leverTextLeaks(c: NetFolderChallenge, text: string): boolean {
  if (/\d/.test(text)) return true;
  const has = (words: string) => new RegExp(`(?<![a-z])${words}(?![a-z])`, 'i').test(text);
  if (c.type === 'identify_solid') return has(solidWords(String(c.targetAnswer)));
  if (c.type === 'match_faces') return has(matchTarget(c));
  // valid_net: a verdict word in a caption reads as the item's verdict.
  if (c.type === 'valid_net') return has('valid') || has('invalid');
  return false;
}

/** The item's own answer, as words, for the tests' leak checks. */
export function itemKeys(c: NetFolderChallenge, solid: NetFolderSolid): string[] {
  switch (c.type) {
    case 'count_faces_edges_vertices': { const n = countsOf(solid); return [String(n.faces), String(n.edges), String(n.vertices)]; }
    case 'identify_solid': return [solidWords(String(c.targetAnswer))];
    case 'match_faces': return [matchTarget(c)];
    case 'valid_net': return [netFolds(c) ? 'valid' : 'invalid'];
    case 'surface_area': return [String(surfaceTotal(c))];
  }
  return [];
}
