'use client';

/**
 * MatterExplorer — TWO surfaces, forked on whether judged challenges arrived:
 *
 *  - DI JUDGED LOOP (challenges present — the normal path now): the Live tutor
 *    owns the clock. It asks ONCE, waits, judges the spoken answer in-band,
 *    corrects contrastively, and its own affirmation is the advance. No advance
 *    timer, no Next button, no Check button, no push-to-talk mic, no printed
 *    answer before the affirm.
 *
 *  - EXPLORATION (no challenges, or every one dropped by a build gate): the
 *    free object shelf with its property panel, tutor as a silent guide. The
 *    honest degrade, and a real reference surface.
 *
 * ⭐ ALL FOUR EVAL MODES ARE SPOKEN. sort says the state, property says what
 * the thing does in a cup, change says whether an everyday change to the
 * object can be undone, mystery says the state of a withheld object. The
 * click era answered every one with a drag, a Check press or a text box, and
 * the costume test cleared the board in one pass: a child who cannot classify
 * matter can still drag a card into one of three bins.
 *
 * ── WHAT THE CLICK ERA WAS ACTUALLY MEASURING ───────────────────────────────
 * Four measurement fictions, all removed here and all confirmed by reading the
 * pre-port file rather than inferred:
 *   1. `handleCheckPredictChallenge` wrote `correct: true` UNCONDITIONALLY.
 *   2. `handleCheckCompareChallenge` did the same, gated only on two text
 *      boxes being non-empty.
 *   3. `describe` completed when properties had been VIEWED — clicking earned
 *      the credit.
 *   4. `sort` graded all 6-10 objects as ONE all-or-nothing boolean, so a
 *      child who knew seven of eight scored what a child who knew none did.
 * Here one OBJECT is one judged item and every key is code-computed.
 *
 * WHAT THE JUDGED SURFACE HIDES, and why each one is the answer rather than
 * chrome:
 *  - the THREE BINS as a drop target — the bins ARE the three answers, printed
 *    and clickable. A menu with a drag on it, floored at one in three.
 *  - the PROPERTY PANEL — `properties.shape` is a 1:1 map onto the answer
 *    (keeps_shape → solid), so the panel is the answer key for two of three
 *    modes and the whole question for the third.
 *  - the TEMPERATURE SLIDER — it changes the state on screen, which is the
 *    thing being asked about.
 *  - the MYSTERY TEXT BOX — a K-2 child cannot spell "liquid", and the click
 *    era substring-matched what they typed against an LLM's free-text guess.
 * All of them return in the REVEAL, behind `runner.revealHeld` (18b).
 *
 * Cue lines, judging contracts and build gates live in `matterExplorerScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatterExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  CHANGE_CATALOG,
  CHANGE_OPTIONS,
  itemsFromChallenges,
  matterExplorerPackBase,
  nameCarriesAnswer,
  PROPERTY_OPTIONS,
  type EverydayChange,
  type MatterBand,
  type MatterExplorerItem,
  type MatterKind,
  type MatterTier,
} from './matterExplorerScript';

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
  /** The one everyday change this object undergoes, from the closed
   *  `CHANGE_CATALOG` menu. Read ONLY by the `change` mode; whether it can be
   *  undone is code-owned, never carried in the payload. */
  everydayChange?: EverydayChange;
}

export interface MatterChallenge {
  id: string;
  /** The judged identity. `describe`/`predict`/`compare` are legacy generator
   *  types that carried no judgeable answer; `normalizeChallengeType` folds
   *  them onto `property`, the mode that asks what they gestured at. */
  type: 'sort' | 'property' | 'change' | 'mystery' | 'describe' | 'predict' | 'compare';
  instruction: string;
  /** Which object this item is about. When absent the challenge is a whole
   *  SCREENFUL and `itemsFromChallenges` expands it to one item per object —
   *  the port's biggest measurement change (defect class 1). */
  objectId?: string;
  targetAnswer?: string | string[];
  hint?: string;
  narration?: string;
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
  supportTier?: MatterTier;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MatterExplorerMetrics>) => void;
}

export interface MatterExplorerProps {
  data: MatterExplorerData;
  className?: string;
}

// ============================================================================
// Presentation constants
// ============================================================================

const STATE_CONFIG = {
  solid: { label: 'Solid', emoji: '🧊', textClass: 'text-slate-300' },
  liquid: { label: 'Liquid', emoji: '💧', textClass: 'text-blue-300' },
  gas: { label: 'Gas', emoji: '💨', textClass: 'text-cyan-300' },
} as const;

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
  return '🔬';
}

const MODE_META: Record<MatterKind, { badge: string; icon: string; accent: LuminaAccent }> = {
  name_state: { badge: 'Name the State', icon: '🔍', accent: 'cyan' },
  name_property: { badge: 'In the Cup', icon: '🥤', accent: 'purple' },
  name_undo: { badge: 'Can It Go Back?', icon: '🔄', accent: 'emerald' },
  mystery_state: { badge: 'Mystery Material', icon: '❓', accent: 'amber' },
};

interface RevealPayload {
  item: MatterExplorerItem;
  line: string;
}

// ============================================================================
// The bench — what the child looks at while they think
// ============================================================================

/**
 * The stimulus card. It shows the OBJECT and nothing that classifies it: no
 * state label, no property list, no bin. On `mystery_state` even the object is
 * withheld — the covered box IS the mode.
 *
 * Defect 11 in PIXELS: walk this asking "does anything on screen equal what I
 * am about to ask them to say?" The answer here is no by construction, which
 * is why the property chips render only behind `revealed`.
 */
const ObjectStage: React.FC<{
  item: MatterExplorerItem;
  revealed: boolean;
}> = ({ item, revealed }) => {
  const hidden = item.kind === 'mystery_state' && !revealed;
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-white/10 bg-slate-900/40 px-8 py-6 backdrop-blur-xl">
      <div className="text-7xl leading-none" aria-hidden>
        {hidden ? '📦' : getObjectEmoji(item.objectName)}
      </div>
      <div className="text-slate-200 text-lg font-medium">
        {hidden ? 'a secret thing' : item.objectName}
      </div>

      {/* The change mode's premise. It is what HAPPENED, never whether it
          undoes — the same standing the mystery clues have. */}
      {item.kind === 'name_undo' && item.change && (
        <p className="text-slate-400 text-sm text-center max-w-[22rem]">
          {CHANGE_CATALOG[item.change].storyFor(item.objectName)}.
        </p>
      )}

      {item.kind === 'mystery_state' && !revealed && item.clues && (
        <ul className="text-slate-400 text-sm space-y-0.5 text-center">
          {item.clues.map((c) => (
            <li key={c}>• {c}</li>
          ))}
        </ul>
      )}

      {/* The property panel is the ANSWER KEY for two of the three modes, so it
          exists only after the affirmation. */}
      {revealed && (
        <div className="flex flex-wrap justify-center gap-1.5">
          <LuminaBadge accent="emerald" className="text-xs">
            {STATE_CONFIG[item.answerState].emoji} {STATE_CONFIG[item.answerState].label}
          </LuminaBadge>
          <LuminaBadge accent="purple" className="text-xs">
            {PROPERTY_OPTIONS[item.answerShape].phrase}
          </LuminaBadge>
          {item.kind === 'name_undo' && item.answerUndo && (
            <LuminaBadge accent="cyan" className="text-xs">
              {CHANGE_OPTIONS[item.answerUndo].phrase}
            </LuminaBadge>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Exploration fallback — no judged challenges arrived
// ============================================================================

const ExplorationShelf: React.FC<{ objects: MatterObject[]; onInspect: (o: MatterObject) => void }> = ({
  objects,
  onInspect,
}) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
    {objects.map((o) => (
      <button
        key={o.id}
        type="button"
        onClick={() => onInspect(o)}
        className="flex flex-col items-center gap-1 rounded-2xl border-2 border-white/10 bg-slate-900/40 px-3 py-4 hover:border-cyan-400/40 hover:scale-105 transition-all"
      >
        <span className="text-4xl leading-none" aria-hidden>{getObjectEmoji(o.name)}</span>
        <span className="text-slate-300 text-xs text-center">{o.name}</span>
      </button>
    ))}
  </div>
);

// ============================================================================
// Component
// ============================================================================

const MatterExplorer: React.FC<MatterExplorerProps> = ({ data, className }) => {
  const {
    title,
    objects = [],
    challenges = [],
    gradeBand = 'K-1',
    supportTier,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId ?? 'matter-explorer';

  /**
   * Defect 11, the PIXELS half done in strings: the lesson title is printed
   * over the bench and read by the child, so a generated "Sort the Liquids!"
   * answers a sort item before the tutor has finished asking.
   */
  const safeTitle = useMemo(
    () => (title && !nameCarriesAnswer(title) ? title : 'Matter Explorer'),
    [title],
  );

  const band: MatterBand = gradeBand === '1-2' ? '1-2' : 'K-1';

  const items = useMemo(
    () => itemsFromChallenges(
      challenges.map((c) => ({ id: c.id, challengeType: c.type, objectId: c.objectId })),
      objects,
      { band, tier: supportTier },
    ),
    [challenges, objects, band, supportTier],
  );

  /** The reveal payload (18b): set in `onAffirmed`, rendered behind
   *  `runner.revealHeld`, deliberately NOT cleared in `onItemOpened` — the
   *  runner fires both in ONE dispatch on the advance path, so clearing there
   *  paints the reveal on the last item and nowhere else. */
  const [reveal, setReveal] = useState<RevealPayload | null>(null);
  const [inspected, setInspected] = useState<MatterObject | null>(null);

  const evaluation = usePrimitiveEvaluation<MatterExplorerMetrics>({
    primitiveType: 'matter-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const solvedIn = (predicate: (item: MatterExplorerItem) => boolean) =>
      items.filter((i) => predicate(i) && summary.outcomes.find((o) => o.id === i.id)?.solved).length;
    const totalIn = (predicate: (item: MatterExplorerItem) => boolean) =>
      items.filter(predicate).length;

    const metrics: MatterExplorerMetrics = {
      type: 'matter-explorer',
      // One OBJECT is one item now, so these counts finally mean what they say:
      // the click era wrote sortingCorrect = objects.length or 0.
      sortingCorrect: solvedIn((i) => i.challengeType === 'sort'),
      sortingTotal: totalIn((i) => i.challengeType === 'sort'),
      propertiesIdentified: solvedIn((i) => i.challengeType === 'property'),
      propertiesTotal: totalIn((i) => i.challengeType === 'property'),
      changesJudged: solvedIn((i) => i.challengeType === 'change'),
      changesTotal: totalIn((i) => i.challengeType === 'change'),
      // The slider and the particle view are not on the judged surface at all,
      // so these report honestly rather than being set true by a render.
      stateChangePredicted: false,
      mysteryMaterialsSolved: solvedIn((i) => i.challengeType === 'mystery'),
      mysteryTotal: totalIn((i) => i.challengeType === 'mystery'),
      trickyMaterialsExplored: new Set(items.map((i) => i.objectId)).size,
      temperatureSliderUsed: false,
      particleViewEngaged: false,
      attemptsCount: summary.attemptsCount,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  // ── The pack — wording lives in matterExplorerScript.ts ────────────────────
  // The cue surface is SPREAD, not re-declared, so the DI drive harness reads
  // the same bytes this component sends.
  const pack = useMemo<JudgedScriptPack<MatterExplorerItem>>(() => ({
    ...matterExplorerPackBase(items),
    statusLines: {
      ready: () => 'Listen, then say your answer.',
      retry: () => 'Listen again — then say your answer.',
      done: 'Great science today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = (lastHeard ?? '').trim();
      const observed = heard ? `Said "${heard}".` : 'Said something that did not match.';
      switch (item.kind) {
        case 'name_state':
          return {
            challenge: `Name the state of ${item.objectName}.`,
            expected: `"${item.answerState}".`,
            observed,
          };
        case 'name_property':
          return {
            challenge: `Say what ${item.objectName} does in a cup.`,
            expected: `"${PROPERTY_OPTIONS[item.answerShape].phrase}".`,
            observed,
          };
        case 'name_undo':
          return {
            challenge: `Say whether the change to ${item.objectName} can be undone.`,
            expected: `"${item.answerUndo ? CHANGE_OPTIONS[item.answerUndo].phrase : ''}".`,
            observed,
          };
        case 'mystery_state':
          return {
            challenge: `Name the state of a withheld object from ${item.clues?.length ?? 0} clues.`,
            expected: `"${item.answerState}".`,
            observed,
          };
      }
    },
  }), [items]);

  const runner = useJudgedScriptRunner<MatterExplorerItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: band === 'K-1' ? 'Kindergarten' : 'Grade 1-2',
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: (item) => {
      const line = item.kind === 'name_property'
        ? `${item.objectName} — ${PROPERTY_OPTIONS[item.answerShape].phrase}`
        : item.kind === 'name_undo' && item.answerUndo
          ? `${item.objectName} — ${CHANGE_OPTIONS[item.answerUndo].phrase}`
          : item.kind === 'mystery_state'
            ? `It was the ${item.objectName} — a ${item.answerState}`
            : `${item.objectName} is a ${item.answerState}`;
      setReveal({ item, line });
    },
  });

  const showReveal = runner.revealHeld && reveal !== null;

  useEffect(() => {
    if (showReveal) SoundManager.playCorrect();
  }, [showReveal, reveal?.item.id]);

  // ── Exploration fallback: the tutor as a silent guide ──────────────────────
  const judged = items.length > 0;
  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'matter-explorer',
    instanceId: resolvedInstanceId,
    // Exploration-only context. `state` and `properties.shape` are deliberately
    // absent: on this surface nothing is being judged, but the tutor is still
    // guiding a child through the same classification and must not hand it over.
    primitiveData: {
      title: safeTitle,
      objects: objects.map((o) => o.name),
      selectedObject: inspected?.name ?? null,
    },
    // The judged path owns the tutor through the runner; this hook is only the
    // exploration surface's guide, and must never open a second channel to it.
    enabled: !judged,
  });

  useEffect(() => {
    if (judged || !isConnected || !inspected) return;
    sendText(
      `[OBJECT_SELECTED] The learner is looking at "${inspected.name}". `
      + 'Wonder aloud with them about what it is like to hold. Do not classify it for them.',
      { silent: true },
    );
  }, [judged, isConnected, inspected, sendText]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  /**
   * WHICH item is on the bench right now. On the advance path the runner opens
   * the next item in the SAME dispatch as the affirmation, so by render time
   * `currentItem` is already the NEXT one while the tutor is still saying the
   * verdict for the last. The reveal therefore renders its OWN item — anything
   * else puts the previous item's answer over the next item's object.
   */
  const staged = showReveal && reveal ? reveal.item : runner.currentItem;
  const modeMeta = MODE_META[staged?.kind ?? 'name_state'];

  if (!judged) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader className="pb-3">
          <LuminaCardTitle className="text-lg">{safeTitle}</LuminaCardTitle>
        </LuminaCardHeader>
        <LuminaCardContent className="space-y-4">
          {objects.length === 0 ? (
            <p className="text-slate-400 text-center">No objects available.</p>
          ) : (
            <>
              <p className="text-slate-400 text-sm text-center">
                Tap anything to look at it closely.
              </p>
              <ExplorationShelf objects={objects} onInspect={setInspected} />
              {inspected && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-white/10 bg-slate-900/40 px-5 py-4">
                  <span className="text-5xl leading-none" aria-hidden>{getObjectEmoji(inspected.name)}</span>
                  <span className="text-slate-200 font-medium">{inspected.name}</span>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <LuminaBadge accent="cyan" className="text-xs">{inspected.properties.color}</LuminaBadge>
                    <LuminaBadge accent="cyan" className="text-xs">{inspected.properties.texture}</LuminaBadge>
                    <LuminaBadge accent="cyan" className="text-xs">{inspected.properties.weight}</LuminaBadge>
                  </div>
                </div>
              )}
            </>
          )}
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{safeTitle}</LuminaCardTitle>
          {!evaluation.hasSubmitted && staged && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
              {/* Tap-to-hear the question again — never the answer. */}
              <button
                type="button"
                onClick={runner.hearStimulus}
                aria-label="Hear the question again"
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full
                  bg-amber-500/15 border-2 border-amber-500/30 text-amber-300
                  hover:bg-amber-500/25 hover:scale-105 active:scale-95 transition-all
                  ${runner.stimulusTapped ? 'ring-2 ring-cyan-300/60' : ''}
                `}
              >
                <Volume2 size={18} />
              </button>
            </div>

            {/* THE BENCH. No bins, no property panel, no slider, no text box —
                every one of them either prints the answer or lets the child
                pick it from a menu the tutor never offered. */}
            <div className="flex justify-center">
              {staged && <ObjectStage item={staged} revealed={showReveal} />}
            </div>

            {/* Reveal-on-affirm: the answer, in words, for exactly as long as
                the tutor's affirmation is being spoken (runner.revealHeld). */}
            {showReveal && reveal && (
              <div className="flex justify-center">
                <div className="rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 animate-in fade-in duration-300">
                  <span className="text-emerald-200 text-sm font-medium">{reveal.line}</span>
                </div>
              </div>
            )}

            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Great Science!"
            celebrationMessage={`You worked out what ${items.length} things are made of — out loud!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default MatterExplorer;
