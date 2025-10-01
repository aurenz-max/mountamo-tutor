'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// Optional: For debugging physics. Install with: npm install cannon-es-debugger
// import CannonDebugger from 'cannon-es-debugger';

// --- Constants ---
const GROUND_COLOR = 0xaaaaaa;
const CATAPULT_COLOR = 0x8b4513; // Brown
const BALL_COLOR = 0xff0000; // Red
const ARM_LENGTH = 4;
const BALL_RADIUS = 0.3;
const BASE_SIZE = { x: 2, y: 0.5, z: 1 }; // Width, Height, Depth
const ARM_SIZE = { x: 0.2, y: ARM_LENGTH, z: 0.2 };
const PIVOT_HEIGHT_ON_BASE = BASE_SIZE.y / 2; // Pivot point height relative to base bottom
const INITIAL_ANGLE_DEG = 45;
const INITIAL_FORCE = 50;
const PHYSICS_TIMESTEP = 1 / 60;

function CatapultScene() {
  const mountRef = useRef(null);
  // Store mutable non-triggering state (Three/Cannon objects) here
  const stateRef = useRef({
    scene: null,
    world: null,
    renderer: null,
    camera: null,
    controls: null,
    // cannonDebugger: null, // Optional debugger instance
    animationId: null,
    groundBody: null,
    baseBody: null,
    armBody: null,
    ballBody: null,
    armMesh: null,
    ballMesh: null,
    hingeConstraint: null,
    ballConstraint: null, // Constraint attaching ball to arm
  }).current; // .current ensures we have the same object reference across renders

  const [angle, setAngle] = useState(INITIAL_ANGLE_DEG);
  const [force, setForce] = useState(INITIAL_FORCE);
  const [isLaunched, setIsLaunched] = useState(false);

  // --- Helper to add ball constraint ---
  const addBallConstraint = useCallback(() => {
    // Guards ensure objects exist and constraint isn't duplicated
    if (!stateRef.world || !stateRef.armBody || !stateRef.ballBody || stateRef.ballConstraint) return;

    // Define attachment point on arm (top end) relative to arm's center
    const pivotOnArm = new CANNON.Vec3(0, ARM_LENGTH / 2, 0);
    // Define attachment point on ball (center) relative to ball's center
    const pivotOnBall = new CANNON.Vec3(0, 0, 0);

    stateRef.ballConstraint = new CANNON.PointToPointConstraint(
      stateRef.armBody, pivotOnArm,
      stateRef.ballBody, pivotOnBall
    );
    stateRef.world.addConstraint(stateRef.ballConstraint);
    // console.log("Ball constraint ADDED"); // Debugging
  }, [stateRef]); // Depends only on the stateRef object itself

  // --- Helper to remove ball constraint ---
  const removeBallConstraint = useCallback(() => {
    if (stateRef.world && stateRef.ballConstraint) {
      stateRef.world.removeConstraint(stateRef.ballConstraint);
      stateRef.ballConstraint = null; // Clear the reference
      // console.log("Ball constraint REMOVED"); // Debugging
    }
  }, [stateRef]); // Depends only on the stateRef object itself

  // --- Function to position arm and ball based on angle (before launch) ---
  const positionArmAndBall = useCallback((currentAngleDeg) => {
    // --- GUARD: Ensure physics bodies and hinge are initialized ---
    if (!stateRef.armBody || !stateRef.ballBody || !stateRef.baseBody || !stateRef.hingeConstraint) {
       // console.warn("Attempted to position arm/ball before physics objects were ready.");
       return;
    }
    // --- END GUARD ---

    const angleRad = THREE.MathUtils.degToRad(currentAngleDeg);

    // --- Reset Velocities ---
    stateRef.armBody.velocity.setZero(); // Use setZero for clarity
    stateRef.armBody.angularVelocity.setZero();
    stateRef.ballBody.velocity.setZero();
    stateRef.ballBody.angularVelocity.setZero();

    // --- Position Arm ---
    // 1. Calculate desired arm rotation
    const armRotation = new CANNON.Quaternion();
    armRotation.setFromEuler(0, 0, angleRad, 'XYZ'); // Rotate around Z axis

    // 2. Find the pivot point on the base in world coordinates
    const pivotWorld = new CANNON.Vec3();
    stateRef.baseBody.localToWorld(stateRef.hingeConstraint.pivotA, pivotWorld); // pivotA is relative to baseBody

    // 3. Find the vector from the arm's pivot (pivotB) to its center in local frame
    const pivotToCenterLocal = new CANNON.Vec3().vsub(stateRef.hingeConstraint.pivotB); // Vector from pivotB to arm origin (0,0,0)

    // 4. Rotate this vector by the desired arm rotation
    const rotatedPivotToCenter = armRotation.vmult(pivotToCenterLocal);

    // 5. Calculate the arm's world center position
    const armCenterPositionWorld = pivotWorld.vadd(rotatedPivotToCenter);

    // 6. Set arm's position and rotation
    stateRef.armBody.position.copy(armCenterPositionWorld);
    stateRef.armBody.quaternion.copy(armRotation);
    stateRef.armBody.sleepState = CANNON.Body.AWAKE; // Ensure it's active

    // --- Position Ball ---
    // 1. Define ball's position relative to the arm's center (slightly above the end)
    const ballOffsetLocal = new CANNON.Vec3(0, ARM_LENGTH / 2 + BALL_RADIUS * 0.1, 0);

    // 2. Transform this local offset to world coordinates USING the arm's current state
    const ballPositionWorld = new CANNON.Vec3(); // Create a vector to store the result
    stateRef.armBody.localToWorld(ballOffsetLocal, ballPositionWorld); // Pass target vector

    // 3. Set ball's position and initial orientation
    stateRef.ballBody.position.copy(ballPositionWorld);
    stateRef.ballBody.quaternion.copy(stateRef.armBody.quaternion); // Match arm orientation initially
    stateRef.ballBody.sleepState = CANNON.Body.AWAKE; // Ensure it's active

    // --- Add Constraint ---
    // Make sure the ball constraint is added (or re-added if resetting)
    // Important to do this *after* positioning both bodies
    addBallConstraint();

  }, [stateRef, addBallConstraint]); // Depends on stateRef content and addBallConstraint helper

  // --- Reset Function ---
  const resetState = useCallback(() => {
    setIsLaunched(false);
    setAngle(INITIAL_ANGLE_DEG); // Reset sliders to initial values
    setForce(INITIAL_FORCE);

    // Remove any existing ball constraint *before* repositioning
    removeBallConstraint();

    // Reposition arm and ball to the initial angle. This function
    // will also reset velocities and re-add the ball constraint.
    positionArmAndBall(INITIAL_ANGLE_DEG);

    // Just in case: ensure the main hinge is still there (it shouldn't be removed normally)
    if (stateRef.world && stateRef.hingeConstraint && !stateRef.world.constraints.includes(stateRef.hingeConstraint)) {
      stateRef.world.addConstraint(stateRef.hingeConstraint);
      // console.log("Hinge constraint RE-ADDED"); // Debugging
    }

  }, [stateRef, positionArmAndBall, removeBallConstraint]); // Add dependencies


  // --- Setup Function (called once on mount) ---
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return; // Mount point check

    // --- Basic Scene Setup ---
    stateRef.scene = new THREE.Scene();
    stateRef.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    stateRef.camera.position.set(8, 4, 8); // Adjusted camera start
    stateRef.camera.lookAt(0, 1, 0); // Look towards pivot area

    stateRef.renderer = new THREE.WebGLRenderer({ antialias: true });
    stateRef.renderer.setSize(window.innerWidth, window.innerHeight);
    stateRef.renderer.shadowMap.enabled = true; // Enable shadows
    stateRef.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
    currentMount.appendChild(stateRef.renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x606060);
    stateRef.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024; // Shadow quality
    directionalLight.shadow.mapSize.height = 1024;
    stateRef.scene.add(directionalLight);
    // const lightHelper = new THREE.DirectionalLightHelper(directionalLight, 1); // Debug light
    // stateRef.scene.add(lightHelper);

    // --- Orbit Controls ---
    stateRef.controls = new OrbitControls(stateRef.camera, stateRef.renderer.domElement);
    stateRef.controls.target.set(0, 1, 0); // Target the approximate pivot area
    stateRef.controls.enableDamping = true;
    stateRef.controls.dampingFactor = 0.05;
    stateRef.controls.update();

    // --- Physics World ---
    stateRef.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    // stateRef.world.broadphase = new CANNON.SAPBroadphase(stateRef.world); // Potentially faster broadphase
    stateRef.world.allowSleep = true; // Allow bodies to sleep to save performance
    stateRef.world.solver.iterations = 10;

    // Optional: Physics Debugger
    // stateRef.cannonDebugger = CannonDebugger(stateRef.scene, stateRef.world, {});

    // --- Materials ---
    const groundMaterial = new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.9, metalness: 0.1 });
    const catapultMaterial = new THREE.MeshStandardMaterial({ color: CATAPULT_COLOR, roughness: 0.6, metalness: 0.2 });
    const ballMaterial = new THREE.MeshStandardMaterial({ color: BALL_COLOR, roughness: 0.5, metalness: 0.1 });

    // --- Ground ---
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    stateRef.scene.add(groundMesh);

    const groundShape = new CANNON.Plane();
    stateRef.groundBody = new CANNON.Body({ mass: 0, material: new CANNON.Material('ground') }); // Give materials names
    stateRef.groundBody.addShape(groundShape);
    stateRef.groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    stateRef.world.addBody(stateRef.groundBody);

    // --- Catapult Base ---
    const baseGeometry = new THREE.BoxGeometry(BASE_SIZE.x, BASE_SIZE.y, BASE_SIZE.z);
    const baseMesh = new THREE.Mesh(baseGeometry, catapultMaterial);
    baseMesh.position.set(0, BASE_SIZE.y / 2, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    stateRef.scene.add(baseMesh);

    const baseShape = new CANNON.Box(new CANNON.Vec3(BASE_SIZE.x / 2, BASE_SIZE.y / 2, BASE_SIZE.z / 2));
    stateRef.baseBody = new CANNON.Body({ mass: 0, material: new CANNON.Material('catapult') }); // Static base
    stateRef.baseBody.addShape(baseShape);
    stateRef.baseBody.position.set(0, BASE_SIZE.y / 2, 0);
    stateRef.world.addBody(stateRef.baseBody);

    // --- Catapult Arm ---
    const armGeometry = new THREE.BoxGeometry(ARM_SIZE.x, ARM_SIZE.y, ARM_SIZE.z);
    stateRef.armMesh = new THREE.Mesh(armGeometry, catapultMaterial);
    stateRef.armMesh.castShadow = true;
    stateRef.armMesh.receiveShadow = true;
    // Position/rotation is set by physics body in the animation loop
    stateRef.scene.add(stateRef.armMesh);

    const armShape = new CANNON.Box(new CANNON.Vec3(ARM_SIZE.x / 2, ARM_SIZE.y / 2, ARM_SIZE.z / 2));
    stateRef.armBody = new CANNON.Body({
        mass: 5,
        material: new CANNON.Material('catapult'),
        linearDamping: 0.01,
        angularDamping: 0.05 // Add some damping
    });
    stateRef.armBody.addShape(armShape);
    // Initial position and orientation set by resetState -> positionArmAndBall
    stateRef.world.addBody(stateRef.armBody);

    // --- Hinge constraint between Base and Arm ---
    stateRef.hingeConstraint = new CANNON.HingeConstraint(stateRef.baseBody, stateRef.armBody, {
      pivotA: new CANNON.Vec3(0, PIVOT_HEIGHT_ON_BASE, 0), // Pivot point relative to base center (top center)
      pivotB: new CANNON.Vec3(0, -ARM_LENGTH / 2, 0),     // Pivot point relative to arm center (bottom center)
      axisA: new CANNON.Vec3(0, 0, 1),                    // Hinge axis in base frame (Z-axis)
      axisB: new CANNON.Vec3(0, 0, 1),                    // Hinge axis in arm frame (Z-axis)
      // maxForce: 1e6 // Optional: constraint force limit
    });
    stateRef.world.addConstraint(stateRef.hingeConstraint);

    // --- Projectile (Ball) ---
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    stateRef.ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
    stateRef.ballMesh.castShadow = true;
    stateRef.ballMesh.receiveShadow = true;
    // Position/rotation is set by physics body
    stateRef.scene.add(stateRef.ballMesh);

    const ballShape = new CANNON.Sphere(BALL_RADIUS);
    stateRef.ballBody = new CANNON.Body({
        mass: 1,
        material: new CANNON.Material('ball'),
        linearDamping: 0.1, // Air resistance
        angularDamping: 0.1
    });
    stateRef.ballBody.addShape(ballShape);
    // Initial position relative to arm set by resetState -> positionArmAndBall
    stateRef.world.addBody(stateRef.ballBody);

    // --- Contact Materials (Example: Ball bouncing) ---
    const groundMat = stateRef.groundBody.material;
    const ballMat = stateRef.ballBody.material;
    const ballGroundContact = new CANNON.ContactMaterial(groundMat, ballMat, {
        friction: 0.4,
        restitution: 0.6, // How much bounce (0=none, 1=perfect)
    });
    stateRef.world.addContactMaterial(ballGroundContact);

    // --- Animation Loop ---
    const animate = () => {
      stateRef.animationId = requestAnimationFrame(animate);

      // Step the physics world
      stateRef.world.step(PHYSICS_TIMESTEP);

      // Update Three.js meshes from physics bodies
      if (stateRef.armMesh && stateRef.armBody) {
        stateRef.armMesh.position.copy(stateRef.armBody.position);
        stateRef.armMesh.quaternion.copy(stateRef.armBody.quaternion);
      }
      if (stateRef.ballMesh && stateRef.ballBody) {
        stateRef.ballMesh.position.copy(stateRef.ballBody.position);
        stateRef.ballMesh.quaternion.copy(stateRef.ballBody.quaternion);
      }

      // Update debugger (optional)
      // stateRef.cannonDebugger?.update();

      // Update controls and render
      stateRef.controls?.update(); // Add null check for controls
      if (stateRef.renderer && stateRef.scene && stateRef.camera) { // Add checks
         stateRef.renderer.render(stateRef.scene, stateRef.camera);
      }
    };

    // --- Resize Handler ---
    const handleResize = () => {
      if (stateRef.camera && stateRef.renderer) {
        stateRef.camera.aspect = window.innerWidth / window.innerHeight;
        stateRef.camera.updateProjectionMatrix();
        stateRef.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // --- Initial State Setup ---
    // Call resetState *after* all bodies and constraints are created
    resetState(); // This now calls positionArmAndBall correctly

    // --- Start Animation ---
    animate(); // Start the loop AFTER initial setup

    // --- Cleanup ---
    return () => {
      window.removeEventListener('resize', handleResize);
      if (stateRef.animationId) {
        cancelAnimationFrame(stateRef.animationId);
      }
      if (stateRef.world) {
        // Remove constraints first is generally safer
        while (stateRef.world.constraints.length > 0) {
            stateRef.world.removeConstraint(stateRef.world.constraints[0]);
        }
        // Remove bodies
        while (stateRef.world.bodies.length > 0) {
            stateRef.world.removeBody(stateRef.world.bodies[0]);
        }
      }
       if (stateRef.scene) {
            // Dispose geometries, materials, textures etc. if needed for complex scenes
            // Simple example: just clear the scene children
            while (stateRef.scene.children.length > 0) {
                stateRef.scene.remove(stateRef.scene.children[0]);
            }
        }
      if (stateRef.renderer) {
        stateRef.renderer.dispose(); // Dispose GPU resources
        if (currentMount && currentMount.contains(stateRef.renderer.domElement)) {
            currentMount.removeChild(stateRef.renderer.domElement);
        }
      }
      if (stateRef.controls) {
        stateRef.controls.dispose();
      }
      // Clear refs manually (helps garbage collection)
       Object.keys(stateRef).forEach(key => stateRef[key] = null);
       // console.log("Cleanup complete");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run setup only once. `stateRef` is stable. resetState is memoized.

  // --- Update Arm/Ball Position when Angle changes (before launch) ---
  useEffect(() => {
    if (!isLaunched) {
      // When angle slider changes, reposition arm/ball
      positionArmAndBall(angle);
    }
    // No need to call addBallConstraint here, positionArmAndBall handles it
  }, [angle, isLaunched, positionArmAndBall]); // Re-run if angle/launch state changes or position function ref changes

  // --- Launch Function ---
  const launch = useCallback(() => {
    if (isLaunched || !stateRef.armBody || !stateRef.ballBody) return;

    setIsLaunched(true);

    // Remove the constraint *before* applying impulse so the ball is free to move
    removeBallConstraint();

    // Apply a rotational impulse to the arm around the hinge axis (Z)
    // Impulse = change in angular momentum. We apply an instantaneous change.
    const impulseStrength = force * 0.8; // Needs tuning! Increase multiplier for more power
    // Impulse should be applied *along the rotation axis* (Z axis in world frame here)
    const impulseVectorWorld = new CANNON.Vec3(0, 0, impulseStrength);

    // Apply the impulse relative to the arm's center of mass for pure rotation change
    // For hinge rotation, applying impulse at a point away from hinge could also work
    stateRef.armBody.applyImpulse(impulseVectorWorld, stateRef.armBody.position);
    // Ensure arm is awake after impulse
    stateRef.armBody.wakeUp();
    if (stateRef.ballBody) stateRef.ballBody.wakeUp(); // Wake ball too


    // Alternative: Apply Torque over a short duration (more complex to manage)
    // const torqueStrength = force * 10; // Adjust multiplier
    // const torqueVector = new CANNON.Vec3(0, 0, torqueStrength);
    // stateRef.armBody.applyTorque(torqueVector); // Apply torque for one frame only? Or over time?

  }, [isLaunched, force, stateRef, removeBallConstraint]); // Dependencies

  // --- JSX ---
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', background: '#ddddff' }}>
      {/* Canvas */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {/* UI Controls */}
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'black', background: 'rgba(255,255,255,0.8)', padding: 15, borderRadius: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
        <div style={{ marginBottom: 12 }}>
          <button onClick={launch} disabled={isLaunched} style={{ padding: '8px 15px', marginRight: 10, cursor: isLaunched ? 'not-allowed' : 'pointer' }}>Launch</button>
          <button onClick={resetState} style={{ padding: '8px 15px', cursor: 'pointer' }}>Reset</button>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="angleRange" style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Angle: {angle}°</label>
          <input
            id="angleRange"
            type="range"
            min="10" // Prevent একদম flat angle
            max="85" // Prevent vertical angle which might be unstable
            value={angle}
            onChange={(e) => !isLaunched && setAngle(parseInt(e.target.value, 10))}
            disabled={isLaunched}
            style={{ display: 'block', width: 200, cursor: isLaunched ? 'not-allowed' : 'pointer' }}
          />
        </div>
        <div>
          <label htmlFor="forceRange" style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Force: {force}</label>
          <input
            id="forceRange"
            type="range"
            min="10"
            max="100" // Adjust max force as needed
            value={force}
            onChange={(e) => !isLaunched && setForce(parseInt(e.target.value, 10))}
            disabled={isLaunched}
            style={{ display: 'block', width: 200, cursor: isLaunched ? 'not-allowed' : 'pointer' }}
          />
        </div>
      </div>
    </div>
  );
}

export default CatapultScene;