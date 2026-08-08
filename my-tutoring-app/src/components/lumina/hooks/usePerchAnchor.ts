'use client';

/**
 * usePerchAnchor — where on the lesson should Pip be sitting right now?
 *
 * ManifestOrderRenderer already stamps every section with
 * `data-primitive-instance-id` and already resolves which one the student is
 * looking at (nearest the 30%-down focus line, debounced 500ms) into the AI
 * session's `activePrimitiveId`. This hook is the visual half of that same
 * fact: it measures that section and returns the viewport point Pip should be
 * standing on — the card's top-right rim.
 *
 * Reusing the debounced active id is deliberate. Tracking the nearest card on
 * every scroll frame would make Pip twitch between sections; letting it follow
 * the settled choice makes Pip *hop over* once the student lands somewhere,
 * which reads as a decision rather than a jitter.
 *
 * Returns null whenever perching would be worse than the corner dock — no
 * section, card off screen, or a viewport too narrow to give up the space.
 * Callers treat null as "stay docked".
 */

import { useEffect, useState } from 'react';

export interface PerchPoint {
  /** Viewport x of the card's right rim, inset so Pip straddles the corner. */
  x: number;
  /** Viewport y of the rim Pip sits on. */
  y: number;
}

/** Below this the lesson column fills the screen; a perched Pip would sit on the work. */
const MIN_PERCH_WIDTH = 900;
/** The app header is `pt-24`; never ride up underneath it. */
const TOP_SAFE = 96;
/** Keep clear of the docked choice tray in the bottom-right. */
const BOTTOM_SAFE = 210;
/** How far in from the card's right edge Pip plants itself. */
const EDGE_INSET = 28;
/** Never slide below this much above the card's own bottom edge. */
const RIM_MARGIN = 72;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function usePerchAnchor(instanceId: string | null, enabled: boolean): PerchPoint | null {
  const [perch, setPerch] = useState<PerchPoint | null>(null);

  useEffect(() => {
    if (!enabled || !instanceId || typeof document === 'undefined') {
      setPerch(null);
      return;
    }

    let el: HTMLElement | null = null;
    let rafId = 0;
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;

    const find = (): HTMLElement | null => {
      if (el?.isConnected) return el;
      const selector = `[data-primitive-instance-id="${
        typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(instanceId) : instanceId
      }"]`;
      const next = document.querySelector<HTMLElement>(selector);
      if (next && next !== el) {
        if (el) observer?.unobserve(el);
        observer?.observe(next);
      }
      el = next;
      return el;
    };

    const measure = () => {
      rafId = 0;
      const target = find();
      if (!target || window.innerWidth < MIN_PERCH_WIDTH) {
        setPerch(null);
        return;
      }

      const r = target.getBoundingClientRect();
      // Zero-height covers not-yet-laid-out and display:none; the rest is
      // "this card isn't on screen, so there is nothing to sit on".
      if (r.height === 0 || r.bottom < TOP_SAFE || r.top > window.innerHeight - BOTTOM_SAFE) {
        setPerch(null);
        return;
      }

      const x = r.right - EDGE_INSET;
      // Ride the rim while it is in view; inside a tall primitive the rim is
      // scrolled off, so Pip stays near the top of the card that IS in view
      // rather than following it off screen.
      const y = clamp(
        r.top,
        TOP_SAFE,
        Math.max(TOP_SAFE, Math.min(r.bottom - RIM_MARGIN, window.innerHeight - BOTTOM_SAFE)),
      );

      // Sub-pixel churn would re-render the companion on every scroll frame.
      setPerch((prev) =>
        prev && Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - y) < 0.5 ? prev : { x, y },
      );
    };

    function schedule() {
      if (!rafId) rafId = requestAnimationFrame(measure);
    }

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [instanceId, enabled]);

  return perch;
}
