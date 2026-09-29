/**
 * You & Me on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch B3). Its only teaching path: the scripted runner
 * was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every turn is one
 * spoken sentence, judged on who the subject pronoun points at from the speaking role.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import type { YouAndMeChallenge } from './YouAndMe';
import { expectedPronoun, expectedReflexive, modelSentence, sceneStatement, taskPrompt } from './youAndMeScript';
import { supportFor, tutorRevealPolicy } from './youAndMeSupport';

/** The pack's own ask: the scene, then the role to play (and the tier's preparation line). */
export const youAndMeAsk = (item: YouAndMeChallenge) =>
  [sceneStatement(item), taskPrompt(item), supportFor(item).preparation].filter(Boolean).join(' ');

export function youAndMeAssignment(item: YouAndMeChallenge): TeachingAssignment {
  const self = item.type === 'describe_independent_action' ? ` and "${expectedReflexive(item)}" for the same person` : '';
  const misses = youAndMeSpokenMisses(item);
  return { id: item.id, task: youAndMeAsk(item), response: 'speech',
    expectedAnswer: `A sentence about the action that uses "${expectedPronoun(item)}" as the subject${self}, `
      + `for example "${modelSentence(item)}"`, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken sentence shows (handoff 20 Part B): which word stands as the subject. */
export type SpokenYouAndMeMiss = 'swapped_pronoun' | 'said_name' | 'said_he_she';

/**
 * A turn's known wrong answers, in precedence order, for the `spoken_miss` observer: the other partner's pronoun,
 * the doer's name, or "he"/"she" in the subject place. Concrete per turn: the names and the action.
 */
export function youAndMeSpokenMisses(item: YouAndMeChallenge): KnownMiss[] {
  const pronoun = expectedPronoun(item), swapped = pronoun === 'I' ? 'you' : 'I';
  const speaker = item.participants[item.speaker].name, listener = item.participants[1 - item.speaker].name;
  const actor = item.participants[item.actor];
  const fact = `${actor.name} ${item.action}. The learner is playing ${speaker}, talking to ${listener}, so the subject should be "${pronoun}".`;
  const model = modelSentence(item);
  const rest = model.replace(/^(I|You) /, '');
  const heShe = /👧|👩|👵/.test(actor.emoji ?? '') ? 'She' : 'He';
  return [
    { id: 'swapped_pronoun', pattern: `${fact} The learner's sentence uses "${swapped}" as the subject instead, the word for the other partner.`,
      examples: [`${swapped === 'I' ? 'I' : 'You'} ${rest.replace(/\b(myself|yourself)\b/, swapped === 'I' ? 'myself' : 'yourself')}`] },
    { id: 'said_name', pattern: `${fact} The learner's sentence uses the name "${actor.name}" as the subject instead of "${pronoun}".`,
      examples: [`${actor.name} ${rest}`] },
    { id: 'said_he_she', pattern: `${fact} The learner's sentence uses "he" or "she" as the subject instead of "${pronoun}".`,
      examples: [`${heShe} ${rest}`] },
  ];
}

export function youAndMeScene(item: YouAndMeChallenge): WorkspaceScene {
  return { objects: [], facts: {
    speaker: item.participants[item.speaker].name,
    listener: item.participants[1 - item.speaker].name,
    actor: item.participants[item.actor].name,
    help: tutorRevealPolicy(item),
    constraints: 'The learner plays the speaker and tells the listener what happened, out loud. No model sentence '
      + 'is printed.',
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
