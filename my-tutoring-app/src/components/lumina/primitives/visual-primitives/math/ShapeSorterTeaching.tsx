'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaBadge, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaDropZone, LuminaReadAloudGlyph, type DropZoneState } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { itemsFromChallenges, workspaceAssignment, workspaceScene } from './shapeSorterDomain';
import { renderShapeSVG } from './shapeSorterDrawing';
import RealWorldShapeObject from '../shared/RealWorldShapeObject';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { ShapeSorterProps } from './ShapeSorter';

const MAT_COLORS = ['text-cyan-300', 'text-purple-300', 'text-amber-300'];

/** Naming (plain and real-object), counting and sorting: geometry and scene binding
 *  only. Conversation and progression are shared. */
export default function ShapeSorterTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: ShapeSorterProps) {
  const items = useMemo(() => itemsFromChallenges(data.challenges, { isPreReader: (data.gradeBand ?? 'K') === 'K' }), [data.challenges, data.gradeBand]);
  if (!items.length) {
    return <LuminaCard><LuminaCardContent>These shape challenges are still being drawn. Try generating them again.</LuminaCardContent></LuminaCard>;
  }
  return <ShapesWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function ShapesWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }: ShapeSorterProps & {
  items: ReturnType<typeof itemsFromChallenges>;
}) {
  const instance = useRef(data.instanceId || `shape-sorter-${Date.now()}`);
  const workspace = useRef<TeachingWorkspace | null>(null);
  const [marks, mark] = useState<string[]>([]);
  const assignments = useMemo(() => items.map(item => ({ ...workspaceAssignment(item), checkResponse: () => null })), [items]);
  const evalMode = runtimeEvalMode || 'identify';
  const lesson = useTeachingWorkspace({ instanceId: instance.current, primitiveId: 'shape-sorter',
    objectiveId: data.objectiveId, planItemId: runtimePlanItemId, evalMode, items: assignments, workspace });
  useTeachingEvaluation<ShapeSorterMetrics>({ primitiveType: 'shape-sorter', instanceId: instance.current,
    data, assignments, lesson, evalMode,
    metrics: result => {
      const scoreFor = (mode: 'identify' | 'count' | 'sort') => {
        const scores = result.outcomes.filter(o => items.find(i => i.id === o.id)?.mode === mode).map(o => o.score);
        return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      };
      return { type: 'shape-sorter', evalMode, identifyAccuracy: scoreFor('identify'),
        countAccuracy: scoreFor('count'), sortAccuracy: scoreFor('sort'), attemptsCount: result.attemptsCount };
    } });
  const item = items[lesson.state.index];
  const shapes = data.challenges.find(c => c.id === item.challengeId)!.shapes;
  useLayoutEffect(() => {
    workspace.current = {
      ...workspaceScene(item, shapes),
      demonstration: marks,
      readyForResponse: true, canDemonstrate: true, canPresent: false, mark, clearPresentation: () => mark([]),
    };
    lesson.publishWorkspace();
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
            {renderShapeSVG(shape.shape, x, y, 40 * ({ small: .6, medium: 1, large: 1.4 }[shape.size]),
              shape.color, shape.rotation, { dimmed: !current && !marked })}
          </g>;
        })}
      </svg>
    </div>
  );

  const renderCount = () => {
    const shape = shapes[item.shapeIndex];
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    return <div className="flex justify-center">
      <svg data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true" data-pip-object="shape"
        data-tutor-demonstration={marked} width={220} height={220} viewBox="0 0 220 220" role="img" aria-label="Shape to count">
        <circle cx={110} cy={110} r={100} fill="none" stroke="#fbbf24" strokeWidth={3} />
        {marked && <circle cx={110} cy={110} r={106} fill="none" stroke="#c084fc" strokeWidth={3} strokeDasharray="5 4" />}
        {renderShapeSVG(shape.shape, 110, 110, 88, shape.color, shape.rotation, { showCorners: item.showCornerHints })}
      </svg>
    </div>;
  };

  const renderRealObject = () => {
    const marked = marks.includes(`shape-${item.shapeIndex}`);
    return item.realObjectId ? <div data-shape-id={`shape-${item.shapeIndex}`} data-assignment-target="true"
      data-pip-object="shape" data-tutor-demonstration={marked}
      className={`flex justify-center rounded-2xl border p-5 ${marked ? 'border-purple-400/50 bg-purple-500/10' : 'border-amber-400/40 bg-amber-500/5'}`}>
      <RealWorldShapeObject objectId={item.realObjectId} className="h-48 w-48" />
    </div> : null;
  };

  const renderMats = () => (
    <div className={`grid gap-4 ${item.choices.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {item.choices.map((label, idx) => {
        const placed = placedByChoice.get(label) ?? 0;
        const marked = marks.includes(`mat-${idx}`);
        const zoneState: DropZoneState = marked ? 'correct' : placed > 0 ? 'filled' : 'idle';
        return <div key={label} data-shape-id={`mat-${idx}`} data-tutor-demonstration={marked} className="w-full">
          <h3 className={`mb-2 text-center font-bold text-sm ${MAT_COLORS[idx] ?? MAT_COLORS[0]}`}>{label}</h3>
          <LuminaDropZone state={zoneState} className="min-h-[64px] pointer-events-none content-center justify-center">
            {item.showBinCounts && placed > 0 && (
              <LuminaBadge className="bg-white/10 border-white/10 text-slate-200 text-xs">{placed}</LuminaBadge>
            )}
          </LuminaDropZone>
        </div>;
      })}
    </div>
  );

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
        <p className="text-center text-slate-200">{promptFor()}</p>
        {item.mode === 'count' ? renderCount() : isRealObject ? renderRealObject() : renderPool()}
        {item.mode === 'sort' && renderMats()}
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
        <p className="text-center text-sm text-slate-400">Say your answer, or ask for help.</p>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
