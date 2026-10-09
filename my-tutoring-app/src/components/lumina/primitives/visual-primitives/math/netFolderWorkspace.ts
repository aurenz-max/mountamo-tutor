/**
 * Net folder on the shared tutor/JEV teaching workspace, W1 minimal binding, plain shape (ROLLOUT C18).
 *
 * Pure: the component, the adapter and any probe read the same assignment, scene and check. Every mode is a gesture
 * item checked by the activity's own Check: counts typed into three boxes, a solid or a face tapped, valid or invalid
 * tapped, a surface area typed. The tutor is never handed the counts, the solid's name on an identify item, the face
 * the yellow square folds to, the verdict on a net, or the total.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { NetFolderChallenge, NetFolderSolid } from './NetFolder';
import { foldCubeCells, oppositeFace, solidCounts, solidModel, type Cell } from './netFolderGeometry';

export type NetFolderMode = NetFolderChallenge['type'];

/** `rectangular_prism`, `Rectangular Prism`, `rectangular-prism` → `rectangular_prism`. */
export const normSolid = (s: string) => s.trim().toLowerCase().replace(/[\s-]+/g, '_');
/** The words a learner reads for a solid id. */
export const solidWords = (s: string) => normSolid(s).replace(/_/g, ' ');

const FRIENDLY: Record<string, string> = {
  cube: 'Cube', rectangular_prism: 'Rectangular Prism', triangular_prism: 'Triangular Prism',
  square_pyramid: 'Square Pyramid', triangular_pyramid: 'Triangular Pyramid',
};

/** A box's length, width and height from its six faces, or null when the faces are not a box's three pairs. */
export function boxDims(faces: ReadonlyArray<{ width: number; height: number }> | undefined): [number, number, number] | null {
  if (!faces || faces.length !== 6) return null;
  const want = faces.map(f => [Math.min(f.width, f.height), Math.max(f.width, f.height)].join('x')).sort().join(',');
  const values = Array.from(new Set(faces.flatMap(f => [f.width, f.height])));
  for (const l of values) for (const w of values) for (const h of values) {
    const got = [[l, w], [l, w], [l, h], [l, h], [w, h], [w, h]].map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join('x')).sort().join(',');
    if (got === want && l >= w && w >= h) return [l, w, h];
  }
  return null;
}

/** The solid drawn for this item: its own (a practice item), a surface-area item's box, else the session's. */
export function itemSolid(session: NetFolderSolid, ch: NetFolderChallenge | null): NetFolderSolid {
  if (ch?.solid) return ch.solid;
  if (ch?.type === 'surface_area') {
    const dims = boxDims(ch.faceDimensions);
    if (dims) {
      const [l, w, h] = dims, cube = l === w && w === h;
      return { type: cube ? 'cube' : 'rectangular_prism', name: cube ? 'Cube' : 'Rectangular Prism',
        dimensions: { length: l, width: w, height: h }, faces: 6, edges: 12, vertices: 8 };
    }
  }
  return session;
}

/** Counts from the drawn solid's geometry, not the stored fields. */
export const countsOf = (solid: NetFolderSolid) => solidCounts(solidModel(solid));

/** The cell a match/valid net folds around: the first anchor, else the first cell. */
const rootOf = (ch: NetFolderChallenge) => ch.anchorCells?.[0] ?? 0;

/** The face the yellow square folds to (match_faces): from the fold of the drawn net, else the stored answer. */
export function matchTarget(ch: NetFolderChallenge): string {
  if (ch.netCells?.length && typeof ch.highlightCell === 'number')
    return foldCubeCells(ch.netCells as Cell[], rootOf(ch)).faces[ch.highlightCell] ?? '';
  return String(ch.targetAnswer).toLowerCase();
}

/** Whether the drawn net folds into a cube (valid_net): from the fold, else the stored verdict. */
export function netFolds(ch: NetFolderChallenge): boolean {
  if (ch.netCells?.length) return foldCubeCells(ch.netCells as Cell[]).valid;
  return !!ch.isValidNet;
}

export const surfaceTotal = (ch: NetFolderChallenge) => (ch.faceDimensions ?? []).reduce((s, f) => s + f.width * f.height, 0);

/** The learner's work on the current item. */
export interface NetWork {
  /** The option tapped: a solid id, a face name, or `valid` / `invalid`. */
  selected: string | null;
  /** The surface area typed. */
  total: string;
  faces: string;
  edges: string;
  vertices: string;
}

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** The activity's own check of the current item. */
export function netCorrect(ch: NetFolderChallenge, solid: NetFolderSolid, work: NetWork): boolean {
  switch (ch.type) {
    case 'identify_solid': return !!work.selected && normSolid(work.selected) === normSolid(String(ch.targetAnswer));
    case 'match_faces': return !!work.selected && work.selected.toLowerCase() === matchTarget(ch);
    case 'valid_net': return work.selected !== null && (work.selected === 'valid') === netFolds(ch);
    case 'surface_area': return num(work.total) === surfaceTotal(ch);
    case 'count_faces_edges_vertices': {
      const c = countsOf(solid);
      return num(work.faces) === c.faces && num(work.edges) === c.edges && num(work.vertices) === c.vertices;
    }
  }
  return false;
}

/** The learner's work in their terms, never the key. */
export function describeNetWork(ch: NetFolderChallenge, work: NetWork): string {
  const typed = (s: string) => (s.trim() === '' ? 'nothing' : s.trim());
  switch (ch.type) {
    case 'identify_solid': return work.selected ? `chose ${solidWords(work.selected)}` : 'no solid chosen yet';
    case 'match_faces': return work.selected ? `chose ${work.selected}` : 'no face chosen yet';
    case 'valid_net': return work.selected ? `said the net is ${work.selected}` : 'no answer chosen yet';
    case 'surface_area': return `typed ${typed(work.total)} for the total surface area`;
    case 'count_faces_edges_vertices':
      return `typed faces ${typed(work.faces)}, edges ${typed(work.edges)}, vertices ${typed(work.vertices)}`;
  }
  return 'nothing yet';
}

/**
 * What a wrong check shows (`TeachingAttempt.miss`, handoff 20), from the item and what was typed or tapped, drawn
 * from the catalog's commonStruggles (faces and edges confused, net faces not matched to the solid, surface area
 * miscounted, an invalid net taken as valid):
 * - count: `swapped_counts` two counts in each other's boxes; `faces_off` / `edges_off` / `vertices_off` one count
 *   wrong; `several_off` more than one;
 * - identify: `prism_pyramid` a prism taken for a pyramid or back; `base_shape` the right family, the wrong base;
 *   `curved_solid` a solid with a curved surface;
 * - match: `opposite_face` the face opposite the right one; `adjacent_face` a face beside it;
 * - valid: `missed_overlap` valid said of six squares two of which land on one face; `missed_count` valid said of a net
 *   that is not six squares; `rejected_valid` invalid said of a net that folds;
 * - surface: `half_the_faces` one face of each pair; `missed_a_face` a face left out; `extra_face` a face counted
 *   twice; `one_face` one face's area; `volume` length times width times height; `other_total` anything else.
 */
export type NetFolderMiss = 'swapped_counts' | 'faces_off' | 'edges_off' | 'vertices_off' | 'several_off'
  | 'prism_pyramid' | 'base_shape' | 'curved_solid'
  | 'opposite_face' | 'adjacent_face'
  | 'missed_overlap' | 'missed_count' | 'rejected_valid'
  | 'half_the_faces' | 'missed_a_face' | 'extra_face' | 'one_face' | 'volume' | 'other_total';

export const NET_MISSES_BY_MODE: Record<NetFolderMode, readonly NetFolderMiss[]> = {
  count_faces_edges_vertices: ['swapped_counts', 'faces_off', 'edges_off', 'vertices_off', 'several_off'],
  identify_solid: ['prism_pyramid', 'base_shape', 'curved_solid'],
  match_faces: ['opposite_face', 'adjacent_face'],
  valid_net: ['missed_overlap', 'missed_count', 'rejected_valid'],
  surface_area: ['half_the_faces', 'missed_a_face', 'extra_face', 'one_face', 'volume', 'other_total'],
};

export const solidFamily = (id: string): 'prism' | 'pyramid' | 'curved' => {
  const s = normSolid(id);
  if (s === 'cube' || s.endsWith('prism')) return 'prism';
  if (s.endsWith('pyramid')) return 'pyramid';
  return 'curved';
};

export function netFolderMiss(ch: NetFolderChallenge, solid: NetFolderSolid, work: NetWork): NetFolderMiss | undefined {
  if (netCorrect(ch, solid, work)) return undefined;
  switch (ch.type) {
    case 'count_faces_edges_vertices': {
      const c = countsOf(solid), f = num(work.faces), e = num(work.edges), v = num(work.vertices);
      // Two boxes hold each other's counts (and the counts differ, or there is nothing swapped: a pyramid's F = V).
      const swapped = (a: number, b: number, ta: number, tb: number) => ta !== tb && a === tb && b === ta;
      if (swapped(f, e, c.faces, c.edges) || swapped(e, v, c.edges, c.vertices) || swapped(f, v, c.faces, c.vertices)) return 'swapped_counts';
      const off = [f !== c.faces && 'faces_off', e !== c.edges && 'edges_off', v !== c.vertices && 'vertices_off']
        .filter((m): m is NetFolderMiss => !!m);
      return off.length === 1 ? off[0] : 'several_off';
    }
    case 'identify_solid': {
      const chosen = solidFamily(work.selected ?? ''), target = solidFamily(String(ch.targetAnswer));
      if (chosen === 'curved') return 'curved_solid';
      return chosen === target ? 'base_shape' : 'prism_pyramid';
    }
    case 'match_faces': return (work.selected ?? '').toLowerCase() === oppositeFace(matchTarget(ch)) ? 'opposite_face' : 'adjacent_face';
    case 'valid_net': {
      if (work.selected !== 'valid') return 'rejected_valid';
      return ch.netCells?.length && ch.netCells.length !== 6 ? 'missed_count' : 'missed_overlap';
    }
    case 'surface_area': {
      const t = num(work.total), faces = (ch.faceDimensions ?? []).map(f => f.width * f.height), total = surfaceTotal(ch);
      const dims = boxDims(ch.faceDimensions);
      if (t * 2 === total) return 'half_the_faces';
      if (faces.some(a => total - a === t)) return 'missed_a_face';
      if (faces.some(a => total + a === t)) return 'extra_face';
      if (faces.includes(t)) return 'one_face';
      if (dims && t === dims[0] * dims[1] * dims[2]) return 'volume';
      return 'other_total';
    }
  }
  return undefined;
}

export function workspaceAssignment(ch: NetFolderChallenge): TeachingAssignment {
  return { id: ch.id, task: ch.instruction, response: 'gesture' };
}

export interface NetFolderView extends NetWork {
  /** The solid drawn for this item. */
  solid: NetFolderSolid;
  /** The net is on screen (not folded up). */
  netShown: boolean;
  showLabels: boolean;
  foldGuides: boolean;
}

const MODE_WORDS: Record<NetFolderMode, string> = {
  count_faces_edges_vertices: 'count the faces, edges and vertices',
  identify_solid: 'name the solid',
  match_faces: 'which face of the cube a square of the net becomes',
  valid_net: 'whether a net folds into a cube',
  surface_area: 'surface area from the faces',
};

/** What is drawn and asked. Never a count, the identify item's solid, the yellow square's face, the verdict, the total. */
export function workspaceScene(ch: NetFolderChallenge, view: NetFolderView): WorkspaceScene {
  const facts: Record<string, string> = { kind: MODE_WORDS[ch.type] ?? ch.type, ask: ch.instruction };
  const solidName = view.solid.name || FRIENDLY[view.solid.type] || solidWords(view.solid.type);
  facts.solid = ch.type === 'identify_solid'
    ? 'a solid drawn in 3D, turned so some faces face the learner; naming it is the question'
    : `a ${solidName.toLowerCase()} drawn in 3D, turned so some faces face the learner${view.showLabels ? ', each face that shows named on it' : ''}`;
  switch (ch.type) {
    case 'match_faces': {
      const labelled = (ch.anchorCells ?? []).map(i => ch.netCells ? foldCubeCells(ch.netCells as Cell[], rootOf(ch)).faces[i] : null)
        .filter((f): f is NonNullable<typeof f> => !!f);
      facts.net = `a cube net of six squares; ${labelled.length ? `the squares named ${labelled.join(' and ')} are labelled; ` : ''}`
        + 'one other square is yellow with a question mark, and the rest are blank';
      facts.options = (ch.faceOptions ?? []).join(', ');
      break;
    }
    case 'valid_net':
      facts.net = 'a net of squares joined edge to edge, to be folded into a cube; no square is labelled';
      break;
    case 'identify_solid':
      facts.options = (ch.options ?? []).map(solidWords).join(', ');
      facts.net = view.netShown ? 'the solid\'s net is shown beside it' : 'the learner can press Unfold to see the solid\'s net';
      break;
    case 'surface_area':
      facts.faceList = (ch.faceDimensions ?? []).map((f, i) => `Face ${i + 1}: ${f.width} × ${f.height} = ${f.width * f.height}`).join('; ');
      facts.unit = ch.unitLabel || 'square units';
      facts.net = view.netShown ? 'the box\'s net is shown beside it' : 'the learner can press Unfold to see the box\'s net';
      break;
    case 'count_faces_edges_vertices':
      facts.boxes = 'three boxes: Faces, Edges, Vertices';
      facts.net = view.netShown ? 'the solid\'s net is shown beside it' : 'the learner can press Unfold to see the solid\'s net';
      break;
  }
  if (ch.type === 'match_faces' || ch.type === 'valid_net' || view.netShown)
    facts.foldLines = view.foldGuides ? 'dashed fold lines mark where the net hinges' : 'no fold lines are drawn';
  facts.learnerWork = describeNetWork(ch, view);
  facts.constraints = ch.type === 'count_faces_edges_vertices' || ch.type === 'surface_area'
    ? 'The learner types into the boxes and presses Check; the activity checks the numbers itself. The learner can drag the '
      + 'solid to turn it. You cannot type, turn the solid, or press Check.'
    : 'The learner taps one answer and presses Check; the activity checks it itself. The learner can drag the solid to turn '
      + 'it. You cannot choose, turn the solid, or press Check.';
  return { objects: [], facts };
}

/** The journey row's inputs for an item (`liveJourneySpec.ts`): the right answer, or the mode's signature miss. */
export function netHarnessInput(ch: NetFolderChallenge, solid: NetFolderSolid, intent: 'correct' | 'wrong'):
  { kind: 'counts'; faces: number; edges: number; vertices: number } | { kind: 'choose'; label: string } | { kind: 'total'; value: number } {
  const wrong = intent === 'wrong';
  switch (ch.type) {
    case 'count_faces_edges_vertices': {
      const c = countsOf(solid);
      return wrong ? { kind: 'counts', faces: c.edges, edges: c.faces, vertices: c.vertices } : { kind: 'counts', ...c };
    }
    case 'identify_solid': {
      const target = normSolid(String(ch.targetAnswer)), options = (ch.options ?? []).map(normSolid);
      const other = options.find(o => o !== target && solidFamily(o) !== solidFamily(target)) ?? options.find(o => o !== target)!;
      return { kind: 'choose', label: solidWords(wrong ? other : target) };
    }
    case 'match_faces': {
      const target = matchTarget(ch), options = ch.faceOptions ?? [];
      const other = options.find(o => o === oppositeFace(target)) ?? options.find(o => o !== target)!;
      return { kind: 'choose', label: wrong ? other : target };
    }
    case 'valid_net': return { kind: 'choose', label: netFolds(ch) !== wrong ? 'Valid net' : 'Invalid net' };
    case 'surface_area': {
      const total = surfaceTotal(ch);
      return { kind: 'total', value: wrong ? total / 2 : total };
    }
  }
  throw new Error(`net-folder: no input for ${(ch as NetFolderChallenge).type}`);
}

// ── code-built items (match_faces, valid_net): the drawn net decides the answer ──

const MATCH_ASK = 'The yellow square with a question mark is part of this cube net. When the net folds up into a cube, '
  + 'which face of the cube does the yellow square become?';
const VALID_ASK = 'Here is a net of squares. If you fold it up along its edges, does it make a cube? Choose Valid net or '
  + 'Invalid net, then press Check.';

/**
 * A match_faces item on the net `cells`: `root` is labelled front and `anchor` (a square that does not fold to the
 * back) with its face, which fixes which way is which; `highlight` is the yellow square. The options are the four
 * faces no label names. Null when the squares do not fold into a cube or the anchor cannot fix the turn.
 */
export function matchItem(id: string, cells: Cell[], root: number, anchor: number, highlight: number): NetFolderChallenge | null {
  const fold = foldCubeCells(cells, root);
  if (!fold.valid || new Set([root, anchor, highlight]).size !== 3 || fold.faces[anchor] === 'back') return null;
  const target = fold.faces[highlight]!;
  const named = new Set<string | null>([fold.faces[root], fold.faces[anchor]]);
  const order = ['top', 'bottom', 'left', 'right', 'back', 'front'];
  return {
    id, type: 'match_faces', instruction: MATCH_ASK,
    hint: 'Start at the front square and fold the squares around it one at a time.',
    narration: 'Fold the net in your mind to find where the yellow square goes.',
    targetAnswer: target, netCells: cells, anchorCells: [root, anchor], highlightCell: highlight,
    faceOptions: order.filter(f => !named.has(f)),
  };
}

/** A valid_net item on the net `cells`; the verdict and its reason come from folding them. */
export function validItem(id: string, cells: Cell[]): NetFolderChallenge {
  const fold = foldCubeCells(cells);
  return {
    id, type: 'valid_net', instruction: VALID_ASK,
    hint: 'Fold the squares up one at a time around one square. Does each square land on its own face?',
    narration: 'Will this net fold into a cube?',
    netCells: cells, isValidNet: fold.valid, targetAnswer: fold.valid ? 'valid' : 'invalid',
    netExplanation: fold.valid ? 'Every square folds onto a different face, so the six squares close up into a cube.'
      : fold.reason === 'count' ? `A cube has six faces, so its net needs six squares; this one has ${cells.length}.`
        : 'Two squares fold onto the same face of the cube, so one face is left open.',
  };
}
