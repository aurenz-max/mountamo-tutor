import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { CellBuilderMetrics, CellZone, QuantityLevel } from '../../../evaluation/types';
import {
  LuminaActionButton,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChoiceChip,
  LuminaDropZone,
  LuminaFeedbackCard,
  LuminaModeTabs,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  answerStateClass,
  type DropZoneState,
} from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FlaskConical,
  GripVertical,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  boardCards, boardComplete, boardJobs, boardScore, cardRight, cellMiss, describeCellWork, EMPTY_WORK, jobCardText, jobTarget,
  QUANTITY_LABELS, QUANTITY_OPTIONS, resolveCellBuilderPhases, workspaceAssignment, workspaceScene, ZONE_LABELS, ZONE_NOTES, ZONE_ORDER,
  type CellMission, type CellWork,
} from './cellBuilderWorkspace';
import {
  blankCellKinds, CELL_LEVERS, HINTS_LEVER, hintLine, JOBS_LEVER, jobLine,
  levelLegend, LEVELS_LEVER,
} from './cellBuilderLevers';

/**
 * A routable set of cell-biology missions, not a mandatory three-page
 * worksheet. Pinned eval modes present one task identity; broad objectives may
 * blend missions. Placement uses discrete model relationships because real
 * organelles move in 3D and overlapping pixel rectangles are neither honest
 * biology nor discriminating evidence.
 *
 * On the shared teaching workspace (W1, plain shape; `cellBuilderWorkspace.ts`) each mission is one checked board:
 * Check mission commits through `progress.commitCheck` with a named miss, a wrong board shows only how many are
 * right (no per-card marks or reveals, which would hand over the key before Try again), Try again keeps the work,
 * and the runtime moves to the next mission. The levers live in `cellBuilderLevers.ts`.
 */

export type { CellZone } from '../../../evaluation/types';

export type CellBuilderChallengeType =
  | 'cell_inventory'
  | 'organelle_placement'
  | 'structure_function'
  | 'cell_specialization';

export interface OrganelleInfo {
  id: string;
  name: string;
  function: string;
  analogy: string;
  uniqueTo: string | null;
  belongsInCell: boolean;
  distractorExplanation?: string | null;
  correctZone: CellZone | null;
  sizeRelative: 'small' | 'medium' | 'large';
  expectedQuantity?: QuantityLevel | null;
  quantityReasoning?: string | null;
}

export interface CellMembraneInfo {
  description: string;
  function: string;
}

export interface CellWallInfo {
  present: boolean;
  description: string | null;
}

export interface FunctionMatch {
  organelleId: string;
  functionDescription: string;
}

export interface CellBuilderData {
  title: string;
  description: string;
  cellType: 'animal' | 'plant' | 'prokaryotic' | 'fungal';
  cellContext: string;
  organelles: OrganelleInfo[];
  functionMatches: FunctionMatch[];
  cellMembrane: CellMembraneInfo;
  cellWall: CellWallInfo;
  gradeBand: '4-5' | '6-8';
  challengeType?: CellBuilderChallengeType;
  challengeTypes?: CellBuilderChallengeType[];
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CellBuilderMetrics>) => void;
}

interface CellBuilderProps {
  data: CellBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

type Phase = CellBuilderChallengeType;

const PHASE_LABELS: Record<Phase, string> = {
  cell_inventory: 'Stock the cell',
  organelle_placement: 'Build the model',
  structure_function: 'Wire the jobs',
  cell_specialization: 'Tune the cell',
};

const PHASE_PROMPTS: Record<Phase, string> = {
  cell_inventory: 'Choose the structures this cell actually needs. Reject the impostors.',
  organelle_placement: 'Move each organelle to the best-fit region in this simplified cell model.',
  structure_function: 'Connect each organelle to the job it performs.',
  cell_specialization: 'Tune organelle abundance so this cell can carry out its specialized mission.',
};

function organelleColor(name: string): string {
  const value = name.toLowerCase();
  if (value.includes('nucleus')) return '#818cf8';
  if (value.includes('mitochond')) return '#fb7185';
  if (value.includes('chloroplast')) return '#4ade80';
  if (value.includes('ribosome')) return '#c084fc';
  if (value.includes('golgi')) return '#fbbf24';
  if (value.includes('reticulum')) return '#60a5fa';
  if (value.includes('lysosome')) return '#f472b6';
  if (value.includes('vacuole')) return '#22d3ee';
  if (value.includes('wall')) return '#a3e635';
  if (value.includes('membrane')) return '#2dd4bf';
  return '#94a3b8';
}

function score(correct: number, total: number): number {
  return total === 0 ? 100 : Math.round((correct / total) * 100);
}

function OrganelleGlyph({ organelle, small = false }: { organelle: OrganelleInfo; small?: boolean }) {
  const color = organelleColor(organelle.name);
  const elongated = /mitochond|golgi|reticulum|flagell/i.test(organelle.name);
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center border-2 ${elongated ? 'rounded-[55%_35%_55%_35%]' : 'rounded-full'} ${small ? 'h-7 w-7' : 'h-10 w-10'}`}
      style={{ borderColor: color, backgroundColor: `${color}24`, boxShadow: `0 0 14px ${color}35` }}
    >
      <span
        className={elongated ? 'h-1.5 w-4 rounded-full' : 'h-2.5 w-2.5 rounded-full'}
        style={{ backgroundColor: `${color}b8` }}
      />
    </span>
  );
}

export { resolveCellBuilderPhases };

type Checked = Record<Phase, boolean>;
const NONE_CHECKED: Checked = { cell_inventory: false, organelle_placement: false, structure_function: false, cell_specialization: false };

const useCellProgress = useWorkspaceProgressFor('cell-builder');

const CellBuilderSurface = ({ data, className, runtimePlanItemId }: CellBuilderProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    cellType,
    cellContext,
    organelles,
    functionMatches,
    cellMembrane,
    cellWall,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const board = data;

  const phases = useMemo(() => resolveCellBuilderPhases(data), [data.challengeType, data.challengeTypes]);
  const missions = useMemo<CellMission[]>(() => phases.map(phase => ({ id: phase, phase })), [phases]);
  const validOrganelles = useMemo(() => organelles.filter((item) => item.belongsInCell), [organelles]);
  const distractors = useMemo(() => organelles.filter((item) => !item.belongsInCell), [organelles]);
  const quantityOrganelles = useMemo(
    () => validOrganelles.filter((item) => item.expectedQuantity != null),
    [validOrganelles],
  );

  const stableInstanceId = useRef(instanceId ?? `cell-builder-${Date.now()}`);

  // ── Mission progress: the runtime moves the index. ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useCellProgress({
    challenges: missions,
    getChallengeId: m => m.id,
    instanceId: stableInstanceId.current, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: m => workspaceAssignment(board, m),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const phaseIndex = Math.min(progress.currentIndex, Math.max(missions.length - 1, 0));
  const sessionMission = missions[phaseIndex] ?? { id: 'cell_inventory', phase: 'cell_inventory' as const };
  /** A checked board stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  // Levers (`cellBuilderLevers.ts`), keyed by the session mission they were pulled on, and the smaller practice board.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CellMission | null>(null);
  const mission = practice ?? sessionMission;
  const currentPhase = mission.phase;
  const pulledLevers = leverState.item === sessionMission.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  const cards = boardCards(board, mission);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<CellBuilderMetrics>({
    primitiveType: 'cell-builder',
    instanceId: stableInstanceId.current,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  const [sortDecisions, setSortDecisions] = useState<Record<string, boolean>>({});
  const [placements, setPlacements] = useState<Record<string, CellZone>>({});
  const [selectedOrganelle, setSelectedOrganelle] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<CellZone | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedMatchOrganelle, setSelectedMatchOrganelle] = useState<string | null>(null);
  const [matchConnections, setMatchConnections] = useState<Record<string, string>>({});
  const [quantityAnswers, setQuantityAnswers] = useState<Record<string, QuantityLevel>>({});
  const [phaseChecked, setPhaseChecked] = useState<Checked>(NONE_CHECKED);
  /** Whether the last check of a board was right (the workspace path marks cards only on a right one). */
  const [checkedRight, setCheckedRight] = useState<Checked>(NONE_CHECKED);
  const [feedback, setFeedback] = useState<string | null>(null);
  /** The first committed answer on each mission: the evidence the report scores (contract 6). */
  const firstWork = useRef<Partial<Record<Phase, CellWork>>>({});

  const work: CellWork = { sortDecisions, placements, matchConnections, quantityAnswers };
  const sortChecked = phaseChecked.cell_inventory;
  const placeChecked = phaseChecked.organelle_placement;
  const matchChecked = phaseChecked.structure_function;
  const quantityChecked = phaseChecked.cell_specialization;

  const shuffledFunctions = useMemo(() => {
    const values = [...functionMatches];
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }, [functionMatches]);
  const boardJobIds = new Set(boardJobs(board, mission).map(j => j.organelleId));
  const shownJobs = shuffledFunctions.filter(j => boardJobIds.has(j.organelleId));

  /** Clear one mission's work (a fresh board, a practice board, the full board back after one). */
  const clearPhase = (phase: Phase) => {
    if (phase === 'cell_inventory') setSortDecisions({});
    if (phase === 'organelle_placement') { setPlacements({}); setSelectedOrganelle(null); setDragOverZone(null); }
    if (phase === 'structure_function') { setMatchConnections({}); setSelectedMatchOrganelle(null); }
    if (phase === 'cell_specialization') setQuantityAnswers({});
    setPhaseChecked(prev => ({ ...prev, [phase]: false }));
    setCheckedRight(prev => ({ ...prev, [phase]: false }));
    setFeedback(null);
  };

  // Workspace path: a fresh mission ends any practice; Try again KEEPS the board and reopens it for revision.
  openItem.current = (index, retry) => {
    const phase = missions[index]?.phase;
    if (!phase) return;
    if (!retry) { setPractice(null); setPhaseChecked(prev => ({ ...prev, [phase]: false })); setFeedback(null); return; }
    setSelectedOrganelle(null); setSelectedMatchOrganelle(null);
    setPhaseChecked(prev => ({ ...prev, [phase]: false }));
  };

  /** Whether the board's answers are locked: checked, or closed until Try again. */
  const locked = phaseChecked[currentPhase] || learnerBlocked();
  /** Per-card right/wrong marks and corrective reveals: only after a right check. */
  const marks = phaseChecked[currentPhase] && checkedRight[currentPhase];

  const placeOrganelle = useCallback((organelleId: string, zone: CellZone) => {
    if (locked) return;
    setPlacements((previous) => ({ ...previous, [organelleId]: zone }));
    setSelectedOrganelle(null);
    setDragOverZone(null);
    setFeedback(null);
    SoundManager.snap();
  }, [locked]);

  const handleZoneDrop = useCallback((event: React.DragEvent<HTMLDivElement>, zone: CellZone) => {
    event.preventDefault();
    const organelleId = event.dataTransfer.getData('text/plain') || selectedOrganelle;
    if (organelleId) placeOrganelle(organelleId, zone);
  }, [placeOrganelle, selectedOrganelle]);

  const checkCurrentPhase = () => {
    if (locked || !boardComplete(board, mission, work)) return;
    const { right, total } = boardScore(board, mission, work);
    const miss = cellMiss(board, mission, work);
    const isPerfect = !miss;
    if (!practice && !firstWork.current[currentPhase]) firstWork.current[currentPhase] = { ...work };
    setPhaseChecked(prev => ({ ...prev, [currentPhase]: true }));
    setCheckedRight(prev => ({ ...prev, [currentPhase]: isPerfect }));
    progress.commitCheck(describeCellWork(board, mission, work), isPerfect, miss);

    const noun: Record<Phase, string> = {
      cell_inventory: 'structures correctly identified',
      organelle_placement: 'organelles placed in their best-fit model region',
      structure_function: 'organelle jobs correctly connected',
      cell_specialization: "abundance choices fit this cell's mission",
    };
    setFeedback(`${right} of ${total} ${noun[currentPhase]}.`);
    if (isPerfect) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
  };

  /** The report's metrics, from the given work on each mission. */
  const buildMetrics = (w: (phase: Phase) => CellWork, checked: Checked): { metrics: CellBuilderMetrics; overall: number; allCorrect: boolean; studentWork: Record<string, unknown> } => {
    const inv = w('cell_inventory'), place = w('organelle_placement'), match = w('structure_function'), qty = w('cell_specialization');
    const sortResults = organelles.map((item) => ({
      organelleId: item.id,
      belongsInCell: item.belongsInCell,
      studentSaidBelongs: inv.sortDecisions[item.id] ?? false,
      isCorrect: inv.sortDecisions[item.id] === item.belongsInCell,
    }));
    const correctlySorted = sortResults.filter((item) => item.isCorrect).length;
    const sortAccuracy = score(correctlySorted, organelles.length);

    // Build the model scores its own board (a structure named after its region is not on it).
    const placeCards = boardCards(board, { id: 'organelle_placement', phase: 'organelle_placement' });
    const zonePlacements = placeCards.map((item) => ({
      organelleId: item.id,
      correctZone: item.correctZone!,
      placedZone: place.placements[item.id] ?? null,
      isCorrect: place.placements[item.id] === item.correctZone,
    }));
    const correctZonePlacements = zonePlacements.filter((item) => item.isCorrect).length;
    const zoneAccuracy = score(correctZonePlacements, placeCards.length);

    const quantityResults = quantityOrganelles.map((item) => ({
      organelleId: item.id,
      expectedQuantity: item.expectedQuantity!,
      studentQuantity: qty.quantityAnswers[item.id] ?? null,
      isCorrect: qty.quantityAnswers[item.id] === item.expectedQuantity,
    }));
    const quantityQuestionsCorrect = quantityResults.filter((item) => item.isCorrect).length;
    const quantityAccuracy = score(quantityQuestionsCorrect, quantityOrganelles.length);

    const functionMatchResults = validOrganelles.map((item) => ({
      organelleId: item.id,
      selectedFunctionId: match.matchConnections[item.id] ?? null,
      correctFunctionId: item.id,
      isCorrect: match.matchConnections[item.id] === item.id,
    }));
    const correctFunctionMatches = functionMatchResults.filter((item) => item.isCorrect).length;
    const functionMatchAccuracy = score(correctFunctionMatches, validOrganelles.length);

    const phaseScores: Record<Phase, number> = {
      cell_inventory: sortAccuracy,
      organelle_placement: zoneAccuracy,
      structure_function: functionMatchAccuracy,
      cell_specialization: quantityAccuracy,
    };
    const overall = Math.round(phases.reduce((sum, phase) => sum + phaseScores[phase], 0) / Math.max(phases.length, 1));
    const allCorrect = phases.every((phase) => phaseScores[phase] === 100);

    const metrics: CellBuilderMetrics = {
      type: 'cell-builder',
      cellType,
      cellContext,
      gradeBand: data.gradeBand,
      phase1Completed: phases.includes('cell_inventory') ? checked.cell_inventory : false,
      phase2Completed: phases.includes('organelle_placement') ? checked.organelle_placement : checked.cell_specialization,
      phase3Completed: phases.includes('structure_function') ? checked.structure_function : false,
      allPhasesCompleted: phases.every((phase) => checked[phase]),
      totalOrganelles: organelles.length,
      validOrganelles: validOrganelles.length,
      distractorOrganelles: distractors.length,
      correctlySorted,
      sortAccuracy,
      sortResults,
      totalToPlace: placeCards.length,
      correctZonePlacements,
      incorrectZonePlacements: placeCards.length - correctZonePlacements,
      unplacedOrganelles: placeCards.filter(item => !place.placements[item.id]).length,
      zoneAccuracy,
      zonePlacements,
      quantityQuestionsTotal: quantityOrganelles.length,
      quantityQuestionsCorrect,
      quantityAccuracy,
      quantityResults,
      totalFunctionMatches: validOrganelles.length,
      correctFunctionMatches,
      functionMatchAccuracy,
      functionMatchResults,
      allCorrect,
      accuracy: overall,
    };
    return { metrics, overall, allCorrect, studentWork: { activeMissions: phases, sortDecisions: inv.sortDecisions,
      placements: place.placements, matchConnections: match.matchConnections, quantityAnswers: qty.quantityAnswers } };
  };

  // Under a lesson's evaluation provider only: the scored session, from each mission's first answer.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const done: Checked = { ...NONE_CHECKED, ...Object.fromEntries(phases.map(p => [p, true])) };
    const { metrics, studentWork } = buildMetrics(phase => firstWork.current[phase] ?? EMPTY_WORK, done);
    submitResult(result.passed, result.accuracy, { ...metrics, accuracy: result.accuracy },
      { studentWork, challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  /** Clear this board only; the session's missions and attempts stay the runtime's. */
  const handleReset = () => {
    if (!learnerBlocked() && !phaseChecked[currentPhase]) clearPhase(currentPhase);
  };

  const currentComplete = phaseChecked[currentPhase];
  const canCheck = boardComplete(board, mission, work);

  const modeTabs = phases.map((phase) => ({ value: phase, label: PHASE_LABELS[phase] }));
  const cellTypeLabel = `${cellType.charAt(0).toUpperCase()}${cellType.slice(1)} cell`;

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    const scene = workspaceScene(board, mission, work, shownJobs.map(j => j.organelleId));
    const onScreen = practice ? '' : CELL_LEVERS.onScreen(sessionMission, { board }, pulledLevers);
    const levers = practice ? [] : CELL_LEVERS.declare(sessionMission, { board }, pulledLevers);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this board.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionMission.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const smaller = CELL_LEVERS.simpler(sessionMission, { board }, id);
          if (!smaller) return 'This board is too small to shrink; try a help lever.';
          setLeverState(pulled); clearPhase(smaller.phase); setPractice(smaller);
          return { practice: workspaceAssignment(board, smaller) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearPhase(sessionMission.phase); setPractice(null); },
    };
  });

  const jobsOn = leverOn(JOBS_LEVER);
  const hintsOn = leverOn(HINTS_LEVER);
  const levelsOn = leverOn(LEVELS_LEVER);

  return (
    <LuminaCard className={['overflow-hidden shadow-2xl', className].filter(Boolean).join(' ')}>
      <LuminaCardHeader className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <LuminaCardTitle className="flex items-center gap-2 text-xl">
              <FlaskConical className="h-5 w-5 text-emerald-400" />
              {title}
            </LuminaCardTitle>
            <LuminaCardDescription className="mt-1 max-w-3xl">{description}</LuminaCardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <LuminaBadge accent="emerald">{cellContext || cellTypeLabel}</LuminaBadge>
            <LuminaBadge accent="cyan">Grade {data.gradeBand}</LuminaBadge>
          </div>
        </div>
        <LuminaModeTabs tabs={modeTabs} active={currentPhase} accent="emerald" className="relative mt-4" />
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5 pt-6">
        <LuminaPrompt accent="emerald">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300" {...(practice ? { 'data-practice': 'fewer-structures' } : {})}>
                {practice ? `A smaller board first: ${cards.length} structures` : `Mission ${phaseIndex + 1} of ${phases.length}`}
              </div>
              <div className="mt-1">{PHASE_PROMPTS[currentPhase]}</div>
            </div>
          </div>
        </LuminaPrompt>

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the board as the region it outlines. */}
        <PipDock />
        <PipWorkspace>
        {currentPhase === 'cell_inventory' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((organelle) => {
              const decision = sortDecisions[organelle.id];
              const correct = decision === organelle.belongsInCell;
              const state = !marks ? decision == null ? 'idle' : 'selected' : correct ? 'correct' : 'incorrect';
              const job = jobsOn ? jobLine(organelle, currentPhase, board) : null;
              return (
                <div key={organelle.id} className={`rounded-xl border p-3 ${answerStateClass(state)}`}>
                  <div className="flex items-center gap-3">
                    <OrganelleGlyph organelle={organelle} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100">{organelle.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{blankCellKinds(organelle.analogy ?? '', board)}</div>
                      {job && <div data-lever={JOBS_LEVER} className="mt-1 text-xs text-cyan-200">{job}</div>}
                    </div>
                    <div className="flex gap-1">
                      <LuminaButton size="sm" data-pip-object={`keep-${organelle.id}`} tone={decision === true ? 'primary' : 'subtle'} disabled={locked} onClick={() => setSortDecisions((previous) => ({ ...previous, [organelle.id]: true }))}>Keep</LuminaButton>
                      <LuminaButton size="sm" data-pip-object={`reject-${organelle.id}`} tone={decision === false ? 'danger' : 'subtle'} disabled={locked} onClick={() => setSortDecisions((previous) => ({ ...previous, [organelle.id]: false }))}>Reject</LuminaButton>
                    </div>
                  </div>
                  {marks && !correct && (
                    <p className="mt-2 border-t border-white/10 pt-2 text-xs text-amber-200">
                      {organelle.belongsInCell ? `${organelle.name} belongs in this cell.` : organelle.distractorExplanation ?? `${organelle.name} does not belong in a ${cellContext}.`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {currentPhase === 'organelle_placement' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="max-w-2xl text-xs text-slate-400">This is a relationship map, not a literal floor plan: organelles move, cells are 3D, and “distributed” means many copies.</p>
              <LuminaButton size="sm" tone="subtle" onClick={() => setShowLabels((value) => !value)}>
                {showLabels ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                {showLabels ? 'Hide notes' : 'Show notes'}
              </LuminaButton>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,1.5fr)]">
              <LuminaPanel className="space-y-2">
                <LuminaSectionLabel accent="cyan">Organelle bay</LuminaSectionLabel>
                {cards.map((organelle) => {
                  const placed = placements[organelle.id];
                  const selected = selectedOrganelle === organelle.id;
                  const job = jobsOn ? jobLine(organelle, currentPhase, board) : null;
                  return (
                    <button
                      key={organelle.id}
                      type="button"
                      data-pip-object={`bay-${organelle.id}`}
                      draggable={!locked}
                      disabled={locked}
                      onDragStart={(event) => { event.dataTransfer.setData('text/plain', organelle.id); setSelectedOrganelle(organelle.id); }}
                      onClick={() => setSelectedOrganelle(selected ? null : organelle.id)}
                      className={`flex w-full flex-col rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100' : placed ? 'border-white/10 bg-white/[0.03] text-slate-500' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                    >
                      <span className="flex w-full items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0" />
                        <OrganelleGlyph organelle={organelle} small />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{organelle.name}</span>
                        {placed && <span className="text-[10px] uppercase tracking-wider">{ZONE_LABELS[placed]}</span>}
                      </span>
                      {job && <span data-lever={JOBS_LEVER} className="mt-1 pl-6 text-[11px] font-normal text-cyan-200">{job}</span>}
                    </button>
                  );
                })}
              </LuminaPanel>

              <div className={`relative overflow-hidden rounded-[2.5rem] border p-4 ${cellWall.present ? 'border-lime-400/40' : 'border-teal-400/30'} bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.13),rgba(15,23,42,0.35)_68%)]`}>
                <div className="pointer-events-none absolute inset-3 rounded-[2rem] border border-teal-300/20" />
                <div className="relative grid min-h-[470px] grid-cols-2 gap-3 sm:grid-cols-3">
                  {ZONE_ORDER.map((zone) => {
                    const zoneOrganelles = cards.filter((item) => placements[item.id] === zone);
                    const zoneCorrect = marks && zoneOrganelles.every((item) => item.correctZone === zone);
                    const containsIncorrect = marks && zoneOrganelles.some((item) => item.correctZone !== zone);
                    const state: DropZoneState = dragOverZone === zone ? 'dragOver' : containsIncorrect ? 'incorrect' : zoneCorrect && zoneOrganelles.length > 0 ? 'correct' : zoneOrganelles.length > 0 ? 'filled' : 'idle';
                    return (
                      <LuminaDropZone
                        key={zone}
                        state={state}
                        data-pip-object={`zone-${zone}`}
                        className="min-h-[138px] content-start p-3"
                        onDragOver={(event) => { event.preventDefault(); if (!locked) setDragOverZone(zone); }}
                        onDragLeave={() => setDragOverZone(null)}
                        onDrop={(event) => handleZoneDrop(event, zone)}
                        onClick={() => selectedOrganelle && placeOrganelle(selectedOrganelle, zone)}
                      >
                        <div className="w-full">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-200">{ZONE_LABELS[zone]}</div>
                              {showLabels && <div className="mt-0.5 text-[10px] font-normal leading-tight text-slate-500">{ZONE_NOTES[zone]}</div>}
                            </div>
                            <span className="text-[10px] text-slate-500">{zoneOrganelles.length}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {zoneOrganelles.map((organelle) => {
                              const correct = organelle.correctZone === zone;
                              return (
                                <button
                                  key={organelle.id}
                                  type="button"
                                  disabled={locked}
                                  onClick={(event) => { event.stopPropagation(); if (locked) return; setPlacements((previous) => { const next = { ...previous }; delete next[organelle.id]; return next; }); }}
                                  className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${marks ? correct ? answerStateClass('correct') : answerStateClass('incorrect') : 'border-white/15 bg-slate-950/50 text-slate-200'}`}
                                >
                                  <OrganelleGlyph organelle={organelle} small />
                                  {organelle.name}
                                  {marks && !correct && organelle.correctZone && <span className="text-amber-200">→ {ZONE_LABELS[organelle.correctZone]}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </LuminaDropZone>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPhase === 'structure_function' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <LuminaPanel className="space-y-2">
              <LuminaSectionLabel accent="purple">Structures</LuminaSectionLabel>
              {cards.map((organelle) => {
                const selected = selectedMatchOrganelle === organelle.id;
                const connected = matchConnections[organelle.id];
                const correct = connected === organelle.id;
                const hint = hintsOn ? hintLine(organelle, board) : null;
                return (
                  <button key={organelle.id} type="button" data-pip-object={`structure-${organelle.id}`} disabled={locked} onClick={() => setSelectedMatchOrganelle(selected ? null : organelle.id)} className={`flex w-full flex-col rounded-xl border p-3 text-left ${marks ? correct ? answerStateClass('correct') : answerStateClass('incorrect') : selected ? answerStateClass('selected') : connected ? 'border-purple-400/30 bg-purple-500/10 text-slate-100' : answerStateClass('idle')}`}>
                    <span className="flex w-full items-center gap-3">
                      <OrganelleGlyph organelle={organelle} small />
                      <span className="flex-1 text-sm font-semibold">{organelle.name}</span>
                      {connected && <CheckCircle2 className="h-4 w-4 text-purple-300" />}
                    </span>
                    {hint && <span data-lever={HINTS_LEVER} className="mt-1 pl-10 text-[11px] font-normal text-cyan-200">{hint}</span>}
                  </button>
                );
              })}
            </LuminaPanel>

            <LuminaPanel className="space-y-2">
              <LuminaSectionLabel accent="amber">Cell jobs</LuminaSectionLabel>
              {shownJobs.map((match) => {
                const owner = Object.entries(matchConnections).find(([, functionId]) => functionId === match.organelleId)?.[0];
                const ownerCorrect = owner === match.organelleId;
                return (
                  <button
                    key={match.organelleId}
                    type="button"
                    data-pip-object={jobTarget(board, match.organelleId)}
                    disabled={locked || !selectedMatchOrganelle}
                    onClick={() => {
                      if (!selectedMatchOrganelle || locked) return;
                      setMatchConnections((previous) => { const next = { ...previous }; if (owner) delete next[owner]; next[selectedMatchOrganelle] = match.organelleId; return next; });
                      setSelectedMatchOrganelle(null);
                      SoundManager.snap();
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm leading-relaxed ${marks ? ownerCorrect ? answerStateClass('correct') : owner ? answerStateClass('incorrect') : answerStateClass('dimmed') : owner ? 'border-amber-400/30 bg-amber-500/10 text-slate-100' : answerStateClass('idle')}`}
                  >
                    {jobCardText(board, match.functionDescription)}
                    {owner && <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-amber-300">Connected to {organelles.find((item) => item.id === owner)?.name}</span>}
                  </button>
                );
              })}
            </LuminaPanel>
          </div>
        )}

        {currentPhase === 'cell_specialization' && (
          <div className="space-y-4">
            <LuminaPanel accent="amber" className="flex items-start gap-3">
              <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <LuminaSectionLabel accent="amber">Design brief</LuminaSectionLabel>
                <p className="mt-1 text-sm text-slate-300">A <strong className="text-white">{cellContext}</strong> has a specific job. Decide how heavily it should invest in each organelle.</p>
                {levelsOn && (
                  <ul data-lever={LEVELS_LEVER} className="mt-2 space-y-0.5 text-xs text-cyan-200">
                    {levelLegend().map(line => <li key={line}>{line}</li>)}
                  </ul>
                )}
              </div>
            </LuminaPanel>

            <div className="grid gap-3 lg:grid-cols-2">
              {cards.map((organelle) => {
                const answer = quantityAnswers[organelle.id];
                const correct = answer === organelle.expectedQuantity;
                return (
                  <LuminaPanel key={organelle.id} className={marks ? correct ? 'border-emerald-500/30' : 'border-rose-500/30' : ''}>
                    <div className="flex items-start gap-3">
                      <OrganelleGlyph organelle={organelle} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-100">{organelle.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{organelle.function}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {QUANTITY_OPTIONS.map((quantity) => <LuminaChoiceChip key={quantity} data-pip-object={`level-${organelle.id}-${quantity}`} label={QUANTITY_LABELS[quantity]} accent="amber" selected={answer === quantity} disabled={locked} onClick={() => setQuantityAnswers((previous) => ({ ...previous, [organelle.id]: quantity }))} className="px-3 py-2 text-xs" />)}
                    </div>
                    {marks && (
                      <div className={`mt-3 rounded-lg border p-2 text-xs ${correct ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-amber-500/20 bg-amber-500/5 text-amber-100'}`}>
                        <Lightbulb className="mr-1 inline h-3.5 w-3.5" />
                        {organelle.quantityReasoning ?? `${organelle.name} supports this cell by ${organelle.function.toLowerCase()}`}
                      </div>
                    )}
                  </LuminaPanel>
                );
              })}
            </div>
          </div>
        )}

        </PipWorkspace>

        {feedback && (
          <LuminaFeedbackCard status="insight" label={hasSubmitted ? 'Cell report' : 'Mission checked'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          {!currentComplete && !hasSubmitted && <LuminaActionButton action="check" disabled={!canCheck || learnerBlocked()} onClick={checkCurrentPhase}>Check mission</LuminaActionButton>}
          <LuminaButton tone="subtle" onClick={handleReset} className="ml-auto"><RotateCcw className="mr-1 h-4 w-4" />Reset</LuminaButton>
        </div>

        {/* The membrane and wall lines say what this cell has, which Stock the cell asks: hidden on that board. */}
        {currentPhase !== 'cell_inventory' && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span><span className="text-slate-400">Membrane:</span> {cellMembrane.function}</span>
            {cellWall.present && <span><span className="text-slate-400">Cell wall:</span> {cellWall.description}</span>}
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// Taught only on the workspace: a mount with no tutor renders the shared "needs the tutor" card (2026-10-18).
const CellBuilder = withWorkspaceOnly<CellBuilderProps>('cell-builder', CellBuilderSurface, props => props.data.title);

export default CellBuilder;
