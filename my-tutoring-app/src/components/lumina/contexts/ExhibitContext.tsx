'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { ObjectiveData, ManifestItem } from '../types';

interface ExhibitContextType {
  objectives: ObjectiveData[];
  manifestItems: ManifestItem[];
  getObjectivesForComponent: (instanceId: string) => ObjectiveData[];
}

const ExhibitContext = createContext<ExhibitContextType | null>(null);

interface ExhibitProviderProps {
  objectives: ObjectiveData[];
  manifestItems: ManifestItem[];
  children: React.ReactNode;
}

// Stable no-provider fallback — consumers hold context values in hook
// dependency arrays, so identity must not churn per call.
const EMPTY_EXHIBIT_CONTEXT: ExhibitContextType = {
  objectives: [],
  manifestItems: [],
  getObjectivesForComponent: () => [],
};

export const ExhibitProvider: React.FC<ExhibitProviderProps> = ({
  objectives,
  manifestItems,
  children
}) => {
  // Memoized so consumers (e.g. usePrimitiveEvaluation's submitResult) keep a
  // stable identity across unrelated re-renders.
  const value = useMemo<ExhibitContextType>(() => ({
    objectives,
    manifestItems,
    getObjectivesForComponent: (instanceId: string): ObjectiveData[] => {
      const item = manifestItems.find(m => m.instanceId === instanceId);
      if (!item || !item.objectiveIds) return [];
      return objectives.filter(obj => item.objectiveIds?.includes(obj.id));
    },
  }), [objectives, manifestItems]);

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
