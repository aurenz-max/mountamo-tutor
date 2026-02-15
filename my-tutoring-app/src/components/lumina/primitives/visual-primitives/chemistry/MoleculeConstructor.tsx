'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { MoleculeConstructorMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

// ============================================================================
// Element Data
// ============================================================================

interface ElementData {
  symbol: string;
  name: string;
  valence: number;
  color: string;
  category: string;
}

const ELEMENTS: Record<string, ElementData> = {
  H:  { symbol: 'H',  name: 'Hydrogen',   valence: 1, color: '#3b82f6', category: 'Nonmetal' },
  C:  { symbol: 'C',  name: 'Carbon',     valence: 4, color: '#eab308', category: 'Nonmetal' },
  N:  { symbol: 'N',  name: 'Nitrogen',   valence: 3, color: '#22c55e', category: 'Nonmetal' },
  O:  { symbol: 'O',  name: 'Oxygen',     valence: 2, color: '#06b6d4', category: 'Nonmetal' },
  F:  { symbol: 'F',  name: 'Fluorine',   valence: 1, color: '#a855f7', category: 'Halogen' },
  S:  { symbol: 'S',  name: 'Sulfur',     valence: 2, color: '#f97316', category: 'Nonmetal' },
  P:  { symbol: 'P',  name: 'Phosphorus', valence: 3, color: '#ec4899', category: 'Nonmetal' },
  Cl: { symbol: 'Cl', name: 'Chlorine',   valence: 1, color: '#a855f7', category: 'Halogen' },
  Na: { symbol: 'Na', name: 'Sodium',     valence: 1, color: '#ef4444', category: 'Alkali Metal' },
  Ca: { symbol: 'Ca', name: 'Calcium',    valence: 2, color: '#f97316', category: 'Alkaline Earth' },
  K:  { symbol: 'K',  name: 'Potassium',  valence: 1, color: '#ef4444', category: 'Alkali Metal' },
};

// Placement positions spiraling from center
const ATOM_POSITIONS = [
  { x: 250, y: 175 }, { x: 170, y: 175 }, { x: 330, y: 175 },
  { x: 250, y: 105 }, { x: 250, y: 245 }, { x: 170, y: 105 },
  { x: 330, y: 105 }, { x: 170, y: 245 }, { x: 330, y: 245 },
  { x: 90, y: 175 },  { x: 410, y: 175 }, { x: 250, y: 45 },
  { x: 250, y: 305 }, { x: 90, y: 105 },  { x: 410, y: 105 },
];

const ATOM_RADIUS = 22;

// ============================================================================
// Data Types (Single Source of Truth)
// ============================================================================

export interface MoleculeConstructorChallenge {
  id: string;
  type: 'free_build' | 'build_target' | 'identify' | 'formula_write' | 'predict_bonds' | 'shape_predict';
  instruction: string;
  targetFormula: string | null;
  hint: string;
  narration: string;
}

export interface MoleculeGalleryEntry {
  name: string;
  formula: string;
  category: 'essential' | 'food' | 'atmosphere' | 'energy' | 'household';
  unlocked: boolean;
  imagePrompt: string;
}

export interface MoleculeConstructorShowOptions {
  showFormula: boolean;
  showName: boolean;
  showRealWorldImage: boolean;
  showValenceSatisfaction: boolean;
  show3DToggle: boolean;
  showElectronDots: boolean;
  showBondType: boolean;
}

export interface MoleculeConstructorData {
  title: string;
  description?: string;
  targetMolecule: {
    name: string | null;
    formula: string | null;
    atoms: { element: string; count: number }[];
    bonds: { atom1: number; atom2: number; type: 'single' | 'double' | 'triple' }[];
    realWorldUse: string;
    imagePrompt: string;
  };
  palette: {
    availableElements: string[];
    showValence: boolean;
    showElectronDots: boolean;
  };
  challenges: MoleculeConstructorChallenge[];
  moleculeGallery: MoleculeGalleryEntry[];
  showOptions: MoleculeConstructorShowOptions;
  gradeBand: '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<MoleculeConstructorMetrics>) => void;
}

// ============================================================================
// Internal Types
// ============================================================================

interface PlacedAtom {
  id: string;
  element: string;
  x: number;
  y: number;
}

interface Bond {
  id: string;
  atom1Id: string;
  atom2Id: string;
  type: 'single' | 'double' | 'triple';
}

// ============================================================================
// Helper Functions
// ============================================================================

function getValence(element: string): number {
  return ELEMENTS[element]?.valence ?? 1;
}

function getBondMultiplicity(type: 'single' | 'double' | 'triple'): number {
  return type === 'single' ? 1 : type === 'double' ? 2 : 3;
}

function getUsedBonds(atomId: string, allBonds: Bond[]): number {
  return allBonds
    .filter(b => b.atom1Id === atomId || b.atom2Id === atomId)
    .reduce((sum, b) => sum + getBondMultiplicity(b.type), 0);
}

function getAvailableBonds(atomId: string, element: string, allBonds: Bond[]): number {
  return getValence(element) - getUsedBonds(atomId, allBonds);
}

/** Compute molecular formula in Hill system: C first, H second, then alphabetical */
function computeFormula(atoms: PlacedAtom[]): string {
  if (atoms.length === 0) return '';
  const counts: Record<string, number> = {};
  atoms.forEach(a => { counts[a.element] = (counts[a.element] || 0) + 1; });
  const elements = Object.keys(counts).sort((a, b) => {
    if (a === 'C') return -1;
    if (b === 'C') return 1;
    if (a === 'H') return -1;
    if (b === 'H') return 1;
    return a.localeCompare(b);
  });
  return elements.map(el => el + (counts[el] > 1 ? counts[el] : '')).join('');
}

/** Normalize formula for comparison — handle subscript Unicode characters */
function normalizeFormula(f: string): string {
  return f
    .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
    .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
    .replace(/₈/g, '8').replace(/₉/g, '9').replace(/\s/g, '');
}

function allValenceSatisfied(atoms: PlacedAtom[], allBonds: Bond[]): boolean {
  return atoms.length > 0 && atoms.every(a => getAvailableBonds(a.id, a.element, allBonds) === 0);
}

const CATEGORY_COLORS: Record<string, string> = {
  essential: '#06b6d4',
  food: '#22c55e',
  atmosphere: '#3b82f6',
  energy: '#f97316',
  household: '#a855f7',
};

// ============================================================================
// Main Component
// ============================================================================

interface MoleculeConstructorProps {
  data: MoleculeConstructorData;
  className?: string;
}

const MoleculeConstructor: React.FC<MoleculeConstructorProps> = ({ data, className }) => {
  const {
    title,
    description,
    targetMolecule,
    palette,
    challenges,
    moleculeGallery,
    showOptions,
    gradeBand,
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  } = data;

  // ---- State ----
  const [placedAtoms, setPlacedAtoms] = useState<PlacedAtom[]>([]);
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('info');
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set());
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [moleculesBuiltCorrectly, setMoleculesBuiltCorrectly] = useState(0);
  const [bondsFormedCorrectly, setBondsFormedCorrectly] = useState(0);
  const [totalBondsFormed, setTotalBondsFormed] = useState(0);
  const [formulasCorrect, setFormulasCorrect] = useState(0);
  const [formulasTotal, setFormulasTotal] = useState(0);
  const [identifiedCorrectly, setIdentifiedCorrectly] = useState(0);
  const [identificationsTotal, setIdentificationsTotal] = useState(0);
  const [valenceRulesFollowed, setValenceRulesFollowed] = useState(true);
  const [unlockedMolecules, setUnlockedMolecules] = useState<Set<string>>(new Set());
  const [bondTypesExplored, setBondTypesExplored] = useState<Set<string>>(new Set(['single']));
  const [formulaInput, setFormulaInput] = useState('');
  const [identifyInput, setIdentifyInput] = useState('');

  const atomIdRef = useRef(0);
  const bondIdRef = useRef(0);
  const attemptRef = useRef(0);

  const resolvedInstanceId = instanceId || `molecule-constructor-${Date.now()}`;

  // ---- Derived state ----
  const formula = useMemo(() => computeFormula(placedAtoms), [placedAtoms]);
  const allSatisfied = useMemo(
    () => allValenceSatisfied(placedAtoms, bonds),
    [placedAtoms, bonds]
  );
  const currentChallenge = challenges[challengeIndex] ?? null;

  // ---- AI Tutoring ----
  const aiPrimitiveData = useMemo(() => ({
    atomsPlaced: placedAtoms.length,
    bondsFormed: bonds.length,
    formula,
    allValenceSatisfied: allSatisfied,
    targetFormula: targetMolecule.formula || '',
    targetName: targetMolecule.name || '',
    currentChallengeIndex: challengeIndex + 1,
    totalChallenges: challenges.length,
    challengeType: currentChallenge?.type || '',
    instruction: currentChallenge?.instruction || '',
    attemptNumber: attemptsCount,
    gradeBand,
    placedElements: placedAtoms.map(a => a.element).join(', '),
  }), [placedAtoms, bonds, formula, allSatisfied, targetMolecule, challengeIndex, challenges.length, currentChallenge, attemptsCount, gradeBand]);

  const { sendText } = useLuminaAI({
    primitiveType: 'molecule-constructor',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: gradeBand,
  });

  // ---- Evaluation ----
  const { submitResult, hasSubmitted, resetAttempt } = usePrimitiveEvaluation<MoleculeConstructorMetrics>({
    primitiveType: 'molecule-constructor',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
  });

  // ---- Handlers ----

  const addAtom = useCallback((element: string) => {
    if (placedAtoms.length >= ATOM_POSITIONS.length || hasSubmitted) return;
    const pos = ATOM_POSITIONS[placedAtoms.length];
    setPlacedAtoms(prev => [...prev, {
      id: `atom-${++atomIdRef.current}`,
      element,
      x: pos.x,
      y: pos.y,
    }]);
    setFeedback(null);
    setSelectedAtomId(null);
  }, [placedAtoms.length, hasSubmitted]);

  const handleAtomClick = useCallback((atomId: string) => {
    if (hasSubmitted) return;

    if (selectedAtomId === null) {
      setSelectedAtomId(atomId);
      return;
    }
    if (selectedAtomId === atomId) {
      setSelectedAtomId(null);
      return;
    }

    // Check for existing bond between the pair
    const existingBond = bonds.find(
      b => (b.atom1Id === selectedAtomId && b.atom2Id === atomId) ||
           (b.atom1Id === atomId && b.atom2Id === selectedAtomId)
    );

    if (existingBond) {
      // Upgrade bond type (single → double → triple)
      const nextType: 'double' | 'triple' | null =
        existingBond.type === 'single' ? 'double'
        : existingBond.type === 'double' ? 'triple'
        : null;

      if (nextType) {
        const a1 = placedAtoms.find(a => a.id === existingBond.atom1Id)!;
        const a2 = placedAtoms.find(a => a.id === existingBond.atom2Id)!;
        if (getAvailableBonds(a1.id, a1.element, bonds) >= 1 &&
            getAvailableBonds(a2.id, a2.element, bonds) >= 1) {
          setBonds(prev => prev.map(b => b.id === existingBond.id ? { ...b, type: nextType } : b));
          setBondTypesExplored(prev => new Set(prev).add(nextType));
          setTotalBondsFormed(prev => prev + 1);
        }
      }
    } else {
      // Form new single bond
      const a1 = placedAtoms.find(a => a.id === selectedAtomId)!;
      const a2 = placedAtoms.find(a => a.id === atomId)!;

      if (a1 && a2 &&
          getAvailableBonds(a1.id, a1.element, bonds) >= 1 &&
          getAvailableBonds(a2.id, a2.element, bonds) >= 1) {
        setBonds(prev => [...prev, {
          id: `bond-${++bondIdRef.current}`,
          atom1Id: selectedAtomId,
          atom2Id: atomId,
          type: 'single' as const,
        }]);
        setTotalBondsFormed(prev => prev + 1);

        if (bonds.length === 0) {
          sendText(
            `[FIRST_BOND] Student formed their first bond between ${a1.element} and ${a2.element}. ` +
            `Celebrate briefly and explain what a chemical bond means.`,
            { silent: true }
          );
        }
      } else {
        setValenceRulesFollowed(false);
        setFeedback("These atoms can't form another bond — their connection points are full!");
        setFeedbackType('info');
      }
    }
    setSelectedAtomId(null);
  }, [selectedAtomId, bonds, placedAtoms, hasSubmitted, sendText]);

  const removeAtom = useCallback((atomId: string) => {
    if (hasSubmitted) return;
    setPlacedAtoms(prev => prev.filter(a => a.id !== atomId));
    setBonds(prev => prev.filter(b => b.atom1Id !== atomId && b.atom2Id !== atomId));
    setSelectedAtomId(null);
    setFeedback(null);
  }, [hasSubmitted]);

  const clearWorkspace = useCallback(() => {
    setPlacedAtoms([]);
    setBonds([]);
    setSelectedAtomId(null);
    setFeedback(null);
    atomIdRef.current = 0;
    bondIdRef.current = 0;
  }, []);

  // ---- Challenge Validation ----

  const handleFinalSubmit = useCallback(() => {
    if (hasSubmitted) return;

    const completedCount = completedChallenges.size +
      (currentChallenge && !completedChallenges.has(currentChallenge.id) ? 1 : 0);
    const score = (completedCount / Math.max(challenges.length, 1)) * 100;

    const metrics: MoleculeConstructorMetrics = {
      type: 'molecule-constructor',
      moleculesBuiltCorrectly,
      moleculesTotal: challenges.filter(c => c.type === 'build_target' || c.type === 'free_build').length,
      bondsFormedCorrectly,
      bondsTotal: totalBondsFormed,
      formulasWrittenCorrectly: formulasCorrect,
      formulasTotal,
      moleculesIdentifiedCorrectly: identifiedCorrectly,
      identificationsTotal,
      valenceRulesFollowed,
      galleryMoleculesUnlocked: unlockedMolecules.size,
      bondTypesExplored: Array.from(bondTypesExplored),
      attemptsCount,
    };

    submitResult(score >= 70, score, metrics, {
      studentWork: {
        completedChallenges: Array.from(completedChallenges),
        finalFormula: formula,
      },
    });

    setFeedback("All challenges complete! You're a molecule master!");
    setFeedbackType('success');

    sendText(
      `[ALL_COMPLETE] Student finished all ${challenges.length} molecule-building challenges! Score: ${Math.round(score)}%. ` +
      `Molecules unlocked: ${unlockedMolecules.size}. Bond types explored: ${Array.from(bondTypesExplored).join(', ')}. ` +
      `Celebrate and summarize what they learned about molecules and bonding!`,
      { silent: true }
    );
  }, [hasSubmitted, completedChallenges, currentChallenge, challenges, moleculesBuiltCorrectly,
      bondsFormedCorrectly, totalBondsFormed, formulasCorrect, formulasTotal, identifiedCorrectly,
      identificationsTotal, valenceRulesFollowed, unlockedMolecules, bondTypesExplored,
      attemptsCount, formula, submitResult, sendText]);

  const handleCorrect = useCallback(() => {
    const moleculeName = targetMolecule.name || formula;
    setFeedback(`Correct! ${moleculeName ? `You built ${moleculeName}!` : 'Great work!'}`);
    setFeedbackType('success');
    setMoleculesBuiltCorrectly(prev => prev + 1);
    if (allSatisfied) setBondsFormedCorrectly(prev => prev + bonds.length);

    if (currentChallenge) {
      setCompletedChallenges(prev => { const next = new Set(prev); next.add(currentChallenge.id); return next; });
    }
    if (targetMolecule.formula) {
      setUnlockedMolecules(prev => { const next = new Set(prev); next.add(targetMolecule.formula!); return next; });
    }

    sendText(
      `[MOLECULE_COMPLETE] Student correctly built ${moleculeName} (${formula}) on attempt ${attemptRef.current}. ` +
      `${targetMolecule.realWorldUse || ''} Celebrate and explain the real-world connection!`,
      { silent: true }
    );

    setTimeout(() => {
      if (challengeIndex < challenges.length - 1) {
        setChallengeIndex(prev => prev + 1);
        clearWorkspace();
        setFormulaInput('');
        setIdentifyInput('');
        attemptRef.current = 0;
        sendText(
          `[NEXT_CHALLENGE] Moving to challenge ${challengeIndex + 2} of ${challenges.length}. Introduce the next task briefly.`,
          { silent: true }
        );
      } else {
        handleFinalSubmit();
      }
    }, 2000);
  }, [targetMolecule, formula, allSatisfied, bonds.length, currentChallenge, challengeIndex,
      challenges.length, sendText, clearWorkspace, handleFinalSubmit]);

  const handleIncorrect = useCallback((reasons: string[]) => {
    const hint = currentChallenge?.hint || 'Check the atom counts and make sure all bonds are connected!';
    setFeedback(`${reasons.join('. ')}. Hint: ${hint}`);
    setFeedbackType('error');

    sendText(
      `[MOLECULE_INCORRECT] Student's attempt at "${currentChallenge?.instruction}" was incorrect (attempt ${attemptRef.current}). ` +
      `Current formula: ${formula}. Issues: ${reasons.join('; ')}. Give a helpful hint without revealing the answer.`,
      { silent: true }
    );
  }, [currentChallenge, formula, sendText]);

  const checkChallenge = useCallback(() => {
    if (!currentChallenge) return;
    attemptRef.current += 1;
    setAttemptsCount(prev => prev + 1);

    if (currentChallenge.type === 'build_target') {
      const counts: Record<string, number> = {};
      placedAtoms.forEach(a => { counts[a.element] = (counts[a.element] || 0) + 1; });

      let atomsCorrect = true;
      for (const { element, count } of targetMolecule.atoms) {
        if ((counts[element] || 0) !== count) { atomsCorrect = false; break; }
      }
      const totalTarget = targetMolecule.atoms.reduce((sum, a) => sum + a.count, 0);
      if (placedAtoms.length !== totalTarget) atomsCorrect = false;

      if (atomsCorrect && allSatisfied) {
        handleCorrect();
      } else {
        const reasons: string[] = [];
        if (!atomsCorrect) reasons.push("The atom counts don't match the target molecule");
        if (!allSatisfied && atomsCorrect) reasons.push('Not all atoms have their bonds filled');
        handleIncorrect(reasons);
      }
    } else if (currentChallenge.type === 'formula_write') {
      setFormulasTotal(prev => prev + 1);
      const target = normalizeFormula(currentChallenge.targetFormula || targetMolecule.formula || '');
      if (normalizeFormula(formulaInput) === target) {
        setFormulasCorrect(prev => prev + 1);
        handleCorrect();
      } else {
        handleIncorrect([`The formula "${formulaInput}" doesn't match. Try again!`]);
      }
    } else if (currentChallenge.type === 'identify') {
      setIdentificationsTotal(prev => prev + 1);
      const target = (targetMolecule.name || '').toLowerCase().trim();
      if (identifyInput.toLowerCase().trim() === target) {
        setIdentifiedCorrectly(prev => prev + 1);
        handleCorrect();
      } else {
        handleIncorrect([`"${identifyInput}" isn't quite right. Look at the atoms and bonds carefully!`]);
      }
    } else {
      // free_build, predict_bonds, shape_predict
      if (placedAtoms.length > 0 && bonds.length > 0) {
        handleCorrect();
      } else {
        handleIncorrect(['Add some atoms and connect them with bonds to build a molecule!']);
      }
    }
  }, [currentChallenge, placedAtoms, bonds, allSatisfied, targetMolecule, formulaInput,
      identifyInput, handleCorrect, handleIncorrect]);

  const handleReset = useCallback(() => {
    clearWorkspace();
    setChallengeIndex(0);
    setCompletedChallenges(new Set());
    setAttemptsCount(0);
    setMoleculesBuiltCorrectly(0);
    setBondsFormedCorrectly(0);
    setTotalBondsFormed(0);
    setFormulasCorrect(0);
    setFormulasTotal(0);
    setIdentifiedCorrectly(0);
    setIdentificationsTotal(0);
    setValenceRulesFollowed(true);
    setUnlockedMolecules(new Set());
    setBondTypesExplored(new Set(['single']));
    setFormulaInput('');
    setIdentifyInput('');
    attemptRef.current = 0;
    resetAttempt();
  }, [clearWorkspace, resetAttempt]);

  // ---- Render Helpers ----

  const renderBondLine = useCallback((bond: Bond) => {
    const a1 = placedAtoms.find(a => a.id === bond.atom1Id);
    const a2 = placedAtoms.find(a => a.id === bond.atom2Id);
    if (!a1 || !a2) return null;

    const dx = a2.x - a1.x;
    const dy = a2.y - a1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    const angle = Math.atan2(dy, dx);
    const sx = a1.x + Math.cos(angle) * ATOM_RADIUS;
    const sy = a1.y + Math.sin(angle) * ATOM_RADIUS;
    const ex = a2.x - Math.cos(angle) * ATOM_RADIUS;
    const ey = a2.y - Math.sin(angle) * ATOM_RADIUS;
    const nx = -dy / len;
    const ny = dx / len;
    const gap = 4;

    if (bond.type === 'single') {
      return <line key={bond.id} x1={sx} y1={sy} x2={ex} y2={ey}
        stroke="rgba(148,163,184,0.8)" strokeWidth="2.5" strokeLinecap="round" />;
    }
    if (bond.type === 'double') {
      return (
        <g key={bond.id}>
          <line x1={sx + nx * gap} y1={sy + ny * gap} x2={ex + nx * gap} y2={ey + ny * gap}
            stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
          <line x1={sx - nx * gap} y1={sy - ny * gap} x2={ex - nx * gap} y2={ey - ny * gap}
            stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    }
    // triple
    return (
      <g key={bond.id}>
        <line x1={sx} y1={sy} x2={ex} y2={ey}
          stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
        <line x1={sx + nx * gap * 1.5} y1={sy + ny * gap * 1.5} x2={ex + nx * gap * 1.5} y2={ey + ny * gap * 1.5}
          stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
        <line x1={sx - nx * gap * 1.5} y1={sy - ny * gap * 1.5} x2={ex - nx * gap * 1.5} y2={ey - ny * gap * 1.5}
          stroke="rgba(148,163,184,0.8)" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }, [placedAtoms]);

  const renderValenceDots = useCallback((atom: PlacedAtom) => {
    if (!palette.showValence) return null;
    const valence = getValence(atom.element);
    const used = getUsedBonds(atom.id, bonds);

    return Array.from({ length: valence }).map((_, i) => {
      const a = (i / valence) * Math.PI * 2 - Math.PI / 2;
      const isBonded = i < used;
      return (
        <circle
          key={`vdot-${atom.id}-${i}`}
          cx={atom.x + Math.cos(a) * (ATOM_RADIUS + 7)}
          cy={atom.y + Math.sin(a) * (ATOM_RADIUS + 7)}
          r={3}
          fill={isBonded ? '#475569' : '#22c55e'}
          opacity={isBonded ? 0.3 : 0.9}
        />
      );
    });
  }, [bonds, palette.showValence]);

  // ---- Render ----

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

        {/* Challenge progress bar */}
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
        {/* Challenge instruction */}
        {currentChallenge && !hasSubmitted && (
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
            <p className="text-sm text-cyan-200 font-medium">
              Challenge {challengeIndex + 1}/{challenges.length}
            </p>
            <p className="text-slate-200 mt-1">{currentChallenge.instruction}</p>
          </div>
        )}

        {/* Workspace + Info panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* SVG Workspace */}
          <div className="lg:col-span-2 bg-black/20 rounded-xl border border-white/5 p-2">
            <svg width="100%" height="350" viewBox="0 0 500 350" className="mx-auto cursor-crosshair">
              {/* Subtle grid */}
              {[100, 200, 300, 400].map(x => (
                <line key={`vg-${x}`} x1={x} y1={0} x2={x} y2={350} stroke="rgba(148,163,184,0.05)" />
              ))}
              {[87, 175, 262].map(y => (
                <line key={`hg-${y}`} x1={0} y1={y} x2={500} y2={y} stroke="rgba(148,163,184,0.05)" />
              ))}

              {/* Bond lines */}
              {bonds.map(renderBondLine)}

              {/* Atoms */}
              {placedAtoms.map(atom => {
                const elData = ELEMENTS[atom.element];
                if (!elData) return null;
                const isSelected = selectedAtomId === atom.id;
                const canBond = selectedAtomId !== null && selectedAtomId !== atom.id &&
                  getAvailableBonds(atom.id, atom.element, bonds) > 0;
                const available = getAvailableBonds(atom.id, atom.element, bonds);

                return (
                  <g key={atom.id}
                    onClick={(e) => { e.stopPropagation(); handleAtomClick(atom.id); }}
                    className="cursor-pointer"
                  >
                    {/* Selection ring */}
                    {isSelected && (
                      <circle cx={atom.x} cy={atom.y} r={ATOM_RADIUS + 5}
                        fill="none" stroke="#06b6d4" strokeWidth="2" strokeDasharray="4 2" />
                    )}
                    {/* Compatible-bond glow */}
                    {canBond && (
                      <circle cx={atom.x} cy={atom.y} r={ATOM_RADIUS + 5}
                        fill="none" stroke="#22c55e" strokeWidth="1.5" opacity="0.6" />
                    )}

                    {/* Valence dots */}
                    {renderValenceDots(atom)}

                    {/* Atom circle */}
                    <circle cx={atom.x} cy={atom.y} r={ATOM_RADIUS}
                      fill={elData.color} opacity={0.85}
                      stroke={isSelected ? '#06b6d4' : 'rgba(255,255,255,0.2)'}
                      strokeWidth={isSelected ? 2 : 1}
                    />
                    {/* Symbol */}
                    <text x={atom.x} y={atom.y + 1} textAnchor="middle" dominantBaseline="central"
                      fill="white" fontSize="14" fontWeight="bold" fontFamily="monospace"
                      className="pointer-events-none select-none"
                    >
                      {elData.symbol}
                    </text>

                    {/* Valence satisfaction dot */}
                    {showOptions.showValenceSatisfaction && (
                      <circle cx={atom.x + ATOM_RADIUS - 3} cy={atom.y - ATOM_RADIUS + 3} r={4}
                        fill={available === 0 ? '#22c55e' : '#ef4444'} opacity={0.8} />
                    )}

                    {/* Remove button on selected atom */}
                    {isSelected && (
                      <g onClick={(e) => { e.stopPropagation(); removeAtom(atom.id); }}
                        className="cursor-pointer"
                      >
                        <circle cx={atom.x + ATOM_RADIUS} cy={atom.y - ATOM_RADIUS} r={8}
                          fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
                        <text x={atom.x + ATOM_RADIUS} y={atom.y - ATOM_RADIUS + 1}
                          textAnchor="middle" dominantBaseline="central"
                          fill="white" fontSize="10" fontWeight="bold"
                          className="pointer-events-none"
                        >
                          ✕
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Empty state */}
              {placedAtoms.length === 0 && (
                <text x={250} y={175} textAnchor="middle" fill="rgba(148,163,184,0.4)" fontSize="14">
                  Click an element below to start building
                </text>
              )}
            </svg>
          </div>

          {/* Info Panel */}
          <div className="space-y-3">
            {/* Formula display */}
            {showOptions.showFormula && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Molecular Formula</p>
                <p className="text-xl font-mono font-bold text-slate-100">{formula || '—'}</p>
              </div>
            )}

            {/* Target molecule info */}
            {showOptions.showName && targetMolecule.name && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Target Molecule</p>
                <p className="text-lg text-slate-200 font-semibold">{targetMolecule.name}</p>
                {targetMolecule.formula && (
                  <p className="text-sm text-cyan-300 font-mono">{targetMolecule.formula}</p>
                )}
                {targetMolecule.realWorldUse && (
                  <p className="text-xs text-slate-400 mt-1">{targetMolecule.realWorldUse}</p>
                )}
              </div>
            )}

            {/* Bond type badges */}
            {showOptions.showBondType && bonds.length > 0 && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Bonds</p>
                <div className="flex gap-2 flex-wrap">
                  {bonds.map(b => {
                    const ba1 = placedAtoms.find(a => a.id === b.atom1Id);
                    const ba2 = placedAtoms.find(a => a.id === b.atom2Id);
                    return (
                      <Badge key={b.id} className="bg-slate-800/60 border-slate-700/50 text-slate-300 text-xs">
                        {ba1?.element}—{ba2?.element} ({b.type})
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Atom counts */}
            <div className="bg-black/20 rounded-xl border border-white/5 p-3">
              <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Atoms Placed</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(
                  placedAtoms.reduce<Record<string, number>>((acc, a) => {
                    acc[a.element] = (acc[a.element] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([el, count]) => (
                  <Badge key={el} className="text-xs font-mono"
                    style={{
                      backgroundColor: (ELEMENTS[el]?.color || '#64748b') + '22',
                      color: ELEMENTS[el]?.color || '#94a3b8',
                      borderColor: (ELEMENTS[el]?.color || '#64748b') + '44',
                    }}
                  >
                    {el}: {count}
                  </Badge>
                ))}
                {placedAtoms.length === 0 && (
                  <span className="text-xs text-slate-500">None yet</span>
                )}
              </div>
            </div>

            {/* Identify challenge input */}
            {currentChallenge?.type === 'identify' && !hasSubmitted && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Name This Molecule</p>
                <input type="text" value={identifyInput}
                  onChange={e => setIdentifyInput(e.target.value)}
                  placeholder="e.g., Water"
                  className="w-full bg-slate-800/60 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            )}

            {/* Formula write challenge input */}
            {currentChallenge?.type === 'formula_write' && !hasSubmitted && (
              <div className="bg-black/20 rounded-xl border border-white/5 p-3">
                <p className="text-[10px] text-slate-500 font-mono uppercase mb-1">Write the Formula</p>
                <input type="text" value={formulaInput}
                  onChange={e => setFormulaInput(e.target.value)}
                  placeholder="e.g., H2O"
                  className="w-full bg-slate-800/60 border border-white/10 rounded px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            )}
          </div>
        </div>

        {/* Atom Palette */}
        <div className="bg-black/20 rounded-xl border border-white/5 p-3">
          <p className="text-[10px] text-slate-500 font-mono uppercase mb-2 text-center">Element Palette</p>
          <div className="flex gap-2 justify-center flex-wrap">
            {palette.availableElements.map(el => {
              const elData = ELEMENTS[el];
              if (!elData) return null;
              return (
                <Button key={el} variant="ghost"
                  className="h-12 w-12 p-0 rounded-full border-2 hover:scale-110 transition-transform flex flex-col items-center justify-center gap-0"
                  style={{
                    backgroundColor: elData.color + '22',
                    borderColor: elData.color + '66',
                    color: elData.color,
                  }}
                  onClick={() => addAtom(el)}
                  disabled={hasSubmitted || placedAtoms.length >= ATOM_POSITIONS.length}
                >
                  <span className="text-sm font-bold font-mono leading-none">{elData.symbol}</span>
                  {palette.showValence && (
                    <span className="text-[8px] opacity-60 leading-none">{elData.valence}b</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Molecule Gallery */}
        {moleculeGallery.length > 0 && (
          <div className="bg-black/20 rounded-xl border border-white/5 p-3">
            <p className="text-[10px] text-slate-500 font-mono uppercase mb-2">Molecule Gallery</p>
            <div className="flex gap-2 flex-wrap">
              {moleculeGallery.map(mol => {
                const isUnlocked = unlockedMolecules.has(mol.formula);
                return (
                  <div key={mol.formula}
                    className={`px-2 py-1 rounded-lg border text-xs ${
                      isUnlocked
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/30 border-slate-700/30 text-slate-500'
                    }`}
                  >
                    <span className="font-mono font-bold">{mol.formula}</span>
                    <span className="ml-1">{isUnlocked ? mol.name : '???'}</span>
                    {isUnlocked && mol.category && (
                      <span className="ml-1 text-[9px] opacity-70"
                        style={{ color: CATEGORY_COLORS[mol.category] || '#94a3b8' }}>
                        • {mol.category}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
            <Button variant="ghost"
              className="bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300"
              onClick={checkChallenge}
            >
              Check Answer
            </Button>
          )}
          <Button variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            onClick={hasSubmitted ? handleReset : clearWorkspace}
          >
            {hasSubmitted ? 'Try Again' : 'Clear All'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MoleculeConstructor;
