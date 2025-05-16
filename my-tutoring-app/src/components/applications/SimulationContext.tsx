// contexts/SimulationContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { SimulationComponent, applicationRegistry } from '@/lib/application-registry';
import { loadAllSimulations } from '@/lib/simulation-loader';

interface SimulationContextType {
  simulations: SimulationComponent[];
  loading: boolean;
  getSimulation: (id: string) => SimulationComponent | undefined;
  getByCategory: (category: string) => SimulationComponent[];
}

const SimulationContext = createContext<SimulationContextType | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulations, setSimulations] = useState<SimulationComponent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllSimulations().then(() => {
      setSimulations(applicationRegistry.getAll());
      setLoading(false);
    });
  }, []);

  return (
    <SimulationContext.Provider
      value={{
        simulations,
        loading,
        getSimulation: (id) => applicationRegistry.getById(id),
        getByCategory: (category) => applicationRegistry.getByCategory(category),
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulations() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulations must be used within SimulationProvider');
  }
  return context;
}