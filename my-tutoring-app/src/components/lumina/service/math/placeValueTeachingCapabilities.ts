import type { AdaptationTask, TeachingCapability } from '../generation/planLearningAdaptation';
import type { PlaceValueRemediationMove } from './placeValueRemediation';
import type { BaseTenRemediationMove } from './baseTenRemediation';
import { placeValueTaskAllowsContrast } from './placeValueRemediation';

// These describe activity affordances, not diagnosis phrases or source primitives.
export const placeValueTeaching: TeachingCapability<PlaceValueRemediationMove> = {
  activity: 'place-value-chart',
  task: 'Name a highlighted digit\'s position, say its numeric worth, and write dictated whole numbers.',
  moves: [
    { id: 'contrast_digit_worth', description: 'Pair the same nonzero digit in different positions, asking its worth in each. Makes the contribution of position observable while holding digit identity constant.' },
    { id: 'contrast_place_name_and_value', description: 'Pair place-name and numeric-worth questions for the same highlighted digit across positions. Separates the label of a position from the quantity it represents.' },
  ],
};
export const baseTenTeaching: TeachingCapability<BaseTenRemediationMove> = {
  activity: 'base-ten-blocks',
  task: 'Read a block mat representing a written whole number: each column\'s block count represents its written digit, and the size of each block represents that column\'s unit. Say the count of blocks in a column and then their total numeric worth. Does not ask for symbolic place names.',
  moves: [{ id: 'contrast_block_count_and_worth', description: 'Pair equal counts of blocks of different sizes, asking count and total worth. Holds the represented digit constant while changing its positional unit, making the changing quantity concrete. Separates how many blocks from how much they represent; does not practice naming a position.' }],
};

export function eligiblePlaceValueTeaching(task: AdaptationTask): boolean {
  return task.mode === 'compare' && task.tier === 'medium' && placeValueTaskAllowsContrast(task);
}
export function eligibleBaseTenTeaching(task: AdaptationTask): boolean {
  return task.grade === '4' && task.mode === 'read_blocks' && task.tier === 'medium' && placeValueTaskAllowsContrast(task);
}
