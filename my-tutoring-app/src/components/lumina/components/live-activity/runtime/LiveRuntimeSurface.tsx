'use client';

import React, { useEffect, useState } from 'react';
import { LuminaButton, LuminaCallout, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle } from '../../../ui';
import { accentBorder, accentChipBg, accentSolidBg, accentStrongText, accentText } from '../../../ui/tokens';
import type { LiveLessonRuntime } from './LiveLessonRuntime';
import { useRuntimeSnapshot } from './LiveRuntimeContext';
import { usePipScene } from '../../../pip/PipSurfaceContext';
import type { AssistanceEvent, ContrastPairSupport, CounterSupport, GeneratedImageSupport, StepSequenceSupport, StepTone } from './contract';

// Counters take their colour from the kit tokens, so both shapes move with the theme.
const COUNTER = `border-2 ${accentBorder.cyan} ${accentSolidBg.cyan}`;
const COUNTER_RINGED = `border-2 ${accentBorder.amber} ${accentSolidBg.amber} ring-4 ring-amber-400/30`;

/** One row of counters with a subtract / make-ten / count sentence. States HOW MANY. */
function CounterExample({ artifact }: { artifact: CounterSupport }) {
  return <>
    <div role="img" aria-label={artifact.altText} className="flex flex-wrap justify-center gap-3 py-4">
      {Array.from({ length: artifact.total }, (_, i) => {
        // Marked counters trail, so the row reads in the order of its sentence: "6 + 4", "7 − 2".
        const marked = i >= artifact.total - artifact.removed;
        return <span key={i} aria-hidden="true"
          className={`flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold ${marked ? 'border-2 border-white/20 text-slate-300' : COUNTER}`}>
          {marked ? (artifact.operation === 'make-ten' ? '+' : '×') : ''}
        </span>;
      })}
    </div>
    <p className="text-center text-xl text-slate-100">{artifact.operation === 'make-ten'
      ? `${artifact.total - artifact.removed} + ${artifact.removed} = ${artifact.total}`
      : artifact.operation === 'count' ? `${artifact.total} counters`
        : `${artifact.total} − ${artifact.removed} = ${artifact.total - artifact.removed}`}</p>
  </>;
}

/**
 * Two rows of counters stacked so their columns line up, and the trailing counters
 * of each row ringed where that row has no partner below or above. Stacking, not
 * side by side, because one-to-one matching is only visible when column i of one
 * row sits over column i of the other. States a relationship BETWEEN two collections.
 */
function ContrastPair({ artifact }: { artifact: ContrastPairSupport }) {
  const columns = Math.max(1, ...artifact.panels.map(p => p.count));
  return <>
    <div role="img" aria-label={artifact.altText} className="mx-auto w-fit max-w-full space-y-4 overflow-x-auto py-4">
      {artifact.panels.map((panel, row) => <div key={row} data-contrast-row className="flex items-center gap-4">
        <span aria-hidden="true" className="w-12 shrink-0 text-right text-2xl font-bold text-slate-100">{panel.label}</span>
        <span className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 2rem)` }}>
          {Array.from({ length: panel.count }, (_, i) => {
            const ringed = i >= panel.count - panel.highlighted;
            return <span key={i} aria-hidden="true" data-contrast-highlight={ringed ? 'true' : undefined}
              className={`h-8 w-8 rounded-full ${ringed ? COUNTER_RINGED : COUNTER}`} />;
          })}
        </span>
      </div>)}
    </div>
    <p className="text-center text-xl text-slate-100">{artifact.caption}</p>
  </>;
}

const STEP_TONE: Record<StepTone, { className: string; mark: string }> = {
  plain: { className: COUNTER, mark: '' },
  added: { className: `border-2 ${accentBorder.amber} ${accentSolidBg.amber}`, mark: '' },
  empty: { className: 'border-2 border-white/15', mark: '' },
  marked: { className: `border-2 border-dashed ${accentBorder.amber} ${accentText.amber}`, mark: '+' },
  crossed: { className: 'border-2 border-white/20 text-slate-400', mark: '×' },
};

/**
 * The same collection drawn once per step on ONE column grid, so a counter keeps its
 * column from step to step and the eye lands on what changed. States a PROCESS: what
 * is there, what is done to it, what results.
 */
function StepSequence({ artifact }: { artifact: StepSequenceSupport }) {
  const columns = Math.max(1, ...artifact.frames.map(f => f.segments.reduce((n, s) => n + s.count, 0)));
  return <ol role="img" aria-label={artifact.altText} className="mx-auto w-fit max-w-full space-y-5 overflow-x-auto py-4">
    {artifact.frames.map((frame, step) => <li key={step} data-step-frame className="flex items-center gap-4">
      <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${accentChipBg.indigo} ${accentStrongText.indigo}`}>{step + 1}</span>
      <div>
        <span className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 2rem)` }}>
          {frame.segments.flatMap((segment, s) => Array.from({ length: segment.count }, (_, i) =>
            <span key={`${s}-${i}`} aria-hidden="true" data-step-tone={segment.tone}
              className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${STEP_TONE[segment.tone].className}`}>
              {STEP_TONE[segment.tone].mark}
            </span>))}
        </span>
        <p className="mt-2 text-lg text-slate-100">{frame.caption}</p>
      </div>
    </li>)}
  </ol>;
}

/**
 * A picture the tutor described and an image model drew. It reaches this component only
 * after the vision check agreed with the description, which is also its alt text and the
 * line under it, so a reviewer can hold the tutor's words against the drawing.
 */
function GeneratedImage({ artifact, src }: { artifact: GeneratedImageSupport; src: string | null }) {
  if (!src) return <p className="py-8 text-center text-slate-400">The picture is no longer available.</p>;
  return <figure className="mx-auto max-w-2xl">
    {/* eslint-disable-next-line @next/next/no-img-element -- an inline data URL, never a remote asset */}
    <img src={src} alt={artifact.altText} data-generated-image className="w-full rounded-xl border border-white/10" />
    <figcaption className="mt-3 text-center text-sm text-slate-400">{artifact.altText}</figcaption>
  </figure>;
}

/**
 * Attention: the cheapest teaching move, and the only one that adds nothing.
 *
 * A SET of rings, because one logical move is often several rendered objects — the empty
 * spaces, both terms of a comparison, every object of a kind. Each resolves through the Pip
 * surface, which adopted primitives already publish with a live element per part, so a family
 * gets attention moves without writing a handler. Nothing is clicked and no state is touched:
 * the Pip store forbids model-driven mutation, and drawing a ring is not one.
 *
 * Whether a target MAY be rung is not decided here or in the primitive — `attentionRefusal`
 * owns that, once, for every family. This only draws what was granted.
 *
 * `aria-hidden` because the support panel states the same thing in words, and on a pre-reader
 * band the tutor says it aloud. A ring alone would announce nothing.
 */
function AttentionRing({ targetId }: { targetId: string }) {
  const { surface } = usePipScene();
  const element = surface?.targets.find(t => t.id === targetId)?.element ?? null;
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!element) { setBox(null); return; }
    const measure = () => setBox(element.getBoundingClientRect());
    measure();
    // The ring follows its element rather than being painted once: a primitive may reflow
    // under the panel that appears beside it.
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [element]);
  if (!box) return null;
  return <div aria-hidden="true" data-attend-ring={targetId}
    className="pointer-events-none fixed rounded-xl ring-4 ring-amber-400/70 transition-all duration-300"
    style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} />;
}

/**
 * What the tutor just did to help, named and quoted — the ONE place any in-place
 * support is drawn, for every family.
 *
 * It renders from committed assistance events, so it cannot narrate a change that
 * did not happen: an event reaches the snapshot only after the adapter's `execute()`
 * acknowledged a synchronous commit. That is also what makes it testable without a
 * model — dispatch the action and read the panel.
 *
 * The audience is the adult in the room and the reviewer reading a screenshot. On a
 * pre-reader band the child receives the aid as the tutor's VOICE; this panel is the
 * record of it, never the delivery.
 *
 * `data-runtime-hint` is kept from the per-primitive paragraphs this replaces, so the
 * shared journey probe in `liveJourneySpec.ts` resolves unchanged.
 */
function SupportPanel({ announce }: { announce: NonNullable<AssistanceEvent['announce']> }) {
  // `role="status"` is carried over from the paragraphs this replaces: an aid that
  // appears mid-item must be announced, not silently painted.
  return <aside role="status" aria-label="Tutor support" data-runtime-hint data-support-label={announce.label} className="mt-4">
    <LuminaCallout accent="cyan" label={announce.label}>{announce.instruction}</LuminaCallout>
  </aside>;
}

/** The learner's own way out of a CHECKED item. The observer normally reopens or advances it
 *  from the tutor's feedback; when it abstains, a checked gesture would otherwise stay locked. */
export interface LearnerProgressControl {
  act: (type: 'advance' | 'retry') => void;
  disabled?: boolean;
}

/** Keeps the SAME child mounted. Suspension is an adapter guarantee, not a CSS hiding trick. */
export function LiveRuntimeSurface({ runtime, children, active = true, learnerProgress }: {
  runtime: LiveLessonRuntime; children: React.ReactNode; active?: boolean;
  /** Every host that mounts a workspace passes this: the dev host and the ordinary lesson share one control. */
  learnerProgress?: LearnerProgressControl;
}) {
  const state = useRuntimeSnapshot(runtime);
  const artifact = active ? state.supportArtifact : null;
  const offers = (type: 'advance' | 'retry') => state.affordances.some(a => a.controller === 'observer' && a.action.type === type);
  const progress = offers('advance') ? 'advance' as const : offers('retry') ? 'retry' as const : null;
  // The LAST event on the current item, so a fade — which announces nothing — clears
  // the panel rather than leaving a withdrawn aid on screen.
  const announce = state.assistance.filter(a => a.itemId === state.task?.itemId).at(-1)?.announce;
  useEffect(() => {
    if (!active) return;
    // Two animation frames certify a paint opportunity separately from a state commit.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => runtime.acknowledgeVisible(state.revision));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [runtime, state.revision, active]);
  return <section aria-label="Lesson workspace">
    <div hidden={!!artifact || active && state.status === 'stopped'}>
      <fieldset disabled={!active || !!artifact || state.status !== 'active'} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
    </div>
    {/* The aside's role and name, and the data-* attributes, are what the harness probes resolve. */}
    {artifact && <aside aria-label="Worked example" data-artifact-kind={artifact.kind}>
      <LuminaCard surface="elevated" topAccent="indigo">
        <LuminaCardHeader><LuminaCardTitle>{artifact.title}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent>
          {artifact.kind === 'contrast-pair' ? <ContrastPair artifact={artifact} />
            : artifact.kind === 'step-sequence' ? <StepSequence artifact={artifact} />
              : artifact.kind === 'generated-image' ? <GeneratedImage artifact={artifact} src={runtime.getSupportImage(artifact.id)} />
                : <CounterExample artifact={artifact} />}
          <p className="mt-6 text-center text-sm text-slate-400">This is a worked example. Your task is saved.</p>
        </LuminaCardContent>
      </LuminaCard>
    </aside>}
    {active && learnerProgress && progress && !artifact && state.status === 'active' && <div className="mt-4 flex justify-center">
      <LuminaButton tone="primary" data-learner-progress={progress} disabled={learnerProgress.disabled}
        onClick={() => learnerProgress.act(progress)}>{progress === 'advance' ? 'Next challenge' : 'Try again'}</LuminaButton>
    </div>}
    {active && state.status === 'active' && state.markedTargetIds.map(id => <AttentionRing key={id} targetId={id} />)}
    {active && announce && state.status !== 'stopped' && <SupportPanel announce={announce} />}
    {active && state.status === 'stopped' && <p role="status">Lesson stopped. Unfinished work has not been marked complete.</p>}
    {active && state.status === 'faulted' && <p role="alert">This activity needs recovery. Your tutor cannot move it forward yet.</p>}
  </section>;
}
