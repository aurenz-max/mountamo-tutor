import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { AdaptationInvestigatorMetrics } from '../../../evaluation/types';
import {
  Eye,
  TreePine,
  Link2,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';

/**
 * Adaptation Investigator - Structure-Function-Environment Reasoning
 *
 * Interactive primitive for teaching why organisms have specific traits.
 * Students explore the trait, environment, and connection between them,
 * then answer "What If?" scenario questions at higher grades.
 *
 * Three-panel layout:
 * 1. "The Trait" - What the adaptation is
 * 2. "The Environment" - What pressures exist
 * 3. "The Connection" - How trait addresses the pressure
 *
 * Higher grades include "What If?" mode where students predict
 * consequences of changing the environment.
 *
 * Grade Bands: 2-4, 5-6, 7-8
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface AdaptationInfo {
  trait: string;
  type: 'structural' | 'behavioral' | 'physiological';
  description: string;
  imagePrompt: string;
}

export interface EnvironmentInfo {
  habitat: string;
  pressures: string[];
  description: string;
}

export interface ConnectionInfo {
  explanation: string;
  evidencePoints: string[];
}

export interface WhatIfScenario {
  environmentChange: string;
  question: string;
  expectedReasoning: string;
  adaptationStillUseful: boolean;
}

export interface MisconceptionInfo {
  commonBelief: string;
  correction: string;
}

export interface AdaptationInvestigatorData {
  organism: string;
  adaptation: AdaptationInfo;
  environment: EnvironmentInfo;
  connection: ConnectionInfo;
  whatIfScenarios: WhatIfScenario[];
  misconception: MisconceptionInfo;
  gradeBand: '2-4' | '5-6' | '7-8';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AdaptationInvestigatorMetrics>) => void;
}

interface AdaptationInvestigatorProps {
  data: AdaptationInvestigatorData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ADAPTATION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  structural: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  behavioral: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  physiological: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
};

const GRADE_LABELS: Record<string, string> = {
  '2-4': 'Grades 2-4',
  '5-6': 'Grades 5-6',
  '7-8': 'Grades 7-8',
};

type Phase = 'explore' | 'practice' | 'apply';

interface WhatIfResponse {
  scenarioIndex: number;
  studentAnswer: boolean | null;
  isCorrect: boolean | null;
  revealed: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

const AdaptationInvestigator: React.FC<AdaptationInvestigatorProps> = ({ data, className = '' }) => {
  // Defensive check
  if (!data || !data.organism || !data.adaptation || !data.environment || !data.connection) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The adaptation investigator received invalid data. Please regenerate the content.
        </p>
      </div>
    );
  }

  const [currentPhase, setCurrentPhase] = useState<Phase>('explore');
  const [exploredPanels, setExploredPanels] = useState<Set<string>>(new Set());
  const [whatIfResponses, setWhatIfResponses] = useState<WhatIfResponse[]>(
    (data.whatIfScenarios || []).map((_, i) => ({
      scenarioIndex: i,
      studentAnswer: null,
      isCorrect: null,
      revealed: false,
    }))
  );
  const [showMisconception, setShowMisconception] = useState(false);
  const [organismImage, setOrganismImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const typeColors = ADAPTATION_TYPE_COLORS[data.adaptation.type] || ADAPTATION_TYPE_COLORS.structural;
  const hasWhatIfScenarios = data.whatIfScenarios && data.whatIfScenarios.length > 0;
  const isHigherGrade = data.gradeBand === '5-6' || data.gradeBand === '7-8';

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
  } = usePrimitiveEvaluation<AdaptationInvestigatorMetrics>({
    primitiveType: 'adaptation-investigator',
    instanceId: instanceId || `adaptation-investigator-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as any,
  });

  // ============================================================================
  // Image Generation
  // ============================================================================

  const handleGenerateImage = async () => {
    if (imageLoading || organismImage) return;
    setImageLoading(true);
    setImageError(false);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: data.adaptation.imagePrompt,
          },
        }),
      });

      if (!response.ok) throw new Error('Image generation failed');

      const result = await response.json();
      if (result.imageUrl) {
        setOrganismImage(result.imageUrl);
      } else {
        setImageError(true);
      }
    } catch {
      setImageError(true);
    } finally {
      setImageLoading(false);
    }
  };

  // ============================================================================
  // Phase Management
  // ============================================================================

  const markPanelExplored = (panel: string) => {
    setExploredPanels(prev => {
      const next = new Set(prev);
      next.add(panel);
      return next;
    });
  };

  const allPanelsExplored = exploredPanels.has('trait') && exploredPanels.has('environment') && exploredPanels.has('connection');

  const handleAdvanceToPractice = () => {
    setCurrentPhase('practice');
  };

  const handleAdvanceToApply = () => {
    setCurrentPhase('apply');
  };

  // ============================================================================
  // What If? Scenario Handling
  // ============================================================================

  const handleWhatIfAnswer = (scenarioIndex: number, answer: boolean) => {
    if (hasSubmitted) return;

    setWhatIfResponses(prev =>
      prev.map((r, i) =>
        i === scenarioIndex
          ? {
              ...r,
              studentAnswer: answer,
              isCorrect: answer === data.whatIfScenarios[scenarioIndex].adaptationStillUseful,
              revealed: true,
            }
          : r
      )
    );
  };

  const allWhatIfsAnswered = whatIfResponses.every(r => r.revealed);

  // ============================================================================
  // Evaluation Submission
  // ============================================================================

  const handleSubmitEvaluation = () => {
    if (hasSubmitted) return;

    const correctCount = whatIfResponses.filter(r => r.isCorrect).length;
    const totalScenarios = whatIfResponses.length;
    const accuracy = totalScenarios > 0 ? (correctCount / totalScenarios) * 100 : 100;
    const allCorrect = correctCount === totalScenarios;

    const metrics: AdaptationInvestigatorMetrics = {
      type: 'adaptation-investigator',
      organism: data.organism,
      adaptationType: data.adaptation.type,
      gradeBand: data.gradeBand,
      panelsExplored: exploredPanels.size,
      allPanelsExplored,
      totalWhatIfScenarios: totalScenarios,
      correctWhatIfResponses: correctCount,
      whatIfAccuracy: accuracy,
      whatIfResponses: whatIfResponses.map(r => ({
        scenarioIndex: r.scenarioIndex,
        studentAnswer: r.studentAnswer,
        correctAnswer: data.whatIfScenarios[r.scenarioIndex]?.adaptationStillUseful ?? true,
        isCorrect: r.isCorrect ?? false,
      })),
      misconceptionViewed: showMisconception,
      allCorrect,
    };

    submitResult(allCorrect, accuracy, metrics, {
      studentWork: {
        exploredPanels: Array.from(exploredPanels),
        whatIfResponses,
        misconceptionViewed: showMisconception,
      },
    });
  };

  const handleReset = () => {
    setCurrentPhase('explore');
    setExploredPanels(new Set());
    setWhatIfResponses(
      (data.whatIfScenarios || []).map((_, i) => ({
        scenarioIndex: i,
        studentAnswer: null,
        isCorrect: null,
        revealed: false,
      }))
    );
    setShowMisconception(false);
    resetAttempt();
  };

  // ============================================================================
  // Render: Phase Progress Indicator
  // ============================================================================

  const renderPhaseIndicator = () => {
    const phases: { key: Phase; label: string; icon: React.ReactNode }[] = [
      { key: 'explore', label: 'Explore', icon: <Eye className="w-4 h-4" /> },
      { key: 'practice', label: 'Connect', icon: <Link2 className="w-4 h-4" /> },
    ];

    if (hasWhatIfScenarios && isHigherGrade) {
      phases.push({ key: 'apply', label: 'What If?', icon: <HelpCircle className="w-4 h-4" /> });
    }

    const phaseOrder: Phase[] = phases.map(p => p.key);
    const currentIndex = phaseOrder.indexOf(currentPhase);

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {phases.map((phase, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <div key={phase.key} className="flex items-center">
              <div
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : ''}
                  ${isCompleted ? 'bg-emerald-500/10 text-emerald-400/60' : ''}
                  ${!isActive && !isCompleted ? 'bg-slate-800/40 text-slate-500' : ''}
                `}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : phase.icon}
                <span>{phase.label}</span>
              </div>
              {index < phases.length - 1 && (
                <ArrowRight className={`w-4 h-4 mx-2 ${isCompleted ? 'text-emerald-400/60' : 'text-slate-600'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ============================================================================
  // Render: Organism Header with Image
  // ============================================================================

  const renderOrganismHeader = () => (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-slate-100 mb-1">{data.organism}</h3>
          <div className="flex items-center gap-2">
            <Badge className={`${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
              {data.adaptation.type}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              {GRADE_LABELS[data.gradeBand]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Organism Image */}
      {organismImage ? (
        <div className="relative rounded-xl overflow-hidden border border-white/10 mb-4">
          <img
            src={organismImage}
            alt={`${data.organism} - ${data.adaptation.trait}`}
            className="w-full h-auto"
            onError={() => {
              setOrganismImage(null);
              setImageError(true);
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-4">
            <p className="text-xs text-slate-400 italic">{data.adaptation.imagePrompt}</p>
          </div>
        </div>
      ) : (
        <div className="relative h-48 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/20 bg-emerald-500/5 mb-4">
          {imageLoading ? (
            <>
              <div className="w-10 h-10 border-4 border-white/10 border-t-emerald-400 rounded-full animate-spin mb-3" />
              <p className="text-sm text-emerald-400">Generating image...</p>
            </>
          ) : (
            <>
              <Sparkles className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm text-slate-400 italic text-center px-8 mb-3">{data.adaptation.imagePrompt}</p>
              {!imageError && (
                <Button
                  onClick={handleGenerateImage}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-emerald-300"
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Generate Image
                </Button>
              )}
              {imageError && (
                <p className="text-xs text-slate-500">Image generation failed. Try again later.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Render: Three-Panel Layout
  // ============================================================================

  const renderThreePanels = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Panel 1: The Trait */}
      <Card
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-blue-500/30 ${exploredPanels.has('trait') ? 'ring-1 ring-blue-500/20' : ''}`}
        onClick={() => markPanelExplored('trait')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-base text-blue-300">The Trait</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">What the adaptation is</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-slate-100 mb-1">{data.adaptation.trait}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{data.adaptation.description}</p>
          </div>
          <Badge className={`${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
            {data.adaptation.type} adaptation
          </Badge>
          {exploredPanels.has('trait') && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel 2: The Environment */}
      <Card
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-emerald-500/30 ${exploredPanels.has('environment') ? 'ring-1 ring-emerald-500/20' : ''}`}
        onClick={() => markPanelExplored('environment')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <TreePine className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base text-emerald-300">The Environment</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">What pressures exist</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">{data.environment.habitat}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{data.environment.description}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pressures</p>
            {data.environment.pressures.map((pressure, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-300">{pressure}</span>
              </div>
            ))}
          </div>
          {exploredPanels.has('environment') && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel 3: The Connection */}
      <Card
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-amber-500/30 ${exploredPanels.has('connection') ? 'ring-1 ring-amber-500/20' : ''}`}
        onClick={() => markPanelExplored('connection')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-base text-amber-300">The Connection</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">How trait addresses the pressure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">{data.connection.explanation}</p>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence</p>
            {data.connection.evidencePoints.map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <Lightbulb className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-300">{point}</span>
              </div>
            ))}
          </div>
          {exploredPanels.has('connection') && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // Render: Misconception Section
  // ============================================================================

  const renderMisconception = () => {
    if (!data.misconception) return null;

    return (
      <Accordion type="single" collapsible className="mb-6">
        <AccordionItem value="misconception" className="border-white/10">
          <AccordionTrigger
            className="text-slate-300 hover:text-slate-100 hover:no-underline"
            onClick={() => setShowMisconception(true)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span>Common Misconception</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm font-medium text-orange-300 mb-2">
                Many people think: &ldquo;{data.misconception.commonBelief}&rdquo;
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-emerald-300">Actually:</span>{' '}
                {data.misconception.correction}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  // ============================================================================
  // Render: What If? Scenarios
  // ============================================================================

  const renderWhatIfScenarios = () => {
    if (!hasWhatIfScenarios) return null;

    return (
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-slate-100">What If...?</CardTitle>
          </div>
          <CardDescription className="text-slate-400">
            Predict what would happen if the environment changed. Would the adaptation still be useful?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.whatIfScenarios.map((scenario, index) => {
            const response = whatIfResponses[index];

            return (
              <div
                key={index}
                className={`p-4 rounded-lg border transition-all ${
                  response?.revealed
                    ? response.isCorrect
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                    : 'bg-slate-800/40 border-slate-700/50'
                }`}
              >
                {/* Scenario description */}
                <p className="text-sm text-purple-300 font-medium mb-2">
                  Imagine: {scenario.environmentChange}
                </p>
                <p className="text-sm text-slate-200 mb-3">{scenario.question}</p>

                {/* Answer buttons */}
                {!response?.revealed && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleWhatIfAnswer(index, true)}
                      disabled={hasSubmitted}
                      variant="ghost"
                      className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Still Useful
                    </Button>
                    <Button
                      onClick={() => handleWhatIfAnswer(index, false)}
                      disabled={hasSubmitted}
                      variant="ghost"
                      className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Not Useful
                    </Button>
                  </div>
                )}

                {/* Feedback */}
                {response?.revealed && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {response.isCorrect ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-300">Correct!</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          <span className="text-sm font-medium text-red-300">Not quite.</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {scenario.expectedReasoning}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // Render: Phase-specific Instructions
  // ============================================================================

  const renderPhaseInstructions = () => {
    if (currentPhase === 'explore') {
      return (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
          <p className="text-sm text-blue-300">
            <span className="font-semibold">Step 1: Explore</span> &mdash; Click each panel to learn about the trait, the environment, and how they connect.
            {!allPanelsExplored && ' Explore all three panels to continue.'}
          </p>
        </div>
      );
    }

    if (currentPhase === 'practice') {
      return (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-6">
          <p className="text-sm text-emerald-300">
            <span className="font-semibold">Step 2: Connect</span> &mdash; Review how the trait helps the organism survive in its environment. Check the misconception section to deepen your understanding.
          </p>
        </div>
      );
    }

    if (currentPhase === 'apply') {
      return (
        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-6">
          <p className="text-sm text-purple-300">
            <span className="font-semibold">Step 3: What If?</span> &mdash; For each scenario, predict whether the adaptation would still be useful if the environment changed.
          </p>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Render: Action Buttons
  // ============================================================================

  const renderActions = () => {
    if (currentPhase === 'explore') {
      return (
        <div className="flex justify-center mb-6">
          <Button
            onClick={handleAdvanceToPractice}
            disabled={!allPanelsExplored}
            variant="ghost"
            className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 px-6"
          >
            Continue to Connect <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      );
    }

    if (currentPhase === 'practice') {
      if (hasWhatIfScenarios && isHigherGrade) {
        return (
          <div className="flex justify-center mb-6">
            <Button
              onClick={handleAdvanceToApply}
              variant="ghost"
              className="bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 px-6"
            >
              Try &ldquo;What If?&rdquo; Scenarios <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );
      }
      // No What If? for lower grades - just show completion
      return null;
    }

    if (currentPhase === 'apply') {
      return (
        <div className="flex justify-center gap-3 mb-6">
          {!hasSubmitted && allWhatIfsAnswered && (
            <Button
              onClick={handleSubmitEvaluation}
              variant="ghost"
              className="bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 px-6"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Submit Answers
            </Button>
          )}
          {hasSubmitted && (
            <Button
              onClick={handleReset}
              variant="ghost"
              className="bg-slate-700 text-slate-300 hover:bg-slate-600"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Render: Success Summary
  // ============================================================================

  const renderSuccessSummary = () => {
    if (!hasSubmitted) return null;

    const correctCount = whatIfResponses.filter(r => r.isCorrect).length;
    const total = whatIfResponses.length;

    return (
      <Card className="backdrop-blur-xl bg-emerald-500/10 border-emerald-500/30 shadow-2xl mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <div>
              <h4 className="text-lg font-semibold text-emerald-300">Investigation Complete!</h4>
              <p className="text-sm text-slate-300">
                You correctly predicted {correctCount} of {total} &ldquo;What If?&rdquo; scenarios for the{' '}
                {data.organism}&apos;s {data.adaptation.trait.toLowerCase()}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className={`relative ${className}`}>
      {renderOrganismHeader()}
      {renderPhaseIndicator()}
      {renderPhaseInstructions()}
      {renderThreePanels()}
      {(currentPhase === 'practice' || currentPhase === 'apply') && renderMisconception()}
      {currentPhase === 'apply' && renderWhatIfScenarios()}
      {renderActions()}
      {renderSuccessSummary()}
    </div>
  );
};

export default AdaptationInvestigator;
