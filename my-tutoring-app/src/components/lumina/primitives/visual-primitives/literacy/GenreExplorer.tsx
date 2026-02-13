'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { GenreExplorerMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface GenreFeature {
  featureId: string;
  label: string;                    // "Has characters", "Has a moral", "Has facts", etc.
  present: boolean;                 // Whether this feature is in the excerpt
}

export interface GenreExcerpt {
  excerptId: string;
  text: string;
  genre: string;                    // Correct genre classification
  features: GenreFeature[];
}

export interface GenreExplorerData {
  title: string;
  gradeLevel: string;
  excerpts: GenreExcerpt[];         // 1-2 excerpts
  genreOptions: string[];           // Available genre choices
  comparisonEnabled: boolean;       // Whether side-by-side comparison is available

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<GenreExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface GenreExplorerProps {
  data: GenreExplorerData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type ExplorerPhase = 'read' | 'features' | 'classify' | 'review';

// ============================================================================
// Component
// ============================================================================

const GenreExplorer: React.FC<GenreExplorerProps> = ({ data, className }) => {
  const {
    title, gradeLevel, excerpts, genreOptions, comparisonEnabled,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<ExplorerPhase>('read');
  const [activeExcerptIdx, setActiveExcerptIdx] = useState(0);
  const [checkedFeatures, setCheckedFeatures] = useState<Record<string, Set<string>>>({}); // excerptId -> set of featureIds
  const [selectedGenres, setSelectedGenres] = useState<Record<string, string>>({}); // excerptId -> genre
  const [comparisonMade, setComparisonMade] = useState(false);

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<GenreExplorerMetrics>({
    primitiveType: 'genre-explorer',
    instanceId: instanceId || `genre-explorer-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase nav
  const phases: ExplorerPhase[] = ['read', 'features', 'classify', 'review'];
  const phaseLabels: Record<ExplorerPhase, string> = { read: 'Read', features: 'Features', classify: 'Classify', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Toggle feature
  const toggleFeature = useCallback((excerptId: string, featureId: string) => {
    setCheckedFeatures(prev => {
      const current = new Set(Array.from(prev[excerptId] || []));
      if (current.has(featureId)) current.delete(featureId);
      else current.add(featureId);
      return { ...prev, [excerptId]: current };
    });
  }, []);

  // Calculate metrics
  const calculateMetrics = useCallback(() => {
    let genresCorrect = 0;
    let genresTotal = excerpts.length;
    let featuresCorrect = 0;
    let featuresTotal = 0;

    excerpts.forEach(excerpt => {
      if (selectedGenres[excerpt.excerptId] === excerpt.genre) genresCorrect++;

      const checked = checkedFeatures[excerpt.excerptId] || new Set();
      excerpt.features.forEach(f => {
        featuresTotal++;
        const studentChecked = checked.has(f.featureId);
        if (studentChecked === f.present) featuresCorrect++;
      });
    });

    return { genresCorrect, genresTotal, featuresCorrect, featuresTotal };
  }, [excerpts, selectedGenres, checkedFeatures]);

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const m = calculateMetrics();

    // Score: genre ID (40%) + features (40%) + comparison (20%)
    const genreScore = m.genresTotal > 0 ? Math.round((m.genresCorrect / m.genresTotal) * 40) : 40;
    const featScore = m.featuresTotal > 0 ? Math.round((m.featuresCorrect / m.featuresTotal) * 40) : 40;
    const compScore = comparisonEnabled && comparisonMade ? 20 : comparisonEnabled ? 0 : 20;
    const score = genreScore + featScore + compScore;

    const metrics: GenreExplorerMetrics = {
      type: 'genre-explorer',
      genresIdentifiedCorrectly: m.genresCorrect,
      genresTotal: m.genresTotal,
      featuresCheckedCorrectly: m.featuresCorrect,
      featuresTotal: m.featuresTotal,
      comparisonMade,
      attemptsCount: 1,
    };

    submitEvaluation(score >= 50, score, metrics, { selectedGenres, checkedFeatures: Object.fromEntries(
      Object.entries(checkedFeatures).map(([k, v]) => [k, Array.from(v)])
    )});
  }, [hasSubmittedEvaluation, calculateMetrics, comparisonEnabled, comparisonMade, selectedGenres, checkedFeatures, submitEvaluation]);

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

  const activeExcerpt = excerpts[activeExcerptIdx];

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-xs">{excerpts.length} Excerpt{excerpts.length > 1 ? 's' : ''}</Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Excerpt tabs (if multiple) */}
        {excerpts.length > 1 && (
          <div className="flex gap-2">
            {excerpts.map((ex, i) => (
              <button key={ex.excerptId} onClick={() => setActiveExcerptIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  i === activeExcerptIdx ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                Excerpt {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Phase 1: Read */}
        {currentPhase === 'read' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Read the excerpt carefully:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">{activeExcerpt?.text}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={nextPhase}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Check Features
              </Button>
            </div>
          </div>
        )}

        {/* Phase 2: Features Checklist */}
        {currentPhase === 'features' && activeExcerpt && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Which features does this excerpt have?</p>
            <div className="space-y-1.5">
              {activeExcerpt.features.map(feature => {
                const isChecked = (checkedFeatures[activeExcerpt.excerptId] || new Set()).has(feature.featureId);
                return (
                  <button key={feature.featureId}
                    onClick={() => toggleFeature(activeExcerpt.excerptId, feature.featureId)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                      isChecked ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}>
                    <span className="mr-2">{isChecked ? '✓' : '○'}</span>
                    {feature.label}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Classify Genre
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Classify */}
        {currentPhase === 'classify' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">What genre is this excerpt?</p>
            <div className="grid gap-2 grid-cols-2">
              {genreOptions.map(genre => {
                const isSelected = selectedGenres[activeExcerpt?.excerptId || ''] === genre;
                return (
                  <button key={genre}
                    onClick={() => activeExcerpt && setSelectedGenres(prev => ({ ...prev, [activeExcerpt.excerptId]: genre }))}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all capitalize ${
                      isSelected ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                    }`}>
                    {genre}
                  </button>
                );
              })}
            </div>

            {comparisonEnabled && excerpts.length > 1 && (
              <Button variant="ghost" onClick={() => setComparisonMade(true)}
                className="bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 text-xs w-full">
                Compare Excerpts Side by Side
              </Button>
            )}

            {comparisonMade && excerpts.length > 1 && (
              <div className="grid grid-cols-2 gap-2">
                {excerpts.map((ex, i) => (
                  <div key={ex.excerptId} className="rounded-lg bg-white/5 border border-white/10 p-2">
                    <p className="text-xs font-bold text-slate-400 mb-1">Excerpt {i + 1}</p>
                    <p className="text-xs text-slate-300 line-clamp-4">{ex.text}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                disabled={!excerpts.every(ex => selectedGenres[ex.excerptId])}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {excerpts.map((ex, i) => {
              const isCorrect = selectedGenres[ex.excerptId] === ex.genre;
              return (
                <div key={ex.excerptId} className="rounded-lg bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-slate-400">Excerpt {i + 1}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${
                      isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'
                    }`}>
                      {selectedGenres[ex.excerptId] || 'None'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{ex.text}</p>
                </div>
              );
            })}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
              {!hasSubmittedEvaluation ? (
                <Button variant="ghost" onClick={submitFinalEvaluation}
                  className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">
                  Submit
                </Button>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                  <p className="text-emerald-300 font-semibold">Genre Analysis Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {excerpts.filter(ex => selectedGenres[ex.excerptId] === ex.genre).length}/{excerpts.length} genres correct
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

export default GenreExplorer;
