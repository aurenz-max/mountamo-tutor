/**
 * map-explorer on the shared tutor/JEV teaching workspace (boss `mapExplorer.boss.ts`, card `mapExplorer.card.ts`).
 *
 * - find_by_direction: tap the place that lies in the named direction from the named place (town map).
 * - name_direction: say the direction from one named place to the other, or tap that arm of the compass (town map).
 * - build_route: press the arrows, one hop each, then Land; the helicopter must land at the destination.
 * - find_on_globe: spin the globe and tap the named continent or ocean.
 * - world_direction: tap the continent or ocean just north/south/east/west of the named continent.
 *
 * Code owns every key and every check (`map/mapModel.ts`). The scene names what is drawn and asked. It never names
 * the answer: no target place or region, no relation between places, and on name_direction no direction at all.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { DIRECTIONS, OPPOSITE, REGION_NAME, type RegionId } from './map/mapGeo';
import {
  isTownTask, placeById, quadrant, stepsInWords, type Direction, type MapChallenge, type TownMap,
} from './map/mapModel';

export {
  mapMatches, mapMiss, describeMapAnswer, MAP_MISSES, type MapMiss, type MapAnswer,
} from './map/mapModel';

const DIR_DEG = { north: 0, east: 90, south: 180, west: 270 } as const;

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

/** What the learner is asked: the code-written instruction, as the screen prints it. */
export const mapAsk = (c: MapChallenge): string => c.instruction;

/** "Which way?" is one sayable word, so it has a key; every other ask is answered on the map (null). */
export function mapKey(c: MapChallenge): SpokenKey | null {
  if (c.type !== 'name_direction' || !c.direction) return null;
  return { answer: c.direction, alsoAccept: [`${c.direction}ward`, `to the ${c.direction}`],
    signatureError: 'Up, down, left or right names the screen, not the compass: not an answer yet; ask which way the compass says.' };
}

/**
 * What a "which way" ask says by design: the two place names (code writes "Which way is <to> from <from>?"). A real
 * place may carry a direction in its name ("North Station"); saying the name does not say the answer.
 */
export function mapGiven(c: MapChallenge): string[] {
  const m = /^Which way is (.+) from (.+?)\?/.exec(c.instruction);
  return m ? [m[1], m[2]] : [];
}

/** The journey's spoken answers on a "which way" ask: the direction, or the opposite way. */
export function mapHarnessWords(c: MapChallenge): { correct: string; plainWrong: string } {
  const dir = c.direction ?? 'north';
  return { correct: dir, plainWrong: OPPOSITE[dir] };
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

/** The rules the tutor keeps on every ask (the family's never-say rules). */
const NEVER_SAY = 'Never name the place, continent, ocean or direction that answers the ask, and never say which places '
  + 'line up with each other; ask which way the compass rose says, and what is on that side of the named place. After a '
  + 'check the screen says what the learner chose and where it is; talk about that.';

export function mapScene(c: MapChallenge, map: TownMap | undefined, view: MapView): SceneOf {
  if (isTownTask(c.type) && map) {
    const from = placeById(map, c.fromId);
    return { objects: [], facts: {
      map: `a real street map of ${map.name} in ${map.city}${map.source === 'google_maps' ? ' (places from Google Maps)' : ''}, `
        + 'with each place as a pin at its real spot, and a compass rose beside it that turns with the map',
      placesOnTheMap: map.places.map(p => p.name).join(', '),
      compass: !view.bearing || quadrant(-view.bearing) === 'north' ? 'north points up the screen'
        : `the map is turned: north points ${SCREEN_WORD[quadrant(-view.bearing)]} on the screen, so up is not north`,
      ...(c.compassGlow ? { compassGlow: 'the compass rose is glowing' } : {}),
      ...(from ? { startingPlace: `${from.name} (ringed in yellow)` } : {}),
      ...(c.type === 'build_route' ? { stepsSoFar: view.steps?.length ? stepsInWords(view.steps) : 'none yet' } : {}),
      checksSoFar: view.checks,
      ...(view.lastFeedback ? { lastCheckShowed: view.lastFeedback } : {}),
      constraints: 'Directions come from the compass rose, never from up and down on the screen: when the map is turned, '
        + 'ask the learner to find N on the compass first.'
        + (c.type === 'find_by_direction' ? ' Exactly one place lies the named way; places off to the side do not count.' : ''),
      neverSay: NEVER_SAY,
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
    constraints: 'Names appear only where listed above, so never name a continent by its colour or say where to spin.',
    neverSay: NEVER_SAY,
  } };
}
