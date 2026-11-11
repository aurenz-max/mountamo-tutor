'use client';

/**
 * A canvas page in its frame, for any host (the agent-canvas primitive, the canvas tester). The page runs with
 * `sandbox="allow-scripts"` only: an opaque origin with no cookies, storage or app state, and its CSP allows no
 * network. Everything the host learns comes by postMessage from this frame alone: whether the goal is met, the scene
 * facts, what the child's hands did (`act`, posted by the page shell in `gen-display/document.ts`), and errors.
 */
import React, { useEffect, useRef, useState } from 'react';

/** A tap on a named element or button, or a drag that ended somewhere else. */
export interface CanvasAct { type: 'tap' | 'drop'; id: string | null; to?: string | null }

export interface CanvasFrameProps {
  html: string;
  title: string;
  /** Change it to load the page fresh (Start over, a new item). */
  run?: number;
  /** True while the child may not act: a transparent cover takes the pointer. */
  locked?: boolean;
  onGoal?: (met: boolean) => void;
  onScene?: (facts: unknown) => void;
  onAct?: (act: CanvasAct) => void;
  onError?: (message: string) => void;
}

export const CanvasFrame: React.FC<CanvasFrameProps> = ({ html, title, run = 0, locked, onGoal, onScene, onAct, onError }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(520);
  const handlers = useRef({ onGoal, onScene, onAct, onError });
  handlers.current = { onGoal, onScene, onAct, onError };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only this frame; the sandboxed page has an opaque origin.
      if (e.source !== frame.current?.contentWindow) return;
      const msg = e.data as { source?: string; kind?: string; data?: unknown } | null;
      if (msg?.source !== 'lumina-display') return;
      const h = handlers.current;
      if (msg.kind === 'height' && typeof msg.data === 'number') setHeight(Math.min(1400, Math.max(160, Math.ceil(msg.data))));
      else if (msg.kind === 'goal') h.onGoal?.(msg.data === true);
      else if (msg.kind === 'scene') h.onScene?.(msg.data);
      else if (msg.kind === 'act' && msg.data && typeof msg.data === 'object') h.onAct?.(msg.data as CanvasAct);
      else if (msg.kind === 'error') h.onError?.(String(msg.data));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div className="relative mx-auto" style={{ maxWidth: 744 }}>
      <iframe key={run} ref={frame} title={title} srcDoc={html} sandbox="allow-scripts" data-canvas-frame=""
        className="block w-full rounded-2xl border-0 bg-transparent" style={{ height }} />
      {locked && <div className="absolute inset-0" aria-hidden="true" />}
    </div>
  );
};

export default CanvasFrame;
