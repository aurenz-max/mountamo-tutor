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

interface InsetRendererProps {
  inset: Inset;
  className?: string;
}

/**
 * Routes inset data to the correct inline renderer.
 * Renders inside a subtle glass container with optional label.
 */
export const InsetRenderer: React.FC<InsetRendererProps> = ({ inset, className = '' }) => {
  const renderInset = () => {
    switch (inset.insetType) {
      case 'katex':          return <KatexInsetRenderer data={inset} />;
      case 'data-table':     return <DataTableInsetRenderer data={inset} />;
      case 'passage':        return <PassageInsetRenderer data={inset} />;
      case 'chart':          return <ChartInsetRenderer data={inset} />;
      case 'code':           return <CodeInsetRenderer data={inset} />;
      case 'image':          return <ImageInsetRenderer data={inset} />;
      case 'number-line':    return <NumberLineInsetRenderer data={inset} />;
      case 'definition-box': return <DefinitionBoxInsetRenderer data={inset} />;
      default:               return null;
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
