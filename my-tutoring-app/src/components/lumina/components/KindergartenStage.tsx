'use client';

/**
 * KindergartenStage — full-bleed, on-rails lesson presentation for pre-readers.
 *
 * Replaces the scrolling ManifestOrderRenderer for Kindergarten lessons: ONE
 * section at a time, animated frame transitions, and advancement gated on
 * completing the section (evaluable primitives) or a short dwell (display
 * sections). Navigation is a single wordless arrow — no text a pre-reader
 * must decode, no section headers, no objective badges, no adult chrome
 * (pre-reader contract, reader-fit Audit C).
 *
 * The Gemini Live tutor session is per-exhibit (owned by LuminaAIProvider in
 * LessonScreen), so mounting one section at a time is safe: on each advance we
 * call switchPrimitive on the SAME socket and fire a silent [SECTION_START]
 * nudge so the tutor orients the child by voice — mirroring CuratorBrief's
 * [READ_SECTION] and DeepDive's [DEEP_DIVE_START] patterns. The FIRST section
 * is deliberately NOT nudged: the lesson greeting covers it, and auto-firing
 * on mount races the greeting (see ADDING_TUTORING_SCAFFOLD "Avoiding races").
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import confetti from 'canvas-confetti';
import { OrderedComponent } from '../types';
import { getPrimitive } from '../config/primitiveRegistry';
import { OrderedSection } from './ManifestOrderRenderer';
import { useEvaluationContext } from '../evaluation';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { SoundManager } from '../utils/SoundManager';

/** Dwell before a display-only section unlocks its arrow (mirrors DeepDive's
 * reveal_progressive DWELL_MS) — prevents machine-gunning through frames. */
const DISPLAY_DWELL_MS = 2500;

/** Pause between an evaluable section completing and the arrow appearing, so
 * the primitive's own feedback moment lands before the navigation affordance. */
const CELEBRATE_DELAY_MS = 1200;

interface KindergartenStageProps {
  orderedComponents: OrderedComponent[];
  onDetailItemClick?: (item: string) => void;
  onTermClick?: (term: string) => void;
  /** Fired once when the student advances past the final section. */
  onFinished: () => void;
}

export const KindergartenStage: React.FC<KindergartenStageProps> = ({
  orderedComponents,
  onDetailItemClick,
  onTermClick,
  onFinished,
}) => {
  // Only sections that actually render (registry has a component for them).
  const sections = useMemo(
    () => orderedComponents.filter((c) => Boolean(getPrimitive(c.componentId)?.component)),
    [orderedComponents],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [dwellElapsed, setDwellElapsed] = useState(false);
  const [finished, setFinished] = useState(false);

  const evaluationContext = useEvaluationContext();
  const aiContext = useLuminaAIContext();
  const aiContextRef = useRef(aiContext);
  aiContextRef.current = aiContext;

  const active = sections[activeIndex];
  const activeConfig = active ? getPrimitive(active.componentId) : undefined;
  const isEvaluable = Boolean(activeConfig?.supportsEvaluation);

  // A section is "done" when its primitive has submitted an evaluation result.
  // A knowledge-check never submits under its own id: each inner problem
  // reports under a derived `${instanceId}::pN` id (stamped by KnowledgeCheck),
  // so the section completes only when EVERY inner problem has reported.
  const submittedIds = useMemo(
    () => new Set((evaluationContext?.submittedResults ?? []).map((r) => r.instanceId)),
    [evaluationContext?.submittedResults],
  );
  const sectionDone = useCallback(
    (section: OrderedComponent): boolean => {
      if (submittedIds.has(section.instanceId)) return true;
      if (section.componentId !== 'knowledge-check') return false;
      const problems = (section.data as { problems?: unknown[] } | undefined)?.problems;
      const expected = Array.isArray(problems) && problems.length > 0 ? problems.length : 1;
      const prefix = `${section.instanceId}::`;
      let reported = 0;
      submittedIds.forEach((id) => {
        if (id.startsWith(prefix)) reported += 1;
      });
      return reported >= expected;
    },
    [submittedIds],
  );
  const activeDone = active ? sectionDone(active) : false;

  // Arrow readiness: evaluable sections unlock on completion (after a beat for
  // the primitive's own feedback); display sections unlock after a short dwell.
  const [arrowReady, setArrowReady] = useState(false);
  useEffect(() => {
    setArrowReady(false);
    setDwellElapsed(false);
    const dwellTimer = setTimeout(() => setDwellElapsed(true), DISPLAY_DWELL_MS);
    return () => clearTimeout(dwellTimer);
  }, [activeIndex]);

  useEffect(() => {
    if (arrowReady) return;
    if (isEvaluable) {
      if (!activeDone) return;
      const t = setTimeout(() => setArrowReady(true), CELEBRATE_DELAY_MS);
      return () => clearTimeout(t);
    }
    if (dwellElapsed) setArrowReady(true);
  }, [arrowReady, isEvaluable, activeDone, dwellElapsed]);

  // Tell the tutor which section is active. Skip the first section — the
  // lesson bootstrap already registered it and the greeting covers orientation;
  // firing on mount races the greeting. switchPrimitive no-ops on same id.
  const lastNudgedIndexRef = useRef(0);
  useEffect(() => {
    if (activeIndex === 0) return;
    const ctx = aiContextRef.current;
    if (ctx.sessionMode !== 'lesson' || !ctx.isConnected) return;
    const section = sections[activeIndex];
    if (!section) return;

    ctx.switchPrimitive({
      primitive_type: section.componentId,
      instance_id: section.instanceId,
      primitive_data: section.data || {},
    });

    // One narration nudge per section entry, forward motion only (going BACK
    // to a finished section re-syncs the tutor via switchPrimitive but stays
    // quiet — quiet-by-default doctrine).
    if (activeIndex > lastNudgedIndexRef.current) {
      lastNudgedIndexRef.current = activeIndex;
      const title = section.title ? `"${section.title}"` : 'a new activity';
      ctx.sendText(
        `[SECTION_START] The student just moved to the next activity: ${title}. `
        + `They are a young student who may not be able to read the screen. In one or two short, `
        + `warm sentences, tell them what this activity is and what to do first — speak everything, `
        + `never ask them to read, and do not mention sections, screens, or the interface.`,
        { silent: true },
      );
    }
  }, [activeIndex, sections]);

  const goTo = useCallback((nextIndex: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setActiveIndex(nextIndex);
  }, []);

  const advance = useCallback(() => {
    SoundManager.pop();
    if (activeIndex >= sections.length - 1) {
      setFinished(true);
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 } });
      onFinished();
      return;
    }
    goTo(activeIndex + 1);
  }, [activeIndex, sections.length, goTo, onFinished]);

  if (!sections.length || !active || finished) return null;

  const isLast = activeIndex === sections.length - 1;

  return (
    <div className="w-full">
      {/* Progress: wordless dot trail, outside the child's working field */}
      <div className="flex justify-center items-center gap-2.5 mb-6" aria-hidden="true">
        {sections.map((s, i) => (
          <div
            key={s.instanceId}
            className={
              i === activeIndex
                ? 'w-3.5 h-3.5 rounded-full bg-amber-300 ring-4 ring-amber-300/25 transition-all duration-500'
                : i < activeIndex || sectionDone(s)
                  ? 'w-2.5 h-2.5 rounded-full bg-emerald-400/90 transition-all duration-500'
                  : 'w-2.5 h-2.5 rounded-full bg-slate-600/60 transition-all duration-500'
            }
          />
        ))}
      </div>

      {/* The stage: one section, full-bleed, animated frame flow */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active.instanceId}
          initial={{ opacity: 0, x: 120, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -120, scale: 0.97 }}
          transition={{ duration: 0.45, ease: [0.22, 0.9, 0.3, 1] }}
        >
          <div className="min-h-[62vh] flex flex-col justify-center">
            <OrderedSection
              item={active}
              index={activeIndex}
              onDetailItemClick={onDetailItemClick}
              onTermClick={onTermClick}
              hideChrome
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation row. The forward arrow only EXISTS once the section is
          done — no disabled/dead controls in a pre-reader's field. */}
      <div className="relative flex items-center justify-center mt-8 mb-16 min-h-[88px]">
        {activeIndex > 0 && (
          <button
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Back"
            className="absolute left-2 p-3 rounded-full text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <AnimatePresence>
          {arrowReady && (
            <motion.button
              key={`arrow-${active.instanceId}`}
              onClick={advance}
              aria-label={isLast ? 'Finish' : 'Next'}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
              className="group relative w-[84px] h-[84px] rounded-full bg-gradient-to-br from-amber-300 to-orange-400 shadow-xl shadow-orange-500/30 hover:shadow-orange-400/50 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              {/* soft pulse to draw the eye without words */}
              <span className="absolute inset-0 rounded-full bg-amber-300/40 animate-ping group-hover:hidden" style={{ animationDuration: '2.2s' }} />
              <svg
                className="relative w-10 h-10 mx-auto text-slate-900"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
              >
                {isLast ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                )}
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KindergartenStage;
