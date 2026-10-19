/**
 * 3d-shape-explorer's domain: the geometry table, the item build and its gates, the riddles, the wrapper leak rule,
 * and the spoken key (one SpokenKey per item; flat-or-solid and yes-or-no are menus the ask says in full).
 */
import { describe, expect, it } from 'vitest';
import { askLeaks } from '../../../components/live-activity/spokenKey';
import {
  COLLECTION_ITEM_CAP,
  SESSION_ITEM_CAP,
  SHAPE_FACTS,
  askFor,
  buildThreeDShapeItems,
  canonicalPropertiesFor,
  canonicalRiddleCluesFor,
  gateThreeDShapeChallenge,
  objectNameLeaksShape,
  riddleCandidatesForClues,
  supportForItem,
  threeDShapeExplorerHarnessAnswers,
  threeDShapeKey,
  validateRiddleClues,
  wrapperTextForSession,
  type ThreeDShapeChallengeLike,
} from './threeDShapeExplorerDomain';

const identify = (id: string, shape: string): ThreeDShapeChallengeLike => ({
  id, type: 'identify-3d', shape3d: shape,
});
const riddle = (id: string, shape: 'cube' | 'sphere' | 'cylinder' | 'cone' | 'rectangular-prism'): ThreeDShapeChallengeLike => ({
  id, type: 'shape-riddle', shape3d: shape, clues: canonicalRiddleCluesFor(shape),
});

describe('3d-shape-explorer domain', () => {
  it('keeps one canonical geometry table for all five solids', () => {
    expect(SHAPE_FACTS).toEqual({
      cube: { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['square'], canRoll: false, canStack: true, canSlide: true },
      sphere: { flatFaces: 0, curvedSurfaces: 1, faceShapes: [], canRoll: true, canStack: false, canSlide: false },
      cylinder: { flatFaces: 2, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: true, canSlide: true },
      cone: { flatFaces: 1, curvedSurfaces: 1, faceShapes: ['circle'], canRoll: true, canStack: false, canSlide: true },
      'rectangular-prism': { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['rectangle'], canRoll: false, canStack: true, canSlide: true },
    });
  });

  it('maps every mode to one spoken answer class and fans collections out with stable ids', () => {
    const dimension = buildThreeDShapeItems([{ id: 'd', type: '2d-vs-3d', mixedShapes: [
      { name: 'circle', is3d: false }, { name: 'sphere', is3d: true },
    ] }]).items;
    expect(dimension.map((item) => [item.id, item.kind, item.answerKind, item.responseClass])).toEqual([
      ['d:shape:0', 'classify_dimension', 'voice', 'short_spoken_word'],
      ['d:shape:1', 'classify_dimension', 'voice', 'short_spoken_word'],
    ]);

    const match = buildThreeDShapeItems([{ id: 'm', type: 'match-to-real-world', matchPairs: [
      { realWorldObject: 'ball', shape3d: 'sphere' }, { realWorldObject: 'soup can', shape3d: 'cylinder' },
    ] }]).items;
    expect(match.map((item) => [item.id, item.kind, item.responseClass])).toEqual([
      ['m:object:0', 'match_object', 'shape_name'], ['m:object:1', 'match_object', 'shape_name'],
    ]);
    expect(buildThreeDShapeItems([identify('i', 'cube')]).items[0].responseClass).toBe('shape_name');
    expect(buildThreeDShapeItems([riddle('r', 'cone')]).items[0].responseClass).toBe('shape_name');
  });

  it('derives property answers by facet and reframes zero as yes/no', () => {
    const challenge: ThreeDShapeChallengeLike = {
      id: 'p', type: 'faces-and-properties', displayShape: 'sphere',
      properties: canonicalPropertiesFor('sphere'),
      propertyQuestions: [
        { propertyKey: 'flatFaces', correctAnswer: 0 },
        { propertyKey: 'curvedSurfaces', correctAnswer: 1 },
        { propertyKey: 'canStack', correctAnswer: false },
      ],
    };
    const items = buildThreeDShapeItems([challenge]).items;
    expect(items.map((item) => [item.kind, item.answer, item.responseClass])).toEqual([
      ['judge_property', 'no', 'yes_no'],
      ['judge_property', 'no', 'yes_no'],
      ['count_property', 'one', 'number_word_to_20'],
    ]);
    expect(items.some((item) => item.responseClass === 'number_word_to_20' && item.answer === 'zero')).toBe(false);
  });

  it('drops contradictory children without hiding usable collection members', () => {
    const build = buildThreeDShapeItems([{ id: 'd', type: '2d-vs-3d', mixedShapes: [
      { name: 'circle', is3d: true }, { name: 'cube', is3d: true }, { name: 'blob', is3d: false },
    ] }]);
    expect(build.items.map((item) => item.shape)).toEqual(['cube']);
    expect(build.droppedChallenges).toBe(0);
    expect(build.droppedItems).toHaveLength(2);
    expect(gateThreeDShapeChallenge({ id: 'bad', type: 'faces-and-properties', displayShape: 'cube', properties: canonicalPropertiesFor('sphere'), propertyQuestions: [{ propertyKey: 'flatFaces' }] })).toContain('generated properties disagree with canonical facts');
  });

  it('enforces object sayability, answer leaks, exact repetition, identity dedupe, and both caps', () => {
    expect(objectNameLeaksShape('ice cream cone', 'cone')).toBe(true);
    expect(buildThreeDShapeItems([{ id: 'm', type: 'match-to-real-world', matchPairs: [
      { realWorldObject: 'ice cream cone', shape3d: 'cone' }, { realWorldObject: 'party hat', shape3d: 'cone' },
    ] }]).items.map((item) => item.objectName)).toEqual(['party hat']);
    const many = Array.from({ length: 9 }, (_, index) => identify(`i${index}`, ['cube','sphere','cylinder','cone','rectangular-prism'][index % 5]));
    expect(buildThreeDShapeItems(many).items.length).toBeLessThanOrEqual(SESSION_ITEM_CAP);
    expect(COLLECTION_ITEM_CAP).toBe(4);
    const deduped = buildThreeDShapeItems([identify('i', 'sphere'), { id: 'm', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'ball', shape3d: 'sphere' }] }]);
    expect(deduped.items).toHaveLength(1);
  });

  it('accepts only code-owned, answer-free, uniquely identifying riddles', () => {
    for (const shape of ['cube','sphere','cylinder','cone','rectangular-prism'] as const) {
      const clues = canonicalRiddleCluesFor(shape);
      expect(validateRiddleClues(shape, clues)).toEqual([]);
      expect(riddleCandidatesForClues(clues)).toEqual([shape]);
      expect(clues.join(' ').toLowerCase()).not.toContain(shape.replace('-', ' '));
    }
    expect(validateRiddleClues('cone', ['I am a cone.', 'I roll.']).length).toBeGreaterThan(0);
  });

  it('holds answer-bearing labels behind reveal and neutralizes wrapper leaks', () => {
    const item = buildThreeDShapeItems([{
      id: 'p', type: 'faces-and-properties', displayShape: 'cube', showElementLabels: true,
      showFaceHighlight: true, propertyQuestions: [{ propertyKey: 'flatFaces' }],
    }]).items[0];
    expect(supportForItem(item, false)).toEqual({ showFaceHighlight: true, showElementLabels: false });
    expect(supportForItem(item, true).showElementLabels).toBe(true);
    const named = buildThreeDShapeItems([identify('i', 'sphere')]).items;
    expect(wrapperTextForSession('Sphere Adventure', 'Find the sphere', named)).toEqual({ title: 'Solid Shape Lab', description: undefined });
  });

  it('keys every kind; the ask never says an accepted answer, and a menu ask says every menu word', () => {
    const challenges: ThreeDShapeChallengeLike[] = [
      identify('i', 'sphere'),
      { id: 'd', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }, { name: 'cube', is3d: true }] },
      { id: 'm', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'ball', shape3d: 'sphere' }] },
      { id: 'p1', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'flatFaces' }, { propertyKey: 'canRoll' }, { propertyKey: 'faceShape' }] },
      { id: 'p2', type: 'faces-and-properties', displayShape: 'cone', propertyQuestions: [{ propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }] },
      riddle('r', 'cone'),
    ];
    for (const item of challenges.flatMap((challenge) => buildThreeDShapeItems([challenge]).items)) {
      const key = threeDShapeKey(item);
      expect(key.answer).toBe(item.answer);
      expect(askLeaks(askFor(item), key), item.id).toEqual([]);
      if (item.kind === 'classify_dimension') expect(key.menu).toEqual(['flat', 'solid']);
      else if (item.kind === 'judge_property') expect(key.menu).toEqual(['yes', 'no']);
      else expect(key.menu).toBeUndefined();
      expect(threeDShapeExplorerHarnessAnswers(item).plainWrong).not.toBe(item.answer);
    }
  });

  it('fails safely when everything drops', () => {
    expect(buildThreeDShapeItems([identify('bad', 'pyramid')]).items).toEqual([]);
  });
});
