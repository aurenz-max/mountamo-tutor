'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaCallout,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaInput,
  type AnswerChoiceState,
  type FeedbackStatus,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ContextCluesDetectiveMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface ContextCluesDetectiveData {
  title: string;
  gradeLevel: string;

  // Words to investigate
  challenges: Array<{
    id: string;

    // The passage containing the target word
    passage: {
      sentences: Array<{
        id: string;
        text: string;
        isClue: boolean;                     // Whether this sentence contains a context clue
      }>;
    };

    // The target word
    targetWord: string;
    targetWordSentenceId: string;            // Which sentence contains the target word

    // Clue information
    clueType: 'definition' | 'synonym' | 'antonym' | 'example' | 'inference';
    clueSentenceIds: string[];               // Sentence IDs that contain context clues

    // Meaning
    correctMeaning: string;                  // The correct definition/meaning
    meaningOptions?: string[];               // Multiple-choice options (if provided)
    acceptableMeanings?: string[];           // Alternative acceptable answers

    // Dictionary definition for comparison
    dictionaryDefinition: string;

    // ── Within-mode support scaffold (config.difficulty) — on-screen help only.
    //    Set deterministically by the generator per support tier; NEVER changes the
    //    passage text, the clue type, the target word, or the correct meaning. A
    //    missing/undefined value falls back to the fully-scaffolded default so the
    //    no-tier path renders exactly as before. ──
    /** Find phase: pre-tint the actual clue sentence(s) so the student can self-check the search. */
    showClueHints?: boolean;
    /** Classify phase: show the per-type descriptions under each clue-type label (vs. bare labels — recall the types unaided). */
    showClueTypeDescriptions?: boolean;
    /** Define phase: a named-strategy nudge ("look for the synonym near the word"). Withheld at higher tiers so the student names the strategy themselves. */
    strategyHint?: string;
  }>;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ContextCluesDetectiveMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface ContextCluesDetectiveProps {
  data: ContextCluesDetectiveData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type DetectivePhase = 'find' | 'classify' | 'define';

const PHASE_CONFIG: Record<DetectivePhase, { label: string; description: string }> = {
  find: { label: 'Find', description: 'Find the context clue' },
  classify: { label: 'Classify', description: 'What type of clue is it?' },
  define: { label: 'Define', description: 'What does the word mean?' },
};

const CLUE_TYPE_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  definition: { label: 'Definition', icon: '=', description: 'The word is defined in the text' },
  synonym: { label: 'Synonym', icon: '↔', description: 'A similar word is nearby' },
  antonym: { label: 'Antonym', icon: '≠', description: 'An opposite word shows the contrast' },
  example: { label: 'Example', icon: '•', description: 'Examples help explain the meaning' },
  inference: { label: 'Inference', icon: '🔍', description: 'Figure it out from the broader context' },
};

// Map the legacy feedbackType -> kit feedback status.
const FEEDBACK_STATUS: Record<'success' | 'error' | 'info', FeedbackStatus> = {
  success: 'correct',
  error: 'incorrect',
  info: 'insight',
};

// ============================================================================
// Component
// ============================================================================

const ContextCluesDetective: React.FC<ContextCluesDetectiveProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // State
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<DetectivePhase>('find');

  // Find phase: which sentences the user highlighted as clues
  const [highlightedSentenceIds, setHighlightedSentenceIds] = useState<Set<string>>(new Set());

  // Classify phase: user's selected clue type
  const [selectedClueType, setSelectedClueType] = useState<string>('');

  // Define phase: user's meaning answer
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [typedMeaning, setTypedMeaning] = useState('');

  // Results tracking per challenge
  const [challengeResults, setChallengeResults] = useState<Array<{
    clueCorrect: boolean;
    typeCorrect: boolean;
    meaningCorrect: boolean;
  }>>([]);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showDictionary, setShowDictionary] = useState(false);

  // Stable fallback instance ID — must not change across renders
  const stableInstanceIdRef = useRef(instanceId || `context-clues-detective-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<ContextCluesDetectiveMetrics>({
    primitiveType: 'context-clues-detective',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const currentChallenge = challenges[currentChallengeIndex];

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration — the AI tutor coaches the detective work. It never
  // reveals the meaning/clue; it nudges the strategy (find the clue, name the
  // clue type, infer the meaning) per the catalog tutoring scaffold.
  // ---------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    gradeLevel,
    targetWord: currentChallenge?.targetWord ?? '',
    currentPhase,
    clueType: currentChallenge?.clueType ?? '',
    itemIndex: currentChallengeIndex + 1,
    totalItems: challenges.length,
    selectedClueType,
    highlightCount: highlightedSentenceIds.size,
  }), [
    gradeLevel, currentChallenge, currentPhase,
    currentChallengeIndex, challenges.length,
    selectedClueType, highlightedSentenceIds,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'context-clues-detective',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
  });

  // Activity introduction — fire once when the AI tutor connects
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || !currentChallenge) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a context-clues detective activity for Grade ${gradeLevel}. `
      + `There are ${challenges.length} words to investigate. `
      + `The first mystery word is "${currentChallenge.targetWord}". `
      + `Introduce the activity warmly: we are detectives figuring out word meanings from clues in the passage. `
      + `Tell the student to start by clicking the sentence that gives a clue about the word. `
      + `Do NOT reveal the meaning or which sentence is the clue. Keep it brief and enthusiastic — 2-3 sentences max.`,
      { silent: true }
    );
  }, [isConnected, currentChallenge, gradeLevel, challenges.length, sendText]);

  // Toggle sentence highlight
  const handleToggleSentence = useCallback((sentenceId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'find') return;
    setHighlightedSentenceIds(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(sentenceId)) {
        next.delete(sentenceId);
      } else {
        next.add(sentenceId);
      }
      return next;
    });
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, currentPhase]);

  // Check find phase and advance
  const handleCheckFind = useCallback(() => {
    if (!currentChallenge) return;

    const highlighted = Array.from(highlightedSentenceIds);
    if (highlighted.length === 0) {
      setFeedback('Click on a sentence that gives you a clue about the word\'s meaning.');
      setFeedbackType('info');
      return;
    }

    // Check if any highlighted sentence is a correct clue
    const correctClues = highlighted.filter(id => currentChallenge.clueSentenceIds.includes(id));
    const isCorrect = correctClues.length > 0;

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Great detective work! You found a context clue!');
      setFeedbackType('success');
      sendText(
        `[FIND_CORRECT] The student found a context-clue sentence for "${currentChallenge.targetWord}" (word ${currentChallengeIndex + 1} of ${challenges.length}). `
        + `Briefly congratulate the detective and tell them to figure out what TYPE of clue it is. One sentence. Do not name the clue type.`,
        { silent: true }
      );
      setTimeout(() => {
        setCurrentPhase('classify');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      SoundManager.playIncorrect();
      setFeedback('That sentence doesn\'t contain a clue. Look for a sentence that helps explain the highlighted word.');
      setFeedbackType('error');
      sendText(
        `[FIND_INCORRECT] The student highlighted a sentence that is NOT a context clue for "${currentChallenge.targetWord}" (word ${currentChallengeIndex + 1} of ${challenges.length}). `
        + `Give a brief hint about what a context clue does, without pointing to the exact sentence or revealing the meaning. One sentence.`,
        { silent: true }
      );
    }
  }, [currentChallenge, highlightedSentenceIds, currentChallengeIndex, challenges.length, sendText]);

  // Check classify phase and advance
  const handleCheckClassify = useCallback(() => {
    if (!currentChallenge || !selectedClueType) return;

    const isCorrect = selectedClueType === currentChallenge.clueType;

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Correct! You identified the clue type!');
      setFeedbackType('success');
      sendText(
        `[CLASSIFY_CORRECT] The student correctly named the clue type for "${currentChallenge.targetWord}". `
        + `Briefly affirm and tell them to now use that clue to figure out what the word means. One sentence. Do not state the meaning.`,
        { silent: true }
      );
      setTimeout(() => {
        setCurrentPhase('define');
        setFeedback('');
        setFeedbackType('');
      }, 1000);
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite. Think about what the clue sentence does — does it define, give a synonym, show an opposite, provide an example, or require inference?`);
      setFeedbackType('error');
      sendText(
        `[CLASSIFY_INCORRECT] The student chose the clue type "${selectedClueType}" for "${currentChallenge.targetWord}", which is not right. `
        + `Help them reason about what the clue sentence actually does (defines / gives a synonym / shows an opposite / gives an example / requires inference) without naming the correct type. One sentence.`,
        { silent: true }
      );
    }
  }, [currentChallenge, selectedClueType, sendText]);

  // Check define phase and finish challenge
  const handleCheckDefine = useCallback(() => {
    if (!currentChallenge) return;

    const userAnswer = currentChallenge.meaningOptions
      ? selectedMeaning
      : typedMeaning.trim().toLowerCase();

    const correct = currentChallenge.correctMeaning.toLowerCase();
    const acceptable = currentChallenge.acceptableMeanings?.map(a => a.toLowerCase()) || [];

    const isCorrect = userAnswer === correct ||
      acceptable.includes(userAnswer) ||
      (!!currentChallenge.meaningOptions && userAnswer === currentChallenge.correctMeaning);

    // Record results for this challenge
    const clueCorrect = Array.from(highlightedSentenceIds).some(id =>
      currentChallenge.clueSentenceIds.includes(id)
    );
    const typeCorrect = selectedClueType === currentChallenge.clueType;

    setChallengeResults(prev => [
      ...prev,
      { clueCorrect, typeCorrect, meaningCorrect: isCorrect },
    ]);

    if (isCorrect) {
      SoundManager.playCorrect();
      setFeedback('Excellent! You figured out the meaning from context!');
      setFeedbackType('success');
      sendText(
        `[DEFINE_CORRECT] The student correctly worked out the meaning of "${currentChallenge.targetWord}" from the context clues (word ${currentChallengeIndex + 1} of ${challenges.length}). `
        + `Celebrate the detective work briefly and mention they can compare it to the dictionary definition shown. One or two sentences.`,
        { silent: true }
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback(`The meaning is: "${currentChallenge.correctMeaning}"`);
      setFeedbackType('info');
      sendText(
        `[DEFINE_INCORRECT] The student's meaning for "${currentChallenge.targetWord}" was not correct (word ${currentChallengeIndex + 1} of ${challenges.length}). `
        + `The dictionary definition is now shown on screen. Encourage them warmly to read it and the clue together so they can connect the clue to the meaning. One or two sentences. Stay supportive.`,
        { silent: true }
      );
    }

    // Show dictionary comparison
    setShowDictionary(true);
  }, [currentChallenge, selectedMeaning, typedMeaning, highlightedSentenceIds, selectedClueType, currentChallengeIndex, challenges.length, sendText]);

  // Move to next challenge or finish
  const handleNext = useCallback(() => {
    if (currentChallengeIndex < challenges.length - 1) {
      const nextChallenge = challenges[currentChallengeIndex + 1];
      setCurrentChallengeIndex(prev => prev + 1);
      setCurrentPhase('find');
      setHighlightedSentenceIds(new Set());
      setSelectedClueType('');
      setSelectedMeaning('');
      setTypedMeaning('');
      setFeedback('');
      setFeedbackType('');
      setShowDictionary(false);

      if (nextChallenge) {
        sendText(
          `[NEXT_WORD] The student is moving to mystery word ${currentChallengeIndex + 2} of ${challenges.length}: "${nextChallenge.targetWord}". `
          + `Briefly introduce the new word and tell them to find the clue sentence. One sentence. Do not reveal the meaning or the clue location.`,
          { silent: true }
        );
      }
    } else {
      submitFinalEvaluation();
    }
  }, [currentChallengeIndex, challenges, sendText]);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const results = challengeResults;
    const clueCorrectCount = results.filter(r => r.clueCorrect).length;
    const typeCorrectCount = results.filter(r => r.typeCorrect).length;
    const meaningCorrectCount = results.filter(r => r.meaningCorrect).length;
    const total = results.length;

    // Weighted score: clue finding (30%) + type classification (30%) + meaning (40%)
    const clueScore = total > 0 ? (clueCorrectCount / total) * 30 : 0;
    const typeScore = total > 0 ? (typeCorrectCount / total) * 30 : 0;
    const meaningScore = total > 0 ? (meaningCorrectCount / total) * 40 : 0;
    const score = Math.round(clueScore + typeScore + meaningScore);

    const lastClueType = currentChallenge?.clueType || 'inference';

    const metrics: ContextCluesDetectiveMetrics = {
      type: 'context-clues-detective',
      gradeLevel,
      clueHighlightedCorrectly: clueCorrectCount > 0,
      clueTypeIdentified: typeCorrectCount > 0,
      meaningCorrect: meaningCorrectCount > 0,
      clueType: lastClueType,
      dictionaryComparisonViewed: showDictionary,
      attemptsCount: total,
      totalChallenges: challenges.length,
      challengesCorrect: meaningCorrectCount,
    };

    submitEvaluation(
      score >= 50,
      score,
      metrics,
      {
        challengeResults: results,
      }
    );
  }, [
    hasSubmittedEvaluation,
    challengeResults,
    currentChallenge,
    gradeLevel,
    showDictionary,
    challenges.length,
    submitEvaluation,
  ]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase progress — bespoke step indicator (not a glass surface).
  const renderPhaseProgress = () => {
    const phases: DetectivePhase[] = ['find', 'classify', 'define'];
    const phaseOrder = phases.indexOf(currentPhase);
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase === currentPhase;
          const isCompleted = index < phaseOrder || (showDictionary && phase === 'define');
          const config = PHASE_CONFIG[phase];
          return (
            <React.Fragment key={phase}>
              {index > 0 && (
                <div className={`h-0.5 w-8 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`
                    w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border
                    ${isCompleted
                      ? 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300'
                      : isActive
                        ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                        : 'bg-slate-700/30 border-slate-600/40 text-slate-500'
                    }
                  `}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`text-xs font-medium ${
                    isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {config.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // Render the passage with highlighted target word and clickable sentences.
  // INTERACTION SURFACE — the clickable / highlightable evidence text body
  // stays bespoke (selection + clue-reveal highlights are the painting).
  const renderPassage = () => {
    if (!currentChallenge) return null;
    return (
      <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5 space-y-1">
        {currentChallenge.passage.sentences.map(sentence => {
          const isTargetSentence = sentence.id === currentChallenge.targetWordSentenceId;
          const isHighlighted = highlightedSentenceIds.has(sentence.id);
          const isClueRevealed = currentPhase !== 'find' && currentChallenge.clueSentenceIds.includes(sentence.id);
          // Support scaffold (easy/medium): during the FIND phase, faintly cue the
          // real clue sentence(s) so the student can self-check their search. The
          // check still reads clueSentenceIds — this only tints, never auto-answers.
          const isClueHinted =
            currentPhase === 'find' &&
            !!currentChallenge.showClueHints &&
            currentChallenge.clueSentenceIds.includes(sentence.id);
          const isClickable = currentPhase === 'find' && !isTargetSentence;

          // Highlight the target word within the target sentence
          let sentenceContent: React.ReactNode = sentence.text;
          if (isTargetSentence) {
            const regex = new RegExp(`(${currentChallenge.targetWord})`, 'gi');
            const parts = sentence.text.split(regex);
            sentenceContent = parts.map((part, i) =>
              regex.test(part) ? (
                <span key={i} className="font-bold text-amber-300 bg-amber-500/20 px-1 rounded">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              )
            );
          }

          return (
            <span
              key={sentence.id}
              onClick={() => isClickable && handleToggleSentence(sentence.id)}
              className={`
                inline leading-relaxed text-base transition-all
                ${isClickable ? 'cursor-pointer hover:bg-white/5 rounded px-0.5' : ''}
                ${isTargetSentence ? 'text-slate-100' : 'text-slate-300'}
                ${isHighlighted ? 'bg-blue-500/20 rounded px-1 py-0.5' : ''}
                ${isClueRevealed ? 'bg-emerald-500/10 rounded px-1 py-0.5' : ''}
                ${isClueHinted && !isHighlighted ? 'ring-1 ring-amber-400/30 rounded px-0.5' : ''}
              `}
            >
              {sentenceContent}{' '}
            </span>
          );
        })}
      </div>
    );
  };

  // Shared feedback banner.
  const renderFeedback = () =>
    feedback && feedbackType ? (
      <LuminaFeedbackCard status={FEEDBACK_STATUS[feedbackType]}>
        {feedback}
      </LuminaFeedbackCard>
    ) : null;

  // Find phase
  const renderFindPhase = () => (
    <div className="space-y-4">
      <LuminaPanel>
        <p className="text-slate-400 text-sm">
          The word <span className="font-bold text-amber-300">&ldquo;{currentChallenge?.targetWord}&rdquo;</span> is
          highlighted in the passage. <span className="text-blue-300">Click on a sentence</span> that gives you a clue about what it means.
        </p>
      </LuminaPanel>

      {renderPassage()}

      {renderFeedback()}

      <div className="flex justify-end">
        <LuminaActionButton
          action="check"
          onClick={handleCheckFind}
          disabled={highlightedSentenceIds.size === 0}
        >
          Check Clue
        </LuminaActionButton>
      </div>
    </div>
  );

  // Classify phase
  const renderClassifyPhase = () => (
    <div className="space-y-4">
      <LuminaPanel>
        <p className="text-slate-400 text-sm">
          What <span className="text-amber-300">type</span> of context clue helps you understand
          <span className="font-bold text-amber-300"> &ldquo;{currentChallenge?.targetWord}&rdquo;</span>?
        </p>
      </LuminaPanel>

      {renderPassage()}

      {/* Clue type options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {Object.entries(CLUE_TYPE_CONFIG).map(([type, config]) => {
          const state: AnswerChoiceState = selectedClueType === type ? 'selected' : 'idle';
          return (
            <LuminaAnswerChoice
              key={type}
              state={state}
              onClick={() => setSelectedClueType(type)}
              className="p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg w-6 text-center">{config.icon}</span>
                <div>
                  <p className="text-sm font-medium">{config.label}</p>
                  {/* Support scaffold: the per-type description (what each clue type
                      means) is shown at easy and withdrawn at medium/hard, so a
                      stronger student recalls the clue types from the label alone.
                      Default (undefined) shows it — the no-tier path is unchanged. */}
                  {currentChallenge?.showClueTypeDescriptions !== false && (
                    <p className="text-xs text-slate-500">{config.description}</p>
                  )}
                </div>
              </div>
            </LuminaAnswerChoice>
          );
        })}
      </div>

      {renderFeedback()}

      <div className="flex justify-end">
        <LuminaActionButton
          action="check"
          onClick={handleCheckClassify}
          disabled={!selectedClueType}
        >
          Check Type
        </LuminaActionButton>
      </div>
    </div>
  );

  // Define phase
  const renderDefinePhase = () => (
    <div className="space-y-4">
      <LuminaPanel>
        <p className="text-slate-400 text-sm">
          Based on the context clues, what does
          <span className="font-bold text-amber-300"> &ldquo;{currentChallenge?.targetWord}&rdquo;</span> mean?
        </p>
        {/* Support scaffold (easy): a named-strategy nudge that tells the student
            HOW to read the clue (e.g. "look for the synonym near the word"). Withheld
            at medium/hard so the student names the reading strategy themselves. Never
            states the meaning or the answer. */}
        {currentChallenge?.strategyHint && (
          <p className="text-xs text-blue-300/80 mt-2 italic">{currentChallenge.strategyHint}</p>
        )}
      </LuminaPanel>

      {renderPassage()}

      {/* Answer input */}
      {currentChallenge?.meaningOptions ? (
        <div className="space-y-2">
          {currentChallenge.meaningOptions.map((option, i) => {
            const isCorrectOption = option === currentChallenge.correctMeaning;
            const isPicked = selectedMeaning === option;
            let state: AnswerChoiceState;
            if (showDictionary) {
              state = isCorrectOption ? 'correct' : isPicked ? 'incorrect' : 'dimmed';
            } else {
              state = isPicked ? 'selected' : 'idle';
            }
            return (
              <LuminaAnswerChoice
                key={i}
                state={state}
                onClick={() => !showDictionary && setSelectedMeaning(option)}
                disabled={showDictionary}
                className="p-4"
              >
                <span className="text-sm">{option}</span>
              </LuminaAnswerChoice>
            );
          })}
        </div>
      ) : (
        <LuminaInput
          type="text"
          value={typedMeaning}
          onChange={(e) => setTypedMeaning(e.target.value)}
          disabled={showDictionary}
          placeholder="Type the meaning..."
          className="w-full text-sm"
        />
      )}

      {/* Feedback */}
      {renderFeedback()}

      {/* Dictionary comparison */}
      {showDictionary && currentChallenge && (
        <LuminaCallout accent="purple" label="Dictionary Definition">
          <span className="font-bold">{currentChallenge.targetWord}</span>: {currentChallenge.dictionaryDefinition}
        </LuminaCallout>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {!showDictionary ? (
          <LuminaActionButton
            action="check"
            onClick={handleCheckDefine}
            disabled={!selectedMeaning && !typedMeaning.trim()}
          >
            Check Meaning
          </LuminaActionButton>
        ) : (
          <LuminaActionButton action="next" onClick={handleNext}>
            {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
          </LuminaActionButton>
        )}
      </div>

      {/* Final results */}
      {hasSubmittedEvaluation && (
        <LuminaPanel accent="emerald" className="text-center space-y-2">
          <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
          <p className="text-slate-400 text-sm">
            You defined {challengeResults.filter(r => r.meaningCorrect).length} of {challenges.length} words correctly from context.
          </p>
          <div className="flex justify-center gap-4 text-xs text-slate-500">
            <span>Clues found: {challengeResults.filter(r => r.clueCorrect).length}</span>
            <span>Types correct: {challengeResults.filter(r => r.typeCorrect).length}</span>
          </div>
        </LuminaPanel>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!currentChallenge) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">
                Grade {gradeLevel}
              </LuminaBadge>
              <LuminaBadge accent="amber" className="text-xs">
                Word {currentChallengeIndex + 1} of {challenges.length}
              </LuminaBadge>
            </div>
          </div>
          <LuminaBadge
            accent={
              currentPhase === 'find'
                ? 'blue'
                : currentPhase === 'classify'
                  ? 'purple'
                  : 'emerald'
            }
            className="text-xs"
          >
            {PHASE_CONFIG[currentPhase].description}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderPhaseProgress()}

        {currentPhase === 'find' && renderFindPhase()}
        {currentPhase === 'classify' && renderClassifyPhase()}
        {currentPhase === 'define' && renderDefinePhase()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ContextCluesDetective;
