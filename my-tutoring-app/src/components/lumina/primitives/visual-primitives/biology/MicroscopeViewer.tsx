import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { MicroscopeViewerMetrics } from '../../../evaluation/types';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Tag,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-react';

/**
 * Microscope Viewer - Simulated Microscope Experience
 *
 * Interactive primitive for teaching observation at scale, structure
 * identification, and spatial reasoning. Students examine specimens at
 * increasing magnification and identify/label structures.
 *
 * FEATURES:
 * - Circular "lens" viewport with zoom levels (40x, 100x, 400x)
 * - Structure labeling tasks at each zoom level
 * - Guided observation prompts in a side panel
 * - AI-generated images per zoom level
 * - Evaluation support for labeling accuracy + observation responses
 * - Grade-appropriate scaling (3-8)
 *
 * Perfect for: cell biology, tissue types, microorganisms, plant anatomy,
 * mineral structures, comparing cell types.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface VisibleStructure {
  id: string;
  name: string;
  description: string;
  labelPosition: { x: number; y: number };
  function: string;
}

export interface ZoomLevel {
  magnification: string;
  imagePrompt: string;
  visibleStructures: VisibleStructure[];
  observationPrompt: string;
}

export interface MicroscopeViewerData {
  specimen: {
    name: string;
    type: string;
    prepMethod: string | null;
  };
  zoomLevels: ZoomLevel[];
  comparisonNote: string | null;
  gradeBand: '3-5' | '6-8';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MicroscopeViewerMetrics>) => void;
}

interface MicroscopeViewerProps {
  data: MicroscopeViewerData;
  className?: string;
}

interface LabelAttempt {
  structureId: string;
  studentLabel: string;
  correctLabel: string;
  isCorrect: boolean;
}

interface ObservationResponse {
  zoomLevel: string;
  prompt: string;
  studentResponse: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAGNIFICATION_COLORS: Record<string, { primary: string; secondary: string; rgb: string }> = {
  low: { primary: '#10b981', secondary: '#34d399', rgb: '16, 185, 129' },
  medium: { primary: '#3b82f6', secondary: '#60a5fa', rgb: '59, 130, 246' },
  high: { primary: '#a855f7', secondary: '#c084fc', rgb: '168, 85, 247' },
};

function getMagLevel(index: number): string {
  if (index === 0) return 'low';
  if (index === 1) return 'medium';
  return 'high';
}

// ============================================================================
// Main Component
// ============================================================================

const MicroscopeViewer: React.FC<MicroscopeViewerProps> = ({ data, className = '' }) => {
  // Defensive check
  if (!data || !data.zoomLevels || !Array.isArray(data.zoomLevels) || data.zoomLevels.length === 0) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The microscope viewer received invalid data. Please regenerate the content.
        </p>
      </div>
    );
  }

  const [currentZoomIndex, setCurrentZoomIndex] = useState(0);
  const [labelingMode, setLabelingMode] = useState(false);
  const [selectedStructure, setSelectedStructure] = useState<string | null>(null);
  const [studentLabel, setStudentLabel] = useState('');
  const [labelAttempts, setLabelAttempts] = useState<LabelAttempt[]>([]);
  const [observationResponses, setObservationResponses] = useState<ObservationResponse[]>([]);
  const [currentObservation, setCurrentObservation] = useState('');
  const [revealedLabels, setRevealedLabels] = useState<Set<string>>(new Set());

  // Per-zoom image generation state
  const [zoomImages, setZoomImages] = useState<Record<number, string>>({});
  const [loadingZoomIndex, setLoadingZoomIndex] = useState<number | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const lensRef = useRef<HTMLDivElement>(null);

  const currentZoom = data.zoomLevels[currentZoomIndex];
  const magLevel = getMagLevel(currentZoomIndex);
  const colors = MAGNIFICATION_COLORS[magLevel];

  // Evaluation
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
  } = usePrimitiveEvaluation<MicroscopeViewerMetrics>({
    primitiveType: 'microscope-viewer',
    instanceId: instanceId || `microscope-viewer-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  // ============================================================================
  // Image Generation
  // ============================================================================

  const handleGenerateImage = async (zoomIdx: number) => {
    if (loadingZoomIndex !== null || zoomImages[zoomIdx]) return;

    setLoadingZoomIndex(zoomIdx);
    setImageErrors(prev => ({ ...prev, [zoomIdx]: false }));

    try {
      const zoom = data.zoomLevels[zoomIdx];
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: `Microscope view of ${data.specimen.name} (${data.specimen.type}) at ${zoom.magnification} magnification${data.specimen.prepMethod ? `, ${data.specimen.prepMethod} preparation` : ''}: ${zoom.imagePrompt}. Scientific illustration style, clean white background around specimen, viewed through circular microscope lens.`,
          }
        })
      });

      if (!response.ok) throw new Error('Image generation failed');

      const result = await response.json();
      if (result.imageUrl) {
        setZoomImages(prev => ({ ...prev, [zoomIdx]: result.imageUrl }));
      } else {
        setImageErrors(prev => ({ ...prev, [zoomIdx]: true }));
      }
    } catch (error) {
      console.error('Failed to generate microscope image:', error);
      setImageErrors(prev => ({ ...prev, [zoomIdx]: true }));
    } finally {
      setLoadingZoomIndex(null);
    }
  };

  // ============================================================================
  // Zoom Controls
  // ============================================================================

  const handleZoomChange = (index: number) => {
    if (index >= 0 && index < data.zoomLevels.length) {
      setCurrentZoomIndex(index);
      setSelectedStructure(null);
      setStudentLabel('');
      setLabelingMode(false);
    }
  };

  // ============================================================================
  // Labeling
  // ============================================================================

  const handleStructureClick = (structureId: string) => {
    if (!labelingMode || hasSubmitted) return;
    setSelectedStructure(structureId);
    setStudentLabel('');
  };

  const handleLabelSubmit = () => {
    if (!selectedStructure || !studentLabel.trim()) return;

    const structure = currentZoom.visibleStructures.find(s => s.id === selectedStructure);
    if (!structure) return;

    const isCorrect = studentLabel.trim().toLowerCase() === structure.name.toLowerCase();

    const attempt: LabelAttempt = {
      structureId: selectedStructure,
      studentLabel: studentLabel.trim(),
      correctLabel: structure.name,
      isCorrect,
    };

    setLabelAttempts(prev => [...prev, attempt]);

    if (isCorrect) {
      setRevealedLabels(prev => new Set(prev).add(selectedStructure));
    }

    setSelectedStructure(null);
    setStudentLabel('');
  };

  // ============================================================================
  // Observation Responses
  // ============================================================================

  const handleObservationSubmit = () => {
    if (!currentObservation.trim()) return;

    const response: ObservationResponse = {
      zoomLevel: currentZoom.magnification,
      prompt: currentZoom.observationPrompt,
      studentResponse: currentObservation.trim(),
    };

    setObservationResponses(prev => [...prev, response]);
    setCurrentObservation('');
  };

  const hasObservationForCurrentZoom = observationResponses.some(
    r => r.zoomLevel === currentZoom.magnification
  );

  // ============================================================================
  // Evaluation
  // ============================================================================

  const handleSubmitEvaluation = () => {
    if (hasSubmitted) return;

    const totalStructures = data.zoomLevels.reduce(
      (sum, z) => sum + z.visibleStructures.length, 0
    );
    const correctLabels = labelAttempts.filter(a => a.isCorrect).length;
    const uniqueCorrect = new Set(
      labelAttempts.filter(a => a.isCorrect).map(a => a.structureId)
    ).size;
    const labelAccuracy = labelAttempts.length > 0
      ? (correctLabels / labelAttempts.length) * 100
      : 0;
    const coverageScore = totalStructures > 0
      ? (uniqueCorrect / totalStructures) * 100
      : 0;
    const observationsCoverage = data.zoomLevels.length > 0
      ? (observationResponses.length / data.zoomLevels.length) * 100
      : 0;

    // Weighted score: 60% labeling accuracy, 20% coverage, 20% observations
    const score = Math.round(
      labelAccuracy * 0.6 + coverageScore * 0.2 + observationsCoverage * 0.2
    );
    const success = score >= 60;

    const metrics: MicroscopeViewerMetrics = {
      type: 'microscope-viewer',
      specimenName: data.specimen.name,
      specimenType: data.specimen.type,
      totalZoomLevels: data.zoomLevels.length,
      zoomLevelsExplored: new Set(
        observationResponses.map(r => r.zoomLevel)
      ).size,
      totalStructures,
      correctlyLabeled: uniqueCorrect,
      labelingAttempts: labelAttempts,
      labelAccuracy,
      observationResponses,
      observationsSubmitted: observationResponses.length,
    };

    submitResult(success, score, metrics, {
      studentWork: {
        labelAttempts,
        observationResponses,
      },
    });
  };

  const handleReset = () => {
    setCurrentZoomIndex(0);
    setLabelingMode(false);
    setSelectedStructure(null);
    setStudentLabel('');
    setLabelAttempts([]);
    setObservationResponses([]);
    setCurrentObservation('');
    setRevealedLabels(new Set());
    resetAttempt();
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderZoomSelector = () => (
    <div className="flex items-center gap-3 mb-6">
      <Button
        onClick={() => handleZoomChange(currentZoomIndex - 1)}
        disabled={currentZoomIndex === 0 || hasSubmitted}
        variant="ghost"
        className="bg-white/5 border border-white/20 hover:bg-white/10"
        size="sm"
      >
        <ZoomOut className="w-4 h-4" />
      </Button>

      <div className="flex-1 flex items-center gap-2">
        {data.zoomLevels.map((zoom, index) => {
          const isCurrent = index === currentZoomIndex;
          const ml = getMagLevel(index);
          const c = MAGNIFICATION_COLORS[ml];

          return (
            <button
              key={index}
              onClick={() => handleZoomChange(index)}
              disabled={hasSubmitted}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all
                ${isCurrent
                  ? 'ring-2 ring-offset-2 ring-offset-slate-950 text-white scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
                ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'}
              `}
              style={{
                backgroundColor: isCurrent ? c.primary : 'rgba(148, 163, 184, 0.1)',
                ...(isCurrent ? { ringColor: c.primary } : {}),
              }}
            >
              {zoom.magnification}
            </button>
          );
        })}
      </div>

      <Button
        onClick={() => handleZoomChange(currentZoomIndex + 1)}
        disabled={currentZoomIndex === data.zoomLevels.length - 1 || hasSubmitted}
        variant="ghost"
        className="bg-white/5 border border-white/20 hover:bg-white/10"
        size="sm"
      >
        <ZoomIn className="w-4 h-4" />
      </Button>
    </div>
  );

  const renderLensViewport = () => {
    const generatedUrl = zoomImages[currentZoomIndex];
    const isLoading = loadingZoomIndex === currentZoomIndex;
    const hasError = imageErrors[currentZoomIndex];

    return (
      <div className="relative flex justify-center mb-6">
        {/* Circular lens */}
        <div
          ref={lensRef}
          className="relative w-80 h-80 md:w-96 md:h-96 rounded-full overflow-hidden border-4 shadow-2xl"
          style={{
            borderColor: colors.primary,
            boxShadow: `0 0 40px rgba(${colors.rgb}, 0.3), inset 0 0 60px rgba(0,0,0,0.3)`,
          }}
        >
          {/* Image or placeholder */}
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
              <div
                className="w-10 h-10 border-4 border-white/10 border-t-current rounded-full animate-spin mb-3"
                style={{ color: colors.primary }}
              />
              <p className="text-xs text-slate-400">Generating view...</p>
            </div>
          ) : generatedUrl ? (
            <img
              src={generatedUrl}
              alt={`${data.specimen.name} at ${currentZoom.magnification}`}
              className="w-full h-full object-cover"
              onError={() => {
                setZoomImages(prev => {
                  const next = { ...prev };
                  delete next[currentZoomIndex];
                  return next;
                });
                setImageErrors(prev => ({ ...prev, [currentZoomIndex]: true }));
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-radial from-slate-800 to-slate-900">
              <Sparkles className="w-10 h-10 mb-3" style={{ color: colors.primary }} />
              <p className="text-xs text-slate-400 text-center px-8 mb-3 italic">
                {currentZoom.imagePrompt}
              </p>
              {!hasError && (
                <Button
                  onClick={() => handleGenerateImage(currentZoomIndex)}
                  disabled={loadingZoomIndex !== null}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs"
                  size="sm"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Generate View
                </Button>
              )}
              {hasError && (
                <p className="text-xs text-red-400">Generation failed</p>
              )}
            </div>
          )}

          {/* Structure hotspots */}
          {currentZoom.visibleStructures.map(structure => {
            const isRevealed = revealedLabels.has(structure.id);
            const isSelected = selectedStructure === structure.id;
            const hasAttempt = labelAttempts.some(a => a.structureId === structure.id);

            return (
              <button
                key={structure.id}
                onClick={() => handleStructureClick(structure.id)}
                disabled={!labelingMode || hasSubmitted}
                className={`
                  absolute w-6 h-6 rounded-full border-2 transition-all
                  transform -translate-x-1/2 -translate-y-1/2
                  ${labelingMode && !hasSubmitted ? 'cursor-pointer hover:scale-125' : 'cursor-default'}
                  ${isSelected ? 'scale-125 ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''}
                  ${isRevealed ? 'bg-green-500/80 border-green-400' : hasAttempt ? 'bg-red-500/50 border-red-400' : 'bg-white/30 border-white/60'}
                `}
                style={{
                  left: `${structure.labelPosition.x}%`,
                  top: `${structure.labelPosition.y}%`,
                }}
                title={isRevealed ? structure.name : labelingMode ? 'Click to label' : ''}
              >
                {isRevealed && (
                  <CheckCircle2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                )}
              </button>
            );
          })}

          {/* Revealed labels */}
          {currentZoom.visibleStructures.map(structure => {
            if (!revealedLabels.has(structure.id)) return null;

            return (
              <div
                key={`label-${structure.id}`}
                className="absolute px-2 py-0.5 rounded bg-green-500/90 text-white text-xs font-medium whitespace-nowrap pointer-events-none"
                style={{
                  left: `${Math.min(85, structure.labelPosition.x + 4)}%`,
                  top: `${structure.labelPosition.y}%`,
                  transform: 'translateY(-50%)',
                }}
              >
                {structure.name}
              </div>
            );
          })}
        </div>

        {/* Magnification badge */}
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-sm font-bold text-white shadow-lg"
          style={{ backgroundColor: colors.primary }}
        >
          {currentZoom.magnification}
        </div>
      </div>
    );
  };

  const renderLabelingPanel = () => {
    if (!labelingMode) return null;

    const selectedStruct = selectedStructure
      ? currentZoom.visibleStructures.find(s => s.id === selectedStructure)
      : null;

    return (
      <Card className="backdrop-blur-xl bg-yellow-500/10 border-yellow-500/30 shadow-2xl mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-yellow-300">Label Mode</span>
            <span className="text-xs text-slate-400 ml-auto">
              Click a structure dot, then type its name
            </span>
          </div>

          {selectedStruct && (
            <div className="flex gap-2">
              <input
                type="text"
                value={studentLabel}
                onChange={e => setStudentLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleLabelSubmit(); }}
                placeholder={`What is this structure?`}
                disabled={hasSubmitted}
                className="flex-1 bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <Button
                onClick={handleLabelSubmit}
                disabled={!studentLabel.trim() || hasSubmitted}
                variant="ghost"
                className="bg-yellow-500/20 border border-yellow-500/40 hover:bg-yellow-500/30 text-yellow-300"
                size="sm"
              >
                Check
              </Button>
            </div>
          )}

          {/* Recent label attempts */}
          {labelAttempts.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {labelAttempts.slice(-5).reverse().map((attempt, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-xs p-2 rounded ${
                    attempt.isCorrect
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {attempt.isCorrect ? (
                    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3 h-3 flex-shrink-0" />
                  )}
                  <span>
                    "{attempt.studentLabel}" {attempt.isCorrect ? '= correct!' : `(correct: ${attempt.correctLabel})`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderObservationPanel = () => (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl mb-4">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" style={{ color: colors.primary }} />
          <span className="text-sm font-semibold text-slate-200">Observation Prompt</span>
        </div>

        <p className="text-slate-300 text-sm italic">
          "{currentZoom.observationPrompt}"
        </p>

        {!hasObservationForCurrentZoom && !hasSubmitted && (
          <div className="flex gap-2">
            <input
              type="text"
              value={currentObservation}
              onChange={e => setCurrentObservation(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleObservationSubmit(); }}
              placeholder="Type your observation..."
              className="flex-1 bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:ring-2"
              style={{ '--tw-ring-color': colors.primary } as React.CSSProperties}
            />
            <Button
              onClick={handleObservationSubmit}
              disabled={!currentObservation.trim()}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10"
              size="sm"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
          </div>
        )}

        {hasObservationForCurrentZoom && (
          <div className="p-2 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400 flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3" />
            Observation recorded for {currentZoom.magnification}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-slate-100 mb-1 flex items-center gap-2">
              <Search className="w-6 h-6" style={{ color: colors.primary }} />
              {data.specimen.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
                {data.specimen.type}
              </Badge>
              {data.specimen.prepMethod && (
                <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400">
                  {data.specimen.prepMethod}
                </Badge>
              )}
              <Badge
                className="border-slate-700/50"
                style={{
                  backgroundColor: `rgba(${colors.rgb}, 0.2)`,
                  color: colors.primary,
                }}
              >
                {data.gradeBand === '3-5' ? 'Grades 3-5' : 'Grades 6-8'}
              </Badge>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2 ml-4">
            <Button
              onClick={() => setLabelingMode(!labelingMode)}
              disabled={hasSubmitted}
              variant="ghost"
              className={`border text-sm ${
                labelingMode
                  ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                  : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-300'
              }`}
              size="sm"
            >
              <Tag className="w-4 h-4 mr-1" />
              {labelingMode ? 'Labeling On' : 'Label'}
            </Button>
          </div>
        </div>
      </div>

      {/* Zoom Selector */}
      {renderZoomSelector()}

      {/* Main viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lens - takes 2 columns */}
        <div className="lg:col-span-2">
          {renderLensViewport()}
          {renderLabelingPanel()}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Observation panel */}
          {renderObservationPanel()}

          {/* Structures at this zoom level */}
          <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
                <ZoomIn className="w-4 h-4" style={{ color: colors.primary }} />
                Structures at {currentZoom.magnification}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {currentZoom.visibleStructures.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No structures labeled at this magnification.</p>
              ) : (
                <Accordion type="single" collapsible>
                  {currentZoom.visibleStructures.map(structure => {
                    const isRevealed = revealedLabels.has(structure.id);

                    return (
                      <AccordionItem
                        key={structure.id}
                        value={structure.id}
                        className="border-white/10"
                      >
                        <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline py-2 text-sm">
                          <span className="flex items-center gap-2">
                            {isRevealed ? (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            ) : (
                              <span className="w-3 h-3 rounded-full border border-slate-600" />
                            )}
                            {isRevealed ? structure.name : '???'}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-xs space-y-1 text-slate-400 pt-1">
                          {isRevealed ? (
                            <>
                              <p>{structure.description}</p>
                              <p className="text-slate-500">
                                <span className="font-medium text-slate-400">Function:</span> {structure.function}
                              </p>
                            </>
                          ) : (
                            <p className="italic">Label this structure correctly to reveal details.</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Observation log */}
          {observationResponses.length > 0 && (
            <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">Observation Log</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                {observationResponses.map((obs, i) => (
                  <div key={i} className="p-2 bg-slate-800/40 rounded text-xs">
                    <span className="font-medium" style={{ color: colors.primary }}>
                      {obs.zoomLevel}
                    </span>
                    <p className="text-slate-300 mt-0.5">{obs.studentResponse}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Comparison Note */}
      {data.comparisonNote && (
        <div className="mt-6 p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg">
          <p className="text-sm text-slate-400 italic">
            <span className="font-medium text-slate-300">Note: </span>
            {data.comparisonNote}
          </p>
        </div>
      )}

      {/* Submit / Reset controls */}
      <div className="mt-6 flex gap-3">
        {!hasSubmitted ? (
          <Button
            onClick={handleSubmitEvaluation}
            disabled={labelAttempts.length === 0 && observationResponses.length === 0}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
          >
            Submit Observations
          </Button>
        ) : (
          <>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Evaluation submitted</span>
            </div>
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default MicroscopeViewer;
