'use client';

/**
 * How It Works: a process told in 4-6 steps (or 3-4 picture steps for a pre-reader), read first, then questions about
 * it that code builds from the steps and keys from their order (`howItWorksWorkspace.ts`):
 * - guided: which step does this description tell of? (its own name blanked; the step list stays on screen)
 * - sequence: put the step cards in order, then which step is this, with no step list on screen
 * - predict: the first steps are shown, what happens next? and why does this step matter?
 *
 * The model writes the process; it never writes a question or picks an answer. Taught only on the shared workspace
 * (`withWorkspaceOnly`; its wiring is `howItWorks.card.ts` + `howItWorks.boss.ts`): every check commits through
 * `progress.commitCheck` with a named miss, a step's name said aloud is judged by the tutor, and the runtime moves on.
 * The levers are the lever set in `howItWorksLevers.ts`.
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
import { SpotlightCard } from '../../../components/SpotlightCard';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOfCheck, cardText, choiceText, clueOf, describeHowWork, emptyWork, howChecks, howCorrect, howMiss, isChoice, isPictures,
  keyStep, processSteps, workComplete, workspaceScene,
  type HowCheck, type HowItem, type HowKind, type HowMode, type HowTier, type HowWork,
} from './howItWorksWorkspace';
import {
  crossedOut, HOW_LEVERS, LAST_STEP_LEVER, lastStepLine, SHOW_STEP_LEVER, SHOW_WHY_LEVER, showStepLine,
  STEP_NUMBERS_LEVER, TWO_CHOICES_LEVER, whyLine,
} from './howItWorksLevers';
import { howItWorksBoss, START_LABEL } from './howItWorks.boss';

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

const useHowProgress = useWorkspaceProgressFor('how-it-works');

const HowItWorksSurface = ({ data, className, runtimePlanItemId }: HowItWorksProps) => {
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
  const pictures = isPictures(data);

  const colors = PROCESS_CATEGORIES[category || ''] || DEFAULT_COLORS;

  // The process as the questions read it, and the questions (each carrying the steps).
  const pSteps = useMemo(() => processSteps(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.steps, data.preReader]);
  const items = useMemo(() => howChecks(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.modes, data.difficulty, data.steps, data.preReader, data.title, data.challenges]);

  // Stable instance ID
  const stableInstanceIdRef = useRef(instanceId || `how-it-works-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Progress: the runtime moves the index (callbacks bound below)
  // -------------------------------------------------------------------------
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useHowProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: howItWorksBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;

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
  const [practice, setPractice] = useState<HowCheck | null>(null);
  const [work, setWork] = useState<HowWork>(emptyWork);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [practiceSolved, setPracticeSolved] = useState(false);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [submitted, setSubmitted] = useState(false);
  const tappedCorrect = useRef<string | null>(null);

  // Timing
  const stepEntryTimes = useRef<Record<number, number>>({ 0: Date.now() });

  const totalSteps = steps.length;
  const stepsExplored = visitedSteps.size;
  const allStepsExplored = stepsExplored >= totalSteps;

  const sessionItem: HowCheck | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const item = practice ?? sessionItem;
  const pulled = sessionItem && leverState.item === sessionItem.id && !practice ? leverState.pulled : [];
  const leverOn = (id: string) => pulled.includes(id);
  const solvedNow = practice ? practiceSolved || !!progress.practiceSolved
    : !!item && results.some(r => r.challengeId === item.id && r.correct);
  const revealed = solvedNow;
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
      if (next.has(stepIndex)) next.delete(stepIndex); else next.add(stepIndex);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Questions
  // -------------------------------------------------------------------------
  const clearItem = () => {
    setWork(emptyWork()); setWrongShown(false); setPracticeSolved(false);
  };

  openItem.current = (index, retry) => {
    if (retry) { setWork(emptyWork()); setWrongShown(false); setPracticeSolved(false); return; }
    setPractice(null); clearItem();
    void index;
  };

  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || !isChoice(solved) || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork({ choice: keyStep(solved), placed: [] }); setWrongShown(false);
  };

  const closed = !started || revealed || wrongShown || progress.canAttempt === false;

  const handleStart = () => {
    if (started) return;
    SoundManager.tap();
    setStarted(true);
  };

  const checkWith = (w: HowWork) => {
    if (!item || closed || !workComplete(item, w)) return;
    const correct = howCorrect(item, w);
    progress.commitCheck(describeHowWork(pSteps, item, w, pictures), correct, correct ? undefined : howMiss(item, w));
    if (correct) {
      SoundManager.playCorrect();
      if (practice) setPracticeSolved(true); else tappedCorrect.current = item.id;
      return;
    }
    SoundManager.playIncorrect();
    setWrongShown(true);
  };

  const pick = (o: number) => {
    if (!item || closed || crossed.includes(o)) return;
    SoundManager.select();
    const next = { choice: o, placed: [] };
    setWork(next);
    if (pictures) checkWith(next);
  };
  const place = (s: number) => {
    if (!item || item.kind !== 'sequence' || closed || work.placed.includes(s)) return;
    SoundManager.tap();
    const next = { choice: null, placed: [...work.placed, s] };
    setWork(next);
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

  // Under a lesson's evaluation provider only: the scored session, whose evidence carries each wrong answer's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitEvaluation(result.passed, result.accuracy, metrics(result.teachingAttempts.length),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // -------------------------------------------------------------------------
  // What the tutor and the observer are shown, republished every render. The levers are the lever set's
  // (`HOW_LEVERS`); none while the learner reads or on a practice item.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!item || !sessionItem || isComplete) return;
    const reading = !started;
    const scene = workspaceScene(item, { reading, work, solved: revealed, crossed, why: !practice && leverOn(SHOW_WHY_LEVER) }, { title });
    if (reading) { workspace.current = { ...scene, readyForResponse: false, levers: [] }; return; }
    const levers = practice ? [] : HOW_LEVERS.declare(sessionItem, null, pulled);
    const onScreen = practice ? '' : HOW_LEVERS.onScreen(sessionItem, null, pulled);
    if (practice) scene.facts.practice = 'An easier question of the same kind, before the full item comes back.';
    workspace.current = {
      ...leverScene(scene, { support: HOW_LEVERS.support(practice ? null : sessionItem, null), onScreen }),
      readyForResponse: true,
      levers,
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (practice || !l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        const nextState = { item: sessionItem.id, pulled: [...pulled, id] };
        if (l.kind === 'simplify') {
          const simpler = HOW_LEVERS.simpler(sessionItem, null, id);
          if (!simpler) return 'There is no easier question here; try a help lever.';
          setLeverState(nextState); clearItem(); setPractice(simpler);
          return { practice: howItWorksBoss.assignment(simpler) };
        }
        // Drawing two_choices: a tapped choice it crosses out is cleared.
        if (id === TWO_CHOICES_LEVER && isChoice(sessionItem) && work.choice !== null && crossedOut(sessionItem).includes(work.choice)) {
          setWork(emptyWork());
        }
        setLeverState(nextState);
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
    };
  });

  const done = hasSubmittedEvaluation || submitted || isComplete;

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
            <p className="text-slate-100 text-sm font-medium">{askOfCheck(item)}</p>
          )}
        </LuminaPrompt>

        {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the question's answer surface as its region. */}
        <PipDock />
        <PipWorkspace className="space-y-4">
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
        </PipWorkspace>

        {!revealed && !pictures && (
          <div className="flex justify-center">
            <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={() => checkWith(work)}>
              Check Answer
            </LuminaActionButton>
          </div>
        )}

        {revealed && <LuminaFeedbackCard status="correct">{revealText()}</LuminaFeedbackCard>}
        {!revealed && wrongShown && (
          <LuminaFeedbackCard status="incorrect">{item.kind === 'sequence' ? 'That order is not right yet.' : 'That is not it.'}</LuminaFeedbackCard>
        )}
      </div>
    );
  };

  const startButton = (
    <LuminaActionButton action="next" aria-label={START_LABEL} onClick={handleStart}
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
        <LuminaFeedbackCard status="insight" label="All questions answered">{`${results.filter(r => r.correct).length} of ${items.length} questions answered.`}</LuminaFeedbackCard>
        {summary && !pictures && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-left">
            <p className="text-slate-200 text-sm">{summary.keyTakeaway}</p>
          </div>
        )}
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
            {/* The dock above, the picture story as Pip's region. */}
            <PipDock />
            <PipWorkspace className="flex justify-center gap-4 flex-wrap">
              {pSteps.map((s, i) => (
                <div key={i} className="w-28 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-white/15 bg-slate-800/60">
                  <span className="text-5xl leading-none" aria-hidden="true">{s.emoji}</span>
                  <span className="text-slate-200 text-xs font-medium">{s.title}</span>
                </div>
              ))}
            </PipWorkspace>
            {items.length > 0 && <div className="flex justify-center">{startButton}</div>}
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
          {/* The dock above, the steps as Pip's region while the learner reads. */}
          <PipDock />
          {/* ── Two-Column Layout: Timeline + Sidebar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PipWorkspace className="lg:col-span-2 space-y-2">
              {steps.map((step, i) => renderTimelineStep(step, i))}
            </PipWorkspace>

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
                  {items.length > 0 && startButton}
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

const HowItWorks = withWorkspaceOnly<HowItWorksProps>('how-it-works', HowItWorksSurface, props => props.data.title);

export default HowItWorks;
