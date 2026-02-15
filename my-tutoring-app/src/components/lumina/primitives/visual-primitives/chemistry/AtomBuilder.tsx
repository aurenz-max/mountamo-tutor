'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { AtomBuilderMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface AtomBuilderChallenge {
  id: string;
  type: 'build_element' | 'identify' | 'fill_shells' | 'make_ion' | 'make_isotope' | 'find_on_table';
  instruction: string;
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

// ============================================================================
// Element Data (first 36 elements)
// ============================================================================

interface ElementInfo {
  symbol: string;
  name: string;
  category: string;
  categoryColor: string;
}

const ELEMENTS: Record<number, ElementInfo> = {
  1: { symbol: 'H', name: 'Hydrogen', category: 'Nonmetal', categoryColor: '#22c55e' },
  2: { symbol: 'He', name: 'Helium', category: 'Noble Gas', categoryColor: '#a855f7' },
  3: { symbol: 'Li', name: 'Lithium', category: 'Alkali Metal', categoryColor: '#ef4444' },
  4: { symbol: 'Be', name: 'Beryllium', category: 'Alkaline Earth', categoryColor: '#f97316' },
  5: { symbol: 'B', name: 'Boron', category: 'Metalloid', categoryColor: '#14b8a6' },
  6: { symbol: 'C', name: 'Carbon', category: 'Nonmetal', categoryColor: '#22c55e' },
  7: { symbol: 'N', name: 'Nitrogen', category: 'Nonmetal', categoryColor: '#22c55e' },
  8: { symbol: 'O', name: 'Oxygen', category: 'Nonmetal', categoryColor: '#22c55e' },
  9: { symbol: 'F', name: 'Fluorine', category: 'Halogen', categoryColor: '#eab308' },
  10: { symbol: 'Ne', name: 'Neon', category: 'Noble Gas', categoryColor: '#a855f7' },
  11: { symbol: 'Na', name: 'Sodium', category: 'Alkali Metal', categoryColor: '#ef4444' },
  12: { symbol: 'Mg', name: 'Magnesium', category: 'Alkaline Earth', categoryColor: '#f97316' },
  13: { symbol: 'Al', name: 'Aluminum', category: 'Post-Transition Metal', categoryColor: '#3b82f6' },
  14: { symbol: 'Si', name: 'Silicon', category: 'Metalloid', categoryColor: '#14b8a6' },
  15: { symbol: 'P', name: 'Phosphorus', category: 'Nonmetal', categoryColor: '#22c55e' },
  16: { symbol: 'S', name: 'Sulfur', category: 'Nonmetal', categoryColor: '#22c55e' },
  17: { symbol: 'Cl', name: 'Chlorine', category: 'Halogen', categoryColor: '#eab308' },
  18: { symbol: 'Ar', name: 'Argon', category: 'Noble Gas', categoryColor: '#a855f7' },
  19: { symbol: 'K', name: 'Potassium', category: 'Alkali Metal', categoryColor: '#ef4444' },
  20: { symbol: 'Ca', name: 'Calcium', category: 'Alkaline Earth', categoryColor: '#f97316' },
  21: { symbol: 'Sc', name: 'Scandium', category: 'Transition Metal', categoryColor: '#ec4899' },
  22: { symbol: 'Ti', name: 'Titanium', category: 'Transition Metal', categoryColor: '#ec4899' },
  23: { symbol: 'V', name: 'Vanadium', category: 'Transition Metal', categoryColor: '#ec4899' },
  24: { symbol: 'Cr', name: 'Chromium', category: 'Transition Metal', categoryColor: '#ec4899' },
  25: { symbol: 'Mn', name: 'Manganese', category: 'Transition Metal', categoryColor: '#ec4899' },
  26: { symbol: 'Fe', name: 'Iron', category: 'Transition Metal', categoryColor: '#ec4899' },
  27: { symbol: 'Co', name: 'Cobalt', category: 'Transition Metal', categoryColor: '#ec4899' },
  28: { symbol: 'Ni', name: 'Nickel', category: 'Transition Metal', categoryColor: '#ec4899' },
  29: { symbol: 'Cu', name: 'Copper', category: 'Transition Metal', categoryColor: '#ec4899' },
  30: { symbol: 'Zn', name: 'Zinc', category: 'Transition Metal', categoryColor: '#ec4899' },
  31: { symbol: 'Ga', name: 'Gallium', category: 'Post-Transition Metal', categoryColor: '#3b82f6' },
  32: { symbol: 'Ge', name: 'Germanium', category: 'Metalloid', categoryColor: '#14b8a6' },
  33: { symbol: 'As', name: 'Arsenic', category: 'Metalloid', categoryColor: '#14b8a6' },
  34: { symbol: 'Se', name: 'Selenium', category: 'Nonmetal', categoryColor: '#22c55e' },
  35: { symbol: 'Br', name: 'Bromine', category: 'Halogen', categoryColor: '#eab308' },
  36: { symbol: 'Kr', name: 'Krypton', category: 'Noble Gas', categoryColor: '#a855f7' },
};

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
}

const MiniPeriodicTable: React.FC<MiniPeriodicTableProps> = ({ highlightZ, maxZ }) => {
  const cells = MINI_TABLE_LAYOUT.filter(c => c.z <= maxZ);
  return (
    <div className="p-2 bg-black/20 rounded-lg border border-white/10">
      <p className="text-[10px] text-slate-500 mb-1 font-mono uppercase">Mini Periodic Table</p>
      <div className="relative" style={{ width: 180, height: 50 }}>
        {cells.map(({ z, row, col }) => {
          const el = ELEMENTS[z];
          const isHighlight = z === highlightZ;
          return (
            <div
              key={z}
              className={`absolute flex items-center justify-center text-[7px] font-mono rounded-sm transition-all
                ${isHighlight
                  ? 'ring-1 ring-cyan-400 bg-cyan-500/40 text-white font-bold scale-125 z-10'
                  : 'bg-slate-800/60 text-slate-500'}`}
              style={{ left: col * 10, top: row * 12, width: 9, height: 11 }}
              title={el?.name || `Element ${z}`}
            >
              {z}
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
              className="h-6 w-6 p-0 text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10"
              onClick={() => onRemove(p.type)}
              disabled={disabled || p.count <= 0}
            >
              -
            </Button>
            <span className="text-sm text-slate-200 w-6 text-center font-mono">{p.count}</span>
            <Button
              variant="ghost" size="sm"
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
}

const AtomBuilder: React.FC<AtomBuilderProps> = ({ data, className }) => {
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

  // ---- State ----
  const [protons, setProtons] = useState(0);
  const [neutrons, setNeutrons] = useState(0);
  const [electrons, setElectrons] = useState(0);
  const [challengeIndex, setChallengeIndex] = useState(0);
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

  const resolvedInstanceId = instanceId || `atom-builder-${Date.now()}`;

  // ---- Derived state ----
  const shells = useMemo(
    () => getShellDistribution(electrons, constraints.maxShells),
    [electrons, constraints.maxShells]
  );
  const charge = protons - electrons;
  const massNumber = protons + neutrons;
  const element = protons > 0 ? ELEMENTS[protons] : null;
  const valenceElectrons = shells.length > 0 ? shells[shells.length - 1] : 0;
  const currentChallenge = challenges[challengeIndex] ?? null;

  // Check if shells are correctly filled (no gaps)
  const shellsCorrect = useMemo(() => {
    for (let i = 0; i < shells.length - 1; i++) {
      if (shells[i] < SHELL_CAPACITIES[i]) return false;
    }
    return true;
  }, [shells]);

  // ---- AI Tutoring ----
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

  const { sendText } = useLuminaAI({
    primitiveType: 'atom-builder',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
  });

  // ---- Evaluation ----
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<AtomBuilderMetrics>({
    primitiveType: 'atom-builder',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ---- Handlers ----
  const addParticle = useCallback((type: 'proton' | 'neutron' | 'electron') => {
    if (type === 'proton') setProtons(p => Math.min(p + 1, constraints.maxProtons));
    else if (type === 'neutron') setNeutrons(n => Math.min(n + 1, constraints.maxProtons + 10));
    else setElectrons(e => Math.min(e + 1, constraints.maxProtons + 4));
    setFeedback(null);
  }, [constraints.maxProtons]);

  const removeParticle = useCallback((type: 'proton' | 'neutron' | 'electron') => {
    if (type === 'proton') setProtons(p => Math.max(p - 1, 0));
    else if (type === 'neutron') setNeutrons(n => Math.max(n - 1, 0));
    else setElectrons(e => Math.max(e - 1, 0));
    setFeedback(null);
  }, []);

  const resetAtom = useCallback(() => {
    setProtons(0);
    setNeutrons(0);
    setElectrons(0);
    setFeedback(null);
  }, []);

  const checkChallenge = useCallback(() => {
    if (!currentChallenge) return;

    attemptRef.current += 1;
    setAttemptsCount(prev => prev + 1);

    let correct = true;
    const reasons: string[] = [];

    if (currentChallenge.targetProtons !== null && protons !== currentChallenge.targetProtons) {
      correct = false;
      reasons.push(`Need ${currentChallenge.targetProtons} protons (you have ${protons})`);
    }
    if (currentChallenge.targetNeutrons !== null && neutrons !== currentChallenge.targetNeutrons) {
      correct = false;
      reasons.push(`Need ${currentChallenge.targetNeutrons} neutrons (you have ${neutrons})`);
    }
    if (currentChallenge.targetElectrons !== null && electrons !== currentChallenge.targetElectrons) {
      correct = false;
      reasons.push(`Need ${currentChallenge.targetElectrons} electrons (you have ${electrons})`);
    }

    // For shell-filling challenges, also check shells are filled correctly
    if (currentChallenge.type === 'fill_shells' && !shellsCorrect) {
      correct = false;
      reasons.push('Electron shells are not filled in order');
    }

    if (correct) {
      setFeedback(`Correct! ${element?.name ? `You built ${element.name}!` : ''}`);
      setFeedbackType('success');
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

      // Auto-advance after short delay
      setTimeout(() => {
        if (challengeIndex < challenges.length - 1) {
          setChallengeIndex(prev => prev + 1);
          resetAtom();
          attemptRef.current = 0;
        } else {
          // All challenges done - submit evaluation
          handleFinalSubmit();
        }
      }, 2000);
    } else {
      setFeedback(reasons.join('. ') + `. Hint: ${currentChallenge.hint}`);
      setFeedbackType('error');

      sendText(
        `[CHALLENGE_INCORRECT] Student attempted "${currentChallenge.instruction}" but got it wrong (attempt ${attemptRef.current}). ` +
        `Current atom: ${protons}p, ${neutrons}n, ${electrons}e. Issues: ${reasons.join('; ')}. ` +
        `Give a brief hint without revealing the answer.`,
        { silent: true }
      );
    }
  }, [currentChallenge, protons, neutrons, electrons, shellsCorrect, element, charge, valenceElectrons, shells, challengeIndex, challenges.length, sendText, resetAtom]);

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

  const handleReset = useCallback(() => {
    resetAtom();
    setChallengeIndex(0);
    setCompletedChallenges(new Set());
    setAttemptsCount(0);
    setIonsCreated(0);
    setIsotopesCreated(0);
    setPeriodicTableUsed(false);
    setValenceIdentified(false);
    setShellsFilled(true);
    attemptRef.current = 0;
    resetAttempt();
  }, [resetAtom, resetAttempt]);

  // ---- Nucleus color based on element category ----
  const nucleusColor = element?.categoryColor || '#475569';

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
              Challenge {challengeIndex + 1}/{challenges.length}
            </p>
            <p className="text-slate-200 mt-1">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Main workspace: Bohr model + Identity card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bohr Model Visualization */}
          <div className="bg-black/20 rounded-xl border border-white/5 p-3 flex flex-col items-center justify-center">
            {protons === 0 && neutrons === 0 && electrons === 0 ? (
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
                {protons > 0 && element ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xl font-bold"
                        style={{ color: element.categoryColor }}
                      >
                        {element.symbol}
                      </span>
                      <span className="text-slate-200 text-lg">{element.name}</span>
                    </div>
                    <Badge className="text-[10px]" style={{ backgroundColor: element.categoryColor + '33', color: element.categoryColor, borderColor: element.categoryColor + '55' }}>
                      {element.category}
                    </Badge>
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
            </div>

            {/* Charge + Mass Number */}
            <div className="flex gap-2">
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
            </div>

            {/* Electron config for older grades */}
            {showOptions.showElectronConfiguration && electrons > 0 && (
              <div className="bg-black/20 rounded-lg border border-white/5 p-2">
                <p className="text-[9px] text-slate-500 font-mono uppercase">Electron Configuration</p>
                <p className="text-xs text-slate-300 font-mono mt-1">{getElectronConfig(shells)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Mini Periodic Table */}
        {showOptions.showMiniPeriodicTable && (
          <div onClick={() => setPeriodicTableUsed(true)}>
            <MiniPeriodicTable highlightZ={protons} maxZ={constraints.maxProtons} />
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
            disabled={hasSubmitted}
            maxProtons={constraints.maxProtons}
          />
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
        <div className="flex gap-2 justify-center">
          {!hasSubmitted && currentChallenge && (
            <Button
              variant="ghost"
              className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={checkChallenge}
            >
              Check Answer
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            onClick={hasSubmitted ? handleReset : resetAtom}
          >
            {hasSubmitted ? 'Try Again' : 'Clear Atom'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AtomBuilder;
