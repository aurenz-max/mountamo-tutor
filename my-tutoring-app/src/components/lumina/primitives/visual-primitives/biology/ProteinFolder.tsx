'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { ProteinFolderMetrics } from '../../../evaluation/types';

// =============================================================================
// Data Interface (Single Source of Truth)
// =============================================================================

export interface AminoAcidResidue {
  position: number;
  threeLetterCode: string;
  name: string;
  property: 'hydrophobic' | 'hydrophilic' | 'charged-positive' | 'charged-negative' | 'polar';
  color: string;
}

export interface KeyInteraction {
  position1: number;
  position2: number;
  bondType: 'hydrogen' | 'ionic' | 'disulfide' | 'hydrophobic-interaction';
  description: string;
}

export interface FoldingLevels {
  primary: string;
  secondary: {
    type: 'alpha-helix' | 'beta-sheet' | 'mixed';
    description: string;
  };
  tertiary: {
    description: string;
    keyInteractions: KeyInteraction[];
  };
  quaternary: string | null;
}

export interface MutationChallenge {
  originalPosition: number;
  originalAminoAcid: string;
  mutatedAminoAcid: string;
  effectOnFolding: string;
  effectOnFunction: string;
  realWorldDisease: string | null;
}

export interface ProteinFolderData {
  proteinName: string;
  function: string;
  aminoAcidSequence: AminoAcidResidue[];
  foldingLevels: FoldingLevels;
  mutationChallenges: MutationChallenge[];
  analogies: {
    foldingAnalogy: string;
    misfoldingAnalogy: string;
  };
  gradeBand: '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

interface ProteinFolderProps {
  data: ProteinFolderData;
  className?: string;
}

// =============================================================================
// Property Styling Helpers
// =============================================================================

const PROPERTY_CONFIG: Record<string, { label: string; shortLabel: string; bgClass: string; textClass: string; placement: 'interior' | 'surface' }> = {
  'hydrophobic': { label: 'Hydrophobic', shortLabel: 'Phobic', bgClass: 'bg-amber-500/20', textClass: 'text-amber-300', placement: 'interior' },
  'hydrophilic': { label: 'Hydrophilic', shortLabel: 'Philic', bgClass: 'bg-sky-500/20', textClass: 'text-sky-300', placement: 'surface' },
  'charged-positive': { label: 'Charged (+)', shortLabel: '+', bgClass: 'bg-rose-500/20', textClass: 'text-rose-300', placement: 'surface' },
  'charged-negative': { label: 'Charged (-)', shortLabel: '-', bgClass: 'bg-violet-500/20', textClass: 'text-violet-300', placement: 'surface' },
  'polar': { label: 'Polar', shortLabel: 'Polar', bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-300', placement: 'surface' },
};

function getCorrectPlacement(property: string): 'interior' | 'surface' {
  return PROPERTY_CONFIG[property]?.placement ?? 'surface';
}

const BOND_COLORS: Record<string, string> = {
  'hydrogen': '#60a5fa',
  'ionic': '#f87171',
  'disulfide': '#fbbf24',
  'hydrophobic-interaction': '#fb923c',
};

// =============================================================================
// Component
// =============================================================================

const ProteinFolder: React.FC<ProteinFolderProps> = ({ data, className }) => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<string>('sequence');
  const [phase, setPhase] = useState<'explore' | 'fold' | 'mutate'>('explore');
  const [placements, setPlacements] = useState<Record<number, 'interior' | 'surface'>>({});
  const [foldingChecked, setFoldingChecked] = useState(false);
  const [foldingFeedback, setFoldingFeedback] = useState<string | null>(null);

  // Mutation state
  const [activeMutationIdx, setActiveMutationIdx] = useState(0);
  const [mutationPredictions, setMutationPredictions] = useState<Record<number, string>>({});
  const [mutationChecked, setMutationChecked] = useState<Record<number, boolean>>({});
  const [mutationFeedback, setMutationFeedback] = useState<Record<number, string>>({});

  // Selected residue for info panel
  const [selectedResidue, setSelectedResidue] = useState<number | null>(null);

  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<ProteinFolderMetrics>({
    primitiveType: 'protein-folder',
    instanceId: instanceId || `protein-folder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // --- Derived ---
  const sequence = data.aminoAcidSequence;

  const foldingResults = useMemo(() => {
    return sequence.map((aa) => {
      const correct = getCorrectPlacement(aa.property);
      const student = placements[aa.position];
      return {
        residueId: aa.position,
        studentPlacement: student ?? null,
        correctPlacement: correct,
        isCorrect: student === correct,
      };
    });
  }, [sequence, placements]);

  const allResiduesPlaced = useMemo(() => {
    return sequence.every((aa) => placements[aa.position] !== undefined);
  }, [sequence, placements]);

  const foldingScore = useMemo(() => {
    if (!allResiduesPlaced) return 0;
    const correct = foldingResults.filter((r) => r.isCorrect).length;
    return Math.round((correct / foldingResults.length) * 100);
  }, [foldingResults, allResiduesPlaced]);

  // --- Handlers ---
  const handlePlacement = useCallback((position: number, placement: 'interior' | 'surface') => {
    if (foldingChecked) return;
    setPlacements((prev) => ({ ...prev, [position]: placement }));
  }, [foldingChecked]);

  const handleCheckFolding = () => {
    setFoldingChecked(true);
    const correct = foldingResults.filter((r) => r.isCorrect).length;
    const total = foldingResults.length;
    if (correct === total) {
      setFoldingFeedback(`Perfect! All ${total} residues correctly placed. ${data.analogies.foldingAnalogy}`);
    } else {
      setFoldingFeedback(`${correct}/${total} residues placed correctly. Remember: hydrophobic residues cluster in the interior (away from water), while hydrophilic, charged, and polar residues face the surface (toward water).`);
    }
  };

  const handleAdvanceToMutate = () => {
    setPhase('mutate');
    setActiveTab('mutate');
  };

  const handleMutationPredict = (idx: number, prediction: string) => {
    setMutationPredictions((prev) => ({ ...prev, [idx]: prediction }));
  };

  const handleCheckMutation = (idx: number) => {
    const challenge = data.mutationChallenges[idx];
    setMutationChecked((prev) => ({ ...prev, [idx]: true }));
    setMutationFeedback((prev) => ({
      ...prev,
      [idx]: `Effect on folding: ${challenge.effectOnFolding}. Effect on function: ${challenge.effectOnFunction}.${challenge.realWorldDisease ? ` Real-world example: ${challenge.realWorldDisease}.` : ''}`,
    }));
  };

  const allMutationsChecked = useMemo(() => {
    return data.mutationChallenges.every((_, idx) => mutationChecked[idx]);
  }, [data.mutationChallenges, mutationChecked]);

  const handleSubmit = () => {
    if (hasSubmitted) return;

    const foldCorrect = foldingResults.filter((r) => r.isCorrect).length;
    const foldTotal = foldingResults.length;

    // Simple accuracy scoring for mutation predictions:
    // Check if prediction text loosely matches the effectOnFolding / effectOnFunction
    const mutScores = data.mutationChallenges.map((challenge, idx) => {
      const prediction = (mutationPredictions[idx] || '').toLowerCase().trim();
      const effectFolding = challenge.effectOnFolding.toLowerCase();
      const effectFunction = challenge.effectOnFunction.toLowerCase();
      // Simple heuristic: check for keyword overlap
      const words = prediction.split(/\s+/).filter(w => w.length > 3);
      const matchCount = words.filter(w => effectFolding.includes(w) || effectFunction.includes(w)).length;
      return Math.min(1, words.length > 0 ? matchCount / Math.max(1, Math.min(words.length, 3)) : 0);
    });

    const foldingAccuracy = foldTotal > 0 ? (foldCorrect / foldTotal) * 100 : 0;
    const mutationAccuracy = mutScores.length > 0 ? (mutScores.reduce((a, b) => a + b, 0) / mutScores.length) * 100 : 0;
    const overallScore = Math.round(foldingAccuracy * 0.6 + mutationAccuracy * 0.4);
    const success = foldingAccuracy >= 70 && overallScore >= 50;

    const metrics: ProteinFolderMetrics = {
      type: 'protein-folder',
      proteinName: data.proteinName,
      totalResidues: foldTotal,
      correctPlacements: foldCorrect,
      foldingAccuracy: Math.round(foldingAccuracy),
      foldingPredictions: foldingResults
        .filter((r): r is typeof r & { studentPlacement: 'interior' | 'surface' } => r.studentPlacement !== null)
        .map((r) => ({
          residueId: r.residueId,
          studentPlacement: r.studentPlacement,
          correctPlacement: r.correctPlacement,
          isCorrect: r.isCorrect,
        })),
      totalMutationChallenges: data.mutationChallenges.length,
      mutationPredictions: data.mutationChallenges.map((_, idx) => ({
        challengeIndex: idx,
        studentPredictedEffect: mutationPredictions[idx] || '',
        accuracyScore: mutScores[idx] ?? 0,
      })),
      mutationAccuracy: Math.round(mutationAccuracy),
      overallAccuracy: overallScore,
    };

    submitResult(success, overallScore, metrics, {
      studentWork: { placements, mutationPredictions },
    });
  };

  const handleReset = () => {
    setPlacements({});
    setFoldingChecked(false);
    setFoldingFeedback(null);
    setMutationPredictions({});
    setMutationChecked({});
    setMutationFeedback({});
    setPhase('explore');
    setActiveTab('sequence');
    setSelectedResidue(null);
    setActiveMutationIdx(0);
    resetAttempt();
  };

  // --- Render Helpers ---
  const renderResidueChip = (aa: AminoAcidResidue, interactive: boolean) => {
    const config = PROPERTY_CONFIG[aa.property];
    const placement = placements[aa.position];
    const result = foldingChecked ? foldingResults.find((r) => r.residueId === aa.position) : null;
    const isSelected = selectedResidue === aa.position;

    return (
      <button
        key={aa.position}
        onClick={() => setSelectedResidue(isSelected ? null : aa.position)}
        className={`relative inline-flex flex-col items-center px-2 py-1.5 rounded-lg border transition-all text-xs ${
          isSelected
            ? 'border-white/40 ring-1 ring-white/20 scale-105'
            : 'border-white/10 hover:border-white/20'
        } ${config.bgClass}`}
        style={{ minWidth: 48 }}
      >
        <span className={`font-mono font-bold text-sm ${config.textClass}`}>{aa.threeLetterCode}</span>
        <span className="text-slate-500 text-[10px]">#{aa.position}</span>
        {interactive && phase === 'fold' && !foldingChecked && (
          <div className="flex gap-0.5 mt-1">
            <button
              onClick={(e) => { e.stopPropagation(); handlePlacement(aa.position, 'interior'); }}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                placement === 'interior'
                  ? 'bg-amber-500/30 border-amber-400/50 text-amber-200'
                  : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
              title="Place in interior (away from water)"
            >
              In
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handlePlacement(aa.position, 'surface'); }}
              className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${
                placement === 'surface'
                  ? 'bg-sky-500/30 border-sky-400/50 text-sky-200'
                  : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-slate-300'
              }`}
              title="Place on surface (facing water)"
            >
              Out
            </button>
          </div>
        )}
        {result && (
          <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center ${
            result.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {result.isCorrect ? '\u2713' : '\u2717'}
          </span>
        )}
      </button>
    );
  };

  const renderFoldingVisualization = () => {
    const w = 400;
    const h = 300;
    const cx = w / 2;
    const cy = h / 2;
    const interiorR = 80;
    const surfaceR = 130;

    // Position residues in a circle based on placement
    const positioned = sequence.map((aa, i) => {
      const placement = placements[aa.position];
      const angle = (i / sequence.length) * Math.PI * 2 - Math.PI / 2;
      const r = placement === 'interior' ? interiorR * (0.4 + Math.random() * 0.5) :
                placement === 'surface' ? surfaceR + 10 + Math.random() * 20 :
                surfaceR * 0.7;
      return {
        ...aa,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        placement,
      };
    });

    const interactions = data.foldingLevels.tertiary.keyInteractions;

    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-md mx-auto">
        {/* Background regions */}
        <circle cx={cx} cy={cy} r={surfaceR + 30} fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx={cx} cy={cy} r={interiorR} fill="rgba(251,191,36,0.05)" stroke="rgba(251,191,36,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <text x={cx} y={cy - interiorR - 6} textAnchor="middle" fontSize="10" fill="rgba(251,191,36,0.5)">Interior</text>
        <text x={cx} y={cy - surfaceR - 32} textAnchor="middle" fontSize="10" fill="rgba(56,189,248,0.5)">Surface</text>

        {/* Key interactions */}
        {interactions.map((int, idx) => {
          const a = positioned.find(p => p.position === int.position1);
          const b = positioned.find(p => p.position === int.position2);
          if (!a || !b) return null;
          return (
            <line
              key={idx}
              x1={a.x} y1={a.y}
              x2={b.x} y2={b.y}
              stroke={BOND_COLORS[int.bondType] || '#666'}
              strokeWidth="1.5"
              strokeDasharray="3 2"
              opacity={0.6}
            />
          );
        })}

        {/* Residue nodes */}
        {positioned.map((aa) => {
          const config = PROPERTY_CONFIG[aa.property];
          const result = foldingChecked ? foldingResults.find(r => r.residueId === aa.position) : null;
          return (
            <g key={aa.position}>
              <circle
                cx={aa.x} cy={aa.y} r={12}
                fill={aa.color}
                opacity={0.7}
                stroke={result ? (result.isCorrect ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.2)'}
                strokeWidth={result ? 2 : 1}
              />
              <text
                x={aa.x} y={aa.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="7"
                fontFamily="monospace"
                fontWeight="bold"
                fill="white"
              >
                {aa.threeLetterCode}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl">
              {data.proteinName} - Protein Folding Simulator
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {data.function}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className={`${phase === 'explore' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
              1. Explore
            </Badge>
            <Badge className={`${phase === 'fold' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
              2. Fold
            </Badge>
            <Badge className={`${phase === 'mutate' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800/50 text-slate-500 border-slate-700/50'}`}>
              3. Mutate
            </Badge>
          </div>
        </div>

        {/* Analogies */}
        <div className="mt-3 p-3 bg-black/20 rounded-lg border border-white/5">
          <p className="text-slate-400 text-sm italic">
            {phase === 'mutate' ? data.analogies.misfoldingAnalogy : data.analogies.foldingAnalogy}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="sequence" className="data-[state=active]:bg-white/10 text-slate-300">
              Sequence
            </TabsTrigger>
            <TabsTrigger value="structure" className="data-[state=active]:bg-white/10 text-slate-300">
              Structure
            </TabsTrigger>
            <TabsTrigger
              value="mutate"
              className="data-[state=active]:bg-white/10 text-slate-300"
              disabled={phase === 'explore'}
            >
              Mutations
            </TabsTrigger>
          </TabsList>

          {/* === SEQUENCE TAB === */}
          <TabsContent value="sequence" className="space-y-4 mt-4">
            {/* Property legend */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(PROPERTY_CONFIG).map(([key, cfg]) => (
                <Badge key={key} className={`${cfg.bgClass} ${cfg.textClass} border border-white/10 text-xs`}>
                  {cfg.label} = {cfg.placement === 'interior' ? 'Interior' : 'Surface'}
                </Badge>
              ))}
            </div>

            {/* Linear amino acid sequence */}
            <div className="p-4 bg-black/20 rounded-xl border border-white/5">
              <p className="text-slate-500 text-xs mb-3 uppercase tracking-wider font-medium">
                Amino Acid Chain ({sequence.length} residues)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sequence.map((aa) => renderResidueChip(aa, true))}
              </div>
            </div>

            {/* Selected residue info */}
            {selectedResidue !== null && (() => {
              const aa = sequence.find(a => a.position === selectedResidue);
              if (!aa) return null;
              const cfg = PROPERTY_CONFIG[aa.property];
              return (
                <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: aa.color }}>
                      <span className="font-mono font-bold text-white text-sm">{aa.threeLetterCode}</span>
                    </div>
                    <div>
                      <p className="text-slate-100 font-medium">{aa.name} (#{aa.position})</p>
                      <p className={`text-sm ${cfg.textClass}`}>{cfg.label} - Folds to {cfg.placement}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Phase actions */}
            {phase === 'explore' && (
              <div className="flex justify-center">
                <Button
                  onClick={() => { setPhase('fold'); }}
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                >
                  Start Folding Challenge
                </Button>
              </div>
            )}

            {phase === 'fold' && !foldingChecked && (
              <div className="space-y-3">
                <p className="text-slate-300 text-sm text-center">
                  For each residue above, click <strong>In</strong> (interior - away from water) or <strong>Out</strong> (surface - facing water) based on its chemical property.
                </p>
                <div className="flex justify-center">
                  <Button
                    onClick={handleCheckFolding}
                    disabled={!allResiduesPlaced}
                    variant="ghost"
                    className="bg-white/5 border border-white/20 hover:bg-white/10"
                  >
                    {allResiduesPlaced ? 'Check Folding' : `Place all residues (${Object.keys(placements).length}/${sequence.length})`}
                  </Button>
                </div>
              </div>
            )}

            {foldingFeedback && (
              <div className={`p-4 rounded-xl border ${
                foldingScore === 100
                  ? 'bg-green-500/10 border-green-500/30'
                  : foldingScore >= 70
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-200 font-medium">Folding Score: {foldingScore}%</span>
                  {foldingChecked && phase === 'fold' && (
                    <Button
                      onClick={handleAdvanceToMutate}
                      variant="ghost"
                      className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 text-sm"
                    >
                      Continue to Mutations
                    </Button>
                  )}
                </div>
                <p className="text-slate-400 text-sm">{foldingFeedback}</p>
              </div>
            )}
          </TabsContent>

          {/* === STRUCTURE TAB === */}
          <TabsContent value="structure" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Folding visualization */}
              <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                <p className="text-slate-500 text-xs mb-3 uppercase tracking-wider font-medium">
                  Folding Visualization
                </p>
                {renderFoldingVisualization()}
                {/* Bond legend */}
                <div className="flex flex-wrap gap-2 mt-3 justify-center">
                  {Object.entries(BOND_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5" style={{ backgroundColor: color }} />
                      <span className="text-slate-500 text-[10px] capitalize">{type.replace('-', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folding levels */}
              <div className="space-y-3">
                <Accordion type="multiple" defaultValue={['primary', 'secondary']}>
                  <AccordionItem value="primary" className="border-white/10">
                    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline text-sm">
                      Primary Structure
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-slate-400 text-sm">{data.foldingLevels.primary}</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="secondary" className="border-white/10">
                    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline text-sm">
                      Secondary Structure
                    </AccordionTrigger>
                    <AccordionContent>
                      <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300 mb-2">
                        {data.foldingLevels.secondary.type}
                      </Badge>
                      <p className="text-slate-400 text-sm">{data.foldingLevels.secondary.description}</p>
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="tertiary" className="border-white/10">
                    <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline text-sm">
                      Tertiary Structure
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <p className="text-slate-400 text-sm">{data.foldingLevels.tertiary.description}</p>
                      <div className="space-y-1.5">
                        {data.foldingLevels.tertiary.keyInteractions.map((int, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-slate-800/30 rounded-lg">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BOND_COLORS[int.bondType] || '#666' }} />
                            <span className="text-slate-300 text-xs">
                              #{int.position1} - #{int.position2}: {int.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {data.foldingLevels.quaternary && (
                    <AccordionItem value="quaternary" className="border-white/10">
                      <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline text-sm">
                        Quaternary Structure
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-slate-400 text-sm">{data.foldingLevels.quaternary}</p>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            </div>
          </TabsContent>

          {/* === MUTATIONS TAB === */}
          <TabsContent value="mutate" className="space-y-4 mt-4">
            {phase !== 'mutate' ? (
              <div className="text-center py-8">
                <p className="text-slate-500">Complete the folding challenge first to unlock mutation mode.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-300 text-sm">
                  See what happens when a single amino acid changes. Predict how each mutation affects the protein&apos;s folding and function.
                </p>

                {/* Mutation selector */}
                <div className="flex gap-2">
                  {data.mutationChallenges.map((_, idx) => (
                    <Button
                      key={idx}
                      onClick={() => setActiveMutationIdx(idx)}
                      variant="ghost"
                      className={`text-sm ${
                        activeMutationIdx === idx
                          ? 'bg-rose-500/20 border-rose-400/30 text-rose-300'
                          : 'bg-white/5 border border-white/20 text-slate-400 hover:text-white'
                      }`}
                    >
                      Mutation {idx + 1}
                      {mutationChecked[idx] && <span className="ml-1 text-green-400">{'\u2713'}</span>}
                    </Button>
                  ))}
                </div>

                {/* Active mutation */}
                {(() => {
                  const challenge = data.mutationChallenges[activeMutationIdx];
                  if (!challenge) return null;
                  const originalAA = sequence.find(aa => aa.position === challenge.originalPosition);

                  return (
                    <div className="p-4 bg-black/20 rounded-xl border border-white/5 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-slate-500 text-[10px] uppercase">Original</p>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center mt-1"
                            style={{ backgroundColor: originalAA?.color || '#666' }}>
                            <span className="font-mono font-bold text-white text-xs">{challenge.originalAminoAcid}</span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">Position #{challenge.originalPosition}</p>
                        </div>
                        <span className="text-2xl text-slate-600">{'\u2192'}</span>
                        <div className="text-center">
                          <p className="text-slate-500 text-[10px] uppercase">Mutated</p>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center mt-1 bg-rose-500/30 border-2 border-rose-400/50">
                            <span className="font-mono font-bold text-rose-200 text-xs">{challenge.mutatedAminoAcid}</span>
                          </div>
                          <p className="text-rose-400 text-xs mt-1">Substitution</p>
                        </div>
                        {challenge.realWorldDisease && (
                          <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/30 ml-auto">
                            {challenge.realWorldDisease}
                          </Badge>
                        )}
                      </div>

                      {/* Prediction input */}
                      {!mutationChecked[activeMutationIdx] ? (
                        <div className="space-y-2">
                          <label className="text-slate-400 text-sm">
                            What do you predict will happen to the protein when this amino acid changes?
                          </label>
                          <textarea
                            value={mutationPredictions[activeMutationIdx] || ''}
                            onChange={(e) => handleMutationPredict(activeMutationIdx, e.target.value)}
                            placeholder="Describe how you think this mutation will affect folding and function..."
                            className="w-full bg-slate-800/50 text-slate-200 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                            rows={3}
                          />
                          <Button
                            onClick={() => handleCheckMutation(activeMutationIdx)}
                            disabled={!mutationPredictions[activeMutationIdx]?.trim()}
                            variant="ghost"
                            className="bg-white/5 border border-white/20 hover:bg-white/10"
                          >
                            Check Prediction
                          </Button>
                        </div>
                      ) : (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <p className="text-emerald-300 text-sm font-medium mb-1">Actual Effect:</p>
                          <p className="text-slate-300 text-sm">{mutationFeedback[activeMutationIdx]}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Submit / Reset */}
                {allMutationsChecked && (
                  <div className="flex gap-2 justify-center pt-2">
                    <Button
                      onClick={handleSubmit}
                      disabled={hasSubmitted}
                      variant="ghost"
                      className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                    >
                      {hasSubmitted ? 'Submitted' : 'Submit Results'}
                    </Button>
                    {hasSubmitted && (
                      <Button
                        onClick={handleReset}
                        variant="ghost"
                        className="bg-white/5 border border-white/20 hover:bg-white/10"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ProteinFolder;
