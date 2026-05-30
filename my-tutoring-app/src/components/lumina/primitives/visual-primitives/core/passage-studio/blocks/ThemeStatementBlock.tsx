'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BlockShell from './BlockShell';
import { SoundManager } from '../../../../../utils/SoundManager';
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

const VERDICT_TO_LABEL: Record<ThemeRubricVerdict['verdict'], { label: string; color: string }> = {
  strong: { label: 'Strong response', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  partial: { label: 'Partial response', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  weak: { label: 'Needs more', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
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
        <div className="rounded-xl bg-slate-950/40 border border-white/5 p-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Looking for
          </p>
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
        </div>

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
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSubmit}
                disabled={tooShort || phase.kind === 'judging'}
                className="bg-rose-500/10 border border-rose-500/30 text-rose-200 hover:bg-rose-500/20 disabled:opacity-40 gap-2"
              >
                {phase.kind === 'judging' && <Loader2 size={14} className="animate-spin" />}
                {phase.kind === 'judging' ? 'Evaluating…' : 'Submit response'}
              </Button>
            </div>
          </>
        )}

        {phase.kind === 'judge-error' && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-200 font-medium">Couldn&apos;t evaluate your response</p>
              <p className="text-xs text-amber-300/70 mt-0.5">{phase.message}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSubmit}
                  className="bg-amber-500/15 border border-amber-500/30 text-amber-200 hover:bg-amber-500/25"
                >
                  Try again
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={cancelJudge}
                  className="bg-white/5 border border-white/20 text-slate-300 hover:bg-white/10"
                >
                  Back to writing
                </Button>
              </div>
            </div>
          </div>
        )}

        {phase.kind === 'reveal' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={VERDICT_TO_LABEL[phase.verdict.verdict].color}>
                {VERDICT_TO_LABEL[phase.verdict.verdict].label}
              </Badge>
              <span className="text-xs text-slate-500 font-mono">{phase.verdict.score}/100</span>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
              </span>
            </div>

            <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Your response
              </p>
              <p className="text-sm text-slate-200 leading-relaxed italic">&ldquo;{response}&rdquo;</p>
            </div>

            <div className="space-y-2">
              {phase.verdict.criterionScores.map((cs, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs"
                >
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
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-blue-400/80 font-semibold">
                Overall feedback
              </p>
              <p className="text-sm text-blue-200/90 leading-relaxed">{phase.verdict.summary}</p>
            </div>

            <div className="rounded-xl bg-slate-950/40 border border-emerald-500/20 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-emerald-400" />
                <p className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-semibold">
                  Exemplar response
                </p>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed italic">&ldquo;{data.exemplar}&rdquo;</p>
            </div>
          </div>
        )}
      </div>
    </BlockShell>
  );
};

export default ThemeStatementBlock;
