/**
 * Oral sentence studio on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C7). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * original spoken sentence, an open answer set, so the observer receives the pack's rubric and
 * its three private example sentences as anchors, never as a key: describe the pictured scene
 * (describe_scene), say the sentence for the next step of a class writing piece
 * (guided_writing_rehearsal), or reuse two story words in a new sentence (use_story_words).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, oralSentenceHarnessAnswers, type OralSentenceStudioItem } from './oralSentenceStudioScript';

const RULE: Record<OralSentenceStudioItem['mode'], (item: OralSentenceStudioItem) => string> = {
  describe_scene: () => 'tells a relevant actor or thing and an action or state from the pictured scene',
  guided_writing_rehearsal: item => `tells the pictured step that comes now (not the step already written, `
    + `"${item.challenge.priorStepLabel}"), with "${item.challenge.targetWords[0]}" showing the order`,
  use_story_words: () => 'is the learner’s own new sentence (it may be about anything), not a story sentence said '
    + 'back or nearly copied, with both words keeping their story meanings',
};

export function oralSentenceAssignment(item: OralSentenceStudioItem): TeachingAssignment {
  const [first, second] = item.challenge.targetWords;
  const examples = item.challenge.acceptedSentences.map(s => `"${s}"`).join(' ');
  return { id: item.id, task: askFor(item), response: 'speech',
    expectedAnswer: `Any one complete child sentence that ${RULE[item.mode](item)} and uses both "${first}" and "${second}" `
      + 'with meanings that make sense. Judge meaning and use, never wording: paraphrase, pronouns, inflections, extra '
      + `detail and child grammar count. Valid examples, not a key: ${examples} A fragment, the two words listed, a `
      + 'definition, a sentence missing either word or using one with the wrong meaning is not it.' };
}

export function oralSentenceScene(item: OralSentenceStudioItem): WorkspaceScene {
  const c = item.challenge;
  const facts: Record<string, string> = {
    shown: `A picture of "${c.sceneTitle}": ${c.actorLabel}, ${c.actionLabel}, ${c.objectLabel}, ${c.settingLabel}.`,
    words: `Printed: "${c.targetWords[0]}" (${c.wordMeanings[0]}) and "${c.targetWords[1]}" (${c.wordMeanings[1]}).`,
  };
  if (item.mode === 'use_story_words' && c.storyText) facts.story = `Printed and read aloud: ${c.storyText}`;
  if (item.mode === 'guided_writing_rehearsal' && c.priorStepLabel) facts.alreadyWritten = c.priorStepLabel;
  facts.constraints = 'The learner says one sentence out loud. No example sentence is shown until the sentence is credited.';
  return { objects: [], facts };
}

/** The journey's answers: the first valid example, or the pack's signature wrong one. */
export function oralSentenceJourneyAnswers(item: OralSentenceStudioItem): { correct: string; plainWrong: string } {
  const answers = oralSentenceHarnessAnswers(item);
  return { correct: answers.valid[0], plainWrong: item.mode === 'use_story_words' ? answers.unrelated : answers.fragment };
}
