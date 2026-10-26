/**
 * Read aloud studio on the shared tutor/JEV teaching workspace; its wiring is `readAloudStudio.card.ts` +
 * `readAloudStudio.boss.ts`. Pure: the component, the boss and the journey read the same items, keys and scene. Every scored item is
 * one printed line read aloud, judged word for word against the print (never how it sounded).
 * accuracy is a cold read; dialogue hears the line in the character's voice first. expression
 * runs three steps per line: a phrase plan (page work the activity commits, never graded), a
 * first read, then a reread after the tutor models the groups; only the reread is scored.
 */
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { bossAssignment } from '../../../components/live-activity/boss';
import type { WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { SpokenKey } from '../../../components/live-activity/spokenKey';
import { markedGroups, phraseAsk, studioItems, type StudioItem } from './readAloudPhrasing';
import { askFor, type ReadAloudLineLike, type ReadAloudMode } from './readAloudStudioScript';
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import { lineReadingMisses } from './spokenReadingMisses';

/** The items exactly as the component builds them. */
export const readAloudItems = (data: { lines?: ReadAloudLineLike[]; fluencyFocus?: ReadAloudMode }) =>
  studioItems(data.lines ?? [], data.fluencyFocus ?? 'accuracy');

/** The ask for this item, without the pack's "Your turn." hand-over. */
export const readAloudAsk = (item: StudioItem) => (item.step ? phraseAsk(item)
  : item.kind === 'accuracy' ? item.actionContract.instruction : askFor(item))
  .replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();
const ask = readAloudAsk;

/** The step an item is: expression's `mark`, `first_read` or `reread` (the card's steps); a plain read otherwise. */
export const readAloudStep = (item: StudioItem): string => item.step ?? item.kind;

/** A read's key: the printed line, word for word. The phrase plan is page work with no key. */
export function readAloudKey(item: StudioItem): SpokenKey | null {
  if (item.step === 'mark') return null;
  return { answer: item.text, alsoAccept: [],
    acceptRule: 'The printed line read aloud, every word in order. A self-corrected slip and slow sounding-out that lands '
      + 'on the right words count. How it sounds (phrasing, voice, speed) is never graded.',
    signatureError: 'A word skipped, added or read as a different word is wrong.'
      + (item.kind === 'dialogue' ? ' Saying the idea in other words is not reading it.' : '') };
}

/** What the ask says by design: the model a dialogue line and the expression reread carry before the learner reads. */
export const readAloudGiven = (item: StudioItem): string[] =>
  (item.kind === 'dialogue' || item.step === 'reread' ? [item.text] : []);

export function readAloudAssignment(item: StudioItem): TeachingAssignment {
  const key = readAloudKey(item);
  return bossAssignment(item.id, ask(item), key, key ? readAloudSpokenMisses(item) : []);
}

/**
 * A spoken read's known wrong answers (handoff 20 Part B), from the ids `READ_ALOUD_MISSES` declares: a printed word
 * left out, a word read as another, and on a dialogue line the idea said in other words. Phrasing is never a miss.
 */
export function readAloudSpokenMisses(item: StudioItem): KnownMiss[] {
  if (item.step === 'mark' || !item.text) return [];
  return lineReadingMisses(item.text, { skip: 'word_drop', paraphrase: item.kind === 'dialogue' });
}

export function readAloudScene(item: StudioItem, breaks: readonly number[]): WorkspaceScene {
  const facts: Record<string, string> = { line: item.text, ...(item.step ? { kind: item.step } : {}) };
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
