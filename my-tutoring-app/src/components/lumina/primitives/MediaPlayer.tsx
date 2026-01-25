import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Pause, Play, RefreshCw, RotateCcw, Volume2, XCircle } from 'lucide-react';
import { MediaPlayerData } from '../types';
import { base64ToAudioBuffer, getAudioContext } from '../utils/audioUtils';
import { usePrimitiveEvaluation, type MediaPlayerMetrics } from '../evaluation';

interface MediaPlayerProps {
  data: MediaPlayerData;
  className?: string;
}

/**
 * MediaPlayer - Interactive audio-visual lesson player with knowledge checks
 *
 * Features:
 * - Multi-segment lessons with audio narration and visual content
 * - Segment-by-segment knowledge check questions
 * - Play/pause controls with progress tracking
 * - Progressive unlocking (must answer correctly to advance)
 * - Hybrid approach: 3 attempts, then show answer and allow skip
 * - Intro screen to prevent auto-play
 * - Evaluation tracking for student performance analytics
 * - Beautiful UI with ambient effects
 * - Uses Web Audio API for PCM audio playback
 */

const MAX_ATTEMPTS_PER_SEGMENT = 3;

type SegmentPhase = 'watching' | 'answering' | 'completed' | 'max-attempts-reached';

const MediaPlayer: React.FC<MediaPlayerProps> = ({ data, className = '' }) => {
  // Audio playback state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Knowledge check state
  const [segmentPhases, setSegmentPhases] = useState<SegmentPhase[]>(
    data.segments.map(() => 'watching')
  );
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [segmentAttempts, setSegmentAttempts] = useState<Record<number, number>>({});
  const [segmentAnswered, setSegmentAnswered] = useState<Record<number, boolean>>({});
  const [segmentStartTimes, setSegmentStartTimes] = useState<Record<number, number>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [showCorrectAnswer, setShowCorrectAnswer] = useState<Record<number, boolean>>({});

  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  const currentSegment = data.segments[currentIndex];

  // Initialize evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<MediaPlayerMetrics>({
    primitiveType: 'media-player',
    instanceId: data.instanceId || `media-player-${Date.now()}`,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit,
  });

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    startTimeRef.current = 0;
  };

  const playAudio = async () => {
    if (!audioBuffer) return;

    const audioContext = getAudioContext();

    // Resume audio context if suspended (required for autoplay policy)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Stop any existing playback
    stopAudio();

    // Create source node
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    // Track when playback started
    const offset = pausedAtRef.current;
    startTimeRef.current = audioContext.currentTime - offset;

    source.start(0, offset);
    sourceNodeRef.current = source;
    setIsPlaying(true);
    setIsFinished(false);

    // Handle when audio ends
    source.onended = () => {
      if (sourceNodeRef.current === source) {
        setIsPlaying(false);
        setProgress(100);
        setIsFinished(true);
        pausedAtRef.current = 0;
      }
    };

    // Progress tracking
    const updateProgress = () => {
      if (!audioBuffer || !sourceNodeRef.current) return;

      const duration = audioBuffer.duration;
      const currentTime = audioContext.currentTime - startTimeRef.current;

      if (currentTime >= duration) {
        setIsPlaying(false);
        setProgress(100);
        setIsFinished(true);
        pausedAtRef.current = 0;
      } else {
        setProgress((currentTime / duration) * 100);
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const handlePlayPause = () => {
    if (!audioBuffer) return;

    if (isPlaying) {
      // Pause
      const audioContext = getAudioContext();
      const currentTime = audioContext.currentTime - startTimeRef.current;
      pausedAtRef.current = currentTime;
      stopAudio();
    } else {
      // Play/Resume
      if (progress >= 100) {
        pausedAtRef.current = 0;
        setProgress(0);
        setIsFinished(false);
      }
      setHasStarted(true);
      playAudio();
    }
  };

  const handleNext = () => {
    // Check if current segment has a knowledge check that hasn't been answered
    const hasKnowledgeCheck = currentSegment.knowledgeCheck !== undefined;
    const hasAnswered = segmentAnswered[currentIndex];

    if (hasKnowledgeCheck && !hasAnswered) {
      // Can't advance without answering knowledge check
      return;
    }

    stopAudio();
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;
    if (currentIndex < data.segments.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Record start time for next segment
      setSegmentStartTimes({
        ...segmentStartTimes,
        [currentIndex + 1]: Date.now()
      });
    }
  };

  const handlePrev = () => {
    stopAudio();
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReplay = () => {
    stopAudio();
    pausedAtRef.current = 0;
    setProgress(0);
    setIsFinished(false);
    playAudio();
  };

  // Knowledge Check Handlers
  const handleAnswerSubmit = (segmentIndex: number) => {
    const segment = data.segments[segmentIndex];
    const knowledgeCheck = segment.knowledgeCheck;
    if (!knowledgeCheck) return;

    const selectedIndex = selectedAnswers[segmentIndex];
    if (selectedIndex === undefined) return;

    const isCorrect = selectedIndex === knowledgeCheck.correctOptionIndex;
    const attempts = (segmentAttempts[segmentIndex] || 0) + 1;
    setSegmentAttempts({ ...segmentAttempts, [segmentIndex]: attempts });

    if (isCorrect) {
      // Mark segment as completed successfully
      setSegmentAnswered({ ...segmentAnswered, [segmentIndex]: true });
      setSegmentPhases(prev => {
        const updated = [...prev];
        updated[segmentIndex] = 'completed';
        return updated;
      });
      setFeedback({ ...feedback, [segmentIndex]: '' });

      // Show success feedback, then auto-advance
      setTimeout(() => {
        advanceToNextSegment(segmentIndex);
      }, 2000);
    } else {
      // Incorrect answer
      if (attempts >= MAX_ATTEMPTS_PER_SEGMENT) {
        // Max attempts reached - show correct answer and allow skip
        setShowCorrectAnswer({ ...showCorrectAnswer, [segmentIndex]: true });
        setSegmentPhases(prev => {
          const updated = [...prev];
          updated[segmentIndex] = 'max-attempts-reached';
          return updated;
        });
        setFeedback({ ...feedback, [segmentIndex]: '' });
      } else {
        // Show error feedback, allow retry
        setFeedback({
          ...feedback,
          [segmentIndex]: 'Not quite right. Review the content above and try again.'
        });
      }
    }
  };

  const handleSkipAfterMaxAttempts = (segmentIndex: number) => {
    // Student hit max attempts - mark as answered (but incorrect) and advance
    setSegmentAnswered({ ...segmentAnswered, [segmentIndex]: true });
    advanceToNextSegment(segmentIndex);
  };

  const advanceToNextSegment = (currentSegmentIndex: number) => {
    if (currentSegmentIndex === data.segments.length - 1) {
      // Last segment - submit final evaluation
      submitFinalEvaluation();
    } else {
      // Move to next segment
      setCurrentIndex(currentSegmentIndex + 1);
      setSegmentStartTimes({
        ...segmentStartTimes,
        [currentSegmentIndex + 1]: Date.now()
      });
      setSegmentPhases(prev => {
        const updated = [...prev];
        updated[currentSegmentIndex + 1] = 'watching';
        return updated;
      });
    }
  };

  const submitFinalEvaluation = () => {
    const segmentResults = data.segments.map((segment, index) => {
      const knowledgeCheck = segment.knowledgeCheck;
      const studentAnswerIndex = selectedAnswers[index];
      const isCorrect = studentAnswerIndex === knowledgeCheck?.correctOptionIndex;
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
      allSegmentsCompleted: segmentResults.every(r => r.questionAnswered),

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

  // When audio finishes, show knowledge check (if present)
  useEffect(() => {
    if (isFinished && currentSegment.knowledgeCheck && !segmentAnswered[currentIndex]) {
      // Audio finished - transition to answering phase
      setSegmentPhases(prev => {
        const updated = [...prev];
        updated[currentIndex] = 'answering';
        return updated;
      });
      // Record segment start time if not already recorded
      if (!segmentStartTimes[currentIndex]) {
        setSegmentStartTimes({ ...segmentStartTimes, [currentIndex]: Date.now() });
      }
    }
  }, [isFinished, currentIndex, currentSegment.knowledgeCheck, segmentAnswered, segmentStartTimes]);

  // Load audio buffer when segment changes
  useEffect(() => {
    const loadAudio = async () => {
      if (!currentSegment.audioBase64) {
        setAudioBuffer(null);
        return;
      }

      setIsLoadingAudio(true);
      try {
        const buffer = await base64ToAudioBuffer(currentSegment.audioBase64);
        setAudioBuffer(buffer);
      } catch (error) {
        console.error('Error loading audio:', error);
        setAudioBuffer(null);
      } finally {
        setIsLoadingAudio(false);
      }
    };

    loadAudio();
  }, [currentSegment.audioBase64]);

  // Auto-play on segment change (after audio is loaded) - only if already started
  useEffect(() => {
    setProgress(0);
    setIsFinished(false);
    pausedAtRef.current = 0;

    if (audioBuffer && hasStarted) {
      // Small delay to ensure everything is ready
      const timer = setTimeout(() => {
        playAudio();
      }, 100);

      return () => {
        clearTimeout(timer);
        stopAudio();
      };
    }

    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, audioBuffer, hasStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`min-h-[600px] w-full bg-slate-950 flex items-center justify-center p-4 md:p-6 lg:p-8 font-sans relative overflow-hidden rounded-3xl ${className}`}>

      {/* Ambient Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />

      {/* Intro Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center rounded-3xl">
          <div className="text-center space-y-6 max-w-md px-6">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20 mb-4">
              <Play className="h-10 w-10 text-indigo-400 fill-current ml-1" />
            </div>
            <h2 className="text-3xl font-bold text-white">
              {data.title || 'Interactive Lesson'}
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              {data.segments.length} segments with audio narration and visual illustrations
            </p>
            <button
              onClick={handlePlayPause}
              disabled={!audioBuffer || isLoadingAudio}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-lg shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Play className="h-5 w-5 fill-current" />
              {isLoadingAudio ? 'Loading...' : 'Begin Lesson'}
            </button>
          </div>
        </div>
      )}

      {/* Main Card Container */}
      <div className="w-full max-w-6xl h-[700px] bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 flex flex-col lg:flex-row overflow-hidden relative z-10 transition-all">

        {/* LEFT: Visual Stage */}
        <div className="relative w-full lg:w-2/3 h-[45%] lg:h-full bg-slate-900 flex items-center justify-center p-6 group">
          {/* Subtle Grid Pattern Background */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

          {/* Vignette for depth */}
          <div className="absolute inset-0 bg-radial-at-c from-transparent to-slate-900/50 pointer-events-none" />

          {currentSegment.imageUrl ? (
            <img
              key={currentIndex}
              src={currentSegment.imageUrl}
              alt={currentSegment.imagePrompt}
              className="relative z-10 max-h-full max-w-full object-contain animate-fade-in shadow-2xl drop-shadow-2xl rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 z-10">
              <RefreshCw className="mb-4 h-10 w-10 animate-spin opacity-50" />
              <p className="font-medium tracking-wide">Rendering Visualization...</p>
            </div>
          )}

          {/* Visual Controls Overlay (Visible on hover) */}
          <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-slate-800/80 backdrop-blur-md rounded-full px-3 py-1 text-xs font-medium text-white/70 border border-white/10 shadow-lg">
              Gemini Visualization
            </div>
          </div>
        </div>

        {/* RIGHT: Control Hub */}
        <div className="w-full lg:w-1/3 h-[55%] lg:h-full bg-slate-950/50 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col">

          {/* Progress Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                {currentIndex + 1}
              </span>
              <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                Step {currentIndex + 1} of {data.segments.length}
              </span>
            </div>
            {data.title && (
              <div className="text-xs text-slate-500 hidden md:block">
                {data.title}
              </div>
            )}
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar">
            <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4 leading-tight">
              {currentSegment.title}
            </h2>

            <div className="prose prose-invert prose-lg">
              <p className="text-slate-300 leading-relaxed">
                {currentSegment.script}
              </p>
            </div>

            {/* Knowledge Check UI */}
            {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'answering' && (
              <div className="mt-6 p-6 bg-slate-800/50 rounded-xl border border-blue-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 font-bold">{currentIndex + 1}</span>
                  </div>
                  <h4 className="text-lg font-semibold text-white">Knowledge Check</h4>
                </div>

                <p className="text-slate-200 mb-4">{currentSegment.knowledgeCheck.question}</p>

                <div className="space-y-2">
                  {currentSegment.knowledgeCheck.options.map((option, optionIndex) => (
                    <button
                      key={optionIndex}
                      onClick={() => setSelectedAnswers({ ...selectedAnswers, [currentIndex]: optionIndex })}
                      className={`w-full text-left p-4 rounded-lg transition-all ${
                        selectedAnswers[currentIndex] === optionIndex
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                          : 'bg-slate-700/50 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 h-6 w-6 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        <span>{option}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleAnswerSubmit(currentIndex)}
                  disabled={selectedAnswers[currentIndex] === undefined}
                  className="mt-4 w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Submit Answer
                </button>

                {/* Error Feedback */}
                {feedback[currentIndex] && (
                  <div className="mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{feedback[currentIndex]}</p>
                    </div>
                    <p className="text-slate-400 text-xs mt-2">
                      Attempt {segmentAttempts[currentIndex] || 0} of {MAX_ATTEMPTS_PER_SEGMENT}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Success Feedback */}
            {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'completed' && (
              <div className="mt-6 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  <h4 className="font-semibold text-emerald-400">Correct!</h4>
                </div>
                {currentSegment.knowledgeCheck.explanation && (
                  <p className="text-slate-300 text-sm">{currentSegment.knowledgeCheck.explanation}</p>
                )}
              </div>
            )}

            {/* Max Attempts Reached - Show Answer */}
            {currentSegment.knowledgeCheck && segmentPhases[currentIndex] === 'max-attempts-reached' && (
              <div className="mt-6 p-6 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  <h4 className="font-semibold text-amber-400">Maximum Attempts Reached</h4>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  The correct answer is:{' '}
                  <strong className="text-white">
                    {currentSegment.knowledgeCheck.options[currentSegment.knowledgeCheck.correctOptionIndex]}
                  </strong>
                </p>
                {currentSegment.knowledgeCheck.explanation && (
                  <p className="text-slate-400 text-sm mb-4 italic">
                    {currentSegment.knowledgeCheck.explanation}
                  </p>
                )}
                <button
                  onClick={() => handleSkipAfterMaxAttempts(currentIndex)}
                  className="w-full py-3 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all"
                >
                  {currentIndex < data.segments.length - 1 ? 'Continue to Next Segment' : 'Complete Lesson'}
                </button>
              </div>
            )}
          </div>

          {/* Bottom Controls Area */}
          <div className="p-6 lg:p-8 bg-slate-900/50 border-t border-white/5 space-y-6">

            {/* Scrubbing Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <Volume2 className="h-3 w-3" />
                  {isLoadingAudio ? 'Loading Audio...' : 'Audio Playback'}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ease-linear ${isFinished ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={handlePlayPause}
                  disabled={!audioBuffer || isLoadingAudio}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-all ring-1 ring-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleReplay}
                  disabled={!audioBuffer || isLoadingAudio}
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all ring-1 ring-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Replay"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="h-12 w-12 flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-500 disabled:opacity-30 hover:text-white transition-all disabled:cursor-not-allowed"
                  title="Previous"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  onClick={handleNext}
                  disabled={
                    currentIndex >= data.segments.length - 1 ||
                    (currentSegment.knowledgeCheck && !segmentAnswered[currentIndex])
                  }
                  className={`h-12 px-6 flex items-center gap-2 rounded-xl font-semibold transition-all transform active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${
                    segmentAnswered[currentIndex] || !currentSegment.knowledgeCheck
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                  title={
                    currentSegment.knowledgeCheck && !segmentAnswered[currentIndex]
                      ? 'Complete knowledge check to continue'
                      : 'Next'
                  }
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MediaPlayer;
