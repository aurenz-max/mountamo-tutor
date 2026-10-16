'use client';

/**
 * How It Works: a process told in 4-6 steps (or 3-4 picture steps for a pre-reader), read first, then questions about
 * it that code builds from the steps and keys from their order (`howItWorksWorkspace.ts`):
 * - guided: which step does this description tell of? (its own name blanked; the step list stays on screen)
 * - sequence: put the step cards in order, then which step is this, with no step list on screen
 * - predict: the first steps are shown, what happens next? and why does this step matter?
 *
 * The model writes the process; it never writes a question or picks an answer. Two paths, chosen by
 * `withWorkspaceController`: the scripted path (no tutor) unlocks the questions once every step has been scrolled
 * past, has its own Next and two tries before the answer is shown; the workspace path (W1, plain shape) commits every
 * check through `progress.commitCheck` with a named miss, takes a spoken step name judged by the tutor, and lets the
 * runtime move on. The levers live in `howItWorksLevers.ts`.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  answerStateClasses,
  surface,
  type AnswerChoiceState,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { HowItWorksMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  askOf, cardText, choiceText, clueOf, describeHowWork, emptyWork, howCorrect, howItems, howMiss, isChoice, isPictures,
  keyStep, processSteps, workComplete, workspaceAssignment, workspaceScene,
  type HowItem, type HowKind, type HowMode, type HowTier, type HowWork,
} from './howItWorksWorkspace';
import {
  crossedOut, howLevers, LAST_STEP_LEVER, lastStepLine, leverFacts, SHOW_STEP_LEVER, SHOW_WHY_LEVER, showStepLine,
  simplerItem, STEP_NUMBERS_LEVER, TWO_CHOICES_LEVER, whyLine,
} from './howItWorksLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type { HowItem, HowMode, HowTier };

export interface HowItWorksData {
  title: string;
  subtitle: string;
  overview: string;

  category?: 'science' | 'engineering' | 'nature' | 'cooking' | 'technology' | 'body' | 'history';

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
    /** What this step makes possible, one sentence without the step's own title words (the explain items). */
    purpose?: string;
  }>;

  summary: {
    text: string;
    totalTime?: string;
    keyTakeaway: string;
  };

  quickFacts?: {
    duration?: string;
    whereItHappens?: string;
    inventedBy?: string;
    funComparison?: string;
    energySource?: string;
  };

  realWorldExamples?: string[];
  relatedProcesses?: string[];

  /** The eval modes this session asks (the lesson's pin); absent: one question of each kind. */
  modes?: HowMode[];
  /** config.difficulty: the structural band the questions were built at. */
  difficulty?: HowTier;
  /** The questions, built and keyed by code from the steps; absent or invalid: rebuilt from the fields above. */
  items?: HowItem[];
  /** Legacy generations (model-written questions): read only for their kinds. */
  challenges?: Array<{ type?: string }>;

  // ── Pre-reader (K / PRE band) subset ──
  // When present, the process is told in picture cards (the tutor reads each step) instead of the magazine, and the
  // questions use the pictures. The generator emits it at the Kindergarten/Preschool band.
  preReader?: {
    question: string;
    steps: Array<{ id: string; emoji: string; label: string; spoken: string }>;
  };

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HowItWorksMetrics>) => void;
}

// ============================================================================
// Process Category Theming
// ============================================================================

const PROCESS_CATEGORIES: Record<string, { text: string; accent: string; rgb: string; icon: string }> = {
  science:     { text: 'text-emerald-300', accent: '#10b981', rgb: '16, 185, 129', icon: '🔬' },
  engineering: { text: 'text-amber-300',   accent: '#f59e0b', rgb: '245, 158, 11', icon: '⚙️' },
  nature:      { text: 'text-green-300',   accent: '#22c55e', rgb: '34, 197, 94',  icon: '🌿' },
  cooking:     { text: 'text-orange-300',  accent: '#f97316', rgb: '249, 115, 22', icon: '🍳' },
  technology:  { text: 'text-cyan-300',    accent: '#06b6d4', rgb: '6, 182, 212',  icon: '💻' },
  body:        { text: 'text-rose-300',    accent: '#fb7185', rgb: '251, 113, 133', icon: '🫀' },
  history:     { text: 'text-violet-300',  accent: '#a78bfa', rgb: '167, 139, 250', icon: '📜' },
};

const DEFAULT_COLORS = { text: 'text-blue-300', accent: '#60a5fa', rgb: '96, 165, 250', icon: '⚡' };

/** The Start button's name: the journey presses it by this label. */
export const START_LABEL = 'Start the questions';

// ============================================================================
// Props
// ============================================================================

interface HowItWorksProps {
  data: HowItWorksData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const HowItWorksSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  HowItWorksProps & { tutorOwned: boolean; useController: (options: ProgressOptions<HowItem>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    subtitle,
    overview,
    category,
    steps = [],
    summary,
    quickFacts,
    realWorldExamples,
    relatedProcesses,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const preReader = data.preReader;
  const pictures = isPictures(data);

  const colors = PROCESS_CATEGORIES[category || ''] || DEFAULT_COLORS;

  // The process as the questions read it, and the questions.
  const pSteps = useMemo(() => processSteps(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.steps, data.preReader]);
  const items = useMemo(() => howItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.modes, data.difficulty, data.steps, data.preReader, data.title, data.challenges]);
  const question = preReader?.question;

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `how-it-works-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Progress: the runtime moves the index on the workspace path (callbacks bound below)
  // -------------------------------------------------------------------------
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: i => workspaceAssignment(pSteps, i, pictures, question),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());
  const [showKeyTermDef, setShowKeyTermDef] = useState<Set<number>>(new Set());

  // Image generation state per step
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  /** The reading is over and the questions are open. */
  const [started, setStarted] = useState(false);
  const [practice, setPractice] = useState<HowItem | null>(null);
  const [work, setWork] = useState<HowWork>(emptyWork);
  /** Workspace path: the checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [scriptedWrongs, setScriptedWrongs] = useState(0);
  const [scriptedReveal, setScriptedReveal] = useState(false);
  const [scriptedDone, setScriptedDone] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  // Timing
  const stepEntryTimes = useRef<Record<number, number>>({ 0: Date.now() });

  const totalSteps = steps.length;
  const stepsExplored = visitedSteps.size;
  const allStepsExplored = stepsExplored >= totalSteps;

  const sessionItem: HowItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const item = practice ?? sessionItem;
  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved || !!progress.practiceSolved
    : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow || scriptedReveal;
  const crossed = item && isChoice(item) && leverOn(TWO_CHOICES_LEVER) ? crossedOut(item) : [];

  // Collect fun facts and key terms for promoted sections
  const allFunFacts = useMemo(() =>
    steps
      .filter(s => s.funFact)
      .map(s => ({ stepNumber: s.stepNumber, fact: s.funFact! })),
    [steps]
  );

  const allKeyTerms = useMemo(() =>
    steps
      .filter(s => s.keyTerm)
      .map(s => ({ stepNumber: s.stepNumber, term: s.keyTerm!.term, definition: s.keyTerm!.definition })),
    [steps]
  );

  // Quick facts entries for rendering
  const quickFactEntries = useMemo(() => {
    if (!quickFacts) return [];
    const labels: Record<string, string> = {
      duration: '⏱ Duration',
      whereItHappens: '📍 Where',
      inventedBy: '💡 Invented By',
      funComparison: '🤯 Fun Comparison',
      energySource: '⚡ Energy Source',
    };
    return Object.entries(quickFacts)
      .filter(([, v]) => v)
      .map(([k, v]) => ({ label: labels[k] || k, value: v! }));
  }, [quickFacts]);

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
  // Scripted tutor only: its context carries no answer; the workspace tutor reads the scene instead
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    overview,
    totalSteps,
    stepsExplored,
    challengesCompleted: results.length,
    totalChallenges: items.length,
    question: started && item ? askOf(pSteps, item, pictures, question) : '',
  }), [title, overview, totalSteps, stepsExplored, results.length, items.length, started, item, pSteps, pictures, question]);

  const { sendText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'how-it-works',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: pictures ? 'Kindergarten' : 'Elementary',
    enabled: !tutorOwned,
  });
  const say = useCallback((text: string, opts: { silent?: boolean } = { silent: true }) => {
    if (!tutorOwned && isConnected) sendText(text, opts);
  }, [tutorOwned, isConnected, sendText]);

  // Introduce on connect (scripted path). A pre-reader hears the picture story read aloud: it is the process itself.
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || !isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    if (preReader) {
      const story = preReader.steps.map((s, i) => `${i + 1}) ${s.spoken}`).join(' ');
      say(
        `[ACTIVITY_START_PRE] You are helping a child who cannot read. Warmly read the story of the process aloud, every step in order, word for word: ${story} `
        + 'Then invite them to tap the big play button when they are ready for the questions. Reading the steps aloud IS your greeting — do not shorten it or skip any step.',
        {},
      );
      return;
    }
    say(
      `[ACTIVITY_START] How It Works: "${title}" — ${subtitle}. `
      + `${totalSteps} steps to explore. ${items.length > 0 ? `${items.length} questions after.` : ''} `
      + `Overview: ${overview}. Introduce the process warmly and encourage step-by-step exploration.`,
    );
  }, [tutorOwned, isConnected, title, subtitle, overview, totalSteps, items.length, preReader, say]);

  // -------------------------------------------------------------------------
  // IntersectionObserver for scroll-based step tracking
  // -------------------------------------------------------------------------
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || started) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const stepIdx = Number(entry.target.getAttribute('data-step-index'));
            if (!isNaN(stepIdx)) {
              setVisitedSteps(prev => {
                if (prev.has(stepIdx)) return prev;
                const next = new Set(prev);
                next.add(stepIdx);
                return next;
              });
              if (!stepEntryTimes.current[stepIdx]) {
                stepEntryTimes.current[stepIdx] = Date.now();
              }
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    stepRefs.current.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [steps.length, started]);

  // -------------------------------------------------------------------------
  // Image Generation
  // -------------------------------------------------------------------------
  const handleGenerateImage = useCallback(async (stepIndex: number, imagePrompt: string) => {
    if (loadingImages.has(stepIndex) || stepImages[stepIndex]) return;

    setLoadingImages(prev => new Set(prev).add(stepIndex));
    setImageErrors(prev => {
      const next = new Set(prev);
      next.delete(stepIndex);
      return next;
    });

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateConceptImage',
          params: {
            prompt: `Educational illustration: ${imagePrompt}. Style: Clear, colorful, educational diagram suitable for students. No text in the image.`,
            aspectRatio: '16:9',
          },
        }),
      });

      if (!response.ok) throw new Error('Image generation failed');

      const result = await response.json();
      if (result.image) {
        setStepImages(prev => ({ ...prev, [stepIndex]: result.image }));
      } else {
        setImageErrors(prev => new Set(prev).add(stepIndex));
      }
    } catch {
      setImageErrors(prev => new Set(prev).add(stepIndex));
    } finally {
      setLoadingImages(prev => {
        const next = new Set(prev);
        next.delete(stepIndex);
        return next;
      });
    }
  }, [loadingImages, stepImages]);

  // -------------------------------------------------------------------------
  // Detail Expansion
  // -------------------------------------------------------------------------
  const handleDetailExpand = useCallback((stepIndex: number) => {
    setExpandedDetails(prev => {
      const next = new Set(prev);
      if (next.has(stepIndex)) {
        next.delete(stepIndex);
      } else {
        next.add(stepIndex);
        say(
          `[DETAIL_EXPANDED] Student opened "What's Happening?" for Step ${stepIndex + 1}: "${steps[stepIndex]?.title}". `
          + `React with enthusiasm and add a relatable comparison or context.`,
        );
      }
      return next;
    });
  }, [steps, say]);

  // -------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------
  const clearItem = () => {
    setWork(emptyWork()); setWrongShown(false); setFeedback(null);
    setScriptedWrongs(0); setScriptedReveal(false); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { setWork(emptyWork()); setWrongShown(false); setFeedback(null); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
    void index;
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || !isChoice(solved) || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork({ choice: keyStep(solved), placed: [] }); setWrongShown(false);
  };

  const closed = !started || revealed || wrongShown || learnerBlocked();

  const handleStart = () => {
    if (started) return;
    SoundManager.tap();
    setStarted(true);
    if (items[0]) say(`[READ_QUESTION] The questions begin. ${pictures ? 'Read this aloud to the child, word for word: ' : 'The question on screen: '}"${askOf(pSteps, items[0], pictures, question)}"`, pictures ? {} : { silent: true });
  };

  const checkWith = (w: HowWork) => {
    if (!item || closed || !workComplete(item, w)) return;
    const correct = howCorrect(item, w);
    progress.commitCheck(describeHowWork(pSteps, item, w, pictures), correct, correct ? undefined : howMiss(item, w));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      say('[CHALLENGE_CORRECT] The learner answered the question correctly; the answer is now marked on screen. Praise briefly.');
      return;
    }
    SoundManager.playIncorrect();
    if (tutorOwned) { setWrongShown(true); return; }
    const wrongs = scriptedWrongs + 1;
    setScriptedWrongs(wrongs);
    if (wrongs >= 2) {
      setScriptedReveal(true);
      setWork(item.kind === 'sequence' ? { choice: null, placed: [...item.cards] } : { choice: keyStep(item), placed: [] });
      if (!practice) progress.recordResult({ challengeId: item.id, correct: false, attempts: currentAttempts + 1 });
      say('[ANSWER_REVEALED] Two tries missed. The answer is now on screen: explain it from the steps of the process.');
      return;
    }
    setWork(emptyWork());
    setFeedback(item.kind === 'sequence' ? 'Not quite. Think about what has to happen before each step, and try again.' : 'Not quite. Try once more.');
    say('[CHALLENGE_INCORRECT] The learner\'s answer is wrong. You are not told the answer: ask what has to happen before or after, without naming a choice.');
  };

  const pick = (o: number) => {
    if (!item || closed || crossed.includes(o)) return;
    SoundManager.select();
    const next = { choice: o, placed: [] };
    setWork(next); setFeedback(null);
    if (pictures) checkWith(next);
  };
  const place = (s: number) => {
    if (!item || item.kind !== 'sequence' || closed || work.placed.includes(s)) return;
    SoundManager.tap();
    const next = { choice: null, placed: [...work.placed, s] };
    setWork(next); setFeedback(null);
    if (pictures && workComplete(item, next)) checkWith(next);
  };
  const unplace = (k: number) => {
    if (!item || closed) return;
    SoundManager.tick();
    setWork(w => ({ ...w, placed: w.placed.filter((_, i) => i !== k) }));
  };

  const recordAllStepTimes = () => {
    const now = Date.now();
    return steps.map((_, i) => { const entry = stepEntryTimes.current[i]; return entry ? now - entry : 0; });
  };

  const metrics = (attempts: number): HowItWorksMetrics => {
    const accuracy = (kinds: HowKind[]) => {
      const its = items.filter(i => kinds.includes(i.kind));
      return its.length ? Math.round((its.filter(i => results.some(r => r.challengeId === i.id && r.correct)).length / its.length) * 100) : 0;
    };
    const times = recordAllStepTimes();
    return {
      type: 'how-it-works',
      stepsExplored: pictures ? pSteps.length : stepsExplored,
      totalSteps: pictures ? pSteps.length : totalSteps,
      detailsExpanded: expandedDetails.size,
      sequenceAccuracy: accuracy(['sequence']),
      identifyAccuracy: accuracy(['identify']),
      predictAccuracy: accuracy(['predict', 'explain']),
      challengeAttempts: attempts,
      averageTimePerStep: totalSteps > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / totalSteps) : 0,
    };
  };

  /** Scripted path: Next, and after the last question the session report. */
  const next = () => {
    if (progress.advance()) {
      clearItem();
      const upcoming = items[currentIndex + 1];
      if (upcoming) say(`[NEXT_QUESTION] Question ${currentIndex + 2} of ${items.length}. ${pictures ? 'Read it aloud, word for word: ' : ''}"${askOf(pSteps, upcoming, pictures, question)}"`, pictures ? {} : { silent: true });
      return;
    }
    setScriptedDone(true);
    const score = items.length ? Math.round((results.filter(r => r.correct).length / items.length) * 100) : 0;
    say(`[ALL_COMPLETE] The learner finished all ${items.length} questions (${score}%). Celebrate and name the most important idea of the process in one sentence.`);
    if (hasSubmittedEvaluation || submitted || progress.recordsEvaluation === false) return;
    setSubmitted(true);
    submitEvaluation(score >= 70, score, metrics(results.reduce((a, r) => a + r.attempts, 0)), { challengeResults: results });
  };

  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitEvaluation(result.passed, result.accuracy, metrics(result.teachingAttempts.length),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Display only (no questions could be built): the exhibit submits once every step has been read.
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned || items.length > 0 || pictures || !allStepsExplored || hasSubmittedEvaluation || hasAutoSubmittedRef.current) return;
    hasAutoSubmittedRef.current = true;
    submitEvaluation(true, 100, metrics(0), {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorOwned, items.length, pictures, allStepsExplored, hasSubmittedEvaluation]);

  // -------------------------------------------------------------------------
  // Workspace path: what the tutor and the observer are shown, republished every render
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!tutorOwned || !item || isComplete) return;
    const reading = !started;
    const scene = workspaceScene(pSteps, item, { reading, work, solved: revealed, crossed }, pictures, { title, question });
    const levers = practice || reading ? [] : howLevers(pSteps, sessionItem, pulled, pictures);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(practice ? { practice: 'An easier question of the same kind, before the full item comes back.' } : {}),
        ...(reading || practice ? {} : leverFacts(pSteps, sessionItem, pulled)) },
      readyForResponse: !reading,
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || reading || !l || !sessionItem) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = simplerItem(pSteps, sessionItem, pictures);
          if (!simpler) return 'There is no easier question here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: workspaceAssignment(pSteps, simpler, pictures, question) };
        }
        if (id === TWO_CHOICES_LEVER && isChoice(sessionItem) && work.choice !== null && crossedOut(sessionItem).includes(work.choice)) {
          setWork(emptyWork());
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmittedEvaluation || submitted || scriptedDone || (tutorOwned && isComplete);

  // ── Pip shared surface ───────────────────────────────────────────
  // Nothing is published while the learner reads; from the first question on, the question and the answer.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: done || !started || !item ? null : item.id,
    label: 'The question and your answer',
    solved: revealed,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  // -------------------------------------------------------------------------
  // Render: Step Image
  // -------------------------------------------------------------------------
  const renderStepImage = (stepIndex: number, imagePrompt: string) => {
    const imageUrl = stepImages[stepIndex];
    const isLoading = loadingImages.has(stepIndex);
    const hasError = imageErrors.has(stepIndex);

    if (isLoading) {
      return (
        <SpotlightCard color={colors.rgb}>
          <div className="rounded-xl overflow-hidden bg-black/40 backdrop-blur-sm border border-white/10 p-8 flex flex-col items-center justify-center min-h-[200px]">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: colors.accent, borderTopColor: 'transparent' }} />
            <p className={`${colors.text} text-sm font-medium mb-2`}>Generating visualization...</p>
            <p className="text-xs text-slate-500 italic text-center max-w-sm">&quot;{imagePrompt}&quot;</p>
          </div>
        </SpotlightCard>
      );
    }

    if (imageUrl) {
      return (
        <SpotlightCard color={colors.rgb}>
          <div className="relative rounded-xl overflow-hidden bg-black/60 backdrop-blur-sm border border-white/10">
            <img src={imageUrl} alt={`Step ${stepIndex + 1}`} className="w-full h-auto object-cover" loading="lazy" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-3">
              <p className="text-xs text-slate-400 italic">{imagePrompt}</p>
            </div>
          </div>
        </SpotlightCard>
      );
    }

    return (
      <SpotlightCard color={colors.rgb}>
        <div className="rounded-xl overflow-hidden bg-black/20 backdrop-blur-sm border border-dashed border-white/20 p-6 flex flex-col items-center justify-center min-h-[180px]">
          <p className="text-slate-400 text-sm text-center mb-3 italic max-w-sm">{imagePrompt}</p>
          {!hasError && (
            <LuminaButton onClick={() => handleGenerateImage(stepIndex, imagePrompt)} className={`${colors.text} text-xs`}>
              Generate Visual
            </LuminaButton>
          )}
          {hasError && <p className="text-xs text-slate-600">Image generation unavailable</p>}
        </div>
      </SpotlightCard>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Single Step (scroll layout)
  // -------------------------------------------------------------------------
  const renderTimelineStep = (step: HowItWorksData['steps'][0], index: number) => {
    const isVisited = visitedSteps.has(index);

    return (
      <div key={index} ref={(el) => { stepRefs.current[index] = el; }} data-step-index={index} className="relative">
        {index < totalSteps - 1 && (
          <div className="absolute left-4 top-14 bottom-0 w-0.5" style={{ background: `linear-gradient(to bottom, ${colors.accent}40, ${colors.accent}10)` }} />
        )}

        <div className="flex gap-4">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-sm font-bold transition-all duration-500 mt-1"
            style={{
              backgroundColor: isVisited ? `${colors.accent}30` : 'rgba(255,255,255,0.05)',
              borderColor: isVisited ? `${colors.accent}60` : 'rgba(255,255,255,0.15)',
              borderWidth: '1px',
              color: isVisited ? colors.accent : 'rgb(148,163,184)',
            }}
          >
            {index + 1}
          </div>

          <div className="flex-1 space-y-3 pb-8">
            <h3 className="text-slate-100 text-base font-semibold">{step.title}</h3>
            <div className="max-w-lg">{renderStepImage(index, step.imagePrompt)}</div>
            <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>

            {step.keyTerm && (
              <button
                onClick={() => setShowKeyTermDef(prev => {
                  const next = new Set(prev);
                  if (next.has(index)) next.delete(index); else next.add(index);
                  return next;
                })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-all"
              >
                <span>Key Term:</span>
                <span className="font-semibold">{step.keyTerm.term}</span>
                <span className="text-amber-400/60">{showKeyTermDef.has(index) ? '▲' : '▼'}</span>
              </button>
            )}
            {step.keyTerm && showKeyTermDef.has(index) && (
              <p className="text-slate-400 text-xs border-l-2 border-amber-400/20 pl-3">{step.keyTerm.definition}</p>
            )}

            {step.whatsHappening && (
              <Accordion
                type="multiple"
                value={expandedDetails.has(index) ? [`detail-${index}`] : []}
                onValueChange={(vals) => {
                  if (vals.includes(`detail-${index}`)) {
                    if (!expandedDetails.has(index)) handleDetailExpand(index);
                  } else if (expandedDetails.has(index)) handleDetailExpand(index);
                }}
              >
                <AccordionItem value={`detail-${index}`} className="border-white/10">
                  <AccordionTrigger className="text-cyan-300 text-xs font-medium hover:text-cyan-200 py-2">
                    What&apos;s Happening?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 text-sm leading-relaxed pb-3">{step.whatsHappening}</AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {step.funFact && (
              <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-start gap-2">
                  <LuminaBadge accent="purple" className="text-[10px] shrink-0">Fun Fact</LuminaBadge>
                  <p className="text-slate-300 text-xs leading-relaxed">{step.funFact}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: the question
  // -------------------------------------------------------------------------
  const stepCard = (i: number, extra?: string) => (
    <div key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
      <span className="font-mono text-xs text-slate-500">{i + 1}.</span>
      {pSteps[i].emoji && <span className="text-2xl leading-none" aria-hidden="true">{pSteps[i].emoji}</span>}
      <span>{pSteps[i].title}</span>
      {extra && <span className="text-xs text-slate-500">{extra}</span>}
    </div>
  );

  /** The step list the item shows: all steps (guided, explain), the first ones (predict), or none. */
  const renderStrip = (it: HowItem) => {
    const shown = it.kind === 'predict' ? it.shown : it.kind === 'explain' || (it.kind === 'identify' && it.strip) ? pSteps.length : 0;
    if (!shown) return null;
    return (
      <div data-step-strip className="space-y-1.5">
        <p className="text-xs uppercase tracking-wider text-slate-500">{it.kind === 'predict' ? 'So far' : 'The steps, in order'}</p>
        <div className={pictures ? 'flex flex-wrap gap-2' : 'grid gap-1.5'}>
          {Array.from({ length: shown }, (_, i) => stepCard(i))}
          {it.kind === 'predict' && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-sm text-slate-500">
              <span className="font-mono text-xs">{it.shown + 1}.</span><span>?</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const choiceState = (o: number): AnswerChoiceState => {
    if (!item || !isChoice(item)) return 'idle';
    const key = keyStep(item);
    if (revealed) return o === key ? 'correct' : o === work.choice ? 'incorrect' : 'dimmed';
    if (wrongShown && work.choice === o) return 'incorrect';
    if (crossed.includes(o)) return 'dimmed';
    return work.choice === o ? 'selected' : 'idle';
  };

  const renderChoices = (it: Extract<HowItem, { kind: 'identify' | 'predict' | 'explain' }>) => (
    <div className={pictures ? 'flex flex-wrap justify-center gap-4' : 'space-y-2'}>
      {it.options.map(o => {
        const label = choiceText(pSteps, it, o);
        const out = crossed.includes(o);
        const number = it.kind === 'identify' && leverOn(STEP_NUMBERS_LEVER) && !practice
          ? <span className="mr-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-slate-300">Step {o + 1}</span> : null;
        if (pictures) {
          return (
            <button key={o} aria-label={label} disabled={closed || out} onClick={() => pick(o)}
              className={`w-28 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all duration-200 ${answerStateClasses[choiceState(o)]} ${out ? 'opacity-30 line-through' : ''}`}>
              <span className="text-5xl leading-none" aria-hidden="true">{pSteps[o].emoji}</span>
              <span className="text-slate-200 text-xs font-medium">{label}</span>
            </button>
          );
        }
        return (
          <LuminaAnswerChoice key={o} aria-label={label} state={choiceState(o)} disabled={closed || out}
            className={`p-3 text-sm ${out ? 'line-through opacity-50' : ''}`} onClick={() => pick(o)}>
            {number}{label}
          </LuminaAnswerChoice>
        );
      })}
    </div>
  );

  const renderSequence = (it: Extract<HowItem, { kind: 'sequence' }>) => {
    const why = leverOn(SHOW_WHY_LEVER) && !practice;
    const label = (s: number) => cardText(pSteps, it, s);
    const face = (s: number) => (
      <>
        {pSteps[s].emoji && <span className="text-4xl leading-none" aria-hidden="true">{pSteps[s].emoji}</span>}
        <span className="text-slate-200 text-sm">{label(s)}</span>
        {why && <span data-lever="show-why" className="block text-xs text-cyan-300/80">{whyLine(pSteps, s)}</span>}
      </>
    );
    const slotState: AnswerChoiceState = revealed ? 'correct' : wrongShown ? 'incorrect' : 'selected';
    return (
      <div className="space-y-4">
        <div className={pictures ? 'flex flex-wrap justify-center gap-3' : 'grid gap-2'}>
          {it.cards.map((_, k) => {
            const s = work.placed[k];
            const filled = s !== undefined;
            return (
              <button key={k} aria-label={filled ? `Take back ${label(s)}` : `Slot ${k + 1}`} disabled={!filled || closed}
                onClick={() => filled && unplace(k)}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all ${pictures ? 'w-28 h-32 flex-col justify-center text-center' : ''} ${filled ? answerStateClasses[slotState] : 'border-dashed border-white/15 bg-white/[0.02]'}`}>
                <span className="font-mono text-xs text-slate-500">{k + 1}</span>
                {filled && face(s)}
              </button>
            );
          })}
        </div>
        {work.placed.length < it.cards.length && (
          <div className={pictures ? 'flex flex-wrap justify-center gap-3' : 'grid gap-2 sm:grid-cols-2'}>
            {it.bank.filter(s => !work.placed.includes(s)).map(s => (
              <button key={s} aria-label={label(s)} data-step-id={`p${s}`} disabled={closed} onClick={() => place(s)}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 border-white/15 bg-slate-800/60 p-3 text-left transition-all hover:border-cyan-400/40 hover:bg-slate-700/60 active:scale-95 ${pictures ? 'w-28 h-32 items-center justify-center text-center' : ''}`}>
                {face(s)}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const revealText = (): string => {
    if (!item) return '';
    if (item.kind === 'sequence') return `The order: ${item.cards.map((s, k) => `${k + 1}) ${pSteps[s].title}`).join('  ')}.`;
    const key = keyStep(item);
    if (item.kind === 'identify') return pictures ? `That is the ${pSteps[key].title} picture.` : `That describes step ${key + 1}, "${pSteps[key].title}".`;
    if (item.kind === 'predict') return `Next comes step ${key + 1}: "${pSteps[key].title}".`;
    return `Step ${key + 1} matters because ${(pSteps[key].purpose ?? '').replace(/^[A-Z]/, c => c.toLowerCase())}`;
  };

  const renderQuestion = () => {
    if (!item) return null;
    const ask = askOf(pSteps, item, pictures, question);
    return (
      <div className="space-y-4">
        <LuminaPrompt accent="cyan" {...(practice ? { 'data-practice': 'easier' } : {})}>
          {item.kind === 'identify' ? (
            <div className="space-y-2">
              <p className="text-slate-100 text-sm font-medium">{pictures ? 'Which picture shows this?' : 'Which step does this describe?'}</p>
              <p className="text-slate-200 text-base italic">&ldquo;{clueOf(pSteps, item.target, pictures)}&rdquo;</p>
              {!pictures && <p className="text-xs text-slate-500">The step&apos;s own name is blanked out.</p>}
            </div>
          ) : (
            <p className="text-slate-100 text-sm font-medium">{ask}</p>
          )}
        </LuminaPrompt>

        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
          {renderStrip(item)}
          {item.kind === 'predict' && leverOn(LAST_STEP_LEVER) && !practice && (
            <LuminaPanel accent="cyan" data-lever="last-step" className="text-sm text-slate-300">
              {`Step ${item.shown}: ${lastStepLine(pSteps, item)}`}
            </LuminaPanel>
          )}
          {item.kind === 'explain' && leverOn(SHOW_STEP_LEVER) && !practice && (
            <LuminaPanel accent="cyan" data-lever="show-step" className="text-sm text-slate-300">
              {`Step ${item.target + 1}: ${showStepLine(pSteps, item)}`}
            </LuminaPanel>
          )}
          {item.kind === 'sequence' ? renderSequence(item) : renderChoices(item)}
        </div>

        {!revealed && !pictures && (
          <div className="flex justify-center">
            <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={() => checkWith(work)}>
              Check Answer
            </LuminaActionButton>
          </div>
        )}

        {revealed && (
          <LuminaFeedbackCard status={solvedNow ? 'correct' : 'insight'} label={solvedNow ? undefined : 'The answer'}>
            {revealText()}
          </LuminaFeedbackCard>
        )}
        {!revealed && wrongShown && (
          <LuminaFeedbackCard status="incorrect">{item.kind === 'sequence' ? 'That order is not right yet.' : 'That is not it.'}</LuminaFeedbackCard>
        )}
        {!revealed && feedback && <LuminaFeedbackCard status="incorrect">{feedback}</LuminaFeedbackCard>}

        {!tutorOwned && revealed && !practice && (
          <div className="flex justify-center">
            <LuminaActionButton action="next" onClick={next}>
              {currentIndex + 1 >= items.length ? 'See Results' : 'Next Question'}
            </LuminaActionButton>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = results.filter(a => a.correct).length;
    const accuracy = items.length > 0 ? Math.round((correctCount / items.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">{`${correctCount} of ${items.length} questions answered`}</p>
        {!pictures && (
          <div className="flex justify-center gap-4 text-xs text-slate-400">
            <span>{stepsExplored}/{totalSteps} steps explored</span>
            <span>{expandedDetails.size} details expanded</span>
            {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
          </div>
        )}
        {summary && !pictures && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-left">
            <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
          </div>
        )}
      </div>
    );
  };

  const startButton = (enabled: boolean) => (
    <LuminaActionButton action="next" aria-label={START_LABEL} disabled={!enabled} onClick={handleStart}
      className={pictures ? 'h-16 px-10 text-2xl' : 'w-full mt-3 text-xs h-8'}>
      {pictures ? '▶' : `${START_LABEL} (${items.length})`}
    </LuminaActionButton>
  );

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  const questionCard = (
    <SpotlightCard color={colors.rgb}>
      <LuminaCard className="border-0">
        <LuminaCardContent className="pt-6">
          <LuminaSectionLabel accent="cyan" size="sm" className="mb-3">
            {practice ? 'An easier one first' : `Question ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
          {renderQuestion()}
        </LuminaCardContent>
      </LuminaCard>
    </SpotlightCard>
  );
  const doneCard = (
    <LuminaCard>
      <LuminaCardContent className="pt-6">
        {tutorOwned ? <LuminaFeedbackCard status="insight" label="All questions answered">{`${results.filter(r => r.correct).length} of ${items.length} questions answered.`}</LuminaFeedbackCard>
          : renderResults()}
      </LuminaCardContent>
    </LuminaCard>
  );

  // Pre-reader: the picture story (in order, read aloud by the tutor), then the picture questions. No magazine chrome.
  if (pictures) {
    return (
      <div data-how-it-works className={`space-y-6 py-4 ${className || ''}`}>
        {done ? doneCard : !started ? (
          <div className="space-y-8">
            <p className="text-slate-100 text-xl font-semibold text-center">{title}</p>
            <div className="flex justify-center gap-4 flex-wrap">
              {pSteps.map((s, i) => (
                <div key={i} className="w-28 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-white/15 bg-slate-800/60">
                  <span className="text-5xl leading-none" aria-hidden="true">{s.emoji}</span>
                  <span className="text-slate-200 text-xs font-medium">{s.title}</span>
                </div>
              ))}
            </div>
            {items.length > 0 && <div className="flex justify-center">{startButton(true)}</div>}
          </div>
        ) : (
          <div className="space-y-6">
            {renderQuestion()}
            {revealed && solvedNow && item?.kind === 'sequence' && !practice && <div className="text-center text-6xl animate-bounce">🎉</div>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-how-it-works className={`space-y-6 ${className || ''}`}>
      {/* ── Header Card ── */}
      <LuminaCard className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90">
        <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-[120px] opacity-20 pointer-events-none" style={{ backgroundColor: colors.accent }} />
        <LuminaCardHeader className="relative z-10 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{colors.icon}</span>
              <div>
                <LuminaCardTitle className="text-xl font-bold">How It Works: {title}</LuminaCardTitle>
                {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {category && (
                <LuminaBadge className="text-xs" style={{ backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}40`, color: colors.accent }}>
                  {category}
                </LuminaBadge>
              )}
              <LuminaBadge accent="cyan" className="text-xs">{totalSteps} Steps</LuminaBadge>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">{overview}</p>
        </LuminaCardHeader>
      </LuminaCard>

      {done ? doneCard : started ? questionCard : (
        <>
          {/* ── Two-Column Layout: Timeline + Sidebar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-2">
              {steps.map((step, i) => renderTimelineStep(step, i))}
            </div>

            <div className="space-y-4">
              {quickFactEntries.length > 0 && (
                <SpotlightCard color={colors.rgb}>
                  <LuminaCard className="border-0">
                    <LuminaCardContent className="pt-5 pb-4">
                      <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>Quick Facts</p>
                      <div className="space-y-2.5">
                        {quickFactEntries.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-sm shrink-0">{entry.label.split(' ')[0]}</span>
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase tracking-wider">{entry.label.split(' ').slice(1).join(' ')}</p>
                              <p className="text-slate-200 text-sm">{entry.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </LuminaCardContent>
                  </LuminaCard>
                </SpotlightCard>
              )}

              {summary && (
                <SpotlightCard color={colors.rgb}>
                  <LuminaCard className="border-0">
                    <LuminaCardContent className="pt-5 pb-4">
                      <Accordion type="multiple" defaultValue={['summary']}>
                        <AccordionItem value="summary" className="border-white/10">
                          <AccordionTrigger className={`${colors.text} text-xs font-medium uppercase tracking-wider py-2`}>Process Summary</AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-3">
                            <p className="text-slate-200 text-sm leading-relaxed">{summary.text}</p>
                            {summary.totalTime && (
                              <div className="flex items-center gap-2">
                                <LuminaBadge className="text-xs">Duration</LuminaBadge>
                                <span className="text-slate-300 text-xs">{summary.totalTime}</span>
                              </div>
                            )}
                            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                              <p className="text-emerald-300 text-xs font-medium mb-1">Key Takeaway</p>
                              <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </LuminaCardContent>
                  </LuminaCard>
                </SpotlightCard>
              )}

              {allKeyTerms.length > 0 && (
                <SpotlightCard color={colors.rgb}>
                  <LuminaCard className="border-0">
                    <LuminaCardContent className="pt-5 pb-4">
                      <Accordion type="multiple">
                        <AccordionItem value="glossary" className="border-white/10">
                          <AccordionTrigger className="text-amber-300 text-xs font-medium uppercase tracking-wider py-2">
                            Glossary ({allKeyTerms.length} terms)
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-3">
                            {allKeyTerms.map((kt, i) => (
                              <div key={i} className="space-y-0.5">
                                <p className="text-amber-300 text-xs font-semibold">
                                  {kt.term}
                                  <span className="text-slate-600 font-normal ml-1.5">Step {kt.stepNumber}</span>
                                </p>
                                <p className="text-slate-400 text-xs leading-relaxed">{kt.definition}</p>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </LuminaCardContent>
                  </LuminaCard>
                </SpotlightCard>
              )}

              {/* Exploration progress, and the way into the questions */}
              <LuminaCard>
                <LuminaCardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-xs">{stepsExplored} of {totalSteps} steps explored</span>
                    {allStepsExplored && <LuminaBadge accent="emerald" className="text-[10px]">Complete</LuminaBadge>}
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(stepsExplored / Math.max(totalSteps, 1)) * 100}%`, backgroundColor: colors.accent }} />
                  </div>
                  {items.length > 0 && (tutorOwned || allStepsExplored) && startButton(true)}
                  {items.length > 0 && !tutorOwned && !allStepsExplored && (
                    <p className="text-slate-600 text-[10px] mt-2">Scroll through all steps to unlock the questions</p>
                  )}
                </LuminaCardContent>
              </LuminaCard>
            </div>
          </div>

          {allFunFacts.length > 1 && (
            <div>
              <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>Fascinating Facts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allFunFacts.map((ff, i) => (
                  <SpotlightCard key={i} color={colors.rgb}>
                    <div className={`p-4 rounded-xl ${surface.glass}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-purple-400 text-sm shrink-0">✨</span>
                        <div>
                          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Step {ff.stepNumber}</p>
                          <p className="text-slate-200 text-sm leading-relaxed">{ff.fact}</p>
                        </div>
                      </div>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          )}

          {realWorldExamples && realWorldExamples.length > 0 && (
            <SpotlightCard color={colors.rgb}>
              <LuminaCard className="border-0">
                <LuminaCardContent className="pt-5 pb-4">
                  <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>Real World Examples</p>
                  <div className="flex flex-wrap gap-2">
                    {realWorldExamples.map((ex, i) => (
                      <LuminaBadge key={i} className="text-slate-200 text-xs font-normal px-3 py-1">{ex}</LuminaBadge>
                    ))}
                  </div>
                </LuminaCardContent>
              </LuminaCard>
            </SpotlightCard>
          )}

          {relatedProcesses && relatedProcesses.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="text-slate-600 text-xs uppercase tracking-wider">Explore next:</span>
              {relatedProcesses.map((rp, i) => (
                <LuminaBadge key={i} className="text-xs font-normal px-3 py-1 cursor-default"
                  style={{ backgroundColor: `${colors.accent}10`, borderColor: `${colors.accent}30`, color: colors.accent }}>
                  {rp}
                </LuminaBadge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const HowItWorks = withWorkspaceController<HowItWorksProps, ProgressOptions<HowItem>, Progress>(
  'how-it-works', HowItWorksSurface, useScriptedProgress, useWorkspaceProgressFor('how-it-works'));

export default HowItWorks;
