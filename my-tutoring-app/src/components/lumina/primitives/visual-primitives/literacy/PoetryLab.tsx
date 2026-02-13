'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PoetryLabMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PoetryMode = 'analysis' | 'composition';
export type TemplateType = 'haiku' | 'limerick' | 'acrostic' | 'free-verse' | 'sonnet-intro';

export interface FigurativeInstance {
  text: string;
  startIndex: number;
  endIndex: number;
  type: string;           // simile, metaphor, personification, etc.
}

export interface PoetryLabData {
  title: string;
  gradeLevel: string;
  mode: PoetryMode;

  // Analysis mode data
  poem?: string;
  poemLines?: string[];                  // Lines of the poem
  correctMood?: string;                  // Expected mood (happy, sad, mysterious, peaceful, etc.)
  moodOptions?: string[];                // 3-4 mood choices
  figurativeInstances?: FigurativeInstance[];
  rhymeScheme?: string;                  // e.g. "AABB", "ABAB", "ABCB"
  rhymeSchemeOptions?: string[];         // 3-4 options

  // Composition mode data
  templateType?: TemplateType;
  compositionPrompt?: string;            // "Write a haiku about..."
  templateConstraints?: {
    lineCount: number;
    syllablesPerLine?: number[];         // e.g. [5, 7, 5] for haiku
    rhymePattern?: string;              // e.g. "AABBA" for limerick
    acrosticWord?: string;              // For acrostic poems
  };

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PoetryLabMetrics>) => void;
}

// ============================================================================
// Props & Types
// ============================================================================

interface PoetryLabProps {
  data: PoetryLabData;
  className?: string;
}

type AnalysisPhase = 'mood' | 'figurative' | 'rhyme' | 'review';
type CompositionPhase = 'write' | 'review';

// ============================================================================
// Constants
// ============================================================================

const RHYME_COLORS: Record<string, string> = {
  A: 'text-blue-300 bg-blue-500/20',
  B: 'text-rose-300 bg-rose-500/20',
  C: 'text-emerald-300 bg-emerald-500/20',
  D: 'text-amber-300 bg-amber-500/20',
};

// ============================================================================
// Component
// ============================================================================

const PoetryLab: React.FC<PoetryLabProps> = ({ data, className }) => {
  const {
    title, gradeLevel, mode, poem, poemLines, correctMood, moodOptions,
    figurativeInstances, rhymeScheme, rhymeSchemeOptions,
    templateType, compositionPrompt, templateConstraints,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  // Analysis state
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('mood');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [foundFigurative, setFoundFigurative] = useState<Set<number>>(new Set());
  const [selectedRhymeScheme, setSelectedRhymeScheme] = useState<string | null>(null);
  const [elementsExplored, setElementsExplored] = useState(0);

  // Composition state
  const [compositionPhase, setCompositionPhase] = useState<CompositionPhase>('write');
  const [compositionLines, setCompositionLines] = useState<string[]>(
    Array(templateConstraints?.lineCount || 3).fill('')
  );

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PoetryLabMetrics>({
    primitiveType: 'poetry-lab',
    instanceId: instanceId || `poetry-lab-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Analysis phase navigation
  const analysisPhases: AnalysisPhase[] = ['mood', 'figurative', 'rhyme', 'review'];
  const nextAnalysis = () => {
    const idx = analysisPhases.indexOf(analysisPhase);
    if (idx < analysisPhases.length - 1) {
      setAnalysisPhase(analysisPhases[idx + 1]);
      setElementsExplored(prev => prev + 1);
    }
  };
  const prevAnalysis = () => {
    const idx = analysisPhases.indexOf(analysisPhase);
    if (idx > 0) setAnalysisPhase(analysisPhases[idx - 1]);
  };

  // Toggle figurative instance
  const toggleFigurative = useCallback((index: number) => {
    setFoundFigurative(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Render poem with clickable figurative instances
  const renderPoemWithHighlights = useMemo(() => {
    if (!poem || !figurativeInstances || figurativeInstances.length === 0) {
      return (poemLines || []).map((line, i) => (
        <p key={i} className="text-slate-200 text-sm">{line}</p>
      ));
    }

    const sorted = [...figurativeInstances].map((inst, origIdx) => ({ ...inst, origIdx }))
      .sort((a, b) => a.startIndex - b.startIndex);
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((inst) => {
      if (inst.startIndex > lastEnd) {
        elements.push(<span key={`t-${inst.origIdx}`} className="text-slate-200">{poem.slice(lastEnd, inst.startIndex)}</span>);
      }
      const isFound = foundFigurative.has(inst.origIdx);
      elements.push(
        <span
          key={`f-${inst.origIdx}`}
          onClick={() => analysisPhase === 'figurative' ? toggleFigurative(inst.origIdx) : undefined}
          className={`rounded px-0.5 transition-colors ${
            analysisPhase === 'figurative' ? 'cursor-pointer hover:bg-violet-400/20' : ''
          } ${isFound ? 'bg-violet-500/20 text-violet-200 underline underline-offset-2' : 'text-slate-200'}`}
        >
          {poem.slice(inst.startIndex, inst.endIndex)}
        </span>
      );
      lastEnd = inst.endIndex;
    });
    if (lastEnd < poem.length) {
      elements.push(<span key="t-end" className="text-slate-200">{poem.slice(lastEnd)}</span>);
    }
    return <p className="text-sm leading-relaxed whitespace-pre-line">{elements}</p>;
  }, [poem, poemLines, figurativeInstances, foundFigurative, analysisPhase, toggleFigurative]);

  // Render rhyme scheme overlay on lines
  const renderRhymeLines = () => {
    if (!poemLines || !selectedRhymeScheme) return null;
    return poemLines.map((line, i) => {
      const letter = selectedRhymeScheme[i] || '';
      const colorClass = RHYME_COLORS[letter] || 'text-slate-500';
      return (
        <div key={i} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${colorClass}`}>{letter}</span>
          <span className="text-slate-200 text-sm">{line}</span>
        </div>
      );
    });
  };

  // Count syllables (rough approximation)
  const countSyllables = (text: string): number => {
    const word = text.toLowerCase().trim();
    if (!word) return 0;
    const words = word.split(/\s+/);
    let total = 0;
    words.forEach(w => {
      const cleaned = w.replace(/[^a-z]/g, '');
      if (!cleaned) return;
      let count = (cleaned.match(/[aeiouy]+/g) || []).length;
      if (cleaned.endsWith('e') && count > 1) count--;
      if (count === 0) count = 1;
      total += count;
    });
    return total;
  };

  // Submit analysis evaluation
  const submitAnalysis = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const figTotal = figurativeInstances?.length || 0;
    const figFound = foundFigurative.size;
    const rhymeCorrect = selectedRhymeScheme === rhymeScheme;
    const moodCorrect = selectedMood === correctMood;

    // Score: mood (25%) + figurative (40%) + rhyme (35%)
    const moodScore = moodCorrect ? 25 : 0;
    const figScore = figTotal > 0 ? Math.round((figFound / figTotal) * 40) : 40;
    const rhymeScore = rhymeCorrect ? 35 : 0;
    const score = moodScore + figScore + rhymeScore;

    const metrics: PoetryLabMetrics = {
      type: 'poetry-lab',
      mode: 'analysis',
      figurativeLanguageIdentified: figFound,
      figurativeLanguageTotal: figTotal,
      rhymeSchemeCorrect: rhymeCorrect,
      syllableCountAccurate: true,
      elementsExplored: elementsExplored + 1,
      poemCompleted: false,
      templateType: templateType || 'free-verse',
    };

    submitEvaluation(score >= 50, score, metrics, { selectedMood, foundFigurative: Array.from(foundFigurative), selectedRhymeScheme });
  }, [hasSubmittedEvaluation, figurativeInstances, foundFigurative, selectedRhymeScheme, rhymeScheme, selectedMood, correctMood, elementsExplored, templateType, submitEvaluation]);

  // Submit composition evaluation
  const submitComposition = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const lines = compositionLines.filter(l => l.trim());
    const poemComplete = lines.length >= (templateConstraints?.lineCount || 1);

    let syllableAccurate = true;
    if (templateConstraints?.syllablesPerLine) {
      syllableAccurate = templateConstraints.syllablesPerLine.every((target, i) => {
        const actual = countSyllables(compositionLines[i] || '');
        return Math.abs(actual - target) <= 1;
      });
    }

    const score = poemComplete ? (syllableAccurate ? 85 : 65) : 30;

    const metrics: PoetryLabMetrics = {
      type: 'poetry-lab',
      mode: 'composition',
      figurativeLanguageIdentified: 0,
      figurativeLanguageTotal: 0,
      rhymeSchemeCorrect: false,
      syllableCountAccurate: syllableAccurate,
      elementsExplored: 0,
      poemCompleted: poemComplete,
      templateType: templateType || 'free-verse',
    };

    submitEvaluation(score >= 50, score, metrics, { compositionLines });
  }, [hasSubmittedEvaluation, compositionLines, templateConstraints, templateType, submitEvaluation]);

  // Render progress
  const renderProgress = (phases: string[], current: string) => (
    <div className="flex items-center gap-2 mb-4">
      {phases.map((phase, i) => {
        const isActive = phase === current;
        const phaseIdx = phases.indexOf(current);
        const isCompleted = i < phaseIdx;
        return (
          <React.Fragment key={phase}>
            {i > 0 && <div className={`h-0.5 w-6 ${isCompleted || isActive ? 'bg-emerald-500/60' : 'bg-slate-600/40'}`} />}
            <div className={`px-2 py-1 rounded text-xs font-medium border capitalize ${
              isCompleted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
              : 'bg-slate-700/20 border-slate-600/30 text-slate-500'
            }`}>
              {phase}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ============================================================================
  // ANALYSIS MODE
  // ============================================================================

  const renderAnalysis = () => (
    <div className="space-y-4">
      {renderProgress(['mood', 'figurative', 'rhyme', 'review'], analysisPhase)}

      {/* Poem display */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 font-serif">
        {analysisPhase === 'figurative' ? renderPoemWithHighlights : (
          (poemLines || []).map((line, i) => <p key={i} className="text-slate-200 text-sm">{line}</p>)
        )}
      </div>

      {/* Phase 1: Mood */}
      {analysisPhase === 'mood' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What mood or feeling does this poem create?</p>
          <div className="flex flex-wrap gap-2">
            {(moodOptions || []).map(mood => (
              <button key={mood} onClick={() => setSelectedMood(mood)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  selectedMood === mood ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {mood}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={nextAnalysis} disabled={!selectedMood}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
              Next: Find Figurative Language
            </Button>
          </div>
        </div>
      )}

      {/* Phase 2: Figurative Language */}
      {analysisPhase === 'figurative' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Tap the figurative language in the poem ({figurativeInstances?.length || 0} to find):</p>
          <p className="text-xs text-slate-400">Found: {foundFigurative.size} / {figurativeInstances?.length || 0}</p>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={prevAnalysis} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
            <Button variant="ghost" onClick={nextAnalysis} disabled={foundFigurative.size === 0}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
              Next: Rhyme Scheme
            </Button>
          </div>
        </div>
      )}

      {/* Phase 3: Rhyme Scheme */}
      {analysisPhase === 'rhyme' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What is the rhyme scheme of this poem?</p>
          {selectedRhymeScheme && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-3 space-y-1">
              {renderRhymeLines()}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {(rhymeSchemeOptions || []).map(scheme => (
              <button key={scheme} onClick={() => setSelectedRhymeScheme(scheme)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${
                  selectedRhymeScheme === scheme ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {scheme}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={prevAnalysis} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
            <Button variant="ghost" onClick={nextAnalysis} disabled={!selectedRhymeScheme}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
              Review
            </Button>
          </div>
        </div>
      )}

      {/* Phase 4: Review */}
      {analysisPhase === 'review' && (
        <div className="space-y-3">
          <div className="grid gap-2 grid-cols-3">
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <p className="text-xs text-slate-500">Mood</p>
              <p className={`text-sm font-medium ${selectedMood === correctMood ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedMood}</p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <p className="text-xs text-slate-500">Figurative</p>
              <p className="text-sm font-medium text-slate-300">{foundFigurative.size}/{figurativeInstances?.length || 0}</p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <p className="text-xs text-slate-500">Rhyme</p>
              <p className={`text-sm font-mono font-medium ${selectedRhymeScheme === rhymeScheme ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedRhymeScheme}</p>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={prevAnalysis} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
            {!hasSubmittedEvaluation ? (
              <Button variant="ghost" onClick={submitAnalysis} className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">Submit</Button>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                <p className="text-emerald-300 font-semibold">Poetry Analysis Complete!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // COMPOSITION MODE
  // ============================================================================

  const renderComposition = () => (
    <div className="space-y-4">
      {renderProgress(['write', 'review'], compositionPhase)}

      <div className="rounded-lg bg-white/5 border border-white/10 p-3">
        <p className="text-sm text-slate-300">{compositionPrompt}</p>
        {templateConstraints?.syllablesPerLine && (
          <p className="text-xs text-slate-500 mt-1">Syllables per line: {templateConstraints.syllablesPerLine.join('-')}</p>
        )}
        {templateConstraints?.acrosticWord && (
          <p className="text-xs text-slate-500 mt-1">Acrostic word: <span className="font-bold text-violet-300">{templateConstraints.acrosticWord}</span></p>
        )}
      </div>

      {compositionPhase === 'write' && (
        <div className="space-y-2">
          {compositionLines.map((line, i) => {
            const syllables = countSyllables(line);
            const targetSyllables = templateConstraints?.syllablesPerLine?.[i];
            const acrosticLetter = templateConstraints?.acrosticWord?.[i];
            return (
              <div key={i} className="flex items-center gap-2">
                {acrosticLetter && (
                  <span className="w-6 h-6 rounded bg-violet-500/20 text-violet-300 text-sm font-bold flex items-center justify-center">{acrosticLetter}</span>
                )}
                <input
                  value={line}
                  onChange={e => {
                    const next = [...compositionLines];
                    next[i] = e.target.value;
                    setCompositionLines(next);
                  }}
                  placeholder={`Line ${i + 1}${targetSyllables ? ` (${targetSyllables} syllables)` : ''}...`}
                  className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40"
                />
                {targetSyllables !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    Math.abs(syllables - targetSyllables) <= 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {syllables}/{targetSyllables}
                  </span>
                )}
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setCompositionPhase('review')}
              disabled={!compositionLines.some(l => l.trim())}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
              Review
            </Button>
          </div>
        </div>
      )}

      {compositionPhase === 'review' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-4 font-serif">
            {compositionLines.map((line, i) => (
              <p key={i} className="text-slate-200 text-sm">{line || <span className="italic text-slate-600">Empty line</span>}</p>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setCompositionPhase('write')} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Edit</Button>
            {!hasSubmittedEvaluation ? (
              <Button variant="ghost" onClick={submitComposition} className="bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-emerald-300">Finish</Button>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center w-full">
                <p className="text-emerald-300 font-semibold">Poem Complete!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

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
              <Badge variant="outline" className="bg-violet-500/10 border-violet-500/30 text-violet-300 text-xs capitalize">{mode}</Badge>
              {templateType && (
                <Badge variant="outline" className="bg-pink-500/10 border-pink-500/30 text-pink-300 text-xs capitalize">{templateType}</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {mode === 'analysis' ? renderAnalysis() : renderComposition()}
      </CardContent>
    </Card>
  );
};

export default PoetryLab;
