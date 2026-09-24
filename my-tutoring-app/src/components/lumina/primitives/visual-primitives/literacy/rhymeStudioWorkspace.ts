/**
 * Rhyme studio on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C1). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer: yes or no (recognition), the rhyming choice (identification), any rhyme
 * (production), or a new rhyme for the family being collected (collection).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { rhymeStudioHarnessAnswers, type RhymeItem } from './rhymeStudioScript';

/** The ask, in the pack's words. The ending sound is never named: it is the answer's family. */
export function rhymeAsk(item: RhymeItem): string {
  switch (item.mode) {
    case 'recognition':
      return `Listen to these two words: ${item.targetWord}, ${item.comparisonWord}. Do they rhyme? Say yes or no.`;
    case 'identification':
      return `Listen to this word: ${item.targetWord}. Which word on the screen rhymes with ${item.targetWord}? Say it.`;
    case 'production':
      return `Listen to this word: ${item.targetWord}. Tell me a word that rhymes with ${item.targetWord}.`;
    case 'collection':
      return `Listen to this word: ${item.targetWord}. Say a new word that rhymes with ${item.targetWord}.`;
  }
}

/** `collected`: the family's words already credited, which a collection slot must not repeat. */
export function rhymeAssignment(item: RhymeItem, collected: readonly string[] = item.priorAcceptedWords): TeachingAssignment {
  const other = `, not ${item.targetWord} itself`;
  const expectedAnswer = item.mode === 'recognition'
    ? (item.doesRhyme ? `Yes: ${item.targetWord} and ${item.comparisonWord} rhyme.`
      : `No: ${item.targetWord} and ${item.comparisonWord} do not rhyme.`)
    : item.mode === 'identification'
      ? `${item.answer}, the choice that rhymes with ${item.targetWord}.`
      : item.mode === 'production'
        ? `Any real word that rhymes with ${item.targetWord} (ends in -${item.rime})${other}. A made-up word is not.`
        : `A real word that rhymes with ${item.targetWord} (ends in -${item.rime})${other}`
          + (collected.length ? ` and not one already collected (${collected.join(', ')}).` : '.');
  return { id: item.id, task: rhymeAsk(item), response: 'speech', expectedAnswer };
}

export interface RhymeView {
  /** Words of the family already credited, in slot order (collection). */
  collected: readonly string[];
  /** The rime is highlighted on the target card at this tier. */
  familyShown: boolean;
}

export function rhymeScene(item: RhymeItem, view: RhymeView): WorkspaceScene {
  const facts: Record<string, string> = {};
  if (item.mode === 'identification') {
    facts.choices = item.choices.map(c => c.word).join(', ');
    facts.namingChoices = item.namesChoices
      ? 'You may say the choices aloud; the learner cannot read them.'
      : 'The learner reads the choices on screen: do not read them aloud.';
  }
  if (item.mode === 'collection') {
    facts.slot = `${item.collectionSlot ?? 1} of ${item.collectionSize ?? 3}`;
    facts.collected = view.collected.length ? view.collected.join(', ') : 'none yet';
  }
  facts.constraints = 'The learner answers out loud. '
    + (item.mode === 'recognition' ? 'Both words are shown; which endings match is shown only after credit.'
      : item.mode === 'identification' ? 'The target and the choices are shown; the rhyming choice is marked only after credit.'
        : item.mode === 'production' ? 'Only the target word is shown; there are no choices.'
          : 'The target and the rhymes collected so far are shown; empty spots show no example.')
    + (view.familyShown && item.mode !== 'recognition' ? ' The ending of the target word is highlighted at this level.' : '')
    + ' Tapping the word card asks you to say the question again.';
  return { objects: [], facts };
}

/** What a tapped card asks the tutor to say: the question only, never which words rhyme. */
export const hearRhymeRequest = (item: RhymeItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${rhymeAsk(item)}" Never say which words rhyme or name the ending.`;

/** The journey's answers. Production and collection have no code-owned answer, so the journey cannot drive them. */
export function rhymeHarnessAnswers(item: RhymeItem): { correct: string; plainWrong: string } {
  if (item.mode === 'production' || item.mode === 'collection')
    throw new Error(`rhyme-studio ${item.mode} has no code-owned answer to drive`);
  const { correct, plainWrong } = rhymeStudioHarnessAnswers(item);
  return { correct, plainWrong };
}
