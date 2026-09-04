'use client';

/**
 * EraExplorer — TWO surfaces, forked on whether judged challenges arrived:
 *
 *  - DI JUDGED LOOP (challenges present — the normal path now): the Live tutor
 *    owns the clock. It reads one life detail, waits, judges the spoken answer
 *    in-band, corrects contrastively, and its own affirmation is the advance.
 *    No advance timer, no Next button, no Check button, no push-to-talk mic, no
 *    printed answer before the affirm.
 *
 *  - EXPLORATION (no challenges, or every one dropped by a build gate): the era
 *    card on its own, tutor as a silent guide. The honest degrade, and a real
 *    reference surface for a lesson that only wants the era.
 *
 * ⭐ ALL FOUR EVAL MODES ARE SPOKEN. lens_id says which lens, era_sort says
 * when, era_compare says which of two past times, cause_of_change says why. The
 * click era answered every one by tapping one of three bins and pressing Check,
 * and the costume test cleared the board in one pass: a child who cannot reason
 * about continuity and change can still tap a box.
 *
 * WHAT THE JUDGED SURFACE DELETES, and why each was the answer rather than
 * chrome:
 *  - the THREE BINS as buttons — the bins ARE the three answers, printed and
 *    clickable, floored at one in three. The menu survives as the spoken ask
 *    (the mats rule); the BUTTON is what goes.
 *  - the CHECK button and the two-strikes REVEAL ladder — the tutor's verdict
 *    is the check, and its correction is the second try.
 *  - the NEXT button and the "Start the Questions" explore gate — the tutor
 *    owns the clock, so neither has anything to advance.
 *  - the HINT DISCLOSURE — a hint the child dispenses to themselves is not a
 *    scaffold the tier can withdraw; the scripted correction re-models instead.
 *  - the EXPLANATION under the choices — it names the answer, so it is a
 *    reveal, and reveals ride `runner.revealHeld` (18b).
 *
 * WHAT IT KEEPS, deliberately: the ERA CARD. This primitive is open-book by
 * design — the lens bodies are the evidence and consulting them IS the
 * historian's method, so the card is the PAGE in the teacher-at-a-table
 * picture, not apparatus. Its read-aloud (`sourceCue`) is the pre-reader's only
 * channel to that evidence and speaks a lens body, never a statement or an
 * option. `lensAccess: 'collapsible'` still folds it away between items at the
 * hard tier — the one L3 lever that survives as a render lever.
 *
 * Cue lines, judging contracts and build gates live in `eraExplorerScript.ts`
 * (hand-authored, DISTAR). Nothing in this file writes a spoken line.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardContent,
  LuminaBadge,
  LuminaButton,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  LuminaChallengeCounter,
  LuminaReadAloud,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { EraExplorerMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  correctChoiceOf,
  eraExplorerPackBase,
  itemsFromChallenges,
  sourceCue,
  type EraExplorerItem,
  type EraKind,
  type EraTier,
} from './eraExplorerScript';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/**
 * The four historian's moves this primitive evaluates — the eval-mode ladder.
 * Each is a DIFFERENT SKILL over the same era card, not a difficulty level:
 *
 *   lens_id          locate the detail in its lens        (β 2.0)
 *   era_sort         only then / only now / both          (β 3.5)
 *   era_compare      this era / the era before / both     (β 5.0)
 *   cause_of_change  why life changed                     (β 6.5)
 */
export type EraChallengeType = EraKind;

/**
 * Within-mode support tier. Second field of the two-field contract: the eval
 * mode says WHICH historian move, this says HOW MUCH help inside it. Since the
 * port, three of its six levers are SPOKEN (the model line, the guide line, the
 * plain-language half of each menu phrase) and one is still rendered
 * (`lensAccess`). Set by the generator from `config.difficulty`.
 */
export type EraSupportTier = EraTier;

/** Retained for the generator's structural axis, which still emits it.
 *  The judged loop no longer renders a hint disclosure. */
export type EraHintLevel = 'named_lens' | 'generic' | 'none';

/** One lens on the era: daily life, technology, school & work, etc. */
export interface EraLens {
  title: string;
  body: string;
  /** Single depicting emoji for the lens tab. */
  icon: string;
}

/** The period immediately before the main era — the era_compare study material. */
export interface EraPriorEra {
  name: string;
  body: string;
}

export interface EraExplorerChallenge {
  id: string;
  /** Which historian's move this challenge asks for. Drives the ask and the menu. */
  type: EraChallengeType;
  /**
   * The stimulus to judge — now READ ALOUD, which raises the stakes on every
   * leak audit: the click era printed it beside three buttons, so a statement
   * carrying its own answer cost a guess; spoken it costs the whole item.
   */
  statement: string;
  /**
   * The three choices, ALWAYS built by the generator — from session data for the
   * fixed-bin modes, from the emitted causes for cause_of_change. They are the
   * spoken MENU now, and nothing prints them before the affirmation.
   */
  options: string[];
  /** Index into `options`. Derived in code from the generator's answer text. */
  correctIndex: number;
  /** Why that answer is right — rendered behind `revealHeld`, never spoken. */
  explanation: string;
  /** Which lens to re-read. Retained on the payload; the judged loop's scripted
   *  correction re-models the rule instead of naming a lens. */
  lensHint?: string;

  // ---- Support tier (generator-side; see EraSupportTier) ----
  showStrategy?: boolean;
  hintLevel?: EraHintLevel;
  showBinCaptions?: boolean;
}

export interface EraExplorerData {
  title: string;
  description: string;
  /** The era under exploration — doubles as an answer-choice label. */
  eraName: string;
  /** Kid-readable period tag, e.g. "about 150 years ago" or "1850–1900". */
  eraPeriod: string;
  /** The period just before. Rendered only when the session sorts across eras. */
  priorEra: EraPriorEra;
  /** Exactly 3 lenses. The open-book source the student consults. */
  lenses: EraLens[];
  /** 4-6 challenges. REQUIRED for the judged loop. */
  challenges: EraExplorerChallenge[];

  /**
   * Session-level task identity: the one type when single-mode, 'mixed' when the
   * session spans several. REPRESENTATIVE METADATA ONLY — every ask is built
   * from the per-challenge `type`.
   */
  challengeType: EraChallengeType | 'mixed';
  /** Canonical grade key ('K'|'1'…) stamped by the generator for band-gating. */
  gradeLevel?: string;

  // ---- Support tier, session scope ----
  supportTier?: EraSupportTier;
  /** Retained on the payload; the explore gate died with the Start button. */
  requireAllLenses?: boolean;
  /**
   * Whether the era cards sit open beside the question or fold away between
   * items. Never 'hidden' — era analysis is open-book by design, so the hard
   * tier withdraws the source from the eye, not from the student.
   */
  lensAccess?: 'open' | 'collapsible';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<EraExplorerMetrics>) => void;
}

export interface EraExplorerProps {
  data: EraExplorerData;
  className?: string;
}

// ============================================================================
// Presentation constants
// ============================================================================

const MODE_META: Record<EraKind, { badge: string; icon: string; accent: LuminaAccent }> = {
  lens_id: { badge: 'Find the Lens', icon: '🔍', accent: 'amber' },
  era_sort: { badge: 'Then, Now, or Both', icon: '🏛️', accent: 'cyan' },
  era_compare: { badge: 'Compare Two Eras', icon: '🕰️', accent: 'purple' },
  cause_of_change: { badge: 'Why Life Changed', icon: '🔗', accent: 'emerald' },
};

interface RevealPayload {
  item: EraExplorerItem;
  line: string;
  note?: string;
}

// ============================================================================
// The era card — the SOURCE, and the one thing the port deliberately keeps
// ============================================================================

/**
 * Answer-leak walk, in PIXELS rather than strings: does anything here equal
 * what the child is about to be asked to say?
 *  - the lens TITLES are the `lens_id` menu, which the ask states aloud every
 *    round by construction (the mats rule) — printing them discloses nothing
 *    the question does not.
 *  - the lens BODIES are the evidence, and reading evidence is the skill.
 *  - the ERA NAME is an `era_sort` / `era_compare` option label, and again the
 *    ask names all three every round.
 * Nothing here names WHICH option is right, which is the only thing that would
 * make it a leak.
 */
const EraSourceCard: React.FC<{
  lenses: EraLens[];
  eraName: string;
  eraPeriod: string;
  priorEra?: EraPriorEra;
  showPriorEra: boolean;
  activeLens: number;
  /** Which lenses this session has already opened — the `pop` / `tap` fork.
   *  Not a gate on anything: the explore GATE died with the Start button. */
  visitedLenses: Set<number>;
  onSelectLens: (index: number) => void;
  onReadLens: (lens: EraLens) => void;
  isPreReader: boolean;
  speaking: boolean;
}> = ({
  lenses, eraName, eraPeriod, priorEra, showPriorEra,
  activeLens, visitedLenses, onSelectLens, onReadLens, isPreReader, speaking,
}) => (
  <div className="space-y-3">
    <div className="flex items-baseline justify-between gap-2">
      <LuminaSectionLabel accent="amber" size="sm">{eraName}</LuminaSectionLabel>
      <span className="text-[11px] text-slate-500">{eraPeriod}</span>
    </div>

    <div className="flex gap-1 overflow-x-auto pb-1">
      {lenses.map((lens, i) => (
        <LuminaButton
          key={lens.title}
          tone={activeLens === i ? 'ghost' : 'subtle'}
          className={`shrink-0 text-xs px-3 py-2 h-auto ${
            activeLens === i ? 'text-slate-100' : 'text-slate-400'
          }`}
          onClick={() => {
            // A lens opening for the FIRST time reveals a card the learner has
            // not seen (`pop`); a revisit is a tab switch (`tap`). The bin
            // sounds went out WITH the bins — `select()` has nothing left to
            // confirm now that no answer is tapped.
            if (visitedLenses.has(i)) SoundManager.tap();
            else SoundManager.pop();
            onSelectLens(i);
          }}
        >
          <span className="mr-1">{lens.icon}</span>
          {lens.title}
        </LuminaButton>
      ))}
    </div>

    {lenses[activeLens] && (
      <LuminaPanel accent="amber" className="py-3">
        <p className="text-slate-200 text-sm leading-relaxed">{lenses[activeLens].body}</p>
        <div className="mt-3">
          {/* The pre-reader's channel to the evidence. Question-side by
              construction: it speaks a lens BODY, never a statement, never an
              option, never a verdict. */}
          <LuminaReadAloud
            size={isPreReader ? 'lg' : 'sm'}
            speaking={speaking}
            label="Read this to me"
            onClick={() => onReadLens(lenses[activeLens])}
          />
        </div>
      </LuminaPanel>
    )}

    {showPriorEra && priorEra && (
      <div className="space-y-2">
        <LuminaSectionLabel accent="purple" size="sm">Before that: {priorEra.name}</LuminaSectionLabel>
        <LuminaPanel accent="purple" className="py-3">
          <p className="text-slate-300 text-sm leading-relaxed">{priorEra.body}</p>
        </LuminaPanel>
      </div>
    )}
  </div>
);

// ============================================================================
// Component
// ============================================================================

const EraExplorer: React.FC<EraExplorerProps> = ({ data, className }) => {
  const {
    title,
    eraName,
    eraPeriod,
    priorEra,
    lenses = [],
    challenges = [],
    gradeLevel,
    supportTier,
    lensAccess = 'open',
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const resolvedInstanceId = instanceId ?? 'era-explorer';

  /** K-1 cannot read the lens bodies or the statement — the tutor's voice is
   *  their only channel, so the source read-aloud is sized to the tap tier. */
  const isPreReader = gradeLevel === 'K' || gradeLevel === '1';

  const session = useMemo(() => ({
    eraName,
    priorEraName: priorEra?.name ?? '',
    lensTitles: lenses.map((l) => l.title),
    lensBodies: lenses.map((l) => l.body),
  }), [eraName, priorEra?.name, lenses]);

  const items = useMemo(
    () => itemsFromChallenges(
      challenges.map((c) => ({
        id: c.id,
        type: c.type,
        statement: c.statement,
        options: c.options,
        correctIndex: c.correctIndex,
        explanation: c.explanation,
      })),
      session,
      { tier: supportTier },
    ),
    [challenges, session, supportTier],
  );

  const judged = items.length > 0;
  const needsPriorEra = useMemo(
    () => (judged
      ? items.some((i) => i.kind === 'era_compare')
      : challenges.some((c) => c.type === 'era_compare')),
    [judged, items, challenges],
  );

  // ── Source state (the page, not the answer) ───────────────────────────────
  const [activeLens, setActiveLens] = useState(0);
  const [visitedLenses, setVisitedLenses] = useState<Set<number>>(() => new Set([0]));
  const openLens = useCallback((index: number) => {
    setActiveLens(index);
    setVisitedLenses((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  }, []);
  /**
   * Hard tier only: the student has re-opened the era cards for THIS item.
   * Re-folded on every advance — otherwise one tap would downgrade the rest of
   * the session to the open-source tier.
   */
  const [sourceRevealed, setSourceRevealed] = useState(false);
  const sourceVisible = lensAccess === 'open' || sourceRevealed;

  /** The reveal payload (18b): set in `onAffirmed`, rendered behind
   *  `runner.revealHeld`, deliberately NOT cleared in `onItemOpened` — the
   *  runner fires both in ONE dispatch on the advance path, so clearing there
   *  paints the reveal on the last item and nowhere else. */
  const [reveal, setReveal] = useState<RevealPayload | null>(null);

  const evaluation = usePrimitiveEvaluation<EraExplorerMetrics>({
    primitiveType: 'era-explorer',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const sessionChallengeType: EraExplorerMetrics['challengeType'] = useMemo(() => {
    const kinds = Array.from(new Set(items.map((i) => i.kind)));
    return kinds.length === 1 ? kinds[0] : 'mixed';
  }, [items]);

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const metrics: EraExplorerMetrics = {
      type: 'era-explorer',
      challengeType: items.length > 0 ? sessionChallengeType : (data.challengeType ?? 'mixed'),
      totalChallenges: items.length,
      correctCount: summary.solvedCount,
      attemptsCount: summary.attemptsCount,
      firstTryCount: summary.firstTryCount,
      // The source read-aloud is BASELINE ACCESS to an open-book primitive, not
      // a hint (it was never counted as one in the click era either), and the
      // judged loop has no hint disclosure left to count. Reported honestly
      // rather than repurposed to keep a field non-zero.
      hintsViewed: 0,
      overallAccuracy: summary.accuracy,
      averageAttemptsPerChallenge: items.length
        ? Math.round((summary.attemptsCount / items.length) * 10) / 10
        : 0,
    };

    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { eraName, challengeResults: summary.outcomes, hearTaps: summary.hearTaps },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, sessionChallengeType, data.challengeType, eraName, evaluation]);

  // ── The pack — wording lives in eraExplorerScript.ts ───────────────────────
  // The cue surface is SPREAD, not re-declared, so the DI drive harness reads
  // the same bytes this component sends.
  const pack = useMemo<JudgedScriptPack<EraExplorerItem>>(() => ({
    ...eraExplorerPackBase(items),
    statusLines: {
      ready: () => 'Listen, then say your answer.',
      retry: () => 'Listen again — then say your answer.',
      done: 'Great history today!',
    },
    diagnosisObservation: (item, { lastHeard }) => {
      const heard = (lastHeard ?? '').trim();
      return {
        challenge: `${MODE_META[item.kind].badge}: ${item.statement}`,
        expected: correctChoiceOf(item).phrase,
        observed: heard ? `Said "${heard}".` : 'Said something that did not match.',
      };
    },
  }), [items]);

  const runner = useJudgedScriptRunner<EraExplorerItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel: gradeLevel || 'Elementary',
    exhibitId,
    onFinished: handleFinished,
    onItemOpened: () => {
      // The page lever, re-applied per item: at the hard tier the source folds
      // away again, so one tap cannot downgrade the rest of the session.
      setSourceRevealed(false);
    },
    onAffirmed: (item) => {
      const c = correctChoiceOf(item);
      setReveal({ item, line: c.label, note: item.explanation });
    },
  });

  const showReveal = runner.revealHeld && reveal !== null;

  // Correct/incorrect used to fire on a Check press; the tutor's verdict is the
  // check now, so the reward rides the REVEAL — which opens on her affirmation
  // and closes when her next cue is sent. There is no `playIncorrect`
  // counterpart: a wrong answer is answered by her correction, and a sound
  // under it would talk over the teaching.
  useEffect(() => {
    if (showReveal) SoundManager.playCorrect();
  }, [showReveal, reveal?.item.id]);

  // ── The source read-aloud: the one cue the runner does not own ─────────────
  // Sent exactly the way the runner sends its own tap-to-hear, so it lands as a
  // cue and not as a turn the model owes a verdict on.
  const ctx = useLuminaAIContext();
  const readLens = useCallback((lens: EraLens) => {
    // `sourceCue` returns null for a body that cannot be safely spoken (it
    // opens with a verdict sentinel, or carries a quote that would close the
    // cue's own span). Nothing is sent rather than something that desyncs the
    // loop; the card is still on screen for a reader.
    const cue = lens?.body ? sourceCue(lens.title, lens.body) : null;
    if (!cue) return;
    ctx.sendText(cue, { silent: true, scripted: true });
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Exploration fallback: the tutor as a silent guide ──────────────────────
  const { sendText, isConnected } = useLuminaAI({
    primitiveType: 'era-explorer',
    instanceId: resolvedInstanceId,
    /**
     * Exploration-only context, pushed under the SAME TWO KEYS the judged pack
     * uses — `challengeType` and `stimulus` — with the sentinel value
     * `free_explore` for the round type (states-of-matter's convention).
     *
     * Two reasons, and neither is cosmetic. The catalog interpolates exactly
     * those two keys, so a fallback bag of its own left both of them arriving
     * EMPTY on this surface while pushing five keys nothing reads. And the
     * static tutor-test analyzer parses the first `primitiveData` literal it
     * finds, so a divergent fallback bag makes a judged port read as
     * context-key-unresolvable when the judged path is in fact fine.
     *
     * No statement, no option, no answer: nothing is judged here, but the tutor
     * is still walking a child through the same era and must not do the
     * reasoning for them.
     */
    primitiveData: {
      challengeType: 'free_explore',
      stimulus: `the era cards for ${eraName}, open for the learner to browse; `
        + 'this state line is for you alone and is never spoken to the learner',
    },
    // The judged path owns the tutor through the runner; this hook is only the
    // exploration surface's guide, and must never open a second channel to it.
    enabled: !judged,
    gradeLevel: gradeLevel || 'Elementary',
  });

  const [introduced, setIntroduced] = useState(false);
  useEffect(() => {
    if (judged || !isConnected || introduced) return;
    setIntroduced(true);
    sendText(
      `[ERA_EXPLORE] The learner is looking at the era cards for "${eraName}" (${eraPeriod}). `
      + 'Introduce the era warmly in one or two sentences and invite them to open each lens. '
      + 'Do not quiz them.',
      { silent: true },
    );
  }, [judged, isConnected, introduced, eraName, eraPeriod, sendText]);

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
   * verdict for the last. The reveal therefore renders its OWN item.
   */
  const staged = showReveal && reveal ? reveal.item : runner.currentItem;
  const modeMeta = MODE_META[staged?.kind ?? 'era_sort'];

  const sourceCardEl = lenses.length > 0 ? (
    <EraSourceCard
      lenses={lenses}
      eraName={eraName}
      eraPeriod={eraPeriod}
      priorEra={priorEra}
      showPriorEra={needsPriorEra}
      activeLens={Math.min(activeLens, Math.max(lenses.length - 1, 0))}
      visitedLenses={visitedLenses}
      onSelectLens={openLens}
      onReadLens={readLens}
      isPreReader={isPreReader}
      speaking={runner.tutorSpeaking}
    />
  ) : null;

  if (!judged) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader className="pb-3">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
        </LuminaCardHeader>
        <LuminaCardContent className="space-y-4">
          {sourceCardEl ?? (
            <p className="text-slate-400 text-center">No era cards available.</p>
          )}
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
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
              {/* Tap-to-hear the question again — never the answer, never a hint. */}
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

            {/* THE STATEMENT. The question side, printed for a reader and read
                aloud for everyone — no bins under it, no captions, no hint, no
                explanation until the tutor has affirmed. */}
            {staged && (
              <LuminaPrompt accent="amber" center>
                {staged.statement}
              </LuminaPrompt>
            )}

            {/* Reveal-on-affirm: the answer, in words, for exactly as long as
                the tutor's affirmation is being spoken (runner.revealHeld). */}
            {showReveal && reveal && (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-2xl border-2 border-emerald-400/30 bg-emerald-500/10 px-5 py-2.5 animate-in fade-in duration-300">
                  <span className="text-emerald-200 text-sm font-medium">{reveal.line}</span>
                </div>
                {reveal.note && (
                  <p className="text-slate-400 text-xs text-center max-w-md px-2">{reveal.note}</p>
                )}
              </div>
            )}

            {/* THE SOURCE. Open by default; folded between items at the hard
                tier, where deciding what to consult is part of the task. */}
            {sourceVisible ? (
              sourceCardEl
            ) : (
              <div className="flex justify-center">
                <LuminaButton
                  tone="subtle"
                  className="text-xs h-8"
                  onClick={() => { SoundManager.toggle(true); setSourceRevealed(true); }}
                >
                  📜 Open the era cards
                </LuminaButton>
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
            heading="Good History!"
            celebrationMessage={`You judged ${items.length} things about the past — out loud!`}
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default EraExplorer;
