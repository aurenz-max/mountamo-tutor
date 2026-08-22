'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
  type RampLabMetrics,
} from '../../../evaluation';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaSlider,
  LuminaStat,
} from '../../../ui';
import {
  DEFAULT_RAMP_CHALLENGES,
  RAMP_FRICTION_COEFFICIENTS,
  easierComparisonChoice,
  maxWorkableAngle,
  minimumPushSetting,
  requiredPushForce,
  type RampChallenge,
  type RampChallengeMode,
  type RampFrictionLevel,
  type RampLoadType,
  type RampScenario,
} from './rampChallenges';

export { selectMixedRampChallenges, selectRampChallenges } from './rampChallenges';
export type { RampChallenge, RampChallengeMode } from './rampChallenges';

export type LoadType = RampLoadType;
export type FrictionLevel = RampFrictionLevel;
export type RampTheme = 'loading_dock' | 'dump_truck' | 'skateboard' | 'generic';

export interface RampLabData {
  title: string;
  description: string;
  rampLength: number;
  rampAngle: number;
  adjustableAngle: boolean;
  loadWeight: number;
  loadType: LoadType;
  showMeasurements: boolean;
  frictionLevel: FrictionLevel;
  theme: RampTheme;
  showForceArrows?: boolean;
  showMA?: boolean;
  allowPush?: boolean;
  pushForce?: number;
  customLoadIcon?: string;
  customLoadLabel?: string;
  challenges?: RampChallenge[];
  freeExplore?: boolean;
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<RampLabMetrics>) => void;
}

interface RampLabProps {
  data: RampLabData;
  className?: string;
}

type Feedback = { correct: boolean; message: string };

const modeLabel: Record<RampChallengeMode, string> = {
  compare_conditions: 'FAIR TEST',
  find_threshold: 'MEASURE THE THRESHOLD',
  design_with_budget: 'ENGINEERING DESIGN',
};

const frictionLabel: Record<FrictionLevel, string> = {
  none: 'frictionless',
  low: 'smooth',
  medium: 'grippy',
  high: 'rough',
};

const fallbackScenario = (data: RampLabData): RampScenario => ({
  label: data.customLoadLabel || 'Free exploration',
  angle: data.rampAngle ?? 30,
  loadWeight: data.loadWeight ?? 5,
  loadType: data.loadType ?? 'box',
  frictionLevel: data.frictionLevel ?? 'medium',
});

const scenarioForChallenge = (
  challenge: RampChallenge | undefined,
  compareSide: 'a' | 'b',
  fallback: RampScenario,
): RampScenario => {
  if (!challenge) return fallback;
  if (challenge.mode === 'compare_conditions') return challenge.scenarios[compareSide];
  return challenge.scenario;
};

const RampLoad: React.FC<{
  type: LoadType;
  x: number;
  y: number;
  angle: number;
  accent: string;
}> = ({ type, x, y, angle, accent }) => (
  <g transform={`translate(${x}, ${y}) rotate(${-angle})`}>
    {type === 'box' || type === 'custom' ? (
      <rect x={-25} y={-45} width={50} height={45} rx={7} fill="#C084FC" stroke="#E9D5FF" strokeWidth={3} />
    ) : (
      <>
        <circle cy={-23} r={25} fill="#A78BFA" stroke="#DDD6FE" strokeWidth={3} />
        <circle cy={-23} r={12} fill="#334155" stroke={accent} strokeWidth={3} />
        <path d="M0 -35V-11M-12 -23H12M-8 -31L8 -15M8 -31L-8 -15" stroke="#CBD5E1" strokeWidth={2} />
      </>
    )}
  </g>
);

const RampLab: React.FC<RampLabProps> = ({ data, className }) => {
  const {
    title,
    description,
    rampLength = 10,
    adjustableAngle = true,
    showMeasurements = true,
    theme = 'generic',
    showForceArrows = false,
    showMA = false,
    allowPush = true,
    pushForce: initialPushForce = 0,
    freeExplore = false,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const fallback = useMemo(() => fallbackScenario(data), [data]);
  const challenges = useMemo(
    () => (freeExplore ? [] : data.challenges?.length ? data.challenges : DEFAULT_RAMP_CHALLENGES),
    [data.challenges, freeExplore],
  );
  const isChallengeSession = challenges.length > 0;
  const [challengeIndex, setChallengeIndex] = useState(0);
  const currentChallenge = challenges[challengeIndex];
  const [compareSide, setCompareSide] = useState<'a' | 'b'>('a');
  const [compareChoice, setCompareChoice] = useState<'a' | 'b' | null>(null);
  const currentScenario = scenarioForChallenge(currentChallenge, compareSide, fallback);

  const [rampAngle, setRampAngle] = useState(currentScenario.angle);
  const [pushForce, setPushForce] = useState(initialPushForce);
  const [loadPosition, setLoadPosition] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  const totalChecksRef = useRef(0);
  const firstTryCorrectRef = useRef(0);
  const wrongChallengeIdsRef = useRef<Set<string>>(new Set());
  const experimentCountRef = useRef(0);
  const variablesExploredRef = useRef<Set<string>>(new Set());
  const fallbackInstanceIdRef = useRef(`ramp-lab-${Date.now()}`);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<RampLabMetrics>({
    primitiveType: 'ramp-lab',
    instanceId: instanceId || fallbackInstanceIdRef.current,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const loadWeight = currentScenario.loadWeight;
  const loadType = currentScenario.loadType;
  const frictionLevel = currentScenario.frictionLevel;
  const frictionCoefficient = RAMP_FRICTION_COEFFICIENTS[frictionLevel];
  const angleRadians = (rampAngle * Math.PI) / 180;
  const normalForce = loadWeight * 9.8 * Math.cos(angleRadians);
  const parallelForce = loadWeight * 9.8 * Math.sin(angleRadians);
  const frictionForce = frictionCoefficient * normalForce;
  const thresholdForce = requiredPushForce({ angle: rampAngle, loadWeight, frictionLevel });
  const netForce = pushForce - thresholdForce;
  const canMoveUp = pushForce > thresholdForce;
  const canSlideDown = pushForce === 0 && parallelForce > frictionForce;

  const isDesign = currentChallenge?.mode === 'design_with_budget';
  const targetHeight = isDesign ? currentChallenge.targetHeight : rampLength * Math.sin(angleRadians);
  const displayedRampLength = targetHeight / Math.max(Math.sin(angleRadians), 0.01);
  const mechanicalAdvantage = displayedRampLength / Math.max(targetHeight, 0.01);

  const svgWidth = 800;
  const svgHeight = 420;
  const rampBaseX = 90;
  const rampBaseY = 335;
  const rampHeightPx = isDesign ? 110 : 540 * Math.sin(angleRadians);
  const rampWidthPx = isDesign
    ? Math.min(630, 110 / Math.max(Math.tan(angleRadians), 0.01))
    : 540 * Math.cos(angleRadians);
  const progress = loadPosition / 100;
  const loadX = rampBaseX + progress * rampWidthPx;
  const loadY = rampBaseY - progress * rampHeightPx;

  const colors = useMemo(() => {
    if (theme === 'loading_dock') return { ramp: '#64748B', edge: '#94A3B8', accent: '#F59E0B', sky: '#111827' };
    if (theme === 'dump_truck') return { ramp: '#B45309', edge: '#FBBF24', accent: '#F59E0B', sky: '#1C1917' };
    if (theme === 'skateboard') return { ramp: '#6D28D9', edge: '#C4B5FD', accent: '#A78BFA', sky: '#14142A' };
    return { ramp: '#2563EB', edge: '#93C5FD', accent: '#60A5FA', sky: '#0F172A' };
  }, [theme]);

  const resetInteraction = useCallback((challenge = currentChallenge) => {
    const nextScenario = scenarioForChallenge(challenge, 'a', fallback);
    setCompareSide('a');
    setCompareChoice(null);
    setRampAngle(nextScenario.angle);
    setPushForce(challenge?.mode === 'design_with_budget' ? challenge.forceBudget : initialPushForce);
    setLoadPosition(0);
    setIsAnimating(false);
    setFeedback(null);
    setHintVisible(false);
    setShowSuccess(false);
    lastTimeRef.current = null;
  }, [currentChallenge, fallback, initialPushForce]);

  useEffect(() => {
    resetInteraction(currentChallenge);
  }, [currentChallenge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isAnimating) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastTimeRef.current = null;
      return;
    }
    const animate = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      const direction = canMoveUp ? 1 : canSlideDown ? -1 : 0;
      if (direction === 0) {
        setIsAnimating(false);
        return;
      }
      const speed = Math.max(12, Math.abs(netForce) * 1.3);
      setLoadPosition((previous) => {
        const next = Math.max(0, Math.min(100, previous + direction * speed * dt));
        if (next === 100 || next === 0) {
          setIsAnimating(false);
          if (next === 100) {
            setShowSuccess(true);
            window.setTimeout(() => setShowSuccess(false), 1800);
          }
        }
        return next;
      });
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    };
  }, [isAnimating, canMoveUp, canSlideDown, netForce]);

  const markSolved = (challenge: RampChallenge) => {
    if (!solvedIds.has(challenge.id)) {
      if (!wrongChallengeIdsRef.current.has(challenge.id)) firstTryCorrectRef.current += 1;
      setSolvedIds((previous) => new Set(previous).add(challenge.id));
    }
    SoundManager.playCorrect();
  };

  const recordWrong = (challenge: RampChallenge) => {
    wrongChallengeIdsRef.current.add(challenge.id);
    SoundManager.playIncorrect();
  };

  const handleCheck = () => {
    if (!currentChallenge) return;
    totalChecksRef.current += 1;
    experimentCountRef.current += 1;
    if (currentChallenge.mode === 'compare_conditions') {
      if (!compareChoice) return;
      variablesExploredRef.current.add(currentChallenge.changedVariable);
      const correct = compareChoice === easierComparisonChoice(currentChallenge);
      if (correct) {
        markSolved(currentChallenge);
        setFeedback({ correct: true, message: 'Your prediction matches the force evidence.' });
      } else {
        recordWrong(currentChallenge);
        setFeedback({ correct: false, message: 'The force evidence points to the other setup. Compare only the variable that changed.' });
      }
      return;
    }
    if (currentChallenge.mode === 'find_threshold') {
      variablesExploredRef.current.add('push_force');
      const answer = minimumPushSetting(currentChallenge.scenario, currentChallenge.forceStep);
      const correct = Math.abs(pushForce - answer) < 0.001;
      if (correct) {
        markSolved(currentChallenge);
        setFeedback({ correct: true, message: `${pushForce.toFixed(1)} N is the first slider step that moves the load.` });
        setIsAnimating(true);
      } else if (pushForce <= thresholdForce) {
        recordWrong(currentChallenge);
        setFeedback({ correct: false, message: 'That force is still below the movement threshold. Increase it and test again.' });
      } else {
        recordWrong(currentChallenge);
        setFeedback({ correct: false, message: 'That force moves the load, but it is not the minimum. Reduce it and test again.' });
      }
      return;
    }
    variablesExploredRef.current.add('angle');
    variablesExploredRef.current.add('ramp_length');
    const answer = maxWorkableAngle(currentChallenge.scenario, currentChallenge.forceBudget, currentChallenge.angleRange);
    const correct = rampAngle === answer;
    if (correct) {
      markSolved(currentChallenge);
      setFeedback({ correct: true, message: `${rampAngle} degrees is the steepest whole-degree design within the budget.` });
      setIsAnimating(true);
    } else if (rampAngle > answer) {
      recordWrong(currentChallenge);
      setFeedback({ correct: false, message: 'This ramp is too steep for the available force. Make it gentler.' });
    } else {
      recordWrong(currentChallenge);
      setFeedback({ correct: false, message: 'This design works, but a steeper workable ramp would be shorter. Keep searching.' });
    }
  };

  const handleNext = () => {
    if (challengeIndex >= challenges.length - 1) return;
    setChallengeIndex((index) => index + 1);
    SoundManager.navigate();
  };

  const handleFinish = () => {
    if (hasSubmitted) return;
    const solved = solvedIds.size;
    const score = Math.round(
      (solved / Math.max(challenges.length, 1)) * 80
      + (firstTryCorrectRef.current / Math.max(challenges.length, 1)) * 20,
    );
    const sessionModes = Array.from(new Set(challenges.map((challenge) => challenge.mode)));
    const metrics: RampLabMetrics = {
      type: 'ramp-lab',
      evalMode: sessionModes.length === 1 ? sessionModes[0] : 'mixed',
      rampAngle,
      objectMass: loadWeight,
      frictionCoefficient,
      predictedAcceleration: 0,
      actualAcceleration: canMoveUp ? netForce / loadWeight : 0,
      predictionAccuracy: Math.round((firstTryCorrectRef.current / Math.max(challenges.length, 1)) * 100),
      experimentCount: experimentCountRef.current,
      variablesExplored: Array.from(variablesExploredRef.current),
      challengesSolved: solved,
      challengesTotal: challenges.length,
      checksMade: totalChecksRef.current,
      firstTryCorrect: firstTryCorrectRef.current,
    };
    submitResult(solved === challenges.length, score, metrics, {
      solvedChallengeIds: Array.from(solvedIds),
      modes: sessionModes,
      checksMade: totalChecksRef.current,
    });
    SoundManager.playStreak();
  };

  const handleCompareView = (side: 'a' | 'b') => {
    if (currentChallenge?.mode !== 'compare_conditions') return;
    setCompareSide(side);
    setRampAngle(currentChallenge.scenarios[side].angle);
    setPushForce(0);
    setLoadPosition(0);
    setIsAnimating(false);
    SoundManager.select();
  };

  const diagnosticsRevealed = !isChallengeSession || feedback?.correct === true
    || currentChallenge?.mode === 'compare_conditions' && feedback !== null;
  const currentSolved = !!currentChallenge && solvedIds.has(currentChallenge.id);
  const allSolved = isChallengeSession && solvedIds.size === challenges.length;

  return (
    <div className={`mx-auto my-12 w-full max-w-5xl animate-fade-in ${className || ''}`}>
      <div className="mb-7 flex items-center justify-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 font-mono text-xl text-blue-300">/_</div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          <p className="font-mono text-xs uppercase tracking-wider text-blue-400">
            {currentChallenge ? modeLabel[currentChallenge.mode] : 'OPEN RAMP LAB'}
          </p>
        </div>
      </div>

      <LuminaCard topAccent="blue" className="overflow-hidden">
        <LuminaCardContent className="space-y-6 p-6 md:p-8">
          <p className="mx-auto max-w-3xl text-center font-light text-slate-300">{description}</p>

          {currentChallenge && (
            <LuminaPanel accent="blue" className="p-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-wider text-blue-300">Challenge {challengeIndex + 1} / {challenges.length}</span>
                <span className="font-mono text-xs text-slate-500">{modeLabel[currentChallenge.mode]}</span>
              </div>
              <h3 className="text-lg font-semibold text-white">{currentChallenge.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-300">{currentChallenge.brief}</p>

              {currentChallenge.mode === 'compare_conditions' && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {(['a', 'b'] as const).map((side) => {
                    const item = currentChallenge.scenarios[side];
                    const selected = compareChoice === side;
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => { setCompareChoice(side); handleCompareView(side); }}
                        className={`rounded-xl border p-4 text-left transition ${selected ? 'border-blue-400 bg-blue-500/15' : 'border-white/10 bg-black/20 hover:border-white/25'}`}
                      >
                        <span className="font-mono text-xs text-blue-300">SETUP {side.toUpperCase()}</span>
                        <p className="mt-1 font-semibold text-white">{item.label}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.angle} degrees · {item.loadWeight} units · {frictionLabel[item.frictionLevel]}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentChallenge.mode === 'design_with_budget' && (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                  <LuminaStat label="Fixed height" value={`${currentChallenge.targetHeight} units`} accent="blue" />
                  <LuminaStat label="Force budget" value={`${currentChallenge.forceBudget.toFixed(1)} N`} accent="emerald" />
                  <LuminaStat label="Ramp travel" value={`${displayedRampLength.toFixed(1)} units`} accent="purple" />
                </div>
              )}
            </LuminaPanel>
          )}

          <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/60">
            <div className={`absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full border px-4 py-2 font-mono text-xs ${
              diagnosticsRevealed
                ? canMoveUp ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-rose-500/50 bg-rose-500/15 text-rose-300'
                : 'border-blue-500/40 bg-blue-500/10 text-blue-200'
            }`}>
              {diagnosticsRevealed
                ? canMoveUp ? 'ENOUGH FORCE TO CLIMB' : 'NOT ENOUGH FORCE TO CLIMB'
                : currentChallenge?.mode === 'compare_conditions' ? 'PREDICT BEFORE REVEALING THE FORCE'
                : currentChallenge?.mode === 'find_threshold' ? 'TEST FOR THE FIRST MOVING FORCE'
                : currentChallenge?.mode === 'design_with_budget' ? 'FIND THE STEEPEST WORKING DESIGN'
                : 'EXPLORE THE FORCE BALANCE'}
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-auto w-full select-none">
              <defs>
                <linearGradient id="rampLabSky" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.sky} /><stop offset="100%" stopColor="#172033" />
                </linearGradient>
                <linearGradient id="rampLabRamp" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={colors.edge} /><stop offset="100%" stopColor={colors.ramp} />
                </linearGradient>
              </defs>
              <rect width={svgWidth} height={svgHeight} fill="url(#rampLabSky)" />
              {Array.from({ length: 20 }).map((_, index) => (
                <line key={`grid-${index}`} x1={index * 40} y1={0} x2={index * 40} y2={svgHeight} stroke="#94A3B8" opacity={0.06} />
              ))}
              <rect y={rampBaseY} width={svgWidth} height={svgHeight - rampBaseY} fill="#273449" />
              <polygon points={`${rampBaseX},${rampBaseY} ${rampBaseX + rampWidthPx},${rampBaseY - rampHeightPx} ${rampBaseX + rampWidthPx},${rampBaseY}`} fill="url(#rampLabRamp)" opacity={0.95} />
              <line x1={rampBaseX} y1={rampBaseY} x2={rampBaseX + rampWidthPx} y2={rampBaseY - rampHeightPx} stroke={colors.edge} strokeWidth={5} strokeLinecap="round" />
              {isDesign && (
                <>
                  <line x1={rampBaseX + rampWidthPx + 25} y1={rampBaseY} x2={rampBaseX + rampWidthPx + 25} y2={rampBaseY - rampHeightPx} stroke="#60A5FA" strokeDasharray="7 5" />
                  <text x={rampBaseX + rampWidthPx + 35} y={rampBaseY - rampHeightPx / 2} fill="#93C5FD" fontSize={12} fontFamily="monospace">fixed height</text>
                </>
              )}
              <RampLoad type={loadType} x={loadX} y={loadY} angle={rampAngle} accent={colors.accent} />
              {showMeasurements && (
                <>
                  <text x={rampBaseX + 8} y={rampBaseY + 26} fill="#E2E8F0" fontSize={12} fontFamily="monospace">{rampAngle} degrees</text>
                  <text x={rampBaseX + rampWidthPx / 2} y={rampBaseY - rampHeightPx / 2 - 18} fill="#E2E8F0" fontSize={12} fontFamily="monospace">{displayedRampLength.toFixed(1)} units travel</text>
                </>
              )}
              {diagnosticsRevealed && showForceArrows && (
                <g transform={`translate(${loadX + 35}, ${loadY - 55})`} fontFamily="monospace" fontSize={11}>
                  <text fill="#FB7185">down ramp: {parallelForce.toFixed(1)} N</text>
                  <text y={17} fill="#FBBF24">friction: {frictionForce.toFixed(1)} N</text>
                  <text y={34} fill="#34D399">push: {pushForce.toFixed(1)} N</text>
                </g>
              )}
            </svg>
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 backdrop-blur-sm">
                <div className="rounded-2xl bg-emerald-600 px-7 py-4 text-xl font-bold text-white shadow-2xl">The load reached the platform!</div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {((!isChallengeSession && adjustableAngle) || isDesign) && (
              <LuminaPanel accent="purple" className="p-5">
                <label className="mb-3 block font-mono text-sm text-slate-300">Ramp angle: <span className="font-bold text-purple-300">{rampAngle} degrees</span></label>
                <LuminaSlider
                  accent="purple"
                  min={isDesign ? currentChallenge.angleRange.min : 5}
                  max={isDesign ? currentChallenge.angleRange.max : 60}
                  step={1}
                  value={[rampAngle]}
                  onValueChange={([value]) => { setRampAngle(value); setLoadPosition(0); setIsAnimating(false); setFeedback(null); SoundManager.tick(); }}
                />
                <div className="mt-1 flex justify-between text-xs text-slate-500"><span>gentler / longer</span><span>steeper / shorter</span></div>
              </LuminaPanel>
            )}

            {((!isChallengeSession && allowPush) || currentChallenge?.mode === 'find_threshold') && (
              <LuminaPanel accent="emerald" className="p-5">
                <label className="mb-3 block font-mono text-sm text-slate-300">Push force: <span className="font-bold text-emerald-300">{pushForce.toFixed(1)} N</span></label>
                <LuminaSlider
                  accent="emerald"
                  min={0}
                  max={100}
                  step={currentChallenge?.mode === 'find_threshold' ? currentChallenge.forceStep : 0.5}
                  value={[pushForce]}
                  onValueChange={([value]) => { setPushForce(value); setLoadPosition(0); setIsAnimating(false); setFeedback(null); SoundManager.tick(); }}
                />
                <div className="mt-1 flex justify-between text-xs text-slate-500"><span>none</span><span>maximum</span></div>
              </LuminaPanel>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <LuminaStat label="Load" value={currentScenario.label} accent="blue" />
            <LuminaStat label="Surface" value={frictionLabel[frictionLevel]} accent="amber" />
            <LuminaStat label="Position" value={`${loadPosition.toFixed(0)}%`} accent="emerald" />
            <LuminaStat label="Force evidence" value={diagnosticsRevealed ? `${thresholdForce.toFixed(1)} N threshold` : 'hidden until check'} accent={diagnosticsRevealed ? 'purple' : undefined} />
          </div>

          {currentChallenge?.mode === 'compare_conditions' && feedback && (
            <div className="grid gap-3 md:grid-cols-2">
              {(['a', 'b'] as const).map((side) => {
                const item = currentChallenge.scenarios[side];
                return (
                  <LuminaPanel key={side} accent={side === easierComparisonChoice(currentChallenge) ? 'emerald' : 'blue'} className="p-4">
                    <p className="font-mono text-xs text-slate-400">SETUP {side.toUpperCase()}</p>
                    <p className="mt-1 font-semibold text-white">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-300">Required push: {requiredPushForce(item).toFixed(1)} N</p>
                  </LuminaPanel>
                );
              })}
            </div>
          )}

          {feedback && (
            <LuminaFeedbackCard status={feedback.correct ? 'correct' : 'incorrect'} teachingNote={feedback.correct ? currentChallenge?.explainOnSolve : undefined}>
              {feedback.message}
            </LuminaFeedbackCard>
          )}
          {hintVisible && currentChallenge && (
            <LuminaFeedbackCard status="insight" label="Hint">{currentChallenge.hint}</LuminaFeedbackCard>
          )}

          <div className="flex flex-wrap gap-3">
            {currentChallenge ? (
              <>
                <LuminaButton tone="primary" onClick={handleCheck} disabled={currentChallenge.mode === 'compare_conditions' && !compareChoice}>
                  {currentChallenge.mode === 'compare_conditions' ? 'Reveal Force Evidence' : currentChallenge.mode === 'find_threshold' ? 'Test This Force' : 'Check This Design'}
                </LuminaButton>
                <LuminaButton tone="ghost" onClick={() => setHintVisible((visible) => !visible)}>{hintVisible ? 'Hide Hint' : 'Hint'}</LuminaButton>
                <LuminaButton tone="subtle" onClick={() => resetInteraction(currentChallenge)}>Reset Challenge</LuminaButton>
                {currentSolved && challengeIndex < challenges.length - 1 && <LuminaButton tone="primary" onClick={handleNext}>Next Challenge</LuminaButton>}
                {allSolved && <LuminaButton tone="primary" onClick={handleFinish} disabled={hasSubmitted}>{hasSubmitted ? 'Session Submitted' : 'Finish Session'}</LuminaButton>}
              </>
            ) : (
              <>
                <LuminaButton tone="primary" onClick={() => setIsAnimating(true)} disabled={pushForce === 0 || isAnimating}>Push</LuminaButton>
                <LuminaButton tone="danger" onClick={() => { setPushForce(0); setIsAnimating(true); }} disabled={loadPosition === 0 || isAnimating}>Release</LuminaButton>
                <LuminaButton tone="subtle" onClick={() => resetInteraction(undefined)}>Reset</LuminaButton>
              </>
            )}
          </div>

          {diagnosticsRevealed && (
            <LuminaPanel accent="cyan" className="p-5">
              <h4 className="font-semibold text-white">Force evidence</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                The load needs more than <span className="font-semibold text-cyan-300">{thresholdForce.toFixed(1)} N</span>: {parallelForce.toFixed(1)} N counters downhill gravity and {frictionForce.toFixed(1)} N counters friction.
                {showMA && ` Mechanical advantage is ${mechanicalAdvantage.toFixed(2)}.`}
              </p>
            </LuminaPanel>
          )}
        </LuminaCardContent>
      </LuminaCard>
    </div>
  );
};

export default RampLab;
