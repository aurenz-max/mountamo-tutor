'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase';
import { authApi } from '@/lib/authApiClient';
import { useStudent } from '../contexts/StudentContext';
import { fetchGenerationContext } from '../service/studentContext/fetchGenerationContext';
import { ExhibitProvider } from '../contexts/ExhibitContext';
import { LuminaAIProvider } from '@/contexts/LuminaAIContext';
import SavedLearningObservations from './SavedLearningObservations';
import BaseTenBlocks, { type BaseTenBlocksData } from '../primitives/visual-primitives/math/BaseTenBlocks';
import LearningResponsePreview from './LearningResponsePreview';
import { TesterWorkspace } from './live-activity/TesterWorkspace';
import { EvaluationProvider, useRequiredEvaluationContext } from '../evaluation/contexts/EvaluationContext';
import PlaceValueChart, { type PlaceValueChartData } from '../primitives/visual-primitives/math/PlaceValueChart';
import { LuminaButton, LuminaCard, LuminaCardContent, LuminaCardHeader, LuminaCardTitle } from '../ui';

const topic = 'Place value in four-digit whole numbers';
const skillId = 'NBT004-01';
const subskillId = 'NBT004-01-b';
type SavedStatus = { status: string; revision: number | null; scopeCompatible: boolean;
  lastDetectedAt: string | null; resolvedAt: string | null; resolvedAttemptId: string | null };

function TesterActivity({ onBack }: { onBack: () => void }) {
  const evaluation = useRequiredEvaluationContext();
  const { studentId } = useStudent();
  const [data, setData] = useState<PlaceValueChartData | null>(null);
  const [blocks, setBlocks] = useState<BaseTenBlocksData | null>(null);
  const [saved, setSaved] = useState<SavedStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const result = await authApi.get<SavedStatus>(`/api/student-profile/misconception-status?primitive_type=place-value-chart&skill_id=${skillId}`);
      if (alive.current) { setSaved(result); setError(''); }
    } catch { if (alive.current) setError('Could not read saved status. Check sign-in and the backend connection.'); }
  }, []);
  useEffect(() => { alive.current = true; void refresh(); return () => { alive.current = false; }; }, [refresh]);
  // Capture follows submission asynchronously. Poll briefly, then allow manual refresh.
  useEffect(() => {
    if (!evaluation.submittedResults.length) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 2500);
    const stop = setTimeout(() => clearInterval(timer), 30000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [evaluation.submittedResults.length, refresh]);
  const activeId = data?.instanceId ?? blocks?.instanceId;
  const completed = !!activeId && evaluation.submittedResults.some(r => r.instanceId === activeId);
  const failed = evaluation.failedSubmissions.length > 0;
  const captureStatus = activeId ? evaluation.captureStatuses?.[activeId] : undefined;
  const learningStatus = activeId ? evaluation.learningCaptureStatuses?.[activeId] : undefined;
  async function generate(componentId: 'place-value-chart' | 'base-ten-blocks' = 'place-value-chart') {
    setBusy(true); setError('');
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Sign in before starting this tester.');
      const instanceId = crypto.randomUUID();
      // Same launch step as a lesson: the backend signs this learner's observations for the
      // pinned objective once, and generation reads the packet instead of calling the backend.
      const context = await fetchGenerationContext({ studentId: String(studentId), topic, gradeLevel: '4', subject: 'MATHEMATICS', includePersona: false,
        objectives: [{ id: 'place-value-loop-objective', text: 'Identify digit place and numeric value in four-digit whole numbers', verb: 'identify', subskillId, skillId, grade: '4' }] });
      const response = await fetch('/api/lumina', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: 'generateComponentContent', params: {
          componentId, instanceId, topic, gradeLevel: 'Grade 4',
          config: { targetEvalMode: componentId === 'base-ten-blocks' ? 'read_blocks' : 'compare', difficulty: 'medium', objectiveGrade: '4', objectiveSubject: 'MATHEMATICS', skillId, subskillId,
            objectiveText: 'Identify digit place and numeric value in four-digit whole numbers' },
        }, learningObservations: context?.learningObservations ?? null }),
      });
      if (!response.ok) throw new Error(`Generation failed (HTTP ${response.status}).`);
      const result = await response.json();
      if (componentId === 'base-ten-blocks') {
        if (result.data?.supportTier !== 'medium' || !result.data?.challenges?.length
          || !result.data.challenges.every((c: { type: string }) => c.type === 'read_blocks'))
          throw new Error('Generation did not preserve the pinned read_blocks / medium task.');
        if (alive.current) { setData(null); setBlocks({ ...result.data, instanceId, skillId, subskillId,
          objectiveId: 'place-value-loop-objective', exhibitId: evaluation.exhibitId }); }
        await refresh();
        return;
      }
      if (result.data?.challengeType !== 'compare' || result.data?.supportTier !== 'medium')
        throw new Error('Generation did not preserve the pinned compare / medium task.');
      if (alive.current) { setBlocks(null); setData({ ...result.data, instanceId, skillId, subskillId,
        objectiveId: 'place-value-loop-objective', exhibitId: evaluation.exhibitId }); }
      await refresh();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Generation failed.'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <div className="mx-auto w-full max-w-6xl space-y-5 p-6">
    <LuminaButton onClick={onBack}>Back to developer tools</LuminaButton>
    <LuminaCard>
      <LuminaCardHeader><LuminaCardTitle>Misconception Loop Tester</LuminaCardTitle></LuminaCardHeader>
      <LuminaCardContent className="space-y-4">
        <p>{blocks ? 'Base-ten blocks · read_blocks' : 'Place Value Chart · compare'} · Grade 4 · medium · {subskillId}</p>
        <p className="text-sm text-slate-300">Uses the signed-in learner. Completed activities go through normal submission and update learning records. Use a designated test account for intentional mistakes. This tester pins the task; it does not test planner selection.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Generate an activity and answer through the microphone and chart.</li>
          <li>Finish it. Wait for submission, then refresh the saved diagnosis; diagnosis may abstain.</li>
          <li>If an active diagnosis is recorded, generate the next activity. Check whether a verification receipt was issued.</li>
          <li>Complete the fresh activity and inspect the saved result. Corrected answers do not count as independent retest evidence.</li>
        </ol>
        <div className="flex flex-wrap gap-3">
          <LuminaButton tone="primary" onClick={() => generate()} disabled={busy || failed || (!!activeId && !completed)}>
            {busy ? 'Generating…' : activeId ? 'Generate next activity' : 'Generate first activity'}
          </LuminaButton>
          <LuminaButton onClick={() => { void refresh(); }}>Refresh saved status</LuminaButton>
          <LuminaButton onClick={() => generate('base-ten-blocks')} disabled={busy || failed || (!!activeId && !completed)}>
            Generate blocks from the same hypothesis
          </LuminaButton>
        </div>
        <p className="text-sm text-slate-300">For the digit-worth bridge, try blocks first, then the next chart activity. Both receive saved observations from this skill: the active Place Value hypothesis, and one a failed blocks read can now save. Place-name confusion alone does not target the blocks activity.</p>
        <div role="status" className="space-y-1 text-sm">
          {blocks && <p>Base-ten blocks · read_blocks · medium. {blocks.learningAdaptation?.source === 'saved-observation'
            ? `A saved observation selected a block count/worth contrast: ${blocks.learningAdaptation.status}, ${blocks.learningAdaptation.comparisonCount} examples.`
            : 'No compatible saved observation targeted this activity.'} This bridge does not certify resolution or transfer.</p>}
          <p>Strengths/support capture: {learningStatus ? `${learningStatus.stage} — ${learningStatus.message}` : 'Waiting for submitted response evidence.'}</p>
          <p>Observation capture: {captureStatus ? `${captureStatus.stage} — ${captureStatus.message}` : 'Waiting for a completed activity to reach the submission API.'}</p>
          <p>Saved diagnosis: <strong>{saved?.status ?? 'Loading…'}</strong>{saved?.revision ? ` · revision ${saved.revision}` : ''}</p>
          {saved?.status === 'active' && !saved.scopeCompatible && <p>This diagnosis has an older or incompatible scope; the backend will not resolve it with this activity.</p>}
          <p>Current activity: {data ? data.misconceptionOpportunity ? 'Verification receipt issued' : 'No verification receipt — not a certified resolution test' : blocks ? 'Block representation bridge; no resolution receipt' : 'Not generated'}</p>
          {data?.learningAdaptation && <p>Generation adaptation: {data.learningAdaptation.status === 'insufficient-capacity'
            ? 'The selected activity could not fit two contrast examples; no full adaptation is claimed.'
            : `${data.learningAdaptation.status === 'already-targeted' ? 'The activity already contains' : 'Selected'} ${data.learningAdaptation.comparisonCount} examples pairing place names with numeric values across different positions.`}
            {' '}{data.learningAdaptation.source === 'saved-observation' ? 'Driven by your saved observation.' : 'Driven by generation input.'} This adaptation is not a certified resolution check.</p>}
          <p>Submission: {failed ? 'Failed — do not repeat the submission blindly; inspect whether an attempt was stored' : completed ? 'Accepted by the submission API; checking saved diagnosis' : evaluation.pendingSubmissions.length ? 'Submitting…' : 'Waiting for completion'}</p>
          {saved?.resolvedAt && <p>Resolved at: {saved.resolvedAt}</p>}
          {saved?.resolvedAttemptId && <p className="break-all">Backend resolution attempt: {saved.resolvedAttemptId}</p>}
        </div>
        {error && <p role="alert" className="text-rose-300">{error}</p>}
      </LuminaCardContent>
    </LuminaCard>
    {data && <PlaceValueChart key={data.instanceId} data={data} />}
    {/* base-ten-blocks runs only on the teaching workspace: bound like any tester preview. */}
    {blocks && <TesterWorkspace key={blocks.instanceId} primitiveId="base-ten-blocks" instanceId={blocks.instanceId ?? 'blocks'}
      evalMode="read_blocks" data={blocks} topic={topic} gradeLevel="Grade 4">
      <BaseTenBlocks data={blocks} runtimeEvalMode="read_blocks" />
    </TesterWorkspace>}
    {activeId && evaluation.submittedResults.filter(r => r.instanceId === activeId).map(result =>
      <LearningResponsePreview key={result.attemptId} result={result} />)}
    <SavedLearningObservations />
  </div>;
}

export default function MisconceptionLoopTester({ onBack }: { onBack: () => void }) {
  const { studentId, ready, isAnonymous } = useStudent();
  const [sessionId] = useState(() => crypto.randomUUID());
  if (!ready || isAnonymous) return <div className="space-y-4 p-8"><LuminaButton onClick={onBack}>Back</LuminaButton><p>Sign in to use the authenticated misconception tester.</p></div>;
  return <EvaluationProvider key={studentId} sessionId={sessionId} exhibitId={`misconception-loop-${sessionId}`}
    studentId={String(studentId)} topic={topic} gradeLevel="4" curriculumSubject="MATHEMATICS"
    curriculumSkillId={skillId} curriculumSubskillId={subskillId}
    maxRetries={0} autoFlushInterval={0} persistToStorage={false}>
    <ExhibitProvider objectives={[]} manifestItems={[]}>
      <LuminaAIProvider>
        <TesterActivity onBack={onBack} />
      </LuminaAIProvider>
    </ExhibitProvider>
  </EvaluationProvider>;
}
