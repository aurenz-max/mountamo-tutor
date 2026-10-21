/**
 * net-folder's boss (`components/live-activity/boss.ts`), bespoke because the modes mix typed numbers and a tapped
 * option, every one checked by the activity: the card is `netFolder.card.ts`; this file validates a lesson, lists its
 * challenges, asks one, carries the lever set and plays the harness.
 */
import type { NetFolderChallenge, NetFolderData } from './NetFolder';
import { bossAssignment, defineBoss } from '../../../components/live-activity/boss';
import { boxDims, itemSolid, matchTarget, netHarnessInput, normSolid } from './netFolderWorkspace';
import { foldCubeCells, type Cell } from './netFolderGeometry';
import { NET_LEVERS, practiceParent, simplerNet } from './netFolderLevers';
import { netFolderCard, type NetFolderMiss } from './netFolder.card';

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

/** The session item, or the easier practice item a simplify lever opened (`~simpler`), rebuilt from its parent. */
function currentItem(data: NetFolderData, itemId: string | null): NetFolderChallenge | undefined {
  const parentId = practiceParent(String(itemId ?? ''));
  const parent = (data.challenges ?? []).find(c => c.id === parentId);
  if (!parent || parentId === itemId) return parent;
  return simplerNet(parent, itemSolid(data.solid, parent)) ?? undefined;
}

export const netFolderBoss = defineBoss<NetFolderData, NetFolderChallenge, NetFolderMiss>({
  card: netFolderCard,
  validate: validateNetFolderData,
  items: d => d.challenges,
  ask: c => c.instruction,
  // Every answer is on screen and the activity checks it: no key reaches the tutor.
  assignment: c => bossAssignment(c.id, c.instruction, null),
  levers: NET_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/math/NetFolder.tsx',
    instanceId: 'netfold',
    defaults: { grade: 'Grade 4', mode: 'match_faces', topic: '3D solids and their nets' },
    mounted: '[data-pip-object="workspace"]',
    current: ctx => currentItem(ctx.data as NetFolderData, ctx.itemId),
    // Every mode through its real controls (`netHarnessInput`): the three counts typed into Faces, Edges and Vertices;
    // a solid, a face, or Valid net / Invalid net tapped; the total typed into "Total surface area"; then Check. A wrong
    // answer is the mode's signature miss: faces and edges swapped, a solid from the other family, the opposite face,
    // the other verdict, half the total.
    play: (right, c, ctx) => {
      const input = netHarnessInput(c, itemSolid((ctx.data as NetFolderData).solid, c), right ? 'correct' : 'wrong');
      if (input.kind === 'counts') return [{ type: 'write', label: 'Faces', text: String(input.faces) },
        { type: 'write', label: 'Edges', text: String(input.edges) }, { type: 'write', label: 'Vertices', text: String(input.vertices) },
        { type: 'check' }];
      if (input.kind === 'total') return [{ type: 'write', label: 'Total surface area', text: String(input.value) }, { type: 'check' }];
      return [{ type: 'choose', label: input.label }, { type: 'check' }];
    },
  },
});
