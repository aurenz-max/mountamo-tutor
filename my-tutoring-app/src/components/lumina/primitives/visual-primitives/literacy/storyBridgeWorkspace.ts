/**
 * Story bridge on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C3). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Two read-aloud
 * stories stay on screen. Match characters, match settings, the picture Venn diagram and
 * event sequences are taps the activity checks; say alike, say different and compare big
 * ideas are spoken comparisons the observer judges against a reference and the two evidence
 * sentences.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../../../components/live-activity/runtime/sceneFacts';
import {
  askFor,
  choiceLabel,
  evidenceFor,
  storiesLine,
  storyBridgeHarnessAnswers,
  storyText,
  type StoryBridgeItem,
} from './storyBridgeScript';
import type { StoryBridgeStory } from './StoryBridge';

/** One story as the tutor reads it, split under the observer's fact cap. */
const storyFacts = (key: string, story: StoryBridgeStory) => textFacts(key, `${story.title}: ${storyText(story)}`);

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: StoryBridgeItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').trim();

const COMPARISON: Record<string, string> = {
  say_alike: 'Any short, true way the two friends are alike counts, not only the reference wording',
  say_different: 'Any short, true way that tells the two friends apart counts, not only the reference wording',
  main_idea_compare: 'Any defensible way the two big ideas are alike or different counts, not only the reference wording',
};

export function storyBridgeAssignment(item: StoryBridgeItem): TeachingAssignment {
  if (item.answerKind === 'gesture') return { id: item.id, task: ask(item), response: 'gesture' };
  const evidence = evidenceFor(item);
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `A comparison across both stories. Reference: "${item.comparisonSummary}". ${COMPARISON[item.mode]}. `
      + `Story one says: "${evidence.storyA}" Story two says: "${evidence.storyB}" A detail about only one story is `
      + 'not a comparison. Titles, names and full sentences are not required.' };
}

export function storyBridgeScene(item: StoryBridgeItem): WorkspaceScene {
  // Story one and two in the order the tutor reads them (`storiesLine`).
  const [first, second] = item.storyA.id < item.storyB.id ? [item.storyA, item.storyB] : [item.storyB, item.storyA];
  const facts: Record<string, string> = {
    ...storyFacts('storyOne', first),
    ...storyFacts('storyTwo', second),
    shown: 'Both story pictures with their titles'
      + (['match_character', 'say_alike', 'say_different', 'venn_place'].includes(item.mode) ? ', and each story\'s friends' : '')
      + (item.mode === 'venn_place' ? `, and the detail "${item.vennDetail}"` : '')
      + (item.mode === 'sequence_two' ? ', and the story one event picture' : '') + '.',
  };
  if (item.answerKind === 'gesture') {
    facts.choices = item.choiceIds.map(id => choiceLabel(item, id)).join(', ');
    facts.constraints = 'The learner answers by tapping a choice; the activity checks the tap. You cannot tap. Do not '
      + 'say which choice is right before the learner tries.';
  } else {
    facts.constraints = 'The learner says a comparison out loud. The evidence from both stories appears only after credit.';
  }
  return { objects: [], facts };
}

/** How a tap reads to the tutor and the observer: the choice tapped, never the key. */
export const describeStoryBridgeTap = (item: StoryBridgeItem, choiceId: string) => `Tapped ${choiceLabel(item, choiceId)}.`;

/** What the replay button asks the tutor to say: both stories and the question, never the answer. */
export const hearStoriesRequest = (item: StoryBridgeItem) =>
  `The learner asked to hear both stories again. Read them aloud, then ask again: "${storiesLine(item)}${ask(item)}" `
  + 'Never say the comparison or which choice is right.';

/** The journey's answers: the reference comparison said, or the right and a wrong choice's Pip object to tap. */
export function storyBridgeJourneyAnswers(item: StoryBridgeItem):
  { correct: string; plainWrong: string; tapped?: { correct: string; wrong: string } } {
  const { correct, plainWrong, tapped } = storyBridgeHarnessAnswers(item);
  return { correct, plainWrong,
    ...(tapped ? { tapped: { correct: `choice-${tapped.correct}`, wrong: `choice-${tapped.wrong}` } } : {}) };
}
