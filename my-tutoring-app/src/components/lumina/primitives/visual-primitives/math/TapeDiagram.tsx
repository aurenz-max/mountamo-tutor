'use client';

import React, { useState } from 'react';
import CalculatorInput from '../../input-primitives/CalculatorInput';

export interface BarSegment {
  value?: number;
  label: string;
  isUnknown?: boolean;
}

export interface BarConfig {
  segments: BarSegment[];
  totalLabel?: string;
  color?: string;
}

export interface TapeDiagramData {
  title: string;
  description: string;
  bars: BarConfig[];
  comparisonMode?: boolean;
  showBrackets?: boolean;
  unknownSegment?: number | null;
}

interface TapeDiagramProps {
  data: TapeDiagramData;
  className?: string;
}

const TapeDiagram: React.FC<TapeDiagramProps> = ({ data, className }) => {
  const {
    bars = [],
    comparisonMode = false,
    showBrackets = true,
  } = data;

  const [selectedSegment, setSelectedSegment] = useState<{ barIndex: number; segmentIndex: number } | null>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});
  const [feedback, setFeedback] = useState<{ [key: string]: 'correct' | 'incorrect' | null }>({});
  const [showHints, setShowHints] = useState(false);
  const [activeCalculator, setActiveCalculator] = useState<string | null>(null);

  // Color palette for different bars
  const colorPalette = [
    'from-blue-500 to-blue-600',
    'from-purple-500 to-purple-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
  ];

  const getBarColor = (barIndex: number, customColor?: string) => {
    if (customColor) return customColor;
    return colorPalette[barIndex % colorPalette.length];
  };

  const calculateTotalValue = (segments: BarSegment[]): number | null => {
    let total = 0;
    for (const segment of segments) {
      if (segment.isUnknown || segment.value === undefined) return null;
      total += segment.value;
    }
    return total;
  };

  const handleSegmentClick = (barIndex: number, segmentIndex: number) => {
    setSelectedSegment({ barIndex, segmentIndex });
  };

  const getSegmentKey = (barIndex: number, segmentIndex: number) => {
    return `${barIndex}-${segmentIndex}`;
  };

  const calculateCorrectAnswer = (barIndex: number, segmentIndex: number): number | null => {
    const bar = bars[barIndex];
    if (!bar) return null;

    const segment = bar.segments[segmentIndex];
    if (!segment?.isUnknown) return null;

    // Calculate total from totalLabel if it's a number
    let barTotal: number | null = null;
    if (bar.totalLabel) {
      const totalMatch = bar.totalLabel.match(/\d+/);
      if (totalMatch) {
        barTotal = parseInt(totalMatch[0]);
      }
    }

    // If we have a total, subtract all known segments
    if (barTotal !== null) {
      let knownSum = 0;
      for (const seg of bar.segments) {
        if (!seg.isUnknown && seg.value !== undefined) {
          knownSum += seg.value;
        }
      }
      return barTotal - knownSum;
    }

    return null;
  };

  const handleAnswerSubmit = (barIndex: number, segmentIndex: number) => {
    const key = getSegmentKey(barIndex, segmentIndex);
    const userAnswer = parseFloat(userAnswers[key]);
    const correctAnswer = calculateCorrectAnswer(barIndex, segmentIndex);

    if (isNaN(userAnswer) || correctAnswer === null) {
      return;
    }

    setFeedback({
      ...feedback,
      [key]: userAnswer === correctAnswer ? 'correct' : 'incorrect'
    });
  };

  const handleAnswerChange = (barIndex: number, segmentIndex: number, value: string) => {
    const key = getSegmentKey(barIndex, segmentIndex);
    setUserAnswers({
      ...userAnswers,
      [key]: value
    });
    // Clear feedback when user changes answer
    if (feedback[key]) {
      setFeedback({
        ...feedback,
        [key]: null
      });
    }
  };

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Tape Diagram / Bar Model</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            <p className="text-xs text-orange-400 font-mono uppercase tracking-wider">Part-Whole Visualization</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-orange-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#f97316 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Tape Diagram Bars */}
          <div className={`space-y-16 ${comparisonMode ? 'relative' : ''}`}>
            {bars.map((bar, barIndex) => {
              const total = calculateTotalValue(bar.segments);
              const maxSegmentValue = Math.max(...bar.segments.map(s => s.value || 1));
              const hasBracket = showBrackets && bar.totalLabel;

              return (
                <div key={barIndex} className="relative">
                  {/* Total Label with Bracket (if enabled and totalLabel exists) */}
                  {hasBracket && (
                    <div className="absolute -top-16 left-0 right-0 flex items-start justify-center">
                      <div className="flex flex-col items-center">
                        {/* Bracket SVG */}
                        <svg width="100%" height="30" className="mb-1">
                          <path
                            d="M 0 25 L 0 5 Q 0 0 5 0 L 95% 0 Q 100% 0 100% 5 L 100% 25"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-slate-400"
                          />
                        </svg>
                        <div className="text-sm font-bold text-white bg-slate-800/80 px-3 py-1 rounded-full border border-slate-600">
                          {bar.totalLabel}
                          {total !== null && ` = ${total}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* The Bar */}
                  <div className={`flex ${comparisonMode ? 'items-start' : 'items-stretch'} gap-1`}>
                    {bar.segments.map((segment, segmentIndex) => {
                      const isSelected = selectedSegment?.barIndex === barIndex && selectedSegment?.segmentIndex === segmentIndex;
                      const isUnknown = segment.isUnknown;

                      // Calculate relative width based on value
                      const widthPercentage = segment.value
                        ? (segment.value / (total || maxSegmentValue)) * 100
                        : 100 / bar.segments.length;

                      return (
                        <div
                          key={segmentIndex}
                          className="relative"
                          style={{
                            flex: comparisonMode ? `0 0 ${widthPercentage}%` : 1,
                            minWidth: '80px'
                          }}
                        >
                          {/* Segment Box */}
                          <button
                            onClick={() => handleSegmentClick(barIndex, segmentIndex)}
                            className={`
                              w-full h-20 rounded-lg border-2 transition-all duration-200
                              ${isUnknown
                                ? 'bg-slate-700/50 border-yellow-500 border-dashed'
                                : `bg-gradient-to-br ${getBarColor(barIndex, bar.color)} border-slate-600`
                              }
                              ${isSelected ? 'ring-4 ring-orange-400 scale-105' : 'hover:scale-105'}
                              flex items-center justify-center
                              shadow-lg
                            `}
                          >
                            <div className="text-center">
                              {isUnknown ? (
                                <div className="text-3xl font-bold text-yellow-400">?</div>
                              ) : (
                                <>
                                  {segment.value !== undefined && (
                                    <div className="text-2xl font-bold text-white mb-1">{segment.value}</div>
                                  )}
                                </>
                              )}
                              <div className="text-xs font-medium text-white/90 px-2 truncate">
                                {segment.label}
                              </div>
                            </div>
                          </button>

                          {/* Segment Label Below - Only show if label is different from value inside */}
                          {!isUnknown && segment.value !== undefined && segment.label && segment.label !== String(segment.value) && (
                            <div className="text-center mt-2 text-xs text-slate-400 font-mono">
                              {segment.label}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Comparison Alignment Lines */}
                  {comparisonMode && barIndex < bars.length - 1 && (
                    <div className="absolute -bottom-4 left-0 right-0 h-px bg-slate-600/50"></div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Segment Info */}
          {selectedSegment !== null && bars[selectedSegment.barIndex]?.segments[selectedSegment.segmentIndex] && (
            <div className="mt-8 p-6 bg-orange-900/20 rounded-xl border border-orange-500/30">
              <h4 className="text-sm font-mono uppercase tracking-wider text-orange-400 mb-3">
                Selected Segment Details
              </h4>
              <div className="space-y-2 text-sm text-slate-300">
                {(() => {
                  const bar = bars[selectedSegment.barIndex];
                  const segment = bar.segments[selectedSegment.segmentIndex];
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Label:</span>
                        <span className="font-semibold text-white">{segment.label}</span>
                      </div>
                      {!segment.isUnknown && segment.value !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Value:</span>
                          <span className="font-semibold text-white">{segment.value}</span>
                        </div>
                      )}
                      {segment.isUnknown && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Status:</span>
                          <span className="font-semibold text-yellow-400">Unknown Variable</span>
                        </div>
                      )}
                      {bar.totalLabel && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-600">
                          <span className="text-slate-400">Bar Total:</span>
                          <span className="font-semibold text-white">{bar.totalLabel}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Interactive Solver - Show for unknown segments */}
          {bars.some(bar => bar.segments.some(seg => seg.isUnknown)) && (
            <div className="mt-8">
              {/* Section Header - Lumina Style */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-orange-400 text-sm font-mono uppercase tracking-widest">
                  Solve the Problem
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-orange-700 to-transparent"></div>
              </div>

              <div className="space-y-6">
                {bars.map((bar, barIndex) =>
                  bar.segments.map((segment, segmentIndex) => {
                    if (!segment.isUnknown) return null;

                    const key = getSegmentKey(barIndex, segmentIndex);
                    const segmentFeedback = feedback[key];
                    const correctAnswer = calculateCorrectAnswer(barIndex, segmentIndex);
                    const isCalculatorActive = activeCalculator === key;

                    return (
                      <div key={key} className="relative">
                        {/* Question Header */}
                        <div className="mb-6 text-center">
                          <div className="text-sm text-slate-400 font-mono uppercase tracking-wider mb-2">Find the Value</div>
                          <h5 className="text-2xl font-bold text-white">
                            What is <span className="text-yellow-400">{segment.label}</span>?
                          </h5>
                        </div>

                        {/* Calculator Input Component */}
                        <CalculatorInput
                          label={`${segment.label} =`}
                          value={userAnswers[key] || ''}
                          onChange={(value) => handleAnswerChange(barIndex, segmentIndex, value)}
                          onSubmit={() => handleAnswerSubmit(barIndex, segmentIndex)}
                          showSubmitButton={true}
                          allowNegative={true}
                          allowDecimal={true}
                          className="mb-6"
                        />

                        {/* Feedback */}
                        {segmentFeedback === 'correct' && (
                          <div className="p-4 bg-green-500/20 border-2 border-green-500/50 rounded-xl">
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-green-500/30 flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                                </svg>
                              </div>
                              <div>
                                <div className="text-green-400 font-bold text-lg">Correct!</div>
                                <div className="text-green-300/80 text-sm">Excellent work! You solved it.</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {segmentFeedback === 'incorrect' && (
                          <div className="space-y-3">
                            <div className="p-4 bg-red-500/20 border-2 border-red-500/50 rounded-xl">
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-red-500/30 flex items-center justify-center">
                                  <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </div>
                                <div>
                                  <div className="text-red-400 font-bold text-lg">Not Quite</div>
                                  <div className="text-red-300/80 text-sm">Try again! You can do this.</div>
                                </div>
                              </div>
                            </div>

                            {/* Hint Section */}
                            <div className="text-center">
                              <button
                                onClick={() => setShowHints(!showHints)}
                                className="px-6 py-2 bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 rounded-lg
                                  hover:bg-blue-600/30 hover:border-blue-500/60 transition-all duration-200 font-semibold text-sm
                                  flex items-center gap-2 mx-auto"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                                </svg>
                                {showHints ? 'Hide Hint' : 'Need a Hint?'}
                              </button>
                            </div>

                            {showHints && correctAnswer !== null && (
                              <div className="p-4 bg-blue-500/20 border-2 border-blue-500/50 rounded-xl animate-fade-in">
                                <div className="text-center mb-3">
                                  <div className="inline-block px-3 py-1 bg-blue-600/30 rounded-full text-blue-300 text-xs font-mono uppercase tracking-wider mb-2">
                                    💡 Hint
                                  </div>
                                </div>
                                <div className="space-y-2 text-sm text-blue-200">
                                  <div className="flex items-center justify-between p-2 bg-blue-900/30 rounded">
                                    <span className="text-blue-300">Total:</span>
                                    <span className="font-bold">{bar.totalLabel?.match(/\d+/)?.[0] || '?'}</span>
                                  </div>
                                  <div className="p-2 bg-blue-900/30 rounded">
                                    <div className="text-blue-300 mb-1">Known values:</div>
                                    <div className="font-mono">
                                      {bar.segments
                                        .filter(s => !s.isUnknown && s.value !== undefined)
                                        .map(s => `${s.label} = ${s.value}`)
                                        .join(', ')}
                                    </div>
                                  </div>
                                  <div className="text-center p-2 italic text-blue-300/90">
                                    Subtract the known values from the total!
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
            <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
              Interactive Controls
            </h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-orange-400 mt-1">▸</span>
                <span>Click on any segment to view detailed information</span>
              </li>
              {comparisonMode && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">▸</span>
                  <span>Bars are aligned for comparison - observe the relative sizes</span>
                </li>
              )}
              {bars.some(bar => bar.segments.some(seg => seg.isUnknown)) && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">▸</span>
                  <span>Yellow dashed segments with "?" represent unknown values to solve for</span>
                </li>
              )}
              {showBrackets && bars.some(bar => bar.totalLabel) && (
                <li className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">▸</span>
                  <span>Brackets show the total value for each bar</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TapeDiagram;
