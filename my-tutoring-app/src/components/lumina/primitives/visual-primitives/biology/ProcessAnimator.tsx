import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { ProcessAnimatorMetrics } from '../../../evaluation/types';
import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, CheckCircle2, XCircle, RotateCcw, Sparkles, ArrowRight, Zap, Image as ImageIcon } from 'lucide-react';

/**
 * Process Animator - Step-Through Biological Process Visualization
 *
 * Interactive primitive for teaching multi-step biological processes through
 * narrated animations with checkpoint questions. Students control playback
 * and demonstrate comprehension at key moments.
 *
 * FEATURES:
 * - Step-by-step animation control (play, pause, step forward/back)
 * - Narrated stages with visual descriptions
 * - Checkpoint questions embedded at key moments
 * - Progress tracking with stage indicator bar
 * - Evaluation support for checkpoint responses
 * - Grade-appropriate scaling (2-8)
 * - Per-stage AI image generation from visualDescription
 *
 * Perfect for: photosynthesis, cellular respiration, digestion, blood flow,
 * pollination, germination, nutrient absorption, protein synthesis, etc.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProcessStage {
  id: string;
  order: number;
  title: string;
  narration: string;
  visualDescription: string;
  keyMolecules: string[] | null;
  energyChange: string | null;
  duration: string | null;
}

export interface CheckpointQuestion {
  afterStageId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ProcessAnimatorData {
  processName: string;
  overview: string;
  stages: ProcessStage[];
  checkpoints: CheckpointQuestion[];
  inputs: string[];
  outputs: string[];
  equation: string | null;
  scale: 'molecular' | 'cellular' | 'organ' | 'organism' | 'ecosystem';
  gradeBand: '2-4' | '5-6' | '7-8';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ProcessAnimatorMetrics>) => void;
}

interface ProcessAnimatorProps {
  data: ProcessAnimatorData;
  className?: string;
}

interface CheckpointResponse {
  checkpointIndex: number;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  timeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const SCALE_COLORS: Record<string, { primary: string; secondary: string; rgb: string }> = {
  molecular: { primary: '#a855f7', secondary: '#c084fc', rgb: '168, 85, 247' },
  cellular: { primary: '#10b981', secondary: '#34d399', rgb: '16, 185, 129' },
  organ: { primary: '#3b82f6', secondary: '#60a5fa', rgb: '59, 130, 246' },
  organism: { primary: '#f59e0b', secondary: '#fbbf24', rgb: '245, 158, 11' },
  ecosystem: { primary: '#14b8a6', secondary: '#2dd4bf', rgb: '20, 184, 166' },
};

const GRADE_LABELS: Record<string, string> = {
  '2-4': 'Grades 2-4',
  '5-6': 'Grades 5-6',
  '7-8': 'Grades 7-8',
};

// ============================================================================
// Main Component
// ============================================================================

const ProcessAnimator: React.FC<ProcessAnimatorProps> = ({ data, className = '' }) => {
  // Defensive check for invalid data
  if (!data || !data.stages || !Array.isArray(data.stages) || data.stages.length === 0) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The process animator received invalid data. Please regenerate the content.
        </p>
        <details className="mt-4 text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-300">Debug Info</summary>
          <pre className="mt-2 p-2 bg-slate-900/50 rounded overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  const [startTime] = useState(Date.now());
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeCheckpoint, setActiveCheckpoint] = useState<number | null>(null);
  const [checkpointResponses, setCheckpointResponses] = useState<CheckpointResponse[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [completedFullAnimation, setCompletedFullAnimation] = useState(false);

  // Per-stage image generation state
  const [stageImages, setStageImages] = useState<Record<string, string>>({});
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const colors = SCALE_COLORS[data.scale] || SCALE_COLORS.cellular;
  const sortedStages = [...data.stages].sort((a, b) => a.order - b.order);
  const currentStage = sortedStages[currentStageIndex];

  // Evaluation hook
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
  } = usePrimitiveEvaluation<ProcessAnimatorMetrics>({
    primitiveType: 'bio-process-animator',
    instanceId: instanceId || `process-animator-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  // ============================================================================
  // Image Generation
  // ============================================================================

  const handleGenerateImage = async (stage: ProcessStage) => {
    if (!stage.visualDescription || loadingStageId || stageImages[stage.id]) return;

    setLoadingStageId(stage.id);
    setImageErrors(prev => ({ ...prev, [stage.id]: false }));

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: `${data.processName} - ${stage.title}: ${stage.visualDescription}`,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Image generation request failed');
      }

      const result = await response.json();
      if (result.imageUrl) {
        setStageImages(prev => ({ ...prev, [stage.id]: result.imageUrl }));
      } else {
        setImageErrors(prev => ({ ...prev, [stage.id]: true }));
      }
    } catch (error) {
      console.error('Failed to generate stage image:', error);
      setImageErrors(prev => ({ ...prev, [stage.id]: true }));
    } finally {
      setLoadingStageId(null);
    }
  };

  // ============================================================================
  // Auto-play Effect
  // ============================================================================

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      handleNext();
    }, 3000); // Auto-advance every 3 seconds when playing

    return () => clearTimeout(timer);
  }, [isPlaying, currentStageIndex]);

  // ============================================================================
  // Checkpoint Logic
  // ============================================================================

  const checkForCheckpoint = (stageId: string) => {
    const checkpointIndex = data.checkpoints.findIndex(cp => cp.afterStageId === stageId);
    if (checkpointIndex !== -1) {
      setIsPlaying(false);
      setActiveCheckpoint(checkpointIndex);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  // ============================================================================
  // Playback Controls
  // ============================================================================

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleNext = () => {
    if (currentStageIndex < sortedStages.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      checkForCheckpoint(sortedStages[nextIndex].id);
    } else {
      // Reached the end
      setIsPlaying(false);
      if (!completedFullAnimation) {
        setCompletedFullAnimation(true);
        handleAutoSubmit();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1);
      setIsPlaying(false);
    }
  };

  const handleStepTo = (index: number) => {
    setCurrentStageIndex(index);
    setIsPlaying(false);
    checkForCheckpoint(sortedStages[index].id);
  };

  const handleRestart = () => {
    setCurrentStageIndex(0);
    setActiveCheckpoint(null);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setIsPlaying(false);
    setReplayCount(prev => prev + 1);
  };

  // ============================================================================
  // Checkpoint Question Handling
  // ============================================================================

  const handleAnswerSelect = (optionIndex: number) => {
    if (showExplanation || hasSubmitted) return;
    setSelectedAnswer(optionIndex);
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null || activeCheckpoint === null) return;

    const checkpoint = data.checkpoints[activeCheckpoint];
    const isCorrect = selectedAnswer === checkpoint.correctIndex;
    const responseTime = Date.now() - startTime;

    const response: CheckpointResponse = {
      checkpointIndex: activeCheckpoint,
      selectedIndex: selectedAnswer,
      correctIndex: checkpoint.correctIndex,
      isCorrect,
      timeMs: responseTime,
    };

    setCheckpointResponses(prev => [...prev, response]);
    setShowExplanation(true);
  };

  const handleContinue = () => {
    setActiveCheckpoint(null);
    setSelectedAnswer(null);
    setShowExplanation(false);
    handleNext();
  };

  // ============================================================================
  // Evaluation Submission
  // ============================================================================

  const handleAutoSubmit = () => {
    if (hasSubmitted) return;

    const correctResponses = checkpointResponses.filter(r => r.isCorrect).length;
    const totalCheckpoints = data.checkpoints.length;
    const allCorrect = correctResponses === totalCheckpoints;
    const score = totalCheckpoints > 0 ? (correctResponses / totalCheckpoints) * 100 : 100;

    const metrics: ProcessAnimatorMetrics = {
      type: 'bio-process-animator',
      processName: data.processName,
      scale: data.scale,
      totalStages: data.stages.length,
      totalCheckpoints: totalCheckpoints,
      checkpointResponses,
      completedFullAnimation,
      replayCount,
      allCheckpointsCorrect: allCorrect,
    };

    submitResult(allCorrect, score, metrics, {
      studentWork: {
        responses: checkpointResponses,
        completedFull: completedFullAnimation,
      },
    });
  };

  const handleReset = () => {
    setCurrentStageIndex(0);
    setIsPlaying(false);
    setActiveCheckpoint(null);
    setCheckpointResponses([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setReplayCount(0);
    setCompletedFullAnimation(false);
    resetAttempt();
  };

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderStageIndicator = () => {
    return (
      <div className="flex items-center gap-2 mb-6">
        {sortedStages.map((stage, index) => {
          const isCurrent = index === currentStageIndex;
          const isPast = index < currentStageIndex;
          const hasCheckpoint = data.checkpoints.some(cp => cp.afterStageId === stage.id);

          return (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => handleStepTo(index)}
                disabled={hasSubmitted}
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center
                  font-semibold text-sm transition-all duration-300
                  ${isCurrent
                    ? 'scale-125 ring-2 ring-offset-2 ring-offset-slate-950'
                    : 'scale-100 hover:scale-110'
                  }
                  ${hasSubmitted ? 'cursor-default' : 'cursor-pointer'}
                `}
                style={{
                  backgroundColor: isCurrent || isPast ? colors.primary : 'rgba(148, 163, 184, 0.2)',
                  color: isCurrent || isPast ? 'white' : '#64748b',
                }}
              >
                {isPast ? <CheckCircle2 className="w-5 h-5" /> : stage.order + 1}
                {hasCheckpoint && (
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 flex items-center justify-center"
                    style={{ backgroundColor: '#fbbf24' }}
                  >
                    <span className="text-xs text-slate-900">?</span>
                  </div>
                )}
              </button>
              {index < sortedStages.length - 1 && (
                <div
                  className="w-8 h-1 mx-1"
                  style={{
                    backgroundColor: isPast ? colors.primary : 'rgba(148, 163, 184, 0.2)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderCheckpointQuestion = () => {
    if (activeCheckpoint === null) return null;

    const checkpoint = data.checkpoints[activeCheckpoint];

    return (
      <Card className="backdrop-blur-xl bg-yellow-500/10 border-yellow-500/30 shadow-2xl mb-6 animate-slideIn">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <CardTitle className="text-lg text-yellow-300">Checkpoint Question</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-200 font-medium">{checkpoint.question}</p>

          <div className="space-y-2">
            {checkpoint.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrect = index === checkpoint.correctIndex;
              const showStatus = showExplanation;

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showExplanation || hasSubmitted}
                  className={`
                    w-full text-left p-4 rounded-lg border-2 transition-all duration-200
                    ${isSelected
                      ? showStatus
                        ? isCorrect
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-red-500 bg-red-500/20'
                        : 'border-yellow-500 bg-yellow-500/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'
                    }
                    ${showExplanation || hasSubmitted ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-slate-200">{option}</span>
                    {showStatus && isSelected && (
                      isCorrect
                        ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-300">{checkpoint.explanation}</p>
            </div>
          )}

          <div className="flex gap-3">
            {!showExplanation ? (
              <Button
                onClick={handleCheckAnswer}
                disabled={selectedAnswer === null || hasSubmitted}
                variant="ghost"
                className="bg-yellow-500/20 border border-yellow-500/40 hover:bg-yellow-500/30 text-yellow-300"
              >
                Check Answer
              </Button>
            ) : (
              <Button
                onClick={handleContinue}
                variant="ghost"
                className="bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 text-green-300"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStageVisual = () => {
    const stageId = currentStage.id;
    const generatedUrl = stageImages[stageId];
    const isLoading = loadingStageId === stageId;
    const hasError = imageErrors[stageId];

    // Loading state
    if (isLoading) {
      return (
        <div
          className="relative h-64 rounded-xl flex flex-col items-center justify-center border-2 mb-6"
          style={{
            backgroundColor: `rgba(${colors.rgb}, 0.05)`,
            borderColor: `rgba(${colors.rgb}, 0.2)`,
          }}
        >
          <div
            className="w-12 h-12 border-4 border-white/10 border-t-current rounded-full animate-spin mb-4"
            style={{ color: colors.primary }}
          />
          <p className="text-sm font-medium" style={{ color: colors.primary }}>
            Generating visualization...
          </p>
          <p className="text-xs text-slate-500 text-center italic max-w-md mt-2 px-8">
            "{currentStage.visualDescription}"
          </p>
        </div>
      );
    }

    // Generated image
    if (generatedUrl) {
      return (
        <div className="relative rounded-xl overflow-hidden border-2 mb-6" style={{ borderColor: `rgba(${colors.rgb}, 0.2)` }}>
          <img
            src={generatedUrl}
            alt={`${currentStage.title} - ${currentStage.visualDescription}`}
            className="w-full h-auto object-cover max-h-96"
            onError={() => {
              setStageImages(prev => {
                const next = { ...prev };
                delete next[stageId];
                return next;
              });
              setImageErrors(prev => ({ ...prev, [stageId]: true }));
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-4">
            <p className="text-xs text-slate-400 italic">{currentStage.visualDescription}</p>
          </div>
        </div>
      );
    }

    // Placeholder with generate button
    return (
      <div
        className="relative h-64 rounded-xl flex flex-col items-center justify-center border-2 border-dashed mb-6"
        style={{
          backgroundColor: `rgba(${colors.rgb}, 0.05)`,
          borderColor: `rgba(${colors.rgb}, 0.2)`,
        }}
      >
        <Sparkles className="w-12 h-12 mb-4" style={{ color: colors.primary }} />
        <p className="text-sm text-slate-400 italic text-center px-8 mb-4">{currentStage.visualDescription}</p>
        {!hasError && (
          <Button
            onClick={() => handleGenerateImage(currentStage)}
            disabled={!!loadingStageId}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
            style={{ color: colors.primary }}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            Generate Visual
          </Button>
        )}
        <p className="text-xs text-slate-500 text-center mt-3 italic">
          {hasError ? 'Image generation failed. Try again later.' : 'Click to generate an AI visualization'}
        </p>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  const progress = ((currentStageIndex + 1) / sortedStages.length) * 100;

  return (
    <div className={`relative ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-slate-100 mb-2">{data.processName}</h3>
            <p className="text-slate-400">{data.overview}</p>
          </div>
          <div className="flex gap-2 ml-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `rgba(${colors.rgb}, 0.2)`,
                color: colors.primary,
              }}
            >
              {data.scale}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300">
              {GRADE_LABELS[data.gradeBand]}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: colors.primary,
            }}
          />
        </div>
      </div>

      {/* Stage Indicator */}
      <div className="flex justify-center mb-6">
        {renderStageIndicator()}
      </div>

      {/* Checkpoint Question (if active) */}
      {renderCheckpointQuestion()}

      {/* Animation Viewport */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl mb-6">
        <CardContent className="p-8">
          {/* Stage Visual (generated image or placeholder with generate button) */}
          {renderStageVisual()}

          {/* Stage Narration */}
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-slate-100 mb-2">
              Stage {currentStage.order + 1}: {currentStage.title}
            </h4>
            <p className="text-slate-300 leading-relaxed">{currentStage.narration}</p>
          </div>

          {/* Stage Details (Accordion) */}
          <Accordion type="single" collapsible className="border-t border-slate-700/50">
            <AccordionItem value="details" className="border-white/10">
              <AccordionTrigger className="text-slate-300 hover:text-slate-100 hover:no-underline py-3">
                View Stage Details
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pt-2">
                {currentStage.keyMolecules && currentStage.keyMolecules.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Key Molecules
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {currentStage.keyMolecules.map((molecule, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `rgba(${colors.rgb}, 0.2)`,
                            color: colors.primary,
                          }}
                        >
                          {molecule}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentStage.energyChange && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Energy Change
                    </p>
                    <p className="text-sm text-slate-300">{currentStage.energyChange}</p>
                  </div>
                )}

                {currentStage.duration && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Duration
                    </p>
                    <p className="text-sm text-slate-300">{currentStage.duration}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Playback Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Button
            onClick={handlePrevious}
            disabled={currentStageIndex === 0 || hasSubmitted}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {!isPlaying ? (
            <Button
              onClick={handlePlay}
              disabled={activeCheckpoint !== null || currentStageIndex === sortedStages.length - 1 || hasSubmitted}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 px-6"
            >
              <Play className="w-5 h-5 mr-2" />
              Play
            </Button>
          ) : (
            <Button
              onClick={handlePause}
              variant="ghost"
              className="bg-white/5 border border-white/20 hover:bg-white/10 px-6"
            >
              <Pause className="w-5 h-5 mr-2" />
              Pause
            </Button>
          )}

          <Button
            onClick={handleNext}
            disabled={currentStageIndex === sortedStages.length - 1 || activeCheckpoint !== null || hasSubmitted}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          <Button
            onClick={handleRestart}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 ml-2"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex gap-2">
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Process Overview (Inputs/Outputs/Equation) */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl">
        <CardHeader>
          <CardTitle className="text-slate-100">Process Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Inputs
              </p>
              <div className="space-y-1">
                {data.inputs.map((input, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">{input}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Outputs
              </p>
              <div className="space-y-1">
                {data.outputs.map((output, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">{output}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {data.equation && (
            <div className="pt-4 border-t border-slate-700/50">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Chemical Equation
              </p>
              <p className="text-base font-mono text-slate-200 bg-slate-800/60 px-4 py-2 rounded-lg">
                {data.equation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Message */}
      {hasSubmitted && completedFullAnimation && (
        <Card className="backdrop-blur-xl bg-green-500/10 border-green-500/30 shadow-2xl mt-6 animate-slideIn">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <div>
                <h4 className="text-lg font-semibold text-green-300">Process Complete! 🎉</h4>
                <p className="text-sm text-slate-300">
                  You've completed the {data.processName.toLowerCase()} animation and answered{' '}
                  {checkpointResponses.filter(r => r.isCorrect).length} of {data.checkpoints.length} checkpoint
                  questions correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ProcessAnimator;
