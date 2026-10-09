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
import type { KnownMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import {
  askFor,
  CHANGE_CATALOG,
  CHANGE_OPTIONS,
  matterExplorerHarnessAnswers,
  modelLine,
  PROPERTY_OPTIONS,
  type MatterExplorerItem,
  type ShapeBehaviour,
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
  const misses = matterSpokenMisses(item);
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer, ...(misses.length ? { misses } : {}) };
}

/** What a wrong spoken answer shows (handoff 20 Part B). */
export type SpokenMatterMiss = 'other_state' | 'said_object_back' | 'other_shape' | 'other_way' | 'said_change_back' | 'state_word';

const STATES = ['solid', 'liquid', 'gas'] as const;

/**
 * An item's known wrong answers, in precedence order, for the `spoken_miss` observer: another state word or the
 * object's name back (name_state, mystery_state); another of the offered cup behaviours, or a state word
 * (name_property); the other way, the change said back, or a state word (name_undo).
 */
export function matterSpokenMisses(item: MatterExplorerItem): KnownMiss[] {
  if (item.kind === 'name_state' || item.kind === 'mystery_state') {
    const others = STATES.filter(s => s !== item.answerState);
    const thing = item.kind === 'name_state' ? `The ${item.objectName} is a ${item.answerState}.` : `The secret thing is a ${item.answerState}.`;
    return [
      { id: 'other_state', pattern: `${thing} The learner's answer is ${others.map(s => `"${s}"`).join(' or ')}, another state.`, examples: [...others] },
      ...(item.kind === 'name_state' ? [{ id: 'said_object_back', pattern: `The learner says the object's name, "${item.objectName}", back and no state word.`, examples: [item.objectName] }] : []),
    ];
  }
  if (item.kind === 'name_property') {
    const offered = item.menu?.length ? item.menu : (Object.keys(PROPERTY_OPTIONS) as ShapeBehaviour[]);
    const others = offered.filter(s => s !== item.answerShape).map(s => PROPERTY_OPTIONS[s]);
    const fact = `The ${item.objectName} ${PROPERTY_OPTIONS[item.answerShape].phrase.replace(/^it /, '')}.`;
    return [
      { id: 'other_shape', pattern: `${fact} The learner's answer is another thing the question offered: ${others.map(o => `"${o.phrase}"`).join(' or ')}.`,
        examples: others.map(o => o.distinguisher) },
      { id: 'state_word', pattern: `${fact} The learner's answer is a state word ("solid", "liquid" or "gas"), not what it does in a cup.`,
        examples: [item.answerState] },
    ];
  }
  if (item.kind === 'name_undo' && item.answerUndo && item.change) {
    const right = CHANGE_OPTIONS[item.answerUndo], other = CHANGE_OPTIONS[item.answerUndo === 'can_go_back' ? 'changed_for_ever' : 'can_go_back'];
    const story = CHANGE_CATALOG[item.change].storyFor(item.objectName);
    const happened = story.split(' until ')[1] ?? story;
    const fact = `${story}: ${right.phrase}.`;
    return [
      { id: 'other_way', pattern: `${fact} The learner's answer is the other way: ${other.phrase}.`, examples: [other.distinguisher, other.alsoCounts[0]] },
      { id: 'said_change_back', pattern: `${fact} The learner says what happened ("${happened}") back, not whether it can go back.`, examples: [happened] },
      { id: 'state_word', pattern: `${fact} The learner's answer is a state word ("solid", "liquid" or "gas"), not whether it can go back.`, examples: ['solid', 'liquid'] },
    ];
  }
  return [];
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
