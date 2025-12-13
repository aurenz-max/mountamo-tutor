import React, { useState } from 'react';
import { Atom, FlaskConical, Sparkles } from 'lucide-react';
import { MoleculeViewerData, MoleculeAtom } from '../types';
import { MoleculeScene } from './visual-primitives/chemistry/MoleculeScene';

interface MoleculeViewerProps {
  data: MoleculeViewerData;
  className?: string;
}

/**
 * MoleculeViewer Primitive Component
 *
 * An interactive 3D molecular visualization primitive for chemistry education.
 *
 * Features:
 * - 3D molecular structure visualization using React Three Fiber
 * - Interactive atom selection with detailed information
 * - CPK color-coded atoms
 * - Auto-rotating view with orbit controls
 * - Responsive layout with side panel for molecular info
 *
 * Use cases:
 * - Chemistry lessons on molecular structure
 * - Organic chemistry compound visualization
 * - Crystal structure demonstrations
 * - Biochemistry (proteins, DNA)
 */
const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ data, className = '' }) => {
  const [selectedAtom, setSelectedAtom] = useState<MoleculeAtom | null>(null);

  const handleAtomClick = (atom: MoleculeAtom) => {
    setSelectedAtom(atom);
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Main Container with 3D Scene and Info Panel */}
      <div className="w-full h-[600px] bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex">

        {/* Left Info Panel */}
        <div className="w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center space-x-3 bg-slate-950/50">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg shadow-lg shadow-cyan-500/20">
              <Atom className="text-white h-6 w-6 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400">
                {data.name}
              </h3>
              <p className="text-xs text-slate-400">3D Molecular Structure</p>
            </div>
          </div>

          {/* Molecule Info */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 shadow-inner">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                  {data.category.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                  {data.atoms.length} Atoms
                </span>
                <span className="text-xs px-2 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                  {data.bonds.length} Bonds
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed opacity-90">
                {data.description}
              </p>
            </div>

            {/* Selected Atom Info */}
            {selectedAtom && (
              <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900/50 p-4 rounded-xl border border-indigo-500/30 animate-fade-in">
                <h4 className="text-sm font-semibold text-indigo-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles size={14} /> Selected Atom
                </h4>
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold bg-slate-800 border-2 border-indigo-400 shadow-lg shadow-indigo-500/20">
                    {selectedAtom.element}
                  </div>
                  <div>
                    <p className="font-bold text-white">{selectedAtom.name}</p>
                    {selectedAtom.atomicNumber && (
                      <p className="text-xs text-slate-400">
                        Atomic Number: {selectedAtom.atomicNumber}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p>
                    Position: ({selectedAtom.position.x.toFixed(2)},{' '}
                    {selectedAtom.position.y.toFixed(2)}, {selectedAtom.position.z.toFixed(2)})
                  </p>
                </div>
                {selectedAtom.description && (
                  <p className="mt-3 text-xs text-slate-300 italic border-l-2 border-indigo-500/50 pl-2">
                    {selectedAtom.description}
                  </p>
                )}
              </div>
            )}

            {/* Bond Statistics */}
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FlaskConical size={14} /> Bond Analysis
              </h4>
              <div className="space-y-2 text-xs">
                {(() => {
                  const bondTypes = data.bonds.reduce((acc, bond) => {
                    acc[bond.type] = (acc[bond.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  const bondOrders = data.bonds.reduce((acc, bond) => {
                    const orderKey = bond.order === 1 ? 'Single' : bond.order === 2 ? 'Double' : bond.order === 3 ? 'Triple' : 'Other';
                    acc[orderKey] = (acc[orderKey] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>);

                  return (
                    <>
                      <div>
                        <p className="text-slate-500 mb-1">By Type:</p>
                        {Object.entries(bondTypes).map(([type, count]) => (
                          <div key={type} className="flex justify-between text-slate-300 ml-2">
                            <span className="capitalize">{type}:</span>
                            <span className="font-mono">{count}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-slate-700/50">
                        <p className="text-slate-500 mb-1">By Order:</p>
                        {Object.entries(bondOrders).map(([order, count]) => (
                          <div key={order} className="flex justify-between text-slate-300 ml-2">
                            <span>{order}:</span>
                            <span className="font-mono">{count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Controls Help */}
          <div className="p-3 bg-slate-900 border-t border-slate-700">
            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              <span className="block mb-1 font-semibold text-slate-400">Controls:</span>
              Left Click: Rotate • Scroll: Zoom • Right Click: Pan
            </p>
          </div>
        </div>

        {/* Right 3D Scene */}
        <div className="flex-1 relative">
          {/* Background gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/0 via-slate-900/0 to-slate-900/80 pointer-events-none z-10" />

          <MoleculeScene
            data={data}
            selectedAtom={selectedAtom}
            onAtomClick={handleAtomClick}
          />
        </div>
      </div>
    </div>
  );
};

export default MoleculeViewer;
