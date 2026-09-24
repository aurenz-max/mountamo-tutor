import type { SpatialSceneData } from '../../../primitives/visual-primitives/math/SpatialScene';
import { spatialAssignment } from '../../../primitives/visual-primitives/math/spatialSceneWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CELL = new Set(['place', 'place_in', 'place_between']);

/** Reject a challenge the scene cannot check: every mode needs its target, and each its own key (contract R4-R6). */
export const validateSpatialSceneData = (value: unknown): SpatialSceneData => validateChallengePool<SpatialSceneData>(value,
  c => !!c && Array.isArray(c.sceneObjects) && c.sceneObjects.length > 0 && !!c.targetObject?.name
    && (c.type === 'follow_directions' ? Array.isArray(c.steps) && c.steps.length > 0
      : CELL.has(c.type) ? !!c.correctCell
        : c.type === 'describe_scene' ? !!c.correctPosition && !!c.referenceObjectName
          : !!c.correctPosition && Array.isArray(c.options) && c.options.includes(c.correctPosition)),
  { pool: 'Generated spatial scene has invalid lesson content.', item: 'A spatial-scene challenge cannot be checked.' });

/** What the live adapter needs from the spatial scene; the catalog's `teachingWorkspace` declares the rest. */
export const spatialSceneLiveDomain: WorkspaceDomain<SpatialSceneData> = {
  validate: validateSpatialSceneData,
  initialState: data => workspaceOpening({ title: data.title, task: spatialAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
