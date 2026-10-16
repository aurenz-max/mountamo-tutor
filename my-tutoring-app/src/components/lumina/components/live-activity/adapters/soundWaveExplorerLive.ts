import type { SoundWaveExplorerData } from '../../../primitives/visual-primitives/physics/SoundWaveExplorer';
import { askOf, resolveSoundModes, soundItems, validSoundItem } from '../../../primitives/visual-primitives/physics/soundWaveWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a sound lab a mode cannot be asked on: no title, a stored item code could not have built (its key is computed
 * from the sound maker, the waves and the change, so nothing else is trusted), or a requested mode with no item.
 */
export function validateSoundWaveData(value: unknown): SoundWaveExplorerData {
  const d = value as SoundWaveExplorerData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated sound lab has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validSoundItem(i))) throw new Error('A generated sound-wave item is not one code can key.');
  const items = soundItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated sound-wave items repeat an id.');
  for (const mode of resolveSoundModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The sound-wave ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the sound lab; the catalog's `teachingWorkspace` declares the rest. */
export const soundWaveExplorerLiveDomain: WorkspaceDomain<SoundWaveExplorerData> = {
  validate: validateSoundWaveData,
  initialState: d => {
    const items = soundItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
