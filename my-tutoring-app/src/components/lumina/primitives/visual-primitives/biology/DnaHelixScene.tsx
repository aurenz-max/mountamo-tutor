import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface DnaHelixSceneProps {
  sequence: {
    templateStrand: string;
    complementaryStrand: string;
    highlightedRegion?: { start: number; end: number; label: string };
  };
  structuralFeatures: {
    sugarPhosphateBackbone: string;
    majorGroove?: string;
    minorGroove?: string;
    antiparallelOrientation: string;
  };
  zoomLevel?: 'chromosome' | 'gene' | 'sequence' | 'base-pair' | 'molecular';
  mode: 'structure' | 'zoom';
  onBaseClick?: (position: number, base: string) => void;
}

interface HelixGeometry {
  strand1Points: THREE.Vector3[];
  strand2Points: THREE.Vector3[];
  basePairs: Array<{
    pos1: [number, number, number];
    pos2: [number, number, number];
    base1: string;
    base2: string;
    bondCount: number;
    isHighlighted: boolean;
  }>;
  totalHeight: number;
}

// ============================================================================
// Constants
// ============================================================================

const BASE_3D_COLORS: Record<string, string> = {
  A: '#22c55e',
  T: '#ef4444',
  C: '#3b82f6',
  G: '#eab308',
};

const BASE_NAMES: Record<string, string> = {
  A: 'Adenine',
  T: 'Thymine',
  C: 'Cytosine',
  G: 'Guanine',
};

const HELIX_RADIUS = 2.0;
const VERTICAL_STEP = 0.6;
const BASES_PER_TURN = 10;
const ANGULAR_STEP = (2 * Math.PI) / BASES_PER_TURN;
const PHASE_OFFSET = Math.PI;
const SAMPLES_PER_BASE = 10;

const ZOOM_CAMERA_CONFIG: Record<string, { distance: number; fov: number }> = {
  chromosome: { distance: 45, fov: 60 },
  gene: { distance: 25, fov: 55 },
  sequence: { distance: 15, fov: 50 },
  'base-pair': { distance: 7, fov: 45 },
  molecular: { distance: 3.5, fov: 40 },
};

// ============================================================================
// Geometry Computation
// ============================================================================

function computeHelixGeometry(sequence: DnaHelixSceneProps['sequence']): HelixGeometry {
  const bases = sequence.templateStrand.split('');
  const compBases = sequence.complementaryStrand.split('');
  const numBases = bases.length;
  const totalHeight = numBases * VERTICAL_STEP;
  const yOffset = -totalHeight / 2;

  const strand1Points: THREE.Vector3[] = [];
  const strand2Points: THREE.Vector3[] = [];

  // Oversample backbone curves for smooth tubes
  for (let i = 0; i <= numBases * SAMPLES_PER_BASE; i++) {
    const t = i / SAMPLES_PER_BASE;
    const angle1 = t * ANGULAR_STEP;
    const angle2 = t * ANGULAR_STEP + PHASE_OFFSET;
    const y = t * VERTICAL_STEP + yOffset;

    strand1Points.push(new THREE.Vector3(
      HELIX_RADIUS * Math.cos(angle1),
      y,
      HELIX_RADIUS * Math.sin(angle1),
    ));
    strand2Points.push(new THREE.Vector3(
      HELIX_RADIUS * Math.cos(angle2),
      y,
      HELIX_RADIUS * Math.sin(angle2),
    ));
  }

  // Base pair positions at integer indices
  const basePairs: HelixGeometry['basePairs'] = [];
  for (let i = 0; i < numBases; i++) {
    const angle1 = i * ANGULAR_STEP;
    const angle2 = i * ANGULAR_STEP + PHASE_OFFSET;
    const y = i * VERTICAL_STEP + yOffset;

    const base1 = bases[i];
    const base2 = compBases[i] || '';
    const bondCount = (base1 === 'A' || base1 === 'T') ? 2 : 3;
    const isHighlighted = !!(
      sequence.highlightedRegion &&
      i >= sequence.highlightedRegion.start &&
      i <= sequence.highlightedRegion.end
    );

    basePairs.push({
      pos1: [HELIX_RADIUS * Math.cos(angle1), y, HELIX_RADIUS * Math.sin(angle1)],
      pos2: [HELIX_RADIUS * Math.cos(angle2), y, HELIX_RADIUS * Math.sin(angle2)],
      base1,
      base2,
      bondCount,
      isHighlighted,
    });
  }

  return { strand1Points, strand2Points, basePairs, totalHeight };
}

// ============================================================================
// Sub-Components (inside Canvas)
// ============================================================================

/** Backbone strand rendered as a smooth tube */
const BackboneStrand: React.FC<{ points: THREE.Vector3[]; color: string }> = ({ points, color }) => {
  const tubeGeom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom');
    return new THREE.TubeGeometry(curve, 64, 0.15, 8, false);
  }, [points]);

  return (
    <mesh geometry={tubeGeom}>
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.4} />
    </mesh>
  );
};

/** Interactive base sphere with hover label */
const BaseSphere: React.FC<{
  position: [number, number, number];
  base: string;
  index: number;
  isHighlighted: boolean;
  onBaseClick?: (index: number, base: string) => void;
}> = ({ position, base, index, isHighlighted, onBaseClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHover] = useState(false);
  const color = BASE_3D_COLORS[base] || '#888';
  const targetScale = hovered ? 1.3 : 1;

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        delta * 10,
      );
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onBaseClick?.(index, base); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.2}
          emissive={isHighlighted ? '#facc15' : color}
          emissiveIntensity={hovered ? 0.5 : isHighlighted ? 0.3 : 0.1}
        />
      </mesh>
      {hovered && (
        <Html position={[0, 0.6, 0]} center pointerEvents="none">
          <div className="bg-black/80 text-white px-2 py-1 rounded text-xs font-bold backdrop-blur-sm border border-white/20 select-none whitespace-nowrap">
            {base} - {BASE_NAMES[base] || base}
          </div>
        </Html>
      )}
    </group>
  );
};

/** Hydrogen bond cylinder connecting a base pair */
const HydrogenBond: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  bondCount: number;
}> = ({ start, end, bondCount }) => {
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);
  const direction = useMemo(() => new THREE.Vector3().subVectors(endVec, startVec), [startVec, endVec]);
  const length = direction.length();

  if (length < 0.0001) return null;

  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
    [direction],
  );
  const midPoint = useMemo(
    () => new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5),
    [startVec, endVec],
  );

  const radius = bondCount === 3 ? 0.06 : 0.04;
  const opacity = bondCount === 3 ? 0.5 : 0.35;

  return (
    <mesh position={midPoint} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshStandardMaterial
        color="#ffffff"
        opacity={opacity}
        transparent
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
};

/** Camera controller for zoom level transitions */
const CameraController: React.FC<{ zoomLevel: string }> = ({ zoomLevel }) => {
  const { camera } = useThree();

  useFrame(() => {
    const config = ZOOM_CAMERA_CONFIG[zoomLevel] || ZOOM_CAMERA_CONFIG['sequence'];
    const targetPos = new THREE.Vector3(0, 0, config.distance);
    camera.position.lerp(targetPos, 0.05);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, config.fov, 0.05);
      camera.updateProjectionMatrix();
    }
  });

  return null;
};

/** Structure mode annotations - 5'/3' labels and groove markers */
const StructureAnnotations: React.FC<{
  helixData: HelixGeometry;
  showGrooves: boolean;
}> = ({ helixData, showGrooves }) => {
  const { strand1Points, strand2Points, totalHeight } = helixData;
  const topY = totalHeight / 2 + 0.8;
  const bottomY = -totalHeight / 2 - 0.8;

  // Get approximate X/Z at top and bottom of each strand
  const s1Top = strand1Points[strand1Points.length - 1];
  const s1Bottom = strand1Points[0];
  const s2Top = strand2Points[strand2Points.length - 1];
  const s2Bottom = strand2Points[0];

  return (
    <>
      {/* 5' / 3' direction labels */}
      <Html position={[s1Bottom.x, bottomY, s1Bottom.z]} center pointerEvents="none">
        <div className="bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-400/30 select-none">
          5&apos;
        </div>
      </Html>
      <Html position={[s1Top.x, topY, s1Top.z]} center pointerEvents="none">
        <div className="bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-400/30 select-none">
          3&apos;
        </div>
      </Html>
      <Html position={[s2Bottom.x, bottomY, s2Bottom.z]} center pointerEvents="none">
        <div className="bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-violet-400/30 select-none">
          3&apos;
        </div>
      </Html>
      <Html position={[s2Top.x, topY, s2Top.z]} center pointerEvents="none">
        <div className="bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-violet-400/30 select-none">
          5&apos;
        </div>
      </Html>

      {/* Groove annotations */}
      {showGrooves && helixData.basePairs.length >= 4 && (
        <>
          {/* Major groove label - placed at ~1/3 height, offset outward */}
          <Html
            position={[HELIX_RADIUS + 1.2, helixData.basePairs[Math.floor(helixData.basePairs.length * 0.3)]?.pos1[1] ?? 0, 0]}
            center
            pointerEvents="none"
          >
            <div className="bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded text-[10px] font-medium border border-cyan-400/30 select-none whitespace-nowrap">
              Major Groove
            </div>
          </Html>
          {/* Minor groove label - placed at ~2/3 height, opposite side */}
          <Html
            position={[-HELIX_RADIUS - 1.2, helixData.basePairs[Math.floor(helixData.basePairs.length * 0.7)]?.pos1[1] ?? 0, 0]}
            center
            pointerEvents="none"
          >
            <div className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded text-[10px] font-medium border border-amber-400/30 select-none whitespace-nowrap">
              Minor Groove
            </div>
          </Html>
        </>
      )}
    </>
  );
};

// ============================================================================
// Main Scene Component
// ============================================================================

export const DnaHelixScene: React.FC<DnaHelixSceneProps> = ({
  sequence,
  structuralFeatures,
  zoomLevel = 'sequence',
  mode,
  onBaseClick,
}) => {
  const helixData = useMemo(() => computeHelixGeometry(sequence), [sequence]);

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>
      <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={50} />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={2}
        maxDistance={60}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.25} penumbra={1} intensity={1.5} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4f46e5" />
      <Environment preset="city" />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* Camera controller for zoom mode */}
      {mode === 'zoom' && <CameraController zoomLevel={zoomLevel} />}

      {/* DNA Helix */}
      <group>
        {/* Backbone strands */}
        <BackboneStrand points={helixData.strand1Points} color="#6366f1" />
        <BackboneStrand points={helixData.strand2Points} color="#8b5cf6" />

        {/* Base pairs */}
        {helixData.basePairs.map((bp, i) => (
          <React.Fragment key={i}>
            <BaseSphere
              position={bp.pos1}
              base={bp.base1}
              index={i}
              isHighlighted={bp.isHighlighted}
              onBaseClick={onBaseClick}
            />
            <BaseSphere
              position={bp.pos2}
              base={bp.base2}
              index={i}
              isHighlighted={bp.isHighlighted}
            />
            <HydrogenBond start={bp.pos1} end={bp.pos2} bondCount={bp.bondCount} />
          </React.Fragment>
        ))}

        {/* Structure annotations */}
        {mode === 'structure' && (
          <StructureAnnotations
            helixData={helixData}
            showGrooves={!!structuralFeatures.majorGroove}
          />
        )}
      </group>
    </Canvas>
  );
};
