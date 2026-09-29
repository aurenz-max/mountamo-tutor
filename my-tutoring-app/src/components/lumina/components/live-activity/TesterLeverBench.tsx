'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LiveLessonRuntime } from './runtime/LiveLessonRuntime';
import { LiveRuntimeActiveContext, LiveRuntimeContext, useRuntimeSnapshot } from './runtime/LiveRuntimeContext';
import { LiveRuntimeSurface } from './runtime/LiveRuntimeSurface';
import { RuntimeTransport } from './runtime/runtimeTransport';
import { leverTrigger } from './runtime/observerLever';
import type { RuntimeSnapshot, WorkspaceLever } from './runtime/contract';
import type { LessonWorkspaceItem } from './lessonWorkspacePlan';
import { getComponentById } from '../../service/manifest/catalog';

/** One line of what the host did or would have told the tutor. */
interface BenchEntry { at: number; kind: 'pull' | 'tutor' | 'result' | 'progress'; text: string }

type Workspace = NonNullable<NonNullable<RuntimeSnapshot['task']>['workspace']>;
type Attempt = Workspace['attempts'][number];

/**
 * The tester's no-model host for a bound primitive: the real runtime, the real transport and the real
 * lever ladder, with no Live session. You play the item yourself; your wrong answers commit through the
 * primitive's own check, and the transport pulls levers exactly as it does in a lesson (second wrong pulls
 * help, a wrong with help on screen pulls simplify). What the tutor would have been told lands in the log
 * instead of a socket. Nothing here costs a Live session or writes a learning record.
 */
export function TesterLeverBench({ binding, children }: { binding: LessonWorkspaceItem; children: React.ReactNode }) {
  const runtime = useMemo(() => new LiveLessonRuntime(`tester-bench-${binding.instanceId}`,
    { maxSupportLevel: 3, allowAnswerExposure: true, allowSupportArtifacts: false }), [binding.instanceId]);
  const [log, setLog] = useState<BenchEntry[]>([]);
  const transport = useRef<RuntimeTransport | null>(null);
  const push = (entry: Omit<BenchEntry, 'at'>) => setLog(l => [...l, { ...entry, at: Date.now() }].slice(-60));
  useLayoutEffect(() => {
    const t = new RuntimeTransport(runtime, message => {
      if (message.type === 'text') push({ kind: 'tutor', text: String(message.content) });
      else if (message.type === 'runtime_result') push({ kind: 'result', text: `${message.status}${message.reason ? `: ${message.reason}` : ''}` });
    });
    transport.current = t;
    // The ladder's own pulls, as they land. The tutor message for one waits for a tutor reply that never
    // comes here, so it follows AFTER_TURN_FALLBACK_MS later.
    let seen = runtime.trace.getSnapshot().at(-1)?.id ?? 0;
    const off = runtime.trace.subscribe(() => {
      for (const e of runtime.trace.getSnapshot()) if (e.id > seen) {
        seen = e.id;
        if (e.stage === 'observer_lever') push({ kind: 'pull', text: `Ladder (${e.status}): ${e.reason}` });
      }
    });
    return () => { off(); t.close(); transport.current = null; };
  }, [runtime]);
  const learnerProgress = useMemo(() => ({ disabled: false, act: (type: 'advance' | 'retry') => {
    push({ kind: 'progress', text: type === 'retry' ? 'Learner: Try again' : 'Learner: Next challenge' });
    void transport.current?.learnerProgress(type);
  } }), []);
  return <LiveRuntimeContext.Provider value={runtime}>
    <LiveRuntimeActiveContext.Provider value={true}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <LiveRuntimeSurface runtime={runtime} learnerProgress={learnerProgress}>{children}</LiveRuntimeSurface>
        </div>
        <LeverPanel runtime={runtime} binding={binding} transport={transport} log={log} push={push} clearLog={() => setLog([])} />
      </div>
    </LiveRuntimeActiveContext.Provider>
  </LiveRuntimeContext.Provider>;
}

function LeverPanel({ runtime, binding, transport, log, push, clearLog }: {
  runtime: LiveLessonRuntime; binding: LessonWorkspaceItem; transport: React.MutableRefObject<RuntimeTransport | null>;
  log: BenchEntry[]; push: (e: Omit<BenchEntry, 'at'>) => void; clearLog: () => void;
}) {
  const state = useRuntimeSnapshot(runtime);
  const task = state.task, ws = task?.workspace;
  const levers = ws?.levers ?? [];
  const entry = getComponentById(binding.primitiveId)?.teachingWorkspace;
  const mode = binding.evalMode;
  const misses = entry?.misses?.[mode] ?? [];
  const unanswered = entry?.unanswered?.[mode] ?? [];
  const itemAttempts = ws?.attempts.filter(a => a.itemId === task?.itemId) ?? [];
  const wrongs = itemAttempts.filter(a => !a.correct && !a.practice).length;

  // Levers already pulled when the item first appeared are the tier's starting presentation, not a pull.
  const startPulled = useRef(new Map<string, Set<string>>());
  if (task && ws && !startPulled.current.has(task.itemId))
    startPulled.current.set(task.itemId, new Set(levers.filter(l => l.pulled).map(l => l.id)));
  const tierStart = task ? startPulled.current.get(task.itemId) ?? new Set<string>() : new Set<string>();

  const onNextWrong = predictNextWrong(state, tierStart);
  const onStuck = leverTrigger(state, 'help');

  const pull = (lever: string) => {
    const t = transport.current;
    if (!t || !task || !state.instanceId) return;
    push({ kind: 'pull', text: `You pulled ${lever}` });
    void t.command({ sessionEpoch: state.sessionEpoch, commandId: `bench:${crypto.randomUUID()}`, instanceId: state.instanceId,
      itemId: task.itemId, expectedRevision: state.revision, action: { type: 'workspace', operation: 'pull_lever', input: { lever } } });
  };
  const stuck = () => {
    if (!onStuck) push({ kind: 'pull', text: `Learner said "I'm stuck": the ladder has nothing to pull` });
    void transport.current?.pullLever('help');
  };
  const canPull = state.affordances.some(a => a.action.type === 'workspace' && a.action.operation === 'pull_lever');

  return <aside aria-label="Lever bench" className="space-y-4 rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4 text-sm text-slate-200">
    <div>
      <h4 className="text-base font-bold text-cyan-200">Lever bench (offline, no tutor)</h4>
      <p className="text-xs text-slate-400">Play the item. Wrong answers run the real ladder; the log shows what the tutor would be told.</p>
    </div>

    <div className="grid grid-cols-2 gap-2 text-xs">
      <Fact label="Mode" value={mode} />
      <Fact label="Item" value={task?.itemId ?? '—'} />
      <Fact label="Wrong tries on item" value={String(wrongs)} />
      <Fact label="Runtime" value={state.status} />
    </div>

    {ws?.practice && <div data-bench-practice className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 p-2 text-emerald-200">
      Easier practice item on screen (ungraded). Returns to <code>{ws.practice.returnsTo}</code> when solved.
    </div>}

    <section className="space-y-2">
      <h5 className="font-semibold text-slate-300">What the ladder does next</h5>
      <p data-bench-next-wrong>Next wrong answer: <b className="text-amber-200">{onNextWrong.lever ?? 'pulls nothing'}</b>
        {onNextWrong.why && <span className="text-slate-400"> ({onNextWrong.why})</span>}</p>
      <p>&quot;I&apos;m stuck&quot; now: <b className="text-amber-200">{onStuck ?? 'pulls nothing'}</b></p>
      <button type="button" onClick={stuck} disabled={!task}
        className="rounded-lg border border-amber-400/60 px-3 py-1.5 text-amber-200 hover:bg-amber-500/10 disabled:opacity-40">
        Say &quot;I&apos;m stuck&quot;
      </button>
    </section>

    <section className="space-y-2">
      <h5 className="font-semibold text-slate-300">Levers on this item</h5>
      {!levers.length && <p className="text-slate-400">This item declares no levers.</p>}
      {levers.map(l => <LeverRow key={l.id} lever={l} tierStart={tierStart.has(l.id)} canPull={canPull} onPull={() => pull(l.id)} />)}
    </section>

    <section className="space-y-2">
      <h5 className="font-semibold text-slate-300">Miss map ({mode})</h5>
      {ws?.practice ? <p className="text-slate-400">Practice item: no levers until the full item comes back.</p>
        : !misses.length ? <p className="text-slate-400">The catalog lists no misses for this mode.</p> :
        <table className="w-full text-xs">
          <thead><tr className="text-left text-slate-400"><th className="py-1">Miss</th><th>Answered by</th><th /></tr></thead>
          <tbody>{misses.map(m => {
            const by = levers.filter(l => l.answers?.includes(m));
            const lastSeen = itemAttempts.some(a => a.miss === m);
            return <tr key={m} data-bench-miss={m} className={`border-t border-slate-700/60 ${lastSeen ? 'text-amber-200' : ''}`}>
              <td className="py-1 pr-2 font-mono">{m}{lastSeen && ' ●'}</td>
              <td className="pr-2">{by.length ? by.map(l => `${l.id} (${l.kind})`).join(', ')
                : unanswered.includes(m) ? <span className="text-slate-400">unanswered by decision</span>
                : <span className="text-rose-300">no lever on this item</span>}</td>
              <td>{by.filter(l => !l.pulled).slice(0, 1).map(l => <button key={l.id} type="button" disabled={!canPull} onClick={() => pull(l.id)}
                className="rounded border border-cyan-500/50 px-2 py-0.5 text-cyan-200 disabled:opacity-40">Pull</button>)}</td>
            </tr>;
          })}</tbody>
        </table>}
    </section>

    <section className="space-y-1">
      <h5 className="font-semibold text-slate-300">Attempts on this item</h5>
      {!itemAttempts.length && <p className="text-slate-400">None yet.</p>}
      {itemAttempts.map((a, i) => <AttemptRow key={i} attempt={a} />)}
    </section>

    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-slate-300">Log</h5>
        <button type="button" onClick={clearLog} className="text-xs text-slate-400 underline">clear</button>
      </div>
      <ol data-bench-log className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {log.map((e, i) => <li key={i} className={e.kind === 'tutor' ? 'text-violet-200' : e.kind === 'pull' ? 'text-amber-200' : 'text-slate-400'}>
          <span className="uppercase text-slate-500">{e.kind === 'tutor' ? 'to tutor' : e.kind}</span> {e.text}
        </li>)}
      </ol>
    </section>
  </aside>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-800/60 px-2 py-1"><div className="text-slate-500">{label}</div><div className="truncate font-mono">{value}</div></div>;
}

function LeverRow({ lever, tierStart, canPull, onPull }: { lever: WorkspaceLever; tierStart: boolean; canPull: boolean; onPull: () => void }) {
  return <div data-bench-lever={lever.id} className={`rounded-lg border p-2 ${lever.pulled ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-700'}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono">{lever.id} <span className={lever.kind === 'simplify' ? 'text-violet-300' : 'text-cyan-300'}>{lever.kind}</span></span>
      {lever.pulled ? <span className="text-xs text-emerald-300">{tierStart ? 'on at start (tier)' : 'pulled'}</span>
        : <button type="button" onClick={onPull} disabled={!canPull}
          className="rounded border border-cyan-500/50 px-2 py-0.5 text-xs text-cyan-200 disabled:opacity-40">Pull</button>}
    </div>
    <p className="mt-1 text-xs text-slate-400">When: {lever.when}</p>
    <p className="text-xs text-slate-400">Does: {lever.does}</p>
    {!!lever.answers?.length && <p className="text-xs text-slate-500">Answers: {lever.answers.join(', ')}</p>}
  </div>;
}

function AttemptRow({ attempt: a }: { attempt: Attempt }) {
  return <p className="text-xs">
    <span className={a.correct ? 'text-emerald-300' : 'text-rose-300'}>{a.correct ? 'right' : 'wrong'}</span>
    {' '}<span className="font-mono">{a.response}</span>
    {a.miss && <span className="text-amber-200"> · miss {a.miss}</span>}
    {a.practice && <span className="text-emerald-300"> · practice</span>}
    {!!a.levers?.length && <span className="text-slate-400"> · with {a.levers.join(', ')}</span>}
  </p>;
}

/**
 * What the ladder would pull if the learner answered this item wrong right now: `leverTrigger` on the
 * snapshot plus one more wrong attempt, made with the levers pulled since the item appeared (a tier's
 * starting help is not a pull). A preview only; the real pull runs in the transport on the real attempt.
 */
function predictNextWrong(state: RuntimeSnapshot, tierStart: Set<string>): { lever: string | null; why?: string } {
  const task = state.task, ws = task?.workspace;
  if (ws?.practice) return { lever: null, why: 'practice item: the ladder does not run' };
  if (!task || !ws?.levers?.length) return { lever: null };
  const pulledNow = ws.levers.filter(l => l.pulled && !tierStart.has(l.id)).map(l => l.id);
  const next: Attempt = { itemId: task.itemId, response: '?', source: 'gesture', correct: false, assisted: pulledNow.length > 0,
    answerExposure: 'none', levers: pulledNow };
  const hypothetical: RuntimeSnapshot = { ...state, task: { ...task, workspace: { ...ws, attempts: [...ws.attempts, next] } } };
  const lever = leverTrigger(hypothetical, 'wrong');
  const wrongs = ws.attempts.filter(a => a.itemId === task.itemId && !a.correct && !a.practice).length + 1;
  const helpOn = pulledNow.some(id => ws.levers!.find(l => l.id === id)?.kind === 'help');
  const why = helpOn ? 'wrong with help on screen → simplify' : wrongs >= 2 ? `wrong #${wrongs} → help` : 'first wrong → nothing, tutor answers the miss';
  return { lever, why };
}
