import type { DiSpokenPracticeData } from '../../../primitives/visual-primitives/direct-instruction/DiSpokenPractice';
import { spokenPracticeAskFor, spokenPracticeItemValid } from '../../../primitives/visual-primitives/direct-instruction/diSpokenPracticeWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a pool whose items cannot be asked: a known mode, an ask and a key (and pictures to count). */
export function validateDiSpokenPracticeData(value: unknown): DiSpokenPracticeData {
  const d = value as DiSpokenPracticeData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.items) || !d.items.length || d.items.length > 12
      || new Set(d.items.map(item => item?.id)).size !== d.items.length)
    throw new Error('Generated spoken practice has invalid lesson content.');
  if (!d.items.every(spokenPracticeItemValid)) throw new Error('A spoken practice item cannot run in the teaching workspace.');
  return d;
}

/** What the live adapter needs from this family; the catalog's `teachingWorkspace` declares the rest. */
export const diSpokenPracticeLiveDomain: WorkspaceDomain<DiSpokenPracticeData> = {
  validate: validateDiSpokenPracticeData,
  initialState: data => workspaceOpening({ title: data.title, task: spokenPracticeAskFor(data.items[0]), total: data.items.length }),
};
