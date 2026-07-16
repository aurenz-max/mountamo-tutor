'use client';

/**
 * DirectInstructionBench — Voice Studio-style bench that welds the Azure
 * spoken-word detector ON TOP of the Gemini Live tutor and validates the
 * Direct Instruction delivery loop (I do → we do → you do) from the tutor's
 * perspective, before any DI primitive is built.
 *
 * What it measures per beat:
 *  - cue→audio latency (sendText → first tutor audio frame)
 *  - audio duration (rise → drain of the playback graph)
 *  - script fidelity (did the tutor speak the scripted line verbatim?)
 *  - student capture: heard text, ladder outcome, judge engine + latency,
 *    response time (mic hot → verdict settled)
 *  - correction procedure: does the verdict actually condition the tutor's
 *    NEXT utterance (scripted mode = engine-authored; informed mode = the
 *    tutor authors its own verify/correction line from a [JUDGE_VERDICT])
 *
 * Mic timing doctrine: the mic NEVER opens while the tutor is speaking — every
 * student window is gated on the isAudioPlaying true→false edge (real audio
 * drain, not ai_turn_end).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { useVoiceAnswer, type SpokenJudgeResult } from '../../hooks/useVoiceAnswer';
import type { VoiceModality } from '../../hooks/useVoiceCapture';
import { LuminaMicListener } from '../../ui';
import {
  DEFAULT_ITEMS,
  DI_TUTORING,
  correctionLine,
  guideLine,
  modelLine,
  scoreFidelity,
  scriptedCue,
  testLine,
  unclearLine,
  verdictCue,
  verifyLine,
  type DIItem,
} from './diScript';

type BenchMode = 'scripted' | 'informed';
type Outcome = 'match' | 'no-match' | 'unclear' | 'no-speech';

type BeatKind =
  | 'model'
  | 'guide'
  | 'guide-echo'
  | 'test'
  | 'retest'
  | 'verify'
  | 'correct';

interface BeatRow {
  n: number;
  itemId: string;
  beat: BeatKind;
  /** Engine-authored line (undefined for informed-mode tutor-authored beats). */
  scriptedLine?: string;
  /** What the tutor actually said (assistant transcription chunks). */
  transcript?: string;
  /** Verbatim compliance vs scriptedLine. */
  coverage?: number;
  extras?: number;
  cueToAudioMs?: number | null;
  audioMs?: number | null;
  /** Student capture fields. */
  heard?: string | null;
  outcome?: Outcome;
  judgeEngine?: string;
  judgeMs?: number;
  escalated?: boolean;
  responseMs?: number;
  note?: string;
}

const MAX_CORRECTIONS = 2;
const RETEST_GAP = 3;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// BenchMic — owns the useVoiceAnswer engine. Keyed by modality by the parent
// (the capture engine's modality is fixed per mount).
// ---------------------------------------------------------------------------

interface BenchMicProps {
  modality: VoiceModality;
  targetWord: string;
  active: boolean;
  onResult: (r: SpokenJudgeResult) => void;
  onNoSpeech: () => void;
}

const BenchMic: React.FC<BenchMicProps> = ({ modality, targetWord, active, onResult, onNoSpeech }) => {
  const va = useVoiceAnswer({
    targetWord,
    gradeLevel: 'kindergarten',
    active,
    modality,
    autoStart: true,
    onResult,
    onNoSpeech,
  });

  return (
    <div className="flex items-center gap-4">
      <LuminaMicListener
        state={va.state}
        level={va.level}
        isSupported={va.isSupported}
        onStart={va.startManual}
        onCancel={va.cancel}
        dormant={va.dormant}
        size="md"
        idleLabel="Tap to enable mic"
        listeningLabel={active ? `Listening for "${targetWord}"` : 'Standing by'}
      />
      <div className="text-xs text-slate-400">
        {active ? (
          <>Student window open — target <span className="text-cyan-300 font-mono">{targetWord}</span></>
        ) : (
          'Mic closed (opens after the tutor finishes each line)'
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The bench
// ---------------------------------------------------------------------------

interface DirectInstructionBenchProps {
  onBack: () => void;
}

const DirectInstructionBench: React.FC<DirectInstructionBenchProps> = ({ onBack }) => {
  const ctx = useLuminaAIContext();

  // ---- config levers ----
  const [mode, setMode] = useState<BenchMode>('scripted');
  const [modality, setModality] = useState<VoiceModality>('open');
  const [guideEcho, setGuideEcho] = useState(true);
  const [items, setItems] = useState<DIItem[]>(DEFAULT_ITEMS);

  // ---- run state ----
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [rows, setRows] = useState<BeatRow[]>([]);
  const [captureActive, setCaptureActive] = useState(false);
  const [captureTarget, setCaptureTarget] = useState('');

  const runIdRef = useRef(0);
  const rowNRef = useRef(0);
  const weConnectedRef = useRef(false);

  // ---- live mirrors (the async engine reads these, never stale state) ----
  const connectedRef = useRef(ctx.isConnected);
  connectedRef.current = ctx.isConnected;
  const audioRef = useRef(ctx.isAudioPlaying);
  const conversationRef = useRef(ctx.conversation);
  conversationRef.current = ctx.conversation;

  // ---- audio edge waiters ----
  const audioWaitersRef = useRef<Array<{ edge: 'rise' | 'fall'; resolve: (ok: boolean) => void; timer: ReturnType<typeof setTimeout> }>>([]);

  useEffect(() => {
    audioRef.current = ctx.isAudioPlaying;
    audioWaitersRef.current = audioWaitersRef.current.filter((w) => {
      const satisfied = (w.edge === 'rise') === ctx.isAudioPlaying;
      if (satisfied) {
        clearTimeout(w.timer);
        w.resolve(true);
      }
      return !satisfied;
    });
  }, [ctx.isAudioPlaying]);

  const waitAudio = useCallback((edge: 'rise' | 'fall', timeoutMs: number) => {
    return new Promise<boolean>((resolve) => {
      if ((edge === 'rise') === audioRef.current) return resolve(true);
      const waiter = { edge, resolve, timer: setTimeout(() => {
        audioWaitersRef.current = audioWaitersRef.current.filter((w) => w !== waiter);
        resolve(false);
      }, timeoutMs) } as { edge: 'rise' | 'fall'; resolve: (ok: boolean) => void; timer: ReturnType<typeof setTimeout> };
      audioWaitersRef.current.push(waiter);
    });
  }, []);

  // ---- verdict waiter (BenchMic resolves it) ----
  const verdictWaiterRef = useRef<((r: SpokenJudgeResult | null) => void) | null>(null);

  const handleMicResult = useCallback((r: SpokenJudgeResult) => {
    const w = verdictWaiterRef.current;
    if (w) {
      verdictWaiterRef.current = null;
      w(r);
    }
  }, []);

  const handleNoSpeech = useCallback(() => {
    const w = verdictWaiterRef.current;
    if (w) {
      verdictWaiterRef.current = null;
      w(null);
    }
  }, []);

  // ---- helpers ----
  const dead = (runId: number) => runIdRef.current !== runId;

  const pushRow = (row: Omit<BeatRow, 'n'>) => {
    rowNRef.current += 1;
    setRows((prev) => [...prev, { n: rowNRef.current, ...row }]);
  };

  const collectAssistant = (fromIdx: number): string => {
    return conversationRef.current
      .slice(fromIdx)
      .filter((m) => m.role === 'assistant')
      .map((m) => m.content)
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  };

  /** Send one cue and wait for the tutor's audio to rise and fully drain.
   *  Returns timing + everything the tutor said during the beat. */
  const speakCue = async (runId: number, cue: string) => {
    const fromIdx = conversationRef.current.length;
    const t0 = performance.now();
    ctx.sendText(cue, { silent: true });
    const rose = await waitAudio('rise', 10000);
    const cueToAudioMs = rose ? Math.round(performance.now() - t0) : null;
    let audioMs: number | null = null;
    if (rose && !dead(runId)) {
      const t1 = performance.now();
      await waitAudio('fall', 45000);
      audioMs = Math.round(performance.now() - t1);
      await sleep(350); // let trailing transcription chunks land
    }
    return { cueToAudioMs, audioMs, transcript: collectAssistant(fromIdx) };
  };

  /** Engine-authored beat: cue → audio → fidelity row. */
  const speakScripted = async (runId: number, item: DIItem, beat: BeatKind, tag: string, line: string) => {
    if (dead(runId)) return;
    setPhase(`${item.display}: ${beat} — tutor speaking`);
    const { cueToAudioMs, audioMs, transcript } = await speakCue(runId, scriptedCue(tag, line));
    const fid = scoreFidelity(line, transcript);
    pushRow({
      itemId: item.display,
      beat,
      scriptedLine: line,
      transcript,
      coverage: fid.coverage,
      extras: fid.extras,
      cueToAudioMs,
      audioMs,
      note: cueToAudioMs === null ? 'no audio within 10s' : undefined,
    });
  };

  /** Informed-mode beat: inject the judge verdict, let the tutor author the line. */
  const speakInformed = async (
    runId: number,
    item: DIItem,
    beat: BeatKind,
    heard: string | null,
    outcome: Outcome,
  ) => {
    if (dead(runId)) return;
    setPhase(`${item.display}: ${beat} — verdict injected, tutor authoring`);
    const { cueToAudioMs, audioMs, transcript } = await speakCue(runId, verdictCue(item, heard, outcome));
    pushRow({
      itemId: item.display,
      beat,
      transcript,
      cueToAudioMs,
      audioMs,
      note: 'tutor-authored (informed mode)',
    });
  };

  /** Open a student window (gated on tutor silence) and await one verdict. */
  const awaitStudent = (item: DIItem, timeoutMs: number) => {
    return new Promise<{ result: SpokenJudgeResult | null; responseMs: number; timedOut: boolean }>((resolve) => {
      setCaptureTarget(item.reference);
      setCaptureActive(true);
      const t0 = performance.now();
      let done = false;
      const finish = (result: SpokenJudgeResult | null, timedOut: boolean) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        verdictWaiterRef.current = null;
        setCaptureActive(false);
        resolve({ result, responseMs: Math.round(performance.now() - t0), timedOut });
      };
      const timer = setTimeout(() => finish(null, true), timeoutMs);
      verdictWaiterRef.current = (r) => finish(r, false);
    });
  };

  const studentRow = (
    item: DIItem,
    beat: BeatKind,
    result: SpokenJudgeResult | null,
    responseMs: number,
    timedOut: boolean,
    note?: string,
  ): Outcome => {
    const outcome: Outcome = result ? (result.outcome as Outcome) : 'no-speech';
    pushRow({
      itemId: item.display,
      beat,
      heard: result?.verdict?.heard ?? null,
      outcome,
      judgeEngine: result?.verdict?.model,
      judgeMs: result?.verdict?.judgeLatencyMs,
      escalated: result?.escalated,
      responseMs,
      note: note ?? (timedOut ? `no verdict within window` : undefined),
    });
    return outcome;
  };

  /** You-do beat: test → capture → verify/correct, with the DI correction
   *  procedure (max 2 corrections, then move on). Returns pass/fail. */
  const runTestCycle = async (runId: number, item: DIItem, isRetest: boolean): Promise<boolean> => {
    await speakScripted(runId, item, isRetest ? 'retest' : 'test', 'DI_TEST', testLine(item));
    for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt++) {
      if (dead(runId)) return false;
      setPhase(`${item.display}: listening (attempt ${attempt + 1})`);
      const { result, responseMs, timedOut } = await awaitStudent(item, 12000);
      if (dead(runId)) return false;
      const outcome = studentRow(item, attempt === 0 && !isRetest ? 'test' : 'retest', result, responseMs, timedOut);

      if (outcome === 'match') {
        if (mode === 'scripted') {
          await speakScripted(runId, item, 'verify', 'DI_VERIFY', verifyLine(item));
        } else {
          await speakInformed(runId, item, 'verify', result?.verdict?.heard ?? null, outcome);
        }
        return true;
      }

      if (attempt === MAX_CORRECTIONS) return false;

      if (outcome === 'no-match') {
        if (mode === 'scripted') {
          await speakScripted(runId, item, 'correct', 'DI_CORRECT', correctionLine(item));
        } else {
          await speakInformed(runId, item, 'correct', result?.verdict?.heard ?? null, outcome);
        }
      } else {
        // unclear / no-speech → neutral re-ask, never a correction
        await speakScripted(runId, item, 'correct', 'DI_UNCLEAR', unclearLine(item));
      }
    }
    return false;
  };

  const waitQuiet = async (runId: number) => {
    for (let i = 0; i < 5; i++) {
      if (dead(runId)) return;
      if (audioRef.current) await waitAudio('fall', 60000);
      await sleep(1200);
      if (!audioRef.current) return;
    }
  };

  // ---- the run loop ----
  const startRun = async () => {
    const runId = ++runIdRef.current;
    rowNRef.current = 0;
    setRows([]);
    setRunning(true);
    try {
      const active = items.filter((i) => i.enabled);
      if (active.length === 0) {
        setPhase('no items enabled');
        return;
      }

      if (!connectedRef.current) {
        setPhase('connecting tutor session…');
        await ctx.connect({
          primitive_type: 'di-bench',
          instance_id: `di-bench-${Date.now()}`,
          primitive_data: {
            activity: 'direct instruction drill',
            itemSet: active.map((i) => i.display).join(', '),
          },
          grade_level: 'kindergarten',
          tutoring: DI_TUTORING,
        });
        weConnectedRef.current = true;
        const t0 = performance.now();
        while (!connectedRef.current && performance.now() - t0 < 12000) await sleep(150);
        if (!connectedRef.current) {
          setPhase('connection failed — is the backend running?');
          return;
        }
      }

      setPhase('waiting for the greeting to finish…');
      await waitQuiet(runId);

      // Queue with delayed retest: a failed item re-enters RETEST_GAP later.
      const queue: Array<{ item: DIItem; retest: boolean }> = active.map((item) => ({ item, retest: false }));
      let qi = 0;
      while (qi < queue.length) {
        if (dead(runId)) return;
        const { item, retest } = queue[qi];

        if (!retest) {
          await speakScripted(runId, item, 'model', 'DI_MODEL', modelLine(item)); // I do
          await speakScripted(runId, item, 'guide', 'DI_GUIDE', guideLine(item)); // we do
          if (guideEcho && !dead(runId)) {
            setPhase(`${item.display}: guide echo (unscored)`);
            const { result, responseMs, timedOut } = await awaitStudent(item, 6000);
            if (dead(runId)) return;
            studentRow(item, 'guide-echo', result, responseMs, timedOut, 'unscored we-do echo');
          }
        }

        const passed = await runTestCycle(runId, item, retest); // you do
        if (!passed && !retest && !dead(runId)) {
          queue.splice(Math.min(qi + RETEST_GAP, queue.length), 0, { item, retest: true });
        }
        qi++;
      }

      if (!dead(runId)) setPhase('run complete');
    } finally {
      if (runIdRef.current === runId) {
        setRunning(false);
        setCaptureActive(false);
      }
    }
  };

  const stopRun = () => {
    runIdRef.current += 1;
    // Flush pending waiters so the suspended run loop unwinds (dead-run checks
    // discard whatever they resolve with).
    const w = verdictWaiterRef.current;
    verdictWaiterRef.current = null;
    w?.(null);
    for (const waiter of audioWaitersRef.current.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(false);
    }
    setCaptureActive(false);
    setRunning(false);
    setPhase('stopped');
  };

  // Disconnect a session we opened when leaving the bench.
  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (weConnectedRef.current) ctx.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- summary + export ----
  const summary = useMemo(() => {
    const tests = rows.filter((r) => r.beat === 'test' || r.beat === 'retest');
    const matches = tests.filter((r) => r.outcome === 'match').length;
    const spoken = rows.filter((r) => r.cueToAudioMs != null);
    const meanCue = spoken.length
      ? Math.round(spoken.reduce((s, r) => s + (r.cueToAudioMs ?? 0), 0) / spoken.length)
      : null;
    const fid = rows.filter((r) => r.coverage != null);
    const meanFid = fid.length ? fid.reduce((s, r) => s + (r.coverage ?? 0), 0) / fid.length : null;
    return { tests: tests.length, matches, meanCue, meanFid };
  }, [rows]);

  const copyRun = async () => {
    const payload = {
      bench: 'direct-instruction',
      at: new Date().toISOString(),
      config: { mode, modality, guideEcho },
      items: items.filter((i) => i.enabled),
      summary,
      rows,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setPhase('run JSON copied to clipboard');
    } catch {
      setPhase('clipboard copy failed');
    }
  };

  const setItem = (id: string, patch: Partial<DIItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  // ---- render ----
  const lever = (label: string, activeLever: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      disabled={running}
      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
        activeLever
          ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200'
          : 'bg-slate-800/60 border-white/10 text-slate-400 hover:text-slate-200'
      } ${running ? 'opacity-50' : ''}`}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all text-sm"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Direct Instruction Bench</h1>
          <p className="text-xs text-slate-400">
            I do → we do → you do, judged by the Azure→Gemini ladder, verdicts conditioning the live tutor.
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Mode</span>
            {lever('Scripted (engine-authored)', mode === 'scripted', () => setMode('scripted'))}
            {lever('Informed (tutor-authored)', mode === 'informed', () => setMode('informed'))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">Mic</span>
            {lever('Open', modality === 'open', () => setModality('open'))}
            {lever('Push-to-talk', modality === 'ptt', () => setModality('ptt'))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide">We-do echo</span>
            {lever(guideEcho ? 'Captured (unscored)' : 'Skipped', guideEcho, () => setGuideEcho(!guideEcho))}
          </div>
        </div>

        {/* Items */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((it) => (
            <div
              key={it.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                it.enabled ? 'bg-slate-800/50 border-white/10' : 'bg-slate-900/30 border-white/5 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={it.enabled}
                disabled={running}
                onChange={(e) => setItem(it.id, { enabled: e.target.checked })}
              />
              <span className="w-10 text-center text-lg font-bold text-slate-100">{it.display}</span>
              <span className="text-[10px] text-slate-500 uppercase">{it.kind}</span>
              <label className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                spoken
                <input
                  value={it.spoken}
                  disabled={running}
                  onChange={(e) => setItem(it.id, { spoken: e.target.value })}
                  className="w-16 bg-slate-900/60 border border-white/10 rounded px-1.5 py-0.5 text-xs text-slate-200 font-mono"
                />
              </label>
              <label className="flex items-center gap-1 text-[10px] text-slate-500">
                judge ref
                <input
                  value={it.reference}
                  disabled={running}
                  onChange={(e) => setItem(it.id, { reference: e.target.value })}
                  className="w-16 bg-slate-900/60 border border-white/10 rounded px-1.5 py-0.5 text-xs text-cyan-200 font-mono"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Live strip */}
      <div className="rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-xl p-4 mb-4 flex flex-wrap items-center gap-6">
        <BenchMic
          key={modality}
          modality={modality}
          targetWord={captureTarget}
          active={captureActive}
          onResult={handleMicResult}
          onNoSpeech={handleNoSpeech}
        />
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${ctx.isConnected ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-slate-400">{ctx.isConnected ? 'Tutor connected' : 'Tutor not connected'}</span>
          <span className={`ml-3 w-2 h-2 rounded-full ${ctx.isAudioPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-slate-400">{ctx.isAudioPlaying ? 'Tutor speaking' : 'Tutor silent'}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 italic max-w-[16rem] truncate" title={phase}>{phase}</span>
          {running ? (
            <button onClick={stopRun} className="px-4 py-2 rounded-full text-sm bg-rose-500/20 border border-rose-400/40 text-rose-200">
              Stop
            </button>
          ) : (
            <button onClick={() => void startRun()} className="px-4 py-2 rounded-full text-sm bg-cyan-500/20 border border-cyan-400/40 text-cyan-200">
              Start run
            </button>
          )}
          <button
            onClick={() => void copyRun()}
            disabled={rows.length === 0}
            className="px-4 py-2 rounded-full text-sm bg-slate-800/60 border border-white/10 text-slate-300 disabled:opacity-40"
          >
            Copy run JSON
          </button>
        </div>
      </div>

      {/* Summary */}
      {rows.length > 0 && (
        <div className="mb-3 text-xs text-slate-400">
          you-do windows: <span className="text-slate-200">{summary.tests}</span> · matches:{' '}
          <span className="text-emerald-300">{summary.matches}</span>
          {summary.meanCue != null && (
            <> · mean cue→audio: <span className="text-slate-200">{summary.meanCue}ms</span></>
          )}
          {summary.meanFid != null && (
            <> · mean script fidelity: <span className="text-slate-200">{Math.round(summary.meanFid * 100)}%</span></>
          )}
        </div>
      )}

      {/* Beat log */}
      <div className="rounded-2xl bg-slate-900/40 border border-white/10 backdrop-blur-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wide text-[10px] border-b border-white/10">
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Item</th>
              <th className="text-left px-3 py-2">Beat</th>
              <th className="text-left px-3 py-2">Cue→audio</th>
              <th className="text-left px-3 py-2">Audio</th>
              <th className="text-left px-3 py-2">Fidelity</th>
              <th className="text-left px-3 py-2">Heard / said</th>
              <th className="text-left px-3 py-2">Outcome</th>
              <th className="text-left px-3 py-2">Judge</th>
              <th className="text-left px-3 py-2">Resp</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-slate-500">
                  No beats yet — enable the mic, then Start run.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.n} className="border-b border-white/5 align-top">
                <td className="px-3 py-2 text-slate-500">{r.n}</td>
                <td className="px-3 py-2 font-bold text-slate-200">{r.itemId}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      r.beat === 'model' || r.beat === 'guide'
                        ? 'bg-indigo-500/20 text-indigo-200'
                        : r.beat === 'test' || r.beat === 'retest' || r.beat === 'guide-echo'
                          ? 'bg-cyan-500/20 text-cyan-200'
                          : r.beat === 'verify'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {r.beat}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-300">{r.cueToAudioMs != null ? `${r.cueToAudioMs}ms` : '—'}</td>
                <td className="px-3 py-2 text-slate-300">{r.audioMs != null ? `${(r.audioMs / 1000).toFixed(1)}s` : '—'}</td>
                <td className="px-3 py-2">
                  {r.coverage != null ? (
                    <span className={r.coverage >= 0.9 && (r.extras ?? 0) <= 2 ? 'text-emerald-300' : 'text-amber-300'}>
                      {Math.round(r.coverage * 100)}%{(r.extras ?? 0) > 0 ? ` +${r.extras}` : ''}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300 max-w-[18rem]">
                  {r.transcript ? (
                    <span className="text-slate-400 italic">“{r.transcript}”</span>
                  ) : r.heard != null ? (
                    <span className="font-mono">{r.heard}</span>
                  ) : r.outcome ? (
                    <span className="text-slate-600">(nothing heard)</span>
                  ) : (
                    '—'
                  )}
                  {r.note && <div className="text-[10px] text-slate-500">{r.note}</div>}
                </td>
                <td className="px-3 py-2">
                  {r.outcome ? (
                    <span
                      className={
                        r.outcome === 'match'
                          ? 'text-emerald-300'
                          : r.outcome === 'no-match'
                            ? 'text-rose-300'
                            : 'text-slate-400'
                      }
                    >
                      {r.outcome}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {r.judgeEngine ? (
                    <>
                      {r.judgeEngine.startsWith('azure') ? 'azure' : r.judgeEngine}
                      {r.judgeMs != null ? ` · ${r.judgeMs}ms` : ''}
                      {r.escalated ? ' · esc' : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2 text-slate-300">{r.responseMs != null ? `${(r.responseMs / 1000).toFixed(1)}s` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DirectInstructionBench;
