'use client';

/**
 * SyllableClapper — DI modality. The Live tutor owns the clock: it says the word
 * with purposeful enunciation, waits, judges the child's spoken count from the
 * audio in-band, corrects contrastively, and its OWN affirmation is the advance.
 * There is no advance timer, no Clap button, no Check button, no Next button and
 * no push-to-talk mic anywhere in this file.
 *
 * ⭐ THE CLAP MOVED OFF THE SCREEN AND INTO THE ROOM. The click era's `👏 Clap!`
 * button failed the costume test outright — a child who cannot hear a single
 * syllable boundary can press it three times — and the six counter circles it
 * filled did the COUNTING, which is the one act this primitive exists to train.
 * The ask now invites the hands ("Clap the parts with your hands, then tell me
 * how many parts"), and those hands are the child's own, invisible to us exactly
 * as they are to a teacher at a table whose real signal is the spoken count.
 *
 * ANSWER-LEAK RULE, and it is the whole reason this stage is nearly empty:
 * NOTHING ON SCREEN MAY EQUAL WHAT THE CHILD IS ABOUT TO SAY. The word is never
 * printed before the affirmation (a reader chunks it orthographically instead of
 * hearing it), and the split syllable bar — three boxes for a three-part word —
 * is literally the answer drawn as furniture. Both live behind `revealHeld`,
 * which opens on her affirmation and closes when her cue for the next item is
 * SENT. Pre-affirm the child has her voice and tap-to-hear, which is what they
 * would have at the table.
 *
 * SUPPORT TIERS SURVIVE AS ASK LEVERS (L3 contract, re-based): the on-screen
 * tally and the directional miss hint are gone with the button they measured, so
 * the tier now shapes the ENUNCIATION — easy hears the word twice (natural, then
 * slower and still joined), medium once, and hard loses the clap invitation so
 * the segmenting happens in the ear alone. `syllableClapperScript` honors both
 * flags; the spoken word and tap-to-hear are never withdrawn at any tier.
 *
 * Items that cannot be asked or judged honestly — parts that do not spell their
 * word, a count outside 1..5, or a word whose syllable count is not one number
 * in English ("squirrel", "every", "fire") — are DROPPED at build time by
 * `itemsFromChallenges`. Ship nothing over a broken ask.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { SyllableClapperMetrics } from '../../../evaluation/types';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import {
  hearPartCue,
  itemsFromChallenges,
  syllableClapperPackBase,
  type SyllableBand,
  type SyllableClapperItem,
} from './syllableClapperScript';
import { SoundManager } from '../../../utils/SoundManager';
import PhaseSummaryPanel, { type PhaseResult } from '../../../components/PhaseSummaryPanel';
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import { phaseResultsFromSummary } from '../../../hooks/usePhaseResults';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

interface SyllableChallenge {
  id: string;
  word: string;
  syllableCount: number;       // 1-5; the LENGTH of `syllables` is authoritative
  syllables: string[];         // ["but", "ter", "fly"]
  imageDescription: string;
  difficulty: number;          // 3-5
  /** WORD-LENGTH band (the eval mode). NOT the support tier — see `supportTier`. */
  challengeType: 'easy' | 'medium' | 'hard';

  // ── Within-mode SUPPORT-TIER scaffolds (stamped by the generator from
  //    ctx.supportTier). ASK levers now, not render levers: the click era's
  //    on-screen tally and directional miss hint went with the Check button
  //    they measured. All optional; absent ⇒ the fully supported ask, so every
  //    legacy payload still plays. ──
  /** The ask says the word a second time, slower and still joined. easy only. */
  echoWordSlowly?: boolean;
  /** The ask invites the hands. Withdrawn at the hard tier (motor scaffold). */
  inviteClap?: boolean;
}

export interface SyllableClapperData {
  title: string;
  /**
   * Within-mode SUPPORT tier from the manifest (config.difficulty). Orthogonal
   * to `challengeType`, which happens to use the same three words for the WORD
   * LENGTH band. The generator stamps the per-challenge flags from it; nothing
   * in this component reads it, which is what makes the two axes structurally
   * unable to contaminate each other.
   */
  supportTier?: 'easy' | 'medium' | 'hard';
  challenges: SyllableChallenge[];
  gradeLevel?: string;

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<SyllableClapperMetrics>) => void;
}

interface SyllableClapperProps {
  data: SyllableClapperData;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SYLLABLE_COLORS = [
  'bg-blue-500/30 border-blue-400/50 text-blue-200',
  'bg-purple-500/30 border-purple-400/50 text-purple-200',
  'bg-emerald-500/30 border-emerald-400/50 text-emerald-200',
  'bg-amber-500/30 border-amber-400/50 text-amber-200',
  'bg-rose-500/30 border-rose-400/50 text-rose-200',
];

const BAND_META: Record<SyllableBand, { badge: string; icon: string; accent: LuminaAccent }> = {
  easy: { badge: 'Short Words', icon: '👏', accent: 'blue' },
  medium: { badge: 'Longer Words', icon: '👏', accent: 'purple' },
  hard: { badge: 'Long Words', icon: '👏', accent: 'emerald' },
};

// ============================================================================
// Component
// ============================================================================

const SyllableClapper: React.FC<SyllableClapperProps> = ({ data, className }) => {
  const {
    title,
    challenges = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const gradeLevel = data.gradeLevel ?? 'kindergarten';

  const stableInstanceIdRef = useRef(instanceId || `syllable-clapper-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  const ctx = useLuminaAIContext();

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  const items = useMemo<SyllableClapperItem[]>(() => {
    const built = itemsFromChallenges(challenges);
    if (built.length < challenges.length) {
      console.warn(
        `[SyllableClapper] dropped ${challenges.length - built.length} unaskable challenge(s) `
        + '(split/join, count range, sayability or dialect-variable gates)',
      );
    }
    return built;
  }, [challenges]);

  // ── The reveal payload (18b) ──────────────────────────────────────────────
  // Set on the affirmation, rendered behind `runner.revealHeld`, and DELIBERATELY
  // NOT cleared when the next item opens: the runner fires `onAffirmed` and
  // `onItemOpened` in ONE dispatch, so a payload cleared there paints on the last
  // item and nowhere else — the family-wide bug 18b closed. The hold is the gate;
  // the next affirmation overwrites the payload.
  const [revealed, setRevealed] = useState<SyllableClapperItem | null>(null);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<SyllableClapperMetrics>({
    primitiveType: 'syllable-clapper',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const syllableCountsEncountered: Record<number, number> = {};
    for (const item of items) {
      syllableCountsEncountered[item.partCount] =
        (syllableCountsEncountered[item.partCount] ?? 0) + 1;
    }
    const metrics: SyllableClapperMetrics = {
      type: 'syllable-clapper',
      wordsCorrect: summary.solvedCount,
      wordsTotal: items.length,
      clapCountAccuracy: summary.accuracy,
      syllableCountsEncountered,
      attemptsCount: summary.attemptsCount,
    };
    evaluation.submitResult(
      summary.passed,
      summary.accuracy,
      metrics,
      { challengeResults: summary.outcomes },
      undefined,
      summary.diagnosisEvidence,
    );
  }, [items, evaluation]);

  // ── The pack — the tutor's whole side is `syllableClapperPackBase`, spread ─
  //    from the script module so the DI drive-plan endpoint replays the SAME
  //    cues this component sends. Only what the SCREEN owns stays here.
  const pack = useMemo<JudgedScriptPack<SyllableClapperItem>>(() => ({
    ...syllableClapperPackBase(items),
    statusLines: {
      ready: () => 'Listen, then say how many parts.',
      retry: () => 'Have another go — say how many parts.',
      affirmedNext: 'Yes! You heard the parts.',
      done: 'Great listening today!',
    },
    diagnosisObservation: (item, { lastHeard }) => ({
      challenge: `Count the parts in "${item.word}".`,
      expected: `${item.answer} (${item.partCount})`,
      observed: lastHeard
        ? `Heard "${lastHeard}".`
        : 'The tutor judged the answer wrong from the audio.',
    }),
  }), [items]);

  const runner = useJudgedScriptRunner<SyllableClapperItem>({
    pack,
    instanceId: resolvedInstanceId,
    gradeLevel,
    exhibitId,
    onFinished: handleFinished,
    onAffirmed: setRevealed,
  });

  const currentItem = runner.currentItem;
  /** The affirmed item whose reveal is still on screen. `revealHeld` — never
   *  `currentSolved` or `stage`, both of which describe the item that has
   *  ALREADY replaced the affirmed one by render time (18b). */
  const revealItem = runner.revealHeld ? revealed : null;

  // ── Tap ONE part of the reveal bar to hear it (post-affirm only) ──────────
  const hearPart = useCallback((part: string) => {
    if (!ctx.isConnected) return;
    SoundManager.tap();
    ctx.sendText(hearPartCue(part), { silent: true, scripted: true });
    // Context methods are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected]);

  // ── Phase summary ─────────────────────────────────────────────────────────
  const phaseResults = useMemo<PhaseResult[]>(() => {
    if (!evaluation.hasSubmitted) return [];
    return phaseResultsFromSummary(items, runner.summary, (item) => {
      const meta = BAND_META[item.band];
      return { label: meta.badge, icon: meta.icon };
    });
  }, [evaluation.hasSubmitted, runner.summary, items]);

  // ============================================================================
  // Main Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No challenges available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const bandMeta = BAND_META[currentItem?.band ?? 'easy'];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
          {!evaluation.hasSubmitted && currentItem && (
            <LuminaBadge accent={bandMeta.accent} className="text-xs">
              {bandMeta.icon} {bandMeta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!evaluation.hasSubmitted && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.min(runner.currentIndex + 1, items.length)}
                total={items.length}
                variant="dots"
              />
            </div>

            {/* The stimulus. The word is NEVER printed here — it arrives in her
                voice, and a printed word lets a reader chunk it by sight instead
                of hearing it. Tapping re-asks the whole question (question-side
                audio only; the ask carries no count). */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={runner.hearStimulus}
                disabled={!runner.running}
                data-testid="hear-word"
                className={`
                  rounded-2xl border-2 px-12 py-8 text-center transition-all duration-200
                  disabled:opacity-40 disabled:cursor-default
                  ${runner.stimulusTapped
                    ? 'bg-emerald-500/20 border-emerald-400/50 scale-105'
                    : 'bg-emerald-500/10 border-emerald-500/30 cursor-pointer'}
                `}
              >
                <span className="text-6xl">🔊</span>
                <p className="text-xs text-emerald-300/70 mt-3">Tap to hear the word again</p>
              </button>
              <p className="text-center text-base text-slate-300 font-medium">
                {currentItem?.inviteClap === false
                  ? 'How many parts do you hear? Say the number!'
                  : 'Clap the parts — then say how many!'}
              </p>
            </div>

            {/* The reveal — the first moment the word, the split and the count
                may appear on screen, and it holds for exactly as long as she is
                saying the affirmation. Tap a part to hear it. */}
            {revealItem && (
              <LuminaPanel className="p-4 space-y-3" data-testid="reveal">
                <div className="flex gap-1">
                  {revealItem.parts.map((part, idx) => (
                    <button
                      key={`${revealItem.id}-${idx}`}
                      onClick={() => hearPart(part)}
                      className={`
                        flex-1 rounded-xl border-2 p-3 text-center cursor-pointer
                        transition-all duration-200 hover:scale-105 active:scale-95
                        ${SYLLABLE_COLORS[idx % SYLLABLE_COLORS.length]}
                      `}
                    >
                      <span className="text-2xl font-bold block">{part}</span>
                    </button>
                  ))}
                </div>
                <p className="text-center text-emerald-300 text-lg font-black">
                  {revealItem.word} — {revealItem.answer}{' '}
                  {revealItem.partCount === 1 ? 'part' : 'parts'}
                </p>
                {revealItem.imageDescription && (
                  <p className="text-center text-sm text-slate-500 italic">
                    {revealItem.imageDescription}
                  </p>
                )}
                <p className="text-center text-xs text-slate-600">Tap a part to hear it</p>
              </LuminaPanel>
            )}

            {/* Every answer here is spoken. */}
            <JudgedMicPanel run={runner} />
          </>
        )}

        {evaluation.hasSubmitted && phaseResults.length > 0 && (
          <PhaseSummaryPanel
            phases={phaseResults}
            overallScore={evaluation.submittedResult?.score}
            durationMs={evaluation.elapsedMs}
            heading="Syllable Clapping Complete!"
            celebrationMessage="Your ears found the parts in every word!"
            className="mt-4"
          />
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default SyllableClapper;
