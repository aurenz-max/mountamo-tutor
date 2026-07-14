/**
 * LuminaDropZone — the drop-target shell for sorters, sequencers, and
 * categorizers.
 *
 * Chrome only: renders the zone surface + empty-state prompt from the shared
 * `dropZoneStateClasses` token map and composes the grading motion (pop on
 * correct, shake on incorrect). The drag/click MECHANICS stay bespoke per
 * primitive — keep your own onDragOver/onDrop/onClick handlers and feed the
 * resulting state back in:
 *
 *   <LuminaDropZone
 *     state={zoneState}
 *     emptyPrompt="Drop items here"
 *     onDragOver={(e) => { e.preventDefault(); setZoneState('dragOver'); }}
 *     onDragLeave={() => setZoneState(placed.length ? 'filled' : 'idle')}
 *     onDrop={handleDrop}
 *   >
 *     {placed.map((w) => <LuminaChip key={w} state="correct">{w}</LuminaChip>)}
 *   </LuminaDropZone>
 *
 * States: idle (dashed, inviting) · dragOver (blue selected-glow, lifts) ·
 * filled (solid, holding items) · correct (emerald + motion.pop) ·
 * incorrect (rose + motion.shake). One language with answer/chip grading.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { dropZoneStateClasses, motion, type DropZoneState } from './tokens';

export type { DropZoneState };

export interface LuminaDropZoneProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: DropZoneState;
  /** Shown centered while the zone has no children (e.g. "Drop items here"). */
  emptyPrompt?: React.ReactNode;
}

export const LuminaDropZone = React.forwardRef<HTMLDivElement, LuminaDropZoneProps>(
  ({ className, state = 'idle', emptyPrompt, children, ...props }, ref) => {
    // toArray drops null/undefined/booleans, so `{cond && <Chip/>}` children
    // still read as empty when the condition is false (Children.count doesn't).
    const isEmpty = React.Children.toArray(children).length === 0;
    return (
      <div
        ref={ref}
        className={cn(
          'flex min-h-[96px] flex-wrap items-center justify-center gap-2 rounded-xl p-3 text-sm font-semibold',
          motion.transition,
          dropZoneStateClasses[state],
          // Grading motion plays once when the state class lands.
          state === 'correct' && motion.pop,
          state === 'incorrect' && motion.shake,
          className
        )}
        {...props}
      >
        {isEmpty ? emptyPrompt : children}
      </div>
    );
  }
);
LuminaDropZone.displayName = 'LuminaDropZone';
