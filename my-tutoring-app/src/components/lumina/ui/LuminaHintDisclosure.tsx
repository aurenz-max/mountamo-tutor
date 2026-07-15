/**
 * LuminaHintDisclosure — the "Need a hint?" collapsible.
 *
 * Codifies the 40+ hand-rolled hint reveals (FoundationExplorer, KnowledgeCheck,
 * PoetryLab…). A quiet amber trigger that expands to a tinted hint panel.
 *
 *   <LuminaHintDisclosure>
 *     Count the stars you already have, then keep going.
 *   </LuminaHintDisclosure>
 *
 *   <LuminaHintDisclosure label="Need help?" accent="amber" defaultOpen={false}>
 *     …hint content…
 *   </LuminaHintDisclosure>
 */
import * as React from 'react';
import { Lightbulb, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  accentSoftBg,
  accentSoftBorder,
  accentStrongText,
  motion,
  type LuminaAccent,
} from './tokens';

export interface LuminaHintDisclosureProps {
  children: React.ReactNode;
  label?: string;
  accent?: LuminaAccent;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export const LuminaHintDisclosure: React.FC<LuminaHintDisclosureProps> = ({
  children,
  label = 'Need a hint?',
  accent = 'amber',
  defaultOpen = false,
  onOpenChange,
  className,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const handleToggle = () => {
    setOpen((current) => {
      const next = !current;
      onOpenChange?.(next);
      return next;
    });
  };
  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 text-sm font-medium',
          motion.press,
          motion.transition,
          accentStrongText[accent]
        )}
      >
        <Lightbulb className="w-4 h-4" />
        <span>{label}</span>
        <ChevronDown className={cn('w-4 h-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>
      {/* Grid-rows 0fr→1fr animates height to auto smoothly; content stays
          mounted so the transition has something to grow into. */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              'mt-2 rounded-lg border p-3 text-sm leading-relaxed text-slate-300 transition-opacity duration-300',
              accentSoftBg[accent],
              accentSoftBorder[accent],
              open ? 'opacity-100' : 'opacity-0'
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
