import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { EvolutionTimelineMetrics } from '../../../evaluation/types';

// =============================================================================
// Data Interface (single source of truth)
// =============================================================================

export interface TimelineEra {
  name: string;
  startMya: number;
  endMya: number;
  color: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  name: string;
  mya: number;
  type: 'emergence' | 'extinction' | 'adaptation' | 'environmental';
  description: string;
  significance: string;
  imagePrompt: string | null;
}

export interface Lineage {
  name: string;
  eventIds: string[];
}

export interface ScaleAnchorMapping {
  event: string;
  analogyPosition: string;
}

export interface ScaleAnchor {
  analogy: string;
  mappings: ScaleAnchorMapping[];
}

export interface MassExtinction {
  name: string;
  mya: number;
  cause: string;
  percentSpeciesLost: string;
  aftermath: string;
}

export interface EvolutionTimelineData {
  timespan: {
    startMya: number;
    endMya: number;
  };
  eras: TimelineEra[];
  events: TimelineEvent[];
  lineages: Lineage[];
  scaleAnchors: ScaleAnchor[];
  massExtinctions: MassExtinction[];
  gradeBand: '4-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult) => void;
}

// =============================================================================
// Helper functions
// =============================================================================

const eventTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  emergence: { icon: '🌱', color: 'text-emerald-300', label: 'Emergence' },
  extinction: { icon: '💀', color: 'text-red-400', label: 'Extinction' },
  adaptation: { icon: '🧬', color: 'text-blue-300', label: 'Adaptation' },
  environmental: { icon: '🌍', color: 'text-amber-300', label: 'Environmental' },
};

function formatMya(mya: number): string {
  if (mya >= 1000) return `${(mya / 1000).toFixed(1)} Bya`;
  if (mya >= 1) return `${Math.round(mya)} Mya`;
  return `${(mya * 1000).toFixed(0)} Kya`;
}

// =============================================================================
// Component
// =============================================================================

interface EvolutionTimelineProps {
  data: EvolutionTimelineData;
  className?: string;
}

const EvolutionTimeline: React.FC<EvolutionTimelineProps> = ({ data, className }) => {
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [activeLineage, setActiveLineage] = useState<Lineage | null>(null);
  const [selectedExtinction, setSelectedExtinction] = useState<MassExtinction | null>(null);
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number }>({
    start: data.timespan.startMya,
    end: data.timespan.endMya,
  });
  const [eventsExplored, setEventsExplored] = useState<Set<string>>(new Set());
  const [lineagesTraced, setLineagesTraced] = useState<Set<string>>(new Set());
  const [extinctionsExplored, setExtinctionsExplored] = useState<Set<string>>(new Set());
  const [scaleAnchorsViewed, setScaleAnchorsViewed] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  const {
    submitResult,
    hasSubmitted,
  } = usePrimitiveEvaluation<EvolutionTimelineMetrics>({
    primitiveType: 'evolution-timeline',
    instanceId: instanceId || `evolution-timeline-${Date.now()}`,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  // Total explorable items
  const totalEvents = data.events.length;
  const totalLineages = data.lineages.length;
  const totalExtinctions = data.massExtinctions.length;

  // Compute position on the timeline (0 to 1)
  const getPosition = useCallback((mya: number) => {
    const range = zoomRange.start - zoomRange.end;
    if (range === 0) return 0;
    return (zoomRange.start - mya) / range;
  }, [zoomRange]);

  // Events within current zoom range
  const visibleEvents = useMemo(() => {
    return data.events.filter(e => e.mya <= zoomRange.start && e.mya >= zoomRange.end);
  }, [data.events, zoomRange]);

  // Eras within current zoom range
  const visibleEras = useMemo(() => {
    return data.eras.filter(era => era.startMya > zoomRange.end && era.endMya < zoomRange.start);
  }, [data.eras, zoomRange]);

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(prev => prev?.id === event.id ? null : event);
    setEventsExplored(prev => { const next = new Set(Array.from(prev)); next.add(event.id); return next; });
  };

  const handleLineageSelect = (lineage: Lineage | null) => {
    setActiveLineage(lineage);
    if (lineage) {
      setLineagesTraced(prev => { const next = new Set(Array.from(prev)); next.add(lineage.name); return next; });
    }
  };

  const handleExtinctionClick = (extinction: MassExtinction) => {
    setSelectedExtinction(prev => prev?.name === extinction.name ? null : extinction);
    setExtinctionsExplored(prev => { const next = new Set(Array.from(prev)); next.add(extinction.name); return next; });
  };

  const handleZoomToEra = (era: TimelineEra) => {
    setZoomRange({ start: era.startMya, end: era.endMya });
  };

  const handleResetZoom = () => {
    setZoomRange({ start: data.timespan.startMya, end: data.timespan.endMya });
  };

  const handleZoomIn = () => {
    const range = zoomRange.start - zoomRange.end;
    const mid = (zoomRange.start + zoomRange.end) / 2;
    const newRange = range * 0.5;
    setZoomRange({
      start: Math.min(data.timespan.startMya, mid + newRange / 2),
      end: Math.max(data.timespan.endMya, mid - newRange / 2),
    });
  };

  const handleZoomOut = () => {
    const range = zoomRange.start - zoomRange.end;
    const mid = (zoomRange.start + zoomRange.end) / 2;
    const newRange = Math.min(
      range * 2,
      data.timespan.startMya - data.timespan.endMya
    );
    setZoomRange({
      start: Math.min(data.timespan.startMya, mid + newRange / 2),
      end: Math.max(data.timespan.endMya, mid - newRange / 2),
    });
  };

  // Check if event is part of active lineage
  const isInActiveLineage = (eventId: string) => {
    if (!activeLineage) return false;
    return activeLineage.eventIds.includes(eventId);
  };

  // Exploration completion
  const explorationProgress = Math.round(
    ((eventsExplored.size / Math.max(1, totalEvents)) * 40 +
      (lineagesTraced.size / Math.max(1, totalLineages)) * 30 +
      (extinctionsExplored.size / Math.max(1, totalExtinctions)) * 20 +
      (scaleAnchorsViewed ? 10 : 0))
  );

  const handleSubmitExploration = () => {
    if (hasSubmitted) return;

    const metrics: EvolutionTimelineMetrics = {
      type: 'evolution-timeline',
      totalEvents,
      eventsExplored: eventsExplored.size,
      totalLineages,
      lineagesTraced: lineagesTraced.size,
      totalExtinctions,
      extinctionsExplored: extinctionsExplored.size,
      scaleAnchorsViewed,
      explorationScore: explorationProgress,
      zoomInteractions: 0, // simplified
    };

    submitResult(explorationProgress >= 50, explorationProgress, metrics, {
      studentWork: {
        eventsExplored: Array.from(eventsExplored),
        lineagesTraced: Array.from(lineagesTraced),
        extinctionsExplored: Array.from(extinctionsExplored),
      },
    });
  };

  return (
    <Card className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-2xl ${className || ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-slate-100 text-xl">
              Evolution Timeline
            </CardTitle>
            <CardDescription className="text-slate-400">
              Explore {formatMya(data.timespan.startMya)} of evolutionary history
            </CardDescription>
          </div>
          <Badge className="bg-slate-800/50 border-slate-700/50 text-emerald-300">
            Grades {data.gradeBand}
          </Badge>
        </div>

        {/* Exploration Progress */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Exploration Progress</span>
            <span>{explorationProgress}%</span>
          </div>
          <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${explorationProgress}%` }}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs defaultValue="timeline" className="w-full">
          <TabsList className="bg-slate-800/50 border border-white/10">
            <TabsTrigger value="timeline" className="data-[state=active]:bg-white/10 text-slate-300">
              Timeline
            </TabsTrigger>
            <TabsTrigger value="lineages" className="data-[state=active]:bg-white/10 text-slate-300">
              Lineages
            </TabsTrigger>
            <TabsTrigger value="extinctions" className="data-[state=active]:bg-white/10 text-slate-300">
              Mass Extinctions
            </TabsTrigger>
            <TabsTrigger value="scale" className="data-[state=active]:bg-white/10 text-slate-300">
              Scale Anchors
            </TabsTrigger>
          </TabsList>

          {/* ==================== TIMELINE TAB ==================== */}
          <TabsContent value="timeline" className="space-y-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 h-8 px-3"
                >
                  + Zoom In
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 h-8 px-3"
                >
                  - Zoom Out
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetZoom}
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300 h-8 px-3"
                >
                  Reset
                </Button>
              </div>
              <span className="text-xs text-slate-500">
                {formatMya(zoomRange.start)} &mdash; {formatMya(zoomRange.end)}
              </span>
            </div>

            {/* Era Bars */}
            <div className="relative h-8 rounded-md overflow-hidden border border-white/10">
              {visibleEras.map((era) => {
                const left = getPosition(era.startMya) * 100;
                const right = getPosition(era.endMya) * 100;
                const width = right - left;
                return (
                  <button
                    key={era.name}
                    onClick={() => handleZoomToEra(era)}
                    className="absolute top-0 h-full flex items-center justify-center text-[10px] font-medium text-white/90 cursor-pointer hover:brightness-125 transition-all border-r border-black/20"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: era.color,
                      minWidth: width > 5 ? undefined : '2px',
                    }}
                    title={`${era.name}: ${formatMya(era.startMya)} - ${formatMya(era.endMya)}`}
                  >
                    {width > 12 ? era.name : ''}
                  </button>
                );
              })}
            </div>

            {/* Timeline Track */}
            <div
              ref={timelineRef}
              className="relative h-48 bg-slate-800/30 rounded-lg border border-white/10 overflow-hidden"
            >
              {/* Center line */}
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/20" />

              {/* Lineage highlight path */}
              {activeLineage && (() => {
                const lineageEvents = activeLineage.eventIds
                  .map(id => data.events.find(e => e.id === id))
                  .filter((e): e is TimelineEvent => !!e)
                  .filter(e => e.mya <= zoomRange.start && e.mya >= zoomRange.end)
                  .sort((a, b) => b.mya - a.mya);

                if (lineageEvents.length < 2) return null;

                return lineageEvents.slice(0, -1).map((evt, i) => {
                  const next = lineageEvents[i + 1];
                  const x1 = getPosition(evt.mya) * 100;
                  const x2 = getPosition(next.mya) * 100;
                  return (
                    <div
                      key={`lineage-${evt.id}-${next.id}`}
                      className="absolute top-1/2 h-1 bg-gradient-to-r from-cyan-400/60 to-emerald-400/60 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${x1}%`,
                        width: `${x2 - x1}%`,
                      }}
                    />
                  );
                });
              })()}

              {/* Event Markers */}
              {visibleEvents.map((event) => {
                const pos = getPosition(event.mya) * 100;
                const config = eventTypeConfig[event.type];
                const isSelected = selectedEvent?.id === event.id;
                const inLineage = isInActiveLineage(event.id);
                const dimmed = activeLineage && !inLineage;

                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all cursor-pointer group ${
                      dimmed ? 'opacity-30' : 'opacity-100'
                    } ${isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'}`}
                    style={{ left: `${pos}%` }}
                    title={`${event.name} (${formatMya(event.mya)})`}
                  >
                    <span className="text-lg drop-shadow-lg">{config.icon}</span>
                    <span className={`text-[9px] font-medium leading-tight max-w-[60px] text-center ${
                      isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    }`}>
                      {event.name}
                    </span>
                  </button>
                );
              })}

              {/* Mass extinction markers */}
              {data.massExtinctions
                .filter(ext => ext.mya <= zoomRange.start && ext.mya >= zoomRange.end)
                .map((ext) => {
                  const pos = getPosition(ext.mya) * 100;
                  return (
                    <div
                      key={`ext-${ext.name}`}
                      className="absolute top-0 bottom-0 w-px bg-red-500/40 z-5"
                      style={{ left: `${pos}%` }}
                    >
                      <div className="absolute top-1 left-1 text-[8px] text-red-400 whitespace-nowrap">
                        {ext.name}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Selected Event Detail Card */}
            {selectedEvent && (
              <Card className="bg-slate-800/50 border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{eventTypeConfig[selectedEvent.type].icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-slate-100 font-semibold">{selectedEvent.name}</h4>
                        <Badge className={`text-xs ${eventTypeConfig[selectedEvent.type].color} bg-transparent border-current`}>
                          {eventTypeConfig[selectedEvent.type].label}
                        </Badge>
                        <span className="text-xs text-slate-500">{formatMya(selectedEvent.mya)}</span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{selectedEvent.description}</p>
                      <p className="text-xs text-slate-400 italic">{selectedEvent.significance}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== LINEAGES TAB ==================== */}
          <TabsContent value="lineages" className="space-y-3">
            <p className="text-sm text-slate-400">
              Trace evolutionary paths to see how major groups emerged over time.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleLineageSelect(null)}
                className={`h-8 px-3 border ${
                  !activeLineage
                    ? 'bg-white/15 border-white/30 text-slate-100'
                    : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-400'
                }`}
              >
                Show All
              </Button>
              {data.lineages.map((lineage) => (
                <Button
                  key={lineage.name}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLineageSelect(lineage)}
                  className={`h-8 px-3 border ${
                    activeLineage?.name === lineage.name
                      ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                      : 'bg-white/5 border-white/20 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  {lineage.name}
                </Button>
              ))}
            </div>

            {activeLineage && (
              <div className="space-y-2 mt-3">
                <h4 className="text-sm font-medium text-slate-200">{activeLineage.name}</h4>
                <div className="flex items-center gap-1 flex-wrap">
                  {activeLineage.eventIds.map((id, i) => {
                    const event = data.events.find(e => e.id === id);
                    if (!event) return null;
                    return (
                      <React.Fragment key={id}>
                        {i > 0 && <span className="text-slate-600 text-xs mx-1">&rarr;</span>}
                        <button
                          onClick={() => handleEventClick(event)}
                          className="text-xs px-2 py-1 rounded bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                        >
                          {event.name}
                          <span className="text-[10px] text-slate-500 ml-1">({formatMya(event.mya)})</span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ==================== MASS EXTINCTIONS TAB ==================== */}
          <TabsContent value="extinctions" className="space-y-3">
            <p className="text-sm text-slate-400">
              Explore the major mass extinction events that reshaped life on Earth.
            </p>
            <Accordion type="single" collapsible>
              {data.massExtinctions.map((ext, i) => (
                <AccordionItem key={ext.name} value={`ext-${i}`} className="border-white/10">
                  <AccordionTrigger
                    className="text-slate-300 hover:text-slate-100 hover:no-underline"
                    onClick={() => handleExtinctionClick(ext)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-red-400">💀</span>
                      <span>{ext.name}</span>
                      <Badge className="bg-red-500/10 border-red-400/20 text-red-300 text-xs">
                        {formatMya(ext.mya)}
                      </Badge>
                      <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-400 text-xs">
                        ~{ext.percentSpeciesLost} lost
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm space-y-2 pb-4">
                    <div className="bg-black/20 rounded-lg p-3 space-y-2">
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Cause</span>
                        <p className="text-slate-300">{ext.cause}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Species Lost</span>
                        <p className="text-slate-300">{ext.percentSpeciesLost}</p>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 uppercase tracking-wider">Aftermath</span>
                        <p className="text-slate-300">{ext.aftermath}</p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          {/* ==================== SCALE ANCHORS TAB ==================== */}
          <TabsContent value="scale" className="space-y-3">
            <p className="text-sm text-slate-400">
              Deep time is hard to grasp. These analogies help you understand the scale.
            </p>
            {data.scaleAnchors.map((anchor, i) => {
              return (
                <Card key={i} className="bg-slate-800/30 border-white/10">
                  <CardContent className="p-4 space-y-3">
                    <h4 className="text-slate-200 font-medium text-sm">{anchor.analogy}</h4>
                    <div className="space-y-1.5">
                      {anchor.mappings.map((m, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <span className="text-amber-300">&#9679;</span>
                          <span className="text-slate-300 font-medium">{m.event}</span>
                          <span className="text-slate-600">&mdash;</span>
                          <span className="text-slate-400">{m.analogyPosition}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScaleAnchorsViewed(true)}
              className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-300"
            >
              {scaleAnchorsViewed ? 'Scale Anchors Viewed' : 'Mark as Reviewed'}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Submit Exploration */}
        <div className="flex items-center gap-3 pt-2 border-t border-white/10">
          <Button
            onClick={handleSubmitExploration}
            disabled={hasSubmitted}
            variant="ghost"
            className="bg-white/5 border border-white/20 hover:bg-white/10 text-slate-200"
          >
            {hasSubmitted ? 'Exploration Submitted' : 'Submit Exploration'}
          </Button>
          <span className="text-xs text-slate-500">
            {eventsExplored.size}/{totalEvents} events &middot;
            {lineagesTraced.size}/{totalLineages} lineages &middot;
            {extinctionsExplored.size}/{totalExtinctions} extinctions
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default EvolutionTimeline;
