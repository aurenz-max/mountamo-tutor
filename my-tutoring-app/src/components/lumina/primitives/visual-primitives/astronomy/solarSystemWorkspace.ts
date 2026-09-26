/**
 * Solar system explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C5). Its only teaching path for challenges: the scripted
 * runner was retired (LA-14, user ruling 09-23: one path). A payload with no askable challenge
 * stays the ungraded free-exploration orrery.
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken planet name, computed in code from the bodies on screen. Tapping a body is looking (it
 * opens the body's card where the band allows one); it never answers.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { askFor, isPairFacet, solarHarnessAnswers, type SolarItem } from './solarSystemScript';

export function solarAssignment(item: SolarItem): TeachingAssignment {
  const signature = item.signatureName ? ` "${item.signatureName}" is not it.` : '';
  const expectedAnswer = item.kind === 'classify'
    ? `Any one of: ${item.answerNames.join(', ')}.${signature} The kind's label with no planet name, or the Sun, is not it.`
    : `${item.answerNames[0]}. The name alone or inside a phrase counts.${signature} The Sun, a colour or "that one" with no name is not it.`;
  return { id: item.id, task: askFor(item), response: 'speech', expectedAnswer };
}

export function solarScene(item: SolarItem, view: { preReader: boolean }): WorkspaceScene {
  const facts: Record<string, string> = {
    shown: item.kind === 'identify' ? 'The solar system model. One planet glows bright; while this question is open no planet wears its name.'
      : isPairFacet(item.facet) ? `The solar system model, with ${item.pairNames.join(' and ')} glowing together.`
        : `The solar system model: the Sun and ${item.planetCount} planets, each on its own ring.`,
  };
  facts.constraints = 'The learner says a planet name out loud. Tapping a planet is looking, never an answer'
    + (view.preReader || item.kind === 'identify' ? '; no body card opens on this item' : '; it opens that body\'s card')
    + '. You cannot move or mark the planets.';
  return { objects: [], facts };
}

/** The journey's answers: the code-computed name, or a confidently wrong one on screen. */
export function solarJourneyAnswers(item: SolarItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = solarHarnessAnswers(item);
  return { correct, plainWrong };
}
