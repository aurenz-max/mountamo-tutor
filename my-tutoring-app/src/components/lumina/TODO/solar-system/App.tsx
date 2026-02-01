import React, { useState, useEffect, useRef } from 'react';
import { CelestialBody, SimulationState } from './types';
import { CELESTIAL_BODIES } from './constants';
import { SolarSystemView } from './components/SolarSystemView';
import { DetailPanel } from './components/DetailPanel';
import { Controls } from './components/Controls';
import { Rocket } from 'lucide-react';

const App: React.FC = () => {
  const [simulationState, setSimulationState] = useState<SimulationState>({
    timeScale: 5000, // 1 real second = X simulation seconds (rough approx for update loop)
    selectedBodyId: null,
    viewMode: 'schematic',
    showOrbits: true,
    paused: false,
    date: new Date()
  });

  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  // Animation Loop
  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined && !simulationState.paused) {
      const deltaTime = time - previousTimeRef.current;
      
      // Update the simulation date
      // timeScale represents how many milliseconds pass in simulation per real millisecond
      // We want reasonable speed. 
      // Let's say timeScale 1000 = 1 sec real time is 1000 sec sim time (too slow).
      // Let's scale it so timeScale 1 = 1 day per real second approx?
      // Actually, let's just add to the date object.
      // 1 day = 86400000 ms.
      // If timeScale is 10000, we add 10000 * deltaTime to the date.
      
      const timeToAdd = simulationState.timeScale * deltaTime * 100; 
      
      setSimulationState(prev => ({
        ...prev,
        date: new Date(prev.date.getTime() + timeToAdd)
      }));
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [simulationState.paused, simulationState.timeScale]);

  const handleBodyClick = (id: string) => {
    setSimulationState(prev => ({ ...prev, selectedBodyId: id }));
  };

  const handleCloseDetail = () => {
    setSimulationState(prev => ({ ...prev, selectedBodyId: null }));
  };

  const handleUpdateState = (newState: Partial<SimulationState>) => {
    setSimulationState(prev => ({ ...prev, ...newState }));
  };

  const selectedBody = CELESTIAL_BODIES.find(b => b.id === simulationState.selectedBodyId);

  return (
    <div className="w-full h-screen bg-slate-950 text-white relative flex flex-col overflow-hidden">
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 p-6 z-40 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold space-font tracking-tight text-white drop-shadow-md">Lumina Explorer</h1>
            <p className="text-xs text-blue-300 font-medium tracking-wide uppercase">Solar System Primitive 1.0</p>
          </div>
        </div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative">
        <SolarSystemView 
          bodies={CELESTIAL_BODIES}
          state={simulationState}
          onBodyClick={handleBodyClick}
        />
      </div>

      {/* Controls */}
      <Controls state={simulationState} onUpdateState={handleUpdateState} />

      {/* Detail Panel */}
      {selectedBody && (
        <DetailPanel body={selectedBody} onClose={handleCloseDetail} />
      )}

      {/* Legend / Helper Text (Mobile/Tablet hint) */}
      <div className="absolute top-6 right-6 z-30 pointer-events-none hidden md:block">
        <div className="bg-slate-900/50 backdrop-blur px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400">
           Scroll to Zoom • Drag to Pan • Click Planets
        </div>
      </div>
    </div>
  );
};

export default App;