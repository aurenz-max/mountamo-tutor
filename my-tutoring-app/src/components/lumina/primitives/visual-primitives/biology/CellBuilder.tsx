import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  Activity,
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

/**
 * A routable set of cell-biology missions, not a mandatory three-page
 * worksheet. Pinned eval modes present one task identity; broad objectives may
 * blend missions. Placement uses discrete model relationships because real
 * organelles move in 3D and overlapping pixel rectangles are neither honest
 * biology nor discriminating evidence.
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
}

type Phase = CellBuilderChallengeType;

const ALL_PHASES: Phase[] = [
  'cell_inventory',
  'organelle_placement',
  'structure_function',
  'cell_specialization',
];

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

const ZONE_LABELS: Record<CellZone, string> = {
  center: 'Control center',
  'near-nucleus': 'Inner membrane network',
  'large-central': 'Central storage',
  peripheral: 'Cytoplasm',
  scattered: 'Distributed throughout',
  'membrane-associated': 'Cell boundary',
};

const ZONE_NOTES: Record<CellZone, string> = {
  center: 'The information-holding core of the model',
  'near-nucleus': 'Structures that work closely with the nucleus',
  'large-central': 'A dominant storage compartment',
  peripheral: 'In the fluid interior, away from the core',
  scattered: 'Many copies spread across the interior',
  'membrane-associated': 'Attached to or acting at the outer boundary',
};

const ZONE_ORDER: CellZone[] = [
  'membrane-associated',
  'peripheral',
  'center',
  'near-nucleus',
  'large-central',
  'scattered',
];

const QUANTITY_LABELS: Record<QuantityLevel, string> = {
  few: 'Few',
  some: 'Some',
  many: 'Many',
  lots: 'Abundant',
};

const QUANTITY_OPTIONS: QuantityLevel[] = ['few', 'some', 'many', 'lots'];

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

export function resolveCellBuilderPhases(data: Pick<CellBuilderData, 'challengeType' | 'challengeTypes'>): Phase[] {
  const requested = data.challengeTypes?.length
    ? data.challengeTypes
    : data.challengeType
      ? [data.challengeType]
      : ALL_PHASES;
  return ALL_PHASES.filter((phase) => requested.includes(phase));
}

const CellBuilder: React.FC<CellBuilderProps> = ({ data, className }) => {
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

  const phases = useMemo(() => resolveCellBuilderPhases(data), [data.challengeType, data.challengeTypes]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const currentPhase = phases[Math.min(phaseIndex, phases.length - 1)] ?? 'cell_inventory';
  const validOrganelles = useMemo(() => organelles.filter((item) => item.belongsInCell), [organelles]);
  const distractors = useMemo(() => organelles.filter((item) => !item.belongsInCell), [organelles]);
  const quantityOrganelles = useMemo(
    () => validOrganelles.filter((item) => item.expectedQuantity != null),
    [validOrganelles],
  );

  const stableInstanceId = useRef(instanceId ?? `cell-builder-${Date.now()}`);
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<CellBuilderMetrics>({
    primitiveType: 'cell-builder',
    instanceId: stableInstanceId.current,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  const [sortDecisions, setSortDecisions] = useState<Record<string, boolean>>({});
  const [sortChecked, setSortChecked] = useState(false);
  const [placements, setPlacements] = useState<Record<string, CellZone>>({});
  const [selectedOrganelle, setSelectedOrganelle] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<CellZone | null>(null);
  const [placeChecked, setPlaceChecked] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedMatchOrganelle, setSelectedMatchOrganelle] = useState<string | null>(null);
  const [matchConnections, setMatchConnections] = useState<Record<string, string>>({});
  const [matchChecked, setMatchChecked] = useState(false);
  const [quantityAnswers, setQuantityAnswers] = useState<Record<string, QuantityLevel>>({});
  const [quantityChecked, setQuantityChecked] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const shuffledFunctions = useMemo(() => {
    const values = [...functionMatches];
    for (let i = values.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    return values;
  }, [functionMatches]);

  const phaseChecked: Record<Phase, boolean> = {
    cell_inventory: sortChecked,
    organelle_placement: placeChecked,
    structure_function: matchChecked,
    cell_specialization: quantityChecked,
  };

  const placeOrganelle = useCallback((organelleId: string, zone: CellZone) => {
    if (placeChecked) return;
    setPlacements((previous) => ({ ...previous, [organelleId]: zone }));
    setSelectedOrganelle(null);
    setDragOverZone(null);
    setFeedback(null);
    SoundManager.snap();
  }, [placeChecked]);

  const handleZoneDrop = useCallback((event: React.DragEvent<HTMLDivElement>, zone: CellZone) => {
    event.preventDefault();
    const organelleId = event.dataTransfer.getData('text/plain') || selectedOrganelle;
    if (organelleId) placeOrganelle(organelleId, zone);
  }, [placeOrganelle, selectedOrganelle]);

  const checkCurrentPhase = useCallback(() => {
    let message = '';
    let isPerfect = false;

    if (currentPhase === 'cell_inventory') {
      const correct = organelles.filter((item) => sortDecisions[item.id] === item.belongsInCell).length;
      setSortChecked(true);
      isPerfect = correct === organelles.length;
      message = `${correct} of ${organelles.length} structures correctly identified.`;
    } else if (currentPhase === 'organelle_placement') {
      const correct = validOrganelles.filter((item) => item.correctZone && placements[item.id] === item.correctZone).length;
      setPlaceChecked(true);
      isPerfect = correct === validOrganelles.length;
      message = `${correct} of ${validOrganelles.length} organelles placed in their best-fit model region.`;
    } else if (currentPhase === 'structure_function') {
      const correct = validOrganelles.filter((item) => matchConnections[item.id] === item.id).length;
      setMatchChecked(true);
      isPerfect = correct === validOrganelles.length;
      message = `${correct} of ${validOrganelles.length} organelle jobs correctly connected.`;
    } else {
      const correct = quantityOrganelles.filter((item) => quantityAnswers[item.id] === item.expectedQuantity).length;
      setQuantityChecked(true);
      isPerfect = correct === quantityOrganelles.length;
      message = `${correct} of ${quantityOrganelles.length} abundance choices fit this cell's mission.`;
    }

    setFeedback(message);
    if (isPerfect) SoundManager.playCorrect();
    else SoundManager.playIncorrect();
  }, [currentPhase, matchConnections, organelles, placements, quantityAnswers, quantityOrganelles, sortDecisions, validOrganelles]);

  const handleSubmit = useCallback(() => {
    if (hasSubmitted) return;

    const sortResults = organelles.map((item) => ({
      organelleId: item.id,
      belongsInCell: item.belongsInCell,
      studentSaidBelongs: sortDecisions[item.id] ?? false,
      isCorrect: sortDecisions[item.id] === item.belongsInCell,
    }));
    const correctlySorted = sortResults.filter((item) => item.isCorrect).length;
    const sortAccuracy = score(correctlySorted, organelles.length);

    const zonePlacements = validOrganelles.map((item) => ({
      organelleId: item.id,
      correctZone: item.correctZone!,
      placedZone: placements[item.id] ?? null,
      isCorrect: placements[item.id] === item.correctZone,
    }));
    const correctZonePlacements = zonePlacements.filter((item) => item.isCorrect).length;
    const zoneAccuracy = score(correctZonePlacements, validOrganelles.length);

    const quantityResults = quantityOrganelles.map((item) => ({
      organelleId: item.id,
      expectedQuantity: item.expectedQuantity!,
      studentQuantity: quantityAnswers[item.id] ?? null,
      isCorrect: quantityAnswers[item.id] === item.expectedQuantity,
    }));
    const quantityQuestionsCorrect = quantityResults.filter((item) => item.isCorrect).length;
    const quantityAccuracy = score(quantityQuestionsCorrect, quantityOrganelles.length);

    const functionMatchResults = validOrganelles.map((item) => ({
      organelleId: item.id,
      selectedFunctionId: matchConnections[item.id] ?? null,
      correctFunctionId: item.id,
      isCorrect: matchConnections[item.id] === item.id,
    }));
    const correctFunctionMatches = functionMatchResults.filter((item) => item.isCorrect).length;
    const functionMatchAccuracy = score(correctFunctionMatches, validOrganelles.length);

    const phaseScores: Record<Phase, number> = {
      cell_inventory: sortAccuracy,
      organelle_placement: zoneAccuracy,
      structure_function: functionMatchAccuracy,
      cell_specialization: quantityAccuracy,
    };
    const overallAccuracy = Math.round(
      phases.reduce((sum, phase) => sum + phaseScores[phase], 0) / Math.max(phases.length, 1),
    );
    const allCorrect = phases.every((phase) => phaseScores[phase] === 100);

    const metrics: CellBuilderMetrics = {
      type: 'cell-builder',
      cellType,
      cellContext,
      gradeBand: data.gradeBand,
      phase1Completed: phases.includes('cell_inventory') ? sortChecked : false,
      phase2Completed: phases.includes('organelle_placement') ? placeChecked : quantityChecked,
      phase3Completed: phases.includes('structure_function') ? matchChecked : false,
      allPhasesCompleted: phases.every((phase) => phaseChecked[phase]),
      totalOrganelles: organelles.length,
      validOrganelles: validOrganelles.length,
      distractorOrganelles: distractors.length,
      correctlySorted,
      sortAccuracy,
      sortResults,
      totalToPlace: validOrganelles.length,
      correctZonePlacements,
      incorrectZonePlacements: validOrganelles.length - correctZonePlacements,
      unplacedOrganelles: validOrganelles.length - Object.keys(placements).length,
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
      accuracy: overallAccuracy,
    };

    submitResult(overallAccuracy >= 75, overallAccuracy, metrics, {
      studentWork: { activeMissions: phases, sortDecisions, placements, matchConnections, quantityAnswers },
    });
    setFeedback(allCorrect ? 'Mission complete. This cell is ready to work.' : `Mission score: ${overallAccuracy}%.`);
  }, [cellContext, cellType, data.gradeBand, distractors.length, hasSubmitted, matchChecked, matchConnections, organelles, phaseChecked, phases, placeChecked, placements, quantityAnswers, quantityChecked, quantityOrganelles, sortChecked, sortDecisions, submitResult, validOrganelles]);

  const handleReset = useCallback(() => {
    setPhaseIndex(0);
    setSortDecisions({});
    setSortChecked(false);
    setPlacements({});
    setSelectedOrganelle(null);
    setDragOverZone(null);
    setPlaceChecked(false);
    setSelectedMatchOrganelle(null);
    setMatchConnections({});
    setMatchChecked(false);
    setQuantityAnswers({});
    setQuantityChecked(false);
    setFeedback(null);
    resetAttempt();
  }, [resetAttempt]);

  const advance = () => {
    setFeedback(null);
    setPhaseIndex((value) => Math.min(value + 1, phases.length - 1));
  };

  const currentComplete = phaseChecked[currentPhase];
  const isFinalPhase = phaseIndex === phases.length - 1;
  const canCheck = currentPhase === 'cell_inventory'
    ? Object.keys(sortDecisions).length === organelles.length
    : currentPhase === 'organelle_placement'
      ? Object.keys(placements).length === validOrganelles.length
      : currentPhase === 'structure_function'
        ? validOrganelles.every((item) => matchConnections[item.id])
        : quantityOrganelles.length > 0 && quantityOrganelles.every((item) => quantityAnswers[item.id]);

  const modeTabs = phases.map((phase) => ({ value: phase, label: PHASE_LABELS[phase] }));
  const cellTypeLabel = `${cellType.charAt(0).toUpperCase()}${cellType.slice(1)} cell`;

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
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                Mission {phaseIndex + 1} of {phases.length}
              </div>
              <div className="mt-1">{PHASE_PROMPTS[currentPhase]}</div>
            </div>
          </div>
        </LuminaPrompt>

        {currentPhase === 'cell_inventory' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {organelles.map((organelle) => {
              const decision = sortDecisions[organelle.id];
              const correct = decision === organelle.belongsInCell;
              const state = !sortChecked ? decision == null ? 'idle' : 'selected' : correct ? 'correct' : 'incorrect';
              return (
                <div key={organelle.id} className={`rounded-xl border p-3 ${answerStateClass(state)}`}>
                  <div className="flex items-center gap-3">
                    <OrganelleGlyph organelle={organelle} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100">{organelle.name}</div>
                      <div className="mt-0.5 text-xs text-slate-400">{organelle.analogy}</div>
                    </div>
                    <div className="flex gap-1">
                      <LuminaButton size="sm" tone={decision === true ? 'primary' : 'subtle'} disabled={sortChecked} onClick={() => setSortDecisions((previous) => ({ ...previous, [organelle.id]: true }))}>Keep</LuminaButton>
                      <LuminaButton size="sm" tone={decision === false ? 'danger' : 'subtle'} disabled={sortChecked} onClick={() => setSortDecisions((previous) => ({ ...previous, [organelle.id]: false }))}>Reject</LuminaButton>
                    </div>
                  </div>
                  {sortChecked && !correct && (
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
                {validOrganelles.map((organelle) => {
                  const placed = placements[organelle.id];
                  const selected = selectedOrganelle === organelle.id;
                  return (
                    <button
                      key={organelle.id}
                      type="button"
                      draggable={!placeChecked}
                      disabled={placeChecked}
                      onDragStart={(event) => { event.dataTransfer.setData('text/plain', organelle.id); setSelectedOrganelle(organelle.id); }}
                      onClick={() => setSelectedOrganelle(selected ? null : organelle.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${selected ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100' : placed ? 'border-white/10 bg-white/[0.03] text-slate-500' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}
                    >
                      <GripVertical className="h-4 w-4 shrink-0" />
                      <OrganelleGlyph organelle={organelle} small />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{organelle.name}</span>
                      {placed && <span className="text-[10px] uppercase tracking-wider">{ZONE_LABELS[placed]}</span>}
                    </button>
                  );
                })}
              </LuminaPanel>

              <div className={`relative overflow-hidden rounded-[2.5rem] border p-4 ${cellWall.present ? 'border-lime-400/40' : 'border-teal-400/30'} bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.13),rgba(15,23,42,0.35)_68%)]`}>
                <div className="pointer-events-none absolute inset-3 rounded-[2rem] border border-teal-300/20" />
                <div className="relative grid min-h-[470px] grid-cols-2 gap-3 sm:grid-cols-3">
                  {ZONE_ORDER.map((zone) => {
                    const zoneOrganelles = validOrganelles.filter((item) => placements[item.id] === zone);
                    const zoneCorrect = placeChecked && zoneOrganelles.every((item) => item.correctZone === zone);
                    const containsIncorrect = placeChecked && zoneOrganelles.some((item) => item.correctZone !== zone);
                    const state: DropZoneState = dragOverZone === zone ? 'dragOver' : containsIncorrect ? 'incorrect' : zoneCorrect && zoneOrganelles.length > 0 ? 'correct' : zoneOrganelles.length > 0 ? 'filled' : 'idle';
                    return (
                      <LuminaDropZone
                        key={zone}
                        state={state}
                        className="min-h-[138px] content-start p-3"
                        onDragOver={(event) => { event.preventDefault(); if (!placeChecked) setDragOverZone(zone); }}
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
                                  disabled={placeChecked}
                                  onClick={(event) => { event.stopPropagation(); setPlacements((previous) => { const next = { ...previous }; delete next[organelle.id]; return next; }); }}
                                  className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] ${placeChecked ? correct ? answerStateClass('correct') : answerStateClass('incorrect') : 'border-white/15 bg-slate-950/50 text-slate-200'}`}
                                >
                                  <OrganelleGlyph organelle={organelle} small />
                                  {organelle.name}
                                  {placeChecked && !correct && organelle.correctZone && <span className="text-amber-200">→ {ZONE_LABELS[organelle.correctZone]}</span>}
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
              {validOrganelles.map((organelle) => {
                const selected = selectedMatchOrganelle === organelle.id;
                const connected = matchConnections[organelle.id];
                const correct = connected === organelle.id;
                return (
                  <button key={organelle.id} type="button" disabled={matchChecked} onClick={() => setSelectedMatchOrganelle(selected ? null : organelle.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${matchChecked ? correct ? answerStateClass('correct') : answerStateClass('incorrect') : selected ? answerStateClass('selected') : connected ? 'border-purple-400/30 bg-purple-500/10 text-slate-100' : answerStateClass('idle')}`}>
                    <OrganelleGlyph organelle={organelle} small />
                    <span className="flex-1 text-sm font-semibold">{organelle.name}</span>
                    {connected && <CheckCircle2 className="h-4 w-4 text-purple-300" />}
                  </button>
                );
              })}
            </LuminaPanel>

            <LuminaPanel className="space-y-2">
              <LuminaSectionLabel accent="amber">Cell jobs</LuminaSectionLabel>
              {shuffledFunctions.map((match) => {
                const owner = Object.entries(matchConnections).find(([, functionId]) => functionId === match.organelleId)?.[0];
                const ownerCorrect = owner === match.organelleId;
                return (
                  <button
                    key={match.organelleId}
                    type="button"
                    disabled={matchChecked || !selectedMatchOrganelle}
                    onClick={() => {
                      if (!selectedMatchOrganelle) return;
                      setMatchConnections((previous) => { const next = { ...previous }; if (owner) delete next[owner]; next[selectedMatchOrganelle] = match.organelleId; return next; });
                      setSelectedMatchOrganelle(null);
                      SoundManager.snap();
                    }}
                    className={`w-full rounded-xl border p-3 text-left text-sm leading-relaxed ${matchChecked ? ownerCorrect ? answerStateClass('correct') : owner ? answerStateClass('incorrect') : answerStateClass('dimmed') : owner ? 'border-amber-400/30 bg-amber-500/10 text-slate-100' : answerStateClass('idle')}`}
                  >
                    {match.functionDescription}
                    {owner && <span className="mt-2 block text-[10px] font-bold uppercase tracking-wider text-amber-300">Connected to {validOrganelles.find((item) => item.id === owner)?.name}</span>}
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
              </div>
            </LuminaPanel>

            <div className="grid gap-3 lg:grid-cols-2">
              {quantityOrganelles.map((organelle) => {
                const answer = quantityAnswers[organelle.id];
                const correct = answer === organelle.expectedQuantity;
                return (
                  <LuminaPanel key={organelle.id} className={quantityChecked ? correct ? 'border-emerald-500/30' : 'border-rose-500/30' : ''}>
                    <div className="flex items-start gap-3">
                      <OrganelleGlyph organelle={organelle} />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-100">{organelle.name}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{organelle.function}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {QUANTITY_OPTIONS.map((quantity) => <LuminaChoiceChip key={quantity} label={QUANTITY_LABELS[quantity]} accent="amber" selected={answer === quantity} disabled={quantityChecked} onClick={() => setQuantityAnswers((previous) => ({ ...previous, [organelle.id]: quantity }))} className="px-3 py-2 text-xs" />)}
                    </div>
                    {quantityChecked && (
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

        {feedback && (
          <LuminaFeedbackCard status="insight" label={hasSubmitted ? 'Cell report' : 'Mission checked'} teachingNote={currentComplete && !hasSubmitted ? 'Your first committed answer is what counts; the reveal is for learning, not rescoring.' : undefined}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          {!currentComplete && !hasSubmitted && <LuminaActionButton action="check" disabled={!canCheck} onClick={checkCurrentPhase}>Check mission</LuminaActionButton>}
          {currentComplete && !isFinalPhase && !hasSubmitted && <LuminaActionButton action="next" onClick={advance}>Next mission</LuminaActionButton>}
          {currentComplete && isFinalPhase && !hasSubmitted && <LuminaActionButton action="check" onClick={handleSubmit}><Activity className="mr-2 h-4 w-4" />Run cell report</LuminaActionButton>}
          <LuminaButton tone="subtle" onClick={handleReset} className="ml-auto"><RotateCcw className="mr-1 h-4 w-4" />Reset</LuminaButton>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span><span className="text-slate-400">Membrane:</span> {cellMembrane.function}</span>
          {cellWall.present && <span><span className="text-slate-400">Cell wall:</span> {cellWall.description}</span>}
        </div>
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default CellBuilder;
