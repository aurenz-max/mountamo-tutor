import type { StoryMapData } from '../../../primitives/visual-primitives/literacy/StoryMap';
import { arcLabels, storyMapItems, workspaceAssignment } from '../../../primitives/visual-primitives/literacy/storyMapWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const STRUCTURES = ['bme', 'story-mountain', 'plot-diagram', 'heros-journey'];
const text = (s: unknown) => typeof s === 'string' && !!s.trim();

/**
 * Reject a story map whose phases cannot be answered: a story, at least one named character and a setting to pick,
 * two or more events each in a part the structure draws, and (when the analyze phase is asked) a known conflict type.
 */
export function validateStoryMapData(value: unknown): StoryMapData {
  const d = value as StoryMapData;
  if (!d || !text(d.title) || !STRUCTURES.includes(d.structureType) || !d.passage || !text(d.passage.text)
      || !d.elements || !Array.isArray(d.elements.characters) || !d.elements.characters.length
      || d.elements.characters.some(c => !c || !text(c.name))
      || new Set(d.elements.characters.map(c => c.name)).size !== d.elements.characters.length
      || !d.elements.setting || !text(d.elements.setting.place) || !Array.isArray(d.events) || d.events.length < 2
      || new Set(d.events.map(e => e?.id)).size !== d.events.length)
    throw new Error('Generated story map has invalid lesson content.');
  const parts = new Set(arcLabels(d).map(z => z.key));
  if (d.events.some(e => !text(e.id) || !text(e.text) || !parts.has(e.arcPosition)))
    throw new Error(`A story-map ${d.structureType} event sits in a part the arc does not draw.`);
  return d;
}

/** What the live adapter needs from the story map; the catalog's `teachingWorkspace` declares the rest. */
export const storyMapLiveDomain: WorkspaceDomain<StoryMapData> = {
  validate: validateStoryMapData,
  initialState: d => {
    const items = storyMapItems(d);
    return workspaceOpening({ title: d.title, task: workspaceAssignment(items[0], d).task, total: items.length });
  },
};
