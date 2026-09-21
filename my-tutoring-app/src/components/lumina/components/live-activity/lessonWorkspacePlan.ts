import type { ExhibitData, OrderedComponent } from '../../types';
import { LIVE_ADAPTERS, isLivePrimitive, type LiveActivityAdapter, type LivePrimitiveId } from './activityContract';
import { allowedChallengeTypes, offModeChallengeTypes } from './modeContentGate';

export interface LessonWorkspaceItem {
  instanceId: string;
  primitiveId: LivePrimitiveId;
  evalMode: string;
  objectiveId: string;
  planItemId: string;
  guidance: string;
}

/**
 * Which sections of an ordinary lesson reach the shared teaching workspace. This
 * module names no primitive and withholds no mode: a family that binds the workspace
 * (`bindsTeachingWorkspace`) runs every one of its `modes` on it, and a section binds
 * when its generated content is what the manifest's resolved mode asks for.
 */
export function lessonWorkspaceItems(exhibit: ExhibitData): Map<string, LessonWorkspaceItem> {
  const result = new Map<string, LessonWorkspaceItem>();
  for (const section of exhibit.orderedComponents ?? []) {
    if (section.audience === 'caregiver') continue;
    const primitiveId = section.componentId;
    if (!isLivePrimitive(primitiveId)) continue;
    const adapter = LIVE_ADAPTERS[primitiveId] as LiveActivityAdapter;
    const manifest = exhibit.manifest?.layout?.find(m => m.instanceId === section.instanceId);
    // The VERBATIM pin: a blend (`a|b`) or `mixed` is never admitted, even if every part is.
    const mode = manifest?.config?.targetEvalMode;
    const objectiveIds = section.objectiveIds ?? manifest?.objectiveIds ?? [];
    if (typeof mode !== 'string' || !adapter.bindsTeachingWorkspace || !adapter.modes.includes(mode) || objectiveIds.length !== 1) continue;
    const allowed = allowedChallengeTypes(primitiveId, mode);
    if (typeof allowed === 'string') continue;
    try {
      const data = adapter.validate(section.data);
      if (!data.challenges?.length || offModeChallengeTypes(primitiveId, data, allowed).length) continue;
    } catch { continue; }
    result.set(section.instanceId, { instanceId: section.instanceId, primitiveId, evalMode: mode,
      objectiveId: objectiveIds[0], planItemId: section.instanceId, guidance: adapter.guidance });
  }
  return result;
}

/** Explicit null suppresses retired catalog scripts on a migrated surface. */
export function lessonPrimitiveContext(section: OrderedComponent, binding?: LessonWorkspaceItem) {
  return { primitive_type: section.componentId, instance_id: section.instanceId,
    primitive_data: binding ? { ...section.data, teachingGuidance: binding.guidance } : section.data || {},
    ...(binding ? { tutoring: null, owns_opening: true } : {}) };
}
