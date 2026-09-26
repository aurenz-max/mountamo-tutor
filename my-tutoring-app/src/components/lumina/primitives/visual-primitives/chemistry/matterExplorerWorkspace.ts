/**
 * Matter explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C5). Its only teaching path for challenges: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path). A payload with no askable challenge
 * stays the ungraded exploration shelf.
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer, computed in code from the object: its state (name_state, and mystery_state
 * from clues with the object withheld), what it does in a cup (name_property), or whether an
 * everyday change can go back (name_undo, read from CHANGE_CATALOG, never the payload).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  askFor,
  CHANGE_CATALOG,
  CHANGE_OPTIONS,
  matterExplorerHarnessAnswers,
  modelLine,
  PROPERTY_OPTIONS,
  type MatterExplorerItem,
} from './matterExplorerScript';

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: MatterExplorerItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

const shortForms = (o: { distinguisher: string; alsoCounts: string[] }) => [o.distinguisher, ...o.alsoCounts].map(w => `"${w}"`).join(', ');

export function matterAssignment(item: MatterExplorerItem): TeachingAssignment {
  let expectedAnswer: string;
  switch (item.kind) {
    case 'name_state':
      expectedAnswer = `${item.answerState}. "A ${item.answerState}" counts. Saying the object's own name back is not it, and neither is another state word.`;
      break;
    case 'mystery_state':
      expectedAnswer = `${item.answerState}. "A ${item.answerState}" counts. Guessing what the secret thing is, with no state word, is not it.`;
      break;
    case 'name_property': {
      const o = PROPERTY_OPTIONS[item.answerShape];
      expectedAnswer = `${o.phrase}. The short forms ${shortForms(o)} count. Naming the state ("${item.answerState}") answers a different question and is not it.`;
      break;
    }
    case 'name_undo': {
      const o = CHANGE_OPTIONS[item.answerUndo!];
      expectedAnswer = `${o.phrase}. The short forms ${shortForms(o)} count. A state word, or saying the change back ("it melted"), is not it.`;
      break;
    }
  }
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
}

export function matterScene(item: MatterExplorerItem): WorkspaceScene {
  const facts: Record<string, string> = {
    shown: item.kind === 'mystery_state' ? `A covered box. The clues are printed beside it: ${(item.clues ?? []).join('; ')}.`
      : item.kind === 'name_undo' ? `The ${item.objectName}, with the line "${CHANGE_CATALOG[item.change!].storyFor(item.objectName)}."`
        : `A picture of the ${item.objectName}.`,
  };
  // The tier lever: below hard the rule that names every option may be said before the ask.
  if (item.tier !== 'hard') facts.rule = modelLine(item);
  facts.constraints = 'The learner answers out loud; nothing on screen classifies the object until the answer is credited.'
    + (item.kind === 'mystery_state' ? ' The secret thing stays unnamed until then.' : '');
  return { objects: [], facts };
}

/** The journey's answers: the code-computed answer, or a plain wrong one. */
export function matterJourneyAnswers(item: MatterExplorerItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = matterExplorerHarnessAnswers(item);
  return { correct, plainWrong };
}
