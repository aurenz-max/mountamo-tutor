import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RelationalMappingSchema } from '../../types';

interface MolecularBondingAdapterProps {
  schema: RelationalMappingSchema;
}

// Atom colors based on CPK coloring convention
const ATOM_COLORS: Record<string, number> = {
  'Hydrogen': 0xFFFFFF,
  'Carbon': 0x909090,
  'Nitrogen': 0x3050F8,
  'Oxygen': 0xFF0D0D,
  'Fluorine': 0x90E050,
  'Chlorine': 0x1FF01F,
  'Sulfur': 0xFFFF30,
  'Phosphorus': 0xFF8000,
};

// Default atom radii (in Angstroms, scaled for visualization)
const ATOM_RADII: Record<string, number> = {
  'Hydrogen': 0.3,
  'Carbon': 0.7,
  'Nitrogen': 0.65,
  'Oxygen': 0.6,
  'Fluorine': 0.5,
  'Chlorine': 0.75,
  'Sulfur': 0.8,
  'Phosphorus': 0.8,
};

/**
 * Chemistry Molecular Bonding Adapter
 *
 * Renders molecular structures in 3D using Three.js
 * - Atoms as colored spheres
 * - Bonds as cylinders
 * - Interactive rotation and zoom
 *
 * V1 Implementation:
 * - Basic ball-and-stick model
 * - CPK coloring for atoms
 * - Simple cylindrical bonds
 * - Orbital clouds, advanced interactivity skipped for MVP
 */
export const MolecularBondingAdapter: React.FC<MolecularBondingAdapterProps> = ({ schema }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Validate schema
      if (schema.primitive !== 'relational_mapping') {
        throw new Error('Schema must be of type relational_mapping');
      }

      if (schema.domain.field !== 'chemistry') {
        throw new Error('Schema must be for chemistry domain');
      }

      // Setup scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a0f);
      sceneRef.current = scene;

      // Setup camera
      const camera = new THREE.PerspectiveCamera(
        75,
        containerRef.current.clientWidth / containerRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 0, 5);
      cameraRef.current = camera;

      // Setup renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Setup controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.rotateSpeed = 0.5;
      controlsRef.current = controls;

      // Add lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
      directionalLight2.position.set(-5, -5, -5);
      scene.add(directionalLight2);

      // Create atom meshes
      const atomMeshes = new Map<string, THREE.Mesh>();

      schema.content.entities.forEach((entity) => {
        const atomLabel = entity.label;
        const color = ATOM_COLORS[atomLabel] || 0xCCCCCC;
        const radius = ATOM_RADII[atomLabel] || 0.5;

        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color,
          shininess: 30,
          specular: 0x222222,
        });

        const mesh = new THREE.Mesh(geometry, material);

        // Position atom
        if (entity.position) {
          mesh.position.set(
            entity.position.x,
            entity.position.y,
            entity.position.z || 0
          );
        }

        scene.add(mesh);
        atomMeshes.set(entity.id, mesh);

        // Add atom label (optional, can be toggled)
        const labelSprite = createTextSprite(atomLabel, 0.3);
        labelSprite.position.set(
          mesh.position.x,
          mesh.position.y + radius + 0.3,
          mesh.position.z
        );
        scene.add(labelSprite);
      });

      // Create bond cylinders
      schema.content.relationships.forEach((relationship) => {
        const fromMesh = atomMeshes.get(relationship.from);
        const toMesh = atomMeshes.get(relationship.to);

        if (!fromMesh || !toMesh) {
          console.warn(`Bond ${relationship.from} -> ${relationship.to} references missing atoms`);
          return;
        }

        const bond = createBond(fromMesh.position, toMesh.position, 0.1);
        scene.add(bond);
      });

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Handle window resize
      const handleResize = () => {
        if (!containerRef.current || !camera || !renderer) return;

        camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        controls.dispose();
        renderer.dispose();
        containerRef.current?.removeChild(renderer.domElement);
      };
    } catch (err) {
      console.error('Error rendering molecule:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [schema]);

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-300">
        <h3 className="font-semibold mb-2">Rendering Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3D Visualization */}
      <div
        ref={containerRef}
        className="w-full h-[500px] rounded-lg border border-slate-700/50 bg-slate-950"
        style={{ cursor: 'grab' }}
      />

      {/* Content Information */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-100 mb-2">
            {schema.content.title}
          </h3>
          <p className="text-slate-300 text-sm">
            {schema.content.centralQuestion}
          </p>
        </div>

        {/* Emergent Properties */}
        {schema.content.emergentProperties.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Emergent Properties</h4>
            <div className="space-y-3">
              {schema.content.emergentProperties.map((prop, idx) => (
                <div key={idx} className="text-sm">
                  <p className="text-purple-300 font-medium">{prop.property}</p>
                  <p className="text-slate-400 mt-1">{prop.explanation}</p>
                  <p className="text-slate-500 mt-1 italic">{prop.consequence}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Satisfied Constraints */}
        {schema.content.satisfiedConstraints.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Satisfied Rules</h4>
            <ul className="space-y-2">
              {schema.content.satisfiedConstraints.map((constraint, idx) => (
                <li key={idx} className="text-sm text-slate-400 flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>{constraint}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Assessment Hooks */}
      {schema.assessmentHooks && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-blue-300">Think Further</h4>
          {schema.assessmentHooks.predict && (
            <div>
              <p className="text-xs text-blue-400 font-medium">PREDICT</p>
              <p className="text-sm text-slate-300 mt-1">{schema.assessmentHooks.predict}</p>
            </div>
          )}
          {schema.assessmentHooks.transfer && (
            <div>
              <p className="text-xs text-blue-400 font-medium">TRANSFER</p>
              <p className="text-sm text-slate-300 mt-1">{schema.assessmentHooks.transfer}</p>
            </div>
          )}
          {schema.assessmentHooks.explain && (
            <div>
              <p className="text-xs text-blue-400 font-medium">EXPLAIN</p>
              <p className="text-sm text-slate-300 mt-1">{schema.assessmentHooks.explain}</p>
            </div>
          )}
        </div>
      )}

      {/* Controls hint */}
      <p className="text-xs text-slate-500 text-center">
        Click and drag to rotate • Scroll to zoom
      </p>
    </div>
  );
};

// Helper: Create a bond cylinder between two points
function createBond(start: THREE.Vector3, end: THREE.Vector3, radius: number): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16);
  const material = new THREE.MeshPhongMaterial({
    color: 0x888888,
    shininess: 10,
  });
  const bond = new THREE.Mesh(geometry, material);

  // Position and orient the bond
  bond.position.copy(start).add(direction.multiplyScalar(0.5));
  bond.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );

  return bond;
}

// Helper: Create a text sprite for labels
function createTextSprite(text: string, scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  canvas.width = 256;
  canvas.height = 128;

  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.font = 'bold 80px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale * 2, scale, 1);

  return sprite;
}
