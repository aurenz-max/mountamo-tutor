'use client';

import React, { useMemo } from 'react';
import type { BarModelChallenge } from './BarModel';
import { graphExplanationPack } from './barModelExplanationScript';
import { useJudgedScriptRunner, type JudgedRunSummary } from '../../../hooks/useJudgedScriptRunner';
import JudgedMicPanel from '../../../components/JudgedMicPanel';

export default function BarModelExplanation({ challenge, instanceId, exhibitId, onFinished }: {
  challenge: BarModelChallenge; instanceId: string; exhibitId?: string;
  onFinished: (summary: JudgedRunSummary) => void;
}) {
  const pack = useMemo(() => graphExplanationPack(challenge), [challenge]);
  const runner = useJudgedScriptRunner({ pack, instanceId, exhibitId, gradeLevel: 'Kindergarten', onFinished });
  if (!pack.items.length) return <p>This graph could not make a comparison. Please generate it again.</p>;
  return <div className="space-y-3">
    <button type="button" onClick={runner.hearStimulus} aria-label="Hear the graph question again"
      className="block mx-auto rounded-full border border-cyan-300/30 px-4 py-2 text-cyan-200">Hear the question</button>
    <JudgedMicPanel run={runner} />
  </div>;
}
