'use client';

// components/SolarSystem.js
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export default function SolarSystem() {
  const mountRef = useRef(null);
  
  useEffect(() => {
    if (!mountRef.current) return;
    
    // Scene setup
    const scene = new THREE.Scene();
    
    // Get container dimensions
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75, 
      width / height, 
      0.1, 
      1000
    );
    camera.position.z = 50;
    
    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000);
    
    // Mount renderer to DOM
    mountRef.current.appendChild(renderer.domElement);
    
    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // Create sun
    const sunGeometry = new THREE.SphereGeometry(5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 1
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);
    
    // Create light from sun
    const sunLight = new THREE.PointLight(0xffffff, 1.5, 1000);
    sun.add(sunLight);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);
    
    // Solar system data - placeholder planets
    const planets = [
      { 
        name: 'Mercury', 
        radius: 0.5, 
        distance: 10, 
        rotationSpeed: 0.04, 
        revolutionSpeed: 0.02,
        color: 0x8a8a8a,
        hasRings: false
      },
      { 
        name: 'Venus', 
        radius: 0.9, 
        distance: 15, 
        rotationSpeed: 0.03, 
        revolutionSpeed: 0.015,
        color: 0xe39e1c,
        hasRings: false
      },
      { 
        name: 'Earth', 
        radius: 1, 
        distance: 20, 
        rotationSpeed: 0.02, 
        revolutionSpeed: 0.01,
        color: 0x3498db,
        hasRings: false,
        moons: [
          {
            radius: 0.27,
            distance: 2,
            revolutionSpeed: 0.05,
            color: 0xcccccc
          }
        ]
      },
      { 
        name: 'Mars', 
        radius: 0.6, 
        distance: 25, 
        rotationSpeed: 0.018, 
        revolutionSpeed: 0.008,
        color: 0xc0392b,
        hasRings: false
      },
      { 
        name: 'Jupiter', 
        radius: 3, 
        distance: 32, 
        rotationSpeed: 0.04, 
        revolutionSpeed: 0.002,
        color: 0xe67e22,
        hasRings: false
      },
      { 
        name: 'Saturn', 
        radius: 2.5, 
        distance: 40, 
        rotationSpeed: 0.038, 
        revolutionSpeed: 0.0009,
        color: 0xf1c40f,
        hasRings: true,
        ringsInnerRadius: 3,
        ringsOuterRadius: 5,
        ringsColor: 0xc8a165
      },
      { 
        name: 'Uranus', 
        radius: 1.8, 
        distance: 47, 
        rotationSpeed: 0.03, 
        revolutionSpeed: 0.0004,
        color: 0x16a085,
        hasRings: false
      },
      { 
        name: 'Neptune', 
        radius: 1.7, 
        distance: 55, 
        rotationSpeed: 0.032, 
        revolutionSpeed: 0.0001,
        color: 0x2980b9,
        hasRings: false
      }
    ];
    
    // Create planet objects
    const planetObjects = [];
    
    planets.forEach(planet => {
      // Planet orbit
      const orbitGeometry = new THREE.RingGeometry(
        planet.distance - 0.1, 
        planet.distance + 0.1,
        64
      );
      const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        opacity: 0.2,
        transparent: true,
        side: THREE.DoubleSide
      });
      const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbit.rotation.x = Math.PI / 2;
      scene.add(orbit);
      
      // Planet group (for rotation)
      const planetGroup = new THREE.Group();
      scene.add(planetGroup);
      
      // Planet mesh
      const planetGeometry = new THREE.SphereGeometry(planet.radius, 32, 32);
      const planetMaterial = new THREE.MeshStandardMaterial({ 
        color: planet.color,
        roughness: 0.7,
        metalness: 0.1
      });
      const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);
      planetMesh.position.x = planet.distance;
      planetGroup.add(planetMesh);
      
      // Add rings if planet has them
      if (planet.hasRings) {
        const ringGeometry = new THREE.RingGeometry(
          planet.ringsInnerRadius, 
          planet.ringsOuterRadius, 
          64
        );
        const ringMaterial = new THREE.MeshBasicMaterial({ 
          color: planet.ringsColor,
          opacity: 0.7,
          transparent: true,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        planetMesh.add(ring);
      }
      
      // Add moons if planet has them
      if (planet.moons) {
        planet.moons.forEach(moon => {
          // Moon group
          const moonGroup = new THREE.Group();
          planetMesh.add(moonGroup);
          
          // Moon mesh
          const moonGeometry = new THREE.SphereGeometry(moon.radius, 16, 16);
          const moonMaterial = new THREE.MeshStandardMaterial({ 
            color: moon.color,
            roughness: 0.8,
            metalness: 0
          });
          const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
          moonMesh.position.x = moon.distance;
          moonGroup.add(moonMesh);
          
          // Store moon data for animation
          planetObjects.push({
            mesh: moonGroup,
            rotationSpeed: moon.revolutionSpeed,
            rotationAxis: new THREE.Vector3(0, 1, 0)
          });
        });
      }
      
      // Store planet data for animation
      planetObjects.push({
        mesh: planetGroup,
        rotationSpeed: planet.revolutionSpeed,
        rotationAxis: new THREE.Vector3(0, 1, 0),
        selfRotationSpeed: planet.rotationSpeed,
        planetMesh
      });
    });
    
    // Add stars in background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1
    });
    
    // Create star positions
    const starsCount = 5000;
    const starsPositions = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      // Random positions in a sphere
      const radius = 500;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      
      starsPositions[i] = radius * Math.sin(phi) * Math.cos(theta);  // x
      starsPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);  // y
      starsPositions[i + 2] = radius * Math.cos(phi);  // z
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Rotate sun
      sun.rotation.y += 0.001;
      
      // Rotate planets
      planetObjects.forEach(obj => {
        // Orbit rotation
        obj.mesh.rotateOnAxis(obj.rotationAxis, obj.rotationSpeed);
        
        // Self rotation if it's a planet
        if (obj.planetMesh) {
          obj.planetMesh.rotation.y += obj.selfRotationSpeed;
        }
      });
      
      controls.update();
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Handle container resize
    const handleResize = () => {
      const newWidth = mountRef.current.clientWidth;
      const newHeight = mountRef.current.clientHeight;
      
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    
    // Add resize event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      
      // Dispose of Three.js resources
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      renderer.dispose();
    };
  }, []);
  
  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
  );
}