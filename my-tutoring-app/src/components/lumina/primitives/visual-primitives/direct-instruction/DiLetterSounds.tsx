'use client';

/**
 * DiLetterSounds — the first Direct Instruction primitive. Live-judged
 * call-response letter-sounds practice: the Live tutor MODELS a continuous
 * letter sound, GUIDES the learner through it, then TESTS ("your turn, what
 * sound?") and judges the audio it heard in-band. The learner PRODUCES the
 * sound into an open mic; the judged-loop engine anchors each attempt to the
 * local voice turn and reads the tutor's verdict from its sentinel opener.
 *
 * The Live tutor IS the interaction surface here (living-simulation doctrine) —
 * the engine (useJudgedSpeechLoop → judgedLoopModel + useLiveVoiceTurns) owns
 * the loop mechanics; this component owns DI progression (advance / retry /
 * move-on after capped corrections), the kid-facing letter/picture display,
 * and evaluation. Items are generator-scoped to the objective; the script and
 * judging contract are hand-authored (diLetterSoundsScript).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaCardDescription,
  LuminaCardContent,
  LuminaBadge,
  LuminaChallengeCounter,
  LuminaMicListener,
} from '../../../ui';
import { usePrimitiveEvaluation } from '../../../evaluation';
import type { PrimitiveEvaluationResult } from '../../../evaluation/types';
import type { DiLetterSoundsMetrics } from '../../../evaluation/types';
import { useChallengeProgress } from '../../../hooks/useChallengeProgress';
import { useJudgedSpeechLoop } from '../../../hooks/useJudgedSpeechLoop';
import type { LoopEmission } from '../../../hooks/judgedLoopModel';
import {
  logDiCue,
  logDiEmission,
  logDiStage,
  logDiTutorText,
  logDiVoiceClose,
  startDiRunLog,
} from './diRunLog';
import {
  completeCue,
  itemCue,
  moveOnCue,
  type DiLetterSoundChallenge,
  type DiLetterSoundChallengeType,
} from './diLetterSoundsScript';
import {
  buildDiDiagnosisEvidence,
  completeLatestJudgeFeedback,
  pushFailedVerdict,
  type DiFailedVerdict,
} from './diDiagnosisEvidence';

export type { DiLetterSoundChallenge, DiLetterSoundChallengeType } from './diLetterSoundsScript';

export interface DiLetterSoundsData {
  title: string;
  description: string;
  /** 3-6 letter-sound items. REQUIRED. Built by the menu-scoped generator. */
  challenges: DiLetterSoundChallenge[];
  /** Session core task identity — the resolved/primary eval-mode skill. */
  challengeType: DiLetterSoundChallengeType;
  /** Flat "m, s, f" item-set summary, attached by the generator for the
   *  tutoring scaffold's RUNTIME STATE (catalog contextKey `letters`). */
  letters?: string;
  gradeLevel?: string;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  componentIntent?: string;
  objectiveText?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<DiLetterSoundsMetrics>) => void;
}

/** Corrections the tutor may run on one sound before the lesson moves on anyway.
 *  Per-turn judging is permissive; a weak sound resurfaces through distributed
 *  review, not by drilling a frustrated five-year-old in place. */
const MAX_CORRECTIONS_PER_ITEM = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One resolved item outcome, accumulated synchronously for metrics. */
interface ItemOutcome {
  id: string;
  correct: boolean;
  attempts: number;
  score: number;
  responseMs: number | null;
}

const scoreForCorrections = (corrections: number): number =>
  corrections <= 0 ? 100 : corrections === 1 ? 67 : 33;

/**
 * Misconception Loop S1 — how each task identity is NAMED to the distiller.
 *
 * The pack is primitive-scoped, so one misconception is stored per student
 * across all three modes. `first_sound_in_word` is the identity worth naming:
 * it hears a whole spoken word and asks for its onset, so a diagnosis earned
 * there ("the student gives the LETTER NAME") means something different from
 * the same words on an isolated grapheme. Putting the identity into
 * `challengeSummary` keeps the distilled sentence self-limiting.
 */
const TASK_PHRASE: Record<DiLetterSoundChallengeType, string> = {
  letter_sound: 'saying the continuous SOUND a printed letter makes (grapheme → phoneme)',
  letter_sound_review: 'saying the continuous SOUND a printed letter makes, drawn as a mixed review set',
  first_sound_in_word: 'isolating the FIRST sound of a spoken word (onset isolation — no letter is shown)',
};

const challengeSummaryFor = (item: DiLetterSoundChallenge): string =>
  `Direct Instruction letter sounds — ${TASK_PHRASE[item.challengeType]}. `
  + (item.challengeType === 'first_sound_in_word'
    ? `The tutor said the word "${item.keyword}" and asked for its first sound. `
    : `The letter "${item.letter}" was printed on screen (keyword "${item.keyword}"). `)
  + 'The learner PRODUCES the sound aloud; the tutor judges the audio.';

const expectedFor = (item: DiLetterSoundChallenge): string =>
  `Produce the held continuous sound "${item.spoken}" — the sound, never the letter name.`;

export const DiLetterSounds: React.FC<DiLetterSoundsData> = (data) => {
  const ctx = useLuminaAIContext();

  const resolvedInstanceId = useMemo(
    () => data.instanceId || `di-letter-sounds-${Math.round(performance.now())}`,
    [data.instanceId],
  );

  const {
    currentIndex,
    results: challengeResults,
    isComplete,
    recordResult,
    advance,
  } = useChallengeProgress<DiLetterSoundChallenge>({
    challenges: data.challenges,
    getChallengeId: (ch) => ch.id,
  });

  const currentChallenge = data.challenges[currentIndex] ?? null;

  const evaluation = usePrimitiveEvaluation<DiLetterSoundsMetrics>({
    primitiveType: 'di-letter-sounds',
    instanceId: resolvedInstanceId,
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    exhibitId: data.exhibitId,
    componentIntent: data.componentIntent,
    objectiveText: data.objectiveText,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── Runtime state ────────────────────────────────────────────────
  const [running, setRunning] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'ready' | 'listening' | 'judging' | 'affirmed' | 'done'>('idle');
  const [statusLine, setStatusLine] = useState('Tap the microphone to start.');

  // Progression authority is useChallengeProgress; mirror the index into a ref
  // so the emission handler (fires inside the loop's dispatch) reads it live.
  const idxRef = useRef(0);
  idxRef.current = currentIndex;
  const correctionsRef = useRef(new Map<string, number>());
  const outcomesRef = useRef<ItemOutcome[]>([]);
  const lastResponseMsRef = useRef<number | null>(null);
  /** What the child said on the OPEN attempt — the engine emits it on
   *  `attempt-transcript` and every DI pack used to drop it. Cleared at
   *  `attempt-open` so a missing transcript can never inherit the last one. */
  const lastHeardRef = useRef<string | null>(null);
  /** Misconception Loop S1 — judge-backed misses, bounded. DATA only, never
   *  student-visible: in this family a stray write to a status line would be
   *  spoken aloud by the tutor. */
  const failedVerdictsRef = useRef<DiFailedVerdict[]>([]);
  /** A miss is logged at verdict time holding only the sentinel opener;
   *  this marks it as awaiting the complete line from `verdict-text`. */
  const awaitingJudgeTextRef = useRef(false);
  const submittedRef = useRef(false);
  const weConnectedRef = useRef(false);
  const connectedRef = useRef(ctx.isConnected);
  const listeningRef = useRef(ctx.isListening);
  connectedRef.current = ctx.isConnected;
  listeningRef.current = ctx.isListening;

  const currentOf = useCallback(
    () => data.challenges[idxRef.current] ?? null,
    [data.challenges],
  );

  const finishAndSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const outcomes = outcomesRef.current;
    const total = data.challenges.length || 1;
    const correctCount = outcomes.filter((o) => o.correct).length;
    const firstTryCount = outcomes.filter((o) => o.correct && o.attempts === 1).length;
    const attemptsCount = outcomes.reduce((sum, o) => sum + o.attempts, 0);
    const overallAccuracy = outcomes.length
      ? Math.round(outcomes.reduce((sum, o) => sum + o.score, 0) / outcomes.length)
      : 0;
    const metrics: DiLetterSoundsMetrics = {
      type: 'di-letter-sounds',
      challengeType: data.challengeType,
      evalMode: data.challengeType,
      totalChallenges: data.challenges.length,
      correctCount,
      attemptsCount,
      firstTryCount,
      hintsViewed: 0,
      overallAccuracy,
      averageAttemptsPerChallenge: outcomes.length
        ? Math.round((attemptsCount / outcomes.length) * 10) / 10
        : 0,
    };
    // Misconception Loop S1 — the packet, on diagnosable sessions only. The
    // threshold mirrors `captureMisconception`'s OWN failure gate
    // (`success === false || score < 60`) rather than this pack's success bar
    // of 50, so evidence exists exactly when the loop would use it.
    const diagnosisEvidence = overallAccuracy < 60
      ? buildDiDiagnosisEvidence(failedVerdictsRef.current)
      : undefined;
    evaluation.submitResult(
      overallAccuracy >= 50,
      overallAccuracy,
      metrics,
      { outcomes },
      undefined,
      diagnosisEvidence,
    );
    setRunning(false);
    setPhase('done');
    setStatusLine('Great work today!');
  }, [data.challenges.length, data.challengeType, evaluation]);

  // ── DI progression over an engine verdict ────────────────────────
  const loopRef = useRef<ReturnType<typeof useJudgedSpeechLoop> | null>(null);

  const applyVerdict = useCallback(
    (judgment: 'affirmed' | 'corrected' | 'off-script', verdictText?: string) => {
      const item = currentOf();
      const loop = loopRef.current;
      if (!item || !loop) return;

      if (judgment === 'off-script') {
        // Neither branch — the engine will resync/re-cue. Keep listening.
        return;
      }

      const prevCorrections = correctionsRef.current.get(item.id) ?? 0;

      if (judgment === 'corrected') {
        const used = prevCorrections + 1;
        correctionsRef.current.set(item.id, used);
        // Misconception Loop S1 — log EVERY correction, not just the capped
        // one. A wrong-then-right item is still a wrong answer, and repeats of
        // the same item are the `priorAttempts` consistency signal that
        // separates a mental model from a slip.
        failedVerdictsRef.current = pushFailedVerdict(failedVerdictsRef.current, {
          challenge: challengeSummaryFor(item),
          expected: expectedFor(item),
          heard: lastHeardRef.current,
          judgeFeedback: verdictText ?? '',
        });
        awaitingJudgeTextRef.current = true;
        if (used <= MAX_CORRECTIONS_PER_ITEM) {
          // The tutor's correction line already re-modeled and re-elicited
          // in-band; just reflect it and keep listening.
          setPhase('listening');
          setStatusLine('Let’s try that one again.');
          return;
        }
        // Corrections capped — record a miss and move the lesson forward.
        // Flagged in the run log: [DI_MOVE_ON] had never fired in ANY pack live
        // before the sustained-miss sitting, so this is a first-observation path.
        logDiStage(
          'move-on',
          `correction cap (${MAX_CORRECTIONS_PER_ITEM}) reached — moving on`,
          { itemId: item.id, itemDisplay: item.letter ?? item.keyword },
          'move-on',
        );
        outcomesRef.current.push({
          id: item.id, correct: false, attempts: used, score: 0,
          responseMs: lastResponseMsRef.current,
        });
        recordResult({ challengeId: item.id, correct: false, attempts: used, score: 0 });
        const next = data.challenges[idxRef.current + 1] ?? null;
        lastResponseMsRef.current = null;
        if (next) {
          setStatusLine('Good try. Let’s keep going.');
          loop.queueCue(moveOnCue(item, next));
          advance();
        } else {
          loop.queueCue(moveOnCue(item));
          finishAndSubmit();
        }
        return;
      }

      // affirmed
      const attempts = prevCorrections + 1;
      const score = scoreForCorrections(prevCorrections);
      outcomesRef.current.push({
        id: item.id, correct: true, attempts, score,
        responseMs: lastResponseMsRef.current,
      });
      recordResult({ challengeId: item.id, correct: true, attempts, score });
      lastResponseMsRef.current = null;
      setPhase('affirmed');
      const next = data.challenges[idxRef.current + 1] ?? null;
      if (next) {
        setStatusLine('Yes! Nice sound.');
        loop.queueCue(itemCue(next));
        advance();
      } else {
        setStatusLine('You did it!');
        loop.queueCue(completeCue());
        finishAndSubmit();
      }
    },
    [advance, currentOf, data.challenges, finishAndSubmit, recordResult],
  );

  /** Item context for the run log. Diagnostics only. */
  const logCtx = useCallback(() => {
    const item = currentOf();
    return { itemId: item?.id, itemDisplay: item?.letter ?? item?.keyword };
  }, [currentOf]);

  const handleEmission = useCallback(
    (emission: LoopEmission) => {
      // Run log FIRST, before the switch — so the three kinds this pack
      // deliberately ignores for progression (attempt-superseded,
      // phantom-transcript, unanchored-verdict) are still recorded on their way
      // to `default: return`. Those three are exactly what a decohered sitting
      // needs and what the packs used to drop without trace. Logging must never
      // influence the loop: nothing below reads it.
      logDiEmission(emission, logCtx());

      switch (emission.kind) {
        case 'attempt-open':
          // A fresh attempt has no transcript yet; stale text would be
          // attributed to the wrong answer in the evidence packet.
          lastHeardRef.current = null;
          awaitingJudgeTextRef.current = false;
          setPhase('judging');
          setStatusLine('Listening…');
          return;
        case 'attempt-transcript':
          lastResponseMsRef.current = emission.responseMs;
          // What the CHILD said. Kept, not dropped — half the evidence.
          lastHeardRef.current = emission.text;
          return;
        case 'verdict':
          if (emission.judgment === 'no-verdict') {
            setStatusLine('One more time—say the sound.');
            return;
          }
          // …and what the TUTOR said about it. Nothing on this path is ever
          // rendered or spoken; it goes to the distiller only.
          applyVerdict(emission.judgment, emission.verdictText);
          return;
        case 'verdict-text': {
          // The tutor's judging line finished streaming. A verdict fires on the
          // chunk that completes the sentinel ("My turn"), which for a
          // contrastive correction is the one part carrying NO diagnosis —
          // "not four — three minus one is two" arrives after it. Upgrade the
          // miss logged at verdict time from that opener to the whole sentence.
          if (emission.judgment === 'corrected' && awaitingJudgeTextRef.current) {
            awaitingJudgeTextRef.current = false;
            failedVerdictsRef.current = completeLatestJudgeFeedback(
              failedVerdictsRef.current,
              emission.text,
            );
          }
          return;
        }
        case 'resync':
          setStatusLine('Let’s try that sound again.');
          if (loopRef.current) {
            const item = currentOf();
            if (item) loopRef.current.queueCue(itemCue(item));
          }
          return;
        default:
          return;
      }
    },
    [applyVerdict, currentOf],
  );

  const loop = useJudgedSpeechLoop({
    enabled: running,
    onEmission: handleEmission,
    // Diagnostics: the tutor's raw output transcription + mic turn telemetry.
    // The bench has wired both since the open-mic runs; the packs shipped with
    // neither, so a decohered run had no record of what the tutor actually SAID
    // (the only way to see a missed sentinel or drifted correction wording) and
    // none of the floors data that explains an echo-opened turn.
    onTutorText: (text) => logDiTutorText(text, logCtx()),
    onVoiceTurnClose: (event) => logDiVoiceClose(event, logCtx()),
    onCue: (event) => logDiCue(event, logCtx()),
  });
  loopRef.current = loop;

  // ── Connect + open mic (student gesture) ─────────────────────────
  const prepareLive = useCallback(async () => {
    if (preparing) return;
    setPreparing(true);
    setStatusLine('Getting ready…');
    try {
      // Only self-connect from a standalone/idle context. In a lesson the
      // shared session owns the connection and is already opened with the DI
      // tutoring block + manual_activity — both resolved from the catalog entry
      // (catalog/di.ts `tutoring` / `audioInput`), same as this fallback path.
      if (!connectedRef.current && ctx.sessionMode === 'idle') {
        weConnectedRef.current = true;
        const first = data.challenges[0];
        await ctx.connect({
          primitive_type: 'di-letter-sounds',
          instance_id: resolvedInstanceId,
          primitive_data: {
            activity: 'live direct instruction letter sounds',
            challengeType: data.challengeType,
            letters: data.challenges.map((c) => c.letter).join(', '),
            letter: first?.letter ?? '',
            keyword: first?.keyword ?? '',
          },
          grade_level: data.gradeLevel || 'kindergarten',
        });
        const started = performance.now();
        while (!connectedRef.current && performance.now() - started < 12_000) await sleep(100);
        if (!connectedRef.current) throw new Error('The tutor did not connect.');
      }

      ctx.startListening();
      const micStarted = performance.now();
      while (!listeningRef.current && performance.now() - micStarted < 10_000) await sleep(100);
      if (!listeningRef.current) throw new Error('The microphone did not open.');

      setPhase('ready');
      setStatusLine('Ready! We’ll start with the first sound.');
      startRun();
    } catch (error) {
      setStatusLine(error instanceof Error ? error.message : 'Could not start.');
      setPhase('idle');
    } finally {
      setPreparing(false);
    }
    // startRun is stable via ref below; deps intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, data.challenges, data.challengeType, data.gradeLevel, preparing, resolvedInstanceId]);

  // Keep the tutor's RUNTIME STATE truthful as items advance — the catalog
  // contextKeys (challengeType / letter / keyword / letters) resolve against
  // this bag. updateContext is the silent channel (no end-of-turn), so these
  // never perturb the judged loop; the context provider dedupes by value.
  useEffect(() => {
    if (!ctx.isConnected || !currentChallenge) return;
    ctx.updateContext({
      challengeType: data.challengeType,
      letter: currentChallenge.letter,
      keyword: currentChallenge.keyword,
      letters: data.challenges.map((c) => c.letter).join(', '),
    });
    // Context methods are stable; keyed on the current item + connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.isConnected, currentChallenge, data.challengeType, data.challenges]);

  const startRun = useCallback(() => {
    const first = data.challenges[0];
    if (!first) return;
    correctionsRef.current.clear();
    outcomesRef.current = [];
    lastResponseMsRef.current = null;
    lastHeardRef.current = null;
    failedVerdictsRef.current = [];
    awaitingJudgeTextRef.current = false;
    submittedRef.current = false;
    loop.reset();
    // Fresh diagnostics timeline for this run (diagnostics only).
    startDiRunLog({
      primitiveId: 'di-letter-sounds',
      challengeType: data.challengeType,
      gradeLevel: data.gradeLevel,
      totalItems: data.challenges.length,
      silenceCloseMs: loop.voiceTurns.config.silenceCloseMs,
    });
    setRunning(true);
    setPhase('listening');
    setStatusLine('Listen, then say the sound.');
    loop.sendCueNow(itemCue(first, true));
    loop.arm();
    logDiStage('run-start', `armed with ${data.challenges.length} items`, {
      itemId: first.id,
      itemDisplay: first.letter ?? first.keyword,
    });
  }, [data.challenges, data.challengeType, data.gradeLevel, loop]);

  // Unmount cleanup — never leave Live holding the mic or an open turn.
  useEffect(() => () => {
    ctx.stopListening();
    if (weConnectedRef.current) ctx.disconnect();
    // Context methods are stable; unmount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ───────────────────────────────────────────────────────
  const total = data.challenges.length;
  const isSupported =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const micState = preparing
    ? 'opening'
    : ctx.isListening
      ? 'armed'
      : 'idle';

  return (
    <LuminaCard surface="elevated" className="max-w-3xl mx-auto">
      <LuminaCardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <LuminaCardTitle>{data.title || 'Letter Sounds'}</LuminaCardTitle>
            <LuminaCardDescription>{data.description}</LuminaCardDescription>
          </div>
          <LuminaBadge accent="cyan">Say it out loud</LuminaBadge>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent>
        {total > 0 && !isComplete && (
          <div className="mb-4 flex justify-center">
            <LuminaChallengeCounter current={currentIndex + 1} total={total} variant="dots" />
          </div>
        )}

        {/* The kid-facing stage. letter_sound / review show the big grapheme +
            picture. first_sound_in_word isolates the onset of a spoken WORD, so
            it shows the picture + the WORD (never the lone grapheme — that would
            leak the answer the child is meant to hear out of the word). */}
        {!isComplete && currentChallenge && (
          <div className="mb-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 to-slate-900/50 p-8 text-center">
            <div className="text-8xl leading-none" aria-hidden="true">{currentChallenge.emoji}</div>
            {currentChallenge.challengeType === 'first_sound_in_word' ? (
              <div className="mt-4 text-5xl font-bold lowercase tracking-wide text-white">
                {currentChallenge.keyword}
              </div>
            ) : (
              <div className="mt-4 text-7xl font-bold tracking-wide text-white">
                {currentChallenge.letter}
              </div>
            )}
            <div className="mt-3 text-xs uppercase tracking-[0.25em] text-cyan-300">
              {phase === 'judging' ? 'listening' : phase === 'affirmed' ? 'yes!' : phase === 'listening' ? (currentChallenge.challengeType === 'first_sound_in_word' ? 'first sound?' : 'your turn') : 'get ready'}
            </div>
          </div>
        )}

        {/* Completion recap — a per-letter mark, kit-styled. */}
        {isComplete && (
          <div className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-6 text-center">
            <div className="text-2xl font-semibold text-emerald-200">Great work today!</div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {data.challenges.map((ch) => {
                const r = challengeResults.find((res) => res.challengeId === ch.id);
                const ok = r?.correct;
                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col items-center rounded-xl border px-4 py-2 ${ok ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}
                  >
                    <span className="text-2xl font-bold text-white">{ch.letter}</span>
                    <span className="text-lg" aria-hidden="true">{ok ? '✅' : '🔁'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice control: the whole interaction runs through the mic. */}
        {!isComplete && (
          <div className="flex flex-col items-center gap-3">
            <LuminaMicListener
              state={micState}
              level={ctx.micLevel}
              isSupported={isSupported}
              onStart={() => void prepareLive()}
              onCancel={running ? undefined : ctx.stopListening}
              size="lg"
              idleLabel="Tap to start"
              openingLabel="Getting ready…"
              listeningLabel="I’m listening"
            />
            <p className="text-sm text-slate-300">{statusLine}</p>
          </div>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default DiLetterSounds;
