import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { MoleculeAtom } from '../../../types';
import { CPK_COLORS, DEFAULT_RADIUS } from './constants';

interface AtomProps {
  atom: MoleculeAtom;
  isSelected?: boolean;
  onClick: (atom: MoleculeAtom) => void;
}

/**
 * 3D Atom Component
 *
 * Renders a single atom as a sphere with:
 * - CPK color scheme
 * - Interactive hover and selection states
 * - Smooth scale animations
 * - Element label on hover/selection
 */
export const Atom: React.FC<AtomProps> = ({ atom, isSelected, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);

  const color = CPK_COLORS[atom.element] || CPK_COLORS['C'];
  const baseRadius = DEFAULT_RADIUS[atom.element] || DEFAULT_RADIUS['default'];

  // Scale effect on hover/select
  const targetScale = isSelected ? 1.5 : hovered ? 1.2 : 1;

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 10
      );
    }
  });

  return (
    <group position={[atom.position.x, atom.position.y, atom.position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(atom);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          setHover(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[baseRadius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.2}
          emissive={color}
          emissiveIntensity={hovered || isSelected ? 0.4 : 0}
        />
      </mesh>

      {/* Element Symbol Label - Only show if hovered or selected to reduce clutter */}
      {(hovered || isSelected) && (
        <Html position={[0, baseRadius + 0.5, 0]} center pointerEvents="none">
          <div className="bg-black/70 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-sm border border-white/20 select-none">
            {atom.element}
          </div>
        </Html>
      )}
    </group>
  );
};
