'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaChoiceChip, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { BuoyancyHarborMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import BuoyancyScene from './BuoyancyScene';
import type { HarborTarget, Slot } from './buoyancy3d';
import {
  MATERIAL_WORD, describeDropTest, dropTestFeedback, dropTestMatches, dropTestMiss, result,
  type BuoyancyBand, type BuoyancyChallenge, type BuoyancyTask, type Call,
} from './buoyancyModel';
import {
  EMPTY_DRAFT, HULL_SHAPES, HULL_SIZES, MATERIAL_LABEL, MAX_PENNIES, boatFeedback, boatMatches, boatMiss, boatName,
  describeBoat, floatsWith, isBuilt, shapeLabel, type BoatBuild, type BoatChallenge, type BoatDraft,
} from './boatModel';
import { clayGrams, describeShape, shapeFeedback, shapeMatches, shapeMiss, shapeWords } from './shapeModel';
import { MAX_SPOONS, describeSalt, floatsAt, saltFeedback, saltMatches, saltMiss } from './saltModel';
import { RULES, RULE_LABEL, describeRule, ruleFeedback, ruleMatches, ruleMiss, type Rule } from './ruleModel';
import { WHICH_LABEL, cargoFeedback, cargoMatches, cargoMiss, changedParts, describeCargo, sameBoat, type Which } from './cargoModel';
import {
  boatScene, buoyancyScene, cargoScene, ruleScene, saltScene, shapeScene, type BoatTest, type CargoTest, type DropStep, type SaltLog,
} from './buoyancyWorkspace';
import { buoyancyHarborBoss } from './buoyancyHarbor.boss';
import { HARBOR_LEVERS, PRACTICE_NOTE, leverDrawings, type HarborLeverCtx } from './buoyancyLevers';
import { leverScene } from '../../../components/live-activity/bossLevers';

export type { BuoyancyChallenge } from './buoyancyModel';

// ============================================================================
// Data contract
// ============================================================================

export interface BuoyancyHarborData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. Every thing, goal and result is chosen by code from the world model. */
  challenges: BuoyancyChallenge[];
  /** The session's task when it runs one mode (a mixed session names its first); each item carries its own `type`. */
  challengeType: BuoyancyTask;
  gradeBand: BuoyancyBand;
  /** Where the levers start (`config.difficulty`); unused until /add-support-tiers. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<BuoyancyHarborMetrics>) => void;
}

interface BuoyancyHarborProps {
  data: BuoyancyHarborData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  drop_test: { label: 'Drop test', icon: '🛟', accentColor: 'cyan' },
  find_the_rule: { label: 'Find the rule', icon: '🔎', accentColor: 'cyan' },
  make_it_float: { label: 'Make it float', icon: '🟤', accentColor: 'amber' },
  build_boat: { label: 'Boat build', icon: '⛵', accentColor: 'amber' },
  cargo_two_designs: { label: 'Two boats', icon: '⚖️', accentColor: 'amber' },
  salt_water: { label: 'Salt water', icon: '🧂', accentColor: 'cyan' },
};

const STEP_PROMPT: Record<DropStep, string> = {
  test: 'Test each thing: say your guess, then tap it and tap the water.',
  decide: 'Will the mystery thing float or sink? Then: which test helped you know? Tap it, and press Check.',
  done: '',
};
const BOAT_PROMPT = {
  build: 'Choose what your boat is made of, its shape and its size. Test it in the water, then press I\'m done!',
  water: 'Add pennies one at a time and watch. Take it out to change your boat.',
};
const SHAPE_PROMPT = {
  build: 'Choose a shape for the clay. Guess Float or Sink, and it goes in the water. Then press I\'m done!',
  water: 'Watch it. Add pennies one at a time if you like. Take it out to change its shape.',
};
const CARGO_PROMPT = {
  build: 'Build the boats: tap Boat A or Boat B to choose which one you are building.',
  predict: 'Before you test: which boat do you think will carry more pennies?',
  test: 'Put each boat in the water and add pennies one at a time until it sinks.',
  claim: 'Look at your lab notebook. Which boat carried more pennies? Then press Check.',
};
const RULE_PROMPT = {
  test: 'Test each thing: pick Float or Sink as your guess, and it drops into the water.',
  sort: 'Without testing: will each thing on a yellow stand float or sink? Pick what decides it, then press Check.',
};
const SALT_PROMPT = {
  test: 'Drop each food into the fresh water: pick Float or Sink as your guess, and it drops in.',
  salt: 'Add salt one spoon at a time and watch the foods. Too salty? Pour some out. Then press I\'m done!',
};

/** How long a dropped thing takes to fly in and come to rest before its result goes in the notebook. */
const SETTLE_MS = 2600;
/** A right boat is loaded with its goal, one penny at a time, this far apart. */
const DEMO_PENNY_MS = 320;

const verb = (c: Call) => (c === 'floats' ? 'float' : 'sink');
const pastOf = (c: Call) => (c === 'floats' ? 'Floated' : 'Sank');
const SHAPE_ICON: Record<string, string> = { ball: '●', flat: '▬', low_sides: '▭', tall_sides: '▯' };

/** The changes_marked lever's mark beside a part where boat B is different from boat A. */
const ChangedMark: React.FC<{ part: string }> = ({ part }) => (
  <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-200" data-harbor-changed={part}>changed</span>
);

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useBuoyancyProgress = useWorkspaceProgressFor('buoyancy-harbor');

const BuoyancyHarborSurface: React.FC<BuoyancyHarborProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `buoyancy-harbor-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Drop test
  const [step, setStep] = useState<DropStep>('test');
  const [dropped, setDropped] = useState<[boolean, boolean]>([false, false]);
  const [settled, setSettled] = useState<[boolean, boolean]>([false, false]);
  const [selected, setSelected] = useState<Slot | null>(0);
  const [call, setCall] = useState<Call | null>(null);
  const [evidence, setEvidence] = useState<0 | 1 | null>(null);
  const [mysteryDropped, setMysteryDropped] = useState(false);
  const [guessesMatched, setGuessesMatched] = useState(0);
  // Boat build
  const [boatDraft, setBoatDraft] = useState<BoatDraft>(EMPTY_DRAFT);
  const [launched, setLaunched] = useState(false);
  const [pennies, setPennies] = useState(0);
  const [boatTests, setBoatTests] = useState<BoatTest[]>([]);
  const [boatTestCount, setBoatTestCount] = useState(0);
  // Make it float: the guess before the clay goes in the water.
  const [shapeGuess, setShapeGuess] = useState<Call | null>(null);
  // Salt water: each food's guess and drop, the spoons of salt in the tank, and the notebook rows.
  const [saltGuesses, setSaltGuesses] = useState<Array<Call | null>>([null, null, null]);
  const [saltDropped, setSaltDropped] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [saltSettled, setSaltSettled] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [spoons, setSpoons] = useState(0);
  const [saltLog, setSaltLog] = useState<SaltLog[]>([]);
  // Find the rule: each test's guess and drop, the calls on the things to sort, the rule picked, and whether the things
  // to sort have been dropped (after a right check).
  const [ruleGuesses, setRuleGuesses] = useState<Array<Call | null>>([null, null, null]);
  const [ruleDropped, setRuleDropped] = useState<boolean[]>([false, false, false]);
  const [ruleSettled, setRuleSettled] = useState<boolean[]>([false, false, false]);
  const [ruleCalls, setRuleCalls] = useState<Array<Call | null>>([null, null]);
  const [rulePick, setRulePick] = useState<Rule | null>(null);
  const [ruleRevealed, setRuleRevealed] = useState(false);
  // Two boats: each boat as built (a given boat comes from the item), which one is on the panel, the guess, each boat's
  // latest test, and the claim.
  const [cargoA, setCargoA] = useState<BoatDraft>(EMPTY_DRAFT);
  const [cargoB, setCargoB] = useState<BoatDraft>(EMPTY_DRAFT);
  const [cargoActive, setCargoActive] = useState<'a' | 'b' | null>(null);
  const [cargoPrediction, setCargoPrediction] = useState<Which | null>(null);
  const [cargoTests, setCargoTests] = useState<CargoTest[]>([]);
  const [cargoClaim, setCargoClaim] = useState<Which | null>(null);
  // Shared
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' | 'insight' } | null>(null);
  const [thingsKey, setThingsKey] = useState('things-0');
  const [viewKey, setViewKey] = useState('start');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // In-item levers (`buoyancyLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<BuoyancyChallenge | null>(null);

  /** A fresh pier: no tests, no boat, the answer cleared. A new item, a practice item, or the full item back. */
  const resetWork = useCallback((key: string) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setVerdict(null); setFeedback(null); setCall(null); setEvidence(null);
    setLaunched(false); setPennies(0);
    setStep('test'); setDropped([false, false]); setSettled([false, false]);
    setSelected(0); setMysteryDropped(false);
    setBoatDraft(EMPTY_DRAFT); setBoatTests([]); setShapeGuess(null);
    setSaltGuesses([null, null, null]); setSaltDropped([false, false, false]); setSaltSettled([false, false, false]);
    setSpoons(0); setSaltLog([]);
    setRuleGuesses([null, null, null]); setRuleDropped([false, false, false]); setRuleSettled([false, false, false]);
    setRuleCalls([null, null]); setRulePick(null); setRuleRevealed(false);
    setCargoA(EMPTY_DRAFT); setCargoB(EMPTY_DRAFT); setCargoActive(null); setCargoPrediction(null); setCargoTests([]); setCargoClaim(null);
    setThingsKey(`things-${key}-${Date.now()}`);
  }, []);

  const progress = useBuoyancyProgress<BuoyancyChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: buoyancyHarborBoss.assignment!,
    // A fresh item clears the pier. Try again keeps the tests (and the boat as built, the salt, the sort and rule); it
    // clears only the drop test's answer and takes the boat out of the water.
    // A practice item stays through its own Try again.
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null); setCall(null); setEvidence(null);
      setLaunched(false); setPennies(0);
      if (retry) return;
      setPractice(null);
      resetWork(String(index));
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || verdict === 'correct';
  const sessionItem = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const current = practice ?? sessionItem;
  const drop = current?.type === 'drop_test' ? current : null;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  /** A runtime pull or the tier's starting position, on the session item only; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && (pulledLevers.includes(id) || !!sessionItem?.startLevers?.includes(id));
  /** A boat build, or the clay being shaped (a boat whose stuff and size are fixed). */
  const boatItem = current?.type === 'build_boat' || current?.type === 'make_it_float' ? current : null;
  const shapeItem = current?.type === 'make_it_float' ? current : null;
  const saltItem = current?.type === 'salt_water' ? current : null;
  const saltTesting = !!saltItem && saltItem.things.some((_, i) => !saltSettled[i]);
  const ruleItem = current?.type === 'find_the_rule' ? current : null;
  const ruleTesting = !!ruleItem && ruleItem.tested.some((_, i) => !ruleSettled[i]);
  const cargoItem = current?.type === 'cargo_two_designs' ? current : null;
  const boatA: BoatDraft = cargoItem?.given ?? cargoA;
  const boatB: BoatDraft = cargoItem?.givenB ?? cargoB;
  const activeKey: 'a' | 'b' = cargoActive ?? (cargoItem?.given && !cargoItem.givenB ? 'b' : 'a');
  const activeGiven = !!cargoItem && (activeKey === 'a' ? !!cargoItem.given : !!cargoItem.givenB);
  const cargoTested = (k: 'a' | 'b') => cargoTests.some(t => t.boat === k);

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<BuoyancyHarborMetrics>({
    primitiveType: 'buoyancy-harbor', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** A pass on the session item (a practice item is never scored). */
  const recordPass = () => {
    if (!current || practice) return;
    const attempts = progress.currentAttempts + 1;
    progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
  };

  // ── Drop test: the learner says a guess to the tutor (never graded), then taps a test and the water ──
  const dropTest = useCallback((i: 0 | 1) => {
    if (!drop || blocked || allChallengesComplete || step !== 'test' || dropped[i]) return;
    setDropped(d => (i === 0 ? [true, d[1]] : [d[0], true]));
    setSelected(dropped[1 - i] ? null : (1 - i) as Slot);
    SoundManager.select();
    const t = setTimeout(() => setSettled(s => (i === 0 ? [true, s[1]] : [s[0], true])), SETTLE_MS);
    timers.current.push(t);
  }, [drop, blocked, allChallengesComplete, step, dropped]);

  useEffect(() => {
    if (step === 'test' && settled[0] && settled[1]) { setStep('decide'); setSelected(null); }
  }, [step, settled]);

  const onTap = useCallback((target: HarborTarget) => {
    if (blocked || allChallengesComplete) return;
    if (target === 'water') {
      if (drop && step === 'test' && (selected === 0 || selected === 1)) dropTest(selected);
      return;
    }
    const slot = Number(target.slice(6)) as Slot;
    if (ruleItem) {
      if (ruleTesting && slot < ruleItem.tested.length && !ruleDropped[slot]) { setSelected(slot); SoundManager.tap(); }
      return;
    }
    if (!drop) return;
    if (step === 'test' && slot !== 2 && !dropped[slot]) { setSelected(slot); SoundManager.tap(); return; }
    if (step === 'decide' && (slot === 0 || slot === 1)) { setEvidence(slot); setFeedback(null); SoundManager.select(); }
  }, [drop, ruleItem, ruleTesting, ruleDropped, blocked, allChallengesComplete, step, dropped, selected, dropTest]);

  const checkDrop = () => {
    if (!drop || blocked || step !== 'decide' || !call || evidence == null) return;
    const answer = { call, evidence };
    const correct = dropTestMatches(drop, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: dropTestFeedback(drop, answer), status: correct ? 'correct' : 'incorrect' });
    if (correct) { SoundManager.playCorrect(); setMysteryDropped(true); setStep('done'); } else SoundManager.playIncorrect();
    progress.commitCheck(describeDropTest(drop, answer), correct, dropTestMiss(drop, answer));
    if (correct) recordPass();
  };

  // ── Boat build ────────────────────────────────────────────────────────────
  const boatLocked = !boatItem || blocked || allChallengesComplete || verdict === 'incorrect';
  /** The boat as built; the clay being shaped is always this item's clay, a ball until the learner picks a shape. */
  const buildDraft: BoatDraft = shapeItem ? { material: 'clay', size: shapeItem.size, shape: boatDraft.shape ?? 'ball' } : boatDraft;
  /** The boat on the build panel and in the tank: the build, or the two-boat item's boat on the panel. */
  const tankBoat = cargoItem ? (activeKey === 'a' ? boatA : boatB) : buildDraft;
  const sunk = launched && isBuilt(tankBoat) && !floatsWith(tankBoat, pennies);
  const choose = <K extends keyof BoatDraft>(k: K, v: BoatDraft[K]) => {
    if (boatLocked || launched) return;
    setBoatDraft(d => ({ ...d, [k]: v })); setFeedback(null); SoundManager.select();
  };
  const logTest = (t: BoatTest) => { setBoatTests(ts => [...ts, t]); setBoatTestCount(n => n + 1); };
  /** Into the water; the clay goes in on a guess, and sinking empty is its first test. */
  const launch = (guess?: Call) => {
    if (boatLocked || launched || !isBuilt(buildDraft)) return;
    if (shapeItem) {
      if (!guess) return;
      setShapeGuess(guess);
      if (!floatsWith(buildDraft, 0)) logTest({ name: shapeWords(buildDraft.shape), pennies: 0, sank: true, guess });
    }
    setLaunched(true); setPennies(0); setFeedback(null); SoundManager.select();
  };
  const testName = (b: BoatBuild) => (shapeItem ? shapeWords(b.shape) : boatName(b));
  const addPenny = () => {
    if (boatLocked || !launched || sunk || !isBuilt(buildDraft) || pennies >= MAX_PENNIES) return;
    const n = pennies + 1;
    setPennies(n); SoundManager.tap();
    if (!floatsWith(buildDraft, n)) logTest({ name: testName(buildDraft), pennies: n, sank: true, guess: shapeGuess });
  };
  const takeOut = () => {
    if (!launched || !isBuilt(buildDraft)) return;
    if (!sunk) logTest({ name: testName(buildDraft), pennies, sank: false, guess: shapeGuess });
    setLaunched(false); setPennies(0); setShapeGuess(null); SoundManager.tap();
  };
  const checkBoat = () => {
    if (!boatItem || boatLocked || !isBuilt(buildDraft)) return;
    const build = buildDraft;
    const correct = boatItem.type === 'make_it_float' ? shapeMatches(boatItem, build.shape) : boatMatches(boatItem, build);
    setVerdict(correct ? 'correct' : 'incorrect');
    if (boatItem.type === 'make_it_float') {
      setFeedback({ text: shapeFeedback(boatItem, build.shape), status: correct ? 'correct' : 'incorrect' });
      progress.commitCheck(describeShape(build.shape, shapeGuess), correct, shapeMiss(boatItem, build.shape));
    } else {
      setFeedback({ text: boatFeedback(boatItem, build), status: correct ? 'correct' : 'incorrect' });
      progress.commitCheck(describeBoat(build), correct, boatMiss(boatItem, build));
    }
    if (!correct) { SoundManager.playIncorrect(); setLaunched(false); setPennies(0); setShapeGuess(null); return; }
    // The world shows it: in the tank, loaded with the goal one penny at a time.
    SoundManager.playCorrect();
    recordPass();
    setLaunched(true); setPennies(0);
    for (let i = 1; i <= boatItem.goal; i++) timers.current.push(setTimeout(() => setPennies(i), 900 + i * DEMO_PENNY_MS));
  };

  // ── Two boats ─────────────────────────────────────────────────────────────
  const cargoLocked = !cargoItem || blocked || allChallengesComplete || verdict === 'incorrect';
  const bothBuilt = isBuilt(boatA) && isBuilt(boatB);
  const twinBoats = bothBuilt && sameBoat(boatA, boatB);
  const chooseCargo = <K extends keyof BoatDraft>(k: K, v: BoatDraft[K]) => {
    if (cargoLocked || launched || activeGiven) return;
    (activeKey === 'a' ? setCargoA : setCargoB)(d => ({ ...d, [k]: v }));
    // A changed boat must be tested again.
    setCargoTests(ts => ts.filter(t => t.boat !== activeKey));
    setCargoClaim(null); setFeedback(null); SoundManager.select();
  };
  const logCargo = (held: number) => {
    if (!isBuilt(tankBoat)) return;
    const t: CargoTest = { boat: activeKey, name: boatName(tankBoat), held };
    setCargoTests(ts => [...ts.filter(x => x.boat !== activeKey), t]);
    setBoatTestCount(n => n + 1);
  };
  const launchCargo = () => {
    if (cargoLocked || launched || !isBuilt(tankBoat) || !bothBuilt || twinBoats || !cargoPrediction) return;
    setLaunched(true); setPennies(0); setFeedback(null); SoundManager.select();
    if (!floatsWith(tankBoat, 0)) logCargo(0);
  };
  const addCargoPenny = () => {
    if (cargoLocked || !launched || sunk || !isBuilt(tankBoat) || pennies >= MAX_PENNIES) return;
    const n = pennies + 1;
    setPennies(n); SoundManager.tap();
    if (!floatsWith(tankBoat, n)) logCargo(n - 1);
  };
  const takeOutCargo = () => { if (launched) { setLaunched(false); setPennies(0); SoundManager.tap(); } };
  const cargoReady = !!cargoItem && bothBuilt && cargoTested('a') && cargoTested('b') && !!cargoClaim;
  const checkCargo = () => {
    if (!cargoItem || cargoLocked || launched || !cargoReady || !isBuilt(boatA) || !isBuilt(boatB)) return;
    const answer = { a: boatA, b: boatB, prediction: cargoPrediction, claim: cargoClaim! };
    const correct = cargoMatches(cargoItem, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: cargoFeedback(cargoItem, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeCargo(answer), correct, cargoMiss(cargoItem, answer));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Salt water ────────────────────────────────────────────────────────────
  const saltLocked = !saltItem || blocked || allChallengesComplete || verdict === 'incorrect';
  const dropFood = (i: number, guess: Call) => {
    if (saltLocked || !saltTesting || saltDropped[i]) return;
    const set = <T,>(xs: T[], v: T) => xs.map((x, k) => (k === i ? v : x));
    setSaltGuesses(g => set(g, guess));
    setSaltDropped(d => set(d, true) as [boolean, boolean, boolean]);
    const next = saltItem!.things.findIndex((_, k) => k !== i && !saltDropped[k]);
    setSelected(next < 0 ? null : next as Slot);
    if (guess === result(saltItem!.things[i])) setGuessesMatched(n => n + 1);
    SoundManager.select();
    timers.current.push(setTimeout(() => setSaltSettled(s => set(s, true) as [boolean, boolean, boolean]), SETTLE_MS));
  };
  /** A spoon in (+1) or some salty water poured out for fresh (-1); the notebook gets the new row. */
  const changeSalt = (by: 1 | -1) => {
    if (saltLocked || saltTesting) return;
    const n = Math.max(0, Math.min(MAX_SPOONS, spoons + by));
    if (n === spoons) return;
    setSpoons(n); setFeedback(null);
    setSaltLog(l => [...l, { spoons: n, floating: saltItem!.things.filter(t => floatsAt(t, n)).map(t => t.name) }]);
    if (by > 0) SoundManager.tap(); else SoundManager.select();
  };
  const checkSalt = () => {
    if (!saltItem || saltLocked || saltTesting) return;
    const correct = saltMatches(saltItem, spoons);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: saltFeedback(saltItem, spoons), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeSalt(saltItem, spoons), correct, saltMiss(saltItem, spoons));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Find the rule ─────────────────────────────────────────────────────────
  const ruleLocked = !ruleItem || blocked || allChallengesComplete || verdict === 'incorrect';
  const dropRuleTest = (i: number, guess: Call) => {
    if (ruleLocked || !ruleTesting || ruleDropped[i]) return;
    const set = <T,>(xs: T[], v: T) => xs.map((x, k) => (k === i ? v : x));
    setRuleGuesses(g => set(g, guess));
    setRuleDropped(d => set(d, true));
    const next = ruleItem!.tested.findIndex((_, k) => k !== i && !ruleDropped[k]);
    setSelected(next < 0 ? null : next);
    if (guess === result(ruleItem!.tested[i])) setGuessesMatched(n => n + 1);
    SoundManager.select();
    timers.current.push(setTimeout(() => setRuleSettled(s => set(s, true)), SETTLE_MS));
  };
  const ruleAnswer = { calls: ruleCalls, rule: rulePick };
  const ruleReady = !!ruleItem && ruleItem.toSort.every((_, i) => ruleCalls[i]) && !!rulePick;
  const checkRule = () => {
    if (!ruleItem || ruleLocked || ruleTesting || !ruleReady) return;
    const correct = ruleMatches(ruleItem, ruleAnswer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: ruleFeedback(ruleItem, ruleAnswer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeRule(ruleItem, ruleAnswer), correct, ruleMiss(ruleItem, ruleAnswer));
    if (correct) { SoundManager.playCorrect(); setRuleRevealed(true); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: BuoyancyHarborMetrics = {
      type: 'buoyancy-harbor', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      guessesMatched, boatTests: boatTestCount,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, guessesMatched, boatTestCount]);

  // What the tutor and the observer see, republished every render.
  // The lever set declares the levers and writes the support and onScreen facts (`leverScene`).
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const scene = drop ? buoyancyScene(drop, { step, settled, dropped, call, evidence, mysteryDropped })
      : ruleItem ? ruleScene(ruleItem, { settled: ruleSettled.slice(0, ruleItem.tested.length), guesses: ruleGuesses, calls: ruleCalls, rule: rulePick, revealed: ruleRevealed })
      : saltItem ? saltScene(saltItem, { settled: saltSettled, guesses: saltGuesses, spoons, log: saltLog })
      : cargoItem ? cargoScene(cargoItem, { a: boatA, b: boatB, active: activeKey, prediction: cargoPrediction, launched, pennies, tests: cargoTests, claim: cargoClaim })
        : shapeItem ? shapeScene(shapeItem, { draft: buildDraft, launched, pennies, tests: boatTests, guess: shapeGuess })
        : boatScene(boatItem as BoatChallenge, { draft: boatDraft, launched, pennies, tests: boatTests });
    const ctx: HarborLeverCtx = { settledTests: cargoItem ? cargoTests.length
      : (saltItem ? saltSettled : ruleItem ? ruleSettled : settled).filter(Boolean).length, boatLaunched: launched };
    const leverItem: BuoyancyChallenge = { ...sessionItem, supportTier: sessionItem.supportTier ?? data.supportTier };
    const shown = practice ? [] : [...pulledLevers, ...(sessionItem.startLevers ?? [])];
    const levers = practice ? [] : HARBOR_LEVERS.declare(leverItem, ctx, shown);
    const published = leverScene(scene, {
      support: practice ? '' : HARBOR_LEVERS.support(leverItem, ctx),
      onScreen: practice ? '' : HARBOR_LEVERS.onScreen(leverItem, ctx, shown),
    });
    workspace.current = {
      ...published,
      facts: { ...published.facts, ...(practice ? { practice: PRACTICE_NOTE } : {}) },
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item now.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const pulled = { item: sessionItem.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = HARBOR_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start on a fresh pier.
          setLeverState(pulled); resetWork(easier.id); setPractice(easier);
          return { practice: buoyancyHarborBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); resetWork(sessionItem.id); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  const things = useMemo(() => (drop ? [drop.tested[0], drop.tested[1], drop.mystery] : saltItem ? saltItem.things
    : ruleItem ? [...ruleItem.tested, ...ruleItem.toSort] : null), [drop, saltItem, ruleItem]);
  /** A rule item's things to sort stand on yellow stands after its tests. */
  const stands = useMemo(() => (ruleItem ? ruleItem.toSort.map((_, i) => ruleItem.tested.length + i) : undefined), [ruleItem]);
  const sceneDropped = saltItem ? saltDropped
    : ruleItem ? [...ruleItem.tested.map((_, i) => ruleDropped[i]), ...ruleItem.toSort.map(() => ruleRevealed)]
      : [dropped[0], dropped[1], mysteryDropped];
  const drawings = leverDrawings(current, leverOn);
  const boatState = useMemo(() => (boatItem || cargoItem ? { build: isBuilt(tankBoat) ? tankBoat : null, launched, pennies } : undefined),
    [boatItem, cargoItem, tankBoat, launched, pennies]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing to test at the harbor yet.</LuminaCardContent></LuminaCard>;
  }

  const dropRows = drop ? [
    ...drop.tested.map((t, i) => [
      t.name, MATERIAL_WORD[t.material],
      settled[i] ? pastOf(result(t)) : dropped[i] ? '…' : '—',
    ]),
    [`${drop.mystery.name} (mystery)`, MATERIAL_WORD[drop.mystery.material],
      mysteryDropped ? pastOf(result(drop.mystery)) : '?'],
  ] : [];
  const boatRows = boatTests.map(t => [t.name, ...(shapeItem ? [t.guess ? verb(t.guess) : '—'] : []), String(t.pennies), t.sank ? 'Sank' : 'Floated']);
  const cargoRows = (['a', 'b'] as const).flatMap(k => cargoTests.filter(t => t.boat === k)
    .map(t => [`Boat ${k.toUpperCase()}`, t.name, t.held ? `Carried ${t.held}, sank with the next one` : 'Sank with nothing in it']));
  const cargoStep = !cargoItem ? 'build' : !bothBuilt || twinBoats ? 'build' : !cargoPrediction ? 'predict'
    : !cargoTested('a') || !cargoTested('b') ? 'test' : 'claim';
  const cargoChanged = isBuilt(boatA) && isBuilt(boatB) ? changedParts(boatA, boatB) : [];
  const ruleRows = ruleItem ? [
    ...ruleItem.tested.map((t, i) => [t.name, MATERIAL_WORD[t.material], ruleGuesses[i] ? verb(ruleGuesses[i]!) : '—',
      ruleSettled[i] ? pastOf(result(t)) : ruleDropped[i] ? '…' : '—']),
    ...ruleItem.toSort.map((t, i) => [`${t.name} (on a stand)`, MATERIAL_WORD[t.material], ruleCalls[i] ? verb(ruleCalls[i]!) : '—',
      ruleRevealed ? pastOf(result(t)) : '?']),
  ] : [];
  const spoonLabel = (n: number) => (n ? `${n} ${n === 1 ? 'spoon' : 'spoons'}` : 'none');
  const saltRows = saltItem && !saltTesting
    ? [{ spoons: 0, floating: [] as string[] }, ...saltLog].map(l => [spoonLabel(l.spoons),
      ...saltItem.things.map(t => (l.floating.includes(t.name) ? 'Floats' : 'On the bottom'))])
    : [];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="cyan">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Harbor tests done!" celebrationMessage="You tested, recorded and used your evidence like a scientist." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="cyan">
            {practice && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300" data-practice>Practice</div>}
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-cyan-100/80" data-harbor-step={drop ? step : saltItem ? (saltTesting ? 'test' : 'salt') : ruleItem ? (ruleTesting ? 'test' : 'sort') : cargoItem ? cargoStep : launched ? 'water' : 'build'}>
              {drop ? STEP_PROMPT[step] : saltItem ? SALT_PROMPT[saltTesting ? 'test' : 'salt'] : ruleItem ? RULE_PROMPT[ruleTesting ? 'test' : 'sort']
                : cargoItem ? CARGO_PROMPT[cargoStep]
                : shapeItem ? SHAPE_PROMPT[launched ? 'water' : 'build']
                : launched ? BOAT_PROMPT.water : BOAT_PROMPT.build}
            </div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <BuoyancyScene className="h-[min(60vh,520px)] min-h-[320px] w-full"
              things={things} thingsKey={thingsKey} stands={stands}
              dropped={sceneDropped} spoons={saltItem ? spoons : 0}
              selected={(drop && step === 'test') || saltTesting || ruleTesting ? selected : null} evidence={drop && step === 'decide' ? evidence : null}
              finale={allChallengesComplete} boat={boatState} xray={drawings.xray} tags={drawings.tags}
              extras={drawings.extras} modelBoats={drawings.modelBoats} onTap={onTap} viewKey={viewKey} view={(boatItem || cargoItem) && launched ? 'boat' : ruleItem ? 'row' : 'start'} disabled={blocked || allChallengesComplete} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
              {drop && step === 'decide' ? 'Tap the test that helped you know · drag to turn'
                : drop && step === 'test' ? 'Tap a thing, then tap the water · drag to turn' : 'Drag to turn · pinch to zoom'}
            </div>
            {(boatItem || cargoItem) && launched && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-amber-200" data-harbor-pennies={pennies}>
                {cargoItem ? `Boat ${activeKey.toUpperCase()} · ` : ''}{sunk ? `It sank with ${pennies} ${pennies === 1 ? 'penny' : 'pennies'}!` : `Pennies in: ${pennies}`}
              </div>
            )}
            {saltItem && !saltTesting && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-cyan-100" data-harbor-spoons={spoons}>
                {`Salt in the water: ${spoonLabel(spoons)}`}
              </div>
            )}
          </div>

          {/* ── Drop test controls ── */}
          {!allChallengesComplete && drop && step === 'test' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {drop.tested.map((t, i) => (
                <LuminaPanel key={t.key} accent={selected === i ? 'cyan' : undefined} className="space-y-2 p-3">
                  <div className="text-sm text-slate-100">The {t.name} <span className="text-slate-400">· made of {MATERIAL_WORD[t.material]}</span></div>
                  {dropped[i]
                    ? <div className="text-sm text-slate-400">{settled[i] ? `It ${result(t) === 'floats' ? 'floated' : 'sank'}.` : 'Splash! Watch it…'}</div>
                    : (
                      <LuminaChoiceChip label="Drop it in" aria-label={`Drop the ${t.name} in the water`}
                        onClick={() => dropTest(i as 0 | 1)} disabled={blocked} />
                    )}
                </LuminaPanel>
              ))}
            </div>
          )}

          {!allChallengesComplete && drop && step !== 'test' && (
            <LuminaPanel className="space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-200">The {drop.mystery.name} will…</span>
                {(['floats', 'sinks'] as const).map(c => (
                  <LuminaChoiceChip key={c} label={verb(c)} aria-label={`The ${drop.mystery.name} will ${verb(c)}`} selected={call === c}
                    onClick={() => { setCall(c); setFeedback(null); SoundManager.select(); }} disabled={blocked || verdict === 'incorrect'} />
                ))}
              </div>
              {/* The second question opens once the call is made, so it reads as the next thing asked. */}
              {(call || evidence != null) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-200">Which test helped you know?</span>
                  {drop.tested.map((t, i) => (
                    <LuminaChoiceChip key={t.key} accent="amber" label={`the ${t.name}`} selected={evidence === i}
                      onClick={() => { setEvidence(i as 0 | 1); setFeedback(null); SoundManager.select(); }} disabled={blocked || verdict === 'incorrect'} />
                  ))}
                </div>
              )}
            </LuminaPanel>
          )}

          {/* ── Find the rule controls ── */}
          {!allChallengesComplete && ruleItem && ruleTesting && (
            <div className="grid gap-3 sm:grid-cols-3">
              {ruleItem.tested.map((t, i) => (
                <LuminaPanel key={t.key} accent={selected === i ? 'cyan' : undefined} className="space-y-2 p-3">
                  <div className="text-sm text-slate-100">The {t.name} <span className="text-slate-400">· made of {MATERIAL_WORD[t.material]}</span></div>
                  {ruleDropped[i]
                    ? <div className="text-sm text-slate-400">{ruleSettled[i] ? `It ${result(t) === 'floats' ? 'floated' : 'sank'}.` : 'Splash! Watch it…'}</div>
                    : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">Your guess:</span>
                        {(['floats', 'sinks'] as const).map(g => (
                          <LuminaChoiceChip key={g} label={g === 'floats' ? 'Float' : 'Sink'} aria-label={`Guess the ${t.name} will ${verb(g)}`}
                            onClick={() => dropRuleTest(i, g)} disabled={ruleLocked} />
                        ))}
                      </div>
                    )}
                </LuminaPanel>
              ))}
            </div>
          )}
          {!allChallengesComplete && ruleItem && !ruleTesting && (
            <LuminaPanel className="space-y-3 p-3" data-harbor-rule-panel="">
              {ruleItem.toSort.map((t, i) => (
                <div key={t.key} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-200">The {t.name} <span className="text-slate-400">· made of {MATERIAL_WORD[t.material]}</span> will…</span>
                  {(['floats', 'sinks'] as const).map(c => (
                    <LuminaChoiceChip key={c} label={verb(c)} aria-label={`The ${t.name} will ${verb(c)}`} selected={ruleCalls[i] === c}
                      onClick={() => { setRuleCalls(cs => cs.map((x, k) => (k === i ? c : x))); setFeedback(null); SoundManager.select(); }}
                      disabled={ruleLocked || ruleRevealed} />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <span className="text-sm text-slate-200">What decides float or sink?</span>
                {RULES.map(r => (
                  <LuminaChoiceChip key={r} accent="amber" label={RULE_LABEL[r]} aria-label={`What decides it: ${RULE_LABEL[r]}`} selected={rulePick === r}
                    onClick={() => { setRulePick(r); setFeedback(null); SoundManager.select(); }} disabled={ruleLocked || ruleRevealed} />
                ))}
              </div>
            </LuminaPanel>
          )}

          {/* ── Salt water controls ── */}
          {!allChallengesComplete && saltItem && saltTesting && (
            <div className="grid gap-3 sm:grid-cols-3">
              {saltItem.things.map((t, i) => (
                <LuminaPanel key={t.key} accent={selected === i ? 'cyan' : undefined} className="space-y-2 p-3">
                  <div className="text-sm text-slate-100">The {t.name}</div>
                  {saltDropped[i]
                    ? <div className="text-sm text-slate-400">{saltSettled[i] ? `It ${result(t) === 'floats' ? 'floated' : 'sank'}.` : 'Splash! Watch it…'}</div>
                    : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">Your guess:</span>
                        {(['floats', 'sinks'] as const).map(g => (
                          <LuminaChoiceChip key={g} label={g === 'floats' ? 'Float' : 'Sink'} aria-label={`Guess the ${t.name} will ${verb(g)}`}
                            onClick={() => dropFood(i, g)} disabled={saltLocked} />
                        ))}
                      </div>
                    )}
                </LuminaPanel>
              ))}
            </div>
          )}
          {!allChallengesComplete && saltItem && !saltTesting && (
            <LuminaPanel className="flex flex-wrap items-center gap-2 p-3" data-harbor-salt-panel="">
              <LuminaButton tone="primary" onClick={() => changeSalt(1)} disabled={saltLocked || spoons >= MAX_SPOONS}>Add a spoon of salt</LuminaButton>
              <LuminaButton tone="ghost" onClick={() => changeSalt(-1)} disabled={saltLocked || spoons === 0}>Pour some out, add fresh water</LuminaButton>
              {spoons >= MAX_SPOONS && <span className="text-xs text-slate-400">The salt jar is empty.</span>}
            </LuminaPanel>
          )}

          {/* ── Boat build controls ── */}
          {!allChallengesComplete && boatItem && (
            <LuminaPanel className="space-y-3 p-3" data-harbor-boat-panel="">
              {shapeItem ? (
                <div className="text-sm text-slate-200" data-harbor-clay={shapeItem.size}>
                  A {shapeItem.size} piece of clay <span className="text-slate-400">· {clayGrams(shapeItem)} grams, whatever its shape</span>
                </div>
              ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Made of</span>
                {boatItem.materials.map(m => (
                  <LuminaChoiceChip key={m} accent="amber" label={MATERIAL_LABEL[m]} aria-label={`Make it of ${MATERIAL_LABEL[m]}`}
                    selected={boatDraft.material === m} onClick={() => choose('material', m)} disabled={boatLocked || launched} />
                ))}
              </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Shape</span>
                {HULL_SHAPES.map(s => (
                  <LuminaChoiceChip key={s} accent="amber" label={`${SHAPE_ICON[s]} ${shapeLabel(s, buildDraft.material)}`} aria-label={`Shape: ${shapeLabel(s, buildDraft.material)}`}
                    selected={buildDraft.shape === s} onClick={() => choose('shape', s)} disabled={boatLocked || launched} />
                ))}
              </div>
              {!shapeItem && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Size</span>
                {HULL_SIZES.map(z => (
                  <LuminaChoiceChip key={z} accent="amber" label={z} aria-label={`Size: ${z}`}
                    selected={boatDraft.size === z} onClick={() => choose('size', z)} disabled={boatLocked || launched} />
                ))}
              </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                {!launched && shapeItem ? (
                  <>
                    <span className="text-xs text-slate-400">Your guess:</span>
                    {(['floats', 'sinks'] as const).map(g => (
                      <LuminaChoiceChip key={g} label={g === 'floats' ? 'Float' : 'Sink'} aria-label={`Guess the clay will ${verb(g)}, and put it in the water`}
                        onClick={() => launch(g)} disabled={boatLocked} />
                    ))}
                  </>
                ) : !launched
                  ? <LuminaButton tone="ghost" onClick={() => launch()} disabled={boatLocked || !isBuilt(boatDraft)}>Put it in the water</LuminaButton>
                  : (
                    <>
                      <LuminaButton tone="primary" onClick={addPenny} disabled={boatLocked || sunk || pennies >= MAX_PENNIES}>Add a penny</LuminaButton>
                      <LuminaButton tone="ghost" onClick={takeOut} disabled={blocked}>{sunk ? 'Fish it out' : 'Take it out'}</LuminaButton>
                    </>
                  )}
              </div>
            </LuminaPanel>
          )}

          {/* ── Two boats controls ── */}
          {!allChallengesComplete && cargoItem && (
            <LuminaPanel className="space-y-3 p-3" data-harbor-cargo-panel="">
              <div className="flex flex-wrap items-center gap-2">
                {(['a', 'b'] as const).map(k => (
                  <LuminaChoiceChip key={k} label={`Boat ${k.toUpperCase()}${cargoTested(k) ? ' ✓' : ''}`} aria-label={`Show boat ${k.toUpperCase()}`}
                    selected={activeKey === k} onClick={() => { setCargoActive(k); SoundManager.tap(); }} disabled={launched || blocked} />
                ))}
                {activeGiven && <span className="text-xs text-slate-400">Built for you</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Made of{drawings.changes && cargoChanged.includes('material') && <ChangedMark part="material" />}</span>
                {cargoItem.materials.map(m => (
                  <LuminaChoiceChip key={m} accent="amber" label={MATERIAL_LABEL[m]} aria-label={`Make it of ${MATERIAL_LABEL[m]}`}
                    selected={tankBoat.material === m} onClick={() => chooseCargo('material', m)} disabled={cargoLocked || launched || activeGiven} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Shape{drawings.changes && cargoChanged.includes('shape') && <ChangedMark part="shape" />}</span>
                {HULL_SHAPES.map(sh => (
                  <LuminaChoiceChip key={sh} accent="amber" label={`${SHAPE_ICON[sh]} ${shapeLabel(sh, tankBoat.material)}`} aria-label={`Shape: ${shapeLabel(sh, tankBoat.material)}`}
                    selected={tankBoat.shape === sh} onClick={() => chooseCargo('shape', sh)} disabled={cargoLocked || launched || activeGiven} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-24 text-sm text-slate-200">Size{drawings.changes && cargoChanged.includes('size') && <ChangedMark part="size" />}</span>
                {HULL_SIZES.map(z => (
                  <LuminaChoiceChip key={z} accent="amber" label={z} aria-label={`Size: ${z}`}
                    selected={tankBoat.size === z} onClick={() => chooseCargo('size', z)} disabled={cargoLocked || launched || activeGiven} />
                ))}
              </div>
              {twinBoats && <div className="text-sm text-amber-200">Boat B must be different from boat A.</div>}
              {bothBuilt && !twinBoats && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-200">Your guess: which will carry more?</span>
                  {(['a', 'b', 'same'] as const).map(w => (
                    <LuminaChoiceChip key={w} label={WHICH_LABEL[w]} aria-label={`Guess: ${WHICH_LABEL[w]}`} selected={cargoPrediction === w}
                      onClick={() => { setCargoPrediction(w); SoundManager.select(); }} disabled={cargoLocked || cargoTests.length > 0} />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                {!launched
                  ? <LuminaButton tone="ghost" onClick={launchCargo} disabled={cargoLocked || !bothBuilt || twinBoats || !cargoPrediction}>{`Put boat ${activeKey.toUpperCase()} in the water`}</LuminaButton>
                  : (
                    <>
                      <LuminaButton tone="primary" onClick={addCargoPenny} disabled={cargoLocked || sunk || pennies >= MAX_PENNIES}>Add a penny</LuminaButton>
                      <LuminaButton tone="ghost" onClick={takeOutCargo} disabled={blocked}>{sunk ? 'Fish it out' : 'Take it out'}</LuminaButton>
                    </>
                  )}
              </div>
              {cargoTested('a') && cargoTested('b') && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-200">Which boat carried more pennies?</span>
                  {(['a', 'b', 'same'] as const).map(w => (
                    <LuminaChoiceChip key={w} accent="amber" label={WHICH_LABEL[w]} aria-label={`Carried more: ${WHICH_LABEL[w]}`} selected={cargoClaim === w}
                      onClick={() => { setCargoClaim(w); setFeedback(null); SoundManager.select(); }} disabled={cargoLocked || launched} />
                  ))}
                </div>
              )}
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && cargoItem && (
              <LuminaActionButton action="check" onClick={checkCargo} disabled={cargoLocked || launched || !cargoReady}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && drop && step === 'decide' && (
              <LuminaActionButton action="check" onClick={checkDrop} disabled={blocked || verdict === 'incorrect' || !call || evidence == null}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && ruleItem && !ruleTesting && (
              <LuminaActionButton action="check" onClick={checkRule} disabled={ruleLocked || ruleRevealed || !ruleReady}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && boatItem && (
              <LuminaActionButton action="check" onClick={checkBoat} disabled={boatLocked || !isBuilt(buildDraft)}>I&apos;m done!</LuminaActionButton>
            )}
            {!allChallengesComplete && saltItem && !saltTesting && (
              <LuminaActionButton action="check" onClick={checkSalt} disabled={saltLocked}>I&apos;m done!</LuminaActionButton>
            )}
            <LuminaButton tone="ghost" onClick={() => setViewKey(`reset-${Date.now()}`)}>Turn back to the start</LuminaButton>
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}>
              <p>{feedback.text}</p>
            </LuminaFeedbackCard>
          )}

          {!allChallengesComplete && drop && (
            <LuminaTable caption="Lab notebook" accent="cyan" columns={['Thing', 'Made of', 'What happened']} rows={dropRows} />
          )}
          {!allChallengesComplete && ruleItem && (
            <LuminaTable caption="Lab notebook" accent="cyan" columns={['Thing', 'Made of', 'Guess', 'What happened']} rows={ruleRows} />
          )}
          {!allChallengesComplete && boatItem && boatRows.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber" columns={shapeItem ? ['Shape', 'Guess', 'Pennies in', 'What happened'] : ['Boat', 'Pennies in', 'What happened']} rows={boatRows} />
          )}
          {!allChallengesComplete && cargoItem && cargoRows.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber" columns={['Boat', 'Built', 'Test']} rows={cargoRows} />
          )}
          {!allChallengesComplete && cargoItem && drawings.pennyRows && cargoTests.length > 0 && (
            <div className="space-y-1 rounded-lg border border-white/10 p-3" data-harbor-penny-rows="">
              {(['a', 'b'] as const).map(k => {
                const t = cargoTests.find(x => x.boat === k);
                return (
                  <div key={k} className="flex items-center gap-2" data-harbor-penny-row={k}>
                    <span className="w-16 text-xs text-slate-300">Boat {k.toUpperCase()}</span>
                    <div className="flex flex-wrap gap-1">
                      {t ? Array.from({ length: t.held }, (_, i) => <span key={i} className="h-3 w-3 rounded-full bg-amber-400" />)
                        : <span className="text-xs text-slate-500">not tested</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!allChallengesComplete && saltItem && saltRows.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="cyan" columns={['Salt', ...saltItem.things.map(t => `The ${t.name}`)]} rows={saltRows} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const BuoyancyHarbor = withWorkspaceOnly<BuoyancyHarborProps>('buoyancy-harbor',
  BuoyancyHarborSurface, props => props.data.title);

/**
 * The harbor runs only on the teaching workspace: the tutor is present, each mode's own check commits (the drop test's
 * and the rule sort's Check, the boat's and the salt's I'm done!), and the runtime moves to the next item. Outside a bound session the "needs the tutor"
 * card shows.
 */
export default BuoyancyHarbor;
