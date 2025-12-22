'use client';

import React, { createContext, useContext } from 'react';
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

export const ExhibitProvider: React.FC<ExhibitProviderProps> = ({
  objectives,
  manifestItems,
  children
}) => {
  // Build a map for quick lookup
  const getObjectivesForComponent = (instanceId: string): ObjectiveData[] => {
    const item = manifestItems.find(m => m.instanceId === instanceId);
    if (!item || !item.objectiveIds) return [];

    return objectives.filter(obj => item.objectiveIds?.includes(obj.id));
  };

  return (
    <ExhibitContext.Provider value={{ objectives, manifestItems, getObjectivesForComponent }}>
      {children}
    </ExhibitContext.Provider>
  );
};

export const useExhibitContext = () => {
  const context = useContext(ExhibitContext);
  if (!context) {
    // Return empty default if not in context (graceful degradation)
    return {
      objectives: [],
      manifestItems: [],
      getObjectivesForComponent: () => []
    };
  }
  return context;
};
