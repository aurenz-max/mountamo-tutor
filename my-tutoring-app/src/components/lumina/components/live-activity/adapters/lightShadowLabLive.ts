import type { LightShadowLabData } from '../../../primitives/visual-primitives/astronomy/LightShadowLab';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const CHALLENGE_TYPES = ['observe', 'predict', 'measure', 'apply'];
const degrees = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

/** Reject a shadow lesson whose challenges cannot be attempted: every check reads the sun position it was built from. */
export function validateLightShadowLabData(value: unknown): LightShadowLabData {
  const d = value as LightShadowLabData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !CHALLENGE_TYPES.includes(c.type)
        || typeof c.instruction !== 'string' || !c.instruction.trim()))
    throw new Error('Generated light and shadow lab has invalid lesson content.');
  for (const c of d.challenges) {
    const sun = c.sunPosition;
    if (!sun || !degrees(sun.altitude, 0, 90) || !degrees(sun.azimuth, 0, 180) || (c.type === 'apply' && !sun.time?.trim()))
      throw new Error(`A light-shadow-lab ${c.type} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the shadow lab; the catalog's `teachingWorkspace` declares the rest. */
export const lightShadowLabLiveDomain: WorkspaceDomain<LightShadowLabData> = {
  validate: validateLightShadowLabData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
