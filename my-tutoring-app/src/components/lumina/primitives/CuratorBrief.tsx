'use client';

/**
 * The lesson's opening screen (rebuilt 2026-10-11; contract docs/contracts/curator-brief.md).
 *
 * One screen, picture first: a generated picture of where the hook happens, three short captions
 * (the hook, the big idea, what the learner will do), a strip of the lesson steps, two or three
 * "I wonder" choices and a Start button. Nothing is graded.
 *
 * Inside a live lesson the catalog's ungraded `teachingWorkspace` binds it: the tutor receives the
 * captions as scene facts and, because a bound surface owns the lesson opening, the greeting and the
 * hook are one turn. Outside a runtime the same screen renders with a read-aloud button that sends
 * the same facts through the legacy channel.
 *
 * The picture sets the scene only. Image models get counts, orders and aligned rows wrong, so the
 * prompt forbids them (`hookPicturePrompt`), and the screen never waits on it.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, Lightbulb, Play, Sparkles, Target } from 'lucide-react';
import type { IntroBriefingData, IntroData } from '../types';
import { SoundManager } from '../utils/SoundManager';
import { resolveHookVisual } from '../utils/hookVisual';
import { useLuminaAI } from '../hooks/useLuminaAI';
import { generateConceptImage } from '../service/geminiClient-api';
import { hookPicturePrompt } from '../service/curator-brief/briefOpening';
import { useWorkspacePipSurface } from '../pip/useWorkspacePipSurface';
import { withWorkspaceController } from '../components/live-activity/runtime/withTeachingWorkspace';
import { useNoTeachingSurface, useTeachingSurface, type TeachingSurface, type TeachingSurfaceOptions }
  from '../components/live-activity/runtime/useTeachingSurface';
import { BRIEF_START_EVENT, briefCaptions, briefSteps, briefWonders, isPreReaderGrade, teachingScene, WONDER_ACCENTS, type PictureState }
  from './curatorBriefWorkspace';
import {
  LuminaBadge, LuminaButton, LuminaCard, LuminaPanel, LuminaReadAloud,
  accentSoftBg, accentSoftBorder, accentText, type LuminaAccent,
} from '../ui';

interface CuratorBriefProps {
  data: IntroBriefingData | IntroData;
  className?: string;
  runtimeEvalMode?: string;
  runtimePlanItemId?: string;
}

type SurfaceProps = CuratorBriefProps & {
  tutorOwned: boolean;
  useController: (options: TeachingSurfaceOptions) => TeachingSurface | null;
};

// Older payloads carry only a hook string and objective strings (contract R9).
const convertToIntroBriefing = (data: IntroData, topic: string = 'Learning Topic'): IntroBriefingData => ({
  primitive: 'intro_briefing',
  topic,
  subject: 'General',
  gradeLevel: 'Elementary',
  estimatedTime: '15-20 minutes',
  hook: { type: 'scenario', content: data.hook, visual: '📚' },
  bigIdea: {
    statement: 'Understanding this concept will help you grow as a learner.',
    whyItMatters: 'This topic connects to many areas of learning and helps build important skills.',
  },
  objectives: data.objectives.map((obj, idx) => ({ id: `obj${idx + 1}`, text: obj, verb: 'explain', icon: 'message' })),
  prerequisites: {
    shouldKnow: ['Basic concepts from previous lessons'],
    quickCheck: { question: 'Are you ready to learn something new?', answer: 'Yes!', hint: 'Think about what you already know.' },
  },
  roadmap: [
    { phase: 'Explore', description: 'Discover the basics', activities: ['Introduction'] },
    { phase: 'Learn', description: 'Understand the details', activities: ['Examples'] },
    { phase: 'Apply', description: 'Use what you learned', activities: ['Practice'] },
  ],
  connections: { buildingFrom: [], leadingTo: [], realWorld: [] },
  mindset: { encouragement: 'You can learn this!', growthTip: 'Ask questions as you go.' },
});

const isIntroBriefingData = (data: IntroBriefingData | IntroData): data is IntroBriefingData => 'mindset' in data;

const CAPTION_ROWS = [
  { id: 'hook', accent: 'amber', Icon: Sparkles },
  { id: 'bigIdea', accent: 'purple', Icon: Lightbulb },
  { id: 'today', accent: 'cyan', Icon: Target },
] as const;

/** The legacy (unbound) channel: the same facts the workspace sends, on the learner's request. */
const LegacyReadAloud: React.FC<{ brief: IntroBriefingData; instanceId: string; preReader: boolean }> = ({ brief, instanceId, preReader }) => {
  const { sendText } = useLuminaAI({
    primitiveType: 'curator-brief', instanceId, exhibitId: brief.topic, gradeLevel: brief.gradeLevel,
    primitiveData: { topic: brief.topic, gradeLevel: brief.gradeLevel, isPreReader: preReader },
  });
  const speak = () => {
    const c = briefCaptions(brief);
    const wonders = briefWonders(brief);
    SoundManager.pop();
    sendText(`[BRIEF_OPENING] The learner asked to hear the lesson opening for "${brief.topic}". `
      + `The hook: ${brief.hook.content} The big idea: ${c.bigIdea} Today: ${c.today}`
      + (wonders.length ? ` The "I wonder" choices: ${wonders.map((w, i) => `${i + 1}, ${w.text}`).join('; ')}.` : '')
      + (preReader ? ' The learner is a pre-reader and cannot read the screen.' : ''), { silent: true });
  };
  return <LuminaReadAloud onClick={speak} size={preReader ? 'lg' : 'md'} />;
};

const CuratorBriefSurface: React.FC<SurfaceProps> = ({ data, className = '', runtimePlanItemId, tutorOwned, useController }) => {
  const brief = useMemo(() => (isIntroBriefingData(data) ? data : convertToIntroBriefing(data)), [data]);
  const raw = data as unknown as Record<string, unknown>;
  const instanceId = String(raw.instanceId || raw.__instanceId || 'curator-brief');
  const objectiveId = typeof raw.objectiveId === 'string' ? raw.objectiveId : undefined;
  const preReader = isPreReaderGrade(brief.gradeLevel);
  const captions = briefCaptions(brief);
  const wonders = briefWonders(brief);
  const steps = briefSteps(brief);
  const realWorld = brief.connections?.realWorld?.[0];

  const [image, setImage] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [marked, setMarked] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // What the runtime reads: refs, so a tutor action or a tap is in the packet as soon as it commits.
  const picture: PictureState = image ? 'drawn' : drawing ? 'drawing' : 'none';
  const pictureRef = useRef(picture); pictureRef.current = picture;
  const pickedRef = useRef(picked); pickedRef.current = picked;
  const startedRef = useRef(started); startedRef.current = started;
  const markedRef = useRef(marked); markedRef.current = marked;

  const surface = useController({
    instanceId, primitiveId: 'curator-brief', objectiveId, planItemId: runtimePlanItemId,
    scene: () => ({ ...teachingScene(brief, { picture: pictureRef.current, picked: pickedRef.current, started: startedRef.current }),
      marked: markedRef.current, finished: startedRef.current }),
    show: ids => { markedRef.current = ids; setMarked(ids); },
  });
  useLayoutEffect(() => { surface?.publish(); });

  // The picture draws itself in the background; the screen never waits on it.
  useEffect(() => {
    const prompt = hookPicturePrompt(brief);
    if (!prompt) return;
    let alive = true;
    setDrawing(true);
    generateConceptImage(prompt, '16:9')
      .then(url => { if (alive && url) setImage(url); })
      .catch(() => {})
      .finally(() => { if (alive) setDrawing(false); });
    return () => { alive = false; };
  }, [brief]);

  const ringed = (id: string) => marked.includes(id)
    ? { 'data-tutor-ring': id, className: 'ring-2 ring-amber-300/70 ring-offset-2 ring-offset-slate-950' } : { className: '' };

  const pick = (i: number) => {
    if (startedRef.current || pickedRef.current === i) return;
    SoundManager.select();
    pickedRef.current = i;
    setPicked(i);
    // A pre-reader cannot read what they tapped: the tutor hears it as host facts.
    surface?.learnerOpened(`"I wonder" choice ${i + 1}, which says: ${wonders[i].text}`);
  };

  const start = () => {
    if (startedRef.current) return;
    SoundManager.pop();
    startedRef.current = true;
    setStarted(true);
    surface?.finish();
    window.dispatchEvent(new CustomEvent(BRIEF_START_EVENT, { detail: { instanceId } }));
    // Scroll layout: bring the first activity into view. The K stage advances on the event instead.
    const section = rootRef.current?.closest('[data-primitive-instance-id]');
    let next = section?.nextElementSibling ?? null;
    while (next && !next.matches('[data-primitive-instance-id]')) next = next.nextElementSibling;
    next?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const pip = useWorkspacePipSurface({
    instanceId, scopeId: started ? null : 'brief', label: 'The lesson opening', solved: started, tutorSpeaking: false,
  });

  const pictureRing = ringed('picture');

  return (
    <div ref={rootRef} className={`w-full text-slate-100 ${className}`} data-brief-reader={preReader ? 'pre' : 'reader'}>
      <LuminaCard className="mx-auto max-w-4xl overflow-hidden p-0">
        {/* Picture first. A placeholder (the hook's glyph) holds the space until it arrives. */}
        <div data-pip-object="picture" data-picture={picture} {...pictureRing}
          className={`relative aspect-video w-full overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 ${pictureRing.className}`}>
          {image ? (
            <img src={image} alt="" className="h-full w-full object-cover animate-fade-in" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3">
              <span className="text-7xl leading-none" aria-hidden="true">{resolveHookVisual(brief.hook.visual, brief.hook.type)}</span>
              {drawing && <span className="h-1 w-24 animate-pulse rounded-full bg-white/20" aria-label="Drawing the picture" />}
            </div>
          )}
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {!preReader && (
            <div className="flex flex-wrap items-center gap-2">
              <LuminaBadge accent="indigo">{brief.subject}</LuminaBadge>
              <LuminaBadge accent="blue">{brief.gradeLevel}</LuminaBadge>
              {brief.estimatedTime && <LuminaBadge accent="teal">{brief.estimatedTime}</LuminaBadge>}
              {brief.preparedFor && <LuminaBadge accent="purple">Prepared for {brief.preparedFor}</LuminaBadge>}
            </div>
          )}

          {pip.store && !started && <div {...pip.dock} />}

          <div {...pip.workspace} className="space-y-5">
            {/* Three captions, the tutor's three beats. A pre-reader hears them; the text stays small. */}
            <div className="space-y-2">
              {CAPTION_ROWS.map(({ id, accent, Icon }) => {
                const ring = ringed(id);
                return (
                  <LuminaPanel key={id} accent={accent} data-pip-object={id} {...ring}
                    className={`flex items-start gap-3 ${ring.className}`}>
                    <Icon size={preReader ? 18 : 20} className={`mt-0.5 flex-shrink-0 ${accentText[accent]}`} aria-hidden="true" />
                    <p className={preReader ? 'text-sm text-slate-300' : 'text-base leading-relaxed text-slate-100'}>
                      {captions[id]}
                    </p>
                  </LuminaPanel>
                );
              })}
            </div>

            {steps.length > 0 && (() => {
              const ring = ringed('steps');
              return (
                <div data-pip-object="steps" {...ring} className={`flex flex-wrap items-center gap-1.5 rounded-lg ${ring.className}`}>
                  {steps.map((s, i) => (
                    <React.Fragment key={`${s.phase}-${i}`}>
                      {i > 0 && <ChevronRight size={14} className="text-slate-600" aria-hidden="true" />}
                      <LuminaBadge accent="cyan">{i + 1} {preReader ? '' : s.phase}</LuminaBadge>
                    </React.Fragment>
                  ))}
                </div>
              );
            })()}

            {wonders.length > 0 && (
              <div className="space-y-2">
                {!preReader && <p className="text-xs uppercase tracking-widest text-slate-400">I wonder...</p>}
                <div className={`grid gap-3 ${wonders.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {wonders.map((w, i) => {
                    const accent: LuminaAccent = WONDER_ACCENTS[i];
                    const ring = ringed(`wonder-${i}`);
                    const selected = picked === i;
                    return (
                      <button key={i} type="button" data-pip-object={`wonder-${i}`} {...ring}
                        aria-pressed={selected} aria-label={w.text} disabled={started} onClick={() => pick(i)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                          selected ? `${accentSoftBg[accent]} ${accentSoftBorder[accent]} scale-[1.02]`
                            : `bg-white/5 ${accentSoftBorder[accent]} hover:bg-white/10`} disabled:opacity-60 ${ring.className}`}>
                        <span className={preReader ? 'text-5xl leading-none' : 'text-3xl leading-none'} aria-hidden="true">{w.emoji}</span>
                        <span className={preReader ? 'text-xs text-slate-400' : `text-sm ${selected ? accentText[accent] : 'text-slate-200'}`}>{w.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* At most one line of the connections; the rest stays in the data. */}
          {!preReader && realWorld && (
            <p className="text-sm text-slate-400">In real life: {realWorld}</p>
          )}

          <div className="flex flex-col items-center gap-3 pt-1">
            {started ? (
              <LuminaBadge accent="emerald" className="gap-1.5 px-3 py-1.5 text-sm">
                <CheckCircle2 size={16} aria-hidden="true" /> Lesson started
              </LuminaBadge>
            ) : (
              <LuminaButton tone="primary" onClick={start} aria-label="Start"
                className={preReader ? 'h-20 w-20 rounded-full p-0' : 'gap-2 rounded-xl px-10 py-3 text-base'}>
                <Play size={preReader ? 34 : 18} aria-hidden="true" />
                {!preReader && 'Start'}
              </LuminaButton>
            )}
            {!tutorOwned && !started && <LegacyReadAloud brief={brief} instanceId={instanceId} preReader={preReader} />}
          </div>
        </div>
      </LuminaCard>
    </div>
  );
};

// Inside a live lesson the catalog's ungraded `teachingWorkspace` mounts the teaching surface;
// everywhere else the same screen with the legacy read-aloud.
export const CuratorBrief = withWorkspaceController<CuratorBriefProps, TeachingSurfaceOptions, TeachingSurface | null>(
  'curator-brief', CuratorBriefSurface, useNoTeachingSurface, useTeachingSurface);

export default CuratorBrief;
