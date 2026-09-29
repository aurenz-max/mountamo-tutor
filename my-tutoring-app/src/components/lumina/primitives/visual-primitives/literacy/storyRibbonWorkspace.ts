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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, misses: storyRibbonSpokenMisses(item) };
}

/** What a wrong spoken account shows (handoff 20 Part B): which part of the account is missing or off. */
export type SpokenStoryRibbonMiss = 'labels_listed' | 'events_missing' | 'out_of_order' | 'tense_drift'
  | 'event_only' | 'no_connection';

export const STORY_RIBBON_MISSES: Record<StoryRibbonItem['mode'], readonly SpokenStoryRibbonMiss[]> = {
  tell_connected_account: ['labels_listed', 'events_missing', 'out_of_order'],
  tell_present_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  tell_future_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  tell_past_account: ['labels_listed', 'events_missing', 'out_of_order', 'tense_drift'],
  story_to_experience: ['event_only', 'no_connection'],
};

/** An item's known wrong accounts, in precedence order, for the `spoken_miss` observer. Concrete per item. */
export function storyRibbonSpokenMisses(item: StoryRibbonItem): KnownMiss[] {
  const events = item.challenge.events;
  const said = events.map(e => stop(e.modelSentence).replace(/\.$/, ''));
  const labels = events.map(e => e.pictureLabel);
  const pattern: Record<SpokenStoryRibbonMiss, () => KnownMiss> = {
    labels_listed: () => ({ id: 'labels_listed', pattern: `The learner names the pictures (${labels.join(', ')}) as a list, with no story told about them.`,
      examples: [labels.join(', ')] }),
    events_missing: () => ({ id: 'events_missing', pattern: 'The learner tells one or two of the three events and stops, leaving an event out.',
      examples: [`${said[0]}. ${said[1]}.`] }),
    out_of_order: () => ({ id: 'out_of_order', pattern: 'The learner tells all three events, but not in the story\'s order.',
      examples: [`${said[2]}. ${said[0]}. ${said[1]}.`] }),
    tense_drift: () => ({ id: 'tense_drift', pattern: `The learner tells the three events in order, but not all in ${TENSE[item.mode] ?? 'the item\'s time'}.` }),
    event_only: () => ({ id: 'event_only', pattern: 'The learner tells a story moment and gives no other experience.',
      examples: [`${said[0]}.`] }),
    no_connection: () => ({ id: 'no_connection', pattern: 'The learner gives a story moment and another experience, but never says how the two are alike.' }),
  };
  return STORY_RIBBON_MISSES[item.mode].map(id => pattern[id]());
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
