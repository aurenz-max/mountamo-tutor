'use client';

import React, { useState, useCallback, useMemo } from 'react';
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
}

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

// ============================================================================
// Component
// ============================================================================

const EvidenceFinder: React.FC<EvidenceFinderProps> = ({ data, className }) => {
  const {
    title,
    gradeLevel,
    passage,
    claims = [],
    cerEnabled = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Phase state
  const [currentPhase, setCurrentPhase] = useState<FinderPhase>('find');
  const [activeClaimIndex, setActiveClaimIndex] = useState(0);

  // Highlighting state: maps sentence ID -> claim index the user assigned
  const [highlightedSentences, setHighlightedSentences] = useState<Record<string, number>>({});

  // Strength ratings: maps sentence ID -> user's strength rating
  const [strengthRatings, setStrengthRatings] = useState<Record<string, 'strong' | 'moderate' | 'weak'>>({});

  // CER reasoning: maps claim index -> user's reasoning text
  const [reasoningTexts, setReasoningTexts] = useState<Record<number, string>>({});

  // Feedback
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info' | ''>('');

  // Evaluation hook
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<EvidenceFinderMetrics>({
    primitiveType: 'evidence-finder',
    instanceId: instanceId || `evidence-finder-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Total evidence sentences in passage
  const totalEvidence = useMemo(() => {
    return passage.sentences.filter(s => s.isEvidence).length;
  }, [passage]);

  // Toggle highlight on a sentence for the active claim
  const handleToggleHighlight = useCallback((sentenceId: string) => {
    if (hasSubmittedEvaluation || currentPhase !== 'find') return;
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
    setFeedback('');
    setFeedbackType('');
  }, [hasSubmittedEvaluation, currentPhase, activeClaimIndex]);

  // Set strength rating for a sentence
  const handleSetStrength = useCallback((sentenceId: string, strength: 'strong' | 'moderate' | 'weak') => {
    if (hasSubmittedEvaluation || currentPhase !== 'evaluate') return;
    setStrengthRatings(prev => ({ ...prev, [sentenceId]: strength }));
  }, [hasSubmittedEvaluation, currentPhase]);

  // Update reasoning text
  const handleReasoningChange = useCallback((claimIndex: number, text: string) => {
    if (hasSubmittedEvaluation) return;
    setReasoningTexts(prev => ({ ...prev, [claimIndex]: text }));
  }, [hasSubmittedEvaluation]);

  // Check evidence in find phase and advance
  const handleCheckFind = useCallback(() => {
    const highlightedIds = Object.keys(highlightedSentences);
    if (highlightedIds.length === 0) {
      setFeedback('Highlight at least one sentence as evidence.');
      setFeedbackType('info');
      return;
    }

    // Count correct and false evidence
    let correct = 0;
    let falsePositives = 0;
    highlightedIds.forEach(id => {
      const sentence = passage.sentences.find(s => s.id === id);
      if (sentence?.isEvidence) {
        correct++;
      } else {
        falsePositives++;
      }
    });

    if (correct > 0) {
      SoundManager.playCorrect();
      setFeedback(`Found ${correct} piece${correct > 1 ? 's' : ''} of evidence!${falsePositives > 0 ? ` (${falsePositives} non-evidence also highlighted)` : ''}`);
      setFeedbackType('success');
      // Advance to evaluate phase after brief delay
      setTimeout(() => {
        setCurrentPhase('evaluate');
        setFeedback('');
        setFeedbackType('');
      }, 1200);
    } else {
      SoundManager.playIncorrect();
      setFeedback('The highlighted sentence(s) are not strong evidence. Try again!');
      setFeedbackType('error');
    }
  }, [highlightedSentences, passage]);

  // Advance from evaluate to reason phase
  const handleDoneEvaluate = useCallback(() => {
    if (cerEnabled) {
      setCurrentPhase('reason');
    } else {
      submitFinalEvaluation();
    }
  }, [cerEnabled]);

  // Submit final evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const highlightedIds = Object.keys(highlightedSentences);
    let correctEvidence = 0;
    let falseEvidence = 0;
    let strengthAccuracyTotal = 0;
    let strengthRated = 0;

    highlightedIds.forEach(id => {
      const sentence = passage.sentences.find(s => s.id === id);
      if (sentence?.isEvidence) {
        correctEvidence++;
        // Check strength rating accuracy
        if (strengthRatings[id] && sentence.evidenceStrength) {
          strengthRated++;
          if (strengthRatings[id] === sentence.evidenceStrength) {
            strengthAccuracyTotal += 100;
          } else {
            // Partial credit for adjacent ratings
            const order = ['weak', 'moderate', 'strong'];
            const userIdx = order.indexOf(strengthRatings[id]);
            const correctIdx = order.indexOf(sentence.evidenceStrength);
            if (Math.abs(userIdx - correctIdx) === 1) {
              strengthAccuracyTotal += 50;
            }
          }
        }
      } else {
        falseEvidence++;
      }
    });

    const strengthAccuracy = strengthRated > 0 ? Math.round(strengthAccuracyTotal / strengthRated) : 0;
    const reasoningProvided = Object.values(reasoningTexts).some(t => t.trim().length > 10);
    const cerComplete = cerEnabled && claims.every((_, i) => (reasoningTexts[i]?.trim().length || 0) > 10);

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
      attemptsCount: 1,
    };

    submitEvaluation(
      score >= 50,
      Math.max(0, score),
      metrics,
      {
        highlightedSentences,
        strengthRatings,
        reasoningTexts,
      }
    );
  }, [
    hasSubmittedEvaluation,
    highlightedSentences,
    strengthRatings,
    reasoningTexts,
    passage,
    totalEvidence,
    cerEnabled,
    claims,
    gradeLevel,
    submitEvaluation,
  ]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  // Phase progress — a bespoke horizontal step indicator (no kit equivalent for
  // a multi-step progress rail). Colors tokenized via accent maps.
  const renderPhaseProgress = () => {
    const phases: FinderPhase[] = cerEnabled ? ['find', 'evaluate', 'reason'] : ['find', 'evaluate'];
    return (
      <div className="flex items-center gap-2 mb-4">
        {phases.map((phase, index) => {
          const isActive = phase === currentPhase;
          const phaseOrder = phases.indexOf(currentPhase);
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
              onClick={() => currentPhase === 'find' && setActiveClaimIndex(i)}
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

  // Find phase
  const renderFindPhase = () => (
    <div className="space-y-4">
      <LuminaPrompt>
        <span className="text-sm text-slate-400">
          Read the passage and <span className="text-amber-300">click on sentences</span> that provide evidence for the claim.
        </span>
      </LuminaPrompt>

      {renderClaimSelector()}
      {renderPassage(true)}

      {/* Feedback */}
      {feedback && (
        <LuminaFeedbackCard
          status={feedbackType === 'success' ? 'correct' : feedbackType === 'error' ? 'incorrect' : 'insight'}
        >
          {feedback}
        </LuminaFeedbackCard>
      )}

      <div className="flex justify-end">
        <LuminaActionButton
          action="check"
          onClick={handleCheckFind}
          disabled={Object.keys(highlightedSentences).length === 0}
        >
          Check Evidence
        </LuminaActionButton>
      </div>
    </div>
  );

  // Evaluate phase - rate evidence strength
  const renderEvaluatePhase = () => {
    const highlightedIds = Object.keys(highlightedSentences);
    const evidenceSentences = highlightedIds
      .map(id => passage.sentences.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s);

    return (
      <div className="space-y-4">
        <LuminaPrompt>
          <span className="text-sm text-slate-400">
            Rate how <span className="text-amber-300">strong</span> each piece of evidence is.
          </span>
        </LuminaPrompt>

        {renderClaimSelector()}

        {/* Evidence items with strength rating — interaction surface. Claim
            color + strength-rating colors are domain meaning, kept bespoke. */}
        <div className="space-y-3">
          {evidenceSentences.map(sentence => {
            const rating = strengthRatings[sentence.id];
            const claimIdx = highlightedSentences[sentence.id];
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

        <div className="flex justify-end">
          <LuminaActionButton
            action={cerEnabled ? 'next' : 'check'}
            onClick={handleDoneEvaluate}
          >
            {cerEnabled ? 'Next: Reasoning' : 'Finish'}
          </LuminaActionButton>
        </div>
      </div>
    );
  };

  // Reason phase (CER)
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

      {/* Final results */}
      {hasSubmittedEvaluation && (
        <LuminaFeedbackCard status="correct" label="Session Complete!">
          You found {Object.keys(highlightedSentences).filter(id =>
            passage.sentences.find(s => s.id === id)?.isEvidence
          ).length} of {totalEvidence} evidence sentences.
        </LuminaFeedbackCard>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (!passage || passage.sentences.length === 0 || claims.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No passage or claims available.</p>
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

        {currentPhase === 'find' && renderFindPhase()}
        {currentPhase === 'evaluate' && renderEvaluatePhase()}
        {currentPhase === 'reason' && renderReasonPhase()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default EvidenceFinder;
