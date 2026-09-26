import type { HundredsChartData } from '../../../primitives/visual-primitives/math/HundredsChart';
import { CELL_TYPES, hundredsChartAssignment, neededCells } from '../../../primitives/visual-primitives/math/hundredsChartWorkspace';
import { validateChallengePool, workspaceOpening, type WorkspaceDomain } from './adapterContract';

/** Reject a challenge the chart cannot check: a cell mode needs numbers left to tap, a choice mode its key among the choices. */
export const validateHundredsChartData = (value: unknown): HundredsChartData => validateChallengePool<HundredsChartData>(value,
  c => !!c && typeof c.instruction === 'string' && !!c.instruction
    && (CELL_TYPES.has(c.type) ? Array.isArray(c.correctCells) && neededCells(c).length > 0
      : c.type === 'identify_pattern' ? Array.isArray(c.options) && c.options.includes(c.correctAnswer)
        : c.type === 'find_skip_value' && Array.isArray(c.options) && c.options.includes(String(c.skipValue))),
  { pool: 'Generated hundreds chart has invalid lesson content.', item: 'A hundreds-chart challenge cannot be checked.' });

/** What the live adapter needs from the hundreds chart; the catalog's `teachingWorkspace` declares the rest. */
export const hundredsChartLiveDomain: WorkspaceDomain<HundredsChartData> = {
  validate: validateHundredsChartData,
  initialState: data => workspaceOpening({ title: data.title, task: hundredsChartAssignment(data.challenges[0]).task,
    total: data.challenges.length }),
};
