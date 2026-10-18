/**
 * map-explorer on the shared tutor/JEV teaching workspace (born bound, plain shape).
 *
 * Every item is one gesture item; the primitive's own code check judges it.
 * - find_by_direction: tap the place that lies in the named direction from the named place (town map).
 * - name_direction: tap the compass arm that points from one named place to the other (town map).
 * - build_route: give one-block steps with the arrows, then press Go; the bus must stop at the destination.
 * - find_on_globe: spin the globe and tap the named continent or ocean.
 * - world_direction: tap the continent or ocean just north/south/east/west of the named continent.
 *
 * The scene names what is drawn and asked. It never names the answer: no target place or region, no relation
 * between places, and on name_direction no direction at all.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { DIRECTIONS, OPPOSITE, REGION_NAME, type RegionId } from './map/mapGeo';

const DIR_DEG = { north: 0, east: 90, south: 180, west: 270 } as const;
import {
  isTownTask, placeById, quadrant, stepsInWords, type Direction, type MapChallenge, type TownMap,
} from './map/mapModel';

export {
  mapMatches, mapMiss, describeMapAnswer, MAP_MISSES, type MapMiss, type MapAnswer,
} from './map/mapModel';

/** name_direction's spoken wrong answers: the opposite way, a quarter turn off, and on a turned map the screen's way. */
export function mapSpokenMisses(c: MapChallenge): KnownMiss[] {
  if (c.type !== 'name_direction' || !c.direction) return [];
  const opp = OPPOSITE[c.direction];
  const turned = DIRECTIONS.filter(d => d !== c.direction && d !== opp);
  const screen = c.rotation ? quadrant(DIR_DEG[c.direction] - c.rotation) : null;
  return [
    ...(screen && screen !== c.direction ? [{ id: 'screen_direction', pattern: `The answer is "${c.direction}". The map opens turned, `
      + `and the learner says "${screen}", the way the place would be if up were north.`, examples: [screen] }] : []),
    { id: 'opposite_way', pattern: `The answer is "${c.direction}". The learner says the opposite way, "${opp}".`, examples: [opp] },
    { id: 'turned_way', pattern: `The answer is "${c.direction}". The learner says a quarter turn off: ${turned.map(d => `"${d}"`).join(' or ')}.`,
      examples: turned },
  ];
}

/** Every ask is the primitive's own check; "which way?" is one sayable word, so it is spoken, with the arm tap beside it. */
export function mapAssignment(c: MapChallenge): TeachingAssignment {
  if (c.type === 'name_direction' && c.direction)
    return { id: c.id, task: `${c.instruction} The learner answers by saying the direction, or tapping that arm of the compass.`,
      response: 'speech', acceptsGesture: true, expectedAnswer: c.direction, misses: mapSpokenMisses(c) };
  return { id: c.id, task: c.instruction, response: 'gesture' };
}

export interface MapView {
  /** World tasks: the names drawn on the map now. */
  labelsShown?: RegionId[];
  /** build_route: the hops planned so far. */
  steps?: Direction[];
  /** The map's bearing now (degrees clockwise; 0 = north up). The learner can turn the map. */
  bearing?: number;
  /** Checks so far on this item. */
  checks: number;
  /** The last check's screen feedback, or null before one. */
  lastFeedback: string | null;
}

const SCREEN_WORD: Record<Direction, string> = { north: 'up', east: 'to the right', south: 'down', west: 'to the left' };

export function mapScene(c: MapChallenge, map: TownMap | undefined, view: MapView): WorkspaceScene {
  if (isTownTask(c.type) && map) {
    const from = placeById(map, c.fromId);
    return { objects: [], facts: {
      map: `a real street map of ${map.name} in ${map.city}${map.source === 'google_maps' ? ' (places from Google Maps)' : ''}, `
        + 'with each place as a pin at its real spot, and a compass rose beside it that turns with the map',
      placesOnTheMap: map.places.map(p => p.name).join(', '),
      compass: !view.bearing || quadrant(-view.bearing) === 'north' ? 'north points up the screen'
        : `the map is turned: north points ${SCREEN_WORD[quadrant(-view.bearing)]} on the screen, so up is not north`,
      ...(c.compassGlow ? { support: 'the compass rose is glowing' } : {}),
      ...(from ? { startingPlace: `${from.name} (ringed in yellow)` } : {}),
      ...(c.type === 'build_route' ? { stepsSoFar: view.steps?.length ? stepsInWords(view.steps) : 'none yet' } : {}),
      checksSoFar: view.checks,
      ...(view.lastFeedback ? { lastCheckShowed: view.lastFeedback } : {}),
      constraints: c.type === 'find_by_direction'
        ? 'The learner taps a place pin on the map; the tap is the check. Exactly one place lies in the named direction; places off to the side do not count.'
        : c.type === 'name_direction'
          ? 'The learner taps one of the four arms of the compass rose (N, E, S, W); the tap is the check.'
          : 'The learner presses the arrow buttons (North, East, South, West), each one hop of the helicopter, and the plan shows as a dotted line; Land is the check, then the helicopter flies it.',
    } };
  }
  const from = c.fromId ? REGION_NAME[c.fromId as RegionId] : null;
  return { objects: [], facts: {
    map: 'a real globe of the whole world that the learner can spin and zoom; each continent is brightly coloured',
    namesShown: view.labelsShown?.length ? view.labelsShown.map(id => REGION_NAME[id]).join(', ') : 'none',
    ...(from ? { startingContinent: `${from} (outlined in yellow)` } : {}),
    compass: 'a compass rose in the corner; north is toward the top of the map',
    checksSoFar: view.checks,
    ...(view.lastFeedback ? { lastCheckShowed: view.lastFeedback } : {}),
    constraints: 'The learner taps land or water on the map; the tap is the check. Each continent has its own colour; '
      + 'names appear only where listed above.',
  } };
}
