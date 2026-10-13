'use client';

/**
 * ShapeBuildBoard — di-shapes' open build surface (`build_shape`): an empty dot grid where the child makes the shape
 * the tutor named. Tap a dot to place a corner, the first corner to close the shape, a corner to take it out
 * (shape-builder's `tapDot`, which refuses a tap that would cross or fold the shape). "I'm done!" runs the code judge
 * (`buildMissFor`); Try again keeps the shape, a new item opens an empty grid (the build lives in `DiShapes`, keyed by
 * item).
 *
 * One <svg> holds the dots and the child's shape, so the watcher's picture is what the child sees. The dot targets and
 * every lever mark are `data-aid` and stay out of that picture. Tap handlers sit on <circle>, never on <g>.
 */

import React, { useRef, useState } from 'react';
import { LuminaButton } from '../../../ui';
import { SoundManager } from '../../../utils/SoundManager';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import { readShape, shapeMarks, tapDot, SHAPE_WATCH_NEVER_SAY, type Pt } from '../math/shapeMakeBuild';
import { GRID_MAX, buildMissFor, describeBuild, type ShapeBuildState } from './diShapesBuild';
import { CORNER_MARKS, SAME_LENGTH_MARKS, SIDE_TICKS } from './diShapesLevers';
import type { DiShapesChallenge } from './diShapesScript';

const CELL = 40;
const PAD = 24;
const SIZE = GRID_MAX * CELL + PAD * 2;
const px = (p: Pt) => ({ x: PAD + p.x * CELL, y: PAD + p.y * CELL });
const LENGTH_COLOURS = ['#f472b6', '#a3e635', '#fbbf24', '#60a5fa'];

export interface ShapeBuildBoardProps {
  item: DiShapesChallenge;
  build: ShapeBuildState;
  onBuild: (next: ShapeBuildState) => void;
  /** Levers on screen for this item. */
  pulled: readonly string[];
  canAttempt: boolean;
  commit: (response: string, correct: boolean, miss?: string) => void;
}

export const ShapeBuildBoard: React.FC<ShapeBuildBoardProps> = ({ item, build, onBuild, pulled, canAttempt, commit }) => {
  const svg = useRef<SVGSVGElement>(null);
  // The verdict's words stay on screen until the next check.
  const [verdict, setVerdict] = useState<{ correct: boolean } | null>(null);
  const { points, closed } = build;
  const facts = closed ? readShape(points) : null;
  const marks = closed ? shapeMarks(points) : null;
  const corners = facts?.corners ?? points;
  const sides = corners.length < 2 ? [] : corners.map((a, i) => [a, corners[(i + 1) % corners.length]] as const)
    .slice(0, closed ? corners.length : corners.length - 1);

  const tap = (p: Pt) => {
    if (!canAttempt) return;
    const next = tapDot(build, p);
    if (!next) { SoundManager.invalid(); return; }
    if (next.closed && !closed) SoundManager.pop(); else SoundManager.snap();
    onBuild(next);
  };
  const done = () => {
    if (!canAttempt || !closed) return;
    const miss = buildMissFor(item.shape, build);
    if (miss) SoundManager.playIncorrect(); else SoundManager.playCorrect();
    setVerdict({ correct: !miss });
    commit(describeBuild(build), !miss, miss);
  };

  // The live line: what the shape looks like so far. Never a number, a shape name or a property word.
  const seeing = useBuildWatcher({
    buildKey: `${points.map(p => `${p.x},${p.y}`).join('|')}${closed ? '#' : ''}`,
    enabled: canAttempt && points.length >= 2,
    svg,
    request: { task: 'Make a shape on the dots.', sceneNote: 'A grid of dots the child taps to place the corners of a shape.',
      numbers: 'never', neverSay: SHAPE_WATCH_NEVER_SAY },
  });

  const on = (lever: string) => pulled.includes(lever);
  const lengthColour = (i: number) => {
    const g = marks?.lengthGroups.findIndex(group => group.includes(i)) ?? -1;
    return g >= 0 ? LENGTH_COLOURS[g % LENGTH_COLOURS.length] : null;
  };

  return <div className="flex flex-col items-center gap-3">
    <svg ref={svg} viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="max-w-full h-auto rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)' }} data-build-scene="shape-dots" role="img" aria-label="Dot grid for your shape">
      {Array.from({ length: (GRID_MAX + 1) ** 2 }, (_, k) => {
        const c = px({ x: k % (GRID_MAX + 1), y: Math.floor(k / (GRID_MAX + 1)) });
        return <circle key={`g${k}`} cx={c.x} cy={c.y} r={3} fill="rgba(148,163,184,0.55)" />;
      })}
      {corners.length >= 2 && (closed
        ? <polygon data-learner-shape="closed" points={corners.map(p => { const c = px(p); return `${c.x},${c.y}`; }).join(' ')}
          fill="rgba(34,211,238,0.16)" stroke="#67e8f9" strokeWidth={4} strokeLinejoin="round" />
        : <polyline data-learner-shape="open" points={corners.map(p => { const c = px(p); return `${c.x},${c.y}`; }).join(' ')}
          fill="none" stroke="#67e8f9" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />)}
      {points.map((p, i) => { const c = px(p); return <circle key={`p${i}`} data-corner={i} cx={c.x} cy={c.y} r={7}
        fill={i === 0 && !closed ? '#f472b6' : '#e0f2fe'} />; })}

      {/* Lever marks on the child's OWN shape: aids, never in the picture. */}
      <g data-aid className="pointer-events-none">
        {on(SAME_LENGTH_MARKS) && closed && sides.map(([a, b], i) => {
          const colour = lengthColour(i); if (!colour) return null;
          const pa = px(a), pb = px(b);
          return <line key={`len${i}`} data-lever={SAME_LENGTH_MARKS} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
            stroke={colour} strokeWidth={7} strokeLinecap="round" opacity={0.85} />;
        })}
        {on(SIDE_TICKS) && sides.map(([a, b], i) => {
          const pa = px(a), pb = px(b), mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
          const len = Math.hypot(pb.x - pa.x, pb.y - pa.y), nx = -(pb.y - pa.y) / len, ny = (pb.x - pa.x) / len;
          return <line key={`tick${i}`} data-lever={SIDE_TICKS} x1={mx - nx * 10} y1={my - ny * 10} x2={mx + nx * 10} y2={my + ny * 10}
            stroke="#fbbf24" strokeWidth={5} strokeLinecap="round" />;
        })}
        {on(CORNER_MARKS) && marks?.rightCorners.map(i => {
          const n = marks.corners.length, c = marks.corners[i];
          const toward = (q: Pt) => { const dx = q.x - c.x, dy = q.y - c.y, l = Math.hypot(dx, dy); return { x: dx / l * 0.3, y: dy / l * 0.3 }; };
          const u = toward(marks.corners[(i - 1 + n) % n]), v = toward(marks.corners[(i + 1) % n]);
          const pts = [{ x: c.x + u.x, y: c.y + u.y }, { x: c.x + u.x + v.x, y: c.y + u.y + v.y }, { x: c.x + v.x, y: c.y + v.y }]
            .map(px).map(q => `${q.x},${q.y}`).join(' ');
          return <polyline key={`ra${i}`} data-lever={CORNER_MARKS} points={pts} fill="none" stroke="#34d399" strokeWidth={3} />;
        })}
      </g>

      {/* A tap target on every dot, above the shape so a corner is tapped too. */}
      <g data-aid>
        {Array.from({ length: (GRID_MAX + 1) ** 2 }, (_, k) => {
          const p = { x: k % (GRID_MAX + 1), y: Math.floor(k / (GRID_MAX + 1)) }, c = px(p);
          return <circle key={`t${k}`} data-pip-object={`dot-${p.x}-${p.y}`} role="button" aria-label={`Dot ${p.x}, ${p.y}`}
            cx={c.x} cy={c.y} r={CELL / 2 - 2} fill="transparent" style={{ cursor: canAttempt ? 'pointer' : 'default' }}
            onClick={() => tap(p)} />;
        })}
      </g>
    </svg>

    <p className="text-center text-xs text-slate-500">
      Tap dots to make corners. Tap your first corner to close the shape. Tap a corner to take it out.
    </p>
    <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
      {seeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {seeing}</span>}
    </div>
    {verdict && <p data-build-verdict={verdict.correct ? 'right' : 'not-right'} aria-live="polite"
      className={verdict.correct ? 'text-sm font-semibold text-emerald-300' : 'text-sm font-semibold text-amber-200'}>
      {verdict.correct ? `Yes! That is ${item.article} ${item.shapeWord}.` : 'Not yet. Look at your shape again and change it.'}
    </p>}
    <div className="flex gap-3">
      <LuminaButton size="sm" className="text-xs text-slate-400" disabled={!canAttempt || !points.length}
        onClick={() => { if (canAttempt) onBuild({ points: [], closed: false }); }}>Clear Shape</LuminaButton>
      <LuminaButton tone="primary" disabled={!canAttempt || !closed} onClick={done}>I&apos;m done!</LuminaButton>
    </div>
  </div>;
};

export default ShapeBuildBoard;
