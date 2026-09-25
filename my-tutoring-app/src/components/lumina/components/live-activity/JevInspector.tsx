'use client';
import React, { useSyncExternalStore } from 'react';
import type { LiveLessonRuntime } from './runtime/LiveLessonRuntime';
import { useRuntimeSnapshot } from './runtime/LiveRuntimeContext';

export default function JevInspector({ runtime }: { runtime: LiveLessonRuntime }) {
  const entries = useSyncExternalStore(runtime.trace.subscribe, runtime.trace.getSnapshot, runtime.trace.getSnapshot);
  const state = useRuntimeSnapshot(runtime);
  // Read at render: elapsed seconds are as fresh as the last runtime publish, which is also what the tutor last received.
  const signals = runtime.learner.read(state);
  return <details open className="rounded-xl border border-cyan-900 p-4" data-testid="jev-inspector">
    <summary className="cursor-pointer font-semibold">JEV inspector</summary>
    <p className="mt-2 text-xs text-slate-400">Live inputs and decisions from this browser session. Decisions require 90% selected-option probability. Model scores are not guarantees.</p>
    <div className="mt-3 text-sm" aria-live="polite">
      <p>Activity: {state.task?.itemId ?? 'not mounted'} · {state.task?.phase ?? state.status}</p>
      <p>Recorded verdict: {state.task?.evidence.correctness ?? 'none'}</p>
      {state.task && <p className="break-words text-slate-300">Assignment: {state.task.task}</p>}
      {state.task?.workspace?.expectedAnswer !== undefined && <p>Expected final answer: {state.task.workspace.expectedAnswer}</p>}
      {state.task?.workspace?.lastResponse && <p className="break-words text-slate-300">Recorded response: {state.task.workspace.lastResponse.response}</p>}
      {signals && <dl className="mt-2 grid grid-cols-2 gap-x-3 border-t border-slate-700 pt-2 text-xs text-slate-300" data-testid="learner-signals">
        <dt className="col-span-2 font-semibold text-slate-200">Learner signals{state.task?.workspace?.progression ? ' (sent to the tutor)' : ' (not sent: not a shared-workspace binding)'}</dt>
        {Object.entries(signals).filter(([key]) => key !== 'itemId').map(([key, value]) =>
          <React.Fragment key={key}><dt>{key}</dt><dd>{value === null ? 'n/a' : String(value)}</dd></React.Fragment>)}
      </dl>}
    </div>
    {!entries.length && <p className="mt-3 text-sm text-slate-400">No learner answer or JEV request recorded yet.</p>}
    <ol className="mt-3 max-h-[32rem] space-y-3 overflow-y-auto text-xs">
      {[...entries].reverse().map(entry => {
        const result = entry.result as Record<string, any> | undefined;
        const input = entry.input as Record<string, any> | undefined;
        const answers = result?.assessment?.answers as Record<string, any> | undefined;
        const assessed = !['waiting', 'observing', 'skipped', 'cancelled'].includes(entry.status);
        return <li key={entry.id} className="rounded border border-slate-700 p-3">
          <p className="font-semibold">{entry.stage === 'learner_response' ? 'Learner context' : entry.stage === 'learner_intent' ? 'Observe learner turn' : 'Observe tutor reply'}: {entry.status}</p>
          <time className="text-slate-500">{new Date(entry.at).toLocaleTimeString()}</time>
          {(input?.scope?.itemId || result?.scope?.itemId) && <p>Item: {input?.scope?.itemId || result?.scope?.itemId}</p>}
          {entry.reason && <p className="mt-1 break-words">{entry.reason}</p>}
          {result?.runtimeReason && <p className="mt-1 break-words">{result.runtimeReason}</p>}
          {(input?.utterance || input?.learner) && <p className="mt-2 break-words">Learner: {input.utterance || input.learner}</p>}
          {input?.tutor && <p className="mt-1 break-words">Tutor: {input.tutor}</p>}
          {assessed && typeof result?.confidence === 'number' && <p>Transition probability: {result.confidence.toFixed(2)}{typeof result.ms === 'number' ? ` · ${result.ms} ms` : ''}</p>}
          {assessed && result?.transition && <p>Verdict: {result.verdict} · Transition: {result.transition}</p>}
          {result?.selectedText && <p>Selected answer: {result.selectedText} · Activity check: {result.correct === true ? 'correct' : result.correct === false ? 'incorrect' : 'not checked'}</p>}
          {answers && <dl className="mt-2 space-y-1 border-t border-slate-700 pt-2">
            {Object.entries(answers).map(([question, answer]) => <div key={question} className="flex flex-wrap justify-between gap-x-2">
              <dt>{({ response: 'Answer selection', verdict: 'Whole-task verdict', feedback: 'Feedback', transition: 'Transition' } as Record<string, string>)[question] ?? question}</dt>
              <dd>{typeof answer.noul === 'number' ? `${Math.round(answer.noul * 100)}% yes` : <>{answer.choice ?? 'unknown'} · {typeof answer.probabilities?.[answer.choice] === 'number'
                ? `${Math.round(answer.probabilities[answer.choice] * 100)}% probability` : 'no probability'}
                {typeof answer.confidence === 'number' ? ` · ${Math.round(answer.confidence * 100)}% model confidence` : ''}</>}</dd>
            </div>)}
          </dl>}
          {result?.assessment?.state && <details className="mt-2"><summary className="cursor-pointer text-cyan-300">Exact JEV model input</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-slate-300">{JSON.stringify(result.assessment.state, null, 2)}</pre></details>}
          {entry.input !== undefined && <details className="mt-2"><summary className="cursor-pointer text-cyan-300">Exact input considered</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-slate-300">{JSON.stringify(entry.input, null, 2)}</pre></details>}
          {entry.result !== undefined && <details className="mt-2"><summary className="cursor-pointer text-cyan-300">Result and runtime disposition</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all text-slate-300">{JSON.stringify(entry.result, null, 2)}</pre></details>}
        </li>;
      })}
    </ol>
  </details>;
}
