'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaDropZone, LuminaReadAloudGlyph, type DropZoneState } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { itemsFromChallenges, workspaceAssignment, workspaceScene, type ShapeSorterItem } from './shapeSorterDomain';
import { renderShapeSVG, shapeFill, type ShapeMarks } from './shapeSorterDrawing';
import {
  FEWER_MATS, MAT_PICTURES, MODEL_COUNT, MODEL_OBJECT, MODEL_SHAPE, OUTLINE_ONLY, SIDE_TICKS, START_MARK, TOUCH_MARKS,
  droppedMat, matPicture, modelCountFor, modelObjectFor, modelShapeFor, shapeSorterLeverFacts, shapeSorterLevers,
  simplerShape, startingLevers, type MatPicture, type SimplerShapeItem,
} from './shapeSorterLevers';
import RealWorldShapeObject from '../shared/RealWorldShapeObject';
import type { RealWorldShapeObjectId } from '../shared/realWorldShapeObjects';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import { useWorkspacePin } from '../../../components/live-activity/runtime/workspacePin';
import { SoundManager } from '../../../utils/SoundManager';
import type { ShapeSorterProps } from './ShapeSorter';

const MAT_COLORS = ['text-cyan-300', 'text-purple-300', 'text-amber-300'];

/** Naming (plain and real-object), counting and sorting: geometry and scene binding
 *  only. Conversation and progression are shared. */
export default function ShapeSorterTeaching({ data, className, runtimePlanItemId }: ShapeSorterProps) {
  const items = useMemo(() => itemsFromChallenges(data.challenges, { isPreReader: (data.gradeBand ?? 'K') === 'K' }), [data.challenges, data.gradeBand]);
  if (!items.length) {
    return <LuminaCard><LuminaCardContent>These shape challenges are still being drawn. Try generating them again.</LuminaCardContent></LuminaCard>;
  }
  return <ShapesWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} />;
}

/** `mat_pictures`: what a mat collects, drawn from its label alone. Never a shape. */
function MatPictureView({ picture }: { picture: MatPicture }) {
  if (picture.kind === 'sticks') return <svg data-mat-picture="sticks" width={Math.max(24, picture.n * 10)} height={22} aria-hidden="true">
    {Array.from({ length: picture.n }, (_, i) => <line key={i} x1={6 + i * 10} y1={3} x2={6 + i * 10} y2={19}
      stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />)}
  </svg>;
  if (picture.kind === 'stroke') return <svg data-mat-picture={picture.curved ? 'curved' : 'straight'} width={40} height={22} aria-hidden="true">
    {picture.curved
      ? <path d="M4 18 Q20 -6 36 18" fill="none" stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />
      : <line x1={4} y1={11} x2={36} y2={11} stroke="#e2e8f0" strokeWidth={3} strokeLinecap="round" />}
  </svg>;
  return <span data-mat-picture="swatch" aria-hidden="true" className="inline-block h-5 w-8 rounded-md border border-white/20"
    style={{ background: shapeFill(picture.color) }} />;
}

/** The model card: a DIFFERENT shape or object, solved by the tutor ("my turn"), small and apart from the item. */
function ModelCard({ lever, shape, objectId, marks }: { lever: string; shape: string; objectId?: RealWorldShapeObjectId; marks?: 'sides' | 'corners' }) {
  return <div data-lever={lever} data-model-shape={shape} aria-label="My turn: a different one"
    className="flex items-center gap-3 rounded-xl border-2 border-dashed border-purple-400/70 bg-purple-500/10 px-3 py-2">
    <span aria-hidden="true" className="text-xl leading-none">🗣️</span>
    {objectId && <>
      <RealWorldShapeObject objectId={objectId} className="h-20 w-20" showLabel={false} />
      <span aria-hidden="true" className="text-xl text-purple-200">→</span>
    </>}
    <svg width={80} height={80} viewBox="0 0 80 80" role="img" aria-label="the model shape">
      {renderShapeSVG(shape, 40, 40, 44, 'cyan', 0, {
        showCorners: marks === 'corners', ...(marks === 'sides' ? { marks: { ticks: true } } : {}) })}
    </svg>
  </div>;
}

function ShapesWorkspace({ data, items, className, runtimePlanItemId }: ShapeSorterProps & {
  items: ShapeSorterItem[];
}) {
  const instance = useRef(data.instanceId || `shape-sorter-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  // In-item levers (`shapeSorterLevers.ts`), keyed by the session item they were pulled on, and the easier item a
  // simplify lever put on screen in its place. Retry on the easier item keeps it; only endPractice removes it.
  const [leverState, setLeverState] = useState<{ item: string; pulled: string[] }>({ item: '', pulled: [] });
  const [practice, setPractice] = useState<SimplerShapeItem | null>(null);
  const [tapped, setTapped] = useState<ReadonlySet<number>>(new Set());
  const openedIndex = useRef(-1);
  const assignments = useMemo(() => items.map(item => ({ ...workspaceAssignment(item), checkResponse: () => null })), [items]);
  const evalMode = useWorkspacePin();
  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'shape-sorter',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, items: assignments, workspace,
    onItemOpened: opened => {
      setTapped(new Set());
      if (opened !== openedIndex.current) setPractice(null);
      openedIndex.current = opened;
    } });
  useTeachingEvaluation<ShapeSorterMetrics>({ primitiveType: 'shape-sorter', instanceId: instance.current,
    data, assignments, lesson,
    metrics: result => {
      const scoreFor = (mode: 'identify' | 'count' | 'sort') => {
        const scores = result.outcomes.filter(o => items.find(i => i.id === o.id)?.mode === mode).map(o => o.score);
        return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      };
      return { type: 'shape-sorter', evalMode, identifyAccuracy: scoreFor('identify'),
        countAccuracy: scoreFor('count'), sortAccuracy: scoreFor('sort'), attemptsCount: result.attemptsCount };
    } });
  const sessionItem = items[lesson.state.index];
  const sessionShapes = data.challenges.find(c => c.id === sessionItem.challengeId)!.shapes;
  /** What is on screen: the easier item while a simplify lever holds it, else the session item. */
  const item = practice?.item ?? sessionItem;
  const shapes = (practice?.shapes ?? sessionShapes) as typeof sessionShapes;
  const pulled = leverState.item === sessionItem.id ? leverState.pulled : [];
  /** A lever's picture is drawn on the session item only, while pulled or started by the tier. */
  const on = (id: string) => !practice && (pulled.includes(id) || startingLevers(sessionItem).includes(id));

  useLayoutEffect(() => {
    const scene = workspaceScene(item, shapes);
    const onScreen = practice ? '' : shapeSorterLeverFacts(sessionItem, pulled, items);
    const levers = practice ? [] : shapeSorterLevers(sessionItem, pulled, items, sessionShapes);
    workspace.current = {
      ...scene,
      ...(onScreen ? { facts: { ...scene.facts, onScreen } } : {}),
      demonstration: marks,
      canDemonstrate: true, mark, clearPresentation: () => mark([]),
      levers,
      // A synchronous commit (the workspace runs it inside flushSync): the screen changes before this returns.
      pullLever: id => {
        const lever = levers.find(l => l.id === id);
        if (!lever) return `No lever ${id} on this item.`;
        if (lever.pulled) return `${id} is already on screen.`;
        const next = { item: sessionItem.id, pulled: [...pulled, id] };
        if (lever.kind === 'simplify' && id !== FEWER_MATS) {
          const easier = simplerShape(sessionItem, items, sessionShapes);
          if (!easier) return 'There is no easier item for this one.';
          setLeverState(next); setPractice(easier); setTapped(new Set()); mark([]);
          return { practice: workspaceAssignment(easier.item) };
        }
        setLeverState(next);
        return true;
      },
      endPractice: () => { setPractice(null); setTapped(new Set()); mark([]); },
    };
  });

  /** Which sort groups this challenge has already had a correct attempt land on —
   *  read off the session's own attempt history, never a local click map. */
  const placedByChoice = useMemo(() => {
    const map = new Map<string, number>();
    if (item.mode !== 'sort') return map;
    for (const attempt of lesson.state.attempts) {
      if (!attempt.correct) continue;
      const solved = items.find(i => i.id === attempt.itemId);
      if (!solved || solved.mode !== 'sort' || solved.challengeId !== item.challengeId) continue;
      map.set(solved.answer, (map.get(solved.answer) ?? 0) + 1);
    }
    return map;
  }, [item, items, lesson.state.attempts]);

  const summary = lesson.summary;
  const cols = Math.min(shapes.length, 4), cell = 108;

  const renderPool = () => (
    <div className="flex justify-center">
      <svg width={cols * cell} height={Math.ceil(shapes.length / cols) * cell}
        viewBox={`0 0 ${cols * cell} ${Math.ceil(shapes.length / cols) * cell}`}
        role="img" aria-label="Shapes to look at" className="max-w-full h-auto">
        {shapes.map((shape, index) => {
          const x = (index % cols) * cell + cell / 2, y = Math.floor(index / cols) * cell + cell / 2;
          const current = index === item.shapeIndex, marked = marks.includes(`shape-${index}`);
          return <g key={index} data-shape-id={`shape-${index}`} data-assignment-target={current}
            data-pip-object={current ? 'shape' : undefined} data-tutor-demonstration={marked}>
            {current && <circle cx={x} cy={y} r={46} fill="none" stroke="#fbbf24" strokeWidth={3} />}
            {marked && <circle cx={x} cy={y} r={50} fill="none" stroke="#c084fc" strokeWidth={3} strokeDasharray="5 4" />}
            {renderShapeSVG(shape.shape, x, y, 40 * ({ small: .6, medium: 1, large: 1.4 }[shape.size ?? 'medium'] ?? 1),
              shape.color, shape.rotation ?? 0, { dimmed: !current && !marked,
                // side_ticks lever: a tick across each side of the ringed shape only. No number.
                ...(current && item.mode === 'sort' && on(SIDE_TICKS) ? { marks: { ticks: true } } : {}) })}
          </g>;
        })}
      </svg>
    </div>
  );

  const renderCount = () => {
    const shape = shapes[item.shapeIndex];
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    const kind = item.countNoun === 'corners' ? 'corner' as const : 'side' as const;
    // start_mark / touch_marks levers: one start dot, and tap targets that mark; on the learner's own shape, no number.
    const leverMarks: ShapeMarks = {
      ...(on(START_MARK) ? { start: kind } : {}),
      ...(on(TOUCH_MARKS) ? { tap: { kind, marked: tapped, onTap: (i: number) => {
        SoundManager.tap();
        setTapped(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; });
      } } } : {}),
    };
    return <div className="flex justify-center">
      <svg data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true" data-pip-object="shape"
        data-tutor-demonstration={marked} width={220} height={220} viewBox="0 0 220 220" role="img" aria-label="Shape to count">
        <circle cx={110} cy={110} r={100} fill="none" stroke="#fbbf24" strokeWidth={3} />
        {marked && <circle cx={110} cy={110} r={106} fill="none" stroke="#c084fc" strokeWidth={3} strokeDasharray="5 4" />}
        {renderShapeSVG(shape.shape, 110, 110, 88, shape.color, shape.rotation ?? 0, { showCorners: item.showCornerHints, marks: leverMarks })}
      </svg>
    </div>;
  };

  const renderRealObject = () => {
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    return item.realObjectId ? <div data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true"
      data-pip-object="shape" data-tutor-demonstration={marked}
      className={`flex justify-center rounded-2xl border p-5 ${marked ? 'border-purple-400/50 bg-purple-500/10' : 'border-amber-400/40 bg-amber-500/5'}`}>
      <RealWorldShapeObject objectId={item.realObjectId} className="h-48 w-48" detailsMuted={on(OUTLINE_ONLY)} />
    </div> : null;
  };

  const dropped = on(FEWER_MATS) ? droppedMat(item) : null;
  const renderMats = () => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? 0;
        const marked = marks.includes(`mat-${idx}`);
        const zoneState: DropZoneState = marked ? 'correct' : placed > 0 ? 'filled' : 'idle';
        const picture = on(MAT_PICTURES) ? matPicture(item, label) : null;
        return <div key={label} data-shape-id={`mat-${idx}`} data-tutor-demonstration={marked}
          data-mat-greyed={dropped === label || undefined} className={`w-full ${dropped === label ? 'opacity-30' : ''}`}>
          <h3 className={`mb-2 text-center font-bold text-sm ${MAT_COLORS[idx] ?? MAT_COLORS[0]}`}>{label}</h3>
          {picture && <div data-lever="mat-pictures" className="mb-2 flex justify-center"><MatPictureView picture={picture} /></div>}
          <LuminaDropZone state={zoneState} className="min-h-[64px] pointer-events-none content-center justify-center">
            {item.showBinCounts && placed > 0 && (
              <LuminaBadge className="bg-white/10 border-white/10 text-slate-200 text-xs">{placed}</LuminaBadge>
            )}
          </LuminaDropZone>
        </div>;
      })}
    </div>
  );

  /** The model card a help lever put beside the session item. */
  const renderModel = () => {
    if (practice) return null;
    const shape = on(MODEL_SHAPE) ? modelShapeFor(sessionItem, items) : null;
    if (shape) return <ModelCard lever={MODEL_SHAPE} shape={shape} />;
    const object = on(MODEL_OBJECT) ? modelObjectFor(sessionItem, items) : null;
    if (object) return <ModelCard lever={MODEL_OBJECT} shape={object.shape} objectId={object.id} />;
    const counted = on(MODEL_COUNT) ? modelCountFor(sessionItem, items) : null;
    if (counted) return <ModelCard lever={MODEL_COUNT} shape={counted} marks={sessionItem.countNoun === 'corners' ? 'corners' : 'sides'} />;
    return null;
  };

  const promptFor = (): string => {
    if (item.mode === 'count') return `Count this shape's ${item.countNoun ?? 'sides'}.`;
    if (item.mode === 'sort') return 'Say which group the gold-ringed shape belongs to.';
    if (item.realObjectId) return 'Name the shape you see in this everyday object.';
    return 'Name the shape inside the gold ring.';
  };

  const isRealObject = item.mode === 'identify' && !!item.realObjectId;

  return <LuminaCard className={className}>
    <LuminaCardHeader><LuminaCardTitle>{data.title}</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {summary ? <PhaseSummaryPanel heading="Shape Work Complete!" celebrationMessage="You worked out every shape!"
        phases={summary.outcomes.map((outcome, index) => ({ label: `Shape ${index + 1}`, score: outcome.score,
          attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'purple' as const }))} /> : <>
        <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
        {practice && <div className="text-center text-xs text-amber-300" data-practice-item>Practice shape</div>}
        <p className="text-center text-slate-200">{promptFor()}</p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {item.mode === 'count' ? renderCount() : isRealObject ? renderRealObject() : renderPool()}
          {renderModel()}
        </div>
        {item.mode === 'sort' && renderMats()}
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
        <p className="text-center text-sm text-slate-400">Say your answer, or ask for help.</p>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
