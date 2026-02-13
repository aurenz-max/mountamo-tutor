'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SpellingPatternExplorerMetrics } from '../../../evaluation/types';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export type PatternType = 'short-vowel' | 'long-vowel' | 'r-controlled' | 'suffix-change' | 'latin-root' | 'silent-letter';

export interface SpellingPatternExplorerData {
  title: string;
  gradeLevel: string;
  patternType: PatternType;

  // Phase 1: Word list for observation
  patternWords: string[];               // Words that share the pattern
  highlightPattern: string;             // The pattern to highlight (e.g. "-ight", "silent-e")

  // Phase 2: Rule formulation
  ruleTemplate: string;                 // "When a word ends in silent-e, adding -ing means you ___"
  correctRule: string;                  // Model answer for the rule

  // Phase 3: Dictation practice
  dictationWords: string[];             // Words to spell using the rule
  dictationHints?: string[];            // Optional hints per word

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SpellingPatternExplorerMetrics>) => void;
}

// ============================================================================
// Props
// ============================================================================

interface SpellingPatternExplorerProps {
  data: SpellingPatternExplorerData;
  className?: string;
}

// ============================================================================
// Types
// ============================================================================

type SpellingPhase = 'observe' | 'rule' | 'apply' | 'review';

const PATTERN_COLORS: Record<PatternType, string> = {
  'short-vowel': 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  'long-vowel': 'bg-violet-500/10 border-violet-500/30 text-violet-300',
  'r-controlled': 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  'suffix-change': 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  'latin-root': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  'silent-letter': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',
};

// ============================================================================
// Component
// ============================================================================

const SpellingPatternExplorer: React.FC<SpellingPatternExplorerProps> = ({ data, className }) => {
  const {
    title, gradeLevel, patternType, patternWords, highlightPattern,
    ruleTemplate, correctRule, dictationWords, dictationHints,
    instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit,
  } = data;

  const [currentPhase, setCurrentPhase] = useState<SpellingPhase>('observe');
  const [patternIdentified, setPatternIdentified] = useState(false);
  const [studentRule, setStudentRule] = useState('');
  const [spellings, setSpellings] = useState<string[]>(Array(dictationWords.length).fill(''));
  const [showHints, setShowHints] = useState<Set<number>>(new Set());
  const [revealedWords, setRevealedWords] = useState<Set<number>>(new Set());

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<SpellingPatternExplorerMetrics>({
    primitiveType: 'spelling-pattern-explorer',
    instanceId: instanceId || `spelling-pattern-explorer-${Date.now()}`,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Phase nav
  const phases: SpellingPhase[] = ['observe', 'rule', 'apply', 'review'];
  const phaseLabels: Record<SpellingPhase, string> = { observe: 'Observe', rule: 'Rule', apply: 'Apply', review: 'Review' };

  const nextPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx < phases.length - 1) setCurrentPhase(phases[idx + 1]);
  };
  const prevPhase = () => {
    const idx = phases.indexOf(currentPhase);
    if (idx > 0) setCurrentPhase(phases[idx - 1]);
  };

  // Check spelling
  const checkSpelling = useCallback((index: number) => {
    return spellings[index]?.trim().toLowerCase() === dictationWords[index]?.toLowerCase();
  }, [spellings, dictationWords]);

  // Count correct
  const wordsCorrect = spellings.filter((s, i) => s.trim().toLowerCase() === dictationWords[i]?.toLowerCase()).length;

  // Highlight pattern in word
  const highlightWordPattern = (word: string) => {
    const pattern = highlightPattern.toLowerCase();
    const lowerWord = word.toLowerCase();
    const idx = lowerWord.indexOf(pattern);
    if (idx === -1) return <span className="text-slate-200">{word}</span>;
    return (
      <span className="text-slate-200">
        {word.slice(0, idx)}
        <span className="font-bold text-yellow-300 bg-yellow-400/20 rounded px-0.5">{word.slice(idx, idx + pattern.length)}</span>
        {word.slice(idx + pattern.length)}
      </span>
    );
  };

  // Submit
  const submitFinalEvaluation = useCallback(() => {
    if (hasSubmittedEvaluation) return;

    const ruleOk = studentRule.trim().length > 10;
    const dictationAccuracy = dictationWords.length > 0 ? Math.round((wordsCorrect / dictationWords.length) * 100) : 100;

    // Score: pattern ID (15%) + rule (30%) + dictation (55%)
    const patternScore = patternIdentified ? 15 : 0;
    const ruleScore = ruleOk ? 30 : (studentRule.trim().length > 3 ? 15 : 0);
    const dictScore = Math.round((dictationAccuracy / 100) * 55);
    const score = patternScore + ruleScore + dictScore;

    const metrics: SpellingPatternExplorerMetrics = {
      type: 'spelling-pattern-explorer',
      patternIdentified,
      ruleFormulatedCorrectly: ruleOk,
      wordsSpelledCorrectly: wordsCorrect,
      wordsTotal: dictationWords.length,
      patternType,
      dictationAccuracy,
      attemptsCount: 1,
    };

    submitEvaluation(score >= 50, score, metrics, { studentRule, spellings });
  }, [hasSubmittedEvaluation, patternIdentified, studentRule, wordsCorrect, dictationWords, patternType, submitEvaluation, spellings]);

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

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400 text-xs">Grade {gradeLevel}</Badge>
              <Badge variant="outline" className={`${PATTERN_COLORS[patternType]} text-xs`}>
                {patternType.replace('-', ' ')}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {renderProgress()}

        {/* Phase 1: Observe */}
        {currentPhase === 'observe' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Look at these words. What pattern do they share?</p>
            <div className="flex flex-wrap gap-3">
              {patternWords.map((word, i) => (
                <div key={i} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-lg">
                  {highlightWordPattern(word)}
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <p className="text-xs text-amber-300">Pattern: <span className="font-bold text-yellow-300">{highlightPattern}</span></p>
            </div>
            <Button variant="ghost" onClick={() => { setPatternIdentified(true); nextPhase(); }}
              className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300 w-full">
              I see the pattern! Next: Write the Rule
            </Button>
          </div>
        )}

        {/* Phase 2: Rule */}
        {currentPhase === 'rule' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Complete the spelling rule:</p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-sm text-slate-300 italic">{ruleTemplate}</p>
            </div>
            <textarea
              value={studentRule}
              onChange={e => setStudentRule(e.target.value)}
              placeholder="Write the spelling rule in your own words..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 text-sm focus:outline-none focus:border-blue-500/40 resize-none"
            />
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase} disabled={!studentRule.trim()}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Next: Apply the Rule
              </Button>
            </div>
          </div>
        )}

        {/* Phase 3: Apply (Dictation) */}
        {currentPhase === 'apply' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Spell each word using the pattern rule:</p>
            {dictationWords.map((word, i) => {
              const isCorrect = checkSpelling(i);
              const isRevealed = revealedWords.has(i);
              const hasHint = dictationHints && dictationHints[i];
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-6">{i + 1}.</span>
                  <input
                    value={spellings[i] || ''}
                    onChange={e => {
                      const next = [...spellings];
                      next[i] = e.target.value;
                      setSpellings(next);
                    }}
                    placeholder="Type the word..."
                    disabled={isRevealed}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none ${
                      isRevealed ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : spellings[i] && isCorrect ? 'bg-emerald-500/5 border-emerald-500/20 text-slate-200'
                      : 'bg-white/5 border-white/10 text-slate-200 focus:border-blue-500/40'
                    }`}
                  />
                  {hasHint && !showHints.has(i) && (
                    <button onClick={() => setShowHints(prev => new Set(Array.from(prev).concat(i)))}
                      className="text-xs text-slate-500 hover:text-slate-400">hint</button>
                  )}
                  {showHints.has(i) && hasHint && (
                    <span className="text-xs text-amber-300">{dictationHints![i]}</span>
                  )}
                  {spellings[i] && !isCorrect && (
                    <button onClick={() => setRevealedWords(prev => new Set(Array.from(prev).concat(i)))}
                      className="text-xs text-slate-500 hover:text-slate-400">show</button>
                  )}
                  {isRevealed && (
                    <span className="text-xs text-emerald-300 font-mono">{word}</span>
                  )}
                </div>
              );
            })}
            <div className="flex justify-between">
              <Button variant="ghost" onClick={prevPhase} className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300">Back</Button>
              <Button variant="ghost" onClick={nextPhase}
                disabled={!spellings.some(s => s.trim())}
                className="bg-blue-500/20 border border-blue-500/40 hover:bg-blue-500/30 text-blue-300">
                Review
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            <div className="grid gap-2 grid-cols-3">
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Pattern</p>
                <p className="text-sm font-bold text-yellow-300">{highlightPattern}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Spelling</p>
                <p className="text-sm font-bold text-slate-300">{wordsCorrect}/{dictationWords.length}</p>
              </div>
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center">
                <p className="text-xs text-slate-500">Accuracy</p>
                <p className={`text-sm font-bold ${wordsCorrect >= dictationWords.length * 0.7 ? 'text-emerald-300' : 'text-slate-300'}`}>
                  {dictationWords.length > 0 ? Math.round((wordsCorrect / dictationWords.length) * 100) : 0}%
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-white/5 border border-white/10 p-3">
              <p className="text-xs text-slate-500 mb-1">Your Rule:</p>
              <p className="text-sm text-slate-300">{studentRule}</p>
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
                  <p className="text-emerald-300 font-semibold">Spelling Practice Complete!</p>
                  <p className="text-slate-400 text-sm mt-1">
                    {wordsCorrect}/{dictationWords.length} words correct ({dictationWords.length > 0 ? Math.round((wordsCorrect / dictationWords.length) * 100) : 0}%)
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

export default SpellingPatternExplorer;
