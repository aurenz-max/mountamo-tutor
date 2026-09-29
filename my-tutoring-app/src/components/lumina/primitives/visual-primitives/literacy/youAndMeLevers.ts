/**
 * The in-item levers on you-and-me (`/add-support-tiers`, handoff 22 L4). The answer is a spoken sentence whose
 * subject (I or you, and myself or yourself) points at the doer from the speaking role. Both levers mark a ROLE on
 * the partner cards; the learner still binds the role to the word, which is the skill.
 *
 * - `speaker_highlight` (help, shown): lights the card of the partner the learner is playing. Answers a sentence told
 *   from outside the scene (the doer's name, he or she).
 * - `actor_marker` (help, shown): puts the object and "Did the action" on the doer's card. Answers the other
 *   partner's pronoun.
 *
 * The tier is the starting position (`youAndMeSupport.ts`): a lever is offered only where the tier withdrew the aid.
 * No simplify: a new scene would spend a later item, and one partner alone removes the role the mode is about.
 * Leak rule: nothing a lever draws or says names a pronoun or the model sentence (`leverTextLeak`).
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { YouAndMeChallenge } from './YouAndMe';
import { supportFor } from './youAndMeSupport';
import type { SpokenYouAndMeMiss } from './youAndMeWorkspace';

export const SPEAKER_LEVER = 'speaker_highlight';
export const ACTOR_LEVER = 'actor_marker';

/** Which aids are on screen: the tier's, plus any pulled lever. */
export function aidsOnScreen(item: YouAndMeChallenge, pulled: readonly string[]) {
  const tier = supportFor(item);
  return { speaker: tier.showSpeakerHighlight || pulled.includes(SPEAKER_LEVER),
    actor: tier.showActorMarker || pulled.includes(ACTOR_LEVER) };
}

/** Leak rule: true if lever text names a subject or self word. */
export const leverTextLeak = (text: string) => /\b(I|you|myself|yourself|me)\b/i.test(text);

/** What the pulled levers put on screen, for the tutor. Names the roles, never the word. */
export function leversOnScreen(item: YouAndMeChallenge, pulled: readonly string[]): string | null {
  const tier = supportFor(item);
  const lines = [
    pulled.includes(SPEAKER_LEVER) && !tier.showSpeakerHighlight
      && `${item.participants[item.speaker].name}'s card is lit: the partner the learner is playing`,
    pulled.includes(ACTOR_LEVER) && !tier.showActorMarker
      && `${item.participants[item.actor].name}'s card shows the ${item.object} and "Did the action"`,
  ].filter(Boolean);
  return lines.length ? lines.join('; ') : null;
}

/** The levers this item declares, with their state: only the aids its tier withdrew. */
export function youAndMeLevers(item: YouAndMeChallenge | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!item) return [];
  const tier = supportFor(item);
  const levers: WorkspaceLever[] = [];
  if (!tier.showSpeakerHighlight) levers.push({ id: SPEAKER_LEVER, kind: 'help', carrier: 'shown',
    pulled: pulled.includes(SPEAKER_LEVER), answers: ['said_name', 'said_he_she'] satisfies SpokenYouAndMeMiss[],
    when: 'The learner tells the action from outside the scene, with the name or he or she.',
    does: 'Lights the card of the partner the learner is playing. Names no word.' });
  if (!tier.showActorMarker) levers.push({ id: ACTOR_LEVER, kind: 'help', carrier: 'shown',
    pulled: pulled.includes(ACTOR_LEVER), answers: ['swapped_pronoun'] satisfies SpokenYouAndMeMiss[],
    when: 'The learner uses the word for the other partner.',
    does: 'Marks the partner who did the action with the object. Names no word.' });
  return levers;
}
