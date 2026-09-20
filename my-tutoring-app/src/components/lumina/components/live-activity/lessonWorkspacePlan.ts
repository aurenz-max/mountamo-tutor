import type { ExhibitData, OrderedComponent } from '../../types';
import { LIVE_ADAPTERS } from './activityContract';

export interface LessonWorkspaceItem {
  instanceId: string;
  primitiveId: 'counting-board' | 'shape-sorter';
  evalMode: string;
  objectiveId: string;
  planItemId: string;
  guidance: string;
}

/** Deliberately bounded S2 rollout. Unverified modes keep their existing path. */
export function lessonWorkspaceItems(exhibit: ExhibitData): Map<string, LessonWorkspaceItem> {
  const result = new Map<string, LessonWorkspaceItem>();
  for (const section of exhibit.orderedComponents ?? []) {
    if (section.audience === 'caregiver') continue;
    const primitiveId = section.componentId;
    if (primitiveId !== 'counting-board' && primitiveId !== 'shape-sorter') continue;
    const manifest = exhibit.manifest?.layout?.find(m => m.instanceId === section.instanceId);
    const mode = manifest?.config?.targetEvalMode;
    const expectedMode = primitiveId === 'counting-board' ? 'count' : 'identify';
    const expectedType = primitiveId === 'counting-board' ? 'count_all' : 'identify';
    const objectiveIds = section.objectiveIds ?? manifest?.objectiveIds ?? [];
    if (mode !== expectedMode || objectiveIds.length !== 1) continue;
    try {
      const data = LIVE_ADAPTERS[primitiveId].validate(section.data);
      if (!data.challenges?.length || data.challenges.some(c => c.type !== expectedType)) continue;
    } catch { continue; }
    result.set(section.instanceId, { instanceId: section.instanceId, primitiveId, evalMode: mode,
      objectiveId: objectiveIds[0], planItemId: section.instanceId, guidance: LIVE_ADAPTERS[primitiveId].guidance });
  }
  return result;
}

/** Explicit null suppresses retired catalog scripts on a migrated surface. */
export function lessonPrimitiveContext(section: OrderedComponent, binding?: LessonWorkspaceItem) {
  return { primitive_type: section.componentId, instance_id: section.instanceId,
    primitive_data: binding ? { ...section.data, teachingGuidance: binding.guidance } : section.data || {},
    ...(binding ? { tutoring: null, owns_opening: true } : {}) };
}
