import { describe, expect, it } from 'vitest';
import { validateJudgedScriptPack } from '../../../hooks/judgedScriptContract';
import type { SpatialSceneChallenge } from './SpatialScene';
import {
  buildSpatialDescriptionItems,
  modelSpatialDescription,
  spatialSceneDescriptionPack,
} from './spatialSceneDescriptionScript';

const challenge: SpatialSceneChallenge = {
  id: 'perspective-1',
  type: 'describe_scene',
  instruction: 'Look from the YOU arrow. Describe where the cat is compared with the tree.',
  hint: 'Name the relation and the reference object.',
  sceneObjects: [
    { name: 'cat', image: '🐱', position: { row: 2, col: 1 } },
    { name: 'tree', image: '🌳', position: { row: 0, col: 1 } },
  ],
  targetObject: { name: 'cat', image: '🐱', position: { row: 2, col: 1 } },
  correctPosition: 'in_front_of',
  referenceObjectName: 'tree',
  scenePerspective: 'viewer_depth',
};

describe('spatial-scene spoken description contract', () => {
  it('uses the benched concept-statement runner contract', () => {
    const items = buildSpatialDescriptionItems([challenge]);
    expect(items[0]).toMatchObject({ answerKind: 'voice', responseClass: 'concept_statement' });
    expect(validateJudgedScriptPack(spatialSceneDescriptionPack(items))).toEqual([]);
  });

  it('elicits without leaking, then models the relation after an attempt', () => {
    const [item] = buildSpatialDescriptionItems([challenge]);
    const pack = spatialSceneDescriptionPack([item]);
    const cue = pack.itemCue(item, { opening: true, howToPlay: true });
    const spokenAsk = cue.match(/Say exactly: "([^"]+)"/)?.[1] ?? '';

    expect(spokenAsk.toLowerCase()).not.toContain('in front of');
    expect(cue).toContain('relation "in front of"');
    expect(cue).toContain('reference object tree');
    expect(modelSpatialDescription(item)).toBe('The cat is in front of the tree.');
  });
});
