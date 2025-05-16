// components/BohrModel.js
import React, { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { SimulationComponent } from '@/lib/application-registry';

const ELEMENTS = {
  "H": { name: "Hydrogen", number: 1, weight: 1.008, config: "1s¹", shells: [1] },
  "He": { name: "Helium", number: 2, weight: 4.0026, config: "1s²", shells: [2] },
  "Li": { name: "Lithium", number: 3, weight: 6.94, config: "1s² 2s¹", shells: [2, 1] },
  "Be": { name: "Beryllium", number: 4, weight: 9.0122, config: "1s² 2s²", shells: [2, 2] },
  "B": { name: "Boron", number: 5, weight: 10.81, config: "1s² 2s² 2p¹", shells: [2, 3] },
  "C": { name: "Carbon", number: 6, weight: 12.011, config: "1s² 2s² 2p²", shells: [2, 4] },
  "N": { name: "Nitrogen", number: 7, weight: 14.007, config: "1s² 2s² 2p³", shells: [2, 5] },
  "O": { name: "Oxygen", number: 8, weight: 15.999, config: "1s² 2s² 2p⁴", shells: [2, 6] },
  "F": { name: "Fluorine", number: 9, weight: 18.998, config: "1s² 2s² 2p⁵", shells: [2, 7] },
  "Ne": { name: "Neon", number: 10, weight: 20.180, config: "1s² 2s² 2p⁶", shells: [2, 8] }
};

const BohrModel: SimulationComponent = ({ element = "C" }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  
  // Default values for sliders
  const DEFAULT_ROTATION_SPEED = 0.01;
  const DEFAULT_ELECTRON_SIZE = 0.4;
  const DEFAULT_SHELL_SPACING = 3;
  
  const [selectedElement, setSelectedElement] = useState(element);
  const [rotationSpeed, setRotationSpeed] = useState(DEFAULT_ROTATION_SPEED);
  const [electronSize, setElectronSize] = useState(DEFAULT_ELECTRON_SIZE);
  const [shellSpacing, setShellSpacing] = useState(DEFAULT_SHELL_SPACING);
  
  // References to maintain state without triggering re-renders
  const rotationSpeedRef = useRef(rotationSpeed);
  const electronSizeRef = useRef(electronSize);
  const shellSpacingRef = useRef(shellSpacing);
  const selectedElementRef = useRef(selectedElement);
  
  // Animation references
  const animationRef = useRef({
    electronGroups: [],
    speedMultipliers: [],
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    animationFrameId: null
  });
  

  // Update ref values when state changes
  useEffect(() => {
    rotationSpeedRef.current = rotationSpeed;
  }, [rotationSpeed]);
  
  useEffect(() => {
    electronSizeRef.current = electronSize;
  }, [electronSize]);
  
  useEffect(() => {
    shellSpacingRef.current = shellSpacing;
  }, [shellSpacing]);
  
  useEffect(() => {
    selectedElementRef.current = selectedElement;
    // When element changes, we need to rebuild the atom
    if (sceneRef.current) {
      rebuildAtom();
    }
  }, [selectedElement]);
  
  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Initialize scene only once
    initScene();
    
    // Cleanup function
    return () => {
      if (animationRef.current.animationFrameId) {
        cancelAnimationFrame(animationRef.current.animationFrameId);
      }
      if (animationRef.current.renderer && mountRef.current) {
        mountRef.current.removeChild(animationRef.current.renderer.domElement);
      }
    };
  }, []);
  
  // Initialize the Three.js scene
  const initScene = () => {
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 15;
    
    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);
    
    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);
    
    // Store references
    animationRef.current.scene = scene;
    animationRef.current.camera = camera;
    animationRef.current.renderer = renderer;
    animationRef.current.controls = controls;
    
    // Build atom model
    sceneRef.current = scene;
    buildAtom();
    
    // Start animation loop
    animate();
    
    // Handle window resize
    const handleResize = () => {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    
    // Update cleanup to handle resize listener
    const currentRefs = animationRef.current;
    animationRef.current.cleanup = () => {
      window.removeEventListener('resize', handleResize);
      if (currentRefs.animationFrameId) {
        cancelAnimationFrame(currentRefs.animationFrameId);
      }
    };
  };
  
  // Animation loop
  const animate = () => {
    if (!animationRef.current.scene) return;
    
    animationRef.current.animationFrameId = requestAnimationFrame(animate);
    
    // Rotate electron shells at different speeds based on current ref value
    animationRef.current.electronGroups.forEach((group, index) => {
      const multiplier = animationRef.current.speedMultipliers[index];
      group.rotation.y += rotationSpeedRef.current * multiplier;
    });
    
    animationRef.current.controls.update();
    animationRef.current.renderer.render(
      animationRef.current.scene, 
      animationRef.current.camera
    );
  };
  
  // Clear existing atom model and rebuild
  const rebuildAtom = () => {
    // Clear existing atom elements
    clearAtom();
    // Build new atom
    buildAtom();
  };
  
  // Clear existing atom elements from scene
  const clearAtom = () => {
    if (!sceneRef.current) return;
    
    // Remove existing electron groups and orbital paths
    const scene = sceneRef.current;
    const objectsToRemove = [];
    
    scene.traverse(object => {
      if (object.userData.atomPart) {
        objectsToRemove.push(object);
      }
    });
    
    objectsToRemove.forEach(object => {
      scene.remove(object);
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    // Clear references
    animationRef.current.electronGroups = [];
    animationRef.current.speedMultipliers = [];
  };
  
  // Build atom model based on selected element
  const buildAtom = () => {
    if (!sceneRef.current) return;
    
    const scene = sceneRef.current;
    const elementData = ELEMENTS[selectedElementRef.current];
    
    // Nucleus
    const nucleusGeometry = new THREE.SphereGeometry(2, 32, 32);
    const nucleusMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffcc00,
      emissive: 0xffcc00,
      emissiveIntensity: 0.3,
      shininess: 100
    });
    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    nucleus.userData.atomPart = true;
    scene.add(nucleus);
    
    // Create electron shells
    const electronGroups = [];
    const speedMultipliers = [];
    
    elementData.shells.forEach((electronCount, shellIndex) => {
      const shellRadius = 4 + (shellIndex * shellSpacingRef.current);
      const electronGroup = new THREE.Group();
      electronGroup.userData.atomPart = true;
      scene.add(electronGroup);
      electronGroups.push(electronGroup);
      
      // Set speed multiplier inversely proportional to shell index
      const speedMultiplier = 1 - (shellIndex * 0.15);
      speedMultipliers.push(speedMultiplier);
      
      // Create orbit path
      const orbitGeometry = new THREE.TorusGeometry(shellRadius, 0.05, 16, 100);
      const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        opacity: 0.3,
        transparent: true
      });
      const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbit.rotation.x = Math.PI / 2;
      orbit.userData.atomPart = true;
      scene.add(orbit);
      
      // Add electrons to shell
      for (let i = 0; i < electronCount; i++) {
        const electronGeometry = new THREE.SphereGeometry(electronSizeRef.current, 16, 16);
        const electronMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x00ffff,
          emissive: 0x00ffff,
          emissiveIntensity: 0.5
        });
        const electron = new THREE.Mesh(electronGeometry, electronMaterial);
        
        // Position electrons evenly around the orbit
        const angle = (i / electronCount) * Math.PI * 2;
        electron.position.x = shellRadius * Math.cos(angle);
        electron.position.z = shellRadius * Math.sin(angle);
        
        electronGroup.add(electron);
      }
    });
    
    // Store references for animation updates
    animationRef.current.electronGroups = electronGroups;
    animationRef.current.speedMultipliers = speedMultipliers;
  };
  
  const handleElementChange = (e) => {
    setSelectedElement(e.target.value);
  };
  
  const handleRotationSpeedChange = (value) => {
    setRotationSpeed(value[0] / 100); // Convert slider value to appropriate speed
  };
  
  const handleElectronSizeChange = (value) => {
    setElectronSize(value[0] / 10); // Convert slider value to appropriate size
    
    // Update electron sizes in real-time
    if (sceneRef.current) {
      updateElectronSizes();
    }
  };
  
  const handleShellSpacingChange = (value) => {
    setShellSpacing(value[0] / 10); // Convert slider value to appropriate spacing
    
    // When shell spacing changes, we need to rebuild the atom
    if (sceneRef.current) {
      rebuildAtom();
    }
  };
  
  const resetToDefaults = () => {
    setRotationSpeed(DEFAULT_ROTATION_SPEED);
    setElectronSize(DEFAULT_ELECTRON_SIZE);
    setShellSpacing(DEFAULT_SHELL_SPACING);
    
    // Update ref values immediately to avoid delay
    rotationSpeedRef.current = DEFAULT_ROTATION_SPEED;
    electronSizeRef.current = DEFAULT_ELECTRON_SIZE;
    shellSpacingRef.current = DEFAULT_SHELL_SPACING;
    
    // Rebuild atom with default values
    if (sceneRef.current) {
      rebuildAtom();
    }
  };
  
  // Update electron sizes without rebuilding entire atom
  const updateElectronSizes = () => {
    animationRef.current.electronGroups.forEach(group => {
      group.children.forEach(electron => {
        // Replace geometry with new size
        if (electron.geometry) electron.geometry.dispose();
        electron.geometry = new THREE.SphereGeometry(electronSizeRef.current, 16, 16);
      });
    });
  };
  
  return (
    <div className="flex flex-col items-center w-full space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Interactive Bohr Model</CardTitle>
          <CardDescription>
            Visualize different atomic elements with adjustable parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="element-select" className="mb-2 block">Select Element:</Label>
            <Select value={selectedElement} onValueChange={setSelectedElement}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an element" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ELEMENTS).map(symbol => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol} - {ELEMENTS[symbol].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div 
            ref={mountRef} 
            className="w-full h-96 border rounded bg-black"
          ></div>
        </CardContent>
      </Card>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>
            Adjust parameters to customize the visualization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="rotation-speed">Rotation Speed</Label>
                <span className="text-sm text-gray-500">{(rotationSpeed * 100).toFixed(0)}%</span>
              </div>
              <Slider
                id="rotation-speed"
                defaultValue={[1]}
                value={[rotationSpeed * 100]}
                max={10}
                step={0.1}
                onValueChange={handleRotationSpeedChange}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="electron-size">Electron Size</Label>
                <span className="text-sm text-gray-500">{electronSize.toFixed(1)}</span>
              </div>
              <Slider
                id="electron-size"
                defaultValue={[4]}
                value={[electronSize * 10]}
                max={10}
                step={0.1}
                onValueChange={handleElectronSizeChange}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="shell-spacing">Shell Spacing</Label>
                <span className="text-sm text-gray-500">{shellSpacing.toFixed(1)}</span>
              </div>
              <Slider
                id="shell-spacing"
                defaultValue={[30]}
                value={[shellSpacing * 10]}
                min={20}
                max={50}
                step={1}
                onValueChange={handleShellSpacingChange}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={resetToDefaults} className="ml-auto">
            Reset to Defaults
          </Button>
        </CardFooter>
      </Card>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{ELEMENTS[selectedElement].name} ({selectedElement})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Atomic Number</p>
              <p className="text-lg font-semibold">{ELEMENTS[selectedElement].number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Atomic Weight</p>
              <p className="text-lg font-semibold">{ELEMENTS[selectedElement].weight}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Electron Configuration</p>
              <p className="text-lg font-semibold">{ELEMENTS[selectedElement].config}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

  BohrModel.metadata = {
  id: 'bohr-model',
  title: 'Bohr Model',
  description: 'Explore the Bohr model of atomic structure and electron energy levels',
  subject: 'Physics',
  difficulty: 'intermediate',
  category: 'physics',
  topics: ['atomic structure', 'electrons', 'energy levels'],
  standards: ['PS1.A', 'PS1.C'],
  duration: '10-15 minutes',
  prerequisites: ['basic atomic theory']
};

export default BohrModel;