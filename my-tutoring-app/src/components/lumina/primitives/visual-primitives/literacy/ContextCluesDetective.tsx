'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
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
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  CHECK_LABEL, CLUE_TYPE_LABEL, MEANING_INPUT_LABEL, clueAssignment, clueMiss, clueScene, clueSteps, describeClueWork,
  findCorrect, scriptedScore, sentenceLabel, stepAnswered, stepCorrect, stepId, type ClueStep, type ClueView, type CluePhase,
} from './contextCluesWorkspace';
import {
  CROSS_OUT_LEVER, SENTENCE_LIST_LEVER, SIGNAL_WORDS, SIGNAL_WORDS_LEVER, STRATEGY_BY_TYPE, STRATEGY_LEVER,
  TRY_IN_PLACE_LEVER, TYPE_DESCRIPTIONS_LEVER, clueLeverFacts, clueLevers, crossOutLeaks, ruledOutBy, tryInPlace,
  type ClueLeverContext,
} from './contextCluesLevers';

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
    /** Find phase: the passage starts listed one sentence per line (the `sentence_list` lever's starting position).
     *  It used to outline the clue sentences, which drew the find step's answer; nothing marks a clue now. */
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

export type ContextClueChallenge = ContextCluesDetectiveData['challenges'][number];

// ============================================================================
// Props Interface
// ============================================================================

interface ContextCluesDetectiveProps {
  data: ContextCluesDetectiveData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

type DetectivePhase = CluePhase;

const PHASE_CONFIG: Record<DetectivePhase, { label: string; description: string }> = {
  find: { label: 'Find', description: 'Find the context clue' },
  classify: { label: 'Classify', description: 'What type of clue is it?' },
  define: { label: 'Define', description: 'What does the word mean?' },
};

const CLUE_TYPE_CONFIG: Record<string, { label: string; icon: string; description: string }> = {
  definition: { label: CLUE_TYPE_LABEL.definition, icon: '=', description: 'The word is defined in the text' },
  synonym: { label: CLUE_TYPE_LABEL.synonym, icon: '↔', description: 'A similar word is nearby' },
  antonym: { label: CLUE_TYPE_LABEL.antonym, icon: '≠', description: 'An opposite word shows the contrast' },
  example: { label: CLUE_TYPE_LABEL.example, icon: '•', description: 'Examples help explain the meaning' },
  inference: { label: CLUE_TYPE_LABEL.inference, icon: '🔍', description: 'Figure it out from the broader context' },
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

const ContextCluesDetectiveSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  ContextCluesDetectiveProps & { tutorOwned: boolean; useController: (options: ProgressOptions<ClueStep>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
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

  // Stable fallback instance ID — must not change across renders
  const stableInstanceIdRef = useRef(instanceId || `context-clues-detective-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Progress: one checked step per phase of each word (find, classify, define). On the workspace path the
  //    runtime moves the index; on the scripted path this component does, after each check. ──
  const steps = useMemo(() => clueSteps(challenges), [challenges]);
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: steps,
    getChallengeId: (s) => s.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: clueAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
  });
  const latestProgress = useRef(progress);
  latestProgress.current = progress;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;

  const step: ClueStep | undefined = steps[progress.currentIndex];
  const currentChallenge = step?.challenge;
  const currentPhase: DetectivePhase = step?.phase ?? 'find';
  const currentChallengeIndex = step?.challengeIndex ?? 0;

  // Find phase: which sentences the user highlighted as clues
  const [highlightedSentenceIds, setHighlightedSentenceIds] = useState<Set<string>>(new Set());

  // Classify phase: user's selected clue type
  const [selectedClueType, setSelectedClueType] = useState<string>('');

  // Define phase: user's meaning answer
  const [selectedMeaning, setSelectedMeaning] = useState('');
  const [typedMeaning, setTypedMeaning] = useState('');

  // Results tracking per challenge (scripted path; the workspace path scores from the teaching record)
  const [challengeResults, setChallengeResults] = useState<Array<{
    clueCorrect: boolean;
    typeCorrect: boolean;
    meaningCorrect: boolean;
  }>>([]);

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');
  const [showDictionary, setShowDictionary] = useState(false);

  // Levers (`contextCluesLevers.ts`), keyed by the step they were pulled on; the sentences a wrong find showed hold no
  // clue, keyed the same way. The tier's starting positions (the list, the descriptions, the strategy) are not pulls.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [ruledOutState, setRuledOutState] = useState<{ item: string; ids: string[] }>({ item: '', ids: [] });
  const pulledLevers = leverState.item === step?.id ? leverState.pulled : [];
  const leverOn = (id: string) => pulledLevers.includes(id);
  const ruledOut = ruledOutState.item === step?.id ? ruledOutState.ids : [];
  const leverCtx: ClueLeverContext = {
    listShown: !!currentChallenge?.showClueHints,
    descriptionsShown: currentChallenge?.showClueTypeDescriptions !== false,
    strategyShown: !!currentChallenge?.strategyHint,
    ruledOut,
  };
  const listOn = currentPhase === 'find' && (leverCtx.listShown || leverOn(SENTENCE_LIST_LEVER));
  const crossed = currentPhase === 'find' && leverOn(CROSS_OUT_LEVER) ? ruledOut : [];
  const descriptionsOn = leverCtx.descriptionsShown || leverOn(TYPE_DESCRIPTIONS_LEVER);
  const signalsOn = currentPhase === 'classify' && leverOn(SIGNAL_WORDS_LEVER);
  const strategyText = currentChallenge?.strategyHint
    ?? (leverOn(STRATEGY_LEVER) && currentChallenge ? STRATEGY_BY_TYPE[currentChallenge.clueType] : undefined);

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

  // The learner's work as the check and the tutor read it. Written every render, read by the check handler.
  const view: ClueView = {
    picked: currentChallenge
      ? currentChallenge.passage.sentences.map(s => s.id).filter(id => highlightedSentenceIds.has(id)) : [],
    clueType: selectedClueType,
    meaning: currentChallenge?.meaningOptions?.length ? selectedMeaning : typedMeaning,
  };
  const viewRef = useRef(view);
  viewRef.current = view;

  // ---------------------------------------------------------------------------
  // AI Tutoring Integration (scripted path) — the AI tutor coaches the detective work. It never
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

  // Its context carries the answers, so it is off on the workspace path, and its scripted cues send nothing there.
  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'context-clues-detective',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // Activity introduction — fire once when the AI tutor connects
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current || !currentChallenge) return;
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
  }, [tutorOwned, isConnected, currentChallenge, gradeLevel, challenges.length, sendText]);

  const clearFeedback = () => { setFeedback(''); setFeedbackType(''); };

  // A fresh step opens empty for its own input (a new word clears everything); Try again clears the step's input
  // and the feedback. Both paths: the scripted path calls it from its own advance.
  openItem.current = (index, retry) => {
    const s = steps[index];
    clearFeedback();
    if (!s) return;
    if (s.phase === 'find') {
      setHighlightedSentenceIds(new Set());
      if (!retry) { setSelectedClueType(''); setSelectedMeaning(''); setTypedMeaning(''); setShowDictionary(false); }
    } else if (s.phase === 'classify') {
      setSelectedClueType('');
    } else {
      setSelectedMeaning(''); setTypedMeaning(''); setShowDictionary(false);
    }
  };

  // Toggle sentence highlight
  const handleToggleSentence = useCallback((sentenceId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'find' || feedbackType === 'success' || workspaceClosed.current) return;
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
  }, [hasSubmittedEvaluation, currentPhase, feedbackType]);

  /** Scripted path: the next step of the same word opens after a short beat. */
  const advanceStepSoon = () => {
    setTimeout(() => {
      const p = latestProgress.current;
      if (p.advance()) openItem.current(p.currentIndex + 1, false);
    }, 1000);
  };

  // The one check: the current step's own rule, committed as the workspace's checked gesture on both paths.
  const handleCheck = () => {
    if (!step || !currentChallenge || learnerBlocked() || feedbackType === 'success' || showDictionary) return;
    const work = viewRef.current;
    if (!stepAnswered(step, work)) return;
    const correct = stepCorrect(step, work);
    const miss = correct ? undefined : clueMiss(step, work);
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(describeClueWork(step, work), correct, miss);
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    const word = currentChallenge.targetWord;
    const n = `word ${currentChallengeIndex + 1} of ${challenges.length}`;

    if (step.phase === 'find') {
      if (correct) {
        setFeedback('Great detective work! You found a context clue!');
        setFeedbackType('success');
        sendText(`[FIND_CORRECT] The student found a context-clue sentence for "${word}" (${n}). `
          + (step.phases.includes('classify') ? `Briefly congratulate the detective and tell them to figure out what TYPE of clue it is. One sentence. Do not name the clue type.` : `Briefly congratulate the detective and tell them to use the clue to work out what the word means. One sentence. Do not state the meaning.`),
          { silent: true });
        if (!tutorOwned) advanceStepSoon();
      } else {
        // What this check showed holds no clue, for the cross_out lever (never a clue sentence).
        const out = ruledOutBy(currentChallenge, work.picked, miss);
        if (out.length) setRuledOutState(prev => ({ item: step.id,
          ids: Array.from(new Set([...(prev.item === step.id ? prev.ids : []), ...out])) }));
        setFeedback(miss === 'extra_sentence'
          ? 'Not every sentence you picked is a clue. Keep only the sentences that help explain the highlighted word.'
          : 'That sentence doesn\'t contain a clue. Look for a sentence that helps explain the highlighted word.');
        setFeedbackType('error');
        sendText(`[FIND_INCORRECT] The student highlighted a sentence that is NOT a context clue for "${word}" (${n}). `
          + `Give a brief hint about what a context clue does, without pointing to the exact sentence or revealing the meaning. One sentence.`,
          { silent: true });
      }
      return;
    }

    if (step.phase === 'classify') {
      if (correct) {
        setFeedback('Correct! You identified the clue type!');
        setFeedbackType('success');
        sendText(`[CLASSIFY_CORRECT] The student correctly named the clue type for "${word}". `
          + `Briefly affirm and tell them to now use that clue to figure out what the word means. One sentence. Do not state the meaning.`,
          { silent: true });
        if (!tutorOwned) advanceStepSoon();
      } else {
        setFeedback(tutorOwned
          ? 'Not that type. Look again at what the green clue sentence does for the word.'
          : 'Not quite. Think about what the clue sentence does — does it define, give a synonym, show an opposite, provide an example, or require inference?');
        setFeedbackType('error');
        sendText(`[CLASSIFY_INCORRECT] The student chose the clue type "${work.clueType}" for "${word}", which is not right. `
          + `Help them reason about what the clue sentence actually does (defines / gives a synonym / shows an opposite / gives an example / requires inference) without naming the correct type. One sentence.`,
          { silent: true });
      }
      return;
    }

    // Define. The scripted path closes the word on any answer and shows the meaning; the workspace path keeps the
    // meaning hidden after a miss (Try again reopens the step) and shows the dictionary only once it is credited.
    if (!tutorOwned) {
      setChallengeResults(prev => [...prev, {
        clueCorrect: findCorrect(currentChallenge, currentChallenge.passage.sentences.map(s => s.id).filter(id => highlightedSentenceIds.has(id))),
        // A single-type session has no classify step: the type is not asked, and `scriptedScore` gives it no weight.
        typeCorrect: step.phases.includes('classify') && selectedClueType === currentChallenge.clueType,
        meaningCorrect: correct,
      }]);
    }
    if (correct) {
      setFeedback('Excellent! You figured out the meaning from context!');
      setFeedbackType('success');
      setShowDictionary(true);
      sendText(`[DEFINE_CORRECT] The student correctly worked out the meaning of "${word}" from the context clues (${n}). `
        + `Celebrate the detective work briefly and mention they can compare it to the dictionary definition shown. One or two sentences.`,
        { silent: true });
    } else if (tutorOwned) {
      setFeedback('Not that meaning. Read the clue sentence again and try the word in its place.');
      setFeedbackType('error');
    } else {
      setFeedback(`The meaning is: "${currentChallenge.correctMeaning}"`);
      setFeedbackType('info');
      setShowDictionary(true);
      sendText(`[DEFINE_INCORRECT] The student's meaning for "${word}" was not correct (${n}). `
        + `The dictionary definition is now shown on screen. Encourage them warmly to read it and the clue together so they can connect the clue to the meaning. One or two sentences. Stay supportive.`,
        { silent: true });
    }
  };

  // Submit final evaluation (scripted path)
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const results = challengeResults;
    const clueCorrectCount = results.filter(r => r.clueCorrect).length;
    const typeCorrectCount = results.filter(r => r.typeCorrect).length;
    const meaningCorrectCount = results.filter(r => r.meaningCorrect).length;
    const total = results.length;

    // Weighted over the steps built: find 30 + type 30 + meaning 40, or find and meaning rescaled when there is no type step.
    const score = scriptedScore(results, steps.some(s => s.phase === 'classify'));

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
    steps,
  ]);

  // Move to next word or finish (scripted path; hidden on the workspace path)
  const handleNext = () => {
    if (progress.advance()) {
      openItem.current(progress.currentIndex + 1, false);
      const nextChallenge = challenges[currentChallengeIndex + 1];
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
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss. A step counts for its phase when it was
  // right on the first try.
  finish.current = (result) => {
    if (hasSubmittedEvaluation) return;
    const firstTry = (id: string) => latestProgress.current.results.some(r => r.challengeId === id && r.correct && r.attempts === 1);
    const count = (phase: CluePhase) => challenges.filter(c => firstTry(stepId(c.id, phase))).length;
    const metrics: ContextCluesDetectiveMetrics = {
      type: 'context-clues-detective',
      gradeLevel,
      clueHighlightedCorrectly: count('find') > 0,
      clueTypeIdentified: count('classify') > 0,
      meaningCorrect: count('define') > 0,
      clueType: challenges[challenges.length - 1]?.clueType ?? 'inference',
      dictionaryComparisonViewed: true,
      attemptsCount: result.attemptsCount,
      totalChallenges: challenges.length,
      challengesCorrect: count('define'),
    };
    submitEvaluation(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  // Every step declares levers (`contextCluesLevers.ts`), all help; a pull changes the screen in the same commit.
  useLayoutEffect(() => {
    if (!tutorOwned || !step) return;
    const scene = clueScene(step, { ...viewRef.current, total: challenges.length, typeDescriptionsShown: descriptionsOn });
    const levers = clueLevers(step, pulledLevers, leverCtx);
    const onScreen = clueLeverFacts(step, pulledLevers, { ...leverCtx, meaning: viewRef.current.meaning });
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this step.`;
        if (lever.pulled) return `${id} is already on screen.`;
        if (id === CROSS_OUT_LEVER && (!ruledOut.length || crossOutLeaks(step.challenge, ruledOut)))
          return 'No checked sentence to grey out yet: the learner taps a sentence and presses Check Clue first.';
        setLeverState({ item: step.id, pulled: [...pulledLevers, id] });
        return true;
      },
    };
  });

  const finished = hasSubmittedEvaluation || !!progress.practiceSummary;
  const solvedSteps = (phase: CluePhase) => tutorOwned
    ? challenges.filter(c => progress.results.some(r => r.challengeId === stepId(c.id, phase) && r.correct)).length
    : challengeResults.filter(r => phase === 'find' ? r.clueCorrect : phase === 'classify' ? r.typeCorrect : r.meaningCorrect).length;

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase progress — bespoke step indicator (not a glass surface).
  const renderPhaseProgress = () => {
    // A session whose words share one clue type has no classify step (`cluePhases`).
    const phases: readonly DetectivePhase[] = step?.phases ?? ['find', 'classify', 'define'];
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

  // Render the passage with highlighted target word and tappable sentences.
  // INTERACTION SURFACE — the tappable / highlightable evidence text body
  // stays bespoke (selection + clue-reveal highlights are the painting).
  const renderPassage = () => {
    if (!currentChallenge) return null;
    const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const target = currentChallenge.targetWord.toLowerCase();
    // The mystery word in its own sentence; with the signal_words lever, the signal words in the green clue sentences.
    const marked = (text: string, isTarget: boolean, signals: boolean): React.ReactNode => {
      const words = [...(isTarget ? [currentChallenge.targetWord] : []), ...(signals ? SIGNAL_WORDS : [])];
      if (!words.length) return text;
      const regex = new RegExp(`\\b(${words.map(escape).join('|')})\\b`, 'gi');
      return text.split(regex).map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        if (isTarget && part.toLowerCase() === target)
          return <span key={i} className="font-bold text-amber-300 bg-amber-500/20 px-1 rounded">{part}</span>;
        return <span key={i} data-lever="signal-word" className="underline decoration-2 decoration-sky-300 underline-offset-4">{part}</span>;
      });
    };
    return (
      <div className={`rounded-xl bg-slate-800/40 border border-white/5 p-5 ${listOn ? 'flex flex-col gap-2' : 'space-y-1'}`}
        data-lever={listOn ? 'sentence-list' : undefined}>
        {currentChallenge.passage.sentences.map((sentence, sentenceIndex) => {
          const isTargetSentence = sentence.id === currentChallenge.targetWordSentenceId;
          const isHighlighted = highlightedSentenceIds.has(sentence.id);
          const isClueRevealed = currentPhase !== 'find' && currentChallenge.clueSentenceIds.includes(sentence.id);
          // The cross_out lever: a sentence an earlier check found holds no clue (never a clue sentence).
          const isCrossed = crossed.includes(sentence.id);
          // Every sentence is tappable in the find phase, the word's own sentence too: an easy item's clue sits
          // in the same sentence as the word, and an untappable clue could never be found.
          const isClickable = currentPhase === 'find';
          const sentenceContent = marked(sentence.text, isTargetSentence, signalsOn && isClueRevealed);

          const className = `
                ${listOn ? 'block w-full' : 'inline'} leading-relaxed text-base transition-all text-left
                ${isClickable && !isCrossed ? 'cursor-pointer hover:bg-white/5 rounded px-0.5' : ''}
                ${isTargetSentence ? 'text-slate-100' : 'text-slate-300'}
                ${isHighlighted ? 'bg-blue-500/20 rounded px-1 py-0.5' : ''}
                ${isClueRevealed ? 'bg-emerald-500/10 rounded px-1 py-0.5' : ''}
                ${isCrossed ? 'opacity-40 line-through' : ''}
              `;
          const body = (
            <>
              {listOn && <span className="mr-2 text-xs font-semibold text-slate-500">{sentenceIndex + 1}.</span>}
              {sentenceContent}
              {listOn && isTargetSentence && (
                <span className="ml-2 text-[11px] uppercase tracking-wide text-amber-300/80">has the word</span>
              )}
              {' '}
            </>
          );
          return isClickable ? (
            <button
              key={sentence.id}
              type="button"
              aria-label={sentenceLabel(sentenceIndex + 1)}
              aria-pressed={isHighlighted}
              disabled={isCrossed}
              data-lever={isCrossed ? 'crossed' : undefined}
              onClick={() => handleToggleSentence(sentence.id)}
              className={className}
            >
              {body}
            </button>
          ) : (
            <span key={sentence.id} className={className}>
              {body}
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

  const checkClosed = (tutorOwned && progress.canAttempt === false) || feedbackType === 'success';

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
          onClick={handleCheck}
          disabled={highlightedSentenceIds.size === 0 || checkClosed}
        >
          {CHECK_LABEL.find}
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
              aria-label={config.label}
              onClick={() => { if (!learnerBlocked() && feedbackType !== 'success') setSelectedClueType(type); }}
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
                  {descriptionsOn && (
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
          onClick={handleCheck}
          disabled={!selectedClueType || checkClosed}
        >
          {CHECK_LABEL.classify}
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
        {strategyText && (
          <p className="text-xs text-blue-300/80 mt-2 italic" data-lever={currentChallenge?.strategyHint ? undefined : 'strategy'}>{strategyText}</p>
        )}
      </LuminaPanel>

      {renderPassage()}

      {/* Answer input */}
      {currentChallenge?.meaningOptions?.length ? (
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
                onClick={() => { if (!showDictionary && !learnerBlocked()) setSelectedMeaning(option); }}
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
          onChange={(e) => { if (!learnerBlocked()) setTypedMeaning(e.target.value); }}
          disabled={showDictionary}
          aria-label={MEANING_INPUT_LABEL}
          placeholder="Type the meaning..."
          className="w-full text-sm"
        />
      )}

      {/* The try_in_place lever: the word's sentence with the learner's own pick in the word's place. */}
      {leverOn(TRY_IN_PLACE_LEVER) && currentChallenge && !showDictionary && (
        <LuminaPanel>
          <p className="text-slate-300 text-sm" data-lever="try-in-place">
            <span className="text-xs text-slate-500 mr-2">Try it in the sentence:</span>
            {tryInPlace(currentChallenge, view.meaning)}
          </p>
        </LuminaPanel>
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
            onClick={handleCheck}
            disabled={(!selectedMeaning && !typedMeaning.trim()) || checkClosed}
          >
            {CHECK_LABEL.define}
          </LuminaActionButton>
        ) : tutorOwned ? null : (
          <LuminaActionButton action="next" onClick={handleNext}>
            {currentChallengeIndex < challenges.length - 1 ? 'Next Word' : 'Finish'}
          </LuminaActionButton>
        )}
      </div>

      {/* Final results */}
      {finished && (
        <LuminaPanel accent="emerald" className="text-center space-y-2">
          <p className="text-emerald-300 font-semibold text-lg">Session Complete!</p>
          <p className="text-slate-400 text-sm">
            You defined {solvedSteps('define')} of {challenges.length} words correctly from context.
          </p>
          <div className="flex justify-center gap-4 text-xs text-slate-500">
            <span>Clues found: {solvedSteps('find')}</span>
            <span>Types correct: {solvedSteps('classify')}</span>
          </div>
        </LuminaPanel>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: finished || !currentChallenge ? null : `${currentChallenge.id}:${currentPhase}`,
    label: 'The passage and the clue questions',
    solved: feedbackType === 'success',
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

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

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !finished && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {currentPhase === 'find' && renderFindPhase()}
        {currentPhase === 'classify' && renderClassifyPhase()}
        {currentPhase === 'define' && renderDefinePhase()}
        </div>

      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const ContextCluesDetective = withWorkspaceController<ContextCluesDetectiveProps, ProgressOptions<ClueStep>, Progress>(
  'context-clues-detective', ContextCluesDetectiveSurface, useScriptedProgress, useWorkspaceProgressFor('context-clues-detective'));

export default ContextCluesDetective;
