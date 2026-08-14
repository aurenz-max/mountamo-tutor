'use client';

/**
 * AdditionSubtractionScene — DI modality. The Live tutor owns the clock in every
 * mode (qa/di/BACKLOG.md item 18 P2; the second MATH port after ten-frame).
 *
 * WHAT THE CHILD DOES, PER MODE.
 *  - solve-story (K + Grade 1): the tutor reads the story and asks the question;
 *    the child SAYS the number into an open mic. This is the port the user
 *    asked for — *"speaking aloud instead of typing"* — and it replaces a
 *    keyboard at Grade 1 and a row of numeral tiles at K.
 *  - act-out @ Grade 1: the child enacts the departure on the scene (a static
 *    picture cannot show one — contract R3 item 12), then SAYS how many are
 *    left. Addition counts the scene and says the total.
 *  - act-out @ K: the child ENACTS the story by bringing objects in or sending
 *    them away. The enacted scene count IS the answer (contract R3 item 11,
 *    untouched).
 *  - build-equation: the child BUILDS the number sentence from tiles.
 *  - create-story: the child BUILDS the scene that matches a given equation.
 *
 * WHY THREE MODES KEPT THEIR HANDS, AND ONE OF THOSE IS ARGUABLE — the full
 * fork, its evidence and the one flag for the drive live in
 * `additionSubtractionSceneScript.ts`. Short version: in literacy the clicking
 * almost always stood in for a mouth; in math the manipulative is often the
 * skill, and R3 had already deleted this primitive's proxy number for a better
 * reason than the modality would have.
 *
 * WHAT CHANGED. Deleted: both numeric keyboards, the K numeral-tile row, the
 * Check control, the Next control, the scene+object picker (it accepted ANY
 * selection as correct — a mode that cannot produce a wrong answer has nothing
 * for a judge to do), the feedback card that named the target, the old tutor
 * hook, and all fourteen of the improvised tutor turns it sent. There is no
 * progression timer and no progression control anywhere in this file —
 * progression here has exactly one cause: a tutor verdict.
 *
 * HOW A HANDS-ONLY TURN CLOSES. A voice turn closes on SILENCE (the mic's
 * amplitude bracket). A hands turn closes on STILLNESS: when the scene (or the
 * tile tray) stops changing, the commit is described to the tutor and judged.
 * The equation tray also has a STRUCTURAL close — a finished number sentence
 * shortens the window — and neither close is correctness-gated: a wrong scene
 * commits exactly as readily as a right one. That property is the whole point.
 * The click era auto-judged `act-out` @K and `create-story` the instant the
 * count MATCHED, so those modes could only ever produce a correct answer;
 * stopping early or overshooting is now a wrong answer the tutor corrects.
 *
 * THE TUTOR OWNS THE STIMULUS CLOCK, NOT JUST THE ADVANCE. `groupedReveal` —
 * the change group arriving separately so the JOIN is visible — is a stimulus
 * the ask refers to, so it waits for her to have told the story and stopped
 * (ten-frame drives 3 and 5). The gate is a falling edge AND `cuedItemId`:
 * "not speaking" is also true before her audio starts, and on an advance the
 * new item is on screen for the whole tail of the previous item's affirmation.
 *
 * ANSWER-LEAK RULE — INCLUDING IN PIXELS. The story prints but never states the
 * value the child must produce (build gate, both sides of the wire). The
 * ten-frame aid mirrors what is ACTUALLY VISIBLE, so it cannot fill to the
 * total while the change group is still waiting on her voice. Nothing names the
 * answer until the tutor has affirmed it.
 *
 * DOCTRINE HELD: open mic, never push-to-talk; the mic is never gated on
 * tutor-busy; the tutor is quiet by default (it speaks only scripted lines); no
 * visible timers; tap-to-hear re-speaks the STORY and never the answer; adult
 * chrome is hidden for pre-readers.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaPrompt,
  LuminaChallengeCounter,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AdditionSubtractionSceneMetrics } from '../../../evaluation/types';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import { judgedAnswerMix, type JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  completeCue,
  equationVerdictCue,
  itemCue,
  itemFromChallenge,
  moveOnCue,
  parseEquationTiles,
  pronounceCue,
  sceneVerdictCue,
  stimulusFor,
  type AddSubBand,
  type AddSubSceneItem,
} from './additionSubtractionSceneScript';
import { numberWordFor } from './countingBoardScript';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
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
  gradeBand: AddSubBand;

  /**
   * Support-tier levers (act-out). Scaffolding-only — never change the numbers.
   * - showCountBadges: tapping an object stamps its running ordinal (1,2,3…) so the
   *   scene tracks the count. Off = the student must hold the count mentally.
   * - groupedReveal: the "change" objects arrive separately from the "start" group
   *   so the join is visible. Off = all objects appear together (must segment).
   *   Under the judged loop this reveal waits for the tutor's voice, never a clock.
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

const PHASE_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  'act-out':        { label: 'Act Out',        icon: '🎭' },
  'build-equation': { label: 'Build Equation', icon: '🧩' },
  'solve-story':    { label: 'Solve Story',    icon: '📖' },
  'create-story':   { label: 'Create Story',   icon: '✨' },
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

/** Stillness that closes a hands-only turn — the gesture analogue of the mic's
 *  silence bracket (ten-frame's finding, generalised here to a second Class-B
 *  surface). Deliberately generous: a five-year-old placing objects pauses to
 *  think, and a premature commit spends one of the two corrections. */
const SCENE_SETTLE_MS = 3000;
/** The tile tray runs longer, because a number sentence is five deliberate taps
 *  and a mid-build pause is normal. */
const EQUATION_SETTLE_MS = 4500;
/** A tray that has reached a FINISHED SHAPE (N op N = N) still waits — briefly —
 *  rather than committing on the keystroke: "3 + 2 = 1" is a complete sentence
 *  on its way to becoming "3 + 2 = 10". Structural, never correctness-gated. */
const EQUATION_COMPLETE_SETTLE_MS = 1200;

/** A breath AFTER the tutor stops talking, before the change group arrives —
 *  so the join lands just after "…and one more duck joins them", not on top of
 *  it. See the reveal gate for why that distinction is the whole design. */
const REVEAL_PREP_MS = 600;
/** If her audio never arrives at all, the stimulus still has to happen — a child
 *  cannot answer about a join they were never shown. Long enough that it never
 *  pre-empts a real utterance. */
const TUTOR_SILENCE_FALLBACK_MS = 12_000;

// ============================================================================
// Helpers
// ============================================================================

function getEmoji(objectType: string): string {
  return OBJECT_EMOJI[objectType] || '⭐';
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

/** Ten-frame counting aid. Mirrors what is ON SCREEN — never a stored count
 *  (contract R8) and never more than is currently visible, so it cannot fill to
 *  the total while the change group is still waiting on the tutor's voice. */
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
// Component
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

  const isPreReader = gradeBand === 'K';

  // ── Stage-payload state (the runner owns progression; this is the scene) ──
  /** Objects currently in the picture, by STABLE slot id, so removing one leaves
   *  the survivors exactly where they were. Build scenes only. */
  const [sceneSlots, setSceneSlots] = useState<number[]>([]);
  const builtCount = sceneSlots.length;
  /** Tapped-to-count highlights, in TAP ORDER so the ordinal badge climbs
   *  1,2,3… in the order the child touches them (K.CC.4 one-to-one). */
  const [tappedObjects, setTappedObjects] = useState<number[]>([]);
  const [equationTiles, setEquationTiles] = useState<string[]>([]);
  /** Has the change group arrived? Gated on the tutor's voice, never a clock. */
  const [changeRevealed, setChangeRevealed] = useState(false);
  /** Has the tutor spoken for THIS item yet? The reveal waits on her, so it has
   *  to tell "she has not started" from "she has finished" — both look like
   *  silence. Reset on every item and on every correction retry. */
  const [tutorHasSpoken, setTutorHasSpoken] = useState(false);
  /** The number sentence JUST affirmed — post-answer only (answer-leak rule),
   *  cleared the moment the next item opens. */
  const [reward, setReward] = useState<string | null>(null);

  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the scene / tray held when it last stopped changing. */
  const pendingSceneRef = useRef(0);
  const pendingTilesRef = useRef<string[]>([]);

  const stableInstanceIdRef = useRef(instanceId || `add-sub-scene-${Math.round(performance.now())}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const evaluation = usePrimitiveEvaluation<AdditionSubtractionSceneMetrics>({
    primitiveType: 'addition-subtraction-scene',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  // ── The pack: generated challenges → judged items + hand-authored script ──
  // Unaskable items are DROPPED here (zero spoken answers, inconsistent
  // arithmetic, a story that opens with a verdict sentinel or states the value
  // the child must produce). Nothing is backfilled: a placeholder in a judged
  // loop becomes a spoken ask the tutor has to judge.
  const items = useMemo<AddSubSceneItem[]>(() =>
    challenges
      .map((ch) => itemFromChallenge(ch, { band: gradeBand }))
      .filter((item): item is AddSubSceneItem => item !== null),
    [challenges, gradeBand],
  );

  const challengeById = useMemo(
    () => new Map(challenges.map((ch) => [ch.id, ch])),
    [challenges],
  );

  const pack = useMemo<JudgedScriptPack<AddSubSceneItem>>(() => ({
    primitiveType: 'addition-subtraction-scene',
    activityLine: 'live direct instruction addition and subtraction story scenes',
    items,
    itemCue,
    moveOnCue,
    completeCue,
    pronounceCue,
    contextFor: (item) => ({
      challengeType: item.kind,
      stimulus: stimulusFor(item),
    }),
    // Only what DIFFERS from the runner's defaults.
    statusLines: {
      ready: (item) => item.answerKind === 'gesture'
        ? 'Listen to the story, then show me.'
        : 'Listen to the story, then say your answer out loud.',
      retry: (item) => item.answerKind === 'gesture'
        ? 'Have another go — show me again.'
        : 'Have another go — say your answer.',
      done: 'Great story math today!',
    },
    diagnosisObservation: (item, { lastHeard }) =>
      item.answerKind === 'gesture'
        ? {
            challenge: item.kind === 'build-equation'
              ? `Build the number sentence for "${item.situation}" (${item.equation}).`
              : `${item.operation === 'addition' ? 'Bring in' : 'Send away'} ${item.changeCount} — the picture should end with ${item.answer} ${item.objectType}.`,
            expected: item.kind === 'build-equation'
              ? item.equation
              : `${item.answer} ${item.objectType}.`,
            observed: item.kind === 'build-equation'
              ? `Built "${pendingTilesRef.current.join(' ') || 'nothing'}".`
              : `Ended with ${pendingSceneRef.current}.`,
          }
        : {
            challenge: `${item.kind} (${item.unknownPosition} unknown): ${item.situation}`,
            expected: `${numberWordFor(item.answer)} (${item.answer})`,
            observed: lastHeard
              ? `Heard "${lastHeard}".`
              : 'The tutor judged the answer wrong from the audio.',
          },
  }), [items]);

  // ── Per-item scene reset — every item owns its starting state ─────────────
  const resetSceneFor = useCallback((item: AddSubSceneItem) => {
    clearSettle();
    setReward(null);
    setTappedObjects([]);
    setEquationTiles([]);
    pendingTilesRef.current = [];
    setTutorHasSpoken(false);

    // The change group is a stimulus on count-the-scene items, so it waits for
    // her voice. Everywhere else there is nothing to withhold: enacted scenes
    // are built by the child, and a withdrawn `groupedReveal` (hard tier) means
    // "everything at once" by design.
    const waitsForReveal = item.kind === 'act-out'
      && item.answerKind === 'voice'
      && item.operation === 'addition'
      && groupedReveal;
    setChangeRevealed(!waitsForReveal);

    // Seeding, per contract R3:
    //  • create-story: addition starts EMPTY (build up to the total);
    //    subtraction starts pre-filled at startCount (send the change away).
    //  • act-out: seeded with the story's START group wherever the scene is
    //    enacted — K at both operations, Grade 1 at subtraction (a static
    //    picture can show a join but never a departure).
    //  • everything else is count-driven and holds no slots.
    const enacted = item.kind === 'create-story'
      || (item.kind === 'act-out' && (item.band === 'K' || item.operation === 'subtraction'));
    const seeded = !enacted
      ? 0
      : item.kind === 'create-story' && item.operation === 'addition'
        ? 0
        : item.startCount;
    setSceneSlots(Array.from({ length: seeded }, (_, i) => i));
    pendingSceneRef.current = seeded;
  }, [clearSettle, groupedReveal]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const itemOf = (id: string) => items.find((i) => i.id === id);
    const accuracyOver = (kind: AddSubSceneItem['kind']) => {
      const scoped = summary.outcomes.filter((o) => itemOf(o.id)?.kind === kind);
      return scoped.length > 0
        ? Math.round((scoped.filter((o) => o.solved).length / scoped.length) * 100)
        : 0;
    };

    const metrics: AdditionSubtractionSceneMetrics = {
      type: 'addition-subtraction-scene',
      overallAccuracy: summary.accuracy,
      equationBuildingAccuracy: accuracyOver('build-equation'),
      storySolvingAccuracy: accuracyOver('solve-story'),
      attemptsCount: summary.attemptsCount,
      operationsUsed: Array.from(new Set(items.map((i) => i.operation))),
      storyTypesUsed: Array.from(new Set(
        items.map((i) => challengeById.get(i.id)?.storyType).filter((t): t is AddSubChallenge['storyType'] => !!t),
      )),
    };

    evaluation.submitResult(
      summary.solvedCount === items.length,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, challengeById, evaluation]);

  const runner = useJudgedScriptRunner<AddSubSceneItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeBand === 'K' ? 'Kindergarten' : 'Grade 1',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: resetSceneFor,
    onAffirmed: (item) => {
      // The first moment a number may appear on screen.
      setChangeRevealed(true);
      setReward(item.equation);
    },
    onCorrectionRetry: (item) => {
      // The tutor's correction re-modeled and re-asked in-band; restore the
      // working surface for another go. Clearing `tutorHasSpoken` is what makes
      // a re-reveal wait for her CORRECTION to finish — the same gate as the
      // first ask, so there is no hand-tuned window to get wrong.
      clearSettle();
      setTutorHasSpoken(false);
      if (item.kind === 'build-equation') {
        // The tray clears: the tiles are indistinguishable from each other, so
        // there is no "wrong slot" to clear the way cvc-speller does.
        setEquationTiles([]);
        pendingTilesRef.current = [];
        return;
      }
      if (item.answerKind === 'gesture') {
        const seeded = item.kind === 'create-story' && item.operation === 'addition' ? 0 : item.startCount;
        setSceneSlots(Array.from({ length: seeded }, (_, i) => i));
        pendingSceneRef.current = seeded;
      }
      setTappedObjects([]);
    },
  });

  const currentItem = runner.currentItem;
  const currentSolved = runner.currentSolved;
  const sceneConfig = currentItem
    ? SCENE_BACKGROUNDS[currentItem.scene] || SCENE_BACKGROUNDS.pond
    : SCENE_BACKGROUNDS.pond;

  // Is the scene ENACTED for this item (the child adds/removes objects), or
  // count-driven (the picture is painted from the story)?
  const isEnactedScene = !!currentItem && (
    currentItem.kind === 'create-story'
    || (currentItem.kind === 'act-out' && (currentItem.band === 'K' || currentItem.operation === 'subtraction'))
  );

  // Grade-1 act-out subtraction: how many objects the story still says to send
  // away. While > 0 a tap REMOVES the object it lands on; at 0 the story has
  // been enacted and taps fall through to the count aid, so the badges tag the
  // SURVIVORS — the group the spoken answer is actually about.
  const removalsRemaining = useMemo(() => {
    if (!currentItem || currentItem.answerKind !== 'voice' || currentItem.kind !== 'act-out') return 0;
    if (currentItem.operation !== 'subtraction') return 0;
    const removed = Math.max(0, currentItem.startCount - builtCount);
    return Math.max(0, currentItem.changeCount - removed);
  }, [currentItem, builtCount]);

  // How many objects the picture currently holds. Enacted scenes show exactly
  // what the child built; count-driven scenes paint the story — and while the
  // change group is still waiting on her voice, only the start group is there.
  const totalVisible = useMemo(() => {
    if (!currentItem) return 0;
    if (isEnactedScene) return builtCount;
    if (currentItem.kind === 'act-out' && currentItem.operation === 'addition' && !changeRevealed) {
      return currentItem.startCount;
    }
    return currentItem.resultCount;
  }, [currentItem, isEnactedScene, builtCount, changeRevealed]);

  // The most objects the scene will ever hold for this item. Positions are laid
  // out ONCE for this capacity (not per live count), so removing an object
  // leaves its survivors exactly where they were.
  const sceneCapacity = useMemo(() => {
    if (!currentItem) return 0;
    if (!isEnactedScene) return Math.max(currentItem.resultCount, currentItem.startCount);
    return currentItem.operation === 'addition'
      ? Math.max(currentItem.startCount, currentItem.resultCount)
      : currentItem.startCount;
  }, [currentItem, isEnactedScene]);

  const positions = useMemo(
    () => scenePositions(sceneCapacity, runner.currentIndex * 31 + 7),
    [sceneCapacity, runner.currentIndex],
  );

  const sceneObjects = useMemo(() => {
    if (isEnactedScene) {
      return sceneSlots
        .map((slotId) => ({ slotId, pos: positions[slotId] }))
        .filter((o): o is { slotId: number; pos: { x: number; y: number } } => !!o.pos);
    }
    return positions
      .slice(0, totalVisible)
      .map((pos, i) => ({ slotId: i, pos }));
  }, [isEnactedScene, sceneSlots, positions, totalVisible]);

  const startGroup = useMemo(() => {
    const s = new Set<number>();
    for (let i = 0; i < (currentItem?.startCount ?? 0); i++) s.add(i);
    return s;
  }, [currentItem]);

  // ── The gesture commits ───────────────────────────────────────────────────
  // No Check control: nothing on screen may carry the child forward. The cue
  // goes out through `submitGestureAttempt`, which opens the attempt when the
  // cue is actually SENT — an attempt opened at commit time would block the very
  // cue meant to provoke its verdict (cvc-speller's finding).
  const commitScene = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.answerKind !== 'gesture' || item.kind === 'build-equation') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    runner.submitGestureAttempt(sceneVerdictCue(item, pendingSceneRef.current));
  }, [runner]);

  const commitEquation = useCallback(() => {
    const item = runner.currentItem;
    if (!item || item.kind !== 'build-equation') return;
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    if (pendingTilesRef.current.length === 0) return;
    runner.submitGestureAttempt(equationVerdictCue(item, pendingTilesRef.current));
  }, [runner]);

  /** A hands turn closes on stillness. Any further touch resets the window. */
  const armSceneSettle = useCallback((count: number) => {
    pendingSceneRef.current = count;
    clearSettle();
    settleTimerRef.current = setTimeout(() => { commitScene(); }, SCENE_SETTLE_MS);
  }, [clearSettle, commitScene]);

  const armEquationSettle = useCallback((tiles: string[]) => {
    pendingTilesRef.current = tiles;
    clearSettle();
    // A finished SHAPE shortens the window; it never commits on the keystroke,
    // because "3 + 2 = 1" is a complete sentence on its way to "3 + 2 = 10".
    const wait = parseEquationTiles(tiles) ? EQUATION_COMPLETE_SETTLE_MS : EQUATION_SETTLE_MS;
    settleTimerRef.current = setTimeout(() => { commitEquation(); }, wait);
  }, [clearSettle, commitEquation]);

  // ── Scene taps ────────────────────────────────────────────────────────────
  // NEVER gate interaction on the stage word — the runner sets 'affirmed' and
  // opens the next item in the same dispatch, so a stage-gated scene ships dead
  // from item 2 on (ten-frame drive 1). `canAttempt` reads the solved ledger.
  const handleObjectTap = useCallback((slotId: number) => {
    const item = runner.currentItem;
    if (!item || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture()) return;

    // Sending an object away: every enacted scene, plus Grade-1 act-out
    // subtraction until the story's departure has been enacted.
    const removes = isEnactedScene && (item.answerKind === 'gesture' || removalsRemaining > 0);
    if (removes) {
      if (!sceneSlots.includes(slotId)) return;
      SoundManager.tap();
      const remaining = sceneSlots.filter((s) => s !== slotId);
      setSceneSlots(remaining);
      if (item.answerKind === 'gesture') armSceneSettle(remaining.length);
      else pendingSceneRef.current = remaining.length;
      return;
    }

    // Counting aid (highlight + running ordinal; changes no count). Consumers:
    // Grade-1 act-out addition, Grade-1 act-out subtraction once the removals
    // are enacted, and solve-story where the visible scene count IS the answer.
    const isCountAid = item.kind === 'act-out'
      || (item.kind === 'solve-story' && item.unknownPosition === 'result');
    if (!isCountAid) return;
    SoundManager.tap();
    setTappedObjects((prev) =>
      prev.includes(slotId) ? prev.filter((x) => x !== slotId) : [...prev, slotId],
    );
  }, [
    runner, evaluation.hasSubmitted, isEnactedScene, removalsRemaining,
    sceneSlots, armSceneSettle,
  ]);

  /** Bring one more object in — the addition interaction on any enacted scene. */
  const addSceneObject = useCallback(() => {
    const item = runner.currentItem;
    if (!item || !isEnactedScene || !runner.canAttempt || evaluation.hasSubmitted) return;
    if (runner.isAwaitingGesture() || builtCount >= maxNumber) return;
    // Append the lowest unused slot id so re-adding after a removal fills the
    // gap rather than growing past the scene's laid-out capacity.
    const used = new Set(sceneSlots);
    let slot = 0;
    while (used.has(slot)) slot++;
    SoundManager.tap();
    const next = [...sceneSlots, slot];
    setSceneSlots(next);
    if (item.answerKind === 'gesture') armSceneSettle(next.length);
    else pendingSceneRef.current = next.length;
  }, [
    runner, isEnactedScene, evaluation.hasSubmitted, builtCount,
    maxNumber, sceneSlots, armSceneSettle,
  ]);

  // ── Equation tray ─────────────────────────────────────────────────────────
  const addTile = useCallback((tile: string) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    const next = [...equationTiles, tile];
    setEquationTiles(next);
    armEquationSettle(next);
  }, [runner, equationTiles, armEquationSettle]);

  const removeTile = useCallback((index: number) => {
    if (!runner.canAttempt || runner.isAwaitingGesture()) return;
    SoundManager.tap();
    const next = equationTiles.filter((_, i) => i !== index);
    setEquationTiles(next);
    armEquationSettle(next);
  }, [runner, equationTiles, armEquationSettle]);

  // ── THE REVEAL GATE: THE TUTOR'S VOICE OWNS THE STIMULUS ──────────────────
  // She tells the story — "Two ducks are swimming in the pond. One more duck
  // joins them." — and THEN the extra duck arrives. Keying the reveal to a beat
  // measured from item-open races her instead, so the join happens while she is
  // still setting the scene and the ask lands on a picture the child was never
  // told to watch (ten-frame drive 3).
  //
  // "Not speaking" is ambiguous on its own — it is also true in the gap before
  // her audio starts — so the gate is a FALLING EDGE. And a falling edge alone
  // is not enough either: on an advance the runner queues the next item's cue
  // and opens the item in the same dispatch, so the new item is on screen for
  // the whole tail of the PREVIOUS item's affirmation, and a latch would fill on
  // that tail (ten-frame drive 5). `runner.cuedItemId` is the runner's answer —
  // the id of the item her live line is ACTUALLY about.
  const tutorSpeaking = runner.tutorSpeaking;
  const askIsForThisItem = currentItem != null && runner.cuedItemId === currentItem.id;
  const revealPending = runner.running && !changeRevealed;

  useEffect(() => {
    if (revealPending && askIsForThisItem && tutorSpeaking) setTutorHasSpoken(true);
  }, [revealPending, askIsForThisItem, tutorSpeaking]);

  // Safety net: if her audio never arrives, the stimulus still has to happen.
  useEffect(() => {
    if (!revealPending || tutorHasSpoken) return;
    const timer = setTimeout(() => setTutorHasSpoken(true), TUTOR_SILENCE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [revealPending, tutorHasSpoken]);

  useEffect(() => {
    if (!revealPending || !tutorHasSpoken || tutorSpeaking) return;
    const timer = setTimeout(() => setChangeRevealed(true), REVEAL_PREP_MS);
    return () => clearTimeout(timer);
  }, [revealPending, tutorHasSpoken, tutorSpeaking]);

  // Cancel timers on unmount.
  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  // ── Equation tray palette (R6 AXIS-1 lever, unchanged) ────────────────────
  const equationTilePalette = useMemo(() => {
    const allowed = currentItem?.allowedTiles;
    const numberTiles = allowed && allowed.length > 0
      ? Array.from(new Set(allowed)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      : EQUATION_TILES.filter((t) => {
          const num = parseInt(t, 10);
          return !isNaN(num) && num <= maxNumber;
        });
    return [...numberTiles, '+', '-', '='];
  }, [currentItem, maxNumber]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  /** An all-spoken run never touched the picture and an all-hands run never said
   *  a number — only a mixed set earned a line about both. */
  const celebrationMessage = useMemo(() => {
    switch (judgedAnswerMix(items)) {
      case 'gesture':
        return 'You told the whole story with your own hands!';
      case 'mixed':
        return 'You told the story with your voice and your hands!';
      default:
        return 'You solved every story out loud!';
    }
  }, [items]);

  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => (
      PHASE_TYPE_CONFIG[item.kind] ?? { label: item.kind, icon: '🔢' }
    ));
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No story challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const kind = currentItem?.kind;
  const isGestureItem = currentItem?.answerKind === 'gesture';
  const emoji = currentItem ? getEmoji(currentItem.objectType) : '⭐';
  const canAddObjects = isEnactedScene
    && !(currentItem?.kind === 'act-out' && currentItem.operation === 'subtraction' && currentItem.answerKind === 'voice');

  const stageWord = runner.stage === 'judging'
    ? 'let’s see…'
    : currentSolved
      ? 'yes!'
      : runner.running
        ? (isGestureItem ? 'your turn' : 'how many?')
        : 'get ready';

  return (
    <LuminaCard className={`shadow-2xl ${className || ''}`}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            {/* Grade / mode badges are adult chrome — hidden for pre-readers. */}
            {!isPreReader && (
              <div className="flex items-center gap-2">
                <LuminaBadge accent="orange" className="text-xs">Grade 1</LuminaBadge>
                {kind && (
                  <LuminaBadge accent="emerald" className="text-xs">
                    {PHASE_TYPE_CONFIG[kind]?.icon} {PHASE_TYPE_CONFIG[kind]?.label}
                  </LuminaBadge>
                )}
              </div>
            )}
          </div>
          <LuminaBadge accent="cyan" className="text-xs">
            {isGestureItem ? 'Show me' : 'Say it out loud'}
          </LuminaBadge>
        </div>
        {!isPreReader && description && (
          <p className="text-slate-400 text-sm mt-1">{description}</p>
        )}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && currentItem && (
          <>
            {!isPreReader && (
              <div className="flex justify-center">
                <LuminaChallengeCounter
                  current={Math.min(runner.currentIndex + 1, items.length)}
                  total={items.length}
                  variant="dots"
                />
              </div>
            )}

            {/* The story, for readers. The tutor SPEAKS it for everyone (R1),
                and it is the situation only — the generated question is stripped
                so the tutor's own code-owned ask is the only one asked. The
                LLM-authored instruction line is NOT printed: the cue is
                code-owned per band, and a printed instruction could name an
                action this band does not implement (R3 changelog item 12d). */}
            {!isPreReader && currentItem.situation && (
              <LuminaPrompt>
                <span className="text-sm">{currentItem.situation}</span>
              </LuminaPrompt>
            )}

            {/* The number sentence a create-story item must be built FOR — the
                given prompt, not an answer. */}
            {kind === 'create-story' && (
              <div className="text-center text-2xl font-bold text-emerald-200 tracking-wide font-mono">
                {currentItem.equation}
              </div>
            )}

            {/* Scene */}
            <div className="flex justify-center">
              <div
                className={`relative rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br ${sceneConfig.gradient}`}
                style={{ width: SCENE_WIDTH, maxWidth: '100%', height: SCENE_HEIGHT }}
              >
                <div className="absolute top-2 left-2">
                  <LuminaBadge className="bg-black/30 border-white/10 text-white/70 text-[10px]">
                    {sceneConfig.label}
                  </LuminaBadge>
                </div>

                <svg
                  width={SCENE_WIDTH}
                  height={SCENE_HEIGHT}
                  viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`}
                  className="absolute inset-0 w-full h-full"
                >
                  {sceneObjects.map(({ slotId, pos }) => {
                    const isTapped = tappedObjects.includes(slotId);
                    const isChangeGroup = !startGroup.has(slotId);
                    // The change group ARRIVES when she has finished saying it
                    // arrives — never on a clock. `changeRevealed` gates the
                    // count itself (see totalVisible), so this only animates it.
                    const arriving = groupedReveal && isChangeGroup && !isEnactedScene;

                    return (
                      <g
                        key={slotId}
                        className={`cursor-pointer transition-transform duration-300 ${arriving ? 'animate-fadeIn' : ''}`}
                        style={{ animationFillMode: 'forwards' }}
                        onClick={() => handleObjectTap(slotId)}
                      >
                        {/* Hit target — an SVG <g> paints nothing of its own and
                            the emoji <text> is pointer-events-none, so WITHOUT
                            this the object is unclickable in a real browser
                            (only jsdom, which dispatches straight to the <g>,
                            "worked"). This transparent circle IS the send-away /
                            count surface. */}
                        <circle
                          cx={pos.x} cy={pos.y} r={OBJ_SIZE / 2 + 4}
                          fill="transparent"
                          style={{ pointerEvents: 'all' }}
                        />
                        {isTapped && (
                          <circle
                            cx={pos.x} cy={pos.y} r={OBJ_SIZE / 2 + 3}
                            fill="none" stroke="rgba(234,179,8,0.5)" strokeWidth={2}
                            style={{ pointerEvents: 'none' }}
                          />
                        )}
                        <text
                          x={pos.x} y={pos.y}
                          textAnchor="middle" dominantBaseline="central"
                          fontSize={OBJ_SIZE * 0.7}
                          className="select-none pointer-events-none"
                        >
                          {emoji}
                        </text>
                        {/* The child's own counting trace — an ordinal in TAP
                            order (K.CC.4). Withdrawn at the hard tier. */}
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
                              {tappedObjects.indexOf(slotId) + 1}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Ten-frame aid — mirrors what is ACTUALLY VISIBLE (R8), so it can
                never fill to the total while the change group is still waiting
                on her voice. */}
            {showTenFrame && (
              <div className="flex items-center justify-center">
                <TenFrameHelper filled={totalVisible} max={maxNumber <= 5 ? 5 : 10} />
              </div>
            )}

            {/* Bring one more in. Tapping an object in the picture sends it
                away — that IS the subtraction interaction, so it needs no
                control of its own. */}
            {canAddObjects && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addSceneObject}
                  disabled={!runner.canAttempt || builtCount >= maxNumber}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-amber-400/25 to-orange-400/25 border-2 border-amber-300/40 text-amber-100 text-xl font-bold shadow-sm active:scale-95 transition hover:from-amber-400/40 hover:to-orange-400/40 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="text-2xl" aria-hidden>{emoji}</span>
                  <span aria-hidden>＋</span>
                  <span className="sr-only">Add one {currentItem.objectType}</span>
                </button>
              </div>
            )}

            {/* Equation tray. The tiles are the page a teacher pushes across the
                table; the tray closes on a finished shape or on stillness, never
                on a Check. */}
            {kind === 'build-equation' && showEquationBar && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-1 min-h-[44px] bg-slate-800/30 rounded-lg p-2 border border-white/5">
                  {equationTiles.length === 0 ? (
                    <span className="text-slate-600 text-sm">Tap the tiles to build the number sentence</span>
                  ) : (
                    equationTiles.map((tile, i) => (
                      <LuminaButton
                        key={i}
                        className="bg-purple-500/20 border border-purple-400/30 text-purple-200 text-lg font-mono h-9 w-9 p-0 hover:bg-red-500/20 hover:border-red-400/30"
                        onClick={() => removeTile(i)}
                        title="Tap to remove"
                      >
                        {tile}
                      </LuminaButton>
                    ))
                  )}
                </div>
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

            {/* The reward — the first moment a number sentence may appear. */}
            {reward && currentSolved && (
              <LuminaPanel className="p-3 text-center">
                <span className="text-emerald-300 text-lg font-black animate-bounce inline-block font-mono">
                  {reward}
                </span>
              </LuminaPanel>
            )}

            <div className="text-center text-xs uppercase tracking-[0.25em] text-cyan-300">{stageWord}</div>

            {!isPreReader && (
              <p className="text-center text-xs text-slate-500">
                {isGestureItem
                  ? 'Make the picture match the story — the tutor checks when you stop.'
                  : 'Work it out on the picture, then say your answer out loud.'}
              </p>
            )}

            {/* "I’m listening" over an item whose answer is a placement is a lie
                in the UI — the hands items hold the bracket, so the orb says
                what the turn actually is. */}
            <JudgedMicPanel run={runner} gestureLabel="Show me in the picture" />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Story Complete!"
            celebrationMessage={celebrationMessage}
            className="mt-4"
          />
        )}
      </LuminaCardContent>

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
