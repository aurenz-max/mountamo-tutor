'use client';

import React, { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AtomBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { useWorkspacePipSurface } from '../../../pip/useWorkspacePipSurface';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import type { TeachingEvaluationResult } from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { withWorkspaceController } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useScriptedProgress, useWorkspaceProgressFor, type Progress, type ProgressOptions }
  from '../../../components/live-activity/runtime/useWorkspaceProgress';
import {
  atomShells, ELEMENTS, ATOM_BUILD_MISS_WORDS, type AtomAsk, type AtomBuildMiss, type BuiltAtom,
} from './atomBuild';
import {
  atomMiss, CLASSIC_MISS_WORDS, describeAtom, openAskOf, workspaceAssignment, workspaceScene,
  type AtomView, type ClassicAtomMiss,
} from './atomBuilderWorkspace';
import {
  ISOTOPE_COMPARE_LEVER, MASS_METER_LEVER, PAIR_UP_LEVER, RING_COUNTS_LEVER, TABLE_KEY_LEVER,
  atomLevers, atomRefusal, leverFacts, massLine, pairUp, practiceFor, ringCounts, tableKey,
} from './atomBuilderLevers';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface AtomBuilderChallenge {
  id: string;
  type: 'build_element' | 'identify' | 'fill_shells' | 'make_ion' | 'make_isotope' | 'find_on_table' | 'make_atom';
  instruction: string;
  /** make_atom (open build) only: the property the learner's atom must have. Code-written; the targets stay null. */
  ask?: AtomAsk;
  targetProtons: number | null;
  targetNeutrons: number | null;
  targetElectrons: number | null;
  hint: string;
  narration: string;
}

export interface AtomBuilderShowOptions {
  showMiniPeriodicTable: boolean;
  showIdentityCard: boolean;
  showShellCapacity: boolean;
  showCharge: boolean;
  showMassNumber: boolean;
  showElectronConfiguration: boolean;
  showNucleusDetail: boolean;
}

export interface AtomBuilderConstraints {
  maxProtons: number;
  maxShells: number;
  allowIons: boolean;
  allowIsotopes: boolean;
}

export interface AtomBuilderData {
  title: string;
  description?: string;
  targetElement: {
    atomicNumber: number | null;
    massNumber: number | null;
    charge: number;
    name: string | null;
  };
  challenges: AtomBuilderChallenge[];
  showOptions: AtomBuilderShowOptions;
  constraints: AtomBuilderConstraints;
  imagePrompt?: string | null;
  gradeBand: '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AtomBuilderMetrics>) => void;
}

const SHELL_CAPACITIES = [2, 8, 8, 18];

function getShellDistribution(electrons: number, maxShells: number): number[] {
  const shells: number[] = [];
  let remaining = electrons;
  for (let i = 0; i < maxShells && remaining > 0; i++) {
    const cap = SHELL_CAPACITIES[i] || 18;
    const inShell = Math.min(remaining, cap);
    shells.push(inShell);
    remaining -= inShell;
  }
  return shells;
}

function getElectronConfig(shells: number[]): string {
  const labels = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p'];
  const subshellCapacities = [2, 2, 6, 2, 6, 2, 10, 6];
  let remaining = shells.reduce((a, b) => a + b, 0);
  const parts: string[] = [];
  for (let i = 0; i < labels.length && remaining > 0; i++) {
    const cap = subshellCapacities[i];
    const fill = Math.min(remaining, cap);
    parts.push(`${labels[i]}${fill}`);
    remaining -= fill;
  }
  return parts.join(' ');
}

// ============================================================================
// Bohr Model SVG Component
// ============================================================================

interface BohrModelProps {
  protons: number;
  neutrons: number;
  shells: number[];
  nucleusColor: string;
  size?: number;
  showNucleusDetail: boolean;
}

const BohrModel: React.FC<BohrModelProps> = ({
  protons, neutrons, shells, nucleusColor, size = 280, showNucleusDetail,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const nucleusRadius = Math.min(28, 12 + (protons + neutrons) * 0.5);
  const shellRadii = shells.map((_, i) => nucleusRadius + 28 + i * 30);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Shell rings */}
      {shells.map((_, i) => (
        <circle
          key={`ring-${i}`}
          cx={cx} cy={cy} r={shellRadii[i]}
          fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="1"
          strokeDasharray="4 3"
        />
      ))}

      {/* Shell capacity labels */}
      {shells.map((count, i) => (
        <text
          key={`cap-${i}`}
          x={cx + shellRadii[i] + 4} y={cy - 4}
          fill="rgba(148,163,184,0.5)" fontSize="9" fontFamily="monospace"
        >
          {count}/{SHELL_CAPACITIES[i]}
        </text>
      ))}

      {/* Nucleus */}
      <circle cx={cx} cy={cy} r={nucleusRadius} fill={nucleusColor} opacity={0.85} />
      {showNucleusDetail && protons + neutrons <= 16 ? (
        <>
          {Array.from({ length: protons }).map((_, i) => {
            const angle = (i / Math.max(protons, 1)) * Math.PI * 2;
            const r = nucleusRadius * 0.5;
            return (
              <circle
                key={`p-${i}`}
                cx={cx + Math.cos(angle) * r * (i % 2 === 0 ? 0.4 : 0.7)}
                cy={cy + Math.sin(angle) * r * (i % 2 === 0 ? 0.7 : 0.4)}
                r={3.5} fill="#ef4444" stroke="#fca5a5" strokeWidth="0.5"
              />
            );
          })}
          {Array.from({ length: neutrons }).map((_, i) => {
            const angle = ((i + 0.5) / Math.max(neutrons, 1)) * Math.PI * 2 + 0.3;
            const r = nucleusRadius * 0.5;
            return (
              <circle
                key={`n-${i}`}
                cx={cx + Math.cos(angle) * r * (i % 2 === 0 ? 0.6 : 0.35)}
                cy={cy + Math.sin(angle) * r * (i % 2 === 0 ? 0.35 : 0.6)}
                r={3.5} fill="#94a3b8" stroke="#cbd5e1" strokeWidth="0.5"
              />
            );
          })}
        </>
      ) : (
        <text x={cx} y={cy + 5} textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
          {protons}p {neutrons}n
        </text>
      )}

      {/* Electrons on shells */}
      {shells.map((count, shellIdx) =>
        Array.from({ length: count }).map((_, eIdx) => {
          const angle = (eIdx / count) * Math.PI * 2 - Math.PI / 2;
          const ex = cx + Math.cos(angle) * shellRadii[shellIdx];
          const ey = cy + Math.sin(angle) * shellRadii[shellIdx];
          return (
            <circle
              key={`e-${shellIdx}-${eIdx}`}
              cx={ex} cy={ey} r={4}
              fill="#60a5fa" stroke="#93c5fd" strokeWidth="1"
            />
          );
        })
      )}
    </svg>
  );
};

// ============================================================================
// Open-build scene (make_atom): one svg that holds only the learner's atom
// ============================================================================

/** Nucleus particles in a sunflower spiral, protons spread evenly among the neutrons. */
function nucleusParticles(protons: number, neutrons: number, cx: number, cy: number, scale: number) {
  const total = protons + neutrons;
  return Array.from({ length: total }, (_, i) => {
    const r = 4.2 * Math.sqrt(i + 0.5) * scale;
    const a = i * 2.39996;
    const isProton = Math.floor(((i + 1) * protons) / total) > Math.floor((i * protons) / total);
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), isProton };
  });
}

function AtomDrawing({ atom, cx, cy, scale, prefix, ringLabels }: {
  atom: BuiltAtom; cx: number; cy: number; scale: number; prefix: string; ringLabels?: string[];
}) {
  const shells = atomShells(atom.electrons);
  const nucleusR = (4.2 * Math.sqrt(Math.max(atom.protons + atom.neutrons, 1)) + 6) * scale;
  const ringR = (i: number) => nucleusR + (20 + i * 21) * scale;
  return (
    <g data-atom={prefix}>
      {shells.map((_, i) => (
        <circle key={`${prefix}-ring-${i}`} cx={cx} cy={cy} r={ringR(i)} fill="none" stroke="rgba(148,163,184,0.35)"
          strokeWidth={1} strokeDasharray="4 3" />
      ))}
      {atom.protons + atom.neutrons > 0 && <circle cx={cx} cy={cy} r={nucleusR} fill="rgba(71,85,105,0.55)" />}
      {nucleusParticles(atom.protons, atom.neutrons, cx, cy, scale).map((pt, i) => (
        <circle key={`${prefix}-nuc-${i}`} data-particle={pt.isProton ? 'proton' : 'neutron'} cx={pt.x} cy={pt.y}
          r={3.4 * scale} fill={pt.isProton ? '#ef4444' : '#94a3b8'} stroke={pt.isProton ? '#fca5a5' : '#cbd5e1'} strokeWidth={0.5} />
      ))}
      {shells.map((count, si) => Array.from({ length: count }).map((_, ei) => {
        const a = (ei / count) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle key={`${prefix}-e-${si}-${ei}`} data-particle="electron" cx={cx + Math.cos(a) * ringR(si)}
            cy={cy + Math.sin(a) * ringR(si)} r={4 * scale} fill="#60a5fa" stroke="#93c5fd" strokeWidth={1} />
        );
      }))}
      {/* ring_counts lever: each ring labelled "n of cap" */}
      {ringLabels?.map((label, i) => (
        <text key={`${prefix}-rl-${i}`} data-lever="ring-count" x={cx + ringR(i) * 0.72 + 4} y={cy - ringR(i) * 0.72 - 3}
          fill="#fde68a" fontSize={11} fontFamily="monospace">{label}</text>
      ))}
    </g>
  );
}

/**
 * The make_atom board. Everything drawn is the learner's own work (the atom, and the kept first atom of an isotope
 * pair), so the watcher's picture is exactly what they made. No capacity labels, no category colour, no counts:
 * those would read the property off for them (the `ring_counts` lever adds ring labels when pulled).
 */
const AtomBuildScene = React.forwardRef<SVGSVGElement, { atom: BuiltAtom; kept: BuiltAtom | null; ringLabels?: string[] }>(
  function AtomBuildScene({ atom, kept, ringLabels }, ref) {
    const empty = atom.protons + atom.neutrons + atom.electrons === 0;
    return (
      <svg ref={ref} data-build-scene="atom" viewBox="0 0 360 360" className="mx-auto h-auto w-full max-w-[340px]"
        role="img" aria-label="Your atom">
        <rect x={0} y={0} width={360} height={360} rx={16} fill="#0b1220" />
        {kept && (
          <g data-kept-atom>
            <rect x={6} y={6} width={92} height={100} rx={10} fill="rgba(30,41,59,0.8)" stroke="rgba(148,163,184,0.3)" />
            <text x={52} y={21} textAnchor="middle" fill="#cbd5e1" fontSize={10}>Kept atom</text>
            <AtomDrawing atom={kept} cx={52} cy={62} scale={0.3} prefix="kept" />
          </g>
        )}
        {empty ? (
          <g data-aid>
            <circle cx={180} cy={180} r={40} fill="none" stroke="rgba(148,163,184,0.35)" strokeDasharray="5 4" />
            <text x={180} y={250} textAnchor="middle" fill="#64748b" fontSize={13}>Add particles below</text>
          </g>
        ) : (
          <AtomDrawing atom={atom} cx={kept ? 205 : 180} cy={kept ? 200 : 180} scale={1} prefix="now" ringLabels={ringLabels} />
        )}
      </svg>
    );
  },
);

// ============================================================================
// Mini Periodic Table Component
// ============================================================================

const MINI_TABLE_LAYOUT: { z: number; row: number; col: number }[] = [
  { z: 1, row: 0, col: 0 }, { z: 2, row: 0, col: 17 },
  { z: 3, row: 1, col: 0 }, { z: 4, row: 1, col: 1 },
  { z: 5, row: 1, col: 12 }, { z: 6, row: 1, col: 13 }, { z: 7, row: 1, col: 14 },
  { z: 8, row: 1, col: 15 }, { z: 9, row: 1, col: 16 }, { z: 10, row: 1, col: 17 },
  { z: 11, row: 2, col: 0 }, { z: 12, row: 2, col: 1 },
  { z: 13, row: 2, col: 12 }, { z: 14, row: 2, col: 13 }, { z: 15, row: 2, col: 14 },
  { z: 16, row: 2, col: 15 }, { z: 17, row: 2, col: 16 }, { z: 18, row: 2, col: 17 },
  ...Array.from({ length: 18 }, (_, i) => ({ z: 19 + i, row: 3, col: i })),
];

interface MiniPeriodicTableProps {
  highlightZ: number;
  maxZ: number;
  /** table_key lever: each cell writes its symbol and usual mass number. The same for every item. */
  keyed?: boolean;
}

const MiniPeriodicTable: React.FC<MiniPeriodicTableProps> = ({ highlightZ, maxZ, keyed }) => {
  const cells = MINI_TABLE_LAYOUT.filter(c => c.z <= maxZ);
  const key = keyed ? new Map(tableKey(maxZ).map(k => [k.z, k])) : null;
  const w = keyed ? 19 : 10, h = keyed ? 30 : 12;
  return (
    <div className="p-2 bg-black/20 rounded-lg border border-white/10 overflow-x-auto" {...(keyed ? { 'data-lever': 'table-key' } : {})}>
      <p className="text-[10px] text-slate-500 mb-1 font-mono uppercase">Mini Periodic Table</p>
      <div className="relative" style={{ width: w * 18, height: h * 4 + 2 }}>
        {cells.map(({ z, row, col }) => {
          const el = ELEMENTS[z];
          const isHighlight = z === highlightZ;
          const k = key?.get(z);
          return (
            <div
              key={z}
              className={`absolute flex flex-col items-center justify-center font-mono rounded-sm transition-all leading-none
                ${keyed ? 'text-[7px]' : 'text-[7px]'}
                ${isHighlight
                  ? 'ring-1 ring-cyan-400 bg-cyan-500/40 text-white font-bold scale-125 z-10'
                  : 'bg-slate-800/60 text-slate-500'}`}
              style={{ left: col * w, top: row * h, width: w - 1, height: h - 1 }}
              title={el?.name || `Element ${z}`}
            >
              <span>{z}</span>
              {k && <span data-table-symbol className="text-[8px] text-slate-200">{k.symbol}</span>}
              {k && <span data-table-mass className="text-[6px] text-amber-200/80">{k.mass}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Particle Supply Tray
// ============================================================================

interface ParticleTrayProps {
  onAdd: (type: 'proton' | 'neutron' | 'electron') => void;
  onRemove: (type: 'proton' | 'neutron' | 'electron') => void;
  protons: number;
  neutrons: number;
  electrons: number;
  disabled: boolean;
  maxProtons: number;
}

const ParticleTray: React.FC<ParticleTrayProps> = ({
  onAdd, onRemove, protons, neutrons, electrons, disabled, maxProtons,
}) => {
  const particles = [
    { type: 'proton' as const, label: 'Proton', symbol: 'p+', color: 'bg-red-500', border: 'border-red-400', count: protons, max: maxProtons },
    { type: 'neutron' as const, label: 'Neutron', symbol: 'n0', color: 'bg-slate-500', border: 'border-slate-400', count: neutrons, max: maxProtons + 10 },
    { type: 'electron' as const, label: 'Electron', symbol: 'e-', color: 'bg-blue-500', border: 'border-blue-400', count: electrons, max: maxProtons + 4 },
  ];

  return (
    <div className="flex gap-3 justify-center">
      {particles.map(p => (
        <div key={p.type} className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-slate-500 font-mono uppercase">{p.label}</span>
          <div className={`w-10 h-10 rounded-full ${p.color} border-2 ${p.border} flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
            {p.symbol}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              aria-label={`Remove ${p.type}`}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10"
              onClick={() => onRemove(p.type)}
              disabled={disabled || p.count <= 0}
            >
              -
            </Button>
            <span className="text-sm text-slate-200 w-6 text-center font-mono">{p.count}</span>
            <Button
              variant="ghost" size="sm"
              aria-label={`Add ${p.type}`}
              className="h-6 w-6 p-0 text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10"
              onClick={() => onAdd(p.type)}
              disabled={disabled || p.count >= p.max}
            >
              +
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Main AtomBuilder Component
// ============================================================================

interface AtomBuilderProps {
  data: AtomBuilderData;
  className?: string;
  /** Carried onto the runtime mount so the live host keeps its resolved plan metadata. */
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted rather than rebuilt from the item. */
  runtimeEvalMode?: string;
}

/**
 * Atom Builder: add protons, neutrons and electrons to build atoms (classic target checks), and the open build
 * `make_atom`: make ANY atom with the asked property, judged by code at "I'm done!".
 *
 * On the shared teaching workspace (W1, plain shape; `atomBuilderWorkspace.ts`) every check commits through
 * `progress.commitCheck` and the runtime owns progression: no auto-advance, no scripted cues, the scored session
 * submitted from `onFinished`. Levers: `atomBuilderLevers.ts`.
 */
const AtomBuilderSurface = ({ data, className, runtimePlanItemId, tutorOwned, useController }:
  AtomBuilderProps & { tutorOwned: boolean; useController: (options: ProgressOptions<AtomBuilderChallenge>) => Progress }) => {
  const workspace = useRef<TeachingWorkspace | null>(null);
  const {
    title,
    description,
    challenges,
    showOptions,
    constraints,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  const stableInstanceIdRef = useRef(instanceId || `atom-builder-${Date.now()}`);
  const resolvedInstanceId = instanceId || stableInstanceIdRef.current;

  // ── Challenge progress. On the workspace path the runtime moves the index. ──
  const openItem = useRef<(index: number, retry: boolean) => void>(() => {});
  const finish = useRef<(result: TeachingEvaluationResult) => void>(() => {});
  const progress = useController({
    challenges,
    getChallengeId: (c) => c.id,
    instanceId: resolvedInstanceId, objectiveId, planItemId: runtimePlanItemId,
    workspace, assignment: workspaceAssignment,
    onItemOpened: (index, retry) => openItem.current(index, retry),
    onFinished: (result) => finish.current(result),
  });
  const challengeIndex = progress.currentIndex;
  /** Workspace path: a checked answer stays closed until Try again or Next challenge on the shell. */
  const learnerBlocked = () => tutorOwned && progress.canAttempt === false;

  // Levers (`atomBuilderLevers.ts`), keyed by the session item they were pulled on, and the easier item a simplify
  // lever put on screen in its place. No lever comes from the tier.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<AtomBuilderChallenge | null>(null);
  const sessionChallenge = challenges[challengeIndex] ?? null;
  /** What is on screen: the easier ask while a simplify lever holds it, else the session item. */
  const currentChallenge = practice ?? sessionChallenge;
  const pulledLevers = leverState.item === sessionChallenge?.id ? leverState.pulled : [];
  const leverOn = (id: string) => !practice && pulledLevers.includes(id);

  // ---- State ----
  const [protons, setProtons] = useState(0);
  const [neutrons, setNeutrons] = useState(0);
  const [electrons, setElectrons] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set());
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [shellsFilled, setShellsFilled] = useState(true);
  const [ionsCreated, setIonsCreated] = useState(0);
  const [isotopesCreated, setIsotopesCreated] = useState(0);
  const [periodicTableUsed, setPeriodicTableUsed] = useState(false);
  const [valenceIdentified, setValenceIdentified] = useState(false);

  const attemptRef = useRef(0);

  // ---- Derived state ----
  const shells = useMemo(
    () => getShellDistribution(electrons, constraints.maxShells),
    [electrons, constraints.maxShells]
  );
  const charge = protons - electrons;
  const massNumber = protons + neutrons;
  const element = protons > 0 ? ELEMENTS[protons] : null;
  const valenceElectrons = shells.length > 0 ? shells[shells.length - 1] : 0;

  // make_atom (open build): the learner makes any atom with the asked property; code judges it at "I'm done!".
  // A make_atom item with no `ask` (an older or malformed payload) keeps the classic target check.
  const openAsk: AtomAsk | null = openAskOf(currentChallenge);
  const isOpenBuild = !!openAsk;
  const [keptAtom, setKeptAtom] = useState<BuiltAtom | null>(null);
  const [solvedId, setSolvedId] = useState<string | null>(null);
  const sceneRef = useRef<SVGSVGElement>(null);
  const openSolved = isOpenBuild && solvedId === currentChallenge?.id;
  // Where the element is the answer, the card names it only after the check: otherwise adding protons
  // until the card reads the asked name solves the item.
  const cardNamesElement = showOptions.showIdentityCard && !(
    !!currentChallenge && ['build_element', 'identify', 'find_on_table'].includes(currentChallenge.type)
    && !completedChallenges.has(currentChallenge.id) && solvedId !== currentChallenge.id
  );

  // Check if shells are correctly filled (no gaps)
  const shellsCorrect = useMemo(() => {
    for (let i = 0; i < shells.length - 1; i++) {
      if (shells[i] < SHELL_CAPACITIES[i]) return false;
    }
    return true;
  }, [shells]);

  // ---- AI Tutoring (scripted path only) ----
  // On the workspace path the tutor reads the published scene, and the scripted cues send nothing.
  const aiPrimitiveData = useMemo(() => ({
    protons,
    neutrons,
    electrons,
    charge,
    massNumber,
    elementName: element?.name || 'none',
    elementSymbol: element?.symbol || '',
    shells: JSON.stringify(shells),
    shellsCorrect,
    valenceElectrons,
    currentChallengeIndex: challengeIndex,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type || '',
    instruction: currentChallenge?.instruction || '',
    attemptNumber: attemptsCount,
    gradeBand,
  }), [protons, neutrons, electrons, charge, massNumber, element, shells, shellsCorrect, valenceElectrons, challengeIndex, challenges.length, currentChallenge, attemptsCount, gradeBand]);

  const { sendText: sendLegacyText, isAudioPlaying, activePrimitiveId } = useLuminaAI({
    primitiveType: 'atom-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
    enabled: !tutorOwned,
  });
  const sendText = useCallback((text: string, options?: Parameters<typeof sendLegacyText>[1]) => {
    if (!tutorOwned) sendLegacyText(text, options);
  }, [tutorOwned, sendLegacyText]);

  // ---- Evaluation ----
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<AtomBuilderMetrics>({
    primitiveType: 'atom-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ---- Per-item reset ----
  const resetAtom = useCallback(() => {
    setProtons(0);
    setNeutrons(0);
    setElectrons(0);
    setKeptAtom(null);
    setFeedback(null);
  }, []);

  /** Every per-item slot, for a fresh item, a practice item, and the return from one. */
  const resetFor = useRef<string | null>(null);
  const resetItem = (challenge: AtomBuilderChallenge | null) => {
    resetFor.current = challenge?.id ?? null;
    resetAtom();
    setSolvedId(null);
    attemptRef.current = 0;
  };
  useEffect(() => {
    if (currentChallenge && resetFor.current !== currentChallenge.id) resetItem(currentChallenge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChallenge?.id]);

  // Workspace path: a fresh item ends any practice and opens an empty board. Try again keeps the atom and the
  // verdict's words (they name no count), so the learner fixes the build.
  openItem.current = (index, retry) => {
    if (retry) return;
    setPractice(null);
    resetItem(challenges[index] ?? null);
  };

  // ---- Handlers ----
  const trayLimit = constraints.maxProtons;
  const addParticle = (type: 'proton' | 'neutron' | 'electron') => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    if (type === 'proton') setProtons(p => Math.min(p + 1, trayLimit));
    else if (type === 'neutron') setNeutrons(n => Math.min(n + 1, trayLimit + 10));
    else setElectrons(e => Math.min(e + 1, trayLimit + 4));
    // On the open build the verdict's words stay until the next check, while the learner fixes the atom.
    if (!isOpenBuild) setFeedback(null);
  };

  const removeParticle = (type: 'proton' | 'neutron' | 'electron') => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    if (type === 'proton') setProtons(p => Math.max(p - 1, 0));
    else if (type === 'neutron') setNeutrons(n => Math.max(n - 1, 0));
    else setElectrons(e => Math.max(e - 1, 0));
    if (!isOpenBuild) setFeedback(null);
  };

  /** Isotope pairs: the first atom is kept beside the board and the current build stays, ready to change. */
  const keepAtom = () => {
    if (learnerBlocked()) return;
    SoundManager.tick();
    setKeptAtom({ protons, neutrons, electrons });
  };

  const handleFinalSubmit = useCallback(() => {
    if (hasSubmitted) return;

    const totalChallenges = challenges.length;
    const completedCount = completedChallenges.size + (currentChallenge && !completedChallenges.has(currentChallenge.id) ? 1 : 0);
    const ionChallenges = challenges.filter(c => c.type === 'make_ion').length;
    const isotopeChallenges = challenges.filter(c => c.type === 'make_isotope').length;
    const identifyChallenges = challenges.filter(c => c.type === 'identify').length;
    const score = (completedCount / Math.max(totalChallenges, 1)) * 100;

    const metrics: AtomBuilderMetrics = {
      type: 'atom-builder',
      elementsBuiltCorrectly: completedCount,
      elementsTotal: totalChallenges,
      shellsFilledCorrectly: shellsFilled,
      elementIdentifiedFromAtom: challenges.filter(c => c.type === 'identify' && completedChallenges.has(c.id)).length,
      identificationTotal: identifyChallenges,
      ionsCreatedCorrectly: ionsCreated,
      ionsTotal: ionChallenges,
      isotopesCreatedCorrectly: isotopesCreated,
      isotopesTotal: isotopeChallenges,
      periodicTableConnectionMade: periodicTableUsed,
      valenceElectronsIdentified: valenceIdentified,
      attemptsCount,
    };

    submitResult(score >= 70, score, metrics, {
      studentWork: {
        completedChallenges: Array.from(completedChallenges),
        finalAtom: { protons, neutrons, electrons },
      },
    });

    setFeedback('All challenges complete! Great work building atoms!');
    setFeedbackType('success');

    sendText(
      `[ALL_COMPLETE] Student finished all ${totalChallenges} atom-building challenges. Score: ${Math.round(score)}%. ` +
      `Shells correct: ${shellsFilled}. Ions created: ${ionsCreated}/${ionChallenges}. ` +
      `Celebrate their accomplishment and summarize what they learned about atoms.`,
      { silent: true }
    );
  }, [hasSubmitted, challenges, completedChallenges, currentChallenge, shellsFilled, ionsCreated, isotopesCreated, periodicTableUsed, valenceIdentified, attemptsCount, protons, neutrons, electrons, submitResult, sendText]);

  // Workspace path, under a lesson's evaluation provider only: the scored session, whose item scores count
  // corrections and whose evidence carries each wrong check's named miss.
  finish.current = (result) => {
    if (hasSubmitted || progress.recordsEvaluation === false) return;
    const metrics: AtomBuilderMetrics = {
      type: 'atom-builder',
      elementsBuiltCorrectly: completedChallenges.size,
      elementsTotal: challenges.length,
      shellsFilledCorrectly: shellsFilled,
      elementIdentifiedFromAtom: challenges.filter(c => c.type === 'identify' && completedChallenges.has(c.id)).length,
      identificationTotal: challenges.filter(c => c.type === 'identify').length,
      ionsCreatedCorrectly: ionsCreated,
      ionsTotal: challenges.filter(c => c.type === 'make_ion').length,
      isotopesCreatedCorrectly: isotopesCreated,
      isotopesTotal: challenges.filter(c => c.type === 'make_isotope').length,
      periodicTableConnectionMade: periodicTableUsed,
      valenceElectronsIdentified: valenceIdentified,
      attemptsCount: result.attemptsCount,
    };
    submitResult(result.passed, result.accuracy, metrics,
      { challengeResults: result.outcomes, learningResponses: result.learningResponses,
        teachingAttempts: result.teachingAttempts, assistanceProvenance: result.assistanceProvenance },
      undefined, result.diagnosisEvidence);
  };

  // ── The learner's work, as the check, the tutor and the scene read it ──
  const view: AtomView = { protons, neutrons, electrons, kept: keptAtom, identityCard: cardNamesElement };

  const checkChallenge = () => {
    if (!currentChallenge || learnerBlocked()) return;

    attemptRef.current += 1;
    setAttemptsCount(prev => prev + 1);

    const miss = atomMiss(currentChallenge, view);
    const correct = !miss;
    // Counts the attempt and records a correct result on both paths; on the workspace path it is the checked gesture.
    progress.commitCheck(describeAtom(view), correct, miss);

    if (correct) {
      SoundManager.playCorrect();
      setFeedback(openAsk
        ? `Yes! ${openAsk.kind === 'isotopes' ? `Two isotopes of ${element?.name ?? 'one element'}.` : `Your ${element?.name ?? 'atom'} fits the ask.`}`
        : `Correct! ${element?.name ? `You built ${element.name}!` : ''}`);
      setFeedbackType('success');
      setSolvedId(currentChallenge.id);
      // A practice item is ungraded: no count, no completed mark, no advance.
      if (practice) return;
      setCompletedChallenges(prev => { const next = new Set(prev); next.add(currentChallenge.id); return next; });
      setShellsFilled(prev => prev && shellsCorrect);

      // Track specific challenge types
      if (currentChallenge.type === 'make_ion') setIonsCreated(prev => prev + 1);
      if (currentChallenge.type === 'make_isotope') setIsotopesCreated(prev => prev + 1);
      if (valenceElectrons > 0 && shells.length > 0) setValenceIdentified(true);

      sendText(
        `[CHALLENGE_CORRECT] Student completed challenge "${currentChallenge.instruction}" correctly on attempt ${attemptRef.current}. ` +
        `Built: ${element?.name || 'unknown'} with ${protons}p, ${neutrons}n, ${electrons}e (charge: ${charge >= 0 ? '+' : ''}${charge}). ` +
        `Congratulate briefly and explain what they built.`,
        { silent: true }
      );

      // Scripted path: the next challenge after a short pause, or the final submission. The workspace advances itself.
      if (tutorOwned) return;
      setTimeout(() => {
        if (challengeIndex < challenges.length - 1) progress.advance();
        else handleFinalSubmit();
      }, 2000);
    } else {
      SoundManager.playIncorrect();
      // Both paths: the miss's own words, never a count or the generated hint (it states the target counts).
      const words = miss in CLASSIC_MISS_WORDS
        ? CLASSIC_MISS_WORDS[miss as ClassicAtomMiss] : ATOM_BUILD_MISS_WORDS[miss as AtomBuildMiss];
      setFeedback(words);
      setFeedbackType('error');

      sendText(
        `[CHALLENGE_INCORRECT] Student attempted "${currentChallenge.instruction}" but got it wrong (attempt ${attemptRef.current}). ` +
        `Current atom: ${protons}p, ${neutrons}n, ${electrons}e. Issue: ${words} ` +
        `Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }
  };

  const handleReset = useCallback(() => {
    resetAtom();
    progress.reset();
    setCompletedChallenges(new Set());
    setAttemptsCount(0);
    setIonsCreated(0);
    setIsotopesCreated(0);
    setPeriodicTableUsed(false);
    setValenceIdentified(false);
    setShellsFilled(true);
    setSolvedId(null);
    attemptRef.current = 0;
    resetAttempt();
  }, [resetAtom, resetAttempt, progress]);

  // ── Workspace path: what the tutor and the observer are shown, republished every render ──
  // W1 offers no demonstration targets and no presentation. Every item declares levers.
  useLayoutEffect(() => {
    if (!tutorOwned || !currentChallenge || !sessionChallenge) return;
    const scene = workspaceScene(currentChallenge, view);
    const declared = atomLevers(sessionChallenge, pulledLevers);
    if (!declared.length && !practice) { workspace.current = { ...scene }; return; }
    const onScreen = practice ? '' : leverFacts(pulledLevers);
    const levers = practice ? [] : declared;
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      levers,
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled; its change is on screen.`;
        const refused = atomRefusal(id, view, keptAtom);
        if (refused) return refused;
        const pulled = { item: sessionChallenge.id, pulled: [...pulledLevers, id] };
        if (lever.kind === 'simplify') {
          const easier = practiceFor(sessionChallenge);
          if (!easier) return 'This item has no easier step; try a help lever.';
          setLeverState(pulled); resetItem(easier); setPractice(easier);
          return { practice: workspaceAssignment(easier) };
        }
        setLeverState(pulled);
        return true;
      },
      endPractice: () => { resetItem(sessionChallenge); setPractice(null); },
    };
  });

  // ---- Nucleus color based on element category ----
  const nucleusColor = element?.categoryColor || '#475569';

  // ── Pip shared surface ───────────────────────────────────────────
  // A projection of this item's check state, the tutor's speech on it, and
  // the child's touches; Pip points only at the workspace as a whole and never
  // chooses, checks, or advances.
  // The live line on the open build (shared build layer): what the atom looks like, never a verdict or a number.
  // The task is given without the property: the line may never say whether the atom has it.
  const particleTotal = protons + neutrons + electrons;
  const buildSeeing = useBuildWatcher({
    buildKey: `${currentChallenge?.id}:${protons},${neutrons},${electrons}:${keptAtom ? `${keptAtom.protons},${keptAtom.neutrons},${keptAtom.electrons}` : '-'}`,
    enabled: isOpenBuild && particleTotal > 0 && !openSolved && !hasSubmitted,
    svg: sceneRef,
    request: {
      task: 'Building an atom of their own from protons, neutrons and electrons',
      numbers: 'never',
      neverSay: ['full', 'ion', 'charge', 'charged', 'neutral', 'isotope', 'noble', 'negative', 'positive', 'stable',
        'valence', 'outer', 'balanced', 'extra', 'correct', 'right', 'wrong'],
      sceneNote: 'A dark board. Red dots are protons and grey dots are neutrons in the middle; blue dots are electrons on '
        + 'dashed rings around it. A small kept atom may sit in the top-left corner.',
      // The element is read off the protons, the way the board names it; naming the learner's own atom leaks nothing.
      made: `red protons and grey neutrons in the middle, blue electrons on ${element ? `rings: a ${element.name.toLowerCase()} atom` : 'rings'}`
        + (keptAtom ? '; a kept atom in the corner' : ''),
    },
  });

  const pip = useWorkspacePipSurface({
    instanceId: (instanceId || 'atom-builder'),
    scopeId: hasSubmitted ? null : currentChallenge?.id ?? null,
    label: 'The atom and the particle tray',
    solved: !!currentChallenge && (completedChallenges.has(currentChallenge.id) || solvedId === currentChallenge.id),
    tutorSpeaking: isAudioPlaying && activePrimitiveId === (instanceId || 'atom-builder'),
  });

  const blocked = hasSubmitted || learnerBlocked();
  const classicSolved = !isOpenBuild && solvedId === currentChallenge?.id;
  const pairs = pairUp(view);

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-lg">{title}</CardTitle>
            {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-cyan-300">
            {gradeBand === '3-5' ? 'Grades 3-5' : 'Grades 6-8'}
          </Badge>
        </div>

        {/* Challenge progress */}
        {challenges.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {challenges.map((ch, i) => (
              <div
                key={ch.id}
                className={`h-2 flex-1 rounded-full transition-all ${
                  completedChallenges.has(ch.id)
                    ? 'bg-emerald-500'
                    : i === challengeIndex
                    ? 'bg-cyan-500/80'
                    : 'bg-slate-700/50'
                }`}
              />
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current challenge instruction */}
        {currentChallenge && !hasSubmitted && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <p className="text-sm text-cyan-200 font-medium">
              {practice ? 'A first step' : `Challenge ${challengeIndex + 1}/${challenges.length}`}
            </p>
            <p className="text-slate-200 mt-1">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Pip's dock sits above the workspace, which it outlines as a region. */}
        {pip.store && !hasSubmitted && <div {...pip.dock} />}
        <div {...pip.workspace} className="space-y-4">
        {/* Main workspace: Bohr model + Identity card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bohr Model Visualization */}
          <div className="bg-black/20 rounded-xl border border-white/5 p-3 flex flex-col items-center justify-center">
            {isOpenBuild ? (
              <>
                <AtomBuildScene ref={sceneRef} atom={{ protons, neutrons, electrons }} kept={keptAtom}
                  ringLabels={leverOn(RING_COUNTS_LEVER) ? ringCounts(electrons) : undefined} />
                {buildSeeing && !openSolved && (
                  <div data-testid="build-watcher" className="mt-2 text-center">
                    <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm text-amber-100">👀 {buildSeeing}</span>
                  </div>
                )}
                {/* isotope_compare lever: the kept atom's and the current atom's nucleus side by side */}
                {leverOn(ISOTOPE_COMPARE_LEVER) && keptAtom && (
                  <table data-lever="isotope-compare" className="mt-2 text-xs font-mono text-slate-300">
                    <thead><tr><th className="px-2 text-left"></th><th className="px-2">Kept atom</th><th className="px-2">This atom</th></tr></thead>
                    <tbody>
                      <tr><td className="px-2 text-red-300">Protons</td><td className="px-2 text-center">{keptAtom.protons}</td><td className="px-2 text-center">{protons}</td></tr>
                      <tr><td className="px-2 text-slate-300">Neutrons</td><td className="px-2 text-center">{keptAtom.neutrons}</td><td className="px-2 text-center">{neutrons}</td></tr>
                    </tbody>
                  </table>
                )}
              </>
            ) : protons === 0 && neutrons === 0 && electrons === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">
                Add particles below to start building your atom
              </div>
            ) : (
              <BohrModel
                protons={protons}
                neutrons={neutrons}
                shells={shells}
                nucleusColor={nucleusColor}
                showNucleusDetail={showOptions.showNucleusDetail}
              />
            )}
          </div>

          {/* Identity Card + Stats */}
          <div className="space-y-3">
            {/* Identity Card */}
            {showOptions.showIdentityCard && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">Element Identity</p>
                {protons > 0 && element && !cardNamesElement ? (
                  <p className="text-slate-400 text-sm">The name shows once your atom is checked.</p>
                ) : protons > 0 && element ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xl font-bold"
                        style={{ color: isOpenBuild ? '#e2e8f0' : element.categoryColor }}
                      >
                        {element.symbol}
                      </span>
                      <span className="text-slate-200 text-lg">{element.name}</span>
                    </div>
                    {!isOpenBuild && (
                      <Badge className="text-[10px]" style={{ backgroundColor: element.categoryColor + '33', color: element.categoryColor, borderColor: element.categoryColor + '55' }}>
                        {element.category}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Add protons to identify the element</p>
                )}
              </div>
            )}

            {/* Particle tally */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-3">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">Particle Count</p>
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div>
                  <div className="text-red-400 font-mono font-bold">{protons}</div>
                  <div className="text-[10px] text-slate-500">Protons</div>
                </div>
                <div>
                  <div className="text-slate-400 font-mono font-bold">{neutrons}</div>
                  <div className="text-[10px] text-slate-500">Neutrons</div>
                </div>
                <div>
                  <div className="text-blue-400 font-mono font-bold">{electrons}</div>
                  <div className="text-[10px] text-slate-500">Electrons</div>
                </div>
              </div>
              {/* mass_meter lever: the learner's own mass number as a sum */}
              {leverOn(MASS_METER_LEVER) && (
                <p data-lever="mass-meter" className="mt-2 text-xs text-amber-200 font-mono text-center">{massLine(view)}</p>
              )}
              {/* pair_up lever: each electron beside a proton; a particle with no partner stands alone, ringed */}
              {leverOn(PAIR_UP_LEVER) && (
                <div data-lever="pair-up" className="mt-2 flex flex-wrap justify-center gap-1">
                  {Array.from({ length: pairs.pairs }, (_, i) => (
                    <span key={`pr-${i}`} data-pair="pair" className="flex gap-0.5 rounded bg-white/5 px-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" /><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    </span>
                  ))}
                  {Array.from({ length: pairs.lonePositive }, (_, i) => (
                    <span key={`lp-${i}`} data-pair="lone-proton" className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-amber-300" />
                  ))}
                  {Array.from({ length: pairs.loneNegative }, (_, i) => (
                    <span key={`le-${i}`} data-pair="lone-electron" className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-amber-300" />
                  ))}
                </div>
              )}
            </div>

            {/* Charge + Mass Number (not on the open build: each reads an asked property off for the learner) */}
            {!isOpenBuild && <div className="flex gap-2">
              {showOptions.showCharge && (
                <div className="flex-1 bg-black/20 rounded-lg border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-slate-500 font-mono uppercase">Charge</p>
                  <p className={`text-lg font-mono font-bold ${
                    charge === 0 ? 'text-slate-300' : charge > 0 ? 'text-amber-400' : 'text-blue-400'
                  }`}>
                    {charge === 0 ? '0' : `${charge > 0 ? '+' : ''}${charge}`}
                  </p>
                  {charge !== 0 && (
                    <p className="text-[9px] text-amber-300/70">Ion</p>
                  )}
                </div>
              )}
              {showOptions.showMassNumber && (
                <div className="flex-1 bg-black/20 rounded-lg border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-slate-500 font-mono uppercase">Mass #</p>
                  <p className="text-lg font-mono font-bold text-slate-200">{massNumber}</p>
                </div>
              )}
              {showOptions.showShellCapacity && (
                <div className="flex-1 bg-black/20 rounded-lg border border-white/5 p-2 text-center">
                  <p className="text-[9px] text-slate-500 font-mono uppercase">Valence e-</p>
                  <p className="text-lg font-mono font-bold text-blue-300">{shells.length > 0 ? valenceElectrons : '-'}</p>
                </div>
              )}
            </div>}

            {/* Electron config for older grades */}
            {showOptions.showElectronConfiguration && electrons > 0 && !isOpenBuild && (
              <div className="bg-black/20 rounded-lg border border-white/5 p-2">
                <p className="text-[9px] text-slate-500 font-mono uppercase">Electron Configuration</p>
                <p className="text-xs text-slate-300 font-mono mt-1">{getElectronConfig(shells)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Mini Periodic Table (the table_key lever shows it, with its key, even where the item hides it) */}
        {(showOptions.showMiniPeriodicTable || leverOn(TABLE_KEY_LEVER)) && (
          <div onClick={() => setPeriodicTableUsed(true)}>
            <MiniPeriodicTable highlightZ={protons} maxZ={constraints.maxProtons} keyed={leverOn(TABLE_KEY_LEVER)} />
          </div>
        )}

        {/* Particle Supply Tray */}
        <div className="bg-black/20 rounded-xl border border-white/5 p-4">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-3 text-center">Particle Supply</p>
          <ParticleTray
            onAdd={addParticle}
            onRemove={removeParticle}
            protons={protons}
            neutrons={neutrons}
            electrons={electrons}
            disabled={blocked || openSolved || (tutorOwned && classicSolved)}
            maxProtons={trayLimit}
          />
        </div>

        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`p-3 rounded-lg border ${
            feedbackType === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : feedbackType === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}>
            <p className="text-sm">{feedback}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          {isOpenBuild && !hasSubmitted ? (
            <>
              {openAsk?.kind === 'isotopes' && !keptAtom && (
                <Button
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
                  disabled={protons === 0 || openSolved || blocked}
                  onClick={keepAtom}
                >
                  Keep this atom
                </Button>
              )}
              <Button
                variant="ghost"
                className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
                disabled={(particleTotal === 0 && !keptAtom) || openSolved || blocked}
                onClick={() => { if (!learnerBlocked()) resetAtom(); }}
              >
                Start over
              </Button>
              <Button
                variant="ghost"
                className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
                disabled={particleTotal === 0 || openSolved || blocked}
                onClick={checkChallenge}
              >
                I&apos;m done!
              </Button>
            </>
          ) : (<>
          {!hasSubmitted && currentChallenge && (
            <Button
              variant="ghost"
              className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={checkChallenge}
              disabled={learnerBlocked()}
            >
              Check Answer
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            onClick={hasSubmitted ? handleReset : () => { if (!learnerBlocked()) resetAtom(); }}
            disabled={!hasSubmitted && learnerBlocked()}
          >
            {hasSubmitted ? 'Try Again' : 'Clear Atom'}
          </Button>
          </>)}
        </div>
      </CardContent>
    </Card>
  );
};

// The workspace path never mounts the scripted progress, whose auto-advance would compete with the observer.
const AtomBuilder = withWorkspaceController<AtomBuilderProps, ProgressOptions<AtomBuilderChallenge>, Progress>(
  'atom-builder', AtomBuilderSurface, useScriptedProgress, useWorkspaceProgressFor('atom-builder'));

export default AtomBuilder;
