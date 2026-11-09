'use client';

/**
 * What an agent author is doing while it runs, for the testers: the stream reader for a `stream: true` generation and
 * the live view of its steps (`service/agent-kit/trace.ts`).
 */
import React from 'react';
import type { KitEvent } from '../service/agent-kit/trace';

const LEVEL_TEXT: Record<KitEvent['level'], string> = { info: 'text-slate-300', warn: 'text-amber-200', error: 'text-rose-300' };

export const EventLine: React.FC<{ event: KitEvent }> = ({ event }) => (
  <li className={`break-words ${LEVEL_TEXT[event.level]}`}>
    <span className="text-slate-500 tabular-nums">+{event.seconds}s</span>{' '}
    {event.item ? <span className="text-cyan-300">item {event.item} </span> : null}
    {event.text}
  </li>
);

/** The run so far: one row per item with its latest step, then every step, newest first. */
export const RunProgress: React.FC<{ events: KitEvent[]; elapsed: number }> = ({ events, elapsed }) => {
  const latest = new Map<number, KitEvent>();
  events.forEach(e => { if (e.item) latest.set(e.item, e); });
  const last = events[events.length - 1];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 text-left text-xs">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 shrink-0 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-sm text-slate-200 tabular-nums">{elapsed}s · about ${(last?.costUsd ?? 0).toFixed(2)} · {last ? `no update for ${Math.max(0, elapsed - last.seconds)}s` : 'starting'}</p>
      </div>
      {latest.size > 0 && (
        <ul className="space-y-1">
          {Array.from(latest.entries()).sort(([a], [b]) => a - b).map(([n, e]) => (
            <li key={n} className={`rounded-lg border border-slate-700 bg-slate-900/40 px-2 py-1 break-words ${LEVEL_TEXT[e.level]}`}>
              <span className="text-cyan-300">Item {n}</span> · {e.stage} · {e.text}
            </li>
          ))}
        </ul>
      )}
      <ol className="space-y-1">{[...events].reverse().map((e, i) => <EventLine key={events.length - i} event={e} />)}</ol>
    </div>
  );
};

/** Read a streamed generation: each step goes to `onEvent`; resolves with the result, rejects with the run's error. */
export async function readKitStream<T>(response: Response, onEvent: (event: KitEvent) => void): Promise<T> {
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${response.statusText}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | undefined;
  const readLine = (line: string) => {
    if (!line.trim()) return;
    const message = JSON.parse(line) as { type: 'progress'; event: KitEvent } | { type: 'result'; result: T } | { type: 'error'; error: string };
    if (message.type === 'progress') onEvent(message.event);
    else if (message.type === 'error') throw new Error(message.error);
    else result = message.result;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(readLine);
  }
  readLine(buffer);
  if (result === undefined) throw new Error('The stream ended before a result arrived');
  return result;
}
