'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaSectionLabel,
  LuminaAnswerChoice,
  LuminaActionButton,
  LuminaFeedbackCard,
  LuminaScoreRing,
  interactive,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FactFileMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { practiceScore } from '../../../hooks/usePhaseResults';
import { SoundManager } from '../../../utils/SoundManager';
import { isPreReaderGrade } from '../../../utils/kindergartenMode';
import { PreReaderSelfCheck, buildSelfCheckReadAloud } from '../../shared/PreReaderSelfCheck';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { SECTION_ICON, SECTION_LABEL, describeCheckWork, factChecks, factFileMiss, fileTabs, fileText, isCheckCorrect,
  workspaceAssignment, workspaceScene } from './factFileWorkspace';
import { DROP_LEVER, NO_LEVERS, SECTION_LEVER, factFileLevers, farChoice, hintShown, leversOnScreen,
  type FactFileLeverState } from './factFileLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/** Where a self-check's fact lives in the file. `keyStats` is the stat row at the top, not a tab. */
export type FactFileSection = 'keyStats' | 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow';

/** One self-check question: one item. */
export interface FactFileCheck {
  /** Stamped by the generator; a legacy payload gets `check-N` (`factChecks`). */
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedSection: FactFileSection;
  /** Pre-reader (K): one depicting emoji per option — the answer surface. */
  optionEmojis?: string[];
  /** The eval mode's challenge type the question was written as. */
  challengeType?: 'recall_easy' | 'recall_medium' | 'recall_hard';
  /**
   * The mode's defining property, stamped by the generator from the eval-mode pin: true (explore) keeps the file open
   * beside the question; false (recall, apply) closes it, key stats included, while the questions are asked.
   */
  fileOpen?: boolean;
  /** Starting position (easy tier): the section note is on screen from the start. Not a lever pull. */
  sectionHint?: boolean;
}

export interface FactFileData {
  title: string;
  category: string;
  description: string;

  /** Headline stats shown prominently at the top. */
  keyStats: Array<{
    value: string;
    unit: string;
    label: string;
  }>;

  /** Bullet-point essentials. */
  quickFacts: Array<{
    fact: string;
    icon?: string;
  }>;

  /** Expandable detail sections. */
  deepDive: Array<{
    heading: string;
    body: string;
    detail?: string;
  }>;

  /** Records & superlatives. */
  records: Array<{
    label: string;
    value: string;
  }>;

  /** "Did You Know?" callouts. */
  didYouKnow: Array<{
    text: string;
    source?: string;
  }>;

  /** Self-check questions (for eval modes). */
  selfChecks?: FactFileCheck[];

  /** Canonical grade key ('K'|'1'…) stamped by the generator for band-gating. */
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FactFileMetrics>) => void;
}

// ============================================================================
// Tab definitions
// ============================================================================

type TabKey = 'quickFacts' | 'deepDive' | 'records' | 'didYouKnow';

// ============================================================================
// Props
// ============================================================================

interface FactFileProps {
  data: FactFileData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Component
// ============================================================================

const FactFileSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  FactFileProps & { tutorOwned: boolean; useController: (options: ProgressOptions<FactFileCheck>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    category,
    description,
    keyStats = [],
    quickFacts = [],
    deepDive = [],
    records = [],
    didYouKnow = [],
    gradeLevel: dataGradeLevel,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Pre-reader (K) band-gate — the self-check goes picture-primary + read-aloud and
  // the text-heavy tab exploration (unreadable to a non-reader) is bypassed.
  const preReader = isPreReaderGrade(dataGradeLevel);

  /** The self-checks as items, each with an id; memoized so the progress controller never sees a new list. */
  const selfChecks = useMemo(() => factChecks(data), [data]);
  const text = useMemo(() => fileText(data), [data]);
  /** explore: every check is answered with the file open, so there is no reading phase first. */
  const lookup = selfChecks.length > 0 && selfChecks.every(c => c.fileOpen);

  // -------------------------------------------------------------------------
  // Progress. On the workspace path the runtime moves the index.
  // -------------------------------------------------------------------------
  const stableInstanceIdRef = useRef(instanceId || `fact-file-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const progress = useController({
    challenges: selfChecks,
    getChallengeId: (c) => c.id!,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: c => workspaceAssignment(c, text),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: result => finish.current(result),
    onSolved: index => solvedAloud.current(index),
  });
  const currentCheckIndex = progress.currentIndex;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const commitCheck = useRef(progress.commitCheck);
  commitCheck.current = progress.commitCheck;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<TabKey>('quickFacts');
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(new Set<TabKey>(['quickFacts']));
  const [tappedStats, setTappedStats] = useState<Set<number>>(new Set());

  // Self-check state. A look-it-up file opens its questions at once, beside the file.
  const [questionsStarted, setQuestionsStarted] = useState(false);
  const showSelfChecks = questionsStarted || lookup;
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showCheckFeedback, setShowCheckFeedback] = useState(false);
  const [scriptedDone, setScriptedDone] = useState(false);

  /** In-item levers (`factFileLevers.ts`), keyed by the check they belong to; a new check starts from none. */
  const [leverState, setLeverState] = useState<{ item: string } & FactFileLeverState>({ item: '', ...NO_LEVERS });
  const leversFor = (id: string | undefined): FactFileLeverState => (id && leverState.item === id ? leverState : NO_LEVERS);
  const updateLevers = (id: string, change: (s: FactFileLeverState) => Partial<FactFileLeverState>) =>
    setLeverState(prev => { const base = prev.item === id ? prev : { item: id, ...NO_LEVERS }; return { ...base, ...change(base) }; });

  // Timing
  const [tabVisitTimes, setTabVisitTimes] = useState<Record<TabKey, number>>({
    quickFacts: 0,
    deepDive: 0,
    records: 0,
    didYouKnow: 0,
  });
  const tabEntryTimeRef = useRef(Date.now());

  // All tabs (only those with content)
  const availableTabs = useMemo(() => fileTabs({ quickFacts, deepDive, records, didYouKnow }),
    [quickFacts, deepDive, records, didYouKnow]);

  const totalSections = availableTabs.length;
  const sectionsExplored = availableTabs.filter(t => visitedTabs.has(t)).length;
  const allSectionsExplored = sectionsExplored >= totalSections;

  const allChecksComplete = tutorOwned ? progress.isComplete : scriptedDone;
  const reading = !preReader && !showSelfChecks && !allChecksComplete;
  const currentCheck = selfChecks[currentCheckIndex] ?? null;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<FactFileMetrics>({
    primitiveType: 'fact-file',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration (scripted path only: its context and cues carry the answers)
  // -------------------------------------------------------------------------
  const checksDone = progress.results.length;
  const aiPrimitiveData = useMemo(() => ({
    title,
    category,
    activeTab,
    sectionsExplored,
    totalSections,
    checksCompleted: checksDone,
    totalChecks: selfChecks.length,
    currentKeyStats: keyStats.map(s => `${s.label}: ${s.value} ${s.unit}`).join(', '),
  }), [title, category, activeTab, sectionsExplored, totalSections, checksDone, selfChecks.length, keyStats]);

  const { sendText: sendLegacyText, isConnected, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'fact-file',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: 'Elementary',
    enabled: !tutorOwned,
  });
  const sendText = useCallback((message: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(message, options);
  }, [tutorOwned, sendLegacyText]);

  // Introduce on connect
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;
    sendText(
      `[ACTIVITY_START] Fact File about "${title}" (${category}). `
      + `Key stats: ${keyStats.map(s => `${s.label}: ${s.value} ${s.unit}`).join(', ')}. `
      + `${totalSections} sections to explore. ${selfChecks.length > 0 ? `${selfChecks.length} self-check questions after exploration.` : ''} `
      + `Introduce the topic warmly and encourage exploration.`,
      { silent: true }
    );
  }, [isConnected, title, category, keyStats, totalSections, selfChecks.length, sendText]);

  // -------------------------------------------------------------------------
  // Tab switching
  // -------------------------------------------------------------------------
  const handleTabChange = useCallback((tab: TabKey) => {
    SoundManager.tap();
    const now = Date.now();
    const elapsed = now - tabEntryTimeRef.current;
    setTabVisitTimes(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] + elapsed,
    }));
    tabEntryTimeRef.current = now;

    setActiveTab(tab);
    setVisitedTabs(prev => {
      const next = new Set(prev);
      next.add(tab);
      return next;
    });

    if (isConnected) {
      sendText(
        `[TAB_OPENED] Student opened the "${SECTION_LABEL[tab]}" section. `
        + `Sections explored: ${visitedTabs.has(tab) ? sectionsExplored : sectionsExplored + 1} of ${totalSections}. `
        + `Briefly introduce this section and highlight one interesting detail to look for.`,
        { silent: true }
      );
    }
  }, [activeTab, visitedTabs, sectionsExplored, totalSections, isConnected, sendText]);

  // Track all-sections-explored
  const hasNotifiedAllExploredRef = useRef(false);
  useEffect(() => {
    if (allSectionsExplored && !hasNotifiedAllExploredRef.current && isConnected) {
      hasNotifiedAllExploredRef.current = true;
      sendText(
        `[ALL_SECTIONS_EXPLORED] Student has explored all ${totalSections} sections! `
        + `${selfChecks.length > 0 ? `${selfChecks.length} self-check questions are coming up.` : 'Congratulate them!'} `
        + `Ask what their favorite fact was.`,
        { silent: true }
      );
    }
  }, [allSectionsExplored, totalSections, selfChecks.length, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Key stat tap
  // -------------------------------------------------------------------------
  const handleStatTap = useCallback((index: number) => {
    SoundManager.tap();
    setTappedStats(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });

    const stat = keyStats[index];
    if (isConnected && stat) {
      sendText(
        `[STAT_TAPPED] Student tapped the "${stat.label}" stat: ${stat.value} ${stat.unit}. `
        + `React to this specific stat with a relatable comparison. Keep to 1-2 sentences.`,
        { silent: true }
      );
    }
  }, [keyStats, isConnected, sendText]);

  // -------------------------------------------------------------------------
  // Self-check handling
  // -------------------------------------------------------------------------
  const handleStartChecks = useCallback(() => {
    SoundManager.tap();
    setQuestionsStarted(true);
  }, []);

  const metricsFor = useCallback((accuracy: number, explored = sectionsExplored): FactFileMetrics => ({
    type: 'fact-file',
    sectionsExplored: explored,
    totalSections,
    explorationCompleteness: totalSections > 0 ? Math.round((explored / totalSections) * 100) : 0,
    selfCheckAccuracy: accuracy,
    selfCheckAttempts: selfChecks.length,
    averageTimePerSection: totalSections > 0
      ? Math.round(Object.values(tabVisitTimes).reduce((a, b) => a + b, 0) / totalSections) : 0,
    tabsVisitedOrder: Array.from(visitedTabs),
  }), [sectionsExplored, totalSections, selfChecks.length, tabVisitTimes, visitedTabs]);

  // Workspace path: a fresh check and Try again both open with no choice tapped and no feedback.
  openItem.current = () => {
    setSelectedOption(null);
    setShowCheckFeedback(false);
  };

  const tappedCorrect = useRef<string | null>(null);
  const handleCheckAnswer = useCallback((optionIndex: number) => {
    if (!currentCheck || showCheckFeedback || workspaceClosed.current || reading) return;
    if (tutorOwned && leversFor(currentCheck.id).dropped.includes(optionIndex)) return;
    setSelectedOption(optionIndex);
    setShowCheckFeedback(true);

    const correct = isCheckCorrect(currentCheck, optionIndex);
    if (correct) {
      tappedCorrect.current = currentCheck.id!;
      SoundManager.playCorrect();
    } else {
      SoundManager.playIncorrect();
      if (tutorOwned) updateLevers(currentCheck.id!, prev => (prev.picked.includes(optionIndex) ? {} : { picked: [...prev.picked, optionIndex] }));
      // Scripted path: one try per question; the wrong answer is its record.
      else progress.recordResult({ challengeId: currentCheck.id!, correct: false, attempts: 1 });
    }

    if (isConnected) {
      const tag = correct ? '[CHECK_CORRECT]' : '[CHECK_INCORRECT]';
      sendText(
        `${tag} Self-check ${currentCheckIndex + 1}/${selfChecks.length}: "${currentCheck.question}" `
        + `Student chose "${currentCheck.options[optionIndex]}". `
        + `${correct
          ? 'Correct! Celebrate briefly and reinforce the fact.'
          : `Incorrect. Correct answer: "${currentCheck.options[currentCheck.correctIndex]}". Hint at which section (${currentCheck.relatedSection}) contains the answer without revealing it.`
        }`,
        { silent: true }
      );
    }
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    commitCheck.current(describeCheckWork(currentCheck, { picked: optionIndex }), correct,
      correct ? undefined : factFileMiss(currentCheck, optionIndex, text));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCheck, currentCheckIndex, selfChecks, showCheckFeedback, isConnected, sendText, tutorOwned, reading, text, leverState]);

  // A spoken answer the observer credited (`onSolved` fires once per check, for a tap too): the key shown as picked.
  solvedAloud.current = (index) => {
    const solved = selfChecks[index];
    if (!solved || tappedCorrect.current === solved.id) return;
    setSelectedOption(solved.correctIndex);
    setShowCheckFeedback(true);
  };

  /** Scripted path: the accuracy over every check's single try. */
  const scriptedAccuracy = (results = progress.results) => selfChecks.length > 0
    ? Math.round((results.filter(r => r.correct).length / selfChecks.length) * 100) : 0;

  const handleNextCheck = useCallback(() => {
    setSelectedOption(null);
    setShowCheckFeedback(false);
    if (progress.advance()) return;
    setScriptedDone(true);
    const accuracy = scriptedAccuracy();
    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Student finished all ${selfChecks.length} self-checks. `
        + `Accuracy: ${accuracy}%. Sections explored: ${sectionsExplored}/${totalSections}. `
        + `Celebrate and give section-specific feedback.`,
        { silent: true }
      );
    }
    // The score is the questions answered right; reading the tabs is how the learner gets there, not credit.
    if (!hasSubmittedEvaluation) {
      submitEvaluation(accuracy >= 70, accuracy, metricsFor(accuracy),
        { checkAnswers: progress.results.map(r => ({ challengeId: r.challengeId, correct: r.correct })) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, selfChecks.length, isConnected, sendText, sectionsExplored, totalSections, hasSubmittedEvaluation, submitEvaluation, metricsFor]);

  // Pre-reader self-check completion (scripted path). PreReaderSelfCheck is eliminate-until-correct
  // (it owns the wrong-tap RECOVER beat), so onResult fires once, correct, per check;
  // first-try is the mastery signal. Exploration is delivered by the tutor's read-aloud at K.
  const handlePreCheckPass = useCallback((attempts: number) => {
    const check = selfChecks[currentCheckIndex];
    if (!check) return;
    const firstTry = attempts <= 1;
    const result = { challengeId: check.id!, correct: firstTry, attempts };
    const nextResults = [...progress.results.filter(r => r.challengeId !== check.id), result];
    progress.recordResult(result);

    if (isConnected) {
      sendText(
        `[CHECK_CORRECT] Pre-reader answered self-check ${currentCheckIndex + 1}/${selfChecks.length} `
        + `("${check.question}") correctly. Celebrate warmly in ONE short sentence.`,
        { silent: true },
      );
    }

    if (progress.advance()) return;

    setScriptedDone(true);
    const accuracy = scriptedAccuracy(nextResults);
    if (isConnected) {
      sendText(
        `[ALL_COMPLETE] Pre-reader finished all ${selfChecks.length} picture self-checks. `
        + `Celebrate their effort in 2-3 warm sentences.`,
        { silent: true },
      );
    }
    if (!hasSubmittedEvaluation) {
      submitEvaluation(accuracy >= 70, accuracy, { ...metricsFor(accuracy, totalSections), averageTimePerSection: 0, tabsVisitedOrder: [] },
        { checkAnswers: nextResults.map(r => ({ challengeId: r.challengeId, correct: r.correct })) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfChecks, currentCheckIndex, progress, isConnected, sendText, totalSections, hasSubmittedEvaluation, submitEvaluation, metricsFor]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong tap's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation) return;
    submitEvaluation(result.passed, result.accuracy, metricsFor(result.accuracy),
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Auto-submit for display-only mode (no self-checks), scripted path only.
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (tutorOwned) return;
    if (selfChecks.length === 0 && allSectionsExplored && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      submitEvaluation(true, 100, { ...metricsFor(100), explorationCompleteness: 100 }, {});
    }
  }, [tutorOwned, selfChecks.length, allSectionsExplored, hasSubmittedEvaluation, submitEvaluation, metricsFor]);

  // -------------------------------------------------------------------------
  // Workspace path: what the tutor and the observer are shown, republished every render. No demonstration targets.
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!tutorOwned || !currentCheck) return;
    const scene = workspaceScene(data, currentCheck, { reading, picked: selectedOption, preReader });
    const s = leversFor(currentCheck.id);
    const levers = factFileLevers(currentCheck, s, text, preReader);
    const onScreen = leversOnScreen(currentCheck, s);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}) },
      // The questions are hidden while the learner reads, so nothing can be answered yet.
      ...(reading ? { readyForResponse: false } : {}),
      levers: reading ? [] : levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        if (reading) return 'The learner is still reading the fact file; the question is not open yet.';
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        if (id === DROP_LEVER) {
          const drop = farChoice(currentCheck, s, text);
          if (drop === null) return 'No choice can be greyed out: too few untried choices would remain.';
          updateLevers(currentCheck.id!, prev => ({ pulled: [...prev.pulled, id], dropped: [...prev.dropped, drop] }));
          return true;
        }
        updateLevers(currentCheck.id!, prev => ({ pulled: [...prev.pulled, id] }));
        return true;
      },
    };
  });

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChecksComplete || hasSubmittedEvaluation || !(showSelfChecks || preReader) || !currentCheck ? null : `check-${currentCheckIndex}`,
    label: 'The answer choices',
    solved: showCheckFeedback && selectedOption === currentCheck?.correctIndex,
    tutorSpeaking: isAudioPlaying && activePrimitiveId === resolvedInstanceId,
  });

  // -------------------------------------------------------------------------
  // Render: Tab Content
  // -------------------------------------------------------------------------
  const renderTabContent = () => {
    switch (activeTab) {
      case 'quickFacts':
        return (
          <div className="space-y-3">
            {quickFacts.map((item, i) => (
              <LuminaPanel key={i} className="flex items-start gap-3 p-3">
                {item.icon && <span className="text-lg shrink-0 mt-0.5" aria-hidden>{item.icon}</span>}
                <p className="text-slate-200 text-sm leading-relaxed">{item.fact}</p>
              </LuminaPanel>
            ))}
          </div>
        );

      case 'deepDive':
        return (
          <Accordion type="multiple" className="space-y-2">
            {deepDive.map((section, i) => (
              <AccordionItem key={i} value={`dd-${i}`} className="border-white/10">
                <AccordionTrigger className="text-slate-200 text-sm font-medium hover:text-slate-100 py-3">
                  {section.heading}
                </AccordionTrigger>
                <AccordionContent className="text-slate-300 text-sm leading-relaxed pb-4">
                  <p>{section.body}</p>
                  {section.detail && (
                    <p className="mt-2 text-slate-400 text-xs italic border-l-2 border-white/10 pl-3">
                      {section.detail}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        );

      case 'records':
        return (
          <div className="space-y-3">
            {records.map((record, i) => (
              <LuminaPanel key={i} accent="amber">
                <LuminaSectionLabel accent="amber" size="sm" className="mb-1">
                  {record.label}
                </LuminaSectionLabel>
                <p className="text-slate-200 text-sm">{record.value}</p>
              </LuminaPanel>
            ))}
          </div>
        );

      case 'didYouKnow':
        return (
          <div className="space-y-3">
            {didYouKnow.map((item, i) => (
              <LuminaPanel key={i} accent="purple">
                <p className="text-slate-200 text-sm leading-relaxed">{item.text}</p>
                {item.source && (
                  <p className="text-slate-500 text-xs mt-2">— {item.source}</p>
                )}
              </LuminaPanel>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const currentLevers = leversFor(currentCheck?.id);
  const ringedTab = tutorOwned && currentCheck?.fileOpen && showSelfChecks && hintShown(currentCheck, currentLevers)
    ? currentCheck.relatedSection : null;

  const renderKeyStats = () => keyStats.length > 0 && (
    <div className="grid grid-cols-3 gap-3">
      {keyStats.map((stat, i) => (
        <button
          key={i}
          onClick={() => handleStatTap(i)}
          className={`p-3 rounded-xl text-center transition-all duration-200 cursor-pointer
            ${tappedStats.has(i)
              ? 'bg-blue-500/10 border border-blue-400/20 scale-[1.02]'
              : `${interactive.ghost} hover:scale-[1.02]`
            } ${ringedTab === 'keyStats' ? 'ring-2 ring-cyan-400/60' : ''}`}
        >
          <div className="text-xl font-bold text-slate-100">{stat.value}</div>
          <div className="text-xs text-slate-400">{stat.unit}</div>
          <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{stat.label}</div>
        </button>
      ))}
    </div>
  );

  const renderTabs = () => (
    <>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab;
          const isVisited = visitedTabs.has(tab);
          return (
            <LuminaButton
              key={tab}
              aria-label={SECTION_LABEL[tab]}
              tone={isActive ? 'ghost' : 'subtle'}
              className={`shrink-0 text-xs px-3 py-2 h-auto ${
                isActive ? 'text-slate-100' : isVisited ? 'text-slate-300' : 'text-slate-500'
              } ${ringedTab === tab ? 'ring-2 ring-cyan-400/60' : ''}`}
              data-lever={ringedTab === tab ? 'point-to-section' : undefined}
              onClick={() => handleTabChange(tab)}
            >
              <span className="mr-1" aria-hidden>{SECTION_ICON[tab]}</span>
              {SECTION_LABEL[tab]}
              {isVisited && !isActive && <span className="ml-1 text-emerald-400" aria-hidden>✓</span>}
            </LuminaButton>
          );
        })}
      </div>
      <div className="min-h-[120px]">{renderTabContent()}</div>
    </>
  );

  // -------------------------------------------------------------------------
  // Render: Self-Check
  // -------------------------------------------------------------------------
  const choiceState = (i: number): AnswerChoiceState => {
    if (!currentCheck) return 'idle';
    const isSelected = selectedOption === i;
    if (!showCheckFeedback) return isSelected ? 'selected' : 'idle';
    // Scripted path: one try, so the key is revealed with the verdict.
    if (!tutorOwned) return i === currentCheck.correctIndex ? 'correct' : isSelected ? 'incorrect' : 'dimmed';
    // With the tutor a wrong try reveals nothing: only the learner's own choice is marked.
    if (!isSelected) return selectedOption === currentCheck.correctIndex ? 'dimmed' : 'idle';
    return i === currentCheck.correctIndex ? 'correct' : 'incorrect';
  };
  const choicesClosed = showCheckFeedback || allChecksComplete || (tutorOwned && progress.canAttempt === false);
  const solvedNow = showCheckFeedback && selectedOption !== null && selectedOption === currentCheck?.correctIndex;

  const renderSectionHint = () => {
    if (!currentCheck || !hintShown(currentCheck, currentLevers) || !currentCheck.relatedSection) return null;
    const section = currentCheck.relatedSection;
    return (
      <p className="text-xs text-cyan-300" data-lever={currentLevers.pulled.includes(SECTION_LEVER) ? 'point-to-section' : undefined}>
        <span aria-hidden>{SECTION_ICON[section]}</span> This is in: {SECTION_LABEL[section]}
      </p>
    );
  };

  const renderSelfCheck = () => {
    if (!currentCheck) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs">
            Question {currentCheckIndex + 1} of {selfChecks.length}
          </p>
        </div>

        <p className="text-slate-100 text-sm font-medium">{currentCheck.question}</p>
        {tutorOwned && renderSectionHint()}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && <div {...pip.dock} />}
        <div {...pip.workspace}>
          <div className="space-y-2">
            {currentCheck.options.map((opt, i) => {
              const dropped = tutorOwned && currentLevers.dropped.includes(i);
              return (
                <LuminaAnswerChoice
                  key={i}
                  state={choiceState(i)}
                  className={`p-3 text-sm ${dropped ? 'opacity-30 line-through' : ''}`}
                  onClick={() => handleCheckAnswer(i)}
                  disabled={choicesClosed || dropped}
                  data-dropped={dropped || undefined}
                  data-lever={dropped ? 'drop-far-choice' : undefined}
                >
                  {opt}
                </LuminaAnswerChoice>
              );
            })}
          </div>
        </div>

        {showCheckFeedback && !tutorOwned && (
          <div className="space-y-3">
            <LuminaFeedbackCard status={selectedOption === currentCheck.correctIndex ? 'correct' : 'incorrect'}>
              {currentCheck.explanation}
            </LuminaFeedbackCard>
            <div className="flex justify-center">
              <LuminaActionButton action="next" onClick={handleNextCheck}>
                {currentCheckIndex + 1 >= selfChecks.length ? 'See Results' : 'Next Question'}
              </LuminaActionButton>
            </div>
          </div>
        )}
        {/* With the tutor: the explanation only once the answer is right; a wrong try says no more than that. */}
        {showCheckFeedback && tutorOwned && (solvedNow
          ? <LuminaFeedbackCard status="correct">{currentCheck.explanation}</LuminaFeedbackCard>
          : <LuminaFeedbackCard status="incorrect">Not quite.</LuminaFeedbackCard>)}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render: Results Summary
  // -------------------------------------------------------------------------
  const renderResults = () => {
    const correctCount = progress.results.filter(r => r.correct).length;
    const accuracy = selfChecks.length > 0 ? Math.round((correctCount / selfChecks.length) * 100) : 0;
    const score = practiceScore(progress.practiceSummary) ?? submittedResult?.score ?? accuracy;

    return (
      <div className="flex flex-col items-center text-center space-y-4 py-4">
        <LuminaScoreRing score={score} />
        <p className="text-slate-200 text-sm font-medium">Fact File Complete!</p>
        <div className="flex justify-center gap-4 text-xs text-slate-400">
          {!preReader && <span>{sectionsExplored}/{totalSections} sections explored</span>}
          {!tutorOwned && <span>{correctCount}/{selfChecks.length} questions correct</span>}
          {elapsedMs > 0 && <span>{Math.round(elapsedMs / 1000)}s total</span>}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Pre-reader render: skip the text-heavy tab exploration + gating; the tutor
  // reads each self-check aloud and the child answers by tapping a picture. Adult
  // chrome (title/category/tabs/counters/stat labels) is hidden.
  // -------------------------------------------------------------------------
  if (preReader) {
    return (
      <LuminaCard className={className} topAccent="cyan">
        <LuminaCardContent className="space-y-5 pt-5">
          {allChecksComplete ? (
            renderResults()
          ) : currentCheck && tutorOwned ? (
            // With the tutor: the tutor reads the question and every choice; a tap is checked; retries are the runtime's.
            <div className="space-y-4">
              <p className="text-slate-100 text-base font-medium text-center">{currentCheck.question}</p>
              {pip.store && <div {...pip.dock} />}
              <div {...pip.workspace}>
                <div className="grid grid-cols-2 gap-3">
                  {currentCheck.options.map((opt, i) => {
                    const dropped = currentLevers.dropped.includes(i);
                    return (
                      <LuminaAnswerChoice
                        key={i}
                        state={choiceState(i)}
                        className={`flex flex-col items-center gap-1 p-3 text-center ${dropped ? 'opacity-30' : ''}`}
                        onClick={() => handleCheckAnswer(i)}
                        disabled={choicesClosed || dropped}
                        data-dropped={dropped || undefined}
                        data-lever={dropped ? 'drop-far-choice' : undefined}
                      >
                        <span className="text-4xl" aria-hidden>{currentCheck.optionEmojis?.[i] ?? '⭐'}</span>
                        <span className="text-xs text-slate-300">{opt}</span>
                      </LuminaAnswerChoice>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : currentCheck ? (
            <>
            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace}>
            <PreReaderSelfCheck
              key={currentCheckIndex}
              question={currentCheck.question}
              options={currentCheck.options}
              optionEmojis={currentCheck.optionEmojis}
              correctIndex={currentCheck.correctIndex}
              explanation={currentCheck.explanation}
              accent="cyan"
              readAloudMessage={buildSelfCheckReadAloud({
                question: currentCheck.question,
                options: currentCheck.options,
                label: title,
                tag: '[FACTCHECK_READ_ALOUD]',
              })}
              retryTag="[FACTCHECK_RETRY]"
              onAskTutor={(msg) => sendText(msg)}
              onResult={(correct, attempts) => { if (correct) handlePreCheckPass(attempts); }}
            />
            </div>
            </>
          ) : (
            <p className="text-center text-slate-400 text-sm py-8">All done! 🎉</p>
          )}
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------
  return (
    <LuminaCard className={className} topAccent="blue">
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>🗂️</span>
            <LuminaCardTitle className="text-lg">Fact File: {title}</LuminaCardTitle>
          </div>
          <LuminaBadge accent="blue" className="text-xs">
            {category}
          </LuminaBadge>
        </div>
        <p className="text-slate-400 text-sm mt-1">{description}</p>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-5">
        {allChecksComplete ? (
          renderResults()
        ) : showSelfChecks ? (
          <>
            {/* Look it up (explore): the file stays open above the question. From memory: it is closed. */}
            {currentCheck?.fileOpen && (
              <>
                {renderKeyStats()}
                {renderTabs()}
              </>
            )}
            <div className="border-t border-white/10 pt-4">
              <LuminaSectionLabel accent="cyan" size="sm" className="mb-3">
                Self-Check
              </LuminaSectionLabel>
              {renderSelfCheck()}
            </div>
          </>
        ) : (
          <>
            {renderKeyStats()}
            {renderTabs()}

            {/* Exploration Progress */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/5">
              <span>{sectionsExplored} of {totalSections} sections explored</span>
              {allSectionsExplored && selfChecks.length > 0 && (
                <LuminaButton
                  tone="primary"
                  className="text-xs h-8"
                  onClick={handleStartChecks}
                >
                  Start questions
                </LuminaButton>
              )}
              {!allSectionsExplored && (
                <span className="text-slate-600">Open every section to unlock the questions</span>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const FactFile = withWorkspaceController<FactFileProps, ProgressOptions<FactFileCheck>, Progress>(
  'fact-file', FactFileSurface, useScriptedProgress, useWorkspaceProgressFor('fact-file'));

export default FactFile;
