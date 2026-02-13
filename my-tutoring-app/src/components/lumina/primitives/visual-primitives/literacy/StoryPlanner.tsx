'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { StoryPlannerMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface StoryElement {
  elementId: string;
  label: string;                     // "Character", "Setting", "Problem", etc.
  prompt: string;                    // "Who is your main character? Describe them."
  required: boolean;
}

export interface StoryPlannerData {
  title: string;
  gradeLevel: string;
  writingPrompt: string;              // The narrative writing prompt
  elements: StoryElement[];           // Planning cards to fill out
  storyArcLabels: string[];           // e.g. ["Beginning", "Rising Action", "Climax", "Falling Action", "Resolution"]
  conflictTypes?: string[];           // For grades 4+: internal, external, person vs nature, etc.
  dialoguePrompt?: string;            // For grades 3+: guidance for adding dialogue

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<StoryPlannerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface StoryPlannerProps {
  data: StoryPlannerData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type PlannerPhase = 'plan' | 'arc' | 'review';

// ============================================================================
// Component
// ============================================================================

const StoryPlanner: React.FC<StoryPlannerProps> = ({ data, className }) => {
  const {
    title, gradeLevel, writingPrompt, elements, storyArcLabels, conflictTypes, dialoguePrompt,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<PlannerPhase>('plan');
  const [elementTexts, setElementTexts] = useState<Record<string, string>>({});
  const [arcTexts, setArcTexts] = useState<Record<string, string>>({});
  const [selectedConflict, setSelectedConflict] = useState<string>('');

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<StoryPlannerMetrics>({
    primitiveType: 'story-planner',
    instanceId: instanceId || `story-planner-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase nav
  const phases: PlannerPhase[] = ['plan', 'arc', 'review'];
  const phaseLabels: Record<PlannerPhase, string> = { plan: 'Plan Elements', arc: 'Story Arc', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Metrics calculation
  const calculateMetrics = useCallback(() => {
    const requiredElements = elements.filter(e => e.required);
    const filledRequired = requiredElements.filter(e => (elementTexts[e.elementId] || '').trim().length > 5).length;
    const totalFilled = elements.filter(e => (elementTexts[e.elementId] || '').trim().length > 5).length;
    const eventCount = storyArcLabels.filter(label => (arcTexts[label] || '').trim().length > 5).length;

    // Character depth
    const charElement = elements.find(e => e.label.toLowerCase().includes('character'));
    const charText = charElement ? (elementTexts[charElement.elementId] || '') : '';
    const hasTraits = charText.length > 20;
    const characterDepth: 'deep' | 'moderate' | 'surface' = hasTraits && charText.length > 50 ? 'deep' : hasTraits ? 'moderate' : 'surface';

    // Conflict
    const conflictIdentified = !!selectedConflict || elements.some(e =>
      e.label.toLowerCase().includes('problem') && (elementTexts[e.elementId] || '').trim().length > 5
    );

    // Resolution connects to conflict
    const resolutionArc = arcTexts[storyArcLabels[storyArcLabels.length - 1]] || '';
    const resolutionConnects = resolutionArc.trim().length > 10;

    // Descriptive language (simple count of adjective-like patterns)
    const allText = [...Object.values(elementTexts), ...Object.values(arcTexts)].join(' ');
    const descriptiveCount = (allText.match(/\b(beautiful|bright|dark|cold|warm|soft|loud|quiet|huge|tiny|sparkling|mysterious|ancient|colorful|gentle|fierce|smooth|rough)\b/gi) || []).length;

    return {
      elementsPlanned: totalFilled,
      elementsRequired: requiredElements.length,
      characterDepth,
      eventCount,
      conflictIdentified,
      resolutionConnectsToConflict: resolutionConnects,
      descriptiveLanguageUsed: descriptiveCount,
      filledRequired,
    };
  }, [elements, elementTexts, arcTexts, storyArcLabels, selectedConflict]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateMetrics();

    // Score: elements (30%) + arc events (30%) + conflict (20%) + resolution (10%) + descriptive (10%)
    const elemScore = m.elementsRequired > 0 ? Math.round((m.filledRequired / m.elementsRequired) * 30) : 30;
    const arcScore = storyArcLabels.length > 0 ? Math.round((m.eventCount / storyArcLabels.length) * 30) : 30;
    const conflictScore = m.conflictIdentified ? 20 : 0;
    const resScore = m.resolutionConnectsToConflict ? 10 : 0;
    const descScore = Math.min(10, m.descriptiveLanguageUsed * 3);
    const score = elemScore + arcScore + conflictScore + resScore + descScore;

    const metrics: StoryPlannerMetrics = {
      type: 'story-planner',
      elementsPlanned: m.elementsPlanned,
      elementsRequired: m.elementsRequired,
      characterDepth: m.characterDepth,
      eventCount: m.eventCount,
      conflictIdentified: m.conflictIdentified,
      resolutionConnectsToConflict: m.resolutionConnectsToConflict,
      descriptiveLanguageUsed: m.descriptiveLanguageUsed,
    };

    submitEvaluation(score >= 50, score, metrics, { elementTexts, arcTexts, selectedConflict });
  }, [hasSubmittedEvaluation, calculateMetrics, storyArcLabels, submitEvaluation, elementTexts, arcTexts, selectedConflict]);

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

  const ARC_COLORS = ['bg-blue-500/15 border-blue-500/30', 'bg-amber-500/15 border-amber-500/30', 'bg-rose-500/15 border-rose-500/30', 'bg-amber-500/15 border-amber-500/30', 'bg-emerald-500/15 border-emerald-500/30'];

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Writing prompt */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs text-slate-500 mb-1">Writing Prompt:</p>
          <p className="text-slate-200 text-sm font-medium">{writingPrompt}</p>
        </div>

        {/* Phase 1: Plan Elements */}
        {currentPhase === 'plan' && (
          <div className="space-y-3">
            {elements.map(elem => (
              <div key={elem.elementId} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-300">{elem.label}</p>
                  {elem.required && <span className="text-xs text-rose-400">*</span>}
                </div>
                <p className="text-xs text-slate-500">{elem.prompt}</p>
                <textarea
                  value={elementTexts[elem.elementId] || ''}
                  onChange={e => setElementTexts(prev => ({ ...prev, [elem.elementId]: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                />
              </div>
            ))}

            {conflictTypes && conflictTypes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-slate-500">Conflict type:</p>
                <div className="flex flex-wrap gap-1.5">
                  {conflictTypes.map(ct => (
                    <button key={ct} onClick={() => setSelectedConflict(ct)}
                      className={`px-2 py-1 rounded text-xs border transition-all ${
                        selectedConflict === ct ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}>
                      {ct}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase}
                disabled={elements.filter(e => e.required).every(e => !(elementTexts[e.elementId] || '').trim())}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Story Arc
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Story Arc */}
        {currentPhase === 'arc' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Plan what happens at each part of your story:</p>
            {dialoguePrompt && (
              <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-2">
                <p className="text-xs text-violet-300">{dialoguePrompt}</p>
              </div>
            )}
            <div className="space-y-2">
              {storyArcLabels.map((label, i) => (
                <div key={label} className={`rounded-lg border p-3 ${ARC_COLORS[i % ARC_COLORS.length]}`}>
                  <p className="text-xs font-bold text-slate-300 mb-1">{label}</p>
                  <textarea
                    value={arcTexts[label] || ''}
                    onChange={e => setArcTexts(prev => ({ ...prev, [label]: e.target.value }))}
                    placeholder={`What happens in the ${label.toLowerCase()}?`}
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-black/20 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                disabled={!storyArcLabels.some(l => (arcTexts[l] || '').trim())}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {/* Elements summary */}
            <div className="grid gap-2 grid-cols-2">
              {elements.map(elem => (
                <div key={elem.elementId} className="rounded-lg bg-white/5 border border-white/10 p-2">
                  <p className="text-xs font-bold text-slate-400">{elem.label}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{elementTexts[elem.elementId] || <span className="italic text-slate-600">Empty</span>}</p>
                </div>
              ))}
            </div>

            {/* Arc visualization */}
            <div className="flex items-end gap-1" style={{ height: '80px' }}>
              {storyArcLabels.map((label, i) => {
                const heights = [30, 50, 80, 50, 35]; // story mountain shape
                const h = heights[i % heights.length];
                const filled = !!(arcTexts[label] || '').trim();
                return (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-lg border transition-all ${filled ? ARC_COLORS[i % ARC_COLORS.length] : 'bg-slate-700/20 border-slate-600/30'}`}
                      style={{ height: `${h}px` }}
                    />
                    <p className="text-[10px] text-slate-500 text-center">{label}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Finish
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Story Plan Complete!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StoryPlanner;
