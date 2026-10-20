'use client';

/**
 * Habitat Diorama's living scene and its ungraded exploration face. The scene is drawn by both faces: the exploration
 * diorama (a payload with no askable challenge, which no workspace session binds) and the graded challenges in
 * `HabitatDiorama.tsx`. The exploration face keeps its own tutor voice (`useLuminaAI` tagged sends and the catalog
 * tutoring block): an unbound mount is the only place it runs, so the boss path never reaches it.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import { useLuminaAI } from '../../../hooks/useLuminaAI';
import { SoundManager } from '../../../utils/SoundManager';
import { LuminaBadge, LuminaButton, LuminaPanel, LuminaReadAloud, motion } from '../../../ui';
import type { EnvironmentalFeature, HabitatDioramaData, HabitatDioramaProps, Organism } from './HabitatDiorama';
import { organismEmoji } from './habitatDioramaLevers';

export const ROLE_LABELS: Record<Organism['role'], string> = {
  producer: 'Producer', 'primary-consumer': 'Primary Consumer',
  'secondary-consumer': 'Secondary Consumer', 'tertiary-consumer': 'Tertiary Consumer',
  decomposer: 'Decomposer',
};

const roleAccent = (role: Organism['role']): 'emerald' | 'amber' | 'orange' | 'rose' | 'purple' => ({
  producer: 'emerald', 'primary-consumer': 'amber', 'secondary-consumer': 'orange',
  'tertiary-consumer': 'rose', decomposer: 'purple',
} as const)[role];

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
  /** connect's `start_lines` lever: plain lines, no arrowheads, from `fromId` to each partner. */
  plainLines?: { fromId: string; partners: string[] };
  /** predict's `change_mark` and restore's `its_partners` levers: a ring around each of these living things. */
  ringIds?: string[];
  hideOrganismId?: string;
  onOrganismTap: (id: string) => void;
  onFeatureTap?: (id: string) => void;
}

export const HabitatScene: React.FC<SceneProps> = ({
  data, isPreReader, selectedId, activeIds = [], rewardIds = [],
  showRelationships = false, plainLines, ringIds = [], hideOrganismId, onOrganismTap, onFeatureTap,
}) => (
  <div className="relative min-h-[430px] overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-b from-cyan-950/70 via-emerald-950/65 to-amber-950/50 shadow-inner" aria-label={`${data.habitat.name} living ecosystem`}>
    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-300/10 to-transparent" />
    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-emerald-950/90 to-transparent" />
    <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-amber-300/15 blur-xl" />
    <div className="absolute bottom-8 right-8 h-24 w-56 rounded-full bg-cyan-400/10 blur-2xl" />
    {plainLines && (() => {
      const from = data.organisms.find((organism) => organism.id === plainLines.fromId);
      return from && (
        <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true" data-lever="start-lines">
          {plainLines.partners.map((id) => {
            const to = data.organisms.find((organism) => organism.id === id);
            return to && <line key={id} data-line={id} x1={pct(from.position.x)} y1={pct(from.position.y)} x2={pct(to.position.x)} y2={pct(to.position.y)} stroke="rgb(251 191 36 / .6)" strokeWidth="2" />;
          })}
        </svg>
      );
    })()}
    {showRelationships && (
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true" data-lever="food-lines">
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
      const ringed = ringIds.includes(organism.id);
      return (
        <button key={organism.id} type="button" aria-label={organism.commonName} data-ring={ringed ? 'true' : undefined} onClick={() => onOrganismTap(organism.id)} className={`group absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${ringed ? 'outline outline-4 outline-offset-4 outline-amber-300/80 ' : ''}${rewarded ? `border-emerald-300 bg-emerald-400/25 scale-110 ${motion.pop}` : active ? 'border-cyan-300 bg-cyan-400/20 scale-105 shadow-[0_0_24px_rgba(34,211,238,.35)]' : selected ? 'border-amber-300 bg-amber-400/20 scale-105' : 'border-white/15 bg-slate-950/55 hover:bg-slate-900/75 hover:scale-105'}`} style={{ left: pct(organism.position.x), top: pct(organism.position.y) }}>
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

export const ExploreFace: React.FC<ExploreFaceProps> = ({ data, resolvedInstanceId, onInteraction }) => {
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
