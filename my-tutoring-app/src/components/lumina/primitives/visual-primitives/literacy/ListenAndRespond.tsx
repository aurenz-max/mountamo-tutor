'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { ListenAndRespondMetrics } from '../../../evaluation/types';
import { base64ToAudioBuffer, getAudioContext } from '../../../utils/audioUtils';

// =============================================================================
// Data Interface
// =============================================================================

export interface ListenAndRespondData {
  title: string;
  gradeLevel: string;
  passageType: 'narrative' | 'informational' | 'persuasive' | 'dialogue';

  // The passage (hidden from student during listening, revealed after)
  passage: {
    text: string;
    wordCount: number;
    estimatedDurationSeconds: number;
    audioBase64?: string; // Gemini TTS audio (base64 PCM, 24kHz, 16-bit)
  };

  // Comprehension questions
  questions: Array<{
    id: string;
    question: string;
    type: 'multiple-choice' | 'short-answer' | 'sequencing';
    options?: string[];         // For multiple-choice
    correctAnswer: string;      // For MC: the correct option text; for short-answer: expected answer
    correctSequence?: string[]; // For sequencing type
    difficulty: 'literal' | 'inferential' | 'evaluative';
    explanation: string;
  }>;

  // Segment markers for replay
  segments?: Array<{
    id: string;
    startWord: number;      // Word index where segment starts
    endWord: number;         // Word index where segment ends
    label: string;           // e.g., "Part 1: Introduction"
    audioBase64?: string;    // Gemini TTS audio for this segment
  }>;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: unknown) => void;
}

// =============================================================================
// Types
// =============================================================================

type Phase = 'listen' | 'respond' | 'review';

interface QuestionAnswer {
  questionId: string;
  answer: string;
  answeredBeforeReplay: boolean;
}

// =============================================================================
// Audio Wave Visualization
// =============================================================================

function AudioWaveVisualization({ isPlaying, barCount = 7 }: { isPlaying: boolean; barCount?: number }) {
  return (
    <div className="flex items-end justify-center gap-1 h-16">
      {Array.from({ length: barCount }).map((_, i) => {
        const baseHeight = [40, 60, 80, 100, 70, 55, 45][i % 7];
        return (
          <div
            key={i}
            className="w-2 rounded-full transition-all duration-150"
            style={{
              height: isPlaying ? `${baseHeight}%` : '20%',
              backgroundColor: isPlaying
                ? `rgba(168, 85, 247, ${0.5 + (i % 3) * 0.15})`
                : 'rgba(148, 163, 184, 0.3)',
              animation: isPlaying
                ? `listenWave 0.8s ease-in-out ${i * 0.1}s infinite alternate`
                : 'none',
            }}
          />
        );
      })}
      <style>{`
        @keyframes listenWave {
          0% { transform: scaleY(0.5); }
          50% { transform: scaleY(1.2); }
          100% { transform: scaleY(0.7); }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// Progress Bar
// =============================================================================

function PlaybackProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-100"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}

// =============================================================================
// Speed Control
// =============================================================================

function SpeedControl({
  speed,
  onSpeedChange,
  disabled,
}: {
  speed: number;
  onSpeedChange: (s: number) => void;
  disabled: boolean;
}) {
  const speeds = [0.75, 1.0, 1.25];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400">Speed:</span>
      <div className="flex gap-1">
        {speeds.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={`px-2 py-1 text-xs rounded ${
              speed === s
                ? 'bg-purple-500/30 border border-purple-400/40 text-purple-200'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10'
            }`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </Button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Listen Phase
// =============================================================================

function ListenPhase({
  data,
  isPlaying,
  playbackProgress,
  speed,
  audioDuration,
  isLoading,
  hasAudio,
  onPlay,
  onPause,
  onSpeedChange,
  onFinishListening,
  hasListened,
}: {
  data: ListenAndRespondData;
  isPlaying: boolean;
  playbackProgress: number;
  speed: number;
  audioDuration: number;
  isLoading: boolean;
  hasAudio: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSpeedChange: (s: number) => void;
  onFinishListening: () => void;
  hasListened: boolean;
}) {
  const currentTime = (audioDuration * playbackProgress) / 100;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Title area */}
      <div className="text-center space-y-2">
        <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
          Phase 1: Listen
        </Badge>
        <p className="text-slate-300 text-sm max-w-md">
          Listen carefully to the passage. The text is hidden &mdash; focus on what you hear!
        </p>
      </div>

      {/* Passage type badge */}
      <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">
        {data.passageType} passage &middot; ~{data.passage.wordCount} words
      </Badge>

      {/* Audio visualization area */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 w-full max-w-md">
        <CardContent className="py-8 flex flex-col items-center gap-6">
          {/* Loading state */}
          {isLoading && (
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Preparing audio...</p>
            </div>
          )}

          {/* No audio fallback */}
          {!isLoading && !hasAudio && (
            <div className="text-center space-y-2 py-4">
              <p className="text-sm text-amber-300">Audio is being generated...</p>
              <p className="text-xs text-slate-500">The passage audio will play when ready.</p>
            </div>
          )}

          {/* Waveform */}
          {!isLoading && hasAudio && (
            <>
              <AudioWaveVisualization isPlaying={isPlaying} />

              {/* Play/Pause button */}
              <button
                onClick={isPlaying ? onPause : onPlay}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isPlaying
                    ? 'bg-purple-500/30 border-2 border-purple-400/40 hover:bg-purple-500/40'
                    : hasListened
                    ? 'bg-white/10 border-2 border-white/20 hover:bg-white/15 hover:scale-105'
                    : 'bg-purple-500/20 border-2 border-purple-400/40 hover:bg-purple-500/30 hover:scale-105 animate-pulse'
                }`}
              >
                {isPlaying ? (
                  <div className="flex gap-1">
                    <div className="w-1.5 h-6 bg-purple-300 rounded-full" />
                    <div className="w-1.5 h-6 bg-purple-300 rounded-full" />
                  </div>
                ) : (
                  <svg
                    className="w-8 h-8 text-purple-300 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Progress bar */}
              <div className="w-full px-4 space-y-2">
                <PlaybackProgressBar progress={playbackProgress} />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>
                    {isPlaying ? 'Listening...' : hasListened ? 'Finished' : 'Ready'}
                  </span>
                  <span>
                    {Math.round(currentTime)}s / {Math.round(audioDuration)}s
                  </span>
                </div>
              </div>

              {/* Speed control */}
              <SpeedControl speed={speed} onSpeedChange={onSpeedChange} disabled={isPlaying} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Continue button */}
      {hasListened && !isPlaying && (
        <Button
          onClick={onFinishListening}
          className="bg-purple-500/20 border border-purple-400/30 text-purple-200 hover:bg-purple-500/30"
        >
          Continue to Questions
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Respond Phase
// =============================================================================

function RespondPhase({
  data,
  currentQuestionIndex,
  answers,
  onAnswer,
  onNext,
  onSubmitAll,
}: {
  data: ListenAndRespondData;
  currentQuestionIndex: number;
  answers: Map<string, QuestionAnswer>;
  onAnswer: (questionId: string, answer: string) => void;
  onNext: () => void;
  onSubmitAll: () => void;
}) {
  const question = data.questions[currentQuestionIndex];
  const currentAnswer = answers.get(question.id);
  const isLast = currentQuestionIndex === data.questions.length - 1;
  const allAnswered = data.questions.every((q) => answers.has(q.id) && answers.get(q.id)!.answer.trim() !== '');

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Phase header */}
      <div className="text-center space-y-2">
        <Badge className="bg-blue-500/20 text-blue-300 border-blue-400/30">
          Phase 2: Respond
        </Badge>
        <p className="text-slate-300 text-sm">
          Answer from memory &mdash; no replay yet!
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {data.questions.map((q, i) => (
          <div
            key={q.id}
            className={`w-3 h-3 rounded-full transition-all ${
              i === currentQuestionIndex
                ? 'bg-blue-400 scale-125'
                : answers.has(q.id)
                ? 'bg-emerald-400/60'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      {/* Question card */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 w-full max-w-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100 text-base">
              Question {currentQuestionIndex + 1} of {data.questions.length}
            </CardTitle>
            <Badge
              variant="outline"
              className={`text-xs border-white/20 ${
                question.difficulty === 'literal'
                  ? 'text-emerald-400'
                  : question.difficulty === 'inferential'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {question.difficulty}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-200 text-sm leading-relaxed">{question.question}</p>

          {/* Multiple choice options */}
          {question.type === 'multiple-choice' && question.options && (
            <div className="space-y-2">
              {question.options.map((option, i) => {
                const isSelected = currentAnswer?.answer === option;
                return (
                  <Button
                    key={i}
                    variant="ghost"
                    className={`w-full justify-start text-left px-4 py-3 h-auto whitespace-normal transition-all ${
                      isSelected
                        ? 'bg-blue-500/20 border border-blue-400/40 text-blue-200'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    onClick={() => onAnswer(question.id, option)}
                  >
                    <span className="mr-3 text-xs font-semibold text-slate-500">
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {option}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Short answer input */}
          {question.type === 'short-answer' && (
            <textarea
              className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-slate-200 text-sm placeholder-slate-500 focus:border-blue-400/40 focus:outline-none focus:ring-1 focus:ring-blue-400/20 resize-none"
              rows={3}
              placeholder="Type your answer here..."
              value={currentAnswer?.answer || ''}
              onChange={(e) => onAnswer(question.id, e.target.value)}
            />
          )}

          {/* Sequencing type (rendered as ordering) */}
          {question.type === 'sequencing' && question.options && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Select the options in the correct order:
              </p>
              {question.options.map((option, i) => {
                const currentSeq = currentAnswer?.answer ? currentAnswer.answer.split('|||') : [];
                const orderIndex = currentSeq.indexOf(option);
                const isSelected = orderIndex >= 0;
                return (
                  <Button
                    key={i}
                    variant="ghost"
                    className={`w-full justify-start text-left px-4 py-3 h-auto whitespace-normal transition-all ${
                      isSelected
                        ? 'bg-blue-500/20 border border-blue-400/40 text-blue-200'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                    onClick={() => {
                      const seq = currentAnswer?.answer ? currentAnswer.answer.split('|||') : [];
                      if (isSelected) {
                        const filtered = seq.slice(0, orderIndex);
                        onAnswer(question.id, filtered.join('|||'));
                      } else {
                        seq.push(option);
                        onAnswer(question.id, seq.join('|||'));
                      }
                    }}
                  >
                    {isSelected && (
                      <span className="mr-3 w-6 h-6 rounded-full bg-blue-500/40 flex items-center justify-center text-xs font-bold text-blue-200 flex-shrink-0">
                        {orderIndex + 1}
                      </span>
                    )}
                    {!isSelected && (
                      <span className="mr-3 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-500 flex-shrink-0">
                        &ndash;
                      </span>
                    )}
                    <span>{option}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3">
        {!isLast && (
          <Button
            onClick={onNext}
            disabled={!currentAnswer || currentAnswer.answer.trim() === ''}
            className="bg-white/5 border border-white/20 text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            Next Question
          </Button>
        )}
        {isLast && (
          <Button
            onClick={onSubmitAll}
            disabled={!allAnswered}
            className="bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/30 disabled:opacity-40"
          >
            Submit Answers
          </Button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Review Phase
// =============================================================================

function ReviewPhase({
  data,
  answers,
  onReplaySegment,
  isReplayPlaying,
  replayProgress,
}: {
  data: ListenAndRespondData;
  answers: Map<string, QuestionAnswer>;
  onReplaySegment: (segmentId: string) => void;
  isReplayPlaying: boolean;
  replayProgress: number;
}) {
  const getIsCorrect = (q: ListenAndRespondData['questions'][number]): boolean => {
    const a = answers.get(q.id);
    if (!a) return false;

    if (q.type === 'multiple-choice') {
      return a.answer === q.correctAnswer;
    }
    if (q.type === 'sequencing' && q.correctSequence) {
      const studentSeq = a.answer.split('|||');
      return (
        studentSeq.length === q.correctSequence.length &&
        studentSeq.every((s, i) => s === q.correctSequence![i])
      );
    }
    // short-answer: simple case-insensitive partial match
    return a.answer.trim().toLowerCase().includes(q.correctAnswer.trim().toLowerCase());
  };

  const correctCount = data.questions.filter(getIsCorrect).length;
  const score = Math.round((correctCount / data.questions.length) * 100);

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Phase header */}
      <div className="text-center space-y-2">
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30">
          Phase 3: Review
        </Badge>
        <p className="text-slate-300 text-sm">
          Review your answers and replay specific parts of the passage.
        </p>
      </div>

      {/* Score */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardContent className="py-4 text-center">
          <div className="text-3xl font-bold text-slate-100">{score}%</div>
          <div className="text-sm text-slate-400 mt-1">
            {correctCount} of {data.questions.length} correct
          </div>
        </CardContent>
      </Card>

      {/* Segment replay */}
      {data.segments && data.segments.length > 0 && (
        <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-slate-100 text-sm">Replay Segments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isReplayPlaying && (
              <div className="mb-2">
                <PlaybackProgressBar progress={replayProgress} />
                <AudioWaveVisualization isPlaying={true} barCount={5} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {data.segments.map((seg) => (
                <Button
                  key={seg.id}
                  variant="ghost"
                  size="sm"
                  disabled={isReplayPlaying || !seg.audioBase64}
                  className="bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 text-xs disabled:opacity-40"
                  onClick={() => onReplaySegment(seg.id)}
                >
                  <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  {seg.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Question review */}
      <div className="space-y-3">
        {data.questions.map((q, i) => {
          const answer = answers.get(q.id);
          const isCorrect = getIsCorrect(q);
          return (
            <Card
              key={q.id}
              className={`backdrop-blur-xl border ${
                isCorrect
                  ? 'bg-emerald-900/20 border-emerald-500/20'
                  : 'bg-rose-900/20 border-rose-500/20'
              }`}
            >
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-200">
                    <span className="font-semibold">Q{i + 1}:</span> {q.question}
                  </p>
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect
                        ? 'bg-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/30 text-rose-300'
                    }`}
                  >
                    {isCorrect ? '\u2713' : '\u2717'}
                  </div>
                </div>

                {/* Student answer */}
                <div className="text-xs space-y-1">
                  <p className="text-slate-400">
                    <span className="font-medium">Your answer:</span>{' '}
                    <span className={isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                      {q.type === 'sequencing'
                        ? (answer?.answer || '').split('|||').join(' -> ')
                        : answer?.answer || '(no answer)'}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-slate-400">
                      <span className="font-medium">Correct answer:</span>{' '}
                      <span className="text-emerald-300">
                        {q.type === 'sequencing' && q.correctSequence
                          ? q.correctSequence.join(' -> ')
                          : q.correctAnswer}
                      </span>
                    </p>
                  )}
                  <p className="text-slate-500 italic mt-1">{q.explanation}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revealed passage */}
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-sm">Passage Text (Revealed)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
            {data.passage.text}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

function ListenAndRespond({ data }: { data: ListenAndRespondData }) {
  // ---------------------------------------------------------------------------
  // Evaluation hook
  // ---------------------------------------------------------------------------
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<ListenAndRespondMetrics>({
    primitiveType: 'listen-and-respond',
    instanceId: data.instanceId || 'listen-and-respond-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [phase, setPhase] = useState<Phase>('listen');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [hasListened, setHasListened] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuestionAnswer>>(new Map());
  const [replaysUsed, setReplaysUsed] = useState(0);
  const [isReplayPlaying, setIsReplayPlaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [listeningDurationSeconds, setListeningDurationSeconds] = useState(0);

  // Audio state
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [passageAudioBuffer, setPassageAudioBuffer] = useState<AudioBuffer | null>(null);
  const [segmentAudioBuffers, setSegmentAudioBuffers] = useState<Map<string, AudioBuffer>>(new Map());

  // Audio playback refs
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const audioPausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Decode audio buffers on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const decodeAudio = async () => {
      if (!data.passage.audioBase64) return;

      setIsLoadingAudio(true);
      try {
        // Decode main passage audio
        const buffer = await base64ToAudioBuffer(data.passage.audioBase64);
        if (!cancelled) {
          setPassageAudioBuffer(buffer);
        }

        // Decode segment audio
        if (data.segments) {
          const segBuffers = new Map<string, AudioBuffer>();
          for (const seg of data.segments) {
            if (seg.audioBase64 && !cancelled) {
              try {
                const segBuffer = await base64ToAudioBuffer(seg.audioBase64);
                segBuffers.set(seg.id, segBuffer);
              } catch (err) {
                console.warn(`Failed to decode audio for segment ${seg.id}:`, err);
              }
            }
          }
          if (!cancelled) {
            setSegmentAudioBuffers(segBuffers);
          }
        }
      } catch (err) {
        console.error('Failed to decode passage audio:', err);
      } finally {
        if (!cancelled) {
          setIsLoadingAudio(false);
        }
      }
    };

    decodeAudio();

    return () => {
      cancelled = true;
    };
  }, [data.passage.audioBase64, data.segments]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch { /* already stopped */ }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Audio playback helpers
  // ---------------------------------------------------------------------------

  const stopCurrentAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch { /* already stopped */ }
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const playAudioBuffer = useCallback((
    buffer: AudioBuffer,
    onProgress: (progress: number) => void,
    onEnd: () => void,
    playbackRate: number = 1.0,
    startOffset: number = 0,
  ) => {
    const audioContext = getAudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(audioContext.destination);

    audioSourceRef.current = source;
    audioStartTimeRef.current = audioContext.currentTime - startOffset;

    // Progress tracking via requestAnimationFrame (same as MediaPlayer)
    const updateProgress = () => {
      if (!audioSourceRef.current) return;
      const elapsed = (audioContext.currentTime - audioStartTimeRef.current) * playbackRate;
      const duration = buffer.duration;
      const progress = Math.min(100, (elapsed / duration) * 100);
      onProgress(progress);

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    source.onended = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      onProgress(100);
      onEnd();
    };

    source.start(0, startOffset);
    animationFrameRef.current = requestAnimationFrame(updateProgress);

    return source;
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePlay = useCallback(() => {
    if (isPlaying || !passageAudioBuffer) return;

    setIsPlaying(true);
    const startOffset = audioPausedAtRef.current;

    playAudioBuffer(
      passageAudioBuffer,
      (progress) => setPlaybackProgress(progress),
      () => {
        setIsPlaying(false);
        setPlaybackProgress(100);
        setHasListened(true);
        audioPausedAtRef.current = 0;
        setListeningDurationSeconds(Math.round(passageAudioBuffer.duration));
      },
      speed,
      startOffset,
    );
  }, [isPlaying, passageAudioBuffer, speed, playAudioBuffer]);

  const handlePause = useCallback(() => {
    if (!isPlaying || !audioSourceRef.current) return;

    const audioContext = getAudioContext();
    const elapsed = audioContext.currentTime - audioStartTimeRef.current;
    audioPausedAtRef.current = elapsed;

    stopCurrentAudio();
    setIsPlaying(false);
  }, [isPlaying, stopCurrentAudio]);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
  }, []);

  const handleFinishListening = useCallback(() => {
    setPhase('respond');
  }, []);

  const handleAnswer = useCallback(
    (questionId: string, answer: string) => {
      setAnswers((prev) => {
        const next = new Map(prev);
        next.set(questionId, {
          questionId,
          answer,
          answeredBeforeReplay: replaysUsed === 0,
        });
        return next;
      });
    },
    [replaysUsed]
  );

  const handleNextQuestion = useCallback(() => {
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, data.questions.length - 1));
  }, [data.questions.length]);

  const getIsCorrect = useCallback(
    (q: ListenAndRespondData['questions'][number]): boolean => {
      const a = answers.get(q.id);
      if (!a) return false;
      if (q.type === 'multiple-choice') return a.answer === q.correctAnswer;
      if (q.type === 'sequencing' && q.correctSequence) {
        const studentSeq = a.answer.split('|||');
        return (
          studentSeq.length === q.correctSequence.length &&
          studentSeq.every((s, i) => s === q.correctSequence![i])
        );
      }
      return a.answer.trim().toLowerCase().includes(q.correctAnswer.trim().toLowerCase());
    },
    [answers]
  );

  const handleSubmitAll = useCallback(() => {
    const correctCount = data.questions.filter(getIsCorrect).length;
    const score = Math.round((correctCount / data.questions.length) * 100);
    const answeredBeforeReplayCount = Array.from(answers.values()).filter(
      (a) => a.answeredBeforeReplay
    ).length;

    const questionResults = data.questions.map((q) => {
      const a = answers.get(q.id);
      return {
        questionId: q.id,
        difficulty: q.difficulty,
        isCorrect: getIsCorrect(q),
        answeredBeforeReplay: a?.answeredBeforeReplay ?? true,
      };
    });

    if (!hasSubmitted) {
      submitResult(
        score >= 60,
        score,
        {
          type: 'listen-and-respond',
          questionsCorrect: correctCount,
          questionsTotal: data.questions.length,
          replaysUsed,
          answeredBeforeReplay: answeredBeforeReplayCount,
          passageType: data.passageType,
          listeningDurationSeconds,
          speedUsed: speed,
          questionResults,
          listenPhaseCompleted: true,
          respondPhaseCompleted: true,
          reviewPhaseCompleted: false,
          accuracy: score,
          attemptsCount: 1,
        },
        {
          answers: Array.from(answers.entries()).map(([id, a]) => ({
            questionId: id,
            answer: a.answer,
          })),
        }
      );
    }

    setPhase('review');
  }, [
    data,
    answers,
    getIsCorrect,
    hasSubmitted,
    submitResult,
    replaysUsed,
    listeningDurationSeconds,
    speed,
  ]);

  const handleReplaySegment = useCallback(
    (segmentId: string) => {
      if (isReplayPlaying) return;

      const segmentBuffer = segmentAudioBuffers.get(segmentId);
      if (!segmentBuffer) return;

      setReplaysUsed((prev) => prev + 1);
      setIsReplayPlaying(true);
      setReplayProgress(0);

      playAudioBuffer(
        segmentBuffer,
        (progress) => setReplayProgress(progress),
        () => {
          setIsReplayPlaying(false);
          setReplayProgress(0);
        },
        speed,
      );
    },
    [isReplayPlaying, segmentAudioBuffers, speed, playAudioBuffer]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const audioDuration = passageAudioBuffer ? passageAudioBuffer.duration / speed : data.passage.estimatedDurationSeconds;

  return (
    <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{data.title}</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="border-white/20 text-slate-400 text-xs">
              {data.gradeLevel}
            </Badge>
            <Badge
              className={`text-xs ${
                phase === 'listen'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                  : phase === 'respond'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              }`}
            >
              {phase === 'listen' ? 'Listen' : phase === 'respond' ? 'Respond' : 'Review'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {phase === 'listen' && (
          <ListenPhase
            data={data}
            isPlaying={isPlaying}
            playbackProgress={playbackProgress}
            speed={speed}
            audioDuration={audioDuration}
            isLoading={isLoadingAudio}
            hasAudio={!!passageAudioBuffer}
            onPlay={handlePlay}
            onPause={handlePause}
            onSpeedChange={handleSpeedChange}
            onFinishListening={handleFinishListening}
            hasListened={hasListened}
          />
        )}
        {phase === 'respond' && (
          <RespondPhase
            data={data}
            currentQuestionIndex={currentQuestionIndex}
            answers={answers}
            onAnswer={handleAnswer}
            onNext={handleNextQuestion}
            onSubmitAll={handleSubmitAll}
          />
        )}
        {phase === 'review' && (
          <ReviewPhase
            data={data}
            answers={answers}
            onReplaySegment={handleReplaySegment}
            isReplayPlaying={isReplayPlaying}
            replayProgress={replayProgress}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default ListenAndRespond;
