/**
 * 3D shape explorer on the shared tutor/JEV teaching workspace, W1 minimal binding
 * (qa/workspace-rollout/ROLLOUT.md, batch C4). Its only teaching path: the scripted runner was
 * retired (LA-14, user ruling 09-23: one path).
 *
 * Pure: the component and the journey read the same assignment and scene. Every item is one
 * spoken answer about the solid, flat shape, object or riddle on screen.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { numberMisses, offByMisses, type KnownMiss, type OffByMiss } from '../../../components/live-activity/runtime/spokenMissContract';
import {
  SHAPE_FACTS, SHAPE_LABELS, THREE_D_SHAPES, askFor, threeDShapeExplorerHarnessAnswers,
  type ThreeDShapeItem, type ThreeDShapeName,
} from './threeDShapeExplorerScript';

const REFUSAL: Partial<Record<ThreeDShapeItem['kind'], (item: ThreeDShapeItem) => string>> = {
  identify_shape: () => 'A flat look-alike (circle for sphere, square for cube) or the name of one face is not it.',
  match_object: item => `Saying "${item.objectName}" again is not it: the question asks for its solid shape name.`,
  count_property: () => 'A number one more or one less is not it.',
  name_face_shape: item => `"${SHAPE_LABELS[item.shape3d!]}" names the solid, not its face, so it is not it.`,
  solve_riddle: () => 'A solid that fits only some of the clues is not it; every clue must fit.',
};

/** What a wrong spoken answer about a solid shows (handoff 20 Part B). */
export type SpokenSolidMiss = OffByMiss | 'flat_look_alike' | 'similar_solid' | 'other_solid' | 'said_object'
  | 'opposite_dimension' | 'said_shape_name' | 'said_other_surface' | 'said_all_surfaces' | 'opposite_verdict'
  | 'said_solid' | 'side_view_shape' | 'other_flat_shape';

const FLAT_LOOK_ALIKE: Record<ThreeDShapeName, string> = {
  cube: 'square', sphere: 'circle', cylinder: 'circle', cone: 'triangle', 'rectangular-prism': 'rectangle',
};
const SIMILAR_SOLID: Partial<Record<ThreeDShapeName, ThreeDShapeName>> = {
  cube: 'rectangular-prism', 'rectangular-prism': 'cube', cylinder: 'cone', cone: 'cylinder',
};
/** The outline of the solid seen from the side, where it differs from its flat face. */
const SIDE_VIEW: Partial<Record<ThreeDShapeName, string>> = { cone: 'triangle', cylinder: 'rectangle' };
/** A face name that is arguably true too (a square is a rectangle), so never listed as a miss. */
const ALSO_TRUE_FACE: Partial<Record<ThreeDShapeName, string>> = { cube: 'rectangle', 'rectangular-prism': 'square' };
const FLAT_SHAPES = ['circle', 'square', 'triangle', 'rectangle'];
const many = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const orList = (words: string[]) => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

/** The name misses of a solid-shape answer, after `fact` (what is on screen): its flat look-alike, the solid
 *  shaped most like it, then any other solid. */
function solidNameMisses(shape: ThreeDShapeName, fact: string, similarWhy: string): KnownMiss[] {
  const label = SHAPE_LABELS[shape], flat = FLAT_LOOK_ALIKE[shape], similar = SIMILAR_SOLID[shape];
  const others = THREE_D_SHAPES.filter(s => s !== shape && s !== similar).map(s => SHAPE_LABELS[s]);
  return [
    { id: 'flat_look_alike', pattern: `${fact} The learner says "${flat}", a flat shape, instead of ${label}.`, examples: [flat, `a ${flat}`] },
    ...(similar ? [{ id: 'similar_solid', pattern: `${fact} The learner says "${SHAPE_LABELS[similar]}", ${similarWhy}, instead of ${label}.`,
      examples: [SHAPE_LABELS[similar]] }] : []),
    { id: 'other_solid', pattern: `${fact} The learner names a different solid instead of ${label}: ${orList(others)}.`, examples: [others[0]] },
  ];
}

/**
 * A spoken item's known wrong answers, in precedence order, for the `spoken_miss` observer: the solid, face or
 * count on screen stated first, then the learner's word. Concrete per item, never a cause.
 */
export function threeDShapeSpokenMisses(item: ThreeDShapeItem): KnownMiss[] {
  const shape = item.shape3d, label = shape ? SHAPE_LABELS[shape] : item.shape ?? 'shape';
  switch (item.kind) {
    case 'identify_shape':
      return shape ? solidNameMisses(shape, `The solid drawn is a ${label}.`, 'the name of a different solid') : [];
    case 'match_object':
      return shape ? [
        { id: 'said_object', pattern: `The picture is a ${item.objectName}. The learner's answer is ${item.objectName}, the object's own name, not a solid shape name.`,
          examples: [item.objectName ?? 'it'] },
        ...solidNameMisses(shape, `The ${item.objectName} is shaped like a ${label}.`, 'the name of a different solid'),
      ] : [];
    case 'solve_riddle':
      return shape ? [
        ...solidNameMisses(shape, `The riddle's answer is ${label}.`, 'the name of a different solid'),
      ].sort((a, b) => Number(b.id === 'similar_solid') - Number(a.id === 'similar_solid')) : [];
    case 'classify_dimension': {
      const opposite = item.answer === 'solid' ? 'flat' : 'solid';
      return [
        { id: 'opposite_dimension', pattern: `The shape drawn, a ${label}, is ${item.answer}. The learner says "${opposite}" instead of ${item.answer}.`,
          examples: [opposite, opposite === 'flat' ? '2d' : '3d'] },
        { id: 'said_shape_name', pattern: `The shape drawn is a ${label}. The learner says its name, ${label}, and not whether it is flat or solid.`,
          examples: [label] },
      ];
    }
    case 'count_property': {
      if (!shape || !item.propertyKey) return [];
      const facts = SHAPE_FACTS[shape], n = Number(item.propertyValue);
      const flat = item.propertyKey === 'flatFaces', noun = flat ? 'flat faces' : 'curved surfaces';
      const other = flat ? facts.curvedSurfaces : facts.flatFaces, otherNoun = flat ? 'curved surfaces' : 'flat faces';
      const all = facts.flatFaces + facts.curvedSurfaces;
      return [...numberMisses(n, [
        { id: 'said_other_surface', value: other,
          pattern: v => `The ${label} has ${many(v, otherNoun.slice(0, -1))}. The learner's answer is ${v}, the number of ${otherNoun}, not ${noun}.` },
        { id: 'said_all_surfaces', value: facts.curvedSurfaces && facts.flatFaces ? all : undefined,
          pattern: v => `The ${label} has ${many(facts.flatFaces, 'flat face')} and ${many(facts.curvedSurfaces, 'curved surface')}, ${v} surfaces in all. `
            + `The learner's answer is ${v}, every surface counted together.` }]),
        ...offByMisses(n, `the ${n} ${noun} of the ${label}`)];
    }
    case 'judge_property': {
      const wrong = item.answer === 'yes' ? 'no' : 'yes';
      const key = item.propertyKey;
      const truth = key === 'flatFaces' || key === 'curvedSurfaces'
        ? `The ${label} ${item.answer === 'yes' ? 'has' : 'has no'} ${key === 'flatFaces' ? 'flat faces' : 'curved surfaces'}.`
        : `The ${label} ${item.answer === 'yes' ? 'can' : 'cannot'} ${key === 'canStack' ? 'stack' : key === 'canSlide' ? 'slide' : 'roll smoothly'}.`;
      return [{ id: 'opposite_verdict', pattern: `${truth} The learner's answer is ${wrong}, the opposite.`,
        examples: [wrong, wrong === 'yes' ? 'yes it can' : 'no it cannot'] }];
    }
    case 'name_face_shape': {
      if (!shape) return [];
      const side = SIDE_VIEW[shape];
      const others = FLAT_SHAPES.filter(s => s !== item.answer && s !== side && s !== ALSO_TRUE_FACE[shape]);
      const fact = `Each flat face of the ${label} is a ${item.answer}.`;
      return [
        { id: 'said_solid', pattern: `${fact} The learner's answer is ${label}, the name of the solid, not of its face.`, examples: [label] },
        ...(side ? [{ id: 'side_view_shape', pattern: `${fact} The learner's answer is ${side}, the outline of the ${label} seen from the side.`,
          examples: [side] }] : []),
        { id: 'other_flat_shape', pattern: `${fact} The learner names a different flat shape: ${orList(others)}.`, examples: [others[0]] },
      ];
    }
  }
}

export function threeDShapeAssignment(item: ThreeDShapeItem): TeachingAssignment {
  const also = item.spokenAlternates.length ? ` Also accept: ${item.spokenAlternates.join(', ')}.` : '';
  const misses = threeDShapeSpokenMisses(item);
  return { id: item.id, task: askFor(item), response: 'speech',
    expectedAnswer: `${item.answer}.${also} ${REFUSAL[item.kind]?.(item) ?? 'Any other answer is not it.'}`,
    ...(misses.length ? { misses } : {}) };
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
