import type { ConstellationBuilderData } from '../../../primitives/visual-primitives/astronomy/ConstellationBuilder';
import { shownInstruction } from '../../../primitives/visual-primitives/astronomy/constellationWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['guided_trace', 'free_connect', 'identify', 'seasonal'];

/** Reject a star lesson whose challenges cannot be attempted: every check reads stars, lines or names it was built from. */
export function validateConstellationBuilderData(value: unknown): ConstellationBuilderData {
  const d = value as ConstellationBuilderData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.stars) || !Array.isArray(d.challenges) || !d.challenges.length
      || d.challenges.length > 12 || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim() || typeof c.constellationName !== 'string' || !c.constellationName.trim()))
    throw new Error('Generated constellation builder has invalid lesson content.');
  const ids = new Set(d.stars.map(s => s?.id));
  for (const c of d.challenges) {
    const lines = Array.isArray(c.correctConnections) ? c.correctConnections : [];
    const linesOk = lines.length > 0 && lines.every(l => ids.has(l.fromStarId) && ids.has(l.toStarId));
    const ok = c.type === 'guided_trace' ? Array.isArray(c.starOrder) && c.starOrder.length >= 2 && c.starOrder.every(s => ids.has(s)) && linesOk
      : c.type === 'free_connect' || c.type === 'identify' ? linesOk
        : typeof c.season === 'string' && !!c.season.trim();
    if (!ok) throw new Error(`A constellation-builder ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the constellation builder; the catalog's `teachingWorkspace` declares the rest. */
export const constellationBuilderLiveDomain: WorkspaceDomain<ConstellationBuilderData> = {
  validate: validateConstellationBuilderData,
  initialState: d => workspaceOpening({ title: d.title, task: shownInstruction(d.challenges[0]), total: d.challenges.length }),
};
