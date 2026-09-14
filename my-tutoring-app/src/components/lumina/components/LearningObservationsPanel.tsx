'use client';

import React, { useState } from 'react';
import { LuminaBadge, LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle } from '../ui';
import { buildLearningContext, selectLearningObservations } from '../evaluation/learningObservations';
import type { LearningObservation } from '../evaluation/learningObservations';
import { sampleActivity, sampleLearningObservations } from '../evaluation/learningObservations.fixture';

/** Shared profile/tester preview. Fixtures never enter live generation or submission. */
export default function LearningObservationsPanel({ observations = [], loadStatus = 'Saved learning observations are not connected to this view yet. This does not mean your learning history is empty.', onRefresh, draft = false }: {
  observations?: LearningObservation[]; loadStatus?: string; onRefresh?: () => void; draft?: boolean;
}) {
  const [showSample, setShowSample] = useState(false);
  const [grade, setGrade] = useState('4');
  const [includeContext, setIncludeContext] = useState(true);
  const [destination, setDestination] = useState<'generation' | 'evaluation'>('generation');
  const activity = grade === '4' ? sampleActivity : { ...sampleActivity, grade: '3', subskillId: 'NBT003-02-a' };
  const visibleObservations = showSample ? sampleLearningObservations : observations;
  const decisions = selectLearningObservations(visibleObservations, activity);
  const context = buildLearningContext(includeContext ? visibleObservations : [], activity);

  return <LuminaCard topAccent="purple">
    <LuminaCardHeader><LuminaCardTitle>Learning observations</LuminaCardTitle></LuminaCardHeader>
    <LuminaCardContent className="space-y-5">
      <p className="text-sm text-slate-300">What your responses can tell us, the evidence behind it, and how it could help your next activity.</p>
      <p className="text-sm text-slate-400" role="status">{loadStatus}</p>
      {onRefresh && <LuminaButton onClick={onRefresh}>Refresh learning observations</LuminaButton>}
      <LuminaButton aria-expanded={showSample} onClick={() => setShowSample(!showSample)}>
        {showSample ? 'Close sample preview' : 'Explore a sample learning profile'}
      </LuminaButton>
      {(showSample || observations.length > 0) && <div className="space-y-5">
        <div role="status" className="space-y-2">
          <LuminaBadge accent={showSample || draft ? 'amber' : 'emerald'}>{showSample ? 'Sample profile' : draft ? 'Unsaved observation preview' : 'Saved observations'}</LuminaBadge>
          <p className="text-sm text-amber-200">{showSample ? 'Fictional evidence, not your results. Preview only: nothing here is saved or sent to Gemini.' : draft ? 'Distilled from this activity’s recorded responses. This tentative observation is not saved or used to change your next activity.' : 'Distilled from submitted activity evidence. These are hypotheses, not mastery judgments. The context preview below does not send a new Gemini request.'}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {decisions.map(({ observation: o, selected, reason }) => <LuminaCard key={o.id}>
            <LuminaCardContent className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-2">
                <LuminaBadge accent={o.kind === 'strength' ? 'emerald' : 'purple'}>{o.kind}</LuminaBadge>
                <LuminaBadge accent="cyan">{o.status}</LuminaBadge>
              </div>
              <p className="text-slate-100">{o.summary}</p>
              <p className="text-xs text-slate-400">Grade {o.grade} · Updated {o.updatedAt}</p>
              <details className="text-sm">
                <summary className="cursor-pointer text-cyan-200">Inspect evidence ({o.evidence.length})</summary>
                {o.problem && <p className="mt-3 text-slate-300">Problem: {o.problem} · {o.primitiveType} · {o.evalMode}</p>}
                {o.evidence.map((e, index) => <div key={`${e.attemptId}:${e.itemId ?? ''}:${index}`} className="mt-3 space-y-1 border-l border-white/20 pl-3">
                  <p>{e.task}</p><p>Response: {e.response}</p>
                  {e.phase && <p className="text-xs text-cyan-200">Phase: {e.phase}</p>}
                  <p className="text-slate-400">{e.support}</p>
                  <p className="text-xs text-slate-500">Reference: {e.attemptId}</p>
                  {e.referenceKind === 'client-attempt' && <p className="text-xs text-slate-500">Client activity reference; canonical attempt join is not verified.</p>}
                </div>)}
                <p className="mt-3 text-slate-300">Teaching implication: {o.teachingImplication}</p>
                <p className="mt-2 text-slate-300">Next evidence to look for: {o.checkNext}</p>
              </details>
              <p className={selected && includeContext ? 'text-sm text-emerald-300' : 'text-sm text-slate-400'}>
                {selected && includeContext ? 'Selected' : 'Not selected'} · {selected && !includeContext ? 'Context switched off for comparison' : reason}
              </p>
            </LuminaCardContent>
          </LuminaCard>)}
        </div>
        <div className="space-y-3 border-t border-white/10 pt-5">
          <h3 className="text-lg text-slate-100">From selected activity to useful context</h3>
          <p className="text-sm text-slate-400">Simulate the point after manifest selection. Changing scope shows which observations stay relevant; it does not launch or change the live activity.</p>
          <label className="block text-sm text-slate-300">Activity scope
            <select aria-label="Activity scope" value={grade} onChange={e => setGrade(e.target.value)} className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-900 p-3 text-slate-100">
              <option value="4">Place Value Chart · Grade 4 · four-digit place and value</option>
              <option value="3">Place Value Chart · Grade 3 · three-digit place value</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeContext} onChange={e => setIncludeContext(e.target.checked)} />Include relevant observations in this preview</label>
          <p aria-live="polite" className="text-sm text-cyan-200">{context.generation.observations.length} of {visibleObservations.length} observations included</p>
          <div className="flex flex-wrap gap-2">
            <LuminaButton aria-pressed={destination === 'generation'} onClick={() => setDestination('generation')}>Generation context</LuminaButton>
            <LuminaButton aria-pressed={destination === 'evaluation'} onClick={() => setDestination('evaluation')}>Evaluation context</LuminaButton>
          </div>
          {destination === 'generation' ? <div className="space-y-2 text-sm text-slate-300">
            <p>Proposed changes to the next activity:</p>
            {context.generation.guidance.length ? <ul className="list-disc space-y-2 pl-5">{context.generation.guidance.map(g => <li key={g}>{g}</li>)}</ul> : <p>No observation-based adaptations. Keep the activity’s normal instructions.</p>}
          </div> : <p className="text-sm text-slate-300">{context.evaluation.instruction}</p>}
          <details><summary className="cursor-pointer text-sm text-cyan-200">Inspect proposed {destination} payload</summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950/70 p-4 text-xs text-slate-300">{JSON.stringify({ activity: context.activity, ...context[destination] }, null, 2)}</pre>
          </details>
          <p className="text-xs text-amber-200">Delivery: preview only. No request sent, no generated change verified, and no mastery or diagnosis status updated.</p>
        </div>
      </div>}
    </LuminaCardContent>
  </LuminaCard>;
}
