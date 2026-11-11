'use client';

/**
 * The pilot vote (USER 2026-11-11). A pilot canvas passed `canvas-check` but was never played by the user, so when the
 * pilot student finishes one in a lesson they vote: thumbs up promotes it to the library every lesson can use
 * (`/api/lumina/canvas/vote` runs `canvas-check --promote`, which plays every problem again first); thumbs down asks
 * what was wrong and holds the canvas out of lessons until its spec is fixed and checked again.
 *
 * Shown only after the canvas is finished, so it never interrupts the task.
 */
import React, { useState } from 'react';
import { LuminaButton, LuminaChoiceChip, LuminaInput, LuminaPanel } from '../../../../ui';

const REASONS = ['Confusing', 'Too easy', 'Too hard', 'Broken', 'Gives the answer away', 'Not this lesson\'s skill'];

type Phase = 'ask' | 'why' | 'sending' | 'done' | 'error';

export function CanvasPilotVote({ canvasId, studentId, outcome, topic, objective }: {
  canvasId: string;
  studentId: string | null;
  outcome: Record<string, unknown>;
  topic?: string;
  objective?: string;
}) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [reasons, setReasons] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');

  const send = async (vote: 'up' | 'down') => {
    setPhase('sending');
    setMessage(vote === 'up' ? 'Promoting: playing every problem again (about a minute)…' : 'Saving…');
    try {
      const res = await fetch('/api/lumina/canvas/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canvasId, vote, studentId, reasons, note: note.trim() || undefined, outcome, topic, objective }),
      });
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `vote failed (${res.status})`);
      setMessage(body.message ?? 'Saved.');
      setPhase('done');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  return (
    <LuminaPanel accent="amber" className="space-y-3 p-4" data-canvas-pilot-vote="">
      <p className="text-sm text-slate-300">
        Pilot canvas <span className="font-mono text-slate-100">{canvasId}</span>. Should every lesson be able to use it?
      </p>
      {phase === 'ask' && (
        <div className="flex gap-2">
          <LuminaButton tone="primary" onClick={() => send('up')} aria-label="Thumbs up: promote this canvas">👍 Promote</LuminaButton>
          <LuminaButton tone="subtle" onClick={() => setPhase('why')} aria-label="Thumbs down: hold this canvas">👎 Hold it</LuminaButton>
        </div>
      )}
      {phase === 'why' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {REASONS.map(r => (
              <LuminaChoiceChip key={r} label={r} accent="amber" selected={reasons.includes(r)}
                onClick={() => setReasons(rs => (rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r]))} />
            ))}
          </div>
          <LuminaInput className="w-full" placeholder="What should change? (optional)" value={note} onChange={e => setNote(e.target.value)} />
          <div className="flex gap-2">
            <LuminaButton tone="primary" onClick={() => send('down')} disabled={!reasons.length && !note.trim()}>Send</LuminaButton>
            <LuminaButton tone="subtle" onClick={() => setPhase('ask')}>Back</LuminaButton>
          </div>
        </div>
      )}
      {phase !== 'ask' && phase !== 'why' && (
        <p className={phase === 'error' ? 'text-sm text-rose-300' : 'text-sm text-slate-300'}>{message}</p>
      )}
    </LuminaPanel>
  );
}
