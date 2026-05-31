/**
 * LuminaSlider — the shadcn Slider, themed AND tuned for feel.
 *
 * Replaces the default-looking range inputs (e.g. HydraulicsLab's Input
 * Force / Load Weight). Two things make it feel iOS-smooth rather than
 * notchy:
 *
 *  1. Continuous tracking, discrete output. The thumb follows the pointer at
 *     a fine internal resolution (no visible steps), but onValueChange only
 *     fires — and a subtle tick only plays — when the snapped integer value
 *     actually changes. Buttery gesture, integer result.
 *  2. Grow-on-grab. The track thickens and the thumb scales with an accent
 *     glow while dragging — the signature iOS "I've got it" affordance.
 *
 * Audio: a drag is SILENT — beeping per integer crossing both machine-guns
 * the sound and reintroduces the notchy feel we removed. A subtle tick fires
 * only for discrete keyboard steps (one keypress → one tick), never a stream.
 *
 * Drop-in compatible with the array API:
 *   <LuminaSlider accent="cyan" value={[force]} onValueChange={([v]) => setForce(v)}
 *     min={0} max={100} step={1} />
 *
 * Pass smooth={false} for plain stepping, or silent to suppress the tick.
 */
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';
import { type LuminaAccent } from './tokens';
import { SoundManager } from '../utils/SoundManager';

// Range fill, thumb border, and grab-glow per accent (literal names for JIT).
const rangeFill: Record<LuminaAccent, string> = {
  orange: 'bg-orange-400',
  emerald: 'bg-emerald-400',
  cyan: 'bg-cyan-400',
  amber: 'bg-amber-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  pink: 'bg-pink-400',
  rose: 'bg-rose-400',
};

const thumbBorder: Record<LuminaAccent, string> = {
  orange: 'border-orange-400',
  emerald: 'border-emerald-400',
  cyan: 'border-cyan-400',
  amber: 'border-amber-400',
  blue: 'border-blue-400',
  purple: 'border-purple-400',
  pink: 'border-pink-400',
  rose: 'border-rose-400',
};

const thumbGlow: Record<LuminaAccent, string> = {
  orange: 'ring-orange-400/30',
  emerald: 'ring-emerald-400/30',
  cyan: 'ring-cyan-400/30',
  amber: 'ring-amber-400/30',
  blue: 'ring-blue-400/30',
  purple: 'ring-purple-400/30',
  pink: 'ring-pink-400/30',
  rose: 'ring-rose-400/30',
};

type RootProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export interface LuminaSliderProps
  extends Omit<RootProps, 'value' | 'defaultValue' | 'onValueChange' | 'onValueCommit'> {
  accent?: LuminaAccent;
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  /** Continuous tracking with integer-snapped output (iOS-like). Default true. */
  smooth?: boolean;
  /** Suppress the tick on each integer change. */
  silent?: boolean;
}

export const LuminaSlider: React.FC<LuminaSliderProps> = ({
  className,
  accent = 'cyan',
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  smooth = true,
  silent,
  ...props
}) => {
  const snap = React.useCallback((v: number) => Math.round(v / step) * step, [step]);

  // Internal continuous position. Snapped only for output.
  const [pos, setPos] = React.useState<number>(
    () => value?.[0] ?? defaultValue?.[0] ?? min
  );
  const [dragging, setDragging] = React.useState(false);
  const draggingRef = React.useRef(false); // synchronous — gates audio
  const lastSnap = React.useRef(snap(pos));

  const startDrag = () => {
    draggingRef.current = true;
    setDragging(true);
  };
  const endDrag = () => {
    draggingRef.current = false;
    setDragging(false);
  };

  // Sync external (controlled) changes that don't already match our snap —
  // e.g. a reset — without clobbering our smooth position mid-drag.
  React.useEffect(() => {
    if (value?.[0] != null && snap(pos) !== value[0]) {
      setPos(value[0]);
      lastSnap.current = value[0];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.[0]]);

  // Fine resolution for the gesture; ~300 positions across the range.
  const fineStep = smooth ? Math.max((max - min) / 300, 0.0001) : step;

  const handleChange = ([v]: number[]) => {
    setPos(v);
    const s = snap(v);
    if (s !== lastSnap.current) {
      lastSnap.current = s;
      // Tick only for discrete keyboard steps — a drag stays silent so it
      // doesn't machine-gun (the "Geiger counter" effect).
      if (!silent && !draggingRef.current) SoundManager.tick();
      onValueChange?.([s]);
    }
  };

  return (
    <SliderPrimitive.Root
      {...props}
      className={cn('relative flex w-full touch-none select-none items-center py-1', className)}
      value={[pos]}
      min={min}
      max={max}
      step={fineStep}
      onValueChange={handleChange}
      onPointerDown={startDrag}
      onPointerUp={endDrag}
      onLostPointerCapture={endDrag}
      onValueCommit={() => setPos(snap(pos))}
    >
      <SliderPrimitive.Track
        className={cn(
          'relative w-full grow overflow-hidden rounded-full bg-white/10 transition-all',
          dragging ? 'h-2.5' : 'h-1.5'
        )}
      >
        <SliderPrimitive.Range className={cn('absolute h-full', rangeFill[accent])} />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          'block rounded-full border-2 bg-slate-900 shadow transition-all',
          'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          thumbBorder[accent],
          dragging ? cn('h-5 w-5 ring-4', thumbGlow[accent]) : 'h-4 w-4'
        )}
      />
    </SliderPrimitive.Root>
  );
};
