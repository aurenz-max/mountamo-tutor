'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { ObjectiveData, ManifestItem, OrderedComponent } from '../types';

interface ExhibitContextType {
  objectives: ObjectiveData[];
  manifestItems: ManifestItem[];
  /** The lesson's sections in the order they render. Empty outside a lesson. */
  sections: OrderedComponent[];
  getObjectivesForComponent: (instanceId: string) => ObjectiveData[];
}

const ExhibitContext = createContext<ExhibitContextType | null>(null);

interface ExhibitProviderProps {
  objectives: ObjectiveData[];
  manifestItems: ManifestItem[];
  sections?: OrderedComponent[];
  children: React.ReactNode;
}

const NO_SECTIONS: OrderedComponent[] = [];

// Stable no-provider fallback — consumers hold context values in hook
// dependency arrays, so identity must not churn per call.
const EMPTY_EXHIBIT_CONTEXT: ExhibitContextType = {
  objectives: [],
  manifestItems: [],
  sections: NO_SECTIONS,
  getObjectivesForComponent: () => [],
};

export const ExhibitProvider: React.FC<ExhibitProviderProps> = ({
  objectives,
  manifestItems,
  sections = NO_SECTIONS,
  children
}) => {
  // Memoized so consumers (e.g. usePrimitiveEvaluation's submitResult) keep a
  // stable identity across unrelated re-renders.
  const value = useMemo<ExhibitContextType>(() => ({
    objectives,
    manifestItems,
    sections,
    getObjectivesForComponent: (instanceId: string): ObjectiveData[] => {
      const item = manifestItems.find(m => m.instanceId === instanceId);
      if (!item || !item.objectiveIds) return [];
      return objectives.filter(obj => item.objectiveIds?.includes(obj.id));
    },
  }), [objectives, manifestItems, sections]);

  return (
    <ExhibitContext.Provider value={value}>
      {children}
    </ExhibitContext.Provider>
  );
};

export const useExhibitContext = () => {
  const context = useContext(ExhibitContext);
  if (!context) {
    // Empty default if not in context (graceful degradation)
    return EMPTY_EXHIBIT_CONTEXT;
  }
  return context;
};
