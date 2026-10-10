/**
 * spatial-path's in-item levers on `choose_route` (/add-support-tiers; report
 * qa/eval-reports/spatial-path-levers-2026-10-09.md). The misses are what `routeMiss` observes (the movement the
 * chosen route made instead of the asked one); no real-learner evidence.
 *
 * Which route goes the asked way IS the answer, so no lever marks, numbers apart, or describes one route of the item.
 * - `word_picture` (help): beside the map, a small picture of a ball going the asked way past a plain object (a box,
 *   a table, a hoop, a tree, a plank over water). A model outside the item: its path is none of the map's routes, it
 *   carries no route number, and it sits outside the map. Answers every miss (the learner does not yet know the word).
 * - `watch_each` (help): a dot in each route's own colour walks every numbered route in turn, 1 to N, so what each
 *   path does at the landmark is seen moving, not read off overlapping dashes. Every route the same way; none singled
 *   out. Answers every miss.
 * - `three_routes` (simplify): an ungraded challenge first, three routes instead of five, in a different scene, asking
 *   the movement most often confused with the item's (over/under, through/around, across/through). The item's own
 *   asked route is not drawn in it. Then the full item, blank.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { SpatialPathChallenge, SpatialPathRelation } from './SpatialPath';
import { RELATIONS, SCENES, routeContrast, routeFor, routeInstruction, validateSpatialPathChallenge } from './spatialPathRoutes';
import { ROUTE_MISSES } from './spatialPathWorkspace';

export const WORD_LEVER = 'word_picture';
export const WATCH_LEVER = 'watch_each';
export const THREE_LEVER = 'three_routes';

const SIMPLER = '~simpler';
export const isPracticeRoute = (c: Pick<SpatialPathChallenge, 'id'>) => c.id.endsWith(SIMPLER);
/** The session item a practice challenge stands in for. */
export const practiceParent = (id: string, all: readonly SpatialPathChallenge[]) =>
  id.endsWith(SIMPLER) ? all.find(c => `${c.id}${SIMPLER}` === id) ?? null : null;

/** The movement a learner most often takes for this one. */
export const CONFUSED_WITH: Record<SpatialPathRelation, SpatialPathRelation> = {
  over: 'under', under: 'over', through: 'around', around: 'through', across: 'through',
};

/** The model picture for a movement word: a plain object and a ball's path, in its own 200 x 110 frame. */
export interface WordModel { relation: SpatialPathRelation; object: string; path: string }
export const WORD_MODELS: Record<SpatialPathRelation, WordModel> = {
  over: { relation: 'over', object: 'box', path: 'M20 88 Q100 -2 180 88' },
  under: { relation: 'under', object: 'table', path: 'M20 84 L180 84' },
  through: { relation: 'through', object: 'hoop', path: 'M20 58 L180 58' },
  around: { relation: 'around', object: 'tree', path: 'M20 55 L70 55 A30 30 0 1 0 130 55 L180 55' },
  across: { relation: 'across', object: 'plank over the water', path: 'M20 60 L180 60' },
};

/** Leak rule for the word picture: it draws none of the item's routes and names no route number. */
export function wordModelLeaks(challenge: SpatialPathChallenge, model: WordModel): boolean {
  return challenge.routes.some(route => route.d === model.path) || /\d/.test(model.object);
}

/** Leak rule for a practice challenge: never the learner's item, its asked word, or its asked route; three routes. */
export function practiceLeaks(parent: SpatialPathChallenge, practice: SpatialPathChallenge): boolean {
  return practice.id === parent.id || practice.requestedRelation === parent.requestedRelation
    || practice.routes.some(route => route.relation === parent.requestedRelation)
    || practice.traveler.name === parent.traveler.name || practice.landmark.name === parent.landmark.name
    || practice.routes.length !== 3 || validateSpatialPathChallenge(practice).length > 0;
}

/** The easier challenge, or null on a practice challenge or an item that already has three routes. */
export function threeRoutes(c: SpatialPathChallenge): SpatialPathChallenge | null {
  if (isPracticeRoute(c) || c.routes.length <= 3) return null;
  const asked = CONFUSED_WITH[c.requestedRelation];
  const [first, second] = RELATIONS.filter(r => r !== asked && r !== c.requestedRelation);
  const scene = SCENES.find(s => s.traveler.name !== c.traveler.name && s.landmark.name !== c.landmark.name);
  if (!scene || !first || !second) return null;
  const practice: SpatialPathChallenge = {
    id: `${c.id}${SIMPLER}`, type: 'choose_route',
    instruction: routeInstruction(scene.traveler.name, asked, scene.landmark.name),
    traveler: { ...scene.traveler }, landmark: { ...scene.landmark },
    requestedRelation: asked,
    // The asked route in the middle: never first.
    routes: [routeFor(first), routeFor(asked), routeFor(second)],
    correctRouteId: `route-${asked}`,
    contrast: routeContrast(asked, scene.landmark.name),
  };
  return practiceLeaks(c, practice) ? null : practice;
}

export function spatialPathLevers(c: SpatialPathChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!c || isPracticeRoute(c)) return [];
  const all = [...ROUTE_MISSES];
  const lever = (id: string, kind: WorkspaceLever['kind'], carrier: WorkspaceLever['carrier'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier, pulled: pulled.includes(id), answers: all, when, does });
  const model = WORD_MODELS[c.requestedRelation];
  return [
    ...(!wordModelLeaks(c, model) ? [lever(WORD_LEVER, 'help', 'both', 'The learner does not yet know what the movement word means.',
      `Shows a small picture beside the map: a ball going ${c.requestedRelation} a ${model.object}. Say the word with it. `
      + 'It is not on the map and matches no route: never say which route is like it.')] : []),
    lever(WATCH_LEVER, 'help', 'shown', 'The learner picks by where a route ends, or cannot follow the dashed lines.',
      'A dot walks every numbered route in turn, one to the last, each the same way. It singles out no route.'),
    ...(threeRoutes(c) ? [lever(THREE_LEVER, 'simplify', 'both', 'Five routes are too many to compare yet.',
      'Opens an easier map first: three routes in a new scene, asking a different movement word. It is not graded; the '
      + 'full item comes back after it.')] : []),
  ];
}

/** What the pulled levers put on screen, as a scene fact. Never which route goes which way. */
export function leverFacts(c: SpatialPathChallenge | null, pulled: readonly string[]): string {
  if (!c || isPracticeRoute(c)) return '';
  const model = WORD_MODELS[c.requestedRelation];
  return [
    pulled.includes(WORD_LEVER) && `Beside the map, a small picture shows a ball going ${c.requestedRelation} a ${model.object}.`,
    pulled.includes(WATCH_LEVER) && `A dot walks each of the ${c.routes.length} routes in turn, in number order.`,
  ].filter((s): s is string => !!s).join(' ');
}
