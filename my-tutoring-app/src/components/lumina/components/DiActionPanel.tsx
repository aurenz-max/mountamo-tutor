'use client';

/**
 * Shared Direct Instruction action surface.
 *
 * It owns the state transition that every mixed-modality DI primitive needs:
 * one start control before the run; an instruction-only hands state with no
 * listening orb; a voice state with the microphone; and a visible sequence
 * that keeps the learner oriented in a multi-step task.
 */
import React from 'react';
import type { DiActionContract, JudgedScriptItem } from '../hooks/judgedScriptContract';
import type { JudgedRunStage } from '../hooks/useJudgedScriptRunner';
import type { MicListenerState } from '../ui';
import JudgedMicPanel, { type JudgedRunSurface } from './JudgedMicPanel';

export type DiActionItem = Pick<JudgedScriptItem, 'id' | 'answerKind'> & {
  actionContract: DiActionContract;
};

interface DiActionPanelBaseProps<Item extends DiActionItem> {
  running: boolean;
  stage: JudgedRunStage;
  currentItem: Item | null;
  steps: readonly Item[];
  completedIds?: ReadonlySet<string>;
  carriedIds?: ReadonlySet<string>;
  startInstruction?: string;
}

interface DiActionPanelRunProps {
  run: JudgedRunSurface;
  micState?: never;
  statusLine?: never;
  onStart?: never;
  onCancel?: never;
  isSupported?: never;
}

interface DiActionPanelManualProps {
  run?: never;
  micState: MicListenerState;
  statusLine: string;
  onStart: () => void;
  onCancel?: () => void;
  isSupported?: boolean;
}

export type DiActionPanelProps<Item extends DiActionItem> = DiActionPanelBaseProps<Item>
  & (DiActionPanelRunProps | DiActionPanelManualProps);

const DiActionPanel = <Item extends DiActionItem>(props: DiActionPanelProps<Item>) => {
  const {
    running,
    stage,
    currentItem,
    steps,
    completedIds = new Set<string>(),
    carriedIds = new Set<string>(),
    startInstruction = 'Tap start, then listen for the first step.',
  } = props;
  const action = currentItem?.actionContract ?? null;
  const activeId = currentItem?.id ?? null;
  const statusLine = props.run ? props.run.statusLine : props.statusLine;

  const message = !running
    ? startInstruction
    : stage === 'judging'
      ? action?.checkingInstruction ?? 'Checking your work.'
      : stage === 'affirmed'
        ? 'That step is complete. Get ready for what comes next.'
        : stage === 'done'
          ? 'You finished every step.'
          : action?.instruction ?? 'Listen for the next step.';

  const showMic = !running || action?.answerKind === 'voice';

  return (
    <section className="space-y-3" aria-label="What to do">
      {steps.length > 1 && (
        <ol
          className="flex flex-wrap items-stretch justify-center gap-2"
          aria-label="Problem steps"
        >
          {steps.map((step, index) => {
            const isCurrent = step.id === activeId;
            const isCompleted = completedIds.has(step.id);
            const isCarried = carriedIds.has(step.id);
            const state = isCompleted ? 'complete' : isCarried ? 'helped' : isCurrent ? 'current' : 'upcoming';
            return (
              <li
                key={step.id}
                data-state={state}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex min-w-[8rem] flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left ${
                  isCurrent
                    ? 'border-cyan-300/60 bg-cyan-400/10 text-cyan-100'
                    : isCompleted
                      ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200'
                      : isCarried
                        ? 'border-amber-300/25 bg-amber-300/5 text-amber-100/80'
                        : 'border-white/10 bg-white/[0.025] text-slate-500'
                }`}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-[11px] font-bold"
                  aria-hidden="true"
                >
                  {isCompleted ? '✓' : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-tight">{step.actionContract.label}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] opacity-70">
                    {step.actionContract.answerKind === 'gesture' ? 'Hands' : 'Voice'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div
        className="rounded-xl border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-4 text-center"
        aria-live="polite"
      >
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
          {!running
            ? 'Ready to begin'
            : action
              ? `${action.answerKind === 'gesture' ? 'Use your hands' : 'Use your voice'} · ${action.label}`
              : 'Next step'}
        </div>
        <p className="text-base font-medium leading-relaxed text-slate-100">{message}</p>
        {running && action?.answerKind === 'gesture' && (
          <p className="mt-2 text-xs text-slate-400">{statusLine}</p>
        )}
      </div>

      {showMic && props.run && (
        <JudgedMicPanel
          run={props.run}
          voiceLabel={action?.instruction ?? 'I’m listening'}
          idleLabel="Start lesson"
        />
      )}
      {showMic && !props.run && (
        <JudgedMicPanel
          state={props.micState}
          statusLine={props.statusLine}
          onStart={props.onStart}
          onCancel={props.onCancel}
          isSupported={props.isSupported}
          voiceLabel={action?.instruction ?? 'I’m listening'}
          idleLabel="Start lesson"
        />
      )}
    </section>
  );
};

export default DiActionPanel;
