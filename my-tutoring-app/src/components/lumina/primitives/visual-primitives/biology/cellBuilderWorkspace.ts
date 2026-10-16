/**
 * cell-builder on the shared tutor/JEV teaching workspace (W1 minimal binding, plain shape; ROLLOUT C24).
 *
 * Each mission (eval mode) is one checked board over the lesson's cell model: every card gets an answer, then
 * "Check mission". Code owns every check against the generated key (`belongsInCell`, `correctZone`, the function
 * match, `expectedQuantity`); the tutor is told the board and the learner's work, never the key.
 *
 * Pure: the component, the adapter, the journey row and the tests read the same checks, misses, assignment and scene.
 */
import type { TeachingAssignment, WorkspaceScene } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { CellZone, QuantityLevel } from '../../../evaluation/types';
import type { CellBuilderChallengeType, CellBuilderData, OrganelleInfo } from './CellBuilder';

export type CellMissionPhase = CellBuilderChallengeType;

/** One checked board: a mission, or (simplify lever) the same mission on fewer structures. */
export interface CellMission {
  id: string;
  phase: CellMissionPhase;
  /** Practice only: the structures on the smaller board. */
  only?: readonly string[];
}

export const CELL_PHASES: CellMissionPhase[] = ['cell_inventory', 'organelle_placement', 'structure_function', 'cell_specialization'];

/** The missions a payload asks for, in canonical order: a pin, a blend, or (legacy, unpinned) all four. */
export function resolveCellBuilderPhases(data: Pick<CellBuilderData, 'challengeType' | 'challengeTypes'>): CellMissionPhase[] {
  const requested = data.challengeTypes?.length ? data.challengeTypes : data.challengeType ? [data.challengeType] : CELL_PHASES;
  return CELL_PHASES.filter(phase => requested.includes(phase));
}

export const ZONE_LABELS: Record<CellZone, string> = {
  center: 'Control center',
  'near-nucleus': 'Inner membrane network',
  // Not "Central storage": a card named "Large Central Vacuole" matched it by its word.
  'large-central': 'Main storage',
  peripheral: 'Cytoplasm',
  scattered: 'Distributed throughout',
  'membrane-associated': 'Cell boundary',
};

export const ZONE_NOTES: Record<CellZone, string> = {
  center: 'The information-holding core of the model',
  'near-nucleus': 'Structures that work closely with the nucleus',
  'large-central': 'A dominant storage compartment',
  peripheral: 'In the fluid interior, away from the core',
  scattered: 'Many copies spread across the interior',
  'membrane-associated': 'Attached to or acting at the outer boundary',
};

export const ZONE_ORDER: CellZone[] = ['membrane-associated', 'peripheral', 'center', 'near-nucleus', 'large-central', 'scattered'];

export const QUANTITY_LABELS: Record<QuantityLevel, string> = { few: 'Few', some: 'Some', many: 'Many', lots: 'Abundant' };
export const QUANTITY_OPTIONS: QuantityLevel[] = ['few', 'some', 'many', 'lots'];

/** What the component reads off the screen: the learner's answers on every board. */
export interface CellWork {
  sortDecisions: Readonly<Record<string, boolean>>;
  placements: Readonly<Record<string, CellZone>>;
  /** organelle id → the organelle id whose job card it was joined to */
  matchConnections: Readonly<Record<string, string>>;
  quantityAnswers: Readonly<Record<string, QuantityLevel>>;
}

export const EMPTY_WORK: CellWork = { sortDecisions: {}, placements: {}, matchConnections: {}, quantityAnswers: {} };

type Board = Pick<CellBuilderData, 'organelles' | 'functionMatches' | 'cellContext' | 'cellType'>;

const byName = (a: OrganelleInfo, b: OrganelleInfo) => a.name.localeCompare(b.name);

const labelWords = (text: string) => text.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4 && w !== 'cell');

/**
 * A structure whose name shares a word with its own region's label ("Cytoplasm" into "Cytoplasm"): placing it asks
 * nothing, so Build the model leaves it off the board. A word shared with another region's label is a fair lure and stays.
 */
export const namesOwnRegion = (o: Pick<OrganelleInfo, 'name' | 'correctZone'>) =>
  !!o.correctZone && labelWords(o.name).some(w => labelWords(ZONE_LABELS[o.correctZone!]).includes(w));

/**
 * The cards a board shows. Stock the cell: every structure, alphabetical (the generator lists the needed ones first,
 * so data order would sort the cards for the learner). The other missions: the needed structures; Tune the cell only
 * those with an abundance key. A practice board keeps only its structures.
 */
export function boardCards(board: Board, mission: CellMission): OrganelleInfo[] {
  const keep = (o: OrganelleInfo) => !mission.only || mission.only.includes(o.id);
  const valid = board.organelles.filter(o => o.belongsInCell && keep(o));
  if (mission.phase === 'cell_inventory') return board.organelles.filter(keep).sort(byName);
  if (mission.phase === 'cell_specialization') return valid.filter(o => o.expectedQuantity != null);
  if (mission.phase === 'organelle_placement') return valid.filter(o => o.correctZone != null && !namesOwnRegion(o));
  return valid.filter(o => board.functionMatches.some(m => m.organelleId === o.id));
}

const NAME_FILLER = new Set(['cell', 'cells', 'the', 'and', 'body', 'bodies']);
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A job card as the board shows it: every word built on a structure's name (five-letter stems of its words, "cell"
 * excepted) blanked, so no card names the structure it belongs to (contract: no giveaway wording).
 */
export function jobCardText(board: Pick<CellBuilderData, 'organelles'>, text: string): string {
  const stems = Array.from(new Set(board.organelles.flatMap(o => o.name.toLowerCase().split(/[^a-z]+/))
    .filter(w => w.length >= 4 && !NAME_FILLER.has(w)).map(w => w.slice(0, 5))));
  return stems.reduce((out, stem) => out.replace(new RegExp(`\\b${escapeRe(stem)}[a-z]*`, 'gi'), '___'), text);
}

/** The job cards on a Wire the jobs board: one per structure on it. */
export const boardJobs = (board: Board, mission: CellMission) => {
  const ids = new Set(boardCards(board, mission).map(o => o.id));
  return board.functionMatches.filter(m => ids.has(m.organelleId));
};

/** Every card has an answer, so Check mission is open. */
export function boardComplete(board: Board, mission: CellMission, work: CellWork): boolean {
  const cards = boardCards(board, mission);
  if (!cards.length) return false;
  switch (mission.phase) {
    case 'cell_inventory': return cards.every(o => work.sortDecisions[o.id] != null);
    case 'organelle_placement': return cards.every(o => work.placements[o.id] != null);
    case 'structure_function': return cards.every(o => work.matchConnections[o.id] != null);
    default: return cards.every(o => work.quantityAnswers[o.id] != null);
  }
}

/** Whether one card's answer matches the key. */
export function cardRight(o: OrganelleInfo, phase: CellMissionPhase, work: CellWork): boolean {
  switch (phase) {
    case 'cell_inventory': return work.sortDecisions[o.id] === o.belongsInCell;
    case 'organelle_placement': return !!o.correctZone && work.placements[o.id] === o.correctZone;
    case 'structure_function': return work.matchConnections[o.id] === o.id;
    default: return work.quantityAnswers[o.id] === o.expectedQuantity;
  }
}

export function boardScore(board: Board, mission: CellMission, work: CellWork): { right: number; total: number } {
  const cards = boardCards(board, mission);
  return { right: cards.filter(o => cardRight(o, mission.phase, work)).length, total: cards.length };
}

// ── Misses: the pattern on the checked board, never a guessed cause ─────────────

/** Stock the cell: a structure kept that the lesson says does not belong, a needed one rejected, or both. */
export type InventoryMiss = 'kept_impostor' | 'rejected_needed' | 'kept_and_rejected';
/**
 * Build the model, most specific first: every misplaced structure is a swap between "Cytoplasm" (one structure in the
 * fluid) and "Distributed throughout" (many copies); every one is a swap between "Control center" and "Inner membrane
 * network"; exactly one is misplaced; several are.
 */
export type PlacementMiss = 'cytoplasm_distributed_swap' | 'core_network_swap' | 'one_misplaced' | 'several_misplaced';
/** Wire the jobs: two structures hold each other's jobs, or more are wrong. */
export type FunctionMiss = 'two_swapped' | 'several_wrong';
/** Tune the cell: every wrong pick is below the key, above it, or some of each. */
export type QuantityMiss = 'too_little' | 'too_much' | 'both_ways';
export type CellBuilderMiss = InventoryMiss | PlacementMiss | FunctionMiss | QuantityMiss;

export const CELL_MISSES: Record<CellMissionPhase, readonly CellBuilderMiss[]> = {
  cell_inventory: ['kept_impostor', 'rejected_needed', 'kept_and_rejected'],
  organelle_placement: ['cytoplasm_distributed_swap', 'core_network_swap', 'one_misplaced', 'several_misplaced'],
  structure_function: ['two_swapped', 'several_wrong'],
  cell_specialization: ['too_little', 'too_much', 'both_ways'],
};

const pairIn = (a: CellZone | null | undefined, b: CellZone | null | undefined, pair: readonly CellZone[]) =>
  !!a && !!b && a !== b && pair.includes(a) && pair.includes(b);

export function cellMiss(board: Board, mission: CellMission, work: CellWork): CellBuilderMiss | undefined {
  const cards = boardCards(board, mission);
  const wrong = cards.filter(o => !cardRight(o, mission.phase, work));
  if (!wrong.length) return undefined;
  switch (mission.phase) {
    case 'cell_inventory': {
      const kept = wrong.some(o => !o.belongsInCell), rejected = wrong.some(o => o.belongsInCell);
      return kept && rejected ? 'kept_and_rejected' : kept ? 'kept_impostor' : 'rejected_needed';
    }
    case 'organelle_placement':
      if (wrong.every(o => pairIn(o.correctZone, work.placements[o.id], ['peripheral', 'scattered']))) return 'cytoplasm_distributed_swap';
      if (wrong.every(o => pairIn(o.correctZone, work.placements[o.id], ['center', 'near-nucleus']))) return 'core_network_swap';
      return wrong.length === 1 ? 'one_misplaced' : 'several_misplaced';
    case 'structure_function':
      return wrong.length === 2 && work.matchConnections[wrong[0].id] === wrong[1].id && work.matchConnections[wrong[1].id] === wrong[0].id
        ? 'two_swapped' : 'several_wrong';
    default: {
      const rank = (q: QuantityLevel | null | undefined) => QUANTITY_OPTIONS.indexOf(q as QuantityLevel);
      const low = wrong.some(o => rank(work.quantityAnswers[o.id]) < rank(o.expectedQuantity));
      const high = wrong.some(o => rank(work.quantityAnswers[o.id]) > rank(o.expectedQuantity));
      return low && high ? 'both_ways' : low ? 'too_little' : 'too_much';
    }
  }
}

// ── Assignment, work, scene ─────────────────────────────────────────────────

const cellName = (board: Board) => board.cellContext?.trim() || `${board.cellType} cell`;

const ASKS: Record<CellMissionPhase, (cell: string, n: string) => string> = {
  cell_inventory: (cell, n) => `Keep ${n}structures a ${cell} needs and reject the ones it does not, then press Check mission.`,
  organelle_placement: (cell, n) => `Move ${n}organelles of the ${cell} to the best-fit region of the cell model, then press Check mission.`,
  structure_function: (cell, n) => `Connect ${n}organelles of the ${cell} to the job each one does, then press Check mission.`,
  cell_specialization: (cell, n) => `Choose how much of ${n}organelles a ${cell} needs for its job, then press Check mission.`,
};

export const missionAsk = (board: Board, mission: CellMission) =>
  ASKS[mission.phase](cellName(board), mission.only ? `these ${mission.only.length} ` : 'the ');

export function workspaceAssignment(board: Board, mission: CellMission): TeachingAssignment {
  return { id: mission.id, task: missionAsk(board, mission), response: 'gesture' };
}

/** The learner's work on the board, in the words on screen. Never the key or a verdict. */
export function describeCellWork(board: Board, mission: CellMission, work: CellWork): string {
  const cards = boardCards(board, mission);
  const names = (list: OrganelleInfo[]) => list.map(o => o.name).join(', ') || 'none';
  switch (mission.phase) {
    case 'cell_inventory': {
      const open = cards.filter(o => work.sortDecisions[o.id] == null);
      return `Kept: ${names(cards.filter(o => work.sortDecisions[o.id] === true))}. Rejected: ${names(cards.filter(o => work.sortDecisions[o.id] === false))}.`
        + (open.length ? ` Not decided: ${names(open)}.` : '');
    }
    case 'organelle_placement': {
      const inZones = ZONE_ORDER.map(z => [z, cards.filter(o => work.placements[o.id] === z)] as const).filter(([, l]) => l.length);
      const open = cards.filter(o => !work.placements[o.id]);
      return [...inZones.map(([z, l]) => `${ZONE_LABELS[z]}: ${names([...l])}`), ...(open.length ? [`Not placed: ${names(open)}`] : [])]
        .join('. ') + '.';
    }
    case 'structure_function': {
      const jobText = (id: string) => jobCardText(board, board.functionMatches.find(m => m.organelleId === id)?.functionDescription ?? id);
      return cards.map(o => (work.matchConnections[o.id] ? `${o.name} → "${jobText(work.matchConnections[o.id])}"` : `${o.name} → no job yet`)).join('; ');
    }
    default:
      return cards.map(o => `${o.name}: ${work.quantityAnswers[o.id] ? QUANTITY_LABELS[work.quantityAnswers[o.id]] : 'not chosen'}`).join('; ');
  }
}

const CONSTRAINTS: Record<CellMissionPhase, string> = {
  cell_inventory: 'The learner taps Keep or Reject on every structure card and presses Check mission; the activity checks the '
    + 'board against the lesson\'s key, which you are not told. You cannot tap for the learner.',
  organelle_placement: 'The learner taps a structure in the organelle bay, then a region, for every structure, and presses Check '
    + 'mission; the activity checks the board against the lesson\'s key, which you are not told. You cannot place for the learner.',
  structure_function: 'The learner taps a structure, then the job card it does, for every structure, and presses Check mission; '
    + 'the activity checks the board against the lesson\'s key, which you are not told. You cannot tap for the learner.',
  cell_specialization: 'The learner picks Few, Some, Many or Abundant for every structure and presses Check mission; the '
    + 'activity checks the board against the lesson\'s key, which you are not told. You cannot pick for the learner.',
};

/** What is drawn and asked. No `belongsInCell`, region, job pairing or abundance key is published. */
export function workspaceScene(board: Board, mission: CellMission, work: CellWork, jobOrder?: readonly string[]): WorkspaceScene {
  const cards = boardCards(board, mission);
  const facts: Record<string, string | number> = {
    kind: mission.phase,
    cell: cellName(board),
    structuresOnBoard: cards.map(o => o.name).join(', '),
    learnerWork: describeCellWork(board, mission, work),
    constraints: CONSTRAINTS[mission.phase],
  };
  if (mission.phase === 'organelle_placement') {
    facts.regions = ZONE_ORDER.map(z => `${ZONE_LABELS[z]} (${ZONE_NOTES[z].toLowerCase()})`).join('; ');
  }
  if (mission.phase === 'structure_function') {
    const jobs = boardJobs(board, mission);
    const ordered = jobOrder ? jobOrder.map(id => jobs.find(j => j.organelleId === id)).filter(Boolean) as typeof jobs : jobs;
    facts.jobCards = ordered.map((j, i) => `${i + 1}. "${jobCardText(board, j.functionDescription)}"`).join(' ');
  }
  if (mission.phase === 'cell_specialization') {
    facts.levels = QUANTITY_OPTIONS.map(q => QUANTITY_LABELS[q]).join(', ');
    facts.structureJobs = cards.map(o => `${o.name}: ${o.function}`).join('; ');
  }
  return { objects: [], facts };
}

// ── The journey's learner (liveJourneySpec row, the dry sweep) ──────────────────

export type CellHarnessInput = { type: 'touch'; target: string } | { type: 'choose'; label: string };

/** The `data-pip-object` id of a job card: its place in the lesson's function list, never the structure it belongs to. */
export const jobTarget = (board: Board, organelleId: string) => `job-${board.functionMatches.findIndex(m => m.organelleId === organelleId)}`;

/**
 * Real-control inputs for one board: every card answered from the key, then Check mission. Wrong: the first card
 * answered wrong (an impostor kept, a region swapped, two jobs swapped, a level one step off), a complete wrong board.
 */
export function cellHarnessInputs(board: Board, mission: CellMission, wrong: boolean): CellHarnessInput[] {
  const cards = boardCards(board, mission);
  const touch = (target: string): CellHarnessInput => ({ type: 'touch', target });
  const check: CellHarnessInput = { type: 'choose', label: 'Check mission' };
  switch (mission.phase) {
    case 'cell_inventory': {
      const flip = cards.find(o => !o.belongsInCell) ?? cards[0];
      return [...cards.map(o => touch(`${(o.belongsInCell !== (wrong && o === flip)) ? 'keep' : 'reject'}-${o.id}`)), check];
    }
    case 'organelle_placement': {
      const swap: Partial<Record<CellZone, CellZone>> = { peripheral: 'scattered', scattered: 'peripheral', center: 'near-nucleus',
        'near-nucleus': 'center', 'large-central': 'peripheral', 'membrane-associated': 'peripheral' };
      return [...cards.flatMap((o, i) => [touch(`bay-${o.id}`),
        touch(`zone-${wrong && i === 0 ? swap[o.correctZone!] ?? 'peripheral' : o.correctZone}`)]), check];
    }
    case 'structure_function': {
      const job = (i: number) => {
        const o = cards[i];
        if (wrong && cards.length >= 2 && i < 2) return cards[1 - i].id;
        return o.id;
      };
      return [...cards.flatMap((o, i) => [touch(`structure-${o.id}`), touch(jobTarget(board, job(i)))]), check];
    }
    default: {
      const off = (q: QuantityLevel) => QUANTITY_OPTIONS[QUANTITY_OPTIONS.indexOf(q) === 0 ? 1 : QUANTITY_OPTIONS.indexOf(q) - 1];
      return [...cards.map((o, i) => touch(`level-${o.id}-${wrong && i === 0 ? off(o.expectedQuantity!) : o.expectedQuantity}`)), check];
    }
  }
}
