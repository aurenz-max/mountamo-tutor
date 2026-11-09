'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardContent,
  LuminaBadge, LuminaButton, LuminaActionButton, LuminaChallengeCounter, LuminaFeedbackCard, LuminaPanel, LuminaPrompt,
} from '../../../../ui';
import { usePrimitiveEvaluation, type PrimitiveEvaluationResult } from '../../../../evaluation';
import type { LifeLabMetrics } from '../../../../evaluation/types';
import type { TeachingWorkspace } from '../../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceOnly } from '../../../../components/live-activity/runtime/withTeachingWorkspace';
import { useWorkspaceProgressFor } from '../../../../components/live-activity/runtime/useWorkspaceProgress';
import type { AuthoredLever } from '../../../../service/agent-kit/levers';
import { useAuthoredLevers } from '../../../../service/agent-kit/useAuthoredLevers';
import { DISPLAY_CSS } from '../../../../service/agent-kit/displays';
import { KitDisplay } from '../../../../service/agent-kit/KitDisplay';
import { SurfaceBoard, useSurfaceAnswer } from '../../../../service/agent-kit/SurfaceBoard';
import { TeachPanel, useTeachPictures } from '../../../../service/agent-kit/TeachPanel';
import { describeSurfaceWork, surfaceScene } from '../../../../service/agent-kit/surfaceScene';
import { answerReady, gradeAnswer, missHint, type Surface, type SurfaceItem } from '../../../../service/agent-kit/surfaces';
import type { TeachStep } from '../../../../service/agent-kit/teach';
import { usePhaseResults, type PhaseConfig, practiceScore } from '../../../../hooks/usePhaseResults';
import PhaseSummaryPanel from '../../../../components/PhaseSummaryPanel';
import { SoundManager } from '../../../../utils/SoundManager';
import { PipDock, PipWorkspace } from '../../../../pip/WorkspacePip';
import { CARRIER_SCENE, COND_ICON, COND_KEYS, COND_WORDS, GROUND_SCENE, SHADE_FILL, TOKEN_WORDS, organism, type CondKey, type Level } from './lifeLabAtlas';
import {
  LIFE_MODES, MODE_LABELS, beingOf, canRun, classify, describeWork, featureWords, goalMet, initState, itemsOf, missOf, normalizeWorld, optionsOf,
  outcomeText, simulate, type Difficulty, type LifeLabMode, type LifeRun, type LifeState, type LifeWorld, type Option,
} from './lifeLabWorld';
import { lifeScene, withTeaching, type LifeTry } from './lifeLabWorkspace';
import { lifeLabBoss, lifeLabLevers } from './lifeLab.boss';

// ============================================================================
// Data contract
// ============================================================================

export interface LifeLabChallenge {
  id: string;
  /** The skill label code read from the finished world's structure, or the kit surface of an item. */
  type: LifeLabMode | Surface;
  /** A small living world the child changes and runs. Exactly one of `world` and `item`. */
  world?: LifeWorld;
  /** A kit item: drawn cards the child picks, sorts or orders. */
  item?: SurfaceItem;
  /** What the child is shown before the task opens (the author's frames, played by the kit's teach step). */
  teach?: TeachStep[];
  /** What the tutor asks (the agent's words, checked for leaks). */
  ask: string;
  /** The why-card after a wrong check on a world: how to look again, never the answer. */
  why: string;
  standards: string;
  difficulty: Difficulty;
  /** What the child produces: said (and tapped) or shown. Absent: code's default for the answer (`lifeLabSpoken.ts`). */
  respond?: 'show' | 'say';
  /** The world's own help and simplify levers, authored with it and checked by code (`service/agent-kit/levers.ts`). */
  levers?: AuthoredLever<LifeLabChallenge>[];
}

export interface LifeLabData {
  title: string;
  description: string;
  /** 2-5 worlds. REQUIRED. Composed by the author agent, built and checked by code. */
  challenges: LifeLabChallenge[];
  challengeType: LifeLabMode | Surface;
  gradeBand: 'K-2' | '3-5';
  /** How the session was authored (for QA; never shown). */
  agentDebug?: Record<string, unknown>;

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<LifeLabMetrics>) => void;
}

interface LifeLabProps {
  data: LifeLabData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

const ICONS: Record<LifeLabMode, string> = {
  where_it_lives: '🏞️', what_it_needs: '🌻', part_for_the_job: '🐦', hide_from_the_hunter: '🦋', whose_baby: '🐶',
  spread_the_seeds: '🌰', life_cycle: '🔄', follow_the_path: '🫁', survive_and_change: '🌳', fair_test: '🧪',
};
const PHASE_TYPE_CONFIG: Record<string, PhaseConfig> = {
  ...Object.fromEntries(LIFE_MODES.map(m => [m, { label: MODE_LABELS[m], icon: ICONS[m], accentColor: 'emerald' as const }])),
  choose: { label: 'Choose', icon: '👆', accentColor: 'emerald' }, categorize: { label: 'Sort', icon: '🗂️', accentColor: 'emerald' }, order: { label: 'Order', icon: '🔢', accentColor: 'emerald' },
};
const STEP_MS = 520;

// ── Pictures (deterministic from the data) ──────────────────────────────────

const Plant: React.FC<{ h: number; wilt: boolean; flower?: boolean }> = ({ h, wilt, flower }) => {
  const H = 110, base = H - 6, c = wilt ? '#9b7b45' : '#4ade80', stem = 10 + h * 15, top = base - stem;
  return (
    <svg viewBox={`0 0 80 ${H}`} width={60} height={84} aria-hidden="true">
      <path d={`M40 ${base} Q ${wilt ? 50 : 40} ${top + stem / 2} ${wilt ? 58 : 40} ${top + (wilt ? 10 : 0)}`} stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" />
      {Array.from({ length: h }, (_, i) => {
        const y = base - (i + 1) * 15 + 4, x = i % 2 ? 49 : 31;
        return <ellipse key={i} cx={x} cy={y + (wilt ? 6 : 0)} rx={10} ry={4.5} fill={c} transform={`rotate(${(i % 2 ? 25 : -25) * (wilt ? -1.6 : 1)} ${x} ${y})`} />;
      })}
      {flower && !wilt && h >= 4 && <circle cx={40} cy={top} r={8} fill="#facc15" stroke="#a16207" />}
    </svg>
  );
};
const Moth: React.FC<{ color: string; size?: number }> = ({ color, size = 34 }) => {
  const f = SHADE_FILL[color] ?? '#999', st = color === 'dark' || color === 'brown' ? '#8a7d70' : '#57534e';
  return (
    <svg viewBox="0 0 40 30" width={size} height={size * 0.75} aria-hidden="true">
      <ellipse cx={12} cy={14} rx={11} ry={9} fill={f} stroke={st} /><ellipse cx={28} cy={14} rx={11} ry={9} fill={f} stroke={st} />
      <ellipse cx={20} cy={15} rx={2.5} ry={9} fill="#4a3d30" />
    </svg>
  );
};
const Bug: React.FC<{ color: string; size?: number }> = ({ color, size = 34 }) => (
  <svg viewBox="0 0 40 30" width={size} height={size * 0.75} aria-hidden="true">
    {[8, 15, 22].map(y => <path key={y} d={`M10 ${y} L2 ${y + 3} M30 ${y} L38 ${y + 3}`} stroke="#44403c" strokeWidth={1.5} />)}
    <ellipse cx={20} cy={16} rx={11} ry={12} fill={SHADE_FILL[color] ?? '#999'} stroke="#44403c" /><circle cx={20} cy={4} r={4} fill="#44403c" />
  </svg>
);
/** A hunted animal, drawn in its coloring. */
const Prey: React.FC<{ draws?: string; color: string; size?: number }> = ({ draws, color, size }) =>
  (draws === 'bug' ? <Bug color={color} size={size} /> : <Moth color={color} size={size} />);
const BG_TONE: Record<string, string> = {
  dark: 'bg-stone-800', light: 'bg-stone-300/70 text-stone-900', green: 'bg-green-700/70', brown: 'bg-amber-900/70',
  white: 'bg-slate-100/80 text-slate-900', sandy: 'bg-amber-300/60 text-amber-950',
};
const BEAKS: Record<string, string> = { long: 'M60 42 L100 46 L60 48 Z', thick: 'M57 34 L82 45 L57 56 Z', hook: 'M58 37 Q 86 34 82 56 Q 76 46 58 52 Z', spear: 'M60 39 L104 45 L60 51 Z' };
const Bird: React.FC<{ beak?: string; size?: number }> = ({ beak, size = 96 }) => (
  <svg viewBox="0 0 110 80" width={size} height={size * 0.73} aria-hidden="true">
    <ellipse cx={34} cy={52} rx={26} ry={18} fill="#c98f3a" /><circle cx={44} cy={40} r={17} fill="#d9a441" />
    <circle cx={49} cy={36} r={3} fill="#1c1a17" />{beak && <path d={BEAKS[beak]} fill="#5b3b20" />}
    <path d="M14 56 L2 62 L14 64 Z" fill="#a8742c" />
  </svg>
);
const Seed: React.FC<{ shape?: string; size?: number }> = ({ shape, size = 70 }) => (
  <svg viewBox="0 0 80 64" width={size} height={size * 0.8} aria-hidden="true">
    {shape === 'wings' && <><path d="M40 40 Q 10 20 6 44 Q 22 40 40 40 Z" fill="#c9a86a" /><path d="M40 40 Q 70 20 74 44 Q 58 40 40 40 Z" fill="#c9a86a" /></>}
    {shape === 'fluff' && <><line x1={40} y1={34} x2={40} y2={14} stroke="#8a7a60" strokeWidth={1.5} />
      {Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (i / 10), x = 40 + Math.cos(a) * 16, y = 14 - Math.sin(a) * 12;
        return <g key={i}><line x1={40} y1={14} x2={x} y2={y} stroke="#bdb39f" strokeWidth={1.2} /><circle cx={x} cy={y} r={1.6} fill="#d8d0bd" /></g>; })}</>}
    {shape === 'hooks' && Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4;
      return <path key={i} d={`M${40 + Math.cos(a) * 9} ${40 + Math.sin(a) * 7.5} L${40 + Math.cos(a) * 15} ${40 + Math.sin(a) * 13} q 3 -1 2 3`} stroke="#c08a5a" strokeWidth={1.6} fill="none" />; })}
    {shape === 'hollow' ? <ellipse cx={40} cy={40} rx={14} ry={10} fill="#e7d7b4" stroke="#7a5130" strokeWidth={2} /> : <ellipse cx={40} cy={40} rx={9} ry={7} fill="#7a5130" />}
  </svg>
);
const FEET: Record<string, React.ReactNode> = {
  webbed: <path d="M20 10 L8 46 Q 20 40 24 50 Q 30 40 36 50 Q 42 40 52 46 L36 10 Z" fill="#f59e0b" stroke="#92400e" />,
  snowshoe: <><ellipse cx={30} cy={34} rx={22} ry={16} fill="#e5e7eb" stroke="#9ca3af" />{[16, 26, 36, 46].map(x => <circle key={x} cx={x} cy={20} r={5} fill="#d1d5db" />)}</>,
  claws: <><ellipse cx={30} cy={36} rx={14} ry={11} fill="#a16207" />{[18, 26, 34, 42].map(x => <path key={x} d={`M${x} 26 Q ${x - 2} 10 ${x + 6} 6`} stroke="#1f2937" strokeWidth={3} fill="none" />)}</>,
  pads: <><ellipse cx={30} cy={36} rx={24} ry={12} fill="#d6b588" stroke="#8b6b45" /><ellipse cx={30} cy={36} rx={14} ry={6} fill="#b08d63" /></>,
};
const Feet: React.FC<{ kind?: string; size?: number }> = ({ kind, size = 64 }) => (
  <svg viewBox="0 0 60 56" width={size} height={size * 0.93} aria-hidden="true">{kind ? FEET[kind] : null}</svg>
);
const COLORS: Record<string, string> = { brown: '#8a5a33', black: '#2b2522', white: '#f2eee6', golden: '#d6a24e' };
const Critter: React.FC<{ t: Record<string, string>; small?: boolean }> = ({ t, small }) => {
  const col = COLORS[t.color] ?? '#999';
  const mark = t.color === 'white' || t.color === 'golden' ? '#5a3a24' : t.color === 'black' ? '#e9e2d4' : '#3a2516';
  const sz = small ? 82 : 108;
  return (
    <svg viewBox="0 0 110 90" width={sz} height={sz * 0.82} aria-hidden="true">
      <ellipse cx={40} cy={58} rx={30} ry={16} fill={col} stroke="#00000033" />
      {t.coat === 'spots' && <><circle cx={34} cy={54} r={6} fill={mark} /><circle cx={50} cy={62} r={5} fill={mark} /><circle cx={24} cy={64} r={4} fill={mark} /></>}
      {t.coat === 'stripes' && [22, 32, 42, 52].map(x => <path key={x} d={`M${x} 46 L${x - 3} 70`} stroke={mark} strokeWidth={3} />)}
      <rect x={16} y={68} width={6} height={16} fill={col} /><rect x={56} y={68} width={6} height={16} fill={col} />
      <path d="M10 52 Q 0 40 6 34" stroke={col} strokeWidth={5} fill="none" />
      <circle cx={74} cy={38} r={16} fill={col} stroke="#00000033" />
      {t.ears === 'floppy'
        ? <><ellipse cx={62} cy={34} rx={6} ry={12} fill={mark} transform="rotate(15 62 34)" /><ellipse cx={86} cy={34} rx={6} ry={12} fill={mark} transform="rotate(-15 86 34)" /></>
        : <><path d="M60 26 L64 8 L72 22 Z" fill={mark} /><path d="M88 26 L84 8 L76 22 Z" fill={mark} /></>}
      <circle cx={68} cy={36} r={2.4} fill="#111" /><circle cx={80} cy={36} r={2.4} fill="#111" /><ellipse cx={74} cy={45} rx={4} ry={3} fill="#111" />
    </svg>
  );
};
const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => <svg viewBox="0 0 50 50" width={40} height={40} aria-hidden="true">{children}</svg>;
const ITEM_PICTURES: Record<string, React.ReactNode> = {
  egg: '🥚', caterpillar: '🐛', butterfly: '🦋', frog: '🐸', chick: '🐣', hen: '🐔', sprout: '🌱', seedling: '🪴', flower: '🌼', pod: '🫛',
  nose: '👃', mouth: '👄', lungs: '🫁',
  chrysalis: <Svg><line x1={25} y1={2} x2={25} y2={9} stroke="#a3a3a3" strokeWidth={2} /><path d="M25 9 Q 39 22 31 42 Q 25 50 19 42 Q 11 22 25 9 Z" fill="#7cae5a" stroke="#4f7a38" /></Svg>,
  tadpole: <Svg><ellipse cx={18} cy={25} rx={10} ry={8} fill="#3f3f46" /><path d="M27 25 Q 38 18 46 26 Q 38 30 27 27 Z" fill="#52525b" /></Svg>,
  froglet: <Svg><ellipse cx={20} cy={28} rx={12} ry={9} fill="#4ade80" /><circle cx={15} cy={20} r={3} fill="#166534" /><circle cx={25} cy={20} r={3} fill="#166534" /><path d="M31 30 Q 40 30 46 36" stroke="#4ade80" strokeWidth={3} fill="none" /></Svg>,
  seed: <Svg><ellipse cx={25} cy={28} rx={11} ry={8} fill="#a16207" /></Svg>,
  gills: <Svg>{[10, 20, 30, 40].map(y => <path key={y} d={`M8 ${y} Q 25 ${y - 8} 42 ${y}`} stroke="#f87171" strokeWidth={3.5} fill="none" />)}</Svg>,
  stomach: <Svg><path d="M14 8 Q 10 22 18 30 Q 26 40 40 34 Q 46 24 36 22 Q 28 22 24 14 L22 6 Z" fill="#f0a3a9" stroke="#b8656c" /></Svg>,
  windpipe: <Svg><rect x={19} y={4} width={12} height={42} rx={4} fill="#fda4af" />{[10, 18, 26, 34, 42].map(y => <line key={y} x1={19} y1={y} x2={31} y2={y} stroke="#be123c" />)}</Svg>,
  blowhole: <Svg><path d="M6 40 Q 25 22 44 40" stroke="#93c5fd" strokeWidth={4} fill="none" /><ellipse cx={25} cy={30} rx={5} ry={3} fill="#1e3a8a" /><path d="M25 26 L25 8 M20 12 L25 6 L30 12" stroke="#bfdbfe" strokeWidth={2} fill="none" /></Svg>,
  wet_skin: <Svg>{[14, 25, 36].map(y => <path key={y} d={`M6 ${y} q 6 -5 12 0 t 12 0 t 12 0`} stroke="#5eead4" strokeWidth={2.5} fill="none" />)}</Svg>,
};
/** A picture for a stage or a body part: the one the world declared, a drawn one for a known id, or a placeholder. */
const ItemPicture: React.FC<{ id: string; emoji?: string }> = ({ id, emoji }) => {
  const p = emoji ?? ITEM_PICTURES[id];
  return typeof p === 'string' ? <span className="text-4xl leading-none" aria-hidden="true">{p}</span> : <>{p ?? <span className="text-3xl" aria-hidden="true">❔</span>}</>;
};

/** Any color word as a fill: the atlas's shades, common color words, or a neutral grey for a word it cannot draw. */
const COLOR_CSS: Record<string, string> = {
  ...SHADE_FILL, red: '#dc2626', orange: '#f97316', yellow: '#facc15', blue: '#3b82f6', purple: '#a855f7', pink: '#f472b6',
  gray: '#9ca3af', grey: '#9ca3af', black: '#1c1917', golden: '#d6a24e', tan: '#d2b48c', gold: '#eab308', silver: '#cbd5e1',
  spotted: '#a8a29e', striped: '#a8a29e', mottled: '#78716c',
};
/** A declared word as a child reads it ("bright_orange" → "bright orange"). */
const say = (v: string) => v.replace(/_/g, ' ');
const colorOf = (v: string) => { const ws = say(v).toLowerCase().split(/\s+/); return ws.map(x => COLOR_CSS[x]).find(Boolean) ?? null; };
/** A trait the child compares: a swatch for a color, otherwise its word. */
const TraitChip: React.FC<{ name: string; value: string }> = ({ name, value }) => {
  const fill = colorOf(value);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5 text-[11px] text-slate-100">
      {fill && <span className="inline-block h-3 w-3 rounded-full border border-white/40" style={{ background: fill }} aria-hidden="true" />}
      {say(value)} {say(name)}
    </span>
  );
};
/** An animal in a coloring: a drawn moth or bug when the atlas knows the shape, otherwise its picture on a colored disk. */
const Colored: React.FC<{ subject?: string; emoji?: string; color: string; size?: number }> = ({ subject, emoji, color, size = 34 }) => {
  const draws = organism(subject ?? '')?.draws;
  if (draws === 'moth' || draws === 'bug') return <Prey draws={draws} color={color} size={size} />;
  return (
    <span className="inline-flex items-center justify-center rounded-full border border-white/30" aria-hidden="true"
      style={{ width: size, height: size, background: colorOf(color) ?? '#9ca3af' }}>
      <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{emoji ?? '❔'}</span>
    </span>
  );
};
/** An option to pick: its declared picture, or the atlas's drawing for a known part, beside its label. */
const OptionPicture: React.FC<{ part: string; o: Option; subject?: string; emoji?: string }> = ({ part, o, subject, emoji }) => {
  if (o.emoji) return <span className="text-3xl leading-none" aria-hidden="true">{o.emoji}</span>;
  if (part === 'beak' && BEAKS[o.value]) return <Bird beak={o.value} size={52} />;
  if (part === 'seed') return <Seed shape={o.value} size={44} />;
  if (part === 'feet' && FEET[o.value]) return <Feet kind={o.value} size={40} />;
  if (part === 'color') return <Colored subject={subject} emoji={emoji} color={o.value} size={34} />;
  return null;
};

const FEATURE_ICON: Record<string, string> = { food: '🍽️', carrier: '🌬️', ground: '⛰️', medium: '💧' };
const FOOD_ICON: Record<string, string> = { hard_seeds: '🌰', nectar: '🌸', meat: '🍖', fish: '🐟' };
function featureChip(key: string, value: unknown): string {
  const v = String(value);
  if (key === 'color') return '';
  if (key === 'food') return `${FOOD_ICON[v] ?? '🍽️'} food: ${featureWords(v)}`;
  if (key === 'carrier') return `${v === 'fur' ? '🦊' : v === 'water' ? '💧' : '🌬️'} ${CARRIER_SCENE[v as keyof typeof CARRIER_SCENE] ?? `carried by ${featureWords(v)}`}`;
  if (key === 'ground') return `⛰️ ${GROUND_SCENE[v as keyof typeof GROUND_SCENE] ?? featureWords(v)}`;
  if (key === 'medium') return v === 'water' ? '💧 under water' : `🌬️ ${v === 'air' ? 'open air' : featureWords(v)}`;
  return `${FEATURE_ICON[key] ?? '•'} ${say(key)}: ${featureWords(v)}`;
}
const tokenWords = (t?: string) => (t ? TOKEN_WORDS[t as keyof typeof TOKEN_WORDS] ?? featureWords(t) : '');

const ZONE_TONE: Record<string, string> = {
  pot: 'bg-amber-900/40', meadow: 'bg-lime-800/35', field: 'bg-lime-700/30', ice: 'bg-sky-200/20', desert: 'bg-amber-500/25',
  pond: 'bg-teal-600/30', river: 'bg-sky-600/30', sea: 'bg-blue-700/35', forest: 'bg-emerald-800/40', snow: 'bg-slate-100/20',
  plain: 'bg-slate-800/50', garden: 'bg-lime-800/35', grass: 'bg-lime-700/30', ocean: 'bg-blue-700/35', cave: 'bg-stone-800/60',
};

/** The teaching workspace is this primitive's only controller: the runtime owns progression. */
const useLifeProgress = useWorkspaceProgressFor('life-lab');

interface RunView { r: LifeRun; met: boolean; frame: number; frames: number; done: boolean }
const EMPTY: LifeWorld = { zones: [], beings: [], rules: [], controls: [], goal: { kind: 'order' } };

const LifeLabSurface: React.FC<LifeLabProps> = ({ data, className, runtimePlanItemId }) => {
  const { title, challenges = [], challengeType, gradeBand, instanceId, skillId, subskillId, objectiveId,
    exhibitId, onEvaluationSubmit } = data;
  const workspace = useRef<TeachingWorkspace | null>(null);
  const stableInstanceId = useRef(instanceId || `life-lab-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceId.current;

  const board = useSurfaceAnswer();
  /** Which teach frame is up, for one session item; a retry or a lever does not replay it. */
  const [teachAt, setTeachAt] = useState<{ item: string; step: number; done: boolean }>({ item: '', step: 0, done: false });
  const teachPictures = useTeachPictures();
  const [ws, setWs] = useState<LifeState>(() => initState(challenges[0]?.world ?? EMPTY));
  const [selected, setSelected] = useState<string | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [tries, setTries] = useState<LifeTry[]>([]);
  const [verdict, setVerdict] = useState<'correct' | 'incorrect' | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; status: 'correct' | 'incorrect' } | null>(null);
  const [runsTotal, setRunsTotal] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRun = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stopRun, []);
  // The runtime's own end-of-session record (taps and spoken credits alike) is what gets submitted.
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});

  const progress = useLifeProgress<LifeLabChallenge>({
    challenges, getChallengeId: (ch) => ch.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: lifeLabBoss.assignment!,
    // A fresh world and Try again both reopen the starting world; Try again keeps the tries.
    onItemOpened: (index, retry) => {
      stopRun();
      const c = challenges[index];
      if (c) setWs(initState(c.world ?? EMPTY));
      board.reset();
      setSelected(null); setRun(null); setVerdict(null); setFeedback(null);
      if (!retry) setTries([]);
    },
    onFinished: result => finish.current(result),
  });
  const { currentIndex, results: challengeResults, isComplete } = progress;
  const allChallengesComplete = isComplete || !!progress.practiceSummary;
  const session = challenges[currentIndex] ?? null;
  const levers = useAuthoredLevers(session, lifeLabLevers, lifeLabBoss.assignment!, item => {
    stopRun(); setWs(initState(item.world ?? EMPTY)); board.reset(); setSelected(null); setRun(null); setVerdict(null); setFeedback(null);
  });
  const current = levers.shown;
  /** The world with every shorthand filled in: the board draws only what is declared here. */
  const w = useMemo(() => (current?.world ? normalizeWorld(current.world) : null), [current]);
  const kitItem = current?.item ?? null;
  const teachSteps = session?.teach ?? [];
  const teachNow = session && teachAt.item === session.id ? teachAt : { item: session?.id ?? '', step: 0, done: false };
  const teaching = teachSteps.length > 0 && !teachNow.done && !allChallengesComplete;
  const nextTeach = () => {
    if (!session) return;
    const step = teachNow.step + 1;
    setTeachAt({ item: session.id, step, done: step >= teachSteps.length });
    SoundManager.tap();
  };
  /** Back to the start of what this question was taught with; the work on the board stays. */
  const lookBack = () => {
    if (!session) return;
    stopRun(); setRun(null);
    setTeachAt({ item: session.id, step: 0, done: false });
    SoundManager.tap();
  };
  const solved = verdict === 'correct';
  const running = !!run && !run.done;
  const locked = !current || progress.canAttempt === false || allChallengesComplete || verdict !== null || teaching;
  const ctl = <T extends LifeWorld['controls'][number]['type']>(t: T) => w?.controls.find(c => c.type === t) as Extract<LifeWorld['controls'][number], { type: T }> | undefined;

  const phaseResults = usePhaseResults({
    challenges, results: challengeResults, isComplete: allChallengesComplete,
    getChallengeType: (ch) => ch.type, phaseConfig: PHASE_TYPE_CONFIG,
    getScore: (rs) => Math.round(rs.reduce((s, r) => s + (typeof r.score === 'number' ? r.score : r.correct ? 100 : 0), 0) / Math.max(rs.length, 1)),
  });
  const { submitResult, hasSubmitted, submittedResult, elapsedMs } = usePrimitiveEvaluation<LifeLabMetrics>({
    primitiveType: 'life-lab', instanceId: resolvedInstanceId, skillId, subskillId, objectiveId, exhibitId,
    onSubmit: onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined,
  });

  /** Play the world: days, families, something flowing along the row, or the stages in turn. */
  const play = (record: boolean) => {
    if (!w) return;
    const r = simulate(w, ws), met = goalMet(w, ws, r);
    const kind = w.rules[0]?.kind;
    const frames = kind === 'spots' && r.frames ? r.frames.length : kind === 'needs' ? (w.steps ?? 5)
      : kind === 'flows' ? Math.max(1, r.trace!.stopAt >= 0 ? r.trace!.stopAt + 1 : ws.order.length) : kind === 'stages' ? Math.max(1, ws.order.length) : 1;
    const done = () => {
      stopRun();
      setRun({ r, met, frame: frames - 1, frames, done: true });
      if (record) { setTries(t => [...t, { work: describeWork(w, ws), what: outcomeText(w, ws, r, met), correct: met }]); setRunsTotal(n => n + 1); }
    };
    stopRun();
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || frames <= 1) { done(); return; }
    setRun({ r, met, frame: 0, frames, done: false });
    SoundManager.select();
    let f = 0;
    timer.current = setInterval(() => { f++; if (f >= frames) done(); else setRun({ r, met, frame: f, frames, done: false }); }, STEP_MS);
  };

  const change = (next: (s: LifeState) => void) => {
    if (locked || running) return;
    setWs(s => { const c = JSON.parse(JSON.stringify(s)) as LifeState; next(c); return c; });
    setRun(null); setFeedback(null);
    SoundManager.tap();
  };

  const checkItem = (item: SurfaceItem) => {
    if (locked || !answerReady(item, board.answer)) return;
    const g = gradeAnswer(item, board.answer);
    const hint = g.correct ? undefined : missHint(item, board.answer);
    const work = describeSurfaceWork(item, board.answer);
    setVerdict(g.correct ? 'correct' : 'incorrect');
    setFeedback({ text: g.correct ? 'Yes, that works.' : `Not yet. ${hint ? `${hint} ` : ''}Look again.`, status: g.correct ? 'correct' : 'incorrect' });
    setTries(t => [...t, { work, what: g.correct ? 'it worked' : 'not yet', correct: g.correct }]);
    progress.commitCheck(work, g.correct, g.miss);
    if (g.correct) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  const check = () => {
    if (kitItem) { checkItem(kitItem); return; }
    if (!current || !w || locked || running) return;
    const r = simulate(w, ws), met = goalMet(w, ws, r);
    setVerdict(met ? 'correct' : 'incorrect');
    // A miss says what the world did, then the why-card (how to look again).
    setFeedback({ text: met ? outcomeText(w, ws, r, met) : `${outcomeText(w, ws, r, met)} ${current.why}`, status: met ? 'correct' : 'incorrect' });
    progress.commitCheck(describeWork(w, ws), met, met ? undefined : missOf(w, ws, r));
    if (!canRun(w) || met) play(false);
    if (met) SoundManager.playCorrect(); else SoundManager.playIncorrect();
  };

  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const total = challenges.length;
    const metrics: LifeLabMetrics = {
      type: 'life-lab', challengeType, totalChallenges: total, correctCount: result.solvedCount, attemptsCount: result.attemptsCount,
      firstTryCount: result.firstTryCount, hintsViewed: 0, overallAccuracy: result.accuracy,
      averageAttemptsPerChallenge: total ? Math.round((result.attemptsCount / total) * 10) / 10 : 0, runsCount: runsTotal,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  useLayoutEffect(() => {
    if (!current || allChallengesComplete) return;
    const scene = current.item ? surfaceScene(current.item, { answer: board.answer, tries, solved }) : lifeScene(current, { state: ws, tries, running, solved });
    const frame = teachSteps[Math.min(teachNow.step, teachSteps.length - 1)];
    workspace.current = levers.publish(teaching ? withTeaching(scene, frame, teachNow.step, teachSteps.length, teachPictures.loaded(frame.picture)) : scene);
  });

  const localScore = useMemo(() => phaseResults.length ? Math.round(phaseResults.reduce((s, p) => s + p.score, 0) / phaseResults.length) : 0, [phaseResults]);

  if (!challenges.length) {
    return <LuminaCard className={className}><LuminaCardContent className="p-6 text-slate-400">No worlds to explore yet.</LuminaCardContent></LuminaCard>;
  }

  // ── What the board shows ──────────────────────────────────────────────────
  const r = run?.r ?? null;
  const shownRun = run?.done || running;
  const mv = ctl('move'), cc = ctl('condition'), tc = ctl('trait'), oc = ctl('order'), ch = ctl('choose'), pc = ctl('predict');
  const rule0 = w?.rules[0];
  const kind = rule0?.kind;
  const pops = kind === 'spots' && r?.frames && shownRun ? r.frames[run!.frame] : null;
  const items = w ? itemsOf(w) : [];
  const itemOf = (id: string) => items.find(x => x.id === id);
  const inherits = kind === 'inherits' ? (rule0 as { traits: string[] }).traits : [];

  const drawBeing = (id: string) => {
    const b = beingOf(w!, id)!, o = organism(b.subject ?? ''), st = ws.beings[id];
    const status = shownRun && kind === 'needs' ? r?.status[id] : run?.done ? r?.status[id] : undefined;
    let pic: React.ReactNode;
    if (o?.draws === 'plant') {
      const grow = !shownRun ? 1 : status === 'thrives' ? Math.min(5, 1 + (run?.frame ?? 0) + 1) : Math.max(1, 2 - Math.floor((run?.frame ?? 0) / 2));
      pic = <Plant h={grow} wilt={!!shownRun && status === 'struggles' && (run?.frame ?? 0) >= 1} flower={b.subject === 'sunflower'} />;
    } else if (o?.draws === 'bird' && (!st.traits.beak || BEAKS[st.traits.beak])) pic = <Bird beak={st.traits.beak} size={tc?.part === 'beak' ? 110 : 56} />;
    else if (o?.draws === 'seed' && st.traits.seed) pic = <Seed shape={st.traits.seed} />;
    else if (o?.draws === 'critter' && ['ears', 'coat', 'color'].every(k => st.traits[k])) pic = <Critter t={st.traits} small={!!ch?.among.includes(id)} />;
    else if (st.traits.color && kind === 'spots') pic = <Colored subject={b.subject} emoji={b.emoji} color={st.traits.color} size={56} />;
    else if (ITEM_PICTURES[b.subject ?? ''] && typeof ITEM_PICTURES[b.subject ?? ''] !== 'string') pic = <span className="inline-block scale-150 p-2">{ITEM_PICTURES[b.subject!]}</span>;
    else pic = <span className="text-5xl leading-none" aria-hidden="true">{b.emoji ?? '❔'}</span>;
    // The part the child picked for it, drawn beside it when the animal's own picture cannot show it.
    const pickedPart = tc && tc.being === id && tc.part !== 'color' && !(o?.draws === 'bird' && tc.part === 'beak') && !(o?.draws === 'seed' && tc.part === 'seed')
      ? optionsOf(w!).find(x => x.value === st.traits[tc.part]) : undefined;
    const chips = inherits.length ? inherits.filter(t => st.traits[t]).map(t => <TraitChip key={t} name={t} value={st.traits[t]} />) : [];
    const badge = status ? (
      <span className={`max-w-[11rem] rounded px-1.5 py-0.5 text-center text-[11px] ${status === 'thrives' ? 'bg-emerald-500/25 text-emerald-100' : 'bg-rose-500/25 text-rose-100'}`}>
        {status === 'thrives' ? 'Thriving' : `Struggling: ${r?.reasons[id] ?? ''}`}
      </span>) : null;
    const isMover = !!mv?.beings.includes(id), isCard = !!ch?.among.includes(id);
    const role = kind === 'inherits' ? ((rule0 as { parents: string[] }).parents.indexOf(id) === 0 ? 'mother' : (rule0 as { parents: string[] }).parents.indexOf(id) === 1 ? 'father' : '') : '';
    const inner = (
      <>
        <span className="flex items-end gap-1">{pic}{pickedPart && <OptionPicture part={tc!.part} o={pickedPart} />}</span>
        {!isCard && <span className="text-[11px] text-slate-200">{role ? `${role} ${b.name}` : b.name}</span>}
        {chips.length > 0 && <span className="flex max-w-[12rem] flex-wrap justify-center gap-1">{chips}</span>}
        {badge}
      </>
    );
    if (isMover || isCard) {
      const sel = isMover ? selected === id : ws.choice === id;
      return (
        <button key={id} type="button" disabled={locked || running}
          onClick={() => isMover ? (!locked && !running && setSelected(s => (s === id ? null : id))) : change(s => { s.choice = id; })}
          aria-label={isCard ? `card ${String.fromCharCode(97 + ch!.among.indexOf(id))}` : `pick up the ${b.name}`}
          data-pip-object={isCard ? `card-${id}` : `being-${id}`}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-colors ${sel ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-300/60'} disabled:opacity-80`}>
          {inner}
        </button>
      );
    }
    return <div key={id} className="flex flex-col items-center gap-1 p-2">{inner}</div>;
  };

  const zoneCard = (zid: string) => {
    const z = w!.zones.find(x => x.id === zid)!;
    const c = ws.zones[zid] ?? {};
    const chips = [
      ...(COND_KEYS as readonly CondKey[]).filter(k => typeof c[k] === 'number').map(k => `${COND_ICON[k][c[k] as Level]} ${COND_WORDS[k][c[k] as Level]}`),
      ...Object.entries(c).filter(([k, v]) => !(COND_KEYS as readonly string[]).includes(k) && v !== undefined).map(([k, v]) => featureChip(k, v)).filter(Boolean),
    ];
    const drop = !!mv && !!selected && mv.zones.includes(zid) && !locked && !running;
    const bgFill = c.color ? colorOf(String(c.color)) : null;
    const tone = bgFill ? '' : ZONE_TONE[z.kind ?? ''] ?? 'bg-slate-800/50';
    const style = bgFill ? { background: bgFill, color: ['white', 'light', 'sandy', 'yellow', 'tan', 'silver'].includes(String(c.color)) ? '#1c1917' : undefined } : undefined;
    const here = w!.beings.filter(b => (run?.done && r?.moved[b.id] ? r.moved[b.id] : ws.beings[b.id].zone) === zid && !b.variants);
    const hunted = w!.beings.find(b => b.variants && ws.beings[b.id].zone === zid);
    const body = (
      <>
        <div className="flex items-center justify-between gap-2"><span className="font-semibold">{z.emoji ? `${z.emoji} ` : ''}{z.label}</span>{c.color && <span className="text-[11px] opacity-80">{String(c.color)}</span>}</div>
        <div className="flex flex-wrap gap-1 text-[11px]">{chips.map(t => <span key={t} className="rounded-full bg-black/20 px-2 py-0.5">{t}</span>)}</div>
        <div className="relative flex min-h-[110px] flex-1 flex-wrap items-end justify-center gap-2">
          {hunted && (
            <div className="relative h-[130px] w-full">
              {(pops ?? hunted.variants!).flatMap((v, vi) => Array.from({ length: v.count }, (_, i) => {
                const k = vi * 20 + i, h = (k * 2654435761) >>> 0;
                return <span key={`${v.value}-${i}`} className="absolute" style={{ left: `${6 + (h % 78)}%`, top: `${8 + ((h >>> 8) % 70)}%` }}><Colored subject={hunted.subject} emoji={hunted.emoji} color={v.value} size={24} /></span>;
              }))}
            </div>
          )}
          {here.map(b => drawBeing(b.id))}
          {kind === 'spots' && run?.done && r?.hunted && r.hunted.seen && <span className="absolute right-2 top-0 text-sm text-rose-200">Seen!</span>}
        </div>
        {cc?.zones.includes(zid) && (
          <div className="mt-1 grid gap-1">
            {cc.keys.map(k => (
              <div key={k} className="flex items-center gap-1 text-xs">
                <button type="button" className="h-7 w-7 rounded-md border border-white/20 bg-black/30 font-bold disabled:opacity-40" disabled={locked || running || ((c[k] as number) ?? 0) <= 0}
                  data-pip-object={`cond-${zid}-${k}-down`} aria-label={`less ${k} in ${z.label}`} onClick={() => change(s => { s.zones[zid][k] = Math.max(0, ((s.zones[zid][k] as number) ?? 0) - 1) as Level; })}>−</button>
                <button type="button" className="h-7 w-7 rounded-md border border-white/20 bg-black/30 font-bold disabled:opacity-40" disabled={locked || running || ((c[k] as number) ?? 0) >= 2}
                  data-pip-object={`cond-${zid}-${k}-up`} aria-label={`more ${k} in ${z.label}`} onClick={() => change(s => { s.zones[zid][k] = Math.min(2, ((s.zones[zid][k] as number) ?? 0) + 1) as Level; })}>+</button>
                <span className="opacity-80">{k === 'temp' ? 'warmth' : k}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
    return drop ? (
      <button key={zid} type="button" data-pip-object={`zone-${zid}`} aria-label={`move here: ${z.label}`} style={style}
        onClick={() => { const b = selected!; change(s => { s.beings[b].zone = zid; }); setSelected(null); }}
        className={`flex min-w-0 flex-1 basis-44 flex-col gap-1 rounded-xl border-2 border-dashed border-emerald-400 p-3 text-left text-slate-100 ${tone}`}>{body}</button>
    ) : (
      <div key={zid} data-pip-object={`zone-${zid}`} style={style} className={`flex min-w-0 flex-1 basis-44 flex-col gap-1 rounded-xl border-2 border-transparent p-3 text-slate-100 ${tone}`}>{body}</div>
    );
  };

  const flow = kind === 'flows' ? (rule0 as { start?: string; goal?: string }) : null;
  const traceAt = (i: number) => (flow && r?.trace && shownRun && (run?.frame ?? -1) >= i ? r.trace.tokens[i] : undefined);
  const stopAt = flow && run?.done && r?.trace ? r.trace.stopAt : -1;
  const runLabel = kind === 'needs' ? `Grow ${w?.steps ?? 5} days` : kind === 'flows' ? 'Send it through' : kind === 'stages' ? 'Play the life' : kind === 'spots' ? 'Let the hunter look' : 'Try it';
  const why = run?.done && !feedback && w ? outcomeText(w, ws, run.r, run.met) : null;
  const mode = w ? classify(w)?.mode : undefined;
  const preyOf = pc ? beingOf(w!, pc.of) : undefined;
  const traitBeing = tc ? beingOf(w!, tc.being) : undefined;

  return (
    <LuminaCard className={className}>
      <LuminaCardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LuminaCardTitle>{title}</LuminaCardTitle>
          <div className="flex items-center gap-2">
            <LuminaBadge accent="emerald">{gradeBand}</LuminaBadge>
            <LuminaChallengeCounter current={Math.min(currentIndex + 1, challenges.length)} total={challenges.length} />
          </div>
        </div>
      </LuminaCardHeader>

      <LuminaCardContent className="space-y-4">
        {allChallengesComplete && phaseResults.length > 0 && (
          <PhaseSummaryPanel phases={phaseResults} overallScore={practiceScore(progress.practiceSummary) ?? (submittedResult?.score ?? localScore)}
            durationMs={elapsedMs} heading="You did it!" celebrationMessage="You learned how living things work and used the idea." className="mb-2" />
        )}

        {!allChallengesComplete && current && !teaching && (
          <LuminaPrompt accent="emerald">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-200/80">{mode ? `${ICONS[mode]} ${MODE_LABELS[mode]}` : ''}</div>
            <div className="text-base" data-life-ask="">{current.ask}</div>
            {running && <div className="mt-1 text-sm text-emerald-100/80">{kind === 'spots' && r?.frames ? `Family ${run!.frame} of ${run!.frames - 1}` : kind === 'needs' ? `Day ${run!.frame + 1}` : 'Watch…'}</div>}
          </LuminaPrompt>
        )}

        <PipDock />
        <PipWorkspace className="space-y-3">
          {teaching && <TeachPanel steps={teachSteps} step={teachNow.step} onNext={nextTeach} pictures={teachPictures} />}
          {!teaching && !allChallengesComplete && teachSteps.length > 0 && !running && (
            <div className="flex justify-end"><LuminaButton tone="ghost" data-pip-object="teach-look-back" onClick={lookBack}>Look back at the lesson</LuminaButton></div>
          )}

          {kitItem && !teaching && !allChallengesComplete && (
            <>
              <SurfaceBoard item={kitItem} board={board} locked={locked} onChanged={() => setFeedback(null)} />
              <div className="flex flex-wrap items-center gap-2">
                {kitItem.surface !== 'choose' && <LuminaButton tone="ghost" onClick={() => { if (!locked) { board.reset(); setFeedback(null); } }} disabled={locked}>Clear</LuminaButton>}
                <LuminaActionButton action="check" onClick={check} disabled={locked || !answerReady(kitItem, board.answer)}>I&apos;m done!</LuminaActionButton>
              </div>
            </>
          )}

          {w && !teaching && !allChallengesComplete && (
            <>
              {(w.show?.length ?? 0) > 0 && (
                <LuminaPanel className="flex flex-wrap justify-center gap-4 p-3" data-life-shown="">
                  <style>{DISPLAY_CSS}</style>
                  {w.show!.map((d, i) => <KitDisplay key={i} display={d} className="flex min-w-0 max-w-md flex-1 basis-56 justify-center" />)}
                </LuminaPanel>
              )}
              {w.zones.length > 0 && <div className="flex flex-wrap gap-3" data-life-scene="">{w.zones.map(z => zoneCard(z.id))}</div>}
              {mv && <p className="text-xs text-slate-400">{selected ? 'Now tap the place where it should live.' : 'Tap an animal, then tap the place where it should live.'}</p>}

              {tc && (
                <LuminaPanel className="space-y-2 p-3">
                  <div className="text-xs text-slate-400">{tc.part === 'color' ? 'Pick a coloring:' : `Pick the ${traitBeing?.name ?? ''}'s ${tc.part}:`}</div>
                  <div className="flex flex-wrap gap-2">
                    {optionsOf(w).map(o => {
                      const on = ws.beings[tc.being].traits[tc.part] === o.value;
                      return (
                        <button key={o.value} type="button" disabled={locked || running} data-pip-object={`opt-${o.value}`} aria-pressed={on}
                          onClick={() => change(s => { s.beings[tc.being].traits[tc.part] = o.value; })}
                          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm text-slate-100 ${on ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-300/60'} disabled:opacity-80`}>
                          <OptionPicture part={tc.part} o={o} subject={traitBeing?.subject} emoji={traitBeing?.emoji} />
                          <span>{say(o.label)}</span>
                        </button>
                      );
                    })}
                  </div>
                </LuminaPanel>
              )}

              {pc && (
                <LuminaPanel className="space-y-2 p-3">
                  <div className="text-xs text-slate-400">Your prediction:</div>
                  <div className="flex flex-wrap gap-2">
                    {(preyOf?.variants ?? []).map(v => (
                      <button key={v.value} type="button" disabled={locked} data-pip-object={`predict-${v.value}`} aria-pressed={ws.choice === v.value}
                        onClick={() => change(s => { s.choice = v.value; })}
                        className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm text-slate-100 ${ws.choice === v.value ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10'} disabled:opacity-80`}>
                        <Colored subject={preyOf?.subject} emoji={preyOf?.emoji} color={v.value} size={30} /><span>more {v.value} {preyOf?.name ?? 'animal'}s</span>
                      </button>
                    ))}
                  </div>
                </LuminaPanel>
              )}

              {oc && (
                <LuminaPanel className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-2" data-life-row="">
                    {flow && <span className="rounded-lg bg-sky-500/20 px-2 py-2 text-xs text-sky-100">{tokenWords(flow.start)}</span>}
                    {Array.from({ length: oc.slots }, (_, i) => {
                      const id = ws.order[i];
                      const it = id ? itemOf(id) : undefined;
                      const tok = traceAt(i);
                      const hot = running && run?.frame === i;
                      return (
                        <React.Fragment key={i}>
                          {(i > 0 || flow) && <span className="text-slate-500" aria-hidden="true">→</span>}
                          <button type="button" disabled={locked || running || !id} onClick={() => change(s => { s.order.splice(i, 1); })}
                            aria-label={id ? `take out box ${i + 1}` : `box ${i + 1}`}
                            className={`flex h-24 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 text-[11px] text-slate-200 ${stopAt === i ? 'border-rose-400' : hot ? 'border-amber-300' : id ? 'border-emerald-400/70' : 'border-dashed border-slate-600'}`}>
                            {id ? <><ItemPicture id={id} emoji={it?.emoji} /><span>{say(it?.name ?? id)}</span></> : <span className="text-slate-500">{i + 1}</span>}
                            {tok && <span className="rounded bg-amber-400/80 px-1 text-[9px] text-amber-950">{tokenWords(tok)}</span>}
                          </button>
                        </React.Fragment>
                      );
                    })}
                    <span className="text-slate-500" aria-hidden="true">{flow ? `→ ${tokenWords(flow.goal)}` : '↺'}</span>
                  </div>
                  <div className="flex flex-wrap gap-2" data-life-bench="">
                    {oc.items.filter(x => !ws.order.includes(x)).map(x => {
                      const it = itemOf(x);
                      return (
                        <button key={x} type="button" disabled={locked || running || ws.order.length >= oc.slots} data-pip-object={`item-${x}`} aria-label={`add ${it?.name ?? x}`}
                          onClick={() => change(s => { if (s.order.length < oc.slots) s.order.push(x); })}
                          className="flex w-20 flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-800/60 px-1 py-2 text-[11px] text-slate-200 hover:border-emerald-400/60 disabled:opacity-50">
                          <ItemPicture id={x} emoji={it?.emoji} /><span>{say(it?.name ?? x)}</span>
                        </button>
                      );
                    })}
                  </div>
                </LuminaPanel>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {canRun(w) && <LuminaButton tone="primary" onClick={() => !locked && !running && play(true)} disabled={locked || running}>{runLabel}</LuminaButton>}
                {oc && <LuminaButton tone="ghost" data-pip-object="clear-order" onClick={() => change(s => { s.order = []; })} disabled={locked || running || !ws.order.length}>Clear</LuminaButton>}
                <LuminaActionButton action="check" onClick={check}
                  disabled={locked || running || ((!!pc || !!ch) && !ws.choice) || (!!oc && !ws.order.length)}>I&apos;m done!</LuminaActionButton>
              </div>
            </>
          )}

          {why && <LuminaFeedbackCard status="insight" data-life-why=""><p>{why}</p></LuminaFeedbackCard>}
          {feedback && <LuminaFeedbackCard status={feedback.status}><p>{feedback.text}</p></LuminaFeedbackCard>}
        </PipWorkspace>
      </LuminaCardContent>
    </LuminaCard>
  );
};

const LifeLab = withWorkspaceOnly<LifeLabProps>('life-lab', LifeLabSurface, props => props.data.title);

/**
 * Life Lab runs only on the teaching workspace: the tutor is present, I'm done! commits, and the runtime moves to the
 * next world. Outside a bound session the "needs the tutor" card shows.
 */
export default LifeLab;
