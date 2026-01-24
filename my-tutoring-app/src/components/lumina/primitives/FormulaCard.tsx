'use client';

import React, { useState, useEffect, useRef } from 'react';
import { EquationData } from '../types';
import {
  usePrimitiveEvaluation,
  type FormulaCardMetrics,
  type PrimitiveEvaluationResult,
} from '../evaluation';

interface ComprehensionGate {
  question: string;
  questionType: 'parameter-unit' | 'relationship' | 'application' | 'example';
  correctAnswer: string;
  options: string[];
  hint?: string;
}

interface FormulaCardData extends EquationData {
  comprehensionGates?: ComprehensionGate[];
  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

interface FormulaCardProps {
  data: FormulaCardData;
}

export const FormulaCard: React.FC<FormulaCardProps> = ({ data }) => {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);

  // Exploration tracking
  const [exploredParameters, setExploredParameters] = useState<Set<string>>(new Set());
  const [explorationStartTime] = useState(Date.now());
  const [hasInteracted, setHasInteracted] = useState(false);

  // Scrolling visibility tracking
  const relationshipsRef = useRef<HTMLDivElement>(null);
  const examplesRef = useRef<HTMLDivElement>(null);
  const [relationshipsViewed, setRelationshipsViewed] = useState(false);
  const [examplesViewed, setExamplesViewed] = useState(false);

  // Gate state
  const [currentGateIndex, setCurrentGateIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [gateSubmitted, setGateSubmitted] = useState(false);
  const [gateResults, setGateResults] = useState<Array<{
    gateIndex: number;
    question: string;
    questionType: 'parameter-unit' | 'relationship' | 'application' | 'example';
    correctAnswer: string;
    studentAnswer: string;
    isCorrect: boolean;
    attemptNumber: number;
    timeToAnswer: number;
  }>>([]);
  const [gateAttemptStartTime, setGateAttemptStartTime] = useState<number | null>(null);
  const [gateAttemptCounts, setGateAttemptCounts] = useState<Record<number, number>>({});

  const segments = data.segments || [];
  const parameters = data.parameters || [];
  const relationships = data.relationships || [];
  const examples = data.examples || [];
  const gates = data.comprehensionGates || [];

  // Get highlighted parameters
  const highlightedParams = parameters.filter(p => p.isHighlighted);

  // Evaluation integration
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<FormulaCardMetrics>({
    primitiveType: 'formula-card',
    instanceId: instanceId || `formula-card-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const hasGates = gates.length > 0;
  const currentGate = gates[currentGateIndex];

  // Gate triggering logic: show first gate after 3+ parameters explored OR 30+ seconds
  const shouldShowFirstGate = hasGates && !hasSubmittedEvaluation && hasInteracted &&
    (exploredParameters.size >= Math.min(3, parameters.length) ||
     (Date.now() - explorationStartTime > 30000));
  const canShowGate = shouldShowFirstGate && currentGateIndex < gates.length;

  // Intersection Observer for section visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (entry.target === relationshipsRef.current) {
              setRelationshipsViewed(true);
            } else if (entry.target === examplesRef.current) {
              setExamplesViewed(true);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    if (relationshipsRef.current) observer.observe(relationshipsRef.current);
    if (examplesRef.current) observer.observe(examplesRef.current);

    return () => observer.disconnect();
  }, []);

  // Start gate timer on first interaction
  useEffect(() => {
    if (hasInteracted && !gateAttemptStartTime) {
      setGateAttemptStartTime(Date.now());
    }
  }, [hasInteracted, gateAttemptStartTime]);

  const handleParameterClick = (symbol: string) => {
    setSelectedParameter(selectedParameter === symbol ? null : symbol);

    if (!exploredParameters.has(symbol)) {
      setExploredParameters(new Set(exploredParameters).add(symbol));
      setHasInteracted(true);
    }
  };

  const handleGateAnswer = (answer: string) => {
    if (gateSubmitted) return;
    setSelectedAnswer(answer);
  };

  const handleGateSubmit = () => {
    if (selectedAnswer === null || !currentGate) return;

    const isCorrect = selectedAnswer === currentGate.correctAnswer;
    const attemptNumber = (gateAttemptCounts[currentGateIndex] || 0) + 1;
    const timeToAnswer = gateAttemptStartTime ? Date.now() - gateAttemptStartTime : 0;

    // Record this gate result
    const newResult = {
      gateIndex: currentGateIndex,
      question: currentGate.question,
      questionType: currentGate.questionType,
      correctAnswer: currentGate.correctAnswer,
      studentAnswer: selectedAnswer,
      isCorrect,
      attemptNumber,
      timeToAnswer,
    };

    setGateResults([...gateResults, newResult]);
    setGateAttemptCounts({
      ...gateAttemptCounts,
      [currentGateIndex]: attemptNumber,
    });
    setGateSubmitted(true);

    // If correct, advance after a brief moment to show feedback
    if (isCorrect) {
      setTimeout(() => {
        const nextIndex = currentGateIndex + 1;
        setCurrentGateIndex(nextIndex);
        setSelectedAnswer(null);
        setGateSubmitted(false);
        setGateAttemptStartTime(Date.now());

        // Submit evaluation if all gates completed
        if (nextIndex >= gates.length && !hasSubmittedEvaluation) {
          submitEvaluation([...gateResults, newResult]);
        }
      }, 1500);
    }
  };

  const handleRetryGate = () => {
    setSelectedAnswer(null);
    setGateSubmitted(false);
    setGateAttemptStartTime(Date.now());
  };

  const submitEvaluation = (allGateResults: typeof gateResults) => {
    const totalAttempts = allGateResults.length;
    const successfulAttempts = allGateResults.filter(r => r.isCorrect).length;
    const firstAttempts = allGateResults.filter(r => r.attemptNumber === 1);
    const firstAttemptSuccesses = firstAttempts.filter(r => r.isCorrect).length;

    const metrics: FormulaCardMetrics = {
      type: 'formula-card',
      parametersExplored: exploredParameters.size,
      totalParameters: parameters.length,
      relationshipsViewed: relationshipsViewed,
      examplesViewed: examplesViewed,
      totalGates: gates.length,
      gatesCompleted: new Set(allGateResults.filter(r => r.isCorrect).map(r => r.gateIndex)).size,
      gateAttempts: totalAttempts,
      gateResults: allGateResults,
      firstAttemptSuccessRate: firstAttempts.length > 0
        ? (firstAttemptSuccesses / firstAttempts.length) * 100
        : 0,
      overallAccuracy: totalAttempts > 0 ? (successfulAttempts / totalAttempts) * 100 : 0,
      timeSpentExploring: gateAttemptStartTime ? gateAttemptStartTime - explorationStartTime : 0,
      formulaTitle: data.title,
    };

    const allGatesPassed = metrics.gatesCompleted === gates.length;
    const score = metrics.firstAttemptSuccessRate;

    submitResult(allGatesPassed, score, metrics, {
      studentWork: {
        exploredParameters: Array.from(exploredParameters),
        gateResults: allGateResults,
      },
    });
  };

  return (
    <div className="w-full animate-fade-in relative">
      {/* Main Formula Display */}
      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-indigo-500/30 relative overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.1)]">

        {/* Background Grid Decoration */}
        <div className="absolute inset-0 z-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px'
        }}></div>

        {/* Title and Description */}
        <div className="relative z-10 mb-8 text-center">
          <h3 className="text-xl md:text-2xl font-bold text-indigo-300 mb-3">{data.title}</h3>
          <p className="text-slate-300 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">{data.description}</p>
        </div>

        {/* The Formula Display */}
        <div className="relative z-10 flex flex-wrap justify-center items-baseline gap-2 md:gap-4 p-6 md:p-8 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-inner mb-8">
          {segments.length > 0 ? segments.map((segment, index) => (
            <div
              key={index}
              className="relative group"
              onMouseEnter={() => segment.isVariable && setHoveredSegment(segment.meaning || null)}
              onMouseLeave={() => setHoveredSegment(null)}
              onClick={() => segment.isVariable && handleParameterClick(segment.text)}
            >
              <span
                className={`text-4xl md:text-6xl font-serif tracking-wide transition-all duration-300
                ${segment.isVariable
                  ? 'cursor-pointer text-white hover:text-indigo-300 hover:scale-110 inline-block border-b-2 border-dashed border-indigo-500/30 hover:border-indigo-400'
                  : 'text-slate-500'}`}
              >
                {segment.text}
              </span>

              {/* Tooltip for hover */}
              {segment.isVariable && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-max max-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform translate-y-2 group-hover:translate-y-0 z-30">
                  <div className="bg-indigo-600 text-white text-xs font-bold py-2 px-3 rounded-lg shadow-xl relative">
                    {segment.meaning}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-indigo-600"></div>
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="text-slate-500 italic">No formula segments generated.</div>
          )}
        </div>

        {/* Hover Hint */}
        <div className="h-12 relative z-10 w-full flex justify-center items-center mb-8">
          <div className={`transition-all duration-500 transform ${hoveredSegment ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {hoveredSegment && (
              <div className="flex items-center gap-3 bg-indigo-900/40 border border-indigo-500/30 px-6 py-2 rounded-full">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                <span className="text-indigo-200 font-mono text-sm uppercase tracking-wider">{hoveredSegment}</span>
              </div>
            )}
            {!hoveredSegment && !hasSubmittedEvaluation && (
              <span className="text-slate-600 text-sm font-mono animate-pulse">Hover over variables to decode • Click to see details</span>
            )}
          </div>
        </div>

        {/* Key Focus Section - Highlighted Parameters */}
        {highlightedParams.length > 0 && (
          <div className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                <span className="text-amber-400 text-lg">⭐</span>
              </div>
              <h4 className="text-lg font-bold text-amber-300 uppercase tracking-wide">Key Focus</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highlightedParams.map((param, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer"
                  onClick={() => handleParameterClick(param.symbol)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/30 flex items-center justify-center text-amber-200 font-bold text-xl flex-shrink-0">
                      {param.symbol}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-amber-200 mb-1">{param.name}</div>
                      <div className="text-sm text-slate-300 line-clamp-2">{param.description}</div>
                      {param.unit && (
                        <div className="text-xs text-amber-400/70 mt-1 font-mono">Unit: {param.unit}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parameter Cards Grid */}
        <div className="relative z-10 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
              <span className="text-purple-400 text-lg">📊</span>
            </div>
            <h4 className="text-lg font-bold text-purple-300 uppercase tracking-wide">Parameters Explained</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parameters.map((param, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                  selectedParameter === param.symbol
                    ? 'bg-indigo-500/20 border-indigo-400 shadow-lg shadow-indigo-500/20'
                    : param.isHighlighted
                    ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/50'
                }`}
                onClick={() => handleParameterClick(param.symbol)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold flex-shrink-0 ${
                    param.isHighlighted
                      ? 'bg-amber-500/30 text-amber-200 border-2 border-amber-400/50'
                      : 'bg-indigo-500/30 text-indigo-200'
                  }`}>
                    {param.symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white mb-1 flex items-center gap-2">
                      {param.name}
                      {param.isHighlighted && <span className="text-amber-400 text-sm">⭐</span>}
                    </div>
                    {param.unit && (
                      <div className="text-xs text-indigo-400/80 font-mono bg-indigo-500/10 px-2 py-0.5 rounded inline-block">
                        {param.unit}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{param.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Relationships Section */}
        {relationships.length > 0 && (
          <div ref={relationshipsRef} className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <span className="text-emerald-400 text-lg">🔗</span>
              </div>
              <h4 className="text-lg font-bold text-emerald-300 uppercase tracking-wide">How Parameters Relate</h4>
            </div>
            <div className="space-y-3">
              {relationships.map((rel, idx) => (
                <div key={idx} className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      rel.type === 'proportional' ? 'bg-emerald-500/30 text-emerald-200' :
                      rel.type === 'inverse' ? 'bg-rose-500/30 text-rose-200' :
                      'bg-purple-500/30 text-purple-200'
                    }`}>
                      {rel.type || 'relationship'}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed flex-1">{rel.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Real-World Examples */}
        {examples.length > 0 && (
          <div ref={examplesRef} className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <span className="text-cyan-400 text-lg">🌍</span>
              </div>
              <h4 className="text-lg font-bold text-cyan-300 uppercase tracking-wide">Real-World Applications</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {examples.map((example, idx) => (
                <div key={idx} className="p-5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/15 transition-colors">
                  <div className="font-bold text-cyan-200 mb-2 flex items-center gap-2">
                    <span className="text-cyan-400">💡</span>
                    {example.scenario}
                  </div>
                  {example.calculation && (
                    <div className="text-sm font-mono bg-slate-900/50 px-3 py-2 rounded-lg mb-2 text-indigo-300 border border-slate-700">
                      {example.calculation}
                    </div>
                  )}
                  <p className="text-sm text-slate-300 leading-relaxed">{example.result}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Application Context */}
        {data.applicationContext && (
          <div className="relative z-10">
            <div className="p-5 bg-indigo-900/30 border border-indigo-500/30 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-300 text-lg">📚</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wide mb-2">When to Use This Formula</h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{data.applicationContext}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comprehension Gate Overlay */}
      {canShowGate && currentGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel max-w-2xl w-full mx-4 p-8 rounded-2xl border border-indigo-500/30 shadow-2xl">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/30 flex items-center justify-center">
                    <span className="text-indigo-300 text-xl">💭</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-indigo-300">Comprehension Check</h3>
                    <p className="text-xs text-slate-400">Gate {currentGateIndex + 1} of {gates.length}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-mono uppercase tracking-wider">
                  {currentGate.questionType.replace('-', ' ')}
                </div>
              </div>

              <p className="text-white text-base leading-relaxed">{currentGate.question}</p>
            </div>

            <div className="space-y-3 mb-6">
              {currentGate.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleGateAnswer(option)}
                  disabled={gateSubmitted}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                    selectedAnswer === option
                      ? gateSubmitted
                        ? option === currentGate.correctAnswer
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                          : 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-indigo-500/20 border-indigo-400 text-white'
                      : gateSubmitted && option === currentGate.correctAnswer
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-slate-800/50 border-slate-700/50 text-slate-300 hover:border-indigo-500/50 hover:bg-slate-800/80'
                  } ${gateSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedAnswer === option
                        ? gateSubmitted
                          ? option === currentGate.correctAnswer
                            ? 'border-emerald-400 bg-emerald-500/30'
                            : 'border-rose-400 bg-rose-500/30'
                          : 'border-indigo-400 bg-indigo-500/30'
                        : 'border-slate-600'
                    }`}>
                      {selectedAnswer === option && (
                        gateSubmitted ? (
                          option === currentGate.correctAnswer ? '✓' : '✗'
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                        )
                      )}
                    </div>
                    <span className="text-sm">{option}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Feedback */}
            {gateSubmitted && (
              <div className={`p-4 rounded-xl mb-6 ${
                selectedAnswer === currentGate.correctAnswer
                  ? 'bg-emerald-500/10 border border-emerald-500/30'
                  : 'bg-rose-500/10 border border-rose-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">
                    {selectedAnswer === currentGate.correctAnswer ? '🎉' : '💡'}
                  </span>
                  <div className="flex-1">
                    <p className={`font-bold mb-1 ${
                      selectedAnswer === currentGate.correctAnswer ? 'text-emerald-200' : 'text-rose-200'
                    }`}>
                      {selectedAnswer === currentGate.correctAnswer ? 'Correct!' : 'Not quite'}
                    </p>
                    {selectedAnswer !== currentGate.correctAnswer && currentGate.hint && (
                      <p className="text-sm text-slate-300">{currentGate.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!gateSubmitted ? (
                <button
                  onClick={handleGateSubmit}
                  disabled={selectedAnswer === null}
                  className="flex-1 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold transition-colors disabled:cursor-not-allowed"
                >
                  Submit Answer
                </button>
              ) : selectedAnswer !== currentGate.correctAnswer ? (
                <button
                  onClick={handleRetryGate}
                  className="flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors"
                >
                  Try Again
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Completion Message */}
      {hasSubmittedEvaluation && hasGates && (
        <div className="mt-8 p-6 glass-panel rounded-2xl border border-emerald-500/30 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">✓</span>
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-bold text-emerald-300 mb-1">Formula Mastered!</h4>
              <p className="text-sm text-slate-300">
                You've completed all comprehension checks and demonstrated understanding of {data.title}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
