'use client';

/**
 * Habitat Diorama — Living Ecosystem.
 *
 * Exploration remains available when no valid challenges exist. In assessment
 * sessions the Live tutor owns the clock: Observe, Predict, and Defend are
 * spoken; Connect and Restore are committed model-building turns.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ear, Leaf, Link2, Sprout, Waves, Zap } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HabitatDioramaMetrics } from '../../../evaluation/types';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import {
  useJudgedScriptRunner,
  type JudgedRunSummary,
} from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptPack } from '../../../hooks/judgedScriptContract';
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
import JudgedMicPanel from '../../../components/JudgedMicPanel';
import {
  askFor,
  gestureVerdictCue,
  habitatDioramaPackBase,
  itemsFromChallenges,
  revealTextFor,
  type HabitatItem,
} from './habitatDioramaScript';

export type HabitatChallengeType = 'observe' | 'connect' | 'predict' | 'restore' | 'defend';
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
  { value: 'defend', label: 'Defend' },
];

const ZONE_LABELS: Record<HabitatZone, string> = {
  canopy: 'Canopy', 'open-land': 'Open land', water: 'Open water',
  shoreline: 'Shoreline', ground: 'Ground layer', underground: 'Underground',
};

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

interface JudgedFaceProps { data: HabitatDioramaData; items: HabitatItem[]; resolvedInstanceId: string; skillId?: string; exhibitId?: string; onInteraction?: HabitatDioramaProps['onInteraction'] }

const JudgedFace: React.FC<JudgedFaceProps> = ({ data, items, resolvedInstanceId, skillId, exhibitId, onInteraction }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reward, setReward] = useState<{ text: string; ids: string[] } | null>(null);
  const isPreReader = data.gradeBand === 'K-2';
  const evaluation = usePrimitiveEvaluation<HabitatDioramaMetrics>({ primitiveType: 'habitat-diorama', instanceId: resolvedInstanceId, skillId: data.skillId ?? skillId, subskillId: data.subskillId, objectiveId: data.objectiveId, exhibitId: data.exhibitId ?? exhibitId, onSubmit: data.onEvaluationSubmit as ((result: PrimitiveEvaluationResult) => void) | undefined });
  const pack = useMemo<JudgedScriptPack<HabitatItem>>(() => ({
    ...habitatDioramaPackBase(items), passThreshold: 70,
    statusLines: { ready: (item) => item.answerKind === 'voice' ? 'Listen, study the ecosystem, then say your answer.' : 'Listen, then show your thinking on the ecosystem.', retry: (item) => item.answerKind === 'voice' ? 'Try once more — say the evidence or living thing.' : 'Try once more on the habitat model.', done: 'The ecosystem is still alive — and now you can read its story.' },
    diagnosisObservation: (item, { lastHeard }) => ({ challenge: `${item.kind}: ${askFor(item)}`, expected: item.answerText, observed: item.answerKind === 'voice' ? (lastHeard ? `Heard "${lastHeard}".` : 'The tutor judged the spoken choice wrong.') : 'The committed ecosystem model did not match the relationship key.' }),
  }), [items]);
  const handleFinished = useCallback((summary: JudgedRunSummary) => {
    const modeCounts = items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] ?? 0) + 1 }), {});
    const dominantMode = Object.entries(modeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    evaluation.submitResult(summary.passed, summary.accuracy, { type: 'habitat-diorama', evalMode: dominantMode, totalChallenges: items.length, correctChallenges: summary.solvedCount, totalAttempts: summary.attemptsCount, accuracy: summary.accuracy, spokenChallenges: items.filter((item) => item.answerKind === 'voice').length, modelChallenges: items.filter((item) => item.answerKind === 'gesture').length, durationMs: evaluation.elapsedMs }, { challengeResults: summary.outcomes }, undefined, summary.diagnosisEvidence);
  }, [evaluation, items]);
  const runner = useJudgedScriptRunner<HabitatItem>({
    pack, instanceId: resolvedInstanceId, gradeLevel: data.gradeBand, exhibitId: data.exhibitId ?? exhibitId, onFinished: handleFinished,
    onItemOpened: () => setSelectedId(null), onCorrectionRetry: () => setSelectedId(null),
    onAffirmed: (item) => { const ids = item.kind === 'connect' ? [item.fromId, item.toId].filter(Boolean) as string[] : [item.focusOrganismId ?? item.restorationEntityId].filter(Boolean) as string[]; setReward({ text: revealTextFor(item), ids }); },
  });
  const current = runner.currentItem;
  const activeIds = current?.kind === 'connect' && current.fromId ? [current.fromId] : current?.optionOrganismIds ?? [];
  const rewardIds = runner.revealHeld && reward ? reward.ids : [];
  const handleOrganismTap = (id: string) => {
    SoundManager.tap(); setSelectedId(id); onInteraction?.({ type: 'organism_inspected', organismId: id, timestamp: Date.now() });
    if (!current || !runner.canAttempt || current.kind !== 'connect' || id === current.fromId) return;
    runner.submitGestureAttempt(gestureVerdictCue(current, { fromId: current.fromId, toId: id }));
    onInteraction?.({ type: 'relationship_committed', organismId: id, relationshipType: current.relationshipType, timestamp: Date.now() });
  };
  if (evaluation.hasSubmitted && runner.summary) return <LuminaPanel accent="emerald" className="py-8 text-center"><LuminaScoreRing score={runner.summary.accuracy} size={128} showTier /><h4 className="mt-4 text-xl font-bold text-slate-100">Ecosystem field report complete</h4><p className="mt-2 text-sm text-slate-300">You observed evidence, traced relationships, and reasoned about change.</p></LuminaPanel>;
  return (
    <div className="space-y-4">
      {current && <div className="flex flex-wrap items-center justify-between gap-3"><LuminaModeTabs tabs={MODE_TABS} active={current.kind} accent="emerald" /><LuminaChallengeCounter current={runner.currentIndex + 1} total={items.length} variant="dots" accent="emerald" /></div>}
      <LuminaProgress value={items.length ? ((runner.currentIndex + 1) / items.length) * 100 : 0} accent="emerald" />
      {current && <LuminaPrompt accent={current.answerKind === 'voice' ? 'cyan' : 'emerald'}>{askFor(current)}</LuminaPrompt>}
      {current?.kind === 'predict' && <LuminaPanel accent="orange" className={`${accentGlow.orange} ${accentBorder.orange}`}><div className="flex items-start gap-3"><Zap className="mt-0.5 h-5 w-5 text-orange-300" /><div><p className="text-xs font-semibold uppercase tracking-wider text-orange-300">Ecosystem change</p><p className="mt-1 text-sm text-slate-200">{current.disruptionEvent}</p></div></div></LuminaPanel>}
      <HabitatScene data={data} isPreReader={isPreReader} selectedId={selectedId} activeIds={activeIds} rewardIds={rewardIds} hideOrganismId={current?.kind === 'restore' ? current.restorationEntityId : undefined} onOrganismTap={handleOrganismTap} />
      {current?.kind === 'restore' && current.restorationEntityId && <LuminaPanel accent="emerald"><div className="mb-3 flex items-center gap-3"><span className="text-3xl">{organismEmoji(data.organisms.find((organism) => organism.id === current.restorationEntityId)!)}</span><div><p className="text-xs uppercase tracking-wider text-emerald-300">Restoration candidate</p><p className="font-semibold text-slate-100">{current.organismNames[current.restorationEntityId]}</p></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.keys(ZONE_LABELS) as HabitatZone[]).map((zone) => <button key={zone} type="button" disabled={!runner.canAttempt} onClick={() => { SoundManager.tap(); runner.submitGestureAttempt(gestureVerdictCue(current, { zone })); onInteraction?.({ type: 'restoration_committed', timestamp: Date.now() }); }} className={`rounded-xl px-3 py-4 text-sm font-semibold transition-all ${dropZoneStateClasses.idle} ${runner.canAttempt ? 'hover:scale-[1.02]' : 'opacity-50'}`}>{ZONE_LABELS[zone]}</button>)}</div></LuminaPanel>}
      {current?.kind === 'defend' && current.evidenceChoices && <div className="grid gap-2 md:grid-cols-3" aria-label="Evidence choices">{current.evidenceChoices.map((choice, index) => <div key={choice.id} className={`rounded-xl border p-4 ${answerStateClasses.idle}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Evidence {index + 1}</p><p className="mt-2 text-sm leading-relaxed text-slate-100">{choice.text}</p></div>)}</div>}
      {current?.answerKind === 'voice' && current.kind !== 'defend' && <div className="flex flex-wrap justify-center gap-2" aria-label="Answer choices">{current.optionTexts.map((option) => <LuminaBadge key={option} accent="cyan" className="px-3 py-2 text-sm">{option}</LuminaBadge>)}</div>}
      {reward && runner.revealHeld && <LuminaPanel accent="emerald" className={`${motion.reveal} text-center`}><Sprout className="mx-auto h-6 w-6 text-emerald-300" /><p className="mt-2 font-semibold text-emerald-100">{reward.text}</p></LuminaPanel>}
      <JudgedMicPanel run={runner} gestureLabel={current?.kind === 'connect' ? 'Build the connection' : 'Place it in the habitat'} voiceLabel="I’m listening"><LuminaButton tone="subtle" size="sm" onClick={runner.hearStimulus}><Ear className="mr-2 h-4 w-4" /> Hear the question again</LuminaButton></JudgedMicPanel>
    </div>
  );
};

const HabitatDiorama: React.FC<HabitatDioramaProps> = ({ data, instanceId, skillId, exhibitId, className = '', onInteraction }) => {
  const stableInstanceId = useRef(data.instanceId ?? instanceId ?? `habitat-diorama-${Math.round(performance.now())}`);
  const resolvedInstanceId = data.instanceId ?? instanceId ?? stableInstanceId.current;
  const built = useMemo(() => itemsFromChallenges(data.challenges ?? [], data), [data]);
  const isJudged = built.items.length > 0;
  useEffect(() => { if ((data.challenges?.length ?? 0) > 0 && !isJudged) console.warn(`[HabitatDiorama] all ${data.challenges?.length} generated challenges failed the spoken/build gates; degrading to exploration`); }, [data.challenges, isJudged]);
  return (
    <LuminaCard topAccent="emerald" className={`w-full ${className}`}>
      <LuminaCardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2"><Leaf className="h-5 w-5 text-emerald-300" /><LuminaBadge accent="emerald">{isJudged ? 'Living ecosystem mission' : 'Open ecosystem'}</LuminaBadge><LuminaBadge accent="cyan">{data.habitat.biome}</LuminaBadge></div><LuminaCardTitle className="text-2xl">{data.habitat.name}</LuminaCardTitle><LuminaCardDescription className="mt-2 max-w-3xl">{data.habitat.description}</LuminaCardDescription></div><div className="flex items-center gap-2 text-xs text-slate-400"><Waves className="h-4 w-4" /> {data.habitat.climate}</div></div></LuminaCardHeader>
      <LuminaCardContent>{isJudged ? <JudgedFace data={data} items={built.items} resolvedInstanceId={resolvedInstanceId} skillId={skillId} exhibitId={exhibitId} onInteraction={onInteraction} /> : <ExploreFace data={data} resolvedInstanceId={resolvedInstanceId} onInteraction={onInteraction} />}</LuminaCardContent>
    </LuminaCard>
  );
};

export default HabitatDiorama;
