/**
 * The in-item levers on cell-builder (`/add-support-tiers`; report qa/eval-reports/cell-builder-levers-2026-10-15.md).
 * No real-learner evidence: the misses are what `cellMiss` observes; the failures behind them come from the contract
 * (`docs/contracts/cell-builder.md`: cytoplasm vs distributed, cell-type distractors) and the generator's distractor
 * pairings. Every lever starts released; no lever comes from the tier.
 *
 * - `structure_jobs` (help; Stock the cell, Build the model): each card shows what the structure does (its `function`
 *   line). On Stock the cell every word naming a kind of cell (plant, animal, bacteria, the lesson's own cell) is
 *   blanked, so the line never says where the structure is found; on Build the model every word of a region's name or
 *   note is blanked, so the line never names a region.
 * - `structure_hints` (help; Wire the jobs): each structure shows its everyday analogy, with every word it shares with
 *   its own job card blanked, so the hint never matches a card by its words.
 * - `level_meanings` (help; Tune the cell): under the level choices, what each level means against a typical cell. It
 *   names no structure.
 * - `fewer_structures` (simplify; every mission): the same mission on about half of the structures, ungraded, then the
 *   full board back. The smaller board is part of the lesson's own cell (there is no other cell to build from at
 *   runtime), so the full board's later answer is recorded with the lever.
 */
import type { WorkspaceLever } from '../../../components/live-activity/runtime/contract';
import type { CellBuilderData, OrganelleInfo } from './CellBuilder';
import {
  boardCards, boardJobs, CELL_MISSES, QUANTITY_LABELS, QUANTITY_OPTIONS, ZONE_LABELS, ZONE_NOTES,
  type CellMission, type CellMissionPhase,
} from './cellBuilderWorkspace';
import type { QuantityLevel } from '../../../evaluation/types';

type Board = Pick<CellBuilderData, 'organelles' | 'functionMatches' | 'cellContext' | 'cellType'>;

export const JOBS_LEVER = 'structure_jobs';
export const HINTS_LEVER = 'structure_hints';
export const LEVELS_LEVER = 'level_meanings';
export const FEWER_LEVER = 'fewer_structures';

const BLANK = '___';
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const blankStems = (text: string, stems: readonly string[]) =>
  stems.reduce((out, stem) => out.replace(new RegExp(`\\b${escape(stem)}[a-z]*`, 'gi'), BLANK), text);
const hasStem = (text: string, stems: readonly string[]) => stems.some(stem => new RegExp(`\\b${escape(stem)}`, 'i').test(text));

/** Words that say what kind of cell a structure is found in. */
const KIND_STEMS = ['plant', 'animal', 'bacteri', 'prokaryot', 'eukaryot', 'fung', 'yeast', 'mushroom', 'mold', 'green'];

/** The kind-of-cell stems for this lesson: the fixed list plus the words of its own cell ("muscle", "leaf", "root"). */
export function cellKindStems(board: Board): string[] {
  const own = `${board.cellContext ?? ''} ${board.cellType ?? ''}`.toLowerCase().split(/[^a-z]+/)
    .filter(w => w.length >= 4 && !['cell', 'cells', 'generic', 'specialized', 'typical'].includes(w));
  return Array.from(new Set([...KIND_STEMS, ...own])).sort((a, b) => b.length - a.length);
}

/** Leak rule, Stock the cell: a line shown on a card names no kind of cell. */
export const blankCellKinds = (text: string, board: Board) => blankStems(text, cellKindStems(board));
export const namesCellKind = (text: string, board: Board) => hasStem(text, cellKindStems(board));

/** Words of the regions' names and notes (and the places they stand for), as stems. */
export const REGION_STEMS = ['control', 'center', 'centre', 'central', 'core', 'middle', 'inner', 'network', 'stor', 'compartment',
  'cytoplasm', 'fluid', 'interior', 'inside', 'distribut', 'throughout', 'scatter', 'spread', 'everywhere', 'copies',
  'boundar', 'edge', 'outer', 'outside', 'surface', 'membrane', 'attached', 'nucle'];

/** Leak rule, Build the model: a line shown on a card names no region. */
export const blankRegionWords = (text: string) => blankStems(text, REGION_STEMS);
export const namesRegion = (text: string) => hasStem(text, REGION_STEMS)
  || Object.values(ZONE_LABELS).some(l => text.toLowerCase().includes(l.toLowerCase()));

const contentWords = (text: string) => Array.from(new Set(text.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5)));

/** Leak rule, Wire the jobs: a hint shares no word of five letters or more with its own job card. */
export function blankSharedWords(hint: string, job: string): string {
  const shared = contentWords(job).map(w => w.slice(0, 5));
  return blankStems(hint, shared);
}
export const sharesJobWords = (hint: string, job: string) => contentWords(job).some(w => hasStem(hint, [w.slice(0, 5)]));

const sayable = (line: string) => line.replace(/_+/g, ' ').split(/\s+/).filter(w => /[a-z]/i.test(w)).length >= 3;

/** The job line a card shows with `structure_jobs` pulled, or null when, blanked, it says too little. */
export function jobLine(o: OrganelleInfo, phase: CellMissionPhase, board: Board): string | null {
  const text = (o.function ?? '').trim();
  if (!text) return null;
  const line = phase === 'cell_inventory' ? blankCellKinds(text, board) : blankRegionWords(text);
  return sayable(line) ? line : null;
}

/** The analogy a structure shows with `structure_hints` pulled, or null when, blanked, it says too little. */
export function hintLine(o: OrganelleInfo, board: Board): string | null {
  const job = board.functionMatches.find(m => m.organelleId === o.id)?.functionDescription ?? '';
  const name = o.name.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4).map(w => w.slice(0, 5));
  const line = blankStems(blankSharedWords((o.analogy ?? '').trim(), job), name);
  return sayable(line) ? line : null;
}

/** What each level means, against a typical cell. Names no structure. */
export const LEVEL_MEANINGS: Record<QuantityLevel, string> = {
  few: 'fewer than a typical cell has',
  some: 'about what a typical cell has',
  many: 'more than a typical cell has',
  lots: 'far more than a typical cell has',
};
export const levelLegend = () => QUANTITY_OPTIONS.map(q => `${QUANTITY_LABELS[q]}: ${LEVEL_MEANINGS[q]}`);

const FEWER = '~fewer';
export const isPractice = (m: Pick<CellMission, 'id'>) => m.id.endsWith(FEWER);
export const practiceParent = (id: string) => (id.endsWith(FEWER) ? id.slice(0, -FEWER.length) : null);

/**
 * The smaller board: the same mission on about half of its structures (by name, the first half), at least two;
 * Stock the cell keeps at least one structure that does not belong. Null when the board is too small to shrink.
 */
export function fewerStructures(board: Board, mission: CellMission): CellMission | null {
  if (mission.only || isPractice(mission)) return null;
  const cards = boardCards(board, mission).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (cards.length < 4) return null;
  let only: string[];
  if (mission.phase === 'cell_inventory') {
    const needed = cards.filter(o => o.belongsInCell), impostors = cards.filter(o => !o.belongsInCell);
    if (needed.length < 2 || !impostors.length) return null;
    only = [...needed.slice(0, Math.max(2, Math.floor(needed.length / 2))), impostors[0]].map(o => o.id);
  } else {
    only = cards.slice(0, Math.max(2, Math.floor(cards.length / 2))).map(o => o.id);
  }
  if (only.length >= cards.length) return null;
  return { id: `${mission.id}${FEWER}`, phase: mission.phase, only };
}

/** The levers on the current session board. A practice board has none. */
export function cellLevers(board: Board, mission: CellMission | null, pulled: readonly string[]): WorkspaceLever[] {
  if (!mission || isPractice(mission)) return [];
  const cards = boardCards(board, mission);
  const all = CELL_MISSES[mission.phase];
  const lever = (id: string, kind: WorkspaceLever['kind'], when: string, does: string): WorkspaceLever =>
    ({ id, kind, carrier: 'shown', pulled: pulled.includes(id), answers: all, when, does });
  const half = (n: number) => cards.length > 0 && n * 2 >= cards.length;
  const out: WorkspaceLever[] = [];
  if (mission.phase === 'cell_inventory' && half(cards.filter(o => jobLine(o, mission.phase, board)).length)) {
    out.push(lever(JOBS_LEVER, 'help', 'The learner does not know what some structures do, so cannot tell whether this cell needs them.',
      'Shows under each structure card what that structure does. Words naming a kind of cell are blanked, so it never says where the structure is found.'));
  }
  if (mission.phase === 'organelle_placement' && half(cards.filter(o => jobLine(o, mission.phase, board)).length)) {
    out.push(lever(JOBS_LEVER, 'help', 'The learner does not know what some structures do, so cannot reason about which region fits.',
      'Shows under each structure in the bay what that structure does. Words naming a region are blanked, so it never names one.'));
  }
  if (mission.phase === 'structure_function' && half(cards.filter(o => hintLine(o, board)).length)) {
    out.push(lever(HINTS_LEVER, 'help', 'The learner cannot picture what a structure is like, so cannot tell its job from the others.',
      'Shows an everyday comparison under each structure (a factory, a gate). Words it shares with a job card are blanked, so it matches no card by its words.'));
  }
  if (mission.phase === 'cell_specialization') {
    out.push(lever(LEVELS_LEVER, 'help', 'The learner reads the levels as counts, or cannot tell Many from Abundant.',
      'Shows under the choices what each level means against a typical cell (Few: fewer than a typical cell has, up to Abundant). It names no structure.'));
  }
  if (fewerStructures(board, mission)) {
    out.push(lever(FEWER_LEVER, 'simplify', 'The learner cannot hold the whole board at once.',
      'Opens a smaller board first: the same mission on about half of the structures. It is not graded; the full board comes back after it, with the learner\'s work on it cleared.'));
  }
  return out;
}

/** What the pulled levers put on screen, as a scene fact. Never a key. */
export function leverFact(board: Board, mission: CellMission | null, pulled: readonly string[]): string {
  if (!mission || isPractice(mission)) return '';
  const cards = boardCards(board, mission);
  const parts: string[] = [];
  if (pulled.includes(JOBS_LEVER)) {
    const lines = cards.map(o => [o.name, jobLine(o, mission.phase, board)] as const).filter(([, l]) => l);
    parts.push(`Under each structure, what it does: ${lines.map(([n, l]) => `${n}: "${l}"`).join('; ')}.`);
  }
  if (pulled.includes(HINTS_LEVER)) {
    const lines = cards.map(o => [o.name, hintLine(o, board)] as const).filter(([, l]) => l);
    parts.push(`Under each structure, an everyday comparison: ${lines.map(([n, l]) => `${n}: "${l}"`).join('; ')}.`);
  }
  if (pulled.includes(LEVELS_LEVER)) parts.push(`Under the level choices: ${levelLegend().join('; ')}.`);
  return parts.join(' ');
}

/** The job cards of a board, so a test can assert no lever line copies one. */
export const jobTexts = (board: Board, mission: CellMission) => boardJobs(board, mission).map(j => j.functionDescription);

/** Region labels and notes, for the leak tests. */
export const regionWords = () => [...Object.values(ZONE_LABELS), ...Object.values(ZONE_NOTES)];
