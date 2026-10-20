/**
 * spatial-path's card: how its one mode is wired to the live tutor, in the shape every card shares
 * (`components/live-activity/boss.ts`). The catalog reads it; the behavior is `spatialPath.boss.ts`.
 * Every item is one tapped route and the Animate this route press, judged by the map against the route id, so the
 * mode is TAP_ONE with the press named in its moves.
 */
import type { RouteMiss } from './spatialPathWorkspace';
import { defineCard, TAP_ONE } from '../../../components/live-activity/boss';

/** What a wrong route shows (`routeMiss`): the movement it made instead of the asked one. */
export const ROUTE_MISSES: readonly RouteMiss[] = ['went_over', 'went_under', 'went_through', 'went_around', 'went_across'];

export const spatialPathCard = defineCard<RouteMiss>({
  id: 'spatial-path',
  grades: ['Kindergarten'],
  modes: {
    choose_route: { ...TAP_ONE, moves: 'taps a numbered route, then presses Animate this route', misses: ROUTE_MISSES },
  },
  words: {
    job: 'choose the route whose path goes the way the movement word says at the landmark',
    answer: 'the chosen route',
    question: 'the instruction and its movement word',
  },
  levers: true,
});
