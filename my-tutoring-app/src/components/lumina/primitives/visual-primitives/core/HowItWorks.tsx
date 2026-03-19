'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HowItWorksMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface HowItWorksData {
  title: string;
  subtitle: string;
  overview: string;

  steps: Array<{
    stepNumber: number;
    title: string;
    description: string;
    whatsHappening?: string;
    imagePrompt: string;
    keyTerm?: {
      term: string;
      definition: string;
    };
    funFact?: string;
  }>;

  summary: {
    text: string;
    totalTime?: string;
    keyTakeaway: string;
  };

  challenges?: Array<{
    type: 'sequence' | 'identify' | 'predict' | 'explain';
    question: string;
    // For sequence: items to reorder
    sequenceItems?: Array<{ id: string; text: string }>;
    correctOrder?: string[];
    // For identify/predict: multiple choice
    options?: string[];
    correctIndex?: number;
    // For explain: key points to mention
    keyPoints?: string[];
    explanation: string;
    relatedStep: number;
  }>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HowItWorksMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface HowItWorksProps {
  data: HowItWorksData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const HowItWorks: React.FC<HowItWorksProps> = ({ data, className }) => {
  const {
    title,
    subtitle,
    overview,
    steps = [],
    summary,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [currentStep, setCurrentStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(false);
  const [showKeyTermDef, setShowKeyTermDef] = useState<number | null>(null);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeAnswers, setChallengeAnswers] = useState<Array<{ correct: boolean; attempts: number }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false);
  const [allChallengesComplete, setAllChallengesComplete] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Sequence challenge state
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([]);
  const [sequenceChecked, setSequenceChecked] = useState(false);
  const [sequenceCorrect, setSequenceCorrect] = useState(false);

  // Explain challenge state
  const [explainText, setExplainText] = useState('');

  // Timing
  const [stepEntryTime, setStepEntryTime] = useState(Date.now());
  const [stepTimes, setStepTimes] = useState<number[]>([]);

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `how-it-works-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const totalSteps = steps.length;
  const stepsExplored = visitedSteps.size;
  const allStepsExplored = stepsExplored >= totalSteps;
  const currentStepData = steps[currentStep];

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<HowItWorksMetrics>({
    primitiveType: 'how-it-works',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    overview,
    totalSteps,
    currentStep: currentStep + 1,
    currentStepTitle: currentStepData?.title || '',
    detailExpanded: expandedDetails.has(currentStep),
    stepsExplored,
    challengesCompleted: challengeAnswers.length,
    totalChallenges: challenges.length,
  }), [title, overview, totalSteps, currentStep, currentStepData, expandedDetails, stepsExplored, challengeAnswers.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'how-it-works',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] How It Works: "${title}" — ${subtitle}. `
      + `${totalSteps} steps to explore. ${challenges.length > 0 ? `${challenges.length} comprehension challenges after.` : ''} `
      + `Overview: ${overview}. Introduce the process warmly and encourage step-by-step exploration.`,
      { silent: true }
    );
  }, [isConnected, title, subtitle, overview, totalSteps, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // Step Navigation
  // -------------------------------------------------------------------------
  const recordStepTime = useCallback(() => {
    const elapsed = Date.now() - stepEntryTime;
    setStepTimes(prev => {
      const next = [...prev];
      next[currentStep] = (next[currentStep] || 0) + elapsed;
      return next;
    });
  }, [currentStep, stepEntryTime]);

  const handleStepChange = useCallback((newStep: number) => {
    if (newStep < 0 || newStep >= totalSteps) return;

    recordStepTime();
    setStepEntryTime(Date.now());
    setCurrentStep(newStep);
    setShowKeyTermDef(null);

    setVisitedSteps(prev => {
      const next = new Set(prev);
      next.add(newStep);
      return next;
    });

    if (isConnected) {
      const stepData = steps[newStep];
      const prevStepTitle = steps[currentStep]?.title || '';
      sendText(
        `[STEP_NAVIGATION] Student moved to Step ${newStep + 1} of ${totalSteps}: "${stepData?.title}". `
        + `Previous step: "${prevStepTitle}". Steps explored: ${visitedSteps.has(newStep) ? stepsExplored : stepsExplored + 1}/${totalSteps}. `
        + `Briefly introduce this step and connect to the previous one.`,
        { silent: true }
      );
    }
  }, [totalSteps, currentStep, steps, recordStepTime, visitedSteps, stepsExplored, isConnected, sendText]);

  // Track detail expansion
  const handleDetailExpand = useCallback((stepIndex: number) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
        if (isConnected) {
          sendText(
            `[DETAIL_EXPANDED] Student opened "What's Happening?" for Step ${stepIndex + 1}: "${steps[stepIndex]?.title}". `
            + `React with enthusiasm and add a relatable comparison or context.`,
            { silent: true }
          );
        }
      }
      return next;
    });
  }, [steps, isConnected, sendText]);

  // Track all steps explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allStepsExplored && !hasNotifiedAllExploredRef.current && isConnected) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_STEPS_EXPLORED] Student explored all ${totalSteps} steps! `
        + `${challenges.length > 0 ? `${challenges.length} comprehension challenges coming up.` : 'Process complete!'} `
        + `Celebrate and summarize the full process in one sentence.`,
        { silent: true }
      );
    }
  }, [allStepsExplored, totalSteps, challenges.length, isConnected, sendText]);

  // Show summary when all steps explored
  useEffect(() => {
    if (allStepsExplored && !showSummary) {
      setShowSummary(true);
    }
  }, [allStepsExplored, showSummary]);

  // -------------------------------------------------------------------------
  // Challenge Handling
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  const handleStartChallenges = useCallback(() => {
    setShowChallenges(true);
    setCurrentChallengeIndex(0);
    setCurrentAttempts(0);
    // Initialize sequence order if first challenge is sequence type
    if (challenges[0]?.type === 'sequence' && challenges[0].sequenceItems) {
      setSequenceOrder(shuffleArray(challenges[0].sequenceItems.map(i => i.id)));
    }
  }, [challenges]);

  const handleMCAnswer = useCallback((optionIndex: number) => {
    if (!currentChallenge || showChallengeFeedback) return;
    if (currentChallenge.type !== 'identify' && currentChallenge.type !== 'predict') return;

    setSelectedOption(optionIndex);
    setShowChallengeFeedback(true);

    const correct = optionIndex === currentChallenge.correctIndex;
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Challenge ${currentChallengeIndex + 1}/${challenges.length} (${currentChallenge.type}): `
        + `"${currentChallenge.question}" — Student chose "${currentChallenge.options?.[optionIndex]}". `
        + `${correct
          ? 'Correct! Celebrate and reinforce understanding.'
          : `Incorrect. Related to Step ${currentChallenge.relatedStep}. Hint at the relevant step without giving the answer.`
        }`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentChallengeIndex, challenges, showChallengeFeedback, currentAttempts, isConnected, sendText]);

  const handleSequenceCheck = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'sequence') return;

    const correct = JSON.stringify(sequenceOrder) === JSON.stringify(currentChallenge.correctOrder);
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);
    setSequenceChecked(true);
    setSequenceCorrect(correct);

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
      setShowChallengeFeedback(true);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Sequence challenge: "${currentChallenge.question}" — `
        + `${correct ? 'Student placed all steps in the correct order!' : 'Student has the wrong order. Ask "What needs to happen BEFORE this?"'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, sequenceOrder, currentAttempts, isConnected, sendText]);

  const handleExplainSubmit = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'explain') return;

    // For explain type, we check if any key points are mentioned
    const keyPoints = currentChallenge.keyPoints || [];
    const lowerText = explainText.toLowerCase();
    const pointsHit = keyPoints.filter(kp => lowerText.includes(kp.toLowerCase())).length;
    const correct = pointsHit >= Math.ceil(keyPoints.length / 2);
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);

    setChallengeAnswers(prev => [...prev, { correct, attempts }]);
    setShowChallengeFeedback(true);

    if (isConnected) {
      sendText(
        `[EXPLAIN_SUBMITTED] Explain challenge: "${currentChallenge.question}" — `
        + `Student wrote: "${explainText}". Key points hit: ${pointsHit}/${keyPoints.length}. `
        + `${correct ? 'Good explanation! Reinforce their understanding.' : 'Partial explanation. Guide them to think about the missing key points.'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, explainText, currentAttempts, isConnected, sendText]);

  const handleNextChallenge = useCallback(() => {
    setSelectedOption(null);
    setShowChallengeFeedback(false);
    setSequenceChecked(false);
    setSequenceCorrect(false);
    setExplainText('');
    setCurrentAttempts(0);

    if (currentChallengeIndex + 1 >= challenges.length) {
      // All challenges done
      setAllChallengesComplete(true);
      recordStepTime();

      const correctCount = challengeAnswers.filter(a => a.correct).length;
      const totalAttempts = challengeAnswers.reduce((sum, a) => sum + a.attempts, 0);
      const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;

      if (isConnected) {
        sendText(
          `[ALL_COMPLETE] Student finished all ${challenges.length} challenges. `
          + `Accuracy: ${accuracy}%. Steps explored: ${stepsExplored}/${totalSteps}. `
          + `Details expanded: ${expandedDetails.size}. `
          + `Celebrate and give specific feedback on their understanding of the process.`,
          { silent: true }
        );
      }

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const avgTimePerStep = totalSteps > 0
          ? Math.round(stepTimes.reduce((a, b) => a + (b || 0), 0) / totalSteps)
          : 0;

        // Calculate type-specific accuracies
        const byType = (type: string) => {
          const relevant = challenges
            .map((c, i) => ({ ...c, answer: challengeAnswers[i] }))
            .filter(c => c.type === type && c.answer);
          if (relevant.length === 0) return 0;
          return Math.round((relevant.filter(c => c.answer?.correct).length / relevant.length) * 100);
        };

        const metrics: HowItWorksMetrics = {
          type: 'how-it-works',
          stepsExplored,
          totalSteps,
          detailsExpanded: expandedDetails.size,
          sequenceAccuracy: byType('sequence'),
          identifyAccuracy: byType('identify'),
          predictAccuracy: byType('predict'),
          challengeAttempts: totalAttempts,
          averageTimePerStep: avgTimePerStep,
        };

        const overallScore = Math.round(
          (stepsExplored / Math.max(totalSteps, 1)) * 30 + accuracy * 0.7
        );

        submitEvaluation(
          accuracy >= 70 && stepsExplored >= totalSteps,
          overallScore,
          metrics,
          { challengeAnswers: [...challengeAnswers] }
        );
      }
    } else {
      const nextIdx = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIdx);
      // Initialize sequence order if next challenge is sequence type
      if (challenges[nextIdx]?.type === 'sequence' && challenges[nextIdx].sequenceItems) {
        setSequenceOrder(shuffleArray(challenges[nextIdx].sequenceItems!.map(i => i.id)));
      }
    }
  }, [
    currentChallengeIndex, challenges, challengeAnswers, stepsExplored, totalSteps,
    expandedDetails, stepTimes, isConnected, sendText, hasSubmittedEvaluation,
    submitEvaluation, recordStepTime,
  ]);

  // Auto-submit for display-only mode (no challenges)
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (challenges.length === 0 && allStepsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      const avgTimePerStep = totalSteps > 0
        ? Math.round(stepTimes.reduce((a, b) => a + (b || 0), 0) / totalSteps)
        : 0;

      const metrics: HowItWorksMetrics = {
        type: 'how-it-works',
        stepsExplored,
        totalSteps,
        detailsExpanded: expandedDetails.size,
        sequenceAccuracy: 0,
        identifyAccuracy: 0,
        predictAccuracy: 0,
        challengeAttempts: 0,
        averageTimePerStep: avgTimePerStep,
      };

      submitEvaluation(true, 100, metrics, {});
    }
  }, [challenges.length, allStepsExplored, hasSubmittedEvaluation, stepsExplored, totalSteps, expandedDetails, stepTimes, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Render: Step Content
  // -------------------------------------------------------------------------
  const renderStep = () => {
    if (!currentStepData) return null;

    return (
      <div className="space-y-4">
        {/* Step header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-sm font-bold shrink-0">
            {currentStep + 1}
          </div>
          <h3 className="text-slate-100 text-base font-semibold">{currentStepData.title}</h3>
        </div>

        {/* Step description */}
        <p className="text-slate-300 text-sm leading-relaxed pl-11">
          {currentStepData.description}
        </p>

        {/* Key Term callout */}
        {currentStepData.keyTerm && (
          <div className="ml-11">
            <button
              onClick={() => setShowKeyTermDef(showKeyTermDef === currentStep ? null : currentStep)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-all"
            >
              <span>Key Term:</span>
              <span className="font-semibold">{currentStepData.keyTerm.term}</span>
              <span className="text-amber-400/60">{showKeyTermDef === currentStep ? '▲' : '▼'}</span>
            </button>
            {showKeyTermDef === currentStep && (
              <p className="mt-2 text-slate-400 text-xs border-l-2 border-amber-400/20 pl-3">
                {currentStepData.keyTerm.definition}
              </p>
            )}
          </div>
        )}

        {/* What's Happening? accordion */}
        {currentStepData.whatsHappening && (
          <div className="ml-11">
            <Accordion
              type="multiple"
              value={expandedDetails.has(currentStep) ? [`detail-${currentStep}`] : []}
              onValueChange={(vals) => {
                if (vals.includes(`detail-${currentStep}`)) {
                  if (!expandedDetails.has(currentStep)) handleDetailExpand(currentStep);
                } else {
                  if (expandedDetails.has(currentStep)) handleDetailExpand(currentStep);
                }
              }}
            >
              <AccordionItem value={`detail-${currentStep}`} className="border-white/10">
                <AccordionTrigger className="text-cyan-300 text-xs font-medium hover:text-cyan-200 py-2">
                  What&apos;s Happening?
                </AccordionTrigger>
                <AccordionContent className="text-slate-300 text-sm leading-relaxed pb-3">
                  {currentStepData.whatsHappening}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Fun Fact */}
        {currentStepData.funFact && (
          <div className="ml-11 p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
            <div className="flex items-start gap-2">
              <Badge className="bg-purple-500/20 border-purple-400/30 text-purple-300 text-[10px] shrink-0">
                Fun Fact
              </Badge>
              <p className="text-slate-300 text-xs leading-relaxed">{currentStepData.funFact}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Challenge {currentChallengeIndex + 1} of {challenges.length}
          </p>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
            {currentChallenge.type}
          </Badge>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>

        {/* Multiple choice (identify / predict) */}
        {(currentChallenge.type === 'identify' || currentChallenge.type === 'predict') && currentChallenge.options && (
          <div className="space-y-2">
            {currentChallenge.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrectOption = i === currentChallenge.correctIndex;
              const showAsCorrect = showChallengeFeedback && isCorrectOption;
              const showAsWrong = showChallengeFeedback && isSelected && !isCorrectOption;

              return (
                <Button
                  key={i}
                  variant="ghost"
                  className={`w-full justify-start text-left h-auto py-3 px-4 text-sm transition-all duration-200 ${
                    showAsCorrect
                      ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                      : showAsWrong
                        ? 'bg-red-500/20 border border-red-400/50 text-red-300'
                        : isSelected
                          ? 'bg-blue-500/20 border border-blue-400/50 text-blue-300'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200'
                  }`}
                  onClick={() => handleMCAnswer(i)}
                  disabled={showChallengeFeedback}
                >
                  {opt}
                </Button>
              );
            })}
          </div>
        )}

        {/* Sequence challenge */}
        {currentChallenge.type === 'sequence' && currentChallenge.sequenceItems && (
          <div className="space-y-2">
            {sequenceOrder.map((id, position) => {
              const item = currentChallenge.sequenceItems!.find(si => si.id === id);
              if (!item) return null;

              const isCorrectPosition = sequenceChecked && currentChallenge.correctOrder?.[position] === id;
              const isWrongPosition = sequenceChecked && !sequenceCorrect && currentChallenge.correctOrder?.[position] !== id;

              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                    isCorrectPosition
                      ? 'bg-emerald-500/20 border border-emerald-400/50'
                      : isWrongPosition
                        ? 'bg-red-500/20 border border-red-400/50'
                        : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <span className="text-slate-500 text-xs font-mono w-4">{position + 1}.</span>
                  <span className="text-slate-200 text-sm flex-1">{item.text}</span>
                  {!sequenceChecked && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveSequenceItem(position, -1)}
                        disabled={position === 0}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveSequenceItem(position, 1)}
                        disabled={position === sequenceOrder.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!showChallengeFeedback && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="ghost"
                  className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                  onClick={handleSequenceCheck}
                >
                  Check Order
                </Button>
              </div>
            )}
            {sequenceChecked && !sequenceCorrect && !showChallengeFeedback && (
              <p className="text-amber-400 text-xs text-center">Not quite — try rearranging and check again!</p>
            )}
          </div>
        )}

        {/* Explain challenge */}
        {currentChallenge.type === 'explain' && (
          <div className="space-y-3">
            {!showChallengeFeedback && (
              <>
                <textarea
                  value={explainText}
                  onChange={(e) => setExplainText(e.target.value)}
                  placeholder="Type your explanation here..."
                  className="w-full h-24 p-3 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm placeholder:text-slate-600 focus:outline-none focus:border-blue-400/50 resize-none"
                />
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300"
                    onClick={handleExplainSubmit}
                    disabled={explainText.trim().length < 10}
                  >
                    Submit Explanation
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Feedback */}
        {showChallengeFeedback && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${
              challengeAnswers[challengeAnswers.length - 1]?.correct ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {challengeAnswers[challengeAnswers.length - 1]?.correct ? 'Correct!' : 'Not quite, but let\'s keep going.'}
            </p>
            <p className="text-slate-400 text-xs">{currentChallenge.explanation}</p>
            <div className="flex justify-center">
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={handleNextChallenge}
              >
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Sequence reorder helper
  // -------------------------------------------------------------------------
  const moveSequenceItem = useCallback((fromIndex: number, direction: number) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= sequenceOrder.length) return;
    setSequenceOrder(prev => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
    setSequenceChecked(false);
  }, [sequenceOrder.length]);

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = challengeAnswers.filter(a => a.correct).length;
    const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">Process Mastered!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          <span>{stepsExplored}/{totalSteps} steps explored</span>
          <span>{correctCount}/{challenges.length} challenges correct</span>
          <span>{expandedDetails.size} details expanded</span>
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
        {summary && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-left">
            <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">&#9881;</span>
            <CardTitle className="text-slate-100 text-lg">How It Works: {title}</CardTitle>
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
            {totalSteps} Steps
          </Badge>
        </div>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
        <p className="text-slate-500 text-xs mt-1">{overview}</p>
      </CardHeader>

      <CardContent className="space-y-5">
        {allChallengesComplete ? (
          renderResults()
        ) : showChallenges ? (
          <div className="border-t border-white/10 pt-4">
            <p className="text-slate-300 text-xs font-medium mb-3 uppercase tracking-wider">
              Comprehension Check
            </p>
            {renderChallenge()}
          </div>
        ) : (
          <>
            {/* Step Progress Indicator */}
            <div className="flex items-center justify-center gap-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleStepChange(i)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    i === currentStep
                      ? 'bg-blue-400 scale-125 ring-2 ring-blue-400/30'
                      : visitedSteps.has(i)
                        ? 'bg-emerald-400/60 hover:bg-emerald-400/80'
                        : 'bg-white/20 hover:bg-white/30'
                  }`}
                  title={`Step ${i + 1}: ${steps[i]?.title}`}
                />
              ))}
            </div>

            {/* Step Content */}
            <div className="min-h-[160px]">{renderStep()}</div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-xs h-8"
                onClick={() => handleStepChange(currentStep - 1)}
                disabled={currentStep === 0}
              >
                Previous
              </Button>

              <span className="text-slate-500 text-xs">
                Step {currentStep + 1} of {totalSteps}
              </span>

              {currentStep < totalSteps - 1 ? (
                <Button
                  variant="ghost"
                  className="bg-blue-500/10 border border-blue-400/30 hover:bg-blue-500/20 text-blue-300 text-xs h-8"
                  onClick={() => handleStepChange(currentStep + 1)}
                >
                  Next
                </Button>
              ) : (
                <div className="w-[72px]" /> // Spacer for alignment
              )}
            </div>

            {/* Summary section (shown when all steps explored) */}
            {showSummary && summary && (
              <div className="border-t border-white/10 pt-4 space-y-3">
                <p className="text-slate-300 text-xs font-medium uppercase tracking-wider">Process Summary</p>
                <p className="text-slate-200 text-sm leading-relaxed">{summary.text}</p>
                {summary.totalTime && (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
                      Duration
                    </Badge>
                    <span className="text-slate-300 text-xs">{summary.totalTime}</span>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <p className="text-emerald-300 text-xs font-medium mb-1">Key Takeaway</p>
                  <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
                </div>
              </div>
            )}

            {/* Exploration Progress & Start Challenges */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>{stepsExplored} of {totalSteps} steps explored</span>
              {allStepsExplored && challenges.length > 0 && !showChallenges && (
                <Button
                  variant="ghost"
                  className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300 text-xs h-8"
                  onClick={handleStartChallenges}
                >
                  Start Challenges ({challenges.length})
                </Button>
              )}
              {!allStepsExplored && (
                <span className="text-slate-600">Explore all steps to unlock challenges</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// Utility
// ============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default HowItWorks;
