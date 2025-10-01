import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useControls, Leva } from 'leva'; // leva for GUI controls

// --- Element Data ---
// Simplified data for demonstration
const elementData = {
  Hydrogen: { atomicNumber: 1, weight: 1.008, config: '1s¹', shells: [1] },
  Helium: { atomicNumber: 2, weight: 4.0026, config: '1s²', shells: [2] },
  Lithium: { atomicNumber: 3, weight: 6.94, config: '1s² 2s¹', shells: [2, 1] },
  Beryllium: { atomicNumber: 4, weight: 9.0122, config: '1s² 2s²', shells: [2, 2] },
  Boron: { atomicNumber: 5, weight: 10.81, config: '1s² 2s² 2p¹', shells: [2, 3] },
  Carbon: { atomicNumber: 6, weight: 12.011, config: '1s² 2s² 2p²', shells: [2, 4] },
};

// --- Components ---

// Electron Component
function Electron({ radius, speed, offset, lineVibration }) {
  const ref = useRef();
  const lineRef = useRef();
  const vibration = useRef(0);

  // Basic orbit animation
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const angle = time * speed + offset;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (ref.current) {
      ref.current.position.set(x, 0, z);
    }

    // Animate line vibration (simple effect)
    if (lineRef.current) {
        vibration.current = Math.sin(time * lineVibration * 5 + offset) * 0.1 * lineVibration; // Scale vibration
        const points = [new THREE.Vector3(0, 0, 0), ref.current.position.clone().setY(vibration.current)];
        lineRef.current.geometry.setFromPoints(points);
        lineRef.current.geometry.verticesNeedUpdate = true; // Deprecated, but needed for LineBasicMaterial update sometimes
        lineRef.current.geometry.attributes.position.needsUpdate = true; // Use this for BufferGeometry
    }
  });

  // Create initial line geometry
  const lineGeometry = useMemo(() => {
    const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]; // Start with zero length
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);


  return (
    <group>
      {/* Electron Sphere */}
      <Sphere ref={ref} args={[0.2, 16, 16]} position={[radius, 0, 0]}>
        <meshStandardMaterial emissive="cyan" emissiveIntensity={2} color="cyan" />
      </Sphere>
      {/* Line connecting electron to nucleus */}
       <Line
          ref={lineRef}
          points={lineGeometry.attributes.position.array} // Pass initial points array
          color="cyan"
          lineWidth={1}
          dashed={false}
        />
    </group>
  );
}

// Nucleus Component
function Nucleus({ jitter, jitterFreq }) {
    const ref = useRef();
    const initialPos = useMemo(() => new THREE.Vector3(0, 0, 0), []); // Store initial position

    useFrame(({ clock }) => {
        if (ref.current && jitter > 0) {
            const time = clock.getElapsedTime();
            const freq = jitterFreq > 0 ? jitterFreq : 0.1; // Avoid division by zero
            ref.current.position.x = initialPos.x + Math.sin(time * freq * 2) * jitter * 0.5;
            ref.current.position.y = initialPos.y + Math.cos(time * freq * 3) * jitter * 0.5;
            ref.current.position.z = initialPos.z + Math.sin(time * freq * 1.5) * jitter * 0.5;
        } else if (ref.current) {
            ref.current.position.copy(initialPos); // Reset if no jitter
        }
    });

  return (
    <Sphere ref={ref} args={[0.5, 32, 32]} position={initialPos}>
      <meshStandardMaterial emissive="yellow" emissiveIntensity={1.5} color="yellow" />
    </Sphere>
  );
}

// Atom Component - Manages Nucleus and Electrons
function Atom({ element, orbitSpeed, lineVibration, nucleusJitter, jitterFreq }) {
  const { shells } = elementData[element];
  const nucleusSize = 0.5; // Base size
  const shellSpacing = 2; // Spacing between shells

  return (
    <group>
      <Nucleus jitter={nucleusJitter} jitterFreq={jitterFreq} />
      {shells.map((electronCount, shellIndex) => {
        const radius = nucleusSize + shellSpacing * (shellIndex + 1);
        return Array.from({ length: electronCount }).map((_, electronIndex) => {
          // Distribute electrons evenly on the shell
          const offset = (Math.PI * 2 * electronIndex) / electronCount;
          return (
            <Electron
              key={`${shellIndex}-${electronIndex}`}
              radius={radius}
              speed={orbitSpeed * (1 / (shellIndex + 1))} // Inner shells faster? Adjust as needed
              offset={offset}
              lineVibration={lineVibration}
            />
          );
        });
      })}
    </group>
  );
}

// Main Simulation Component
function BohrModelSimulation() {
  // --- State and Controls ---
  const [selectedElement, setSelectedElement] = useState('Lithium');

  const {
    bloomStrength,
    bloomThreshold,
    bloomRadius,
    orbitSpeed,
    lineVibration,
    nucleusJitter,
    jitterFreq
  } = useControls({
    'Bloom Controls': { // Group controls
        bloomStrength: { value: 1.5, min: 0, max: 5, step: 0.1 },
        bloomThreshold: { value: 0.1, min: 0, max: 1, step: 0.01 },
        bloomRadius: { value: 0.5, min: 0, max: 2, step: 0.05 },
    },
    'Animation Controls': { // Another group
        orbitSpeed: { value: 0.5, min: 0, max: 2, step: 0.05 },
        lineVibration: { value: 1.0, min: 0, max: 10, step: 0.1 },
        nucleusJitter: { value: 0.1, min: 0, max: 1, step: 0.05 },
        jitterFreq: { value: 5.0, min: 0.1, max: 20, step: 0.1 },
    }
  });

  const currentElementData = elementData[selectedElement];

  return (
    <div className="flex h-screen w-screen bg-black text-white font-sans">
      {/* Leva GUI Panel */}
      <Leva collapsed />

      {/* Control and Info Panel (Left Side) */}
      <div className="w-64 p-4 border-r border-gray-700 flex flex-col space-y-4 bg-gray-900 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-center">Controls & Info</h2>

        {/* Element Selection */}
        <div>
          <label htmlFor="element-select" className="block text-sm font-medium text-gray-300 mb-1">
            Select Element:
          </label>
          <select
            id="element-select"
            value={selectedElement}
            onChange={(e) => setSelectedElement(e.target.value)}
            className="w-full p-2 rounded border bg-gray-800 border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.keys(elementData).map((el) => (
              <option key={el} value={el}>
                {el} ({elementData[el].atomicNumber})
              </option>
            ))}
          </select>
        </div>

        {/* Element Information Display */}
        {currentElementData && (
          <div className="mt-4 p-3 bg-gray-800 rounded">
            <h3 className="text-lg font-semibold text-center mb-2">{selectedElement}</h3>
            <p className="text-sm"><span className="font-medium text-gray-400">Symbol:</span> {selectedElement.slice(0, 2)}</p>
            <p className="text-sm"><span className="font-medium text-gray-400">Atomic #:</span> {currentElementData.atomicNumber}</p>
            <p className="text-sm"><span className="font-medium text-gray-400">Weight:</span> {currentElementData.weight}</p>
            <p className="text-sm"><span className="font-medium text-gray-400">Config:</span> {currentElementData.config}</p>
          </div>
        )}

        {/* Placeholder for Leva controls info - Leva panel appears separately */}
         <div className="text-xs text-gray-500 mt-auto text-center">
            Adjust Bloom and Animation parameters using the floating Leva panel (usually top-right).
         </div>
      </div>

      {/* Canvas Container (Right Side) */}
      <div className="flex-grow relative">
        <Canvas camera={{ position: [0, 5, 15], fov: 60 }}>
          {/* Lighting */}
          <ambientLight intensity={0.2} />
          <pointLight position={[10, 10, 10]} intensity={0.8} />

          {/* Atom Model */}
          <Atom
             element={selectedElement}
             orbitSpeed={orbitSpeed}
             lineVibration={lineVibration}
             nucleusJitter={nucleusJitter}
             jitterFreq={jitterFreq}
           />

          {/* Controls */}
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

          {/* Post-processing Effects */}
          <EffectComposer>
            <Bloom
              intensity={bloomStrength}
              luminanceThreshold={bloomThreshold}
              luminanceSmoothing={bloomRadius} // Bloom radius is controlled by luminanceSmoothing
              height={300} // Lower resolution for bloom effect can improve performance
            />
          </EffectComposer>
        </Canvas>
      </div>
    </div>
  );
}

// Main App Component (Export this for Next.js page)
export default function App() {
  // Ensure this component runs only on the client
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null; // Render nothing on the server
  }

  return <BohrModelSimulation />;
}
