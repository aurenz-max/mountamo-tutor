/**
 * spatial-scene's boss, on the spoken preset (`components/live-activity/boss.ts`): identify and describe are a position
 * word said (the tutor judges it against the key) or tapped and checked (the scene checks the tap), SAY_OR_SHOW;
 * describe_scene is said and judged on the relation and the reference object; the placing modes have no key, the scene
 * checks the tap, and they play through `show`. The card is `spatialScene.card.ts`; this file holds the content check,
 * the items, the ask and key, the levers and the harness play.
 */
import type { SpatialSceneData } from './SpatialScene';
import type { DriverInput } from '../../../components/live-activity/liveJourneySpec';
import { spokenBoss } from '../../../components/live-activity/boss';
import { validateChallengePool } from '../../../components/live-activity/adapters/adapterContract';
import { spatialSceneCard, type SpatialMiss } from './spatialScene.card';
import { SPATIAL_LEVERS, practiceItem, practiceParent } from './spatialSceneLevers';
import { spatialAsk, spatialHarnessInputs, spatialHarnessWords, spatialKey, spatialSpokenMisses } from './spatialSceneWorkspace';

const CELL = new Set(['place', 'place_in', 'place_between']);

/** Reject a challenge the scene cannot check: every mode needs its target, and each its own key (contract R4-R6). */
export const validateSpatialSceneData = (value: unknown): SpatialSceneData => validateChallengePool<SpatialSceneData>(value,
  c => !!c && Array.isArray(c.sceneObjects) && c.sceneObjects.length > 0 && !!c.targetObject?.name
    && (c.type === 'follow_directions' ? Array.isArray(c.steps) && c.steps.length > 0
      : CELL.has(c.type) ? !!c.correctCell
        : c.type === 'describe_scene' ? !!c.correctPosition && !!c.referenceObjectName
          : !!c.correctPosition && Array.isArray(c.options) && c.options.includes(c.correctPosition)),
  { pool: 'Generated spatial scene has invalid lesson content.', item: 'A spatial-scene challenge cannot be checked.' });

export const spatialSceneBoss = spokenBoss<SpatialSceneData, SpatialSceneData['challenges'][number], SpatialMiss>({
  card: spatialSceneCard,
  validate: validateSpatialSceneData,
  items: d => d.challenges,
  levers: SPATIAL_LEVERS,
  speech: {
    ask: spatialAsk,
    // A placing item has no key: the scene checks the cell.
    key: spatialKey,
    misses: spatialSpokenMisses,
    say: spatialHarnessWords,
    modeOf: c => c.type,
    // The keyless items through their real controls: a cell and Check, or each remaining direction step.
    show: (right, c, ctx) => spatialHarnessInputs(c, !right, ctx.data.gridSize ?? 3,
      ctx.demand?.step as string | undefined) as DriverInput[],
  },
  drive: {
    component: 'primitives/visual-primitives/math/SpatialScene.tsx',
    instanceId: 'scene',
    defaults: { grade: 'Kindergarten', mode: 'identify', topic: 'Position words: above, below, beside and next to' },
    mounted: '[data-pip-object^="cell-"], [aria-label="Viewer position"]',
    // The session item, or the easier practice scene a simplify lever opened (`~simpler`), rebuilt from its parent.
    current: ctx => {
      const all = (ctx.data as SpatialSceneData).challenges ?? [];
      const parent = practiceParent(ctx.itemId, all);
      return parent ? practiceItem(parent, ctx.data.gridSize ?? 3) ?? undefined : all.find(c => c.id === ctx.itemId);
    },
  },
});
