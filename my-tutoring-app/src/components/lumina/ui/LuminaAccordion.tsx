/**
 * LuminaAccordion — the shadcn Accordion, themed for Lumina.
 *
 * The collapsible sections in profile-style primitives (MachineProfile's
 * Quick Stats / Key Components / History). Each item is a glass card with an
 * icon + bold accent label trigger. Extracted from MachineProfile.tsx.
 *
 *   <LuminaAccordion type="single" collapsible defaultValue="stats">
 *     <LuminaAccordionItem value="stats" accent="amber" icon={<Gauge />} label="Quick Stats">
 *       …content…
 *     </LuminaAccordionItem>
 *   </LuminaAccordion>
 *
 * LuminaAccordion is the shadcn Accordion root re-exported (set type /
 * collapsible / defaultValue as usual). LuminaAccordionItem bundles the
 * glass card + themed trigger.
 */
import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { surface, accentStrongText, type LuminaAccent } from './tokens';

export const LuminaAccordion = Accordion;

export interface LuminaAccordionItemProps {
  value: string;
  label: string;
  icon?: React.ReactNode;
  accent?: LuminaAccent;
  children: React.ReactNode;
  className?: string;
}

export const LuminaAccordionItem: React.FC<LuminaAccordionItemProps> = ({
  value,
  label,
  icon,
  accent = 'cyan',
  children,
  className,
}) => (
  <AccordionItem value={value} className={cn('mb-3 rounded-lg border', surface.glass, className)}>
    <AccordionTrigger className="px-4 py-3 text-slate-300 hover:text-slate-100 hover:no-underline">
      <div className="flex items-center gap-2">
        {icon && <span className={cn('flex', accentStrongText[accent])}>{icon}</span>}
        <span className={cn('font-bold', accentStrongText[accent])}>{label}</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4">{children}</AccordionContent>
  </AccordionItem>
);
