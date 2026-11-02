'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaChoiceChip, LuminaFeedbackCard, LuminaPanel,
  LuminaPrompt, LuminaTable,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { VolcanoIslandMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import VolcanoScene from './VolcanoScene';
import {
  INGREDIENT_WORD, MAX_AMOUNT, MIN_AMOUNT, WHICH_WORDS, amountWords, describeKitchen, foamHeight, kitchenFeedback,
  kitchenMatches, kitchenMiss, mixWords, type Ingredient, type Mix, type VolcanoChallenge, type VolcanoTask, type Which,
} from './volcanoModel';
import {
  OUTCOME_WORDS, describeMagma, magmaFeedback, magmaLooks, magmaMatches, magmaMiss, outcomeOf, type Magma, type Outcome,
} from './magmaModel';
import {
  DIKE_ID, LAYER_COLORS, LAYER_WORDS, NEW_ID, describeLayers, layerName, layersFeedback, layersMatches, layersMiss,
  type LayersChallenge,
} from './layersModel';
import {
  SIZE, describeVillage, lavaPath, villageFeedback, villageMatches, villageMiss, villageSafe, xy, type VillageChallenge,
} from './villageModel';
import {
  COOLING_WORDS, ROCK_LOOKS, ROCK_NAMES, describeRock, rockFeedback, rockMatches, rockMiss, rockOf, type Cooling, type RockKind,
} from './rockModel';
import { kitchenScene, layersScene, magmaScene, rockScene, villageScene, type LayerGuess } from './volcanoWorkspace';
import { volcanoIslandBoss } from './volcanoIsland.boss';
import {
  CHANGES_LEVER, CRACK_LEVER, FIZZ_LEVER, MAGMA_TAGS_LEVER, NEW_LAYER_LEVER, PRACTICE_NOTE, TRAIL_LEVER, ZOOM_LEVER, VOLCANO_LEVERS, type VolcanoLeverCtx,
} from './volcanoLevers';
import { leverScene } from '../../../components/live-activity/bossLevers';

export type { VolcanoChallenge } from './volcanoModel';

// ============================================================================
// Data contract
// ============================================================================

export interface VolcanoIslandData {
  title: string;
  description: string;
  /** 3-6 items. REQUIRED. Every mix, magma and result is chosen by code from the volcano models. */
  challenges: VolcanoChallenge[];
  /** The session's task when it runs one mode (a mixed session names its first); each item carries its own `type`. */
  challengeType: VolcanoTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the levers start (`config.difficulty`). */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<VolcanoIslandMetrics>) => void;
}

interface VolcanoIslandProps {
  data: VolcanoIslandData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  kitchen_volcano: { label: 'Kitchen volcano', icon: '🌋', accentColor: 'orange' },
  runny_or_sticky: { label: 'Runny or sticky', icon: '🏝️', accentColor: 'orange' },
  layers_over_time: { label: 'Layers over time', icon: '🪨', accentColor: 'orange' },
  save_the_village: { label: 'Save the village', icon: '🏘️', accentColor: 'orange' },
  cool_the_rock: { label: 'Cool the rock', icon: '💎', accentColor: 'orange' },
};

const PROMPT = {
  mix: 'Set volcano B. Then guess: which will erupt higher?',
  erupt: 'Erupt both volcanoes and watch the foam.',
  claim: 'Look at the measuring sticks. Which erupted higher? Then press Check.',
  test: 'For each test magma, guess what it will do, and it erupts on the island. Watch closely.',
  call: 'What will the new volcano do? Choose, then press Check.',
  place: 'Where will the new layer go? Guess, then erupt the volcano.',
  order: 'Tap the layers in order, oldest first. Tap one again to take it back. Then press Check.',
  build: 'Tap squares on the map to place rock walls. Erupt to test, then press I\'m done!',
  cool: 'For each lava sample, guess the rock it will make, and it cools. Look closely at the crystals.',
  where: 'Where did the found rock cool? Choose, then press Check.',
};

/** A picture tag for a magma (the magma_tags lever): runny or thick, and its gas. */
const MagmaTag: React.FC<{ m: Magma }> = ({ m }) => (
  <span className="ml-1 rounded bg-orange-400/20 px-1 text-xs" data-volcano-magma-tag={`${m.thick ? 'thick' : 'runny'}-${m.gas}`}>
    {m.thick ? '🥜' : '🍯'} {m.gas === 'lots' ? '🫧🫧🫧' : '🫧'}
  </span>
);

/**
 * The cutaway (layers_over_time): the volcano's rock layers as a cross-section, bottom (oldest) to top, the learner's new
 * layer once erupted, and the lava crack. Each layer is tapped to number it; the numbers are the learner's order.
 */
const Cutaway: React.FC<{
  c: LayersChallenge; erupted: boolean; order: readonly string[]; onTap: (id: string) => void; disabled: boolean;
  markNew: boolean; markCrack: boolean;
}> = ({ c, erupted, order, onTap, disabled, markNew, markCrack }) => {
  const W = 320, H = 34, old = c.layers.length, rows = old + 1;
  const yOf = (i: number) => (rows - 1 - i) * H + 10;
  const num = (id: string) => (order.includes(id) ? order.indexOf(id) + 1 : null);
  const badge = (id: string, x: number, y: number) => num(id) && (
    <g><circle cx={x} cy={y} r={11} fill="#f97316" /><text x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="white" fontWeight="bold">{num(id)}</text></g>
  );
  return (
    <svg viewBox={`0 0 ${W + 40} ${rows * H + 20}`} className="w-full max-w-md" data-volcano-cutaway="">
      {c.layers.map((l, i) => (
        <g key={l.id} onClick={() => !disabled && onTap(l.id)} style={{ cursor: disabled ? 'default' : 'pointer' }} data-volcano-layer={l.id} role="button" aria-label={`Layer: ${LAYER_WORDS[l.kind]}`}>
          <rect x={20} y={yOf(i)} width={W} height={H - 2} rx={3} fill={LAYER_COLORS[l.kind]} stroke="#1f2937" />
          {badge(l.id, 36, yOf(i) + H / 2)}
        </g>
      ))}
      {erupted && (
        <g onClick={() => !disabled && onTap(NEW_ID)} style={{ cursor: disabled ? 'default' : 'pointer' }} data-volcano-layer={NEW_ID} role="button" aria-label={`Layer: new ${LAYER_WORDS[c.newKind]}`}>
          <rect x={20} y={yOf(old)} width={W} height={H - 2} rx={3} fill={LAYER_COLORS[c.newKind]} stroke={markNew ? '#fbbf24' : '#1f2937'} strokeWidth={markNew ? 3 : 1} />
          {markNew && <text x={W - 10} y={yOf(old) + H / 2 + 4} textAnchor="end" fontSize="11" fill="#fde68a">← your eruption made this</text>}
          {badge(NEW_ID, 36, yOf(old) + H / 2)}
        </g>
      )}
      {c.dike && (
        <g onClick={() => !disabled && onTap(DIKE_ID)} style={{ cursor: disabled ? 'default' : 'pointer' }} data-volcano-layer={DIKE_ID} role="button" aria-label="The lava crack">
          <polygon points={`${W / 2 - 6},${yOf(0) + H} ${W / 2 + 10},${yOf(0) + H} ${W / 2 + 4},${yOf(old - 1)} ${W / 2 - 10},${yOf(old - 1)}`} fill="#7f1d1d" stroke="#fca5a5" />
          {markCrack && c.layers.map((l, i) => <text key={l.id} x={W / 2 + 18} y={yOf(i) + H / 2 + 4} fontSize="12" fill="#fca5a5">⚡</text>)}
          {badge(DIKE_ID, W / 2 + 2, yOf(Math.floor((old - 1) / 2)) + H / 2)}
        </g>
      )}
    </svg>
  );
};

/**
 * The slope map (save_the_village): the island's slope from the crater (top) to the shore (bottom), darker where it is
 * higher; the village; the walls; and the lava of the test running now, cell by cell in the order it flows.
 */
const SlopeMap: React.FC<{
  c: VillageChallenge; walls: readonly number[]; lava: readonly number[]; shown: number; trail: readonly number[] | null;
  onTap: (cell: number) => void; disabled: boolean;
}> = ({ c, walls, lava, shown, trail, onTap, disabled }) => {
  const S = 34, lo = Math.min(...c.heights), hi = Math.max(...c.heights);
  const shade = (h: number) => {
    const t = (h - lo) / Math.max(1, hi - lo);
    // Low ground green, high ground grey rock: no orange, so the lava stands out.
    return `rgb(${Math.round(90 + 50 * t)}, ${Math.round(160 - 30 * t)}, ${Math.round(80 + 45 * t)})`;
  };
  const lit = new Set(lava.slice(0, shown));
  return (
    <svg viewBox={`0 0 ${SIZE * S} ${SIZE * S}`} className="w-full max-w-sm" data-volcano-map="">
      {c.heights.map((h, i) => {
        const { x, y } = xy(i);
        const isVillage = c.village.includes(i), isCrater = i === c.crater, isWall = walls.includes(i);
        return (
          <g key={i} onClick={() => !disabled && onTap(i)} style={{ cursor: disabled || isVillage || isCrater ? 'default' : 'pointer' }}
            data-volcano-cell={i} role="button" aria-label={`Square row ${y + 1}, column ${x + 1}${isWall ? ', wall' : ''}`}>
            <rect x={x * S} y={y * S} width={S - 1} height={S - 1} fill={shade(h)} />
            {trail?.includes(i) && !lit.has(i) && <rect x={x * S + 6} y={y * S + 6} width={S - 13} height={S - 13} rx={4} fill="#ff6a1f" opacity={0.35} />}
            {lit.has(i) && <rect x={x * S} y={y * S} width={S - 1} height={S - 1} fill="#ff3d00" opacity={0.92} data-volcano-lava="" />}
            {isCrater && <circle cx={x * S + S / 2} cy={y * S + S / 2} r={11} fill="#7f1d1d" stroke="#fca5a5" />}
            {isVillage && <text x={x * S + S / 2} y={y * S + S / 2 + 6} textAnchor="middle" fontSize="18">🏠</text>}
            {isWall && <rect x={x * S + 4} y={y * S + 4} width={S - 9} height={S - 9} rx={5} fill="#6b7280" stroke="#e5e7eb" strokeWidth={2} data-volcano-wall="" />}
          </g>
        );
      })}
    </svg>
  );
};

/** A rock up close: big crystals, tiny crystals, smooth glass, or holes. `zoom` draws the crystals larger. */
const RockTile: React.FC<{ kind: RockKind | null; zoom?: boolean }> = ({ kind, zoom }) => (
  <svg viewBox="0 0 60 60" className="h-14 w-14" data-volcano-rock={kind ?? 'none'}>
    <circle cx={30} cy={30} r={27} fill={!kind ? '#ff5a1f' : kind === 'granite' ? '#d9c7c0' : kind === 'basalt' ? '#3f4146' : kind === 'obsidian' ? '#121216' : '#c9c4b8'} />
    {kind === 'granite' && [[18, 20, '#f2a7a7'], [36, 18, '#2b2b2b'], [28, 36, '#ffffff'], [42, 36, '#f2a7a7'], [16, 38, '#2b2b2b']].map(([x, y, f], i) => (
      <polygon key={i} points={`${+x - (zoom ? 8 : 6)},${y} ${x},${+y - (zoom ? 8 : 6)} ${+x + (zoom ? 8 : 6)},${y} ${x},${+y + (zoom ? 8 : 6)}`} fill={f as string} />
    ))}
    {kind === 'basalt' && Array.from({ length: 34 }, (_, i) => (
      // Scattered on a sunflower spiral, so the tiny crystals do not line up.
      <circle key={i} cx={30 + Math.sqrt(i / 34) * 22 * Math.cos(i * 2.4)} cy={30 + Math.sqrt(i / 34) * 22 * Math.sin(i * 2.4)} r={zoom ? 1.8 : 0.9} fill="#7b7f86" />
    ))}
    {kind === 'obsidian' && <ellipse cx={22} cy={20} rx={9} ry={4} fill="#ffffff" opacity={0.35} />}
    {kind === 'pumice' && [[20, 20], [36, 22], [28, 34], [42, 38], [16, 38], [30, 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={zoom ? 5 : 3.5} fill="#8a857a" />)}
    {zoom && <circle cx={30} cy={30} r={28} fill="none" stroke="#fde68a" strokeWidth={2.5} />}
  </svg>
);

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useVolcanoProgress = useWorkspaceProgressFor('volcano-island');

const VolcanoIslandSurface: React.FC<VolcanoIslandProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `volcano-island-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  // Kitchen volcano
  const [b, setB] = useState<Mix>({ soda: 1, vinegar: 1 });
  const [prediction, setPrediction] = useState<Which | null>(null);
  const [eruptedA, setEruptedA] = useState(false);
  const [eruptedB, setEruptedB] = useState(false);
  const [claim, setClaim] = useState<Which | null>(null);
  // Runny or sticky: each test's guess and eruption, the call, whether the new volcano has erupted, and the eruption on
  // the island now.
  const [mgGuesses, setMgGuesses] = useState<Array<Outcome | null>>([null, null, null]);
  const [mgErupted, setMgErupted] = useState<boolean[]>([false, false, false]);
  const [mgCall, setMgCall] = useState<Outcome | null>(null);
  const [mgRevealed, setMgRevealed] = useState(false);
  const [eruption, setEruption] = useState<{ outcome: Outcome | null; key: string }>({ outcome: null, key: 'none' });
  // Layers over time: the guess, whether the learner's eruption has laid its layer, and the tapped order.
  const [lyGuess, setLyGuess] = useState<LayerGuess | null>(null);
  const [lyErupted, setLyErupted] = useState(false);
  const [lyOrder, setLyOrder] = useState<string[]>([]);
  // Save the village: the walls, the lava of the last test and how much of it is drawn, and what the tests showed.
  const [walls, setWalls] = useState<number[]>([]);
  const [lava, setLava] = useState<number[]>([]);
  const [lavaShown, setLavaShown] = useState(0);
  const [villageTests, setVillageTests] = useState(0);
  const [lastSafe, setLastSafe] = useState<boolean | null>(null);
  const lavaTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Cool the rock: each sample's guess and whether it has cooled, and the call on the found rock.
  const [rkGuesses, setRkGuesses] = useState<Array<RockKind | null>>([null, null, null, null]);
  const [rkCooled, setRkCooled] = useState<boolean[]>([false, false, false, false]);
  const [rkCall, setRkCall] = useState<Cooling | null>(null);
  useEffect(() => () => { if (lavaTimer.current) clearInterval(lavaTimer.current); }, []);
  // Shared
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [partsKey, setPartsKey] = useState('parts-0');
  const [guessesMatched, setGuessesMatched] = useState(0);
  // In-item levers (`volcanoLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<VolcanoChallenge | null>(null);

  const openItem = useCallback((c: VolcanoChallenge | undefined, key: string) => {
    // Volcano B starts as a copy of A: the learner changes one amount.
    setB(c?.type === 'kitchen_volcano' ? { ...c.a } : { soda: 1, vinegar: 1 });
    setPrediction(null); setEruptedA(false); setEruptedB(false); setClaim(null);
    setMgGuesses([null, null, null]); setMgErupted([false, false, false]); setMgCall(null); setMgRevealed(false);
    setEruption({ outcome: null, key: `none-${key}` });
    setLyGuess(null); setLyErupted(false); setLyOrder([]);
    if (lavaTimer.current) clearInterval(lavaTimer.current);
    setWalls([]); setLava([]); setLavaShown(0); setVillageTests(0); setLastSafe(null);
    setRkGuesses([null, null, null, null]); setRkCooled([false, false, false, false]); setRkCall(null);
    setPartsKey(`parts-${key}-${Date.now()}`);
  }, []);

  const progress = useVolcanoProgress<VolcanoChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: volcanoIslandBoss.assignment!,
    // A fresh item opens a fresh table or island. Try again keeps the mixes, eruptions and tests.
    onItemOpened: (index, retry) => {
      setVerdict(null); setFeedback(null);
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
  const kitchen = current?.type === 'kitchen_volcano' ? current : null;
  const magma = current?.type === 'runny_or_sticky' ? current : null;
  const layers = current?.type === 'layers_over_time' ? current : null;
  const village = current?.type === 'save_the_village' ? current : null;
  const rock = current?.type === 'cool_the_rock' ? current : null;
  const rkTesting = !!rock && rock.tested.some((_, i) => !rkCooled[i]);
  const pulledLevers = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && (pulledLevers.includes(id) || !!sessionItem?.startLevers?.includes(id));
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null;
  const bothErupted = eruptedA && eruptedB;
  const mgTesting = !!magma && magma.tested.some((_, i) => !mgErupted[i]);

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<VolcanoIslandMetrics>({
    primitiveType: 'volcano-island', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const recordPass = () => {
    if (!current || practice) return;
    const attempts = progress.currentAttempts + 1;
    progress.mergeResult({ challengeId: current.id, correct: true, attempts, score: Math.max(20, 100 - 30 * (attempts - 1)) });
  };

  // ── Kitchen volcano ───────────────────────────────────────────────────────
  /** Change volcano B. The test starts over: a new guess, and both volcanoes erupt again side by side. */
  const setAmount = (i: Ingredient, by: 1 | -1) => {
    if (!kitchen || locked || (kitchen.lockOther && i !== kitchen.change)) return;
    const n = Math.max(MIN_AMOUNT, Math.min(MAX_AMOUNT, b[i] + by));
    if (n === b[i]) return;
    setB(m => ({ ...m, [i]: n })); setEruptedA(false); setEruptedB(false); setPrediction(null); setClaim(null); setFeedback(null);
    SoundManager.tap();
  };
  const guess = (w: Which) => {
    if (locked || eruptedA || eruptedB) return;
    setPrediction(w); SoundManager.select();
  };
  const erupt = (which: 'a' | 'b') => {
    if (!kitchen || locked || !prediction) return;
    if (which === 'a') setEruptedA(true); else setEruptedB(true);
    SoundManager.select();
  };
  useEffect(() => {
    if (kitchen && bothErupted && prediction) {
      // Recorded, never part of the score.
      const real = foamHeight(kitchen.a) > foamHeight(b) ? 'a' : foamHeight(b) > foamHeight(kitchen.a) ? 'b' : 'same';
      if (prediction === real) setGuessesMatched(n => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bothErupted]);
  const checkKitchen = () => {
    if (!kitchen || locked || !bothErupted || !claim) return;
    const answer = { b, prediction, claim };
    const correct = kitchenMatches(kitchen, answer);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: kitchenFeedback(kitchen, answer), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeKitchen(kitchen, answer), correct, kitchenMiss(kitchen, answer));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Runny or sticky ───────────────────────────────────────────────────────
  const eruptTest = (i: number, g: Outcome) => {
    if (!magma || locked || mgErupted[i]) return;
    const m = magma.tested[i];
    setMgGuesses(gs => gs.map((x, k) => (k === i ? g : x)));
    setMgErupted(es => es.map((x, k) => (k === i ? true : x)));
    setEruption({ outcome: outcomeOf(m), key: `${m.key}-${Date.now()}` });
    if (g === outcomeOf(m)) setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const checkMagma = () => {
    if (!magma || locked || mgTesting || !mgCall) return;
    const correct = magmaMatches(magma, mgCall);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: magmaFeedback(magma, mgCall), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeMagma(magma, mgCall), correct, magmaMiss(magma, mgCall));
    if (correct) {
      SoundManager.playCorrect(); recordPass(); setMgRevealed(true);
      setEruption({ outcome: outcomeOf(magma.mystery), key: `${magma.mystery.key}-${Date.now()}` });
    } else SoundManager.playIncorrect();
  };

  // ── Layers over time ──────────────────────────────────────────────────────
  const eruptLayer = () => {
    if (!layers || locked || !lyGuess || lyErupted) return;
    setLyErupted(true);
    setEruption({ outcome: layers.newKind === 'lava' ? 'flows' : 'explodes', key: `layer-${Date.now()}` });
    if (lyGuess === 'top') setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const tapLayer = (id: string) => {
    if (!layers || locked || !lyErupted) return;
    setLyOrder(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id])); setFeedback(null); SoundManager.tap();
  };
  const lyTotal = layers ? layers.layers.length + 1 + (layers.dike ? 1 : 0) : 0;
  const checkLayers = () => {
    if (!layers || locked || lyOrder.length !== lyTotal) return;
    const correct = layersMatches(layers, lyOrder);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: layersFeedback(layers, lyOrder), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeLayers(layers, lyOrder), correct, layersMiss(layers, lyOrder));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
  };

  // ── Save the village ──────────────────────────────────────────────────────
  const tapCell = (i: number) => {
    if (!village || locked || i === village.crater || village.village.includes(i)) return;
    if (!walls.includes(i) && walls.length >= village.maxWalls) return;
    setWalls(w => (w.includes(i) ? w.filter(x => x !== i) : [...w, i]));
    if (lavaTimer.current) clearInterval(lavaTimer.current);
    setLavaShown(0); setFeedback(null); SoundManager.tap();
  };
  const testLava = () => {
    if (!village || locked) return;
    const path = lavaPath(village, walls);
    setLava(path); setLavaShown(0);
    setVillageTests(n => n + 1); setLastSafe(villageSafe(village, walls));
    setEruption({ outcome: 'flows', key: `village-${Date.now()}` });
    if (lavaTimer.current) clearInterval(lavaTimer.current);
    lavaTimer.current = setInterval(() => setLavaShown(n => {
      if (n + 1 >= path.length && lavaTimer.current) clearInterval(lavaTimer.current);
      return Math.min(path.length, n + 1);
    }), 120);
    SoundManager.select();
  };
  const checkVillage = () => {
    if (!village || locked) return;
    const correct = villageMatches(village, walls);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: villageFeedback(village, walls), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeVillage(village, walls), correct, villageMiss(village, walls));
    if (correct) { SoundManager.playCorrect(); recordPass(); testLava(); } else SoundManager.playIncorrect();
  };

  // ── Cool the rock ─────────────────────────────────────────────────────────
  const coolSample = (i: number, g: RockKind) => {
    if (!rock || locked || rkCooled[i]) return;
    setRkGuesses(gs => gs.map((x, k) => (k === i ? g : x)));
    setRkCooled(cs => cs.map((x, k) => (k === i ? true : x)));
    if (g === rockOf(rock.tested[i])) setGuessesMatched(n => n + 1);
    SoundManager.select();
  };
  const checkRock = () => {
    if (!rock || locked || rkTesting || !rkCall) return;
    const correct = rockMatches(rock, rkCall);
    setVerdict(correct ? 'correct' : 'incorrect');
    setFeedback({ text: rockFeedback(rock, rkCall), status: correct ? 'correct' : 'incorrect' });
    progress.commitCheck(describeRock(rock, rkCall), correct, rockMiss(rock, rkCall));
    if (correct) { SoundManager.playCorrect(); recordPass(); } else SoundManager.playIncorrect();
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
    const metrics: VolcanoIslandMetrics = {
      type: 'volcano-island', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
      guessesMatched,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation, guessesMatched]);

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionItem || allChallengesComplete) return;
    const scene = rock ? rockScene(rock, { guesses: rkGuesses, cooled: rkCooled.slice(0, rock.tested.length), call: rkCall })
      : village ? villageScene(village, { walls, tests: villageTests, lastTestSafe: lastSafe })
      : layers ? layersScene(layers, { guess: lyGuess, erupted: lyErupted, order: lyOrder })
      : magma ? magmaScene(magma, { guesses: mgGuesses, erupted: mgErupted.slice(0, magma.tested.length), call: mgCall, revealed: mgRevealed })
      : kitchenScene(kitchen!, { b, prediction, eruptedA, eruptedB, claim });
    // The lever set declares the levers and writes the onScreen facts (`leverScene`).
    const ctx: VolcanoLeverCtx = { bothErupted, newLayer: lyErupted, tested: villageTests > 0 };
    const leverItem: VolcanoChallenge = { ...sessionItem, supportTier: sessionItem.supportTier ?? data.supportTier };
    const shown = practice ? [] : [...pulledLevers, ...(sessionItem.startLevers ?? [])];
    const levers = practice ? [] : VOLCANO_LEVERS.declare(leverItem, ctx, shown);
    const published = leverScene(scene, {
      support: practice ? '' : VOLCANO_LEVERS.support(leverItem, ctx),
      onScreen: practice ? '' : VOLCANO_LEVERS.onScreen(leverItem, ctx, shown),
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
          const easier = VOLCANO_LEVERS.simpler(sessionItem, ctx, id);
          if (!easier) return 'This item has no easier version; try a help lever.';
          setLeverState(pulled); openItem(easier, easier.id); setVerdict(null); setFeedback(null); setPractice(easier);
          return { practice: volcanoIslandBoss.assignment!(easier) };
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
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">Nothing on the table yet.</LuminaCardContent></LuminaCard>;
  }

  const step = rock ? (rkTesting ? 'cool' : 'where') : village ? 'build' : layers ? (lyErupted ? 'order' : 'place') : magma ? (mgTesting ? 'test' : 'call') : !prediction ? 'mix' : !bothErupted ? 'erupt' : 'claim';
  const tags = !!magma && leverOn(MAGMA_TAGS_LEVER);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="rose">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="Eruptions done!" celebrationMessage="You tested volcanoes like a scientist." className="mb-2" />
        )}

        {!allChallengesComplete && current && (
          <LuminaPrompt accent="rose">
            {practice && <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300" data-practice>Practice</div>}
            <div className="text-base">{current.instruction}</div>
            <div className="mt-1 text-sm text-rose-100/80" data-volcano-step={step}>{PROMPT[step]}</div>
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-white/10">
            <VolcanoScene className="h-[min(52vh,440px)] min-h-[280px] w-full" partsKey={partsKey} world={magma || layers || village || rock ? 'island' : 'kitchen'}
              a={{ marks: kitchen ? foamHeight(kitchen.a) : 0, erupted: eruptedA }} b={{ marks: foamHeight(b), erupted: eruptedB }}
              eruption={eruption.outcome} eruptionKey={eruption.key} />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200">Drag to turn · pinch to zoom</div>
            {(magma || layers) && eruption.outcome && (
              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-orange-200" data-volcano-eruption={eruption.outcome}>
                {OUTCOME_WORDS[eruption.outcome][0].toUpperCase() + OUTCOME_WORDS[eruption.outcome].slice(1)}!
              </div>
            )}
          </div>

          {/* ── Kitchen volcano ── */}
          {!allChallengesComplete && kitchen && (
            <LuminaPanel className="space-y-3 p-3" data-volcano-panel="">
              <div className="text-sm text-slate-200">Volcano B</div>
              {(['soda', 'vinegar'] as const).map(i => {
                const fixed = kitchen.lockOther && i !== kitchen.change;
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2" data-volcano-amount={i}>
                    <span className="w-56 text-sm text-slate-100">{amountWords(i, b[i])}
                      {leverOn(CHANGES_LEVER) && b[i] !== kitchen.a[i] && (
                        <span className="ml-1 rounded bg-amber-400/20 px-1 text-xs text-amber-200" data-volcano-changed={i}>changed</span>
                      )}
                    </span>
                    {fixed ? <span className="text-xs text-slate-400">same as volcano A</span> : (
                      <>
                        <LuminaButton tone="ghost" onClick={() => setAmount(i, -1)} disabled={locked || b[i] <= MIN_AMOUNT}>{`Less ${INGREDIENT_WORD[i]}`}</LuminaButton>
                        <LuminaButton tone="ghost" onClick={() => setAmount(i, 1)} disabled={locked || b[i] >= MAX_AMOUNT}>{`More ${INGREDIENT_WORD[i]}`}</LuminaButton>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <span className="text-sm text-slate-200">Your guess: which will erupt higher?</span>
                {(['a', 'b', 'same'] as const).map(w => (
                  <LuminaChoiceChip key={w} label={WHICH_WORDS[w]} aria-label={`Guess: ${WHICH_WORDS[w]}`} selected={prediction === w}
                    onClick={() => guess(w)} disabled={locked || eruptedA || eruptedB} />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <LuminaButton tone="primary" onClick={() => erupt('a')} disabled={locked || !prediction || eruptedA}>Erupt volcano A</LuminaButton>
                <LuminaButton tone="primary" onClick={() => erupt('b')} disabled={locked || !prediction || eruptedB}>Erupt volcano B</LuminaButton>
              </div>
              {bothErupted && (
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                  <span className="text-sm text-slate-200">Which erupted higher?</span>
                  {(['a', 'b', 'same'] as const).map(w => (
                    <LuminaChoiceChip key={w} accent="rose" label={WHICH_WORDS[w]} aria-label={`Higher: ${WHICH_WORDS[w]}`} selected={claim === w}
                      onClick={() => { if (!locked) { setClaim(w); setFeedback(null); SoundManager.select(); } }} disabled={locked} />
                  ))}
                </div>
              )}
            </LuminaPanel>
          )}

          {/* ── Cool the rock ── */}
          {!allChallengesComplete && rock && (
            <LuminaPanel className="space-y-3 p-3" data-volcano-rock-panel="">
              {rock.tested.map((t, i) => {
                const kinds = Array.from(new Set(rock.tested.map(rockOf)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-3" data-volcano-sample={i}>
                    <RockTile kind={rkCooled[i] ? rockOf(t) : null} zoom={rkCooled[i] && leverOn(ZOOM_LEVER)} />
                    <div className="space-y-1">
                      <div className="text-sm text-slate-100">{t.gassy ? 'Gassy lava' : 'Lava'} cooled {COOLING_WORDS[t.cooling]}</div>
                      {rkCooled[i] ? <div className="text-sm text-slate-400">It made {ROCK_NAMES[rockOf(t)]}: {ROCK_LOOKS[rockOf(t)]}.</div> : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-400">Your guess:</span>
                          {kinds.map(k => (
                            <LuminaChoiceChip key={k} label={ROCK_LOOKS[k]} aria-label={`Guess sample ${i + 1}: ${ROCK_LOOKS[k]}`} onClick={() => coolSample(i, k)} disabled={locked} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
                <RockTile kind={rockOf(rock.mystery)} zoom={leverOn(ZOOM_LEVER)} />
                <div className="space-y-1">
                  <div className="text-sm text-slate-100">The found rock: {ROCK_LOOKS[rockOf(rock.mystery)]}. Where did it cool?</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {rock.places.map(p => (
                      <LuminaChoiceChip key={p} accent="rose" label={COOLING_WORDS[p]} aria-label={`Cooled ${COOLING_WORDS[p]}`} selected={rkCall === p}
                        onClick={() => { if (!locked && !rkTesting) { setRkCall(p); setFeedback(null); SoundManager.select(); } }} disabled={locked || rkTesting} />
                    ))}
                  </div>
                </div>
              </div>
            </LuminaPanel>
          )}

          {/* ── Save the village ── */}
          {!allChallengesComplete && village && (
            <LuminaPanel className="space-y-3 p-3" data-volcano-village-panel="">
              <SlopeMap c={village} walls={walls} lava={lava} shown={lavaShown}
                trail={leverOn(TRAIL_LEVER) && villageTests > 0 ? lava : null} onTap={tapCell} disabled={locked} />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-200" data-volcano-walls={walls.length}>Walls: {walls.length} of {village.maxWalls}</span>
                <LuminaButton tone="primary" onClick={testLava} disabled={locked}>Erupt to test</LuminaButton>
                {lastSafe != null && lavaShown >= lava.length && lava.length > 0 && (
                  <span className={`text-sm ${lastSafe ? 'text-emerald-300' : 'text-rose-300'}`} data-volcano-test-result={lastSafe ? 'safe' : 'hit'}>
                    {lastSafe ? 'The lava missed the village!' : 'The lava reached the village!'}
                  </span>
                )}
              </div>
            </LuminaPanel>
          )}

          {/* ── Layers over time ── */}
          {!allChallengesComplete && layers && (
            <LuminaPanel className="space-y-3 p-3" data-volcano-layers-panel="">
              <Cutaway c={layers} erupted={lyErupted} order={lyOrder} onTap={tapLayer} disabled={locked || !lyErupted}
                markNew={leverOn(NEW_LAYER_LEVER)} markCrack={leverOn(CRACK_LEVER)} />
              {!lyErupted ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-200">Your guess: the new layer will go at the…</span>
                  {(['top', 'middle', 'bottom'] as const).map(g => (
                    <LuminaChoiceChip key={g} label={g} aria-label={`Guess: the ${g}`} selected={lyGuess === g}
                      onClick={() => { if (!locked) { setLyGuess(g); SoundManager.select(); } }} disabled={locked} />
                  ))}
                  <LuminaButton tone="primary" onClick={eruptLayer} disabled={locked || !lyGuess}>Erupt the volcano</LuminaButton>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2" data-volcano-order={lyOrder.join(',')}>
                  <span className="text-sm text-slate-200">Your order so far: {lyOrder.length ? lyOrder.map(x => layerName(layers, x).replace(/^the /, '')).join(' → ') : 'none'}</span>
                  <LuminaButton tone="ghost" onClick={() => { if (!locked) setLyOrder([]); }} disabled={locked || !lyOrder.length}>Start over</LuminaButton>
                </div>
              )}
            </LuminaPanel>
          )}

          {/* ── Runny or sticky ── */}
          {!allChallengesComplete && magma && (
            <LuminaPanel className="space-y-3 p-3" data-volcano-magma-panel="">
              {magma.tested.map((m, i) => (
                <div key={m.key} className="space-y-1" data-volcano-test={m.key}>
                  <div className="text-sm text-slate-100">{m.name} <span className="text-slate-400">· {magmaLooks(m)}</span>{tags && <MagmaTag m={m} />}</div>
                  {mgErupted[i] ? <div className="text-sm text-slate-400">It erupted: {OUTCOME_WORDS[outcomeOf(m)]}.</div> : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-400">Your guess:</span>
                      {magma.outcomes.map(o => (
                        <LuminaChoiceChip key={o} label={OUTCOME_WORDS[o]} aria-label={`Guess ${m.name}: ${OUTCOME_WORDS[o]}`} onClick={() => eruptTest(i, o)} disabled={locked} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="space-y-1 border-t border-white/10 pt-3">
                <div className="text-sm text-slate-100">New: {magma.mystery.name} <span className="text-slate-400">· {magmaLooks(magma.mystery)}</span>{tags && <MagmaTag m={magma.mystery} />}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">It will…</span>
                  {magma.outcomes.map(o => (
                    <LuminaChoiceChip key={o} accent="rose" label={OUTCOME_WORDS[o]} aria-label={`New volcano: ${OUTCOME_WORDS[o]}`} selected={mgCall === o}
                      onClick={() => { if (!locked && !mgTesting) { setMgCall(o); setFeedback(null); SoundManager.select(); } }} disabled={locked || mgTesting || mgRevealed} />
                  ))}
                </div>
              </div>
            </LuminaPanel>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!allChallengesComplete && kitchen && bothErupted && (
              <LuminaActionButton action="check" onClick={checkKitchen} disabled={locked || !claim}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && rock && !rkTesting && (
              <LuminaActionButton action="check" onClick={checkRock} disabled={locked || !rkCall}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && village && (
              <LuminaActionButton action="check" onClick={checkVillage} disabled={locked}>I&apos;m done!</LuminaActionButton>
            )}
            {!allChallengesComplete && layers && lyErupted && (
              <LuminaActionButton action="check" onClick={checkLayers} disabled={locked || lyOrder.length !== lyTotal}>Check</LuminaActionButton>
            )}
            {!allChallengesComplete && magma && !mgTesting && (
              <LuminaActionButton action="check" onClick={checkMagma} disabled={locked || !mgCall}>Check</LuminaActionButton>
            )}
          </div>

          {!allChallengesComplete && feedback && (
            <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>
          )}
          {!allChallengesComplete && kitchen && (eruptedA || eruptedB) && (
            <LuminaTable caption="Lab notebook" accent="rose" columns={['Volcano', 'Mix', 'Foam rose to']} rows={[
              ['Volcano A', mixWords(kitchen.a), eruptedA ? `Mark ${foamHeight(kitchen.a)}` : '—'],
              ['Volcano B', mixWords(b), eruptedB ? `Mark ${foamHeight(b)}` : '—'],
            ]} />
          )}
          {!allChallengesComplete && kitchen && bothErupted && leverOn(FIZZ_LEVER) && (
            <div className="space-y-2 rounded-lg border border-white/10 p-3" data-volcano-fizz="">
              {([['A', kitchen.a], ['B', b]] as const).map(([name, m]) => {
                const pairs = Math.min(m.soda, m.vinegar);
                return (
                  <div key={name} className="flex flex-wrap items-center gap-1" data-volcano-fizz-row={name}>
                    <span className="w-20 text-xs text-slate-300">Volcano {name}</span>
                    {Array.from({ length: pairs }, (_, k) => (
                      <span key={k} className="rounded bg-rose-400/20 px-1 text-xs text-rose-100">🥄+🥤</span>
                    ))}
                    {m.soda > pairs && Array.from({ length: m.soda - pairs }, (_, k) => <span key={`s${k}`} className="px-1 text-xs opacity-40">🥄</span>)}
                    {m.vinegar > pairs && Array.from({ length: m.vinegar - pairs }, (_, k) => <span key={`v${k}`} className="px-1 text-xs opacity-40">🥤</span>)}
                  </div>
                );
              })}
            </div>
          )}
          {!allChallengesComplete && magma && mgErupted.some(Boolean) && (
            <LuminaTable caption="Lab notebook" accent="rose" columns={['Volcano', 'Magma', 'Guess', 'What happened']}
              rows={magma.tested.map((m, i) => [m.name, magmaLooks(m), mgGuesses[i] ? OUTCOME_WORDS[mgGuesses[i]!] : '—',
                mgErupted[i] ? OUTCOME_WORDS[outcomeOf(m)] : '—'])} />
          )}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const VolcanoIsland = withWorkspaceOnly<VolcanoIslandProps>('volcano-island', VolcanoIslandSurface, props => props.data.title);

/**
 * Volcano Island runs only on the teaching workspace: the tutor is present, each mode's Check commits, and the runtime
 * moves to the next item. Outside a bound session the "needs the tutor" card shows.
 */
export default VolcanoIsland;
