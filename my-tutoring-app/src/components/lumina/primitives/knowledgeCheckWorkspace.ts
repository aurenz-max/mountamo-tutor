/**
 * Knowledge check on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C8). A set whose every problem yields a spoken or
 * touched item runs only here (the scripted runner was retired, LA-14, user ruling 09-23: one
 * path); a set the build gates cannot run that way stays the tap flow (`KnowledgeCheckTapFlow`).
 *
 * Pure: the component and the journey read the same assignment and scene. Seven item kinds are
 * spoken (true or false, a choice from a spoken menu, a match partner, a sort group, a missing
 * word, a production answer, a count); two are touched and checked in code (`choice_tap`, an
 * unsayable menu, and `point_to`, a sign in a printed number sentence), so their keys never reach
 * the tutor. The keys carry what the pack's judging contracts carried: the accepted short forms
 * and each kind's signature miss.
 */
import type { TeachingAssignment, WorkspaceScene } from '../components/live-activity/runtime/useTeachingWorkspace';
import { textFacts } from '../components/live-activity/runtime/sceneFacts';
import type { ProblemData } from '../types';
import {
  askFor,
  correctOptionText,
  evidenceDescription,
  itemsFromProblems,
  knowledgeCheckHarnessAnswers,
  stimulusDescription,
  type KnowledgeCheckItem,
} from './knowledgeCheckScript';

/** The items a set asks, built by the pack's gates: shared by the component, the adapter and the journey. */
export const knowledgeCheckItems = (data: { problems?: ProblemData[] }) => itemsFromProblems(data.problems ?? []);

/** The pack's own ask, without its "Your turn." and "Listen:" hand-over words. */
const ask = (item: KnowledgeCheckItem) =>
  askFor(item).replace(/^Your turn\.\s*/, '').replace(/^Listen:\s*/, '').replace(/\s+/g, ' ').trim();

const stripEnd = (text: string) => text.trim().replace(/[.!?]+$/, '');

function key(item: KnowledgeCheckItem): string | undefined {
  const options = item.options ?? [];
  switch (item.kind) {
    case 'choice_tap':
    case 'point_to':
      return undefined; // checked by the activity
    case 'true_false':
      return `${item.correctBool ? 'true' : 'false'}: the statement is ${item.correctBool ? 'true' : 'false'}. `
        + `${item.correctBool ? '"yes", "yeah", "right", "it is"' : '"no", "nope", "wrong", "it is not"'} count too, alone or in `
        + 'a short sentence. The statement said back gives no verdict and is not it.';
    case 'choice':
    case 'match':
    case 'sort': {
      const index = options.findIndex(o => o.id === item.correctOptionId);
      const others = options.filter(o => o.id !== item.correctOptionId).map(o => `"${stripEnd(o.text)}"`).join(', ');
      return `"${stripEnd(correctOptionText(item))}" (choice ${index + 1} of ${options.length}). The whole choice, the part that `
        + 'tells it apart from the others, what its picture shows, or its place in the list ("the second one") all count. '
        + `${others} ${options.length > 2 ? 'are' : 'is'} wrong, and so is naming two choices or hedging between them.`
        + (item.kind === 'sort' ? ` "${item.focusText}" said back names no group and is not it.`
          : item.kind === 'match' ? ` "${item.focusText}" said back names no partner and is not it.` : '');
    }
    case 'blank':
      return `"${item.answerWord}", on its own, in a phrase, or in the whole sentence said back with it in place. Another word `
        + 'from the word bank that does not fit the sentence is wrong, and so is the sentence said back with "hmm" still in it.';
    case 'say_it': {
      const letter = item.stimulus?.insetType === 'glyph-card' && item.stimulus.glyphKind === 'letter';
      const forms = [item.expectedAnswer ?? '', ...(item.alternates ?? [])].filter(Boolean).map(a => `"${a}"`).join(', ');
      return `${forms}, alone or in a short sentence.${letter ? ' The letter\'s sound counts too.' : ''} A different name, number `
        + 'or word is wrong, however confident.';
    }
    case 'how_many': {
      const digits = (item.alternates ?? []).find(a => /^\d+$/.test(a));
      return `"${item.expectedAnswer}"${digits ? ` (${digits})` : ''}, alone or in a short sentence. Counting aloud is thinking: `
        + 'the number the learner stops on is the answer. A different number is wrong'
        + (item.stimulus?.insetType === 'arrangement' && (item.stimulus.removed ?? 0) > 0
          ? `, including ${item.stimulus.count}, the count before any were taken away.` : '.');
    }
  }
}

export function knowledgeCheckAssignment(item: KnowledgeCheckItem): TeachingAssignment {
  const expectedAnswer = key(item);
  return expectedAnswer
    ? { id: item.id, task: ask(item), response: 'speech', expectedAnswer }
    : { id: item.id, task: ask(item), response: 'gesture' };
}

export function knowledgeCheckScene(item: KnowledgeCheckItem, preReader: boolean): WorkspaceScene {
  const facts: Record<string, string> = {};
  const shown = `${stimulusDescription(item)}${evidenceDescription(item)}`.trim();
  if (shown) Object.assign(facts, textFacts('shown', shown));
  const options = item.options ?? [];
  if (options.length) {
    facts[item.kind === 'sort' ? 'groups' : 'choices'] = `Printed ${item.kind === 'sort' ? 'groups' : 'choices'}, in order: `
      + options.map((o, i) => `${i + 1}. ${stripEnd(o.text)}`).join('; ') + '.';
  }
  if (item.focusText) facts.focus = `The card being ${item.kind === 'sort' ? 'sorted' : 'matched'}: ${item.focusText}.`;
  if (item.wordBank?.length) facts.wordBank = `Word bank: ${item.wordBank.join(', ')}.`;
  facts.constraints = (item.kind === 'choice_tap' ? 'The learner answers by touching one choice; the activity checks the touch.'
    : item.kind === 'point_to' ? 'The learner answers by touching one sign in the number sentence; the activity checks the touch.'
      : 'The learner answers out loud; nothing marks the answer until it is credited.')
    + (preReader ? ' The learner does not read yet: read the question and every choice aloud.' : '');
  return { objects: [], facts };
}

/** The journey's answers: the pack's right and plainly wrong answers; a touched kind is the label to press. */
export function knowledgeCheckJourneyAnswers(item: KnowledgeCheckItem): { correct: string; plainWrong: string; press?: { correct: string; wrong: string } } {
  const answers = knowledgeCheckHarnessAnswers(item);
  if (item.kind === 'choice_tap' && answers.placed) {
    const options = item.options ?? [];
    return { ...answers, press: { correct: options[answers.placed.correct].text, wrong: options[answers.placed.wrong].text } };
  }
  if (item.kind === 'point_to' && answers.placed && item.stimulus?.insetType === 'number-sentence') {
    // The token buttons are labelled with the printed sign itself.
    const tokens = item.stimulus.tokens;
    return { ...answers, press: { correct: tokens[answers.placed.correct].text, wrong: tokens[answers.placed.wrong].text } };
  }
  return { correct: answers.correct, plainWrong: answers.plainWrong };
}
