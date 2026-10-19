import type { SupportTier } from '../../../service/generation/generationContext';
import type { YouAndMeChallenge, YouAndMeMode } from './YouAndMe';

export interface YouAndMeSupportScaffold {
  showSpeakerHighlight: boolean;
  showActorMarker: boolean;
  preparation: string;
}

/** Support changes only aids, never the scene, role assignment or judging target. */
export function resolveSupportStructure(mode: YouAndMeMode, tier: SupportTier): YouAndMeSupportScaffold {
  return {
    showSpeakerHighlight: tier !== 'hard',
    showActorMarker: tier === 'easy',
    preparation: tier === 'hard' ? '' : tier === 'easy'
      ? `Check before speaking: find the speaker, find who did the action, then speak from the speaker's place.${mode === 'describe_independent_action' ? ' Keep the self word pointing to the person who acted without help.' : ''}`
      : mode === 'describe_independent_action'
        ? 'Keep the no-help sentence in the speaking partner’s voice.'
        : 'Keep the sentence in the speaking partner’s voice.',
  };
}

export function supportFor(item: YouAndMeChallenge): YouAndMeSupportScaffold {
  // Old saved payloads retain their original visual aids and no added preparation.
  return item.supportTier ? item.support ?? resolveSupportStructure(item.type, item.supportTier)
    : { showSpeakerHighlight: true, showActorMarker: true, preparation: '' };
}

/** The scene's `help` fact: how much a help request may walk through, by tier. The answer rule is the doctrine's. */
export function tutorRevealPolicy(item: YouAndMeChallenge): string {
  const preparation = supportFor(item).preparation;
  return item.supportTier === 'hard'
    ? 'On help, invite a fresh look at the scene. Do not walk through roles or name a strategy.'
    : item.supportTier === 'medium'
      ? `On help, offer only this brief nudge: ${preparation} Do not add a role checklist.`
      : item.supportTier === 'easy'
        ? `On help, walk through this check one step at a time: ${preparation}`
        : 'On help, name who is speaking and who did the action.';
}
