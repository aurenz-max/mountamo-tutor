import type { ExhibitData, OrderedComponent } from '../../types';
import { LIVE_ADAPTERS, isLivePrimitive, type LiveActivityAdapter, type LivePrimitiveId } from './activityContract';
import { pinBindsWorkspace } from './pinnedModes';

export interface LessonWorkspaceItem {
  instanceId: string;
  primitiveId: LivePrimitiveId;
  evalMode: string;
  objectiveId: string;
  planItemId: string;
  guidance: string;
}

/** One mounted primitive a host is deciding about. `pin` is the host's RESOLVED eval-mode pin:
 *  a lesson section's manifest `targetEvalMode`, a Pulse item's IRT-chosen `eval_mode_name`. None binds as `mixed`. */
export interface WorkspaceCandidate {
  instanceId: string;
  primitiveId: string;
  pin: unknown;
  objectiveIds: readonly string[];
  data: unknown;
}

/**
 * Whether one mounted primitive reaches the shared teaching workspace. This names no
 * primitive and withholds no mode: a family that binds the workspace (`bindsTeachingWorkspace`)
 * runs every one of its `modes` on it, and the primitive binds when its generated content is
 * what the pin asks for. Every host decides with this, so there is one eligibility rule.
 */
export function workspaceBinding({ instanceId, primitiveId, pin, objectiveIds, data }: WorkspaceCandidate): LessonWorkspaceItem | null {
  if (!isLivePrimitive(primitiveId)) return null;
  const adapter = LIVE_ADAPTERS[primitiveId] as LiveActivityAdapter;
  // No pin means the generator chose freely across the family's modes: that content is `mixed`.
  // A blend (`a|b`) or `mixed` pin binds when every mode it names is one the family binds.
  const mode = typeof pin === 'string' && pin ? pin : 'mixed';
  if (!adapter.bindsTeachingWorkspace || !pinBindsWorkspace(primitiveId, adapter.modes, mode)
    || objectiveIds.length !== 1) return null;
  try {
    const validated = adapter.validate(data);
    if (!validated.challenges?.length) return null;
  } catch { return null; }
  return { instanceId, primitiveId, evalMode: mode, objectiveId: objectiveIds[0], planItemId: instanceId, guidance: adapter.guidance };
}

/** Which sections of an ordinary lesson reach the shared teaching workspace. */
export function lessonWorkspaceItems(exhibit: ExhibitData): Map<string, LessonWorkspaceItem> {
  const result = new Map<string, LessonWorkspaceItem>();
  for (const section of exhibit.orderedComponents ?? []) {
    if (section.audience === 'caregiver') continue;
    const manifest = exhibit.manifest?.layout?.find(m => m.instanceId === section.instanceId);
    const binding = workspaceBinding({ instanceId: section.instanceId, primitiveId: section.componentId,
      pin: manifest?.config?.targetEvalMode, objectiveIds: section.objectiveIds ?? manifest?.objectiveIds ?? [], data: section.data });
    if (binding) result.set(section.instanceId, binding);
  }
  return result;
}

/** Explicit null suppresses retired catalog scripts on a migrated surface. */
export function lessonPrimitiveContext(section: OrderedComponent, binding?: LessonWorkspaceItem) {
  return { primitive_type: section.componentId, instance_id: section.instanceId,
    primitive_data: binding ? { ...section.data, teachingGuidance: binding.guidance } : section.data || {},
    ...(binding ? { tutoring: null, owns_opening: true } : {}) };
}
