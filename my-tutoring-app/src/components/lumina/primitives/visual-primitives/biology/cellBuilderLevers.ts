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
import { leverSet } from '../../../components/live-activity/bossLevers';
import type { CellBuilderData, OrganelleInfo } from './CellBuilder';
import {
  boardCards, boardJobs, QUANTITY_LABELS, QUANTITY_OPTIONS, ZONE_LABELS, ZONE_NOTES,
  type CellMission, type CellMissionPhase,
} from './cellBuilderWorkspace';
import { CELL_MISSES } from './cellBuilder.card';
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

/** What the levers read beyond the mission: the lesson's cell. */
export interface CellLeverContext { board: Board }

type Lines = ReadonlyArray<readonly [string, string]>;
/** Each card's line, when at least half the board's cards have one (a lever that helps on a few cards misleads). */
function boardLines(board: Board, mission: CellMission, line: (o: OrganelleInfo) => string | null): Lines | null {
  const cards = boardCards(board, mission);
  const lines = cards.map(o => [o.name, line(o)] as const).filter((x): x is readonly [string, string] => !!x[1]);
  return cards.length > 0 && lines.length * 2 >= cards.length ? lines : null;
}
const listed = (lines: Lines) => lines.map(([n, l]) => `${n}: "${l}"`).join('; ');
/** A practice board has no levers. */
const onSession = <T>(fn: (m: CellMission, ctx: CellLeverContext) => T) =>
  (m: CellMission, ctx: CellLeverContext) => (isPractice(m) ? null : fn(m, ctx));
const jobs = onSession((m, { board }) => boardLines(board, m, o => jobLine(o, m.phase, board)));
const jobsFact = (lines: Lines) => `Under each structure, what it does: ${listed(lines)}.`;

/** Every lever of the four missions, by type, in the order the tutor sees them. Every lever answers every miss. */
export const CELL_LEVERS = leverSet<CellMission, CellLeverContext>({
  modeOf: m => m.phase,
  missesOf: mode => CELL_MISSES[mode as CellMissionPhase] ?? [],
  // What a line must not name: on Build the model a region, on Wire the jobs a job card (each also has its own
  // stem-level blanking rule above).
  answersOf: (m, { board }) => m.phase === 'organelle_placement' ? Object.values(ZONE_LABELS)
    : m.phase === 'structure_function' ? jobTexts(board, m) : [],
  specs: [
    { id: JOBS_LEVER, type: 'meaning', modes: ['cell_inventory'], carrier: 'shown', answers: 'all',
      when: 'The learner does not know what some structures do, so cannot tell whether this cell needs them.',
      does: 'Shows under each structure card what that structure does. Words naming a kind of cell are blanked, so it never says where the structure is found.',
      content: jobs, fact: jobsFact },
    { id: JOBS_LEVER, type: 'meaning', modes: ['organelle_placement'], carrier: 'shown', answers: 'all',
      when: 'The learner does not know what some structures do, so cannot reason about which region fits.',
      does: 'Shows under each structure in the bay what that structure does. Words naming a region are blanked, so it never names one.',
      content: jobs, fact: jobsFact },
    { id: HINTS_LEVER, type: 'clue', modes: ['structure_function'], carrier: 'shown', answers: 'all',
      when: 'The learner cannot picture what a structure is like, so cannot tell its job from the others.',
      does: 'Shows an everyday comparison under each structure (a factory, a gate). Words it shares with a job card are blanked, so it matches no card by its words.',
      content: onSession((m, { board }) => boardLines(board, m, o => hintLine(o, board))),
      fact: (lines: Lines) => `Under each structure, an everyday comparison: ${listed(lines)}.` },
    { id: LEVELS_LEVER, type: 'meaning', modes: ['cell_specialization'], carrier: 'shown', answers: 'all',
      when: 'The learner reads the levels as counts, or cannot tell Many from Abundant.',
      does: 'Shows under the choices what each level means against a typical cell (Few: fewer than a typical cell has, up to Abundant). It names no structure.',
      content: onSession(() => true), fact: `Under the level choices: ${levelLegend().join('; ')}.` },
    { id: FEWER_LEVER, type: 'easier', carrier: 'shown', answers: 'all',
      when: 'The learner cannot hold the whole board at once.',
      does: 'Opens a smaller board first: the same mission on about half of the structures. It is not graded; the full board comes back after it, with the learner\'s work on it cleared.',
      content: (m, { board }) => fewerStructures(board, m) },
  ],
});

/** The job cards of a board, so a test can assert no lever line copies one. */
export const jobTexts = (board: Board, mission: CellMission) => boardJobs(board, mission).map(j => j.functionDescription);

/** Region labels and notes, for the leak tests. */
export const regionWords = () => [...Object.values(ZONE_LABELS), ...Object.values(ZONE_NOTES)];
