import type { DigitalSkillsSimData } from '../../../primitives/visual-primitives/core/DigitalSkillsSim';
import { askOf, resolveSkillModes, skillItems, validSkillItem } from '../../../primitives/visual-primitives/core/digitalSkillsWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a practice set a mode cannot be asked on: no title, a stored item code could not have built (every key is
 * computed from the item's pictures, boxes or letters, so nothing else is trusted), or a requested mode with no item.
 */
export function validateDigitalSkillsData(value: unknown): DigitalSkillsSimData {
  const d = value as DigitalSkillsSimData;
  if (!d || typeof d.title !== 'string' || !d.title.trim()) throw new Error('Generated digital skills practice has invalid lesson content.');
  if (Array.isArray(d.items) && d.items.some(i => !validSkillItem(i))) throw new Error('A generated digital skills item is not one code can key.');
  const items = skillItems(d);
  if (new Set(items.map(i => i.id)).size !== items.length) throw new Error('Generated digital skills items repeat an id.');
  for (const mode of resolveSkillModes(d)) {
    if (!items.some(i => i.mode === mode)) throw new Error(`The digital-skills ${mode} mode has no item.`);
  }
  return d;
}

/** What the live adapter needs from the practice set; the catalog's `teachingWorkspace` declares the rest. */
export const digitalSkillsSimLiveDomain: WorkspaceDomain<DigitalSkillsSimData> = {
  validate: validateDigitalSkillsData,
  initialState: d => {
    const items = skillItems(d);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
