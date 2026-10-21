/**
 * Airplane diorama's scene on the shared tutor/JEV teaching workspace. Every item is one gesture item the activity
 * checks (the card, `airplaneDiorama.card.ts`, names each mode's moves; the boss gives the assignment). The scene
 * carries only this jet's own facts, never the moves the card says.
 *
 * - find_part: the learner turns the 3D jet and taps a part, and the tap is the check. The key (which part)
 *   reaches the tutor only as the ask itself: a name ask names the part (that is the task), a job ask names
 *   only the job. Where the part is on the jet never reaches the tutor.
 * - flight_plan: the learner loads fuel tanks and presses Fly, and the flight is the check. The trip and the
 *   fuel rule reach the tutor (they are on screen); the number of tanks the trip needs never does.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import {
  PART_INFO, flightFeedback, formatDistance, tankWord,
  type AirplaneChallenge, type AirplanePart, type FindPartChallenge, type FlightPlanChallenge, type FlightRun,
} from './airplaneModel';

export { AIRPLANE_MISSES_BY_MODE, type AirplaneMiss } from './airplaneDiorama.card';

export interface AirplaneView {
  /** find_part: the last part tapped on this ask, or null. */
  tapped: AirplanePart | null;
  /** find_part: taps on this ask so far. */
  taps: number;
  /** find_part: the found part is showing what it does. */
  showing: boolean;
  /** flight_plan: tanks loaded now. */
  loaded?: number;
  /** flight_plan: flights so far on this trip. */
  flights?: number;
  /** flight_plan: the last flight, once it has landed. */
  lastFlight?: FlightRun | null;
}

const JET_CONSTRAINTS = 'No part is labelled on screen while the learner looks; after a tap the screen names the part that '
  + 'was tapped. After the right tap that part shows what it does.';

function findPartScene(c: FindPartChallenge, view: AirplaneView): SceneOf {
  return { objects: [], facts: {
    jet: 'a passenger jet on a display stand, drawn in 3D',
    askedBy: c.askStyle === 'name' ? 'the part\'s name'
      : 'the job the part does; its name is not given, and matching the job to a part is the task, so the name is the answer',
    // Finding the part is the task: where it sits on the jet decides the tap.
    whereItIs: 'the answer: never say where the asked part is on the jet (front, back, under, on top, beside another '
      + 'part) and never point toward it',
    tapsSoFar: view.taps,
    ...(view.tapped ? { lastTapped: PART_INFO[view.tapped].name } : {}),
    ...(view.showing ? { nowShowing: `${PART_INFO[c.part].title}: ${PART_INFO[c.part].shows}. On screen: "${PART_INFO[c.part].fact}"` } : {}),
    constraints: JET_CONSTRAINTS,
  } };
}

function flightPlanScene(c: FlightPlanChallenge, view: AirplaneView): SceneOf {
  return { objects: [], facts: {
    trip: `fly ${c.cargo} from ${c.from} to ${c.to}`,
    map: c.units === 'hops'
      ? 'a map with the two airports and the route between them drawn as hops, one coloured stripe per hop; the hops are not numbered'
      : `a map with the two airports and the route between them, labelled ${formatDistance(c, c.distance)}`,
    fuelRule: `${c.units === 'hops' ? 'one tank flies one hop' : `one tank flies ${formatDistance(c, c.perTank)}`}; land with ${tankWord(c.spare, true)}`,
    // Working out the tanks is the task: the hop count or the division is the learner's step, not the tutor's.
    workingOut: c.units === 'hops'
      ? 'the learner counts the hops; never count them or say how many there are'
      : 'the learner divides the distance by how far one tank flies; never do the division or say its result',
    tanksLoaded: view.loaded ?? 0,
    flightsSoFar: view.flights ?? 0,
    ...(view.lastFlight ? { lastFlightShowed: flightFeedback(c, view.lastFlight) } : {}),
    constraints: 'In a flight the jet flies the route on the map, one tank empties for each stretch it flies, and it lands at '
      + 'the far airport or comes down short when the fuel runs out. After a flight the screen says how far it got or how '
      + 'many tanks were left.',
  } };
}

export function airplaneScene(c: AirplaneChallenge, view: AirplaneView): SceneOf {
  return c.type === 'find_part' ? findPartScene(c, view) : flightPlanScene(c, view);
}
