'use client';

/**
 * ReadAloudStudio — runs only on the shared tutor/JEV teaching workspace (workspace
 * rollout C7; the scripted runner was retired, LA-14, user ruling 09-23: one path).
 * The observer judges each read against the print and the runtime owns progression.
 * There is no Record or Next button, no self-assessment scale and no mic panel. An
 * unbound mount shows the shared "needs the tutor" card.
 *
 * WHAT THIS REPLACES. The pre-port surface judged nothing. Its score was
 * `modelListened + recordingMade + selfAssessment + comparisonUsed` — four
 * button presses — and "estimated WPM" was wall-clock duration divided by the
 * passage word count, computed whether or not the child said a single word (tap
 * Start and Stop back to back and it read 6000 WPM). A child who cannot read
 * could tap Play, Start, Stop, then "5 out of 5" and finish with a full score.
 * Every graded action was a costume, so all of them are gone: the four-phase
 * stepper, the fake recorder, the WPM stat, the 1-5 self-rating, the "Compare
 * with Model" toggle and the playback-speed picker. The generated comprehension
 * question went with them — it was produced on every call and never rendered.
 *
 * ONE LINE AT A TIME, IN ORDER, AND NEVER THE WHOLE PASSAGE MID-RUN. The
 * passage arrives already split into 3-8 word lines (the benched judged-
 * utterance window). Expression expands each line into a plan and two reads.
 * Showing the block of text
 * while a single line is being read would put the next line in front of a child
 * still reading this one; the whole passage is the END-OF-RUN reward, which is
 * also when seeing what they read is worth something.
 *
 * WHAT THE TUTOR MAY SPEAK, PER MODE. `accuracy` is a COLD read — the tutor
 * must not say the line before the child does, because decoding print unaided
 * is the entire measurement. `expression` now plans and reads before hearing
 * a model and rereading; `dialogue` models first. In all
 * three the WORDS are the verdict and the delivery is the teaching: there is no
 * prosody response class, so nothing here grades how it sounded. Cue wording,
 * delivery notes, the cold-read guard and the judging contracts are hand-
 * authored in `readAloudStudioScript.ts` and `readAloudPhrasing.ts`; lines that cannot be asked honestly
 * (outside the benched window, a sentinel-opening sentence, dialogue with no
 * speaker) are DROPPED at build — never degraded.
 *
 * The assignment and scene the tutor receives live in `readAloudStudioWorkspace.ts`.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaBadge,
  LuminaPanel,
  LuminaChallengeCounter,
  LuminaPrintSupport,
  motion,
  type LuminaAccent,
} from '../../../ui';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { ReadAloudStudioMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import DiActionPanel from '../../../components/DiActionPanel';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import {
  studioItems, phrasePlanCue, markedGroups, scoredReadingItems, readingSummary, type StudioItem,
} from './readAloudPhrasing';
import {
  passageFrom,
  type ReadAloudLineLike,
  type ReadAloudMode,
} from './readAloudStudioScript';
import { describePhrasePlan, readAloudAssignment, readAloudScene } from './readAloudStudioWorkspace';
import { DOTS_LEVER, TRACK_LEVER, leversOnScreen, readAloudLevers, shortLine } from './readAloudStudioLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

/**
 * One printed line of the passage — the judged unit. Dialogue lines carry the
 * SPOKEN WORDS ONLY; the speaker rides in `speaker` and the quotation marks are
 * drawn on screen, so the tutor's cue never contains a stray quote character.
 */
export type ReadAloudLine = ReadAloudLineLike;

export interface ReadAloudStudioData {
  title: string;
  gradeLevel: string;
  /** Which fluency identity this passage practises — the eval mode. */
  fluencyFocus?: ReadAloudMode;
  /** The passage, already split into judged lines, in reading order. */
  lines: ReadAloudLine[];
  lexileLevel: string;

  // Evaluation props
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<ReadAloudStudioMetrics>) => void;
}

interface ReadAloudStudioProps {
  data: ReadAloudStudioData;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MODE_META: Record<ReadAloudMode, { badge: string; icon: string; accent: LuminaAccent; ready: string }> = {
  accuracy: { badge: 'Read It', icon: '📖', accent: 'blue', ready: 'Read the line out loud — every word.' },
  expression: { badge: 'Phrase and Read', icon: '🎵', accent: 'purple', ready: 'Mark phrases, read, listen, and read again.' },
  dialogue: { badge: 'Character Voice', icon: '🎭', accent: 'amber', ready: 'Listen, then say it their way.' },
};

/** Print size for a reader: as large as the line allows without wrapping into
 *  a wall. Length is the only variable that matters here. */
const lineSizeClass = (wordCount: number): string =>
  wordCount <= 4 ? 'text-5xl' : wordCount <= 6 ? 'text-4xl' : 'text-3xl';

// ============================================================================
// Component
// ============================================================================

const ReadAloudStudioSurface: React.FC<ReadAloudStudioProps> = ({ data, className, runtimePlanItemId }) => {
  const {
    title,
    gradeLevel,
    lexileLevel,
    lines = [],
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const mode: ReadAloudMode = data.fluencyFocus ?? 'accuracy';

  const stableInstanceIdRef = useRef(instanceId || `read-aloud-studio-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;
  const workspace = useRef<TeachingWorkspace | null>(null);

  // ── Items (drop-gated) ────────────────────────────────────────────────────
  const items = useMemo<StudioItem[]>(() => {
    const built = studioItems(lines, mode);
    const lineCount = scoredReadingItems(built).length;
    if (lineCount < lines.length) {
      console.warn(
        `[ReadAloudStudio] dropped ${lines.length - lineCount} unaskable line(s) (word-window / sentinel / speaker gates)`,
      );
    }
    return built;
  }, [lines, mode]);
  const readingItems = useMemo(() => scoredReadingItems(items), [items]);
  const [phrasePlans, setPhrasePlans] = useState<Record<string, number[]>>({});
  const phrasePlansRef = useRef<Record<string, number[]>>({});
  /** Steps credited so far, for the expression step rail. */
  const [solvedIds, setSolvedIds] = useState<ReadonlySet<string>>(() => new Set());
  // In-item levers (`readAloudStudioLevers.ts`), keyed by the session item they were pulled on, and the easier
  // practice line a simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<StudioItem | null>(null);

  // ── Evaluation ────────────────────────────────────────────────────────────
  const evaluation = usePrimitiveEvaluation<ReadAloudStudioMetrics>({
    primitiveType: 'read-aloud-studio',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  const finish = (summary: TeachingEvaluationResult) => {
    // One scored reading per printed line: a saved plan and the first read do not count.
    const scored = readingSummary(items, summary);
    // The set's actual difficulty. Line length is this pack's structural axis.
    const meanLineWords = readingItems.length
      ? Math.round((readingItems.reduce((sum, it) => sum + it.wordCount, 0) / readingItems.length) * 10) / 10
      : 0;
    const metrics: ReadAloudStudioMetrics = {
      type: 'read-aloud-studio',
      evalMode: mode,
      fluencyFocus: mode,
      linesTotal: readingItems.length,
      linesRead: scored.solvedCount,
      firstTryCount: scored.firstTryCount,
      attemptsCount: scored.attemptsCount,
      accuracy: scored.accuracy,
      meanLineWords,
      passageLexileLevel: lexileLevel,
    };
    evaluation.submitResult(
      scored.passed,
      scored.accuracy,
      metrics,
      { lineResults: scored.outcomes, learningResponses: summary.learningResponses,
        teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance,
        ...(mode === 'expression' ? {
          practiceVersion: 'phrase-read-reread-v1',
          scoringBasis: 'modeled-reread-word-accuracy',
          prosodyAssessed: false,
          firstReadResults: summary.outcomes.filter((outcome) => outcome.id.endsWith('-first_read')),
          phrasePlans: readingItems.map((item) => ({ lineId: item.lineId,
            learnerGroups: markedGroups(item.text, phrasePlansRef.current[item.lineId] ?? []),
            modelGroups: item.modelGroups })),
        } : {}),
      },
      undefined,
      summary.diagnosisEvidence,
    );
  };

  const runner = useWorkspaceRunner<StudioItem>({
    primitiveId: 'read-aloud-studio',
    assignment: readAloudAssignment,
    items,
    workspace,
    objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId,
    onFinished: finish,
    onItemOpened: (_item, index) => {
      setPractice(null);
      if (index === 0) {
        phrasePlansRef.current = {};
        setPhrasePlans({});
      }
    },
    onAffirmed: (item) => setSolvedIds((prev) => new Set(prev).add(item.id)),
  });
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;

  const sessionItem = runner.currentItem;
  /** What is on screen: the practice line while a simplify lever holds it, else the session item. */
  const currentItem = practice ?? sessionItem;
  const pulledLevers = !practice && leverState.item === sessionItem?.id ? leverState.pulled : [];
  const on = (id: string) => pulledLevers.includes(id);
  /** Credited: the line is marked read in place. */
  const revealed = runner.currentSolved;
  // A practice line has no phrase plan of its own: the parent's marks index the parent's words.
  const currentBreaks = currentItem && !practice ? phrasePlans[currentItem.lineId] ?? [] : [];
  const canMark = currentItem?.step === 'mark' && runner.canAttempt;

  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!currentItem || !sessionItem) return;
    const levers = practice ? [] : readAloudLevers(sessionItem, pulledLevers, items);
    const scene = readAloudScene(currentItem, practice ? [] : phrasePlansRef.current[currentItem.lineId] ?? []);
    const onScreen = practice ? null : leversOnScreen(pulledLevers);
    workspace.current = { ...scene,
      facts: { ...scene.facts,
        ...(onScreen ? { levers_on_screen: onScreen } : {}),
        ...(practice ? { practice: 'An easier practice line of three new words, not from the passage, ungraded. The line comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const simpler = shortLine(sessionItem, items);
          if (!simpler) return 'There is no easier line here.';
          setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
          setPractice(simpler);
          return { practice: readAloudAssignment(simpler) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulledLevers, id] });
        return true;
      },
      endPractice: () => setPractice(null),
    };
  });

  // Pip: the printed line is the whole question side. A phrase plan is a hands
  // answer, so Pip receives the line while the plan is open; it never marks a
  // break itself.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The line', finished: showSummary,
    handover: currentItem?.step === 'mark',
  });
  const updateBreak = (boundary: number) => {
    if (!currentItem || !canMark) return;
    const previous = phrasePlansRef.current[currentItem.lineId] ?? [];
    const next = previous.includes(boundary) ? previous.filter((n) => n !== boundary) : [...previous, boundary].sort((a, b) => a - b);
    phrasePlansRef.current = { ...phrasePlansRef.current, [currentItem.lineId]: next };
    setPhrasePlans(phrasePlansRef.current);
  };
  /** The plan is page work: any plan commits as done, and the activity says so. */
  const commitPlan = () => {
    if (!currentItem || !canMark) return;
    const breaks = phrasePlansRef.current[currentItem.lineId] ?? [];
    commitGesture(runner, { response: describePhrasePlan(currentItem, breaks), correct: true,
      cue: () => phrasePlanCue(currentItem, breaks) });
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (items.length === 0) {
    return (
      <LuminaCard className={className}>
        <LuminaCardContent className="p-6">
          <p className="text-slate-400 text-center">No reading lines available.</p>
        </LuminaCardContent>
      </LuminaCard>
    );
  }

  const meta = MODE_META[mode];
  const outcomes = runner.teachingResult?.outcomes ?? [];

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <LuminaCardTitle className="text-lg">{title}</LuminaCardTitle>
            <div className="flex items-center gap-2">
              <LuminaBadge className="text-xs">Grade {gradeLevel}</LuminaBadge>
              <LuminaBadge accent="blue" className="text-xs">{lexileLevel}</LuminaBadge>
            </div>
          </div>
          {!showSummary && (
            <LuminaBadge accent={meta.accent} className="text-xs">
              {meta.icon} {meta.badge}
            </LuminaBadge>
          )}
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {!showSummary && (
          <>
            <div className="flex justify-center">
              <LuminaChallengeCounter
                current={Math.max(1, readingItems.findIndex((item) => item.lineId === currentItem?.lineId) + 1)}
                total={readingItems.length}
                variant="dots"
              />
            </div>

            {pip.store && <div {...pip.dock} />}
            {/* One printed line persists through planning, reading and modeling. */}
            {currentItem && (
              <div {...pip.target('stimulus')} className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
                {currentItem.kind === 'dialogue' && currentItem.speaker && (
                  <LuminaBadge accent="amber" className="text-xs">🎭 {currentItem.speaker} says</LuminaBadge>
                )}
                {currentItem.step === 'reread' && !practice && (
                  <p className="text-xs uppercase tracking-widest text-slate-300">Your phrase plan</p>
                )}
                <div
                  key={`${currentItem.id}-${revealed}`}
                  className={`font-bold leading-snug tracking-wide ${lineSizeClass(currentItem.wordCount)} ${
                    revealed ? `text-emerald-300 ${motion.pop}` : `text-white ${motion.reveal}`
                  }`}
                >
                  {currentItem.step === 'mark' ? (
                    <div className="flex flex-wrap items-center justify-center" aria-label="Mark phrase breaks">
                      {currentItem.text.split(' ').map((word, index, words) => (
                        <React.Fragment key={index}>
                          <span>{word}</span>
                          {index < words.length - 1 && (
                            <button type="button" disabled={!canMark}
                              aria-label={`Pause after ${word.replace(/[,;:.!?]+$/, '')}, word ${index + 1}`}
                              aria-pressed={currentBreaks.includes(index + 1)}
                              onClick={() => updateBreak(index + 1)}
                              className="mx-1 min-h-12 min-w-11 rounded-lg border border-purple-300/30 text-purple-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-200 disabled:opacity-40">
                              {currentBreaks.includes(index + 1) ? '|' : '·'}
                            </button>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ) : on(TRACK_LEVER) || on(DOTS_LEVER) ? (
                    // The pulled print marks, drawn by the shared overlay. Visual only.
                    <LuminaPrintSupport text={currentItem.text} trackingUnderline={on(TRACK_LEVER)} soundDots={on(DOTS_LEVER)} />
                  ) : currentItem.step ? (
                    <span>{markedGroups(currentItem.text, currentBreaks).join(' / ')}</span>
                  ) : currentItem.kind === 'dialogue' ? `“${currentItem.text}”` : currentItem.text}
                </div>
                {currentItem.step === 'mark' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-300">Tap a mark again to remove it. You can keep the whole line together.</p>
                    <button type="button" disabled={!canMark} onClick={commitPlan}
                      className="min-h-12 rounded-xl bg-purple-500 px-5 py-3 font-semibold text-white disabled:opacity-40">
                      Use my phrase plan
                    </button>
                  </div>
                )}
                {currentItem.step === 'reread' && (
                  <div className="space-y-2 rounded-xl border border-purple-300/30 bg-purple-500/10 p-4">
                    <p className="text-xs uppercase tracking-widest text-purple-200">One way to group the words</p>
                    <p className="text-2xl leading-relaxed text-white">{currentItem.modelGroups.join(' / ')}</p>
                    <p className="text-sm text-slate-300">{currentItem.modelGroups.length > 1
                      ? 'Keep each group smooth. A slash means a small pause.'
                      : 'Keep the whole line together as one smooth phrase.'}</p>
                  </div>
                )}
                <div className="text-xs uppercase tracking-[0.25em] text-cyan-300">
                  {revealed
                    ? 'yes!'
                    : currentItem.step === 'mark' ? 'plan your phrases'
                      : currentItem.step === 'first_read' ? 'your first reading'
                        : currentItem.kind === 'accuracy' ? 'read it' : 'listen, then say it back'}
                </div>
              </div>
            )}

            {/* Expression keeps its step rail: plan, first read, reread. */}
            {mode === 'expression' && (
              <DiActionPanel run={runner} running={runner.running} stage={runner.stage}
                currentItem={currentItem} steps={items.filter((item) => item.lineId === currentItem?.lineId)}
                completedIds={solvedIds}
                carriedIds={new Set(items.filter((item, index) => index < runner.currentIndex
                  && item.lineId === currentItem?.lineId && !solvedIds.has(item.id)).map((item) => item.id))}
                startInstruction="Mark where you want to pause." />
            )}
          </>
        )}

        {/* Completion — the passage whole, which is the first time the child
            sees the text they just read as one piece, plus a per-line mark. */}
        {showSummary && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-5 text-center">
              <div className="text-xl font-semibold text-emerald-200">Great reading today!</div>
              <p className="mt-1 text-xs text-slate-400">
                {readingSummary(items, { outcomes }).solvedCount} of {readingItems.length} lines read accurately{mode === 'expression' ? ' after the model' : ''}.
              </p>
            </div>

            <LuminaPanel className="p-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-2">The whole passage</p>
              <p className="text-base leading-relaxed text-slate-200">{passageFrom(readingItems)}</p>
            </LuminaPanel>

            <div className="flex flex-col items-center gap-2">
              {readingItems.map((item) => {
                const outcome = outcomes.find((o) => o.id === item.id);
                const ok = outcome?.solved;
                return (
                  <div
                    key={item.id}
                    className={`flex w-full max-w-lg items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left ${
                      ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'
                    }`}
                  >
                    <span className="text-sm font-medium text-white">{item.text}</span>
                    <span className="text-lg" aria-hidden="true">{ok ? '✅' : '🔁'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card. */
const ReadAloudStudio = withWorkspaceOnly<ReadAloudStudioProps>('read-aloud-studio', ReadAloudStudioSurface,
  (props) => props.data.title);

export default ReadAloudStudio;
