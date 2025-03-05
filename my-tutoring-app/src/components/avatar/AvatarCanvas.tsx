'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { applyAvatarPose, analyzeAvatarRig, forceArmPose } from './AvatarPoseHelper';
import AvatarAnimationManager from './AvatarAnimations';

const AvatarCanvas = ({ 
  backgroundColor = '#FFFFFF', 
  poseType = 'natural', 
  onSceneReady = () => {},
  isVisible = true  // Add visibility prop to control rendering
}) => {
  const mountRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const avatarRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());
  const animationManagerRef = useRef(new AvatarAnimationManager());
  const [currentAnimation, setCurrentAnimation] = useState('idle');
  const [availableAnimations, setAvailableAnimations] = useState([]);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const frameIdRef = useRef(null);
  const isVisibleRef = useRef(isVisible);
  
  // Update visibility ref when prop changes
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Public methods for animation control from parent components
  const playAnimation = (animationName) => {
    if (animationManagerRef.current) {
      animationManagerRef.current.play(animationName, {
        loop: true,
        timeScale: 1.0
      });
      setCurrentAnimation(animationName);
    }
  };

  // Expose methods to parent via ref
  useEffect(() => {
    if (isLoaded && avatarRef.current) {
      // Expose animation methods to parent component if needed
      if (typeof onSceneReady === 'function') {
        onSceneReady({
          playAnimation,
          getAvailableAnimations: () => availableAnimations,
          getCurrentAnimation: () => currentAnimation,
          scene: sceneRef.current,
          camera: cameraRef.current,
          controls: controlsRef.current,
          animationManager: animationManagerRef.current
        });
      }
    }
  }, [isLoaded, availableAnimations, currentAnimation]);

  // Helper function to properly dispose of materials
  const disposeMaterial = (material) => {
    if (!material) return;
    
    // Dispose textures
    Object.keys(material).forEach(prop => {
      if (!material[prop]) return;
      if (material[prop].isTexture) {
        material[prop].dispose();
      }
    });
    
    // Dispose material itself
    material.dispose();
  };

  useEffect(() => {
    // Define container dimensions at the top level
    const containerWidth = 240;
    const containerHeight = 240;
    
    // Check for WebGL support first
    try {
      // Test WebGL by attempting to create a context
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.warn('WebGL not supported');
        if (mountRef.current) {
          const warning = document.createElement('div');
          warning.style.color = 'red';
          warning.textContent = 'WebGL is not available on your browser.';
          mountRef.current.appendChild(warning);
        }
        return;
      }
    } catch (e) {
      console.error('Error checking WebGL support:', e);
      return;
    }
    
    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(backgroundColor);
    
    // Set up the renderer with optimized parameters
    let renderer;
    let camera;
    let controls;
    
    try {
      const pixelRatio = Math.min(window.devicePixelRatio, 2); // Limit pixel ratio for performance
      
      renderer = new THREE.WebGLRenderer({ 
        antialias: false, // Disable antialiasing for performance
        alpha: false,     // No need for transparency
        powerPreference: 'high-performance',
        stencil: false,   // Disable stencil buffer if not needed
        depth: true       // Keep depth testing
      });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(containerWidth, containerHeight);
      rendererRef.current = renderer;
      
      // Only append once we have a renderer
      if (mountRef.current) {
        mountRef.current.innerHTML = ''; // Clear any existing content
        mountRef.current.appendChild(renderer.domElement);
      }
      
      // Create camera after renderer is set up
      camera = new THREE.PerspectiveCamera(75, containerWidth / containerHeight, 0.1, 10);
      cameraRef.current = camera;

      // Store scene reference in animation manager
      animationManagerRef.current.scene = scene;

      // Add OrbitControls for interactive camera movement
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.minDistance = 1;
      controls.maxDistance = 5; // Reduced from 15 to 5 for performance
      controlsRef.current = controls;
    } catch (e) {
      console.error('Error creating WebGL renderer:', e);
      if (mountRef.current) {
        const errorMessage = document.createElement('div');
        errorMessage.style.padding = '10px';
        errorMessage.style.color = 'red';
        errorMessage.textContent = 'Error initializing 3D renderer. Your browser may not support WebGL.';
        mountRef.current.appendChild(errorMessage);
      }
      return;
    }

    // Simplified lighting for performance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);
    
    // Function to set up camera focus on avatar
    const setupCamera = (camera, controls) => {
      camera.position.set(-0.03, 0.75, 0.37); // custom for model avatar_1.glb
      controls.target.set(0.01, 0.56, -0.19); // custom for model avatar_1.glb
      controls.minPolarAngle = Math.PI/4;
      controls.maxPolarAngle = Math.PI/1.7;
      controls.minDistance = 0.2;
      controls.maxDistance = 2.0;
      controls.update();
    };
    
    // Function to fix avatar pose
    const fixAvatarPose = (avatar, poseType) => {
      console.log('Attempting to fix T-pose with multiple methods...');
      
      // Analyze the rig to help with debugging
      analyzeAvatarRig(avatar);
      
      // Try standard posing first
      let avatarPosed = applyAvatarPose(avatar, poseType);
      
      // If standard posing didn't work, try forced arm pose
      if (!avatarPosed) {
        console.log('Standard posing failed, trying forced arm pose...');
        avatarPosed = forceArmPose(avatar);
      }
      
      if (avatarPosed) {
        console.log(`Successfully applied a pose to the avatar`);
      } else {
        console.warn('All T-pose fix attempts failed');
      }
    };
    
    // Load the avatar first, then the animations
    const loadAvatarAndAnimations = async () => {
      const loader = new GLTFLoader();
      
      try {
        // Load the avatar
        const avatarResult = await new Promise((resolve, reject) => {
          loader.load(
            '/avatar_1_viseme.glb',
            resolve,
            (progress) => {
              console.log(`Loading avatar: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
            },
            reject
          );
        });
        
        // Add the avatar to the scene
        const avatar = avatarResult.scene;
        
        // Optimize the avatar mesh
        avatar.traverse((child) => {
          if (child.isMesh) {
            // Disable frustum culling if the avatar is always in view
            child.frustumCulled = false;
            
            // Mark geometries as static if they don't change
            if (child.geometry) {
              child.geometry.setDrawRange(0, Infinity);
              child.geometry.setAttribute('position', child.geometry.getAttribute('position').clone());
            }
            
            // Use cheaper materials when possible
            if (child.material) {
              // Clone the material to avoid modifying shared materials
              child.material = child.material.clone();
              
              // Disable unnecessary features
              child.material.fog = false;
              child.material.flatShading = true;
              
              // Reduce precision for mobile
              if (window.navigator.userAgent.includes('Mobile')) {
                child.material.precision = 'lowp';
              }
            }
          }
        });
        
        avatarRef.current = avatar;
        scene.add(avatar);
        
        // Adjust avatar properties
        avatar.position.set(0, -0.9, 0);
        avatar.scale.set(1, 1, 1);
        avatar.rotation.y = 0;
        
        // Initialize animation manager with avatar
        animationManagerRef.current.init(avatar);
        
        // Now load the animations
        try {
          await animationManagerRef.current.loadAnimations('/M_Talking_Variations_001.glb');
          
          // Get and store available animations
          const animations = animationManagerRef.current.getAnimationNames();
          setAvailableAnimations(animations);
          
          // Play an initial animation if available
          if (animations.length > 0) {
            // Look for an idle animation first
            const idleAnimation = animations.find(name => 
              name.toLowerCase().includes('idle') || 
              name.toLowerCase().includes('static')
            );
            
            if (idleAnimation) {
              animationManagerRef.current.play(idleAnimation, {
                loop: true,
                timeScale: 1.0
              });
              setCurrentAnimation(idleAnimation);
            } else {
              // Otherwise play the first animation
              animationManagerRef.current.play(animations[0], {
                loop: true,
                timeScale: 1.0
              });
              setCurrentAnimation(animations[0]);
            }
          }
        } catch (error) {
          console.error('Error loading animations:', error);
          
          // If animations fail to load, try to fix the T-pose at least
          fixAvatarPose(avatar, poseType);
        }
        
        // Set up camera and finish loading
        setupCamera(camera, controls);
        setIsLoaded(true);
        
      } catch (error) {
        console.error('Error loading avatar:', error);
      }
    };
    
    // Start loading
    loadAvatarAndAnimations();

    // Optimized animation loop using visibility checks and proper timing
    let lastFrameTime = 0;
    const targetFPS = 30; // Lower FPS for avatars that don't need 60fps smoothness
    const frameInterval = 1000 / targetFPS;
    
    // Animation loop
    const animate = (timestamp) => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      // Skip frames to match target FPS
      const elapsed = timestamp - lastFrameTime;
      if (elapsed < frameInterval) return;
      lastFrameTime = timestamp - (elapsed % frameInterval);
      
      // Only render when visible
      if (!isVisibleRef.current) return;
      
      // Update animation mixer
      const delta = clockRef.current.getDelta();
      if (animationManagerRef.current && animationManagerRef.current.mixer) {
        animationManagerRef.current.update(delta);
      }
      
      if (controls) controls.update();
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    
    // Start animation loop
    frameIdRef.current = requestAnimationFrame(animate);
    
    // Handle window visibility changes to pause rendering when tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Stop animation loop when tab is not visible
        if (frameIdRef.current) {
          cancelAnimationFrame(frameIdRef.current);
          frameIdRef.current = null;
        }
      } else {
        // Restart animation loop when tab becomes visible
        if (!frameIdRef.current) {
          lastFrameTime = 0;
          frameIdRef.current = requestAnimationFrame(animate);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle parent container resize
    const handleResize = () => {
      // Camera aspect ratio update only
      if (camera) camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Add keyboard controls for zooming in/out specifically on the face
    const handleKeyDown = (event) => {
      if (avatarRef.current && camera && controls) {
        switch (event.key) {
          case 'f': // Focus on face
            camera.position.set(0, 0.7, 1.5);
            controls.target.set(0, 0.7, 0);
            break;
          case 'z': // Zoom in
            camera.position.z = Math.max(camera.position.z - 0.3, 1);
            break;
          case 'x': // Zoom out
            camera.position.z = Math.min(camera.position.z + 0.3, 5);
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount - much more thorough to prevent memory leaks
    return () => {
      // Cancel animation frame
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      
      // Remove event listeners
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Dispose OrbitControls
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      // Dispose of all Three.js resources
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.isMesh) {
            if (object.geometry) object.geometry.dispose();
            
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => disposeMaterial(material));
              } else {
                disposeMaterial(object.material);
              }
            }
          }
        });
      }
      
      // Dispose animation resources
      if (animationManagerRef.current && animationManagerRef.current.mixer) {
        animationManagerRef.current.mixer.stopAllAction();
        animationManagerRef.current.mixer.uncacheRoot(avatarRef.current);
      }
      
      // Dispose renderer last
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement = null;
      }
      
      // Clear the mount point
      if (mountRef.current) {
        mountRef.current.innerHTML = '';
      }
    };
  }, [backgroundColor, poseType]);
  
  // Update scene background color when prop changes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(backgroundColor);
    }
  }, [backgroundColor]);
  
  // Update visibility
  useEffect(() => {
    isVisibleRef.current = isVisible;
    
    // If becoming visible and animation was stopped, restart it
    if (isVisible && !frameIdRef.current) {
      const animate = (timestamp) => {
        frameIdRef.current = requestAnimationFrame(animate);
        
        if (!isVisibleRef.current) return;
        
        // Update animation mixer
        const delta = clockRef.current.getDelta();
        if (animationManagerRef.current && animationManagerRef.current.mixer) {
          animationManagerRef.current.update(delta);
        }
        
        if (controlsRef.current) controlsRef.current.update();
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      };
      
      frameIdRef.current = requestAnimationFrame(animate);
    }
  }, [isVisible]);

  return (
    <div>
      <div ref={mountRef} style={{ 
        width: '240px', 
        height: '240px', 
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: backgroundColor,
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        visibility: isVisible ? 'visible' : 'hidden'
      }} />
      {isLoaded && isVisible && (
        <div className="controls-info" style={{
          position: 'absolute',
          bottom: '5px',
          left: '5px',
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '4px',
          borderRadius: '4px',
          fontFamily: 'Arial',
          fontSize: '10px'
        }}>
          <p style={{ margin: '2px' }}>Drag: Rotate | Scroll: Zoom</p>
        </div>
      )}
    </div>
  );
};

export default AvatarCanvas;