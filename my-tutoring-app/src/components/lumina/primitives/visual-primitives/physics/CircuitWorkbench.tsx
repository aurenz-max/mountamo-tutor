'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaChoiceChip, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { CircuitWorkbenchMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import CircuitScene from './CircuitScene';
import type { CircuitTarget } from './circuit3d';
import {
  bulbName, clipWords, clipsOf, describeCircuit, evaluate, reachedFromPlus, type Faults, lightItFeedback, goalMet, lightItMiss, sameWire, wire, wireKey,
  type BulbColor, type CircuitChallenge, type CircuitTask, type Clip, type Wire,
} from './circuitModel';
import {
  allLit, breakFeedback, breakMatches, breakMiss, breakState, describeBreak, fixWords, partWords,
  type BreakFix, type BrokenPart,
} from './breakModel';
import {
  MATERIAL_WORDS, conducts, conductorFeedback, conductorMatches, conductorMiss, describeConductor, type CondThing, type LightCall,
} from './conductorModel';
import { arrangementOf, twoBulbFeedback, twoBulbMatches, twoBulbMiss } from './twoBulbModel';
import { describeSwitch, switchFeedback, switchMiss, switchWorks } from './switchModel';
import {
  DEVICES, PART_WORDS, TRAY, describeDevice, deviceFeedback, deviceMatches, deviceMiss, type TrayPart,
} from './deviceModel';
import {
  MAGNET_MATERIAL_WORDS, describeMagnet, magnetFeedback, magnetMatches, magnetMiss, pulled, type MagnetThing, type PullCall,
} from './magnetModel';
import {
  describePoles, flip, pairResult, pairWords, poleResult, polesFeedback, polesMatch, polesMiss, testedBothWays,
  type Pole, type PoleResult, type PoleTest,
} from './poleModel';
import {
  MARKS, callAnswer, callWords, describeDistance, distanceFeedback, distanceMatch, distanceMiss, magnetName, pullsAt, readyToDecide,
  type DistTest,
} from './distanceModel';
import {
  CORE_WORDS, MAX_TURNS, clipsLifted, strength, describeElectro, electroFeedback, electroMiss, type Core, type ElectroBuild,
} from './electroModel';
import { breakScene, circuitScene, conductorScene, deviceScene, distanceScene, electroScene, magnetScene, poleScene, switchScene, twoBulbScene, type FixLog, type LightGuess } from './circuitWorkspace';
import { circuitWorkbenchBoss } from './circuitWorkbench.boss';
import { CIRCUIT_LEVERS, MAGNET_TAGS_LEVER, POLE_TAGS_LEVER, PRACTICE_NOTE, PULL_MARKS_LEVER, STRENGTH_METER_LEVER, XRAY_LEVER, type CircuitLeverCtx } from './circuitLevers';
import { leverScene } from '../../../components/live-activity/bossLevers';

export type { CircuitChallenge } from './circuitModel';

// ============================================================================
// Data contract
// ============================================================================

export interface CircuitWorkbenchData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. Every part, wire, fault and result is chosen by code from the circuit model. */
  challenges: CircuitChallenge[];
  /** The session's task when it runs one mode (a mixed session names its first); each item carries its own `type`. */
  challengeType: CircuitTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the levers start (`config.difficulty`); unused until /add-support-tiers. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CircuitWorkbenchMetrics>) => void;
}

interface CircuitWorkbenchProps {
  data: CircuitWorkbenchData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  light_it: { label: 'Light it up', icon: '💡', accentColor: 'amber' },
  find_the_break: { label: 'Find the break', icon: '🔧', accentColor: 'amber' },
  conductor_test: { label: 'Conductor test', icon: '🥄', accentColor: 'amber' },
  add_a_switch: { label: 'Add a switch', icon: '🎚️', accentColor: 'amber' },
  two_bulbs: { label: 'Two bulbs', icon: '💡', accentColor: 'amber' },
  build_device: { label: 'Build a device', icon: '🛠️', accentColor: 'amber' },
  magnet_test: { label: 'Magnet test', icon: '🧲', accentColor: 'amber' },
  magnet_poles: { label: 'Magnet poles', icon: '🧲', accentColor: 'amber' },
  magnet_distance: { label: 'Magnet distance', icon: '🧲', accentColor: 'amber' },
  electromagnet: { label: 'Electromagnet', icon: '🧲', accentColor: 'amber' },
};

const PROMPT = {
  guess: 'Look at the wires. If the battery goes in like this, will the bulb light? Guess, and the battery goes in.',
  wire: 'Tap a clip, then another clip, to add a wire. Tap Remove to take one off. Then press I\'m done!',
  breakGuess: 'Which part do you think is broken? Guess first.',
  breakTest: 'Try one fix at a time and watch the light. Then tap what was broken and press Check.',
  condTest: 'Pick a thing: guess Light or Off, and it goes across the gap. Watch the bulb.',
  condSort: 'Without testing: will each thing on the right light the bulb? Then press Check.',
  magTest: 'Pick a thing: guess Pulls or Stays, and it goes under the magnet. Watch it.',
  magSort: 'Without testing: will the magnet pull each thing on the right? Then press Check.',
  poleFirst: 'Will they pull together or push apart? Tell your tutor. Then tap the left magnet to slide them together.',
  poleTurn: 'Now tap the right magnet to turn it round, and test again.',
  poleCall: 'You tested both ways. Now answer the question below, then press Check.',
  distFirst: 'Will the magnet pull the ball from there? Tell your tutor. Then tap the magnet to try it.',
  distTest: 'Tap a mark to move the ball, then tap the magnet again. Try near and far.',
  distTestTwo: 'Tap a mark to move a ball, then tap its magnet. Try near and far with both magnets.',
  distDecide: 'You tried near and far. Now answer the question below, then press Check.',
  emFirst: 'Will it pick up any clips? Tell your tutor. Then tap the clips to dip it in.',
  emTest: 'Tap the core to wrap more wire, tap the switch, then tap the clips to test. Press "I\'m done!" when it picks up the right number.',
};

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useCircuitProgress = useWorkspaceProgressFor('circuit-workbench');

const CircuitWorkbenchSurface: React.FC<CircuitWorkbenchProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `circuit-workbench-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Light it
  const [guess, setGuess] = useState<LightGuess | null>(null);
  const [powered, setPowered] = useState(false);
  const [wires, setWires] = useState<Wire[]>([]);
  const [selected, setSelected] = useState<Clip | null>(null);
  // Find the break: the guess, the fixes tried (in order) and what each did, and the part named as broken.
  const [breakGuess, setBreakGuess] = useState<BrokenPart | null>(null);
  const [fixes, setFixes] = useState<BreakFix[]>([]);
  const [fixLog, setFixLog] = useState<FixLog[]>([]);
  const [claim, setClaim] = useState<BrokenPart | null>(null);
  // Conductor test: each test's guess and whether it has been in the gap, the thing in the gap now, the calls on the
  // things to sort, and whether they have been tested (after a right check).
  const [ctGuesses, setCtGuesses] = useState<Array<LightCall | null>>([null, null, null]);
  const [ctTested, setCtTested] = useState<boolean[]>([false, false, false]);
  const [inGap, setInGap] = useState<CondThing | null>(null);
  const [ctCalls, setCtCalls] = useState<Array<LightCall | null>>([null, null]);
  const [ctRevealed, setCtRevealed] = useState(false);
  // Add a switch: whether the switch is on (closed).
  const [switchOn, setSwitchOn] = useState(false);
  // Two bulbs: the bulbs taken out of their holders to test.
  const [outBulbs, setOutBulbs] = useState<BulbColor[]>([]);
  // Build a device: the parts taken from the tray.
  const [parts, setParts] = useState<TrayPart[]>([]);
  // Magnet test: each test's guess and whether it has been under the magnet, the thing under it now, the calls on the
  // things to decide, and whether they have been tested (after a right check).
  const [mtGuesses, setMtGuesses] = useState<Array<PullCall | null>>([null, null, null]);
  const [mtTested, setMtTested] = useState<boolean[]>([false, false, false]);
  const [held, setHeld] = useState<MagnetThing | null>(null);
  const [mtCalls, setMtCalls] = useState<Array<PullCall | null>>([null, null]);
  const [mtRevealed, setMtRevealed] = useState(false);
  // Magnet poles: the right magnet's real pole facing the left one, the tests on the bench (the last one's number slides
  // the magnet in the 3D bench), the calls on the untested pairs, the pole named for a striped end, and a right check.
  const [pFacing, setPFacing] = useState<Pole>('N');
  const [pTests, setPTests] = useState<PoleTest[]>([]);
  const [pShown, setPShown] = useState<{ n: number; result: PoleResult } | null>(null);
  const [pCalls, setPCalls] = useState<Array<PoleResult | null>>([null, null]);
  const [pStriped, setPStriped] = useState<Pole | null>(null);
  const [pRevealed, setPRevealed] = useState(false);
  // Magnet distance: each ruler's ball mark and whether it is stuck to its magnet, the tries (the last one's number
  // jiggles its magnet in the 3D bench), the mark named, the calls, the magnet picked, and a right check.
  const [dBalls, setDBalls] = useState<Array<number | null>>([null, null]);
  const [dStuck, setDStuck] = useState<boolean[]>([false, false]);
  const [dTests, setDTests] = useState<DistTest[]>([]);
  const [dShown, setDShown] = useState<{ n: number; ruler: number } | null>(null);
  const [dReach, setDReach] = useState<number | null>(null);
  const [dCalls, setDCalls] = useState<Array<boolean | null>>([null, null]);
  const [dStronger, setDStronger] = useState<number | null>(null);
  const [dRevealed, setDRevealed] = useState(false);
  // Electromagnet: the build on the bench, each dip's build, the clips hanging now, the last dip (its number lowers the
  // core in the 3D bench) and what the last action did.
  const [emBuild, setEmBuild] = useState<ElectroBuild>({ core: 'steel', turns: 0, batteries: 1, on: false });
  const [emTests, setEmTests] = useState<ElectroBuild[]>([]);
  const [emHanging, setEmHanging] = useState(0);
  const [emDip, setEmDip] = useState<{ n: number } | null>(null);
  const [emStatus, setEmStatus] = useState<string | null>(null);
  // Shared
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [partsKey, setPartsKey] = useState('parts-0');
  // In-item levers (`circuitLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<CircuitChallenge | null>(null);
  const [guessesMatched, setGuessesMatched] = useState(0);

  const openItem = useCallback((c: CircuitChallenge | undefined, key: string) => {
    setGuess(null); setPowered(false); setSelected(null);
    setWires(c?.type === 'light_it' || c?.type === 'add_a_switch' || c?.type === 'two_bulbs' ? c.start.map(w => wire(w[0], w[1])) : []);
    setSwitchOn(false); setOutBulbs([]); setParts([]);
    setMtGuesses([null, null, null]); setMtTested([false, false, false]); setHeld(null); setMtCalls([null, null]); setMtRevealed(false);
    // The item's starting side; without one, a striped magnet's striped end faces, a lettered one's same end.
    setPFacing(c?.type === 'magnet_poles' ? (c.bStart ?? (c.mystery ? c.striped! : c.aEnd)) : 'N');
    setPTests([]); setPShown(null); setPCalls([null, null]); setPStriped(null); setPRevealed(false);
    setDBalls(c?.type === 'magnet_distance' ? c.magnets.map((_, i) => c.ballStart?.[i] ?? 4) : [null, null]);
    if (c?.type === 'electromagnet') setEmBuild({ ...c.start, on: false });
    setEmTests([]); setEmHanging(0); setEmDip(null); setEmStatus(null);
    setDStuck([false, false]); setDTests([]); setDShown(null); setDReach(null); setDCalls([null, null]); setDStronger(null); setDRevealed(false);
    // A device's battery is in from the start: there is nothing to guess about an empty table.
    if (c?.type === 'build_device') setPowered(true);
    setBreakGuess(null); setFixes([]); setFixLog([]); setClaim(null);
    setCtGuesses([null, null, null]); setCtTested([false, false, false]); setInGap(null); setCtCalls([null, null]); setCtRevealed(false);
    setPartsKey(`parts-${key}-${Date.now()}`);
  }, []);

  const progress = useCircuitProgress<CircuitChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: circuitWorkbenchBoss.assignment!,
    // A fresh item puts its parts and wires on the table. Try again keeps the wires (or the fixes tried).
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null); setSelected(null);
      if (retry) return;
      setPractice(null);
      openItem(challenges[index], String(index));
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const sessionItem = challenges[currentIndex] ?? null;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const current = practice ?? sessionItem;
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  /** A runtime pull or the tier's starting position, on the session item only; never drawn on a practice item. */
  const leverOn = (id: string) => !practice && (pulledLevers.includes(id) || !!sessionItem?.startLevers?.includes(id));
  const lightItem = current?.type === 'light_it' ? current : null;
  const switchItem = current?.type === 'add_a_switch' ? current : null;
  const twoItem = current?.type === 'two_bulbs' ? current : null;
  /** An item the learner wires clip to clip: light it, add a switch, or two bulbs. */
  const deviceItem = current?.type === 'build_device' ? current : null;
  const magnetItem = current?.type === 'magnet_test' ? current : null;
  const mtTesting = !!magnetItem && magnetItem.tested.some((_, i) => !mtTested[i]);
  const poleItem = current?.type === 'magnet_poles' ? current : null;
  const poleTesting = !!poleItem && !testedBothWays(pTests);
  const distItem = current?.type === 'magnet_distance' ? current : null;
  const distTesting = !!distItem && !readyToDecide(distItem, dTests);
  const emItem = current?.type === 'electromagnet' ? current : null;
  const deviceLoads = parts.filter((x): x is BulbColor => x !== 'switch');
  const wiringItem = lightItem ?? switchItem ?? twoItem ?? (deviceItem ? { ...deviceItem, bulbs: deviceLoads } : null);
  /** The loads on the table: the item's, or the parts a device build took from the tray. */
  const tableBulbs: BulbColor[] = magnetItem || poleItem || distItem || emItem ? [] : deviceItem ? deviceLoads : current && 'bulbs' in current ? current.bulbs : [];
  /** A switch on the table: the add-a-switch item's, or one taken from the tray. */
  const hasSwitch = !!switchItem || (!!deviceItem && parts.includes('switch'));
  const target: BulbColor = lightItem?.target ?? 'red';
  const breakItem = current?.type === 'find_the_break' ? current : null;
  const condItem = current?.type === 'conductor_test' ? current : null;
  const condTesting = !!condItem && condItem.tested.some((_, i) => !ctTested[i]);
  /** The battery is in: a break or conductor item from the start, a wiring item after the guess. */
  const on = !!breakItem || !!condItem || powered;
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;

  /** What is on the table: the learner's wires, or a break item's device after the fixes tried. */
  const table = useMemo(() => {
    if (breakItem) {
      const s = breakState(breakItem, fixes);
      const looseWire = breakItem.fault.kind === 'loose_wire' && s.wires.length < breakItem.wires.length
        ? breakItem.wires[breakItem.fault.wire!] : null;
      return { wires: s.wires, loose: looseWire, faults: s.faults as Faults, ...evaluate(breakItem.bulbs, s.wires, s.faults) };
    }
    if (magnetItem || poleItem || distItem || emItem) return { wires: [] as Wire[], loose: null, faults: {} as Faults, lit: [] as BulbColor[], short: false };
    if (condItem) return { wires: [wire('bat+', 'red.left')], loose: null, faults: {} as Faults, lit: (inGap && conducts(inGap) ? ['red'] : []) as BulbColor[], short: false };
    const faults: Faults = { switchClosed: hasSwitch && switchOn, burnt: twoItem ? outBulbs : undefined };
    return { wires, loose: null, faults, ...(wiringItem ? evaluate(wiringItem.bulbs, wires, faults) : { lit: [] as BulbColor[], short: false }) };
  }, [magnetItem, poleItem, distItem, emItem, breakItem, wiringItem, hasSwitch, twoItem, outBulbs, switchOn, condItem, inGap, fixes, wires]);

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<CircuitWorkbenchMetrics>({
    primitiveType: 'circuit-workbench', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const recordPass = () => {
    if (!current || practice) return;
    const attempts = progress.currentAttempts + 1;
    progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
  };

  // ── Light it: the guess puts the battery in, then wiring ──────────────────
  const makeGuess = (g: LightGuess) => {
    if (!wiringItem || locked || powered) return;
    setGuess(g); setPowered(true);
    const lit = evaluate(wiringItem.bulbs, wires).lit.includes(target);
    if ((g === 'lights') === lit) setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const tapClip = (clip: Clip) => {
    if (!wiringItem || locked || !powered) return;
    if (!selected) { setSelected(clip); SoundManager.tap(); return; }
    if (selected === clip) { setSelected(null); return; }
    const w = wire(selected, clip);
    setSelected(null);
    if (wires.some(x => sameWire(x, w)) || wires.length >= wiringItem.maxWires) { SoundManager.tap(); return; }
    setWires(ws => [...ws, w]); setFeedback(null); SoundManager.select();
  };
  const onTap = (t: CircuitTarget) => {
    if (t === 'em:coil') wrap(1);
    else if (t === 'em:switch') toggleEmSwitch();
    else if (t === 'em:battery') toggleBattery();
    else if (t === 'em:clips') dip();
    else if (t.startsWith('core:')) pickCore(t.slice(5) as Core);
    else if (t.startsWith('mark:')) { const [, r, k] = t.split(':').map(Number); placeBall(r, k); }
    else if (t === 'mag:a') { if (distItem) tryMagnet(0); else slideTogether(); }
    else if (t === 'mag:b') { if (distItem) tryMagnet(1); else turnMagnet(); }
    else tapClip(t.slice(5) as Clip);
  };
  const removeWire = (w: Wire) => {
    if (locked || !powered) return;
    setWires(ws => ws.filter(x => !sameWire(x, w))); setFeedback(null); SoundManager.tap();
  };
  const flipSwitch = () => {
    if (!hasSwitch || locked || !powered) return;
    setSwitchOn(v => !v); setFeedback(null); SoundManager.tap();
  };
  const checkSwitch = () => {
    if (!switchItem || locked || !powered) return;
    const correct = switchWorks(wires);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: switchFeedback(wires), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeSwitch(wires), correct, switchMiss(wires));
    if (correct) { SoundManager.playCorrect(); setSwitchOn(true); recordPass(); } else SoundManager.playIncorrect();
  };
  const toggleBulb = (b: BulbColor) => {
    if (!twoItem || locked || !powered) return;
    setOutBulbs(o => (o.includes(b) ? o.filter(x => x !== b) : [...o, b])); setFeedback(null); SoundManager.tap();
  };
  const checkTwo = () => {
    if (!twoItem || locked || !powered) return;
    const correct = twoBulbMatches(twoItem, wires);
    const a = arrangementOf(wires);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: twoBulbFeedback(twoItem, wires), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(`${describeCircuit({ ...twoItem, type: 'light_it', target: 'red' }, wires)}; the bulbs are ${a === 'row' ? 'in a row' : a === 'side_by_side' ? 'side by side' : 'not both lit'}`,
      correct, twoBulbMiss(twoItem, wires));
    setOutBulbs([]);
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };
  /** Take a part from the tray or put it back; its wires come off with it, and the table is rebuilt. */
  const togglePart = (part: TrayPart) => {
    if (!deviceItem || locked) return;
    const next = parts.includes(part) ? parts.filter(x => x !== part) : [...parts, part];
    const gone = (clip: string) => (part === 'switch' ? clip.startsWith('sw.') : clip.startsWith(`${part}.`));
    if (parts.includes(part)) setWires(ws => ws.filter(w => !gone(w[0]) && !gone(w[1])));
    if (part === 'switch') setSwitchOn(false);
    setParts(next); setSelected(null); setFeedback(null);
    setPartsKey(`parts-${deviceItem.id}-${next.join('-')}`);
    SoundManager.select();
  };
  const checkDevice = () => {
    if (!deviceItem || locked) return;
    const build = { parts, wires };
    const correct = deviceMatches(deviceItem, build);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: deviceFeedback(deviceItem, build), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeDevice(deviceItem, build), correct, deviceMiss(deviceItem, build));
    if (correct) { SoundManager.playCorrect(); setSwitchOn(true); recordPass(); } else SoundManager.playIncorrect();
  };
  const checkLight = () => {
    if (deviceItem) { checkDevice(); return; }
    if (switchItem) { checkSwitch(); return; }
    if (twoItem) { checkTwo(); return; }
    if (!lightItem || locked || !powered) return;
    const correct = goalMet(lightItem, wires);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: lightItFeedback(lightItem, wires), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeCircuit(lightItem, wires), correct, lightItMiss(lightItem, wires));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Find the break: guess, try fixes one at a time, name the broken part ──
  const breakParts: BrokenPart[] = breakItem ? ['battery', ...breakItem.bulbs.map(b => `bulb:${b}` as BrokenPart), 'wire'] : [];
  const breakFixes: BreakFix[] = breakItem ? ['battery', ...breakItem.bulbs.map(b => `bulb:${b}` as BreakFix), 'clip'] : [];
  const tryFix = (f: BreakFix) => {
    if (!breakItem || locked || !breakGuess || fixes.includes(f)) return;
    const next = [...fixes, f];
    setFixes(next); setFeedback(null);
    setFixLog(l => [...l, { fix: f, lit: allLit(breakItem, next) }]);
    SoundManager.select();
  };
  const checkBreak = () => {
    if (!breakItem || locked || !claim) return;
    const answer = { fixes, claim };
    const correct = breakMatches(breakItem, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: breakFeedback(breakItem, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeBreak(breakItem, answer), correct, breakMiss(breakItem, answer));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Conductor test: a guess puts a test thing across the gap; then calls on the rest ──
  const testThing = (i: number, g: LightCall) => {
    if (!condItem || locked || ctTested[i]) return;
    const t = condItem.tested[i];
    setCtGuesses(gs => gs.map((x, k) => (k === i ? g : x)));
    setCtTested(ts => ts.map((x, k) => (k === i ? true : x)));
    setInGap(t);
    if ((g === 'lights') === conducts(t)) setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const ctReady = !!condItem && !condTesting && condItem.toSort.every((_, i) => ctCalls[i]);
  const checkCond = () => {
    if (!condItem || locked || !ctReady) return;
    const correct = conductorMatches(condItem, ctCalls);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: conductorFeedback(condItem, ctCalls), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeConductor(condItem, ctCalls), correct, conductorMiss(condItem, ctCalls));
    if (correct) { SoundManager.playCorrect(); setCtRevealed(true); setInGap(condItem.toSort[condItem.toSort.length - 1]); recordPass(); }
    else SoundManager.playIncorrect();
  };

  // ── Magnet test: a guess puts a test thing under the magnet; then calls on the rest ──
  const holdThing = (i: number, g: PullCall) => {
    if (!magnetItem || locked || mtTested[i]) return;
    const t = magnetItem.tested[i];
    setMtGuesses(gs => gs.map((x, k) => (k === i ? g : x)));
    setMtTested(ts => ts.map((x, k) => (k === i ? true : x)));
    setHeld(t);
    if ((g === 'pulls') === pulled(t)) setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const mtReady = !!magnetItem && !mtTesting && magnetItem.toSort.every((_, i) => mtCalls[i]);
  const checkMagnet = () => {
    if (!magnetItem || locked || !mtReady) return;
    const correct = magnetMatches(magnetItem, mtCalls);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: magnetFeedback(magnetItem, mtCalls), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeMagnet(magnetItem, mtCalls), correct, magnetMiss(magnetItem, mtCalls));
    if (correct) { SoundManager.playCorrect(); setMtRevealed(true); setHeld(magnetItem.toSort[magnetItem.toSort.length - 1]); recordPass(); }
    else SoundManager.playIncorrect();
  };

  // ── Magnet poles: turn the right magnet, slide it up to the left one, then call or name ──
  const turnMagnet = () => {
    if (!poleItem || locked) return;
    setPFacing(f => flip(f)); setPShown(null); setFeedback(null); SoundManager.tap();
  };
  const slideTogether = () => {
    if (!poleItem || locked) return;
    const result = poleResult(poleItem.aEnd, pFacing);
    setPTests(ts => [...ts, { facing: pFacing, result }]);
    setPShown(v => ({ n: (v?.n ?? 0) + 1, result }));
    setFeedback(null); SoundManager.select();
  };
  const pReady = !!poleItem && !poleTesting && (poleItem.mystery ? !!pStriped : poleItem.toCall.every((_, i) => pCalls[i]));
  const checkPoles = () => {
    if (!poleItem || locked || !pReady) return;
    const answer = { calls: pCalls, striped: pStriped };
    const correct = polesMatch(poleItem, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: polesFeedback(poleItem, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describePoles(poleItem, answer), correct, polesMiss(poleItem, answer));
    if (correct) { SoundManager.playCorrect(); setPRevealed(true); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Magnet distance: put a ball on a mark, try its magnet, then name, call or pick ──
  const placeBall = (r: number, mark: number) => {
    if (!distItem || locked) return;
    setDBalls(bs => bs.map((b, i) => (i === r ? mark : b))); setDStuck(ss => ss.map((s, i) => (i === r ? false : s)));
    setFeedback(null); SoundManager.tap();
  };
  const tryMagnet = (r: number) => {
    if (!distItem || locked || !distItem.magnets[r]) return;
    const mark = dBalls[r];
    // A ball already at the magnet has nothing to show: move it to a mark first.
    if (mark == null || dStuck[r]) { SoundManager.tap(); return; }
    const pulled = pullsAt(distItem.magnets[r], mark);
    setDTests(ts => [...ts, { magnet: r, mark, pulled }]);
    if (pulled) setDStuck(ss => ss.map((s, i) => (i === r ? true : s)));
    setDShown(v => ({ n: (v?.n ?? 0) + 1, ruler: r }));
    setFeedback(null); SoundManager.select();
  };
  const dReady = !!distItem && !distTesting && (distItem.ask === 'reach' ? dReach !== null
    : distItem.ask === 'calls' ? distItem.toCall.every((_, i) => dCalls[i] !== null && dCalls[i] !== undefined) : dStronger !== null);
  const checkDistance = () => {
    if (!distItem || locked || !dReady) return;
    const answer = { reach: dReach, calls: dCalls, stronger: dStronger };
    const correct = distanceMatch(distItem, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: distanceFeedback(distItem, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeDistance(distItem, answer), correct, distanceMiss(distItem, answer));
    if (correct) { SoundManager.playCorrect(); setDRevealed(true); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Electromagnet: wrap, switch, battery, core; dip to test; I'm done! judges the build as it is ──
  const changeBuild = (next: Partial<ElectroBuild>, status: string | null = null) => {
    if (!emItem || locked) return;
    setEmBuild(b => ({ ...b, ...next })); setEmHanging(0); setEmStatus(status); setFeedback(null);
  };
  const wrap = (delta: number) => {
    const turns = Math.max(0, Math.min(MAX_TURNS, emBuild.turns + delta));
    if (turns === emBuild.turns) { SoundManager.tap(); return; }
    changeBuild({ turns }, emHanging ? 'The clips dropped.' : null); SoundManager.tap();
  };
  const toggleEmSwitch = () => { changeBuild({ on: !emBuild.on }, emBuild.on && emHanging ? 'Switched off: the clips dropped!' : null); SoundManager.select(); };
  const toggleBattery = () => { if (emItem?.spareBattery) { changeBuild({ batteries: emBuild.batteries === 2 ? 1 : 2 }); SoundManager.select(); } };
  const pickCore = (core: Core) => { if (emItem?.coreTray && core !== emBuild.core) { changeBuild({ core }); SoundManager.select(); } };
  const dip = () => {
    if (!emItem || locked) return;
    const clips = clipsLifted(emBuild);
    setEmTests(ts => [...ts, emBuild]); setEmHanging(clips);
    setEmDip(v => ({ n: (v?.n ?? 0) + 1 }));
    setEmStatus(clips ? `It picked up ${clips} clip${clips === 1 ? '' : 's'}!` : 'It picked up nothing.');
    setFeedback(null); SoundManager.select();
  };
  const checkElectro = () => {
    if (!emItem || locked || !emTests.length) return;
    const miss = electroMiss(emItem, emBuild);
    setVerdict(miss ? 'incorrect' : 'correct');
    setFeedback({ text: electroFeedback(emItem, emBuild), status: miss ? 'incorrect' : 'correct' });
    progress.commitCheck(describeElectro(emBuild), !miss, miss);
    if (!miss) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
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
    const metrics: CircuitWorkbenchMetrics = {
      type: 'circuit-workbench', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      guessesMatched,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, guessesMatched]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const scene = emItem ? { ...electroScene(emItem, { build: emBuild, tests: emTests, hanging: emHanging }) }
      : distItem ? { ...distanceScene(distItem, { balls: dBalls, tests: dTests, reach: dReach, calls: dCalls, stronger: dStronger, revealed: dRevealed }) }
      : poleItem ? { ...poleScene(poleItem, { facing: pFacing, tests: pTests, calls: pCalls, striped: pStriped, revealed: pRevealed }) }
      : magnetItem ? { ...magnetScene(magnetItem, { guesses: mtGuesses, tested: mtTested, held, calls: mtCalls, revealed: mtRevealed }) }
      : deviceItem ? { ...deviceScene(deviceItem, { parts, wires, switchOn }) }
      : twoItem ? { ...twoBulbScene(twoItem, { guess, powered, wires, out: outBulbs }) }
      : switchItem ? { ...switchScene(switchItem, { guess, powered, wires, switchOn }) }
      : condItem ? { ...conductorScene(condItem, { guesses: ctGuesses, tested: ctTested, inGap, calls: ctCalls, revealed: ctRevealed }) }
      : breakItem ? { ...breakScene(breakItem, { guess: breakGuess, fixes, log: fixLog, claim }) }
      : { ...circuitScene(lightItem!, { guess, powered, wires }) };
    // The lever set declares the levers and writes the onScreen facts (`leverScene`).
    const ctx: CircuitLeverCtx = { powered: on };
    const leverItem: CircuitChallenge = { ...sessionItem, supportTier: sessionItem.supportTier ?? data.supportTier };
    const shown = practice ? [] : [...pulledLevers, ...(sessionItem.startLevers ?? [])];
    const levers = practice ? [] : CIRCUIT_LEVERS.declare(leverItem, ctx, shown);
    const published = leverScene(scene, {
      support: practice ? '' : CIRCUIT_LEVERS.support(leverItem, ctx),
      onScreen: practice ? '' : CIRCUIT_LEVERS.onScreen(leverItem, ctx, shown),
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
          const easier = CIRCUIT_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          // The practice item and the full item share no work: both start on a fresh table.
          setLeverState(pulled); openItem(easier, easier.id); setVerdict(null); setFeedback(null); setPractice(easier);
          return { practice: circuitWorkbenchBoss.assignment!(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { setPractice(null); openItem(sessionItem, sessionItem.id); setVerdict(null); setFeedback(null); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing on the workbench yet.</LuminaCardContent></LuminaCard>;
  }

  const status = !current || !on ? null
    : table.short ? 'Nothing is lit, and the battery is getting warm!'
      : table.lit.length ? cap(`${table.lit.map(b => `${bulbName({ bulbs: tableBulbs }, b)} is ${b === 'motor' ? 'spinning' : b === 'buzzer' ? 'buzzing' : 'lit'}`).join(' and ')}!`)
        : breakItem ? 'Everything is dark.' : condItem ? (inGap ? 'The bulb is off.' : 'Nothing is in the gap.') : 'Nothing is lit.';
  const xray = current && on && leverOn(XRAY_LEVER) ? {
    reached: condItem ? (table.lit.length ? clipsOf(['red']) : ['bat+', 'red.left', 'red.right'] as Clip[])
      : reachedFromPlus(tableBulbs, table.wires, table.faults),
    flowing: table.lit.length > 0 || table.short, fast: table.short,
  } : null;
  const lastPole = pShown && pTests.length ? pTests[pTests.length - 1] : null;
  const poleStatus = poleItem && lastPole ? (lastPole.result === 'pull' ? 'They snapped together!' : 'They pushed apart!') : null;
  /** Which ends face in a test or a pair, for the pole tags lever; a striped magnet's ends are what the learner finds. */
  const sameOrDifferent = (a: Pole, b: Pole) => (a === b ? 'same ends' : 'different ends');
  const poleStep = !poleItem ? null : poleTesting ? (pTests.length ? 'poleTurn' : 'poleFirst') : 'poleCall';
  const distStep = !distItem ? null : !distTesting ? 'distDecide' : !dTests.length ? 'distFirst' : distItem.magnets.length > 1 ? 'distTestTwo' : 'distTest';
  const lastDist = dShown && dTests.length ? dTests[dTests.length - 1] : null;
  const distStatus = distItem && lastDist ? (lastDist.pulled ? 'The ball rolled to the magnet!' : 'The ball stayed put.') : null;
  const emStep = !emItem ? null : emTests.length ? 'emTest' : 'emFirst';
  const step = emStep ? emStep : distStep ? distStep : poleStep ? poleStep : magnetItem ? (mtTesting ? 'magTest' : 'magSort') : condItem ? (condTesting ? 'test' : 'sort') : breakItem ? (breakGuess ? 'test' : 'guess') : powered ? 'wire' : 'guess';
  const stepPrompt = emStep ? PROMPT[emStep] : distStep ? PROMPT[distStep] : poleStep ? PROMPT[poleStep] : magnetItem ? PROMPT[mtTesting ? 'magTest' : 'magSort'] : condItem ? (condTesting ? PROMPT.condTest : PROMPT.condSort)
    : breakItem ? (breakGuess ? PROMPT.breakTest : PROMPT.breakGuess) : powered ? PROMPT.wire : PROMPT.guess;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="amber">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Workbench done!" celebrationMessage="You built and fixed circuits like an electrician." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="amber">
            {practice && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300" data-practice>Practice</div>}
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-amber-100/80" data-circuit-step={step}>{stepPrompt}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <CircuitScene className="h-[min(56vh,480px)] min-h-[300px] w-full"
              bulbs={tableBulbs} partsKey={partsKey} wires={table.wires} loose={table.loose} gap={!!condItem} inGap={inGap} powered={on}
              lit={table.lit} short={table.short} selected={selected} onTap={onTap} hasSwitch={hasSwitch} switchOn={switchOn} dim={table.dim ?? []} out={twoItem ? outBulbs : []} xray={xray} magnet={!!magnetItem} held={held} stuck={!!held && pulled(held)}
              poleBench={poleItem ? { aEnd: poleItem.aEnd, mystery: poleItem.mystery, striped: poleItem.striped } : null}
              poles={poleItem ? { facing: pFacing, test: pShown } : null}
              distBench={distItem ? { magnets: distItem.magnets.map(m => ({ size: m.size })) } : null}
              dist={distItem ? { balls: distItem.magnets.map((_, i) => ({ mark: dBalls[i] ?? null, stuck: !!dStuck[i] })), test: dShown,
                marks: leverOn(PULL_MARKS_LEVER) ? dTests.map(t => ({ ruler: t.magnet, mark: t.mark, pulled: t.pulled })) : null } : null}
              electroBench={emItem ? { spareBattery: emItem.spareBattery, coreTray: emItem.coreTray } : null}
              electro={emItem ? { build: emBuild, dip: emDip, hanging: emHanging,
                meter: leverOn(STRENGTH_METER_LEVER) ? Math.min(1, strength(emBuild) / 10) : null } : null}
              disabled={locked || (!poleItem && !distItem && !emItem && (!wiringItem || !powered))} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">
              {emItem ? 'Tap the core to wrap wire · the switch · the clips to test'
                : distItem ? 'Tap a mark to put the ball there · tap the magnet to try it'
                : poleItem ? 'Tap the right magnet to turn it · tap the left one to slide them together'
                : wiringItem && powered ? 'Tap a clip, then another · drag to turn' : 'Drag to turn · pinch to zoom'}
            </div>
            {emItem && emStatus && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-amber-200"
                data-circuit-em-result={emHanging}>{emStatus}</div>
            )}
            {distStatus && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-amber-200"
                data-circuit-dist-result={lastDist!.pulled ? 'pulled' : 'stayed'}>{distStatus}</div>
            )}
            {poleStatus && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-amber-200"
                data-circuit-pole-result={lastPole!.result}>{poleStatus}</div>
            )}
            {status && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-amber-200"
                data-circuit-lit={table.lit.join(',') || (table.short ? 'short' : 'none')}>{status}</div>
            )}
          </div>

          {/* ── Light it ── */}
          {!allChallengesComplete && wiringItem && !powered && (
            <LuminaPanel className="flex flex-wrap items-center gap-2 p-3" data-circuit-guess-panel="">
              <span className="text-sm text-slate-200">Like this, will {bulbName(wiringItem, target)} light?</span>
              <LuminaChoiceChip label="It will light" aria-label="Guess it will light" onClick={() => makeGuess('lights')} disabled={locked} />
              <LuminaChoiceChip label="It will stay off" aria-label="Guess it will stay off" onClick={() => makeGuess('stays_off')} disabled={locked} />
            </LuminaPanel>
          )}
          {!allChallengesComplete && wiringItem && powered && (
            <LuminaPanel className="space-y-3 p-3" data-circuit-wire-panel="">
              {twoItem && (
                <div className="flex flex-wrap items-center gap-2" data-circuit-out={outBulbs.join(',') || 'none'}>
                  <span className="text-sm text-slate-200">Test it:</span>
                  {twoItem.bulbs.map(b => (
                    <LuminaButton key={b} tone="ghost" onClick={() => toggleBulb(b)} disabled={locked}>
                      {outBulbs.includes(b) ? `Put the ${b} bulb back` : `Take out the ${b} bulb`}
                    </LuminaButton>
                  ))}
                </div>
              )}
              {deviceItem && (
                <div className="flex flex-wrap items-center gap-2" data-circuit-tray={parts.join(',') || 'none'}>
                  <span className="w-16 text-sm text-slate-200">Tray</span>
                  {TRAY.map(part => (
                    <LuminaChoiceChip key={part} label={PART_WORDS[part]} aria-label={`${parts.includes(part) ? 'Put back' : 'Take'} ${PART_WORDS[part]}`}
                      selected={parts.includes(part)} onClick={() => togglePart(part)} disabled={locked} />
                  ))}
                </div>
              )}
              {hasSwitch && (
                <div className="flex flex-wrap items-center gap-2" data-circuit-switch={switchOn ? 'on' : 'off'}>
                  <span className="text-sm text-slate-200">The switch is {switchOn ? 'on' : 'off'}.</span>
                  <LuminaButton tone="primary" onClick={flipSwitch} disabled={locked}>{switchOn ? 'Turn the switch off' : 'Turn the switch on'}</LuminaButton>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-16 text-sm text-slate-200">Clips</span>
                {clipsOf(wiringItem.bulbs, hasSwitch).map(clip => (
                  <LuminaChoiceChip key={clip} accent="amber" label={clipWords(wiringItem, clip)} aria-label={`Clip: ${clipWords(wiringItem, clip)}`}
                    selected={selected === clip} onClick={() => tapClip(clip)} disabled={locked} />
                ))}
              </div>
              <div className="space-y-1 border-t border-white/10 pt-3">
                <div className="text-xs text-slate-400">Wires on the table ({wires.length} of {wiringItem.maxWires})</div>
                {wires.length === 0 && <div className="text-sm text-slate-400">No wires yet.</div>}
                {wires.map(w => (
                  <div key={wireKey(w)} className="flex flex-wrap items-center gap-2" data-circuit-wire={wireKey(w)}>
                    <span className="text-sm text-slate-200">{clipWords(wiringItem, w[0])} to {clipWords(wiringItem, w[1])}</span>
                    <LuminaButton tone="ghost" onClick={() => removeWire(w)} disabled={locked}
                      aria-label={`Remove the wire from ${clipWords(wiringItem, w[0])} to ${clipWords(wiringItem, w[1])}`}>Remove</LuminaButton>
                  </div>
                ))}
              </div>
            </LuminaPanel>
          )}

          {/* ── Electromagnet ── */}
          {!allChallengesComplete && emItem && (
            <LuminaPanel className="flex flex-wrap items-center gap-2 p-3" data-circuit-em-panel="" data-circuit-em-build={`${emBuild.core}:${emBuild.turns}:${emBuild.batteries}:${emBuild.on ? 'on' : 'off'}`}>
              <span className="text-sm text-slate-200">{emBuild.turns} wrap{emBuild.turns === 1 ? '' : 's'}</span>
              <LuminaButton tone="ghost" onClick={() => wrap(1)} disabled={locked || emBuild.turns >= MAX_TURNS}>Add a wrap</LuminaButton>
              <LuminaButton tone="ghost" onClick={() => wrap(-1)} disabled={locked || emBuild.turns <= 0}>Take a wrap off</LuminaButton>
              <LuminaButton tone="ghost" onClick={toggleEmSwitch} disabled={locked}>{emBuild.on ? 'Switch off' : 'Switch on'}</LuminaButton>
              {emItem.spareBattery && (
                <LuminaButton tone="ghost" onClick={toggleBattery} disabled={locked}>{emBuild.batteries === 2 ? 'Take out the spare battery' : 'Put in the spare battery'}</LuminaButton>
              )}
              {emItem.coreTray && (['steel', 'wood', 'aluminium'] as const).map(k => (
                <LuminaChoiceChip key={k} accent="amber" label={cap(CORE_WORDS[k])} aria-label={`Wrap the wire round ${CORE_WORDS[k]}`}
                  selected={emBuild.core === k} onClick={() => pickCore(k)} disabled={locked} />
              ))}
              <LuminaButton tone="ghost" onClick={dip} disabled={locked}>Dip in the clips</LuminaButton>
            </LuminaPanel>
          )}

          {/* ── Magnet distance ── */}
          {!allChallengesComplete && distItem && (
            <div className="space-y-3" data-circuit-dist-panel="" data-circuit-dist-marks={leverOn(PULL_MARKS_LEVER) ? 'on' : undefined}>
              {distItem.magnets.map((_, r) => (
                <LuminaPanel key={r} className="flex flex-wrap items-center gap-2 p-3" data-circuit-dist-ruler={r}>
                  <span className="text-sm text-slate-200">{cap(magnetName(distItem, r))}: ball on mark</span>
                  {Array.from({ length: MARKS }, (_, k) => k + 1).map(k => (
                    <LuminaChoiceChip key={k} accent="amber" label={String(k)} aria-label={`Put ${distItem.magnets.length > 1 ? `${magnetName(distItem, r)}'s` : 'the'} ball on mark ${k}`}
                      selected={dBalls[r] === k && !dStuck[r]} onClick={() => placeBall(r, k)} disabled={locked} />
                  ))}
                  <LuminaButton tone="ghost" onClick={() => tryMagnet(r)} disabled={locked || dBalls[r] == null || dStuck[r]}>
                    Try {magnetName(distItem, r)}
                  </LuminaButton>
                </LuminaPanel>
              ))}
              {!distTesting && (
                <LuminaPanel className="space-y-2 p-3" data-circuit-dist-decide="">
                  {distItem.ask === 'reach' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-100">The farthest mark the magnet pulls the ball from:</span>
                      {Array.from({ length: MARKS }, (_, k) => k + 1).map(k => (
                        <LuminaChoiceChip key={k} accent="amber" label={String(k)} aria-label={`The farthest mark is ${k}`} selected={dReach === k}
                          onClick={() => { if (!locked) { setDReach(k); setFeedback(null); SoundManager.select(); } }} disabled={locked || dRevealed} />
                      ))}
                    </div>
                  ) : distItem.ask === 'calls' ? (
                    <>
                      <div className="text-xs uppercase tracking-wide text-slate-400">Decide without testing</div>
                      {distItem.toCall.map((k, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-slate-100">{callWords(k)}</span>
                          {([true, false] as const).map(v => (
                            <LuminaChoiceChip key={String(v)} accent="amber" label={v ? 'Yes' : 'No'} aria-label={`${callWords(k)} ${v ? 'Yes' : 'No'}`}
                              selected={dCalls[i] === v} disabled={locked || dRevealed}
                              onClick={() => { if (!locked) { setDCalls(cs => cs.map((x, n) => (n === i ? v : x))); setFeedback(null); SoundManager.select(); } }} />
                          ))}
                          {dRevealed && <span className="text-sm text-slate-400">{callAnswer(k) ? 'Yes, it would.' : 'No, it would not.'}</span>}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-100">Which magnet is stronger?</span>
                      {distItem.magnets.map((_, r) => (
                        <LuminaChoiceChip key={r} accent="amber" label={cap(magnetName(distItem, r))} aria-label={`${cap(magnetName(distItem, r))} is stronger`}
                          selected={dStronger === r} disabled={locked || dRevealed}
                          onClick={() => { if (!locked) { setDStronger(r); setFeedback(null); SoundManager.select(); } }} />
                      ))}
                    </div>
                  )}
                </LuminaPanel>
              )}
            </div>
          )}

          {/* ── Magnet poles ── */}
          {!allChallengesComplete && poleItem && (
            <div className="space-y-3" data-circuit-pole-panel="" data-circuit-pole-facing={poleItem.mystery ? (pFacing === poleItem.striped ? 'striped' : 'plain') : pFacing}>
              <LuminaPanel className="flex flex-wrap items-center gap-2 p-3">
                <span className="text-sm text-slate-200">
                  {poleItem.mystery ? `The ${pFacing === poleItem.striped ? 'striped' : 'plain'} end faces the left magnet's ${poleItem.aEnd}.`
                    : `The right magnet's ${pFacing} end faces the left magnet's ${poleItem.aEnd}.`}
                </span>
                <LuminaButton tone="ghost" onClick={turnMagnet} disabled={locked}>Turn the right magnet</LuminaButton>
                <LuminaButton tone="ghost" onClick={slideTogether} disabled={locked}>Slide them together</LuminaButton>
              </LuminaPanel>
              {!poleTesting && (
                <LuminaPanel className="space-y-2 p-3" data-circuit-pole-calls="">
                  <div className="text-xs uppercase tracking-wide text-slate-400">Decide without testing</div>
                  {poleItem.mystery ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-100">Is the striped end N or S?</span>
                      {(['N', 'S'] as const).map(k => (
                        <LuminaChoiceChip key={k} accent="amber" label={k} aria-label={`The striped end is ${k}`} selected={pStriped === k}
                          onClick={() => { if (!locked) { setPStriped(k); setFeedback(null); SoundManager.select(); } }} disabled={locked || pRevealed} />
                      ))}
                    </div>
                  ) : poleItem.toCall.map((p, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-100">{cap(pairWords(p))}{leverOn(POLE_TAGS_LEVER) && <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-200" data-circuit-pole-tag="">{sameOrDifferent(p.a.end, p.b.end)}</span>}</span>
                      {(['pull', 'push'] as const).map(k => (
                        <LuminaChoiceChip key={k} accent="amber" label={k === 'pull' ? 'pull together' : 'push apart'}
                          aria-label={`${cap(pairWords(p))}: ${k === 'pull' ? 'pull together' : 'push apart'}`} selected={pCalls[i] === k}
                          onClick={() => { if (!locked) { setPCalls(cs => cs.map((x, n) => (n === i ? k : x))); setFeedback(null); SoundManager.select(); } }}
                          disabled={locked || pRevealed} />
                      ))}
                      {pRevealed && <span className="text-sm text-slate-400">{pairResult(p) === 'pull' ? 'They pull together.' : 'They push apart.'}</span>}
                    </div>
                  ))}
                </LuminaPanel>
              )}
            </div>
          )}

          {/* ── Magnet test ── */}
          {!allChallengesComplete && magnetItem && (
            <div className="grid gap-3 sm:grid-cols-2" data-circuit-magnet-panel="">
              <LuminaPanel className="space-y-2 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Test with the magnet</div>
                {magnetItem.tested.map((t, i) => (
                  <div key={t.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-100">The {t.name}{leverOn(MAGNET_TAGS_LEVER) && <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-200" data-circuit-magnet-tag="">{MAGNET_MATERIAL_WORDS[t.material]}</span>}</span>
                    {mtTested[i]
                      ? <span className="text-sm text-slate-400">{pulled(t) ? 'It jumped up to the magnet.' : 'It stayed on the pad.'}</span>
                      : (['pulls', 'stays'] as const).map(g => (
                        <LuminaChoiceChip key={g} label={g === 'pulls' ? 'Pulls' : 'Stays'} aria-label={`Guess the magnet ${g === 'pulls' ? 'pulls' : 'does not pull'} the ${t.name}`}
                          onClick={() => holdThing(i, g)} disabled={locked} />
                      ))}
                  </div>
                ))}
              </LuminaPanel>
              <LuminaPanel className="space-y-2 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Decide without testing</div>
                {magnetItem.toSort.map((t, i) => (
                  <div key={t.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-100">The {t.name}{leverOn(MAGNET_TAGS_LEVER) && <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-200">{MAGNET_MATERIAL_WORDS[t.material]}</span>}</span>
                    {(['pulls', 'stays'] as const).map(k => (
                      <LuminaChoiceChip key={k} accent="amber" label={k === 'pulls' ? 'pulls it' : 'stays put'}
                        aria-label={`The magnet ${k === 'pulls' ? 'pulls' : 'does not pull'} the ${t.name}`} selected={mtCalls[i] === k}
                        onClick={() => { if (!locked && !mtTesting) { setMtCalls(cs => cs.map((x, n) => (n === i ? k : x))); setFeedback(null); SoundManager.select(); } }}
                        disabled={locked || mtTesting || mtRevealed} />
                    ))}
                  </div>
                ))}
              </LuminaPanel>
            </div>
          )}

          {/* ── Conductor test ── */}
          {!allChallengesComplete && condItem && (
            <div className="grid gap-3 sm:grid-cols-2" data-circuit-cond-panel="">
              <LuminaPanel className="space-y-2 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Test in the gap</div>
                {condItem.tested.map((t, i) => (
                  <div key={t.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-100">The {t.name} <span className="text-slate-400">· {MATERIAL_WORDS[t.material]}</span></span>
                    {ctTested[i]
                      ? <span className="text-sm text-slate-400">{conducts(t) ? 'It lit the bulb.' : 'The bulb stayed off.'}</span>
                      : (['lights', 'stays_off'] as const).map(g => (
                        <LuminaChoiceChip key={g} label={g === 'lights' ? 'Light' : 'Off'} aria-label={`Guess the ${t.name} will ${g === 'lights' ? 'light the bulb' : 'leave it off'}`}
                          onClick={() => testThing(i, g)} disabled={locked} />
                      ))}
                  </div>
                ))}
              </LuminaPanel>
              <LuminaPanel className="space-y-2 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-400">Decide without testing</div>
                {condItem.toSort.map((t, i) => (
                  <div key={t.key} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-100">The {t.name} <span className="text-slate-400">· {MATERIAL_WORDS[t.material]}</span></span>
                    {(['lights', 'stays_off'] as const).map(k => (
                      <LuminaChoiceChip key={k} accent="amber" label={k === 'lights' ? 'lights it' : 'leaves it off'}
                        aria-label={`The ${t.name} ${k === 'lights' ? 'lights the bulb' : 'leaves it off'}`} selected={ctCalls[i] === k}
                        onClick={() => { if (!locked && !condTesting) { setCtCalls(cs => cs.map((x, n) => (n === i ? k : x))); setFeedback(null); SoundManager.select(); } }}
                        disabled={locked || condTesting || ctRevealed} />
                    ))}
                  </div>
                ))}
              </LuminaPanel>
            </div>
          )}

          {/* ── Find the break ── */}
          {!allChallengesComplete && breakItem && !breakGuess && (
            <LuminaPanel className="flex flex-wrap items-center gap-2 p-3" data-circuit-break-guess="">
              <span className="text-sm text-slate-200">Your guess: what is broken?</span>
              {breakParts.map(p => (
                <LuminaChoiceChip key={p} label={partWords(breakItem, p)} aria-label={`Guess: ${partWords(breakItem, p)}`}
                  onClick={() => { if (!locked) { setBreakGuess(p); SoundManager.select(); } }} disabled={locked} />
              ))}
            </LuminaPanel>
          )}
          {!allChallengesComplete && breakItem && breakGuess && (
            <LuminaPanel className="space-y-3 p-3" data-circuit-break-panel="">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-200">Try one fix:</span>
                {breakFixes.map(f => (
                  <LuminaButton key={f} tone="ghost" onClick={() => tryFix(f)} disabled={locked || fixes.includes(f)}>
                    {f === 'battery' ? 'Try a new battery' : f === 'clip' ? 'Push every clip on tight'
                      : `Try a new ${breakItem.bulbs.length === 1 ? 'bulb' : `${f.slice(5)} bulb`}`}
                  </LuminaButton>
                ))}
              </div>
              {fixLog.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-200">What was broken?</span>
                  {breakParts.map(p => (
                    <LuminaChoiceChip key={p} accent="amber" label={partWords(breakItem, p)} aria-label={`Broken: ${partWords(breakItem, p)}`}
                      selected={claim === p} onClick={() => { if (!locked) { setClaim(p); setFeedback(null); SoundManager.select(); } }} disabled={locked} />
                  ))}
                </div>
              )}
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && wiringItem && powered && (
              <LuminaActionButton action="check" onClick={checkLight} disabled={locked}>I&apos;m done!</LuminaActionButton>
            )}
            {!allChallengesComplete && breakItem && breakGuess && (
              <LuminaActionButton action="check" onClick={checkBreak} disabled={locked || !claim}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && emItem && emTests.length > 0 && (
              <LuminaActionButton action="check" onClick={checkElectro} disabled={locked}>I&apos;m done!</LuminaActionButton>
            )}
            {!allChallengesComplete && distItem && !distTesting && (
              <LuminaActionButton action="check" onClick={checkDistance} disabled={locked || !dReady}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && poleItem && !poleTesting && (
              <LuminaActionButton action="check" onClick={checkPoles} disabled={locked || !pReady}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && magnetItem && !mtTesting && (
              <LuminaActionButton action="check" onClick={checkMagnet} disabled={locked || !mtReady}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && condItem && !condTesting && (
              <LuminaActionButton action="check" onClick={checkCond} disabled={locked || !ctReady}>Check</LuminaActionButton>
            )}
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}>
              <p>{feedback.text}</p>
            </LuminaFeedbackCard>
          )}

          {!allChallengesComplete && condItem && ctTested.some(Boolean) && (
            <LuminaTable caption="Lab notebook" accent="amber" columns={['Thing', 'Made of', 'Guess', 'The bulb']}
              rows={condItem.tested.map((t, i) => [t.name, MATERIAL_WORDS[t.material],
                ctGuesses[i] ? (ctGuesses[i] === 'lights' ? 'light' : 'off') : '—', ctTested[i] ? (conducts(t) ? 'Lit' : 'Off') : '—'])} />
          )}
          {!allChallengesComplete && emItem && emTests.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber"
              columns={[...(emItem.coreTray ? ['Core'] : []), 'Wraps', ...(emItem.spareBattery ? ['Batteries'] : []), 'Switch', 'Clips picked up']}
              rows={emTests.map(t => [...(emItem.coreTray ? [cap(CORE_WORDS[t.core])] : []), String(t.turns), ...(emItem.spareBattery ? [String(t.batteries)] : []),
                t.on ? 'On' : 'Off', String(clipsLifted(t))])} />
          )}
          {!allChallengesComplete && distItem && dTests.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber"
              columns={distItem.magnets.length > 1 ? ['Magnet', 'Ball on mark', 'What happened'] : ['Ball on mark', 'What happened']}
              rows={dTests.map(t => {
                const happened = t.pulled ? 'Rolled to the magnet' : 'Stayed put';
                return distItem.magnets.length > 1 ? [cap(magnetName(distItem, t.magnet)), String(t.mark), happened] : [String(t.mark), happened];
              })} />
          )}
          {!allChallengesComplete && poleItem && pTests.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber"
              columns={leverOn(POLE_TAGS_LEVER) ? ['Left end', 'Right end', 'Which ends', 'What happened'] : ['Left end', 'Right end', 'What happened']}
              rows={pTests.map(t => {
                const right = poleItem.mystery ? (t.facing === poleItem.striped ? 'striped' : 'plain') : t.facing;
                const happened = t.result === 'pull' ? 'Snapped together' : 'Pushed apart';
                return leverOn(POLE_TAGS_LEVER) ? [poleItem.aEnd, right, sameOrDifferent(poleItem.aEnd, t.facing), happened] : [poleItem.aEnd, right, happened];
              })} />
          )}
          {!allChallengesComplete && breakItem && fixLog.length > 0 && (
            <LuminaTable caption="Lab notebook" accent="amber" columns={['What I tried', 'What happened']}
              rows={fixLog.map(l => [fixWords(breakItem, l.fix), l.lit ? 'It lit!' : 'Still dark'])} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const CircuitWorkbench = withWorkspaceOnly<CircuitWorkbenchProps>('circuit-workbench',
  CircuitWorkbenchSurface, props => props.data.title);

/**
 * The workbench runs only on the teaching workspace: the tutor is present, each mode's own check commits (light it's
 * I'm done!, find the break's Check), and the runtime moves to the next item. Outside a bound session the "needs the
 * tutor" card shows.
 */
export default CircuitWorkbench;
