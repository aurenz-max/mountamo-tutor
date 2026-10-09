import type { MeasurementToolsData } from '../../../primitives/visual-primitives/math/MeasurementTools';
import { lessonOf, measurementItems, workspaceAssignment } from '../../../primitives/visual-primitives/math/measurementToolsWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const MODES = ['measure', 'compare', 'estimate', 'convert'];

/** Reject a ruler session whose shapes cannot be measured: every width must sit on the ruler, and compare needs distinct widths. */
export function validateMeasurementToolsData(value: unknown): MeasurementToolsData {
  const d = value as MeasurementToolsData;
  if (!d || typeof d.title !== 'string' || !MODES.includes(d.challengeType) || !Array.isArray(d.challenges)
      || !d.challenges.length || d.challenges.length > 11
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || !(d.rulerLengthInches > 0) || !['inches', 'centimeters'].includes(d.unit))
    throw new Error('Generated measurement tools session has invalid lesson content.');
  for (const c of d.challenges)
    if (!c || typeof c.id !== 'string' || !c.id || typeof c.label !== 'string' || !c.label.trim()
        || !(c.widthInches > 0) || c.widthInches > d.rulerLengthInches)
      throw new Error('A measurement-tools shape cannot be measured on its ruler as generated.');
  if (d.challengeType === 'compare' && new Set(d.challenges.map(c => c.widthInches)).size !== d.challenges.length)
    throw new Error('A measurement-tools compare session needs shapes of different lengths.');
  return d;
}

/** What the live adapter needs from the ruler session; the catalog's `teachingWorkspace` declares the rest. */
export const measurementToolsLiveDomain: WorkspaceDomain<MeasurementToolsData> = {
  validate: validateMeasurementToolsData,
  initialState: d => {
    const items = measurementItems(d.challengeType, d.challenges);
    return workspaceOpening({ title: d.title, task: workspaceAssignment(items[0], lessonOf(d)).task, total: items.length });
  },
};
