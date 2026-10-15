/**
 * Airplane diorama on the shared tutor/JEV teaching workspace (born bound, plain shape).
 *
 * Every item is one gesture item.
 * - find_part: the learner turns the 3D jet and taps a part, and the tap is the check. The key (which part)
 *   reaches the tutor only as the ask itself: a name ask names the part (that is the task), a job ask names
 *   only the job. Where the part is on the jet never reaches the tutor.
 * - flight_plan: the learner loads fuel tanks and presses Fly, and the flight is the check. The trip and the
 *   fuel rule reach the tutor (they are on screen); the number of tanks the trip needs never does.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  PART_INFO, flightFeedback, formatDistance, tankWord,
  type AirplaneChallenge, type AirplanePart, type FindPartChallenge, type FlightPlanChallenge, type FlightRun,
} from './airplaneModel';

export {
  airplaneMiss, partMatches, describeTap, flightMiss, flightMatches, describeFuel, AIRPLANE_MISSES, type AirplaneMiss,
} from './airplaneModel';

export const airplaneAssignment = (c: AirplaneChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.instruction, response: 'gesture' });

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

const JET_CONSTRAINTS = 'The learner drags to turn the jet, pinches or scrolls to zoom, and taps a part to answer. A tap on the jet is '
  + 'the check. No part is labelled on screen while the learner looks; after a tap the screen names the part that was tapped. '
  + 'After the right tap that part shows what it does.';

function findPartScene(c: FindPartChallenge, view: AirplaneView): WorkspaceScene {
  return { objects: [], facts: {
    jet: 'a passenger jet on a display stand, drawn in 3D',
    askedBy: c.askStyle === 'name' ? 'the part\'s name' : 'the job the part does; its name is not given',
    tapsSoFar: view.taps,
    ...(view.tapped ? { lastTapped: PART_INFO[view.tapped].name } : {}),
    ...(view.showing ? { nowShowing: `${PART_INFO[c.part].title}: ${PART_INFO[c.part].shows}. On screen: "${PART_INFO[c.part].fact}"` } : {}),
    constraints: JET_CONSTRAINTS,
  } };
}

function flightPlanScene(c: FlightPlanChallenge, view: AirplaneView): WorkspaceScene {
  return { objects: [], facts: {
    trip: `fly ${c.cargo} from ${c.from} to ${c.to}`,
    map: c.units === 'hops'
      ? 'a map with the two airports and the route between them drawn as hops, one coloured stripe per hop; the hops are not numbered'
      : `a map with the two airports and the route between them, labelled ${formatDistance(c, c.distance)}`,
    fuelRule: `${c.units === 'hops' ? 'one tank flies one hop' : `one tank flies ${formatDistance(c, c.perTank)}`}; land with ${tankWord(c.spare, true)}`,
    tanksLoaded: view.loaded ?? 0,
    flightsSoFar: view.flights ?? 0,
    ...(view.lastFlight ? { lastFlightShowed: flightFeedback(c, view.lastFlight) } : {}),
    constraints: 'The learner adds and removes fuel tanks with the loader buttons and presses Fly. The flight is the check: the '
      + 'jet flies the route on the map, one tank empties for each stretch it flies, and it lands at the far airport or comes '
      + 'down short when the fuel runs out. After a flight the screen says how far it got or how many tanks were left.',
  } };
}

export function airplaneScene(c: AirplaneChallenge, view: AirplaneView): WorkspaceScene {
  return c.type === 'find_part' ? findPartScene(c, view) : flightPlanScene(c, view);
}
