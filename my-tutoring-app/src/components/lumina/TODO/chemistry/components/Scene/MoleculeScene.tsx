import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Stars } from '@react-three/drei';
import { MoleculeData, Atom as AtomType } from '../../types';
import { Atom } from './Atom';
import { Bond } from './Bond';
import * as THREE from 'three';

interface MoleculeSceneProps {
  data: MoleculeData | null;
  selectedAtom: AtomType | null;
  onAtomClick: (atom: AtomType) => void;
  isLoading: boolean;
}

export const MoleculeScene: React.FC<MoleculeSceneProps> = ({ data, selectedAtom, onAtomClick, isLoading }) => {
  if (isLoading || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-cyan-400 animate-pulse">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-10 w-10 mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl font-light tracking-widest">SYNTHESIZING...</span>
        </div>
      </div>
    );
  }

  // Create a map for easy atom lookup when rendering bonds
  const atomMap = new Map(data.atoms.map(a => [a.id, a]));

  return (
    // Removed explicit toneMapping settings to fix "X4122" and "X4008" shader warnings on Windows
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={50} />
      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        enableRotate={true} 
        autoRotate={true}
        autoRotateSpeed={0.5}
        minDistance={2}
        maxDistance={50}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.25} penumbra={1} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4f46e5" />
      <Environment preset="city" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <group>
        {/* Atoms */}
        {data.atoms.map((atom) => (
          <Atom 
            key={atom.id} 
            atom={atom} 
            isSelected={selectedAtom?.id === atom.id}
            onClick={onAtomClick} 
          />
        ))}

        {/* Bonds */}
        {data.bonds.map((bond, idx) => {
          const source = atomMap.get(bond.sourceId);
          const target = atomMap.get(bond.targetId);
          if (!source || !target) return null;
          
          return (
            <Bond 
              key={`${bond.sourceId}-${bond.targetId}-${idx}`} 
              bond={bond} 
              sourceAtom={source} 
              targetAtom={target}
              bondScale={1}
            />
          );
        })}
      </group>
    </Canvas>
  );
};