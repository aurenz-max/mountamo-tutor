/**
 * Sentence analyzer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C7). Its only teaching path: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken grammar label computed by the build gates: a word's part of speech (name-pos), its job
 * in the sentence (name-role), whether it sits in the complete subject or the predicate
 * (name-side), or the kind of sentence (name-type). The asked word is highlighted on screen; at
 * the band floor the ask carries the sentence for the tutor to read.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  askFor,
  CONFUSABLE_WITH,
  POS_ALTERNATES,
  ROLE_ALTERNATES,
  sentenceAnalyzerHarnessAnswers,
  speakableWord,
  type PosLabel,
  type RoleLabel,
  type SentenceAnalyzerItem,
} from './sentenceAnalyzerScript';

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: SentenceAnalyzerItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

const quoted = (words: readonly string[]) => words.map(w => `"${w}"`).join(', ');

export function sentenceAssignment(item: SentenceAnalyzerItem): TeachingAssignment {
  let expectedAnswer: string;
  if (item.action === 'name-side') {
    const other = item.answer === 'Subject' ? 'predicate' : 'subject';
    expectedAnswer = `${item.answer.toLowerCase()}: "${speakableWord(item.targetWord)}" is in the ${item.answer.toLowerCase()} `
      + `of "${item.sentence}". "${other}" is wrong. Small words and describing words in front of the naming word belong to `
      + 'the complete subject; judge against this answer, not a re-reading.';
  } else {
    const alternates = item.action === 'name-pos' ? POS_ALTERNATES[item.answer as PosLabel] ?? []
      : item.action === 'name-role' ? ROLE_ALTERNATES[item.answer as RoleLabel] ?? [] : [];
    const confusable = (CONFUSABLE_WITH[item.answer] ?? []).filter(label => item.wallLabels.includes(label));
    expectedAnswer = `${item.answer}${alternates.length ? `, or the classroom name ${quoted(alternates)}` : ''}.`
      + (confusable.length ? ` ${quoted(confusable)} are different answers and wrong here.` : '')
      + (item.action === 'name-role' ? ' A part of speech ("noun", "verb") answers a different question and is wrong.' : '')
      + ' Any other grammar label is wrong.';
  }
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
}

export function sentenceScene(item: SentenceAnalyzerItem, readsAloud: boolean): WorkspaceScene {
  const facts: Record<string, string> = {
    sentence: item.sentence,
    ...(item.targetIndex >= 0 ? { highlighted: `The word "${speakableWord(item.targetWord)}" is highlighted.` } : {}),
    ...(item.wallLabels.length ? { wall: `Printed on the word wall: ${item.wallLabels.join(', ')}.` } : {}),
  };
  facts.constraints = 'The learner answers out loud; no word is coloured or labelled until the answer is credited.'
    + (readsAloud ? ' The learner is an early reader: read the sentence aloud when the ask carries it.' : '');
  return { objects: [], facts };
}

/** The journey's answers: the code-computed label, or a plain wrong one. */
export function sentenceJourneyAnswers(item: SentenceAnalyzerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = sentenceAnalyzerHarnessAnswers(item);
  return { correct, plainWrong };
}
