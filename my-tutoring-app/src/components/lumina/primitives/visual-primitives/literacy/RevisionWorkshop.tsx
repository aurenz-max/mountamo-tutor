'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { RevisionWorkshopMetrics } from '../../../evaluation/types';

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

const SKILL_COLORS: Record<RevisionSkill, string> = {
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
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Build revised draft
  const getRevisedDraft = useCallback(() => {
    let revised = draft;
    targets.forEach(t => {
      const replacement = revisions[t.targetId];
      if (replacement && replacement.trim()) {
        revised = revised.replace(t.originalText, replacement);
      }
    });
    return revised;
  }, [draft, targets, revisions]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const revisionsApplied = targets.filter(t => (revisions[t.targetId] || '').trim().length > 3).length;

    // Simple improvement score based on whether revisions were made and differ from original
    const changed = targets.filter(t => {
      const rev = (revisions[t.targetId] || '').trim();
      return rev.length > 3 && rev !== t.originalText;
    }).length;
    const improvementScore = targets.length > 0 ? Math.round((changed / targets.length) * 100) : 0;

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

    submitEvaluation(score >= 50, Math.min(100, score), metrics, { revisions, revisedDraft: getRevisedDraft() });
  }, [hasSubmittedEvaluation, targets, revisions, revisionSkill, beforeAfterCompared, getRevisedDraft, submitEvaluation]);

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

  // Render draft with targets highlighted
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
        <span key={key++} className={`rounded px-0.5 border-b-2 border-dashed ${SKILL_COLORS[revisionSkill]}`}>
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
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className={`${SKILL_COLORS[revisionSkill]} text-xs`}>
                {SKILL_LABELS[revisionSkill]}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Read */}
        {currentPhase === 'read' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Read this draft and notice the highlighted areas that need revision:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderDraftWithHighlights()}
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <p className="text-xs text-amber-300">Focus: <span className="font-bold">{SKILL_LABELS[revisionSkill]}</span> — {targets.length} areas to improve</p>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Start Revising
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Revise */}
        {currentPhase === 'revise' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Revise each highlighted section:</p>
            {targets.map(target => (
              <div key={target.targetId} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${SKILL_COLORS[revisionSkill]}`}>Original</span>
                  <p className="text-sm text-slate-400 line-through">{target.originalText}</p>
                </div>
                <p className="text-xs text-slate-500">{target.suggestion}</p>

                {target.alternatives && target.alternatives.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {target.alternatives.map((alt, i) => (
                      <button key={i} onClick={() => setRevisions(prev => ({ ...prev, [target.targetId]: alt }))}
                        className={`px-2 py-1 rounded text-xs border transition-all ${
                          revisions[target.targetId] === alt
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}>
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
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                disabled={!targets.some(t => (revisions[t.targetId] || '').trim())}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Compare
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Compare */}
        {currentPhase === 'compare' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-rose-500/5 border border-rose-500/20 p-3">
                <p className="text-xs font-bold text-rose-400 mb-2">Before</p>
                <p className="text-sm text-slate-300 leading-relaxed">{draft}</p>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
                <p className="text-xs font-bold text-emerald-400 mb-2">After</p>
                <p className="text-sm text-slate-300 leading-relaxed">{getRevisedDraft()}</p>
              </div>
            </div>

            {!beforeAfterCompared && (
              <Button variant="ghost" onClick={() => setBeforeAfterCompared(true)}
                className="bg-violet-500/20 border border-violet-500/40 hover:bg-violet-500/30 text-violet-300 text-xs w-full">
                I&apos;ve compared both versions
              </Button>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Submit
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Revision Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {targets.filter(t => (revisions[t.targetId] || '').trim()).length}/{targets.length} revisions applied
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RevisionWorkshop;
