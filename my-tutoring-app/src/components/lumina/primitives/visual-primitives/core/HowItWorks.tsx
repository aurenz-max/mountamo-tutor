'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaButton,
  LuminaSectionLabel,
  LuminaAnswerChoice,
  LuminaActionButton,
  answerStateClasses,
  surface,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HowItWorksMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

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

  challenges?: Array<{
    type: 'sequence' | 'identify' | 'predict' | 'explain';
    question: string;
    // For sequence: items to reorder
    sequenceItems?: Array<{ id: string; text: string }>;
    correctOrder?: string[];
    // For identify/predict/explain: multiple choice
    options?: string[];
    correctIndex?: number;
    explanation: string;
    relatedStep: number;
  }>;

  // ── Pre-reader (K / PRE band) subset ──
  // When present, the primitive renders the picture-primary "put the steps in
  // order" task INSTEAD of the reading-heavy magazine + text quiz. The generator
  // only emits this at the Kindergarten/Preschool band (the emoji is the answer
  // surface, steps are authored in correct order, and the tutor reads each step
  // aloud). Its presence IS the band signal — the component honors the payload.
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

// ============================================================================
// Props
// ============================================================================

interface HowItWorksProps {
  data: HowItWorksData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const HowItWorks: React.FC<HowItWorksProps> = ({ data, className }) => {
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
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const colors = PROCESS_CATEGORIES[category || ''] || DEFAULT_COLORS;

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

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeAnswers, setChallengeAnswers] = useState<Array<{ correct: boolean; attempts: number }>>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false);
  const [allChallengesComplete, setAllChallengesComplete] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Sequence challenge state
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([]);
  const [sequenceChecked, setSequenceChecked] = useState(false);
  const [sequenceCorrect, setSequenceCorrect] = useState(false);

  // ── Pre-reader (K / PRE) picture-order state ──
  const preReader = data.preReader;
  const [preOrder, setPreOrder] = useState<string[]>([]); // placed ids, in order
  const [preTray, setPreTray] = useState<string[]>([]);   // shuffled remaining ids
  const [preStatus, setPreStatus] = useState<'idle' | 'wrong' | 'correct'>('idle');
  const preInitRef = useRef(false);
  const preOrientedRef = useRef(false);

  // Timing
  const stepEntryTimes = useRef<Record<number, number>>({ 0: Date.now() });
  const [stepTimes, setStepTimes] = useState<number[]>([]);

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `how-it-works-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const totalSteps = steps.length;
  const stepsExplored = visitedSteps.size;
  const allStepsExplored = stepsExplored >= totalSteps;

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
  // AI Tutoring Integration
  // -------------------------------------------------------------------------
  const aiPrimitiveData = useMemo(() => ({
    title,
    overview,
    totalSteps,
    stepsExplored,
    challengesCompleted: challengeAnswers.length,
    totalChallenges: challenges.length,
  }), [title, overview, totalSteps, stepsExplored, challengeAnswers.length, challenges.length]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'how-it-works',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
  });

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    // Pre-reader has its own spoken ORIENT beat below — skip the magazine intro.
    if (!isConnected || hasIntroducedRef.current || preReader) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] How It Works: "${title}" — ${subtitle}. `
      + `${totalSteps} steps to explore. ${challenges.length > 0 ? `${challenges.length} comprehension challenges after.` : ''} `
      + `Overview: ${overview}. Introduce the process warmly and encourage step-by-step exploration.`,
      { silent: true }
    );
  }, [isConnected, title, subtitle, overview, totalSteps, challenges.length, sendText]);

  // -------------------------------------------------------------------------
  // IntersectionObserver for scroll-based step tracking
  // -------------------------------------------------------------------------
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
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
              // Record entry time
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
  }, [steps.length]);

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
        if (isConnected) {
          sendText(
            `[DETAIL_EXPANDED] Student opened "What's Happening?" for Step ${stepIndex + 1}: "${steps[stepIndex]?.title}". `
            + `React with enthusiasm and add a relatable comparison or context.`,
            { silent: true }
          );
        }
      }
      return next;
    });
  }, [steps, isConnected, sendText]);

  // Track all steps explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allStepsExplored && !hasNotifiedAllExploredRef.current && isConnected && !preReader) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_STEPS_EXPLORED] Student explored all ${totalSteps} steps! `
        + `${challenges.length > 0 ? `${challenges.length} comprehension challenges coming up.` : 'Process complete!'} `
        + `Celebrate and summarize the full process in one sentence.`,
        { silent: true }
      );
    }
  }, [allStepsExplored, totalSteps, challenges.length, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Handling
  // -------------------------------------------------------------------------
  const currentChallenge = challenges[currentChallengeIndex] ?? null;

  // Effective answer key for the active sequence challenge. Generated content
  // can ship an empty or mismatched `correctOrder` (flash-lite drops the CSV) —
  // an empty key makes every arrangement "wrong" and bricks the lesson. When the
  // key is not a clean permutation of the item IDs, fall back to the authored
  // item order (items are authored in correct order; the board is shuffled for
  // display), so the challenge is always winnable.
  const sequenceKey = useMemo(() => {
    if (!currentChallenge || currentChallenge.type !== 'sequence') return [] as string[];
    const ids = (currentChallenge.sequenceItems ?? []).map(i => i.id);
    const key = currentChallenge.correctOrder ?? [];
    const valid =
      key.length === ids.length &&
      new Set(key).size === ids.length &&
      key.every(id => ids.includes(id));
    return valid ? key : ids;
  }, [currentChallenge]);

  const handleStartChallenges = useCallback(() => {
    SoundManager.tap();
    setShowChallenges(true);
    setCurrentChallengeIndex(0);
    setCurrentAttempts(0);
    if (challenges[0]?.type === 'sequence' && challenges[0].sequenceItems) {
      setSequenceOrder(shuffleArray(challenges[0].sequenceItems.map(i => i.id)));
    }
  }, [challenges]);

  const handleMCAnswer = useCallback((optionIndex: number) => {
    if (!currentChallenge || showChallengeFeedback) return;
    if (currentChallenge.type !== 'identify' && currentChallenge.type !== 'predict' && currentChallenge.type !== 'explain') return;

    setSelectedOption(optionIndex);
    setShowChallengeFeedback(true);

    const correct = optionIndex === currentChallenge.correctIndex;
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);

    if (correct) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Challenge ${currentChallengeIndex + 1}/${challenges.length} (${currentChallenge.type}): `
        + `"${currentChallenge.question}" — Student chose "${currentChallenge.options?.[optionIndex]}". `
        + `${correct
          ? 'Correct! Celebrate and reinforce understanding.'
          : `Incorrect. Related to Step ${currentChallenge.relatedStep}. Hint at the relevant step without giving the answer.`
        }`,
        { silent: true }
      );
    }
  }, [currentChallenge, currentChallengeIndex, challenges, showChallengeFeedback, currentAttempts, isConnected, sendText]);

  const handleSequenceCheck = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'sequence') return;

    const correct = JSON.stringify(sequenceOrder) === JSON.stringify(sequenceKey);
    const attempts = currentAttempts + 1;
    setCurrentAttempts(attempts);
    setSequenceChecked(true);
    setSequenceCorrect(correct);

    if (correct) {
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
    }

    if (correct || attempts >= 2) {
      setChallengeAnswers(prev => [...prev, { correct, attempts }]);
      setShowChallengeFeedback(true);
    }

    if (isConnected) {
      const tag = correct ? '[CHALLENGE_CORRECT]' : '[CHALLENGE_INCORRECT]';
      sendText(
        `${tag} Sequence challenge: "${currentChallenge.question}" — `
        + `${correct ? 'Student placed all steps in the correct order!' : 'Student has the wrong order. Ask "What needs to happen BEFORE this?"'}`,
        { silent: true }
      );
    }
  }, [currentChallenge, sequenceOrder, sequenceKey, currentAttempts, isConnected, sendText]);

  const recordAllStepTimes = useCallback(() => {
    const now = Date.now();
    const times = steps.map((_, i) => {
      const entry = stepEntryTimes.current[i];
      return entry ? now - entry : 0;
    });
    setStepTimes(times);
  }, [steps]);

  const handleNextChallenge = useCallback(() => {
    setSelectedOption(null);
    setShowChallengeFeedback(false);
    setSequenceChecked(false);
    setSequenceCorrect(false);
    setCurrentAttempts(0);

    if (currentChallengeIndex + 1 >= challenges.length) {
      setAllChallengesComplete(true);
      recordAllStepTimes();

      const correctCount = challengeAnswers.filter(a => a.correct).length;
      const totalAttempts = challengeAnswers.reduce((sum, a) => sum + a.attempts, 0);
      const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;

      if (isConnected) {
        sendText(
          `[ALL_COMPLETE] Student finished all ${challenges.length} challenges. `
          + `Accuracy: ${accuracy}%. Steps explored: ${stepsExplored}/${totalSteps}. `
          + `Details expanded: ${expandedDetails.size}. `
          + `Celebrate and give specific feedback on their understanding of the process.`,
          { silent: true }
        );
      }

      if (!hasSubmittedEvaluation) {
        const avgTimePerStep = totalSteps > 0
          ? Math.round(stepTimes.reduce((a, b) => a + (b || 0), 0) / totalSteps)
          : 0;

        const byType = (type: string) => {
          const relevant = challenges
            .map((c, i) => ({ ...c, answer: challengeAnswers[i] }))
            .filter(c => c.type === type && c.answer);
          if (relevant.length === 0) return 0;
          return Math.round((relevant.filter(c => c.answer?.correct).length / relevant.length) * 100);
        };

        const metrics: HowItWorksMetrics = {
          type: 'how-it-works',
          stepsExplored,
          totalSteps,
          detailsExpanded: expandedDetails.size,
          sequenceAccuracy: byType('sequence'),
          identifyAccuracy: byType('identify'),
          predictAccuracy: byType('predict'),
          challengeAttempts: totalAttempts,
          averageTimePerStep: avgTimePerStep,
        };

        const overallScore = Math.round(
          (stepsExplored / Math.max(totalSteps, 1)) * 30 + accuracy * 0.7
        );

        submitEvaluation(
          accuracy >= 70 && stepsExplored >= totalSteps,
          overallScore,
          metrics,
          { challengeAnswers: [...challengeAnswers] }
        );
      }
    } else {
      const nextIdx = currentChallengeIndex + 1;
      setCurrentChallengeIndex(nextIdx);
      if (challenges[nextIdx]?.type === 'sequence' && challenges[nextIdx].sequenceItems) {
        setSequenceOrder(shuffleArray(challenges[nextIdx].sequenceItems!.map(i => i.id)));
      }
    }
  }, [
    currentChallengeIndex, challenges, challengeAnswers, stepsExplored, totalSteps,
    expandedDetails, stepTimes, isConnected, sendText, hasSubmittedEvaluation,
    submitEvaluation, recordAllStepTimes,
  ]);

  // Auto-submit for display-only mode (no challenges)
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    // PRE renders the ordering task (its own submit path) — never auto-submit it
    // just because the empty magazine step list counts as "all explored".
    if (challenges.length === 0 && allStepsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current && !preReader) {
      hasAutoSubmittedRef.current = true;
      const avgTimePerStep = totalSteps > 0
        ? Math.round(stepTimes.reduce((a, b) => a + (b || 0), 0) / totalSteps)
        : 0;

      const metrics: HowItWorksMetrics = {
        type: 'how-it-works',
        stepsExplored,
        totalSteps,
        detailsExpanded: expandedDetails.size,
        sequenceAccuracy: 0,
        identifyAccuracy: 0,
        predictAccuracy: 0,
        challengeAttempts: 0,
        averageTimePerStep: avgTimePerStep,
      };

      submitEvaluation(true, 100, metrics, {});
    }
  }, [challenges.length, allStepsExplored, hasSubmittedEvaluation, stepsExplored, totalSteps, expandedDetails, stepTimes, submitEvaluation]);

  // -------------------------------------------------------------------------
  // Sequence reorder helper
  // -------------------------------------------------------------------------
  const moveSequenceItem = useCallback((fromIndex: number, direction: number) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= sequenceOrder.length) return;
    SoundManager.tick();
    setSequenceOrder(prev => {
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next;
    });
    setSequenceChecked(false);
  }, [sequenceOrder.length]);

  // -------------------------------------------------------------------------
  // Pre-reader (K / PRE) picture-order handlers + spoken beats
  // -------------------------------------------------------------------------
  // Seed the shuffled tray once.
  useEffect(() => {
    if (!preReader || preInitRef.current) return;
    preInitRef.current = true;
    setPreTray(shuffleArray(preReader.steps.map(s => s.id)));
  }, [preReader]);

  // ORIENT + STIMULUS: read the question and every step aloud on connect. Not
  // silent — this IS the spoken instruction channel for a non-reader. (The
  // catalog aiDirective reinforces it so it survives the lesson one-sentence cap.)
  useEffect(() => {
    if (!preReader || !isConnected || preOrientedRef.current) return;
    preOrientedRef.current = true;
    const stepsScript = preReader.steps.map((s, i) => `${i + 1}) ${s.spoken}`).join(' ');
    sendText(
      `[ACTIVITY_START_PRE] You are helping a child who cannot read. Warmly read the question aloud, then read every step out loud in order — word for word — and invite them to tap the pictures to put them in order. `
      + `Question: "${preReader.question}" Steps in order: ${stepsScript} `
      + `Reading these aloud IS your greeting — do not shorten it or skip any step, and never say the final order as the answer.`,
      {},
    );
  }, [preReader, isConnected, sendText]);

  const handlePrePlace = useCallback((id: string) => {
    if (preStatus === 'correct') return;
    SoundManager.tap();
    setPreStatus('idle');
    setPreTray(prev => prev.filter(x => x !== id));
    setPreOrder(prev => [...prev, id]);
  }, [preStatus]);

  const handlePreUndo = useCallback((position: number) => {
    if (preStatus === 'correct') return;
    SoundManager.tick();
    setPreStatus('idle');
    setPreOrder(prev => {
      const id = prev[position];
      if (id === undefined) return prev;
      setPreTray(t => [...t, id]);
      return prev.filter((_, i) => i !== position);
    });
  }, [preStatus]);

  // Auto-evaluate when every slot is filled (tap=choose, no Check button).
  const preSubmittedRef = useRef(false);
  useEffect(() => {
    if (!preReader || preStatus === 'correct') return;
    if (preOrder.length !== preReader.steps.length) return;
    const key = preReader.steps.map(s => s.id); // authored order = correct order
    const correct = preOrder.every((id, i) => id === key[i]);

    if (correct) {
      setPreStatus('correct');
      SoundManager.playCorrect();
      if (isConnected) {
        sendText(
          `[PRE_COMPLETE] The child put all ${preReader.steps.length} steps in the right order. Celebrate warmly in ONE short sentence.`,
          {},
        );
      }
      if (!hasSubmittedEvaluation && !preSubmittedRef.current) {
        preSubmittedRef.current = true;
        const metrics: HowItWorksMetrics = {
          type: 'how-it-works',
          stepsExplored: preReader.steps.length,
          totalSteps: preReader.steps.length,
          detailsExpanded: 0,
          sequenceAccuracy: 100,
          identifyAccuracy: 0,
          predictAccuracy: 0,
          challengeAttempts: 1,
          averageTimePerStep: 0,
        };
        submitEvaluation(true, 100, metrics, {});
      }
    } else {
      setPreStatus('wrong');
      SoundManager.playIncorrect();
      if (isConnected) {
        sendText(
          `[PRE_WRONG] The child ordered the steps but it isn't right yet. Give ONE warm, encouraging spoken hint about what happens FIRST — never say the whole order. Invite them to move a picture and try again.`,
          {},
        );
      }
    }
  }, [preOrder, preReader, preStatus, isConnected, sendText, hasSubmittedEvaluation, submitEvaluation]);

  const handlePreReplay = useCallback(() => {
    SoundManager.tap();
    if (isConnected && preReader) {
      const stepsScript = preReader.steps.map((s, i) => `${i + 1}) ${s.spoken}`).join(' ');
      sendText(
        `[PRE_REPLAY] Read the question and every step aloud again, in order, word for word: "${preReader.question}" ${stepsScript}`,
        {},
      );
    }
  }, [isConnected, preReader, sendText]);

  // -------------------------------------------------------------------------
  // Render: Pre-reader picture-order task
  // -------------------------------------------------------------------------
  const renderPreReader = () => {
    if (!preReader) return null;
    const byId = (id: string) => preReader.steps.find(s => s.id === id);

    return (
      <div className="space-y-8 py-4">
        {/* Spoken prompt + replay (the ONLY words on screen are a caption) */}
        <div className="flex items-center justify-center gap-3">
          <p className="text-slate-100 text-xl font-semibold text-center">{preReader.question}</p>
          <button
            onClick={handlePreReplay}
            aria-label="Read to me"
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xl hover:bg-cyan-500/25 transition-all"
          >
            🔊
          </button>
        </div>

        {/* Order slots (tap a filled card to send it back) */}
        <div className="flex justify-center gap-4 flex-wrap">
          {preReader.steps.map((_, position) => {
            const id = preOrder[position];
            const step = id ? byId(id) : undefined;
            const filled = !!step;
            const state: AnswerChoiceState =
              preStatus === 'correct' && filled ? 'correct'
              : preStatus === 'wrong' && filled ? 'incorrect'
              : filled ? 'selected'
              : 'idle';
            return (
              <button
                key={position}
                onClick={() => filled && handlePreUndo(position)}
                disabled={!filled || preStatus === 'correct'}
                className={`w-28 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-all duration-200 ${
                  filled ? answerStateClasses[state] : 'border-dashed border-white/15 bg-white/[0.02]'
                }`}
              >
                {step ? (
                  <>
                    <span className="text-5xl leading-none">{step.emoji}</span>
                    <span className="text-slate-200 text-xs font-medium">{step.label}</span>
                  </>
                ) : (
                  <span className="text-slate-600 text-3xl font-bold">{position + 1}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tray of remaining picture cards (tap to place) */}
        {preTray.length > 0 && (
          <div className="flex justify-center gap-4 flex-wrap">
            {preTray.map(id => {
              const step = byId(id);
              if (!step) return null;
              return (
                <button
                  key={id}
                  data-step-id={id}
                  onClick={() => handlePrePlace(id)}
                  className="w-28 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-white/15 bg-slate-800/60 hover:bg-slate-700/60 hover:border-cyan-400/40 transition-all duration-200 active:scale-95"
                >
                  <span className="text-5xl leading-none">{step.emoji}</span>
                  <span className="text-slate-200 text-xs font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {preStatus === 'correct' && (
          <div className="text-center text-6xl animate-bounce">🎉</div>
        )}
      </div>
    );
  };

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
            <img
              src={imageUrl}
              alt={`Step ${stepIndex + 1}`}
              className="w-full h-auto object-cover"
              loading="lazy"
            />
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
            <LuminaButton
              onClick={() => handleGenerateImage(stepIndex, imagePrompt)}
              className={`${colors.text} text-xs`}
            >
              Generate Visual
            </LuminaButton>
          )}
          {hasError && (
            <p className="text-xs text-slate-600">Image generation unavailable</p>
          )}
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
      <div
        key={index}
        ref={(el) => { stepRefs.current[index] = el; }}
        data-step-index={index}
        className="relative"
      >
        {/* Timeline connector line */}
        {index < totalSteps - 1 && (
          <div
            className="absolute left-4 top-14 bottom-0 w-0.5"
            style={{
              background: `linear-gradient(to bottom, ${colors.accent}40, ${colors.accent}10)`,
            }}
          />
        )}

        <div className="flex gap-4">
          {/* Step number circle */}
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

          {/* Step content */}
          <div className="flex-1 space-y-3 pb-8">
            <h3 className="text-slate-100 text-base font-semibold">{step.title}</h3>

            {/* Step image */}
            <div className="max-w-lg">
              {renderStepImage(index, step.imagePrompt)}
            </div>

            <p className="text-slate-300 text-sm leading-relaxed">{step.description}</p>

            {/* Key Term callout */}
            {step.keyTerm && (
              <button
                onClick={() => setShowKeyTermDef(prev => {
                  const next = new Set(prev);
                  next.has(index) ? next.delete(index) : next.add(index);
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
              <p className="text-slate-400 text-xs border-l-2 border-amber-400/20 pl-3">
                {step.keyTerm.definition}
              </p>
            )}

            {/* What's Happening? accordion */}
            {step.whatsHappening && (
              <Accordion
                type="multiple"
                value={expandedDetails.has(index) ? [`detail-${index}`] : []}
                onValueChange={(vals) => {
                  if (vals.includes(`detail-${index}`)) {
                    if (!expandedDetails.has(index)) handleDetailExpand(index);
                  } else {
                    if (expandedDetails.has(index)) handleDetailExpand(index);
                  }
                }}
              >
                <AccordionItem value={`detail-${index}`} className="border-white/10">
                  <AccordionTrigger className="text-cyan-300 text-xs font-medium hover:text-cyan-200 py-2">
                    What&apos;s Happening?
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-300 text-sm leading-relaxed pb-3">
                    {step.whatsHappening}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            {/* Inline fun fact (kept small — promoted grid is below) */}
            {step.funFact && (
              <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10">
                <div className="flex items-start gap-2">
                  <LuminaBadge accent="purple" className="text-[10px] shrink-0">
                    Fun Fact
                  </LuminaBadge>
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
  // Render: Challenge
  // -------------------------------------------------------------------------
  const renderChallenge = () => {
    if (!currentChallenge) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Challenge {currentChallengeIndex + 1} of {challenges.length}
          </p>
          <LuminaBadge className="text-xs">
            {currentChallenge.type}
          </LuminaBadge>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentChallenge.question}</p>

        {/* Multiple choice (identify / predict / explain) */}
        {(currentChallenge.type === 'identify' || currentChallenge.type === 'predict' || currentChallenge.type === 'explain') && currentChallenge.options && (
          <div className="space-y-2">
            {currentChallenge.options.map((opt, i) => {
              const isSelected = selectedOption === i;
              const isCorrectOption = i === currentChallenge.correctIndex;

              let state: AnswerChoiceState;
              if (!showChallengeFeedback) {
                state = isSelected ? 'selected' : 'idle';
              } else if (isCorrectOption) {
                state = 'correct';
              } else if (isSelected) {
                state = 'incorrect';
              } else {
                state = 'dimmed';
              }

              return (
                <LuminaAnswerChoice
                  key={i}
                  state={state}
                  className="p-3 text-sm"
                  onClick={() => handleMCAnswer(i)}
                  disabled={showChallengeFeedback}
                >
                  {opt}
                </LuminaAnswerChoice>
              );
            })}
          </div>
        )}

        {/* Sequence challenge */}
        {currentChallenge.type === 'sequence' && currentChallenge.sequenceItems && (
          <div className="space-y-2">
            {sequenceOrder.map((id, position) => {
              const item = currentChallenge.sequenceItems!.find(si => si.id === id);
              if (!item) return null;

              const isCorrectPosition = sequenceChecked && sequenceKey[position] === id;
              const isWrongPosition = sequenceChecked && !sequenceCorrect && sequenceKey[position] !== id;

              const itemState: AnswerChoiceState = isCorrectPosition
                ? 'correct'
                : isWrongPosition
                  ? 'incorrect'
                  : 'idle';

              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${answerStateClasses[itemState]}`}
                >
                  <span className="text-slate-500 text-xs font-mono w-4">{position + 1}.</span>
                  <span className="text-slate-200 text-sm flex-1">{item.text}</span>
                  {!showChallengeFeedback && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveSequenceItem(position, -1)}
                        disabled={position === 0}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveSequenceItem(position, 1)}
                        disabled={position === sequenceOrder.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {!showChallengeFeedback && (
              <div className="flex justify-center pt-2">
                <LuminaActionButton action="check" onClick={handleSequenceCheck}>
                  Check Order
                </LuminaActionButton>
              </div>
            )}
            {sequenceChecked && !sequenceCorrect && !showChallengeFeedback && (
              <p className="text-amber-400 text-xs text-center">Not quite — try rearranging and check again!</p>
            )}
          </div>
        )}

        {/* Feedback */}
        {showChallengeFeedback && (
          <div className="space-y-3">
            <p className={`text-sm font-medium ${
              challengeAnswers[challengeAnswers.length - 1]?.correct ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {challengeAnswers[challengeAnswers.length - 1]?.correct ? 'Correct!' : 'Not quite, but let\'s keep going.'}
            </p>
            <p className="text-slate-400 text-xs">{currentChallenge.explanation}</p>
            <div className="flex justify-center">
              <LuminaActionButton action="next" onClick={handleNextChallenge}>
                {currentChallengeIndex + 1 >= challenges.length ? 'See Results' : 'Next Challenge'}
              </LuminaActionButton>
            </div>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = challengeAnswers.filter(a => a.correct).length;
    const accuracy = challenges.length > 0 ? Math.round((correctCount / challenges.length) * 100) : 0;
    const score = submittedResult?.score ?? accuracy;

    return (
      <div className="text-center space-y-4 py-4">
        <div className="text-3xl font-bold text-emerald-400">{score}%</div>
        <p className="text-slate-200 text-sm font-medium">Process Mastered!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          <span>{stepsExplored}/{totalSteps} steps explored</span>
          <span>{correctCount}/{challenges.length} challenges correct</span>
          <span>{expandedDetails.size} details expanded</span>
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
        {summary && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-left">
            <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
          </div>
        )}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  // Pre-reader (K / PRE) subset: the picture-order task replaces the whole
  // reading-heavy magazine + text quiz. No header chrome, no counters — the
  // emoji cards are the entire surface and the tutor carries the words.
  if (preReader) {
    return (
      <div className={`space-y-6 ${className || ''}`}>
        {renderPreReader()}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* ── Header Card ── */}
      <LuminaCard className="relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-800/90">
        {/* Ambient glow orb */}
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ backgroundColor: colors.accent }}
        />

        <LuminaCardHeader className="relative z-10 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{colors.icon}</span>
              <div>
                <LuminaCardTitle className="text-xl font-bold">
                  How It Works: {title}
                </LuminaCardTitle>
                {subtitle && <p className="text-slate-400 text-sm mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {category && (
                <LuminaBadge
                  className="text-xs"
                  style={{
                    backgroundColor: `${colors.accent}15`,
                    borderColor: `${colors.accent}40`,
                    color: colors.accent,
                  }}
                >
                  {category}
                </LuminaBadge>
              )}
              <LuminaBadge accent="cyan" className="text-xs">
                {totalSteps} Steps
              </LuminaBadge>
            </div>
          </div>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">{overview}</p>
        </LuminaCardHeader>
      </LuminaCard>

      {allChallengesComplete ? (
        /* ── Results ── */
        <LuminaCard>
          <LuminaCardContent className="pt-6">
            {renderResults()}
          </LuminaCardContent>
        </LuminaCard>
      ) : showChallenges ? (
        /* ── Challenge Section ── */
        <SpotlightCard color={colors.rgb}>
          <LuminaCard className="border-0">
            <LuminaCardContent className="pt-6">
              <LuminaSectionLabel accent="cyan" size="sm" className="mb-3">
                Comprehension Check
              </LuminaSectionLabel>
              {renderChallenge()}
            </LuminaCardContent>
          </LuminaCard>
        </SpotlightCard>
      ) : (
        <>
          {/* ── Two-Column Layout: Timeline + Sidebar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Timeline Steps (2/3 width) */}
            <div className="lg:col-span-2 space-y-2">
              {steps.map((step, i) => renderTimelineStep(step, i))}
            </div>

            {/* Right column: Quick Facts + Summary (1/3 width) */}
            <div className="space-y-4">
              {/* Quick Facts */}
              {quickFactEntries.length > 0 && (
                <SpotlightCard color={colors.rgb}>
                  <LuminaCard className="border-0">
                    <LuminaCardContent className="pt-5 pb-4">
                      <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>
                        Quick Facts
                      </p>
                      <div className="space-y-2.5">
                        {quickFactEntries.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-sm shrink-0">{entry.label.split(' ')[0]}</span>
                            <div>
                              <p className="text-slate-500 text-[10px] uppercase tracking-wider">
                                {entry.label.split(' ').slice(1).join(' ')}
                              </p>
                              <p className="text-slate-200 text-sm">{entry.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </LuminaCardContent>
                  </LuminaCard>
                </SpotlightCard>
              )}

              {/* Process Summary */}
              {summary && (
                <SpotlightCard color={colors.rgb}>
                  <LuminaCard className="border-0">
                    <LuminaCardContent className="pt-5 pb-4">
                      <Accordion type="multiple" defaultValue={['summary']}>
                        <AccordionItem value="summary" className="border-white/10">
                          <AccordionTrigger className={`${colors.text} text-xs font-medium uppercase tracking-wider py-2`}>
                            Process Summary
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3 pb-3">
                            <p className="text-slate-200 text-sm leading-relaxed">{summary.text}</p>
                            {summary.totalTime && (
                              <div className="flex items-center gap-2">
                                <LuminaBadge className="text-xs">
                                  Duration
                                </LuminaBadge>
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

              {/* Glossary (promoted key terms) */}
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

              {/* Exploration Progress */}
              <LuminaCard>
                <LuminaCardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 text-xs">{stepsExplored} of {totalSteps} steps explored</span>
                    {allStepsExplored && (
                      <LuminaBadge accent="emerald" className="text-[10px]">
                        Complete
                      </LuminaBadge>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(stepsExplored / Math.max(totalSteps, 1)) * 100}%`,
                        backgroundColor: colors.accent,
                      }}
                    />
                  </div>
                  {allStepsExplored && challenges.length > 0 && !showChallenges && (
                    <LuminaActionButton
                      action="next"
                      className="w-full mt-3 text-xs h-8"
                      onClick={handleStartChallenges}
                    >
                      Start Challenges ({challenges.length})
                    </LuminaActionButton>
                  )}
                  {!allStepsExplored && (
                    <p className="text-slate-600 text-[10px] mt-2">Scroll through all steps to unlock challenges</p>
                  )}
                </LuminaCardContent>
              </LuminaCard>
            </div>
          </div>

          {/* ── Bottom Sections ── */}

          {/* Fascinating Facts grid */}
          {allFunFacts.length > 1 && (
            <div>
              <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>
                Fascinating Facts
              </p>
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

          {/* Real World Examples */}
          {realWorldExamples && realWorldExamples.length > 0 && (
            <SpotlightCard color={colors.rgb}>
              <LuminaCard className="border-0">
                <LuminaCardContent className="pt-5 pb-4">
                  <p className={`${colors.text} text-xs font-medium uppercase tracking-wider mb-3`}>
                    Real World Examples
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {realWorldExamples.map((ex, i) => (
                      <LuminaBadge
                        key={i}
                        className="text-slate-200 text-xs font-normal px-3 py-1"
                      >
                        {ex}
                      </LuminaBadge>
                    ))}
                  </div>
                </LuminaCardContent>
              </LuminaCard>
            </SpotlightCard>
          )}

          {/* Related Processes footer */}
          {relatedProcesses && relatedProcesses.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <span className="text-slate-600 text-xs uppercase tracking-wider">Explore next:</span>
              {relatedProcesses.map((rp, i) => (
                <LuminaBadge
                  key={i}
                  className="text-xs font-normal px-3 py-1 cursor-default"
                  style={{
                    backgroundColor: `${colors.accent}10`,
                    borderColor: `${colors.accent}30`,
                    color: colors.accent,
                  }}
                >
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

// ============================================================================
// Utility
// ============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default HowItWorks;
