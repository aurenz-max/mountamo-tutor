'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { PhExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Substance {
  id: string;
  name: string;
  pH: number;
  type: 'acid' | 'base' | 'neutral';
  strength: 'strong' | 'weak';
  category: 'food' | 'cleaning' | 'body' | 'nature' | 'lab';
  indicatorColors: {
    litmus: 'red' | 'blue';
    cabbageJuice: 'red' | 'pink' | 'purple' | 'blue' | 'green' | 'yellow';
    universal: string;
  };
  realWorldInfo: string;
  imagePrompt?: string;
}

export interface Indicator {
  name: 'litmus' | 'cabbage_juice' | 'universal' | 'phenolphthalein';
  colorRange: Record<string, string>;
}

export interface NeutralizationConfig {
  enabled: boolean;
  acid: string;
  base: string;
  showpHMeter: boolean;
  showParticleView: boolean;
}

export interface PHChallenge {
  id: string;
  type: 'sort' | 'test' | 'place_on_scale' | 'neutralize' | 'identify_from_color' | 'rainbow' | 'predict_pH';
  instruction: string;
  targetAnswer: string;
  hint: string;
  narration: string;
}

export interface PHShowOptions {
  showPHScale: boolean;
  showIndicators: boolean;
  showNeutralization: boolean;
  showParticleView: boolean;
  showRealWorldImages: boolean;
  showConcentration: boolean;
}

export interface PhExplorerData {
  title: string;
  description?: string;
  substances: Substance[];
  indicators: Indicator[];
  neutralization?: NeutralizationConfig;
  challenges: PHChallenge[];
  showOptions?: Partial<PHShowOptions>;
  imagePrompt?: string | null;
  gradeBand?: '4-6' | '7-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<PhExplorerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** pH scale gradient colors from 0 to 14 */
const PH_COLORS: Record<number, string> = {
  0: '#ff0000', 1: '#ff4400', 2: '#ff8800', 3: '#ffaa00',
  4: '#ffcc00', 5: '#dddd00', 6: '#aaee00', 7: '#00cc00',
  8: '#00aaaa', 9: '#0088cc', 10: '#0066dd', 11: '#4444ee',
  12: '#6622ee', 13: '#8800cc', 14: '#660088',
};

const CABBAGE_JUICE_COLORS: Record<string, string> = {
  red: '#e53e3e', pink: '#ed64a6', purple: '#9f7aea',
  blue: '#4299e1', green: '#48bb78', yellow: '#ecc94b',
};

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  acid: { label: 'Acid', color: 'text-red-400' },
  base: { label: 'Base', color: 'text-blue-400' },
  neutral: { label: 'Neutral', color: 'text-green-400' },
};

// ============================================================================
// Sub-components
// ============================================================================

/** Visual pH scale bar with markers */
const PHScaleBar: React.FC<{
  substances: Substance[];
  testedIds: Set<string>;
  placedIds: Map<string, number>;
}> = ({ substances, testedIds, placedIds }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-slate-300">pH Scale</span>
      <span className="text-slate-500 text-xs">(0 = Very Acidic, 7 = Neutral, 14 = Very Basic)</span>
    </div>

    {/* Scale bar */}
    <div className="relative h-10 rounded-lg overflow-hidden mb-2"
      style={{
        background: `linear-gradient(to right, ${Object.values(PH_COLORS).join(', ')})`,
      }}
    >
      {/* Number markers */}
      {Array.from({ length: 15 }).map((_, pH) => (
        <div
          key={pH}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: `${(pH / 14) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="text-[9px] text-white font-bold drop-shadow-lg mt-0.5">{pH}</span>
        </div>
      ))}

      {/* Placed substance markers */}
      {substances.filter(s => testedIds.has(s.id) || placedIds.has(s.id)).map(s => {
        const pos = placedIds.get(s.id) ?? s.pH;
        return (
          <div
            key={s.id}
            className="absolute bottom-0 transform -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${(pos / 14) * 100}%` }}
          >
            <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-900 shadow-lg" />
            <span className="text-[7px] text-white font-medium whitespace-nowrap drop-shadow-lg mt-0.5">
              {s.name}
            </span>
          </div>
        );
      })}
    </div>

    {/* Labels */}
    <div className="flex justify-between text-[10px]">
      <span className="text-red-400 font-medium">Strong Acid</span>
      <span className="text-yellow-400 font-medium">Weak Acid</span>
      <span className="text-green-400 font-medium">Neutral</span>
      <span className="text-cyan-400 font-medium">Weak Base</span>
      <span className="text-purple-400 font-medium">Strong Base</span>
    </div>
  </div>
);

/** Test tube with indicator color display */
const TestTubeView: React.FC<{
  substance: Substance | null;
  indicatorName: string;
  indicatorColor: string | null;
}> = ({ substance, indicatorName, indicatorColor }) => (
  <div className="flex flex-col items-center">
    {/* Test tube */}
    <div className="relative w-12 h-28 border-2 border-white/20 rounded-b-full bg-slate-800/20 overflow-hidden">
      {indicatorColor && (
        <div
          className="absolute bottom-0 left-0 right-0 transition-all duration-700 rounded-b-full"
          style={{ height: '60%', backgroundColor: indicatorColor + '90' }}
        />
      )}
      {!indicatorColor && substance && (
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-slate-600/20 rounded-b-full" />
      )}
    </div>
    <span className="text-[9px] text-slate-500 mt-1 text-center max-w-16 leading-tight">
      {substance ? substance.name : 'Empty'}
    </span>
    {indicatorName && (
      <span className="text-[8px] text-slate-600 italic">{indicatorName}</span>
    )}
  </div>
);

/** Neutralization station with pH meter */
const NeutralizationStation: React.FC<{
  acid: Substance | undefined;
  base: Substance | undefined;
  mixRatio: number;
  onMixChange: (ratio: number) => void;
}> = ({ acid, base, mixRatio, onMixChange }) => {
  if (!acid || !base) return null;

  // Calculate current pH based on mix ratio (0 = all acid, 100 = all base)
  const currentPH = acid.pH + (base.pH - acid.pH) * (mixRatio / 100);
  const phColor = PH_COLORS[Math.round(Math.min(14, Math.max(0, currentPH)))] || '#00cc00';

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-slate-300">Neutralization Station</span>
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="text-center">
          <div className="text-red-400 text-xs font-medium mb-1">{acid.name}</div>
          <div className="text-red-400/60 text-[10px]">pH {acid.pH}</div>
        </div>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={100}
            value={mixRatio}
            onChange={(e) => onMixChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer"
          />
        </div>

        <div className="text-center">
          <div className="text-blue-400 text-xs font-medium mb-1">{base.name}</div>
          <div className="text-blue-400/60 text-[10px]">pH {base.pH}</div>
        </div>
      </div>

      {/* pH meter display */}
      <div className="flex items-center justify-center gap-3">
        <div className="bg-slate-900/60 rounded-lg px-4 py-2 border border-white/10 flex items-center gap-2">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: phColor }} />
          <span className="text-slate-100 font-mono text-lg font-bold">
            pH {currentPH.toFixed(1)}
          </span>
        </div>
        {Math.abs(currentPH - 7) < 0.5 && (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-xs animate-pulse">
            Neutralized!
          </Badge>
        )}
      </div>
    </div>
  );
};

/** Particle view showing H+ / OH- concentration */
const ParticleView: React.FC<{ pH: number }> = ({ pH }) => {
  const hPlusCount = Math.max(1, Math.round(14 - pH));
  const ohMinusCount = Math.max(1, Math.round(pH));

  return (
    <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-slate-300">Particle View</span>
        <span className="text-slate-500 text-xs">H+ and OH- ions</span>
      </div>

      <div className="relative w-full h-32 bg-slate-900/40 rounded-lg border border-white/5 overflow-hidden">
        {/* H+ ions (red) */}
        {Array.from({ length: hPlusCount }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute w-4 h-4 rounded-full bg-red-400/50 border border-red-400/60 flex items-center justify-center animate-pulse"
            style={{
              left: `${5 + Math.random() * 40}%`,
              top: `${5 + Math.random() * 80}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }}
          >
            <span className="text-[7px] font-bold text-white">H+</span>
          </div>
        ))}

        {/* OH- ions (blue) */}
        {Array.from({ length: ohMinusCount }).map((_, i) => (
          <div
            key={`oh-${i}`}
            className="absolute w-5 h-5 rounded-full bg-blue-400/40 border border-blue-400/50 flex items-center justify-center animate-pulse"
            style={{
              left: `${55 + Math.random() * 38}%`,
              top: `${5 + Math.random() * 80}%`,
              animationDelay: `${i * 0.25}s`,
              animationDuration: `${2 + Math.random()}s`,
            }}
          >
            <span className="text-[6px] font-bold text-white">OH-</span>
          </div>
        ))}

        {/* Legend */}
        <div className="absolute bottom-1 left-1 flex gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
            <span className="text-[8px] text-slate-500">H+ ({hPlusCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-400/50" />
            <span className="text-[8px] text-slate-500">OH- ({ohMinusCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Props
// ============================================================================

interface PhExplorerProps {
  data: PhExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const PhExplorer: React.FC<PhExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    substances = [],
    indicators = [],
    neutralization,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '4-6',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showPHScale = true,
    showIndicators = true,
    showNeutralization = neutralization?.enabled ?? false,
    showParticleView = gradeBand === '7-8',
    showRealWorldImages = false,
    showConcentration = gradeBand === '7-8',
  } = showOptionsProp;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [selectedSubstance, setSelectedSubstance] = useState<Substance | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('litmus');
  const [testedSubstances, setTestedSubstances] = useState<Set<string>>(new Set());
  const [placedOnScale, setPlacedOnScale] = useState<Map<string, number>>(new Map());
  const [sortResults, setSortResults] = useState<Map<string, string>>(new Map());
  const [mixRatio, setMixRatio] = useState(0);
  const [particleViewPH, setParticleViewPH] = useState(7);
  const [cabbageJuiceSubstances, setCabbageJuiceSubstances] = useState<Set<string>>(new Set());

  // Challenge state
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');

  // Tracking
  const [sortingCorrect, setSortingCorrect] = useState(0);
  const [sortingTotal, setSortingTotal] = useState(0);
  const [pHEstimates, setPHEstimates] = useState<number[]>([]);
  const [indicatorInterpreted, setIndicatorInterpreted] = useState(0);
  const [interpretationsTotal, setInterpretationsTotal] = useState(0);
  const [neutralizationCompleted, setNeutralizationCompleted] = useState(false);
  const [neutralizationPointFound, setNeutralizationPointFound] = useState(false);
  const [rainbowCreated, setRainbowCreated] = useState(false);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `ph-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  // Get indicator color for a substance
  const getIndicatorColor = useCallback((substance: Substance, indicatorName: string): string | null => {
    if (indicatorName === 'litmus') {
      return substance.indicatorColors.litmus === 'red' ? '#e53e3e' : '#4299e1';
    }
    if (indicatorName === 'cabbage_juice') {
      return CABBAGE_JUICE_COLORS[substance.indicatorColors.cabbageJuice] || '#9f7aea';
    }
    if (indicatorName === 'universal') {
      return PH_COLORS[Math.round(substance.pH)] || '#00cc00';
    }
    if (indicatorName === 'phenolphthalein') {
      return substance.pH >= 8 ? '#ed64a6' : 'transparent';
    }
    return null;
  }, []);

  // Calculate pH estimate accuracy
  const pHEstimateAccuracy = useMemo(() => {
    if (pHEstimates.length === 0) return 0;
    return pHEstimates.reduce((sum, diff) => sum + diff, 0) / pHEstimates.length;
  }, [pHEstimates]);

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<PhExplorerMetrics>({
    primitiveType: 'ph-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // -------------------------------------------------------------------------
  // AI Tutoring Integration
  // -------------------------------------------------------------------------

  const aiPrimitiveData = useMemo(() => ({
    gradeBand,
    totalSubstances: substances.length,
    testedCount: testedSubstances.size,
    selectedSubstance: selectedSubstance?.name ?? null,
    selectedIndicator,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'sort',
    instruction: currentChallenge?.instruction ?? title,
    attemptNumber: currentAttempts + 1,
    studentAnswer: challengeAnswer,
    neutralizationPH: neutralization?.enabled
      ? (substances.find(s => s.id === neutralization.acid)?.pH ?? 2) +
        ((substances.find(s => s.id === neutralization.base)?.pH ?? 12) -
         (substances.find(s => s.id === neutralization.acid)?.pH ?? 2)) * (mixRatio / 100)
      : null,
    rainbowCount: cabbageJuiceSubstances.size,
  }), [
    gradeBand, substances.length, testedSubstances.size, selectedSubstance,
    selectedIndicator, currentChallengeIndex, challenges.length, currentChallenge,
    currentAttempts, challengeAnswer, neutralization, mixRatio, cabbageJuiceSubstances.size, title,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'ph-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === '4-6' ? 'Grade 4-6' : 'Grade 7-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    const substanceNames = substances.map(s => s.name).join(', ');
    sendText(
      `[ACTIVITY_START] This is a pH Explorer activity: "${title}" for ${gradeBand}. ` +
      `Substances available: ${substanceNames}. ` +
      `Introduce the activity: "Today we're exploring acids and bases! Everything around us has a pH — ` +
      `let's discover the acid-base rainbow!"`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, substances, sendText]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTestSubstance = useCallback((substance: Substance) => {
    setSelectedSubstance(substance);
    setTestedSubstances(prev => new Set(prev).add(substance.id));

    // Track cabbage juice rainbow
    if (selectedIndicator === 'cabbage_juice') {
      setCabbageJuiceSubstances(prev => {
        const next = new Set(prev).add(substance.id);
        if (next.size >= 6 && !rainbowCreated) {
          setRainbowCreated(true);
          sendText(
            `[RAINBOW_CREATED] Student tested ${next.size} substances with cabbage juice! ` +
            `They created a pH rainbow! Celebrate: "You made a rainbow of colors! ` +
            `Each color tells us the pH!"`,
            { silent: true }
          );
        }
        return next;
      });
    }

    // Update particle view pH
    setParticleViewPH(substance.pH);

    const indicatorColor = getIndicatorColor(substance, selectedIndicator);
    sendText(
      `[SUBSTANCE_TESTED] Student tested ${substance.name} (pH ${substance.pH}, ${substance.type}) ` +
      `with ${selectedIndicator}. Color result: ${indicatorColor}. ` +
      `Guide: "Look at the color! ${substance.name} has pH ${substance.pH} — ` +
      `that makes it ${substance.type === 'acid' ? 'acidic' : substance.type === 'base' ? 'basic' : 'neutral'}. ` +
      `${substance.realWorldInfo}"`,
      { silent: true }
    );
  }, [selectedIndicator, getIndicatorColor, sendText, rainbowCreated]);

  const handleSortSubstance = useCallback((substanceId: string, classification: string) => {
    const substance = substances.find(s => s.id === substanceId);
    if (!substance) return;

    const nextSortResults = new Map(sortResults).set(substanceId, classification);
    setSortResults(nextSortResults);
    setSortingTotal(prev => prev + 1);

    if (classification === substance.type) {
      setSortingCorrect(prev => prev + 1);
      sendText(
        `[SORT_CORRECT] Student correctly sorted ${substance.name} as ${classification}. Congratulate!`,
        { silent: true }
      );
    } else {
      sendText(
        `[SORT_INCORRECT] Student sorted ${substance.name} as ${classification} ` +
        `but it's actually ${substance.type} (pH ${substance.pH}). ` +
        `Hint: "pH ${substance.pH} is ${substance.pH < 7 ? 'below 7, so it\'s an acid' : substance.pH > 7 ? 'above 7, so it\'s a base' : 'exactly 7, so it\'s neutral'}."`,
        { silent: true }
      );
    }

    // Mark the sort challenge as complete once all substances have been sorted
    if (currentChallenge?.type === 'sort' && nextSortResults.size >= substances.length) {
      const correctCount = substances.filter(s => nextSortResults.get(s.id) === s.type).length;
      setChallengeResults(prev => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: nextSortResults.size },
      ]);
      if (correctCount === substances.length) {
        setFeedback(`Perfect! All ${substances.length} sorted correctly!`);
        setFeedbackType('success');
      } else {
        setFeedback(`All sorted! ${correctCount}/${substances.length} correct — check the marks above.`);
        setFeedbackType('success');
      }
    }
  }, [substances, sendText, sortResults, currentChallenge]);

  const handleMixRatioChange = useCallback((ratio: number) => {
    setMixRatio(ratio);
    if (neutralization) {
      const acid = substances.find(s => s.id === neutralization.acid);
      const base = substances.find(s => s.id === neutralization.base);
      if (acid && base) {
        const currentPH = acid.pH + (base.pH - acid.pH) * (ratio / 100);
        setParticleViewPH(currentPH);

        if (Math.abs(currentPH - 7) < 0.5 && !neutralizationPointFound) {
          setNeutralizationPointFound(true);
          setNeutralizationCompleted(true);
          sendText(
            `[NEUTRALIZATION_POINT] Student found the neutralization point! pH is ~7. ` +
            `Celebrate: "You found it! When acid and base mix in just the right amount, ` +
            `they cancel each other out — pH 7, perfectly neutral!"`,
            { silent: true }
          );
        }
      }
    }
  }, [neutralization, substances, neutralizationPointFound, sendText]);

  const handleSubmitAnswer = useCallback(() => {
    if (!challengeAnswer.trim() || !currentChallenge) return;

    setCurrentAttempts(prev => prev + 1);
    setTotalAttempts(prev => prev + 1);

    const answer = challengeAnswer.trim().toLowerCase();
    const target = String(currentChallenge.targetAnswer).toLowerCase();
    const isCorrect = answer === target
      || target.split('|').some(t => answer.includes(t.trim()));

    if (isCorrect) {
      setFeedback('Correct! Great chemistry detective work!');
      setFeedbackType('success');

      setChallengeResults(prev => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
      ]);

      // Track by type
      if (currentChallenge.type === 'sort') {
        setSortingCorrect(prev => prev + 1);
        setSortingTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'identify_from_color') {
        setIndicatorInterpreted(prev => prev + 1);
        setInterpretationsTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'place_on_scale' || currentChallenge.type === 'predict_pH') {
        const numAnswer = parseFloat(answer);
        const numTarget = parseFloat(target.split('|')[0]);
        if (!isNaN(numAnswer) && !isNaN(numTarget)) {
          setPHEstimates(prev => [...prev, Math.abs(numAnswer - numTarget)]);
        }
      } else if (currentChallenge.type === 'neutralize') {
        setNeutralizationCompleted(true);
      }

      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" for ${currentChallenge.type}. ` +
        `Attempt ${currentAttempts + 1}. Congratulate!`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. ${currentChallenge.hint}`);
      setFeedbackType('error');

      if (currentChallenge.type === 'sort') setSortingTotal(prev => prev + 1);
      else if (currentChallenge.type === 'identify_from_color') setInterpretationsTotal(prev => prev + 1);

      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but correct is "${currentChallenge.targetAnswer}". ` +
        `Type: ${currentChallenge.type}. Attempt ${currentAttempts + 1}. Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }

    setChallengeAnswer('');
  }, [challengeAnswer, currentChallenge, currentAttempts, sendText]);

  const handleNextChallenge = useCallback(() => {
    if (currentChallengeIndex < challenges.length - 1) {
      setCurrentChallengeIndex(prev => prev + 1);
      setCurrentAttempts(0);
      setFeedback('');
      setFeedbackType('');
      setChallengeAnswer('');

      sendText(
        `[NEXT_ITEM] Moving to challenge ${currentChallengeIndex + 2} of ${challenges.length}. ` +
        `Type: ${challenges[currentChallengeIndex + 1]?.type}. Introduce it briefly.`,
        { silent: true }
      );
    } else {
      sendText(
        `[ALL_COMPLETE] Student finished all ${challenges.length} challenges! Celebrate!`,
        { silent: true }
      );

      if (!hasSubmittedEvaluation) {
        const score = challenges.length > 0
          ? challengeResults.filter(r => r.correct).length / challenges.length
          : 0;
        submitEvaluation(
          score >= 0.5,
          score,
          {
            type: 'ph-explorer',
            sortingCorrect,
            sortingTotal,
            pHEstimateAccuracy,
            indicatorColorInterpreted: indicatorInterpreted,
            interpretationsTotal,
            neutralizationCompleted,
            neutralizationPointFound,
            rainbowCreated,
            substancesExplored: testedSubstances.size,
            attemptsCount: totalAttempts,
          },
          { challengeResults },
        );
      }
    }
  }, [
    currentChallengeIndex, challenges, sendText, hasSubmittedEvaluation, submitEvaluation,
    challengeResults, sortingCorrect, sortingTotal, pHEstimateAccuracy, indicatorInterpreted,
    interpretationsTotal, neutralizationCompleted, neutralizationPointFound, rainbowCreated,
    testedSubstances.size, totalAttempts,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-slate-100 text-xl flex items-center gap-2">
              <span className="text-2xl">{'\uD83E\uDDEA'}</span>
              {title}
            </CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
              {gradeBand === '4-6' ? 'Grade 4-6' : 'Grade 7-8'}
            </Badge>
            {rainbowCreated && (
              <Badge className="bg-gradient-to-r from-red-500/20 via-green-500/20 to-purple-500/20 text-slate-200 border-white/20 text-xs">
                Rainbow!
              </Badge>
            )}
          </div>
        </div>

        {/* Challenge progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-500 text-xs">Challenge</span>
            {challenges.map((c, i) => (
              <div
                key={c.id}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border ${
                  challengeResults.some(r => r.challengeId === c.id && r.correct)
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-amber-500/20 border-amber-400/30 text-amber-400'
                      : 'bg-slate-800/30 border-white/10 text-slate-600'
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge instruction */}
        {currentChallenge && (
          <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-400/20">
            <p className="text-indigo-200 text-sm font-medium">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* pH Scale */}
        {showPHScale && (
          <PHScaleBar
            substances={substances}
            testedIds={testedSubstances}
            placedIds={placedOnScale}
          />
        )}

        {/* Indicator selector + test tubes */}
        {showIndicators && (
          <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-slate-300">Indicator</span>
            </div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {indicators.map(ind => (
                <Button
                  key={ind.name}
                  variant="ghost"
                  size="sm"
                  className={`bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 capitalize ${
                    selectedIndicator === ind.name ? 'ring-1 ring-purple-400/40' : ''
                  }`}
                  onClick={() => setSelectedIndicator(ind.name)}
                >
                  {ind.name.replace('_', ' ')}
                </Button>
              ))}
            </div>

            {/* Test tube display */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              <TestTubeView
                substance={selectedSubstance}
                indicatorName={selectedIndicator.replace('_', ' ')}
                indicatorColor={selectedSubstance ? getIndicatorColor(selectedSubstance, selectedIndicator) : null}
              />
            </div>
          </div>
        )}

        {/* Substance cards */}
        <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
          <span className="text-slate-300 text-sm font-medium mb-2 block">Substances to Test</span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {substances.map(substance => {
              const tested = testedSubstances.has(substance.id);
              const typeInfo = TYPE_BADGES[substance.type];
              const sorted = sortResults.get(substance.id);
              return (
                <Button
                  key={substance.id}
                  variant="ghost"
                  className="h-auto py-2 px-3 bg-white/5 border border-white/20 hover:bg-white/10 text-left flex flex-col items-start gap-0.5"
                  onClick={() => handleTestSubstance(substance)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: PH_COLORS[Math.round(substance.pH)] }}
                    />
                    <span className="text-slate-200 text-sm font-medium">{substance.name}</span>
                    {tested && (
                      <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-400/30 text-[9px]">
                        Tested
                      </Badge>
                    )}
                  </div>
                  {tested && (
                    <span className="text-slate-400 text-xs ml-5">
                      pH {substance.pH} &middot; <span className={typeInfo?.color || ''}>{typeInfo?.label}</span>
                    </span>
                  )}
                  {sorted && (
                    <span className={`text-xs ml-5 ${sorted === substance.type ? 'text-emerald-400' : 'text-red-400'}`}>
                      Sorted: {sorted} {sorted === substance.type ? '\u2713' : '\u2717'}
                    </span>
                  )}
                  <span className="text-slate-600 text-[10px] ml-5">{substance.category}</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Sort buttons (for sort challenges) */}
        {currentChallenge?.type === 'sort' && selectedSubstance && !sortResults.has(selectedSubstance.id) && (
          <div className="flex items-center gap-2 justify-center">
            <span className="text-slate-400 text-sm">Sort {selectedSubstance.name}:</span>
            {['acid', 'base', 'neutral'].map(type => (
              <Button
                key={type}
                variant="ghost"
                size="sm"
                className={`border border-white/20 hover:bg-white/10 capitalize ${
                  type === 'acid' ? 'text-red-400 bg-red-500/10' :
                  type === 'base' ? 'text-blue-400 bg-blue-500/10' :
                  'text-green-400 bg-green-500/10'
                }`}
                onClick={() => handleSortSubstance(selectedSubstance.id, type)}
              >
                {type}
              </Button>
            ))}
          </div>
        )}

        {/* Neutralization station */}
        {showNeutralization && neutralization?.enabled && (
          <NeutralizationStation
            acid={substances.find(s => s.id === neutralization.acid)}
            base={substances.find(s => s.id === neutralization.base)}
            mixRatio={mixRatio}
            onMixChange={handleMixRatioChange}
          />
        )}

        {/* Particle view */}
        {showParticleView && (
          <ParticleView pH={particleViewPH} />
        )}

        {/* Challenge answer area */}
        {currentChallenge && !isCurrentChallengeComplete && currentChallenge.type !== 'sort' && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={challengeAnswer}
              onChange={(e) => setChallengeAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
              placeholder="Type your answer..."
              className="flex-1 bg-slate-800/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-white/20"
            />
            <Button
              variant="ghost"
              className="bg-indigo-500/20 border border-indigo-400/30 hover:bg-indigo-500/30 text-indigo-300"
              onClick={handleSubmitAnswer}
              disabled={!challengeAnswer.trim()}
            >
              Submit
            </Button>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-lg p-3 border text-sm ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
              : feedbackType === 'error'
                ? 'bg-red-500/10 border-red-400/20 text-red-300'
                : 'bg-slate-800/30 border-white/5 text-slate-400'
          }`}>
            {feedback}
          </div>
        )}

        {/* Next / Finish */}
        {isCurrentChallengeComplete && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="bg-emerald-500/20 border border-emerald-400/30 hover:bg-emerald-500/30 text-emerald-300"
              onClick={handleNextChallenge}
            >
              {currentChallengeIndex < challenges.length - 1 ? 'Next Challenge' : 'Finish'}
            </Button>
          </div>
        )}

        {/* Educational accordion */}
        <Accordion type="single" collapsible>
          <AccordionItem value="learn" className="border-white/10">
            <AccordionTrigger className="text-slate-300 text-sm hover:text-slate-100">
              What is pH?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  The <span className="text-slate-200 font-medium">pH scale</span> measures how acidic or basic something is,
                  from 0 to 14. A pH of 7 is <span className="text-green-300 font-medium">neutral</span> (like pure water).
                </p>
                <p>
                  <span className="text-red-300 font-medium">Acids</span> have pH below 7 &mdash; they taste sour (like lemon juice)
                  and turn litmus paper red. <span className="text-blue-300 font-medium">Bases</span> have pH above 7 &mdash;
                  they feel slippery (like soap) and turn litmus paper blue.
                </p>
                <p>
                  When you mix an acid and a base, they <span className="text-amber-300 font-medium">neutralize</span> each other,
                  moving the pH toward 7. That&rsquo;s how antacids calm your stomach!
                </p>
                {gradeBand === '7-8' && (
                  <p>
                    pH is a <span className="text-slate-200">logarithmic scale</span>: each step is 10x more concentrated.
                    pH 3 is <span className="text-slate-200">10 times</span> more acidic than pH 4, and
                    <span className="text-slate-200"> 100 times</span> more acidic than pH 5!
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Completion summary */}
        {allChallengesComplete && (
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20">
            <p className="text-emerald-300 font-bold text-lg mb-2">All Challenges Complete!</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">Sorting:</div>
              <div className="text-slate-200 font-mono">{sortingCorrect} / {sortingTotal}</div>
              <div className="text-slate-400">Substances Explored:</div>
              <div className="text-slate-200 font-mono">{testedSubstances.size}</div>
              <div className="text-slate-400">Indicator Interpreted:</div>
              <div className="text-slate-200 font-mono">{indicatorInterpreted} / {interpretationsTotal}</div>
              <div className="text-slate-400">Neutralization:</div>
              <div className="text-slate-200">{neutralizationCompleted ? 'Completed' : 'Not attempted'}</div>
              <div className="text-slate-400">Rainbow Created:</div>
              <div className="text-slate-200">{rainbowCreated ? 'Yes!' : 'No'}</div>
              <div className="text-slate-400">Total Attempts:</div>
              <div className="text-slate-200 font-mono">{totalAttempts}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhExplorer;
