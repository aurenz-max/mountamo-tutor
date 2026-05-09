'use client';

import React from 'react';
import type { Inset } from '../../../types';
import { KatexInsetRenderer } from './KatexInsetRenderer';
import { DataTableInsetRenderer } from './DataTableInsetRenderer';
import { PassageInsetRenderer } from './PassageInsetRenderer';
import { ChartInsetRenderer } from './ChartInsetRenderer';
import { CodeInsetRenderer } from './CodeInsetRenderer';
import { ImageInsetRenderer } from './ImageInsetRenderer';
import { NumberLineInsetRenderer } from './NumberLineInsetRenderer';
import { DefinitionBoxInsetRenderer } from './DefinitionBoxInsetRenderer';
import { EquationSetupInsetRenderer } from './EquationSetupInsetRenderer';

interface InsetRendererProps {
  inset: Inset;
  className?: string;
  /**
   * Optional completion callback for interactive insets that participate
   * in a container's gating contract (currently `equation-setup`). Static
   * inset types ignore this prop. Containers like AnnotatedExample pass it
   * to keep solution steps locked until the student commits the inset.
   */
  onCompletionChange?: (complete: boolean) => void;
}

/**
 * Routes inset data to the correct inline renderer.
 * Renders inside a subtle glass container with optional label.
 */
export const InsetRenderer: React.FC<InsetRendererProps> = ({ inset, className = '', onCompletionChange }) => {
  const renderInset = () => {
    switch (inset.insetType) {
      case 'katex':           return <KatexInsetRenderer data={inset} />;
      case 'data-table':      return <DataTableInsetRenderer data={inset} />;
      case 'passage':         return <PassageInsetRenderer data={inset} />;
      case 'chart':           return <ChartInsetRenderer data={inset} />;
      case 'code':            return <CodeInsetRenderer data={inset} />;
      case 'image':           return <ImageInsetRenderer data={inset} />;
      case 'number-line':     return <NumberLineInsetRenderer data={inset} />;
      case 'definition-box':  return <DefinitionBoxInsetRenderer data={inset} />;
      case 'equation-setup':  return <EquationSetupInsetRenderer data={inset} onCompletionChange={onCompletionChange} />;
      default:                return null;
    }
  };

  return (
    <div className={`rounded-lg border border-white/10 bg-white/5 p-4 my-4 ${className}`}>
      {inset.label && (
        <p className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-3">
          {inset.label}
        </p>
      )}
      {renderInset()}
    </div>
  );
};

/**
 * Whether an inset participates in container-level gating (i.e. its
 * `onCompletionChange` should be wired up and the container should keep
 * downstream content locked until commit). Currently only the modeling
 * inset; widen as more interactive inset types are introduced.
 */
export function isGateableInset(inset: Inset | undefined): boolean {
  return inset?.insetType === 'equation-setup';
}
