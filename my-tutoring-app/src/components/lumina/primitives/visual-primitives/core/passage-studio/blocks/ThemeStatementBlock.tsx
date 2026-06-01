'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import BlockShell from './BlockShell';
import { SoundManager } from '../../../../../utils/SoundManager';
import {
  LuminaButton,
  LuminaActionButton,
  LuminaBadge,
  LuminaPanel,
  LuminaFeedbackCard,
  LuminaSectionLabel,
  type LuminaAccent,
  type FeedbackStatus,
} from '../../../../../ui';
import type {
  ThemeStatementBlockData,
  ThemeRubricVerdict,
  PassageStimulus,
} from '../types';

interface ThemeStatementBlockProps {
  data: ThemeStatementBlockData;
  /** Stimulus context — passed to the rubric judge so it can ground feedback. */
  stimulus: PassageStimulus;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

type Phase =
  | { kind: 'writing' }
  | { kind: 'judging' }
  | { kind: 'judge-error'; message: string }
  | { kind: 'reveal'; verdict: ThemeRubricVerdict };

const VERDICT_TO_LABEL: Record<
  ThemeRubricVerdict['verdict'],
  { label: string; accent: LuminaAccent; status: FeedbackStatus }
> = {
  strong: { label: 'Strong response', accent: 'emerald', status: 'correct' },
  partial: { label: 'Partial response', accent: 'amber', status: 'insight' },
  weak: { label: 'Needs more', accent: 'rose', status: 'incorrect' },
};

const ThemeStatementBlock: React.FC<ThemeStatementBlockProps> = ({
  data,
  stimulus,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [response, setResponse] = useState('');
  const [phase, setPhase] = useState<Phase>(answeredProp ? { kind: 'writing' } : { kind: 'writing' });
  const [attempts, setAttempts] = useState(0);

  const minLength = data.minLength ?? 30;
  const maxLength = data.maxLength ?? 500;
  const charCount = response.length;
  const tooShort = charCount < minLength;

  const handleSubmit = useCallback(async () => {
    if (tooShort || phase.kind !== 'writing') return;
    const next = attempts + 1;
    setAttempts(next);
    setPhase({ kind: 'judging' });

    try {
      const apiResponse = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'judgePassageRubric',
          params: {
            stimulusText: stimulus.text,
            stimulusKind: stimulus.kind,
            prompt: data.prompt,
            rubric: data.rubric,
            exemplar: data.exemplar,
            studentResponse: response,
          },
        }),
      });

      if (!apiResponse.ok) {
        const err = await apiResponse.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Rubric judge failed');
      }

      const verdict = (await apiResponse.json()) as ThemeRubricVerdict;
      setPhase({ kind: 'reveal', verdict });

      const success = verdict.verdict === 'strong';
      if (success) SoundManager.playCorrect();
      else SoundManager.playIncorrect();
      onAnswer(data.id, success, next);
    } catch (error) {
      setPhase({
        kind: 'judge-error',
        message: error instanceof Error ? error.message : 'Failed to evaluate response',
      });
    }
  }, [tooShort, phase.kind, attempts, stimulus, data, response, onAnswer]);

  const cancelJudge = useCallback(() => {
    if (phase.kind === 'judging' || phase.kind === 'judge-error') {
      setPhase({ kind: 'writing' });
    }
  }, [phase.kind]);

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="rose">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-rose-300/80 font-semibold mb-1">
            Open response
          </p>
          <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.prompt}</p>
        </div>

        {/* Rubric criteria preview — student knows what they're being judged on */}
        <LuminaPanel className="p-3 space-y-1.5">
          <LuminaSectionLabel size="sm" accent="rose">
            Looking for
          </LuminaSectionLabel>
          <ul className="space-y-1">
            {data.rubric.map((criterion, i) => (
              <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                <span className="text-rose-300/60 mt-0.5">▎</span>
                <span>
                  <span className="font-medium text-slate-200">{criterion.label}.</span>{' '}
                  <span className="text-slate-400">{criterion.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </LuminaPanel>

        {phase.kind !== 'reveal' && (
          <>
            <textarea
              value={response}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) setResponse(e.target.value);
              }}
              disabled={phase.kind === 'judging'}
              placeholder="Write 1–3 sentences…"
              className="w-full min-h-[100px] px-4 py-3 text-sm bg-slate-950/60 text-slate-100 rounded-xl border border-white/10 focus:border-rose-400/40 focus:outline-none focus:ring-1 focus:ring-rose-400/30 resize-y disabled:opacity-60"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={tooShort ? 'text-slate-500' : 'text-emerald-400/70'}>
                {charCount}/{maxLength} characters
                {tooShort && <span className="ml-2 text-amber-400/70">— minimum {minLength}</span>}
              </span>
              <LuminaActionButton
                action="check"
                size="sm"
                onClick={handleSubmit}
                disabled={tooShort || phase.kind === 'judging'}
                className="gap-2"
              >
                {phase.kind === 'judging' && <Loader2 size={14} className="animate-spin" />}
                {phase.kind === 'judging' ? 'Evaluating…' : 'Submit response'}
              </LuminaActionButton>
            </div>
          </>
        )}

        {phase.kind === 'judge-error' && (
          <LuminaPanel accent="amber" className="flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-200 font-medium">Couldn&apos;t evaluate your response</p>
              <p className="text-xs text-amber-300/70 mt-0.5">{phase.message}</p>
              <div className="mt-2 flex gap-2">
                <LuminaActionButton action="retry" size="sm" onClick={handleSubmit}>
                  Try again
                </LuminaActionButton>
                <LuminaButton size="sm" onClick={cancelJudge}>
                  Back to writing
                </LuminaButton>
              </div>
            </div>
          </LuminaPanel>
        )}

        {phase.kind === 'reveal' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <LuminaBadge accent={VERDICT_TO_LABEL[phase.verdict.verdict].accent}>
                {VERDICT_TO_LABEL[phase.verdict.verdict].label}
              </LuminaBadge>
              <span className="text-xs text-slate-500 font-mono">{phase.verdict.score}/100</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            </div>

            <LuminaPanel className="space-y-2">
              <LuminaSectionLabel size="sm" accent="rose">
                Your response
              </LuminaSectionLabel>
              <p className="text-sm text-slate-200 leading-relaxed italic">&ldquo;{response}&rdquo;</p>
            </LuminaPanel>

            <div className="space-y-2">
              {phase.verdict.criterionScores.map((cs, i) => (
                <LuminaPanel key={i} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-slate-200">{cs.label}</span>
                    <span
                      className={`font-mono ${
                        cs.score >= 7 ? 'text-emerald-300' : cs.score >= 4 ? 'text-amber-300' : 'text-rose-300'
                      }`}
                    >
                      {cs.score}/10
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{cs.feedback}</p>
                </LuminaPanel>
              ))}
            </div>

            <LuminaFeedbackCard
              status={VERDICT_TO_LABEL[phase.verdict.verdict].status}
              label="Overall feedback"
            >
              {phase.verdict.summary}
            </LuminaFeedbackCard>

            <LuminaPanel accent="emerald" className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <LuminaSectionLabel size="sm" accent="emerald">
                  Exemplar response
                </LuminaSectionLabel>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed italic">&ldquo;{data.exemplar}&rdquo;</p>
            </LuminaPanel>
          </div>
        )}
      </div>
    </BlockShell>
  );
};

export default ThemeStatementBlock;
