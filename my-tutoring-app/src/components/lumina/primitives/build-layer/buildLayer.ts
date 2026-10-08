'use client';

/**
 * The open-build layer, shared by every primitive with a build mode (`/add-eval-modes`
 * references/build-mode.md). A build mode hands the learner an empty scene and an unlimited supply,
 * and they MAKE the thing instead of answering about a thing we drew. Three pieces make it live:
 *
 *  1. `svgPicture` — the build as a PNG, from the same svg the learner sees, so whatever looks at
 *     it sees exactly what the learner sees. Building aids carry `data-aid` and are left out.
 *  2. `useBuildWatcher` — once the learner pauses, flash-lite says one line about what the build
 *     looks like so far (Annotated Example's Try It pattern). Never a verdict, never advice, and on
 *     a counting or measuring build never a number: saying the number would do the skill for them.
 *  3. The check at "I'm done!" is the primitive's own: code where the property is computable (a
 *     count, a length, an area), flash-latest vision only for what code cannot read (does it look
 *     like a bridge). Neither lives here.
 */
import { useEffect, useRef, useState } from 'react';

/** The svg as a PNG (base64, no data: prefix), sized from its viewBox. Emoji text is drawn by the browser's own font. */
export async function svgPicture(svg: SVGSVGElement, scale = 1): Promise<string> {
  const vb = svg.viewBox.baseVal;
  const w = Math.round((vb?.width || svg.clientWidth || 480) * scale), h = Math.round((vb?.height || svg.clientHeight || 320) * scale);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('[data-aid]').forEach(n => n.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('build picture failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface BuildWatchRequest {
  /** What the learner was asked to make, as they heard it. */
  task: string;
  /** The scenery the learner did not build, in words. */
  sceneNote: string;
  /** 'never' on any build whose skill is a number (counting, measuring): the watcher may not say one. */
  numbers: 'allowed' | 'never';
  /** Words the line may never use, such as shape names where naming the shape can be the skill. */
  neverSay?: readonly string[];
}

/** Quiet time after the last change before the watcher looks (Try It uses 1500 ms for strokes). */
export const WATCH_DEBOUNCE_MS = 1200;

/**
 * One live line about the build, refreshed when the learner pauses. `buildKey` changes whenever the
 * build does; a reply for an older build is dropped. Off while `enabled` is false (checking, solved,
 * an empty scene). A failed look is silent: the line is extra and never blocks building.
 */
export function useBuildWatcher(opts: {
  buildKey: string;
  enabled: boolean;
  svg: React.RefObject<SVGSVGElement | null>;
  request: BuildWatchRequest;
}): string {
  const { buildKey, enabled, svg, request } = opts;
  const [seeing, setSeeing] = useState('');
  const gen = useRef(0);
  const req = useRef(request);
  req.current = request;
  useEffect(() => {
    const mine = ++gen.current;
    if (!enabled) { setSeeing(''); return; }
    const timer = setTimeout(async () => {
      if (!svg.current) return;
      try {
        const image = await svgPicture(svg.current);
        const res = await fetch('/api/lumina', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'watchBuild', params: { ...req.current, image } }),
        });
        if (!res.ok) return;
        const line = String(((await res.json()) as { seeing?: string }).seeing ?? '');
        if (mine === gen.current && line) setSeeing(line);
      } catch { /* the live line is extra */ }
    }, WATCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [buildKey, enabled, svg]);
  return seeing;
}
