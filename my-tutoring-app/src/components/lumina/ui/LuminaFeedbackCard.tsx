/**
 * LuminaFeedbackCard — the post-answer result banner.
 *
 * The #1 cross-cutting eval-loop pattern (8+ literacy, 8+ problem primitives,
 * science labs). Icon + uppercase status label + rationale body + optional
 * teaching note. Extracted from TrueFalseProblem.tsx's feedback block.
 *
 *   <LuminaFeedbackCard status="correct" teachingNote="Tracks spread weight…">
 *     A wide base keeps the machine on top of soft ground.
 *   </LuminaFeedbackCard>
 *
 * status: correct (emerald ✓) · incorrect (rose ✗) · insight (slate ⓘ — the
 * softer "not wrong, just think again" variant some primitives prefer).
 */
import * as React from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FeedbackStatus = 'correct' | 'incorrect' | 'insight';

const STATUS: Record<
  FeedbackStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  correct: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Correct' },
  incorrect: { icon: XCircle, color: 'text-rose-400', label: 'Not quite' },
  insight: { icon: Info, color: 'text-slate-300', label: 'Insight' },
};

export interface LuminaFeedbackCardProps extends React.HTMLAttributes<HTMLDivElement> {
  status: FeedbackStatus;
  /** Override the default status label ("Correct" / "Not quite" / "Insight"). */
  label?: string;
  /** Optional teaching note shown beneath a divider with a 💡. */
  teachingNote?: React.ReactNode;
}

export const LuminaFeedbackCard = React.forwardRef<HTMLDivElement, LuminaFeedbackCardProps>(
  ({ className, status, label, teachingNote, children, ...props }, ref) => {
    const { icon: Icon, color, label: defaultLabel } = STATUS[status];
    return (
      <div
        ref={ref}
        className={cn('animate-fade-in rounded-2xl border border-white/5 bg-black/20 p-6', className)}
        {...props}
      >
        <div className={cn('mb-2 flex items-center gap-3 font-bold uppercase tracking-wider', color)}>
          <Icon className="w-5 h-5" />
          <span>{label ?? defaultLabel}</span>
        </div>
        <div className="text-lg font-light leading-relaxed text-slate-300">{children}</div>
        {teachingNote && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <p className="text-sm italic text-slate-400">💡 {teachingNote}</p>
          </div>
        )}
      </div>
    );
  }
);
LuminaFeedbackCard.displayName = 'LuminaFeedbackCard';
