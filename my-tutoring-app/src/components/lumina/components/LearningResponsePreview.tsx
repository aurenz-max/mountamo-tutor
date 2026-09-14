'use client';

import React, { useState } from 'react';
import type { PrimitiveEvaluationResult } from '../evaluation/types';
import { eligibleLearningResponses, type LearningObservationDraft, type LearningResponseEvidence } from '../evaluation/learningResponseEvidence';
import type { LearningObservation } from '../evaluation/learningObservations';
import { LuminaButton } from '../ui';
import LearningObservationsPanel from './LearningObservationsPanel';

/** Mounted only in the developer tester. Ordinary submission owns evidence storage. */
export default function LearningResponsePreview({ result }: { result: PrimitiveEvaluationResult }) {
  const work = result.studentWork as { learningResponses?: LearningResponseEvidence[] } | undefined;
  const rows = work?.learningResponses ?? [];
  const eligible = eligibleLearningResponses(rows);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Review recorded responses before requesting a tentative observation.');
  const [observation, setObservation] = useState<LearningObservation | null>(null);
  async function distill() {
    setBusy(true); setObservation(null);
    setStatus('Examining the recorded responses…');
    try {
      const response = await fetch('/api/lumina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'distillLearningObservation', params: { evidence: rows } }) });
      if (!response.ok) throw new Error(`Observation request failed (HTTP ${response.status}).`);
      const draft: LearningObservationDraft = await response.json();
      if (draft.abstain) { setStatus(`No observation proposed: ${draft.reason}`); return; }
      setObservation({ id: `preview-${result.attemptId}`, kind: draft.kind, status: 'suspected',
        summary: draft.summary, teachingImplication: draft.teachingImplication, checkNext: draft.checkNext,
        subject: result.lessonContext?.curriculumSubject ?? '', grade: result.lessonContext?.gradeLevel ?? '',
        subskillId: result.subskillId ?? '', primitiveType: result.primitiveType,
        updatedAt: new Date().toISOString(),
        evidence: rows.filter(r => draft.evidenceItemIds.includes(r.itemId)).map(r => ({
          attemptId: result.attemptId, itemId: r.itemId, phase: r.phase, task: r.challenge,
          response: `${r.observed} (${r.source === 'voice' ? 'unverified transcription' : 'recorded manipulation'}; judge ${r.verdict})`, support: r.support,
        })),
      });
      setStatus('Tentative observation ready for review. Not saved; no generation or mastery update.');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Observation request failed.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3" aria-label="Successful response evidence">
    <h3 className="text-lg">Strengths and support from this activity</h3>
    <p className="text-sm text-slate-300">A passing score is not enough. This preview uses recorded responses and partial assistance history. Speech transcripts can be noisy.</p>
    <details><summary>Inspect recorded responses ({rows.length})</summary>
      {rows.map((r, index) => <div key={`${r.itemId}:${index}`} className="my-3 border-l border-white/20 pl-3 text-sm">
        <p>{r.challenge} · {r.phase}</p><p>Response: {r.observed} · Judge: {r.verdict}</p><p>{r.support}</p>
      </div>)}
    </details>
    {!eligible.length && <p>Need successful response evidence on two distinct items in the same phase. Missing transcripts and scores alone cannot support an observation.</p>}
    <LuminaButton onClick={distill} disabled={busy || !eligible.length}>{busy ? 'Examining responses…' : 'Preview strengths and support'}</LuminaButton>
    <p role="status">{status}</p>
    {observation && <LearningObservationsPanel observations={[observation]} loadStatus="Unsaved review of this activity only." draft />}
  </section>;
}
