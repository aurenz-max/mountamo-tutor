/**
 * States of matter on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C5). Its only teaching path for challenges: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path). A payload with no askable challenge
 * stays the ungraded free particle sim.
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer computed from the substance table: the state its particles show (observe), the
 * state it will reach or the change it goes through (predict), or which of two substances melts
 * first or stays solid (compare).
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import {
  askFor,
  CHANGE_VERB,
  modelLine,
  stateAt,
  stateSynonymsFor,
  statesOfMatterHarnessAnswers,
  type StatesOfMatterItem,
} from './statesOfMatterScript';

/** The pack's own ask, without its "Your turn." hand-over. */
const ask = (item: StatesOfMatterItem) => askFor(item).replace(/\s*Your turn\.\s*/, ' ').replace(/\s+/g, ' ').trim();

export function statesAssignment(item: StatesOfMatterItem): TeachingAssignment {
  let expectedAnswer: string;
  switch (item.kind) {
    case 'name_state':
    case 'predict_state': {
      const state = item.answerState!;
      const synonyms = stateSynonymsFor(item.substance!, state);
      const also = synonyms.length ? ` For ${item.substance!.name}, ${synonyms.map(w => `"${w}"`).join(' and ')} also count.` : '';
      const miss = item.kind === 'name_state' ? ` Saying "${item.substance!.name}" back is not it.`
        : item.startState === state ? ' The temperature never crosses a threshold, so the state does not change.'
          : ` "${item.startState}", the state it is in now, is not it.`;
      expectedAnswer = `${state}. "A ${state}" counts.${also}${miss}`;
      break;
    }
    case 'predict_change': {
      const change = item.answerChange!;
      expectedAnswer = `${change}. "${CHANGE_VERB[change]}" counts. The state it ends up in `
        + `("${stateAt(item.substance!, item.targetTemp!)}") is not it, and neither is the opposite change.`;
      break;
    }
    case 'melt_first':
    case 'stay_solid': {
      const [a, b] = item.pair!;
      const other = item.answerName === a.name ? b.name : a.name;
      expectedAnswer = `${item.answerName}. The name alone counts. "${other}" is not it.`;
      break;
    }
  }
  return { id: item.id, task: ask(item), response: 'speech', expectedAnswer };
}

export function statesScene(item: StatesOfMatterItem): WorkspaceScene {
  const facts: Record<string, string> = {
    shown: item.pair ? `Two beakers with their particle views: ${item.pair[0].name} and ${item.pair[1].name}.`
      : `A beaker of ${item.substance!.name} with its particle view.`,
  };
  // The tier lever: below hard the rule may be said before the ask.
  if (item.tier !== 'hard') facts.rule = modelLine(item);
  facts.constraints = 'The learner answers out loud. No temperature, state label or particle caption is printed until the '
    + 'answer is credited' + (item.kind === 'name_state' ? '' : '; then the beaker runs to the new temperature') + '. You cannot change the temperature.';
  return { objects: [], facts };
}

/** The journey's answers: the code-computed answer, or a plain wrong one. */
export function statesJourneyAnswers(item: StatesOfMatterItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = statesOfMatterHarnessAnswers(item);
  return { correct, plainWrong };
}
