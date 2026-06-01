'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaFeedbackCard,
  type LuminaAccent,
  type AnswerChoiceState,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { TextStructureAnalyzerMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type StructureType = 'cause-effect' | 'compare-contrast' | 'problem-solution' | 'chronological' | 'description';

export interface TextStructureAnalyzerData {
  title: string;
  gradeLevel: string;
  passage: string;
  structureType: StructureType;

  // Signal words embedded in the passage
  signalWords: Array<{
    word: string;
    startIndex: number;       // char offset in passage
    endIndex: number;
  }>;

  // Structure options for Phase 2 (Identify)
  structureOptions: Array<{
    type: StructureType;
    label: string;
    description: string;
  }>;

  // Template mapping for Phase 3 (Map)
  templateRegions: Array<{
    regionId: string;
    label: string;                // e.g. "Cause", "Effect", "Problem", "Solution", "First", "Then", "Finally"
  }>;

  keyIdeas: Array<{
    ideaId: string;
    text: string;
    correctRegionId: string;
  }>;

  // Why the author chose this structure
  authorPurposeExplanation?: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TextStructureAnalyzerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface TextStructureAnalyzerProps {
  data: TextStructureAnalyzerData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

type AnalysisPhase = 'signal-words' | 'identify' | 'map' | 'review';

// Pedagogical color identity per structure type — reused on the template
// regions (the interaction surface) in Phase 3. Kept bespoke (this is the
// painting's color language, not chrome).
const STRUCTURE_COLORS: Record<StructureType, string> = {
  'cause-effect': 'bg-orange-500/20 border-orange-500/40 text-orange-200',
  'compare-contrast': 'bg-blue-500/20 border-blue-500/40 text-blue-200',
  'problem-solution': 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200',
  'chronological': 'bg-amber-500/20 border-amber-500/40 text-amber-200',
  'description': 'bg-violet-500/20 border-violet-500/40 text-violet-200',
};

// Structure type -> kit accent (for the category badge in the header).
const STRUCTURE_ACCENTS: Record<StructureType, LuminaAccent> = {
  'cause-effect': 'orange',
  'compare-contrast': 'blue',
  'problem-solution': 'emerald',
  'chronological': 'amber',
  'description': 'purple',
};

const STRUCTURE_ICONS: Record<StructureType, string> = {
  'cause-effect': 'arrow-right',
  'compare-contrast': 'columns',
  'problem-solution': 'lightbulb',
  'chronological': 'clock',
  'description': 'list',
};

// ============================================================================
// Component
// ============================================================================

const TextStructureAnalyzer: React.FC<TextStructureAnalyzerProps> = ({ data, className }) => {
  const {
    title, gradeLevel, passage, structureType, signalWords, structureOptions,
    templateRegions, keyIdeas, authorPurposeExplanation,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<AnalysisPhase>('signal-words');
  const [highlightedWords, setHighlightedWords] = useState<Set<number>>(new Set()); // indices into signalWords
  const [selectedStructure, setSelectedStructure] = useState<StructureType | null>(null);
  const [ideaMapping, setIdeaMapping] = useState<Record<string, string>>({}); // ideaId -> regionId
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<TextStructureAnalyzerMetrics>({
    primitiveType: 'text-structure-analyzer',
    instanceId: instanceId || `text-structure-analyzer-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase navigation
  const phases: AnalysisPhase[] = ['signal-words', 'identify', 'map', 'review'];
  const phaseLabels: Record<AnalysisPhase, string> = {
    'signal-words': 'Signal Words',
    'identify': 'Identify',
    'map': 'Map',
    'review': 'Review',
  };

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

  // Toggle signal word highlight
  const toggleSignalWord = useCallback((index: number) => {
    setHighlightedWords(prev => {
      const next = new Set(Array.from(prev));
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // Render passage with clickable signal words
  const renderPassageWithSignalWords = useMemo(() => {
    if (signalWords.length === 0) return <p className="text-slate-200 text-sm leading-relaxed">{passage}</p>;

    // Sort signal words by startIndex
    const sorted = [...signalWords].sort((a, b) => a.startIndex - b.startIndex);
    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((sw, i) => {
      // Text before this signal word
      if (sw.startIndex > lastEnd) {
        elements.push(
          <span key={`text-${i}`} className="text-slate-200">
            {passage.slice(lastEnd, sw.startIndex)}
          </span>
        );
      }

      const isHighlighted = highlightedWords.has(i);
      elements.push(
        <span
          key={`sw-${i}`}
          onClick={() => currentPhase === 'signal-words' ? toggleSignalWord(i) : undefined}
          className={`${
            currentPhase === 'signal-words' ? 'cursor-pointer hover:bg-yellow-400/30' : ''
          } ${
            isHighlighted ? 'bg-yellow-400/30 text-yellow-200 underline underline-offset-2' : 'text-slate-200'
          } rounded px-0.5 transition-colors`}
        >
          {passage.slice(sw.startIndex, sw.endIndex)}
        </span>
      );
      lastEnd = sw.endIndex;
    });

    // Remaining text
    if (lastEnd < passage.length) {
      elements.push(<span key="text-end" className="text-slate-200">{passage.slice(lastEnd)}</span>);
    }

    return <p className="text-sm leading-relaxed">{elements}</p>;
  }, [passage, signalWords, highlightedWords, currentPhase, toggleSignalWord]);

  // Map an idea to a region
  const mapIdeaToRegion = useCallback((ideaId: string, regionId: string) => {
    SoundManager.snap();
    setIdeaMapping(prev => ({ ...prev, [ideaId]: regionId }));
  }, []);

  // Calculate mapping accuracy
  const mappingAccuracy = useMemo(() => {
    let correct = 0;
    let total = keyIdeas.length;
    if (total === 0) return 100;
    keyIdeas.forEach(idea => {
      if (ideaMapping[idea.ideaId] === idea.correctRegionId) correct++;
    });
    return Math.round((correct / total) * 100);
  }, [keyIdeas, ideaMapping]);

  // Submit evaluation
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;
    setAttemptsCount(prev => prev + 1);

    const structureCorrect = selectedStructure === structureType;
    const signalWordsFound = highlightedWords.size;
    const signalWordsTotal = signalWords.length;
    const accuracy = mappingAccuracy;

    // Score: structure ID (35%) + signal words (30%) + mapping (35%)
    const structScore = structureCorrect ? 35 : 0;
    const signalScore = signalWordsTotal > 0 ? Math.round((signalWordsFound / signalWordsTotal) * 30) : 30;
    const mapScore = Math.round((accuracy / 100) * 35);
    const score = structScore + signalScore + mapScore;

    const metrics: TextStructureAnalyzerMetrics = {
      type: 'text-structure-analyzer',
      structureIdentifiedCorrectly: structureCorrect,
      signalWordsFound,
      signalWordsTotal,
      templateMappingAccuracy: accuracy,
      structureType,
      attemptsCount: attemptsCount + 1,
    };

    submitEvaluation(score >= 50, score, metrics, {
      highlightedWords: Array.from(highlightedWords),
      selectedStructure,
      ideaMapping,
    });
    setShowFeedback(true);
  }, [
    hasSubmittedEvaluation, selectedStructure, structureType, highlightedWords,
    signalWords, mappingAccuracy, attemptsCount, submitEvaluation, ideaMapping,
  ]);

  // Render progress — phase navigation chrome (no kit equivalent for the
  // labeled multi-phase chip rail; grading-state colors mark completed/active).
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

  // Render template for Phase 3 (Map) — THE PAINTING. The structure-template
  // diagram with drag-to-sort key-idea chips. Color identity per structure
  // type and the in-progress drag tokens stay bespoke.
  const renderTemplate = () => {
    const unmappedIdeas = keyIdeas.filter(idea => !ideaMapping[idea.ideaId]);
    const structureColor = STRUCTURE_COLORS[structureType] || STRUCTURE_COLORS['description'];

    return (
      <div className="space-y-3">
        {/* Unmapped ideas (drag source) */}
        {unmappedIdeas.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Drag key ideas to the correct region:</p>
            <div className="flex flex-wrap gap-1.5">
              {unmappedIdeas.map(idea => (
                <div key={idea.ideaId} className="px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-300 text-xs cursor-grab">
                  {idea.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template regions */}
        <div className={`grid gap-2 ${
          templateRegions.length === 2 ? 'grid-cols-2'
          : templateRegions.length === 3 ? 'grid-cols-3'
          : 'grid-cols-2'
        }`}>
          {templateRegions.map(region => {
            const mappedIdeas = keyIdeas.filter(idea => ideaMapping[idea.ideaId] === region.regionId);
            return (
              <div key={region.regionId} className={`rounded-lg border p-3 min-h-[80px] ${structureColor}`}>
                <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-2">{region.label}</p>
                <div className="space-y-1">
                  {mappedIdeas.map(idea => (
                    <div key={idea.ideaId} className="text-xs bg-black/20 rounded px-2 py-1 flex items-center justify-between gap-1">
                      <span>{idea.text}</span>
                      <button
                        onClick={() => setIdeaMapping(prev => {
                          const next = { ...prev };
                          delete next[idea.ideaId];
                          return next;
                        })}
                        className="text-white/40 hover:text-white/70 text-xs shrink-0"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
                {/* Drop area — click to assign */}
                {unmappedIdeas.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {unmappedIdeas.map(idea => (
                      <button
                        key={idea.ideaId}
                        onClick={() => mapIdeaToRegion(idea.ideaId, region.regionId)}
                        className="w-full text-left text-xs px-2 py-1 rounded bg-white/5 border border-dashed border-white/10 text-slate-500 hover:bg-white/10 hover:text-slate-300 transition-colors"
                      >
                        + {idea.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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
              <LuminaBadge accent={STRUCTURE_ACCENTS[structureType]} className="text-xs">
                {structureType.replace('-', ' ')}
              </LuminaBadge>
            </div>
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Signal Words */}
        {currentPhase === 'signal-words' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Tap the signal words that help you understand how this passage is organized:</p>
            {/* PAINTING: clickable signal-word spans inside the readout panel */}
            <LuminaPanel>
              {renderPassageWithSignalWords}
            </LuminaPanel>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Found: {highlightedWords.size} / {signalWords.length} signal words
              </p>
              <LuminaActionButton action="next" onClick={nextPhase} disabled={highlightedWords.size === 0}>
                Next: Identify Structure
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 2: Identify Structure */}
        {currentPhase === 'identify' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">What organizational structure does this passage use?</p>
            <div className="grid gap-2">
              {structureOptions.map(opt => {
                const isSelected = selectedStructure === opt.type;
                const state: AnswerChoiceState = isSelected ? 'selected' : 'idle';
                return (
                  <LuminaAnswerChoice
                    key={opt.type}
                    state={state}
                    onClick={() => { SoundManager.select(); setSelectedStructure(opt.type); }}
                    className="p-3"
                  >
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{opt.description}</p>
                  </LuminaAnswerChoice>
                );
              })}
            </div>
            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase} disabled={!selectedStructure}>
                Next: Map Ideas
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 3: Map Key Ideas */}
        {currentPhase === 'map' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Place each key idea into the correct part of the {structureType.replace('-', ' ')} template:</p>
            {renderTemplate()}
            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Back</LuminaButton>
              <LuminaActionButton action="next" onClick={nextPhase}
                disabled={Object.keys(ideaMapping).length < keyIdeas.length}>
                Review
              </LuminaActionButton>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="space-y-2">
              <LuminaPanel className="p-3">
                <p className="text-xs text-slate-500 mb-1">Signal Words Found:</p>
                <div className="flex flex-wrap gap-1">
                  {signalWords.map((sw, i) => (
                    <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${
                      highlightedWords.has(i) ? 'bg-yellow-400/20 text-yellow-300' : 'bg-slate-700/40 text-slate-500'
                    }`}>
                      {sw.word}
                    </span>
                  ))}
                </div>
              </LuminaPanel>

              <LuminaPanel className="p-3">
                <p className="text-xs text-slate-500 mb-1">Selected Structure:</p>
                <p className={`text-sm font-medium ${selectedStructure === structureType ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {structureOptions.find(o => o.type === selectedStructure)?.label || 'None selected'}
                </p>
              </LuminaPanel>

              <LuminaPanel className="p-3">
                <p className="text-xs text-slate-500 mb-1">Template Mapping:</p>
                {templateRegions.map(region => {
                  const mapped = keyIdeas.filter(i => ideaMapping[i.ideaId] === region.regionId);
                  return (
                    <div key={region.regionId} className="mt-1">
                      <span className="text-xs font-bold text-slate-400">{region.label}:</span>
                      {mapped.length > 0 ? (
                        mapped.map(i => <span key={i.ideaId} className="text-xs text-slate-300 ml-1">{i.text}</span>)
                      ) : (
                        <span className="text-xs text-slate-600 ml-1">Empty</span>
                      )}
                    </div>
                  );
                })}
              </LuminaPanel>
            </div>

            {/* Submit / Feedback */}
            <div className="flex justify-between">
              <LuminaButton tone="subtle" onClick={prevPhase}>Edit</LuminaButton>
              {!hasSubmittedEvaluation ? (
                <LuminaActionButton action="check" onClick={submitFinalEvaluation}>
                  Submit
                </LuminaActionButton>
              ) : (
                <LuminaFeedbackCard
                  status={selectedStructure === structureType ? 'correct' : 'insight'}
                  label="Analysis Complete!"
                  className="w-full text-center"
                  teachingNote={authorPurposeExplanation || undefined}
                >
                  <span className="text-sm text-slate-400">
                    Structure: {selectedStructure === structureType ? 'Correct' : 'Incorrect'} |
                    Signal Words: {highlightedWords.size}/{signalWords.length} |
                    Mapping: {mappingAccuracy}%
                  </span>
                </LuminaFeedbackCard>
              )}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default TextStructureAnalyzer;
