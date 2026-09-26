/**
 * di-spoken-practice on the shared tutor/JEV teaching workspace (rollout C6), through `DiTeachingStage`
 * like the other spoken DI packs. Every mode is one spoken answer; the tutor hears it and the observer
 * judges the tutor's completed feedback against the key below. Pure: the component and the journey read
 * the same assignment and scene.
 *
 * What the scripted judging contract carried that is task structure stays here, in the key: the spoken
 * alternates, the generated `acceptRule` (a right answer that does not look right) and `signatureError`
 * (a wrong answer that sounds right), the closed word menu of `compare_choice`, and for `explain_concept`
 * the one idea judged on meaning, with the class's own refusals (the instance read back, a bare name).
 * The sentinel openers, the fixed correction lines and the wait instruction were control protocol and are
 * gone. The generator gates (`findAnswerLeaks`, `findChoiceMenuDefects`, `findConceptDefects`) still
 * decide what ships, so the ask never contains the answer.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { DI_SPOKEN_PRACTICE_MODES } from './diSpokenPracticeModes';
import { conceptAffirmForm, numberWordFor, type SpokenPracticeItem } from './diSpokenPracticeScript';

const MODES = new Set<string>(DI_SPOKEN_PRACTICE_MODES.map(definition => definition.evalMode));
const quoted = (words: readonly string[]) => words.map(word => `"${word}"`).join(', ');

/** The ask the learner hears. The generator writes it and gates it against the answer. */
export const spokenPracticeAskFor = (item: SpokenPracticeItem): string => item.ask;

/** The key as the observer judges it: the answer, what else counts, and what does not. */
export function spokenPracticeKey(item: SpokenPracticeItem): string {
  const rule = item.acceptRule.trim() ? ` ${item.acceptRule.trim()}` : '';
  const miss = item.signatureError.trim() ? ` ${item.signatureError.trim()}` : '';
  if (item.mode === 'explain_concept') {
    const examples = [item.expectedAnswer, ...item.alternates].map(a => a.trim()).filter(Boolean);
    return `An explanation in the learner's own words that means: "${conceptAffirmForm(item.conceptStatement ?? '')}" `
      + `For example ${quoted(examples)}, or any wording with that idea. Judge the meaning, not the words: `
      + 'the same words inside a sentence that means the opposite or a different idea are wrong, and so are '
      + `"${item.stimulusText}" read back, a bare number, or just the name of what is shown.${rule}${miss}`;
  }
  const also = item.alternates.length ? ` (also accept ${quoted(item.alternates)})` : '';
  const menu = item.mode === 'compare_choice' && item.choices?.length
    ? ` The learner chooses one word from ${quoted(item.choices)}; any other word does not answer the question.` : '';
  return `"${item.expectedAnswer}"${also}.${menu}${rule}${miss}`;
}

export function spokenPracticeAssignment(item: SpokenPracticeItem): TeachingAssignment {
  return { id: item.id, task: spokenPracticeAskFor(item), response: 'speech', expectedAnswer: spokenPracticeKey(item) };
}

/** What the screen shows, without the answer: a count item never prints its numeral, a picture to name is
 *  not labeled, and a listen-only item prints nothing (the ask carries it). */
function drawn(item: SpokenPracticeItem): { label: string; constraints: string } {
  switch (item.stimulusKind) {
    case 'text':
      return item.answerSource === 'decode'
        ? { label: `the printed text "${item.stimulusText}", which the learner reads aloud`,
          constraints: 'The learner reads the printed text aloud; reading it is the whole task.' }
        : { label: `the printed "${item.stimulusText}"`,
          constraints: 'The learner answers aloud. The answer is not printed.' };
    case 'emoji':
      return { label: 'one unlabeled picture', constraints: 'The learner answers aloud. The picture has no label.' };
    case 'pair':
      return { label: `two unlabeled pictures side by side: ${item.stimulusText} and ${item.stimulusText2 ?? ''}`,
        constraints: `The learner says one word from ${quoted(item.choices ?? [])}. The pictures have no labels, `
          + 'so the learner hears their names from you.' };
    case 'objects':
      return { label: `a group of identical ${item.stimulusText} pictures`,
        constraints: 'The learner counts the pictures and says how many aloud. No numeral is shown.' };
    case 'none':
    default:
      return { label: 'nothing printed', constraints: 'Nothing is printed: the learner hears the question from you and answers aloud.' };
  }
}

export function spokenPracticeScene(item: SpokenPracticeItem): WorkspaceScene {
  const { label, constraints } = drawn(item);
  return {
    objects: [{ id: 'stimulus', selected: false, group: 'assignment target', label }],
    facts: { kind: item.mode, constraints },
  };
}

/** The journey's answers: the key's own words, or a plainly different answer of the same kind. */
export function diSpokenPracticeHarnessAnswers(item: SpokenPracticeItem): { correct: string; plainWrong: string } {
  if (item.mode === 'explain_concept') {
    return { correct: item.conceptStatement ?? item.expectedAnswer, plainWrong: "I don't know" };
  }
  if (item.mode === 'count_and_say') {
    const n = item.stimulusCount;
    return { correct: item.expectedAnswer, plainWrong: numberWordFor(n >= 2 ? n - 1 : n + 1) };
  }
  if (item.mode === 'compare_choice') {
    const other = (item.choices ?? []).find(choice => choice.toLowerCase() !== item.expectedAnswer.toLowerCase());
    return { correct: item.expectedAnswer, plainWrong: other ?? 'bigger' };
  }
  return { correct: item.expectedAnswer, plainWrong: item.expectedAnswer.toLowerCase() === 'banana' ? 'rocket' : 'banana' };
}

/** An item the stage can ask: a known mode, an ask, a key, and pictures to count on a counting item. */
export const spokenPracticeItemValid = (item: SpokenPracticeItem) =>
  !!item && typeof item.id === 'string' && MODES.has(item.mode)
    && typeof item.ask === 'string' && !!item.ask.trim()
    && typeof item.expectedAnswer === 'string' && !!item.expectedAnswer.trim()
    && (item.stimulusKind !== 'objects' || (Number.isInteger(item.stimulusCount) && item.stimulusCount > 0))
    && (item.mode !== 'explain_concept' || !!item.conceptStatement?.trim());
