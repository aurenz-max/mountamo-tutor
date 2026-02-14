'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Clock, Gauge, Plane, Ship, Car, Rocket, ChevronRight, ChevronLeft, Check, X, Link2 } from 'lucide-react';
import { SpotlightCard } from '../../../components/SpotlightCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePrimitiveEvaluation } from '../../../evaluation';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * PropulsionTimeline - History of How Humans Move
 *
 * K-5 Engineering Primitive for understanding:
 * - Key transportation milestones through history (K-2)
 * - Chronological ordering of inventions (1-3)
 * - Innovation chains: one invention enables the next (3-5)
 * - Speed records and technology trends (4-5)
 *
 * Real-world connections: walking, horses, steam engines, trains, airplanes, rockets
 */

// ─── Data Interfaces ──────────────────────────────────────────────────────────

export interface TimelineMilestone {
  id: string;
  year: number;
  name: string;
  vehicle: string;
  domain: 'land' | 'sea' | 'air' | 'space';
  topSpeed: string;
  description: string;
  significance: string;
  imagePrompt: string;
  enabledBy: string | null;
  enabledNext: string | null;
}

export interface TimelineEra {
  name: string;
  startYear: number;
  endYear: number;
  color: string;
  description: string;
  dominantTransport: string;
}

export interface SpeedRecord {
  year: number;
  speed: number;
  vehicle: string;
  domain: string;
}

export interface SequencingChallenge {
  items: string[];
  correctOrder: string[];
  hint: string;
}

export interface InnovationChain {
  name: string;
  milestoneIds: string[];
  narrative: string;
}

export interface PropulsionTimelineData {
  title: string;
  timeRange: { startYear: number; endYear: number };
  milestones: TimelineMilestone[];
  eras: TimelineEra[];
  speedRecords: SpeedRecord[];
  sequencingChallenges: SequencingChallenge[];
  innovationChains: InnovationChain[];
  gradeBand: 'K-2' | '3-5';
  // Evaluation props (auto-injected)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  onEvaluationSubmit?: (result: any) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PropulsionTimelineProps {
  data: PropulsionTimelineData;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  land:  { text: 'text-red-300',    bg: 'bg-red-500/20',    border: 'border-red-400/30' },
  sea:   { text: 'text-blue-300',   bg: 'bg-blue-500/20',   border: 'border-blue-400/30' },
  air:   { text: 'text-sky-300',    bg: 'bg-sky-500/20',    border: 'border-sky-400/30' },
  space: { text: 'text-violet-300', bg: 'bg-violet-500/20', border: 'border-violet-400/30' },
};

const DOMAIN_ICONS: Record<string, React.ReactNode> = {
  land:  <Car className="w-3.5 h-3.5" />,
  sea:   <Ship className="w-3.5 h-3.5" />,
  air:   <Plane className="w-3.5 h-3.5" />,
  space: <Rocket className="w-3.5 h-3.5" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

const PropulsionTimeline: React.FC<PropulsionTimelineProps> = ({ data, className }) => {
  const { title, milestones, eras, speedRecords, sequencingChallenges, innovationChains, gradeBand } = data;

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'explore' | 'sequence' | 'connect' | 'speed'>('explore');
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [exploredMilestones, setExploredMilestones] = useState<Set<string>>(new Set());
  const [exploredEras, setExploredEras] = useState<Set<string>>(new Set());
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [speedTrendObserved, setSpeedTrendObserved] = useState(false);

  // Sequencing state
  const [seqChallengeIdx, setSeqChallengeIdx] = useState(0);
  const [seqUserOrder, setSeqUserOrder] = useState<string[]>([]);
  const [seqResults, setSeqResults] = useState<boolean[]>([]);
  const [seqChecked, setSeqChecked] = useState(false);

  // Innovation chain state
  const [exploredChains, setExploredChains] = useState<Set<number>>(new Set());

  const sortedMilestones = useMemo(() =>
    [...milestones].sort((a, b) => a.year - b.year),
    [milestones]
  );

  const filteredMilestones = useMemo(() =>
    domainFilter ? sortedMilestones.filter(m => m.domain === domainFilter) : sortedMilestones,
    [sortedMilestones, domainFilter]
  );

  const selectedMilestone = useMemo(() =>
    milestones.find(m => m.id === selectedMilestoneId),
    [milestones, selectedMilestoneId]
  );

  // ── Evaluation ────────────────────────────────────────────────────────────
  const { submitResult, hasSubmitted } = usePrimitiveEvaluation({
    primitiveType: 'propulsion-timeline' as any,
    instanceId: data.instanceId || 'propulsion-timeline-default',
    skillId: data.skillId,
    subskillId: data.subskillId,
    objectiveId: data.objectiveId,
    onSubmit: data.onEvaluationSubmit,
  });

  // ── AI Tutoring ───────────────────────────────────────────────────────────
  const { sendText } = useLuminaAI({
    primitiveType: 'propulsion-timeline' as any,
    instanceId: data.instanceId || `pt-${Date.now()}`,
    primitiveData: {
      phase,
      selectedMilestone: selectedMilestone?.name || null,
      milestonesExplored: exploredMilestones.size,
      milestonesTotal: milestones.length,
      domainFilter,
    },
    gradeLevel: gradeBand === 'K-2' ? 'kindergarten' : 'elementary',
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const exploreMilestone = useCallback((id: string) => {
    setSelectedMilestoneId(id);
    setExploredMilestones(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    const milestone = milestones.find(m => m.id === id);
    if (milestone) {
      sendText?.(
        `[MILESTONE_EXPLORED] Student tapped "${milestone.name}" (${milestone.year}). Vehicle: ${milestone.vehicle}. Narrate with storytelling flair: "${milestone.significance}"`,
        { silent: true }
      );

      // Track era exploration
      const era = eras.find(e => milestone.year >= e.startYear && milestone.year <= e.endYear);
      if (era) {
        setExploredEras(prev => {
          const next = new Set(prev);
          next.add(era.name);
          return next;
        });
      }
    }
  }, [milestones, eras, sendText]);

  // Sequencing
  const currentSeqChallenge = sequencingChallenges[seqChallengeIdx];
  const seqAvailableItems = useMemo(() => {
    if (!currentSeqChallenge) return [];
    return currentSeqChallenge.items.filter(id => !seqUserOrder.includes(id));
  }, [currentSeqChallenge, seqUserOrder]);

  const addToSequence = useCallback((id: string) => {
    setSeqUserOrder(prev => [...prev, id]);
  }, []);

  const removeFromSequence = useCallback((idx: number) => {
    setSeqUserOrder(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const checkSequence = useCallback(() => {
    if (!currentSeqChallenge) return;
    const isCorrect = JSON.stringify(seqUserOrder) === JSON.stringify(currentSeqChallenge.correctOrder);
    setSeqChecked(true);
    setSeqResults(prev => [...prev, isCorrect]);

    sendText?.(
      isCorrect
        ? `[SEQUENCE_CORRECT] Student correctly ordered the milestones! Celebrate their understanding of chronology.`
        : `[SEQUENCE_INCORRECT] Student's order didn't match. Hint: "${currentSeqChallenge.hint}". Guide them gently.`,
      { silent: true }
    );
  }, [currentSeqChallenge, seqUserOrder, sendText]);

  const nextSequence = useCallback(() => {
    setSeqChecked(false);
    setSeqUserOrder([]);
    if (seqChallengeIdx < sequencingChallenges.length - 1) {
      setSeqChallengeIdx(prev => prev + 1);
    } else if (!hasSubmitted) {
      submitResult(
        seqResults.filter(Boolean).length > seqResults.length / 2,
        Math.round(
          ((exploredMilestones.size / Math.max(milestones.length, 1)) * 30 +
           (seqResults.filter(Boolean).length / Math.max(seqResults.length, 1)) * 40 +
           (exploredChains.size / Math.max(innovationChains.length, 1)) * 20 +
           (speedTrendObserved ? 10 : 0))
        ),
        {
          type: 'propulsion-timeline' as any,
          milestonesExplored: exploredMilestones.size,
          milestonesTotal: milestones.length,
          sequencingCorrect: seqResults.filter(Boolean).length,
          sequencingTotal: sequencingChallenges.length,
          innovationChainsTraced: exploredChains.size,
          erasExplored: exploredEras.size,
          erasTotal: eras.length,
          domainsExplored: Array.from(new Set(
            Array.from(exploredMilestones)
              .map(id => milestones.find(m => m.id === id)?.domain)
              .filter(d => d !== undefined) as string[]
          )),
          speedTrendObserved,
          attemptsCount: seqResults.length,
        },
      );
    }
  }, [seqChallengeIdx, sequencingChallenges.length, hasSubmitted, submitResult, seqResults, exploredMilestones, milestones, exploredChains.size, innovationChains.length, exploredEras.size, eras.length, speedTrendObserved]);

  // ── Render: Explore Phase ─────────────────────────────────────────────────
  const renderExplorePhase = () => (
    <div className="space-y-4">
      {/* Domain filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost" size="sm"
          onClick={() => setDomainFilter(null)}
          className={`text-xs ${!domainFilter ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
        >
          All
        </Button>
        {['land', 'sea', 'air', 'space'].map(d => (
          <Button
            key={d}
            variant="ghost" size="sm"
            onClick={() => setDomainFilter(d)}
            className={`text-xs ${domainFilter === d ? `${DOMAIN_COLORS[d].bg} ${DOMAIN_COLORS[d].text} border ${DOMAIN_COLORS[d].border}` : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
          >
            <span className="mr-1">{DOMAIN_ICONS[d]}</span> {d.charAt(0).toUpperCase() + d.slice(1)}
          </Button>
        ))}
      </div>

      {/* Era bands */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden">
        {eras.map(era => (
          <div
            key={era.name}
            className="h-full transition-all"
            style={{
              flex: era.endYear - era.startYear,
              backgroundColor: era.color + '40',
            }}
            title={`${era.name} (${era.startYear}-${era.endYear})`}
          />
        ))}
      </div>

      {/* Timeline */}
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-white/10" />
        {filteredMilestones.map(milestone => {
          const colors = DOMAIN_COLORS[milestone.domain];
          const isSelected = milestone.id === selectedMilestoneId;
          const isExplored = exploredMilestones.has(milestone.id);
          return (
            <button
              key={milestone.id}
              onClick={() => exploreMilestone(milestone.id)}
              className={`w-full text-left relative transition-all ${
                isSelected ? 'scale-[1.01]' : ''
              }`}
            >
              {/* Dot */}
              <div className={`absolute -left-3.5 top-3 w-3 h-3 rounded-full border-2 transition-all ${
                isExplored ? `${colors.bg} ${colors.border}` : 'bg-slate-700 border-slate-600'
              }`} />

              <div className={`p-3 rounded-xl border transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border}`
                  : isExplored
                    ? 'bg-white/5 border-white/15'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-400">{milestone.year}</span>
                  <Badge variant="outline" className={`${colors.text} ${colors.bg} ${colors.border} text-[10px] h-5 px-1.5`}>
                    {DOMAIN_ICONS[milestone.domain]} {milestone.domain}
                  </Badge>
                  <span className="text-xs text-slate-500">{milestone.topSpeed}</span>
                </div>
                <p className="text-sm font-medium text-slate-100">{milestone.name}</p>
                <p className="text-xs text-slate-400">{milestone.vehicle}</p>

                {isSelected && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-slate-300">{milestone.description}</p>
                    <div className="p-2 rounded-lg bg-white/5">
                      <p className="text-xs text-amber-300 font-medium">Why it mattered:</p>
                      <p className="text-xs text-slate-400">{milestone.significance}</p>
                    </div>
                    {milestone.enabledBy && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <ChevronLeft className="w-3 h-3" />
                        Enabled by: {milestones.find(m => m.id === milestone.enabledBy)?.name}
                      </div>
                    )}
                    {milestone.enabledNext && (
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        Led to: {milestones.find(m => m.id === milestone.enabledNext)?.name}
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-xs text-slate-500 text-center">
        {exploredMilestones.size} / {milestones.length} milestones explored
      </div>
    </div>
  );

  // ── Render: Sequence Phase ────────────────────────────────────────────────
  const renderSequencePhase = () => {
    if (!currentSeqChallenge) return null;
    return (
      <Card className="backdrop-blur-xl bg-amber-500/5 border-amber-400/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-amber-200">
            Put these in order! ({seqChallengeIdx + 1}/{sequencingChallenges.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User's order */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Your order:</p>
            {seqUserOrder.length === 0 ? (
              <p className="text-xs text-slate-600 italic p-3 border border-dashed border-white/10 rounded-lg text-center">
                Tap milestones below to add them in order
              </p>
            ) : (
              <div className="space-y-1">
                {seqUserOrder.map((id, idx) => {
                  const milestone = milestones.find(m => m.id === id);
                  const isCorrectPosition = seqChecked && currentSeqChallenge.correctOrder[idx] === id;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2 rounded-lg border ${
                        seqChecked
                          ? isCorrectPosition ? 'bg-green-500/10 border-green-400/20' : 'bg-red-500/10 border-red-400/20'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <span className="text-xs text-slate-500 w-5">{idx + 1}.</span>
                      <span className="text-sm text-slate-200 flex-1">{milestone?.name}</span>
                      <span className="text-xs text-slate-500">{milestone?.year}</span>
                      {!seqChecked && (
                        <button onClick={() => removeFromSequence(idx)} className="text-slate-500 hover:text-slate-300">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {seqChecked && (isCorrectPosition ? <Check className="w-3.5 h-3.5 text-green-400" /> : <X className="w-3.5 h-3.5 text-red-400" />)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available items */}
          {!seqChecked && seqAvailableItems.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">Available:</p>
              <div className="flex flex-wrap gap-2">
                {seqAvailableItems.map(id => {
                  const milestone = milestones.find(m => m.id === id);
                  return (
                    <Button
                      key={id}
                      variant="ghost" size="sm"
                      onClick={() => addToSequence(id)}
                      className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs h-8"
                    >
                      {milestone?.name}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Check / Next buttons */}
          {!seqChecked && seqUserOrder.length === currentSeqChallenge.items.length && (
            <Button
              variant="ghost"
              onClick={checkSequence}
              className="bg-amber-500/10 border border-amber-400/20 text-amber-200 hover:bg-amber-500/20"
            >
              Check Order
            </Button>
          )}

          {seqChecked && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 italic">{currentSeqChallenge.hint}</p>
              <Button
                variant="ghost"
                onClick={nextSequence}
                className="bg-white/5 border border-white/20 hover:bg-white/10"
              >
                {seqChallengeIdx < sequencingChallenges.length - 1 ? 'Next Challenge' : 'Finish'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render: Connect Phase (Innovation Chains) ─────────────────────────────
  const renderConnectPhase = () => (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">Trace how one invention led to the next:</p>
      {innovationChains.map((chain, idx) => {
        const isExplored = exploredChains.has(idx);
        const chainMilestones = chain.milestoneIds.map(id => milestones.find(m => m.id === id)).filter(Boolean) as TimelineMilestone[];
        return (
          <button
            key={idx}
            onClick={() => {
              setExploredChains(prev => {
                const next = new Set(prev);
                next.add(idx);
                return next;
              });
              sendText?.(
                `[INNOVATION_CHAIN] Student is exploring: "${chain.name}". Narrate how each step enabled the next: "${chain.narrative}"`,
                { silent: true }
              );
            }}
            className={`w-full text-left p-4 rounded-xl border transition-all ${
              isExplored ? 'bg-teal-500/5 border-teal-400/20' : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-medium text-teal-200">{chain.name}</span>
            </div>

            {/* Chain visualization */}
            <div className="flex items-center gap-1 flex-wrap mb-2">
              {chainMilestones.map((m, i) => (
                <React.Fragment key={m.id}>
                  <Badge variant="outline" className={`${DOMAIN_COLORS[m.domain].text} ${DOMAIN_COLORS[m.domain].bg} ${DOMAIN_COLORS[m.domain].border} text-[10px] h-5`}>
                    {m.year} · {m.vehicle}
                  </Badge>
                  {i < chainMilestones.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600" />}
                </React.Fragment>
              ))}
            </div>

            {isExplored && (
              <p className="text-xs text-slate-400 mt-2">{chain.narrative}</p>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── Render: Speed Records Phase ───────────────────────────────────────────
  const renderSpeedPhase = () => {
    const maxSpeed = Math.max(...speedRecords.map(r => r.speed), 1);
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">Watch how top speeds have changed over time:</p>
        <div className="space-y-2">
          {[...speedRecords].sort((a, b) => a.year - b.year).map((record, idx) => {
            const pct = Math.max(5, (record.speed / maxSpeed) * 100);
            const colors = DOMAIN_COLORS[record.domain] || DOMAIN_COLORS.land;
            return (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-10 font-mono">{record.year}</span>
                <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${colors.bg} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 w-28 text-right">{record.speed.toLocaleString()} km/h</span>
                <span className={`text-xs ${colors.text} w-20 truncate`}>{record.vehicle}</span>
              </div>
            );
          })}
        </div>

        {!speedTrendObserved && (
          <Button
            variant="ghost"
            onClick={() => {
              setSpeedTrendObserved(true);
              sendText?.(
                `[SPEED_TREND] Student observed the speed records over time. Point out how speed has grown exponentially! From walking at 5 km/h to spacecraft at 28,000+ km/h.`,
                { silent: true }
              );
            }}
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-xs"
          >
            <Gauge className="w-3.5 h-3.5 mr-1" /> I see the trend!
          </Button>
        )}
        {speedTrendObserved && (
          <p className="text-xs text-green-300 italic">
            Speed has grown exponentially — from walking (5 km/h) to spacecraft (28,000+ km/h)!
          </p>
        )}
      </div>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <SpotlightCard
      className={`w-full ${className || ''}`}
      color="20, 184, 166"
    >
      <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
                <p className="text-sm text-slate-400 mt-0.5">History of How Humans Move</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-white/5 border-white/20 text-slate-400">
              {gradeBand}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Phase Navigation */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'explore', label: '1. Explore' },
              { key: 'sequence', label: '2. Sequence' },
              { key: 'connect', label: '3. Connect' },
              { key: 'speed', label: '4. Speed Records' },
            ] as const).map(p => (
              <Button
                key={p.key}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPhase(p.key);
                  if (p.key === 'speed') setSpeedTrendObserved(false);
                }}
                className={`text-xs ${phase === p.key ? 'bg-white/10 text-slate-100' : 'bg-white/5 border border-white/20 text-slate-400 hover:bg-white/10'}`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Phase Content */}
          {phase === 'explore' && renderExplorePhase()}
          {phase === 'sequence' && renderSequencePhase()}
          {phase === 'connect' && renderConnectPhase()}
          {phase === 'speed' && renderSpeedPhase()}
        </CardContent>
      </Card>
    </SpotlightCard>
  );
};

export default PropulsionTimeline;
