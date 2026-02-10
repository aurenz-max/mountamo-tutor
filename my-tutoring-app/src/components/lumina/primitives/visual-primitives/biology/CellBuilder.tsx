import React, { useState, useCallback, useRef, useMemo } from 'react';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { CellBuilderMetrics, CellZone, QuantityLevel } from '../../../evaluation/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  FlaskConical,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from 'lucide-react';

/**
 * Cell Structure Builder - Three-Phase Interactive Cell Biology Primitive
 *
 * Phase 1 (Sort): Students classify which organelles belong in this cell type
 *   and which are distractors that don't belong.
 * Phase 2 (Place + Quantity): Students drag valid organelles into biological
 *   zones and answer quantity reasoning questions for specialized cells.
 * Phase 3 (Match Functions): Students match organelles to their function
 *   descriptions in a click-to-match interface.
 *
 * Supports specialized cell contexts (muscle, nerve, leaf, root) that drive
 * quantity reasoning ("Muscle cells need lots of mitochondria for energy").
 *
 * Grade Band: 4-8
 * Cognitive Operation: Classification, spatial reasoning, structure-function mapping
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export type { CellZone } from '../../../evaluation/types';

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

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CellBuilderMetrics>) => void;
}

// ============================================================================
// Component Props
// ============================================================================

interface CellBuilderProps {
  data: CellBuilderData;
  className?: string;
}

// ============================================================================
// Phase Types
// ============================================================================

type Phase = 'sort' | 'place' | 'match-functions';

// ============================================================================
// Zone Mapping
// ============================================================================

const ZONE_BOUNDS: Record<CellZone, { xMin: number; xMax: number; yMin: number; yMax: number }> = {
  'center':              { xMin: 30, xMax: 70, yMin: 25, yMax: 70 },
  'near-nucleus':        { xMin: 45, xMax: 80, yMin: 20, yMax: 65 },
  'large-central':       { xMin: 25, xMax: 75, yMin: 25, yMax: 75 },
  'peripheral':          { xMin: 10, xMax: 90, yMin: 10, yMax: 90 },
  'scattered':           { xMin: 10, xMax: 90, yMin: 10, yMax: 90 },
  'membrane-associated': { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
};

function isInZone(position: { x: number; y: number }, zone: CellZone): boolean {
  if (zone === 'membrane-associated') {
    return position.x < 18 || position.x > 82 || position.y < 18 || position.y > 82;
  }
  const bounds = ZONE_BOUNDS[zone];
  return (
    position.x >= bounds.xMin && position.x <= bounds.xMax &&
    position.y >= bounds.yMin && position.y <= bounds.yMax
  );
}

function getZoneFromPosition(position: { x: number; y: number }): CellZone {
  if (position.x < 18 || position.x > 82 || position.y < 18 || position.y > 82) return 'membrane-associated';
  if (position.x >= 30 && position.x <= 70 && position.y >= 25 && position.y <= 70) {
    if (position.x >= 45 && position.x <= 80 && position.y >= 20 && position.y <= 65) return 'near-nucleus';
    return 'center';
  }
  return 'peripheral';
}

const ZONE_LABELS: Record<CellZone, string> = {
  'center': 'Center',
  'near-nucleus': 'Near Nucleus',
  'large-central': 'Large Central',
  'peripheral': 'Throughout Cytoplasm',
  'scattered': 'Scattered',
  'membrane-associated': 'Cell Edge',
};

const QUANTITY_LABELS: Record<QuantityLevel, string> = {
  'few': 'Few (1-2)',
  'some': 'Some (3-5)',
  'many': 'Many (6-10)',
  'lots': 'Lots (10+)',
};

const QUANTITY_OPTIONS: QuantityLevel[] = ['few', 'some', 'many', 'lots'];

// ============================================================================
// Cell Shape SVG Paths (reused from original)
// ============================================================================

function getCellOutline(cellType: string): { path: string; viewBox: string; hasWall: boolean } {
  switch (cellType) {
    case 'plant':
      return {
        path: 'M 20 10 L 380 10 Q 390 10 390 20 L 390 280 Q 390 290 380 290 L 20 290 Q 10 290 10 280 L 10 20 Q 10 10 20 10 Z',
        viewBox: '0 0 400 300',
        hasWall: true,
      };
    case 'prokaryotic':
      return {
        path: 'M 100 50 Q 300 20 350 150 Q 300 280 100 250 Q 50 200 50 150 Q 50 80 100 50 Z',
        viewBox: '0 0 400 300',
        hasWall: false,
      };
    case 'fungal':
      return {
        path: 'M 200 20 Q 350 20 370 150 Q 350 280 200 280 Q 50 280 30 150 Q 50 20 200 20 Z',
        viewBox: '0 0 400 300',
        hasWall: true,
      };
    default: // animal
      return {
        path: 'M 200 20 C 320 20 380 100 380 150 C 380 220 320 280 200 280 C 80 280 20 220 20 150 C 20 100 80 20 200 20 Z',
        viewBox: '0 0 400 300',
        hasWall: false,
      };
  }
}

// ============================================================================
// Organelle Visuals
// ============================================================================

function getOrganelleColor(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('nucleus')) return '#6366f1';
  if (n.includes('mitochond')) return '#ef4444';
  if (n.includes('chloroplast')) return '#22c55e';
  if (n.includes('ribosome')) return '#a855f7';
  if (n.includes('golgi') || n.includes('apparatus')) return '#f59e0b';
  if (n.includes('endoplasmic') || n.includes('reticulum')) return '#3b82f6';
  if (n.includes('lysosome')) return '#ec4899';
  if (n.includes('vacuole')) return '#06b6d4';
  if (n.includes('centrosome') || n.includes('centriole')) return '#f97316';
  if (n.includes('cell wall')) return '#84cc16';
  if (n.includes('cell membrane') || n.includes('plasma')) return '#14b8a6';
  if (n.includes('cytoplasm')) return '#94a3b8';
  if (n.includes('flagell') || n.includes('cilia')) return '#78716c';
  if (n.includes('plasmid')) return '#e879f9';
  return '#64748b';
}

function getOrganelleSize(size: 'small' | 'medium' | 'large'): number {
  switch (size) {
    case 'small': return 16;
    case 'medium': return 24;
    case 'large': return 32;
  }
}

// ============================================================================
// Component
// ============================================================================

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

  // ---- Derived data ----
  const validOrganelles = useMemo(() => organelles.filter(o => o.belongsInCell), [organelles]);
  const distractorOrganelles = useMemo(() => organelles.filter(o => !o.belongsInCell), [organelles]);
  const quantityOrganelles = useMemo(
    () => validOrganelles.filter(o => o.expectedQuantity && (o.expectedQuantity === 'many' || o.expectedQuantity === 'lots')),
    [validOrganelles]
  );

  // ---- Phase state ----
  const [currentPhase, setCurrentPhase] = useState<Phase>('sort');

  // ---- Phase 1: Sort state ----
  const [sortDecisions, setSortDecisions] = useState<Record<string, boolean>>({});
  const [sortChecked, setSortChecked] = useState(false);
  const [sortFeedback, setSortFeedback] = useState<Record<string, { correct: boolean; explanation: string }>>({});

  // ---- Phase 2: Place state ----
  const [placedOrganelles, setPlacedOrganelles] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedOrganelle, setSelectedOrganelle] = useState<string | null>(null);
  const [placeChecked, setPlaceChecked] = useState(false);
  const [placeFeedback, setPlaceFeedback] = useState<Record<string, boolean>>({});
  const [quantityAnswers, setQuantityAnswers] = useState<Record<string, QuantityLevel>>({});
  const [showLabels, setShowLabels] = useState(true);
  const cellAreaRef = useRef<HTMLDivElement>(null);

  // ---- Phase 3: Match state ----
  const [selectedMatchOrganelle, setSelectedMatchOrganelle] = useState<string | null>(null);
  const [matchConnections, setMatchConnections] = useState<Record<string, string>>({});
  const [matchChecked, setMatchChecked] = useState(false);
  const [matchFeedback, setMatchFeedback] = useState<Record<string, boolean>>({});

  // ---- General ----
  const [feedback, setFeedback] = useState<string | null>(null);

  // ---- Evaluation hook ----
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<CellBuilderMetrics>({
    primitiveType: 'cell-builder',
    instanceId: instanceId || `cell-builder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  const cellOutline = getCellOutline(cellType);
  const cellTypeLabel = cellType.charAt(0).toUpperCase() + cellType.slice(1);

  // Shuffled function descriptions for matching
  const shuffledFunctions = useMemo(() => {
    const fns = [...functionMatches];
    for (let i = fns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fns[i], fns[j]] = [fns[j], fns[i]];
    }
    return fns;
  }, [functionMatches]);

  // ==========================================================================
  // Phase 1: Sort Logic
  // ==========================================================================

  const allSorted = Object.keys(sortDecisions).length === organelles.length;

  const handleCheckSort = useCallback(() => {
    const fb: Record<string, { correct: boolean; explanation: string }> = {};
    organelles.forEach(o => {
      const studentSaysBelongs = sortDecisions[o.id] ?? false;
      const correct = studentSaysBelongs === o.belongsInCell;
      fb[o.id] = {
        correct,
        explanation: correct
          ? (o.belongsInCell ? `${o.name} belongs in this cell.` : `Correct! ${o.name} doesn't belong here.`)
          : (o.belongsInCell
            ? `${o.name} actually belongs in this cell type.`
            : (o.distractorExplanation || `${o.name} doesn't belong in a ${cellContext}.`)),
      };
    });
    setSortFeedback(fb);
    setSortChecked(true);

    const correctCount = Object.values(fb).filter(f => f.correct).length;
    const total = organelles.length;
    if (correctCount === total) {
      setFeedback('All organelles correctly classified! Moving to placement phase...');
    } else {
      setFeedback(`${correctCount} of ${total} correct. Review the feedback, then continue.`);
    }
  }, [organelles, sortDecisions, cellContext]);

  const handleAdvanceToPlace = useCallback(() => {
    setCurrentPhase('place');
    setFeedback(null);
  }, []);

  // ==========================================================================
  // Phase 2: Place Logic
  // ==========================================================================

  const organellesToPlace = validOrganelles;

  const unplacedOrganellesList = organellesToPlace.filter(
    o => !placedOrganelles[o.id]
  );

  const handleDragStart = useCallback((organelleId: string) => {
    setDraggingId(organelleId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    const activeId = draggingId || selectedOrganelle;
    if (!activeId) return;

    const cellArea = cellAreaRef.current;
    if (!cellArea) return;

    const rect = cellArea.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;

    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

    setPlacedOrganelles(prev => ({ ...prev, [activeId]: { x, y } }));
    setDraggingId(null);
    setSelectedOrganelle(null);
    setPlaceChecked(false);
    setFeedback(null);
  }, [draggingId, selectedOrganelle]);

  const handleRemoveOrganelle = useCallback((organelleId: string) => {
    setPlacedOrganelles(prev => {
      const next = { ...prev };
      delete next[organelleId];
      return next;
    });
    setPlaceChecked(false);
    setFeedback(null);
  }, []);

  const allPlaced = Object.keys(placedOrganelles).length === organellesToPlace.length;

  const handleCheckPlace = useCallback(() => {
    const fb: Record<string, boolean> = {};
    organellesToPlace.forEach(o => {
      const pos = placedOrganelles[o.id];
      if (!pos || !o.correctZone) {
        fb[o.id] = false;
        return;
      }
      fb[o.id] = isInZone(pos, o.correctZone);
    });
    setPlaceFeedback(fb);
    setPlaceChecked(true);

    const correctCount = Object.values(fb).filter(Boolean).length;
    const total = organellesToPlace.length;
    if (correctCount === total) {
      setFeedback('All organelles correctly placed!');
    } else {
      setFeedback(`${correctCount} of ${total} in the correct zone. Drag incorrect ones to new positions.`);
    }
  }, [organellesToPlace, placedOrganelles]);

  const handleAdvanceToMatch = useCallback(() => {
    setCurrentPhase('match-functions');
    setFeedback(null);
  }, []);

  // ==========================================================================
  // Phase 3: Match Logic
  // ==========================================================================

  const handleMatchClick = useCallback((organelleId: string) => {
    if (matchChecked) return;
    setSelectedMatchOrganelle(prev => prev === organelleId ? null : organelleId);
  }, [matchChecked]);

  const handleFunctionClick = useCallback((functionOrganelleId: string) => {
    if (matchChecked || !selectedMatchOrganelle) return;

    // Check if this function is already assigned to another organelle
    const existingOrganelle = Object.entries(matchConnections).find(([, fId]) => fId === functionOrganelleId)?.[0];
    if (existingOrganelle && existingOrganelle !== selectedMatchOrganelle) {
      // Unassign the previous connection
      setMatchConnections(prev => {
        const next = { ...prev };
        delete next[existingOrganelle];
        next[selectedMatchOrganelle!] = functionOrganelleId;
        return next;
      });
    } else {
      setMatchConnections(prev => ({ ...prev, [selectedMatchOrganelle!]: functionOrganelleId }));
    }
    setSelectedMatchOrganelle(null);
  }, [matchChecked, selectedMatchOrganelle, matchConnections]);

  const allMatched = validOrganelles.every(o => matchConnections[o.id]);

  const handleCheckMatch = useCallback(() => {
    const fb: Record<string, boolean> = {};
    validOrganelles.forEach(o => {
      const selectedFnOrganelleId = matchConnections[o.id];
      fb[o.id] = selectedFnOrganelleId === o.id;
    });
    setMatchFeedback(fb);
    setMatchChecked(true);

    const correctCount = Object.values(fb).filter(Boolean).length;
    const total = validOrganelles.length;
    if (correctCount === total) {
      setFeedback('Perfect! All functions correctly matched!');
    } else {
      setFeedback(`${correctCount} of ${total} functions matched correctly.`);
    }
  }, [validOrganelles, matchConnections]);

  // ==========================================================================
  // Final Submit
  // ==========================================================================

  const handleSubmit = useCallback(() => {
    if (hasSubmitted) return;

    // Phase 1 metrics
    const sortResults = organelles.map(o => ({
      organelleId: o.id,
      belongsInCell: o.belongsInCell,
      studentSaidBelongs: sortDecisions[o.id] ?? false,
      isCorrect: (sortDecisions[o.id] ?? false) === o.belongsInCell,
    }));
    const correctlySorted = sortResults.filter(r => r.isCorrect).length;
    const sortAccuracy = Math.round((correctlySorted / organelles.length) * 100);

    // Phase 2 metrics
    const zonePlacements = organellesToPlace.map(o => {
      const pos = placedOrganelles[o.id];
      const placedZone = pos ? getZoneFromPosition(pos) : null;
      return {
        organelleId: o.id,
        correctZone: o.correctZone!,
        placedZone,
        isCorrect: pos && o.correctZone ? isInZone(pos, o.correctZone) : false,
      };
    });
    const correctZonePlacements = zonePlacements.filter(z => z.isCorrect).length;
    const zoneAccuracy = organellesToPlace.length > 0
      ? Math.round((correctZonePlacements / organellesToPlace.length) * 100)
      : 100;

    // Quantity metrics
    const quantityResults = quantityOrganelles.map(o => ({
      organelleId: o.id,
      expectedQuantity: o.expectedQuantity!,
      studentQuantity: quantityAnswers[o.id] || null,
      isCorrect: quantityAnswers[o.id] === o.expectedQuantity,
    }));
    const quantityCorrect = quantityResults.filter(q => q.isCorrect).length;
    const quantityAccuracy = quantityOrganelles.length > 0
      ? Math.round((quantityCorrect / quantityOrganelles.length) * 100)
      : 100;

    // Blend quantity into place score
    const placeScore = quantityOrganelles.length > 0
      ? Math.round(zoneAccuracy * 0.7 + quantityAccuracy * 0.3)
      : zoneAccuracy;

    // Phase 3 metrics
    const functionMatchResults = validOrganelles.map(o => ({
      organelleId: o.id,
      selectedFunctionId: matchConnections[o.id] || null,
      correctFunctionId: o.id,
      isCorrect: matchConnections[o.id] === o.id,
    }));
    const correctFunctionMatches = functionMatchResults.filter(f => f.isCorrect).length;
    const functionMatchAccuracy = validOrganelles.length > 0
      ? Math.round((correctFunctionMatches / validOrganelles.length) * 100)
      : 100;

    // Weighted overall
    const overallAccuracy = Math.round(sortAccuracy * 0.3 + placeScore * 0.4 + functionMatchAccuracy * 0.3);
    const allCorrect = sortAccuracy === 100 && zoneAccuracy === 100 && quantityAccuracy === 100 && functionMatchAccuracy === 100;
    const success = overallAccuracy >= 75;

    const metrics: CellBuilderMetrics = {
      type: 'cell-builder',
      cellType,
      cellContext,
      gradeBand: data.gradeBand,

      phase1Completed: sortChecked,
      phase2Completed: placeChecked,
      phase3Completed: matchChecked,
      allPhasesCompleted: sortChecked && placeChecked && matchChecked,

      totalOrganelles: organelles.length,
      validOrganelles: validOrganelles.length,
      distractorOrganelles: distractorOrganelles.length,
      correctlySorted,
      sortAccuracy,
      sortResults,

      totalToPlace: organellesToPlace.length,
      correctZonePlacements,
      incorrectZonePlacements: organellesToPlace.length - correctZonePlacements,
      unplacedOrganelles: organellesToPlace.length - Object.keys(placedOrganelles).length,
      zoneAccuracy,
      zonePlacements,

      quantityQuestionsTotal: quantityOrganelles.length,
      quantityQuestionsCorrect: quantityCorrect,
      quantityAccuracy,
      quantityResults,

      totalFunctionMatches: validOrganelles.length,
      correctFunctionMatches,
      functionMatchAccuracy,
      functionMatchResults,

      allCorrect,
      accuracy: overallAccuracy,
    };

    submitResult(success, overallAccuracy, metrics, {
      studentWork: { sortDecisions, placedOrganelles, quantityAnswers, matchConnections },
    });

    setFeedback(
      allCorrect
        ? 'Outstanding! You demonstrated excellent understanding of cell biology!'
        : `Score: ${overallAccuracy}% — Sort: ${sortAccuracy}%, Placement: ${placeScore}%, Functions: ${functionMatchAccuracy}%`
    );
  }, [
    hasSubmitted, organelles, organellesToPlace, validOrganelles, distractorOrganelles,
    quantityOrganelles, sortDecisions, placedOrganelles, quantityAnswers, matchConnections,
    cellType, cellContext, data.gradeBand, sortChecked, placeChecked, matchChecked, submitResult,
  ]);

  // ==========================================================================
  // Reset
  // ==========================================================================

  const handleReset = useCallback(() => {
    setCurrentPhase('sort');
    setSortDecisions({});
    setSortChecked(false);
    setSortFeedback({});
    setPlacedOrganelles({});
    setPlaceChecked(false);
    setPlaceFeedback({});
    setQuantityAnswers({});
    setSelectedMatchOrganelle(null);
    setMatchConnections({});
    setMatchChecked(false);
    setMatchFeedback({});
    setFeedback(null);
    setDraggingId(null);
    setSelectedOrganelle(null);
    resetAttempt();
  }, [resetAttempt]);

  // ==========================================================================
  // Render
  // ==========================================================================

  const phases: { key: Phase; label: string }[] = [
    { key: 'sort', label: 'Sort' },
    { key: 'place', label: 'Place' },
    { key: 'match-functions', label: 'Match Functions' },
  ];
  const currentPhaseIndex = phases.findIndex(p => p.key === currentPhase);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-400" />
              {title}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 border-emerald-500/30 text-emerald-300">
              {cellContext || `${cellTypeLabel} Cell`}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              Grade {data.gradeBand}
            </Badge>
          </div>
        </div>

        {/* Phase Progress */}
        <div className="flex items-center gap-2 mt-4">
          {phases.map((phase, idx) => (
            <React.Fragment key={phase.key}>
              {idx > 0 && <ArrowRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
              <div
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  idx < currentPhaseIndex
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                    : idx === currentPhaseIndex
                      ? 'bg-white/10 border border-white/20 text-white'
                      : 'bg-slate-800/30 border border-white/5 text-slate-600'
                }`}
              >
                {idx < currentPhaseIndex && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                {phase.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ================================================================ */}
        {/* PHASE 1: SORT                                                    */}
        {/* ================================================================ */}
        {currentPhase === 'sort' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              Which organelles belong in a <span className="text-emerald-300 font-medium">{cellContext}</span>?
              Mark each organelle as belonging or not belonging.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {organelles.map(organelle => {
                const color = getOrganelleColor(organelle.name);
                const decision = sortDecisions[organelle.id];
                const fb = sortFeedback[organelle.id];

                return (
                  <div
                    key={organelle.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
                      fb
                        ? fb.correct
                          ? 'bg-green-500/10 border-green-500/30'
                          : 'bg-red-500/10 border-red-500/30'
                        : decision === true
                          ? 'bg-emerald-600/20 border-emerald-500/40'
                          : decision === false
                            ? 'bg-red-500/10 border-red-500/30'
                            : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Organelle dot */}
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `${color}66`, border: `2px solid ${color}` }}
                    />

                    {/* Name & info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium">{organelle.name}</div>
                      {fb && !fb.correct && (
                        <div className="text-[11px] text-amber-300/80 mt-0.5">{fb.explanation}</div>
                      )}
                    </div>

                    {/* Toggle buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => {
                          if (sortChecked) return;
                          setSortDecisions(prev => ({ ...prev, [organelle.id]: true }));
                        }}
                        className={`p-1.5 rounded-md transition-all ${
                          decision === true
                            ? 'bg-emerald-500/30 text-emerald-300'
                            : 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                        }`}
                        title="Belongs in this cell"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (sortChecked) return;
                          setSortDecisions(prev => ({ ...prev, [organelle.id]: false }));
                        }}
                        className={`p-1.5 rounded-md transition-all ${
                          decision === false
                            ? 'bg-red-500/30 text-red-300'
                            : 'bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                        }`}
                        title="Does NOT belong in this cell"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Result indicator */}
                    {fb && (
                      <div className="flex-shrink-0">
                        {fb.correct
                          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                          : <XCircle className="w-4 h-4 text-red-400" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sort actions */}
            <div className="flex items-center gap-2 pt-2">
              {!sortChecked ? (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                  onClick={handleCheckSort}
                  disabled={!allSorted}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Check Classification
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300"
                  onClick={handleAdvanceToPlace}
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  Continue to Placement
                </Button>
              )}
              <div className="ml-auto text-xs text-slate-500">
                {Object.keys(sortDecisions).length} / {organelles.length} classified
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PHASE 2: PLACE + QUANTITY                                        */}
        {/* ================================================================ */}
        {currentPhase === 'place' && (
          <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                onClick={() => setShowLabels(!showLabels)}
              >
                {showLabels ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                {showLabels ? 'Hide Labels' : 'Show Labels'}
              </Button>
              <div className="ml-auto text-xs text-slate-500">
                <span className="text-slate-400">Membrane:</span> {cellMembrane.function}
                {cellWall.present && (
                  <span className="ml-2"><span className="text-slate-400">Wall:</span> {cellWall.description}</span>
                )}
              </div>
            </div>

            {/* Main Layout: Cell Diagram + Palette */}
            <div className="flex gap-4">
              {/* Cell Diagram Area */}
              <div
                ref={cellAreaRef}
                className="flex-1 relative bg-black/20 rounded-xl border border-white/10 overflow-hidden cursor-crosshair"
                style={{ minHeight: 400 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={(e) => {
                  if (selectedOrganelle) handleDrop(e);
                }}
              >
                {/* Cell outline SVG */}
                <svg
                  viewBox={cellOutline.viewBox}
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                >
                  {cellOutline.hasWall && (
                    <path
                      d={cellOutline.path}
                      fill="none"
                      stroke="rgba(132, 204, 22, 0.4)"
                      strokeWidth="6"
                      strokeDasharray="8 4"
                    />
                  )}
                  <path
                    d={cellOutline.path}
                    fill="rgba(20, 184, 166, 0.05)"
                    stroke="rgba(20, 184, 166, 0.4)"
                    strokeWidth="2"
                  />
                </svg>

                {/* Cell type label */}
                <div className="absolute top-2 left-3 text-xs text-slate-500 font-mono uppercase tracking-wider">
                  {cellContext || `${cellTypeLabel} Cell`}
                </div>

                {/* Placed organelles */}
                {Object.entries(placedOrganelles).map(([organelleId, pos]) => {
                  const organelle = validOrganelles.find(o => o.id === organelleId);
                  if (!organelle) return null;

                  const color = getOrganelleColor(organelle.name);
                  const size = getOrganelleSize(organelle.sizeRelative);
                  const zoneCorrect = placeFeedback[organelleId];
                  const borderColor = placeChecked
                    ? zoneCorrect ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)'
                    : 'rgba(255, 255, 255, 0.3)';

                  return (
                    <div
                      key={organelleId}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      draggable
                      onDragStart={() => handleDragStart(organelleId)}
                      onDoubleClick={() => handleRemoveOrganelle(organelleId)}
                      title="Drag to reposition, double-click to remove"
                    >
                      <div
                        className="rounded-full flex items-center justify-center transition-all"
                        style={{
                          width: size + 12,
                          height: size + 12,
                          backgroundColor: `${color}33`,
                          border: `2px solid ${borderColor}`,
                          boxShadow: `0 0 8px ${color}44`,
                        }}
                      >
                        <div
                          className="rounded-full"
                          style={{ width: size, height: size, backgroundColor: `${color}88` }}
                        />
                      </div>
                      {showLabels && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 text-[10px] text-slate-300 whitespace-nowrap bg-slate-900/80 px-1.5 py-0.5 rounded">
                          {organelle.name}
                        </div>
                      )}
                      {placeChecked && (
                        <div className="absolute -top-1 -right-1">
                          {zoneCorrect
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <XCircle className="w-4 h-4 text-red-400" />}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Empty state */}
                {Object.keys(placedOrganelles).length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">
                    Drag organelles from the palette or click to select, then click to place
                  </div>
                )}
              </div>

              {/* Organelle Palette + Quantity */}
              <div className="w-56 flex-shrink-0 space-y-3">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Organelles ({unplacedOrganellesList.length} remaining)
                </div>
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {unplacedOrganellesList.map(organelle => {
                    const color = getOrganelleColor(organelle.name);
                    const isSelected = selectedOrganelle === organelle.id;

                    return (
                      <div
                        key={organelle.id}
                        draggable
                        onDragStart={() => handleDragStart(organelle.id)}
                        onClick={() => setSelectedOrganelle(isSelected ? null : organelle.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                          isSelected
                            ? 'bg-emerald-600/30 border border-emerald-500/40 ring-1 ring-emerald-500/30'
                            : 'bg-slate-800/50 border border-white/10 hover:bg-slate-800/80 hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: `${color}66`, border: `2px solid ${color}` }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-slate-200 font-medium truncate">{organelle.name}</div>
                          {organelle.correctZone && (
                            <div className="text-[10px] text-slate-500 truncate">
                              Zone: {ZONE_LABELS[organelle.correctZone]}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {unplacedOrganellesList.length === 0 && (
                    <div className="text-xs text-emerald-400/50 text-center py-3">All organelles placed!</div>
                  )}
                </div>

                {/* Quantity Reasoning */}
                {quantityOrganelles.length > 0 && (
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      Quantity Reasoning
                    </div>
                    {quantityOrganelles.map(organelle => (
                      <div key={organelle.id} className="bg-black/20 rounded-lg p-2 space-y-1.5">
                        <div className="text-[11px] text-slate-300">
                          How many <span className="text-emerald-300 font-medium">{organelle.name}</span> would
                          a {cellContext} have?
                        </div>
                        <div className="flex gap-1">
                          {QUANTITY_OPTIONS.map(q => (
                            <button
                              key={q}
                              onClick={() => setQuantityAnswers(prev => ({ ...prev, [organelle.id]: q }))}
                              className={`flex-1 text-[10px] py-1 px-1 rounded transition-all ${
                                quantityAnswers[organelle.id] === q
                                  ? 'bg-emerald-500/30 border border-emerald-500/40 text-emerald-200'
                                  : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
                              }`}
                            >
                              {QUANTITY_LABELS[q].split(' ')[0]}
                            </button>
                          ))}
                        </div>
                        {quantityAnswers[organelle.id] && organelle.quantityReasoning && placeChecked && (
                          <div className={`text-[10px] p-1.5 rounded ${
                            quantityAnswers[organelle.id] === organelle.expectedQuantity
                              ? 'bg-green-500/10 text-green-300'
                              : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {quantityAnswers[organelle.id] === organelle.expectedQuantity
                              ? `Correct! ${organelle.quantityReasoning}`
                              : `Expected: ${QUANTITY_LABELS[organelle.expectedQuantity!]}. ${organelle.quantityReasoning}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Place actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                onClick={handleCheckPlace}
                disabled={!allPlaced}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Check Placement
              </Button>
              {placeChecked && (
                <Button
                  variant="ghost"
                  className="bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300"
                  onClick={handleAdvanceToMatch}
                >
                  <ArrowRight className="w-4 h-4 mr-1" />
                  Continue to Function Matching
                </Button>
              )}
              <div className="ml-auto text-xs text-slate-500">
                {Object.keys(placedOrganelles).length} / {organellesToPlace.length} placed
                {quantityOrganelles.length > 0 && (
                  <span className="ml-2">
                    | {Object.keys(quantityAnswers).length} / {quantityOrganelles.length} quantity answered
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* PHASE 3: MATCH FUNCTIONS                                         */}
        {/* ================================================================ */}
        {currentPhase === 'match-functions' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              Match each organelle to its function. Click an organelle, then click its matching function.
            </div>

            <div className="flex gap-4">
              {/* Left column: Organelle names */}
              <div className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Organelles</div>
                {validOrganelles.map(organelle => {
                  const color = getOrganelleColor(organelle.name);
                  const isSelected = selectedMatchOrganelle === organelle.id;
                  const isMatched = !!matchConnections[organelle.id];
                  const fb = matchFeedback[organelle.id];

                  return (
                    <button
                      key={organelle.id}
                      onClick={() => handleMatchClick(organelle.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                        fb !== undefined
                          ? fb
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-red-500/10 border border-red-500/30'
                          : isSelected
                            ? 'bg-emerald-600/30 border border-emerald-500/40 ring-1 ring-emerald-500/30'
                            : isMatched
                              ? 'bg-blue-500/10 border border-blue-500/30'
                              : 'bg-slate-800/50 border border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: `${color}66`, border: `2px solid ${color}` }}
                      />
                      <span className="text-xs text-slate-200 font-medium">{organelle.name}</span>
                      {isMatched && !matchChecked && (
                        <span className="ml-auto text-[10px] text-blue-400">matched</span>
                      )}
                      {fb !== undefined && (
                        <span className="ml-auto">
                          {fb ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right column: Function descriptions */}
              <div className="flex-1 space-y-1.5">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Functions</div>
                {shuffledFunctions.map(fm => {
                  const isAssigned = Object.values(matchConnections).includes(fm.organelleId);
                  const assignedBy = Object.entries(matchConnections).find(([, fId]) => fId === fm.organelleId)?.[0];
                  const assignedOrganelle = assignedBy ? validOrganelles.find(o => o.id === assignedBy) : null;
                  const fbCorrect = assignedBy ? matchFeedback[assignedBy] : undefined;

                  return (
                    <button
                      key={fm.organelleId}
                      onClick={() => handleFunctionClick(fm.organelleId)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                        fbCorrect !== undefined
                          ? fbCorrect
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-red-500/10 border border-red-500/30'
                          : isAssigned
                            ? 'bg-blue-500/10 border border-blue-500/30'
                            : selectedMatchOrganelle
                              ? 'bg-slate-800/50 border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-600/10 cursor-pointer'
                              : 'bg-slate-800/50 border border-white/10'
                      }`}
                    >
                      <div className="text-[11px] text-slate-300">{fm.functionDescription}</div>
                      {assignedOrganelle && (
                        <div className="text-[10px] text-blue-400 mt-1">
                          ← {assignedOrganelle.name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Match actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                onClick={handleCheckMatch}
                disabled={!allMatched}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Check Matches
              </Button>
              {matchChecked && !hasSubmitted && (
                <Button
                  variant="ghost"
                  className="bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-300"
                  onClick={handleSubmit}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Submit Answer
                </Button>
              )}
              <div className="ml-auto text-xs text-slate-500">
                {Object.keys(matchConnections).length} / {validOrganelles.length} matched
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* FEEDBACK + GLOBAL ACTIONS                                        */}
        {/* ================================================================ */}
        {feedback && (
          <div className={`p-3 rounded-lg border text-sm ${
            hasSubmitted
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : sortChecked && Object.values(sortFeedback).every(f => f.correct) && currentPhase === 'sort'
                ? 'bg-green-500/10 border-green-500/30 text-green-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            {feedback}
          </div>
        )}

        {hasSubmitted && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CellBuilder;
