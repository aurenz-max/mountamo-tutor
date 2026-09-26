/**
 * 3D shape explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C4). Its only teaching path: the scripted runner was
 * retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer about the solid, flat shape, object or riddle on screen.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { SHAPE_LABELS, askFor, threeDShapeExplorerHarnessAnswers, type ThreeDShapeItem } from './threeDShapeExplorerScript';

const REFUSAL: Partial<Record<ThreeDShapeItem['kind'], (item: ThreeDShapeItem) => string>> = {
  identify_shape: () => 'A flat look-alike (circle for sphere, square for cube) or the name of one face is not it.',
  match_object: item => `Saying "${item.objectName}" again is not it: the question asks for its solid shape name.`,
  count_property: () => 'A number one more or one less is not it.',
  name_face_shape: item => `"${SHAPE_LABELS[item.shape3d!]}" names the solid, not its face, so it is not it.`,
  solve_riddle: () => 'A solid that fits only some of the clues is not it; every clue must fit.',
};

export function threeDShapeAssignment(item: ThreeDShapeItem): TeachingAssignment {
  const also = item.spokenAlternates.length ? ` Also accept: ${item.spokenAlternates.join(', ')}.` : '';
  return { id: item.id, task: askFor(item), response: 'speech',
    expectedAnswer: `${item.answer}.${also} ${REFUSAL[item.kind]?.(item) ?? 'Any other answer is not it.'}` };
}

export function threeDShapeScene(item: ThreeDShapeItem): WorkspaceScene {
  const shown = item.kind === 'match_object' ? `a picture of ${item.objectName}, named`
    : item.kind === 'solve_riddle' ? `the riddle's clues, printed: ${(item.clues ?? []).join(' ')}`
    : item.kind === 'classify_dimension' ? 'one shape, drawn large and unlabeled'
    : item.kind === 'identify_shape' ? 'one solid, drawn large and unlabeled'
    : `a ${SHAPE_LABELS[item.shape3d!]}, drawn and named`;
  return { objects: [], facts: {
    shown,
    constraints: 'The learner answers out loud; nothing is tapped. The answer is printed only after credit.',
  } };
}

/** What the replay button asks the tutor to say: the question only, never the answer. */
export const hearQuestionRequest = (item: ThreeDShapeItem) =>
  `The learner tapped to hear the question again. Say only this, once: "${askFor(item)}" Never say the answer.`;

/** The journey's answers: the pack's correct and plain-wrong spoken answers. */
export function threeDShapeJourneyAnswers(item: ThreeDShapeItem): { correct: string; plainWrong: string } {
  const { correct, plainWrong } = threeDShapeExplorerHarnessAnswers(item);
  return { correct, plainWrong };
}
