/**
 * Story ribbon on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C3). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken account: the three pictured events told in order (in the item's time for the tense
 * modes), or one story moment connected to another experience. Arranging the picture cards is
 * a planning aid; it is never graded.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor as ask, storyRibbonHarnessAnswers, type StoryRibbonItem } from './storyRibbonScript';
import { normalizeSupportTier, tutorRevealPolicy } from './storyRibbonSupport';

const stop = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

const TENSE: Record<string, string> = {
  tell_present_account: 'present time, as if it is happening today',
  tell_future_account: 'future time, as if it will happen tomorrow',
  tell_past_account: 'past time, as if it happened yesterday',
};

export function storyRibbonAssignment(item: StoryRibbonItem): TeachingAssignment {
  const [one, two, three] = item.challenge.events.map(e => stop(e.modelSentence));
  const events = `The three events, in order: 1) ${one} 2) ${two} 3) ${three}`;
  const expectedAnswer = item.mode === 'story_to_experience'
    ? `${events} Credit a reply that names or describes one of these events, gives another experience (done, seen, heard `
      + 'about or imagined), and says how the two connect. An event alone, an experience alone, or a connection with no '
      + 'reason is not it. Never judge whether a memory is true.'
    : `${events} Credit one connected account of all three events in this order, in the learner's own words and child `
      + `grammar${TENSE[item.mode] ? `, told consistently in ${TENSE[item.mode]}` : ' (any consistent tense)'}. Picture `
      + 'labels listed without a story, one or two events, the wrong order, or a different story is not it. "First, next, '
      + 'last" is not required.';
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
}

export function storyRibbonScene(item: StoryRibbonItem): WorkspaceScene {
  const tier = normalizeSupportTier(item.challenge.supportTier);
  const c = item.challenge;
  return { objects: [], facts: {
    story: `${c.title}: ${c.characterName} ${c.characterEmoji}, ${c.setting}`,
    // Alphabetical, so the list never gives the story order.
    pictures: c.events.map(e => e.pictureLabel).sort((a, b) => a.localeCompare(b)).join('; '),
    ...(c.timeCue ? { timeCue: c.timeCue } : {}),
    revealPolicy: tutorRevealPolicy(item.mode, tier),
    constraints: item.mode === 'story_to_experience'
      ? 'The learner taps one picture to choose a moment, then tells the connection out loud. The tap is not graded.'
      : 'The picture cards start mixed up; the learner may tap two to swap them. Only the spoken story is judged, never the card order.',
  } };
}

/** What "Hear the directions again" asks the tutor to say: the directions only, never an event. */
export const hearDirectionsRequest = (item: StoryRibbonItem) =>
  `The learner asked to hear the directions again. Say only this, once: "${ask(item)}" Do not name or describe any event.`;

/** The journey's answers: the model account, or one picture label said alone. */
export function storyRibbonJourneyAnswers(item: StoryRibbonItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = storyRibbonHarnessAnswers(item);
  return { correct, plainWrong };
}
