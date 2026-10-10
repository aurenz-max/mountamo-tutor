'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  LuminaActionButton,
  LuminaFeedbackCard,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EvidenceFinderMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  claimOf,
  describeEvidenceWork,
  evidenceFinderItems,
  evidenceFinderMiss,
  findCorrect,
  rateCorrect,
  rateList,
  workspaceAssignment,
  workspaceScene,
  type EvidenceFinderItem,
  type EvidenceFinderMiss,
  type EvidenceFinderView,
  type Strength,
} from './evidenceFinderWorkspace';
import {
  COUNT_LEVER,
  EXAMPLE_LEVER,
  GUIDE_LEVER,
  PRACTICE_NOTE,
  evidenceFinderLeverFacts,
  evidenceFinderLevers,
  practiceAssignment,
  practiceFor,
  proofCounts,
  proofExample,
  strengthGuide,
} from './evidenceFinderLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface EvidenceFinderData {
  title: string;
  gradeLevel: string;

  // The informational passage
  passage: {
    text: string;                              // Full passage text
    sentences: Array<{
      id: string;
      text: string;
      isEvidence: boolean;                     // Whether this sentence IS valid evidence
      evidenceStrength?: 'strong' | 'moderate' | 'weak';  // How strong as evidence
      claimIndex?: number;                     // Which claim this evidence supports (0-based)
    }>;
  };

  // Claims to find evidence for
  claims: Array<{
    id: string;
    text: string;                              // The claim statement
    color: string;                             // Highlight color class for this claim
  }>;

  // CER framework scaffold (grades 4+)
  cerEnabled: boolean;

  // Evaluation props (optional, auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EvidenceFinderMetrics>) => void;
}

// ============================================================================
// Props Interface
// ============================================================================

interface EvidenceFinderProps {
  data: EvidenceFinderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the data. */
  runtimeEvalMode?: string;
}

type EvidenceFinderSurfaceProps = EvidenceFinderProps & {
  tutorOwned: boolean;
  useController: (options: ProgressOptions<EvidenceFinderItem>) => Progress;
};

// ============================================================================
// Constants
// ============================================================================

type FinderPhase = 'find' | 'evaluate' | 'reason';

const PHASE_CONFIG: Record<FinderPhase, { label: string; description: string; accent: LuminaAccent }> = {
  find: { label: 'Find', description: 'Highlight evidence in the passage', accent: 'blue' },
  evaluate: { label: 'Evaluate', description: 'Rate evidence strength', accent: 'amber' },
  reason: { label: 'Reason', description: 'Explain how evidence supports the claim', accent: 'emerald' },
};

// Claim-identity colors for the interaction surface (passage highlights + claim
// selector). These mark WHICH claim a piece of evidence belongs to — they are
// part of the bespoke interaction, not grading colors.
const CLAIM_COLORS = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', highlight: 'bg-blue-500/30' },
  { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300', highlight: 'bg-violet-500/30' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', highlight: 'bg-emerald-500/30' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', highlight: 'bg-amber-500/30' },
];

// Strength-rating colors — domain meaning (how strong is this evidence), part
// of the evaluate-phase interaction surface, not eval-loop grading.
const STRENGTH_CONFIG = {
  strong: { label: 'Strong', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300' },
  moderate: { label: 'Moderate', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300' },
  weak: { label: 'Weak', bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300' },
};

/** What a wrong check says on screen: the kind of slip, never which sentence or rating is right. */
const MISS_FEEDBACK: Record<EvidenceFinderMiss, string> = {
  not_evidence: 'At least one highlighted sentence is about the topic but does not prove the claim. Try again!',
  wrong_claim: 'Some evidence is highlighted under the wrong claim. Try again!',
  missed_evidence: 'Good start, but the passage has more evidence. Try again!',
  weak_as_strong: 'A sentence that only mentions the idea is rated Strong. Does it prove the claim? Try again!',
  rated_too_strong: 'Some ratings are stronger than the evidence is. Try again!',
  rated_too_weak: 'Some ratings are weaker than the evidence is. Try again!',
  mixed_ratings: 'Some ratings are too strong and some are too weak. Try again!',
};

// ============================================================================
// Component
// ============================================================================

const EvidenceFinderSurface = (props: EvidenceFinderSurfaceProps) => {
  const { data, className } = props;
  if (!data?.passage || !data.passage.sentences?.length || !data.claims?.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No passage or claims available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }
  return <EvidenceFinderBoard {...props} />;
};

const EvidenceFinderBoard = ({ data, className, runtimePlanItemId, tutorOwned, useController }: EvidenceFinderSurfaceProps) => {
  const {
    title,
    gradeLevel,
    cerEnabled = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);

  // Phase state (scripted path; on the workspace the runtime's item is the phase)
  const [scriptedPhase, setScriptedPhase] = useState<FinderPhase>('find');
  const [activeClaimIndex, setActiveClaimIndex] = useState(0);

  // Highlighting state: maps sentence ID -> claim index the user assigned
  const [highlightedSentences, setHighlightedSentences] = useState<Record<string, number>>({});

  // Strength ratings: maps sentence ID -> user's strength rating
  const [strengthRatings, setStrengthRatings] = useState<Record<string, Strength>>({});

  // CER reasoning: maps claim index -> user's reasoning text
  const [reasoningTexts, setReasoningTexts] = useState<Record<number, string>>({});

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  const stableInstanceId = useRef(instanceId || `evidence-finder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EvidenceFinderMetrics>({
    primitiveType: 'evidence-finder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Progress. Each phase is one checked item; on the workspace path the runtime moves the index. ──
  const items = useMemo(() => evidenceFinderItems(data), [data]);
  // Bound below, once the setters and the evaluation exist.
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges: items,
    getChallengeId: (item) => item.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: (item) => workspaceAssignment(item, data),
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const workspaceClosed = useRef(false);
  workspaceClosed.current = tutorOwned && progress.canAttempt === false;
  const learnerBlocked = () => workspaceClosed.current;
  const sessionItem: EvidenceFinderItem | undefined = tutorOwned ? items[progress.currentIndex] : undefined;
  const workspaceDone = tutorOwned && progress.isComplete;
  const currentPhase: FinderPhase = tutorOwned ? (sessionItem?.id === 'rate' ? 'evaluate' : 'find') : scriptedPhase;
  const finished = hasSubmittedEvaluation || workspaceDone;

  // In-item levers (`evidenceFinderLevers.ts`), keyed by the item they were pulled on, and the practice passage a
  // simplify lever puts in place of this one until the observer returns to it. `shown` is the passage on screen.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<EvidenceFinderData | null>(null);
  const shown: EvidenceFinderData = practice ?? data;
  const { passage, claims } = shown;
  const pulledLevers = !practice && sessionItem && leverState.item === sessionItem.id ? leverState.pulled : [];
  const itemLevers = tutorOwned && !practice && !workspaceDone ? evidenceFinderLevers(sessionItem, data, pulledLevers) : [];
  /** A help lever is drawn on the session passage while pulled, never on a practice passage. */
  const helpOn = (id: string) => itemLevers.some((l) => l.id === id && l.kind === 'help' && l.pulled);

  // Total evidence sentences in the session passage
  const totalEvidence = useMemo(() => data.passage.sentences.filter(s => s.isEvidence).length, [data]);

  // The learner's work as the check and the tutor read it.
  const view: EvidenceFinderView = { highlighted: highlightedSentences, ratings: strengthRatings };

  const clearFeedback = () => { setFeedback(''); setFeedbackType(''); };
  const clearPhase = (id: EvidenceFinderItem['id'] | undefined) => {
    if (id === 'rate') setStrengthRatings({});
    else { setHighlightedSentences({}); setActiveClaimIndex(0); }
    clearFeedback();
  };

  // A fresh item, or Try again on the workspace path: only the opened phase's own work is cleared. Try again keeps a
  // practice passage; a fresh item, or the full passage back after practice, drops it.
  openItem.current = (index, retry) => {
    clearPhase(items[index]?.id);
    if (!retry) setPractice(null);
  };

  // Toggle highlight on a sentence for the active claim
  const handleToggleHighlight = (sentenceId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'find' || learnerBlocked() || workspaceDone) return;
    SoundManager.tap();
    setHighlightedSentences(prev => {
      const existing = prev[sentenceId];
      if (existing === activeClaimIndex) {
        // Remove highlight
        const next = { ...prev };
        delete next[sentenceId];
        return next;
      }
      // Add/change highlight to active claim
      return { ...prev, [sentenceId]: activeClaimIndex };
    });
    clearFeedback();
  };

  const handleSelectClaim = (index: number) => {
    if (currentPhase !== 'find' || learnerBlocked() || workspaceDone) return;
    setActiveClaimIndex(index);
  };

  // Set strength rating for a sentence
  const handleSetStrength = (sentenceId: string, strength: Strength) => {
    if (hasSubmittedEvaluation || currentPhase !== 'evaluate' || learnerBlocked() || workspaceDone) return;
    SoundManager.tap();
    setStrengthRatings(prev => ({ ...prev, [sentenceId]: strength }));
    if (tutorOwned) clearFeedback();
  };

  // Update reasoning text (scripted path only: the reasoning box has no check)
  const handleReasoningChange = (claimIndex: number, text: string) => {
    if (hasSubmittedEvaluation) return;
    setReasoningTexts(prev => ({ ...prev, [claimIndex]: text }));
  };

  // Check evidence in the find phase: the activity's own check, committed on both paths.
  const handleCheckFind = () => {
    if (learnerBlocked()) return;
    const highlightedIds = Object.keys(highlightedSentences);
    if (highlightedIds.length === 0) {
      setFeedback('Highlight at least one sentence as evidence.');
      setFeedbackType('info');
      return;
    }
    const item: EvidenceFinderItem = { id: 'find' };
    const correct = findCorrect(shown, highlightedSentences);
    const miss = correct ? undefined : evidenceFinderMiss(item, shown, view);
    progress.commitCheck(describeEvidenceWork(item, shown, view), correct, miss);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Found ${highlightedIds.length} piece${highlightedIds.length > 1 ? 's' : ''} of evidence!`);
      setFeedbackType('success');
      // Scripted path: advance to the evaluate phase after a brief delay. The workspace's runtime moves on itself.
      if (!tutorOwned) {
        setTimeout(() => {
          setScriptedPhase('evaluate');
          clearFeedback();
        }, 1200);
      }
    } else {
      SoundManager.playIncorrect();
      setFeedback(MISS_FEEDBACK[miss ?? 'missed_evidence']);
      setFeedbackType('error');
    }
  };

  // Check ratings (workspace path: the rate item's own check)
  const handleCheckRate = () => {
    if (learnerBlocked()) return;
    const item: EvidenceFinderItem = { id: 'rate' };
    const correct = rateCorrect(shown, strengthRatings);
    const miss = correct ? undefined : evidenceFinderMiss(item, shown, view);
    progress.commitCheck(describeEvidenceWork(item, shown, view), correct, miss);
    if (correct) {
      SoundManager.playCorrect();
      setFeedback('Every rating fits its evidence!');
      setFeedbackType('success');
    } else {
      SoundManager.playIncorrect();
      setFeedback(MISS_FEEDBACK[miss ?? 'mixed_ratings']);
      setFeedbackType('error');
    }
  };

  const buildMetrics = (attemptsCount: number) => {
    const highlightedIds = Object.keys(highlightedSentences);
    let correctEvidence = 0;
    let falseEvidence = 0;
    let strengthAccuracyTotal = 0;
    let strengthRated = 0;

    highlightedIds.forEach(id => {
      const sentence = data.passage.sentences.find(s => s.id === id);
      if (sentence?.isEvidence) {
        correctEvidence++;
      } else {
        falseEvidence++;
      }
    });
    // Strength accuracy over every evidence sentence the learner rated.
    data.passage.sentences.forEach(sentence => {
      const rating = strengthRatings[sentence.id];
      if (!sentence.isEvidence || !rating || !sentence.evidenceStrength) return;
      strengthRated++;
      if (rating === sentence.evidenceStrength) {
        strengthAccuracyTotal += 100;
      } else {
        // Partial credit for adjacent ratings
        const order = ['weak', 'moderate', 'strong'];
        if (Math.abs(order.indexOf(rating) - order.indexOf(sentence.evidenceStrength)) === 1) strengthAccuracyTotal += 50;
      }
    });

    const strengthAccuracy = strengthRated > 0 ? Math.round(strengthAccuracyTotal / strengthRated) : 0;
    const reasoningProvided = Object.values(reasoningTexts).some(t => t.trim().length > 10);
    const cerComplete = cerEnabled && data.claims.every((_, i) => (reasoningTexts[i]?.trim().length || 0) > 10);

    // Score: evidence finding (60%) + strength rating (20%) + reasoning (20%)
    const findScore = totalEvidence > 0 ? (correctEvidence / totalEvidence) * 60 : 60;
    const strengthScore = strengthAccuracy * 0.2;
    const reasonScore = cerEnabled ? (reasoningProvided ? 20 : 0) : 20;
    const score = Math.round(Math.min(100, findScore + strengthScore + reasonScore - (falseEvidence * 5)));

    const metrics: EvidenceFinderMetrics = {
      type: 'evidence-finder',
      gradeLevel,
      correctEvidenceFound: correctEvidence,
      evidenceTotal: totalEvidence,
      falseEvidenceSelected: falseEvidence,
      evidenceStrengthRatingAccuracy: strengthAccuracy,
      reasoningProvided,
      cerFrameworkComplete: cerComplete,
      attemptsCount,
    };
    return { metrics, score: Math.max(0, score) };
  };

  const studentWork = () => ({ highlightedSentences, strengthRatings, reasoningTexts });

  /** Scripted path: one submission for the whole activity. */
  const submitFinalEvaluation = () => {
    if (hasSubmittedEvaluation || tutorOwned) return;
    const { metrics, score } = buildMetrics(Math.max(1, progress.currentAttempts));
    submitEvaluation(score >= 50, score, metrics, studentWork());
  };

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmittedEvaluation || progress.recordsEvaluation === false) return;
    const { metrics } = buildMetrics(result.attemptsCount);
    submitEvaluation(result.passed, result.accuracy, metrics,
      { ...studentWork(), challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // Advance from evaluate to reason phase (scripted path)
  const handleDoneEvaluate = () => {
    if (cerEnabled) {
      setScriptedPhase('reason');
    } else {
      submitFinalEvaluation();
    }
  };

  // Workspace path: what the tutor and the observer are shown, republished every render.
  // W1 offers no demonstration targets and no presentation.
  useLayoutEffect(() => {
    if (!tutorOwned || !sessionItem || workspaceDone) return;
    const scene = workspaceScene(sessionItem, shown, view);
    const levers = itemLevers;
    const onScreen = practice ? ''
      : evidenceFinderLeverFacts(sessionItem, data, levers.filter((l) => l.kind === 'help' && l.pulled).map((l) => l.id),
        highlightedSentences);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}), ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id: string) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this part of the evidence finder.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceFor(sessionItem, data);
          if (!easier) return 'There is no practice passage for this part.';
          setLeverState(next); setPractice(easier); clearPhase(sessionItem.id);
          return { practice: practiceAssignment(sessionItem, easier) };
        }
        setLeverState(next);
        return true as const;
      },
      // Back to the full passage, blank: the practice passage is not the learner's work on it.
      endPractice: () => { setPractice(null); clearPhase(sessionItem.id); },
    };
  });

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase progress — a bespoke horizontal step indicator (no kit equivalent for
  // a multi-step progress rail). Colors tokenized via accent maps.
  const renderPhaseProgress = () => {
    const phases: FinderPhase[] = tutorOwned
      ? items.map(i => (i.id === 'rate' ? 'evaluate' : 'find'))
      : cerEnabled ? ['find', 'evaluate', 'reason'] : ['find', 'evaluate'];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const phaseOrder = workspaceDone ? phases.length : phases.indexOf(currentPhase);
          const isActive = phase === currentPhase && !workspaceDone;
          const isCompleted = index < phaseOrder;
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

  // Claim selector — the interaction control that picks which claim subsequent
  // highlights attach to. Claim-identity colors stay bespoke; the count chip
  // and neutral idle state use kit tokens.
  const renderClaimSelector = () => (
    <div className="space-y-2 mb-4">
      <p className="text-xs text-slate-500">
        {currentPhase === 'find' ? 'Select a claim, then highlight evidence for it:' : 'Claims:'}
      </p>
      <div className="flex flex-col gap-2">
        {claims.map((claim, i) => {
          const colorSet = CLAIM_COLORS[i % CLAIM_COLORS.length];
          const isActive = i === activeClaimIndex && currentPhase === 'find';
          const highlightCount = Object.values(highlightedSentences).filter(ci => ci === i).length;
          const claimAccent: LuminaAccent = (['blue', 'purple', 'emerald', 'amber'] as const)[i % 4];
          return (
            <button
              key={claim.id}
              aria-label={claim.text}
              onClick={() => handleSelectClaim(i)}
              disabled={currentPhase !== 'find'}
              className={`
                text-left px-3 py-2 rounded-lg border transition-all
                ${isActive
                  ? `${colorSet.bg} ${colorSet.border} ${colorSet.text}`
                  : 'bg-white/5 border-white/10 text-slate-300'
                }
                ${currentPhase === 'find' ? 'cursor-pointer hover:bg-white/10' : 'cursor-default'}
              `}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">{claim.text}</span>
                {highlightCount > 0 && (
                  <LuminaBadge accent={claimAccent} className="text-xs ml-2">
                    {highlightCount}
                  </LuminaBadge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render passage with highlight support — THE INTERACTION SURFACE. Clickable,
  // highlightable spans with claim-identity highlight colors. Left bespoke.
  const renderPassage = (interactive: boolean) => (
    <div className="rounded-xl bg-slate-800/40 border border-white/5 p-5 space-y-2">
      {passage.sentences.map(sentence => {
        const highlightClaimIdx = highlightedSentences[sentence.id];
        const isHighlighted = highlightClaimIdx !== undefined;
        const colorSet = isHighlighted ? CLAIM_COLORS[highlightClaimIdx % CLAIM_COLORS.length] : null;

        return (
          <span
            key={sentence.id}
            data-pip-object={`sentence-${sentence.id}`}
            onClick={() => interactive && handleToggleHighlight(sentence.id)}
            className={`
              inline cursor-default leading-relaxed text-base
              ${interactive ? 'cursor-pointer hover:bg-white/5 rounded px-0.5' : ''}
              ${isHighlighted && colorSet
                ? `${colorSet.highlight} rounded px-1 py-0.5`
                : 'text-slate-200'
              }
            `}
          >
            {sentence.text}{' '}
          </span>
        );
      })}
    </div>
  );

  // ── Help levers, drawn on the session passage only ──
  // evidence_count: a row of boxes per claim, one per sentence that clearly proves it, filled per highlight.
  const renderProofCount = () => {
    if (!helpOn(COUNT_LEVER)) return null;
    const counts = proofCounts(data);
    return (
      <div className="space-y-1" data-lever={COUNT_LEVER}>
        {counts.map((n, i) => {
          const filled = Math.min(n, Object.values(highlightedSentences).filter(c => c === i).length);
          const colorSet = CLAIM_COLORS[i % CLAIM_COLORS.length];
          return (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
              <span>{claims.length > 1 ? `Claim ${i + 1}:` : 'Sentences that prove it:'}</span>
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: n }, (_, k) => (
                  <span key={k} className={`w-4 h-4 rounded border ${k < filled ? `${colorSet.highlight} ${colorSet.border}` : 'border-white/20'}`} />
                ))}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // proof_example: a worked example on another topic, each sentence marked with why.
  const renderProofExample = () => {
    const ex = helpOn(EXAMPLE_LEVER) ? proofExample(data) : null;
    if (!ex) return null;
    return (
      <LuminaPanel accent="purple" className="space-y-2" data-lever={EXAMPLE_LEVER}>
        <LuminaSectionLabel size="sm" accent="purple">Example: {ex.topic}</LuminaSectionLabel>
        {ex.claims.map((c, i) => (
          <p key={c} className="text-xs text-slate-300">{ex.claims.length > 1 ? `Claim ${i + 1}` : 'Claim'}: {c}</p>
        ))}
        {ex.lines.map(l => (
          <p key={l.text} className="text-xs text-slate-300">
            <span aria-hidden="true">{l.mark === 'proves' ? '✅ ' : '❌ '}</span>
            &ldquo;{l.text}&rdquo; <span className="text-slate-500">({l.why})</span>
          </p>
        ))}
      </LuminaPanel>
    );
  };

  // strength_guide: what each rating means, with an example on another topic.
  const renderStrengthGuide = () => {
    const g = helpOn(GUIDE_LEVER) ? strengthGuide(data) : null;
    if (!g) return null;
    return (
      <LuminaPanel accent="amber" className="space-y-2" data-lever={GUIDE_LEVER}>
        <LuminaSectionLabel size="sm" accent="amber">Strength guide ({g.topic}): {g.claim}</LuminaSectionLabel>
        {g.rows.map(r => (
          <p key={r.strength} className="text-xs text-slate-300">
            <span className={STRENGTH_CONFIG[r.strength].text}>{STRENGTH_CONFIG[r.strength].label}</span> means {r.means}:
            {' '}&ldquo;{r.example}&rdquo;
          </p>
        ))}
      </LuminaPanel>
    );
  };

  const renderFeedback = () => feedback && (
    <LuminaFeedbackCard
      status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
    >
      {feedback}
    </LuminaFeedbackCard>
  );

  // Find phase
  const renderFindPhase = () => (
    <div className="space-y-4">
      <LuminaPrompt>
        <span className="text-sm text-slate-400">
          Read the passage and <span className="text-amber-300">click on sentences</span> that provide evidence for the claim.
        </span>
      </LuminaPrompt>

      {renderClaimSelector()}
      {renderProofCount()}
      {renderProofExample()}
      {renderPassage(true)}

      {renderFeedback()}

      <div className="flex justify-end">
        <LuminaActionButton
          action="check"
          onClick={handleCheckFind}
          disabled={Object.keys(highlightedSentences).length === 0 || (tutorOwned && progress.canAttempt === false)}
        >
          Check Evidence
        </LuminaActionButton>
      </div>
    </div>
  );

  // Evaluate phase - rate evidence strength. The workspace rates every evidence sentence (the find is credited by
  // then); the scripted path rates what the learner highlighted.
  const renderEvaluatePhase = () => {
    const evidenceSentences = tutorOwned
      ? rateList(shown)
      : Object.keys(highlightedSentences)
        .map(id => passage.sentences.find(s => s.id === id))
        .filter((s): s is NonNullable<typeof s> => !!s);
    const allRated = evidenceSentences.every(s => strengthRatings[s.id]);

    return (
      <div className="space-y-4">
        <LuminaPrompt>
          <span className="text-sm text-slate-400">
            Rate how <span className="text-amber-300">strong</span> each piece of evidence is.
          </span>
        </LuminaPrompt>

        {renderClaimSelector()}
        {renderStrengthGuide()}

        {/* Evidence items with strength rating — interaction surface. Claim
            color + strength-rating colors are domain meaning, kept bespoke. */}
        <div className="space-y-3">
          {evidenceSentences.map(sentence => {
            const rating = strengthRatings[sentence.id];
            const claimIdx = tutorOwned ? claimOf(shown, sentence) : highlightedSentences[sentence.id];
            const colorSet = CLAIM_COLORS[claimIdx % CLAIM_COLORS.length];
            return (
              <div
                key={sentence.id}
                className={`rounded-lg border p-3 space-y-2 ${colorSet.border} ${colorSet.bg}`}
              >
                <p className={`text-sm ${colorSet.text}`}>&ldquo;{sentence.text}&rdquo;</p>
                <div className="flex gap-2">
                  {(['strong', 'moderate', 'weak'] as const).map(strength => {
                    const cfg = STRENGTH_CONFIG[strength];
                    const isSelected = rating === strength;
                    return (
                      <button
                        key={strength}
                        aria-label={`${cfg.label}: ${sentence.text.trim()}`}
                        onClick={() => handleSetStrength(sentence.id, strength)}
                        className={`
                          px-3 py-1 rounded-md border text-xs font-medium transition-all
                          ${isSelected
                            ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }
                        `}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {tutorOwned && renderFeedback()}

        <div className="flex justify-end">
          {tutorOwned ? (
            <LuminaActionButton
              action="check"
              onClick={handleCheckRate}
              disabled={!allRated || progress.canAttempt === false}
            >
              Check Ratings
            </LuminaActionButton>
          ) : (
            <LuminaActionButton
              action={cerEnabled ? 'next' : 'check'}
              onClick={handleDoneEvaluate}
              disabled={hasSubmittedEvaluation}
            >
              {cerEnabled ? 'Next: Reasoning' : 'Finish'}
            </LuminaActionButton>
          )}
        </div>
      </div>
    );
  };

  // Reason phase (CER) — scripted path only: open writing with no check.
  const renderReasonPhase = () => (
    <div className="space-y-4">
      <LuminaPrompt>
        <span className="text-sm text-slate-400">
          Explain <span className="text-amber-300">how</span> the evidence supports each claim (1-2 sentences).
        </span>
      </LuminaPrompt>

      {/* CER scaffold */}
      {claims.map((claim, i) => {
        const colorSet = CLAIM_COLORS[i % CLAIM_COLORS.length];
        const claimAccent: LuminaAccent = (['blue', 'purple', 'emerald', 'amber'] as const)[i % 4];
        const evidenceForClaim = Object.entries(highlightedSentences)
          .filter(([, ci]) => ci === i)
          .map(([id]) => passage.sentences.find(s => s.id === id))
          .filter(Boolean);

        return (
          <LuminaPanel key={claim.id} accent={claimAccent} className="space-y-3">
            {/* Claim */}
            <div>
              <LuminaSectionLabel size="sm" accent={claimAccent}>Claim</LuminaSectionLabel>
              <p className={`text-sm font-medium mt-1 ${colorSet.text}`}>{claim.text}</p>
            </div>

            {/* Evidence summary */}
            <div>
              <LuminaSectionLabel size="sm" accent={claimAccent}>Evidence</LuminaSectionLabel>
              <div className="mt-1">
                {evidenceForClaim.length > 0 ? (
                  evidenceForClaim.map(s => s && (
                    <p key={s.id} className="text-sm text-slate-300 italic">
                      &ldquo;{s.text}&rdquo;
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No evidence highlighted for this claim.</p>
                )}
              </div>
            </div>

            {/* Reasoning — student production surface (free-text), kept bespoke. */}
            <div>
              <LuminaSectionLabel size="sm" accent={claimAccent}>Reasoning</LuminaSectionLabel>
              <textarea
                aria-label={`Reasoning for claim ${i + 1}`}
                value={reasoningTexts[i] || ''}
                onChange={(e) => handleReasoningChange(i, e.target.value)}
                placeholder="Explain how this evidence supports the claim..."
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
              />
            </div>
          </LuminaPanel>
        );
      })}

      <div className="flex justify-end">
        <LuminaActionButton
          action="check"
          onClick={submitFinalEvaluation}
          disabled={hasSubmittedEvaluation}
        >
          Finish
        </LuminaActionButton>
      </div>
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
    instanceId: instanceId || 'evidence-finder',
    scopeId: finished ? null : currentPhase,
    label: 'The passage and the claims',
    solved: feedbackType === 'success',
    tutorSpeaking: false,
  });

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              {cerEnabled && (
                <LuminaBadge accent="purple" className="text-xs">CER Framework</LuminaBadge>
              )}
            </div>
          </div>
          <LuminaBadge accent={PHASE_CONFIG[currentPhase].accent} className="text-xs">
            {PHASE_CONFIG[currentPhase].description}
          </LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderPhaseProgress()}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !finished && <div {...pip.dock} />}
        {!workspaceDone && (
          <div {...pip.workspace} className="space-y-4">
            {practice && (
              <LuminaBadge accent="purple" className="text-xs">Practice passage: not graded</LuminaBadge>
            )}
            {currentPhase === 'find' && renderFindPhase()}
            {currentPhase === 'evaluate' && renderEvaluatePhase()}
            {currentPhase === 'reason' && renderReasonPhase()}
          </div>
        )}

        {/* Final results */}
        {finished && (
          <LuminaFeedbackCard status="correct" label="Session Complete!">
            You found {Object.keys(highlightedSentences).filter(id =>
              data.passage.sentences.find(s => s.id === id)?.isEvidence
            ).length} of {totalEvidence} evidence sentences.
          </LuminaFeedbackCard>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

// The workspace path never mounts the scripted progress, whose Next would compete with the observer.
const EvidenceFinder = withWorkspaceController<EvidenceFinderProps, ProgressOptions<EvidenceFinderItem>, Progress>(
  'evidence-finder', EvidenceFinderSurface, useScriptedProgress, useWorkspaceProgressFor('evidence-finder'));

export default EvidenceFinder;
