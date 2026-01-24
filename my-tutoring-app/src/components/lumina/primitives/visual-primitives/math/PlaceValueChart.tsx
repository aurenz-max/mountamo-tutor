'use client';

import React, { useState, useCallback } from 'react';
import {
  usePrimitiveEvaluation,
  type PlaceValueChartMetrics,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';

export interface PlaceValueChartData {
  title: string;
  description: string;
  minPlace: number; // e.g., -3 for thousandths
  maxPlace: number; // e.g., 6 for millions
  initialValue?: number; // Optional initial number to display
  showExpandedForm?: boolean;
  showMultipliers?: boolean;
  editableDigits?: boolean;
  targetValue?: number; // Optional target number for students to create

  // Evaluation integration (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PlaceValueChartMetrics>) => void;
}

interface PlaceValueChartProps {
  data: PlaceValueChartData;
  className?: string;
}

const PlaceValueChart: React.FC<PlaceValueChartProps> = ({ data, className }) => {
  const {
    minPlace = -2,
    maxPlace = 3,
    initialValue = 0,
    showExpandedForm = true,
    showMultipliers = true,
    editableDigits = true,
    targetValue,
    // Evaluation props
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // Convert initial value to digit array
  const getDigitsFromValue = (value: number): { [place: number]: string } => {
    const digits: { [place: number]: string } = {};
    const valueStr = Math.abs(value).toString();
    const parts = valueStr.split('.');

    // Integer part
    const integerPart = parts[0];
    for (let i = 0; i < integerPart.length; i++) {
      const place = integerPart.length - 1 - i;
      digits[place] = integerPart[i];
    }

    // Decimal part
    if (parts[1]) {
      for (let i = 0; i < parts[1].length; i++) {
        digits[-(i + 1)] = parts[1][i];
      }
    }

    return digits;
  };

  const [digits, setDigits] = useState<{ [place: number]: string }>(
    getDigitsFromValue(initialValue)
  );
  const [digitChangeCount, setDigitChangeCount] = useState(0);

  // Evaluation hook
  const {
    submitResult,
    hasSubmitted,
    resetAttempt,
  } = usePrimitiveEvaluation<PlaceValueChartMetrics>({
    primitiveType: 'place-value-chart',
    instanceId: instanceId || `place-value-chart-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // Place value names
  const getPlaceName = (place: number): string => {
    const names: { [key: number]: string } = {
      6: 'Millions',
      5: 'Hundred Thousands',
      4: 'Ten Thousands',
      3: 'Thousands',
      2: 'Hundreds',
      1: 'Tens',
      0: 'Ones',
      '-1': 'Tenths',
      '-2': 'Hundredths',
      '-3': 'Thousandths',
    };
    return names[place] || `10^${place}`;
  };

  // Get multiplier
  const getMultiplier = (place: number): string => {
    if (place === 0) return '×1';
    if (place > 0) return `×${Math.pow(10, place).toLocaleString()}`;
    return `×${(1 / Math.pow(10, Math.abs(place))).toString()}`;
  };

  // Handle digit change
  const handleDigitChange = (place: number, value: string) => {
    if (!editableDigits || hasSubmitted) return;

    const sanitized = value.replace(/[^0-9]/g, '').slice(-1);
    setDigits((prev) => {
      const updated = { ...prev };
      if (sanitized === '') {
        delete updated[place];
      } else {
        updated[place] = sanitized;
      }
      return updated;
    });
    setDigitChangeCount((prev) => prev + 1);
  };

  // Calculate expanded form
  const getExpandedForm = (): string[] => {
    const parts: string[] = [];
    for (let place = maxPlace; place >= minPlace; place--) {
      const digit = digits[place] || '0';
      if (digit !== '0') {
        const value = parseInt(digit) * Math.pow(10, place);
        parts.push(value.toString());
      }
    }
    return parts;
  };

  // Calculate the final numeric value from digits
  const calculateValueFromDigits = useCallback((): number => {
    let value = 0;
    for (let place = maxPlace; place >= minPlace; place--) {
      const digit = digits[place] || '0';
      value += parseInt(digit) * Math.pow(10, place);
    }
    return value;
  }, [digits, maxPlace, minPlace]);

  // Submit evaluation
  const handleSubmit = useCallback(() => {
    if (hasSubmitted) return;

    const finalValue = calculateValueFromDigits();
    const isCorrect = targetValue !== undefined ? Math.abs(finalValue - targetValue) < 0.0001 : true;

    // Calculate score
    let score = 100;
    if (targetValue !== undefined) {
      if (isCorrect) {
        score = 100;
      } else {
        // Partial credit based on how close they are
        const difference = Math.abs(finalValue - targetValue);
        const magnitude = Math.max(Math.abs(targetValue), 1);
        const percentError = (difference / magnitude) * 100;
        score = Math.max(0, 100 - percentError);
      }
    }

    const expandedParts = getExpandedForm();
    const totalDigits = Object.values(digits).filter(d => d !== '0').length;
    const usesDecimals = minPlace < 0 && Object.keys(digits).some(k => parseInt(k) < 0);
    const usesLargeNumbers = finalValue >= 1000;

    const metrics: PlaceValueChartMetrics = {
      type: 'place-value-chart',
      targetValue,
      finalValue,
      isCorrect,
      placeRange: {
        minPlace,
        maxPlace,
      },
      usesDecimals,
      usesLargeNumbers,
      totalDigitsEntered: totalDigits,
      digitsByPlace: { ...digits },
      expandedFormCorrect: expandedParts.length > 0,
      expandedFormParts: expandedParts,
      digitChanges: digitChangeCount,
      placeValueAccuracy: score,
    };

    submitResult(isCorrect, score, metrics, {
      studentWork: { digits, finalValue },
    });
  }, [
    hasSubmitted,
    calculateValueFromDigits,
    targetValue,
    digits,
    digitChangeCount,
    minPlace,
    maxPlace,
    submitResult,
  ]);

  // Reset for another attempt
  const handleReset = useCallback(() => {
    setDigits(getDigitsFromValue(initialValue));
    setDigitChangeCount(0);
    resetAttempt();
  }, [initialValue, resetAttempt]);

  // Create place columns
  const places: number[] = [];
  for (let place = maxPlace; place >= minPlace; place--) {
    places.push(place);
  }

  return (
    <div className={`w-full max-w-6xl mx-auto my-16 animate-fade-in ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8 justify-center">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
          </svg>
        </div>
        <div className="text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Place Value Chart</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-xs text-indigo-400 font-mono uppercase tracking-wider">Digit Position System</p>
          </div>
        </div>
      </div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl border border-indigo-500/20 relative overflow-hidden">
        {/* Background Texture */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        ></div>

        <div className="relative z-10 w-full">
          <div className="mb-8 text-center max-w-3xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-2">{data.title}</h3>
            <p className="text-slate-300 font-light">{data.description}</p>
          </div>

          {/* Place Value Chart */}
          <div className="overflow-x-auto pb-4">
            <div className="inline-block min-w-full">
              {/* Multipliers Row (optional) */}
              {showMultipliers && (
                <div className="flex border-b-2 border-indigo-500/30 mb-2">
                  {places.map((place) => (
                    <div
                      key={`mult-${place}`}
                      className="flex-1 min-w-[80px] px-2 py-2 text-center text-xs font-mono text-indigo-300"
                    >
                      {getMultiplier(place)}
                    </div>
                  ))}
                </div>
              )}

              {/* Place Names Row */}
              <div className="flex border-b-2 border-slate-600 mb-4">
                {places.map((place) => (
                  <div
                    key={`name-${place}`}
                    className={`flex-1 min-w-[80px] px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide ${
                      place === 0 ? 'border-l-2 border-r-2 border-yellow-500/50 bg-yellow-500/10' : ''
                    } ${
                      place < 0 ? 'text-purple-300' : 'text-blue-300'
                    }`}
                  >
                    {getPlaceName(place)}
                  </div>
                ))}
              </div>

              {/* Digits Row */}
              <div className="flex">
                {places.map((place) => (
                  <div
                    key={`digit-${place}`}
                    className={`flex-1 min-w-[80px] px-2 ${
                      place === 0 ? 'border-l-2 border-r-2 border-yellow-500/50' : ''
                    }`}
                  >
                    {editableDigits ? (
                      <input
                        type="text"
                        value={digits[place] || ''}
                        onChange={(e) => handleDigitChange(place, e.target.value)}
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-3 py-4 text-center text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        maxLength={1}
                        placeholder="0"
                      />
                    ) : (
                      <div className="w-full bg-slate-800/30 border border-slate-700 rounded-lg px-3 py-4 text-center text-3xl font-bold text-white">
                        {digits[place] || '0'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Decimal point indicator */}
              {minPlace < 0 && (
                <div className="mt-2 text-center">
                  <div className="inline-block text-yellow-400 text-xs font-mono">
                    ↑ Decimal point between Ones and Tenths
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Form (optional) */}
          {showExpandedForm && (
            <div className="mt-8 p-6 bg-slate-800/30 rounded-xl border border-slate-700">
              <h4 className="text-sm font-mono uppercase tracking-wider text-slate-400 mb-3">
                Expanded Form
              </h4>
              <div className="text-lg text-white font-mono">
                {getExpandedForm().length > 0 ? (
                  getExpandedForm().join(' + ')
                ) : (
                  <span className="text-slate-500">0</span>
                )}
              </div>
            </div>
          )}

          {/* Evaluation controls (only show if evaluation is enabled) */}
          {editableDigits && (instanceId || onEvaluationSubmit) && (
            <div className="mt-8 flex items-center gap-4 justify-center">
              {targetValue !== undefined && (
                <div className="text-sm text-slate-400">
                  Target: <span className="font-mono text-white">{targetValue}</span>
                </div>
              )}
              <button
                onClick={handleSubmit}
                disabled={hasSubmitted}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-semibold transition-all shadow-lg disabled:shadow-none"
              >
                {hasSubmitted ? '✓ Submitted' : 'Submit'}
              </button>
              {hasSubmitted && (
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaceValueChart;
