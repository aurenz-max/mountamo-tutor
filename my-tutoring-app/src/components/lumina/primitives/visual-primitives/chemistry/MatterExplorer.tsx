'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatterExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface MatterObject {
  id: string;
  name: string;
  state: 'solid' | 'liquid' | 'gas';
  properties: {
    color: string;
    texture: 'smooth' | 'rough' | 'bumpy' | 'soft' | 'hard';
    transparency: 'transparent' | 'translucent' | 'opaque';
    flexibility: 'rigid' | 'flexible' | 'flows';
    shape: 'keeps_shape' | 'takes_container' | 'fills_space';
    weight: 'light' | 'medium' | 'heavy';
  };
  imagePrompt?: string;
  canChangeState: boolean;
  stateChangeTemp?: number | null;
}

export interface MatterChallenge {
  id: string;
  type: 'sort' | 'describe' | 'predict' | 'mystery' | 'compare';
  instruction: string;
  targetAnswer: string | string[];
  hint: string;
  narration: string;
}

export interface MatterExplorerData {
  title: string;
  description?: string;
  objects: MatterObject[];
  challenges: MatterChallenge[];
  showOptions?: {
    showPropertyPanel?: boolean;
    showTemperatureSlider?: boolean;
    showParticleView?: boolean;
    showVennDiagram?: boolean;
  };
  gradeBand?: 'K-1' | '1-2';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MatterExplorerMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATE_CONFIG = {
  solid: {
    label: 'Solid',
    emoji: '🧊',
    color: 'slate',
    bgClass: 'bg-slate-500/10 border-slate-400/30',
    activeClass: 'bg-slate-500/20 border-slate-400/50',
    textClass: 'text-slate-300',
    glowClass: 'shadow-[0_0_15px_rgba(148,163,184,0.15)]',
    description: 'Keeps its own shape',
  },
  liquid: {
    label: 'Liquid',
    emoji: '💧',
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-400/30',
    activeClass: 'bg-blue-500/20 border-blue-400/50',
    textClass: 'text-blue-300',
    glowClass: 'shadow-[0_0_15px_rgba(96,165,250,0.15)]',
    description: 'Takes the shape of its container',
  },
  gas: {
    label: 'Gas',
    emoji: '💨',
    color: 'cyan',
    bgClass: 'bg-cyan-500/10 border-cyan-400/30',
    activeClass: 'bg-cyan-500/20 border-cyan-400/50',
    textClass: 'text-cyan-300',
    glowClass: 'shadow-[0_0_15px_rgba(103,232,249,0.15)]',
    description: 'Fills all the space it can',
  },
} as const;

type MatterState = keyof typeof STATE_CONFIG;

const OBJECT_EMOJIS: Record<string, string> = {
  'ice cube': '🧊', 'ice': '🧊', 'rock': '🪨', 'water': '💧',
  'juice': '🧃', 'balloon': '🎈', 'steam': '♨️', 'milk': '🥛',
  'air': '🌬️', 'sand': '⏳', 'honey': '🍯', 'fog': '🌫️',
  'wood': '🪵', 'brick': '🧱', 'oil': '🫗', 'smoke': '💨',
  'glass': '🪟', 'metal': '🔩', 'rubber': '🔴', 'cotton': '☁️',
  'gold': '🥇', 'mercury': '🌡️', 'helium': '🎈', 'paper': '📄',
  'apple': '🍎', 'chocolate': '🍫', 'butter': '🧈', 'soap': '🧼',
  'toothpaste': '🪥', 'clay': '🏺', 'snow': '❄️', 'rain': '🌧️',
};

function getObjectEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(OBJECT_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '⬤';
}

const PROPERTY_LABELS: Record<string, Record<string, string>> = {
  texture: { smooth: 'Smooth', rough: 'Rough', bumpy: 'Bumpy', soft: 'Soft', hard: 'Hard' },
  transparency: { transparent: 'See-through', translucent: 'A little see-through', opaque: 'Can\'t see through' },
  flexibility: { rigid: 'Stiff', flexible: 'Bendy', flows: 'Flows' },
  shape: { keeps_shape: 'Keeps its shape', takes_container: 'Takes container shape', fills_space: 'Fills all space' },
  weight: { light: 'Light', medium: 'Medium', heavy: 'Heavy' },
};

// ============================================================================
// Props
// ============================================================================

interface MatterExplorerProps {
  data: MatterExplorerData;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

const MatterExplorer: React.FC<MatterExplorerProps> = ({ data, className }) => {
  const {
    title,
    description,
    objects = [],
    challenges = [],
    showOptions = {},
    gradeBand = 'K-1',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    showPropertyPanel = true,
    showTemperatureSlider = false,
  } = showOptions;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  // Sorting bins: objectId -> placed state
  const [sortedObjects, setSortedObjects] = useState<Record<string, MatterState>>({});
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);

  // Challenge tracking
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [currentAttempts, setCurrentAttempts] = useState(0);

  // Temperature slider
  const [temperature, setTemperature] = useState(20);

  // Mystery mode
  const [mysteryGuess, setMysteryGuess] = useState('');

  // Tracking
  const [sortingCorrect, setSortingCorrect] = useState(0);
  const [sortingTotal, setSortingTotal] = useState(0);
  const [propertiesIdentified, setPropertiesIdentified] = useState(0);
  const [propertiesTotal] = useState(() =>
    objects.reduce((sum, obj) => sum + Object.keys(obj.properties).length, 0)
  );
  const [stateChangePredicted, setStateChangePredicted] = useState(false);
  const [mysteryMaterialsSolved, setMysteryMaterialsSolved] = useState(0);
  const [mysteryTotal] = useState(() =>
    challenges.filter(c => c.type === 'mystery').length
  );
  const [trickyMaterialsExplored, setTrickyMaterialsExplored] = useState(0);
  const [temperatureSliderUsed, setTemperatureSliderUsed] = useState(false);
  const [viewedProperties, setViewedProperties] = useState<Set<string>>(new Set());
  const [challengeResults, setChallengeResults] = useState<Array<{
    challengeId: string;
    correct: boolean;
    attempts: number;
  }>>([]);

  // Refs
  const stableInstanceIdRef = useRef(instanceId || `matter-explorer-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const currentChallenge = challenges[currentChallengeIndex] || null;
  const allChallengesComplete = challenges.length > 0 &&
    challengeResults.filter(r => r.correct).length >= challenges.length;
  const isCurrentChallengeComplete = challengeResults.some(
    r => r.challengeId === currentChallenge?.id && r.correct
  );

  // -------------------------------------------------------------------------
  // Evaluation Hook
  // -------------------------------------------------------------------------
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
  } = usePrimitiveEvaluation<MatterExplorerMetrics>({
    primitiveType: 'matter-explorer',
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
    totalObjects: objects.length,
    totalChallenges: challenges.length,
    currentChallengeIndex,
    challengeType: currentChallenge?.type ?? 'sort',
    instruction: currentChallenge?.instruction ?? 'Explore matter',
    sortedCount: Object.keys(sortedObjects).length,
    selectedObject: selectedObjectId
      ? objects.find(o => o.id === selectedObjectId)?.name ?? null
      : null,
    temperature,
    attemptNumber: currentAttempts + 1,
  }), [
    gradeBand, objects.length, challenges.length, currentChallengeIndex,
    currentChallenge, sortedObjects, selectedObjectId, objects, temperature, currentAttempts,
  ]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'matter-explorer',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K-1' ? 'Kindergarten' : 'Grade 1-2',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;

    const objectNames = objects.slice(0, 4).map(o => o.name).join(', ');
    sendText(
      `[ACTIVITY_START] This is a Matter Explorer activity for ${gradeBand === 'K-1' ? 'Kindergarten' : 'Grades 1-2'}. `
      + `Objects: ${objectNames}${objects.length > 4 ? ` and ${objects.length - 4} more` : ''}. `
      + `${challenges.length} challenges about states of matter. `
      + `First challenge: "${currentChallenge?.instruction}". `
      + `Introduce warmly: "Let's explore what stuff is made of! Look at all these interesting things. Can you tell which ones are solid, liquid, or gas?"`,
      { silent: true }
    );
  }, [isConnected, challenges.length, objects, gradeBand, currentChallenge, sendText]);

  // -------------------------------------------------------------------------
  // Drag & Drop Handlers
  // -------------------------------------------------------------------------
  const handleDragStart = useCallback((objectId: string) => {
    if (hasSubmittedEvaluation) return;
    setDraggedObjectId(objectId);
  }, [hasSubmittedEvaluation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((state: MatterState) => {
    if (!draggedObjectId || hasSubmittedEvaluation) return;

    const obj = objects.find(o => o.id === draggedObjectId);
    if (!obj) return;

    setSortedObjects(prev => ({ ...prev, [draggedObjectId]: state }));
    setSortingTotal(prev => prev + 1);

    const isCorrect = obj.state === state;
    if (isCorrect) {
      setSortingCorrect(prev => prev + 1);
      setFeedback(`Yes! ${obj.name} is a ${state}!`);
      setFeedbackType('success');
      sendText(
        `[SORT_CORRECT] Student correctly sorted "${obj.name}" as ${state}. `
        + `Celebrate briefly: "That's right! ${obj.name} is a ${state}!"`,
        { silent: true }
      );
    } else {
      setFeedback(`Hmm, is ${obj.name} really a ${state}? Think about its shape.`);
      setFeedbackType('error');

      // Check if this is a "tricky" material
      const trickyMaterials = ['honey', 'sand', 'toothpaste', 'clay', 'fog', 'jelly'];
      if (trickyMaterials.some(t => obj.name.toLowerCase().includes(t))) {
        setTrickyMaterialsExplored(prev => prev + 1);
      }

      sendText(
        `[SORT_INCORRECT] Student put "${obj.name}" (correct: ${obj.state}) in the ${state} bin. `
        + `Guide gently: "Hmm, let's think about ${obj.name}. Does it keep its own shape? Does it flow? Does it fill all the space?"`,
        { silent: true }
      );
    }

    setDraggedObjectId(null);
  }, [draggedObjectId, hasSubmittedEvaluation, objects, sendText]);

  // -------------------------------------------------------------------------
  // Object Selection & Properties
  // -------------------------------------------------------------------------
  const handleSelectObject = useCallback((objectId: string) => {
    setSelectedObjectId(prev => prev === objectId ? null : objectId);

    if (objectId) {
      const obj = objects.find(o => o.id === objectId);
      if (obj) {
        const newViewed = new Set(viewedProperties);
        Object.keys(obj.properties).forEach(key => {
          newViewed.add(`${objectId}-${key}`);
        });
        const newCount = newViewed.size;
        if (newCount > viewedProperties.size) {
          setPropertiesIdentified(newCount);
        }
        setViewedProperties(newViewed);

        sendText(
          `[OBJECT_SELECTED] Student is examining "${obj.name}" (${obj.state}). `
          + `Properties: ${obj.properties.texture}, ${obj.properties.shape}. `
          + `Ask an observation question: "What do you notice about ${obj.name}? Is it hard or soft?"`,
          { silent: true }
        );
      }
    }
  }, [objects, viewedProperties, sendText]);

  // -------------------------------------------------------------------------
  // Temperature Slider
  // -------------------------------------------------------------------------
  const handleTemperatureChange = useCallback((newTemp: number) => {
    setTemperature(newTemp);
    if (!temperatureSliderUsed) setTemperatureSliderUsed(true);

    // Check for state changes in objects
    objects.forEach(obj => {
      if (obj.canChangeState && obj.stateChangeTemp != null) {
        if (Math.abs(newTemp - obj.stateChangeTemp) < 3) {
          sendText(
            `[STATE_CHANGE] Temperature near ${newTemp}°C. "${obj.name}" changes state around ${obj.stateChangeTemp}°C. `
            + `Narrate: "Look! The ${obj.name} is changing! Can you see what's happening?"`,
            { silent: true }
          );
        }
      }
    });
  }, [temperatureSliderUsed, objects, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Checking
  // -------------------------------------------------------------------------
  const handleCheckSortChallenge = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'sort') return;

    const allSorted = objects.every(obj => sortedObjects[obj.id] !== undefined);
    if (!allSorted) {
      setFeedback('Sort all the objects into bins first!');
      setFeedbackType('error');
      return;
    }

    const allCorrect = objects.every(obj => sortedObjects[obj.id] === obj.state);
    setCurrentAttempts(a => a + 1);

    if (allCorrect) {
      setFeedback('Amazing! You sorted everything correctly!');
      setFeedbackType('success');
      setChallengeResults(prev => [...prev, {
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      }]);
      sendText(
        `[ANSWER_CORRECT] Student sorted all ${objects.length} objects correctly! `
        + `Celebrate: "Wow, you know your solids, liquids, and gases!"`,
        { silent: true }
      );
    } else {
      const wrongCount = objects.filter(obj => sortedObjects[obj.id] !== obj.state).length;
      setFeedback(`${wrongCount} ${wrongCount === 1 ? 'object is' : 'objects are'} in the wrong bin. Try again!`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] ${wrongCount} objects in wrong bins. Attempt ${currentAttempts + 1}. `
        + `Give a hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [currentChallenge, objects, sortedObjects, currentAttempts, sendText]);

  const handleCheckPredictChallenge = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'predict') return;

    setCurrentAttempts(a => a + 1);
    // For predict challenges, acceptance is more flexible
    setStateChangePredicted(true);
    setFeedback('Great prediction! Let\'s see what happens...');
    setFeedbackType('success');
    setChallengeResults(prev => [...prev, {
      challengeId: currentChallenge.id,
      correct: true,
      attempts: currentAttempts + 1,
    }]);
    sendText(
      `[PREDICTION_MADE] Student made a prediction about state change. `
      + `Celebrate curiosity: "Great thinking! Let's test your prediction with the temperature slider."`,
      { silent: true }
    );
  }, [currentChallenge, currentAttempts, sendText]);

  const handleCheckMysteryChallenge = useCallback(() => {
    if (!currentChallenge || currentChallenge.type !== 'mystery') return;
    if (!mysteryGuess.trim()) return;

    setCurrentAttempts(a => a + 1);
    const target = Array.isArray(currentChallenge.targetAnswer)
      ? currentChallenge.targetAnswer
      : [currentChallenge.targetAnswer];
    const correct = target.some(t =>
      mysteryGuess.toLowerCase().trim().includes(t.toLowerCase())
    );

    if (correct) {
      setFeedback(`Yes! It was ${target[0]}! Great detective work!`);
      setFeedbackType('success');
      setMysteryMaterialsSolved(prev => prev + 1);
      setChallengeResults(prev => [...prev, {
        challengeId: currentChallenge.id,
        correct: true,
        attempts: currentAttempts + 1,
      }]);
      sendText(
        `[MYSTERY_SOLVED] Student correctly identified the mystery material as "${target[0]}". `
        + `Celebrate: "You figured it out! The clues told you it was ${target[0]}!"`,
        { silent: true }
      );
    } else {
      setFeedback('Not quite! Read the clues again carefully.');
      setFeedbackType('error');
      sendText(
        `[MYSTERY_INCORRECT] Student guessed "${mysteryGuess}" but answer is "${target[0]}". `
        + `Hint: "${currentChallenge.hint}"`,
        { silent: true }
      );
    }
  }, [currentChallenge, mysteryGuess, currentAttempts, sendText]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    switch (currentChallenge.type) {
      case 'sort': handleCheckSortChallenge(); break;
      case 'predict': handleCheckPredictChallenge(); break;
      case 'mystery': handleCheckMysteryChallenge(); break;
      case 'describe':
        // Describe challenges complete when properties have been viewed
        if (viewedProperties.size > 0) {
          setFeedback('Great observations!');
          setFeedbackType('success');
          setChallengeResults(prev => [...prev, {
            challengeId: currentChallenge.id,
            correct: true,
            attempts: 1,
          }]);
          sendText(
            `[DESCRIBE_COMPLETE] Student examined properties. Celebrate their observations.`,
            { silent: true }
          );
        }
        break;
      default: break;
    }
  }, [currentChallenge, handleCheckSortChallenge, handleCheckPredictChallenge,
    handleCheckMysteryChallenge, viewedProperties.size, sendText]);

  // -------------------------------------------------------------------------
  // Challenge Navigation
  // -------------------------------------------------------------------------
  const advanceToNextChallenge = useCallback(() => {
    const nextIndex = currentChallengeIndex + 1;

    if (nextIndex >= challenges.length) {
      sendText(
        `[ALL_COMPLETE] Student completed all ${challenges.length} challenges! `
        + `Celebrate: "You're a matter expert! You know all about solids, liquids, and gases!"`,
        { silent: true }
      );

      // Submit evaluation
      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter(r => r.correct).length;
        const score = challenges.length > 0
          ? Math.round((correctCount / challenges.length) * 100) : 0;

        const metrics: MatterExplorerMetrics = {
          type: 'matter-explorer',
          sortingCorrect,
          sortingTotal,
          propertiesIdentified,
          propertiesTotal,
          stateChangePredicted,
          mysteryMaterialsSolved,
          mysteryTotal,
          trickyMaterialsExplored,
          temperatureSliderUsed,
          particleViewEngaged: false,
          attemptsCount: challengeResults.reduce((s, r) => s + r.attempts, 0),
        };

        submitEvaluation(
          correctCount === challenges.length,
          score,
          metrics,
          { challengeResults, sortedObjects }
        );
      }
      return;
    }

    // Reset for next challenge
    setCurrentChallengeIndex(nextIndex);
    setCurrentAttempts(0);
    setFeedback('');
    setFeedbackType('');
    setMysteryGuess('');
    if (challenges[nextIndex]?.type === 'sort') {
      setSortedObjects({});
    }

    sendText(
      `[NEXT_ITEM] Moving to challenge ${nextIndex + 1} of ${challenges.length}: `
      + `"${challenges[nextIndex]?.instruction}". Introduce it to the student.`,
      { silent: true }
    );
  }, [
    currentChallengeIndex, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, sortingCorrect, sortingTotal, propertiesIdentified,
    propertiesTotal, stateChangePredicted, mysteryMaterialsSolved, mysteryTotal,
    trickyMaterialsExplored, temperatureSliderUsed, submitEvaluation, sortedObjects,
  ]);

  // -------------------------------------------------------------------------
  // Derived State
  // -------------------------------------------------------------------------
  const selectedObject = useMemo(() =>
    objects.find(o => o.id === selectedObjectId) ?? null,
    [objects, selectedObjectId]
  );

  // Compute current state of objects based on temperature
  const objectStates = useMemo(() => {
    return objects.map(obj => {
      if (!obj.canChangeState || obj.stateChangeTemp == null) return obj.state;
      if (obj.state === 'solid' && temperature > obj.stateChangeTemp) return 'liquid' as MatterState;
      if (obj.state === 'liquid' && temperature > (obj.stateChangeTemp + 30)) return 'gas' as MatterState;
      return obj.state;
    });
  }, [objects, temperature]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300 text-xs">
              {gradeBand === 'K-1' ? 'Kindergarten' : 'Grades 1-2'}
            </Badge>
            {currentChallenge && (
              <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300 text-xs">
                {currentChallenge.type}
              </Badge>
            )}
          </div>
        </div>
        {description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Challenge Progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2">
            {challenges.map((c, i) => (
              <div
                key={c.id}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  challengeResults.some(r => r.challengeId === c.id && r.correct)
                    ? 'bg-emerald-400'
                    : i === currentChallengeIndex
                      ? 'bg-cyan-400 scale-125'
                      : 'bg-slate-600'
                }`}
              />
            ))}
            <span className="text-slate-500 text-xs ml-auto">
              Challenge {Math.min(currentChallengeIndex + 1, challenges.length)} of {challenges.length}
            </span>
          </div>
        )}

        {/* Instruction */}
        {currentChallenge && !allChallengesComplete && (
          <div className="bg-slate-800/30 rounded-lg p-3 border border-white/5">
            <p className="text-slate-200 text-sm font-medium">
              {currentChallenge.instruction}
            </p>
          </div>
        )}

        {/* Object Gallery */}
        {(!currentChallenge || currentChallenge.type !== 'mystery') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {objects.map((obj, idx) => {
              const placed = sortedObjects[obj.id];
              const currentState = objectStates[idx];
              const stateConf = STATE_CONFIG[currentState];
              const isSelected = selectedObjectId === obj.id;
              const emoji = getObjectEmoji(obj.name);

              return (
                <div
                  key={obj.id}
                  draggable={!placed && !hasSubmittedEvaluation}
                  onDragStart={() => handleDragStart(obj.id)}
                  onClick={() => handleSelectObject(obj.id)}
                  className={`
                    relative rounded-lg border p-3 text-center cursor-pointer
                    transition-all duration-300 select-none
                    ${placed
                      ? `${STATE_CONFIG[placed].bgClass} opacity-50`
                      : isSelected
                        ? `${stateConf.activeClass} ${stateConf.glowClass} scale-105`
                        : `bg-white/5 border-white/10 hover:bg-white/10 hover:scale-105`
                    }
                  `}
                >
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="text-slate-200 text-xs font-medium truncate">{obj.name}</div>
                  {placed && (
                    <Badge className={`absolute -top-1.5 -right-1.5 text-[10px] px-1.5 py-0 ${STATE_CONFIG[placed].bgClass} ${STATE_CONFIG[placed].textClass}`}>
                      {STATE_CONFIG[placed].label}
                    </Badge>
                  )}
                  {obj.canChangeState && showTemperatureSlider && currentState !== obj.state && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] text-amber-400">Changed!</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Sorting Bins */}
        {currentChallenge?.type === 'sort' && !isCurrentChallengeComplete && (
          <div className="grid grid-cols-3 gap-3">
            {(['solid', 'liquid', 'gas'] as MatterState[]).map(state => {
              const conf = STATE_CONFIG[state];
              const objectsInBin = objects.filter(o => sortedObjects[o.id] === state);
              const isDragOver = draggedObjectId !== null;

              return (
                <div
                  key={state}
                  onDragOver={handleDragOver}
                  onDrop={(e) => { e.preventDefault(); handleDrop(state); }}
                  className={`
                    rounded-xl border-2 border-dashed p-3 min-h-[100px]
                    transition-all duration-300 text-center
                    ${isDragOver ? conf.activeClass : conf.bgClass}
                  `}
                >
                  <div className="text-lg mb-1">{conf.emoji}</div>
                  <div className={`text-sm font-medium mb-1 ${conf.textClass}`}>
                    {conf.label}
                  </div>
                  <div className="text-slate-500 text-[10px] mb-2">
                    {conf.description}
                  </div>
                  {objectsInBin.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center">
                      {objectsInBin.map(obj => (
                        <span
                          key={obj.id}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            obj.state === state
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {getObjectEmoji(obj.name)} {obj.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mystery Challenge */}
        {currentChallenge?.type === 'mystery' && !isCurrentChallengeComplete && (
          <div className="bg-slate-800/30 rounded-xl p-4 border border-cyan-500/20">
            <div className="text-center mb-3">
              <span className="text-3xl">🔍</span>
              <p className="text-slate-300 text-sm mt-2">What material am I?</p>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input
                type="text"
                value={mysteryGuess}
                onChange={e => setMysteryGuess(e.target.value)}
                placeholder="Type your guess..."
                className="flex-1 px-3 py-2 bg-slate-800/50 border border-white/20 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-cyan-400/50 placeholder:text-slate-600"
                onKeyDown={e => e.key === 'Enter' && handleCheckAnswer()}
              />
            </div>
          </div>
        )}

        {/* Property Panel */}
        {showPropertyPanel && selectedObject && (
          <div className="bg-slate-800/20 rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{getObjectEmoji(selectedObject.name)}</span>
              <span className="text-slate-200 text-sm font-medium">{selectedObject.name}</span>
              <Badge className={`text-[10px] ${STATE_CONFIG[selectedObject.state].bgClass} ${STATE_CONFIG[selectedObject.state].textClass}`}>
                {STATE_CONFIG[selectedObject.state].label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(selectedObject.properties).map(([key, value]) => (
                <div
                  key={key}
                  className="bg-white/5 rounded-md px-2 py-1 text-xs"
                >
                  <span className="text-slate-500 capitalize">{key}: </span>
                  <span className="text-slate-300">
                    {PROPERTY_LABELS[key]?.[value] ?? value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Temperature Slider */}
        {showTemperatureSlider && (
          <div className="bg-slate-800/20 rounded-xl p-3 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-xs">Temperature</span>
              <span className={`text-sm font-mono font-medium ${
                temperature < 0 ? 'text-blue-400' :
                temperature > 100 ? 'text-red-400' :
                'text-slate-200'
              }`}>
                {temperature}°C
              </span>
            </div>
            <input
              type="range"
              min={-20}
              max={120}
              value={temperature}
              onChange={e => handleTemperatureChange(parseInt(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer
                bg-gradient-to-r from-blue-500 via-slate-400 to-red-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>Freezing</span>
              <span>Room Temp</span>
              <span>Boiling</span>
            </div>
          </div>
        )}

        {/* Feedback */}
        {feedback && (
          <div className={`text-center text-sm font-medium transition-all duration-300 ${
            feedbackType === 'success' ? 'text-emerald-400' :
            feedbackType === 'error' ? 'text-red-400' :
            'text-slate-300'
          }`}>
            {feedback}
          </div>
        )}

        {/* Action Buttons */}
        {challenges.length > 0 && (
          <div className="flex justify-center gap-3">
            {!isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                onClick={handleCheckAnswer}
                disabled={hasSubmittedEvaluation}
              >
                Check Answer
              </Button>
            )}
            {isCurrentChallengeComplete && !allChallengesComplete && (
              <Button
                variant="ghost"
                className="bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/20 text-emerald-300"
                onClick={advanceToNextChallenge}
              >
                Next Challenge
              </Button>
            )}
            {allChallengesComplete && (
              <div className="text-center">
                <p className="text-emerald-400 text-sm font-medium mb-2">
                  All challenges complete!
                </p>
                <p className="text-slate-400 text-xs">
                  {challengeResults.filter(r => r.correct).length} / {challenges.length} correct
                </p>
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        {currentChallenge?.hint && feedbackType === 'error' && currentAttempts >= 2 && (
          <div className="bg-slate-800/20 rounded-lg p-2 border border-white/5 text-center">
            <p className="text-slate-400 text-xs italic">{currentChallenge.hint}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MatterExplorer;
