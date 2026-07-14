'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPrompt,
  LuminaInput,
  LuminaModeTabs,
  LuminaChallengeCounter,
  LuminaActionButton,
  LuminaFeedbackCard,
  answerStateClass,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AdditionSubtractionSceneMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface AddSubChallenge {
  id: string;
  type: 'act-out' | 'build-equation' | 'solve-story' | 'create-story';
  instruction: string;
  storyText: string;
  scene: 'pond' | 'farm' | 'playground' | 'space' | 'kitchen' | 'garden';
  objectType: string;
  operation: 'addition' | 'subtraction';
  storyType: 'join' | 'separate' | 'compare' | 'part-whole';
  startCount: number;
  changeCount: number;
  resultCount: number;
  equation: string;
  unknownPosition?: 'result' | 'change' | 'start';
  /**
   * Support-tier lever (build-equation): when present, the equation tray shows ONLY
   * these number tiles (operators are always appended). Withdraws the "discriminate
   * the right numbers from distractors" challenge. Absent = full 0…maxNumber tray.
   * Never changes the target equation — only how many candidate numbers are offered.
   */
  allowedTiles?: string[];
}

export interface AdditionSubtractionSceneData {
  title: string;
  description?: string;
  challenges: AddSubChallenge[];
  maxNumber: number;
  showTenFrame: boolean;
  showEquationBar: boolean;
  gradeBand: 'K' | '1';

  /**
   * Support-tier levers (act-out). Scaffolding-only — never change the numbers.
   * - showCountBadges: tapping an object stamps its running ordinal (1,2,3…) so the
   *   scene tracks the count. Off = the student must hold the count mentally.
   * - groupedReveal: the "change" objects animate in separately from the "start" group
   *   so the join/separation is visible. Off = all objects appear together (must segment).
   */
  showCountBadges?: boolean;
  groupedReveal?: boolean;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AdditionSubtractionSceneMetrics>) => void;
}

// ============================================================================
// Constants
// ============================================================================

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  'act-out':        { label: 'Act Out',        icon: '🎭', accentColor: 'orange' },
  'build-equation': { label: 'Build Equation', icon: '🧩', accentColor: 'purple' },
  'solve-story':    { label: 'Solve Story',    icon: '📖', accentColor: 'blue' },
  'create-story':   { label: 'Create Story',   icon: '✨', accentColor: 'emerald' },
};

const SCENE_BACKGROUNDS: Record<string, { gradient: string; label: string }> = {
  pond:       { gradient: 'from-cyan-900/40 to-blue-900/40',    label: 'Pond' },
  farm:       { gradient: 'from-green-900/40 to-yellow-900/40', label: 'Farm' },
  playground: { gradient: 'from-amber-900/40 to-orange-900/40', label: 'Playground' },
  space:      { gradient: 'from-indigo-900/40 to-purple-900/40', label: 'Space' },
  kitchen:    { gradient: 'from-rose-900/40 to-orange-900/40',  label: 'Kitchen' },
  garden:     { gradient: 'from-emerald-900/40 to-lime-900/40', label: 'Garden' },
};

const OBJECT_EMOJI: Record<string, string> = {
  ducks: '🦆', frogs: '🐸', apples: '🍎', birds: '🐦', fish: '🐟',
  butterflies: '🦋', dogs: '🐶', cats: '🐱', stars: '⭐', flowers: '🌸',
  cookies: '🍪', cupcakes: '🧁', rockets: '🚀', bunnies: '🐰',
};

const EQUATION_TILES = ['0','1','2','3','4','5','6','7','8','9','10','+','-','='];

const SCENE_WIDTH = 480;
const SCENE_HEIGHT = 220;
const OBJ_SIZE = 38;

// ============================================================================
// Helpers
// ============================================================================

function getEmoji(objectType: string): string {
  return OBJECT_EMOJI[objectType] || '⭐';
}

/**
 * The spoken ORIENT / STIMULUS line for one challenge (reader-fit Audit B). Story
 * challenges are read verbatim; the K "build the story" create-story task has NO
 * story text — the EQUATION is the prompt — so the tutor reads the number sentence
 * aloud and cues the build, rather than cold-starting on an empty string.
 */
function orientLineForChallenge(ch: AddSubChallenge): string {
  if (ch.type === 'create-story') {
    const build = ch.operation === 'addition'
      ? `start with an empty ${ch.scene} and help them add ${ch.objectType} to show ${ch.startCount} and ${ch.changeCount} more (${ch.resultCount} in all)`
      : `there are ${ch.startCount} ${ch.objectType} already; help them send ${ch.changeCount} away so ${ch.resultCount} are left`;
    return `This is a BUILD-the-story challenge — the child MAKES the story for the number sentence ${ch.equation}. There is NO story text; the equation IS the prompt. Read the number sentence aloud warmly, then tell them what to build: ${build}.`;
  }
  return `read this story aloud, word for word: "${ch.storyText}". Do not skip it or replace it with a bare greeting. THEN, in one short warm sentence, tell them what to do: ${ch.instruction}`;
}

/** Deterministic scattered positions for scene objects */
function scenePositions(count: number, seed: number = 7): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
  const padX = 30;
  const padY = 30;
  for (let i = 0; i < count; i++) {
    let bestX = padX + rand() * (SCENE_WIDTH - 2 * padX);
    let bestY = padY + rand() * (SCENE_HEIGHT - 2 * padY);
    for (let a = 0; a < 20; a++) {
      const x = padX + rand() * (SCENE_WIDTH - 2 * padX);
      const y = padY + rand() * (SCENE_HEIGHT - 2 * padY);
      let tooClose = false;
      for (const p of positions) {
        if (Math.hypot(x - p.x, y - p.y) < OBJ_SIZE + 6) { tooClose = true; break; }
      }
      if (!tooClose) { bestX = x; bestY = y; break; }
    }
    positions.push({ x: bestX, y: bestY });
  }
  return positions;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Tap-to-choose number row (reader-fit PRE band-gate, rule 6 "no typing").
 * At Kindergarten, act-out/solve-story answer via a numeral — a pre-reader must
 * NOT type it on a keyboard. This renders 0…max as big tappable tiles; tapping one
 * IS the atomic answer (tap = choose, no Check button). Grade 1 keeps the input.
 */
const NumberTileRow: React.FC<{ max: number; onPick: (n: number) => void; disabled?: boolean }> = ({ max, onPick, disabled }) => {
  const tiles = Array.from({ length: Math.max(0, max) + 1 }, (_, n) => n);
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Choose the number">
      {tiles.map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onPick(n)}
          aria-label={`${n}`}
          className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-400/25 border-2 border-amber-300/40 text-2xl font-bold text-amber-100 shadow-sm transition active:scale-95 hover:from-amber-400/40 hover:to-orange-400/40 disabled:opacity-40 disabled:pointer-events-none"
        >
          {n}
        </button>
      ))}
    </div>
  );
};

/** Ten-frame visual helper */
const TenFrameHelper: React.FC<{ filled: number; max?: number }> = ({ filled, max = 10 }) => {
  const cells = Array.from({ length: max }, (_, i) => i < filled);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="grid grid-cols-5 gap-0.5">
        {cells.map((on, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded border ${
              on ? 'bg-amber-400/60 border-amber-400/80' : 'bg-slate-800/30 border-white/10'
            }`}
          />
        ))}
      </div>
      <span className="text-slate-500 text-[10px] mt-0.5">ten frame</span>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

interface AdditionSubtractionSceneProps {
  data: AdditionSubtractionSceneData;
  className?: string;
}

const AdditionSubtractionScene: React.FC<AdditionSubtractionSceneProps> = ({ data, className }) => {
  const {
    title,
    description,
    challenges = [],
    maxNumber = 10,
    showTenFrame = false,
    showEquationBar = true,
    gradeBand = 'K',
    showCountBadges = true,
    groupedReveal = true,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // ── Shared challenge hooks ──────────────────────────────────────
  const {
    currentIndex: currentChallengeIndex,
    currentAttempts,
    results: challengeResults,
    isComplete: allChallengesComplete,
    recordResult,
    incrementAttempts,
    advance: advanceProgress,
  } = useChallengeProgress({ challenges, getChallengeId: (ch) => ch.id });

  const phaseResults = usePhaseResults({
    challenges,
    results: challengeResults,
    isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type,
    phaseConfig: PHASE_TYPE_CONFIG,
  });

  // ── Local state ─────────────────────────────────────────────────
  const [tappedObjects, setTappedObjects] = useState<Set<number>>(new Set());
  const [countAnswer, setCountAnswer] = useState('');
  const [equationTiles, setEquationTiles] = useState<string[]>([]);
  const [solveAnswer, setSolveAnswer] = useState('');
  const [createSelection, setCreateSelection] = useState<{ scene: string; object: string } | null>(null);
  // Kindergarten "build the story" production task (create-story band-gate): the
  // child MAKES the story for a given equation by placing/removing objects, judged
  // by construction. builtCount = objects currently in the scene; buildPhase drives
  // the addition two-step narration ("…now 2 more come!"). Grade 1 keeps the picker.
  const [builtCount, setBuiltCount] = useState(0);
  const [buildPhase, setBuildPhase] = useState<'start' | 'change'>('start');

  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | ''>('');
  const [showTenFrameHelper, setShowTenFrameHelper] = useState(false);
  const [animatingObjects, setAnimatingObjects] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────
  const stableInstanceIdRef = useRef(instanceId || `add-sub-scene-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Current challenge ───────────────────────────────────────────
  const currentChallenge = useMemo(
    () => challenges[currentChallengeIndex] || null,
    [challenges, currentChallengeIndex],
  );

  const sceneConfig = currentChallenge
    ? SCENE_BACKGROUNDS[currentChallenge.scene] || SCENE_BACKGROUNDS.pond
    : SCENE_BACKGROUNDS.pond;

  // Compute visible objects based on phase & operation
  const totalVisible = useMemo(() => {
    if (!currentChallenge) return 0;
    const { type, operation, startCount, resultCount } = currentChallenge;
    if (type === 'act-out') {
      // Show all objects (start + change) for the student to count
      return operation === 'addition' ? resultCount : startCount;
    }
    // create-story (K build task): the scene shows exactly what the child has built.
    if (type === 'create-story') {
      return builtCount;
    }
    return resultCount;
  }, [currentChallenge, builtCount]);

  const positions = useMemo(
    () => scenePositions(totalVisible, currentChallengeIndex * 31 + 7),
    [totalVisible, currentChallengeIndex],
  );

  // Which objects are "start" vs "change" for animation grouping
  const startGroup = useMemo(() => {
    if (!currentChallenge) return new Set<number>();
    const s = new Set<number>();
    for (let i = 0; i < currentChallenge.startCount && i < totalVisible; i++) s.add(i);
    return s;
  }, [currentChallenge, totalVisible]);

  // ── Evaluation ──────────────────────────────────────────────────
  const {
    submitResult: submitEvaluation,
    hasSubmitted: hasSubmittedEvaluation,
    submittedResult,
    elapsedMs,
  } = usePrimitiveEvaluation<AdditionSubtractionSceneMetrics>({
    primitiveType: 'addition-subtraction-scene',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── AI Tutoring ─────────────────────────────────────────────────
  const aiPrimitiveData = useMemo(() => ({
    storyText: currentChallenge?.storyText ?? '',
    // The task instruction is load-bearing for the scaffold's ORIENT beat
    // ({{instruction}} in taskDescription + the read-aloud directive). Without it
    // in the bag the tutor prompt interpolates the literal '(not set)'.
    instruction: currentChallenge?.instruction ?? '',
    operation: currentChallenge?.operation ?? 'addition',
    storyType: currentChallenge?.storyType ?? 'join',
    startCount: currentChallenge?.startCount ?? 0,
    changeCount: currentChallenge?.changeCount ?? 0,
    resultCount: currentChallenge?.resultCount ?? 0,
    unknownPosition: currentChallenge?.unknownPosition ?? 'result',
    challengeType: currentChallenge?.type ?? 'act-out',
    equation: currentChallenge?.equation ?? '',
    objectType: currentChallenge?.objectType ?? '',
    scene: currentChallenge?.scene ?? 'pond',
    attemptNumber: currentAttempts + 1,
    currentChallengeIndex,
    totalChallenges: challenges.length,
    gradeBand,
    maxNumber,
  }), [currentChallenge, currentAttempts, currentChallengeIndex, challenges.length, gradeBand, maxNumber]);

  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'addition-subtraction-scene',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
  });

  // Activity introduction
  const hasIntroducedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || hasIntroducedRef.current || challenges.length === 0) return;
    hasIntroducedRef.current = true;
    const ch = challenges[0];
    sendText(
      `[ACTIVITY_START] Addition & subtraction story scene for ${gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}. `
      + `${challenges.length} challenges total. This student CANNOT read — you are their voice. `
      + `FIRST, ${orientLineForChallenge(ch)}`,
      { silent: true },
    );
  }, [isConnected, challenges, gradeBand, sendText]);

  // Play entrance animation for act-out
  useEffect(() => {
    if (currentChallenge?.type === 'act-out') {
      setAnimatingObjects(true);
      const timer = setTimeout(() => setAnimatingObjects(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [currentChallengeIndex, currentChallenge?.type]);

  // Seed the "build the story" scene when a create-story challenge loads: addition
  // starts EMPTY (the child adds up to the total); subtraction starts pre-filled
  // with startCount (the child sends changeCount away). Reset the two-step phase.
  useEffect(() => {
    if (currentChallenge?.type === 'create-story') {
      setBuiltCount(currentChallenge.operation === 'subtraction' ? currentChallenge.startCount : 0);
      setBuildPhase('start');
    }
  }, [currentChallengeIndex, currentChallenge?.type, currentChallenge?.operation, currentChallenge?.startCount]);

  // ── Check Answers ───────────────────────────────────────────────

  const handleCheckActOut = useCallback((explicitValue?: number) => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = explicitValue !== undefined ? explicitValue : parseInt(countAnswer, 10);
    const target = currentChallenge.resultCount;
    const correct = answer === target;

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Yes! ${currentChallenge.equation}`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student counted ${target} ${currentChallenge.objectType} correctly! `
        + `Story: "${currentChallenge.storyText}". Congratulate and connect to the equation: ${currentChallenge.equation}.`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite — you said ${answer || '?'}. ${currentChallenge.operation === 'addition' ? 'Count all the objects together!' : 'Count what\'s left!'}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer || 'nothing'} but correct is ${target}. `
        + `Story: "${currentChallenge.storyText}". Attempt ${currentAttempts + 1}. `
        + `Hint: "What happened in the story? Did ${currentChallenge.objectType} come or go?"`,
        { silent: true },
      );
    }
  }, [currentChallenge, countAnswer, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckEquation = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    const studentEquation = equationTiles.join(' ');
    const { startCount, changeCount, resultCount, operation } = currentChallenge;

    // Parse student equation: "A + B = C" or "A - B = C"
    const stripped = studentEquation.replace(/\s+/g, '');
    const eqMatch = stripped.match(/^(\d+)([+-])(\d+)=(\d+)$/);

    if (!eqMatch) {
      SoundManager.invalid();
      setFeedback('Build an equation like 3 + 2 = 5');
      setFeedbackType('error');
      return;
    }

    const left = parseInt(eqMatch[1], 10);
    const op = eqMatch[2];
    const right = parseInt(eqMatch[3], 10);
    const result = parseInt(eqMatch[4], 10);

    // Check 1: arithmetic is correct
    const mathCorrect = op === '+'
      ? left + right === result
      : left - right === result;

    // Check 2: uses the correct three numbers (order-independent for addition)
    const studentNums = [left, right, result].sort((a, b) => a - b);
    const expectedNums = [startCount, changeCount, resultCount].sort((a, b) => a - b);
    const usesCorrectNumbers = studentNums[0] === expectedNums[0]
      && studentNums[1] === expectedNums[1]
      && studentNums[2] === expectedNums[2];

    // Check 3: correct operation type
    const correctOp = (operation === 'addition' && op === '+')
      || (operation === 'subtraction' && op === '-');

    const correct = mathCorrect && usesCorrectNumbers && correctOp;

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`Perfect! ${stripped} matches the story!`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student built the equation: ${stripped}. `
        + `Celebrate: "The equation tells the same story as the ${currentChallenge.objectType}!"`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else if (!mathCorrect) {
      SoundManager.playIncorrect();
      setFeedback('The math doesn\'t add up — check the numbers.');
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${stripped}" but the arithmetic is wrong. `
        + `Attempt ${currentAttempts + 1}. Hint: "Check if ${left} ${op} ${right} really equals ${result}."`,
        { silent: true },
      );
    } else if (!correctOp) {
      SoundManager.playIncorrect();
      setFeedback(`Think about the story — did the ${currentChallenge.objectType} come or go away?`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student used "${op}" but the story is ${operation}. `
        + `Attempt ${currentAttempts + 1}. Guide: "In the story, did things join together or go away?"`,
        { silent: true },
      );
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Use the numbers from the story: ${startCount}, ${changeCount}, and ${resultCount}`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student built "${stripped}" — valid math but wrong numbers for this story. `
        + `Attempt ${currentAttempts + 1}. Remind them to look at the story again.`,
        { silent: true },
      );
    }
  }, [currentChallenge, equationTiles, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckSolveStory = useCallback((explicitValue?: number) => {
    if (!currentChallenge) return;
    incrementAttempts();
    const answer = explicitValue !== undefined ? explicitValue : parseInt(solveAnswer, 10);
    const { unknownPosition = 'result', startCount, changeCount, resultCount } = currentChallenge;
    const target = unknownPosition === 'result' ? resultCount
      : unknownPosition === 'change' ? changeCount : startCount;
    const correct = answer === target;

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(`That's right! The answer is ${target}.`);
      setFeedbackType('success');
      sendText(
        `[ANSWER_CORRECT] Student solved the word problem correctly: ${target}. `
        + `Unknown was "${unknownPosition}". Celebrate and explain why.`,
        { silent: true },
      );
      recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
    } else {
      SoundManager.playIncorrect();
      setFeedback(`Not quite — try again! Read the story carefully.`);
      setFeedbackType('error');
      sendText(
        `[ANSWER_INCORRECT] Student answered ${answer || 'nothing'} but correct is ${target}. `
        + `Unknown position: "${unknownPosition}". Attempt ${currentAttempts + 1}. `
        + `Scaffolding: "You started with ${startCount} ${currentChallenge.objectType}. Then ${changeCount} ${currentChallenge.operation === 'addition' ? 'more came' : 'went away'}."`,
        { silent: true },
      );
    }
  }, [currentChallenge, solveAnswer, currentAttempts, sendText, incrementAttempts, recordResult]);

  const handleCheckCreateStory = useCallback(() => {
    if (!currentChallenge || !createSelection) return;
    incrementAttempts();
    // Create-story is open-ended — accept any scene+object selection as correct
    const correct = true;
    SoundManager.playCorrect();
    setFeedback(`Great story! You showed ${currentChallenge.equation} with ${createSelection.object} at the ${createSelection.scene}!`);
    setFeedbackType('success');
    sendText(
      `[ANSWER_CORRECT] Student created a story for ${currentChallenge.equation} using ${createSelection.object} in a ${createSelection.scene} scene. `
      + `Celebrate their creativity! Ask them to tell you the story in words.`,
      { silent: true },
    );
    recordResult({ challengeId: currentChallenge.id, correct, attempts: currentAttempts + 1 });
  }, [currentChallenge, createSelection, currentAttempts, sendText, incrementAttempts, recordResult]);

  // ── K "build the story" production task (create-story band-gate) ──
  // Construction-judged completion: fires automatically the instant the child has
  // placed exactly resultCount objects (tap = choose — no Check button). The build
  // ACTION is the answer, so a pre-reader produces the story instead of authoring text.
  const completeBuildStory = useCallback(() => {
    if (!currentChallenge) return;
    incrementAttempts();
    SoundManager.playCorrect();
    setFeedback(`You built it! ${currentChallenge.equation}`);
    setFeedbackType('success');
    sendText(
      `[ANSWER_CORRECT] The child BUILT the story for ${currentChallenge.equation} by placing ${currentChallenge.objectType} in the ${currentChallenge.scene}. `
      + `Celebrate warmly and say the whole number story back to them: `
      + `"${currentChallenge.startCount} and ${currentChallenge.changeCount} ${currentChallenge.operation === 'addition' ? 'more makes' : 'away leaves'} ${currentChallenge.resultCount}!"`,
      { silent: true },
    );
    recordResult({ challengeId: currentChallenge.id, correct: true, attempts: currentAttempts + 1 });
  }, [currentChallenge, currentAttempts, sendText, incrementAttempts, recordResult]);

  // Advance the build after each add/remove: narrate the addition two-step at the
  // start→change boundary, and complete when the scene holds exactly resultCount.
  const handleBuildProgress = useCallback((count: number) => {
    if (!currentChallenge) return;
    const { startCount, changeCount, resultCount, operation, objectType } = currentChallenge;
    if (operation === 'addition' && buildPhase === 'start' && count === startCount && startCount !== resultCount) {
      setBuildPhase('change');
      sendText(
        `[BUILD_STEP] The child placed the first ${startCount} ${objectType}. Warmly cue the next part of the story: `
        + `"Now ${changeCount} more come!"`,
        { silent: true },
      );
    }
    if (count === resultCount) {
      completeBuildStory();
    }
  }, [currentChallenge, buildPhase, sendText, completeBuildStory]);

  const handleCheckAnswer = useCallback(() => {
    if (!currentChallenge) return;
    switch (currentChallenge.type) {
      case 'act-out': handleCheckActOut(); break;
      case 'build-equation': handleCheckEquation(); break;
      case 'solve-story': handleCheckSolveStory(); break;
      case 'create-story': handleCheckCreateStory(); break;
    }
  }, [currentChallenge, handleCheckActOut, handleCheckEquation, handleCheckSolveStory, handleCheckCreateStory]);

  // ── Navigation ──────────────────────────────────────────────────

  const advanceToNextChallenge = useCallback(() => {
    if (!advanceProgress()) {
      // All complete
      const phaseScoreStr = phaseResults
        .map((p) => `${p.label} ${p.score}% (${p.attempts} attempts)`)
        .join(', ');
      const overallPct = Math.round(
        (challengeResults.filter((r) => r.correct).length / challenges.length) * 100,
      );

      sendText(
        `[ALL_COMPLETE] Phase scores: ${phaseScoreStr}. Overall: ${overallPct}%. `
        + `Give encouraging phase-specific feedback about their addition and subtraction story skills!`,
        { silent: true },
      );

      if (!hasSubmittedEvaluation) {
        const correctCount = challengeResults.filter((r) => r.correct).length;
        const accuracy = Math.round((correctCount / challenges.length) * 100);
        const totalAttempts = challengeResults.reduce((s, r) => s + r.attempts, 0);
        const equationChallenges = challengeResults.filter((_, i) => challenges[i]?.type === 'build-equation');
        const equationAccuracy = equationChallenges.length > 0
          ? Math.round((equationChallenges.filter((r) => r.correct).length / equationChallenges.length) * 100) : 0;
        const storySolveChallenges = challengeResults.filter((_, i) => challenges[i]?.type === 'solve-story');
        const storyAccuracy = storySolveChallenges.length > 0
          ? Math.round((storySolveChallenges.filter((r) => r.correct).length / storySolveChallenges.length) * 100) : 0;

        const metrics: AdditionSubtractionSceneMetrics = {
          type: 'addition-subtraction-scene',
          overallAccuracy: accuracy,
          equationBuildingAccuracy: equationAccuracy,
          storySolvingAccuracy: storyAccuracy,
          attemptsCount: totalAttempts,
          operationsUsed: Array.from(new Set(challenges.map((c) => c.operation))),
          storyTypesUsed: Array.from(new Set(challenges.map((c) => c.storyType))),
        };

        submitEvaluation(correctCount === challenges.length, accuracy, metrics, { challengeResults });
      }
      return;
    }

    // Reset domain-specific state for next challenge
    setFeedback('');
    setFeedbackType('');
    setCountAnswer('');
    setEquationTiles([]);
    setSolveAnswer('');
    setCreateSelection(null);
    setTappedObjects(new Set());
    setShowTenFrameHelper(false);

    const nextCh = challenges[currentChallengeIndex + 1];
    sendText(
      `[NEXT_ITEM] Next story (${currentChallengeIndex + 2} of ${challenges.length}). The student cannot read. `
      + `FIRST, ${orientLineForChallenge(nextCh)}`,
      { silent: true },
    );
  }, [
    advanceProgress, phaseResults, challenges, challengeResults, sendText,
    hasSubmittedEvaluation, submitEvaluation, currentChallengeIndex,
  ]);

  // ── Auto-submit when complete ───────────────────────────────────
  const hasAutoSubmittedRef = useRef(false);
  useEffect(() => {
    if (allChallengesComplete && !hasSubmittedEvaluation && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      advanceToNextChallenge();
    }
  }, [allChallengesComplete, hasSubmittedEvaluation, advanceToNextChallenge]);

  // ── Computed ────────────────────────────────────────────────────
  const isCurrentChallengeComplete = challengeResults.some(
    (r) => r.challengeId === currentChallenge?.id && r.correct,
  );

  const localOverallScore = useMemo(() => {
    if (!allChallengesComplete || challenges.length === 0) return 0;
    return Math.round((challengeResults.filter((r) => r.correct).length / challenges.length) * 100);
  }, [allChallengesComplete, challenges, challengeResults]);

  // ── Equation tile handlers ──────────────────────────────────────
  const addTile = useCallback((tile: string) => {
    SoundManager.tap();
    setEquationTiles((prev) => [...prev, tile]);
  }, []);
  const removeTile = useCallback((index: number) => {
    SoundManager.tap();
    setEquationTiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Object tap handler (act-out counting) ───────────────────────
  const handleObjectTap = useCallback((index: number) => {
    if (isCurrentChallengeComplete) return;
    // create-story build task: tapping a placed object sends it away (remove one).
    if (currentChallenge?.type === 'create-story') {
      if (builtCount <= 0) return;
      const next = builtCount - 1;
      SoundManager.tap();
      setBuiltCount(next);
      handleBuildProgress(next);
      return;
    }
    // act-out counting aid: tapping toggles a highlight (does not change the count).
    if (currentChallenge?.type !== 'act-out') return;
    SoundManager.tap();
    setTappedObjects((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, [currentChallenge?.type, isCurrentChallengeComplete, builtCount, handleBuildProgress]);

  // Add one object to the "build the story" scene (K create-story). Capped at
  // maxNumber so a stray tap can't run past the scene's range.
  const addBuildObject = useCallback(() => {
    if (currentChallenge?.type !== 'create-story' || isCurrentChallengeComplete) return;
    const next = Math.min(builtCount + 1, maxNumber);
    if (next === builtCount) return;
    SoundManager.tap();
    setBuiltCount(next);
    handleBuildProgress(next);
  }, [currentChallenge?.type, isCurrentChallengeComplete, builtCount, maxNumber, handleBuildProgress]);

  // Reader-fit PRE band-gate: at Kindergarten, counting answers (act-out /
  // solve-story) are entered by TAPPING a number tile, not typing a numeral
  // (rule 6). Tapping is the atomic answer, so these modes drop the explicit
  // Check button (rule 2 tap=choose). Grade 1 keeps keyboard input + Check.
  // create-story at K is likewise Check-free — the build ACTION auto-judges.
  const isKindergartenBand = gradeBand === 'K';
  const isTapChooseCount =
    isKindergartenBand &&
    (currentChallenge?.type === 'act-out' || currentChallenge?.type === 'solve-story');
  const isBuildStory = isKindergartenBand && currentChallenge?.type === 'create-story';

  // Determine if Check button should be enabled
  const canCheck = useMemo(() => {
    if (!currentChallenge || isCurrentChallengeComplete) return false;
    switch (currentChallenge.type) {
      case 'act-out': return countAnswer.trim() !== '';
      case 'build-equation': return equationTiles.length >= 3;
      case 'solve-story': return solveAnswer.trim() !== '';
      case 'create-story': return createSelection !== null;
      default: return false;
    }
  }, [currentChallenge, isCurrentChallengeComplete, countAnswer, equationTiles, solveAnswer, createSelection]);

  // Equation tray tiles. Support tier (build-equation) may restrict the offered
  // numbers via challenge.allowedTiles; operators are always available. Falls back
  // to the full 0…maxNumber palette. Never affects the target equation.
  const equationTilePalette = useMemo(() => {
    const allowed = currentChallenge?.allowedTiles;
    const numberTiles = allowed && allowed.length > 0
      ? Array.from(new Set(allowed)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      : EQUATION_TILES.filter((t) => {
          const num = parseInt(t, 10);
          return !isNaN(num) && num <= maxNumber;
        });
    return [...numberTiles, '+', '-', '='];
  }, [currentChallenge, maxNumber]);

  // Eval-mode / phase tabs (chrome)
  const phaseTabs = useMemo(
    () => Object.entries(PHASE_TYPE_CONFIG).map(([value, cfg]) => ({
      value,
      label: `${cfg.icon} ${cfg.label}`,
    })),
    [],
  );

  // ── Render ──────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-slate-400 text-sm">No challenges configured.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange" className="text-xs">
              {gradeBand === 'K' ? 'Kindergarten' : 'Grade 1'}
            </LuminaBadge>
            {currentChallenge && (
              <LuminaBadge accent="cyan" className="text-xs">
                {currentChallenge.operation}
              </LuminaBadge>
            )}
          </div>
        </div>
        {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {/* Phase Progress */}
        <div className="flex items-center gap-2 flex-wrap">
          <LuminaModeTabs
            tabs={phaseTabs}
            active={currentChallenge?.type ?? ''}
            accent="orange"
          />
          <LuminaChallengeCounter
            current={Math.min(currentChallengeIndex + 1, challenges.length)}
            total={challenges.length}
            className="ml-auto"
          />
        </div>

        {/* Story Text */}
        {currentChallenge && !allChallengesComplete && (
          <LuminaPrompt>
            <p className="text-slate-200 text-sm font-medium mb-1">
              {currentChallenge.storyText}
            </p>
            <p className="text-slate-400 text-xs italic font-normal">
              {currentChallenge.instruction}
            </p>
          </LuminaPrompt>
        )}

        {/* Scene Visualization */}
        {currentChallenge && !allChallengesComplete && (
          <div className="flex justify-center">
            <div
              className={`relative rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br ${sceneConfig.gradient}`}
              style={{ width: SCENE_WIDTH, maxWidth: '100%', height: SCENE_HEIGHT }}
            >
              {/* Scene label */}
              <div className="absolute top-2 left-2">
                <LuminaBadge className="bg-black/30 border-white/10 text-white/70 text-[10px]">
                  {sceneConfig.label}
                </LuminaBadge>
              </div>

              {/* Objects */}
              <svg
                width={SCENE_WIDTH}
                height={SCENE_HEIGHT}
                viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
                className="absolute inset-0 w-full h-full"
              >
                {positions.map((pos, i) => {
                  const isTapped = tappedObjects.has(i);
                  const isChangeGroup = !startGroup.has(i);
                  // groupedReveal (easy/medium): the change group animates in separately so the
                  // join is visible. Withdrawn (hard): everything appears together at once.
                  const useGroupedAnim = groupedReveal && animatingObjects && isChangeGroup;
                  const animDelay = useGroupedAnim ? '0.5s' : '0s';

                  return (
                    <g
                      key={i}
                      className={`cursor-pointer transition-transform duration-300 ${
                        useGroupedAnim ? 'opacity-0 animate-fadeIn' : 'opacity-100'
                      }`}
                      style={{
                        animationDelay: animDelay,
                        animationFillMode: 'forwards',
                      }}
                      onClick={() => handleObjectTap(i)}
                    >
                      {/* Tap highlight */}
                      {isTapped && (
                        <circle
                          cx={pos.x} cy={pos.y} r={OBJ_SIZE / 2 + 3}
                          fill="none" stroke="rgba(234,179,8,0.5)" strokeWidth={2}
                        />
                      )}
                      <text
                        x={pos.x} y={pos.y}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize={OBJ_SIZE * 0.7}
                        className="select-none pointer-events-none"
                      >
                        {getEmoji(currentChallenge.objectType)}
                      </text>
                      {/* Count badge for tapped objects (withdrawn at the hard tier) */}
                      {isTapped && showCountBadges && (
                        <>
                          <circle
                            cx={pos.x + OBJ_SIZE / 2 - 2} cy={pos.y - OBJ_SIZE / 2 + 2}
                            r={8} fill="#eab308" stroke="rgba(0,0,0,0.3)" strokeWidth={1}
                          />
                          <text
                            x={pos.x + OBJ_SIZE / 2 - 2} y={pos.y - OBJ_SIZE / 2 + 2}
                            textAnchor="middle" dominantBaseline="central"
                            fontSize={9} fill="white" fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {Array.from(tappedObjects).sort((a, b) => a - b).indexOf(i) + 1}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}

        {/* Ten-frame toggle */}
        {showTenFrame && currentChallenge && !allChallengesComplete && (
          <div className="flex items-center justify-center gap-3">
            <LuminaButton
              tone="subtle"
              className="text-slate-400 text-xs h-7 px-2"
              onClick={() => setShowTenFrameHelper((v) => !v)}
            >
              {showTenFrameHelper ? 'Hide' : 'Show'} Ten Frame
            </LuminaButton>
            {showTenFrameHelper && (
              <TenFrameHelper filled={currentChallenge.resultCount} max={maxNumber <= 5 ? 5 : 10} />
            )}
          </div>
        )}

        {/* ── Phase-specific input areas ─────────────────────── */}

        {/* Act-Out: count input */}
        {currentChallenge?.type === 'act-out' && !isCurrentChallengeComplete && !allChallengesComplete && (
          isKindergartenBand ? (
            <div className="flex flex-col items-center gap-3">
              <span className="text-slate-300 text-sm">How many {currentChallenge.objectType} are there now?</span>
              <NumberTileRow max={maxNumber} onPick={(n) => handleCheckActOut(n)} disabled={hasSubmittedEvaluation} />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <span className="text-slate-300 text-sm">How many {currentChallenge.objectType} are there now?</span>
              <LuminaInput
                type="number"
                inputMode="numeric"
                min={0}
                max={maxNumber}
                value={countAnswer}
                onChange={(e) => setCountAnswer(e.target.value)}
                className="w-16 text-center text-lg"
                onKeyDown={(e) => e.key === 'Enter' && canCheck && handleCheckAnswer()}
              />
            </div>
          )
        )}

        {/* Build-Equation: tile builder */}
        {currentChallenge?.type === 'build-equation' && !isCurrentChallengeComplete && !allChallengesComplete && showEquationBar && (
          <div className="space-y-3">
            {/* Built equation display */}
            <div className="flex items-center justify-center gap-1 min-h-[44px] bg-slate-800/30 rounded-lg p-2 border border-white/5">
              {equationTiles.length === 0 ? (
                <span className="text-slate-600 text-sm">Drag tiles here to build the equation</span>
              ) : (
                equationTiles.map((tile, i) => (
                  <LuminaButton
                    key={i}
                    className="bg-purple-500/20 border border-purple-400/30 text-purple-200 text-lg font-mono h-9 w-9 p-0 hover:bg-red-500/20 hover:border-red-400/30"
                    onClick={() => removeTile(i)}
                    title="Click to remove"
                  >
                    {tile}
                  </LuminaButton>
                ))
              )}
            </div>
            {/* Available tiles */}
            <div className="flex flex-wrap justify-center gap-1">
              {equationTilePalette.map((tile) => (
                <LuminaButton
                  key={tile}
                  className="text-slate-200 text-sm font-mono h-8 w-8 p-0"
                  onClick={() => addTile(tile)}
                >
                  {tile}
                </LuminaButton>
              ))}
            </div>
          </div>
        )}

        {/* Solve-Story: answer input */}
        {currentChallenge?.type === 'solve-story' && !isCurrentChallengeComplete && !allChallengesComplete && (
          isKindergartenBand ? (
            <div className="flex flex-col items-center gap-3">
              <span className="text-slate-300 text-sm">
                What is the answer?
                {currentChallenge.unknownPosition === 'start' && ' (How many at the start?)'}
                {currentChallenge.unknownPosition === 'change' && ' (How many came or left?)'}
              </span>
              <NumberTileRow max={maxNumber} onPick={(n) => handleCheckSolveStory(n)} disabled={hasSubmittedEvaluation} />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <span className="text-slate-300 text-sm">
                What is the answer?
                {currentChallenge.unknownPosition === 'start' && ' (How many at the start?)'}
                {currentChallenge.unknownPosition === 'change' && ' (How many came or left?)'}
              </span>
              <LuminaInput
                type="number"
                inputMode="numeric"
                min={0}
                max={maxNumber}
                value={solveAnswer}
                onChange={(e) => setSolveAnswer(e.target.value)}
                className="w-16 text-center text-lg"
                onKeyDown={(e) => e.key === 'Enter' && canCheck && handleCheckAnswer()}
              />
            </div>
          )
        )}

        {/* Create-Story: at K a pre-reader BUILDS the story (place/remove objects,
            judged by construction); Grade 1 keeps the scene+object picker. */}
        {currentChallenge?.type === 'create-story' && !isCurrentChallengeComplete && !allChallengesComplete && (
          isBuildStory ? (
            <div className="flex flex-col items-center gap-3">
              {/* The equation IS the given prompt for create-story (tutor reads it
                  aloud); numbers/symbols are taught at K, so it may show on screen. */}
              <div className="text-2xl font-bold text-emerald-200 tracking-wide font-mono">
                {currentChallenge.equation}
              </div>
              {/* Primary build action — add one object to the scene. */}
              <button
                type="button"
                onClick={addBuildObject}
                disabled={hasSubmittedEvaluation || builtCount >= maxNumber}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-emerald-400/25 to-teal-400/25 border-2 border-emerald-300/40 text-emerald-100 text-xl font-bold shadow-sm active:scale-95 transition hover:from-emerald-400/40 hover:to-teal-400/40 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="text-2xl" aria-hidden>{getEmoji(currentChallenge.objectType)}</span>
                <span aria-hidden>＋</span>
                <span className="sr-only">Add one {currentChallenge.objectType}</span>
              </button>
              <span className="text-slate-500 text-xs">
                Tap a {getEmoji(currentChallenge.objectType)} to send it away
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <span className="text-slate-300 text-sm">
                  Show <span className="text-emerald-300 font-bold">{currentChallenge.equation}</span> — pick a scene and objects:
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.entries(SCENE_BACKGROUNDS).map(([key, cfg]) => (
                  <LuminaButton
                    key={key}
                    className={`text-xs h-8 ${
                      createSelection?.scene === key
                        ? answerStateClass('selected')
                        : ''
                    }`}
                    onClick={() => { SoundManager.select(); setCreateSelection((prev) => ({ scene: key, object: prev?.object || '' })); }}
                  >
                    {cfg.label}
                  </LuminaButton>
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {Object.entries(OBJECT_EMOJI).map(([key, emoji]) => (
                  <LuminaButton
                    key={key}
                    className={`text-xs h-8 ${
                      createSelection?.object === key
                        ? answerStateClass('selected')
                        : ''
                    }`}
                    onClick={() => { SoundManager.select(); setCreateSelection((prev) => ({ scene: prev?.scene || '', object: key })); }}
                  >
                    {emoji} {key}
                  </LuminaButton>
                ))}
              </div>
            </div>
          )
        )}

        {/* Feedback */}
        {feedback && (
          <LuminaFeedbackCard status={feedbackType === 'success' ? 'correct' : 'incorrect'}>
            {feedback}
          </LuminaFeedbackCard>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {!isCurrentChallengeComplete && !allChallengesComplete && !isTapChooseCount && !isBuildStory && (
            <LuminaActionButton
              action="check"
              onClick={handleCheckAnswer}
              disabled={!canCheck || hasSubmittedEvaluation}
            />
          )}
          {isCurrentChallengeComplete && !allChallengesComplete && (
            <LuminaActionButton
              action="next"
              onClick={advanceToNextChallenge}
            >
              Next Challenge
            </LuminaActionButton>
          )}
          {allChallengesComplete && !hasSubmittedEvaluation && (
            <div className="text-center">
              <p className="text-emerald-400 text-sm font-medium">All challenges complete!</p>
            </div>
          )}
        </div>

        {/* Phase Summary */}
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={submittedResult?.score ?? localOverallScore}
            durationMs={elapsedMs}
            heading="Story Complete!"
            celebrationMessage={`You completed all ${challenges.length} addition & subtraction story challenges!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>

      {/* CSS animation for object entrance */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </LuminaCard>
  );
};

export default AdditionSubtractionScene;
