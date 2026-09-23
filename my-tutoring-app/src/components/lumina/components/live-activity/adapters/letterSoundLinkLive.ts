import type { LetterSoundLinkData } from '../../../primitives/visual-primitives/literacy/LetterSoundLink';
import { askFor, buildLetterSoundLinkItems, letterSoundChallengeValid }
  from '../../../primitives/visual-primitives/literacy/letterSoundLinkDomain';
import { type WorkspaceDomain, validateChallengePool } from './adapterContract';

/** Reject a pool whose items cannot be ASKED before they reach a five-year-old:
 *  an isolated sound a child cannot produce, a tap with one usable letter, a
 *  picture that does not read as its word. */
export const validateLetterSoundLinkData = (value: unknown) =>
  validateChallengePool<LetterSoundLinkData>(value, letterSoundChallengeValid, {
    pool: 'Generated letter-sound link has invalid lesson content.',
    item: 'A letter-sound item cannot run in the teaching workspace.' });

function letterSoundLinkState(data: LetterSoundLinkData) {
  const items = buildLetterSoundLinkItems(data.challenges, data.supportTier ?? 'medium');
  return { title: data.title, instruction: items.length ? askFor(items[0]) : '', teachingOwner: 'tutor',
    totalChallenges: items.length,
    interaction: 'Teach from liveRuntime.task and its workspace. Two directions are answered out loud and one '
      + 'is answered by tapping a letter; the facts say which. The host records your completed feedback and '
      + 'handles retry and advance.' };
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const letterSoundLinkLiveDomain: WorkspaceDomain<LetterSoundLinkData> = { validate: validateLetterSoundLinkData, initialState: letterSoundLinkState };

