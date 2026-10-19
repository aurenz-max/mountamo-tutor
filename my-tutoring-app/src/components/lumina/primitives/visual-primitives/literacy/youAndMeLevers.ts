/**
 * The in-item levers on you-and-me (`/add-support-tiers`, handoff 22 L4), as one lever set (`bossLevers.ts`). The
 * answer is a spoken sentence whose subject (I or you, and myself or yourself) points at the doer from the speaking
 * role. Both levers mark a ROLE on the partner cards; the learner still binds the role to the word, which is the skill.
 *
 * - `speaker_highlight` (marks): lights the card of the partner the learner is playing. Answers a sentence told from
 *   outside the scene (the doer's name, he or she).
 * - `actor_marker` (marks): puts the object and "Did the action" on the doer's card. Answers the other partner's
 *   pronoun.
 *
 * The tier is the starting position (`youAndMeSupport.ts`): a lever is offered only where the tier withdrew the aid.
 * No simplify: a new scene would spend a later item, and one partner alone removes the role the mode is about. No
 * model lever, so the set declares no `support`.
 * Leak rule: nothing a lever draws or says names a pronoun or the model sentence (`leverTextLeak`).
 */
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { YouAndMeChallenge } from './YouAndMe';
import { youAndMeCard } from './youAndMe.card';
import { supportFor } from './youAndMeSupport';

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

export const YOU_AND_ME_LEVERS = leverSet<YouAndMeChallenge, void>({
  modeOf: item => item.type,
  missesOf: mode => youAndMeCard.modes[mode as keyof typeof youAndMeCard.modes].misses,
  specs: [
    { id: SPEAKER_LEVER, type: 'marks', answers: ['said_name', 'said_he_she'],
      offer: item => !supportFor(item).showSpeakerHighlight,
      when: 'The learner tells the action from outside the scene, with the name or he or she.',
      does: 'Lights the card of the partner the learner is playing. Names no word.',
      fact: (_: unknown, item) => `${item.participants[item.speaker].name}'s card is lit: the partner the learner is playing` },
    { id: ACTOR_LEVER, type: 'marks', answers: ['swapped_pronoun'],
      offer: item => !supportFor(item).showActorMarker,
      when: 'The learner uses the word for the other partner.',
      does: 'Marks the partner who did the action with the object. Names no word.',
      fact: (_: unknown, item) => `${item.participants[item.actor].name}'s card shows the ${item.object} and "Did the action"` },
  ],
});
