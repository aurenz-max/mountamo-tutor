/**
 * Construction site diorama on the shared tutor/JEV teaching workspace (born bound, plain shape).
 *
 * Every item is one gesture item.
 * - load_truck: the learner works the excavator (tap the pile to dig, tap the truck to dump) and presses Send;
 *   sending the truck is the check. A scoops ask names the count (counting while loading is the task); a tons
 *   ask gives the limit and one scoop's weight, and the number of scoops never reaches the tutor.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { sendFeedback, scoopWord, tonWord, type ConstructionChallenge } from './constructionModel';

export {
  loadMatches, loadMiss, describeLoad, CONSTRUCTION_MISSES, type ConstructionMiss,
} from './constructionModel';

export const constructionAssignment = (c: ConstructionChallenge): TeachingAssignment =>
  ({ id: c.id, task: c.instruction, response: 'gesture' });

export interface ConstructionView {
  /** Scoops in the bed now. */
  loaded: number;
  /** The bucket holds a scoop. */
  holding: boolean;
  /** Scoops dumped on a full bed, lying on the ground. */
  spilled: number;
  /** Times the truck was sent on this load. */
  sends: number;
  /** Scoops in the bed at the last send, or null before one. */
  lastSent: number | null;
}

export function constructionScene(c: ConstructionChallenge, view: ConstructionView): WorkspaceScene {
  return { objects: [], facts: {
    site: `a work site drawn in 3D: an excavator, a pile of ${c.material}, and an empty dump truck parked beside it`,
    ...(c.units === 'tons'
      ? { truckLimit: `${tonWord(c.capacityTons!)} (painted on the truck)`, oneScoopWeighs: tonWord(c.scoopTons!) }
      : {}),
    scoopsInTruck: view.loaded,
    bucket: view.holding ? `full of ${c.material}` : 'empty',
    ...(view.spilled ? { spilledOnTheGround: scoopWord(view.spilled) } : {}),
    sendsSoFar: view.sends,
    ...(view.lastSent != null ? { lastSendShowed: sendFeedback(c, view.lastSent) } : {}),
    constraints: 'The learner taps the pile to dig a scoop and taps the truck to dump it; with an empty bucket, a tap on the '
      + 'truck takes a scoop back out. Each scoop lands as its own mound in the truck bed. Pressing Send is the check. '
      + (c.units === 'tons'
        ? 'The screen shows no weight while loading; after Send the scale shows the weight in the bed.'
        : 'No number on screen counts the scoops; the learner counts the mounds.'),
  } };
}
