'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaButton,
  LuminaActionButton,
  LuminaFeedbackCard,
  answerStateClass,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RevisionWorkshopMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type RevisionSkill = 'add-details' | 'word-choice' | 'combine-sentences' | 'transitions' | 'reorganize' | 'concision';

export interface RevisionTarget {
  targetId: string;
  originalText: string;                // The text to revise
  suggestion: string;                  // Hint or guidance
  alternatives?: string[];             // Selectable alternatives (for word-choice)
  idealRevision: string;               // Model answer
}

export interface RevisionWorkshopData {
  title: string;
  gradeLevel: string;
  revisionSkill: RevisionSkill;
  draft: string;                       // The full draft passage with weaknesses
  targets: RevisionTarget[];           // Specific revision targets in the draft

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RevisionWorkshopMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface RevisionWorkshopProps {
  data: RevisionWorkshopData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type WorkshopPhase = 'read' | 'revise' | 'compare';

const SKILL_LABELS: Record<RevisionSkill, string> = {
  'add-details': 'Add Details',
  'word-choice': 'Word Choice',
  'combine-sentences': 'Combine Sentences',
  'transitions': 'Transitions',
  'reorganize': 'Reorganize',
  'concision': 'Cut Unnecessary Words',
};

// Accent per skill — drives chrome (badges, pills) through the kit palette.
const SKILL_ACCENTS: Record<RevisionSkill, LuminaAccent> = {
  'add-details': 'blue',
  'word-choice': 'purple',
  'combine-sentences': 'emerald',
  'transitions': 'amber',
  'reorganize': 'rose',
  'concision': 'cyan',
};

// In-passage highlight tint for the dashed underline on the draft text body
// (the bespoke interaction/reading surface — NOT chrome).
const SKILL_HIGHLIGHT: Record<RevisionSkill, string> = {
  'add-details': 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  'word-choice': 'bg-violet-500/10 border-violet-500/30 text-violet-300',
  'combine-sentences': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  'transitions': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'reorganize': 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  'concision': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
};

// ============================================================================
// Component
// ============================================================================

const RevisionWorkshop: React.FC<RevisionWorkshopProps> = ({ data, className }) => {
  const {
    title, gradeLevel, revisionSkill, draft, targets,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<WorkshopPhase>('read');
  const [revisions, setRevisions] = useState<Record<string, string>>({}); // targetId -> student revision
  const [beforeAfterCompared, setBeforeAfterCompared] = useState(false);
  // Reorganize mode: track sentence order as array of target indices
  const [sentenceOrder, setSentenceOrder] = useState<number[]>(() => targets.map((_, i) => i));

  const skillAccent = SKILL_ACCENTS[revisionSkill];

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<RevisionWorkshopMetrics>({
    primitiveType: 'revision-workshop',
    instanceId: instanceId || `revision-workshop-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase nav
  const phases: WorkshopPhase[] = ['read', 'revise', 'compare'];
  const phaseLabels: Record<WorkshopPhase, string> = { read: 'Read Draft', revise: 'Revise', compare: 'Compare' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx + 1]);
    }
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) {
      SoundManager.navigate();
      setCurrentPhase(phases[idx - 1]);
    }
  };

  // Reorganize helpers
  const isReorganize = revisionSkill === 'reorganize';

  const moveSentence = useCallback((fromIdx: number, direction: 'up' | 'down') => {
    setSentenceOrder(prev => {
      const arr = [...prev];
      const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0 || toIdx >= arr.length) return prev;
      SoundManager.snap();
      [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
      return arr;
    });
  }, []);

  // Build revised draft
  const getRevisedDraft = useCallback(() => {
    if (isReorganize) {
      return sentenceOrder.map(i => targets[i]?.originalText || '').join(' ');
    }
    let revised = draft;
    targets.forEach(t => {
      const replacement = revisions[t.targetId];
      if (replacement && replacement.trim()) {
        revised = revised.replace(t.originalText, replacement);
      }
    });
    return revised;
  }, [draft, targets, revisions, isReorganize, sentenceOrder]);

  // Ideal draft for reorganize (targets in original array order = correct order)
  const idealDraft = useMemo(() => {
    if (!isReorganize) return '';
    return targets.map(t => t.idealRevision || t.originalText).join(' ');
  }, [isReorganize, targets]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    let revisionsApplied: number;
    let improvementScore: number;

    if (isReorganize) {
      // Score reorganize by how many sentences are in correct position
      const correctPositions = sentenceOrder.filter((origIdx, pos) => origIdx === pos).length;
      revisionsApplied = correctPositions;
      improvementScore = targets.length > 0 ? Math.round((correctPositions / targets.length) * 100) : 0;
    } else {
      revisionsApplied = targets.filter(t => (revisions[t.targetId] || '').trim().length > 3).length;
      const changed = targets.filter(t => {
        const rev = (revisions[t.targetId] || '').trim();
        return rev.length > 3 && rev !== t.originalText;
      }).length;
      improvementScore = targets.length > 0 ? Math.round((changed / targets.length) * 100) : 0;
    }

    const score = targets.length > 0 ? Math.round((revisionsApplied / targets.length) * 70) + (beforeAfterCompared ? 15 : 0) + (improvementScore > 50 ? 15 : 5) : 50;

    const metrics: RevisionWorkshopMetrics = {
      type: 'revision-workshop',
      revisionSkill,
      revisionsApplied,
      revisionTargets: targets.length,
      improvementScore,
      beforeAfterCompared,
      readAloudUsed: false,
      attemptsCount: 1,
    };

    submitEvaluation(score >= 50, Math.min(100, score), metrics, {
      ...(isReorganize ? { sentenceOrder } : { revisions }),
      revisedDraft: getRevisedDraft(),
    });
  }, [hasSubmittedEvaluation, targets, revisions, revisionSkill, beforeAfterCompared, getRevisedDraft, submitEvaluation, isReorganize, sentenceOrder]);

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

  // Render draft with targets highlighted (bespoke reading surface)
  const renderDraftWithHighlights = () => {
    let remaining = draft;
    const elements: React.ReactNode[] = [];
    let key = 0;

    // Sort targets by their position in draft
    const sortedTargets = [...targets].sort((a, b) => draft.indexOf(a.originalText) - draft.indexOf(b.originalText));

    sortedTargets.forEach(target => {
      const idx = remaining.indexOf(target.originalText);
      if (idx === -1) return;

      // Text before target
      if (idx > 0) {
        elements.push(<span key={key++} className="text-slate-200">{remaining.slice(0, idx)}</span>);
      }

      // Highlighted target
      elements.push(
        <span key={key++} className={`rounded px-0.5 border-b-2 border-dashed ${SKILL_HIGHLIGHT[revisionSkill]}`}>
          {target.originalText}
        </span>
      );

      remaining = remaining.slice(idx + target.originalText.length);
    });

    // Remaining text
    if (remaining) {
      elements.push(<span key={key++} className="text-slate-200">{remaining}</span>);
    }

    return <p className="text-sm leading-relaxed">{elements}</p>;
  };

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent={skillAccent} className="text-xs">
                {SKILL_LABELS[revisionSkill]}
              </LuminaBadge>
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Read */}
        {currentPhase === 'read' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              {isReorganize
                ? 'Read this passage — the sentences are out of order. Your job is to put them in the right order:'
                : 'Read this draft and notice the highlighted areas that need revision:'}
            </p>
            {/* Bespoke reading surface — the draft text body with highlightable spans. */}
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {isReorganize
                ? <p className="text-sm leading-relaxed text-slate-200">{draft}</p>
                : renderDraftWithHighlights()}
            </div>
            <LuminaPanel accent="amber" className="p-2">
              <p className="text-xs text-amber-300">Focus: <span className="font-bold">{SKILL_LABELS[revisionSkill]}</span> — {isReorganize ? `${targets.length} sentences to reorder` : `${targets.length} areas to improve`}</p>
            </LuminaPanel>
            <div className="flex justify-end">
              <LuminaButton tone="primary" onClick={nextPhase}>
                Start Revising
              </LuminaButton>
            </div>
          </div>
        )}

        {/* Phase 2: Revise */}
        {currentPhase === 'revise' && (
          <div className="space-y-3">
            {isReorganize ? (
              <>
                <p className="text-xs text-slate-500">Reorder these sentences so they flow logically. Use the arrows to move sentences up or down:</p>
                {/* Bespoke arrange surface — sentence reorder rows. */}
                <div className="space-y-1.5">
                  {sentenceOrder.map((origIdx, pos) => {
                    const target = targets[origIdx];
                    if (!target) return null;
                    return (
                      <div key={target.targetId} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 p-2.5">
                        <span className="text-xs font-mono text-slate-500 w-5 shrink-0 text-center">{pos + 1}</span>
                        <p className="text-sm text-slate-200 flex-1">{target.originalText}</p>
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            onClick={() => moveSentence(pos, 'up')}
                            disabled={pos === 0}
                            className="px-1.5 py-0.5 rounded text-xs border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveSentence(pos, 'down')}
                            disabled={pos === sentenceOrder.length - 1}
                            className="px-1.5 py-0.5 rounded text-xs border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500">Revise each highlighted section:</p>
                {/* Bespoke edit surface — per-target revision composers. */}
                {targets.map(target => (
                  <div key={target.targetId} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${SKILL_HIGHLIGHT[revisionSkill]}`}>Original</span>
                      <p className="text-sm text-slate-400 line-through">{target.originalText}</p>
                    </div>
                    <p className="text-xs text-slate-500">{target.suggestion}</p>

                    {target.alternatives && target.alternatives.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {target.alternatives.map((alt, i) => (
                          <button key={i} onClick={() => { SoundManager.select(); setRevisions(prev => ({ ...prev, [target.targetId]: alt })); }}
                            className={`px-2 py-1 rounded text-xs border transition-all ${answerStateClass(
                              revisions[target.targetId] === alt ? 'selected' : 'idle'
                            )}`}>
                            {alt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={revisions[target.targetId] || ''}
                        onChange={e => setRevisions(prev => ({ ...prev, [target.targetId]: e.target.value }))}
                        placeholder="Write your revision..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                      />
                    )}
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between">
              <LuminaButton onClick={prevPhase}>Back</LuminaButton>
              <LuminaButton tone="primary" onClick={nextPhase}
                disabled={!isReorganize && !targets.some(t => (revisions[t.targetId] || '').trim())}>
                Compare
              </LuminaButton>
            </div>
          </div>
        )}

        {/* Phase 3: Compare */}
        {currentPhase === 'compare' && (
          <div className="space-y-4">
            {/* Bespoke before/after comparison surface. */}
            <div className={`grid ${isReorganize ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
              <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                <p className="text-xs font-bold text-rose-400 mb-2">{isReorganize ? 'Scrambled' : 'Before'}</p>
                <p className="text-sm text-slate-300 leading-relaxed">{draft}</p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                <p className="text-xs font-bold text-emerald-400 mb-2">Your Order</p>
                <p className="text-sm text-slate-300 leading-relaxed">{getRevisedDraft()}</p>
              </div>
              {isReorganize && (
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                  <p className="text-xs font-bold text-blue-400 mb-2">Ideal Order</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{idealDraft}</p>
                </div>
              )}
            </div>

            {!beforeAfterCompared && (
              <LuminaButton tone="primary" onClick={() => setBeforeAfterCompared(true)}
                className="text-xs w-full">
                I&apos;ve compared both versions
              </LuminaButton>
            )}

            <div className="flex justify-between items-center gap-3">
              <LuminaButton onClick={prevPhase}>Edit</LuminaButton>
              {!hasSubmittedEvaluation ? (
                <LuminaActionButton action="check" onClick={submitFinalEvaluation}>
                  Submit
                </LuminaActionButton>
              ) : (
                <LuminaFeedbackCard status="correct" label="Revision Complete!" className="flex-1">
                  {targets.filter(t => (revisions[t.targetId] || '').trim()).length}/{targets.length} revisions applied
                </LuminaFeedbackCard>
              )}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default RevisionWorkshop;
