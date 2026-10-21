/**
 * Construction site diorama's scene on the shared tutor/JEV teaching workspace. Every item is one load the activity
 * checks when the truck is sent (the card, `constructionSiteDiorama.card.ts`, names the moves; the boss gives the
 * assignment). The scene carries only this site's own facts, never the moves the card says.
 *
 * - load_truck: a scoops ask names the count (counting while loading is the task); a tons ask gives the limit and one
 *   scoop's weight, and the number of scoops never reaches the tutor.
 */
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import { sendFeedback, scoopWord, tonWord, type ConstructionChallenge } from './constructionModel';

export { CONSTRUCTION_MISSES_BY_MODE, type ConstructionMiss } from './constructionSiteDiorama.card';

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

export function constructionScene(c: ConstructionChallenge, view: ConstructionView): SceneOf {
  return { objects: [], facts: {
    site: `a work site drawn in 3D: an excavator, a pile of ${c.material}, and an empty dump truck parked beside it`,
    ...(c.units === 'tons'
      ? { truckLimit: `${tonWord(c.capacityTons!)} (painted on the truck)`, oneScoopWeighs: tonWord(c.scoopTons!) }
      : {}),
    scoopsInTruck: view.loaded,
    bucket: view.holding ? `full of ${c.material}` : 'empty',
    ...(view.spilled ? { spilledOnTheGround: scoopWord(view.spilled) } : {}),
    // Counting or working out the scoops is the task: the count is the learner's step, not the tutor's.
    workingOut: c.units === 'tons'
      ? 'the learner works out how many scoops fill the truck from the limit and one scoop\'s weight; never say that '
        + 'number, and never add up the weight in the bed while loading; ask what one scoop weighs and how they will '
        + 'know when the truck is full'
      : 'the learner counts the mounds in the bed; never say how many scoops are in the truck or how many more are '
        + 'needed; ask them to count the mounds, and count along only after they start',
    sendsSoFar: view.sends,
    ...(view.lastSent != null ? { lastSendShowed: sendFeedback(c, view.lastSent) } : {}),
    constraints: 'Each scoop lands as its own mound in the truck bed. '
      + (c.units === 'tons'
        ? 'The screen shows no weight while loading; after Send the scale shows the weight in the bed.'
        : 'No number on screen counts the scoops.')
      + ' After Send the screen says what was in the truck; the tutor may talk about that.',
  } };
}
