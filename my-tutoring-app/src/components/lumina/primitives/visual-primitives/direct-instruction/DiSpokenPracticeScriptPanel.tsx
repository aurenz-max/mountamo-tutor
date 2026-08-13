'use client';

/**
 * DiSpokenPracticeScriptPanel — READ THE SCRIPT BEFORE A CHILD HEARS IT.
 *
 * DEV SURFACE ONLY. Rendered by `DirectInstructionPrimitivesTester`, never by a
 * lesson.
 *
 * The whole bet of the content-generic pack is that a model can write, per
 * skill, the two clauses every hand-authored pack had to discover by driving it
 * live: a RIGHT answer that does not look right, and a WRONG answer that sounds
 * right. Those clauses reach the tutor as plain text inside a judging contract,
 * so a bad one is invisible until a child is corrected for a correct answer.
 *
 * This panel makes them visible for the price of a generation call. Read, in
 * order: the ASK (does it contain the answer? does it have exactly one correct
 * completion?), then ACCEPT / MISS (are they the real error analysis for this
 * skill, or generic filler?), then the assembled CUE, which is verbatim what
 * the tutor receives.
 *
 * The leak row is mechanical, not advisory — `findAnswerLeaks` is the same
 * function the generator uses to DROP items, so anything flagged here escaped
 * the drop and is a bug in the scan, not in the content.
 */

import { useMemo, useState } from 'react';
import { LuminaBadge, LuminaPanel, LuminaSectionLabel } from '../../../ui';
import {
  findAnswerLeaks,
  itemCue,
  MODE_SHAPE,
  type SpokenPracticeItem,
} from './diSpokenPracticeScript';

interface Props {
  items: readonly SpokenPracticeItem[];
}

const Row: React.FC<{ label: string; children: React.ReactNode; tone?: string }> = ({
  label,
  children,
  tone = 'text-slate-200',
}) => (
  <div className="grid grid-cols-[7rem_1fr] gap-2 py-0.5">
    <span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span>
    <span className={`text-xs ${tone}`}>{children}</span>
  </div>
);

export function DiSpokenPracticeScriptPanel({ items }: Props) {
  const [openCue, setOpenCue] = useState<string | null>(null);
  const leaks = useMemo(() => findAnswerLeaks(items), [items]);

  if (items.length === 0) return null;

  const missingClauses = items.filter((i) => !i.acceptRule && !i.signatureError).length;

  return (
    <LuminaPanel className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <LuminaSectionLabel>Generated script — read before driving</LuminaSectionLabel>
        <div className="flex gap-2">
          <LuminaBadge accent={leaks.length ? 'rose' : 'emerald'} className="text-[10px]">
            {leaks.length ? `${leaks.length} answer leak${leaks.length > 1 ? 's' : ''}` : 'no answer leaks'}
          </LuminaBadge>
          <LuminaBadge accent={missingClauses ? 'amber' : 'emerald'} className="text-[10px]">
            {missingClauses
              ? `${missingClauses}/${items.length} with no accept/miss clause`
              : 'every item has error analysis'}
          </LuminaBadge>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        ACCEPT = a right answer that does not look right. MISS = a wrong answer that sounds right.
        These are the clauses this pack exists to test — generic filler here (&ldquo;accept any
        reasonable answer&rdquo;) means the judge has been handed nothing, and the item is no better
        than an unverified template.
      </p>

      <div className="space-y-3">
        {items.map((item) => {
          const itemLeaks = leaks.filter((l) => l.itemId === item.id);
          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 ${itemLeaks.length
                ? 'border-rose-400/40 bg-rose-500/5'
                : 'border-white/10 bg-slate-900/40'}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-medium text-slate-200">{item.id}</span>
                <LuminaBadge accent="cyan" className="text-[10px]">
                  {MODE_SHAPE[item.mode].label}
                </LuminaBadge>
                <LuminaBadge accent="purple" className="text-[10px]">
                  {item.responseClass}
                </LuminaBadge>
                <span className="text-[10px] text-slate-500">
                  {item.stimulusKind}
                  {item.stimulusKind === 'objects' ? ` ×${item.stimulusCount}` : ''}
                  {' · '}
                  {item.answerSource}
                </span>
              </div>

              <Row label="Stimulus">
                {item.stimulusEmoji ? `${item.stimulusEmoji} ` : ''}
                {item.stimulusText || <em className="text-slate-500">(spoken only)</em>}
              </Row>
              <Row label="How to play" tone="text-slate-400">{item.howToPlay || '—'}</Row>
              <Row label="Ask" tone="text-cyan-200">{item.ask}</Row>
              <Row label="Answer" tone="text-emerald-300">
                &ldquo;{item.expectedAnswer}&rdquo;
                {item.alternates.length > 0 && (
                  <span className="text-slate-400"> · also: {item.alternates.join(', ')}</span>
                )}
              </Row>
              <Row label="Accept" tone={item.acceptRule ? 'text-amber-200' : 'text-slate-600'}>
                {item.acceptRule || '— none written —'}
              </Row>
              <Row label="Miss" tone={item.signatureError ? 'text-amber-200' : 'text-slate-600'}>
                {item.signatureError || '— none written —'}
              </Row>
              <Row label="Correction" tone="text-slate-300">{item.correctionBody}</Row>

              {itemLeaks.length > 0 && (
                <Row label="⚠ Leak" tone="text-rose-300">
                  {itemLeaks.map((l) => `"${l.answer}" appears in ${l.field}`).join('; ')}
                </Row>
              )}

              <button
                onClick={() => setOpenCue(openCue === item.id ? null : item.id)}
                className="mt-2 text-[11px] text-slate-400 underline decoration-dotted hover:text-slate-200"
              >
                {openCue === item.id ? 'hide' : 'show'} the cue the tutor receives
              </button>
              {openCue === item.id && (
                <pre className="mt-2 whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] leading-relaxed text-slate-400">
                  {itemCue(item, { opening: false, howToPlay: true })}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </LuminaPanel>
  );
}

export default DiSpokenPracticeScriptPanel;
