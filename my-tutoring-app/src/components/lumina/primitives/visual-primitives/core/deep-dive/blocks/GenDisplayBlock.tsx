'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { GenDisplayBlockData } from '../types';

/**
 * A generated display (service/gen-display) as a DeepDive section. The page runs in an iframe with
 * `sandbox="allow-scripts"` only: an opaque origin with no cookies, storage or app state, and its
 * CSP allows no network. It reports its height, its scene and any error by postMessage; a display
 * that reports an error is hidden rather than shown broken. Ungraded.
 */
const GenDisplayBlock: React.FC<{ data: GenDisplayBlockData; onScene?: (facts: unknown) => void }> = ({ data, onScene }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const [failed, setFailed] = useState(false);
  const sceneRef = useRef(onScene);
  sceneRef.current = onScene;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      // Only this block's own frame; the sandboxed page has an opaque ("null") origin.
      if (e.source !== frame.current?.contentWindow) return;
      const msg = e.data as { source?: string; kind?: string; data?: unknown } | null;
      if (msg?.source !== 'lumina-display') return;
      if (msg.kind === 'height' && typeof msg.data === 'number') setHeight(Math.min(1600, Math.max(120, Math.ceil(msg.data))));
      else if (msg.kind === 'error') { console.warn(`[GenDisplay] ${data.displayId} reported an error:`, msg.data); setFailed(true); }
      else if (msg.kind === 'scene') sceneRef.current?.(msg.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [data.displayId]);

  if (failed) return null;
  return (
    <iframe
      ref={frame}
      title={data.label}
      srcDoc={data.html}
      sandbox="allow-scripts"
      data-deep-dive-display={data.displayId}
      className="block w-full rounded-2xl border-0 bg-transparent"
      style={{ height }}
    />
  );
};

export default GenDisplayBlock;
