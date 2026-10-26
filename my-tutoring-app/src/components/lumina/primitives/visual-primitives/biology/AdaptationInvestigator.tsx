import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { PrimitiveEvaluationResult } from '../../../evaluation';
import type { AdaptationInvestigatorMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import {
  Eye,
  TreePine,
  Link2,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
  Image as ImageIcon,
  Hand,
} from 'lucide-react';
import { PipDock, PipWorkspace, useRunnerPip } from '../../../pip/WorkspacePip';
import { LuminaButton } from '../../../ui';
import { withWorkspaceOnly } from '../../../components/live-activity/runtime/withTeachingWorkspace';
import { useTeachingSurface } from '../../../components/live-activity/runtime/useTeachingSurface';
import { TEACHING_CARDS, teachingScene } from './adaptationInvestigatorWorkspace';

/**
 * Adaptation Investigator - Structure-Function-Environment Reasoning
 *
 * Interactive primitive for teaching why organisms have specific traits.
 * Students explore the trait, environment, and connection between them,
 * then answer "What If?" scenario questions at higher grades.
 *
 * Three-panel layout:
 * 1. "The Trait" - What the adaptation is
 * 2. "The Environment" - What pressures exist
 * 3. "The Connection" - How trait addresses the pressure
 *
 * Higher grades include "What If?" mode where students predict
 * consequences of changing the environment.
 *
 * It is an ungraded teaching surface on the live tutor's workspace only (user ruling 2026-09-24; its wiring is
 * `adaptationInvestigator.card.ts` + `adaptationInvestigator.boss.ts`, an ungraded card): the picture draws itself,
 * the three cards start closed and open on the learner's tap or the tutor's show, the What If? questions are not
 * shown, nothing is graded or submitted, and the learner's Done completes it. An unbound mount shows the shared
 * "needs the tutor" card (the standalone graded investigation was retired 2026-10-26).
 *
 * Grade Bands: 2-4, 5-6, 7-8
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface AdaptationInfo {
  trait: string;
  type: 'structural' | 'behavioral' | 'physiological';
  description: string;
  imagePrompt: string;
}

export interface EnvironmentInfo {
  habitat: string;
  pressures: string[];
  description: string;
}

export interface ConnectionInfo {
  explanation: string;
  evidencePoints: string[];
}

export interface WhatIfScenario {
  environmentChange: string;
  question: string;
  expectedReasoning: string;
  adaptationStillUseful: boolean;
}

export interface MisconceptionInfo {
  commonBelief: string;
  correction: string;
}

export interface AdaptationInvestigatorData {
  organism: string;
  adaptation: AdaptationInfo;
  environment: EnvironmentInfo;
  connection: ConnectionInfo;
  whatIfScenarios: WhatIfScenario[];
  misconception: MisconceptionInfo;
  gradeBand: '2-4' | '5-6' | '7-8';

  // Evaluation props (auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<AdaptationInvestigatorMetrics>) => void;
}

interface AdaptationInvestigatorProps {
  data: AdaptationInvestigatorData;
  className?: string;
  /** Live runtime mount props (`workspaceMountProps`). */
  runtimePlanItemId?: string;
  runtimeEvalMode?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ADAPTATION_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  structural: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
  behavioral: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
  physiological: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
};

const GRADE_LABELS: Record<string, string> = {
  '2-4': 'Grades 2-4',
  '5-6': 'Grades 5-6',
  '7-8': 'Grades 7-8',
};

/** The tutor's ring on a shown object: the demonstration colour, never the learner's selection. */
const TUTOR_RING = 'ring-2 ring-purple-400/80 ring-offset-2 ring-offset-slate-950';

// ============================================================================
// Main Component
// ============================================================================

const AdaptationInvestigatorSurface: React.FC<AdaptationInvestigatorProps> = props => {
  const { data } = props;
  // Defensive check
  if (!data || !data.organism || !data.adaptation || !data.environment || !data.connection) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-xl">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Invalid Data</h3>
        <p className="text-slate-300">
          The adaptation investigator received invalid data. Please regenerate the content.
        </p>
      </div>
    );
  }
  return <AdaptationInvestigatorBody {...props} />;
};

const AdaptationInvestigatorBody: React.FC<AdaptationInvestigatorProps> = ({ data, className = '', runtimePlanItemId }) => {
  const [exploredPanels, setExploredPanels] = useState<Set<string>>(new Set());
  const [showMisconception, setShowMisconception] = useState(false);
  const [organismImage, setOrganismImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // What the tutor has ringed, and whether the learner pressed Done. The refs
  // are what the runtime reads, so a tutor action is visible in the packet as soon as it commits.
  const [marked, setMarked] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const openRef = useRef<Set<string>>(exploredPanels);
  const misconceptionRef = useRef(showMisconception);
  const markedRef = useRef<string[]>(marked);
  const finishedRef = useRef(finished);
  openRef.current = exploredPanels;
  misconceptionRef.current = showMisconception;
  markedRef.current = marked;
  finishedRef.current = finished;
  const pictureState = (): 'drawn' | 'drawing' | 'none' => organismImage ? 'drawn' : imageLoading ? 'drawing' : 'none';
  const pictureRef = useRef(pictureState());
  pictureRef.current = pictureState();
  /** What a DOM probe counts as a visible tutor show. */
  const ringed = (id: string) => marked.includes(id) ? { 'data-tutor-ring': id } : {};

  const typeColors = ADAPTATION_TYPE_COLORS[data.adaptation.type] || ADAPTATION_TYPE_COLORS.structural;

  const { instanceId, objectiveId } = data;

  const surface = useTeachingSurface({
    instanceId: instanceId || 'adaptation-investigator', primitiveId: 'adaptation-investigator', objectiveId,
    planItemId: runtimePlanItemId,
    scene: () => ({ ...teachingScene(data, { open: openRef.current, picture: pictureRef.current,
      misconceptionOpen: misconceptionRef.current }), marked: markedRef.current, finished: finishedRef.current }),
    show: ids => {
      const open = new Set(openRef.current);
      ids.forEach(id => { if ((TEACHING_CARDS as readonly string[]).includes(id)) open.add(id); });
      openRef.current = open;
      if (ids.includes('misconception')) { misconceptionRef.current = true; setShowMisconception(true); }
      markedRef.current = ids;
      setExploredPanels(open);
      setMarked(ids);
    },
  });

  // ============================================================================
  // Image Generation
  // ============================================================================

  const handleGenerateImage = async () => {
    if (imageLoading || organismImage) return;
    setImageLoading(true);
    setImageError(false);

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: data.adaptation.imagePrompt,
          },
        }),
      });

      if (!response.ok) throw new Error('Image generation failed');

      const result = await response.json();
      if (result.imageUrl) {
        setOrganismImage(result.imageUrl);
      } else {
        setImageError(true);
      }
    } catch {
      setImageError(true);
    } finally {
      setImageLoading(false);
    }
  };

  // The picture is what a young learner starts from, so it draws itself without a button to read.
  useEffect(() => {
    void handleGenerateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every committed scene change reaches the tutor; `changed` publishes only when the packet differs.
  useLayoutEffect(() => { surface.publish(); });

  // ============================================================================
  // Cards
  // ============================================================================

  const PANEL_NAMES: Record<string, string> = { trait: 'The Trait card', environment: 'The Environment card',
    connection: 'The Connection card' };
  const markPanelExplored = (panel: string) => {
    if (finished) return;
    // The tutor hears about a card the learner opened, once, after the ref is current.
    if (!openRef.current.has(panel)) {
      openRef.current = new Set(openRef.current).add(panel);
      surface.learnerOpened(PANEL_NAMES[panel] ?? panel);
    }
    setExploredPanels(prev => {
      const next = new Set(prev);
      next.add(panel);
      return next;
    });
  };

  const allPanelsExplored = exploredPanels.has('trait') && exploredPanels.has('environment') && exploredPanels.has('connection');

  const handleDone = () => {
    if (!allPanelsExplored || finishedRef.current) return;
    finishedRef.current = true;
    markedRef.current = [];
    setFinished(true);
    setMarked([]);
    SoundManager.playCorrect();
    surface.finish();
  };

  // ============================================================================
  // Render: Organism Header with Image
  // ============================================================================

  const renderOrganismHeader = () => (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-slate-100 mb-1">{data.organism}</h3>
          <div className="flex items-center gap-2">
            <Badge className={`${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
              {data.adaptation.type}
            </Badge>
            <Badge className="bg-slate-800/50 border-slate-700/50 text-slate-300">
              {GRADE_LABELS[data.gradeBand]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Organism Image */}
      {organismImage ? (
        <div data-pip-object="picture" {...ringed('picture')}
          className={`relative rounded-xl overflow-hidden border border-white/10 mb-4 transition-shadow ${marked.includes('picture') ? TUTOR_RING : ''}`}>
          <img
            src={organismImage}
            alt={`${data.organism} - ${data.adaptation.trait}`}
            className="w-full h-auto"
            onError={() => {
              setOrganismImage(null);
              setImageError(true);
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent p-4">
            <p className="text-xs text-slate-400 italic">{data.adaptation.imagePrompt}</p>
          </div>
        </div>
      ) : (
        // dropzone-triage: decorative image placeholder, out of scope
        <div data-pip-object="picture" {...ringed('picture')}
          className={`relative h-48 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-emerald-500/20 bg-emerald-500/5 mb-4 ${marked.includes('picture') ? TUTOR_RING : ''}`}>
          {imageLoading ? (
            <>
              <div className="w-10 h-10 border-4 border-white/10 border-t-emerald-400 rounded-full animate-spin mb-3" />
              <p className="text-sm text-emerald-400">Generating image...</p>
            </>
          ) : (
            <>
              <Sparkles className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm text-slate-400 italic text-center px-8 mb-3">{data.adaptation.imagePrompt}</p>
              {!imageError && (
                <Button
                  onClick={handleGenerateImage}
                  variant="ghost"
                  className="bg-white/5 border border-white/20 hover:bg-white/10 text-emerald-300"
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Generate Image
                </Button>
              )}
              {imageError && (
                <p className="text-xs text-slate-500">Image generation failed. Try again later.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // ============================================================================
  // Render: Three-Panel Layout
  // ============================================================================

  /** A card is closed until the learner taps it or the tutor shows it. */
  const isClosed = (panel: string) => !exploredPanels.has(panel);
  const cardRing = (panel: string) => marked.includes(panel) ? TUTOR_RING : '';

  const renderClosed = (hint: string) => (
    <CardContent>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Hand className="w-4 h-4" />
        <span>{hint}</span>
      </div>
    </CardContent>
  );

  const renderThreePanels = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Panel 1: The Trait */}
      <Card
        data-pip-object="trait"
        {...ringed('trait')}
        role={isClosed('trait') ? 'button' : undefined}
        aria-label={isClosed('trait') ? 'Open The Trait' : undefined}
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-blue-500/30 ${exploredPanels.has('trait') ? 'ring-1 ring-blue-500/20' : ''} ${cardRing('trait')}`}
        onClick={() => markPanelExplored('trait')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-base text-blue-300">The Trait</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">What the adaptation is</CardDescription>
        </CardHeader>
        {isClosed('trait') ? renderClosed('Tap to open') : (
        <CardContent className="space-y-3">
          <div>
            <p className="text-lg font-semibold text-slate-100 mb-1">{data.adaptation.trait}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{data.adaptation.description}</p>
          </div>
          <Badge className={`${typeColors.bg} ${typeColors.text} border ${typeColors.border}`}>
            {data.adaptation.type} adaptation
          </Badge>
          {exploredPanels.has('trait') && (
            <div className="flex items-center gap-1 text-xs text-blue-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
        )}
      </Card>

      {/* Panel 2: The Environment */}
      <Card
        data-pip-object="environment"
        {...ringed('environment')}
        role={isClosed('environment') ? 'button' : undefined}
        aria-label={isClosed('environment') ? 'Open The Environment' : undefined}
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-emerald-500/30 ${exploredPanels.has('environment') ? 'ring-1 ring-emerald-500/20' : ''} ${cardRing('environment')}`}
        onClick={() => markPanelExplored('environment')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <TreePine className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base text-emerald-300">The Environment</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">What pressures exist</CardDescription>
        </CardHeader>
        {isClosed('environment') ? renderClosed('Tap to open') : (
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-slate-200 mb-1">{data.environment.habitat}</p>
            <p className="text-sm text-slate-300 leading-relaxed">{data.environment.description}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pressures</p>
            {data.environment.pressures.map((pressure, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-300">{pressure}</span>
              </div>
            ))}
          </div>
          {exploredPanels.has('environment') && (
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
        )}
      </Card>

      {/* Panel 3: The Connection */}
      <Card
        data-pip-object="connection"
        {...ringed('connection')}
        role={isClosed('connection') ? 'button' : undefined}
        aria-label={isClosed('connection') ? 'Open The Connection' : undefined}
        className={`backdrop-blur-xl bg-slate-900/40 border-white/10 shadow-xl cursor-pointer transition-all hover:border-amber-500/30 ${exploredPanels.has('connection') ? 'ring-1 ring-amber-500/20' : ''} ${cardRing('connection')}`}
        onClick={() => markPanelExplored('connection')}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="w-5 h-5 text-amber-400" />
            <CardTitle className="text-base text-amber-300">The Connection</CardTitle>
          </div>
          <CardDescription className="text-slate-400 text-sm">How trait addresses the pressure</CardDescription>
        </CardHeader>
        {isClosed('connection') ? renderClosed('Tap to open') : (
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed">{data.connection.explanation}</p>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Evidence</p>
            {data.connection.evidencePoints.map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <Lightbulb className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-300">{point}</span>
              </div>
            ))}
          </div>
          {exploredPanels.has('connection') && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <CheckCircle2 className="w-3 h-3" />
              Explored
            </div>
          )}
        </CardContent>
        )}
      </Card>
    </div>
  );

  // ============================================================================
  // Render: Misconception Section
  // ============================================================================

  const renderMisconception = () => {
    if (!data.misconception) return null;

    return (
      <Accordion type="single" collapsible className={`mb-6 rounded-lg ${cardRing('misconception')}`}
        value={showMisconception ? 'misconception' : ''} onValueChange={(v: string) => {
          if (finished) return;
          if (v === 'misconception' && !misconceptionRef.current) {
            misconceptionRef.current = true;
            surface.learnerOpened('The Common Misconception card');
          }
          setShowMisconception(v === 'misconception');
        }}>
        <AccordionItem value="misconception" className="border-white/10" data-pip-object="misconception" {...ringed('misconception')}>
          <AccordionTrigger
            className="text-slate-300 hover:text-slate-100 hover:no-underline"
            onClick={() => setShowMisconception(true)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <span>Common Misconception</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm font-medium text-orange-300 mb-2">
                Many people think: &ldquo;{data.misconception.commonBelief}&rdquo;
              </p>
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-emerald-300">Actually:</span>{' '}
                {data.misconception.correction}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  // ============================================================================
  // Render: Teaching path (ungraded)
  // ============================================================================

  const renderTeachingFooter = () => finished ? (
    <Card className="backdrop-blur-xl bg-emerald-500/10 border-emerald-500/30 shadow-2xl mb-6">
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <div>
            <h4 className="text-lg font-semibold text-emerald-300">Investigation Complete!</h4>
            <p className="text-sm text-slate-300">
              You explored why the {data.organism} has {data.adaptation.trait.toLowerCase()}.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : (
    <div className="flex flex-col items-center gap-3 mb-6">
      {!allPanelsExplored && <p className="text-sm text-slate-400">Tap a card to open it.</p>}
      {allPanelsExplored && (
        <LuminaButton tone="primary" className="px-6" onClick={handleDone}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Done
        </LuminaButton>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  useRunnerPip({ instanceId: instanceId || 'adaptation-investigator', itemId: finished ? null : 'teach',
    running: !finished, solved: finished });

  return (
    <div className={`relative ${className}`}>
      {renderOrganismHeader()}
      {/* Pip comes from the workspace runner (`pip/WorkspacePip.tsx`): the dock above, the cards as its region. */}
      {!finished && <PipDock />}
      <PipWorkspace>
        {renderThreePanels()}
        {renderMisconception()}
      </PipWorkspace>
      {renderTeachingFooter()}
    </div>
  );
};

// Runs only on the teaching workspace; an unbound mount shows the "needs the tutor" card.
const AdaptationInvestigator = withWorkspaceOnly<AdaptationInvestigatorProps>('adaptation-investigator',
  AdaptationInvestigatorSurface, props => props.data?.organism);

export default AdaptationInvestigator;
