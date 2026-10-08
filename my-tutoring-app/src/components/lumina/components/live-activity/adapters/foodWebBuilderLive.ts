import type { FoodWebBuilderData, FoodWebChallenge } from '../../../primitives/visual-primitives/biology/FoodWebBuilder';
import { feedingChains, feedingRelations, workspaceAssignment } from '../../../primitives/visual-primitives/biology/foodWebWorkspace';
import { workspaceOpening, type WorkspaceDomain } from './adapterContract';

/**
 * Reject a food web that cannot be attempted: no organisms or feeding relations, an arrow to an unknown organism, or
 * (build_chain) a chain target the lesson's own feeding relations cannot make.
 */
export function validateFoodWebBuilderData(value: unknown): FoodWebBuilderData {
  const d = value as FoodWebBuilderData;
  if (!d || typeof d.ecosystem !== 'string' || !Array.isArray(d.organisms) || d.organisms.length < 2
      || !Array.isArray(d.correctConnections) || !d.correctConnections.length)
    throw new Error('Generated food web has invalid lesson content.');
  const ids = new Set(d.organisms.map(o => o?.id));
  if (d.correctConnections.some(c => !ids.has(c?.fromId) || !ids.has(c?.toId)))
    throw new Error('A generated food web arrow names an organism that is not in the web.');
  if (d.challengeType === 'build_chain') {
    const chains = feedingChains(d.organisms, feedingRelations(d.organisms, d.correctConnections), 8);
    const items = d.challenges ?? [];
    if (!items.length || items.length > 8 || new Set(items.map(c => c?.id)).size !== items.length)
      throw new Error('Generated food chain lesson has no askable chains.');
    for (const c of items) {
      if (c?.type !== 'build_chain' || !chains.some(p => p.length === c.length && p[p.length - 1] === c.endId))
        throw new Error(`A food chain target (${c?.id}) cannot be built from this web's feeding relations.`);
    }
  }
  return d;
}

const firstItem = (d: FoodWebBuilderData): FoodWebChallenge =>
  d.challengeType === 'build_chain' && d.challenges?.[0] ? d.challenges[0] : { id: 'web', type: 'complete_web' };

/** What the live adapter needs from the food web; the catalog's `teachingWorkspace` declares the rest. */
export const foodWebBuilderLiveDomain: WorkspaceDomain<FoodWebBuilderData> = {
  validate: validateFoodWebBuilderData,
  initialState: d => workspaceOpening({ title: d.ecosystem, task: workspaceAssignment(firstItem(d), d.ecosystem).task,
    total: d.challengeType === 'build_chain' ? d.challenges?.length ?? 0 : 1 }),
};
