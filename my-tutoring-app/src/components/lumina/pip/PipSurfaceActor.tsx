'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PipCharacter, type PipCharacterProps } from '../components/PipCharacter';
import type { PipSurface } from './PipSurfaceStore';

interface Props extends PipCharacterProps {
  surface: PipSurface;
  speech?: string | null;
}

/** One body, portalled into a primitive-owned safe space. The target is measured
 * in viewport coordinates, so SVG scaling, page scroll and nested scroll agree.
 */
export function PipSurfaceActor({ surface, speech, ...character }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{
    element: Element; scopeId: string;
    from: { x: number; y: number }; to: { x: number; y: number };
    radius: number; box: { x: number; y: number; width: number; height: number } | null;
  } | null>(null);
  const target = surface.targets.find((t) => t.id === surface.pose.targetId);
  const pointing = surface.pose.gesture === 'point';
  const currentGeometry = target?.element === geometry?.element && surface.scopeId === geometry?.scopeId ? geometry : null;
  const phaseMood = surface.pose.phase === 'celebrating' ? 'excited'
    : surface.pose.phase === 'checking' ? 'thinking'
    : surface.pose.phase === 'working' ? 'listening' : 'happy';

  useEffect(() => {
    if (!target) { setGeometry(null); return; }
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (!body.current || !target.element.isConnected) { setGeometry(null); return; }
      const a = body.current.getBoundingClientRect();
      const b = target.element.getBoundingClientRect();
      if (!a.width || !b.width || !b.height || b.bottom < 0 || b.top > window.innerHeight
        || b.right < 0 || b.left > window.innerWidth) {
        setGeometry(null); return;
      }
      const from = { x: a.left + a.width * 0.7, y: a.top + a.height * 0.55 };
      const to = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      // A small, roughly square object gets a ring; a region (a board, a canvas,
      // a slot row) gets its own outline instead of a ring drawn around its centre.
      const region = Math.max(b.width, b.height) > 140 || Math.max(b.width, b.height) / Math.min(b.width, b.height) > 1.6;
      setGeometry({
        element: target.element, scopeId: surface.scopeId, from, to,
        radius: Math.max(b.width, b.height) / 2 + 6,
        box: region ? { x: b.left - 6, y: b.top - 6, width: b.width + 12, height: b.height + 12 } : null,
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(surface.dock);
    observer?.observe(target.element);
    measure();
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [surface, target]);

  return <>
    {createPortal(
      <div className="flex w-full items-center gap-3" data-pip-surface-body={surface.instanceId}
        data-pip-phase={surface.pose.phase} data-pip-gesture={surface.pose.gesture}>
        <div ref={body} className="shrink-0">
          <PipCharacter {...character} mood={phaseMood} talking={character.talking ?? character.mood === 'speaking'}
            size={104} lookAt={currentGeometry?.to} trackPointer={false}
            label={surface.pose.phase === 'working' ? 'Pip is watching your work' : undefined}
            pointing={!!currentGeometry && pointing} receiving={surface.pose.gesture === 'receive'} />
        </div>
        {speech && <p className="max-h-24 overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-900/90 px-3 py-2 text-sm leading-relaxed text-slate-100">{speech}</p>}
      </div>, surface.dock,
    )}
    {currentGeometry && pointing && createPortal(
      <svg aria-hidden="true" data-pip-pointing={surface.pose.targetId} data-pip-target-x={currentGeometry.to.x} data-pip-target-y={currentGeometry.to.y}
        className="pointer-events-none fixed inset-0 z-40 h-full w-full">
        {/* A region gets its outline only: a connector would end beside whichever
            answer choice happens to sit nearest Pip, and read as pointing at it. */}
        {!currentGeometry.box && <path d={`M ${currentGeometry.from.x} ${currentGeometry.from.y} Q ${currentGeometry.from.x} ${currentGeometry.to.y} ${currentGeometry.to.x} ${currentGeometry.to.y}`}
          fill="none" stroke="#67e8f9" strokeOpacity="0.65" strokeWidth="2" strokeDasharray="4 6" />}
        {currentGeometry.box
          ? <rect x={currentGeometry.box.x} y={currentGeometry.box.y} width={currentGeometry.box.width} height={currentGeometry.box.height}
            rx="18" fill="none" stroke="#67e8f9" strokeWidth="3" strokeOpacity="0.8" />
          : <circle cx={currentGeometry.to.x} cy={currentGeometry.to.y} r={currentGeometry.radius} fill="none" stroke="#67e8f9" strokeWidth="3" />}
      </svg>, document.body,
    )}
  </>;
}
