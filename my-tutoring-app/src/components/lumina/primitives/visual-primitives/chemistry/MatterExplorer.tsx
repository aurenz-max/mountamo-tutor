'use client';

/**
 * MatterExplorer — TWO surfaces, forked on whether askable challenges arrived:
 *
 *  - TEACHING WORKSPACE (challenges present): runs only on the shared tutor/JEV
 *    teaching workspace (workspace rollout C5; the scripted runner was retired,
 *    LA-14, user ruling 09-23: one path). The observer judges the spoken answer
 *    and the runtime owns progression. No Next, no Check, no printed answer
 *    before credit. An unbound mount shows the shared "needs the tutor" card.
 *
 *  - EXPLORATION (no challenges, or every one dropped by a build gate): the
 *    free object shelf with its property panel, tutor as a silent guide. The
 *    honest degrade, and a real reference surface. Ungraded.
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
 * Asks and build gates live in `matterExplorerScript.ts`; the assignment and
 * scene the tutor receives live in `matterExplorerWorkspace.ts`.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MatterExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import {
  CHANGE_CATALOG,
  CHANGE_OPTIONS,
  itemsFromChallenges,
  nameCarriesAnswer,
  PROPERTY_OPTIONS,
  type EverydayChange,
  type MatterBand,
  type MatterExplorerItem,
  type MatterKind,
  type MatterTier,
} from './matterExplorerScript';
import { matterAssignment, matterScene } from './matterExplorerWorkspace';

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
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
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
// Exploration fallback — no askable challenges arrived
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

/**
 * Defect 11, the PIXELS half done in strings: the lesson title is printed
 * over the bench and read by the child, so a generated "Sort the Liquids!"
 * answers a sort item before the tutor has finished asking.
 */
const safeTitleOf = (title?: string) => (title && !nameCarriesAnswer(title) ? title : 'Matter Explorer');

const MatterExplorerShelf: React.FC<MatterExplorerProps> = ({ data, className }) => {
  const { objects = [], instanceId } = data;
  const safeTitle = safeTitleOf(data.title);
  const [inspected, setInspected] = useState<MatterObject | null>(null);
  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'matter-explorer',
    instanceId: instanceId ?? 'matter-explorer',
    // Exploration-only context. `state` and `properties.shape` are deliberately
    // absent: nothing is being judged, but the tutor is still guiding a child
    // through the same classification and must not hand it over.
    primitiveData: {
      title: safeTitle,
      objects: objects.map((o) => o.name),
      selectedObject: inspected?.name ?? null,
    },
  });

  useEffect(() => {
    if (!isConnected || !inspected) return;
    sendText(
      `[OBJECT_SELECTED] The learner is looking at "${inspected.name}". `
      + 'Wonder aloud with them about what it is like to hold. Do not classify it for them.',
      { silent: true },
    );
  }, [isConnected, inspected, sendText]);

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
};

// ============================================================================
// The teaching surface
// ============================================================================

type SurfaceProps = MatterExplorerProps & { items: MatterExplorerItem[] };

const MatterExplorerSurface: React.FC<SurfaceProps> = ({ data, items, className, runtimePlanItemId, runtimeEvalMode }) => {
  const { skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;
  const resolvedInstanceId = data.instanceId ?? 'matter-explorer';
  const safeTitle = safeTitleOf(data.title);
  const workspace = useRef<TeachingWorkspace | null>(null);

  /** The reveal payload (18b): set in `onAffirmed`, rendered behind `runner.revealHeld`. */
  const [reveal, setReveal] = useState<RevealPayload | null>(null);

  const evaluation = usePrimitiveEvaluation<MatterExplorerMetrics>({
    primitiveType: 'matter-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    const solvedIn = (predicate: (item: MatterExplorerItem) => boolean) =>
      items.filter((i) => predicate(i) && summary.outcomes.find((o) => o.id === i.id)?.solved).length;
    const totalIn = (predicate: (item: MatterExplorerItem) => boolean) =>
      items.filter(predicate).length;

    const metrics: MatterExplorerMetrics = {
      type: 'matter-explorer',
      // One OBJECT is one item, so these counts mean what they say.
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
      { challengeResults: summary.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<MatterExplorerItem>({
    primitiveId: 'matter-explorer',
    assignment: matterAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    evalMode: runtimeEvalMode || (items[0]?.challengeType ?? 'sort'),
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: () => setReveal(null),
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
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  const showReveal = runner.revealHeld && reveal !== null;

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    const item = runner.currentItem;
    if (!item) return;
    workspace.current = { ...matterScene(item), demonstration: [], canDemonstrate: false, canPresent: false,
      readyForResponse: true, mark: () => {}, clearPresentation: () => {} };
    runner.publishWorkspace();
  });

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!runner.practiceSummary) return [];
    return phaseResultsFromSummary(items, runner.practiceSummary, (item) => {
      const meta = MODE_META[item.kind];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [runner.practiceSummary, items]);

  const staged = showReveal && reveal ? reveal.item : runner.currentItem;
  // Pip: the object on the bench is the question side; Pip outlines it during the
  // ask and watches it while the child answers aloud.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The object on the bench', finished: showSummary,
  });
  const modeMeta = MODE_META[staged?.kind ?? 'name_state'];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{safeTitle}</LuminaCardTitle>
          {!showSummary && staged && (
            <LuminaBadge accent={modeMeta.accent} className="text-xs">
              {modeMeta.icon} {modeMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex items-center justify-center gap-4">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {/* THE BENCH. No bins, no property panel, no slider, no text box —
                every one of them either prints the answer or lets the child
                pick it from a menu the tutor never offered. */}
            {pip.store && <div {...pip.dock} />}
            <div {...pip.target('stimulus')} className="flex justify-center">
              {staged && <ObjectStage item={staged} revealed={showReveal} />}
            </div>

            {/* Reveal-on-credit: the answer, in words, while the solved item is on screen. */}
            {showReveal && reveal && (
              <div className="flex justify-center">
                <div className="rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 animate-in fade-in duration-300">
                  <span className="text-emerald-200 text-sm font-medium">{reveal.line}</span>
                </div>
              </div>
            )}
          </>
        )}

        {showSummary && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy}
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

const MatterExplorerBound = withWorkspaceOnly<SurfaceProps>('matter-explorer', MatterExplorerSurface, (props) => safeTitleOf(props.data.title));

/**
 * Challenges run only on the teaching workspace (an unbound mount shows the "needs the tutor" card).
 * A payload with no askable challenge is the ungraded exploration shelf.
 */
const MatterExplorer: React.FC<MatterExplorerProps> = (props) => {
  const { challenges = [], objects = [], gradeBand = 'K-1', supportTier } = props.data;
  const band: MatterBand = gradeBand === '1-2' ? '1-2' : 'K-1';
  const items = useMemo(
    () => itemsFromChallenges(
      challenges.map((c) => ({ id: c.id, challengeType: c.type, objectId: c.objectId })),
      objects,
      { band, tier: supportTier },
    ),
    [challenges, objects, band, supportTier],
  );
  return items.length ? <MatterExplorerBound {...props} items={items} /> : <MatterExplorerShelf {...props} />;
};

export default MatterExplorer;
