/**
 * Read aloud studio on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C7). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every scored item is
 * one printed line read aloud, judged word for word against the print (never how it sounded).
 * accuracy is a cold read; dialogue hears the line in the character's voice first. expression
 * runs three steps per line: a phrase plan (page work the activity commits, never graded), a
 * first read, then a reread after the tutor models the groups; only the reread is scored.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { markedGroups, phraseAsk, type StudioItem } from './readAloudPhrasing';
import { askFor } from './readAloudStudioScript';

/** The ask for this item, without the pack's "Your turn." hand-over. */
const ask = (item: StudioItem) => (item.step ? phraseAsk(item)
  : item.kind === 'accuracy' ? item.actionContract.instruction : askFor(item))
  .replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

export function readAloudAssignment(item: StudioItem): TeachingAssignment {
  if (item.step === 'mark') return { id: item.id, task: ask(item), response: 'gesture' };
  return { id: item.id, task: ask(item), response: 'speech',
    expectedAnswer: `The printed line read aloud, every word in order: "${item.text}". A self-corrected slip and slow `
      + 'sounding-out that lands on the right words count. A word skipped, added or read as a different word is wrong. '
      + (item.kind === 'dialogue' ? 'Saying the idea in other words is not reading it. ' : '')
      + 'How it sounds (phrasing, voice, speed) is never graded.' };
}

export function readAloudScene(item: StudioItem, breaks: readonly number[]): WorkspaceScene {
  const facts: Record<string, string> = { line: item.text };
  if (item.kind === 'dialogue' && item.speaker) facts.speaker = `${item.speaker} says the line.`;
  if (item.step === 'mark') facts.plan = `The learner's phrase marks so far: ${markedGroups(item.text, breaks).join(' / ')}`;
  if (item.step === 'reread') facts.model = `Model the groups in order: ${item.modelGroups.join(' / ')}`;
  facts.constraints = item.step === 'mark'
    ? 'The learner taps between words to mark pauses, then taps Use my phrase plan. Any plan is accepted: it is page '
      + 'work, not a test. You cannot tap.'
    : item.kind === 'accuracy' || item.step === 'first_read'
      ? 'A cold read: never say the line or any word of it before the learner reads it.'
      : 'Read the line aloud first as the ask says; then the learner reads it back.';
  return { objects: [], facts };
}

/** How a committed phrase plan reads to the tutor and the observer. */
export const describePhrasePlan = (item: StudioItem, breaks: readonly number[]) =>
  `Committed the phrase plan: ${markedGroups(item.text, breaks).join(' / ')}`;

/** The journey's reads: the printed line, or the line with one word dropped. */
export function readAloudJourneyAnswers(item: StudioItem): { correct: string; plainWrong: string } {
  const words = item.text.split(' ');
  return { correct: item.text, plainWrong: words.filter((_, i) => i !== Math.floor(words.length / 2)).join(' ') };
}
