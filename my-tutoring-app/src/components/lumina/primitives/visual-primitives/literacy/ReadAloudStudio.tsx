'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ReadAloudStudioMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

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
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
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

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'read-aloud-studio',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

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
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Model reading — AI reads the passage aloud while we highlight words
  const playModel = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);

    // Ask the AI tutor to read the passage aloud
    sendText(
      `[READ_PASSAGE] Read this passage aloud with clear expression at about ${Math.round(targetWPM * playbackSpeed)} WPM. `
      + `Pause briefly at | marks, emphasize bold words. Here is the passage:\n\n${passage}`,
      { silent: true }
    );

    // Karaoke-style word highlighting in sync
    const msPerWord = (60 * 1000) / (targetWPM * playbackSpeed);
    let idx = 0;
    const interval = setInterval(() => {
      if (idx >= passageWords.length) {
        clearInterval(interval);
        setIsPlaying(false);
        setHighlightIndex(-1);
        setModelListened(true);

        // After model finishes, encourage next step
        sendText(
          `[MODEL_LISTENED] The student finished listening to the model reading of "${title}". `
          + `Encourage them to move to the Practice phase to try reading along with expression markers. One sentence.`,
          { silent: true }
        );
        return;
      }
      setHighlightIndex(idx);
      idx++;
    }, msPerWord);
  }, [isPlaying, targetWPM, playbackSpeed, passageWords.length, passage, title, sendText]);

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

  // Render passage with karaoke highlighting
  const renderPassage = (showMarkers: boolean) => (
    <div className="text-sm leading-relaxed">
      {passageWords.map((word, i) => {
        const marker = showMarkers ? expressionMarkers.find(m => m.wordIndex === i) : null;
        const isHighlighted = i === highlightIndex;
        return (
          <React.Fragment key={i}>
            {marker?.type === 'pause' && <span className="text-amber-500 text-xs mx-1">|</span>}
            <span className={`${isHighlighted ? 'bg-blue-500/40 text-white rounded px-0.5' : 'text-slate-200'} ${
              marker?.type === 'emphasis' ? 'font-bold' : ''
            }`}>
              {word}
            </span>
            {' '}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Render progress
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
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-300 text-xs">{lexileLevel}</Badge>
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs">Target: {targetWPM} WPM</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Listen */}
        {currentPhase === 'listen' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Listen to the model reading. Watch how the words are highlighted:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage(true)}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={playModel} disabled={isPlaying}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                {isPlaying ? 'Playing...' : modelListened ? 'Replay' : 'Play Model'}
              </Button>
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Speed:</span>
                {[0.75, 1.0, 1.25].map(speed => (
                  <button key={speed} onClick={() => setPlaybackSpeed(speed)}
                    className={`text-xs px-1.5 py-0.5 rounded ${playbackSpeed === speed ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-500'}`}>
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase} disabled={!modelListened}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Practice
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Practice */}
        {currentPhase === 'practice' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Practice reading along. Notice the expression markers:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage(true)}
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <p className="text-xs text-amber-300">Expression tips:</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-xs text-slate-400"><span className="text-amber-500">|</span> = pause</span>
                <span className="text-xs text-slate-400"><span className="font-bold">bold</span> = emphasize</span>
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Record
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Record */}
        {currentPhase === 'record' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Record yourself reading the passage:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage(false)}
            </div>
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <Button variant="ghost" onClick={startRecording} disabled={recordingMade}
                  className="bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300">
                  {recordingMade ? 'Recorded' : 'Start Recording'}
                </Button>
              ) : (
                <Button variant="ghost" onClick={stopRecording}
                  className="bg-rose-500/30 border border-rose-500/50 hover:bg-rose-500/40 text-rose-200 animate-pulse">
                  Stop Recording
                </Button>
              )}
              {recordingMade && (
                <>
                  <span className="text-xs text-slate-400">{recordingDuration.toFixed(1)}s | {estimatedWPM} WPM</span>
                  <Button variant="ghost" onClick={handleComparison}
                    className="bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 text-violet-300 text-xs">
                    Compare with Model
                  </Button>
                </>
              )}
            </div>
            {comparisonUsed && (
              <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-2">
                <p className="text-xs text-violet-300">Side-by-side comparison mode active. Listen to both readings to compare fluency.</p>
              </div>
            )}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={!recordingMade}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            <div className="grid gap-2 grid-cols-3">
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Your WPM</p>
                <p className={`text-lg font-bold ${Math.abs(estimatedWPM - targetWPM) < 20 ? 'text-emerald-300' : 'text-slate-300'}`}>{estimatedWPM}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Target WPM</p>
                <p className="text-lg font-bold text-blue-300">{targetWPM}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Duration</p>
                <p className="text-lg font-bold text-slate-300">{recordingDuration.toFixed(1)}s</p>
              </div>
            </div>

            {/* Self assessment */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500">How did your reading sound? Rate yourself:</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button key={rating} onClick={() => handleSelfAssessment(rating)}
                    className={`w-10 h-10 rounded-lg border text-sm font-bold transition-all ${
                      selfAssessment === rating
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}>
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Submit
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Read-Aloud Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">{estimatedWPM} WPM (target: {targetWPM})</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReadAloudStudio;
