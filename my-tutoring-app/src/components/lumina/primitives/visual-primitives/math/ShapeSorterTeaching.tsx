'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle, LuminaChallengeCounter,
  LuminaReadAloudGlyph } from '../../../ui';
import PhaseSummaryPanel from '../../../components/PhaseSummaryPanel';
import { useTeachingWorkspace, type TeachingWorkspace } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { itemsFromChallenges, workspaceAssignment, workspaceScene } from './shapeSorterDomain';
import { renderShapeSVG } from './shapeSorterDrawing';
import type { ShapeSorterMetrics } from '../../../evaluation/types';
import { useTeachingEvaluation } from '../../../components/live-activity/runtime/useTeachingEvaluation';
import type { ShapeSorterProps } from './ShapeSorter';

/** Naming pilot: geometry and scene binding only. Conversation and progression are shared. */
export default function ShapeSorterTeaching({ data, className, runtimePlanItemId, runtimeEvalMode }: ShapeSorterProps) {
  const items = useMemo(() => itemsFromChallenges(data.challenges, { isPreReader: (data.gradeBand ?? 'K') === 'K' }), [data.challenges, data.gradeBand]);
  if (!items.length || items.some(item => item.mode !== 'identify' || item.realObjectId)) {
    return <LuminaCard><LuminaCardContent>These naming challenges are still being drawn. Try generating them again.</LuminaCardContent></LuminaCard>;
  }
  return <NamingWorkspace key={data.instanceId} data={data} items={items} className={className}
    runtimePlanItemId={runtimePlanItemId} runtimeEvalMode={runtimeEvalMode} />;
}

function NamingWorkspace({ data, items, className, runtimePlanItemId, runtimeEvalMode }: ShapeSorterProps & {
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
    metrics: result => ({ type: 'shape-sorter', evalMode, identifyAccuracy: result.accuracy, countAccuracy: 0,
      sortAccuracy: 0, attemptsCount: result.attemptsCount }) });
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
  const cols = Math.min(shapes.length, 4), cell = 108;
  const summary = lesson.summary;
  return <LuminaCard className={className}>
    <LuminaCardHeader><LuminaCardTitle>{data.title}</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      {summary ? <PhaseSummaryPanel heading="Shape Work Complete!" celebrationMessage="You named the shapes!"
        phases={summary.outcomes.map((outcome, index) => ({ label: `Shape ${index + 1}`, score: outcome.score,
          attempts: outcome.attempts, firstTry: outcome.corrections === 0, accentColor: 'purple' as const }))} /> : <>
        <LuminaChallengeCounter current={lesson.state.index + 1} total={items.length} variant="dots" />
        <p className="text-center text-slate-200">Name the shape inside the gold ring.</p>
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
        <div className="flex justify-center"><LuminaReadAloudGlyph size={22} speaking={lesson.tutorSpeaking} /></div>
        <p className="text-center text-sm text-slate-400">Say your answer, or ask for help.</p>
      </>}
    </LuminaCardContent>
  </LuminaCard>;
}
