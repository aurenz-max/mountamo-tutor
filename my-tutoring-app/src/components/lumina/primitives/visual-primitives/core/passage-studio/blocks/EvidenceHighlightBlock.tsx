'use client';

import React, { useCallback, useMemo, useState } from 'react';
import BlockShell from './BlockShell';
import PassageRenderer, { type AnchorTone } from '../PassageRenderer';
import { SoundManager } from '../../../../../utils/SoundManager';
import {
  LuminaActionButton,
  LuminaBadge,
  LuminaFeedbackCard,
  LuminaSectionLabel,
} from '../../../../../ui';
import type { EvidenceHighlightBlockData, PassageStimulus } from '../types';

interface EvidenceHighlightBlockProps {
  data: EvidenceHighlightBlockData;
  /**
   * The full stimulus — this block renders its own copy of the passage with
   * candidate spans clickable, since the gating action is selection over the
   * text itself. (In stack layout the orchestrator's primary passage block
   * also renders the text; the duplication is intentional and pedagogically
   * sound — the student looks at THIS instance to make their selection.)
   */
  stimulus: PassageStimulus;
  onAnswer: (blockId: string, correct: boolean, attempts: number) => void;
  answered?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}

const EvidenceHighlightBlock: React.FC<EvidenceHighlightBlockProps> = ({
  data,
  stimulus,
  onAnswer,
  answered: answeredProp,
  innerRef,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [answered, setAnswered] = useState(answeredProp ?? false);
  const [showExplanation, setShowExplanation] = useState(false);

  const candidateMap = useMemo(() => {
    return new Map(data.candidateSpans.map((c, i) => [`cand-${i}`, c]));
  }, [data.candidateSpans]);

  const totalEvidence = data.candidateSpans.filter((c) => c.isEvidence).length;
  const minRequired = data.minCorrect ?? totalEvidence;

  const overlays = useMemo(() => {
    return Array.from(candidateMap.entries()).map(([key, c]) => {
      let tone: AnchorTone;
      if (answered) {
        const wasSelected = selectedKeys.has(key);
        if (c.isEvidence && wasSelected) tone = 'evidence-correct';
        else if (!c.isEvidence && wasSelected) tone = 'evidence-wrong';
        else if (c.isEvidence && !wasSelected) tone = 'evidence-missed';
        else tone = 'selectable'; // distractor not selected — neutral
      } else {
        tone = selectedKeys.has(key) ? 'selected' : 'selectable';
      }
      return { span: c.span, tone, key };
    });
  }, [candidateMap, selectedKeys, answered]);

  const handleAnchorClick = useCallback(
    (key: string) => {
      if (answered) return;
      SoundManager.tap();
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [answered],
  );

  const handleSubmit = useCallback(() => {
    if (answered) return;
    const next = attempts + 1;
    setAttempts(next);

    let correctSelected = 0;
    let wrongSelected = 0;
    selectedKeys.forEach((key) => {
      const cand = candidateMap.get(key);
      if (!cand) return;
      if (cand.isEvidence) correctSelected++;
      else wrongSelected++;
    });

    const success = correctSelected >= minRequired && wrongSelected === 0;

    if (success) SoundManager.playCorrect();
    else SoundManager.playIncorrect();

    if (success || next >= 2) {
      setAnswered(true);
      setShowExplanation(true);
      onAnswer(data.id, success, next);
    }
  }, [answered, attempts, selectedKeys, candidateMap, minRequired, data.id, onAnswer]);

  const submitLabel = answered ? 'Done' : `Submit (${selectedKeys.size} selected)`;

  const allSelectedAreEvidence =
    Array.from(selectedKeys).every((k) => candidateMap.get(k)?.isEvidence) &&
    selectedKeys.size >= minRequired;

  return (
    <BlockShell innerRef={innerRef} blockId={data.id} label={data.label} accent="emerald">
      <div className="space-y-4">
        <div className="space-y-1">
          <LuminaSectionLabel accent="emerald" size="sm">
            Find evidence for this claim
          </LuminaSectionLabel>
          <p className="text-slate-100 font-medium text-[15px] leading-relaxed">{data.claim}</p>
          <p className="text-xs text-slate-500 italic">
            Tap underlined phrases in the passage below. Pick {minRequired === 1 ? '1 piece of evidence' : `${minRequired} pieces of evidence`}.
          </p>
        </div>

        <div className="rounded-xl bg-slate-950/40 border border-white/5 p-4">
          <PassageRenderer
            stimulus={stimulus}
            overlays={overlays}
            onAnchorClick={handleAnchorClick}
          />
        </div>

        {!answered && (
          <LuminaActionButton
            action="check"
            onClick={handleSubmit}
            disabled={selectedKeys.size === 0}
          >
            {submitLabel}
          </LuminaActionButton>
        )}

        {answered && (
          <div className="flex items-center gap-2 flex-wrap">
            <LuminaBadge accent={allSelectedAreEvidence ? 'emerald' : 'amber'}>
              {allSelectedAreEvidence
                ? attempts === 1 ? 'Strong evidence!' : 'Got there'
                : 'Some misses revealed'}
            </LuminaBadge>
            <span className="text-xs text-slate-500">
              {attempts} {attempts === 1 ? 'attempt' : 'attempts'}
            </span>
          </div>
        )}

        {showExplanation && (
          <LuminaFeedbackCard status="insight" label="In context">
            <div className="space-y-2">
              <p className="text-sm text-slate-300 leading-relaxed">{data.explanation}</p>
              <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-wider pt-1">
                <span className="text-emerald-300/80">▎ correct</span>
                <span className="text-rose-300/80">▎ off-claim</span>
                <span className="text-amber-300/80">▎ missed evidence</span>
              </div>
            </div>
          </LuminaFeedbackCard>
        )}
      </div>
    </BlockShell>
  );
};

export default EvidenceHighlightBlock;
