'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { FigurativeLanguageFinderMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type FigurativeType = 'simile' | 'metaphor' | 'personification' | 'hyperbole' | 'idiom' | 'alliteration' | 'onomatopoeia' | 'imagery';

export interface FigurativeInstance {
  instanceId: string;
  text: string;                      // The figurative phrase as it appears
  startIndex: number;                // Character offset in passage
  endIndex: number;
  type: FigurativeType;
  literalMeaning: string;            // What it literally means
  explanation: string;               // Why it's this type
}

export interface FigurativeLanguageFinderData {
  title: string;
  gradeLevel: string;
  passage: string;
  instances: FigurativeInstance[];

  // Which instances require literal translation (Phase 3)
  translateInstanceIds: string[];     // 2-3 instance IDs students must translate

  // Available types for classification
  availableTypes: FigurativeType[];

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<FigurativeLanguageFinderMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface FigurativeLanguageFinderProps {
  data: FigurativeLanguageFinderData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type FinderPhase = 'find' | 'classify' | 'interpret' | 'review';

const TYPE_COLORS: Record<FigurativeType, string> = {
  simile: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
  metaphor: 'bg-violet-500/20 border-violet-500/40 text-violet-300',
  personification: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
  hyperbole: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
  idiom: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  alliteration: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
  onomatopoeia: 'bg-orange-500/20 border-orange-500/40 text-orange-300',
  imagery: 'bg-pink-500/20 border-pink-500/40 text-pink-300',
};

const TYPE_LABELS: Record<FigurativeType, string> = {
  simile: 'Simile',
  metaphor: 'Metaphor',
  personification: 'Personification',
  hyperbole: 'Hyperbole',
  idiom: 'Idiom',
  alliteration: 'Alliteration',
  onomatopoeia: 'Onomatopoeia',
  imagery: 'Imagery',
};

// ============================================================================
// Component
// ============================================================================

const FigurativeLanguageFinder: React.FC<FigurativeLanguageFinderProps> = ({ data, className }) => {
  const {
    title, gradeLevel, passage, instances, translateInstanceIds, availableTypes,
    instanceId: evalInstanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<FinderPhase>('find');
  const [foundInstances, setFoundInstances] = useState<Set<number>>(new Set()); // indices into instances[]
  const [classifications, setClassifications] = useState<Record<number, FigurativeType>>({}); // instance index -> type
  const [translations, setTranslations] = useState<Record<string, string>>({}); // instanceId -> student translation

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<FigurativeLanguageFinderMetrics>({
    primitiveType: 'figurative-language-finder',
    instanceId: evalInstanceId || `figurative-language-finder-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase navigation
  const phases: FinderPhase[] = ['find', 'classify', 'interpret', 'review'];
  const phaseLabels: Record<FinderPhase, string> = { find: 'Find', classify: 'Classify', interpret: 'Interpret', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Toggle instance found
  const toggleInstance = useCallback((index: number) => {
    setFoundInstances(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Render passage with clickable figurative instances
  const renderPassage = useMemo(() => {
    if (instances.length === 0) return <p className="text-slate-200 text-sm leading-relaxed">{passage}</p>;

    const sorted = [...instances].map((inst, origIdx) => ({ ...inst, origIdx })).sort((a, b) => a.startIndex - b.startIndex);
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((inst) => {
      if (inst.startIndex > lastEnd) {
        elements.push(<span key={`t-${inst.origIdx}`} className="text-slate-200">{passage.slice(lastEnd, inst.startIndex)}</span>);
      }

      const isFound = foundInstances.has(inst.origIdx);
      const classification = classifications[inst.origIdx];
      const typeColor = classification ? TYPE_COLORS[classification] : '';

      elements.push(
        <span
          key={`i-${inst.origIdx}`}
          onClick={() => currentPhase === 'find' ? toggleInstance(inst.origIdx) : undefined}
          className={`rounded px-0.5 transition-colors ${
            currentPhase === 'find' ? 'cursor-pointer hover:bg-yellow-400/20' : ''
          } ${
            isFound
              ? classification
                ? typeColor
                : 'bg-yellow-400/20 text-yellow-200 underline underline-offset-2'
              : 'text-slate-200'
          }`}
        >
          {passage.slice(inst.startIndex, inst.endIndex)}
        </span>
      );
      lastEnd = inst.endIndex;
    });

    if (lastEnd < passage.length) {
      elements.push(<span key="t-end" className="text-slate-200">{passage.slice(lastEnd)}</span>);
    }

    return <p className="text-sm leading-relaxed">{elements}</p>;
  }, [passage, instances, foundInstances, classifications, currentPhase, toggleInstance]);

  // Classify an instance
  const classifyInstance = useCallback((index: number, type: FigurativeType) => {
    setClassifications(prev => ({ ...prev, [index]: type }));
  }, []);

  // Calculate score
  const calculateScore = useCallback(() => {
    const instancesTotal = instances.length;
    const instancesFound = foundInstances.size;
    let classificationsCorrect = 0;
    let classificationsTotal = 0;

    foundInstances.forEach(idx => {
      if (classifications[idx]) {
        classificationsTotal++;
        if (classifications[idx] === instances[idx].type) classificationsCorrect++;
      }
    });

    // Translation accuracy (simplified — check if they wrote something substantial)
    let translationScore = 0;
    const translateIds = translateInstanceIds.filter(id => instances.find(i => i.instanceId === id));
    if (translateIds.length > 0) {
      const filled = translateIds.filter(id => (translations[id] || '').trim().length > 10).length;
      translationScore = Math.round((filled / translateIds.length) * 100);
    }

    const typesEncountered = Array.from(new Set(instances.map(i => i.type)));

    // Score: finding (30%) + classification (40%) + translation (30%)
    const findScore = instancesTotal > 0 ? Math.round((instancesFound / instancesTotal) * 30) : 30;
    const classScore = classificationsTotal > 0 ? Math.round((classificationsCorrect / classificationsTotal) * 40) : 0;
    const transScore = Math.round((translationScore / 100) * 30);

    return {
      score: findScore + classScore + transScore,
      instancesFound,
      instancesTotal,
      classificationsCorrect,
      classificationsTotal,
      literalTranslationAccuracy: translationScore,
      typesEncountered,
      falsePositives: 0, // Simplified — we only allow clicking real instances
    };
  }, [instances, foundInstances, classifications, translateInstanceIds, translations]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateScore();

    const metrics: FigurativeLanguageFinderMetrics = {
      type: 'figurative-language-finder',
      instancesFound: m.instancesFound,
      instancesTotal: m.instancesTotal,
      classificationsCorrect: m.classificationsCorrect,
      classificationsTotal: m.classificationsTotal,
      literalTranslationAccuracy: m.literalTranslationAccuracy,
      typesEncountered: m.typesEncountered,
      falsePositives: m.falsePositives,
      attemptsCount: 1,
    };

    submitEvaluation(m.score >= 50, m.score, metrics, {
      foundInstances: Array.from(foundInstances),
      classifications,
      translations,
    });
  }, [hasSubmittedEvaluation, calculateScore, submitEvaluation, foundInstances, classifications, translations]);

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

  // Type legend
  const renderTypeLegend = () => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {availableTypes.map(t => (
        <span key={t} className={`text-xs px-1.5 py-0.5 rounded border ${TYPE_COLORS[t]}`}>
          {TYPE_LABELS[t]}
        </span>
      ))}
    </div>
  );

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className="bg-pink-500/10 border-pink-500/30 text-pink-300 text-xs">{instances.length} Instances</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Find */}
        {currentPhase === 'find' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Tap each figurative language phrase you find in the passage:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage}
            </div>
            {renderTypeLegend()}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">Found: {foundInstances.size} / {instances.length}</p>
              <Button variant="ghost" onClick={nextPhase} disabled={foundInstances.size === 0}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Classify
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Classify */}
        {currentPhase === 'classify' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Label each highlighted phrase with its figurative language type:</p>
            <div className="space-y-2">
              {Array.from(foundInstances).sort((a, b) => a - b).map(idx => {
                const inst = instances[idx];
                if (!inst) return null;
                const currentClassification = classifications[idx];
                return (
                  <div key={idx} className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <p className="text-sm text-yellow-200 font-medium mb-2">&ldquo;{inst.text}&rdquo;</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => classifyInstance(idx, t)}
                          className={`px-2 py-1 rounded text-xs border transition-all ${
                            currentClassification === t ? TYPE_COLORS[t] : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          {TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                disabled={Array.from(foundInstances).some(idx => !classifications[idx])}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Interpret
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Interpret */}
        {currentPhase === 'interpret' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Write what these figurative phrases literally mean:</p>
            {translateInstanceIds.map(id => {
              const inst = instances.find(i => i.instanceId === id);
              if (!inst) return null;
              return (
                <div key={id} className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-2">
                  <p className="text-sm text-yellow-200">&ldquo;{inst.text}&rdquo;</p>
                  <p className="text-xs text-slate-500">Type: {TYPE_LABELS[inst.type]}</p>
                  <textarea
                    value={translations[id] || ''}
                    onChange={e => setTranslations(prev => ({ ...prev, [id]: e.target.value }))}
                    placeholder="What does this literally mean?..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
                  />
                </div>
              );
            })}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              {renderPassage}
            </div>

            {/* Classification summary */}
            <div className="space-y-1.5">
              {Array.from(foundInstances).sort((a, b) => a - b).map(idx => {
                const inst = instances[idx];
                if (!inst) return null;
                const classified = classifications[idx];
                const isCorrect = classified === inst.type;
                return (
                  <div key={idx} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                    <span className="text-xs text-slate-300 flex-1">&ldquo;{inst.text}&rdquo;</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${classified ? TYPE_COLORS[classified] : 'bg-slate-700/40 text-slate-500'}`}>
                      {classified ? TYPE_LABELS[classified] : '?'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Submit
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Analysis Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Found: {foundInstances.size}/{instances.length} | Classified: {Object.values(classifications).filter((c, i) => c === instances[Array.from(foundInstances)[i]]?.type).length} correct
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

export default FigurativeLanguageFinder;
