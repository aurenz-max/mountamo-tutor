'use client';

/**
 * Telescope Simulator: a telescope eyepiece on the night sky, and one task per eval mode (rebuilt 2026-10-16 under the
 * 10-15 ruling; the old free sandbox scored exploring and drew every target's name and a ring around it).
 * - find_by_look: unnamed objects in the view; tap the one the ask describes.
 * - brightest: unnamed objects through binoculars, each as bright as it shines; tap the brightest.
 * - object_type: one unnamed object; say or tap its kind.
 * - pick_instrument: say or tap the least powerful instrument that shows a named detail.
 *
 * Every item is built and keyed by code (`telescopeWorkspace.ts`). No name, ring or badge marks an object before the
 * answer is credited. Taught only on the shared tutor/JEV workspace (`withWorkspaceOnly`; its wiring is
 * `telescopeSimulator.card.ts` + `telescopeSimulator.boss.ts`): every check commits through `progress.commitCheck`
 * with a named miss, a spoken answer is judged by the tutor, the runtime owns Try again and Next, and the in-item
 * levers are one lever set in `telescopeLevers.ts`.
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../evaluation';
import type { TelescopeSimulatorMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  LuminaActionButton,
  LuminaAnswerChoice,
  LuminaCard,
  LuminaCardContent,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaFeedbackCard,
  LuminaPanel,
  LuminaPrompt,
  LuminaSectionLabel,
  type AnswerChoiceState,
} from '../../../ui';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../components/live-activity/runtime/useWorkspaceProgress';
import { leverScene } from '../../../components/live-activity/bossLevers';
import {
  askOf, brightFootprint, brightness, capital, choiceKey, choiceLabel, clueTags, describeTelescopeWork, detailDef, emptyWork,
  isTapItem, KIND_TEXT, objectDef, SCOPE_TEXT, scopeRank, shows, skyTarget, tapKey, telescopeCorrect, telescopeItems,
  telescopeMiss, workComplete, workspaceScene,
  type ChoiceItem, type Kind, type LookTag, type Scope, type SkyObjectDef, type TapItem, type TelescopeItem,
  type TelescopeMode, type TelescopeTier, type TelescopeWork,
} from './telescopeWorkspace';
import {
  CLOSER_LEVER, CLUE_PICTURES_LEVER, DROP_LEVER, dropTarget, LADDER_LEVER, ladderLines, MY_PICK_LEVER, myPickLine,
  NO_LEVERS, SAME_SIZE_LEVER, SIDE_BY_SIDE_LEVER, TELESCOPE_LEVERS, TYPE_PICTURES_LEVER, viewScope,
  type TelescopeLeverState,
} from './telescopeLevers';
import { telescopeSimulatorBoss } from './telescopeSimulator.boss';

// ============================================================================
// Data Types (single source of truth; the generator imports them)
// ============================================================================

export type { TelescopeItem, TelescopeMode, TelescopeTier };
/** Legacy names `types.ts` re-exports. */
export type TelescopeType = Scope;
export type SkyViewMode = 'visible';
export type CelestialTarget = SkyObjectDef;
export interface JournalEntry { id: string; objectId: string; objectName: string; timestamp: number; notes: string }

export interface TelescopeSimulatorData {
  title: string;
  description?: string;
  /** One neutral sentence under the title; never names or describes an answer. */
  overview?: string;
  /** Grade rung '2'..'5' (2 is the band floor). */
  gradeLevel?: string;
  /** The eval modes this session asks, in order. */
  challengeTypes?: TelescopeMode[];
  /** config.difficulty: the structural band the items were built at. */
  difficulty?: TelescopeTier;
  /** The items, built and keyed by code at generation; absent or invalid: rebuilt from the fields above. */
  items?: TelescopeItem[];

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<TelescopeSimulatorMetrics>) => void;
}

interface TelescopeSimulatorProps {
  data: TelescopeSimulatorData;
  className?: string;
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

const MODE_LABEL: Record<TelescopeMode, string> = {
  find_by_look: 'Find it by its look', brightest: 'Find the brightest', object_type: 'What kind of object?', pick_instrument: 'Pick the instrument',
};

// ============================================================================
// The eyepiece (bespoke SVG). Draws what it is given; names only once `named`.
// ============================================================================

const VIEW = 400;
const C = 200;
const R = 190;
const BACKGROUND = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  const a = r(1) * Math.PI * 2, d = Math.sqrt(r(2)) * (R - 8);
  return { x: C + Math.cos(a) * d, y: C + Math.sin(a) * d, r: 0.4 + r(3) * 0.5, o: 0.15 + r(4) * 0.3 };
});
/** Twinkling, as an SVG animation (a <style> element would put its text into the page's text). */
const Twinkle = ({ delay = 0 }: { delay?: number }) => <animate attributeName="opacity" values="1;0.45;1" dur="1.8s" begin={`${delay}s`} repeatCount="indefinite" />;

type GlyphMode = 'look' | 'bright' | 'uniform';
/** How opaque an object is drawn in the brightest view: squared, so a magnitude apart reads as a clear step. */
const shine = (o: SkyObjectDef) => 0.15 + 0.85 * brightness(o) ** 2;

/** One object as seen through an instrument. `bright`: drawn as bright as it shines, without twinkling. */
function Glyph({ o, scope, x, y, mode, delay = 0 }: { o: SkyObjectDef; scope: Scope; x: number; y: number; mode: GlyphMode; delay?: number }) {
  const r = scopeRank(scope);
  const b = brightness(o);
  if (mode === 'uniform') return <circle cx={x} cy={y} r={6} fill={o.color} opacity={shine(o)} />;
  const fade = mode === 'bright' ? shine(o) : 1;
  const dot = (steady: boolean) => {
    const core = mode === 'bright' ? 1 + 5 * b : 2.6;
    const glow = mode === 'bright' ? brightFootprint(o) : 9;
    return (
      <g>
        {!steady && mode !== 'bright' && <Twinkle delay={delay} />}
        <circle cx={x} cy={y} r={glow} fill={o.color} opacity={0.22 * fade} />
        <circle cx={x} cy={y} r={core} fill={o.color} opacity={fade} />
        {!steady && mode !== 'bright' && (
          <g stroke={o.color} strokeWidth={0.6} opacity={0.5}>
            <line x1={x - 8} y1={y} x2={x + 8} y2={y} /><line x1={x} y1={y - 8} x2={x} y2={y + 8} />
          </g>
        )}
        {shows(o, 'partner', scope) && <circle cx={x + glow + 3} cy={y - 3} r={1.1} fill="#cbd5e1" opacity={0.85} />}
      </g>
    );
  };
  if (o.kind === 'star') return dot(false);
  if (o.kind === 'planet') {
    if (r === 0 || mode === 'bright') return dot(true);
    const pr = [3, 5, 11, 16, 19][r];
    const dark = '#0b1024';
    return (
      <g>
        {shows(o, 'ring', scope) && <ellipse cx={x} cy={y} rx={pr * 2.1} ry={pr * 0.65} fill="none" stroke={o.color} strokeWidth={2} opacity={0.85} />}
        <circle cx={x} cy={y} r={pr} fill={o.color} />
        {shows(o, 'crescent', scope) && <circle cx={x - pr * 0.45} cy={y} r={pr * 0.95} fill={dark} />}
        {shows(o, 'stripes', scope) && [-0.45, 0, 0.45].map(k => {
          const half = Math.sqrt(1 - k * k) * pr * 0.95;
          return <line key={k} x1={x - half} y1={y + k * pr} x2={x + half} y2={y + k * pr} stroke="#8b5e3c" strokeWidth={pr * 0.14} opacity={0.75} />;
        })}
        {shows(o, 'spot', scope) && <ellipse cx={x + pr * 0.3} cy={y + pr * 0.3} rx={pr * 0.25} ry={pr * 0.14} fill="#c0392b" />}
        {shows(o, 'cap', scope) && <ellipse cx={x} cy={y - pr * 0.78} rx={pr * 0.4} ry={pr * 0.18} fill="#ffffff" />}
        {shows(o, 'moons', scope) && [-2.6, -1.7, 1.8, 2.9].map(k => <circle key={k} cx={x + k * pr - Math.sign(k) * 2} cy={y} r={1.2} fill="#e2e8f0" />)}
      </g>
    );
  }
  if (o.kind === 'moon') {
    const mr = [16, 24, 34, 42, 46][r];
    return (
      <g>
        <circle cx={x} cy={y} r={mr} fill={o.color} />
        {[[0.3, -0.2, 0.28], [-0.25, 0.25, 0.22], [0.1, 0.45, 0.15]].map(([dx, dy, s], i) => (
          <ellipse key={i} cx={x + dx * mr} cy={y + dy * mr} rx={s * mr * 1.2} ry={s * mr} fill="#9a968c" opacity={0.6} />
        ))}
        {shows(o, 'craters', scope) && [[-0.5, -0.4], [0.55, 0.3], [-0.1, -0.65], [-0.55, 0.45], [0.35, -0.55], [0.0, 0.1]].map(([dx, dy], i) => (
          <circle key={i} cx={x + dx * mr} cy={y + dy * mr} r={mr * 0.09} fill="#8f8a80" stroke="#ece8df" strokeWidth={0.6} />
        ))}
      </g>
    );
  }
  if (o.kind === 'cluster') {
    const many = shows(o, 'many', scope);
    const spread = mode === 'bright' ? 17 : [10, 18, 24, 30, 32][r];
    const n = many ? 14 : 7;
    return (
      <g opacity={fade}>
        {Array.from({ length: n }, (_, i) => {
          const a = i * 2.39996, d = spread * Math.sqrt((i + 0.5) / n);
          return <circle key={i} cx={x + Math.cos(a) * d} cy={y + Math.sin(a) * d * 0.8} r={i < 6 ? 1.6 : 1.0} fill={o.color} />;
        })}
      </g>
    );
  }
  if (o.kind === 'nebula') {
    if (r === 0) return <ellipse cx={x} cy={y} rx={8} ry={5} fill={o.color} opacity={0.3} filter="url(#ts-blur)" />;
    const rx = mode === 'bright' ? 20 : [8, 20, 30, 38, 42][r];
    return (
      <g opacity={mode === 'bright' ? fade : 1}>
        <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.7} fill={o.color} opacity={0.45} filter="url(#ts-blur)" />
        <ellipse cx={x + rx * 0.2} cy={y - rx * 0.1} rx={rx * 0.6} ry={rx * 0.45} fill={o.color} opacity={0.55} filter="url(#ts-blur)" />
        {shows(o, 'gap', scope) && <rect x={x - rx} y={y - rx * 0.06} width={rx * 2} height={rx * 0.14} fill="#0b1024" opacity={0.8} transform={`rotate(-20 ${x} ${y})`} />}
        {shows(o, 'four', scope) && [[-0.08, -0.06], [0.08, -0.08], [-0.05, 0.08], [0.1, 0.06]].map(([dx, dy], i) => (
          <circle key={i} cx={x + dx * rx} cy={y + dy * rx} r={1.6} fill="#ffffff" />
        ))}
      </g>
    );
  }
  // galaxy
  if (r === 0) return <ellipse cx={x} cy={y} rx={8} ry={4} fill={o.color} opacity={0.3} filter="url(#ts-blur)" />;
  const rx = mode === 'bright' ? 24 : [8, 22, 34, 42, 46][r];
  return (
    <g opacity={mode === 'bright' ? fade : 1} transform={`rotate(-28 ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx={rx} ry={rx * 0.38} fill={o.color} opacity={0.4} filter="url(#ts-blur)" />
      {shows(o, 'middle', scope) && <ellipse cx={x} cy={y} rx={rx * 0.28} ry={rx * 0.16} fill="#fffaf0" opacity={0.85} filter="url(#ts-blur)" />}
      {shows(o, 'lanes', scope) && [0.12, 0.22].map(k => (
        <ellipse key={k} cx={x} cy={y + k * rx * 0.38} rx={rx * 0.8} ry={rx * 0.1} fill="none" stroke="#0b1024" strokeWidth={1.2} opacity={0.7} />
      ))}
    </g>
  );
}

/** How far out a tap reaches around an object. */
const hitRadius = (o: SkyObjectDef, scope: Scope) => {
  const r = scopeRank(scope);
  if (o.kind === 'moon') return [16, 24, 34, 42, 46][r] + 4;
  if (o.kind === 'planet' && r > 0) return Math.max(22, [3, 5, 11, 16, 19][r] * (o.features.ring ? 2.2 : 1.4));
  if (o.kind === 'nebula' || o.kind === 'galaxy') return Math.max(24, [8, 22, 34, 42, 46][r]);
  if (o.kind === 'cluster') return Math.max(22, [10, 18, 24, 30, 32][r] + 4);
  return 22;
};

interface Mark { index: number; state: 'selected' | 'wrong' | 'right' }

function Eyepiece({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="mx-auto block w-full max-w-[420px] select-none" role="group" aria-label={label}>
      <defs>
        <clipPath id="ts-clip"><circle cx={C} cy={C} r={R} /></clipPath>
        <radialGradient id="ts-sky"><stop offset="0%" stopColor="#0b1024" /><stop offset="100%" stopColor="#050712" /></radialGradient>
        <radialGradient id="ts-vignette"><stop offset="78%" stopColor="#000" stopOpacity={0} /><stop offset="100%" stopColor="#000" stopOpacity={0.85} /></radialGradient>
        <filter id="ts-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={2.2} /></filter>
      </defs>
      <circle cx={C} cy={C} r={R} fill="url(#ts-sky)" />
      <g clipPath="url(#ts-clip)">
        {BACKGROUND.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e2e8f0" opacity={s.o} />)}
        {children}
      </g>
      <circle cx={C} cy={C} r={R} fill="url(#ts-vignette)" pointerEvents="none" />
      <circle cx={C} cy={C} r={R + 4} fill="none" stroke="#1e293b" strokeWidth={10} pointerEvents="none" />
    </svg>
  );
}

// ============================================================================
// Lever pictures (models outside the item)
// ============================================================================

/** clue_pictures: a model picture for one clue. Grey models; a colour clue is a plain swatch. */
function ClueIcon({ tag, color }: { tag: LookTag; color: string }) {
  const g = '#94a3b8';
  const id = tag.id;
  const body = (() => {
    if (id.startsWith('color:')) return <circle cx={18} cy={18} r={11} fill={color} />;
    if (id === 'size:big') return <><circle cx={10} cy={22} r={4} fill={g} opacity={0.5} /><circle cx={24} cy={16} r={10} fill={g} /></>;
    if (id === 'noun:ball') return <circle cx={18} cy={18} r={10} fill={g} />;
    if (id === 'noun:dot') return <><circle cx={18} cy={18} r={7} fill={g} opacity={0.25} /><circle cx={18} cy={18} r={2.5} fill={g} /></>;
    if (id === 'noun:crescent') return <><circle cx={18} cy={18} r={10} fill={g} /><circle cx={13} cy={18} r={9.5} fill="#0f172a" /></>;
    if (id === 'noun:group') return <>{[[12, 12], [20, 10], [25, 17], [15, 20], [22, 24], [10, 24], [18, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.6} fill={g} />)}</>;
    if (id === 'noun:cloud' || id === 'noun:smudge') return <ellipse cx={18} cy={18} rx={13} ry={9} fill={g} opacity={id === 'noun:cloud' ? 0.6 : 0.3} filter="url(#ts-icon-blur)" />;
    if (id === 'noun:oval') return <ellipse cx={18} cy={18} rx={14} ry={5} fill={g} opacity={0.6} transform="rotate(-25 18 18)" filter="url(#ts-icon-blur)" />;
    if (id === 'with:ring') return <><ellipse cx={18} cy={18} rx={15} ry={4.5} fill="none" stroke={g} strokeWidth={1.6} /><circle cx={18} cy={18} r={7} fill={g} /></>;
    if (id === 'with:stripes') return <><circle cx={18} cy={18} r={10} fill={g} />{[-4, 0, 4].map(k => <line key={k} x1={9} y1={18 + k} x2={27} y2={18 + k} stroke="#475569" strokeWidth={1.4} />)}</>;
    if (id === 'with:moons') return <><circle cx={18} cy={18} r={5} fill={g} />{[5, 9, 27, 32].map(x => <circle key={x} cx={x} cy={18} r={1.2} fill={g} />)}</>;
    if (id === 'with:spot') return <><circle cx={18} cy={18} r={10} fill={g} /><ellipse cx={21} cy={21} rx={3} ry={1.8} fill="#c0392b" /></>;
    if (id === 'with:cap') return <><circle cx={18} cy={18} r={10} fill={g} /><ellipse cx={18} cy={10} rx={4} ry={2} fill="#fff" /></>;
    if (id === 'with:craters' || id === 'with:patches') return <><circle cx={18} cy={18} r={11} fill={g} />{[[14, 14], [22, 20], [16, 23]].map(([x, y], i) => id === 'with:craters'
      ? <circle key={i} cx={x} cy={y} r={2} fill="#64748b" stroke="#e2e8f0" strokeWidth={0.5} /> : <ellipse key={i} cx={x} cy={y} rx={3.5} ry={2.5} fill="#64748b" />)}</>;
    if (id === 'with:partner') return <><circle cx={15} cy={19} r={2.5} fill={g} /><circle cx={23} cy={15} r={1} fill={g} /></>;
    if (id === 'with:four') return <><ellipse cx={18} cy={18} rx={13} ry={9} fill={g} opacity={0.35} />{[[15, 16], [21, 15], [16, 21], [22, 20]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.4} fill="#fff" />)}</>;
    if (id === 'with:gap') return <><ellipse cx={18} cy={18} rx={13} ry={9} fill={g} opacity={0.45} /><rect x={5} y={16.5} width={26} height={3} fill="#0f172a" transform="rotate(-20 18 18)" /></>;
    if (id === 'with:middle') return <><ellipse cx={18} cy={18} rx={14} ry={5} fill={g} opacity={0.4} /><ellipse cx={18} cy={18} rx={4} ry={2.4} fill="#fff" /></>;
    if (id === 'with:lanes') return <><ellipse cx={18} cy={18} rx={14} ry={5} fill={g} opacity={0.5} /><ellipse cx={18} cy={19} rx={11} ry={1.6} fill="none" stroke="#0f172a" strokeWidth={1} /></>;
    if (id === 'how:twinkles') return <g><Twinkle /><path d="M18 6 L20 16 L30 18 L20 20 L18 30 L16 20 L6 18 L16 16 Z" fill={g} /></g>;
    if (id === 'how:steady') return <circle cx={18} cy={18} r={6} fill={g} />;
    return <circle cx={18} cy={18} r={6} fill={g} />;
  })();
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" aria-hidden="true">
      <defs><filter id="ts-icon-blur"><feGaussianBlur stdDeviation={1.2} /></filter></defs>
      {body}
    </svg>
  );
}

/** type_pictures: a simple model of each kind, never the item's own object. */
function KindModel({ kind }: { kind: Kind }) {
  const g = '#cbd5e1';
  const body = {
    moon: <><circle cx={24} cy={24} r={16} fill={g} />{[[18, 18], [30, 26], [22, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.5} fill="#94a3b8" />)}</>,
    planet: <circle cx={24} cy={24} r={9} fill={g} />,
    star: <><circle cx={24} cy={24} r={8} fill={g} opacity={0.25} /><circle cx={24} cy={24} r={2.5} fill={g} /><line x1={14} y1={24} x2={34} y2={24} stroke={g} strokeWidth={0.6} /><line x1={24} y1={14} x2={24} y2={34} stroke={g} strokeWidth={0.6} /></>,
    cluster: <>{Array.from({ length: 12 }, (_, i) => { const a = i * 2.4, d = 14 * Math.sqrt((i + 0.5) / 12); return <circle key={i} cx={24 + Math.cos(a) * d} cy={24 + Math.sin(a) * d} r={1.3} fill={g} />; })}</>,
    nebula: <ellipse cx={24} cy={24} rx={17} ry={12} fill="#a78bfa" opacity={0.55} filter="url(#ts-model-blur)" />,
    galaxy: <g transform="rotate(-25 24 24)"><ellipse cx={24} cy={24} rx={19} ry={7} fill={g} opacity={0.45} filter="url(#ts-model-blur)" /><ellipse cx={24} cy={24} rx={5} ry={3} fill="#fff" opacity={0.8} /></g>,
  }[kind];
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" aria-hidden="true">
      <defs><filter id="ts-model-blur"><feGaussianBlur stdDeviation={1.8} /></filter></defs>
      <rect width={48} height={48} rx={8} fill="#0b1024" />
      {body}
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

type LeverMemo = { item: string } & TelescopeLeverState;

const useTelescopeProgress = useWorkspaceProgressFor('telescope-simulator');

const TelescopeSimulatorSurface = ({ data, className, runtimePlanItemId }: TelescopeSimulatorProps) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const { title, overview, description, instanceId, skillId, subskillId, objectiveId, exhibitId, onEvaluationSubmit } = data;

  const items = useMemo(() => telescopeItems(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.items, data.challengeTypes, data.difficulty, data.title, data.gradeLevel]);
  const stableInstanceId = useRef(instanceId || `telescope-simulator-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;
  const startTime = useRef(Date.now());

  // ── Progress: the runtime moves the index (callbacks bound below) ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const solvedAloud = useRef<(index: number) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useTelescopeProgress({
    challenges: items,
    getChallengeId: i => i.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: telescopeSimulatorBoss.assignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onSolved: index => solvedAloud.current(index),
    onFinished: result => finish.current(result),
  });
  const { currentIndex, currentAttempts, results, isComplete } = progress;
  /** A checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => progress.canAttempt === false;

  const item: TelescopeItem | undefined = items[Math.min(currentIndex, Math.max(items.length - 1, 0))];
  const [work, setWork] = useState<TelescopeWork>(emptyWork);
  /** The checked wrong work, shown until Try again. */
  const [wrongShown, setWrongShown] = useState(false);
  const [leverMemo, setLeverMemo] = useState<LeverMemo>({ item: '', ...NO_LEVERS });
  const [submitted, setSubmitted] = useState(false);
  /** The item a correct tap already recorded, so its `onSolved` records nothing twice. */
  const tappedCorrect = useRef<string | null>(null);

  const lever: TelescopeLeverState = item && leverMemo.item === item.id ? leverMemo : NO_LEVERS;
  const editLevers = (change: (s: TelescopeLeverState) => Partial<TelescopeLeverState>) => {
    const id = item?.id ?? '';
    setLeverMemo(m => { const s = m.item === id ? m : { item: id, ...NO_LEVERS }; return { ...s, ...change(s), item: id }; });
  };
  const leverOn = (id: string) => lever.pulled.includes(id);

  const revealed = !!item && results.some(r => r.challengeId === item.id && r.correct);

  const { submitResult, hasSubmitted } = usePrimitiveEvaluation<TelescopeSimulatorMetrics>({
    primitiveType: 'telescope-simulator',
    instanceId: resolvedInstanceId,
    skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  openItem.current = (_index, retry) => {
    setWork(emptyWork()); setWrongShown(false);
    if (retry) editLevers(s => ({ wrongs: s.wrongs + 1 }));
  };

  /** A spoken answer the observer credited: recorded as a correct tap records it, and shown the same way. */
  solvedAloud.current = (index) => {
    const solved = items[index];
    if (!solved || isTapItem(solved) || tappedCorrect.current === solved.id || results.some(r => r.challengeId === solved.id && r.correct)) return;
    progress.mergeResult({ challengeId: solved.id, correct: true, attempts: currentAttempts + 1 });
    setWork({ pick: null, choice: choiceKey(solved) }); setWrongShown(false);
  };

  // ── Handlers ──
  const closed = revealed || wrongShown || learnerBlocked();
  const tapObject = (i: number) => {
    if (!item || !isTapItem(item) || closed || lever.dropped.includes(i)) return;
    SoundManager.select();
    setWork({ pick: i, choice: null });
  };
  const choose = (c: string) => {
    if (!item || isTapItem(item) || closed) return;
    const i = (item.choices as string[]).indexOf(c);
    if (lever.dropped.includes(i)) return;
    SoundManager.select();
    setWork({ pick: null, choice: c });
  };

  const check = () => {
    if (!item || closed || !workComplete(item, work)) return;
    const correct = telescopeCorrect(item, work);
    progress.commitCheck(describeTelescopeWork(item, work, viewScope(item, lever)), correct, correct ? undefined : telescopeMiss(item, work));
    if (correct) { SoundManager.playCorrect(); tappedCorrect.current = item.id; return; }
    SoundManager.playIncorrect();
    const at = isTapItem(item) ? work.pick! : (item.choices as string[]).indexOf(work.choice!);
    editLevers(s => ({ picked: [...s.picked, at], lastPick: item.mode === 'pick_instrument' ? (work.choice as Scope) : s.lastPick }));
    setWrongShown(true);
  };

  const metrics = (): TelescopeSimulatorMetrics => {
    const right = items.filter(i => results.some(r => r.challengeId === i.id && r.correct));
    const scopes = Array.from(new Set(items.map(i => (i.mode === 'pick_instrument' ? detailDef(i.detail)!.min : i.scope))));
    return {
      type: 'telescope-simulator',
      targetObjectsTotal: items.length,
      targetObjectsFound: right.length,
      allTargetsFound: items.length > 0 && right.length === items.length,
      observationsLogged: 0,
      focusAccuracy: 100,
      focusMode: 'auto',
      objectsExplored: right.length,
      viewModesUsed: ['visible'],
      telescopeTypesUsed: scopes,
      magnificationRange: [1, 1],
      timeSpent: Date.now() - startTime.current,
      panDistance: 0,
    };
  };

  // Under a lesson's evaluation provider only: the scored session.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false || !items.length) return;
    setSubmitted(true);
    submitResult(result.passed, result.accuracy, { ...metrics(), targetObjectsFound: result.solvedCount },
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── What the tutor and the observer are shown, republished every render ──
  useLayoutEffect(() => {
    if (!item || (isComplete && !revealed)) return;
    const scope = item.mode === 'pick_instrument' && revealed ? detailDef(item.detail)!.min : viewScope(item, lever);
    const scene = workspaceScene(item, { work, solved: revealed, scope });
    const ctx = { state: lever };
    const levers = revealed ? [] : TELESCOPE_LEVERS.declare(item, ctx, lever.pulled);
    workspace.current = {
      ...leverScene(scene, { support: '', onScreen: TELESCOPE_LEVERS.onScreen(item, ctx, lever.pulled) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const l = levers.find(x => x.id === id);
        if (!l) return `No lever ${id} on this item.`;
        if (l.pulled) return `${id} is already on screen.`;
        if (id === DROP_LEVER) {
          const far = dropTarget(item, lever);
          if (far === null) return 'Nothing more can be greyed out here; too few would be left.';
          editLevers(s => ({ pulled: [...s.pulled, id], dropped: [...s.dropped, far] }));
          if (isTapItem(item) ? work.pick === far : (item.choices as string[]).indexOf(work.choice ?? '') === far) setWork(emptyWork());
          return true;
        }
        if (id === MY_PICK_LEVER && !lever.lastPick) return 'The learner has not tapped an instrument yet.';
        editLevers(s => ({ pulled: [...s.pulled, id] }));
        return true;
      },
    };
  });

  // The last credited item stays on screen (its names and detail) until the session is submitted.
  const done = hasSubmitted || submitted || (isComplete && !revealed);

  if (!items.length) {
    return (
      <LuminaCard className={className}>
        <LuminaCardHeader><LuminaCardTitle>{title || 'Telescope Simulator'}</LuminaCardTitle></LuminaCardHeader>
        <LuminaCardContent><p className="text-sm text-slate-400">This telescope has nothing to ask.</p></LuminaCardContent>
      </LuminaCard>
    );
  }

  // ── Render pieces ──
  const scope = item ? viewScope(item, lever) : 'small';
  const shownScope: Scope = item?.mode === 'pick_instrument' && revealed ? detailDef(item.detail)!.min : scope;

  const renderTapView = (it: TapItem) => {
    const key = tapKey(it);
    const glyphMode: GlyphMode = it.mode === 'brightest' ? (leverOn(SAME_SIZE_LEVER) ? 'uniform' : 'bright') : 'look';
    const marks: Mark[] = [];
    if (revealed) marks.push({ index: key, state: 'right' });
    if (work.pick !== null && !(revealed && work.pick === key)) marks.push({ index: work.pick, state: wrongShown || (revealed && work.pick !== key) ? 'wrong' : 'selected' });
    return (
      <Eyepiece label={`The view ${SCOPE_TEXT[scope].with}`}>
        {it.objects.map((p, i) => {
          const o = objectDef(p.object)!;
          const dropped = lever.dropped.includes(i);
          const hit = glyphMode === 'look' ? hitRadius(o, scope) : 24;
          const mark = marks.find(m => m.index === i);
          return (
            <g key={p.object} data-pip-object={skyTarget(i)} role="button" aria-label={`Option ${i + 1}`}
              data-dropped={dropped || undefined} opacity={dropped ? 0.15 : 1}
              style={{ cursor: closed || dropped ? 'default' : 'pointer' }} onClick={() => tapObject(i)}>
              <circle cx={p.x} cy={p.y} r={hit} fill="transparent" style={{ pointerEvents: 'all' }} />
              <Glyph o={o} scope={scope} x={p.x} y={p.y} mode={glyphMode} delay={i * 0.37} />
              {mark && (
                <circle cx={p.x} cy={p.y} r={hit + 3} fill="none" strokeWidth={1.6}
                  stroke={mark.state === 'right' ? '#4ade80' : mark.state === 'wrong' ? '#f87171' : '#e2e8f0'}
                  strokeDasharray={mark.state === 'selected' ? '4 3' : undefined} />
              )}
              {revealed && (
                <text x={p.x} y={p.y + hit + 14} textAnchor="middle" fontSize={11} fill={i === key ? '#bbf7d0' : '#94a3b8'}>{capital(o.name)}</text>
              )}
            </g>
          );
        })}
      </Eyepiece>
    );
  };

  const renderCenterView = (it: ChoiceItem) => {
    const o = objectDef(it.mode === 'object_type' ? it.object : detailDef(it.detail)!.object)!;
    return (
      <Eyepiece label={`One object ${SCOPE_TEXT[shownScope].with}`}>
        <Glyph o={o} scope={shownScope} x={C} y={C} mode="look" />
        {revealed && <text x={C} y={C + hitRadius(o, shownScope) + 18} textAnchor="middle" fontSize={12} fill="#bbf7d0">{capital(o.name)}</text>}
      </Eyepiece>
    );
  };

  const choiceState = (it: ChoiceItem, c: string, i: number): AnswerChoiceState => {
    if (lever.dropped.includes(i)) return 'dimmed';
    const key = choiceKey(it);
    if (revealed) return c === key ? 'correct' : c === work.choice ? 'incorrect' : 'dimmed';
    if (wrongShown && work.choice === c) return 'incorrect';
    return work.choice === c ? 'selected' : 'idle';
  };

  const tapItem = item && isTapItem(item) ? item : null;
  const choiceItem = item && !isTapItem(item) ? item : null;
  const keyObject = tapItem?.mode === 'find_by_look' ? objectDef(tapItem.objects[tapKey(tapItem)]?.object ?? '') : undefined;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader>
        <LuminaCardTitle>{`🔭 ${title || 'Telescope Simulator'}`}</LuminaCardTitle>
        {!done && item && (
          <LuminaSectionLabel accent="cyan" size="sm">
            {`${MODE_LABEL[item.mode]} · item ${Math.min(currentIndex, items.length - 1) + 1} of ${items.length}`}
          </LuminaSectionLabel>
        )}
        {(overview || description) && !done && <p className="text-sm text-slate-400">{overview || description}</p>}
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {done ? (
          <LuminaFeedbackCard status="insight" label="Observing complete">
            {`${results.filter(r => r.correct).length} of ${items.length} answered.`}
          </LuminaFeedbackCard>
        ) : item && (
          <>
            <LuminaPrompt accent="cyan">{askOf(item)}</LuminaPrompt>

            {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the view and the choices as its region. */}
            <PipDock />
            <PipWorkspace className="space-y-3">
              {tapItem ? renderTapView(tapItem) : choiceItem ? renderCenterView(choiceItem) : null}
              <p className="text-center text-xs text-slate-400" data-seen-through={shownScope}>
                {`Seen ${SCOPE_TEXT[shownScope].with}${tapItem || choiceItem?.mode === 'object_type' ? ' · sizes not to scale' : ''}`}
              </p>
              {leverOn(CLOSER_LEVER) && !revealed && <p data-lever="closer-look" className="text-center text-xs text-cyan-200">{`Now closer: ${SCOPE_TEXT[scope].button}`}</p>}
              {choiceItem?.mode === 'pick_instrument' && revealed && (
                <p className="text-center text-sm text-emerald-200">{`${SCOPE_TEXT[detailDef(choiceItem.detail)!.min].button}: ${detailDef(choiceItem.detail)!.text} can be seen.`}</p>
              )}

              {tapItem?.mode === 'find_by_look' && leverOn(CLUE_PICTURES_LEVER) && keyObject && (
                <LuminaPanel accent="cyan" data-lever="clue-pictures" className="flex flex-wrap justify-center gap-4">
                  {clueTags(tapItem.clues, keyObject, tapItem.scope).map(t => (
                    <div key={t.id} className="flex flex-col items-center gap-1 text-xs text-slate-300">
                      <ClueIcon tag={t} color={keyObject.color} /><span>{t.text}</span>
                    </div>
                  ))}
                </LuminaPanel>
              )}
              {tapItem?.mode === 'brightest' && leverOn(SIDE_BY_SIDE_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="side-by-side" className="flex justify-center">
                  <svg width={260} height={44} viewBox="0 0 260 44" aria-label="The objects in a row, the same size">
                    <rect width={260} height={44} rx={8} fill="#050712" />
                    {[...tapItem.objects].map((p, i) => ({ p, i })).sort((a, b) => a.p.x - b.p.x).map(({ p }, k, row) => {
                      const o = objectDef(p.object)!;
                      return <circle key={p.object} cx={(k + 1) * (260 / (row.length + 1))} cy={22} r={7} fill={o.color} opacity={shine(o)} />;
                    })}
                  </svg>
                </LuminaPanel>
              )}
              {choiceItem?.mode === 'object_type' && leverOn(TYPE_PICTURES_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="type-pictures" className="flex flex-wrap justify-center gap-4">
                  {choiceItem.choices.map(k => (
                    <div key={k} className="flex flex-col items-center gap-1 text-xs text-slate-300"><KindModel kind={k} /><span>{KIND_TEXT[k]}</span></div>
                  ))}
                </LuminaPanel>
              )}
              {choiceItem?.mode === 'pick_instrument' && leverOn(LADDER_LEVER) && (
                <LuminaPanel accent="cyan" data-lever="ladder" className="space-y-1 text-sm text-slate-300">
                  {ladderLines().map(l => <p key={l}>{l}</p>)}
                </LuminaPanel>
              )}
              {choiceItem?.mode === 'pick_instrument' && leverOn(MY_PICK_LEVER) && !revealed && (
                <LuminaPanel accent="cyan" data-lever="my-pick" className="text-sm text-slate-300">{myPickLine(choiceItem, lever.lastPick)}</LuminaPanel>
              )}

              {choiceItem && (
                <div className={`grid gap-2 ${choiceItem.choices.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : choiceItem.choices.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {(choiceItem.choices as string[]).map((c, i) => (
                    <LuminaAnswerChoice key={c} aria-label={choiceLabel(choiceItem, c)} state={choiceState(choiceItem, c, i)}
                      disabled={closed || lever.dropped.includes(i)} data-dropped={lever.dropped.includes(i) || undefined}
                      className="p-3 text-center font-semibold" onClick={() => choose(c)}>
                      {choiceLabel(choiceItem, c)}
                    </LuminaAnswerChoice>
                  ))}
                </div>
              )}
            </PipWorkspace>

            {!revealed && (
              <div className="flex justify-center">
                <LuminaActionButton action="check" disabled={closed || !workComplete(item, work)} onClick={check}>Check Answer</LuminaActionButton>
              </div>
            )}
            {revealed && <LuminaFeedbackCard status="correct">{revealText(item)}</LuminaFeedbackCard>}
            {!revealed && wrongShown && <LuminaFeedbackCard status="incorrect">That is not it.</LuminaFeedbackCard>}
          </>
        )}
      </LuminaCardContent>
    </LuminaCard>
  );
};

/** The worked explanation once an item is credited. */
function revealText(item: TelescopeItem): string {
  if (item.mode === 'find_by_look') {
    const o = objectDef(item.objects[tapKey(item)].object)!;
    return `${capital(o.name)} is ${describeTagsShort(item)}: it is the only one in the view that shows every clue.`;
  }
  if (item.mode === 'brightest') {
    const o = objectDef(item.objects[tapKey(item)].object)!;
    return `${capital(o.name)} shines the brightest here. A big fuzzy patch can look large and still be faint.`;
  }
  if (item.mode === 'object_type') {
    const o = objectDef(item.object)!;
    return `${capital(o.name)} is a ${KIND_TEXT[o.kind].toLowerCase()}.`;
  }
  const d = detailDef(item.detail)!;
  return `${SCOPE_TEXT[d.min].button} is the least powerful instrument that shows ${d.text}. More powerful ones show it too.`;
}
const describeTagsShort = (item: TelescopeItem & { mode: 'find_by_look' }) => askOf(item).replace(/^Find /, '').replace(/\.$/, '');

const TelescopeSimulator = withWorkspaceOnly<TelescopeSimulatorProps>('telescope-simulator', TelescopeSimulatorSurface, props => props.data.title);

export default TelescopeSimulator;
