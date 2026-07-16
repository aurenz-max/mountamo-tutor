'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { KnowledgeCheckData, ProblemData } from '../types';
import { ProblemRenderer } from '../config/problemTypeRegistry';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { ScratchPadDrawer } from '../components/scratch-pad/ScratchPadDrawer';
import type { AIAnalysisResult } from '../components/scratch-pad/types';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, Loader2, PenLine } from 'lucide-react';
import { SoundManager } from '../utils/SoundManager';
import {
  LuminaPanel,
  LuminaButton,
  LuminaActionButton,
  LuminaChallengeCounter,
  LuminaFeedbackCard,
  motion,
} from '../ui';
import { multipleChoiceVoiceReady } from './problem-primitives/MultipleChoiceProblem';
import { isPreReaderGrade } from '../utils/kindergartenMode';

/**
 * KnowledgeCheck Component
 *
 * Supports two modes:
 * 1. Legacy mode: Single multiple-choice question (backwards compatible)
 * 2. Problem Registry mode: Single or multiple problems of various types
 *
 * ONE PROBLEM AT A TIME:
 * - Problems present sequentially, never stacked. A correct answer auto-advances
 *   after the feedback beat (motion out → navigate whoosh → next reveals); an
 *   incorrect answer stays put with Try Again (in the problem) + Next → (here).
 * - Sequential presentation is also what keeps the pre-reader read-aloud beat
 *   honest: only the active problem is mounted, so its in-view trigger can never
 *   fire for a problem the student hasn't reached (the stacked layout let the
 *   next problem's read-aloud fire as it peeked into the viewport).
 *
 * AI TUTORING INTEGRATION:
 * - Sends pedagogical triggers at key moments (problem shown, correct/incorrect, completion)
 * - [PROBLEM_SHOWN] fires per problem as it becomes active; primitiveData tracks
 *   the ACTIVE problem (index, question, attempts) so the tutor always scaffolds
 *   the question actually on screen.
 * - Optional AI Helper card provides progressive hints without revealing answers
 *
 * EVALUATION INTEGRATION:
 * - Delegates evaluation to individual problem primitives
 * - Each problem type (MultipleChoiceProblem, etc.) handles its own evaluation
 * - Intercepts evaluation results to trigger AI tutoring responses
 * - Supports competency tracking via skillId/subskillId/objectiveId passed to problems
 *
 * The component automatically detects which mode to use based on the data structure.
 */

interface KnowledgeCheckProps {
  data: KnowledgeCheckData | {
    problems: ProblemData[];
    instanceId?: string;
    skillId?: string;
    subskillId?: string;
    objectiveId?: string;
    exhibitId?: string;
    onEvaluationSubmit?: (result: any) => void;
  };
}

// Type guard to check if using legacy format
function isLegacyKnowledgeCheck(data: any): data is KnowledgeCheckData {
  return 'question' in data && 'options' in data && 'correctAnswerId' in data;
}

// Type guard to check if using problem registry format
function isProblemRegistryFormat(data: any): data is { problems: ProblemData[] } {
  return 'problems' in data && Array.isArray(data.problems);
}

// Problem identity is POSITIONAL, never problem.id: ids are LLM-emitted and the
// per-type generators routinely return duplicates across problems (two MCQs both
// "mc_1"). A duplicate id as a React key keeps the previous problem's component
// instance — its selected answer bleeds into the next problem — and as a results
// key it overwrites the earlier entry so completion never fires.
function stateKeyFor(index: number): string {
  return `p${index}`;
}

// ── Advance pacing ───────────────────────────────────────────────────────────
// A correct answer dwells long enough for the pop + chime + rationale to land
// before the problem slides away. Pre-readers get longer: the tutor speaks the
// celebration aloud before the next question's read-aloud beat begins.
const ADVANCE_DWELL_MS = 2200;
const ADVANCE_DWELL_PRE_MS = 3000;
const LEAVE_MS = 300; // matches motion.transitionSlow

// ─── AI Helper Hint Card ─────────────────────────────────────────────────────

interface AIHelperCardProps {
  sendText: (text: string, options?: { silent?: boolean }) => void;
  requestHint: (level: 1 | 2 | 3, currentState?: any) => void;
  isAIResponding: boolean;
  conversation: Array<{ role: string; content: string }>;
  currentQuestion: string;
  problemType: string;
  problemIndex: number;
  totalProblems: number;
}

const AIHelperCard: React.FC<AIHelperCardProps> = ({
  sendText,
  isAIResponding,
  conversation,
  currentQuestion,
  problemType,
  problemIndex,
  totalProblems,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintMessages, setHintMessages] = useState<string[]>([]);
  const conversationLengthAtHintRef = useRef(0);
  const maxHintLevel = 3;

  // Watch conversation for new AI responses after hint request
  useEffect(() => {
    if (hintLevel === 0) return;

    const newMessages = conversation.slice(conversationLengthAtHintRef.current);
    const aiResponses = newMessages
      .filter((msg) => msg.role === 'assistant' || msg.role === 'model')
      .map((msg) => msg.content);

    if (aiResponses.length > 0) {
      setHintMessages((prev) => {
        const updated = [...prev];
        // Replace or add the hint for the current level
        updated[hintLevel - 1] = aiResponses[aiResponses.length - 1];
        return updated;
      });
    }
  }, [conversation, hintLevel]);

  const handleRequestHint = useCallback(() => {
    SoundManager.tap();
    const nextLevel = Math.min(hintLevel + 1, maxHintLevel) as 1 | 2 | 3;
    setHintLevel(nextLevel);
    conversationLengthAtHintRef.current = conversation.length;

    sendText(
      `[HINT_REQUESTED] The student is asking for help on problem ${problemIndex + 1} of ${totalProblems}. ` +
      `Problem type: ${problemType}. Question: "${currentQuestion}". ` +
      `This is hint level ${nextLevel} of ${maxHintLevel}. ` +
      `Provide a level-${nextLevel} hint: ${
        nextLevel === 1
          ? 'Ask a guiding question to redirect their thinking.'
          : nextLevel === 2
            ? 'Break the problem into smaller parts and point to key details.'
            : 'Walk through the reasoning step by step, stopping just short of the answer.'
      } NEVER reveal the correct answer.`,
      { silent: true }
    );
  }, [hintLevel, sendText, currentQuestion, problemType, problemIndex, totalProblems, conversation.length]);

  // Reset hints when question changes
  useEffect(() => {
    setHintLevel(0);
    setHintMessages([]);
  }, [currentQuestion]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30 rounded-xl transition-all"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-300">
              {hintLevel === 0 ? 'Need help?' : `Hints (${hintLevel}/${maxHintLevel})`}
            </span>
          </div>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-400" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <LuminaPanel className="mt-2 space-y-3 border-amber-500/10">
          {/* Existing hints */}
          {hintMessages.map((hint, i) => (
            hint && (
              <div key={i} className={`flex gap-3 ${motion.reveal}`}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center mt-0.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-mono text-amber-500/60 mb-1">
                    Hint {i + 1}
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {hint}
                  </p>
                </div>
              </div>
            )
          ))}

          {/* Loading state */}
          {isAIResponding && hintLevel > 0 && !hintMessages[hintLevel - 1] && (
            <div className="flex items-center gap-2 text-amber-400/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          )}

          {/* Request hint button */}
          {hintLevel < maxHintLevel ? (
            <LuminaButton
              onClick={handleRequestHint}
              disabled={isAIResponding}
              className="w-full"
            >
              <Lightbulb className="w-4 h-4 mr-2" />
              {hintLevel === 0
                ? 'Get a hint'
                : hintLevel === 1
                  ? 'I need more help'
                  : 'Walk me through it'}
            </LuminaButton>
          ) : (
            <p className="text-xs text-slate-500 text-center italic">
              All hints used. Give it your best try!
            </p>
          )}
        </LuminaPanel>
      </CollapsibleContent>
    </Collapsible>
  );
};

// ─── Main KnowledgeCheck Component ───────────────────────────────────────────

export const KnowledgeCheck: React.FC<KnowledgeCheckProps> = ({ data }) => {
  // ── Evaluation tracking state ──────────────────────────────────────────────
  const [evaluationResults, setEvaluationResults] = useState<Map<string, { isCorrect: boolean; attempts: number }>>(new Map());
  const hasTriggeredProblemShownRef = useRef<Set<string>>(new Set());
  const hasTriggeredAllCompleteRef = useRef(false);

  // ── Scratch Pad state ─────────────────────────────────────────────────────
  const [isScratchPadOpen, setIsScratchPadOpen] = useState(false);
  const [scratchPadProblemTopic, setScratchPadProblemTopic] = useState('');
  const lastForwardedAnalysisRef = useRef<AIAnalysisResult | null>(null);

  // ── Normalize data to problems array ───────────────────────────────────────
  const problems: ProblemData[] = useMemo(() => {
    if (isLegacyKnowledgeCheck(data)) {
      return [{
        type: 'multiple_choice' as const,
        id: 'legacy_mc_1',
        difficulty: 'medium' as const,
        gradeLevel: 'elementary',
        question: data.question,
        visual: data.visual,
        options: data.options,
        correctOptionId: data.correctAnswerId,
        rationale: data.explanation,
        teachingNote: '',
        successCriteria: [],
      }];
    }
    if (isProblemRegistryFormat(data)) {
      return data.problems;
    }
    return [];
  }, [data]);

  // Extract common props. Memoized: per-problem evaluation ids derive from
  // this value, so the fallback must not mint a new id every render.
  const instanceId = useMemo(
    () => ('instanceId' in data ? data.instanceId : undefined) || `knowledge-check-${Date.now()}`,
    [data],
  );
  const exhibitId = 'exhibitId' in data ? data.exhibitId : undefined;

  // ── Pre-reader (K) mode — reader-fit PRE band ──────────────────────────────
  // At kindergarten the problems render picture-primary, tap=choose, chrome-free,
  // and the tutor reads each question + choices aloud. Derived from the problem's
  // grade (the generator floors K to picture-primary MCQ / true-false).
  const preReader = useMemo(
    () => problems.some((p) => isPreReaderGrade((p as any).gradeLevel)),
    [problems],
  );

  // ── One-at-a-time progression ──────────────────────────────────────────────
  const [activeIndex, setActiveIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
  }, []);

  const goToNext = useCallback(() => {
    if (leavingRef.current) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    leavingRef.current = true;
    setLeaving(true);
    leaveTimerRef.current = setTimeout(() => {
      SoundManager.navigate();
      setActiveIndex((i) => Math.min(i + 1, problems.length - 1));
      leavingRef.current = false;
      setLeaving(false);
    }, LEAVE_MS);
  }, [problems.length]);

  const activeProblem: ProblemData | undefined =
    problems[Math.min(activeIndex, Math.max(problems.length - 1, 0))];
  const activeResult = activeProblem ? evaluationResults.get(stateKeyFor(activeIndex)) : undefined;
  const isLastProblem = activeIndex >= problems.length - 1;
  const allComplete = problems.length > 0 && evaluationResults.size >= problems.length;
  const correctCount = Array.from(evaluationResults.values()).filter((r) => r.isCorrect).length;

  // ── Voice arbitration ──────────────────────────────────────────────────────
  // Only one problem is mounted at a time, so the single-mic invariant holds
  // structurally: the active problem may open a mic iff it's voice-ready (every
  // true/false, and any multiple-choice whose options are actually sayable) and
  // not yet answered. See /add-voice-control.
  const activeVoiceEligible =
    !!activeProblem &&
    !activeResult &&
    (activeProblem.type === 'true_false' ||
      (activeProblem.type === 'multiple_choice' && multipleChoiceVoiceReady(activeProblem)));

  // ── AI Tutoring Hook ───────────────────────────────────────────────────────
  // Tracks the ACTIVE problem — synced to the tutor via updateContext so
  // scaffolding always targets the question on screen, not problem 1.
  const aiPrimitiveData = useMemo(() => ({
    problemCount: problems.length,
    currentProblemIndex: activeIndex,
    currentProblemType: activeProblem?.type || 'unknown',
    currentQuestion: getQuestionText(activeProblem),
    attemptNumber: (activeResult?.attempts ?? 0) + 1,
    lastAnswerCorrect: activeResult ? activeResult.isCorrect : null,
    completedCount: evaluationResults.size,
    correctCount,
  }), [problems, activeIndex, activeProblem, activeResult, evaluationResults, correctCount]);

  const {
    sendText,
    requestHint,
    isAIResponding,
    conversation,
  } = useLuminaAI({
    primitiveType: 'knowledge-check',
    instanceId,
    primitiveData: aiPrimitiveData,
    exhibitId,
  });

  // A NON-silent sendText: the tutor actually SPEAKS the read-aloud / retry beat
  // (the context-injection sendText calls stay silent). Enacts [QUIZ_READ_ALOUD]
  // / [QUIZ_RETRY] from the catalog PRE-READER READ-ALOUD directive.
  const askTutor = useCallback(
    (message: string) => sendText(message, { silent: false }),
    [sendText],
  );

  // ── Pedagogical trigger: Problem shown ─────────────────────────────────────
  // Fires once per problem as it becomes the active one.
  useEffect(() => {
    const problem = problems[activeIndex];
    const shownKey = stateKeyFor(activeIndex);
    if (!problem || hasTriggeredProblemShownRef.current.has(shownKey)) return;
    hasTriggeredProblemShownRef.current.add(shownKey);

    sendText(
      `[PROBLEM_SHOWN] A ${problem.type.replace(/_/g, ' ')} problem has appeared. ` +
      `Question: "${getQuestionText(problem)}". ` +
      (problems.length > 1
        ? `This is problem ${activeIndex + 1} of ${problems.length}. `
        : '') +
      `Briefly introduce the question in an encouraging way. Do NOT hint at the answer.`,
      { silent: true }
    );
  }, [activeIndex, problems, sendText]);

  // ── Pedagogical trigger: All complete ──────────────────────────────────────
  useEffect(() => {
    if (problems.length === 0 || hasTriggeredAllCompleteRef.current) return;
    if (evaluationResults.size < problems.length) return;

    hasTriggeredAllCompleteRef.current = true;
    const finalCorrect = Array.from(evaluationResults.values()).filter((r) => r.isCorrect).length;

    sendText(
      `[ALL_COMPLETE] The student finished all ${problems.length} problems! ` +
      `Score: ${finalCorrect} out of ${problems.length} correct. ` +
      `Celebrate their effort and mention how many they got right.`,
      { silent: true }
    );
  }, [evaluationResults, problems, sendText]);

  // ── Evaluation callback (wired into each problem) ─────────────────────────
  const handleEvaluationSubmit = useCallback((problemStateKey: string, problemIndex: number, result: any) => {
    const isCorrect = result?.success ?? result?.isCorrect ?? false;
    const problem = problems[problemIndex];
    const questionText = getQuestionText(problem);

    // Immediate per-problem answer feedback. Kept outside the state updater so
    // StrictMode's double-invoke can't double-play it. A voice answer already
    // sounded its outcome inside the voice controller — skip the duplicate.
    const viaVoice = result?.studentWork?.viaVoice === true;
    if (!viaVoice) {
      if (isCorrect) {
        SoundManager.playCorrect();
      } else {
        SoundManager.playIncorrect();
      }
    }

    // A correct answer auto-advances after the feedback beat. The last problem
    // stays on screen so its rationale remains readable; the completion card
    // reveals beneath it instead. Incorrect answers never auto-advance — the
    // student chooses Try Again (in the problem) or Next → (below).
    if (isCorrect && problemIndex < problems.length - 1) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(
        goToNext,
        preReader ? ADVANCE_DWELL_PRE_MS : ADVANCE_DWELL_MS,
      );
    }

    setEvaluationResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(problemStateKey);
      const attemptNumber = (existing?.attempts || 0) + 1;
      next.set(problemStateKey, { isCorrect, attempts: attemptNumber });

      // Send AI trigger based on result
      if (isCorrect) {
        sendText(
          `[ANSWER_CORRECT] Problem ${problemIndex + 1} of ${problems.length}: ` +
          `The student answered correctly on attempt ${attemptNumber}. ` +
          `Question: "${questionText}". ` +
          `Briefly celebrate and reinforce why this is correct. ` +
          (problemIndex < problems.length - 1
            ? `Smoothly encourage them for the next problem.`
            : `This was the last problem!`),
          { silent: true }
        );
      } else {
        sendText(
          `[ANSWER_INCORRECT] Problem ${problemIndex + 1} of ${problems.length}: ` +
          `The student answered incorrectly on attempt ${attemptNumber}. ` +
          `Question: "${questionText}". ` +
          `Give brief encouragement and a gentle hint without revealing the answer. ` +
          `They can try again.`,
          { silent: true }
        );
      }

      return next;
    });

    // Also forward to the parent's onEvaluationSubmit if provided
    if ('onEvaluationSubmit' in data && data.onEvaluationSubmit) {
      data.onEvaluationSubmit(result);
    }
  }, [problems, sendText, data, goToNext, preReader]);

  // ── Scratch Pad analysis → AI tutor context ────────────────────────────────
  const handleScratchPadAnalysis = useCallback((result: AIAnalysisResult) => {
    if (result === lastForwardedAnalysisRef.current) return;
    lastForwardedAnalysisRef.current = result;

    sendText(
      `[SCRATCH_PAD_ANALYSIS] The student used the scratch pad to work through the problem. ` +
      `AI vision analysis of their work: "${result.summary}". ` +
      `Feedback: "${result.feedback}". ` +
      (result.latex ? `Their work contains: ${result.latex}. ` : '') +
      (result.nextSteps?.length ? `Suggested next steps: ${result.nextSteps.join('; ')}. ` : '') +
      `Use this context to better guide them. Do NOT repeat the analysis verbatim — ` +
      `instead, incorporate it naturally into your tutoring.`,
      { silent: true }
    );
  }, [sendText]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (problems.length === 0 || !activeProblem) {
    return (
      <div className="w-full max-w-4xl mx-auto my-12">
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400">
          Invalid KnowledgeCheck data format
        </div>
      </div>
    );
  }

  const problemCount = problems.length;
  const isLegacy = isLegacyKnowledgeCheck(data);

  // Manual advance appears only after a wrong answer (a correct one advances on
  // its own); the last problem has nothing to advance to.
  const showNext = !!activeResult && !activeResult.isCorrect && !isLastProblem && !leaving;

  return (
    <div className="w-full max-w-4xl mx-auto my-12 animate-fade-in-up">
      <div className="glass-panel rounded-3xl overflow-hidden border border-blue-500/20 relative">
        {/* Header — adult "terminal" chrome, hidden for pre-readers (reader-fit rule 7) */}
        {!preReader && (
          <div className="bg-slate-900/80 p-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600 animate-pulse"></span>
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
              </div>
              <span className="text-xs font-mono uppercase tracking-widest text-blue-400">
                {isLegacy ? 'Concept Verification Terminal' : 'Knowledge Assessment Terminal'}
              </span>
            </div>
            {problemCount > 1 && (
              <LuminaChallengeCounter
                variant="dots"
                current={Math.min(activeIndex + 1, problemCount)}
                total={problemCount}
              />
            )}
          </div>
        )}

        <div className="p-8 md:p-12">
          {/* One problem at a time. The positional key forces a full remount on
              every advance — problem state (selection, submission) must never
              survive into the next problem — and plays the reveal on entry;
              `leaving` slides the outgoing problem up and away first. */}
          <div
            key={stateKeyFor(activeIndex)}
            className={`${motion.transitionSlow} ${
              leaving ? 'opacity-0 -translate-y-4 scale-[0.98]' : motion.reveal
            }`}
          >
            <ProblemRenderer
              problemData={{
                ...activeProblem,
                // Per-problem evaluation identity derived from the section's
                // instanceId. Without it problems submit under random fallback
                // ids, and section-completion gates keyed on instanceId
                // (KindergartenStage) can never see this check finish.
                instanceId: `${instanceId}::p${activeIndex}`,
                onEvaluationSubmit: (result: any) => handleEvaluationSubmit(stateKeyFor(activeIndex), activeIndex, result),
                voiceEligible: activeVoiceEligible,
                // reader-fit PRE: picture-primary render + tutor read-aloud.
                preReader,
                onAskTutor: askTutor,
              }}
            />

            {/* AI Helper + Scratch Pad — adult chrome, hidden for pre-readers
                (reader-fit rule 7). At K the live tutor + 🔊 replay carry help. */}
            {!preReader && (
              <div className="mt-6 flex items-start gap-2">
                <div className="flex-1">
                  <AIHelperCard
                    sendText={sendText}
                    requestHint={requestHint}
                    isAIResponding={isAIResponding}
                    conversation={conversation as Array<{ role: string; content: string }>}
                    currentQuestion={getQuestionText(activeProblem)}
                    problemType={activeProblem.type.replace(/_/g, ' ')}
                    problemIndex={activeIndex}
                    totalProblems={problemCount}
                  />
                </div>
                <LuminaButton
                  onClick={() => {
                    SoundManager.tap();
                    setScratchPadProblemTopic(getQuestionText(activeProblem));
                    setIsScratchPadOpen(o => !o);
                  }}
                  className="flex items-center gap-1.5 shrink-0"
                  title="Open Scratch Pad"
                >
                  <PenLine className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-medium text-purple-300">Scratch Pad</span>
                </LuminaButton>
              </div>
            )}

            {showNext && (
              <div className={`mt-6 flex justify-center ${motion.reveal}`}>
                <LuminaActionButton
                  action="next"
                  onClick={() => {
                    SoundManager.tap();
                    goToNext();
                  }}
                  className={preReader ? 'text-xl px-10 py-6' : ''}
                />
              </div>
            )}
          </div>

          {/* Completion — reveals under the final answered problem so its
              rationale stays readable. The tutor speaks [ALL_COMPLETE]. */}
          {allComplete && !leaving && (
            <div className={`mt-8 flex justify-center ${motion.reveal}`}>
              <LuminaFeedbackCard
                status="correct"
                label={preReader ? '🎉 You did it!' : '🎉 Knowledge check complete'}
              >
                {preReader ? (
                  <span className="text-3xl tracking-widest" aria-hidden>
                    {problems.map((_, i) => (evaluationResults.get(stateKeyFor(i))?.isCorrect ? '⭐' : '💛')).join(' ')}
                  </span>
                ) : (
                  `You got ${correctCount} of ${problemCount} correct.`
                )}
              </LuminaFeedbackCard>
            </div>
          )}
        </div>

      </div>

      {/* Scratch Pad Drawer — students can work through problems by hand */}
      <ScratchPadDrawer
        isOpen={isScratchPadOpen}
        onToggle={() => setIsScratchPadOpen(o => !o)}
        onAnalysisComplete={handleScratchPadAnalysis}
        hideToggle
        topic={scratchPadProblemTopic || getQuestionText(activeProblem)}
        gradeLevel={
          'gradeLevel' in activeProblem ? (activeProblem as any).gradeLevel : undefined
        }
      />
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract the question text from any problem type for AI context */
function getQuestionText(problem: ProblemData | undefined): string {
  if (!problem) return '';
  switch (problem.type) {
    case 'multiple_choice':
      return problem.question;
    case 'true_false':
      return problem.statement;
    case 'fill_in_blanks':
      return problem.textWithBlanks;
    case 'matching_activity':
      return problem.prompt;
    case 'sequencing_activity':
      return problem.instruction;
    case 'categorization_activity':
      return problem.instruction;
    case 'scenario_question':
      return problem.scenarioQuestion;
    case 'short_answer':
      return problem.question;
    default:
      return '';
  }
}
