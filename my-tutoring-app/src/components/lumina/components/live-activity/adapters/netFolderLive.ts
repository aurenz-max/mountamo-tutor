import type { NetFolderData } from '../../../primitives/visual-primitives/math/NetFolder';
import { boxDims, matchTarget, normSolid, workspaceAssignment } from '../../../primitives/visual-primitives/math/netFolderWorkspace';
import { foldCubeCells, type Cell } from '../../../primitives/visual-primitives/math/netFolderGeometry';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['identify_solid', 'match_faces', 'valid_net', 'surface_area', 'count_faces_edges_vertices'];

/** Reject a net-folder lesson whose challenges cannot be attempted. */
export function validateNetFolderData(value: unknown): NetFolderData {
  const d = value as NetFolderData;
  if (!d || typeof d.title !== 'string' || !d.solid || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.type) || typeof c.instruction !== 'string'))
    throw new Error('Generated net folder has invalid lesson content.');
  // Each item needs what its own check reads: the answer among the options, a drawn net that decides the answer,
  // a box's six faces.
  for (const c of d.challenges) {
    const ok = c.type === 'identify_solid'
      ? (c.options ?? []).some(o => normSolid(o) === normSolid(String(c.targetAnswer)))
      : c.type === 'match_faces'
        ? !!c.netCells?.length && typeof c.highlightCell === 'number' && foldCubeCells(c.netCells as Cell[], c.anchorCells?.[0] ?? 0).valid
          && (c.faceOptions ?? []).includes(matchTarget(c))
        : c.type === 'valid_net' ? !!c.netCells?.length
          : c.type === 'surface_area' ? !!boxDims(c.faceDimensions) : true;
    if (!ok) throw new Error(`A net-folder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the net folder; the catalog's `teachingWorkspace` declares the rest. */
export const netFolderLiveDomain: WorkspaceDomain<NetFolderData> = {
  validate: validateNetFolderData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
