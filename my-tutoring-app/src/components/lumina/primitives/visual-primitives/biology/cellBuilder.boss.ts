/**
 * The cell builder's boss (`components/live-activity/boss.ts`), bespoke because every mode is a board: the card is
 * `cellBuilder.card.ts`; this file validates a cell, lists its missions, asks one, carries the lever set and plays
 * the harness.
 */
import type { CellBuilderData } from './CellBuilder';
import { defineBoss, hasText as text } from '../../../components/live-activity/boss';
import { boardCards, CELL_PHASES, cellHarnessInputs, missionAsk, resolveCellBuilderPhases, type CellBuilderMiss,
  type CellMission } from './cellBuilderWorkspace';
import { CELL_LEVERS, fewerStructures, practiceParent } from './cellBuilderLevers';
import { cellBuilderCard } from './cellBuilder.card';

/**
 * Reject a cell model a mission cannot be checked on: no structures, duplicate ids, or a mission's board empty or
 * missing its key (a region, a job card, an abundance on a needed structure).
 */
export function validateCellBuilderData(value: unknown): CellBuilderData {
  const d = value as CellBuilderData;
  if (!d || !text(d.title) || !Array.isArray(d.organelles) || d.organelles.length < 2 || !Array.isArray(d.functionMatches))
    throw new Error('Generated cell builder has invalid lesson content.');
  const ids = d.organelles.map(o => o?.id);
  if (new Set(ids).size !== ids.length || d.organelles.some(o => !o || !text(o.id) || !text(o.name) || typeof o.belongsInCell !== 'boolean'))
    throw new Error('A generated cell-builder structure has no id, name or keep/reject key.');
  const valid = d.organelles.filter(o => o.belongsInCell);
  if (!valid.length) throw new Error('A generated cell has no structure that belongs in it.');
  for (const phase of resolveCellBuilderPhases(d)) {
    const cards = boardCards(d, { id: phase, phase });
    if (!cards.length) throw new Error(`The cell-builder ${phase} board has no structure to answer.`);
    if (phase === 'cell_inventory' && !d.organelles.some(o => !o.belongsInCell))
      throw new Error('The cell-builder cell_inventory board has no structure to reject.');
    if (phase === 'organelle_placement' && valid.some(o => !o.correctZone))
      throw new Error('A needed structure has no best-fit region.');
    if (phase === 'structure_function' && cards.length < valid.length)
      throw new Error('A needed structure has no job card.');
  }
  return d;
}

export const cellBuilderBoss = defineBoss<CellBuilderData, CellMission, CellBuilderMiss>({
  card: cellBuilderCard,
  validate: validateCellBuilderData,
  items: data => resolveCellBuilderPhases(data).map(phase => ({ id: phase, phase })),
  ask: (mission, data) => missionAsk(data, mission),
  levers: CELL_LEVERS,
  drive: {
    component: 'primitives/visual-primitives/biology/CellBuilder.tsx',
    instanceId: 'cell-builder',
    defaults: { grade: 'Grade 6', mode: 'cell_inventory', topic: 'Animal and plant cell structures' },
    mounted: '[data-pip-object="workspace"]',
    // Each mission is one board: answer every card from the key and press Check mission (wrong: the first card
    // answered wrong). The smaller practice board is rebuilt from its parent with the same builder.
    current: ctx => {
      const parent = practiceParent(ctx.itemId ?? '');
      const phase = (parent ?? ctx.itemId) as CellMission['phase'];
      if (!CELL_PHASES.includes(phase)) return undefined;
      const full: CellMission = { id: phase, phase };
      return parent ? fewerStructures(ctx.data as never, full) ?? undefined : full;
    },
    play: (right, mission, ctx) => cellHarnessInputs(ctx.data as never, mission, !right),
  },
});
