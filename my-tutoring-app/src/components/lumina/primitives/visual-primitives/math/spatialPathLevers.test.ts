/**
 * spatial-path levers: which lever a miss pulls next, the word picture's and the practice map's leak rules, and the
 * practice builder over every generated item.
 */
import { describe, expect, it } from 'vitest';
import { nextLever } from '../../../components/live-activity/runtime/observerLever';
import { selectSpatialPathChallenges } from '../../../service/math/gemini-spatial-path';
import type { SpatialPathChallenge } from './SpatialPath';
import {
  CONFUSED_WITH, THREE_LEVER, WATCH_LEVER, WORD_LEVER, WORD_MODELS, leverFacts, practiceLeaks, practiceParent,
  spatialPathLevers, threeRoutes, wordModelLeaks,
} from './spatialPathLevers';
import { ROUTE_MISSES, routeMiss } from './spatialPathWorkspace';

const ITEMS = selectSpatialPathChallenges(6);

describe('spatial-path levers', () => {
  it.each(ROUTE_MISSES)('%s pulls the word picture first, then watch each, then the easier map', miss => {
    const c = ITEMS[0];
    expect(nextLever(spatialPathLevers(c, []), miss)).toBe(WORD_LEVER);
    expect(nextLever(spatialPathLevers(c, [WORD_LEVER]), miss)).toBe(WATCH_LEVER);
    expect(nextLever(spatialPathLevers(c, [WORD_LEVER, WATCH_LEVER]), miss)).toBe(THREE_LEVER);
  });

  it.each(ITEMS.map(c => [c.id, c] as const))('%s: every wrong route names a miss some lever answers', (_id, c) => {
    const levers = spatialPathLevers(c, []);
    for (const route of c.routes.filter(r => r.id !== c.correctRouteId)) {
      const miss = routeMiss(c, route.id)!;
      expect(levers.some(l => l.answers?.includes(miss))).toBe(true);
    }
  });

  it.each(ITEMS.map(c => [c.id, c] as const))('%s: the word picture draws no route of the item and the facts name none', (_id, c) => {
    expect(wordModelLeaks(c, WORD_MODELS[c.requestedRelation])).toBe(false);
    const facts = leverFacts(c, [WORD_LEVER, WATCH_LEVER]);
    expect(facts).not.toMatch(/route \d|route-|correct/i);
    expect(spatialPathLevers(c, []).map(l => l.does).join(' ')).not.toMatch(/\broute \d/i);
    // A model that copied a route's path would leak.
    expect(wordModelLeaks(c, { ...WORD_MODELS.over, path: c.routes[0].d })).toBe(true);
  });

  it.each(ITEMS.map(c => [c.id, c] as const))('%s: the easier map is three routes, a new scene and word, without the asked route', (_id, c) => {
    const p = threeRoutes(c)!;
    expect(p).not.toBeNull();
    expect(practiceLeaks(c, p)).toBe(false);
    expect(p.routes).toHaveLength(3);
    expect(p.requestedRelation).toBe(CONFUSED_WITH[c.requestedRelation]);
    expect(p.routes.map(r => r.relation)).not.toContain(c.requestedRelation);
    expect(p.routes.findIndex(r => r.id === p.correctRouteId)).toBe(1);
    expect(practiceParent(p.id, ITEMS)).toBe(c);
    // No easier map from a practice map or a three-route item; no levers on a practice map.
    expect(threeRoutes(p)).toBeNull();
    expect(spatialPathLevers(p, [])).toEqual([]);
    const three: SpatialPathChallenge = { ...c, routes: c.routes.slice(0, 3) };
    expect(spatialPathLevers(three, []).map(l => l.id)).toEqual([WORD_LEVER, WATCH_LEVER]);
  });
});
