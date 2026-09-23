import type { NumberTracerData } from '../../../primitives/visual-primitives/math/NumberTracer';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const NUMBER_TRACER_MODES = ['trace', 'copy', 'write', 'sequence'] as const;

/** Reject a writing set whose challenges cannot be attempted. */
export function validateNumberTracerData(value: unknown): NumberTracerData {
  const d = value as NumberTracerData;
  if (!d || typeof d.title !== 'string' || !['K', '1'].includes(d.gradeBand ?? '')
      || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id
        || !NUMBER_TRACER_MODES.includes(c.type as any)
        || typeof c.instruction !== 'string' || !c.instruction.trim()
        || !Number.isInteger(c.digit) || c.digit < 0 || c.digit > 20))
    throw new Error('Generated number tracer has invalid lesson content.');
  // A `sequence` ask has to say WHICH box is empty, or there is nothing to write.
  if (d.challenges.some(c => c.type === 'sequence'
      && (!Array.isArray(c.sequenceNumbers) || !c.sequenceNumbers.length
        || !Number.isInteger(c.missingIndex) || c.missingIndex! < 0
        || c.missingIndex! >= c.sequenceNumbers!.length)))
    throw new Error('A number-tracer sequence challenge has no writable blank.');
  return d;
}

/** What the live adapter needs from the number tracer; the catalog's `teachingWorkspace` declares the rest. */
export const numberTracerLiveDomain: WorkspaceDomain<NumberTracerData> = {
  validate: validateNumberTracerData,
  initialState: d => workspaceOpening({ title: d.title, task: d.challenges[0].instruction, total: d.challenges.length }),
};
