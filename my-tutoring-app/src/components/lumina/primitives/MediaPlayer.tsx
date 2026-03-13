import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, BookOpen, CheckCircle, ChevronLeft, ChevronRight, Play, RotateCcw, Sparkles, XCircle } from 'lucide-react';
import { MediaPlayerData } from '../types';
import { usePrimitiveEvaluation, type MediaPlayerMetrics, type PrimitiveEvaluationResult } from '../evaluation';
import { useLuminaAI } from '../hooks/useLuminaAI';
import PhaseSummaryPanel, { type PhaseResult } from '../components/PhaseSummaryPanel';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

interface MediaPlayerProps {
  data: MediaPlayerData;
  className?: string;
}

/**
 * MediaPlayer - Interactive visual lesson player with knowledge checks
 *
 * Features:
 * - Multi-segment lessons with AI narration and visual content
 * - Segment-by-segment knowledge check questions
 * - Progressive unlocking (must answer correctly to advance)
 * - Hybrid approach: 3 attempts, then show answer and allow skip
 * - Intro screen before lesson begins
 * - Evaluation tracking with PhaseSummaryPanel at completion
 * - Native Lumina AI narration (no legacy TTS)
 */

const MAX_ATTEMPTS_PER_SEGMENT = 3;

type SegmentPhase = 'reading' | 'answering' | 'completed' | 'max-attempts-reached';

/** Compute a phase score from attempt count */
function computeSegmentScore(attempts: number, correct: boolean): number {
  if (!correct) return 0;
  if (attempts <= 1) return 100;
  return Math.max(40, 100 - (attempts - 1) * 25);
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ data, className = '' }) => {
  // Navigation state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  // Knowledge check state
  const [segmentPhases, setSegmentPhases] = useState<SegmentPhase[]>(
    data.segments.map(() => 'reading')
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [segmentAttempts, setSegmentAttempts] = useState<Record<number, number>>({});
  const [segmentAnswered, setSegmentAnswered] = useState<Record<number, boolean>>({});
  const [segmentCorrect, setSegmentCorrect] = useState<Record<number, boolean>>({});
  const [segmentStartTimes, setSegmentStartTimes] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [, setShowCorrectAnswer] = useState<Record<number, boolean>>({});

  // Lesson completion state
  const [lessonComplete, setLessonComplete] = useState(false);

  // Submit evaluation via useEffect so all state (segmentCorrect, segmentAttempts, etc.)
  // is current — avoids stale closure when called from setTimeout in handleAnswerSubmit
  useEffect(() => {
    if (lessonComplete && !hasSubmittedEvaluation) {
      submitFinalEvaluation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonComplete]);

  const currentSegment = data.segments[currentIndex];

  // Refs to prevent duplicate AI triggers
  const hasTriggeredReadAloudRef = useRef<Set<number>>(new Set());
  const hasTriggeredKnowledgeCheckRef = useRef<Set<number>>(new Set());
  const hasTriggeredNextSegmentRef = useRef<Set<number>>(new Set());
  const hasTriggeredLessonCompleteRef = useRef(false);

  // ── AI Tutoring Hook ───────────────────────────────────────────────────────
  const resolvedInstanceId = data.instanceId || `media-player-${Date.now()}`;

  const aiPrimitiveData = useMemo(() => ({
    title: data.title || 'Interactive Lesson',
    currentSegmentIndex: currentIndex + 1,
    totalSegments: data.segments.length,
    currentSegmentTitle: currentSegment.title,
    currentSegmentScript: currentSegment.script,
    segmentPhase: segmentPhases[currentIndex],
    hasKnowledgeCheck: !!currentSegment.knowledgeCheck,
    knowledgeCheckQuestion: currentSegment.knowledgeCheck?.question || '',
    knowledgeCheckOptions: currentSegment.knowledgeCheck?.options?.join(' | ') || '',
  }), [data.title, data.segments.length, currentIndex, currentSegment, segmentPhases]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'media-player',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    exhibitId: data.exhibitId,
  });

  // ── Evaluation hook ────────────────────────────────────────────────────────
  const {
    submitResult,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
    resetAttempt,
  } = usePrimitiveEvaluation<MediaPlayerMetrics>({
    primitiveType: 'media-player',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Phase summary data (for PhaseSummaryPanel) ─────────────────────────────
  const phaseSummaryData = useMemo((): PhaseResult[] => {
    if (!hasSubmittedEvaluation) return [];

    const results: PhaseResult[] = [];
    for (let index = 0; index < data.segments.length; index++) {
      const segment = data.segments[index];
      if (!segment.knowledgeCheck) continue;
      const attempts = segmentAttempts[index] || 0;
      const correct = segmentCorrect[index] || false;
      const score = computeSegmentScore(attempts, correct);

      results.push({
        label: segment.title,
        score,
        attempts: Math.max(attempts, 1),
        firstTry: correct && attempts === 1,
        icon: correct ? '\u2705' : '\u274C',
        accentColor: correct ? 'emerald' : 'amber',
      });
    }
    return results;
  }, [hasSubmittedEvaluation, data.segments, segmentAttempts, segmentCorrect]);

  // ── AI: Read aloud on segment entry ────────────────────────────────────────
  useEffect(() => {
    if (!hasStarted || !isConnected) return;

    if (!hasTriggeredReadAloudRef.current.has(currentIndex)) {
      hasTriggeredReadAloudRef.current.add(currentIndex);
      sendText(
        `[READ_ALOUD] The student is now viewing segment ${currentIndex + 1} of ${data.segments.length}: "${currentSegment.title}". ` +
        `Read the following content aloud in a clear, engaging narrator voice:\n\n` +
        `"${currentSegment.script}"`,
        { silent: true }
      );
    }
  }, [hasStarted, isConnected, currentIndex, data.segments.length, currentSegment.title, currentSegment.script, sendText]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBeginLesson = () => {
    setHasStarted(true);
    setSegmentStartTimes({ 0: Date.now() });
  };

  const handleShowKnowledgeCheck = () => {
    setSegmentPhases(prev => {
      const updated = [...prev];
      updated[currentIndex] = 'answering';
      return updated;
    });
    if (!segmentStartTimes[currentIndex]) {
      setSegmentStartTimes(prev => ({ ...prev, [currentIndex]: Date.now() }));
    }

    if (!hasTriggeredKnowledgeCheckRef.current.has(currentIndex)) {
      hasTriggeredKnowledgeCheckRef.current.add(currentIndex);
      const kc = currentSegment.knowledgeCheck!;
      const optionsText = kc.options
        .map((opt, i) => `${String.fromCharCode(65 + i)}: ${opt}`)
        .join('. ');
      sendText(
        `[READ_KNOWLEDGE_CHECK] A knowledge check has appeared for segment "${currentSegment.title}". ` +
        `Read the question aloud, then read each answer option:\n\n` +
        `Question: "${kc.question}"\n` +
        `Options: ${optionsText}\n\n` +
        `Read these clearly and encourage the student to choose an answer. Do NOT hint at the correct answer.`,
        { silent: true }
      );
    }
  };

  const handleNext = () => {
    const hasKnowledgeCheck = currentSegment.knowledgeCheck !== undefined;
    const hasAnswered = segmentAnswered[currentIndex];

    if (hasKnowledgeCheck && !hasAnswered) return;

    if (currentIndex < data.segments.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setSegmentStartTimes(prev => ({ ...prev, [nextIndex]: Date.now() }));

      if (!hasTriggeredNextSegmentRef.current.has(nextIndex)) {
        hasTriggeredNextSegmentRef.current.add(nextIndex);
        const nextSegment = data.segments[nextIndex];
        sendText(
          `[NEXT_SEGMENT] Moving to segment ${nextIndex + 1} of ${data.segments.length}: "${nextSegment.title}". ` +
          `Briefly introduce this segment.`,
          { silent: true }
        );
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleAnswerSubmit = (segmentIndex: number) => {
    const segment = data.segments[segmentIndex];
    const knowledgeCheck = segment.knowledgeCheck;
    if (!knowledgeCheck) return;

    const selectedIndex = selectedAnswers[segmentIndex];
    if (selectedIndex === undefined) return;

    const isCorrect = selectedIndex === knowledgeCheck.correctOptionIndex;
    const attempts = (segmentAttempts[segmentIndex] || 0) + 1;
    setSegmentAttempts(prev => ({ ...prev, [segmentIndex]: attempts }));

    if (isCorrect) {
      setSegmentAnswered(prev => ({ ...prev, [segmentIndex]: true }));
      setSegmentCorrect(prev => ({ ...prev, [segmentIndex]: true }));
      setSegmentPhases(prev => {
        const updated = [...prev];
        updated[segmentIndex] = 'completed';
        return updated;
      });
      setFeedback(prev => ({ ...prev, [segmentIndex]: '' }));

      sendText(
        `[ANSWER_CORRECT] The student answered correctly on attempt ${attempts} ` +
        `for segment "${segment.title}". Briefly congratulate them!`,
        { silent: true }
      );

      setTimeout(() => {
        advanceToNextSegment(segmentIndex);
      }, 2000);
    } else {
      if (attempts >= MAX_ATTEMPTS_PER_SEGMENT) {
        setShowCorrectAnswer(prev => ({ ...prev, [segmentIndex]: true }));
        setSegmentPhases(prev => {
          const updated = [...prev];
          updated[segmentIndex] = 'max-attempts-reached';
          return updated;
        });
        setFeedback(prev => ({ ...prev, [segmentIndex]: '' }));

        const correctAnswer = knowledgeCheck.options[knowledgeCheck.correctOptionIndex];
        sendText(
          `[MAX_ATTEMPTS] The student used all ${MAX_ATTEMPTS_PER_SEGMENT} attempts on segment "${segment.title}". ` +
          `The correct answer was "${correctAnswer}". ` +
          (knowledgeCheck.explanation ? `Explanation: ${knowledgeCheck.explanation}. ` : '') +
          `Read the correct answer aloud and reassure them.`,
          { silent: true }
        );
      } else {
        setFeedback(prev => ({
          ...prev,
          [segmentIndex]: 'Not quite right. Review the content and try again.'
        }));

        const studentAnswer = knowledgeCheck.options[selectedIndex];
        sendText(
          `[ANSWER_INCORRECT] The student chose "${studentAnswer}" but that's not correct. ` +
          `Attempt ${attempts} of ${MAX_ATTEMPTS_PER_SEGMENT} for segment "${segment.title}". ` +
          `Give a brief, encouraging hint without revealing the answer.`,
          { silent: true }
        );
      }
    }
  };

  const handleSkipAfterMaxAttempts = (segmentIndex: number) => {
    setSegmentAnswered(prev => ({ ...prev, [segmentIndex]: true }));
    setSegmentCorrect(prev => ({ ...prev, [segmentIndex]: false }));
    advanceToNextSegment(segmentIndex);
  };

  const advanceToNextSegment = (currentSegmentIndex: number) => {
    if (currentSegmentIndex === data.segments.length - 1) {
      if (!hasTriggeredLessonCompleteRef.current) {
        hasTriggeredLessonCompleteRef.current = true;
        const correctCount = Object.values(segmentCorrect).filter(Boolean).length;
        sendText(
          `[LESSON_COMPLETE] The student finished all ${data.segments.length} segments of "${data.title || 'the lesson'}"! ` +
          `They got ${correctCount} knowledge checks correct. ` +
          `Celebrate their accomplishment and summarize what they learned.`,
          { silent: true }
        );
      }
      setLessonComplete(true);
    } else {
      const nextIndex = currentSegmentIndex + 1;
      setCurrentIndex(nextIndex);
      setSegmentStartTimes(prev => ({ ...prev, [nextIndex]: Date.now() }));
      setSegmentPhases(prev => {
        const updated = [...prev];
        updated[nextIndex] = 'reading';
        return updated;
      });

      if (!hasTriggeredNextSegmentRef.current.has(nextIndex)) {
        hasTriggeredNextSegmentRef.current.add(nextIndex);
        const nextSegment = data.segments[nextIndex];
        sendText(
          `[NEXT_SEGMENT] Moving to segment ${nextIndex + 1} of ${data.segments.length}: "${nextSegment.title}". ` +
          `Briefly introduce this segment and tell the student to read along.`,
          { silent: true }
        );
      }
    }
  };

  const submitFinalEvaluation = () => {
    const segmentResults = data.segments.map((segment, index) => {
      const knowledgeCheck = segment.knowledgeCheck;
      const studentAnswerIndex = selectedAnswers[index];
      const isCorrect = segmentCorrect[index] || false;
      const attempts = segmentAttempts[index] || 0;
      const maxAttemptsReached = attempts >= MAX_ATTEMPTS_PER_SEGMENT && !isCorrect;

      return {
        segmentIndex: index,
        segmentTitle: segment.title,
        audioPlayed: true,
        questionAnswered: segmentAnswered[index] || false,
        question: knowledgeCheck?.question || '',
        correctAnswer: knowledgeCheck?.options[knowledgeCheck.correctOptionIndex] || '',
        studentAnswer: studentAnswerIndex !== undefined
          ? knowledgeCheck?.options[studentAnswerIndex] || null
          : null,
        isCorrect,
        attempts,
        maxAttemptsReached,
        skippedAfterMaxAttempts: maxAttemptsReached,
        timeToAnswer: segmentStartTimes[index]
          ? Date.now() - segmentStartTimes[index]
          : undefined,
      };
    });

    const totalQuestions = data.segments.filter(s => s.knowledgeCheck).length;
    const correctAnswers = segmentResults.filter(r => r.isCorrect).length;
    const totalAttempts = Object.values(segmentAttempts).reduce((sum, a) => sum + a, 0);
    const firstAttemptCorrect = segmentResults.filter(r => r.isCorrect && r.attempts === 1).length;
    const skippedCount = segmentResults.filter(r => r.skippedAfterMaxAttempts).length;

    const metrics: MediaPlayerMetrics = {
      type: 'media-player',
      totalSegments: data.segments.length,
      segmentsCompleted: segmentResults.filter(r => r.questionAnswered).length,
      allSegmentsCompleted: segmentResults.every(r => !r.question || r.questionAnswered),

      totalQuestions,
      correctAnswers,
      incorrectAnswers: totalQuestions - correctAnswers,
      knowledgeCheckAccuracy: totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0,

      segmentResults,

      totalAttempts,
      firstAttemptSuccessRate: totalQuestions > 0
        ? (firstAttemptCorrect / totalQuestions) * 100
        : 0,
      averageAttemptsPerQuestion: totalQuestions > 0
        ? totalAttempts / totalQuestions
        : 0,

      passedWithoutErrors: firstAttemptCorrect === totalQuestions,
      skippedSegments: skippedCount,
    };

    const success = metrics.allSegmentsCompleted && correctAnswers === totalQuestions;
    const score = metrics.knowledgeCheckAccuracy;

    submitResult(success, score, metrics, {
      studentWork: { segmentResults, selectedAnswers },
    });
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setHasStarted(false);
    setLessonComplete(false);
    setSegmentPhases(data.segments.map(() => 'reading'));
    setSelectedAnswers({});
    setSegmentAttempts({});
    setSegmentAnswered({});
    setSegmentCorrect({});
    setSegmentStartTimes({});
    setFeedback({});
    setShowCorrectAnswer({});
    hasTriggeredReadAloudRef.current = new Set();
    hasTriggeredKnowledgeCheckRef.current = new Set();
    hasTriggeredNextSegmentRef.current = new Set();
    hasTriggeredLessonCompleteRef.current = false;
    resetAttempt();
  };

  // ── Progress percentage ────────────────────────────────────────────────────
  const progressPercent = ((currentIndex + 1) / data.segments.length) * 100;

  // ── Render: Lesson Complete Summary ────────────────────────────────────────
  if (lessonComplete && hasSubmittedEvaluation) {
    const totalQuestions = data.segments.filter(s => s.knowledgeCheck).length;
    const correctCount = Object.values(segmentCorrect).filter(Boolean).length;

    return (
      <div className={`min-h-[600px] w-full bg-slate-950 flex items-center justify-center p-4 md:p-6 lg:p-8 font-sans relative overflow-hidden rounded-3xl ${className}`}>
        {/* Ambient Background */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />

        <div className="w-full max-w-2xl relative z-10 space-y-6">
          <PhaseSummaryPanel
            phases={phaseSummaryData}
            overallScore={submittedResult?.score}
            durationMs={elapsedMs}
            heading="Lesson Complete!"
            celebrationMessage={
              correctCount === totalQuestions
                ? `Perfect score! You aced all ${totalQuestions} knowledge checks!`
                : `You completed ${data.segments.length} segments and got ${correctCount} of ${totalQuestions} knowledge checks correct.`
            }
          />

          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={handleReset}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 rounded-xl gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Main Lesson UI ─────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className={`min-h-[600px] w-full bg-slate-950 flex items-center justify-center p-4 md:p-6 lg:p-8 font-sans relative overflow-hidden rounded-3xl ${className}`}>

        {/* Ambient Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />

        {/* Intro Overlay */}
        {!hasStarted && (
          <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center rounded-3xl">
            <div className="w-full max-w-2xl mx-auto px-6">
              <Card className="backdrop-blur-xl bg-slate-900/40 border-indigo-500/20 rounded-3xl overflow-hidden animate-fade-in-up">
                {/* Terminal-style Header */}
                <CardHeader className="bg-slate-900/80 border-b border-white/5 flex-row items-center justify-between space-y-0 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                      <span className="w-2 h-2 rounded-full bg-slate-600" />
                    </div>
                    <Badge variant="outline" className="bg-indigo-500/10 border-indigo-500/30 text-indigo-400 text-xs font-mono uppercase tracking-widest">
                      Interactive Lesson
                    </Badge>
                  </div>
                  <Badge variant="secondary" className="bg-slate-800/60 text-slate-400 text-xs font-mono">
                    {data.segments.length} Segments
                  </Badge>
                </CardHeader>

                {/* Content */}
                <CardContent className="p-8 md:p-12 text-center space-y-6">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-2">
                    <BookOpen className="h-10 w-10 text-indigo-400" />
                  </div>

                  <CardTitle className="text-3xl md:text-4xl font-bold text-white leading-tight">
                    {data.title || 'Interactive Lesson'}
                  </CardTitle>

                  <p className="text-slate-300 text-lg leading-relaxed max-w-md mx-auto">
                    {data.description || `A ${data.segments.length}-segment lesson with AI narration, visual illustrations, and knowledge checks`}
                  </p>

                  {/* Features Grid */}
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-400">{data.segments.length}</div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Segments</div>
                    </div>
                    <div className="text-center border-l border-r border-slate-700">
                      <div className="text-2xl font-bold text-indigo-400">
                        {data.segments.filter(s => s.knowledgeCheck).length}
                      </div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Checks</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Sparkles className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">AI Narrated</div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-4">
                    <Button
                      size="lg"
                      onClick={handleBeginLesson}
                      className="group px-8 py-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all transform hover:scale-105 active:scale-95 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      <Play className="h-5 w-5 fill-current relative z-10" />
                      <span className="relative z-10">Begin Lesson</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Main Card Container */}
        <Card className="w-full max-w-6xl h-[700px] backdrop-blur-xl bg-slate-900/80 border-white/10 rounded-3xl shadow-2xl flex flex-col lg:flex-row overflow-hidden relative z-10 transition-all">

          {/* LEFT: Visual Stage */}
          <div className="relative w-full lg:w-2/3 h-[45%] lg:h-full bg-slate-900 flex items-center justify-center p-6 group">
            {/* Subtle Grid Pattern Background */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="absolute inset-0 bg-radial-at-c from-transparent to-slate-900/50 pointer-events-none" />

            {currentSegment.imageUrl ? (
              <img
                key={currentIndex}
                src={currentSegment.imageUrl}
                alt={currentSegment.imagePrompt}
                className="relative z-10 max-h-full max-w-full object-contain animate-fade-in shadow-2xl drop-shadow-2xl rounded-lg"
              />
            ) : (
              <div className="relative z-10 w-full max-w-md space-y-4">
                <Skeleton className="w-full aspect-[16/10] rounded-xl bg-slate-800/60" />
                <div className="flex items-center justify-center gap-2 text-slate-500">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="text-sm font-medium tracking-wide">Generating visualization...</span>
                </div>
              </div>
            )}

            {/* Persistent badge */}
            <Badge
              variant="outline"
              className="absolute top-4 right-4 z-20 bg-slate-800/80 backdrop-blur-md border-white/10 text-white/70 shadow-lg"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI Generated
            </Badge>
          </div>

          {/* RIGHT: Control Hub */}
          <div className="w-full lg:w-1/3 h-[55%] lg:h-full bg-slate-950/50 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col">

            {/* Progress Header */}
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-indigo-500/20 border-indigo-500/30 text-indigo-400 font-bold">
                    {currentIndex + 1}
                  </Badge>
                  <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    Step {currentIndex + 1} of {data.segments.length}
                  </span>
                </div>
                {data.title && (
                  <span className="text-xs text-slate-500 hidden md:block truncate max-w-[120px]">
                    {data.title}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <Progress
                value={progressPercent}
                className="h-2 bg-slate-800"
                aria-label={`Lesson progress: step ${currentIndex + 1} of ${data.segments.length}`}
              />

              {/* Segment status dots (compact, below bar) */}
              <div className="flex items-center gap-1.5 justify-center" role="group" aria-label="Segment status">
                {data.segments.map((seg, i) => {
                  const phase = segmentPhases[i];
                  const isCurrent = i === currentIndex;
                  const isAnswered = segmentAnswered[i];
                  const isCorrectSeg = segmentCorrect[i];
                  const hasCheck = !!seg.knowledgeCheck;

                  let dotColor = 'bg-slate-700';
                  let label = `Segment ${i + 1}: not started`;
                  if (isAnswered && isCorrectSeg) { dotColor = 'bg-emerald-500'; label = `Segment ${i + 1}: correct`; }
                  else if (isAnswered && !isCorrectSeg) { dotColor = 'bg-amber-500'; label = `Segment ${i + 1}: incorrect`; }
                  else if (phase === 'completed') { dotColor = 'bg-emerald-500'; label = `Segment ${i + 1}: completed`; }
                  else if (isCurrent) { dotColor = 'bg-indigo-500'; label = `Segment ${i + 1}: current`; }
                  else if (!hasCheck && i < currentIndex) { dotColor = 'bg-slate-500'; label = `Segment ${i + 1}: viewed`; }

                  return (
                    <Tooltip key={i}>
                      <TooltipTrigger asChild>
                        <div
                          className={`h-2 w-2 rounded-full transition-all ${dotColor} ${
                            isCurrent ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-950 scale-125' : ''
                          }`}
                          aria-label={label}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="bg-slate-800 border-white/10 text-slate-200">
                        <p className="text-xs">{seg.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-white/5" />

            {/* Scrollable Content Area */}
            <ScrollArea className="flex-1">
              <div className="p-6 lg:p-8">
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-100 mb-4 leading-tight">
                  {currentSegment.title}
                </h2>

                <div className="prose prose-invert prose-lg">
                  <p className="text-slate-300 leading-relaxed">
                    {currentSegment.script}
                  </p>
                </div>

                {/* "Continue to Knowledge Check" Button */}
                {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'reading' && (
                  <div className="mt-6">
                    <Button
                      size="lg"
                      onClick={handleShowKnowledgeCheck}
                      className="group w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all transform hover:scale-[1.02] active:scale-95 relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                      <CheckCircle className="h-5 w-5 relative z-10" />
                      <span className="relative z-10">I&apos;m Ready — Show Knowledge Check</span>
                    </Button>
                  </div>
                )}

                {/* Knowledge Check UI — answering phase */}
                {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'answering' && (
                  <Card className="mt-6 backdrop-blur-xl bg-slate-800/50 border-blue-500/30">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <span className="text-blue-400 font-bold text-sm">{currentIndex + 1}</span>
                        </div>
                        <CardTitle className="text-lg text-white">Knowledge Check</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-slate-200">{currentSegment.knowledgeCheck.question}</p>

                      <RadioGroup
                        value={selectedAnswers[currentIndex]?.toString()}
                        onValueChange={(val) => setSelectedAnswers(prev => ({ ...prev, [currentIndex]: parseInt(val) }))}
                        className="space-y-2"
                      >
                        {currentSegment.knowledgeCheck.options.map((option, optionIndex) => (
                          <Label
                            key={optionIndex}
                            htmlFor={`option-${currentIndex}-${optionIndex}`}
                            className={`flex items-center gap-3 w-full p-4 rounded-xl cursor-pointer transition-all backdrop-blur-sm border ${
                              selectedAnswers[currentIndex] === optionIndex
                                ? 'bg-blue-500/20 border-blue-400/40 text-white'
                                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20'
                            }`}
                          >
                            <RadioGroupItem
                              value={optionIndex.toString()}
                              id={`option-${currentIndex}-${optionIndex}`}
                              className="border-slate-500 text-blue-400"
                            />
                            <span className="flex-shrink-0 h-6 w-6 rounded-full border border-current/30 bg-white/5 flex items-center justify-center text-xs font-bold">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <span className="text-sm">{option}</span>
                          </Label>
                        ))}
                      </RadioGroup>

                      <Button
                        size="lg"
                        onClick={() => handleAnswerSubmit(currentIndex)}
                        disabled={selectedAnswers[currentIndex] === undefined}
                        className="group w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all transform hover:scale-[1.02] active:scale-95 disabled:hover:scale-100 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <span className="relative z-10">Submit Answer</span>
                      </Button>

                      {/* Error Feedback */}
                      {feedback[currentIndex] && (
                        <Alert className="bg-red-900/20 border-red-500/30 text-red-400">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle className="text-red-400">Incorrect</AlertTitle>
                          <AlertDescription>
                            <p className="text-red-400/90 text-sm">{feedback[currentIndex]}</p>
                            <Badge variant="outline" className="mt-2 border-red-500/30 text-red-400/80 text-xs">
                              Attempt {segmentAttempts[currentIndex] || 0} of {MAX_ATTEMPTS_PER_SEGMENT}
                            </Badge>
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Success Feedback — completed phase */}
                {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'completed' && (
                  <Alert className="mt-6 bg-emerald-900/20 border-emerald-500/30">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <AlertTitle className="text-emerald-400">Correct!</AlertTitle>
                    {currentSegment.knowledgeCheck.explanation && (
                      <AlertDescription className="text-slate-300 text-sm">
                        {currentSegment.knowledgeCheck.explanation}
                      </AlertDescription>
                    )}
                  </Alert>
                )}

                {/* Max Attempts Reached — show correct answer */}
                {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'max-attempts-reached' && (
                  <Alert className="mt-6 bg-amber-900/20 border-amber-500/30">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <AlertTitle className="text-amber-400">Maximum Attempts Reached</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-slate-300 text-sm">
                        The correct answer is:{' '}
                        <strong className="text-white">
                          {currentSegment.knowledgeCheck.options[currentSegment.knowledgeCheck.correctOptionIndex]}
                        </strong>
                      </p>
                      {currentSegment.knowledgeCheck.explanation && (
                        <p className="text-slate-400 text-sm italic">
                          {currentSegment.knowledgeCheck.explanation}
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={() => handleSkipAfterMaxAttempts(currentIndex)}
                        className="group w-full py-3 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 text-white font-semibold transition-all transform hover:scale-[1.02] active:scale-95 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                        <span className="relative z-10">
                          {currentIndex < data.segments.length - 1 ? 'Continue to Next Segment' : 'Complete Lesson'}
                        </span>
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </ScrollArea>

            {/* Bottom Navigation */}
            <Separator className="bg-white/5" />
            <div className="p-5 bg-slate-900/50">
              <div className="flex items-center justify-between">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-slate-400 hover:text-white disabled:opacity-30"
                        aria-label="Previous segment"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 border-white/10 text-slate-200">
                    {currentIndex === 0 ? 'First segment' : 'Previous segment'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={
                          currentIndex >= data.segments.length - 1 ||
                          (!!currentSegment.knowledgeCheck && !segmentAnswered[currentIndex])
                        }
                        className={`h-12 px-6 rounded-xl font-semibold transition-all transform active:scale-95 ${
                          segmentAnswered[currentIndex] || !currentSegment.knowledgeCheck
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900'
                            : 'bg-white/5 border border-white/20 hover:bg-white/10 text-white'
                        }`}
                        aria-label={
                          currentSegment.knowledgeCheck && !segmentAnswered[currentIndex]
                            ? 'Complete knowledge check to continue'
                            : 'Next segment'
                        }
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-slate-800 border-white/10 text-slate-200">
                    {currentSegment.knowledgeCheck && !segmentAnswered[currentIndex]
                      ? 'Complete knowledge check to continue'
                      : currentIndex >= data.segments.length - 1
                        ? 'Last segment'
                        : 'Next segment'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

          </div>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default MediaPlayer;
