'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaCallout, LuminaChallengeCounter, LuminaFeedbackCard, LuminaInlineStat,
  LuminaPanel, LuminaPrompt,
} from '../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TrainYardMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { usePhaseResults, type PhaseConfig } from '../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import {
  CAR_ORDER, carButtonName, carCount, carFor, chosenKind, describeLoad, emptyConsist, engineFor, roadComparison, runTrain,
  TRAIN_CARS, yardConsist,
  type Consist, type TrainCarType, type TrainRun, type TrainYardChallenge, type TrainYardMiss, type TrainYardTask,
} from './trainYardModel';
import { describeTrainWork, trainYardAssignment, trainYardMiss, trainYardScene } from './trainYardWorkspace';
import {
  CARGO_LOOKS, MODEL_LEVER, PICTURE_LEVER, TALLY_LEVER, WEIGHT_LEVER, WORKED_LEVER, carTally, isPracticeJob, leverFacts,
  modelMatch, simplerJob, startLevers, trainWeight, trainYardLevers, workedHill,
} from './trainYardLevers';

export type { TrainYardChallenge } from './trainYardModel';

// ============================================================================
// Data contract
// ============================================================================

export interface TrainYardData {
  title: string;
  description: string;
  /** 3-5 rail jobs. REQUIRED. Stories by the generator, numbers by `buildTrainYardChallenge`. */
  challenges: TrainYardChallenge[];
  /** The session's task when it runs one; on a mixed session, the hardest task in it. Each job carries its own. */
  challengeType: TrainYardTask;
  gradeBand: 'K-2' | '3-5';
  /** Where the levers start (`config.difficulty`): easy starts with the self-checking help pulled. */
  supportTier?: 'easy' | 'medium' | 'hard';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TrainYardMetrics>) => void;
}

interface TrainYardProps {
  data: TrainYardData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  match_car: { label: 'Match the car', icon: '🚃', accentColor: 'amber' },
  enough_cars: { label: 'Count the cars', icon: '🔢', accentColor: 'cyan' },
  enough_pull: { label: 'Choose the engines', icon: '⛰️', accentColor: 'emerald' },
  build_train: { label: 'Build the train', icon: '🚂', accentColor: 'orange' },
};

const MAX_ENGINES = 8;
const MAX_CARS_PER_TYPE = 40;

// ============================================================================
// Drawing (bespoke interaction surface — the kit is the frame only)
// ============================================================================

const COLORS = {
  skyTop: '#0b1830', skyBot: '#24345a', hills: '#1f2d42', ground: '#28372a', ballast: '#4a4744',
  rail: '#aeb6bf', tie: '#4e3c2f', livery: '#f0662c', dark: '#1b1f24', ink: '#e7edf3', muted: '#95a2b1',
  warn: '#e8b13a', stop: '#f05a4b', go: '#33c27a', steel: '#7b8794',
};
const CAR_COLOR: Record<TrainCarType, string> = {
  hopper: '#b9a27a', tank: '#3a3f46', flat: '#8e6a45', boxcar: '#9b3b2a', autorack: '#c9ced3', coach: '#dfe5ea',
};

type UnitKind = 'engine' | 'pax-engine' | TrainCarType;
interface Unit { kind: UnitKind; loaded?: boolean; wrong?: boolean }

function drawWheels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, r: number) {
  ctx.fillStyle = COLORS.dark;
  const xs = w > 40 ? [x + w * .12, x + w * .24, x + w * .76, x + w * .88] : [x + w * .2, x + w * .8];
  for (const cx of xs) { ctx.beginPath(); ctx.arc(cx, y - r, r, 0, Math.PI * 2); ctx.fill(); }
}

/** One unit, side view, facing right, sitting on the rail at y. */
function drawUnit(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, w: number, h: number) {
  const r = Math.max(1.5, h * .13);
  const base = y - r * 2;
  ctx.save();
  if (u.kind === 'pax-engine') {
    ctx.fillStyle = '#eef2f5';
    ctx.beginPath();
    ctx.moveTo(x, base); ctx.lineTo(x, base - h * .95); ctx.lineTo(x + w * .55, base - h * .95);
    ctx.quadraticCurveTo(x + w, base - h * .9, x + w, base - h * .12); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1d4fa3'; ctx.fillRect(x, base - h * .38, w * .97, h * .1);
    ctx.fillStyle = COLORS.dark;
    ctx.beginPath(); ctx.moveTo(x + w * .6, base - h * .86); ctx.quadraticCurveTo(x + w * .85, base - h * .82, x + w * .9, base - h * .6);
    ctx.lineTo(x + w * .6, base - h * .6); ctx.closePath(); ctx.fill();
  } else if (u.kind === 'engine') {
    ctx.fillStyle = COLORS.livery;
    ctx.fillRect(x, base - h * .78, w * .8, h * .78);
    ctx.fillRect(x + w * .8, base - h * .95, w * .2, h * .95);
    ctx.fillStyle = COLORS.dark; ctx.fillRect(x + w * .84, base - h * .86, w * .12, h * .22);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x, base - h * .3, w, h * .07);
    ctx.fillStyle = COLORS.dark;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (.08 + i * .16), base - h * .7, w * .1, h * .06);
  } else {
    ctx.fillStyle = CAR_COLOR[u.kind];
    if (u.kind === 'hopper') {
      ctx.beginPath();
      ctx.moveTo(x + w * .02, base - h * .85); ctx.lineTo(x + w * .98, base - h * .85);
      ctx.lineTo(x + w * .9, base - h * .2); ctx.lineTo(x + w * .1, base - h * .2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      for (let i = 1; i < 4; i++) ctx.fillRect(x + w * i / 4 - 1, base - h * .85, 2, h * .65);
    } else if (u.kind === 'tank') {
      ctx.beginPath(); ctx.ellipse(x + w / 2, base - h * .5, w * .48, h * .32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x + w * .47, base - h * .9, w * .06, h * .1);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x + w * .1, base - h * .7, w * .8, h * .06);
    } else if (u.kind === 'flat') {
      ctx.fillRect(x, base - h * .2, w, h * .12);
      ctx.fillRect(x + w * .48, base - h * .95, w * .04, h * .75);
      ctx.fillRect(x + w * .02, base - h * .95, w * .96, h * .06);
      if (u.loaded) {
        ctx.fillStyle = '#d8b07a';
        ctx.fillRect(x + w * .05, base - h * .82, w * .41, h * .62);
        ctx.fillRect(x + w * .54, base - h * .82, w * .41, h * .62);
      }
    } else if (u.kind === 'autorack') {
      ctx.fillRect(x, base - h, w, h * .92);
      ctx.fillStyle = 'rgba(0,0,0,.15)';
      for (let i = 1; i < 12; i++) ctx.fillRect(x + w * i / 12, base - h * .95, 1, h * .82);
    } else if (u.kind === 'boxcar') {
      ctx.fillRect(x, base - h * .9, w, h * .82);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + w * .4, base - h * .82, w * .2, h * .68);
    } else if (u.kind === 'coach') {
      ctx.fillRect(x, base - h * .95, w, h * .87);
      ctx.fillStyle = '#1d4fa3'; ctx.fillRect(x, base - h * .38, w, h * .1);
      ctx.fillStyle = u.loaded ? '#ffd56b' : '#33404d';
      const n = Math.max(2, Math.round(w / 9));
      for (let i = 0; i < n; i++) ctx.fillRect(x + w * (.06 + i * .88 / n), base - h * .78, w * .88 / n * .6, h * .22);
    }
  }
  ctx.fillStyle = COLORS.dark; ctx.fillRect(x, base - h * .06, w, h * .06);
  drawWheels(ctx, x, y, w, r);
  if (u.wrong) {
    ctx.strokeStyle = COLORS.stop; ctx.lineWidth = Math.max(1.5, w * .04);
    ctx.beginPath(); ctx.moveTo(x + w * .2, base - h * .8); ctx.lineTo(x + w * .8, base - h * .15);
    ctx.moveTo(x + w * .8, base - h * .8); ctx.lineTo(x + w * .2, base - h * .15); ctx.stroke();
  }
  ctx.restore();
}

/** The consist as units, engines first. `loadedFraction` fills the right cars in order (the loading phase). */
function consistUnits(c: TrainYardChallenge, consist: Consist, loadedFraction: number, showWrong: boolean): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < consist.engines; i++) units.push({ kind: c.cargoForm === 'people' ? 'pax-engine' : 'engine' });
  const right = carFor(c);
  let left = c.amount * loadedFraction;
  for (const type of [right, ...CAR_ORDER.filter(t => t !== right)]) {
    for (let i = 0; i < (consist.cars[type] ?? 0); i++) {
      const isRight = type === right;
      units.push({ kind: type, loaded: isRight && left > 0, wrong: showWrong && !isRight });
      if (isRight) left -= TRAIN_CARS[type].holds;
    }
  }
  return units;
}

// Route: flat → climb → summit → descent → station.
const SEGMENTS: [number, number, -1 | 0 | 1][] = [[0, .26, 0], [.26, .56, 1], [.56, .68, 0], [.68, .86, -1], [.86, 1, 0]];
const START_P = .085;
const ARRIVE_P = .955;
const HILL_FOOT = .26, HILL_TOP = .56;
const ease = (x: number) => 1 - (1 - x) * (1 - x);

/**
 * The run as a short fixed timeline, at most about 3.5 s, so the outcome commits while a child is
 * still watching: load, roll to the hill, then climb (slower the thinner the pull margin) and coast
 * to the station — or creep part way up (higher the closer the pull was to enough), slip and slide back.
 */
function runTimeline(run: TrainRun, reduce: boolean) {
  const k = reduce ? .3 : 1;
  const load = .5 * k, approach = .5 * k;
  const margin = run.climbs ? Math.min(1, (run.enginePull - run.hillPull) / run.enginePull) : 0;
  const climb = (run.climbs ? .8 + 1.0 * (1 - margin) : .9) * k;
  const tail = (run.climbs ? .7 : .7) * k;
  const reach = run.climbs ? 1 : Math.max(.15, Math.min(.85, run.enginePull / run.hillPull));
  const total = load + approach + climb + tail;
  const at = (s: number) => {
    if (s < load) return { head: START_P, loading: true, slip: false, puffing: false };
    let t = s - load;
    if (t < approach) return { head: START_P + (HILL_FOOT - START_P) * (t / approach), loading: false, slip: false, puffing: false };
    t -= approach;
    if (t < climb) {
      const f = t / climb;
      return { head: HILL_FOOT + (HILL_TOP - HILL_FOOT) * reach * (run.climbs ? f : ease(f)), loading: false,
        slip: !run.climbs && f > .8, puffing: true };
    }
    t -= climb;
    const f = Math.min(1, t / tail);
    if (run.climbs) return { head: HILL_TOP + (ARRIVE_P - HILL_TOP) * ease(f), loading: false, slip: false, puffing: false };
    return { head: HILL_FOOT + (HILL_TOP - HILL_FOOT) * reach - .02 * ease(f), loading: false, slip: f < .8, puffing: false };
  };
  return { load, total, at };
}

function elevation(x: number) {
  let e = 0;
  for (const [a, b, s] of SEGMENTS) {
    if (x <= a) break;
    const span = Math.min(x, b) - a;
    if (s === 1) e += span / (b - a);
    if (s === -1) e -= .7 * span / (b - a);
  }
  return e;
}

interface RouteFrame { head: number; loadedFraction: number; slip: boolean; puffing: boolean; showWrong: boolean; t: number; leftover: number }

function drawRoute(canvas: HTMLCanvasElement, c: TrainYardChallenge, consist: Consist, f: RouteFrame) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, COLORS.skyTop); sky.addColorStop(1, COLORS.skyBot);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.hills;
  ctx.beginPath(); ctx.moveTo(0, H * .62);
  for (let i = 0; i <= 20; i++) ctx.lineTo(i / 20 * W, H * (.5 - .08 * Math.sin(i * 1.3) - .05 * Math.sin(i * .5 + 1)));
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  const pad = 70, baseY = H * .82, rise = H * .36 * Math.min(1, Math.max(.4, c.grade / 2.5));
  const P = (x: number): [number, number] => [pad + x * (W - 2 * pad), baseY - elevation(x) * rise];
  ctx.fillStyle = COLORS.ground;
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, P(0)[1] + 8);
  for (let i = 0; i <= 200; i++) { const [x, y] = P(i / 200); ctx.lineTo(x, y + 8); }
  ctx.lineTo(W, P(1)[1] + 8); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = COLORS.ballast; ctx.lineWidth = 12; ctx.lineJoin = 'round';
  ctx.beginPath(); for (let i = 0; i <= 200; i++) { const [x, y] = P(i / 200); if (i) ctx.lineTo(x, y + 5); else ctx.moveTo(x, y + 5); } ctx.stroke();
  ctx.strokeStyle = COLORS.tie; ctx.lineWidth = 3;
  for (let i = 0; i <= 120; i++) { const [x, y] = P(i / 120); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke(); }
  ctx.strokeStyle = COLORS.rail; ctx.lineWidth = 3;
  ctx.beginPath(); for (let i = 0; i <= 200; i++) { const [x, y] = P(i / 200); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();

  const station = (x: number, label: string, align: CanvasTextAlign) => {
    const [sx, sy] = P(x);
    ctx.fillStyle = '#17202a'; ctx.strokeStyle = COLORS.ink; ctx.lineWidth = 2;
    ctx.fillRect(sx - 34, sy - 46, 68, 34); ctx.strokeRect(sx - 34, sy - 46, 68, 34);
    ctx.fillStyle = COLORS.livery; ctx.fillRect(sx - 40, sy - 52, 80, 8);
    ctx.fillStyle = COLORS.ink; ctx.font = '600 22px system-ui, sans-serif'; ctx.textAlign = align;
    ctx.fillText(label, align === 'left' ? sx - 40 : sx + 40, sy - 62);
  };
  station(.04, c.from, 'left');
  station(.96, c.to, 'right');

  // What stayed at the origin: a pile of the cargo the train had no room for.
  if (f.leftover > 0) {
    const [ox, oy] = P(.04);
    ctx.fillStyle = c.cargoForm === 'people' ? '#ffd56b' : '#c9a46a';
    ctx.beginPath(); ctx.moveTo(ox + 40, oy); ctx.lineTo(ox + 70, oy - 30); ctx.lineTo(ox + 100, oy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COLORS.warn; ctx.font = '700 18px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`left behind: ${describeLoad(c, f.leftover)}`, ox + 30, oy + 30);
  }

  const [gx, gy] = P(.27);
  ctx.fillStyle = COLORS.warn; ctx.fillRect(gx - 2, gy - 70, 4, 70);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = COLORS.dark; ctx.lineWidth = 2;
  ctx.fillRect(gx - 54, gy - 112, 108, 46); ctx.strokeRect(gx - 54, gy - 112, 108, 46);
  ctx.fillStyle = '#18212b'; ctx.textAlign = 'center';
  ctx.font = '800 26px system-ui, sans-serif'; ctx.fillText(`${c.grade.toFixed(1)}% UP`, gx, gy - 82);
  ctx.font = '600 16px system-ui, sans-serif'; ctx.fillStyle = COLORS.ink; ctx.fillText(c.hillName, gx, gy - 120);

  const units = consistUnits(c, consist, f.loadedFraction, f.showWrong);
  const unitLen = Math.min(.03, Math.max(.004, .24 / Math.max(units.length, 1)));
  const unitPx = unitLen * (W - 2 * pad);
  const h = Math.min(34, Math.max(8, unitPx * .75));
  units.forEach((u, i) => {
    const front = f.head - i * unitLen;
    const back = front - unitLen * .92;
    if (back < -.05) return;
    const [x1, y1] = P(Math.min(1, Math.max(0, back)));
    const [x2, y2] = P(Math.min(1, Math.max(0, front)));
    ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
    drawUnit(ctx, u, 0, 0, Math.hypot(x2 - x1, y2 - y1), h);
    ctx.restore();
  });
  if (f.slip) {
    const [ex, ey] = P(Math.min(1, Math.max(0, f.head - unitLen * .5)));
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a1f';
      const a = Math.random() * Math.PI, d = 6 + Math.random() * 18;
      ctx.fillRect(ex + Math.cos(a) * d * (Math.random() < .5 ? -1 : 1), ey - Math.sin(a) * d * .6, 3, 3);
    }
  }
  if (f.puffing && c.cargoForm !== 'people') {
    const [ex, ey] = P(Math.min(1, Math.max(0, f.head - unitLen * .3)));
    ctx.fillStyle = 'rgba(150,150,160,.35)';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(ex - i * 12 - (f.t / 40 % 12), ey - h - 10 - i * 9, 6 + i * 3, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawConsistStrip(canvas: HTMLCanvasElement, c: TrainYardChallenge, consist: Consist) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const railY = H - 14;
  ctx.fillStyle = COLORS.ballast; ctx.fillRect(0, railY + 2, W, 10);
  ctx.fillStyle = COLORS.rail; ctx.fillRect(0, railY, W, 3);
  const units = consistUnits(c, consist, 0, false);
  if (!units.length) {
    ctx.fillStyle = COLORS.muted; ctx.font = '600 26px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Empty track — add an engine and some cars', W / 2, railY - 30);
    return;
  }
  const gap = 3;
  const unitW = Math.min(84, Math.max(4, (W - 10) / units.length - gap));
  const h = Math.min(64, Math.max(10, unitW * .7));
  let x = W - 6 - unitW;
  for (const u of units) { drawUnit(ctx, u, x, railY, unitW, h); x -= unitW + gap; }
}

/** A small side-view picture of one unit, for the yard cards. */
const UnitPicture: React.FC<{ kind: UnitKind }> = ({ kind }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = COLORS.rail; ctx.fillRect(0, cv.height - 4, cv.width, 3);
    drawUnit(ctx, { kind, loaded: false }, 16, cv.height - 4, cv.width - 32, 46);
  }, [kind]);
  return <canvas ref={ref} width={240} height={60} className="block h-8 w-full" aria-hidden="true" />;
};

/** `cargo_picture` and `model_match`: the cargo itself, as it looks. Never a car. */
const CargoPicture: React.FC<{ form: TrainYardChallenge['cargoForm'] }> = ({ form }) => (
  <svg viewBox="0 0 64 40" width={64} height={40} role="img" aria-label={CARGO_LOOKS[form]} className="shrink-0">
    {form === 'loose_bulk' && Array.from({ length: 36 }, (_, i) => {
      const row = Math.floor(Math.sqrt(i)), col = i - row * row;
      return <circle key={i} cx={32 + (col - row) * 3.2} cy={8 + row * 5} r={2} fill="#d8b46a" />;
    })}
    {form === 'liquid' && <>
      <ellipse cx={32} cy={32} rx={26} ry={6} fill="#4a8fd0" opacity={0.85} />
      <path d="M32 4 C36 12 40 16 40 21 a8 8 0 0 1 -16 0 C24 16 28 12 32 4Z" fill="#6fb0ea" />
    </>}
    {form === 'long_bundles' && [0, 1, 2, 3].map(i =>
      <rect key={i} x={2} y={10 + i * 6} width={60} height={5} rx={2.5} fill={i % 2 ? '#a77b4f' : '#c49563'} />)}
    {form === 'boxed_goods' && [[6, 20], [26, 20], [46, 20], [16, 4], [36, 4]].map(([x, y], i) =>
      <g key={i}><rect x={x} y={y} width={16} height={16} fill="#c99a5b" stroke="#7a5a32" />
        <line x1={x} y1={y + 8} x2={x + 16} y2={y + 8} stroke="#7a5a32" /></g>)}
    {form === 'vehicles' && [6, 34].map(x => <g key={x}>
      <rect x={x} y={16} width={24} height={10} rx={3} fill="#c94f4f" /><rect x={x + 5} y={10} width={13} height={7} rx={2} fill="#e07a7a" />
      <circle cx={x + 6} cy={28} r={3} fill="#1b1f24" /><circle cx={x + 18} cy={28} r={3} fill="#1b1f24" /></g>)}
    {form === 'people' && [8, 22, 36, 50].map((x, i) => <g key={x}>
      <circle cx={x} cy={10} r={4} fill={['#f2c39b', '#c98e62', '#8d5a3b', '#f0d0b0'][i]} />
      <rect x={x - 4} y={15} width={8} height={14} rx={3} fill={['#4a7bd0', '#58a06a', '#d0a23a', '#c94f4f'][i]} /></g>)}
  </svg>
);

/** One icon per road vehicle the train replaced. */
const RoadLine: React.FC<{ count: number; people: boolean }> = ({ count, people }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const W = 1000, cols = 50, cell = W / cols, rows = Math.max(1, Math.ceil(count / cols));
    cv.width = W; cv.height = rows * cell * .62 + 4;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    for (let i = 0; i < count; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell * .62 + 2;
      if (people) {
        ctx.fillStyle = ['#4a7bd0', '#c94f4f', '#d0a23a', '#58a06a', '#8a8f96'][i % 5];
        ctx.fillRect(x + 2, y + cell * .18, cell * .8, cell * .3); ctx.fillRect(x + cell * .2, y + 2, cell * .45, cell * .2);
      } else {
        ctx.fillStyle = COLORS.muted; ctx.fillRect(x + 1, y + 2, cell * .62, cell * .44);
        ctx.fillStyle = COLORS.livery; ctx.fillRect(x + cell * .64, y + cell * .14, cell * .22, cell * .32);
      }
    }
  }, [count, people]);
  return <canvas ref={ref} className="block w-full" aria-label={`${count} road vehicles, one icon each`} />;
};

// ============================================================================
// Feedback copy — evidence from the run, never the key
// ============================================================================

const tons = (n: number) => `${Math.round(n).toLocaleString('en-US')} t`;

function runMessage(c: TrainYardChallenge, run: TrainRun, miss: TrainYardMiss | undefined): string {
  switch (miss) {
    case 'wrong_car': return `None of these cars can carry ${c.cargo}, so nothing was loaded. Look at how each car is built.`;
    case 'mixed_cars': return `${run.wrongCars} car${run.wrongCars === 1 ? '' : 's'} could not carry ${c.cargo}, so they rode along as dead weight.`;
    case 'too_few_cars': return `${describeLoad(c, run.leftover)} was left at ${c.from}. Your cars only hold ${describeLoad(c, run.capacity)}.`;
    case 'stalled': return `Stalled on ${c.hillName}! The hill needed ${tons(run.hillPull)} of pull, and your engines gave ${tons(run.enginePull)}. The wheels spun and the train slid back.`;
    case 'extra_cars': return 'Everything arrived, but some cars rode empty. Could fewer cars hold the whole load?';
    case 'extra_engines': return `It climbed! The hill needed ${tons(run.hillPull)} of pull and your engines gave ${tons(run.enginePull)}. Could fewer engines still make it?`;
    default: return `Delivered! The whole load made it over ${c.hillName} with no extra cars and no extra engines.`;
  }
}

// ============================================================================
// Component
// ============================================================================

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useTrainYardProgress = useWorkspaceProgressFor('train-yard');

type Phase = 'building' | 'running' | 'ran';

const TrainYardSurface: React.FC<TrainYardProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, description, challenges = [], challengeType, gradeBand, supportTier, instanceId, skillId, subskillId, objectiveId, exhibitId,
    onEvaluationSubmit } = data;
  const ctx = useLuminaAIContext();
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `train-yard-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const [consist, setConsist] = useState<Consist>(emptyConsist);
  const [phase, setPhase] = useState<Phase>('building');
  const [lastRun, setLastRun] = useState<TrainRun | null>(null);
  const [lastMiss, setLastMiss] = useState<TrainYardMiss | undefined>(undefined);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [runs, setRuns] = useState(0);
  const animRef = useRef<number | null>(null);
  // In-item levers (`trainYardLevers.ts`), keyed by the session job they were pulled on, and the easier job a
  // simplify lever put on screen in its place.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<TrainYardChallenge | null>(null);

  const progress = useTrainYardProgress<TrainYardChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: trainYardAssignment,
    // A fresh job and Try again both empty the yard. On Try again the last run's evidence stays on
    // screen (and in the scene), so the learner rebuilds from what the run showed.
    onItemOpened: (_index, retry) => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      setPhase('building'); setLastCorrect(false); setConsist(emptyConsist());
      // Try again on an easier practice job keeps it; only the observer's return to the full job ends it.
      if (retry) return;
      setPractice(null); setLastRun(null); setLastMiss(undefined); setRuns(0);
    },
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const blocked = progress.canAttempt === false || phase === 'running';
  const sessionChallenge = challenges[currentIndex] ?? null;
  /** What is on screen: the easier job while a simplify lever holds it, else the session job. */
  const current = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : startLevers(sessionChallenge, supportTier);
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);
  // The train that runs: the learner's part plus whatever this task has the yard set.
  const train = useMemo(() => (current ? yardConsist(current, consist) : emptyConsist()), [current, consist]);

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(rs.length, 1)),
  });

  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<TrainYardMetrics>({
    primitiveType: 'train-yard', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  // ── Building ──────────────────────────────────────────────────────────────
  const changeEngines = useCallback((d: number) => {
    if (blocked) return;
    SoundManager.tap();
    setConsist(prev => ({ ...prev, engines: Math.max(0, Math.min(MAX_ENGINES, prev.engines + d)) }));
  }, [blocked]);
  const changeCars = useCallback((type: TrainCarType, d: number) => {
    if (blocked) return;
    SoundManager.tap();
    setConsist(prev => ({ ...prev, cars: { ...prev.cars,
      [type]: Math.max(0, Math.min(MAX_CARS_PER_TYPE, (prev.cars[type] ?? 0) + d)) } }));
  }, [blocked]);
  /** match_car: one car kind at a time; the yard sizes the train for it. */
  const chooseKind = useCallback((type: TrainCarType) => {
    if (blocked) return;
    SoundManager.select();
    setConsist({ engines: 0, cars: { [type]: 1 } });
  }, [blocked]);

  // ── The run is the check ──────────────────────────────────────────────────
  const routeRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!current || phase === 'running') return;
    if (stripRef.current) drawConsistStrip(stripRef.current, current, train);
    if (routeRef.current) {
      const arrived = phase === 'ran' && !!lastRun?.climbs;
      drawRoute(routeRef.current, current, train, {
        head: arrived ? ARRIVE_P : START_P, loadedFraction: phase === 'ran' ? 1 : 0, slip: false, puffing: false,
        showWrong: phase === 'ran', t: 0, leftover: phase === 'ran' ? lastRun?.leftover ?? 0 : 0,
      });
    }
  }, [current, train, phase, lastRun]);

  useEffect(() => () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); }, []);

  const finishRun = useCallback((challenge: TrainYardChallenge, sent: Consist, run: TrainRun) => {
    animRef.current = null;
    const miss = trainYardMiss(challenge, sent);
    const correct = miss === undefined;
    setPhase('ran'); setLastRun(run); setLastMiss(miss); setLastCorrect(correct); setRuns(n => n + 1);
    if (correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
    progress.commitCheck(describeTrainWork(sent), correct, miss);
    // An easier practice job is ungraded: it records no result of its own.
    if (correct && !isPracticeJob(challenge)) {
      const attempts = progress.currentAttempts + 1;
      progress.mergeResult({ challengeId: challenge.id, correct: true, attempts, score: Math.max(20, 100 - 20 * (attempts - 1)) });
    }
  }, [progress]);

  const highball = useCallback(() => {
    if (!current || blocked || train.engines === 0 || carCount(train) === 0) return;
    const challenge = current, sent = train, run = runTrain(challenge, sent);
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    SoundManager.select();
    // No animation frames (a headless host): the run's outcome is the same, so check it at once.
    if (typeof requestAnimationFrame !== 'function') { finishRun(challenge, sent, run); return; }
    setPhase('running');
    const plan = runTimeline(run, reduce);
    const loadedFraction = run.loaded / challenge.amount;
    const t0 = performance.now();
    const frame = (now: number) => {
      const s = (now - t0) / 1000;
      const at = plan.at(s);
      const canvas = routeRef.current;
      if (canvas) {
        drawRoute(canvas, challenge, sent, { head: at.head, slip: at.slip, puffing: at.puffing, t: now,
          loadedFraction: at.loading ? loadedFraction * (s / plan.load) : loadedFraction,
          showWrong: !at.loading, leftover: at.loading ? 0 : run.leftover });
      }
      if (s >= plan.total) { finishRun(challenge, sent, run); return; }
      animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
  }, [current, blocked, train, finishRun]);

  // ── Evaluation: submit once, only under an evaluation provider ────────────
  useEffect(() => {
    if (!allChallengesComplete || hasSubmitted || challenges.length === 0 || !progress.recordsEvaluation) return;
    const total = challenges.length;
    const correctCount = challengeResults.filter(r => r.correct).length;
    const attemptsCount = challengeResults.reduce((s, r) => s + r.attempts, 0);
    const firstTryCount = challengeResults.filter(r => r.correct && r.attempts === 1).length;
    const accuracy = Math.round(challengeResults.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0)
      / Math.max(total, 1));
    const metrics: TrainYardMetrics = {
      type: 'train-yard', challengeType, totalChallenges: total, correctCount, attemptsCount, firstTryCount,
      hintsViewed: 0, overallAccuracy: accuracy, averageAttemptsPerChallenge: Math.round((attemptsCount / total) * 10) / 10,
    };
    submitResult(correctCount === total, accuracy, metrics, { challengeResults });
  }, [allChallengesComplete, hasSubmitted, challenges, challengeType, challengeResults, submitResult, progress.recordsEvaluation]);

  // ── Pip: the yard as a whole; never a car type (matching the cargo is the task) ──
  const pip = useWorkspacePipSurface({
    instanceId: resolvedInstanceId,
    scopeId: allChallengesComplete || hasSubmitted || !current ? null : current.id,
    label: 'The train yard',
    solved: lastCorrect,
    tutorSpeaking: ctx.isAudioPlaying && (ctx.sessionMode !== 'lesson' || ctx.activePrimitiveId === resolvedInstanceId),
  });

  // What the tutor and the observer see, republished every render.
  useLayoutEffect(() => {
    if (!current || !sessionChallenge) return;
    const scene = trainYardScene(current, { consist: train, phase, lastRun, runs });
    const onScreen = practice ? '' : leverFacts(sessionChallenge, pulledLevers, consist);
    const levers = practice ? [] : trainYardLevers(sessionChallenge, pulledLevers, gradeBand);
    const clearYard = () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      setConsist(emptyConsist()); setPhase('building'); setLastRun(null); setLastMiss(undefined); setLastCorrect(false); setRuns(0);
    };
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find(l => l.id === id);
        if (practice || !lever) return `No lever ${id} on this job.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = simplerJob(sessionChallenge, gradeBand);
          if (!easier) return 'This job has no easier version; try a help lever.';
          setLeverState(pulled); clearYard(); setPractice(easier);
          return { practice: trainYardAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { clearYard(); setPractice(null); },
    };
  });

  const localScore = useMemo(() => phaseResults.length
    ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No rail jobs to run.</LuminaCardContent></LuminaCard>;
  }

  const engine = current ? engineFor(current) : null;
  const road = current && lastRun && phase === 'ran' && lastCorrect ? roadComparison(current, lastRun.loaded) : null;
  const canSend = !blocked && train.engines > 0 && carCount(train) > 0;
  const task: TrainYardTask = current?.type ?? 'build_train';
  const learnerSetsEngines = task === 'enough_pull' || task === 'build_train';
  // match_car offers every kind (choosing is the task); enough_cars puts out only the kind that carries
  // the cargo; enough_pull has coupled the cars already.
  const carKinds: readonly TrainCarType[] = !current || task === 'enough_pull' ? []
    : task === 'enough_cars' ? [carFor(current)] : current.carChoices ?? CAR_ORDER;
  const model = current && leverOn(MODEL_LEVER) ? modelMatch(current) : null;
  const worked = current && leverOn(WORKED_LEVER) ? workedHill(current) : null;
  const weight = current && leverOn(WEIGHT_LEVER) ? trainWeight(current, train) : null;
  const tally = leverOn(TALLY_LEVER) ? carTally(consist) : null;
  const chosen = chosenKind(consist);

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="orange">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
        <LuminaCardDescription>{description}</LuminaCardDescription>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={submittedResult?.score ?? localScore} durationMs={elapsedMs}
            heading="Rail Jobs Complete!" celebrationMessage="Every load made it over the hill." className="mb-6" />
        )}

        {!allChallengesComplete && current && engine && (
          <>
            <LuminaPrompt accent="orange">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-300">Job ticket · {current.title}</div>
                <div>{current.instruction}</div>
                <div className="text-xs text-slate-400">{current.distanceKm} km from {current.from} to {current.to}</div>
              </div>
            </LuminaPrompt>

            {practice && (
              <div data-practice-job="true">
                <LuminaCallout accent="cyan" label="Practice job" className="text-xs">
                  An easier job first. It is not graded; the full job comes back after it.
                </LuminaCallout>
              </div>
            )}

            {(leverOn(PICTURE_LEVER) || model) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {leverOn(PICTURE_LEVER) && (
                  <div data-lever="cargo-picture">
                    <LuminaPanel className="flex items-center gap-3 p-3">
                      <CargoPicture form={current.cargoForm} />
                      <div className="text-sm text-slate-200">
                        <div className="font-semibold capitalize">{current.cargo}</div>
                        <div className="text-xs text-slate-400">{CARGO_LOOKS[current.cargoForm]}</div>
                      </div>
                    </LuminaPanel>
                  </div>
                )}
                {model && (
                  <div data-lever="model-match">
                    <LuminaPanel className="space-y-2 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Example: {model.cargo}</div>
                      <div className="flex items-center gap-2">
                        <CargoPicture form={model.form} />
                        <span className="text-slate-400" aria-hidden="true">&rarr;</span>
                        <div className="w-28 shrink-0"><UnitPicture kind={model.car} /></div>
                      </div>
                      <div className="text-xs text-slate-300">{model.why}</div>
                    </LuminaPanel>
                  </div>
                )}
              </div>
            )}

            {pip.store && <div {...pip.dock} />}
            <div {...pip.workspace} className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-white/10">
                <canvas ref={routeRef} width={1280} height={480} className="block aspect-[8/3] w-full"
                  aria-label={`The route from ${current.from} over ${current.hillName} to ${current.to}`} />
              </div>

              <LuminaPanel className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-200">Your train</span>
                  <span className="text-xs text-slate-400">
                    {train.engines} engine{train.engines === 1 ? '' : 's'} + {carCount(train)} car{carCount(train) === 1 ? '' : 's'}
                  </span>
                </div>
                <canvas ref={stripRef} width={1100} height={128} className="block h-16 w-full" aria-hidden="true" />
                {tally && (
                  <div data-lever="car-tally" className="space-y-1">
                    {tally.length === 0 && (
                      <div className="text-xs text-slate-400">Couple a car: each car will show what the cars so far hold.</div>
                    )}
                    {tally.map(({ kind, totals }) => (
                      <div key={kind} className="flex flex-wrap items-center gap-1 text-[11px]">
                        <span className="mr-1 text-slate-400">{TRAIN_CARS[kind].name}s:</span>
                        {totals.map((t, i) => (
                          <span key={i} data-lever="tally" className="rounded bg-white/10 px-1.5 py-0.5 font-mono tabular-nums text-slate-100">
                            {t.toLocaleString('en-US')}
                          </span>
                        ))}
                        <span className="text-slate-400">{TRAIN_CARS[kind].unit === 'tons' ? 't' : TRAIN_CARS[kind].unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </LuminaPanel>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <LuminaPanel className="space-y-2">
                  <UnitPicture kind={current.cargoForm === 'people' ? 'pax-engine' : 'engine'} />
                  <div className="text-sm font-semibold text-slate-100">{engine.name}</div>
                  <div className="text-xs text-slate-400">{engine.about} · pulls {engine.pull} t · weighs {engine.tons} t</div>
                  {learnerSetsEngines ? (
                    <>
                      <YardCount count={consist.engines} disabled={blocked}
                        onAdd={() => changeEngines(1)} onRemove={() => changeEngines(-1)}
                        addLabel="Add an engine" removeLabel="Remove an engine" />
                      <LuminaCallout accent="amber" label="Rule of the rails" className="mt-2 text-xs">
                        Every 100 t of train needs 1 t of pull for each 1% of hill, plus a little more to roll.
                      </LuminaCallout>
                      {weight && (
                        <div data-lever="train-weight" className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">
                          <div className="font-semibold text-slate-100">Yard scale: {tons(weight.total)}</div>
                          engines {tons(weight.engines)} + cars {tons(weight.cars)} + load {tons(weight.load)}
                        </div>
                      )}
                      {worked && (
                        <div data-lever="worked-hill" className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">
                          <div className="font-semibold text-slate-100">Example train</div>
                          A {tons(worked.tons)} train on a {worked.grade}% hill: {tons(worked.hill)} for the hill
                          + {tons(worked.roll)} to roll = {tons(worked.need)} of pull. At {worked.perEngine} t per engine,
                          that is {worked.engines} engines.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs text-slate-300">The yard couples the engines for this job.</div>
                  )}
                </LuminaPanel>

                {task === 'enough_pull' ? (
                  <LuminaPanel className="space-y-1 p-3">
                    <UnitPicture kind={carFor(current)} />
                    <div className="text-sm font-semibold text-slate-100">The yard has coupled the cars</div>
                    <div className="text-xs text-slate-300">
                      {carCount(train)} {TRAIN_CARS[carFor(current)].name.toLowerCase()}{carCount(train) === 1 ? '' : 's'} carrying {describeLoad(current)}
                    </div>
                  </LuminaPanel>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {carKinds.map(type => {
                      const spec = TRAIN_CARS[type];
                      const name = carButtonName(type);
                      return (
                        <LuminaPanel key={type} className="flex min-w-0 flex-col gap-1.5 p-3">
                          <UnitPicture kind={type} />
                          <div className="text-sm font-semibold text-slate-100">{spec.name}</div>
                          <div className="text-[11px] leading-snug text-slate-400">{spec.builtFor}</div>
                          {task === 'match_car' ? (
                            // No capacity line: with the load and the coupled count on screen it would turn
                            // the match into a division.
                            <LuminaButton tone={chosen === type ? 'primary' : 'ghost'} aria-label={`Choose ${name}`}
                              aria-pressed={chosen === type} disabled={blocked} onClick={() => chooseKind(type)} className="mt-auto">
                              {chosen === type ? 'Chosen' : 'Choose'}
                            </LuminaButton>
                          ) : (
                            <>
                              <div className="text-xs text-slate-300">holds {spec.holds.toLocaleString('en-US')} {spec.unit === 'tons' ? 't' : spec.unit}</div>
                              <YardCount count={consist.cars[type] ?? 0} disabled={blocked}
                                onAdd={() => changeCars(type, 1)} onRemove={() => changeCars(type, -1)}
                                addLabel={`Add ${name}`} removeLabel={`Remove ${name}`} />
                            </>
                          )}
                        </LuminaPanel>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <LuminaButton tone="primary" onClick={highball} disabled={!canSend} className="px-6 text-base font-bold">
                  Highball! Send the train
                </LuminaButton>
                <span className="text-xs text-slate-400">“Highball” is what railroaders say for “all clear, go.”</span>
              </div>

              {phase !== 'running' && lastRun && (
                <LuminaFeedbackCard status={lastCorrect ? 'correct' : 'incorrect'}
                  teachingNote={road ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-100">
                        1 train = {road.count.toLocaleString('en-US')} {road.vehicle}
                      </div>
                      <RoadLine count={road.count} people={current.cargoForm === 'people'} />
                      <div className="text-xs text-slate-400">
                        Lined up with safe gaps, they would stretch about {road.km.toFixed(1)} km.
                        {current.cargoForm !== 'people' && ' A train moves a ton of freight three to four times farther on the same fuel.'}
                      </div>
                    </div>
                  ) : undefined}>
                  <div className="space-y-3">
                    <p>{runMessage(current, lastRun, lastMiss)}</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <LuminaInlineStat label="Loaded" value={describeLoad(current, lastRun.loaded)} />
                      <LuminaInlineStat label="Train weight" value={tons(lastRun.trainTons)} />
                      <LuminaInlineStat label={`${current.hillName} needed`} value={tons(lastRun.hillPull)} accent="amber" />
                      <LuminaInlineStat label="Engines gave" value={tons(lastRun.enginePull)} accent={lastRun.climbs ? 'emerald' : 'rose'} />
                    </div>
                    <p className="text-xs text-slate-400">On flat track this train needs only {tons(lastRun.flatPull)} of pull. The hill is the hard part.</p>
                  </div>
                </LuminaFeedbackCard>
              )}
            </div>
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** Couple or uncouple one unit. Labels are unique on screen so a driver can press them by name. */
const YardCount: React.FC<{ count: number; disabled: boolean; onAdd: () => void; onRemove: () => void;
  addLabel: string; removeLabel: string }> = ({ count, disabled, onAdd, onRemove, addLabel, removeLabel }) => (
  <div className="mt-auto flex items-center gap-2">
    <LuminaButton tone="ghost" aria-label={removeLabel} disabled={disabled || count === 0} onClick={onRemove} className="h-9 w-9 p-0 text-lg">−</LuminaButton>
    <span className="min-w-8 text-center font-mono text-base font-bold tabular-nums text-slate-100" aria-live="polite">{count}</span>
    <LuminaButton tone="ghost" aria-label={addLabel} disabled={disabled} onClick={onAdd} className="h-9 w-9 p-0 text-lg">+</LuminaButton>
  </div>
);

const TrainYard = withWorkspaceOnly<TrainYardProps>('train-yard', TrainYardSurface, props => props.data.title);

/**
 * Rail jobs run only on the teaching workspace: the tutor is present, the train run is the check,
 * and the runtime moves to the next job. Outside a bound session the "needs the tutor" card shows.
 */
export default TrainYard;
