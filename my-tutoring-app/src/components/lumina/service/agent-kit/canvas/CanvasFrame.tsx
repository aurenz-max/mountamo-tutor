'use client';

/**
 * A canvas page in its frame, for any host (the agent-canvas primitive, the canvas tester). The page runs with
 * `sandbox="allow-scripts"` only: an opaque origin with no cookies, storage or app state, and its CSP allows no
 * network. Everything the host learns comes by postMessage from this frame alone: whether the goal is met, the scene
 * facts, what the child's hands did (`act`, posted by the page shell in `gen-display/document.ts`), and errors.
 *
 * Next problem without a reload (DI canvas kit item 4, 11-15): when several problems share one program, the host
 * passes `swap` and the frame keeps its page. A new problem, or Start over, posts the problem's params to the page,
 * which mounts the program fresh with them (`kind: 'params'` in the page shell). Only a page whose shell takes params
 * is given `swap` (`acceptsParams`); an older saved page is reloaded per problem as before.
 */
import React, { useEffect, useRef, useState } from 'react';

/** A tap on a named element or button, or a drag that ended somewhere else. */
export interface CanvasAct { type: 'tap' | 'drop'; id: string | null; to?: string | null }

/** The page shell's marker for taking params by message (`gen-display/document.ts`). */
export const PARAMS_MESSAGE = 'lumina-host';
/** True when a page's shell mounts a new problem from posted params. */
export const acceptsParams = (page: string | undefined): boolean => !!page && page.includes(PARAMS_MESSAGE);

export interface CanvasFrameProps {
  html: string;
  title: string;
  /** Change it to load the page fresh (Start over, a new item). With `swap`, it remounts the program instead. */
  run?: number;
  /**
   * Several problems on one page: `bakedId` is the problem whose params `html` was built with; `id` and `params` are
   * the problem to show now. The frame posts them when they differ from what the page shows.
   */
  swap?: { id: string; params: Record<string, unknown>; bakedId: string };
  /** True while the child may not act: a transparent cover takes the pointer. */
  locked?: boolean;
  onGoal?: (met: boolean) => void;
  onScene?: (facts: unknown) => void;
  onAct?: (act: CanvasAct) => void;
  onError?: (message: string) => void;
}

export const CanvasFrame: React.FC<CanvasFrameProps> = ({ html, title, run = 0, swap, locked, onGoal, onScene, onAct, onError }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(520);
  const handlers = useRef({ onGoal, onScene, onAct, onError });
  handlers.current = { onGoal, onScene, onAct, onError };
  // With `swap` the page loads once; what it shows is tracked as `<problem id>#<run>`.
  const firstRun = useRef(run);
  const [loaded, setLoaded] = useState(false);
  const shown = useRef<string | null>(null);

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

  const want = swap ? `${swap.id}#${run}` : null;
  useEffect(() => {
    if (!swap || !loaded || want === shown.current) return;
    shown.current = want;
    frame.current?.contentWindow?.postMessage({ source: PARAMS_MESSAGE, kind: 'params', data: swap.params }, '*');
    // `swap` is read through `want`: a new problem id or a new run is what posts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, loaded]);

  const onLoad = () => {
    if (!swap) return;
    shown.current = `${swap.bakedId}#${firstRun.current}`;
    setLoaded(true);
  };

  return (
    <div className="relative mx-auto" style={{ maxWidth: 744 }}>
      <iframe key={swap ? 'swap' : run} ref={frame} title={title} srcDoc={html} sandbox="allow-scripts" data-canvas-frame=""
        onLoad={onLoad} className="block w-full rounded-2xl border-0 bg-transparent" style={{ height }} />
      {locked && <div className="absolute inset-0" aria-hidden="true" />}
    </div>
  );
};

export default CanvasFrame;
