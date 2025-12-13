import React from 'react';
import * as THREE from 'three';
import { Bond as BondType, Atom } from '../../types';

interface BondProps {
  bond: BondType;
  sourceAtom: Atom;
  targetAtom: Atom;
  bondScale: number; // For expanding the molecule
}

export const Bond: React.FC<BondProps> = ({ bond, sourceAtom, targetAtom }) => {
  // Calculate start and end points
  const start = new THREE.Vector3(sourceAtom.position.x, sourceAtom.position.y, sourceAtom.position.z);
  const end = new THREE.Vector3(targetAtom.position.x, targetAtom.position.y, targetAtom.position.z);
  
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  // Safety check to prevent division by zero in quaternion calculation or shader errors
  if (length < 0.0001) return null;

  const orientation = new THREE.Matrix4();
  
  // Create rotation matrix to align cylinder with direction
  // Cylinder default is Y-axis
  const up = new THREE.Vector3(0, 1, 0);
  
  // Quaternion for rotation
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
  
  const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  const radius = bond.order === 2 ? 0.15 : bond.order === 3 ? 0.2 : 0.08;
  const color = bond.type === 'ionic' ? '#888' : '#ccc';
  const opacity = bond.type === 'hydrogen' ? 0.5 : 1;
  const transparent = bond.type === 'hydrogen';

  if (bond.type === 'ionic' && length > 3.5) return null; // Hide far ionic interactions

  return (
    <mesh position={midPoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial 
        color={color} 
        opacity={opacity} 
        transparent={transparent}
        roughness={0.4}
        metalness={0.3}
      />
    </mesh>
  );
};