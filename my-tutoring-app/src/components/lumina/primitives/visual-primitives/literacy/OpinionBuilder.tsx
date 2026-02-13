'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { OpinionBuilderMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface OpinionBuilderData {
  title: string;
  gradeLevel: string;
  framework: 'oreo' | 'cer';
  prompt: string;                              // The opinion/argument prompt

  // Scaffold structure
  scaffold: {
    claimLabel: string;                        // "Opinion" for OREO, "Claim" for CER
    claimStarters: string[];                   // Sentence frames for the claim
    reasonLabel: string;                       // "Reasons" for OREO, "Evidence" for CER
    reasonStarters: string[];                  // Sentence frames for reasons
    reasonCount: number;                       // How many reasons required (2-3)
    conclusionLabel: string;                   // "Restate Opinion" or "Conclusion"
    conclusionStarters: string[];
    linkingWords: string[];                    // because, therefore, for instance, etc.
    counterArgumentEnabled: boolean;           // Grades 5-6 only
    counterArgumentStarters?: string[];
  };

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<OpinionBuilderMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface OpinionBuilderProps {
  data: OpinionBuilderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type BuildPhase = 'claim' | 'reasons' | 'counter' | 'conclusion' | 'review';

const OREO_COLORS: Record<string, string> = {
  claim: 'bg-amber-900/30 border-amber-700/40 text-amber-200',
  reason: 'bg-orange-500/20 border-orange-500/40 text-orange-200',
  counter: 'bg-rose-500/20 border-rose-500/40 text-rose-200',
  conclusion: 'bg-amber-900/30 border-amber-700/40 text-amber-200',
};

// ============================================================================
// Component
// ============================================================================

const OpinionBuilder: React.FC<OpinionBuilderProps> = ({ data, className }) => {
  const {
    title, gradeLevel, framework, prompt, scaffold,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<BuildPhase>('claim');
  const [claimText, setClaimText] = useState('');
  const [reasonTexts, setReasonTexts] = useState<string[]>(Array(scaffold.reasonCount).fill(''));
  const [counterText, setCounterText] = useState('');
  const [conclusionText, setConclusionText] = useState('');
  const [usedStarters, setUsedStarters] = useState<Set<string>>(new Set());
  const [usedLinkingWords, setUsedLinkingWords] = useState<Set<string>>(new Set());

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<OpinionBuilderMetrics>({
    primitiveType: 'opinion-builder',
    instanceId: instanceId || `opinion-builder-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Insert a starter into the active field
  const handleUseStarter = useCallback((starter: string, field: 'claim' | 'reason' | 'counter' | 'conclusion', reasonIndex?: number) => {
    setUsedStarters(prev => new Set(Array.from(prev).concat(starter)));
    if (field === 'claim') setClaimText(prev => prev ? prev : starter + ' ');
    else if (field === 'reason' && reasonIndex !== undefined) {
      setReasonTexts(prev => {
        const next = [...prev];
        if (!next[reasonIndex]) next[reasonIndex] = starter + ' ';
        return next;
      });
    }
    else if (field === 'counter') setCounterText(prev => prev ? prev : starter + ' ');
    else if (field === 'conclusion') setConclusionText(prev => prev ? prev : starter + ' ');
  }, []);

  // Track linking words used in text
  const countLinkingWords = useCallback(() => {
    const allText = [claimText, ...reasonTexts, counterText, conclusionText].join(' ').toLowerCase();
    let count = 0;
    const found = new Set<string>();
    scaffold.linkingWords.forEach(word => {
      if (allText.includes(word.toLowerCase())) {
        count++;
        found.add(word);
      }
    });
    setUsedLinkingWords(found);
    return count;
  }, [claimText, reasonTexts, counterText, conclusionText, scaffold.linkingWords]);

  // Phase navigation
  const phases: BuildPhase[] = scaffold.counterArgumentEnabled
    ? ['claim', 'reasons', 'counter', 'conclusion', 'review']
    : ['claim', 'reasons', 'conclusion', 'review'];

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Submit evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const linkingCount = countLinkingWords();
    const reasonsFilled = reasonTexts.filter(r => r.trim().length > 5).length;
    const structureComplete = !!claimText.trim() && reasonsFilled >= 1 && !!conclusionText.trim();
    const evidenceForEach = reasonsFilled >= scaffold.reasonCount;

    // Score: structure (40%) + reasons (30%) + linking words (15%) + conclusion (15%)
    const structScore = structureComplete ? 40 : (claimText.trim() ? 15 : 0) + (reasonsFilled > 0 ? 15 : 0) + (conclusionText.trim() ? 10 : 0);
    const reasonScore = Math.min(30, (reasonsFilled / scaffold.reasonCount) * 30);
    const linkScore = Math.min(15, linkingCount * 5);
    const concScore = conclusionText.trim().length > 10 ? 15 : conclusionText.trim() ? 8 : 0;
    const score = Math.round(structScore + reasonScore + linkScore + concScore);

    const metrics: OpinionBuilderMetrics = {
      type: 'opinion-builder',
      framework,
      gradeLevel,
      claimPresent: !!claimText.trim(),
      reasonsProvided: reasonsFilled,
      evidenceForEachReason: evidenceForEach,
      counterArgumentPresent: scaffold.counterArgumentEnabled && !!counterText.trim(),
      linkingWordsUsed: linkingCount,
      structureComplete,
      startersUsed: usedStarters.size,
      startersAvailable: scaffold.claimStarters.length + scaffold.reasonStarters.length + scaffold.conclusionStarters.length,
    };

    submitEvaluation(score >= 50, score, metrics, {
      claimText, reasonTexts, counterText, conclusionText,
    });
  }, [
    hasSubmittedEvaluation, countLinkingWords, claimText, reasonTexts,
    counterText, conclusionText, scaffold, framework, gradeLevel,
    usedStarters, submitEvaluation,
  ]);

  // Render sentence starters as chips
  const renderStarters = (starters: string[], field: 'claim' | 'reason' | 'counter' | 'conclusion', reasonIndex?: number) => (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {starters.map((s, i) => (
        <button
          key={i}
          onClick={() => handleUseStarter(s, field, reasonIndex)}
          className="px-2 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-300 transition-all"
        >
          {s}...
        </button>
      ))}
    </div>
  );

  // Render linking words palette
  const renderLinkingWords = () => (
    <div className="flex flex-wrap gap-1 mt-2">
      <span className="text-xs text-slate-600 mr-1">Linking words:</span>
      {scaffold.linkingWords.map((w, i) => (
        <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${usedLinkingWords.has(w) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
          {w}
        </span>
      ))}
    </div>
  );

  // Phase progress
  const renderProgress = () => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === currentPhase;
        const phaseIdx = phases.indexOf(currentPhase);
        const isCompleted = i < phaseIdx;
        const labels: Record<string, string> = { claim: scaffold.claimLabel, reasons: scaffold.reasonLabel, counter: 'Counter', conclusion: scaffold.conclusionLabel, review: 'Review' };
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border ${isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-slate-700/20 border-slate-600/30 text-slate-500'}`}>
              {labels[phase] || phase}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // Visual argument stack (OREO/CER visualization)
  const renderArgumentStack = () => {
    const layers = [
      { key: 'claim', label: scaffold.claimLabel, text: claimText, style: OREO_COLORS.claim },
      ...reasonTexts.map((r, i) => ({ key: `reason-${i}`, label: `${scaffold.reasonLabel} ${i + 1}`, text: r, style: OREO_COLORS.reason })),
      ...(scaffold.counterArgumentEnabled ? [{ key: 'counter', label: 'Counter-Argument', text: counterText, style: OREO_COLORS.counter }] : []),
      { key: 'conclusion', label: scaffold.conclusionLabel, text: conclusionText, style: OREO_COLORS.conclusion },
    ];
    return (
      <div className="space-y-1.5">
        {layers.map(layer => (
          <div key={layer.key} className={`rounded-lg border px-3 py-2 ${layer.style}`}>
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">{layer.label}</p>
            <p className="text-sm mt-0.5">{layer.text || <span className="italic opacity-40">Not yet written</span>}</p>
          </div>
        ))}
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300 text-xs uppercase">{framework}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Prompt */}
        <div className="rounded-lg bg-white/5 border border-white/10 p-3">
          <p className="text-xs text-slate-500 mb-1">Writing Prompt:</p>
          <p className="text-slate-200 text-sm font-medium">{prompt}</p>
        </div>

        {/* Claim Phase */}
        {currentPhase === 'claim' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">{scaffold.claimLabel}:</p>
              <textarea
                value={claimText}
                onChange={e => setClaimText(e.target.value)}
                placeholder={`State your ${framework === 'oreo' ? 'opinion' : 'claim'}...`}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
              />
              {renderStarters(scaffold.claimStarters, 'claim')}
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase} disabled={!claimText.trim()} className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: {scaffold.reasonLabel}
              </Button>
            </div>
          </div>
        )}

        {/* Reasons Phase */}
        {currentPhase === 'reasons' && (
          <div className="space-y-3">
            {reasonTexts.map((text, i) => (
              <div key={i}>
                <p className="text-xs text-slate-500 mb-1">{scaffold.reasonLabel} {i + 1}:</p>
                <textarea
                  value={text}
                  onChange={e => {
                    const next = [...reasonTexts];
                    next[i] = e.target.value;
                    setReasonTexts(next);
                  }}
                  placeholder={`${framework === 'oreo' ? 'Give a reason' : 'Provide evidence'}...`}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                />
                {renderStarters(scaffold.reasonStarters, 'reason', i)}
              </div>
            ))}
            {renderLinkingWords()}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={!reasonTexts.some(r => r.trim())} className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Counter-Argument Phase */}
        {currentPhase === 'counter' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Counter-Argument (optional):</p>
              <textarea
                value={counterText}
                onChange={e => setCounterText(e.target.value)}
                placeholder="Some people might say... However, I believe..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
              />
              {scaffold.counterArgumentStarters && renderStarters(scaffold.counterArgumentStarters, 'counter')}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">Next</Button>
            </div>
          </div>
        )}

        {/* Conclusion Phase */}
        {currentPhase === 'conclusion' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">{scaffold.conclusionLabel}:</p>
              <textarea
                value={conclusionText}
                onChange={e => setConclusionText(e.target.value)}
                placeholder="Restate your opinion/claim in a new way..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
              />
              {renderStarters(scaffold.conclusionStarters, 'conclusion')}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={!conclusionText.trim()} className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">Review</Button>
            </div>
          </div>
        )}

        {/* Review Phase */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {renderArgumentStack()}
            {renderLinkingWords()}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation} className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">Finish</Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Argument Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {reasonTexts.filter(r => r.trim()).length} reasons with {countLinkingWords()} linking words.
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

export default OpinionBuilder;
