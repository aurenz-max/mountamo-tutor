'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PlanetaryExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface PlanetStat {
  label: string;
  value: string;
  unit?: string;
  comparisonToEarth?: string;
}

export interface PlanetQuestion {
  question: string;
  questionType: 'mc' | 'compare' | 'true-false';
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** For identify-mode quiz questions: which planet is the correct answer */
  aboutPlanetId?: string;
}

export interface PlanetStop {
  planetId: string;
  focusTheme: string;
  description: string;
  keyStats: PlanetStat[];
  funFact: string;
  transition: string;
  questions: PlanetQuestion[];
}

export interface PlanetaryExplorerData {
  title: string;
  description: string;

  introduction: string;
  celebration: string;
  planets: PlanetStop[];

  /** Cross-planet identification quiz (identify mode only) */
  quizQuestions?: PlanetQuestion[];

  showOrbits?: boolean;
  showScale?: boolean;
  animateTransitions?: boolean;
  gradeLevel?: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlanetaryExplorerMetrics>) => void;
}

// ============================================================================
// Planet Visual Data
// ============================================================================

const PLANET_VISUALS: Record<string, { color: string; glow: string; radiusScale: number; orbitRadius: number; emoji: string }> = {
  mercury: { color: '#b5b5b5', glow: '#b5b5b540', radiusScale: 0.38, orbitRadius: 0.39, emoji: '☿' },
  venus:   { color: '#e8cda0', glow: '#e8cda040', radiusScale: 0.95, orbitRadius: 0.72, emoji: '♀' },
  earth:   { color: '#4a90d9', glow: '#4a90d940', radiusScale: 1.0,  orbitRadius: 1.0,  emoji: '🌍' },
  mars:    { color: '#c1440e', glow: '#c1440e40', radiusScale: 0.53, orbitRadius: 1.52, emoji: '♂' },
  jupiter: { color: '#c88b3a', glow: '#c88b3a40', radiusScale: 11.2, orbitRadius: 5.2,  emoji: '♃' },
  saturn:  { color: '#e4d191', glow: '#e4d19140', radiusScale: 9.45, orbitRadius: 9.54, emoji: '♄' },
  uranus:  { color: '#b2d8d8', glow: '#b2d8d840', radiusScale: 4.0,  orbitRadius: 19.2, emoji: '⛢' },
  neptune: { color: '#5b5ddf', glow: '#5b5ddf40', radiusScale: 3.88, orbitRadius: 30.1, emoji: '♆' },
};

function getPlanetVisual(planetId: string) {
  return PLANET_VISUALS[planetId.toLowerCase()] ?? { color: '#888', glow: '#88888840', radiusScale: 1, orbitRadius: 2, emoji: '🪐' };
}

// ============================================================================
// Flattened Challenge Type (for shared hooks)
// ============================================================================

interface FlatQuestion {
  id: string;
  planetId: string;
  planetIndex: number;
  question: PlanetQuestion;
}

// ============================================================================
// View modes
// ============================================================================

type ViewMode = 'overview' | 'planet-info' | 'planet-questions' | 'transition' | 'quiz' | 'summary';

// ============================================================================
// Component
// ============================================================================

interface PlanetaryExplorerProps {
  data: PlanetaryExplorerData;
  className?: string;
}

const PlanetaryExplorer: React.FC<PlanetaryExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    introduction,
    celebration,
    planets = [],
    quizQuestions = [],
    showOrbits = true,
    showScale = true,
    gradeLevel,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const hasQuiz = quizQuestions.length > 0;

  // ── Stable refs ──
  const stableInstanceIdRef = useRef(instanceId || `planetary-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const startTimeRef = useRef(Date.now());

  // ── View state ──
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [currentPlanetIndex, setCurrentPlanetIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [tappedStats, setTappedStats] = useState<Set<string>>(new Set());
  const [submittedResult, setSubmittedResult] = useState<{ score: number } | null>(null);

  // ── Quiz state (identify mode) ──
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null);
  const [quizShowFeedback, setQuizShowFeedback] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState(0);
  const [quizResults, setQuizResults] = useState<Array<{ correct: boolean; attempts: number }>>([]);

  // ── Flatten per-planet questions for shared hooks ──
  const flatQuestions = useMemo<FlatQuestion[]>(() =>
    planets.flatMap((planet, pi) =>
      planet.questions.map((q, qi) => ({
        id: `${planet.planetId}-q${qi}`,
        planetId: planet.planetId,
        planetIndex: pi,
        question: q,
      }))
    ), [planets]);

  // ── Shared hooks (per-planet questions) ──
  const {
    currentIndex: currentQuestionIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allQuestionsComplete,
    recordResult,
    incrementAttempts,
    advance: advanceQuestion,
  } = useChallengeProgress({ challenges: flatQuestions, getChallengeId: (q) => q.id });

  // Phase config: one phase per planet + optional quiz phase
  const phaseConfig = useMemo<Record<string, PhaseConfig>>(() => {
    const config: Record<string, PhaseConfig> = {};
    for (const planet of planets) {
      const vis = getPlanetVisual(planet.planetId);
      config[planet.planetId] = {
        label: planet.planetId.charAt(0).toUpperCase() + planet.planetId.slice(1),
        icon: vis.emoji,
        accentColor: undefined,
      };
    }
    if (hasQuiz) {
      config['__quiz__'] = {
        label: 'Identification Quiz',
        icon: '?',
        accentColor: undefined,
      };
    }
    return config;
  }, [planets, hasQuiz]);

  // Build combined challenges + results for phase summary (per-planet + quiz)
  const allChallengesForPhases = useMemo(() => {
    const combined = [...flatQuestions.map((fq) => ({ ...fq }))];
    if (hasQuiz) {
      for (let i = 0; i < quizQuestions.length; i++) {
        combined.push({
          id: `quiz-q${i}`,
          planetId: '__quiz__',
          planetIndex: -1,
          question: quizQuestions[i],
        });
      }
    }
    return combined;
  }, [flatQuestions, quizQuestions, hasQuiz]);

  const allResultsForPhases = useMemo(() => {
    const combined = [...challengeResults];
    for (let i = 0; i < quizResults.length; i++) {
      combined.push({
        challengeId: `quiz-q${i}`,
        correct: quizResults[i].correct,
        attempts: quizResults[i].attempts,
        planetId: '__quiz__',
        questionType: 'mc',
        difficulty: quizQuestions[i]?.difficulty ?? 'medium',
      });
    }
    return combined;
  }, [challengeResults, quizResults, quizQuestions]);

  const isFullyComplete = hasQuiz
    ? allQuestionsComplete && quizResults.length >= quizQuestions.length
    : allQuestionsComplete;

  const phaseResults = usePhaseResults({
    challenges: allChallengesForPhases,
    results: allResultsForPhases,
    isComplete: isFullyComplete,
    getChallengeType: (q) => q.planetId,
    phaseConfig,
  });

  // ── Current planet & question ──
  const currentPlanet = planets[currentPlanetIndex];
  const currentFlatQuestion = flatQuestions[currentQuestionIndex];
  // Questions for the current planet
  const currentPlanetQuestions = useMemo(() =>
    flatQuestions.filter((q) => q.planetIndex === currentPlanetIndex),
    [flatQuestions, currentPlanetIndex]);
  const currentPlanetQuestionIndex = currentFlatQuestion
    ? currentPlanetQuestions.findIndex((q) => q.id === currentFlatQuestion.id)
    : -1;

  // ── Evaluation ──
  const { submitResult } = usePrimitiveEvaluation<PlanetaryExplorerMetrics>({
    primitiveType: 'planetary-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ──
  const currentQuizQuestion = hasQuiz ? quizQuestions[quizIndex] : undefined;
  const aiPrimitiveData = useMemo(() => ({
    currentPlanet: viewMode === 'quiz' ? undefined : currentPlanet?.planetId,
    focusTheme: viewMode === 'quiz' ? 'Identification Quiz' : currentPlanet?.focusTheme,
    planetsVisited: planets.slice(0, currentPlanetIndex).map((p) => p.planetId),
    planetsRemaining: planets.slice(currentPlanetIndex + 1).map((p) => p.planetId),
    questionText: viewMode === 'quiz' ? currentQuizQuestion?.question : currentFlatQuestion?.question.question,
    gradeLevel,
  }), [currentPlanet, currentPlanetIndex, planets, currentFlatQuestion, currentQuizQuestion, gradeLevel, viewMode]);

  const { sendText } = useLuminaAI({
    primitiveType: 'planetary-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // ── Handlers ──

  const handleStartJourney = useCallback(() => {
    setViewMode('planet-info');
    setCurrentPlanetIndex(0);
    sendText(`[JOURNEY_START] Topic: "${title}". We're exploring ${planets.map(p => p.planetId).join(', ')}. Introduce the journey briefly.`, { silent: true });
    sendText(`[PLANET_ARRIVE] Arriving at ${planets[0]?.planetId}. Focus: ${planets[0]?.focusTheme}. Introduce this planet.`, { silent: true });
  }, [planets, title, sendText]);

  const handleStartQuestions = useCallback(() => {
    setViewMode('planet-questions');
    setSelectedOption(null);
    setShowFeedback(false);
  }, []);

  const handleSelectOption = useCallback((optionIndex: number) => {
    if (showFeedback) return;
    setSelectedOption(optionIndex);
  }, [showFeedback]);

  const handleCheckAnswer = useCallback(() => {
    if (selectedOption === null || !currentFlatQuestion) return;

    const q = currentFlatQuestion.question;
    const correct = selectedOption === q.correctIndex;

    incrementAttempts();

    if (correct) {
      setShowFeedback(true);
      recordResult({
        challengeId: currentFlatQuestion.id,
        correct: true,
        attempts: currentAttempts + 1,
        planetId: currentFlatQuestion.planetId,
        questionType: q.questionType,
        difficulty: q.difficulty,
      });
      sendText(`[ANSWER_CORRECT] Student answered "${q.options[selectedOption]}" correctly for "${q.question}". Congratulate briefly.`, { silent: true });
    } else if (currentAttempts + 1 >= 2) {
      // Max 2 attempts — mark incorrect and show explanation
      setShowFeedback(true);
      recordResult({
        challengeId: currentFlatQuestion.id,
        correct: false,
        attempts: currentAttempts + 1,
        planetId: currentFlatQuestion.planetId,
        questionType: q.questionType,
        difficulty: q.difficulty,
      });
      sendText(`[ANSWER_INCORRECT] Student chose "${q.options[selectedOption]}" but correct is "${q.options[q.correctIndex]}" for "${q.question}". Give a clear explanation.`, { silent: true });
    } else {
      // First incorrect attempt — hint
      sendText(`[ANSWER_INCORRECT] Student chose "${q.options[selectedOption]}" but correct is "${q.options[q.correctIndex]}". Give a hint without revealing the answer.`, { silent: true });
      setSelectedOption(null);
    }
  }, [selectedOption, currentFlatQuestion, currentAttempts, incrementAttempts, recordResult, sendText]);

  const handleNextQuestion = useCallback(() => {
    setSelectedOption(null);
    setShowFeedback(false);

    // Check if there are more questions for this planet
    const nextQIndex = currentPlanetQuestionIndex + 1;
    if (nextQIndex < currentPlanetQuestions.length) {
      advanceQuestion();
      sendText(`[NEXT_ITEM] Moving to question ${nextQIndex + 1} of ${currentPlanetQuestions.length} for ${currentPlanet?.planetId}.`, { silent: true });
    } else {
      // Done with this planet's questions
      advanceQuestion();
      sendText(`[PLANET_COMPLETE] Finished all questions for ${currentPlanet?.planetId}. Summarize what we learned.`, { silent: true });

      if (currentPlanetIndex < planets.length - 1) {
        // More planets to visit — show transition
        setViewMode('transition');
      } else if (hasQuiz) {
        // All planets done, quiz available — enter quiz mode
        setViewMode('quiz');
        setQuizIndex(0);
        setQuizAttempts(0);
        setQuizSelectedOption(null);
        setQuizShowFeedback(false);
        sendText(`[QUIZ_START] All planets visited! Now it's time for the identification quiz. The student will identify planets from descriptions. Encourage them.`, { silent: true });
      } else {
        // All planets done, no quiz — submit evaluation and show summary
        handleSubmitEvaluation();
        setViewMode('summary');
      }
    }
  }, [currentPlanetQuestionIndex, currentPlanetQuestions, advanceQuestion, currentPlanet, currentPlanetIndex, planets, hasQuiz, sendText]);

  const handleNextPlanet = useCallback(() => {
    const nextIndex = currentPlanetIndex + 1;
    setCurrentPlanetIndex(nextIndex);
    setViewMode('planet-info');
    setTappedStats(new Set());
    const nextPlanet = planets[nextIndex];
    if (nextPlanet) {
      sendText(`[TRANSITION] Moving from ${currentPlanet?.planetId} to ${nextPlanet.planetId}. Bridge: "${currentPlanet?.transition}".`, { silent: true });
      sendText(`[PLANET_ARRIVE] Arriving at ${nextPlanet.planetId}. Focus: ${nextPlanet.focusTheme}. Introduce this planet.`, { silent: true });
    }
  }, [currentPlanetIndex, planets, currentPlanet, sendText]);

  const handleStatTap = useCallback((planetId: string, statLabel: string) => {
    const key = `${planetId}-${statLabel}`;
    setTappedStats((prev) => new Set(prev).add(key));
    sendText(`[STAT_TAPPED] Student tapped "${statLabel}" for ${planetId}. Give interesting context or comparison.`, { silent: true });
  }, [sendText]);

  // ── Quiz handlers ──

  const handleQuizSelectOption = useCallback((optionIndex: number) => {
    if (quizShowFeedback) return;
    setQuizSelectedOption(optionIndex);
  }, [quizShowFeedback]);

  const handleQuizCheckAnswer = useCallback(() => {
    if (quizSelectedOption === null || !currentQuizQuestion) return;

    const correct = quizSelectedOption === currentQuizQuestion.correctIndex;
    const newAttempts = quizAttempts + 1;
    setQuizAttempts(newAttempts);

    if (correct) {
      setQuizShowFeedback(true);
      setQuizResults((prev) => [...prev, { correct: true, attempts: newAttempts }]);
      sendText(`[QUIZ_CORRECT] Student identified "${currentQuizQuestion.options[quizSelectedOption]}" correctly for "${currentQuizQuestion.question}". Brief praise.`, { silent: true });
    } else if (newAttempts >= 2) {
      setQuizShowFeedback(true);
      setQuizResults((prev) => [...prev, { correct: false, attempts: newAttempts }]);
      sendText(`[QUIZ_INCORRECT] Student chose "${currentQuizQuestion.options[quizSelectedOption]}" but correct is "${currentQuizQuestion.options[currentQuizQuestion.correctIndex]}". Explain why.`, { silent: true });
    } else {
      sendText(`[QUIZ_HINT] Student chose "${currentQuizQuestion.options[quizSelectedOption]}" but that's not right. Give a hint about the correct planet without naming it.`, { silent: true });
      setQuizSelectedOption(null);
    }
  }, [quizSelectedOption, currentQuizQuestion, quizAttempts, sendText]);

  const handleQuizNext = useCallback(() => {
    const nextIndex = quizIndex + 1;
    if (nextIndex < quizQuestions.length) {
      setQuizIndex(nextIndex);
      setQuizSelectedOption(null);
      setQuizShowFeedback(false);
      setQuizAttempts(0);
      sendText(`[QUIZ_NEXT] Moving to quiz question ${nextIndex + 1} of ${quizQuestions.length}.`, { silent: true });
    } else {
      // Quiz complete — submit evaluation and show summary
      // Use a timeout to let quizResults state settle before computing scores
      handleSubmitEvaluation();
      setViewMode('summary');
    }
  }, [quizIndex, quizQuestions.length, sendText]);

  // ── Evaluation ──

  const handleSubmitEvaluation = useCallback(() => {
    const elapsedMs = Date.now() - startTimeRef.current;

    // Combine per-planet + quiz results for scoring
    const allCorrect = challengeResults.filter((r) => r.correct).length
      + quizResults.filter((r) => r.correct).length;
    const totalQuestions = flatQuestions.length + quizQuestions.length;
    const overallScore = totalQuestions > 0 ? Math.round((allCorrect / totalQuestions) * 100) : 0;

    const perPlanetScores: Record<string, number> = {};
    for (const planet of planets) {
      const planetResults = challengeResults.filter((r) => r.planetId === planet.planetId);
      const planetCorrect = planetResults.filter((r) => r.correct).length;
      perPlanetScores[planet.planetId] = planetResults.length > 0
        ? Math.round((planetCorrect / planetResults.length) * 100)
        : 0;
    }

    // Add quiz score if applicable
    if (quizResults.length > 0) {
      const quizCorrect = quizResults.filter((r) => r.correct).length;
      perPlanetScores['__quiz__'] = Math.round((quizCorrect / quizResults.length) * 100);
    }

    const metrics: PlanetaryExplorerMetrics = {
      type: 'planetary-explorer',
      totalQuestions,
      correctAnswers: allCorrect,
      accuracy: totalQuestions > 0 ? allCorrect / totalQuestions : 0,
      planetsExplored: planets.length,
      perPlanetScores,
      statsExplored: tappedStats.size,
      durationMs: elapsedMs,
    };

    const success = overallScore >= 50;
    const result = submitResult(success, overallScore, metrics);
    setSubmittedResult({ score: overallScore });

    // AI celebration
    const phaseScoreStr = planets.map((p) => {
      const score = perPlanetScores[p.planetId] ?? 0;
      return `${p.planetId}: ${score}%`;
    }).join(', ');
    const quizScoreStr = quizResults.length > 0 ? `, Quiz: ${perPlanetScores['__quiz__']}%` : '';
    sendText(`[ALL_COMPLETE] Journey complete! Planet scores: ${phaseScoreStr}${quizScoreStr}. Overall: ${overallScore}%. ${celebration}. Give encouraging planet-specific feedback.`, { silent: true });

    return result;
  }, [challengeResults, quizResults, flatQuestions, quizQuestions, planets, tappedStats, celebration, submitResult, sendText]);

  // ── Computed values ──
  const elapsedMs = Date.now() - startTimeRef.current;
  const overallScore = useMemo(() => {
    const totalQ = flatQuestions.length + quizQuestions.length;
    if (totalQ === 0) return 0;
    const correct = challengeResults.filter((r) => r.correct).length
      + quizResults.filter((r) => r.correct).length;
    return Math.round((correct / totalQ) * 100);
  }, [challengeResults, quizResults, flatQuestions, quizQuestions]);

  // ── Render helpers ──

  const renderSolarSystemCanvas = () => {
    const activePlanetId = viewMode === 'quiz' ? undefined : currentPlanet?.planetId?.toLowerCase();
    const visitedPlanetIds = new Set(planets.slice(0, currentPlanetIndex).map((p) => p.planetId.toLowerCase()));
    const journeyPlanetIds = new Set(planets.map((p) => p.planetId.toLowerCase()));
    const allVisited = viewMode === 'quiz' || viewMode === 'summary';

    return (
      <div className="relative w-full h-48 md:h-64 overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-white/5">
        {/* Stars background */}
        <div className="absolute inset-0 opacity-40">
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${1 + Math.random() * 2}px`,
                height: `${1 + Math.random() * 2}px`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: 0.3 + Math.random() * 0.7,
              }}
            />
          ))}
        </div>

        {/* Sun */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.6)]" />

        {/* Orbit lines + Planets */}
        {Object.entries(PLANET_VISUALS).map(([id, vis]) => {
          const isInJourney = journeyPlanetIds.has(id);
          const isActive = activePlanetId === id;
          const isVisited = allVisited || visitedPlanetIds.has(id);
          const xPos = 40 + (vis.orbitRadius / 32) * 800;
          const size = Math.max(6, Math.min(24, 4 + Math.log2(vis.radiusScale + 1) * 8));

          return (
            <React.Fragment key={id}>
              {/* Orbit line */}
              {showOrbits && (
                <div
                  className="absolute top-0 bottom-0 border-l border-dashed"
                  style={{
                    left: `${Math.min(95, xPos / 10)}%`,
                    borderColor: isInJourney ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  }}
                />
              )}
              {/* Planet dot */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full transition-all duration-500 ${
                  isActive ? 'ring-2 ring-white/60 scale-125 z-10' : ''
                } ${isVisited && !isActive ? 'opacity-60' : ''} ${!isInJourney ? 'opacity-20' : ''}`}
                style={{
                  left: `${Math.min(95, xPos / 10)}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  backgroundColor: vis.color,
                  boxShadow: isActive ? `0 0 16px ${vis.glow}` : undefined,
                }}
              />
              {/* Label */}
              {isInJourney && (
                <span
                  className={`absolute text-[10px] -translate-x-1/2 transition-opacity ${
                    isActive ? 'text-white font-medium' : 'text-slate-500'
                  }`}
                  style={{
                    left: `${Math.min(95, xPos / 10)}%`,
                    top: `calc(50% + ${size / 2 + 10}px)`,
                  }}
                >
                  {id.charAt(0).toUpperCase() + id.slice(1)}
                </span>
              )}
            </React.Fragment>
          );
        })}

        {/* Progress dots */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {planets.map((planet, i) => {
            const vis = getPlanetVisual(planet.planetId);
            const isCurrent = !allVisited && i === currentPlanetIndex;
            const isDone = allVisited || i < currentPlanetIndex;
            return (
              <div
                key={planet.planetId}
                className={`w-3 h-3 rounded-full border transition-all ${
                  isCurrent ? 'scale-125 animate-pulse border-white/80' : isDone ? 'border-white/40' : 'border-white/20'
                }`}
                style={{
                  backgroundColor: isDone || isCurrent ? vis.color : 'transparent',
                }}
                title={planet.planetId}
              />
            );
          })}
          {/* Quiz progress dot */}
          {hasQuiz && (
            <div
              className={`w-3 h-3 rounded-full border transition-all ${
                viewMode === 'quiz' ? 'scale-125 animate-pulse border-amber-400/80 bg-amber-400' : viewMode === 'summary' ? 'border-amber-400/40 bg-amber-400' : 'border-white/20'
              }`}
              title="Identification Quiz"
            />
          )}
        </div>

        {/* Scale reference */}
        {showScale && viewMode === 'planet-info' && currentPlanet && (
          <div className="absolute bottom-2 right-3 text-[10px] text-slate-500">
            Sizes not to scale
          </div>
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-4">
      {renderSolarSystemCanvas()}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader>
          <CardTitle className="text-slate-100 text-xl">{title}</CardTitle>
          <p className="text-slate-400 text-sm">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-300 leading-relaxed">{introduction}</p>
          <div className="flex flex-wrap gap-2">
            {planets.map((planet) => {
              const vis = getPlanetVisual(planet.planetId);
              return (
                <Badge
                  key={planet.planetId}
                  variant="outline"
                  className="border-white/20 text-slate-300 bg-white/5"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                    style={{ backgroundColor: vis.color }}
                  />
                  {planet.planetId.charAt(0).toUpperCase() + planet.planetId.slice(1)}
                </Badge>
              );
            })}
          </div>
          <Button
            onClick={handleStartJourney}
            className="w-full bg-indigo-600/80 hover:bg-indigo-500/80 text-white border border-indigo-400/30"
          >
            Begin Journey →
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderPlanetInfo = () => {
    if (!currentPlanet) return null;
    const vis = getPlanetVisual(currentPlanet.planetId);
    const planetName = currentPlanet.planetId.charAt(0).toUpperCase() + currentPlanet.planetId.slice(1);

    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex-shrink-0"
                style={{ backgroundColor: vis.color, boxShadow: `0 0 12px ${vis.glow}` }}
              />
              <div>
                <CardTitle className="text-slate-100 text-lg">{planetName}</CardTitle>
                <Badge variant="outline" className="border-white/20 text-slate-400 text-xs bg-white/5">
                  {currentPlanet.focusTheme}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            <p className="text-slate-300 leading-relaxed text-sm">{currentPlanet.description}</p>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {currentPlanet.keyStats.map((stat, i) => {
                const statKey = `${currentPlanet.planetId}-${stat.label}`;
                const isTapped = tappedStats.has(statKey);
                return (
                  <button
                    key={i}
                    onClick={() => handleStatTap(currentPlanet.planetId, stat.label)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      isTapped
                        ? 'bg-white/10 border-white/20'
                        : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/15'
                    }`}
                  >
                    <div className="text-slate-500 text-[10px] uppercase tracking-wider">{stat.label}</div>
                    <div className="text-slate-100 text-sm font-medium">
                      {stat.value}{stat.unit ? ` ${stat.unit}` : ''}
                    </div>
                    {stat.comparisonToEarth && (
                      <div className="text-slate-500 text-[10px] mt-0.5">{stat.comparisonToEarth}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Fun Fact */}
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-400/20">
              <div className="text-indigo-300 text-xs font-medium mb-1">Fun Fact</div>
              <p className="text-slate-300 text-sm">{currentPlanet.funFact}</p>
            </div>

            <Button
              onClick={handleStartQuestions}
              className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
            >
              Ready for Questions →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPlanetQuestions = () => {
    if (!currentFlatQuestion || !currentPlanet) return null;

    const q = currentFlatQuestion.question;
    const vis = getPlanetVisual(currentPlanet.planetId);
    const planetName = currentPlanet.planetId.charAt(0).toUpperCase() + currentPlanet.planetId.slice(1);
    const questionNum = currentPlanetQuestionIndex + 1;
    const totalForPlanet = currentPlanetQuestions.length;

    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: vis.color }}
                />
                <span className="text-slate-300 text-sm">{planetName}</span>
              </div>
              <Badge variant="outline" className="border-white/20 text-slate-400 bg-white/5">
                Q{questionNum}/{totalForPlanet}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question */}
            <p className="text-slate-100 text-base font-medium leading-relaxed">{q.question}</p>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((option, i) => {
                let optionStyle = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200';
                if (showFeedback) {
                  if (i === q.correctIndex) {
                    optionStyle = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200';
                  } else if (i === selectedOption && i !== q.correctIndex) {
                    optionStyle = 'bg-red-500/20 border-red-400/40 text-red-200';
                  } else {
                    optionStyle = 'bg-white/3 border-white/5 text-slate-500';
                  }
                } else if (i === selectedOption) {
                  optionStyle = 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectOption(i)}
                    disabled={showFeedback}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${optionStyle}`}
                  >
                    <span className="text-slate-500 mr-2 text-sm">{String.fromCharCode(65 + i)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {showFeedback && (
              <div className={`p-3 rounded-lg border ${
                challengeResults.find((r) => r.challengeId === currentFlatQuestion.id)?.correct
                  ? 'bg-emerald-500/10 border-emerald-400/20'
                  : 'bg-amber-500/10 border-amber-400/20'
              }`}>
                <p className="text-slate-300 text-sm">{q.explanation}</p>
              </div>
            )}

            {/* Action button */}
            {!showFeedback ? (
              <Button
                onClick={handleCheckAnswer}
                disabled={selectedOption === null}
                className="w-full bg-indigo-600/80 hover:bg-indigo-500/80 text-white border border-indigo-400/30 disabled:opacity-40"
              >
                Check Answer
              </Button>
            ) : (
              <Button
                onClick={handleNextQuestion}
                className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
              >
                {currentPlanetQuestionIndex + 1 < currentPlanetQuestions.length
                  ? 'Next Question →'
                  : currentPlanetIndex < planets.length - 1
                    ? `Continue to Next Planet →`
                    : hasQuiz
                      ? 'Start Identification Quiz →'
                      : 'See Results →'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTransition = () => {
    if (!currentPlanet) return null;
    const nextPlanet = planets[currentPlanetIndex + 1];
    const nextVis = nextPlanet ? getPlanetVisual(nextPlanet.planetId) : null;

    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-slate-300 leading-relaxed">{currentPlanet.transition}</p>
            {nextPlanet && nextVis && (
              <div className="flex items-center justify-center gap-3">
                <div
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: nextVis.color, boxShadow: `0 0 12px ${nextVis.glow}` }}
                />
                <span className="text-slate-100 font-medium">
                  {nextPlanet.planetId.charAt(0).toUpperCase() + nextPlanet.planetId.slice(1)}
                </span>
              </div>
            )}
            <Button
              onClick={handleNextPlanet}
              className="bg-indigo-600/80 hover:bg-indigo-500/80 text-white border border-indigo-400/30"
            >
              Explore {nextPlanet?.planetId.charAt(0).toUpperCase()}{nextPlanet?.planetId.slice(1)} →
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!currentQuizQuestion || quizIndex >= quizQuestions.length) return null;

    const q = currentQuizQuestion;
    const questionNum = quizIndex + 1;
    const totalQuiz = quizQuestions.length;
    const lastResult = quizResults[quizResults.length - 1];

    return (
      <div className="space-y-4">
        {renderSolarSystemCanvas()}
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 bg-amber-400/80 flex items-center justify-center text-xs font-bold text-slate-900">
                  ?
                </div>
                <span className="text-amber-300 text-sm font-medium">Identification Quiz</span>
              </div>
              <Badge variant="outline" className="border-amber-400/30 text-amber-300 bg-amber-400/10">
                Q{questionNum}/{totalQuiz}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Question — NO planet name shown */}
            <p className="text-slate-100 text-base font-medium leading-relaxed">{q.question}</p>

            {/* Options (planet names) */}
            <div className="space-y-2">
              {q.options.map((option, i) => {
                const planetVis = getPlanetVisual(option.toLowerCase());
                let optionStyle = 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-200';
                if (quizShowFeedback) {
                  if (i === q.correctIndex) {
                    optionStyle = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200';
                  } else if (i === quizSelectedOption && i !== q.correctIndex) {
                    optionStyle = 'bg-red-500/20 border-red-400/40 text-red-200';
                  } else {
                    optionStyle = 'bg-white/3 border-white/5 text-slate-500';
                  }
                } else if (i === quizSelectedOption) {
                  optionStyle = 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200';
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleQuizSelectOption(i)}
                    disabled={quizShowFeedback}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-2 ${optionStyle}`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: planetVis.color }}
                    />
                    <span className="text-slate-500 mr-1 text-sm">{String.fromCharCode(65 + i)}.</span>
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            {quizShowFeedback && (
              <div className={`p-3 rounded-lg border ${
                lastResult?.correct
                  ? 'bg-emerald-500/10 border-emerald-400/20'
                  : 'bg-amber-500/10 border-amber-400/20'
              }`}>
                <p className="text-slate-300 text-sm">{q.explanation}</p>
              </div>
            )}

            {/* Action button */}
            {!quizShowFeedback ? (
              <Button
                onClick={handleQuizCheckAnswer}
                disabled={quizSelectedOption === null}
                className="w-full bg-amber-600/80 hover:bg-amber-500/80 text-white border border-amber-400/30 disabled:opacity-40"
              >
                Check Answer
              </Button>
            ) : (
              <Button
                onClick={handleQuizNext}
                className="w-full bg-white/5 border border-white/20 hover:bg-white/10 text-slate-100"
              >
                {quizIndex + 1 < quizQuestions.length ? 'Next Question →' : 'See Results →'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="space-y-4">
      {renderSolarSystemCanvas()}
      {phaseResults.length > 0 && (
        <PhaseSummaryPanel
          phases={phaseResults}
          overallScore={submittedResult?.score ?? overallScore}
          durationMs={elapsedMs}
          heading="Journey Complete!"
          celebrationMessage={celebration}
          className="mb-4"
        />
      )}
    </div>
  );

  // ── Main render ──
  return (
    <div className={`w-full max-w-3xl mx-auto space-y-2 ${className ?? ''}`}>
      {viewMode === 'overview' && renderOverview()}
      {viewMode === 'planet-info' && renderPlanetInfo()}
      {viewMode === 'planet-questions' && renderPlanetQuestions()}
      {viewMode === 'transition' && renderTransition()}
      {viewMode === 'quiz' && renderQuiz()}
      {viewMode === 'summary' && renderSummary()}
    </div>
  );
};

export default PlanetaryExplorer;
