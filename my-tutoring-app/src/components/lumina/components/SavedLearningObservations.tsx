'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { authApi } from '@/lib/authApiClient';
import { useStudent } from '../contexts/StudentContext';
import type { LearningObservation } from '../evaluation/learningObservations';
import LearningObservationsPanel from './LearningObservationsPanel';

export default function SavedLearningObservations({ studentId }: { studentId?: number }) {
  const student = useStudent();
  const owner = student.ready && !student.isAnonymous && (studentId === undefined || String(studentId) === String(student.studentId));
  const [data, setData] = useState<{ ownerId: string; observations: LearningObservation[] } | null>(null);
  const [status, setStatus] = useState('Loading saved learning observations…');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(r => r + 1), []);
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    setStatus('Loading saved learning observations…');
    authApi.get<{ observations: LearningObservation[]; legacyCount?: number }>('/api/student-profile/learning-observations')
      .then(result => {
        if (cancelled) return;
        if (!Array.isArray(result.observations)) throw new Error('Invalid observation response');
        setData({ ownerId: String(student.studentId), observations: result.observations });
        setStatus(result.observations.length ? 'Saved problem and phase observations. Refresh after completing an activity.'
          : result.legacyCount ? `${result.legacyCount} earlier diagnosis record(s) exist, but they do not contain inspectable problem and phase evidence. Complete a new activity to collect that evidence; refreshing cannot reconstruct it.`
          : 'No structured observations saved yet. Activities that provide enough response evidence can save tentative patterns, strengths or support observations. Scores alone and LLM abstentions do not create records. The tester shows each capture outcome.');
      }).catch(() => { if (!cancelled) setStatus('Could not refresh saved observations. Previously loaded observations may be out of date.'); });
    return () => { cancelled = true; };
  }, [owner, student.studentId, revision]);
  useEffect(() => {
    window.addEventListener('lumina-learning-observations-updated', refresh);
    return () => window.removeEventListener('lumina-learning-observations-updated', refresh);
  }, [refresh]);
  return <LearningObservationsPanel observations={owner && data?.ownerId === String(student.studentId) ? data.observations : []}
    loadStatus={owner ? status : 'Sign in as the profile owner to inspect saved observations.'} onRefresh={owner ? refresh : undefined} />;
}
