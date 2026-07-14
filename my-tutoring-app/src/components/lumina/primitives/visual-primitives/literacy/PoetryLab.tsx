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
  LuminaInput,
  accentSoftBg,
  accentSoftBorder,
  accentText,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PoetryLabMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';

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

const PHASE_NEXT_LABELS: Record<AnalysisPhase, string> = {
  mood: 'Next: Mood',
  figurative: 'Next: Find Figurative Language',
  rhyme: 'Next: Rhyme Scheme',
  review: 'Review',
};

// Phases whose data is absent are skipped entirely (RF-2): a K draw
// legitimately has zero figurative instances, and a partial generation must
// degrade to the phases the content actually supports instead of dead-ending
// on an unsatisfiable Next gate.
const computeAnalysisPhases = (d: PoetryLabData): AnalysisPhase[] => {
  const phases: AnalysisPhase[] = [];
  if ((d.moodOptions?.length ?? 0) > 0) phases.push('mood');
  if ((d.figurativeInstances?.length ?? 0) > 0) phases.push('figurative');
  if ((d.rhymeSchemeOptions?.length ?? 0) > 0 && !!d.rhymeScheme) phases.push('rhyme');
  phases.push('review');
  return phases;
};

const REVIEW_GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
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
  const analysisPhases = useMemo(() => computeAnalysisPhases(data), [data]);
  const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>(() => computeAnalysisPhases(data)[0]);
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
  const phaseIndex = analysisPhases.indexOf(analysisPhase);
  const nextAnalysis = () => {
    if (phaseIndex < analysisPhases.length - 1) {
      SoundManager.navigate();
      setAnalysisPhase(analysisPhases[phaseIndex + 1]);
      setElementsExplored(prev => prev + 1);
    }
  };
  const prevAnalysis = () => {
    if (phaseIndex > 0) {
      SoundManager.navigate();
      setAnalysisPhase(analysisPhases[phaseIndex - 1]);
    }
  };

  const nextPhaseLabel = PHASE_NEXT_LABELS[analysisPhases[phaseIndex + 1] ?? 'review'];
  const hasPrevPhase = phaseIndex > 0;

  // Toggle figurative instance
  const toggleFigurative = useCallback((index: number) => {
    setFoundFigurative(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) { next.delete(index); SoundManager.toggle(false); }
      else { next.add(index); SoundManager.toggle(true); }
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

  // Submit analysis evaluation — score only over the phases actually present,
  // so a draw without (say) figurative language isn't penalized for a phase
  // the student never saw.
  const submitAnalysis = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    const hasMood = analysisPhases.includes('mood');
    const hasFig = analysisPhases.includes('figurative');
    const hasRhyme = analysisPhases.includes('rhyme');

    const figTotal = figurativeInstances?.length || 0;
    const figFound = foundFigurative.size;
    const rhymeCorrect = selectedRhymeScheme === rhymeScheme;
    const moodCorrect = selectedMood === correctMood;

    // Base weights: mood 25, figurative 40, rhyme 35 — normalized over present phases
    const moodWeight = hasMood ? 25 : 0;
    const figWeight = hasFig ? 40 : 0;
    const rhymeWeight = hasRhyme ? 35 : 0;
    const totalWeight = moodWeight + figWeight + rhymeWeight;

    const earned =
      (moodCorrect ? moodWeight : 0)
      + (figTotal > 0 ? (figFound / figTotal) * figWeight : 0)
      + (rhymeCorrect ? rhymeWeight : 0);
    const score = totalWeight > 0 ? Math.round((earned / totalWeight) * 100) : 100;

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
  }, [hasSubmittedEvaluation, analysisPhases, figurativeInstances, foundFigurative, selectedRhymeScheme, rhymeScheme, selectedMood, correctMood, elementsExplored, templateType, submitEvaluation]);

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

  const reviewPanelCount = (analysisPhases.includes('mood') ? 1 : 0)
    + (analysisPhases.includes('figurative') ? 1 : 0)
    + (analysisPhases.includes('rhyme') ? 1 : 0);

  const renderAnalysis = () => (
    <div className="space-y-4">
      {renderProgress(analysisPhases, analysisPhase)}

      {/* Poem display — the readable poem surface; clickable spans stay bespoke */}
      <LuminaPanel className="font-serif">
        {analysisPhase === 'figurative' ? renderPoemWithHighlights : (
          (poemLines || []).map((line, i) => <p key={i} className="text-slate-200 text-sm">{line}</p>)
        )}
      </LuminaPanel>

      {/* Phase: Mood */}
      {analysisPhase === 'mood' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What mood or feeling does this poem create?</p>
          <div className="flex flex-wrap gap-2">
            {(moodOptions || []).map(mood => (
              <button key={mood} onClick={() => { SoundManager.select(); setSelectedMood(mood); }}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  selectedMood === mood
                    ? `${accentSoftBg.purple} ${accentSoftBorder.purple} ${accentText.purple}`
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {mood}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={!selectedMood}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Figurative Language */}
      {analysisPhase === 'figurative' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Tap the figurative language in the poem ({figurativeInstances?.length || 0} to find):</p>
          <p className="text-xs text-slate-400">Found: {foundFigurative.size} / {figurativeInstances?.length || 0}</p>
          <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
            {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Back</LuminaButton>}
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={foundFigurative.size === 0}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Rhyme Scheme */}
      {analysisPhase === 'rhyme' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">What is the rhyme scheme of this poem?</p>
          {selectedRhymeScheme && (
            <LuminaPanel className="space-y-1">
              {renderRhymeLines()}
            </LuminaPanel>
          )}
          <div className="flex flex-wrap gap-2">
            {(rhymeSchemeOptions || []).map(scheme => (
              <button key={scheme} onClick={() => setSelectedRhymeScheme(scheme)}
                className={`px-3 py-1.5 rounded-lg text-sm font-mono border transition-all ${
                  selectedRhymeScheme === scheme
                    ? `${accentSoftBg.blue} ${accentSoftBorder.blue} ${accentText.blue}`
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}>
                {scheme}
              </button>
            ))}
          </div>
          <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
            {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Back</LuminaButton>}
            <LuminaButton tone="primary" onClick={nextAnalysis} disabled={!selectedRhymeScheme}>
              {nextPhaseLabel}
            </LuminaButton>
          </div>
        </div>
      )}

      {/* Phase: Review */}
      {analysisPhase === 'review' && (
        <div className="space-y-3">
          {reviewPanelCount > 0 && (
            <div className={`grid gap-2 ${REVIEW_GRID_COLS[reviewPanelCount] || 'grid-cols-3'}`}>
              {analysisPhases.includes('mood') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Mood</p>
                  <p className={`text-sm font-medium ${selectedMood === correctMood ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedMood}</p>
                </LuminaPanel>
              )}
              {analysisPhases.includes('figurative') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Figurative</p>
                  <p className="text-sm font-medium text-slate-300">{foundFigurative.size}/{figurativeInstances?.length || 0}</p>
                </LuminaPanel>
              )}
              {analysisPhases.includes('rhyme') && (
                <LuminaPanel className="p-2 text-center">
                  <p className="text-xs text-slate-500">Rhyme</p>
                  <p className={`text-sm font-mono font-medium ${selectedRhymeScheme === rhymeScheme ? 'text-emerald-300' : 'text-slate-300'}`}>{selectedRhymeScheme}</p>
                </LuminaPanel>
              )}
            </div>
          )}
          {!hasSubmittedEvaluation ? (
            <div className={`flex ${hasPrevPhase ? 'justify-between' : 'justify-end'}`}>
              {hasPrevPhase && <LuminaButton onClick={prevAnalysis}>Edit</LuminaButton>}
              <LuminaActionButton action="check" onClick={submitAnalysis}>Submit</LuminaActionButton>
            </div>
          ) : (
            <LuminaFeedbackCard status="correct" label="Poetry Analysis Complete!">
              Great work breaking down the elements of this poem.
            </LuminaFeedbackCard>
          )}
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

      <LuminaPanel>
        <p className="text-sm text-slate-300">{compositionPrompt}</p>
        {templateConstraints?.syllablesPerLine && (
          <p className="text-xs text-slate-500 mt-1">Syllables per line: {templateConstraints.syllablesPerLine.join('-')}</p>
        )}
        {templateConstraints?.acrosticWord && (
          <p className="text-xs text-slate-500 mt-1">Acrostic word: <span className={`font-bold ${accentText.purple}`}>{templateConstraints.acrosticWord}</span></p>
        )}
      </LuminaPanel>

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
                <LuminaInput
                  value={line}
                  onChange={e => {
                    const next = [...compositionLines];
                    next[i] = e.target.value;
                    setCompositionLines(next);
                  }}
                  placeholder={`Line ${i + 1}${targetSyllables ? ` (${targetSyllables} syllables)` : ''}...`}
                  className="flex-1 text-sm"
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
            <LuminaButton tone="primary" onClick={() => setCompositionPhase('review')}
              disabled={!compositionLines.some(l => l.trim())}>
              Review
            </LuminaButton>
          </div>
        </div>
      )}

      {compositionPhase === 'review' && (
        <div className="space-y-3">
          {/* The composed poem surface — the student's writing artifact stays bespoke */}
          <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-4 font-serif">
            {compositionLines.map((line, i) => (
              <p key={i} className="text-slate-200 text-sm">{line || <span className="italic text-slate-600">Empty line</span>}</p>
            ))}
          </div>
          {!hasSubmittedEvaluation ? (
            <div className="flex justify-between">
              <LuminaButton onClick={() => setCompositionPhase('write')}>Edit</LuminaButton>
              <LuminaActionButton action="check" onClick={submitComposition}>Finish</LuminaActionButton>
            </div>
          ) : (
            <LuminaFeedbackCard status="correct" label="Poem Complete!">
              You wrote and shaped your own poem — nice work bringing it together.
            </LuminaFeedbackCard>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="purple" className="text-xs capitalize">{mode}</LuminaBadge>
              {mode === 'composition' && templateType && (
                <LuminaBadge accent="pink" className="text-xs capitalize">{templateType}</LuminaBadge>
              )}
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {mode === 'analysis' ? renderAnalysis() : renderComposition()}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default PoetryLab;
