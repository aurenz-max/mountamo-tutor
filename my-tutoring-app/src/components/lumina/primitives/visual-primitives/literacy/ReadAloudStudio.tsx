'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaActionButton,
  LuminaPanel,
  LuminaCallout,
  LuminaStat,
  LuminaFeedbackCard,
  answerStateClasses,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ReadAloudStudioMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ExpressionMarker {
  type: 'pause' | 'emphasis' | 'question' | 'exclamation' | 'slow';
  wordIndex: number;            // Index into the words array
  label: string;                // Display label
}

export interface ReadAloudStudioData {
  title: string;
  gradeLevel: string;
  /** Which fluency sub-skill this passage targets (eval mode). Optional / back-compatible —
   *  the interaction is identical across foci; only the passage content & markers vary. */
  fluencyFocus?: 'accuracy' | 'expression' | 'dialogue';
  passage: string;
  passageWords: string[];             // Words of the passage for word-level tracking
  targetWPM: number;                  // Target words per minute for this grade
  lexileLevel: string;                // e.g. "520L"
  expressionMarkers: ExpressionMarker[];
  comprehensionQuestion?: string;     // Optional post-reading question
  comprehensionAnswer?: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReadAloudStudioMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface ReadAloudStudioProps {
  data: ReadAloudStudioData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type StudioPhase = 'listen' | 'practice' | 'record' | 'review';

// ============================================================================
// Component
// ============================================================================

const ReadAloudStudio: React.FC<ReadAloudStudioProps> = ({ data, className }) => {
  const {
    title, gradeLevel, passage, passageWords, targetWPM, lexileLevel, expressionMarkers,
    comprehensionQuestion, comprehensionAnswer,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId || `read-aloud-studio-${Date.now()}`;

  const [currentPhase, setCurrentPhase] = useState<StudioPhase>('listen');
  const [modelListened, setModelListened] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  // Bounded by the start/end timestamps of the most recent "Play Model" trigger.
  // Used to slice transcript chunks from `conversation` for the karaoke view.
  const [readSession, setReadSession] = useState<{ start: number; end: number | null }>({ start: 0, end: null });
  const [recordingMade, setRecordingMade] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [comparisonUsed, setComparisonUsed] = useState(false);
  const [selfAssessment, setSelfAssessment] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ReadAloudStudioMetrics>({
    primitiveType: 'read-aloud-studio',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Calculate WPM
  const estimatedWPM = recordingDuration > 0 ? Math.round(passageWords.length / (recordingDuration / 60)) : 0;

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    gradeLevel,
    lexileLevel,
    targetWPM,
    currentPhase,
    modelListened,
    recordingMade,
    estimatedWPM,
    selfAssessment: selfAssessment ?? 0,
    comparisonUsed,
    passageWordCount: passageWords.length,
  }), [
    title, gradeLevel, lexileLevel, targetWPM,
    currentPhase, modelListened, recordingMade,
    estimatedWPM, selfAssessment, comparisonUsed,
    passageWords.length,
  ]);

  const { sendText, isConnected, conversation } = useLuminaAI({
    primitiveType: 'read-aloud-studio',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Transcript chunks streamed back from the live tutor during the current read-aloud.
  // Bounded by readSession to exclude unrelated assistant messages (e.g. activity intro,
  // phase-transition encouragements). We trust the transcript instead of the static
  // passage so what's on screen matches what was actually spoken.
  const liveTranscriptChunks = useMemo(() => {
    if (readSession.start === 0) return [];
    return conversation.filter(m =>
      m.role === 'assistant' &&
      m.isAudio === true &&
      m.timestamp >= readSession.start &&
      (readSession.end === null || m.timestamp <= readSession.end)
    );
  }, [conversation, readSession]);

  // End-of-read detection by chunk idleness: when no new transcript chunks arrive
  // for ~2s during an active read, the AI is done speaking. We don't use
  // isAIResponding here because the context only flips it true on NON-silent
  // sendText, and we use { silent: true } to keep the prompt out of the chat log.
  useEffect(() => {
    if (!isPlaying || liveTranscriptChunks.length === 0) return;
    const timer = setTimeout(() => {
      setIsPlaying(false);
      setModelListened(true);
      setReadSession(prev => ({ ...prev, end: Date.now() }));
      sendText(
        `[MODEL_LISTENED] The student finished listening to the model reading of "${title}". `
        + `Encourage them to move to the Practice phase to try reading along with expression markers. One sentence.`,
        { silent: true }
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [isPlaying, liveTranscriptChunks.length, sendText, title]);

  // ---------------------------------------------------------------------------
  // Activity introduction — fire once when the AI tutor connects
  // ---------------------------------------------------------------------------
  const hasIntroducedRef = useRef(false);

  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a read-aloud fluency session for Grade ${gradeLevel}. `
      + `Passage: "${title}" (Lexile ${lexileLevel}, ${passageWords.length} words, target ${targetWPM} WPM). `
      + `Introduce the session warmly: mention we'll listen to a model reading first, then practice, `
      + `then record our own reading. Encourage the student to listen carefully. Keep it brief (2-3 sentences).`,
      { silent: true }
    );
  }, [isConnected, gradeLevel, title, lexileLevel, passageWords.length, targetWPM, sendText]);

  // Phases
  const phases: StudioPhase[] = ['listen', 'practice', 'record', 'review'];
  const phaseLabels: Record<StudioPhase, string> = { listen: 'Listen', practice: 'Practice', record: 'Record', review: 'Review' };

  const nextPhase = useCallback(() => {
    const idx = phases.indexOf(currentPhase);
    if (idx >= phases.length - 1) return;
    const next = phases[idx + 1];
    SoundManager.navigate();
    setCurrentPhase(next);

    // Pedagogical speech triggers for phase transitions
    if (next === 'practice') {
      sendText(
        `[PHASE_TO_PRACTICE] The student finished listening to the model and is now in the Practice phase. `
        + `The passage has expression markers (pauses and emphasis). `
        + `Briefly encourage them to practice reading along, paying attention to expression. One sentence.`,
        { silent: true }
      );
    } else if (next === 'record') {
      sendText(
        `[PHASE_TO_RECORD] The student is now in the Record phase. `
        + `They will record themselves reading the passage (target: ${targetWPM} WPM). `
        + `Briefly encourage them to read at a comfortable pace. One sentence.`,
        { silent: true }
      );
    } else if (next === 'review') {
      sendText(
        `[PHASE_TO_REVIEW] The student finished recording and is now reviewing their performance. `
        + `They read at ${estimatedWPM} WPM (target: ${targetWPM} WPM). `
        + `${comparisonUsed ? 'They compared their recording to the model. ' : ''}`
        + `Comment briefly on their WPM relative to the target—be encouraging regardless. One sentence.`,
        { silent: true }
      );
    }
  }, [currentPhase, phases, sendText, targetWPM, estimatedWPM, comparisonUsed]);

  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx - 1]);
    }
  };

  // Trigger the AI tutor to read the passage aloud. The on-screen text is driven
  // by the transcript chunks that stream back (see liveTranscriptChunks), not by a
  // local timer, so the displayed words always match what the audio actually said.
  const playModel = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    setReadSession({ start: Date.now(), end: null });

    sendText(
      `[READ_PASSAGE] Read this passage aloud with clear expression at about ${Math.round(targetWPM * playbackSpeed)} WPM. `
      + `Pause briefly at | marks, emphasize bold words. Here is the passage:\n\n${passage}`,
      { silent: true }
    );
  }, [isPlaying, targetWPM, playbackSpeed, passage, sendText]);

  // Simulate recording
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingStartTime(Date.now());
  }, []);

  const stopRecording = useCallback(() => {
    if (!recordingStartTime) return;
    const duration = (Date.now() - recordingStartTime) / 1000;
    const wpm = duration > 0 ? Math.round(passageWords.length / (duration / 60)) : 0;
    setIsRecording(false);
    setRecordingDuration(duration);
    setRecordingMade(true);
    setRecordingStartTime(null);

    // Trigger AI speech after recording completes
    sendText(
      `[RECORDING_COMPLETE] The student finished recording. Duration: ${duration.toFixed(1)}s, `
      + `estimated ${wpm} WPM (target: ${targetWPM} WPM). `
      + `${Math.abs(wpm - targetWPM) < 20
        ? 'They are close to the target! Celebrate briefly.'
        : wpm > targetWPM
          ? 'They read faster than the target. Gently suggest slowing down for expression.'
          : 'They read slower than the target. Encourage them—fluency builds with practice.'} `
      + `Also suggest they try the "Compare with Model" button. Keep it to 1-2 sentences.`,
      { silent: true }
    );
  }, [recordingStartTime, passageWords.length, targetWPM, sendText]);

  // Handle comparison
  const handleComparison = useCallback(() => {
    setComparisonUsed(true);
    sendText(
      `[COMPARISON_USED] The student is comparing their recording side-by-side with the model reading. `
      + `Encourage them to listen for differences in pacing and expression. One sentence.`,
      { silent: true }
    );
  }, [sendText]);

  // Handle self-assessment
  const handleSelfAssessment = useCallback((rating: number) => {
    SoundManager.select();
    setSelfAssessment(rating);
    sendText(
      `[SELF_ASSESSMENT] The student rated their reading ${rating}/5. `
      + `${rating >= 4
        ? 'They feel confident! Affirm their self-awareness and encourage them to submit.'
        : rating >= 3
          ? 'They feel okay about it. Encourage them—practice makes progress. Suggest submitting.'
          : 'They feel their reading needs work. Be extra encouraging—every reading improves fluency. Suggest submitting.'} `
      + `One sentence.`,
      { silent: true }
    );
  }, [sendText]);

  // Submit evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const score = (modelListened ? 25 : 0) +
      (recordingMade ? 30 : 0) +
      (selfAssessment ? 20 : 0) +
      (comparisonUsed ? 10 : 0) +
      (estimatedWPM > 0 && Math.abs(estimatedWPM - targetWPM) < 30 ? 15 : estimatedWPM > 0 ? 8 : 0);

    const metrics: ReadAloudStudioMetrics = {
      type: 'read-aloud-studio',
      modelListened,
      studentRecordingMade: recordingMade,
      recordingDurationSeconds: recordingDuration,
      estimatedWPM,
      comparisonUsed,
      selfAssessmentRating: selfAssessment || 0,
      passageLexileLevel: lexileLevel,
    };

    submitEvaluation(score >= 50, score, metrics, { selfAssessment, estimatedWPM });

    // Celebrate session completion
    sendText(
      `[SESSION_COMPLETE] The student finished the read-aloud session for "${title}"! `
      + `Final stats: ${estimatedWPM} WPM (target: ${targetWPM}), self-assessment: ${selfAssessment ?? 0}/5. `
      + `${comparisonUsed ? 'They used the comparison feature. ' : ''}`
      + `Celebrate the full session warmly. 1-2 sentences.`,
      { silent: true }
    );
  }, [hasSubmittedEvaluation, modelListened, recordingMade, recordingDuration, estimatedWPM, comparisonUsed, selfAssessment, targetWPM, lexileLevel, submitEvaluation, title, sendText]);

  // ---------------------------------------------------------------------------
  // INTERACTION SURFACE (the painting): the passage text body with expression
  // markers + the karaoke transcript spans. These stay bespoke.
  // ---------------------------------------------------------------------------

  // Static passage (used during Practice / Record so the student has something to read from).
  const renderPassage = (showMarkers: boolean) => (
    <div className="text-sm leading-relaxed">
      {passageWords.map((word, i) => {
        const marker = showMarkers ? expressionMarkers.find(m => m.wordIndex === i) : null;
        return (
          <React.Fragment key={i}>
            {marker?.type === 'pause' && <span className="text-amber-500 text-xs mx-1">|</span>}
            <span className={`text-slate-200 ${marker?.type === 'emphasis' ? 'font-bold' : ''}`}>
              {word}
            </span>
            {' '}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Transcript-driven view for the Listen phase — the chunks ARE the audio, so
  // appending them as they arrive is naturally karaoke-timed. The most recent
  // chunk gets a highlight while the AI is still speaking.
  const renderLiveTranscript = () => {
    if (liveTranscriptChunks.length === 0) {
      return (
        <p className="text-sm text-slate-500 italic">
          {isPlaying ? 'Listening for the model reading…' : 'Press Play Model to hear the passage read aloud.'}
        </p>
      );
    }
    return (
      <div className="text-sm leading-relaxed">
        {liveTranscriptChunks.map((chunk, i) => {
          const isLatest = i === liveTranscriptChunks.length - 1 && isPlaying;
          return (
            <span
              key={`${chunk.timestamp}-${i}`}
              className={isLatest
                ? 'bg-blue-500/40 text-white rounded px-0.5'
                : 'text-slate-200'}
            >
              {chunk.content}{' '}
            </span>
          );
        })}
      </div>
    );
  };

  // Render progress — phase stepper chrome (tokenized).
  const renderProgress = () => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === currentPhase;
        const phaseIdx = phases.indexOf(currentPhase);
        const isCompleted = i < phaseIdx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border ${
              isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-slate-700/20 border-slate-600/30 text-slate-500'
            }`}>
              {phaseLabels[phase]}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="blue" className="text-xs">{lexileLevel}</LuminaBadge>
              <LuminaBadge accent="amber" className="text-xs">Target: {targetWPM} WPM</LuminaBadge>
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Listen */}
        {currentPhase === 'listen' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Listen to the model reading. Words appear as the tutor speaks them:</p>
            {/* Painting: live karaoke transcript spans */}
            <LuminaPanel className="min-h-[8rem]">
              {renderLiveTranscript()}
            </LuminaPanel>
            <div className="flex items-center gap-3">
              <LuminaButton tone="primary" onClick={playModel} disabled={isPlaying}>
                {isPlaying ? 'Playing...' : modelListened ? 'Replay' : 'Play Model'}
              </LuminaButton>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Speed:</span>
                {[0.75, 1.0, 1.25].map(speed => (
                  <button key={speed} onClick={() => setPlaybackSpeed(speed)}
                    className={`text-xs px-1.5 py-0.5 rounded border ${playbackSpeed === speed ? answerStateClasses.selected : answerStateClasses.idle}`}>
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <LuminaActionButton action="next" onClick={nextPhase} disabled={!modelListened}>
                Next: Practice
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 2: Practice */}
        {currentPhase === 'practice' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Practice reading along. Notice the expression markers:</p>
            {/* Painting: passage body with expression markers */}
            <LuminaPanel>
              {renderPassage(true)}
            </LuminaPanel>
            <LuminaCallout accent="amber" label="Expression tips">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-400"><span className="text-amber-500">|</span> = pause</span>
                <span className="text-xs text-slate-400"><span className="font-bold">bold</span> = emphasize</span>
              </div>
            </LuminaCallout>
            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase}>
                Next: Record
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 3: Record */}
        {currentPhase === 'record' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Record yourself reading the passage:</p>
            {/* Painting: passage body to read from */}
            <LuminaPanel>
              {renderPassage(false)}
            </LuminaPanel>
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <LuminaButton tone="danger" onClick={startRecording} disabled={recordingMade}>
                  {recordingMade ? 'Recorded' : 'Start Recording'}
                </LuminaButton>
              ) : (
                <LuminaButton tone="danger" onClick={stopRecording} className="animate-pulse">
                  Stop Recording
                </LuminaButton>
              )}
              {recordingMade && (
                <>
                  <span className="text-xs text-slate-400">{recordingDuration.toFixed(1)}s | {estimatedWPM} WPM</span>
                  <LuminaButton onClick={handleComparison} className="text-xs">
                    Compare with Model
                  </LuminaButton>
                </>
              )}
            </div>
            {comparisonUsed && (
              <LuminaPanel accent="purple">
                <p className="text-xs text-purple-300">Side-by-side comparison mode active. Listen to both readings to compare fluency.</p>
              </LuminaPanel>
            )}
            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase} disabled={!recordingMade}>
                Review
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            <div className="grid gap-2 grid-cols-3">
              <LuminaStat
                label="Your WPM"
                value={estimatedWPM}
                accent={Math.abs(estimatedWPM - targetWPM) < 20 ? 'emerald' : undefined}
              />
              <LuminaStat label="Target WPM" value={targetWPM} accent="blue" />
              <LuminaStat label="Duration" value={`${recordingDuration.toFixed(1)}s`} />
            </div>

            {/* Self assessment — rating selection (tokenized selected state) */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500">How did your reading sound? Rate yourself:</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button key={rating} onClick={() => handleSelfAssessment(rating)}
                    className={`w-10 h-10 rounded-lg border text-sm font-bold transition-all ${
                      selfAssessment === rating
                        ? answerStateClasses.selected
                        : answerStateClasses.idle
                    }`}>
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
              {!hasSubmittedEvaluation ? (
                <LuminaActionButton action="check" onClick={submitFinalEvaluation}>
                  Submit
                </LuminaActionButton>
              ) : (
                <LuminaFeedbackCard status="correct" label="Read-Aloud Complete!" className="w-full text-center">
                  {estimatedWPM} WPM (target: {targetWPM})
                </LuminaFeedbackCard>
              )}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ReadAloudStudio;
