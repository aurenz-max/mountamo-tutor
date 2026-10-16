import type { PlanetaryExplorerData } from '../../../primitives/visual-primitives/astronomy/PlanetaryExplorer';
import { askOf, planetItems } from '../../../primitives/visual-primitives/astronomy/planetaryExplorerWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

const TYPES = ['mc', 'compare', 'true-false'];

/** Reject a trip whose questions cannot be attempted: every check reads the question's own `correctIndex`. */
export function validatePlanetaryExplorerData(value: unknown): PlanetaryExplorerData {
  const d = value as PlanetaryExplorerData;
  if (!d || typeof d.title !== 'string' || !Array.isArray(d.planets) || !d.planets.length
      || d.planets.some(p => !p || typeof p.planetId !== 'string' || !p.planetId || !Array.isArray(p.keyStats) || !Array.isArray(p.questions))
      || new Set(d.planets.map(p => p.planetId)).size !== d.planets.length)
    throw new Error('Generated planetary explorer has invalid lesson content.');
  const items = planetItems(d.planets, d.quizQuestions ?? []);
  if (!items.length || items.length > 24) throw new Error('Generated planetary explorer has no askable question.');
  for (const { question: q } of items) {
    if (!q || typeof q.question !== 'string' || !q.question.trim() || !TYPES.includes(q.questionType)
        || !Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => typeof o !== 'string' || !o.trim())
        || new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length
        || !Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)
      throw new Error('A planetary-explorer question cannot be answered as generated.');
  }
  return d;
}

/** What the live adapter needs from the planetary explorer; the catalog's `teachingWorkspace` declares the rest. */
export const planetaryExplorerLiveDomain: WorkspaceDomain<PlanetaryExplorerData> = {
  validate: validatePlanetaryExplorerData,
  initialState: d => {
    const items = planetItems(d.planets, d.quizQuestions ?? []);
    return workspaceOpening({ title: d.title, task: askOf(items[0]), total: items.length });
  },
};
