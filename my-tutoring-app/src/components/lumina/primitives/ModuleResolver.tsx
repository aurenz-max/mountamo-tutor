'use client';

import React from 'react';
import { SpecializedExhibit } from '../types';
import { FormulaCard } from './FormulaCard';
import { SentenceAnalyzer } from './SentenceAnalyzer';
import { MathVisuals } from './MathVisuals';
import { CustomVisual } from './CustomVisual';

interface ModuleResolverProps {
  data: SpecializedExhibit;
  topic?: string;
}

export const ModuleResolver: React.FC<ModuleResolverProps> = ({ data, topic }) => {
  if (!data) return null;

  switch (data.type) {
    case 'equation':
      return <FormulaCard data={data} />;
    case 'sentence':
      return <SentenceAnalyzer data={data} />;
    case 'math-visual':
      return <MathVisuals data={data} />;
    case 'custom-svg':
    case 'custom-web':
      return <CustomVisual data={data} topic={topic} />;
    default:
      return null;
  }
};