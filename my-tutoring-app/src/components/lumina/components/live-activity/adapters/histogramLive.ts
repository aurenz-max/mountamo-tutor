import type { HistogramData } from '../../../primitives/visual-primitives/math/Histogram';
import { computeBins, histogramCorrect, histogramHarnessInput, workspaceAssignment }
  from '../../../primitives/visual-primitives/math/histogramWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['identify_shape', 'find_modal_bin', 'read_frequency', 'estimate_center'];

/** Reject a histogram lesson whose challenges cannot be attempted. */
export function validateHistogramData(value: unknown): HistogramData {
  const d = value as HistogramData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.challenges) || !d.challenges.length || d.challenges.length > 12
      || new Set(d.challenges.map(c => c?.id)).size !== d.challenges.length
      || d.challenges.some(c => !c || typeof c.id !== 'string' || !c.id || !TYPES.includes(c.challengeType)
        || typeof c.prompt !== 'string' || !c.prompt.trim() || !Array.isArray(c.data) || !c.data.length || !(c.binWidth > 0)))
    throw new Error('Generated histogram has invalid lesson content.');
  // Each item needs what its own check reads, and its key must be reachable through the controls: a shape among the
  // chips, a modal bin that is a drawn bar, an asked bin that is drawn, a center with a tolerance.
  for (const c of d.challenges) {
    const bins = computeBins(c.data, c.binWidth, c.binStart);
    const input = histogramHarnessInput(c, 'correct');
    const work = input.kind === 'choose'
      ? { shape: c.shapeOptions?.find(s => s === c.expectedShape) ?? null, binIndex: null, typed: '' }
      : input.kind === 'bar' ? { shape: null, binIndex: input.index, typed: '' } : { shape: null, binIndex: null, typed: input.text };
    const ok = (c.challengeType !== 'read_frequency' || bins.some(b => b.start === c.targetBinStart))
      && (c.challengeType !== 'estimate_center' || Number.isFinite(c.tolerance))
      && histogramCorrect(c, work, bins);
    if (!ok) throw new Error(`A histogram ${c.challengeType} challenge cannot be answered as generated.`);
  }
  return d;
}

/** What the live adapter needs from the histogram; the catalog's `teachingWorkspace` declares the rest. */
export const histogramLiveDomain: WorkspaceDomain<HistogramData> = {
  validate: validateHistogramData,
  initialState: d => workspaceOpening({ title: d.title, task: workspaceAssignment(d.challenges[0]).task, total: d.challenges.length }),
};
