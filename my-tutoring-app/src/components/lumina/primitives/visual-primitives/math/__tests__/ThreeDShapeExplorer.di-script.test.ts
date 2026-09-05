import { describe, expect, it } from 'vitest';
import type { JudgedScriptPack } from '../../../../hooks/judgedScriptContract';
import { checkDiCatalogEntry, checkPackGates } from '../../../../hooks/judgedScriptContract.testkit';
import { MATH_CATALOG } from '../../../../service/manifest/catalog/math';
import {
  COLLECTION_ITEM_CAP,
  SESSION_ITEM_CAP,
  SHAPE_FACTS,
  affirmFor,
  askFor,
  buildThreeDShapeItems,
  canonicalPropertiesFor,
  canonicalRiddleCluesFor,
  correctionFor,
  gateThreeDShapeChallenge,
  objectNameLeaksShape,
  riddleCandidatesForClues,
  supportForItem,
  threeDShapeExplorerHarnessAnswers,
  threeDShapeExplorerPackBase,
  validateRiddleClues,
  wrapperTextForSession,
  type ThreeDShapeChallengeLike,
  type ThreeDShapeItem,
} from '../threeDShapeExplorerScript';

const identify = (id: string, shape: string): ThreeDShapeChallengeLike => ({
  id, type: 'identify-3d', shape3d: shape,
});
const riddle = (id: string, shape: 'cube' | 'sphere' | 'cylinder' | 'cone' | 'rectangular-prism'): ThreeDShapeChallengeLike => ({
  id, type: 'shape-riddle', shape3d: shape, clues: canonicalRiddleCluesFor(shape),
});
const packOf = (items: ThreeDShapeItem[]): JudgedScriptPack<ThreeDShapeItem> =>
  threeDShapeExplorerPackBase(items) as JudgedScriptPack<ThreeDShapeItem>;

describe('3d-shape-explorer judged script', () => {
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

  it('authors exact sentinel branches and signature misconceptions for every kind', () => {
    const challenges: ThreeDShapeChallengeLike[] = [
      identify('i', 'sphere'),
      { id: 'd', type: '2d-vs-3d', mixedShapes: [{ name: 'circle', is3d: false }] },
      { id: 'm', type: 'match-to-real-world', matchPairs: [{ realWorldObject: 'ball', shape3d: 'sphere' }] },
      { id: 'p1', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'flatFaces' }, { propertyKey: 'canRoll' }, { propertyKey: 'faceShape' }] },
      riddle('r', 'cone'),
    ];
    for (const item of challenges.flatMap((challenge) => buildThreeDShapeItems([challenge]).items)) {
      expect(affirmFor(item)).toMatch(/^Yes,/);
      expect(correctionFor(item)).toMatch(/^My turn:/);
      expect(correctionFor(item)).toContain(askFor(item));
      expect(threeDShapeExplorerHarnessAnswers(item).signatureWrong.text).not.toBe(item.answer);
    }
  });

  it('passes the shared pack gates and proves they bite', () => {
    const items = buildThreeDShapeItems([
      identify('i', 'cube'),
      riddle('r', 'sphere'),
      { id: 'p', type: 'faces-and-properties', displayShape: 'cube', propertyQuestions: [{ propertyKey: 'canRoll' }] },
    ]).items;
    expect(checkPackGates(packOf(items))).toEqual([]);
    expect(checkPackGates(packOf([items[0], { ...items[1], id: items[0].id }])).length).toBeGreaterThan(0);

    const countItems = buildThreeDShapeItems([{
      id: 'counts', type: 'faces-and-properties', displayShape: 'cylinder',
      propertyQuestions: [{ propertyKey: 'flatFaces' }, { propertyKey: 'curvedSurfaces' }],
    }]).items;
    expect(countItems.map((item) => item.answer)).toEqual(['two', 'one']);
    expect(checkPackGates(packOf(countItems))).toEqual([]);
  });

  it('passes the DI catalog contract and fails safely when everything drops', () => {
    const items = buildThreeDShapeItems([identify('i', 'cube')]).items;
    const entry = MATH_CATALOG.find((candidate) => candidate.id === '3d-shape-explorer');
    expect(entry).toBeTruthy();
    expect(checkDiCatalogEntry(entry!, packOf(items), items[0])).toEqual([]);
    expect(buildThreeDShapeItems([identify('bad', 'pyramid')]).items).toEqual([]);
  });
});
