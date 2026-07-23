'use client';

/**
 * useVoiceViewportGate — the mic may only be live while the primitive is in
 * the viewing window.
 *
 * Voice primitives auto-arm their mic on mount (useVoiceCapture autoStart).
 * In a scrolling lesson that meant a Knowledge Check mounted below the fold
 * could capture the student chatting with the tutor at the top of the page,
 * judge the utterance against its on-screen options, and grade a question the
 * student never saw. This hook is the shared presence gate: attach `ref` to
 * the primitive's root and AND `inView` into the voice `active` / eligible
 * flag.
 *
 * Semantics:
 *  - Complements, never replaces, the open-mic doctrine: while the primitive
 *    is on screen the mic stays persistently hot; scrolled away = the student
 *    walked away from this surface, so its session closes. Scrolling back
 *    re-arms via the engine's autoStart off→on fresh-activation rule
 *    (useVoiceCapture) — no extra wiring.
 *  - Hysteresis so a slow scroll at the boundary doesn't flap the mic: arm
 *    when a solid chunk is visible, release only when it's nearly gone.
 *  - A primitive taller than the viewport can never reach a high intersection
 *    RATIO, so "fills a good share of the viewport" also arms.
 *  - No IntersectionObserver (legacy browser) ⇒ fail open: voice stays
 *    usable, we just lose the scroll gate.
 */

import { useEffect, useRef, useState } from 'react';

const ARM_RATIO = 0.25; // ≥25% of the element visible…
const ARM_VIEWPORT_SHARE = 0.4; // …or it fills ≥40% of the viewport
const RELEASE_RATIO = 0.08; // hysteresis: release only when nearly gone
const RELEASE_VIEWPORT_SHARE = 0.15;
const THRESHOLDS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.75, 1];

export function useVoiceViewportGate<T extends Element = HTMLDivElement>(): {
  ref: React.MutableRefObject<T | null>;
  inView: boolean;
} {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Optional-chained: test doubles often pass bare {isIntersecting} entries.
        const viewportH = entry.rootBounds?.height ?? window.innerHeight ?? 1;
        const share = (entry.intersectionRect?.height ?? 0) / Math.max(1, viewportH);
        const ratio = entry.intersectionRatio ?? 1;
        setInView((prev) => {
          if (!entry.isIntersecting) return false;
          if (prev) return ratio >= RELEASE_RATIO || share >= RELEASE_VIEWPORT_SHARE;
          return ratio >= ARM_RATIO || share >= ARM_VIEWPORT_SHARE;
        });
      },
      { threshold: THRESHOLDS },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}
