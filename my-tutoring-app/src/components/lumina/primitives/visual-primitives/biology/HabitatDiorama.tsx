'use client';

/**
 * Habitat Diorama — Living Ecosystem.
 *
 * Exploration remains available, ungraded, when no valid challenges exist. Challenges run only
 * on the shared tutor/JEV teaching workspace (workspace rollout C5; the scripted runner was
 * retired, LA-14, user ruling 09-23: one path): Observe, Predict, and Defend are spoken and the
 * observer judges them; Connect and Restore are model-building taps the activity checks. Build a
 * habitat (`build_habitat`, the open build, `habitatBuild.ts`) starts on an empty scene: the learner
 * puts in pieces for a named animal and the activity checks the habitat at "I'm done!". The
 * runtime owns progression. An unbound mount shows the shared "needs the tutor" card.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Leaf, Link2, Sprout, Waves, Zap } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HabitatDioramaMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { SoundManager } from '../../../utils/SoundManager';
import {
  LuminaBadge,
  LuminaButton,
  LuminaCard,
  LuminaCardContent,
  LuminaCardDescription,
  LuminaCardHeader,
  LuminaCardTitle,
  LuminaChallengeCounter,
  LuminaModeTabs,
  LuminaPanel,
  LuminaProgress,
  LuminaPrompt,
  LuminaReadAloud,
  LuminaScoreRing,
  accentBorder,
  accentGlow,
  answerStateClasses,
  dropZoneStateClasses,
  motion,
} from '../../../ui';
import { useStimulusPipSurface } from '../../../pip/useStimulusPipSurface';
import {
  askFor,
  itemsFromChallenges,
  revealTextFor,
  type HabitatItem,
} from './habitatDioramaScript';
import {
  FEWER_NEEDS_LEVER, HABITAT_WATCH_NEVER_SAY, NEEDS_LIST_LEVER, NEED_WORDS, PIECE_TAGS_LEVER,
  animalById, describeHabitatBuild, habitatSceneNote, habitatBuildLeverFacts, habitatBuildLevers, pieceById,
  readHabitatBuild, roomFor, type HabitatBuildMiss, type HabitatNeed,
} from './habitatBuild';
import { HabitatBuildScene } from './HabitatBuildScene';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import { ZONE_LABELS, describeHabitatMove, fewerNeedsItem, habitatAssignment, habitatMiss, habitatMoveMatches, habitatScene } from './habitatDioramaWorkspace';

export type HabitatChallengeType = 'observe' | 'connect' | 'predict' | 'restore' | 'defend' | 'build_habitat';
export type HabitatZone = 'canopy' | 'open-land' | 'water' | 'shoreline' | 'ground' | 'underground';

export interface Organism {
  id: string;
  commonName: string;
  role: 'producer' | 'primary-consumer' | 'secondary-consumer' | 'tertiary-consumer' | 'decomposer';
  imagePrompt: string;
  position: { x: string | number; y: string | number };
  description: string;
  adaptations: string[];
}

export interface Relationship {
  fromId: string;
  toId: string;
  type: 'predation' | 'symbiosis-mutualism' | 'symbiosis-commensalism' | 'symbiosis-parasitism' | 'competition';
  description: string;
}

export interface EnvironmentalFeature {
  id: string;
  name: string;
  description: string;
  position: { x: string | number; y: string | number };
}

export interface DisruptionScenario {
  event: string;
  cascadeEffects: string[];
  question: string;
}

export interface HabitatEvidenceChoice { id: string; text: string }

export interface HabitatChallenge {
  id: string;
  type: HabitatChallengeType;
  prompt: string;
  explanation: string;
  focusOrganismId?: string;
  optionOrganismIds?: string[];
  fromId?: string;
  toId?: string;
  disruptionEvent?: string;
  affectedOrganismId?: string;
  expectedTrend?: 'increase' | 'decrease' | 'stay-similar';
  restorationEntityId?: string;
  restorationZone?: HabitatZone;
  evidenceChoices?: HabitatEvidenceChoice[];
  correctEvidenceId?: string;
  /** build_habitat (open build), all code-owned (`habitatBuild.ts`): the animal, the needs asked, the pieces offered. */
  targetAnimal?: string;
  needs?: HabitatNeed[];
  trayPieces?: string[];
}

export interface HabitatDioramaData {
  primitiveType: 'habitat-diorama';
  habitat: { name: string; biome: string; climate: string; description: string };
  organisms: Organism[];
  relationships: Relationship[];
  environmentalFeatures: EnvironmentalFeature[];
  disruptionScenario?: DisruptionScenario;
  gradeBand: 'K-2' | '3-5' | '6-8';
  challengeType?: HabitatChallengeType;
  challengeTypes?: HabitatChallengeType[];
  challenges?: HabitatChallenge[];
  supportTier?: 'easy' | 'medium' | 'hard';
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<HabitatDioramaMetrics>) => void;
}

export interface HabitatDioramaProps {
  data: HabitatDioramaData;
  instanceId?: string;
  skillId?: string;
  exhibitId?: string;
  className?: string;
  runtimePlanItemId?: string;
  /** The RESOLVED plan mode, kept exactly as mounted. */
  runtimeEvalMode?: string;
  onInteraction?: (interaction: {
    type: string;
    organismId?: string;
    featureId?: string;
    relationshipType?: string;
    timestamp: number;
  }) => void;
}

const MODE_TABS = [
  { value: 'observe', label: 'Observe' }, { value: 'connect', label: 'Connect' },
  { value: 'predict', label: 'Predict' }, { value: 'restore', label: 'Restore' },
  { value: 'defend', label: 'Defend' }, { value: 'build_habitat', label: 'Build' },
];

/** The build verdict's words: never the missing need or the piece to add. */
const buildVerdictText = (animalName: string, miss: HabitatBuildMiss | undefined): string =>
  !miss ? `Yes! The ${animalName} can live here.`
    : miss === 'harmful_piece' ? `Not yet. Something in this habitat would hurt the ${animalName}. Look at each piece again.`
      : `Not yet. The ${animalName} could not live here. Think about what it needs every day.`;


const ROLE_LABELS: Record<Organism['role'], string> = {
  producer: 'Producer', 'primary-consumer': 'Primary Consumer',
  'secondary-consumer': 'Secondary Consumer', 'tertiary-consumer': 'Tertiary Consumer',
  decomposer: 'Decomposer',
};

const roleAccent = (role: Organism['role']): 'emerald' | 'amber' | 'orange' | 'rose' | 'purple' => ({
  producer: 'emerald', 'primary-consumer': 'amber', 'secondary-consumer': 'orange',
  'tertiary-consumer': 'rose', decomposer: 'purple',
} as const)[role];

const organismEmoji = (organism: Organism): string => {
  const name = `${organism.commonName} ${organism.imagePrompt}`.toLowerCase();
  if (organism.role === 'producer' || /tree|plant|grass|flower|algae/.test(name)) return '🌿';
  if (organism.role === 'decomposer' || /fung|mushroom|worm|bacter/.test(name)) return '🍄';
  if (/fish|shark|salmon|trout/.test(name)) return '🐟';
  if (/bird|owl|eagle|robin|raven/.test(name)) return '🦉';
  if (/bee|insect|butterfly|ant/.test(name)) return '🐝';
  if (/frog|toad/.test(name)) return '🐸';
  if (/bear/.test(name)) return '🐻';
  if (/wolf|fox|coyote/.test(name)) return '🦊';
  if (/deer|elk|antelope/.test(name)) return '🦌';
  if (/rabbit|hare/.test(name)) return '🐇';
  return organism.role === 'tertiary-consumer' ? '🦁' : '🐾';
};

const featureEmoji = (feature: EnvironmentalFeature): string => {
  const name = feature.name.toLowerCase();
  if (/water|stream|river|pond|ocean/.test(name)) return '💧';
  if (/sun|light/.test(name)) return '☀️';
  if (/rock|cliff|outcrop/.test(name)) return '🪨';
  if (/soil|ground/.test(name)) return '🟫';
  return '✨';
};

const pct = (value: string | number): string => typeof value === 'number' ? `${value}%` : value;

interface SceneProps {
  data: HabitatDioramaData;
  isPreReader: boolean;
  selectedId?: string | null;
  activeIds?: string[];
  rewardIds?: string[];
  showRelationships?: boolean;
  hideOrganismId?: string;
  onOrganismTap: (id: string) => void;
  onFeatureTap?: (id: string) => void;
}

const HabitatScene: React.FC<SceneProps> = ({
  data, isPreReader, selectedId, activeIds = [], rewardIds = [],
  showRelationships = false, hideOrganismId, onOrganismTap, onFeatureTap,
}) => (
  <div className="relative min-h-[430px] overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-b from-cyan-950/70 via-emerald-950/65 to-amber-950/50 shadow-inner" aria-label={`${data.habitat.name} living ecosystem`}>
    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/10 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-emerald-950/90 to-transparent" />
    <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-amber-300/15 blur-xl" />
    <div className="absolute bottom-8 right-8 h-24 w-56 rounded-full bg-cyan-400/10 blur-2xl" />
    {showRelationships && (
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true">
        <defs><marker id="habitat-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgb(34 211 238 / .7)" /></marker></defs>
        {data.relationships.map((relationship) => {
          const from = data.organisms.find((organism) => organism.id === relationship.fromId);
          const to = data.organisms.find((organism) => organism.id === relationship.toId);
          if (!from || !to) return null;
          return <line key={`${relationship.fromId}-${relationship.toId}-${relationship.type}`} x1={pct(from.position.x)} y1={pct(from.position.y)} x2={pct(to.position.x)} y2={pct(to.position.y)} stroke="rgb(34 211 238 / .65)" strokeWidth="2" strokeDasharray={relationship.type.startsWith('symbiosis') ? '5 5' : undefined} markerEnd="url(#habitat-arrow)" />;
        })}
      </svg>
    )}
    {data.environmentalFeatures.map((feature) => (
      <button key={feature.id} type="button" aria-label={feature.name} onClick={() => onFeatureTap?.(feature.id)} className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-black/20 p-2 text-2xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" style={{ left: pct(feature.position.x), top: pct(feature.position.y) }}>
        {featureEmoji(feature)}
      </button>
    ))}
    {data.organisms.filter((organism) => organism.id !== hideOrganismId).map((organism) => {
      const active = activeIds.includes(organism.id);
      const rewarded = rewardIds.includes(organism.id);
      const selected = selectedId === organism.id;
      return (
        <button key={organism.id} type="button" aria-label={organism.commonName} onClick={() => onOrganismTap(organism.id)} className={`group absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${rewarded ? `border-emerald-300 bg-emerald-400/25 scale-110 ${motion.pop}` : active ? 'border-cyan-300 bg-cyan-400/20 scale-105 shadow-[0_0_24px_rgba(34,211,238,.35)]' : selected ? 'border-amber-300 bg-amber-400/20 scale-105' : 'border-white/15 bg-slate-950/55 hover:bg-slate-900/75 hover:scale-105'}`} style={{ left: pct(organism.position.x), top: pct(organism.position.y) }}>
          <span className="block text-3xl" aria-hidden="true">{organismEmoji(organism)}</span>
          <span className="mt-1 block max-w-24 truncate text-[10px] font-semibold text-slate-100">{organism.commonName}</span>
          {!isPreReader && selected && <span className="mt-1 block text-[9px] uppercase tracking-wide text-slate-400">{ROLE_LABELS[organism.role]}</span>}
        </button>
      );
    })}
    <div className="pointer-events-none absolute bottom-3 left-4 z-30 text-[10px] uppercase tracking-[0.22em] text-emerald-200/60">living model · tap to inspect</div>
  </div>
);

interface ExploreFaceProps { data: HabitatDioramaData; resolvedInstanceId: string; onInteraction?: HabitatDioramaProps['onInteraction'] }

const ExploreFace: React.FC<ExploreFaceProps> = ({ data, resolvedInstanceId, onInteraction }) => {
  const [selectedOrganism, setSelectedOrganism] = useState<string | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showRelationships, setShowRelationships] = useState(false);
  const isPreReader = data.gradeBand === 'K-2';
  const selected = data.organisms.find((organism) => organism.id === selectedOrganism) ?? null;
  const feature = data.environmentalFeatures.find((item) => item.id === selectedFeature) ?? null;
  const aiPrimitiveData = useMemo(() => ({
    challengeType: 'free_explore',
    stimulus: `Explore the ${data.habitat.name} habitat by tapping its living things and features.`,
    habitatName: data.habitat.name, organismNames: data.organisms.map((organism) => organism.commonName).join(', '),
    organismCount: data.organisms.length, selectedOrganismName: selected?.commonName ?? 'nothing yet',
    selectedOrganismRole: selected?.role ?? 'none', relationshipMode: showRelationships ? 'shown' : 'hidden', gradeBand: data.gradeBand,
  }), [data, selected, showRelationships]);
  const { sendText, isAudioPlaying } = useLuminaAI({ primitiveType: 'habitat-diorama', instanceId: resolvedInstanceId, primitiveData: aiPrimitiveData, gradeLevel: isPreReader ? 'kindergarten' : 'elementary' });
  const orientedRef = useRef(false);
  useEffect(() => {
    if (orientedRef.current) return;
    orientedRef.current = true;
    sendText(`[HABITAT_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened a ${data.habitat.name} scene with these living things: ${data.organisms.map((organism) => organism.commonName).join(', ')}. They tap an animal or plant to find out about it. Tell them what to do in child words.${isPreReader ? ' NEVER use the words producer, consumer, decomposer, herbivore or carnivore with them.' : ''}`, { silent: true });
  }, [data, isPreReader, sendText]);
  const handleOrganismTap = (id: string) => {
    SoundManager.tap();
    const organism = data.organisms.find((item) => item.id === id);
    const opening = id !== selectedOrganism;
    setSelectedOrganism(opening ? id : null); setSelectedFeature(null);
    if (organism && opening) sendText(`[HABITAT_ORGANISM_SELECTED] The student tapped ${organism.commonName}. Say its name and ONE short child-sized thing about it — what it eats or where it lives. No question, no extra fact.${isPreReader ? ' Never say producer, consumer, decomposer, herbivore or carnivore.' : ''}`, { silent: true });
    onInteraction?.({ type: 'organism_viewed', organismId: id, timestamp: Date.now() });
  };
  const readAloud = (text: string) => {
    SoundManager.tap();
    sendText(`[HABITAT_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`, { silent: true });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><LuminaButton onClick={() => setShowRelationships((shown) => !shown)}><Link2 className="mr-2 h-4 w-4" />{showRelationships ? 'Hide connections' : 'Reveal connections'}</LuminaButton><LuminaBadge accent="emerald">Explore freely</LuminaBadge></div>
      <HabitatScene data={data} isPreReader={isPreReader} selectedId={selectedOrganism} showRelationships={showRelationships} onOrganismTap={handleOrganismTap} onFeatureTap={(id) => { SoundManager.tap(); setSelectedFeature(id); setSelectedOrganism(null); onInteraction?.({ type: 'feature_viewed', featureId: id, timestamp: Date.now() }); }} />
      {selected && (
        <LuminaPanel accent={roleAccent(selected.role)}>
          <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-bold text-slate-100">{selected.commonName}</h4>{!isPreReader && <LuminaBadge accent={roleAccent(selected.role)}>{ROLE_LABELS[selected.role]}</LuminaBadge>}</div><p className="mt-2 text-sm leading-relaxed text-slate-300">{selected.description}</p></div><LuminaReadAloud iconOnly size={isPreReader ? 'lg' : 'sm'} accent="cyan" speaking={isAudioPlaying} aria-label={`Tell me about the ${selected.commonName}`} onClick={() => readAloud(`${selected.commonName}. ${selected.description}`)} /></div>
          {selected.adaptations.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Adaptations:</p><ul className="mt-2 space-y-1 text-sm text-slate-300">{selected.adaptations.map((adaptation) => <li key={adaptation}>• {adaptation}</li>)}</ul></div>}
          {!isPreReader && <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Relationships:</p><ul className="mt-2 space-y-1 text-sm text-slate-300">{data.relationships.filter((relationship) => relationship.fromId === selected.id || relationship.toId === selected.id).map((relationship) => <li key={`${relationship.fromId}-${relationship.toId}`}>• {relationship.description}</li>)}</ul></div>}
        </LuminaPanel>
      )}
      {feature && <LuminaPanel accent="cyan"><h4 className="font-bold text-slate-100">{feature.name}</h4><p className="mt-1 text-sm text-slate-300">{feature.description}</p></LuminaPanel>}
      {!isPreReader && <LuminaPanel><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Organism Roles:</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{(Object.keys(ROLE_LABELS) as Organism['role'][]).map((role) => <div key={role}><LuminaBadge accent={roleAccent(role)}>{ROLE_LABELS[role]}</LuminaBadge><p className="mt-1 text-xs text-slate-400">{{ producer: 'Makes own food', 'primary-consumer': 'Eats producers', 'secondary-consumer': 'Eats primary consumers', 'tertiary-consumer': 'Top predator', decomposer: 'Breaks down dead matter' }[role]}</p></div>)}</div></LuminaPanel>}
    </div>
  );
};

interface JudgedFaceProps { data: HabitatDioramaData; items: HabitatItem[]; resolvedInstanceId: string; skillId?: string; exhibitId?: string; runtimePlanItemId?: string; runtimeEvalMode?: string; onInteraction?: HabitatDioramaProps['onInteraction'] }

const JudgedFace: React.FC<JudgedFaceProps> = ({ data, items, resolvedInstanceId, skillId, exhibitId, runtimePlanItemId, onInteraction }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reward, setReward] = useState<{ text: string; ids: string[] } | null>(null);
  // build_habitat (open build): the pieces put in, in order; the easier ask while a simplify lever holds it; the levers
  // pulled on a session item; and the last check's words, kept until the next check.
  const [placed, setPlaced] = useState<string[]>([]);
  const [practice, setPractice] = useState<HabitatItem | null>(null);
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [buildVerdict, setBuildVerdict] = useState<{ correct: boolean; text: string } | null>(null);
  const buildSvgRef = useRef<SVGSVGElement | null>(null);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const isPreReader = data.gradeBand === 'K-2';
  const evaluation = usePrimitiveEvaluation<HabitatDioramaMetrics>({ primitiveType: 'habitat-diorama', instanceId: resolvedInstanceId, skillId: data.skillId ?? skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId ?? exhibitId, onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined });
  const finish = (summary: TeachingEvaluationResult) => {
    const modeCounts = items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] ?? 0) + 1 }), {});
    const dominantMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    evaluation.submitResult(summary.passed, summary.accuracy, { type: 'habitat-diorama', evalMode: dominantMode, totalChallenges: items.length, correctChallenges: summary.solvedCount, totalAttempts: summary.attemptsCount, accuracy: summary.accuracy, spokenChallenges: items.filter((item) => item.answerKind === 'voice').length, modelChallenges: items.filter((item) => item.answerKind === 'gesture').length, durationMs: evaluation.elapsedMs }, { challengeResults: summary.outcomes, learningResponses: summary.learningResponses, teachingAttempts: summary.teachingAttempts, assistanceProvenance: summary.assistanceProvenance }, undefined, summary.diagnosisEvidence);
  };
  const runner = useWorkspaceRunner<HabitatItem>({
    primitiveId: 'habitat-diorama', assignment: habitatAssignment, items, workspace, objectiveId: data.objectiveId,
    planItemId: runtimePlanItemId,
    // The SESSION's mode, from the mount: a mount's identity must not change while the workspace owns it.
    instanceId: resolvedInstanceId, onFinished: finish,
    // A new item opens an empty habitat; Try again keeps the build (and the verdict's words) so the learner revises it.
    onItemOpened: () => { setSelectedId(null); setReward(null); setPlaced([]); setPractice(null); setBuildVerdict(null); },
    onCorrectionRetry: () => setSelectedId(null),
    onAffirmed: (item) => { const ids = item.kind === 'connect' ? [item.fromId, item.toId].filter(Boolean) as string[] : [item.focusOrganismId ?? item.restorationEntityId].filter(Boolean) as string[]; setReward({ text: revealTextFor(item), ids }); },
  });
  const sessionItem = runner.currentItem;
  /** What is on screen: the easier ask while a simplify lever holds it, else the session item. */
  const current = practice ?? sessionItem;
  const showSummary = evaluation.hasSubmitted || !!runner.practiceSummary;
  const animal = current?.kind === 'build_habitat' ? animalById(current.animalId) ?? null : null;
  const pulled = leverState.item === sessionItem?.id ? leverState.pulled : [];
  const buildOpen = !!animal && runner.canAttempt && !showSummary;
  // The live line (shared build layer): what the habitat looks like so far. It never names a need or how the animal
  // would fare: that would do the task.
  const buildSeeing = useBuildWatcher({
    buildKey: placed.join('|'),
    enabled: buildOpen && placed.length > 0,
    svg: buildSvgRef,
    request: { task: current && animal ? askFor(current) : '',
      sceneNote: animal ? habitatSceneNote(animal) : '',
      numbers: 'allowed', neverSay: HABITAT_WATCH_NEVER_SAY },
  });
  // What the tutor and the observer are shown, republished every render. W1 offers no
  // demonstration targets and no presentation; every item is answerable once it opens.
  useLayoutEffect(() => {
    if (!current) return;
    const scene = habitatScene(current, { habitatName: data.habitat.name, organismNames: data.organisms.map((organism) => organism.commonName), preReader: isPreReader, placed });
    if (current.kind !== 'build_habitat' || !sessionItem) { workspace.current = { ...scene }; return; }
    const levers = habitatBuildLevers(sessionItem.needs ?? null, pulled, !!practice);
    const onScreen = habitatBuildLeverFacts(practice ? [] : pulled);
    workspace.current = {
      ...scene,
      facts: { ...scene.facts, ...(onScreen ? { onScreen } : {}),
        ...(practice ? { practice: 'An easier habitat, ungraded. The full habitat comes back after it.' } : {}) },
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (id === FEWER_NEEDS_LEVER) {
          const easier = fewerNeedsItem(sessionItem);
          if (!easier) return 'There is no easier habitat for this item.';
          setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
          setPractice(easier); setPlaced([]); setBuildVerdict(null);
          return { practice: habitatAssignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
        return true;
      },
      endPractice: () => { setPractice(null); setPlaced([]); setBuildVerdict(null); },
    };
  });
  const activeIds = current?.kind === 'connect' && current.fromId ? [current.fromId] : current?.optionOrganismIds ?? [];
  const rewardIds = runner.revealHeld && reward ? reward.ids : [];
  const commitMove = (item: HabitatItem, move: { toId?: string; zone?: HabitatZone }) =>
    commitGesture(runner, { response: describeHabitatMove(item, move), correct: habitatMoveMatches(item, move), cue: () => '',
      miss: habitatMiss(item, move, data.relationships ?? []) });
  const handleOrganismTap = (id: string) => {
    SoundManager.tap(); setSelectedId(id); onInteraction?.({ type: 'organism_inspected', organismId: id, timestamp: Date.now() });
    if (!current || !runner.canAttempt || current.kind !== 'connect' || id === current.fromId) return;
    pip.look('stimulus');
    commitMove(current, { toId: id });
    onInteraction?.({ type: 'relationship_committed', organismId: id, relationshipType: current.relationshipType, timestamp: Date.now() });
  };
  // ── Open build: tap a piece to put it in, tap one in the habitat to take it out; "I'm done!" commits ──
  const putIn = (id: string) => {
    if (!buildOpen || runner.isAwaitingGesture() || !roomFor(placed, id)) return;
    SoundManager.tap(); setPlaced((p) => [...p, id]);
  };
  const takeOut = (index: number) => {
    if (!buildOpen || runner.isAwaitingGesture()) return;
    SoundManager.tap(); setPlaced((p) => p.filter((_, i) => i !== index));
  };
  const handleBuildDone = () => {
    if (!current || !animal || !buildOpen || runner.isAwaitingGesture()) return;
    SoundManager.tap(); pip.look('stimulus');
    const read = readHabitatBuild(animal, current.needs ?? [], placed);
    setBuildVerdict({ correct: !read.miss, text: buildVerdictText(animal.name, read.miss) });
    commitGesture(runner, { response: describeHabitatBuild(animal, placed), correct: !read.miss, cue: () => '', miss: read.miss });
    onInteraction?.({ type: 'habitat_built', timestamp: Date.now() });
  };
  // Pip: the habitat is the question side. A connect tap and a restore zone are
  // single committed taps: Pip looks at them and never makes one.
  const pip = useStimulusPipSurface({
    run: runner, instanceId: resolvedInstanceId, label: 'The habitat', finished: showSummary,
    gesture: current?.answerKind === 'gesture',
  });
  if (showSummary) {
    const outcomes = runner.practiceSummary?.outcomes ?? [];
    const score = evaluation.submittedResult?.score ?? runner.teachingResult?.accuracy
      ?? Math.round(outcomes.reduce((sum, outcome) => sum + outcome.score, 0) / Math.max(outcomes.length, 1));
    return <LuminaPanel accent="emerald" className="py-8 text-center"><LuminaScoreRing score={score} size={128} showTier /><h4 className="mt-4 text-xl font-bold text-slate-100">Ecosystem field report complete</h4><p className="mt-2 text-sm text-slate-300">You observed evidence, traced relationships, and reasoned about change.</p></LuminaPanel>;
  }
  return (
    <div className="space-y-4">
      {current && <div className="flex flex-wrap items-center justify-between gap-3"><LuminaModeTabs tabs={MODE_TABS} active={current.kind} accent="emerald" /><LuminaChallengeCounter current={runner.currentIndex + 1} total={items.length} variant="dots" accent="emerald" /></div>}
      <LuminaProgress value={items.length ? ((runner.currentIndex + 1) / items.length) * 100 : 0} accent="emerald" />
      {current && <LuminaPrompt accent={current.answerKind === 'voice' ? 'cyan' : 'emerald'}>{askFor(current)}</LuminaPrompt>}
      {current?.kind === 'predict' && <LuminaPanel accent="orange" className={`${accentGlow.orange} ${accentBorder.orange}`}><div className="flex items-start gap-3"><Zap className="mt-0.5 h-5 w-5 text-orange-300" /><div><p className="text-xs font-semibold uppercase tracking-wider text-orange-300">Ecosystem change</p><p className="mt-1 text-sm text-slate-200">{current.disruptionEvent}</p></div></div></LuminaPanel>}
      {pip.store && <div {...pip.dock} />}
      {animal && current ? (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start lg:justify-center">
            <div {...pip.target('stimulus')} className="w-full max-w-[560px]">
              <HabitatBuildScene ref={buildSvgRef} animal={animal} placed={placed} tags={!practice && pulled.includes(PIECE_TAGS_LEVER)}
                disabled={!buildOpen} onRemove={takeOut} />
            </div>
            {!practice && pulled.includes(NEEDS_LIST_LEVER) && (
              <LuminaPanel accent="cyan" className="w-full max-w-xs" data-lever="needs-list">
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Every animal needs</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">{(sessionItem.needs ?? []).map((need) => <li key={need}>• {NEED_WORDS[need]}</li>)}</ul>
              </LuminaPanel>
            )}
          </div>
          <div className="flex min-h-8 items-center justify-center" aria-live="polite" data-testid="build-watcher">
            {buildSeeing && <span className="rounded-full bg-white/10 px-4 py-1.5 text-base text-amber-100">👀 {buildSeeing}</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-2" aria-label="Pieces to put in">
            {(current.tray ?? []).map((id) => {
              const piece = pieceById(id);
              if (!piece) return null;
              return (
                <LuminaButton key={id} aria-label={`Put in ${piece.name}`} disabled={!buildOpen || !roomFor(placed, id)}
                  onClick={() => putIn(id)} className="min-h-[48px] min-w-[48px] gap-2 text-base">
                  <span className="text-2xl" aria-hidden="true">{piece.emoji}</span>{piece.name}
                </LuminaButton>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <LuminaButton disabled={!buildOpen || placed.length === 0} onClick={() => { SoundManager.tap(); setPlaced([]); }}>Clear the habitat</LuminaButton>
            <LuminaButton tone="primary" disabled={!buildOpen || placed.length === 0} onClick={handleBuildDone}>I&apos;m done!</LuminaButton>
          </div>
          {buildVerdict && !(buildVerdict.correct && reward && runner.revealHeld) && (
            <p className={`text-center text-sm font-semibold ${buildVerdict.correct ? 'text-emerald-300' : 'text-amber-200'}`} data-testid="build-verdict">{buildVerdict.text}</p>
          )}
        </div>
      ) : (
        <div {...pip.target('stimulus')}><HabitatScene data={data} isPreReader={isPreReader} selectedId={selectedId} activeIds={activeIds} rewardIds={rewardIds} hideOrganismId={current?.kind === 'restore' ? current.restorationEntityId : undefined} onOrganismTap={handleOrganismTap} /></div>
      )}
      {current?.kind === 'restore' && current.restorationEntityId && <LuminaPanel {...pip.target('zones')} accent="emerald"><div className="mb-3 flex items-center gap-3"><span className="text-3xl">{organismEmoji(data.organisms.find((organism) => organism.id === current.restorationEntityId)!)}</span><div><p className="text-xs uppercase tracking-wider text-emerald-300">Restoration candidate</p><p className="font-semibold text-slate-100">{current.organismNames[current.restorationEntityId]}</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.keys(ZONE_LABELS) as HabitatZone[]).map((zone) => <button key={zone} type="button" disabled={!runner.canAttempt} onClick={() => { SoundManager.tap(); pip.look('zones'); commitMove(current, { zone }); onInteraction?.({ type: 'restoration_committed', timestamp: Date.now() }); }} className={`rounded-xl px-3 py-4 text-sm font-semibold transition-all ${dropZoneStateClasses.idle} ${runner.canAttempt ? 'hover:scale-[1.02]' : 'opacity-50'}`}>{ZONE_LABELS[zone]}</button>)}</div></LuminaPanel>}
      {current?.kind === 'defend' && current.evidenceChoices && <div className="grid gap-2 md:grid-cols-3" aria-label="Evidence choices">{current.evidenceChoices.map((choice, index) => <div key={choice.id} className={`rounded-xl border p-4 ${answerStateClasses.idle}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Evidence {index + 1}</p><p className="mt-2 text-sm leading-relaxed text-slate-100">{choice.text}</p></div>)}</div>}
      {current?.answerKind === 'voice' && current.kind !== 'defend' && <div className="flex flex-wrap justify-center gap-2" aria-label="Answer choices">{current.optionTexts.map((option) => <LuminaBadge key={option} accent="cyan" className="px-3 py-2 text-sm">{option}</LuminaBadge>)}</div>}
      {reward && runner.revealHeld && <LuminaPanel accent="emerald" className={`${motion.reveal} text-center`}><Sprout className="mx-auto h-6 w-6 text-emerald-300" /><p className="mt-2 font-semibold text-emerald-100">{reward.text}</p></LuminaPanel>}
    </div>
  );
};

type FrameProps = HabitatDioramaProps & { items: HabitatItem[] };

const HabitatDioramaFrame: React.FC<FrameProps> = ({ data, items, instanceId, skillId, exhibitId, className = '', onInteraction, runtimePlanItemId, runtimeEvalMode }) => {
  const stableInstanceId = useRef(data.instanceId ?? instanceId ?? `habitat-diorama-${Math.round(performance.now())}`);
  const resolvedInstanceId = data.instanceId ?? instanceId ?? stableInstanceId.current;
  const isJudged = items.length > 0;
  return (
    <LuminaCard topAccent="emerald" className={`w-full ${className}`}>
      <LuminaCardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2"><Leaf className="h-5 w-5 text-emerald-300" /><LuminaBadge accent="emerald">{isJudged ? 'Living ecosystem mission' : 'Open ecosystem'}</LuminaBadge><LuminaBadge accent="cyan">{data.habitat.biome}</LuminaBadge></div><LuminaCardTitle className="text-2xl">{data.habitat.name}</LuminaCardTitle><LuminaCardDescription className="mt-2 max-w-3xl">{data.habitat.description}</LuminaCardDescription></div>{data.habitat.climate && <div className="flex items-center gap-2 text-xs text-slate-400"><Waves className="h-4 w-4" /> {data.habitat.climate}</div>}</div></LuminaCardHeader>
      <LuminaCardContent>{isJudged ? <JudgedFace data={data} items={items} resolvedInstanceId={resolvedInstanceId} skillId={skillId} exhibitId={exhibitId} runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} onInteraction={onInteraction} /> : <ExploreFace data={data} resolvedInstanceId={resolvedInstanceId} onInteraction={onInteraction} />}</LuminaCardContent>
    </LuminaCard>
  );
};

const HabitatDioramaBound = withWorkspaceOnly<FrameProps>('habitat-diorama', HabitatDioramaFrame, (props) => props.data.habitat?.name);

/**
 * Challenges run only on the teaching workspace (an unbound mount shows the "needs the tutor" card).
 * A payload with no askable challenge is the ungraded free-exploration diorama.
 */
const HabitatDiorama: React.FC<HabitatDioramaProps> = (props) => {
  const { data } = props;
  const built = useMemo(() => itemsFromChallenges(data.challenges ?? [], data), [data]);
  useEffect(() => { if ((data.challenges?.length ?? 0) > 0 && !built.items.length) console.warn(`[HabitatDiorama] all ${data.challenges?.length} generated challenges failed the spoken/build gates; degrading to exploration`); }, [data.challenges, built.items.length]);
  return built.items.length ? <HabitatDioramaBound {...props} items={built.items} /> : <HabitatDioramaFrame {...props} items={[]} />;
};

export default HabitatDiorama;
