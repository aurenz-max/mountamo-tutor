'use client';

/**
 * The dock's non-character parts: which part of the lesson the child is on,
 * a mic meter driven by the real mic level, and a labelled on/off switch.
 * Rendered by {@link CuratorCompanion}.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useMicLevel } from '@/contexts/LuminaAIContext';
import { useExhibitContext } from '../contexts/ExhibitContext';
import { useEvaluationContext } from '../evaluation';
import { getPrimitive } from '../config/primitiveRegistry';
import { isSectionDone } from '../utils/sectionDone';

const SECTION_ATTR = 'data-primitive-instance-id';

/** Section ids that are on the page and visible, so a tap can scroll to them. */
function useVisibleSectionIds(watch: unknown): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const next = new Set<string>();
    document.querySelectorAll<HTMLElement>(`[${SECTION_ATTR}]`).forEach((el) => {
      const id = el.dataset.primitiveInstanceId;
      if (id && !el.closest('[hidden]')) next.add(id);
    });
    setIds(next);
  }, [watch]);
  return ids;
}

interface SectionTrackerProps {
  activeId: string | null;
  /** Shown when the active primitive is not one of the lesson's sections. */
  fallbackName: string | null;
}

/**
 * "We are working on · Ten Frame · Part 2 of 5" with one rail segment per
 * lesson section. A segment is a button only where tapping can do something:
 * in the scroll layout it scrolls to that section (the viewport tracker then
 * moves the tutor). On the kindergarten stage only one section is on the page,
 * so the rail is a plain picture and nothing in it is a dead control.
 */
export const SectionTracker: React.FC<SectionTrackerProps> = ({ activeId, fallbackName }) => {
  const { sections: all } = useExhibitContext();
  const submitted = useEvaluationContext()?.submittedResults;

  const sections = useMemo(
    () =>
      all.filter(
        (s) =>
          s.audience !== 'caregiver' &&
          s.componentId !== 'curator-brief' &&
          Boolean(getPrimitive(s.componentId)?.component),
      ),
    [all],
  );
  const submittedIds = useMemo(() => new Set((submitted ?? []).map((r) => r.instanceId)), [submitted]);
  const visible = useVisibleSectionIds(`${activeId}|${sections.length}`);

  const activeIndex = sections.findIndex((s) => s.instanceId === activeId);
  const active = activeIndex >= 0 ? sections[activeIndex] : null;
  const name = active?.title || (active ? getPrimitive(active.componentId)?.sectionTitle : null) || fallbackName;
  if (!name) return null;

  const canJump = visible.size > 1;

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-lg backdrop-blur-xl">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">We are working on</span>
        {active && sections.length > 1 && (
          <span className="text-xs font-semibold text-slate-400">
            Part {activeIndex + 1} of {sections.length}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-lg font-bold text-slate-50">{name}</p>

      {active && sections.length > 1 && (
        <ol className="mt-2 flex items-center gap-1.5" aria-label="Lesson parts">
          {sections.map((s, i) => {
            const isNow = i === activeIndex;
            const done = !isNow && isSectionDone(s, submittedIds);
            const bar = isNow
              ? 'h-3 bg-cyan-400'
              : done
                ? 'h-2 bg-emerald-400'
                : i < activeIndex
                  ? 'h-2 bg-slate-400' // passed, nothing submitted (a display section)
                  : 'h-2 bg-slate-600';
            const label = `Part ${i + 1}: ${s.title || 'section'}${isNow ? ', now' : done ? ', done' : ''}`;
            const body = (
              <>
                <span className={`block w-full rounded-full transition-all duration-300 ${bar}`} />
                {done && <Check className="mx-auto mt-0.5 h-3 w-3 text-emerald-300" aria-hidden />}
              </>
            );
            return (
              <li key={s.instanceId} className="min-w-0 flex-1" aria-current={isNow ? 'step' : undefined}>
                {canJump && !isNow && visible.has(s.instanceId) ? (
                  <button
                    type="button"
                    aria-label={`Go to ${label}`}
                    onClick={() =>
                      document
                        .querySelector(`[${SECTION_ATTR}="${s.instanceId.replace(/"/g, '\\"')}"]`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="flex min-h-[28px] w-full flex-col justify-center rounded-md hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                  >
                    {body}
                  </button>
                ) : (
                  <span className="flex min-h-[28px] flex-col justify-center" aria-label={label} role="img">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

const METER_WEIGHTS = [0.45, 0.75, 1, 0.6, 0.9, 0.5, 0.7];

/** Bars that move with the child's real voice. Flat and grey while the mic is off. */
export const MicMeter: React.FC<{ live: boolean }> = ({ live }) => {
  const level = useMicLevel();
  const gain = live ? Math.min(1, level / 0.12) : 0;
  return (
    <div className="flex h-5 items-center gap-1" aria-hidden>
      {METER_WEIGHTS.map((w, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-[height] duration-100 ${live ? 'bg-cyan-300' : 'bg-slate-600'}`}
          style={{ height: 4 + gain * 16 * w }}
        />
      ))}
    </div>
  );
};

interface DockSwitchProps {
  label: string;
  detail: string;
  on: boolean;
  onChange: (next: boolean) => void;
}

/** A whole-row switch: label, the word On or Off, and a track whose knob moves. */
export const DockSwitch: React.FC<DockSwitchProps> = ({ label, detail, on, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
  >
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="text-sm font-bold text-slate-50">{label}</span>
      <span className="text-xs text-slate-400">{detail}</span>
    </span>
    <span className={`text-xs font-bold ${on ? 'text-cyan-300' : 'text-slate-400'}`}>{on ? 'On' : 'Off'}</span>
    <span
      className={`flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors ${
        on ? 'justify-end bg-cyan-700' : 'justify-start bg-slate-600'
      }`}
    >
      <span className="h-6 w-6 rounded-full bg-slate-50 shadow" />
    </span>
  </button>
);
