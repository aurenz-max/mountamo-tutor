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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
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
  const misses = sentenceSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken label shows (handoff 20 Part B; the lever table 2026-10-03 adds the last two). */
export type SpokenSentenceMiss = 'other_side' | 'part_of_speech' | 'confusable_label' | 'other_label' | 'describing_word'
  | 'named_the_side';

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: the other side (name-side);
 * a part of speech where the job was asked (name-role); the label the lesson pairs with the answer, then any other
 * label on the printed wall.
 */
export function sentenceSpokenMisses(item: SentenceAnalyzerItem): KnownMiss[] {
  const word = speakableWord(item.targetWord);
  if (item.action === 'name-side') {
    const side = item.answer.toLowerCase(), other = side === 'subject' ? 'predicate' : 'subject';
    return [{ id: 'other_side', pattern: `In "${item.sentence}", the word "${word}" is in the ${side}. The learner's answer is "${other}", the other side.`,
      examples: [other, `the ${other}`] }];
  }
  const about = item.action === 'name-type' ? `The sentence "${item.sentence}" is ${item.answer}.`
    : `In "${item.sentence}", the word "${word}" is ${item.action === 'name-role' ? 'the' : 'a'} ${item.answer}.`;
  const confusable = (CONFUSABLE_WITH[item.answer] ?? []).filter(label => item.wallLabels.includes(label));
  const others = item.wallLabels.filter(label => label !== item.answer && !confusable.includes(label));
  const quote = (xs: readonly string[]) => xs.map(x => `"${x}"`).join(' or ');
  return [
    ...(item.action === 'name-role' ? [{ id: 'part_of_speech', pattern: `${about} The learner's answer is a part of speech such as "noun" or "verb", not a job in the sentence.`,
      examples: ['noun', 'verb'] }] : []),
    ...(confusable.length ? [{ id: 'confusable_label', pattern: `${about} The learner's answer is ${quote(confusable)}, a different label that is often mixed up with ${item.answer}.`,
      examples: confusable.slice(0, 2) }] : []),
    ...(item.action === 'name-pos' && (item.answer === 'Adjective' || item.answer === 'Adverb') ? [{ id: 'describing_word',
      pattern: `${about} The learner's answer is "describing word", which names both adjective and adverb.`,
      examples: ['describing word', 'a describing word'] }] : []),
    ...(item.action === 'name-role' && item.answer !== 'Subject' && item.answer !== 'Predicate' ? [{ id: 'named_the_side',
      pattern: `${about} The learner's answer is "subject" or "predicate": the part of the sentence the word sits in, not its own job.`,
      examples: ['subject', 'predicate'] }] : []),
    ...(others.length ? [{ id: 'other_label', pattern: `${about} The learner's answer is another label from the printed wall: ${quote(others)}.`,
      examples: others.slice(-2) }] : []),
  ];
}

export function sentenceScene(item: SentenceAnalyzerItem, readsAloud: boolean): WorkspaceScene {
  const facts: Record<string, string> = {
    sentence: item.sentence,
    ...(item.targetIndex >= 0 ? { highlighted: `The word "${speakableWord(item.targetWord)}" is highlighted.` } : {}),
    ...(item.wallLabels.length ? { wall: `Printed on the word wall: ${item.wallLabels.join(', ')}.` } : {}),
  };
  facts.constraints = 'The learner answers out loud; no word of this sentence is labelled until the answer is credited.'
    + (readsAloud ? ' The learner is an early reader: read the sentence aloud when the ask carries it.' : '');
  return { objects: [], facts };
}

/** The journey's answers: the code-computed label, or a plain wrong one. */
export function sentenceJourneyAnswers(item: SentenceAnalyzerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = sentenceAnalyzerHarnessAnswers(item);
  return { correct, plainWrong };
}
