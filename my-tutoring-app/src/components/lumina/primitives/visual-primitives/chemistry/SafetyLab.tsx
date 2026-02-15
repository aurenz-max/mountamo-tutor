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
import type { SafetyLabMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface Hazard {
  id: string;
  type: 'fire' | 'chemical' | 'glass' | 'electrical' | 'biological' | 'slip';
  description: string;
  location: { x: number; y: number };
  severity: 'low' | 'medium' | 'high';
  correction: string;
}

export interface Scenario {
  name: string;
  experiment: string;
  hazards: Hazard[];
  requiredPPE: string[];
  safetyEquipment: string[];
}

export interface GHSSymbol {
  symbol: 'flame' | 'skull' | 'corrosion' | 'exclamation' | 'health_hazard' | 'environment' | 'oxidizer' | 'gas_cylinder' | 'explosive';
  meaning: string;
  examples: string[];
}

export interface EmergencySequence {
  scenario: string;
  correctOrder: string[];
}

export interface SafetyChallenge {
  id: string;
  type: 'equip_ppe' | 'spot_hazard' | 'match_symbols' | 'emergency_response' | 'design_lab' | 'safety_quiz';
  instruction: string;
  targetAnswer: string | string[];
  hint: string;
  narration: string;
}

export interface SafetyShowOptions {
  showLabScene: boolean;
  showPPEStation: boolean;
  showGHSSymbols: boolean;
  showEmergencyStations: boolean;
  showTimer: boolean;
}

export interface SafetyLabData {
  title: string;
  description?: string;
  scenario: Scenario;
  ghsSymbols?: GHSSymbol[];
  emergencySequence?: EmergencySequence;
  challenges: SafetyChallenge[];
  showOptions?: Partial<SafetyShowOptions>;
  imagePrompt?: string | null;
  gradeBand?: 'K-2' | '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SafetyLabMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PPE_ITEMS: Record<string, { label: string; icon: string; description: string }> = {
  goggles: { label: 'Safety Goggles', icon: '\uD83E\uDD7D', description: 'Protect your eyes from splashes and fumes' },
  gloves: { label: 'Lab Gloves', icon: '\uD83E\uDDE4', description: 'Protect your hands from chemicals' },
  apron: { label: 'Lab Apron', icon: '\uD83E\uDDBA', description: 'Protect your clothes from spills' },
  lab_coat: { label: 'Lab Coat', icon: '\uD83E\uDD7C', description: 'Full body protection from chemicals' },
  face_shield: { label: 'Face Shield', icon: '\uD83D\uDEE1\uFE0F', description: 'Full face protection for dangerous reactions' },
  closed_shoes: { label: 'Closed Shoes', icon: '\uD83D\uDC5E', description: 'Protect your feet from spills and broken glass' },
};

const HAZARD_ICONS: Record<string, { icon: string; color: string }> = {
  fire: { icon: '\uD83D\uDD25', color: 'text-orange-400' },
  chemical: { icon: '\u2623\uFE0F', color: 'text-yellow-400' },
  glass: { icon: '\uD83E\uDE9F', color: 'text-cyan-400' },
  electrical: { icon: '\u26A1', color: 'text-amber-400' },
  biological: { icon: '\u2623\uFE0F', color: 'text-green-400' },
  slip: { icon: '\uD83D\uDCA7', color: 'text-blue-400' },
};

const GHS_ICONS: Record<string, string> = {
  flame: '\uD83D\uDD25',
  skull: '\u2620\uFE0F',
  corrosion: '\u26A0\uFE0F',
  exclamation: '\u2757',
  health_hazard: '\uD83C\uDFE5',
  environment: '\uD83C\uDF3F',
  oxidizer: '\uD83D\uDCA8',
  gas_cylinder: '\uD83E\uDDEA',
  explosive: '\uD83D\uDCA5',
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30',
  medium: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
  high: 'bg-red-500/20 text-red-300 border-red-400/30',
};

const SAFETY_EQUIPMENT_ICONS: Record<string, string> = {
  eye_wash: '\uD83D\uDCA7',
  fire_extinguisher: '\uD83E\uDDEF',
  shower: '\uD83D\uDEBF',
  first_aid: '\u2795',
  fume_hood: '\uD83C\uDF2C\uFE0F',
};

// ============================================================================
// Sub-components
// ============================================================================

/** Interactive lab scene with clickable hazards */
const LabScene: React.FC<{
  hazards: Hazard[];
  identifiedIds: Set<string>;
  onHazardClick: (hazard: Hazard) => void;
  sceneName: string;
}> = ({ hazards, identifiedIds, onHazardClick, sceneName }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-slate-300">Lab Scene: {sceneName}</span>
      <Badge className="bg-slate-700/50 text-slate-400 border-white/10 text-[10px]">
        {identifiedIds.size} / {hazards.length} hazards found
      </Badge>
    </div>

    {/* Lab scene grid */}
    <div className="relative w-full h-64 bg-slate-900/40 rounded-lg border border-white/5 overflow-hidden">
      {/* Lab background elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-600" />
        <div className="absolute top-4 left-4 w-20 h-16 border border-slate-600 rounded-sm" />
        <div className="absolute top-4 right-4 w-16 h-24 border border-slate-600 rounded-sm" />
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-32 h-12 border border-slate-600 rounded-sm" />
      </div>

      {/* Hazard hotspots */}
      {hazards.map(hazard => {
        const identified = identifiedIds.has(hazard.id);
        const hazardInfo = HAZARD_ICONS[hazard.type];
        return (
          <button
            key={hazard.id}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${
              identified
                ? 'scale-110'
                : 'hover:scale-125 animate-pulse cursor-pointer'
            }`}
            style={{
              left: `${hazard.location.x}%`,
              top: `${hazard.location.y}%`,
            }}
            onClick={() => !identified && onHazardClick(hazard)}
            disabled={identified}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
              identified
                ? 'bg-emerald-500/20 border-emerald-400/40'
                : 'bg-red-500/20 border-red-400/40 hover:bg-red-500/30'
            }`}>
              <span className="text-lg">
                {identified ? '\u2705' : hazardInfo?.icon || '\u26A0\uFE0F'}
              </span>
            </div>
            {identified && (
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className={`text-[8px] ${hazardInfo?.color || 'text-slate-400'} font-medium`}>
                  {hazard.type}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>

    {/* Identified hazards list */}
    {identifiedIds.size > 0 && (
      <div className="mt-3 space-y-1">
        {hazards.filter(h => identifiedIds.has(h.id)).map(h => (
          <div key={h.id} className="flex items-start gap-2 text-xs">
            <span className={HAZARD_ICONS[h.type]?.color || 'text-slate-400'}>
              {HAZARD_ICONS[h.type]?.icon || '\u26A0\uFE0F'}
            </span>
            <div>
              <span className="text-slate-300 font-medium">{h.description}</span>
              <span className="text-emerald-400/80 ml-2">Fix: {h.correction}</span>
            </div>
            <Badge className={`ml-auto text-[8px] ${SEVERITY_COLORS[h.severity]}`}>
              {h.severity}
            </Badge>
          </div>
        ))}
      </div>
    )}
  </div>
);

/** PPE selection station */
const PPEStation: React.FC<{
  requiredPPE: string[];
  selectedPPE: Set<string>;
  onTogglePPE: (ppe: string) => void;
  submitted: boolean;
}> = ({ requiredPPE, selectedPPE, onTogglePPE, submitted }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-slate-300">PPE Station</span>
      <span className="text-slate-500 text-xs">Select the safety equipment you need</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {Object.entries(PPE_ITEMS).map(([key, item]) => {
        const isSelected = selectedPPE.has(key);
        const isRequired = requiredPPE.includes(key);
        const showResult = submitted;
        return (
          <Button
            key={key}
            variant="ghost"
            className={`h-auto py-3 px-3 border text-left flex flex-col items-center gap-1 ${
              isSelected
                ? showResult
                  ? isRequired
                    ? 'bg-emerald-500/10 border-emerald-400/30 ring-1 ring-emerald-400/30'
                    : 'bg-red-500/10 border-red-400/30 ring-1 ring-red-400/30'
                  : 'bg-purple-500/10 border-purple-400/30 ring-1 ring-purple-400/30'
                : showResult && isRequired
                  ? 'bg-amber-500/10 border-amber-400/30'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
            }`}
            onClick={() => !submitted && onTogglePPE(key)}
            disabled={submitted}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-slate-200 text-xs font-medium text-center">{item.label}</span>
            {showResult && (
              <span className={`text-[9px] ${
                isSelected && isRequired ? 'text-emerald-400' :
                isSelected && !isRequired ? 'text-red-400' :
                !isSelected && isRequired ? 'text-amber-400' :
                'text-slate-600'
              }`}>
                {isSelected && isRequired ? 'Correct!' :
                 isSelected && !isRequired ? 'Not needed' :
                 !isSelected && isRequired ? 'Missing!' : ''}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  </div>
);

/** Emergency response sequencer */
const EmergencySequencer: React.FC<{
  scenario: string;
  correctOrder: string[];
  userOrder: string[];
  availableSteps: string[];
  onAddStep: (step: string) => void;
  onReset: () => void;
  submitted: boolean;
}> = ({ scenario, correctOrder, userOrder, availableSteps, onAddStep, onReset, submitted }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium text-slate-300">Emergency Response</span>
    </div>
    <p className="text-amber-200 text-sm mb-3 font-medium">{scenario}</p>

    {/* User's ordered steps */}
    <div className="space-y-1 mb-3">
      {userOrder.map((step, i) => {
        const isCorrectPosition = submitted && correctOrder[i] === step;
        return (
          <div key={i} className={`flex items-center gap-2 rounded-lg p-2 border text-xs ${
            submitted
              ? isCorrectPosition
                ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
              : 'bg-slate-700/30 border-white/10 text-slate-300'
          }`}>
            <span className="text-slate-500 font-mono w-5">{i + 1}.</span>
            <span>{step}</span>
            {submitted && (
              <span className="ml-auto">{isCorrectPosition ? '\u2713' : '\u2717'}</span>
            )}
          </div>
        );
      })}
    </div>

    {/* Available steps to add */}
    {!submitted && (
      <div className="flex flex-wrap gap-1">
        {availableSteps.map(step => (
          <Button
            key={step}
            variant="ghost"
            size="sm"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 text-xs"
            onClick={() => onAddStep(step)}
          >
            {step}
          </Button>
        ))}
        {userOrder.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="bg-red-500/10 border border-red-400/20 hover:bg-red-500/20 text-red-300 text-xs"
            onClick={onReset}
          >
            Reset
          </Button>
        )}
      </div>
    )}
  </div>
);

/** GHS symbols display */
const GHSSymbolsDisplay: React.FC<{
  symbols: GHSSymbol[];
  matchedSymbols: Map<string, string>;
  onMatch: (symbol: string, meaning: string) => void;
}> = ({ symbols }) => (
  <div className="bg-slate-800/30 rounded-xl p-4 border border-white/5">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-medium text-slate-300">GHS Hazard Symbols</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {symbols.map(sym => (
        <div key={sym.symbol} className="bg-slate-900/40 rounded-lg p-3 border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{GHS_ICONS[sym.symbol] || '\u26A0\uFE0F'}</span>
            <span className="text-slate-200 text-xs font-medium capitalize">{sym.symbol.replace('_', ' ')}</span>
          </div>
          <p className="text-slate-400 text-[10px] mb-1">{sym.meaning}</p>
          <p className="text-slate-600 text-[9px]">Examples: {sym.examples.join(', ')}</p>
        </div>
      ))}
    </div>
  </div>
);

// ============================================================================
// Props
// ============================================================================

interface SafetyLabProps {
  data: SafetyLabData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const SafetyLab: React.FC<SafetyLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    scenario,
    ghsSymbols = [],
    emergencySequence,
    challenges = [],
    showOptions: showOptionsProp = {},
    gradeBand = '3-5',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showLabScene = true,
    showPPEStation = true,
    showGHSSymbols = gradeBand !== 'K-2' && ghsSymbols.length > 0,
    showEmergencyStations = true,
    showTimer = false,
  } = showOptionsProp;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [selectedPPE, setSelectedPPE] = useState<Set<string>>(new Set());
  const [ppeSubmitted, setPPESubmitted] = useState(false);
  const [identifiedHazards, setIdentifiedHazards] = useState<Set<string>>(new Set());
  const [matchedSymbols, setMatchedSymbols] = useState<Map<string, string>>(new Map());
  const [emergencyOrder, setEmergencyOrder] = useState<string[]>([]);
  const [emergencyAvailable, setEmergencyAvailable] = useState<string[]>(
    emergencySequence ? [...emergencySequence.correctOrder].sort(() => Math.random() - 0.5) : []
  );
  const [emergencySubmitted, setEmergencySubmitted] = useState(false);

  // Timer for hazard spotting
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [ppeCorrectCount, setPPECorrectCount] = useState(0);
  const [symbolsMatchedCorrectly, setSymbolsMatchedCorrectly] = useState(0);
  const [symbolsTotal, setSymbolsTotal] = useState(0);
  const [emergencySequenceCorrect, setEmergencySequenceCorrect] = useState(false);
  const [labDesignSafe, setLabDesignSafe] = useState(false);
  const [safetyQuizScore, setSafetyQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `safety-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // -------------------------------------------------------------------------
  // Timer effect
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (showTimer && !timerRef.current && identifiedHazards.size < scenario.hazards.length) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    if (identifiedHazards.size >= scenario.hazards.length && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showTimer, identifiedHazards.size, scenario.hazards.length]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = currentChallenge
    ? challengeResults.some(r => r.challengeId === currentChallenge.id && r.correct)
    : false;

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------

  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<SafetyLabMetrics>({
    primitiveType: 'safety-lab',
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
    scenarioName: scenario.name,
    experiment: scenario.experiment,
    hazardsTotal: scenario.hazards.length,
    hazardsIdentified: identifiedHazards.size,
    requiredPPE: scenario.requiredPPE,
    selectedPPE: Array.from(selectedPPE),
    ppeSubmitted,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type ?? 'equip_ppe',
    instruction: currentChallenge?.instruction ?? title,
    attemptNumber: currentAttempts + 1,
    studentAnswer: challengeAnswer,
    emergencyScenario: emergencySequence?.scenario ?? null,
    ghsSymbolCount: ghsSymbols.length,
  }), [
    gradeBand, scenario, identifiedHazards.size, selectedPPE, ppeSubmitted,
    currentChallengeIndex, challenges.length, currentChallenge, currentAttempts,
    challengeAnswer, emergencySequence, ghsSymbols.length, title,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'safety-lab',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-2' ? 'Kindergarten' : gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-8',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current) return;
    hasIntroducedRef.current = true;

    sendText(
      `[ACTIVITY_START] This is a Lab Safety Training activity: "${title}" for ${gradeBand}. ` +
      `Scenario: ${scenario.name} — preparing for "${scenario.experiment}". ` +
      `Hazards to find: ${scenario.hazards.length}. Required PPE: ${scenario.requiredPPE.join(', ')}. ` +
      `Introduce: "Before we start ANY experiment, safety comes first! ` +
      `Let's make sure our lab is safe and we have the right protection."`,
      { silent: true }
    );
  }, [isConnected, title, gradeBand, scenario, sendText]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTogglePPE = useCallback((ppe: string) => {
    setSelectedPPE(prev => {
      const next = new Set(prev);
      if (next.has(ppe)) {
        next.delete(ppe);
      } else {
        next.add(ppe);
      }
      return next;
    });
  }, []);

  const handleSubmitPPE = useCallback(() => {
    setPPESubmitted(true);

    const required = new Set(scenario.requiredPPE);
    const correctCount = Array.from(selectedPPE).filter(p => required.has(p)).length;
    const incorrectCount = Array.from(selectedPPE).filter(p => !required.has(p)).length;
    const missingCount = Array.from(required).filter(p => !selectedPPE.has(p)).length;
    const allCorrect = correctCount === required.size && incorrectCount === 0;

    setPPECorrectCount(correctCount);

    if (allCorrect) {
      sendText(
        `[PPE_CORRECT] Student selected all the right safety equipment! ` +
        `Celebrate: "Perfect! You chose exactly the right protection for this experiment."`,
        { silent: true }
      );
    } else {
      sendText(
        `[PPE_INCOMPLETE] Student selected ${correctCount}/${required.size} correct PPE. ` +
        `${incorrectCount} unnecessary items, ${missingCount} missing items. ` +
        `Missing: ${Array.from(required).filter(p => !selectedPPE.has(p)).join(', ')}. ` +
        `Guide: explain why each missing item is important for "${scenario.experiment}".`,
        { silent: true }
      );
    }
  }, [selectedPPE, scenario, sendText]);

  const handleHazardClick = useCallback((hazard: Hazard) => {
    setIdentifiedHazards(prev => new Set(prev).add(hazard.id));

    const remaining = scenario.hazards.length - identifiedHazards.size - 1;
    sendText(
      `[HAZARD_FOUND] Student found a ${hazard.severity} severity ${hazard.type} hazard: "${hazard.description}". ` +
      `Correction: "${hazard.correction}". ${remaining} hazards remaining. ` +
      `Praise: "Great catch! ${hazard.description} — that's a ${hazard.type} hazard. ${hazard.correction}"`,
      { silent: true }
    );

    if (remaining === 0) {
      sendText(
        `[ALL_HAZARDS_FOUND] Student found all ${scenario.hazards.length} hazards! ` +
        `${showTimer ? `Time: ${timerSeconds} seconds. ` : ''} ` +
        `Celebrate: "You found every hazard! You're a real safety detective!"`,
        { silent: true }
      );
    }
  }, [scenario, identifiedHazards.size, sendText, showTimer, timerSeconds]);

  const handleAddEmergencyStep = useCallback((step: string) => {
    setEmergencyOrder(prev => [...prev, step]);
    setEmergencyAvailable(prev => prev.filter(s => s !== step));
  }, []);

  const handleResetEmergency = useCallback(() => {
    setEmergencyOrder([]);
    if (emergencySequence) {
      setEmergencyAvailable([...emergencySequence.correctOrder].sort(() => Math.random() - 0.5));
    }
  }, [emergencySequence]);

  const handleSubmitEmergency = useCallback(() => {
    if (!emergencySequence) return;
    setEmergencySubmitted(true);

    const isCorrect = emergencyOrder.length === emergencySequence.correctOrder.length &&
      emergencyOrder.every((step, i) => step === emergencySequence.correctOrder[i]);

    setEmergencySequenceCorrect(isCorrect);

    if (isCorrect) {
      sendText(
        `[EMERGENCY_CORRECT] Student put the emergency steps in the right order! ` +
        `Celebrate: "Perfect sequence! In a real emergency, doing these steps in order could save someone."`,
        { silent: true }
      );
    } else {
      sendText(
        `[EMERGENCY_INCORRECT] Student's order doesn't match. ` +
        `Correct order: ${emergencySequence.correctOrder.join(' → ')}. ` +
        `Guide: "Close! Remember, the first thing you do is ${emergencySequence.correctOrder[0]}."`,
        { silent: true }
      );
    }
  }, [emergencySequence, emergencyOrder, sendText]);

  const handleSymbolMatch = useCallback((symbol: string, meaning: string) => {
    setMatchedSymbols(prev => new Map(prev).set(symbol, meaning));
    setSymbolsTotal(prev => prev + 1);

    const correct = ghsSymbols.find(s => s.symbol === symbol)?.meaning === meaning;
    if (correct) {
      setSymbolsMatchedCorrectly(prev => prev + 1);
    }
  }, [ghsSymbols]);

  const handleSubmitAnswer = useCallback(() => {
    if (!challengeAnswer.trim() || !currentChallenge) return;

    setCurrentAttempts(prev => prev + 1);
    setTotalAttempts(prev => prev + 1);

    const answer = challengeAnswer.trim().toLowerCase();
    const target = Array.isArray(currentChallenge.targetAnswer)
      ? currentChallenge.targetAnswer.map(t => t.toLowerCase())
      : [currentChallenge.targetAnswer.toLowerCase()];

    const isCorrect = target.some(t =>
      t.split('|').some(part => answer.includes(part.trim()))
    );

    if (isCorrect) {
      setFeedback('Correct! Safety first!');
      setFeedbackType('success');

      setChallengeResults(prev => [
        ...prev,
        { challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 },
      ]);

      if (currentChallenge.type === 'safety_quiz') {
        setSafetyQuizScore(prev => prev + 1);
        setQuizTotal(prev => prev + 1);
      } else if (currentChallenge.type === 'design_lab') {
        setLabDesignSafe(true);
      }

      sendText(
        `[ANSWER_CORRECT] Student answered "${challengeAnswer}" for ${currentChallenge.type}. ` +
        `Attempt ${currentAttempts + 1}. Congratulate!`,
        { silent: true }
      );
    } else {
      setFeedback(`Not quite. ${currentChallenge.hint}`);
      setFeedbackType('error');

      if (currentChallenge.type === 'safety_quiz') setQuizTotal(prev => prev + 1);

      sendText(
        `[ANSWER_INCORRECT] Student answered "${challengeAnswer}" but correct includes "${target.join(', ')}". ` +
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
        `[ALL_COMPLETE] Student finished all ${challenges.length} safety challenges! Celebrate!`,
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
            type: 'safety-lab',
            ppeSelectedCorrectly: ppeCorrectCount,
            ppeTotal: scenario.requiredPPE.length,
            hazardsIdentified: identifiedHazards.size,
            hazardsTotal: scenario.hazards.length,
            symbolsMatchedCorrectly,
            symbolsTotal,
            emergencySequenceCorrect,
            labDesignSafe,
            safetyQuizScore,
            quizTotal,
            responseTime: timerSeconds,
            attemptsCount: totalAttempts,
          },
          { challengeResults },
        );
      }
    }
  }, [
    currentChallengeIndex, challenges, sendText, hasSubmittedEvaluation, submitEvaluation,
    challengeResults, ppeCorrectCount, scenario, identifiedHazards.size, symbolsMatchedCorrectly,
    symbolsTotal, emergencySequenceCorrect, labDesignSafe, safetyQuizScore, quizTotal,
    timerSeconds, totalAttempts,
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
              <span className="text-2xl">{'\uD83E\uDD7D'}</span>
              {title}
            </CardTitle>
            {description && (
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500/20 text-red-300 border-red-400/30 text-xs">
              {gradeBand === 'K-2' ? 'Grade K-2' : gradeBand === '3-5' ? 'Grade 3-5' : 'Grade 6-8'}
            </Badge>
            {showTimer && (
              <Badge className="bg-slate-700/50 text-slate-300 border-white/10 text-xs font-mono">
                {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
              </Badge>
            )}
          </div>
        </div>

        {/* Scenario info */}
        <div className="bg-amber-500/10 rounded-lg p-2 border border-amber-400/20 mt-2">
          <p className="text-amber-200 text-xs font-medium">
            Scenario: {scenario.name} &mdash; {scenario.experiment}
          </p>
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

        {/* PPE Station */}
        {showPPEStation && (
          <>
            <PPEStation
              requiredPPE={scenario.requiredPPE}
              selectedPPE={selectedPPE}
              onTogglePPE={handleTogglePPE}
              submitted={ppeSubmitted}
            />
            {!ppeSubmitted && selectedPPE.size > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="bg-purple-500/20 border border-purple-400/30 hover:bg-purple-500/30 text-purple-300"
                  onClick={handleSubmitPPE}
                >
                  Check My PPE
                </Button>
              </div>
            )}
          </>
        )}

        {/* Lab Scene */}
        {showLabScene && (
          <LabScene
            hazards={scenario.hazards}
            identifiedIds={identifiedHazards}
            onHazardClick={handleHazardClick}
            sceneName={scenario.name}
          />
        )}

        {/* Safety Equipment stations */}
        {showEmergencyStations && scenario.safetyEquipment.length > 0 && (
          <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
            <span className="text-slate-300 text-sm font-medium mb-2 block">Safety Equipment</span>
            <div className="flex flex-wrap gap-2">
              {scenario.safetyEquipment.map(eq => (
                <Badge key={eq} className="bg-blue-500/10 text-blue-300 border-blue-400/20 text-xs">
                  {SAFETY_EQUIPMENT_ICONS[eq] || '\u2705'} {eq.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* GHS Symbols */}
        {showGHSSymbols && ghsSymbols.length > 0 && (
          <GHSSymbolsDisplay
            symbols={ghsSymbols}
            matchedSymbols={matchedSymbols}
            onMatch={handleSymbolMatch}
          />
        )}

        {/* Emergency Sequence */}
        {emergencySequence && (
          <>
            <EmergencySequencer
              scenario={emergencySequence.scenario}
              correctOrder={emergencySequence.correctOrder}
              userOrder={emergencyOrder}
              availableSteps={emergencyAvailable}
              onAddStep={handleAddEmergencyStep}
              onReset={handleResetEmergency}
              submitted={emergencySubmitted}
            />
            {!emergencySubmitted && emergencyAvailable.length === 0 && emergencyOrder.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  className="bg-amber-500/20 border border-amber-400/30 hover:bg-amber-500/30 text-amber-300"
                  onClick={handleSubmitEmergency}
                >
                  Check My Order
                </Button>
              </div>
            )}
          </>
        )}

        {/* Challenge answer area (for quiz/text-based challenges) */}
        {currentChallenge && !isCurrentChallengeComplete &&
         !['equip_ppe', 'spot_hazard', 'emergency_response'].includes(currentChallenge.type) && (
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
              Why is lab safety important?
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 text-slate-400 text-sm">
                <p>
                  Science is amazing &mdash; but it can also be dangerous if we don&rsquo;t follow safety rules.
                  <span className="text-slate-200 font-medium"> Safety equipment</span> like goggles and gloves
                  protect us from chemicals, heat, and sharp objects.
                </p>
                <p>
                  <span className="text-amber-300 font-medium">Hazard symbols</span> on chemical labels warn us
                  about dangers. Learning to read them is like learning a safety language that could save your life!
                </p>
                <p>
                  In an <span className="text-red-300 font-medium">emergency</span>, knowing the right steps &mdash;
                  and doing them in order &mdash; can make all the difference. That&rsquo;s why we practice!
                </p>
                {gradeBand === '6-8' && (
                  <p>
                    <span className="text-slate-200 font-medium">Safety Data Sheets (SDS)</span> contain detailed information
                    about every chemical in the lab: hazards, first aid, proper disposal, and more. Every lab keeps them accessible.
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Completion summary */}
        {allChallengesComplete && (
          <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-400/20">
            <p className="text-emerald-300 font-bold text-lg mb-2">Safety Training Complete!</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">PPE Selection:</div>
              <div className="text-slate-200 font-mono">{ppeCorrectCount} / {scenario.requiredPPE.length}</div>
              <div className="text-slate-400">Hazards Found:</div>
              <div className="text-slate-200 font-mono">{identifiedHazards.size} / {scenario.hazards.length}</div>
              {ghsSymbols.length > 0 && (
                <>
                  <div className="text-slate-400">Symbols Matched:</div>
                  <div className="text-slate-200 font-mono">{symbolsMatchedCorrectly} / {symbolsTotal}</div>
                </>
              )}
              {emergencySequence && (
                <>
                  <div className="text-slate-400">Emergency Sequence:</div>
                  <div className="text-slate-200">{emergencySequenceCorrect ? 'Correct!' : 'Needs practice'}</div>
                </>
              )}
              {showTimer && (
                <>
                  <div className="text-slate-400">Response Time:</div>
                  <div className="text-slate-200 font-mono">{timerSeconds}s</div>
                </>
              )}
              <div className="text-slate-400">Total Attempts:</div>
              <div className="text-slate-200 font-mono">{totalAttempts}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SafetyLab;
