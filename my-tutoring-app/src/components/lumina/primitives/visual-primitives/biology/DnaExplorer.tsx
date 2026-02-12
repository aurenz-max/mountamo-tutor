'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { DnaExplorerMetrics } from '../../../evaluation/types';
import { DnaHelixScene } from './DnaHelixScene';

// ============================================================================
// Data Interface (Single source of truth)
// ============================================================================

export interface NucleotideInfo {
  base: 'A' | 'T' | 'C' | 'G';
  fullName: string;
  type: 'purine' | 'pyrimidine';
  pairsWith: string;
  color: string;
  bondType: string;
}

export interface HighlightedRegion {
  start: number;
  end: number;
  label: string;
}

export interface SequenceInfo {
  templateStrand: string;
  complementaryStrand: string;
  highlightedRegion?: HighlightedRegion;
}

export interface StructuralFeatures {
  sugarPhosphateBackbone: string;
  majorGroove?: string;
  minorGroove?: string;
  antiparallelOrientation: string;
}

export interface ZoomLevelInfo {
  level: 'chromosome' | 'gene' | 'sequence' | 'base-pair' | 'molecular';
  description: string;
  visibleFeatures: string[];
}

export interface BuildChallenge {
  givenStrand: string;
  task: string;
  correctAnswer: string;
}

export interface DnaExplorerData {
  title?: string;
  description?: string;
  mode: 'structure' | 'base-pairing' | 'transcription' | 'replication';
  sequence: SequenceInfo;
  nucleotides: NucleotideInfo[];
  structuralFeatures: StructuralFeatures;
  zoomLevels: ZoomLevelInfo[];
  centralDogmaStep?: 'none' | 'transcription' | 'translation';
  buildChallenges: BuildChallenge[];
  gradeBand: '5-6' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const BASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-green-500/30', text: 'text-green-300', border: 'border-green-500/50' },
  T: { bg: 'bg-red-500/30', text: 'text-red-300', border: 'border-red-500/50' },
  C: { bg: 'bg-blue-500/30', text: 'text-blue-300', border: 'border-blue-500/50' },
  G: { bg: 'bg-yellow-500/30', text: 'text-yellow-300', border: 'border-yellow-500/50' },
};

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

function getBaseStyle(base: string) {
  return BASE_COLORS[base] || { bg: 'bg-slate-500/30', text: 'text-slate-300', border: 'border-slate-500/50' };
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Double helix visualization rendered as SVG */
const HelixVisualization: React.FC<{
  sequence: SequenceInfo;
  highlightedRegion?: HighlightedRegion;
  onBaseClick?: (position: number, strand: 'template' | 'complementary') => void;
  selectedBase?: { position: number; strand: string } | null;
}> = ({ sequence, highlightedRegion, onBaseClick, selectedBase }) => {
  const templateBases = sequence.templateStrand.split('');
  const compBases = sequence.complementaryStrand.split('');
  const width = Math.max(600, templateBases.length * 60 + 80);
  const height = 200;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px]" style={{ maxHeight: 200 }}>
        {/* Backbone lines */}
        <path
          d={`M 40 50 ${templateBases.map((_, i) => `L ${i * 60 + 60} ${50 + Math.sin(i * 0.8) * 10}`).join(' ')}`}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="3"
          fill="none"
        />
        <path
          d={`M 40 150 ${compBases.map((_, i) => `L ${i * 60 + 60} ${150 - Math.sin(i * 0.8) * 10}`).join(' ')}`}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="3"
          fill="none"
        />

        {/* Base pairs */}
        {templateBases.map((base, i) => {
          const x = i * 60 + 60;
          const topY = 50 + Math.sin(i * 0.8) * 10;
          const bottomY = 150 - Math.sin(i * 0.8) * 10;
          const comp = compBases[i] || '';
          const isHighlighted = highlightedRegion &&
            i >= highlightedRegion.start && i <= highlightedRegion.end;
          const isSelected =
            (selectedBase?.position === i && selectedBase?.strand === 'template') ||
            (selectedBase?.position === i && selectedBase?.strand === 'complementary');

          return (
            <g key={i}>
              {/* Hydrogen bond line */}
              <line
                x1={x} y1={topY + 16} x2={x} y2={bottomY - 16}
                stroke={isHighlighted ? 'rgba(250, 204, 21, 0.5)' : 'rgba(100, 116, 139, 0.3)'}
                strokeWidth="1.5"
                strokeDasharray={base === 'A' || base === 'T' ? '4 4' : '3 3 6 3'}
              />

              {/* Template base */}
              <g
                onClick={() => onBaseClick?.(i, 'template')}
                className="cursor-pointer"
              >
                <circle
                  cx={x} cy={topY}
                  r={isSelected ? 16 : 14}
                  className={`transition-all ${isHighlighted ? 'stroke-yellow-400' : ''}`}
                  fill={base === 'A' ? 'rgba(34, 197, 94, 0.4)' : base === 'T' ? 'rgba(239, 68, 68, 0.4)' : base === 'C' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(234, 179, 8, 0.4)'}
                  stroke={isSelected ? '#fff' : isHighlighted ? '#facc15' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text x={x} y={topY + 5} textAnchor="middle" className="fill-white text-sm font-bold select-none" style={{ fontSize: 14 }}>
                  {base}
                </text>
              </g>

              {/* Complementary base */}
              <g
                onClick={() => onBaseClick?.(i, 'complementary')}
                className="cursor-pointer"
              >
                <circle
                  cx={x} cy={bottomY}
                  r={isSelected ? 16 : 14}
                  fill={comp === 'A' ? 'rgba(34, 197, 94, 0.4)' : comp === 'T' ? 'rgba(239, 68, 68, 0.4)' : comp === 'C' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(234, 179, 8, 0.4)'}
                  stroke={isSelected ? '#fff' : isHighlighted ? '#facc15' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text x={x} y={bottomY + 5} textAnchor="middle" className="fill-white text-sm font-bold select-none" style={{ fontSize: 14 }}>
                  {comp}
                </text>
              </g>

              {/* Bond count indicator */}
              <text x={x} y={(topY + bottomY) / 2 + 3} textAnchor="middle" className="fill-slate-500 select-none" style={{ fontSize: 9 }}>
                {(base === 'A' || base === 'T') ? '2H' : '3H'}
              </text>
            </g>
          );
        })}

        {/* Strand labels */}
        <text x={15} y={55} className="fill-slate-400 select-none" style={{ fontSize: 11 }}>5&apos;</text>
        <text x={width - 25} y={55} className="fill-slate-400 select-none" style={{ fontSize: 11 }}>3&apos;</text>
        <text x={15} y={155} className="fill-slate-400 select-none" style={{ fontSize: 11 }}>3&apos;</text>
        <text x={width - 25} y={155} className="fill-slate-400 select-none" style={{ fontSize: 11 }}>5&apos;</text>

        {/* Highlighted region label */}
        {highlightedRegion && (
          <text
            x={(highlightedRegion.start + highlightedRegion.end) / 2 * 60 + 60}
            y={20}
            textAnchor="middle"
            className="fill-yellow-400 select-none"
            style={{ fontSize: 11 }}
          >
            {highlightedRegion.label}
          </text>
        )}
      </svg>
    </div>
  );
};

/** Nucleotide reference panel */
const NucleotideReference: React.FC<{ nucleotides: NucleotideInfo[] }> = ({ nucleotides }) => (
  <div className="grid grid-cols-2 gap-3">
    {nucleotides.map((nuc) => {
      const style = getBaseStyle(nuc.base);
      return (
        <div
          key={nuc.base}
          className={`p-3 rounded-lg border ${style.bg} ${style.border}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xl font-bold ${style.text}`}>{nuc.base}</span>
            <span className="text-slate-300 text-sm">{nuc.fullName}</span>
          </div>
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Type: <span className="text-slate-300">{nuc.type}</span></div>
            <div>Pairs with: <span className={`font-semibold ${getBaseStyle(nuc.pairsWith).text}`}>{nuc.pairsWith}</span></div>
            <div>Bonds: <span className="text-slate-300">{nuc.bondType}</span></div>
          </div>
        </div>
      );
    })}
  </div>
);

/** Zoom level explorer */
const ZoomLevelExplorer: React.FC<{
  zoomLevels: ZoomLevelInfo[];
  currentLevel: string;
  onLevelChange: (level: string) => void;
}> = ({ zoomLevels, currentLevel, onLevelChange }) => {
  const levelIcons: Record<string, string> = {
    chromosome: '🧬',
    gene: '📍',
    sequence: '🔡',
    'base-pair': '🔗',
    molecular: '⚛️',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">Zoom Level</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {zoomLevels.map((zl) => (
          <Button
            key={zl.level}
            variant="ghost"
            onClick={() => onLevelChange(zl.level)}
            className={`text-xs px-3 py-2 border transition-all ${
              currentLevel === zl.level
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                : 'bg-white/5 border-white/20 text-slate-400 hover:bg-white/10'
            }`}
          >
            <span className="mr-1">{levelIcons[zl.level] || '🔍'}</span>
            {zl.level.replace('-', ' ')}
          </Button>
        ))}
      </div>
      {zoomLevels.find((z) => z.level === currentLevel) && (
        <div className="p-3 bg-black/20 rounded-lg border border-white/5">
          <p className="text-slate-300 text-sm mb-2">
            {zoomLevels.find((z) => z.level === currentLevel)?.description}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {zoomLevels
              .find((z) => z.level === currentLevel)
              ?.visibleFeatures.map((feat, i) => (
                <Badge key={i} className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
                  {feat}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Build challenge component */
const BuildChallengePanel: React.FC<{
  challenge: BuildChallenge;
  challengeIndex: number;
  onComplete: (index: number, answer: string, isCorrect: boolean) => void;
  completed: boolean;
}> = ({ challenge, challengeIndex, onComplete, completed }) => {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);

  const handleCheck = () => {
    const normalizedAnswer = answer.toUpperCase().replace(/\s/g, '');
    const normalizedCorrect = challenge.correctAnswer.toUpperCase().replace(/\s/g, '');
    const isCorrect = normalizedAnswer === normalizedCorrect;

    setFeedback({
      correct: isCorrect,
      message: isCorrect
        ? 'Correct! Great job with base pairing!'
        : `Not quite. The correct answer is ${challenge.correctAnswer}. Remember: A pairs with T, and C pairs with G.`,
    });
    onComplete(challengeIndex, normalizedAnswer, isCorrect);
  };

  // Parse given strand to show blanks
  const strandChars = challenge.givenStrand.split('');

  return (
    <div className={`p-4 rounded-lg border transition-all ${
      completed
        ? feedback?.correct
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-amber-500/10 border-amber-500/30'
        : 'bg-black/20 border-white/10'
    }`}>
      <p className="text-slate-300 text-sm mb-3">{challenge.task}</p>

      {/* Given strand display */}
      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">Template strand:</div>
        <div className="flex gap-1 flex-wrap">
          {strandChars.map((char, i) => {
            const isBlank = char === '_' || char === '?';
            const style = isBlank ? { bg: 'bg-slate-700/50', text: 'text-slate-500', border: 'border-slate-600' } : getBaseStyle(char);
            return (
              <span
                key={i}
                className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold border ${style.bg} ${style.text} ${style.border}`}
              >
                {isBlank ? '?' : char}
              </span>
            );
          })}
        </div>
      </div>

      {/* Answer input */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.toUpperCase())}
          placeholder="Enter complementary bases..."
          disabled={completed}
          className="flex-1 bg-slate-800/80 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          maxLength={challenge.correctAnswer.length}
        />
        <Button
          variant="ghost"
          onClick={handleCheck}
          disabled={completed || answer.length === 0}
          className="bg-white/5 border border-white/20 hover:bg-white/10 text-sm"
        >
          Check
        </Button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mt-2 p-2 rounded text-xs ${
          feedback.correct ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface DnaExplorerProps {
  data: DnaExplorerData;
  className?: string;
}

const DnaExplorer: React.FC<DnaExplorerProps> = ({ data, className }) => {
  const [activeTab, setActiveTab] = useState<string>('explore');
  const [selectedBase, setSelectedBase] = useState<{ position: number; strand: string } | null>(null);
  const [currentZoomLevel, setCurrentZoomLevel] = useState<string>(data.zoomLevels[0]?.level || 'sequence');
  const [exploredZoomLevels, setExploredZoomLevels] = useState<Set<string>>(new Set([data.zoomLevels[0]?.level || 'sequence']));
  const [challengeResults, setChallengeResults] = useState<Map<number, { answer: string; correct: boolean }>>(new Map());
  const [basePairingAttempts, setBasePairingAttempts] = useState<Array<{
    position: number;
    givenBase: string;
    studentBase: string;
    correctBase: string;
    isCorrect: boolean;
  }>>([]);

  // Destructure evaluation props
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<DnaExplorerMetrics>({
    primitiveType: 'dna-explorer',
    instanceId: instanceId || `dna-explorer-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const handleZoomLevelChange = useCallback((level: string) => {
    setCurrentZoomLevel(level);
    setExploredZoomLevels((prev) => { const next = new Set(prev); next.add(level); return next; });
  }, []);

  const handleBaseClick = useCallback((position: number, strand: 'template' | 'complementary') => {
    setSelectedBase({ position, strand });
  }, []);

  const handleChallengeComplete = useCallback((index: number, answer: string, isCorrect: boolean) => {
    setChallengeResults((prev) => {
      const next = new Map(prev);
      next.set(index, { answer, correct: isCorrect });
      return next;
    });
  }, []);

  // Compute completion state
  const allChallengesCompleted = data.buildChallenges.length > 0 &&
    challengeResults.size === data.buildChallenges.length;

  const correctChallenges = useMemo(
    () => Array.from(challengeResults.values()).filter((r) => r.correct).length,
    [challengeResults]
  );

  const handleSubmitEvaluation = useCallback(() => {
    if (hasSubmitted) return;

    const totalChallenges = data.buildChallenges.length;
    const accuracy = totalChallenges > 0 ? (correctChallenges / totalChallenges) * 100 : 100;
    const success = accuracy >= 70;

    const metrics: DnaExplorerMetrics = {
      type: 'dna-explorer',
      mode: data.mode,
      gradeBand: data.gradeBand,
      sequenceLength: data.sequence.templateStrand.length,
      basePairingAttempts,
      buildChallengeResults: data.buildChallenges.map((ch, i) => {
        const result = challengeResults.get(i);
        return {
          challengeIndex: i,
          studentAnswer: result?.answer || '',
          correctAnswer: ch.correctAnswer,
          accuracy: result?.correct ? 1 : 0,
        };
      }),
      zoomLevelsExplored: Array.from(exploredZoomLevels),
      totalChallenges,
      correctChallenges,
      accuracy,
    };

    submitResult(success, accuracy, metrics, {
      studentWork: {
        challengeResults: Object.fromEntries(challengeResults),
        basePairingAttempts,
        exploredZoomLevels: Array.from(exploredZoomLevels),
      },
    });
  }, [
    hasSubmitted, data, correctChallenges, challengeResults,
    basePairingAttempts, exploredZoomLevels, submitResult,
  ]);

  const handleReset = () => {
    setChallengeResults(new Map());
    setBasePairingAttempts([]);
    setSelectedBase(null);
    resetAttempt();
  };

  // Get selected base info
  const selectedBaseInfo = useMemo(() => {
    if (!selectedBase) return null;
    const strand = selectedBase.strand === 'template' ? data.sequence.templateStrand : data.sequence.complementaryStrand;
    const base = strand[selectedBase.position];
    return data.nucleotides.find((n) => n.base === base) || null;
  }, [selectedBase, data.sequence, data.nucleotides]);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <span className="text-2xl">🧬</span>
              {data.title || 'DNA Explorer'}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              {data.description || 'Explore the structure of DNA and practice base pairing'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge className="bg-cyan-500/20 border-cyan-400/40 text-cyan-300">
              {data.mode}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              Grade {data.gradeBand}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/60 border border-white/10">
            <TabsTrigger value="explore" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              Explore
            </TabsTrigger>
            <TabsTrigger value="structure" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
              Structure
            </TabsTrigger>
            {data.buildChallenges.length > 0 && (
              <TabsTrigger value="build" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                Build {challengeResults.size > 0 && `(${correctChallenges}/${data.buildChallenges.length})`}
              </TabsTrigger>
            )}
            {data.zoomLevels.length > 0 && (
              <TabsTrigger value="zoom" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                Zoom Levels
              </TabsTrigger>
            )}
          </TabsList>

          {/* Explore Tab */}
          <TabsContent value="explore" className="space-y-4">
            {/* DNA Visualization */}
            <div className="p-4 bg-black/20 rounded-lg border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Double Helix Visualization</span>
                <span className="text-xs text-slate-500">Click a base to learn more</span>
              </div>
              <HelixVisualization
                sequence={data.sequence}
                highlightedRegion={data.sequence.highlightedRegion}
                onBaseClick={handleBaseClick}
                selectedBase={selectedBase}
              />
            </div>

            {/* Selected base info */}
            {selectedBaseInfo && (
              <div className={`p-3 rounded-lg border ${getBaseStyle(selectedBaseInfo.base).bg} ${getBaseStyle(selectedBaseInfo.base).border}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${getBaseStyle(selectedBaseInfo.base).text}`}>
                    {selectedBaseInfo.base}
                  </span>
                  <div>
                    <div className="text-slate-200 font-medium">{selectedBaseInfo.fullName}</div>
                    <div className="text-xs text-slate-400">
                      {selectedBaseInfo.type} | Pairs with {selectedBaseInfo.pairsWith} via {selectedBaseInfo.bondType}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sequence display */}
            <div className="space-y-2">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Sequence</div>
              <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs text-slate-500 w-16">5&apos; → 3&apos;</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {data.sequence.templateStrand.split('').map((base, i) => {
                      const style = getBaseStyle(base);
                      const isHighlighted = data.sequence.highlightedRegion &&
                        i >= data.sequence.highlightedRegion.start &&
                        i <= data.sequence.highlightedRegion.end;
                      return (
                        <span
                          key={`t-${i}`}
                          className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${style.bg} ${style.text} ${isHighlighted ? 'ring-1 ring-yellow-400' : ''}`}
                        >
                          {base}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500 w-16">3&apos; → 5&apos;</span>
                  <div className="flex gap-0.5 flex-wrap">
                    {data.sequence.complementaryStrand.split('').map((base, i) => {
                      const style = getBaseStyle(base);
                      return (
                        <span
                          key={`c-${i}`}
                          className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold ${style.bg} ${style.text}`}
                        >
                          {base}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Nucleotide Reference */}
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Nucleotide Reference</div>
              <NucleotideReference nucleotides={data.nucleotides} />
            </div>
          </TabsContent>

          {/* Structure Tab */}
          <TabsContent value="structure" className="space-y-4">
            {/* 3D DNA Helix Visualization */}
            <div className="w-full h-[450px] bg-slate-900 rounded-xl border border-white/5 overflow-hidden relative">
              <div className="absolute top-3 left-3 z-10">
                <span className="text-xs text-slate-500 uppercase tracking-wider bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                  3D Structure View
                </span>
              </div>
              <DnaHelixScene
                sequence={data.sequence}
                structuralFeatures={data.structuralFeatures}
                mode="structure"
                onBaseClick={(position) => handleBaseClick(position, 'template')}
              />
              <div className="absolute bottom-3 left-3 z-10">
                <span className="text-[10px] text-slate-500 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                  Drag to rotate · Scroll to zoom · Right-click to pan
                </span>
              </div>
            </div>

            {/* Structural Features Text Cards */}
            <div className="grid gap-4">
              <div className="p-4 bg-black/20 rounded-lg border border-white/5 space-y-3">
                <h4 className="text-sm font-medium text-slate-200">Sugar-Phosphate Backbone</h4>
                <p className="text-sm text-slate-400">{data.structuralFeatures.sugarPhosphateBackbone}</p>
              </div>

              <div className="p-4 bg-black/20 rounded-lg border border-white/5 space-y-3">
                <h4 className="text-sm font-medium text-slate-200">Antiparallel Orientation</h4>
                <p className="text-sm text-slate-400">{data.structuralFeatures.antiparallelOrientation}</p>
              </div>

              {data.structuralFeatures.majorGroove && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                    <h4 className="text-sm font-medium text-slate-200 mb-1">Major Groove</h4>
                    <p className="text-xs text-slate-400">{data.structuralFeatures.majorGroove}</p>
                  </div>
                  <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                    <h4 className="text-sm font-medium text-slate-200 mb-1">Minor Groove</h4>
                    <p className="text-xs text-slate-400">{data.structuralFeatures.minorGroove}</p>
                  </div>
                </div>
              )}

              {data.centralDogmaStep && data.centralDogmaStep !== 'none' && (
                <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-400/20">
                  <h4 className="text-sm font-medium text-cyan-300 mb-2">
                    Central Dogma: {data.centralDogmaStep === 'transcription' ? 'DNA → RNA' : 'RNA → Protein'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {data.centralDogmaStep === 'transcription'
                      ? 'During transcription, the DNA template strand is read by RNA polymerase to produce a complementary mRNA strand. Note: In RNA, Uracil (U) replaces Thymine (T).'
                      : 'During translation, ribosomes read the mRNA codons (sets of 3 bases) and assemble amino acids into proteins.'}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Build Tab */}
          {data.buildChallenges.length > 0 && (
            <TabsContent value="build" className="space-y-4">
              <div className="p-3 bg-black/20 rounded-lg border border-white/5">
                <p className="text-sm text-slate-300">
                  Complete the complementary strand for each challenge below. Remember the base pairing rules:
                  <span className={`mx-1 font-bold ${getBaseStyle('A').text}`}>A</span>↔
                  <span className={`mx-1 font-bold ${getBaseStyle('T').text}`}>T</span> and
                  <span className={`mx-1 font-bold ${getBaseStyle('C').text}`}>C</span>↔
                  <span className={`mx-1 font-bold ${getBaseStyle('G').text}`}>G</span>
                </p>
              </div>

              <div className="space-y-4">
                {data.buildChallenges.map((challenge, i) => (
                  <BuildChallengePanel
                    key={i}
                    challenge={challenge}
                    challengeIndex={i}
                    onComplete={handleChallengeComplete}
                    completed={challengeResults.has(i)}
                  />
                ))}
              </div>

              {/* Submit / Reset */}
              {allChallengesCompleted && (
                <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-white/5">
                  <div>
                    <div className="text-sm text-slate-300">
                      Score: <span className="font-bold text-white">{correctChallenges}</span> / {data.buildChallenges.length} correct
                    </div>
                    <div className="text-xs text-slate-500">
                      {correctChallenges === data.buildChallenges.length
                        ? 'Perfect! You understand base pairing rules!'
                        : 'Keep practicing to master base pairing.'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={handleSubmitEvaluation}
                      disabled={hasSubmitted}
                      className="bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 text-cyan-300"
                    >
                      {hasSubmitted ? 'Submitted' : 'Submit'}
                    </Button>
                    {hasSubmitted && (
                      <Button
                        variant="ghost"
                        onClick={handleReset}
                        className="bg-white/5 border border-white/20 hover:bg-white/10"
                      >
                        Try Again
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* Zoom Levels Tab */}
          {data.zoomLevels.length > 0 && (
            <TabsContent value="zoom" className="space-y-4">
              {/* 3D DNA Helix with Zoom Controls */}
              <div className="w-full h-[450px] bg-slate-900 rounded-xl border border-white/5 overflow-hidden relative">
                <div className="absolute top-3 left-3 z-10">
                  <span className="text-xs text-slate-500 uppercase tracking-wider bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                    Zoom: {currentZoomLevel.replace('-', ' ')}
                  </span>
                </div>
                <DnaHelixScene
                  sequence={data.sequence}
                  structuralFeatures={data.structuralFeatures}
                  zoomLevel={currentZoomLevel as 'chromosome' | 'gene' | 'sequence' | 'base-pair' | 'molecular'}
                  mode="zoom"
                  onBaseClick={(position) => handleBaseClick(position, 'template')}
                />
                <div className="absolute bottom-3 left-3 z-10">
                  <span className="text-[10px] text-slate-500 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                    Select a zoom level below to navigate
                  </span>
                </div>
              </div>

              <ZoomLevelExplorer
                zoomLevels={data.zoomLevels}
                currentLevel={currentZoomLevel}
                onLevelChange={handleZoomLevelChange}
              />
              <div className="text-xs text-slate-500">
                Explored {exploredZoomLevels.size} of {data.zoomLevels.length} zoom levels
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DnaExplorer;
