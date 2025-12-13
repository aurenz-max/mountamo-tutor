import React from 'react';
import * as THREE from 'three';
import { MoleculeBond, MoleculeAtom } from '../../../types';

interface BondProps {
  bond: MoleculeBond;
  sourceAtom: MoleculeAtom;
  targetAtom: MoleculeAtom;
}

/**
 * 3D Bond Component
 *
 * Renders chemical bonds as cylinders connecting atoms:
 * - Different thicknesses for single/double/triple bonds
 * - Different colors for bond types (covalent, ionic, hydrogen)
 * - Proper 3D orientation between atoms
 * - Transparency for hydrogen bonds
 */
export const Bond: React.FC<BondProps> = ({ bond, sourceAtom, targetAtom }) => {
  // Calculate start and end points
  const start = new THREE.Vector3(
    sourceAtom.position.x,
    sourceAtom.position.y,
    sourceAtom.position.z
  );
  const end = new THREE.Vector3(
    targetAtom.position.x,
    targetAtom.position.y,
    targetAtom.position.z
  );

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  // Safety check to prevent division by zero
  if (length < 0.0001) return null;

  // Create rotation to align cylinder with direction
  // Cylinder default orientation is along Y-axis
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    up,
    direction.clone().normalize()
  );

  const midPoint = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5);

  // Bond appearance based on type and order
  const radius = bond.order === 2 ? 0.15 : bond.order === 3 ? 0.2 : 0.08;
  const color = bond.type === 'ionic' ? '#888' : '#ccc';
  const opacity = bond.type === 'hydrogen' ? 0.5 : 1;
  const transparent = bond.type === 'hydrogen';

  // Hide far ionic interactions to reduce clutter
  if (bond.type === 'ionic' && length > 3.5) return null;

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
