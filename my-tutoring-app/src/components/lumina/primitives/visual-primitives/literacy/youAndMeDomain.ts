/**
 * you-and-me's domain: the ask, the spoken key, the known misses, the scene, the hear-again request and the harness
 * answers. Pure. The boss (`youAndMe.boss.ts`), the component and the levers read it; the tutor teaches in its own
 * words, so nothing here writes a cue, a correction or a judging contract (those went with the scripted runner,
 * 2026-10-19).
 *
 * Every turn is one spoken sentence, judged on who its subject points at from the speaking role: I when the speaker
 * did the action, you when the listener did; on independent actions also myself or yourself for that same person.
 */
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { SceneOf } from '../../../components/live-activity/bossLevers';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import type { YouAndMeChallenge } from './YouAndMe';
import type { SpokenYouAndMeMiss } from './youAndMe.card';
import { supportFor, tutorRevealPolicy } from './youAndMeSupport';

export const YOU_AND_ME_MODES = ['describe_action', 'describe_independent_action'] as const;

const independent = (item: YouAndMeChallenge) => item.type === 'describe_independent_action';
export const expectedPronoun = (item: YouAndMeChallenge): 'I' | 'you' => item.actor === item.speaker ? 'I' : 'you';
export const expectedReflexive = (item: YouAndMeChallenge) => item.actor === item.speaker ? 'myself' : 'yourself';
export const modelSentence = (item: YouAndMeChallenge) =>
  `${item.actor === item.speaker ? 'I' : 'You'} ${item.action}${independent(item) ? ` by ${expectedReflexive(item)}` : ''}.`;
export const sceneStatement = (item: YouAndMeChallenge) =>
  `${item.participants[item.actor].name} ${item.action}${independent(item) ? ' without any help' : ''}.`;
export const taskPrompt = (item: YouAndMeChallenge) =>
  `Play ${item.participants[item.speaker].name}. Tell ${item.participants[1 - item.speaker].name} what happened.`
  + (independent(item) ? ' Use a self word to tell that no one helped.' : '');

/** The ask: the scene, then the role to play (and the tier's preparation line). Names no pronoun. */
export const youAndMeAsk = (item: YouAndMeChallenge) =>
  [sceneStatement(item), taskPrompt(item), supportFor(item).preparation].filter(Boolean).join(' ');

/**
 * The turn's key, judged on meaning: the model sentence is an example, never the required words. The subject must
 * point at the doer from the speaking role; an independent action also needs the self word bound to that person.
 */
export function youAndMeKey(item: YouAndMeChallenge): SpokenKey {
  const pronoun = expectedPronoun(item), swapped = pronoun === 'I' ? 'you' : 'I';
  const speaker = item.participants[item.speaker].name, listener = item.participants[1 - item.speaker].name;
  const actor = item.participants[item.actor].name;
  const subject = pronoun === 'I' ? 'I' : 'You';
  if (!independent(item)) {
    return { answer: modelSentence(item), alsoAccept: [],
      meaning: {
        idea: `${speaker}, the partner the learner plays, tells ${listener} that ${actor} ${item.action}, with "${pronoun}" as the subject.`,
        notIt: `a sentence with "${swapped}" as the subject, the name ${actor} or he or she in the subject place, `
          + 'a pronoun with no action, or the scene sentence said back',
      } };
  }
  const self = expectedReflexive(item), otherSelf = self === 'myself' ? 'yourself' : 'myself';
  return { answer: modelSentence(item), alsoAccept: [`${subject} ${item.action} ${self}.`],
    meaning: {
      idea: `${speaker}, the partner the learner plays, tells ${listener} that ${actor} ${item.action} with no help, `
        + `with "${pronoun}" as the subject and "${self}" for that same person.`,
      notIt: `a sentence with "${swapped}" as the subject, the name ${actor} or he or she in the subject place, `
        + 'a pronoun with no action, or the scene sentence said back',
    },
    signatureError: `A "${pronoun}" sentence with no self word, or with only "alone" or "without help", is wrong; so is "${pronoun}" with "${otherSelf}".` };
}

/**
 * A turn's known wrong answers, in precedence order, for the `spoken_miss` observer: the other partner's pronoun,
 * the doer's name, or "he"/"she" in the subject place. Concrete per turn: the names and the action.
 */
export function youAndMeSpokenMisses(item: YouAndMeChallenge): KnownMiss[] {
  const pronoun = expectedPronoun(item), swapped = pronoun === 'I' ? 'you' : 'I';
  const speaker = item.participants[item.speaker].name, listener = item.participants[1 - item.speaker].name;
  const actor = item.participants[item.actor];
  const fact = `${actor.name} ${item.action}. The learner is playing ${speaker}, talking to ${listener}, so the subject should be "${pronoun}".`;
  const rest = modelSentence(item).replace(/^(I|You) /, '');
  const heShe = /👧|👩|👵/.test(actor.emoji ?? '') ? 'She' : 'He';
  const pattern: Record<SpokenYouAndMeMiss, KnownMiss> = {
    swapped_pronoun: { id: 'swapped_pronoun', pattern: `${fact} The learner's sentence uses "${swapped}" as the subject instead, the word for the other partner.`,
      examples: [`${swapped === 'I' ? 'I' : 'You'} ${rest.replace(/\b(myself|yourself)\b/, swapped === 'I' ? 'myself' : 'yourself')}`] },
    said_name: { id: 'said_name', pattern: `${fact} The learner's sentence uses the name "${actor.name}" as the subject instead of "${pronoun}".`,
      examples: [`${actor.name} ${rest}`] },
    said_he_she: { id: 'said_he_she', pattern: `${fact} The learner's sentence uses "he" or "she" as the subject instead of "${pronoun}".`,
      examples: [`${heShe} ${rest}`] },
  };
  return [pattern.swapped_pronoun, pattern.said_name, pattern.said_he_she];
}

/** What is on screen for the tutor: who speaks, who listens, who acted. No model sentence is printed. */
export function youAndMeScene(item: YouAndMeChallenge): SceneOf {
  return { objects: [], facts: {
    speaker: item.participants[item.speaker].name,
    listener: item.participants[1 - item.speaker].name,
    actor: item.participants[item.actor].name,
    help: tutorRevealPolicy(item),
    constraints: 'No model sentence is printed.',
  } };
}

/** What "Hear the scene again" asks the tutor to say: the scene and the ask, never a model sentence. */
export const hearSceneRequest = (item: YouAndMeChallenge) =>
  `The learner asked to hear the scene again. Say only this, once: "${youAndMeAsk(item)}"`;

/** The journey's answers: the model sentence, or the same action with the pronoun swapped. */
export function youAndMeHarnessAnswers(item: YouAndMeChallenge): { correct: string; plainWrong: string } {
  const correct = modelSentence(item);
  const swapped = expectedPronoun(item) === 'I' ? correct.replace(/^I /, 'You ').replace('myself', 'yourself')
    : correct.replace(/^You /, 'I ').replace('yourself', 'myself');
  return { correct, plainWrong: swapped };
}
