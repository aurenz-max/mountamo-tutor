'use client';

/**
 * Habitat Diorama — Living Ecosystem.
 *
 * Challenges run only on the shared tutor/JEV teaching workspace, wired by the boss (`habitatDiorama.card.ts`,
 * `habitatDiorama.boss.ts`): Observe, Predict and Defend are said and the tutor judges them against the key; Connect
 * and Restore are taps the activity checks; Build a habitat (`build_habitat`, `habitatBuild.ts`) starts on an empty
 * scene, the learner puts in pieces for a named animal and the activity checks the habitat at "I'm done!". The runtime
 * owns progression; an unbound mount shows the shared "needs the tutor" card. A payload with no askable challenge is
 * the ungraded exploration diorama (`HabitatDioramaScene.tsx`), which keeps its own voice.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Leaf, Sprout, Waves, Zap } from 'lucide-react';
import {
  usePrimitiveEvaluation,
  type PrimitiveEvaluationResult,
} from '../../../evaluation';
import type { HabitatDioramaMetrics } from '../../../evaluation/types';
import type { TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { commitGesture, useWorkspaceRunner, type TeachingEvaluationResult }
  from '../../../components/live-activity/runtime/useWorkspaceRunner';
import { leverScene } from '../../../components/live-activity/bossLevers';
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
  LuminaScoreRing,
  accentBorder,
  accentGlow,
  answerStateClasses,
  dropZoneStateClasses,
  motion,
} from '../../../ui';
import { PipDock, PipWorkspace } from '../../../pip/WorkspacePip';
import {
  ZONE_LABELS, askFor, describeHabitatMove, habitatMiss, habitatMoveMatches, habitatScene, itemsFromChallenges,
  revealTextFor, type HabitatItem,
} from './habitatDioramaDomain';
import {
  NEEDS_LIST_LEVER, NEED_WORDS, PIECE_TAGS_LEVER, HABITAT_WATCH_NEVER_SAY,
  animalById, describeHabitatBuild, habitatSceneNote, pieceById, readHabitatBuild, roomFor, type HabitatBuildMiss, type HabitatNeed,
} from './habitatBuild';
import { HabitatBuildScene } from './HabitatBuildScene';
import { useBuildWatcher } from '../../build-layer/buildLayer';
import {
  BODY_CLUES_LEVER, CARD_PICTURES_LEVER, CHANGE_MARK_LEVER, DIRECTION_MODEL_LEVER, FOOD_LINES_KINDS, FOOD_LINES_LEVER,
  HABITAT_LEVERS, ITS_PARTNERS_LEVER, MODEL_CAPTION, START_LINES_LEVER, ZONE_PICTURES, ZONE_PICTURES_LEVER, bodyClues,
  cardPictures, changeMarks, directionModel, organismEmoji, restorePartners, startPartners,
} from './habitatDioramaLevers';
import { habitatDioramaBoss } from './habitatDiorama.boss';
import { ExploreFace, HabitatScene } from './HabitatDioramaScene';

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
    primitiveId: 'habitat-diorama', assignment: habitatDioramaBoss.assignment, items, workspace, objectiveId: data.objectiveId,
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
  const habitat = useMemo(() => ({ organisms: data.organisms, relationships: data.relationships ?? [] }), [data.organisms, data.relationships]);
  const shownEmojis = useMemo(() => data.organisms.map(organismEmoji), [data.organisms]);
  const leverCtx = useMemo(() => ({ data: habitat, shownEmojis }), [habitat, shownEmojis]);
  // Drawing the pulled help levers (`HABITAT_LEVERS`); never on a practice item.
  const foodLines = !practice && !!current && FOOD_LINES_KINDS.includes(current.kind) && pulled.includes(FOOD_LINES_LEVER);
  const ringIds = practice || !current ? []
    : current.kind === 'predict' && pulled.includes(CHANGE_MARK_LEVER) ? changeMarks(current)
      : current.kind === 'restore' && pulled.includes(ITS_PARTNERS_LEVER) ? restorePartners(current, habitat.relationships) : [];
  const zonePictures = !practice && current?.kind === 'restore' && pulled.includes(ZONE_PICTURES_LEVER);
  const clues = !practice && current?.kind === 'restore' && pulled.includes(BODY_CLUES_LEVER) ? bodyClues(current, habitat.organisms) : [];
  const cardPics = !practice && current?.kind === 'defend' && pulled.includes(CARD_PICTURES_LEVER) ? cardPictures(current) : null;
  const startLines = !practice && current?.kind === 'connect' && pulled.includes(START_LINES_LEVER) && current.fromId
    ? { fromId: current.fromId, partners: startPartners(current, habitat.relationships) } : undefined;
  const model = !practice && current?.kind === 'connect' && pulled.includes(DIRECTION_MODEL_LEVER)
    ? directionModel(current.relationshipType, shownEmojis) : null;
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
  // What the tutor and the observer are shown, republished every render: the scene, the lever set's facts and levers.
  useLayoutEffect(() => {
    if (!current) return;
    const scene = habitatScene(current, { habitatName: data.habitat.name, organismNames: data.organisms.map((organism) => organism.commonName), preReader: isPreReader, placed });
    const withPractice = practice
      ? { ...scene, facts: { ...scene.facts, practice: practice.kind === 'build_habitat'
        ? 'An easier habitat, ungraded. The full habitat comes back after it.' : 'An easier one, ungraded. The full item comes back after it.' } }
      : scene;
    const levers = practice || !sessionItem ? [] : HABITAT_LEVERS.declare(sessionItem, leverCtx, pulled);
    const clearItem = () => { setSelectedId(null); setReward(null); setPlaced([]); setBuildVerdict(null); };
    workspace.current = {
      ...leverScene(withPractice, {
        support: practice || !sessionItem ? '' : HABITAT_LEVERS.support(sessionItem, leverCtx),
        onScreen: practice || !sessionItem ? '' : HABITAT_LEVERS.onScreen(sessionItem, leverCtx, pulled) }),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: (id) => {
        const lever = levers.find((l) => l.id === id);
        if (practice || !lever || !sessionItem) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already pulled.`;
        if (lever.kind === 'simplify') {
          const easier = HABITAT_LEVERS.simpler(sessionItem, leverCtx, id);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
          clearItem(); setPractice(easier);
          return { practice: habitatDioramaBoss.assignment(easier) };
        }
        setLeverState({ item: sessionItem.id, pulled: [...pulled, id] });
        return true;
      },
      endPractice: () => { clearItem(); setPractice(null); },
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
    SoundManager.tap();
    const read = readHabitatBuild(animal, current.needs ?? [], placed);
    setBuildVerdict({ correct: !read.miss, text: buildVerdictText(animal.name, read.miss) });
    commitGesture(runner, { response: describeHabitatBuild(animal, placed), correct: !read.miss, cue: () => '', miss: read.miss });
    onInteraction?.({ type: 'habitat_built', timestamp: Date.now() });
  };
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
      <PipDock />
      <PipWorkspace className="space-y-4">
        {animal && current ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start lg:justify-center">
              <div className="w-full max-w-[560px]">
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
          <HabitatScene data={data} isPreReader={isPreReader} selectedId={selectedId} activeIds={activeIds} rewardIds={rewardIds} showRelationships={foodLines} plainLines={startLines} ringIds={ringIds} hideOrganismId={current?.kind === 'restore' ? current.restorationEntityId : undefined} onOrganismTap={handleOrganismTap} />
        )}
        {model && current?.relationshipType && (
          <LuminaPanel accent="cyan" data-lever="direction-model" className="mx-auto w-full max-w-sm text-center">
            <p className="text-3xl" aria-label="model pair"><span>{model[0]}</span><span className="mx-3 text-cyan-300">→</span><span>{model[1]}</span></p>
            {!isPreReader && <p className="mt-2 text-sm text-slate-200">{MODEL_CAPTION[current.relationshipType]}</p>}
          </LuminaPanel>
        )}
        {current?.kind === 'restore' && current.restorationEntityId && <LuminaPanel accent="emerald"><div className="mb-3 flex items-center gap-3"><span className="text-3xl">{organismEmoji(data.organisms.find((organism) => organism.id === current.restorationEntityId)!)}</span><div><p className="text-xs uppercase tracking-wider text-emerald-300">Restoration candidate</p><p className="font-semibold text-slate-100">{current.organismNames[current.restorationEntityId]}</p></div></div>{clues.length > 0 && <ul data-lever="body-clues" className="mb-3 space-y-1 text-sm text-slate-200">{clues.map((clue) => <li key={clue}>• {clue}</li>)}</ul>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.keys(ZONE_LABELS) as HabitatZone[]).map((zone) => <button key={zone} type="button" aria-label={ZONE_LABELS[zone]} data-zone-picture={zonePictures ? 'true' : undefined} disabled={!runner.canAttempt} onClick={() => { SoundManager.tap(); commitMove(current, { zone }); onInteraction?.({ type: 'restoration_committed', timestamp: Date.now() }); }} className={`rounded-xl px-3 py-4 text-sm font-semibold transition-all ${dropZoneStateClasses.idle} ${runner.canAttempt ? 'hover:scale-[1.02]' : 'opacity-50'}`}>{zonePictures && <span className="mr-2 text-xl" aria-hidden="true">{ZONE_PICTURES[zone]}</span>}{ZONE_LABELS[zone]}</button>)}</div></LuminaPanel>}
        {current?.kind === 'defend' && current.evidenceChoices && <div className="grid gap-2 md:grid-cols-3" aria-label="Evidence choices">{current.evidenceChoices.map((choice, index) => <div key={choice.id} className={`rounded-xl border p-4 ${answerStateClasses.idle}`}><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Evidence {index + 1}</p>{cardPics && (cardPics[index]?.length ?? 0) > 0 && <p data-lever="card-pictures" className="mt-1 text-2xl" aria-hidden="true">{cardPics[index].map((id) => { const o = habitat.organisms.find((x) => x.id === id); return o ? organismEmoji(o) : ''; }).join(' ')}</p>}<p className="mt-2 text-sm leading-relaxed text-slate-100">{choice.text}</p></div>)}</div>}
        {current?.answerKind === 'voice' && current.kind !== 'defend' && <div className="flex flex-wrap justify-center gap-2" aria-label="Answer choices">{current.optionTexts.map((option) => <LuminaBadge key={option} accent="cyan" className="px-3 py-2 text-sm">{option}</LuminaBadge>)}</div>}
      </PipWorkspace>
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
