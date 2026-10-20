/**
 * spatial-path's in-item levers on `choose_route`, as one lever set (`bossLevers.ts`; /add-support-tiers, report
 * qa/eval-reports/spatial-path-levers-2026-10-09.md). The misses are what `routeMiss` observes (the movement the
 * chosen route made instead of the asked one); no real-learner evidence.
 *
 * Which route goes the asked way IS the answer, so no lever marks, numbers apart, or describes one route of the item.
 * - `word_picture` (model): beside the map, a small picture of a ball going the asked way past a plain object (a box,
 *   a table, a hoop, a tree, a plank over water): a different item, solved. Its path is none of the map's routes, it
 *   carries no route number, and it sits outside the map. Answers every miss (the learner does not yet know the word).
 *   When it comes is the lesson's support tier (`support`; medium when the lesson has none).
 * - `watch_each` (marks): a dot in each route's own colour walks every numbered route in turn, 1 to N, so what each
 *   path does at the landmark is seen moving, not read off overlapping dashes. Every route the same way; none singled
 *   out. Answers every miss.
 * - `three_routes` (easier): an ungraded challenge first, three routes instead of five, in a different scene, asking
 *   the movement most often confused with the item's (over/under, through/around, across/through). The item's own
 *   asked route is not drawn in it. Then the full item, blank.
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { SpatialPathChallenge, SpatialPathRelation } from './SpatialPath';
import { ROUTE_MISSES } from './spatialPath.card';
import { RELATIONS, SCENES, routeContrast, routeFor, routeInstruction, validateSpatialPathChallenge } from './spatialPathRoutes';

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

/** The word picture for an item, or null on a practice map or when it would copy one of the item's routes. */
export function wordPicture(c: SpatialPathChallenge): WordModel | null {
  const model = WORD_MODELS[c.requestedRelation];
  return isPracticeRoute(c) || wordModelLeaks(c, model) ? null : model;
}

/** The lever set: every lever once, by type. A practice map declares none and shows none. */
export const ROUTE_LEVERS = leverSet<SpatialPathChallenge, null>({
  missesOf: () => ROUTE_MISSES,
  // The word picture is a ball going the asked way past another object, solved; when it comes is the tier's.
  support: {
    tier: c => c.supportTier ?? 'medium',
    different: 'a small picture of a ball going that way past another object',
    own: 'which route on this map goes that way',
  },
  specs: [
    { id: WORD_LEVER, type: 'model', answers: 'all',
      when: 'The learner does not yet know what the movement word means.',
      does: c => `Shows a small picture beside the map: a ball going ${c.requestedRelation} a `
        + `${WORD_MODELS[c.requestedRelation].object}. Say the word with it. It is not on the map and matches no route: `
        + 'never say which route is like it.',
      content: wordPicture,
      fact: (m: WordModel) => `Beside the map, a small picture shows a ball going ${m.relation} a ${m.object}.` },
    { id: WATCH_LEVER, type: 'marks', answers: 'all',
      when: 'The learner picks by where a route ends, or cannot follow the dashed lines.',
      does: 'A dot walks every numbered route in turn, one to the last, each the same way. It singles out no route.',
      content: c => (isPracticeRoute(c) ? null : true),
      fact: (_: unknown, c) => `A dot walks each of the ${c.routes.length} routes in turn, in number order.` },
    { id: THREE_LEVER, type: 'easier', answers: 'all',
      when: 'Five routes are too many to compare yet.',
      does: 'Opens an easier map first: three routes in a new scene, asking a different movement word. It is not graded; '
        + 'the full item comes back after it.',
      content: c => threeRoutes(c) },
  ],
});
