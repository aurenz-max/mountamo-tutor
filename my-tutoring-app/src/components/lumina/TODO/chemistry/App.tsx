import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { MoleculeScene } from './components/Scene/MoleculeScene';
import { generateMoleculeData } from './services/geminiService';
import { MoleculeData, Atom } from './types';

export default function App() {
  const [moleculeData, setMoleculeData] = useState<MoleculeData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAtom, setSelectedAtom] = useState<Atom | null>(null);

  // Initial load with a simple molecule to show something cool
  useEffect(() => {
    handlePromptSubmit("Water molecule");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePromptSubmit = async (prompt: string) => {
    setLoading(true);
    setError(null);
    setSelectedAtom(null); // Deselect on new load
    
    try {
      const data = await generateMoleculeData(prompt);
      setMoleculeData(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate molecule. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAtomClick = (atom: Atom) => {
    setSelectedAtom(atom);
  };

  return (
    <div className="w-full h-screen bg-slate-900 flex overflow-hidden">
      <Sidebar 
        onPromptSubmit={handlePromptSubmit}
        isLoading={loading}
        currentData={moleculeData}
        selectedAtom={selectedAtom}
        error={error}
      />
      
      <main className="flex-1 relative md:ml-80 h-full">
        {/* Background gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/0 to-slate-900/80 pointer-events-none z-10" />
        
        {/* Help Tip Overlay */}
        {!loading && moleculeData && (
          <div className="absolute top-4 right-4 z-20 hidden md:block">
            <div className="bg-slate-900/50 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-full border border-slate-700/50">
              Left Click to Rotate • Scroll to Zoom • Right Click to Pan
            </div>
          </div>
        )}

        <MoleculeScene 
          data={moleculeData}
          selectedAtom={selectedAtom}
          onAtomClick={handleAtomClick}
          isLoading={loading}
        />
      </main>
    </div>
  );
}